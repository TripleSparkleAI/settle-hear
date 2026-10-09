// settle-hear · dj-trained-notes - THE SEAM FOR STAGE 3, THE NOTE LEVEL (lane DJWIRE, for lane DJNOTES): a stage-3 piece
// (`djnotes-piece/v1`, SETTLE/DJ_CHANNEL.md) turned into the trained set the house DJ already plays, with the piece's
// pitched notes carried bar by bar, so the hero can play a piece the moment the pieces land.
//
// <claudes_code_comments>
// ** Function List **
// PIECE_FORMAT                - 'djnotes-piece/v1'
// GM_ROLE                     - the GM drum pitches of a piece's drums track, by groove role (kick 36; snare 38 and
//                               clap 39; hats 42, 46 and 51; percussion 82; the crash 49 is the crash event)
// NOTE_ROLES                  - the pitched tracks the seam carries: bass, chords, lead, arp
// isPiece(x)                  - true for a djnotes-piece/v1 object with its clock, arrangement and tracks
// shiftTo(fromPc, toPc)       - the semitones (-6..5) that move one key's tonic to another's
// pieceToSet(piece, opts)     - the piece as a trained set (dj-trained.js's shape): its own grid, gates, arc and
//                               events; its drums track as the settled steps, levels, hat voices and clap; its swing;
//                               and `notes`, the pitched tracks by role, each note [step, dur, pitch, vel] with its
//                               absolute sixteenth, moved by opts.shift semitones
// notesOfBar(notes, bar)      - one bar's notes by role, each [step in the bar 0..15, dur, pitch, vel]
// pieceMode(key)              - the house mode a piece's key plays in: 'aeolian' for a minor piece, 'ionian' for a
//                               major one (lane PIECESPLAY)
// pieceRoot(key, near, shift) - the MIDI note of the piece's tonic nearest `near` (-6..+5 semitones from it)
// chordOfBar(set, bar, root)  - the piece's chord of a bar as { label, name, minor, notes: three MIDI notes from the
//                               chord's root at or above `root` } (stage 3's label = 2 x root above the tonic + minor)
// leadOfBar(notes)            - a bar's lead notes as the house lead plays them: { midi, at, beats, step, vel }
//
// ** Technical Review **
// - THE FORMAT is DJNOTES' (DJ_CHANNEL.md, 2026-10-06): steps_per_bar 16, bars, bpm, swing, key { tonic, mode },
//   the arrangement exactly as arrangements2.json, chords per bar, and tracks [{ name, channel, program, notes }]
//   whose notes are [step, dur, pitch, vel] with step the absolute sixteenth from the piece's start.
// - THE DRUMS: a piece's drums track is stage 2's own settled groove for it, so the seam reads it back into the
//   step strings dj-trained-play.js plays (a level is vel / 127 as a ninths digit; a hat is c, o or r by its pitch;
//   the snare role is a clap when the piece used one). The crash pitch is the phrase level's crash, kept in events.
// - THE KEY (lane PIECESPLAY, navigator 2026-10-06: "the piece's own lead, play minor as it is"): a piece plays in its
//   own key and mode under any theme, so the brain gives pieceToSet no shift and the bar's root, mode and chord follow
//   the piece (pieceRoot, pieceMode, chordOfBar). DJWIRE's shift stays in the seam because an older tag may carry one.
// - THE LEAD: the piece's own lead track is the hero's lead while the piece plays (leadOfBar), in place of the tune
//   the DJ composed; the chords carry the piece's labels and names so a page can say the chord of the bar.
// - Nothing here settles: a piece was settled and fenced by DJNOTES on the Spark. The seam only carries it.
// </claudes_code_comments>

export const PIECE_FORMAT = 'djnotes-piece/v1';
export const GM_ROLE = { 36: 'kick', 35: 'kick', 38: 'snare', 40: 'snare', 39: 'clap', 42: 'hats', 44: 'hats', 46: 'hats', 51: 'hats', 59: 'hats', 82: 'perc' };
const HAT_VOICE = { 42: 'c', 44: 'c', 46: 'o', 51: 'r', 59: 'r' };
export const NOTE_ROLES = Object.freeze(['bass', 'chords', 'lead', 'arp']);
const GROOVE = ['kick', 'snare', 'hats', 'perc'];

export function isPiece(x) {
  return !!x && typeof x === 'object' && (x.format === PIECE_FORMAT || x.format == null) && Number.isInteger(x.bars) && x.bars > 0
    && Array.isArray(x.grid) && Array.isArray(x.roles) && Array.isArray(x.tracks) && Array.isArray(x.events);
}

export const shiftTo = (fromPc, toPc) => {
  const d = ((((toPc - fromPc) % 12) + 12) % 12);
  return d > 5 ? d - 12 : d;
};

const digit = (v) => (v <= 0 ? '.' : String(Math.min(9, Math.max(1, Math.floor(9 * v + 0.5)))));

export function pieceToSet(piece, { shift = 0, family = null, seed = 0 } = {}) {
  if (!isPiece(piece)) throw new Error('not a djnotes-piece/v1');
  const bars = piece.bars;
  const blocks = Math.ceil(bars / 8);
  const nb = 8 * blocks;
  const lv = Array.from({ length: nb }, () => GROOVE.map(() => new Array(16).fill(0)));
  const hv = Array.from({ length: nb }, () => new Array(16).fill('.'));
  let clap = false;
  const drums = piece.tracks.find((tr) => tr.name === 'drums' || tr.channel === 9);
  for (const [step, , pitch, vel] of drums?.notes ?? []) {
    const b = Math.floor(step / 16);
    const i = step % 16;
    if (b < 0 || b >= nb) continue;
    let role = GM_ROLE[pitch];
    if (!role) continue;
    if (role === 'clap') { clap = true; role = 'snare'; }
    const r = GROOVE.indexOf(role);
    lv[b][r][i] = Math.max(lv[b][r][i], Math.min(1, Math.max(0.15, (vel ?? 100) / 127)));
    if (role === 'hats') hv[b][i] = HAT_VOICE[pitch] ?? 'c';
  }
  const notes = {};
  for (const role of NOTE_ROLES) {
    const tr = piece.tracks.find((x) => x.name === role);
    notes[role] = (tr?.notes ?? []).map(([s, d, p, v]) => [s, d, p + shift, v]);
  }
  const pad = (row, fill) => (row.length >= nb ? row.slice(0, nb) : row + fill.repeat(nb - row.length));
  return {
    family: family ?? piece.family ?? 'house',
    seed: seed >>> 0,
    blocks,
    bars: nb,
    shape: -1,
    arc: (piece.arc ?? []).slice(0, blocks),
    gates: (piece.gates ?? []).slice(0, blocks),
    grid: piece.grid.map((row) => row.slice(0, blocks)),
    roles: piece.roles.slice(),
    events_order: (piece.events_order ?? []).slice(),
    events: piece.events.map((row) => pad(row, '.')),
    groove_roles: GROOVE.slice(),
    steps: lv.map((bar) => bar.map((row) => row.map(digit).join(''))),
    hats: hv.map((row) => row.join('')),
    clap,
    feel: { swing: Math.max(0, Math.min(0.4, Number(piece.swing) || 0)), swung: (Number(piece.swing) || 0) > 0, played: false, spread: { kick: 0, snare: 0, hats: 0 } },
    onRuleResettles: 0,
    notes,
    chords: Array.isArray(piece.chords) ? piece.chords.slice(0, nb) : [],
    chordNames: Array.isArray(piece.chord_names) ? piece.chord_names.slice(0, nb) : [],
    piece: { id: piece.id ?? null, name: piece.name ?? null, key: piece.key ?? null, shift },
  };
}

export function notesOfBar(notes, bar) {
  if (!notes) return null;
  const out = {};
  for (const [role, list] of Object.entries(notes)) {
    out[role] = list.filter(([s]) => Math.floor(s / 16) === bar).map(([s, d, p, v]) => [s % 16, d, p, v]);
  }
  return out;
}

export const pieceMode = (key) => (key?.mode === 'minor' ? 'aeolian' : 'ionian');

export function pieceRoot(key, near = 57, shift = 0) {
  const pc = ((((Number(key?.tonic) || 0) + shift) % 12) + 12) % 12;
  const base = Math.round(Number(near) || 57);
  const d = ((((pc - base) % 12) + 12) % 12);
  return base + (d > 5 ? d - 12 : d);
}

export function chordOfBar(set, bar, root) {
  const label = set?.chords?.[bar];
  if (!Number.isInteger(label) || label < 0) return null;
  const minor = label % 2 === 1;
  const r = root + Math.floor(label / 2);
  return { label, name: set.chordNames?.[bar] ?? null, minor, notes: [r, r + (minor ? 3 : 4), r + 7] };
}

export function leadOfBar(notes) {
  return (notes?.lead ?? []).map(([step, dur, pitch, vel]) => ({ midi: pitch, at: step / 4, beats: Math.max(0.0625, dur / 4), step, vel }));
}
