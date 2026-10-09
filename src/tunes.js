// settle-hear · tunes - the old melodies the flute plays: each one written out in ABC, each one carrying the
// printed public-domain book its melody comes from.
//
// <claudes_code_comments>
// ** Function List **
// TUNES                       - every tune in src/tunes/ (one file per book): { id, title, region, kind, key, mode,
//                               meter, abc, tags, origin, source: { book, compiler, year, where, scan }, transcription }
// tuneProblems(tune)          - the reasons a tune may not be played (no source, a book after 1929, no scan named,
//                               a melody that does not parse, too short): [] when it is fine
// playableTunes(list)         - the tunes with no problems, each parsed once: { ...tune, parsed }
// tunesFor(theme, list)       - the playable tunes whose tags meet the theme's tags (all of them if none do)
// createTuneDealer({ random }) - THE DECK RULE for the flute's tunes: next(theme, list) deals the theme's tunes like a
//                               deck (deck.js createBag), one deck per theme, every tune before any comes back
// placeTune(parsed, rootMidi) - transpose a parsed tune so its tonic is the theme's root pitch class and its middle
//                               note sits near the flute's sweet spot (midi 79, G5): { notes, shift }
// generatedPhrase(r, theme, beats) - when no tune fits, a short phrase from the theme's own scale, MARKED generated
//
// ** Technical Review **
// - THE RULE: a tune goes in only when its melody comes from a printed source that is in the public domain, named
//   here with its year and where in the book it is, or from a dataset that dedicates the notes to the public domain
//   (CC0), named with its record and the old book the record was typeset from. The melody is ours to play; an arrangement or a modern
//   transcription is not, so every ABC below is a plain melody line written out by us from the named printing.
//   tuneProblems() enforces the shape of that rule (a book, a compiler, a year before 1929, a place in the book);
//   it cannot check the notes against the scan, which is why each entry names its scan.
// - The tunes come from the books WIKI_OLD_MELODIES names (wikis/WIKI_OLD_MELODIES/01-SOURCES-AND-LICENCES.md), one
//   data file per book in src/tunes/. A printed source must name its scan (an Internet Archive or IMSLP address)
//   so anyone can open the page and check the notes; src/tunecheck.js checks every bar's length and finds
//   duplicate tunes across books.
// - When no tune fits the theme the DJ asks for a generated phrase; the visualiser and the guide say so ("generated
//   from the scale, not an old tune"). Nothing generated is ever labelled with a book.
// </claudes_code_comments>

import { parseAbc, tuneBeats } from './abc.js';
import { MODES } from './tuning.js';
import { themeOf } from './themes.js';
import { createBag } from './deck.js';
import { ALL_TUNES } from './tunes/index.js';

// The tunes live in src/tunes/, one file per printed book (or CC0 dataset); src/tunes/index.js joins them.
export const TUNES = ALL_TUNES;

const PD_YEAR = 1929;

export function tuneProblems(t) {
  const p = [];
  if (!t || typeof t !== 'object') return ['not a tune'];
  if (!t.id) p.push('no id');
  if (!t.title) p.push('no title');
  const s = t.source ?? {};
  if (s.kind === 'cc0') {
    // a public-domain dedication of the notes themselves: the dataset, the record, the licence, and the old book
    // the record was typeset from
    if (!s.dataset) p.push('no dataset');
    if (!s.record) p.push('no record in the dataset');
    if (s.licence !== 'CC0') p.push('the dataset licence is not CC0');
    if (!s.book) p.push('no source book behind the record');
  } else {
    if (!s.book) p.push('no source book');
    if (!s.compiler) p.push('no compiler or editor');
    if (!Number.isFinite(s.year)) p.push('no year');
    else if (s.year >= PD_YEAR) p.push(`printed ${s.year}, not before ${PD_YEAR}`);
    if (!s.where) p.push('no place in the book (page or number)');
    if (!s.scan) p.push('no scan named (where the page can be seen)');
  }
  let parsed = null;
  try { parsed = parseAbc(t.abc); } catch { p.push('the ABC does not parse'); }
  const sounding = parsed ? parsed.notes.filter((n) => n.midi != null) : [];
  if (parsed && sounding.length < 8) p.push(`only ${sounding.length} notes`);
  if (parsed && tuneBeats(parsed.notes) <= 0) p.push('no length');
  return p;
}

export function playableTunes(list = TUNES) {
  return list.filter((t) => tuneProblems(t).length === 0).map((t) => ({ ...t, parsed: parseAbc(t.abc) }));
}

export function tunesFor(theme, list = playableTunes()) {
  const tags = new Set(themeOf(theme?.key ?? theme).tags ?? []);
  const fit = list.filter((t) => (t.tags ?? []).some((g) => tags.has(g)));
  return fit.length ? fit : list;
}

// one deck per theme, rebuilt only when the theme's list of tunes changes
export function createTuneDealer({ random } = {}) {
  const decks = new Map();
  return {
    next(theme, list = playableTunes()) {
      const fit = tunesFor(theme, list);
      if (!fit.length) return undefined;
      const key = themeOf(theme?.key ?? theme).key;
      const ids = fit.map((t) => t.id).join('|');
      let d = decks.get(key);
      if (!d || d.ids !== ids) {
        d = { ids, deck: createBag(fit.map((_, i) => i), { random }), fit };
        decks.set(key, d);
      }
      return d.fit[d.deck.next()];
    },
  };
}

export function placeTune(parsed, rootMidi = 57, centre = 79) {
  const notes = parsed?.notes ?? [];
  const pcs = notes.filter((n) => n.midi != null).map((n) => n.midi);
  if (!pcs.length) return { notes: [], shift: 0 };
  const sorted = [...pcs].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  const tonicPc = parsed.key?.pc ?? 0;
  const rootPc = ((rootMidi % 12) + 12) % 12;
  let shift = ((rootPc - tonicPc) % 12 + 12) % 12;
  if (shift > 6) shift -= 12;
  // whole octaves toward the flute's sweet spot
  shift += 12 * Math.round((centre - (mid + shift)) / 12);
  return { notes: notes.map((n) => ({ midi: n.midi == null ? null : n.midi + shift, beats: n.beats })), shift };
}

// a generated phrase: a stepwise walk on the theme's scale, ending on the root, `beats` long in eighths and
// quarters. It is labelled generated everywhere it appears.
export function generatedPhrase(r, theme, beats = 8) {
  const t = themeOf(theme?.key ?? theme);
  const steps = MODES[t.mode] ?? MODES.ionian;
  const scale = [];
  for (let o = 0; o < 2; o++) for (const s of steps) scale.push(s + 12 * o);
  let i = Math.floor(r() * steps.length);
  const notes = [];
  let left = beats;
  while (left > 0.01) {
    const d = left <= 1 ? left : r() < 0.6 ? 0.5 : 1;
    notes.push({ deg: scale[Math.max(0, Math.min(scale.length - 1, i))], beats: d });
    left -= d;
    i += [-2, -1, -1, 1, 1, 2, 0][Math.floor(r() * 7)];
    if (i < 0) i = 1;
    if (i >= scale.length) i = scale.length - 2;
  }
  notes[notes.length - 1].deg = 12;
  return notes;
}
