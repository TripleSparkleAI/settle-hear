// settle-hear · sfx-sword-hit - THE ANIME HITS: 25 sword-deck sounds in the manner of anime and fighting-game action
// (parry clangs, ki charges, dashes, impacts, hits, specials, releases, teleport blinks and round cues), built here
// from oscillators, noise and filters, hyper and lightly distorted, at the click noises' level (lane ANIMEHIT,
// navigator 2026-10-05). Nothing is sampled; no audio from any game, anime or film.
//
// <claudes_code_comments>
// ** Function List **
// SWORD_HIT                      - the 25 entries { id, name, kind, deck, lane, dur, provenance, render }, frozen
// rng(seed)                      - a seeded mulberry32 generator: every variation comes from opts.seed
// rig(ctx, at, dest, opts, o)    - one sound's output chain: pre-gain -> shaper -> two lowpasses -> highpass -> level
//                                  (with the sound's TRIM) -> pan -> dest; R.hold(until) keeps an echo tail alive
// env(R, t, e)                   - a gain envelope from 0 to 0: attack >= 4 ms, decay, release >= 60 ms
// tone(R, t, o)                  - an oscillator with a pitch path into an envelope; saw and square pass a lowpass
// hiss(R, t, o)                  - seeded noise through a filter (with an optional sweep) into an envelope
// metal(R, t, f, ratios, o)      - inharmonic partials for a clang or a bell
// curves                         - the shaper curves: soft (tanh), fold (sine fold), crush (quantise blended with
//                                  tanh, so a quiet tail never gates to silence), hard
// TRIM                           - the level trim per sound in dB, measured with tests/offline.mjs
//
// ** Technical Review **
// - THE FORMAT (SETTLE/runs/animesfx/CHANNEL.md, ruled by SWORDSWISH): render(ctx, at, dest, { strength, seed })
//   builds every node from ctx, schedules from `at`, plays into `dest`, returns its end time and disconnects its
//   nodes when its last source ends. It never touches the engine, a channel, the limiter or the window.
// - THE ANATOMY OF A FIGHTING-GAME HIT, which every 'hit' and 'impact' here follows: a transient (a 4 ms noise burst
//   high in the band), a pitched body that drops fast (a sine or triangle sliding down an octave or two in 30 to
//   90 ms), a noise tail low-passed, and for the heavy ones a sub thump under 80 Hz. A clang is inharmonic partials
//   (the ratios of a struck bar or plate) with a bright strike; a charge rises in pitch and filter with a quickening
//   tremolo; a dash is band-passed noise sweeping in centre and pan.
// - HYPER, SUBTLY: each sound's chain is pushed by a pre-gain of 5 into a waveshaper (tanh soft clip, a sine fold,
//   a hard clip or a quantiser), so the shaper really bends it, then TWO lowpasses at <= 8 kHz (the 9 kHz rule, and the top-end share under tick high's 0.019), then a
//   40 Hz highpass that removes any DC a fold leaves. Raw saw and square go first through a lowpass at <= 2.4 kHz.
// - THE TONE RULES (clicks.js CLICK_TONE): every envelope ramps from 0 and back to 0, attack at least 4 ms and release
//   at least 60 ms. Levels sit near the clicks' median (peak about -20 dBFS); the cap is the loudest click.
// - VARIATION: opts.seed moves pitch by up to 3 % and pan by up to 0.15, and seeds the noise, so a repeated card
//   sounds a little different; the same seed renders the same samples.
// </claudes_code_comments>

const LANE = 'ANIMEHIT';
const MADE = '2026-10-05';
const A4 = 432; // pitched sounds sit on A = 432, as the click noises do
const hz = (semis) => A4 * Math.pow(2, semis / 12);

export function rng(seed = 1) {
  let a = (seed | 0) ^ 0x2545f491;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CURVE_N = 2048;
const makeCurve = (fn) => { const c = new Float32Array(CURVE_N); for (let i = 0; i < CURVE_N; i++) c[i] = fn((i / (CURVE_N - 1)) * 2 - 1); return c; };
export const curves = {
  soft: (k) => makeCurve((x) => Math.tanh(k * x) / Math.tanh(k)),
  fold: (k) => makeCurve((x) => Math.sin((Math.PI / 2) * k * x) * 0.9),
  // a quantiser blended with a soft clip, so a quiet tail keeps a little signal instead of gating to silence
  crush: (steps) => makeCurve((x) => 0.55 * Math.round(Math.tanh(1.5 * x) * steps) / steps + 0.45 * Math.tanh(1.5 * x)),
  hard: (k) => makeCurve((x) => Math.max(-0.8, Math.min(0.8, k * x))),
};

const ATTACK_MIN = 0.004;
const RELEASE_MIN = 0.06;
const TOP = 7800; // the two final lowpasses: under the 9 kHz rule, and they keep the top end soft

// one sound's output chain; every voice connects to R.bus
function rig(ctx, at, dest, opts = {}, { drive = null, pre = 5, top = TOP, level = 1, pan = 0, width = 0.15 } = {}) {
  const trim = Number.isFinite(opts.trim) ? opts.trim : 0;
  const strength = Math.min(1, Math.max(0.15, Number.isFinite(opts.strength) ? opts.strength : 1));
  const rand = rng(Number.isInteger(opts.seed) ? opts.seed : 1);
  const nodes = [];
  const keep = (n) => { nodes.push(n); return n; };
  const bus = keep(ctx.createGain());
  let head = bus;
  if (drive) {
    // the drive: a pre-gain pushes the voices (each peaking near 0.1) into the curve, so the shaper really bends them
    const g = keep(ctx.createGain());
    g.gain.value = pre;
    const sh = keep(ctx.createWaveShaper());
    sh.curve = drive;
    sh.oversample = '2x';
    head.connect(g);
    g.connect(sh);
    head = sh;
  }
  for (let i = 0; i < 2; i++) {
    const lp = keep(ctx.createBiquadFilter());
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(8000, top);
    lp.Q.value = 0;
    head.connect(lp);
    head = lp;
  }
  const hp = keep(ctx.createBiquadFilter());
  hp.type = 'highpass';
  hp.frequency.value = 40;
  hp.Q.value = 0;
  head.connect(hp);
  const out = keep(ctx.createGain());
  out.gain.value = level * Math.pow(10, trim / 20) * strength;
  hp.connect(out);
  let tail = out;
  if (ctx.createStereoPanner) {
    const p = keep(ctx.createStereoPanner());
    p.pan.value = Math.max(-1, Math.min(1, pan + (rand() * 2 - 1) * width));
    out.connect(p);
    tail = p;
  }
  tail.connect(dest);
  let live = 0;
  const R = {
    ctx, at, bus, rand, keep,
    detune: 1 + (rand() * 2 - 1) * 0.03,
    seed: Number.isInteger(opts.seed) ? opts.seed : 1,
    end: at,
    // a silent source that keeps the sound alive until `until`, for a tail (an echo) that outlasts its voices
    hold(until) {
      let k;
      if (ctx.createConstantSource) {
        k = keep(ctx.createConstantSource());
        k.offset.value = 0;
      } else { // a context without ConstantSource (an old browser, a test fake): an oscillator into a silent gain
        k = keep(ctx.createOscillator());
        const z = keep(ctx.createGain());
        z.gain.value = 0;
        k.connect(z);
      }
      k.start(at);
      k.stop(until);
      return R.source(k, until);
    },
    source(s, stopAt) {
      live++;
      R.end = Math.max(R.end, stopAt);
      s.onended = () => { if (--live === 0) for (const n of nodes) { try { n.disconnect(); } catch { /* gone */ } } };
      return s;
    },
  };
  return R;
}

// a gain envelope from zero to zero: attack, hold, an exponential decay to `floor` x peak, then a linear release
function env(R, t, { attack = ATTACK_MIN, peak = 0.1, hold = 0, decay = 0.1, floor = 0.05, release = RELEASE_MIN } = {}) {
  const g = R.keep(R.ctx.createGain());
  const a = Math.max(ATTACK_MIN, attack);
  const r = Math.max(RELEASE_MIN, release);
  const p = Math.max(1e-4, peak);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(p, t + a);
  if (hold > 0) g.gain.setValueAtTime(p, t + a + hold);
  g.gain.exponentialRampToValueAtTime(Math.max(1e-5, p * floor), t + a + hold + Math.max(0.005, decay));
  const end = t + a + hold + Math.max(0.005, decay) + r;
  g.gain.linearRampToValueAtTime(0, end);
  g.connect(R.bus);
  return { node: g, end };
}

// an oscillator with a pitch path: f0 to f1 over `glide` (exponential), optional vibrato or FM
function tone(R, t, { type = 'sine', f0 = 440, f1, glide = 0.05, cutoff = 2000, vib = 0, vibHz = 6, fm = 0, fmRatio = 1, into, ...e } = {}) {
  const c = R.ctx;
  const E = into ? { node: into, end: t + (e.len ?? 0.3) } : env(R, t, e);
  const o = R.keep(c.createOscillator());
  o.type = type;
  const k = R.detune;
  o.frequency.setValueAtTime(f0 * k, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1 * k), t + Math.max(0.01, glide));
  if (vib > 0 || fm > 0) {
    const m = R.keep(c.createOscillator());
    m.frequency.value = fm > 0 ? f0 * k * fmRatio : vibHz;
    const d = R.keep(c.createGain());
    d.gain.value = fm > 0 ? fm : vib;
    m.connect(d);
    d.connect(o.frequency);
    m.start(t);
    m.stop(E.end + 0.02);
    R.source(m, E.end + 0.02);
  }
  let src = o;
  if (type === 'square' || type === 'sawtooth') {
    const lp = R.keep(c.createBiquadFilter());
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(2400, cutoff);
    o.connect(lp);
    src = lp;
  }
  src.connect(E.node);
  o.start(t);
  o.stop(E.end + 0.02);
  R.source(o, E.end + 0.02);
  return E.end;
}

// seeded noise through a filter whose centre may sweep, into an envelope
function hiss(R, t, { type = 'bandpass', f = 2000, f1, sweep = 0.1, q = 1, into, ...e } = {}) {
  const c = R.ctx;
  const E = into ? { node: into, end: t + (e.len ?? 0.3) } : env(R, t, e);
  const len = Math.max(0.05, E.end - t + 0.05);
  const n = Math.round(c.sampleRate * len);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  const r = rng(R.seed * 7919 + Math.round(f));
  for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
  const s = R.keep(c.createBufferSource());
  s.buffer = buf;
  const bp = R.keep(c.createBiquadFilter());
  bp.type = type;
  bp.frequency.setValueAtTime(f, t);
  if (f1 && f1 !== f) bp.frequency.exponentialRampToValueAtTime(f1, t + Math.max(0.01, sweep));
  bp.Q.value = q;
  s.connect(bp);
  bp.connect(E.node);
  s.start(t);
  s.stop(E.end + 0.02);
  R.source(s, E.end + 0.02);
  return E.end;
}

// inharmonic partials, each decaying faster the higher it sits
function metal(R, t, f, ratios, { peak = 0.05, decay = 0.4, fall = 0.6, type = 'sine' } = {}) {
  let end = t;
  ratios.forEach((k, i) => {
    end = Math.max(end, tone(R, t, { type, f0: f * k, peak: peak * Math.pow(fall, i), decay: decay / (1 + 0.7 * i), floor: 0.02 }));
  });
  return end;
}

// THE LEVEL TRIM in dB per sound, measured with tests/offline.mjs at strength 1, seed 1: it brings each sound to the
// lane's aim (hits and impacts near peak -18.5 / rms50 -25 dBFS, the rest near -20 / -26.5), under the loudest click
// noise (-15.5 / -22.8). Re-measure with tests/sfx.test.mjs after changing any sound.
const TRIM = Object.freeze({'light-jab': -14.8, 'heavy-smash': -16, 'counter-flash': -11.4, 'combo-triple': -14.2, 'guard-crush': -10.6, 'parry-ring': -15.9, 'parry-perfect': -12.8, 'blade-lock': -13.1, 'ki-charge': -15.3, 'ki-spark': -13.6, 'dash-step': -12.8, 'air-zip': -11.3, 'afterimage': -11.8, 'ground-slam': -18.6, 'wall-bounce': -11.3, 'energy-ball': -16.1, 'rising-uppercut': -11.7, 'super-flash': -13.7, 'energy-beam': -17.3, 'shockwave': -13.7, 'teleport-in': -11.3, 'teleport-out': -9.5, 'knockout-toll': -17.8, 'round-start': -11.9, 'eyecatch-shine': 5.1});

const prov = (recipe) => Object.freeze({ method: 'procedural', made: MADE, recipe });
const entry = (id, name, kind, dur, recipe, render, extra = {}) => Object.freeze({
  id: `hit-${id}`, name, kind, deck: 'sword', lane: LANE, dur, provenance: prov(recipe),
  render: (ctx, at, dest, opts = {}) => render(ctx, at, dest, { ...opts, trim: TRIM[id] ?? 0 }),
  ...extra,
});

// THE TWENTY-FIVE. kind: hit · impact · clang · charge · dash · special · release · blink · cue
export const SWORD_HIT = Object.freeze([
  entry('light-jab', 'light jab', 'hit', 0.2,
    'a 4 ms noise snap at 3.2 kHz, a sine body dropping 260 to 95 Hz in 40 ms, soft tanh drive',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(2), level: 0.9 });
      hiss(R, at, { f: 3200, q: 1.2, peak: 0.06, decay: 0.012, release: 0.06 });
      tone(R, at, { f0: 260, f1: 95, glide: 0.04, peak: 0.12, decay: 0.07, release: 0.06 });
      return R.end;
    }),
  entry('heavy-smash', 'heavy smash', 'hit', 0.42,
    'a sub thump 120 to 42 Hz, a low noise crunch closing 1.6 kHz to 300 Hz, a sine fold for grit',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.fold(1.6), level: 0.75, top: 5000 });
      tone(R, at, { f0: 120, f1: 42, glide: 0.12, peak: 0.13, decay: 0.22, release: 0.12 });
      hiss(R, at, { type: 'lowpass', f: 1600, f1: 300, sweep: 0.2, q: 2, peak: 0.08, decay: 0.2, release: 0.08 });
      hiss(R, at, { f: 2600, q: 1, peak: 0.04, decay: 0.015, release: 0.06 });
      return R.end;
    }),
  entry('counter-flash', 'counter hit flash', 'hit', 0.28,
    'a mid hit (triangle 330 to 110 Hz) with a bright counter ping rising 1.3 to 2.6 kHz 35 ms later',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(1.6), level: 0.8 });
      hiss(R, at, { f: 2400, q: 1.4, peak: 0.05, decay: 0.012, release: 0.06 });
      tone(R, at, { type: 'triangle', f0: 330, f1: 110, glide: 0.05, peak: 0.1, decay: 0.06, release: 0.06 });
      tone(R, at + 0.035, { f0: hz(17), f1: hz(29), glide: 0.05, peak: 0.045, decay: 0.12, release: 0.08 });
      return R.end;
    }),
  entry('combo-triple', 'three-hit combo', 'hit', 0.36,
    'three hits 75 ms apart, each body a semitone pair higher and a little quieter, a combo counter',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(2.2), level: 0.85, width: 0.3 });
      [0, 1, 2].forEach((i) => {
        const t = at + i * 0.075;
        const k = Math.pow(2, (i * 3) / 12);
        hiss(R, t, { f: 2800 * k, q: 1.5, peak: 0.045 * (1 - i * 0.15), decay: 0.01, release: 0.06 });
        tone(R, t, { f0: 300 * k, f1: 120 * k, glide: 0.035, peak: 0.1 * (1 - i * 0.12), decay: 0.04, release: 0.06 });
      });
      return R.end;
    }),
  entry('guard-crush', 'guard crush', 'hit', 0.45,
    'a crushed (quantised) noise burst at 1.3 kHz over a low square body at 82 Hz, and 9 shard ticks scattered 2.2 to 5.2 kHz',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.crush(6), level: 0.55, top: 6000 });
      hiss(R, at, { f: 1300, q: 1.5, peak: 0.08, decay: 0.05, release: 0.07 });
      tone(R, at, { type: 'square', f0: 82, f1: 62, glide: 0.2, cutoff: 900, peak: 0.07, decay: 0.12, release: 0.08 });
      for (let i = 0; i < 9; i++) {
        const t = at + 0.02 + R.rand() * 0.25;
        hiss(R, t, { f: 2200 + R.rand() * 3000, q: 9, peak: 0.07, decay: 0.008, release: 0.06 });
      }
      return R.end;
    }),
  entry('parry-ring', 'parry clang', 'clang', 0.55,
    'a bright 5 ms strike over inharmonic bar partials on 620 Hz (1, 2.76, 5.40, 8.93), fast metal decay',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(1.4), level: 0.85 });
      hiss(R, at, { type: 'highpass', f: 3000, q: 0.7, peak: 0.04, decay: 0.01, release: 0.06 });
      metal(R, at, 620, [1, 2.76, 5.4, 8.93], { peak: 0.07, decay: 0.45 });
      return R.end;
    }),
  entry('parry-perfect', 'perfect parry', 'clang', 0.62,
    'a just-in-time defend: a high ping at 1.73 kHz beside a twin 7 Hz off, a fifth above, and a quick tick',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(1.2), level: 0.9, width: 0.05 });
      hiss(R, at, { f: 4500, q: 2, peak: 0.03, decay: 0.008, release: 0.06 });
      tone(R, at, { f0: hz(24), peak: 0.045, decay: 0.45, floor: 0.02, release: 0.1 });
      tone(R, at, { f0: hz(24) + 7, peak: 0.045, decay: 0.45, floor: 0.02, release: 0.1 });
      tone(R, at + 0.02, { f0: hz(31), peak: 0.025, decay: 0.3, floor: 0.02, release: 0.08 });
      return R.end;
    }),
  entry('blade-lock', 'blade lock', 'clang', 0.5,
    'two clangs on 410 Hz partials, then a grinding rub: band-passed noise gated by a 32 Hz square',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(2), level: 0.75 });
      metal(R, at, 410, [1, 2.4, 3.9, 6.2], { peak: 0.05, decay: 0.25 });
      metal(R, at + 0.04, 455, [1, 2.4, 3.9], { peak: 0.035, decay: 0.2 });
      const c = R.ctx;
      const gate = R.keep(c.createGain());
      gate.gain.value = 0.5;
      const lfo = R.keep(c.createOscillator());
      lfo.type = 'square';
      lfo.frequency.value = 32;
      const lfoLp = R.keep(c.createBiquadFilter());
      lfoLp.type = 'lowpass';
      lfoLp.frequency.value = 400;
      const depth = R.keep(c.createGain());
      depth.gain.value = 0.5;
      lfo.connect(lfoLp); lfoLp.connect(depth); depth.connect(gate.gain);
      const E = env(R, at + 0.07, { attack: 0.03, peak: 0.07, hold: 0.12, decay: 0.12, release: 0.08 });
      gate.connect(E.node);
      hiss(R, at + 0.07, { f: 1800, f1: 1200, sweep: 0.3, q: 3, into: gate, len: E.end - at - 0.07 });
      lfo.start(at + 0.07);
      lfo.stop(E.end + 0.02);
      R.source(lfo, E.end + 0.02);
      return R.end;
    }),
  entry('ki-charge', 'ki charge', 'charge', 1.05,
    'a saw rising 110 to 440 Hz through a lowpass opening 300 Hz to 2.2 kHz, tremolo quickening 6 to 20 Hz, a light fold',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.fold(1.3), level: 0.8, width: 0.05 });
      const c = R.ctx;
      const trem = R.keep(c.createGain());
      trem.gain.value = 0.6;
      const lfo = R.keep(c.createOscillator());
      lfo.frequency.setValueAtTime(6, at);
      lfo.frequency.exponentialRampToValueAtTime(20, at + 0.9);
      const d = R.keep(c.createGain());
      d.gain.value = 0.4;
      lfo.connect(d); d.connect(trem.gain);
      const E = env(R, at, { attack: 0.6, peak: 0.08, hold: 0.25, decay: 0.03, floor: 0.5, release: 0.08 });
      trem.connect(E.node);
      const o = R.keep(c.createOscillator());
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(110 * R.detune, at);
      o.frequency.exponentialRampToValueAtTime(440 * R.detune, at + 0.9);
      const lp = R.keep(c.createBiquadFilter());
      lp.type = 'lowpass';
      lp.Q.value = 6;
      lp.frequency.setValueAtTime(300, at);
      lp.frequency.exponentialRampToValueAtTime(2200, at + 0.9);
      o.connect(lp); lp.connect(trem);
      for (const s of [o, lfo]) { s.start(at); s.stop(E.end + 0.02); R.source(s, E.end + 0.02); }
      hiss(R, at, { f: 900, f1: 4000, sweep: 0.9, q: 2, attack: 0.7, peak: 0.025, hold: 0.15, decay: 0.03, floor: 0.5, release: 0.08 });
      return R.end;
    }),
  entry('ki-spark', 'ki spark', 'charge', 0.45,
    'a short power-up: a sine whine 600 to 1800 Hz with a 30 Hz vibrato, a rising hiss, then a soft pop',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(1.8), level: 0.85 });
      tone(R, at, { f0: 600, f1: 1800, glide: 0.3, vib: 25, vibHz: 30, attack: 0.25, peak: 0.05, hold: 0.04, decay: 0.03, floor: 0.3, release: 0.06 });
      hiss(R, at, { f: 1500, f1: 5000, sweep: 0.3, q: 2, attack: 0.28, peak: 0.03, decay: 0.03, floor: 0.3, release: 0.06 });
      tone(R, at + 0.33, { f0: 200, f1: 80, glide: 0.04, peak: 0.08, decay: 0.04, release: 0.06 });
      return R.end;
    }),
  entry('dash-step', 'dash step', 'dash', 0.26,
    'band-passed noise swept 600 Hz to 3.4 kHz in 120 ms, a low step thump, panned across',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(1.5), level: 1, pan: -0.25 });
      hiss(R, at, { f: 600, f1: 3400, sweep: 0.12, q: 2.5, attack: 0.03, peak: 0.07, decay: 0.12, release: 0.06 });
      tone(R, at, { f0: 140, f1: 60, glide: 0.05, peak: 0.07, decay: 0.04, release: 0.06 });
      return R.end;
    }),
  entry('air-zip', 'air zip', 'dash', 0.18,
    'a fast sine zip 2.1 kHz down to 380 Hz in 60 ms with a thin noise trail',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(1.3), level: 1, pan: 0.2 });
      tone(R, at, { f0: 2100, f1: 380, glide: 0.06, peak: 0.06, decay: 0.05, release: 0.06 });
      hiss(R, at, { f: 3000, f1: 900, sweep: 0.07, q: 3, peak: 0.035, decay: 0.06, release: 0.06 });
      return R.end;
    }),
  entry('afterimage', 'afterimage dash', 'dash', 0.6,
    'a short zip echoed by a 95 ms delay feeding back at 0.5, each echo darker, the echoes faded out by 0.58 s',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(1.5), level: 1, width: 0.1 });
      const c = R.ctx;
      const dry = R.keep(c.createGain());
      dry.connect(R.bus);
      const dl = R.keep(c.createDelay(0.5));
      dl.delayTime.value = 0.095;
      const fb = R.keep(c.createGain());
      fb.gain.value = 0.5;
      const dark = R.keep(c.createBiquadFilter());
      dark.type = 'lowpass';
      dark.frequency.value = 2200;
      const fade = R.keep(c.createGain());
      fade.gain.setValueAtTime(1, at);
      fade.gain.setValueAtTime(1, at + 0.4);
      fade.gain.linearRampToValueAtTime(0, at + 0.58);
      dry.connect(dl); dl.connect(dark); dark.connect(fb); fb.connect(dl); dark.connect(fade); fade.connect(R.bus);
      const sub = { ...R, bus: dry };
      tone(sub, at, { f0: 1500, f1: 500, glide: 0.05, peak: 0.055, decay: 0.04, release: 0.06 });
      hiss(sub, at, { f: 2500, f1: 1200, sweep: 0.05, q: 2, peak: 0.03, decay: 0.04, release: 0.06 });
      R.hold(at + 0.6);
      return R.end;
    }),
  entry('ground-slam', 'ground slam', 'impact', 0.7,
    'a deep boom 75 to 34 Hz, a rumble of lowpassed noise at 380 Hz, a dirt crack at 1.4 kHz, hard-ish fold',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.fold(1.8), level: 0.8, top: 4000, width: 0.05 });
      tone(R, at, { f0: 75, f1: 34, glide: 0.25, peak: 0.16, decay: 0.4, floor: 0.08, release: 0.15 });
      hiss(R, at, { type: 'lowpass', f: 380, q: 1, peak: 0.12, decay: 0.45, floor: 0.05, release: 0.12 });
      hiss(R, at, { f: 1400, q: 1.5, peak: 0.06, decay: 0.03, release: 0.06 });
      return R.end;
    }),
  entry('wall-bounce', 'wall bounce', 'impact', 0.55,
    'a thud, then a springy boing: a sine on 300 Hz whose 11 Hz vibrato fades from 70 Hz deep to nothing',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(1.6), level: 0.85 });
      tone(R, at, { f0: 160, f1: 70, glide: 0.04, peak: 0.09, decay: 0.05, release: 0.06 });
      hiss(R, at, { type: 'lowpass', f: 900, q: 1, peak: 0.05, decay: 0.03, release: 0.06 });
      const c = R.ctx;
      const t = at + 0.05;
      const E = env(R, t, { attack: 0.01, peak: 0.07, decay: 0.38, floor: 0.04, release: 0.08 });
      const o = R.keep(c.createOscillator());
      o.frequency.value = 300 * R.detune;
      const m = R.keep(c.createOscillator());
      m.frequency.value = 11;
      const d = R.keep(c.createGain());
      d.gain.setValueAtTime(70, t);
      d.gain.exponentialRampToValueAtTime(2, t + 0.4);
      m.connect(d); d.connect(o.frequency); o.connect(E.node);
      for (const s of [o, m]) { s.start(t); s.stop(E.end + 0.02); R.source(s, E.end + 0.02); }
      return R.end;
    }),
  entry('energy-ball', 'energy ball', 'special', 0.7,
    'a swell of FM growl (180 Hz carrier, ratio 1.5) rising for 0.3 s, released as a triangle boom 240 to 90 Hz and a crackle of 9 short ticks',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(2.5), level: 0.75 });
      tone(R, at, { f0: 180, f1: 300, glide: 0.28, fm: 160, fmRatio: 1.5, attack: 0.26, peak: 0.08, hold: 0.03, decay: 0.03, floor: 0.4, release: 0.06 });
      const t = at + 0.3;
      tone(R, t, { type: 'triangle', f0: 240, f1: 90, glide: 0.2, peak: 0.09, decay: 0.28, floor: 0.04, release: 0.08 });
      for (let i = 0; i < 9; i++) {
        const tt = t + 0.01 + R.rand() * 0.3;
        hiss(R, tt, { f: 900 + R.rand() * 2500, q: 10, peak: 0.05 * (1 - i / 12), decay: 0.006, release: 0.06 });
      }
      return R.end;
    }),
  entry('rising-uppercut', 'rising uppercut', 'special', 0.4,
    'a square lowpassed at 1.8 kHz sweeping 200 to 1.2 kHz with a noise rise, a hit on top and a crushed edge',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.crush(9), level: 0.7, top: 6500 });
      hiss(R, at, { f: 2600, q: 1.2, peak: 0.05, decay: 0.012, release: 0.06 });
      tone(R, at, { f0: 280, f1: 110, glide: 0.035, peak: 0.1, decay: 0.04, release: 0.06 });
      tone(R, at + 0.02, { type: 'square', f0: 200, f1: 1200, glide: 0.25, cutoff: 1800, attack: 0.02, peak: 0.05, decay: 0.25, floor: 0.2, release: 0.07 });
      hiss(R, at + 0.02, { f: 700, f1: 4000, sweep: 0.25, q: 2, attack: 0.04, peak: 0.035, decay: 0.24, floor: 0.2, release: 0.07 });
      return R.end;
    }),
  entry('super-flash', 'super flash', 'special', 0.85,
    'the freeze before a super: a swelling stab of three sines on A432 (A, C sharp, E an octave up), a crushed shimmer',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.crush(14), level: 0.85, width: 0.05 });
      [12, 16, 19, 24].forEach((s, i) => tone(R, at, { f0: hz(s), vib: 4, vibHz: 5.5, attack: 0.08, peak: 0.03 * (i === 0 ? 1.3 : 1), hold: 0.1, decay: 0.5, floor: 0.03, release: 0.1 }));
      hiss(R, at, { type: 'highpass', f: 3500, q: 0.7, attack: 0.06, peak: 0.012, hold: 0.08, decay: 0.3, floor: 0.05, release: 0.08 });
      return R.end;
    }),
  entry('energy-beam', 'energy beam', 'release', 0.75,
    'a sustained beam: a saw on 220 Hz through a resonant lowpass wobbling at 13 Hz, with a 2 Hz pitch sag',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(2), level: 0.75 });
      const c = R.ctx;
      const E = env(R, at, { attack: 0.03, peak: 0.1, hold: 0.4, decay: 0.15, floor: 0.1, release: 0.1 });
      const o = R.keep(c.createOscillator());
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(220 * R.detune, at);
      o.frequency.linearRampToValueAtTime(200 * R.detune, at + 0.6);
      const lp1 = R.keep(c.createBiquadFilter());
      lp1.type = 'lowpass';
      lp1.frequency.value = 2400;
      const lp2 = R.keep(c.createBiquadFilter());
      lp2.type = 'lowpass';
      lp2.Q.value = 10;
      lp2.frequency.value = 1100;
      const w = R.keep(c.createOscillator());
      w.frequency.value = 13;
      const wd = R.keep(c.createGain());
      wd.gain.value = 500;
      w.connect(wd); wd.connect(lp2.frequency);
      o.connect(lp1); lp1.connect(lp2); lp2.connect(E.node);
      for (const s of [o, w]) { s.start(at); s.stop(E.end + 0.02); R.source(s, E.end + 0.02); }
      return R.end;
    }),
  entry('shockwave', 'shockwave', 'release', 0.6,
    'a falling ring: noise band-passed from 4 kHz to 500 Hz over 0.45 s at Q 6, a soft drop 140 to 70 Hz under it',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.fold(1.4), level: 0.8, width: 0.25 });
      hiss(R, at, { f: 4000, f1: 500, sweep: 0.45, q: 6, attack: 0.008, peak: 0.1, decay: 0.45, floor: 0.08, release: 0.08 });
      tone(R, at, { f0: 140, f1: 70, glide: 0.4, peak: 0.06, decay: 0.3, floor: 0.08, release: 0.08 });
      return R.end;
    }),
  entry('teleport-in', 'teleport in', 'blink', 0.25,
    'an up-chirp 300 Hz to 3 kHz in 80 ms, ring-modulated at 47 Hz, ending on a short high blip',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(1.3), level: 0.95 });
      const c = R.ctx;
      const ring = R.keep(c.createGain());
      ring.gain.value = 0;
      const m = R.keep(c.createOscillator());
      m.frequency.value = 47;
      m.connect(ring.gain);
      const E = env(R, at, { attack: 0.02, peak: 0.08, decay: 0.07, floor: 0.2, release: 0.06 });
      ring.connect(E.node);
      tone(R, at, { f0: 300, f1: 3000, glide: 0.08, into: ring, len: E.end - at });
      m.start(at); m.stop(E.end + 0.02); R.source(m, E.end + 0.02);
      tone(R, at + 0.1, { f0: hz(27), peak: 0.035, decay: 0.03, release: 0.06 });
      return R.end;
    }),
  entry('teleport-out', 'teleport out', 'blink', 0.32,
    'a hollow 3-step down-chirp stutter, 3.2 kHz falling an octave a step, over a thin high hiss closing to 1.5 kHz',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(1.5), level: 0.9, top: 6000 });
      [0, 0.05, 0.1].forEach((dt, i) => {
        const k = Math.pow(0.5, i);
        tone(R, at + dt, { type: 'triangle', f0: 3200 * k, f1: 1600 * k, glide: 0.045, peak: 0.05 * (1 - 0.2 * i), decay: 0.04, release: 0.06 });
      });
      hiss(R, at, { f: 5000, f1: 1500, sweep: 0.15, q: 4, peak: 0.02, decay: 0.12, floor: 0.1, release: 0.06 });
      return R.end;
    }),
  entry('knockout-toll', 'knockout toll', 'cue', 1.3,
    'a round-over toll: low bell partials on 108 Hz (1, 2.0, 2.92, 4.16) ringing a second, a slow sub sigh 54 to 40 Hz',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(1.2), level: 0.9, width: 0.05 });
      metal(R, at, hz(-24), [1, 2.0, 2.92, 4.16, 5.43], { peak: 0.07, decay: 1.0, fall: 0.62 });
      tone(R, at, { f0: hz(-36), f1: 40, glide: 1.0, attack: 0.02, peak: 0.06, decay: 1.0, floor: 0.05, release: 0.15 });
      return R.end;
    }),
  entry('round-start', 'round start sting', 'cue', 0.5,
    'two quick rising blips (square, lowpassed at 2 kHz) and a filtered crash that opens then closes',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { drive: curves.soft(1.8), level: 0.8 });
      tone(R, at, { type: 'square', f0: hz(7), cutoff: 2000, peak: 0.05, decay: 0.03, release: 0.06 });
      tone(R, at + 0.09, { type: 'square', f0: hz(19), cutoff: 2000, peak: 0.05, decay: 0.03, release: 0.06 });
      hiss(R, at + 0.18, { f: 1200, f1: 5000, sweep: 0.06, q: 0.8, peak: 0.05, decay: 0.22, floor: 0.04, release: 0.08 });
      return R.end;
    }),
  entry('eyecatch-shine', 'eyecatch shine', 'cue', 0.45,
    'the anime glint: three short high sines (3.5, 4.4 and 5.2 kHz) 28 ms apart over a breathy band of noise',
    (ctx, at, dest, opts) => {
      const R = rig(ctx, at, dest, opts, { level: 0.9, width: 0.3 });
      [3456, 4355, 5184].forEach((f, i) => tone(R, at + i * 0.028, { f0: f, peak: 0.035, decay: 0.12, floor: 0.03, release: 0.08 }));
      hiss(R, at, { f: 4000, q: 4, attack: 0.02, peak: 0.012, decay: 0.2, floor: 0.05, release: 0.06 });
      return R.end;
    }),
]);
