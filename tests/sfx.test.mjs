// THE SFX DECKS, THE SHARED FORMAT'S TESTS (lane ANIMEHIT, ANIMESFX 2026-10-05): every one of the 100 sounds in the
// four lane files renders without error, stays inside its stated length and ends in silence, carries its provenance,
// stays under the loudest click noise, obeys the tone rules, keeps its top end soft, renders the same samples for the
// same seed, and sounds unlike every other sound in its deck (measured). The rules were agreed in
// SETTLE/runs/animesfx/CHANNEL.md and ruled by SWORDSWISH. A lane whose file has not landed is reported OWED and
// skipped, never failed; ANIMEHIT's own file must be present.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSound, measure, likenessPrint, likeness, dbfs, mono, OfflineCtx } from './offline.mjs';
import { CLICK_NOISES } from '../src/clicks.js';

// the four lane files, as ruled (SFX_FILES in src/sfx-decks.js mirrors this; the last test checks they agree)
const FILES = [
  { file: '../src/sfx-sword-swish.js', name: 'SWORD_SWISH', deck: 'sword', lane: 'SWORDSWISH', prefix: 'swish-' },
  { file: '../src/sfx-sword-hit.js', name: 'SWORD_HIT', deck: 'sword', lane: 'ANIMEHIT', prefix: 'hit-' },
  { file: '../src/sfx-radial-psy.js', name: 'RADIAL_PSY', deck: 'radial', lane: 'PSYRADIAL', prefix: 'psy-' },
  { file: '../src/sfx-radial-hyper.js', name: 'RADIAL_HYPER', deck: 'radial', lane: 'HYPERRADIAL', prefix: 'hyper-' },
];

const PER_LANE = 25;
const MAX_LEN = 1.5; // s, the brief: none over 1.5 s
const LEN_SLACK = 0.05; // s, a sound may ring this far past its stated dur
const SILENT = 1e-4; // -80 dBFS: after its returned end time a sound is silent
const TOP_SHARE = 0.019; // energy above 10 kHz, tick high's share; an entry marked airy: true is exempt
const RAW_CEILING = 2400; // Hz, clicks.js CLICK_TONE.rawCeiling: a raw saw or square passes a lowpass at or below this
const SHAPER_CEILING = 9000; // Hz, the channel's rule: a shaper's output passes a lowpass at or below this
const LIKENESS_MAX = 0.95; // the channel's ruled distinctness: every pair in one deck under this
const ONSET_SHARE = 0.5; // the first 1 ms after `at` holds at most this share of the peak (no click on the attack)
const SEEDS = [1, 2, 3];
const ATTACK_MIN = 0.004; // s, clicks.js CLICK_TONE.attackMin
const RELEASE_MIN = 0.06; // s, clicks.js CLICK_TONE.releaseMin

const loaded = [];
const owed = [];
for (const f of FILES) {
  try {
    const m = await import(new URL(f.file, import.meta.url).href);
    loaded.push({ ...f, list: m[f.name] });
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND' && String(err.message).includes(f.file.slice(3))) owed.push(f.lane);
    else throw err; // a file that exists and fails to import is a real failure
  }
}
const entries = loaded.flatMap((f) => (Array.isArray(f.list) ? f.list.map((e) => ({ e, f })) : []));

// a per-entry test collects every failure and reports them all at once, so a lane sees its whole list in one run
function collect() {
  const bad = [];
  const ok = (cond, msg) => { if (!cond && !bad.includes(msg)) bad.push(msg); };
  ok.done = () => assert.ok(bad.length === 0, `${bad.length} failing:\n  ${bad.join('\n  ')}`);
  return ok;
}

const render = (e, opts = {}, seconds) => renderSound((ctx, dest, t) => e.render(ctx, t, dest, { strength: 1, seed: 1, ...opts }), { seconds: seconds ?? Math.min(MAX_LEN, e.dur) + 0.3 });

// THE LEVEL CAP, measured by the same renderer: the loudest of the 24 click noises at strength 1
const clickRows = CLICK_NOISES.map((n) => measure(renderSound((c, d, t) => n.play(c, d, t, { strength: 1 }))));
const CAP = { peak: Math.max(...clickRows.map((m) => m.peak)), rms50: Math.max(...clickRows.map((m) => m.rms50)) };

// one render and one measurement per entry at seed 1, strength 1, shared by the tests below
const base = new Map();
for (const { e } of entries) {
  try {
    const r = render(e);
    base.set(e, { r, m: measure(r), p: likenessPrint(r) });
  } catch (err) {
    base.set(e, { err });
  }
}

test('the lanes present, and the ones still owed', (t) => {
  t.diagnostic(`present: ${loaded.map((f) => f.lane).join(', ') || 'none'} · owed: ${owed.join(', ') || 'none'}`);
  t.diagnostic(`the cap, from the loudest click noise: peak ${dbfs(CAP.peak).toFixed(2)} dBFS, rms50 ${dbfs(CAP.rms50).toFixed(2)} dBFS`);
  assert.ok(loaded.some((f) => f.lane === 'ANIMEHIT'), 'ANIMEHIT\'s own file is present');
  assert.ok(CAP.peak > 0.1 && CAP.peak < 0.25, `the click cap is where the channel measured it (${CAP.peak})`);
});

test('each lane file exports one frozen array of 25 entries under its ruled name', () => {
  for (const f of loaded) {
    assert.ok(Array.isArray(f.list), `${f.lane}: ${f.name} is an array`);
    assert.ok(Object.isFrozen(f.list), `${f.lane}: ${f.name} is frozen`);
    assert.equal(f.list.length, PER_LANE, `${f.lane}: ${f.list.length} entries`);
  }
});

test('every entry is well formed: id, name, kind, deck, lane, dur and render', () => {
  const ok = collect();
  const ids = new Set();
  for (const { e, f } of entries) {
    const at = `${f.lane} ${e?.id}`;
    ok(typeof e.id === 'string', `${at}: id`);
    ok(String(e.id).startsWith(f.prefix) && /^[a-z0-9]+(-[a-z0-9]+)+$/.test(String(e.id)), `${at}: kebab with prefix ${f.prefix}`);
    ok(!ids.has(e.id), `${at}: id unique over all the decks`);
    ids.add(e.id);
    ok(typeof e.name === 'string' && e.name.trim().length >= 3, `${at}: a name`);
    ok(typeof e.kind === 'string' && /^[a-z][a-z-]*$/.test(e.kind), `${at}: a kind`);
    ok(e.deck === f.deck, `${at}: deck ${e.deck}`);
    ok(e.lane === f.lane, `${at}: lane ${e.lane}`);
    ok(Number.isFinite(e.dur) && e.dur > 0 && e.dur <= MAX_LEN, `${at}: dur ${e.dur}`);
    ok(typeof e.render === 'function', `${at}: render`);
    ok(Object.isFrozen(e), `${at}: frozen`);
  }
  ok.done();
});

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FREE = /^(cc0|cc0 1\.0|public domain|pd)$/i;
test('THE PROVENANCE RULE: every entry says how it was made; a sample names its source, licence, hash and changes', () => {
  const ok = collect();
  for (const { e } of entries) {
    const p = e.provenance;
    if (!p || typeof p !== 'object') { ok(false, `${e.id}: provenance`); continue; }
    if (p.method === 'procedural') {
      ok(DATE.test(p.made ?? ''), `${e.id}: made is an ISO date`);
      ok(typeof p.recipe === 'string' && p.recipe.trim().length >= 20, `${e.id}: a recipe line`);
    } else if (p.method === 'sample') {
      ok(/^https:\/\//.test(p.url ?? ''), `${e.id}: url`);
      ok(typeof p.author === 'string' && p.author.trim(), `${e.id}: author`);
      ok(FREE.test(String(p.licence ?? '').trim()), `${e.id}: licence ${p.licence} is CC0 or public domain`);
      ok(/^[0-9a-f]{64}$/.test(p.sha256 ?? ''), `${e.id}: sha256 of the downloaded file`);
      ok(typeof p.changed === 'string' && p.changed.trim(), `${e.id}: what we changed`);
    } else ok(false, `${e.id}: provenance.method is 'procedural' or 'sample', not ${p.method}`);
  }
  ok.done();
});

test('every sound renders without error, finite, inside its stated length, and silent after its returned end', () => {
  const ok = collect();
  for (const { e } of entries) {
    const b = base.get(e);
    if (b.err) { ok(false, `${e.id}: render threw ${b.err.message}`); continue; }
    const { r, m } = b;
    ok(Number.isFinite(r.end) && r.end >= r.at, `${e.id}: render returns its end time (${r.end})`);
    ok(r.end - r.at <= e.dur + LEN_SLACK, `${e.id}: end ${(r.end - r.at).toFixed(3)} s within dur ${e.dur} s`);
    const x = mono(r);
    ok(x.every(Number.isFinite), `${e.id}: every sample finite`);
    let before = 0;
    for (let i = 0; i < Math.floor(r.at * r.sampleRate); i++) before = Math.max(before, Math.abs(r.L[i]), Math.abs(r.R[i]));
    ok(before === 0, `${e.id}: sound before its start time (${dbfs(before).toFixed(1)} dBFS)`);
    ok(m.peak > CAP.peak * 1e-3, `${e.id}: makes a sound (peak ${dbfs(m.peak).toFixed(1)} dBFS)`);
    const from = Math.ceil((r.end + 0.03) * r.sampleRate);
    let tail = 0;
    for (let i = from; i < r.L.length; i++) tail = Math.max(tail, Math.abs(r.L[i]), Math.abs(r.R[i]));
    ok(tail < SILENT, `${e.id}: ${dbfs(tail).toFixed(1)} dBFS after its end time, a tail that outlives the sound`);
    ok(m.endT - r.at <= e.dur + LEN_SLACK && m.endT - r.at <= MAX_LEN + LEN_SLACK, `${e.id}: heard for ${(m.endT - r.at).toFixed(3)} s, dur ${e.dur}`);
  }
  ok.done();
});

test('THE LEVEL CAP: at strength 1, over three seeds, no sound is louder than the loudest click noise, peak or rms50', () => {
  const ok = collect();
  for (const { e } of entries.filter(({ e }) => !base.get(e).err)) {
    for (const seed of SEEDS) {
      const m = seed === 1 ? base.get(e).m : measure(render(e, { seed }));
      ok(m.peak <= CAP.peak, `${e.id} seed ${seed}: peak ${dbfs(m.peak).toFixed(2)} over the cap ${dbfs(CAP.peak).toFixed(2)} dBFS`);
      ok(m.rms50 <= CAP.rms50, `${e.id} seed ${seed}: rms50 ${dbfs(m.rms50).toFixed(2)} over the cap ${dbfs(CAP.rms50).toFixed(2)} dBFS`);
    }
  }
  ok.done();
});

test('strength turns a sound down: at strength 0.3 it is at least 3 dB quieter than at 1', () => {
  const ok = collect();
  for (const { e } of entries.filter(({ e }) => !base.get(e).err)) {
    const quiet = measure(render(e, { strength: 0.3 }));
    ok(dbfs(quiet.peak) <= dbfs(base.get(e).m.peak) - 3, `${e.id}: ${dbfs(quiet.peak).toFixed(1)} against ${dbfs(base.get(e).m.peak).toFixed(1)}`);
  }
  ok.done();
});

test('the same seed renders the same samples (no Math.random); other seeds render too', () => {
  const ok = collect();
  for (const { e } of entries.filter(({ e }) => !base.get(e).err)) {
    const a = base.get(e).r;
    const b = render(e);
    let diff = 0;
    for (let i = 0; i < a.L.length; i++) diff = Math.max(diff, Math.abs(a.L[i] - b.L[i]), Math.abs(a.R[i] - b.R[i]));
    ok(diff === 0, `${e.id}: two renders at seed 1 differ by ${diff}`);
    try { measure(render(e, { seed: 7 })); } catch (err) { ok(false, `${e.id}: seed 7 throws ${err.message}`); }
  }
  ok.done();
});

// every node reachable from `n` without passing through a node for which stop(node) is true
function reaches(n, target, stop) {
  const seen = new Set([n]);
  const q = [n];
  while (q.length) {
    for (const o of q.shift()._outs ?? []) {
      if (o === target) return true;
      if (!o._outs || seen.has(o) || stop(o)) continue;
      seen.add(o);
      q.push(o);
    }
  }
  return false;
}
const isEnvelope = (n, dest) => n.kind === 'gain' && n.gain.events.length > 0 && n.gain.events[0].v === 0 && reaches(n, dest, () => false);
function feedsEnvelope(n, dest) {
  const seen = new Set([n]);
  const q = [n];
  while (q.length) {
    for (const o of q.shift()._outs ?? []) {
      if (!o._outs || seen.has(o)) continue;
      if (isEnvelope(o, dest)) return true;
      seen.add(o);
      q.push(o);
    }
  }
  return false;
}
const maxFreq = (biquad) => Math.max(biquad.frequency.value, ...biquad.frequency.events.map((ev) => ev.v));
const lowpassAtMost = (hz) => (n) => n.kind === 'biquad' && n.type === 'lowpass' && maxFreq(n) <= hz && n.frequency.inputs.length === 0;

// THE FLOORS AS SLOPES, so an envelope of one segment or of several is judged alike: the first rise may climb no
// faster than a 4 ms ramp to the envelope's peak, and the final fall to 0 no faster than a 60 ms ramp from the peak.
// A ramp's slope is its change over its length; a setTarget starts at (target - start) / tau; a set is a jump.
function slope(param, k) {
  const ev = param.events[k];
  if (ev.type === 'set') return Infinity;
  const start = k > 0 ? param._at(ev.t - 1e-9, k) : param.value;
  if (ev.type === 'target') return Math.abs(ev.v - param._at(ev.t, k)) / ev.tau;
  const dt = ev.t - (k > 0 ? param.events[k - 1].t : 0);
  return dt > 0 ? Math.abs(ev.v - start) / dt : Infinity;
}

// every tone-rule fault of one entry's graph, as messages
function graphFaults(e) {
  const out = [];
  const ok = (cond, msg) => { if (!cond && !out.includes(msg)) out.push(msg); };
  const ctx = new OfflineCtx();
  e.render(ctx, 0.01, ctx.destination, { strength: 1, seed: 1 });
  for (const n of ctx._nodes) {
    if (n.kind === 'osc' && (n.type === 'square' || n.type === 'sawtooth')) {
      for (const o of n._outs) {
        if (o.constructor?.name === 'RParam') continue; // modulating a parameter is not reaching the output
        ok(lowpassAtMost(RAW_CEILING)(o), `${e.id}: a raw ${n.type} goes first into ${o.kind} ${o.type ?? ''} ${o.kind === 'biquad' ? maxFreq(o) : ''}`);
      }
    }
    // SWORDSWISH's scope: a gain on the audio path (it reaches the output through node inputs) whose automation
    // begins at 0 is an envelope; a drive gain that never sets 0 and a gain feeding a parameter are exempt. And
    // (ruled later) an envelope that feeds a LATER envelope on its path, a grain window or a stutter slice, is
    // texture: the floors bind the envelope nearest the output.
    if (isEnvelope(n, ctx.destination) && !feedsEnvelope(n, ctx.destination)) {
      const ev = n.gain.events;
      const top = Math.max(...ev.map((x) => x.v));
      const up = ev.findIndex((x) => x.v > 0);
      const last = ev.at(-1);
      const rise = up > 0 ? slope(n.gain, up) : Infinity;
      ok(rise <= top / ATTACK_MIN * (1 + 1e-6), `${e.id}: an envelope rises as fast as a ${(1000 * top / rise).toFixed(1)} ms ramp, under 4 ms`);
      ok(last.v === 0 && last.type !== 'set', `${e.id}: an envelope ends at ${last.v} by '${last.type}', not a ramp to 0`);
      const fall = ev.length > 1 ? slope(n.gain, ev.length - 1) : Infinity;
      ok(fall <= top / RELEASE_MIN * (1 + 1e-6), `${e.id}: an envelope's last fall is as fast as a ${(1000 * top / fall).toFixed(1)} ms ramp from its peak, under 60 ms`);
    }
    if (n.kind === 'shaper') {
      ok(!reaches(n, ctx.destination, lowpassAtMost(SHAPER_CEILING)), `${e.id}: a shaper reaches the output without a lowpass at <= 9 kHz`);
    }
  }
  return out;
}

test('THE TONE RULES on the graph: envelopes ramp from 0 to 0 no faster than the floors; a raw saw or square meets a lowpass at <= 2.4 kHz first; a shaper reaches the output only through a lowpass at <= 9 kHz', () => {
  const ok = collect();
  for (const { e } of entries.filter(({ e }) => !base.get(e).err)) for (const f of graphFaults(e)) ok(false, f);
  ok.done();
});

// the graph rules can fail, and the grain exemption is exactly as ruled: a 2 ms grain feeding an outer envelope
// passes; the same grain alone, a set to full level, a raw square straight to the output and a bare shaper do not
test('the graph rules can fail, and a grain is exempt only when an outer envelope follows it', () => {
  const grain = (ctx, t, into) => { const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1, t + 0.002); g.gain.linearRampToValueAtTime(0, t + 0.012); const o = ctx.createOscillator(); o.connect(g); g.connect(into); o.start(t); o.stop(t + 0.02); return g; };
  const outer = (ctx, t, dest) => { const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.004); g.gain.linearRampToValueAtTime(0, t + 0.1); g.connect(dest); return g; };
  const fake = (id, build) => ({ id, render: (ctx, at, dest) => { build(ctx, at, dest); return at + 0.1; } });
  assert.deepEqual(graphFaults(fake('t-grain-in-outer', (c, t, d) => grain(c, t, outer(c, t, d)))), []);
  assert.equal(graphFaults(fake('t-grain-alone', (c, t, d) => grain(c, t, d))).length, 2, 'too fast up and down');
  assert.equal(graphFaults(fake('t-set-up', (c, t, d) => { const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.setValueAtTime(0.1, t + 0.01); g.gain.linearRampToValueAtTime(0, t + 0.1); g.connect(d); })).length, 1);
  assert.equal(graphFaults(fake('t-raw-square', (c, t, d) => { const o = c.createOscillator(); o.type = 'square'; o.connect(d); o.start(t); o.stop(t + 0.05); })).length, 1);
  assert.equal(graphFaults(fake('t-bare-shaper', (c, t, d) => { const s = c.createWaveShaper(); s.curve = new Float32Array([-1, 0, 1]); s.connect(d); })).length, 1);
});

test('THE TONE RULES in the samples: no click on the attack, no cut-off at the end', () => {
  const ok = collect();
  for (const { e } of entries.filter(({ e }) => !base.get(e).err)) {
    const { r, m } = base.get(e);
    const x = mono(r);
    const sr = r.sampleRate;
    const s0 = Math.round(r.at * sr);
    let onset = 0;
    for (let i = s0; i < s0 + Math.round(0.001 * sr); i++) onset = Math.max(onset, Math.abs(x[i]));
    let pk = 0;
    for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
    ok(onset <= ONSET_SHARE * pk, `${e.id}: the first 1 ms reaches ${(onset / pk).toFixed(2)} of the peak (a click on the attack)`);
    // the end: the sound's last loud 5 ms window (above -26 dB of the loudest) must not fall 34 dB or more into the
    // next one, a cut instead of a release. A gate or stutter inside the sound is the lane's choice; the end is not.
    const w = Math.round(0.005 * sr);
    const win = [];
    for (let i = 0; i + w <= x.length; i += w) { let q = 0; for (let k = i; k < i + w; k++) q += x[k] * x[k]; win.push(Math.sqrt(q / w)); }
    const loud = Math.max(...win);
    let last = -1;
    for (let k = 0; k < win.length; k++) if (win[k] > loud * 0.05) last = k;
    const cut = last >= 0 && last + 1 < win.length && win[last + 1] <= win[last] * 0.02 ? last : -1;
    ok(cut < 0, `${e.id}: cut off at ${((cut + 1) * w / sr).toFixed(3)} s (${dbfs(win[cut]).toFixed(1)} to ${dbfs(win[cut + 1]).toFixed(1)} dBFS)`);
    ok(m.duration > 0, `${e.id}: heard`);
  }
  ok.done();
});

test('the top end stays soft: under tick high\'s share of energy above 10 kHz, unless the entry says airy: true', () => {
  const ok = collect();
  for (const { e } of entries.filter(({ e }) => !base.get(e).err)) {
    const { m } = base.get(e);
    if (e.airy === true) continue;
    ok(m.highShare <= TOP_SHARE, `${e.id}: ${(100 * m.highShare).toFixed(2)} % of its energy above 10 kHz`);
  }
  ok.done();
});

test('DISTINCT: every pair in one deck stays under the ruled likeness, measured over all the sounds of the deck', (t) => {
  const ok = collect();
  for (const deck of ['sword', 'radial']) {
    const d = entries.filter(({ e }) => e.deck === deck && base.get(e).p);
    let worst = { v: -1 };
    for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) {
      const v = likeness(base.get(d[i].e).p, base.get(d[j].e).p);
      if (v > worst.v) worst = { v, a: d[i].e.id, b: d[j].e.id };
      ok(v < LIKENESS_MAX, `${deck}: ${d[i].e.id} and ${d[j].e.id} are ${v.toFixed(3)} alike`);
    }
    if (d.length > 1) t.diagnostic(`${deck}: ${d.length} sounds, most alike ${worst.a} and ${worst.b} at ${worst.v.toFixed(3)}`);
  }
  ok.done();
});

test('the measure can fail: a copy of a sound is caught as alike, a doubled sound as too loud, an echo past its end as a tail', () => {
  const e = entries[0].e;
  const p = base.get(e).p;
  assert.ok(likeness(p, p) > LIKENESS_MAX, 'a sound is alike to itself');
  const doubled = renderSound((ctx, dest, t) => { const g = ctx.createGain(); g.gain.value = 4; g.connect(dest); return e.render(ctx, t, g, { strength: 1, seed: 1 }); }, { seconds: e.dur + 0.3 });
  const m2 = measure(doubled);
  assert.ok(m2.peak > CAP.peak || m2.rms50 > CAP.rms50, 'four times as loud breaks the cap');
  const ring = renderSound((ctx, dest, t) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.01); g.gain.linearRampToValueAtTime(0, t + 0.4);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.45); return t + 0.1; // claims to end at 0.1 s, rings to 0.4
  }, { seconds: 0.8 });
  let tail = 0;
  for (let i = Math.ceil((ring.end + 0.03) * ring.sampleRate); i < ring.L.length; i++) tail = Math.max(tail, Math.abs(ring.L[i]));
  assert.ok(tail >= SILENT, 'a sound that lies about its end is caught');
});

test('the test\'s file list agrees with the deck loader\'s, when the loader has landed', async (t) => {
  let decks;
  try { decks = await import(new URL('../src/sfx-decks.js', import.meta.url).href); } catch { t.diagnostic('sfx-decks.js not landed yet'); return; }
  assert.deepEqual(decks.SFX_FILES.map((f) => [f.file.replace('./', '../src/'), f.name, f.deck, f.lane, f.prefix]), FILES.map((f) => [f.file, f.name, f.deck, f.lane, f.prefix]));
});
