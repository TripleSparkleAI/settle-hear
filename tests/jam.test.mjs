// THE JAM (lane INSTRUMENTS, 2026-10-02): ten instruments a visitor can hit, in the key THE DJ plays, quantised gently
// to THE MASTER BEAT's sixteenths, and one looper that plays the hits back on the same sixteenths every loop. Every
// sound goes through one voice call (a fake voice records it here); MUTE ALL, PAUSE ALL and the hero's pause stop it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, all, reach } from './fakeaudio.mjs';
import {
  JAM_KIT, JAM_KEYS, LOOP_BARS, jamKey, jamNotes, quantiseHit, sixteenthMs, createLooper, createJam, playJamHit,
  THEMES, themeOf, noteMidi, MODES, TONE, LEVELS, sound,
} from '../src/index.js';

const GRID = Object.freeze({ origin: 0, tickMs: 500, bpm: 120, beatsPerBar: 4, barMs: 2000, flashHz: 40 });
const SIX = 125;
const pcs = (themeKey) => {
  const th = themeOf(themeKey);
  const root = noteMidi(th.root);
  return new Set(MODES[th.mode].map((s) => (root + s) % 12));
};
// a jam with a fake voice and a hand-driven clock
function rig({ theme = 'cathedral', audible = () => true, quantise = true } = {}) {
  const calls = [];
  let t = 10_000;
  const jam = createJam({ voice: (c) => { calls.push(c); return true; }, theme: () => theme, now: () => t, grid: () => GRID, seed: 7, audible });
  if (!quantise) jam.setQuantise(false);
  // the page pumps every 50 ms; walk the clock there in those steps
  const run = (ms) => { while (t < ms) { t = Math.min(ms, t + 50); jam.pump(); } };
  return { jam, calls, run, at: (ms) => { t = ms; }, get t() { return t; } };
}

test('the kit: ten instruments, one per number key 1 to 0, each named and drawn by a letter', () => {
  assert.equal(JAM_KIT.length, 10);
  assert.deepEqual(JAM_KIT.map((k) => k.digit), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
  assert.deepEqual(JAM_KEYS, JAM_KIT.map((k) => k.key));
  assert.deepEqual(JAM_KEYS, ['kick', 'clap', 'hat', 'open', 'bass', 'pluck', 'bell', 'chord', 'vox', 'settle']);
  for (const k of JAM_KIT) assert.ok(k.sound && k.letter && k.family, `${k.key} has a sound name, a letter and a family`);
  assert.deepEqual(LOOP_BARS, [1, 2, 4]);
  assert.ok(LEVELS.jam < 0 && LEVELS.jam < LEVELS.static, 'the jam has a level aim under the static');
});

test('the key: the theme THE DJ plays gives the root and the scale; no theme gives A minor pentatonic', () => {
  for (const th of THEMES) {
    const k = jamKey(th.key);
    assert.equal(k.root, noteMidi(th.root));
    assert.deepEqual(k.steps, MODES[th.mode]);
    assert.equal(k.mode, th.mode);
  }
  const none = jamKey(null);
  assert.equal(none.root % 12, 9, 'A');
  assert.equal(none.mode, 'minor pentatonic');
  assert.equal(jamKey('no-such-theme').mode, 'minor pentatonic');
});

test('every instrument triggers one real voice call with its sound name and a pitch in the current key', () => {
  for (const theme of THEMES.map((x) => x.key)) {
    const r = rig({ theme });
    const scale = pcs(theme);
    for (const key of JAM_KEYS) {
      const c = r.jam.hit(key);
      assert.ok(c, `${key} hit`);
      assert.equal(r.calls.at(-1), c, `${key}: the voice got the call`);
      assert.equal(c.key, key);
      assert.equal(c.sound, JAM_KIT.find((k) => k.key === key).sound);
      assert.ok(Number.isFinite(c.midi) && Number.isFinite(c.hz) && c.hz > 20 && c.hz < 12000, `${key}: a pitch ${c.hz}`);
      assert.ok(scale.has(((c.midi % 12) + 12) % 12), `${theme} ${key}: midi ${c.midi} is in the scale`);
      for (const m of c.notes ?? []) assert.ok(scale.has(((m % 12) + 12) % 12), `${theme} ${key}: chord note ${m} in the scale`);
      assert.ok(Math.abs(c.hz - 432 * 2 ** ((c.midi - 69) / 12)) < 1e-6, 'tuned from A = 432');
    }
    assert.equal(r.calls.length, 10);
  }
});

test('a cycling pitch deals like a deck: the pluck plays every scale note once before any repeats', () => {
  const r = rig({ theme: 'cathedral' });
  const n = jamKey('cathedral').steps.length;
  const first = Array.from({ length: n }, () => r.jam.hit('pluck').midi % 12);
  assert.equal(new Set(first).size, n, 'one round of the deck is every scale note');
  const seam = r.jam.hit('pluck').midi % 12;
  assert.notEqual(seam, first.at(-1), 'the next round never opens on the card the last round closed on');
});

test('quantised gently to the sixteenths of the master beat; never early, at most half a sixteenth late; free is free', () => {
  assert.equal(sixteenthMs(GRID), SIX);
  const late = quantiseHit(10_040, { grid: GRID });
  assert.equal(late.lineMs, 10_000);
  assert.equal(late.at, 10_040, 'a line already gone: the sound plays now, the position is the line');
  const early = quantiseHit(10_070, { grid: GRID });
  assert.equal(early.lineMs, 10_125);
  assert.equal(early.at, 10_125, 'the line ahead: the sound waits for it');
  for (let ms = 9_000; ms < 11_000; ms += 7) {
    const q = quantiseHit(ms, { grid: GRID });
    assert.equal(q.lineMs % SIX, 0, 'the position is a sixteenth line');
    assert.ok(q.at >= ms && q.at - ms <= SIX / 2 + 1e-9, 'never early, never more than half a sixteenth late');
  }
  const free = quantiseHit(10_040, { grid: GRID, on: false });
  assert.equal(free.at, 10_040);
  assert.equal(free.lineMs, 10_040);
  const r = rig({ quantise: false });
  r.at(10_040);
  assert.equal(r.jam.hit('kick').at, 10_040, 'the jam plays free when asked');
});

test('the looper records hits with their positions over one bar and plays them at the same positions each bar', () => {
  const r = rig();
  r.at(10_300); // inside the bar that started at 10,000
  r.jam.rec();
  assert.equal(r.jam.state.mode, 'armed', 'REC waits for the next bar line');
  assert.equal(r.jam.state.recStart, 12_000);
  r.at(12_010); r.jam.hit('kick'); // step 0
  r.at(12_490); r.jam.hit('clap'); // step 4 (12,500)
  r.at(13_260); r.jam.hit('hat'); // step 10 (13,250)
  assert.equal(r.jam.state.mode, 'rec');
  assert.deepEqual(r.jam.state.events.map((e) => [e.key, e.pos]), [['kick', 0], ['clap', 4], ['hat', 10]]);
  // the take ends at the bar line and the loop plays; nothing from the take is played twice
  r.calls.length = 0;
  r.run(13_900);
  assert.deepEqual(r.calls.map((c) => [c.key, c.at]), [['kick', 14_000]], 'the first repeat lands on the next bar line');
  r.run(14_000);
  assert.equal(r.jam.state.mode, 'play');
  r.run(17_900);
  const got = r.calls.map((c) => [c.key, c.at]);
  assert.deepEqual(got, [['kick', 14_000], ['clap', 14_500], ['hat', 15_250], ['kick', 16_000], ['clap', 16_500], ['hat', 17_250], ['kick', 18_000]]);
  assert.equal(new Set(got.map(([k, at]) => `${k}${at}`)).size, got.length, 'each event once');
});

test('two and four bars: the length glyph sets the take; a loop that grows repeats, one that shrinks keeps its start', () => {
  const r = rig();
  r.jam.cycleBars();
  assert.equal(r.jam.state.bars, 2);
  r.at(11_000); r.jam.rec();
  r.at(12_000); r.jam.hit('kick');
  r.at(14_250); r.jam.hit('bell'); // bar 2, step 2 -> pos 18
  r.run(16_000);
  assert.equal(r.jam.state.mode, 'play');
  assert.deepEqual(r.jam.state.events.map((e) => e.pos), [0, 18]);
  r.jam.setBars(4);
  assert.deepEqual(r.jam.state.events.map((e) => e.pos), [0, 18, 32, 50], 'grown: the two bars twice');
  r.jam.setBars(1);
  assert.deepEqual(r.jam.state.events.map((e) => e.pos), [0], 'shrunk: the first bar');
  r.jam.cycleBars();
  r.jam.cycleBars();
  r.jam.cycleBars();
  assert.equal(r.jam.state.bars, 1, '1, 2, 4, then 1 again');
});

test('overdub adds hits to a playing loop; with overdub off a hit plays and is not kept; clear empties it', () => {
  const r = rig();
  r.at(11_000); r.jam.rec();
  r.at(12_000); r.jam.hit('kick');
  r.run(14_740); r.jam.hit('clap'); // overdub off
  assert.equal(r.jam.state.events.length, 1, 'not kept');
  r.jam.toggleOverdub();
  assert.equal(r.jam.state.overdub, true);
  r.at(14_760); r.jam.hit('clap'); // step 6 (14,750)
  r.at(14_760); r.jam.hit('clap'); // the same step twice is kept once
  assert.deepEqual(r.jam.state.events.map((e) => [e.key, e.pos]), [['kick', 0], ['clap', 6]]);
  r.calls.length = 0;
  r.run(16_800);
  assert.deepEqual(r.calls.map((c) => [c.key, c.at]), [['kick', 16_000], ['clap', 16_750]], 'the overdub plays from the next turn, never twice');
  r.jam.clear();
  assert.equal(r.jam.state.mode, 'empty');
  assert.equal(r.jam.state.events.length, 0);
  assert.equal(r.jam.state.overdub, false);
  r.calls.length = 0;
  r.run(19_000);
  assert.equal(r.calls.length, 0, 'an empty loop plays nothing');
});

test('stop stops it, play starts it again in phase; the hero\'s pause stops it; MUTE ALL and PAUSE ALL silence it', () => {
  let audible = true;
  const r = rig({ audible: () => audible });
  r.at(11_000); r.jam.rec();
  r.at(12_000); r.jam.hit('kick');
  r.run(14_000);
  r.jam.stop();
  assert.equal(r.jam.state.mode, 'stopped');
  r.calls.length = 0;
  r.run(16_100);
  assert.equal(r.calls.length, 0, 'stopped plays nothing');
  r.at(16_300); r.jam.play();
  assert.equal(r.jam.state.mode, 'play');
  r.run(18_000);
  assert.deepEqual(r.calls.map((c) => c.at), [18_000], 'in phase with the master bars, nothing from before the press');
  r.jam.pause(true);
  assert.equal(r.jam.state.mode, 'stopped', 'the hero\'s pause stops the loop');
  r.calls.length = 0;
  r.run(20_100);
  assert.equal(r.calls.length, 0);
  r.jam.play();
  audible = false; // MUTE ALL (or PAUSE ALL): the loop keeps its time and schedules nothing
  r.run(23_900); r.jam.hit('clap');
  assert.equal(r.calls.length, 0, 'muted: no voice call, not even a hit');
  audible = true;
  r.run(24_100);
  assert.deepEqual(r.calls.map((c) => c.at), [24_000], 'unmuted: on with the next bar, no burst of the missed ones');
});

test('the default audible gate is MUTE ALL: a muted page makes no voice call (an unmuted one does)', () => {
  const calls = [];
  const jam = createJam({ voice: (c) => calls.push(c), theme: () => null, now: () => 1000, grid: () => GRID });
  const was = sound.muted;
  sound.unlock();
  sound.setMuted(false);
  jam.hit('kick');
  assert.equal(calls.length, 1, 'the control: unmuted, the hit is heard');
  sound.setMuted(true);
  jam.hit('kick');
  sound.setMuted(was);
  assert.equal(calls.length, 1, 'muted: no call');
});

test('the cursor steps on the master beat: the bar and the beat of the loop, a count-in while armed', () => {
  const r = rig();
  r.jam.cycleBars();
  r.at(10_600);
  assert.deepEqual(r.jam.cursor(), { mode: 'empty', bars: 2, beats: 8, beat: 5, step: 20, count: null }, 'idle: the master grid\'s own bar and beat');
  r.jam.rec();
  r.at(11_600);
  assert.equal(r.jam.cursor().count, 1, 'one beat to go');
  r.at(14_620);
  assert.deepEqual(r.jam.cursor(), { mode: 'rec', bars: 2, beats: 8, beat: 5, step: 20, count: null }, 'recording: bar 2 beat 2');
});

test('playJamHit: every instrument builds real nodes on the given out, keeps the tone rules, and refuses garbage', () => {
  const ctx = new Ctx();
  const out = ctx.createGain();
  const r = rig({ theme: 'embers' });
  for (const key of JAM_KEYS) {
    all.length = 0;
    const c = r.jam.hit(key);
    assert.equal(playJamHit(ctx, out, c, 1), true, `${key} plays`);
    const made = all.filter((n) => n !== out);
    assert.ok(made.some((n) => n.kind === 'osc' || n.kind === 'src'), `${key}: a source`);
    assert.ok(made.filter((n) => n.started).length > 0, `${key}: started`);
    for (const o of made.filter((n) => n.kind === 'osc' || n.kind === 'src')) assert.ok(o.stopped, `${key}: every source stops itself`);
    assert.ok(made.some((n) => reach(n).has(out)), `${key}: reaches out`);
    // envelopes start at zero and never jump: the first write of every gain that feeds out is 0
    for (const g of made.filter((n) => n.kind === 'gain' && n.gain.events.length && n.out.has(out))) {
      const [type, v] = g.gain.events[0];
      if (type === 'set' || type === 'lin') assert.ok(v === 0 || g.gain.events.length === 1, `${key}: an envelope starts at 0`);
    }
    // no raw saw or square reaches out without a low-pass at or below the ceiling
    for (const o of made.filter((n) => n.kind === 'osc' && (n.type === 'sawtooth' || n.type === 'square'))) {
      const lp = [...reach(o)].find((n) => n.kind === 'biquad' && n.type === 'lowpass');
      assert.ok(lp && lp.frequency.value <= TONE.rawCeiling, `${key}: a saw passes a low-pass`);
    }
  }
  assert.equal(playJamHit(ctx, out, { key: 'nope', hz: 100 }, 1), false);
  assert.equal(playJamHit(ctx, out, { key: 'kick', hz: NaN }, 1), false);
  assert.equal(playJamHit(ctx, out, null, 1), false);
});

test('jamNotes: the chord is the scale\'s own triad on the root, in a comfortable octave', () => {
  const k = jamKey('crystals'); // E lydian
  const chord = jamNotes('chord', k);
  assert.equal(chord.length, 3);
  assert.deepEqual(chord.map((m) => m - chord[0]), [0, k.steps[2], k.steps[4]]);
  const hz = 432 * 2 ** ((chord[0] - 69) / 12);
  assert.ok(hz >= 150 && hz < 300, `the chord's root sits in 150 to 300 Hz (${hz})`);
});

test('a mode change found by the cursor is announced: reading the bar indicator never moves the looper silently', () => {
  const r = rig();
  const seen = [];
  r.jam.subscribe((ev) => { if (ev.type === 'state') seen.push(r.jam.state.mode); });
  r.at(10_300); r.jam.rec();
  r.at(12_100); r.jam.cursor(); // the indicator reads first, before any pump
  r.at(14_100); r.jam.cursor();
  assert.deepEqual(seen, ['armed', 'rec', 'play'], 'every change reaches the subscribers, whoever noticed it');
});
