// settle-hear · fx-tape-stop-bus - THE BUS TAPE STOP: the last beat of the bar winds down like a machine switched off.
//
// <claudes_code_comments>
// ** Function List **
// tapeStopBus                - the effect object { key, label, family, kind, line, famous, cost, params, play }
// tapeStopBus.play(ctx, bus, t0, opts) - automates bus.filter and bus.level: { nodes: [], until }
//
// ** Technical Review **
// - An APPROXIMATION on the bus. A real tape stop slows the tape, so pitch and speed fall together. A bus has no
//   pitch control, so this move fakes the darkening and the fade: over the last params.beats beats of the span
//   (default 1) bus.filter.frequency falls exponentially from f0 to params.to (150 Hz) and bus.level.gain falls
//   linearly from v0 to 0, both reaching their floor 10 ms before the line. At the line both are set back to f0
//   and v0. The true pitch fall lives in house.js as the 'tape-stop' pass, which slows a delay line.
// - until = the line.
// </claudes_code_comments>

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const expo = (p, v, t) => { try { p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); } catch { p.value = v; } };
const pick = (params, opts, k) => { const [d, , lo, hi] = params[k]; const v = Number.isFinite(+opts?.[k]) && opts?.[k] !== null ? +opts[k] : d; return Math.min(hi, Math.max(lo, v)); };
const beatOf = (opts) => (Number.isFinite(+opts?.beatDur) && +opts.beatDur > 0.05 ? +opts.beatDur : 0.5);

export const tapeStopBus = {
  key: 'tape-stop-bus', label: 'TAPE STOP (BUS)', family: 'transition', kind: 'move', cost: 1,
  line: 'the last beat goes dark and fades as if the tape machine were switched off, an approximation on the bus (the true pitch fall is the tape-stop pass)',
  famous: 'the end of a phrase before a drop or a switch of track, a hard stop with character',
  params: {
    bars: [1, 'bars the move spans (the stop is at the end)', 0.25, 4],
    beats: [1, 'beats the wind-down lasts', 0.25, 4],
    to: [150, 'Hz, where the low-pass ends', 60, 1000],
  },
  play(ctx, bus, t0, opts = {}) {
    const P = tapeStopBus.params;
    const beatDur = beatOf(opts);
    const span = pick(P, opts, 'bars') * 4 * beatDur;
    const line = t0 + span;
    const start = Math.max(t0, line - Math.min(span, pick(P, opts, 'beats') * beatDur));
    const f = bus.filter.frequency;
    const g = bus.level.gain;
    const f0 = Number.isFinite(f.value) && f.value > 0 ? f.value : 12000;
    const v0 = Number.isFinite(g.value) ? g.value : 1;
    const floorAt = Math.max(start + 0.005, line - 0.01);
    at(f, f0, start);
    expo(f, Math.min(f0, pick(P, opts, 'to')), floorAt);
    at(g, v0, start);
    lin(g, 0, floorAt);
    at(f, f0, line);
    at(g, v0, line);
    return { nodes: [], until: line };
  },
};

export default tapeStopBus;
