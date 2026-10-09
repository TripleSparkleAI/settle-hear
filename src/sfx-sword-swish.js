// settle-hear · sfx-sword-swish - THE SWORD DECK, half one (lane SWORDSWISH, navigator 2026-10-05: "sword swish from
// anime, and cool anime-style sounds, Street Fighter, but just subtle effects"; "very hyper effects, lots of
// features, distortion"). 25 short procedural sounds: swishes, whooshes, swings, slashes, blade draws and shings,
// each built from seeded noise and oscillators, pushed through drive, folding, crushing and resonant filters, and
// kept quiet. Nothing here is sampled; every sound is our own synthesis.
//
// <claudes_code_comments>
// ** Function List **
// SWORD_SWISH                    - the 25 entries { id, name, kind, deck, lane, dur, provenance, render }
// render(ctx, at, dest, opts)    - each entry's builder: schedules the sound from `at` into `dest`, returns its end
//                                  time; opts { strength = 1 (0.15..1), seed = 1 }
// (local) rng(seed)              - mulberry32, the only source of variation
// (local) voice(ctx, at, dest, o) - one sound's output chain: a level, a final low-pass at or below 8.6 kHz, and the
//                                  bookkeeping that disconnects every node when the last source ends
// (local) noise / osc / bp / shaper curves (drive, fold, crush) / pan / env / sweep - the building blocks
//
// ** Technical Review **
// - THE FORMAT (SETTLE/runs/animesfx/CHANNEL.md, ruled by this lane): render builds every node from ctx, never
//   touches the engine, a channel, the limiter or the window, uses no Math.random (the seed gives all variation),
//   and returns its end time. The wiring (sfx.js) owns the channel, MUTE ALL and the master beat.
// - THE NODE SUBSET: Gain, Oscillator, BiquadFilter, WaveShaper, BufferSource (a seeded noise buffer from
//   createBuffer), Delay (feed-forward taps only: a delay inside a feedback loop is clamped to one render quantum in
//   real WebAudio, so no loops), StereoPanner. Nothing else.
// - THE TONE RULES: every envelope starts and ends at zero, attack >= 4 ms, release >= 60 ms; a raw saw or square
//   passes a low-pass at or below 2.4 kHz before anything else; every sound ends in a low-pass at or below 8.6 kHz
//   (the 9 kHz rule after any shaper).
// - LEVEL: each entry's G is set from the Chromium OfflineAudioContext measurement (tools/sfx_levels.py) so the
//   deck's median peak sits near the clicks' median (about -20 dBFS) and nothing passes the clicks' loudest (peak
//   -15.4 dBFS, rms50 -22.8 dBFS). The measured table is in SETTLE/runs/animesfx/SWORDSWISH.md.
// - THE SEED: a small spread per play (a few percent of pitch, sweep and pan), so a repeated card is the same
//   sound, slightly different, like a second swing of the same blade.
// </claudes_code_comments>

const MADE = '2026-10-05';
const TOP = 8600; // Hz: the final low-pass every sound ends in

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

const clampS = (s) => Math.min(1, Math.max(0.15, Number.isFinite(s) ? s : 1));

// one sound's output: in -> level -> final low-pass -> dest; every node made through v.add is disconnected when the
// last source started through v.play has ended
function voice(ctx, at, dest, { level = 1, top = TOP } = {}) {
  const nodes = [];
  let live = 0;
  const add = (n) => { nodes.push(n); return n; };
  const lvl = add(ctx.createGain());
  lvl.gain.value = level;
  const lp = add(ctx.createBiquadFilter());
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(top, TOP);
  lp.Q.value = 0.5;
  lvl.connect(lp);
  lp.connect(dest);
  const done = () => { for (const n of nodes) { try { n.disconnect(); } catch { /* gone */ } } };
  const play = (src, t0, t1) => {
    live += 1;
    src.onended = () => { live -= 1; if (live <= 0) done(); };
    src.start(t0);
    src.stop(t1);
  };
  // hold(until): keep every node connected until `until` (a delay tap or a ringing filter outlives its source), by
  // a silent ConstantSource that counts as one more live source
  const hold = (until) => {
    let k;
    if (ctx.createConstantSource) {
      k = add(ctx.createConstantSource());
      k.offset.value = 0;
    } else {
      k = add(ctx.createOscillator());
      const z = add(ctx.createGain());
      z.gain.value = 0;
      k.connect(z);
    }
    play(k, at, until + 0.05);
    return until;
  };
  return { ctx, at, in: lvl, add, play, hold };
}

// a gain envelope from zero to peak and back to zero: attack, an optional hold, then a release that falls fast and
// tails (a mid point at 30% of the peak a third of the way in), never shorter than the floors
function env(v, t, { attack = 0.02, hold = 0, release = 0.15, peak = 1 } = {}) {
  const a = Math.max(0.004, attack);
  const r = Math.max(0.06, release);
  const g = v.add(v.ctx.createGain());
  const p = g.gain;
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.setValueAtTime(peak, t + a + hold);
  p.linearRampToValueAtTime(peak * 0.3, t + a + hold + r / 3);
  p.linearRampToValueAtTime(0, t + a + hold + r);
  return { node: g, end: t + a + hold + r };
}

// a swell: slow rise to a peak late in the sound, then a quick fall (the shape of a swing's air)
function swell(v, t, { rise = 0.12, fall = 0.08, peak = 1 } = {}) {
  const g = v.add(v.ctx.createGain());
  const p = g.gain;
  const r = Math.max(0.004, rise);
  const f = Math.max(0.06, fall);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak * 0.25, t + r * 0.55);
  p.linearRampToValueAtTime(peak, t + r);
  p.linearRampToValueAtTime(peak * 0.2, t + r + f * 0.5);
  p.linearRampToValueAtTime(0, t + r + f);
  return { node: g, end: t + r + f };
}

const noiseCache = new WeakMap();
function noiseBuffer(ctx, seed) {
  let per = noiseCache.get(ctx);
  if (!per) { per = new Map(); noiseCache.set(ctx, per); }
  const k = seed >>> 0;
  if (per.has(k)) return per.get(k);
  const n = Math.floor(ctx.sampleRate * 1.6);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const r = rng(k ^ 0x9e3779b9);
  for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
  per.set(k, buf);
  return buf;
}

function noise(v, seed, rate = 1) {
  const s = v.add(v.ctx.createBufferSource());
  s.buffer = noiseBuffer(v.ctx, seed);
  s.playbackRate.value = rate;
  return s;
}

function osc(v, type, f) {
  const o = v.add(v.ctx.createOscillator());
  o.type = type;
  o.frequency.value = f;
  return o;
}

function filt(v, type, f, q = 1) {
  const b = v.add(v.ctx.createBiquadFilter());
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

function pan(v, from, to, t0, t1) {
  if (!v.ctx.createStereoPanner) return null;
  const p = v.add(v.ctx.createStereoPanner());
  p.pan.setValueAtTime(from, t0);
  p.pan.linearRampToValueAtTime(to, t1);
  return p;
}

const curves = new Map();
function curve(kind, k) {
  const key = `${kind}:${k}`;
  if (curves.has(key)) return curves.get(key);
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    if (kind === 'drive') c[i] = Math.tanh(k * x) / Math.tanh(k);
    else if (kind === 'fold') c[i] = Math.sin(k * x * Math.PI * 0.5);
    else if (kind === 'crush') c[i] = Math.round(x * k) / k;
    else c[i] = x;
  }
  curves.set(key, c);
  return c;
}

function shaper(v, kind, k) {
  const w = v.add(v.ctx.createWaveShaper());
  w.curve = curve(kind, k);
  w.oversample = 'none';
  return w;
}

// a frequency sweep on a param: from f0 through an optional mid point to f1
function sweep(param, t, f0, f1, dur, mid = null, midAt = 0.5) {
  param.setValueAtTime(f0, t);
  if (mid != null) {
    param.exponentialRampToValueAtTime(mid, t + dur * midAt);
    param.exponentialRampToValueAtTime(f1, t + dur);
  } else param.exponentialRampToValueAtTime(f1, t + dur);
}

const chain = (...ns) => { for (let i = 0; i < ns.length - 1; i++) if (ns[i] && ns[i + 1]) ns[i].connect(ns[i + 1]); return ns[ns.length - 1]; };
const link = (...ns) => chain(...ns.filter(Boolean));

// ── the building blocks every swish shares ────────────────────────────────────────────────────────────────────

// air: band-passed noise whose centre sweeps from f0 to f1 (through mid), panned from p0 to p1
function air(v, t, { seed, f0, f1, mid = null, q = 3, dur, peak, rise, p0 = 0, p1 = 0, rate = 1, type = 'bandpass', after = null, midAt = 0.5 }) {
  const s = noise(v, seed, rate);
  const b = filt(v, type, f0, q);
  sweep(b.frequency, t, f0, f1, dur, mid, midAt);
  const e = rise != null ? swell(v, t, { rise, fall: dur - rise, peak }) : env(v, t, { attack: 0.01, release: dur - 0.01, peak });
  const p = pan(v, p0, p1, t, t + dur);
  link(s, b, ...(after ?? []), e.node, p, v.in);
  v.play(s, t, e.end + 0.02);
  return e.end;
}

// ring: a few inharmonic sine partials, the metal of a blade
function ring(v, t, { base, ratios, peak, release, decay = 0.6, detune = 0, p0 = 0, vib = 0 }) {
  let end = t;
  const p = pan(v, p0, p0, t, t + release);
  const bus = p ?? v.in;
  if (p) p.connect(v.in); // the panner joins the output once (a repeated connect is a no-op in WebAudio, not everywhere)
  ratios.forEach((k, i) => {
    const o = osc(v, 'sine', base * k);
    if (detune) o.detune.value = detune * (i % 2 ? 1 : -1);
    if (vib) {
      o.frequency.setValueAtTime(base * k, t);
      o.frequency.linearRampToValueAtTime(base * k * (1 + vib), t + release * 0.5);
      o.frequency.linearRampToValueAtTime(base * k * (1 - vib * 0.5), t + release);
    }
    const e = env(v, t, { attack: 0.004, release: release / (1 + 0.5 * i), peak: peak * Math.pow(decay, i) });
    link(o, e.node, bus);
    v.play(o, t, e.end + 0.02);
    end = Math.max(end, e.end);
  });
  return end;
}

// tick: a very short filtered square, the click of a tsuba or a guard
function tick(v, t, { f = 1800, peak, cutoff = 2200, p0 = 0 }) {
  const o = osc(v, 'square', f);
  const lp = filt(v, 'lowpass', Math.min(2400, cutoff), 0.7);
  const e = env(v, t, { attack: 0.004, release: 0.06, peak });
  const p = pan(v, p0, p0, t, t + 0.07);
  link(o, lp, e.node, p, v.in);
  v.play(o, t, e.end + 0.02);
  return e.end;
}

// ── the 25 ────────────────────────────────────────────────────────────────────────────────────────────────────
// Each def: G is the measured level trim; build(v, t, r) returns the end time; r() is the seeded spread.
const jit = (r, x, f = 0.06) => x * (1 + (r() * 2 - 1) * f);

const DEFS = [
  {
    n: 1, slug: 'thin-air-swish-rising', name: 'thin air swish, rising', kind: 'swish', dur: 0.15, G: 0.3693,
    recipe: 'narrow band-passed seeded noise, centre swept 3.5 to 8 kHz in 150 ms, Q 9, panned left to right',
    build: (v, t, r) => air(v, t, { seed: 11, f0: jit(r, 3500), f1: jit(r, 8000), q: 9, dur: 0.15, rise: 0.11, peak: 1, p0: -0.5, p1: 0.5 }),
  },
  {
    n: 2, slug: 'deep-air-swish-falling', name: 'deep air swish, falling', kind: 'swish', dur: 0.2, G: 0.1527,
    recipe: 'low-passed noise, the cut-off falling 3.6 kHz to 500 Hz over 200 ms, Q 4, panned right to left',
    build: (v, t, r) => air(v, t, { seed: 12, type: 'lowpass', f0: jit(r, 3600), f1: jit(r, 500), q: 4, dur: 0.2, rise: 0.03, peak: 1, p0: 0.5, p1: -0.5 }),
  },
  {
    n: 3, slug: 'double-swish-back-and-forth', name: 'double swish, there and back', kind: 'swish', dur: 0.4, G: 0.4228,
    recipe: 'two band-passed noise sweeps 200 ms apart, the first low and rising to the right, the second high and falling to the left',
    build: (v, t, r) => {
      const a = air(v, t, { seed: 13, f0: 500, f1: jit(r, 1400), q: 3.5, dur: 0.13, rise: 0.09, peak: 1, p0: -0.4, p1: 0.4 });
      const b = air(v, t + 0.2, { seed: 14, f0: 4200, f1: jit(r, 1800), q: 3.5, dur: 0.2, rise: 0.06, peak: 0.85, p0: 0.4, p1: -0.4 });
      return Math.max(a, b);
    },
  },
  {
    n: 4, slug: 'hollow-tube-whistle-swish', name: 'hollow tube whistle swish', kind: 'swish', dur: 0.34, G: 0.18,
    recipe: 'noise through two very narrow band-passes (Q 40) a fifth apart, near 620 and 930 Hz, bending up a third: a whistling tube',
    build: (v, t, r) => {
      const f = jit(r, 620, 0.05);
      const s = noise(v, 15);
      const e = swell(v, t, { rise: 0.2, fall: 0.14, peak: 1 });
      const p = pan(v, -0.2, 0.3, t, t + 0.34);
      const sum = v.add(v.ctx.createGain());
      sum.gain.value = 1;
      [[1, 14], [1.5, 9]].forEach(([k, g]) => {
        const b = filt(v, 'bandpass', f * k, 40);
        sweep(b.frequency, t, f * k, f * k * 1.26, 0.34, f * k * 1.3, 0.6);
        const gg = v.add(v.ctx.createGain());
        gg.gain.value = g;
        link(s, b, gg, sum);
      });
      link(sum, e.node, p, v.in);
      v.play(s, t, e.end + 0.02);
      return e.end;
    },
  },
  {
    n: 5, slug: 'heavy-whoosh-with-sub-drop', name: 'heavy whoosh with a sub drop', kind: 'whoosh', dur: 0.5, G: 0.1862,
    recipe: 'low-passed noise opening 300 Hz to 1.8 kHz and closing again, under a sine sub falling 92 to 46 Hz',
    build: (v, t, r) => {
      const a = air(v, t, { seed: 16, type: 'lowpass', f0: 300, mid: jit(r, 1800), f1: 260, q: 1.5, dur: 0.5, rise: 0.27, peak: 1, p0: -0.3, p1: 0.3 });
      const o = osc(v, 'sine', 92);
      o.frequency.setValueAtTime(jit(r, 92, 0.03), t + 0.1);
      o.frequency.exponentialRampToValueAtTime(46, t + 0.48);
      const e = swell(v, t + 0.1, { rise: 0.18, fall: 0.2, peak: 0.3 });
      link(o, e.node, v.in);
      v.play(o, t + 0.1, e.end + 0.02);
      return Math.max(a, e.end);
    },
  },
  {
    n: 6, slug: 'doppler-whoosh-pass-by', name: 'doppler whoosh passing by', kind: 'whoosh', dur: 0.44, G: 0.2424,
    recipe: 'noise rising then falling through a band-pass, with a sine tone bent 560 to 330 Hz, panned across',
    build: (v, t, r) => {
      const a = air(v, t, { seed: 17, f0: 700, mid: jit(r, 3200), f1: 500, q: 3, dur: 0.44, rise: 0.22, peak: 1, p0: -0.8, p1: 0.8, midAt: 0.5 });
      const o = osc(v, 'sine', 560);
      o.frequency.setValueAtTime(jit(r, 560, 0.04), t + 0.06);
      o.frequency.linearRampToValueAtTime(520, t + 0.22);
      o.frequency.exponentialRampToValueAtTime(330, t + 0.42);
      const e = swell(v, t + 0.06, { rise: 0.17, fall: 0.19, peak: 0.3 });
      const p = pan(v, -0.7, 0.7, t + 0.06, t + 0.42);
      link(o, e.node, p, v.in);
      v.play(o, t + 0.06, e.end + 0.02);
      return Math.max(a, e.end);
    },
  },
  {
    n: 7, slug: 'bitcrushed-whoosh', name: 'bitcrushed whoosh', kind: 'whoosh', dur: 0.16, G: 0.0923,
    recipe: 'a band-passed noise whoosh rising 2.6 to 6.2 kHz, crushed to 5 levels by a staircase wave-shaper, low-passed at 6 kHz',
    build: (v, t, r) => {
      const cr = shaper(v, 'crush', 2);
      const lp = filt(v, 'lowpass', 6000, 0.7);
      return air(v, t, { seed: 18, f0: 2600, f1: jit(r, 6200), q: 2, dur: 0.16, rise: 0.1, peak: 2.2, p0: 0.3, p1: -0.3, after: [cr, lp] });
    },
  },
  {
    n: 8, slug: 'katana-swing-wind-up-and-cut', name: 'katana swing, wind-up and cut', kind: 'swing', dur: 0.36, G: 0.3613,
    recipe: 'a soft low swish (400 to 800 Hz) then, 160 ms later, a fast bright one (2.4 to 7 kHz), the cut',
    build: (v, t, r) => {
      const a = air(v, t, { seed: 19, f0: 400, f1: 800, q: 2, dur: 0.15, rise: 0.1, peak: 0.6, p0: 0.3, p1: 0.1 });
      const b = air(v, t + 0.16, { seed: 20, f0: jit(r, 2400), f1: jit(r, 7000), q: 5, dur: 0.18, rise: 0.05, peak: 1, p0: 0.1, p1: -0.6 });
      return Math.max(a, b);
    },
  },
  {
    n: 9, slug: 'spinning-staff-swing', name: 'spinning staff swing', kind: 'swing', dur: 0.62, G: 0.3273,
    recipe: 'a low swish gated by a 6 Hz tremolo (an oscillator on a gain), the air of a weapon turning end over end',
    build: (v, t, r) => {
      const trem = v.add(v.ctx.createGain());
      trem.gain.value = 0.5;
      const lfo = osc(v, 'sine', jit(r, 6, 0.08));
      const depth = v.add(v.ctx.createGain());
      depth.gain.value = 0.5;
      link(lfo, depth);
      depth.connect(trem.gain);
      v.play(lfo, t, t + 0.64);
      return air(v, t, { seed: 21, f0: 800, mid: jit(r, 2200), f1: 1000, q: 2.5, dur: 0.62, rise: 0.36, peak: 1.3, p0: -0.5, p1: 0.5, after: [trem] });
    },
  },
  {
    n: 10, slug: 'wide-arc-swing-falling', name: 'wide arc swing, falling', kind: 'swing', dur: 0.56, G: 0.1601,
    recipe: 'one long sweep 5 kHz down to 1.1 kHz split in two, the right copy delayed 14 ms, a wide stereo arc',
    build: (v, t, r) => {
      const s = noise(v, 22);
      const b = filt(v, 'bandpass', 5000, 3);
      sweep(b.frequency, t, jit(r, 5000), jit(r, 1100), 0.56);
      const e = env(v, t, { attack: 0.06, hold: 0.04, release: 0.46, peak: 1 });
      const pl = pan(v, -0.95, -0.3, t, t + 0.56);
      const pr = pan(v, 0.3, 0.95, t, t + 0.56);
      const d = v.add(v.ctx.createDelay(0.05));
      d.delayTime.value = 0.014;
      link(s, b, e.node);
      if (pl) { e.node.connect(pl); pl.connect(v.in); } else e.node.connect(v.in);
      e.node.connect(d); link(d, pr, v.in);
      v.play(s, t, e.end + 0.04);
      return e.end + 0.014;
    },
  },
  {
    n: 11, slug: 'sharp-slash-crack', name: 'sharp slash crack', kind: 'slash', dur: 0.08, G: 0.1534,
    recipe: 'a 70 ms noise burst swept 2 to 6.5 kHz with a driven edge, plus a filtered square tick at the start',
    build: (v, t, r) => {
      const dr = shaper(v, 'drive', 4);
      const a = air(v, t, { seed: 23, f0: 2000, f1: jit(r, 6500), q: 2.5, dur: 0.07, peak: 0.9, p0: -0.2, p1: 0.4, after: [dr] });
      const b = tick(v, t, { f: 1500, peak: 0.35, p0: -0.2 });
      return Math.max(a, b);
    },
  },
  {
    n: 12, slug: 'hyper-slash-overdriven', name: 'hyper slash, overdriven', kind: 'slash', dur: 0.2, G: 0.045,
    recipe: 'a swish driven hard through a tanh shaper (k 9), then a resonant high-pass sweep, low-passed at 7.5 kHz',
    build: (v, t, r) => {
      const dr = shaper(v, 'drive', 9);
      const hp = filt(v, 'highpass', 300, 8);
      sweep(hp.frequency, t, 300, jit(r, 2200), 0.18);
      const lp = filt(v, 'lowpass', 7500, 0.7);
      return air(v, t, { seed: 24, f0: 700, f1: jit(r, 3200), q: 3, dur: 0.2, rise: 0.08, peak: 1.6, p0: 0.5, p1: -0.5, after: [dr, hp, lp] });
    },
  },
  {
    n: 13, slug: 'cross-slash-x', name: 'cross slash, an X', kind: 'slash', dur: 0.24, G: 0.2879,
    recipe: 'two fast slashes 90 ms apart, the first hard left falling from 6 kHz, the second hard right rising to 6 kHz',
    build: (v, t, r) => {
      const a = air(v, t, { seed: 25, f0: 6000, f1: jit(r, 2600), q: 5, dur: 0.1, rise: 0.04, peak: 1, p0: -0.9, p1: -0.6 });
      const b = air(v, t + 0.09, { seed: 26, f0: 2600, f1: jit(r, 6200), q: 5, dur: 0.13, rise: 0.05, peak: 1, p0: 0.6, p1: 0.9 });
      return Math.max(a, b);
    },
  },
  {
    n: 14, slug: 'energy-slash-folded-saw', name: 'energy slash, folded saw', kind: 'slash', dur: 0.26, G: 0.2292,
    recipe: 'a saw low-passed at 2.2 kHz gliding 1.6 kHz to 180 Hz, wave-folded, under a quick noise slash',
    build: (v, t, r) => {
      const o = osc(v, 'sawtooth', 1600);
      o.frequency.setValueAtTime(jit(r, 1600), t);
      o.frequency.exponentialRampToValueAtTime(180, t + 0.24);
      const lp = filt(v, 'lowpass', 2200, 1);
      const fold = shaper(v, 'fold', 2.4);
      const e = env(v, t, { attack: 0.006, release: 0.24, peak: 0.4 });
      const p = pan(v, 0.3, -0.3, t, t + 0.25);
      link(o, lp, fold, e.node, p, v.in);
      v.play(o, t, e.end + 0.02);
      const a = air(v, t, { seed: 27, f0: 2200, f1: 6000, q: 3, dur: 0.1, peak: 0.6, p0: 0.3, p1: -0.1 });
      return Math.max(a, e.end);
    },
  },
  {
    n: 15, slug: 'afterimage-slash-echoes', name: 'afterimage slash with echoes', kind: 'slash', dur: 0.42, G: 0.4568,
    recipe: 'one slash and three feed-forward delay taps (90, 180, 270 ms), each quieter and darker, panned in turn',
    build: (v, t, r) => {
      const s = noise(v, 28);
      const b = filt(v, 'bandpass', 1600, 3.5);
      sweep(b.frequency, t, 1600, jit(r, 5600), 0.12);
      const e = env(v, t, { attack: 0.008, release: 0.12, peak: 1 });
      link(s, b, e.node);
      e.node.connect(v.in);
      [[0.09, 0.5, 0.6, 5200], [0.18, 0.3, -0.6, 3800], [0.27, 0.17, 0.4, 2600]].forEach(([dt, g, pn, lpf]) => {
        const d = v.add(v.ctx.createDelay(0.4));
        d.delayTime.value = dt;
        const gg = v.add(v.ctx.createGain());
        gg.gain.value = g;
        const lp = filt(v, 'lowpass', lpf, 0.7);
        const p = pan(v, pn, pn, t, t + 0.5);
        link(e.node, d, lp, gg, p, v.in);
      });
      v.play(s, t, e.end + 0.02);
      return e.end + 0.27;
    },
  },
  {
    n: 16, slug: 'blade-draw-rough-scrape', name: 'blade draw, a rough scrape', kind: 'draw', dur: 0.42, G: 0.2551,
    recipe: 'band-passed noise (Q 5) rising 1.6 to 2.6 kHz, chattered by a 52 Hz tremolo, with a rising metal partial',
    build: (v, t, r) => {
      const trem = v.add(v.ctx.createGain());
      trem.gain.value = 0.4;
      const lfo = osc(v, 'triangle', jit(r, 52, 0.08));
      const depth = v.add(v.ctx.createGain());
      depth.gain.value = 0.6;
      link(lfo, depth);
      depth.connect(trem.gain);
      v.play(lfo, t, t + 0.44);
      const a = air(v, t, { seed: 29, f0: jit(r, 1600), f1: jit(r, 2600), q: 5, dur: 0.4, rise: 0.28, peak: 1.6, p0: -0.1, p1: 0.2, after: [trem] });
      const o = osc(v, 'sine', 3100);
      o.frequency.setValueAtTime(3100, t);
      o.frequency.exponentialRampToValueAtTime(4300, t + 0.38);
      const e = swell(v, t, { rise: 0.28, fall: 0.14, peak: 0.12 });
      link(o, e.node, v.in);
      v.play(o, t, e.end + 0.02);
      return Math.max(a, e.end);
    },
  },
  {
    n: 17, slug: 'quick-draw-tick-and-shing', name: 'quick draw: a tick, then the shing', kind: 'draw', dur: 0.62, G: 0.2248,
    recipe: 'a low-passed square tick (the guard leaving the sheath), then 60 ms later a ring of four inharmonic partials',
    build: (v, t, r) => {
      const a = tick(v, t, { f: 1200, peak: 0.45, cutoff: 1800, p0: 0.1 });
      const b = air(v, t + 0.04, { seed: 30, f0: 3000, f1: 5200, q: 6, dur: 0.1, peak: 0.35, p0: 0.1, p1: 0.3 });
      const c = ring(v, t + 0.06, { base: jit(r, 1440, 0.03), ratios: [1, 2.76, 4.07, 5.4], peak: 0.24, release: 0.55, decay: 0.55, p0: 0.25 });
      return Math.max(a, b, c);
    },
  },
  {
    n: 18, slug: 'slow-draw-whisper-falling', name: 'slow draw, a falling whisper', kind: 'draw', dur: 0.62, G: 0.1085, top: 6400,
    recipe: 'a long soft high-passed band of noise, the floor gliding 5.2 kHz down to 2.4 kHz over 600 ms under a double 6 kHz ceiling, barely there',
    build: (v, t, r) => air(v, t, { seed: 31, type: 'highpass', f0: jit(r, 5200), f1: jit(r, 2400), q: 2, dur: 0.62, rise: 0.12, peak: 0.9, p0: 0.2, p1: -0.2, after: [filt(v, 'lowpass', 6000, 0.6)] }),
  },
  {
    n: 19, slug: 'shing-bright-ring', name: 'shing, a bright ring', kind: 'shing', dur: 0.8, G: 0.2024,
    recipe: 'five inharmonic sine partials on 1.62 kHz (1, 2.4, 2.76, 4.1, 5.0) with a slow vibrato, 800 ms decay',
    build: (v, t, r) => ring(v, t, { base: jit(r, 1620, 0.03), ratios: [1, 2.4, 2.76, 4.1, 5.0], peak: 0.32, release: 0.8, decay: 0.62, detune: 6, vib: 0.004 }),
  },
  {
    n: 20, slug: 'shing-glint-sparkle', name: 'shing glint, a sparkle', kind: 'shing', dur: 0.46, G: 0.2884,
    recipe: 'three quick metal pings stepping up 2.2, 2.9 and 3.7 kHz, each a pair of detuned sines',
    build: (v, t, r) => {
      let end = t;
      [2200, 2900, 3700].forEach((f, i) => {
        end = Math.max(end, ring(v, t + i * 0.045, { base: jit(r, f, 0.02), ratios: [1, 1.004, 2.3], peak: 0.2, release: 0.3, decay: 0.4, p0: -0.4 + i * 0.4 }));
      });
      return end;
    },
  },
  {
    n: 21, slug: 'shing-ring-modulated-metal', name: 'shing, ring-modulated metal', kind: 'shing', dur: 0.7, G: 0.3011,
    recipe: 'a 1.1 kHz sine whose gain is driven by a 1.53 kHz sine (ring modulation), sidebands at 430 Hz and 2.63 kHz',
    build: (v, t, r) => {
      const car = osc(v, 'sine', jit(r, 1100, 0.03));
      const mod = osc(v, 'sine', 1530);
      const rm = v.add(v.ctx.createGain());
      rm.gain.value = 0;
      link(mod, rm.gain);
      const e = env(v, t, { attack: 0.004, release: 0.68, peak: 0.42 });
      const p = pan(v, -0.25, 0.25, t, t + 0.7);
      link(car, rm, e.node, p, v.in);
      v.play(car, t, e.end + 0.02);
      v.play(mod, t, e.end + 0.02);
      return e.end;
    },
  },
  {
    n: 22, slug: 'sheathe-slide-and-click', name: 'sheathe: a slide, then the click', kind: 'draw', dur: 0.34, G: 0.1069,
    recipe: 'a narrow noise slide falling 4.2 to 1.8 kHz for 220 ms, then a low knock (a sine 150 to 85 Hz) and a filtered square click',
    build: (v, t, r) => {
      const a = air(v, t, { seed: 32, f0: jit(r, 4200), f1: jit(r, 1800), q: 7, dur: 0.22, rise: 0.15, peak: 0.9, p0: -0.2, p1: 0 });
      const k = t + 0.24;
      const o = osc(v, 'sine', 150);
      o.frequency.setValueAtTime(jit(r, 150, 0.04), k);
      o.frequency.exponentialRampToValueAtTime(85, k + 0.07);
      const e = env(v, k, { attack: 0.004, release: 0.09, peak: 0.6 });
      link(o, e.node, v.in);
      v.play(o, k, e.end + 0.02);
      const c = tick(v, k, { f: 900, peak: 0.4, cutoff: 1600 });
      return Math.max(a, e.end, c);
    },
  },
  {
    n: 23, slug: 'tape-warp-swish-pitch-drop', name: 'tape warp swish, a pitch drop', kind: 'whoosh', dur: 0.4, G: 0.1127,
    recipe: 'a noise swish and a saw (low-passed at 1.6 kHz) slowing together, the saw 440 to 70 Hz, rate 1.7 to 0.4, driven (k 3)',
    build: (v, t, r) => {
      const s = noise(v, 33, 1.7);
      s.playbackRate.setValueAtTime(1.7, t);
      s.playbackRate.exponentialRampToValueAtTime(0.4, t + 0.38);
      const b = filt(v, 'bandpass', 2400, 1.8);
      sweep(b.frequency, t, jit(r, 2400), 400, 0.38);
      const o = osc(v, 'sawtooth', 440);
      o.frequency.setValueAtTime(jit(r, 440, 0.04), t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.38);
      const lp = filt(v, 'lowpass', 1600, 1);
      const og = v.add(v.ctx.createGain());
      og.gain.value = 0.9;
      const ng = v.add(v.ctx.createGain());
      ng.gain.value = 0.4;
      const dr = shaper(v, 'drive', 3);
      const e = swell(v, t, { rise: 0.12, fall: 0.28, peak: 1 });
      const p = pan(v, 0.6, -0.4, t, t + 0.4);
      link(s, b, ng, dr);
      link(o, lp, og, dr);
      link(dr, e.node, p, v.in);
      v.play(s, t, e.end + 0.02);
      v.play(o, t, e.end + 0.02);
      return e.end;
    },
  },
  {
    n: 24, slug: 'phaser-sweep-swish', name: 'phaser sweep swish', kind: 'swish', dur: 0.56, G: 0.3975,
    recipe: 'a flat band of noise near 520 Hz mixed with a copy through four resonant all-pass filters swept 200 Hz to 2.5 kHz and back (a phaser)',
    build: (v, t, r) => {
      const s = noise(v, 34);
      const b = filt(v, 'bandpass', jit(r, 520), 1.4);
      const e = env(v, t, { attack: 0.02, hold: 0.24, release: 0.3, peak: 1 });
      link(s, b, e.node);
      let x = e.node;
      for (let i = 0; i < 4; i++) {
        const ap = filt(v, 'allpass', 200, 9);
        sweep(ap.frequency, t, 200 * (1 + i * 0.3), 200 * (1 + i * 0.3), 0.54, jit(r, 2500) * (1 + i * 0.1), 0.5);
        x.connect(ap);
        x = ap;
      }
      const p = pan(v, -0.5, 0.5, t, t + 0.56);
      const mix = v.add(v.ctx.createGain());
      mix.gain.value = 0.6;
      e.node.connect(mix);
      x.connect(mix);
      link(mix, p, v.in);
      v.play(s, t, e.end + 0.02);
      return e.end;
    },
  },
  {
    n: 25, slug: 'wavefolded-air-cut', name: 'wave-folded air cut', kind: 'slash', dur: 0.32, G: 0.2827,
    recipe: 'a sine at 330 Hz swelling into a fold curve so harmonics bloom and grind, over a fast air cut',
    build: (v, t, r) => {
      const o = osc(v, 'sine', jit(r, 330, 0.04));
      o.frequency.setValueAtTime(jit(r, 330, 0.04), t);
      o.frequency.exponentialRampToValueAtTime(240, t + 0.3);
      const pre = v.add(v.ctx.createGain());
      pre.gain.setValueAtTime(0.4, t);
      pre.gain.linearRampToValueAtTime(3.2, t + 0.18);
      const fold = shaper(v, 'fold', 1.8);
      const lp = filt(v, 'lowpass', 5200, 0.8);
      const e = swell(v, t, { rise: 0.16, fall: 0.16, peak: 0.32 });
      const p = pan(v, -0.4, 0.4, t, t + 0.32);
      link(o, pre, fold, lp, e.node, p, v.in);
      v.play(o, t, e.end + 0.02);
      const a = air(v, t + 0.1, { seed: 35, f0: 1800, f1: 5800, q: 3, dur: 0.14, rise: 0.06, peak: 0.7, p0: -0.1, p1: 0.5 });
      return Math.max(a, e.end);
    },
  },
];

const pad = (n) => String(n).padStart(2, '0');

export const SWORD_SWISH = Object.freeze(DEFS.map((d) => Object.freeze({
  id: `swish-${pad(d.n)}-${d.slug}`,
  name: d.name,
  kind: d.kind,
  deck: 'sword',
  lane: 'SWORDSWISH',
  dur: d.dur,
  provenance: Object.freeze({ method: 'procedural', made: MADE, recipe: d.recipe }),
  render(ctx, at, dest, opts = {}) {
    const s = clampS(opts.strength ?? 1);
    const r = rng((Number(opts.seed) || 1) * 7919 + d.n);
    const t = Math.max(at, ctx.currentTime);
    const v = voice(ctx, t, dest, { level: d.G * s, top: d.top ?? TOP });
    return v.hold(d.build(v, t, r));
  },
})));
