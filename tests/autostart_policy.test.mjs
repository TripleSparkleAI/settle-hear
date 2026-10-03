// THE START RULE where the browser publishes its autoplay policy (navigator.getAutoplayPolicy, Firefox): a
// 'disallowed' answer is read before anything is built, so no refused context prints a console warning; the first
// gesture then builds and starts it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GatedCtx, browser, installWindow, gesture, tick } from './gatedaudio.mjs';

installWindow();
browser.allowed = false;
Object.defineProperty(globalThis, 'navigator', { value: { getAutoplayPolicy: (kind) => (kind === 'audiocontext' ? 'disallowed' : 'allowed') }, configurable: true, writable: true });
const engine = await import('../src/engine.js');
engine.configure({ createContext: () => new GatedCtx(), sleepMs: 30 });
const { sound } = await import('../src/control.js');

test('policy disallowed: blocked at once, no context built', () => {
  engine.armUnlock();
  assert.equal(browser.made, 0);
  assert.equal(sound.blocked, true);
  assert.equal(engine.gestureWaiting(), true);
});

test('Tab, Shift and Escape only move the focus: they start nothing', async () => {
  for (const key of ['Tab', 'Shift', 'Escape']) gesture('keydown', { key });
  await tick();
  assert.equal(browser.made, 0);
  assert.equal(sound.blocked, true);
});

test('policy disallowed: the first key press builds and starts the sound', async () => {
  gesture('keydown', { key: 'Enter' });
  await tick();
  assert.equal(browser.made, 1);
  assert.equal(engine.getEngine().ctx.state, 'running');
  assert.equal(sound.unlocked, true);
  assert.equal(sound.blocked, false);
});
