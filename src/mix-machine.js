// settle-hear · mix-machine - THE MIX MACHINE: the house DJ's layers and effects, settled once a bar as p-bits, the
// same rule the DJ's six choices follow. Its leans come from the planner's section, the hero picture's mood, the
// theme, the visitor's steering and the votes; its pulls make the choices agree (a drop brings the drums and the bass
// in together; a breakdown thins the layers and opens the reverb).
//
// <claudes_code_comments>
// ** Function List **
// MIX_CHOICES                 - the eleven things: drums, bass, pad, lead, drone, arps, answer, texture, wash, filter,
//                               chain (key, short letter, label, question)
// MIX_PULLS                   - the pulls between them: [a, b, strength] (+ agree, - disagree)
// SECTION_LEANS               - each section's lean on each thing (the arc's shape in the mix)
// THEME_MIX                   - each theme's extra lean on each thing
// MIX_STEER                   - which visitor control leans which thing, and how hard (the glyph row's map)
// LAYER_WEIGHT                - each layer's share of the energy level
// TRAINED_LEAN                - the trained grid's lean on a thing it decides (lane DJWIRE)
// mixLeans(ctx)               - every thing's lean as named parts: section (or the trained set), mood, theme, you,
//                               votes, holding
// settleBits(keys, h, pulls, start, r, opts) - the generic p-bit settle: Gibbs sweeps from hot to cold, clamps held;
//                               returns { yes, pYes, trace }
// energyOf(yes, section)      - the energy level 0..1 a set of layers makes
// createMixMachine(opts)      - the machine: .bar(ctx) -> { yes, pYes, trace, leans, energy, changed, held };
//                               .state, .clamp(key, v)
//
// ** Technical Review **
// - THE IDEA (navigator, 2026-10-02: "intelligent house mix intelligence ... based well on our SETTLE machine"). Each
//   thing is a p-bit s_i in {-1 out, +1 in}, lean h_i, pulls J_ij, and once a bar 20 sweeps cool T from 2.0 to 0.2
//   with P(in) = (1 + tanh(I_i / T)) / 2, I_i = h_i + sum_j J_ij s_j: THE SETTLE RULE.
// - PHRASE LINES: inside a 4-bar block a thing leans hard toward staying as it is (+2.6 toward its last state, the
//   part named 'holding'), so the mix changes on 4-bar lines and on the planner's section changes, and almost never
//   mid-phrase. On a section change the holding part is gone and the section's leans decide.
// - THE STEERING: the visitor's six DJ leans and the mix leans (energy, drums, bass, pad, fx) each add a named part
//   'you' (3.0 x v, the DJ's own STEER_LEAN). A full push toward energy raises the drums, the bass and the arps and
//   lowers the wash. A track held out (flute, drone) clamps its thing out.
// - THE VOTES: votes.layers { key: -1..1 } (the mean of (rating - 0.5) over the rated tags whose mix had that thing
//   in, minus those that had it out) adds 1.2 x that, the part named 'votes'.
// - Deterministic for a seed.
// </claudes_code_comments>

import { deckRng } from './deck.js';

export const MIX_CHOICES = [
  { key: 'drums', short: 'K', label: 'DRUMS', question: 'the kick, the hats and the clap?' },
  { key: 'bass', short: 'B', label: 'BASS', question: 'the bass line under it?' },
  { key: 'pad', short: 'P', label: 'PAD', question: 'the evolving pad?' },
  { key: 'lead', short: 'L', label: 'LEAD', question: 'the tune on the flute?' },
  { key: 'drone', short: 'D', label: 'DRONE', question: 'a low drone on the root?' },
  { key: 'arps', short: 'A', label: 'ARPS', question: 'the chord as quick plucks?' },
  { key: 'answer', short: 'R', label: 'ANSWER', question: 'a voice answering the tune?' },
  { key: 'texture', short: 'X', label: 'TEXTURE', question: 'a field texture (wind, water, birds)?' },
  { key: 'wash', short: 'W', label: 'WASH', question: 'the hall reverb opened up?' },
  { key: 'filter', short: 'F', label: 'FILTER', question: 'the low-pass closed down?' },
  { key: 'chain', short: 'C', label: 'FX CHAIN', question: 'the effect chain pushed up?' },
];
export const MIX_KEYS = MIX_CHOICES.map((c) => c.key);

export const MIX_PULLS = [
  ['drums', 'bass', 1.0],
  ['drums', 'arps', 0.4],
  ['wash', 'drums', -0.6],
  ['pad', 'wash', 0.4],
  ['lead', 'answer', 0.5],
  ['lead', 'drone', -0.3],
  ['bass', 'drone', -0.4],
  ['texture', 'drums', -0.4],
  ['filter', 'drums', -0.3],
  ['chain', 'drums', 0.3],
];

export const SECTION_LEANS = {
  intro: { drums: 0.6, bass: -1.0, pad: 1.0, lead: -0.4, drone: 0.3, arps: -0.6, answer: -1.0, texture: 0.8, wash: 0.5, filter: 0.6, chain: 0 },
  build: { drums: 1.2, bass: 0.6, pad: 0.5, lead: 0.7, drone: -0.5, arps: 1.0, answer: 0, texture: -0.6, wash: 0, filter: 0.8, chain: 0.6 },
  peak: { drums: 2.2, bass: 2.0, pad: 0.6, lead: 1.5, drone: -1.0, arps: 0.8, answer: 0.6, texture: -1.0, wash: -0.6, filter: -1.6, chain: 1.0 },
  breakdown: { drums: -2.2, bass: -1.4, pad: 1.6, lead: 0.9, drone: 1.0, arps: -0.4, answer: 0.2, texture: 0.5, wash: 1.6, filter: 0.3, chain: -0.3 },
  outro: { drums: 0.8, bass: -0.4, pad: 0.8, lead: -0.6, drone: 0.4, arps: -0.8, answer: -1.0, texture: 0.6, wash: 0.8, filter: 0.8, chain: 0 },
  hum: { drums: -4, bass: -4, pad: -1.2, lead: -3, drone: 0.4, arps: -4, answer: -3, texture: 0.6, wash: 1.0, filter: 1.6, chain: -2.2 },
};

export const THEME_MIX = {
  crystals: { arps: 0.5, wash: 0.4, drums: -0.3, texture: 0.3 },
  highlands: { lead: 0.6, drone: 0.4, drums: 0.2 },
  deepsea: { wash: 0.6, drone: 0.5, drums: -0.4, filter: 0.4 },
  cathedral: { pad: 0.5, wash: 0.6, drums: -0.5, answer: 0.3 },
  embers: { drums: 0.5, bass: 0.5, arps: 0.3, chain: 0.4 },
};

// the visitor's controls: each a list of [thing, weight]; the steer value v in -1..1 adds STEER x weight x v
export const MIX_STEER = {
  energy: [['drums', 0.5], ['bass', 0.4], ['arps', 0.35], ['wash', -0.3], ['filter', -0.35]],
  drums: [['drums', 1]],
  bass: [['bass', 1]],
  pad: [['pad', 1]],
  fx: [['chain', 1], ['wash', 0.5]],
  // the DJ's own six leans reach the mix too
  flute: [['lead', 1]],
  drone: [['drone', 1]],
  split: [['arps', 1]],
  static: [['wash', 0.6], ['drums', -0.5], ['pad', 0.4]],
};
const STEER = 3.0;
const HOLD = 2.6;
// lane DJWIRE: the trained grid's lean on a thing it decides, as strong as a peak's lean on the drums
export const TRAINED_LEAN = 2.4;

export const LAYER_WEIGHT = { drums: 0.32, bass: 0.22, arps: 0.13, lead: 0.11, pad: 0.06, answer: 0.05, chain: 0.07, drone: 0.02, texture: 0.02 };

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ctx: { section, changed (a section change this bar), onLine (a 4-bar line), prev (last yes), mood, theme, steer, votes,
//   trained (lane DJWIRE: { thing: bool } for the things the trained set decides, or null) }
export function mixLeans(ctx = {}) {
  const sec = SECTION_LEANS[ctx.section] ?? SECTION_LEANS.intro;
  const mood = ctx.mood ?? {};
  const heat = clamp(Number(mood.heat) || 0, 0, 1);
  const theme = THEME_MIX[ctx.theme] ?? {};
  const steer = ctx.steer ?? {};
  const out = {};
  for (const k of MIX_KEYS) {
    const parts = [];
    // THE TRAINED SET (lane DJWIRE): for the things the trained grid decides, its block's on or off replaces the
    // section's lean; everything after it (the picture, the theme, you, the votes, the holding) is unchanged
    if (ctx.trained && Object.hasOwn(ctx.trained, k)) parts.push({ why: 'the trained set', v: ctx.trained[k] ? TRAINED_LEAN : -TRAINED_LEAN });
    else parts.push({ why: `section ${ctx.section ?? 'intro'}`, v: sec[k] ?? 0 });
    let m = 0;
    if (k === 'drums') m += 0.8 * heat + (mood.film ? 0.4 : 0);
    if (k === 'bass') m += 0.5 * heat;
    if (k === 'arps') m += 0.6 * heat;
    if (k === 'pad' || k === 'wash') m += mood.landed ? 0.5 : 0;
    if (k === 'lead') m += mood.word ? 0.6 : 0;
    if (m) parts.push({ why: 'the picture', v: m });
    if (theme[k]) parts.push({ why: `theme ${ctx.theme}`, v: theme[k] });
    let you = 0;
    for (const [ctrl, list] of Object.entries(MIX_STEER)) {
      const v = clamp(Number(steer[ctrl]) || 0, -1, 1);
      if (!v) continue;
      for (const [thing, w] of list) if (thing === k) you += STEER * w * v;
    }
    if (you) parts.push({ why: 'you', v: you });
    const vote = ctx.votes?.layers?.[k];
    if (Number.isFinite(vote) && vote) parts.push({ why: 'votes', v: 1.2 * clamp(vote, -1, 1) });
    if (ctx.prev && !ctx.changed && !ctx.onLine) parts.push({ why: 'holding the phrase', v: ctx.prev[k] ? HOLD : -HOLD });
    else if (ctx.prev && !ctx.changed) parts.push({ why: 'momentum', v: ctx.prev[k] ? 0.5 : -0.5 });
    const total = parts.reduce((a, p) => a + p.v, 0);
    out[k] = { total, parts: parts.filter((p) => p.v !== 0) };
  }
  return out;
}

export function settleBits(keys, h, pulls, start, r, { sweeps = 20, hot = 2.0, cold = 0.2, clamps = {} } = {}) {
  const J = keys.map(() => keys.map(() => 0));
  for (const [a, b, w] of pulls) {
    const i = keys.indexOf(a);
    const j = keys.indexOf(b);
    if (i < 0 || j < 0) continue;
    J[i][j] = w;
    J[j][i] = w;
  }
  const s = keys.map((k) => (clamps[k] != null ? (clamps[k] ? 1 : -1) : start?.[k] ? 1 : -1));
  let pYes = keys.map(() => 0.5);
  const trace = [];
  for (let w = 0; w < sweeps; w++) {
    const T = hot * Math.pow(cold / hot, sweeps > 1 ? w / (sweeps - 1) : 1);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (clamps[k] != null) { pYes[i] = clamps[k] ? 1 : 0; continue; }
      let I = h[k] ?? 0;
      for (let j = 0; j < keys.length; j++) I += J[i][j] * s[j];
      pYes[i] = (1 + Math.tanh(I / T)) / 2;
      s[i] = r() < pYes[i] ? 1 : -1;
    }
    trace.push({ T, s: s.slice(), p: pYes.slice() });
  }
  return {
    yes: Object.fromEntries(keys.map((k, i) => [k, s[i] > 0])),
    pYes: Object.fromEntries(keys.map((k, i) => [k, pYes[i]])),
    trace,
  };
}

export function energyOf(yes = {}, section = 'intro') {
  let e = 0;
  for (const [k, w] of Object.entries(LAYER_WEIGHT)) if (yes[k]) e += w;
  if (yes.filter) e *= 0.75;
  if (section === 'hum') e = Math.min(e, 0.1);
  return clamp(e, 0, 1);
}

export function createMixMachine({ seed = 1, sweeps = 20 } = {}) {
  const r = deckRng(((Number(seed) >>> 0) ^ 0x6a09e667) >>> 0 || 1);
  let prev = null;
  const clamps = Object.fromEntries(MIX_KEYS.map((k) => [k, null]));
  const machine = {
    get state() { return prev ? { ...prev } : null; },
    get clamps() { return { ...clamps }; },
    clamp(key, v) { if (MIX_KEYS.includes(key)) clamps[key] = v == null ? null : !!v; },
    // ctx: { section, changed, onLine, mood, theme, steer, votes, holds: { thing: false } }
    bar(ctx = {}) {
      const L = mixLeans({ ...ctx, prev });
      const h = Object.fromEntries(MIX_KEYS.map((k) => [k, L[k].total]));
      const c = { ...clamps };
      for (const [k, v] of Object.entries(ctx.holds ?? {})) if (v === false && MIX_KEYS.includes(k)) c[k] = false;
      const A = settleBits(MIX_KEYS, h, MIX_PULLS, prev ?? {}, r, { sweeps, clamps: c });
      const changed = prev ? MIX_KEYS.filter((k) => prev[k] !== A.yes[k]) : MIX_KEYS.filter((k) => A.yes[k]);
      prev = { ...A.yes };
      return { yes: A.yes, pYes: A.pYes, trace: A.trace, leans: L, energy: energyOf(A.yes, ctx.section), changed, clamps: c };
    },
  };
  return machine;
}
