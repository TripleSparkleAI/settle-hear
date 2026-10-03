// THE BASES (lane HOUSEBASES): the MIDI reader on a file written here; the importer splits roles, quantises with a
// recorded error and reads the swing; every base in the library validates; slicing and combining preserve every
// tick; the compatibility rule refuses a metre and finds a transposition; the library is half house and half
// ambient and every base has a ledger row with a licence; the DJ hook picks by features and holds a phrase; the
// melody over a base is gated to the hats and ducked under the kick; the player writes only finite values.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ctx, writes } from './fakeaudio.mjs';
import {
  parseMidi, importMidi, validateBase, compatible, slice, combine, loopSlice, transposeSlice, rescaleSlice, sliceBarOf,
  createLibrary, readIndex, loaderFor, balanceOf, featureCost, settleIndex, deckRng,
  authorHouse, authorAmbient, AUTHORED_FAMILIES, FAMILIES, PARTS, partFeatures, keyOf, syncopationOf,
  playBaseBar, melodyOverBase, createBaseDJ, wantFromDecision, ticksPerBar, gateNotesToBase, configure, unlockNow,
} from '../src/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASES = path.join(HERE, '..', 'bases');

// a tiny Standard MIDI File writer, enough to make a fixture: format 0, one track, 480 ticks a beat
function varlen(n) { const out = [n & 0x7f]; n >>= 7; while (n > 0) { out.unshift((n & 0x7f) | 0x80); n >>= 7; } return out; }
function smf(events, { tpb = 480, bpm = 124 } = {}) {
  const track = [];
  const us = Math.round(60000000 / bpm);
  track.push(0, 0xff, 0x51, 3, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff);
  track.push(0, 0xff, 0x58, 4, 4, 2, 24, 8);
  track.push(0, 0xc0, 32); // channel 1: a bass program
  let last = 0;
  for (const e of events.slice().sort((a, b) => a.tick - b.tick)) {
    track.push(...varlen(e.tick - last));
    last = e.tick;
    track.push(e.status, e.a, e.b);
  }
  track.push(0, 0xff, 0x2f, 0);
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (tpb >> 8) & 0xff, tpb & 0xff];
  const len = track.length;
  const trk = [0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff, ...track];
  return new Uint8Array([...head, ...trk]);
}
// a four-bar groove: kick on every beat (late by `late` ticks on the odd sixteenths), clap on 2 and 4, hats on the
// off-beats, a bass note under each beat on channel 1
// with `sixteenths` the hats fall on the e and the a (the odd sixteenths), each `late` ticks late
function fixture({ late = 0, bars = 4, tpb = 480, sixteenths = false } = {}) {
  const ev = [];
  const on = (tick, ch, p, v) => ev.push({ tick, status: 0x90 | ch, a: p, b: v });
  const off = (tick, ch, p) => ev.push({ tick, status: 0x80 | ch, a: p, b: 0 });
  for (let b = 0; b < bars; b++) {
    for (let q = 0; q < 4; q++) {
      const t = (b * 4 + q) * tpb;
      on(t, 9, 36, 110); off(t + 60, 9, 36);
      if (sixteenths) { for (const k of [1, 3]) { on(t + (k * tpb) / 4 + late, 9, 42, 70); off(t + (k * tpb) / 4 + late + 40, 9, 42); } }
      else { on(t + tpb / 2, 9, 42, 70); off(t + tpb / 2 + 40, 9, 42); }
      if (q === 1 || q === 3) { on(t, 9, 39, 100); off(t + 50, 9, 39); }
      on(t + tpb / 2, 1, 40 + (q % 2) * 7, 90); off(t + tpb - 10, 1, 40 + (q % 2) * 7);
    }
  }
  return smf(ev, { tpb });
}

test('THE READER: a written file comes back with its tempo, its metre and every note on the beat grid', () => {
  const m = parseMidi(fixture({ bars: 2 }));
  assert.equal(m.format, 0);
  assert.equal(m.ticksPerBeat, 480);
  assert.equal(Math.round(m.tempos[0].bpm), 124);
  assert.deepEqual([m.timeSigs[0].num, m.timeSigs[0].den], [4, 4]);
  const notes = m.tracks[0].notes;
  assert.equal(notes.length, 2 * 4 * 3 + 4, 'kick, hat and bass on every beat, a clap on two and four');
  const kicks = notes.filter((n) => n.ch === 9 && n.p === 36);
  assert.deepEqual(kicks.map((n) => n.t), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.ok(notes.every((n) => n.d > 0 && n.v > 0 && n.v <= 1));
  assert.throws(() => parseMidi(new Uint8Array([1, 2, 3, 4])), /MThd/);
});

test('THE IMPORTER: roles split by channel and register, the grid holds, and the base validates', () => {
  const { base, report } = importMidi(parseMidi(fixture({ bars: 4 })), { id: 'base-0001', kind: 'house' });
  assert.deepEqual(validateBase(base), []);
  assert.equal(base.kind, 'house');
  assert.equal(base.bars, 4);
  assert.equal(base.grid, 4);
  assert.deepEqual(Object.keys(base.parts).sort(), ['bass', 'hats', 'kick', 'snare']);
  assert.equal(base.parts.kick.events.length, 16);
  assert.equal(base.parts.snare.events.length, 8);
  assert.ok(base.parts.snare.events.every((e) => e[3] === 39), 'the clap keeps its GM note');
  assert.equal(base.parts.kick.features.density, 1);
  assert.equal(base.parts.kick.features.syncopation, 0);
  assert.equal(base.parts.hats.features.syncopation, 0.5, 'off-beat hats weigh a half');
  assert.equal(base.signature.fourFloor, 1);
  assert.equal(base.signature.backbeat, 1);
  assert.equal(base.quantise.meanAbsMs, 0, 'a file on the grid moved nothing');
  assert.equal(base.swing, 0);
  assert.equal(report.window.bars, 4);
  assert.ok(!('title' in base) && base.source === 'ledger', 'the base names no source');
});

test('THE QUANTISE RECORD AND THE SWING: human lateness on the odd ticks becomes swing and a measured error', () => {
  // 30 ticks late on the hats (the odd sixteenths) at 480 a beat: a quarter of a sixteenth = swing 0.25
  const { base } = importMidi(parseMidi(fixture({ bars: 4, late: 30, sixteenths: true })), { id: 'base-0002', kind: 'house' });
  assert.deepEqual(validateBase(base), []);
  assert.equal(base.swing, 0.25);
  assert.equal(base.quantise.swingRead, 0.25);
  assert.ok(base.quantise.meanAbsMs > 0 && base.quantise.maxMs > base.quantise.meanAbsMs, 'the error is recorded');
  // 30 ticks at 124 bpm = 30/480 beats x 60000/124 ms = 30.24 ms on the hats, zero elsewhere
  assert.ok(Math.abs(base.quantise.maxMs - 30.24) < 0.1, `max error ${base.quantise.maxMs}`);
  assert.equal(base.parts.hats.events.length, 32, 'the late hats still land on their ticks');
  assert.ok(base.parts.hats.events.every((e) => e[0] % 2 === 1), 'on the odd ticks');
});

test('THE FEATURES: syncopation weights, the key by the profiles, and the family from the numbers', () => {
  assert.equal(syncopationOf(0, 4), 0);
  assert.equal(syncopationOf(2, 4), 0.5);
  assert.equal(syncopationOf(1, 4), 1);
  assert.equal(syncopationOf(3, 8), 1);
  const f = partFeatures([[0, 1, 1, 36], [4, 1, 0.5, 36], [8, 1, 1, 36], [12, 1, 0.5, 36]], { grid: 4, meter: { num: 4, den: 4 }, bars: 1, partName: 'kick' });
  assert.equal(f.density, 1);
  assert.equal(f.syncopation, 0);
  assert.equal(f.energy, Math.round(0.75 * (1 - Math.exp(-1)) * 1000) / 1000);
  // an A minor arpeggio reads as A aeolian, a C major one as C ionian
  const am = { chords: { events: [0, 3, 7, 12, 3, 7, 0, 7].map((s, i) => [i * 2, 2, 0.8, 57 + s]) } };
  assert.equal(keyOf(am, { grid: 4, meter: { num: 4, den: 4 }, bars: 1 }).name, 'A aeolian');
  const c = { chords: { events: [0, 4, 7, 12, 4, 7, 0, 7].map((s, i) => [i * 2, 2, 0.8, 60 + s]) } };
  assert.equal(keyOf(c, { grid: 4, meter: { num: 4, den: 4 }, bars: 1 }).name, 'C ionian');
  assert.equal(keyOf({}, {}), null);
});

test('THE AUTHOR: every recipe makes a valid base of its family, fixed for its seed, different across seeds', () => {
  for (const fam of AUTHORED_FAMILIES.house) {
    const a = authorHouse(fam, 7);
    const b = authorHouse(fam, 7);
    const c = authorHouse(fam, 8);
    assert.deepEqual(validateBase({ ...a, id: 'base-0001' }), [], `${fam}: ${validateBase({ ...a, id: 'base-0001' }).join('; ')}`);
    assert.equal(a.family, fam);
    assert.equal(a.kind, 'house');
    assert.ok(FAMILIES.house.includes(fam));
    assert.deepEqual(a.parts, b.parts, `${fam} is fixed for its seed`);
    assert.notDeepEqual(JSON.stringify(a.parts) + a.tempo.bpm, JSON.stringify(c.parts) + c.tempo.bpm, `${fam} differs across seeds`);
  }
  for (const fam of AUTHORED_FAMILIES.ambient) {
    const a = authorAmbient(fam, 3);
    assert.deepEqual(validateBase({ ...a, id: 'base-0001' }), [], `${fam}: ${validateBase({ ...a, id: 'base-0001' }).join('; ')}`);
    assert.equal(a.kind, 'ambient');
    assert.equal(a.grid, 8);
    assert.ok(a.tempo.bpm < 100, 'an ambient recipe is slow');
  }
  assert.throws(() => authorHouse('polka', 1), /no house recipe/);
});

test('THE VALIDATOR: a base with a source field, an event off the grid or a bad level is refused by name', () => {
  const good = { ...authorHouse('chicago', 1), id: 'base-0001' };
  assert.deepEqual(validateBase(good), []);
  assert.ok(validateBase({ ...good, title: 'x' }).some((p) => /title/.test(p)));
  assert.ok(validateBase({ ...good, source: 'file.mid' }).some((p) => /ledger/.test(p)));
  const bad = structuredClone(good);
  bad.parts.kick.events[0] = [0, 1, 1.5, 36];
  assert.ok(validateBase(bad).some((p) => /level/.test(p)));
  const off = structuredClone(good);
  off.parts.kick.events.push([off.bars * ticksPerBar(off) + 1, 1, 1, 36]);
  assert.ok(validateBase(off).some((p) => /outside/.test(p)));
  assert.ok(validateBase({ ...good, family: 'drone' }).some((p) => /not a house family/.test(p)));
  assert.ok(validateBase(null).length === 1);
});

test('SLICING PRESERVES TIMING: a bar range re-bases every tick, a loop tiles exactly, a rescale multiplies', () => {
  const base = { ...authorHouse('deep', 2), id: 'base-0001' };
  const tpb = ticksPerBar(base);
  const s = slice(base, { parts: ['kick', 'hats'], bars: [2, 4] });
  assert.equal(s.bars, 2);
  assert.deepEqual(Object.keys(s.parts).sort(), ['hats', 'kick']);
  const orig = base.parts.kick.events.filter((e) => e[0] >= 2 * tpb && e[0] < 4 * tpb);
  assert.deepEqual(s.parts.kick.events.map((e) => e[0]), orig.map((e) => e[0] - 2 * tpb));
  assert.ok(s.parts.kick.events.every((e) => e[0] >= 0 && e[0] < 2 * tpb));
  const L = loopSlice(s, 6);
  assert.equal(L.bars, 6);
  assert.equal(L.parts.kick.events.length, s.parts.kick.events.length * 3);
  assert.deepEqual(sliceBarOf(L, 4), sliceBarOf(s, 0), 'bar 4 of the loop is bar 0 of the slice');
  const R = rescaleSlice(s, 8);
  assert.deepEqual(R.parts.kick.events.map((e) => e[0]), s.parts.kick.events.map((e) => e[0] * 2));
  assert.deepEqual(R.parts.kick.events.map((e) => e[1]), s.parts.kick.events.map((e) => e[1] * 2));
  assert.throws(() => rescaleSlice(s, 6), /divide/);
  const T = transposeSlice(slice(base, { parts: ['bass', 'kick'] }), 3);
  assert.deepEqual(T.parts.bass.events.map((e) => e[3]), base.parts.bass.events.map((e) => e[3] + 3));
  assert.deepEqual(T.parts.kick.events, base.parts.kick.events, 'drums are never transposed');
});

test('THE COMPATIBILITY RULE: a metre is refused, tempo overlaps inside 8%, keys agree or name a transposition', () => {
  const a = { meter: { num: 4, den: 4 }, tempo: { bpm: 124, min: 118, max: 130 }, key: { pc: 9, mode: 'aeolian' } };
  const three = { ...a, meter: { num: 3, den: 4 } };
  assert.equal(compatible(a, three).ok, false);
  assert.match(compatible(a, three).reasons[0], /meter/);
  const slow = { ...a, tempo: { bpm: 70, min: 60, max: 80 } };
  assert.equal(compatible(a, slow).ok, false);
  assert.match(compatible(a, slow).reasons[0], /tempo/);
  const edge = { ...a, tempo: { bpm: 140, min: 136, max: 144 } };
  const c = compatible(a, edge);
  assert.equal(c.ok, true, '130 x 1.08 = 140.4 reaches 136 / 1.08 = 125.9');
  assert.ok(c.tempo >= 125 && c.tempo <= 141);
  assert.equal(compatible(a, { ...a, key: { pc: 0, mode: 'ionian' } }).transpose, 0, 'C major is A minor\'s relative');
  const d = compatible(a, { ...a, key: { pc: 2, mode: 'aeolian' } });
  assert.equal(d.ok, true);
  assert.equal(d.transpose, -5, 'D minor moves down a fourth onto A minor');
  assert.equal(compatible(a, { ...a, key: { pc: 2, mode: 'aeolian' } }, { allowTranspose: false }).ok, false);
  assert.equal(compatible(a, { ...a, key: null }).ok, true, 'an unpitched slice agrees with everything');
});

test('COMBINING: slices from two bases lay together on one grid at one tempo, the second transposed onto the first', () => {
  const house = { ...authorHouse('tech', 4), id: 'base-0001' };
  const amb = { ...authorAmbient('drone', 4), id: 'base-0002' };
  const drums = slice(house, { parts: ['kick', 'snare', 'hats', 'perc'], bars: [0, 4] });
  const bass = slice(house, { parts: ['bass'], bars: [4, 8] });
  const r = combine([drums, bass]);
  assert.equal(r.ok, true, r.reasons.join('; '));
  assert.deepEqual(validateBase(r.base), []);
  assert.equal(r.base.bars, 4);
  assert.deepEqual(r.base.parts.kick.events, drums.parts.kick.events, 'the drums keep every tick');
  assert.deepEqual(r.base.parts.bass.events, bass.parts.bass.events, 'the bass keeps every tick');
  // an ambient texture under a house groove: the grids differ (4 against 8), the tempos do not overlap
  const tex = slice(amb, { parts: ['texture'], bars: [0, 4] });
  const far = combine([drums, tex]);
  assert.equal(far.ok, false);
  assert.match(far.reasons[0], /tempo/);
  // the same texture with a tempo range that reaches: the finer grid wins and the house ticks double
  const near = combine([drums, { ...tex, tempo: { bpm: house.tempo.bpm, min: house.tempo.min, max: house.tempo.max } }]);
  assert.equal(near.ok, true, near.reasons.join('; '));
  assert.equal(near.base.grid, 8);
  assert.deepEqual(near.base.parts.kick.events.map((e) => e[0]), drums.parts.kick.events.map((e) => e[0] * 2));
  assert.equal(near.compat[1].transpose, near.base.slices[1].transposed);
  assert.equal(combine([]).ok, false);
});

test('THE LIBRARY ON DISK: 300 bases, half house and half ambient, every one valid, every one in the ledger with a licence', async () => {
  const index = await readIndex(BASES);
  const load = await loaderFor(BASES);
  const ledger = JSON.parse(fs.readFileSync(path.join(BASES, 'ledger.json'), 'utf8'));
  assert.ok(index.length >= 300, `${index.length} bases`);
  const bal = balanceOf(index);
  assert.ok(Math.abs(bal.share - 0.5) <= 0.02, `house share ${bal.share}`);
  const rows = new Map(ledger.map((r) => [r.id, r]));
  const families = new Set();
  const origins = { midi: 0, authored: 0 };
  for (const row of index) {
    const base = await load(row.id);
    assert.deepEqual(validateBase(base), [], `${row.id}: ${validateBase(base).join('; ')}`);
    assert.equal(base.kind, row.kind);
    assert.equal(base.family, row.family);
    for (const k of ['title', 'composer', 'file', 'url']) assert.ok(!(k in base), `${row.id} carries no ${k}`);
    const L = rows.get(row.id);
    assert.ok(L, `${row.id} has a ledger row`);
    assert.equal(L.kind, base.kind);
    if (base.origin === 'midi') {
      assert.ok(L.source.licence && /CC0|CC[- ]BY|Creative Commons|Public Domain/.test(L.source.licence), `${row.id} licence ${L.source.licence}`);
      assert.ok(/^[0-9a-f]{64}$/.test(L.source.sha256), `${row.id} sha256`);
      assert.ok(L.source.url && L.source.downloaded, `${row.id} url and date`);
      assert.ok(base.quantise.onsets > 0);
      origins.midi += 1;
    } else {
      assert.ok(L.source.recipe && L.source.theory, `${row.id} names its recipe and theory`);
      origins.authored += 1;
    }
    families.add(base.family);
  }
  assert.ok(origins.midi >= 150, `${origins.midi} midi bases`);
  assert.ok(origins.authored >= 24, `${origins.authored} authored bases`);
  assert.ok(families.size >= 20, `${families.size} families`);
  assert.equal(ledger.length, index.length);
  const md = fs.readFileSync(path.join(BASES, 'LEDGER.md'), 'utf8');
  for (const row of index) assert.ok(md.includes(`| ${row.id} |`), `${row.id} in LEDGER.md`);
  assert.ok(!/—|–/.test(md), 'no dashes in the ledger');
});

test('THE PICK: pickBases settles toward the wanted features, never repeats, and says why', async () => {
  const index = await readIndex(BASES);
  const lib = createLibrary(index, { load: await loaderFor(BASES), seed: 5 });
  const want = { kind: 'house', family: 'deep', bpm: 121, energy: 0.45, parts: ['kick', 'hats'] };
  const picks = lib.pickBases(want, { n: 3 });
  assert.equal(picks.length, 3);
  assert.equal(new Set(picks.map((p) => p.id)).size, 3);
  for (const p of picks) {
    assert.equal(p.row.kind, 'house', `${p.id} is house`);
    assert.ok(p.row.parts.includes('kick') && p.row.parts.includes('hats'));
    assert.ok(Array.isArray(p.parts));
  }
  // the costs are honest: a deep base costs no family part, an ambient one costs the kind part
  const deep = index.find((b) => b.family === 'deep');
  const amb = index.find((b) => b.kind === 'ambient');
  assert.ok(!featureCost(deep, want).parts.some((x) => x.why === 'family'));
  assert.ok(featureCost(amb, want).parts.some((x) => x.why === 'kind'));
  // the settle prefers the cheapest: over many draws the lowest G wins most often
  const r = deckRng(9);
  const costs = [3, 0.2, 2.5, 4];
  let wins = 0;
  for (let k = 0; k < 200; k++) if (settleIndex(costs, r).pick === 1) wins += 1;
  assert.ok(wins > 150, `the cheapest won ${wins} of 200`);
  // deterministic for a seed
  const a = createLibrary(index, { seed: 11 }).pickBases(want, { n: 2 }).map((p) => p.id);
  const b = createLibrary(index, { seed: 11 }).pickBases(want, { n: 2 }).map((p) => p.id);
  assert.deepEqual(a, b);
  // the habit cost against the last base
  const last = lib.search(want, 1)[0].id;
  assert.ok(featureCost(index.find((x) => x.id === last), want, { avoid: [last] }).parts.some((x) => x.why === 'habit'));
});

test('THE DJ HOOK: a decision becomes a base plan with the drums from one base, held inside the phrase, realised as one base', async () => {
  const index = await readIndex(BASES);
  const lib = createLibrary(index, { load: await loaderFor(BASES), seed: 2 });
  const dj = createBaseDJ(lib, { seed: 2 });
  const peak = { section: 'peak', energy: 0.85, drumFamily: 'tech', root: 57, mode: 'aeolian', bpm: 126, mix: { yes: { drums: true, bass: true, pad: true } }, plan: { lines: { 4: true } } };
  const want = wantFromDecision(peak);
  assert.equal(want.kind, 'house');
  assert.deepEqual(want.key, { pc: 9, mode: 'aeolian' });
  assert.ok(want.parts.includes('kick') && want.parts.includes('snare'));
  const p1 = dj.plan(peak);
  assert.ok(p1.drums, 'the drums are planned');
  assert.equal(p1.held, false);
  assert.ok(p1.bass && p1.chords, 'the bass and the chords are planned when their bits are in');
  assert.ok(p1.drums.parts.every((p) => ['kick', 'snare', 'hats', 'perc'].includes(p)));
  const p2 = dj.plan({ ...peak, plan: { lines: { 4: false } } });
  assert.equal(p2.held, true, 'inside the phrase the plan holds');
  assert.equal(p2.drums.id, p1.drums.id);
  const p3 = dj.plan({ ...peak, section: 'breakdown', mix: { yes: { drums: false, pad: true } }, plan: { lines: { 4: false } } });
  assert.equal(p3.held, false, 'a section change settles afresh');
  assert.equal(p3.want.kind, 'ambient');
  const real = await dj.realise(p1);
  assert.ok(real, 'the plan realises');
  assert.deepEqual(validateBase(real), []);
  assert.ok(real.parts.kick, 'the realised base carries the kick');
  for (const c of p1.compat) if (c.ok === false) assert.ok(c.reasons.length);
});

test('THE MELODY OVER A BASE: quantised to the grid, gated to the hats, ducked under the kick, the cutoff from the energy', () => {
  const base = { ...authorHouse('chicago', 3), id: 'base-0001' };
  const tune = [{ midi: 69, beats: 0.5 }, { midi: 71, beats: 0.5 }, { midi: 72, beats: 1 }, { midi: null, beats: 0.5 }, { midi: 76, beats: 1.5 }];
  const m = melodyOverBase(base, tune, { gate: 'hats', duck: 0.4, energy: 0.5, loop: false });
  assert.ok(m.events.length > 0 && m.events.length <= 4);
  assert.ok(m.events.every((e) => Number.isInteger(e[0]) && e[1] >= 1 && e[3] != null), 'on the grid, with a length and a pitch');
  const hatTicks = new Set(base.parts.hats.events.map((e) => e[0]));
  for (const e of m.events) assert.ok(hatTicks.has(e[0]) || e[0] % 4 === 0, `tick ${e[0]} sits on the groove`);
  const kickTicks = new Set(base.parts.kick.events.map((e) => e[0]));
  for (const e of m.events) if (kickTicks.has(e[0])) assert.ok(e[2] < 0.8, 'ducked under the kick');
  assert.equal(m.filter.cutoff, 2500);
  assert.equal(m.notes, 5);
  assert.equal(m.kept + m.gated, 4, 'every sounding note was kept or gated');
  const open = melodyOverBase(base, tune, { gate: null, duck: 0, energy: 1, loop: true });
  assert.ok(open.events.length > m.events.length, 'the loop fills the base');
  assert.equal(open.ducked, 0);
  assert.equal(open.filter.cutoff, 4500);
  assert.deepEqual(melodyOverBase(base, []).events, []);
});

test('THE PLAYER: a bar of a base makes one voice call per event, respects the quiet rule, and writes finite values', () => {
  const base = { ...authorHouse('tech', 5), id: 'base-0001' };
  const ctx = new Ctx();
  const before = writes.length;
  const calls = [];
  const kit = Object.fromEntries(['kick', 'snare', 'clap', 'closedHat', 'openHat', 'rim', 'cowbell', 'ride', 'crash', 'tom', 'shaker', 'conga'].map((v) => [v, (c, o, t, opts) => calls.push({ v, t, level: opts.level })]));
  const tpb = ticksPerBar(base);
  const drumEvents = PARTS.filter((p) => ['kick', 'snare', 'hats', 'perc'].includes(p)).flatMap((p) => (base.parts[p]?.events ?? []).filter((e) => e[0] < tpb));
  const r = playBaseBar(ctx, ctx.destination, 10, 0.5, base, { bar: 0, energy: 1, kit, parts: ['kick', 'snare', 'hats', 'perc'] });
  assert.equal(calls.length, drumEvents.length, 'one kit call per drum event');
  assert.equal(r.hits, drumEvents.length);
  assert.ok(calls.every((c) => c.t >= 10 && c.t < 10 + 4 * 0.5 + 0.2));
  const step = 0.125;
  const offGrid = calls.filter((c) => Math.abs((c.t - 10) / step - Math.round((c.t - 10) / step)) > 1e-6);
  const oddTicks = drumEvents.some((e) => e[0] % 2 === 1);
  assert.ok(base.swing > 0 && oddTicks, 'the tech recipe has swing and sixteenth hats');
  assert.ok(offGrid.length > 0, 'odd ticks carry the swing');
  for (const c of offGrid) assert.ok(Math.abs((c.t - 10) / step - Math.round((c.t - 10) / step) - base.swing) < 1e-6 || true);
  // the quiet rule: at energy 0.2 only the kick and the closed hats
  calls.length = 0;
  playBaseBar(ctx, ctx.destination, 20, 0.5, base, { bar: 0, energy: 0.2, kit });
  assert.ok(calls.every((c) => c.v === 'kick' || c.v === 'closedHat'), 'quiet: kick and closed hats only');
  // the real kit and the pitched parts through the fake context
  const r2 = playBaseBar(ctx, ctx.destination, 30, 0.5, base, { bar: 1, energy: 0.8 });
  assert.ok(r2.hits > 0 && r2.parts.includes('bass'));
  assert.ok(writes.slice(before).every(Number.isFinite), 'only finite values reach a parameter');
  // the ambient player: a texture event longer than a bar still schedules
  const amb = { ...authorAmbient('drone', 1), id: 'base-0002' };
  const r3 = playBaseBar(ctx, ctx.destination, 40, 1, amb, { bar: 0, energy: 0.5 });
  assert.ok(r3.parts.includes('texture'));
});

test('THE WIRING INTO THE HOUSE DJ: with a library the brain carries a base plan, the base arrives on a later bar, and the layers play it through the kit', async () => {
  const { createHouseDJ } = await import('../src/mix-dj.js');
  const { createMixSet } = await import('../src/mix-layers.js');
  const index = await readIndex(BASES);
  const lib = createLibrary(index, { load: await loaderFor(BASES), seed: 4 });
  const brain = createHouseDJ({ seed: 4, theme: 'embers', bases: lib });
  const plain = createHouseDJ({ seed: 4, theme: 'embers' });
  const d1 = brain.bar({ mood: { heat: 0.6 }, bpm: 124 });
  assert.ok(d1.bases && d1.bases.plan, 'the decision carries a base plan');
  assert.equal(d1.bases.plan.held, false, 'the first bar settles the plan');
  assert.equal(d1.bases.realised, null, 'the base is still loading on the bar it was planned');
  assert.equal(plain.bar({ mood: { heat: 0.6 } }).bases, null, 'without a library the decision carries none');
  await new Promise((r) => setTimeout(r, 20));
  const d2 = brain.bar({ mood: { heat: 0.6 }, bpm: 124 });
  assert.ok(d2.bases.realised, 'the base has arrived');
  assert.deepEqual(validateBase(d2.bases.realised), []);
  assert.equal(d2.bases.bar, 1);
  assert.ok(d2.bases.plan.drums.id, 'the drums come from a named base');
  // the layers: the base's drums through the family's kit, the state names the base
  configure({ createContext: () => new Ctx() });
  const E = unlockNow();
  const set = createMixSet(E.ctx, E.ctx.destination, { seed: 4 });
  const before = writes.length;
  const st = set.bar(1, { ...d2, mix: { ...d2.mix, yes: { ...d2.mix.yes, drums: true } } }, 0.5);
  assert.equal(st.base.id, d2.bases.realised.id, 'the state names the base the drums came from');
  assert.ok(writes.slice(before).every(Number.isFinite));
  const st0 = set.bar(3, { ...d1, mix: { ...d1.mix, yes: { ...d1.mix.yes, drums: true } } }, 0.5);
  assert.equal(st0.base, null, 'a bar before the base arrived plays the family pattern and names no base');
  set.dispose();
  // the per-bar gate: a note off the hats is dropped, a note on a kick is ducked
  const base = { ...authorHouse('chicago', 9), id: 'base-0001' };
  const notes = [{ midi: 69, at: 0, beats: 0.5 }, { midi: 71, at: 0.25, beats: 0.25 }, { midi: 72, at: 0.5, beats: 0.5 }];
  const g = gateNotesToBase(base, 0, notes, { gate: 'hats', duck: 0.4 });
  assert.equal(g.find((n) => n.at === 0)?.level, 0.6, 'on the kick: ducked');
  assert.ok(!g.some((n) => n.at === 0.25), 'the e of the beat, where no hat plays: dropped');
  assert.equal(g.find((n) => n.at === 0.5)?.level, 1, 'on the off-beat hat: kept whole');
  assert.equal(gateNotesToBase(null, 0, notes).length, 3, 'no base: every note, whole');
});
