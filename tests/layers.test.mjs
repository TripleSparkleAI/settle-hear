// THE LAYERS (lane LOOPLAYERS, 2026-10-02): many loops at once, each a line. The first loop records itself, REC lays
// another on top, every loop is whole bars on the master beat, stretches by repeating, fades by a timer or by THE DJ,
// and a new set lets them all go. Every sound is one voice call (a fake voice records it here).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LAYER_BARS, LAYER_MAX, TAKE_BARS, TIMER_BARS, DJ_FADE, tileEvents, createLayerStack, createLoopJam, sound,
} from '../src/index.js';

const GRID = Object.freeze({ origin: 0, tickMs: 500, bpm: 120, beatsPerBar: 4, barMs: 2000, flashHz: 40 });
const BAR = 2000;
const SIX = 125;

function rig({ audible = () => true, take, djFades = true } = {}) {
  const calls = [];
  let t = 10_000;
  const jam = createLoopJam({ voice: (c) => { calls.push(c); return true; }, theme: () => 'cathedral', now: () => t, grid: () => GRID, seed: 5, audible, take, djFades });
  const run = (ms) => { while (t < ms) { t = Math.min(ms, t + 50); jam.pump(); } };
  return { jam, calls, run, at: (ms) => { t = ms; }, get t() { return t; } };
}
const looped = (calls) => calls.filter((c) => c.looped);

test('the numbers: 1 to 16 bars, a 4-bar take by default, takes of 1/2/4/8, six layers, timer 4/8/16, the DJ fade rule', () => {
  assert.deepEqual({ ...LAYER_BARS }, { min: 1, max: 16, take: 4 });
  assert.deepEqual([...TAKE_BARS], [1, 2, 4, 8]);
  assert.equal(LAYER_MAX, 6);
  assert.deepEqual([...TIMER_BARS], [4, 8, 16]);
  assert.deepEqual({ ...DJ_FADE }, { after: 24, over: 8, crowd: 4, crowdAfter: 8 });
});

test('THE FIRST LOOP RECORDS ITSELF: a hit with no layers opens a 4-bar take on its own bar; it plays at the take end, in time, every 4 bars', () => {
  const r = rig();
  r.at(10_250); // bar 5 (10,000 .. 12,000), sixteenth 2
  r.jam.hit('kick');
  const s = r.jam.state;
  assert.equal(s.layers.length, 1, 'one line');
  assert.equal(s.layers[0].state, 'rec');
  assert.equal(s.layers[0].origin, 10_000, 'the take starts on the bar the hit is in');
  assert.equal(s.layers[0].bars, 4);
  assert.equal(s.layers[0].events[0].pos, 2);
  r.at(11_000); r.jam.hit('clap');
  r.run(18_000);
  assert.equal(r.jam.state.layers[0].state, 'play', 'the take ended at 4 bars and plays');
  assert.equal(looped(r.calls).length, 0, 'nothing played back during the take');
  r.run(34_000);
  const back = looped(r.calls);
  assert.deepEqual(back.map((c) => [c.key, c.at]), [['kick', 18_250], ['clap', 19_000], ['kick', 26_250], ['clap', 27_000]]);
});

test('REC lays a new layer: it waits for the next bar line, keeps hits there, ends at its length, and plays beside the first', () => {
  const r = rig();
  r.at(10_000); r.jam.hit('kick');
  r.run(18_100);
  r.at(18_600); const res = r.jam.rec();
  assert.equal(res.did, 'arm');
  let s = r.jam.state;
  assert.equal(s.layers.length, 2);
  assert.equal(s.recording.state, 'armed');
  assert.equal(s.recording.origin, 20_000, 'starts on the next bar line');
  r.run(20_000);
  assert.equal(r.jam.state.recording.state, 'rec');
  r.at(20_500); r.jam.hit('bell');
  r.run(28_000);
  s = r.jam.state;
  assert.equal(s.layers[1].state, 'play');
  assert.equal(s.recording, null);
  const n = r.calls.length;
  r.run(36_100);
  const keys = looped(r.calls.slice(n)).map((c) => c.key);
  assert.ok(keys.includes('kick') && keys.includes('bell'), 'both layers play');
  // a hit now is not kept anywhere: no take is open, the stack is not empty
  r.jam.hit('hat');
  assert.equal(r.jam.state.layers.reduce((a, l) => a + l.events.length, 0), 2);
});

test('REC while recording ends the take on the next bar line (whole bars); REC while armed cancels; a take with no hits leaves no line', () => {
  const st = createLayerStack({ grid: GRID });
  st.rec(1_000, 8); // arms for 2,000, 8 bars
  st.advance(2_000);
  st.record({ key: 'kick' }, 2_000);
  st.record({ key: 'clap' }, 5_250);
  assert.equal(st.rec(5_300).did, 'close');
  const l = st.layers[0];
  assert.equal(l.recEnd, 6_000);
  assert.equal(l.bars, 2, 'two whole bars');
  st.advance(6_000);
  assert.equal(st.layers[0].state, 'play');
  assert.equal(st.rec(6_100).did, 'arm');
  assert.equal(st.rec(6_200).did, 'cancel');
  assert.equal(st.count, 1);
  st.rec(6_300);
  st.advance(8_000 + 8_000);
  assert.equal(st.count, 1, 'an empty take left no line');
});

test('six layers at most: REC says full', () => {
  const st = createLayerStack({ grid: GRID });
  let ms = 0;
  for (let i = 0; i < LAYER_MAX; i++) {
    st.rec(ms, 1);
    ms = st.recording().origin;
    st.advance(ms);
    st.record({ key: 'kick' }, ms);
    ms += BAR;
    st.advance(ms);
  }
  assert.equal(st.count, 6);
  assert.equal(st.rec(ms).did, 'full');
});

test('STRETCH REPEATS: 4 bars dragged to 6 plays the take then its first 2 bars; dragged to 2 plays the first 2; back to 4 is exact', () => {
  const src = [{ key: 'kick', pos: 0 }, { key: 'clap', pos: 20 }, { key: 'bell', pos: 50 }];
  assert.deepEqual(tileEvents(src, 4, 6).map((e) => e.pos), [0, 20, 50, 64, 84]);
  assert.deepEqual(tileEvents(src, 4, 2).map((e) => e.pos), [0, 20]);
  assert.deepEqual(tileEvents(src, 4, 9).map((e) => e.pos), [0, 20, 50, 64, 84, 114, 128]);
  const st = createLayerStack({ grid: GRID });
  st.record({ key: 'kick' }, 0, { auto: true });
  st.record({ key: 'bell' }, 6_250, { auto: true });
  st.advance(8_000);
  const id = st.layers[0].id;
  assert.equal(st.setBars(id, 2, 8_000), 2);
  assert.deepEqual(st.layers[0].events.map((e) => e.key), ['kick']);
  assert.equal(st.setBars(id, 4, 8_000), 4);
  assert.deepEqual(st.layers[0].events.map((e) => [e.key, e.pos]), [['kick', 0], ['bell', 50]], 'nothing lost by shrinking');
  assert.equal(st.setBars(id, 99, 8_000), 16, 'clamped to 16');
  assert.equal(st.setBars(id, 0, 8_000), 1, 'clamped to 1');
  // a 6-bar layer repeats its kick every 6 bars and its first-2-bar copy at bar 4: every hit on a sixteenth
  st.setBars(id, 6, 8_000);
  const ats = st.due(8_000, 32_000).filter((e) => e.key === 'kick').map((e) => e.at);
  assert.deepEqual(ats, [8_000, 12_000, 20_000, 24_000], 'the take at 0 and 12 s, its first-2-bar copy at 8 and 20 s');
  for (const e of st.due(8_000, 40_000)) assert.equal(e.at % SIX, 0, 'on a sixteenth');
});

test('the fade timer: off -> 4 -> 8 -> 16 -> off; the gain falls in a line from the gain it has now; at the end the layer is gone', () => {
  const st = createLayerStack({ grid: GRID });
  st.record({ key: 'kick', vel: 1 }, 0, { auto: true });
  st.advance(8_000);
  const id = st.layers[0].id;
  assert.equal(st.cycleTimer(id, 8_000), 4);
  assert.equal(st.timerLeft(id, 8_000), 4);
  assert.equal(st.gainAt(id, 8_000), 1);
  assert.ok(Math.abs(st.gainAt(id, 12_000) - 0.5) < 1e-9, 'half way, half gain');
  assert.equal(st.timerLeft(id, 12_001), 2);
  assert.equal(st.cycleTimer(id, 12_000), 8, 'the next step starts from the gain it has now');
  assert.ok(Math.abs(st.gainAt(id, 12_000) - 0.5) < 1e-9);
  assert.equal(st.cycleTimer(id, 12_000), 16);
  assert.equal(st.cycleTimer(id, 12_000), null, 'off');
  assert.equal(st.gainAt(id, 13_000), 1, 'cancelled: full again');
  st.cycleTimer(id, 14_000);
  const v = st.due(14_000, 22_000).map((e) => e.vel);
  assert.ok(v.length && v.every((x, i) => i === 0 || x <= v[i - 1]), 'the loop gets quieter');
  assert.deepEqual(st.advance(22_000).map((c) => c.what), ['faded']);
  assert.equal(st.count, 0);
});

test('THE DJ fades old loops: untouched for 24 bars it fades over 8; touching it cancels the DJ fade; one DJ fade at a time; a crowd fades sooner', () => {
  const st = createLayerStack({ grid: GRID });
  st.record({ key: 'kick' }, 0, { auto: true });
  st.advance(8_000);
  const id = st.layers[0].id;
  assert.equal(st.djTick(8_000 + 23 * BAR), null);
  assert.equal(st.djTick(8_000 + 24 * BAR), id);
  assert.equal(st.layers[0].fade.by, 'dj');
  st.setBars(id, 8, 8_000 + 25 * BAR);
  assert.equal(st.layers[0].fade, null, 'touched: the DJ lets it stay');
  // a visitor's timer is never cancelled by a touch
  st.cycleTimer(id, 8_000 + 26 * BAR);
  st.stop(id, 8_000 + 26 * BAR);
  st.play(id, 8_000 + 26 * BAR);
  assert.equal(st.layers[0].fade.by, 'you');
  // crowded: five playing, the oldest untouched for 8 bars fades
  const c = createLayerStack({ grid: GRID });
  let ms = 0;
  for (let i = 0; i < 5; i++) { c.rec(ms, 1); ms = c.recording().origin; c.advance(ms); c.record({ key: 'hat' }, ms); ms += BAR; c.advance(ms); }
  const oldest = c.layers[0].id;
  assert.equal(c.djTick(ms + 3 * BAR), null);
  assert.equal(c.djTick(ms + 8 * BAR), oldest);
  assert.equal(c.djTick(ms + 9 * BAR), null, 'one DJ fade at a time');
});

test('play, stop and close per layer: stop silences that line only, play resumes in phase, close removes it', () => {
  const r = rig();
  r.at(10_000); r.jam.hit('kick');
  r.run(18_000);
  r.jam.rec(); r.run(18_000); r.at(18_250); r.jam.hit('bell');
  r.run(26_000);
  const [a, b] = r.jam.state.layers;
  r.jam.toggle(a.id);
  assert.equal(r.jam.state.layers[0].state, 'stopped');
  let n = r.calls.length;
  r.run(34_100);
  assert.deepEqual([...new Set(looped(r.calls.slice(n)).map((c) => c.key))], ['bell'], 'only the second line plays');
  r.jam.toggle(a.id);
  n = r.calls.length;
  r.run(42_100);
  const kicks = looped(r.calls.slice(n)).filter((c) => c.key === 'kick').map((c) => c.at);
  assert.ok(kicks.length && kicks.every((x) => (x - 10_000) % 8_000 === 0), 'the kick stays on its 4-bar grid');
  r.jam.close(b.id);
  assert.deepEqual(r.jam.state.layers.map((l) => l.id), [a.id]);
});

test('a new set releases every layer over one bar; nothing plays after; a take in progress keeps its hits until then', () => {
  const r = rig();
  r.at(10_000); r.jam.hit('kick');
  r.run(18_000);
  r.jam.rec(); r.run(18_000); r.at(18_000); r.jam.hit('clap');
  r.run(19_000);
  assert.equal(r.jam.release(), 2);
  for (const l of r.jam.state.layers) assert.equal(l.fade.by, 'set');
  r.run(21_100);
  assert.equal(r.jam.state.layers.length, 0, 'gone after a bar');
  const n = r.calls.length;
  r.run(40_000);
  assert.equal(r.calls.length, n, 'silence');
});

test('MUTE ALL silences every layer and the instruments; unmuting brings no burst of missed hits', () => {
  let on = true;
  const r = rig({ audible: () => on });
  r.at(10_000); r.jam.hit('kick');
  r.run(18_000);
  on = false;
  const n = r.calls.length;
  r.run(30_000);
  r.jam.hit('clap');
  assert.equal(r.calls.length, n, 'nothing while muted');
  on = true;
  r.run(30_250);
  assert.ok(r.calls.slice(n).every((c) => c.at >= 30_000), 'no hit from the muted past');
  // the real switch: sound.audible false stops the default gate
  assert.equal(typeof sound.audible, 'boolean');
});

test('the take length cycles 1, 2, 4, 8 and an auto take uses it; hits stay on sixteenths; quantise off keeps the exact time', () => {
  const r = rig({ take: 2 });
  assert.equal(r.jam.state.take, 2);
  assert.equal(r.jam.cycleTake(), 4);
  assert.equal(r.jam.cycleTake(), 8);
  assert.equal(r.jam.cycleTake(), 1);
  r.jam.cycleTake();
  r.at(10_070); r.jam.hit('kick');
  assert.equal(r.jam.state.layers[0].bars, 2);
  assert.equal(r.jam.state.layers[0].events[0].pos, 1, 'snapped to the nearest sixteenth');
  r.jam.setQuantise(false);
  r.at(10_400); r.jam.hit('hat');
  assert.ok(r.jam.state.layers[0].events.some((e) => Math.abs(e.pos - 3.2) < 1e-9), 'free time kept');
});

test('every user act emits "you" (hit, rec, a layer act); the DJ\'s release does not', () => {
  const r = rig();
  const seen = [];
  r.jam.subscribe((e) => { if (e.type === 'you') seen.push(e.why); });
  r.jam.hit('kick');
  r.jam.rec();
  const id = r.jam.state.layers[0].id;
  r.run(20_000);
  r.jam.timer(id);
  r.jam.release();
  assert.deepEqual(seen, ['hit', 'rec', 'layer']);
});

test('the cursor: armed counts the beats to the take, recording steps through the take, else the master bar', () => {
  const st = createLayerStack({ grid: GRID });
  assert.equal(st.cursor(1_250).mode, 'idle');
  assert.equal(st.cursor(1_250).beat, 2);
  st.rec(500, 4);
  const c = st.cursor(1_000);
  assert.equal(c.mode, 'armed');
  assert.equal(c.count, 2);
  st.advance(2_000);
  const r = st.cursor(4_600);
  assert.equal(r.mode, 'rec');
  assert.equal(r.beat, 5);
  assert.equal(r.beats, 16);
});
