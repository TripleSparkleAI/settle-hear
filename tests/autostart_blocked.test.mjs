// THE START RULE, blocked (lane AUTOSTART): a browser that refuses sound on load leaves the switch `blocked` and the
// gesture listener armed; the FIRST real gesture starts the sound at once and exactly once. Events browsers do not
// accept as a gesture (scroll, wheel, mousemove) start nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GatedCtx, browser, installWindow, gesture, tick } from './gatedaudio.mjs';

installWindow();
browser.allowed = false;
const engine = await import('../src/engine.js');
engine.configure({ createContext: () => new GatedCtx(), sleepMs: 30 });
const { sound } = await import('../src/control.js');
const blockedSeen = [];
sound.subscribe((s) => blockedSeen.push(s.blocked));

test('a refused start: the context waits suspended, the switch turns blocked, the gesture listener is armed', async () => {
  engine.armUnlock();
  assert.ok(engine.getEngine(), 'the page did not even ask the browser on load');
  assert.notEqual(engine.getEngine().ctx.state, 'running');
  assert.equal(sound.unlocked, false);
  await tick(engine.BLOCK_DECIDE_MS + 50);
  assert.equal(sound.blocked, true);
  assert.equal(engine.gestureWaiting(), true);
});

test('scroll, wheel and mousemove start nothing', () => {
  for (const t of ['scroll', 'wheel', 'mousemove']) gesture(t);
  assert.equal(sound.unlocked, false);
  assert.equal(sound.blocked, true);
});

test('the first pointerdown starts the sound once: running, unlocked, unblocked, the listener gone, one context', async () => {
  const runs = browser.runs;
  gesture('pointerdown');
  await tick();
  assert.equal(engine.getEngine().ctx.state, 'running');
  assert.equal(sound.unlocked, true);
  assert.equal(sound.blocked, false);
  assert.equal(engine.gestureWaiting(), false);
  assert.equal(browser.runs, runs + 1);
  assert.equal(browser.made, 1, 'the gesture built a second context');
  // the same click's later events (pointerup, click) and a second click change nothing
  const resumes = browser.resumes;
  gesture('pointerup');
  gesture('click');
  gesture('pointerdown');
  assert.equal(browser.resumes, resumes, 'the start ran twice');
  assert.equal(browser.runs, runs + 1);
});

test('the blocked state was announced once and cleared once', () => {
  assert.deepEqual(blockedSeen.filter((b, i, a) => i === 0 || b !== a[i - 1]), [true, false]);
});
