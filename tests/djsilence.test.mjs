// DJSILENCE (lane DJSILENCE, 2026-10-07): lane DROPDUCK read THE DJ's effect bus (dj-fx.js) silent from about 5.8 min
// of page life while the master stayed loud, and asked whether a set change leaves the bus with no input. Measured
// in the browser (SETTLE/runs/djsilence/MEASURED.md): it does not. The silence is the hero's SHUFFLE moving to a
// popular mode that has no DJ at all, so nothing plays to the bus. These tests hold the half that the measurement
// cleared: across a new set, a stop and a play again, every voice THE DJ starts still reaches the master THROUGH the
// bus, and none reaches it around the bus.
//
// The tests pass on the code before the lane, because the code before the lane was right; each one is red under an
// aimed arm that routes the house set around the bus (SETTLE/runs/djsilence/redproof.txt).
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = new EventTarget();
const { Ctx, all, reach } = await import('./fakeaudio.mjs');
const hear = await import('../src/index.js');
const { configure, unlockNow, sound, createSymphony, duckTargets } = hear;

configure({ createContext: () => new Ctx() });
const E = unlockNow();
sound.setMuted(false);

const bars = (s, n) => { for (let k = 0; k < n; k++) { E.ctx.currentTime += 0.5; s.tick(); } };
// every audio node built since mark m0 that reaches the speakers: the new set's voices, its rack chain, its fades
const madeSince = (m0) => all.slice(m0).filter((n) => reach(n).has(E.master));
// each one reaches the master THROUGH the bus: it feeds the bus input, or it is a part of the bus (a section the bus
// builds on first use sits after the input). The binaural pair is not rebuilt by a set, so it is not among them
function throughBus(nodes, bus) {
  const inside = reach(bus.input);
  return nodes.map((n) => inside.has(n) || reach(n).has(bus.input));
}

test('a new set: every voice THE DJ starts after it still reaches the master through THE DJ\'s bus', () => {
  const s = createSymphony({ seed: 61, theme: 'highlands', auto: false, steer: null, votes: null, house: true });
  bars(s, 24);
  const bus = duckTargets().at(-1);
  const set0 = s.state.set;
  const m0 = all.length;
  s.nextSet();
  bars(s, 40);
  assert.ok((s.state.set) > set0, 'a new set began');
  assert.equal(duckTargets().at(-1), bus, 'the same bus: a set change builds no second one');
  const via = throughBus(madeSince(m0), bus);
  assert.ok(via.length >= 10, `the new set built its sound (${via.length} nodes)`);
  assert.equal(via.filter((x) => !x).length, 0, 'no voice of the new set reaches the master around the bus');
  s.dispose();
});

test('three sets in a row: the bus still receives the voices of the last one', () => {
  const s = createSymphony({ seed: 62, theme: 'highlands', auto: false, steer: null, votes: null, house: true });
  bars(s, 24);
  const bus = duckTargets().at(-1);
  for (let k = 0; k < 2; k++) { s.nextSet(); bars(s, 16); }
  const m0 = all.length;
  s.nextSet();
  bars(s, 24);
  const via = throughBus(madeSince(m0), bus);
  assert.ok(via.length >= 10, `the third set built its sound (${via.length} nodes)`);
  assert.equal(via.filter((x) => !x).length, 0, 'no voice of the third set reaches the master around the bus');
  s.dispose();
});

test('the shuffle away and back (stop, house off; play, house on): the DJ comes back through the bus', () => {
  const s = createSymphony({ seed: 63, theme: 'highlands', auto: false, steer: null, votes: null, house: true });
  bars(s, 24);
  const bus = duckTargets().at(-1);
  // a popular mode: the hero's plan turns the symphony and the house off (SETTLE/settle-site heroSoundPlan kind 'mode')
  s.setHouse(false);
  s.stop();
  bars(s, 24);
  // DEFAULT MODE again: both back on
  s.play();
  s.setHouse(true);
  const m0 = all.length;
  bars(s, 24);
  const via = throughBus(madeSince(m0), bus);
  assert.ok(via.length >= 10, `the DJ built its sound again (${via.length} nodes)`);
  assert.equal(via.filter((x) => !x).length, 0, 'no voice reaches the master around the bus after the return');
  s.dispose();
});
