// settle-hear · dj-trained - THE DJ'S TRAINED SET: the GRIDLEARN models (stages 1 and 2) settled in the browser. One
// call settles a whole set for a genre family: the line plan with the drop pull, the role grid section by section, the
// phrase events in every block, a groove for every bar, and the feel (swing, a played spread, levels, hat voices, clap).
// Pure: no audio. dj-trained-plan.js turns a set into the house DJ's bars; gridlearn's page plays it too.
//
// <claudes_code_comments>
// ** Function List **
// FAMILIES                    - the eight genre families the models were fitted for
// loadTrainedModels()         - the models module (dj-trained-models.js), imported once and lazily (its own chunk)
// lineKind(t, off)            - the line before block t: 0 a 32-bar line, 1 a 16-bar line, 2 an 8-bar line
// posBin(t, T)                - which tenth of the set block t sits in
// resample(curve, n)          - a linear resample of an arc to n blocks
// blocksFor(minutes, bpm)     - 8-bar blocks in a length (32 beats a block), a half rounded to even (Python's round)
// betas(nCool, lo, nHold)     - a cooling schedule: lo -> 1.0 over nCool sweeps, then nHold sweeps at 1.0
// toDense(n, h, pairs) / neighbours(J) - a symmetric pull matrix, and each site's nonzero pulls (j ascending)
// settleSites(h, nbr, s, betas, rng, clamp) - THE P-BIT RULE, site by site in a random order; a clamped site stays -1
// gateFields(fm, arc, off)    - the line plan's leans and pulls (arrange2.gate_model)
// gridFields(models, fm, arc, gates, off) - stage 1's unrolled grid with the open-line looseness and the drop pull
//                               (gridmodel.unroll + arrange2.block_model), dense
// mergeFields(h, J, gates, R) - fold every closed line: a role's blocks in one section become one thing (arrange2.merge)
// blockContext(grid, arc, off, roles) - each block's context for the phrase level (stage2lib.block_context)
// phraseFields(pm, ctx)       - one block's 48 leans and its 48 x 48 pulls (phrasemodel.block_fields)
// phraseClamp(ctx)            - the events a block cannot carry (no drums, no kick, no bass)
// grooveUnpack(gm, nc)        - a groove model as h [64], C [nc][64], jp [64], W [64][64] (groovemodel.unpack)
// barContext(arc, ev, k, kickBlock) - one bar's context for the groove level (groovemodel.bar_context)
// levelDigit(v)               - a level 0..1 as the step string's digit ('.' none, '1'..'9')
// settleTrainedSet(models, family, opts) - ONE WHOLE SET for a family: { family, seed, blocks, shape, arc, gates,
//                               grid, roles, events, grooveRoles, steps, hats, clap, feel, onRuleResettles, notes }
//
// ** Technical Review **
// - THE SAME SET AS PYTHON. SETTLE/gridlearn/dj_ref.py builds every field with the training code itself and samples
//   with this file's rule and this file's stream (deckRng, mulberry32); tests/djtrained.test.mjs settles the
//   fixture's seeds here and must match it bar for bar. The order of draws is part of the contract: the length,
//   the arc shape, the line plan (start, sweeps), the grid (start, sweeps), the phrase level block by block, the
//   grooves (the occupancy start, then per block its groove, its ON-rule re-settles and its eight bars), then the
//   feel, the levels (Box-Muller, two draws a step), the hat voices, the clap.
// - THE P-BIT RULE: one site at a time in a random order, u = 2 unit - 1 drawn for every site (a clamped one too),
//   s = +1 when tanh(beta I) > u, I = h + sum_j J_ij s_j. The schedules are the training's: the line plan and the
//   grid 80 cooling sweeps 0.1 -> 1 then 60 at 1; the phrase level 60 then 40; a groove 24 from 0.2 then 8; a bar 4
//   sweeps at the family's calibrated bar beta.
// - THE LINE PLAN, THE DROP PULL: a gate per line, +1 where the section changes, settled first with the family's
//   calibrated shifts; then stage 1's grid with the time pull on an open line loosened by the calibrated lam, and the
//   kick entering on a 16- or 32-bar line rewarded by W* (and on a plain 8-bar line penalised). A closed line merges
//   a role's blocks, so nothing changes there.
// - THE ON RULE: a groove that leaves an on role with fewer than two hits is settled again from a fresh draw of the
//   family's occupancy (up to 6 times), then with a growing lean toward it (6 more).
// - NO FENCE: compose2.py checked every settled bar against the keys of real bars and re-settled the 3.1% that lay
//   within 2 steps of a song's distinctive bar. That corpus stays on the Spark (a rare key is one song's bar), so a
//   set settled here is not checked; the README says so.
// - STAGE 3 (lane DJNOTES): opts.notes, when given, is called with the settled set and may return the pitched roles'
//   note grids; the set carries whatever it returns as `notes` (null otherwise). See SETTLE/DJ_CHANNEL.md.
// </claudes_code_comments>

import { deckRng } from './deck.js';

export const FAMILIES = Object.freeze(['house', 'techno', 'trance', 'ambient', 'breaks', 'eurodance', 'synth', 'electronic']);

let modelsPromise = null;
export function loadTrainedModels() {
  if (!modelsPromise) modelsPromise = import('./dj-trained-models.js').then((m) => m.default).catch((e) => { modelsPromise = null; throw e; });
  return modelsPromise;
}

const NPOS = 10;
export const lineKind = (t, off = 0) => {
  const k = (((t - off) % 4) + 4) % 4;
  return k === 0 ? 0 : k === 2 ? 1 : 2;
};
export const posBin = (t, T) => Math.min(NPOS - 1, Math.floor((NPOS * (t + 0.5)) / T));

export function resample(curve, n) {
  if (curve.length === n) return curve.slice();
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : (i * (curve.length - 1)) / (n - 1);
    const a = Math.floor(x);
    const b = Math.min(curve.length - 1, a + 1);
    out[i] = curve[a] + (curve[b] - curve[a]) * (x - a);
  }
  return out;
}

export function blocksFor(minutes, bpm) {
  const x = (minutes * bpm) / 32;
  const n = Math.abs(x - Math.trunc(x)) === 0.5 ? 2 * Math.round(x / 2) : Math.floor(x + 0.5);
  return Math.max(4, n);
}

export function betas(nCool, lo, nHold) {
  const out = [];
  for (let k = 0; k < nCool; k++) out.push(lo + ((1 - lo) * k) / (nCool - 1));
  for (let k = 0; k < nHold; k++) out.push(1);
  return out;
}
const GRID_BETAS = betas(80, 0.1, 60);
const PHRASE_BETAS = betas(60, 0.1, 40);
const BASE_BETAS = betas(24, 0.2, 8);
const BAR_SWEEPS = 4;
const ROLE_TRIES = 6;
const LEVEL_SD = 0.06;
const NE = 6;
const NK = 8;
const NS = 64;

const zeros = (n) => new Float64Array(n);
const matrix = (n) => Array.from({ length: n }, () => new Float64Array(n));

export function neighbours(J) {
  return J.map((row) => {
    const out = [];
    for (let j = 0; j < row.length; j++) if (row[j] !== 0) out.push([j, row[j]]);
    return out;
  });
}

function perm(n, rng) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const x = a[i]; a[i] = a[j]; a[j] = x;
  }
  return a;
}

export function settleSites(h, nbr, s, bs, rng, clamp = null) {
  const n = h.length;
  for (const beta of bs) {
    for (const i of perm(n, rng)) {
      const u = 2 * rng() - 1;
      if (clamp && clamp[i]) { s[i] = -1; continue; }
      let I = h[i];
      for (const [j, w] of nbr[i]) I += w * s[j];
      s[i] = Math.tanh(beta * I) > u ? 1 : -1;
    }
  }
  return s;
}

const coin = (rng) => (rng() < 0.5 ? 1 : -1);

// arrange2.gate_model: things t = 1..T-1 (index t - 1)
export function gateFields(fm, arc, off = 0) {
  const T = arc.length;
  const n = Math.max(1, T - 1);
  const h = zeros(n);
  const J = matrix(n);
  const g = fm.gate;
  const KIND = 0;
  const POS = 3;
  const STEP = 3 + NPOS;
  const P1 = STEP + 1;
  const P2 = STEP + 2;
  for (let t = 1; t < T; t++) {
    h[t - 1] += g[KIND + lineKind(t, off)] * 1;
    h[t - 1] += g[POS + posBin(t, T)] * 1;
    h[t - 1] += g[STEP] * Math.abs(arc[t] - arc[t - 1]);
    h[t - 1] += fm.shift[lineKind(t, off)];
    if (t >= 2) { J[t - 1][t - 2] = g[P1]; J[t - 2][t - 1] = g[P1]; }
    if (t >= 3) { J[t - 1][t - 3] = g[P2]; J[t - 3][t - 1] = g[P2]; }
  }
  return { h, J };
}

// gridmodel.unroll + arrange2.block_model: leans h [R*T] (role-major) and a dense symmetric pull matrix
export function gridFields(models, fm, arc, gates, off = 0) {
  const M = fm.grid;
  const R = M.roles.length;
  const T = arc.length;
  const h = zeros(R * T);
  for (let r = 0; r < R; r++) {
    for (let t = 0; t < T; t++) {
      let v = M.bias[r] + M.arc[r] * arc[t] + M.pos[r][posBin(t, T)];
      if (t === 0) v += M.first[r];
      if (t === T - 1) v += M.last[r];
      h[r * T + t] = v;
    }
  }
  const Wn = Array.from({ length: R }, () => new Float64Array(R));
  for (const [i, j, w] of M.within) { Wn[i][j] = w; Wn[j][i] = w; }
  const J = matrix(R * T);
  const add = (i, j, w) => { J[i][j] += w; J[j][i] += w; };
  for (let t = 0; t < T; t++) {
    for (let r = 0; r < R; r++) {
      if (t > 0) {
        let w = M.time[r][lineKind(t, off)];
        if (gates[t] > 0) w *= fm.lam[lineKind(t, off)];
        add(r * T + t - 1, r * T + t, w);
        for (let q = 0; q < R; q++) if (q !== r) add(q * T + t - 1, r * T + t, M.across[q][r]);
      }
      for (let q = r + 1; q < R; q++) add(r * T + t, q * T + t, Wn[r][q]);
    }
  }
  const W = models.W;
  if (W) {
    for (let t = 1; t < T; t++) {
      if (gates[t] > 0) {
        const w = lineKind(t, off) <= 1 ? W : -W;
        h[t] += w / 4;
        h[t - 1] -= w / 4;
        J[t - 1][t] -= w / 4;
        J[t][t - 1] -= w / 4;
      }
    }
  }
  return { h, J };
}

export function mergeFields(h, J, gates, R) {
  const T = gates.length;
  const sec = [];
  let c = -1;
  for (let t = 0; t < T; t++) { if (gates[t] > 0) c += 1; sec.push(c); }
  const K = c + 1;
  const map = (i) => Math.floor(i / T) * K + sec[i % T];
  const hs = zeros(R * K);
  for (let i = 0; i < R * T; i++) hs[map(i)] += h[i];
  const Js = matrix(R * K);
  for (let i = 0; i < R * T; i++) {
    const a = map(i);
    const row = J[i];
    for (let j = 0; j < R * T; j++) {
      const w = row[j];
      if (w === 0) continue;
      const b = map(j);
      if (a !== b) Js[a][b] += w;
    }
  }
  return { hs, Js, sec, K };
}

// stage2lib.block_context: next32, next16, change_next, change_here, drop_next, drop_here, drums_on, kick_on, bass_on,
// fx_on, arc
export function blockContext(grid, arc, off, roles) {
  const ri = (name) => roles.indexOf(name);
  const T = arc.length;
  const R = grid.length;
  const on = (r, t) => grid[r][t] > 0;
  const kick = ri('kick');
  const drums = ['kick', 'snare', 'hats', 'perc'].map(ri);
  const differs = (t1, t2) => { for (let r = 0; r < R; r++) if (on(r, t1) !== on(r, t2)) return true; return false; };
  const out = [];
  for (let t = 0; t < T; t++) {
    const C = new Array(11).fill(0);
    if (t + 1 < T) {
      const k = lineKind(t + 1, off);
      C[0] = k === 0 ? 1 : 0;
      C[1] = k === 1 ? 1 : 0;
      C[2] = differs(t + 1, t) ? 1 : 0;
      C[4] = !on(kick, t) && on(kick, t + 1) ? 1 : 0;
    } else C[0] = 1;
    if (t >= 1) {
      C[3] = differs(t, t - 1) ? 1 : 0;
      C[5] = on(kick, t) && !on(kick, t - 1) ? 1 : 0;
    }
    C[6] = drums.some((r) => on(r, t)) ? 1 : 0;
    C[7] = on(kick, t) ? 1 : 0;
    C[8] = on(ri('bass'), t) ? 1 : 0;
    C[9] = on(ri('fx'), t) ? 1 : 0;
    C[10] = arc[t];
    out.push(C);
  }
  return out;
}

// phrasemodel: the pull matrix is the same for every block of a family, so it is built once per model
const phraseJCache = new WeakMap();
function phraseJ(pm) {
  if (phraseJCache.has(pm)) return phraseJCache.get(pm);
  const J = matrix(NE * NK);
  for (const [a, b, w] of pm.pair) for (let k = 0; k < NK; k++) { J[a * NK + k][b * NK + k] += w; J[b * NK + k][a * NK + k] += w; }
  for (let e = 0; e < NE; e++) for (let k = 1; k < NK; k++) { J[e * NK + k][e * NK + k - 1] += pm.seq[e]; J[e * NK + k - 1][e * NK + k] += pm.seq[e]; }
  for (let a = 0; a < NE; a++) {
    for (let b = 0; b < NE; b++) {
      if (a === b) continue;
      const w = pm.cross[a][b];
      for (let k = 1; k < NK; k++) { J[b * NK + k][a * NK + k - 1] += w; J[a * NK + k - 1][b * NK + k] += w; }
    }
  }
  const out = { J, nbr: neighbours(J) };
  phraseJCache.set(pm, out);
  return out;
}
const CK_IDX = [0, 1, 2, 3, 4, 5]; // next32, next16, change_next, change_here, drop_next, drop_here
const CS_IDX = [7, 9, 10]; // kick_on, fx_on, arc

export function phraseFields(pm, ctx) {
  const h = zeros(NE * NK);
  for (let e = 0; e < NE; e++) {
    for (let k = 0; k < NK; k++) {
      let v = pm.base[e][k];
      for (let c = 0; c < CK_IDX.length; c++) v += ctx[CK_IDX[c]] * pm.ck[e][k][c];
      for (let c = 0; c < CS_IDX.length; c++) v += ctx[CS_IDX[c]] * pm.cs[e][c];
      h[e * NK + k] = v;
    }
  }
  return { h, ...phraseJ(pm) };
}

export function phraseClamp(ctx) {
  const m = new Uint8Array(NE * NK);
  const set = (e) => { for (let k = 0; k < NK; k++) m[e * NK + k] = 1; };
  if (!ctx[6]) { set(0); set(1); set(2); set(3); set(4); } // the drum events
  if (!ctx[7]) set(4); // the drop-out
  if (!ctx[8]) set(5); // the turnaround
  return m;
}

const grooveCache = new WeakMap();
export function grooveUnpack(gm) {
  if (grooveCache.has(gm)) return grooveCache.get(gm);
  const W = matrix(NS);
  let k = 0;
  for (let i = 0; i < NS; i++) for (let j = i + 1; j < NS; j++) { W[i][j] = gm.w_upper[k]; W[j][i] = gm.w_upper[k]; k += 1; }
  const out = { h: gm.h, C: gm.c, jp: gm.jp, W, nbr: neighbours(W), nc: gm.c.length };
  grooveCache.set(gm, out);
  return out;
}

// groovemodel.bar_context: arc, fill, roll, lift, crash, first, last, kick_off_block
export const barContext = (arcT, ev, k, kickBlock) => [Math.fround(arcT), ev[0] ? 1 : 0, ev[1] ? 1 : 0, ev[2] ? 1 : 0, ev[3] ? 1 : 0, k === 0 ? 1 : 0, k === 7 ? 1 : 0, kickBlock ? 0 : 1];

function grooveBase(G, ctx, ref) {
  const out = zeros(NS);
  for (let i = 0; i < NS; i++) {
    let v = G.h[i];
    for (let c = 0; c < G.nc; c++) v += ctx[c] * G.C[c][i];
    out[i] = v + G.jp[i] * ref[i];
  }
  return out;
}

export const levelDigit = (v) => (v <= 0 ? '.' : String(Math.min(9, Math.max(1, Math.floor(9 * v + 0.5)))));

// the length is always drawn (so a set settled with its length given, as a tag's replay does, takes the same stream
// as the set that drew it), then the given length, when there is one, replaces it
function lengths(fm, rng, blocks) {
  const [lo, , hi] = fm.timing.minutes;
  const drawn = blocksFor(lo + (hi - lo) * rng(), fm.timing.bpm);
  let T = blocks == null ? drawn : blocks;
  T = Math.max(6, Math.min(40, Math.trunc(T)));
  const w = fm.arcs.map((c) => c.weight);
  let x = rng() * w.reduce((a, b) => a + b, 0);
  let shape = w.length - 1;
  for (let k = 0; k < w.length; k++) { x -= w[k]; if (x < 0) { shape = k; break; } }
  return { T, shape, arc: resample(fm.arcs[shape].curve, T) };
}

// opts: { seed, blocks (null: a length from the family's own), notes (stage 3's hook, lane DJNOTES) }
export function settleTrainedSet(models, family, { seed = 1, blocks = null, notes = null } = {}) {
  const fm = models.families[family];
  if (!fm) throw new Error(`no trained model for family ${family}`);
  const rng = deckRng(seed >>> 0);
  const roles = models.roles;
  const R = roles.length;
  const { T, shape, arc } = lengths(fm, rng, blocks);
  // 1 · THE LINE PLAN
  const gf = gateFields(fm, arc, 0);
  const gs = Array.from({ length: gf.h.length }, () => coin(rng));
  settleSites(gf.h, neighbours(gf.J), gs, GRID_BETAS, rng);
  const gates = [1, ...gs.slice(0, T - 1)];
  // 2 · THE GRID, section by section, with the drop pull
  const bf = gridFields(models, fm, arc, gates, 0);
  const mf = mergeFields(bf.h, bf.J, gates, R);
  const s = Array.from({ length: mf.hs.length }, () => coin(rng));
  settleSites(mf.hs, neighbours(mf.Js), s, GRID_BETAS, rng);
  const grid = roles.map((_, r) => Array.from({ length: T }, (_, t) => (s[r * mf.K + mf.sec[t]] > 0 ? 1 : 0)));
  // 3 · THE PHRASE LEVEL, block by block
  const ctx = blockContext(grid, arc, 0, roles);
  const ev = Array.from({ length: NE }, () => new Uint8Array(8 * T));
  for (let t = 0; t < T; t++) {
    const pf = phraseFields(fm.phrase, ctx[t]);
    const cl = phraseClamp(ctx[t]);
    const ps = Array.from({ length: NE * NK }, () => coin(rng));
    for (let i = 0; i < ps.length; i++) if (cl[i]) ps[i] = -1;
    settleSites(pf.h, pf.nbr, ps, PHRASE_BETAS, rng, cl);
    for (let e = 0; e < NE; e++) for (let k = 0; k < NK; k++) ev[e][8 * t + k] = ps[e * NK + k] > 0 ? 1 : 0;
  }
  // 4 · THE GROOVES: each block's groove, then its eight bars
  const GB = grooveUnpack(fm.groove.base);
  const GG = grooveUnpack(fm.groove.bar);
  const init = fm.groove.init;
  const barBeta = fm.groove.barBeta;
  const kickR = roles.indexOf('kick');
  const groleR = models.grooveRoles.map((r) => roles.indexOf(r));
  const nb = 8 * T;
  const free = [];
  const bctx = [];
  for (let b = 0; b < nb; b++) {
    const t = Math.floor(b / 8);
    const f = new Uint8Array(NS);
    groleR.forEach((r, gi) => { if (grid[r][t]) for (let i = 0; i < 16; i++) f[16 * gi + i] = 1; });
    if (ev[4][b]) for (let i = 0; i < 16; i++) f[i] = 0;
    free.push(f);
  }
  for (let t = 0; t < T; t++) {
    const c = barContext(arc[t], [0, 0, 0, 0, 0, 0], t === 0 ? 0 : 1, grid[kickR][t]);
    c[6] = 0;
    bctx.push(c);
  }
  const start = Array.from({ length: NS }, (_, i) => (rng() < init[i] ? 1 : -1));
  let prev = new Float64Array(NS);
  const bars = new Array(nb);
  let resettles = 0;
  for (let t = 0; t < T; t++) {
    const fr = new Uint8Array(NS);
    for (let k = 0; k < 8; k++) for (let i = 0; i < NS; i++) if (free[8 * t + k][i]) fr[i] = 1;
    const notFree = fr.map((v) => (v ? 0 : 1));
    const base = grooveBase(GB, bctx[t], prev);
    let S = Array.from({ length: NS }, (_, i) => (fr[i] ? (prev[i] !== 0 ? prev[i] : start[i]) : -1));
    settleSites(base, GB.nbr, S, BASE_BETAS, rng, notFree);
    const lean = new Float64Array(NS);
    for (let k = 0; k < 2 * ROLE_TRIES; k++) {
      const silent = new Uint8Array(NS);
      let any = false;
      for (let r = 0; r < 4; r++) {
        let on = false;
        let hits = 0;
        for (let i = 16 * r; i < 16 * r + 16; i++) { if (fr[i]) on = true; if (S[i] > 0) hits += 1; }
        if (on && hits < 2) { for (let i = 16 * r; i < 16 * r + 16; i++) silent[i] = 1; any = true; }
      }
      if (!any) break;
      resettles += 1;
      if (k >= ROLE_TRIES) for (let i = 0; i < NS; i++) if (silent[i]) lean[i] += 0.5 * (2 * init[i] - 1) + 0.5;
      const fresh = Array.from({ length: NS }, (_, i) => (rng() < init[i] ? 1 : -1));
      S = Array.from({ length: NS }, (_, i) => (fr[i] ? fresh[i] : -1));
      const bl = base.map((v, i) => v + lean[i]);
      settleSites(bl, GB.nbr, S, BASE_BETAS, rng, notFree);
    }
    const G = S;
    for (let k = 0; k < 8; k++) {
      const b = 8 * t + k;
      const frb = free[b];
      const evb = [0, 1, 2, 3, 4, 5].map((e) => ev[e][b]);
      const bb = grooveBase(GG, barContext(arc[t], evb, k, grid[kickR][t]), G);
      const X = Array.from({ length: NS }, (_, i) => (frb[i] ? G[i] : -1));
      settleSites(bb, GG.nbr, X, Array(BAR_SWEEPS).fill(barBeta), rng, frb.map((v) => (v ? 0 : 1)));
      bars[b] = X.map((v) => (v > 0 ? 1 : 0));
    }
    prev = fr.some((v) => v) ? Float64Array.from(G) : new Float64Array(NS);
  }
  // 5 · THE FEEL, THE LEVELS, THE VOICES
  const tb = fm.tables;
  const pSw = Math.max(-0.999, Math.min(0.999, 2 * tb.swingShare - 1));
  const swung = 2 * rng() - 1 < pSw;
  const played = 2 * rng() - 1 < 2 * tb.playedShare - 1;
  const feel = {
    swing: swung && tb.swingP50 != null ? tb.swingP50 : 0,
    swung,
    played,
    spread: played ? { ...tb.spread } : { kick: 0, snare: 0, hats: 0 },
  };
  const steps = bars.map((bar) => [0, 1, 2, 3].map((r) => {
    let row = '';
    for (let i = 0; i < 16; i++) {
      const u1 = 1 - rng();
      const u2 = rng();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const v = bar[16 * r + i] ? Math.min(1, Math.max(0.15, tb.level[r][i] + LEVEL_SD * z)) : 0;
      row += levelDigit(v);
    }
    return row;
  }));
  const hats = bars.map((bar) => {
    let row = '';
    for (let i = 0; i < 16; i++) {
      const u = rng();
      const v = u < tb.open[i] ? 'o' : u < tb.open[i] + tb.ride[i] ? 'r' : 'c';
      row += bar[32 + i] ? v : '.';
    }
    return row;
  });
  const clap = rng() < tb.clap;
  const set = {
    family,
    seed: seed >>> 0,
    blocks: T,
    bars: nb,
    shape,
    arc,
    gates: gates.map((g) => (g > 0 ? 1 : 0)),
    grid,
    roles: roles.slice(),
    events_order: models.events.slice(),
    events: Array.from(ev, (row) => Array.from(row, (v) => (v ? 'x' : '.')).join('')),
    groove_roles: models.grooveRoles.slice(),
    steps,
    hats,
    clap,
    feel,
    onRuleResettles: resettles,
    notes: null,
  };
  // STAGE 3 (lane DJNOTES): the note level, when a model for it is given; see SETTLE/DJ_CHANNEL.md
  if (typeof notes === 'function') {
    try { set.notes = notes(set, { rng: deckRng((seed ^ 0x51ed270b) >>> 0 || 1) }) ?? null; } catch { set.notes = null; }
  }
  return set;
}
