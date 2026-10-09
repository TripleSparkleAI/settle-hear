// settle-hear · pagechime - THE PAGE CHIMES, PLAYED (lane PAGECHIMES, navigator 2026-10-09: "short, subtle noises for
// page changes, in our usual rotation"; "on top, this new on-page-swap noise: bing boop de doop"). One quiet chime per
// page change, dealt by THE DECK RULE from the 50 in pagechimes.js, layered just after the page's own sound.
//
// <claudes_code_comments>
// ** Function List **
// PAGE_CHIME                     - the numbers: the channel's fader, the offset after the page sound, the cut fade, the
//                                  room, the tone filter, the wait for the table, the target peak at the master input
// CHIME_KEY                      - the session key of the on/off choice: 'settle-hear:pagechimes'
// readChimesOn(storage) / writeChimesOn(storage, on) - the choice, read and written, never throwing; absent is ON
// createChimeSwitch({ storage }) - { on, setOn(v), toggle(), subscribe(fn) }; fn(on) on every change
// pageChimes                     - the page's one switch (a module singleton on sessionStorage)
// addChimeVeto(fn)               - fn() returns a reason string to hold a chime back (the site's hero sound off), or
//                                  null; returns off()
// loadPageChimes()               - fetch the 50 (pagechimes.js) once, on demand; resolves to the list
// chimesLoaded()                 - whether that fetch has finished
// chimeRefusal({ audition })     - why a chime would not play now, or null: off, no-engine, before-gesture, muted,
//                                  volume-0, paused, hidden, or a veto's reason; an audition (a press on #/hear)
//                                  passes the switch and the vetoes, never MUTE ALL, volume 0, PAUSE ALL or the gesture
// playPageChime({ id, index, reason, at, audition }) - play one now: by id or index, else the deck's next; null when
//                                  refused
// pageChimeChange({ key })       - THE TRIGGER: a page change (sfx.js sfxPage calls it); plays the deck's next chime,
//                                  waiting up to PAGE_CHIME.loadWaitMs for the table when it is still on its way
// onPageChime(fn)                - fn(detail) for every chime played or refused; returns off()
// resetPageChimes({ seed, now }) - a fresh deck and state (tests)
//
// ** Technical Review **
// - THE START RULE: nothing here builds an AudioContext. engine.getEngine() only reads the engine; with none, or with
//   the browser still waiting for the visitor's first gesture (engine.gestureWaiting(), or sound.unlocked false), a
//   chime is refused and nothing is built.
// - SILENT WHEN THE SOUND IS NOT ON: MUTE ALL (sound.audible), a master level of 0 (engine.getMaster), PAUSE ALL
//   (engine.isAway), a hidden or halted page (engine.pageHalted), the switch OFF, and any veto the site adds (the
//   hero's own sound switched off). A refused chime deals no card, so the deck's round is never spent on silence.
// - THE DECK RULE: one createBag over the 50 indices (deck.js indexDeck), seeded fresh per visit: every chime once a
//   round, a fresh order each round, and the first of a round never the last of the one before.
// - LAYERED, NOT ON TOP: the page sound (sfx.js) starts on the next 25 ms flash line of the master grid; the chime
//   starts PAGE_CHIME.offsetMs later on the same grid (two flash lines), just after the page sound's attack. It plays
//   through its own channel at PAGE_CHIME.level and never ducks THE DJ.
// - AT MOST ONE AT A TIME: a newer chime cuts the one still sounding with a PAGE_CHIME.cutFadeS linear fade to 0 at
//   its own start, so rapid page changes never stack. The fade and every cleanup wait run on THE SOUND CLOCK
//   (soundclock.js soundAfter), never a page timer.
// - THE TABLE LOADS ON DEMAND: pagechimes.js is its own chunk; sfxPage's first call (the page load) starts the fetch,
//   so it is usually in hand by the first page change. A change that finds it still loading waits for it, up to
//   PAGE_CHIME.loadWaitMs, and a newer change supersedes the wait.
// - Events: onPageChime() and the window event 'settle:pagechime' carry { played, reason, id, name, family, index,
//   at, cut } (cut: the id of the chime this one cut short).
// </claudes_code_comments>

import * as engine from './engine.js';
import { sound } from './control.js';
import { masterStartTime, masterGrid, masterNow } from './masterbeat.js';
import { indexDeck, freshSeed } from './deck.js';
import { soundAfter } from './soundclock.js';

export const PAGE_CHIME = Object.freeze({
  level: 0.55, // the chime channel's fader (the clicks' and the symphony's)
  offsetMs: 50, // after the page sound: two 25 ms flash lines, just past its attack
  cutFadeS: 0.03, // a newer chime fades the older one out over this
  reverb: 0.1, // a little room
  filter: 9000, // the channel's low-pass
  loadWaitMs: 600, // a change that finds the table still loading waits this long, then lets its chime go
  masterTargetDb: -40, // every chime's peak at the master input, measured in Chromium (pagechimes.js CHIME_TRIM_DB)
});

export const CHIME_KEY = 'settle-hear:pagechimes';

export function readChimesOn(storage) {
  try {
    const v = storage?.getItem?.(CHIME_KEY);
    return v === '0' ? false : true;
  } catch {
    return true;
  }
}

export function writeChimesOn(storage, on) {
  try {
    storage?.setItem?.(CHIME_KEY, on ? '1' : '0');
    return true;
  } catch {
    return false;
  }
}

export function createChimeSwitch({ storage = null } = {}) {
  let on = readChimesOn(storage);
  const subs = new Set();
  return {
    get on() { return on; },
    setOn(v) {
      const x = !!v;
      if (x === on) return;
      on = x;
      writeChimesOn(storage, x);
      for (const fn of [...subs]) { try { fn(on); } catch { /* a listener that fails is left alone */ } }
    },
    toggle() { this.setOn(!on); return on; },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

function sessionOrNull() {
  try { return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null; } catch { return null; }
}
const KEY = Symbol.for('settle-hear.pagechimes');
const g = typeof globalThis !== 'undefined' ? globalThis : {};
export const pageChimes = g[KEY] || (g[KEY] = createChimeSwitch({ storage: sessionOrNull() }));

const vetoes = new Set();
export function addChimeVeto(fn) {
  if (typeof fn !== 'function') return () => {};
  vetoes.add(fn);
  return () => vetoes.delete(fn);
}

let list = null;
let loading = null;
export function loadPageChimes() {
  if (!loading) loading = import('./pagechimes.js').then((m) => { list = m.PAGE_CHIMES; return list; }, () => { loading = null; return null; });
  return loading;
}
export const chimesLoaded = () => !!list;

let seed0 = freshSeed();
let clock = masterNow;
let deck = null;
let deckSize = -1;
let current = null; // { id, out, end }
let channel = null;
let channelFor = null;
let gen = 0;
let shot = 0;
const subs = new Set();

const emit = (detail) => {
  for (const fn of [...subs]) { try { fn(detail); } catch { /* left alone */ } }
  if (typeof window !== 'undefined' && window.dispatchEvent && typeof CustomEvent !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent('settle:pagechime', { detail })); } catch { /* fine */ }
  }
};

export function onPageChime(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function chimeRefusal({ audition = false } = {}) {
  if (!audition && !pageChimes.on) return 'off';
  const E = engine.getEngine();
  if (!E) return 'no-engine';
  if (!sound.unlocked || engine.gestureWaiting()) return 'before-gesture';
  if (sound.muted) return 'muted';
  if (!(engine.getMaster() > 0)) return 'volume-0';
  if (engine.isAway()) return 'paused';
  if (engine.pageHalted()) return 'hidden';
  if (audition) return null;
  for (const v of vetoes) {
    let why = null;
    try { why = v(); } catch { why = null; }
    if (why) return String(why);
  }
  return null;
}

const ensureChannel = (E) => {
  if (channel && channelFor === E) return channel;
  channel = engine.createChannel(E, { demand: false, level: PAGE_CHIME.level, reverb: PAGE_CHIME.reverb, filter: PAGE_CHIME.filter, fadeIn: 0.05 });
  channelFor = E;
  return channel;
};

// a newer chime fades the older one to 0 at its own start, then lets it go
function cutCurrent(ctx, at) {
  const c = current;
  if (!c || c.end <= at) return null;
  try {
    c.out.gain.cancelScheduledValues?.(at);
    c.out.gain.setValueAtTime(c.out.gain.value ?? 1, at);
    c.out.gain.linearRampToValueAtTime(0, at + PAGE_CHIME.cutFadeS);
  } catch { /* an old node that refuses is let go below */ }
  const wait = Math.max(0, (at - ctx.currentTime + PAGE_CHIME.cutFadeS) * 1000) + 50;
  soundAfter(wait, () => { try { c.out.disconnect(); } catch { /* gone */ } });
  current = null;
  return c.id;
}

export function playPageChime({ id, index, reason = 'play', at, audition = false } = {}) {
  const why = chimeRefusal({ audition });
  if (why) { emit({ played: false, reason: why }); return null; }
  if (!list?.length) { emit({ played: false, reason: 'not-loaded' }); return null; }
  if (!deck || deckSize !== list.length) { deck = indexDeck(list.length, { seed: (seed0 ^ 0xc41e) >>> 0 }); deckSize = list.length; }
  let k = Number.isInteger(index) && index >= 0 && index < list.length ? index : id ? list.findIndex((e) => e.id === id) : -1;
  const dealt = k < 0;
  if (dealt) k = deck.next();
  const e = list[k];
  if (!e) return null;
  const E = engine.getEngine();
  const ctx = E.ctx;
  const ch = ensureChannel(E);
  const t = Number.isFinite(at) ? at : masterStartTime(ctx, { lead: 0.005, periodMs: 1000 / masterGrid().flashHz }) + PAGE_CHIME.offsetMs / 1000;
  const cut = cutCurrent(ctx, t);
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(ch.input);
  engine.holdSound?.(e.dur + PAGE_CHIME.offsetMs / 1000 + 0.3); // THE DEMAND: wakes a context that slept for silence
  let end;
  shot += 1;
  try { end = e.render(ctx, t, out, { strength: 1, seed: (seed0 + shot) >>> 0 }); } catch { try { out.disconnect(); } catch { /* gone */ } return null; }
  current = { id: e.id, out, end: Number.isFinite(end) ? end : t + e.dur };
  const mine = current;
  soundAfter((current.end - ctx.currentTime) * 1000 + 400, () => {
    if (current === mine) current = null;
    try { out.disconnect(); } catch { /* gone */ }
  });
  const detail = { played: true, reason, id: e.id, name: e.name, family: e.family, index: k, dealt, at: t, cut };
  emit(detail);
  return detail;
}

// THE TRIGGER: one page change, one chime (sfx.js sfxPage hands every new page key here, never the first load)
export function pageChimeChange({ key = null } = {}) {
  gen += 1;
  const mine = gen;
  const why = chimeRefusal();
  if (why) { emit({ played: false, reason: why, key }); return null; }
  if (list) return playPageChime({ reason: 'page' });
  const asked = clock();
  loadPageChimes().then(() => {
    if (mine !== gen) return; // a newer page change took over
    if (clock() - asked > PAGE_CHIME.loadWaitMs) { emit({ played: false, reason: 'late', key }); return; }
    playPageChime({ reason: 'page' });
  });
  return 'loading';
}

export function resetPageChimes({ seed, now } = {}) {
  seed0 = seed != null ? (Number(seed) >>> 0) || 1 : freshSeed();
  if (now) clock = now;
  deck = null;
  deckSize = -1;
  current = null;
  channel = null;
  channelFor = null;
  gen += 1;
  shot = 0;
}
