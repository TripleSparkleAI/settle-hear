// settle-hear · voice-drum-machines - two drum machines built from oscillators and filtered noise, ten house families of one-bar patterns, and the player that schedules a bar.
//
// <claudes_code_comments>
// ** Function List **
// DRUM_KITS                  - { '808', '909' }: each maps kick, snare, clap, closedHat, openHat, rim, cowbell, ride
//                              to hit(ctx, out, t, { level, tune })
// DRUM_FAMILIES              - the ten house families, in a fixed order
// DRUM_PATTERNS              - one bar per family: { kit, bpm: [lo, hi], swing, steps: { voice: [16 levels 0..1] } }
// playPattern(ctx, out, t0, beatDur, pattern, opts) - one 4/4 bar of 16 steps on the audio clock; returns the number
//                              of hits scheduled
//
// ** Technical Review **
// - Every hit is built from two helpers: tone() (one oscillator, an optional pitch drop, optional filters, one gain
//   envelope) and burst() (the shared white-noise buffer through filters and one gain envelope). Each starts its
//   source at t, stops it after the envelope, and disconnects every node it made in onended. No per-sample code.
// - THE TONE RULES: every envelope rises from 0 over TONE.attackMin (4 ms) and decays over at least TONE.releaseMin
//   (60 ms). A square passes a low-pass at or under TONE.rawCeiling: tone() appends one if the caller gave none.
// - THE KITS: the 808 kick is a long sine falling from about 150 Hz to 50 Hz over 0.5 s; the 909 kick is shorter
//   (about 180 Hz to 55 Hz, 0.28 s) with a short high-passed noise click. `tune` shifts the kick only, in semitones
//   (clamped to +-12). The 909 hats sit higher (high-pass 9 kHz against 7 kHz) and brighter. The 808 cowbell is two
//   squares near 540 and 800 Hz through a band-pass and the raw-ceiling low-pass. A snare is a triangle body plus
//   band-passed noise; a clap is four quick noise bursts 10 ms apart, then a short band-passed tail; a ride is four
//   inharmonic squares through a high-pass and the raw-ceiling low-pass, plus a high noise shimmer.
// - THE PATTERNS are written as 16-character strings ('x' = 1, 'o' = 0.6 ghost, '-' = 0.35 whisper, '.' = 0) and
//   expanded into numbers. chicago is four-on-the-floor with off-beat hats and the clap on steps 4 and 12; garage
//   is a 2-step kick (steps 0 and 10) with swing 0.25; dub-techno is sparse with a rim; ambient is very sparse.
// - playPattern: step = beatDur / 4; an odd step (the second sixteenth of each beat) is delayed by swing x step.
//   Below energy 0.35 only kick and closedHat play, the hat at half level. Every level is scaled by 0.5 + 0.5 x
//   energy. A step of 0 is skipped. Non-finite inputs fall back to defaults so nothing non-finite reaches a param.
// </claudes_code_comments>

import { noiseBuffer } from './engine.js';
import { TONE } from './tone.js';

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const expo = (p, v, t) => { try { p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); } catch { p.value = v; } };
const fin = (x, d) => (Number.isFinite(+x) ? +x : d);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function makeFilters(ctx, specs) {
  return specs.map(([type, f, Q = 0.7]) => {
    const n = ctx.createBiquadFilter();
    n.type = type;
    n.frequency.value = f;
    n.Q.value = Q;
    return n;
  });
}

function envelope(ctx, t, peak, decay) {
  const e = ctx.createGain();
  at(e.gain, 0, t);
  lin(e.gain, peak, t + TONE.attackMin);
  expo(e.gain, 0.0005, t + TONE.attackMin + Math.max(TONE.releaseMin, decay));
  return e;
}

// one oscillator through optional filters and one envelope, freed by itself
function tone(ctx, out, t, { type = 'sine', f, to = null, glide = 0.1, peak = 0.3, decay = 0.2, filters = [] } = {}) {
  if (!(f > 15) || f > 16000 || !(peak > 0)) return 0;
  const specs = filters.slice();
  if ((type === 'sawtooth' || type === 'square') && !specs.some(([k, fr]) => k === 'lowpass' && fr <= TONE.rawCeiling)) {
    specs.push(['lowpass', TONE.rawCeiling]);
  }
  const o = ctx.createOscillator();
  o.type = type;
  at(o.frequency, f, t);
  if (to > 15) expo(o.frequency, to, t + Math.max(TONE.attackMin, glide));
  const fl = makeFilters(ctx, specs);
  const e = envelope(ctx, t, peak, decay);
  let last = o;
  for (const n of fl) { last.connect(n); last = n; }
  last.connect(e);
  e.connect(out);
  o.start(t);
  o.stop(t + TONE.attackMin + Math.max(TONE.releaseMin, decay) + 0.05);
  o.onended = () => { for (const n of [o, ...fl, e]) try { n.disconnect(); } catch { /* gone */ } };
  return 1;
}

// the shared noise buffer through filters and one envelope, freed by itself
function burst(ctx, out, t, { filters = [['highpass', 7000]], peak = 0.2, decay = 0.06 } = {}) {
  if (!(peak > 0)) return 0;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  const fl = makeFilters(ctx, filters);
  const e = envelope(ctx, t, peak, decay);
  let last = s;
  for (const n of fl) { last.connect(n); last = n; }
  last.connect(e);
  e.connect(out);
  const off = Math.floor(Math.abs(Math.sin(t * 977)) * 1000) / 1000;
  s.start(t, off);
  s.stop(t + TONE.attackMin + Math.max(TONE.releaseMin, decay) + 0.05);
  s.onended = () => { for (const n of [s, ...fl, e]) try { n.disconnect(); } catch { /* gone */ } };
  return 1;
}

const lvl = (o) => clamp(fin(o?.level, 1), 0, 2);
const tuneRatio = (o) => Math.pow(2, clamp(fin(o?.tune, 0), -12, 12) / 12);

function kit({ kickHi, kickLo, kickDecay, click, hatHp, hatPeak, snareF, snareBand, snareSnap }) {
  return {
    kick(ctx, out, t, o = {}) {
      const r = tuneRatio(o);
      tone(ctx, out, t, { f: kickHi * r, to: kickLo * r, glide: kickDecay * 0.6, peak: 0.9 * lvl(o), decay: kickDecay });
      if (click) burst(ctx, out, t, { filters: [['highpass', 3000]], peak: 0.25 * lvl(o), decay: 0.06 });
    },
    snare(ctx, out, t, o = {}) {
      tone(ctx, out, t, { type: 'triangle', f: snareF, to: snareF * 0.8, glide: 0.05, peak: 0.35 * lvl(o), decay: 0.12 });
      burst(ctx, out, t, { filters: [['bandpass', snareBand, 0.8], ['highpass', 900]], peak: snareSnap * lvl(o), decay: 0.18 });
    },
    clap(ctx, out, t, o = {}) {
      for (let i = 0; i < 4; i++) burst(ctx, out, t + i * 0.01, { filters: [['bandpass', 1200, 1.2]], peak: 0.3 * lvl(o), decay: 0.06 });
      burst(ctx, out, t + 0.04, { filters: [['bandpass', 1200, 0.9]], peak: 0.22 * lvl(o), decay: 0.16 });
    },
    closedHat(ctx, out, t, o = {}) {
      burst(ctx, out, t, { filters: [['highpass', hatHp], ['peaking', hatHp * 1.2, 1]], peak: hatPeak * lvl(o), decay: 0.06 });
    },
    openHat(ctx, out, t, o = {}) {
      burst(ctx, out, t, { filters: [['highpass', hatHp], ['peaking', hatHp * 1.2, 1]], peak: hatPeak * 0.9 * lvl(o), decay: 0.35 });
    },
    rim(ctx, out, t, o = {}) {
      tone(ctx, out, t, { type: 'triangle', f: 1700, peak: 0.25 * lvl(o), decay: 0.06 });
      burst(ctx, out, t, { filters: [['bandpass', 2600, 4]], peak: 0.15 * lvl(o), decay: 0.06 });
    },
    cowbell(ctx, out, t, o = {}) {
      const filters = [['bandpass', 800, 3], ['lowpass', TONE.rawCeiling]];
      tone(ctx, out, t, { type: 'square', f: 540, peak: 0.12 * lvl(o), decay: 0.35, filters });
      tone(ctx, out, t, { type: 'square', f: 800, peak: 0.12 * lvl(o), decay: 0.35, filters });
    },
    ride(ctx, out, t, o = {}) {
      const filters = [['highpass', 1200], ['lowpass', TONE.rawCeiling]];
      for (const f of [315, 456, 589, 788]) tone(ctx, out, t, { type: 'square', f, peak: 0.04 * lvl(o), decay: 0.9, filters });
      burst(ctx, out, t, { filters: [['highpass', hatHp - 1000]], peak: 0.08 * lvl(o), decay: 1.1 });
    },
  };
}

export const DRUM_KITS = {
  '808': kit({ kickHi: 150, kickLo: 50, kickDecay: 0.5, click: false, hatHp: 7000, hatPeak: 0.16, snareF: 180, snareBand: 1800, snareSnap: 0.22 }),
  '909': kit({ kickHi: 180, kickLo: 55, kickDecay: 0.28, click: true, hatHp: 9000, hatPeak: 0.22, snareF: 200, snareBand: 2600, snareSnap: 0.3 }),
};

export const DRUM_FAMILIES = ['chicago', 'deep', 'acid', 'garage', 'progressive', 'tech', 'filter-house', 'ambient', 'dub-techno', 'balearic'];

const V = { x: 1, o: 0.6, '-': 0.35, '.': 0 };
const row = (s) => Array.from(s, (c) => V[c] ?? 0);
const bar = (o) => Object.fromEntries(Object.entries(o).map(([k, s]) => [k, row(s)]));

export const DRUM_PATTERNS = {
  chicago: { kit: '909', bpm: [120, 126], swing: 0.1, steps: bar({
    kick: 'x...x...x...x...', closedHat: '..x...x...x...x.', clap: '....x.......x...', openHat: '..............o.' }) },
  deep: { kit: '808', bpm: [118, 124], swing: 0.15, steps: bar({
    kick: 'x...x...x...x...', closedHat: '..o...o...o...o.', clap: '....o.......o...', rim: '...-......-.....' }) },
  acid: { kit: '909', bpm: [122, 130], swing: 0.05, steps: bar({
    kick: 'x...x...x...x...', closedHat: 'oxoxoxoxoxoxoxox', clap: '....x.......x...', openHat: '..o...o...o...o.' }) },
  garage: { kit: '909', bpm: [128, 134], swing: 0.25, steps: bar({
    kick: 'x.........x.....', snare: '....x.......x...', closedHat: '..x.o.x...x.o.x.', rim: '.......o......o.' }) },
  progressive: { kit: '909', bpm: [124, 130], swing: 0, steps: bar({
    kick: 'x...x...x...x...', closedHat: '..x...x...x...x.', openHat: '..o.......o.....', ride: 'o...o...o...o...', clap: '....o.......o...' }) },
  tech: { kit: '909', bpm: [125, 132], swing: 0.05, steps: bar({
    kick: 'x...x...x...x...', closedHat: 'oooooooooooooooo', rim: '...o..o....o..o.', cowbell: '..........-.....' }) },
  'filter-house': { kit: '909', bpm: [120, 126], swing: 0.12, steps: bar({
    kick: 'x...x...x...x...', clap: '....x.......x...', closedHat: '..x...x...x...x.', openHat: '......o.......o.' }) },
  ambient: { kit: '808', bpm: [110, 118], swing: 0.1, steps: bar({
    kick: 'o.........-.....', closedHat: '......-.......-.', ride: '........-.......' }) },
  'dub-techno': { kit: '808', bpm: [116, 124], swing: 0.08, steps: bar({
    kick: 'o...o...o...o...', rim: '.......o.....-..', closedHat: '..-.......-.....' }) },
  balearic: { kit: '808', bpm: [112, 120], swing: 0.15, steps: bar({
    kick: 'x...x...x...x...', closedHat: '-.o.-.o.-.o.-.o.', clap: '....o.......o...', cowbell: '.......-.....-..', rim: '..-.......-.....' }) },
};

export function playPattern(ctx, out, t0, beatDur, pattern, { energy = 1, kitOverride = null, tune = 0 } = {}) {
  if (!pattern || !pattern.steps) return 0;
  const kitObj = DRUM_KITS[kitOverride ?? pattern.kit] ?? DRUM_KITS['909'];
  const e = clamp(fin(energy, 1), 0, 1);
  const bd = fin(beatDur, 0.5) > 0 ? fin(beatDur, 0.5) : 0.5;
  const start = fin(t0, ctx.currentTime);
  const step = bd / 4;
  const swing = clamp(fin(pattern.swing, 0), 0, 0.3);
  const scale = 0.5 + 0.5 * e;
  const low = e < 0.35;
  let n = 0;
  for (const [voice, list] of Object.entries(pattern.steps)) {
    const hit = kitObj[voice];
    if (typeof hit !== 'function' || !Array.isArray(list)) continue;
    if (low && voice !== 'kick' && voice !== 'closedHat') continue;
    for (let i = 0; i < 16; i++) {
      const v = clamp(fin(list[i], 0), 0, 1);
      if (!(v > 0)) continue;
      const level = v * scale * (low && voice === 'closedHat' ? 0.5 : 1);
      const t = start + i * step + (i % 2 === 1 ? swing * step : 0);
      hit(ctx, out, t, { level, tune });
      n++;
    }
  }
  return n;
}
