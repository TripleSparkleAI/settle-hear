// settle-hear · fx-sidechain - THE SIDECHAIN DUCK: a gain that dips on every beat, its depth set by the mix.
//
// <claudes_code_comments>
// ** Function List **
// sidechain                  - the effect object { key, label, family, kind, line, famous, cost, params, build }
// sidechain.build(ctx, p)    - { g, input, output, set(amount, t), bar(t0, { beatDur }), amount() }
//
// ** Technical Review **
// - An INSERT of one GainNode (input and output are the same node). It is the house.js 'pump' pass with a depth
//   control: bar(t0, info) schedules four ducks, one per beat, each a set to the floor on the beat and a linear ramp
//   back to 1 over params.back beats. The floor is 1 - amount x params.depth, so amount 0 writes floor 1 (no duck
//   at all) and amount 1 ducks to 1 - depth (0.3 with the default 0.7).
// - set(amount, t) stores amount (clamped to 0 .. 1, a non-number reads as 0) and sets the gain to 1 at t, so a
//   change of depth never strands the gain mid-duck; the next bar schedules the new ducks.
// - A real sidechain compressor listens to the kick. Our kick is scheduled on the same clock, so the duck is drawn
//   on the beat directly, which lands exactly where a key-input compressor would act.
// </claudes_code_comments>

import { graph } from './house.js';

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };

export const sidechain = {
  key: 'sidechain', label: 'SIDECHAIN DUCK', family: 'rhythm', kind: 'insert', cost: 1,
  line: 'the layer dips on every kick and swells back before the next, so the music breathes with the beat',
  famous: 'on pads, bass and the whole mix in nearly every house track since the late 1990s',
  params: {
    depth: [0.7, 'how far it ducks at amount 1', 0, 1],
    back: [0.55, 'beats to swell back', 0.1, 1],
  },
  build(ctx, p = {}) {
    const g = graph(ctx);
    const v = (k) => { const [d, , lo, hi] = sidechain.params[k]; const x = Number.isFinite(+p[k]) ? +p[k] : d; return Math.min(hi, Math.max(lo, x)); };
    const depth = v('depth');
    const back = v('back');
    const node = g.gain(1);
    let amount = Number.isFinite(+p.amount) ? Math.min(1, Math.max(0, +p.amount)) : 1;
    return {
      g, input: node, output: node,
      amount: () => amount,
      set(a, t = ctx.currentTime) {
        amount = Number.isFinite(+a) ? Math.min(1, Math.max(0, +a)) : 0;
        at(node.gain, 1, t);
      },
      bar(t0, { beatDur = 0.5 } = {}) {
        const floor = 1 - amount * depth;
        for (let b = 0; b < 4; b++) {
          const t = t0 + b * beatDur;
          at(node.gain, floor, t);
          lin(node.gain, 1, t + back * beatDur);
        }
      },
    };
  },
};

export default sidechain;
