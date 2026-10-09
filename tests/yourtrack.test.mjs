// YOUR TRACK (lane LOOPLAYERS, 2026-10-02): a set the visitor touched is theirs too. The DJ says "cool", the vote asks
// for a rating; when the DJ cycles, the vote stays open on the old set for ten seconds and the new set starts clean.
// The set listener reads SETTLEDJ's two hooks (the `settle-hear:set` window event and djLive's `set`) and degrades to
// a theme change when neither exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VOTE_WINDOW_MS, COOL_MS, BLOOM_MS, createYourTrack, listenSets } from '../src/index.js';

function liveStore(init) {
  let st = init;
  const subs = new Set();
  return { get: () => st, set(n) { st = n; for (const f of subs) f(st); }, subscribe(f) { subs.add(f); return () => subs.delete(f); } };
}
function target() {
  const ls = new Map();
  return {
    addEventListener(n, f) { ls.set(n, f); },
    removeEventListener(n) { ls.delete(n); },
    fire(n, detail) { ls.get(n)?.({ detail }); },
    has: (n) => ls.has(n),
  };
}

test('the numbers: a 10 s vote window, a 2.4 s "cool", a 0.9 s bloom', () => {
  assert.equal(VOTE_WINDOW_MS, 10_000);
  assert.equal(COOL_MS, 2_400);
  assert.equal(BLOOM_MS, 900);
});

test('a first touch says cool once per set; the view asks "mine" until the vote or the cycle', () => {
  const y = createYourTrack();
  assert.equal(y.view(0).ask, null);
  assert.equal(y.mark(1_000), true, 'first touch');
  assert.equal(y.mark(1_500), false, 'second touch is quiet');
  let v = y.view(2_000);
  assert.equal(v.ask, 'mine');
  assert.equal(v.cool, true);
  assert.equal(y.view(1_000 + COOL_MS + 1).cool, false, 'cool fades');
  assert.equal(y.voted(5_000), 'now');
  v = y.view(5_001);
  assert.equal(v.ask, null, 'voted: no more asking');
});

test('the cycle on an adjusted set opens the 10 s window on the OLD set, with its context; the new set starts clean', () => {
  const y = createYourTrack();
  y.mark(1_000);
  const ctx = { theme: 'cathedral' };
  const r = y.cycle(20_000, { context: ctx, set: 3 });
  assert.deepEqual(r, { vote: true, bloom: true });
  const v = y.view(20_000);
  assert.equal(v.ask, 'window');
  assert.equal(v.left, 10);
  assert.equal(v.bloom, true);
  assert.equal(y.view(24_500).left, 6);
  assert.deepEqual(y.target(24_500), { kind: 'window', set: 3, context: ctx });
  assert.equal(y.view(20_000 + BLOOM_MS).bloom, false, 'the bloom ends');
  assert.equal(y.view(30_000).ask, null, 'the window closes at 10 s');
  assert.deepEqual(y.target(30_000).kind, 'now');
  // the new set can be adjusted too
  assert.equal(y.mark(31_000), true);
  assert.equal(y.view(31_001).ask, 'mine');
});

test('a vote inside the window rates the old set and closes the window; an untouched set opens no window and no bloom', () => {
  const y = createYourTrack();
  y.mark(0);
  y.cycle(10_000, { context: { theme: 'embers' }, set: 1 });
  assert.equal(y.voted(12_000), 'window');
  assert.equal(y.view(12_001).ask, null);
  const z = createYourTrack();
  assert.deepEqual(z.cycle(5_000, {}), { vote: false, bloom: false });
  assert.deepEqual(z.cycle(6_000, { hadLayers: true }), { vote: false, bloom: true }, 'loops let go still bloom');
  assert.equal(z.cycle(7_000, { adjusted: true }).vote, true, "the hook's adjusted counts for the set that ended");
});

test('already voted on your track before the cycle: no second ask in the window', () => {
  const y = createYourTrack();
  y.mark(0);
  y.voted(1_000);
  assert.deepEqual(y.cycle(2_000, {}), { vote: false, bloom: true });
});

test('THE SET LISTENER: the window event fires once per ended set with its adjusted flag and that set\'s snapshot', () => {
  const live = liveStore({ live: true, theme: 'crystals', set: 4 });
  const T = target();
  const got = [];
  const off = listenSets({ target: T, live, onCycle: (e) => got.push(e), defer: (f) => f() });
  T.fire('settle-hear:set', { set: 4, adjusted: true, reason: 'set' });
  live.set({ live: true, theme: 'embers', set: 5 });
  assert.equal(got.length, 1, 'deduped: the live path saw the same ended set');
  assert.equal(got[0].set, 4);
  assert.equal(got[0].adjusted, true);
  assert.equal(got[0].snapshot.theme, 'crystals');
  off();
  assert.equal(T.has('settle-hear:set'), false, 'off removes the listener');
});

test('THE SET LISTENER: djLive alone (no event) fires on the set number moving; the deferred live path loses to a late event', () => {
  const live = liveStore({ live: true, theme: 'highlands', set: 0 });
  const T = target();
  const got = [];
  const queue = [];
  listenSets({ target: T, live, onCycle: (e) => got.push(e), defer: (f) => queue.push(f) });
  live.set({ live: true, theme: 'deepsea', set: 1 });
  T.fire('settle-hear:set', { set: 0, adjusted: true });
  for (const f of queue) f();
  assert.equal(got.length, 1);
  assert.equal(got[0].adjusted, true, 'the event, which knows adjusted, won');
  assert.equal(got[0].snapshot.theme, 'highlands');
  live.set({ live: true, theme: 'deepsea', set: 2 });
  for (const f of queue.splice(0)) f();
  assert.equal(got.length, 2);
  assert.equal(got[1].set, 1);
  assert.equal(got[1].reason, 'live');
});

test('DEGRADING: a DJ with no set hooks still cycles on a theme change; an idle DJ fires nothing', () => {
  const live = liveStore({ live: true, theme: 'crystals' });
  const got = [];
  listenSets({ target: null, live, onCycle: (e) => got.push(e), defer: (f) => f() });
  live.set({ live: true, theme: 'crystals', bar: 3 });
  assert.equal(got.length, 0);
  live.set({ live: true, theme: 'cathedral' });
  assert.equal(got.length, 1);
  assert.equal(got[0].reason, 'theme');
  assert.equal(got[0].snapshot.theme, 'crystals');
  const idle = liveStore({ live: false, theme: null });
  const none = [];
  listenSets({ target: null, live: idle, onCycle: (e) => none.push(e) });
  idle.set({ live: false, theme: null });
  assert.equal(none.length, 0);
});

test('THE SET LISTENER (lane DJSILENCE): a track that is not THE DJ\'s set ends with its own snapshot, so the window rates it', () => {
  const live = liveStore({ live: true, theme: 'crystals', set: 4 });
  const T = target();
  const got = [];
  const off = listenSets({ target: T, live, onCycle: (e) => got.push(e), defer: (f) => f() });
  T.fire('settle-hear:set', { set: null, reason: 'track', snapshot: { live: true, tag: 'SCHU.mode.v1.144B783', mode: 'schumann' } });
  assert.equal(got.length, 1);
  assert.equal(got[0].reason, 'track');
  assert.equal(got[0].snapshot.tag, 'SCHU.mode.v1.144B783', 'the ended mode\'s own snapshot, not THE DJ\'s state');
  // without one, the snapshot is still THE DJ's own, as before
  T.fire('settle-hear:set', { set: null, reason: 'track' });
  assert.equal(got[1].snapshot.theme, 'crystals');
  off();
});
