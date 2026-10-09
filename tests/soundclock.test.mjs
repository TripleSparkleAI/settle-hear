// THE SOUND CLOCK (lane DJSILENCE, navigator 2026-10-07: "the sound in a tab that is not active, and its rotation,
// must be the same as when it is active"). A hidden tab's page timers are budgeted by the browser, to one wake-up a
// minute once the tab has been hidden five minutes and silent thirty seconds. Measured in Chrome
// (SETTLE/runs/djsilence/MEASURED.md): THE DJ then decided one bar a minute. This file stands in a page whose timers
// fire once a minute and a worker whose timer is not throttled, and holds that every scheduler still runs.
//
// The THE DJ test fails on the code before the lane (the symphony ticked on setInterval, so it decided one bar a
// minute here); see SETTLE/runs/djsilence/redproof.txt.
import test from 'node:test';
import assert from 'node:assert/strict';

// virtual time, seconds: the page's clock, the audio clock and the worker's clock all read it
let vt = 0;
Object.defineProperty(globalThis, 'performance', { value: { now: () => vt * 1000, timeOrigin: 0 }, configurable: true, writable: true });
globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), { hidden: true, visibilityState: 'hidden' });

// THE THROTTLED PAGE: a hidden tab's page intervals, woken once a minute (Chrome's intensive wake-up throttling)
const pageTimers = new Set();
globalThis.setInterval = (fn, ms) => { const t = { fn, ms, unref() { return t; } }; pageTimers.add(t); return t; };
globalThis.clearInterval = (t) => { pageTimers.delete(t); };
// THE WORKER: its own timer is not throttled; it posts a tick every period it is told
const workers = new Set();
globalThis.Worker = class FakeWorker {
  constructor() { this.period = 0; this.next = 0; this.onmessage = null; workers.add(this); }
  postMessage(ms) { this.period = ms; this.next = vt * 1000 + ms; }
  terminate() { workers.delete(this); }
};

const { Ctx } = await import('./fakeaudio.mjs');
const hear = await import('../src/index.js');
const { configure, unlockNow, sound, createSymphony } = hear;
const clock = await import('../src/soundclock.js');
configure({ createContext: () => new Ctx() });
const E = unlockNow();
sound.setMuted(false);

let nextWake = 60;
function run(seconds) {
  const end = vt + seconds;
  while (vt < end - 1e-9) {
    vt = Math.round((vt + 0.01) * 1000) / 1000;
    E.ctx.currentTime = vt;
    for (const w of [...workers]) {
      if (w.period > 0 && vt * 1000 >= w.next - 1e-6) { w.next += w.period; w.onmessage?.({ data: 1 }); }
    }
    if (vt >= nextWake) { nextWake += 60; for (const t of [...pageTimers]) t.fn(); }
  }
}

test('a hidden tab, page timers once a minute: THE DJ still decides every bar line on time', () => {
  const bars = [];
  const on = (e) => bars.push({ at: e.detail.at, bar: e.detail.bar });
  window.addEventListener('settle-hear:bar', on);
  const s = createSymphony({ seed: 71, theme: 'highlands', steer: null, votes: null, house: true });
  run(300);
  window.removeEventListener('settle-hear:bar', on);
  s.dispose();
  const gaps = bars.slice(1).map((b, i) => b.at - bars[i].at);
  assert.ok(bars.length >= 60, `${bars.length} bars in five hidden minutes`);
  assert.ok(Math.max(...gaps) <= 4.01, `the longest stretch with no bar line was ${Math.max(...gaps).toFixed(1)} s`);
});

test('the sound clock runs on the worker while one is there, and stops it with its last subscriber', () => {
  let n = 0;
  const h = clock.soundEvery(100, () => { n += 1; });
  assert.equal(clock.soundClockKind(), 'worker');
  assert.equal(clock.soundClockSteady(), true);
  run(1);
  assert.ok(n >= 9 && n <= 10, `${n} ticks of 100 ms in a second`);
  h.stop();
  assert.equal(clock.soundClockKind(), null, 'the worker is let go with the last subscriber');
});

test('soundAfter runs once, on the worker, at its time', () => {
  let at = null;
  clock.soundAfter(2500, () => { at = vt; });
  run(4);
  assert.ok(at != null && Math.abs(at - (vt - 4 + 2.5)) <= 0.03, `ran at ${at}`);
});

test('no Worker: the clock falls back to the page timer (the old behaviour) and says so', () => {
  clock.configureSoundClock({ worker: null });
  const h = clock.soundEvery(60, () => {});
  assert.equal(clock.soundClockKind(), 'timer');
  assert.equal(clock.soundClockSteady(), false, 'a page timer is not steady in a hidden tab');
  h.stop();
  clock.configureSoundClock({ worker: () => new globalThis.Worker() });
});

test('a hidden tab, page timers once a minute: the static\'s grains are scheduled all the way through', () => {
  const starts = [];
  const orig = E.ctx.createBufferSource.bind(E.ctx);
  E.ctx.createBufferSource = () => { const n = orig(); const st = n.start; n.start = (t = vt) => { starts.push(t); st(); }; return n; };
  const h = hear.createHearing({ preset: 'crackle', level: 0.5, playing: true });
  // the background test's picture: a settle cooling (tests/background.test.mjs); a hidden tab halts it here, so the
  // static holds this sound
  h.update({ T: 1.2, flips: 50, n: 400, ePer: -0.5, q: 0.5, phase: 'cooling', index: 0, power: 0, maxPower: 8, sweeps: 1 });
  const t0 = vt;
  run(150);
  h.dispose();
  E.ctx.createBufferSource = orig;
  const mine = starts.filter((t) => t >= t0 + 5).sort((p, q) => p - q);
  const gaps = mine.slice(1).map((t, i) => t - mine[i]);
  assert.ok(mine.length > 100, `${mine.length} grains in 145 hidden seconds`);
  assert.ok(Math.max(...gaps) < 2, `the longest stretch with no grain was ${Math.max(...gaps).toFixed(1)} s`);
});
