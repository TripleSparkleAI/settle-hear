// settle-hear · fx-riser - THE RISER: a white-noise sweep that climbs into the next downbeat, a mix move.
//
// <claudes_code_comments>
// ** Function List **
// riser                      - the effect object { key, label, family, kind, line, famous, cost, params, play }
// riser.play(ctx, bus, t0, opts) - schedules one rise on the audio clock: { nodes, until }
//
// ** Technical Review **
// - A one-shot MOVE (kind 'move'): white noise (engine.js noiseBuffer, looped) -> a band-pass whose centre sweeps
//   exponentially from params.lo (300 Hz) to params.hi (8 kHz) -> an envelope gain that climbs linearly from 0 to
//   params.level -> bus.input. The span is opts.bars bars of four beats (default 2), so the sweep and the climb both
//   peak at t0 + bars * 4 * beatDur, the next downbeat.
// - At the line the level is cut to 0 within 6 ms (a ramp, never a step, so the cut does not click), and the noise
//   source stops 50 ms later. The source's onended disconnects all three nodes, so the move frees itself.
// - Each param is [default, meaning, min, max]; opts values are clamped into [min, max] and a non-number falls back
//   to the default. Nothing here touches bus.level or bus.filter.
// </claudes_code_comments>

import { noiseBuffer } from './engine.js';

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const expo = (p, v, t) => { try { p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); } catch { p.value = v; } };
const pick = (params, opts, k) => { const [d, , lo, hi] = params[k]; const v = Number.isFinite(+opts?.[k]) && opts?.[k] !== null ? +opts[k] : d; return Math.min(hi, Math.max(lo, v)); };
const beatOf = (opts) => (Number.isFinite(+opts?.beatDur) && +opts.beatDur > 0.05 ? +opts.beatDur : 0.5);

export const riser = {
  key: 'riser', label: 'NOISE RISER', family: 'transition', kind: 'move', cost: 3,
  line: 'white noise swept up from a low hiss to a bright rush while it gets louder, landing on the next downbeat and cut there',
  famous: 'the last two to eight bars of a build, into the drop',
  params: {
    bars: [2, 'bars the rise spans', 0.5, 16],
    level: [0.12, 'level at the top', 0, 0.4],
    lo: [300, 'Hz, the start of the sweep', 60, 2000],
    hi: [8000, 'Hz, the top of the sweep', 2000, 16000],
    Q: [2, 'band-pass narrowness', 0.3, 12],
  },
  play(ctx, bus, t0, opts = {}) {
    const P = riser.params;
    const beatDur = beatOf(opts);
    const line = t0 + pick(P, opts, 'bars') * 4 * beatDur;
    const level = pick(P, opts, 'level');
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = pick(P, opts, 'Q');
    at(bp.frequency, pick(P, opts, 'lo'), t0);
    expo(bp.frequency, pick(P, opts, 'hi'), line);
    const env = ctx.createGain();
    at(env.gain, 0.0001, t0);
    expo(env.gain, level, line);
    lin(env.gain, 0, line + 0.006);
    src.connect(bp);
    bp.connect(env);
    env.connect(bus.input);
    src.start(t0);
    src.stop(line + 0.05);
    const nodes = [src, bp, env];
    src.onended = () => { for (const n of nodes) try { n.disconnect(); } catch { /* gone */ } };
    return { nodes, until: line + 0.05 };
  },
};

export default riser;
