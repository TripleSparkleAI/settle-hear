// settle-hear · bases/base-author - AUTHORED BASES: rhythm beds written from documented theory rather than imported
// from a file, one generator per family, each dealt from a seed so a hundred authored bases differ in their
// ghosts, their percussion and their chord loop while the family's grid stays true. A four-on-the-floor kick is not
// a composition; these are the patterns every house primer teaches (wikis/WIKI_DJ_THEORY/01 and 02 give the
// sources), and each base says origin: 'authored' and names its recipe in the ledger.
//
// <claudes_code_comments>
// ** Function List **
// HOUSE_RECIPES              - per house family: kit, tempo range, swing range, the kick, snare, hat and perc rows
//                              (16-step strings as voice-drum-machines.js writes them), the bass style, the chord
//                              loop and the variations the seed may deal
// AMBIENT_RECIPES            - per ambient family: tempo range, grid 8, the drone, the chord change rate, the pulse
// rowToEvents(row, grid, bars, pitch, r, opts) - a 16-step row -> events over `bars` bars with dealt ghost levels
// CHORD_LOOPS                - the loops the chords part cycles: I-V-vi-IV, i-VI-III-VII, the deep ii-V-i and the
//                              four-sevenths loop (Am7 Dm7 Fmaj7 Em7 shape), in scale degrees with extensions
// chordNotes(root, mode, degree, ext) - the midi notes of a chord in a mode
// authorHouse(family, seed, opts)   - one authored house base
// authorAmbient(family, seed, opts) - one authored ambient base
// authorBase(kind, family, seed, opts) - either
// RECIPE_NOTES               - one line per family saying what theory the recipe follows (for the ledger)
//
// ** Technical Review **
// - Every random choice comes from one deckRng stream per base, so a base is fixed for its seed and the ledger can
//   name (family, seed, version) as its whole provenance.
// - Drums use General MIDI note numbers (36 kick, 38 snare, 39 clap, 42 closed hat, 46 open hat, 37 rim, 56
//   cowbell, 51 ride, 70 shaker, 63 conga) so an authored base plays through the same kit map as an imported one.
// - A house base is 8 bars at grid 4; the drums repeat with dealt variation on the bar's last two steps every
//   fourth bar (the fill), the bass follows its style on the chord root, the chords cycle a loop, one chord a bar.
// - An ambient base is 16 bars at grid 8: a drone on the root and fifth held the whole way, a chord that changes
//   every 4 or 8 bars (the glacial change), a sparse high line on coprime cycles (7 and 11 ticks x a factor) so it
//   does not repeat inside the base, and for the pulse family one soft kick every two beats.
// </claudes_code_comments>

import { BASE_FORMAT, PARTS } from './base-format.js';
import { partFeatures, keyOf, signatureOf, PC_NAMES } from './base-features.js';
import { deckRng } from '../deck.js';
import { MODES } from '../tuning.js';

export const AUTHOR_VERSION = 1;

const V = { x: 1, o: 0.6, '-': 0.35, '.': 0 };

export const HOUSE_RECIPES = {
  chicago: { bpm: [120, 126], swing: [0.06, 0.12], kick: 'x...x...x...x...', snare: '....x.......x...', snareVoice: 39, hats: '..x...x...x...x.', open: '..............o.', perc: null, bass: 'offbeat', loop: 'major', fill: true },
  deep: { bpm: [118, 124], swing: [0.14, 0.2], kick: 'x...x...x...x...', snare: '....o.......o...', snareVoice: 39, hats: '..o...o...o...o.', open: null, perc: ['...-......-.....', 37], bass: 'offbeat', loop: 'sevenths', fill: false },
  acid: { bpm: [122, 130], swing: [0.03, 0.08], kick: 'x...x...x...x...', snare: '....x.......x...', snareVoice: 39, hats: 'oxoxoxoxoxoxoxox', open: '..o...o...o...o.', perc: null, bass: 'acid', loop: 'none', fill: true },
  garage: { bpm: [128, 134], swing: [0.2, 0.28], kick: 'x.........x.....', snare: '....x.......x...', snareVoice: 38, hats: '..x.o.x...x.o.x.', open: null, perc: ['.......o......o.', 37], bass: 'organ', loop: 'gospel', fill: true },
  disco: { bpm: [118, 126], swing: [0.08, 0.14], kick: 'x...x...x...x...', snare: '....x.......x...', snareVoice: 38, hats: '..x...x...x...x.', open: '..o...o...o...o.', perc: ['x.x.x.x.x.x.x.x.', 70], bass: 'octave', loop: 'major', fill: true },
  tech: { bpm: [125, 132], swing: [0.03, 0.08], kick: 'x...x...x...x...', snare: '....o.......o...', snareVoice: 39, hats: 'oooooooooooooooo', open: null, perc: ['...o..o....o..o.', 37], bass: 'rolling', loop: 'minor', fill: false },
  progressive: { bpm: [124, 130], swing: [0, 0.03], kick: 'x...x...x...x...', snare: '....o.......o...', snareVoice: 39, hats: '..x...x...x...x.', open: '..o.......o.....', perc: ['o...o...o...o...', 51], bass: 'rolling', loop: 'minor', fill: false },
  'filter-house': { bpm: [120, 126], swing: [0.1, 0.14], kick: 'x...x...x...x...', snare: '....x.......x...', snareVoice: 39, hats: '..x...x...x...x.', open: '......o.......o.', perc: null, bass: 'offbeat', loop: 'sevenths', fill: true },
  'dub-techno': { bpm: [116, 124], swing: [0.06, 0.1], kick: 'o...o...o...o...', snare: null, snareVoice: 39, hats: '..-.......-.....', open: null, perc: ['.......o.....-..', 37], bass: 'offbeat', loop: 'dub', fill: false },
  balearic: { bpm: [112, 120], swing: [0.12, 0.18], kick: 'x...x...x...x...', snare: '....o.......o...', snareVoice: 39, hats: '-.o.-.o.-.o.-.o.', open: null, perc: ['.......-.....-..', 56], bass: 'offbeat', loop: 'major', fill: true },
  breaks: { bpm: [118, 128], swing: [0.05, 0.12], kick: 'x.....x..x......', snare: '....x.......x...', snareVoice: 38, hats: 'x.x.x.x.x.x.x.x.', open: null, perc: null, bass: 'octave', loop: 'minor', fill: true },
  funk: { bpm: [100, 116], swing: [0.08, 0.16], kick: 'x......x..x.....', snare: '....x..o....x...', snareVoice: 38, hats: 'x.xxx.xxx.xxx.xx', open: null, perc: null, bass: 'funk', loop: 'sevenths', fill: true },
  afro: { bpm: [118, 126], swing: [0.08, 0.14], kick: 'x...x...x...x...', snare: '....x.......x...', snareVoice: 39, hats: '..x...x...x...x.', open: null, perc: ['x.x..x.x.x..x.x.', 63], bass: 'offbeat', loop: 'minor', fill: true },
  latin: { bpm: [120, 128], swing: [0.06, 0.12], kick: 'x...x...x...x...', snare: '....x.......x...', snareVoice: 39, hats: 'x.x.x.x.x.x.x.x.', open: null, perc: ['x..x..x...x.x...', 75], bass: 'offbeat', loop: 'major', fill: true },
  electro: { bpm: [120, 130], swing: [0, 0.04], kick: 'x.....x.x.....x.', snare: '....x.......x...', snareVoice: 39, hats: 'x.x.x.x.x.x.x.x.', open: null, perc: null, bass: 'octave', loop: 'minor', fill: true },
  trance: { bpm: [132, 140], swing: [0, 0.03], kick: 'x...x...x...x...', snare: '....x.......x...', snareVoice: 39, hats: '..x...x...x...x.', open: '..o...o...o...o.', perc: null, bass: 'rolling', loop: 'minor', fill: true },
};

export const AMBIENT_RECIPES = {
  drone: { bpm: [56, 72], chordEvery: 8, pulse: null, line: 0.25, texture: true },
  pulse: { bpm: [60, 80], chordEvery: 4, pulse: 2, line: 0.5, texture: false },
  chorale: { bpm: [56, 72], chordEvery: 2, pulse: null, line: 0, texture: false },
  piano: { bpm: [60, 84], chordEvery: 2, pulse: null, line: 1, texture: false },
  bells: { bpm: [60, 76], chordEvery: 8, pulse: null, line: 0.75, texture: false, high: true },
  field: { bpm: [56, 70], chordEvery: 16, pulse: null, line: 0.15, texture: true },
  ambient: { bpm: [60, 80], chordEvery: 4, pulse: null, line: 0.5, texture: true },
  downtempo: { bpm: [84, 98], chordEvery: 2, pulse: 1, line: 0.75, texture: false, hats: true },
};

export const CHORD_LOOPS = {
  major: [[0, 'triad'], [4, 'triad'], [5, 'triad'], [3, 'triad']],
  minor: [[0, 'triad'], [5, 'triad'], [2, 'triad'], [6, 'triad']],
  sevenths: [[0, 'm7'], [3, 'm7'], [5, 'maj7'], [4, 'm7']],
  gospel: [[0, 'maj7'], [1, 'm7'], [4, '7'], [0, 'maj7']],
  dub: [[0, 'm7'], [0, 'm7'], [5, 'maj7'], [0, 'm7']],
  none: [],
};

export const RECIPE_NOTES = {
  chicago: 'four-on-the-floor, off-beat hats, a clap on two and four, a ghost open hat into the downbeat; I V vi IV',
  deep: 'four-on-the-floor with ghost hats, a whisper rim, heavy swing, an off-beat sub, minor sevenths',
  acid: 'four-on-the-floor, sixteenth hats accented on the odd steps, a 303-style sixteenth bass in the mode, no chords',
  garage: 'the 2-step kick (steps 0 and 10), snare on two and four, swung hats, an organ bass, gospel sevenths',
  disco: 'four-on-the-floor, open hats on the off-beats, a shaker on every eighth, an octave bass, I V vi IV',
  tech: 'four-on-the-floor, sixteen even ghost hats, syncopated rims, a rolling bass, minor triads',
  progressive: 'straight four-on-the-floor, a ride on every beat, a rolling sixteenth bass, minor triads held',
  'filter-house': 'four-on-the-floor, open hats after beats 2 and 4, an off-beat sub, minor sevenths on a loop',
  'dub-techno': 'a muted four-on-the-floor, a rim and a whisper hat, an off-beat sub, one minor seventh and its sixth',
  balearic: 'four-on-the-floor, a shaker-like hat line, a cowbell, a ghost clap, I V vi IV',
  breaks: 'a broken kick, snare on two and four, eighth hats, an octave bass, minor triads',
  funk: 'a syncopated kick, a backbeat with a ghost, sixteenth hats with gaps, a syncopated bass',
  afro: 'four-on-the-floor with a conga tumbao, I vi III VII',
  latin: 'four-on-the-floor with a 3-2 clave on the woodblock, eighth hats',
  electro: 'the electro kick (1, the and of 2, 3, the and of 4), a clap on two and four, eighth hats, an octave bass',
  trance: 'four-on-the-floor at 132 to 140, off-beat open hats, a rolling bass, minor triads',
  drone: 'a root and fifth held through, a chord every 8 bars, a sparse line on coprime cycles, a texture',
  pulse: 'the drone with one soft kick every two beats, a chord every 4 bars',
  chorale: 'four voices in close position moving one chord every two bars, no pulse',
  piano: 'a bass note, a chord and a slow melody on the chord tones, every two bars',
  bells: 'a drone with a high sparse bell line on coprime cycles',
  field: 'a texture over a root held the whole way, one chord change',
  ambient: 'a drone, a chord every 4 bars, a sparse line, a texture',
  downtempo: 'a slow kick on one and three, a soft snare on three, a bass, a chord every two bars',
};

export function rowToEvents(row, grid, bars, pitch, r, { vary = 0, steps = 16, barTicks = 16 } = {}) {
  if (!row) return [];
  const ev = [];
  const scale = barTicks / steps;
  for (let b = 0; b < bars; b++) {
    for (let i = 0; i < steps; i++) {
      let v = V[row[i]] ?? 0;
      if (vary && v > 0 && v < 1 && r() < vary) v = Math.max(0.2, Math.min(1, v + (r() - 0.5) * 0.3));
      if (!(v > 0)) continue;
      ev.push([b * barTicks + Math.round(i * scale), Math.max(1, Math.round(scale)), Math.round(v * 100) / 100, pitch]);
    }
  }
  return ev;
}

const EXT = { triad: [0, 2, 4], m7: [0, 2, 4, 6], maj7: [0, 2, 4, 6], 7: [0, 2, 4, 6], sus2: [0, 1, 4], add9: [0, 2, 4, 8] };

export function chordNotes(root, mode, degree, ext = 'triad') {
  const steps = MODES[mode] && MODES[mode].length === 7 ? MODES[mode] : MODES.aeolian;
  const note = (k) => root + steps[((k % 7) + 7) % 7] + 12 * Math.floor(k / 7);
  return (EXT[ext] ?? EXT.triad).map((o) => note(degree + o));
}

const fit = (m, lo, hi) => { let x = m; while (x > hi) x -= 12; while (x < lo) x += 12; return x; };

function bassEvents(style, bars, chordRootOf, mode, r, grid) {
  const ev = [];
  const tpb = 4 * grid;
  const lvl = (x) => Math.round(x * 100) / 100;
  for (let b = 0; b < bars; b++) {
    const root = fit(chordRootOf(b), 36, 48);
    const t0 = b * tpb;
    if (style === 'offbeat') for (let q = 0; q < 4; q++) ev.push([t0 + q * grid + grid / 2, grid / 2, lvl(0.8 + 0.1 * r()), root]);
    else if (style === 'rolling') {
      const seq = [root, root, root + 7, root, root, root + 12, root + 7, root];
      for (let i = 0; i < 16; i++) { if (i % 4 === 0) continue; ev.push([t0 + Math.round(i * (tpb / 16)), Math.max(1, Math.round(tpb / 16)), lvl(0.7 + 0.1 * (i % 2 === 0)), seq[i % 8]]); }
    } else if (style === 'octave') {
      for (let i = 0; i < 8; i++) ev.push([t0 + Math.round(i * (tpb / 8)), Math.max(1, Math.round(tpb / 8)), lvl(i % 2 ? 0.75 : 0.9), i % 2 ? root + 12 : root]);
    } else if (style === 'organ') {
      for (const q of [0, 2]) ev.push([t0 + q * grid, grid * 2 - 1, 0.85, root]);
      if (r() < 0.5) ev.push([t0 + 3 * grid + grid / 2, grid / 2, 0.6, root + 7]);
    } else if (style === 'funk') {
      const pat = ['x', '.', '.', 'x', '.', '.', 'x', '.', '.', '.', 'x', '.', 'x', '.', '.', 'x'];
      const seq = [root, root + 7, root + 10, root + 12, root + 7];
      let k = 0;
      for (let i = 0; i < 16; i++) if (pat[i] === 'x') ev.push([t0 + Math.round(i * (tpb / 16)), Math.max(1, Math.round(tpb / 16)), lvl(0.7 + 0.2 * r()), seq[k++ % seq.length]]);
    } else if (style === 'acid') {
      const steps = MODES[mode] ?? MODES.aeolian;
      const pool = [0, 0, 0, 7, 10, 12, 3, 5].map((s) => root + (steps.includes(s % 12) || s % 12 === 0 || s === 7 ? s : 0));
      for (let i = 0; i < 16; i++) {
        if (r() < 0.25) continue;
        const accent = i % 4 === 0 || r() < 0.3;
        ev.push([t0 + Math.round(i * (tpb / 16)), Math.max(1, Math.round(tpb / 16)), lvl(accent ? 0.95 : 0.55), pool[Math.floor(r() * pool.length)]]);
      }
    }
  }
  return ev;
}

export function authorHouse(family, seed = 1, { bars = 8, root = 57, mode = null } = {}) {
  const R = HOUSE_RECIPES[family];
  if (!R) throw new Error(`no house recipe for ${family}`);
  const r = deckRng(((Number(seed) >>> 0) ^ 0x9e3779b9) >>> 0 || 1);
  const grid = 4;
  const tpb = 16;
  const bpm = Math.round(R.bpm[0] + r() * (R.bpm[1] - R.bpm[0]));
  const swing = Math.round((R.swing[0] + r() * (R.swing[1] - R.swing[0])) * 100) / 100;
  const majorLoop = R.loop === 'major' || R.loop === 'gospel';
  const theMode = mode ?? (majorLoop ? (r() < 0.5 ? 'ionian' : 'mixolydian') : (r() < 0.5 ? 'aeolian' : 'dorian'));
  const rootPc = Math.floor(r() * 12);
  const chordRoot = 48 + rootPc;
  const parts = {};
  const kick = rowToEvents(R.kick, grid, bars, 36, r, { vary: 0.2 });
  // the fill: on the last bar of every four, the kick's last two steps may double
  if (R.fill) for (let b = 3; b < bars; b += 4) if (r() < 0.7) kick.push([b * tpb + 14, 2, 0.6, 36]);
  parts.kick = { events: kick.sort((a, b) => a[0] - b[0]) };
  if (R.snare) parts.snare = { events: rowToEvents(R.snare, grid, bars, R.snareVoice, r, { vary: 0.3 }) };
  const hats = rowToEvents(R.hats, grid, bars, 42, r, { vary: 0.4 });
  if (R.open) hats.push(...rowToEvents(R.open, grid, bars, 46, r, { vary: 0.3 }));
  parts.hats = { events: hats.sort((a, b) => a[0] - b[0] || a[3] - b[3]) };
  if (R.perc) {
    const [row, pitch] = R.perc;
    parts.perc = { events: rowToEvents(row, grid, bars, pitch, r, { vary: 0.4 }) };
  }
  const loop = CHORD_LOOPS[R.loop] ?? [];
  const chordOf = (b) => (loop.length ? loop[b % loop.length] : [0, 'triad']);
  const chordRootOf = (b) => chordNotes(chordRoot, theMode, chordOf(b)[0], 'triad')[0];
  parts.bass = { events: bassEvents(R.bass, bars, chordRootOf, theMode, r, grid) };
  if (loop.length) {
    const ev = [];
    const stab = r() < 0.5;
    for (let b = 0; b < bars; b++) {
      const [deg, ext] = chordOf(b);
      const notes = chordNotes(chordRoot + 12, theMode, deg, ext).map((m) => fit(m, 60, 79));
      if (stab) for (const q of [1, 3]) for (const m of notes) ev.push([b * tpb + q * grid + grid / 2, grid, 0.55, m]);
      else for (const m of notes) ev.push([b * tpb, tpb - 1, 0.5, m]);
    }
    parts.chords = { events: ev.sort((a, b) => a[0] - b[0] || a[3] - b[3]) };
  }
  const base = {
    format: BASE_FORMAT,
    id: 'base-0000',
    kind: 'house',
    family,
    origin: 'authored',
    tempo: { bpm, min: Math.max(R.bpm[0] - 4, Math.round(bpm * 0.94)), max: Math.min(R.bpm[1] + 4, Math.round(bpm * 1.06)) },
    meter: { num: 4, den: 4 },
    grid,
    swing,
    key: null,
    bars,
    parts,
    signature: null,
    quantise: null,
    source: 'ledger',
    recipe: { family, seed, version: AUTHOR_VERSION, bass: R.bass, loop: R.loop, mode: theMode },
  };
  for (const p of Object.keys(parts)) parts[p].features = partFeatures(parts[p].events, { ...base, partName: p });
  base.key = R.loop === 'none' ? { pc: rootPc, mode: theMode, name: `${PC_NAMES[rootPc]} ${theMode}`, confidence: 1 } : keyOf(parts, base);
  base.signature = signatureOf(base);
  return base;
}

export function authorAmbient(family, seed = 1, { bars = 16, mode = null } = {}) {
  const R = AMBIENT_RECIPES[family];
  if (!R) throw new Error(`no ambient recipe for ${family}`);
  const r = deckRng(((Number(seed) >>> 0) ^ 0x7f4a7c15) >>> 0 || 1);
  const grid = 8;
  const tpb = 32;
  const total = bars * tpb;
  const bpm = Math.round(R.bpm[0] + r() * (R.bpm[1] - R.bpm[0]));
  const theMode = mode ?? ['aeolian', 'dorian', 'lydian', 'ionian', 'phrygian'][Math.floor(r() * 5)];
  const rootPc = Math.floor(r() * 12);
  const root = 36 + rootPc;
  const steps = MODES[theMode] ?? MODES.aeolian;
  const parts = {};
  // the drone: root and fifth held the whole base (texture part, so the DJ can keep or drop it)
  if (R.texture || family === 'drone' || family === 'bells' || family === 'pulse') {
    parts.texture = { events: [[0, total, 0.5, root], [0, total, 0.35, root + 7]] };
  }
  // the glacial chord: a sus2, add9 or seventh, changing every chordEvery bars, in close position around 60
  const colours = ['sus2', 'add9', 'm7', 'maj7', 'triad'];
  const degrees = [0, 5, 3, 4, 2];
  const chordEv = [];
  const nChanges = Math.max(1, Math.floor(bars / R.chordEvery));
  for (let c = 0; c < nChanges; c++) {
    const deg = degrees[Math.floor(r() * degrees.length)];
    const ext = colours[Math.floor(r() * colours.length)];
    const notes = chordNotes(root + 24, theMode, deg, ext).map((m) => fit(m, 55, 76));
    const t0 = c * R.chordEvery * tpb;
    const len = R.chordEvery * tpb - (family === 'chorale' ? 2 : 0);
    if (family === 'chorale') {
      // four voices, close position, the bass an octave down
      const four = [fit(notes[0] - 12, 43, 55), ...notes.slice(0, 3)];
      for (const m of four) chordEv.push([t0, len, 0.6, m]);
    } else if (family === 'piano' || family === 'downtempo') {
      for (const m of notes) chordEv.push([t0, Math.min(len, tpb * 2 - 1), 0.5, m]);
      if (R.chordEvery >= 2) for (const m of notes) chordEv.push([t0 + tpb, tpb - 1, 0.4, m]);
    } else for (const m of notes) chordEv.push([t0, len, 0.45, m]);
  }
  if (family !== 'field' || r() < 0.5) parts.chords = { events: chordEv.sort((a, b) => a[0] - b[0] || a[3] - b[3]) };
  // the bass for piano, downtempo and chorale (the chord root an octave down on each change)
  if (family === 'piano' || family === 'downtempo' || family === 'pulse') {
    const ev = [];
    for (let c = 0; c < nChanges; c++) {
      const first = chordEv.find((e) => e[0] === c * R.chordEvery * tpb);
      const m = fit((first?.[3] ?? root + 24) - 24, 36, 48);
      for (let b = 0; b < R.chordEvery; b++) ev.push([(c * R.chordEvery + b) * tpb, tpb / 2, 0.6, m]);
    }
    parts.bass = { events: ev };
  }
  // the sparse line on coprime cycles: a note every 7 and every 11 half-beats, on chord and scale tones
  if (R.line > 0) {
    const ev = [];
    const high = R.high ? 84 : 72;
    const stepA = 7 * (grid / 2);
    const stepB = 11 * (grid / 2);
    const pick = () => fit(root + 24 + steps[Math.floor(r() * steps.length)], high - 7, high + 7);
    for (let t = 0; t < total; t += stepA) if (r() < R.line) ev.push([t, Math.max(grid, Math.round(grid * (2 + 2 * r()))), Math.round((0.35 + 0.25 * r()) * 100) / 100, pick()]);
    for (let t = stepB; t < total; t += stepB) if (r() < R.line * 0.7) ev.push([t, Math.max(grid, Math.round(grid * (1 + 2 * r()))), Math.round((0.3 + 0.2 * r()) * 100) / 100, pick() + 12]);
    const seen = new Set();
    const list = ev.filter((e) => { const k = `${e[0]}:${e[3]}`; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a[0] - b[0] || a[3] - b[3]);
    if (list.length) parts.lead = { events: list };
  }
  // the pulse: one soft kick every `pulse` beats; downtempo adds a snare on 3 and soft hats
  if (R.pulse) {
    const ev = [];
    for (let t = 0; t < total; t += R.pulse * grid) ev.push([t, grid, 0.5, 36]);
    parts.kick = { events: ev };
  }
  if (R.hats) {
    parts.snare = { events: Array.from({ length: bars }, (_, b) => [b * tpb + 2 * grid, grid, 0.45, 38]) };
    const hats = [];
    for (let t = grid; t < total; t += 2 * grid) hats.push([t, grid / 2, Math.round((0.3 + 0.15 * r()) * 100) / 100, 42]);
    parts.hats = { events: hats };
  }
  const base = {
    format: BASE_FORMAT,
    id: 'base-0000',
    kind: 'ambient',
    family,
    origin: 'authored',
    tempo: { bpm, min: Math.round(bpm * 0.85), max: Math.round(bpm * 1.15) },
    meter: { num: 4, den: 4 },
    grid,
    swing: 0,
    key: { pc: rootPc, mode: theMode, name: `${PC_NAMES[rootPc]} ${theMode}`, confidence: 1 },
    bars,
    parts,
    signature: null,
    quantise: null,
    source: 'ledger',
    recipe: { family, seed, version: AUTHOR_VERSION, mode: theMode, chordEvery: R.chordEvery },
  };
  for (const p of Object.keys(parts)) parts[p].features = partFeatures(parts[p].events, { ...base, partName: p });
  base.signature = signatureOf(base);
  return base;
}

export function authorBase(kind, family, seed = 1, opts = {}) {
  return kind === 'house' ? authorHouse(family, seed, opts) : authorAmbient(family, seed, opts);
}

export const AUTHORED_FAMILIES = { house: Object.keys(HOUSE_RECIPES), ambient: Object.keys(AMBIENT_RECIPES) };
void PARTS;
