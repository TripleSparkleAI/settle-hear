// settle-hear · fx-hall - THE HALL: a long hall reverb insert whose wet level the planner sets, a mix insert.
//
// <claudes_code_comments>
// ** Function List **
// hall                       - the effect object { key, label, family, kind, line, famous, cost, params, build }
// hall.build(ctx, p)         - { g, input, output, set(amount, t), wet } (g from house.js graph: dispose frees all)
//
// ** Technical Review **
// - An INSERT (kind 'insert'): input -> dry gain (1) -> output, and input -> a pre-delay (params.predelay, 25 ms)
//   -> a ConvolverNode on engine.js impulse(ctx, seconds, decay) (3.5 s, decay 2.2: a stereo noise tail under an
//   exponential fall) -> a low-pass at params.cut (6 kHz, a hall's air darkens) -> the wet gain -> output.
// - The wet gain starts at 0. set(amount, t) ramps it to amount x params.wet over 80 ms (a short linear ramp from
//   its value at t, no zipper noise). amount is clamped to 0 .. 1, a non-number reads as 0. The dry path is never
//   touched: the hall only ever adds.
// - The impulse buffer is generated once per (ctx, seconds, decay) and shared by every hall on that context.
// - Cost 10: four gains, one delay, one filter and a convolver (which counts 6).
// </claudes_code_comments>

import { impulse } from './engine.js';
import { graph } from './house.js';

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const irs = new WeakMap();
function hallIR(ctx, seconds, decay) {
  let m = irs.get(ctx);
  if (!m) { m = new Map(); irs.set(ctx, m); }
  const k = `${seconds}:${decay}`;
  if (!m.has(k)) m.set(k, impulse(ctx, seconds, decay));
  return m.get(k);
}

export const hall = {
  key: 'hall', label: 'HALL REVERB', family: 'space', kind: 'insert', cost: 10,
  line: 'a long concert-hall tail, three and a half seconds of darkening air behind the sound, faded in and out by the mix',
  famous: 'breakdowns and the last hit before a drop, where a long tail fills the space the drums leave',
  params: {
    wet: [0.35, 'wet level at amount 1', 0, 1],
    predelay: [0.025, 's before the tail starts', 0, 0.12],
    cut: [6000, 'Hz, the low-pass on the tail', 1500, 14000],
    seconds: [3.5, 's, the tail length', 1, 6],
    decay: [2.2, 'how fast the tail dies', 0.8, 5],
  },
  build(ctx, p = {}) {
    const g = graph(ctx);
    const v = (k) => { const [d, , lo, hi] = hall.params[k]; const x = Number.isFinite(+p[k]) ? +p[k] : d; return Math.min(hi, Math.max(lo, x)); };
    const input = g.gain(1);
    const output = g.gain(1);
    const dry = g.gain(1);
    const pre = g.delay(0.2, v('predelay'));
    const c = g.conv(hallIR(ctx, v('seconds'), v('decay')));
    const lp = g.filter('lowpass', v('cut'), 0.5);
    const wet = g.gain(0);
    input.connect(dry);
    dry.connect(output);
    input.connect(pre);
    pre.connect(c);
    c.connect(lp);
    lp.connect(wet);
    wet.connect(output);
    const scale = v('wet');
    return {
      g, input, output, wet,
      set(amount, t = ctx.currentTime) {
        const a = Number.isFinite(+amount) ? Math.min(1, Math.max(0, +amount)) : 0;
        at(wet.gain, wet.gain.value, t);
        lin(wet.gain, a * scale, t + 0.08);
      },
    };
  },
};

export default hall;
