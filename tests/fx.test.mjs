// THE MIX FX (lane SETTLEDJ): the transition moves, the inserts and the beds the mix planner triggers. Every effect
// carries the contract; every move plays on the fake clock with finite values, stops what it starts and gives the bus
// back as it found it; the riser and the reverse cymbal peak on the line; the roll gets denser; the silence holds;
// the inserts pass sound; the hum, the pad and the field textures stay under their caps and pulse only through a
// gain parameter, never as a tone below 40 Hz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, Node, Param, writes, reach } from './fakeaudio.mjs';
import { FX, FX_KEYS, fxOf } from '../src/fx-index.js';
import { keyLift } from '../src/fx-key-lift.js';
import { HUM_MAX_LEVEL, HUM_RATES, HUM_VARIANTS, HUM_PULSE_HZ, humRate } from '../src/fx-hum.js';
import { PAD_MAX_LEVEL } from '../src/fx-pad-evolve.js';
import { FIELD_MAX_LEVEL, FIELD_VARIANTS } from '../src/fx-field.js';
import { rollTimes } from '../src/fx-snare-roll.js';

const BEAT = 0.5;
const T0 = 10;
const LEVEL0 = 0.8;
const FREQ0 = 12000;

function makeBus(ctx) {
  const input = ctx.createGain();
  const level = ctx.createGain();
  level.gain.value = LEVEL0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = FREQ0;
  const out = ctx.createGain();
  input.connect(filter);
  filter.connect(level);
  level.connect(out);
  return { input, level, filter, out };
}

// the value an automated param holds at time t (set, linear and exponential events, written in time order)
function valueAt(events, t, v0) {
  let v = v0;
  let tv = -Infinity;
  for (const [type, val, time] of events) {
    if (time > t) {
      if (type === 'lin') return v + ((val - v) * (t - tv)) / (time - tv);
      if (type === 'exp') return v * Math.pow(val / v, (t - tv) / (time - tv));
      return v;
    }
    v = val;
    tv = time;
  }
  return v;
}

const moves = FX.filter((f) => f.kind === 'move');
const inserts = FX.filter((f) => f.kind === 'insert');
const beds = FX.filter((f) => f.kind === 'bed');
const defaults = (f) => Object.fromEntries(Object.entries(f.params).map(([k, [v]]) => [k, v]));
const sourcesOf = (nodes) => nodes.filter((n) => n.kind === 'osc' || n.kind === 'src');
const paramOwner = (nodes, p) => nodes.find((n) => n.gain === p || n.frequency === p || n.detune === p || n.delayTime === p || n.Q === p);
const isAudioOsc = (o, output) => reach(o).has(output);

test('every effect carries the contract: label in capitals, a plain line, a famous use, a cost, params with ranges', () => {
  assert.equal(FX.length, 13);
  assert.equal(new Set(FX_KEYS).size, 13);
  for (const f of FX) {
    assert.match(f.key, /^[a-z-]+$/);
    assert.ok(f.label && f.label === f.label.toUpperCase(), f.key);
    assert.ok(['transition', 'space', 'rhythm', 'hum'].includes(f.family), `${f.key}: family ${f.family}`);
    assert.ok(['move', 'insert', 'bed'].includes(f.kind), f.key);
    assert.ok(typeof f.line === 'string' && f.line.length > 30, `${f.key}: line`);
    assert.doesNotMatch(f.line, /[–—]/, `${f.key}: no em or en dash in the line`);
    assert.ok(typeof f.famous === 'string' && f.famous.length > 10, `${f.key}: famous`);
    assert.doesNotMatch(f.famous, /[–—]/, `${f.key}: no em or en dash in famous`);
    assert.ok(Number.isInteger(f.cost) && f.cost >= 1 && f.cost <= 16, `${f.key}: cost`);
    assert.ok(Object.keys(f.params).length >= 1, f.key);
    for (const [n, v] of Object.entries(f.params)) {
      assert.ok(Array.isArray(v) && v.length === 4, `${f.key}.${n}: [default, meaning, min, max]`);
      const [d, meaning, lo, hi] = v;
      assert.equal(typeof meaning, 'string', `${f.key}.${n}`);
      assert.ok([d, lo, hi].every(Number.isFinite), `${f.key}.${n}: finite numbers`);
      assert.ok(lo <= d && d <= hi, `${f.key}.${n}: ${lo} <= ${d} <= ${hi}`);
    }
    const fn = { move: 'play', insert: 'build', bed: 'start' }[f.kind];
    assert.equal(typeof f[fn], 'function', `${f.key}: ${fn}()`);
    assert.equal(fxOf(f.key), f);
  }
  assert.equal(fxOf('nope'), undefined);
});

test('every move plays with finite values, stops every source it starts, and gives bus level and filter back by until', () => {
  for (const f of moves) {
    for (const bars of [1, 2]) {
      const ctx = new Ctx();
      const bus = makeBus(ctx);
      writes.length = 0;
      const r = f.play(ctx, bus, T0, { beatDur: BEAT, bars, root: 57, ...defaults(f), bars_: bars });
      assert.ok(writes.every(Number.isFinite), `${f.key}: a non-finite write`);
      assert.ok(Array.isArray(r.nodes), `${f.key}: nodes`);
      assert.ok(Number.isFinite(r.until) && r.until >= T0, `${f.key}: until ${r.until}`);
      for (const s of sourcesOf(r.nodes)) {
        assert.ok(s.started, `${f.key}: a source never started`);
        assert.ok(s.stopped, `${f.key}: a source left running`);
      }
      const lv = valueAt(bus.level.gain.events, r.until, LEVEL0);
      const fv = valueAt(bus.filter.frequency.events, r.until, FREQ0);
      assert.ok(Math.abs(lv - LEVEL0) < 1e-9, `${f.key}: bus level ${lv} at until`);
      assert.ok(Math.abs(fv - FREQ0) < 1e-6, `${f.key}: bus filter ${fv} at until`);
    }
  }
  for (const k of ['riser', 'downlifter', 'reverse-cymbal', 'snare-roll', 'key-lift']) {
    const r = fxOf(k).play(new Ctx(), makeBus(new Ctx()), T0, { beatDur: BEAT });
    assert.ok(r.nodes.length >= 2, `${k}: makes its own sound`);
  }
});

test('the riser and the reverse cymbal peak on the line: the loudest and the last level events sit at the downbeat', () => {
  for (const [k, bars] of [['riser', 2], ['riser', 4], ['reverse-cymbal', 1], ['reverse-cymbal', 2]]) {
    const ctx = new Ctx();
    const r = fxOf(k).play(ctx, makeBus(ctx), T0, { beatDur: BEAT, bars });
    const line = T0 + bars * 4 * BEAT;
    const env = r.nodes.filter((n) => n.kind === 'gain').at(-1);
    const ev = env.gain.events;
    const top = ev.reduce((a, e) => (e[1] > a[1] ? e : a));
    assert.ok(Math.abs(top[2] - line) < 0.005, `${k} x${bars}: the peak at ${top[2]}, the line at ${line}`);
    assert.ok(Math.abs(ev.at(-1)[2] - line) < 0.01, `${k} x${bars}: the last level event at ${ev.at(-1)[2]}`);
    assert.ok(valueAt(ev, T0 + 0.5 * bars * 4 * BEAT, 0) < top[1] / 2, `${k}: half way it is under half the peak`);
  }
});

test('the snare roll gets denser through the span: more hits in the last beat than in the first', () => {
  for (const bars of [1, 2, 4]) {
    const ctx = new Ctx();
    const r = fxOf('snare-roll').play(ctx, makeBus(ctx), T0, { beatDur: BEAT, bars });
    const line = T0 + bars * 4 * BEAT;
    // count the hits from the scheduled noise envelopes, not from the returned list
    const starts = r.nodes.filter((n) => n.kind === 'gain' && n.gain.events.length).map((n) => n.gain.events[0][2]);
    const first = starts.filter((t) => t >= T0 && t < T0 + BEAT).length;
    const last = starts.filter((t) => t >= line - BEAT && t < line).length;
    assert.ok(last > first, `bars ${bars}: ${first} in the first beat, ${last} in the last`);
    assert.ok(starts.every((t) => t < line), 'every hit before the line');
    // the level climbs: the last hit is louder than the first
    const peaks = r.nodes.filter((n) => n.kind === 'gain').map((n) => Math.max(...n.gain.events.map((e) => e[1])));
    assert.ok(peaks.at(-2) > peaks[0], 'the roll gets louder');
  }
  assert.deepEqual(rollTimes(0, 4, 1).length, 2 + 2 + 4 + 8);
});

test('the one-bar silence holds the bus at 0 from t0 + 10 ms to the line and returns at the line', () => {
  const ctx = new Ctx();
  const bus = makeBus(ctx);
  const r = fxOf('one-bar-silence').play(ctx, bus, T0, { beatDur: BEAT });
  const line = T0 + 4 * BEAT;
  assert.equal(r.until, line);
  const ev = bus.level.gain.events;
  for (let t = T0 + 0.0101; t < line; t += 0.05) assert.equal(valueAt(ev, t, LEVEL0), 0, `silent at ${t}`);
  assert.equal(valueAt(ev, line - 1e-6, LEVEL0), 0, 'silent just before the line');
  assert.equal(valueAt(ev, line, LEVEL0), LEVEL0, 'back on the line');
  assert.equal(valueAt(ev, T0, LEVEL0), LEVEL0, 'full at t0');
});

test('the filter drop closes the bus low-pass over the bar and snaps open on the line; the bus tape stop fades the last beat', () => {
  const ctx = new Ctx();
  const bus = makeBus(ctx);
  fxOf('filter-drop').play(ctx, bus, T0, { beatDur: BEAT });
  const line = T0 + 4 * BEAT;
  const ev = bus.filter.frequency.events;
  assert.ok(valueAt(ev, line - 0.01, FREQ0) < 300, 'nearly closed just before the line');
  assert.equal(valueAt(ev, line, FREQ0), FREQ0, 'open on the line');
  const bus2 = makeBus(ctx);
  fxOf('tape-stop-bus').play(ctx, bus2, T0, { beatDur: BEAT });
  assert.equal(valueAt(bus2.level.gain.events, line - 1.5 * BEAT, LEVEL0), LEVEL0, 'untouched before the last beat');
  assert.ok(valueAt(bus2.level.gain.events, line - 0.005, LEVEL0) < 0.01, 'faded just before the line');
  assert.equal(valueAt(bus2.level.gain.events, line, LEVEL0), LEVEL0, 'back on the line');
});

test('the key lift is 1 or 2 semitones, and its swell glides up exactly that interval into the line', () => {
  assert.equal(keyLift(1), 1);
  assert.equal(keyLift(2), 2);
  assert.equal(keyLift(0), 1);
  assert.equal(keyLift(7), 2);
  assert.equal(keyLift(NaN), 2);
  const ctx = new Ctx();
  const r = fxOf('key-lift').play(ctx, makeBus(ctx), T0, { beatDur: BEAT, semitones: 1, root: 57 });
  assert.equal(r.lift, 1);
  const o = r.nodes.find((n) => n.kind === 'osc');
  const [a, b] = [o.frequency.events[0][1], o.frequency.events.at(-1)[1]];
  assert.ok(Math.abs(12 * Math.log2(b / a) - 1) < 1e-9, 'one semitone');
});

test('every insert passes its input to its output, and set() writes finite values that move the effect', () => {
  for (const f of inserts) {
    const ctx = new Ctx();
    writes.length = 0;
    const inst = f.build(ctx, defaults(f));
    assert.ok(inst.input instanceof Node && inst.output instanceof Node, f.key);
    assert.ok(reach(inst.input).has(inst.output), `${f.key}: input reaches output`);
    const before = writes.length;
    inst.set(0.5, 1);
    inst.set(1, 2);
    inst.bar?.(4, { beatDur: BEAT });
    assert.ok(writes.length > before, `${f.key}: set writes`);
    assert.ok(writes.every(Number.isFinite), `${f.key}: finite`);
    inst.g.dispose();
    for (const n of inst.g.nodes) assert.equal(n.out.size, 0, `${f.key}: freed`);
  }
  // the hall's wet follows set(); the dry path stays at 1
  const ctx = new Ctx();
  const h = fxOf('hall').build(ctx, {});
  h.set(1, 1);
  assert.ok(Math.abs(h.wet.gain.events.at(-1)[1] - fxOf('hall').params.wet[0]) < 1e-9);
  h.set(0, 2);
  assert.equal(h.wet.gain.events.at(-1)[1], 0);
  // the sidechain at amount 0 never ducks; at amount 1 it ducks to 1 - depth on every beat
  const s = fxOf('sidechain').build(ctx, {});
  s.set(0, 0);
  s.bar(4, { beatDur: BEAT });
  assert.ok(s.output.gain.events.every((e) => e[1] === 1), 'amount 0: no duck');
  s.set(1, 6);
  s.bar(6, { beatDur: BEAT });
  const floors = s.output.gain.events.filter((e) => e[0] === 'set' && e[1] < 1);
  assert.equal(floors.length, 4, 'four ducks a bar');
  assert.ok(Math.abs(floors[0][1] - (1 - fxOf('sidechain').params.depth[0])) < 1e-9);
});

function checkBed(f, opts, label, cap) {
  const ctx = new Ctx();
  const out = ctx.createGain();
  writes.length = 0;
  const b = f.start(ctx, out, T0, { beatDur: BEAT, root: 45, ...opts, level: 1 });
  assert.ok(writes.every(Number.isFinite), `${label}: finite`);
  assert.ok(b.peak <= cap + 1e-12, `${label}: peak ${b.peak} over ${cap}`);
  assert.ok(Math.max(...b.output.gain.events.map((e) => e[1])) <= cap + 1e-12, `${label}: master writes under the cap`);
  assert.ok(reach(b.output).has(out), `${label}: reaches out`);
  const oscs = b.nodes.filter((n) => n.kind === 'osc');
  for (const o of oscs) {
    if (isAudioOsc(o, b.output)) assert.ok(o.frequency.value >= 40, `${label}: an audio oscillator at ${o.frequency.value} Hz`);
  }
  b.stop(T0 + 30);
  assert.ok(b.peak <= cap + 1e-12, `${label}: peak after stop`);
  for (const s of sourcesOf(b.nodes)) assert.ok(s.started && s.stopped, `${label}: a source left running`);
  assert.equal(b.output.gain.events.at(-1)[1], 0, `${label}: faded to 0`);
  return b;
}

test('the neutral hum: every variant stays under HUM_MAX_LEVEL even when asked for 1, and stop() stops every source', () => {
  assert.equal(HUM_MAX_LEVEL, 0.05);
  assert.equal(HUM_PULSE_HZ, 10);
  for (const variant of HUM_VARIANTS) checkBed(fxOf('neutral-hum'), { variant, motif: [69, 72, 76, 74, 81] }, `hum ${variant}`, HUM_MAX_LEVEL);
});

test('the hum pulses at 10 Hz by default through a gain PARAMETER, and every audio oscillator is at 40 Hz or above', () => {
  const ctx = new Ctx();
  const b = fxOf('neutral-hum').start(ctx, ctx.createGain(), T0, { variant: 'pulse', root: 45 });
  const ten = b.nodes.filter((n) => n.kind === 'osc' && n.frequency.value === 10);
  assert.equal(ten.length, 1, 'one 10 Hz oscillator');
  assert.ok(!isAudioOsc(ten[0], b.output), 'the 10 Hz oscillator never reaches the output as sound');
  const params = [...reach(ten[0])].flatMap((n) => [...n.out].filter((x) => x instanceof Param));
  assert.ok(params.some((p) => paramOwner(b.nodes, p)?.gain === p), 'it drives a gain parameter');
  const audio = b.nodes.filter((n) => n.kind === 'osc' && isAudioOsc(n, b.output));
  assert.ok(audio.length >= 2, 'a warm tone');
  for (const o of audio) assert.ok(o.frequency.value >= 40 && o.frequency.value <= 110, `audio at ${o.frequency.value}`);
});

test('the hum rates: each named rate is the pulse oscillator on a gain parameter; numbers clamp to 1 .. 45', () => {
  assert.deepEqual(HUM_RATES, { delta: 3, theta: 6, schumann: 7.83, alpha: 10, beta: 14, gamma: 40 });
  for (const [name, hz] of Object.entries(HUM_RATES)) {
    const ctx = new Ctx();
    const b = fxOf('neutral-hum').start(ctx, ctx.createGain(), T0, { variant: 'pulse', rate: name });
    assert.equal(b.pulse.frequency.value, hz, name);
    assert.ok(!isAudioOsc(b.pulse, b.output), `${name}: not on the audio path`);
    const params = [...reach(b.pulse)].flatMap((n) => [...n.out].filter((x) => x instanceof Param));
    assert.ok(params.some((p) => paramOwner(b.nodes, p)?.gain === p), `${name}: drives a gain parameter`);
  }
  assert.equal(humRate(0.2), 1);
  assert.equal(humRate(99), 45);
  assert.equal(humRate('nope'), HUM_PULSE_HZ);
  assert.equal(humRate(undefined), HUM_PULSE_HZ);
  assert.equal(humRate(4.5), 4.5);
});

test('the hum pair: left and right differ by exactly the rate, on a carrier in 100 .. 250 Hz, under the cap', () => {
  for (const [name, hz] of Object.entries(HUM_RATES)) {
    for (const root of [33, 45, 57, 69, 81]) {
      const ctx = new Ctx();
      const b = fxOf('neutral-hum').start(ctx, ctx.createGain(), T0, { variant: 'pair', rate: name, root, level: 1 });
      const audio = b.nodes.filter((n) => n.kind === 'osc' && isAudioOsc(n, b.output)).map((o) => o.frequency.value).sort((x, y) => x - y);
      assert.equal(audio.length, 2, `${name}: two tones`);
      assert.ok(Math.abs(audio[1] - audio[0] - hz) < 1e-9, `${name}: ${audio[1]} - ${audio[0]} = ${hz}`);
      assert.ok(audio[0] >= 100 && audio[0] <= 250, `${name} root ${root}: carrier ${audio[0]}`);
      assert.ok(b.peak <= HUM_MAX_LEVEL);
    }
  }
});

test('the evolving pad and the field textures stay under their caps, keep every audio oscillator at 40 Hz or above, and stop', () => {
  assert.equal(PAD_MAX_LEVEL, 0.06);
  const pad = checkBed(fxOf('evolving-pad'), { root: 45 }, 'pad', PAD_MAX_LEVEL);
  assert.ok(pad.notes.length >= 3 && pad.notes.length <= 4, 'three or four voices');
  checkBed(fxOf('evolving-pad'), { chord: [57, 60, 64] }, 'pad triad', PAD_MAX_LEVEL);
  for (const variant of FIELD_VARIANTS) {
    const b = checkBed(fxOf('field-texture'), { variant, seed: 3 }, `field ${variant}`, FIELD_MAX_LEVEL);
    if (variant !== 'wind') assert.ok(b.events.length > 5, `${variant}: events scheduled`);
  }
  // the field's events repeat for a seed
  const a = fxOf('field-texture').start(new Ctx(), new Ctx().createGain(), 0, { variant: 'birds', seed: 9 });
  const c = fxOf('field-texture').start(new Ctx(), new Ctx().createGain(), 0, { variant: 'birds', seed: 9 });
  assert.deepEqual(a.events, c.events);
});
