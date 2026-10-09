// settle-hear · duck - THE DUCK (lane DROPDUCK, navigator 2026-10-06: "Add the duck."): on every drag-box drop the
// DJ's bus dips 3.5 dB for about 300 ms, the way radio ducks the music under the host.
//
// <claudes_code_comments>
// ** Function List **
// DUCK                        - THE DUCK's numbers: the depth (3.5 dB), the attack's time constant (12 ms), the hold
//                               (260 ms), the release's time constant (80 ms)
// MACHINE_FROM                - the wave families that are the machine's own ('sound' pops, 'keys' steps): never ducked
// duckGainAt(t, o)            - pure: the bus gain t seconds after one duck starts (1 before it and long after it)
// duckShape(o, dt)            - pure: { depthDb, lengthMs, oneDbMs, settleMs } of one duck, read from duckGainAt;
//                               lengthMs is the time the bus sits more than half the depth down
// scheduleDuck(param, t, o)   - the automation on one gain param: down over the attack, held, back over the release;
//                               a second duck before the first ends extends it and never stacks below the depth
// registerDuckTarget(bus)     - a bus with .duck(t) joins THE DUCK (dj-fx.js createFxBus registers); returns off()
// duckTargets()               - the live buses (a browser check reads their params)
// duckGain(ctx, kind)         - THE MIX'S DUCK (lane DJSILENCE): a gain at 1 for a channel of the mix (the picture's
//                               static, the binaural pair) that joins THE DUCK as a channel; { node, off() }
// registerDuckChannel(ch)     - a channel { kind, duck(t) } joins THE DUCK; returns off()
// duckChannels()              - the live channels of the mix that duck (a browser check reads their kinds)
// duckDrop({ from, at })      - the page's call for one drop: every live bus and every channel of the mix ducks;
//                               returns how many did. 0 under MUTE ALL, before the gesture, on an away or paused page,
//                               and for a machine wave
// onDuck(fn)                  - fn({ ok, reason, buses, channels, from }) for every duck asked for; returns off()
//
// ** Technical Review **
// - WHERE: the duck is a gain on dj-fx.js's bus between THE WOBBLE and the bus limiter, so the DJ's music dips while
//   the binaural pair (its own dry channel, symphony.js) and the clicks' channel never meet it. Each ear keeps its
//   tone and the 40 Hz beat is untouched; the drop's card keeps its levelled gain (clicks.js THE DROP) and the duck is
//   in addition.
// - THE SHAPE: setTargetAtTime toward 10^(-3.5/20) = 0.668 with a 12 ms time constant (95% of the way in 36 ms), held
//   until 260 ms, then setTargetAtTime back to 1 with an 80 ms time constant. Read from duckGainAt: 3.5 dB deep, more
//   than half the depth down for 298 ms, more than 1 dB down for 344 ms, back within 0.1 dB at 530 ms. Both legs are
//   exponential approaches, so the dip has no corner a listener hears as a click.
// - ONE DROP, ONE DUCK: clicks.js playDropNoise calls duckDrop on a drop's FIRST noise that plays, so the four noises
//   90 ms apart sit inside one dip. A drop THE NOISE GATE held back plays nothing and ducks nothing: there is no host
//   to duck under. A second drop inside the first's dip restarts the hold from its own time (the param's scheduled
//   release is cancelled and the gain heads to the same depth again), so ducks never stack deeper than DUCK.depthDb.
// - NEVER UNDER MUTE ALL, NEVER FOR THE MACHINE: duckDrop writes nothing unless sound.audible and the page is not
//   away (PAUSE ALL, a hidden tab), and refuses a wave whose family is the machine's own (settle-see's radial effects:
//   'sound' for the DJ's pops, 'keys' for a key step). A drop with no family is a person's: only a hand drags a box.
// - THE MIX DUCKS TOO (lane DJSILENCE, navigator 2026-10-07, choosing THE DUCK for drops lost in DEFAULT MODE):
//   measured on one page with DEFAULT MODE pinned, the DJ's bus sits about 13 dB under the master, which the picture's
//   static and the binaural pair carry, so a drop sat about 6.5 dB under the mix and a bus-only duck could lift it by
//   0.2 dB. Every channel of the mix that is not the drop's own now carries a duck gain (duckGain): the hearing's
//   channel (hear.js, the static), the symphony's dry channel and the gamma sound's dry channel (the binaural pair and
//   the mode's pad). The same shape, the same trigger, the same refusals. The gain is a level only: it sits after the
//   oscillators and the merger, so each ear's tone and the beat frequency never move (the oscillators' frequency
//   params are never written by a duck). The clicks' channel and the sfx channel never duck: the drop is their sound.
// - The registry mirrors THE WOBBLE's (pulse.js registerWobbleTarget): settle-hear never imports settle-see, and the
//   page never holds a bus; a bus that throws is left as it was.
// </claudes_code_comments>

import { sound } from './control.js';
import { isAway } from './engine.js';

export const DUCK = Object.freeze({ depthDb: 3.5, attack: 0.012, hold: 0.26, release: 0.08 });
export const MACHINE_FROM = Object.freeze(['sound', 'keys']);

const floorOf = (o) => Math.pow(10, -Math.abs(o.depthDb) / 20);

export function duckGainAt(t, o = DUCK) {
  if (!Number.isFinite(t) || t < 0) return 1;
  const gd = floorOf(o);
  const down = (u) => gd + (1 - gd) * Math.exp(-u / o.attack);
  if (t < o.hold) return down(t);
  const gh = down(o.hold);
  return 1 - (1 - gh) * Math.exp(-(t - o.hold) / o.release);
}

export function duckShape(o = DUCK, dt = 0.0005) {
  let min = 0;
  let half = 0;
  let one = 0;
  let settle = 0;
  const end = o.hold + 12 * o.release;
  for (let t = 0; t < end; t += dt) {
    const d = 20 * Math.log10(duckGainAt(t, o));
    if (d < min) min = d;
    if (d < -Math.abs(o.depthDb) / 2) half += dt;
    if (d < -1) one += dt;
    if (d < -0.1) settle = t;
  }
  return { depthDb: +(-min).toFixed(3), lengthMs: Math.round(half * 1000), oneDbMs: Math.round(one * 1000), settleMs: Math.round(settle * 1000) };
}

export function scheduleDuck(param, t, o = DUCK) {
  if (!param || !Number.isFinite(t)) return false;
  const gd = floorOf(o);
  try {
    // events at or after t go (an earlier duck's release among them); a setTarget already running keeps its start,
    // and the new one takes over from the value it has reached at t
    param.cancelScheduledValues?.(t);
    param.setTargetAtTime(gd, t, Math.max(0.001, o.attack));
    param.setTargetAtTime(1, t + o.hold, Math.max(0.001, o.release));
    return true;
  } catch {
    return false;
  }
}

const buses = new Set();
const subs = new Set();

export function registerDuckTarget(bus) {
  if (!bus || typeof bus.duck !== 'function') return () => {};
  buses.add(bus);
  return () => buses.delete(bus);
}
export const duckTargets = () => [...buses];

const channels = new Set();
export function registerDuckChannel(ch) {
  if (!ch || typeof ch.duck !== 'function') return () => {};
  channels.add(ch);
  return () => channels.delete(ch);
}
export const duckChannels = () => [...channels];

// a channel's duck: a gain at 1 placed by the caller in the channel's chain, ducked like the bus's
export function duckGain(ctx, kind = 'mix') {
  const node = ctx.createGain();
  node.gain.value = 1;
  const ch = { kind, node, duck: (t) => scheduleDuck(node.gain, Number.isFinite(t) ? t : ctx.currentTime) };
  const off = registerDuckChannel(ch);
  return { node, off };
}

export function onDuck(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

function tell(detail) {
  for (const fn of subs) { try { fn(detail); } catch { /* a listener that fails is left alone */ } }
}

export function duckDrop({ from = null, at } = {}) {
  const why = !sound.audible ? (sound.muted ? 'muted' : 'before-gesture') : isAway() ? 'paused' : MACHINE_FROM.includes(from) ? 'machine' : null;
  if (why) {
    tell({ ok: false, reason: why, buses: 0, channels: 0, from });
    return 0;
  }
  let n = 0;
  for (const b of buses) { try { if (b.duck(at) !== false) n++; } catch { /* a bus that refuses stays as it was */ } }
  let c = 0;
  for (const ch of channels) { try { if (ch.duck(at) !== false) c++; } catch { /* a channel that refuses stays as it was */ } }
  tell({ ok: n + c > 0, reason: n + c > 0 ? null : 'no-dj', buses: n, channels: c, from });
  return n + c;
}
