// settle-hear · clicklock - THE CLICK LOCK (lane CLICKLOCK, navigator 2026-10-02: "It must be a cycle! But once the
// user clicks, it locks in on that sound until some debounce. Random debounce too."). One rule for every clicked
// source: the first click takes the next sound in the source's cycle and locks it, further clicks replay that sound,
// and the lock lets go once the clicks stop for a quiet period drawn fresh each time the lock is taken.
//
// <claudes_code_comments>
// ** Function List **
// CLICK_LOCK                         - the quiet period's range: uniform minMs 1000 .. maxMs 3000 (navigator 2026-10-02)
// lockRng(seed)                      - mulberry32: the seeded generator the quiet periods are drawn from
// createClickLock({ draw, seed, minMs, maxMs, now }) - a lock over a cycle; draw() gives the cycle's next sound
//   .take(at)                        - a click at master time `at` (ms): { value, fresh, debounceMs, until }
//   .locked(at)                      - true while a sound is locked at `at`
//   .state()                         - { value, lastAt, debounceMs, until }, or null before the first click
//   .reset()                         - drop the lock; the next click advances the cycle
//
// ** Technical Review **
// - THE CYCLE is the caller's: draw() is a shuffled no-repeat bag (clicks.js clickBag, the site's bag.js), so two
//   locks in a row never hold the same sound and every sound is heard before any repeats. The lock calls draw()
//   exactly once per lock taken and never while a lock holds.
// - THE LOCK: a click while locked replays the locked value and moves lastAt to that click, so the quiet period is
//   counted from the LAST click. A click at or past lastAt + debounceMs advances the cycle and takes a new lock.
// - THE RANDOM DEBOUNCE: minMs + r() x (maxMs - minMs), drawn from lockRng(seed) each time a lock is taken, so a test
//   sees exact numbers and two locks almost never share a quiet period.
// - NOTHING RUNS WHILE IDLE: no timer is ever set. Expiry is a comparison of two timestamps made at the next click.
// - THE CLOCK: `now` defaults to masterNow() (masterbeat.js, the page's one clock: performance.now()); a test hands
//   in a fake clock or passes `at` straight to take().
// </claudes_code_comments>

import { masterNow } from './masterbeat.js';

export const CLICK_LOCK = Object.freeze({ minMs: 1000, maxMs: 3000 });

export function lockRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createClickLock({ draw, seed = 1, minMs = CLICK_LOCK.minMs, maxMs = CLICK_LOCK.maxMs, now = masterNow } = {}) {
  if (typeof draw !== 'function') throw new TypeError('createClickLock needs draw()');
  const lo = Math.max(0, Math.min(minMs, maxMs));
  const hi = Math.max(minMs, maxMs);
  const r = lockRng(seed);
  let held = null; // { value, lastAt, debounceMs }
  const until = () => held.lastAt + held.debounceMs;
  return {
    take(at = now()) {
      const t = Number.isFinite(at) ? at : now();
      if (held && t >= held.lastAt && t < until()) {
        held.lastAt = t;
        return { value: held.value, fresh: false, debounceMs: held.debounceMs, until: until() };
      }
      held = { value: draw(), lastAt: t, debounceMs: lo + r() * (hi - lo) };
      return { value: held.value, fresh: true, debounceMs: held.debounceMs, until: until() };
    },
    locked(at = now()) {
      return !!held && at >= held.lastAt && at < until();
    },
    state() {
      return held ? { value: held.value, lastAt: held.lastAt, debounceMs: held.debounceMs, until: until() } : null;
    },
    reset() {
      held = null;
    },
  };
}
