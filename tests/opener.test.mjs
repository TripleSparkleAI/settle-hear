// THE OPENING BLEND (lane OPENINGSET): the first set of a visit is the opener and never house; different seeds give
// different openers of the same arc; the slot order holds; every envelope is click-free; MUTE, PAUSE, steering and a
// mode pick behave; the tag round-trips and replays.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx } from './fakeaudio.mjs';
import {
  configure, unlockNow, createSymphony, sound, djSteer, STEER_IDLE, djLive,
  OPENER, OPENER_SLOTS, SLOT_KEYS, RATE_KEYS, settleOpener, openerPlan, envAt, isoSamples, maxStep, pulseShape,
  openerVoices, openerVisit, resetOpenerVisit, encodeOpenerTag, decodeOpenerTag, isOpenerTag, decodeTag, tagLines,
  playTag, readOpenerMemory, writeOpenerMemory,
} from '../src/index.js';
import { softClipCurve } from '../src/opener.js';

const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

// drive a symphony on the fake audio clock; returns the bar log (what each audible bar scheduled)
function drive(s, E, seconds, step = 0.5) {
  for (let t = 0; t < seconds; t += step) { E.ctx.currentTime += step; s.tick(); }
}

test('the arc: seven slots in a fixed order, the length inside 240 .. 420 s, the handover 24 .. 40 s', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const c = settleOpener({ seed, theme: 'highlands' });
    const P = openerPlan(c);
    assert.deepEqual(P.slots.map((x) => x.key), SLOT_KEYS);
    assert.ok(P.length >= OPENER.minSeconds && P.length <= OPENER.maxSeconds, `length ${P.length}`);
    assert.ok(P.handover >= 24 && P.handover <= 40);
    for (let i = 1; i < P.slots.length; i++) assert.equal(P.slots[i].start, P.slots[i - 1].end);
    assert.equal(P.slots.at(-1).end, P.length);
    // the three rate slots hold each slow rate once; the gamma slot is the fifth slot every time
    assert.deepEqual(P.slots.filter((x) => x.rate).map((x) => x.rate).sort(), RATE_KEYS.slice().sort());
    assert.equal(P.slots[4].key, 'gamma');
    // every rate slot lasts at least 30 s, so a pulse is heard as a texture
    for (const sl of P.slots.filter((x) => x.rate)) assert.ok(sl.end - sl.start >= 30, `${sl.key} ${sl.end - sl.start}`);
  }
});

test('the voices enter in the arc order: silence first, then the tone, pulse 1, the harmonic, pulse 2, gamma, the bloom', () => {
  const P = openerPlan(settleOpener({ seed: 7, theme: 'cathedral' }));
  const firstOn = (v) => { for (let t = 0; t < P.end; t += 0.25) if (envAt(P.voices[v].env, t) > 1e-4) return t; return Infinity; };
  const sl = Object.fromEntries(P.slots.map((x) => [x.key, x]));
  assert.ok(firstOn('first') > 0, 'the opener starts in silence');
  assert.ok(firstOn('first') < sl['rate-1'].start);
  assert.ok(firstOn('iso1') >= sl['rate-1'].start && firstOn('iso1') < sl.harmonic.start);
  assert.ok(firstOn('harm') >= sl.harmonic.start && firstOn('pad') >= sl.harmonic.start);
  assert.ok(firstOn('iso2') >= sl['rate-2'].start && firstOn('iso2') < sl.gamma.start);
  assert.ok(firstOn('gamma') >= sl.gamma.start && firstOn('gamma') < sl.bloom.start);
  assert.ok(firstOn('iso3') >= sl.bloom.start);
  assert.ok(P.bells.every((b) => b.at >= sl.bloom.start && b.at < sl.ease.start));
  // the 40 Hz pulse is gone before the arc ends; every voice is silent at the end of the handover
  assert.equal(envAt(P.voices.gamma.env, P.length), 0);
  for (const v of Object.values(P.voices)) assert.equal(envAt(v.env, P.end), 0);
});

test('two seeds give two different openers of the same shape; the decks never repeat last visit\'s order', () => {
  const a = settleOpener({ seed: 11, theme: 'highlands' });
  const b = settleOpener({ seed: 12, theme: 'highlands' });
  const keys = ['durations', 'rateOrder', 'timbreFirst', 'timbreHarm', 'keyShift', 'harmRatio', 'gammaMult', 'padCut', 'bellGap', 'handover'];
  assert.ok(keys.some((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])), 'two seeds differ somewhere');
  assert.deepEqual(openerPlan(a).slots.map((x) => x.key), openerPlan(b).slots.map((x) => x.key));
  // the same seed and the same memory give the same opener
  assert.deepEqual(settleOpener({ seed: 11, theme: 'highlands' }), a);
  // THE DECK RULE with memory: a visit after a visit never deals the same rate order or first timbre
  for (let seed = 1; seed <= 60; seed++) {
    const last = settleOpener({ seed: seed + 1000, theme: 'embers' });
    const store = memStore();
    writeOpenerMemory(store, last);
    const now = settleOpener({ seed, theme: 'embers', last: readOpenerMemory(store) });
    assert.notDeepEqual(now.rateOrder, last.rateOrder);
    assert.notEqual(now.timbreFirst, last.timbreFirst);
    assert.notEqual(now.timbreHarm, now.timbreFirst);
  }
  // across 60 visits every rate order turns up
  const orders = new Set();
  for (let seed = 1; seed <= 60; seed++) orders.add(settleOpener({ seed }).rateOrder.join());
  assert.equal(orders.size, 6);
  // every varied detail really varies: across 60 visits each choice takes every value it may take (lengths at least 6)
  const seen = {};
  for (let seed = 1; seed <= 60; seed++) {
    const c = settleOpener({ seed });
    for (const k of ['keyShift', 'harmRatio', 'gammaMult', 'padCut', 'bellGap', 'timbreFirst', 'timbreHarm']) (seen[k] ??= new Set()).add(c[k]);
    (seen.length ??= new Set()).add(c.durations.reduce((x, y) => x + y, 0));
  }
  assert.deepEqual(Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.size])), { keyShift: 3, harmRatio: 3, gammaMult: 3, padCut: 3, bellGap: 3, timbreFirst: 5, timbreHarm: 5, length: seen.length.size });
  assert.ok(seen.length.size >= 6);
});

test('the levels: the voices\' sum stays under OPENER.maxSum, every envelope moves slowly (no step)', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const P = openerPlan(settleOpener({ seed }));
    let worst = 0;
    for (let t = 0; t <= P.end; t += 0.1) {
      let sum = Object.values(P.voices).reduce((a, v) => a + envAt(v.env, t), 0);
      if (P.bells.some((b) => t >= b.at && t < b.at + 5.2)) sum += 0.045;
      worst = Math.max(worst, sum);
    }
    assert.ok(worst <= OPENER.maxSum, `sum ${worst}`);
    // the slowest envelope rate allowed: a voice gain never moves faster than 0.05 a second (no audible step)
    for (const v of Object.values(P.voices)) for (let i = 1; i < v.env.length; i++) {
      const [t0, a] = v.env[i - 1];
      const [t1, b] = v.env[i];
      if (t1 > t0) assert.ok(Math.abs(b - a) / (t1 - t0) < 0.05, `rate ${(b - a) / (t1 - t0)}`);
      else assert.equal(a, b, 'two breakpoints at one time would step');
    }
  }
});

test('click-free pulses: every isochronic burst rises and falls through raised-cosine edges, no step above the sine\'s own', () => {
  for (const [rate, carrier] of [[40, 432], [10, 288], [7.83, 324], [6, 216]]) {
    const x = isoSamples(48000, rate, carrier);
    const sineSlope = (2 * Math.PI * carrier) / 48000;
    assert.ok(maxStep(x) <= sineSlope * 1.001, `rate ${rate}: step ${maxStep(x)} vs ${sineSlope}`);
    // the loop seam: the buffer starts and ends in silence
    assert.equal(x[0], 0);
    assert.ok(Math.abs(x[x.length - 1]) < 1e-6);
    // the envelope alone: a raised cosine never moves more than pi / (2 x ramp) a sample
    const { ramp } = pulseShape(rate, 48000);
    assert.ok(Math.PI / (2 * ramp) < 0.02, `ramp ${ramp}`);
  }
  // a 40 Hz pulse is on 12.5 ms of every 25
  const { on, period } = pulseShape(40, 48000);
  assert.equal(on, 600);
  assert.equal(period, 1200);
  // red-proof: a hard gate (no ramp) would step far above the sine's slope
  const hard = new Float32Array(1200);
  for (let j = 300; j < 900; j++) hard[j] = Math.sin((2 * Math.PI * 432 * j) / 48000);
  assert.ok(maxStep(hard) > (2 * Math.PI * 432) / 48000 * 2);
});

test('the scheduled automation is continuous: every bar starts where the last ended', () => {
  const ctx = new Ctx();
  const P = openerPlan(settleOpener({ seed: 5 }));
  const V = openerVoices(ctx, ctx.destination, P, { startAt: 0 });
  let t = 0;
  for (let pos = 0; pos < P.end; pos += 2) { V.schedule(t, pos, Math.min(P.end, pos + 2)); t += 2; }
  for (const [name, g] of Object.entries(V.gains)) {
    const ev = g.gain.events;
    for (let i = 1; i < ev.length; i++) {
      if (ev[i][0] !== 'set') continue;
      // a set lands at a bar start and repeats the value the previous ramp reached there
      assert.ok(Math.abs(ev[i][1] - ev[i - 1][1]) < 1e-9, `${name}: a step of ${ev[i][1] - ev[i - 1][1]} at ${ev[i][2]}`);
    }
  }
  assert.ok(V.peak <= 0.2);
});

test('the tag: "<THEME>.open.v1.<code>" round-trips every choice and rebuilds the same plan', () => {
  const c = settleOpener({ seed: 99, theme: 'deepsea' });
  const tag = encodeOpenerTag(c, 77);
  assert.match(tag, /^DEEP\.open\.v1\.[0-9A-Z]+$/);
  assert.ok(isOpenerTag(tag));
  const d = decodeOpenerTag(tag);
  assert.deepEqual(d.choices, c);
  assert.equal(d.at, 77);
  assert.deepEqual(d.plan, openerPlan(c));
  // through the DJ's decodeTag and tagLines, and through playTag (no live symphony)
  const D = decodeTag(tag);
  assert.equal(D.kind, 'opener');
  assert.equal(D.section, 'opener');
  assert.ok(tagLines(D).some(([k, v]) => k === 'mode' && /opening blend/.test(v)));
  const R = playTag(tag, { live: false });
  assert.deepEqual(R.opener, openerPlan(c));
});

test('the first set of a visit is the opener, never house; then the handover brings the DJ\'s first set', () => {
  resetOpenerVisit();
  configure({ createContext: () => new Ctx() });
  const s = createSymphony({ seed: 21, theme: 'highlands', auto: false, house: true, opener: true, steer: null, votes: null, influenceStorage: memStore() });
  const E = unlockNow();
  const sets = [];
  s.dj.onSetCycle((ev) => sets.push(ev));
  const P = openerVisit.plan;
  assert.ok(P, 'the plan is settled at once');
  // the whole arc: no house bar is ever played, the tag is an opener tag, the DJ line names the blend
  let houseBars = 0;
  // (the fake clock's master-beat mapping drifts against the real one, so drive by the opener's own clock)
  for (let guard = 0; openerVisit.pos < P.length - 4 && guard < 4000; guard++) {
    E.ctx.currentTime += 0.5;
    s.tick();
    if (s.state.played.some((p) => p.inst === 'house')) houseBars += 1;
  }
  assert.equal(houseBars, 0, 'no house during the opener');
  assert.ok(isOpenerTag(s.state.tag));
  assert.equal(s.state.opener.phase, 'play');
  assert.equal(s.state.parts.mode, 'opening blend');
  // the DJ line's words: the slot, its pulse rate (the ease plays the 40 Hz tail), the slots' rate labels
  assert.equal(s.state.opener.slot, 'ease');
  assert.equal(s.state.opener.rateHz, 40);
  assert.deepEqual(s.state.opener.slots.filter((x) => x.rateLabel).map((x) => x.key), ['rate-1', 'rate-2', 'gamma', 'bloom']);
  assert.equal(djLive.get().opener.on, true);
  assert.equal(s.state.mix, null, 'the house brain has not been asked for a bar');
  // through the handover and past it: the house set plays, the set hooks fired with the opener's tag
  for (let guard = 0; openerVisit.state !== 'done' && guard < 4000; guard++) { E.ctx.currentTime += 0.5; s.tick(); }
  drive(s, E, 6);
  assert.ok(s.state.played.some((p) => p.inst === 'house'), 'the DJ\'s first set plays after the opener');
  assert.equal(sets.length, 1);
  assert.ok(isOpenerTag(sets[0].tag));
  assert.equal(sets[0].reason, 'the opening blend');
  assert.equal(s.state.opener, null);
  assert.equal(openerVisit.state, 'done');
  assert.equal(s.state.mix.setBar < 30, true, 'the first set starts at its own bar 0 at the handover');
  s.dispose();
  // a second player in the same visit plays house at once (one opener per visit)
  const s2 = createSymphony({ seed: 22, theme: 'embers', auto: false, house: true, opener: true, steer: null, votes: null });
  drive(s2, E, 6);
  assert.equal(s2.state.opener, null);
  assert.ok(s2.state.played.some((p) => p.inst === 'house'));
  s2.dispose();
});

test('the opener\'s clock holds through MUTE ALL and PAUSE, and waits for the first sound', () => {
  resetOpenerVisit();
  configure({ createContext: () => new Ctx() });
  const s = createSymphony({ seed: 31, theme: 'cathedral', auto: false, house: true, opener: true, steer: null, votes: null });
  // before any engine: bars on the wall clock, the opener waits at 0
  s.tick(0); s.tick(10); s.tick(20);
  assert.equal(openerVisit.pos, 0);
  assert.equal(s.state.opener.phase, 'waiting');
  const E = unlockNow();
  drive(s, E, 20);
  const a = openerVisit.pos;
  assert.ok(a > 10);
  sound.setMuted(true);
  drive(s, E, 20);
  assert.ok(openerVisit.pos - a < 3.5, 'muted: the clock holds (only the bar in flight)');
  sound.setMuted(false);
  const b = openerVisit.pos;
  s.stop();
  drive(s, E, 20);
  assert.ok(openerVisit.pos - b < 3.5, 'paused: the clock holds');
  s.play();
  drive(s, E, 10);
  assert.ok(openerVisit.pos > b + 5, 'it goes on after the pause');
  assert.ok(!s.state.played.some((p) => p.inst === 'house'));
  s.dispose();
});

test('steering, a mode pick and a tag yield the opener at once; an idle reset does not', () => {
  for (const how of ['steer', 'pick', 'pure', 'lean']) {
    resetOpenerVisit();
    configure({ createContext: () => new Ctx() });
    djSteer.set?.(STEER_IDLE);
    const s = createSymphony({ seed: 41, theme: 'embers', auto: false, house: true, opener: true, steer: how === 'steer' ? djSteer : null, votes: null });
    const E = unlockNow();
    drive(s, E, 30);
    assert.equal(s.state.opener.phase, 'play');
    if (how === 'steer') {
      djSteer.set(STEER_IDLE); // a reset to idle is not a steer
      drive(s, E, 3);
      assert.ok(s.state.opener, 'an idle reset keeps the opener');
      djSteer.set({ ...STEER_IDLE, leans: { ...STEER_IDLE.leans, beat: 1 } });
    }
    if (how === 'pick') s.yieldOpener('a mode pick');
    if (how === 'pure') { s.setHouse(false); s.setPure(true); }
    if (how === 'lean') s.setMixLean('energy', 1);
    drive(s, E, 4);
    assert.equal(s.state.opener, null, `${how} yields`);
    assert.equal(openerVisit.state, 'done');
    if (how === 'pure') assert.equal(s.state.pure, true, 'the McKusker flute plays as before');
    else assert.ok(s.state.played.some((p) => p.inst === 'house'), `${how}: the house DJ plays as before`);
    s.dispose();
    djSteer.set?.(STEER_IDLE);
  }
});

test('playTag(an opener tag) plays that opener again from its start', () => {
  resetOpenerVisit();
  configure({ createContext: () => new Ctx() });
  const s = createSymphony({ seed: 51, theme: 'highlands', auto: false, house: true, opener: false, steer: null, votes: null });
  const E = unlockNow();
  drive(s, E, 6);
  assert.equal(s.state.opener, null, 'opener off: house at once (the library default)');
  const c = settleOpener({ seed: 4242, theme: 'crystals' });
  s.playTag(encodeOpenerTag(c, 0));
  drive(s, E, 8);
  assert.equal(s.state.opener.phase, 'play');
  assert.deepEqual(openerVisit.choices, c);
  assert.equal(s.state.theme.key, 'crystals');
  s.dispose();
});

test('the opener\'s limiter adds no gain: unity slope for quiet signals, never above the ceiling', () => {
  const c = softClipCurve(0.8, 2049);
  const mid = 1024;
  const slope = (c[mid + 1] - c[mid - 1]) / (2 * (2 / 2048));
  assert.ok(Math.abs(slope - 1) < 1e-3, `slope ${slope}`);
  assert.ok(Math.max(...c.map(Math.abs)) <= 0.8);
  // a quiet 0.15 passes within 1.2%; the envelope sum's ceiling 0.62 is held under 0.8
  assert.ok(Math.abs(0.8 * Math.tanh(0.15 / 0.8) - 0.15) / 0.15 < 0.012);
  assert.ok(0.8 * Math.tanh(OPENER.maxSum / 0.8) < 0.8);
});
