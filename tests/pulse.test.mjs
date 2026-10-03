// THE SOUND'S ANSWER TO A RADIAL PULSE (pulse.js, lane RADIALPULSE): the shape stays inside the limits for every
// gradient and direction, every mixer channel carries the three nodes and registers itself, a dry channel takes the
// swell alone, the answer is one rise and one fall per parameter, MUTE ALL writes nothing, and dispose leaves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, all } from './fakeaudio.mjs';
import { configure, unlockNow, getEngine, sound, createChannel, SOUND_PULSE, soundPulseShape, pulseNodes, registerPulseTarget, pulseTargets, applyPulse, soundPulse } from '../src/index.js';

const wave = (a, dx = 1, passMs = 600) => ({ a, dir: { x: dx, y: 0 }, passMs, reduced: false });

test('soundPulseShape: the swell, the shelf and the pan rise with the gradient and never leave the limits', () => {
  for (const a of [-1, 0, 0.1, 0.5, 1, 2, NaN]) for (const dx of [-1, -0.3, 0, 0.7, 1]) for (const ms of [10, 300, 5000, NaN]) {
    const s = soundPulseShape(wave(a, dx, ms));
    assert.ok(s.gain >= 1 && s.gain <= Math.pow(10, SOUND_PULSE.swellDb / 20) + 1e-12, `gain ${s.gain}`);
    assert.ok(s.shelf >= 0 && s.shelf <= SOUND_PULSE.shelfDb + 1e-12, `shelf ${s.shelf}`);
    assert.ok(Math.abs(s.pan) <= SOUND_PULSE.pan + 1e-12, `pan ${s.pan}`);
    assert.ok(s.ms >= SOUND_PULSE.minMs && s.ms <= SOUND_PULSE.maxMs, `ms ${s.ms}`);
  }
  const full = soundPulseShape(wave(1, 1));
  const half = soundPulseShape(wave(0.5, 1));
  const none = soundPulseShape(wave(0, 1));
  assert.ok(full.gain > half.gain && half.gain > none.gain && none.gain === 1, 'the swell follows the gradient');
  assert.ok(full.shelf > half.shelf && none.shelf === 0);
  assert.ok(full.pan > half.pan && none.pan === 0);
  assert.ok(soundPulseShape(wave(1, -1)).pan < 0, 'a wave travelling left pans left');
  assert.equal(soundPulseShape(wave(1, 0)).pan, 0, 'a wave passing straight up or down pans nowhere');
  assert.equal(soundPulseShape(wave(1, 1, 600)).ms, 600, 'the answer lasts the crossing');
  assert.equal(soundPulseShape({ a: 1, dir: { x: 1 }, reduced: true, ms: 450 }).ms, 450, 'reduced motion: the still answer\'s length');
  assert.ok(Math.abs(20 * Math.log10(full.gain) - SOUND_PULSE.swellDb) < 1e-9, 'the full swell is exactly the written dB');
});

test('every mixer channel carries the swell, the shelf and the pan after its fader and registers itself with its anchor', () => {
  configure({ createContext: () => new Ctx() });
  const E = unlockNow();
  sound.setMuted(false);
  const before = pulseTargets('hero').length;
  const start = all.length;
  const ch = createChannel(E, { level: 0.5, anchor: 'hero' });
  const made = all.slice(start);
  const shelf = made.find((n) => n.kind === 'biquad' && n.type === 'highshelf');
  const pan = made.find((n) => n.kind === 'panner');
  assert.ok(shelf, 'a high shelf');
  assert.equal(shelf.frequency.value, SOUND_PULSE.shelfHz);
  assert.equal(shelf.gain.value, 0, 'at rest the shelf is flat');
  assert.ok(pan && pan.pan.value === 0, 'a panner at centre');
  assert.ok([...pan.out].includes(E.master), 'the panner feeds the master');
  assert.equal(ch.anchor, 'hero');
  assert.equal(pulseTargets('hero').length, before + 1);
  ch.dispose();
  assert.equal(pulseTargets('hero').length, before, 'dispose leaves the answer');
});

test('pulseNodes on a context with no stereo panner gives the swell and the shelf alone', () => {
  const ctx = new Ctx();
  ctx.createStereoPanner = undefined;
  const P = pulseNodes(ctx);
  assert.equal(P.pan, null);
  assert.equal(P.gain.gain.value, 1);
  assert.equal(P.shelf.type, 'highshelf');
});

test('the answer is one rise and one fall per parameter, at the wave\'s gradient, and the targets fall back to rest', () => {
  const ctx = new Ctx();
  ctx.currentTime = 10;
  const P = pulseNodes(ctx);
  const t = { anchor: null, ctx, gain: P.gain.gain, shelf: P.shelf.gain, pan: P.pan.pan };
  const shape = soundPulseShape(wave(0.8, 1, 500));
  assert.equal(applyPulse(t, shape), true);
  for (const [param, peak, rest] of [[P.gain.gain, shape.gain, 1], [P.shelf.gain, shape.shelf, 0], [P.pan.pan, shape.pan, 0]]) {
    const ev = param.events;
    assert.equal(ev.length, 2, 'one rise, one fall');
    assert.equal(ev[0][0], 'target');
    assert.ok(Math.abs(ev[0][1] - peak) < 1e-12);
    assert.equal(ev[0][2], 10, 'the rise starts now');
    assert.equal(ev[0][3], SOUND_PULSE.attack);
    assert.equal(ev[1][0], 'target');
    assert.equal(ev[1][1], rest, 'and it comes back to rest');
    assert.ok(Math.abs(ev[1][2] - (10 + 0.25)) < 1e-9, 'the fall starts half way through the crossing');
  }
  // a target with the swell alone (a dry channel) takes the swell alone
  const g = ctx.createGain();
  assert.equal(applyPulse({ anchor: null, ctx, gain: g.gain }, shape), true);
  assert.equal(g.gain.events.length, 2);
  assert.equal(applyPulse(null, shape), false);
});

test('soundPulse answers the targets whose anchor is named, in one call, and writes nothing while MUTE ALL is on', () => {
  configure({ createContext: () => new Ctx() });
  const E = unlockNow();
  sound.setMuted(false);
  const hero = createChannel(E, { level: 0.5, anchor: 'hero' });
  const page = createChannel(E, { level: 0.5, anchor: 'page' });
  const plain = createChannel(E, { level: 0.5 });
  const gainOf = (ch) => [...[...[...ch.input.out][0].out][0].out][0]; // input -> lp -> fader -> the swell gain
  const events = (ch) => gainOf(ch).gain.events.length;
  const h0 = events(hero);
  const p0 = events(page);
  const n0 = events(plain);
  assert.equal(soundPulse(wave(1, 1, 400), { anchors: ['hero', null] }), 2 + pulseTargets(null).length - 1, 'the hero and the unanchored answered');
  assert.ok(events(hero) > h0, 'the hero channel answered');
  assert.ok(events(plain) > n0, 'the unanchored channel answered');
  assert.equal(events(page), p0, 'the page channel waited for its own anchor');
  assert.ok(soundPulse(wave(1, 1, 400), { anchors: ['page'] }) >= 1);
  assert.ok(events(page) > p0);
  assert.equal(soundPulse(wave(0, 1, 400), { anchors: ['hero'] }), 0, 'a wave with no gradient left writes nothing');
  sound.setMuted(true);
  const h1 = events(hero);
  assert.equal(soundPulse(wave(1, 1, 400), { anchors: ['hero'] }), 0, 'MUTE ALL: nothing');
  assert.equal(events(hero), h1);
  sound.setMuted(false);
  for (const ch of [hero, page, plain]) ch.dispose();
});

test('registerPulseTarget refuses nothing it cannot use and off() is idempotent', () => {
  const n = pulseTargets('x').length;
  const off = registerPulseTarget({ anchor: 'x', ctx: new Ctx(), gain: null });
  assert.equal(pulseTargets('x').length, n + 1);
  off();
  off();
  assert.equal(pulseTargets('x').length, n);
  assert.equal(typeof registerPulseTarget(null), 'function');
});
