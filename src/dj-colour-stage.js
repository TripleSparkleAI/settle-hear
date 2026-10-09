// settle-hear · dj-colour-stage - THE DJ's OVERDRIVE AND VOCODER, the audio (lane DJOVERDRIVE, 2026-10-08): the valve
// stage THE DJ'S DESK runs on its bus in the OVERDRIVE mood and on single voices, and the vocoder of our own synthesis it
// puts on a voice for a set. Loaded on demand (dj-colour.js loadColour), so the site's first load does not carry it.
//
// <claudes_code_comments>
// ** Function List **
// TUBE                       - the valve curve's numbers: the knee of each half, the curve's span and its points
// tube(u)                    - the valve curve: an asymmetric soft clip, tanh(k u) / k with a harder knee on the top
//                              half than on the bottom; slope 1 at 0, |tube(u)| <= |u|, sign kept
// shaperCurve(fn, span, n)   - a WaveShaper curve holding fn over -span .. span (the shaper's input is pre-scaled by
//                              1 / span, so the curve covers a voice pushed up to `span`)
// tubeCurve() / identityCurve() - the valve curve and a straight line, both over TUBE.span
// OVERSAMPLE                 - '4x': the valve shaper and its dry twin are oversampled together
// handover(ctx, direct, out, t) - the 30 ms crossfade from a direct path to a newly built tube (their gains sum to 1)
// createTube(ctx, opts)      - the overdrive section: input -> a dry leg (an identity shaper, the same oversampling,
//                              so both legs carry the same latency) and a wet leg (pre gain, the valve curve, a 5 Hz
//                              DC block, a soft tone low-pass, post gain amount / gain) -> output; .set(amount, gain,
//                              t, tau); .dispose()
// VOICE_VOCODER              - the vocoder's numbers: its bands, their Q, the envelope's corner, the carrier mix, the
//                              warble's rate and depth, the makeup (measured offline, see below)
// createVoiceVocoder(ctx)    - the vocoder (vocoder.js createVocoder's band bank): the voice (modulator) is split into bands, each band rectified and
//                              smoothed into an envelope that opens the same band of the carrier; the carrier is our
//                              own synthesis (the voice squared and a sawtooth chord on the set's root) through a
//                              warble delay; .set({ warble, rate, depth, rootHz }, t, tau); .dispose()
// createColourStage(ctx, out) - one voice's colour: input -> [the tube] -> [the vocoder crossfade] -> out; each built
//                              the first time it is asked for; .set({ drive, vocoder }, t, tau); .state; .dispose()
//
// ** Technical Review **
// - THE NAVIGATOR (2026-10-08): "I'm loving the overdrive energy of just turning the volume up in the headphones. So
//   THE DJ gets about a 20% chance of OVERDRIVE MODE ... and put it a bit on some effects too, at random, and
//   especially on the tunes we play, the melodies, and sometimes on the McKusker flute too. Overdrive, harmonic. And
//   add a vocoder sometimes: a vocoder warble on some, and just on for some. You decide."
// - THE VALVE: a valve stage clips its two half-waves differently, so its output carries even harmonics (the second,
//   the octave: warmth) as well as the odd ones a symmetric clip makes. tube() gives the top half a knee at 1 / 1.7
//   and the bottom half a knee at 1 / 0.85, so a pushed voice rounds its top early and its bottom late. Both halves
//   are tanh(k u) / k: slope 1 at 0 (a quiet voice passes unchanged) and |tube(u)| <= |u| everywhere.
// - NEVER LOUDER THAN THE DRY PATH, by construction: the wet leg is tube(g x) / g, so at every sample its size is at
//   or under the dry signal's and its sign is the same; the stage's output is (1 - a) x + a tube(g x) / g, a blend of
//   two numbers each at or under |x| with x's sign, so it is at or under |x| too. The two filters on the wet leg can
//   overshoot a little (the tone low-pass has Q 0.5, critically damped, so it does not; the 18 Hz DC block can by a
//   hair), so the level is also measured offline: tests/djoverdrive.test.mjs renders every melodic instrument dry and
//   overdriven with tests/offline.mjs, and tools/djoverdrive_levels.py renders the bus and the voices in Chromium.
//   The overdrive buys loudness in CHARACTER (harmonics, a denser sound), never in level.
// - OVERSAMPLED: a curve's new harmonics above Nyquist fold back as aliasing unless the shaper oversamples. The valve
//   shaper oversamples 4x; that adds a few samples of latency, so the dry leg runs through an identity shaper with
//   the same oversampling: the two legs stay aligned and their blend never combs. The section is built the first time
//   it is asked for, crossfaded in over 30 ms from a direct path, so a page that never overdrives builds no shaper.
// - THE VOCODER (our own synthesis, no sample): VOCODER.bands log-spaced bands from 180 Hz to 5,600 Hz. Each band of
//   the voice is band-passed (Q 4), rectified (|x|) and smoothed by two 30 Hz low-passes into an envelope that drives
//   a gain on the same band of the carrier. The carrier is the voice itself squared (pushed hard into a tanh, so it
//   keeps the voice's pitch with every odd harmonic) and a sawtooth chord on the set's root (root, fifth, octave).
//   With no voice every envelope is zero, so the vocoder is silent whatever the carrier does. Its output scales with
//   the voice (the squared voice is a constant level, the envelope follows the voice), so one makeup holds at every
//   velocity; VOCODER.makeup is the measured one (see the README, 'THE DJ's OVERDRIVE AND VOCODER').
// - THE WARBLE: on a warbling set one slow sine (0.35 to 0.6 Hz) swings the carrier's delay (a pitch sway of about
//   15 to 25 cents) and the saws' detune together; on a steady set it rests at zero.
// - MUTE ALL AND THE PAUSE: every stage plays into the engine's master, mute and limiter like every voice, and the
//   engine suspends the context while nothing may be heard, so the vocoder's oscillators stop with it. A vocoder
//   turned off fades out and is freed a second later.
// - The binaural pair plays on its own dry channel and never meets a colour stage or the desk's bus.
// </claudes_code_comments>

import { createVocoder } from './vocoder.js';

const c01 = (x, d = 0) => (Number.isFinite(+x) ? Math.min(1, Math.max(0, +x)) : d);
const setAt = (p, v, t) => { try { p.cancelScheduledValues?.(t); p.setValueAtTime(v, t); } catch { p.value = v; } };
const glide = (p, v, t, tau) => {
  if (!p || !Number.isFinite(v)) return;
  try { p.cancelScheduledValues?.(t); p.setTargetAtTime(v, t, Math.max(0.001, tau)); } catch { p.value = v; }
};

// THE TUBE's numbers, measured offline (tests/offline.mjs, every melodic instrument, loud and soft):
// dcHz: the DC block after the asymmetric curve sits at 5 Hz. At 18 Hz its phase shift lifted the soft keys' peak to
//   1.045 of the dry level (the curve's DC removed, the waveform re-centred); at 5 Hz the worst case is 0.971.
// minGain: the stage never pushes a voice more gently than this, so the valve does work and the wet leg's filters
//   cannot lift a nearly linear signal over its dry level (measured: +2% at a push of 1)
// margin: the wet leg comes back at margin / g, a 3% allowance for the filters' overshoot on a sharp attack
// n: an odd count, so the curve has a point at exactly 0 and silence passes as silence
export const TUBE = Object.freeze({ kTop: 1.7, kBottom: 0.85, span: 4, n: 4097, dcHz: 5, toneHz: 9000, buildFade: 0.03, minGain: 2.5, margin: 0.97 });

export function tube(u) {
  const x = Number(u);
  if (!Number.isFinite(x) || x === 0) return 0;
  const k = x > 0 ? TUBE.kTop : TUBE.kBottom;
  return Math.tanh(k * x) / k;
}

export function shaperCurve(fn, span = TUBE.span, n = TUBE.n) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = fn(((i / (n - 1)) * 2 - 1) * span);
  return c;
}
export const tubeCurve = () => shaperCurve(tube);
export const identityCurve = () => shaperCurve((x) => x);
export const OVERSAMPLE = '4x';

// THE HANDOVER: a direct path ramps 1 -> 0 while the tube's output ramps 0 -> 1 over TUBE.buildFade; their sum stays
// at unity through the ramp, since the two gains add to 1 at every instant
export function handover(ctx, directGain, tubeOutGain, t = ctx.currentTime) {
  for (const [p, from, to] of [[directGain, 1, 0], [tubeOutGain, 0, 1]]) {
    p.value = from;
    try { p.cancelScheduledValues?.(t); p.setValueAtTime(from, t); p.linearRampToValueAtTime(to, t + TUBE.buildFade); } catch { p.value = to; }
  }
}

// THE TUBE: (1 - a) x through the aligned dry leg plus a tube(g x) / g through the valve, a and g ramped together
export function createTube(ctx, { toneHz = TUBE.toneHz, oversample = OVERSAMPLE } = {}) {
  const gain = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const nodes = [];
  const keep = (n) => { nodes.push(n); return n; };
  const input = keep(gain(1));
  const output = keep(gain(1));
  // the dry leg: an identity shaper with the valve's oversampling, so both legs carry the same latency
  const dryPre = keep(gain(1 / TUBE.span));
  const twin = keep(ctx.createWaveShaper());
  twin.curve = identityCurve();
  twin.oversample = oversample;
  const dry = keep(gain(1));
  input.connect(dryPre);
  dryPre.connect(twin);
  twin.connect(dry);
  dry.connect(output);
  // the wet leg: the valve, its DC taken out, its top softened, brought back by 1 / g
  const pre = keep(gain(1 / TUBE.span));
  const valve = keep(ctx.createWaveShaper());
  valve.curve = tubeCurve();
  valve.oversample = oversample;
  const dc = keep(ctx.createBiquadFilter());
  dc.type = 'highpass';
  dc.frequency.value = TUBE.dcHz;
  dc.Q.value = 0.5;
  const tone = keep(ctx.createBiquadFilter());
  tone.type = 'lowpass';
  tone.frequency.value = toneHz;
  tone.Q.value = 0.5; // critically damped: no overshoot
  const wet = keep(gain(0));
  input.connect(pre);
  pre.connect(valve);
  valve.connect(dc);
  dc.connect(tone);
  tone.connect(wet);
  wet.connect(output);
  let amount = 0;
  let drive = 1;
  return {
    input,
    output,
    nodes: { dryPre, twin, dry, pre, valve, dc, tone, wet },
    get amount() { return amount; },
    get drive() { return drive; },
    set(a, g, t = ctx.currentTime, tau = 0.35) {
      amount = c01(a);
      drive = Math.min(8, Math.max(TUBE.minGain, Number.isFinite(+g) ? +g : TUBE.minGain));
      glide(dry.gain, 1 - amount, t, tau);
      glide(pre.gain, drive / TUBE.span, t, tau);
      glide(wet.gain, (amount * TUBE.margin) / drive, t, tau);
    },
    dispose() { for (const n of nodes) { try { n.disconnect(); } catch { /* gone */ } } },
  };
}

// THE VOICE VOCODER's numbers: the carrier's mix, the warble's rate and depth, and the makeup after the shared band
// bank (vocoder.js createVocoder, 12 bands, 140 Hz to 5.6 kHz), measured offline over every melodic instrument
// (tests/djoverdrive.test.mjs and tools/djoverdrive_levels.py) so a fully vocoded voice lands under its dry level
export const VOICE_VOCODER = Object.freeze({
  squareDrive: 30, squareMix: 0.4, sawMix: 0.6, sawLevel: 0.12, makeup: 0.5, baseDelay: 0.012,
  warbleRate: [0.35, 0.6], warbleDepth: [0.0045, 0.007], warbleCents: 25, fade: 0.6, amount: 0.7,
});

// THE VOICE VOCODER: the shared band bank (vocoder.js) with our own carrier: the voice squared and a sawtooth chord on
// the set's root, through a delay a slow sine can swing (the warble)
export function createVoiceVocoder(ctx) {
  const gain = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const nodes = [];
  const oscs = [];
  const keep = (n) => { nodes.push(n); return n; };
  const bank = createVocoder(ctx);
  const input = keep(gain(1));
  const output = keep(gain(VOICE_VOCODER.makeup));
  input.connect(bank.modulator);
  bank.output.connect(output);
  // THE CARRIER: the voice squared and a sawtooth chord, through the warble delay
  const carrier = keep(gain(1));
  const squarePre = keep(gain(VOICE_VOCODER.squareDrive));
  const square = keep(ctx.createWaveShaper());
  square.curve = shaperCurve((x) => Math.tanh(4 * x), 1, 1025);
  square.oversample = '2x';
  const squareMix = keep(gain(VOICE_VOCODER.squareMix));
  input.connect(squarePre);
  squarePre.connect(square);
  square.connect(squareMix);
  squareMix.connect(carrier);
  const sawMix = keep(gain(VOICE_VOCODER.sawMix));
  sawMix.connect(carrier);
  const saws = [1, 1.5, 2].map((k) => {
    const o = keep(ctx.createOscillator());
    o.type = 'sawtooth';
    o.frequency.value = 220 * k;
    const g = keep(gain(VOICE_VOCODER.sawLevel));
    o.connect(g);
    g.connect(sawMix);
    oscs.push(o);
    return { o, k };
  });
  const sway = keep(ctx.createDelay(0.05));
  sway.delayTime.value = VOICE_VOCODER.baseDelay;
  carrier.connect(sway);
  sway.connect(bank.carrier);
  // THE WARBLE: one slow sine into the delay time and the saws' detune, at zero on a steady set
  const lfo = keep(ctx.createOscillator());
  lfo.type = 'sine';
  lfo.frequency.value = VOICE_VOCODER.warbleRate[0];
  oscs.push(lfo);
  const lfoDelay = keep(gain(0));
  const lfoCents = keep(gain(0));
  lfo.connect(lfoDelay);
  lfo.connect(lfoCents);
  lfoDelay.connect(sway.delayTime);
  for (const s of saws) lfoCents.connect(s.o.detune);
  for (const o of oscs) { try { o.start(); } catch { /* started */ } }
  let warble = false;
  return {
    input,
    output,
    bank,
    bands: bank.bands,
    saws: saws.map((s) => s.o),
    lfo,
    lfoDelay,
    get warble() { return warble; },
    // { warble: bool, rate Hz, depth s, rootHz }: the warble swings the carrier, the chord follows the set's root
    set({ warble: w = false, rate = VOICE_VOCODER.warbleRate[0], depth = VOICE_VOCODER.warbleDepth[0], rootHz = 220 } = {}, t = ctx.currentTime, tau = 0.5) {
      warble = !!w;
      const hz = Number.isFinite(+rootHz) && +rootHz > 40 ? +rootHz : 220;
      for (const s of saws) glide(s.o.frequency, hz * s.k, t, tau);
      setAt(lfo.frequency, Math.min(VOICE_VOCODER.warbleRate[1], Math.max(VOICE_VOCODER.warbleRate[0], +rate || VOICE_VOCODER.warbleRate[0])), t);
      const d = Math.min(VOICE_VOCODER.warbleDepth[1], Math.max(VOICE_VOCODER.warbleDepth[0], +depth || VOICE_VOCODER.warbleDepth[0]));
      glide(lfoDelay.gain, warble ? d : 0, t, tau);
      glide(lfoCents.gain, warble ? VOICE_VOCODER.warbleCents : 0, t, tau);
    },
    dispose() {
      for (const o of oscs) { try { o.stop(); } catch { /* stopped */ } }
      for (const n of nodes) { try { n.disconnect(); } catch { /* gone */ } }
      bank.dispose();
    },
  };
}

// ONE VOICE'S COLOUR: input -> (direct, or the tube once built) -> mid -> dry and (the vocoder, once built) -> out
export function createColourStage(ctx, out) {
  const gain = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const input = gain(1);
  const direct = gain(1);
  const mid = gain(1);
  const vDry = gain(1);
  const vWet = gain(0);
  const output = gain(1);
  input.connect(direct);
  direct.connect(mid);
  mid.connect(vDry);
  vDry.connect(output);
  vWet.connect(output);
  if (out) output.connect(out);
  let tubeSec = null;
  let voc = null;
  let vocTimer = null;
  let state = { drive: null, vocoder: null };
  let dead = false;
  function buildTube(t) {
    if (tubeSec) return tubeSec;
    tubeSec = createTube(ctx);
    input.connect(tubeSec.input);
    tubeSec.output.connect(mid);
    // the direct path hands over to the tube over 30 ms, so the latency step never clicks; the handover rides the
    // tube's output gain, which set() never touches, so a blend set in the same instant cannot cut it short
    handover(ctx, direct.gain, tubeSec.output.gain, t);
    return tubeSec;
  }
  function buildVocoder() {
    if (voc) return voc;
    voc = createVoiceVocoder(ctx);
    mid.connect(voc.input);
    voc.output.connect(vWet);
    return voc;
  }
  function freeVocoder() {
    if (!voc) return;
    const v = voc;
    voc = null;
    try { mid.disconnect(v.input); } catch { /* gone */ }
    v.dispose();
  }
  return {
    input,
    output,
    get tube() { return tubeSec; },
    get vocoder() { return voc; },
    get state() { return { drive: state.drive ? { ...state.drive } : null, vocoder: state.vocoder ? { ...state.vocoder } : null }; },
    // { drive: { amount, gain } | null, vocoder: { amount, warble, rate, depth, rootHz } | null }
    set(plan = {}, t = ctx.currentTime, tau = 0.35) {
      if (dead) return state;
      const drive = plan?.drive && c01(plan.drive.amount) > 0 ? { amount: c01(plan.drive.amount), gain: Math.min(8, Math.max(TUBE.minGain, +plan.drive.gain || 3)) } : null;
      const vocoder = plan?.vocoder && c01(plan.vocoder.amount ?? VOICE_VOCODER.amount) > 0 ? { amount: c01(plan.vocoder.amount ?? VOICE_VOCODER.amount), warble: !!plan.vocoder.warble, rate: +plan.vocoder.rate || VOICE_VOCODER.warbleRate[0], depth: +plan.vocoder.depth || VOICE_VOCODER.warbleDepth[0], rootHz: +plan.vocoder.rootHz || 220 } : null;
      if (drive) buildTube(t).set(drive.amount, drive.gain, t, tau);
      else tubeSec?.set(0, 1, t, tau);
      if (vocoder) {
        if (vocTimer) { clearTimeout(vocTimer); vocTimer = null; }
        buildVocoder().set(vocoder, t, tau);
        glide(vWet.gain, vocoder.amount, t, tau);
        glide(vDry.gain, 1 - vocoder.amount, t, tau);
      } else if (voc) {
        glide(vWet.gain, 0, t, tau);
        glide(vDry.gain, 1, t, tau);
        // the vocoder fades out, then its oscillators are freed
        if (!vocTimer) { vocTimer = setTimeout(() => { vocTimer = null; if (!state.vocoder) freeVocoder(); }, Math.ceil((t - ctx.currentTime + 5 * tau + VOICE_VOCODER.fade) * 1000) + 400); vocTimer?.unref?.(); }
      }
      state = { drive, vocoder };
      return state;
    },
    dispose() {
      if (dead) return;
      dead = true;
      if (vocTimer) { clearTimeout(vocTimer); vocTimer = null; }
      freeVocoder();
      tubeSec?.dispose();
      for (const n of [input, direct, mid, vDry, vWet, output]) { try { n.disconnect(); } catch { /* gone */ } }
    },
  };
}
