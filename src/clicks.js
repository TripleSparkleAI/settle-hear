// settle-hear · clicks - THE CLICK NOISES: 24 short synthesised sounds for a click on a settle (ticks, pops, bells,
// chirps, soft pads), drawn from a seeded bag with no repeats, played through the page's one limiter.
//
// <claudes_code_comments>
// ** Function List **
// CLICK_NOISES                   - the 24 sounds: { name, family, play(ctx, out, t, p) }, p = { strength, pitch }
// CLICK_TONE                     - the floors every click keeps (attack, release, the saw ceiling) and its level
// clickBag(n, seed)              - a seeded no-repeat bag over 0 .. n-1 (never the same index twice in a row)
// playClickNoise(opts)           - play one: { strength, pan, index, at, raw }; null when muted, away, or before a gesture.
//                                  raw plays the card at its own level, without THE CLICK'S LEVEL (for the level table)
//                                  With no index it plays THE CLICK LOCK's sound (clicklock.js)
// armClickNoises({ win, seed, now }) - listen to settle-see's 'settle:ripple' and play a noise for every ripple with
//                                  sound: true; seed reseeds the bag and the lock, now replaces the lock's clock;
//                                  returns off()
// onClickNoise(fn)               - fn({ index, name, family, strength, pan, locked }) after each noise; returns off()
// DROP                           - THE DROP's numbers: the target peak (-16 dBFS at the speakers), the largest gain a
//                                  card may take (12 dB), the strength the peaks were measured at (0.6)
// DROP_PEAK_DB                   - each click noise's measured peak when a drop plays it at 0.6 (four plays 90 ms apart)
// dropGainDb(k) / DROP_CARDS     - the gain that brings card k to the target; the cards that need 12 dB or less
// playDropNoise(opts)            - one of a dropped box's four noises: { key, part, pan, at, from }; the drop takes
//                                  THE CLICK LOCK once, its four noises are one click noise brought to the target
//                                  peak, an sfx card the lock holds plays once WITH them, never instead, and its first
//                                  noise that plays ducks THE DJ (duck.js duckDrop; from names the wave's family)
// onDropSound(fn)                - fn({ key, part, ok, reason, ... }) for every drop noise played or refused; returns off()
// clickChannel()                 - the clicks' channel, read only (its output is the drop's own sound, for a measurement)
// clickGainDb(k)                 - THE CLICK'S LEVEL: the gain a single click of card k takes (the drop's, capped at 12 dB)
//
// ** Technical Review **
// - THE GESTURE RULE: nothing is built before the page's AudioContext exists (engine.js builds it on the first
//   pointerdown, keydown or touchend, which a click on a settle always is). playClickNoise returns null until then.
// - MUTE ALL: a muted page builds no nodes at all (sound.audible), and the engine's mute gain sits after the clicks
//   anyway. settle-see's ticker halting the pictures (PAUSE ALL, a hidden tab, an away reader) also silences them.
// - THE TONE RULES (BINAURALMODES's TONE_RULES.md): every envelope starts and ends at zero, an attack of at least 4 ms
//   and a release of at least 60 ms; no raw saw or square reaches the output without a low-pass at or below 2.4 kHz;
//   pitched sounds sit on A = 432. Each noise peaks near -24 dBFS before the channel; the shared limiter sits last.
// - THE HERO INPUT: each noise also sends a copy into the engine's 'picture' tap bus when the engine carries one
//   (E.taps, made by engine.tapBus in lane BINAURALMODES), so the audio modes hear the clicks with the picture. settle:clicknoise is a
//   window event with the same detail as onClickNoise, for anything else that listens.
// - ON THE MASTER BEAT: each noise starts on the next 25 ms flash line of the master grid (masterbeat.js), so it is
//   at most one 40 Hz cycle later than the click and shares the light's phase.
// - The bag is THE DECK RULE's one helper (deck.js indexDeck): a seeded Fisher-Yates over all 24, refilled when
//   empty, never starting a pass with the sound the last
//   pass ended on, so no sound plays twice in a row and every one is heard before any repeats.
// - THE SFX CARDS (lane SWORDSWISH, sfx.js createClickCards): the cycle the lock draws from holds the 24 click noises
//   and the radial deck's 50 sounds in one deck, and one lock in four (a 4-card share deck) deals a sword sound
//   instead. An sfx card plays through sfx.js's playSfx (its own channel at the clicks' level) and reports
//   { index: -1, family: 'sfx-<deck>', id, deck }. With no sfx file landed the cycle is the 24 alone, as before.
// - THE CLICK LOCK (lane CLICKLOCK, clicklock.js): the bag is the cycle and the lock sits on it. The first click
//   takes the bag's next noise and locks it; clicks keep replaying that noise until they stop for a quiet period
//   drawn fresh per lock (uniform 1 to 3 s, seeded); the next click after the quiet advances the bag. The lock reads
//   master time (masterNow) at each click and sets no timer. A muted or away page returns before the lock is read,
//   so a click nobody hears neither takes nor extends it. An explicit index plays that noise and leaves the lock alone.
// - THE DROP (lane HERODRAGFIX, navigator 2026-10-06: "the sound on the drop is like chance whether it hits or not").
//   Measured at the speakers (SETTLE/runs/herodragfix/MEASURED.md): a drop's four noises reached a peak of -39 to
//   -18 dBFS by the card the lock dealt, the house DJ plays at a median peak of -21.6 dBFS, so half the cards were
//   under the music, and a sword card replaced the noises. Now a drop is ONE event: its first noise takes the lock
//   once (keyed by the ripple's drag id), its four noises are one click noise from DROP_CARDS, each brought to
//   DROP.targetPeakDb by an output gain (dropGainDb, from DROP_PEAK_DB), and a sword or radial card the lock holds plays
//   once with the first noise. A locked click noise in DROP_CARDS is kept, so a click then a drop share a sound; a
//   quiet one (the ticks, the wood block, the blip, the two chirps) gives way to the drop's own deck (THE DECK RULE).
//   Every drop noise played or refused (MUTE ALL, before the gesture, PAUSE ALL, no engine, THE NOISE GATE's sound:
//   false) is told through onDropSound and the window event 'settle:dragsound'.
// - THE CLICK'S LEVEL (lane HEROPASS, from HERODRAGFIX's suggestion "a click is the same lottery"): a single click of
//   a click noise is brought toward the drop's target peak by the same table (clickGainDb), capped at DROP.maxGainDb,
//   so the quietest cards (the ticks, the wood block, the blip) rise 12 dB and stay under the others rather than
//   vanish. The strength still scales the click, so a soft click stays softer. An sfx card keeps its own level.
// - THE DUCK (lane DROPDUCK, navigator 2026-10-06: "Add the duck."): a drop's FIRST noise that plays calls duck.js
//   duckDrop, so THE DJ's bus dips 3.5 dB for about 300 ms under the drop, once per drop and never per noise. The
//   drop's card keeps its levelled gain; the duck is in addition. A drop the gate, MUTE ALL or PAUSE ALL refused
//   plays nothing and ducks nothing, and a wave of the machine's own families ('sound', 'keys') never ducks. The
//   ripple's family rides in as from; a drop with none is a person's. A single click never ducks.
// </claudes_code_comments>

import * as engine from './engine.js'; // noiseBuffer, createChannel, getEngine, isAway, armUnlock
import { sound } from './control.js';
import { masterStartTime, masterGrid, masterNow } from './masterbeat.js';
import { createClickLock } from './clicklock.js';
import { indexDeck } from './deck.js';
import { createClickCards, playSfx } from './sfx.js';
import { duckDrop } from './duck.js';

export const CLICK_TONE = {
  attackMin: 0.004, // s: a struck sound's shortest attack
  releaseMin: 0.06, // s: the shortest release; a shorter one clicks at the end
  rawCeiling: 2400, // Hz: a square or saw passes a low-pass at or below this first
  peak: 0.11, // the loudest a single noise's envelope reaches (about -19 dB before the channel's level)
  level: 0.55, // the click channel's fader (about -24 dBFS together)
  reverb: 0.16, // a little room on the musical ones
};

const A4 = 432;
const hz = (semis) => A4 * Math.pow(2, semis / 12);

// one gain envelope from zero to peak and back to zero, never faster than the floors
function env(ctx, out, t, { attack = CLICK_TONE.attackMin, peak = CLICK_TONE.peak, hold = 0, release = 0.12 } = {}) {
  const a = Math.max(CLICK_TONE.attackMin, attack);
  const r = Math.max(CLICK_TONE.releaseMin, release);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(Math.max(0, peak), t + a);
  g.gain.setValueAtTime(Math.max(0, peak), t + a + hold);
  g.gain.linearRampToValueAtTime(0, t + a + hold + r);
  g.connect(out);
  return { node: g, end: t + a + hold + r };
}

function tone(ctx, out, t, { type = 'sine', f0, f1, glide = 0.05, ...e }) {
  const E = env(ctx, out, t, e);
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + Math.max(0.01, glide));
  let src = o;
  if (type === 'square' || type === 'sawtooth') {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(CLICK_TONE.rawCeiling, e.cutoff ?? 1800);
    o.connect(lp);
    src = lp;
  }
  src.connect(E.node);
  o.start(t);
  o.stop(E.end + 0.02);
  o.onended = () => { try { o.disconnect(); E.node.disconnect(); } catch { /* gone */ } };
  return E.end;
}

function noise(ctx, out, t, { type = 'bandpass', f = 2000, q = 4, ...e }) {
  const E = env(ctx, out, t, e);
  const s = ctx.createBufferSource();
  s.buffer = engine.noiseBuffer(ctx, 1);
  const bp = ctx.createBiquadFilter();
  bp.type = type;
  bp.frequency.value = f;
  bp.Q.value = q;
  s.connect(bp);
  bp.connect(E.node);
  s.start(t);
  s.stop(E.end + 0.02);
  s.onended = () => { try { s.disconnect(); bp.disconnect(); E.node.disconnect(); } catch { /* gone */ } };
  return E.end;
}

const partials = (ctx, out, t, base, ratios, { peak = CLICK_TONE.peak, release = 0.5, decay = 0.6 } = {}) => {
  ratios.forEach((k, i) => tone(ctx, out, t, { f0: base * k, peak: peak * Math.pow(decay, i), release: release / (1 + 0.6 * i) }));
};

// THE TWENTY-FOUR. family: tick · pop · bell · chirp · pad · wood · drop · glass
export const CLICK_NOISES = [
  { name: 'tick high', family: 'tick', play: (c, o, t, p) => noise(c, o, t, { f: 4200, q: 6, peak: CLICK_TONE.peak * p.strength, release: 0.06 }) },
  { name: 'tick low', family: 'tick', play: (c, o, t, p) => noise(c, o, t, { f: 1600, q: 4, peak: CLICK_TONE.peak * p.strength, release: 0.07 }) },
  { name: 'tick air', family: 'tick', play: (c, o, t, p) => noise(c, o, t, { type: 'highpass', f: 5200, q: 0.7, peak: 0.7 * CLICK_TONE.peak * p.strength, release: 0.08 }) },
  { name: 'pop up', family: 'pop', play: (c, o, t, p) => tone(c, o, t, { f0: 300, f1: 640, glide: 0.04, peak: CLICK_TONE.peak * p.strength, release: 0.08 }) },
  { name: 'pop down', family: 'pop', play: (c, o, t, p) => tone(c, o, t, { f0: 720, f1: 240, glide: 0.06, peak: CLICK_TONE.peak * p.strength, release: 0.09 }) },
  { name: 'pop soft', family: 'pop', play: (c, o, t, p) => tone(c, o, t, { type: 'triangle', f0: hz(-12), f1: hz(-7), glide: 0.03, peak: CLICK_TONE.peak * p.strength, release: 0.1 }) },
  { name: 'drop', family: 'drop', play: (c, o, t, p) => tone(c, o, t, { f0: 1300, f1: 560, glide: 0.07, peak: 0.9 * CLICK_TONE.peak * p.strength, release: 0.1 }) },
  { name: 'bubble', family: 'drop', play: (c, o, t, p) => tone(c, o, t, { f0: 380, f1: 820, glide: 0.11, peak: 0.9 * CLICK_TONE.peak * p.strength, release: 0.12 }) },
  { name: 'bell A', family: 'bell', play: (c, o, t, p) => partials(c, o, t, hz(12), [1, 2.76, 5.4], { peak: 0.8 * CLICK_TONE.peak * p.strength, release: 0.7 }) },
  { name: 'bell E', family: 'bell', play: (c, o, t, p) => partials(c, o, t, hz(7), [1, 2.76, 5.4], { peak: 0.8 * CLICK_TONE.peak * p.strength, release: 0.7 }) },
  { name: 'bell C', family: 'bell', play: (c, o, t, p) => partials(c, o, t, hz(3), [1, 2.4, 4.1], { peak: 0.8 * CLICK_TONE.peak * p.strength, release: 0.6 }) },
  { name: 'glass', family: 'glass', play: (c, o, t, p) => partials(c, o, t, hz(24), [1, 2.32], { peak: 0.55 * CLICK_TONE.peak * p.strength, release: 0.45 }) },
  { name: 'shimmer', family: 'glass', play: (c, o, t, p) => { tone(c, o, t, { f0: hz(19), peak: 0.5 * CLICK_TONE.peak * p.strength, release: 0.5 }); tone(c, o, t, { f0: hz(19) + 6, peak: 0.5 * CLICK_TONE.peak * p.strength, release: 0.5 }); } },
  { name: 'chirp up', family: 'chirp', play: (c, o, t, p) => tone(c, o, t, { f0: 900, f1: 1800, glide: 0.08, peak: 0.75 * CLICK_TONE.peak * p.strength, release: 0.07 }) },
  { name: 'chirp down', family: 'chirp', play: (c, o, t, p) => tone(c, o, t, { f0: 1800, f1: 900, glide: 0.08, peak: 0.75 * CLICK_TONE.peak * p.strength, release: 0.07 }) },
  { name: 'twin chirp', family: 'chirp', play: (c, o, t, p) => { tone(c, o, t, { f0: 1100, f1: 1700, glide: 0.05, peak: 0.6 * CLICK_TONE.peak * p.strength, release: 0.06 }); tone(c, o, t + 0.07, { f0: 1300, f1: 2000, glide: 0.05, peak: 0.6 * CLICK_TONE.peak * p.strength, release: 0.06 }); } },
  { name: 'sparkle', family: 'chirp', play: (c, o, t, p) => [0, 4, 7].forEach((s, i) => tone(c, o, t + i * 0.035, { f0: hz(24 + s), peak: 0.45 * CLICK_TONE.peak * p.strength, release: 0.14 })) },
  { name: 'kalimba', family: 'bell', play: (c, o, t, p) => partials(c, o, t, hz(5), [1, 5.9], { peak: 0.85 * CLICK_TONE.peak * p.strength, release: 0.35, decay: 0.3 }) },
  { name: 'marimba', family: 'wood', play: (c, o, t, p) => partials(c, o, t, A4, [1, 4], { peak: 0.9 * CLICK_TONE.peak * p.strength, release: 0.28, decay: 0.25 }) },
  { name: 'wood block', family: 'wood', play: (c, o, t, p) => { noise(c, o, t, { f: 900, q: 12, peak: 0.9 * CLICK_TONE.peak * p.strength, release: 0.07 }); tone(c, o, t, { f0: 880, peak: 0.4 * CLICK_TONE.peak * p.strength, release: 0.06 }); } },
  { name: 'felt', family: 'wood', play: (c, o, t, p) => { tone(c, o, t, { f0: hz(-19), peak: 0.9 * CLICK_TONE.peak * p.strength, release: 0.2 }); noise(c, o, t, { type: 'lowpass', f: 420, q: 0.7, peak: 0.6 * CLICK_TONE.peak * p.strength, release: 0.1 }); } },
  { name: 'blip', family: 'pop', play: (c, o, t, p) => tone(c, o, t, { type: 'square', f0: hz(12), cutoff: 2000, peak: 0.45 * CLICK_TONE.peak * p.strength, release: 0.07 }) },
  { name: 'pad A', family: 'pad', play: (c, o, t, p) => [0, 4, 7].forEach((s) => tone(c, o, t, { type: 'triangle', f0: hz(s), attack: 0.03, peak: 0.35 * CLICK_TONE.peak * p.strength, release: 0.4 })) },
  { name: 'pad D', family: 'pad', play: (c, o, t, p) => [-7, -3, 0].forEach((s) => tone(c, o, t, { type: 'triangle', f0: hz(s), attack: 0.03, peak: 0.35 * CLICK_TONE.peak * p.strength, release: 0.4 })) },
];

// THE DROP (lane HERODRAGFIX). Each card's peak at the speakers when a drop plays it at strength 0.6, four times 90 ms
// apart, measured in Chromium through the master analyser with nothing else playing (tools/herodragfix_loudness.py
// --cards 0.6 in the site; SETTLE/runs/herodragfix/cards_0.6.json, 2026-10-06). The house DJ's median peak in the
// same measurement is -21.6 dBFS and its median RMS -30.1 dBFS.
export const DROP = Object.freeze({ targetPeakDb: -16, maxGainDb: 12, strength: 0.6, memo: 32 });
export const DROP_PEAK_DB = Object.freeze({
  'tick high': -35.5, 'tick low': -39.2, 'tick air': -28.5, 'pop up': -26.2, 'pop down': -26.5, 'pop soft': -25.3,
  drop: -25.8, bubble: -24.9, 'bell A': -17.9, 'bell E': -18.2, 'bell C': -23.1, glass: -23.8, shimmer: -23.5,
  'chirp up': -28.9, 'chirp down': -28.8, 'twin chirp': -25.6, sparkle: -23.9, kalimba: -22.3, marimba: -23.2,
  'wood block': -33.6, felt: -25.9, blip: -31.8, 'pad A': -24.6, 'pad D': -25.1,
});
export function dropGainDb(k) {
  const n = CLICK_NOISES[k];
  const pk = n ? DROP_PEAK_DB[n.name] : undefined;
  return Number.isFinite(pk) ? DROP.targetPeakDb - pk : Infinity;
}
export const DROP_CARDS = Object.freeze(CLICK_NOISES.map((_, k) => k).filter((k) => dropGainDb(k) <= DROP.maxGainDb));

// THE DECK RULE's one helper (deck.js indexDeck); an empty bag still answers -1
export function clickBag(n, seed = 1) {
  const deck = indexDeck(n, { seed });
  return {
    next() {
      return n > 0 ? deck.next() : -1;
    },
  };
}

const BAG_SEED = 20261001;
// THE CLICK LOCK's cycle (lane SWORDSWISH): the 24 click noises and the 50 radial sounds in one deck, with one lock in
// four dealing a sword sound instead (sfx.js createClickCards); with no sfx deck landed it is the 24 alone
let cards = createClickCards({ clickCount: CLICK_NOISES.length, seed: BAG_SEED });
const makeLock = (seed, now = masterNow) => createClickLock({ draw: () => cards.next(), seed: (seed ^ 0x5eed) >>> 0, now });
let lock = makeLock(BAG_SEED);
let channel = null;
let channelFor = null;
const subs = new Set();
const dropSubs = new Set();
const dropSet = new Set(DROP_CARDS);
let dropDeck = indexDeck(DROP_CARDS.length, { seed: (BAG_SEED ^ 0xd209) >>> 0 });
const drops = new Map(); // drop key -> { index, sfx }: the one choice a drop's four noises share

const ensureChannel = (E) => {
  if (channel && channelFor === E) return channel;
  channel = engine.createChannel(E, { demand: false, level: CLICK_TONE.level, reverb: CLICK_TONE.reverb, filter: 12000, fadeIn: 0.05 });
  channelFor = E;
  return channel;
};

// the clicks' channel, read only: a measurement taps its output (the drop's own sound, lane DJSILENCE); null before
// the first click
export const clickChannel = () => channel;

export function playClickNoise({ strength = 0.7, pan = 0, index, at, raw = false } = {}) {
  const E = engine.getEngine();
  if (!E || !sound.audible || engine.isAway()) return null;
  const explicit = Number.isInteger(index) && index >= 0 && index < CLICK_NOISES.length;
  const held = explicit ? null : lock.take(at);
  const s = Math.min(1, Math.max(0.15, Number.isFinite(strength) ? strength : 0.7));
  const p = Math.max(-1, Math.min(1, Number.isFinite(pan) ? pan : 0));
  // a card from the sfx decks (a sword or a radial sound) plays through sfx.js, under the same lock and the same rules
  if (held && held.value && typeof held.value === 'object') {
    const e = held.value;
    const r = playSfx({ entry: e, strength: s, pan: p, reason: 'click' });
    if (!r) return null;
    const detail = { index: -1, name: e.name, family: `sfx-${e.deck}`, id: e.id, deck: e.deck, strength: s, pan: p, locked: !held.fresh };
    for (const fn of subs) { try { fn(detail); } catch { /* a listener that fails is left alone */ } }
    if (typeof window !== 'undefined' && window.dispatchEvent && typeof CustomEvent !== 'undefined') {
      try { window.dispatchEvent(new CustomEvent('settle:clicknoise', { detail })); } catch { /* fine */ }
    }
    return detail;
  }
  const k = explicit ? index : held.value;
  // THE CLICK'S LEVEL (lane HEROPASS): the same evening-out as the drop, so a click is no longer a lottery of the card
  // the lock dealt; a card the drop leaves out (more than DROP.maxGainDb short) takes the largest gain and no more
  // raw: the card at its own level (the level table's measurement, herodragfix_loudness.py --cards)
  const gainDb = raw ? 0 : clickGainDb(k);
  return playIndex(E, k, { s, p, locked: held ? !held.fresh : false, gain: Math.pow(10, gainDb / 20), extra: { gainDb } });
}

// THE CLICK'S LEVEL (lane HEROPASS): the gain, in dB, a single click of card k takes. The drop's table (DROP_PEAK_DB,
// measured at the speakers) and target, capped at DROP.maxGainDb; 0 for a card the table does not hold
export function clickGainDb(k) {
  const g = dropGainDb(k);
  return Number.isFinite(g) ? Math.min(DROP.maxGainDb, g) : 0;
}

// one click noise k on the clicks' channel; gain multiplies its output (THE DROP's level), extra joins its detail
function playIndex(E, k, { s, p, locked = false, gain = 1, extra = null }) {
  const n = CLICK_NOISES[k];
  if (!n) return null;
  const ctx = E.ctx;
  const ch = ensureChannel(E);
  const out = ctx.createGain();
  out.gain.value = Number.isFinite(gain) && gain > 0 ? gain : 1;
  let into = ch.input;
  if (ctx.createStereoPanner) {
    const pn = ctx.createStereoPanner();
    pn.pan.value = p;
    pn.connect(ch.input);
    into = pn;
  }
  out.connect(into);
  // the hero input: the audio modes hear the clicks too, when the engine carries the 'picture' tap
  const tap = E.taps?.get?.('picture') ?? null;
  if (tap) out.connect(tap);
  // THE MASTER BEAT (masterbeat.js): a click lands on the next 25 ms flash line of the page's one grid (at most one
  // cycle late), so a click noise and the 40 Hz light share a phase
  engine.holdSound?.(1); // THE DEMAND: a click wakes a suspended context for its length (engine.js)
  const t = masterStartTime(ctx, { lead: 0.005, periodMs: 1000 / masterGrid().flashHz });
  try { n.play(ctx, out, t, { strength: s }); } catch { return null; }
  const later = setTimeout(() => { try { out.disconnect(); into !== ch.input && into.disconnect(); } catch { /* gone */ } }, 2000);
  later?.unref?.();
  const detail = { index: k, name: n.name, family: n.family, strength: s, pan: p, locked, ...(extra ?? {}) };
  for (const fn of subs) { try { fn(detail); } catch { /* a listener that fails is left alone */ } }
  if (typeof window !== 'undefined' && window.dispatchEvent && typeof CustomEvent !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent('settle:clicknoise', { detail })); } catch { /* fine */ }
  }
  return detail;
}

function tellDrop(detail) {
  for (const fn of dropSubs) { try { fn(detail); } catch { /* a listener that fails is left alone */ } }
  if (typeof window !== 'undefined' && window.dispatchEvent && typeof CustomEvent !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent('settle:dragsound', { detail })); } catch { /* fine */ }
  }
}

export function onDropSound(fn) {
  dropSubs.add(fn);
  return () => dropSubs.delete(fn);
}

// THE DROP: one of a dropped box's four noises. The first noise of a key takes THE CLICK LOCK once and fixes the card
// all four play; a key with no drag id (an old caller) is a drop of its own each time
export function playDropNoise({ key = null, part = 0, pan = 0, at, from = null } = {}) {
  const E = engine.getEngine();
  const why = !E ? 'no-engine' : !sound.audible ? (sound.muted ? 'muted' : 'before-gesture') : engine.isAway() ? 'paused' : null;
  if (why) {
    tellDrop({ key, part, ok: false, reason: why });
    return null;
  }
  const p = Math.max(-1, Math.min(1, Number.isFinite(pan) ? pan : 0));
  let d = key != null ? drops.get(key) : null;
  const first = !d;
  if (!d) {
    const held = lock.take(at);
    const v = held.value;
    const index = Number.isInteger(v) && dropSet.has(v) ? v : DROP_CARDS[dropDeck.next()];
    d = { index, sfx: v && typeof v === 'object' ? v : null, locked: !held.fresh };
    if (key != null) {
      drops.set(key, d);
      while (drops.size > DROP.memo) drops.delete(drops.keys().next().value);
    }
  }
  let sfxDetail = null;
  // a sword or a radial card the lock holds plays once, WITH the drop's first noise
  if (first && d.sfx) {
    const r = playSfx({ entry: d.sfx, strength: DROP.strength, pan: p, reason: 'drop' });
    if (r) sfxDetail = { sfx: r.name, sfxDeck: r.deck };
  }
  const gain = Math.pow(10, dropGainDb(d.index) / 20);
  const detail = playIndex(E, d.index, { s: DROP.strength, p, locked: d.locked, gain, extra: { drop: true, key, part } });
  // THE DUCK (lane DROPDUCK): the drop's first noise that plays dips THE DJ once; a later noise of the same drop rides
  // inside that dip. An old caller with no key ducks on each call, as each call is a drop of its own
  if (detail && !d.ducked) {
    d.ducked = true;
    duckDrop({ from });
  }
  const waking = E.ctx?.state !== 'running';
  tellDrop(detail
    ? { key, part, ok: true, reason: waking ? 'waking' : null, index: d.index, name: detail.name, gainDb: dropGainDb(d.index), ...(sfxDetail ?? {}) }
    : { key, part, ok: false, reason: 'build-failed', index: d.index });
  return detail;
}

export function onClickNoise(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function armClickNoises({ win = typeof window !== 'undefined' ? window : null, seed, now } = {}) {
  if (seed != null) {
    cards = createClickCards({ clickCount: CLICK_NOISES.length, seed });
    dropDeck = indexDeck(DROP_CARDS.length, { seed: (seed ^ 0xd209) >>> 0 });
    drops.clear();
  }
  if (seed != null || now) lock = makeLock(seed ?? BAG_SEED, now);
  if (!win?.addEventListener) return () => {};
  engine.armUnlock();
  const onRipple = (ev) => {
    const d = ev?.detail;
    if (!d) return;
    const drop = d.kind === 'drop';
    const key = drop && d.drag != null ? `${d.source ?? ''}:${d.drag}` : null;
    if (!d.sound) {
      // THE NOISE GATE held this drop back (settle-see): told, never silent without a word
      if (drop) tellDrop({ key, part: d.part ?? null, ok: false, reason: 'gate' });
      return;
    }
    const w = win.innerWidth || 1;
    const x = d.x - (win.scrollX || 0);
    const pan = Math.max(-0.6, Math.min(0.6, (x / w) * 2 - 1));
    if (drop) playDropNoise({ key, part: d.part ?? 0, pan, from: d.from ?? null });
    else playClickNoise({ strength: d.strength, pan });
  };
  win.addEventListener('settle:ripple', onRipple);
  return () => win.removeEventListener('settle:ripple', onRipple);
}
