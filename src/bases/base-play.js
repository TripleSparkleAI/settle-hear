// settle-hear · bases/base-play - A BASE, HEARD: one bar of a base (or a slice, or a combined base) scheduled on
// the audio clock, each drum event through a kit voice by its General MIDI note, each pitched part through a
// struck or blown voice; and THE MELODY OVER THE BASE: a collected tune laid over a base's grid through the
// filters (quantise, gate to the hats, duck under the kick, a low-pass that follows the energy).
//
// <claudes_code_comments>
// ** Function List **
// DRUM_VOICE_OF(pitch)        - a GM drum note -> the kit voice name (kick, snare, clap, closedHat, openHat, rim,
//                               cowbell, ride, tom, shaker, conga, crash)
// defaultKit(ctx)             - a kit built from house.js strike() and the engine's noise buffer: the voice names
//                               above as hit(ctx, out, t, { level }); a caller may pass voice-drum-machines' kit
// playBasePart(ctx, out, t0, beatDur, base, part, opts) - one part of one bar: { bar, energy, kit, level, transpose,
//                               swing } -> the number of voice calls
// playBaseBar(ctx, out, t0, beatDur, base, opts) - every wanted part of one bar: { bar, parts, energy, kit, levels,
//                               transpose } -> { hits, parts }
// melodyOverBase(base, notes, opts) - the melody as a lead part on the base's grid: { events, filter, notes }
//                               with the filters applied: quantise to the grid, gate to the hats' onsets, duck
//                               under the kick, the cutoff from the energy
// PART_LEVELS                 - each part's level under the drums
// gateNotesToBase(base, bar, notes, opts) - one bar's lead notes (midi, at, beats) gated to the base's hats and
//                               ducked under its kick: the per-bar form the house DJ's layers use
// BASE_VOICE_SLOTS            - the parts of a base that play through a voice chain: 'lead' and 'arps' (the chords)
// createBaseVoices(ctx, out, { seed, dealer, theme }) - a lead and an arps bus with one dealt palette (lane
//                               MELODYFX2): pass it as opts.voices and the base's lead plays the dealt instrument
//                               (the clear flute, the distorted flute or the lo-fi keys) and its chords play into the
//                               arps chain, exactly as in the house DJ
//
// ** Technical Review **
// - TIMING: tick t of bar b plays at t0 + (t - b x ticksPerBar) x beatDur / grid, plus swing x (beatDur / grid)
//   on odd ticks, exactly as voice-drum-machines.js plays its 16-step rows. A base at grid 8 keeps its odd-tick
//   swing on the odd thirty-seconds, which is the same lateness in beats x 1/2.
// - A level is the event's v times the part's level times (0.5 + 0.5 x energy); below energy 0.35 only the kick
//   and the closed hats play (the quiet-section rule the drum machines follow).
// - PITCHED VOICES: bass is a sine with a short glide (sub) through a 400 Hz low-pass; chords are triangles through
//   a low-pass that opens with the energy (600 Hz at 0 to 2400 Hz at 1); the lead goes to instruments.js playNote on
//   the flute; texture is a soft sine held for the event's length. Every pitch from midiHz (A = 432).
// - THE VOICE CHAINS (lane MELODYFX2): with opts.voices (createBaseVoices, or any createVoiceBuses with a 'lead' and
//   an 'arps' slot) the lead plays the palette's lead instrument into the lead's chain and the chords play into the
//   arps chain; each bar hands the buses one bar of clock (tempo, bar, the key's root) for the effects that read it.
//   A bus is built on its part's first note. Without opts.voices the parts play straight into `out`, as before
//   (the house DJ passes its own bus node per part).
// - THE MELODY FILTERS. A collected tune is in beats (abc.js notes); quantise puts each onset on the base's grid
//   and gives it its grid length. The hats GATE keeps only the notes whose onset falls on a tick where the hats
//   play (or within one tick), so the tune takes the groove's rhythm. The kick DUCK lowers a note's level by
//   `duck` where a kick lands on its onset. The CUTOFF is 500 Hz + energy x 4000 Hz, the house filter build.
// </claudes_code_comments>

import { strike } from '../house.js';
import { playNote } from '../instruments.js';
import { midiHz } from '../tuning.js';
import { noiseBuffer } from '../engine.js';
import { TONE } from '../tone.js';
import { ticksPerBar, DRUM_PARTS, PITCHED_PARTS } from './base-format.js';
import { createVoiceDealer, createVoiceBuses, LEVEL_MATCH_DB, levelTrim } from '../voice-fx.js';

export const PART_LEVELS = { kick: 0.8, snare: 0.5, hats: 0.28, perc: 0.3, bass: 0.34, chords: 0.08, lead: 0.4, texture: 0.05 };

const DRUM_VOICES = {
  35: 'kick', 36: 'kick', 37: 'rim', 38: 'snare', 39: 'clap', 40: 'snare', 41: 'tom', 43: 'tom', 45: 'tom', 47: 'tom', 48: 'tom', 50: 'tom',
  42: 'closedHat', 44: 'closedHat', 46: 'openHat', 49: 'crash', 57: 'crash', 52: 'crash', 55: 'crash', 51: 'ride', 59: 'ride', 53: 'ride',
  54: 'shaker', 56: 'cowbell', 58: 'shaker', 60: 'conga', 61: 'conga', 62: 'conga', 63: 'conga', 64: 'conga', 65: 'tom', 66: 'tom', 67: 'cowbell', 68: 'cowbell',
  69: 'shaker', 70: 'shaker', 75: 'rim', 76: 'rim', 77: 'rim', 80: 'shaker', 81: 'shaker', 82: 'shaker',
};
export const DRUM_VOICE_OF = (p) => DRUM_VOICES[p] ?? 'rim';

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const expo = (p, v, t) => { try { p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); } catch { p.value = v; } };

function burst(ctx, out, t, { filters = [['highpass', 7000]], peak = 0.2, decay = 0.06 } = {}) {
  if (!(peak > 0)) return 0;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  const nodes = filters.map(([type, f, Q = 0.7]) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = Q; return n; });
  const e = ctx.createGain();
  at(e.gain, 0, t);
  lin(e.gain, peak, t + TONE.attackMin);
  expo(e.gain, 0.0005, t + TONE.attackMin + Math.max(TONE.releaseMin, decay));
  let last = s;
  for (const n of nodes) { last.connect(n); last = n; }
  last.connect(e);
  e.connect(out);
  s.start(t);
  s.stop(t + TONE.attackMin + Math.max(TONE.releaseMin, decay) + 0.05);
  s.onended = () => { for (const n of [s, ...nodes, e]) try { n.disconnect(); } catch { /* gone */ } };
  return 1;
}

const lvl = (o) => Math.min(2, Math.max(0, Number.isFinite(o?.level) ? o.level : 1));

export function defaultKit() {
  return {
    kick(ctx, out, t, o) { strike(ctx, out, 'sine', 160, t, { peak: 0.9 * lvl(o), attack: 0.002, decay: 0.32, glideTo: 52, glide: 0.09 }); },
    snare(ctx, out, t, o) { strike(ctx, out, 'triangle', 190, t, { peak: 0.3 * lvl(o), attack: 0.002, decay: 0.12, glideTo: 150, glide: 0.05 }); burst(ctx, out, t, { filters: [['bandpass', 2200, 0.8], ['highpass', 900]], peak: 0.28 * lvl(o), decay: 0.18 }); },
    clap(ctx, out, t, o) { for (let i = 0; i < 4; i++) burst(ctx, out, t + i * 0.01, { filters: [['bandpass', 1200, 1.2]], peak: 0.3 * lvl(o), decay: 0.06 }); burst(ctx, out, t + 0.04, { filters: [['bandpass', 1200, 0.9]], peak: 0.22 * lvl(o), decay: 0.16 }); },
    closedHat(ctx, out, t, o) { burst(ctx, out, t, { filters: [['highpass', 8000], ['peaking', 9600, 1]], peak: 0.2 * lvl(o), decay: 0.06 }); },
    openHat(ctx, out, t, o) { burst(ctx, out, t, { filters: [['highpass', 8000], ['peaking', 9600, 1]], peak: 0.18 * lvl(o), decay: 0.35 }); },
    rim(ctx, out, t, o) { strike(ctx, out, 'triangle', 1700, t, { peak: 0.25 * lvl(o), attack: 0.002, decay: 0.06 }); },
    cowbell(ctx, out, t, o) { for (const f of [540, 800]) strike(ctx, out, 'square', f, t, { peak: 0.1 * lvl(o), attack: 0.002, decay: 0.3, filter: 2400 }); },
    ride(ctx, out, t, o) { for (const f of [456, 589, 788]) strike(ctx, out, 'square', f, t, { peak: 0.035 * lvl(o), attack: 0.002, decay: 0.9, filter: 2400 }); burst(ctx, out, t, { filters: [['highpass', 7000]], peak: 0.07 * lvl(o), decay: 1.0 }); },
    crash(ctx, out, t, o) { burst(ctx, out, t, { filters: [['highpass', 5000]], peak: 0.16 * lvl(o), decay: 1.4 }); },
    tom(ctx, out, t, o) { strike(ctx, out, 'sine', 180, t, { peak: 0.5 * lvl(o), attack: 0.002, decay: 0.25, glideTo: 90, glide: 0.2 }); },
    shaker(ctx, out, t, o) { burst(ctx, out, t, { filters: [['bandpass', 6000, 1.5]], peak: 0.12 * lvl(o), decay: 0.05 }); },
    conga(ctx, out, t, o) { strike(ctx, out, 'sine', 320, t, { peak: 0.35 * lvl(o), attack: 0.002, decay: 0.16, glideTo: 240, glide: 0.08 }); },
  };
}

function eventTime(t0, beatDur, grid, tick, swing) {
  const step = beatDur / grid;
  return t0 + tick * step + (tick % 2 === 1 ? swing * step : 0);
}

export function playBasePart(ctx, out, t0, beatDur, base, part, { bar = 0, energy = 1, kit = null, level = null, transpose = 0, swing = null, voices = null } = {}) {
  const P = base.parts?.[part];
  if (!P || !P.events?.length) return 0;
  const grid = base.grid || 4;
  const tpb = ticksPerBar(base);
  const b = ((bar % base.bars) + base.bars) % base.bars;
  const from = b * tpb;
  const e = Math.min(1, Math.max(0, Number(energy) || 0));
  const scale = (0.5 + 0.5 * e) * (level ?? PART_LEVELS[part] ?? 0.3);
  const low = e < 0.35;
  const sw = Math.min(0.3, Math.max(0, swing ?? base.swing ?? 0));
  const K = kit ?? defaultKit();
  let n = 0;
  for (const ev of P.events) {
    if (ev[0] < from || ev[0] >= from + tpb) continue;
    const t = eventTime(t0, beatDur, grid, ev[0] - from, sw);
    const v = ev[2] * scale;
    if (DRUM_PARTS.includes(part)) {
      const voice = DRUM_VOICE_OF(ev[3]);
      if (low && voice !== 'kick' && voice !== 'closedHat') continue;
      const hit = K[voice] ?? K.rim;
      if (typeof hit !== 'function') continue;
      hit(ctx, out, t, { level: v * (low && voice === 'closedHat' ? 0.5 : 1) });
      n++;
      continue;
    }
    if (ev[3] == null) continue;
    const midi = ev[3] + (transpose | 0);
    const dur = (ev[1] * beatDur) / grid;
    if (part === 'bass') strike(ctx, out, 'sine', midiHz(midi), t, { peak: v, attack: 0.008, decay: Math.max(0.08, dur * 0.9), filter: 400 });
    else if (part === 'chords') strike(ctx, voices ? voices.input('arps', t) : out, 'triangle', midiHz(midi), t, { peak: v, attack: 0.01, decay: Math.max(0.12, dur * 0.95), filter: 600 + 1800 * e });
    else if (part === 'lead') playNote(ctx, voices ? voices.input('lead', t) : out, voices ? voices.voiceOf('lead').inst : 'flute', midiHz(midi), t, Math.max(0.1, dur * 0.95), v);
    else strike(ctx, out, 'sine', midiHz(midi), t, { peak: v, attack: Math.min(1, dur * 0.3), decay: Math.max(0.3, dur), filter: 900 });
    n++;
  }
  return n;
}

export function playBaseBar(ctx, out, t0, beatDur, base, { bar = 0, parts = null, energy = 1, kit = null, levels = {}, transpose = 0, swing = null, voices = null } = {}) {
  if (!base || !base.parts) return { hits: 0, parts: [] };
  // one bar of clock for the chains' bar-locked effects (a sweep, a gate, a tempo-locked delay, a comb on the root)
  if (voices) voices.palette(null, t0, 0, { beatDur, bar, root: 48 + ((base.key?.pc ?? 9) + (transpose | 0) + 120) % 12, chord: [], melody: [] });
  const want = parts ?? Object.keys(base.parts);
  const played = [];
  let hits = 0;
  const K = kit ?? defaultKit();
  for (const p of want) {
    if (!base.parts[p]) continue;
    const n = playBasePart(ctx, out, t0, beatDur, base, p, { bar, energy, kit: K, level: levels[p] ?? null, transpose: PITCHED_PARTS.includes(p) ? transpose : 0, swing, voices });
    if (n) { hits += n; played.push(p); }
  }
  return { hits, parts: played };
}

// notes: [{ midi, beats }] in order (abc.js / placeTune output, already in the base's key); returns a lead part
export function melodyOverBase(base, notes = [], { bars = null, gate = 'hats', duck = 0.4, energy = 0.7, quantise = true, loop = true } = {}) {
  const grid = base.grid || 4;
  const tpb = ticksPerBar(base);
  const total = (bars ?? base.bars) * tpb;
  const hatTicks = new Set((base.parts?.hats?.events ?? []).map((e) => e[0]));
  const kickTicks = new Set((base.parts?.kick?.events ?? []).map((e) => e[0]));
  const events = [];
  let cursor = 0;
  let kept = 0;
  let gated = 0;
  let ducked = 0;
  const list = notes.filter((n) => n && Number.isFinite(n.beats) && n.beats > 0);
  if (!list.length) return { events: [], filter: { cutoff: 500 + 4000 * energy, gate, duck }, notes: 0, kept: 0, gated: 0, ducked: 0 };
  let guard = 0;
  while (cursor < total && guard++ < 100000) {
    for (const n of list) {
      if (cursor >= total) break;
      const tick = quantise ? Math.round(cursor) : cursor;
      const len = Math.max(1, Math.round(n.beats * grid));
      if (n.midi != null && tick < total) {
        let ok = true;
        if (gate === 'hats' && hatTicks.size) ok = hatTicks.has(tick) || tick % grid === 0;
        if (ok) {
          let v = 0.8;
          if (duck > 0 && kickTicks.has(tick)) { v = Math.max(0.1, v * (1 - duck)); ducked++; }
          events.push([tick, Math.min(len, total - tick), Math.round(v * 100) / 100, n.midi]);
          kept++;
        } else gated++;
      }
      cursor += n.beats * grid;
    }
    if (!loop) break;
  }
  const seen = new Set();
  const out = events.filter((e) => { const k = `${e[0]}:${e[3]}`; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a[0] - b[0]);
  return { events: out, filter: { cutoff: Math.round(500 + 4000 * Math.min(1, Math.max(0, energy))), gate, duck }, notes: list.length, kept, gated, ducked };
}

// THE BAR GATE for the house DJ's lead (mix-layers.js): one bar's notes [{ midi, at (beats), beats }] against one bar
// of a base: a note whose onset tick is not where the hats play (or on a beat) is dropped (the hats gate), a note on
// a kick onset keeps its pitch with its level scaled by (1 - duck). Returns the notes with a `level` factor.
export function gateNotesToBase(base, bar, notes = [], { gate = 'hats', duck = 0.4 } = {}) {
  if (!base?.parts) return notes.map((n) => ({ ...n, level: 1 }));
  const grid = base.grid || 4;
  const tpb = ticksPerBar(base);
  const b = ((bar % base.bars) + base.bars) % base.bars;
  const from = b * tpb;
  const inBar = (part) => new Set((base.parts[part]?.events ?? []).filter((e) => e[0] >= from && e[0] < from + tpb).map((e) => e[0] - from));
  const hats = gate === 'hats' ? inBar('hats') : new Set();
  const kicks = duck > 0 ? inBar('kick') : new Set();
  const out = [];
  for (const n of notes) {
    if (n.midi == null) { out.push({ ...n, level: 1 }); continue; }
    const tick = Math.round((Number(n.at) || 0) * grid);
    if (gate === 'hats' && hats.size && !(hats.has(tick) || tick % grid === 0)) continue;
    out.push({ ...n, level: kicks.has(tick) ? Math.max(0.1, 1 - duck) : 1 });
  }
  return out;
}

// THE BASE'S VOICE CHAINS (lane MELODYFX2): a lead bus and an arps bus over one dealt palette. A page that plays bases
// keeps one dealer, so each PLAY deals the next palette (THE DECK RULE: the lead's three instruments, the clear flute
// among them, come round in turn, and the effects with them).
export const BASE_VOICE_SLOTS = Object.freeze(['lead', 'arps']);
export function createBaseVoices(ctx, out, { seed = 0x62617365, dealer = null, theme = 'highlands' } = {}) {
  const D = dealer ?? createVoiceDealer({ seed });
  // each chain trimmed back to the part's dry level (voice-fx.js LEVEL_MATCH_DB)
  const buses = createVoiceBuses(ctx, out, BASE_VOICE_SLOTS, { trim: (v) => levelTrim(LEVEL_MATCH_DB[v.slot === 'arps' ? 'base:arps' : `base:lead:${v.inst}`]) });
  buses.palette(D.palette({ theme, slots: BASE_VOICE_SLOTS }));
  return buses;
}
