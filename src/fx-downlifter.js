// settle-hear · fx-downlifter - THE DOWNLIFTER: a noise sweep that falls away after a drop, a mix move.
//
// <claudes_code_comments>
// ** Function List **
// downlifter                 - the effect object { key, label, family, kind, line, famous, cost, params, play }
// downlifter.play(ctx, bus, t0, opts) - schedules one fall on the audio clock: { nodes, until }
//
// ** Technical Review **
// - The riser in reverse. White noise -> a band-pass whose centre falls exponentially from params.hi (8 kHz) to
//   params.lo (300 Hz) -> an envelope gain -> bus.input. It starts at t0, normally the downbeat of a drop, and spans
//   opts.bars bars (default 1).
// - The envelope opens in 10 ms (a soft start, no click) to params.level and decays exponentially to near 0 by the
//   end of the span; the source stops 50 ms later and its onended disconnects every node.
// - Each param is [default, meaning, min, max], clamped. It leaves bus.level and bus.filter alone.
// </claudes_code_comments>

import { noiseBuffer } from './engine.js';

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const expo = (p, v, t) => { try { p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); } catch { p.value = v; } };
const pick = (params, opts, k) => { const [d, , lo, hi] = params[k]; const v = Number.isFinite(+opts?.[k]) && opts?.[k] !== null ? +opts[k] : d; return Math.min(hi, Math.max(lo, v)); };
const beatOf = (opts) => (Number.isFinite(+opts?.beatDur) && +opts.beatDur > 0.05 ? +opts.beatDur : 0.5);

export const downlifter = {
  key: 'downlifter', label: 'DOWNLIFTER', family: 'transition', kind: 'move', cost: 3,
  line: 'a bright rush of noise that falls to a low hiss and fades over one bar, the dust settling after a drop',
  famous: 'the first bar after a drop, or the start of a breakdown',
  params: {
    bars: [1, 'bars the fall spans', 0.25, 8],
    level: [0.1, 'level at the start', 0.001, 0.4],
    hi: [8000, 'Hz, the start of the fall', 2000, 16000],
    lo: [300, 'Hz, the bottom', 60, 2000],
    Q: [1.6, 'band-pass narrowness', 0.3, 12],
  },
  play(ctx, bus, t0, opts = {}) {
    const P = downlifter.params;
    const end = t0 + pick(P, opts, 'bars') * 4 * beatOf(opts);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = pick(P, opts, 'Q');
    at(bp.frequency, pick(P, opts, 'hi'), t0);
    expo(bp.frequency, pick(P, opts, 'lo'), end);
    const env = ctx.createGain();
    at(env.gain, 0, t0);
    lin(env.gain, pick(P, opts, 'level'), t0 + 0.01);
    expo(env.gain, 0.0005, end);
    src.connect(bp);
    bp.connect(env);
    env.connect(bus.input);
    src.start(t0);
    src.stop(end + 0.05);
    const nodes = [src, bp, env];
    src.onended = () => { for (const n of nodes) try { n.disconnect(); } catch { /* gone */ } };
    return { nodes, until: end + 0.05 };
  },
};

export default downlifter;
