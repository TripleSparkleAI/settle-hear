// settle-hear · fx-hum - THE NEUTRAL HUM: the quiet warm-down bed a set falls back to, pulsing at a chosen rate.
//
// <claudes_code_comments>
// ** Function List **
// HUM_PULSE_HZ               - 10: the alpha default of the pulse
// HUM_MAX_LEVEL              - 0.05: the hum's output never goes above this gain
// HUM_RATES                  - the pulse rates by name, from modes.js BINAURAL_MODES: delta 3, theta 6, schumann
//                              7.83, alpha 10, beta 14, gamma 40 (Hz)
// HUM_VARIANTS               - 'pulse', 'breath', 'rain', 'motif', 'pair'
// humRate(rate)              - pure: a rate name or a number -> Hz, clamped to 1 .. 45 (default alpha, 10)
// humRootHz(root, lo, hi)    - pure: midiHz(root) moved by octaves into [lo, hi]
// hum                        - the effect object { key, label, family, kind, line, famous, cost, params, start }
// hum.start(ctx, out, t0, opts) - { nodes, peak, output, rate, variant, stop(t) }
//
// ** Technical Review **
// - THE RULE: the rate is ALWAYS an amplitude pulse on a warm tone, never an audio tone below 40 Hz. In 'pulse' and
//   'motif' an oscillator at the rate drives the GAIN PARAMETER of the 'am' GainNode (base 0.75, depth 0.25, so the
//   level swings between half and full). Every oscillator on the audio path sits at 55 Hz or above.
// - THE WARM TONE: a sine (0.7) and a triangle (0.3) at midiHz(root) moved into 55 .. 110 Hz -> a low-pass at
//   params.cut (500 Hz) -> am. In 'motif' the tone is scaled to 0.7 of that, so tone + motif stays under 1.
// - 'breath': the same tone, the pulse slowed to one swell per beat (1 / beatDur Hz, base 0.5, depth 0.5).
// - 'rain': white noise -> a low-pass at 1.2 kHz -> a high-pass at 300 Hz -> a drift gain (base 0.75) moved by two
//   very slow sines (0.07 Hz depth 0.15 and 0.023 Hz depth 0.1). No tone, so no pulse: the rate is ignored.
// - 'motif': the pulse plus up to four motif notes, each held for four beats (four times slower than one note a
//   beat), as one sine an octave down (moved up by octaves until at least 80 Hz) whose gain swells to 0.3 and
//   releases inside each note. The notes repeat for opts.horizon seconds (default 240); after that the pulse goes on
//   alone. This is how a set carries a little of the set before it.
// - 'pair': a soft binaural pair: two sines through a ChannelMerger, left at midiHz(root) moved into 100 .. 250 Hz,
//   right = left + rate (exactly). The rate is heard between the ears, so no amplitude pulse is added.
// - THE LEVEL: every variant passes one master GainNode (the output path's last gain) that fades from 0 to the
//   level over params.fadeIn (2 s). The level is opts.level clamped to 0 .. HUM_MAX_LEVEL, and every gain before the
//   master holds a sum at or under 1, so the hum's amplitude never exceeds the level. peak is the largest value
//   ever written on the master. stop(t) fades the master to 0 over params.fadeOut (1.5 s) and stops every source
//   just after; onended disconnects them.
// </claudes_code_comments>

import { midiHz } from './tuning.js';
import { noiseBuffer } from './engine.js';

export const HUM_PULSE_HZ = 10;
export const HUM_MAX_LEVEL = 0.05;
export const HUM_RATES = { delta: 3, theta: 6, schumann: 7.83, alpha: 10, beta: 14, gamma: 40 };
export const HUM_VARIANTS = ['pulse', 'breath', 'rain', 'motif', 'pair'];

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const pick = (params, opts, k) => { const [d, , lo, hi] = params[k]; const v = Number.isFinite(+opts?.[k]) && opts?.[k] !== null ? +opts[k] : d; return Math.min(hi, Math.max(lo, v)); };

export function humRate(rate) {
  if (typeof rate === 'string' && rate in HUM_RATES) return HUM_RATES[rate];
  const r = Number(rate);
  if (rate === null || rate === undefined || !Number.isFinite(r)) return HUM_PULSE_HZ;
  return Math.min(45, Math.max(1, r));
}

export function humRootHz(root, lo, hi) {
  let f = midiHz(Number.isFinite(+root) ? +root : 45);
  while (f > hi) f /= 2;
  while (f < lo) f *= 2;
  return f;
}

export const hum = {
  key: 'neutral-hum', label: 'THE NEUTRAL HUM', family: 'hum', kind: 'bed', cost: 6,
  line: 'a quiet warm low tone that pulses softly at a slow rate, the room settling after the set, never loud',
  famous: 'the warm-down after the last record, or the gap between two sets',
  params: {
    level: [0.035, 'output level, capped at 0.05', 0, HUM_MAX_LEVEL],
    rate: [HUM_PULSE_HZ, 'Hz of the amplitude pulse (alpha by default)', 1, 45],
    cut: [500, 'Hz, the low-pass on the warm tone', 200, 1200],
    fadeIn: [2, 's to fade in', 0.5, 8],
    fadeOut: [1.5, 's to fade out on stop', 0.3, 8],
    horizon: [240, 's of scheduled motif notes', 10, 1800],
  },
  start(ctx, out, t0, opts = {}) {
    const P = hum.params;
    const variant = HUM_VARIANTS.includes(opts.variant) ? opts.variant : 'pulse';
    const level = pick(P, opts, 'level');
    const rate = humRate(opts.rate ?? 'alpha');
    const beatDur = Number.isFinite(+opts.beatDur) && +opts.beatDur > 0.1 ? +opts.beatDur : 0.5;
    const nodes = [];
    const srcs = [];
    const mk = (n) => { nodes.push(n); return n; };
    const gainN = (v) => { const g = mk(ctx.createGain()); g.gain.value = v; return g; };
    const oscN = (type, f) => { const o = mk(ctx.createOscillator()); o.type = type; o.frequency.value = f; o.start(t0); srcs.push(o); return o; };
    let peak = 0;
    const master = gainN(0);
    const mw = (fn, v, t) => { peak = Math.max(peak, v); fn(master.gain, v, t); };
    mw(at, 0, t0);
    mw(lin, level, t0 + pick(P, opts, 'fadeIn'));
    master.connect(out);

    const warm = (scale) => {
      const f = humRootHz(opts.root, 55, 110);
      const lp = mk(ctx.createBiquadFilter());
      lp.type = 'lowpass';
      lp.frequency.value = pick(P, opts, 'cut');
      lp.Q.value = 0.5;
      for (const [type, w] of [['sine', 0.7], ['triangle', 0.3]]) { const o = oscN(type, f); const g = gainN(w * scale); o.connect(g); g.connect(lp); }
      return lp;
    };
    const pulsed = (src, hz, base, depth) => {
      const am = gainN(base);
      src.connect(am);
      const lfo = oscN('sine', hz);
      const d = gainN(depth);
      lfo.connect(d);
      d.connect(am.gain);
      am.connect(master);
      return { am, lfo };
    };

    let pulseOsc = null;
    if (variant === 'pulse') pulseOsc = pulsed(warm(1), rate, 0.75, 0.25).lfo;
    if (variant === 'breath') pulsed(warm(1), 1 / beatDur, 0.5, 0.5);
    if (variant === 'motif') {
      pulseOsc = pulsed(warm(0.7), rate, 0.75, 0.25).lfo;
      const notes = (Array.isArray(opts.motif) ? opts.motif : []).filter((m) => Number.isFinite(+m)).slice(0, 4);
      if (notes.length) {
        const o = oscN('sine', 110);
        const env = gainN(0);
        o.connect(env);
        env.connect(master);
        const dur = 4 * beatDur;
        const end = t0 + pick(P, opts, 'horizon');
        for (let t = t0 + pick(P, opts, 'fadeIn'), i = 0; t + dur <= end; t += dur, i++) {
          let f = midiHz(+notes[i % notes.length] - 12);
          while (f < 80) f *= 2;
          at(o.frequency, f, t);
          at(env.gain, 0, t);
          lin(env.gain, 0.3, t + Math.min(0.6, dur / 3));
          at(env.gain, 0.3, t + dur * 0.7);
          lin(env.gain, 0, t + dur * 0.95);
        }
      }
    }
    if (variant === 'rain') {
      const n = mk(ctx.createBufferSource());
      n.buffer = noiseBuffer(ctx);
      n.loop = true;
      n.start(t0);
      srcs.push(n);
      const lp = mk(ctx.createBiquadFilter());
      lp.type = 'lowpass'; lp.frequency.value = 1200; lp.Q.value = 0.5;
      const hp = mk(ctx.createBiquadFilter());
      hp.type = 'highpass'; hp.frequency.value = 300; hp.Q.value = 0.5;
      const drift = gainN(0.75);
      n.connect(lp); lp.connect(hp); hp.connect(drift); drift.connect(master);
      for (const [hz, depth] of [[0.07, 0.15], [0.023, 0.1]]) { const l = oscN('sine', hz); const d = gainN(depth); l.connect(d); d.connect(drift.gain); }
    }
    let pair = null;
    if (variant === 'pair') {
      const left = humRootHz(opts.root, 100, 250);
      const merger = mk(ctx.createChannelMerger(2));
      const oL = oscN('sine', left);
      const oR = oscN('sine', left + rate);
      const gL = gainN(0.8);
      const gR = gainN(0.8);
      oL.connect(gL); gL.connect(merger, 0, 0);
      oR.connect(gR); gR.connect(merger, 0, 1);
      merger.connect(master);
      pair = { left, right: left + rate, beat: rate };
    }

    let stopped = false;
    return {
      nodes, output: master, rate: variant === 'breath' ? 1 / beatDur : rate, variant, pair, pulse: pulseOsc,
      get peak() { return peak; },
      stop(t = ctx.currentTime) {
        if (stopped) return;
        stopped = true;
        const fade = pick(P, opts, 'fadeOut');
        try { master.gain.cancelScheduledValues(t); } catch { /* fake or gone */ }
        const cur = Math.min(level, Number.isFinite(master.gain.value) ? master.gain.value : level);
        mw(at, cur, t);
        mw(lin, 0, t + fade);
        for (const s of srcs) {
          try { s.stop(t + fade + 0.1); } catch { /* already stopped */ }
        }
        const last = srcs[0];
        if (last) last.onended = () => { for (const n of nodes) try { n.disconnect(); } catch { /* gone */ } };
      },
    };
  },
};

export default hum;
