// THE MACHINE VOICES (lane SETTLEDJ): the 808 and 909 kits, the ten house families, the acid line and the chopper.
// Every hit writes finite values and stops what it starts; the patterns keep their shape; swing delays the odd steps;
// energy thins the bar; the acid line is deterministic and in the scale, slides ramp and accents peak higher; the
// phrase buffer has the right length and the chopper starts one slice per step at the right time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, all, writes } from './fakeaudio.mjs';
import { DRUM_KITS, DRUM_FAMILIES, DRUM_PATTERNS, playPattern } from '../src/voice-drum-machines.js';
import { acidLine, playAcidBar } from '../src/voice-acid.js';
import { renderPhrase, chopBar, CHOP_PATTERNS } from '../src/voice-chop.js';
import { MODES } from '../src/tuning.js';

const BEAT = 0.5;
const STEP = BEAT / 4;
const T0 = 10;
const since = (mark) => all.slice(mark);
const sources = (nodes) => nodes.filter((n) => n.kind === 'osc' || n.kind === 'src');

test('every kit hit writes only finite values and stops every source it started', () => {
  for (const [name, kit] of Object.entries(DRUM_KITS)) {
    for (const voice of ['kick', 'snare', 'clap', 'closedHat', 'openHat', 'rim', 'cowbell', 'ride']) {
      const ctx = new Ctx();
      const mark = all.length;
      const w0 = writes.length;
      kit[voice](ctx, ctx.destination, T0, { level: 0.8, tune: 3 });
      const srcs = sources(since(mark));
      assert.ok(srcs.length > 0, `${name} ${voice} starts a source`);
      for (const s of srcs) {
        assert.ok(s.started && s.stopped, `${name} ${voice}: started and stopped`);
        assert.equal(typeof s.onended, 'function', `${name} ${voice}: frees itself`);
      }
      assert.ok(writes.slice(w0).every(Number.isFinite), `${name} ${voice}: finite writes`);
    }
  }
});

test('the families: ten in order, 16 steps each, bpm inside 110..135, swing inside 0..0.3', () => {
  assert.deepEqual(DRUM_FAMILIES, Object.keys(DRUM_PATTERNS));
  assert.equal(DRUM_FAMILIES.length, 10);
  for (const f of DRUM_FAMILIES) {
    const p = DRUM_PATTERNS[f];
    assert.ok(p.kit in DRUM_KITS, `${f} kit`);
    assert.ok(p.bpm[0] >= 110 && p.bpm[1] <= 135 && p.bpm[0] <= p.bpm[1], `${f} bpm`);
    assert.ok(p.swing >= 0 && p.swing <= 0.3, `${f} swing`);
    for (const [v, list] of Object.entries(p.steps)) {
      assert.ok(v in DRUM_KITS[p.kit], `${f} ${v} is a kit voice`);
      assert.equal(list.length, 16, `${f} ${v} has 16 steps`);
      assert.ok(list.every((x) => x >= 0 && x <= 1), `${f} ${v} levels`);
    }
  }
});

test('chicago is four-on-the-floor; garage is not', () => {
  const on = (list) => list.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(on(DRUM_PATTERNS.chicago.steps.kick), [0, 4, 8, 12]);
  assert.deepEqual(on(DRUM_PATTERNS.chicago.steps.clap), [4, 12]);
  assert.notDeepEqual(on(DRUM_PATTERNS.garage.steps.kick), [0, 4, 8, 12]);
  assert.ok(DRUM_PATTERNS.garage.swing >= 0.2);
});

test('playPattern at energy 0.1 schedules fewer hits than at 1', () => {
  const ctx = new Ctx();
  const lo = playPattern(ctx, ctx.destination, T0, BEAT, DRUM_PATTERNS.chicago, { energy: 0.1 });
  const hi = playPattern(ctx, ctx.destination, T0, BEAT, DRUM_PATTERNS.chicago, { energy: 1 });
  assert.ok(lo > 0 && lo < hi, `${lo} < ${hi}`);
});

test('swing delays an odd step and leaves an even one on the grid', () => {
  const ctx = new Ctx();
  const kickAt = (i) => {
    const steps = { kick: Array(16).fill(0) };
    steps.kick[i] = 1;
    const mark = all.length;
    playPattern(ctx, ctx.destination, T0, BEAT, { kit: '808', bpm: [120, 124], swing: 0.25, steps });
    const osc = since(mark).find((n) => n.kind === 'osc');
    return osc.frequency.events.find((e) => e[0] === 'set')[2];
  };
  assert.ok(kickAt(5) > T0 + 5 * STEP + 1e-9);
  assert.ok(Math.abs(kickAt(5) - (T0 + 5 * STEP + 0.25 * STEP)) < 1e-9);
  assert.ok(Math.abs(kickAt(4) - (T0 + 4 * STEP)) < 1e-9);
});

test('acidLine is deterministic for a seed and every pitch is in the scale', () => {
  assert.deepEqual(acidLine(7, 57), acidLine(7, 57));
  assert.notDeepEqual(acidLine(7, 57), acidLine(8, 57));
  const steps = MODES['minor pentatonic'];
  for (const seed of [1, 2, 3, 7, 8, 99]) {
    const line = acidLine(seed, 57);
    assert.equal(line.length, 16);
    for (let i = 0; i < 16; i++) {
      const n = line[i];
      if (n.midi == null) { assert.equal(n.slide, false); continue; }
      const off = n.midi - 57;
      assert.ok(off >= 0 && off < 24 && steps.includes(off % 12), `seed ${seed} step ${i} midi ${n.midi}`);
      if (n.slide) assert.ok(i < 15 && line[i + 1].midi != null, 'a slide never leads into a rest');
    }
  }
});

test('a slide ramps the oscillator frequency; an accent peaks the gain higher', () => {
  const ctx = new Ctx();
  const rest = { midi: null, accent: false, slide: false };
  const notes = Array.from({ length: 16 }, () => ({ ...rest }));
  notes[0] = { midi: 45, accent: false, slide: true };
  notes[1] = { midi: 52, accent: false, slide: false };
  notes[8] = { midi: 45, accent: true, slide: false };
  const mark = all.length;
  const w0 = writes.length;
  const n = playAcidBar(ctx, ctx.destination, T0, BEAT, { notes });
  assert.equal(n, 3);
  const nodes = since(mark);
  const osc = nodes.find((x) => x.kind === 'osc');
  assert.ok(osc.started && osc.stopped);
  assert.ok(osc.frequency.events.some((e) => e[0] === 'lin'), 'a slide writes a linear ramp');
  const gain = nodes.find((x) => x.kind === 'gain');
  const peakAt = (t) => gain.gain.events.find((e) => e[0] === 'lin' && e[1] > 0 && Math.abs(e[2] - (t + 0.004)) < 1e-9)[1];
  assert.ok(peakAt(T0 + 8 * STEP) > peakAt(T0), 'accent louder');
  const filt = nodes.find((x) => x.kind === 'biquad');
  assert.ok(filt.frequency.events.every((e) => e[1] <= 18000));
  assert.ok(writes.slice(w0).every(Number.isFinite));
});

test('renderPhrase has the length of its beats', () => {
  const ctx = new Ctx();
  const notes = [{ midi: 69, beats: 1 }, { midi: null, beats: 0.5 }, { midi: 72, beats: 1.5 }];
  const b = renderPhrase(ctx, notes, BEAT);
  assert.equal(b.length, Math.round(3 * BEAT * ctx.sampleRate));
  const d = b.getChannelData(0);
  assert.ok(d.every(Number.isFinite));
  assert.equal(d[0], 0);
  assert.ok(d.some((x) => Math.abs(x) > 0.1));
});

test('chopBar starts one source per non-null step at its time and slice', () => {
  const ctx = new Ctx();
  const buffer = renderPhrase(ctx, [{ midi: 69, beats: 4 }], BEAT);
  const dur = buffer.length / buffer.sampleRate;
  const starts = [];
  const make = ctx.createBufferSource.bind(ctx);
  ctx.createBufferSource = () => {
    const s = make();
    const st = s.start;
    s.start = (...a) => { starts.push(a); st(...a); };
    return s;
  };
  const pattern = CHOP_PATTERNS.skip;
  const n = chopBar(ctx, ctx.destination, T0, BEAT, { buffer, pattern });
  const steps = pattern.map((s, i) => [s, i]).filter(([s]) => s != null);
  assert.equal(n, steps.length);
  assert.equal(starts.length, steps.length);
  steps.forEach(([s, i], k) => {
    assert.ok(Math.abs(starts[k][0] - (T0 + i * STEP)) < 1e-9, `step ${i} time`);
    assert.ok(Math.abs(starts[k][1] - (s * dur) / 8) < 1e-9, `step ${i} offset`);
    assert.ok(Math.abs(starts[k][2] - STEP) < 1e-9, `step ${i} duration`);
  });
});
