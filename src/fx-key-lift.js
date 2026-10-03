// settle-hear · fx-key-lift - THE KEY LIFT: the whole tune steps up a semitone or two, with a small swell into it.
//
// <claudes_code_comments>
// ** Function List **
// keyLift(semitones)         - pure: the lift, clamped to 1 or 2 semitones (a non-number gives 2)
// keyLiftFx                  - the effect object { key, label, family, kind, line, famous, cost, params, play }
// keyLiftFx.play(ctx, bus, t0, opts) - a quiet sine glide into the line: { nodes, until, lift }
//
// ** Technical Review **
// - The lift itself is NOT applied here: the lane's planner adds `lift` semitones to the melody and the chords from
//   the line on. This move only announces it: a sine at midiHz(root) (moved up by octaves until it is at least
//   110 Hz, so it is heard and never felt as sub) glides exponentially to midiHz(root + lift) over the span, while
//   its gain swells from 0 to params.level (very quiet) and releases after the line over TONE.releaseSoft.
// - The oscillator stops itself just after the release and its onended disconnects it and its gain.
// </claudes_code_comments>

import { midiHz } from './tuning.js';
import { TONE } from './tone.js';

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const expo = (p, v, t) => { try { p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); } catch { p.value = v; } };
const pick = (params, opts, k) => { const [d, , lo, hi] = params[k]; const v = Number.isFinite(+opts?.[k]) && opts?.[k] !== null ? +opts[k] : d; return Math.min(hi, Math.max(lo, v)); };
const beatOf = (opts) => (Number.isFinite(+opts?.beatDur) && +opts.beatDur > 0.05 ? +opts.beatDur : 0.5);

export function keyLift(semitones) {
  const s = Number(semitones);
  if (!Number.isFinite(s)) return 2;
  return s < 1.5 ? 1 : 2;
}

export const keyLiftFx = {
  key: 'key-lift', label: 'KEY-CHANGE LIFT', family: 'transition', kind: 'move', cost: 2,
  line: 'the whole tune steps up a semitone or two at the line, announced by a faint tone gliding up the same step',
  famous: 'the last chorus or the last big section of a track, to lift it once more',
  params: {
    semitones: [2, 'the lift, 1 or 2', 1, 2],
    bars: [1, 'bars the glide spans', 0.25, 4],
    level: [0.03, 'the glide tone, very quiet', 0, 0.1],
  },
  play(ctx, bus, t0, opts = {}) {
    const P = keyLiftFx.params;
    const lift = keyLift(pick(P, opts, 'semitones'));
    const line = t0 + pick(P, opts, 'bars') * 4 * beatOf(opts);
    let m = Number.isFinite(+opts.root) ? +opts.root : 57;
    while (midiHz(m) < 110) m += 12;
    const o = ctx.createOscillator();
    o.type = 'sine';
    at(o.frequency, midiHz(m), t0);
    expo(o.frequency, midiHz(m + lift), line);
    const e = ctx.createGain();
    at(e.gain, 0, t0);
    lin(e.gain, pick(P, opts, 'level'), line);
    lin(e.gain, 0, line + TONE.releaseSoft);
    o.connect(e);
    e.connect(bus.input);
    o.start(t0);
    const until = line + TONE.releaseSoft + 0.02;
    o.stop(until);
    o.onended = () => { for (const n of [o, e]) try { n.disconnect(); } catch { /* gone */ } };
    return { nodes: [o, e], until, lift };
  },
};

export default keyLiftFx;
