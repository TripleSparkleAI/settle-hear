// settle-hear · bands - THE BAND TAP (lane SOUNDSHAKE, navigator 2026-10-04: "the drone, mainly the main drone, and the
// deep things adjust the visual ... the top range and others can become the pop effects"). Two small analysers on the
// hero's own channels: the LOW band (the drone, the bass, the deep melodies, under 250 Hz) and the HIGH band (over
// 2.5 kHz: hats, bells, the shimmer), read at about 30 Hz, turned into levels, a breath and a tremble, and onsets.
//
// <claudes_code_comments>
// ** Function List **
// BANDS                        - the numbers: 250 Hz and 2.5 kHz corners, a 1,024-sample low window and a 256-sample
//                                high one, the -66 .. -12 dB window a level reads, the 30 Hz read rate
// levelOf(rms, o)              - pure: an RMS amplitude -> a level 0..1 over the dB window (0 for silence)
// rmsOf(buf, n)                - pure: the RMS of the first n samples of a Float32Array (or a byte buffer, centred 128)
// createFollower(o)            - pure: .step(level, dtMs) -> { level, breath, fast, tremble }: breath follows the level
//                                over 1.5 s (the drone swelling), fast over 90 ms, tremble = fast - breath (about it)
// createOnsets(o)              - pure: .step(level, tMs) -> 0, or an onset's strength 0..1 when the level jumps past
//                                ratio x its slow average and the floor, at most one every minGapMs
// createBandTap(opts)          - the live tap: .read() -> { low, high, ok } from the hero's channels (anchors 'hero'
//                                and unanchored, the ones a radial pulse answers too); .channels(); .dispose()
//
// ** Technical Review **
// - WHERE IT LISTENS: every mixer channel registers its last node with pulse.js (registerPulseTarget, `node`). The tap
//   connects the channels whose anchor it was given into one sum, through a lowpass and a highpass into two
//   AnalyserNodes, and follows channels as they come and go (onPulseTargets). So it hears THE DJ (its drone, its bass,
//   the house set), the hero's static, the voices, the loops and the gamma sounds, before the DJ's desk and before the
//   master, and never a page instrument (anchor 'page'). The analysers output nothing.
// - THE COST: built on the first read once the engine exists; one read is two time-domain copies into buffers made
//   once (1,024 + 256 floats) and two sums of squares. Nothing is allocated per read; the page calls read() about 30
//   times a second and only while the coupling runs.
// - THE LEVELS: an RMS in dB over BANDS.floorDb .. BANDS.topDb, mapped to 0..1. The follower's breath is a one-pole
//   average over 1.5 s (the drone's swell), its fast part over 90 ms; tremble is their difference, so a steady drone
//   gives a breath and no tremble, and a bass note gives a tremble.
// - ONSETS: the high band's level against its own slow average (400 ms): an onset when it jumps (by at least `jump`
//   since the last read) past `ratio` times that average and past the floor, then a refractory gap. The strength is
//   how far it rose above the average, capped at 1.
// - Pure functions are exported for tests; createBandTap reads getEngine() and onPulseTargets() by default.
// </claudes_code_comments>

import { getEngine } from './engine.js';
import { onPulseTargets } from './pulse.js';

export const BANDS = Object.freeze({ lowHz: 250, highHz: 2500, lowSize: 1024, highSize: 256, floorDb: -66, topDb: -12, rateHz: 30 });

export function levelOf(rms, o = BANDS) {
  if (!Number.isFinite(rms) || rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db - o.floorDb) / (o.topDb - o.floorDb)));
}

export function rmsOf(buf, n = buf?.length ?? 0) {
  if (!buf || !n) return 0;
  let s = 0;
  if (buf instanceof Uint8Array) {
    for (let i = 0; i < n; i++) { const x = (buf[i] - 128) / 128; s += x * x; }
  } else {
    for (let i = 0; i < n; i++) { const x = buf[i]; s += x * x; }
  }
  return Math.sqrt(s / n);
}

const pole = (dtMs, tauMs) => 1 - Math.exp(-Math.max(0, dtMs) / Math.max(1, tauMs));

export function createFollower({ breathMs = 1500, fastMs = 90 } = {}) {
  let breath = 0;
  let fast = 0;
  const out = { level: 0, breath: 0, fast: 0, tremble: 0 };
  return {
    step(level, dtMs = 1000 / BANDS.rateHz) {
      const x = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
      breath += (x - breath) * pole(dtMs, breathMs);
      fast += (x - fast) * pole(dtMs, fastMs);
      out.level = x;
      out.breath = breath;
      out.fast = fast;
      out.tremble = Math.max(-1, Math.min(1, fast - breath));
      return out;
    },
    reset() { breath = 0; fast = 0; },
    get state() { return { ...out }; },
  };
}

export function createOnsets({ ratio = 1.8, floor = 0.12, minGapMs = 90, slowMs = 400, jump = 0.06 } = {}) {
  let slow = 0;
  let lastAt = -1e9;
  let prev = -1e9;
  let lastX = 0;
  return {
    step(level, tMs) {
      const x = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
      const t = Number.isFinite(tMs) ? tMs : prev + 1000 / BANDS.rateHz;
      const dt = prev > -1e8 ? t - prev : 1000 / BANDS.rateHz;
      prev = t;
      const base = slow;
      const rise = x - lastX;
      lastX = x;
      slow += (x - slow) * pole(dt, slowMs);
      // an onset is a JUMP (past the last read by `jump`) above `ratio` x the slow average and the floor: a level that
      // rises and stays fires once, not again on every read while the average catches up
      if (x < floor || t - lastAt < minGapMs || rise < jump) return 0;
      if (x <= Math.max(base * ratio, base + 0.08)) return 0;
      lastAt = t;
      return Math.min(1, (x - base) / Math.max(0.15, 1 - base));
    },
    reset() { slow = 0; lastAt = -1e9; prev = -1e9; lastX = 0; },
  };
}

export function createBandTap({ anchors = ['hero', null], engine = getEngine, watch = onPulseTargets, o = BANDS } = {}) {
  let E = null;
  let nodes = null;
  let low = null;
  let high = null;
  const joined = new Set();
  let off = null;
  const wants = (t) => anchors.includes(t.anchor ?? null) && t.node && E && t.ctx === E.ctx;
  const join = (t) => {
    if (!nodes || joined.has(t) || !wants(t)) return;
    try { t.node.connect(nodes.sum); joined.add(t); } catch { /* a node that refuses is skipped */ }
  };
  const leave = (t) => {
    if (!joined.has(t)) return;
    joined.delete(t);
    try { t.node.disconnect(nodes.sum); } catch { /* already gone */ }
  };
  const build = () => {
    const ctx = E.ctx;
    const sum = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.lowHz;
    lp.Q.value = 0.7071;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = o.highHz;
    hp.Q.value = 0.7071;
    const aLow = ctx.createAnalyser();
    aLow.fftSize = o.lowSize;
    aLow.smoothingTimeConstant = 0;
    const aHigh = ctx.createAnalyser();
    aHigh.fftSize = o.highSize;
    aHigh.smoothingTimeConstant = 0;
    sum.connect(lp);
    lp.connect(aLow);
    sum.connect(hp);
    hp.connect(aHigh);
    const float = typeof aLow.getFloatTimeDomainData === 'function';
    low = float ? new Float32Array(o.lowSize) : new Uint8Array(o.lowSize);
    high = float ? new Float32Array(o.highSize) : new Uint8Array(o.highSize);
    nodes = { sum, lp, hp, aLow, aHigh, float };
    off = watch((t, what) => (what === 'remove' ? leave(t) : join(t)));
  };
  const drop = () => {
    off?.();
    off = null;
    if (nodes) for (const t of [...joined]) leave(t);
    if (nodes) for (const n of [nodes.sum, nodes.lp, nodes.hp, nodes.aLow, nodes.aHigh]) { try { n.disconnect(); } catch { /* gone */ } }
    nodes = null;
  };
  const result = { low: 0, high: 0, ok: false };
  return {
    read() {
      const eng = engine();
      if (!eng) { result.low = 0; result.high = 0; result.ok = false; return result; }
      if (eng !== E) { drop(); E = eng; build(); }
      if (nodes.float) { nodes.aLow.getFloatTimeDomainData(low); nodes.aHigh.getFloatTimeDomainData(high); }
      else { nodes.aLow.getByteTimeDomainData(low); nodes.aHigh.getByteTimeDomainData(high); }
      result.low = levelOf(rmsOf(low), o);
      result.high = levelOf(rmsOf(high), o);
      result.ok = true;
      return result;
    },
    channels: () => joined.size,
    dispose() { drop(); E = null; },
  };
}
