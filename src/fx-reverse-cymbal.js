// settle-hear · fx-reverse-cymbal - THE REVERSE CYMBAL: a bright swell that stops dead on the line, a mix move.
//
// <claudes_code_comments>
// ** Function List **
// reverseCymbal              - the effect object { key, label, family, kind, line, famous, cost, params, play }
// reverseCymbal.play(ctx, bus, t0, opts) - schedules one swell on the audio clock: { nodes, until }
//
// ** Technical Review **
// - A real reverse cymbal is a crash recording played backwards: its decay becomes a swell. We have no recording,
//   so we build the shape: white noise -> a high-pass at params.hp (6 kHz) -> a peaking filter at params.ring
//   (9 kHz, Q 6, +8 dB) that gives the noise a metallic ring -> an envelope gain -> bus.input.
// - The envelope rises EXPONENTIALLY from 0.0005 to params.level across the span (opts.bars, default 1), the shape
//   a backwards decay has: almost nothing for most of the bar, then a rush in the last beat. At the line it falls
//   to 0 within 3 ms, so it stops dead on the downbeat. The source stops 10 ms after the line and its onended
//   disconnects every node.
// - Each param is [default, meaning, min, max], clamped.
// </claudes_code_comments>

import { noiseBuffer } from './engine.js';

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const expo = (p, v, t) => { try { p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); } catch { p.value = v; } };
const pick = (params, opts, k) => { const [d, , lo, hi] = params[k]; const v = Number.isFinite(+opts?.[k]) && opts?.[k] !== null ? +opts[k] : d; return Math.min(hi, Math.max(lo, v)); };
const beatOf = (opts) => (Number.isFinite(+opts?.beatDur) && +opts.beatDur > 0.05 ? +opts.beatDur : 0.5);

export const reverseCymbal = {
  key: 'reverse-cymbal', label: 'REVERSE CYMBAL', family: 'transition', kind: 'move', cost: 4,
  line: 'a bright metallic hiss that is almost silent for most of the bar, swells fast in the last beat and stops dead on the line',
  famous: 'the bar before a new section, so the crash seems to be sucked into the downbeat',
  params: {
    bars: [1, 'bars the swell spans', 0.25, 4],
    level: [0.09, 'level at the line', 0.001, 0.3],
    hp: [6000, 'Hz, the high-pass', 2000, 12000],
    ring: [9000, 'Hz, the metallic ring', 3000, 14000],
  },
  play(ctx, bus, t0, opts = {}) {
    const P = reverseCymbal.params;
    const line = t0 + pick(P, opts, 'bars') * 4 * beatOf(opts);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = pick(P, opts, 'hp');
    hp.Q.value = 0.7;
    const ring = ctx.createBiquadFilter();
    ring.type = 'peaking';
    ring.frequency.value = pick(P, opts, 'ring');
    ring.Q.value = 6;
    ring.gain.value = 8;
    const env = ctx.createGain();
    at(env.gain, 0.0005, t0);
    expo(env.gain, pick(P, opts, 'level'), line);
    lin(env.gain, 0, line + 0.003);
    src.connect(hp);
    hp.connect(ring);
    ring.connect(env);
    env.connect(bus.input);
    src.start(t0);
    src.stop(line + 0.01);
    const nodes = [src, hp, ring, env];
    src.onended = () => { for (const n of nodes) try { n.disconnect(); } catch { /* gone */ } };
    return { nodes, until: line + 0.01 };
  },
};

export default reverseCymbal;
