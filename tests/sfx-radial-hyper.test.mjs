// THE RADIAL DECK, HYPER HALF (src/sfx-radial-hyper.js, lane HYPERRADIAL): the 25 entries are well formed, each one
// renders through the node renderer (tests/offline.mjs) to finite samples that end in silence, stays under the click
// noises' level at every seed tried, keeps its top end down, is the same for the same seed, keeps the tone rules on
// its graph, and differs from the other 24 on the likeness print.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RADIAL_HYPER, HYPER_TONE, crush, rng } from '../src/sfx-radial-hyper.js';
import { CLICK_NOISES } from '../src/clicks.js';
import { renderSound, measure, likenessPrint, likeness, dbfs } from './offline.mjs';
import { Ctx, Node } from './fakeaudio.mjs';

const SEEDS = [1, 2, 7];
// one render per (sound, seed, strength), shared by the tests below; the determinism test renders fresh on purpose
const memo = new Map();
const renderFresh = (e, opts = {}) => renderSound((ctx, dest, t) => e.render(ctx, t, dest, { strength: 1, seed: 1, ...opts }), { seconds: 2 });
const render = (e, opts = {}) => {
  const k = `${e.id}|${opts.seed ?? 1}|${opts.strength ?? 1}`;
  if (!memo.has(k)) memo.set(k, renderFresh(e, opts));
  return memo.get(k);
};

// the loudest click noise as this renderer measures it: the cap
const CAP = (() => {
  let peak = 0; let rms50 = 0;
  for (const c of CLICK_NOISES) {
    const m = measure(renderSound((ctx, dest, t) => c.play(ctx, dest, t, { strength: 1 })));
    peak = Math.max(peak, m.peak); rms50 = Math.max(rms50, m.rms50);
  }
  return { peak, rms50 };
})();

// THE LIKENESS PRINT WITHOUT ITS EMPTY BAND. At 1024-sample frames and 48 kHz the first band (60 to 87 Hz) holds no
// FFT bin, so likenessPrint() gives it the same constant in every slice of every sound (CHANNEL.md, HYPERRADIAL, the
// defect post). Dropping those 12 values and re-centring the rest is exactly the print with that band skipped,
// because centring removes any constant the dropped values had shifted. Once offline.mjs skips the band itself (as
// SWORDSWISH ruled), its print is 15 x 12 + 8 long and is used as it comes.
function printWithoutEmptyBand(r) {
  const p = likenessPrint(r);
  if (p.length !== 16 * 12 + 8) return p;
  const core = [];
  for (let s = 0; s < 12; s++) for (let j = 1; j < 16; j++) core.push(p[s * 16 + j]);
  const mean = core.reduce((a, b) => a + b, 0) / core.length;
  return Float64Array.from([...core.map((v) => v - mean), ...p.slice(192)]);
}

test('25 frozen entries, ids hyper- and unique, radial deck, this lane, a kind, a name, a length of at most 1.5 s', () => {
  assert.ok(Object.isFrozen(RADIAL_HYPER));
  assert.equal(RADIAL_HYPER.length, 25);
  assert.equal(new Set(RADIAL_HYPER.map((e) => e.id)).size, 25);
  for (const e of RADIAL_HYPER) {
    assert.ok(Object.isFrozen(e), e.id);
    assert.match(e.id, /^hyper-[a-z0-9-]+$/);
    assert.equal(e.deck, 'radial');
    assert.equal(e.lane, 'HYPERRADIAL');
    assert.ok(typeof e.kind === 'string' && e.kind.length > 0, e.id);
    assert.ok(typeof e.name === 'string' && e.name.length > 0, e.id);
    assert.ok(e.dur > 0 && e.dur <= 1.5, e.id);
    assert.equal(typeof e.render, 'function');
  }
  assert.ok(new Set(RADIAL_HYPER.map((e) => e.kind)).size >= 6, 'at least six kinds of distortion');
});

test('every entry carries procedural provenance: a method, an ISO date and a recipe of how it is made', () => {
  for (const e of RADIAL_HYPER) {
    assert.equal(e.provenance.method, 'procedural', e.id);
    assert.match(e.provenance.made, /^\d{4}-\d{2}-\d{2}$/, e.id);
    assert.ok(e.provenance.recipe.length > 30, e.id);
  }
});

test('every sound renders to finite samples, is silent before it starts and after it ends, and lasts no longer than it says', () => {
  for (const e of RADIAL_HYPER) {
    const r = render(e);
    let tail = 0;
    for (let i = 0; i < r.L.length; i++) assert.ok(Number.isFinite(r.L[i]) && Number.isFinite(r.R[i]), `${e.id} finite at ${i}`);
    for (let i = r.L.length - 960; i < r.L.length; i++) tail = Math.max(tail, Math.abs(r.L[i]), Math.abs(r.R[i]));
    assert.ok(dbfs(tail) < -80, `${e.id} silent at the end`);
    assert.ok(Math.abs(r.L[0]) + Math.abs(r.R[0]) === 0, `${e.id} silent before it starts`);
    const m = measure(r);
    assert.ok(m.peak > 0, `${e.id} makes a sound`);
    assert.ok(m.duration <= e.dur + 0.05, `${e.id} lasts ${m.duration.toFixed(3)} s, says ${e.dur}`);
    assert.ok(r.end > r.at && r.end - r.at <= 1.5, `${e.id} returns its end time`);
  }
});

test('THE LEVEL CAP: at every seed tried, no sound is louder than the loudest click noise, in peak or in 50 ms RMS', () => {
  assert.ok(CAP.peak > 0.1 && CAP.rms50 > 0.05, 'the cap was measured');
  for (const e of RADIAL_HYPER) {
    for (const seed of SEEDS) {
      const m = measure(render(e, { seed }));
      assert.ok(m.peak <= CAP.peak, `${e.id} seed ${seed} peak ${dbfs(m.peak).toFixed(1)} over ${dbfs(CAP.peak).toFixed(1)}`);
      assert.ok(m.rms50 <= CAP.rms50, `${e.id} seed ${seed} rms50 ${dbfs(m.rms50).toFixed(1)} over ${dbfs(CAP.rms50).toFixed(1)}`);
    }
  }
});

test('subtle: the median sound sits at least 2 dB under the cap in peak and in 50 ms RMS', () => {
  const ms = RADIAL_HYPER.map((e) => measure(render(e)));
  const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  assert.ok(dbfs(median(ms.map((m) => m.peak))) <= dbfs(CAP.peak) - 2);
  assert.ok(dbfs(median(ms.map((m) => m.rms50))) <= dbfs(CAP.rms50) - 2);
});

test('strength scales the level: strength 0.3 is quieter than strength 1, and strength below 0.15 is held at 0.15', () => {
  for (const e of RADIAL_HYPER) {
    const full = measure(render(e)).peak;
    const soft = measure(render(e, { strength: 0.3 })).peak;
    assert.ok(soft < full * 0.6, `${e.id} ${soft} vs ${full}`);
    const floor = measure(render(e, { strength: 0.15 })).peak;
    const below = measure(render(e, { strength: 0.01 })).peak;
    assert.ok(Math.abs(below - floor) < 1e-9, `${e.id} clamped`);
  }
});

test('never harsh at the top: under 1.9 percent of each sound\'s energy lies above 10 kHz', () => {
  for (const e of RADIAL_HYPER) {
    const m = measure(render(e));
    assert.ok(m.highShare <= 0.019, `${e.id} ${m.highShare.toFixed(4)}`);
  }
});

test('the same seed renders the same samples; a different seed renders a different take', () => {
  for (const e of RADIAL_HYPER) {
    const a = renderFresh(e, { seed: 5 }); const b = renderFresh(e, { seed: 5 }); const c = renderFresh(e, { seed: 6 });
    assert.deepEqual(a.L, b.L, e.id);
    let diff = 0;
    for (let i = 0; i < a.L.length; i++) diff = Math.max(diff, Math.abs(a.L[i] - c.L[i]));
    assert.ok(diff > 1e-4, `${e.id} varies with the seed`);
  }
});

test('DISTINCT: at every seed tried, no two of the 25 have a likeness of 0.95 or more (the print without its empty band)', () => {
  // the wiring passes a fresh seed per play, and a glitch or scatter sound lays out its slices by seed, so one seed
  // is not enough: each seed's takes of all 25 are compared with each other
  for (const seed of SEEDS) {
    const prints = RADIAL_HYPER.map((e) => printWithoutEmptyBand(render(e, { seed })));
    for (let i = 0; i < prints.length; i++) {
      for (let j = i + 1; j < prints.length; j++) {
        const l = likeness(prints[i], prints[j]);
        assert.ok(l < 0.95, `seed ${seed}: ${RADIAL_HYPER[i].id} / ${RADIAL_HYPER[j].id} ${l.toFixed(3)}`);
      }
    }
  }
});

test('the vacuity control: one sound at full and at half strength reads above 0.95, so the print can flag a twin', () => {
  for (const e of RADIAL_HYPER) {
    const l = likeness(printWithoutEmptyBand(render(e)), printWithoutEmptyBand(render(e, { strength: 0.5 })));
    assert.ok(l > 0.95, `${e.id} ${l.toFixed(3)}`);
  }
});

// THE TONE RULES, read off the graph each sound builds in a recording context
function graphOf(e) {
  const ctx = new Ctx();
  const dest = new Node('dest-under-test');
  const made = [];
  for (const k of ['createGain', 'createOscillator', 'createBiquadFilter', 'createWaveShaper', 'createBufferSource', 'createStereoPanner', 'createDelay']) {
    const f = ctx[k].bind(ctx);
    ctx[k] = (...a) => { const n = f(...a); made.push(n); return n; };
  }
  e.render(ctx, 0.1, dest, { strength: 1, seed: 1 });
  return { made, dest };
}

const isGuardLp = (n, max) => n.kind === 'biquad' && n.type === 'lowpass' && n.frequency.value <= max && n.frequency.events.every((ev) => ev[1] <= max);

test('every output envelope starts and ends at zero, rises over at least 4 ms and falls exponentially over at least 60 ms', () => {
  for (const e of RADIAL_HYPER) {
    const { made, dest } = graphOf(e);
    const outs = made.filter((n) => n.kind === 'gain' && n.out.has(dest));
    assert.ok(outs.length >= 1, `${e.id} has an output envelope`);
    for (const g of outs) {
      const ev = g.gain.events;
      assert.equal(ev[0][1], 0, `${e.id} starts at 0`);
      assert.equal(ev[ev.length - 1][1], 0, `${e.id} ends at 0`);
      assert.ok(ev[1][2] - ev[0][2] >= HYPER_TONE.attackMin - 1e-9, `${e.id} attack`);
      // the release is an exponential fall to 1 percent over at least 60 ms, then a short linear step to 0
      assert.equal(ev[ev.length - 2][0], 'exp', `${e.id} releases exponentially`);
      assert.ok(ev[ev.length - 2][2] - ev[ev.length - 3][2] >= HYPER_TONE.releaseMin - 1e-9, `${e.id} release`);
      assert.ok(Math.abs(ev[ev.length - 1][2] - ev[ev.length - 2][2] - HYPER_TONE.tail) < 1e-9, `${e.id} tail`);
    }
  }
});

test('a raw square or saw goes first into a low-pass at or below 2.4 kHz', () => {
  for (const e of RADIAL_HYPER) {
    for (const o of graphOf(e).made.filter((n) => n.kind === 'osc' && (n.type === 'square' || n.type === 'sawtooth'))) {
      assert.ok(o.out.size > 0, e.id);
      for (const n of o.out) assert.ok(isGuardLp(n, HYPER_TONE.rawCeiling), `${e.id} ${o.type} into ${n.kind}`);
    }
  }
});

test('every shaper reaches the output only through a low-pass at or below 9 kHz', () => {
  let shapers = 0;
  for (const e of RADIAL_HYPER) {
    const { made, dest } = graphOf(e);
    for (const w of made.filter((n) => n.kind === 'shaper')) {
      shapers++;
      const seen = new Set([w]);
      const q = [w];
      while (q.length) {
        for (const n of q.shift().out) {
          if (!(n instanceof Node) || seen.has(n) || isGuardLp(n, HYPER_TONE.finalLp)) continue;
          assert.notEqual(n, dest, `${e.id}: a shaper reaches the output unfiltered`);
          seen.add(n); q.push(n);
        }
      }
    }
  }
  assert.ok(shapers >= 10, 'the deck is distorted');
});

test('crush holds samples and quantises them; rng is seeded and stays in [0, 1)', () => {
  const y = crush(Float32Array.from([0.1, 0.9, -0.3, 0.6]), 2, 24000, 48000);
  assert.deepEqual(Array.from(y), [0, 0, -0.5, -0.5]);
  const a = rng(9); const b = rng(9);
  for (let i = 0; i < 100; i++) { const v = a(); assert.equal(v, b()); assert.ok(v >= 0 && v < 1); }
});
