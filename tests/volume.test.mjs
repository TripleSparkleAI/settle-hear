// THE VOLUME (lane HEROSOUNDCTL, navigator 2026-10-06): the master level lives in the engine, so a level set before
// the context is built is the level it starts at, every fader that moves it hears the others, and MUTE ALL (the mute
// gain after the master) still wins while the level is kept. Before this lane setMaster did nothing until the context
// existed, and getMaster answered a fixed 0.8. Since lane VOLUMEFULL (2026-10-09) the fresh level is 1.0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx } from './fakeaudio.mjs';

globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), { hidden: false });

const engine = await import('../src/engine.js');
engine.configure({ createContext: () => new Ctx(), sleepMs: 30 });
const { sound } = await import('../src/control.js');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('a level set before the context is built is the level the master starts at', () => {
  assert.equal(engine.getEngine(), null, 'no context yet');
  assert.equal(engine.getMaster(), 1, 'the default level (1.0 since lane VOLUMEFULL; it was 0.8)');
  engine.setMaster(0.35);
  assert.equal(engine.getMaster(), 0.35, 'kept before the build');
  sound.setMuted(false);
  const E = engine.unlockNow();
  assert.ok(E, 'built');
  assert.equal(E.master.gain.value, engine.levelGain(0.35), 'the master starts at the remembered level (squared, lane VOLUMECURVE), not at the default');
});

test('the level is clamped to 0..1 and a junk value reads as 0', () => {
  engine.setMaster(1.7);
  assert.equal(engine.getMaster(), 1);
  engine.setMaster(-3);
  assert.equal(engine.getMaster(), 0);
  engine.setMaster('nonsense');
  assert.equal(engine.getMaster(), 0);
  engine.setMaster(0.6);
  assert.equal(engine.getEngine().master.gain.value, engine.levelGain(0.6), 'a set ramps the built master to the level squared');
});

test('onMaster tells every fader about a change, once per change, and unsubscribes', () => {
  const heard = [];
  const off = engine.onMaster((v) => heard.push(v));
  engine.setMaster(0.5);
  engine.setMaster(0.5); // the same level again: not a change
  engine.setMaster(0.25);
  off();
  engine.setMaster(0.9);
  assert.deepEqual(heard, [0.5, 0.25]);
});

test('MUTE ALL wins: the mute gain closes, the master keeps its level, and the level comes back on unmute', async () => {
  engine.setMaster(0.45);
  const E = engine.getEngine();
  sound.setMuted(true);
  await wait(10);
  assert.equal(E.mute.gain.value, 0, 'MUTE ALL closes the mute gain');
  assert.equal(E.master.gain.value, engine.levelGain(0.45), 'the volume is kept under MUTE ALL');
  engine.setMaster(0.7); // the visitor moves the volume while muted
  assert.equal(E.mute.gain.value, 0, 'moving the volume never opens the mute');
  sound.setMuted(false);
  await wait(10);
  assert.equal(E.master.gain.value, engine.levelGain(0.7), 'the new level is the one heard after the unmute');
});

test('the master feeds the mute gain, so the mute is downstream of the volume', () => {
  const E = engine.getEngine();
  assert.ok(E.master.out.has(E.mute), 'master -> mute');
  assert.ok(E.mute.out.has(E.limit), 'mute -> limiter');
});
