// settle-hear · tune-composer - THE COMPOSER: an entirely new tune made from one or more old ones, by settling. Each
// note slot is a thing; its lean comes from what the source tunes play in that place; the pulls keep neighbours in
// step, end the phrases on the tonic or the fifth and follow the source phrase's shape; the field cools and the
// settled notes are the tune.
//
// <claudes_code_comments>
// ** Function List **
// COMPOSER                     - the composer's numbers: sweeps, temperatures, the degree range, every weight
// KEY_FIELD                    - mode name -> the ABC K: suffix (mix, dor, m, lyd, phr, loc, '' for ionian)
// composeMode(mode)            - the 7-step mode the composer works in (a pentatonic theme composes in its parent
//                                mode with only the pentatonic degrees allowed): { steps, allowed }
// barBeatsOf(meter)            - an ABC M: field -> beats a bar (quarter beats); null for free metre (M:none)
// readSource(tune)             - a tune -> { id, title, barBeats, kind: 'dance' | 'air', notes (scale degrees), phrases }
// transitionModel(sources)     - the note-to-note model learned from the sources: interval counts, degree-pair counts
// influenceWeights(window, decay) - newest-first weights for the window of earlier sets, decaying, summing to 1
// planSkeleton(sources, r, kind) - the new tune's phrases: each takes its RHYTHM from one source phrase and its SHAPE
//                                from another, dealt so every source takes part
// longestCopy(a, b)            - the longest run of identical (degree, length) notes two note lists share, in beats
// composeTune(opts)            - the whole composer: sources + theme + seed (+ influence window) -> the new tune
//                                { notes, degs, abc, title, label, sources, seed, key, meter, barBeats, phraseBars,
//                                kind, copy, trace, influence }
// tuneToAbc(tune)              - the composed notes written out as ABC (parseAbc reads them back note for note)
// degreeMidi(d, key)           - a scale degree -> midi, in the composed key
//
// ** Technical Review **
// - THE IDEA (navigator, 2026-10-02): "each time the DJ can play an entirely unique tune, based on one or more of the
//   provided melodies". Old dance tunes are two 8-bar halves of four 2-bar phrases; airs and chant are freer. The
//   composer cuts each source into bars (abc.js counts the bar lines) and phrases, learns how its notes move, and
//   builds a new tune the SETTLE way.
// - DEGREES, NOT PITCHES: every source note becomes a scale degree of its own key (0 = its tonic, 7 = an octave up),
//   so a tune in D mixolydian and one in G ionian teach the same model. The new tune is composed in degrees of the
//   theme's key and mode and written out in that key, so every note is in the theme's scale by construction.
// - THE FIELD: a slot s_i takes one degree in COMPOSER.range (allowed degrees only). Its energy, lower is better:
//     - the transition model: -log P(d_i | d_i-1) - log P(d_i+1 | d_i), from the sources' interval counts and degree
//       pair counts (Laplace smoothed): what the sources play next
//     - smooth steps: a cost growing with the leap size (a leap past a sixth costs most); variety: a quick back and
//       forth (a b a) and a note struck three times in a row each cost a little
//     - cadences: the last slot of a phrase is pulled to the tonic or the fifth; the last slot of each half and of the
//       tune to the tonic, hard
//     - chord tones: a slot on the first beat of a bar leans to degrees 0, 2, 4 (the tonic triad)
//     - the shape: the slot leans toward the SHAPE source phrase's degree at the same moment, moved by a dealt
//       offset of 1 to 3 degrees so the shape survives and the notes do not
//     - THE INFLUENCE WINDOW (navigator: "each set considers its previous sets over some window"): the earlier sets'
//       records, newest first, weighted by decay^k (normalised). Each pulls the opening intervals toward its motif
//       (in semitones) and every slot toward the pitch classes of its key. A newer set pulls harder than an older one.
//   Gibbs sweeps from T = 2.0 to 0.12 (48 sweeps) sample each slot from exp(-E / T). The same rule the hero's lights
//   follow, on categorical things.
// - NO COPY: after the field settles, the longest run of identical (degree, length) notes the new tune shares with
//   any single source must be no longer than one phrase. A longer run gets a copy penalty on the slots past the
//   limit and the field re-settles cold; up to 8 rounds. The result reports each source's longest shared run.
// - Deterministic for a seed (deckRng): the same sources, theme, seed and influence give the same tune, note for note.
// </claudes_code_comments>

import { MODES } from './tuning.js';
import { themeOf } from './themes.js';
import { deckRng, createBag } from './deck.js';
import { parseAbc } from './abc.js';

export const COMPOSER = Object.freeze({
  sweeps: 48,
  hot: 2.0,
  cold: 0.12,
  range: [-4, 11],
  phraseBars: 2,
  halves: 2,
  phrasesPerHalf: 4,
  airPhrases: 4,
  copyRounds: 8,
  w: Object.freeze({
    interval: 1.0,
    pair: 0.6,
    leap: 0.35,
    turn: 0.7,
    same: 0.9,
    cadence: 3.2,
    halfCadence: 6.0,
    chord: 0.55,
    shape: 0.7,
    motif: 1.4,
    scale: 0.9,
    copy: 8.0,
  }),
  decay: 0.6,
  window: 4,
});

export const KEY_FIELD = { ionian: '', mixolydian: 'mix', dorian: 'dor', aeolian: 'm', lydian: 'lyd', phrygian: 'phr', locrian: 'loc' };
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NAT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const PENTA_PARENT = { 'minor pentatonic': ['aeolian', [0, 2, 3, 4, 6]], 'major pentatonic': ['ionian', [0, 1, 2, 4, 5]] };

export function composeMode(mode) {
  if (PENTA_PARENT[mode]) {
    const [parent, allowed] = PENTA_PARENT[mode];
    return { name: parent, steps: MODES[parent], allowed: new Set(allowed) };
  }
  const name = MODES[mode] && MODES[mode].length === 7 ? mode : 'ionian';
  return { name, steps: MODES[name], allowed: new Set([0, 1, 2, 3, 4, 5, 6]) };
}

export function barBeatsOf(meter) {
  const m = String(meter ?? '4/4').trim();
  if (/^none$/i.test(m)) return null;
  if (m === 'C') return 4;
  if (m === 'C|') return 4;
  const f = /^(\d+)\s*\/\s*(\d+)$/.exec(m);
  if (!f) return 4;
  return (Number(f[1]) * 4) / Number(f[2]);
}

const mod = (a, n) => ((a % n) + n) % n;

// midi -> a degree of a 7-step scale with tonic pc (nearest step at or below a chromatic note)
function toDegree(midi, tonicPc, steps) {
  const off = midi - (60 + tonicPc);
  const o = Math.floor(off / 12);
  const r = mod(off, 12);
  let i = 0;
  for (let k = 0; k < steps.length; k++) if (steps[k] <= r) i = k;
  return 7 * o + i;
}

export function degreeMidi(d, key) {
  const steps = MODES[key.mode7] ?? MODES.ionian;
  return key.tonicMidi + steps[mod(d, 7)] + 12 * Math.floor(d / 7);
}

export function readSource(tune) {
  const parsed = tune.parsed ?? parseAbc(tune.abc);
  const barBeats = barBeatsOf(parsed.meter);
  const tags = new Set(tune.tags ?? []);
  const air = barBeats == null || tags.has('chant') || (tags.has('air') && !tags.has('reel') && !tags.has('jig'));
  const mode7 = composeMode(parsed.key.mode).steps;
  const raw = parsed.notes.map((n) => (n.midi == null ? null : toDegree(n.midi, parsed.key.pc, mode7)));
  // whole octaves so the source's middle sits near degree 3 (a tune written high and one written low teach the same)
  const sorted = raw.filter((d) => d != null).sort((a, b) => a - b);
  const shift = sorted.length ? -7 * Math.round((sorted[Math.floor(sorted.length / 2)] - 3) / 7) : 0;
  const notes = parsed.notes.map((n, i) => ({
    deg: raw[i] == null ? null : raw[i] + shift,
    beats: n.beats,
    bar: n.bar ?? 0,
  }));
  // bars, with a short first bar treated as a pickup and left out of the phrases
  const bars = [];
  for (const n of notes) { (bars[n.bar] ??= []).push(n); }
  const full = bars.filter(Boolean);
  const len = (b) => b.reduce((a, n) => a + n.beats, 0);
  let body = full;
  if (barBeats && full.length > 1 && len(full[0]) < barBeats - 1e-6) body = full.slice(1);
  const phrases = [];
  if (!air && barBeats) {
    for (let i = 0; i + COMPOSER.phraseBars <= body.length; i += COMPOSER.phraseBars) {
      const ph = body.slice(i, i + COMPOSER.phraseBars);
      if (ph.every((b) => Math.abs(len(b) - barBeats) < 1e-6)) phrases.push(ph.flat());
    }
  } else {
    for (const b of body) if (b.length >= 3) phrases.push(b.slice());
  }
  return { id: tune.id, title: tune.title, source: tune.source ?? null, barBeats, kind: air ? 'air' : 'dance', meter: parsed.meter, notes, phrases };
}

export function transitionModel(srcs) {
  const iv = new Map();
  const pair = Array.from({ length: 7 }, () => new Array(7).fill(0));
  const from = new Array(7).fill(0);
  let n = 0;
  for (const s of srcs) {
    const seq = s.notes.filter((x) => x.deg != null);
    for (let i = 1; i < seq.length; i++) {
      const a = seq[i - 1].deg;
      const b = seq[i].deg;
      const d = Math.max(-9, Math.min(9, b - a));
      iv.set(d, (iv.get(d) ?? 0) + 1);
      pair[mod(a, 7)][mod(b, 7)] += 1;
      from[mod(a, 7)] += 1;
      n += 1;
    }
  }
  const ivLog = (d) => Math.log(((iv.get(Math.max(-9, Math.min(9, d))) ?? 0) + 0.3) / (n + 0.3 * 19));
  const pairLog = (a, b) => Math.log((pair[mod(a, 7)][mod(b, 7)] + 0.5) / (from[mod(a, 7)] + 3.5));
  return { iv, pair, n, ivLog, pairLog };
}

export function influenceWeights(window = [], decay = COMPOSER.decay) {
  const list = (window ?? []).filter(Boolean).slice(0, COMPOSER.window);
  const raw = list.map((_, k) => Math.pow(decay, k));
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((w) => w / sum);
}

// the phrases: rhythm from one source phrase, shape from another (a different phrase whenever there is one)
export function planSkeleton(srcs, r, kind) {
  const usable = srcs.filter((s) => s.phrases.length);
  const pool = [];
  usable.forEach((s, si) => s.phrases.forEach((ph, pi) => pool.push({ si, pi, ph })));
  const count = kind === 'air' ? COMPOSER.airPhrases : COMPOSER.halves * COMPOSER.phrasesPerHalf;
  // THE DECK RULE over the sources first (each takes part), then over each source's phrases
  const srcDeck = createBag(usable.map((_, i) => i), { random: r });
  const phraseDecks = usable.map((s) => createBag(s.phrases.map((_, i) => i), { random: r }));
  const out = [];
  for (let k = 0; k < count; k++) {
    const si = srcDeck.next();
    const pi = phraseDecks[si].next();
    // the shape comes from a different source when there is one, else a different phrase
    let sj = si;
    if (usable.length > 1) { sj = srcDeck.peek(); if (sj === si) sj = (si + 1) % usable.length; }
    let pj = phraseDecks[sj].peek();
    if (sj === si && pj === pi && usable[sj].phrases.length > 1) pj = (pi + 1) % usable[sj].phrases.length;
    const offset = [1, -1, 2, -2, 3][Math.floor(r() * 5)];
    out.push({ rhythm: { si, pi, ph: usable[si].phrases[pi] }, shape: { si: sj, pi: pj, ph: usable[sj].phrases[pj] }, offset });
  }
  return { phrases: out, usable };
}

// the longest run of identical notes (degree and length) two lists share, measured in beats
export function longestCopy(a, b) {
  const key = (n) => `${n.deg}|${Math.round(n.beats * 96)}`;
  const A = a.map(key);
  const B = b.map(key);
  let best = 0;
  let where = null;
  const prev = new Array(B.length + 1).fill(0);
  const prevBeats = new Array(B.length + 1).fill(0);
  for (let i = 1; i <= A.length; i++) {
    let diag = 0;
    let diagBeats = 0;
    for (let j = 1; j <= B.length; j++) {
      const up = prev[j];
      const upBeats = prevBeats[j];
      if (A[i - 1] === B[j - 1]) {
        prev[j] = diag + 1;
        prevBeats[j] = diagBeats + a[i - 1].beats;
        if (prevBeats[j] > best + 1e-9) { best = prevBeats[j]; where = { endA: i - 1, endB: j - 1, notes: prev[j] }; }
      } else { prev[j] = 0; prevBeats[j] = 0; }
      diag = up;
      diagBeats = upBeats;
    }
  }
  return { beats: best, where };
}

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

function themeKey(theme) {
  const T = themeOf(theme?.key ?? theme);
  const m = /^([A-G])([#b]?)/.exec(T.root ?? 'A3');
  const letter = m ? m[1] : 'A';
  const pc = mod(NAT[letter] + (m?.[2] === '#' ? 1 : m?.[2] === 'b' ? -1 : 0), 12);
  const cm = composeMode(T.mode);
  // the tonic sits so the tune's middle (about degree 4) lands near the flute's sweet spot (midi 79, G5)
  let tonicMidi = 60 + pc;
  const mid = (t) => t + cm.steps[4];
  while (mid(tonicMidi) < 74) tonicMidi += 12;
  while (mid(tonicMidi) > 85) tonicMidi -= 12;
  return { theme: T.key, letter: letter + (m?.[2] ?? ''), letterIdx: LETTERS.indexOf(letter), pc, mode: T.mode, mode7: cm.name, allowed: cm.allowed, tonicMidi, kField: `${letter}${m?.[2] ?? ''}${KEY_FIELD[cm.name] ?? ''}`, name: `${NAMES[pc]} ${T.mode}` };
}

export function composeTune({ sources = [], theme = null, seed = 1, influence = null, sweeps = COMPOSER.sweeps } = {}) {
  const r = deckRng((Number(seed) >>> 0) || 1);
  const key = themeKey(theme);
  const srcs = sources.map(readSource).filter((s) => s.notes.some((n) => n.deg != null));
  if (!srcs.length) return null;
  // one metre: the first source sets it; others join only when they share it (a dance tune and an air do not mix)
  const lead = srcs[0];
  const kind = lead.kind;
  const joined = srcs.filter((s, i) => i === 0 || (s.kind === kind && s.barBeats === lead.barBeats));
  const { phrases, usable } = planSkeleton(joined, r, kind);
  if (!phrases.length) return null;
  const model = transitionModel(joined);
  const W = COMPOSER.w;
  const win = (influence?.window ?? []).filter(Boolean).slice(0, COMPOSER.window);
  const iw = influenceWeights(win, influence?.decay ?? COMPOSER.decay);
  const scaleSets = win.map((rec) => {
    const steps = MODES[rec.mode] ?? MODES.ionian;
    return new Set(steps.map((s) => mod(s + (rec.keyPc ?? 0), 12)));
  });

  // the slots: one per note of each phrase's rhythm, rests kept as rests
  const slots = [];
  phrases.forEach((p, k) => {
    const ph = p.rhythm.ph;
    const shapeNotes = p.shape.ph;
    let t = 0;
    const shapeLen = shapeNotes.reduce((a, n) => a + n.beats, 0) || 1;
    const rhyLen = ph.reduce((a, n) => a + n.beats, 0) || 1;
    ph.forEach((n, i) => {
      // the shape source's degree at the same moment of its phrase (time scaled to fit)
      const at = (t / rhyLen) * shapeLen;
      let acc = 0;
      let sd = null;
      for (const s of shapeNotes) { if (acc + s.beats > at + 1e-9) { sd = s.deg; break; } acc += s.beats; }
      if (sd == null) sd = shapeNotes.find((s) => s.deg != null)?.deg ?? 2;
      const half = Math.floor(k / COMPOSER.phrasesPerHalf);
      const lastOfPhrase = i === ph.length - 1;
      const lastOfHalf = lastOfPhrase && (kind === 'air' ? k === phrases.length - 1 : k % COMPOSER.phrasesPerHalf === COMPOSER.phrasesPerHalf - 1);
      slots.push({
        k, i, beats: n.beats, rest: n.deg == null, at: t,
        downbeat: lead.barBeats ? Math.abs(mod(t, lead.barBeats)) < 1e-6 : i === 0,
        shape: sd + p.offset, lastOfPhrase, lastOfHalf, half,
        src: { si: p.rhythm.si, deg: n.deg },
      });
      t += n.beats;
    });
  });
  const [lo, hi] = COMPOSER.range;
  const cands = [];
  for (let d = lo; d <= hi; d++) if (key.allowed.has(mod(d, 7))) cands.push(d);
  const S = slots.map((s) => (s.rest ? null : cands[Math.floor(r() * cands.length)]));
  const pcOf = (d) => mod(degreeMidi(d, key), 12);
  const midiOf = (d) => degreeMidi(d, key);
  const penalty = slots.map(() => new Map());
  const sounding = slots.map((s, i) => (s.rest ? -1 : i)).filter((i) => i >= 0);
  const prevOf = new Map();
  const nextOf = new Map();
  sounding.forEach((i, j) => { prevOf.set(i, sounding[j - 1] ?? null); nextOf.set(i, sounding[j + 1] ?? null); });
  const motifSlots = sounding.slice(0, 5);

  function energy(i, d) {
    const s = slots[i];
    let e = 0;
    const p = prevOf.get(i);
    const n = nextOf.get(i);
    if (p != null && S[p] != null) {
      e -= W.interval * model.ivLog(d - S[p]) + W.pair * model.pairLog(S[p], d);
      e += W.leap * Math.max(0, Math.abs(d - S[p]) - 2) ** 1.3;
    }
    // variety: a quick back and forth (a b a) and a note struck three times both cost a little
    const pp = p != null ? prevOf.get(p) : null;
    if (pp != null && S[pp] != null && S[p] != null) {
      if (d === S[pp] && d !== S[p]) e += W.turn;
      if (d === S[p] && d === S[pp]) e += W.same;
    }
    if (n != null && S[n] != null) {
      e -= W.interval * model.ivLog(S[n] - d) + W.pair * model.pairLog(d, S[n]);
      e += W.leap * Math.max(0, Math.abs(S[n] - d) - 2) ** 1.3;
    }
    if (s.lastOfHalf) e += W.halfCadence * (mod(d, 7) === 0 ? 0 : 1);
    else if (s.lastOfPhrase) e += W.cadence * (mod(d, 7) === 0 || mod(d, 7) === 4 ? 0 : 1);
    if (s.downbeat && !s.lastOfPhrase) e += W.chord * ([0, 2, 4].includes(mod(d, 7)) ? 0 : 1);
    e += W.shape * Math.min(4, Math.abs(d - s.shape)) * 0.5;
    // THE INFLUENCE WINDOW: the opening intervals toward each earlier set's motif, every note toward its key
    if (win.length) {
      const pc = pcOf(d);
      let sc = 0;
      for (let j = 0; j < win.length; j++) sc += iw[j] * (scaleSets[j].has(pc) ? 0 : 1);
      e += W.scale * sc;
      const mi = motifSlots.indexOf(i);
      if (mi > 0 && S[motifSlots[mi - 1]] != null) {
        const step = midiOf(d) - midiOf(S[motifSlots[mi - 1]]);
        let me = 0;
        for (let j = 0; j < win.length; j++) {
          const want = win[j].motif?.[mi - 1];
          if (Number.isFinite(want)) me += iw[j] * Math.min(6, Math.abs(step - want));
        }
        e += W.motif * me;
      }
    }
    const pen = penalty[i].get(d);
    if (pen) e += pen;
    return e;
  }

  const trace = [];
  function anneal(n, hot, cold, only = null) {
    for (let w = 0; w < n; w++) {
      const T = hot * Math.pow(cold / hot, n > 1 ? w / (n - 1) : 1);
      let total = 0;
      for (const i of sounding) {
        if (only && !only.has(i)) continue;
        const es = cands.map((d) => energy(i, d));
        const m = Math.min(...es);
        const ps = es.map((x) => Math.exp(-(x - m) / T));
        const z = ps.reduce((a, b) => a + b, 0);
        let x = r() * z;
        let pick = cands[cands.length - 1];
        for (let c = 0; c < cands.length; c++) { x -= ps[c]; if (x < 0) { pick = cands[c]; break; } }
        S[i] = pick;
        total += energy(i, pick);
      }
      trace.push({ T, energy: total });
    }
  }
  anneal(sweeps, COMPOSER.hot, COMPOSER.cold);

  // NO COPY longer than one phrase of any single source
  const phraseBeats = kind === 'air' ? Math.min(...joined.flatMap((s) => s.phrases.map((ph) => ph.reduce((a, n) => a + n.beats, 0)))) : COMPOSER.phraseBars * lead.barBeats;
  const asNotes = () => slots.map((s, i) => ({ deg: s.rest ? null : S[i], beats: s.beats }));
  let copy = [];
  for (let round = 0; round <= COMPOSER.copyRounds; round++) {
    const mine = asNotes();
    copy = joined.map((s) => ({ id: s.id, ...longestCopy(mine, s.notes) }));
    const bad = copy.filter((c) => c.beats > phraseBeats + 1e-9);
    if (!bad.length || round === COMPOSER.copyRounds) break;
    const region = new Set();
    for (const c of bad) {
      const end = c.where.endA;
      const start = end - c.where.notes + 1;
      // past the first phrase-length of the shared run, the copied degree costs W.copy
      let acc = 0;
      for (let i = start; i <= end; i++) {
        acc += slots[i].beats;
        if (acc > phraseBeats * 0.5 && !slots[i].rest) {
          penalty[i].set(S[i], (penalty[i].get(S[i]) ?? 0) + W.copy);
          region.add(i);
          if (prevOf.get(i) != null) region.add(prevOf.get(i));
          if (nextOf.get(i) != null) region.add(nextOf.get(i));
        }
      }
    }
    anneal(12, 0.6, COMPOSER.cold, region);
  }

  const notes = slots.map((s, i) => ({ midi: s.rest ? null : midiOf(S[i]), beats: s.beats, deg: s.rest ? null : S[i], phrase: s.k }));
  const used = [...new Set(phrases.flatMap((p) => [p.rhythm.si, p.shape.si]))].sort((a, b) => a - b).map((i) => usable[i]);
  const titles = used.map((s) => s.title);
  const label = `a new tune after ${titles.length > 1 ? `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}` : titles[0]}`;
  const out = {
    notes,
    degs: notes.map((n) => n.deg),
    title: label,
    label,
    sources: used.map((s) => ({ id: s.id, title: s.title, source: s.source })),
    seed: (Number(seed) >>> 0) || 1,
    key,
    meter: lead.meter,
    barBeats: lead.barBeats,
    phraseBars: kind === 'air' ? 1 : COMPOSER.phraseBars,
    phraseBeats,
    phrases: phrases.length,
    kind,
    copy: copy.map((c) => ({ id: c.id, beats: c.beats })),
    trace,
    influence: win.length ? { window: win.length, weights: iw } : null,
    motif: motifOf(notes),
  };
  out.abc = tuneToAbc(out);
  return out;
}

// the opening motif: the first four intervals in semitones (what the next sets inherit)
export function motifOf(notes) {
  const s = notes.filter((n) => n.midi != null).slice(0, 5).map((n) => n.midi);
  const out = [];
  for (let i = 1; i < s.length; i++) out.push(Math.max(-7, Math.min(7, s[i] - s[i - 1])));
  return out;
}

const UNIT = 0.5; // L:1/8 = half a beat

function lengthToken(beats) {
  const u = beats / UNIT;
  if (Math.abs(u - 1) < 1e-6) return '';
  if (Math.abs(u - Math.round(u)) < 1e-6) return String(Math.round(u));
  // thirds (triplets), halves and quarters: a fraction ABC reads
  for (const den of [2, 3, 4, 6, 8]) {
    const num = u * den;
    if (Math.abs(num - Math.round(num)) < 1e-6) return `${Math.round(num)}/${den}`;
  }
  return String(Math.round(u));
}

function noteToken(n, key) {
  if (n.midi == null) return `z${lengthToken(n.beats)}`;
  const letter = LETTERS[mod(key.letterIdx + n.deg, 7)];
  // the octave whose natural letter sits nearest the midi note
  const base = NAT[letter];
  let oct = Math.round((n.midi - base) / 12) - 1;
  const alter = n.midi - (12 * (oct + 1) + base);
  const sig = keySig(key.kField);
  let acc = '';
  if (alter !== sig[letter]) acc = alter === 1 ? '^' : alter === -1 ? '_' : alter === 0 ? '=' : alter === 2 ? '^^' : alter === -2 ? '__' : '';
  let s;
  if (oct >= 5) { s = letter.toLowerCase() + "'".repeat(oct - 5); }
  else { s = letter + ','.repeat(Math.max(0, 4 - oct)); }
  return `${acc}${s}${lengthToken(n.beats)}`;
}

// the key signature for a K: field, the same rule abc.js reads
function keySig(kField) {
  const notes = parseAbc(`K:${kField}\nL:1/8\nCDEFGAB|`).notes;
  const out = {};
  LETTERS.forEach((l, i) => { out[l] = notes[i].midi - (60 + NAT[l]); });
  return out;
}

export function tuneToAbc(t) {
  const lines = [];
  lines.push('X:1');
  lines.push(`T:${t.label}`);
  lines.push(`M:${t.barBeats ? t.meter : 'none'}`);
  lines.push('L:1/8');
  lines.push(`K:${t.key.kField}`);
  const body = [];
  let bar = [];
  let acc = 0;
  let bars = 0;
  let phrase = t.notes[0]?.phrase ?? 0;
  const flush = () => {
    if (!bar.length) return;
    body.push(bar.join(' ') + ' |');
    bar = [];
    acc = 0;
    bars += 1;
    if (bars % 4 === 0) body.push('\n');
  };
  for (const n of t.notes) {
    if (!t.barBeats && n.phrase !== phrase) { flush(); phrase = n.phrase; }
    bar.push(noteToken(n, t.key));
    acc += n.beats;
    if (t.barBeats && acc >= t.barBeats - 1e-6) flush();
  }
  flush();
  let text = body.join(' ').replace(/ \n /g, '\n').trim();
  text = text.replace(/\|\s*$/, '|]');
  lines.push(text);
  return lines.join('\n');
}
