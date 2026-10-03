// settle-hear · bases/base-import - THE IMPORTER: a parsed MIDI file (midi.js) -> one base in our format. It
// splits the notes by instrument and role into the eight parts, quantises them onto the grid and records the
// error it made, reads the swing from the human timing, cuts the window of bars the base keeps, computes every
// feature and the signature, and names the base base-NNNN. The source goes to the ledger, never into the base.
//
// <claudes_code_comments>
// ** Function List **
// IMPORT_DEFAULTS            - grid 4 for house and 8 for ambient, the bar windows, the role rules' thresholds
// rolesOf(track, grid)       - a pitched track's notes -> { bass, chords, lead, texture } by program and by reading
//                              the notes (chords are onsets struck together, the lowest line under 52 is bass, a
//                              single high line is the lead)
// quantiseNotes(notes, grid, bpm) - notes in beats -> events on the grid + the error record + the per-onset offsets
// windowOf(partsRaw, tpb, maxBars, kind) - the bar range the base keeps: from the first bar with an onset, up to
//                              maxBars; a house base takes the densest run of bars, an ambient one the opening
// importMidi(parsed, opts)   - the whole importer: { id, kind (hint), family (hint), bpm, maxBars, grid } ->
//                              { base, report } where report lists dropped tracks, the window and the error
// numberBase(n)              - 'base-' + four digits
//
// ** Technical Review **
// - ROLES. Channel 10 is drums: GM_DRUMS sends each note number to kick, snare, hats or perc and keeps the note
//   number as the event's pitch, so the player knows a clap from a snare. A pitched track starts from its program's
//   family (gmRole) and the notes decide the rest: notes struck on the same tick in threes or more are chords; a
//   note under midi 52 that is the lowest at its tick is bass; a lone note at or above 60 is lead; the rest is
//   chords. A bass program is all bass, a pad or string program is all chords, a sound-effect program is texture.
// - QUANTISE. Every onset goes to the nearest tick. The error is measured in milliseconds at the base's bpm and
//   recorded as meanAbsMs, maxMs, p90Ms and the count, so a base from a human drummer says how much it was moved.
//   A length is rounded to the nearest tick and never below one.
// - SWING. The mean lateness of the onsets that landed on odd ticks (the e and the a of each beat), as a fraction
//   of a tick, clamped to 0..0.3. The base plays straight ticks with that swing re-applied, so a human groove keeps
//   its feel after quantising and a machine-straight file reads swing 0.
// - THE WINDOW. A MIDI piece is long; a base is a loopable bed. A house base keeps the maxBars-bar run with the
//   most onsets (the groove, not the intro); an ambient base keeps its opening bars. Events are re-based to tick 0.
// - TEMPO. From the file's first set-tempo (or the caller's bpm). The range is +-6% for house, +-15% for ambient,
//   so the compatibility rule has something to overlap.
// - Nothing from the file's names reaches the base: no track name, no title, no file name. The report carries them
//   for the ledger builder only.
// </claudes_code_comments>

import { BASE_FORMAT, PARTS, DRUM_PARTS, beatsPerBar, ticksPerBar } from './base-format.js';
import { partFeatures, keyOf, kindOf, familyOf, signatureOf, swingFromOffsets } from './base-features.js';
import { GM_DRUMS, gmRole } from './midi.js';

export const IMPORT_DEFAULTS = {
  grid: { house: 4, ambient: 8 },
  maxBars: { house: 16, ambient: 32 },
  tempoRange: { house: 0.06, ambient: 0.15 },
  bassBelow: 52,
  leadFrom: 60,
};

export function numberBase(n) { return `base-${String(n).padStart(4, '0')}`; }

const round2 = (x) => Math.round(x * 100) / 100;

export function rolesOf(track, grid) {
  const out = { bass: [], chords: [], lead: [], texture: [] };
  const role = gmRole(track.program);
  const notes = track.notes;
  if (role === 'texture') { out.texture.push(...notes); return out; }
  if (role === 'bass') { out.bass.push(...notes); return out; }
  if (role === 'perc') { out.texture.push(...notes); return out; }
  // group by onset tick
  const groups = new Map();
  for (const n of notes) {
    const k = Math.round(n.t * grid);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(n);
  }
  for (const g of groups.values()) {
    g.sort((a, b) => a.p - b.p);
    if (role === 'chords' && g.length >= 2) { out.chords.push(...g); continue; }
    if (g.length >= 3) {
      const low = g[0];
      if (low.p < IMPORT_DEFAULTS.bassBelow && g[1].p - low.p >= 7) { out.bass.push(low); out.chords.push(...g.slice(1)); } else out.chords.push(...g);
      continue;
    }
    if (g.length === 2) {
      if (g[0].p < IMPORT_DEFAULTS.bassBelow) { out.bass.push(g[0]); (g[1].p >= IMPORT_DEFAULTS.leadFrom && role === 'lead' ? out.lead : out.chords).push(g[1]); } else if (g[1].p - g[0].p <= 12 && role !== 'lead') out.chords.push(...g); else { out.chords.push(g[0]); out.lead.push(g[1]); }
      continue;
    }
    const n = g[0];
    if (n.p < IMPORT_DEFAULTS.bassBelow) out.bass.push(n);
    else if (n.p >= IMPORT_DEFAULTS.leadFrom || role === 'lead') out.lead.push(n);
    else out.chords.push(n);
  }
  return out;
}

export function quantiseNotes(notes, grid, bpm) {
  const msPerTick = (60000 / bpm) / grid;
  const events = [];
  const offsets = [];
  const errs = [];
  for (const n of notes) {
    const exact = n.t * grid;
    const t = Math.round(exact);
    const err = exact - t; // positive: the note was late
    const d = Math.max(1, Math.round(n.d * grid));
    events.push([t, d, Math.max(0.01, round2(n.v)), n.p]);
    offsets.push({ tick: t, errorTicks: err });
    errs.push(Math.abs(err) * msPerTick);
  }
  errs.sort((a, b) => a - b);
  const mean = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0;
  return {
    events,
    offsets,
    error: { grid, meanAbsMs: round2(mean), maxMs: round2(errs[errs.length - 1] ?? 0), p90Ms: round2(errs[Math.floor(errs.length * 0.9)] ?? 0), onsets: errs.length, msPerTick: round2(msPerTick) },
  };
}

export function windowOf(partsRaw, tpb, maxBars, kind) {
  const all = Object.values(partsRaw).flat();
  if (!all.length) return { from: 0, bars: 1 };
  const lastTick = Math.max(...all.map((e) => e[0]));
  const nBars = Math.floor(lastTick / tpb) + 1;
  const counts = new Array(nBars).fill(0);
  for (const e of all) counts[Math.floor(e[0] / tpb)] += 1;
  let first = counts.findIndex((c) => c > 0);
  if (first < 0) first = 0;
  let lastUsed = nBars - 1;
  while (lastUsed > first && counts[lastUsed] === 0) lastUsed--;
  const span = lastUsed - first + 1;
  if (span <= maxBars) return { from: first, bars: span };
  if (kind === 'ambient') return { from: first, bars: maxBars };
  // the densest run of maxBars bars, starting on a 4-bar line where the piece allows
  let best = { from: first, sum: -1 };
  for (let s = first; s + maxBars <= lastUsed + 1; s++) {
    if ((s - first) % 4 !== 0) continue;
    const sum = counts.slice(s, s + maxBars).reduce((a, b) => a + b, 0);
    if (sum > best.sum) best = { from: s, sum };
  }
  return { from: best.from, bars: maxBars };
}

export function importMidi(parsed, { id = 'base-0000', kind: kindHint = null, family: familyHint = null, bpm: bpmOverride = null, maxBars = null, grid: gridOverride = null } = {}) {
  const report = { tracks: [], dropped: [], names: [] };
  const bpm0 = bpmOverride ?? parsed.tempos?.[0]?.bpm ?? 120;
  const ts = parsed.timeSigs?.[0] ?? { num: 4, den: 4 };
  const meter = { num: ts.num || 4, den: ts.den || 4 };
  // a first guess at the kind decides the grid; the drums' density decides it again after quantising
  const drumNotes = parsed.tracks.flatMap((t) => t.notes.filter((n) => n.ch === 9));
  const guess = kindHint ?? (drumNotes.length / Math.max(1, parsed.lengthBeats) >= 1 && bpm0 >= 100 ? 'house' : 'ambient');
  const grid = gridOverride ?? IMPORT_DEFAULTS.grid[guess];
  const bpm = Math.round(bpm0 * 10) / 10;
  // 1. roles
  const raw = Object.fromEntries(PARTS.map((p) => [p, []]));
  const offsets = [];
  let errAll = [];
  for (const tr of parsed.tracks) {
    if (!tr.notes.length) continue;
    if (tr.name) report.names.push(tr.name);
    const drums = tr.notes.filter((n) => n.ch === 9);
    const pitched = tr.notes.filter((n) => n.ch !== 9);
    const q = quantiseNotes([...drums, ...pitched], grid, bpm);
    offsets.push(...q.offsets);
    errAll.push(q.error);
    const used = [];
    if (drums.length) {
      const qd = quantiseNotes(drums, grid, bpm);
      let dropped = 0;
      for (const e of qd.events) {
        const m = GM_DRUMS[e[3]];
        if (!m) { dropped++; continue; }
        raw[m.part].push(e);
      }
      used.push(`drums ${drums.length - dropped}`);
      if (dropped) report.dropped.push({ track: tr.index, reason: `${dropped} drum notes with no GM mapping` });
    }
    if (pitched.length) {
      const roles = rolesOf({ ...tr, notes: pitched }, grid);
      for (const [role, list] of Object.entries(roles)) {
        if (!list.length) continue;
        const qr = quantiseNotes(list, grid, bpm);
        raw[role].push(...qr.events);
        used.push(`${role} ${list.length}`);
      }
    }
    report.tracks.push({ track: tr.index, channel: tr.channel, program: tr.program, used });
  }
  // 2. the window
  const tpb = Math.round(grid * beatsPerBar(meter));
  const max = maxBars ?? IMPORT_DEFAULTS.maxBars[guess];
  const W = windowOf(raw, tpb, max, guess);
  const t0 = W.from * tpb;
  const total = W.bars * tpb;
  const parts = {};
  for (const p of PARTS) {
    const ev = raw[p]
      .filter((e) => e[0] >= t0 && e[0] < t0 + total)
      .map((e) => [e[0] - t0, Math.min(e[1], t0 + total - e[0]), e[2], e[3]])
      .sort((a, b) => a[0] - b[0] || (a[3] ?? 0) - (b[3] ?? 0));
    // two identical onsets on one tick and pitch collapse to the louder
    const seen = new Map();
    for (const e of ev) {
      const k = `${e[0]}:${e[3]}`;
      if (!seen.has(k) || seen.get(k)[2] < e[2]) seen.set(k, e);
    }
    const list = [...seen.values()].sort((a, b) => a[0] - b[0] || (a[3] ?? 0) - (b[3] ?? 0));
    if (list.length) parts[p] = { events: list, features: null };
  }
  // 3. the base
  const swing = swingFromOffsets(offsets.filter((o) => o.tick >= t0 && o.tick < t0 + total));
  const base = {
    format: BASE_FORMAT,
    id,
    kind: guess,
    family: familyHint ?? 'chicago',
    origin: 'midi',
    tempo: { bpm, min: 0, max: 0 },
    meter,
    grid,
    swing,
    key: null,
    bars: W.bars,
    parts,
    signature: null,
    quantise: null,
    source: 'ledger',
  };
  base.kind = kindOf(base, kindHint);
  const tol = IMPORT_DEFAULTS.tempoRange[base.kind];
  base.tempo = { bpm, min: Math.round(bpm * (1 - tol)), max: Math.round(bpm * (1 + tol)) };
  for (const p of Object.keys(parts)) parts[p].features = partFeatures(parts[p].events, { ...base, partName: p });
  base.key = keyOf(parts, base);
  base.family = familyHint && (DRUM_PARTS.some((p) => parts[p]) || base.kind === 'ambient') ? familyHint : familyOf(base);
  base.signature = signatureOf(base);
  // the error over every onset the base kept
  const kept = offsets.filter((o) => o.tick >= t0 && o.tick < t0 + total);
  const msPerTick = (60000 / bpm) / grid;
  const errs = kept.map((o) => Math.abs(o.errorTicks) * msPerTick).sort((a, b) => a - b);
  base.quantise = {
    grid,
    meanAbsMs: round2(errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0),
    maxMs: round2(errs[errs.length - 1] ?? 0),
    p90Ms: round2(errs[Math.floor(errs.length * 0.9)] ?? 0),
    onsets: errs.length,
    swingRead: swing,
  };
  report.window = W;
  report.error = base.quantise;
  return { base, report };
}
