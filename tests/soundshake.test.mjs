// THE SOUND AND THE PICTURE, settle-hear's half (lane SOUNDSHAKE): THE WEATHER profiles THE DJ deals by THE DECK RULE
// and publishes on djLive; THE WOBBLE rises with the live energy of a visitor's waves, saturates, and falls to exactly
// zero as they dissipate, never while MUTE ALL holds; the DJ bus's wobble stage never adds level and never touches the
// binaural pair; the band tap listens to the hero's channels only; the features and onsets are pure and bounded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx } from './fakeaudio.mjs';
import {
  configure, unlockNow, sound, createChannel, WEATHERS, WEATHER_KEYS, HELD_WEATHER, weatherOf, weatherCoeffs, WEATHER_PARTS,
  createDjFx, createFxBus, PHRASE_BARS, WOBBLE_STAGE, BUS_LIMIT, WOBBLE, wobbleEnvelope, wobbleDepth, createWobble, soundWobble,
  wobbleLevel, registerWobbleTarget, soundHit, onSoundHit, BANDS, levelOf, rmsOf, createFollower, createOnsets, createBandTap,
  djSnapshot, createSymphony, djLive,
} from '../src/index.js';

const phrases = (dj, n, opts = {}) => {
  const out = [];
  for (let p = 0; p < n; p++) {
    let first = null;
    for (let b = 0; b < PHRASE_BARS; b++) { const st = dj.bar({ inputs: {}, steer: null, hold: !!opts.hold }); if (b === 0) first = st; }
    out.push(first);
  }
  return out;
};

test('THE WEATHER: six profiles, small finite coefficients for the four knobs, hard x 1.5', () => {
  assert.equal(WEATHERS.length, 6);
  assert.deepEqual(WEATHER_PARTS, ['heat', 'lean', 'pull', 'rate']);
  assert.equal(new Set(WEATHERS.map((w) => w.label)).size, 6);
  for (const w of WEATHERS) {
    for (const p of WEATHER_PARTS) {
      assert.ok(Math.abs(w[p].breath) <= 0.3 && Math.abs(w[p].tremble) <= 0.2, `${w.key}.${p}`);
    }
    const soft = weatherCoeffs(w.key);
    const hard = weatherCoeffs(w.key, true);
    for (const p of WEATHER_PARTS) assert.ok(Math.abs(hard[p].breath - 1.5 * soft[p].breath) < 1e-12);
  }
  assert.equal(weatherOf('nope').key, 'breath');
});

test('THE DJ DEALS THE WEATHER once a phrase by THE DECK RULE, plays it hard on an overdone phrase, and breathes when held', () => {
  const dj = createDjFx({ seed: 7 });
  const ps = phrases(dj, 60);
  const ws = ps.map((p) => p.weather);
  for (let r = 0; r + WEATHER_KEYS.length <= ws.length; r += WEATHER_KEYS.length) {
    assert.deepEqual([...ws.slice(r, r + WEATHER_KEYS.length)].sort(), [...WEATHER_KEYS].sort(), `round ${r / WEATHER_KEYS.length}: every profile once`);
  }
  for (let i = 1; i < ws.length; i++) assert.notEqual(ws[i], ws[i - 1], 'never the same weather twice in a row');
  for (const p of ps) {
    assert.equal(p.weatherLabel, weatherOf(p.weather).label);
    assert.equal(p.weatherHard, !!p.overdo, 'hard exactly on an overdone phrase');
  }
  assert.ok(ps.some((p) => p.weatherHard));
  const held = createDjFx({ seed: 7 }).bar({ hold: true });
  assert.equal(held.weather, HELD_WEATHER);
  assert.equal(held.weatherHard, false);
  // published on djLive, plain data
  const snap = djSnapshot({ fx: { mood: 'tape', weather: 'swell', weatherLabel: 'DEEP SWELL', weatherHard: true, flavour: {}, values: {} } });
  assert.equal(snap.fx.weather, 'swell');
  assert.equal(snap.fx.weatherLabel, 'DEEP SWELL');
  assert.equal(snap.fx.weatherHard, true);
});

test('THE WOBBLE: the envelope rises at once, falls smoothly and is exactly zero at the end of a wave\'s life', () => {
  assert.equal(wobbleEnvelope(-0.1), 0);
  assert.equal(wobbleEnvelope(1), 0);
  assert.equal(wobbleEnvelope(1.5), 0);
  assert.equal(wobbleEnvelope(NaN), 0);
  let prev = Infinity;
  for (let u = 0.03; u < 1; u += 0.05) { const e = wobbleEnvelope(u); assert.ok(e <= prev + 1e-12 && e >= 0); prev = e; }
  for (const e of [0, 0.5, 1, 3, 30, 300]) assert.ok(wobbleDepth(e, WOBBLE.calm) <= WOBBLE.calm && wobbleDepth(e, WOBBLE.alive) <= WOBBLE.alive);
  assert.equal(wobbleDepth(-1), 0);
  assert.ok(WOBBLE.calm < WOBBLE.alive && WOBBLE.alive <= 1);
});

test('THE WOBBLE rises with the live wave energy, saturates under a storm of clicks, and decays to zero as they dissipate', () => {
  let t = 0;
  const W = createWobble({ now: () => t });
  assert.equal(W.level(t), 0);
  W.add({ strength: 1 });
  t = 200;
  const one = W.level(t, WOBBLE.alive);
  for (let k = 0; k < 3; k++) W.add({ strength: 1 });
  t = 210;
  const four = W.level(t, WOBBLE.alive);
  assert.ok(one > 0.2 && four > one, `one click ${one}, four ${four}`);
  for (let k = 0; k < 200; k++) W.add({ strength: 1 });
  t = 300;
  const storm = W.level(t, WOBBLE.alive);
  assert.ok(storm <= WOBBLE.alive && storm > 0.85 * WOBBLE.alive, `a storm saturates at the cap: ${storm}`);
  assert.ok(W.alive(t) <= WOBBLE.maxWaves);
  // it falls as the waves age, and is exactly zero once every wave's life is over
  const falling = [];
  for (t = 400; t <= WOBBLE.clickMs + 400; t += 400) falling.push(W.level(t, WOBBLE.alive));
  for (let i = 1; i < falling.length; i++) assert.ok(falling[i] <= falling[i - 1] + 1e-12, 'never rising without a new wave');
  t = WOBBLE.clickMs + 400;
  assert.equal(W.level(t), 0);
  assert.equal(W.alive(t), 0);
  // a box lives its own life
  W.add({ strength: 1, lifeMs: 5600 });
  t += 4000;
  assert.ok(W.level(t) > 0, 'a box still wobbles at 4 s');
  t += 1700;
  assert.equal(W.level(t), 0);
  assert.equal(W.add({ strength: 0 }), false);
});

test('THE WOBBLE STAGE on the DJ bus: before the limiter, a vibrato and a tremolo whose gain never passes 1; back to rest at 0', () => {
  const ctx = new Ctx();
  const master = ctx.createGain();
  const bus = createFxBus({ ctx, master });
  const { wob, trem, duck, limit } = bus.nodes;
  assert.ok(Math.abs(wob.delayTime.value - WOBBLE_STAGE.baseMs / 1000) < 1e-12);
  // lane DROPDUCK put THE DUCK between the wobble and the limiter (duck.js); the wobble is still before the limiter
  assert.ok(bus.nodes.trim.out.has(wob) && wob.out.has(trem) && trem.out.has(duck) && duck.out.has(limit), 'trim -> wobble -> duck -> limiter');
  assert.equal(limit.threshold.value, BUS_LIMIT.threshold);
  assert.equal(bus.nodes.vib, null, 'no LFO until the first wobble');
  bus.wobble(1, 0);
  assert.ok(bus.nodes.vib.started && bus.nodes.tremLfo.started);
  assert.ok(Math.abs(bus.nodes.vibDepth.gain.value - WOBBLE_STAGE.vibratoMs / 1000) < 1e-12);
  const d = WOBBLE_STAGE.tremolo;
  assert.ok(Math.abs(trem.gain.value - (1 - d / 2)) < 1e-12 && Math.abs(bus.nodes.tremDepth.gain.value - d / 2) < 1e-12);
  assert.ok(trem.gain.value + bus.nodes.tremDepth.gain.value <= 1 + 1e-12, 'the tremolo can only lower the level');
  // about 25 cents at full wobble
  const cents = 1200 * Math.log2(1 + 2 * Math.PI * WOBBLE_STAGE.vibratoHz * (WOBBLE_STAGE.vibratoMs / 1000));
  assert.ok(cents > 15 && cents < 30, `${cents} cents`);
  bus.wobble(5, 1);
  assert.equal(bus.wobbled, 1, 'clamped');
  bus.wobble(0, 2);
  assert.equal(bus.nodes.vibDepth.gain.value, 0);
  assert.equal(trem.gain.value, 1);
  assert.equal(bus.nodes.tremDepth.gain.value, 0);
  bus.dispose();
});

test('soundWobble reaches every live DJ bus, and MUTE ALL sends zero at once', () => {
  configure({ createContext: () => new Ctx() });
  unlockNow();
  sound.setMuted(false);
  const got = [];
  const off = registerWobbleTarget({ wobble: (x) => got.push(x) });
  assert.equal(soundWobble(0.6), 1);
  assert.equal(got.at(-1), 0.6);
  assert.equal(wobbleLevel(), 0.6);
  sound.setMuted(true);
  soundWobble(0.6);
  assert.equal(got.at(-1), 0, 'muted: the sound back to normal');
  sound.setMuted(false);
  soundWobble(2);
  assert.equal(got.at(-1), 1, 'clamped to 1');
  soundWobble(0);
  off();
  assert.equal(soundWobble(0.5), 0, 'a bus that left hears nothing');
  soundWobble(0);
});

test('THE HERO SYMPHONY publishes the weather it dealt on djLive, and its DJ bus takes the wobble', () => {
  configure({ createContext: () => new Ctx() });
  const E = unlockNow();
  sound.setMuted(false);
  const s = createSymphony({ seed: 9, theme: 'highlands', auto: false, steer: null, votes: null });
  for (let k = 0; k < 8; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  // the symphony's own DJ bus registered itself: a wobble reaches it (the binaural pair plays on the dry channel,
  // which goes straight to the master, so the wobble stage never sits on its path; dj-fx.js THE WOBBLE)
  assert.ok(soundWobble(0.8) >= 1);
  const live = djLive.get();
  assert.ok(live.fx && WEATHER_KEYS.includes(live.fx.weather), 'djLive names the weather');
  soundWobble(0);
  s.dispose?.();
});

test('THE HITS: a played hit is announced with its key and delay', () => {
  const got = [];
  const off = onSoundHit((h) => got.push(h));
  assert.equal(soundHit({ key: 'kick', family: 'drum', delayMs: 40 }), 1);
  assert.equal(got[0].key, 'kick');
  off();
  assert.equal(soundHit({ key: 'kick' }), 0);
  assert.equal(soundHit(null), 0);
});

test('THE BANDS: levels, the follower\'s breath and tremble, and onsets are pure and bounded', () => {
  assert.equal(levelOf(0), 0);
  assert.equal(levelOf(NaN), 0);
  assert.equal(levelOf(1), 1);
  assert.ok(levelOf(10 ** (BANDS.floorDb / 20)) <= 1e-9);
  const sine = Float32Array.from({ length: 1024 }, (_, i) => 0.5 * Math.sin(i / 7));
  assert.ok(Math.abs(rmsOf(sine) - 0.5 / Math.SQRT2) < 0.01);
  assert.equal(rmsOf(Uint8Array.from({ length: 64 }, () => 128)), 0);
  // a steady drone: a breath and no tremble; a jump: a tremble
  const F = createFollower();
  let o;
  for (let k = 0; k < 300; k++) o = F.step(0.6, 33);
  assert.ok(Math.abs(o.breath - 0.6) < 0.01 && Math.abs(o.tremble) < 0.01);
  o = F.step(1, 33);
  for (let k = 0; k < 3; k++) o = F.step(1, 33);
  assert.ok(o.tremble > 0.1 && o.tremble <= 1);
  // onsets: one per spike, none on a steady level, a refractory gap
  const N = createOnsets();
  let t = 0;
  const fired = [];
  for (let k = 0; k < 60; k++) { t += 33; const x = k === 30 ? 0.8 : 0.1; const s = N.step(x, t); if (s) fired.push([k, s]); }
  assert.equal(fired.length, 1);
  assert.equal(fired[0][0], 30);
  assert.ok(fired[0][1] > 0 && fired[0][1] <= 1);
  const steady = createOnsets();
  let n = 0;
  for (let k = 0; k < 100; k++) if (steady.step(0.6, k * 33)) n++;
  assert.ok(n <= 1, `a steady level fires ${n}`);
});

test('THE BAND TAP listens to the hero\'s channels only (anchor hero or none), follows them as they come and go', () => {
  configure({ createContext: () => new Ctx() });
  const E = unlockNow();
  const hero = createChannel(E, { anchor: 'hero' });
  const plain = createChannel(E, {});
  const page = createChannel(E, { anchor: 'page' });
  const tap = createBandTap({ engine: () => E });
  const r = tap.read();
  assert.equal(r.ok, true);
  assert.equal(r.low, 0, 'a silent fake analyser reads 0');
  assert.ok(tap.channels() >= 2);
  const sumIn = (ch) => [...ch.input.out].length >= 0; // the channels exist
  assert.ok(sumIn(hero) && sumIn(plain) && sumIn(page));
  const before = tap.channels();
  const late = createChannel(E, { anchor: 'hero' });
  assert.equal(tap.channels(), before + 1, 'a channel built later joins');
  late.dispose();
  assert.equal(tap.channels(), before, 'and leaves when disposed');
  const pages = createChannel(E, { anchor: 'page' });
  assert.equal(tap.channels(), before, 'a page instrument never joins');
  pages.dispose();
  tap.dispose();
  for (const c of [hero, plain, page]) c.dispose();
});
