// settle-hear · THE SET SEEN WHOLE (lane DJVISUAL): dj-view.js and what djLive carries for THE DJ VISUALISER. Every
// test was proven to fail under an aimed mutation (SETTLE/runs/djvisual/redproof.txt).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx } from './fakeaudio.mjs';
import { settleTrainedSet, lineKind, loadTrainedModels } from '../src/dj-trained.js';
import { dropsOf, sectionsOf, createTrainedPlanner } from '../src/dj-trained-plan.js';
import { setView, grooveView, tuneView, barOfSet, VIEW_FORMAT } from '../src/dj-view.js';
import { djSnapshot } from '../src/djlive.js';
import { createBrainStore } from '../src/dj-brain.js';
import { configure, unlockNow } from '../src/index.js';
import models from '../src/dj-trained-models.js';

const SET = settleTrainedSet(models, 'house', { seed: 21 });

test('THE VIEW: the grid, the lines, the drops and the sections of one settled set, read whole', () => {
  const v = setView(SET);
  assert.equal(v.format, VIEW_FORMAT);
  assert.equal(v.blocks, SET.blocks);
  assert.equal(v.bars, 8 * SET.blocks);
  assert.deepEqual(v.roles, SET.roles);
  assert.deepEqual(v.grid, SET.grid.map((r) => r.slice(0, SET.blocks)), 'the grid as the DJ settled it');
  assert.deepEqual(v.lines, Array.from({ length: SET.blocks }, (_, t) => lineKind(t, 0)), 'where a drop wants to land');
  assert.deepEqual(v.drops, dropsOf(SET), 'where the drops did land');
  const sec = sectionsOf(SET);
  assert.deepEqual(v.sections, Array.from({ length: SET.blocks }, (_, t) => sec[8 * t]));
  assert.equal(v.family, 'house');
  assert.equal(v.seed, 21);
  assert.equal(v.fence, 'none', 'a set settled here is not fenced');
  assert.equal(v.events.rows.length, v.events.order.length);
});

test('ONE VIEW A SET: the same object bar after bar, frozen, and a new one for a new set', () => {
  const a = setView(SET);
  assert.equal(setView(SET), a, 'cached by identity');
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.grid) && Object.isFrozen(a.grid[0]), 'frozen all the way down');
  const other = setView(settleTrainedSet(models, 'house', { seed: 22 }));
  assert.notEqual(other, a);
  assert.equal(setView(null), null);
  assert.equal(setView({ grid: 1 }), null);
});

test('A PIECE carries its fence; a settle does not', () => {
  const piece = { ...SET, piece: { id: 'test-piece', name: 'test piece' } };
  const v = setView(piece);
  assert.equal(v.fence, 'spark');
  assert.deepEqual(v.piece, { id: 'test-piece', name: 'test piece' });
});

test('THE TRAINED PLANNER hands the view on every bar of the set and of its warm-down', () => {
  const p = createTrainedPlanner({ seed: 3 });
  p.load(SET);
  const first = p.bar({});
  const v = first.trained.view;
  assert.equal(v, setView(SET));
  for (let b = 1; b < 8 * SET.blocks + 3; b++) assert.equal(p.bar({}).trained.view, v, `bar ${b}`);
});

test('BAR OF SET: the bar, the block, whether it is a drop, and the next drop', () => {
  const v = setView(SET);
  assert.ok(v.drops.length > 0, 'this seed has a drop');
  const d = v.drops[0];
  const at = barOfSet(v, 8 * d);
  assert.equal(at.block, d);
  assert.equal(at.k, 0);
  assert.equal(at.drop, true);
  assert.equal(barOfSet(v, 8 * d + 3).drop, false, 'a drop lands on its block\'s first bar only');
  const before = barOfSet(v, 8 * d - 1);
  assert.equal(before.drop, false);
  assert.equal(before.nextDrop, 8 * d);
  assert.equal(barOfSet(v, v.bars + 2).inSet, false);
  assert.equal(barOfSet(v, v.bars + 2).section, 'hum');
  assert.equal(barOfSet(null, 3), null);
});

test('THE GROOVE and THE TUNE as plain numbers', () => {
  const g = grooveView({ bar: 4, steps: { kick: '9...5...', hats: [0.5, 0] }, hats: 'c.o.', events: { fill: 1 } });
  assert.deepEqual(g.steps.kick.slice(0, 5), [1, 0, 0, 0, 5 / 9]);
  assert.deepEqual(g.steps.hats, [0.5, 0]);
  assert.equal(g.events.fill, true);
  assert.equal(grooveView(null), null);
  const notes = [{ midi: 60, beats: 1 }, { midi: null, beats: 0.5 }, { midi: 64, beats: 2 }];
  const t = tuneView(notes);
  assert.deepEqual(t, [[1, 60], [0.5, null], [2, 64]]);
  assert.equal(tuneView(notes), t, 'cached per array');
  assert.equal(tuneView(notes, 2).length, 2);
});

test('DJLIVE carries the view by reference, the set bar, the groove, the layers and the music', () => {
  const view = setView(SET);
  const snap = djSnapshot({
    playing: true,
    audible: true,
    theme: { key: 'embers', label: 'embers' },
    decision: { mode: 'house', bar: 40 },
    house: { on: true, keys: [] },
    mix: { section: 'peak', setBar: 17, yes: { drums: 1, bass: 0 }, brain: 'trained', trained: { family: 'house', seed: 21, block: 2, blocks: SET.blocks, view, groove: { bar: 17, steps: { kick: '9..9' }, hats: '', events: {} }, notes: null }, music: { root: 57, mode: 'aeolian', chord: [57, 60, 64], tune: { label: 'a tune', motif: [2, -1], notes: [{ midi: 60, beats: 1 }], bar: 3 } } },
  });
  assert.equal(snap.trained.view, view, 'by reference: a reader sees a new set by identity');
  assert.equal(snap.setBar, 17);
  assert.equal(snap.trained.seed, 21);
  assert.deepEqual(snap.trained.groove.steps.kick, [1, 0, 0, 1]);
  assert.deepEqual(snap.layers, { drums: true, bass: false });
  assert.deepEqual(snap.music.chord, [57, 60, 64]);
  assert.deepEqual(snap.music.tune.notes, [[1, 60]]);
  const idle = djSnapshot(null);
  assert.equal(idle.setBar, null);
  assert.equal(idle.layers, null);
});

test('THE HERO SYMPHONY: djLive shows the trained set whole, the set bar counts, and NEXT brings a new view', async () => {
  const { createSymphony, djLive, nextSet } = await import('../src/index.js');
  configure({ createContext: () => new Ctx() });
  const store = createBrainStore('trained');
  const s = createSymphony({ seed: 8, theme: 'embers', auto: false, house: true, steer: null, votes: null, djBrain: store, pieces: false }); // pieces: tests/piecesplay.test.mjs
  const E = unlockNow();
  await loadTrainedModels();
  await new Promise((r) => setTimeout(r, 0));
  for (let k = 0; k < 24; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  const a = djLive.get();
  assert.equal(a.brain, 'trained');
  assert.ok(a.trained?.view, 'the view is live');
  assert.equal(a.trained.view.format, VIEW_FORMAT);
  assert.ok(Number.isInteger(a.setBar) && a.setBar >= 0);
  assert.ok(a.trained.groove && a.trained.groove.steps.kick, 'the bar\'s groove');
  assert.ok(a.layers && typeof a.layers.drums === 'boolean', 'the mix layers');
  assert.equal(a.music?.chord?.length, 3, 'the chord of the bar');
  for (let k = 0; k < 4; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  const b = djLive.get();
  assert.equal(b.trained.view, a.trained.view, 'the same set keeps its view');
  assert.equal(b.setBar, a.setBar + 1, 'a bar later, one bar on');
  nextSet();
  for (let k = 0; k < 8; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  const c = djLive.get();
  assert.notEqual(c.trained.view, a.trained.view, 'NEXT: a new set, a new view');
  assert.ok(c.setBar < b.setBar, 'the new set counts from its own start');
  s.dispose();
});
