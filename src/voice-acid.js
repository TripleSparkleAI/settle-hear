// settle-hear · voice-acid - a resonant bass line in the acid style: one oscillator a bar through a swept low-pass, with accents and slides.
//
// <claudes_code_comments>
// ** Function List **
// ACID                       - the voice's params ([default, unit, min, max]) and its two waves
// acidLine(seed, rootMidi, mode) - 16 steps { midi | null, accent, slide }, deterministic for a seed, every pitch in
//                              the mode from the root, in two octaves
// playAcidBar(ctx, out, t0, beatDur, opts) - one bar of 16 steps on the audio clock; returns the number of notes
//
// ** Technical Review **
// - acidLine draws from a local mulberry32 stream, so a seed always gives the same line. About a quarter of the steps
//   rest. A slide on step i means step i glides into step i+1, so a slide is never set on a rest, never set before a
//   rest, and never on the last step (there is no next step inside the bar).
// - playAcidBar runs ONE oscillator for the whole bar (sawtooth or square) through a BiquadFilter low-pass with
//   Q = resonance, through one gain. Each note: the gain rises from 0 over at least TONE.attackMin to `level`
//   (an accent x1.5) and falls over TONE.releaseMin before the next step; the filter jumps to cutoff + envMod (an
//   accent: the whole peak x1.5) and decays toward `cutoff` with an exponential ramp over `decay`.
// - A SLIDE: when the previous step's slide is true, the new pitch is reached by a linear ramp from the previous pitch
//   over half a step, the gain holds (no new attack, the previous note did not release) and the filter is not
//   re-triggered. That is the classic glide.
// - THE TONE RULE on raw saws, stated honestly: `cutoff` is clamped to TONE.rawCeiling (2400 Hz), so at rest the raw
//   wave always sits behind a low-pass at or under the ceiling. The envelope peak passes the ceiling briefly (up to
//   about cutoff + envMod, x1.5 on an accent, never above 18000 Hz), and decays back under it within `decay`. That
//   brief opening IS the acid sound; the ceiling holds everywhere the voice rests.
// - Every written value is finite; the oscillator stops at the end of the bar and onended disconnects its nodes.
// </claudes_code_comments>

import { midiHz, MODES } from './tuning.js';
import { TONE } from './tone.js';

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const expo = (p, v, t) => { try { p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); } catch { p.value = v; } };
const fin = (x, d) => (Number.isFinite(+x) ? +x : d);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const FILTER_MAX = 18000;

export const ACID = {
  params: {
    cutoff: [600, 'Hz base', 100, 4000],
    resonance: [12, 'Q', 1, 25],
    envMod: [2400, 'Hz the envelope adds', 0, 6000],
    decay: [0.18, 's', 0.05, 1],
    level: [0.18, '', 0, 0.5],
  },
  waves: ['sawtooth', 'square'],
};

function rng(seed = 1) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function acidLine(seed, rootMidi, mode = 'minor pentatonic') {
  const steps = MODES[mode] ?? MODES['minor pentatonic'];
  const root = Number.isFinite(+rootMidi) ? Math.round(+rootMidi) : 45;
  const r = rng(fin(seed, 1));
  const line = [];
  for (let i = 0; i < 16; i++) {
    const rest = r() < 0.25;
    const deg = Math.floor(r() * steps.length) % steps.length;
    const oct = r() < 0.3 ? 1 : 0;
    const accent = r() < 0.3;
    const slide = r() < 0.25;
    line.push(rest ? { midi: null, accent: false, slide: false } : { midi: root + steps[deg] + 12 * oct, accent, slide });
  }
  for (let i = 0; i < 16; i++) if (line[i].slide && (i === 15 || line[i + 1].midi == null)) line[i].slide = false;
  return line;
}

const param = (k, v) => { const [d, , lo, hi] = ACID.params[k]; return clamp(fin(v, d), lo, hi); };

export function playAcidBar(ctx, out, t0, beatDur, { notes = acidLine(1, 45), cutoff, resonance, envMod, decay, level, wave = 'sawtooth' } = {}) {
  if (!Array.isArray(notes)) return 0;
  const bd = fin(beatDur, 0.5) > 0 ? fin(beatDur, 0.5) : 0.5;
  const start = fin(t0, ctx.currentTime);
  const step = bd / 4;
  const cut = Math.min(param('cutoff', cutoff), TONE.rawCeiling); // the raw wave rests behind the ceiling
  const Q = param('resonance', resonance);
  const env = param('envMod', envMod);
  const dec = param('decay', decay);
  const lev = param('level', level);
  const attack = TONE.attackMin;
  const release = TONE.releaseMin;
  const gate = Math.max(attack, step * 0.9 - release);
  const end = start + 16 * step;

  const o = ctx.createOscillator();
  o.type = ACID.waves.includes(wave) ? wave : 'sawtooth';
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = Q;
  at(lp.frequency, cut, start);
  const g = ctx.createGain();
  at(g.gain, 0, start);
  o.connect(lp);
  lp.connect(g);
  g.connect(out);

  let played = 0;
  let prevHz = null;
  for (let i = 0; i < 16 && i < notes.length; i++) {
    const nt = notes[i];
    const hz = nt && nt.midi != null ? midiHz(nt.midi) : NaN;
    if (!(hz > 15) || hz > 16000) { prevHz = null; continue; }
    const t = start + i * step;
    const prev = i > 0 ? notes[i - 1] : null;
    const sliding = !!(prev && prev.slide && prevHz != null);
    const peak = Math.min(0.75, lev * (nt.accent ? 1.5 : 1));
    if (sliding) {
      at(o.frequency, prevHz, t);
      lin(o.frequency, hz, t + step * 0.5);
    } else {
      at(o.frequency, hz, t);
      at(g.gain, 0, t);
      lin(g.gain, peak, t + attack);
      const fpeak = Math.min(FILTER_MAX, (cut + env) * (nt.accent ? 1.5 : 1));
      at(lp.frequency, Math.max(cut, fpeak), t);
      expo(lp.frequency, cut, t + dec);
    }
    if (!(nt.slide && i < 15)) {
      at(g.gain, peak, t + gate);
      lin(g.gain, 0, t + gate + release);
    }
    prevHz = hz;
    played++;
  }
  at(g.gain, 0, end);
  at(lp.frequency, cut, end);
  o.start(start);
  o.stop(end + 0.02);
  o.onended = () => { for (const n of [o, lp, g]) try { n.disconnect(); } catch { /* gone */ } };
  return played;
}
