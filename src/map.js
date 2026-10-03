// settle-hear · map - the physics-to-sound mapping: pure functions from a settle's stats to sound parameters.
//
// <claudes_code_comments>
// ** Function List **
// clamp01(x)                      - x clamped to [0, 1]; NaN and non-numbers become 0
// smooth(x)                       - the smoothstep curve on [0, 1]
// heat(T, range)                  - temperature as 0 (cold) .. 1 (hot), on a log scale
// flipFraction(flips, n)          - the share of lights that flipped in the last sweep, 0 .. 1
// crackleRate(frac, max)          - crackle grains per second from the flip share (monotone, capped)
// settledness(ePer, lean, pull)   - how far the energy per light has fallen toward its floor, 0 .. 1
// dronePitch(level, base, span)   - the drone's frequency: high while the energy is high, sinking as it falls
// consonance(q, low, high)        - how resolved the chord is, from the overlap q with the stored picture
// chordRatios(c)                  - the chord's four frequency ratios, a cluster at c 0, a major chord at c 1
// brightness(h, lo, hi)           - a lowpass cutoff in Hz from the heat (hot is bright)
// pulseCount(power, max)          - how many rising pulses a click of this power sends
// pulsePitch(k, power, base)      - the pitch of pulse k of a click at this power
// sparkleRate(held, max)          - pointer sparkle blips per second from the held level
// heldLevel(held, n)              - the mean hold over the field's lights (the pointer's trail), 0 .. 1
// soundParams(stats, opts)        - every mapped value at once, for one stats frame
//
// ** Technical Review **
// - This file has no audio in it. It is the honest part of settle-hear: each function says which number of the
//   physics a sound follows, and tests/map.test.mjs checks each is clamped, NaN-free and monotone where claimed.
// - heat uses the schedule's own range (hot 3.0, cold 0.45 by default) on a log scale, because the schedule cools
//   geometrically: equal times of cooling become equal steps of the sound.
// - settledness uses the energy floor of a field whose every light agrees with its target and its four neighbours:
//   E per light = -(lean + 2 pull) (each light owns two of its four bonds). A random field sits near 0.
// - consonance maps the overlap q = mean(t_i s_i) through a smoothstep between low (default 0.25) and high (0.95):
//   a hot field still has some overlap because the lean acts at every temperature, so the chord starts resolving
//   only when the picture is actually forming.
// </claudes_code_comments>

export const clamp01 = (x) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

export const smooth = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

const num = (x, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : d);

// temperature to 0 .. 1 on a log scale, the schedule's range by default
export function heat(T, { hot = 3.0, cold = 0.45 } = {}) {
  const t = num(T, cold);
  if (t <= 0) return 0;
  return clamp01((Math.log(t) - Math.log(cold)) / (Math.log(hot) - Math.log(cold)));
}

export function flipFraction(flips, n) {
  const N = num(n, 0);
  if (N <= 0) return 0;
  return clamp01(num(flips, 0) / N);
}

// an infinitely hot p-bit flips half the time, so 0.5 is the most a sweep can flip on average
export function crackleRate(frac, max = 60) {
  return Math.max(0, num(max, 0)) * Math.pow(clamp01(clamp01(frac) / 0.5), 0.6);
}

export function settledness(ePer, lean = 0.9, pull = 0.3) {
  const floor = num(lean, 0.9) + 2 * num(pull, 0.3);
  if (floor <= 0) return 0;
  return clamp01(-num(ePer, 0) / floor);
}

export function dronePitch(level, base = 55, span = 1) {
  return num(base, 55) * Math.pow(2, (1 - clamp01(level)) * Math.max(0, num(span, 1)));
}

export function consonance(q, low = 0.25, high = 0.95) {
  if (!(high > low)) return 0;
  return smooth((num(q, 0) - low) / (high - low));
}

// a major chord (root, third, fifth, octave) and the cluster it resolves from, mixed in log frequency
const CONSONANT = [1, 5 / 4, 3 / 2, 2];
const CLUSTER = [1, 17 / 16, 45 / 32, 15 / 8];
export function chordRatios(c) {
  const k = clamp01(c);
  return CONSONANT.map((r, i) => Math.exp((1 - k) * Math.log(CLUSTER[i]) + k * Math.log(r)));
}

export function brightness(h, lo = 300, hi = 6000) {
  return num(lo, 300) * Math.pow(num(hi, 6000) / num(lo, 300), clamp01(h));
}

export function pulseCount(power, max = 8) {
  const p = Math.round(num(power, 0));
  return Math.max(0, Math.min(Math.max(0, Math.round(num(max, 8))), p));
}

// pulse k of a click at power p: each pulse a whole tone above the last, each power level a semitone up
export function pulsePitch(k, power, base = 220) {
  return num(base, 220) * Math.pow(2, (2 * Math.max(0, num(k, 0)) + Math.max(0, num(power, 1)) - 1) / 12);
}

export function sparkleRate(held, max = 30) {
  return Math.max(0, num(max, 0)) * Math.sqrt(clamp01(held));
}

// the pointer's trail: the mean hold, scaled so a short stroke across a big field still reads
export function heldLevel(held, n) {
  if (!held || !held.length) return 0;
  const N = num(n, held.length) || held.length;
  let s = 0;
  for (let i = 0; i < held.length; i++) s += held[i];
  return clamp01((s / N) * 40);
}

export function soundParams(stats, { hot, cold, lean = 0.9, pull = 0.3, maxGrains = 60, low, high } = {}) {
  const st = stats || {};
  const h = heat(st.T, { hot, cold });
  const frac = flipFraction(st.flips, st.n);
  const level = settledness(st.ePer, lean, pull);
  const c = consonance(st.q, low, high);
  return {
    heat: h,
    flipFraction: frac,
    grains: crackleRate(frac, maxGrains),
    settled: level,
    consonance: c,
    ratios: chordRatios(c),
    cutoff: brightness(h),
    power: pulseCount(st.power, st.maxPower ?? 8),
    phase: typeof st.phase === 'string' ? st.phase : 'custom',
  };
}
