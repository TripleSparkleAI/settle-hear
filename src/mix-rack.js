// settle-hear · mix-rack - THE RACK: one registry over every house effect (the 35 chain passes in house.js and the
// fx-*.js moves, inserts and beds), each with named, ranged parameters; and a chain builder that wires any of them
// in any order, each slot with its own AMOUNT the DJ moves over the bars. The DJ panel's popover and the wiki read
// this registry, so they never drift from the code.
//
// <claudes_code_comments>
// ** Function List **
// RACK                       - every effect: { key, label, family, kind ('pass' | 'move' | 'insert' | 'bed'), line,
//                              famous, cost, source (the file), params: { name: { value, meaning, min, max, range } } }
// RACK_KEYS                  - their keys (passes first, in house.js order, then the fx in fx-index.js order, then
//                              the voice inserts)
// VOICE_FX                   - the voice inserts of lane MELODYFX (warm drive, tape wow, drifting low-pass,
//                              ensemble, vibrato, tremolo, warm room), dealt into each melodic instrument's chain
// rackOf(key)                - one entry by key
// passRange(name, value, meaning) - the range given to a house.js pass parameter, which carries no range of its own
// paramValues(key, over)     - an effect's parameter values: its defaults, with `over` clamped into each range
// CHAIN_KINDS                - the kinds that can sit in a chain (pass, insert)
// buildRack(ctx, slots, opts) - the chain: slots [{ key, amount, params }] in series, each slot a dry/wet crossfade
//                              set by its amount, then the house limiter (opts.limiter false: a unity gain, for a
//                              voice chain); { input, output, keys, cost, nodes,
//                              amount(i, v, t, glide), amounts(), bar(t0, info), dispose() }
// rackRows()                 - the registry as plain rows (key, label, family, kind, source, cost, params) for a table
//
// ** Technical Review **
// - THE REGISTRY (navigator, 2026-10-02: "all effects available and easy to use with params, and all auto by our
//   central settle DJ system"). fx-*.js params are [value, meaning, min, max] already. house.js passes give
//   [value, meaning]; passRange derives a range by the parameter's meaning and is marked range: 'derived':
//   a wet, dry, level, floor, depth or feedback at or under 1 ranges 0 .. 1 (feedback to 0.95); a frequency in Hz
//   ranges a quarter to four times its value inside 20 .. 18,000; a time in beats or seconds a quarter to four
//   times; anything else half to twice. A pass is built with its params fixed (house.js), so its range bounds what
//   a caller may set at build time.
// - THE CHAIN: every slot is input -> [effect] -> wet gain (amount) and input -> dry gain (1 - amount), summed. The
//   DJ moves `amount` with amount(i, v, t, glide): a sweep over a bar is a linear ramp, so an effect can be brought
//   in, pushed or pulled out on the master beat without rebuilding anything. An insert that has its own set(amount)
//   (the hall, the sidechain) also gets it. The chain ends in the house limiter (house.js HOUSE.limiter), and the
//   page's master limiter sits beyond it.
// - Moves and beds are not chain slots: the planner plays moves on the mix bus (fx-*.js play) and the layers start
//   and stop beds (mix-layers.js). They are in the registry so every effect has one home and one set of ranges.
// </claudes_code_comments>

import { PASSES, HOUSE, graph } from './house.js';
import { FX } from './fx-index.js';
import { warmDrive } from './fx-warm-drive.js';
import { VOICE_MODS } from './fx-voice-mods.js';

// THE VOICE INSERTS (lane MELODYFX): the effects voice-fx.js deals into each melodic instrument's own chain
export const VOICE_FX = Object.freeze([warmDrive, ...VOICE_MODS]);

const FX_SOURCE = {
  riser: 'fx-riser.js', downlifter: 'fx-downlifter.js', 'reverse-cymbal': 'fx-reverse-cymbal.js', 'snare-roll': 'fx-snare-roll.js',
  hall: 'fx-hall.js', 'one-bar-silence': 'fx-silence.js', 'filter-drop': 'fx-filter-drop.js', 'tape-stop-bus': 'fx-tape-stop-bus.js',
  'key-lift': 'fx-key-lift.js', sidechain: 'fx-sidechain.js', 'neutral-hum': 'fx-hum.js', 'evolving-pad': 'fx-pad-evolve.js',
  'field-texture': 'fx-field.js', 'warm-drive': 'fx-warm-drive.js', 'tape-wow': 'fx-voice-mods.js',
  'drift-filter': 'fx-voice-mods.js', ensemble: 'fx-voice-mods.js', vibrato: 'fx-voice-mods.js', tremolo: 'fx-voice-mods.js',
  'warm-room': 'fx-voice-mods.js',
};

export function passRange(name, value, meaning = '') {
  const m = String(meaning).toLowerCase();
  const n = String(name).toLowerCase();
  if (/^(wet|dry|level|floor|depth|mix|hiss|riser|crush|kick|hats|clap)$/.test(n) && value <= 1 && value >= 0) return [0, 1];
  if (n === 'feedback') return [0, 0.95];
  if (/hz/.test(m) || /^(lo|hi|centre|tone|nyquist|split|cut|freq)/.test(n)) {
    if (value < 0) return [value * 2, 0];
    return [Math.max(20, value / 4), Math.min(18000, value * 4)];
  }
  if (value < 0) return [value * 2, value / 2];
  if (/beats?|\bs\b|seconds|tail/.test(m) || /^(beats|slice|back|seconds|decay|grain|open|depth)$/.test(n)) return [value / 4, value * 4];
  if (value === 0) return [0, 1];
  return [value / 2, value * 2];
}

const fromPass = (P) => ({
  key: P.key, label: P.label, family: P.family, kind: 'pass', line: P.line, famous: null, cost: P.cost, source: 'house.js',
  params: Object.fromEntries(Object.entries(P.params).map(([n, [v, meaning]]) => { const [min, max] = passRange(n, v, meaning); return [n, { value: v, meaning, min: Math.min(min, v), max: Math.max(max, v), range: 'derived' }]; })),
  build: P.build,
});
const fromFx = (F) => ({
  key: F.key, label: F.label, family: F.family, kind: F.kind, line: F.line, famous: F.famous ?? null, cost: F.cost, source: FX_SOURCE[F.key] ?? 'fx-index.js',
  params: Object.fromEntries(Object.entries(F.params).map(([n, [v, meaning, min, max]]) => [n, { value: v, meaning, min, max, range: 'declared' }])),
  build: F.build, play: F.play, start: F.start,
});

export const RACK = Object.freeze([...PASSES.map(fromPass), ...FX.map(fromFx), ...VOICE_FX.map(fromFx)]);
export const RACK_KEYS = RACK.map((e) => e.key);
const BY = new Map(RACK.map((e) => [e.key, e]));
export function rackOf(key) { return BY.get(key); }
export const CHAIN_KINDS = Object.freeze(['pass', 'insert']);

export function paramValues(key, over = {}) {
  const e = BY.get(key);
  if (!e) return {};
  return Object.fromEntries(Object.entries(e.params).map(([n, p]) => {
    const x = Number(over?.[n]);
    return [n, Number.isFinite(x) ? Math.min(p.max, Math.max(p.min, x)) : p.value];
  }));
}

const clamp01 = (x) => Math.min(1, Math.max(0, Number.isFinite(+x) ? +x : 0));

export function buildRack(ctx, slots = [], { env = null, limiter: withLimiter = true } = {}) {
  const input = ctx.createGain();
  let prev = input;
  const built = [];
  for (const s of slots) {
    const e = BY.get(s?.key);
    if (!e || !CHAIN_KINDS.includes(e.kind) || typeof e.build !== 'function') continue;
    const inst = e.build(ctx, paramValues(e.key, s.params), env);
    const g = graph(ctx);
    const a = clamp01(s.amount ?? 1);
    const dry = g.gain(1 - a);
    const wet = g.gain(a);
    const sum = g.gain(1);
    prev.connect(dry);
    prev.connect(inst.input);
    inst.output.connect(wet);
    dry.connect(sum);
    wet.connect(sum);
    try { inst.set?.(a, ctx.currentTime); } catch { /* an insert without a working set stays at its build value */ }
    built.push({ key: e.key, inst, g, dry, wet, amount: a });
    prev = sum;
  }
  // a voice chain (voice-fx.js) passes limiter: false and ends in a unity gain: the house rack's limiter and the
  // page's master limiter sit beyond it, so one compressor per instrument would only add cost
  let limiter;
  if (withLimiter) {
    const L = HOUSE.limiter;
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = L.threshold;
    limiter.knee.value = L.knee;
    limiter.ratio.value = L.ratio;
    limiter.attack.value = L.attack;
    limiter.release.value = L.release;
  } else {
    limiter = ctx.createGain();
  }
  prev.connect(limiter);
  const set = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
  const ramp = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
  return {
    input,
    output: limiter,
    keys: built.map((b) => b.key),
    cost: built.reduce((a, b) => a + (BY.get(b.key)?.cost ?? 0), 0),
    nodes: built.reduce((a, b) => a + (b.inst.g?.nodes?.length ?? 0) + b.g.nodes.length, 2),
    // move one slot's amount (by index or key) to v, gliding over `glide` seconds from t
    amount(which, v, t = ctx.currentTime, glide = 0) {
      const b = typeof which === 'number' ? built[which] : built.find((x) => x.key === which);
      if (!b) return;
      const a = clamp01(v);
      set(b.wet.gain, b.amount, t);
      set(b.dry.gain, 1 - b.amount, t);
      if (glide > 0) { ramp(b.wet.gain, a, t + glide); ramp(b.dry.gain, 1 - a, t + glide); }
      else { set(b.wet.gain, a, t); set(b.dry.gain, 1 - a, t); }
      try { b.inst.set?.(a, t); } catch { /* as at build */ }
      b.amount = a;
    },
    amounts() { return built.map((b) => ({ key: b.key, amount: b.amount })); },
    bar(t0, info) { for (const b of built) { try { b.inst.bar?.(t0, info); } catch { /* a pass that fails stays as it was */ } } },
    dispose() {
      for (const b of built) { b.inst.g?.dispose?.(); b.g.dispose(); }
      for (const n of [input, limiter]) try { n.disconnect(); } catch { /* gone */ }
    },
  };
}

export function rackRows() {
  return RACK.map((e) => ({ key: e.key, label: e.label, family: e.family, kind: e.kind, source: e.source, cost: e.cost, line: e.line, famous: e.famous, params: e.params }));
}
