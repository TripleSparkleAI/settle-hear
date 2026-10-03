// settle-hear · dj-replay - playTag: one tag in, the whole DJ situation back out, rebuilt from the source code and
// the tune list alone. The symphony's playTag(tag) loads this into the live DJ, so the same tune and mix play again.
//
// <claudes_code_comments>
// ** Function List **
// playTag(tag, { tunes })    - the tag -> { decoded, tune: { notes, abc, label, sources }, notes (the tagged bar's
//                              notes), layers, chain, moves, section, bpm, beat, steer, influence, lines }
// barNotes(notes, bar, beats) - the notes of one bar of a tune (bar counted from 0), each { midi, at, beats }
// djTagRequests              - THE LIVE DOOR: playTag(tag) (unless { live: false }) asks every playing symphony to
//                              load the tag on its next bar line (lane LIVERADIO calls it to follow a leader)
//
// ** Technical Review **
// - A COMPOSED tune is composed again with the tag's source ids in their deal order, its theme, its seed and its
//   influence window (mix-dj.js composeFrom), so it is the same tune note for note (the composer is deterministic
//   for its inputs). A COLLECTED lead (the old tune surfacing in a breakdown) is the source tune placed in the
//   theme's key, the same first sixteen notes the live DJ took.
// - THE VOICE CHAINS (lane MELODYFX): `voices` is the tag's palette rebuilt exactly (voice-fx.js realizePalette:
//   the seed, the instruments and the keys give every amount and setting), or for an older tag the palette its
//   tune seed derives (paletteOfTune), so every replay still plays every melodic part through a chain.
// - The chain comes back with each amount as the tag stored it (to a fifteenth), the layers exactly, the moves of
//   that bar, the tempo, the beat and the visitor's steering. The hero picture's live stats are not in the tag; their
//   effect is already in the settled choices it carries.
// </claudes_code_comments>

import { decodeTag, tagLines } from './dj-tag.js';
import { TUNES, playableTunes, placeTune } from './tunes.js';
import { composeFrom } from './mix-dj.js';
import { themeOf } from './themes.js';
import { noteMidi } from './tuning.js';
import { realizePalette, paletteOfTune, HOUSE_SLOTS } from './voice-fx.js';

// the same cursor the live brain keeps (mix-dj.js take): a finished tune starts again, a note is struck once
export function barNotes(notes, bar, beats = 4) {
  if (!notes?.length) return [];
  let pos = 0;
  let offset = 0;
  let out = [];
  for (let b = 0; b <= bar; b++) {
    out = [];
    let at = 0;
    let guard = 0;
    while (at < beats - 1e-6 && guard++ < 256) {
      if (pos >= notes.length) { pos = 0; offset = 0; }
      const n = notes[pos];
      const take = Math.min(n.beats - offset, beats - at);
      if (offset === 0) out.push({ midi: n.midi, at, beats: n.beats });
      at += take;
      offset += take;
      if (offset >= n.beats - 1e-6) { pos += 1; offset = 0; }
    }
  }
  return out;
}

// THE LIVE DOOR (for lane LIVERADIO): playTag(tag) also asks the playing symphony to load the tag on its next bar
// line; the symphony subscribes here. { live: false } only rebuilds the data.
const liveSubs = new Set();
export const djTagRequests = {
  subscribe(fn) { liveSubs.add(fn); return () => liveSubs.delete(fn); },
  get listeners() { return liveSubs.size; },
};

export function playTag(tag, { tunes = TUNES, live = true } = {}) {
  const pool = playableTunes(tunes);
  const d = decodeTag(tag, { tunes: pool });
  // THE OPENING BLEND (lane OPENINGSET): the tag rebuilds the opener's whole plan; a live symphony plays it again
  if (d.kind === 'opener') return { decoded: d, opener: d.plan, tune: null, notes: [], layers: {}, chain: [], moves: [], section: 'opener', bpm: null, beat: 40, steer: {}, influence: { decay: 0.6, window: [] }, lines: tagLines(d), sentLive: live ? sendLive(tag) : 0 };
  const ids = d.tune.sources.map((s) => s.id).filter(Boolean);
  let tune = null;
  if (d.tune.kind === 'composed' && ids.length) {
    const t = composeFrom(ids, themeOf(d.theme), d.tune.seed, d.influence.window, d.influence.decay, pool);
    if (t) tune = { notes: t.notes, abc: t.abc, label: t.label, sources: t.sources, key: t.key };
  } else if (d.tune.kind === 'collected' && ids.length) {
    const src = pool.find((x) => x.id === ids[0]);
    const root = noteMidi(themeOf(d.theme).root);
    if (src) tune = { notes: placeTune(src.parsed, Number.isFinite(root) ? root : 57).notes.slice(0, 16), abc: src.abc, label: src.title, sources: [{ id: src.id, title: src.title, source: src.source ?? null }] };
  }
  const notes = tune ? barNotes(tune.notes, d.tune.bar).map((n) => ({ ...n, midi: n.midi == null ? null : n.midi + (d.keyLift || 0) })) : [];
  return {
    decoded: d,
    tune,
    notes,
    layers: { ...d.layers },
    chain: d.chain.map((c) => ({ ...c })),
    moves: d.moves.slice(),
    section: d.section,
    bpm: d.bpm,
    beat: d.beat,
    steer: d.steer,
    influence: d.influence,
    // THE VOICE CHAINS (lane MELODYFX): the tag's palette, rebuilt from its seed and keys; a tag from before the
    // voice block (or one carrying the symphony's parts) gets the house palette its tune seed derives
    voices: d.pure ? null : d.voices && HOUSE_SLOTS.every((k) => d.voices.voices.some((v) => v.slot === k)) ? realizePalette(d.voices) : paletteOfTune(d.tune.seed, d.theme, HOUSE_SLOTS),
    palette: d.voices ? realizePalette(d.voices) : null,
    lines: tagLines(d),
    sentLive: live ? sendLive(tag) : 0,
  };
}

function sendLive(tag) {
  let n = 0;
  for (const f of liveSubs) { try { f(tag); n += 1; } catch { /* a listener that fails is skipped */ } }
  return n;
}
