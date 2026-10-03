// settle-hear · voice-chop - a soft flute phrase rendered once into a buffer, then cut into slices and replayed in a new order, the way a sampler chops a loop.
//
// <claudes_code_comments>
// ** Function List **
// renderPhrase(ctx, notes, beatDur) - an AudioBuffer holding the phrase: notes [{ midi | null, beats }] played one
//                              after another, each a sine plus 0.2 of its second harmonic under a breath envelope
// CHOP_PATTERNS              - three 16-step orders of slice indices (0..7) or null: straight, skip, stutter
// chopBar(ctx, out, t0, beatDur, opts) - one bar: a buffer source per non-null step, playing its slice for a
//                              sixteenth; returns the number of slices played
//
// ** Technical Review **
// - renderPhrase is an OFFLINE RENDER, not per-sample playback: the samples are computed once, in JavaScript, into
//   a mono buffer of round(sum of beats x beatDur x sampleRate) samples, and then only played by the audio engine.
//   Each note keeps its own phase from 0; the envelope rises over TONE.attackSoft (a breath) and falls over
//   TONE.releaseSoft, both shortened to fit a short note, so every note starts and ends at zero (no click). A rest
//   (midi null) writes silence. Peak amplitude about 0.4.
// - The fake test context gives a buffer with no `duration`, so the duration is computed as length / sampleRate.
// - chopBar: step = beatDur / 4. For a non-null step, an AudioBufferSourceNode starts at t0 + step x i with
//   offset = slice x duration / slices and duration = step, through a small gain envelope (rise over
//   TONE.attackMin, fall over TONE.releaseMin ending at the slice's end where the step allows). Each source is also
//   stopped at the slice's end and disconnects its nodes in onended. A slice index is taken modulo `slices`.
// </claudes_code_comments>

import { midiHz } from './tuning.js';
import { TONE } from './tone.js';

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const fin = (x, d) => (Number.isFinite(+x) ? +x : d);

export function renderPhrase(ctx, notes, beatDur) {
  const sr = ctx.sampleRate;
  const bd = fin(beatDur, 0.5) > 0 ? fin(beatDur, 0.5) : 0.5;
  const list = Array.isArray(notes) ? notes : [];
  const beats = list.map((n) => Math.max(0, fin(n?.beats, 1)));
  const total = beats.reduce((a, b) => a + b, 0);
  const n = Math.max(1, Math.round(total * bd * sr));
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  let pos = 0;
  let acc = 0;
  for (let k = 0; k < list.length; k++) {
    acc += beats[k];
    const endPos = Math.min(n, Math.round(acc * bd * sr));
    const len = endPos - pos;
    const hz = list[k]?.midi != null ? midiHz(list[k].midi) : NaN;
    if (len > 0 && hz > 15 && hz < sr / 4) {
      const a = Math.max(1, Math.min(Math.round(TONE.attackSoft * sr), Math.floor(len / 3)));
      const r = Math.max(1, Math.min(Math.round(TONE.releaseSoft * sr), Math.floor(len / 3)));
      const w = (2 * Math.PI * hz) / sr;
      for (let i = 0; i < len; i++) {
        const env = i < a ? i / a : i > len - r ? Math.max(0, (len - i) / r) : 1;
        d[pos + i] = 0.4 * env * (Math.sin(w * i) + 0.2 * Math.sin(2 * w * i)) / 1.2;
      }
    }
    pos = endPos;
  }
  return buf;
}

export const CHOP_PATTERNS = {
  straight: [0, null, 1, null, 2, null, 3, null, 4, null, 5, null, 6, null, 7, null],
  skip: [0, null, null, 2, null, 4, null, null, 1, null, null, 3, null, 6, null, 7],
  stutter: [0, 0, null, 0, 3, 3, null, 2, 4, 4, 4, null, 6, null, 7, 7],
};

export function chopBar(ctx, out, t0, beatDur, { buffer, slices = 8, pattern = CHOP_PATTERNS.straight, level = 0.2 } = {}) {
  if (!buffer || !Array.isArray(pattern)) return 0;
  const bd = fin(beatDur, 0.5) > 0 ? fin(beatDur, 0.5) : 0.5;
  const start = fin(t0, ctx.currentTime);
  const step = bd / 4;
  const k = Math.max(1, Math.round(fin(slices, 8)));
  const dur = Number.isFinite(buffer.duration) ? buffer.duration : buffer.length / buffer.sampleRate;
  if (!(dur > 0)) return 0;
  const lev = Math.min(1, Math.max(0, fin(level, 0.2)));
  let played = 0;
  for (let i = 0; i < 16 && i < pattern.length; i++) {
    const s = pattern[i];
    if (s == null || !Number.isFinite(+s)) continue;
    const slice = ((Math.round(+s) % k) + k) % k;
    const t = start + i * step;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    at(g.gain, 0, t);
    lin(g.gain, lev, t + TONE.attackMin);
    const fall = Math.max(t + TONE.attackMin, t + step - TONE.releaseMin);
    at(g.gain, lev, fall);
    lin(g.gain, 0, fall + TONE.releaseMin);
    src.connect(g);
    g.connect(out);
    src.start(t, (slice * dur) / k, step);
    src.stop(t + step);
    src.onended = () => { for (const n of [src, g]) try { n.disconnect(); } catch { /* gone */ } };
    played++;
  }
  return played;
}
