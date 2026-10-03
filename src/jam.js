// settle-hear · jam - THE JAM: ten instruments a visitor can hit, in the key THE DJ plays, quantised gently to THE
// MASTER BEAT's sixteenths, and one small looper that plays the hits back on the same sixteenths, bar after bar.
//
// <claudes_code_comments>
// ** Function List **
// JAM_KIT / JAM_KEYS          - the ten instruments in row order, one per number key 1 .. 0: kick, clap, hat (closed),
//                               open (an open hat), bass, pluck, bell, chord, vox (a vocoder-style blip), settle (a
//                               burst of noise that settles onto a tone)
// LOOP_BARS                   - the loop lengths a visitor may pick: 1, 2, 4 bars
// jamKey(themeKey)            - { root, mode, steps, name }: the theme's root (midi) and scale; no theme: A minor pentatonic
// jamNotes(key, k, deal)      - the midi note(s) an instrument plays in key k; deal(list) picks a card from a deck
// sixteenthMs(grid)           - one sixteenth of a master bar, in ms (2,000 / 16 = 125)
// jamCall(key, opts)         - { call, q }: one hit as a voice call, tuned and quantised (shared with layers.js)
// quantiseHit(ms, { grid, on }) - { at, lineMs }: the nearest sixteenth line; the sound waits for a line ahead and
//                               plays at once for a line just gone (never early, at most half a sixteenth late)
// createLooper({ grid, bars }) - the looper, pure: rec, record, advance, due, play, stop, clear, setBars, cursor
// createJam(opts)             - the instrument row's engine: hit(key), pump(), the looper's controls, quantise, pause,
//                               cursor, subscribe; every sound goes out through one voice(call)
// playJamHit(ctx, out, call, t) - build one hit's nodes at audio time t (they stop and disconnect themselves)
// JAM_TONAL                   - the five tonal hits that play through a voice chain, each to its part (lane MELODYFX2)
// createJamVoices(ctx, out, opts) - THE JAM'S VOICE CHAINS: { input(call, t) -> the node the hit plays into, palette,
//                               states(), dispose() }; a chain is built on its instrument's first hit, then kept
// playOnEngine(call)          - the default voice: the page's engine, its own mixer channel, the master clock; the
//                               tonal hits go through THE JAM'S VOICE CHAINS
// jamVoices()                 - the default voice's chains (null before the first hit)
//
// ** Technical Review **
// - THE KEY: THE DJ's public state (djlive.js) names the theme it plays; jamKey reads the theme's root and mode
//   (themes.js) and every pitch comes from midiHz (tuning.js), so A = 432 and the DJ's own scale. A drum is tuned too:
//   the kick sits on the root folded under 80 Hz, the clap and the hats' noise is band-passed on an octave of the root.
// - THE DECK RULE: the pluck walks the scale, the bell and the bass walk their chord tones; each deals from a deck
//   (deck.js), so every note comes once before any repeats. The decks are rebuilt when the key changes.
// - QUANTISE: a sixteenth of the master bar (masterbeat.js: barMs 2,000, so 125 ms). A hit snaps to the nearest line;
//   a line ahead is waited for, a line just gone plays now, so the sound is never early and at most 62.5 ms late, and
//   the position kept for the loop is the line. Free play keeps the exact time and a fractional position.
// - THE LOOPER: REC arms it; the take starts on the next master bar line (a press in the first half sixteenth of a
//   bar counts that bar) and lasts 1, 2 or 4 bars, then the loop plays. A hit inside the take is kept with its position
//   in sixteenths; OVERDUB adds hits to a playing loop; the same instrument on the same step is kept once; CLEAR
//   empties it; PLAY/STOP starts and stops it, and play resumes in phase, because the loop's origin is a master bar
//   line and its length is whole bars. A hit is never played back on the turn it was made (ev.since), so nothing
//   doubles. The length glyph on a loop that exists repeats it to grow and keeps its start to shrink.
// - THE PUMP: every 50 ms while a loop runs (opts.auto) the jam schedules the loop's hits that fall in the next 200 ms
//   on the audio clock (toAudioTime). It keeps its window moving while sound cannot play, so unmuting never fires a
//   burst of missed hits. MUTE ALL and PAUSE ALL (the default audible gate: sound.audible and not isAway) stop every
//   voice call, hits included; the hero's pause calls pause(true), which stops the loop.
// - THE TONE RULES: every voice ramps from zero (no attack under TONE.attackMin), every saw passes a low-pass at or
//   under TONE.rawCeiling, and the channel aims at LEVELS.jam. Nothing is per-sample JavaScript.
// - THE VOICE CHAINS (lane MELODYFX2, voice-fx.js): pluck, bell, chord, vox and settle each play into their own bus,
//   a warm drive (drive 1.4 to 2.6) and two to four effects dealt from the 'free' profile, so a visitor's tune gets
//   the same treatment as the DJ's. The chain is built when that instrument is first hit and kept for the visit (a
//   new theme deals new chains), so a hit adds only its own few nodes and its timing is unchanged. The kick, clap,
//   hats and bass stay dry: drums carry no tune, and the bass carries the root like the DJ's bass. The loop layers
//   (layers.js) and the live radio's followed loops play through playOnEngine, so they share these chains.
// </claudes_code_comments>

import { getEngine, createChannel, holdSound, noiseBuffer, isAway } from './engine.js';
import { sound } from './control.js';
import { midiHz, noteMidi, MODES } from './tuning.js';
import { THEMES } from './themes.js';
import { masterGrid, masterNow, toAudioTime } from './masterbeat.js';
import { createBag } from './deck.js';
import { TONE } from './tone.js';
import { djLive } from './djlive.js';
import { createVoiceDealer, createVoiceBuses, JAM_SLOTS, LEVEL_MATCH_DB, levelTrim } from './voice-fx.js';

export const JAM_KIT = Object.freeze([
  { key: 'kick', digit: '1', letter: 'K', family: 'drum', sound: 'kick' },
  { key: 'clap', digit: '2', letter: 'C', family: 'drum', sound: 'clap' },
  { key: 'hat', digit: '3', letter: 'h', family: 'drum', sound: 'closed hat' },
  { key: 'open', digit: '4', letter: 'o', family: 'drum', sound: 'open hat' },
  { key: 'bass', digit: '5', letter: 'B', family: 'tone', sound: 'bass' },
  { key: 'pluck', digit: '6', letter: 'p', family: 'tone', sound: 'pluck' },
  { key: 'bell', digit: '7', letter: 'b', family: 'tone', sound: 'bell' },
  { key: 'chord', digit: '8', letter: 'c', family: 'tone', sound: 'chord' },
  { key: 'vox', digit: '9', letter: 'v', family: 'tone', sound: 'vocoder blip' },
  { key: 'settle', digit: '0', letter: 's', family: 'tone', sound: 'settle burst' },
].map(Object.freeze));
export const JAM_KEYS = JAM_KIT.map((k) => k.key);
export const LOOP_BARS = Object.freeze([1, 2, 4]);
const KIT = Object.fromEntries(JAM_KIT.map((k) => [k.key, k]));

const FALLBACK = { root: 'A3', mode: 'minor pentatonic' };

export function jamKey(themeKey) {
  const th = THEMES.find((t) => t.key === themeKey) ?? FALLBACK;
  const root = noteMidi(th.root);
  const mode = MODES[th.mode] ? th.mode : FALLBACK.mode;
  const steps = MODES[mode];
  const name = `${th.root.replace(/-?\d+$/, '')} ${mode}`;
  return { root: Number.isFinite(root) ? root : 57, mode, steps, name };
}

// a note folded into [lo, hi) Hz, octave by octave
function fold(midi, lo, hi) {
  let m = midi;
  for (let i = 0; i < 12 && midiHz(m) >= hi; i++) m -= 12;
  for (let i = 0; i < 12 && midiHz(m) < lo; i++) m += 12;
  return m;
}
const triad = (k) => [0, k.steps[2] ?? 4, k.steps[4] ?? 7];

// the cards each tonal instrument deals from, as scale offsets from the root
function cards(key, k) {
  if (key === 'pluck') return k.steps.slice();
  if (key === 'bell') return triad(k);
  if (key === 'bass') return [0, k.steps[4] ?? 7, k.steps[3] ?? 5];
  return null;
}

export function jamNotes(key, k = jamKey(null), deal = (list) => list[0]) {
  const R = k.root;
  switch (key) {
    case 'kick': return [fold(R, 40, 80)];
    case 'clap': return [fold(R, 900, 1800)];
    case 'hat':
    case 'open': return [fold(R, 5000, 10000)];
    case 'bass': return [fold(R, 45, 90) + deal(cards('bass', k))];
    case 'pluck': return [fold(R, 300, 600) + deal(cards('pluck', k))];
    case 'bell': return [fold(R, 500, 1000) + deal(cards('bell', k))];
    case 'chord': { const b = fold(R, 150, 300); return triad(k).map((s) => b + s); }
    case 'vox': return [fold(R, 150, 300)];
    case 'settle': return [fold(R, 300, 600)];
    default: return [];
  }
}

export function sixteenthMs(grid = masterGrid()) {
  return grid.barMs / 16;
}

export function quantiseHit(ms, { grid = masterGrid(), on = true } = {}) {
  if (!on) return { at: ms, lineMs: ms, snapped: false };
  const six = sixteenthMs(grid);
  const lineMs = grid.origin + Math.round((ms - grid.origin) / six) * six;
  return { at: Math.max(lineMs, ms), lineMs, snapped: true };
}

// one hit as a voice call: tuned to key k (notes dealt by `deal`), quantised to the grid's sixteenths; null for an
// unknown instrument. createJam and createLoopJam (layers.js) both build their hits here.
export function jamCall(key, { k = jamKey(null), deal = (list) => list[0], ms = 0, grid = masterGrid(), quantise = true, vel = 0.9 } = {}) {
  const kit = KIT[key];
  if (!kit) return null;
  const notes = jamNotes(key, k, deal);
  const q = quantiseHit(ms, { grid, on: quantise });
  const midi = notes[0];
  const call = { key, sound: kit.sound, midi, hz: midiHz(midi), notes: notes.length > 1 ? notes : undefined, vel, at: q.at, keyName: k.name };
  return { call, q };
}

const mod = (a, n) => ((a % n) + n) % n;

export function createLooper({ grid = masterGrid, bars = 1 } = {}) {
  const G = () => (typeof grid === 'function' ? grid() : grid);
  const six = () => sixteenthMs(G());
  let st = { mode: 'empty', bars: LOOP_BARS.includes(bars) ? bars : 1, events: [], origin: null, recStart: null, playFrom: null, overdub: false };
  const len = () => 16 * st.bars;
  const loopMs = () => len() * six();
  const barAtOrAfter = (ms) => { const g = G(); return g.origin + Math.ceil((ms - g.origin) / g.barMs - 1e-9) * g.barMs; };
  const settle = () => (st.events.length ? 'stopped' : 'empty');

  const api = {
    get state() { return { ...st, events: st.events.slice() }; },
    advance(ms) {
      if (st.mode === 'armed' && ms >= st.recStart - six() / 2) st = { ...st, mode: 'rec', events: [], origin: st.recStart, playFrom: st.recStart + loopMs() };
      if (st.mode === 'rec' && ms >= st.recStart + loopMs()) st = { ...st, mode: 'play' };
      return st.mode;
    },
    rec(ms) {
      if (st.mode === 'armed') { st = { ...st, mode: settle(), recStart: null }; return st.mode; }
      if (st.mode === 'rec') { st = { ...st, mode: 'play', playFrom: Math.max(st.playFrom, ms) }; return st.mode; }
      st = { ...st, mode: 'armed', recStart: barAtOrAfter(ms - six() / 2) };
      api.advance(ms);
      return st.mode;
    },
    // keep a hit at master time posMs (a quantised line, or the exact time when free); true when it was kept
    record(ev, posMs) {
      api.advance(posMs);
      let pos = null;
      if (st.mode === 'rec') pos = Math.max(0, (posMs - st.recStart) / six());
      else if (st.mode === 'play' && st.overdub) pos = (posMs - st.origin) / six();
      if (pos == null) return false;
      pos = mod(Math.round(pos * 1000) / 1000, len());
      if (st.events.some((e) => e.key === ev.key && Math.abs(e.pos - pos) < 1e-6)) return false;
      const kept = { key: ev.key, sound: ev.sound, midi: ev.midi, hz: ev.hz, notes: ev.notes, vel: ev.vel, pos, since: posMs };
      st = { ...st, events: [...st.events, kept].sort((a, b) => a.pos - b.pos) };
      return true;
    },
    // the loop's hits in master time [from, to): only while it plays (or past the end of the take being recorded)
    due(from, to) {
      if ((st.mode !== 'play' && st.mode !== 'rec') || !st.events.length || st.origin == null) return [];
      const L = loopMs();
      const s = six();
      const out = [];
      for (const ev of st.events) {
        const t0 = st.origin + ev.pos * s;
        for (let k = Math.ceil((from - t0) / L - 1e-9); ; k++) {
          const t = t0 + k * L;
          if (t >= to) break;
          if (t >= from && t >= st.playFrom && t > ev.since + 1e-6) out.push({ ...ev, at: t });
        }
      }
      return out.sort((a, b) => a.at - b.at);
    },
    play(ms) {
      if (!st.events.length || st.origin == null) return st.mode;
      if (st.mode === 'stopped') st = { ...st, mode: 'play', playFrom: ms };
      return st.mode;
    },
    stop() {
      if (st.mode === 'play' || st.mode === 'rec' || st.mode === 'armed') st = { ...st, mode: settle(), recStart: st.mode === 'armed' ? null : st.recStart };
      return st.mode;
    },
    clear() {
      st = { ...st, mode: 'empty', events: [], origin: null, recStart: null, playFrom: null, overdub: false };
      return st.mode;
    },
    setOverdub(v) { st = { ...st, overdub: !!v }; return st.overdub; },
    setBars(n) {
      if (!LOOP_BARS.includes(n) || n === st.bars || st.mode === 'rec') return st.bars;
      const old = len();
      const next = 16 * n;
      let events = st.events;
      if (next > old) events = Array.from({ length: next / old }, (_, i) => st.events.map((e) => ({ ...e, pos: e.pos + i * old }))).flat();
      else events = st.events.filter((e) => e.pos < next);
      st = { ...st, bars: n, events };
      return st.bars;
    },
    // where the loop stands at ms: the step and the beat in the loop; while armed, the beats left to the take
    cursor(ms) {
      api.advance(ms);
      const g = G();
      const base = st.mode === 'rec' || st.mode === 'play' || st.mode === 'stopped' ? st.origin ?? g.origin : g.origin;
      const step = mod(Math.floor((ms - base) / six() + 1e-9), len());
      const count = st.mode === 'armed' ? Math.max(0, Math.ceil((st.recStart - ms) / g.tickMs - 1e-9)) : null;
      return { mode: st.mode, bars: st.bars, beats: 4 * st.bars, beat: Math.floor(step / 4), step, count };
    },
  };
  return api;
}

const defaultAudible = () => sound.audible && !isAway();
const currentTheme = () => djLive.get()?.theme ?? null;

export function createJam({ voice = playOnEngine, theme = currentTheme, now = masterNow, grid = masterGrid, seed, audible = defaultAudible, auto = false, aheadMs = 200, bars = 1 } = {}) {
  const looper = createLooper({ grid, bars });
  const subs = new Set();
  let quantise = true;
  let last = null;
  let timer = null;
  let decks = { name: null, bags: {} };
  const G = () => (typeof grid === 'function' ? grid() : grid);

  const emit = (what) => { for (const f of subs) f(what); };
  const say = (call) => { try { if (voice(call) !== false) emit({ type: 'voice', call }); } catch { /* a voice that fails stays silent */ } };
  const deal = (key, k) => (list) => {
    const name = `${k.root}|${k.mode}`;
    if (decks.name !== name) decks = { name, bags: {} };
    const bag = decks.bags[key] ?? (decks.bags[key] = createBag(list, Number.isFinite(seed) ? { seed: (seed * 31 + key.length * 7 + key.charCodeAt(0)) >>> 0 } : {}));
    return bag.next();
  };
  const running = () => ['armed', 'rec', 'play'].includes(looper.state.mode);
  const keepTimer = () => {
    if (!auto || typeof setInterval === 'undefined') return;
    if (running() && !timer) { timer = setInterval(() => api.pump(), 50); timer.unref?.(); }
    if (!running() && timer) { clearInterval(timer); timer = null; }
  };
  const changed = () => { keepTimer(); emit({ type: 'state' }); };

  const api = {
    get state() { return { ...looper.state, quantise }; },
    get key() { return jamKey(theme()); },
    hit(key, { at, vel = 0.9 } = {}) {
      const ms = Number.isFinite(at) ? at : now();
      const k = jamKey(theme());
      const built = jamCall(key, { k, deal: deal(key, k), ms, grid: G(), quantise, vel });
      if (!built) return null;
      const { call, q } = built;
      const was = looper.state.mode;
      const kept = looper.record(call, q.lineMs);
      if (audible()) say(call);
      emit({ type: 'hit', call, kept });
      if (looper.state.mode !== was) changed();
      return call;
    },
    // schedule the loop's hits in the next aheadMs (and move the window on even when nothing may sound)
    pump(ms = now()) {
      const was = looper.state.mode;
      looper.advance(ms);
      const ahead = typeof document !== 'undefined' && document.hidden ? Math.max(aheadMs, 1600) : aheadMs;
      const to = ms + ahead;
      // a hit already in the past is not played late; a stalled timer skips what it missed
      const from = last == null ? ms : Math.max(last, ms);
      const can = audible();
      // silent: the window only keeps up with now, so the hits just ahead still play the moment sound returns
      last = Math.max(last ?? ms, can ? to : ms);
      const due = can ? looper.due(from, to) : [];
      for (const ev of due) say({ key: ev.key, sound: ev.sound, midi: ev.midi, hz: ev.hz, notes: ev.notes, vel: ev.vel, at: ev.at, looped: true });
      if (looper.state.mode !== was) changed();
      return due;
    },
    rec() { looper.rec(now()); changed(); return looper.state.mode; },
    play() { last = now(); looper.play(now()); changed(); return looper.state.mode; },
    stop() { looper.stop(); changed(); return looper.state.mode; },
    toggle() { return looper.state.mode === 'play' || looper.state.mode === 'rec' ? api.stop() : api.play(); },
    toggleOverdub() { looper.setOverdub(!looper.state.overdub); changed(); return looper.state.overdub; },
    clear() { looper.clear(); changed(); return looper.state.mode; },
    setBars(n) { looper.setBars(n); changed(); return looper.state.bars; },
    cycleBars() { const i = LOOP_BARS.indexOf(looper.state.bars); return api.setBars(LOOP_BARS[(i + 1) % LOOP_BARS.length]); },
    setQuantise(v) { quantise = !!v; changed(); return quantise; },
    pause(v) { if (v) api.stop(); },
    // the indicator's read can be the first to see a bar line pass, so a change it finds is announced like any other
    cursor(ms = now()) {
      const was = looper.state.mode;
      const c = looper.cursor(ms);
      if (c.mode !== was) changed();
      return c;
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    dispose() { if (timer) clearInterval(timer); timer = null; subs.clear(); },
  };
  return api;
}

// ── the sounds ──

const clamp01 = (x) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0.9));
const free = (nodes) => () => { for (const n of nodes) try { n?.disconnect(); } catch { /* gone */ } };

// a gain that rises from zero over `attack` to `peak`, then falls toward zero with time constant `decay / 4`
function env(ctx, out, t, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + Math.max(TONE.attackMin, attack));
  g.gain.setTargetAtTime(0, t + Math.max(TONE.attackMin, attack), Math.max(TONE.releaseMin, decay) / 4);
  g.connect(out);
  return g;
}
function tone(ctx, into, type, f, t, end) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.connect(into);
  o.start(t);
  o.stop(end);
  return o;
}
function noise(ctx, into, t, end, filters) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  let last = s;
  const fs = [];
  for (const [type, f, Q] of filters) {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = Q;
    last.connect(b);
    last = b;
    fs.push(b);
  }
  last.connect(into);
  s.start(t);
  s.stop(end);
  s.onended = free([s, ...fs]);
  return { s, fs };
}

const HITS = {
  kick(ctx, out, f, t, v) {
    const g = env(ctx, out, t, 0.5 * v, 0.004, 0.42);
    const o = tone(ctx, g, 'sine', f * 3, t, t + 0.5);
    o.frequency.setValueAtTime(f * 3, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
    o.onended = free([o, g]);
  },
  clap(ctx, out, f, t, v) {
    const g = env(ctx, out, t, 0.22 * v, 0.004, 0.2);
    // three quick strikes and a tail: the hands, then the room
    const e2 = ctx.createGain();
    e2.gain.setValueAtTime(1, t);
    for (const d of [0.011, 0.022]) { e2.gain.setValueAtTime(0.35, t + d); e2.gain.setValueAtTime(1, t + d + 0.004); }
    e2.connect(g);
    const { s, fs } = noise(ctx, e2, t, t + 0.3, [['bandpass', f, 1.4], ['lowpass', Math.min(9000, f * 4), 0.6]]);
    s.onended = free([s, ...fs, e2, g]);
  },
  hat(ctx, out, f, t, v) {
    const g = env(ctx, out, t, 0.12 * v, 0.004, 0.06);
    const { s, fs } = noise(ctx, g, t, t + 0.12, [['highpass', f * 0.8, 0.7], ['bandpass', f, 1.1]]);
    s.onended = free([s, ...fs, g]);
  },
  open(ctx, out, f, t, v) {
    const g = env(ctx, out, t, 0.1 * v, 0.006, 0.42);
    const { s, fs } = noise(ctx, g, t, t + 0.55, [['highpass', f * 0.8, 0.7], ['bandpass', f, 0.9]]);
    s.onended = free([s, ...fs, g]);
  },
  bass(ctx, out, f, t, v) {
    const g = env(ctx, out, t, 0.34 * v, 0.008, 0.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(TONE.rawCeiling, f * 6);
    lp.Q.value = 0.8;
    lp.connect(g);
    const a = tone(ctx, lp, 'triangle', f, t, t + 0.7);
    const b = tone(ctx, g, 'sine', f, t, t + 0.7);
    a.onended = free([a, b, lp, g]);
  },
  pluck(ctx, out, f, t, v) {
    const g = env(ctx, out, t, 0.2 * v, 0.004, 0.55);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(TONE.rawCeiling, f * 8), t);
    lp.frequency.setTargetAtTime(Math.min(TONE.rawCeiling, f * 2), t, 0.08);
    lp.connect(g);
    const a = tone(ctx, lp, 'triangle', f, t, t + 0.8);
    const b = tone(ctx, lp, 'sine', f * 2, t, t + 0.8);
    a.onended = free([a, b, lp, g]);
  },
  bell(ctx, out, f, t, v) {
    const g = env(ctx, out, t, 0.09 * v, 0.005, 1.8);
    const end = t + 2.2;
    const a = tone(ctx, g, 'sine', f, t, end);
    const p = ctx.createGain();
    p.gain.value = 0.32;
    p.connect(g);
    const b = tone(ctx, p, 'sine', f * 2.76, t, end);
    a.onended = free([a, b, p, g]);
  },
  chord(ctx, out, f, t, v, call) {
    const notes = Array.isArray(call?.notes) && call.notes.length ? call.notes.map(midiHz) : [f];
    notes.forEach((hz, i) => {
      const at = t + i * 0.018; // a soft strum, low to high
      const g = env(ctx, out, at, (0.12 * v) / Math.sqrt(notes.length), 0.01, 1.3);
      const a = tone(ctx, g, 'triangle', hz, at, at + 1.6);
      a.onended = free([a, g]);
    });
  },
  vox(ctx, out, f, t, v) {
    // a buzz through two vowel formants that move from "ah" to "ee": a vocoder's voice, short
    const g = env(ctx, out, t, 0.2 * v, 0.006, 0.22);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = TONE.rawCeiling;
    lp.Q.value = 0.5;
    const forms = [[730, 270], [1090, 2290]].map(([a, b]) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 6;
      bp.frequency.setValueAtTime(a, t);
      bp.frequency.linearRampToValueAtTime(b, t + 0.16);
      lp.connect(bp);
      bp.connect(g);
      return bp;
    });
    const o = tone(ctx, lp, 'sawtooth', f, t, t + 0.3);
    o.onended = free([o, lp, ...forms, g]);
  },
  settle(ctx, out, f, t, v) {
    // the site's whole idea in half a second: noise, a band that narrows onto the pitch, then the pure tone
    const g = env(ctx, out, t, 0.16 * v, 0.006, 0.7);
    const n = ctx.createGain();
    n.gain.setValueAtTime(1, t);
    n.gain.setTargetAtTime(0, t + 0.12, 0.08);
    n.connect(g);
    const { s, fs } = noise(ctx, n, t, t + 0.6, [['bandpass', f * 4, 0.8]]);
    const bp = fs[0];
    bp.frequency.setValueAtTime(f * 4, t);
    bp.frequency.exponentialRampToValueAtTime(f, t + 0.2);
    bp.Q.setValueAtTime(0.8, t);
    bp.Q.linearRampToValueAtTime(18, t + 0.2);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0, t);
    tg.gain.linearRampToValueAtTime(0.9, t + 0.18);
    tg.connect(g);
    const o = tone(ctx, tg, 'sine', f, t, t + 0.9);
    o.onended = free([o, s, ...fs, n, tg, g]);
  },
};

export function playJamHit(ctx, out, call, t) {
  const play = call && HITS[call.key];
  const f = Number(call?.hz);
  if (!play || !ctx || !out || !(f > 20) || f > 12000) return false;
  const at = Number.isFinite(t) ? t : ctx.currentTime;
  try {
    play(ctx, out, f, at, clamp01(call.vel), call);
  } catch {
    return false;
  }
  return true;
}

// THE JAM'S VOICE CHAINS (lane MELODYFX2): the five tonal hits a visitor builds a tune from each play through their
// own chain, a warm drive and two to four more from the 'free' profile (the pool less the five effects that only
// move on a bar clock). A chain is built on its instrument's first hit and kept: every later hit on that instrument
// goes into the same bus, so a hit costs its own few nodes and nothing more. A new theme deals new chains, which
// crossfade in over 0.4 s. The kick, clap, hats and bass play dry (the bass carries the root, as the DJ's does).
export const JAM_TONAL = Object.freeze({ pluck: 'jam-pluck', bell: 'jam-bell', chord: 'jam-chord', vox: 'jam-vox', settle: 'jam-settle' });
export function createJamVoices(ctx, out, { seed = 0x6a616d, theme = currentTheme, grid = masterGrid } = {}) {
  const dealer = createVoiceDealer({ seed });
  // each chain trimmed back to its instrument's dry level (voice-fx.js LEVEL_MATCH_DB)
  const buses = createVoiceBuses(ctx, out, JAM_SLOTS, { trim: (v) => levelTrim(LEVEL_MATCH_DB[v.slot]) });
  let dealtFor;
  // one static bar of tempo and key for the effects that read one (a delay's beats, a comb's root, a sync tremolo)
  const info = (th) => ({ beatDur: (grid()?.barMs ?? 2000) / 4000, bar: 0, root: jamKey(th).root, chord: [], melody: [] });
  return {
    buses,
    get palette() { return buses.palette; },
    // the node a hit plays into: its instrument's bus (built on its first hit), or `out` for a drum or the bass
    input(call, t = ctx.currentTime) {
      const slot = JAM_TONAL[call?.key];
      if (!slot) return out;
      const th = theme() ?? null;
      if (dealtFor === undefined || th !== dealtFor) {
        const fade = dealtFor === undefined ? 0 : 0.4;
        dealtFor = th;
        buses.palette(dealer.palette({ theme: th ?? 'highlands', slots: JAM_SLOTS, profile: 'free' }), t, fade, info(th));
      }
      return buses.input(slot, t);
    },
    states: () => buses.states(),
    dispose: () => buses.dispose(),
  };
}

// the default voice: one mixer channel of its own (reverb a little, a touch of delay), into the master, the mute and
// the limiter like every sound here; each hit holds the context awake for its ring (THE DEMAND). The tonal hits go
// through THE JAM'S VOICE CHAINS on that channel; the loop layers and the live radio's followed loops call this too.
let channel = null;
export function playOnEngine(call) {
  const E = getEngine();
  if (!E || !sound.audible || isAway()) return false;
  if (!channel || channel.E !== E) {
    const ch = createChannel(E, { level: 0.7, reverb: 0.16, delay: 0.05, filter: 16000, fadeIn: 0.03, demand: false });
    channel = { E, ch, voices: createJamVoices(E.ctx, ch.input) };
  }
  holdSound(2.6);
  const t = Math.max(E.ctx.currentTime + 0.005, toAudioTime(E.ctx, call.at));
  return playJamHit(E.ctx, channel.voices.input(call, t), call, t);
}
// the jam's voice chains as they stand (null before the first hit): for the parts popover and the tests
export const jamVoices = () => channel?.voices ?? null;
