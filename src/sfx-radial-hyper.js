// settle-hear · sfx-radial-hyper - THE RADIAL DECK, HYPER HALF: 25 short, heavily distorted radial-click sounds
// (bitcrush, wavefold, glitch stutter, granular smear, ring mod, and the anime swish run through distortion), made
// procedurally in WebAudio, at a subtle level. Lane HYPERRADIAL (ANIMESFX, 2026-10-05).
//
// <claudes_code_comments>
// ** Function List **
// RADIAL_HYPER                   - the 25 entries { id, name, kind, deck, lane, dur, provenance, render }
// HYPER_TONE                     - this file's floors: attack, release, the final low-pass, the strength range
// render(ctx, at, dest, opts)    - (per entry) schedule the sound at `at` into `dest`; returns the end time
// rng(seed)                      - mulberry32, the only source of variation (never Math.random)
// noiseArr / toneArr / swishArr  - JS-computed source signals (seeded noise, a gliding tone, a band-swept noise swish)
// crush(x, bits, holdHz, sr)     - bitcrush in JS: sample-and-hold decimation, then amplitude quantising
// foldCurve / clipCurve / tanhCurve / stepCurve - WaveShaper curves (wavefold, hard clip, soft drive, bit steps)
// voice(ctx, at, dest, o)        - the shared output chain: final low-pass -> stereo pan (with a pan sweep) -> the
//                                  envelope gain -> dest; returns { input, end, own } so a sound connects into it
// play(ctx, buf, at, into, o)    - a buffer source that cleans its chain up when it ends
//
// ** Technical Review **
// - THE FORMAT is the one SWORDSWISH ruled in SETTLE/runs/animesfx/CHANNEL.md: one frozen array of 25, `render(ctx,
//   at, dest, opts)` with opts { strength = 1 (clamped 0.15..1), seed = 1 }, the end time returned, every node built
//   from `ctx` and disconnected when the sound's last source ends. Nothing here imports the engine or touches a
//   channel, the limiter, the master or the window: the wiring owns those.
// - THE NODE SUBSET (ANIMEHIT's tests/offline.mjs): gain, oscillator, biquad, waveshaper, buffer source, createBuffer,
//   delay, stereo panner. Everything sample-level (decimation, grains' source material, sample-and-hold pitch) is
//   computed in JS into a createBuffer of at most 1 s, from a seeded generator, so the same seed renders the same
//   samples in Chromium and in the node renderer.
// - THE TONE RULES (clicks.js plus the ANIMESFX ruling): every sound ends in ONE envelope gain that starts and ends at
//   zero, attack >= 4 ms, release >= 60 ms; any shaper or crusher is followed by a final low-pass at or below 9 kHz
//   (voice() always inserts it; `lp` per sound is capped at HYPER_TONE.finalLp); raw saw or square goes through a
//   2.4 kHz low-pass first. Inner gates (the stutters) ramp over 2 ms so a gate never clicks.
// - LEVEL: `lvl` per entry is the envelope peak before strength, set by measurement (tools/sfx_levels.py, Chromium's
//   OfflineAudioContext) so each sound's loudest 50 ms RMS sits near the click noises' median (-26.4 dBFS) and its peak
//   under the loudest click (-15.4 dBFS), with a little spread so the deck is not flat. Distortion makes a sound dense,
//   so these peaks sit lower than a clean tone's would for the same loudness.
// - VARIATION: the seed moves pitch by up to about +-3 percent, the pan side, grain and glitch positions. The same seed
//   gives the same sound; the wiring passes a fresh seed per play.
// </claudes_code_comments>

export const HYPER_TONE = Object.freeze({
  attackMin: 0.004, // s
  releaseMin: 0.06, // s
  finalLp: 9000, // Hz: the last filter after any shaper or crusher
  tail: 0.012, // s: the linear step from 1 percent to 0 after the exponential release
  rawCeiling: 2400, // Hz: a square or saw is low-passed at or below this before anything else
  strengthMin: 0.15,
  strengthMax: 1,
});

const MADE = '2026-10-05';
const SR_OF = (ctx) => ctx.sampleRate || 48000;

export function rng(seed = 1) {
  let a = (Number.isFinite(seed) ? Math.floor(seed) : 1) >>> 0;
  a = (a ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const strengthOf = (o) => clamp(Number.isFinite(o?.strength) ? o.strength : 1, HYPER_TONE.strengthMin, HYPER_TONE.strengthMax);
const jitter = (r, amt) => 1 + (r() * 2 - 1) * amt;

// ---- JS-computed source material ------------------------------------------------------------------------------

export function noiseArr(n, r) {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = r() * 2 - 1;
  return x;
}

// a phase-accumulated tone gliding exponentially from f0 to f1 over its length; shape 'sine' | 'tri' | 'pulse'
export function toneArr(n, sr, f0, f1, shape = 'sine') {
  const x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const f = f0 * Math.pow(f1 / f0, i / Math.max(1, n - 1));
    ph += f / sr;
    ph -= Math.floor(ph);
    if (shape === 'tri') x[i] = 1 - 4 * Math.abs(ph - 0.5);
    else if (shape === 'pulse') x[i] = Math.tanh(4 * Math.sin(2 * Math.PI * ph)); // a soft pulse, not a raw square
    else x[i] = Math.sin(2 * Math.PI * ph);
  }
  return x;
}

// a band-swept noise swish: a two-pole resonator whose centre glides from fa to fb, with a bell envelope (the anime
// swing: air that rises and falls as the blade passes)
export function swishArr(n, sr, fa, fb, q, r, { skew = 0.45 } = {}) {
  const x = new Float32Array(n);
  let y1 = 0; let y2 = 0;
  const peakAt = Math.max(1, Math.floor(n * skew));
  for (let i = 0; i < n; i++) {
    const f = fa * Math.pow(fb / fa, i / Math.max(1, n - 1));
    const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr;
    const rad = Math.exp(-w / (2 * q));
    const a1 = 2 * rad * Math.cos(w);
    const a2 = -rad * rad;
    const y = (1 - rad) * (r() * 2 - 1) + a1 * y1 + a2 * y2;
    y2 = y1; y1 = y;
    const e = i < peakAt ? i / peakAt : (n - i) / (n - peakAt);
    x[i] = y * e * e;
  }
  return normalise(x);
}

function normalise(x, to = 0.9) {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= to / m;
  return x;
}

// THE TAIL FADE, applied after any crush: the last FADE_S of the content (up to its last non-zero sample) is shaped by
// a curve that falls like an exponential and reaches exactly 0, so a quantised tail can no longer drop to silence in
// one step. A later fade cannot add a click, because it only ever scales samples down.
const FADE_S = 0.05;
export function fadeTail(x, sr, seconds = FADE_S) {
  let last = x.length - 1;
  while (last > 0 && x[last] === 0) last--;
  const m = Math.max(1, Math.round(seconds * sr));
  const k = 5;
  const z = Math.exp(-k);
  for (let i = Math.max(0, last - m + 1); i <= last; i++) {
    const u = (i - (last - m + 1)) / m; // 0 .. just under 1
    x[i] *= (Math.exp(-k * u) - z) / (1 - z);
  }
  for (let i = last + 1; i < x.length; i++) x[i] = 0;
  return x;
}

// bitcrush: hold each sample for sr/holdHz frames (sample-rate reduction), then quantise to `bits`
export function crush(x, bits, holdHz, sr) {
  const y = new Float32Array(x.length);
  const step = Math.max(1, sr / Math.max(1, holdHz));
  const lv = Math.pow(2, Math.max(1, bits) - 1);
  let acc = step - 1; let held = 0; // the first sample is taken, then each is held for `step` frames
  for (let i = 0; i < x.length; i++) {
    acc += 1;
    if (acc >= step) { acc -= step; held = Math.round(clamp(x[i], -1, 1) * lv) / lv; }
    y[i] = held;
  }
  return y;
}

// ---- WaveShaper curves ----------------------------------------------------------------------------------------

const CURVE_N = 2049;
export function foldCurve(depth = 3) {
  const c = new Float32Array(CURVE_N);
  for (let i = 0; i < CURVE_N; i++) { const v = (i / (CURVE_N - 1)) * 2 - 1; c[i] = Math.sin(v * depth * Math.PI * 0.5); }
  return c;
}
export function clipCurve(at = 0.35) {
  const c = new Float32Array(CURVE_N);
  for (let i = 0; i < CURVE_N; i++) { const v = (i / (CURVE_N - 1)) * 2 - 1; c[i] = clamp(v / at, -1, 1); }
  return c;
}
export function tanhCurve(drive = 4) {
  const c = new Float32Array(CURVE_N);
  const n = Math.tanh(drive);
  for (let i = 0; i < CURVE_N; i++) { const v = (i / (CURVE_N - 1)) * 2 - 1; c[i] = Math.tanh(v * drive) / n; }
  return c;
}
export function stepCurve(bits = 3) {
  const c = new Float32Array(CURVE_N);
  const lv = Math.pow(2, bits - 1);
  for (let i = 0; i < CURVE_N; i++) { const v = (i / (CURVE_N - 1)) * 2 - 1; c[i] = Math.round(v * lv) / lv; }
  return c;
}

// ---- the shared output chain ----------------------------------------------------------------------------------

function buffer(ctx, data) {
  const b = ctx.createBuffer(1, data.length, SR_OF(ctx));
  b.getChannelData(0).set(data);
  return b;
}

// final low-pass -> stereo pan (optionally swept) -> envelope gain -> dest. `own` collects every node made for this
// sound, so the last source's onended disconnects them all.
function voice(ctx, at, dest, { lp = 7000, q = 0.7, pan = 0, pan1, attack = 0.005, hold = 0, release = 0.12, peak, len }) {
  const own = [];
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = Math.min(HYPER_TONE.finalLp, lp);
  f.Q.value = q;
  own.push(f);
  let tail = f;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(clamp(pan, -1, 1), at);
    if (Number.isFinite(pan1)) p.pan.linearRampToValueAtTime(clamp(pan1, -1, 1), at + Math.max(0.02, len ?? attack + hold + release));
    f.connect(p);
    own.push(p);
    tail = p;
  }
  const g = ctx.createGain();
  const a = Math.max(HYPER_TONE.attackMin, attack);
  const r = Math.max(HYPER_TONE.releaseMin, release);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + a);
  g.gain.setValueAtTime(peak, at + a + hold);
  // THE END: an exponential fall to 1 percent over the release, then a short linear step to 0, so the last audible
  // 5 ms is never followed by a sudden silence (a linear fall to 0 cuts at its last window)
  g.gain.exponentialRampToValueAtTime(Math.max(1e-6, peak * 0.01), at + a + hold + r);
  g.gain.linearRampToValueAtTime(0, at + a + hold + r + HYPER_TONE.tail);
  tail.connect(g);
  g.connect(dest);
  own.push(g);
  return { input: f, end: at + a + hold + r + HYPER_TONE.tail, own };
}

function cleanup(src, own) {
  src.onended = () => { for (const n of own) { try { n.disconnect(); } catch { /* gone */ } } };
}

// one buffer source into `into`, stopped at `stopAt`; registered in own
function play(ctx, buf, at, into, own, { rate = 1, offset = 0, dur, stopAt } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.playbackRate.value = rate;
  s.connect(into);
  if (Number.isFinite(dur)) s.start(at, offset, dur); else s.start(at, offset);
  if (Number.isFinite(stopAt)) s.stop(stopAt);
  own.push(s);
  return s;
}

function shaper(ctx, curve, own, oversample = '2x') {
  const w = ctx.createWaveShaper();
  w.curve = curve;
  w.oversample = oversample;
  own.push(w);
  return w;
}

function filt(ctx, type, f, q, own) {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  own.push(b);
  return b;
}

function gainNode(ctx, v, own) {
  const g = ctx.createGain();
  g.gain.value = v;
  own.push(g);
  return g;
}

function osc(ctx, type, f, own) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  own.push(o);
  return o;
}

// a buffer-backed sound: build the samples in JS (fn gets n, sr, r), then play them through voice()
function bufferSound(ctx, at, dest, opts, { len, lvl, build, voiceOpts = {}, rate = 1 }) {
  const r = rng(opts?.seed ?? 1);
  const sr = SR_OF(ctx);
  const n = Math.max(16, Math.round(len * sr));
  // a crusher can round a sample up to full scale (normalise pins every peak), and it turns a decaying tail into a
  // step to exact 0; fadeTail, applied AFTER the crush, makes the content reach 0 smoothly
  const data = fadeTail(normalise(build(n, sr, r)), sr);
  const V = voice(ctx, at, dest, { peak: lvl * strengthOf(opts), len, ...voiceOpts(r) });
  const s = play(ctx, buffer(ctx, data), at, V.input, V.own, { rate, stopAt: V.end + 0.02 });
  cleanup(s, V.own);
  return V.end;
}

// ---- the 25 -----------------------------------------------------------------------------------------------------

const entry = (id, name, kind, dur, recipe, render) => Object.freeze({
  id, name, kind, deck: 'radial', lane: 'HYPERRADIAL', dur,
  provenance: Object.freeze({ method: 'procedural', made: MADE, recipe }),
  render,
});

const side = (r) => (r() < 0.5 ? -1 : 1);

export const RADIAL_HYPER = Object.freeze([
  // 1 · the anime swish, decimated and crushed, rising and sweeping left to right
  entry('hyper-crushed-swish-rise-gated', 'crushed swish, rising, gated', 'bitcrush', 0.24,
    'a band-swept noise swish 1500 to 5200 Hz peaking late, sample-and-hold to 9 kHz and 4 bits in JS, then chopped into four 40 ms pulses that each strike and decay (5 ms time constant), low-passed at 8 kHz, panned left to right',
    (ctx, at, dest, o) => bufferSound(ctx, at, dest, o, {
      len: 0.16, lvl: 0.17,
      build: (n, sr, r) => {
        // crush first, then gate: a pulse that decays after the crusher fades smoothly instead of stepping to 0
        const x = crush(swishArr(n, sr, 1500 * jitter(r, 0.03), 5200, 3, r, { skew: 0.8 }), 4, 9000, sr);
        const per = Math.round(0.04 * sr); const ramp = 0.002 * sr; const tau = 0.005 * sr;
        for (let i = 0; i < n; i++) { const k = i % per; x[i] *= k < ramp ? k / ramp : Math.exp(-(k - ramp) / tau); }
        return x;
      },
      voiceOpts: (r) => { const s = side(r); return { lp: 8000, pan: -0.6 * s, pan1: 0.6 * s, release: 0.06, hold: 0.1 }; },
    })),

  // 2 · a lower, longer swish falling, crushed harder (3 bits), right to left
  entry('hyper-crushed-swish-fall', 'crushed swish, falling', 'bitcrush', 0.36,
    'a band-swept noise swish 3000 down to 420 Hz peaking early, sample-and-hold to 3.6 kHz and 3 bits in JS, low-passed at 5 kHz, panned right to left',
    (ctx, at, dest, o) => bufferSound(ctx, at, dest, o, {
      len: 0.26, lvl: 0.11,
      build: (n, sr, r) => crush(swishArr(n, sr, 3000 * jitter(r, 0.03), 420, 2.4, r, { skew: 0.1 }), 3, 3600, sr),
      voiceOpts: (r) => { const s = side(r); return { lp: 5000, pan: 0.55 * s, pan1: -0.55 * s, release: 0.08, hold: 0.18 }; },
    })),

  // 3 · a sine zap wavefolded deeper and deeper as it rises
  entry('hyper-fold-zap-rising-depth', 'folded zap, folding deeper', 'fold', 0.2,
    'a sine gliding 170 to 760 Hz into a sine wavefolder whose drive ramps 0.4 to 2.6, low-passed at 6.5 kHz',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const V = voice(ctx, at, dest, { peak: 0.07 * strengthOf(o), lp: 6500, pan: (r() - 0.5) * 0.4, attack: 0.006, hold: 0.07, release: 0.12 });
      const s = osc(ctx, 'sine', 170 * jitter(r, 0.03), V.own);
      s.frequency.exponentialRampToValueAtTime(760, at + 0.16);
      const drive = gainNode(ctx, 0.4, V.own);
      drive.gain.setValueAtTime(0.4, at);
      drive.gain.linearRampToValueAtTime(2.6, at + 0.15);
      s.connect(drive);
      drive.connect(shaper(ctx, foldCurve(4), V.own)).connect(V.input);
      s.start(at); s.stop(V.end + 0.02);
      cleanup(s, V.own);
      return V.end;
    }),

  // 4 · a triangle that drops in pitch while its fold relaxes from gnarly to plain
  entry('hyper-fold-drop-relaxing', 'folded drop, relaxing', 'fold', 0.3,
    'a triangle dropping 820 to 95 Hz through a wavefolder whose drive falls 3.2 to 0.5, low-passed at 4.5 kHz',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const V = voice(ctx, at, dest, { peak: 0.075 * strengthOf(o), lp: 4500, pan: (r() - 0.5) * 0.5, attack: 0.004, hold: 0.06, release: 0.22 });
      const s = osc(ctx, 'triangle', 820 * jitter(r, 0.03), V.own);
      s.frequency.exponentialRampToValueAtTime(95, at + 0.26);
      const drive = gainNode(ctx, 3.2, V.own);
      drive.gain.setValueAtTime(3.2, at);
      drive.gain.exponentialRampToValueAtTime(0.5, at + 0.24);
      s.connect(drive);
      drive.connect(shaper(ctx, foldCurve(3), V.own)).connect(V.input);
      s.start(at); s.stop(V.end + 0.02);
      cleanup(s, V.own);
      return V.end;
    }),

  // 5 · a ring-modulated bell: a sine carrier times an inharmonic sine, a short metallic glint
  entry('hyper-ringmod-glint', 'ring-mod glint', 'ringmod', 0.26,
    'a 1296 Hz sine multiplied (gain driven at audio rate) by a 557 Hz sine, soft-driven, low-passed at 8 kHz',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const V = voice(ctx, at, dest, { peak: 0.09 * strengthOf(o), lp: 8000, pan: (r() - 0.5) * 0.6, attack: 0.004, hold: 0.0, release: 0.24 });
      const c = osc(ctx, 'sine', 1296 * jitter(r, 0.02), V.own);
      const m = osc(ctx, 'sine', 557 * jitter(r, 0.02), V.own);
      const ring = gainNode(ctx, 0, V.own);
      c.connect(ring);
      m.connect(ring.gain);
      ring.connect(shaper(ctx, tanhCurve(2.5), V.own)).connect(V.input);
      c.start(at); m.start(at); c.stop(V.end + 0.02); m.stop(V.end + 0.02);
      cleanup(c, V.own);
      return V.end;
    }),

  // 6 · the swish again, ring-modulated into metal: a blade made of tin
  entry('hyper-ringmod-tin-swish', 'ring-mod tin swish', 'ringmod', 0.28,
    'a band-swept noise swish 1100 to 2400 Hz multiplied by a sine gliding 2600 to 520 Hz (ring mod), low-passed at 7.5 kHz, panned across',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const sr = SR_OF(ctx);
      const len = 0.22;
      const s0 = side(r);
      const V = voice(ctx, at, dest, { peak: 0.19 * strengthOf(o), lp: 7500, pan: -0.5 * s0, pan1: 0.5 * s0, len, attack: 0.005, hold: 0.15, release: 0.07 });
      const ring = gainNode(ctx, 0, V.own);
      const m = osc(ctx, 'sine', 2600 * jitter(r, 0.03), V.own);
      m.frequency.exponentialRampToValueAtTime(520, at + len);
      m.connect(ring.gain);
      ring.connect(V.input);
      const s = play(ctx, buffer(ctx, swishArr(Math.round(len * sr), sr, 1100, 2400, 5, r, { skew: 0.6 })), at, ring, V.own, { stopAt: V.end + 0.02 });
      m.start(at); m.stop(V.end + 0.02);
      cleanup(s, V.own);
      return V.end;
    }),

  // 7 · a ratchet: a soft-pulse blip repeated four times, each faster and higher, crushed
  entry('hyper-stutter-ratchet-up', 'stutter ratchet, up', 'stutter', 0.3,
    'four soft-pulse blips at 432, 485, 545 and 648 Hz on shrinking gaps (70, 50, 35 ms), crushed to 4 bits at 8 kHz in JS, low-passed at 2.4 kHz',
    (ctx, at, dest, o) => bufferSound(ctx, at, dest, o, {
      len: 0.26, lvl: 0.085,
      build: (n, sr, r) => {
        const x = new Float32Array(n);
        const k = jitter(r, 0.02);
        const steps = [[0, 432], [0.07, 485], [0.12, 545], [0.155, 648]];
        for (const [t0, f] of steps) {
          const i0 = Math.round(t0 * sr); const m = Math.round(0.045 * sr);
          const tone = toneArr(m, sr, f * k, f * k * 1.06, 'pulse');
          for (let i = 0; i < m && i0 + i < n; i++) {
            const e = Math.min(1, i / (0.002 * sr), (m - i) / (0.012 * sr));
            x[i0 + i] += tone[i] * e;
          }
        }
        return crush(x, 4, 8000, sr);
      },
      voiceOpts: (r) => ({ lp: 2400, pan: (r() - 0.5) * 0.5, hold: 0.17, release: 0.08 }),
    })),

  // 8 · tape glitch: a short chord fragment repeated, each repeat shorter (the DJ stutter, 1/32 to 1/128)
  entry('hyper-stutter-shrinking-repeat', 'stutter, shrinking repeats', 'stutter', 0.34,
    'a 40 ms fragment of an 864 Hz fifth chord replayed six times with each repeat cut 30 percent shorter, the last one ringing out over 8 ms decays, tanh-driven, low-passed at 5 kHz',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const sr = SR_OF(ctx);
      const k = jitter(r, 0.02);
      const n = Math.round(0.06 * sr);
      const a = toneArr(n, sr, 864 * k, 864 * k, 'tri'); const b = toneArr(n, sr, 1296 * k, 1296 * k, 'sine');
      const frag = new Float32Array(n);
      for (let i = 0; i < n; i++) frag[i] = 0.55 * a[i] + 0.45 * b[i];
      const buf = buffer(ctx, frag);
      const V = voice(ctx, at, dest, { peak: 0.12 * strengthOf(o), lp: 5000, pan: (r() - 0.5) * 0.6, attack: 0.004, hold: 0.24, release: 0.08 });
      const drive = shaper(ctx, tanhCurve(3), V.own);
      drive.connect(V.input);
      let t = at; let d = 0.04; let last = null;
      for (let i = 0; i < 6; i++) {
        const g = ctx.createGain();
        V.own.push(g);
        const lastSlice = i === 5;
        const len = lastSlice ? 0.058 : d; // the last repeat rings out over the rest of the fragment
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(1, t + 0.002);
        if (lastSlice) {
          g.gain.setTargetAtTime(0, t + 0.004, 0.008);
          g.gain.setValueAtTime(0.002, t + len - 0.004);
        } else {
          g.gain.setValueAtTime(1, t + d - 0.003);
        }
        g.gain.linearRampToValueAtTime(0, t + len);
        g.connect(drive);
        last = play(ctx, buf, t, g, V.own, { dur: len, stopAt: t + len + 0.005 });
        t += d + 0.008;
        d *= 0.7;
      }
      cleanup(last, V.own);
      return V.end;
    }),

  // 9 · granular smear: forty grains of a rising tone, scattered in time and pitch, smeared into a shimmer cloud
  entry('hyper-grain-smear-rise', 'granular smear, rising', 'grain', 0.44,
    'forty 22 ms Hann grains of a 648 Hz sine, seeded positions over 0.34 s, playback rate rising 0.7 to 1.6 with scatter, panned wide, low-passed at 7 kHz',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const sr = SR_OF(ctx);
      const n = Math.round(0.05 * sr);
      const src = toneArr(n, sr, 648 * jitter(r, 0.02), 648, 'sine');
      const buf = buffer(ctx, src);
      const V = voice(ctx, at, dest, { peak: 0.085 * strengthOf(o), lp: 7000, attack: 0.02, hold: 0.24, release: 0.14 });
      const fold = shaper(ctx, foldCurve(1.8), V.own);
      fold.connect(V.input);
      let last = null; let lastT = 0;
      for (let i = 0; i < 40; i++) {
        const t = at + r() * 0.34;
        const g = ctx.createGain(); V.own.push(g);
        const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.5, t + 0.011);
        g.gain.linearRampToValueAtTime(0, t + 0.022);
        if (p) { p.pan.value = (r() - 0.5) * 1.6; V.own.push(p); g.connect(p); p.connect(fold); } else g.connect(fold);
        const rate = (0.7 + 0.9 * ((t - at) / 0.34)) * jitter(r, 0.08);
        const s = play(ctx, buf, t, g, V.own, { rate, offset: r() * 0.02, dur: 0.024, stopAt: t + 0.025 });
        if (t > lastT) { lastT = t; last = s; }
      }
      cleanup(last, V.own);
      return V.end;
    }),

  // 10 · a dense cloud of band-passed noise grains: a grainy hiss puff, not a sweep
  entry('hyper-grain-noise-puff', 'granular noise puff', 'grain', 0.22,
    'thirty 9 ms grains of seeded noise, band-passed at 2.2 kHz (Q 6), clustered in 0.12 s, hard-clipped, low-passed at 6 kHz',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const sr = SR_OF(ctx);
      const buf = buffer(ctx, noiseArr(Math.round(0.2 * sr), r));
      const V = voice(ctx, at, dest, { peak: 0.11 * strengthOf(o), lp: 6000, pan: (r() - 0.5) * 0.8, attack: 0.006, hold: 0.06, release: 0.12 });
      const bp = filt(ctx, 'bandpass', 2200 * jitter(r, 0.04), 6, V.own);
      bp.connect(shaper(ctx, clipCurve(0.25), V.own)).connect(V.input);
      let last = null; let lastT = 0;
      for (let i = 0; i < 30; i++) {
        const t = at + Math.pow(r(), 1.6) * 0.12;
        const g = ctx.createGain(); V.own.push(g);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(1, t + 0.0045);
        g.gain.linearRampToValueAtTime(0, t + 0.009);
        g.connect(bp);
        const s = play(ctx, buf, t, g, V.own, { offset: r() * 0.18, dur: 0.01, stopAt: t + 0.011 });
        if (t > lastT) { lastT = t; last = s; }
      }
      cleanup(last, V.own);
      return V.end;
    }),

  // 11 · a tiny kick crushed to 2 bits: a low, gritty thump-tick
  entry('hyper-crushed-thump', 'crushed thump', 'bitcrush', 0.16,
    'a sine kick 170 down to 52 Hz, crushed to 2 bits at 6 kHz in JS, low-passed at 3 kHz',
    (ctx, at, dest, o) => bufferSound(ctx, at, dest, o, {
      len: 0.14, lvl: 0.13,
      build: (n, sr, r) => {
        const t = toneArr(n, sr, 170 * jitter(r, 0.03), 52, 'sine');
        for (let i = 0; i < n; i++) t[i] *= Math.exp(-i / (0.045 * sr));
        return crush(t, 2, 6000, sr);
      },
      voiceOpts: (r) => ({ lp: 3000, pan: (r() - 0.5) * 0.3, attack: 0.004, hold: 0.05, release: 0.08 }),
    })),

  // 12 · an aliasing zip: a sine rising fast, decimated hard so the aliases fold back down against it
  entry('hyper-alias-zip', 'aliasing zip', 'bitcrush', 0.18,
    'a sine sweeping 300 to 5200 Hz, sample-and-hold at 4.4 kHz so it aliases back down, 6 bits, low-passed at 6.5 kHz',
    (ctx, at, dest, o) => bufferSound(ctx, at, dest, o, {
      len: 0.13, lvl: 0.085,
      build: (n, sr, r) => crush(toneArr(n, sr, 300 * jitter(r, 0.03), 5200, 'sine'), 6, 4400, sr),
      voiceOpts: (r) => ({ lp: 6500, pan: (r() - 0.5) * 0.7, attack: 0.004, hold: 0.06, release: 0.07 }),
    })),

  // 13 · FM into a fold: a growling chirp
  entry('hyper-fm-fold-growl-chirp', 'FM growl chirp', 'fold', 0.22,
    'a 460 Hz sine frequency-modulated by a 230 Hz sine (index falling 1400 to 60 Hz), wavefolded at drive 2.2, low-passed at 5.5 kHz',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const V = voice(ctx, at, dest, { peak: 0.09 * strengthOf(o), lp: 5500, q: 2, pan: (r() - 0.5) * 0.5, attack: 0.005, hold: 0.0, release: 0.2 });
      const k = jitter(r, 0.03);
      const car = osc(ctx, 'sine', 460 * k, V.own);
      car.frequency.exponentialRampToValueAtTime(660 * k, at + 0.18);
      const mod = osc(ctx, 'sine', 230 * k, V.own);
      const idx = gainNode(ctx, 1400, V.own);
      idx.gain.setValueAtTime(1400, at);
      idx.gain.exponentialRampToValueAtTime(60, at + 0.2);
      mod.connect(idx); idx.connect(car.frequency);
      const drive = gainNode(ctx, 2.2, V.own);
      car.connect(drive);
      drive.connect(shaper(ctx, foldCurve(3), V.own)).connect(V.input);
      car.start(at); mod.start(at); car.stop(V.end + 0.02); mod.stop(V.end + 0.02);
      cleanup(car, V.own);
      return V.end;
    }),

  // 14 · the anime saber swing through overdrive: two detuned saws, a doppler pitch swell, panned across
  entry('hyper-overdrive-saber-swing', 'overdriven saber swing', 'swish', 0.34,
    'two saws at 108 and 110.5 Hz low-passed at 1.6 kHz, pitch swelling up 30 percent and back (a doppler pass), tanh drive 5, filter opening and closing, low-passed at 6 kHz, panned across',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const s0 = side(r);
      const len = 0.28;
      const V = voice(ctx, at, dest, { peak: 0.06 * strengthOf(o), lp: 6000, pan: -0.7 * s0, pan1: 0.7 * s0, len, attack: 0.12, hold: 0.02, release: 0.14 });
      const k = jitter(r, 0.03);
      const lp = filt(ctx, 'lowpass', 500, 4, V.own);
      lp.frequency.setValueAtTime(500, at);
      lp.frequency.exponentialRampToValueAtTime(HYPER_TONE.rawCeiling * 0.66, at + 0.13);
      lp.frequency.exponentialRampToValueAtTime(420, at + len);
      const a = osc(ctx, 'sawtooth', 108 * k, V.own); const b = osc(ctx, 'sawtooth', 110.5 * k, V.own);
      for (const x of [a, b]) {
        const f0 = x.frequency.value;
        x.frequency.setValueAtTime(f0, at);
        x.frequency.exponentialRampToValueAtTime(f0 * 1.3, at + 0.13);
        x.frequency.exponentialRampToValueAtTime(f0 * 0.85, at + len);
        x.connect(lp);
      }
      lp.connect(shaper(ctx, tanhCurve(5), V.own)).connect(V.input);
      a.start(at); b.start(at); a.stop(V.end + 0.02); b.stop(V.end + 0.02);
      cleanup(a, V.own);
      return V.end;
    }),

  // 15 · a hard-clipped air whoosh: noise high-passed and clipped, its band climbing while it passes
  entry('hyper-clipped-air-whoosh', 'clipped air whoosh', 'swish', 0.3,
    'seeded noise through a band-pass gliding 900 to 4800 Hz (Q 1.2), hard-clipped at 0.2, low-passed at 7 kHz, panned across',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const sr = SR_OF(ctx);
      const len = 0.24;
      const s0 = side(r);
      const V = voice(ctx, at, dest, { peak: 0.05 * strengthOf(o), lp: 7000, pan: 0.6 * s0, pan1: -0.6 * s0, len, attack: 0.06, hold: 0.1, release: 0.1 });
      const bp = filt(ctx, 'bandpass', 900 * jitter(r, 0.05), 1.2, V.own);
      bp.frequency.exponentialRampToValueAtTime(4800, at + len);
      const pre = gainNode(ctx, 6, V.own);
      bp.connect(pre);
      pre.connect(shaper(ctx, clipCurve(0.2), V.own)).connect(V.input);
      const s = play(ctx, buffer(ctx, noiseArr(Math.round(0.32 * sr), r)), at, bp, V.own, { stopAt: V.end + 0.02 });
      cleanup(s, V.own);
      return V.end;
    }),

  // 16 · a glitched tone: dropouts and sudden pitch jumps, like a corrupted file
  entry('hyper-glitch-dropout-tone', 'glitch dropout tone', 'glitch', 0.3,
    'a 864 Hz triangle broken into seeded 12 to 40 ms slices, each slice jumping to a new pitch step or dropping out, crushed to 5 bits, low-passed at 5.5 kHz',
    (ctx, at, dest, o) => bufferSound(ctx, at, dest, o, {
      len: 0.26, lvl: 0.12,
      build: (n, sr, r) => {
        const x = new Float32Array(n);
        const steps = [1, 1.5, 0.75, 2, 1.25, 0.5];
        let i = 0; let ph = 0;
        while (i < n) {
          const m = Math.round((0.012 + r() * 0.028) * sr);
          const on = r() > 0.28;
          const f = 864 * steps[Math.floor(r() * steps.length)];
          for (let j = 0; j < m && i < n; j++, i++) {
            ph += f / sr; ph -= Math.floor(ph);
            const e = Math.min(1, j / (0.0015 * sr), (m - j) / (0.0015 * sr));
            x[i] = on ? (1 - 4 * Math.abs(ph - 0.5)) * e : 0;
          }
        }
        return crush(x, 5, 12000, sr);
      },
      voiceOpts: (r) => ({ lp: 5500, pan: (r() - 0.5) * 0.6, hold: 0.18, release: 0.08 }),
    })),

  // 17 · sample-and-hold chatter: a computer chattering eight random notes
  entry('hyper-sample-hold-chatter', 'sample-and-hold chatter', 'glitch', 0.32,
    'eight 32 ms steps of a soft pulse at seeded notes on a 432 Hz pentatonic over two octaves, crushed to 3 bits at 7 kHz, low-passed at 2.4 kHz',
    (ctx, at, dest, o) => bufferSound(ctx, at, dest, o, {
      len: 0.27, lvl: 0.085,
      build: (n, sr, r) => {
        const x = new Float32Array(n);
        const pent = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
        const m = Math.round(0.032 * sr);
        let ph = 0;
        for (let s = 0; s < 8; s++) {
          const f = 432 * Math.pow(2, pent[Math.floor(r() * pent.length)] / 12);
          for (let j = 0; j < m; j++) {
            const i = s * m + j; if (i >= n) break;
            ph += f / sr; ph -= Math.floor(ph);
            x[i] = Math.tanh(4 * Math.sin(2 * Math.PI * ph)) * Math.min(1, j / (0.001 * sr), (m - j) / (0.001 * sr));
          }
        }
        return crush(x, 3, 7000, sr);
      },
      voiceOpts: (r) => ({ lp: 2400, pan: (r() - 0.5) * 0.8, attack: 0.004, hold: 0.2, release: 0.07 }),
    })),

  // 18 · a reversed crushed swell: noise sucked in, then cut
  entry('hyper-reverse-crush-suck', 'reversed crush suck', 'bitcrush', 0.28,
    'a triangle falling 1300 to 160 Hz plus low-passed seeded noise, played backwards so it rises and swells exponentially (a reversed decay), crushed to 4 bits at 11 kHz, low-passed at 7.5 kHz, cut in 60 ms',
    (ctx, at, dest, o) => bufferSound(ctx, at, dest, o, {
      len: 0.22, lvl: 0.32,
      build: (n, sr, r) => {
        const x = noiseArr(n, r);
        const t = toneArr(n, sr, 1300 * jitter(r, 0.03), 160, 'tri');
        const y = new Float32Array(n);
        let lp = 0;
        for (let i = 0; i < n; i++) { lp += 0.2 * (x[i] - lp); y[n - 1 - i] = (0.7 * t[i] + 0.8 * lp) * Math.exp(-i / (0.05 * sr)); }
        return crush(normalise(y), 4, 11000, sr);
      },
      voiceOpts: (r) => ({ lp: 7500, pan: (r() - 0.5) * 0.4, attack: 0.02, hold: 0.14, release: 0.06 }),
    })),

  // 19 · a ring-mod dive: the modulator falls fast so the sidebands slide together into the carrier
  entry('hyper-ringmod-dive', 'ring-mod dive', 'ringmod', 0.3,
    'a 648 Hz triangle multiplied by a sine whose frequency dives 1700 to 30 Hz, low-passed at 6 kHz',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const V = voice(ctx, at, dest, { peak: 0.125 * strengthOf(o), lp: 6000, pan: (r() - 0.5) * 0.5, attack: 0.005, hold: 0.1, release: 0.16 });
      const c = osc(ctx, 'triangle', 648 * jitter(r, 0.02), V.own);
      const m = osc(ctx, 'sine', 1700, V.own);
      m.frequency.exponentialRampToValueAtTime(30, at + 0.24);
      const ring = gainNode(ctx, 0, V.own);
      c.connect(ring); m.connect(ring.gain);
      ring.connect(V.input);
      c.start(at); m.start(at); c.stop(V.end + 0.02); m.stop(V.end + 0.02);
      cleanup(c, V.own);
      return V.end;
    }),

  // 20 · a comb zing: a noise burst rung through a short feedback delay whose time slides, then driven
  entry('hyper-comb-flange-zing', 'comb flange zing', 'fold', 0.34,
    'a 6 ms noise burst through a JS feedback comb (0.97, damped) whose delay slides 2.4 to 0.9 ms (a rising comb pitch, computed per sample because a WebAudio delay in a loop cannot go under one 2.7 ms block), tanh-driven, low-passed at 7 kHz',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const sr = SR_OF(ctx);
      const V = voice(ctx, at, dest, { peak: 0.12 * strengthOf(o), lp: 7000, pan: (r() - 0.5) * 0.6, attack: 0.004, hold: 0.08, release: 0.22 });
      const n = Math.round(0.32 * sr);
      const y = new Float32Array(n);
      const nb = Math.round(0.006 * sr);
      const d0 = 0.0024 * jitter(r, 0.04) * sr; const d1 = 0.0009 * sr;
      let damp = 0;
      for (let i = 0; i < n; i++) {
        const x = i < nb ? (r() * 2 - 1) * Math.sin(Math.PI * i / nb) : 0;
        const d = d0 * Math.pow(d1 / d0, Math.min(1, i / (0.28 * sr)));
        const p = i - d; const k = Math.floor(p); const fr = p - k;
        const back = k >= 0 ? y[k] + ((k + 1 < i ? y[k + 1] : 0) - y[k]) * fr : 0;
        damp += 0.75 * (back - damp);
        y[i] = x + 0.97 * damp;
      }
      const drive = shaper(ctx, tanhCurve(3), V.own);
      drive.connect(V.input);
      const s = play(ctx, buffer(ctx, normalise(y)), at, drive, V.own, { stopAt: V.end + 0.02 });
      cleanup(s, V.own);
      return V.end;
    }),

  // 21 · a folded pluck: a plucked triangle whose fold depth decays with its level, bright then round
  entry('hyper-fold-pluck', 'folded pluck', 'fold', 0.26,
    'a 216 Hz triangle with a 5 ms attack into a wavefolder whose drive decays 3.5 to 0.6 with the note, low-passed at 5 kHz',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const V = voice(ctx, at, dest, { peak: 0.115 * strengthOf(o), lp: 5000, pan: (r() - 0.5) * 0.6, attack: 0.005, hold: 0.02, release: 0.22 });
      const s = osc(ctx, 'triangle', 216 * jitter(r, 0.03) * (r() < 0.5 ? 1 : 1.5), V.own);
      const drive = gainNode(ctx, 3.5, V.own);
      drive.gain.setValueAtTime(3.5, at);
      drive.gain.exponentialRampToValueAtTime(0.6, at + 0.2);
      s.connect(drive);
      drive.connect(shaper(ctx, foldCurve(4), V.own)).connect(V.input);
      s.start(at); s.stop(V.end + 0.02);
      cleanup(s, V.own);
      return V.end;
    }),

  // 22 · a buzz stab: a square chopped at 55 Hz, soft-clipped, a gritty electric stab
  entry('hyper-gated-buzz-stab', 'gated buzz stab', 'stutter', 0.24,
    'an 81 Hz square low-passed at 1.2 kHz, gated into three bursts by a 14 Hz square through a 2.4 kHz low-pass (dipping to a tenth between bursts), each burst a fifth higher than the last, tanh-driven, low-passed at 2 kHz',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const V = voice(ctx, at, dest, { peak: 0.1 * strengthOf(o), lp: 2000, pan: (r() - 0.5) * 0.5, attack: 0.004, hold: 0.15, release: 0.07 });
      const k = jitter(r, 0.03);
      const sq = osc(ctx, 'square', 81 * k, V.own);
      sq.frequency.setValueAtTime(81 * k, at);
      sq.frequency.setValueAtTime(121.5 * k, at + 0.0714);
      sq.frequency.setValueAtTime(182.25 * k, at + 0.1428);
      const lp = filt(ctx, 'lowpass', 1200, 1, V.own);
      const chop = gainNode(ctx, 0.55, V.own);
      const lfo = osc(ctx, 'square', 14 * k, V.own);
      const lfoLp = filt(ctx, 'lowpass', HYPER_TONE.rawCeiling, 0.7, V.own);
      const lfoAmt = gainNode(ctx, 0.45, V.own); // the gate dips to 0.1, never to silence, so no burst ends in a cut
      lfo.connect(lfoLp); lfoLp.connect(lfoAmt); lfoAmt.connect(chop.gain);
      sq.connect(lp); lp.connect(chop);
      chop.connect(shaper(ctx, tanhCurve(4), V.own)).connect(V.input);
      sq.start(at); lfo.start(at); sq.stop(V.end + 0.02); lfo.stop(V.end + 0.02);
      cleanup(sq, V.own);
      return V.end;
    }),

  // 23 · a granular swish smear: the swish cut into overlapping grains played slow and low, smeared and dark
  entry('hyper-grain-swish-smear', 'granular swish smear', 'grain', 0.5,
    'a band-swept noise swish 5200 to 2600 Hz cut into 24 overlapping 40 ms grains read alternately at half and three-quarter speed (time-stretched, a fifth apart), stepped-curve crushed to 4 bits, low-passed at 7 kHz',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const sr = SR_OF(ctx);
      const srcLen = 0.24;
      const buf = buffer(ctx, swishArr(Math.round(srcLen * sr), sr, 5200 * jitter(r, 0.03), 2600, 4, r, { skew: 0.5 }));
      const s0 = side(r);
      const V = voice(ctx, at, dest, { peak: 0.28 * strengthOf(o), lp: 7000, pan: 0.4 * s0, pan1: -0.4 * s0, len: 0.46, attack: 0.03, hold: 0.25, release: 0.14 });
      const st = shaper(ctx, stepCurve(4), V.own);
      st.connect(V.input);
      let last = null;
      for (let i = 0; i < 24; i++) {
        const t = at + i * 0.018;
        const g = ctx.createGain(); V.own.push(g);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.6, t + 0.02);
        g.gain.linearRampToValueAtTime(0, t + 0.04);
        g.connect(st);
        const off = Math.min(srcLen - 0.03, (i / 24) * srcLen + (r() - 0.5) * 0.01);
        last = play(ctx, buf, t, g, V.own, { rate: i % 2 ? 0.75 : 0.5, offset: Math.max(0, off), dur: 0.042, stopAt: t + 0.042 });
      }
      cleanup(last, V.own);
      return V.end;
    }),

  // 24 · an X slash: two quick crushed swishes, one each side, the second higher
  entry('hyper-crushed-double-slash', 'crushed double slash', 'swish', 0.3,
    'two 90 ms band-swept noise swishes (1200 to 2800 Hz, then 1800 to 4200 Hz) 110 ms apart, sample-and-hold to 7 kHz and 4 bits, low-passed at 7.5 kHz, the first left and the second right',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const sr = SR_OF(ctx);
      const s0 = side(r);
      let end = at;
      let lastSrc = null; let lastOwn = null;
      const cuts = [[0, 1200, 2800, -0.6 * s0], [0.11, 1800, 4200, 0.6 * s0]];
      for (const [dt, fa, fb, pan] of cuts) {
        const t = at + dt;
        const V = voice(ctx, t, dest, { peak: 0.115 * strengthOf(o), lp: 7500, pan, attack: 0.004, hold: 0.04, release: 0.07 });
        const data = crush(swishArr(Math.round(0.09 * sr), sr, fa * jitter(r, 0.03), fb, 3.5, r, { skew: 0.35 }), 4, 7000, sr);
        const s = play(ctx, buffer(ctx, data), t, V.input, V.own, { stopAt: V.end + 0.02 });
        cleanup(s, V.own);
        if (V.end > end) { end = V.end; lastSrc = s; lastOwn = V.own; }
      }
      void lastSrc; void lastOwn;
      return end;
    }),

  // 25 · glitch scatter: seven 1-bit blips at seeded times and pitches, scattered across the field
  entry('hyper-glitch-scatter-blips', 'glitch scatter blips', 'glitch', 0.4,
    'seven 30 ms blips at seeded times over 0.25 s and seeded pitches 1 to 3 kHz, crushed to 1 bit (a pure pulse), then each decaying with a 4 ms time constant, panned at random, low-passed at 4.2 kHz',
    (ctx, at, dest, o) => {
      const r = rng(o?.seed ?? 1);
      const sr = SR_OF(ctx);
      const V = voice(ctx, at, dest, { peak: 0.055 * strengthOf(o), lp: 4200, attack: 0.004, hold: 0.25, release: 0.08 });
      let last = null; let lastT = -1;
      for (let i = 0; i < 7; i++) {
        const t = at + 0.004 + r() * 0.25;
        const f = 1000 + r() * 2000;
        const m = Math.round(0.03 * sr);
        const data = crush(toneArr(m, sr, f, f * 0.9, 'sine'), 1, 24000, sr);
        const a2 = 0.002 * sr; const tau = 0.004 * sr;
        for (let j = 0; j < m; j++) data[j] *= j < a2 ? j / a2 : Math.exp(-(j - a2) / tau) * (m - j) / (m - a2);
        const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        let into = V.input;
        if (p) { p.pan.value = (r() - 0.5) * 1.8; p.connect(V.input); V.own.push(p); into = p; }
        const s = play(ctx, buffer(ctx, data), t, into, V.own, { stopAt: t + 0.032 });
        if (t > lastT) { lastT = t; last = s; }
      }
      // the last blip may end before the envelope does; keep the chain alive to the envelope's end
      const keep = osc(ctx, 'sine', 1, V.own);
      const mute = gainNode(ctx, 0, V.own);
      keep.connect(mute); mute.connect(V.input);
      keep.start(at); keep.stop(V.end + 0.02);
      void last;
      cleanup(keep, V.own);
      return V.end;
    }),
]);
