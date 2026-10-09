// settle-hear · layers - THE LAYERS: many loops at once, each one a line. The first loop records itself (hit an
// instrument and the next bars come back to you); REC lays another loop on top. Every loop is whole bars on THE
// MASTER BEAT, can be stretched to more or fewer bars, faded out by a timer, and THE DJ fades old loops out by itself.
//
// <claudes_code_comments>
// ** Function List **
// LAYER_BARS                  - { min: 1, max: 16, take: 4 }: the bars a layer may span, and the default take
// TAKE_BARS                   - the take lengths REC may use: 1, 2, 4, 8 (4 by default)
// LAYER_MAX                   - six layers at most; REC says "full" past that
// TIMER_BARS                  - the fade timer's steps: off -> 4 -> 8 -> 16 bars -> off
// DJ_FADE                     - THE DJ's own fades: a layer untouched for 24 bars fades over 8; with more than 4
//                               playing, the oldest untouched for 8 bars fades; one DJ fade at a time
// tileEvents(src, srcBars, bars) - a take's hits repeated to fill `bars` (cut where it ends)
// createLayerStack({ grid })  - the stack, pure: rec, record, advance, due, play, stop, remove, setBars, cycleTimer,
//                               djTick, release, playAll, stopAll, gainAt, timerLeft, cursor, playhead, layers
// createLoopJam(opts)         - the instrument row's engine with the stack: hit, pump, rec, cycleTake, toggle(id),
//                               close(id), stretch(id, n), timer(id), toggleAll, release, pause, cursor, subscribe,
//                               snapshot(), load(list)
// layerEvent(e)               - one saved hit, checked and given back its sound and Hz (the kit's sound, midiHz), or null
//
// ** Technical Review **
// - A LAYER is { id, state: armed | rec | play | stopped, origin (a master bar line), bars, src (the take's hits, in
//   sixteenths from the origin), srcBars (the take's own length), fade }. Its hits play at origin + pos x sixteenth +
//   k x loop length, so every repeat lands on the same sixteenths and a layer stays in phase with the master beat
//   through stop, play and stretch.
// - THE FIRST LOOP RECORDS ITSELF: a hit when the stack is empty opens a take on the bar the hit falls in (the hit is
//   kept), TAKE_BARS long; at its end it plays. After that REC is how a visitor layers: the take starts on the next bar
//   line; a second REC while recording ends the take on the next bar line (so its length stays whole bars); REC while
//   armed cancels. A take with no hits leaves no line.
// - STRETCH REPEATS, IT NEVER TIME-STRETCHES: dragging a layer to 6 bars plays its 4-bar take and then its first 2
//   bars again; dragging to 2 plays the first 2 bars. Every hit stays on a master sixteenth and in the DJ's tempo,
//   which a time-stretch would break (a 4-bar take stretched to 6 would put hits between sixteenths and slow the
//   pattern against the beat). The take is kept whole, so dragging back restores it exactly.
// - THE FADE: gain g0 at `from` falls in a straight line to 0 at `to`; at `to` the layer is gone. The visitor's timer
//   (TIMER_BARS) starts from the gain the layer has now; cancelling it returns the layer to full. Touching a layer
//   (play, stop, stretch) cancels a DJ fade, never the visitor's timer. A new set releases every layer over one bar.
// - THE TRACK RECORD (lane TRACKTAGS): snapshot() gives every layer that holds hits as plain data ({ bars, srcBars,
//   playing, src: [{ key, pos, vel, midi, notes }] }), small enough for a page to keep; load(list) lays such a list
//   back as lines that start on the next bar line and play (at most LAYER_MAX in all). The hits are data, never
//   audio: a loaded hit plays the same instrument at the same sixteenth, at the same pitch it was taken at (its midi
//   is kept, so a loop saved in one key plays in that key under a DJ in another).
// - Every hit a layer plays goes out as one voice call with vel x gain; hits under 2% gain are skipped. MUTE ALL and
//   PAUSE ALL stop every call (the default audible gate); the window keeps moving while silent, so unmuting never
//   fires a burst of missed hits (the same pump as jam.js).
// </claudes_code_comments>

import { sound } from './control.js';
import { isAway } from './engine.js';
import { masterGrid, masterNow } from './masterbeat.js';
import { createBag } from './deck.js';
import { djLive } from './djlive.js';
import { jamKey, jamCall, sixteenthMs, playOnEngine, JAM_KIT } from './jam.js';
import { midiHz } from './tuning.js';
import { soundEvery } from './soundclock.js';

export const LAYER_BARS = Object.freeze({ min: 1, max: 16, take: 4 });
export const TAKE_BARS = Object.freeze([1, 2, 4, 8]);
export const LAYER_MAX = 6;
export const TIMER_BARS = Object.freeze([4, 8, 16]);
export const DJ_FADE = Object.freeze({ after: 24, over: 8, crowd: 4, crowdAfter: 8 });

const mod = (a, n) => ((a % n) + n) % n;
const clampBars = (n) => Math.min(LAYER_BARS.max, Math.max(LAYER_BARS.min, Math.round(Number.isFinite(Number(n)) ? Number(n) : LAYER_BARS.take)));

// a saved hit back as a layer event: a known instrument, a position in sixteenths, a velocity and its pitch
const KIT_SOUND = Object.fromEntries(JAM_KIT.map((k) => [k.key, k.sound]));
const midiOk = (m) => Number.isFinite(m) && m >= 0 && m <= 127;
export function layerEvent(e) {
  if (!e || typeof e !== 'object' || !KIT_SOUND[e.key]) return null;
  const pos = Number(e.pos);
  const vel = Number(e.vel);
  if (!Number.isFinite(pos) || pos < 0 || pos >= 16 * LAYER_BARS.max) return null;
  const midi = midiOk(Number(e.midi)) ? Number(e.midi) : null;
  const notes = Array.isArray(e.notes) && e.notes.length > 1 && e.notes.every((n) => midiOk(Number(n))) ? e.notes.map(Number).slice(0, 6) : undefined;
  return { key: e.key, sound: KIT_SOUND[e.key], midi, hz: midi == null ? null : midiHz(midi), notes, vel: Number.isFinite(vel) ? Math.min(1, Math.max(0.05, vel)) : 0.9, pos, since: -Infinity };
}

export function tileEvents(src = [], srcBars = 1, bars = srcBars) {
  const L = 16 * srcBars;
  const end = 16 * bars;
  const out = [];
  for (let k = 0; k * L < end; k++) {
    for (const e of src) {
      const pos = e.pos + k * L;
      if (pos < end - 1e-9) out.push({ ...e, pos });
    }
  }
  return out.sort((a, b) => a.pos - b.pos);
}

export function createLayerStack({ grid = masterGrid } = {}) {
  const G = () => (typeof grid === 'function' ? grid() : grid);
  const six = () => sixteenthMs(G());
  const barMs = () => G().barMs;
  const lineAtOrAfter = (ms) => { const g = G(); return g.origin + Math.ceil((ms - g.origin) / g.barMs - 1e-9) * g.barMs; };
  const lineAtOrBefore = (ms) => { const g = G(); return g.origin + Math.floor((ms - g.origin) / g.barMs + 1e-9) * g.barMs; };
  let layers = [];
  let nextId = 1;

  const find = (id) => layers.find((l) => l.id === id) ?? null;
  const drop = (id) => { layers = layers.filter((l) => l.id !== id); };
  const loopMs = (l) => 16 * l.bars * six();
  const gain = (l, ms) => {
    if (!l?.fade) return 1;
    const { from, to, g0 } = l.fade;
    if (ms <= from) return g0;
    return Math.max(0, g0 * (1 - (ms - from) / Math.max(1, to - from)));
  };
  const view = (l) => ({
    id: l.id, state: l.state, bars: l.bars, srcBars: l.srcBars, origin: l.origin, recEnd: l.recEnd, auto: !!l.auto,
    touched: l.touched, timer: l.timer ?? null, fade: l.fade ? { ...l.fade } : null,
    events: tileEvents(l.src, l.srcBars, l.bars),
  });
  const cancelDjFade = (l) => { if (l.fade && l.fade.by === 'dj') l.fade = null; };
  const startFade = (l, ms, overMs, by) => { l.fade = { from: ms, to: ms + Math.max(1, overMs), g0: gain(l, ms), by }; };

  // a take still recording ends on the next bar line, so its length stays whole bars
  const closeTake = (l, ms) => {
    const end = Math.max(lineAtOrAfter(ms), l.origin + barMs());
    const n = Math.round((end - l.origin) / barMs());
    l.recEnd = end;
    l.bars = l.srcBars = n;
    l.src = l.src.filter((e) => e.pos < 16 * n - 1e-9);
  };

  const api = {
    get layers() { return layers.map(view); },
    get count() { return layers.length; },
    recording() { const l = layers.find((x) => x.state === 'armed' || x.state === 'rec'); return l ? view(l) : null; },
    // REC: arm a new layer on the next bar line; while recording, end the take on the next line; while armed, cancel
    rec(ms, bars = LAYER_BARS.take) {
      const busy = layers.find((l) => l.state === 'armed' || l.state === 'rec');
      if (busy?.state === 'armed') { drop(busy.id); return { did: 'cancel', id: busy.id }; }
      if (busy?.state === 'rec') { closeTake(busy, ms); return { did: 'close', id: busy.id }; }
      if (layers.length >= LAYER_MAX) return { did: 'full', id: null };
      const n = clampBars(bars);
      const start = lineAtOrAfter(ms - six() / 2);
      const l = { id: nextId++, state: 'armed', origin: start, recEnd: start + n * barMs(), bars: n, srcBars: n, src: [], fade: null, timer: null, touched: ms, playFrom: null, auto: false };
      layers.push(l);
      api.advance(ms);
      return { did: 'arm', id: l.id };
    },
    // keep a hit at master time lineMs in the take being recorded; with `auto` and an empty stack, a take opens on the
    // bar the hit falls in (THE FIRST LOOP RECORDS ITSELF). Returns the layer id, or null when the hit was not kept.
    record(ev, lineMs, { auto = false, bars = LAYER_BARS.take } = {}) {
      api.advance(lineMs);
      let l = layers.find((x) => x.state === 'rec' && lineMs >= x.origin - 1e-6 && lineMs < x.recEnd);
      if (!l && auto && layers.length === 0) {
        const n = clampBars(bars);
        const origin = lineAtOrBefore(lineMs);
        l = { id: nextId++, state: 'rec', origin, recEnd: origin + n * barMs(), bars: n, srcBars: n, src: [], fade: null, timer: null, touched: lineMs, playFrom: null, auto: true };
        layers.push(l);
      }
      if (!l) return null;
      const pos = mod(Math.round(Math.max(0, (lineMs - l.origin) / six()) * 1000) / 1000, 16 * l.srcBars);
      if (l.src.some((e) => e.key === ev.key && Math.abs(e.pos - pos) < 1e-6)) return l.id;
      l.src = [...l.src, { key: ev.key, sound: ev.sound, midi: ev.midi, hz: ev.hz, notes: ev.notes, vel: ev.vel, pos, since: lineMs }].sort((a, b) => a.pos - b.pos);
      l.touched = lineMs;
      return l.id;
    },
    // move every layer on to ms: armed -> rec on its line, rec -> play at the take's end (an empty take leaves), a fade
    // that ran out removes its layer. Returns what changed: [{ id, what: 'rec' | 'play' | 'empty' | 'faded' }]
    advance(ms) {
      const changes = [];
      for (const l of layers.slice()) {
        if (l.state === 'armed' && ms >= l.origin - six() / 2) { l.state = 'rec'; changes.push({ id: l.id, what: 'rec' }); }
        if (l.state === 'rec' && ms >= l.recEnd) {
          if (!l.src.length) { drop(l.id); changes.push({ id: l.id, what: 'empty' }); continue; }
          l.state = 'play';
          l.playFrom = l.recEnd;
          l.touched = l.recEnd;
          changes.push({ id: l.id, what: 'play' });
        }
        if (l.fade && ms >= l.fade.to) { drop(l.id); changes.push({ id: l.id, what: 'faded' }); }
      }
      return changes;
    },
    // every playing layer's hits in master time [from, to), with vel scaled by the layer's gain at that moment
    due(from, to) {
      const s = six();
      const out = [];
      for (const l of layers) {
        if (l.state !== 'play') continue;
        const L = loopMs(l);
        for (const ev of tileEvents(l.src, l.srcBars, l.bars)) {
          const t0 = l.origin + ev.pos * s;
          for (let k = Math.ceil((from - t0) / L - 1e-9); ; k++) {
            const t = t0 + k * L;
            if (t >= to) break;
            if (t < from || t < l.playFrom || t <= ev.since + 1e-6) continue;
            const g = gain(l, t);
            if (g < 0.02) continue;
            out.push({ ...ev, at: t, vel: ev.vel * g, layer: l.id });
          }
        }
      }
      return out.sort((a, b) => a.at - b.at);
    },
    play(id, ms) {
      const l = find(id);
      if (!l || l.state !== 'stopped') return l?.state ?? null;
      l.state = 'play'; l.playFrom = ms; l.touched = ms; cancelDjFade(l);
      return l.state;
    },
    stop(id, ms) {
      const l = find(id);
      if (!l) return null;
      if (l.state === 'armed') { drop(id); return 'gone'; }
      if (l.state === 'rec') { closeTake(l, ms); return l.state; }
      if (l.state === 'play') { l.state = 'stopped'; l.touched = ms; cancelDjFade(l); }
      return l.state;
    },
    remove(id) { const had = !!find(id); drop(id); return had; },
    // stretch: 1 .. 16 bars, repeating the take to fill (never while it records)
    setBars(id, n, ms) {
      const l = find(id);
      if (!l || l.state === 'armed' || l.state === 'rec') return l?.bars ?? null;
      l.bars = clampBars(n); l.touched = ms; cancelDjFade(l);
      return l.bars;
    },
    // the fade timer: off -> 4 -> 8 -> 16 bars -> off; each step fades from the gain the layer has now
    cycleTimer(id, ms) {
      const l = find(id);
      if (!l || l.state === 'armed' || l.state === 'rec') return null;
      const i = TIMER_BARS.indexOf(l.timer);
      const next = i < 0 ? TIMER_BARS[0] : TIMER_BARS[i + 1] ?? null;
      l.timer = next;
      if (next == null) l.fade = null;
      else startFade(l, ms, next * barMs(), 'you');
      return next;
    },
    // THE DJ lets an old loop go: one fade at a time, the oldest untouched layer first
    djTick(ms) {
      if (layers.some((l) => l.fade && l.fade.by === 'dj')) return null;
      const playing = layers.filter((l) => l.state === 'play');
      const free = playing.filter((l) => !l.fade).sort((a, b) => a.touched - b.touched);
      const old = free[0];
      if (!old) return null;
      const idle = (ms - old.touched) / barMs();
      const crowded = playing.length > DJ_FADE.crowd;
      if (idle >= DJ_FADE.after || (crowded && idle >= DJ_FADE.crowdAfter)) {
        startFade(old, ms, DJ_FADE.over * barMs(), 'dj');
        return old.id;
      }
      return null;
    },
    // a new set: every layer lets go over `overMs` (one bar by default); a take in progress keeps what it caught
    release(ms, overMs = barMs()) {
      let n = 0;
      for (const l of layers.slice()) {
        if (l.state === 'armed' || l.state === 'stopped' || (l.state === 'rec' && !l.src.length)) { drop(l.id); n += 1; continue; }
        if (l.state === 'rec') { l.state = 'play'; l.playFrom = ms; }
        l.timer = null;
        startFade(l, ms, overMs, 'set');
        n += 1;
      }
      return n;
    },
    // THE TRACK RECORD (lane TRACKTAGS): every layer with hits, as plain data
    snapshot() {
      return layers.filter((l) => l.src.length && l.state !== 'armed').map((l) => ({
        bars: l.bars,
        srcBars: l.srcBars,
        playing: l.state === 'play' || l.state === 'rec',
        src: l.src.map((e) => ({ key: e.key, pos: e.pos, vel: Math.round(e.vel * 100) / 100, midi: e.midi ?? null, ...(e.notes ? { notes: e.notes.slice() } : {}) })),
      }));
    },
    // lay a saved list back: each one a playing line from the next bar line; returns the ids it made
    load(list, ms) {
      const made = [];
      if (!Array.isArray(list)) return made;
      const origin = lineAtOrAfter(ms);
      for (const it of list) {
        if (layers.length >= LAYER_MAX) break;
        const srcBars = clampBars(it?.srcBars);
        const src = (Array.isArray(it?.src) ? it.src : []).map(layerEvent).filter((e) => e && e.pos < 16 * srcBars).sort((a, b) => a.pos - b.pos);
        if (!src.length) continue;
        const l = { id: nextId++, state: 'play', origin, recEnd: origin, bars: clampBars(it.bars ?? srcBars), srcBars, src, fade: null, timer: null, touched: ms, playFrom: origin, auto: false };
        layers.push(l);
        made.push(l.id);
      }
      return made;
    },
    playAll(ms) { for (const l of layers) if (l.state === 'stopped') api.play(l.id, ms); },
    stopAll(ms) { for (const l of layers.slice()) if (l.state === 'play' || l.state === 'armed' || l.state === 'rec') api.stop(l.id, ms); },
    gainAt(id, ms) { return gain(find(id), ms); },
    timerLeft(id, ms) { const l = find(id); return l?.fade ? Math.max(0, Math.ceil((l.fade.to - ms) / barMs() - 1e-9)) : null; },
    // where a playing layer's loop stands at ms, 0 .. 1 (null when it is not playing)
    playhead(id, ms) {
      const l = find(id);
      if (!l || l.state !== 'play') return null;
      return mod(ms - l.origin, loopMs(l)) / loopMs(l);
    },
    // the take indicator: while armed the beats left to the take; while recording the beat in the take; else the
    // beat in the master bar
    cursor(ms) {
      const g = G();
      const l = layers.find((x) => x.state === 'armed' || x.state === 'rec');
      if (l?.state === 'armed') return { mode: 'armed', beats: 4 * l.bars, beat: null, count: Math.max(0, Math.ceil((l.origin - ms) / g.tickMs - 1e-9)) };
      if (l?.state === 'rec') return { mode: 'rec', beats: 4 * l.bars, beat: Math.min(4 * l.bars - 1, Math.max(0, Math.floor((ms - l.origin) / g.tickMs + 1e-9))), count: null };
      const playing = layers.some((x) => x.state === 'play');
      return { mode: playing ? 'play' : 'idle', beats: 4, beat: mod(Math.floor((ms - g.origin) / g.tickMs + 1e-9), 4), count: null };
    },
  };
  return api;
}

const defaultAudible = () => sound.audible && !isAway();
const currentTheme = () => djLive.get()?.theme ?? null;

export function createLoopJam({ voice = playOnEngine, theme = currentTheme, now = masterNow, grid = masterGrid, seed, audible = defaultAudible, auto = false, aheadMs = 200, take = LAYER_BARS.take, autoTake = true, djFades = true } = {}) {
  const stack = createLayerStack({ grid });
  const subs = new Set();
  let quantise = true;
  let takeBars = TAKE_BARS.includes(take) ? take : LAYER_BARS.take;
  let last = null;
  let timer = null;
  let decks = { name: null, bags: {} };
  const G = () => (typeof grid === 'function' ? grid() : grid);

  const emit = (what) => { for (const f of subs) { try { f(what); } catch { /* a listener that fails stays out of the way */ } } };
  const say = (call) => { try { if (voice(call) !== false) emit({ type: 'voice', call }); } catch { /* a voice that fails stays silent */ } };
  const deal = (key, k) => (list) => {
    const name = `${k.root}|${k.mode}`;
    if (decks.name !== name) decks = { name, bags: {} };
    const bag = decks.bags[key] ?? (decks.bags[key] = createBag(list, Number.isFinite(seed) ? { seed: (seed * 31 + key.length * 7 + key.charCodeAt(0)) >>> 0 } : {}));
    return bag.next();
  };
  const running = () => stack.layers.some((l) => l.state !== 'stopped' || l.fade);
  const keepTimer = () => {
    if (!auto) return;
    // THE SOUND CLOCK (lane DJSILENCE, soundclock.js): a worker's tick, never throttled with a hidden tab
    if (running() && !timer) timer = soundEvery(50, () => api.pump());
    if (!running() && timer) { timer.stop(); timer = null; }
  };
  const changed = () => { keepTimer(); emit({ type: 'state' }); };
  const you = (why) => emit({ type: 'you', why });

  const api = {
    get state() { return { layers: stack.layers, quantise, take: takeBars, recording: stack.recording(), full: stack.count >= LAYER_MAX }; },
    get key() { return jamKey(theme()); },
    hit(key, { at, vel = 0.9 } = {}) {
      const ms = Number.isFinite(at) ? at : now();
      const k = jamKey(theme());
      const built = jamCall(key, { k, deal: deal(key, k), ms, grid: G(), quantise, vel });
      if (!built) return null;
      const { call, q } = built;
      const before = stack.count;
      const rec = stack.recording()?.state;
      const kept = stack.record(call, q.lineMs, { auto: autoTake, bars: takeBars });
      if (audible()) say(call);
      emit({ type: 'hit', call, kept: kept != null });
      you('hit');
      if (stack.count !== before || stack.recording()?.state !== rec) changed();
      return call;
    },
    // schedule the layers' hits in the next aheadMs; the window moves on even while nothing may sound
    pump(ms = now()) {
      const changes = stack.advance(ms);
      const dj = djFades ? stack.djTick(ms) : null;
      const ahead = typeof document !== 'undefined' && document.hidden ? Math.max(aheadMs, 1600) : aheadMs;
      const to = ms + ahead;
      const from = last == null ? ms : Math.max(last, ms);
      const can = audible();
      last = Math.max(last ?? ms, can ? to : ms);
      const due = can ? stack.due(from, to) : [];
      for (const ev of due) say({ key: ev.key, sound: ev.sound, midi: ev.midi, hz: ev.hz, notes: ev.notes, vel: ev.vel, at: ev.at, looped: true, layer: ev.layer });
      if (changes.length || dj != null) changed();
      return due;
    },
    rec() { const r = stack.rec(now(), takeBars); you('rec'); changed(); return r; },
    cycleTake() { const i = TAKE_BARS.indexOf(takeBars); takeBars = TAKE_BARS[(i + 1) % TAKE_BARS.length]; changed(); return takeBars; },
    toggle(id) {
      const l = stack.layers.find((x) => x.id === id);
      if (!l) return null;
      const r = l.state === 'stopped' ? (last = now(), stack.play(id, now())) : stack.stop(id, now());
      you('layer'); changed();
      return r;
    },
    close(id) { const r = stack.remove(id); you('layer'); changed(); return r; },
    stretch(id, n) { const r = stack.setBars(id, n, now()); you('layer'); changed(); return r; },
    timer(id) { const r = stack.cycleTimer(id, now()); you('layer'); changed(); return r; },
    toggleAll() {
      const any = stack.layers.some((l) => l.state === 'play' || l.state === 'rec' || l.state === 'armed');
      if (any) stack.stopAll(now()); else { last = now(); stack.playAll(now()); }
      you('layer'); changed();
      return !any;
    },
    // a new set: every layer lets go over one bar (no 'you': the DJ did this)
    release(overMs) { const n = stack.release(now(), overMs); changed(); return n; },
    setQuantise(v) { quantise = !!v; changed(); return quantise; },
    // THE TRACK RECORD (lane TRACKTAGS): the layers as plain data, and a saved list laid back (no 'you': a replay)
    snapshot() { return stack.snapshot(); },
    load(list) { const ms = now(); const ids = stack.load(list, ms); if (ids.length) { last = Math.max(last ?? ms, ms); changed(); } return ids; },
    pause(v) { if (v) { stack.stopAll(now()); changed(); } },
    gainAt(id, ms = now()) { return stack.gainAt(id, ms); },
    timerLeft(id, ms = now()) { return stack.timerLeft(id, ms); },
    playhead(id, ms = now()) { return stack.playhead(id, ms); },
    // the indicator's read can be the first to see a bar line pass, so a change it finds is announced
    cursor(ms = now()) {
      const changes = stack.advance(ms);
      if (changes.length) changed();
      return stack.cursor(ms);
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    dispose() { if (timer) timer.stop(); timer = null; subs.clear(); },
  };
  return api;
}
