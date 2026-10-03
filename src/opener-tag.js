// settle-hear · opener-tag - THE OPENING BLEND'S TAG, in the dj-tag format: "<THEME>.open.v1.<base32>". It packs
// every settled choice of the opener, so the opener is rebuilt note for note from the tag alone, replayed, and voted
// on like any DJ situation.
//
// <claudes_code_comments>
// ** Function List **
// OPEN_TAG_RE                - the tag's shape: four letters, ".open.v", a version, ".", Crockford base32
// isOpenerTag(tag)           - true for a string of that shape
// encodeOpenerTag(choices, at) - the opener's choices (opener.js settleOpener) and the second it is at -> the tag
// decodeOpenerTag(tag)       - the tag -> { kind: 'opener', theme, pure: false, section: 'opener', choices, plan, at,
//                              layers: {}, chain: [], moves: [], tag } (the house fields empty, so a reader of house
//                              tags passes over it safely)
// openerTagLines(d)          - every field as [name, value] in plain words, like dj-tag.js tagLines
//
// ** Technical Review **
// - THE FIELDS, in packing order (bits): theme 3 · choice seed 32 (it places the bells) · the seven slot durations in
//   whole seconds 7 each (their sum is the length) · rate order 3 (an index into RATE_ORDERS) · first timbre 3 ·
//   harmonic timbre 3 · key shift 2 · harmonic ratio 2 · gamma carrier 2 · pad cutoff 2 · bell gap 2 · handover
//   ((s - 24) / 4) 3 · the second the opener is at 9.
// - The prefix is the theme code dj-tag.js uses (CRYS, HIGH, DEEP, CATH, EMBE); the mode word is "open", so the
//   house tags ("house", "pure") and the opener's never collide. Version 1.
// - This file imports nothing from dj-tag.js (dj-tag.js imports this one), so there is no import cycle.
// </claudes_code_comments>

import { THEME_KEYS } from './themes.js';
import { RATE_ORDERS, TIMBRE_KEYS, KEY_SHIFTS, HARM_RATIOS, GAMMA_MULTS, PAD_CUTS, BELL_GAPS, OPENER_RATES, GAMMA_RATE, openerPlan } from './opener.js';

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE = { crystals: 'CRYS', highlands: 'HIGH', deepsea: 'DEEP', cathedral: 'CATH', embers: 'EMBE' };
export const OPEN_TAG_RE = /^([A-Z]{4})\.open\.v(\d+)\.([0-9A-Z]+)$/i;
const VERSION = 1;

export const isOpenerTag = (tag) => typeof tag === 'string' && OPEN_TAG_RE.test(tag.trim());

const idx = (list, v) => Math.max(0, list.findIndex((x) => (Array.isArray(x) && Array.isArray(v) ? x.join() === v.join() : x === v)));

export function encodeOpenerTag(c, at = 0) {
  const bits = [];
  const put = (v, n) => { const x = Math.max(0, Math.floor(Number(v) || 0)); for (let i = n - 1; i >= 0; i--) bits.push(Math.floor(x / 2 ** i) % 2); };
  const theme = THEME_KEYS.includes(c.theme) ? c.theme : 'highlands';
  put(THEME_KEYS.indexOf(theme), 3);
  put((c.seed ?? 0) >>> 0, 32);
  for (let i = 0; i < 7; i++) put(Math.min(127, c.durations?.[i] ?? 0), 7);
  put(idx(RATE_ORDERS, c.rateOrder), 3);
  put(idx(TIMBRE_KEYS, c.timbreFirst), 3);
  put(idx(TIMBRE_KEYS, c.timbreHarm), 3);
  put(idx(KEY_SHIFTS, c.keyShift), 2);
  put(idx(HARM_RATIOS, c.harmRatio), 2);
  put(idx(GAMMA_MULTS, c.gammaMult), 2);
  put(idx(PAD_CUTS, c.padCut), 2);
  put(Math.min(BELL_GAPS.length - 1, c.bellGap ?? 1), 2);
  put(Math.round(((c.handover ?? 32) - 24) / 4), 3);
  put(Math.min(511, Math.round(at)), 9);
  let s = '';
  for (let i = 0; i < bits.length; i += 5) { let v = 0; for (let k = 0; k < 5; k++) v = v * 2 + (bits[i + k] ?? 0); s += B32[v]; }
  return `${CODE[theme]}.open.v${VERSION}.${s}`;
}

export function decodeOpenerTag(tag) {
  const m = OPEN_TAG_RE.exec(String(tag ?? '').trim());
  if (!m) throw new Error('not an opener tag');
  if (Number(m[2]) !== VERSION) throw new Error(`opener tag version ${m[2]} is not ${VERSION}`);
  const bits = [];
  for (const ch of m[3].toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0')) {
    const v = B32.indexOf(ch);
    if (v < 0) throw new Error(`not a tag character: ${ch}`);
    for (let k = 4; k >= 0; k--) bits.push(Math.floor(v / 2 ** k) % 2);
  }
  let p = 0;
  const get = (n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 2 + (bits[p++] ?? 0); return v; };
  const theme = THEME_KEYS[get(3)] ?? 'highlands';
  const seed = get(32) >>> 0;
  const durations = Array.from({ length: 7 }, () => get(7));
  const choices = {
    v: 1,
    seed,
    theme,
    durations,
    rateOrder: (RATE_ORDERS[get(3)] ?? RATE_ORDERS[0]).slice(),
    timbreFirst: TIMBRE_KEYS[get(3)] ?? 'pure',
    timbreHarm: TIMBRE_KEYS[get(3)] ?? 'warm',
    keyShift: KEY_SHIFTS[get(2)] ?? 0,
    harmRatio: HARM_RATIOS[get(2)] ?? 1.5,
    gammaMult: GAMMA_MULTS[get(2)] ?? 3,
    padCut: PAD_CUTS[get(2)] ?? 900,
    bellGap: Math.min(BELL_GAPS.length - 1, get(2)),
    handover: 24 + 4 * get(3),
  };
  const at = get(9);
  return { kind: 'opener', theme, pure: false, section: 'opener', choices, plan: openerPlan(choices), at, layers: {}, chain: [], moves: [], tag: String(tag).trim() };
}

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const hzName = (f) => { const m = Math.round(69 + 12 * Math.log2(f / 432)); return NAMES[((m % 12) + 12) % 12]; };

export function openerTagLines(d) {
  if (!d?.plan) return [];
  const c = d.choices;
  const P = d.plan;
  return [
    ['mode', 'opening blend (ambient, no beats)'],
    ['theme', d.theme],
    ['length', `${mmss(P.length)}, then a ${P.handover} s handover to the DJ`],
    ['at', mmss(d.at)],
    ['key', `${hzName(P.f0)} (${P.f0.toFixed(1)} Hz), gliding to ${hzName(P.fEnd)}`],
    ['rates', `${c.rateOrder.map((k) => OPENER_RATES[k].label).join(', then ')}; ${GAMMA_RATE} Hz in the gamma slot`],
    ['tones', `${c.timbreFirst} first tone, ${c.timbreHarm} harmonic tone at x${c.harmRatio}`],
    ['pad', `low-pass ${c.padCut} Hz`],
    ['bells', `${P.bells.length} in the bloom`],
  ];
}
