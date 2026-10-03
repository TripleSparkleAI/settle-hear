// settle-hear · tone - THE TONE RULES as constants: the envelope floors every voice keeps, the level targets each
// channel aims at, and the small helpers that apply them. The prose is TONE_RULES.md beside the README.
//
// <claudes_code_comments>
// ** Function List **
// TONE                       - the rules: attack and release floors (s), the detune (cents), the saw and square
//                              low-pass ceiling (Hz), the click guard, the crossfade of a mode swap
// LEVELS                     - RMS targets per channel, in dBFS below the master (an aim for the ear and the meter)
// dbToGain(db) / gainToDb(g) - the two conversions
// softEnvelope(ctx, out, t, { attack, peak, hold, release }) - a gain envelope that respects the floors: an attack
//                              never shorter than TONE.attackMin, a release never shorter than TONE.releaseMin
// gentleDetune(i, n, cents)  - the detune of oscillator i of n, spread evenly across +- cents
//
// ** Technical Review **
// - A raw sawtooth or square is never sent to the output: a voice that uses one puts a low-pass at or below
//   TONE.rawCeiling in front of it. A sine or triangle may go bare.
// - Every note starts from zero and returns to zero through a ramp, so no note boundary clicks. The attack floor is
//   4 ms (a struck bell) and the release floor is 60 ms; a sustained voice (flute, pad) sits far above both.
// - The levels are aims, not measurements. A lane that measures the real RMS (the master analyser, a Playwright run)
//   writes its reading beside the aim in TONE_RULES.md; the constants move only on a measurement.
// </claudes_code_comments>

export const TONE = {
  attackMin: 0.004, // s: the shortest attack any voice may use (a struck bell)
  attackSoft: 0.03, // s: the shortest attack a sustained voice may use
  releaseMin: 0.06, // s: the shortest release; a shorter one clicks at the note boundary
  releaseSoft: 0.12, // s: the release a sustained voice keeps
  detuneCents: 6, // the widest detune between unison voices (a gentle chorus, never a wobble)
  rawCeiling: 2400, // Hz: a sawtooth or square passes a low-pass at or below this before it is heard
  clickRampMin: 0.0002, // s: the shortest ramp on a pulse-train edge (the 10 kHz clicks keep their stimulus shape)
  modeFade: 6, // s: the crossfade when the shuffle moves from one mode to the next
  pickFade: 0.8, // s: the crossfade when a person picks a mode by hand
};

// RMS aims per channel, dBFS at the master's input (the master limiter sits above them all). Measured readings go in
// TONE_RULES.md, never here, until they move a constant.
export const LEVELS = {
  static: -18, // the hero's own crackle and hiss: loudest
  binaural: -24, // the pair under it
  pad: -27, // the mode pad, just under the pair
  flute: -28, // the flute and the symphony's melody voices
  house: -20, // the house set as a whole, into its own limiter
  clicks: -30, // the 10 kHz click train: a demonstration, kept quiet
  jam: -26, // the instruments a visitor hits and the loop that repeats them (settle-hear jam.js): under the static
  logo: -22, // the site's logo click (sites/settle-site/src/logoSounds.js): one short note, under the static
};

export function dbToGain(db) {
  return Number.isFinite(db) ? Math.pow(10, db / 20) : 0;
}

export function gainToDb(g) {
  return g > 0 ? 20 * Math.log10(g) : -Infinity;
}

export function softEnvelope(ctx, out, t, { attack = TONE.attackSoft, peak = 0.2, hold = 0, release = TONE.releaseSoft } = {}) {
  const a = Math.max(TONE.attackMin, Number.isFinite(attack) ? attack : TONE.attackSoft);
  const r = Math.max(TONE.releaseMin, Number.isFinite(release) ? release : TONE.releaseSoft);
  const h = Math.max(0, Number.isFinite(hold) ? hold : 0);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(Math.max(0, peak), t + a);
  if (h > 0) g.gain.setValueAtTime(Math.max(0, peak), t + a + h);
  g.gain.setTargetAtTime(0, t + a + h, r / 3);
  g.connect(out);
  return { gain: g, attack: a, release: r, end: t + a + h + r * 3 };
}

export function gentleDetune(i, n, cents = TONE.detuneCents) {
  if (!(n > 1)) return 0;
  return -cents + (2 * cents * i) / (n - 1);
}
