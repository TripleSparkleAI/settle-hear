// THE START RULE and MUTE ALL (lane AUTOSTART): a saved mute wins over both starts. The page builds nothing on load,
// a gesture starts nothing, and nothing is called blocked; the visitor's own unmute (a click) starts the sound.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GatedCtx, browser, installWindow, gesture, tick } from './gatedaudio.mjs';

installWindow({ muted: true });
browser.allowed = true; // even a browser that allows sound must not start a muted visitor's page
const engine = await import('../src/engine.js');
engine.configure({ createContext: () => new GatedCtx(), sleepMs: 30 });
const { sound } = await import('../src/control.js');

test('a saved mute: no context on load, not blocked, the listener waits quietly', async () => {
  assert.equal(sound.muted, true);
  engine.armUnlock();
  await tick(engine.BLOCK_DECIDE_MS + 50);
  assert.equal(engine.getEngine(), null);
  assert.equal(browser.made, 0);
  assert.equal(sound.blocked, false, 'a muted page was shown as waiting for a click');
  assert.equal(engine.gestureWaiting(), true);
});

test('a saved mute: a gesture starts nothing', () => {
  gesture('pointerdown');
  gesture('keydown');
  assert.equal(browser.made, 0);
  assert.equal(sound.unlocked, false);
});

test('the visitor\'s unmute (the MUTE button\'s click) starts the sound with that click', async () => {
  browser.allowed = false;
  browser.active = true;
  sound.setMuted(false);
  browser.active = false;
  await tick();
  assert.equal(browser.made, 1);
  assert.equal(engine.getEngine().ctx.state, 'running');
  assert.equal(sound.unlocked, true);
  assert.equal(engine.gestureWaiting(), false);
});
