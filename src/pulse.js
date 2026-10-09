// settle-hear · pulse - THE SOUND'S ANSWER TO A RADIAL PULSE (lane RADIALPULSE, navigator 2026-10-02: "anything that
// makes sound changes too, by the gradient outflow, radially!"). Every playing channel answers the wave as it passes
// its on-screen anchor: a brief brightening (a high shelf opening), a small swell, and a pan toward the wave's
// direction, all within the limiter and MUTE ALL, nothing loud.
//
// <claudes_code_comments>
// ** Function List **
// SOUND_PULSE                        - the limits: shelf +2.5 dB at 2.2 kHz, swell +1 dB, pan 0.3, 180 .. 1200 ms
// soundPulseShape(w, o)                   - pure: { gain (a linear multiplier), shelf (dB), pan, ms } from a wave's gradient,
//                                      direction and crossing time, every value inside the limits
// pulseNodes(ctx, o)                 - the three nodes a channel inserts after its fader: a unity gain (the swell), a
//                                      high shelf at 0 dB (the brightening) and a stereo panner at 0 (the pan); the
//                                      panner is null where the context has none
// registerPulseTarget(target) -> off - a playing sound joins the answer: { anchor, ctx, gain?, shelf?, pan? } (the
//                                      AudioParams); dispose calls off()
// pulseTargets(anchor)               - the live targets with that anchor (null: the unanchored ones)
// applyPulse(target, shape, at)      - the automation on one target: up over `attack`, back over the crossing
// soundPulse(w, { anchors })         - the page's call: shape the wave once and apply it to every live target whose
//                                      anchor is in `anchors`; returns how many answered (0 when not audible)
// onPulseTargets(fn)                 - hear every target join (fn(t, 'add')) or leave (fn(t, 'remove')): the band tap
//                                      (bands.js) listens to the hero's channels through this
// WOBBLE                             - THE WOBBLE's numbers (lane SOUNDSHAKE): the life of a click's waves, the
//                                      envelope, the saturation, the most a calm and an alive page may wobble
// wobbleEnvelope(u)                  - pure: one wave's share of its energy at u (0 born .. 1 gone): (1 - u)^2, after a
//                                      short rise; exactly 0 at and past 1
// wobbleDepth(energy, cap)           - pure: cap * (1 - exp(-energy / WOBBLE.k)): many waves saturate, never pass cap
// createWobble({ now })              - the live wave energy: .add({ strength, lifeMs, at }) for a user's click or box,
//                                      .energy(t), .level(t, cap), .alive(t), .clear(); waves past their life drop out
// registerWobbleTarget(bus) -> off   - a bus with .wobble(x, t) joins THE WOBBLE (dj-fx.js createFxBus registers)
// soundWobble(x)                     - the page's call: every wobble target to x (0..1); 0 while not audible, so MUTE
//                                      ALL and PAUSE ALL return the sound to normal at once; returns how many answered
// wobbleLevel() / wobbleTargets()    - the last depth sent, and the live buses (a browser check reads their params)
// soundHit(detail) / onSoundHit(fn)  - a played instrument hit (jam.js playOnEngine: a visitor's hit or a loop's) is
//                                      announced with its key and its delay in ms; the page can answer it in a picture
//
// ** Technical Review **
// - settle-hear never imports settle-see. THE RADIAL PULSE BUS (settle-see radialpulse.js) owns the geometry and the
//   timing; a page registers its sound anchors on the bus (a rectangle on screen) and hands each arriving wave to
//   soundPulse(). So the sound follows the same delay, the same gradient (w.a) and the same direction (w.dir) as every
//   drawing on the page, with no second clock and no per-frame audio writes.
// - THE ANSWER IS SCHEDULED ONCE, AT ARRIVAL. A wave's crossing time (w.passMs) is known when it arrives, so each
//   parameter is given one rise (setTargetAtTime toward its peak over SOUND_PULSE.attack) and one fall (back to rest
//   over the second half of the crossing); the wave's gradient then shapes the whole answer with no further calls.
// - THE LIMITS. The swell is at most +1 dB (gain x 1.122) at full gradient, so it can never be loud and the limiter
//   after the master never sees a new peak class; the shelf opens at most +2.5 dB above 2.2 kHz, a brightening you
//   hear as the wave passing rather than a level change; the pan moves at most 0.3 toward the wave's direction (its
//   x component), so a sound never jumps to one ear. Every value is clamped before it is written, and a target with no
//   panner (the binaural pair, whose two ears must stay apart) takes the swell alone.
// - MUTE ALL and the gesture rule: soundPulse() writes nothing unless sound.audible (not muted, started). The nodes
//   sit before the mute gain and the limiter, so a muted page stays silent whatever a wave does.
// - The three nodes are built by createChannel (engine.js) between the fader and the master, so every mixer channel
//   answers by default; a channel names its anchor ('hero', 'page', or none) and the page decides which anchors a
//   consumer serves. Since lane SOUNDSHAKE a target also carries its channel's last node (`node`), so a listener
//   (bands.js) can tap exactly the hero's channels.
// - THE WOBBLE (lane SOUNDSHAKE, navigator 2026-10-04: "It goes both ways, but only on RADIAL EVENTS: user clicks and
//   user rectangles! ... the sound goes wobbly for some time until all that dissipates"). THE OTHER DIRECTION of the
//   answer above: while the waves a visitor started on the hero still live, THE DJ's bus wobbles. The page adds each
//   wave (a click: WOBBLE.clickMs; a box: its own life) to createWobble; the energy is the sum of every live wave's
//   strength times wobbleEnvelope of its age, so it rises at once and falls smoothly to exactly zero as the waves
//   dissipate. wobbleDepth saturates it, so a storm of clicks stays musical (at most the mode's cap: WOBBLE.calm or
//   WOBBLE.alive). soundWobble hands the depth to every registered bus, whose stage (dj-fx.js WOBBLE_STAGE) turns it
//   into a vibrato and a tremolo. It never touches the binaural pair (not on the bus), never runs while MUTE ALL or
//   PAUSE ALL hold (soundWobble writes 0), and the picture's own sound pops (the sound into the picture) never feed it.
// </claudes_code_comments>

import { sound } from './control.js';
import { isAway } from './engine.js';

export const SOUND_PULSE = Object.freeze({
  shelfHz: 2200, // the brightening's corner
  shelfDb: 2.5, // the shelf opens by up to this at full gradient
  swellDb: 1.0, // the swell at full gradient, in dB (x 1.122)
  pan: 0.3, // the pan toward the wave's direction, at most
  minMs: 180, // the answer lasts the crossing, clamped to this range
  maxMs: 1200,
  attack: 0.06, // s: the rise's time constant
});

const c01 = (x) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
const dbGain = (db) => Math.pow(10, db / 20);

export function soundPulseShape(w, o = SOUND_PULSE) {
  const a = c01(w?.a);
  const dx = Number.isFinite(w?.dir?.x) ? Math.max(-1, Math.min(1, w.dir.x)) : 0;
  const raw = w?.reduced ? (w.ms ?? o.minMs) : w?.passMs;
  const ms = Math.min(o.maxMs, Math.max(o.minMs, Number.isFinite(raw) ? raw : o.minMs));
  return {
    gain: dbGain(o.swellDb * a),
    shelf: o.shelfDb * a,
    pan: Math.max(-o.pan, Math.min(o.pan, o.pan * a * dx)),
    ms,
    a,
  };
}

export function pulseNodes(ctx, o = SOUND_PULSE) {
  const gain = ctx.createGain();
  gain.gain.value = 1;
  const shelf = ctx.createBiquadFilter();
  shelf.type = 'highshelf';
  if (shelf.frequency) shelf.frequency.value = o.shelfHz;
  if (shelf.gain) shelf.gain.value = 0;
  let pan = null;
  try { pan = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null; } catch { pan = null; }
  if (pan?.pan) pan.pan.value = 0;
  else pan = null;
  return { gain, shelf, pan };
}

const targets = new Set();
const watchers = new Set();
const tellTargets = (t, what) => { for (const fn of watchers) { try { fn(t, what); } catch { /* a watcher that fails is left alone */ } } };

export function registerPulseTarget(target) {
  if (!target || typeof target !== 'object') return () => {};
  const t = { anchor: target.anchor ?? null, ctx: target.ctx, gain: target.gain ?? null, shelf: target.shelf ?? null, pan: target.pan ?? null, node: target.node ?? null };
  targets.add(t);
  tellTargets(t, 'add');
  return () => { if (targets.delete(t)) tellTargets(t, 'remove'); };
}

// hear every target join and leave; fn is called at once for the targets already live
export function onPulseTargets(fn) {
  if (typeof fn !== 'function') return () => {};
  watchers.add(fn);
  for (const t of targets) { try { fn(t, 'add'); } catch { /* ignore */ } }
  return () => watchers.delete(fn);
}

export function pulseTargets(anchor = null) {
  return [...targets].filter((t) => (t.anchor ?? null) === (anchor ?? null));
}

// one parameter: rise toward `peak` over `attack`, fall back to `rest` from half way through the crossing
function bump(param, rest, peak, at, ms, o) {
  if (!param) return;
  const half = ms / 2000;
  try {
    param.cancelScheduledValues?.(at);
    param.setTargetAtTime(peak, at, o.attack);
    param.setTargetAtTime(rest, at + half, Math.max(0.03, half * 0.6));
  } catch {
    /* a parameter that refuses is left where it was */
  }
}

export function applyPulse(target, shape, at = null, o = SOUND_PULSE) {
  const ctx = target?.ctx;
  if (!ctx || !shape) return false;
  const t = Number.isFinite(at) ? at : ctx.currentTime;
  bump(target.gain, 1, shape.gain, t, shape.ms, o);
  bump(target.shelf, 0, shape.shelf, t, shape.ms, o);
  bump(target.pan, 0, shape.pan, t, shape.ms, o);
  return true;
}

export function soundPulse(w, { anchors = [null], at = null } = {}) {
  if (!sound.audible || !w) return 0;
  const shape = soundPulseShape(w);
  if (shape.a <= 0) return 0;
  let n = 0;
  for (const t of targets) {
    if (!anchors.includes(t.anchor ?? null)) continue;
    if (applyPulse(t, shape, at)) n++;
  }
  return n;
}

// ── THE WOBBLE (lane SOUNDSHAKE): the sound's answer to the waves a visitor starts on the hero ──

export const WOBBLE = Object.freeze({
  clickMs: 3200, // a click's waves on the hero: its rings and its page pulse, until they have faded
  riseMs: 80, // a wave's energy rises over this, so a click never clicks the bus
  k: 1.2, // the saturation: one full-strength click is 1 - e^(-1/1.2) = 57% of the cap
  calm: 0.45, // the most a calm page wobbles (about 11 cents of vibrato, a tremolo dip of 0.1)
  alive: 0.9, // the most an alive page wobbles (about 22 cents, a dip of 0.2)
  maxWaves: 64, // the oldest wave is dropped past this
});

export function wobbleEnvelope(u, rise = WOBBLE.riseMs / WOBBLE.clickMs) {
  if (!Number.isFinite(u) || u < 0 || u >= 1) return 0;
  const up = rise > 0 ? Math.min(1, u / rise) : 1;
  return up * (1 - u) * (1 - u);
}

export function wobbleDepth(energy, cap = WOBBLE.alive) {
  const e = Number.isFinite(energy) && energy > 0 ? energy : 0;
  const c = Number.isFinite(cap) ? Math.min(1, Math.max(0, cap)) : 0;
  return c * (1 - Math.exp(-e / WOBBLE.k));
}

const wallNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function createWobble({ now = wallNow } = {}) {
  let waves = [];
  const prune = (t) => { if (waves.length) waves = waves.filter((w) => t - w.at < w.life); };
  return {
    add({ strength = 1, lifeMs = WOBBLE.clickMs, at } = {}) {
      const s = Number.isFinite(strength) ? Math.min(1, Math.max(0, strength)) : 0;
      const life = Number.isFinite(lifeMs) && lifeMs > 0 ? lifeMs : WOBBLE.clickMs;
      if (s <= 0) return false;
      waves.push({ s, life, at: Number.isFinite(at) ? at : now() });
      if (waves.length > WOBBLE.maxWaves) waves.shift();
      return true;
    },
    energy(t = now()) {
      prune(t);
      let e = 0;
      for (const w of waves) e += w.s * wobbleEnvelope((t - w.at) / w.life, WOBBLE.riseMs / w.life);
      return e;
    },
    level(t = now(), cap = WOBBLE.alive) { return wobbleDepth(this.energy(t), cap); },
    alive(t = now()) { prune(t); return waves.length; },
    clear() { waves = []; },
  };
}

const wobblers = new Set();
let wobbleNow = 0;

export function registerWobbleTarget(bus) {
  if (!bus || typeof bus.wobble !== 'function') return () => {};
  wobblers.add(bus);
  if (wobbleNow > 0 && sound.audible && !isAway()) { try { bus.wobble(wobbleNow); } catch { /* ignore */ } }
  return () => wobblers.delete(bus);
}

export function soundWobble(x) {
  const w = sound.audible && !isAway() && Number.isFinite(+x) ? Math.min(1, Math.max(0, +x)) : 0;
  wobbleNow = w;
  let n = 0;
  for (const b of wobblers) { try { b.wobble(w); n++; } catch { /* a bus that refuses stays as it was */ } }
  return n;
}
export const wobbleLevel = () => wobbleNow;
// the live wobble targets (THE DJ's buses), for a check that reads what the bus was told and where its params stand
export const wobbleTargets = () => [...wobblers];

// ── a played hit, for a page that answers sound in a picture ──
const hitSubs = new Set();
export function soundHit(detail) {
  if (!detail || typeof detail !== 'object') return 0;
  let n = 0;
  for (const fn of hitSubs) { try { fn(detail); n++; } catch { /* ignore */ } }
  return n;
}
export function onSoundHit(fn) {
  if (typeof fn !== 'function') return () => {};
  hitSubs.add(fn);
  return () => hitSubs.delete(fn);
}
