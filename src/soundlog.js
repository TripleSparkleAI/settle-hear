// SOUNDLOG (lane SOUNDDOCTOR, TEMPORARY): the sound lifecycle log. Remove in one sweep: delete this file and every
// line marked SOUNDLOG (`git grep -n SOUNDLOG`).
//
// <claudes_code_comments>
// ** Function List **
// configureSoundLog({ enabled, sink, console, consoleSkip }) - switch the log on or off; sink(entries) receives each
//                              batch; consoleSkip lists kinds kept out of the console (the heartbeat)
// soundLogOn()                - is the log on
// soundLog(kind, data)        - record one event { t (performance ms), wall (ISO), kind, ...data }; a no-op when off
// soundLogTail(n)             - the last n events (a ring of 2,000), for tests and a console read
// flushSoundLog()             - hand the pending batch to the sink now
//
// ** Technical Review **
// - Off by default. The site turns it on in a dev build or with ?soundlog=1 (sites/settle-site/src/soundlog.js),
//   before any sound is built. Every call site checks soundLogOn() first, so the cost when off is one boolean read.
// - Events go to the console under one prefix, '[soundlog]', and into a pending batch that the sink takes every
//   1.5 s (the site's sink POSTs it to the dev server, which appends it to sites/settle-site/.devlogs/sound.jsonl).
// - The engine logs each resume and suspend it asks for (ctx:resume:call, ctx:suspend:call, with the reason); the
//   site logs every statechange and every promise's result, so a change nobody asked for has no matching call.
// </claudes_code_comments>

const RING = 2000;
const ring = [];
let pending = [];
let enabled = false;
let sink = null;
let toConsole = true;
let skip = new Set();
let timer = null;

export function configureSoundLog({ enabled: on = true, sink: s = null, console: c = true, consoleSkip = [] } = {}) {
  enabled = !!on;
  sink = typeof s === 'function' ? s : null;
  toConsole = !!c;
  skip = new Set(consoleSkip);
  if (enabled && sink && !timer && typeof setInterval !== 'undefined') {
    timer = setInterval(flushSoundLog, 1500);
    timer?.unref?.();
  }
  if (!enabled && timer) { clearInterval(timer); timer = null; }
}

export function soundLogOn() {
  return enabled;
}

const perf = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function soundLog(kind, data = {}) {
  if (!enabled) return;
  const e = { t: Math.round(perf() * 10) / 10, wall: new Date().toISOString(), kind, ...data };
  ring.push(e);
  if (ring.length > RING) ring.shift();
  if (sink) pending.push(e);
  if (toConsole && !skip.has(kind) && typeof console !== 'undefined') console.info('[soundlog]', kind, data);
}

export function soundLogTail(n = 50) {
  return ring.slice(-n);
}

export function flushSoundLog() {
  if (!sink || !pending.length) return;
  const batch = pending;
  pending = [];
  try { sink(batch); } catch { /* a sink that fails loses one batch, never the page */ }
}
