// settle-hear · dj-view - THE TRAINED SET, SEEN WHOLE (lane DJVISUAL, navigator 2026-10-06: "And the DJ settles a
// track, yes? All at once, in one shot? Can we have a full visualiser"). The trained DJ settles a whole set in one
// shot (dj-trained.js); this file turns that set into a small, read-only public view that a page can draw: the grid of
// roles by 8-bar blocks, the lines where a drop wants to land and the drops where it did, the sections, the phrase
// events, the arc, the feel and where the set came from. Pure: no audio.
//
// <claudes_code_comments>
// ** Function List **
// VIEW_FORMAT                 - 'dj-view/v1'
// setView(set)                - the trained set's public view, built once per set (a WeakMap cache) and frozen:
//                               { format, family, seed, blocks, bars, roles, grid, gates, lines, drops, exits,
//                               sections, arc, events, feel, clap, piece, fence, notes }
// grooveView(groove)          - one bar's settled groove (dj-trained-plan.js barOf) as plain levels per role
// tuneView(notes, max)        - a composed tune's notes as [[beats, midi or null], ...], at most `max`, cached per array
// barOfSet(view, setBar)      - where a set bar sits: { bar, block, k, of, inSet, drop, nextDrop, section }
//
// ** Technical Review **
// - ONE VIEW A SET: the trained planner (dj-trained-plan.js) hands the view on every bar, so the object must be the
//   same object bar after bar (djLive copies nothing big, and a reader can compare by identity to see a new set).
//   The cache is a WeakMap on the settled set, so a set that is gone takes its view with it.
// - THE LINES: lineKind (dj-trained.js) per block, 0 a 32-bar line, 1 a 16-bar line, 2 an 8-bar line. Stage 2's drop
//   pull rewards a drop that lands on a 16- or 32-bar line, so `lines` is where the drops WANT to land and `drops`
//   (dj-trained-plan.js dropsOf: the blocks where the kick returns) is where they DID.
// - THE SECTIONS are dj-trained-plan.js sectionsOf, read at each block's first bar; the build that takes only the last
//   half block is kept at block grain (the view is drawn a block a column).
// - THE FENCE: a piece (stage 3, lane DJNOTES) was settled and fenced on the Spark, so its fence is 'spark' (0 near
//   copies, REPORT_TIMING.md 8.6); a set settled here is never checked (the keys of real bars stay on the Spark), so its
//   fence is 'none'. A page says which, never more.
// - Plain data only, frozen: arrays of numbers and strings, so a reader can store or send it as it is.
// </claudes_code_comments>

import { lineKind } from './dj-trained.js';
import { dropsOf, exitsOf, sectionsOf } from './dj-trained-plan.js';

export const VIEW_FORMAT = 'dj-view/v1';

const views = new WeakMap();
const freezeDeep = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) freezeDeep(v);
  }
  return o;
};

export function setView(set) {
  if (!set || typeof set !== 'object' || !Array.isArray(set.grid) || !Array.isArray(set.roles)) return null;
  const hit = views.get(set);
  if (hit) return hit;
  const T = Math.max(0, set.blocks | 0);
  const secBars = sectionsOf(set);
  const order = Array.isArray(set.events_order) ? set.events_order.slice() : [];
  const view = freezeDeep({
    format: VIEW_FORMAT,
    family: set.family ?? null,
    seed: Number.isFinite(set.seed) ? set.seed >>> 0 : null,
    blocks: T,
    bars: 8 * T,
    roles: set.roles.slice(),
    grid: set.grid.map((row) => Array.from({ length: T }, (_, t) => (row[t] === 1 ? 1 : 0))),
    gates: Array.from({ length: T }, (_, t) => (set.gates?.[t] === 1 ? 1 : 0)),
    lines: Array.from({ length: T }, (_, t) => lineKind(t, 0)),
    drops: dropsOf(set),
    exits: exitsOf(set),
    sections: Array.from({ length: T }, (_, t) => secBars[8 * t] ?? null),
    arc: Array.from({ length: T }, (_, t) => (Number.isFinite(set.arc?.[t]) ? Math.round(set.arc[t] * 1000) / 1000 : 0)),
    events: { order, rows: order.map((_, e) => String(set.events?.[e] ?? '').slice(0, 8 * T)) },
    feel: { swing: Number(set.feel?.swing) || 0, swung: !!set.feel?.swung, played: !!set.feel?.played },
    clap: !!set.clap,
    piece: set.piece ? { id: set.piece.id ?? null, name: set.piece.name ?? null } : null,
    fence: set.piece ? 'spark' : 'none',
    notes: !!set.notes,
  });
  views.set(set, view);
  return view;
}

const level = (c) => (c >= '1' && c <= '9' ? Number(c) / 9 : 0);
export function grooveView(groove) {
  if (!groove || typeof groove !== 'object' || !groove.steps) return null;
  const steps = {};
  for (const [role, row] of Object.entries(groove.steps)) {
    steps[role] = Array.from(row ?? [], (v) => (typeof v === 'string' ? level(v) : Math.max(0, Math.min(1, Number(v) || 0))));
  }
  const events = {};
  for (const [k, v] of Object.entries(groove.events ?? {})) events[k] = !!v;
  return { bar: groove.bar ?? null, steps, hats: typeof groove.hats === 'string' ? groove.hats : '', events };
}

const tunes = new WeakMap();
export function tuneView(notes, max = 48) {
  if (!Array.isArray(notes)) return null;
  const hit = tunes.get(notes);
  if (hit && hit.max === max) return hit.out;
  const out = Object.freeze(notes.slice(0, max).map((n) => Object.freeze([Number(n?.beats) || 0, Number.isFinite(n?.midi) ? n.midi : null])));
  tunes.set(notes, { max, out });
  return out;
}

export function barOfSet(view, setBar) {
  if (!view) return null;
  const b = Math.max(0, Number(setBar) | 0);
  const inSet = b < view.bars;
  const block = Math.floor(b / 8);
  const drop = view.drops.includes(block) && b % 8 === 0;
  const after = view.drops.find((t) => 8 * t > b);
  return { bar: b, block, k: b % 8, of: view.bars, inSet, drop, nextDrop: after == null ? null : 8 * after, section: inSet ? view.sections[block] : 'hum' };
}
