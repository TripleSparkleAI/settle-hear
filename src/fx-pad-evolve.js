// settle-hear · fx-pad-evolve - THE EVOLVING PAD: a slow soft chord whose tone and voicing drift over many bars.
//
// <claudes_code_comments>
// ** Function List **
// PAD_MAX_LEVEL              - 0.06: the pad's output never goes above this gain
// padVoicing(chord, lo, hi)  - pure: up to four midi notes, each moved by octaves into midiHz [lo, hi]
// evolvingPad                - the effect object { key, label, family, kind, line, famous, cost, params, start }
// evolvingPad.start(ctx, out, t0, opts) - { nodes, peak, output, notes, stop(t) }
//
// ** Technical Review **
// - A BED (kind 'bed'). opts.chord (midi notes) or, by default, a minor seventh on opts.root (root, +3, +7, +10).
//   Up to four voices, each one triangle at midiHz(note) moved into 110 .. 440 Hz, detuned by tone.js gentleDetune
//   across +- 6 cents, so the chord shimmers a little instead of sitting still.
// - THE DRIFT: each voice's gain sits at 0.18 and a very slow sine moves it by +- 0.06, each voice at its own rate
//   (the drift period x 1, 1.37, 1.74, 2.11), so the loudest note of the chord changes over time: the voicing moves.
//   The drift period is params.bars bars (12 by default, 8 to 16 is the intended range). A low-pass at params.cutoff
//   (900 Hz) is moved +- params.sweep (450 Hz) by a sine at one cycle per drift period: the tone opens and closes.
// - THE LEVEL: four voices at 0.24 at most sum under 1, then one master gain fades from 0 to the level (opts.level
//   clamped to 0 .. PAD_MAX_LEVEL) over params.fadeIn (3 s). peak is the largest value written on the master.
//   stop(t) fades over params.fadeOut and stops every oscillator after it.
// </claudes_code_comments>

import { midiHz } from './tuning.js';
import { gentleDetune } from './tone.js';

export const PAD_MAX_LEVEL = 0.06;

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const pick = (params, opts, k) => { const [d, , lo, hi] = params[k]; const v = Number.isFinite(+opts?.[k]) && opts?.[k] !== null ? +opts[k] : d; return Math.min(hi, Math.max(lo, v)); };

export function padVoicing(chord, lo = 110, hi = 440) {
  return (Array.isArray(chord) ? chord : []).filter((m) => Number.isFinite(+m)).slice(0, 4).map((m) => {
    let x = +m;
    while (midiHz(x) > hi) x -= 12;
    while (midiHz(x) < lo) x += 12;
    return x;
  });
}

export const evolvingPad = {
  key: 'evolving-pad', label: 'EVOLVING PAD', family: 'space', kind: 'bed', cost: 10,
  line: 'a soft slow chord of four gentle voices whose brightness and loudest note drift over a dozen bars, never still',
  famous: 'intros, breakdowns and deep house beds, under everything else',
  params: {
    level: [0.04, 'output level, capped at 0.06', 0, PAD_MAX_LEVEL],
    bars: [12, 'bars per drift cycle', 8, 16],
    cutoff: [900, 'Hz, the low-pass centre', 300, 2400],
    sweep: [450, 'Hz the low-pass moves either side', 0, 900],
    fadeIn: [3, 's to fade in', 0.5, 12],
    fadeOut: [2, 's to fade out on stop', 0.3, 12],
  },
  start(ctx, out, t0, opts = {}) {
    const P = evolvingPad.params;
    const beatDur = Number.isFinite(+opts.beatDur) && +opts.beatDur > 0.1 ? +opts.beatDur : 0.5;
    const root = Number.isFinite(+opts.root) ? +opts.root : 57;
    const notes = padVoicing(Array.isArray(opts.chord) && opts.chord.length ? opts.chord : [root, root + 3, root + 7, root + 10]);
    const level = pick(P, opts, 'level');
    const period = pick(P, opts, 'bars') * 4 * beatDur;
    const nodes = [];
    const srcs = [];
    const mk = (n) => { nodes.push(n); return n; };
    const gainN = (v) => { const g = mk(ctx.createGain()); g.gain.value = v; return g; };
    const oscN = (type, f) => { const o = mk(ctx.createOscillator()); o.type = type; o.frequency.value = f; o.start(t0); srcs.push(o); return o; };
    let peak = 0;
    const master = gainN(0);
    const mw = (fn, v, t) => { peak = Math.max(peak, v); fn(master.gain, v, t); };
    mw(at, 0, t0);
    mw(lin, level, t0 + pick(P, opts, 'fadeIn'));
    master.connect(out);
    const lp = mk(ctx.createBiquadFilter());
    lp.type = 'lowpass';
    lp.frequency.value = pick(P, opts, 'cutoff');
    lp.Q.value = 0.8;
    lp.connect(master);
    const sweep = oscN('sine', 1 / period);
    const sd = gainN(pick(P, opts, 'sweep'));
    sweep.connect(sd);
    sd.connect(lp.frequency);
    notes.forEach((m, i) => {
      const o = oscN('triangle', midiHz(m));
      o.detune.value = gentleDetune(i, notes.length, 6);
      const v = gainN(0.18);
      o.connect(v);
      v.connect(lp);
      const drift = oscN('sine', 1 / (period * (1 + 0.37 * i)));
      const dd = gainN(0.06);
      drift.connect(dd);
      dd.connect(v.gain);
    });
    let stopped = false;
    return {
      nodes, output: master, notes,
      get peak() { return peak; },
      stop(t = ctx.currentTime) {
        if (stopped) return;
        stopped = true;
        const fade = pick(P, opts, 'fadeOut');
        try { master.gain.cancelScheduledValues(t); } catch { /* fake or gone */ }
        mw(at, Math.min(level, Number.isFinite(master.gain.value) ? master.gain.value : level), t);
        mw(lin, 0, t + fade);
        for (const s of srcs) try { s.stop(t + fade + 0.1); } catch { /* already stopped */ }
        if (srcs[0]) srcs[0].onended = () => { for (const n of nodes) try { n.disconnect(); } catch { /* gone */ } };
      },
    };
  },
};

export default evolvingPad;
