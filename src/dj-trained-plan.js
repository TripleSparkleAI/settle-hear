// settle-hear · dj-trained-plan - THE TRAINED PLANNER: a set settled from THE DJ's trained models (dj-trained.js)
// turned into the house DJ's bars. It answers the same question the planner (mix-planner.js) answers, bar by bar
// (which section, which transition moves), from the settled arrangement instead of the hand-written arc; and it adds
// what the old planner never had: which layers play in each 8-bar block, the bar's settled drum steps, its phrase
// events and the set's feel. Pure: no audio.
//
// <claudes_code_comments>
// ** Function List **
// THEME_FAMILY                - each theme's genre families (dealt per set) and the drum kit style per family
// FAMILY_STYLE                - the drum style (its kit) a family plays on
// HUM_BARS                    - the warm-down after a trained set, in bars
// TRAINED_LAYERS              - the grid roles that decide each mix layer (drums, bass, pad, lead, arps, answer, chain)
// layersOf(set, t)            - block t's layer targets from the grid
// sectionsOf(set)             - every bar's section, read from the grid: intro before the kick's first entry, peak
//                               where it plays, breakdown where it rests inside, build on the last block (or the last
//                               half block) before a drop, outro after its last block
// dropsOf(set) / exitsOf(set) - the blocks where the kick returns (the drops) and where it leaves inside the set
// movesOf(set, r)             - the transition moves, placed where the trained set put its changes: a riser over the
//                               settled lift bars into a drop (else over two bars when the fx role is on), a snare roll
//                               where the roll events sit before a drop, a reverse cymbal into a settled crash, a
//                               downlifter on each drop's first bar, a key lift from the second drop on, and the old
//                               DJ's breakdown, outro and hum moves at the trained lines
// barOf(set, b)               - one bar's groove: the settled steps per role as levels, the hat voices, the events
// createTrainedPlanner(opts)  - .load(set, { set }) starts a set; .bar(inputs) -> the planner's bar shape plus
//                               `trained` (family, block, bar in block, layers, the bar's groove, the feel, and since
//                               lane DJVISUAL `view`, the whole set seen at once, dj-view.js); .state;
//                               .force({ setBar }) (a replay); .endSoon() (a theme push: to the warm-down at the next
//                               8-bar line); .done (the set and its warm-down have ended)
//
// ** Technical Review **
// - THE CONTRACT WITH mix-dj.js is mix-planner.js's bar shape: { set, setBar, section, label, barsIn, changed, newSet,
//   lines, energyTarget, sectionEnergy, moves, keyLift, next, nextAt, plan }. plan carries { chosen, G, parts, top,
//   count, at } for the DJ panel; G is 0 and the single top plan is the settled arrangement (there is no search here:
//   the arrangement was settled once, at the start of the set).
// - THE LINES are the set's own: bar 0 of a set is a 32-bar line, as compose2.py settles it (offset 0), so a change
//   the trained set places on a 32-bar line lands on setBar % 32 === 0 of THE MASTER BEAT's bar grid.
// - THE LAYERS: the mix machine still settles the eleven things once a bar (mix-machine.js), with the steering, the
//   votes and the holds as before; for the seven things the grid decides, the section's lean is replaced by a strong
//   lean from the grid (TRAINED_LEAN in mix-machine.js). So the trained set decides what plays and the visitor's
//   steering still moves it.
// - THE MOVES keep the old DJ's vocabulary (riser, snare roll, reverse cymbal, downlifter, key lift, tape stop,
//   filter drop) and change WHERE they land: on the trained set's drops, exits and lift bars. chooseFx (mix-planner.js)
//   keeps the habit against repeating the last move.
// - After the set's last block, HUM_BARS of THE NEUTRAL HUM, then the planner reports done and the brain starts a
//   new set.
// </claudes_code_comments>

import { deckRng } from './deck.js';
import { sectionOf, chooseFx } from './mix-planner.js';
import { notesOfBar } from './dj-trained-notes.js';
import { setView } from './dj-view.js'; // THE SET SEEN WHOLE (lane DJVISUAL): one frozen view a set, handed on every bar

export const THEME_FAMILY = {
  crystals: ['ambient', 'synth'],
  highlands: ['house', 'trance'],
  deepsea: ['techno', 'ambient'],
  cathedral: ['ambient', 'trance'],
  embers: ['techno', 'breaks', 'house'],
};
export const FAMILY_STYLE = {
  house: ['chicago', 'deep'],
  techno: ['tech', 'dub-techno'],
  trance: ['progressive'],
  ambient: ['ambient'],
  breaks: ['garage'],
  eurodance: ['filter-house'],
  synth: ['balearic'],
  electronic: ['tech'],
};
export const HUM_BARS = 8;
export const TRAINED_LAYERS = {
  drums: ['kick', 'snare', 'hats', 'perc'],
  bass: ['bass'],
  pad: ['chords'],
  lead: ['lead', 'vocal'],
  arps: ['arp'],
  answer: ['vocal'],
  chain: ['fx'],
};

const on = (set, role, t) => {
  const r = set.roles.indexOf(role);
  return r >= 0 && t >= 0 && t < set.blocks && set.grid[r][t] === 1;
};

export function layersOf(set, t) {
  const out = {};
  for (const [k, roles] of Object.entries(TRAINED_LAYERS)) out[k] = roles.some((r) => on(set, r, t));
  return out;
}

// the row that marks a drop: the kick, or the drums when the kick never plays
function dropRow(set) {
  const T = set.blocks;
  const kick = Array.from({ length: T }, (_, t) => on(set, 'kick', t));
  if (kick.some(Boolean)) return kick;
  return Array.from({ length: T }, (_, t) => ['kick', 'snare', 'hats', 'perc'].some((r) => on(set, r, t)));
}

export function dropsOf(set) {
  const k = dropRow(set);
  const out = [];
  for (let t = 1; t < k.length; t++) if (k[t] && !k[t - 1]) out.push(t);
  return out;
}

export function exitsOf(set) {
  const k = dropRow(set);
  const last = k.lastIndexOf(true);
  const out = [];
  for (let t = 1; t <= last; t++) if (!k[t] && k[t - 1]) out.push(t);
  return out;
}

export function sectionsOf(set) {
  const T = set.blocks;
  const k = dropRow(set);
  const out = new Array(8 * T);
  const first = k.indexOf(true);
  const last = k.lastIndexOf(true);
  if (first < 0) {
    // no drums at all: the arc decides (above the middle is the peak), the first block opens, the last closes
    const sorted = set.arc.slice().sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length / 2)];
    for (let t = 0; t < T; t++) {
      const s = t === 0 ? 'intro' : t === T - 1 && T > 2 ? 'outro' : set.arc[t] >= mid ? 'peak' : 'breakdown';
      for (let b = 0; b < 8; b++) out[8 * t + b] = s;
    }
    return out;
  }
  for (let t = 0; t < T; t++) {
    const s = t < first ? 'intro' : t > last ? 'outro' : k[t] ? 'peak' : 'breakdown';
    for (let b = 0; b < 8; b++) out[8 * t + b] = s;
  }
  // the build: the last block before a drop when the rest before it is 2 blocks or more, else its last half
  for (const t of dropsOf(set).concat(first > 0 ? [first] : [])) {
    let L = 0;
    while (t - 1 - L >= 0 && !k[t - 1 - L]) L += 1;
    if (L === 0) continue;
    const from = L >= 2 ? 8 * (t - 1) : 8 * (t - 1) + 4;
    for (let b = from; b < 8 * t; b++) out[b] = 'build';
  }
  return out;
}

const ev = (set, name, b) => {
  const e = set.events_order.indexOf(name);
  return e >= 0 && b >= 0 && b < 8 * set.blocks && set.events[e][b] === 'x';
};

export function movesOf(set, r, { last = [], votes = null } = {}) {
  const moves = new Map();
  const add = (bar, mv) => { if (bar < 0) return; const k = moves.get(bar) ?? []; k.push(mv); moves.set(bar, k); };
  const mem = last.slice();
  const pick = (kind) => { const k = chooseFx(kind, r, { last: mem, votes }); if (k) { mem.unshift(k); if (mem.length > 4) mem.pop(); } return k; };
  dropsOf(set).forEach((t, i) => {
    const L = 8 * t;
    let lift = 0;
    while (lift < 4 && ev(set, 'lift', L - 1 - lift)) lift += 1;
    let roll = 0;
    while (roll < 2 && ev(set, 'roll', L - 1 - roll)) roll += 1;
    const crash = ev(set, 'crash', L);
    const fx = on(set, 'fx', t - 1) || on(set, 'fx', t);
    if (lift) add(L - lift, { key: 'riser', bars: lift, end: L, why: 'the settled lift bars' });
    else if (fx) add(L - 2, { key: 'riser', bars: 2, end: L, why: 'the fx role' });
    if (roll) add(L - roll, { key: 'snare-roll', bars: roll, end: L, why: 'the settled roll' });
    if (crash) add(L - 1, { key: 'reverse-cymbal', bars: 1, end: L, why: 'into the settled crash' });
    if (!lift && !roll && !crash && !fx) add(L - 1, { key: pick('dropLast'), bars: 1, end: L, why: 'the DJ' });
    add(L, { key: 'downlifter', bars: 1, end: L + 1, why: 'the landing' });
    if (i >= 1) add(L, { key: 'key-lift', bars: 1, end: L + 1, lift: 2, why: 'a second drop' });
  });
  for (const t of exitsOf(set)) add(8 * t - 1, { key: pick('breakdown'), bars: 1, end: 8 * t, why: 'into the breakdown' });
  const sec = sectionsOf(set);
  const outro = sec.indexOf('outro');
  if (outro > 0) add(outro - 1, { key: pick('outro'), bars: 1, end: outro, why: 'into the outro' });
  add(8 * set.blocks - 1, { key: pick('hum'), bars: 1, end: 8 * set.blocks, why: 'into the hum' });
  return moves;
}

const level = (c) => (c >= '1' && c <= '9' ? Number(c) / 9 : 0);

export function barOf(set, b) {
  if (b < 0 || b >= 8 * set.blocks) return null;
  const steps = {};
  set.groove_roles.forEach((r, i) => { steps[r] = Array.from(set.steps[b][i] ?? '', level); });
  const events = {};
  set.events_order.forEach((name, e) => { events[name] = set.events[e][b] === 'x'; });
  return { bar: b, block: Math.floor(b / 8), k: b % 8, steps, hats: set.hats[b] ?? '', events, crash: events.crash };
}

export function createTrainedPlanner({ seed = 1 } = {}) {
  const r = deckRng(((Number(seed) >>> 0) ^ 0x7f4a7c15) >>> 0 || 1);
  let S = null;
  let sections = [];
  let moves = new Map();
  let setNo = 0;
  let setBar = 0;
  let section = 'intro';
  let barsIn = 0;
  let keyLift = 0;
  let total = 0;
  let ending = false;
  const lastFx = [];
  const planner = {
    get set() { return S; },
    get state() { return { setBar, set: setNo, section, barsIn, keyLift, trained: S ? { family: S.family, seed: S.seed, blocks: S.blocks } : null }; },
    get done() { return !S || setBar >= total; },
    // a full push toward a new theme: the set goes to its warm-down at the next 8-bar line (after its first 32 bars)
    endSoon() { ending = true; },
    load(set, { set: n = setNo + 1, votes = null } = {}) {
      S = set;
      sections = sectionsOf(set);
      for (let b = 0; b < HUM_BARS; b++) sections.push('hum');
      total = sections.length;
      moves = movesOf(set, r, { last: lastFx, votes });
      for (const list of moves.values()) for (const m of list) if (m.key && !['downlifter', 'key-lift'].includes(m.key)) { lastFx.unshift(m.key); if (lastFx.length > 4) lastFx.pop(); }
      setNo = n;
      ending = false;
      setBar = 0;
      section = sections[0];
      barsIn = 0;
      keyLift = 0;
    },
    // a replay: jump to a bar of the loaded set, nothing in flight
    force({ setBar: sb = 0 } = {}) {
      setBar = Math.max(0, Math.min(total - 1, sb | 0));
      section = sections[setBar];
      let b = setBar;
      while (b > 0 && sections[b - 1] === section) b -= 1;
      barsIn = setBar - b;
    },
    bar(inputs = {}) {
      if (!S) throw new Error('no trained set loaded');
      if (ending && setBar % 8 === 0 && setBar >= 32 && setBar < 8 * S.blocks) setBar = 8 * S.blocks;
      const newSet = setBar === 0;
      const sec = sections[Math.min(setBar, total - 1)];
      const changed = newSet || sec !== section;
      if (changed && !newSet) barsIn = 0;
      section = sec;
      const list = (moves.get(setBar) ?? []).filter((m) => m.key);
      for (const m of list) if (m.key === 'key-lift') keyLift = m.lift ?? 2;
      if (sec !== 'peak' && sec !== 'build') keyLift = 0;
      const t = Math.floor(setBar / 8);
      const inSet = setBar < 8 * S.blocks;
      let nextAt = setBar + 1;
      while (nextAt < total && sections[nextAt] === sec) nextAt += 1;
      const next = nextAt < total ? sections[nextAt] : 'intro';
      const chosen = [4, 8, 12, 16].map((d) => sections[Math.min(total - 1, setBar - (setBar % 4) + d)] ?? 'intro');
      const S2 = sectionOf(sec);
      const arcT = inSet ? S.arc[t] : -1;
      const out = {
        set: setNo,
        setBar,
        section: sec,
        label: S2.label,
        barsIn,
        changed,
        newSet,
        lines: { 4: setBar % 4 === 0, 8: setBar % 8 === 0, 16: setBar % 16 === 0, 32: setBar % 32 === 0 },
        energyTarget: inSet ? Math.min(1, Math.max(0, (arcT + 1) / 2)) : S2.energy,
        sectionEnergy: S2.energy,
        moves: list.map(({ key, bars, end, lift }) => (lift ? { key, bars, end, lift } : { key, bars, end })),
        keyLift,
        next,
        nextAt,
        plan: {
          from: sec,
          at: setBar,
          chosen,
          G: 0,
          parts: { trained: 0 },
          top: [{ plan: chosen, G: 0, p: 1 }],
          trace: [],
          count: 1,
          shift: 0,
          trained: { family: S.family, seed: S.seed, blocks: S.blocks },
        },
        trained: inSet ? {
          family: S.family,
          seed: S.seed,
          blocks: S.blocks,
          block: t,
          gate: S.gates[t] === 1,
          layers: layersOf(S, t),
          groove: barOf(S, setBar),
          feel: S.feel,
          clap: S.clap,
          // STAGE 3's seam (dj-trained-notes.js): a piece's pitched notes for this bar, by role, or null
          notes: S.notes ? notesOfBar(S.notes, setBar) : null,
          piece: S.piece ?? null,
          // lane PIECESPLAY: a piece's chord of this bar (stage 3's label and its name), or null for a settled set
          chord: S.chords?.length ? { label: S.chords[setBar] ?? null, name: S.chordNames?.[setBar] ?? null } : null,
          view: setView(S),
        } : { family: S.family, seed: S.seed, blocks: S.blocks, block: t, gate: false, layers: null, groove: null, feel: S.feel, clap: S.clap, notes: null, piece: S.piece ?? null, chord: null, view: setView(S) },
      };
      void inputs;
      setBar += 1;
      barsIn += 1;
      return out;
    },
  };
  return planner;
}
