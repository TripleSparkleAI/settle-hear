// settle-hear · house - THE PASSES: 35 named effect passes that carry the old tunes into house music, a seeded bag
// that deals them without repeats, and the chain a few of them make, always ending in a limiter.
//
// <claudes_code_comments>
// ** Function List **
// HOUSE                      - the house set's fixed numbers: tempo, the tune's level, chain size and CPU budget, the
//                              swap rule, the limiter
// PASSES                     - the 35 passes (HOUSEDJ 25, BINAURALMODES 2, HEROSHUFFLE 8): { key, label, family, line (what you hear, in plain sound terms), cost,
//                              params, build(ctx, p, env) }; env.tap(name) is a side bus (engine tapBus): the
//                              vocoder pass reads 'picture', the hero's own static, as its modulator
// PASS_KEYS                  - their keys, in menu order
// passOf(key)                - one pass by key (undefined for an unknown key)
// graph(ctx)                 - a node recorder: gain, filter, osc, delay, shaper, conv, noise, merger; dispose() stops
//                              and disconnects everything it made
// tanhCurve(drive) / crushCurve(bits) / absCurve() - WaveShaper curves: soft clip, stair steps, the absolute value
// createPassBag({ seed, keys }) - the bag: every pass once in a shuffled order, then a fresh shuffle, never the same
//                              pass twice across the boundary; next() deals, peek() looks, putBack(k) returns the last
// fillChain(bag, keep, opts) - keep + passes from the bag until the chain holds `size` passes or the next would break
//                              the budget or repeat; a refused pass goes back to the bag and leads the next chain
// chainCost(keys)            - the chain's CPU units (the sum of its passes' costs)
// houseSwap(d, barsSince)    - when THE DJ's bar decision swaps passes: 'all' (a new theme), 'roll' (the beat or the
//                              split light said yes after at least swapMinBars, or swapMaxBars passed), or null
// progression(root, mode, bar) - the bar's chord: four bars I V vi IV in a major mode, i VI III VII in a minor one
// strike(ctx, out, type, f, t, opts) - one struck voice (an oscillator through an envelope), freed by itself
// buildChain(ctx, keys, opts) - the passes wired in series, then the limiter: { input, output, limiter, keys, cost,
//                              bar(t0, info), dispose(after) }
//
// ** Technical Review **
// - A PASS is an insert: input -> its nodes -> output. The filters, delays, reverbs and grit process what comes in.
//   Seven passes are VOICES (kit, arpeggiator, octave doubler, supersaw pad, sub bass, vinyl and riser, and the
//   sweep-in build's level): they pass the input through and add their own sound, played on the audio clock by
//   bar(t0, info) once a bar, where info = { beatDur, bar, chord (midi notes), root (midi), melody ([{ midi, at,
//   beats }]), heat }. Every pitch comes from midiHz (A = 432 Hz).
// - No per-sample JavaScript. Two passes are approximations because Web Audio has no sample-and-hold without an
//   AudioWorklet: sample-rate reduction is two steep low-passes at the new Nyquist plus a faint crush, and the
//   granular shimmer is two crossfaded delay lines whose delay time falls at one second per second (an octave up by
//   the Doppler rule, the grains windowed by |cos|) into a short plate. Both say so in their lines.
// - THE TWO TASTE PASSES (lane BINAURALMODES, vocoder.js): 'vocoder-static' opens the input's bands with the hero's
//   static (the picture speaks the chord: 6 bands, so a quiet, vowel-like movement, never a robot), and 'ring-shimmer'
//   multiplies the input by a sine an octave above the chord root at a depth that breathes over 20 s. Both are
//   subtle by their default params and both pass the dry sound through.
// - THE CHAIN: the passes in series, then a DynamicsCompressor as a limiter (threshold -16 dB, ratio 20, attack 1 ms)
//   as the chain's LAST node, then the page's own master limiter beyond it (engine.js). Nothing a pass does can clip.
// - THE BAG is THE DECK RULE's one helper (deck.js createBag, settle-see's copy kept byte-identical): a seeded
//   shuffle of every pass, dealt one by one; when it runs out a fresh shuffle starts, and the first of the new one is
//   never the last of the old. A pass the chain refuses (over budget, or already in the chain) is put back and dealt first next time,
//   so the passes are USED in the bag's order: all 25 before any repeats.
// - THE BUDGET: each pass carries a cost in CPU units, about one per live audio node (a convolver counts as 6). A
//   chain holds at most HOUSE.chainMax passes and at most HOUSE.budget units; the measured cost of a full chain in
//   Chromium is in the lane report (runs/housedj).
// - THE DJ SWAPS, never mid-bar: houseSwap reads the bar's decision. A new theme replaces the whole chain; a yes on
//   the beat or the split light, after at least 4 bars with this chain, rolls the oldest two passes out and two new
//   ones in; 16 bars with no swap forces a roll. A swap is a crossfade of one beat from the old chain to the new.
// </claudes_code_comments>

import { noiseBuffer, impulse, getEngine, tapBus } from './engine.js';
import { midiHz, MODES } from './tuning.js';
import { TONE } from './tone.js';
import { createVocoder, createRingMod } from './vocoder.js';
import { createBag } from './deck.js';

export const HOUSE = {
  bpm: [118, 126],
  melodyLevel: 0.2, // the tune sits about 14 dB under the bed: subtle, the groove and the pads carry it
  bedLevel: 1,
  chainSize: 5,
  chainMax: 6,
  budget: 34,
  swapMinBars: 4,
  swapMaxBars: 16,
  swapCount: 2,
  crossfadeBeats: 1,
  limiter: { threshold: -16, knee: 2, ratio: 20, attack: 0.001, release: 0.15 },
  out: 0.7,
};

// ── node recorder ──
export function graph(ctx) {
  const nodes = [];
  const srcs = [];
  const add = (n) => { nodes.push(n); return n; };
  const g = {
    nodes,
    gain(v = 1) { const n = add(ctx.createGain()); n.gain.value = v; return n; },
    filter(type, f, Q = 0.7) { const n = add(ctx.createBiquadFilter()); n.type = type; n.frequency.value = f; n.Q.value = Q; return n; },
    osc(type, f, start = ctx.currentTime) { const n = add(ctx.createOscillator()); n.type = type; n.frequency.value = f; n.start(start); srcs.push(n); return n; },
    delay(max, t) { const n = add(ctx.createDelay(max)); n.delayTime.value = t; return n; },
    shaper(curve, oversample = 'none') { const n = add(ctx.createWaveShaper()); n.curve = curve; n.oversample = oversample; return n; },
    conv(buffer) { const n = add(ctx.createConvolver()); n.buffer = buffer; return n; },
    noise(loop = true) { const n = add(ctx.createBufferSource()); n.buffer = noiseBuffer(ctx); n.loop = loop; n.start(ctx.currentTime); srcs.push(n); return n; },
    merger(k = 2) { return add(ctx.createChannelMerger(k)); },
    panner(pan = 0) { const n = ctx.createStereoPanner ? add(ctx.createStereoPanner()) : add(ctx.createGain()); if (n.pan) n.pan.value = pan; return n; },
    lfo(f, depth, target, type = 'sine') { const o = g.osc(type, f); const d = g.gain(depth); o.connect(d); d.connect(target); return { osc: o, depth: d }; },
    dispose() {
      for (const s of srcs) try { s.stop(); } catch { /* already stopped */ }
      for (const n of nodes) try { n.disconnect(); } catch { /* already gone */ }
    },
  };
  return g;
}

export function tanhCurve(drive = 2, n = 1024) {
  const c = new Float32Array(n);
  const k = Math.tanh(drive);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(drive * x) / k; }
  return c;
}

export function crushCurve(bits = 5, n = 2048) {
  const c = new Float32Array(n);
  const steps = Math.pow(2, Math.max(1, Math.min(12, bits | 0))) / 2;
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.round(x * steps) / steps; }
  return c;
}

export function absCurve(n = 512) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = Math.abs((i / (n - 1)) * 2 - 1);
  return c;
}

const impulses = new WeakMap();
function plateIR(ctx, seconds, decay) {
  let m = impulses.get(ctx);
  if (!m) { m = new Map(); impulses.set(ctx, m); }
  const k = `${seconds}:${decay}`;
  if (!m.has(k)) m.set(k, impulse(ctx, seconds, decay));
  return m.get(k);
}

// a seeded stream (mulberry32), local so a pass's own pattern is stable
function rng(seed = 1) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const expo = (p, v, t) => { try { p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); } catch { p.value = v; } };

// an insert: dry and wet paths summed into one output
function mixed(g, dry, wet) {
  const input = g.gain(1);
  const output = g.gain(1);
  const d = g.gain(dry);
  const w = g.gain(wet);
  input.connect(d);
  d.connect(output);
  w.connect(output);
  return { input, output, wet: w };
}

// a struck voice: an oscillator through an envelope, stopped and freed by itself
export function strike(ctx, out, type, f, t, { peak = 0.3, attack = TONE.attackMin, decay = 0.2, filter = null, glideTo = null, glide = 0.1 } = {}) {
  if (!(f > 15) || f > 16000) return;
  // the tone rules' floors: no attack under 4 ms, no decay under 60 ms, and a raw saw or square passes a low-pass
  attack = Math.max(TONE.attackMin, attack);
  decay = Math.max(TONE.releaseMin, decay);
  if ((type === 'sawtooth' || type === 'square') && !(filter > 0)) filter = TONE.rawCeiling;
  const o = ctx.createOscillator();
  o.type = type;
  at(o.frequency, f, t);
  if (glideTo) expo(o.frequency, glideTo, t + glide);
  const e = ctx.createGain();
  at(e.gain, 0, t);
  lin(e.gain, peak, t + attack);
  expo(e.gain, 0.0005, t + attack + decay);
  let last = o;
  let lp = null;
  if (filter) {
    lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = filter;
    o.connect(lp);
    last = lp;
  }
  last.connect(e);
  e.connect(out);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
  o.onended = () => { for (const n of [o, e, lp]) try { n?.disconnect(); } catch { /* gone */ } };
}

// a burst of noise through a filter
function hiss(ctx, out, t, { type = 'highpass', f = 7000, Q = 0.7, peak = 0.2, decay = 0.05 } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  const fl = ctx.createBiquadFilter();
  fl.type = type;
  fl.frequency.value = f;
  fl.Q.value = Q;
  const e = ctx.createGain();
  at(e.gain, peak, t);
  expo(e.gain, 0.0005, t + decay);
  s.connect(fl);
  fl.connect(e);
  e.connect(out);
  const off = Math.floor((Math.abs(Math.sin(t * 977)) * 1.5) * 1000) / 1000;
  s.start(t, off);
  s.stop(t + decay + 0.05);
  s.onended = () => { for (const n of [s, fl, e]) try { n.disconnect(); } catch { /* gone */ } };
}

const bassOf = (m) => { let x = m; while (midiHz(x) > 80) x -= 12; while (midiHz(x) < 38) x += 12; return x; };

// ── the 27 passes ──
// family: filter · rhythm · voice · time · space · mod · grit
export const PASSES = [
  {
    key: 'lowpass-sweep', label: 'RESONANT LOW-PASS SWEEP', family: 'filter', cost: 2,
    line: 'a resonant low-pass opens over one bar and closes over the next: the top end breathes in and out',
    params: { lo: [320, 'Hz, closed'], hi: [5200, 'Hz, open'], Q: [9, 'resonance'] },
    build(ctx, p) {
      const g = graph(ctx);
      const f = g.filter('lowpass', p.lo, p.Q);
      return { g, input: f, output: f, bar(t0, { beatDur, bar }) { const up = bar % 2 === 0; at(f.frequency, up ? p.lo : p.hi, t0); expo(f.frequency, up ? p.hi : p.lo, t0 + 4 * beatDur); } };
    },
  },
  {
    key: 'highpass-rise', label: 'HIGH-PASS RISE', family: 'filter', cost: 2,
    line: 'a high-pass climbs over four bars and drops back: the low end thins out into a build, then lands',
    params: { lo: [40, 'Hz'], hi: [700, 'Hz at the top of the phrase'], Q: [2, 'resonance'] },
    build(ctx, p) {
      const g = graph(ctx);
      const f = g.filter('highpass', p.lo, p.Q);
      return { g, input: f, output: f, bar(t0, { beatDur, bar }) {
        const k = bar % 4;
        const a = p.lo * Math.pow(p.hi / p.lo, k / 4);
        const b = p.lo * Math.pow(p.hi / p.lo, (k + 1) / 4);
        at(f.frequency, a, t0);
        expo(f.frequency, b, t0 + 4 * beatDur * 0.98);
      } };
    },
  },
  {
    key: 'wah', label: 'BAND-PASS WAH', family: 'filter', cost: 4,
    line: 'a narrow band-pass swings up and down once a beat: the sound says wah on every beat',
    params: { centre: [900, 'Hz'], depth: [600, 'Hz either side'], Q: [5, 'narrowness'], dry: [0.35, 'dry level'] },
    build(ctx, p) {
      const g = graph(ctx);
      const m = mixed(g, p.dry, 0.9);
      const f = g.filter('bandpass', p.centre, p.Q);
      m.input.connect(f);
      f.connect(m.wet);
      const l = g.lfo(2, p.depth, f.frequency);
      return { g, input: m.input, output: m.output, bar(t0, { beatDur }) { at(l.osc.frequency, 1 / beatDur, t0); } };
    },
  },
  {
    key: 'pump', label: 'SIDECHAIN PUMP', family: 'rhythm', cost: 1,
    line: 'everything ducks on each beat and swells back, as if the kick pushed it down: the house pump',
    params: { floor: [0.3, 'level at the beat'], back: [0.55, 'beats to swell back'] },
    build(ctx, p) {
      const g = graph(ctx);
      const v = g.gain(1);
      return { g, input: v, output: v, bar(t0, { beatDur }) {
        for (let b = 0; b < 4; b++) { const t = t0 + b * beatDur; at(v.gain, p.floor, t); lin(v.gain, 1, t + p.back * beatDur); }
      } };
    },
  },
  {
    key: 'kit', label: 'SYNTH KICK AND HATS', family: 'voice', cost: 6,
    line: 'a kick on every beat tuned to the key, closed hats on the off-beats, a clap on two and four',
    params: { kick: [0.75, 'kick level'], hats: [0.14, 'hat level'], clap: [0.16, 'clap level'] },
    build(ctx, p) {
      const g = graph(ctx);
      const v = g.gain(1);
      const drums = g.gain(1);
      drums.connect(v);
      return { g, input: v, output: v, bar(t0, { beatDur, root }) {
        const end = midiHz(bassOf(root ?? 45));
        for (let b = 0; b < 4; b++) {
          const t = t0 + b * beatDur;
          strike(ctx, drums, 'sine', end * 3, t, { peak: p.kick, attack: 0.002, decay: 0.32, glideTo: end, glide: 0.09 });
          hiss(ctx, drums, t + beatDur / 2, { f: 7500, peak: p.hats, decay: 0.045 });
          if (b % 2 === 1) hiss(ctx, drums, t, { type: 'bandpass', f: 1500, Q: 0.8, peak: p.clap, decay: 0.12 });
        }
      } };
    },
  },
  {
    key: 'tape-delay', label: 'TAPE DELAY', family: 'time', cost: 7,
    line: 'echoes a dotted eighth apart that darken and wobble a little as they repeat, like tape',
    params: { beats: [0.75, 'echo spacing in beats'], feedback: [0.42, ''], wet: [0.38, ''], tone: [2500, 'Hz, the loop low-pass'] },
    build(ctx, p) {
      const g = graph(ctx);
      const m = mixed(g, 1, p.wet);
      const d = g.delay(2, 0.36);
      const lp = g.filter('lowpass', p.tone, 0.5);
      const hp = g.filter('highpass', 250, 0.5);
      const fb = g.gain(p.feedback);
      m.input.connect(d);
      d.connect(lp);
      lp.connect(hp);
      hp.connect(fb);
      fb.connect(d);
      hp.connect(m.wet);
      g.lfo(0.5, 0.0015, d.delayTime);
      return { g, input: m.input, output: m.output, bar(t0, { beatDur }) { at(d.delayTime, Math.min(1.9, p.beats * beatDur), t0); } };
    },
  },
  {
    key: 'ping-pong', label: 'PING-PONG DELAY', family: 'time', cost: 7,
    line: 'echoes that bounce left, right, left, half a beat apart',
    params: { beats: [0.5, 'echo spacing in beats'], feedback: [0.45, ''], wet: [0.33, ''] },
    build(ctx, p) {
      const g = graph(ctx);
      const m = mixed(g, 1, p.wet);
      const dl = g.delay(2, 0.25);
      const dr = g.delay(2, 0.25);
      const fb = g.gain(p.feedback);
      const mg = g.merger(2);
      m.input.connect(dl);
      dl.connect(mg, 0, 0);
      dl.connect(dr);
      dr.connect(mg, 0, 1);
      dr.connect(fb);
      fb.connect(dl);
      mg.connect(m.wet);
      return { g, input: m.input, output: m.output, bar(t0, { beatDur }) { const s = Math.min(1.9, p.beats * beatDur); at(dl.delayTime, s, t0); at(dr.delayTime, s, t0); } };
    },
  },
  {
    key: 'plate', label: 'PLATE REVERB', family: 'space', cost: 9,
    line: 'a bright metal-plate room, 1.8 s long, on everything above 250 Hz',
    params: { seconds: [1.8, 'tail'], decay: [2.6, 'how fast it dies'], wet: [0.32, ''] },
    build(ctx, p) {
      const g = graph(ctx);
      const m = mixed(g, 1, p.wet);
      const hp = g.filter('highpass', 250, 0.5);
      const c = g.conv(plateIR(ctx, p.seconds, p.decay));
      m.input.connect(hp);
      hp.connect(c);
      c.connect(m.wet);
      return { g, input: m.input, output: m.output };
    },
  },
  {
    key: 'chorus', label: 'CHORUS', family: 'mod', cost: 8,
    line: 'two copies a few milliseconds late, each drifting slowly: one voice sounds like several',
    params: { wet: [0.4, 'each copy'], depth: [0.003, 's'] },
    build(ctx, p) {
      const g = graph(ctx);
      const m = mixed(g, 0.8, 1);
      for (const [t, r] of [[0.018, 0.31], [0.026, 0.47]]) {
        const d = g.delay(0.1, t);
        const w = g.gain(p.wet);
        m.input.connect(d);
        d.connect(w);
        w.connect(m.wet);
        g.lfo(r, p.depth, d.delayTime);
      }
      return { g, input: m.input, output: m.output };
    },
  },
  {
    key: 'phaser', label: 'PHASER', family: 'mod', cost: 8,
    line: 'four all-pass filters swept slowly: notches glide through the sound, a whoosh',
    params: { centre: [800, 'Hz'], depth: [600, 'Hz'], rate: [0.2, 'Hz'] },
    build(ctx, p) {
      const g = graph(ctx);
      const m = mixed(g, 0.7, 0.7);
      let last = m.input;
      const depth = g.gain(p.depth);
      const o = g.osc('sine', p.rate);
      o.connect(depth);
      for (let k = 0; k < 4; k++) {
        const a = g.filter('allpass', p.centre, 0.6);
        last.connect(a);
        depth.connect(a.frequency);
        last = a;
      }
      last.connect(m.wet);
      return { g, input: m.input, output: m.output };
    },
  },
  {
    key: 'flanger', label: 'FLANGER', family: 'mod', cost: 6,
    line: 'a copy only milliseconds late, fed back and swept: the jet-plane sweep',
    params: { feedback: [0.5, ''], depth: [0.0025, 's'], rate: [0.17, 'Hz'] },
    build(ctx, p) {
      const g = graph(ctx);
      const m = mixed(g, 0.7, 0.6);
      const d = g.delay(0.05, 0.004);
      const fb = g.gain(p.feedback);
      m.input.connect(d);
      d.connect(fb);
      fb.connect(d);
      d.connect(m.wet);
      g.lfo(p.rate, p.depth, d.delayTime);
      return { g, input: m.input, output: m.output };
    },
  },
  {
    key: 'bitcrush', label: 'BITCRUSH', family: 'grit', cost: 4,
    line: 'the wave rounded to 32 steps: a gritty, stepped edge, mixed under the clean sound',
    params: { bits: [5, 'bits (32 steps)'], wet: [0.5, ''] },
    build(ctx, p) {
      const g = graph(ctx);
      const m = mixed(g, 0.6, p.wet);
      const s = g.shaper(crushCurve(p.bits));
      m.input.connect(s);
      s.connect(m.wet);
      return { g, input: m.input, output: m.output };
    },
  },
  {
    key: 'rate-reduce', label: 'SAMPLE-RATE REDUCTION', family: 'grit', cost: 5,
    line: 'a lo-fi top: two steep low-passes at 2.6 kHz and a faint crush. An approximation: true sample-and-hold needs per-sample code',
    params: { nyquist: [2600, 'Hz'], crush: [0.22, 'crush level'] },
    build(ctx, p) {
      const g = graph(ctx);
      const input = g.gain(1);
      const output = g.gain(1);
      const a = g.filter('lowpass', p.nyquist, 0.9);
      const b = g.filter('lowpass', p.nyquist, 0.9);
      const s = g.shaper(crushCurve(6));
      const cw = g.gain(p.crush);
      input.connect(a);
      a.connect(b);
      b.connect(output);
      b.connect(s);
      s.connect(cw);
      cw.connect(output);
      return { g, input, output };
    },
  },
  {
    key: 'ring-mod', label: 'RING MODULATION', family: 'grit', cost: 4,
    line: 'the sound multiplied by a sine two octaves above the chord root: a bell-like, metallic shimmer in the key',
    params: { wet: [0.22, ''], octaves: [2, 'above the root'] },
    build(ctx, p) {
      const g = graph(ctx);
      const m = mixed(g, 0.8, p.wet);
      const ring = g.gain(0);
      const o = g.osc('sine', 432);
      o.connect(ring.gain);
      m.input.connect(ring);
      ring.connect(m.wet);
      return { g, input: m.input, output: m.output, bar(t0, { root }) { at(o.frequency, midiHz((root ?? 57) + 12 * p.octaves), t0); } };
    },
  },
  {
    key: 'trance-gate', label: 'TREMOLO GATE', family: 'rhythm', cost: 1,
    line: 'the sound chopped into sixteenth notes in a fixed rhythm: a trance gate',
    params: { floor: [0.2, 'level when shut'], seed: [7, 'which rhythm'] },
    build(ctx, p) {
      const g = graph(ctx);
      const v = g.gain(1);
      const r = rng(p.seed);
      const pat = Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? 1 : r() < 0.6 ? 1 : 0));
      return { g, input: v, output: v, bar(t0, { beatDur }) {
        const s = beatDur / 4;
        for (let i = 0; i < 16; i++) { const t = t0 + i * s; lin(v.gain, pat[i] ? 1 : p.floor, t + 0.004); at(v.gain, pat[i] ? 1 : p.floor, t + s - 0.004); }
      } };
    },
  },
  {
    key: 'arpeggiator', label: 'ARPEGGIATOR', family: 'voice', cost: 5,
    line: 'the bar\'s chord played as quick sixteenth-note plucks, up and down',
    params: { level: [0.1, ''], octave: [1, 'octaves above the chord'] },
    build(ctx, p) {
      const g = graph(ctx);
      const v = g.gain(1);
      return { g, input: v, output: v, bar(t0, { beatDur, chord }) {
        const c = chord?.length ? chord : [57, 60, 64];
        const notes = [c[0], c[1], c[2], c[0] + 12, c[2], c[1]];
        const s = beatDur / 4;
        for (let i = 0; i < 16; i++) strike(ctx, v, 'triangle', midiHz(notes[i % notes.length] + 12 * p.octave), t0 + i * s, { peak: p.level, attack: 0.003, decay: 0.14, filter: 2400 });
      } };
    },
  },
  {
    key: 'octave-doubler', label: 'OCTAVE DOUBLER', family: 'voice', cost: 3,
    line: 'the tune doubled an octave higher as a soft glassy line, quieter than the tune itself',
    params: { level: [0.06, ''] },
    build(ctx, p) {
      const g = graph(ctx);
      const v = g.gain(1);
      return { g, input: v, output: v, bar(t0, { beatDur, melody }) {
        for (const n of melody ?? []) if (n.midi != null) strike(ctx, v, 'sine', midiHz(n.midi + 12), t0 + n.at * beatDur, { peak: p.level, attack: 0.01, decay: Math.max(0.15, n.beats * beatDur) });
      } };
    },
  },
  {
    key: 'supersaw', label: 'DETUNED SUPERSAW PAD', family: 'voice', cost: 12,
    line: 'the tune\'s chords held by nine slightly detuned saw waves under a soft low-pass: the wide house pad',
    params: { level: [0.05, ''], detune: [14, 'cents either side'], tone: [1800, 'Hz'] },
    build(ctx, p) {
      const g = graph(ctx);
      const v = g.gain(1);
      const lp = g.filter('lowpass', p.tone, 0.7);
      const pad = g.gain(p.level);
      lp.connect(pad);
      pad.connect(v);
      const oscs = [];
      for (let k = 0; k < 3; k++) for (const d of [-p.detune, 0, p.detune]) { const o = g.osc('sawtooth', 216); o.detune.value = d; o.connect(lp); oscs.push([o, k]); }
      return { g, input: v, output: v, bar(t0, { chord, beatDur }) {
        const c = chord?.length ? chord : [57, 60, 64];
        for (const [o, k] of oscs) { at(o.frequency, o.frequency.value, t0); expo(o.frequency, midiHz(c[k] - 12), t0 + 0.08); }
        at(lp.frequency, p.tone * 0.6, t0);
        expo(lp.frequency, Math.min(TONE.rawCeiling, p.tone * 1.4), t0 + 2 * beatDur);
        expo(lp.frequency, p.tone * 0.7, t0 + 4 * beatDur);
      } };
    },
  },
  {
    key: 'sub-bass', label: 'SUB BASS', family: 'voice', cost: 3,
    line: 'a deep sine on the chord root, on the off-beats between the kicks',
    params: { level: [0.35, ''] },
    build(ctx, p) {
      const g = graph(ctx);
      const v = g.gain(1);
      const o = g.osc('sine', 55);
      const e = g.gain(0);
      o.connect(e);
      e.connect(v);
      return { g, input: v, output: v, bar(t0, { beatDur, chord, root }) {
        at(o.frequency, midiHz(bassOf(chord?.[0] ?? root ?? 45)), t0);
        for (let b = 0; b < 4; b++) {
          const t = t0 + b * beatDur + beatDur / 2;
          at(e.gain, 0, t);
          lin(e.gain, p.level, t + 0.01);
          lin(e.gain, 0, t + beatDur * 0.45);
        }
      } };
    },
  },
  {
    key: 'vinyl-riser', label: 'VINYL AND NOISE RISER', family: 'voice', cost: 5,
    line: 'a faint vinyl hiss and crackle, and on the fourth bar of each phrase a noise rise that brightens into the downbeat',
    params: { hiss: [0.012, ''], riser: [0.05, ''] },
    build(ctx, p) {
      const g = graph(ctx);
      const v = g.gain(1);
      const n = g.noise(true);
      const bp = g.filter('bandpass', 3000, 0.6);
      const hv = g.gain(p.hiss);
      n.connect(bp);
      bp.connect(hv);
      hv.connect(v);
      const hp = g.filter('highpass', 400, 1.2);
      const rv = g.gain(0);
      n.connect(hp);
      hp.connect(rv);
      rv.connect(v);
      const r = rng(31);
      return { g, input: v, output: v, bar(t0, { beatDur, bar }) {
        for (let k = 0; k < 5; k++) hiss(ctx, v, t0 + r() * 4 * beatDur, { type: 'highpass', f: 2500, peak: 0.03, decay: 0.004 });
        if (bar % 4 === 3) {
          at(hp.frequency, 400, t0); expo(hp.frequency, 6000, t0 + 4 * beatDur);
          at(rv.gain, 0, t0); lin(rv.gain, p.riser, t0 + 4 * beatDur * 0.97); lin(rv.gain, 0, t0 + 4 * beatDur);
        }
      } };
    },
  },
  {
    key: 'stutter', label: 'STUTTER', family: 'time', cost: 6,
    line: 'on every second bar the last beat repeats a tiny slice of itself, a beat-repeat stutter',
    params: { slice: [0.125, 'beats'], feedback: [0.85, ''] },
    build(ctx, p) {
      const g = graph(ctx);
      const input = g.gain(1);
      const output = g.gain(1);
      const dry = g.gain(1);
      const cap = g.gain(0);
      const d = g.delay(1, 0.06);
      const fb = g.gain(p.feedback);
      const wet = g.gain(0);
      input.connect(dry);
      dry.connect(output);
      input.connect(cap);
      cap.connect(d);
      d.connect(fb);
      fb.connect(d);
      d.connect(wet);
      wet.connect(output);
      return { g, input, output, bar(t0, { beatDur, bar }) {
        at(d.delayTime, p.slice * beatDur, t0);
        if (bar % 2 !== 1) return;
        const t = t0 + 3 * beatDur;
        const sl = p.slice * beatDur;
        at(cap.gain, 1, t); at(cap.gain, 0, t + sl);
        at(dry.gain, 1, t + sl); lin(dry.gain, 0.15, t + sl + 0.01);
        at(wet.gain, 0, t + sl); lin(wet.gain, 0.8, t + sl + 0.01);
        at(dry.gain, 0.15, t + beatDur - 0.01); lin(dry.gain, 1, t + beatDur);
        at(wet.gain, 0.8, t + beatDur - 0.01); lin(wet.gain, 0, t + beatDur);
      } };
    },
  },
  {
    key: 'shimmer', label: 'GRANULAR SHIMMER', family: 'space', cost: 14,
    line: 'grains pitched an octave up and sent into a short room: a halo above the sound. Two crossfaded delay lines, no per-sample code',
    params: { wet: [0.22, ''], grain: [0.1, 's'] },
    build(ctx, p) {
      const g = graph(ctx);
      const m = mixed(g, 1, p.wet);
      const sum = g.gain(1);
      const P = p.grain;
      const t = ctx.currentTime;
      for (let i = 0; i < 2; i++) {
        const st = t + (i * P) / 2;
        const d = g.delay(0.5, P / 2 + 0.005);
        const saw = g.osc('sawtooth', 1 / P, st);
        const dep = g.gain(-P / 2);
        saw.connect(dep);
        dep.connect(d.delayTime);
        const cos = g.osc('sine', 1 / (2 * P), st);
        if (ctx.createPeriodicWave) { try { cos.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([0, 1]), new Float32Array([0, 0]))); } catch { /* sine stays */ } }
        const ab = g.shaper(absCurve());
        const win = g.gain(0);
        cos.connect(ab);
        ab.connect(win.gain);
        m.input.connect(d);
        d.connect(win);
        win.connect(sum);
      }
      const c = g.conv(plateIR(ctx, 1.2, 3));
      sum.connect(c);
      c.connect(m.wet);
      return { g, input: m.input, output: m.output };
    },
  },
  {
    key: 'formant', label: 'FORMANT FILTER', family: 'filter', cost: 5,
    line: 'three narrow bands set to a vowel, a new vowel each beat: the sound seems to sing a, e, i, o, u',
    params: { Q: [8, 'narrowness'], wet: [1.1, ''], dry: [0.3, ''] },
    build(ctx, p) {
      const g = graph(ctx);
      const m = mixed(g, p.dry, p.wet);
      const V = [[730, 1090, 2440], [530, 1840, 2480], [270, 2290, 3010], [570, 840, 2410], [300, 870, 2240]];
      const bands = V[0].map((f) => { const b = g.filter('bandpass', f, p.Q); m.input.connect(b); b.connect(m.wet); return b; });
      let k = 0;
      return { g, input: m.input, output: m.output, bar(t0, { beatDur }) {
        for (let b = 0; b < 4; b++) { const v = V[k++ % V.length]; bands.forEach((band, i) => { at(band.frequency, band.frequency.value, t0 + b * beatDur); expo(band.frequency, v[i], t0 + b * beatDur + 0.08); }); }
      } };
    },
  },
  {
    key: 'soft-clip', label: 'SOFT CLIP SATURATION', family: 'grit', cost: 3,
    line: 'driven into a gentle tanh curve: warmer, thicker, the peaks rounded instead of cut',
    params: { drive: [2.2, ''], trim: [0.6, 'level after'] },
    build(ctx, p) {
      const g = graph(ctx);
      const pre = g.gain(p.drive * 0.5);
      const s = g.shaper(tanhCurve(p.drive), '2x');
      const post = g.gain(p.trim);
      pre.connect(s);
      s.connect(post);
      return { g, input: pre, output: post };
    },
  },
  {
    key: 'vocoder-static', label: 'VOCODER ON THE STATIC', family: 'mod', cost: 16,
    line: 'the picture\'s own static opens the sound\'s bands (a 6-band vocoder): the picture speaks the chord, quietly, under the dry sound',
    params: { wet: [0.35, ''], bands: [6, 'bands, 180 to 4200 Hz'] },
    build(ctx, p, env) {
      const g = graph(ctx);
      const m = mixed(g, 1, 1);
      const voc = createVocoder(ctx, { bands: p.bands, lo: 180, hi: 4200, depth: p.wet });
      // the modulator: the hero's static from the 'picture' tap; with no tap the input modulates itself (a soft
      // spectral smear, still silence-in silence-out)
      const tap = env?.tap?.('picture') ?? null;
      (tap ?? m.input).connect(voc.modulator);
      m.input.connect(voc.carrier);
      voc.output.connect(m.wet);
      g.nodes.push(voc.modulator, voc.carrier, voc.output);
      const dispose = g.dispose.bind(g);
      g.dispose = () => { voc.dispose(); dispose(); };
      return { g, input: m.input, output: m.output, vocoder: voc };
    },
  },
  {
    key: 'ring-shimmer', label: 'RING SHIMMER', family: 'mod', cost: 8,
    line: 'the sound multiplied by a sine an octave above the chord root, at a depth that breathes over twenty seconds: a slow glassy shimmer',
    params: { depth: [0.18, ''], breath: [0.05, 'Hz'] },
    build(ctx, p) {
      const g = graph(ctx);
      const v = g.gain(1);
      const ring = createRingMod(ctx, { rate: 432, depth: p.depth, breath: p.breath });
      v.connect(ring.input);
      g.nodes.push(ring.input, ring.output);
      const dispose = g.dispose.bind(g);
      g.dispose = () => { ring.dispose(); dispose(); };
      return { g, input: v, output: ring.output, ring, bar(t0, { root }) { ring.setRate(midiHz((root ?? 57) + 12)); } };
    },
  },
  {
    key: 'sweep-in', label: 'SWEEP-IN BUILD', family: 'filter', cost: 2,
    line: 'when the chain arrives it starts muffled and half as loud, and opens over four bars into full sound',
    params: { from: [300, 'Hz'], to: [16000, 'Hz'], bars: [4, ''] },
    build(ctx, p) {
      const g = graph(ctx);
      const f = g.filter('lowpass', p.from, 0.9);
      const v = g.gain(0.5);
      f.connect(v);
      let n = 0;
      return { g, input: f, output: v, bar(t0, { beatDur }) {
        if (n >= p.bars) return;
        const a = p.from * Math.pow(p.to / p.from, n / p.bars);
        const b = p.from * Math.pow(p.to / p.from, (n + 1) / p.bars);
        at(f.frequency, a, t0);
        expo(f.frequency, b, t0 + 4 * beatDur);
        at(v.gain, 0.5 + 0.5 * (n / p.bars), t0);
        lin(v.gain, 0.5 + 0.5 * ((n + 1) / p.bars), t0 + 4 * beatDur);
        n += 1;
      } };
    },
  },

  // ── lane HEROSHUFFLE: eight more passes (2026-10-01) ──
  {
    key: 'auto-pan', label: 'AUTO-PAN', family: 'mod', cost: 2,
    line: 'the sound swings from the left ear to the right and back once a bar, then settles in the middle on the downbeat',
    params: { width: [0.7, 'how far it swings, 0 to 1'] },
    build(ctx, p) {
      const g = graph(ctx);
      const pan = g.panner(0);
      return { g, input: pan, output: pan, bar(t0, { beatDur }) {
        if (!pan.pan) return;
        at(pan.pan, 0, t0);
        lin(pan.pan, -p.width, t0 + beatDur);
        lin(pan.pan, p.width, t0 + 3 * beatDur);
        lin(pan.pan, 0, t0 + 4 * beatDur * 0.98);
      } };
    },
  },
  {
    key: 'tilt-eq', label: 'TILT EQ', family: 'filter', cost: 2,
    line: 'a see-saw equaliser: one bar dark (the bass up, the top down), the next bright, tipping back and forth',
    params: { tilt: [6, 'dB at each end'], pivot: [700, 'Hz, the see-saw\'s middle'] },
    build(ctx, p) {
      const g = graph(ctx);
      const lo = g.filter('lowshelf', p.pivot, 0.7);
      const hi = g.filter('highshelf', p.pivot, 0.7);
      lo.connect(hi);
      return { g, input: lo, output: hi, bar(t0, { beatDur, bar }) {
        const s = bar % 2 === 0 ? 1 : -1;
        at(lo.gain, lo.gain.value, t0);
        lin(lo.gain, s * p.tilt, t0 + 4 * beatDur * 0.9);
        at(hi.gain, hi.gain.value, t0);
        lin(hi.gain, -s * p.tilt, t0 + 4 * beatDur * 0.9);
      } };
    },
  },
  {
    key: 'comb', label: 'TUNED COMB', family: 'filter', cost: 3,
    line: 'a very short echo fed back on itself, its length one period of the chord root: the sound rings in the key, metallic',
    params: { feedback: [0.62, ''], wet: [0.35, ''] },
    build(ctx, p) {
      const g = graph(ctx);
      const m = mixed(g, 1, p.wet);
      const d = g.delay(0.1, 1 / 110);
      const fb = g.gain(p.feedback);
      m.input.connect(d);
      d.connect(fb);
      fb.connect(d);
      d.connect(m.wet);
      return { g, input: m.input, output: m.output, bar(t0, { root }) {
        let f = midiHz(root);
        while (f < 80) f *= 2;
        while (f > 400) f /= 2;
        at(d.delayTime, 1 / f, t0);
      } };
    },
  },
  {
    key: 'dub-echo', label: 'DUB ECHO', family: 'time', cost: 7,
    line: 'dotted-eighth echoes through a narrow band, the feedback swelling on the last beat of every fourth bar, then pulled back',
    params: { feedback: [0.5, 'normally'], swell: [0.82, 'on the swell'], wet: [0.3, ''], band: [1200, 'Hz'] },
    build(ctx, p) {
      const g = graph(ctx);
      const m = mixed(g, 1, p.wet);
      const d = g.delay(2, 0.36);
      const bp = g.filter('bandpass', p.band, 1.4);
      const fb = g.gain(p.feedback);
      m.input.connect(d);
      d.connect(bp);
      bp.connect(fb);
      fb.connect(d);
      bp.connect(m.wet);
      return { g, input: m.input, output: m.output, bar(t0, { beatDur, bar }) {
        at(d.delayTime, Math.min(1.9, 0.75 * beatDur), t0);
        if (bar % 4 === 3) {
          at(fb.gain, p.feedback, t0 + 3 * beatDur);
          lin(fb.gain, p.swell, t0 + 3.5 * beatDur);
          lin(fb.gain, p.feedback, t0 + 4 * beatDur * 0.99);
        }
      } };
    },
  },
  {
    key: 'tape-stop', label: 'TAPE STOP', family: 'time', cost: 4,
    line: 'on the last beat of every eighth bar the sound slows and drops in pitch like a tape machine switched off, then starts again on the downbeat',
    params: { depth: [0.24, 's of delay the stop sweeps through'] },
    build(ctx, p) {
      const g = graph(ctx);
      const input = g.gain(1);
      const output = g.gain(1);
      const dry = g.gain(1);
      const wet = g.gain(0);
      const d = g.delay(1, 0.005);
      input.connect(dry);
      dry.connect(output);
      input.connect(d);
      d.connect(wet);
      wet.connect(output);
      return { g, input, output, bar(t0, { beatDur, bar }) {
        if (bar % 8 !== 7) return;
        const t = t0 + 3 * beatDur;
        // a delay line whose delay grows plays its input slower: the pitch falls as the tape stops
        at(d.delayTime, 0.005, t);
        lin(d.delayTime, 0.005 + p.depth, t + beatDur * 0.95);
        at(dry.gain, 1, t); lin(dry.gain, 0, t + 0.02);
        at(wet.gain, 0, t); lin(wet.gain, 1, t + 0.02);
        at(wet.gain, 1, t + beatDur * 0.9); lin(wet.gain, 0, t + beatDur);
        at(dry.gain, 0, t + beatDur * 0.98); lin(dry.gain, 1, t + beatDur);
      } };
    },
  },
  {
    key: 'gated-reverb', label: 'GATED REVERB', family: 'space', cost: 9,
    line: 'a big bright room cut off short a quarter of a beat after every beat: the 1980s drum sound, huge and then gone',
    params: { wet: [0.4, ''], open: [0.25, 'beats the gate stays open'] },
    build(ctx, p) {
      const g = graph(ctx);
      const m = mixed(g, 1, 1);
      const c = g.conv(plateIR(ctx, 1.6, 2));
      const gate = g.gain(0);
      m.input.connect(c);
      c.connect(gate);
      gate.connect(m.wet);
      return { g, input: m.input, output: m.output, bar(t0, { beatDur }) {
        for (let b = 0; b < 4; b++) {
          const t = t0 + b * beatDur;
          at(gate.gain, p.wet, t);
          at(gate.gain, p.wet, t + p.open * beatDur);
          lin(gate.gain, 0, t + p.open * beatDur + 0.015);
        }
      } };
    },
  },
  {
    key: 'isolator-drop', label: 'ISOLATOR DROP', family: 'filter', cost: 3,
    line: 'the DJ mixer\'s bass kill: the low end is taken out for the first bar of every four, and comes back in on the second',
    params: { split: [180, 'Hz, where the bass ends'], depth: [-30, 'dB when killed'] },
    build(ctx, p) {
      const g = graph(ctx);
      const ls = g.filter('lowshelf', p.split, 0.7);
      return { g, input: ls, output: ls, bar(t0, { beatDur, bar }) {
        const k = bar % 4;
        if (k === 0) { at(ls.gain, 0, t0); lin(ls.gain, p.depth, t0 + 0.03); }
        if (k === 1) { at(ls.gain, p.depth, t0); lin(ls.gain, 0, t0 + 0.03); }
        void beatDur;
      } };
    },
  },
  {
    key: 'rotary', label: 'ROTARY SPEAKER', family: 'mod', cost: 6,
    line: 'a spinning-horn speaker: a wobble in pitch, loudness and side that runs fast for four bars and slow for the next four',
    params: { fast: [6.7, 'Hz, the fast spin'], slow: [0.8, 'Hz, the slow spin'], depth: [0.0015, 's of pitch wobble'] },
    build(ctx, p) {
      const g = graph(ctx);
      const d = g.delay(0.05, 0.004);
      const amp = g.gain(0.85);
      const pan = g.panner(0);
      d.connect(amp);
      amp.connect(pan);
      const l1 = g.lfo(p.slow, p.depth, d.delayTime);
      const l2 = g.lfo(p.slow, 0.15, amp.gain);
      const l3 = pan.pan ? g.lfo(p.slow, 0.5, pan.pan) : null;
      return { g, input: d, output: pan, bar(t0, { bar }) {
        const f = Math.floor(bar / 4) % 2 === 0 ? p.slow : p.fast;
        for (const l of [l1, l2, l3]) if (l) { at(l.osc.frequency, l.osc.frequency.value, t0); lin(l.osc.frequency, f, t0 + 1.2); }
      } };
    },
  },
];


export const PASS_KEYS = PASSES.map((p) => p.key);
const BY_KEY = new Map(PASSES.map((p) => [p.key, p]));
export function passOf(key) {
  return BY_KEY.get(key);
}

export function chainCost(keys) {
  return keys.reduce((a, k) => a + (BY_KEY.get(k)?.cost ?? 0), 0);
}

// ── the bag ──
export function createPassBag({ seed = 1, keys = PASS_KEYS } = {}) {
  return createBag(keys, { seed });
}

export function fillChain(bag, keep = [], { size = HOUSE.chainSize, max = HOUSE.chainMax, budget = HOUSE.budget } = {}) {
  const out = keep.slice(0, max);
  const want = Math.min(max, size);
  let guard = 0;
  while (out.length < want && guard++ < 64) {
    const k = bag.next();
    if (out.includes(k) || chainCost([...out, k]) > budget) { bag.putBack(k); break; }
    out.push(k);
  }
  return out;
}

export function houseSwap(d, barsSince, { min = HOUSE.swapMinBars, max = HOUSE.swapMaxBars } = {}) {
  if (!d) return null;
  if (d.themeChanged) return 'all';
  if (barsSince >= max) return 'roll';
  if (barsSince >= min && (d.yes?.beat || d.yes?.split || d.beatChanged)) return 'roll';
  return null;
}

const MINOR = new Set(['aeolian', 'dorian', 'phrygian', 'locrian', 'minor pentatonic']);
export function progression(root = 57, mode = 'ionian', bar = 0) {
  const steps = MODES[mode] && MODES[mode].length === 7 ? MODES[mode] : MINOR.has(mode) ? MODES.aeolian : MODES.ionian;
  const degs = MINOR.has(mode) ? [0, 5, 2, 6] : [0, 4, 5, 3];
  const d = degs[((bar % 4) + 4) % 4];
  const note = (k) => root + steps[k % 7] + 12 * Math.floor(k / 7);
  return [note(d), note(d + 2), note(d + 4)];
}

// ── the chain ──
export function buildChain(ctx, keys, { params = {}, env = null } = {}) {
  const input = ctx.createGain();
  let prev = input;
  const passes = [];
  // the passes' side buses: the page engine's taps when this chain runs on it, else whatever the caller gave
  const E = env ?? (() => { const eng = getEngine(); return eng && eng.ctx === ctx ? { tap: (n) => tapBus(eng, n) } : null; })();
  for (const k of keys) {
    const P = BY_KEY.get(k);
    if (!P) continue;
    const p = Object.fromEntries(Object.entries(P.params).map(([n, [v]]) => [n, params[k]?.[n] ?? v]));
    const inst = P.build(ctx, p, E);
    prev.connect(inst.input);
    prev = inst.output;
    passes.push({ key: k, inst });
  }
  const L = HOUSE.limiter;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = L.threshold;
  limiter.knee.value = L.knee;
  limiter.ratio.value = L.ratio;
  limiter.attack.value = L.attack;
  limiter.release.value = L.release;
  prev.connect(limiter);
  return {
    input,
    output: limiter,
    limiter,
    keys: passes.map((p) => p.key),
    cost: chainCost(passes.map((p) => p.key)),
    nodes: passes.reduce((a, p) => a + p.inst.g.nodes.length, 2),
    bar(t0, info) { for (const { inst } of passes) { try { inst.bar?.(t0, info); } catch { /* a pass that fails stays as it was */ } } },
    dispose() {
      for (const { inst } of passes) inst.g.dispose();
      for (const n of [input, limiter]) try { n.disconnect(); } catch { /* gone */ }
    },
  };
}
