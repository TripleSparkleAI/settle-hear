// THE TRACK RECORD's loops (lane TRACKTAGS, 2026-10-04): a page saves a visitor's loop layers as plain data and lays
// them back later. snapshot() gives the hits (never audio), load(list) plays them again from the next bar line, on the
// same sixteenths, at the same pitch, through the same one voice call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoopJam, createLayerStack, layerEvent, LAYER_MAX, JAM_KEYS } from '../src/index.js';

const GRID = Object.freeze({ origin: 0, tickMs: 500, bpm: 120, beatsPerBar: 4, barMs: 2000, flashHz: 40 });
const BAR = 2000;

function rig() {
  const calls = [];
  let t = 10_000;
  const jam = createLoopJam({ voice: (c) => { calls.push(c); return true; }, theme: () => 'cathedral', now: () => t, grid: () => GRID, seed: 5, audible: () => true });
  const run = (ms) => { while (t < ms) { t = Math.min(ms, t + 50); jam.pump(); } };
  return { jam, calls, run, at: (ms) => { t = ms; }, get t() { return t; } };
}

test('snapshot gives every layer with hits as plain data, and load plays it back on the same sixteenths and pitches', () => {
  const a = rig();
  a.at(10_000); a.jam.hit('kick'); a.at(10_500); a.jam.hit('pluck'); a.at(11_000); a.jam.hit('chord');
  a.run(10_000 + 5 * BAR);
  const snap = a.jam.snapshot();
  assert.equal(snap.length, 1);
  assert.deepEqual(Object.keys(snap[0]).sort(), ['bars', 'playing', 'src', 'srcBars']);
  assert.equal(snap[0].playing, true);
  assert.deepEqual(snap[0].src.map((e) => e.key), ['kick', 'pluck', 'chord']);
  // plain data: it survives JSON whole
  const saved = JSON.parse(JSON.stringify(snap));
  assert.deepEqual(saved, snap);

  const b = rig();
  b.at(50_300);
  const ids = b.jam.load(saved);
  assert.equal(ids.length, 1);
  const l = b.jam.state.layers[0];
  assert.equal(l.state, 'play');
  assert.equal(l.origin, 52_000, 'the loaded line starts on the next bar line');
  b.run(52_000 + 4 * BAR);
  const played = b.calls.filter((c) => c.looped);
  // the first round of the take: the same three instruments at the same offsets and the same pitches
  const first = played.slice(0, 3);
  assert.deepEqual(first.map((c) => c.key), ['kick', 'pluck', 'chord']);
  assert.deepEqual(first.map((c) => c.at - 52_000), snap[0].src.map((e) => e.pos * 125));
  assert.deepEqual(first.map((c) => c.midi), snap[0].src.map((e) => e.midi));
  assert.ok(first.every((c) => typeof c.sound === 'string' && c.hz > 0));
});

test('load refuses junk hits, caps at LAYER_MAX lines and keeps a stack that is already full untouched', () => {
  assert.equal(layerEvent({ key: 'theremin', pos: 0, vel: 1, midi: 60 }), null);
  assert.equal(layerEvent({ key: 'kick', pos: -1, vel: 1, midi: 60 }), null);
  assert.equal(layerEvent({ key: 'kick', pos: 'x', vel: 1, midi: 60 }), null);
  assert.equal(layerEvent(null), null);
  const ok = layerEvent({ key: 'bell', pos: 4, vel: 3, midi: 69 });
  assert.equal(ok.vel, 1, 'a velocity is clamped');
  assert.equal(ok.sound.length > 0, true);
  assert.ok(Math.abs(ok.hz - 432) < 1e-9, 'midi 69 at A = 432');
  const s = createLayerStack({ grid: () => GRID });
  const one = { bars: 2, srcBars: 1, src: [{ key: 'kick', pos: 0, vel: 0.9, midi: 36 }] };
  const ids = s.load(Array.from({ length: LAYER_MAX + 3 }, () => one), 1000);
  assert.equal(ids.length, LAYER_MAX);
  assert.equal(s.load([one], 1000).length, 0, 'a full stack takes nothing more');
  assert.equal(s.load([{ bars: 1, srcBars: 1, src: [{ key: 'nope', pos: 0 }] }], 1000).length, 0);
  assert.equal(s.layers[0].bars, 2, 'the stretch comes back too');
  assert.ok(JAM_KEYS.length === 10);
});
