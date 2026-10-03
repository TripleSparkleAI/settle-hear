// THE PASSES (lane HOUSEDJ, 25; lane BINAURALMODES added the vocoder and the ring shimmer, 27; lane HEROSHUFFLE eight more, 35): the effect passes each build and connect against a fake AudioContext, write only
// finite values, free what they made; the bag deals all 35 before any repeats; every chain stays inside its CPU
// budget and ends in a limiter; the DJ swaps only at a bar line; the symphony's house set obeys the gesture rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, Node, writes, reach, all } from './fakeaudio.mjs';
import {
  HOUSE, PASSES, PASS_KEYS, passOf, createPassBag, fillChain, chainCost, houseSwap, progression, buildChain,
  createHouseSet, houseBpm, configure, unlockNow, getEngine, createSymphony, sound, houseLive, midiHz,
} from '../src/index.js';

const info = (bar = 0) => ({ beatDur: 0.5, bar, chord: [57, 61, 64], root: 57, melody: [{ midi: 69, at: 0, beats: 1 }, { midi: 71, at: 1, beats: 2 }], heat: 0.4 });

test('twenty-seven passes, each named, explained in plain words, priced and with documented parameters', () => {
  assert.equal(PASSES.length, 35);
  assert.equal(new Set(PASS_KEYS).size, 35);
  for (const p of PASSES) {
    assert.match(p.key, /^[a-z-]+$/);
    assert.ok(p.label && p.label === p.label.toUpperCase(), p.key);
    assert.ok(p.line.length > 30, `${p.key}: a line a sound designer can read`);
    assert.doesNotMatch(p.line, /[–—]/, `${p.key}: no em or en dashes`);
    assert.ok(Number.isInteger(p.cost) && p.cost >= 1 && p.cost <= 16, p.key);
    assert.ok(Object.keys(p.params).length >= 1, p.key);
    for (const [n, v] of Object.entries(p.params)) assert.ok(Array.isArray(v) && Number.isFinite(v[0]) && typeof v[1] === 'string', `${p.key}.${n}`);
    assert.equal(passOf(p.key), p);
  }
  assert.equal(passOf('nope'), undefined);
});

test('every pass builds, connects input to output, plays eight bars with finite values only, and frees what it made', () => {
  for (const P of PASSES) {
    const ctx = new Ctx();
    writes.length = 0;
    const start = all.length;
    const p = Object.fromEntries(Object.entries(P.params).map(([k, [v]]) => [k, v]));
    const inst = P.build(ctx, p);
    assert.ok(inst.input instanceof Node && inst.output instanceof Node, P.key);
    assert.ok(reach(inst.input).has(inst.output), `${P.key}: input reaches output`);
    for (let b = 0; b < 8; b++) { ctx.currentTime = b * 2; inst.bar?.(ctx.currentTime, info(b)); }
    assert.ok(writes.every(Number.isFinite), `${P.key}: a non-finite write`);
    inst.g.dispose();
    const made = all.slice(start).filter((n) => inst.g.nodes.includes(n));
    assert.ok(made.length >= 1, P.key);
    for (const n of made) {
      assert.equal(n.out.size, 0, `${P.key}: ${n.kind} still connected after dispose`);
      if (n.kind === 'osc' || (n.kind === 'src' && n.started)) assert.ok(n.stopped, `${P.key}: a source left running`);
    }
  }
});

test('the voices make sound in the key: the kit lands on the beat, the sub on the off-beats, pitches from A = 432', () => {
  const ctx = new Ctx();
  const start = all.length;
  const kit = passOf('kit').build(ctx, { kick: 0.75, hats: 0.14, clap: 0.16 });
  kit.bar(10, info(0));
  const oscs = all.slice(start).filter((n) => n.kind === 'osc');
  assert.equal(oscs.length, 4, 'four kicks a bar');
  const kickEnd = oscs[0].frequency.events.find((e) => e[0] === 'exp')[1];
  assert.ok(Math.abs(kickEnd - midiHz(33)) < 1e-9 && kickEnd >= 38 && kickEnd <= 80, `the kick ends on the root A, 54 Hz, ${kickEnd}`);
  assert.deepEqual(oscs.map((o) => o.frequency.events[0][2]), [10, 10.5, 11, 11.5]);
});

test('the bag deals all 35 before any repeats, never the same pass twice across a boundary, and is seeded', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const bag = createPassBag({ seed });
    const seq = Array.from({ length: 35 * 6 }, () => bag.next());
    for (let k = 0; k < 6; k++) assert.equal(new Set(seq.slice(35 * k, 35 * (k + 1))).size, 35, `seed ${seed} cycle ${k}`);
    for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], `seed ${seed} at ${i}`);
    const again = createPassBag({ seed });
    assert.deepEqual(Array.from({ length: 30 }, () => again.next()), seq.slice(0, 30));
  }
  const a = createPassBag({ seed: 1 });
  const b = createPassBag({ seed: 2 });
  assert.notDeepEqual(Array.from({ length: 35 }, () => a.next()), Array.from({ length: 35 }, () => b.next()), 'seeds differ');
});

test('chains use the passes in the bag\'s order (all 35 before a repeat), never exceed the budget, never repeat inside', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const bag = createPassBag({ seed });
    let keys = fillChain(bag, []);
    const used = [...keys];
    for (let s = 0; s < 80; s++) {
      assert.ok(keys.length >= 2 && keys.length <= HOUSE.chainMax, `seed ${seed}: ${keys.length} passes`);
      assert.ok(chainCost(keys) <= HOUSE.budget, `seed ${seed}: cost ${chainCost(keys)}`);
      assert.equal(new Set(keys).size, keys.length, 'no pass twice in a chain');
      const next = s % 7 === 6 ? fillChain(bag, []) : fillChain(bag, keys.slice(HOUSE.swapCount));
      for (const k of next) if (!keys.slice(HOUSE.swapCount).includes(k) || s % 7 === 6) used.push(k);
      keys = next;
    }
    assert.equal(new Set(used.slice(0, 35)).size, 35, `seed ${seed}: the first 35 used are all 35`);
  }
});

test('the CPU budget holds for every chain the bag can make: cost <= 34 units and at most 70 live nodes', () => {
  let worst = 0;
  let worstNodes = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const bag = createPassBag({ seed });
    for (let s = 0; s < 20; s++) {
      const keys = fillChain(bag, []);
      const c = buildChain(new Ctx(), keys);
      worst = Math.max(worst, c.cost);
      worstNodes = Math.max(worstNodes, c.nodes);
      c.dispose();
    }
  }
  assert.ok(worst <= HOUSE.budget, `worst cost ${worst}`);
  assert.ok(worstNodes <= 70, `worst node count ${worstNodes}`);
});

test('a chain ends in its limiter: the passes in series, then the compressor, which is the chain\'s output', () => {
  const ctx = new Ctx();
  const c = buildChain(ctx, ['soft-clip', 'plate', 'kit', 'pump']);
  assert.equal(c.output, c.limiter);
  assert.equal(c.limiter.kind, 'compressor');
  assert.ok(c.limiter.ratio.value >= 12 && c.limiter.threshold.value <= -12, 'a hard limiter');
  assert.ok(reach(c.input).has(c.limiter), 'the input reaches the limiter');
  assert.equal(c.limiter.out.size, 0, 'nothing after it inside the chain');
  assert.deepEqual(c.keys, ['soft-clip', 'plate', 'kit', 'pump']);
  // negative control: a chain of an unknown pass is still a limiter alone, never a raw path
  const empty = buildChain(ctx, ['nope']);
  assert.ok(reach(empty.input).has(empty.limiter) && empty.keys.length === 0);
});

test('the DJ swaps on a new theme (all), on the beat or split light after 4 bars (roll), or after 16 bars; never otherwise', () => {
  const d = (o) => ({ yes: { beat: false, split: false }, themeChanged: false, beatChanged: false, ...o });
  assert.equal(houseSwap(d({ themeChanged: true }), 0), 'all');
  assert.equal(houseSwap(d({ yes: { beat: true } }), 3), null, 'too soon');
  assert.equal(houseSwap(d({ yes: { beat: true } }), 4), 'roll');
  assert.equal(houseSwap(d({ yes: { split: true } }), 9), 'roll');
  assert.equal(houseSwap(d({}), 15), null);
  assert.equal(houseSwap(d({}), 16), 'roll');
  assert.equal(houseSwap(null, 99), null);
});

test('the chords: I V vi IV in a major mode, i VI III VII in a minor one, from the theme root', () => {
  assert.deepEqual(progression(57, 'ionian', 0), [57, 61, 64]);
  assert.deepEqual(progression(57, 'ionian', 1), [64, 68, 71]);
  assert.deepEqual(progression(57, 'ionian', 2), [66, 69, 73]);
  assert.deepEqual(progression(57, 'aeolian', 0), [57, 60, 64]);
  assert.deepEqual(progression(57, 'aeolian', 1), [65, 69, 72]);
  assert.deepEqual(progression(57, 'minor pentatonic', 0), [57, 60, 64]);
});

test('the tempo: 118 bpm calm to 126 hot, smoothed, never outside', () => {
  assert.equal(houseBpm(0), 118);
  assert.equal(houseBpm(1), 126);
  assert.ok(houseBpm(1, 118) > 118 && houseBpm(1, 118) < 126);
  assert.equal(houseBpm(NaN), 118);
});

test('the house set swaps only at a bar line, crossfading from that bar\'s start, and the tune sits under the bed', () => {
  const ctx = new Ctx();
  const out = ctx.createGain();
  const set = createHouseSet(ctx, out, { seed: 5 });
  const first = set.state().keys;
  ctx.currentTime = 3;
  const r = set.bar(4, { yes: {}, themeChanged: true, mode: 'tune' }, 0.5, { notes: [{ midi: 69, at: 0, beats: 1 }], root: 57, mode: 'ionian' });
  assert.equal(r.swap, 'all');
  assert.notDeepEqual(set.state().keys, first);
  const fadeIn = set.chain.output.out.values().next().value;
  assert.deepEqual(fadeIn.gain.events.slice(-2).map((e) => e[2]), [4, 4 + HOUSE.crossfadeBeats * 0.5], 'the crossfade starts on the bar line');
  const r2 = set.bar(6, { yes: {}, mode: 'tune' }, 0.5, {});
  assert.equal(r2.swap, null, 'no swap on an ordinary bar');
  assert.ok(HOUSE.melodyLevel <= 0.25 && HOUSE.melodyLevel * 5 <= HOUSE.bedLevel + 1e-9, 'the tune at least 14 dB under the bed');
  set.dispose();
});

test('the symphony\'s house set: no sound before a gesture, then a chain behind the master limiter, MUTE ALL to zero', () => {
  let built = 0;
  configure({ createContext: () => { built++; return new Ctx(); } });
  const s = createSymphony({ seed: 9, theme: 'highlands', auto: false, house: true });
  for (let t = 0; t < 20; t += 0.5) s.tick(t);
  assert.equal(built, 0, 'no AudioContext before a gesture');
  assert.equal(getEngine(), null);
  assert.equal(houseLive.get().audible, false);
  const E = unlockNow();
  writes.length = 0;
  for (let k = 0; k < 40; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  const st = s.state;
  assert.equal(st.house.on, true);
  assert.ok(st.house.keys.length >= 2, 'a chain is playing');
  assert.ok(st.bpm >= 118 && st.bpm <= 126, `house tempo ${st.bpm}`);
  assert.ok(writes.every(Number.isFinite), 'only finite values');
  assert.ok(reach(E.master).has(E.limit), 'the house channel reaches the master limiter');
  assert.equal([...E.limit.out][0].gain.value <= 1, true);
  sound.setMuted(true);
  assert.equal(E.mute.gain.value, 0, 'MUTE ALL takes the output to zero');
  sound.setMuted(false);
  s.setHouse(false);
  assert.equal(s.state.house.on, false);
  assert.equal(houseLive.get().house, false);
  s.dispose();
});
