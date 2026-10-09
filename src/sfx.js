// settle-hear · sfx - THE SFX DECKS, PLAYED (lane SWORDSWISH, navigator 2026-10-05: "I want anime sword sounds on page
// load, and sometimes on click in the radial user click"; "put them in rotation on click, and have some on page load,
// and at random when we have random radial events in SETTLE"; "make 50 new other sounds for radial clicks too").
// The playback of the two decks of 50 (sfx-decks.js) and their four triggers.
//
// <claudes_code_comments>
// ** Function List **
// SFX                            - the numbers: the channel level, the shares, the machine rate, the waits and gaps
// shareDeck(hits, of, seed)     - a deck of `of` cards, `hits` of them yes: an exact share at random places
// sfxBag(deck, seed)             - THE DECK RULE over one deck's entries (createBag), rebuilt when the deck grows
// nextSfx(deck)                  - deal the next entry of 'sword' or 'radial'
// playSfx(opts)                  - play one: { deck | id | entry, strength, pan, at, reason, seed }; null when muted,
//                                  paused, hidden, before the engine, or with an empty deck
// createClickCards({ clickCount, seed }) - the click lock's cycle: a share deck (1 sword card to 3 click cards) and,
//                                  for a click card, a deck over the 24 click noises and the 50 radial sounds; next()
//                                  gives a click index (a number) or an sfx entry
// sfxPage({ key, now })          - the page trigger: the first call is the page load (waits up to SFX.loadWaitMs for
//                                  a running context, else lets it go), a later call with a new key is a page change
// armSfx({ win, seed, now })     - listen to settle-see's 'settle:pulse' and play a sword sound on the machine's own
//                                  random waves (from 'sound'), one in SFX.machineShare, never closer than the gap
// onSfx(fn)                      - fn(detail) after each sound; returns off()
// resetSfx({ seed, now })        - fresh decks and clocks (tests)
//
// ** Technical Review **
// - THE DECKS (sfx-decks.js) hold whatever lane files have landed; an empty deck plays nothing and never throws.
// - THE START RULE: nothing is built before the page's AudioContext exists. The page load plays only when the context
//   runs (the browser allowed sound); a refused page waits for a gesture and its load sound is let go, because the
//   gesture itself makes a click noise. A page change, a click or a machine wave plays once the context exists and
//   no gesture is awaited; holdSound() wakes a context that suspended itself for having nothing to hear.
// - MUTE ALL builds nothing (sound.audible). PAUSE ALL (engine.isAway) builds nothing. A hidden tab or a halted page
//   (engine.pageHalted) plays no page or machine sound; a click is a gesture on a visible page, so it only checks
//   PAUSE ALL, exactly as the click noises do.
// - ONE CHANNEL: every sfx plays through one settle-hear channel at the clicks' level (SFX.level = CLICK_TONE.level,
//   a test pins the two), with a little room, under the limiter, and a copy into the engine's 'picture' tap when there
//   is one (the hero input, as the clicks). THE DEMAND: holdSound(dur) per shot, the channel itself holds nothing.
// - ON THE MASTER BEAT: each sound starts on the next 25 ms flash line of the master grid (masterbeat.js).
// - THE CLICK LOCK: clicks.js's lock draws its cycle from createClickCards, so a sword or a radial sound is locked and
//   replayed exactly like a click noise. The share deck makes "about one in four" exact: one sword card per four locks.
// - THE MACHINE'S RANDOM WAVES: settle-see tags every pulse with from: 'user' | 'sound' | 'keys'. A song's pops
//   (from 'sound') are the machine's random radial events; one pop in SFX.machineShare deals a sword card (a 12-card
//   deck with one sword card, THE DECK RULE), and never sooner than SFX.machineGapMs after the last machine sword.
//   At the pops' usual rate of about one a second, that is one quiet sword sound every 12 s or more.
// - Events: the window event 'settle:sfx' and onSfx() carry { deck, id, name, kind, lane, reason, strength, pan }.
// </claudes_code_comments>

import * as engine from './engine.js';
import { sound } from './control.js';
import { masterStartTime, masterGrid, masterNow } from './masterbeat.js';
import { createBag, freshSeed } from './deck.js';
import { sfxDecks, loadSfxModules } from './sfx-decks.js';

export const SFX = Object.freeze({
  level: 0.55, // the channel's fader: the clicks' (CLICK_TONE.level), so a sword and a click sit at one level
  reverb: 0.12, // a little room
  filter: 12000, // the channel's low-pass
  clickShare: Object.freeze([1, 3]), // per lock: 1 sword card to 3 click cards (a click card deals a click noise or a radial sound)
  machineShare: 12, // one machine pop in 12 deals a sword sound
  machineGapMs: 6000, // and never two machine sword sounds closer than this
  loadWaitMs: 1500, // the page load waits this long for a running context, then lets its sound go
  loadDelayMs: 120, // after the context runs, a breath before the load sound
  pageGapMs: 700, // two page changes closer than this play once
  strength: Object.freeze({ load: 0.6, page: 0.5, machine: 0.4 }),
});

let seed0 = freshSeed();
let clock = masterNow;
const bags = new Map(); // deck -> { size, bag }
const subs = new Set();
let channel = null;
let channelFor = null;
let machine = null;
let lastMachine = -Infinity;
let page = { key: undefined, at: -Infinity, loading: false };
let gen = 0; // bumped by resetSfx, so a page load still waiting from before is let go

// a share deck: `of` distinct cards, `hits` of them say yes; each round is a fresh shuffle (THE DECK RULE), so exactly
// hits in every `of` deals, at random places in the round
export function shareDeck(hits, of, seed) {
  const cards = Array.from({ length: Math.max(1, of) }, (_, i) => ({ yes: i < hits, i }));
  const bag = createBag(cards, { seed });
  return { next: () => bag.next().yes };
}

export function sfxBag(deck, seed = seed0) {
  const list = sfxDecks()[deck] ?? [];
  const have = bags.get(deck);
  if (have && have.size === list.length) return have.bag;
  const bag = createBag(list, { seed: (seed ^ (deck === 'sword' ? 0x51d : 0x7ad)) >>> 0 });
  bags.set(deck, { size: list.length, bag });
  return bag;
}

export function nextSfx(deck) {
  const list = sfxDecks()[deck] ?? [];
  return list.length ? sfxBag(deck).next() : null;
}

const ensureChannel = (E) => {
  if (channel && channelFor === E) return channel;
  channel = engine.createChannel(E, { demand: false, level: SFX.level, reverb: SFX.reverb, filter: SFX.filter, fadeIn: 0.05 });
  channelFor = E;
  return channel;
};

const emit = (detail) => {
  for (const fn of subs) { try { fn(detail); } catch { /* a listener that fails is left alone */ } }
  if (typeof window !== 'undefined' && window.dispatchEvent && typeof CustomEvent !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent('settle:sfx', { detail })); } catch { /* fine */ }
  }
};

let shot = 0;
export function playSfx({ deck = 'sword', id, entry, strength = 0.6, pan = 0, at, reason = 'play', seed, page: onPage = false } = {}) {
  const E = engine.getEngine();
  if (!E || !sound.audible || engine.isAway()) return null;
  if (onPage && engine.pageHalted()) return null;
  const e = entry ?? (id ? sfxDecks().all.find((x) => x.id === id) : null) ?? nextSfx(deck);
  if (!e || typeof e.render !== 'function') return null;
  const s = Math.min(1, Math.max(0.15, Number.isFinite(strength) ? strength : 0.6));
  const p = Math.max(-1, Math.min(1, Number.isFinite(pan) ? pan : 0));
  const ctx = E.ctx;
  const ch = ensureChannel(E);
  const out = ctx.createGain();
  out.gain.value = 1;
  let into = ch.input;
  if (ctx.createStereoPanner && p !== 0) {
    const pn = ctx.createStereoPanner();
    pn.pan.value = p;
    pn.connect(ch.input);
    into = pn;
  }
  out.connect(into);
  const tap = E.taps?.get?.('picture') ?? null;
  if (tap) out.connect(tap);
  const dur = Math.min(1.5, Math.max(0.1, Number(e.dur) || 0.6));
  engine.holdSound?.(dur + 0.3); // THE DEMAND: the shot wakes a suspended context for its length
  const t = Number.isFinite(at) ? at : masterStartTime(ctx, { lead: 0.005, periodMs: 1000 / masterGrid().flashHz });
  shot += 1;
  try { e.render(ctx, t, out, { strength: s, seed: Number.isFinite(seed) ? seed : (seed0 + shot * 2654435761) >>> 0 }); } catch { return null; }
  const later = setTimeout(() => { try { out.disconnect(); into !== ch.input && into.disconnect(); } catch { /* gone */ } }, (dur + 1) * 1000);
  later?.unref?.();
  const detail = { deck: e.deck, id: e.id, name: e.name, kind: e.kind, lane: e.lane, reason, strength: s, pan: p };
  emit(detail);
  return detail;
}

export function onSfx(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

// THE CLICK LOCK's cycle (clicks.js): a share deck picks sword or click per lock; a click card deals from one deck
// over the click noises (numbers) and the radial sounds (entries). Both rebuild when a deck grows (node loads late).
export function createClickCards({ clickCount, seed = 1 } = {}) {
  const n = Math.max(0, Math.floor(Number(clickCount) || 0));
  const share = shareDeck(SFX.clickShare[0], SFX.clickShare[0] + SFX.clickShare[1], (seed ^ 0x5a5a) >>> 0);
  let mix = null;
  let mixSize = -1;
  let swords = null;
  let swordSize = -1;
  const cards = () => {
    const radial = sfxDecks().radial;
    if (!mix || mixSize !== radial.length) {
      mix = createBag([...Array.from({ length: n }, (_, i) => i), ...radial], { seed: (seed ^ 0x3c3c) >>> 0 });
      mixSize = radial.length;
    }
    return mix;
  };
  const swordDeck = () => {
    const sword = sfxDecks().sword;
    if (!swords || swordSize !== sword.length) {
      swords = createBag(sword, { seed: (seed ^ 0x1717) >>> 0 });
      swordSize = sword.length;
    }
    return swords;
  };
  return {
    next() {
      if (sfxDecks().sword.length && share.next()) return swordDeck().next();
      const c = cards().next();
      return c === undefined ? -1 : c;
    },
  };
}

// THE PAGE TRIGGER: the first call is the page load, later calls with a new key are page changes
export function sfxPage({ key = null, now = clock } = {}) {
  const t = now();
  if (page.key === undefined) {
    page = { key, at: t, loading: true };
    waitAndPlay(SFX.loadWaitMs, now);
    return 'load';
  }
  if (key === page.key) return null;
  const quick = t - page.at < SFX.pageGapMs;
  page = { ...page, key, at: t };
  if (quick) return null;
  const E = engine.getEngine();
  if (!E || engine.gestureWaiting()) return null; // a refused page: no sound until the visitor's own gesture
  return playSfx({ deck: 'sword', strength: SFX.strength.page, reason: 'page', page: true }) ? 'page' : null;
}

function waitAndPlay(waitMs, now) {
  const start = now();
  const mine = gen;
  const tick = () => {
    if (mine !== gen) return;
    const E = engine.getEngine();
    if (E && E.ctx.state === 'running' && !engine.gestureWaiting()) {
      // the decks are fetched on demand (sfx-decks.js, lane BUNDLESLIM): the load sound waits for them, then plays
      const id = setTimeout(() => {
        if (mine !== gen) return;
        loadSfxModules().then(() => { if (mine !== gen) return; page.loading = false; playSfx({ deck: 'sword', strength: SFX.strength.load, reason: 'load', page: true }); });
      }, SFX.loadDelayMs);
      id?.unref?.();
      return;
    }
    if (now() - start >= waitMs) { page.loading = false; return; }
    const id = setTimeout(tick, 100);
    id?.unref?.();
  };
  tick();
}

export function armSfx({ win = typeof window !== 'undefined' ? window : null, seed, now } = {}) {
  if (seed != null || now) resetSfx({ seed, now });
  if (!win?.addEventListener) return () => {};
  const onPulse = (ev) => {
    const d = ev?.detail;
    if (!d || d.from !== 'sound' || d.reduced) return;
    if (!machine.next()) return;
    const t = clock();
    if (t - lastMachine < SFX.machineGapMs) return;
    const w = win.innerWidth || 1;
    const x = Number.isFinite(d.x) ? d.x : w / 2;
    const r = playSfx({ deck: 'sword', strength: SFX.strength.machine * Math.min(1, Math.max(0.3, d.strength ?? 1)), pan: Math.max(-0.5, Math.min(0.5, (x / w) * 2 - 1)), reason: 'machine', page: true });
    if (r) lastMachine = t;
  };
  win.addEventListener('settle:pulse', onPulse);
  return () => win.removeEventListener('settle:pulse', onPulse);
}

export function resetSfx({ seed, now } = {}) {
  seed0 = seed != null ? (Number(seed) >>> 0) || 1 : freshSeed();
  if (now) clock = now;
  bags.clear();
  machine = shareDeck(1, SFX.machineShare, (seed0 ^ 0xa11) >>> 0);
  lastMachine = -Infinity;
  gen += 1;
  page = { key: undefined, at: -Infinity, loading: false };
}

resetSfx();
