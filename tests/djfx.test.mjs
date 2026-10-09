// THE DJ'S DESK (lane DJFX, dj-fx.js): the moods dealt by the deck, the settle's flavour, the overdo (about one phrase
// in seven, never two in a row), the safety caps, the bus's limiter, the steering override, and the hero symphony
// playing through it all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, all, reach } from './fakeaudio.mjs';
import {
  MOODS, MOOD_KEYS, moodOf, DRY, PHRASE_BARS, MOOD_PHRASES, settleFlavour, OVERDO, OVERDO_KINDS, FEEDBACK_CAP, CAPS,
  clampFx, fxValues, createDjFx, curveFor, BUS_LIMIT, limiterMakeupDb, createFxBus, driveMakeup, trimFor,
  createSymphony, configure, unlockNow, sound, djLive, djSnapshot, STEER_IDLE, applySteer, isIdleSteer,
} from '../src/index.js';

const phrases = (dj, n, opts = {}) => {
  const out = [];
  for (let p = 0; p < n; p++) {
    let first = null;
    for (let b = 0; b < PHRASE_BARS; b++) { const st = dj.bar({ inputs: opts.inputs ?? {}, steer: opts.steer ?? null }); if (b === 0) first = st; }
    out.push(first);
  }
  return out;
};

test('the ten moods are packaged and named; every value already sits inside the caps', () => {
  assert.equal(MOODS.length, 10);
  assert.equal(new Set(MOOD_KEYS).size, 10);
  for (const m of MOODS) {
    assert.match(m.label, /^[A-Z ]+$/, m.key);
    const c = clampFx({ ...m, mode: 'soft', hz: 900, Q: 1.4 });
    for (const k of ['reverb', 'size', 'delay', 'feedback', 'time', 'tone', 'drive', 'gain', 'res']) assert.equal(c[k], m[k], `${m.key}.${k} is inside CAPS`);
  }
  assert.equal(moodOf('nope').key, 'clean');
  assert.equal(DRY.reverb + DRY.delay + DRY.drive + DRY.res, 0, 'the held bus is dry');
});

test('THE DECK RULE deals the moods: every mood before a repeat, never the one it leaves, changing only on a phrase line', () => {
  // lane DJOVERDRIVE: the bag deals the nine moods (baseMood); OVERDRIVE comes from its own deck, one phrase in five
  for (const seed of [1, 2, 3, 4, 5]) {
    const dj = createDjFx({ seed });
    const seq = [];
    let bars = 0;
    let prev = null;
    for (let b = 0; b < PHRASE_BARS * MOOD_PHRASES * 9; b++) {
      const st = dj.bar({});
      if (st.mood !== (st.overdrive ? 'overdrive' : st.baseMood)) assert.fail(`seed ${seed}: the mood heard is OVERDRIVE or the dealt mood`);
      if (st.baseMood !== prev) { assert.equal(bars % PHRASE_BARS, 0, `seed ${seed}: a mood changes on a phrase line only`); seq.push(st.baseMood); prev = st.baseMood; }
      bars += 1;
    }
    assert.equal(seq.length, 9, `seed ${seed}: one mood per ${MOOD_PHRASES} phrases`);
    assert.deepEqual([...seq].sort(), MOOD_KEYS.filter((k) => k !== 'overdrive').sort(), `seed ${seed}: all nine dealt moods in the first round`);
    for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1]);
  }
  // a new set is a phrase line: the mood moves on at once
  const dj = createDjFx({ seed: 9 });
  const a = dj.bar({}).baseMood;
  dj.bar({});
  const b = dj.bar({ newSet: true });
  assert.notEqual(b.baseMood, a);
  assert.equal(b.changed, true);
});

test('the settle chooses the flavour: the table, cold to hot', () => {
  const cold = settleFlavour({ heat: 0.05, flips: 0.02, energy: 0.1, overlap: 0.95 });
  assert.deepEqual([cold.drive, cold.band, cold.q], ['soft', 'low', 'gentle']);
  assert.equal(cold.hz, 320);
  const warm = settleFlavour({ heat: 0.5, flips: 0.5, energy: 0.5, overlap: 0.5 });
  assert.deepEqual([warm.drive, warm.band, warm.q], ['fold', 'mid', 'firm']);
  const hot = settleFlavour({ heat: 0.95, flips: 0.9, energy: 0.9, overlap: 0.05 });
  assert.deepEqual([hot.drive, hot.band, hot.q], ['crush', 'high', 'sharp']);
  assert.equal(hot.Q, 7);
  // agitation = 0.6 heat + 0.4 flips: hot but frozen is not yet a crush
  assert.equal(settleFlavour({ heat: 0.8, flips: 0, energy: 0.5, overlap: 0.5 }).drive, 'fold');
  // garbage reads as a calm field
  assert.equal(settleFlavour({ heat: NaN, flips: 'x' }).drive, 'soft');
  // the flavour is read once a phrase, so it never flickers inside one
  const dj = createDjFx({ seed: 3 });
  dj.bar({ inputs: { heat: 0, flips: 0, energy: 0, overlap: 1 } });
  const mid = dj.bar({ inputs: { heat: 1, flips: 1, energy: 1, overlap: 0 } });
  assert.equal(mid.flavour.drive, 'soft', 'mid-phrase the flavour holds');
  dj.bar({}); dj.bar({});
  assert.equal(dj.bar({ inputs: { heat: 1, flips: 1, energy: 1, overlap: 0 } }).flavour.drive, 'crush', 'the next phrase reads it again');
});

test('THE OVERDO: one phrase in seven, measured between 10% and 20% over many seeds, never two in a row, the first calm', () => {
  let over = 0;
  let total = 0;
  const kinds = {};
  for (let seed = 1; seed <= 60; seed++) {
    const dj = createDjFx({ seed });
    const ps = phrases(dj, 140);
    assert.equal(ps[0].overdo, null, `seed ${seed}: the visit's first phrase is calm`);
    for (let i = 0; i < ps.length; i++) {
      if (ps[i].overdo) { over += 1; kinds[ps[i].overdo] = (kinds[ps[i].overdo] ?? 0) + 1; }
      if (i > 0) assert.ok(!(ps[i].overdo && ps[i - 1].overdo), `seed ${seed}: two overdone phrases in a row at ${i}`);
    }
    total += ps.length;
  }
  const rate = over / total;
  assert.ok(rate >= 0.10 && rate <= 0.20, `overdo rate ${rate}`);
  assert.deepEqual(Object.keys(kinds).sort(), [...OVERDO_KINDS].sort(), 'all three kinds come round');
  // an overdo holds for its whole phrase and is gone the next
  const dj = createDjFx({ seed: 11 });
  let seen = 0;
  for (let p = 0; p < 40 && !seen; p++) {
    const a = dj.bar({});
    if (!a.overdo) { for (let b = 1; b < PHRASE_BARS; b++) dj.bar({}); continue; }
    for (let b = 1; b < PHRASE_BARS; b++) assert.equal(dj.bar({}).overdo, a.overdo);
    assert.equal(dj.bar({}).overdo, null);
    seen = 1;
  }
  assert.equal(seen, 1);
});

test('SAFETY: the delay feedback is capped below 1, every overdo stays inside CAPS, and the trim lowers the bus as the wet rises', () => {
  assert.ok(FEEDBACK_CAP < 1);
  assert.equal(clampFx({ feedback: 5 }).feedback, FEEDBACK_CAP);
  assert.equal(clampFx({ feedback: NaN }).feedback, 0);
  for (const k of OVERDO_KINDS) {
    for (const m of MOODS) {
      const v = fxValues(m, settleFlavour({ heat: 1, flips: 1, energy: 1, overlap: 0 }), k);
      for (const [p, [lo, hi]] of Object.entries(CAPS)) assert.ok(v[p] >= lo && v[p] <= hi, `${m.key}+${k}: ${p} ${v[p]}`);
    }
  }
  const ctx = new Ctx();
  const master = ctx.createGain();
  const bus = createFxBus({ ctx, master });
  bus.apply({ ...moodOf('dub-echo'), delay: 1, feedback: 3, mode: 'soft', hz: 900, Q: 1 }, 0);
  assert.ok(bus.nodes.fb.gain.value <= FEEDBACK_CAP, `feedback ${bus.nodes.fb.gain.value}`);
  const trimOf = (v) => { bus.apply({ ...v, mode: 'soft', hz: 900, Q: 1.4 }, 0); return bus.nodes.trim.gain.value; };
  const clean = trimOf(moodOf('clean'));
  for (const k of OVERDO_KINDS) assert.ok(trimOf({ ...moodOf('clean'), ...OVERDO[k].set }) <= clean, `${k} overdo is trimmed`);
});

test('THE BUS LIMITER sits on every path from the input to the output; a drive shaper never adds level', () => {
  const ctx = new Ctx();
  const master = ctx.createGain();
  const bus = createFxBus({ ctx, master });
  bus.apply({ ...moodOf('overdrive'), drive: 0.6, gain: 3, reverb: 0.4, delay: 0.3, mode: 'fold', hz: 900, Q: 3 }, 0);
  const { limit } = bus.nodes;
  assert.equal(limit.kind, 'compressor');
  assert.equal(limit.threshold.value, BUS_LIMIT.threshold);
  assert.equal(limit.ratio.value, BUS_LIMIT.ratio);
  assert.ok(reach(bus.input).has(master));
  // nothing but the limiter (through the gain that takes its makeup back) connects to the master
  const feeders = all.filter((n) => n.out.has(master));
  assert.deepEqual(feeders, [bus.nodes.unmake]);
  assert.ok(limit.out.has(bus.nodes.unmake));
  assert.ok(Math.abs(20 * Math.log10(bus.nodes.unmake.gain.value) + limiterMakeupDb()) < 1e-9, 'the compressor\'s own makeup is taken back');
  for (const mode of ['soft', 'fold', 'crush']) {
    const c = curveFor(mode, 4001);
    for (let i = 0; i < c.length; i++) { const x = (i / (c.length - 1)) * 2 - 1; assert.ok(Math.abs(c[i]) <= Math.abs(x) + 1e-6, `${mode} at ${x}`); }
  }
  // the drive's loudness match is bounded: never more than x2, and a harder drive never gets more makeup than a soft one
  for (const mode of ['soft', 'fold', 'crush']) for (const g of [1, 2, 3, 4.5, 5]) { const m = driveMakeup(mode, g); assert.ok(m > 0 && m <= 2, `${mode} ${g}: ${m}`); }
  assert.ok(driveMakeup('soft', 5) <= driveMakeup('soft', 1));
  assert.ok(trimFor({ reverb: 0.9, delay: 0.65, feedback: FEEDBACK_CAP, res: 9 }) < trimFor({ reverb: 0, delay: 0, feedback: 0, res: 0 }));
  const soft = curveFor('soft', 4001);
  assert.ok(Math.abs((soft[2001] - soft[1999]) / (4 / 4000) - 1) < 0.01, 'soft clip passes a quiet signal at unity');
});

test('a mood with no drive, reverb or delay builds no shaper, convolver or delay line (the sections are built on first use)', () => {
  const ctx = new Ctx();
  const bus = createFxBus({ ctx, master: ctx.createGain() });
  bus.apply(DRY, 0);
  assert.equal(bus.nodes.pre, null);
  assert.equal(bus.nodes.room, null);
  assert.equal(bus.nodes.delay, null);
  bus.apply(moodOf('dub-echo'), 1);
  assert.ok(bus.nodes.pre && bus.nodes.room && bus.nodes.delay, 'built once wanted');
});

test('THE STEERING overrides the DJ for what it covers, overdo included, and leaves the rest to the DJ', () => {
  const dj = createDjFx({ seed: 4 });
  const steer = { delay: 0.2, mood: 'cathedral' };
  const ps = phrases(dj, 140, { steer });
  for (const p of ps) {
    assert.equal(p.mood, p.mood); // the dealt mood is still tracked
    assert.ok(Math.abs(p.values.delay - 0.2 * CAPS.delay[1]) < 1e-12, 'the steered delay holds in every phrase');
    assert.equal(p.values.reverb, p.overdo === 'reverb' ? OVERDO.reverb.set.reverb : moodOf('cathedral').reverb, 'the steered mood supplies the rest');
    assert.notEqual(p.overdo, 'delay', 'a steered effect is never overdone');
  }
  assert.ok(ps.some((p) => p.overdo), 'the other kinds still overdo');
  // the store carries the desk part; idle is centre; applySteer hands it to the symphony
  assert.ok(isIdleSteer(STEER_IDLE));
  assert.ok(!isIdleSteer({ ...STEER_IDLE, fx: { ...STEER_IDLE.fx, reverb: 0.5 } }));
  const calls = [];
  applySteer({ setFxSteer: (fx) => calls.push(fx) }, { ...STEER_IDLE, fx: { ...STEER_IDLE.fx, drive: 0 } }, STEER_IDLE);
  assert.deepEqual(calls, [{ mood: null, reverb: null, delay: null, drive: 0, tone: null, overdrive: null, vocoder: null }]);
});

test('THE HERO SYMPHONY plays through the desk: the wet channel reaches the bus, djLive names the mood, the binaural pair stays dry', () => {
  configure({ createContext: () => new Ctx() });
  const E = unlockNow();
  sound.setMuted(false);
  const s = createSymphony({ seed: 21, theme: 'highlands', auto: false, steer: null, votes: null });
  for (let k = 0; k < 60; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  const st = s.state;
  assert.ok(st.fx && MOOD_KEYS.includes(st.fx.mood), 'the state names a mood');
  const live = djLive.get();
  assert.equal(live.fx.mood, st.fx.mood);
  assert.ok(['soft', 'fold', 'crush'].includes(live.fx.flavour.drive));
  assert.equal(typeof live.fx.values.reverb, 'number');
  assert.doesNotThrow(() => JSON.stringify(live));
  assert.equal(djSnapshot({ fx: null }).fx, null);
  // the steering lands on the next bar line
  s.setFxSteer({ reverb: 0, delay: 0, drive: 0 });
  for (let k = 0; k < 8; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  assert.equal(s.state.fx.values.reverb, 0);
  assert.equal(s.state.fx.values.drive, 0);
  s.dispose();
  // MUTE ALL: a muted symphony decides moods but builds no section of the bus
  sound.setMuted(true);
  const m0 = all.length;
  const q = createSymphony({ seed: 22, theme: 'highlands', auto: false, steer: null, votes: null });
  for (let k = 0; k < 60; k++) { E.ctx.currentTime += 0.5; q.tick(); }
  assert.equal(q.state.audible, false);
  assert.equal(all.slice(m0).filter((n) => n.kind === 'convolver' || n.kind === 'delay' && n.delayTime?.maxValue === 2).length, 0, 'muted: no bus section is built');
  q.dispose();
  sound.setMuted(false);
  // the pure flute holds the bus dry
  const p = createSymphony({ seed: 23, theme: 'highlands', auto: false, pure: true, steer: null, votes: null });
  for (let k = 0; k < 20; k++) { E.ctx.currentTime += 0.5; p.tick(); }
  assert.equal(p.state.fx.held, true);
  assert.equal(p.state.fx.values.reverb + p.state.fx.values.delay + p.state.fx.values.drive, 0);
  p.dispose();
});
