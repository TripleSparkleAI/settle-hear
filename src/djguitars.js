// settle-hear · djguitars - THE PSYCH GUITARS (lane DJGUITARS, 2026-10-08): two electric guitars of our own for THE DJ,
// fuzzed, squashed, phased or flanged, chorused and washed in a tape-style echo: THE FUZZ LEAD, which answers with its
// own bent phrases, and THE PHASE GUITAR, which plays the set's chord as arpeggios, strums or swells.
//
// <claudes_code_comments>
// ** Function List **
// PSYCH_GUITARS             - every number the two voices use, and beside them the reference clip's measured numbers
// LEAD_PHRASES              - four original lead phrases (scale steps, beats, one bend each), dealt by a set's deck
// RHYTHM_PATTERNS           - three original rhythm parts (arpeggio, strum, swell), dealt by a set's deck
// MOD_KINDS                 - the rhythm guitar's two modulations (the phaser or the flanger), dealt by a set's deck
// fuzzCurve(ctx, k, bias)   - an asymmetric soft clip, cached per context: odd and even harmonics, a fuzz
// createSquash(ctx, out, { thresholdDb, ratio, makeup }) - a compressor made of nodes (a rectifier, a low-pass
//                             and a gain curve into a gain's AudioParam): { input, nodes }
// createFuzz(ctx, out, { gain, bias, tight, scoopHz, scoopDb, tone }) - the fuzz: input high-pass, the clip, a mid scoop
//                             (a peaking cut), a tone low-pass and the cabinet (high-pass, presence, two low-passes):
//                             { input, nodes }
// createPhaser(ctx, out, { centre, cents, rate, mix }) - a four-stage phaser (two all-pass biquads at Q 0.5), a
//                             triangle LFO on detune (a log sweep), the right side swept the opposite way: { input, nodes, lfos }
// createFlanger(ctx, out, { base, depth, rate, mix }) - a feed-forward flanger (no loop, so no 2.67 ms floor):
//                             { input, nodes, lfos }
// createChorus(ctx, out, { delay, depth, rate, wet }) - a two-sided chorus, one swept delay each side: { input, nodes, lfos }
// createTapeEcho(ctx, out, { beatDur, beats, feedback, tone, wow, wowRate, wet }) - a tempo-locked echo whose loop
//                             darkens, saturates and wobbles: { input, nodes, lfos, seconds, setBeat(beatDur, t) }
// createPsychRig(ctx, out, { voice, beatDur, mod }) - one voice's whole pedalboard, built once a set and kept for its
//                             bars: { input, voice, mod, setBeat(beatDur, t), dispose(at), echoSeconds }
// psychNote(ctx, out, f, t, dur, vel, opts) - one picked note of our own: two detuned sawtooths through a closing pick
//                             filter, an envelope (picked, palm-muted or swelled), an optional bend and finger vibrato
// leadPlan({ root, mode, phrase, beatDur, t0, register }) - the lead phrase's notes in the key: [{ t, dur, midi, bendTo, bendAt }]
// rhythmPlan({ chord, pattern, beatDur, t0, register, swing }) - the rhythm bar's notes: [{ t, dur, midi, kind }]
// playLeadPhrase(ctx, rig, opts) - one lead phrase into a rig: { phrase, notes, end }
// playRhythmBar(ctx, rig, opts) - one bar of the rhythm guitar into a rig: { pattern, notes }
// auditionLead(ctx, out, opts) / auditionRhythm(ctx, out, opts) - a whole sound with its own rig, freed after its tail
//                             (the HEAR page and the tests use these)
// createSetGuitars(ctx, { seed }) - THE DJ's guitars for one mix set (mix-layers.js holds only the glue), the echo
//                             guitar's phrase deck among them (moved here from mix-layers.js by lane DJGUITARS): three decks
//                             (the lead's phrases, the rhythm's parts, the rhythm's modulation), one card each a set, and
//                             each guitar's board built once a set: { answer(slotIn, d, t0, beatDur, vel), arps(slotIn, d,
//                             t0, beatDur, vel, swing), bar(into, d, t0, beatDur, y, ansInst, arpInst, ansVel, arpVel,
//                             swing) (THE DJ's one call a bar), state, dispose(at) }
//
// ** Technical Review **
// - THE REFERENCE (SETTLE/runs/djguitars/analysis.json, measured from a live recording kept outside this repository
//   and never shipped) is THE ARPEGGIO, 30:51.6 to 31:08.0, and its guitar-alone opening: a mono guitar panned left
//   (+4.9 dB, L/R correlation 0.92), dark and mid-heavy (centroid 538 Hz, 95% under 1,335 Hz, -9.2 dB an octave from
//   1 to 6 kHz), its drive heard as sustain (a note loses 2.4 dB in 250 ms), in steady eighths at a beat of 0.479 s
//   (125.2 bpm); the band's guitars 7.5 dB under the kick and not ducked by it; the previous song's last echo 0.2095 s
//   apart, falling 1.66 dB a repeat. ⚠ A first reading took the 30:07 to 30:37 stretch for a guitar wash; THE GUITAR
//   STUDY's separation found it to be speech and tuning, and nothing here is taken from it.
// - THE PEDALS ARE OURS, built from the published measurements in SETTLE/runs/guitarstudy/04_modulation.md and the
//   wiki wikis/WIKI_PSYCH_GUITAR_TONE/ (07-OUR-VOICES.md names the source of every number):
//   THE AMP (THE GUITAR STUDY 03 and 09): the clip with its gain inside the curve and a bias that moves the duty cycle
//   (the fuzz lead: gain 20, bias 0.3; the phase guitar: a symmetric crunch at gain 10), oversampled 4x, a 25 Hz DC
//   block, the '59 Bassman tone stack as three biquads (its mid at -4 dB, past noon, tuned by measurement), and the
//   cabinet: a 150 Hz high-pass and two low-passes at CABINET_CORNER_HZ. THE SQUASH follows the clip.
//   THE PHASER is the Small Stone's shape: four first-order all-pass stages (exactly two biquad all-passes at Q 0.5),
//   two notches 0.414 and 2.414 times the stage frequency, a triangle LFO on detune (a log sweep), centre 682 Hz,
//   +-1800 cents, so the lower notch runs 100 to 800 Hz as the measured pedal's does; the rate 0.15 Hz is a published
//   model's default, not a measured pedal (no source gives one). THE FLANGER is feed-forward (a delay in a loop is
//   held to at least 128 frames, 2.67 ms at 48 kHz, so a feedback flanger cannot sweep under that): 0.7 to 4.3 ms,
//   triangle, 0.12 Hz. THE CHORUS is a CE-2 shape: 9.6 ms +-1.1 ms, triangle, 0.8 Hz (inside the measured 0.3 to
//   3.5 Hz), one side swept against the other (the phase guitar's sides kept narrow, about the reference's width).
//   No phaser or flanger was detected in the clip (a bound, THE GUITAR STUDY 02); the modulation is the navigator's
//   ask for the style, slow and optional, never claimed as measured. THE SQUASH is a compressor of nodes (no DynamicsCompressorNode, so
//   the offline renderer can measure it): a rectifier, a 40 Hz low-pass and a gain curve, threshold -24 dB,
//   ratio 4 for the lead. THE ECHO is tempo-locked (THE DJ's bar clock moves the tempo), a dotted eighth for the lead,
//   its loop darkened by a 2.2 kHz Butterworth low-pass, saturated by a soft clip and wobbled by a 0.6 Hz sine on its
//   delay time. THE ROOM is THE ECHO GUITAR's room (echoguitar.js createRoom), sized under the reference's ceiling.
// - THE ORDER (the navigator's: fuzz and drive into phasing and flanging): fuzz, cabinet, squash, phaser or flanger,
//   chorus, echo, room, pan. Several sources put this artist's phaser before his drive; the wiki records both.
// - THE STRING: two sawtooths 3 cents apart (a slower beat than 7 cents, which moved a held note's level by 5 dB a
//   second) pass a pick filter that opens at 2400 Hz, the tone rules' raw ceiling, and closes part way, before
//   anything else hears them. The drive then makes the top end. A note's envelope ramps from 0 over 4 ms (a swell
//   over 0.17 s) and lets go over at least 0.12 s. THE GUITAR STUDY 09 recommends a Karplus-Strong string computed
//   into a buffer; that is owed, and this string meets the measured tone and sustain targets without it.
// - THE PARTS are our own: lead phrases of single notes around the key's fifth and seventh, each with one bend up to
//   the next scale step and a finger vibrato on its held note; rhythm bars as eighth-note arpeggios, syncopated strums
//   with palm-muted ghosts, or one swelled power chord; the arpeggio rings and takes the chord root's 4th (else its
//   2nd or 6th) where the key holds it, as the reference's part does. No part is taken from the reference: its melody was never written
//   down, and tests/djguitars.test.mjs checks every part stays in the set's key.
// - THE LEVEL: each rig ends in a trim measured offline so a phrase or a bar, effects included, stays under the loudest
//   existing instrument (tests/djguitars.test.mjs renders them).
// - ON DEMAND: nothing in the site's first load imports this file; echoguitar-lazy.js fetches it, for this file and for
//   the echo guitar it re-exports (one chunk, one loader).
// </claudes_code_comments>

import { createRoom, ECHO_PHRASES, playEchoPhrase } from './echoguitar.js';
// the echo guitar rides in this module's chunk (echoguitar-lazy.js loads this file for both)
export * from './echoguitar.js';
import { createBag } from './deck.js';
import { MODES, midiHz } from './tuning.js';
import { TONE } from './tone.js';

// THE CABINET'S CORNER, one constant (THE GUITAR STUDY's ruling for the navigator, SETTLE/runs/guitarstudy/
// 00_SYNTHESIS.md): A keeps every driven voice at TONE.rawCeiling (2.4 kHz); B lets a voice that ends in a cabinet sit
// at 3.5 kHz, where the reference measured against itself stays inside its own floor (3.38 dB against 2.02 to 5.14;
// 2.4 kHz gives 5.69). The navigator has not ruled, so the coordinator holds A: TONE.rawCeiling, and B is this one line.
export const CABINET_CORNER_HZ = TONE.rawCeiling;

// THE REFERENCE, from SETTLE/runs/djguitars/analysis.json: THE ARPEGGIO (30:51.6 to 31:08.0) and its guitar-alone
// opening (30:51.7 to 30:59.8), the band after it, and the previous song's last echo. Nothing comes from 30:07 to
// 30:37, which THE GUITAR STUDY found to be speech and tuning (see analysis.json's correction)
const REF = Object.freeze({
  file: 'SETTLE/runs/djguitars/analysis.json',
  arpeggioBpm: 125.2, eighthSeconds: 0.2486, beatCorr: 0.184,
  centroidHz: 538, rolloff85Hz: 880, rolloff95Hz: 1335, slopeDbPerOctave: -9.2, band4to8kDb: -26,
  leftMinusRightDb: 4.9, corr: 0.92, sustainDropDb: 2.4, registerMidi: 65,
  echoSeconds: 0.2095, echoDbPerRepeat: -1.66,
  guitarUnderKickDb: -7.5, pumpDb: -0.7,
  tonalCentre: 'G',
});

export const PSYCH_GUITARS = Object.freeze({
  reference: REF,
  // THE FUZZ LEAD: heavy two-sided fuzz, single notes and bends, no thirds under the fuzz (THE GUITAR STUDY 03, 06)
  lead: Object.freeze({
    register: 74, peak: 0.22, pan: 0,
    squash: Object.freeze({ thresholdDb: -24, ratio: 4, makeup: 2 }),
    fuzz: Object.freeze({ gain: 20, bias: 0.3, tight: 150 }),
    phaser: Object.freeze({ centre: 682, cents: 1800, rate: 0.15, mix: 0.5, spread: 0.6 }),
    echo: Object.freeze({ beats: 0.75, feedback: 0.42, tone: 2200, wow: 0.0007, wowRate: 0.6, wet: 0.38 }),
    room: Object.freeze({ rt60: 0.7, wet: 0.15 }),
    bendTime: 0.12, vibratoHz: 5.5, vibratoCents: 22,
    trim: 0.3,
  }),
  // THE PHASE GUITAR: the reference's own kind of part, a crunch (a gentle symmetric drive for sustain, not fizz),
  // one mono voice panned left about 0.35 as the reference's guitar is (+4.9 dB left), its modulation kept narrow
  rhythm: Object.freeze({
    register: 62, peak: 0.23, pan: -0.35,
    squash: Object.freeze({ thresholdDb: -28, ratio: 4, makeup: 2 }),
    fuzz: Object.freeze({ gain: 10, bias: 0, tight: 120 }),
    phaser: Object.freeze({ centre: 682, cents: 1800, rate: 0.2, mix: 0.5, spread: 0.25 }),
    flanger: Object.freeze({ base: 0.0025, depth: 0.0018, rate: 0.12, mix: 0.5, spread: 0.25 }),
    chorus: Object.freeze({ delay: 0.0096, depth: 0.0011, rate: 0.8, wet: 0.3, spread: 0.3 }),
    echo: Object.freeze({ beats: 0.5, feedback: 0.25, tone: 2200, wow: 0.0005, wowRate: 0.5, wet: 0.16 }),
    room: Object.freeze({ rt60: 0.7, wet: 0.15 }),
    strumMs: 11, swell: 0.17, mute: 0.07, ring: 1,
    trim: 0.115,
  }),
  // THE TONE STACK: the '59 Bassman curve at noon as biquads (THE GUITAR STUDY 09 section 7, fitted within 0.41 dB)
  // ⚠ its mid cut is -4 dB, not the noon fit's -9.3: at -9.3 our crunch measured 500 Hz to 1 kHz 9 dB under its peak
  // band against the reference's 3.7, so the tone stack's mid knob sits past noon (ours, tuned by the measurement)
  toneStack: Object.freeze({ gainDb: -3.2, lowHz: 159, lowDb: 1.8, midHz: 734, midQ: 0.41, midDb: -4, highHz: 2767, highDb: -1.1 }),
  // THE CABINET: a high-pass at 150 Hz and two low-passes at the corner (the reference: -10 dB at 150 to 170 Hz,
  // steep above 4 kHz)
  cabinet: Object.freeze({ low: 150, high: CABINET_CORNER_HZ, dcBlock: 25 }),
  // OURS, MEASURED OFFLINE (SETTLE/runs/djguitars/ours.json, the statistics analyse.mjs takes from the clip; every
  // phrase and part at A aeolian, 120 bpm, averaged); tests/djguitars.test.mjs re-renders and holds them, so the HEAR
  // page's table cannot drift from the voices
  ours: Object.freeze({
    lead: Object.freeze({ centroidHz: 867, rolloff95Hz: 1745, slopeDbPerOctave: -10.7, corr: 0.71, peak: 0.2044, rms50: 0.0626, leftMinusRightDb: 0.3, sustainDropDb: 0.5 }),
    rhythm: Object.freeze({ centroidHz: 540, rolloff95Hz: 1506, slopeDbPerOctave: -16.6, corr: 0.97, peak: 0.167, rms50: 0.0417, leftMinusRightDb: 4.8, sustainDropDb: 0.7 }),
  }),
  pick: Object.freeze({ open: 2400, close: 1.2, detuneCents: 3, attack: 0.004, release: 0.12 }),
});

// THE LEAD PHRASES: [at, step, beats, bendAt]: at and beats in beats from the phrase's start, step a scale degree from
// the key's root (4 the fifth, 6 the seventh, 7 the octave), bendAt the beats into the note where it bends up one step;
// swell: the phrase's first note swells in
export const LEAD_PHRASES = Object.freeze([
  Object.freeze({ key: 'cry', notes: Object.freeze([[0, 4, 0.5], [0.5, 6, 0.5], [1, 7, 0.25], [1.25, 6, 1.25, 0.25]]) }),
  Object.freeze({ key: 'stab', notes: Object.freeze([[0, 7, 0.25], [0.25, 7, 0.25], [0.5, 6, 0.5], [1, 3, 1.5, 0.25]]) }),
  Object.freeze({ key: 'fall', notes: Object.freeze([[0, 9, 0.5], [0.5, 7, 0.5], [1, 6, 0.25], [1.25, 4, 1.25, 0.5]]) }),
  Object.freeze({ key: 'swell', swell: true, notes: Object.freeze([[0, 2, 0.5], [0.5, 3, 2, 1]]) }),
]);

// THE RHYTHM PARTS: each event [at, beats, which, kind]: which picks chord tones by index (0 root, 1 third, 2 fifth,
// 3 the root an octave up, 4 the third an octave up, 5 the fifth an octave up, 6 THE COLOUR: the chord root's 4th,
// else its 2nd, else its 6th, the first the key holds, else the third), kind 'pick' (one note), 'strum' (all of which,
// a down-strum), 'up' (an up-strum), 'mute' (a palm-muted ghost) or 'swell' (a chord that swells in and rings).
// The arpeggio's notes ring a whole beat over each other, as the reference's do (about 3 ringing, THE GUITAR STUDY
// 01), and carry its colour: onsets against the root were root 29%, 5th 16%, 4th 15%, major 3rd 15%, 6th 11%
export const RHYTHM_PATTERNS = Object.freeze([
  Object.freeze({ key: 'arpeggio', events: Object.freeze([0, 2, 3, 6, 2, 3, 1, 5].map((w, i) => Object.freeze([i / 2, 1, Object.freeze([w]), 'pick']))) }),
  Object.freeze({
    key: 'strum',
    events: Object.freeze([
      Object.freeze([0, 1, Object.freeze([0, 1, 2, 3]), 'strum']), Object.freeze([1, 0.25, Object.freeze([0, 2]), 'mute']),
      Object.freeze([1.5, 0.5, Object.freeze([0, 1, 2, 3]), 'up']), Object.freeze([2, 0.25, Object.freeze([0, 2]), 'mute']),
      Object.freeze([2.5, 1, Object.freeze([0, 1, 2, 3]), 'strum']), Object.freeze([3.5, 0.5, Object.freeze([1, 2, 3]), 'up']),
    ]),
  }),
  Object.freeze({ key: 'swell', events: Object.freeze([Object.freeze([0, 3.5, Object.freeze([0, 2, 3, 5]), 'swell'])]) }),
]);

export const MOD_KINDS = Object.freeze(['phaser', 'flanger']);

const finite = (x, d) => (Number.isFinite(x) ? x : d);
const BUTTERWORTH_DB = -3.0103; // a lowpass or highpass Q in dB: flat, no peak (see echoguitar.js)
const curves = new WeakMap();
function cached(ctx, key, make) {
  let m = curves.get(ctx);
  if (!m) { m = new Map(); curves.set(ctx, m); }
  if (!m.has(key)) m.set(key, make());
  return m.get(key);
}

// THE FUZZ'S CLIP: y = tanh(k (x + b)) - tanh(k b), scaled to peak 1 on the louder side. The gain k lives inside the
// curve, so the bias b moves the point where a driven wave crosses (its duty cycle), which is what makes even
// harmonics beside the odd ones, as a fuzz's single biased transistor stage does. (A bias applied after a separate
// gain would only shift a clipped square wave's level, and a level shift adds no harmonics at all.)
export function fuzzCurve(ctx, k = 14, bias = 0.18) {
  return cached(ctx, `fuzz:${k}:${bias}`, () => {
    const c = new Float32Array(2049);
    const off = Math.tanh(k * bias);
    const hi = Math.max(Math.abs(Math.tanh(k * (1 + bias)) - off), Math.abs(Math.tanh(k * (-1 + bias)) - off));
    for (let i = 0; i < c.length; i++) { const x = i / 1024 - 1; c[i] = (Math.tanh(k * (x + bias)) - off) / hi; }
    return c;
  });
}
function rectifyCurve(ctx) {
  // the detector: |x|, so its low-pass is the mean level, and a level down to about -60 dB still reads on the grid
  return cached(ctx, 'rectify', () => { const c = new Float32Array(2049); for (let i = 0; i < c.length; i++) c[i] = Math.abs(i / 1024 - 1); return c; });
}
function gainCurve(ctx, thresholdDb, ratio) {
  // the gain for a detected mean level m: above the threshold, the level over it is cut by (1 - 1 / ratio)
  return cached(ctx, `gain:${thresholdDb}:${ratio}`, () => {
    const c = new Float32Array(2049);
    for (let i = 0; i < c.length; i++) {
      const m = i / 1024 - 1;
      if (m <= 1e-6) { c[i] = 1; continue; }
      const lv = 20 * Math.log10(m);
      c[i] = lv > thresholdDb ? 10 ** (((thresholdDb - lv) * (1 - 1 / ratio)) / 20) : 1;
    }
    return c;
  });
}

const filt = (ctx, type, f, q, gain) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; if (gain != null) b.gain.value = gain; return b; };
const gainNode = (ctx, g) => { const n = ctx.createGain(); n.gain.value = g; return n; };

// THE SQUASH: a feed-forward compressor of plain nodes (a rectifier, a 40 Hz low-pass for the mean level, a gain law)
export function createSquash(ctx, out, { thresholdDb = -24, ratio = 4, makeup = 2 } = {}) {
  const input = ctx.createGain();
  const det = ctx.createWaveShaper(); det.curve = rectifyCurve(ctx);
  const smooth = filt(ctx, 'lowpass', 40, BUTTERWORTH_DB); // about a 4 ms attack: a slower detector let each pick through and then clamped, a pop and a fall
  const law = ctx.createWaveShaper(); law.curve = gainCurve(ctx, thresholdDb, ratio);
  const vca = ctx.createGain(); vca.gain.value = 0; // its gain is the law's output alone
  const mk = gainNode(ctx, makeup);
  input.connect(det); det.connect(smooth); smooth.connect(law); law.connect(vca.gain);
  input.connect(vca); vca.connect(mk); mk.connect(out);
  return { input, nodes: [input, det, smooth, law, vca, mk] };
}

// THE FUZZ: input high-pass (a fuzz's small input capacitor), the clip (the gain lives in the curve, so the bias moves
// the duty cycle), a 25 Hz DC block (an asymmetric curve adds an offset), the tone stack, and the cabinet
export function createFuzz(ctx, out, { gain = 20, bias = 0.3, tight = 150 } = {}) {
  const C = PSYCH_GUITARS.cabinet; const T = PSYCH_GUITARS.toneStack;
  const input = ctx.createGain();
  const hpIn = filt(ctx, 'highpass', tight, BUTTERWORTH_DB);
  const clip = ctx.createWaveShaper(); clip.curve = fuzzCurve(ctx, gain, bias); clip.oversample = '4x';
  const dc = filt(ctx, 'highpass', C.dcBlock, BUTTERWORTH_DB);
  const stackGain = gainNode(ctx, 10 ** (T.gainDb / 20));
  const low = filt(ctx, 'lowshelf', T.lowHz, null, T.lowDb);
  const mid = filt(ctx, 'peaking', T.midHz, T.midQ, T.midDb);
  const high = filt(ctx, 'highshelf', T.highHz, null, T.highDb);
  const cabLow = filt(ctx, 'highpass', C.low, BUTTERWORTH_DB);
  const cab1 = filt(ctx, 'lowpass', C.high, BUTTERWORTH_DB);
  const cab2 = filt(ctx, 'lowpass', C.high, BUTTERWORTH_DB);
  const chain = [input, hpIn, clip, dc, stackGain, low, mid, high, cabLow, cab1, cab2];
  for (let k = 0; k + 1 < chain.length; k++) chain[k].connect(chain[k + 1]);
  cab2.connect(out);
  return { input, nodes: chain };
}

function lfo(ctx, type, rate, t) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = rate; o.start(t); return o; }

// THE PHASER: dry in the middle, a four-stage all-pass chain each side, the two sides swept against each other
export function createPhaser(ctx, out, { centre = 682, cents = 1800, rate = 0.15, mix = 0.5, spread = 0.6, t = ctx.currentTime } = {}) {
  const input = ctx.createGain();
  const dry = gainNode(ctx, mix);
  input.connect(dry); dry.connect(out);
  const osc = lfo(ctx, 'triangle', rate, t);
  const nodes = [input, dry];
  for (const [side, sign] of [[-spread, 1], [spread, -1]]) {
    const depth = gainNode(ctx, sign * cents);
    osc.connect(depth);
    const a1 = filt(ctx, 'allpass', centre, 0.5); const a2 = filt(ctx, 'allpass', centre, 0.5);
    depth.connect(a1.detune); depth.connect(a2.detune);
    const wet = gainNode(ctx, mix);
    const pan = ctx.createStereoPanner(); pan.pan.value = side;
    input.connect(a1); a1.connect(a2); a2.connect(wet); wet.connect(pan); pan.connect(out);
    nodes.push(depth, a1, a2, wet, pan);
  }
  return { input, nodes, lfos: [osc] };
}

// THE FLANGER: a feed-forward comb, swept by a triangle; the two sides swept against each other
export function createFlanger(ctx, out, { base = 0.0025, depth = 0.0018, rate = 0.12, mix = 0.5, spread = 0.5, t = ctx.currentTime } = {}) {
  const input = ctx.createGain();
  const dry = gainNode(ctx, mix);
  input.connect(dry); dry.connect(out);
  const osc = lfo(ctx, 'triangle', rate, t);
  const nodes = [input, dry];
  for (const [side, sign] of [[-spread, 1], [spread, -1]]) {
    const d = ctx.createDelay(0.02); d.delayTime.value = base;
    const g = gainNode(ctx, sign * depth);
    osc.connect(g); g.connect(d.delayTime);
    const wet = gainNode(ctx, mix);
    const pan = ctx.createStereoPanner(); pan.pan.value = side;
    input.connect(d); d.connect(wet); wet.connect(pan); pan.connect(out);
    nodes.push(d, g, wet, pan);
  }
  return { input, nodes, lfos: [osc] };
}

// THE CHORUS: the dry signal, and a swept delay each side, swept against each other
export function createChorus(ctx, out, { delay = 0.0096, depth = 0.0011, rate = 0.8, wet = 0.4, spread = 0.8, t = ctx.currentTime } = {}) {
  const input = ctx.createGain();
  input.connect(out);
  const osc = lfo(ctx, 'triangle', rate, t);
  const nodes = [input];
  for (const [side, sign] of [[-spread, 1], [spread, -1]]) {
    const d = ctx.createDelay(0.05); d.delayTime.value = delay;
    const g = gainNode(ctx, sign * depth);
    osc.connect(g); g.connect(d.delayTime);
    const w = gainNode(ctx, wet);
    const pan = ctx.createStereoPanner(); pan.pan.value = side;
    input.connect(d); d.connect(w); w.connect(pan); pan.connect(out);
    nodes.push(d, g, w, pan);
  }
  return { input, nodes, lfos: [osc] };
}

// THE TAPE ECHO: in -> out (dry) and in -> delay -> wet -> out; the loop runs through a Butterworth low-pass (each
// repeat darker), a high-pass (no rumble builds), a soft clip (the tape's saturation) and the loop gain; a slow sine
// on the delay time wobbles each repeat's pitch (the wow)
export function createTapeEcho(ctx, out, { beatDur = 0.5, beats = 0.75, feedback = 0.42, tone = 2200, wow = 0.0007, wowRate = 0.6, wet = 0.38, t = ctx.currentTime } = {}) {
  const input = ctx.createGain();
  const delay = ctx.createDelay(2);
  const lp = filt(ctx, 'lowpass', tone, BUTTERWORTH_DB);
  const hp = filt(ctx, 'highpass', 160, BUTTERWORTH_DB);
  const sat = ctx.createWaveShaper(); sat.curve = fuzzCurve(ctx, 1.5, 0);
  const fb = gainNode(ctx, Math.min(0.78, Math.max(0, finite(feedback, 0.42)))); // the loop gain is capped at 0.78 (THE GUITAR STUDY 05)
  const wetG = gainNode(ctx, Math.min(1, Math.max(0, finite(wet, 0.38))));
  const osc = lfo(ctx, 'sine', wowRate, t);
  const wg = gainNode(ctx, wow);
  osc.connect(wg); wg.connect(delay.delayTime);
  const seconds = (bd) => Math.min(1.9, Math.max(0.05, finite(bd, 0.5) * beats));
  delay.delayTime.value = seconds(beatDur);
  input.connect(out);
  input.connect(delay);
  delay.connect(lp); lp.connect(hp); hp.connect(sat); sat.connect(fb); fb.connect(delay);
  delay.connect(wetG); wetG.connect(out);
  return {
    input, nodes: [input, delay, lp, hp, sat, fb, wetG, wg], lfos: [osc],
    get seconds() { return delay.delayTime.value; },
    setBeat(bd, at = ctx.currentTime) { try { delay.delayTime.setValueAtTime(seconds(bd), at); } catch { delay.delayTime.value = seconds(bd); } },
  };
}

// ONE VOICE'S PEDALBOARD: squash -> fuzz (and cabinet) -> phaser or flanger -> chorus (the rhythm guitar) -> echo -> room
export function createPsychRig(ctx, out, { voice = 'lead', beatDur = 0.5, mod = null, t = ctx.currentTime } = {}) {
  const V = voice === 'rhythm' ? PSYCH_GUITARS.rhythm : PSYCH_GUITARS.lead;
  const m = voice === 'rhythm' ? (MOD_KINDS.includes(mod) ? mod : 'phaser') : 'phaser';
  const trim = gainNode(ctx, V.trim);
  const pan = ctx.createStereoPanner(); pan.pan.value = V.pan;
  trim.connect(pan); pan.connect(out);
  const room = createRoom(ctx, trim, V.room);
  const echo = createTapeEcho(ctx, room.input, { beatDur, ...V.echo, t });
  const chorus = voice === 'rhythm' ? createChorus(ctx, echo.input, { ...V.chorus, t }) : null;
  const afterMod = chorus ? chorus.input : echo.input;
  const modFx = m === 'flanger' ? createFlanger(ctx, afterMod, { ...V.flanger, t }) : createPhaser(ctx, afterMod, { ...V.phaser, t });
  // the squash sits after the fuzz (THE GUITAR STUDY's chain: shaper, then compressor), so the velocity reaches the
  // fuzz untouched (a softer note cleans up) and the squash holds the sustain flat after the clip
  const squash = createSquash(ctx, modFx.input, V.squash);
  const fuzz = createFuzz(ctx, squash.input, V.fuzz);
  const parts = [fuzz, squash, modFx, chorus, echo].filter(Boolean);
  const lfos = parts.flatMap((p) => p.lfos ?? []);
  let gone = false;
  return {
    input: fuzz.input,
    voice,
    mod: m,
    get echoSeconds() { return echo.seconds; },
    setBeat(bd, at) { echo.setBeat(bd, at); },
    dispose(at = ctx.currentTime) {
      if (gone) return;
      gone = true;
      for (const o of lfos) try { o.stop(at + 0.1); } catch { /* stopped */ }
      room.dispose(at);
      const id = setTimeout(() => { for (const n of [trim, pan, ...parts.flatMap((p) => p.nodes)]) try { n.disconnect(); } catch { /* gone */ } }, Math.max(0, (at - ctx.currentTime) * 1000) + 80);
      id?.unref?.();
    },
  };
}

// ONE PICKED NOTE: opts { kind: 'pick' | 'mute' | 'swell', bendTo (Hz), bendAt (s), vibrato (bool) }
export function psychNote(ctx, out, f, t, dur = 0.5, vel = 0.8, { kind = 'pick', bendTo = null, bendAt = null, vibrato = false } = {}) {
  const P = PSYCH_GUITARS.pick;
  const freq = finite(f, 0);
  if (!(freq > 20) || freq > 4000) return false;
  const v = Math.min(1, Math.max(0, finite(vel, 0.8)));
  const mute = kind === 'mute';
  const swell = kind === 'swell';
  const hold = Math.max(0.03, finite(dur, 0.5));
  const release = mute ? Math.max(P.release, 0.06) : P.release * (swell ? 3 : 1.5);
  const end = t + hold + release * 4;
  const peak = (mute ? 0.55 : 1) * v;
  const attack = swell ? PSYCH_GUITARS.rhythm.swell : P.attack;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + attack);
  // a held string loses a little: the fuzz keeps it up, so the fall under the clip is gentle
  env.gain.setTargetAtTime(peak * (mute ? 0.4 : 0.85), t + attack, mute ? 0.04 : 0.6);
  env.gain.setValueAtTime(peak * (mute ? 0.4 : 0.85), t + Math.max(hold, attack + 0.001));
  env.gain.setTargetAtTime(0, t + Math.max(hold, attack + 0.001), release / 3);
  env.connect(out);
  // the pick filter: open at the raw ceiling, closing toward a few harmonics; a palm mute stays closed
  const pf = ctx.createBiquadFilter();
  pf.type = 'lowpass';
  pf.Q.value = BUTTERWORTH_DB;
  const shut = Math.max(900, Math.min(P.open, freq * 8)); // it closes only part way: the reference's notes keep their top for their whole sustain (THE GUITAR STUDY 02)
  pf.frequency.setValueAtTime(mute ? Math.min(700, P.open) : P.open, t);
  if (!mute) pf.frequency.setTargetAtTime(shut, t + 0.01, P.close / 3);
  pf.connect(env);
  const oscs = [-1, 1].map((s) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = (s * P.detuneCents) / 2;
    if (Number.isFinite(bendTo) && bendTo > 20) {
      const ba = Math.max(t + attack, finite(bendAt, t + hold / 2));
      o.frequency.setValueAtTime(freq, ba);
      o.frequency.exponentialRampToValueAtTime(bendTo, ba + PSYCH_GUITARS.lead.bendTime);
    }
    const g = gainNode(ctx, 0.5);
    o.connect(g); g.connect(pf);
    o.start(t); o.stop(end);
    return { o, g };
  });
  const extra = [];
  if (vibrato) {
    // the finger vibrato: a sine on the detune, faded in after the bend has landed
    const L = PSYCH_GUITARS.lead;
    const vo = ctx.createOscillator(); vo.type = 'sine'; vo.frequency.value = L.vibratoHz;
    const vg = ctx.createGain();
    const from = Number.isFinite(bendAt) ? bendAt + L.bendTime : t + 0.15;
    vg.gain.setValueAtTime(0, t);
    vg.gain.setValueAtTime(0, from);
    vg.gain.linearRampToValueAtTime(L.vibratoCents, from + 0.2);
    vo.connect(vg);
    for (const { o } of oscs) vg.connect(o.detune);
    vo.start(t); vo.stop(end);
    extra.push(vo, vg);
  }
  oscs[0].o.onended = () => { for (const n of [env, pf, ...oscs.map((x) => x.g), ...extra]) try { n.disconnect(); } catch { /* gone */ } };
  return true;
}

const stepMidi = (root, steps, s) => root + 12 * Math.floor(s / steps.length) + steps[((s % steps.length) + steps.length) % steps.length];
const modeSteps = (mode) => ((MODES[mode] ?? MODES.ionian).length === 7 ? MODES[mode] ?? MODES.ionian : MODES.ionian);

// the lead phrase's notes, in the key, the root moved by whole octaves so the phrase sits near the lead's register
export function leadPlan({ root = 57, mode = 'aeolian', phrase = LEAD_PHRASES[0], beatDur = 0.5, t0 = 0, register = PSYCH_GUITARS.lead.register } = {}) {
  const steps = modeSteps(mode);
  let r = Math.round(finite(root, 57));
  const mid = () => phrase.notes.reduce((a, n) => a + stepMidi(r, steps, n[1]), 0) / phrase.notes.length;
  while (mid() > register + 6) r -= 12;
  while (mid() < register - 6) r += 12;
  const bd = Math.max(0.2, finite(beatDur, 0.5));
  return phrase.notes.map(([at, s, beats, bendAt], i) => {
    const n = { t: t0 + at * bd, dur: beats * bd * 0.95, midi: stepMidi(r, steps, s), kind: phrase.swell && i === 0 ? 'swell' : 'pick' };
    if (bendAt != null) { n.bendTo = stepMidi(r, steps, s + 1); n.bendAt = n.t + bendAt * bd; }
    return n;
  });
}

// the rhythm bar's notes: the chord (midi, root first) moved by whole octaves toward the rhythm guitar's register
export function rhythmPlan({ chord = [57, 60, 64], pattern = RHYTHM_PATTERNS[0], beatDur = 0.5, t0 = 0, register = PSYCH_GUITARS.rhythm.register, swing = 0, root = null, mode = null } = {}) {
  const c = (Array.isArray(chord) && chord.length >= 3 ? chord : [57, 60, 64]).slice(0, 3).map((m) => Math.round(finite(m, 57)));
  let sh = 0;
  const centre = (c[0] + c[2]) / 2;
  while (centre + sh > register + 6) sh -= 12;
  while (centre + sh < register - 6) sh += 12;
  // the colour tone: the first of the chord root's 4th, 2nd and 6th that the key holds (no key given: the third)
  const keyPcs = Number.isFinite(root) && MODES[mode] ? new Set(MODES[mode].map((st) => (((Math.round(root) + st) % 12) + 12) % 12)) : null;
  const colour = (keyPcs && [5, 2, 9].map((iv) => c[0] + iv).find((m) => keyPcs.has(((m % 12) + 12) % 12))) ?? c[1];
  const tones = [c[0], c[1], c[2], c[0] + 12, c[1] + 12, c[2] + 12, colour].map((m) => m + sh);
  const bd = Math.max(0.2, finite(beatDur, 0.5));
  const sw = Math.max(0, Math.min(0.2, finite(swing, 0)));
  const strum = PSYCH_GUITARS.rhythm.strumMs / 1000;
  const out = [];
  for (const [at, beats, which, kind] of pattern.events) {
    const late = (at * 2) % 2 === 1 ? sw : 0; // an off-beat eighth leans late by the set's swing
    const t = t0 + (at + late) * bd;
    const picked = kind === 'up' ? [...which].reverse() : which;
    picked.forEach((w, i) => {
      const spread = kind === 'strum' || kind === 'up' || kind === 'swell' || kind === 'mute' ? i * strum : 0;
      out.push({ t: t + spread, dur: Math.max(0.05, beats * bd * (kind === 'mute' ? 0.3 : 0.95) - spread), midi: tones[w], kind: kind === 'up' || kind === 'strum' ? 'pick' : kind });
    });
  }
  return out;
}

export function playLeadPhrase(ctx, rig, { t0 = ctx.currentTime + 0.05, beatDur = 0.5, root = 57, mode = 'aeolian', phrase = LEAD_PHRASES[0], vel = 1 } = {}) {
  const notes = leadPlan({ root, mode, phrase, beatDur, t0 });
  for (const n of notes) psychNote(ctx, rig.input, midiHz(n.midi), n.t, n.dur, vel, { kind: n.kind, bendTo: n.bendTo != null ? midiHz(n.bendTo) : null, bendAt: n.bendAt, vibrato: n.bendTo != null });
  return { phrase: phrase.key, notes, end: notes.reduce((a, n) => Math.max(a, n.t + n.dur), t0) };
}

export function playRhythmBar(ctx, rig, { t0 = ctx.currentTime + 0.05, beatDur = 0.5, chord = [57, 60, 64], pattern = RHYTHM_PATTERNS[0], vel = 1, swing = 0, root = null, mode = null } = {}) {
  const notes = rhythmPlan({ chord, pattern, beatDur, t0, swing, root, mode });
  // a strum's notes share the hit: each a little quieter so a chord is not four notes loud
  const per = (n) => (n.kind === 'pick' && pattern.key === 'arpeggio' ? 1 : 0.55);
  for (const n of notes) psychNote(ctx, rig.input, midiHz(n.midi), n.t, n.dur, vel * per(n), { kind: n.kind });
  return { pattern: pattern.key, notes };
}

// the tail after the last note: the echo's fall of 40 dB, then the room
function tailOf(V, rig) { return (40 / (-20 * Math.log10(V.echo.feedback))) * rig.echoSeconds + V.room.rt60; }

export function auditionLead(ctx, out, { t0 = ctx.currentTime + 0.05, beatDur = 0.5, root = 57, mode = 'aeolian', phrase = LEAD_PHRASES[0], vel = 1 } = {}) {
  const rig = createPsychRig(ctx, out, { voice: 'lead', beatDur, t: t0 });
  const R = playLeadPhrase(ctx, rig, { t0, beatDur, root, mode, phrase, vel });
  const end = R.end + tailOf(PSYCH_GUITARS.lead, rig);
  rig.dispose(end);
  return { ...R, end, mod: rig.mod, echoSeconds: rig.echoSeconds };
}

export function auditionRhythm(ctx, out, { t0 = ctx.currentTime + 0.05, beatDur = 0.5, chord = [57, 60, 64], pattern = RHYTHM_PATTERNS[0], mod = 'phaser', bars = 1, vel = 1, swing = 0, root = 57, mode = 'aeolian' } = {}) {
  const rig = createPsychRig(ctx, out, { voice: 'rhythm', beatDur, mod, t: t0 });
  const notes = [];
  for (let b = 0; b < bars; b++) notes.push(...playRhythmBar(ctx, rig, { t0: t0 + b * 4 * beatDur, beatDur, chord, pattern, vel, swing, root, mode }).notes);
  const last = notes.reduce((a, n) => Math.max(a, n.t + n.dur), t0);
  const end = last + tailOf(PSYCH_GUITARS.rhythm, rig);
  rig.dispose(end);
  return { pattern: pattern.key, mod: rig.mod, notes, end, echoSeconds: rig.echoSeconds };
}

// THE DJ's guitars for one mix set. The decks deal one card each a set (THE DECK RULE: every phrase, part and
// modulation comes round before any repeats); a new set lets the old boards ring out their echo before freeing them
export function createSetGuitars(ctx, { seed = 1 } = {}) {
  const deckOf = (n, salt) => createBag(Array.from({ length: n }, (_, i) => i), { seed: ((Number(seed) >>> 0) ^ salt) >>> 0 || 1 });
  const decks = { lead: deckOf(LEAD_PHRASES.length, 0xf022), pattern: deckOf(RHYTHM_PATTERNS.length, 0x9a7e), mod: deckOf(MOD_KINDS.length, 0x4a5e) };
  const state = { set: undefined, lead: 0, pattern: 0, mod: 0, rigs: {}, echoSet: undefined, echo: 0 };
  // THE ECHO GUITAR's phrase deck (lane ECHOGUITAR's, moved here from mix-layers.js with its seed): one card a set
  const echoDeck = deckOf(ECHO_PHRASES.length, 0xec60);
  function rig(voice, slotIn, t0, beatDur, setKey) {
    if (state.set !== setKey) {
      for (const r of Object.values(state.rigs)) try { r.dispose(t0 + 8 * beatDur); } catch { /* gone */ }
      state.rigs = {};
      state.set = setKey;
      state.lead = decks.lead.next(); state.pattern = decks.pattern.next(); state.mod = decks.mod.next();
    }
    if (!state.rigs[voice]) state.rigs[voice] = createPsychRig(ctx, slotIn, { voice, beatDur, mod: MOD_KINDS[state.mod], t: t0 });
    else state.rigs[voice].setBeat(beatDur, t0);
    return state.rigs[voice];
  }
  return {
    state,
    // the answer: the set's lead phrase from beat 1.5 of the bar
    answer(slotIn, d, t0, beatDur, vel = 1) {
      const r = rig('lead', slotIn, t0, beatDur, d.plan?.set);
      return playLeadPhrase(ctx, r, { t0: t0 + 1.5 * beatDur, beatDur, root: d.root, mode: d.mode, phrase: LEAD_PHRASES[state.lead], vel });
    },
    // the arps: the bar's chord (a piece's own chord when a piece plays) as the set's part. The fuzz squashes a
    // velocity's level, so the mix passes no per-note humanising: a softer velocity only cleans the tone a little
    arps(slotIn, d, t0, beatDur, vel = 1, swing = 0) {
      const r = rig('rhythm', slotIn, t0, beatDur, d.plan?.set);
      return playRhythmBar(ctx, r, { t0, beatDur, chord: d.chord, pattern: RHYTHM_PATTERNS[state.pattern], vel, swing, root: d.root, mode: d.mode });
    },
    // one bar of THE DJ's set: into(slot) is the part's bus, y the bar's layer bits; the lead answers on even bars
    bar(into, d, t0, beatDur, y, ansInst, arpInst, ansVel = 1, arpVel = 1, swing = 0) {
      if (y.answer && d.bar % 2 === 0 && ansInst === 'fuzz-lead') this.answer(into('answer'), d, t0, beatDur, ansVel);
      if (y.answer && d.bar % 2 === 0 && ansInst === 'echo-guitar') {
        if (state.echoSet !== d.plan?.set) { state.echoSet = d.plan?.set; state.echo = echoDeck.next(); }
        playEchoPhrase(ctx, into('answer'), { t0: t0 + 1.5 * beatDur, beatDur, root: d.root, mode: d.mode, phrase: ECHO_PHRASES[state.echo], vel: ansVel });
      }
      if (y.arps && arpInst === 'phase-guitar') this.arps(into('arps'), d, t0, beatDur, arpVel, swing);
    },
    dispose(at = ctx.currentTime) { for (const r of Object.values(state.rigs)) try { r.dispose(at); } catch { /* gone */ } state.rigs = {}; },
  };
}
