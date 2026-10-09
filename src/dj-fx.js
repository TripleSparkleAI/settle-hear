// settle-hear · dj-fx - THE DJ'S DESK: the moods, the settle's flavour, the overdo, and the effect bus they drive.
//
// <claudes_code_comments>
// ** Function List **
// MOODS / MOOD_KEYS          - the ten packaged effect profiles THE DJ picks from (CLEAN, WARM ROOM, CATHEDRAL ...)
// moodOf(key)                - one mood by key (CLEAN for an unknown key)
// OVERDRIVE_MOOD / DEALT_MOODS - lane DJOVERDRIVE: OVERDRIVE (GRIT refitted) and the nine moods the bag deals
// OVERDRIVE_DECK / VOICE_DRIVE_DECK / PURE_DRIVE_DECK / VOCODER_DECK / VOCODER_VOICE_DECK - the colour's decks
// voiceDriveOf(flavour, steer) / vocoderOf(kind, r, steer) - a dealt voice overdrive's push and a set's vocoder
// DRIVE_MODES / RES_BANDS / RES_QS - the settle's named flavours: the distortion's mode, the resonance's band and Q
// settleFlavour(inputs)      - { heat, flips, energy, overlap } -> { drive, band, q, hz, Q, agitation }: the table
//                              in the review below, quantised so it stays musical
// OVERDO_KINDS / OVERDO      - the three major overused effects and what "too much" of each means
// CAPS / FEEDBACK_CAP        - the hard limits every value passes through, overdo included
// clampFx(v)                 - a values object through CAPS (finite, in range, feedback below 1)
// fxValues(mood, flavour, overdo, steer) - the values the bus is set to for one phrase
// createDjFx({ seed, random }) - THE BRAIN, pure data: .bar({ newSet, inputs, hold, steer, pure }) -> the plan for
//                              this bar ({ mood, baseMood, overdrive, overdo, colour, flavour, values, phrase,
//                              changed }); .state; deterministic
// curveFor(mode, n)          - a WaveShaper curve: soft (tanh), fold (sine fold) or crush (amplitude steps)
// DRIVE_REF / driveMakeup(mode, gain) - the post gain that loudness-matches a drive shaper to the dry path
// trimFor(values)            - the bus trim against the wet returns (measured offline, see the README)
// limiterMakeupDb(limit)     - the makeup gain a Web Audio compressor adds on its own (the bus takes it back)
// createFxBus(E, { out })    - the audio: input -> drive (dry plus three shapers) -> THE TUBE (lane DJOVERDRIVE, a
//                              direct path until first used) -> resonance (peaking) -> tone
//                              (lowpass) -> dry, room and hall reverb, a tempo delay -> trim -> THE WOBBLE -> a bus
//                              limiter -> out; .apply(values, t, { tau, beatDur }) ramps everything; .wobble(x, t)
//                              sets THE WOBBLE (lane SOUNDSHAKE, pulse.js); .duck(t) dips THE DUCK (lane DROPDUCK,
//                              duck.js); .dispose()
// WOBBLE_STAGE               - THE WOBBLE's fixed numbers: a 6 ms base delay, the vibrato and tremolo rates and their
//                              most at a full wobble (about 25 cents of pitch, a tremolo dip of 0.22)
//
// ** Technical Review **
// - THE NAVIGATOR (2026-10-04): "Can the DJ have access to all this stuff too? And it can overdo it sometimes ... some
//   random 10% or 20% of the time ... The rest of the time the DJ just has access to make it nice, and has some good
//   profiles to select from: moods ... And our settle chooser can choose the mode of the distortion and the resonance."
// - THE DESK, FOR THE DJ: the #/hear desk gives a hearing a reverb send, a delay send and a tone lowpass into the
//   engine's shared buses. The DJ gets the same kinds of effect plus a distortion and a resonance, on ITS OWN bus,
//   so an overdo of the DJ's delay can never reach a desk hearing's echo. It reuses the engine's generated impulse
//   (impulse()), its guarded ramp() and the deck (createBag). The binaural pair stays on its own dry channel and never
//   meets this bus, so each ear keeps its own tone and the 40 Hz beat is untouched.
// - THE MOODS are dealt by THE DECK RULE (createBag over MOOD_KEYS): never the one it leaves, every mood before a
//   repeat. A mood lasts MOOD_PHRASES phrases (4 x 4 bars) or until a new set, and changes on a phrase line only.
// - THE SETTLE CHOOSES THE FLAVOUR, once a phrase (so it never flickers):
//     agitation a = 0.6 heat + 0.4 flips   a < 0.34 SOFT clip    a < 0.67 FOLD          else CRUSH
//     energy e (1 - settledness)           e < 0.34 LOW 320 Hz   e < 0.67 MID 900 Hz    else HIGH 2400 Hz
//     overlap q                            q >= 0.67 GENTLE Q 1.4  q >= 0.34 FIRM Q 3.5  else SHARP Q 7
//   Hot and flipping: a crushed drive on a high, sharp resonance. Cold and settled: a soft clip on a low, gentle one.
//   The mood sets HOW MUCH (drive mix and gain, resonance dB); the settle sets WHICH KIND.
// - THE OVERDO: once a phrase the brain deals from a seven-card deck, six calm cards and one OVER card, so one phrase
//   in seven (14.3%) overdoes one effect, at a random place in each round, and the seam rule (createBag never opens a
//   round on the card it closed) means two overdone phrases never follow each other. The visit's first phrase is calm.
//   The kind (delay, reverb, distortion) comes from its own deck. A kind the visitor's steering covers is skipped.
// - SAFETY: every value goes through CAPS, the overdo included. The delay's feedback is hard-capped at FEEDBACK_CAP
//   (0.78) with a lowpass in the loop, so repeats always die away. Each drive curve has |curve(x)| <= |x| and its post
//   gain is loudness-matched to the dry path (driveMakeup, at most x4), the trim lowers the bus as the wet returns
//   rise, and the bus has its own limiter (-6 dB, ratio 20, its automatic makeup gain taken back by a fixed gain
//   after it) before the engine's master, mute and master limiter.
//   So an overdo is loud in character, never in level: no jump above the master. Measured offline: see the README.
// - SMOOTH: every change is a setTargetAtTime ramp on the bar line (tau 0.6 s into a mood, 0.35 s into an overdo,
//   1.2 s out of it); the drive's mode changes by crossfading three always-running shapers, never by swapping a curve,
//   and the delay time glides to its new tempo-synced value, so no change clicks or zips.
// - THE STEERING (steer.js fx part): { mood, reverb, delay, drive, tone }, each null (the DJ decides) or a value. A
//   steered mood replaces the dealt mood; a steered amount replaces the DJ's value for that effect, overdo included.
// - THE WEATHER (lane SOUNDSHAKE, weather.js): once a phrase the brain also deals a WEATHER profile by THE DECK RULE
//   (createBag over WEATHER_KEYS): how the DJ's low end should move the hero's picture this phrase. An overdone phrase
//   plays it hard; a held DJ breathes (HELD_WEATHER). The state carries weather, weatherLabel and weatherHard, and
//   djLive publishes them; the site maps them onto the picture's own physics.
// - THE WOBBLE (lane SOUNDSHAKE, navigator 2026-10-04: "the sound the DJ plays is affected while the waves
//   dissipate"): between the trim and the bus limiter sit a delay line (6 ms) and a gain. At rest they pass the bus
//   unchanged but for the 6 ms. wobble(x) (0..1, pulse.js soundWobble) ramps a sine LFO into the delay time (a
//   vibrato, at most WOBBLE_STAGE.vibratoMs either way, about 25 cents at 5.2 Hz) and a second one into the gain (a
//   tremolo whose gain stays at or under 1: 1 - d/2 + (d/2) sin, so it can only lower the level). The LFOs are built
//   on the first wobble above zero, like the other sections. The binaural pair never meets this bus, so its beat
//   frequency never wobbles.
// - THE DUCK (lane DROPDUCK, navigator 2026-10-06: "Add the duck."): a gain between THE WOBBLE and the bus limiter,
//   at 1 at rest. On a drag-box drop duck.js duckDrop() calls .duck(t) on every live bus, which schedules
//   duck.js scheduleDuck on it: 3.5 dB down over a 12 ms time constant, held 260 ms, back over 80 ms (about 300 ms
//   more than half the depth down), the way radio ducks the music under the host. Before the limiter, so the dip is
//   in the music the limiter hears; the binaural pair and the clicks never meet this bus, so the drop's own card and
//   the 40 Hz beat keep their level.
// - THE OVERDRIVE MOOD (lane DJOVERDRIVE, navigator 2026-10-08: "THE DJ gets about a 20% chance of OVERDRIVE MODE
//   ... refit one of the existing modes with this"): GRIT was refitted, because GRIT already was the desk's driven
//   mood (a hard drive, a short room, a ringing edge) and a second drive mood would crowd the bag. OVERDRIVE leaves the
//   bag (the bag deals the other nine) and comes from its own five-card deck once a phrase, four calm cards and one
//   OVERDRIVE: one phrase in five, never two in a row, the visit's first phrase calm. Its sound is a series valve stage
//   on the bus (dj-colour-stage.js createTube, loaded on demand: asymmetric waveshaping, even and odd harmonics, oversampled 4x, the dry leg
//   latency-matched), between the drive and the resonance, with the settle's parallel shapers at rest under it. A
//   steered mood takes the bus (OVERDRIVE is then not heard and not named); a steered overdrive sets the valve's blend
//   in every mood, and 0 deals neither OVERDRIVE nor a voice overdrive. state.mood names OVERDRIVE while it is heard,
//   state.baseMood the mood the bag dealt under it.
// - THE COLOUR (lane DJOVERDRIVE, dj-colour.js): once a phrase outside OVERDRIVE the voice deck may push one voice into
//   the valve (the lead two cards in eight, another melodic voice one in eight); the McKusker flute's own deck pushes
//   it one phrase in four while it plays; once a set the vocoder deck puts a vocoder on a voice one set in three,
//   warbling or steady. The brain names the voice ('lead', 'other', 'flute'); symphony.js resolves it to a part and
//   applies it on the bar line. state.colour carries it.
// - A SILENT BUS IS A DJ THAT IS NOT PLAYING (lane DJSILENCE, 2026-10-07, measured in SETTLE/runs/djsilence/): lane
//   DROPDUCK read this bus silent from about 5.8 min of page life while the master stayed loud. Nothing here stopped:
//   the hero's SHUFFLE plays DEFAULT MODE (THE DJ, through this bus) until the opening blend has played whole, then
//   moves to a popular binaural mode that has no DJ, and the master carries that mode. Across a set change, a stop and a
//   play again, every voice THE DJ starts still reaches the master through this bus (tests/djsilence.test.mjs).
// </claudes_code_comments>

import { createBag, deckRng } from './deck.js';
import { ramp, impulse } from './engine.js';
import { WEATHER_KEYS, HELD_WEATHER, weatherOf } from './weather.js';
import { registerWobbleTarget } from './pulse.js';
import { registerDuckTarget, scheduleDuck } from './duck.js';
import { colourNow, loadColour } from './dj-colour.js'; // the valve itself waits in dj-colour-stage.js, on demand

// the amounts are 0..1 sends and mixes; tone is a lowpass in Hz; time is the delay in beats; gain is the drive's
// pre gain; res is the resonance's peak in dB; size moves the reverb from the room (0) to the hall (1)
export const MOODS = Object.freeze([
  { key: 'clean', label: 'CLEAN', line: 'a light room, nothing else', reverb: 0.08, size: 0.2, delay: 0, feedback: 0.2, time: 0.75, tone: 16000, drive: 0, gain: 1, res: 0 },
  { key: 'warm-room', label: 'WARM ROOM', line: 'a small warm room, the top rounded, a touch of grain', reverb: 0.22, size: 0.25, delay: 0.06, feedback: 0.25, time: 0.75, tone: 7000, drive: 0.25, gain: 1.6, res: 2 },
  { key: 'cathedral', label: 'CATHEDRAL', line: 'a long stone hall, clean and high', reverb: 0.55, size: 1, delay: 0.05, feedback: 0.3, time: 1, tone: 9000, drive: 0, gain: 1, res: 1.5 },
  { key: 'dub-echo', label: 'DUB ECHO', line: 'dotted echoes falling away into the dark', reverb: 0.18, size: 0.4, delay: 0.35, feedback: 0.55, time: 0.75, tone: 5200, drive: 0.2, gain: 1.8, res: 3 },
  { key: 'tape', label: 'TAPE', line: 'saturated, slapback eighths, the top worn soft', reverb: 0.15, size: 0.3, delay: 0.18, feedback: 0.4, time: 0.5, tone: 6000, drive: 0.45, gain: 2.2, res: 2 },
  // OVERDRIVE (lane DJOVERDRIVE): GRIT refitted as a harmonic, valve-style overdrive on the whole bus (dj-colour-stage.js
  // createTube), dealt one phrase in five by its own deck rather than the mood bag
  { key: 'overdrive', label: 'OVERDRIVE', line: 'turned up into a valve: warm even and odd harmonics, a short room', reverb: 0.1, size: 0.2, delay: 0.06, feedback: 0.3, time: 0.5, tone: 11000, drive: 0, gain: 1, res: 2.5, tube: 0.85, tubeGain: 4 },
  { key: 'underwater', label: 'UNDERWATER', line: 'muffled and far, slow echoes, a resonant swell', reverb: 0.35, size: 0.7, delay: 0.15, feedback: 0.45, time: 1, tone: 1400, drive: 0.1, gain: 1.4, res: 6 },
  { key: 'shimmer', label: 'SHIMMER', line: 'a bright hall and quick echoes, glittering', reverb: 0.45, size: 0.9, delay: 0.22, feedback: 0.5, time: 0.5, tone: 14000, drive: 0, gain: 1, res: 3 },
  { key: 'night-radio', label: 'NIGHT RADIO', line: 'a narrow band, a little broken, far away', reverb: 0.12, size: 0.3, delay: 0.1, feedback: 0.35, time: 0.75, tone: 3400, drive: 0.35, gain: 2.4, res: 5 },
  { key: 'attic', label: 'ATTIC', line: 'a wooden room, soft and close, slow quarter echoes', reverb: 0.3, size: 0.45, delay: 0.1, feedback: 0.3, time: 1, tone: 4800, drive: 0.15, gain: 1.5, res: 2 },
]);
export const MOOD_KEYS = Object.freeze(MOODS.map((m) => m.key));
const BY_KEY = new Map(MOODS.map((m) => [m.key, m]));
export const moodOf = (key) => BY_KEY.get(key) ?? MOODS[0];
// THE OVERDRIVE MOOD (lane DJOVERDRIVE) is dealt by its own deck, one phrase in five; the mood bag deals the other nine
export const OVERDRIVE_MOOD = 'overdrive';
export const DEALT_MOODS = Object.freeze(MOOD_KEYS.filter((k) => k !== OVERDRIVE_MOOD));
// the decks of THE DJ's colour (lane DJOVERDRIVE, dj-colour.js), each by THE DECK RULE:
// OVERDRIVE_DECK - per phrase: four calm cards, one OVERDRIVE (one phrase in five, never two in a row)
// VOICE_DRIVE_DECK - per phrase outside OVERDRIVE: the lead twice, another melodic voice once, nothing five times
// PURE_DRIVE_DECK - per phrase of the McKusker flute: overdriven one phrase in four
// VOCODER_DECK - per set: a warbling vocoder, a steady one, nothing four times (one set in three)
// VOCODER_VOICE_DECK - which voice speaks through it: the lead twice, another melodic voice once
export const OVERDRIVE_DECK = Object.freeze({ cards: ['calm', 'over'], weights: [4, 1] });
export const VOICE_DRIVE_DECK = Object.freeze({ cards: ['lead', 'other', 'none'], weights: [2, 1, 5] });
export const PURE_DRIVE_DECK = Object.freeze({ cards: ['flute', 'none'], weights: [1, 3] });
export const VOCODER_DECK = Object.freeze({ cards: ['warble', 'steady', 'none'], weights: [1, 1, 4] });
export const VOCODER_VOICE_DECK = Object.freeze({ cards: ['lead', 'other'], weights: [2, 1] });

// the bus while the DJ is held (the opening blend, the pure flute): every effect at zero, the tone wide open
export const DRY = Object.freeze({ ...MOODS[0], reverb: 0, delay: 0, drive: 0, res: 0, tone: 18000 });

export const PHRASE_BARS = 4;
export const MOOD_PHRASES = 4;

export const DRIVE_MODES = Object.freeze([
  { key: 'soft', label: 'SOFT CLIP', line: 'tanh, the peaks rounded' },
  { key: 'fold', label: 'FOLD', line: 'a sine fold, peaks folded back into new harmonics' },
  { key: 'crush', label: 'CRUSH', line: 'amplitude steps, a broken digital grain' },
]);
export const RES_BANDS = Object.freeze([
  { key: 'low', label: 'LOW', hz: 320 },
  { key: 'mid', label: 'MID', hz: 900 },
  { key: 'high', label: 'HIGH', hz: 2400 },
]);
export const RES_QS = Object.freeze([
  { key: 'gentle', label: 'GENTLE', Q: 1.4 },
  { key: 'firm', label: 'FIRM', Q: 3.5 },
  { key: 'sharp', label: 'SHARP', Q: 7 },
]);

const c01 = (x, d = 0) => (Number.isFinite(+x) ? Math.min(1, Math.max(0, +x)) : d);
const third = (x) => (x < 0.34 ? 0 : x < 0.67 ? 1 : 2);

export function settleFlavour(inputs = {}) {
  const i = inputs && typeof inputs === 'object' ? inputs : {};
  const heat = c01(i.heat);
  const flips = c01(i.flips, heat);
  const energy = c01(i.energy, heat);
  const overlap = c01(i.overlap, 1 - heat);
  const agitation = 0.6 * heat + 0.4 * flips;
  const drive = DRIVE_MODES[third(agitation)];
  const band = RES_BANDS[third(energy)];
  const q = RES_QS[2 - third(overlap)];
  return { drive: drive.key, band: band.key, q: q.key, hz: band.hz, Q: q.Q, agitation: +agitation.toFixed(3) };
}

export const OVERDO_KINDS = Object.freeze(['delay', 'reverb', 'drive']);
// what "too much" of each means; every value still passes CAPS
export const OVERDO = Object.freeze({
  delay: { label: 'too much delay', set: { delay: 0.6, feedback: 0.74 } },
  reverb: { label: 'too much reverb', set: { reverb: 0.85, size: 1 } },
  drive: { label: 'too much distortion', set: { drive: 0.9, gain: 4.5 } },
});
// the steering's names for the parameters each overdo kind touches
const KIND_STEER = { delay: 'delay', reverb: 'reverb', drive: 'drive' };

export const FEEDBACK_CAP = 0.78;
export const CAPS = Object.freeze({
  reverb: [0, 0.9], size: [0, 1], delay: [0, 0.65], feedback: [0, FEEDBACK_CAP], time: [0.25, 1.5],
  tone: [600, 18000], drive: [0, 0.95], gain: [1, 5], res: [0, 9], hz: [120, 6000], Q: [0.5, 10],
  // lane DJOVERDRIVE: the bus's valve stage, its blend and how hard the bus is pushed into it
  tube: [0, 0.9], tubeGain: [2.5, 6],
});

export function clampFx(v = {}) {
  const out = {};
  for (const [k, [lo, hi]] of Object.entries(CAPS)) {
    const x = Number(v[k]);
    out[k] = Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo;
  }
  out.mode = DRIVE_MODES.some((m) => m.key === v.mode) ? v.mode : 'soft';
  return out;
}

// a steered tone is 0..1 (dark .. open), mapped log-wise over the tone range
const toneOf = (x) => 600 * Math.pow(18000 / 600, c01(x));

export function fxValues(mood, flavour, overdo = null, steer = null) {
  const m = typeof mood === 'string' ? moodOf(mood) : mood ?? MOODS[0];
  const f = flavour ?? settleFlavour({});
  const v = { ...m, mode: f.drive, hz: f.hz, Q: f.Q };
  if (overdo && OVERDO[overdo]) Object.assign(v, OVERDO[overdo].set);
  const s = steer ?? {};
  if (Number.isFinite(s.reverb)) v.reverb = c01(s.reverb) * CAPS.reverb[1];
  if (Number.isFinite(s.delay)) v.delay = c01(s.delay) * CAPS.delay[1];
  if (Number.isFinite(s.drive)) v.drive = c01(s.drive) * CAPS.drive[1];
  if (Number.isFinite(s.tone)) v.tone = toneOf(s.tone);
  // lane DJOVERDRIVE: a steered overdrive is the bus's valve blend in every mood (0 takes it off)
  if (Number.isFinite(s.overdrive)) { v.tube = c01(s.overdrive) * CAPS.tube[1]; v.tubeGain = Math.max(v.tubeGain ?? 1, 3.5); }
  return clampFx(v);
}

// THE VOICE COLOUR's amounts from the settle (lane DJOVERDRIVE): a hotter, more agitated field drives harder
export function voiceDriveOf(flavour, steer = null) {
  const a = c01(flavour?.agitation);
  const amount = Number.isFinite(steer?.overdrive) ? c01(steer.overdrive) : +(0.55 + 0.35 * a).toFixed(3);
  return { amount, gain: +(3 + 3 * a).toFixed(3) };
}
// a set's vocoder: a warble's rate and depth come from the set's own stream, so a replayed seed warbles the same
export function vocoderOf(kind, r, steer = null) {
  const warble = kind === 'warble';
  const amount = Number.isFinite(steer?.vocoder) ? c01(steer.vocoder) * 0.85 : 0.7;
  return { amount, warble, rate: +(0.35 + 0.25 * r).toFixed(3), depth: +(0.0045 + 0.0025 * r).toFixed(5) };
}

const covered = (steer, kind) => Number.isFinite(steer?.[KIND_STEER[kind]]);

export function createDjFx({ seed = 1, random = null } = {}) {
  const opts = typeof random === 'function' ? { random } : { seed: (Number(seed) >>> 0) || 1 };
  // the mood bag deals the nine moods; OVERDRIVE comes from its own deck (lane DJOVERDRIVE)
  const moods = createBag(DEALT_MOODS, { ...opts, first: 'warm-room' });
  // six calm cards and one OVER: one phrase in seven, and never two in a row (the seam rule)
  const calm = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
  const overDeck = createBag([...calm, 'over'], { ...opts, first: 'c1' });
  const kinds = createBag(OVERDO_KINDS, opts);
  // THE WEATHER (lane SOUNDSHAKE): one profile a phrase, from its own deck
  const weathers = createBag(WEATHER_KEYS, { ...opts, first: HELD_WEATHER });
  // THE DJ's COLOUR (lane DJOVERDRIVE): its decks, each its own stream so adding one never moves the others' deals
  const sub = (salt) => (typeof random === 'function' ? { random } : { seed: ((Number(seed) >>> 0) ^ salt) >>> 0 || 1 });
  const odDeck = createBag(OVERDRIVE_DECK.cards, { ...sub(0x0d0d), weights: OVERDRIVE_DECK.weights, first: 'calm' });
  const voiceDeck = createBag(VOICE_DRIVE_DECK.cards, { ...sub(0x7a11), weights: VOICE_DRIVE_DECK.weights });
  const pureDeck = createBag(PURE_DRIVE_DECK.cards, { ...sub(0xf1e7), weights: PURE_DRIVE_DECK.weights, first: 'none' });
  const vocDeck = createBag(VOCODER_DECK.cards, { ...sub(0x70c0), weights: VOCODER_DECK.weights });
  const vocVoiceDeck = createBag(VOCODER_VOICE_DECK.cards, { ...sub(0x5eec), weights: VOCODER_VOICE_DECK.weights });
  const pickRng = typeof random === 'function' ? random : deckRng(((Number(seed) >>> 0) ^ 0x91c4) >>> 0 || 1);
  let weather = HELD_WEATHER;
  let mood = null;
  let barIn = 0;
  let phrase = 0;
  let phrasesInMood = 0;
  let overdo = null;
  let overdrive = false;
  let flavour = settleFlavour({});
  let held = false;
  let pure = false;
  let pureBar = 0;
  let colour = { drive: null, vocoder: null };
  let setVocoder = null;
  let vocoderDealt = false;
  let values = fxValues(MOODS[0], flavour);
  const counts = { phrases: 0, overdone: 0, overdrive: 0, voiceDrive: 0, pureDrive: 0, vocoder: 0 };

  // the voice colour for this phrase: a phrase of OVERDRIVE drives the whole bus, so no single voice is pushed on it
  function dealColour(s) {
    let drive = null;
    if (!overdrive) {
      const card = voiceDeck.next();
      if (card !== 'none') drive = { voice: card, pick: Math.floor(pickRng() * 4), ...voiceDriveOf(flavour, s) };
    }
    if (s.overdrive === 0) drive = null;
    if (drive) counts.voiceDrive += 1;
    let vocoder = setVocoder ? { ...setVocoder } : null;
    if (s.vocoder === 0) vocoder = null;
    else if (Number.isFinite(s.vocoder) && s.vocoder > 0 && !vocoder) vocoder = { voice: 'lead', pick: 0, ...vocoderOf('steady', 0, s) };
    else if (vocoder && Number.isFinite(s.vocoder)) vocoder.amount = vocoderOf('steady', 0, s).amount;
    colour = { drive, vocoder };
  }
  // a set's vocoder: dealt at a new set (and at the visit's first phrase), held for the whole set
  function dealVocoder() {
    vocoderDealt = true;
    const kind = vocDeck.next();
    if (kind === 'none') { setVocoder = null; return; }
    counts.vocoder += 1;
    setVocoder = { voice: vocVoiceDeck.next(), pick: Math.floor(pickRng() * 4), ...vocoderOf(kind, pickRng()) };
  }

  function startPhrase(newSet, inputs, steer) {
    phrase += 1;
    counts.phrases += 1;
    let changed = false;
    if (!mood || newSet || phrasesInMood >= MOOD_PHRASES) {
      mood = moods.next();
      phrasesInMood = 0;
      changed = true;
    }
    phrasesInMood += 1;
    flavour = settleFlavour(inputs);
    weather = weathers.next();
    // THE OVERDRIVE DECK (lane DJOVERDRIVE): one phrase in five; a steered overdrive of 0 never deals it
    overdrive = odDeck.next() === 'over' && steer.overdrive !== 0;
    if (overdrive) counts.overdrive += 1;
    if (newSet || !vocoderDealt) dealVocoder();
    dealColour(steer);
    overdo = null;
    if (overDeck.next() === 'over') {
      // the kind deck, skipping a kind the visitor's steering already holds
      for (let i = 0; i < OVERDO_KINDS.length; i++) {
        const k = kinds.next();
        if (!covered(steer, k)) { overdo = k; break; }
      }
      if (overdo) counts.overdone += 1;
    }
    return changed;
  }

  // the bus follows a steered mood; the state names the dealt mood, or OVERDRIVE when it is heard (a steered mood
  // takes the bus, so OVERDRIVE is then dealt but not heard, and not named)
  let steeredMood = false;
  const shownKey = (s) => (BY_KEY.has(s.mood) ? s.mood : overdrive ? OVERDRIVE_MOOD : mood);

  return {
    // pure: the McKusker flute plays (lane DJOVERDRIVE): the bus stays dry, and its own deck may push the flute
    bar({ newSet = false, inputs = {}, hold = false, steer = null, pure: isPure = false } = {}) {
      const s = steer && typeof steer === 'object' ? steer : {};
      if (hold) {
        // the opening blend and the pure flute pass DRY (their own channels already carry their rooms, and the
        // opener's 40 Hz pulses must not be smeared); the decks do not move
        held = true;
        barIn = 0;
        overdo = null;
        overdrive = false;
        // a steered overdrive never reaches a held bus (the valve would smear the opener's pulses and push the pure
        // flute's room); on the McKusker flute it rides the voice instead
        values = fxValues(DRY, flavour, null, { ...s, overdrive: null });
        // THE McKUSKER FLUTE's own overdrive: one phrase in four, from its own deck; the opener holds every colour off
        if (isPure) {
          if (!pure || pureBar === 0) {
            const d = pureDeck.next() === 'flute' && s.overdrive !== 0 ? { voice: 'flute', pick: 0, ...voiceDriveOf(flavour, s) } : null;
            if (d) counts.pureDrive += 1;
            colour = { drive: d, vocoder: null };
          }
          pure = true;
          pureBar = (pureBar + 1) % PHRASE_BARS;
        } else { pure = false; pureBar = 0; colour = { drive: null, vocoder: null }; }
        return this.state;
      }
      pure = false;
      pureBar = 0;
      let changed = false;
      if (held || newSet) { barIn = 0; held = false; }
      if (barIn === 0) changed = startPhrase(newSet, inputs, s);
      barIn = (barIn + 1) % PHRASE_BARS;
      steeredMood = BY_KEY.has(s.mood);
      values = fxValues(moodOf(shownKey(s)), flavour, overdo, s);
      return { ...this.state, changed };
    },
    get state() {
      const heard = !held && overdrive && !steeredMood;
      const shown = held ? moodOf('clean') : heard ? moodOf(OVERDRIVE_MOOD) : moodOf(mood);
      const sky = weatherOf(held ? HELD_WEATHER : weather);
      return {
        mood: shown.key,
        moodLabel: shown.label,
        baseMood: held ? 'clean' : mood ?? 'clean',
        overdrive: heard,
        overdo,
        overdoLabel: overdo ? OVERDO[overdo].label : null,
        weather: sky.key,
        weatherLabel: sky.label,
        weatherHard: !held && !!overdo,
        held,
        pure,
        colour: { drive: colour.drive ? { ...colour.drive } : null, vocoder: colour.vocoder ? { ...colour.vocoder } : null },
        flavour: { ...flavour },
        values: { ...values },
        phrase,
        barInPhrase: barIn,
        counts: { ...counts },
      };
    },
  };
}

export function curveFor(mode = 'soft', n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    // each curve has slope 1 at 0 and |c(x)| <= |x| (crush rounds within half a step), so no shaper adds level
    if (mode === 'fold') c[i] = Math.sin(4 * x) / 4;
    else if (mode === 'crush') { const L = 8; const y = Math.round(x * L) / L; c[i] = Math.abs(y) > Math.abs(x) ? Math.trunc(x * L) / L : y; }
    else c[i] = Math.tanh(3 * x) / 3;
  }
  return c;
}

// THE DRIVE'S LOUDNESS MATCH: the post gain that brings a sine at a typical bus level (DRIVE_REF, about the hero's
// voices) out at the RMS it went in with, for this mode and pre gain. So a harder drive changes the character and
// not the loudness; its new peaks are the bus limiter's job
export const DRIVE_REF = 0.12;
const curveAt = (mode, x) => {
  const v = Math.max(-1, Math.min(1, x));
  if (mode === 'fold') return Math.sin(4 * v) / 4;
  if (mode === 'crush') { const L = 8; const y = Math.round(v * L) / L; return Math.abs(y) > Math.abs(v) ? Math.trunc(v * L) / L : y; }
  return Math.tanh(3 * v) / 3;
};
export function driveMakeup(mode = 'soft', gain = 1, level = DRIVE_REF) {
  let si = 0;
  let so = 0;
  for (let i = 0; i < 256; i++) {
    const x = level * Math.sin((2 * Math.PI * (i + 0.5)) / 256);
    const y = curveAt(mode, gain * x);
    si += x * x;
    so += y * y;
  }
  return so > 0 ? Math.min(2, Math.sqrt(si / so)) : 1;
}

export const BUS_LIMIT = Object.freeze({ threshold: -6, knee: 0, ratio: 20, attack: 0.003, release: 0.25 });
// a Web Audio DynamicsCompressor adds its own makeup gain, (1 / the curve's gain at 0 dBFS) ^ 0.6, which would lift
// every quiet passage (measured: +6.8 dB at a -12 dB threshold); the bus takes it back after the limiter, so the
// limiter only ever holds peaks and the desk never raises the level it was given
export function limiterMakeupDb({ threshold, ratio } = BUS_LIMIT) {
  const atFullScale = threshold + (0 - threshold) / ratio;
  return -atFullScale * 0.6;
}
export const TAU = Object.freeze({ mood: 0.6, into: 0.35, out: 1.2, time: 0.8 });

// THE WOBBLE (lane SOUNDSHAKE): the delay line's resting time, the two LFOs' rates, and their most at wobble 1. A
// vibrato of depth d seconds at f Hz bends the pitch by at most 2 pi f d: 2 pi x 5.2 x 0.00045 = 1.47%, 25 cents
export const WOBBLE_STAGE = Object.freeze({ baseMs: 6, vibratoHz: 5.2, vibratoMs: 0.45, tremoloHz: 3.7, tremolo: 0.22, tau: 0.12 });

// the trim against the wet returns: measured offline (tools/djfx_levels.py) so every mood and every overdo lands
// within a few dB of CLEAN and never above the old dry path
export function trimFor(v) {
  return 1 / (1 + 0.3 * v.reverb + 0.35 * v.delay * (1 + v.feedback) + 0.1 * (v.res / 9));
}

export function createFxBus(E, { out = null } = {}) {
  const { ctx } = E;
  const g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const all = [];
  const keep = (n) => { all.push(n); return n; };
  // THE SPINE, built at once and cheap: input -> dry drive path -> sum -> resonance (peaking, 0 dB = transparent) ->
  // tone (lowpass) -> dry -> mix -> trim -> the bus limiter -> out
  const input = keep(g(1));
  const dryDrive = keep(g(1));
  const sum = keep(g(1));
  input.connect(dryDrive);
  dryDrive.connect(sum);
  const res = keep(ctx.createBiquadFilter());
  res.type = 'peaking';
  res.frequency.value = 900;
  res.Q.value = 1.4;
  res.gain.value = 0;
  const tone = keep(ctx.createBiquadFilter());
  tone.type = 'lowpass';
  tone.frequency.value = 18000;
  tone.Q.value = 0.7071;
  // THE TUBE (lane DJOVERDRIVE): sum -> a direct gain -> resonance until the OVERDRIVE mood first asks for the valve;
  // then the valve stage (dj-colour-stage.js createTube, oversampled, its dry leg latency-matched) takes over in 30 ms
  const tubeDirect = g(1);
  all.push(tubeDirect);
  sum.connect(tubeDirect);
  tubeDirect.connect(res);
  res.connect(tone);
  const mix = keep(g(1));
  const dry = keep(g(1));
  tone.connect(dry);
  dry.connect(mix);
  const trim = keep(g(1));
  const limit = keep(ctx.createDynamicsCompressor());
  for (const [k, v] of Object.entries(BUS_LIMIT)) limit[k].value = v;
  // THE WOBBLE (lane SOUNDSHAKE): a short delay line and a gain before the limiter, still at rest
  const wob = keep(ctx.createDelay(0.05));
  wob.delayTime.value = WOBBLE_STAGE.baseMs / 1000;
  const trem = keep(g(1));
  // THE DUCK (lane DROPDUCK): a gain after THE WOBBLE and before the limiter, at 1 until a drop dips it
  const duckNode = keep(g(1));
  mix.connect(trim);
  trim.connect(wob);
  wob.connect(trem);
  trem.connect(duckNode);
  duckNode.connect(limit);
  const unmake = keep(g(10 ** (-limiterMakeupDb(BUS_LIMIT) / 20)));
  limit.connect(unmake);
  unmake.connect(out ?? E.master);
  const nodes = { input, dryDrive, sum, tubeDirect, tube: null, res, tone, dry, mix, trim, wob, trem, duck: duckNode, vib: null, vibDepth: null, tremLfo: null, tremDepth: null, limit, unmake, pre: null, shapers: null, modeGain: null, roomSend: null, hallSend: null, room: null, hall: null, dSend: null, delay: null, dark: null, fb: null, dOut: null };

  // THE SECTIONS, each built the first time its amount is above zero and kept: a muted page, the pure flute and the
  // opening blend build no shaper, no convolver and no delay line at all
  // THE DRIVE: three shapers always running once built, crossfaded by gain (a mode change never swaps a curve)
  function buildDrive() {
    if (nodes.pre) return;
    nodes.pre = keep(g(1));
    input.connect(nodes.pre);
    nodes.shapers = {};
    nodes.modeGain = {};
    for (const m of DRIVE_MODES) {
      const sh = keep(ctx.createWaveShaper());
      sh.curve = curveFor(m.key);
      sh.oversample = 'none'; // in parallel with the dry path: an oversampled shaper's latency would comb against it
      const post = keep(g(0));
      nodes.pre.connect(sh);
      sh.connect(post);
      post.connect(sum);
      nodes.shapers[m.key] = sh;
      nodes.modeGain[m.key] = post;
    }
  }
  // THE TUBE: built on the first valve blend above zero, handed over from the direct path without a click
  function buildTube(t) {
    if (nodes.tube) return;
    // the valve's module loads on demand (dj-colour.js loadColour); until it arrives the bus plays the mood without
    // its valve, and the next bar's apply builds it
    const C = colourNow();
    if (!C) { loadColour().catch(() => { /* a later bar tries again */ }); return; }
    const { handover } = C;
    nodes.tube = C.createTube(ctx);
    sum.connect(nodes.tube.input);
    nodes.tube.output.connect(res);
    handover(ctx, tubeDirect.gain, nodes.tube.output.gain, t);
  }
  // THE REVERB: a room and a hall from the engine's impulse generator, crossfaded by size
  function buildReverb() {
    if (nodes.room) return;
    nodes.room = keep(ctx.createConvolver());
    nodes.room.buffer = impulse(ctx, 1.1, 4);
    nodes.hall = keep(ctx.createConvolver());
    nodes.hall.buffer = impulse(ctx, 3.6, 2.4);
    nodes.roomSend = keep(g(0));
    nodes.hallSend = keep(g(0));
    tone.connect(nodes.roomSend);
    tone.connect(nodes.hallSend);
    nodes.roomSend.connect(nodes.room);
    nodes.hallSend.connect(nodes.hall);
    nodes.room.connect(mix);
    nodes.hall.connect(mix);
  }
  // THE DELAY: tempo-synced, feedback capped below 1, a lowpass in the loop so the repeats darken and die
  function buildDelay() {
    if (nodes.delay) return;
    nodes.dSend = keep(g(0));
    nodes.delay = keep(ctx.createDelay(2));
    nodes.delay.delayTime.value = 0.375;
    nodes.dark = keep(ctx.createBiquadFilter());
    nodes.dark.type = 'lowpass';
    nodes.dark.frequency.value = 3000;
    nodes.fb = keep(g(0));
    nodes.dOut = keep(g(0.8));
    tone.connect(nodes.dSend);
    nodes.dSend.connect(nodes.delay);
    nodes.delay.connect(nodes.dark);
    nodes.dark.connect(nodes.fb);
    nodes.fb.connect(nodes.delay);
    nodes.dark.connect(nodes.dOut);
    nodes.dOut.connect(mix);
  }

  // THE WOBBLE's two LFOs, built on the first wobble above zero
  function buildWobble() {
    if (nodes.vib) return;
    nodes.vib = keep(ctx.createOscillator());
    nodes.vib.type = 'sine';
    nodes.vib.frequency.value = WOBBLE_STAGE.vibratoHz;
    nodes.vibDepth = keep(g(0));
    nodes.vib.connect(nodes.vibDepth);
    nodes.vibDepth.connect(wob.delayTime);
    nodes.tremLfo = keep(ctx.createOscillator());
    nodes.tremLfo.type = 'sine';
    nodes.tremLfo.frequency.value = WOBBLE_STAGE.tremoloHz;
    nodes.tremDepth = keep(g(0));
    nodes.tremLfo.connect(nodes.tremDepth);
    nodes.tremDepth.connect(trem.gain);
    try { nodes.vib.start(); nodes.tremLfo.start(); } catch { /* started already */ }
  }
  let wobbled = 0;

  let last = null;
  const bus = {
    input,
    nodes,
    get wobbled() { return wobbled; },
    // THE WOBBLE: x 0..1 (pulse.js soundWobble), ramped; the tremolo's gain stays at or under 1
    wobble(x, t = ctx.currentTime) {
      const w = Number.isFinite(+x) ? Math.min(1, Math.max(0, +x)) : 0;
      if (w > 0) buildWobble();
      wobbled = w;
      if (!nodes.vib) return w;
      const d = WOBBLE_STAGE.tremolo * w;
      ramp(nodes.vibDepth.gain, (WOBBLE_STAGE.vibratoMs / 1000) * w, t, WOBBLE_STAGE.tau);
      ramp(nodes.tremDepth.gain, d / 2, t, WOBBLE_STAGE.tau);
      ramp(trem.gain, 1 - d / 2, t, WOBBLE_STAGE.tau);
      return w;
    },
    // THE DUCK (lane DROPDUCK, duck.js): one drop's dip on this bus from time t; false if it could not be scheduled
    duck(t = ctx.currentTime) {
      return scheduleDuck(duckNode.gain, Number.isFinite(t) ? t : ctx.currentTime);
    },
    get values() { return last ? { ...last } : null; },
    apply(values, t = ctx.currentTime, { tau = TAU.mood, beatDur = 0.5 } = {}) {
      const v = clampFx(values);
      last = v;
      const wet = v.drive;
      if (wet > 0) buildDrive();
      if (v.reverb > 0) buildReverb();
      if (v.delay > 0) buildDelay();
      ramp(dryDrive.gain, 1 - wet, t, tau);
      if (nodes.pre) {
        ramp(nodes.pre.gain, v.gain, t, tau);
        // each shaper's post gain matches its loudness to the dry path's (driveMakeup), so the mix of the two holds level
        for (const m of DRIVE_MODES) ramp(nodes.modeGain[m.key].gain, m.key === v.mode ? wet * driveMakeup(m.key, v.gain) : 0, t, tau);
      }
      // THE TUBE: the valve's blend and push (never louder: tube(g x) / g is at or under |x| at every sample)
      if (v.tube > 0) buildTube(t);
      if (nodes.tube) nodes.tube.set(v.tube, v.tubeGain, t, tau);
      ramp(res.frequency, v.hz, t, tau);
      ramp(res.Q, v.Q, t, tau);
      ramp(res.gain, v.res, t, tau);
      ramp(tone.frequency, v.tone, t, tau);
      if (nodes.room) {
        ramp(nodes.roomSend.gain, v.reverb * (1 - v.size), t, tau);
        ramp(nodes.hallSend.gain, v.reverb * v.size * 0.8, t, tau);
      }
      if (nodes.delay) {
        ramp(nodes.dSend.gain, v.delay, t, tau);
        ramp(nodes.fb.gain, Math.min(FEEDBACK_CAP, v.feedback), t, tau);
        ramp(nodes.delay.delayTime, Math.min(1.9, Math.max(0.05, v.time * (Number.isFinite(beatDur) && beatDur > 0 ? beatDur : 0.5))), t, TAU.time);
      }
      // the wet returns add level; the trim takes it back (a full overdo of any one kind still lands near unity)
      ramp(trim.gain, trimFor(v), t, tau);
      return v;
    },
    dispose() {
      offWobble();
      offDuck();
      nodes.tube?.dispose();
      for (const n of all) {
        try { n.stop?.(); } catch { /* not started */ }
        try { n.disconnect(); } catch { /* already gone */ }
      }
    },
  };
  // the page's wobble reaches every live DJ bus (pulse.js soundWobble)
  const offWobble = registerWobbleTarget(bus);
  // and every drop's duck (duck.js duckDrop)
  const offDuck = registerDuckTarget(bus);
  return bus;
}
