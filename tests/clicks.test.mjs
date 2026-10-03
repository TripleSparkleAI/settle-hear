// THE CLICK NOISES: 24 sounds from a seeded no-repeat bag; the gesture rule, MUTE ALL and the tone floors on every
// envelope; the hero input tap; and the 'settle:ripple' listener that plays one per ripple asking for sound.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, all, reach } from './fakeaudio.mjs';
import { configure, unlockNow, getEngine, sound, CLICK_NOISES, CLICK_TONE, clickBag, playClickNoise, armClickNoises, onClickNoise } from '../src/index.js';

test('there are between 20 and 30 click noises, each named and in a family', () => {
  assert.ok(CLICK_NOISES.length >= 20 && CLICK_NOISES.length <= 30, `${CLICK_NOISES.length}`);
  assert.equal(new Set(CLICK_NOISES.map((n) => n.name)).size, CLICK_NOISES.length);
  assert.ok(new Set(CLICK_NOISES.map((n) => n.family)).size >= 5);
});

test('the bag plays every noise once before any repeats, and never the same one twice in a row', () => {
  const n = CLICK_NOISES.length;
  const b = clickBag(n, 7);
  const draws = Array.from({ length: n * 20 }, () => b.next());
  for (let k = 0; k < 20; k++) assert.equal(new Set(draws.slice(k * n, (k + 1) * n)).size, n, `pass ${k} holds every noise`);
  for (let i = 1; i < draws.length; i++) assert.notEqual(draws[i], draws[i - 1], `no repeat at ${i}`);
  assert.deepEqual(Array.from({ length: 5 }, () => clickBag(n, 3).next()), Array(5).fill(clickBag(n, 3).next()), 'seeded');
});

test('before the first gesture nothing is built', () => {
  configure({ createContext: () => new Ctx() });
  assert.equal(getEngine(), null);
  assert.equal(playClickNoise(), null);
});

test('every noise ramps from zero to zero within the tone floors, and no raw square reaches the output', () => {
  unlockNow();
  const E = getEngine();
  sound.setMuted(false);
  for (let k = 0; k < CLICK_NOISES.length; k++) {
    const start = all.length;
    const d = playClickNoise({ index: k, strength: 1 });
    assert.equal(d.index, k);
    const made = all.slice(start);
    const envs = made.filter((n) => n.kind === 'gain' && n.gain.events.some((e) => e[0] === 'lin'));
    assert.ok(envs.length > 0, `${CLICK_NOISES[k].name} has an envelope`);
    for (const g of envs) {
      const ev = g.gain.events;
      assert.equal(ev[0][1], 0, 'starts at zero');
      assert.equal(ev.at(-1)[1], 0, 'ends at zero');
      const peakAt = ev[1][2] - ev[0][2];
      assert.ok(peakAt >= CLICK_TONE.attackMin - 1e-9, `${CLICK_NOISES[k].name} attack ${peakAt}`);
      const rel = ev.at(-1)[2] - ev.at(-2)[2];
      assert.ok(rel >= CLICK_TONE.releaseMin - 1e-9, `${CLICK_NOISES[k].name} release ${rel}`);
      assert.ok(Math.max(...ev.map((e) => e[1])) <= CLICK_TONE.peak + 1e-9, 'peak within the written level');
    }
    for (const o of made.filter((n) => n.kind === 'osc' && (n.type === 'square' || n.type === 'sawtooth'))) {
      const next = [...o.out][0];
      assert.equal(next.kind, 'biquad');
      assert.equal(next.type, 'lowpass');
      assert.ok(next.frequency.value <= CLICK_TONE.rawCeiling);
    }
    // everything a noise makes reaches the master limiter
    const anyOsc = made.find((n) => n.kind === 'osc' || n.kind === 'src');
    assert.ok(reach(anyOsc).has(E.limit), `${CLICK_NOISES[k].name} reaches the limiter`);
  }
});

test('MUTE ALL: a muted page builds nothing', () => {
  sound.setMuted(true);
  const before = all.length;
  assert.equal(playClickNoise(), null);
  assert.equal(all.length, before);
  sound.setMuted(false);
});

test('the hero input: a click noise sends a copy into the engine\'s picture tap when there is one', () => {
  const E = getEngine();
  const tap = E.ctx.createGain();
  E.taps = new Map([['picture', tap]]);
  const start = all.length;
  playClickNoise({ index: 0 });
  const outs = all.slice(start).filter((n) => n.kind === 'gain' && n.out.has(tap));
  assert.equal(outs.length, 1);
  delete E.taps;
});

test('armClickNoises plays one noise for every ripple that asks for sound, panned by where it happened', () => {
  const ls = {};
  const win = { innerWidth: 1000, scrollX: 0, addEventListener: (k, fn) => { ls[k] = fn; }, removeEventListener: (k) => { delete ls[k]; } };
  const heard = [];
  const offN = onClickNoise((d) => heard.push(d));
  const off = armClickNoises({ win, seed: 5 });
  ls['settle:ripple']({ detail: { x: 900, y: 10, strength: 0.8, sound: true } });
  ls['settle:ripple']({ detail: { x: 100, y: 10, strength: 0.8, sound: false } });
  ls['settle:ripple']({ detail: { x: 100, y: 10, strength: 0.8, sound: true } });
  assert.equal(heard.length, 2);
  assert.ok(heard[0].pan > 0 && heard[1].pan < 0);
  // THE CLICK LOCK (clicklock.js): two ripples in one burst replay the locked noise
  assert.equal(heard[0].index, heard[1].index);
  assert.equal(heard[1].locked, true);
  off();
  offN();
  assert.equal(ls['settle:ripple'], undefined);
});
