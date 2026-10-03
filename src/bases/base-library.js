// settle-hear · bases/base-library - THE LIBRARY the DJ chooses from: an index of every base's signature, a loader
// for the base files, a search over the features, and pickBases(), which SETTLES a choice the way the planner and
// the mix machine do: a cost G for every candidate, then p proportional to exp(-G / T) sampled as T cools.
//
// <claudes_code_comments>
// ** Function List **
// FEATURE_WEIGHTS            - how much each wanted feature costs per unit of distance
// featureCost(sig, want)     - G for one signature against what is wanted, as named parts (the "why")
// settleIndex(costs, r, opts) - the choice: p(i) proportional to exp(-G_i / T) over 8 cooling steps; { pick,
//                              probs, trace }
// createLibrary(index, opts) - { size, index, counts, byId, search(want, n), pickBases(want, opts), load(id) }
//                              with `opts.load` the async loader (a file read in node, a fetch in the browser)
// indexRow(base)             - the index row of a base (the signature plus id, kind, family, origin, tempo range, grid)
// rowAsBase(row)             - an index row with its tempo range and meter in a base's shape, for compatible()
// balanceOf(index)           - { house, ambient, total, share } for the 50/50 check
// readIndexSync(dir)         - node only: bases/index.json from a folder (dynamic import of fs)
// loaderFor(dir)             - node only: load(id) that reads bases/<id>.json
//
// ** Technical Review **
// - THE INDEX is bases/index.json: [{ id, kind, family, bpm, min, max, energy, density, syncopation, swing, key,
//   parts, fourFloor, backbeat, bars, meter, origin }], one row per base, small enough for a page to hold whole.
//   A base file is read only when a slice of it is wanted.
// - THE COST, lower is better, each part named so the DJ panel can say why a base was chosen:
//     kind      - 6 if the kind differs (a house set never takes an ambient bed by accident, but it may on purpose)
//     family    - 0 for a wanted family, 1.2 for a family in the same kind, 2.5 across kinds
//     tempo     - |bpm - want.bpm| / 10, after the base's own range is allowed (0 inside the range)
//     energy, density, syncopation, swing - |difference| x weight
//     key       - 0 for the same key or its relative, 0.8 for a transposable key, 0 when the base has no key
//     parts     - 3 for every wanted part the base does not carry
//     bars      - 1 when the base is shorter than wanted (it would have to loop)
//     habit     - 1.5 for the base chosen last (no repeats back to back); from opts.avoid
// - THE SETTLE: the same rule as mix-planner.js settlePlans: T cools from 2.0 to 0.15 over 8 steps and each step
//   samples one base from exp(-G / T); the last sample is the pick. Deterministic for a seed (deckRng). With n > 1
//   the pick is removed and the settle runs again, so the DJ can ask for a drum base and a bass base at once.
// </claudes_code_comments>

import { deckRng } from '../deck.js';
import { KINDS, FAMILIES, relativeKey } from './base-format.js';

export const FEATURE_WEIGHTS = { kind: 6, family: 1.2, familyFar: 2.5, tempo: 0.1, energy: 4, density: 1.2, syncopation: 2, swing: 6, key: 0.8, parts: 3, bars: 1, habit: 1.5 };

const MAJORS = new Set(['ionian', 'major', 'lydian', 'mixolydian']);
const cls = (m) => (MAJORS.has(m) ? 'major' : 'minor');

export function featureCost(sig, want = {}, { avoid = [] } = {}) {
  const W = FEATURE_WEIGHTS;
  const parts = [];
  if (want.kind && KINDS.includes(want.kind) && sig.kind !== want.kind) parts.push({ why: 'kind', v: W.kind });
  if (want.family) {
    const fams = Array.isArray(want.family) ? want.family : [want.family];
    if (!fams.includes(sig.family)) {
      const sameKind = fams.some((f) => (FAMILIES[sig.kind] ?? []).includes(f));
      parts.push({ why: 'family', v: sameKind ? W.family : W.familyFar });
    }
  }
  if (Number.isFinite(want.bpm)) {
    const lo = sig.min ?? sig.bpm;
    const hi = sig.max ?? sig.bpm;
    const d = want.bpm < lo ? lo - want.bpm : want.bpm > hi ? want.bpm - hi : 0;
    if (d) parts.push({ why: 'tempo', v: W.tempo * d });
  }
  for (const f of ['energy', 'density', 'syncopation', 'swing']) {
    if (Number.isFinite(want[f]) && Number.isFinite(sig[f])) {
      const d = Math.abs(want[f] - sig[f]);
      if (d) parts.push({ why: f, v: W[f] * d });
    }
  }
  if (want.key && sig.key) {
    const same = sig.key.pc === want.key.pc && cls(sig.key.mode) === cls(want.key.mode);
    const rel = relativeKey(want.key);
    const relative = rel.pc === sig.key.pc && cls(rel.mode) === cls(sig.key.mode);
    if (!same && !relative) parts.push({ why: 'key', v: W.key });
  }
  if (Array.isArray(want.parts)) {
    const missing = want.parts.filter((p) => !(sig.parts ?? []).includes(p));
    if (missing.length) parts.push({ why: `parts (${missing.join(' ')})`, v: W.parts * missing.length });
  }
  if (Number.isFinite(want.bars) && sig.bars < want.bars) parts.push({ why: 'bars', v: W.bars });
  if (avoid.includes(sig.id)) parts.push({ why: 'habit', v: W.habit });
  return { G: parts.reduce((a, p) => a + p.v, 0), parts };
}

export function settleIndex(costs, r, { steps = 8, hot = 2.0, cold = 0.15 } = {}) {
  const n = costs.length;
  if (!n) return { pick: -1, probs: [], trace: [] };
  const trace = [];
  let pick = 0;
  let probs = costs.map(() => 1 / n);
  for (let k = 0; k < steps; k++) {
    const T = hot * Math.pow(cold / hot, steps > 1 ? k / (steps - 1) : 1);
    const mn = Math.min(...costs);
    const w = costs.map((G) => Math.exp(-(G - mn) / T));
    const Z = w.reduce((a, b) => a + b, 0);
    probs = w.map((x) => x / Z);
    let u = r() * Z;
    pick = n - 1;
    for (let i = 0; i < n; i++) { u -= w[i]; if (u <= 0) { pick = i; break; } }
    trace.push({ T, pick, p: probs[pick] });
  }
  return { pick, probs, trace };
}

export function balanceOf(index = []) {
  const house = index.filter((b) => b.kind === 'house').length;
  const ambient = index.filter((b) => b.kind === 'ambient').length;
  const total = index.length;
  return { house, ambient, total, share: total ? house / total : 0 };
}

export function createLibrary(index = [], { load = null, seed = 1 } = {}) {
  const rows = index.slice();
  const byId = new Map(rows.map((b) => [b.id, b]));
  const cache = new Map();
  const r = deckRng(((Number(seed) >>> 0) ^ 0x5bd1e995) >>> 0 || 1);
  const lib = {
    get size() { return rows.length; },
    get index() { return rows.slice(); },
    get counts() {
      const kinds = balanceOf(rows);
      const families = {};
      for (const b of rows) families[b.family] = (families[b.family] ?? 0) + 1;
      const origins = {};
      for (const b of rows) origins[b.origin ?? 'midi'] = (origins[b.origin ?? 'midi'] ?? 0) + 1;
      return { ...kinds, families, origins };
    },
    has(id) { return byId.has(id); },
    row(id) { return byId.get(id) ?? null; },
    // every base scored against what is wanted, best first
    search(want = {}, n = 10, opts = {}) {
      return rows.map((b) => ({ id: b.id, row: b, ...featureCost(b, want, opts) })).sort((a, b) => a.G - b.G).slice(0, n);
    },
    // the settled choice: n bases, each settled from exp(-G/T), none twice
    pickBases(want = {}, { n = 1, avoid = [], random = r, exclude = [] } = {}) {
      const out = [];
      let pool = rows.filter((b) => !exclude.includes(b.id));
      for (let k = 0; k < n && pool.length; k++) {
        const scored = pool.map((b) => ({ id: b.id, row: b, ...featureCost(b, want, { avoid: [...avoid, ...out.map((o) => o.id)] }) }));
        const s = settleIndex(scored.map((x) => x.G), random);
        const chosen = scored[s.pick];
        out.push({ ...chosen, p: s.probs[s.pick], trace: s.trace, top: scored.map((x, i) => ({ id: x.id, G: x.G, p: s.probs[i] })).sort((a, b) => a.G - b.G).slice(0, 5) });
        pool = pool.filter((b) => b.id !== chosen.id);
      }
      return out;
    },
    async load(id) {
      if (cache.has(id)) return cache.get(id);
      if (!load) throw new Error('this library has no loader');
      const base = await load(id);
      cache.set(id, base);
      return base;
    },
    loaded(id) { return cache.get(id) ?? null; },
    put(base) { cache.set(base.id, base); if (!byId.has(base.id)) { rows.push(indexRow(base)); byId.set(base.id, rows[rows.length - 1]); } },
  };
  return lib;
}

export function indexRow(base) {
  const s = base.signature ?? {};
  return {
    id: base.id,
    kind: base.kind,
    family: base.family,
    origin: base.origin,
    bpm: base.tempo?.bpm ?? null,
    min: base.tempo?.min ?? null,
    max: base.tempo?.max ?? null,
    energy: s.energy ?? 0,
    density: s.density ?? 0,
    syncopation: s.syncopation ?? 0,
    swing: s.swing ?? base.swing ?? 0,
    key: s.key ?? null,
    parts: s.parts ?? Object.keys(base.parts ?? {}),
    fourFloor: s.fourFloor ?? 0,
    backbeat: s.backbeat ?? 0,
    bars: base.bars,
    meter: s.meter ?? `${base.meter?.num}/${base.meter?.den}`,
    grid: base.grid,
  };
}

// an index row seen as a base for the compatibility rule: the flat tempo and the meter string put back in shape
export function rowAsBase(row) {
  if (!row) return null;
  if (row.tempo && typeof row.meter === 'object') return row;
  const [num, den] = String(row.meter ?? '4/4').split('/').map(Number);
  return { ...row, tempo: { bpm: row.bpm, min: row.min ?? row.bpm, max: row.max ?? row.bpm }, meter: { num: num || 4, den: den || 4 } };
}

// node-only helpers (a page never calls these; it fetches the files)
export async function readIndex(dir) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  return JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
}

export async function loaderFor(dir) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  return async (id) => JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'));
}
