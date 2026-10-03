// settle-hear · engine - the page's one AudioContext, its master chain (mixer, limiter) and its shared effects.
//
// <claudes_code_comments>
// ** Function List **
// configure({ createContext, sleepMs }) - inject an AudioContext factory (tests use a fake one); sleepMs: how long
//                                  the context runs on with nothing to hear before it is suspended (1,500 ms)
// getEngine()                    - the engine, or null until the sound is first asked to start (or with no Web Audio)
// armUnlock()                    - THE START RULE: try to start the sound at once on load; if the browser refuses,
//                                  mark the switch blocked and start on the first gesture (pointerdown, pointerup,
//                                  keydown, touchend, click); a muted visitor's page builds nothing
// GESTURE_EVENTS / gestureWaiting() - the events the one gesture listener hears; true while it is armed
// FOCUS_KEYS                     - keys that start nothing (Tab, the modifiers, Escape): they only move the focus
// requestStart(why)              - start the sound now (a control's click); nothing while muted; true once it runs
// BLOCK_DECIDE_MS                - how long a load-time ask may take before it counts as refused (250 ms)
// onEngine(fn)                   - call fn(engine) now if the engine exists, else once it is built; returns an off()
// setMaster(v) / getMaster()     - the master level, 0 .. 1
// setReturn(name, v)             - the reverb or delay return level, 0 .. 1
// isAway()                       - true while PAUSE ALL holds the page (settle-see's ticker state 'held')
// pageHalted()                   - true while the pictures are halted for any reason (hidden tab, idle reader, held)
// wantSound(token, on) / holdSound(s) / soundWanted() - THE DEMAND: a playing channel holds a token; a one-shot
//                                  holds one for s seconds; the context runs only while some token is held
// createChannel(E, opts)         - one mixer channel: input -> filter -> fader -> the pulse nodes -> master, with reverb
//                                  and delay sends; opts.anchor names where it sits on screen for THE RADIAL PULSE
// impulse(ctx, seconds, decay)   - a generated stereo reverb impulse: decorrelated noise under an exponential decay
// noiseBuffer(ctx, seconds)      - a shared white-noise buffer (built once per context)
// ramp(param, v, t, tau)         - setTargetAtTime with NaN and range guards
// masterAnalyser()               - the page's one AnalyserNode, tapped after the master limiter (built on first ask)
// tapBus(E, name)                - a named side bus (a GainNode that reaches no speaker) a sound can send a copy of
//                                  itself into, for another sound to listen to: the hero's static feeds 'picture', and
//                                  the vocoder pass reads it as its modulator (lane BINAURALMODES)
//
// ** Technical Review **
// - ONE AudioContext per page, built when the page first asks for sound (THE START RULE below, lane AUTOSTART): on
//   load it tries at once, and the browser's autoplay rule decides. Allowed, the sound plays with no click; refused,
//   the switch turns `blocked` and the first real gesture starts it. A muted visitor's page builds nothing.
// - The master chain: master gain -> mute gain -> DynamicsCompressor used as a limiter (threshold -14 dB, ratio 20,
//   attack 2 ms) -> a safety gain of 0.9 -> the speakers. Nothing a voice does can clip the output.
// - Shared effects buses: a convolution reverb (a 2.4 s generated impulse) and a feedback delay (320 ms, feedback
//   0.35, a 2.6 kHz lowpass in the loop so repeats darken). Each channel sends to them with its own send levels.
// - THE BACKGROUND RULE (lane SOUNDDOCTOR): the sound plays on like a video in a hidden tab and for an idle reader
//   (settle-see's ticker 'hidden' or 'away' halt the pictures only). Three things stop it: MUTE ALL (the switch,
//   control.js), PAUSE ALL (ticker 'held') and nothing to hear (no channel playing: THE DEMAND). MUTE ALL and PAUSE
//   ALL close the mute gain at once and suspend after 250 ms; nothing to hear suspends after sleepMs (1.5 s), so the
//   fades finish first. The context is never left running silent. A suspend or an interruption the page did not ask
//   for ('statechange' to 'suspended' or 'interrupted', E.selfSuspend false) is resumed at once while sound is wanted,
//   and if the browser refuses, on the next pointerdown, key or touch; focus, pageshow and visibilitychange re-check.
// - THE ANALYSER (lane HOUSEDJ): masterAnalyser() taps the limiter's output, so it hears exactly what the speakers
//   get (after MUTE ALL: a muted page shows an empty spectrum). fftSize 2048, smoothing 0.55, -90..-20 dB. It is
//   built on the first ask, only after the engine exists, and it outputs nothing.
// - ramp() refuses NaN and infinities (they would throw or silence an AudioParam) and clamps to the param's range.
// </claudes_code_comments>

import { sound } from './control.js';
import { pulseNodes, registerPulseTarget } from './pulse.js';
import { soundLog, soundLogOn } from './soundlog.js'; // SOUNDLOG

let factory = () => {
  const C = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  return C ? new C({ latencyHint: 'playback' }) : null;
};
let E = null;
const waiting = new Set();
let armed = false;
// how long the context runs on with nothing to hear before it is suspended (fades and short gaps fit inside it)
let sleepMs = 1500;

export function configure({ createContext, sleepMs: ms } = {}) {
  if (createContext) factory = createContext;
  if (Number.isFinite(ms) && ms >= 0) sleepMs = ms;
}

export function ramp(param, v, t, tau = 0.08) {
  if (!param || typeof v !== 'number' || !Number.isFinite(v)) return;
  const lo = Number.isFinite(param.minValue) ? param.minValue : -Infinity;
  const hi = Number.isFinite(param.maxValue) ? param.maxValue : Infinity;
  const x = Math.min(hi, Math.max(lo, v));
  try {
    param.cancelScheduledValues?.(t);
    param.setTargetAtTime(x, t, Math.max(0.001, tau));
  } catch {
    param.value = x;
  }
}

const buffers = new WeakMap();
export function noiseBuffer(ctx, seconds = 2) {
  let b = buffers.get(ctx);
  if (b) return b;
  const n = Math.max(1, Math.round(ctx.sampleRate * seconds));
  b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let x = 0x9e3779b9;
  for (let i = 0; i < n; i++) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    d[i] = ((x >>> 0) / 4294967296) * 2 - 1;
  }
  buffers.set(ctx, b);
  return b;
}

export function impulse(ctx, seconds = 2.4, decay = 3.2) {
  const n = Math.max(1, Math.round(ctx.sampleRate * seconds));
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let x = c ? 0x85ebca6b : 0xc2b2ae35;
    for (let i = 0; i < n; i++) {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      const r = ((x >>> 0) / 4294967296) * 2 - 1;
      d[i] = r * Math.pow(1 - i / n, decay) * (i < 64 ? i / 64 : 1);
    }
  }
  return b;
}

function build() {
  const ctx = factory();
  if (!ctx) return null;
  const master = ctx.createGain();
  master.gain.value = 0.8;
  const mute = ctx.createGain();
  mute.gain.value = 0;
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -14;
  limit.knee.value = 4;
  limit.ratio.value = 20;
  limit.attack.value = 0.002;
  limit.release.value = 0.2;
  const safety = ctx.createGain();
  safety.gain.value = 0.9;
  master.connect(mute);
  mute.connect(limit);
  limit.connect(safety);
  safety.connect(ctx.destination);

  const reverbIn = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.buffer = impulse(ctx);
  const reverbOut = ctx.createGain();
  reverbOut.gain.value = 0.8;
  reverbIn.connect(conv);
  conv.connect(reverbOut);
  reverbOut.connect(master);

  const delayIn = ctx.createGain();
  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.32;
  const fb = ctx.createGain();
  fb.gain.value = 0.35;
  const dark = ctx.createBiquadFilter();
  dark.type = 'lowpass';
  dark.frequency.value = 2600;
  const delayOut = ctx.createGain();
  delayOut.gain.value = 0.7;
  delayIn.connect(delay);
  delay.connect(dark);
  dark.connect(fb);
  fb.connect(delay);
  dark.connect(delayOut);
  delayOut.connect(master);

  return { ctx, master, mute, limit, reverb: { input: reverbIn, output: reverbOut }, delay: { input: delayIn, output: delayOut, node: delay, feedback: fb } };
}

// THE BACKGROUND RULE (lane SOUNDDOCTOR, navigator 2026-10-02): the sound plays on like a video when the tab is
// hidden or nobody touches the page (settle-see's ticker 'hidden' or 'away': the pictures halt, the sound does not).
// It stops for three things only: MUTE ALL, PAUSE ALL (the ticker 'held') and nothing to hear (no channel playing).
// In each of the three the context is SUSPENDED, never left running silent, so the tab is never a silent "playing
// audio" entry. A suspend or an interruption the page did not ask for (the system, another app, a device change) is
// resumed at once, and on the next gesture if the browser refuses.
let tickerState = 'running';
let held = false;
// true while PAUSE ALL holds every settle (the only ticker state that silences the sound)
export function isAway() {
  return held;
}
// true while the pictures are halted for any reason (hidden, away, held): a hearing holds its last sound then
export function pageHalted() {
  return tickerState !== 'running' || (typeof document !== 'undefined' && !!document.hidden);
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('settle:ticker', (ev) => {
    tickerState = ev?.detail?.state ?? 'running';
    held = tickerState === 'held';
    if (soundLogOn()) soundLog('ticker', { state: tickerState, reason: ev?.detail?.reason, held }); // SOUNDLOG
    applySwitch('ticker');
  });
}

// THE DEMAND: every channel that is playing holds a token here; a one-shot sound holds one for its length
const demand = new Set();
export function wantSound(token, on) {
  const had = demand.has(token);
  if (on) demand.add(token);
  else demand.delete(token);
  if (had !== !!on) applySwitch('demand');
}
export function holdSound(seconds = 0.6) {
  const tok = {};
  wantSound(tok, true);
  const id = setTimeout(() => wantSound(tok, false), Math.max(0, seconds) * 1000);
  id?.unref?.();
}
export function soundWanted() {
  return sound.audible && !held && demand.size > 0;
}

function resumeNow(why) {
  const { ctx } = E;
  if (soundLogOn()) soundLog('ctx:resume:call', { why, state: ctx.state }); // SOUNDLOG
  try {
    const p = ctx.resume?.();
    p?.then?.(() => { if (soundWanted() && ctx.state !== 'running') armGestureResume(); }, () => armGestureResume());
  } catch {
    armGestureResume();
  }
}

// THE GESTURE LISTENER (lane AUTOSTART): ONE set of capture listeners on the window, armed while the sound waits for
// the browser. It serves both the first start (blocked on load) and a resume the browser refused later. pointerdown
// is not a user activation for a touch or a pen (Chrome counts pointerup and touchend there), so a gesture that does
// not leave the context running keeps the listeners armed for the next event of the same tap: they are removed only
// once the context runs. scroll, wheel and mousemove are not listened to: browsers accept none of them.
export const GESTURE_EVENTS = ['pointerdown', 'pointerup', 'keydown', 'touchend', 'click'];
// keys that only move the focus or modify another key start nothing, so a keyboard or screen-reader visitor can Tab
// to the page's CLICK TO PLAY, hear what it says, and press it; every other key starts the sound
export const FOCUS_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape']);
let gestureArmed = false;
function onGesture(ev) {
  // the visitor's MUTE ALL wins: a gesture while muted starts nothing, and the listeners wait for the unmute
  if (sound.muted) return;
  if (ev?.type === 'keydown' && FOCUS_KEYS.has(ev.key)) return;
  if (soundLogOn()) soundLog('engine:gesture', { type: ev?.type, state: E?.ctx.state ?? 'none' }); // SOUNDLOG
  begin(`gesture:${ev?.type ?? '?'}`);
}
function armGesture() {
  if (gestureArmed || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  gestureArmed = true;
  for (const ev of GESTURE_EVENTS) window.addEventListener(ev, onGesture, true);
}
function disarmGesture() {
  if (!gestureArmed || typeof window === 'undefined') return;
  gestureArmed = false;
  for (const ev of GESTURE_EVENTS) window.removeEventListener(ev, onGesture, true);
}
// true while the gesture listeners are armed (tests and the soundlog read it)
export function gestureWaiting() {
  return gestureArmed;
}
// a resume the page asked for and the browser refused: the next gesture tries again
function armGestureResume() {
  armGesture();
}

function onStateChange() {
  if (!E) return;
  const { ctx } = E;
  if (soundLogOn()) soundLog('engine:statechange', { state: ctx.state, ours: !!E.selfSuspend, wanted: soundWanted() }); // SOUNDLOG
  if (ctx.state === 'running') {
    E.selfSuspend = false;
    // the browser let the context run (on load, or after a refusal): the sound has started
    if (!sound.unlocked || sound.blocked || gestureArmed) granted('statechange');
    return;
  }
  if (ctx.state === 'closed' || E.selfSuspend) return;
  // suspended or interrupted by something other than this page, while sound is wanted: bring it back
  if (soundWanted()) resumeNow(`statechange:${ctx.state}`);
}

function applySwitch(why = 'switch') {
  if (!E) return;
  const { ctx } = E;
  const t = ctx.currentTime;
  const wanted = soundWanted();
  if (soundLogOn()) soundLog('engine:apply', { why: typeof why === 'string' ? why : why?.type ?? 'switch', wanted, audible: sound.audible, muted: sound.muted, held, demand: demand.size, hidden: typeof document !== 'undefined' && !!document.hidden, ticker: tickerState, state: ctx.state }); // SOUNDLOG
  // the mute gain follows MUTE ALL and PAUSE ALL alone; whether the context runs follows what there is to hear
  const silenced = !sound.audible || held;
  ramp(E.mute.gain, silenced ? 0 : 1, t, silenced ? 0.04 : 0.2);
  if (wanted) {
    clearTimeout(E.sleep);
    E.sleep = null;
    E.selfSuspend = false;
    if (ctx.state !== 'running' && ctx.state !== 'closed') resumeNow(`engine:${why}`);
    return;
  }
  if (soundLogOn() && silenced) soundLog('gain:zero', { node: 'mute', why: !sound.audible ? 'not audible' : 'PAUSE ALL' }); // SOUNDLOG
  if (E.sleep) return;
  E.sleep = setTimeout(() => {
    E.sleep = null;
    // a start in trial is not suspended under the browser's feet: the decision comes first
    if (trial || soundWanted() || ctx.state !== 'running') return;
    if (soundLogOn()) soundLog('ctx:suspend:call', { why: !sound.audible ? 'muted' : held ? 'PAUSE ALL' : 'nothing to hear' }); // SOUNDLOG
    E.selfSuspend = true;
    ctx.suspend?.().catch(() => {});
  }, silenced ? 250 : sleepMs);
  E.sleep?.unref?.();
}

export function getEngine() {
  return E;
}

export function onEngine(fn) {
  if (E) {
    fn(E);
    return () => {};
  }
  waiting.add(fn);
  return () => waiting.delete(fn);
}

function start() {
  if (E) return;
  try {
    E = build();
  } catch {
    E = null;
  }
  if (!E) return;
  if (soundLogOn()) soundLog('engine:built', { state: E.ctx.state, sampleRate: E.ctx.sampleRate }); // SOUNDLOG
  sound.subscribe(() => applySwitch('sound'));
  // coming back to the tab or the window, or a page restored from the back-forward cache, re-checks the context
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => applySwitch('visibility'));
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('focus', () => applySwitch('focus'));
    window.addEventListener('pageshow', () => applySwitch('pageshow'));
  }
  try { E.ctx.addEventListener?.('statechange', onStateChange); } catch { /* an old engine */ }
  applySwitch('start');
  for (const fn of [...waiting]) {
    waiting.delete(fn);
    try { fn(E); } catch { /* a voice that fails to build stays silent */ }
  }
}

// THE START RULE (lane AUTOSTART, navigator 2026-10-02: "Can we just start playing on page start?"). The browser
// decides, and the page asks it as early as it can:
// 1. ON LOAD the first armUnlock() tries at once: it builds the context and resumes it. If the browser allows sound
//    (a site permission, Chrome's media engagement, a reload in a tab it trusts), the context runs and the sound
//    plays with no click. navigator.getAutoplayPolicy('audiocontext'), where it exists, answers before anything is
//    built: 'disallowed' or 'allowed-muted' skips the build, so the console stays clean.
// 2. IF THE BROWSER REFUSES (the context is not running BLOCK_DECIDE_MS after the ask, or the resume rejects), the
//    switch turns `blocked` and the gesture listener waits. The first real gesture anywhere on the page (pointerdown,
//    pointerup, keydown, touchend, click) starts the sound at once; no second click is needed. Tab, the modifier keys
//    and Escape start nothing (FOCUS_KEYS), so the keyboard can reach a "click to play" control and read it first.
// 3. MUTE ALL WINS: a muted visitor's page builds nothing on load and starts nothing on a gesture. Unmuting tries at
//    once (the MUTE button's own click is a gesture, so the sound starts with it).
// The result is read from the context alone (state === 'running'), never assumed.
export const BLOCK_DECIDE_MS = 250;
let trial = false;
let decide = null;

function autoplayPolicy() {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    return typeof nav?.getAutoplayPolicy === 'function' ? nav.getAutoplayPolicy('audiocontext') : null;
  } catch {
    return null;
  }
}

function refused(why) {
  if (decide) { clearTimeout(decide); decide = null; }
  trial = false;
  if (E && E.ctx.state === 'running') return;
  if (soundLogOn()) soundLog('engine:blocked', { why, state: E?.ctx.state ?? 'none', unlocked: sound.unlocked }); // SOUNDLOG
  armGesture();
  // before the first start this is the browser's autoplay refusal; after it, only a resume waiting for a gesture
  if (!sound.unlocked) sound.setBlocked(true);
}

function granted(why) {
  if (decide) { clearTimeout(decide); decide = null; }
  trial = false;
  disarmGesture();
  if (soundLogOn()) soundLog('engine:granted', { why, state: E?.ctx.state }); // SOUNDLOG
  const was = sound.unlocked;
  sound.unlock(); // clears `blocked`; its subscribers re-apply the switch
  if (was && E) applySwitch(`granted:${why}`);
}

// ask the browser to run the sound: build the context if needed, resume it, and read the answer from its state
function begin(why) {
  if (sound.muted) return;
  if (!E) start();
  if (!E) { disarmGesture(); return; } // no Web Audio here: nothing to wait for
  const { ctx } = E;
  if (ctx.state === 'running') { granted(why); return; }
  trial = true;
  armGesture();
  if (soundLogOn()) soundLog('ctx:resume:call', { why, state: ctx.state }); // SOUNDLOG
  let p = null;
  try { p = ctx.resume?.(); } catch { refused(`${why}:threw`); return; }
  if (ctx.state === 'running') { granted(why); return; }
  p?.then?.(
    () => { if (E?.ctx === ctx && ctx.state === 'running') granted(`${why}:resolved`); },
    () => { if (E?.ctx === ctx && ctx.state !== 'running') refused(`${why}:rejected`); },
  );
  if (!decide) {
    decide = setTimeout(() => { decide = null; if (ctx.state === 'running') granted(`${why}:late`); else refused(`${why}:timeout`); }, BLOCK_DECIDE_MS);
    decide?.unref?.();
  }
}

// the load-time try: the autoplay policy first (where the browser has one), then the context's own answer
function tryOnLoad() {
  if (sound.muted || sound.unlocked) return;
  const policy = autoplayPolicy();
  if (soundLogOn()) soundLog('engine:load-try', { policy }); // SOUNDLOG
  if (policy === 'disallowed' || policy === 'allowed-muted') { refused(`policy:${policy}`); return; }
  begin('load');
}

export function armUnlock() {
  if (armed || typeof window === 'undefined') return;
  armed = true;
  // an unmute while the sound waits (the MUTE button's click is itself a gesture) tries at once
  let wasMuted = sound.muted;
  sound.subscribe((s) => {
    const unmuted = wasMuted && !s.muted;
    wasMuted = s.muted;
    if (unmuted && !s.unlocked) begin('unmute');
  });
  tryOnLoad();
  // a muted visitor: the listener waits quietly so an unmute later still starts the sound
  if (!sound.unlocked) armGesture();
}

// a control that means "start the sound now" (the hero's CLICK TO PLAY): inside its click this starts the sound; a
// muted page or a started one is left as it is
export function requestStart(why = 'request') {
  if (sound.muted) return false;
  if (E && sound.unlocked && E.ctx.state === 'running') return true;
  begin(why);
  return !!E && E.ctx.state === 'running';
}

// tests and non-browser hosts: unlock and build at once
export function unlockNow() {
  sound.unlock();
  start();
  return E;
}

export function setMaster(v) {
  if (E) ramp(E.master.gain, Math.min(1, Math.max(0, +v || 0)), E.ctx.currentTime, 0.1);
}

export function masterAnalyser() {
  if (!E) return null;
  if (E.analyser) return E.analyser;
  try {
    const an = E.ctx.createAnalyser();
    an.fftSize = 2048;
    an.smoothingTimeConstant = 0.55;
    an.minDecibels = -90;
    an.maxDecibels = -20;
    E.limit.connect(an);
    E.analyser = an;
  } catch {
    E.analyser = null;
  }
  return E.analyser;
}

export function tapBus(Eng, name) {
  if (!Eng?.ctx) return null;
  if (!Eng.taps) Eng.taps = new Map();
  const key = String(name);
  if (!Eng.taps.has(key)) {
    const g = Eng.ctx.createGain();
    g.gain.value = 1;
    Eng.taps.set(key, g);
  }
  return Eng.taps.get(key);
}

export function getMaster() {
  return E ? E.master.gain.value : 0.8;
}

export function setReturn(name, v) {
  if (!E || !E[name]) return;
  ramp(E[name].output.gain, Math.min(1, Math.max(0, +v || 0)), E.ctx.currentTime, 0.1);
}

export function createChannel(Eng, { level = 0.6, filter = 12000, reverb = 0.2, delay = 0, fadeIn = 1.5, demand: demandOn = true, anchor = null } = {}) {
  const { ctx } = Eng;
  const input = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = filter;
  lp.Q.value = 0.5;
  const fader = ctx.createGain();
  fader.gain.value = 0;
  const rev = ctx.createGain();
  rev.gain.value = reverb;
  const dly = ctx.createGain();
  dly.gain.value = delay;
  // THE RADIAL PULSE (pulse.js): the swell, the brightening and the pan a passing wave gives this channel, after the
  // fader and before the master, so the channel's own level and sends never meet the wave's automation
  const P = pulseNodes(ctx);
  input.connect(lp);
  lp.connect(fader);
  fader.connect(P.gain);
  P.gain.connect(P.shelf);
  let tail = P.shelf;
  if (P.pan) { P.shelf.connect(P.pan); tail = P.pan; }
  tail.connect(Eng.master);
  fader.connect(rev);
  fader.connect(dly);
  const unpulse = registerPulseTarget({ anchor, ctx, gain: P.gain.gain, shelf: P.shelf.gain ?? null, pan: P.pan?.pan ?? null });
  rev.connect(Eng.reverb.input);
  dly.connect(Eng.delay.input);
  let lvl = level;
  let on = true;
  const token = {};
  // a channel that plays holds the context awake (THE DEMAND); demand: false for a long-lived channel of one-shots,
  // whose player calls holdSound() per shot instead
  const want = (p) => { if (demandOn) wantSound(token, p); };
  const apply = (tau) => ramp(fader.gain, on ? lvl : 0, ctx.currentTime, tau);
  apply(fadeIn / 3);
  want(true);
  return {
    input,
    filter: lp,
    get level() { return lvl; },
    setLevel(v) { lvl = Math.min(1, Math.max(0, +v || 0)); apply(0.1); },
    setPlaying(p) { on = !!p; apply(on ? 0.4 : 0.05); want(on); },
    setSends({ reverb: r, delay: d, filter: f } = {}) {
      const t = ctx.currentTime;
      if (r != null) ramp(rev.gain, r, t, 0.1);
      if (d != null) ramp(dly.gain, d, t, 0.1);
      if (f != null) ramp(lp.frequency, f, t, 0.1);
    },
    get anchor() { return anchor; },
    dispose() {
      ramp(fader.gain, 0, ctx.currentTime, 0.05);
      want(false);
      unpulse();
      setTimeout(() => {
        for (const n of [input, lp, fader, rev, dly, P.gain, P.shelf, P.pan]) if (n) try { n.disconnect(); } catch { /* already gone */ }
      }, 300);
    },
  };
}
