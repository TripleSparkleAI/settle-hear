// The sound and settle-see's ticker (window event 'settle:ticker'). Since lane SOUNDDOCTOR only PAUSE ALL (the
// ticker 'held') halts the sound; a hidden tab or an idle reader halts the pictures and the sound plays on, like a
// video (tests/background.test.mjs holds the context side of that rule).
import test from 'node:test';
import assert from 'node:assert/strict';

const win = new EventTarget();
globalThis.window = win;
const { isAway, pageHalted } = await import('../src/engine.js');
const say = (state) => win.dispatchEvent(Object.assign(new Event('settle:ticker'), { detail: { state } }));

test('PAUSE ALL (held) halts the sound, and letting go resumes it', () => {
  assert.equal(isAway(), false);
  say('held');
  assert.equal(isAway(), true);
  say('running');
  assert.equal(isAway(), false);
});

test('an idle reader or a hidden tab halts the pictures only: the sound plays on', () => {
  say('away');
  assert.equal(isAway(), false);
  assert.equal(pageHalted(), true);
  say('hidden');
  assert.equal(isAway(), false);
  assert.equal(pageHalted(), true);
  say('running');
  assert.equal(pageHalted(), false);
});

test('negative control: an unrelated window event does not halt anything', () => {
  win.dispatchEvent(new Event('settle:something-else'));
  assert.equal(isAway(), false);
  assert.equal(pageHalted(), false);
});
