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
//   consumer serves.
// </claudes_code_comments>

import { sound } from './control.js';

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

export function registerPulseTarget(target) {
  if (!target || typeof target !== 'object') return () => {};
  const t = { anchor: target.anchor ?? null, ctx: target.ctx, gain: target.gain ?? null, shelf: target.shelf ?? null, pan: target.pan ?? null };
  targets.add(t);
  return () => targets.delete(t);
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
