// settle-hear · masterbeat - THE MASTER BEAT, heard: the page's one grid (settle-see masterbeat.js), mapped onto the
// audio clock, so a bar line, a binaural beat and the 40 Hz light share one phase.
//
// <claudes_code_comments>
// ** Function List **
// MASTER_GRID                    - the grid's numbers when no page master beat is published: origin 0 (the page's
//                                  time origin), tickMs 500, bpm 120, beatsPerBar 4, barMs 2000, flashHz 40
// masterGrid()                   - the page's grid: globalThis.__settleMasterBeat when settle-see published it, else
//                                  MASTER_GRID (the same numbers; neither library imports the other)
// masterNow()                    - master time in ms: performance.now()
// nextLine(ms, periodMs, grid)   - the first master line of periodMs at or after ms (master time)
// audioOffsetMs(ctx)             - master ms minus audio seconds x 1000 for the sample leaving the speakers now:
//                                  getOutputTimestamp when the context gives one, else currentTime plus outputLatency;
//                                  held per context, moved only past OFFSET_SLACK_MS (2 ms), so jitter moves nothing
// toAudioTime(ctx, ms) / toMasterTime(ctx, s) - the mapping both ways
// masterStartTime(ctx, opts)     - the audio time of the next master tick at least `lead` seconds ahead: where a
//                                  steady voice starts so its phase is the master's phase
// nextMasterBar(ctx, afterS, barMs) - the audio time of the first master line of barMs at or after afterS
// snapToTick(ctx, s)             - an audio time moved to the nearest master tick (a bar that drifted comes back)
// quantizeBar(meter, bpm, tickMs) - { ticks, barSeconds, beatDur, bpm }: a bar is a whole number of master ticks
// lockGlide(b0, b1, startS, want) - a glide length near `want` seconds after which a beat that moves from b0 to b1
//                                  is again on the master phase ({ seconds, error }, error in cycles)
// beatPhaseError(b, s)           - how far a steady beat b is from the master phase at master second s (cycles)
//
// ** Technical Review **
// - THE LAW (navigator, 2026-10-01): all audio modes lock their beat to the master clock. The master grid is a pure
//   function of performance.now(): line k of a period P is at origin + k P. settle-see publishes its master beat on
//   globalThis.__settleMasterBeat; this file reads the numbers from there and does its own small arithmetic, so the
//   two libraries still stand alone.
// - THE AUDIO CLOCK: AudioContext.getOutputTimestamp() returns a pair { contextTime, performanceTime } for the sample
//   the speakers are playing now, so master ms = contextTime x 1000 + offset. A note scheduled at toAudioTime(ms)
//   is heard at master time ms, the instant the light shows that line. Without getOutputTimestamp the fallback is
//   currentTime plus outputLatency, which is the same within the latency estimate.
// - WHAT LOCKS, exactly: a steady voice started on a master tick (masterStartTime) has its phase zero on that tick.
//   A 40 Hz binaural pair then crosses phase zero every 25 ms, on every flash onset; any whole-number beat crosses it
//   on every master second, so on every 2 s bar line; a 7.83 Hz beat is off the lattice and drifts (named, not hidden).
//   The pulse trains (isochronic, clicks) are one-second loops of 40 bursts started on a tick, so every burst starts
//   on a flash onset. A bar is a whole number of ticks (quantizeBar) and starts on a tick (snapToTick), so a bar line
//   is a light onset.
// - DRIFT: the audio device's clock and the system clock can differ by parts per million. A long steady loop drifts by
//   that much (a few milliseconds a minute at most on common hardware); bars re-snap every bar, so the bar line never
//   accumulates it.
// </claudes_code_comments>

export const MASTER_GRID = Object.freeze({ origin: 0, tickMs: 500, bpm: 120, beatsPerBar: 4, barMs: 2000, flashHz: 40 });

export function masterGrid() {
  const g = typeof globalThis !== 'undefined' ? globalThis.__settleMasterBeat : null;
  if (g && Number.isFinite(g.origin) && g.tickMs > 0) return { ...MASTER_GRID, origin: g.origin, tickMs: g.tickMs, bpm: g.bpm ?? MASTER_GRID.bpm, beatsPerBar: g.beatsPerBar ?? 4, barMs: g.barMs ?? g.tickMs * 4, flashHz: g.flashHz ?? 40 };
  return MASTER_GRID;
}

export const masterNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function nextLine(ms, periodMs = MASTER_GRID.tickMs, grid = masterGrid()) {
  const k = Math.ceil((ms - grid.origin) / periodMs - 1e-9);
  return grid.origin + k * periodMs;
}

// the offset is held per context and moved only when the fresh reading differs by more than OFFSET_SLACK_MS, so
// the readings' own jitter (a render block, a few ms) never moves a bar line; real drift is followed in small steps
export const OFFSET_SLACK_MS = 2;
const held = new WeakMap();

export function audioOffsetMs(ctx) {
  const raw = rawOffsetMs(ctx);
  if (!ctx || typeof ctx !== 'object') return raw;
  const h = held.get(ctx);
  if (h == null || Math.abs(raw - h) > OFFSET_SLACK_MS) {
    held.set(ctx, raw);
    return raw;
  }
  return h;
}

function rawOffsetMs(ctx) {
  try {
    const ts = ctx.getOutputTimestamp?.();
    if (ts && ts.performanceTime > 0 && Number.isFinite(ts.contextTime)) return ts.performanceTime - ts.contextTime * 1000;
  } catch { /* an old engine: fall through */ }
  const lat = Number.isFinite(ctx.outputLatency) ? ctx.outputLatency : Number.isFinite(ctx.baseLatency) ? ctx.baseLatency : 0;
  return masterNow() - (ctx.currentTime + lat) * 1000;
}

export const toAudioTime = (ctx, ms) => (ms - audioOffsetMs(ctx)) / 1000;
export const toMasterTime = (ctx, s) => s * 1000 + audioOffsetMs(ctx);

export function masterStartTime(ctx, { lead = 0.04, periodMs } = {}) {
  const grid = masterGrid();
  const off = audioOffsetMs(ctx);
  const ms = nextLine((ctx.currentTime + lead) * 1000 + off, periodMs ?? grid.tickMs, grid);
  return (ms - off) / 1000;
}

export function nextMasterBar(ctx, afterS, barMs = masterGrid().tickMs) {
  const off = audioOffsetMs(ctx);
  return (nextLine(afterS * 1000 + off, barMs) - off) / 1000;
}

export function snapToTick(ctx, s) {
  const grid = masterGrid();
  const off = audioOffsetMs(ctx);
  const ms = s * 1000 + off;
  const k = Math.round((ms - grid.origin) / grid.tickMs);
  return (grid.origin + k * grid.tickMs - off) / 1000;
}

export function quantizeBar(meter = 4, bpm = 120, tickMs = MASTER_GRID.tickMs) {
  const m = Math.max(1, Math.round(Number.isFinite(meter) ? meter : 4));
  const want = (m * 60) / (Number.isFinite(bpm) && bpm > 0 ? bpm : 120); // seconds
  const ticks = Math.max(1, Math.round((want * 1000) / tickMs));
  const barSeconds = (ticks * tickMs) / 1000;
  const beatDur = barSeconds / m;
  return { ticks, barSeconds, beatDur, bpm: 60 / beatDur };
}

const frac = (x) => {
  const f = x - Math.round(x);
  return Math.abs(f) < 1e-9 ? 0 : f;
};

export function beatPhaseError(b, s) {
  return frac(b * s);
}

export function lockGlide(b0, b1, startS, want = 4) {
  if (b0 === b1) return { seconds: want, error: frac(b1 * startS) };
  let best = null;
  for (let g = Math.max(0.5, want - 1.5); g <= want + 1.5 + 1e-9; g += 0.5) {
    // phase gained over a linear glide from b0 to b1 is (b0 + b1) g / 2; the master phase of b1 at the end is
    // b1 (startS + g); the start was on b0's master phase, so the miss is (b0 - b1)(startS + g / 2)
    const error = frac((b0 - b1) * (startS + g / 2));
    const cost = Math.abs(error) * 100 + Math.abs(g - want);
    if (!best || cost < best.cost) best = { seconds: g, error, cost };
  }
  return { seconds: best.seconds, error: best.error };
}
