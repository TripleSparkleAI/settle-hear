// settle-hear · soundclock - THE SOUND CLOCK: one steady tick for every sound scheduler, from a dedicated Worker, so a
// hidden tab's sound runs on exactly as a visible one's (lane DJSILENCE).
//
// <claudes_code_comments>
// ** Function List **
// SOUND_TICK_MS              - the clock's period (20 ms): every scheduler's own period is a whole number of ticks or
//                              rounds up to one
// configureSoundClock(opts)  - { worker, now }: worker, a factory returning a Worker-like object (postMessage,
//                              onmessage, terminate), or null to force the page-timer fallback (tests, hosts that
//                              forbid workers); now, the ms clock due times are read on (performance.now). Resets the
//                              running clock
// soundEvery(ms, fn)         - call fn every ms on the sound clock; returns { stop(), unref() }
// soundAfter(ms, fn)         - call fn once after ms on the sound clock; returns { stop(), unref() }
// soundClockKind()           - 'worker' while a worker drives the clock, 'timer' on the fallback, null when idle
// soundClockSteady()         - true when the clock does not rest on the page's timers (a worker drives it), so a
//                              scheduler needs no extra hidden-tab look-ahead
//
// ** Technical Review **
// - THE NAVIGATOR'S RULING (2026-10-07): "the sound in a tab that is not active, and its rotation, must be the same as
//   when it is active." Chrome budgets a hidden tab's page timers: about one wake-up a second at first and, once the
//   tab has been hidden 5 min and silent 30 s (a muted tab, MUTE ALL, a quiet system), one a minute (intensive
//   wake-up throttling). A sound scheduler on setInterval then leaves stretches of a minute with no bar and no grain.
//   Measured on THE DJ in SETTLE/runs/djsilence/MEASURED.md.
// - A dedicated Worker's own timers are not throttled with its page, and its messages reach the page as ordinary
//   tasks. So the clock is one tiny worker (made from a Blob, no bundler needed) whose setInterval posts a tick every
//   SOUND_TICK_MS; the page side runs every scheduler that is due. One worker serves every subscriber, and it is
//   terminated when the last one stops.
// - THE FALLBACK: no Worker (node, a host that forbids workers) or a worker that fails to start: the same pump runs on
//   setInterval, exactly the old behaviour, and soundClockSteady() is false so the schedulers keep their hidden-tab
//   look-ahead.
// - A due subscriber runs once per pump, never in a burst to catch up: a late pump runs it once and its next due time
//   counts from now (the schedulers read the audio clock themselves, so a late run schedules what is due).
// </claudes_code_comments>

export const SOUND_TICK_MS = 20;

const WORKER_SRC = 'let id = 0; onmessage = (e) => { clearInterval(id); id = e.data > 0 ? setInterval(() => postMessage(1), e.data) : 0; };';

function blobWorker() {
  if (typeof Worker !== 'function' || typeof Blob !== 'function' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
  const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
  try { return new Worker(url); } finally { try { URL.revokeObjectURL(url); } catch { /* kept */ } }
}

let factory = blobWorker;
const subs = new Set();
let driver = null; // { kind: 'worker' | 'timer', stop() }
const wallMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
let nowMs = wallMs;

function pump() {
  const t = nowMs();
  for (const s of [...subs]) {
    if (!subs.has(s) || t < s.due) continue;
    if (s.once) subs.delete(s);
    else s.due = Math.max(s.due + s.every, t + s.every * 0.5);
    try { s.fn(); } catch { /* one scheduler's error never stops the clock */ }
  }
  if (!subs.size) stopDriver();
}

function startTimer() {
  if (typeof setInterval === 'undefined') return null;
  const id = setInterval(pump, SOUND_TICK_MS);
  id?.unref?.();
  return { kind: 'timer', stop: () => clearInterval(id) };
}

function startDriver() {
  if (driver) return;
  let w = null;
  try { w = factory ? factory() : null; } catch { w = null; }
  if (w) {
    // a worker that fails after starting hands the clock to the page timer
    w.onerror = () => { if (driver?.worker === w) { stopDriver(); driver = startTimer(); } };
    w.onmessage = pump;
    try {
      w.postMessage(SOUND_TICK_MS);
      driver = { kind: 'worker', worker: w, stop: () => { try { w.postMessage(0); w.terminate(); } catch { /* gone */ } } };
      return;
    } catch { try { w.terminate(); } catch { /* gone */ } }
  }
  driver = startTimer();
}

function stopDriver() {
  const d = driver;
  driver = null;
  d?.stop();
}

function add(ms, fn, once) {
  const every = Math.max(SOUND_TICK_MS, Number.isFinite(+ms) ? +ms : SOUND_TICK_MS);
  const s = { every, fn, once, due: nowMs() + (once ? Math.max(0, +ms || 0) : every) };
  subs.add(s);
  startDriver();
  return { stop: () => { subs.delete(s); if (!subs.size) stopDriver(); }, unref() { return this; } };
}

export function soundEvery(ms, fn) {
  if (typeof fn !== 'function') return { stop() {}, unref() { return this; } };
  return add(ms, fn, false);
}

export function soundAfter(ms, fn) {
  if (typeof fn !== 'function') return { stop() {}, unref() { return this; } };
  return add(ms, fn, true);
}

export function configureSoundClock({ worker, now } = {}) {
  if (worker !== undefined) factory = typeof worker === 'function' ? worker : null;
  if (now !== undefined) nowMs = typeof now === 'function' ? now : wallMs;
  if (driver) { stopDriver(); if (subs.size) startDriver(); }
}

export const soundClockKind = () => driver?.kind ?? null;
export const soundClockSteady = () => driver?.kind === 'worker';
