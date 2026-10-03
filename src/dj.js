// settle-hear · dj - THE DJ: the symphony's decision maker, built as a small SETTLE-style settling machine.
//
// <claudes_code_comments>
// ** Function List **
// DJ_CHOICES                 - the six yes/no lights: beat, theme, static, split, flute, drone (key, short letter,
//                              label, question)
// DJ_PULLS                   - the pulls between them: [a, b, strength] (+ agree, - disagree)
// rng(seed)                  - a seeded random stream (mulberry32): the same seed gives the same set, every time
// readHero(stats, prev)      - the hero's live stats -> the DJ's inputs, every one 0..1 or a flag
// leans(inputs, mem, theme, you) - inputs + memory + theme + the visitor's steering -> each light's lean, with its
//                              parts (the "why"); `you` is { key: -1..1 } and lands as the part named 'you'
// STEER_LEAN                 - the lean a full visitor push adds (3.0, a strong opinion in the DJ's units)
// anneal(h, pulls, start, r, opts) - settle the lights: Gibbs sweeps from hot to cold; returns the final yes/no,
//                              P(yes) at the end, and the whole trace (every sweep) for the visualiser
// pickTheme(r, avoid)        - a theme at random, never the one we are leaving
// pickBeat(r, theme, beat, awayBars) - the next binaural beat from the theme's set (home to 40 more often the
//                              longer it has been away)
// createThemeDealer(r, after) - THE DECK RULE: .next(avoid) deals the themes like a deck, never the one it leaves
// createBeatDealer(r)        - THE DECK RULE: .next(theme, beat, awayBars) comes home like pickBeat, and an away beat
//                              deals the theme's beats like a deck, one deck per theme
// pickSplit(r, inputs)       - how many harmonics to split into (2..7): the word's letters ("by a choice") or a
//                              random draw
// createDJ({ seed, theme, sweeps }) - the DJ: .bar(stats) -> one bar's decision; .clamp(key, v) holds a light;
//                              .lockTheme(on) / .holdBeat(on); .theme, .state, .memory, .history;
//                              THE STEERING (lane RATELOOK): .steer(key, v) leans a choice by v in -1..1 (0 = the
//                              DJ decides), .wantBeat(hz | null) names the beat a beat change lands on,
//                              .wantTheme(key | null) names the theme a theme change lands on; .steers, .wanted
//                              THE SET HOOKS (for lane LOOPLAYERS): .onSetCycle(fn) -> off, called when a set ends
//                              and the next begins ({ set, adjusted, reason, tag }); .cycleSet(info) fires it (the
//                              symphony calls it: the planner's new set in house mode, a theme change otherwise);
//                              .adjusted is true once the visitor steered anything in the current set; .set counts sets
//
// ** Technical Review **
// - THE STEERING (navigator, 2026-10-02: "you adjust the automatic flow"): a visitor's control never sets a
//   choice; it adds a LEAN, the part named 'you' (STEER_LEAN x v), and the six lights still settle with it. A
//   wanted beat or theme only decides WHERE a yes lands: the DJ still decides WHEN. Centre (0, null) is exactly
//   the DJ alone: the 'you' part is absent and the picks are random as before.
// - The DJ IS a settle. Each choice is a p-bit s_i in {-1 no, +1 yes}. Its lean h_i comes from the hero's stats
//   (hot field -> change the beat; landed picture -> go static; a word -> bring in the flute; a film -> keep
//   time), from memory (how long since the last change), and from the theme's bias. The pulls J_ij tie the
//   choices together (static and split agree; the drone and the flute disagree). Once a bar it runs SWEEPS
//   (24) Gibbs sweeps, cooling from T 2.0 to 0.25, P(s_i = yes) = (1 + tanh(beta I_i)) / 2 with
//   I_i = h_i + sum_j J_ij s_j: the same rule the hero's lights follow, on six lights.
// - It starts each bar from last bar's answer, so a state (flute on, static on) has momentum and the music does
//   not flicker. The event choices (beat, theme, split) are read as "do it now".
// - Deterministic: one seeded stream feeds every random draw (the sweeps, the theme pick, the beat pick, the split).
//   The same seed and the same stats give the same set, which is how the tests pin it. The hero seeds it from the
//   clock, so each visit plays a different set.
// - The hidden toggles are clamps: a clamped light is held at its value through the sweeps (SETTLE's clamp), so the
//   visualiser still shows the other lights settling around it.
// - Leans are in the DJ's own units: about +-3 is a strong opinion. Every part of every lean is kept with its
//   name, so the visualiser can say "landed +2.2" beside the static light.
// </claudes_code_comments>

import { THEMES, themeOf } from './themes.js';
import { BEAT_HOME } from './tuning.js';
import { createBag } from './deck.js';

export const DJ_CHOICES = [
  { key: 'beat', short: 'B', label: 'CHANGE BEAT', question: 'change the binaural beat?' },
  { key: 'theme', short: 'T', label: 'NEW THEME', question: 'move to a new theme?' },
  { key: 'static', short: 'S', label: 'GO STATIC', question: 'hold still on one great harmonic?' },
  { key: 'split', short: 'H', label: 'SPLIT', question: 'split the harmonic into more partials?' },
  { key: 'flute', short: 'F', label: 'FLUTE', question: 'bring in the flute with the tune?' },
  { key: 'drone', short: 'D', label: 'DRONE', question: 'drop to the drone alone?' },
];
const KEYS = DJ_CHOICES.map((c) => c.key);

export const DJ_PULLS = [
  ['static', 'split', 0.9],
  ['static', 'flute', -0.8],
  ['drone', 'flute', -0.9],
  ['drone', 'static', 0.3],
  ['beat', 'theme', 0.6],
  ['beat', 'static', -0.4],
  ['theme', 'static', -0.3],
];

export const SWEEPS = 24;
export const T_HOT = 2.0;
export const T_COLD = 0.25;
// THE STEERING LEAN: a full push on a visitor's control (v = +1 or -1) adds this much lean to one choice. About
// +-3 is a strong opinion in the DJ's units (see the review above), so a full push argues as hard as the hero
// picture ever does and the other lights, the pulls and the sweeps still have their say.
export const STEER_LEAN = 3.0;
const clampSteer = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(-1, v)) : 0);

export function rng(seed = 1) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (x) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
const LN_COLD = Math.log(0.45);
const LN_HOT = Math.log(3);

// the hero's stats -> the DJ's inputs (all 0..1 or flags; garbage reads as a calm, unknown field)
export function readHero(stats, prev = null) {
  const s = stats && typeof stats === 'object' ? stats : {};
  const T = Number(s.T);
  const heat = Number.isFinite(T) && T > 0 ? clamp01((Math.log(T) - LN_COLD) / (LN_HOT - LN_COLD)) : 0;
  const q = Number(s.q);
  const overlap = Number.isFinite(q) ? clamp01(q) : 0;
  const n = Number(s.n);
  const flips = Number.isFinite(Number(s.flips)) && n > 0 ? clamp01(Number(s.flips) / n / 0.5) : heat;
  const item = s.item && typeof s.item === 'object' ? s.item : {};
  const film = !!(item.film || item.frames || s.film);
  const frame = s.film && Number.isFinite(Number(s.film.frame)) ? Number(s.film.frame) : null;
  const word = typeof item.word === 'string' ? item.word : null;
  const letters = word ? word.replace(/[^A-Za-z0-9]/g, '').length : 0;
  const landed = s.phase === 'settled' || s.phase === 'hold';
  const index = Number.isFinite(Number(s.index)) ? Number(s.index) : null;
  return {
    heat,
    overlap,
    flips,
    landed,
    film,
    frame,
    frameMoved: film && prev && prev.frame != null && frame != null && frame !== prev.frame,
    newTarget: !!(prev && prev.index != null && index != null && index !== prev.index),
    word,
    letters,
    shape: typeof item.shape === 'string' ? item.shape : null,
    index,
    phase: typeof s.phase === 'string' ? s.phase : 'unknown',
    live: !!stats,
  };
}

// each light's lean, as a list of named parts; mem = { barsSinceBeat, barsSinceTheme, barsStatic, barsFlute,
// barsDrone, beatAway, beat }
export function leans(inp, mem, theme, you = null) {
  const t = theme ?? themeOf();
  const b = t.bias ?? {};
  const cap = (x, m) => Math.min(m, x);
  const parts = {
    beat: [
      ['base', -1.6],
      ['heat', 1.4 * inp.heat],
      ['new target', inp.newTarget ? 1.0 : 0],
      ['bars since a change', 0.09 * cap(mem.barsSinceBeat, 20)],
      ['away from 40 Hz', mem.beat !== BEAT_HOME ? 0.12 * cap(mem.beatAway, 16) : 0],
      ['film frame', inp.frameMoved ? 0.5 : 0],
    ],
    theme: [
      ['base', -3.4],
      ['bars in this theme', 0.05 * cap(mem.barsSinceTheme, 64)],
      ['new target', inp.newTarget && mem.barsSinceTheme > 16 ? 1.4 : 0],
    ],
    static: [
      ['base', -0.9],
      ['landed', inp.landed ? 1.6 : 0],
      ['overlap', 1.4 * inp.overlap],
      ['heat', -1.6 * inp.heat],
      ['a film plays', inp.film ? -0.8 : 0],
      ['held too long', -0.18 * cap(mem.barsStatic, 16)],
    ],
    split: [
      ['base', -1.0],
      ['overlap', 1.0 * inp.overlap],
      ['landed', inp.landed ? 0.6 : 0],
    ],
    flute: [
      ['base', 0.2],
      ['a word', inp.word ? 0.9 : 0],
      ['a shape', inp.shape ? -0.2 : 0],
      ['a film plays', inp.film ? -0.3 : 0],
      ['flips', -0.6 * inp.flips],
      ['playing long', -0.05 * cap(mem.barsFlute, 32)],
      ['resting long', 0.08 * cap(mem.barsQuiet, 16)],
    ],
    drone: [
      ['base', -1.5],
      ['calm and landed', inp.landed ? 1.2 * (1 - inp.flips) : 0],
      ['a film plays', inp.film ? 0.5 : 0],
      ['droning long', -0.15 * cap(mem.barsDrone, 16)],
    ],
  };
  const out = {};
  for (const k of KEYS) {
    const list = parts[k].map(([why, v]) => ({ why, v }));
    if (b[k]) list.push({ why: `theme ${t.label}`, v: b[k] });
    const yv = you ? STEER_LEAN * clampSteer(you[k]) : 0;
    if (yv !== 0) list.push({ why: 'you', v: yv });
    const total = list.reduce((a, p) => a + p.v, 0);
    out[k] = { total, parts: list.filter((p) => p.v !== 0) };
  }
  return out;
}

function pullMatrix(pulls) {
  const J = KEYS.map(() => KEYS.map(() => 0));
  for (const [a, b, w] of pulls) {
    const i = KEYS.indexOf(a);
    const j = KEYS.indexOf(b);
    if (i < 0 || j < 0) continue;
    J[i][j] = w;
    J[j][i] = w;
  }
  return J;
}

// h: { key: number }, start: { key: bool }, clamps: { key: bool | null }
export function anneal(h, pulls, start, r, { sweeps = SWEEPS, hot = T_HOT, cold = T_COLD, clamps = {} } = {}) {
  const J = pullMatrix(pulls);
  const s = KEYS.map((k) => (clamps[k] != null ? (clamps[k] ? 1 : -1) : start?.[k] ? 1 : -1));
  const trace = [];
  let pYes = KEYS.map(() => 0.5);
  for (let w = 0; w < sweeps; w++) {
    const T = hot * Math.pow(cold / hot, sweeps > 1 ? w / (sweeps - 1) : 1);
    for (let i = 0; i < KEYS.length; i++) {
      const k = KEYS[i];
      if (clamps[k] != null) { pYes[i] = clamps[k] ? 1 : 0; continue; }
      let I = h[k] ?? 0;
      for (let j = 0; j < KEYS.length; j++) I += J[i][j] * s[j];
      pYes[i] = (1 + Math.tanh(I / T)) / 2;
      s[i] = r() < pYes[i] ? 1 : -1;
    }
    trace.push({ T, s: s.slice(), p: pYes.slice() });
  }
  return {
    yes: Object.fromEntries(KEYS.map((k, i) => [k, s[i] > 0])),
    pYes: Object.fromEntries(KEYS.map((k, i) => [k, pYes[i]])),
    trace,
  };
}

export function pickTheme(r, avoid, want = null) {
  const pool = THEMES.filter((t) => t.key !== avoid);
  // a wanted theme is where a theme change lands (the DJ still decided to change); never the one we are leaving
  const w = want ? pool.find((t) => t.key === want) : null;
  if (w) return w;
  return pool[Math.floor(r() * pool.length) % pool.length];
}

export function pickBeat(r, theme, beat, awayBars = 0, want = null) {
  const t = theme ?? themeOf();
  // a wanted beat is where a beat change lands; the same beat again is no change, so the pool decides then
  if (Number.isFinite(want) && want > 0 && want !== beat) return want;
  if (beat !== BEAT_HOME && r() < Math.min(0.85, 0.35 + 0.06 * awayBars)) return BEAT_HOME;
  const pool = t.beats.filter((b) => b !== beat);
  return pool.length ? pool[Math.floor(r() * pool.length) % pool.length] : BEAT_HOME;
}

// THE DECK RULE: the DJ's theme changes deal the themes like a deck, never the one it is leaving
export function createThemeDealer(r, after = null) {
  const deck = createBag(THEMES.map((t) => t.key), { random: r, ...(after ? { after } : {}) });
  return {
    next(avoid) {
      let k = deck.next();
      if (k === avoid && THEMES.length > 1) k = deck.next();
      return themeOf(k);
    },
  };
}

// THE DECK RULE: a beat change away from home deals the theme's beats like a deck (one deck per theme); the pull
// home to BEAT_HOME is the same weighted draw as pickBeat's, a designed bias rather than a cycle
export function createBeatDealer(r) {
  const decks = new Map();
  return {
    next(theme, beat, awayBars = 0) {
      const t = theme ?? themeOf();
      if (beat !== BEAT_HOME && r() < Math.min(0.85, 0.35 + 0.06 * awayBars)) return BEAT_HOME;
      if (!decks.has(t.key)) decks.set(t.key, createBag(t.beats, { random: r }));
      const deck = decks.get(t.key);
      let b = deck.next();
      if (b === beat && t.beats.length > 1) b = deck.next();
      return b === beat ? BEAT_HOME : b;
    },
  };
}

export function pickSplit(r, inp) {
  const byChoice = inp.letters >= 2 && r() < 0.6;
  if (byChoice) return { n: Math.min(7, Math.max(2, inp.letters)), how: `the ${inp.letters} letters of ${inp.word}` };
  return { n: 2 + Math.floor(r() * 6), how: 'a random draw' };
}

export function createDJ({ seed = 1, theme = null, sweeps = SWEEPS } = {}) {
  const r = rng(seed);
  let T = theme ? themeOf(theme) : pickTheme(r, null);
  const themeDealer = createThemeDealer(r, T.key);
  const beatDealer = createBeatDealer(r);
  const clamps = Object.fromEntries(KEYS.map((k) => [k, null]));
  let themeLocked = false;
  let beatHeld = false;
  const steers = Object.fromEntries(KEYS.map((k) => [k, 0]));
  let wantBeat = null;
  let wantTheme = null;
  const mem = { barsSinceBeat: 0, barsSinceTheme: 0, barsStatic: 0, barsFlute: 0, barsQuiet: 0, barsDrone: 0, beatAway: 0, beat: BEAT_HOME };
  let state = { flute: true, static: false, drone: false, beat: false, theme: false, split: false };
  let harmonics = 1;
  let splitHow = null;
  let prev = null;
  let bar = 0;
  const history = [];
  // THE SET HOOKS: was the current set touched by the visitor, and who listens for a set ending
  let adjusted = false;
  let setNo = 0;
  const setSubs = new Set();
  const steeredNow = () => KEYS.some((k) => steers[k] !== 0) || wantBeat != null || wantTheme != null || themeLocked || beatHeld || KEYS.some((k) => clamps[k] != null);

  const dj = {
    get theme() { return T; },
    get state() { return { ...state }; },
    get memory() { return { ...mem }; },
    get beat() { return mem.beat; },
    get harmonics() { return harmonics; },
    get clamps() { return { ...clamps }; },
    get themeLocked() { return themeLocked; },
    get beatHeld() { return beatHeld; },
    get history() { return history.slice(); },
    get steers() { return { ...steers }; },
    get wanted() { return { beat: wantBeat, theme: wantTheme }; },
    steer(key, v) { if (KEYS.includes(key)) { steers[key] = clampSteer(Number(v)); if (steers[key] !== 0) adjusted = true; } },
    wantBeat(hz) { wantBeat = Number.isFinite(Number(hz)) && Number(hz) > 0 ? Number(hz) : null; if (wantBeat != null) adjusted = true; },
    wantTheme(key) { wantTheme = key && THEMES.some((t) => t.key === key) ? key : null; if (wantTheme != null) adjusted = true; },
    clamp(key, v) { if (KEYS.includes(key)) { clamps[key] = v == null ? null : !!v; if (v != null) adjusted = true; } },
    lockTheme(on = true) { themeLocked = !!on; if (themeLocked) adjusted = true; },
    holdBeat(on = true) { beatHeld = !!on; if (beatHeld) { mem.beat = BEAT_HOME; adjusted = true; } },
    // the visitor touched the set some other way (a mix lean, a track hold, a skip): the symphony marks it
    markAdjusted() { adjusted = true; },
    get adjusted() { return adjusted; },
    get set() { return setNo; },
    onSetCycle(fn) { setSubs.add(fn); return () => setSubs.delete(fn); },
    // a set ended: tell the listeners (with whether the visitor adjusted it), then start the next one; a steer the
    // visitor left on carries into the new set, so the new set starts adjusted when anything is still steered
    cycleSet(info = {}) {
      const ev = { set: setNo, adjusted, reason: info.reason ?? 'set', tag: info.tag ?? null, theme: T.key };
      setNo += 1;
      adjusted = steeredNow();
      for (const f of setSubs) { try { f(ev); } catch { /* a listener that fails does not stop the DJ */ } }
      return ev;
    },
    setTheme(key) { T = themeOf(key); mem.barsSinceTheme = 0; },
    // one bar: read the hero, lean, settle, act; returns everything the player and the visualiser need
    // opts.holdTheme: the house DJ changes theme only between sets, so it holds the DJ's own theme light at no
    bar(stats, opts = {}) {
      bar += 1;
      const inp = readHero(stats, prev);
      prev = { index: inp.index, frame: inp.frame };
      const L = leans(inp, mem, T, steers);
      const h = Object.fromEntries(KEYS.map((k) => [k, L[k].total]));
      const c = { ...clamps };
      if (themeLocked || opts.holdTheme) c.theme = false;
      if (beatHeld) c.beat = false;
      const A = anneal(h, DJ_PULLS, state, r, { sweeps, clamps: c });
      const yes = A.yes;
      const was = { theme: T.key, beat: mem.beat, harmonics };
      // act on the events
      // the visitor's wanted theme or beat decides where a change lands (THE STEERING); otherwise the dealers deal
      // (THE DECK RULE). A wanted beat equal to the current one is no change, so the dealer decides then.
      const wantedTheme = wantTheme ? THEMES.find((t) => t.key === wantTheme && t.key !== T.key) : null;
      if (yes.theme) { T = wantedTheme ?? themeDealer.next(T.key); mem.barsSinceTheme = 0; mem.beat = wantBeat ?? BEAT_HOME; mem.barsSinceBeat = 0; mem.beatAway = 0; }
      else mem.barsSinceTheme += 1;
      const wantedBeat = Number.isFinite(wantBeat) && wantBeat > 0 && wantBeat !== mem.beat ? wantBeat : null;
      if (yes.beat && !yes.theme) { mem.beat = wantedBeat ?? beatDealer.next(T, mem.beat, mem.beatAway); mem.barsSinceBeat = 0; }
      else mem.barsSinceBeat += 1;
      mem.beatAway = mem.beat === BEAT_HOME ? 0 : mem.beatAway + 1;
      // the harmonics: static starts at the fundamental; a split picks how many partials to grow toward
      if (yes.static) {
        if (!state.static) { harmonics = 1; splitHow = null; }
        if (yes.split && harmonics === 1) { const p = pickSplit(r, inp); harmonics = p.n; splitHow = p.how; }
        mem.barsStatic += 1;
      } else { harmonics = 1; splitHow = null; mem.barsStatic = 0; }
      mem.barsDrone = yes.drone ? mem.barsDrone + 1 : 0;
      const fluteSounds = yes.flute && !yes.drone && !yes.static;
      mem.barsFlute = fluteSounds ? mem.barsFlute + 1 : 0;
      mem.barsQuiet = fluteSounds ? 0 : mem.barsQuiet + 1;
      state = { ...yes };
      const decision = {
        bar,
        theme: T,
        themeChanged: T.key !== was.theme,
        beat: mem.beat,
        beatChanged: mem.beat !== was.beat,
        harmonics,
        splitHow,
        yes,
        pYes: A.pYes,
        trace: A.trace,
        leans: L,
        inputs: inp,
        clamps: c,
        steer: { leans: { ...steers }, beat: wantBeat, theme: wantTheme },
        mode: yes.drone ? 'drone' : yes.static ? 'static' : yes.flute ? 'tune' : 'bed',
      };
      history.push({ bar, theme: T.key, beat: mem.beat, mode: decision.mode, harmonics, yes: { ...yes } });
      if (history.length > 64) history.shift();
      return decision;
    },
  };
  return dj;
}
