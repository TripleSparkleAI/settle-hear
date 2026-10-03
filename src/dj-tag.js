// settle-hear · dj-tag - THE TAG: one string that holds the whole DJ situation at a moment, short enough to read
// aloud in parts, complete enough to replay it from the source code alone. A vote is stored against one tag.
//
// <claudes_code_comments>
// ** Function List **
// TAG_VERSION                 - 1
// TAG_FX_ALPHABET             - every rack key in a fixed, APPEND-ONLY order (a tag stores an index into it)
// HUM_RATE_KEYS / HUM_VARIANT_KEYS / TEXTURE_KEYS / DRUM_FAMILIES / BASS_STYLES / SECTION_ORDER / TUNE_KINDS - the
//                               other closed vocabularies a tag stores by index (append-only too)
// tuneHash(id)                - a tune id -> 16 bits (FNV-1a), how a tag names a source tune
// themeCode(key)              - the readable prefix's theme word: CRYS, HIGH, DEEP, CATH, EMBE
// encodeTag(situation)        - a situation -> "HIGH.house.v1.<code>"; <code> is Crockford base32 of the packed bits
// decodeTag(tag, { tunes })   - the tag -> every field, with tune ids, titles and books resolved from the tune list
// (an opener tag, "<THEME>.open.v1.<code>", decodes through opener-tag.js; lane OPENINGSET)
// tagLines(decoded)           - every field as [name, value] pairs in plain words (the parts popover reads these)
// situationOf(state)          - the symphony's live state -> the situation encodeTag packs
//
// ** Technical Review **
// - THE CHOICE (navigator, 2026-10-02: "voting should be on ONE tag, and the tag should contain all the info on that
//   DJ situation"): a FULL ATTRIBUTE TAG, not a short id with a stored record. Every field below is packed into the
//   string, so playTag (dj-replay.js) rebuilds the situation from the code and the tune list with nothing stored.
//   One field is left out on purpose and said so: the hero picture's live stats (heat, overlap) are inputs, not
//   the situation; their effect is already in the settled choices the tag carries.
// - THE FIELDS, in packing order (bits): theme 3 · pure 1 · section 3 · set bar 7 · set number 8 · key lift 2 ·
//   tune kind 2 · composer seed 32 · sources (count 2, then 16 each) · tune bar 8 · key pc 4 · bpm 8 ·
//   beat x100 13 · mix layers 11 · energy 4 · chain (count 3, then fx index 7 + amount 4 each) · moves (count 2,
//   then fx index 7 each) · hum rate 3 · hum variant 3 · texture 2 · drum family 4 · bass style 2 · steering (six DJ
//   leans 2 each, five mix leans 2 each, wanted beat 4, wanted theme 3, hold beat 1, lock theme 1, eight track
//   holds 1 each) · influence (count 3, decay x20 5, then per set: key pc 4, mode 3, motif 4 x 4, theme 3,
//   energy 4, vote 3) · THE VOICE CHAINS, last (lane MELODYFX: present 1, then seed 32, voices - 1 3, per voice
//   slot 3, instrument 4, extra effects 3, then fx index 7 each; the settings are rebuilt from the seed).
// - The readable prefix says the theme, the mode and the version: "HIGH.house.v1." or "CATH.pure.v1.". The code
//   after it is Crockford base32 (0-9 A-Z without I L O U), so a tag survives being read out and typed back.
// - A source tune is named by a 16-bit hash of its id, so adding tunes to the list never breaks an old tag; the
//   tests check the hashes of every tune in the list are distinct.
// </claudes_code_comments>

import { THEME_KEYS } from './themes.js';
import { DJ_CHOICES } from './dj.js';
import { STEER_BEATS, STEER_TRACKS } from './steer.js';
import { MIX_KEYS } from './mix-machine.js';
import { SECTION_KEYS } from './mix-planner.js';
import { isOpenerTag, decodeOpenerTag, openerTagLines } from './opener-tag.js';
import { VOICE_SLOTS, INST_ALPHABET, realizePalette, chainLine } from './voice-fx.js';

export const TAG_VERSION = 1;

export const TAG_FX_ALPHABET = Object.freeze([
  'lowpass-sweep', 'highpass-rise', 'wah', 'pump', 'kit', 'tape-delay', 'ping-pong', 'plate', 'chorus', 'phaser',
  'flanger', 'bitcrush', 'rate-reduce', 'ring-mod', 'trance-gate', 'arpeggiator', 'octave-doubler', 'supersaw',
  'sub-bass', 'vinyl-riser', 'stutter', 'shimmer', 'formant', 'soft-clip', 'vocoder-static', 'ring-shimmer',
  'sweep-in', 'auto-pan', 'tilt-eq', 'comb', 'dub-echo', 'tape-stop', 'gated-reverb', 'isolator-drop', 'rotary',
  'riser', 'downlifter', 'reverse-cymbal', 'snare-roll', 'hall', 'one-bar-silence', 'filter-drop', 'tape-stop-bus',
  'key-lift', 'sidechain', 'neutral-hum', 'evolving-pad', 'field-texture',
  // lane MELODYFX: the voice inserts
  'warm-drive', 'tape-wow', 'drift-filter', 'ensemble', 'vibrato', 'tremolo', 'warm-room',
]);
export const SECTION_ORDER = Object.freeze(['intro', 'build', 'peak', 'breakdown', 'outro', 'hum']);
export const TUNE_KINDS = Object.freeze(['none', 'collected', 'composed', 'generated']);
export const HUM_RATE_KEYS = Object.freeze(['delta', 'theta', 'schumann', 'alpha', 'beta', 'gamma']);
export const HUM_VARIANT_KEYS = Object.freeze(['pulse', 'breath', 'rain', 'motif', 'pair']);
export const TEXTURE_KEYS = Object.freeze(['wind', 'water', 'birds']);
export const DRUM_FAMILIES = Object.freeze(['chicago', 'deep', 'acid', 'garage', 'progressive', 'tech', 'filter-house', 'ambient', 'dub-techno', 'balearic']);
export const BASS_STYLES = Object.freeze(['sub', 'rolling', 'acid', 'organ']);
const MODES7 = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'];
const STEER_MIX = ['energy', 'drums', 'bass', 'pad', 'fx'];
const DJ_KEYS = DJ_CHOICES.map((c) => c.key);
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const THEME_CODE = { crystals: 'CRYS', highlands: 'HIGH', deepsea: 'DEEP', cathedral: 'CATH', embers: 'EMBE' };

export function themeCode(key) { return THEME_CODE[key] ?? 'HIGH'; }

export function tuneHash(id) {
  let h = 0x811c9dc5;
  for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h ^ (h >>> 16)) & 0xffff;
}

function writer() {
  const bits = [];
  return {
    put(v, n) { const x = Math.max(0, Math.floor(Number(v) || 0)); for (let i = n - 1; i >= 0; i--) bits.push(Math.floor(x / 2 ** i) % 2); },
    bits,
  };
}
function reader(bits) {
  let at = 0;
  return { get(n) { let v = 0; for (let i = 0; i < n; i++) v = v * 2 + (bits[at++] ?? 0); return v; }, get left() { return bits.length - at; } };
}
function toB32(bits) {
  let s = '';
  for (let i = 0; i < bits.length; i += 5) { let v = 0; for (let k = 0; k < 5; k++) v = v * 2 + (bits[i + k] ?? 0); s += B32[v]; }
  return s;
}
function fromB32(s) {
  const bits = [];
  for (const ch of s.toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0')) {
    const v = B32.indexOf(ch);
    if (v < 0) throw new Error(`not a tag character: ${ch}`);
    for (let k = 4; k >= 0; k--) bits.push(Math.floor(v / 2 ** k) % 2);
  }
  return bits;
}
const idx = (list, v, fallback = 0) => { const i = list.indexOf(v); return i < 0 ? fallback : i; };
const lean2 = (v) => (v > 0 ? 1 : v < 0 ? 2 : 0);
const unlean2 = (x) => (x === 1 ? 1 : x === 2 ? -1 : 0);

// situation: { theme, pure, section, setBar, set, keyLift, tune: { kind, seed, sources: [ids], bar }, keyPc, bpm, beat,
//   layers: { key: bool }, energy, chain: [{ key, amount }], moves: [keys], hum: { rate, variant }, texture,
//   drumFamily, bassStyle, steer: { leans, mix, wantBeat, wantTheme, holdBeat, lockTheme, tracks },
//   influence: { decay, window: [records] } }
export function encodeTag(s) {
  const w = writer();
  const theme = THEME_KEYS.includes(s.theme) ? s.theme : 'highlands';
  w.put(idx(THEME_KEYS, theme), 3);
  w.put(s.pure ? 1 : 0, 1);
  w.put(idx(SECTION_ORDER, s.section), 3);
  w.put(Math.min(127, s.setBar ?? 0), 7);
  w.put((s.set ?? 0) % 256, 8);
  w.put(Math.min(3, s.keyLift ?? 0), 2);
  const tune = s.tune ?? {};
  w.put(idx(TUNE_KINDS, tune.kind ?? 'none'), 2);
  w.put((tune.seed ?? 0) >>> 0, 32);
  const src = (tune.sources ?? []).slice(0, 3);
  w.put(src.length, 2);
  for (const id of src) w.put(typeof id === 'number' ? id : tuneHash(id), 16);
  w.put(Math.min(255, tune.bar ?? 0), 8);
  w.put(((s.keyPc ?? 0) % 12 + 12) % 12, 4);
  w.put(Math.min(255, Math.round(s.bpm ?? 120)), 8);
  w.put(Math.min(8191, Math.round((s.beat ?? 40) * 100)), 13);
  for (const k of MIX_KEYS) w.put(s.layers?.[k] ? 1 : 0, 1);
  w.put(Math.round(Math.min(1, Math.max(0, s.energy ?? 0)) * 15), 4);
  const chain = (s.chain ?? []).filter((c) => TAG_FX_ALPHABET.includes(c.key)).slice(0, 7);
  w.put(chain.length, 3);
  for (const c of chain) { w.put(idx(TAG_FX_ALPHABET, c.key), 7); w.put(Math.round(Math.min(1, Math.max(0, c.amount ?? 0.5)) * 15), 4); }
  const moves = (s.moves ?? []).filter((k) => TAG_FX_ALPHABET.includes(k)).slice(0, 3);
  w.put(moves.length, 2);
  for (const k of moves) w.put(idx(TAG_FX_ALPHABET, k), 7);
  w.put(idx(HUM_RATE_KEYS, s.hum?.rate, 3), 3);
  w.put(idx(HUM_VARIANT_KEYS, s.hum?.variant), 3);
  w.put(idx(TEXTURE_KEYS, s.texture), 2);
  w.put(idx(DRUM_FAMILIES, s.drumFamily), 4);
  w.put(idx(BASS_STYLES, s.bassStyle), 2);
  const st = s.steer ?? {};
  for (const k of DJ_KEYS) w.put(lean2(st.leans?.[k] ?? 0), 2);
  for (const k of STEER_MIX) w.put(lean2(st.mix?.[k] ?? 0), 2);
  w.put(st.wantBeat == null ? 0 : idx(STEER_BEATS, st.wantBeat, -1) + 1, 4);
  w.put(st.wantTheme == null ? 0 : idx(THEME_KEYS, st.wantTheme, -1) + 1, 3);
  w.put(st.holdBeat ? 1 : 0, 1);
  w.put(st.lockTheme ? 1 : 0, 1);
  for (const t of STEER_TRACKS) w.put(st.tracks?.[t] === false ? 1 : 0, 1);
  const inf = s.influence ?? {};
  const win = (inf.window ?? []).slice(0, 4);
  w.put(win.length, 3);
  w.put(Math.round(Math.min(1, Math.max(0, inf.decay ?? 0.6)) * 20), 5);
  for (const r of win) {
    w.put(((r.keyPc ?? 0) % 12 + 12) % 12, 4);
    w.put(idx(MODES7, r.mode), 3);
    for (let i = 0; i < 4; i++) w.put(Number.isFinite(r.motif?.[i]) ? Math.max(-7, Math.min(7, r.motif[i])) + 8 : 0, 4);
    w.put(r.theme ? idx(THEME_KEYS, r.theme, -1) + 1 : 0, 3);
    w.put(Math.round(Math.min(1, Math.max(0, r.energy ?? 0.5)) * 15), 4);
    w.put(Number.isInteger(r.vote) ? r.vote : 0, 3);
  }
  // THE VOICE CHAINS (lane MELODYFX), appended last so a tag written before them still reads (its missing bits read
  // as 0: no voice block, and the replay derives a palette from the tune seed)
  const V = s.voices;
  const vs = (V?.voices ?? []).filter((v) => VOICE_SLOTS.includes(v.slot) && INST_ALPHABET.includes(v.inst)).slice(0, 8);
  if (V && vs.length) {
    w.put(1, 1);
    w.put((V.seed ?? 0) >>> 0, 32);
    w.put(vs.length - 1, 3);
    for (const v of vs) {
      w.put(VOICE_SLOTS.indexOf(v.slot), 3);
      w.put(INST_ALPHABET.indexOf(v.inst), 4);
      const keys = (v.keys ?? []).filter((k) => TAG_FX_ALPHABET.includes(k)).slice(0, 7);
      w.put(keys.length, 3);
      for (const k of keys) w.put(TAG_FX_ALPHABET.indexOf(k), 7);
    }
  }
  return `${themeCode(theme)}.${s.pure ? 'pure' : 'house'}.v${TAG_VERSION}.${toB32(w.bits)}`;
}

export function decodeTag(tag, { tunes = [] } = {}) {
  // THE OPENING BLEND's tag (lane OPENINGSET, opener-tag.js): "<THEME>.open.v1.<code>", its own fields
  if (isOpenerTag(tag)) return decodeOpenerTag(tag);
  const m = /^([A-Z]{4})\.(pure|house)\.v(\d+)\.([0-9A-Z]+)$/i.exec(String(tag ?? '').trim());
  if (!m) throw new Error('not a DJ tag');
  if (Number(m[3]) !== TAG_VERSION) throw new Error(`tag version ${m[3]} is not ${TAG_VERSION}`);
  const r = reader(fromB32(m[4]));
  const out = {};
  out.theme = THEME_KEYS[r.get(3)] ?? 'highlands';
  out.pure = r.get(1) === 1;
  out.section = SECTION_ORDER[r.get(3)] ?? 'intro';
  out.setBar = r.get(7);
  out.set = r.get(8);
  out.keyLift = r.get(2);
  const kind = TUNE_KINDS[r.get(2)] ?? 'none';
  const seed = r.get(32) >>> 0;
  const n = r.get(2);
  const hashes = [];
  for (let i = 0; i < n; i++) hashes.push(r.get(16));
  const bar = r.get(8);
  const byHash = new Map(tunes.map((t) => [tuneHash(t.id), t]));
  const sources = hashes.map((h) => { const t = byHash.get(h); return t ? { hash: h, id: t.id, title: t.title, source: t.source ?? null } : { hash: h, id: null, title: null, source: null }; });
  out.tune = { kind, seed, sources, bar };
  out.keyPc = r.get(4);
  out.bpm = r.get(8);
  out.beat = r.get(13) / 100;
  out.layers = {};
  for (const k of MIX_KEYS) out.layers[k] = r.get(1) === 1;
  out.energy = r.get(4) / 15;
  const cn = r.get(3);
  out.chain = [];
  for (let i = 0; i < cn; i++) { const k = TAG_FX_ALPHABET[r.get(7)] ?? null; out.chain.push({ key: k, amount: r.get(4) / 15 }); }
  const mn = r.get(2);
  out.moves = [];
  for (let i = 0; i < mn; i++) out.moves.push(TAG_FX_ALPHABET[r.get(7)] ?? null);
  out.hum = { rate: HUM_RATE_KEYS[r.get(3)] ?? 'alpha', variant: HUM_VARIANT_KEYS[r.get(3)] ?? 'pulse' };
  out.texture = TEXTURE_KEYS[r.get(2)] ?? 'wind';
  out.drumFamily = DRUM_FAMILIES[r.get(4)] ?? 'chicago';
  out.bassStyle = BASS_STYLES[r.get(2)] ?? 'sub';
  const leans = {};
  for (const k of DJ_KEYS) leans[k] = unlean2(r.get(2));
  const mix = {};
  for (const k of STEER_MIX) mix[k] = unlean2(r.get(2));
  const wb = r.get(4);
  const wt = r.get(3);
  const holdBeat = r.get(1) === 1;
  const lockTheme = r.get(1) === 1;
  const tracks = {};
  for (const t of STEER_TRACKS) tracks[t] = r.get(1) === 1 ? false : null;
  out.steer = { leans, mix, wantBeat: wb ? STEER_BEATS[wb - 1] ?? null : null, wantTheme: wt ? THEME_KEYS[wt - 1] ?? null : null, holdBeat, lockTheme, tracks };
  const wn = r.get(3);
  const decay = r.get(5) / 20;
  const window = [];
  for (let i = 0; i < wn; i++) {
    const keyPc = r.get(4);
    const mode = MODES7[r.get(3)] ?? 'ionian';
    const motif = [];
    for (let k = 0; k < 4; k++) { const v = r.get(4); if (v) motif.push(v - 8); }
    const th = r.get(3);
    const energy = r.get(4) / 15;
    const vote = r.get(3) || null;
    window.push({ keyPc, mode, motif, theme: th ? THEME_KEYS[th - 1] ?? null : null, energy, fx: [], vote });
  }
  out.influence = { decay, window };
  // THE VOICE CHAINS (lane MELODYFX): absent in a tag written before them
  out.voices = null;
  if (r.left >= 1 && r.get(1) === 1) {
    const seedV = r.get(32) >>> 0;
    const nv = r.get(3) + 1;
    const voices = [];
    for (let i = 0; i < nv; i++) {
      const slot = VOICE_SLOTS[r.get(3)] ?? null;
      const inst = INST_ALPHABET[r.get(4)] ?? null;
      const nk = r.get(3);
      const keys = [];
      for (let k = 0; k < nk; k++) { const key = TAG_FX_ALPHABET[r.get(7)]; if (key) keys.push(key); }
      if (slot && inst) voices.push({ slot, inst, keys });
    }
    out.voices = { seed: seedV, voices };
  }
  out.tag = String(tag).trim();
  return out;
}

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function tagLines(d) {
  if (!d) return [];
  if (d.kind === 'opener') return openerTagLines(d);
  const on = Object.entries(d.layers ?? {}).filter(([, v]) => v).map(([k]) => k);
  const lean = (v) => (v > 0 ? '+' : v < 0 ? '-' : '');
  const steered = [
    ...Object.entries(d.steer?.leans ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}${lean(v)}`),
    ...Object.entries(d.steer?.mix ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}${lean(v)}`),
    ...Object.entries(d.steer?.tracks ?? {}).filter(([, v]) => v === false).map(([k]) => `${k} held out`),
  ];
  const tuneWord = d.tune.kind === 'composed'
    ? `a new tune after ${d.tune.sources.map((s) => s.title ?? `#${s.hash}`).join(' and ')} (seed ${d.tune.seed})`
    : d.tune.kind === 'collected' ? (d.tune.sources[0]?.title ?? 'a collected tune') : d.tune.kind;
  return [
    ['mode', d.pure ? 'McKusker flute, pure' : 'house DJ'],
    ['theme', d.theme],
    ['section', `${d.section}, bar ${d.setBar} of set ${d.set}`],
    ['tune', tuneWord],
    ['key', `${NAMES[d.keyPc]}${d.keyLift ? `, lifted ${d.keyLift}` : ''}`],
    ['tempo', `${d.bpm} bpm`],
    ['beat', `${d.beat} Hz`],
    ['layers', on.join(', ') || 'none'],
    ['energy', `${Math.round(d.energy * 100)}%`],
    ['chain', d.chain.map((c) => `${c.key} ${Math.round(c.amount * 100)}%`).join(', ') || 'none'],
    ['moves', d.moves.join(', ') || 'none'],
    ['drums', d.drumFamily],
    ['bass', d.bassStyle],
    ['hum', `${d.hum.variant} at ${d.hum.rate}`],
    ['texture', d.texture],
    ['steering', steered.join(', ') || 'the DJ decides'],
    ['influence', d.influence.window.length ? `${d.influence.window.length} earlier sets, decay ${d.influence.decay}` : 'none'],
    ['voices', d.pure ? 'the clear flute, no effects' : d.voices ? realizePalette(d.voices).voices.map(chainLine).join('; ') : 'from the tune seed (a tag from before the voice chains)'],
  ];
}

export function situationOf(st) {
  return {
    theme: st.theme?.key ?? st.theme,
    pure: !!st.pure,
    section: st.section ?? 'intro',
    setBar: st.setBar ?? 0,
    set: st.set ?? 0,
    keyLift: st.keyLift ?? 0,
    tune: st.tune ?? { kind: 'none' },
    keyPc: st.keyPc ?? 0,
    bpm: st.bpm ?? 120,
    beat: st.beat ?? 40,
    layers: st.layers ?? {},
    energy: st.energy ?? 0,
    chain: st.chain ?? [],
    moves: st.moves ?? [],
    hum: st.hum ?? { rate: 'alpha', variant: 'pulse' },
    texture: st.texture ?? 'wind',
    drumFamily: st.drumFamily ?? 'chicago',
    bassStyle: st.bassStyle ?? 'sub',
    steer: st.steer ?? {},
    influence: st.influence ?? { decay: 0.6, window: [] },
    voices: st.voices ?? null,
  };
}
