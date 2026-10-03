// settle-hear · bases/base-features - the numbers the DJ searches a base by: each part's density, syncopation,
// energy and register; the whole base's signature (four-on-the-floor, the backbeat, the family); the key by the
// Krumhansl profiles; and the swing read from human timing. Pure functions over event lists.
//
// <claudes_code_comments>
// ** Function List **
// partFeatures(events, base)   - { density, syncopation, energy, register, onsets, bars } for one part
// syncopationOf(t, grid)       - one onset's syncopation weight: 0 on a beat, 0.5 on an off-beat eighth, 1 off both
// keyOf(parts, base)           - the Krumhansl-Schmuckler key: { pc, mode, name, confidence } or null
// KEY_PROFILES                 - the major and minor profiles (Krumhansl and Kessler 1982)
// PC_NAMES                     - pitch class names
// fourFloorOf(base)            - the share of bars whose kick lands on every beat
// backbeatOf(base)             - the share of bars whose snare lands on beats 2 and 4
// familyOf(base)               - the family a base's own numbers put it in (house or ambient)
// kindOf(base, hint)           - house or ambient, from the drums' density and the tempo
// signatureOf(base)            - the signature the index carries
// swingFromOffsets(offsets)    - the swing read from quantise errors: the mean lateness of odd ticks, 0..0.3
//
// ** Technical Review **
// - DENSITY is onsets a beat: events / (bars x beats a bar). A four-on-the-floor kick is 1.0; sixteenth hats 4.0.
// - SYNCOPATION is the mean weight of the onsets: an onset on a beat weighs 0, on the off-beat eighth 0.5, and on
//   any other tick 1. A straight kick scores 0; off-beat hats 0.5; a 2-step kick (steps 0 and 10) scores 0.5.
//   (A simple cousin of the Longuet-Higgins and Lee 1984 metric: the metric position decides the weight.)
// - ENERGY is mean level x (1 - e^(-density)): loud and busy is high, quiet and sparse is low; 0..1.
// - REGISTER is the mean midi pitch of a pitched part, null for drums.
// - THE KEY: a duration-weighted pitch-class histogram of every pitched part, correlated with the 24 Krumhansl
//   profiles; the best correlation names the key, and the correlation is the confidence. Major is written ionian,
//   minor aeolian; a mode finer than that is not read from a histogram.
// - THE FAMILY, for a house base: four-on-the-floor with sixteenth hats and rims is tech; four-on-the-floor with
//   heavy swing and soft levels is deep; with open hats on the off-beats and a clap, chicago; with a ride on every
//   beat or a rolling bass, progressive; with busy percussion (conga, cowbell, shaker) disco or latin; a broken kick
//   with a backbeat and swing is garage, without swing breaks; a sparse muted kick is dub-techno; a kick with a
//   funk backbeat and syncopated snare is funk. For an ambient base: no onsets beyond a slow pulse is drone; a
//   steady slow pulse is pulse; chords in three or four voices moving together is chorale; a keys part with a
//   melody is piano; high short notes are bells; the rest is ambient.
// - KIND: house when the drums carry at least one onset a beat and the tempo is at least 100; ambient when the
//   drums are thin or absent or the tempo is under 100. A hint (the source's own word) breaks a tie.
// </claudes_code_comments>

import { PARTS, DRUM_PARTS, PITCHED_PARTS, ticksPerBar, beatsPerBar } from './base-format.js';

export const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const KEY_PROFILES = {
  major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
};

export function syncopationOf(t, grid) {
  if (t % grid === 0) return 0;
  if (grid % 2 === 0 && t % (grid / 2) === 0) return 0.5;
  return 1;
}

export function partFeatures(events = [], base) {
  const grid = Number(base?.grid) || 4;
  const bpb = beatsPerBar(base?.meter);
  const bars = Math.max(1, Number(base?.bars) || 1);
  const n = events.length;
  const density = n / (bars * bpb);
  const sync = n ? events.reduce((a, e) => a + syncopationOf(e[0], grid), 0) / n : 0;
  const level = n ? events.reduce((a, e) => a + e[2], 0) / n : 0;
  const energy = level * (1 - Math.exp(-density));
  const pitched = events.filter((e) => e[3] != null);
  const register = pitched.length && !DRUM_PARTS.includes(base?.partName) ? pitched.reduce((a, e) => a + e[3], 0) / pitched.length : null;
  const tpb = ticksPerBar(base ?? { grid, meter: base?.meter });
  const barsUsed = new Set(events.map((e) => Math.floor(e[0] / tpb)));
  return {
    density: round(density),
    syncopation: round(sync),
    energy: round(energy),
    register: register == null ? null : round(register, 1),
    onsets: n,
    bars: barsUsed.size,
  };
}

function round(x, d = 3) { const k = Math.pow(10, d); return Math.round(x * k) / k; }

function corr(a, b) {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0; let da = 0; let db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

export function keyOf(parts = {}, base) {
  const hist = new Array(12).fill(0);
  let total = 0;
  for (const name of PITCHED_PARTS) {
    for (const e of parts[name]?.events ?? []) {
      if (e[3] == null) continue;
      const w = e[1] * (name === 'bass' ? 1.5 : 1);
      hist[((e[3] % 12) + 12) % 12] += w;
      total += w;
    }
  }
  if (!total) return null;
  let best = null;
  for (const [mode, profile] of Object.entries(KEY_PROFILES)) {
    for (let pc = 0; pc < 12; pc++) {
      const rotated = profile.map((_, i) => profile[((i - pc) % 12 + 12) % 12]);
      const c = corr(hist, rotated);
      if (!best || c > best.c) best = { pc, mode, c };
    }
  }
  const mode = best.mode === 'major' ? 'ionian' : 'aeolian';
  return { pc: best.pc, mode, name: `${PC_NAMES[best.pc]} ${mode}`, confidence: round(best.c) };
}

function onsetsPerBar(base, part) {
  const tpb = ticksPerBar(base);
  const out = Array.from({ length: base.bars }, () => new Set());
  for (const e of base.parts?.[part]?.events ?? []) {
    const b = Math.floor(e[0] / tpb);
    if (out[b]) out[b].add(e[0] - b * tpb);
  }
  return out;
}

export function fourFloorOf(base) {
  const grid = base.grid;
  const bpb = beatsPerBar(base.meter);
  const bars = onsetsPerBar(base, 'kick');
  const hit = bars.filter((s) => { for (let b = 0; b < bpb; b++) if (!s.has(b * grid)) return false; return true; }).length;
  return bars.length ? hit / bars.length : 0;
}

export function backbeatOf(base) {
  const grid = base.grid;
  const bpb = beatsPerBar(base.meter);
  if (bpb < 4) return 0;
  const bars = onsetsPerBar(base, 'snare');
  const hit = bars.filter((s) => s.has(1 * grid) && s.has(3 * grid)).length;
  return bars.length ? hit / bars.length : 0;
}

function voiceShare(base, part, voices) {
  const ev = base.parts?.[part]?.events ?? [];
  if (!ev.length) return 0;
  return ev.filter((e) => voices.includes(e[3])).length / ev.length;
}

const OPEN_HAT = [46];
const RIDE = [51, 59, 53];
const CLAP = [39];
const BUSY_PERC = [56, 60, 61, 62, 63, 64, 69, 70, 82, 54, 75];

export function kindOf(base, hint = null) {
  const drums = DRUM_PARTS.reduce((a, p) => a + (base.parts?.[p]?.events?.length ?? 0), 0);
  const bpb = beatsPerBar(base.meter);
  const drumDensity = drums / (Math.max(1, base.bars) * bpb);
  const bpm = base.tempo?.bpm ?? 120;
  if (drumDensity >= 1 && bpm >= 100) return 'house';
  if (drumDensity < 0.5 || bpm < 100) return 'ambient';
  return hint === 'house' || hint === 'ambient' ? hint : drumDensity >= 0.75 ? 'house' : 'ambient';
}

export function familyOf(base) {
  const F = Object.fromEntries(PARTS.map((p) => [p, base.parts?.[p]?.features ?? partFeatures(base.parts?.[p]?.events ?? [], { ...base, partName: p })]));
  if (base.kind === 'ambient') {
    const pitchedOnsets = PITCHED_PARTS.reduce((a, p) => a + (base.parts?.[p]?.events?.length ?? 0), 0);
    const bpb = beatsPerBar(base.meter);
    const perBar = pitchedOnsets / Math.max(1, base.bars);
    const drumOnsets = DRUM_PARTS.reduce((a, p) => a + (base.parts?.[p]?.events?.length ?? 0), 0);
    const chordEv = base.parts?.chords?.events ?? [];
    const longest = PITCHED_PARTS.flatMap((p) => base.parts?.[p]?.events ?? []).reduce((a, e) => Math.max(a, e[1]), 0) / Math.max(1, base.grid);
    if (perBar <= 0.75 && longest >= bpb) return 'drone';
    if (drumOnsets >= base.bars && F.kick.syncopation < 0.1 && perBar < 2) return 'pulse';
    if (F.lead.register != null && F.lead.register >= 84 && F.lead.density <= 1) return 'bells';
    if (chordEv.length && F.chords.density >= 1.5 && F.lead.density <= 0.6 && F.chords.register != null && F.chords.register < 72 && (base.tempo?.bpm ?? 0) < 90 && F.chords.syncopation < 0.15) return 'chorale';
    if ((F.lead.density > 0.5 || F.chords.density > 0.5) && (base.tempo?.bpm ?? 0) < 120 && F.kick.density < 0.5) return 'piano';
    if (drumOnsets > 0 && (base.tempo?.bpm ?? 0) >= 70 && (base.tempo?.bpm ?? 0) < 110) return 'downtempo';
    if (F.texture.onsets && !pitchedOnsets) return 'field';
    return 'ambient';
  }
  const ff = fourFloorOf(base);
  const bb = backbeatOf(base);
  const swing = base.swing ?? 0;
  const perc = F.perc.density;
  const busyPerc = voiceShare(base, 'perc', BUSY_PERC);
  const ride = voiceShare(base, 'perc', RIDE);
  const openHats = voiceShare(base, 'hats', OPEN_HAT);
  const clap = voiceShare(base, 'snare', CLAP);
  const acid = F.bass.density >= 2.5 && F.bass.syncopation >= 0.4;
  if (ff >= 0.6) {
    if (acid) return 'acid';
    if (F.hats.density >= 3.5 && F.perc.density >= 0.5) return 'tech';
    if (busyPerc > 0.4 && perc >= 1.5) return 'latin';
    if (perc >= 1.5 && F.hats.density >= 1.5) return 'disco';
    if (ride >= 0.5 && F.perc.density >= 0.9) return 'progressive';
    if (F.bass.density >= 2.5) return 'progressive';
    if (swing >= 0.14 && F.kick.energy < 0.75) return 'deep';
    if (F.kick.energy < 0.55 && F.hats.density <= 1 && F.snare.density <= 0.5) return 'dub-techno';
    if (F.hats.density >= 3.5) return 'tech';
    if (openHats >= 0.3 && clap >= 0.5) return 'chicago';
    if (swing >= 0.1 && busyPerc > 0.2) return 'balearic';
    if (F.chords.density >= 1 && F.hats.density < 2) return 'filter-house';
    return 'chicago';
  }
  if (bb >= 0.5 && swing >= 0.14 && F.kick.syncopation >= 0.3) return 'garage';
  if (bb >= 0.5 && F.snare.syncopation >= 0.3 && F.kick.syncopation >= 0.3) return 'funk';
  if (busyPerc > 0.4 && perc >= 1.5) return 'afro';
  if (bb >= 0.5) return 'breaks';
  if (F.kick.density >= 1.5 && F.kick.syncopation >= 0.4) return 'electro';
  return 'breaks';
}

export function signatureOf(base) {
  const F = Object.fromEntries(PARTS.map((p) => [p, base.parts?.[p]?.features ?? partFeatures(base.parts?.[p]?.events ?? [], { ...base, partName: p })]));
  const present = PARTS.filter((p) => (base.parts?.[p]?.events?.length ?? 0) > 0);
  const weights = { kick: 0.28, snare: 0.18, hats: 0.16, perc: 0.1, bass: 0.14, chords: 0.06, lead: 0.05, texture: 0.03 };
  let energy = 0;
  let wsum = 0;
  let density = 0;
  let sync = 0;
  for (const p of PARTS) {
    const w = weights[p];
    wsum += w;
    energy += w * (F[p].energy ?? 0);
    density += w * (F[p].density ?? 0);
    if (F[p].onsets) sync += w * F[p].syncopation;
  }
  return {
    kind: base.kind,
    family: base.family,
    bpm: base.tempo?.bpm ?? null,
    energy: round(energy / wsum),
    density: round(density / wsum),
    syncopation: round(sync / wsum),
    swing: round(base.swing ?? 0),
    key: base.key ? { pc: base.key.pc, mode: base.key.mode } : null,
    parts: present,
    fourFloor: round(fourFloorOf(base)),
    backbeat: round(backbeatOf(base)),
    bars: base.bars,
    meter: `${base.meter?.num ?? 4}/${base.meter?.den ?? 4}`,
  };
}

// offsets: [{ tick, errorTicks }] for every onset, error = measured - grid (positive is late), in ticks
export function swingFromOffsets(offsets = []) {
  const odd = offsets.filter((o) => o.tick % 2 === 1);
  if (odd.length < 4) return 0;
  const mean = odd.reduce((a, o) => a + o.errorTicks, 0) / odd.length;
  return round(Math.min(0.3, Math.max(0, mean)));
}
