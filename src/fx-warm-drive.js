// settle-hear · fx-warm-drive - WARM DRIVE: a melodic voice pushed gently into a soft curve, the one effect every
// processed melodic instrument carries (lane MELODYFX, 2026-10-02).
//
// <claudes_code_comments>
// ** Function List **
// HEADROOM                   - how far into the curve a full-scale input reaches (the curve is tanh(H x) / H)
// driveCurve(character, n)   - the WaveShaper curve: 0 tanh, 1 valve (an offset tanh, even harmonics), 2 tape (atan,
//                              the softest knee); every curve has slope 1 at 0, so a quiet signal passes at unity
// warmDrive                  - the effect object { key, label, family, kind, line, famous, cost, params, build }
// warmDrive.build(ctx, p)    - { g, input, output }: input -> pre gain (drive) -> curve -> DC block -> tone low-pass
//                              -> post gain (makeup / drive)
//
// ** Technical Review **
// - THE LEVEL RULE: the pre gain is `drive` and the post gain is makeup / drive, and every curve has slope 1 at 0,
//   so a quiet note comes out at `makeup` times the level it went in (1 by default, at most 1.2 in a gentle chain).
//   A loud one is rounded off: the output can never exceed makeup x 0.36 / drive (0.36 is the valve curve's top),
//   at most 0.32 for every chain voice-fx.js deals, against a voice that peaks near 0.1. Saturation starts where
//   drive x HEADROOM x level reaches 1, a peak of 0.125 at drive 2:
//   the melodic voices peak near 0.1, so the default is a small distortion, and the distorted flute's drive of 3.5
//   to 5 is a clear one (its makeup of 1.8 to 2.4 gives back the loudness the hard curve takes).
// - THE VALVE curve is tanh(H x + b) minus tanh(b), divided by its own slope at 0: an asymmetric curve that adds
//   even harmonics (the second, the octave), which reads as warmth. Its DC offset is taken out by an 18 Hz high-pass.
// - The WaveShaper oversamples 2x, so the curve's new harmonics above the voice do not fold back as aliasing.
// - Cost 3: two gains, one shaper, two filters.
// </claudes_code_comments>

import { graph } from './house.js';

export const HEADROOM = 4;
const VALVE_BIAS = 0.32;

export function driveCurve(character = 0, n = 2048) {
  const c = new Float32Array(n);
  const k = Math.round(Number.isFinite(+character) ? +character : 0);
  const H = HEADROOM;
  const valveSlope = 1 - Math.tanh(VALVE_BIAS) ** 2;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    if (k === 1) c[i] = (Math.tanh(H * x + VALVE_BIAS) - Math.tanh(VALVE_BIAS)) / (H * valveSlope);
    else if (k === 2) c[i] = Math.atan(H * x) / H;
    else c[i] = Math.tanh(H * x) / H;
  }
  return c;
}

export const warmDrive = {
  key: 'warm-drive', label: 'WARM DRIVE', family: 'grit', kind: 'insert', cost: 3,
  line: 'the voice pushed gently into a soft curve: the peaks rounded, a little warmth and grain added, the top rolled off',
  famous: 'tape and valve saturation on a lead line or an electric piano, the warm grain of lo-fi house and every tape machine',
  params: {
    drive: [2, 'how hard the voice hits the curve', 1.2, 5],
    character: [0, 'the curve: 0 tanh, 1 valve (even harmonics), 2 tape (the softest knee)', 0, 2],
    tone: [5200, 'Hz, the low-pass after the curve', 1800, 12000],
    makeup: [1, 'level after the curve (a hard drive loses loudness; this gives some back)', 1, 2.5],
  },
  build(ctx, p = {}) {
    const v = (k) => { const [d, , lo, hi] = warmDrive.params[k]; const x = Number.isFinite(+p[k]) ? +p[k] : d; return Math.min(hi, Math.max(lo, x)); };
    const g = graph(ctx);
    const drive = v('drive');
    const input = g.gain(drive);
    const shaper = g.shaper(driveCurve(v('character')), '2x');
    const dc = g.filter('highpass', 18, 0.7);
    const tone = g.filter('lowpass', v('tone'), 0.6);
    const output = g.gain(v('makeup') / drive);
    input.connect(shaper);
    shaper.connect(dc);
    dc.connect(tone);
    tone.connect(output);
    return { g, input, output };
  },
};

export default warmDrive;
