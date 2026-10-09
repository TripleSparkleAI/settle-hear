// settle-hear · pagechimes - THE PAGE CHIMES: 50 short, quiet sounds for a page change, every one a recipe of plain
// parameters played live by THE DJ's own voices (lane PAGECHIMES, navigator 2026-10-09: "a set of 100 unique noises,
// or say 50, all created using THE DJ, but short, subtle noises for page changes, in our usual rotation"; then "this
// new on-page-swap noise: bing boop de doop"). Nothing is sampled and nothing is an audio file.
//
// <claudes_code_comments>
// ** Function List **
// CHIME_FAMILIES                 - the six families: figure, settle, recall, blip, breath, harmonic
// CHIME_VOICES                   - THE DJ's instruments a chime may play (instruments.js playNote)
// CHIME_NOTE_PEAK                - the envelope peak one note of a DJ instrument is dealt (INST_PEAK -> velocity)
// CHIME_SHAPE                    - the gate's numbers: the soft lift, the fade at the end, the tone filter
// PAGE_CHIME_RECIPES             - the 50 recipes, plain data { id, name, family, dur, mode, root, voice, notes, parts }
// recipeFingerprint(recipe)      - a short stable hash of a recipe's sounding parameters (its name and id left out)
// chimeNotes(recipe)             - the recipe resolved to timed events { kind, at, len, hz, hz2, vel, voice, q }
// renderChime(ctx, at, dest, recipe, opts) - play one recipe from `at` into `dest`; returns its end time
// PAGE_CHIMES                    - the 50 as deck entries { id, name, kind, family, deck: 'chime', lane, dur,
//                                  fingerprint, provenance, recipe, render(ctx, at, dest, opts) }, frozen
//
// ** Technical Review **
// - THE DJ'S PARTS, REUSED: every pitched note of a figure is THE DJ's own voice, played through instruments.js
//   playNote (the clear flute, the harp, the bells, the crystal, the lo-fi keys, the soft pluck), at a velocity taken
//   from voice-fx.js INST_PEAK so each voice reaches the same envelope peak (CHIME_NOTE_PEAK x the note's accent).
//   Every pitch comes from tuning.js: the DJ's scales (MODES, scaleMidi) on A = 432 (midiHz). The breaths are the
//   engine's own seeded noise (engine.js noiseBuffer) through a band-pass, as the flute's chiff is made. Four small
//   voices of our own fill the rest, each kept to THE TONE RULES: a soft sine blip, a sine glide, a breath, and a
//   string harmonic (a sine and its octave, struck and dying fast).
// - THE GATE: every chime passes one gain that lifts from 0 to 1 over CHIME_SHAPE.liftS, holds, and falls linearly
//   to exactly 0 at at + dur, the fade at least CHIME_SHAPE.fadeMinS long. A bell or a crystal rings for seconds on
//   its own; the gate ends it inside the recipe's length with no click. A tone low-pass (CHIME_SHAPE.toneHz) sits
//   before the gate, so nothing bright pokes out of the music.
// - THE FAMILIES: FIGURE (bing boop de doop: two to four quick notes on one of THE DJ's scales), SETTLE (a few hot
//   notes scattered high that cool and land on the root, the way a p-bit settles), RECALL (a note and its softer
//   echo, a cue and a reply: a sparse memory read), BLIP (one soft sine, or a tiny glide), BREATH (a band of noise,
//   alone or under a quiet tone), HARMONIC (a struck string harmonic, a bell, a crystal shimmer).
// - DISTINCT BY CONSTRUCTION AND BY MEASUREMENT: recipeFingerprint hashes every sounding field, and no two of the 50
//   share one; tests/pagechimes.test.mjs renders all 50 with tests/offline.mjs and holds every pair under the decks'
//   ruled likeness (0.95 of the band-energy envelope fingerprint).
// - THE FORMAT is the sfx decks' (sfx-decks.js), with deck 'chime', so tools/sfx_levels.py measures it as it is.
//   render never touches the engine, a channel or the window: the player (pagechime.js) owns all of that.
// - Deterministic: no random draw anywhere; opts.seed is accepted and ignored, and opts.strength scales every note.
// </claudes_code_comments>

import { playNote } from './instruments.js';
import { noiseBuffer } from './engine.js';
import { midiHz, scaleMidi } from './tuning.js';
import { INST_PEAK } from './voice-fx.js';
import { TONE } from './tone.js';
import { PAGE_CHIME } from './pagechime.js';

const LANE = 'PAGECHIMES';
const MADE = '2026-10-09';

export const CHIME_FAMILIES = Object.freeze(['figure', 'settle', 'recall', 'blip', 'breath', 'harmonic']);
export const CHIME_VOICES = Object.freeze(['flute', 'harp', 'bells', 'crystal', 'keys', 'pluck']);
// the envelope peak each DJ-instrument note is dealt, before the note's accent and the opts.strength
export const CHIME_NOTE_PEAK = 0.11;
export const CHIME_SHAPE = Object.freeze({ liftS: 0.004, fadeMinS: 0.06, fadeShare: 0.28, toneHz: 6500, smallPeak: 0.09 });
// the peak every chime's render reaches (before the channel's fader), so that through PAGE_CHIME.level it lands on
// PAGE_CHIME.masterTargetDb at the master's input
export const CHIME_RAW_TARGET_DB = PAGE_CHIME.masterTargetDb - 20 * Math.log10(PAGE_CHIME.level);
// THE TRIM, measured: each chime's gain in dB that brings its rendered peak to CHIME_RAW_TARGET_DB in Chromium's own
// OfflineAudioContext (the browser is the instrument of record), from `python3 tools/pagechime_levels.py --trim`;
// tests/pagechimes.test.mjs re-measures every chime with tests/offline.mjs and fails when one strays more than
// 3 dB from the target, so a changed recipe owes a fresh table
export const CHIME_TRIM_DB = Object.freeze({
  'chime-bing-boop': -19.60,
  'chime-bing-boop-de-doop': -14.09,
  'chime-doop-de-bing': -22.45,
  'chime-up-the-pentatonic': -22.15,
  'chime-down-the-pentatonic': -23.61,
  'chime-two-bell-nod': -20.64,
  'chime-crystal-pair': -16.54,
  'chime-flute-bing-boop': -16.19,
  'chime-flute-de-doop': -16.69,
  'chime-keys-hop': -22.77,
  'chime-flute-trill': -17.43,
  'chime-harp-skip': -21.01,
  'chime-question': -20.54,
  'chime-answer': -20.62,
  'chime-bell-trio': -22.38,
  'chime-pluck-boop-boop': -13.43,
  'chime-crystal-de-doop': -19.28,
  'chime-harp-de-doop': -21.35,
  'chime-flute-hello': -16.84,
  'chime-keys-goodbye': -21.29,
  'chime-neon-arpeggio': -24.31,
  'chime-small-fanfare': -19.75,
  'chime-cooling-fifth': -24.44,
  'chime-p-bit-lands': -22.93,
  'chime-cold-drop': -23.00,
  'chime-settled-root': -18.55,
  'chime-glide-home': -14.46,
  'chime-last-flip': -22.22,
  'chime-freeze': -18.59,
  'chime-ground-state': -20.46,
  'chime-echo-recall': -17.36,
  'chime-address-and-word': -20.26,
  'chime-remembered-fifth': -15.52,
  'chime-cue-and-reply': -14.41,
  'chime-hard-location': -15.98,
  'chime-sparse-ping': -20.08,
  'chime-soft-blip': -14.47,
  'chime-low-blip': -14.33,
  'chime-blip-up': -13.75,
  'chime-blip-down': -13.95,
  'chime-double-blip': -14.50,
  'chime-glass-tick': -14.25,
  'chime-breath': -13.28,
  'chime-flute-chiff': -14.18,
  'chime-air-rising': -7.19,
  'chime-hush': -8.65,
  'chime-guitar-harmonic': -16.42,
  'chime-harmonic-pair': -16.68,
  'chime-bell-harmonic': -15.91,
  'chime-crystal-shimmer': -16.39,
});

// a figure on THE DJ's voices: notes are [scale degree, at ms, length ms, accent]
const fig = (id, name, family, voice, mode, root, notes, dur) => ({ id, name, family, voice, mode, root, notes, dur });
// a chime of our small voices: parts are { kind, at, len, ... }
const own = (id, name, family, parts, dur) => ({ id, name, family, parts, dur });

const RAW = [
  // FIGURE: bing boop de doop, two to four quick notes on one of THE DJ's scales
  fig('bing-boop', 'bing boop', 'figure', 'harp', 'major pentatonic', 79, [[4, 0, 90], [2, 95, 140]], 280),
  fig('bing-boop-de-doop', 'bing boop de doop', 'figure', 'pluck', 'major pentatonic', 72, [[4, 0, 70], [2, 80, 70], [3, 180, 50], [5, 235, 120]], 420),
  fig('doop-de-bing', 'doop de bing', 'figure', 'keys', 'lydian', 67, [[0, 0, 80], [2, 90, 60], [7, 160, 160]], 400),
  fig('up-the-pentatonic', 'up the pentatonic', 'figure', 'harp', 'major pentatonic', 69, [[0, 0, 60], [1, 55, 60], [2, 110, 60], [4, 165, 150]], 380),
  fig('down-the-pentatonic', 'down the pentatonic', 'figure', 'bells', 'minor pentatonic', 81, [[5, 0, 70], [3, 70, 70], [1, 140, 70], [0, 210, 140]], 450),
  fig('two-bell-nod', 'two-bell nod', 'figure', 'bells', 'ionian', 84, [[4, 0, 100], [0, 110, 200]], 380),
  fig('crystal-pair', 'crystal pair', 'figure', 'crystal', 'lydian', 88, [[0, 0, 90], [4, 85, 200]], 360),
  fig('flute-bing-boop', 'flute bing boop', 'figure', 'flute', 'dorian', 74, [[4, 0, 90], [2, 100, 160]], 340),
  fig('flute-de-doop', 'flute de doop', 'figure', 'flute', 'mixolydian', 72, [[0, 0, 60], [1, 65, 60], [4, 140, 170]], 380),
  fig('keys-hop', 'keys hop', 'figure', 'keys', 'aeolian', 60, [[0, 0, 70], [4, 70, 70], [2, 140, 70], [7, 210, 140]], 420),
  fig('flute-trill', 'flute trill', 'figure', 'flute', 'dorian', 79, [[2, 0, 45], [3, 55, 45], [2, 110, 45], [4, 170, 140]], 380),
  fig('harp-skip', 'harp skip', 'figure', 'harp', 'lydian', 59, [[0, 0, 70], [3, 75, 70], [6, 150, 200]], 460),
  fig('question', 'question', 'figure', 'keys', 'major pentatonic', 81, [[0, 0, 70], [3, 90, 150]], 300),
  fig('answer', 'answer', 'figure', 'keys', 'major pentatonic', 62, [[3, 0, 90], [0, 110, 200]], 380),
  fig('bell-trio', 'bell trio', 'figure', 'bells', 'mixolydian', 79, [[0, 0, 80], [2, 80, 80], [4, 160, 220]], 500),
  fig('pluck-boop-boop', 'pluck boop boop', 'figure', 'pluck', 'minor pentatonic', 84, [[0, 0, 60], [0, 75, 60], [3, 150, 130]], 300),
  fig('crystal-de-doop', 'crystal de doop', 'figure', 'crystal', 'major pentatonic', 91, [[2, 0, 60], [1, 65, 60], [3, 130, 180]], 400),
  fig('harp-de-doop', 'harp de doop', 'figure', 'harp', 'aeolian', 76, [[4, 0, 60], [3, 60, 60], [4, 120, 60], [7, 180, 170]], 440),
  fig('flute-hello', 'flute hello', 'figure', 'flute', 'ionian', 77, [[0, 0, 70], [4, 80, 200]], 360),
  fig('keys-goodbye', 'keys goodbye', 'figure', 'keys', 'dorian', 72, [[4, 0, 80], [2, 90, 80], [0, 180, 160]], 420),
  fig('neon-arpeggio', 'neon arpeggio', 'figure', 'keys', 'lydian', 86, [[0, 0, 45], [2, 45, 45], [4, 90, 45], [7, 135, 140]], 320),
  fig('small-fanfare', 'small fanfare', 'figure', 'harp', 'mixolydian', 88, [[0, 0, 55], [0, 60, 55], [4, 120, 180]], 340),
  // SETTLE: hot notes scattered high, cooling onto the root, as a p-bit settles
  fig('cooling-fifth', 'cooling fifth', 'settle', 'harp', 'ionian', 84, [[11, 0, 40], [7, 45, 40], [9, 90, 40], [4, 140, 200]], 480),
  fig('p-bit-lands', 'p-bit lands', 'settle', 'keys', 'minor pentatonic', 79, [[3, 0, 35], [2, 40, 35], [3, 80, 35], [0, 130, 200]], 360),
  fig('cold-drop', 'cold drop', 'settle', 'bells', 'minor pentatonic', 84, [[7, 0, 50], [4, 60, 50], [0, 130, 260]], 480),
  fig('settled-root', 'settled root', 'settle', 'crystal', 'ionian', 84, [[4, 0, 40], [2, 45, 40], [0, 95, 250]], 450),
  own('glide-home', 'glide home', 'settle', [{ kind: 'glide', at: 0, len: 170, midi: 88, to: 76 }, { kind: 'note', voice: 'harp', at: 160, len: 200, midi: 64, accent: 0.8 }], 420),
  fig('last-flip', 'last flip', 'settle', 'keys', 'dorian', 57, [[1, 0, 40], [0, 50, 40], [1, 100, 40], [0, 150, 180]], 380),
  fig('freeze', 'freeze', 'settle', 'crystal', 'aeolian', 79, [[2, 0, 50], [1, 55, 50], [0, 110, 300]], 560),
  fig('ground-state', 'ground state', 'settle', 'harp', 'minor pentatonic', 52, [[4, 0, 45], [2, 55, 45], [1, 110, 45], [0, 165, 300]], 580),
  // RECALL: a note and its softer echo, a cue and a reply, as a sparse memory is read back
  fig('echo-recall', 'echo recall', 'recall', 'keys', 'ionian', 72, [[0, 0, 90, 1], [7, 120, 140, 0.55]], 360),
  fig('address-and-word', 'address and word', 'recall', 'bells', 'lydian', 76, [[0, 0, 80], [4, 100, 80], [0, 200, 60, 0.5], [4, 250, 150, 0.5]], 500),
  fig('remembered-fifth', 'remembered fifth', 'recall', 'crystal', 'mixolydian', 86, [[0, 0, 70], [4, 140, 200, 0.6]], 420),
  fig('cue-and-reply', 'cue and reply', 'recall', 'crystal', 'major pentatonic', 72, [[1, 0, 70], [1, 110, 60, 0.5], [3, 190, 200]], 460),
  fig('hard-location', 'hard location', 'recall', 'flute', 'dorian', 69, [[0, 0, 60], [0, 70, 60, 0.45], [0, 140, 60, 0.25], [4, 210, 220]], 520),
  fig('sparse-ping', 'sparse ping', 'recall', 'bells', 'major pentatonic', 89, [[0, 0, 60], [5, 180, 180, 0.7]], 420),
  // BLIP: one soft sine, or a tiny glide
  own('soft-blip', 'soft blip', 'blip', [{ kind: 'blip', at: 0, len: 90, midi: 81 }], 160),
  own('low-blip', 'low blip', 'blip', [{ kind: 'blip', at: 0, len: 110, midi: 64 }], 180),
  own('blip-up', 'blip up', 'blip', [{ kind: 'glide', at: 0, len: 170, midi: 69, to: 81 }], 240),
  own('blip-down', 'blip down', 'blip', [{ kind: 'glide', at: 0, len: 110, midi: 88, to: 81 }], 160),
  own('double-blip', 'double blip', 'blip', [{ kind: 'blip', at: 0, len: 60, midi: 79 }, { kind: 'blip', at: 80, len: 90, midi: 84 }], 240),
  own('glass-tick', 'glass tick', 'blip', [{ kind: 'glass', at: 0, len: 100, midi: 96 }], 160),
  // BREATH: a band of noise, alone or under a quiet tone
  own('breath', 'breath', 'breath', [{ kind: 'breath', at: 0, len: 220, hz: 4200, q: 3 }], 260),
  own('flute-chiff', 'flute chiff', 'breath', [{ kind: 'breath', at: 0, len: 80, hz: 3400, q: 1.8 }, { kind: 'note', voice: 'flute', at: 20, len: 200, midi: 81, accent: 0.5 }], 320),
  own('air-rising', 'air rising', 'breath', [{ kind: 'breath', at: 0, len: 380, hz: 700, to: 2800, q: 2.4 }], 420),
  own('hush', 'hush', 'breath', [{ kind: 'breath', at: 0, len: 170, hz: 600, q: 0.7 }], 220),
  // HARMONIC: a struck string harmonic, a bell, a crystal shimmer
  own('guitar-harmonic', 'guitar harmonic', 'harmonic', [{ kind: 'harmonic', at: 0, len: 360, midi: 88 }], 420),
  own('harmonic-pair', 'harmonic pair', 'harmonic', [{ kind: 'harmonic', at: 0, len: 200, midi: 76 }, { kind: 'harmonic', at: 90, len: 320, midi: 83 }], 460),
  fig('bell-harmonic', 'bell harmonic', 'harmonic', 'bells', 'ionian', 93, [[0, 0, 300]], 500),
  fig('crystal-shimmer', 'crystal shimmer', 'harmonic', 'crystal', 'lydian', 96, [[0, 0, 300], [4, 50, 300, 0.7]], 560),
];

export const PAGE_CHIME_RECIPES = Object.freeze(RAW.map((r) => Object.freeze({ ...r, id: `chime-${r.id}` })));

// FNV-1a over the sounding fields (never the name or the id), as eight hex digits
export function recipeFingerprint(recipe) {
  const { id, name, ...sound } = recipe ?? {}; // eslint-disable-line no-unused-vars
  const s = JSON.stringify(sound, Object.keys(sound).sort());
  const full = JSON.stringify(sound);
  let h = 0x811c9dc5;
  for (const c of `${s}|${full}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

// the recipe as timed events: a figure's degrees read off THE DJ's scale; our own parts pass through
export function chimeNotes(recipe) {
  if (!recipe) return [];
  if (Array.isArray(recipe.notes)) {
    const scale = scaleMidi(recipe.root, recipe.mode, 3);
    return recipe.notes.map(([deg, at, len, accent = 1]) => ({
      kind: 'note', voice: recipe.voice, at: at / 1000, len: len / 1000, hz: midiHz(scale[Math.max(0, Math.min(scale.length - 1, deg))]), accent,
    }));
  }
  return (recipe.parts ?? []).map((p) => ({
    kind: p.kind, voice: p.voice ?? null, at: p.at / 1000, len: p.len / 1000, hz: midiHz(p.midi), hz2: p.to != null ? (p.kind === 'breath' ? p.to : midiHz(p.to)) : null,
    q: p.q ?? null, accent: p.accent ?? 1, band: p.kind === 'breath' ? p.hz : null,
  }));
}

// a gain from 0 to `peak` and back to exactly 0, never faster than the tone rules' floors
function strike(ctx, out, t, { peak, attack = TONE.attackMin, release }) {
  const g = ctx.createGain();
  const a = Math.max(TONE.attackMin, attack);
  const r = Math.max(TONE.releaseMin, release);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setTargetAtTime(0, t + a, r / 4);
  g.gain.setValueAtTime(0, t + a + r * 1.5);
  g.connect(out);
  return { g, end: t + a + r * 1.5 };
}

function sine(ctx, f, t, stop, into, gain = 1) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  const g = ctx.createGain();
  g.gain.value = gain;
  o.connect(g);
  g.connect(into);
  o.start(t);
  o.stop(stop);
  o.onended = () => { try { g.disconnect(); } catch { /* gone */ } };
  return o;
}

const SMALL = {
  blip(ctx, out, e, t, s) {
    const { g, end } = strike(ctx, out, t, { peak: CHIME_SHAPE.smallPeak * s * e.accent, attack: 0.006, release: e.len });
    sine(ctx, e.hz, t, end, g);
    sine(ctx, e.hz * 2, t, end, g, 0.08);
  },
  glide(ctx, out, e, t, s) {
    const { g, end } = strike(ctx, out, t, { peak: CHIME_SHAPE.smallPeak * s * e.accent, attack: 0.012, release: e.len });
    const o = sine(ctx, e.hz, t, end, g);
    o.frequency.exponentialRampToValueAtTime(e.hz2, t + Math.max(0.02, e.len * 0.7));
  },
  glass(ctx, out, e, t, s) {
    const { g, end } = strike(ctx, out, t, { peak: CHIME_SHAPE.smallPeak * 0.8 * s * e.accent, attack: 0.004, release: e.len });
    sine(ctx, e.hz, t, end, g);
    sine(ctx, e.hz * 3.01, t, end, g, 0.25);
  },
  harmonic(ctx, out, e, t, s) {
    // a string's harmonic: the node's two partials, struck, the upper one dying first
    const { g, end } = strike(ctx, out, t, { peak: CHIME_SHAPE.smallPeak * s * e.accent, attack: 0.004, release: e.len });
    sine(ctx, e.hz, t, end, g);
    const up = ctx.createGain();
    up.gain.setValueAtTime(0.35, t);
    up.gain.setTargetAtTime(0, t, 0.04);
    up.connect(g);
    sine(ctx, e.hz * 2, t, end, up);
  },
  breath(ctx, out, e, t, s) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(e.band, t);
    if (e.hz2) bp.frequency.exponentialRampToValueAtTime(e.hz2, t + e.len);
    bp.Q.value = e.q ?? 1.5;
    // a breath swells rather than strikes: a third of its length up, the rest down
    const g = ctx.createGain();
    const peak = CHIME_SHAPE.smallPeak * 1.6 * s * e.accent;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.max(TONE.attackSoft, e.len / 3));
    g.gain.linearRampToValueAtTime(0, t + e.len);
    src.connect(bp);
    bp.connect(g);
    g.connect(out);
    src.start(t, (e.band % 997) / 1000);
    src.stop(t + e.len + 0.02);
    src.onended = () => { for (const n of [bp, g]) try { n.disconnect(); } catch { /* gone */ } };
  },
};

export function renderChime(ctx, at, dest, recipe, { strength = 1, raw = false } = {}) {
  const s = Math.min(1, Math.max(0, Number.isFinite(strength) ? strength : 1));
  const durS = Math.max(0.12, Math.min(0.6, (recipe?.dur ?? 300) / 1000));
  const fade = Math.max(CHIME_SHAPE.fadeMinS, durS * CHIME_SHAPE.fadeShare);
  const end = at + durS;
  // THE GATE: up from 0, hold, and down to exactly 0 at the recipe's end, whatever a bell would ring on to
  const gate = ctx.createGain();
  gate.gain.setValueAtTime(0, at);
  gate.gain.linearRampToValueAtTime(1, at + CHIME_SHAPE.liftS);
  gate.gain.setValueAtTime(1, end - fade);
  gate.gain.linearRampToValueAtTime(0, end);
  const trim = ctx.createGain();
  trim.gain.value = raw ? 1 : Math.pow(10, (CHIME_TRIM_DB[recipe?.id] ?? 0) / 20);
  gate.connect(trim);
  trim.connect(dest);
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = CHIME_SHAPE.toneHz;
  tone.Q.value = 0.5;
  tone.connect(gate);
  for (const e of chimeNotes(recipe)) {
    const t = at + e.at;
    if (e.kind === 'note') {
      const vel = Math.min(1, (CHIME_NOTE_PEAK * e.accent * s) / (INST_PEAK[e.voice] ?? 0.2));
      playNote(ctx, tone, e.voice, e.hz, t, e.len, vel);
    } else if (SMALL[e.kind]) {
      SMALL[e.kind](ctx, tone, e, t, s);
    }
  }
  return end;
}

const prov = (r) => `PAGECHIMES ${MADE}: THE DJ's ${r.voice ? `${r.voice} (instruments.js playNote) on ${r.mode} from midi ${r.root}, A = 432` : 'small voices (a sine, a noise band) under THE TONE RULES'}; no sample, no recording.`;

export const PAGE_CHIMES = Object.freeze(PAGE_CHIME_RECIPES.map((recipe) => Object.freeze({
  id: recipe.id,
  name: recipe.name,
  kind: recipe.family,
  family: recipe.family,
  deck: 'chime',
  lane: LANE,
  dur: recipe.dur / 1000,
  fingerprint: recipeFingerprint(recipe),
  provenance: prov(recipe),
  recipe,
  render: (ctx, at, dest, opts = {}) => renderChime(ctx, at, dest, recipe, opts),
})));
