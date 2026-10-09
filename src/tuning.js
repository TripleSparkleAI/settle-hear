// settle-hear · tuning - every pitch the symphony plays, tuned to A = 432 Hz, and the binaural pair on its 40 Hz base.
//
// <claudes_code_comments>
// ** Function List **
// A4                    - 432: the reference pitch, in Hz (the one number every note is computed from)
// BEAT_HOME             - 40: the binaural beat the DJ always comes home to, in Hz
// FLUTE_MODE_NAME       - the mode's name, one string (the spelling of McKusker is unconfirmed; change it here only)
// FLUTE_MODE_ALIAS      - the second name the navigator gave the same mode
// FLUTE_SOUND_NAME      - the flute as a SOUND, apart from any light: 'the McKusker flute' (one string, spelling unconfirmed)
// MCKUSKER_MODE_NAME    - the tag the hero's tags row shows while the flute plays: '432 Hz McKUSKER MODE' (one string)
// midiHz(midi)          - equal temperament from A4 = 432: midi 69 is exactly 432 Hz
// noteHz(name)          - 'A4', 'C#5', 'Bb3' -> Hz (NaN for a name it cannot read)
// pitchClass(name)      - 'C' -> 0 ... 'B' -> 11, with sharps and flats
// MODES                 - scale steps of every mode the themes use (ionian ... locrian, two pentatonics)
// scaleMidi(root, mode, octaves) - the midi notes of a scale from a root midi note
// harmonics(root, n)    - the first n partials of root (n clamped to 1 .. 7): root x 1, 2, 3 ... exact ratios
// binaural(carrier, beat) - { left, right, beat }: one sine per ear, beat Hz apart (right = left + beat)
// clampBeat(b)          - a beat held inside 1 .. 45 Hz
//
// ** Technical Review **
// - A = 432 is an aesthetic choice: a common tuning in the folk world, about 31.8 cents below the A = 440 of most
//   recordings. Nothing on the site claims anything else for it.
// - Equal temperament gives the melodies (they move between keys); the static harmonic mode uses whole-number
//   multiples of the drone's root instead (just intonation), because those are the partials a string or a pipe
//   actually has, and they lock with the drone with no beating.
// - Every function is pure and refuses garbage: a NaN in, the default out, never a NaN reaching an AudioParam.
// </claudes_code_comments>

export const A4 = 432;
export const BEAT_HOME = 40;

// the navigator's names for the mode (2026-10-01). The spelling of McKusker is unconfirmed: change it here and
// every label on the site follows.
export const FLUTE_MODE_NAME = '40 Hz AND 432 Hz FLUTE MODE';
export const FLUTE_MODE_ALIAS = 'the McKusker mode';
// the sound alone (navigator, 2026-10-01): "McKusker flute" names a sound and never the 40 Hz light
export const FLUTE_SOUND_NAME = 'the McKusker flute';
// the flute's own tag (navigator, 2026-10-05: "when there is a melody playing that we call flute, or a 'clear simple
// melody', this is McKusker mode, 432 Hz: call it 432 Hz McKUSKER MODE"). A name, shown as written in every language;
// the spelling of McKusker is unconfirmed, so it lives here with the two names above and nowhere else
export const MCKUSKER_MODE_NAME = '432 Hz McKUSKER MODE';

export function midiHz(midi) {
  const m = Number(midi);
  if (!Number.isFinite(m)) return NaN;
  return A4 * Math.pow(2, (m - 69) / 12);
}

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function pitchClass(name) {
  const m = /^([A-Ga-g])([#b♯♭]*)/.exec(String(name ?? ''));
  if (!m) return NaN;
  let p = PC[m[1].toUpperCase()];
  for (const c of m[2]) p += c === '#' || c === '♯' ? 1 : -1;
  return ((p % 12) + 12) % 12;
}

export function noteMidi(name) {
  const m = /^([A-Ga-g])([#b♯♭]*)(-?\d+)$/.exec(String(name ?? '').trim());
  if (!m) return NaN;
  let p = PC[m[1].toUpperCase()];
  for (const c of m[2]) p += c === '#' || c === '♯' ? 1 : -1;
  return 12 * (Number(m[3]) + 1) + p;
}

export function noteHz(name) {
  return midiHz(noteMidi(name));
}

export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  'major pentatonic': [0, 2, 4, 7, 9],
  'minor pentatonic': [0, 3, 5, 7, 10],
};

export function scaleMidi(root, mode = 'ionian', octaves = 1) {
  const steps = MODES[mode] ?? MODES.ionian;
  const r = Number.isFinite(+root) ? +root : 69;
  const out = [];
  for (let o = 0; o < Math.max(1, octaves | 0); o++) for (const s of steps) out.push(r + 12 * o + s);
  out.push(r + 12 * Math.max(1, octaves | 0));
  return out;
}

export function harmonics(root, n) {
  const f = Number.isFinite(+root) && +root > 0 ? +root : A4 / 4;
  const k = Math.min(7, Math.max(1, Math.round(Number.isFinite(+n) ? +n : 1)));
  return Array.from({ length: k }, (_, i) => f * (i + 1));
}

export function clampBeat(b) {
  const x = Number(b);
  if (!Number.isFinite(x)) return BEAT_HOME;
  return Math.min(45, Math.max(1, x));
}

export function binaural(carrier = A4 / 2, beat = BEAT_HOME) {
  const c = Number.isFinite(+carrier) && +carrier > 0 ? +carrier : A4 / 2;
  const b = clampBeat(beat);
  return { left: c, right: c + b, beat: b };
}
