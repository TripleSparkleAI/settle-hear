// settle-hear · sfx-radial-psy - THE RADIAL DECK, psytrance and sci-fi half (lane PSYRADIAL, 2026-10-05): 25 short
// procedural sounds for a radial click, in the acid, laser, sweep, tape-stop, warp and FM families. Hyper and processed
// (resonance, drive, ring modulation, FM, comb and flanger feedback, stereo movement), played at a subtle level.
//
// <claudes_code_comments>
// ** Function List **
// RADIAL_PSY                    - the 25 entries { id, name, kind, deck, lane, dur, provenance, level, render }
// PSY_LEVEL                     - the level rules this file holds itself to (the click reference, the aim, the floors)
// psyRng(seed)                  - mulberry32, the seeded generator every variation is drawn from
// voice(ctx, at, dest, opts, s) - the shared output stage of one sound (local to this file): input -> optional drive
//                                 -> final lowpass (<= 9 kHz) -> the envelope gain -> a moving panner -> dest
// stubCtx()                     - a silent recording context, used once per entry to read its stated length (`dur`)
//
// ** Technical Review **
// - THE FORMAT (SWORDSWISH's ruling in SETTLE/runs/animesfx/CHANNEL.md): render(ctx, at, dest, opts) builds every node
//   from ctx, schedules from `at` into `dest`, returns its end time and disconnects its nodes when its last source
//   ends. opts = { strength = 1 (0.15 .. 1), seed = 1 }. No Math.random: the seed draws a small detune (about +/- 25
//   cents), a pan offset and a drive change, so a repeated card varies a little and a test sees the same samples.
// - THE NODE SUBSET: Gain, Oscillator (sine, square, sawtooth, triangle), BiquadFilter, WaveShaper, BufferSource,
//   createBuffer, Delay, StereoPanner and audio-rate param modulation by connected nodes. No Convolver, Worklet,
//   ScriptProcessor or PeriodicWave. Noise is one seeded 1.5 s buffer per context, computed in JS.
// - THE TONE RULES: the envelope gain starts and ends at zero, its attack is at least 4 ms and its last segment at
//   least 60 ms. A raw saw or square always meets a fixed lowpass at 2400 Hz first (`raw()`), so a resonant acid sweep
//   that opens above 2.4 kHz is shaping an already ceilinged wave. Every sound ends in a lowpass at or below 9 kHz,
//   after any drive, before the envelope.
// - THE LEVEL: `level` is each sound's envelope peak, calibrated in headless Chromium (tools/sfx_measure.py) so every
//   sound at strength 1 sits under the loudest click noise (peak -15.4 dBFS, loudest 50 ms RMS -22.8 dBFS) with the
//   deck's median near the clicks' median (peak about -20, RMS about -26.4). The drive stage sits before the envelope,
//   so the envelope alone sets the output level.
// - INNER ENVELOPES: a struck step inside a sound (`hit`: a laser shot, a bass note, a stab) also starts and ends at
//   zero, with a 4 ms attack and a last segment of at least 60 ms. Gains that feed a param (an FM index, a ring-mod
//   or tremolo depth) are depths, not envelopes, and ramp exponentially (SWORDSWISH's test-4 scope).
// - `dur` is never typed: each entry renders once into stubCtx() at load and keeps the end time it returns.
// - FEEDBACK: three sounds loop a DelayNode through a gain (psy-dub-delay-ping, psy-flanger-warp-rise,
//   psy-comb-portal-whoop). Every looped delay stays at or above 3 ms (Chromium's floor in a cycle is 128 frames) and
//   every loop gain stays under 0.9.
// </claudes_code_comments>

export const PSY_LEVEL = Object.freeze({
  capPeakDb: -15.4, // the loudest click noise, Chromium OfflineAudioContext at strength 1
  capRms50Db: -22.8,
  aimPeakDb: -20, // the click noises' median
  aimRms50Db: -26.4,
  attackMin: 0.004,
  releaseMin: 0.06,
  rawCeiling: 2400,
  finalLowpassMax: 9000,
});

const A4 = 432;
const hz = (semis) => A4 * Math.pow(2, semis / 12);
const PROV = (recipe) => Object.freeze({ method: 'procedural', made: '2026-10-05', recipe });

export function psyRng(seed = 1) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// one seeded noise buffer per context (1.5 s, the longest any sound may be)
const NOISE = new WeakMap();
function noiseBuf(ctx) {
  let b = NOISE.get(ctx);
  if (b) return b;
  const n = Math.max(1, Math.round(ctx.sampleRate * 1.5));
  b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let x = 0x2545f491;
  for (let i = 0; i < n; i++) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    d[i] = ((x >>> 0) / 4294967296) * 2 - 1;
  }
  NOISE.set(ctx, b);
  return b;
}

// a soft-clip curve, tanh(k x) / tanh(k), 1024 points, cached per context and drive
const CURVES = new WeakMap();
function softClip(ctx, k) {
  let m = CURVES.get(ctx);
  if (!m) { m = new Map(); CURVES.set(ctx, m); }
  const key = Math.round(k * 10) / 10;
  if (m.has(key)) return m.get(key);
  const c = new Float32Array(1024);
  const norm = Math.tanh(key);
  for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; c[i] = Math.tanh(key * x) / norm; }
  m.set(key, c);
  return c;
}

const fin = (x, d) => (Number.isFinite(+x) ? +x : d);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const pos = (x) => Math.max(1e-4, x);

// THE VOICE: the one output stage every sound in this file goes through.
// spec: { level, attack, hold, release, tail (share of level at the knee), drive, lp, pan: [from, to] }
function voice(ctx, at, dest, opts, spec) {
  const r = psyRng(fin(opts?.seed, 1) * 7919 + spec.salt);
  const strength = clamp(fin(opts?.strength, 1), 0.15, 1);
  const detune = (r() - 0.5) * 50; // cents
  const panOff = (r() - 0.5) * 0.3;
  const drive = spec.drive ? spec.drive * (0.85 + 0.3 * r()) : 0;
  const nodes = [];
  const keep = (n) => { nodes.push(n); return n; };
  const input = keep(ctx.createGain());
  let head = input;
  if (drive) {
    const ws = keep(ctx.createWaveShaper());
    ws.curve = softClip(ctx, drive);
    ws.oversample = '2x';
    head.connect(ws);
    head = ws;
  }
  const lp = keep(ctx.createBiquadFilter());
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(PSY_LEVEL.finalLowpassMax, spec.lp ?? 8500);
  lp.Q.value = 0.5;
  head.connect(lp);
  const g = keep(ctx.createGain());
  const a = Math.max(PSY_LEVEL.attackMin, spec.attack ?? 0.005);
  const hold = Math.max(0, spec.hold ?? 0);
  const rel = Math.max(PSY_LEVEL.releaseMin * 2, spec.release ?? 0.15);
  const peak = spec.level * strength;
  const knee = clamp(spec.tail ?? 0.35, 0.05, 1);
  const end = at + a + hold + rel;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + a);
  g.gain.setValueAtTime(peak, at + a + hold);
  g.gain.linearRampToValueAtTime(peak * knee, at + a + hold + rel * 0.3);
  g.gain.linearRampToValueAtTime(0, end);
  lp.connect(g);
  let out = g;
  if (ctx.createStereoPanner && spec.pan) {
    const p = keep(ctx.createStereoPanner());
    const p0 = clamp(spec.pan[0] + panOff, -0.8, 0.8);
    const p1 = clamp(spec.pan[1] + panOff, -0.8, 0.8);
    p.pan.setValueAtTime(p0, at);
    p.pan.linearRampToValueAtTime(p1, end);
    g.connect(p);
    out = p;
  }
  out.connect(dest);
  let live = 0;
  const done = () => { if (--live <= 0) for (const n of nodes) { try { n.disconnect(); } catch { /* gone */ } } };
  const v = {
    ctx, at, end, input, r, detune, keep,
    // a source started at t (default at) and stopped just after the envelope ends; the last one to end tidies up
    run(src, t = at) {
      keep(src);
      live++;
      src.onended = done;
      src.start(t);
      src.stop(end + 0.02);
      return src;
    },
    osc(type, f, t) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(pos(f), at);
      o.detune.value = detune;
      return v.run(o, t);
    },
    noise(t, offset = 0) {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuf(ctx);
      keep(s);
      live++;
      s.onended = done;
      s.start(t ?? at, clamp(offset, 0, 0.2));
      s.stop(end + 0.02);
      return s;
    },
    gain(value = 1) { const n = keep(ctx.createGain()); n.gain.value = value; return n; },
    filter(type, f, q = 1) {
      const n = keep(ctx.createBiquadFilter());
      n.type = type;
      n.frequency.value = pos(f);
      n.Q.value = q;
      return n;
    },
    // THE TONE RULE: a raw saw or square passes this fixed 2.4 kHz lowpass first, before anything else
    raw(o) { const n = v.filter('lowpass', PSY_LEVEL.rawCeiling, 0.7); o.connect(n); return n; },
    delay(t, max = 1) { const n = keep(ctx.createDelay(max)); n.delayTime.value = t; return n; },
    shaper(k) { const n = keep(ctx.createWaveShaper()); n.curve = softClip(ctx, k); n.oversample = '2x'; return n; },
    // a per-note gain envelope inside a sound (a step or a struck partial), never touching the output envelope:
    // zero, a linear attack (>= 4 ms), a knee to 30% over d, then zero over at least 60 ms (the TONE RULES' floors)
    hit(node, t, peak, a, d) {
      const ta = t + Math.max(PSY_LEVEL.attackMin, a);
      const tk = ta + Math.max(0.004, d);
      node.gain.setValueAtTime(0, t);
      node.gain.linearRampToValueAtTime(peak, ta);
      node.gain.linearRampToValueAtTime(peak * 0.3, tk);
      node.gain.linearRampToValueAtTime(0, tk + Math.max(PSY_LEVEL.releaseMin, d * 1.5));
    },
  };
  return v;
}

const exp = (p, val, t) => p.exponentialRampToValueAtTime(pos(val), t);
const set = (p, val, t) => p.setValueAtTime(val, t);
const lin = (p, val, t) => p.linearRampToValueAtTime(val, t);

// ---- the 25 ------------------------------------------------------------------------------------------------------

// 1. ACID: a 303-style squelch, one saw note, the resonant cutoff snapping open and falling
function acidSquelch(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 1, level: e.level, attack: 0.005, hold: 0.0, release: 0.13, tail: 0.3, drive: 2.4, lp: 7000, pan: [-0.1, 0.1] });
  const o = v.osc('sawtooth', hz(-12));
  const f = v.filter('lowpass', 320, 20);
  v.raw(o).connect(f);
  set(f.frequency, 320, at); exp(f.frequency, 3600, at + 0.006); exp(f.frequency, 300, at + 0.12);
  f.connect(v.input);
  return v.end;
}

// 2. ACID: two square steps, the second slides up an octave with an accent, filter retriggered on the accent
function acidSlide(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 2, level: e.level, attack: 0.005, hold: 0.16, release: 0.14, drive: 2, lp: 7000, pan: [0.15, -0.15] });
  const o = v.osc('square', hz(-17));
  set(o.frequency, hz(-17), at); set(o.frequency, hz(-17), at + 0.09); lin(o.frequency, hz(-5), at + 0.14);
  const f = v.filter('lowpass', 300, 13);
  v.raw(o).connect(f);
  set(f.frequency, 300, at); exp(f.frequency, 1500, at + 0.01); exp(f.frequency, 280, at + 0.09);
  exp(f.frequency, 3400, at + 0.15); exp(f.frequency, 260, at + 0.32);
  f.connect(v.input);
  return v.end;
}

// 3. ACID: a double wah, the cutoff rising and falling twice over one held saw note (wow-wow)
function acidWah(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 3, level: e.level, attack: 0.03, hold: 0.22, release: 0.22, tail: 0.6, drive: 1.8, lp: 6000, pan: [-0.25, 0.25] });
  const o = v.osc('sawtooth', hz(-19));
  const f = v.filter('lowpass', 180, 12);
  v.raw(o).connect(f);
  set(f.frequency, 180, at); exp(f.frequency, 1900, at + 0.11); exp(f.frequency, 220, at + 0.22);
  exp(f.frequency, 2300, at + 0.33); exp(f.frequency, 170, at + 0.47);
  f.connect(v.input);
  return v.end;
}

// 4. ACID: a high square chirp, a short screaming resonance an octave and a half up
function acidChirpHigh(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 4, level: e.level, attack: 0.004, hold: 0.02, release: 0.1, drive: 1.6, lp: 8000, pan: [0.3, 0.3] });
  const o = v.osc('square', hz(-5));
  const f = v.filter('lowpass', 900, 18);
  v.raw(o).connect(f);
  set(f.frequency, 900, at); exp(f.frequency, 4200, at + 0.012); exp(f.frequency, 650, at + 0.1);
  f.connect(v.input);
  return v.end;
}

// 5. LASER: a sine falling from 2.6 kHz to 140 Hz, wobbled by a 37 Hz FM
function laserZap(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 5, level: e.level, attack: 0.004, hold: 0.03, release: 0.13, drive: 1.5, lp: 8000, pan: [0.2, -0.2] });
  const o = v.osc('sine', 2600);
  exp(o.frequency, 140, at + 0.14);
  const m = v.osc('sine', 37);
  const mg = v.gain(220);
  m.connect(mg); mg.connect(o.frequency);
  o.connect(v.input);
  return v.end;
}

// 6. LASER: three short triangle zaps falling in a row, each from a lower start
function laserTriple(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 6, level: e.level, attack: 0.004, hold: 0.15, release: 0.12, tail: 0.6, drive: 1.4, lp: 8000, pan: [-0.4, 0.4] });
  [1900, 1500, 1150].forEach((f0, i) => {
    const t = at + i * 0.065;
    const o = v.osc('triangle', f0, t);
    set(o.frequency, f0, t); exp(o.frequency, 110, t + 0.06);
    const g = v.gain(0);
    v.hit(g, t, 1, 0.004, 0.05);
    o.connect(g); g.connect(v.input);
  });
  return v.end;
}

// 7. LASER: a ricochet, up to 3.2 kHz in 50 ms then down to 600 Hz, flying left to right
function laserRicochet(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 7, level: e.level, attack: 0.006, hold: 0.04, release: 0.14, drive: 1.3, lp: 7500, pan: [-0.7, 0.7] });
  const o = v.osc('sine', 900);
  exp(o.frequency, 3200, at + 0.05); exp(o.frequency, 600, at + 0.19);
  const o2 = v.osc('sine', 1350);
  exp(o2.frequency, 4800, at + 0.05); exp(o2.frequency, 900, at + 0.19);
  const g2 = v.gain(0.25);
  o.connect(v.input); o2.connect(g2); g2.connect(v.input);
  return v.end;
}

// 8. LASER: a ring-modulated zap, a falling triangle multiplied by a 90 Hz sine (a hollow metallic buzz)
function ringZap(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 8, level: e.level, attack: 0.004, hold: 0.04, release: 0.15, drive: 1.6, lp: 7000, pan: [0.1, 0.35] });
  const o = v.osc('triangle', 1400);
  exp(o.frequency, 300, at + 0.18);
  const ring = v.gain(0);
  const m = v.osc('sine', 90);
  m.connect(ring.gain);
  o.connect(ring); ring.connect(v.input);
  return v.end;
}

// 9. SWEEP: a resonant noise riser, a band-pass at Q 14 climbing from 250 Hz to 5 kHz
function resonantRiser(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 9, level: e.level, attack: 0.28, hold: 0.04, release: 0.12, tail: 0.5, drive: 2, lp: 8500, pan: [-0.3, 0.3] });
  const s = v.noise(at, v.r() * 0.2);
  const f = v.filter('bandpass', 250, 14);
  set(f.frequency, 250, at); exp(f.frequency, 5000, at + 0.42);
  s.connect(f); f.connect(v.input);
  return v.end;
}

// 10. SWEEP: a downlifter, a resonant high-pass falling from 6 kHz to 200 Hz under a soft band-pass
function noiseDownlifter(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 10, level: e.level, attack: 0.012, hold: 0.06, release: 0.3, tail: 0.5, drive: 1.2, lp: 7000, pan: [0.4, -0.2] });
  const s = v.noise(at, v.r() * 0.2);
  const hp = v.filter('highpass', 6000, 7);
  const bp = v.filter('bandpass', 4000, 1.2);
  set(hp.frequency, 6000, at); exp(hp.frequency, 200, at + 0.36);
  set(bp.frequency, 4000, at); exp(bp.frequency, 300, at + 0.36);
  s.connect(hp); hp.connect(bp); bp.connect(v.input);
  return v.end;
}

// 11. SWEEP: a talking filter, a saw through two moving formants, "o" closing to "i" (a yoi)
function formantYoi(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 11, level: e.level, attack: 0.01, hold: 0.12, release: 0.18, tail: 0.5, drive: 1.5, lp: 6000, pan: [-0.15, 0.15] });
  const o = v.osc('sawtooth', hz(-7));
  exp(o.frequency, hz(-2), at + 0.3);
  const src = v.raw(o);
  const f1 = v.filter('bandpass', 600, 9);
  const f2 = v.filter('bandpass', 900, 11);
  set(f1.frequency, 600, at); exp(f1.frequency, 300, at + 0.25);
  set(f2.frequency, 900, at); exp(f2.frequency, 2300, at + 0.25);
  const g1 = v.gain(1); const g2 = v.gain(0.8);
  src.connect(f1); src.connect(f2); f1.connect(g1); f2.connect(g2); g1.connect(v.input); g2.connect(v.input);
  return v.end;
}

// 12. TAPE STOP: a minor saw chord slowing to a stop, the pitch falling to a twelfth and the filter closing with it
function tapeStop(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 12, level: e.level, attack: 0.006, hold: 0.22, release: 0.18, tail: 0.6, drive: 1.6, lp: 6000, pan: [0, 0] });
  const f = v.filter('lowpass', 2300, 2);
  set(f.frequency, 2300, at + 0.15); exp(f.frequency, 120, at + 0.4);
  [-5, -2, 2].forEach((s) => {
    const o = v.osc('sawtooth', hz(s));
    set(o.frequency, hz(s), at + 0.15); exp(o.frequency, hz(s) / 12, at + 0.4);
    v.raw(o).connect(f);
  });
  f.connect(v.input);
  return v.end;
}

// 13. WARP: an FM dive, carrier and modulator both falling while the modulation index grows (a gravity well)
function warpDive(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 13, level: e.level, attack: 0.006, hold: 0.08, release: 0.24, tail: 0.5, drive: 1.8, lp: 7000, pan: [0.35, -0.35] });
  const c = v.osc('sine', 640);
  exp(c.frequency, 45, at + 0.32);
  const m = v.osc('sine', 905);
  exp(m.frequency, 64, at + 0.32);
  const idx = v.gain(40);
  set(idx.gain, 40, at); exp(idx.gain, 700, at + 0.3);
  m.connect(idx); idx.connect(c.frequency);
  c.connect(v.input);
  return v.end;
}

// 14. WARP: a flanger rise, a saw and noise climbing through a swept feedback delay (the jet)
function flangerWarpRise(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 14, level: e.level, attack: 0.2, hold: 0.06, release: 0.14, tail: 0.5, drive: 1.4, lp: 7000, pan: [-0.5, 0.5] });
  const o = v.osc('sawtooth', hz(-24));
  exp(o.frequency, hz(-5), at + 0.38);
  const n = v.noise(at, v.r() * 0.2);
  const ng = v.gain(0.35);
  const mix = v.gain(1);
  v.raw(o).connect(mix); n.connect(ng); ng.connect(mix);
  const d = v.delay(0.009, 0.05);
  set(d.delayTime, 0.009, at); exp(d.delayTime, 0.0032, at + 0.4);
  const fb = v.gain(0.72);
  mix.connect(d); d.connect(fb); fb.connect(d);
  mix.connect(v.input); d.connect(v.input);
  return v.end;
}

// 15. FM CHIRP: a bright two-operator chirp, the index collapsing in 80 ms while the pitch climbs a fifth
function fmChirp(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 15, level: e.level, attack: 0.004, hold: 0.02, release: 0.09, drive: 1.2, lp: 8500, pan: [0.25, 0.25] });
  const c = v.osc('sine', hz(12));
  exp(c.frequency, hz(19), at + 0.08);
  const m = v.osc('sine', hz(12) * 2);
  exp(m.frequency, hz(19) * 2, at + 0.08);
  const idx = v.gain(2600);
  set(idx.gain, 2600, at); exp(idx.gain, 20, at + 0.09);
  m.connect(idx); idx.connect(c.frequency);
  c.connect(v.input);
  return v.end;
}

// 16. FM CHIRP: an inharmonic FM blip at the ratio 3.73, a struck alien bell
function fmMetalBlip(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 16, level: e.level, attack: 0.004, hold: 0.0, release: 0.2, tail: 0.25, drive: 1.3, lp: 8000, pan: [-0.35, -0.2] });
  const c = v.osc('sine', 1040);
  const m = v.osc('sine', 1040 * 3.73);
  const idx = v.gain(1800);
  set(idx.gain, 1800, at); exp(idx.gain, 30, at + 0.18);
  m.connect(idx); idx.connect(c.frequency);
  c.connect(v.input);
  return v.end;
}

// 17. FM CHIRP: a gurgle, a low carrier whose modulator sweeps 20 to 180 Hz (bubbles in a reactor)
function fmGurgle(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 17, level: e.level, attack: 0.01, hold: 0.1, release: 0.2, tail: 0.5, drive: 2.2, lp: 6000, pan: [0.1, -0.1] });
  const c = v.osc('sine', 520);
  exp(c.frequency, 980, at + 0.3);
  const m = v.osc('triangle', 20);
  exp(m.frequency, 180, at + 0.3);
  const idx = v.gain(380);
  m.connect(idx); idx.connect(c.frequency);
  const trem = v.gain(0.5);
  const lfo = v.osc('square', 23);
  const lfoS = v.filter('lowpass', 120, 0.7);
  const lfoD = v.gain(0.5);
  lfo.connect(lfoS); lfoS.connect(lfoD); lfoD.connect(trem.gain);
  c.connect(trem); trem.connect(v.input);
  return v.end;
}

// 18. PSY: a rolling psy bass, a pitched kick then three off-beat bass sixteenths at 145 BPM (KBBB)
function rollingKick(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 18, level: e.level, attack: 0.004, hold: 0.3, release: 0.08, tail: 0.8, drive: 2.6, lp: 3000, pan: [0, 0] });
  const step = 60 / 145 / 4;
  const k = v.osc('sine', 170);
  exp(k.frequency, 52, at + 0.05);
  const kg = v.gain(0);
  v.hit(kg, at, 1, 0.004, 0.09);
  k.connect(kg); kg.connect(v.input);
  const b = v.osc('sawtooth', hz(-36));
  const bf = v.filter('lowpass', 300, 6);
  const bg = v.gain(0);
  v.raw(b).connect(bf); bf.connect(bg); bg.connect(v.input);
  for (let i = 1; i < 4; i++) {
    const t = at + i * step;
    v.hit(bg, t, 0.55, 0.004, step * 0.7);
    set(bf.frequency, 900, t); exp(bf.frequency, 160, t + step * 0.8);
  }
  return v.end;
}

// 19. PSY: a Goa arpeggio, four 32nd-note saw steps in the Phrygian mode, each with its own filter blip
function goaArp(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 19, level: e.level, attack: 0.004, hold: 0.18, release: 0.1, tail: 0.6, drive: 1.6, lp: 7000, pan: [-0.3, 0.3] });
  const o = v.osc('sawtooth', hz(0));
  const f = v.filter('lowpass', 400, 10);
  v.raw(o).connect(f); f.connect(v.input);
  [0, 1, 7, 12].forEach((s, i) => {
    const t = at + i * 0.052;
    set(o.frequency, hz(s), t);
    set(f.frequency, 400, t); exp(f.frequency, 2300, t + 0.006); exp(f.frequency, 380, t + 0.045);
  });
  return v.end;
}

// 20. PSY: a trance stab, four detuned saws in a minor chord struck twice a sixteenth apart (stab and its echo)
function gatedStab(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 20, level: e.level, attack: 0.004, hold: 0.2, release: 0.12, tail: 0.6, drive: 1.5, lp: 6500, pan: [0.2, -0.2] });
  const gate = v.gain(0);
  const f = v.filter('highpass', 500, 0.7);
  [[0, -9], [3, 7], [7, -4], [12, 5]].forEach(([s, c]) => {
    const o = v.osc('sawtooth', hz(s));
    o.detune.value += c;
    v.raw(o).connect(f);
  });
  f.connect(gate); gate.connect(v.input);
  const step = 60 / 145 / 4;
  const g2 = v.gain(0);
  f.connect(g2); g2.connect(v.input);
  v.hit(gate, at, 1, 0.004, 0.035);
  v.hit(g2, at + step, 0.55, 0.004, 0.03);
  return v.end;
}

// 21. PSY: a dub-delay ping, one FM blip into a 90 ms feedback echo darkening as it repeats
function dubDelayPing(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 21, level: e.level, attack: 0.004, hold: 0.25, release: 0.24, tail: 0.6, drive: 1.3, lp: 6000, pan: [-0.5, 0.5] });
  const c = v.osc('sine', 1300);
  const m = v.osc('sine', 1950);
  const idx = v.gain(600);
  m.connect(idx); idx.connect(c.frequency);
  const bg = v.gain(0);
  v.hit(bg, at, 1, 0.004, 0.035);
  c.connect(bg);
  const d = v.delay(0.09, 0.2);
  const fb = v.gain(0.55);
  const dark = v.filter('lowpass', 2600, 0.7);
  bg.connect(v.input); bg.connect(d); d.connect(dark); dark.connect(fb); fb.connect(d); dark.connect(v.input);
  return v.end;
}

// 22. PSY: a sidechain-pumped phaser pad, a minor chord swelling in twice on eighth notes, as if a kick ducked it
function phaserSwoosh(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 22, level: e.level, attack: 0.01, hold: 0.36, release: 0.08, tail: 0.8, drive: 1.3, lp: 6000, pan: [-0.4, 0.4] });
  const shape = v.filter('bandpass', 1100, 0.6);
  [-12, -9, -5].forEach((st) => { const o = v.osc('sawtooth', hz(st)); v.raw(o).connect(shape); });
  const lfo = v.osc('sine', 6);
  const depth = v.gain(800);
  lfo.connect(depth);
  let head = shape;
  for (let i = 0; i < 4; i++) {
    const ap = v.filter('allpass', 1000, 5);
    depth.connect(ap.frequency);
    head.connect(ap);
    head = ap;
  }
  const mix = v.gain(1);
  head.connect(mix); shape.connect(mix);
  // THE PUMP: on the audio path, so it starts and ends at zero; each swell is the eighth after a ducking kick
  const pump = v.gain(0);
  const eighth = 60 / 145 / 2;
  set(pump.gain, 0, at);
  lin(pump.gain, 1, at + eighth * 0.85);
  lin(pump.gain, 0.08, at + eighth);
  lin(pump.gain, 1, at + eighth * 1.85);
  lin(pump.gain, 0, at + eighth * 1.85 + 0.07);
  mix.connect(pump); pump.connect(v.input);
  return v.end;
}

// 23. SCI-FI: a scanner beep, a sine trilling at 28 Hz around 1.7 kHz, a short instrument read-out
function scannerBeep(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 23, level: e.level, attack: 0.005, hold: 0.12, release: 0.08, tail: 0.7, drive: 1.1, lp: 8000, pan: [0.4, 0.4] });
  const o = v.osc('sine', 1700);
  const lfo = v.osc('square', 28);
  const lp = v.filter('lowpass', 300, 0.7);
  const depth = v.gain(240);
  lfo.connect(lp); lp.connect(depth); depth.connect(o.frequency);
  o.connect(v.input);
  return v.end;
}

// 24. WARP: a comb-filter portal whoop, noise ringing in a feedback delay whose length shrinks (the pitch climbs)
function combPortal(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 24, level: e.level, attack: 0.005, hold: 0.12, release: 0.22, tail: 0.5, drive: 1.6, lp: 6500, pan: [0.5, -0.5] });
  const s = v.noise(at, v.r() * 0.2);
  const burst = v.gain(0);
  v.hit(burst, at, 1, 0.004, 0.03);
  s.connect(burst);
  const pre = v.filter('bandpass', 900, 0.9);
  const d = v.delay(1 / 110, 0.05);
  set(d.delayTime, 1 / 110, at); exp(d.delayTime, 1 / 320, at + 0.34);
  const fb = v.gain(0.86);
  burst.connect(pre); pre.connect(d); d.connect(fb); fb.connect(d);
  d.connect(v.input);
  return v.end;
}

// 25. ACID: a rubber squelch, a driven sine wobbling at 13 Hz through a resonant lowpass that closes (a boing)
function rubberSquelch(ctx, at, dest, opts, e) {
  const v = voice(ctx, at, dest, opts, { salt: 25, level: e.level, attack: 0.005, hold: 0.06, release: 0.2, tail: 0.5, drive: 3, lp: 5000, pan: [-0.2, 0.2] });
  const o = v.osc('triangle', 210);
  const wob = v.osc('sine', 13);
  const wd = v.gain(70);
  set(wd.gain, 70, at); exp(wd.gain, 4, at + 0.28);
  wob.connect(wd); wd.connect(o.frequency);
  const sh = v.shaper(4);
  const f = v.filter('lowpass', 3600, 14);
  set(f.frequency, 3600, at); exp(f.frequency, 240, at + 0.26);
  o.connect(sh); sh.connect(f); f.connect(v.input);
  return v.end;
}

// id, name, kind, the render function, the envelope peak (calibrated), the recipe
const TABLE = [
  ['psy-acid-squelch-snap', 'acid squelch, one snapping note', 'acid', acidSquelch, 0.11, 'a saw at 216 Hz through a fixed 2.4 kHz lowpass, then a lowpass at Q 20 whose cutoff snaps 320 Hz to 3.6 kHz in 6 ms and falls back, soft-clipped'],
  ['psy-acid-octave-slide', 'acid slide up an octave, accented', 'acid', acidSlide, 0.11, 'a square stepping up an octave with a 50 ms glide; the resonant cutoff retriggers higher on the accented second step'],
  ['psy-acid-double-wah', 'acid wah, the filter opening and closing twice', 'acid', acidWah, 0.11, 'one saw note under a Q 12 lowpass swept 180 Hz to 1.9 kHz and back, then to 2.3 kHz and back, over 0.47 s'],
  ['psy-acid-high-scream', 'acid scream, a short high resonance', 'acid', acidChirpHigh, 0.11, 'a square at 324 Hz through a Q 18 lowpass snapping to 4.2 kHz and falling in 0.1 s'],
  ['psy-laser-zap-fm', 'laser zap with an FM wobble', 'laser', laserZap, 0.11, 'a sine falling exponentially 2.6 kHz to 140 Hz in 0.14 s, its frequency modulated by a 37 Hz sine at 220 Hz depth'],
  ['psy-laser-triple-burst', 'three falling laser shots', 'laser', laserTriple, 0.11, 'three triangle zaps 65 ms apart from 1.9, 1.5 and 1.15 kHz each falling to 110 Hz, panned left to right'],
  ['psy-laser-ricochet-pan', 'laser ricochet across the stereo field', 'laser', laserRicochet, 0.11, 'a sine up to 3.2 kHz in 50 ms then down to 600 Hz with a quiet partial at 1.5 times, panned hard left to right'],
  ['psy-ring-mod-zap', 'ring-modulated metallic zap', 'laser', ringZap, 0.11, 'a triangle falling 1.4 kHz to 300 Hz multiplied by a 90 Hz sine (a gain whose gain is the sine)'],
  ['psy-resonant-noise-riser', 'resonant noise riser', 'sweep', resonantRiser, 0.11, 'seeded white noise through a Q 14 band-pass climbing 250 Hz to 5 kHz over 0.42 s, soft-clipped'],
  ['psy-noise-downlifter', 'noise downlifter falling away', 'sweep', noiseDownlifter, 0.11, 'noise through a Q 7 high-pass and a soft band-pass both falling to about 200 to 300 Hz over 0.36 s'],
  ['psy-formant-yoi', 'talking filter, a yoi', 'sweep', formantYoi, 0.11, 'a saw rising 288 to 385 Hz through two band-pass formants moving from about 600 and 900 Hz to 300 and 2300 Hz'],
  ['psy-tape-stop-chord', 'tape stop on a minor chord', 'tapestop', tapeStop, 0.11, 'three saws (a minor triad) held for 0.15 s, then falling to a twelfth of their pitch in 0.25 s while a lowpass closes 2.3 kHz to 120 Hz'],
  ['psy-warp-fm-dive', 'warp dive into a gravity well', 'warp', warpDive, 0.11, 'a sine carrier 640 to 45 Hz modulated by a sine 905 to 64 Hz whose depth grows 40 to 700 Hz'],
  ['psy-flanger-warp-rise', 'flanger jet rising', 'warp', flangerWarpRise, 0.11, 'a rising saw plus noise through a feedback delay (gain 0.72) swept 9 ms to 3.2 ms, mixed with the dry'],
  ['psy-fm-chirp-fifth', 'FM chirp climbing a fifth', 'fm', fmChirp, 0.11, 'a sine at 864 Hz gliding up a fifth, modulated at twice its pitch with an index collapsing from 2.6 kHz in 90 ms'],
  ['psy-fm-alien-bell', 'inharmonic FM bell blip', 'fm', fmMetalBlip, 0.11, 'a sine at 1040 Hz modulated at the ratio 3.73 with a depth decaying 1.8 kHz to 30 Hz in 0.18 s'],
  ['psy-fm-reactor-gurgle', 'reactor gurgle', 'fm', fmGurgle, 0.11, 'a sine rising 520 to 980 Hz, modulated 380 Hz deep by a triangle sweeping 20 to 180 Hz, chopped by a 23 Hz tremolo, driven hard'],
  ['psy-rolling-bass-kbbb', 'rolling psy bass, kick and three bass notes', 'psy', rollingKick, 0.11, 'a sine kick 170 to 52 Hz then three off-beat filtered saw sixteenths at 54 Hz, 145 BPM, driven'],
  ['psy-goa-phrygian-arp', 'Goa arpeggio in Phrygian', 'psy', goaArp, 0.11, 'one saw stepping A, B flat, E, A in 52 ms steps with a resonant filter blip per step'],
  ['psy-trance-stab-double', 'trance stab struck twice', 'psy', gatedStab, 0.11, 'four detuned saws in a minor chord with its octave, ceilinged at 2.4 kHz, high-passed at 500 Hz, struck twice a sixteenth apart at 145 BPM'],
  ['psy-dub-delay-ping', 'dub delay ping', 'psy', dubDelayPing, 0.11, 'a short FM blip into a 90 ms feedback delay (gain 0.55) with a 2.6 kHz lowpass in the loop'],
  ['psy-phaser-pump-pad', 'pumping phaser pad, swelling twice', 'psy', phaserSwoosh, 0.11, 'three saws in a minor chord through four all-pass stages swept 800 Hz deep by a 6 Hz sine, its level pumped up from zero twice on eighth notes at 145 BPM'],
  ['psy-scanner-trill', 'sci-fi scanner trill', 'scifi', scannerBeep, 0.11, 'a sine at 1.7 kHz trilled 240 Hz deep by a 28 Hz square smoothed through a 300 Hz lowpass'],
  ['psy-comb-portal-whoop', 'comb filter portal whoop', 'warp', combPortal, 0.11, 'a 30 ms noise burst ringing in a feedback delay (gain 0.86) shrinking 9.1 ms to 3.1 ms, so the ring climbs 110 to 320 Hz'],
  ['psy-rubber-boing-squelch', 'rubber boing squelch', 'acid', rubberSquelch, 0.11, 'a triangle wobbling at 13 Hz, hard soft-clipped, through a Q 14 lowpass closing 3.6 kHz to 240 Hz'],
];

// THE LEVELS: each sound's envelope peak, calibrated in Chromium so it lands near the aim (tools/sfx_measure.py)
const LEVELS = {
  'psy-acid-squelch-snap': 0.1139,
  'psy-acid-octave-slide': 0.0849,
  'psy-acid-double-wah': 0.0921,
  'psy-acid-high-scream': 0.0839,
  'psy-laser-zap-fm': 0.1002,
  'psy-laser-triple-burst': 0.1066,
  'psy-laser-ricochet-pan': 0.077,
  'psy-ring-mod-zap': 0.1124,
  'psy-resonant-noise-riser': 0.3427,
  'psy-noise-downlifter': 0.0797,
  'psy-formant-yoi': 0.201,
  'psy-tape-stop-chord': 0.0944,
  'psy-warp-fm-dive': 0.0787,
  'psy-flanger-warp-rise': 0.0935,
  'psy-fm-chirp-fifth': 0.1057,
  'psy-fm-alien-bell': 0.1039,
  'psy-fm-reactor-gurgle': 0.1131,
  'psy-rolling-bass-kbbb': 0.0963,
  'psy-goa-phrygian-arp': 0.0917,
  'psy-trance-stab-double': 0.1038,
  'psy-dub-delay-ping': 0.0941,
  'psy-phaser-pump-pad': 0.0892,
  'psy-scanner-trill': 0.0802,
  'psy-comb-portal-whoop': 0.1439,
  'psy-rubber-boing-squelch': 0.0686,
};

// THE STATED LENGTH: render once into a silent stub context that only records, and read the returned end time, so
// `dur` is always the envelope's own length and can never drift from the code
function stubCtx() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = () => new Proxy({ connect: (n) => n, disconnect() {}, start() {}, stop() {}, getChannelData: () => new Float32Array(1) }, {
    get(o, k) { if (!(k in o)) o[k] = typeof k === 'string' && /^[A-Za-z]/.test(k) && k !== 'then' ? param() : undefined; return o[k]; },
    set(o, k, v) { o[k] = v; return true; },
  });
  return { sampleRate: 48000, currentTime: 0, createBuffer: () => ({ getChannelData: () => new Float32Array(1) }), createGain: node, createOscillator: node, createBiquadFilter: node, createWaveShaper: node, createBufferSource: node, createDelay: node, createStereoPanner: node };
}

export const RADIAL_PSY = Object.freeze(TABLE.map(([id, name, kind, fn, level, recipe], i) => {
  const lv = LEVELS[id] ?? level;
  const entry = {
    id,
    name,
    kind,
    deck: 'radial',
    lane: 'PSYRADIAL',
    dur: 0,
    level: lv,
    airy: false,
    provenance: PROV(recipe),
    render(ctx, at, dest, opts = {}) {
      return fn(ctx, fin(at, ctx.currentTime), dest, opts, entry);
    },
  };
  entry.dur = Math.round(fn(stubCtx(), 0, null, { strength: 1, seed: 1 }, entry) * 1000) / 1000;
  return Object.freeze(entry);
}));
