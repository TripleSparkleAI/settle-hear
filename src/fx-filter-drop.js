// settle-hear · fx-filter-drop - THE FILTER DROP: the bus low-pass closes over a bar and snaps open on the line.
//
// <claudes_code_comments>
// ** Function List **
// filterDrop                 - the effect object { key, label, family, kind, line, famous, cost, params, play }
// filterDrop.play(ctx, bus, t0, opts) - automates bus.filter.frequency: { nodes: [], until }
//
// ** Technical Review **
// - A MOVE on the bus low-pass, no sources of its own. With f0 = bus.filter.frequency.value at the call: set f0 at
//   t0, ramp exponentially to params.to (250 Hz) at the line (an exponential ramp, because pitch and brightness are
//   heard on a log scale, so the close sounds even), then set f0 back at the line: the top end snaps open on the
//   downbeat.
// - until = the line. By then bus.filter.frequency is back at f0.
// </claudes_code_comments>

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const expo = (p, v, t) => { try { p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); } catch { p.value = v; } };
const pick = (params, opts, k) => { const [d, , lo, hi] = params[k]; const v = Number.isFinite(+opts?.[k]) && opts?.[k] !== null ? +opts[k] : d; return Math.min(hi, Math.max(lo, v)); };
const beatOf = (opts) => (Number.isFinite(+opts?.beatDur) && +opts.beatDur > 0.05 ? +opts.beatDur : 0.5);

export const filterDrop = {
  key: 'filter-drop', label: 'FILTER DROP', family: 'transition', kind: 'move', cost: 1,
  line: 'the whole mix goes muffled over one bar as if heard through a wall, then the top end snaps back on the downbeat',
  famous: 'the bar before a drop, or a filtered dip in the middle of a long blend',
  params: {
    bars: [1, 'bars the close spans', 0.25, 8],
    to: [250, 'Hz, how far the low-pass closes', 80, 2000],
  },
  play(ctx, bus, t0, opts = {}) {
    const P = filterDrop.params;
    const line = t0 + pick(P, opts, 'bars') * 4 * beatOf(opts);
    const f = bus.filter.frequency;
    const f0 = Number.isFinite(f.value) && f.value > 0 ? f.value : 12000;
    at(f, f0, t0);
    expo(f, Math.min(f0, pick(P, opts, 'to')), line);
    at(f, f0, line);
    return { nodes: [], until: line };
  },
};

export default filterDrop;
