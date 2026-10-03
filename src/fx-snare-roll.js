// settle-hear · fx-snare-roll - THE SNARE ROLL: the build that doubles its rate into the drop, a mix move.
//
// <claudes_code_comments>
// ** Function List **
// snareRoll                  - the effect object { key, label, family, kind, line, famous, cost, params, play }
// rollTimes(t0, beats, beatDur) - pure: the hit times of a roll over `beats` beats: eighths for the first half,
//                              sixteenths up to the last beat, thirty-seconds in the last beat
// snareRoll.play(ctx, bus, t0, opts) - schedules every hit: { nodes, until, hits }
//
// ** Technical Review **
// - THE GRID: a roll of B = bars * 4 beats plays two hits a beat (eighths) over the first half, four a beat
//   (sixteenths) until the last beat, and eight in the last beat (thirty-seconds). With bars = 2 that is 8 + 12 + 8
//   = 28 hits, the last one a thirty-second before the line.
// - ONE HIT: white noise (offset into the shared buffer so hits differ) -> a band-pass near params.tone (1.8 kHz)
//   -> its own envelope (4 ms attack, a short exponential decay); and a triangle body tone -> its own envelope. Both
//   sources stop themselves and their onended disconnects the hit's nodes, so a long roll never accumulates live
//   nodes.
// - THE RISE: with u the hit's place in the span (0 at t0, 1 at the line), the level climbs from 30 percent to
//   params.level, the band-pass centre from tone to 1.4 x tone, and the body tone rises params.rise semitones from
//   its start, a pitch from midiHz (root moved into 150 .. 300 Hz). The roll ends on the line; the next downbeat
//   carries the drop.
// </claudes_code_comments>

import { noiseBuffer } from './engine.js';
import { midiHz } from './tuning.js';
import { TONE } from './tone.js';

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const expo = (p, v, t) => { try { p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); } catch { p.value = v; } };
const pick = (params, opts, k) => { const [d, , lo, hi] = params[k]; const v = Number.isFinite(+opts?.[k]) && opts?.[k] !== null ? +opts[k] : d; return Math.min(hi, Math.max(lo, v)); };
const beatOf = (opts) => (Number.isFinite(+opts?.beatDur) && +opts.beatDur > 0.05 ? +opts.beatDur : 0.5);

export function rollTimes(t0, beats, beatDur) {
  const B = Math.max(1, Math.round(beats));
  const out = [];
  for (let b = 0; b < B; b++) {
    const per = b === B - 1 ? 8 : b < B / 2 ? 2 : 4;
    for (let k = 0; k < per; k++) out.push(t0 + (b + k / per) * beatDur);
  }
  return out;
}

function bodyMidi(root) {
  let m = Number.isFinite(+root) ? +root : 57;
  while (midiHz(m) > 300) m -= 12;
  while (midiHz(m) < 150) m += 12;
  return m;
}

export const snareRoll = {
  key: 'snare-roll', label: 'SNARE ROLL BUILD', family: 'transition', kind: 'move', cost: 5,
  line: 'snare hits that go from eighths to sixteenths to thirty-seconds, louder and higher each beat, rolling into the drop',
  famous: 'the classic build before a drop: two to eight bars of snare that speeds up and climbs',
  params: {
    bars: [2, 'bars the roll spans', 0.5, 8],
    level: [0.22, 'level of the last hits', 0.02, 0.6],
    tone: [1800, 'Hz, the band-pass on the noise', 600, 5000],
    rise: [7, 'semitones the body climbs', 0, 12],
    body: [0.35, 'body tone level, relative to the noise', 0, 1],
  },
  play(ctx, bus, t0, opts = {}) {
    const P = snareRoll.params;
    const beatDur = beatOf(opts);
    const bars = pick(P, opts, 'bars');
    const span = bars * 4 * beatDur;
    const line = t0 + span;
    const level = pick(P, opts, 'level');
    const tone = pick(P, opts, 'tone');
    const rise = pick(P, opts, 'rise');
    const bodyLevel = pick(P, opts, 'body');
    const m0 = bodyMidi(opts.root);
    const hits = rollTimes(t0, bars * 4, beatDur);
    const nodes = [];
    let until = line;
    hits.forEach((t, i) => {
      const u = (t - t0) / span;
      const peak = level * (0.3 + 0.7 * u);
      const decay = Math.max(TONE.releaseMin, 0.11 - 0.05 * u);
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = tone * (1 + 0.4 * u);
      bp.Q.value = 1.1;
      const ne = ctx.createGain();
      at(ne.gain, 0, t);
      lin(ne.gain, peak, t + TONE.attackMin);
      expo(ne.gain, 0.0005, t + TONE.attackMin + decay);
      src.connect(bp);
      bp.connect(ne);
      ne.connect(bus.input);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      at(o.frequency, midiHz(m0 + rise * u), t);
      const be = ctx.createGain();
      at(be.gain, 0, t);
      lin(be.gain, peak * bodyLevel, t + TONE.attackMin);
      expo(be.gain, 0.0005, t + TONE.attackMin + decay * 0.8);
      o.connect(be);
      be.connect(bus.input);
      const end = t + TONE.attackMin + decay + 0.03;
      src.start(t, ((i * 0.137) % 1.5));
      src.stop(end);
      o.start(t);
      o.stop(end);
      const mine = [src, bp, ne, o, be];
      src.onended = () => { for (const n of [src, bp, ne]) try { n.disconnect(); } catch { /* gone */ } };
      o.onended = () => { for (const n of [o, be]) try { n.disconnect(); } catch { /* gone */ } };
      nodes.push(...mine);
      until = Math.max(until, end);
    });
    return { nodes, until, hits };
  },
};

export default snareRoll;
