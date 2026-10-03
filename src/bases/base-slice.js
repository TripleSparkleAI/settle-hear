// settle-hear · bases/base-slice - SLICING AND COMBINING: any part or any bar range of a base taken on its own, and
// slices from different bases laid together into one base, with the compatibility rule asked first. Timing is
// preserved by construction: a slice re-bases ticks by a whole number of bars, and a combine rescales a coarser
// grid onto a finer one by a whole factor. Pure.
//
// <claudes_code_comments>
// ** Function List **
// slice(base, { parts, bars, loop }) - a slice: { from: base.id, parts, bars, grid, meter, tempo, key, swing } with
//                              every event re-based so the slice's first bar is tick 0; an event that runs past the
//                              end is cut at the end; `bars` is [from, to) in bars (default the whole base)
// transposeSlice(s, semitones) - every pitched event moved by a whole number of semitones (drums untouched)
// loopSlice(s, bars)         - the slice tiled to a longer bar count (a 4-bar groove under an 8-bar pad)
// rescaleSlice(s, grid)      - the slice on a finer grid (ticks x grid/s.grid, a whole factor, else refused)
// combine(slices, opts)      - the slices laid together into one base: { ok, base, reasons, compat }; the first
//                              slice is the anchor (its meter and key); every other slice must be compatible with
//                              it (compatible() from base-format.js), is transposed onto its key when the rule says
//                              so, and is looped to the longest slice's bar count; the same part from two slices is
//                              the later one's unless { merge: true }
// sliceBarOf(slice, bar)          - the events of one bar of a slice, re-based to that bar's start
//
// ** Technical Review **
// - A slice is not a base: it has no id of its own, no features and no quantise record; it names the base it came
//   from (`from`) and the bar range (`range`). combine() makes a base again (origin 'combined', id 'combined-<n>'),
//   with fresh features and a fresh signature, so a combined base can itself be sliced.
// - The grid is the finest of the slices. A 4-grid house slice under an 8-grid ambient slice is rescaled by 2;
//   a 3-grid against a 4-grid would need a 12-grid, which this refuses rather than rounding a tick.
// - The tempo of a combined base is the point the compatibility rule found inside the overlap of every range, and
//   the range is the overlap itself (with the 8% tolerance applied), so a combined base is playable at one tempo.
// </claudes_code_comments>

import { BASE_FORMAT, PARTS, PITCHED_PARTS, ticksPerBar, compatible } from './base-format.js';
import { partFeatures, keyOf, signatureOf } from './base-features.js';

let combinedCount = 0;

export function slice(base, { parts = null, bars = null, loop = null } = {}) {
  const tpb = ticksPerBar(base);
  const [from, to] = bars ?? [0, base.bars];
  const f = Math.max(0, Math.min(base.bars, from | 0));
  const t = Math.max(f + 1, Math.min(base.bars, to | 0));
  const want = parts ? parts.filter((p) => PARTS.includes(p)) : PARTS;
  const out = {};
  const t0 = f * tpb;
  const total = (t - f) * tpb;
  for (const p of want) {
    const ev = base.parts?.[p]?.events ?? [];
    const cut = ev.filter((e) => e[0] >= t0 && e[0] < t0 + total).map((e) => [e[0] - t0, Math.min(e[1], t0 + total - e[0]), e[2], e[3]]);
    if (cut.length) out[p] = { events: cut };
  }
  const s = {
    from: base.id,
    range: [f, t],
    parts: out,
    bars: t - f,
    grid: base.grid,
    meter: { ...(base.meter ?? { num: 4, den: 4 }) },
    tempo: { ...(base.tempo ?? { bpm: 120, min: 110, max: 130 }) },
    key: base.key ? { ...base.key } : null,
    swing: base.swing ?? 0,
    kind: base.kind,
    family: base.family,
  };
  return loop ? loopSlice(s, loop) : s;
}

export function transposeSlice(s, semitones) {
  const n = semitones | 0;
  if (!n) return s;
  const parts = {};
  for (const [p, part] of Object.entries(s.parts)) {
    parts[p] = PITCHED_PARTS.includes(p)
      ? { events: part.events.map((e) => [e[0], e[1], e[2], e[3] == null ? null : Math.max(0, Math.min(127, e[3] + n))]) }
      : { events: part.events.map((e) => e.slice()) };
  }
  const key = s.key ? { ...s.key, pc: ((s.key.pc + n) % 12 + 12) % 12 } : null;
  return { ...s, parts, key, transposed: (s.transposed ?? 0) + n };
}

export function loopSlice(s, bars) {
  const n = Math.max(1, bars | 0);
  if (n === s.bars) return s;
  const tpb = ticksPerBar(s);
  const total = n * tpb;
  const parts = {};
  for (const [p, part] of Object.entries(s.parts)) {
    const ev = [];
    for (let k = 0; k * s.bars * tpb < total; k++) {
      const off = k * s.bars * tpb;
      for (const e of part.events) {
        const t = e[0] + off;
        if (t >= total) break;
        ev.push([t, Math.min(e[1], total - t), e[2], e[3]]);
      }
    }
    parts[p] = { events: ev };
  }
  return { ...s, parts, bars: n, looped: s.bars };
}

export function rescaleSlice(s, grid) {
  if (grid === s.grid) return s;
  if (grid % s.grid !== 0) throw new Error(`grid ${s.grid} does not divide ${grid}`);
  const k = grid / s.grid;
  const parts = {};
  for (const [p, part] of Object.entries(s.parts)) parts[p] = { events: part.events.map((e) => [e[0] * k, e[1] * k, e[2], e[3]]) };
  return { ...s, parts, grid };
}

export function sliceBarOf(s, bar) {
  const tpb = ticksPerBar(s);
  const t0 = bar * tpb;
  const out = {};
  for (const [p, part] of Object.entries(s.parts)) {
    const ev = part.events.filter((e) => e[0] >= t0 && e[0] < t0 + tpb).map((e) => [e[0] - t0, e[1], e[2], e[3]]);
    if (ev.length) out[p] = ev;
  }
  return out;
}

export function combine(slices, { merge = false, tempoTolerance = 0.08, id = null } = {}) {
  const list = (slices ?? []).filter(Boolean);
  if (!list.length) return { ok: false, base: null, reasons: ['no slices'], compat: [] };
  const anchor = list[0];
  const reasons = [];
  const compat = [];
  const grid = Math.max(...list.map((s) => s.grid));
  for (const s of list) if (grid % s.grid !== 0) reasons.push(`grid ${s.grid} of ${s.from} does not divide ${grid}`);
  const placed = [];
  let lo = (anchor.tempo.min ?? anchor.tempo.bpm) / (1 + tempoTolerance);
  let hi = (anchor.tempo.max ?? anchor.tempo.bpm) * (1 + tempoTolerance);
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const c = i === 0 ? { ok: true, reasons: [], transpose: 0, tempo: anchor.tempo.bpm } : compatible(anchor, s, { tempoTolerance });
    compat.push({ from: s.from, ...c });
    if (!c.ok) reasons.push(...c.reasons.map((r) => `${s.from}: ${r}`));
    lo = Math.max(lo, (s.tempo.min ?? s.tempo.bpm) / (1 + tempoTolerance));
    hi = Math.min(hi, (s.tempo.max ?? s.tempo.bpm) * (1 + tempoTolerance));
    placed.push(c.transpose ? transposeSlice(s, c.transpose) : s);
  }
  if (reasons.length) return { ok: false, base: null, reasons, compat };
  const bars = Math.max(...placed.map((s) => s.bars));
  const parts = {};
  for (const s0 of placed) {
    const s = loopSlice(rescaleSlice(s0, grid), bars);
    for (const [p, part] of Object.entries(s.parts)) {
      if (!parts[p] || !merge) parts[p] = { events: part.events.map((e) => e.slice()) };
      else parts[p].events.push(...part.events.map((e) => e.slice()));
    }
  }
  for (const p of Object.keys(parts)) parts[p].events.sort((a, b) => a[0] - b[0] || (a[3] ?? 0) - (b[3] ?? 0));
  const bpm = Math.min(hi, Math.max(lo, anchor.tempo.bpm));
  const base = {
    format: BASE_FORMAT,
    id: id ?? `combined-${++combinedCount}`,
    kind: anchor.kind ?? 'house',
    family: anchor.family ?? 'chicago',
    origin: 'combined',
    tempo: { bpm: Math.round(bpm * 10) / 10, min: Math.round(lo), max: Math.round(hi) },
    meter: { ...anchor.meter },
    grid,
    swing: anchor.swing ?? 0,
    key: anchor.key ? { ...anchor.key } : null,
    bars,
    parts,
    signature: null,
    quantise: null,
    source: 'combined',
    slices: placed.map((s) => ({ from: s.from, range: s.range, parts: Object.keys(s.parts), transposed: s.transposed ?? 0, looped: s.looped ?? null })),
  };
  for (const p of Object.keys(parts)) parts[p].features = partFeatures(parts[p].events, { ...base, partName: p });
  if (!base.key) base.key = keyOf(parts, base);
  base.signature = signatureOf(base);
  return { ok: true, base, reasons: [], compat };
}
