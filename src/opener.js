// settle-hear · opener - THE OPENING BLEND: the first set of every visit. Never house: no drums, no beats. Soft pure
// and harmonic tones, isochronic pulses at the alpha, theta and Schumann rates and a gentle 40 Hz pulse, a warm pad,
// blended along one fixed arc whose details are settled fresh each visit. Then it hands over to the DJ's first set.
//
// <claudes_code_comments>
// ** Function List **
// OPENER                     - the fixed numbers: the length range (240 to 420 s), the handover range (24 to 40 s),
//                              the yield fade, the level ceilings, the pulse shapes, the settle's cooling
// OPENER_SLOTS               - THE ARC: seven slots in a fixed order, each { key, label, line, share: [lo, hi] }
// OPENER_RATES               - the three slow rates the rate slots hold: alpha 10, theta 6, schumann 7.83 (Hz), with
//                              their sources; GAMMA_RATE 40 (Hz), always in the gamma slot
// RATE_ORDERS                - the six orders of the three slow rates (a deck deals one per visit)
// OPENER_TIMBRES             - the tone colours a tone may wear: harmonic partial lists (pure, warm, hollow, glass,
//                              reed)
// HARM_RATIOS / GAMMA_MULTS / PAD_CUTS / BELL_GAPS / KEY_SHIFTS - the other settled choices' candidates
// settlePick(cands, G, r, opts) - one choice settled: p ~ exp(-G / T) sampled as T cools from hot to cold; the trace
// settleOpener({ seed, theme, last }) - the visit's choices: decks deal the rate order and the timbres (never last
//                              visit's), a settle picks the length, the slot shares, the key shift, the ratios, the
//                              gamma carrier, the pad and the bells
// openerPlan(choices)        - the choices -> the full plan: slot times, base frequency, every voice's envelope as
//                              breakpoints, the glide, the bells; pure, deterministic
// envAt(points, t)           - a breakpoint list read at time t (linear between points, held at the ends)
// openerSlotAt(plan, t)      - the slot playing at opener time t (or 'handover' / 'done')
// pulseShape(rate, sr)       - one isochronic period's envelope: { period, on, ramp } in samples (raised-cosine edges)
// isoSamples(sr, rate, carrier, periods) - Float32Array: a carrier gated `periods` times at `rate`, every burst with
//                              raised-cosine edges and its sine started at phase zero; loops seamlessly (ends silent)
// maxStep(samples)           - the largest sample-to-sample step (the click test)
// softClipCurve(c)           - the opener's limiter curve: y = c tanh(x / c)
// openerBellVoice(plan)      - the bells' voice chain (lane MELODYFX2): the 'gentle' profile, dealt from the visit's
//                              own seed, so a plan always rings through the same chain
// openerVoices(ctx, out, plan, opts) - the voices on a context: { schedule(t0, from, to), yieldAt(t, at, fade),
//                              stop(t), dispose(), peak, bellVoice }; works on an AudioContext and an
//                              OfflineAudioContext
// openerVisit / resetOpenerVisit() - THE VISIT RECORD: one opener per page load; a remounted player resumes it
// readOpenerMemory(store) / writeOpenerMemory(store, choices) - last visit's choices (guarded storage), so the decks
//                              never deal the same order twice running
//
// ** Technical Review **
// - THE ARC (fixed, the same shape every visit): silence -> one soft tone fades in -> the first slow isochronic
//   pulse -> a second harmonic tone and the pad join -> the second slow rate takes over -> the 40 Hz pulse enters
//   gently -> the bloom (the third slow rate, every voice, a few soft bells) -> the ease (the voices thin, the tones
//   glide to the DJ's key). After the arc, THE HANDOVER: the opener's tail fades over 24 to 40 s while the DJ's
//   first set fades in under it.
// - WHAT VARIES (settled per visit): the length (240 to 420 s, the navigator's 4 to 7 minutes), each slot's share
//   inside its range, the key (the theme's root, a fourth or a fifth above, moved into 100 .. 230 Hz), the order of
//   alpha, theta and Schumann in the three rate slots, the timbre of the first tone and of the harmonic tone, the
//   harmonic tone's ratio (a fifth, an octave, a twelfth), the 40 Hz pulse's carrier, the pad's brightness, the
//   bells' spacing, and the handover's length.
// - THE SETTLE: each choice has a cost G per candidate (a mild pull to the middle of its range, plus a novelty cost
//   when it equals last visit's choice); the pick samples p ~ exp(-G / T) through OPENER.steps temperatures cooling
//   from OPENER.hot to OPENER.cold and keeps the last sample. THE DECK RULE deals the rate order and the timbres:
//   createBag(..., { after: last visit's deal }), so a returning visitor never gets the same order twice in a row.
// - THE RATES: an isochronic pulse is one tone switched on and off cleanly at the rate. Every rate is an amplitude
//   pulse of an audible tone (the carriers sit at 200 Hz and above); no tone below 40 Hz is ever played (THE RULE of
//   fx-hum.js). Slow pulses (6 to 10 Hz) are on for half the period with raised-cosine edges each a third of the on
//   time: a soft throb. The 40 Hz pulse is on 12.5 ms of 25 with 3 ms edges (binaural.js keeps 1.5 ms for its
//   stimulus; the opener is softer).
// - THE ENVELOPES are breakpoint lists in opener seconds. schedule(t0, from, to) writes, for each voice gain, a
//   setValueAtTime of the envelope's value at `from` and a linear ramp to every breakpoint inside (from, to] and to
//   the value at `to`: the automation is the envelope itself, continuous, so a bar boundary never steps. A yield
//   cancels ahead and ramps every voice from its value now to 0 over the fade.
// - THE LEVELS: every voice's own oscillator or buffer peaks at 1; the envelopes' sum never exceeds OPENER.maxSum
//   (0.62); the voices pass the opener's own limiter (a soft clip y = 0.8 tanh(x / 0.8): unity for quiet signals, no
//   makeup gain) and then the channel, the master, MUTE ALL and the page limiter like every sound here.
// - THE BELLS' CHAIN (lane MELODYFX2): the bloom's pentatonic bells are the one voice here that carries a tune, so
//   they ring through a voice chain like every melody: a soft tape drive (the tape curve at drive 1.2 to 1.5, no
//   makeup, so a 0.045 bell stays in the curve's straight part) and two to four calm effects from the 'gentle'
//   profile (tape wow, drifting low-pass, ensemble or chorus, a slow tremolo at 0.5 to 1.4 Hz, a warm room, plate or
//   hall, a long soft tape delay), never a crush, a ring or any grit. The chain is built when the first bell rings,
//   dealt from the visit's own seed (openerBellVoice), given one static bar of THE MASTER BEAT's tempo, and trimmed
//   back to the bells' dry level (voice-fx.js LEVEL_MATCH_DB: the gentle chains cost 5.9 dB on average). The two
//   held tones, the pad and the four isochronic loops stay pure: none carries a tune, and an effect on an
//   isochronic pulse would smear the clean on-off edges the pulse is made of.
// - No health effect is claimed for any rate: the rates are the ones the binaural apps and videos use
//   (runs/binauralmodes/BINAURAL_MODES_SURVEY.md) and the 40 Hz rhythm studied in gamma research
//   (wikis/WIKI_OLD_MELODIES/04-TUNING-432-AND-BINAURAL.md §6-7).
// </claudes_code_comments>

import { createBag, deckRng } from './deck.js';
import { midiHz, noteMidi } from './tuning.js';
import { themeOf } from './themes.js';
import { masterGrid } from './masterbeat.js';
import { createVoiceDealer, createVoiceBus, OPENER_VOICE_SLOTS, LEVEL_MATCH_DB, levelTrim } from './voice-fx.js';

export const OPENER = Object.freeze({
  minSeconds: 240,
  maxSeconds: 420,
  handover: [24, 40],
  yieldFade: 2.5,
  maxSum: 0.62,
  steps: 8,
  hot: 2.0,
  cold: 0.15,
  novelty: 1.6,
  baseLo: 100,
  baseHi: 230,
  slowDuty: 0.5,
  slowRamp: 1 / 3,
  gammaOnMs: 12.5,
  gammaRampMs: 3,
  ceiling: 0.8,
});

// THE ARC: the order never changes; each slot's share of the length is settled inside its range
export const OPENER_SLOTS = Object.freeze([
  { key: 'silence', label: 'silence, then one soft tone', line: 'from silence a single soft tone fades in', share: [0.06, 0.09] },
  { key: 'rate-1', label: 'the first slow pulse', line: 'an isochronic pulse fades in on a harmonic of the tone', share: [0.14, 0.18], rate: 0 },
  { key: 'harmonic', label: 'a harmonic tone joins', line: 'a second harmonic tone and a warm pad join', share: [0.12, 0.16] },
  { key: 'rate-2', label: 'the second slow pulse', line: 'the second slow rate takes over from the first', share: [0.14, 0.18], rate: 1 },
  { key: 'gamma', label: 'the 40 Hz pulse enters', line: 'a gentle 40 Hz isochronic pulse enters, very soft', share: [0.1, 0.14] },
  { key: 'bloom', label: 'the blend blooms', line: 'the third slow rate, every voice, the pad open, a few soft bells', share: [0.2, 0.26], rate: 2 },
  { key: 'ease', label: 'the blend eases', line: 'the voices thin and the tones glide to the DJ\'s key', share: [0.1, 0.14] },
]);
export const SLOT_KEYS = OPENER_SLOTS.map((s) => s.key);

export const OPENER_RATES = Object.freeze({
  alpha: { hz: 10, label: 'alpha 10 Hz', source: 'the binaural apps\' default (runs/binauralmodes/BINAURAL_MODES_SURVEY.md §2, §4); settle-hear modes.js ALPHA CALM' },
  theta: { hz: 6, label: 'theta 6 Hz', source: 'the apps\' theta preset (BINAURAL_MODES_SURVEY.md §2, §4); modes.js THETA DEEP' },
  schumann: { hz: 7.83, label: 'Schumann 7.83 Hz', source: 'the Schumann rows of BINAURAL_MODES_SURVEY.md §1; a sound at 7.83 Hz is not the Earth\'s resonance (§5)' },
});
export const RATE_KEYS = Object.keys(OPENER_RATES);
export const GAMMA_RATE = 40;
export const GAMMA_SOURCE = 'the 40 Hz rhythm of gamma research: Galambos et al. 1981 (the 40 Hz auditory steady-state response), Martorell et al. 2019 (40 Hz click trains, mice); wikis/WIKI_OLD_MELODIES/04-TUNING-432-AND-BINAURAL.md §6-7';

const perms = (a) => (a.length <= 1 ? [a.slice()] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
export const RATE_ORDERS = Object.freeze(perms(RATE_KEYS).map((p) => Object.freeze(p)));

// tone colours as harmonic partial amplitudes (partial 1 first); a PeriodicWave is built from them
export const OPENER_TIMBRES = Object.freeze({
  pure: [1],
  warm: [1, 0.35, 0.12, 0.05],
  hollow: [1, 0, 0.22, 0, 0.07],
  glass: [1, 0, 0, 0.22, 0, 0, 0, 0.06],
  reed: [1, 0.45, 0.25, 0.12, 0.06],
});
export const TIMBRE_KEYS = Object.keys(OPENER_TIMBRES);
export const HARM_RATIOS = [1.5, 2, 3];
export const GAMMA_MULTS = [2, 3, 4];
export const PAD_CUTS = [650, 900, 1200];
export const BELL_GAPS = [[10, 15], [7, 11], [5, 8]];
export const KEY_SHIFTS = [0, 5, 7];

// one choice settled: G per candidate, p ~ exp(-G / T) sampled while T cools; the last sample is the choice
export function settlePick(cands, G, r, { steps = OPENER.steps, hot = OPENER.hot, cold = OPENER.cold } = {}) {
  const g = cands.map((c, i) => G(c, i));
  const trace = [];
  let pick = 0;
  for (let k = 0; k < steps; k++) {
    const T = hot * Math.pow(cold / hot, steps > 1 ? k / (steps - 1) : 1);
    const lo = Math.min(...g);
    const w = g.map((x) => Math.exp(-(x - lo) / T));
    const sum = w.reduce((a, b) => a + b, 0);
    let u = r() * sum;
    pick = 0;
    while (pick < w.length - 1 && u >= w[pick]) { u -= w[pick]; pick += 1; }
    trace.push({ T, pick });
  }
  return { value: cands[pick], index: pick, G: g[pick], trace };
}

const sameOrder = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

// the visit's choices: decks for the order and the timbres, a settle for everything else
export function settleOpener({ seed = 1, theme = null, last = null } = {}) {
  const r = deckRng((Number(seed) >>> 0) || 1);
  const T = themeOf(theme?.key ?? theme);
  const novel = (v, was) => (was != null && (v === was || (Array.isArray(v) && sameOrder(v, was))) ? OPENER.novelty : 0);
  const lastOrder = last?.rateOrder ? RATE_ORDERS.find((o) => sameOrder(o, last.rateOrder)) : undefined;
  const orderDeck = createBag(RATE_ORDERS, { random: r, ...(lastOrder ? { after: lastOrder } : {}) });
  const rateOrder = orderDeck.next().slice();
  const firstDeck = createBag(TIMBRE_KEYS, { random: r, ...(TIMBRE_KEYS.includes(last?.timbreFirst) ? { after: last.timbreFirst } : {}) });
  const timbreFirst = firstDeck.next();
  const harmDeck = createBag(TIMBRE_KEYS, { random: r, ...(TIMBRE_KEYS.includes(last?.timbreHarm) ? { after: last.timbreHarm } : {}) });
  let timbreHarm = harmDeck.next();
  if (timbreHarm === timbreFirst) timbreHarm = harmDeck.next();
  // the length: 240 .. 420 s in 15 s steps, a mild pull to the middle, away from last visit's length
  const lengths = [];
  for (let s = OPENER.minSeconds; s <= OPENER.maxSeconds; s += 15) lengths.push(s);
  const mid = (OPENER.minSeconds + OPENER.maxSeconds) / 2;
  const length = settlePick(lengths, (L) => 0.25 * ((L - mid) / 60) ** 2 + (last?.length != null && Math.abs(L - last.length) < 30 ? OPENER.novelty : 0), r).value;
  // each slot's share: five points across its range, a pull to the middle
  const shares = OPENER_SLOTS.map((s) => {
    const pts = [0, 0.25, 0.5, 0.75, 1].map((f) => s.share[0] + f * (s.share[1] - s.share[0]));
    return settlePick(pts, (_, i) => 0.3 * (i - 2) ** 2, r).value;
  });
  const keyShift = settlePick(KEY_SHIFTS, (v) => novel(v, last?.keyShift), r).value;
  const harmRatio = settlePick(HARM_RATIOS, (v) => (v === 1.5 ? 0 : 0.1) + novel(v, last?.harmRatio), r).value;
  const gammaMult = settlePick(GAMMA_MULTS, (v) => (v === 3 ? 0 : 0.1) + novel(v, last?.gammaMult), r).value;
  const padCut = settlePick(PAD_CUTS, (v) => (v === 900 ? 0 : 0.1) + novel(v, last?.padCut), r).value;
  const bellGap = settlePick(BELL_GAPS.map((_, i) => i), (i) => (i === 1 ? 0 : 0.1) + novel(i, last?.bellGap), r).value;
  const handover = settlePick([24, 28, 32, 36, 40], (v) => 0.2 * ((v - 32) / 4) ** 2, r).value;
  const choiceSeed = Math.floor(r() * 4294967295) >>> 0;
  // durations in whole seconds, summing exactly to the length
  const sum = shares.reduce((a, b) => a + b, 0);
  const durations = shares.map((s) => Math.max(1, Math.round((s / sum) * length)));
  durations[durations.length - 1] += length - durations.reduce((a, b) => a + b, 0);
  return { v: 1, seed: choiceSeed, theme: T.key, durations, rateOrder, timbreFirst, timbreHarm, keyShift, harmRatio, gammaMult, padCut, bellGap, handover };
}

const into = (f, lo, hi) => { let x = f; while (x > hi) x /= 2; while (x < lo) x *= 2; return x; };

export function envAt(points, t) {
  if (!points.length) return 0;
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    if (t <= t1) {
      if (t === t1) return v1;
      const [t0, v0] = points[i - 1];
      return t1 > t0 ? v0 + ((v1 - v0) * (t - t0)) / (t1 - t0) : v1;
    }
  }
  return points[points.length - 1][1];
}

// the choices -> the plan: every time in opener seconds (0 = the first bar the opener plays)
export function openerPlan(c) {
  const T = themeOf(c.theme);
  const rootM = noteMidi(T.root);
  const rootHz = into(midiHz(Number.isFinite(rootM) ? rootM : 57), OPENER.baseLo, OPENER.baseHi);
  const f0 = into(rootHz * 2 ** ((c.keyShift ?? 0) / 12), OPENER.baseLo, OPENER.baseHi);
  // the glide target: the DJ's key (the theme root), in the octave nearest the opening tone
  let fEnd = rootHz;
  while (fEnd / f0 > Math.SQRT2) fEnd /= 2;
  while (f0 / fEnd > Math.SQRT2) fEnd *= 2;
  const d = c.durations;
  const s = [0];
  for (const x of d) s.push(s[s.length - 1] + x);
  const length = s[s.length - 1];
  const handover = c.handover;
  const end = length + handover;
  const slots = OPENER_SLOTS.map((sl, i) => ({ key: sl.key, label: sl.label, line: sl.line, start: s[i], end: s[i + 1], ...(sl.rate != null ? { rate: c.rateOrder[sl.rate] } : {}) }));
  const [S0, S1, S2, S3, S4, S5, S6] = s;
  const [d0, , d2, d3, d4, d5, d6] = d;
  const rates = c.rateOrder.map((k) => ({ key: k, hz: OPENER_RATES[k].hz }));
  const voices = {
    first: { kind: 'tone', timbre: c.timbreFirst, ratio: 1, env: [[0, 0], [S0 + 0.3 * d0, 0], [S1, 0.15], [S3, 0.13], [S5, 0.14], [S6, 0.13], [length, 0.07], [end, 0]] },
    harm: { kind: 'tone', timbre: c.timbreHarm, ratio: c.harmRatio, env: [[0, 0], [S2, 0], [S2 + 0.7 * d2, 0.09], [S5, 0.09], [S5 + 0.5 * d5, 0.1], [S6, 0.1], [length, 0.03], [end, 0]] },
    pad: { kind: 'pad', env: [[0, 0], [S2, 0], [S3, 0.1], [S5, 0.1], [S5 + 0.5 * d5, 0.13], [S6, 0.12], [length, 0.06], [end, 0]] },
    iso1: { kind: 'iso', rate: rates[0].hz, rateKey: rates[0].key, carrier: f0 * 2, env: [[0, 0], [S1, 0], [S1 + 0.6 * (S2 - S1), 0.11], [S3, 0.11], [S3 + 0.5 * d3, 0], [end, 0]] },
    iso2: { kind: 'iso', rate: rates[1].hz, rateKey: rates[1].key, carrier: f0 * 3, env: [[0, 0], [S3, 0], [S3 + 0.5 * d3, 0.1], [S5, 0.1], [S5 + 0.4 * d5, 0], [end, 0]] },
    iso3: { kind: 'iso', rate: rates[2].hz, rateKey: rates[2].key, carrier: f0 * 2, env: [[0, 0], [S5, 0], [S5 + 0.4 * d5, 0.1], [S6, 0.09], [length, 0], [end, 0]] },
    gamma: { kind: 'iso', rate: GAMMA_RATE, rateKey: 'gamma', carrier: into(f0 * c.gammaMult, 200, 520), env: [[0, 0], [S4, 0], [S4 + 0.8 * d4, 0.045], [S5, 0.045], [S5 + 0.5 * d5, 0.06], [S6, 0.055], [S6 + 0.6 * d6, 0.02], [length, 0], [end, 0]] },
  };
  // the glide: every tone and the pad move together from f0 to the DJ's key across the ease
  const glide = [[0, 1], [S6, 1], [length, fEnd / f0], [end, fEnd / f0]];
  const cut = c.padCut;
  const padCut = [[0, cut * 0.6], [S2, cut * 0.6], [S5, cut * 0.8], [S5 + 0.5 * d5, cut], [S6, cut], [length, cut * 0.5], [end, cut * 0.4]];
  // the bells: soft sine pings on the key's pentatonic, spaced by the settled gap, inside the bloom only
  const br = deckRng((c.seed >>> 0) || 1);
  const [gLo, gHi] = BELL_GAPS[c.bellGap] ?? BELL_GAPS[1];
  const PENTA = [0, 2, 4, 7, 9, 12];
  const bells = [];
  for (let t = S5 + 4 + br() * gLo; t < S6 - 5; t += gLo + br() * (gHi - gLo)) bells.push({ at: +t.toFixed(3), hz: f0 * 4 * 2 ** (PENTA[Math.floor(br() * PENTA.length) % PENTA.length] / 12) });
  return { v: 1, choices: c, theme: c.theme, f0, fEnd, length, handover, end, slots, voices, glide, padCut, bells, rates: c.rateOrder.slice() };
}

export function openerSlotAt(plan, t) {
  if (!plan) return null;
  if (t >= plan.end) return { key: 'done', label: 'done' };
  if (t >= plan.length) return { key: 'handover', label: 'the handover to the DJ', start: plan.length, end: plan.end };
  return plan.slots.find((s) => t >= s.start && t < s.end) ?? plan.slots[0];
}

// one isochronic period: on for a share of the period, raised-cosine edges
export function pulseShape(rate, sr) {
  const period = sr / rate;
  if (rate >= 20) {
    const on = Math.round((OPENER.gammaOnMs / 1000) * sr);
    return { period, on, ramp: Math.min(Math.floor(on / 2), Math.round((OPENER.gammaRampMs / 1000) * sr)) };
  }
  const on = Math.round(period * OPENER.slowDuty);
  return { period, on, ramp: Math.max(1, Math.round(on * OPENER.slowRamp)) };
}

// a carrier gated `periods` times at `rate`; every burst starts its sine at phase zero, rises and falls through
// raised-cosine edges and ends in silence, so the buffer loops without a seam
export function isoSamples(sr, rate, carrier, periods = null) {
  const { period, on, ramp } = pulseShape(rate, sr);
  const k = periods ?? Math.max(1, Math.round(rate * 2));
  const n = Math.round(k * period);
  const out = new Float32Array(n);
  for (let b = 0; b < k; b++) {
    const s0 = Math.round(b * period);
    for (let j = 0; j < on && s0 + j < n; j++) {
      const e = j < ramp ? 0.5 - 0.5 * Math.cos((Math.PI * j) / ramp) : j >= on - ramp ? 0.5 - 0.5 * Math.cos((Math.PI * (on - 1 - j)) / ramp) : 1;
      out[s0 + j] = e * Math.sin((2 * Math.PI * carrier * j) / sr);
    }
  }
  return out;
}

export function maxStep(x) {
  let m = 0;
  for (let i = 1; i < x.length; i++) m = Math.max(m, Math.abs(x[i] - x[i - 1]));
  return m;
}

// y = c tanh(x / c): slope 1 at 0 (quiet passes unchanged), never above c
export function softClipCurve(c = OPENER.ceiling, n = 2049) {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = c * Math.tanh(x / c); }
  return curve;
}

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };

// the breakpoints inside (from, to] plus the end value, as [time, value] in opener seconds
function segment(points, from, to) {
  const out = [];
  for (const [t, v] of points) if (t > from && t < to) out.push([t, v]);
  out.push([to, envAt(points, to)]);
  return out;
}

// THE BELLS' CHAIN (lane MELODYFX2): the gentle profile, dealt from the visit's seed (a plan gives one chain)
export function openerBellVoice(plan) {
  const seed = ((Number(plan?.choices?.seed) >>> 0) ^ 0xb311c4a1) >>> 0 || 1;
  return createVoiceDealer({ seed }).palette({ theme: plan?.theme ?? 'highlands', slots: OPENER_VOICE_SLOTS, profile: 'gentle' }).voices[0];
}

// the voices on a context: tones, the pad, four isochronic loops, the bells; one bus, the opener's limiter, `out`
export function openerVoices(ctx, out, plan, { startAt = ctx.currentTime } = {}) {
  const nodes = [];
  const srcs = [];
  const mk = (n) => { nodes.push(n); return n; };
  const bus = mk(ctx.createGain());
  bus.gain.value = 1;
  // the opener's own limiter: a soft clip at OPENER.ceiling (unity gain for quiet signals, so it adds no makeup gain
  // the way a DynamicsCompressor does); the page's master limiter sits after it as for every sound
  const lim = mk(ctx.createWaveShaper());
  lim.curve = softClipCurve(OPENER.ceiling);
  bus.connect(lim);
  lim.connect(out);
  const gains = {};
  const freqs = [];
  const waveOf = (key) => {
    const parts = OPENER_TIMBRES[key] ?? OPENER_TIMBRES.pure;
    const real = new Float32Array(parts.length + 1);
    const imag = new Float32Array(parts.length + 1);
    parts.forEach((a, i) => { imag[i + 1] = a; });
    try { return ctx.createPeriodicWave(real, imag); } catch { return null; }
  };
  const osc = (f, timbre, type = 'sine') => {
    const o = mk(ctx.createOscillator());
    o.type = type;
    if (timbre && timbre !== 'pure') { const w = waveOf(timbre); if (w && o.setPeriodicWave) o.setPeriodicWave(w); }
    o.frequency.value = f;
    o.start(startAt);
    srcs.push(o);
    return o;
  };
  const vgain = (name) => { const g = mk(ctx.createGain()); g.gain.value = 0; g.connect(bus); gains[name] = g; return g; };
  const V = plan.voices;
  // the tones
  for (const name of ['first', 'harm']) {
    const v = V[name];
    const o = osc(plan.f0 * v.ratio, v.timbre);
    o.connect(vgain(name));
    freqs.push({ param: o.frequency, base: plan.f0 * v.ratio });
  }
  // the pad: two gently detuned triangles an octave and a fifth below the tone, through a breathing low-pass
  const lp = mk(ctx.createBiquadFilter());
  lp.type = 'lowpass';
  lp.Q.value = 0.6;
  lp.frequency.value = envAt(plan.padCut, 0);
  const padG = vgain('pad');
  lp.connect(padG);
  for (const [ratio, det] of [[0.5, -4], [0.75, 4]]) {
    const o = osc(plan.f0 * ratio, null, 'triangle');
    o.detune.value = det;
    const g = mk(ctx.createGain());
    g.gain.value = 0.5;
    o.connect(g);
    g.connect(lp);
    freqs.push({ param: o.frequency, base: plan.f0 * ratio });
  }
  // the isochronic loops: rendered once, looped from the start time (a master bar line, so a 40 Hz burst starts on a
  // flash onset)
  for (const name of ['iso1', 'iso2', 'iso3', 'gamma']) {
    const v = V[name];
    const data = isoSamples(ctx.sampleRate, v.rate, v.carrier);
    const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.getChannelData(0).set(data);
    const src = mk(ctx.createBufferSource());
    src.buffer = buf;
    src.loop = true;
    src.connect(vgain(name));
    src.start(startAt);
    srcs.push(src);
  }
  // the bells' chain: built when the first bell rings, into the bus (so the opener's limiter still sits after it)
  let bellBus = null;
  const bellVoice = plan.bells?.length ? openerBellVoice(plan) : null;
  const bellInput = (tb) => {
    if (!bellBus) {
      bellBus = createVoiceBus(ctx, bus, { slot: OPENER_VOICE_SLOTS[0], trim: levelTrim(LEVEL_MATCH_DB['opener-bells']) });
      bellBus.set(bellVoice, tb, 0);
      bellBus.bar(tb, { beatDur: (masterGrid()?.barMs ?? 2000) / 4000, bar: 0, root: Math.round(69 + 12 * Math.log2(plan.f0 / 432)), chord: [], melody: [] });
    }
    return bellBus.input;
  };
  let peak = 0;
  let yielded = false;
  const schedule = (t0, from, to) => {
    if (yielded || !(to > from)) return;
    const T = (x) => t0 + (x - from);
    for (const [name, g] of Object.entries(gains)) {
      const env = V[name].env;
      const v0 = envAt(env, from);
      at(g.gain, v0, t0);
      peak = Math.max(peak, v0);
      for (const [t, v] of segment(env, from, to)) { lin(g.gain, v, T(t)); peak = Math.max(peak, v); }
    }
    for (const { param, base } of freqs) {
      at(param, base * envAt(plan.glide, from), t0);
      for (const [t, v] of segment(plan.glide, from, to)) lin(param, base * v, T(t));
    }
    at(lp.frequency, envAt(plan.padCut, from), t0);
    for (const [t, v] of segment(plan.padCut, from, to)) lin(lp.frequency, v, T(t));
    // the bells whose strike falls inside this chunk
    for (const b of plan.bells) {
      if (b.at < from || b.at >= to) continue;
      const tb = T(b.at);
      const o = mk(ctx.createOscillator());
      o.type = 'sine';
      o.frequency.value = b.hz * envAt(plan.glide, b.at);
      const g = mk(ctx.createGain());
      g.gain.value = 0;
      o.connect(g);
      g.connect(bellInput(tb));
      at(g.gain, 0, tb);
      lin(g.gain, 0.045, tb + 0.06);
      try { g.gain.exponentialRampToValueAtTime(0.0004, tb + 5); } catch { g.gain.value = 0.0004; }
      lin(g.gain, 0, tb + 5.2);
      o.start(tb);
      o.stop(tb + 5.4);
    }
  };
  // the opener yields: every voice from its value now to 0 over `fade`, no new chunk afterwards
  const yieldAt = (t, atPos, fade = OPENER.yieldFade) => {
    if (yielded) return;
    yielded = true;
    for (const [name, g] of Object.entries(gains)) {
      try { g.gain.cancelScheduledValues(t); } catch { /* fake */ }
      at(g.gain, envAt(V[name].env, atPos), t);
      lin(g.gain, 0, t + fade);
    }
  };
  let stopped = false;
  const stop = (t = ctx.currentTime) => {
    if (stopped) return;
    stopped = true;
    for (const s of srcs) { try { s.stop(t + 0.05); } catch { /* already */ } }
  };
  return {
    gains,
    nodes,
    schedule,
    yieldAt,
    stop,
    get yielded() { return yielded; },
    get peak() { return peak; },
    bellVoice,
    get bellBus() { return bellBus; },
    dispose() { stop(); bellBus?.dispose(); for (const n of nodes) { try { n.disconnect(); } catch { /* gone */ } } },
  };
}

// THE VISIT RECORD: one opener per page load; the plan and how far it has played survive a remount of the player
export const openerVisit = { plan: null, choices: null, pos: 0, state: 'fresh' };
export function resetOpenerVisit() {
  openerVisit.plan = null;
  openerVisit.choices = null;
  openerVisit.pos = 0;
  openerVisit.state = 'fresh';
}

const MEMORY_KEY = 'settle-hear:opener:last';
export function readOpenerMemory(store) {
  try {
    const raw = store?.getItem?.(MEMORY_KEY);
    const m = raw ? JSON.parse(raw) : null;
    return m && typeof m === 'object' ? m : null;
  } catch { return null; }
}
export function writeOpenerMemory(store, c) {
  try {
    store?.setItem?.(MEMORY_KEY, JSON.stringify({ rateOrder: c.rateOrder, timbreFirst: c.timbreFirst, timbreHarm: c.timbreHarm, length: c.durations.reduce((a, b) => a + b, 0), keyShift: c.keyShift, harmRatio: c.harmRatio, gammaMult: c.gammaMult, padCut: c.padCut, bellGap: c.bellGap }));
  } catch { /* storage refused: the decks still deal, only without last visit's card */ }
}
