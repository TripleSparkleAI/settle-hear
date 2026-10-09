// settle-hear · echoguitar - THE ECHO GUITAR (lane ECHOGUITAR, 2026-10-07): an electric guitar of our own, a few
// notes and a slide, repeated by a tempo-synced echo that darkens as it falls, in a small room.
//
// <claudes_code_comments>
// ** Function List **
// ECHO_GUITAR               - the voice's numbers, and beside them the reference's measured numbers they answer
// ECHO_PHRASES              - three original phrases (scale steps, beats, one slide each), dealt by a set's seed
// guitarNote(ctx, out, f, t, dur, vel, slide) - one plucked electric guitar note, with an optional slide to a
//                             second pitch; the nodes stop and disconnect themselves
// createEcho(ctx, out, { beatDur, beats, feedback, tone, wet }) - the tempo-synced echo: { input, setBeat(beatDur, t),
//                             dispose(at) }
// createRoom(ctx, out, { rt60, wet }) - the small room: four damped feedback combs and two allpasses, all delays
//                             (no convolver), so the offline renderer can measure it: { input, dispose(at) }
// phrasePlan({ root, mode, phrase, beatDur, t0, register }) - the notes of one phrase: [{ t, dur, midi, slideTo,
//                             slideAt, slideTime }], pitched in the key from the scale's own steps
// phraseOf(seed)            - the phrase a seed deals (THE DECK RULE is the caller's: this is a plain index)
// playEchoPhrase(ctx, out, opts) - the whole sound: the phrase through the echo and the room, freed after its tail;
//                             returns { notes, end, echoSeconds }
//
// ** Technical Review **
// - THE REFERENCE (SETTLE/runs/echoguitar/analysis.json, measured from a dub session's recording that is kept
//   outside this repository and never shipped): about 120 bpm; a free-running echo of 0.3677 s, 0.735 beats, 2%
//   short of a dotted eighth; its tail fell 1.06 dB a repeat (loop gain 0.885); the room's fall after each repeat
//   gives a ceiling of about 2.5 s; one rising glide of 1.66 semitones over 0.16 s; a dark tone (harmonic 3 at
//   -19.5 dB, harmonic 4 at -33 dB against the fundamental); its notes are held fifths stepping down C, B, A, G.
// - OURS, and why each number differs: the echo is LOCKED to the tempo (a dotted eighth, 0.75 beats), because THE
//   DJ's bar clock moves the tempo and a free-running echo would drift against it. The loop gain is 0.62 (4.2 dB a
//   repeat) so a phrase's tail has fallen about 40 dB by the next phrase, two bars later; the reference's 0.885 rings
//   for twenty seconds and would pile phrases into a wash. A 1.5 kHz Butterworth low-pass in the loop darkens each repeat
//   after the first, as a tape echo does. The room is small (RT60 0.9 s, wet 0.16). The tone is a little brighter than the reference
//   (harmonics at 0, -6, -13, -21, -28, -35 dB), each partial dying faster than the one below it, through a soft
//   drive and a 3.4 kHz cabinet low-pass. The slide rises one scale step (one or two semitones) over 0.15 s.
// - THE PHRASES are our own: single notes rising or turning around the key's fifth, each with one slide, never held
//   fifths and never a falling root line; tests/echoguitar.test.mjs checks that no phrase carries the reference's
//   root steps (-1, -2, -2) in its intervals.
// - THE TONE RULES: every partial is a sine (sines may go bare); the note's envelope ramps from 0 over 5 ms and lets
//   go over 0.15 s or more; the drive's output passes the cabinet low-pass. No per-sample JavaScript: a note is six
//   sines, a pick burst, a shaper and two filters, scheduled and told to stop.
// - ON DEMAND: nothing in the site's first load imports this file; echoguitar-lazy.js fetches it, and it is a phrase
//   voice for THE DJ's answer, not a playNote instrument (like the chop).
// - THE LEVEL: the dry voice peaks at 0.18 at velocity 1 (INST_PEAK in voice-fx.js). A phrase sums its notes, their
//   echoes and the room, which measured up to 0.35 peak, so playEchoPhrase passes the whole through a trim of 0.6;
//   every phrase at three roots then measures under the loudest existing instrument (the test renders them offline).
// </claudes_code_comments>

import { noiseBuffer } from './engine.js';
import { TONE } from './tone.js';
import { MODES, midiHz } from './tuning.js';

export const ECHO_GUITAR = Object.freeze({
  reference: Object.freeze({
    bpm: 119.94, echoSeconds: 0.3677, echoBeats: 0.735, dbPerRepeat: -1.0643, loopGain: 0.8847,
    roomCeilingSeconds: 2.5, slideSemitones: 1.6571, slideSeconds: 0.1625, harmonicsDb: Object.freeze([0, -3.8, -19.5, -33, -32.5, -40.5]),
    roots: Object.freeze(['C', 'B', 'A', 'G']), file: 'SETTLE/runs/echoguitar/analysis.json',
  }),
  echoBeats: 0.75,
  feedback: 0.62,
  loopTone: 1500,
  loopLow: 180,
  echoWet: 0.55,
  roomRt60: 0.9,
  roomWet: 0.16,
  partialsDb: Object.freeze([0, -6, -13, -21, -28, -35]),
  sustain: 1.1,
  attack: 0.005,
  release: 0.15,
  peak: 0.18,
  drive: 1.6,
  cabinet: 3400,
  slideTime: 0.15,
  phraseTrim: 0.6,
  register: 64,
});

// THE PHRASES: steps are scale degrees from the key's root (0 the root, 4 the fifth, 7 the octave), at and beats
// in beats from the phrase's start; slide: the note that slides up one scale step, and when (beats into it)
export const ECHO_PHRASES = Object.freeze([
  Object.freeze({ key: 'climb', notes: Object.freeze([[0, 0, 0.5], [0.5, 2, 0.5], [1, 4, 1.5, 0.5]]) }),
  Object.freeze({ key: 'turn', notes: Object.freeze([[0, 4, 0.5], [0.5, 5, 0.25], [0.75, 4, 0.25], [1, 2, 1.5, 0.25]]) }),
  Object.freeze({ key: 'call', notes: Object.freeze([[0, 2, 0.25], [0.25, 4, 0.25], [0.5, 7, 0.5], [1, 6, 1.5, 0.5]]) }),
]);

const finite = (x, d) => (Number.isFinite(x) ? x : d);
// a lowpass or highpass Q is in dB (the WebAudio spec): -3.0103 dB is a Q of 1/sqrt(2), the Butterworth response,
// flat with no peak. A filter inside a feedback loop must never peak, or the loop gain passes 1 near the cutoff and
// the repeats ring on (a Q of 0.5 dB peaks about +1.6 dB, which doubled the room's measured RT60).
const BUTTERWORTH_DB = -3.0103;
const shapers = new WeakMap();
function driveCurve(ctx, k) {
  let m = shapers.get(ctx);
  if (!m) { m = new Map(); shapers.set(ctx, m); }
  let c = m.get(k);
  if (c) return c;
  c = new Float32Array(1025);
  const n = Math.tanh(k);
  for (let i = 0; i < c.length; i++) { const x = (i / 512) - 1; c[i] = Math.tanh(k * x) / n; }
  m.set(k, c);
  return c;
}

// one plucked electric guitar note; slide: { to (Hz), at (s), time (s) } or null
export function guitarNote(ctx, out, f, t, dur = 0.5, vel = 0.8, slide = null) {
  const G = ECHO_GUITAR;
  const freq = finite(f, 0);
  if (!(freq > 20) || freq > 5000) return false;
  const v = Math.min(1, Math.max(0, finite(vel, 0.8)));
  const hold = Math.max(0.03, finite(dur, 0.5));
  const end = t + hold + G.release * 4;
  // the envelope: up from 0 over 5 ms, then held (the string's own decay is in the partials), let go over the release
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(G.peak * v, t + G.attack);
  env.gain.setValueAtTime(G.peak * v, t + hold);
  env.gain.setTargetAtTime(0, t + hold, G.release / 3);
  env.connect(out);
  const cab = ctx.createBiquadFilter();
  cab.type = 'lowpass';
  cab.frequency.value = Math.min(G.cabinet, Math.max(TONE.rawCeiling, freq * 12));
  cab.Q.value = 0.7;
  cab.connect(env);
  const shaper = ctx.createWaveShaper();
  shaper.curve = driveCurve(ctx, G.drive);
  shaper.connect(cab);
  const body = ctx.createGain();
  body.gain.value = 0.5;
  body.connect(shaper);
  const tau1 = Math.min(1.6, Math.max(0.5, G.sustain * (330 / freq) ** 0.3));
  const parts = G.partialsDb.map((db, i) => {
    const k = i + 1;
    if (freq * k > 9000) return null;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * k, t);
    if (slide && Number.isFinite(slide.to) && slide.to > 20) {
      const sa = Math.max(t + G.attack, finite(slide.at, t + hold / 2));
      o.frequency.setValueAtTime(freq * k, sa);
      o.frequency.exponentialRampToValueAtTime(slide.to * k, sa + Math.max(0.02, finite(slide.time, G.slideTime)));
    }
    const g = ctx.createGain();
    const a = 10 ** (db / 20);
    g.gain.setValueAtTime(a, t);
    g.gain.setTargetAtTime(0, t, tau1 / (1 + 0.7 * i));
    o.connect(g);
    g.connect(body);
    o.start(t);
    o.stop(end);
    return { o, g };
  }).filter(Boolean);
  // the pick: a short bright breath of noise at the attack
  const pick = ctx.createBufferSource();
  pick.buffer = noiseBuffer(ctx);
  const pb = ctx.createBiquadFilter();
  pb.type = 'bandpass';
  pb.frequency.value = Math.min(4000, freq * 6);
  pb.Q.value = 1.2;
  const pg = ctx.createGain();
  pg.gain.setValueAtTime(0, t);
  pg.gain.linearRampToValueAtTime(0.06 * v, t + 0.002);
  pg.gain.setTargetAtTime(0, t + 0.002, 0.006);
  pick.connect(pb);
  pb.connect(pg);
  pg.connect(env);
  pick.start(t);
  pick.stop(t + 0.05);
  parts[0].o.onended = () => { for (const n of [env, cab, shaper, body, pb, pg, ...parts.map((p) => p.g)]) try { n.disconnect(); } catch { /* gone */ } };
  return true;
}

// THE ECHO: in -> out (dry) and in -> delay -> wet -> out, the delay fed back through a low-pass (each repeat darker),
// a high-pass (no low rumble builds up) and the loop gain
export function createEcho(ctx, out, { beatDur = 0.5, beats = ECHO_GUITAR.echoBeats, feedback = ECHO_GUITAR.feedback, tone = ECHO_GUITAR.loopTone, wet = ECHO_GUITAR.echoWet } = {}) {
  const input = ctx.createGain();
  const delay = ctx.createDelay(2);
  const fb = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  const hp = ctx.createBiquadFilter();
  const wetG = ctx.createGain();
  lp.type = 'lowpass'; lp.frequency.value = tone; lp.Q.value = BUTTERWORTH_DB;
  hp.type = 'highpass'; hp.frequency.value = ECHO_GUITAR.loopLow; hp.Q.value = BUTTERWORTH_DB;
  fb.gain.value = Math.min(0.9, Math.max(0, finite(feedback, ECHO_GUITAR.feedback)));
  wetG.gain.value = Math.min(1, Math.max(0, finite(wet, ECHO_GUITAR.echoWet)));
  const seconds = (bd) => Math.min(1.9, Math.max(0.05, finite(bd, 0.5) * beats));
  delay.delayTime.value = seconds(beatDur);
  input.connect(out);
  input.connect(delay);
  delay.connect(lp); lp.connect(hp); hp.connect(fb); fb.connect(delay);
  delay.connect(wetG); wetG.connect(out);
  return {
    input,
    get seconds() { return delay.delayTime.value; },
    setBeat(bd, t = ctx.currentTime) { try { delay.delayTime.setValueAtTime(seconds(bd), t); } catch { delay.delayTime.value = seconds(bd); } },
    dispose(at = ctx.currentTime) {
      const id = setTimeout(() => { for (const n of [input, delay, fb, lp, hp, wetG]) try { n.disconnect(); } catch { /* gone */ } }, Math.max(0, (at - ctx.currentTime) * 1000) + 50);
      id?.unref?.();
    },
  };
}

// THE ROOM: four feedback combs (29.7, 37.1, 41.1, 43.7 ms, each damped by a low-pass, each comb's gain set for the
// RT60) summed, then two allpasses (5.6 and 3.4 ms, both above one 128-frame block, so a cycle is never clamped)
const COMBS = [0.0297, 0.0371, 0.0411, 0.0437];
const ALLPASS = [0.0056, 0.0034];
export function createRoom(ctx, out, { rt60 = ECHO_GUITAR.roomRt60, wet = ECHO_GUITAR.roomWet } = {}) {
  const input = ctx.createGain();
  const sum = ctx.createGain();
  sum.gain.value = 0.25;
  const nodes = [input, sum];
  input.connect(out); // the dry path
  const T = Math.max(0.2, finite(rt60, ECHO_GUITAR.roomRt60));
  for (const d of COMBS) {
    const dl = ctx.createDelay(0.1);
    dl.delayTime.value = d;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass'; damp.frequency.value = 4200; damp.Q.value = BUTTERWORTH_DB;
    const g = ctx.createGain();
    g.gain.value = 10 ** ((-3 * d) / T);
    input.connect(dl); dl.connect(damp); damp.connect(g); g.connect(dl);
    dl.connect(sum);
    nodes.push(dl, damp, g);
  }
  let x = sum;
  for (const d of ALLPASS) {
    // v = x + a v[-d]; y = -a v + v[-d]
    const a = 0.5;
    const v = ctx.createGain();
    const dl = ctx.createDelay(0.1);
    dl.delayTime.value = d;
    const back = ctx.createGain(); back.gain.value = a;
    const fwd = ctx.createGain(); fwd.gain.value = -a;
    const y = ctx.createGain();
    x.connect(v); v.connect(dl); dl.connect(back); back.connect(v);
    v.connect(fwd); fwd.connect(y); dl.connect(y);
    nodes.push(v, dl, back, fwd, y);
    x = y;
  }
  const wetG = ctx.createGain();
  wetG.gain.value = Math.min(1, Math.max(0, finite(wet, ECHO_GUITAR.roomWet)));
  x.connect(wetG); wetG.connect(out);
  nodes.push(wetG);
  return {
    input,
    dispose(at = ctx.currentTime) {
      const id = setTimeout(() => { for (const n of nodes) try { n.disconnect(); } catch { /* gone */ } }, Math.max(0, (at - ctx.currentTime) * 1000) + 50);
      id?.unref?.();
    },
  };
}

const stepMidi = (root, steps, s) => root + 12 * Math.floor(s / steps.length) + steps[((s % steps.length) + steps.length) % steps.length];

// the notes of one phrase, in the key: the root moved by whole octaves so the phrase sits near the guitar's register
export function phrasePlan({ root = 57, mode = 'ionian', phrase = ECHO_PHRASES[0], beatDur = 0.5, t0 = 0, register = ECHO_GUITAR.register } = {}) {
  const steps = (MODES[mode] ?? MODES.ionian).length === 7 ? MODES[mode] ?? MODES.ionian : MODES.ionian;
  let r = Math.round(finite(root, 57));
  const mid = (P) => P.notes.reduce((a, n) => a + stepMidi(r, steps, n[1]), 0) / P.notes.length;
  while (mid(phrase) > register + 6) r -= 12;
  while (mid(phrase) < register - 6) r += 12;
  const bd = Math.max(0.2, finite(beatDur, 0.5));
  return phrase.notes.map(([at, s, beats, slideAt]) => {
    const midi = stepMidi(r, steps, s);
    const n = { t: t0 + at * bd, dur: beats * bd * 0.95, midi };
    if (slideAt != null) { n.slideTo = stepMidi(r, steps, s + 1); n.slideAt = n.t + slideAt * bd; n.slideTime = ECHO_GUITAR.slideTime; }
    return n;
  });
}

export const phraseOf = (seed) => ECHO_PHRASES[((Math.floor(finite(seed, 0)) % ECHO_PHRASES.length) + ECHO_PHRASES.length) % ECHO_PHRASES.length];

// the whole sound: the phrase through the echo and the room; the nodes free themselves after the tail has fallen
export function playEchoPhrase(ctx, out, { t0 = ctx.currentTime + 0.05, beatDur = 0.5, root = 57, mode = 'ionian', seed = 0, phrase = null, vel = 1, tail = null } = {}) {
  const P = phrase ?? phraseOf(seed);
  // the trim: a phrase sums its notes, their echoes and the room, so the whole is held under the loudest instrument
  const trim = ctx.createGain();
  trim.gain.value = ECHO_GUITAR.phraseTrim;
  trim.connect(out);
  const room = createRoom(ctx, trim);
  const echo = createEcho(ctx, room.input, { beatDur });
  const notes = phrasePlan({ root, mode, phrase: P, beatDur, t0 });
  for (const n of notes) guitarNote(ctx, echo.input, midiHz(n.midi), n.t, n.dur, vel, n.slideTo != null ? { to: midiHz(n.slideTo), at: n.slideAt, time: n.slideTime } : null);
  const last = notes.reduce((a, n) => Math.max(a, n.t + n.dur), t0);
  // 40 dB of the loop's fall: repeats = 40 / (-20 log10 g)
  const repeats = 40 / (-20 * Math.log10(ECHO_GUITAR.feedback));
  const end = last + (tail ?? repeats * echo.seconds + ECHO_GUITAR.roomRt60);
  echo.dispose(end);
  room.dispose(end + 0.2);
  const id = setTimeout(() => { try { trim.disconnect(); } catch { /* gone */ } }, Math.max(0, (end + 0.3 - ctx.currentTime) * 1000));
  id?.unref?.();
  return { phrase: P.key, notes, end, echoSeconds: echo.seconds };
}
