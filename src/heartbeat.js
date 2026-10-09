// settle-hear · heartbeat - THE BADUMP's sound (lane HEROKEYS, navigator 2026-10-04: "the LEFT and RIGHT keyboard keys
// make the HERO go next and previous! With a BADUMP! And a sound"). A short heartbeat: two low soft thumps, the second
// louder, and a gentle tone in THE DJ's current key, placed on THE MASTER BEAT's next flash line.
//
// <claudes_code_comments>
// ** Function List **
// HEARTBEAT                    - the numbers: the gap between the thumps, each thump's pitch fall and envelope, the
//                                tone's octave window and envelope, the channel level (the click channel's)
// heartbeatKey(theme)          - THE DJ's key for the tone: the theme's root in Hz, folded into the tone's octave
//                                window (jam.js jamKey and tuning.js midiHz; no theme: A minor's root, A = 432)
// heartbeatPlan(opts)          - pure: the voices to play, [{ at, type, f0, f1, glide, peak, attack, release }], times
//                                in seconds from the first thump; opts = { rootHz, strength }
// renderPlan(plan, rate)       - pure: the plan rendered as samples in plain JS (sines under linear envelopes, as the
//                                audio graph draws them) -> { peak, rms, samples }; the tests measure the level with it
// playHeartbeat(opts)          - play one: { strength, pan, theme }; null with no audio engine yet, under MUTE ALL,
//                                or while the page is away; else { at, rootHz, voices, peak }
//
// ** Technical Review **
// - THE SHAPE: thump one at 0 s, thump two HEARTBEAT.gapMs later (140 ms, the badump's own gap on the picture), each a
//   sine falling in pitch (about 70 Hz to 45 Hz) with a 2x partial at 0.35 of its level so a small speaker that cannot
//   play 45 Hz still hears the beat. The second thump is 1.4x the first. The tone is one sine on the DJ's root, folded
//   into 196 to 392 Hz, starting with the second thump, a slow 40 ms attack and a 0.5 s release, quieter than either
//   thump: a soft colour, never a melody.
// - THE TONE RULES (TONE_RULES.md): every envelope starts and ends at zero, attack at least 4 ms, release at least
//   60 ms; sines only, so no low-pass is owed; pitched on A = 432 through midiHz.
// - LOUDNESS, MEASURED: renderPlan sums the voices exactly as the graph does and the tests hold the result under the
//   softest click a visitor's hero click can make (CLICK_TONE.peak x 0.52, the hero's first-click strength), in peak
//   and in RMS, through the same channel level. The README records the measured numbers.
// - THE MIXER: one channel of its own (engine.createChannel, the click channel's level, filter and a little room), so
//   the heartbeat passes the master, the radial pulse's swell and MUTE ALL's gain like every other hero sound. No
//   click lock: the heartbeat is one fixed sound, so a lock (which holds a choice among sounds) has nothing to hold;
//   the page's own step throttle (SETTLE/settle-site heroKeys.js) bounds how often it plays.
// - ON THE MASTER BEAT: the first thump starts on the next 25 ms flash line (masterStartTime, flashHz 40), as a click
//   noise does, so the heartbeat shares the 40 Hz light's phase.
// - THE GESTURE RULE: nothing is built before the page's AudioContext exists (engine.js builds it on the first
//   pointerdown or keydown; an arrow key press is a keydown, so the first step may unlock the sound and the beat
//   itself plays from the next step on).
// </claudes_code_comments>

import * as engine from './engine.js';
import { sound } from './control.js';
import { masterStartTime, masterGrid } from './masterbeat.js';
import { midiHz } from './tuning.js';
import { jamKey } from './jam.js';
import { djLive } from './djlive.js';
import { CLICK_TONE } from './clicks.js';

export const HEARTBEAT = Object.freeze({
  gapMs: 140,
  thump: Object.freeze({ f0: 70, f1: 45, glide: 0.09, peak: 0.026, attack: 0.006, release: 0.16, partial: 0.35 }),
  second: 1.4, // the second thump's level against the first: ba-DUMP
  tone: Object.freeze({ lo: 196, hi: 392, peak: 0.008, attack: 0.04, release: 0.5 }),
  level: CLICK_TONE.level, // the channel's fader: the click channel's own
  reverb: 0.08,
});

export function heartbeatKey(theme = null) {
  const k = jamKey(theme);
  let f = midiHz(k.root);
  if (!(f > 0)) f = 216;
  const { lo, hi } = HEARTBEAT.tone;
  while (f < lo) f *= 2;
  while (f >= hi) f /= 2;
  return f;
}

export function heartbeatPlan({ rootHz = heartbeatKey(null), strength = 1 } = {}) {
  const s = Math.min(1, Math.max(0, Number.isFinite(strength) ? strength : 1));
  const T = HEARTBEAT.thump;
  const gap = HEARTBEAT.gapMs / 1000;
  const out = [];
  for (const [at, k] of [[0, 1], [gap, HEARTBEAT.second]]) {
    const p = T.peak * k * s;
    out.push({ at, type: 'sine', f0: T.f0, f1: T.f1, glide: T.glide, peak: p, attack: T.attack, release: T.release });
    out.push({ at, type: 'sine', f0: T.f0 * 2, f1: T.f1 * 2, glide: T.glide, peak: p * T.partial, attack: T.attack, release: T.release * 0.8 });
  }
  const tn = HEARTBEAT.tone;
  out.push({ at: gap, type: 'sine', f0: rootHz, f1: rootHz, glide: 0, peak: tn.peak * s, attack: tn.attack, release: tn.release });
  return out;
}

// one voice's envelope value at t seconds after its start: 0 -> peak over attack, peak -> 0 over release
const envAt = (v, t) => {
  if (t < 0) return 0;
  if (t < v.attack) return (v.peak * t) / v.attack;
  const r = t - v.attack;
  return r < v.release ? v.peak * (1 - r / v.release) : 0;
};

export function renderPlan(plan, rate = 16000) {
  const end = Math.max(0, ...plan.map((v) => v.at + v.attack + v.release));
  const n = Math.ceil(end * rate) + 1;
  const samples = new Float32Array(n);
  for (const v of plan) {
    let phase = 0;
    const i0 = Math.floor(v.at * rate);
    const len = Math.ceil((v.attack + v.release) * rate) + 1;
    for (let j = 0; j < len && i0 + j < n; j++) {
      const t = j / rate;
      // the frequency glides exponentially from f0 to f1 over glide seconds, as exponentialRampToValueAtTime does
      const f = v.glide > 0 && v.f1 !== v.f0 ? v.f0 * Math.pow(v.f1 / v.f0, Math.min(1, t / v.glide)) : v.f0;
      phase += (2 * Math.PI * f) / rate;
      samples[i0 + j] += envAt(v, t) * Math.sin(phase);
    }
  }
  let peak = 0;
  let sq = 0;
  for (const x of samples) { peak = Math.max(peak, Math.abs(x)); sq += x * x; }
  // the RMS over the loud part: the 50 ms window with the most energy, so a long quiet tail does not dilute it
  const w = Math.max(1, Math.round(0.05 * rate));
  let acc = 0;
  let best = 0;
  for (let i = 0; i < n; i++) {
    acc += samples[i] * samples[i];
    if (i >= w) acc -= samples[i - w] * samples[i - w];
    best = Math.max(best, acc);
  }
  return { peak, rms: Math.sqrt(best / w), samples, total: Math.sqrt(sq / Math.max(1, n)) };
}

let channel = null;
let channelFor = null;
const ensureChannel = (E) => {
  if (channel && channelFor === E) return channel;
  channel = engine.createChannel(E, { demand: false, level: HEARTBEAT.level, reverb: HEARTBEAT.reverb, filter: 6000, fadeIn: 0.05 });
  channelFor = E;
  return channel;
};

function voice(ctx, out, t, v) {
  const g = ctx.createGain();
  const a = Math.max(CLICK_TONE.attackMin, v.attack);
  const r = Math.max(CLICK_TONE.releaseMin, v.release);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(Math.max(0, v.peak), t + a);
  g.gain.linearRampToValueAtTime(0, t + a + r);
  g.connect(out);
  const o = ctx.createOscillator();
  o.type = v.type;
  o.frequency.setValueAtTime(v.f0, t);
  if (v.f1 && v.f1 !== v.f0) o.frequency.exponentialRampToValueAtTime(v.f1, t + Math.max(0.01, v.glide));
  o.connect(g);
  o.start(t);
  o.stop(t + a + r + 0.02);
  o.onended = () => { try { o.disconnect(); g.disconnect(); } catch { /* gone */ } };
}

export function playHeartbeat({ strength = 1, pan = 0, theme } = {}) {
  const E = engine.getEngine();
  if (!E || !sound.audible || engine.isAway()) return null;
  const ctx = E.ctx;
  const ch = ensureChannel(E);
  const rootHz = heartbeatKey(theme === undefined ? djLive.get()?.theme ?? null : theme);
  const plan = heartbeatPlan({ rootHz, strength });
  let into = ch.input;
  if (ctx.createStereoPanner) {
    const pn = ctx.createStereoPanner();
    pn.pan.value = Math.max(-1, Math.min(1, Number.isFinite(pan) ? pan : 0));
    pn.connect(ch.input);
    into = pn;
  }
  engine.holdSound?.(1); // THE DEMAND: the beat wakes a suspended context for its length
  const t = masterStartTime(ctx, { lead: 0.005, periodMs: 1000 / masterGrid().flashHz });
  try {
    for (const v of plan) voice(ctx, into, t + v.at, v);
  } catch {
    return null;
  }
  const later = setTimeout(() => { try { if (into !== ch.input) into.disconnect(); } catch { /* gone */ } }, 2000);
  later?.unref?.();
  return { at: t, rootHz, voices: plan.length, peak: Math.max(...plan.map((v) => v.peak)) };
}
