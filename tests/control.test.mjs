// The site-wide switch: the mute choice is the only thing remembered, and broken storage never breaks it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSwitch, readMuted, writeMuted, MUTE_KEY } from '../src/control.js';

const memory = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const throwing = () => ({
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); },
});

test('sound is on by default and nothing plays until the first gesture', () => {
  const s = createSwitch({ storage: memory() });
  assert.equal(s.muted, false);
  assert.equal(s.unlocked, false);
  assert.equal(s.audible, false);
  s.unlock();
  assert.equal(s.audible, true);
});

test('the mute choice persists from visit to visit, and it is the only key written', () => {
  const st = memory();
  const a = createSwitch({ storage: st });
  a.setMuted(true);
  assert.deepEqual([...st.m.keys()], [MUTE_KEY]);
  assert.equal(st.m.get(MUTE_KEY), '1');
  const b = createSwitch({ storage: st }); // the next visit
  assert.equal(b.muted, true);
  assert.equal(b.remembered, true);
  b.toggle();
  assert.equal(createSwitch({ storage: st }).muted, false);
  assert.deepEqual([...st.m.keys()], [MUTE_KEY]);
});

test('the unlock is never remembered: a new visit waits for a gesture again', () => {
  const st = memory();
  const a = createSwitch({ storage: st });
  a.unlock();
  assert.equal(createSwitch({ storage: st }).unlocked, false);
  assert.equal(st.m.size, 0, 'unlocking wrote nothing');
});

test('a throwing storage (a private window) leaves the switch working, just without memory', () => {
  const s = createSwitch({ storage: throwing() });
  assert.equal(s.muted, false);
  assert.doesNotThrow(() => s.setMuted(true));
  assert.equal(s.muted, true);
  assert.equal(readMuted(throwing()), null);
  assert.equal(writeMuted(throwing(), true), false);
  assert.equal(readMuted(null), null);
  assert.equal(writeMuted(null, true), false);
});

test('garbage in storage is ignored, not read as a choice', () => {
  const st = memory();
  st.setItem(MUTE_KEY, 'maybe');
  assert.equal(readMuted(st), null);
  assert.equal(createSwitch({ storage: st }).muted, false);
});

test('subscribers hear every change once, and an unchanged set is silent', () => {
  const s = createSwitch({ storage: memory() });
  const seen = [];
  const off = s.subscribe((x) => seen.push(x));
  s.setMuted(false); // unchanged
  s.setMuted(true);
  s.unlock();
  s.unlock(); // unchanged
  off();
  s.setMuted(false);
  assert.deepEqual(seen, [{ muted: true, unlocked: false, blocked: false }, { muted: true, unlocked: true, blocked: false }]);
});

test('negative control: without storage a mute does not survive to the next visit', () => {
  const a = createSwitch({ storage: null });
  a.setMuted(true);
  assert.equal(createSwitch({ storage: null }).muted, false);
});

test('AUTOSTART: blocked turns on before the start, off with the unlock, and never while unlocked', () => {
  const s = createSwitch({ storage: memory() });
  const seen = [];
  s.subscribe((x) => seen.push(x.blocked));
  s.setBlocked(true);
  assert.equal(s.blocked, true);
  s.setBlocked(true); // unchanged: silent
  s.unlock();
  assert.equal(s.blocked, false, 'a started sound is never blocked');
  s.setBlocked(true);
  assert.equal(s.blocked, false, 'blocked refused after the unlock');
  assert.deepEqual(seen, [true, false]);
});
