// settle-hear · instruments - the symphony's voices, each made of native Web Audio nodes, every pitch from A = 432.
//
// <claudes_code_comments>
// ** Function List **
// INSTRUMENT_KEYS            - the playable instruments: flute (the CLEAR FLUTE), fiddle, harp, bells, crystal, and
//                              lane MELODYFX's flute-drive (the DISTORTED FLUTE), keys (LO-FI KEYS) and pluck
// playNote(ctx, out, inst, freq, t, dur, vel) - one note of an instrument at time t (seconds, audio clock); the
//                              nodes stop and disconnect themselves
// makeDrone(ctx, out, kind)  - a held drone (pipes or pad) on a root and its fifth: { set(rootHz, t), level(v, t),
//                              dispose() }
// makeHarmonics(ctx, out)    - the static harmonic mode: up to 7 sine partials of one root, each fading in on its own:
//                              { set(rootHz, n, t, stagger, skip), n, dispose() }
// makeBinaural(ctx, out)     - the binaural pair: left ear one sine, right ear another, through a ChannelMerger,
//                              started on a master tick: { start, glide, set(left, right, t, glide), level(v, t), dispose() }
// breathBuffer(ctx)          - a short noise burst for the flute's breath (built once per context)
//
// ** Technical Review **
// - No per-sample JavaScript. A note is a few oscillators, a filter and a gain envelope, scheduled at an audio
//   time and told to stop. Long voices (drones, harmonics, binaural) are built once and steered with ramps.
// - THE CLEAR FLUTE (the prime voice, the one instrument with no effect chain in any mode): a sine with a quiet
//   second harmonic (a triangle an octave up at 0.12) and, since lane MELODYFX, a faint third (a sine at 0.035) for
//   presence; a breath chiff at the attack (bandpassed noise at 4x the pitch, Q 1.8, 0.07: brighter and tighter than
//   the old 3x, Q 1.2, 0.05); a faint steady breath under the tone (looped noise, bandpassed at 2.2x the pitch, at
//   0.01 of the peak, shaped by the note's own envelope); a 45 ms attack (was 60); a vibrato LFO at 5.2 Hz that fades
//   in after 0.18 s to about 0.35% depth (about 6 cents), and a 0.12 s release.
// - THE DISTORTED FLUTE (flute-drive): the same body with the triangle at 0.3, the third at 0.06, a breath 2.4 times
//   as loud and a deeper vibrato. It is never heard bare: voice-fx.js gives it a chain that starts with a warm drive.
// - THE LO-FI KEYS (keys): a felt electric piano made by two-operator FM: the modulator's index starts at
//   (0.4 + 1.2 vel) x the pitch and falls to 0.12 x in about 0.12 s (the bark of a Rhodes), the level falls toward
//   0.18 of its peak while held (tau 0.35 to 1.2 s, shorter for high notes) and lets go over 0.25 s; a tine at 3x
//   dies in 0.05 s; a hammer thump; a felt low-pass at 6x the pitch.
// - THE SOFT PLUCK (pluck): a sawtooth through a closing low-pass (at most 2.4 kHz), the arps' synth pluck.
// - THE FIDDLE: two sawtooths a few cents apart through a 2.2 kHz lowpass and a 900 Hz body peak, a 60 ms attack,
//   a 200 ms release and a 6 Hz vibrato (lane BINAURALMODES softened it: the raw saw never reaches the output).
// - THE HARP: a triangle and a sine an octave up, struck: 8 ms attack (lane MELODYFX, was 5), through a low-pass at
//   5x the pitch (at most 4 kHz), an exponential decay over about 1.2 s.
// - BELLS: inharmonic partials 1, 2.76 (0.3), 5.4 (0.07, was 0.12), a 10 ms strike, 2.4 s ring. CRYSTAL: partials 1 and 3.01, very soft,
//   3 s shimmer.
// - THE DRONES: pipes = two sawtooths (root and fifth, the fifth an exact 3/2) and a root an octave down, through a
//   1.2 kHz lowpass (a reed's buzz); pad = triangles and sines, darker and softer.
// - THE HARMONICS: partial k sounds at k x root (exact whole multiples, just intonation), gain 0.5 / k, fading in
//   over 1.2 s each; the set call fades out partials above n.
// - THE BINAURAL PAIR: two sines merged so input 0 is the left ear and input 1 the right ear. It goes to a dry
//   output: the shared reverb and delay are stereo and would mix each ear's tone into the other.
// - THE BINAURAL PAIR ON THE MASTER BEAT (masterbeat.js): both ears start on one master tick, so the beat's phase
//   is zero there; a change glides both ears linearly over a length lockGlide picks near the asked one, so a
//   whole-number beat lands back on the master phase when the glide ends; setting the same pair again does nothing.
// - Every value goes through ramp() (engine.js), which refuses NaN and infinities.
// </claudes_code_comments>

import { ramp, noiseBuffer } from './engine.js';
import { masterStartTime, toMasterTime, masterGrid, lockGlide } from './masterbeat.js';
import { TONE, softEnvelope, gentleDetune } from './tone.js';

export const INSTRUMENT_KEYS = ['flute', 'fiddle', 'harp', 'bells', 'crystal', 'flute-drive', 'keys', 'pluck'];

const breaths = new WeakMap();
export function breathBuffer(ctx) {
  let b = breaths.get(ctx);
  if (b) return b;
  const n = Math.max(16, Math.round(ctx.sampleRate * 0.08));
  b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  const src = noiseBuffer(ctx).getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = src[(i * 13) % src.length] * Math.pow(1 - i / n, 2);
  breaths.set(ctx, b);
  return b;
}

const finite = (x, d) => (Number.isFinite(x) ? x : d);

// every sustained note's envelope keeps the tone rules' floors (tone.js): a soft attack, a release that never clicks
function envelope(ctx, out, t, { attack, peak, hold, release }) {
  return softEnvelope(ctx, out, t, { attack, peak, hold, release }).gain;
}

function osc(ctx, type, freq, t, stop, into, gain = 1) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = gain;
  o.connect(g);
  g.connect(into);
  o.start(t);
  o.stop(stop);
  return { o, g };
}

function vibrato(ctx, target, t, stop, { rate, depth, delay }) {
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = rate;
  const amt = ctx.createGain();
  amt.gain.setValueAtTime(0, t);
  amt.gain.linearRampToValueAtTime(depth, t + delay + 0.25);
  lfo.connect(amt);
  amt.connect(target);
  lfo.start(t);
  lfo.stop(stop);
  return lfo;
}

// THE FLUTE BODY (lane MELODYFX): one shape, two voices. The CLEAR FLUTE is the one clean instrument (no effect
// chain anywhere, every mode); the DISTORTED FLUTE is the same body with more triangle, more air and a deeper
// vibrato, made to be driven by its chain (voice-fx.js).
const FLUTE_BODY = {
  clear: { attack: 0.045, tri: 0.12, third: 0.035, depth: 0.0035, chiff: 0.07, chiffAt: 4, chiffQ: 1.8, air: 0.01 },
  drive: { attack: 0.05, tri: 0.3, third: 0.06, depth: 0.005, chiff: 0.08, chiffAt: 3, chiffQ: 1.4, air: 0.024 },
};
function fluteNote(ctx, out, f, t, dur, vel, B) {
  const end = t + dur + 0.25;
  const env = envelope(ctx, out, t, { attack: B.attack, peak: 0.22 * vel, hold: Math.max(0, dur - 0.1), release: 0.12 });
  const a = osc(ctx, 'sine', f, t, end, env, 1);
  const b = osc(ctx, 'triangle', f * 2, t, end, env, B.tri);
  const c = f * 3 < 12000 ? osc(ctx, 'sine', f * 3, t, end, env, B.third) : null;
  vibrato(ctx, a.o.frequency, t, end, { rate: 5.2, depth: f * B.depth, delay: 0.18 });
  vibrato(ctx, b.o.frequency, t, end, { rate: 5.2, depth: f * B.depth * 2, delay: 0.18 });
  if (c) vibrato(ctx, c.o.frequency, t, end, { rate: 5.2, depth: f * B.depth * 3, delay: 0.18 });
  // the chiff: a short breath burst at the attack, its band a few times the pitch
  const br = ctx.createBufferSource();
  br.buffer = breathBuffer(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(9000, f * B.chiffAt);
  bp.Q.value = B.chiffQ;
  const bg = ctx.createGain();
  bg.gain.value = B.chiff * vel;
  br.connect(bp);
  bp.connect(bg);
  bg.connect(out);
  br.start(t);
  // the air: a faint steady breath under the tone, shaped by the note's own envelope
  const air = ctx.createBufferSource();
  air.buffer = noiseBuffer(ctx);
  air.loop = true;
  const ap = ctx.createBiquadFilter();
  ap.type = 'bandpass';
  ap.frequency.value = Math.min(8000, f * 2.2);
  ap.Q.value = 2.5;
  const ag = ctx.createGain();
  ag.gain.value = B.air / 0.22;
  air.connect(ap);
  ap.connect(ag);
  ag.connect(env);
  air.start(t);
  air.stop(end);
  a.o.onended = () => { for (const n of [env, a.g, b.g, c?.g, bp, bg, ap, ag]) try { n?.disconnect(); } catch { /* gone */ } };
}

const NOTES = {
  flute(ctx, out, f, t, dur, vel) { fluteNote(ctx, out, f, t, dur, vel, FLUTE_BODY.clear); },
  'flute-drive'(ctx, out, f, t, dur, vel) { fluteNote(ctx, out, f, t, dur, vel, FLUTE_BODY.drive); },
  // THE LO-FI KEYS (lane MELODYFX): a felt electric piano. A sine carrier frequency-modulated by a sine at the same
  // pitch, the modulation (the bark) strongest at the hammer and dying in about 0.12 s; a faint tine an octave and a
  // fifth up that dies fast; a soft hammer thump; the level falls while the key is held (a piano never sustains
  // flat) and lets go over 0.25 s; a felt low-pass at six times the pitch.
  keys(ctx, out, f, t, dur, vel) {
    const hold = Math.max(0.02, dur);
    const end = t + hold + 0.6;
    const peak = 0.2 * vel;
    const tau = Math.min(1.2, Math.max(0.35, 1.2 - (f - 130) / 800));
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.008);
    env.gain.setTargetAtTime(peak * 0.18, t + 0.008, tau);
    env.gain.setTargetAtTime(0, t + 0.008 + hold, 0.25 / 3);
    const felt = ctx.createBiquadFilter();
    felt.type = 'lowpass';
    felt.frequency.value = Math.min(6000, f * 6);
    felt.Q.value = 0.5;
    felt.connect(env);
    env.connect(out);
    const car = osc(ctx, 'sine', f, t, end, felt, 1);
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = f;
    const idx = ctx.createGain();
    idx.gain.setValueAtTime(f * (0.4 + 1.2 * vel), t);
    idx.gain.setTargetAtTime(f * 0.12, t, 0.12);
    mod.connect(idx);
    idx.connect(car.o.frequency);
    mod.start(t);
    mod.stop(end);
    const tine = f * 3 < 12000 ? osc(ctx, 'sine', f * 3, t, Math.min(end, t + 0.5), felt, 0) : null;
    if (tine) { tine.g.gain.setValueAtTime(0.05 * vel, t); tine.g.gain.setTargetAtTime(0, t, 0.05); }
    const th = ctx.createBufferSource();
    th.buffer = breathBuffer(ctx);
    const tp = ctx.createBiquadFilter();
    tp.type = 'bandpass';
    tp.frequency.value = 1100;
    tp.Q.value = 0.8;
    const tg = ctx.createGain();
    tg.gain.value = 0.03 * vel;
    th.connect(tp);
    tp.connect(tg);
    tg.connect(out);
    th.start(t);
    car.o.onended = () => { for (const n of [env, felt, car.g, mod, idx, tine?.g, tp, tg]) try { n?.disconnect(); } catch { /* gone */ } };
  },
  // THE SOFT PLUCK (lane MELODYFX): a sawtooth through a low-pass that closes from six times the pitch (at most the
  // tone rules' 2.4 kHz) to one and a half times it in 0.15 s, a 6 ms attack and a 0.35 s fall: a synth pluck for
  // the arps, rounder than the old triangle.
  pluck(ctx, out, f, t, dur, vel) {
    const ring = Math.max(0.12, Math.min(0.5, dur + 0.2));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12 * vel, t + 0.006);
    g.gain.setTargetAtTime(0, t + 0.006, ring / 3);
    g.connect(out);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.2;
    const hi = Math.min(TONE.rawCeiling, f * 6);
    lp.frequency.setValueAtTime(hi, t);
    lp.frequency.setTargetAtTime(Math.min(hi, Math.max(120, f * 1.5)), t, 0.05);
    lp.connect(g);
    const a = osc(ctx, 'sawtooth', f, t, t + ring * 2, lp, 0.6);
    a.o.detune.value = gentleDetune(0, 2, 3);
    a.o.onended = () => { for (const n of [g, lp, a.g]) try { n.disconnect(); } catch { /* gone */ } };
  },
  fiddle(ctx, out, f, t, dur, vel) {
    const end = t + dur + 0.3;
    const env = envelope(ctx, out, t, { attack: 0.06, peak: 0.11 * vel, hold: Math.max(0, dur - 0.06), release: 0.2 });
    const body = ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = 900;
    body.Q.value = 1.4;
    body.gain.value = 4;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(TONE.rawCeiling, 2200);
    lp.Q.value = 0.6;
    body.connect(lp);
    lp.connect(env);
    const a = osc(ctx, 'sawtooth', f, t, end, body, 0.6);
    const b = osc(ctx, 'sawtooth', f, t, end, body, 0.6);
    a.o.detune.value = gentleDetune(0, 2, 4);
    b.o.detune.value = gentleDetune(1, 2, 4);
    vibrato(ctx, a.o.frequency, t, end, { rate: 6, depth: f * 0.004, delay: 0.12 });
    vibrato(ctx, b.o.frequency, t, end, { rate: 6, depth: f * 0.004, delay: 0.12 });
    a.o.onended = () => { for (const n of [env, body, lp, a.g, b.g]) try { n.disconnect(); } catch { /* gone */ } };
  },
  harp(ctx, out, f, t, dur, vel) {
    const ring = Math.max(0.6, Math.min(1.6, dur * 2));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16 * vel, t + 0.008);
    g.gain.setTargetAtTime(0, t + 0.008, ring / 4);
    g.connect(out);
    // lane MELODYFX: a soft low-pass on the string, so the triangle's top does not ring like a toy
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(4000, f * 5);
    lp.Q.value = 0.5;
    lp.connect(g);
    const end = t + ring * 1.5;
    const a = osc(ctx, 'triangle', f, t, end, lp, 1);
    osc(ctx, 'sine', f * 2, t, end, lp, 0.3);
    a.o.onended = () => { for (const n of [g, lp]) try { n.disconnect(); } catch { /* gone */ } };
  },
  bells(ctx, out, f, t, dur, vel) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08 * vel, t + 0.01);
    g.gain.setTargetAtTime(0, t + 0.01, 0.6);
    g.connect(out);
    const end = t + 3;
    // lane MELODYFX: a 10 ms strike (was 6) and the top partial at 0.07 (was 0.12): a bell, not a music box
    const a = osc(ctx, 'sine', f, t, end, g, 1);
    osc(ctx, 'sine', f * 2.76, t, end, g, 0.3);
    osc(ctx, 'sine', f * 5.4, t, end, g, 0.07);
    a.o.onended = () => { try { g.disconnect(); } catch { /* gone */ } };
  },
  crystal(ctx, out, f, t, dur, vel) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05 * vel, t + 0.01);
    g.gain.setTargetAtTime(0, t + 0.01, 0.8);
    g.connect(out);
    const end = t + 3.5;
    const a = osc(ctx, 'sine', f, t, end, g, 1);
    osc(ctx, 'sine', f * 3.01, t, end, g, 0.25);
    a.o.onended = () => { try { g.disconnect(); } catch { /* gone */ } };
  },
};

export function playNote(ctx, out, inst, freq, t, dur = 0.5, vel = 0.8) {
  const play = NOTES[inst];
  const f = finite(freq, 0);
  if (!play || !(f > 20) || f > 12000) return false;
  play(ctx, out, f, finite(t, ctx.currentTime), Math.max(0.03, finite(dur, 0.5)), Math.min(1, Math.max(0, finite(vel, 0.8))));
  return true;
}

export function makeDrone(ctx, out, kind = 'pad') {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = kind === 'pipes' ? 1100 : 700;
  lp.Q.value = kind === 'pipes' ? 1.1 : 0.6;
  const g = ctx.createGain();
  g.gain.value = 0;
  lp.connect(g);
  g.connect(out);
  const type = kind === 'pipes' ? 'sawtooth' : 'triangle';
  const parts = [[1, type, 0.35], [1.5, type, 0.22], [0.5, kind === 'pipes' ? 'sawtooth' : 'sine', 0.3]].map(([r, ty, a], i) => {
    const o = ctx.createOscillator();
    o.type = ty;
    o.frequency.value = 108 * r;
    o.detune.value = gentleDetune(i, 3, 3);
    const pg = ctx.createGain();
    pg.gain.value = a;
    o.connect(pg);
    pg.connect(lp);
    o.start();
    return { o, r, pg };
  });
  return {
    kind,
    set(root, t, glide = 1.2) { const f = finite(root, 108); for (const p of parts) ramp(p.o.frequency, f * p.r, t, glide / 3); },
    level(v, t, tau = 0.8) { ramp(g.gain, Math.min(1, Math.max(0, finite(v, 0))) * (kind === 'pipes' ? 0.16 : 0.2), t, tau); },
    dispose() {
      ramp(g.gain, 0, ctx.currentTime, 0.1);
      const id = setTimeout(() => { for (const p of parts) try { p.o.stop(); p.o.disconnect(); p.pg.disconnect(); } catch { /* gone */ } try { lp.disconnect(); g.disconnect(); } catch { /* gone */ } }, 500);
      id?.unref?.();
    },
  };
}

export function makeHarmonics(ctx, out) {
  const g = ctx.createGain();
  g.gain.value = 0.9;
  g.connect(out);
  const partials = Array.from({ length: 7 }, (_, i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 108 * (i + 1);
    const pg = ctx.createGain();
    pg.gain.value = 0;
    o.connect(pg);
    pg.connect(g);
    o.start();
    return { o, pg, k: i + 1 };
  });
  let n = 0;
  return {
    get n() { return n; },
    // root Hz, partials 0..7 (0 = silent); each partial fades in on its own, one after another
    // skip: partial numbers to leave out (a minor theme leaves out 5, the major third)
    set(root, count, t, stagger = 0.6, skip = []) {
      const f = finite(root, 108);
      const c = Math.min(7, Math.max(0, Math.round(finite(count, 0))));
      for (const p of partials) {
        ramp(p.o.frequency, f * p.k, t, 0.4);
        const on = p.k <= c && !skip.includes(p.k);
        const at = on && p.k > n ? t + (p.k - Math.max(1, n)) * stagger : t;
        ramp(p.pg.gain, on ? 0.12 / p.k : 0, at, on ? 0.4 : 0.3);
      }
      n = c;
    },
    dispose() {
      ramp(g.gain, 0, ctx.currentTime, 0.1);
      const id = setTimeout(() => { for (const p of partials) try { p.o.stop(); p.o.disconnect(); p.pg.disconnect(); } catch { /* gone */ } try { g.disconnect(); } catch { /* gone */ } }, 500);
      id?.unref?.();
    },
  };
}

export function makeBinaural(ctx, out) {
  const merge = ctx.createChannelMerger(2);
  const g = ctx.createGain();
  g.gain.value = 0;
  merge.connect(g);
  g.connect(out);
  // THE MASTER BEAT (masterbeat.js): both ears start on one master tick, so the beat's phase zero is that tick
  const start = masterStartTime(ctx);
  const ears = [216, 256].map((f, ear) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const eg = ctx.createGain();
    eg.gain.value = 0.5;
    o.connect(eg);
    // input 0 is the left ear, input 1 the right ear
    eg.connect(merge, 0, ear);
    o.start(start);
    return o;
  });
  // the glide in force: linear, both ears over the same span, so the beat moves linearly and its phase is known
  let glideNow = { t0: start, t1: start, from: [216, 256], to: [216, 256] };
  const valueAt = (t) => {
    const { t0, t1, from, to } = glideNow;
    if (t >= t1 || t1 <= t0) return to.slice();
    if (t <= t0) return from.slice();
    const a = (t - t0) / (t1 - t0);
    return [from[0] + a * (to[0] - from[0]), from[1] + a * (to[1] - from[1])];
  };
  return {
    start,
    get glide() { return { ...glideNow, from: glideNow.from.slice(), to: glideNow.to.slice() }; },
    set(left, right, t, glide = 4) {
      const to = [finite(left, 216), finite(right, 256)];
      if (to[0] === glideNow.to[0] && to[1] === glideNow.to[1]) return; // nothing moves: the phase stays locked
      const at = Math.max(t, start);
      const from = valueAt(at);
      // a glide length that lands the beat back on the master phase (lockGlide), near the asked length
      const sMaster = (toMasterTime(ctx, at) - masterGrid().origin) / 1000;
      const { seconds } = lockGlide(from[1] - from[0], to[1] - to[0], sMaster, glide);
      ears.forEach((o, i) => {
        const p = o.frequency;
        try {
          p.cancelScheduledValues?.(at);
          p.setValueAtTime(from[i], at);
          p.linearRampToValueAtTime(to[i], at + seconds);
        } catch {
          ramp(p, to[i], at, seconds / 3);
        }
      });
      glideNow = { t0: at, t1: at + seconds, from, to };
    },
    level(v, t, tau = 0.8) { ramp(g.gain, Math.min(1, Math.max(0, finite(v, 0))) * 0.18, t, tau); },
    dispose() {
      ramp(g.gain, 0, ctx.currentTime, 0.1);
      const id = setTimeout(() => { for (const o of ears) try { o.stop(); o.disconnect(); } catch { /* gone */ } try { merge.disconnect(); g.disconnect(); } catch { /* gone */ } }, 500);
      id?.unref?.();
    },
  };
}
