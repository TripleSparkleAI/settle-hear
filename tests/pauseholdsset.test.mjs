// PAUSE ALL HOLDS THE SET (lane RECDJ, the 2026-10-12 sweep's D2). PAUSE ALL (settle-see's ticker 'held') used to
// hold the sound and not the set: the symphony moved to the wall clock and kept deciding bars in silence (held 60 s,
// a set went from bar 11 to bar 41 unheard). Now no bar is decided while held, and letting go plays on from the bar
// it held. Control: an idle reader ('away') is not PAUSE ALL, and its bars still move.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx } from './fakeaudio.mjs';

const win = new EventTarget();
globalThis.window = win;
const { configure, unlockNow, createSymphony, djLive } = await import('../src/index.js');
const ticker = (state) => win.dispatchEvent(Object.assign(new Event('settle:ticker'), { detail: { state, reason: state } }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// advance the audio clock until `n` bars were decided; the bar THE DJ is on afterwards
function playBars(s, E, n) {
  let last = djLive.get().bar;
  let seen = 0;
  for (let k = 0; k < 400 && seen < n; k++) {
    E.ctx.currentTime += 0.5;
    s.tick();
    const b = djLive.get().bar;
    if (b !== last) { seen++; last = b; }
  }
  return djLive.get().bar;
}

// tick for `ms` of real time (the wall clock a silent symphony falls back to), the audio clock moving with it
async function tickFor(s, E, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    E.ctx.currentTime += 0.05;
    s.tick();
    await wait(50);
  }
}

test('PAUSE ALL: no bar moves while held, and letting go plays on from the held bar', async () => {
  configure({ createContext: () => new Ctx() });
  const s = createSymphony({ seed: 21, theme: 'highlands', auto: false, house: true, steer: null, votes: null });
  const E = unlockNow();
  const before = playBars(s, E, 4);
  ticker('held');
  await tickFor(s, E, 2600); // longer than a 2 s bar on either clock
  assert.equal(djLive.get().bar, before, 'a bar was decided under PAUSE ALL');
  ticker('running');
  const after = playBars(s, E, 1);
  assert.ok(after > before && after <= before + 2, `letting go plays on from the held bar (held ${before}, then ${after})`);
  s.dispose();
});

test('control: an idle reader is not PAUSE ALL, so the bars still move', async () => {
  configure({ createContext: () => new Ctx() });
  const s = createSymphony({ seed: 22, theme: 'highlands', auto: false, house: true, steer: null, votes: null });
  const E = unlockNow();
  const before = playBars(s, E, 2);
  ticker('away');
  await tickFor(s, E, 2600);
  assert.ok(djLive.get().bar > before, 'an idle reader froze the set');
  ticker('running');
  s.dispose();
});
