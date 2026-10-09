// THE MIX'S DUCK (lane DJSILENCE, navigator 2026-10-07, choosing THE DUCK for the drops lost in DEFAULT MODE): on a
// drag-box drop THE DUCK also dips the picture's static and the binaural pair, not only THE DJ's bus: the same 3.5 dB,
// the same shape, the same trigger, never for the machine's own waves, never under MUTE ALL, and never a tone's pitch.
// Each test fails on the code before this lane: a drop ducked THE DJ's bus alone (duck.js had no channels).
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = new EventTarget();
const { Ctx, all, reach } = await import('./fakeaudio.mjs');
const hear = await import('../src/index.js');
const { configure, unlockNow, sound, createHearing, createGammaSound, createSymphony, DUCK, duckDrop, onDuck } = hear;
const duck = await import('../src/duck.js');

configure({ createContext: () => new Ctx() });
const E = unlockNow();
sound.setMuted(false);

const STATS = { T: 1.2, flips: 50, n: 400, ePer: -0.5, q: 0.5, phase: 'cooling', index: 0, power: 0, maxPower: 8, sweeps: 1 };
const floor = 10 ** (-DUCK.depthDb / 20);
const mixOf = (kind) => (duck.duckChannels ? duck.duckChannels().filter((c) => c.kind === kind) : []);
// the two events THE DUCK writes on a gain: down to the floor over the attack, back to 1 after the hold
const isDuck = (param, t) => {
  const ev = param.events.slice(-2);
  return ev.length === 2 && ev[0][0] === 'target' && Math.abs(ev[0][1] - floor) < 1e-9 && Math.abs(ev[0][2] - t) < 1e-9 && ev[0][3] === DUCK.attack
    && ev[1][0] === 'target' && ev[1][1] === 1 && Math.abs(ev[1][2] - (t + DUCK.hold)) < 1e-9 && ev[1][3] === DUCK.release;
};

function theMix() {
  const m0 = all.length;
  const h = createHearing({ preset: 'crackle', playing: true });
  h.update(STATS);
  const g = createGammaSound({ mode: 'binaural', level: 0.5 });
  const s = createSymphony({ seed: 81, theme: 'highlands', auto: false, steer: null, votes: null, house: true });
  for (let k = 0; k < 12; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  return { m0, dispose() { h.dispose(); g.dispose(); s.dispose(); } };
}

test('a drop dips the picture\'s static and the binaural pair with THE DUCK\'s own shape', () => {
  const mix = theMix();
  const told = [];
  const off = onDuck((d) => told.push(d));
  const t = (E.ctx.currentTime += 1);
  duckDrop({ at: t });
  off();
  const stat = mixOf('static');
  const pair = mixOf('binaural');
  assert.ok(stat.length >= 1, 'no static channel joins THE DUCK');
  assert.ok(pair.length >= 2, 'the symphony\'s and the gamma sound\'s dry channels must both join THE DUCK');
  for (const c of [...stat, ...pair]) assert.ok(isDuck(c.node.gain, t), `${c.kind}: not THE DUCK's shape`);
  assert.ok(told.at(-1).channels >= 3, 'the duck did not tell of its channels');
  mix.dispose();
});

test('the static and the pair reach the master through their duck', () => {
  const mix = theMix();
  const made = all.slice(mix.m0);
  const nodes = [...mixOf('static'), ...mixOf('binaural')].map((c) => c.node);
  assert.ok(nodes.length >= 3);
  for (const n of nodes) assert.ok(reach(n).has(E.master), 'a duck gain that never reaches the master ducks nothing');
  // the binaural pair's merger (two ear gains of 0.5, each fed by one sine) reaches the master only through a duck
  const into = (n) => made.filter((x) => x.out.has(n));
  const ear = (g) => g.kind === 'gain' && g.gain.value === 0.5 && into(g).length === 1 && into(g)[0].kind === 'osc';
  const pairs = made.filter((n) => n.kind === 'merger' && into(n).length === 2 && into(n).every(ear) && reach(n).has(E.master));
  assert.ok(pairs.length >= 1, 'the binaural pair is built');
  for (const m of pairs) assert.ok(nodes.some((d) => reach(m).has(d)), 'a binaural pair reaches the master around every duck');
  mix.dispose();
});

test('the duck never touches a tone: no oscillator frequency is written by a drop', () => {
  const mix = theMix();
  const oscs = all.slice(mix.m0).filter((n) => n.kind === 'osc');
  assert.ok(oscs.length >= 2);
  const before = oscs.map((o) => o.frequency.events.length);
  duckDrop({ at: (E.ctx.currentTime += 1) });
  assert.deepEqual(oscs.map((o) => o.frequency.events.length), before, 'a drop wrote an oscillator\'s frequency');
  mix.dispose();
});

test('never under MUTE ALL and never for the machine\'s own waves', () => {
  const mix = theMix();
  const nodes = [...mixOf('static'), ...mixOf('binaural')].map((c) => c.node);
  assert.ok(nodes.length >= 3, 'the mix has no duck channels to hold still');
  const before = nodes.map((n) => n.gain.events.length);
  sound.setMuted(true);
  assert.equal(duckDrop({}), 0);
  sound.setMuted(false);
  assert.equal(duckDrop({ from: 'sound' }), 0);
  assert.equal(duckDrop({ from: 'keys' }), 0);
  assert.deepEqual(nodes.map((n) => n.gain.events.length), before);
  // the vacuity control: a person's drop does duck them
  assert.ok(duckDrop({ from: 'user' }) >= 3);
  assert.ok(nodes.every((n, i) => n.gain.events.length === before[i] + 2));
  mix.dispose();
});

test('a disposed channel leaves THE DUCK', () => {
  const mix = theMix();
  const n0 = duck.duckChannels().length;
  mix.dispose();
  assert.ok(duck.duckChannels().length <= n0 - 3, 'disposed channels stayed in THE DUCK');
});
