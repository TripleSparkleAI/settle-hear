// THE PAGE CHIMES and THE START RULE (lane PAGECHIMES): a chime never builds or wakes an AudioContext. With no engine
// a page change plays nothing and makes no context; with the browser still waiting for the visitor's first gesture
// it plays nothing and resumes nothing; after the gesture it plays. PAUSE ALL (settle-see's ticker held) silences it.
// Its own process: the engine is a module singleton, and this file must meet it before anything has built one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GatedCtx, browser, installWindow, gesture, tick } from './gatedaudio.mjs';

installWindow();
browser.allowed = false;
const engine = await import('../src/engine.js');
engine.configure({ createContext: () => new GatedCtx(), sleepMs: 30 });
const { sound } = await import('../src/control.js');
const { sfxPage, resetSfx } = await import('../src/sfx.js');
const { pageChimeChange, playPageChime, loadPageChimes, onPageChime, resetPageChimes, chimeRefusal } = await import('../src/pagechime.js');
await loadPageChimes();
const heard = [];
onPageChime((d) => heard.push(d));

test('no engine: page changes play no chime and build no AudioContext', () => {
  resetSfx({ seed: 1 });
  resetPageChimes({ seed: 1 });
  assert.equal(engine.getEngine(), null);
  sfxPage({ key: 'home' });
  sfxPage({ key: 'what' });
  assert.equal(pageChimeChange({ key: 'settle' }), null);
  assert.equal(playPageChime(), null);
  assert.equal(chimeRefusal(), 'no-engine');
  assert.equal(browser.made, 0, 'a chime built a context');
  assert.ok(heard.length >= 2 && heard.every((d) => !d.played && d.reason === 'no-engine'));
});

test('a refused start: the browser waits for a gesture, and a page change neither plays nor resumes the context', async () => {
  engine.armUnlock();
  await tick(engine.BLOCK_DECIDE_MS + 50);
  assert.equal(engine.gestureWaiting(), true);
  const resumes = browser.resumes;
  heard.length = 0;
  assert.equal(pageChimeChange({ key: 'kanerva' }), null);
  assert.equal(playPageChime(), null);
  assert.equal(heard[0].reason, 'before-gesture');
  assert.equal(browser.resumes, resumes, 'a chime asked the browser to resume');
  assert.equal(browser.made, 1);
});

test('after the visitor\'s gesture a page change plays one chime', async () => {
  gesture('pointerdown');
  await tick();
  assert.equal(sound.unlocked, true);
  heard.length = 0;
  pageChimeChange({ key: 'hear' });
  assert.equal(heard.filter((d) => d.played).length, 1);
});

test('PAUSE ALL (the ticker held) silences the chime', () => {
  window.dispatchEvent(new CustomEvent('settle:ticker', { detail: { state: 'held' } }));
  try {
    assert.equal(chimeRefusal(), 'paused');
    assert.equal(playPageChime(), null);
  } finally {
    window.dispatchEvent(new CustomEvent('settle:ticker', { detail: { state: 'running' } }));
  }
  assert.equal(chimeRefusal(), null);
});
