// settle-hear · fx-silence - THE ONE-BAR SILENCE: the whole bus drops out for a bar and slams back on the drop.
//
// <claudes_code_comments>
// ** Function List **
// silence                    - the effect object { key, label, family, kind, line, famous, cost, params, play }
// silence.play(ctx, bus, t0, opts) - automates bus.level: { nodes: [], until }
//
// ** Technical Review **
// - A MOVE on the bus fader, no sources of its own (nodes is empty). With v0 = bus.level.gain.value at the call:
//   set v0 at t0, ramp linearly to 0 by t0 + params.fade (10 ms, short enough to read as a cut, long enough not to
//   click), hold 0 (an explicit set at the fade's end anchors the hold), and set v0 back EXACTLY at the line,
//   t0 + bars * 4 * beatDur. The return is a step on purpose: it is the drop, and it lands on the downbeat.
// - until = the line. By then bus.level is back at v0.
// </claudes_code_comments>

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const pick = (params, opts, k) => { const [d, , lo, hi] = params[k]; const v = Number.isFinite(+opts?.[k]) && opts?.[k] !== null ? +opts[k] : d; return Math.min(hi, Math.max(lo, v)); };
const beatOf = (opts) => (Number.isFinite(+opts?.beatDur) && +opts.beatDur > 0.05 ? +opts.beatDur : 0.5);

export const silence = {
  key: 'one-bar-silence', label: 'ONE-BAR SILENCE', family: 'transition', kind: 'move', cost: 1,
  line: 'everything cuts out for one bar, the room holds its breath, and the whole mix comes back on the downbeat',
  famous: 'the bar before the drop: the gap makes the return hit harder',
  params: {
    bars: [1, 'bars of silence', 0.25, 2],
    fade: [0.01, 's, the cut ramp', 0.003, 0.05],
  },
  play(ctx, bus, t0, opts = {}) {
    const P = silence.params;
    const line = t0 + pick(P, opts, 'bars') * 4 * beatOf(opts);
    const fade = pick(P, opts, 'fade');
    const g = bus.level.gain;
    const v0 = Number.isFinite(g.value) ? g.value : 1;
    at(g, v0, t0);
    lin(g, 0, t0 + fade);
    at(g, 0, t0 + fade);
    at(g, v0, line);
    return { nodes: [], until: line };
  },
};

export default silence;
