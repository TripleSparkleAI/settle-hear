// THE START RULE, allowed (lane AUTOSTART): a browser that allows sound (a site permission, media engagement) plays
// it at page load with no click, and no gesture listener is left waiting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GatedCtx, browser, installWindow, gesture, tick } from './gatedaudio.mjs';

installWindow();
browser.allowed = true;
const engine = await import('../src/engine.js');
engine.configure({ createContext: () => new GatedCtx(), sleepMs: 30 });
const { sound } = await import('../src/control.js');

test('an allowed start plays at load: the context runs, the switch unlocks, nothing is blocked', async () => {
  assert.equal(engine.getEngine(), null);
  engine.armUnlock();
  assert.ok(engine.getEngine(), 'the engine waited for a click although the browser allowed sound');
  assert.equal(engine.getEngine().ctx.state, 'running');
  assert.equal(sound.unlocked, true);
  assert.equal(sound.blocked, false);
  await tick(engine.BLOCK_DECIDE_MS + 50);
  assert.equal(sound.blocked, false, 'an allowed start was later called blocked');
  assert.equal(browser.made, 1);
});

test('an allowed start arms no gesture listener, and a later click builds nothing new', () => {
  assert.equal(engine.gestureWaiting(), false);
  const before = browser.resumes;
  gesture('pointerdown');
  assert.equal(browser.made, 1);
  assert.equal(browser.resumes, before, 'a click after an allowed start asked the browser again');
});
