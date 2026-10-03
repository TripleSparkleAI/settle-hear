// THE CLICK LOCK: the first click takes the next sound in the cycle and locks it; clicks replay it while they keep
// coming; the lock lets go after a quiet period drawn fresh (uniform 1 to 3 s, seeded) each time it is taken.
// Every test runs on a fake clock: the lock reads only the timestamps it is handed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLICK_LOCK, createClickLock, clickBag, CLICK_NOISES, configure, unlockNow, sound, playClickNoise, armClickNoises } from '../src/index.js';
import { Ctx } from './fakeaudio.mjs';

const cycle = (n = 24, seed = 5) => { const b = clickBag(n, seed); return () => b.next(); };

test('the debounce range is 1 to 3 seconds', () => {
  assert.equal(CLICK_LOCK.minMs, 1000);
  assert.equal(CLICK_LOCK.maxMs, 3000);
});

test('rapid clicks give one sound', () => {
  const lock = createClickLock({ draw: cycle(), seed: 9 });
  const first = lock.take(0);
  assert.equal(first.fresh, true);
  for (let t = 50; t <= 900; t += 50) {
    const r = lock.take(t);
    assert.equal(r.value, first.value, `click at ${t} ms replays the locked sound`);
    assert.equal(r.fresh, false);
  }
});

test('a pause shorter than the drawn debounce keeps the sound; the quiet is counted from the LAST click', () => {
  const lock = createClickLock({ draw: cycle(), seed: 9 });
  const first = lock.take(0);
  // clicks every 900 ms for 12 s: every gap is under the 1 s floor, so the lock never lets go
  for (let t = 900; t <= 12000; t += 900) assert.equal(lock.take(t).value, first.value, `held at ${t} ms`);
  // and a gap just under this lock's own drawn debounce still holds
  const { lastAt, debounceMs: d } = lock.state();
  assert.equal(lastAt, 11700, 'the last click moved the quiet period');
  assert.equal(lock.take(lastAt + d - 1).value, first.value);
});

test('a pause longer than the drawn debounce advances to the next sound in the bag and locks that', () => {
  const draws = [];
  const b = clickBag(24, 5);
  const lock = createClickLock({ draw: () => { const v = b.next(); draws.push(v); return v; }, seed: 9 });
  const a = lock.take(0);
  const d = lock.state().debounceMs;
  const c = lock.take(d + 1);
  assert.equal(c.fresh, true);
  assert.notEqual(c.value, a.value);
  assert.deepEqual(draws, [a.value, c.value], 'the cycle advanced exactly once per lock');
  assert.equal(lock.take(d + 200).value, c.value, 'the new sound is locked in turn');
});

test('the debounce is drawn fresh per lock, differs between locks, and stays inside 1 to 3 s', () => {
  const lock = createClickLock({ draw: cycle(), seed: 11 });
  const seen = [];
  let t = 0;
  for (let k = 0; k < 200; k++) {
    lock.take(t);
    const d = lock.state().debounceMs;
    assert.ok(d >= CLICK_LOCK.minMs && d <= CLICK_LOCK.maxMs, `debounce ${d}`);
    seen.push(d);
    t += d + 1; // let it go every time
  }
  assert.ok(new Set(seen.map((d) => Math.round(d))).size > 150, 'the quiet period differs between locks');
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1], `lock ${i} drew a new quiet period`);
  const lo = Math.min(...seen);
  const hi = Math.max(...seen);
  assert.ok(lo < 1200 && hi > 2800, `the draws span the range (${lo} .. ${hi})`);
  // seeded: the same seed gives the same quiet periods
  const again = createClickLock({ draw: cycle(), seed: 11 });
  let u = 0;
  for (let k = 0; k < 5; k++) { again.take(u); assert.equal(again.state().debounceMs, seen[k]); u += seen[k] + 1; }
});

test('the bag never repeats back to back across advances, and every sound plays before any repeats', () => {
  const lock = createClickLock({ draw: cycle(24, 3), seed: 4 });
  const sounds = [];
  let t = 0;
  for (let k = 0; k < 24 * 6; k++) {
    sounds.push(lock.take(t).value);
    lock.take(t + 300); // a second click inside the lock, which must not advance the cycle
    t += 300 + CLICK_LOCK.maxMs + 1;
  }
  for (let i = 1; i < sounds.length; i++) assert.notEqual(sounds[i], sounds[i - 1], `advance ${i}`);
  for (let p = 0; p < 6; p++) assert.equal(new Set(sounds.slice(p * 24, (p + 1) * 24)).size, 24, `pass ${p}`);
});

test('nothing ticks while idle: the lock is pure timestamps', () => {
  const lock = createClickLock({ draw: cycle(), seed: 2 });
  assert.equal(lock.state(), null);
  const r = lock.take(1000);
  const s = lock.state();
  assert.equal(s.until, 1000 + s.debounceMs);
  assert.equal(r.until, s.until);
  assert.equal(lock.locked(s.until - 1), true);
  assert.equal(lock.locked(s.until + 1), false);
  lock.reset();
  assert.equal(lock.state(), null);
});

test('the hero click noises lock: rapid clicks play one noise, a long pause plays the next', () => {
  configure({ createContext: () => new Ctx() });
  unlockNow();
  sound.setMuted(false);
  let now = 0;
  const off = armClickNoises({ seed: 21, now: () => now });
  const a = playClickNoise();
  now = 300; const b = playClickNoise();
  now = 700; const c = playClickNoise();
  assert.equal(b.index, a.index);
  assert.equal(c.index, a.index);
  assert.equal(b.locked, true);
  now = 700 + CLICK_LOCK.maxMs + 1;
  const d = playClickNoise();
  assert.notEqual(d.index, a.index);
  assert.equal(d.locked, false);
  assert.equal(CLICK_NOISES[d.index].name, d.name);
  // an explicit index plays that noise and leaves the lock alone
  now += 10;
  assert.equal(playClickNoise({ index: 0 }).index, 0);
  now += 10;
  assert.equal(playClickNoise().index, d.index);
  off();
});

test('MUTE ALL: a muted click neither plays nor takes the lock', () => {
  let now = 0;
  armClickNoises({ seed: 21, now: () => now });
  sound.setMuted(true);
  assert.equal(playClickNoise(), null);
  sound.setMuted(false);
  const first = playClickNoise();
  assert.equal(first.locked, false, 'the first audible click takes the lock');
});
