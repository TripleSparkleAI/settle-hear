// settle-hear · modes - THE BINAURAL MODES: the popular beats and carriers from the survey (runs/binauralmodes/
// BINAURAL_MODES_SURVEY.md), one constant table, and the shuffle's fixed numbers.
//
// <claudes_code_comments>
// ** Function List **
// BINAURAL_MODES             - the seven modes: { key, label, beat (Hz), carrier (left ear, Hz), pad, static, note,
//                              listen, group: 'modes' }
// MODE_KEYS                  - their keys, in menu order
// modeOf(key)                - one mode by key, or undefined
// isMode(key)                - true for a key in the table
// MODE_CYCLE                 - the shuffle's numbers: the stretch each mode plays (s), the crossfade (s), a hand pick's
//                              crossfade (s), the longest wait for a bar line before the swap goes ahead without one
// modePair(mode)             - { left, right, beat } for a mode (the right ear is carrier + beat)
//
// ** Technical Review **
// - Carriers are just divisions of A = 432 (108, 144, 162, 216, 288), except LOVE 528, whose carrier is the number
//   the mode is named for. Beats are the band's popular number: 40 (gamma, searched by number), 14 (beta, Greenred),
//   10 (alpha, the apps' default), 7.83 (Schumann), 6 (theta, the apps' preset), 3 (delta, the two biggest sleep
//   videos are 3.2 and 3.0 Hz).
// - pad: the mode's pad voice: cutoff (Hz) of its low-pass, level (0..1 of the pad's own gain), ratios of the
//   chord above the carrier (just intonation), breath (Hz) of the slow filter sweep, shimmer (0..1) the slow
//   ring-mod amount on the pad (0 = off).
// - static: the fader (0..1) of the hero's own sound under the mode; every mode has it at STATIC_LOUDEST, the
//   loudest layer (the navigator's rule: the SETTLE itself mixed in at high priority across every programme).
// - A mode is also a gamma sound key: binaural.js builds it with the layers { binaural, pad } at the mode's beat and
//   carrier, so createGammaSound({ mode: 'alpha-calm' }) plays it like any other key.
// </claudes_code_comments>

import { TONE } from './tone.js';

const chord = (...ratios) => ratios;
// THE SETTLE ITSELF, mixed in at high priority (navigator, 2026-10-01): the hero's own static is the loudest layer of
// every programme, the same fader DEFAULT MODE gives it (heroControls DEFAULT_MIX.picture = 0.9)
const STATIC_LOUDEST = 0.9;

export const BINAURAL_MODES = [
  {
    key: 'gamma-focus', label: 'GAMMA FOCUS', beat: 40, carrier: 216, group: 'modes',
    pad: { cutoff: 1600, level: 0.5, ratios: chord(1, 1.5, 2, 3), breath: 0.08, shimmer: 0.25 },
    static: STATIC_LOUDEST,
    note: '40 Hz between the ears on a 216 / 256 Hz pair, an airy pad above, the picture\'s static under.',
    listen: 'a fast rough shimmer between the ears; an airy pad',
  },
  {
    key: 'beta-study', label: 'BETA STUDY', beat: 14, carrier: 288, group: 'modes',
    pad: { cutoff: 1900, level: 0.45, ratios: chord(1, 1.5, 2, 2.5), breath: 0.1, shimmer: 0.15 },
    static: STATIC_LOUDEST,
    note: '14 Hz on a 288 / 302 Hz pair: a quick, even flutter; the brightest pad.',
    listen: 'a quick even flutter; the brightest pad',
  },
  {
    key: 'alpha-calm', label: 'ALPHA CALM', beat: 10, carrier: 216, group: 'modes',
    pad: { cutoff: 1200, level: 0.55, ratios: chord(1, 1.5, 2, 2.5), breath: 0.06, shimmer: 0.2 },
    static: STATIC_LOUDEST,
    note: '10 Hz on a 216 / 226 Hz pair: a soft slow wobble; a warm pad.',
    listen: 'a soft slow wobble; a warm pad',
  },
  {
    key: 'schumann', label: 'SCHUMANN 7.83', beat: 7.83, carrier: 144, group: 'modes',
    pad: { cutoff: 900, level: 0.55, ratios: chord(1, 1.5, 2, 3), breath: 0.05, shimmer: 0.2 },
    static: STATIC_LOUDEST,
    note: '7.83 Hz on a 144 / 151.83 Hz pair: a slow pulse; a low pad.',
    listen: 'a slow pulse; a low pad',
  },
  {
    key: 'theta-deep', label: 'THETA DEEP', beat: 6, carrier: 162, group: 'modes',
    pad: { cutoff: 800, level: 0.55, ratios: chord(1, 1.5, 2, 2.5), breath: 0.04, shimmer: 0.3 },
    static: STATIC_LOUDEST,
    note: '6 Hz on a 162 / 168 Hz pair: a slow swell; a dark pad.',
    listen: 'a slow swell; a dark pad',
  },
  {
    key: 'delta-sleep', label: 'DELTA SLEEP', beat: 3, carrier: 108, group: 'modes',
    pad: { cutoff: 600, level: 0.5, ratios: chord(1, 1.5, 2, 3), breath: 0.03, shimmer: 0.15 },
    static: STATIC_LOUDEST,
    note: '3 Hz on a 108 / 111 Hz pair: a very slow breathing; the lowest, softest pad.',
    listen: 'a very slow breathing; the lowest, softest pad',
  },
  {
    key: 'love-528', label: 'LOVE 528', beat: 6, carrier: 528, group: 'modes',
    pad: { cutoff: 2200, level: 0.4, ratios: chord(1, 1.25, 1.5, 2), breath: 0.07, shimmer: 0.35 },
    static: STATIC_LOUDEST,
    note: '6 Hz on a 528 / 534 Hz pair: the one carrier outside the 432 family, high and bright; a glassy pad.',
    listen: 'the high bright carrier; a glassy pad',
  },
];

export const MODE_KEYS = BINAURAL_MODES.map((m) => m.key);
const BY_KEY = new Map(BINAURAL_MODES.map((m) => [m.key, m]));

export function modeOf(key) {
  return BY_KEY.get(String(key));
}

export function isMode(key) {
  return BY_KEY.has(String(key));
}

export const MODE_CYCLE = {
  stretch: 180, // s: each mode plays about three minutes before the shuffle moves on
  fade: TONE.modeFade, // s: the crossfade between modes
  pickFade: TONE.pickFade, // s: the crossfade when a person picks a mode by hand
  barWait: 8, // s: after the stretch, the swap waits for a DJ bar line this long, then goes ahead without one
};

export function modePair(mode) {
  const m = typeof mode === 'string' ? modeOf(mode) : mode;
  if (!m) return null;
  return { left: m.carrier, right: m.carrier + m.beat, beat: m.beat };
}
