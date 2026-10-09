// THE RADIAL DECK, psytrance half (lane PSYRADIAL): the 25 entries of RADIAL_PSY, checked on the graph each one
// builds (tests/fakeaudio.mjs records every node, connection and automation event). Levels, spectra and likeness are
// measured on rendered samples by the shared deck tests and by tools/sfx_measure.py in Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, Node, all, reach } from './fakeaudio.mjs';
import { RADIAL_PSY, PSY_LEVEL, psyRng } from '../src/sfx-radial-psy.js';

// build one entry into a fresh fake context; returns the nodes it made, the destination and the end time
function build(entry, { seed = 1, strength = 1, at = 0.25 } = {}) {
  const ctx = new Ctx();
  const dest = ctx.createGain();
  const start = all.length;
  const end = entry.render(ctx, at, dest, { seed, strength });
  return { ctx, dest, end, at, made: all.slice(start) };
}

const onAudioPath = (n, dest) => reach(n).has(dest);
const isEnvelope = (g) => g.gain.events.length > 0 && g.gain.events[0][1] === 0;
const events = (made) => made.flatMap((n) => Object.values(n).filter((p) => p && p.kind === 'param').flatMap((p) => p.events.map((e) => e.join(':'))));

test('there are 25 radial sounds, frozen, each well formed and uniquely named', () => {
  assert.equal(RADIAL_PSY.length, 25);
  assert.ok(Object.isFrozen(RADIAL_PSY));
  assert.equal(new Set(RADIAL_PSY.map((e) => e.id)).size, 25);
  assert.equal(new Set(RADIAL_PSY.map((e) => e.name)).size, 25);
  for (const e of RADIAL_PSY) {
    assert.ok(Object.isFrozen(e), e.id);
    assert.match(e.id, /^psy-[a-z0-9]+(-[a-z0-9]+)+$/, e.id);
    assert.equal(e.deck, 'radial');
    assert.equal(e.lane, 'PSYRADIAL');
    assert.ok(e.kind && typeof e.kind === 'string', e.id);
    assert.equal(e.airy, false, e.id);
    assert.equal(typeof e.render, 'function');
    assert.ok(e.dur > 0.1 && e.dur <= 0.6, `${e.id} dur ${e.dur}`);
    assert.ok(e.level > 0 && e.level < 0.5, `${e.id} level ${e.level}`);
  }
  assert.ok(new Set(RADIAL_PSY.map((e) => e.kind)).size >= 6, 'at least six families');
});

test('every entry records how it was made (THE PROVENANCE RULE)', () => {
  for (const e of RADIAL_PSY) {
    const p = e.provenance;
    assert.equal(p.method, 'procedural', e.id);
    assert.match(p.made, /^\d{4}-\d{2}-\d{2}$/, e.id);
    assert.ok(typeof p.recipe === 'string' && p.recipe.length > 30, e.id);
    assert.doesNotMatch(p.recipe, /[\u2013\u2014]/, `${e.id}: no en or em dash`);
  }
});

test('render returns its end time, and the stated length is that end time', () => {
  for (const e of RADIAL_PSY) {
    const { end, at } = build(e);
    assert.ok(Math.abs(end - at - e.dur) < 0.002, `${e.id}: end ${end - at} vs dur ${e.dur}`);
  }
});

test('every envelope on the audio path starts and ends at zero, within the tone floors', () => {
  for (const e of RADIAL_PSY) {
    const { made, dest } = build(e);
    const envs = made.filter((n) => n.kind === 'gain' && isEnvelope(n) && onAudioPath(n, dest));
    assert.ok(envs.length >= 1, `${e.id} has an output envelope`);
    for (const g of envs) {
      const ev = g.gain.events;
      assert.equal(ev.at(-1)[1], 0, `${e.id} ends at zero`);
      const firstRise = ev.findIndex((x) => x[1] > 0);
      assert.ok(ev[firstRise][2] - ev[0][2] >= PSY_LEVEL.attackMin - 1e-9, `${e.id} attack`);
      assert.ok(ev.at(-1)[2] - ev.at(-2)[2] >= PSY_LEVEL.releaseMin - 1e-9, `${e.id} release`);
      for (const x of ev) assert.ok(Number.isFinite(x[1]) && x[1] >= 0, `${e.id} finite level`);
    }
  }
});

test('a raw saw or square always meets a lowpass at or below 2.4 kHz first', () => {
  let raws = 0;
  for (const e of RADIAL_PSY) {
    const { made } = build(e);
    for (const o of made.filter((n) => n.kind === 'osc' && (n.type === 'square' || n.type === 'sawtooth'))) {
      const next = [...o.out];
      assert.equal(next.length, 1, `${e.id}: a raw wave goes one place`);
      assert.equal(next[0].kind, 'biquad', e.id);
      assert.equal(next[0].type, 'lowpass', e.id);
      assert.ok(next[0].frequency.value <= PSY_LEVEL.rawCeiling, e.id);
      assert.equal(next[0].frequency.events.length, 0, `${e.id}: the ceiling filter does not move`);
      raws++;
    }
  }
  assert.ok(raws >= 10, `the rule was exercised (${raws} raw oscillators)`);
});

test('after any shaper, every path to the output passes a lowpass at or below 9 kHz', () => {
  for (const e of RADIAL_PSY) {
    const { made, dest } = build(e);
    const shapers = made.filter((n) => n.kind === 'shaper');
    assert.ok(shapers.length >= 1, `${e.id} is driven`);
    for (const sh of shapers) {
      // walk forward from the shaper without passing a qualifying lowpass; the destination must be unreachable
      const seen = new Set([sh]);
      const q = [sh];
      while (q.length) {
        for (const n of q.shift().out) {
          if (!(n instanceof Node) || seen.has(n)) continue;
          if (n.kind === 'biquad' && n.type === 'lowpass' && n.frequency.value <= PSY_LEVEL.finalLowpassMax) continue;
          assert.notEqual(n, dest, `${e.id}: a shaper reaches the output without a lowpass`);
          seen.add(n); q.push(n);
        }
      }
    }
  }
});

test('feedback loops stay stable: every looped delay is at least 3 ms and its loop gain under 0.9', () => {
  let loops = 0;
  for (const e of RADIAL_PSY) {
    const { made } = build(e);
    for (const d of made.filter((n) => n.kind === 'delay')) {
      if (![...d.out].some((n) => n instanceof Node && reach(n).has(d))) continue;
      loops++;
      const times = [d.delayTime.value, ...d.delayTime.events.map((x) => x[1])];
      assert.ok(Math.min(...times) >= 0.003, `${e.id}: looped delay ${Math.min(...times)} s`);
      const gains = made.filter((n) => n.kind === 'gain' && reach(n).has(d) && reach(d).has(n));
      for (const g of gains) assert.ok(g.gain.value < 0.9, `${e.id}: loop gain ${g.gain.value}`);
    }
  }
  assert.equal(loops, 3, 'three sounds carry a feedback loop');
});

test('the same seed builds the same graph, a different seed a slightly different one, and nothing reads Math.random', () => {
  const real = Math.random;
  Math.random = () => { throw new Error('Math.random called'); };
  try {
    for (const e of RADIAL_PSY) {
      const a = events(build(e, { seed: 7 }).made);
      const b = events(build(e, { seed: 7 }).made);
      const c = events(build(e, { seed: 8 }).made);
      assert.deepEqual(a, b, `${e.id} same seed`);
      assert.notDeepEqual(a, c, `${e.id} another seed varies`);
    }
  } finally {
    Math.random = real;
  }
});

test('strength scales the output envelope, clamped to 0.15 .. 1', () => {
  const peak = (e, strength) => {
    const { made, dest } = build(e, { strength });
    // the output envelope is the gain that feeds the sound's panner
    const env = made.filter((n) => n.kind === 'gain' && isEnvelope(n) && [...n.out].some((o) => o.kind === 'panner'));
    assert.equal(env.length, 1, `${e.id} one output envelope`);
    return Math.max(...env.map((g) => Math.max(...g.gain.events.map((x) => x[1]))));
  };
  for (const e of RADIAL_PSY) {
    const one = peak(e, 1);
    assert.ok(Math.abs(peak(e, 0.5) - one * 0.5) < 1e-9, `${e.id} half`);
    assert.ok(Math.abs(peak(e, 0) - one * 0.15) < 1e-9, `${e.id} floor`);
    assert.ok(Math.abs(peak(e, 3) - one) < 1e-9, `${e.id} ceiling`);
    assert.ok(Math.abs(peak(e, NaN) - one) < 1e-9, `${e.id} a bad strength plays at full`);
  }
});

test('psyRng is seeded and stays in [0, 1)', () => {
  const a = psyRng(5); const b = psyRng(5);
  const xs = Array.from({ length: 200 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 200 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(xs.slice(0, 5), Array.from({ length: 5 }, psyRng(6)));
});
