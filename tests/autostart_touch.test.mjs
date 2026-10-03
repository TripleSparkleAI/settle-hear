// THE START RULE on a touch screen (lane AUTOSTART, the lost-first-tap bug): Chrome does not count a touch's
// pointerdown as a user activation, only its pointerup or touchend. The old listener removed itself on the
// pointerdown, so the resume failed and the first tap was lost. Now the listener stays until the context runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GatedCtx, browser, installWindow, gesture, tick } from './gatedaudio.mjs';

installWindow();
browser.allowed = false;
const engine = await import('../src/engine.js');
engine.configure({ createContext: () => new GatedCtx(), sleepMs: 30 });
const { sound } = await import('../src/control.js');

test('a touch pointerdown without activation keeps the listener; the same tap\'s touchend starts the sound', async () => {
  engine.armUnlock();
  await tick(engine.BLOCK_DECIDE_MS + 50);
  assert.equal(sound.blocked, true);
  gesture('pointerdown', { activates: false });
  await tick();
  assert.equal(sound.unlocked, false, 'a non-activating pointerdown cannot start the sound');
  assert.equal(engine.gestureWaiting(), true, 'the listener left on the pointerdown: the tap is lost');
  gesture('touchend');
  await tick();
  assert.equal(engine.getEngine().ctx.state, 'running');
  assert.equal(sound.unlocked, true);
  assert.equal(engine.gestureWaiting(), false);
});
