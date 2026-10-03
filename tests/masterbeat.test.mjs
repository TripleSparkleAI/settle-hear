// THE MASTER BEAT, heard: the audio clock mapped onto the page's one grid; bars, the binaural pair and the pulse
// trains start on master ticks and stay on its phase.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MASTER_GRID, masterGrid, nextLine, audioOffsetMs, toAudioTime, toMasterTime, masterStartTime, nextMasterBar,
  snapToTick, quantizeBar, lockGlide, beatPhaseError,
} from '../src/masterbeat.js';
import { makeBinaural } from '../src/instruments.js';
import { THEMES } from '../src/themes.js';

// a context whose audio clock sits OFFSET ms behind master time, with getOutputTimestamp
function ctxAt(t, offset = 12345.6) {
  const made = [];
  const param = (v) => ({ value: v, events: [], cancelScheduledValues() {}, setValueAtTime(x, at) { this.events.push(['set', x, at]); }, linearRampToValueAtTime(x, at) { this.events.push(['lin', x, at]); }, setTargetAtTime(x, at) { this.events.push(['target', x, at]); } });
  const node = (kind, extra = {}) => { const n = { kind, out: [], connect(o) { n.out.push(o); return o; }, disconnect() {}, ...extra }; made.push(n); return n; };
  return {
    made,
    currentTime: t,
    getOutputTimestamp() { return { contextTime: this.currentTime, performanceTime: this.currentTime * 1000 + offset }; },
    createChannelMerger: () => node('merger'),
    createGain: () => node('gain', { gain: param(1) }),
    createOscillator: () => node('osc', { type: 'sine', frequency: param(440), start(at) { this.startedAt = at; }, stop() {} }),
  };
}

test('the grid: origin 0, a 500 ms tick, a 2 s bar, 40 Hz; settle-see\'s published numbers win when present', () => {
  const saved = globalThis.__settleMasterBeat;
  delete globalThis.__settleMasterBeat;
  try {
    assert.deepEqual(masterGrid(), MASTER_GRID);
    globalThis.__settleMasterBeat = { origin: 7, tickMs: 500, bpm: 120, beatsPerBar: 4, barMs: 2000, flashHz: 40 };
    assert.equal(masterGrid().origin, 7);
    assert.equal(nextLine(1000), 1007);
    assert.equal(nextLine(1007), 1007, 'a line at or after');
  } finally {
    if (saved) globalThis.__settleMasterBeat = saved; else delete globalThis.__settleMasterBeat;
  }
});

test('the audio clock maps onto master time through getOutputTimestamp, both ways', () => {
  const ctx = ctxAt(3.25);
  assert.ok(Math.abs(audioOffsetMs(ctx) - 12345.6) < 1e-9);
  assert.ok(Math.abs(toMasterTime(ctx, 3.25) - (3250 + 12345.6)) < 1e-9);
  assert.ok(Math.abs(toAudioTime(ctx, toMasterTime(ctx, 9.5)) - 9.5) < 1e-9);
});

test('masterStartTime lands on a master tick, ahead of now', () => {
  for (const t of [0, 0.01, 1.234, 77.7]) {
    const ctx = ctxAt(t);
    const s = masterStartTime(ctx);
    assert.ok(s >= t + 0.04 - 1e-9);
    const ms = toMasterTime(ctx, s);
    assert.ok(Math.abs(ms / 500 - Math.round(ms / 500)) < 1e-6, `on a tick: ${ms}`);
    assert.ok(s - t < 0.55, 'within one tick plus the lead');
  }
});

test('bars: a whole number of ticks, the house 118-126 bpm becomes exactly 120, and a snapped bar sits on a tick', () => {
  for (const bpm of [118, 120, 123, 126]) assert.deepEqual(quantizeBar(4, bpm), { ticks: 4, barSeconds: 2, beatDur: 0.5, bpm: 120 });
  assert.equal(quantizeBar(4, 84).barSeconds, 3);
  assert.equal(quantizeBar(4, 48).barSeconds, 5);
  assert.equal(quantizeBar(3, 132).ticks, 3);
  for (const th of THEMES) for (const bpm of th.bpm) {
    const q = quantizeBar(th.meter ?? 4, bpm);
    assert.ok(Number.isInteger(q.ticks) && q.ticks >= 1);
    assert.ok(Math.abs(q.bpm - bpm) / bpm < 0.25, `${th.key} ${bpm} -> ${q.bpm}`);
  }
  const ctx = ctxAt(10);
  const b = snapToTick(ctx, 12.37);
  const ms = toMasterTime(ctx, b);
  assert.ok(Math.abs(ms / 500 - Math.round(ms / 500)) < 1e-6);
  const nb = nextMasterBar(ctx, 10, 2000);
  assert.ok(Math.abs(toMasterTime(ctx, nb) / 2000 - Math.round(toMasterTime(ctx, nb) / 2000)) < 1e-6);
});

// integrate a beat glide numerically: phase gained over [t0, t0 + g] while the beat goes linearly from b0 to b1
function gained(b0, b1, g, n = 20000) {
  let p = 0;
  for (let i = 0; i < n; i++) p += (b0 + (b1 - b0) * ((i + 0.5) / n)) * (g / n);
  return p;
}

test('every beat change between the themes\' beats, from any tick, glides back onto the master phase', () => {
  const beats = [...new Set(THEMES.flatMap((t) => t.beats))];
  let checked = 0;
  for (const b0 of beats) for (const b1 of beats) for (const start of [0, 0.5, 1, 2.5, 7]) {
    // the pair was on b0's master phase at the start tick (a whole-number beat is on it at every whole second;
    // at a half second b0 x 0.5 must be whole, so only start there when it is)
    if (beatPhaseError(b0, start) !== 0) continue;
    const { seconds, error } = lockGlide(b0, b1, start, 4);
    assert.equal(error, 0, `${b0} -> ${b1} from ${start}`);
    const phase = b0 * start + gained(b0, b1, seconds);
    const want = b1 * (start + seconds);
    const miss = phase - want - Math.round(phase - want);
    assert.ok(Math.abs(miss) < 1e-3, `${b0} -> ${b1} from ${start}: miss ${miss}`);
    assert.ok(seconds >= 2.5 && seconds <= 5.5);
    checked++;
  }
  assert.ok(checked > 100, `${checked} glides`);
});

test('negative control: 7.83 Hz is off the lattice, and a fixed 4 s glide from a half second misses', () => {
  assert.notEqual(beatPhaseError(7.83, 2), 0);
  const fixed = 10 * 0.5 + gained(10, 5, 4) - 5 * 4.5;
  assert.ok(Math.abs(fixed - Math.round(fixed)) > 0.1, 'without lockGlide the pair lands half a cycle off');
});

test('the binaural pair starts both ears on one master tick and glides only when the pair changes', () => {
  const ctx = ctxAt(5.01);
  const B = makeBinaural(ctx, { connect() {} });
  const oscs = ctx.made.filter((n) => n.kind === 'osc');
  assert.equal(oscs.length, 2);
  assert.equal(oscs[0].startedAt, oscs[1].startedAt, 'one start for both ears');
  const ms = toMasterTime(ctx, oscs[0].startedAt);
  assert.ok(Math.abs(ms / 500 - Math.round(ms / 500)) < 1e-6, 'on a master tick');
  // the same pair again: nothing is scheduled, so the phase cannot move
  B.set(216, 256, B.start + 2, 4);
  assert.equal(oscs[0].frequency.events.length, 0);
  // a new beat: both ears ramp linearly over one length that lockGlide chose
  const bar = snapToTick(ctx, B.start + 2);
  B.set(200, 210, bar, 4);
  const [l, r] = oscs.map((o) => o.frequency.events);
  assert.equal(l[1][0], 'lin');
  assert.equal(r[1][0], 'lin');
  assert.equal(l[1][2], r[1][2], 'both ears end together');
  const seconds = l[1][2] - bar;
  const sMaster = toMasterTime(ctx, bar) / 1000;
  assert.ok(Math.abs(lockGlide(40, 10, sMaster, 4).seconds - seconds) < 1e-6);
});

// ── the landed modes (BINAURALMODES) and click noises (GLOBALSETTLE) on the master beat ──
import { readFileSync } from 'node:fs';
import { BINAURAL_MODES } from '../src/modes.js';

test('every mode\'s beat crosses phase zero on every master second, except SCHUMANN 7.83, which is named', () => {
  const off = BINAURAL_MODES.filter((m) => beatPhaseError(m.beat, 1) !== 0).map((m) => m.key);
  assert.deepEqual(off, ['schumann']);
  assert.ok(BINAURAL_MODES.some((m) => m.beat === 40));
});

test('the gamma layers (modes included) and the click noises start on the master grid', () => {
  const bin = readFileSync(new URL('../src/binaural.js', import.meta.url), 'utf8');
  const layer = bin.slice(bin.indexOf('function buildLayer'), bin.indexOf('function freeLayer'));
  assert.match(layer, /const t = masterStartTime\(ctx\);/);
  assert.doesNotMatch(layer, /const t = ctx\.currentTime;/, 'no layer starts off the grid');
  const clicks = readFileSync(new URL('../src/clicks.js', import.meta.url), 'utf8');
  assert.match(clicks, /masterStartTime\(ctx, \{ lead: 0\.005, periodMs: 1000 \/ masterGrid\(\)\.flashHz \}\)/);
  // a click lands within one 25 ms cycle of now, on a flash line
  const ctx = ctxAt(4.003);
  const t = masterStartTime(ctx, { lead: 0.005, periodMs: 25 });
  assert.ok(t - 4.003 <= 0.005 + 0.025 + 1e-9);
  const ms = toMasterTime(ctx, t);
  assert.ok(Math.abs(ms / 25 - Math.round(ms / 25)) < 1e-6);
});
