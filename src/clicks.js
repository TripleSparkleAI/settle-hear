// settle-hear · clicks - THE CLICK NOISES: 24 short synthesised sounds for a click on a settle (ticks, pops, bells,
// chirps, soft pads), drawn from a seeded bag with no repeats, played through the page's one limiter.
//
// <claudes_code_comments>
// ** Function List **
// CLICK_NOISES                   - the 24 sounds: { name, family, play(ctx, out, t, p) }, p = { strength, pitch }
// CLICK_TONE                     - the floors every click keeps (attack, release, the saw ceiling) and its level
// clickBag(n, seed)              - a seeded no-repeat bag over 0 .. n-1 (never the same index twice in a row)
// playClickNoise(opts)           - play one: { strength, pan, index, at }; null when muted, away, or before a gesture.
//                                  With no index it plays THE CLICK LOCK's sound (clicklock.js)
// armClickNoises({ win, seed, now }) - listen to settle-see's 'settle:ripple' and play a noise for every ripple with
//                                  sound: true; seed reseeds the bag and the lock, now replaces the lock's clock;
//                                  returns off()
// onClickNoise(fn)               - fn({ index, name, family, strength, pan, locked }) after each noise; returns off()
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
// - THE CLICK LOCK (lane CLICKLOCK, clicklock.js): the bag is the cycle and the lock sits on it. The first click
//   takes the bag's next noise and locks it; clicks keep replaying that noise until they stop for a quiet period
//   drawn fresh per lock (uniform 1 to 3 s, seeded); the next click after the quiet advances the bag. The lock reads
//   master time (masterNow) at each click and sets no timer. A muted or away page returns before the lock is read,
//   so a click nobody hears neither takes nor extends it. An explicit index plays that noise and leaves the lock alone.
// </claudes_code_comments>

import * as engine from './engine.js'; // noiseBuffer, createChannel, getEngine, isAway, armUnlock
import { sound } from './control.js';
import { masterStartTime, masterGrid, masterNow } from './masterbeat.js';
import { createClickLock } from './clicklock.js';
import { indexDeck } from './deck.js';

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
let bag = clickBag(CLICK_NOISES.length, BAG_SEED);
const makeLock = (seed, now = masterNow) => createClickLock({ draw: () => bag.next(), seed: (seed ^ 0x5eed) >>> 0, now });
let lock = makeLock(BAG_SEED);
let channel = null;
let channelFor = null;
const subs = new Set();

const ensureChannel = (E) => {
  if (channel && channelFor === E) return channel;
  channel = engine.createChannel(E, { demand: false, level: CLICK_TONE.level, reverb: CLICK_TONE.reverb, filter: 12000, fadeIn: 0.05 });
  channelFor = E;
  return channel;
};

export function playClickNoise({ strength = 0.7, pan = 0, index, at } = {}) {
  const E = engine.getEngine();
  if (!E || !sound.audible || engine.isAway()) return null;
  const explicit = Number.isInteger(index) && index >= 0 && index < CLICK_NOISES.length;
  const held = explicit ? null : lock.take(at);
  const k = explicit ? index : held.value;
  const n = CLICK_NOISES[k];
  const s = Math.min(1, Math.max(0.15, Number.isFinite(strength) ? strength : 0.7));
  const p = Math.max(-1, Math.min(1, Number.isFinite(pan) ? pan : 0));
  const ctx = E.ctx;
  const ch = ensureChannel(E);
  const out = ctx.createGain();
  out.gain.value = 1;
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
  const detail = { index: k, name: n.name, family: n.family, strength: s, pan: p, locked: held ? !held.fresh : false };
  for (const fn of subs) { try { fn(detail); } catch { /* a listener that fails is left alone */ } }
  if (typeof window !== 'undefined' && window.dispatchEvent && typeof CustomEvent !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent('settle:clicknoise', { detail })); } catch { /* fine */ }
  }
  return detail;
}

export function onClickNoise(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function armClickNoises({ win = typeof window !== 'undefined' ? window : null, seed, now } = {}) {
  if (seed != null) bag = clickBag(CLICK_NOISES.length, seed);
  if (seed != null || now) lock = makeLock(seed ?? BAG_SEED, now);
  if (!win?.addEventListener) return () => {};
  engine.armUnlock();
  const onRipple = (ev) => {
    const d = ev?.detail;
    if (!d || !d.sound) return;
    const w = win.innerWidth || 1;
    const x = d.x - (win.scrollX || 0);
    playClickNoise({ strength: d.strength, pan: Math.max(-0.6, Math.min(0.6, (x / w) * 2 - 1)) });
  };
  win.addEventListener('settle:ripple', onRipple);
  return () => win.removeEventListener('settle:ripple', onRipple);
}
