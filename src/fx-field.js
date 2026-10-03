// settle-hear · fx-field - FIELD TEXTURES: wind, water and birds built in code, quiet beds under a set.
//
// <claudes_code_comments>
// ** Function List **
// FIELD_MAX_LEVEL            - 0.05: a field texture's output never goes above this gain
// FIELD_VARIANTS             - 'wind', 'water', 'birds'
// fieldRng(seed)             - a seeded stream (mulberry32): the texture's random events repeat for a seed
// fieldTexture               - the effect object { key, label, family, kind, line, famous, cost, params, start }
// fieldTexture.start(ctx, out, t0, opts) - { nodes, peak, output, events, stop(t) }
//
// ** Technical Review **
// - No recordings: every texture is synthesised from the shared white-noise buffer and sines.
// - 'wind': noise -> a band-pass (Q 1.2) centred at 600 Hz and swept by two slow sines (0.05 Hz +- 350 Hz,
//   0.013 Hz +- 150 Hz) -> a gust gain (base 0.6, a 0.031 Hz sine +- 0.3). The sweep is the howl, the gust the
//   rise and fall.
// - 'water': noise -> three resonant band-passes (Q 10 at 500, 900, 1600 Hz, each centre drifting +- 15 percent at
//   its own slow rate) at 0.2 each, plus soft blips: ONE sine whose frequency jumps to midiHz(72 .. 84) and glides up
//   by a factor of 1.6 in 50 ms while its gain flicks to 0.35 and decays in 80 ms (a bubble). Blips come 0.4 to 2.2 s
//   apart from the seeded stream.
// - 'birds': ONE sine, silent between chirps. A cluster of two or three chirps every 4 to 12 s; each chirp starts
//   at midiHz(97 .. 105) and glides up a fifth (midiHz(m + 7)) in 70 ms. Rare, short, very quiet.
// - The blips and chirps are automation on one oscillator, scheduled up front for params.horizon seconds (300 by
//   default): no node is made per event. After the horizon the noise beds go on and the events stop.
// - THE LEVEL: one master gain fades from 0 to the level (opts.level clamped to 0 .. FIELD_MAX_LEVEL) over
//   params.fadeIn; every gain before it sums under 1. peak is the largest value written on the master. stop(t)
//   fades over params.fadeOut and stops every source after it.
// </claudes_code_comments>

import { midiHz } from './tuning.js';
import { noiseBuffer } from './engine.js';

export const FIELD_MAX_LEVEL = 0.05;
export const FIELD_VARIANTS = ['wind', 'water', 'birds'];

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const expo = (p, v, t) => { try { p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); } catch { p.value = v; } };
const pick = (params, opts, k) => { const [d, , lo, hi] = params[k]; const v = Number.isFinite(+opts?.[k]) && opts?.[k] !== null ? +opts[k] : d; return Math.min(hi, Math.max(lo, v)); };

export function fieldRng(seed = 1) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const fieldTexture = {
  key: 'field-texture', label: 'FIELD TEXTURE', family: 'space', kind: 'bed', cost: 6,
  line: 'a faint outdoor sound made in code: wind rising and falling, water with small bubbles, or a bird now and then',
  famous: 'ambient house intros and Balearic warm-ups, where a field recording sits under the first chords',
  params: {
    level: [0.03, 'output level, capped at 0.05', 0, FIELD_MAX_LEVEL],
    seed: [1, 'which pattern of blips and chirps', 1, 1e6],
    horizon: [300, 's of scheduled blips and chirps', 10, 1800],
    fadeIn: [3, 's to fade in', 0.5, 12],
    fadeOut: [2, 's to fade out on stop', 0.3, 12],
  },
  start(ctx, out, t0, opts = {}) {
    const P = fieldTexture.params;
    const variant = FIELD_VARIANTS.includes(opts.variant) ? opts.variant : 'wind';
    const level = pick(P, opts, 'level');
    const r = fieldRng(pick(P, opts, 'seed'));
    const end = t0 + pick(P, opts, 'horizon');
    const nodes = [];
    const srcs = [];
    const events = [];
    const mk = (n) => { nodes.push(n); return n; };
    const gainN = (v) => { const g = mk(ctx.createGain()); g.gain.value = v; return g; };
    const oscN = (type, f) => { const o = mk(ctx.createOscillator()); o.type = type; o.frequency.value = f; o.start(t0); srcs.push(o); return o; };
    const filt = (type, f, Q) => { const b = mk(ctx.createBiquadFilter()); b.type = type; b.frequency.value = f; b.Q.value = Q; return b; };
    const noise = () => { const n = mk(ctx.createBufferSource()); n.buffer = noiseBuffer(ctx); n.loop = true; n.start(t0); srcs.push(n); return n; };
    const lfoTo = (hz, depth, param) => { const l = oscN('sine', hz); const d = gainN(depth); l.connect(d); d.connect(param); };
    let peak = 0;
    const master = gainN(0);
    const mw = (fn, v, t) => { peak = Math.max(peak, v); fn(master.gain, v, t); };
    mw(at, 0, t0);
    mw(lin, level, t0 + pick(P, opts, 'fadeIn'));
    master.connect(out);

    if (variant === 'wind') {
      const n = noise();
      const bp = filt('bandpass', 600, 1.2);
      const gust = gainN(0.6);
      n.connect(bp); bp.connect(gust); gust.connect(master);
      lfoTo(0.05, 350, bp.frequency);
      lfoTo(0.013, 150, bp.frequency);
      lfoTo(0.031, 0.3, gust.gain);
    }
    if (variant === 'water') {
      const n = noise();
      [[500, 0.11], [900, 0.07], [1600, 0.17]].forEach(([f, hz]) => {
        const bp = filt('bandpass', f, 10);
        const g = gainN(0.2);
        n.connect(bp); bp.connect(g); g.connect(master);
        lfoTo(hz, f * 0.15, bp.frequency);
      });
      const o = oscN('sine', 600);
      const e = gainN(0);
      o.connect(e); e.connect(master);
      for (let t = t0 + 0.4 + r() * 1.8; t < end; t += 0.4 + r() * 1.8) {
        const f = midiHz(72 + Math.floor(r() * 13));
        at(o.frequency, f, t);
        expo(o.frequency, f * 1.6, t + 0.05);
        at(e.gain, 0, t);
        lin(e.gain, 0.35, t + 0.004);
        expo(e.gain, 0.0005, t + 0.084);
        events.push(t);
      }
    }
    if (variant === 'birds') {
      const o = oscN('sine', 3000);
      const e = gainN(0);
      o.connect(e); e.connect(master);
      for (let t = t0 + 2 + r() * 6; t < end; t += 4 + r() * 8) {
        const k = 2 + Math.floor(r() * 2);
        for (let c = 0; c < k; c++) {
          const tc = t + c * 0.12;
          const m = 97 + Math.floor(r() * 9);
          at(o.frequency, midiHz(m), tc);
          expo(o.frequency, midiHz(m + 7), tc + 0.07);
          at(e.gain, 0, tc);
          lin(e.gain, 0.5, tc + 0.006);
          expo(e.gain, 0.0005, tc + 0.07);
          events.push(tc);
        }
      }
    }
    let stopped = false;
    return {
      nodes, output: master, events, variant,
      get peak() { return peak; },
      stop(t = ctx.currentTime) {
        if (stopped) return;
        stopped = true;
        const fade = pick(P, opts, 'fadeOut');
        try { master.gain.cancelScheduledValues(t); } catch { /* fake or gone */ }
        mw(at, Math.min(level, Number.isFinite(master.gain.value) ? master.gain.value : level), t);
        mw(lin, 0, t + fade);
        for (const s of srcs) try { s.stop(t + fade + 0.1); } catch { /* already stopped */ }
        if (srcs[0]) srcs[0].onended = () => { for (const n of nodes) try { n.disconnect(); } catch { /* gone */ } };
      },
    };
  },
};

export default fieldTexture;
