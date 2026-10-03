// settle-hear · mix-planner - THE PLANNER: the house DJ's arc. Every four bars it plans the next sixteen, scores
// every plan by how well it fits the set's energy arc, the theme, the hero's mood, the visitor's steering and the
// votes, adds a habit prior that keeps the music coherent, and SETTLES one plan on the master beat. Modelled on the
// DOOM page's surprise agent (sites/settle-site/src/engine/surprise.js): plans over a short horizon, a score per
// plan, a habit prior over plans, a settled choice.
//
// <claudes_code_comments>
// ** Function List **
// SECTIONS                    - the six sections of a set's energy arc: intro, build, peak, breakdown, outro, hum (THE
//                               NEUTRAL HUM, the quiet warm-down); each { key, label, energy, min, max, next }
// sectionOf(key)              - one section by key
// PLANNER                     - the planner's numbers: block (4 bars), horizon (4 blocks = 16 bars), the cooling, the
//                               habit costs, the arc length
// ARC                         - the set's energy arc: a target energy for each bar of a ~96-bar set
// arcTarget(setBar, shift)    - the target energy at a bar of the set, moved by the theme, the mood and the steering
// THEME_ENERGY                - each theme's shift of the arc (EMBERS hotter, DEEP SEA lower)
// TRANSITION_FX               - the effect moves a transition may use (the fx-*.js keys), by the kind of transition
// enumeratePlans(from, opts)  - every plan the grammar allows over the horizon from a (section, barsIn) state
// planCost(plan, ctx)         - G for one plan, as named parts: arc fit, habit, steering, votes, mood, length rules
// settlePlans(plans, r, opts) - the choice: p(plan) proportional to exp(-G / T), sampled as T cools; the trace
// chooseFx(kind, r, ctx)      - the move for one transition, settled the same way: fit, votes, and a habit prior that
//                               refuses the move used last (no effect spam)
// createPlanner(opts)         - the planner: .bar(inputs) -> this bar's { section, barsIn, setBar, set, lines, moves,
//                               keyLift, plan, next, newSet, energyTarget }; .state, .history; .force(state) puts
//                               the planner at a section and bar (a replay)
//
// ** Technical Review **
// - THE GRAMMAR: intro -> build; build -> peak; peak -> breakdown | outro | hum; breakdown -> build | outro | hum;
//   outro -> hum; hum -> intro (a NEW SET) | build (a warm-down inside the set, then on). An outro before about
//   72% of the set's ~96 bars costs extra (PLANNER.endEarly), so a set has its breakdown and second peak. A section has a minimum length (intro 8 bars, build 4, peak 8,
//   breakdown 4, outro 8, hum 4) and a soft maximum.
// - THE CLOCK: a block is 4 bars and every block starts on a 4-bar line of the set. On the first bar of a block the
//   planner commits the NEXT block's section (so a transition is known one block ahead and its build-up effects can
//   start two bars before the line) and settles a fresh 16-bar plan from there. A section change therefore always
//   lands on a 4-bar line, and the habit prior makes 8 and 16 bar lines cheaper (PLANNER.lineDiscount).
// - THE SCORE (lower is better), each part kept with its name for the panel:
//     arc     - the squared distance between the section's energy and the arc's target, summed over the plan's bars
//     habit   - ln E(plan): +1.0 per change, less on an 8 or 16 bar line; +8 for leaving a section before its
//               minimum; +0.6 a block past its maximum
//     you     - the visitor's steering: a 'static' push makes breakdown and hum cheaper, a 'theme' push makes outro
//               and hum cheaper (a new set brings a new theme), an 'energy' push lifts the arc
//     votes   - sections that were in well-rated tags cost less (votes.sections: { key: -1..1 })
//     influence - the earlier sets' mean energy pulls the arc a little (a quiet set before, a gentler start)
// - THE SETTLE: G for every plan (a few dozen), then 8 steps cooling T from 2.0 to 0.15, each step sampling a plan
//   from exp(-G / T). The last sample is the choice. Deterministic for a seed.
// - THE MOVES: a change of section brings transition effects in the bars before the line: into a build, nothing;
//   at the end of a build (the drop), a riser or a snare roll over two bars and one of the one-bar silence, the
//   reverse cymbal or the filter drop on the last bar, a downlifter on the first bar of the peak; peak to breakdown,
//   a tape stop or a reverse cymbal; into the hum, a filter drop. A second peak in a set may lift the key a tone.
//   Each move is settled by chooseFx with a habit prior against repeating the last move.
// </claudes_code_comments>

import { deckRng } from './deck.js';

export const SECTIONS = [
  { key: 'intro', label: 'INTRO', energy: 0.32, min: 8, max: 16, next: ['build'] },
  { key: 'build', label: 'BUILD', energy: 0.62, min: 4, max: 8, next: ['peak'] },
  { key: 'peak', label: 'PEAK', energy: 0.92, min: 8, max: 32, next: ['breakdown', 'outro', 'hum'] },
  { key: 'breakdown', label: 'BREAKDOWN', energy: 0.3, min: 4, max: 16, next: ['build', 'outro', 'hum'] },
  { key: 'outro', label: 'OUTRO', energy: 0.36, min: 8, max: 16, next: ['hum'] },
  { key: 'hum', label: 'NEUTRAL HUM', energy: 0.06, min: 4, max: 16, next: ['intro', 'build'] },
];
const BY = new Map(SECTIONS.map((s) => [s.key, s]));
export const SECTION_KEYS = SECTIONS.map((s) => s.key);
export function sectionOf(key) { return BY.get(key) ?? SECTIONS[0]; }

export const PLANNER = Object.freeze({
  block: 4,
  horizon: 4,
  steps: 8,
  hot: 2.0,
  cold: 0.15,
  arcWeight: 6.0,
  change: 1.0,
  lineDiscount: { 8: 0.4, 16: 0.7 },
  early: 8.0,
  late: 0.6,
  steerSection: 1.6,
  steerEnergy: 0.22,
  vote: 0.8,
  setBars: 96,
  endEarly: 5.0,
  endFrom: 0.72,
});

// the arc: [start bar, energy] points, a straight line between them, for a ~96-bar set
export const ARC = [
  [0, 0.3], [8, 0.35], [16, 0.7], [20, 0.9], [40, 0.9], [44, 0.32], [52, 0.35], [56, 0.75], [60, 0.95], [80, 0.92],
  [84, 0.38], [92, 0.3], [96, 0.06],
];

export const THEME_ENERGY = { crystals: -0.06, highlands: 0.02, deepsea: -0.12, cathedral: -0.09, embers: 0.08 };

export function arcTarget(setBar, shift = 0) {
  const b = Math.max(0, setBar);
  let v = ARC[ARC.length - 1][1];
  for (let i = 1; i < ARC.length; i++) {
    const [b0, e0] = ARC[i - 1];
    const [b1, e1] = ARC[i];
    if (b <= b1) { v = e0 + ((e1 - e0) * (b - b0)) / (b1 - b0); break; }
  }
  return Math.min(1, Math.max(0, v + shift));
}

export const TRANSITION_FX = {
  drop: ['riser', 'snare-roll'],
  dropLast: ['one-bar-silence', 'reverse-cymbal', 'filter-drop'],
  landing: ['downlifter'],
  breakdown: ['tape-stop-bus', 'reverse-cymbal', 'filter-drop'],
  outro: ['downlifter', 'filter-drop'],
  hum: ['filter-drop', 'tape-stop-bus'],
  lift: ['key-lift'],
};

// every plan: a list of `horizon` section keys, one per block, from the state (section, barsIn) at the plan's start
export function enumeratePlans(from, { horizon = PLANNER.horizon } = {}) {
  const out = [];
  const walk = (plan, sec, barsIn) => {
    if (plan.length === horizon) { out.push(plan.slice()); return; }
    // stay
    plan.push(sec); walk(plan, sec, barsIn + PLANNER.block); plan.pop();
    // or move on, when the grammar allows
    for (const nx of sectionOf(sec).next) { plan.push(nx); walk(plan, nx, PLANNER.block); plan.pop(); }
  };
  walk([], from.section, from.barsIn);
  return out;
}

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// G for one plan, from the state at the first planned block; ctx = { setBar, section, barsIn, shift, steer, votes }
export function planCost(plan, ctx) {
  const parts = { arc: 0, habit: 0, you: 0, votes: 0, length: 0 };
  let sec = ctx.section;
  let barsIn = ctx.barsIn;
  let setBar = ctx.setBar;
  const steer = ctx.steer ?? {};
  for (const nx of plan) {
    if (nx !== sec) {
      // the habit: a change costs, less on an 8 or 16 bar line of the set
      let c = PLANNER.change;
      if (setBar % 16 === 0) c -= PLANNER.lineDiscount[16];
      else if (setBar % 8 === 0) c -= PLANNER.lineDiscount[8];
      parts.habit += c;
      if (barsIn < sectionOf(sec).min) parts.length += PLANNER.early;
      sec = nx;
      barsIn = 0;
    }
    // the end of a set belongs near the end of the arc: an outro before ~72% of the set costs extra (a theme push
    // toward a new set pays it back)
    if (sec === 'outro' && setBar < PLANNER.endFrom * PLANNER.setBars) parts.length += PLANNER.endEarly * (1 - 0.8 * Math.max(0, clamp(Number(steer.theme) || 0, -1, 1)));
    if (barsIn >= sectionOf(sec).max) parts.length += PLANNER.late * (1 + (barsIn - sectionOf(sec).max) / PLANNER.block);
    const S = sectionOf(sec);
    for (let j = 0; j < PLANNER.block; j++) {
      const target = arcTarget(setBar + j, ctx.shift ?? 0);
      parts.arc += PLANNER.arcWeight * ((S.energy - target) ** 2) / PLANNER.block;
    }
    // THE STEERING: static leans toward the quiet sections, theme toward the end of the set
    const st = clamp(Number(steer.static) || 0, -1, 1);
    const th = clamp(Number(steer.theme) || 0, -1, 1);
    if (sec === 'breakdown' || sec === 'hum') parts.you -= PLANNER.steerSection * st * 0.5;
    if (sec === 'peak') parts.you += PLANNER.steerSection * st * 0.3;
    if (sec === 'outro' || sec === 'hum') parts.you -= PLANNER.steerSection * th * 0.5;
    const v = ctx.votes?.sections?.[sec];
    if (Number.isFinite(v)) parts.votes -= PLANNER.vote * clamp(v, -1, 1) * 0.5;
    barsIn += PLANNER.block;
    setBar += PLANNER.block;
  }
  const G = parts.arc + parts.habit + parts.you + parts.votes + parts.length;
  return { G, parts };
}

export function settlePlans(scored, r, { steps = PLANNER.steps, hot = PLANNER.hot, cold = PLANNER.cold } = {}) {
  const trace = [];
  let pick = 0;
  const min = Math.min(...scored.map((s) => s.G));
  let probs = [];
  for (let k = 0; k < steps; k++) {
    const T = hot * Math.pow(cold / hot, steps > 1 ? k / (steps - 1) : 1);
    const w = scored.map((s) => Math.exp(-(s.G - min) / T));
    const z = w.reduce((a, b) => a + b, 0);
    probs = w.map((x) => x / z);
    let x = r() * z;
    pick = scored.length - 1;
    for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) { pick = i; break; } }
    trace.push({ T, pick, p: probs[pick] });
  }
  return { pick, probs, trace };
}

// one transition's move: fit (each move's base preference), votes for it, and the habit prior against the last move
export function chooseFx(kind, r, { last = [], votes = null, hot = 1.5, cold = 0.2, steps = 6 } = {}) {
  const list = TRANSITION_FX[kind] ?? [];
  if (!list.length) return null;
  const scored = list.map((key, i) => {
    let G = 0.15 * i; // the list is in order of fit
    if (last[0] === key) G += 2.5; // THE HABIT: never the same move twice running when another fits
    else if (last.includes(key)) G += 0.8;
    const v = votes?.fx?.[key];
    if (Number.isFinite(v)) G -= 0.8 * clamp(v, -1, 1);
    return { key, G };
  });
  const s = settlePlans(scored, r, { hot, cold, steps });
  return scored[s.pick].key;
}

export function createPlanner({ seed = 1, start = 'intro', setBars = PLANNER.setBars } = {}) {
  const r = deckRng((Number(seed) >>> 0) || 1);
  let setBar = 0; // bars into this set
  let set = 0; // which set (0 the first)
  let section = start;
  let barsIn = 0;
  let nextSection = start; // committed one block ahead
  let pending = new Map(); // bar (setBar) -> moves starting then
  let lastPlan = null;
  let keyLift = 0;
  let peaks = 0;
  const lastFx = [];
  const history = [];
  const setEnergies = [];

  function pushFx(key) { if (!key) return; lastFx.unshift(key); if (lastFx.length > 4) lastFx.pop(); }

  // schedule the moves for a change from `a` to `b` on the line at set bar L
  function scheduleTransition(a, b, L, votes) {
    const add = (bar, mv) => { if (bar < setBar) return; const k = pending.get(bar) ?? []; k.push(mv); pending.set(bar, k); };
    if (b === 'peak') {
      const up = chooseFx('drop', r, { last: lastFx, votes });
      pushFx(up);
      add(L - 2, { key: up, bars: 2, end: L });
      const last = chooseFx('dropLast', r, { last: lastFx, votes });
      pushFx(last);
      add(L - 1, { key: last, bars: 1, end: L });
      add(L, { key: 'downlifter', bars: 1, end: L + 1 });
      if (peaks >= 1) add(L, { key: 'key-lift', bars: 1, end: L + 1, lift: 2 });
    } else if (b === 'breakdown') {
      const k = chooseFx('breakdown', r, { last: lastFx, votes });
      pushFx(k);
      add(L - 1, { key: k, bars: 1, end: L });
    } else if (b === 'outro') {
      const k = chooseFx('outro', r, { last: lastFx, votes });
      pushFx(k);
      add(L - 1, { key: k, bars: 1, end: L });
    } else if (b === 'hum') {
      const k = chooseFx('hum', r, { last: lastFx, votes });
      pushFx(k);
      add(L - 1, { key: k, bars: 1, end: L });
    }
    void a;
  }

  const planner = {
    get state() { return { setBar, set, section, barsIn, nextSection, keyLift, peaks, plan: lastPlan }; },
    get history() { return history.slice(); },
    // inputs: { mood: { heat, landed, film, word }, theme (key), steer: { static, theme, energy }, votes, influence }
    bar(inputs = {}) {
      let newSet = false;
      let changed = false;
      // the first bar of a block: the committed section takes over, and the next block is settled now
      if (setBar % PLANNER.block === 0) {
        if (nextSection !== section) {
          if (nextSection === 'intro') {
            // a NEW SET: the bar count starts again
            setEnergies.unshift(history.length ? history.slice(-setBar).reduce((a, h) => a + h.energyTarget, 0) / Math.max(1, setBar) : 0.5);
            set += 1;
            setBar = 0;
            peaks = 0;
            keyLift = 0;
            pending = new Map();
            newSet = true;
          }
          if (nextSection === 'peak') peaks += 1;
          if (nextSection !== 'peak') keyLift = 0;
          section = nextSection;
          barsIn = 0;
          changed = true;
        }
        const mood = inputs.mood ?? {};
        const steer = inputs.steer ?? {};
        const infl = Number.isFinite(inputs.influence?.energy) ? (inputs.influence.energy - 0.55) * 0.1 : 0;
        const shift = (THEME_ENERGY[inputs.theme] ?? 0)
          + 0.12 * ((Number(mood.heat) || 0) - 0.4)
          - (mood.landed ? 0.05 : 0)
          + PLANNER.steerEnergy * clamp(Number(steer.energy) || 0, -1, 1)
          + infl;
        // the state at the start of the next block, with the current block counted
        const from = { section, barsIn: barsIn + PLANNER.block };
        const plans = enumeratePlans(from);
        const ctx = { setBar: setBar + PLANNER.block, section, barsIn: barsIn + PLANNER.block, shift, steer, votes: inputs.votes };
        const scored = plans.map((p) => ({ plan: p, ...planCost(p, ctx) }));
        const s = settlePlans(scored, r);
        const chosen = scored[s.pick];
        const order = scored.map((x, i) => ({ ...x, p: s.probs[i] })).sort((a, b) => a.G - b.G);
        lastPlan = { from: section, at: setBar, chosen: chosen.plan, G: chosen.G, parts: chosen.parts, top: order.slice(0, 5), trace: s.trace, count: scored.length, shift };
        const nx = chosen.plan[0];
        if (nx !== section) scheduleTransition(section, nx, setBar + PLANNER.block, inputs.votes);
        nextSection = nx;
      }
      const moves = pending.get(setBar) ?? [];
      pending.delete(setBar);
      for (const m of moves) if (m.key === 'key-lift') keyLift = m.lift ?? 2;
      const S = sectionOf(section);
      const out = {
        set,
        setBar,
        section,
        label: S.label,
        barsIn,
        changed,
        newSet,
        lines: { 4: setBar % 4 === 0, 8: setBar % 8 === 0, 16: setBar % 16 === 0 },
        energyTarget: arcTarget(setBar, lastPlan?.shift ?? 0),
        sectionEnergy: S.energy,
        moves,
        keyLift,
        next: nextSection,
        nextAt: setBar - (setBar % PLANNER.block) + PLANNER.block,
        plan: lastPlan,
      };
      history.push({ set, setBar, section, energyTarget: out.energyTarget, moves: moves.map((m) => m.key) });
      if (history.length > 256) history.shift();
      setBar += 1;
      barsIn += 1;
      return out;
    },
    get setEnergies() { return setEnergies.slice(); },
    // a replay (dj-replay.js): put the planner at a section, a bar of a set and a set number, nothing pending
    force({ section: sec = 'intro', setBar: sb = 0, set: sn = 0, keyLift: kl = 0 } = {}) {
      section = SECTION_KEYS.includes(sec) ? sec : 'intro';
      nextSection = section;
      setBar = Math.max(0, sb | 0);
      set = Math.max(0, sn | 0);
      barsIn = setBar % PLANNER.block;
      keyLift = kl | 0;
      pending = new Map();
    },
  };
  return planner;
}
