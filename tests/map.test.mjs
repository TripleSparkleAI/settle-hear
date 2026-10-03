// The physics-to-sound mapping: clamped, NaN-free, and monotone where the README says it is.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  heat, flipFraction, crackleRate, settledness, dronePitch, consonance, chordRatios, brightness,
  pulseCount, pulsePitch, sparkleRate, heldLevel, soundParams, clamp01,
} from '../src/map.js';

const BAD = [NaN, Infinity, -Infinity, undefined, null, 'x', {}];
const grid = (a, b, n = 60) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
const nondecreasing = (xs) => xs.every((x, i) => i === 0 || x >= xs[i - 1] - 1e-12);
const nonincreasing = (xs) => xs.every((x, i) => i === 0 || x <= xs[i - 1] + 1e-12);
const finite = (x) => typeof x === 'number' && Number.isFinite(x);

test('heat rises with temperature, 0 at the schedule cold end, 1 at the hot end, clamped', () => {
  const ys = grid(0.05, 6).map((T) => heat(T));
  assert.ok(nondecreasing(ys));
  assert.equal(heat(0.45), 0);
  assert.equal(heat(3.0), 1);
  assert.ok(ys.every((y) => y >= 0 && y <= 1));
  for (const b of BAD) assert.ok(finite(heat(b)) && heat(b) >= 0 && heat(b) <= 1, `heat(${b})`);
  assert.equal(heat(-1), 0);
});

test('crackle density rises with the flip share and is capped', () => {
  const ys = grid(0, 1).map((f) => crackleRate(f, 60));
  assert.ok(nondecreasing(ys));
  assert.equal(crackleRate(0, 60), 0);
  assert.equal(crackleRate(0.5, 60), 60);
  assert.equal(crackleRate(1, 60), 60);
  assert.equal(flipFraction(50, 100), 0.5);
  assert.equal(flipFraction(5, 0), 0);
  for (const b of BAD) assert.ok(finite(crackleRate(b)) && finite(flipFraction(b, b)));
});

test('settledness rises as the energy per light falls toward its floor', () => {
  const floor = -(0.9 + 2 * 0.3);
  const ys = grid(0.2, floor * 1.2).map((e) => settledness(e));
  assert.ok(nondecreasing(ys));
  assert.equal(settledness(0), 0);
  assert.ok(Math.abs(settledness(floor) - 1) < 1e-12);
  assert.equal(settledness(5), 0);
  for (const b of BAD) assert.ok(finite(settledness(b)));
});

test('the drone sinks as the energy falls: pitch decreases as settledness rises, one octave of span', () => {
  const ys = grid(0, 1).map((l) => dronePitch(l));
  assert.ok(nonincreasing(ys));
  assert.equal(dronePitch(1, 55, 1), 55);
  assert.equal(dronePitch(0, 55, 1), 110);
  for (const b of BAD) assert.ok(finite(dronePitch(b)));
});

test('the chord resolves as the overlap rises, from a cluster to a major chord', () => {
  const cs = grid(-1, 1).map((q) => consonance(q));
  assert.ok(nondecreasing(cs));
  assert.equal(consonance(0.1), 0);
  assert.equal(consonance(0.99), 1);
  assert.deepEqual(chordRatios(1).map((r) => +r.toFixed(9)), [1, 1.25, 1.5, 2]);
  assert.deepEqual(chordRatios(0).map((r) => +r.toFixed(9)), [1, +(17 / 16).toFixed(9), +(45 / 32).toFixed(9), 1.875]);
  for (const c of grid(0, 1)) for (const r of chordRatios(c)) assert.ok(finite(r) && r >= 1 && r <= 2);
  for (const b of BAD) assert.ok(finite(consonance(b)) && chordRatios(b).every(finite));
});

test('brightness, pulses and sparkle are monotone and bounded', () => {
  assert.ok(nondecreasing(grid(0, 1).map((h) => brightness(h))));
  assert.equal(brightness(0), 300);
  assert.equal(brightness(1), 6000);
  assert.ok(nondecreasing(grid(0, 12, 12).map((p) => pulseCount(p, 8))));
  assert.equal(pulseCount(12, 8), 8);
  assert.equal(pulseCount(-3, 8), 0);
  const ps = [0, 1, 2, 3].map((k) => pulsePitch(k, 2));
  assert.ok(ps.every((p, i) => i === 0 || p > ps[i - 1]), 'each pulse is higher than the last');
  assert.ok(pulsePitch(0, 5) > pulsePitch(0, 1), 'more power, higher pulses');
  assert.ok(nondecreasing(grid(0, 1).map((x) => sparkleRate(x))));
  assert.equal(sparkleRate(2, 30), 30);
  for (const b of BAD) assert.ok(finite(brightness(b)) && finite(pulseCount(b)) && finite(pulsePitch(b, b)) && finite(sparkleRate(b)));
});

test('the held level reads the field hold, clamped', () => {
  assert.equal(heldLevel(new Float32Array(100), 100), 0);
  assert.equal(heldLevel(new Float32Array(100).fill(1), 100), 1);
  assert.ok(heldLevel(Float32Array.from({ length: 1000 }, (_, i) => (i < 5 ? 0.8 : 0)), 1000) > 0);
  assert.equal(heldLevel(null), 0);
});

test('soundParams over a realistic cooling run: finite everywhere, heat falls, consonance rises', () => {
  const frames = grid(0, 1, 40).map((u) => {
    const T = 3 * Math.pow(0.45 / 3, u);
    return { T, flips: Math.round(400 * (1 - u) * 0.5), n: 400, ePer: -1.5 * u, q: 0.3 + 0.68 * u, phase: u < 1 ? 'cooling' : 'settled', power: 0, maxPower: 8 };
  });
  const ps = frames.map((f) => soundParams(f));
  for (const p of ps) for (const [k, v] of Object.entries(p)) {
    if (k === 'phase') continue;
    if (Array.isArray(v)) assert.ok(v.every(finite), k);
    else assert.ok(finite(v), `${k} = ${v}`);
  }
  assert.ok(nonincreasing(ps.map((p) => p.heat)));
  assert.ok(nonincreasing(ps.map((p) => p.grains)));
  assert.ok(nondecreasing(ps.map((p) => p.settled)));
  assert.ok(nondecreasing(ps.map((p) => p.consonance)));
  assert.ok(ps.at(-1).consonance > 0.9 && ps[0].heat === 1);
});

test('negative control: an empty or garbage stats frame maps to silence-ready defaults, not to noise', () => {
  for (const s of [null, undefined, {}, { T: NaN, flips: NaN, n: NaN, ePer: NaN, q: NaN, power: NaN }]) {
    const p = soundParams(s);
    assert.equal(p.grains, 0);
    assert.equal(p.consonance, 0);
    assert.equal(p.power, 0);
    assert.ok(p.heat >= 0 && p.heat <= 1);
  }
  // and a hot noisy frame is NOT treated as resolved: the mapping can tell the two apart
  const hot = soundParams({ T: 3, flips: 200, n: 400, ePer: -0.1, q: 0.28 });
  const cold = soundParams({ T: 0.45, flips: 2, n: 400, ePer: -1.45, q: 0.97 });
  assert.ok(hot.grains > cold.grains * 5 && cold.consonance > hot.consonance + 0.8);
  assert.equal(clamp01(2), 1);
});
