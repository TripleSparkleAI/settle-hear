// THE TRAINED DJ (lane DJWIRE): THE DJ's trained models (GRIDLEARN stages 1 and 2) settled in the browser make the same
// set as Python for the same seed; the trained planner reads its sections, drops and moves from the set; the house
// brain composes its sets from it, keeps the old DJ as the fallback and switches between them on the next bar; the
// steering still moves the mix; the tag carries the trained set and rebuilds it; the layers play its settled bars.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Ctx, writes } from './fakeaudio.mjs';
import { deckRng } from '../src/deck.js';
import {
  settleTrainedSet, loadTrainedModels, FAMILIES, resample, gateFields, gridFields, mergeFields, blockContext, phraseFields,
  grooveUnpack, barContext, settleSites, neighbours, blocksFor, lineKind,
} from '../src/dj-trained.js';
import { createTrainedPlanner, sectionsOf, dropsOf, exitsOf, movesOf, barOf, layersOf, HUM_BARS } from '../src/dj-trained-plan.js';
import { playTrainedDrums, trainedJitter } from '../src/dj-trained-play.js';
import { createHouseDJ } from '../src/mix-dj.js';
import { createMixSet } from '../src/mix-layers.js';
import { encodeTag, decodeTag, tagLines, situationOf } from '../src/dj-tag.js';
import { djBrain, createBrainStore } from '../src/dj-brain.js';
import { configure, unlockNow } from '../src/index.js';
import { DRUM_KITS } from '../src/voice-drum-machines.js';
import models from '../src/dj-trained-models.js';

const FIX = JSON.parse(readFileSync(new URL('./fixtures/dj-trained-fixture.json', import.meta.url), 'utf8'));
const KEYS = ['blocks', 'shape', 'gates', 'grid', 'events', 'steps', 'hats', 'clap', 'feel', 'onRuleResettles'];
const close = (a, b, tol = 1e-9) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= tol);

test('THE SAME SET AS PYTHON: every fixture seed settles bar for bar as SETTLE/gridlearn/dj_ref.py settled it', () => {
  assert.ok(FIX.sets.length >= 6);
  for (const p of FIX.sets) {
    const s = settleTrainedSet(models, p.family, { seed: p.seed, blocks: p.asked_blocks });
    for (const k of KEYS) assert.deepEqual(s[k], p[k], `${p.family} seed ${p.seed}: ${k}`);
    assert.ok(close(s.arc, p.arc, 1e-8), `${p.family} seed ${p.seed}: arc`);
  }
  assert.ok(FIX.sets.some((p) => p.feel.swung) && FIX.sets.some((p) => p.feel.played), 'the fixture covers a swung and a played set');
  assert.ok(FIX.sets.some((p) => p.asked_blocks == null), 'the fixture covers a length drawn from the family');
});

test('THE SAME FIELDS AS THE TRAINING CODE: the line plan, the merged grid, a phrase block and a groove, against arrange2.py, phrasemodel.py and groovemodel.py', () => {
  for (const d of FIX.digests) {
    const fm = models.families[d.family];
    const arc = resample(fm.arcs[d.shape].curve, d.blocks);
    const g = gateFields(fm, arc, 0);
    assert.ok(close(Array.from(g.h), d.gate_h), `${d.family}: gate leans`);
    assert.ok(Math.abs(g.J.reduce((a, row) => a + row.reduce((b, x) => b + Math.abs(x), 0), 0) - d.gate_J_sum) < 1e-9);
    const bf = gridFields(models, fm, arc, d.gates, 0);
    const mf = mergeFields(bf.h, bf.J, d.gates, models.roles.length);
    assert.equal(mf.K, d.K);
    assert.ok(close(Array.from(mf.hs), d.merged_h), `${d.family}: merged leans`);
    assert.ok(close(Array.from(mf.Js[0]), d.merged_J_row0), `${d.family}: merged pulls row 0`);
    assert.ok(Math.abs(mf.Js.reduce((a, row) => a + row.reduce((b, x) => b + Math.abs(x), 0), 0) - d.merged_J_abs_sum) < 1e-6);
    // the phrase block 0 and the first groove are taken from the fixture set's own grid
    const set = FIX.sets.find((p) => p.family === d.family && p.seed === d.seed);
    const ctx = blockContext(set.grid, arc, 0, models.roles);
    assert.ok(close(ctx[0], d.phrase_ctx0), `${d.family}: block context`);
    const pf = phraseFields(fm.phrase, ctx[0]);
    assert.ok(close(Array.from(pf.h), d.phrase_h0), `${d.family}: phrase leans`);
    assert.ok(Math.abs(pf.J.reduce((a, row) => a + row.reduce((b, x) => b + Math.abs(x), 0), 0) - d.phrase_J_abs_sum) < 1e-6);
    const G = grooveUnpack(fm.groove.base);
    const c = barContext(arc[0], [0, 0, 0, 0, 0, 0], 0, set.grid[0][0]);
    c[6] = 0;
    const base = G.h.map((v, i) => v + c.reduce((a, x, k) => a + x * G.C[k][i], 0));
    assert.ok(close(base, d.groove_base_h0, 1e-9), `${d.family}: groove leans`);
    assert.ok(Math.abs(G.W.reduce((a, row) => a + row.reduce((b, x) => b + Math.abs(x), 0), 0) - d.groove_W_abs_sum) < 1e-6);
  }
});

test('negative controls: a changed seed, a changed parameter and a changed stream each change the set', () => {
  const p = FIX.sets[0];
  const a = settleTrainedSet(models, p.family, { seed: p.seed + 1, blocks: p.asked_blocks });
  assert.notDeepEqual(a.steps, p.steps, 'another seed, another set');
  const bent = structuredClone(models);
  bent.families[p.family].shift = bent.families[p.family].shift.map((x) => x + 4);
  const b = settleTrainedSet(bent, p.family, { seed: p.seed, blocks: p.asked_blocks });
  assert.notDeepEqual(b.gates, p.gates, 'a bent line-plan shift changes the line plan');
  assert.ok(b.gates.every((g) => g === 1), 'every line opens when every line leans hard to open');
  // the sampler sees the stream: a different first draw moves the line plan
  const h = Float64Array.from([0, 0, 0, 0]);
  const nbr = neighbours([[0, 0.5, 0, 0], [0.5, 0, 0.5, 0], [0, 0.5, 0, 0.5], [0, 0, 0.5, 0]]);
  const s1 = settleSites(h, nbr, [1, 1, 1, 1], [0.5, 0.5], deckRng(1));
  const s2 = settleSites(h, nbr, [1, 1, 1, 1], [0.5, 0.5], deckRng(2));
  assert.notDeepEqual(s1, s2);
});

test('the shared rules: line kinds, the length of a set, the lazy loader returns the one module', async () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((t) => lineKind(t, 0)), [0, 2, 1, 2, 0]);
  assert.equal(blocksFor(4, 100), 12, 'a half rounds to even, as Python does');
  assert.equal(blocksFor(3.8, 126), 15);
  assert.deepEqual(Object.keys(models.families).sort(), FAMILIES.slice().sort());
  assert.equal(await loadTrainedModels(), models);
  const raw = readFileSync(new URL('../src/dj-trained-models.js', import.meta.url), 'utf8');
  assert.doesNotMatch(raw, /\.mid\b|lmd_full|LEARNING_MIDI|"md5"|"artist"|"title"/i, 'no song in the models');
});

test('THE TRAINED PLANNER: sections, drops, exits, layers and moves read from a hand-made set', () => {
  const roles = models.roles;
  const T = 8;
  const row = (bits) => bits.split('').map(Number);
  const on = { kick: '00111011', snare: '00111011', hats: '01111111', perc: '00000000', bass: '00111011', chords: '11111111', lead: '00011010', arp: '00001000', vocal: '00000010', fx: '01001000' };
  const events = models.events.map(() => '.'.repeat(8 * T));
  const put = (name, b) => { const e = models.events.indexOf(name); events[e] = events[e].slice(0, b) + 'x' + events[e].slice(b + 1); };
  put('lift', 46); put('lift', 47); put('crash', 48); put('roll', 47);
  const set = { family: 'house', seed: 1, blocks: T, roles, grid: roles.map((r) => row(on[r])), arc: [-1, -0.5, 0, 0.5, 0.5, 0, 1, 0], gates: [1, 1, 1, 0, 1, 1, 1, 1], events_order: models.events, events, groove_roles: models.grooveRoles, steps: Array.from({ length: 8 * T }, () => ['x...x...x...x...'.replace(/x/g, '9'), '................', '9.9.9.9.9.9.9.9.', '................']), hats: Array.from({ length: 8 * T }, () => 'c.c.c.c.c.c.c.c.'), clap: false, feel: { swing: 0, played: false, spread: {} } };
  assert.deepEqual(dropsOf(set), [2, 6]);
  assert.deepEqual(exitsOf(set), [5]);
  const sec = sectionsOf(set);
  assert.equal(sec[0], 'intro', 'two blocks before the first drop: the first is the intro');
  assert.equal(sec[8], 'build', 'and the second the build');
  assert.deepEqual([sec[16], sec[40], sec[44], sec[48], sec[63]], ['peak', 'breakdown', 'build', 'peak', 'peak'], 'a one-block breakdown builds over its last half');
  assert.deepEqual(layersOf(set, 4), { drums: true, bass: true, pad: true, lead: true, arps: true, answer: false, chain: true });
  const mv = movesOf(set, deckRng(3));
  const keys = (b) => (mv.get(b) ?? []).map((m) => m.key);
  assert.ok(keys(46).includes('riser'), 'a riser over the settled lift bars, two bars before the drop');
  assert.equal(mv.get(46).find((m) => m.key === 'riser').bars, 2);
  assert.ok(keys(47).includes('snare-roll') && keys(47).includes('reverse-cymbal'), 'the roll, and a reverse cymbal into the settled crash');
  assert.deepEqual(keys(48).sort(), ['downlifter', 'key-lift'], 'the second drop lands with a downlifter and a key lift');
  assert.ok(keys(39).length === 1, 'a move into the breakdown on the bar before the exit');
  assert.ok(keys(63).length >= 1, 'a move into the hum');
  const g = barOf(set, 16);
  assert.equal(g.steps.kick.filter((v) => v > 0).length, 4);
  assert.equal(g.block, 2);
  // the planner over the set and its warm-down
  const P = createTrainedPlanner({ seed: 2 });
  P.load(set, { set: 3 });
  const seen = [];
  while (!P.done) seen.push(P.bar());
  assert.equal(seen.length, 8 * T + HUM_BARS);
  assert.equal(seen[0].newSet, true);
  assert.equal(seen[0].set, 3);
  assert.ok(seen.slice(8 * T).every((x) => x.section === 'hum' && x.trained.layers === null));
  assert.ok(seen[32].lines[32] && !seen[24].lines[32] && seen[16].lines[16]);
  assert.equal(seen[48].keyLift, 2);
  assert.deepEqual(seen[16].trained.layers, layersOf(set, 2));
  assert.equal(seen[16].nextAt, 40, 'the peak holds to the breakdown at bar 40');
  P.load(set, { set: 4 });
  for (let b = 0; b < 33; b++) P.bar();
  P.endSoon();
  const cut = [];
  while (!P.done) cut.push(P.bar().section);
  assert.ok(cut.length <= 7 + HUM_BARS && cut.slice(-HUM_BARS).every((x) => x === 'hum'), 'a theme push goes to the warm-down at the next 8-bar line');
});

test('THE BRAIN: with the models every new set is a trained one; without them the old DJ plays; a switch lands on the next bar as a new set', () => {
  const dj = createHouseDJ({ seed: 5, theme: 'highlands', trained: models });
  const d0 = dj.bar({ theme: 'highlands' });
  assert.equal(d0.brain, 'trained');
  assert.ok(['house', 'trance'].includes(d0.trained.family), 'a highlands set is house or trance');
  assert.equal(d0.newSet, true);
  assert.equal(d0.plan.set, 0, 'the first set is set 0, so the symphony does not move the theme on its first bar');
  let sets = 0;
  let checked = 0;
  for (let b = 1; b < 600; b++) {
    const d = dj.bar({ theme: 'highlands' });
    if (d.newSet) { sets += 1; assert.equal(d.brain, 'trained'); assert.equal(d.plan.setBar, 0); }
    if (d.trained?.layers && d.plan.setBar % 8 === 3) {
      // the grid decides the drums: on where any drum role plays, off where none does (no steering here)
      assert.equal(d.mix.yes.drums, d.trained.layers.drums, `bar ${b}`);
      checked += 1;
    }
  }
  assert.ok(sets >= 2 && checked > 20);
  const old = createHouseDJ({ seed: 5, theme: 'highlands' });
  const o0 = old.bar({ theme: 'highlands' });
  assert.equal(o0.brain, 'old');
  assert.equal(o0.trained, null, 'no models: the old DJ, with nothing trained in its decision');
  // THE A/B SWITCH
  dj.setBrain('old');
  const s1 = dj.bar({ theme: 'highlands' });
  assert.equal(s1.brain, 'old');
  assert.equal(s1.newSet, true);
  assert.equal(s1.section, 'intro');
  dj.setBrain('trained');
  const s2 = dj.bar({ theme: 'highlands' });
  assert.equal(s2.brain, 'trained');
  assert.equal(s2.newSet, true);
  assert.ok(s2.plan.set > s1.plan.set, 'the set number moves on through the switches');
  // THE FALLBACK: the models arrive late; the old DJ plays until then, a new set starts when they do
  const late = createHouseDJ({ seed: 9, theme: 'embers' });
  for (let b = 0; b < 10; b++) assert.equal(late.bar({ theme: 'embers' }).brain, 'old');
  late.setTrained(models);
  const l = late.bar({ theme: 'embers' });
  assert.equal(l.brain, 'trained');
  assert.ok(['techno', 'breaks', 'house'].includes(l.trained.family));
});

test('THE STEERING still moves a trained mix, about as far as it moves the old one', () => {
  // the share of bars (the warm-down left out) with a layer in, over six seeds, by the push on that layer
  const share = (trained, key, v) => {
    let on = 0;
    let n = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const dj = createHouseDJ({ seed, theme: 'embers', trained: trained ? models : null });
      for (let b = 0; b < 200; b++) {
        const d = dj.bar({ theme: 'embers', steer: { leans: {}, mix: { [key]: v } } });
        if (d.section === 'hum') continue;
        n += 1;
        if (d.mix.yes[key]) on += 1;
      }
    }
    return on / n;
  };
  for (const key of ['drums', 'bass', 'pad']) {
    const [free, down, up] = [0, -1, 1].map((v) => share(true, key, v));
    assert.ok(down < free - 0.1, `${key}: pushed down, less (${down} against ${free})`);
    assert.ok(up > free, `${key}: pushed up, more (${up} against ${free})`);
    const oldMove = share(false, key, 0) - share(false, key, -1);
    assert.ok(free - down > 0.5 * oldMove, `${key}: the push moves the trained mix at least half as far as the old (${free - down} against ${oldMove})`);
  }
  // the holds clamp outright, as before: a held-out lead never plays
  const dj = createHouseDJ({ seed: 4, theme: 'highlands', trained: models });
  for (let b = 0; b < 100; b++) assert.equal(dj.bar({ theme: 'highlands', holds: { lead: false } }).mix.yes.lead, false);
});

test('THE TAG carries the trained set and the brain rebuilds it; an older tag has none; a tag with no voices still reads', () => {
  const dj = createHouseDJ({ seed: 5, theme: 'highlands', trained: models });
  let d;
  for (let b = 0; b < 30; b++) d = dj.bar({ theme: 'highlands' });
  const sit = { theme: 'highlands', section: d.section, setBar: d.plan.setBar, set: d.plan.set, layers: d.mix.yes, trained: { family: d.trained.family, seed: d.trained.seed, blocks: d.trained.blocks } };
  const tag = encodeTag(situationOf(sit));
  const back = decodeTag(tag);
  assert.deepEqual(back.trained, sit.trained);
  assert.ok(tagLines(back).some(([k]) => k === 'trained set'));
  const plain = decodeTag(encodeTag(situationOf({ ...sit, trained: null })));
  assert.equal(plain.trained, null);
  assert.ok(!tagLines(plain).some(([k]) => k === 'trained set'));
  // a replay: a fresh brain with the models plays the same trained bar
  const other = createHouseDJ({ seed: 77, theme: 'crystals', trained: models });
  other.load(back, null);
  const r = other.bar({ theme: 'highlands' });
  assert.equal(r.brain, 'trained');
  assert.equal(r.trained.family, d.trained.family);
  assert.equal(r.plan.setBar, d.plan.setBar);
  assert.deepEqual(r.trained.groove, d.trained.groove, 'the same settled bar as the one the tag was taken on');
  assert.deepEqual(r.trained.layers, d.trained.layers);
});

test('THE LAYERS play a trained bar: the settled steps through the kit, the turnaround, only finite values', () => {
  configure({ createContext: () => new Ctx() });
  const E = unlockNow();
  const dj = createHouseDJ({ seed: 3, theme: 'embers', trained: models });
  const set = createMixSet(E.ctx, E.ctx.destination, { seed: 3 });
  const before = writes.length;
  let drumBars = 0;
  let turns = 0;
  for (let b = 0; b < 64; b++) {
    const d = dj.bar({ theme: 'embers' });
    const st = set.bar(1 + 2 * b, d, 0.5);
    if (st.trained?.drums) drumBars += 1;
    if (st.trained?.turn) turns += 1;
    E.ctx.currentTime += 2;
  }
  assert.ok(drumBars > 10, 'the drums played the trained bars');
  assert.ok(writes.slice(before).every(Number.isFinite));
  set.dispose();
  // the drum player itself: the hits, the swing and the played feel
  const kit = DRUM_KITS['909'];
  const groove = { steps: { kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], snare: Array(16).fill(0), hats: Array(16).fill(0.5), perc: Array(16).fill(0) }, hats: 'c'.repeat(16), crash: true };
  assert.equal(playTrainedDrums(E.ctx, E.ctx.destination, 10, 0.5, groove, { kit, energy: 1 }), 20);
  assert.equal(playTrainedDrums(E.ctx, E.ctx.destination, 10, 0.5, null, { kit }), 0);
  assert.equal(trainedJitter(3, 'kick', 2, 0), 0, 'a programmed set has no offset');
  const j = trainedJitter(3, 'kick', 2, 0.1);
  assert.ok(Math.abs(j) <= 0.45 && j === trainedJitter(3, 'kick', 2, 0.1), 'a played set: bounded, the same every play');
});

test('THE BRAIN STORE: trained by default, a second store is separate, an unknown mode is refused', () => {
  assert.equal(djBrain.get(), 'trained');
  const s = createBrainStore('old');
  const seen = [];
  const off = s.subscribe((m) => seen.push(m));
  s.set('banana');
  s.set('trained');
  s.set('trained');
  off();
  s.set('old');
  assert.deepEqual(seen, ['trained']);
  assert.equal(djBrain.get(), 'trained', 'the page store did not move');
});

test('THE HERO SYMPHONY with the brain store: the models load lazily, the sets are trained on THE MASTER BEAT, the tag carries them, the A/B switch and MUTE ALL work', async () => {
  const { createSymphony, sound, djLive } = await import('../src/index.js');
  configure({ createContext: () => new Ctx() });
  const store = createBrainStore('trained');
  // the live-settle path (lane PIECESPLAY's pieces are off here; tests/piecesplay.test.mjs runs the symphony with them on)
  const s = createSymphony({ seed: 8, theme: 'embers', auto: false, house: true, steer: null, votes: null, djBrain: store, pieces: false });
  const E = unlockNow();
  await loadTrainedModels();
  await new Promise((r) => setTimeout(r, 0));
  writes.length = 0;
  for (let k = 0; k < 40; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  let st = s.state;
  assert.equal(st.mix.brain, 'trained', 'the hero plays a trained set');
  assert.ok(['techno', 'breaks', 'house'].includes(st.mix.trained.family));
  assert.equal(st.bpm, 120, 'on THE MASTER BEAT: 120 bpm, a 2 s bar');
  assert.deepEqual(decodeTag(st.tag).trained?.family, st.mix.trained.family, 'the tag carries the trained set');
  assert.equal(djLive.get().brain, 'trained');
  assert.ok(writes.every(Number.isFinite));
  // THE A/B SWITCH: the old DJ composes the next set, from the next bar
  store.set('old');
  for (let k = 0; k < 8; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  st = s.state;
  assert.equal(st.mix.brain, 'old');
  assert.equal(st.mix.trained, null);
  assert.equal(decodeTag(st.tag).trained, null, 'an old set\'s tag carries no trained set');
  store.set('trained');
  for (let k = 0; k < 8; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  assert.equal(s.state.mix.brain, 'trained');
  // MUTE ALL still silences it: the engine's mute gain goes to zero and nothing non-finite is written
  sound.setMuted(true);
  for (let k = 0; k < 8; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  assert.equal(s.state.audible, false, 'muted: not audible');
  assert.ok(writes.every(Number.isFinite));
  sound.setMuted(false);
  s.dispose();
  // without the store the symphony keeps the old DJ
  const plain = createSymphony({ seed: 8, theme: 'embers', auto: false, house: true, steer: null, votes: null });
  for (let k = 0; k < 16; k++) { E.ctx.currentTime += 0.5; plain.tick(); }
  assert.equal(plain.state.mix.brain, 'old');
  plain.dispose();
});

test('THE STAGE-3 SEAM: a djnotes-piece/v1 becomes a trained set with its drums, its key moved to the theme, and its notes played bar by bar', async () => {
  const { pieceToSet, notesOfBar, isPiece, shiftTo, PIECE_FORMAT } = await import('../src/dj-trained-notes.js');
  const roles = models.roles;
  const bars = 16;
  const grid = roles.map((r) => [1, 1]);
  const drumsNotes = [];
  for (let b = 0; b < bars; b++) for (const i of [0, 4, 8, 12]) drumsNotes.push([16 * b + i, 1, 36, 120]);
  for (let b = 0; b < bars; b++) { drumsNotes.push([16 * b + 4, 1, 39, 100]); drumsNotes.push([16 * b + 2, 1, 46, 80]); }
  const piece = {
    format: PIECE_FORMAT, id: 'test-piece-1', name: 'test piece', family: 'house', bpm: 124, steps_per_bar: 16, bars, swing: 0.17,
    key: { tonic: 9, tonic_name: 'A', mode: 'minor' }, roles, grid, gates: [1, 0], arc: [0, 0.5],
    events_order: models.events, events: models.events.map(() => '.'.repeat(8 * 2)), chords: [], chord_names: [],
    tracks: [
      { name: 'drums', channel: 9, program: 0, notes: drumsNotes },
      { name: 'bass', channel: 0, program: 38, notes: [[0, 2, 45, 100], [18, 2, 45, 90]] },
      { name: 'arp', channel: 1, program: 81, notes: [[2, 1, 69, 80], [3, 1, 72, 80]] },
      { name: 'chords', channel: 2, program: 89, notes: [[0, 16, 57, 70], [0, 16, 60, 70], [0, 16, 64, 70]] },
    ],
  };
  assert.ok(isPiece(piece));
  assert.equal(isPiece({ ...piece, tracks: null }), false);
  assert.equal(shiftTo(9, 9), 0);
  assert.equal(shiftTo(9, 7), -2);
  assert.equal(shiftTo(0, 7), -5);
  const set = pieceToSet(piece, { shift: -2, seed: 4 });
  assert.equal(set.blocks, 2);
  assert.equal(set.steps.length, 16);
  assert.equal(set.steps[0][0], '9...9...9...9...', 'the kick at its velocity, as ninths');
  assert.equal(set.steps[0][1][4], '7', 'the clap on 2 in the snare role');
  assert.equal(set.clap, true);
  assert.equal(set.hats[0][2], 'o', 'an open hat by its pitch');
  assert.equal(set.feel.swing, 0.17);
  assert.equal(set.notes.bass[0][2], 43, 'the bass moved down two semitones to the theme');
  assert.deepEqual(notesOfBar(set.notes, 1).bass, [[2, 2, 43, 90]], 'a note at its step inside its bar');
  assert.deepEqual(notesOfBar(set.notes, 0).arp.map((n) => n[0]), [2, 3]);
  // the brain plays a piece of the dealt family, and the layers play its notes
  const dj = createHouseDJ({ seed: 5, theme: 'highlands', trained: models, pieces: [piece, { ...piece, id: 'test-piece-2', family: 'trance' }] });
  // a family's deck holds its piece and one live-settle card (lane PIECESPLAY), so a piece comes within two deals
  let d = dj.bar({ theme: 'highlands' });
  for (let k = 0; k < 6 && !d.trained?.piece; k++) { dj.nextSet(); d = dj.bar({ theme: 'highlands' }); }
  assert.ok(d.trained.piece, 'a highlands set dealt a family that has a piece plays the piece');
  assert.ok(d.trained.notes && Array.isArray(d.trained.notes.bass));
  configure({ createContext: () => new Ctx() });
  const E = unlockNow();
  const mix = createMixSet(E.ctx, E.ctx.destination, { seed: 2 });
  const before = writes.length;
  const st = mix.bar(1, { ...d, mix: { ...d.mix, yes: { ...d.mix.yes, bass: true, arps: true, pad: true, drums: true } } }, 0.5);
  assert.ok(st.trained.notes, 'the layers name the piece notes they played');
  assert.ok(writes.slice(before).every(Number.isFinite));
  mix.dispose();
  // THE PIECE IN THE TAG (lane HEROPASS): a piece's set names the piece and its shift, so a replay plays the same piece
  const pieces = [piece, { ...piece, id: 'test-piece-2', family: 'trance' }];
  const sit = { theme: 'highlands', section: d.section, setBar: d.plan.setBar, set: d.plan.set, layers: d.mix.yes, trained: { family: d.trained.family, seed: d.trained.seed, blocks: d.trained.blocks, piece: { id: d.trained.piece.id, shift: d.trained.piece.shift } } };
  const tag = encodeTag(situationOf(sit));
  const back = decodeTag(tag, { pieces });
  const pid = d.trained.piece.id;
  assert.equal(back.trained.piece.id, pid, 'the tag names the piece');
  assert.equal(back.trained.piece.shift, d.trained.piece.shift, 'and the semitones it was moved by');
  assert.match(tagLines(back).find(([k]) => k === 'trained set')[1], /the piece test piece/, 'the parts popover names it');
  const other = createHouseDJ({ seed: 77, theme: 'crystals', trained: models, pieces });
  other.load(decodeTag(tag), null);
  const r = other.bar({ theme: 'highlands' });
  assert.equal(r.brain, 'trained');
  assert.equal(r.trained.piece?.id, pid, 'the replay plays the same piece, found by the hash alone');
  assert.deepEqual(r.trained.notes, d.trained.notes, 'the same notes, moved the same way');
  // a brain without that piece does not settle another set under the piece's tag
  const bare = createHouseDJ({ seed: 77, theme: 'crystals', trained: models });
  bare.load(decodeTag(tag), null);
  assert.notEqual(bare.bar({ theme: 'highlands' }).trained?.piece?.id, pid);
  // a settled set's tag carries no piece, and an older tag (no piece bits) still reads
  const plainTrained = decodeTag(encodeTag(situationOf({ ...sit, trained: { ...sit.trained, piece: null } })));
  assert.equal(plainTrained.trained.piece, undefined);
  assert.equal(decodeTag(encodeTag(situationOf({ theme: 'highlands', trained: null }))).trained, null);
});
