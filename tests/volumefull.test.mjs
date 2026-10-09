// THE FULL VOLUME (lane VOLUMEFULL, navigator 2026-10-09: "the volume default is 0.80? Can we make it 1.0 default for
// volume"): the fresh master level is 1.0, so a fresh context's master gain is 1.0 (it was 0.8, gain 0.64). Only the
// default moved: a level set before the build still wins, the level still goes down, and MUTE ALL still wins. Red on
// the code before the lane (MASTER_DEFAULT did not exist, the fresh level was 0.8): SETTLE/runs/volumefull/redproof.txt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx } from './fakeaudio.mjs';

globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), { hidden: false });

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} against ${b}`);
const fresh = async (tag) => {
  const e = await import(`../src/engine.js?volumefull=${tag}`);
  e.configure({ createContext: () => new Ctx(), sleepMs: 30 });
  return e;
};

test('the fresh master level is 1.0, exported as MASTER_DEFAULT, and the package index exports it too', async () => {
  const e = await fresh('a');
  assert.equal(e.MASTER_DEFAULT, 1, 'MASTER_DEFAULT is 1');
  const index = await import('../src/index.js');
  assert.equal(index.MASTER_DEFAULT, 1, 'the package index exports MASTER_DEFAULT');
  assert.equal(e.getMaster(), 1, 'a fresh engine answers level 1');
});

test('a fresh context is built at master gain 1.0, 3.88 dB above the old fresh 0.64', async () => {
  const e = await fresh('b');
  const { sound } = await import('../src/control.js');
  sound.setMuted(false);
  const E = e.unlockNow();
  near(E.master.gain.value, 1, 'the master gain at the fresh level');
  assert.ok(Math.abs(20 * Math.log10(E.master.gain.value / e.levelGain(0.8)) - 3.876) < 1e-3, 'the rise over the old default is 3.88 dB');
});

test('a level set before the build still wins over the fresh 1.0, and a level below 1 still plays below it', async () => {
  const e = await fresh('c');
  e.setMaster(0.35);
  const { sound } = await import('../src/control.js');
  sound.setMuted(false);
  const E = e.unlockNow();
  near(E.master.gain.value, e.levelGain(0.35), 'the remembered 0.35 starts at its square');
  e.setMaster(0.5);
  near(E.master.gain.value, 0.25, 'the level still goes down');
});

test('MUTE ALL still wins at the fresh full level: the mute gain closes and the level is kept', async () => {
  const e = await fresh('d');
  const { sound } = await import('../src/control.js');
  sound.setMuted(false);
  const E = e.unlockNow();
  sound.setMuted(true);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(E.mute.gain.value, 0, 'MUTE ALL closes the mute gain');
  near(E.master.gain.value, 1, 'the full level is kept under MUTE ALL');
  assert.equal(e.getMaster(), 1);
  sound.setMuted(false);
});
