// NEXT AND PREVIOUS FOR THE DJ'S SETS (lane DJSKIP): the set history walks back and forward like the hero keys' item
// history, a replay is not a new entry, a natural new set cuts the forward history; the skip door lands on the
// symphony's next bar line; NEXT is a natural set change (the brain restarts, the theme moves, the set hooks fire) for
// the old DJ and the trained DJ alike; PREV plays an earlier set again from its tag and is announced as a set; a skip
// is never a vote.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx } from './fakeaudio.mjs';
import { encodeTag, situationOf } from '../src/dj-tag.js';
import { encodeOpenerTag } from '../src/opener-tag.js';
import { SKIP, djSkipRequests, nextSet, replaySet, setIdOf, isNewSet, createSetHistory } from '../src/dj-skip.js';
import { configure, unlockNow, createSymphony, djVotes, djLive, decodeTag, playTag } from '../src/index.js';
import { createBrainStore } from '../src/dj-brain.js';
import { loadTrainedModels } from '../src/dj-trained.js';

const tagOf = (set, setBar, theme = 'highlands') => encodeTag(situationOf({ theme, set, setBar }));

test('setIdOf and isNewSet: a set starts when the set number, the theme or the mode changes, or the bar goes back', () => {
  const a0 = setIdOf(tagOf(3, 0));
  const a5 = setIdOf(tagOf(3, 5));
  assert.deepEqual([a5.set, a5.setBar, a5.theme, a5.opener], [3, 5, 'highlands', false]);
  assert.equal(isNewSet(null, a0), true, 'the first tag starts a set');
  assert.equal(isNewSet(a0, a5), false, 'a later bar of the same set');
  assert.equal(isNewSet(a5, setIdOf(tagOf(4, 0))), true, 'the next set number');
  assert.equal(isNewSet(a5, setIdOf(tagOf(3, 1))), true, 'the bar went back: a replay of the same set number');
  assert.equal(isNewSet(a5, setIdOf(tagOf(3, 6, 'embers'))), false, 'a theme alone is not a set: the set number moves with every set');
  assert.equal(isNewSet(a5, setIdOf(tagOf(4, 0, 'embers'))), true, 'the set number moved');
  const op = setIdOf(encodeOpenerTag({ theme: 'crystals' }, 3));
  assert.equal(op.opener, true);
  assert.equal(op.theme, 'crystals');
  assert.equal(isNewSet(op, a0), true, 'the opener handing over to the DJ is a set change');
  assert.equal(isNewSet(op, setIdOf(encodeOpenerTag({ theme: 'crystals' }, 9))), false, 'the opener playing on is one set');
  assert.equal(setIdOf('not a tag'), null);
  assert.equal(setIdOf(null), null);
  assert.equal(isNewSet(a0, null), false);
});

test('THE HISTORY: PREV walks back, PREV again walks further, NEXT walks forward before composing, and nothing at the first set', () => {
  const h = createSetHistory();
  assert.equal(h.canBack, false);
  assert.equal(h.back(), null, 'no set yet');
  // three sets, each seen at bar 0 then bar 1 (the bar-1 tag is the one a replay uses)
  for (const n of [0, 1, 2]) {
    assert.equal(h.observe(tagOf(n, 0), { name: `set ${n}` }), 'new');
    assert.equal(h.observe(tagOf(n, 0)), null, 'the same tag again changes nothing');
    assert.equal(h.observe(tagOf(n, 1), { name: `set ${n}` }), 'upgrade');
    assert.equal(h.observe(tagOf(n, 2)), null);
  }
  assert.equal(h.state().list.length, 3);
  assert.equal(h.current.meta.name, 'set 2');
  assert.equal(h.canBack, true);
  assert.equal(h.canForward, false);
  // PREV, then PREV again before the bar line: two sets back, each entry replays from its second bar
  const p1 = h.back();
  assert.equal(p1.tag, tagOf(1, 1));
  assert.equal(h.pending, true);
  const p2 = h.back();
  assert.equal(p2.tag, tagOf(0, 1));
  assert.equal(h.back(), null, 'at the visit\'s first set PREV does nothing');
  assert.equal(h.canBack, false);
  // the landing: the first new tag after the request is the replay, and it pushes nothing
  assert.equal(h.observe(tagOf(0, 1)), 'replay');
  assert.equal(h.pending, false);
  assert.equal(h.observe(tagOf(0, 2)), null);
  assert.equal(h.state().list.length, 3, 'a replay is not a new entry');
  // NEXT after PREV walks forward through the history
  assert.equal(h.canForward, true);
  assert.equal(h.forward().tag, tagOf(1, 1));
  assert.equal(h.observe(tagOf(1, 1)), 'replay');
  assert.equal(h.forward().tag, tagOf(2, 1));
  assert.equal(h.observe(tagOf(2, 1)), 'replay');
  assert.equal(h.forward(), null, 'at the end NEXT composes a new set');
  assert.equal(h.observe(tagOf(3, 0)), 'new');
  assert.equal(h.state().list.length, 4);
});

test('THE HISTORY: go(i) jumps to any set of the visit at once (the #/hear list, lane HEROPASS)', () => {
  const h = createSetHistory();
  for (const n of [0, 1, 2, 3]) { h.observe(tagOf(n, 0), { name: `set ${n}` }); h.observe(tagOf(n, 1), { name: `set ${n}` }); }
  assert.equal(h.go(3), null, 'the set already playing is not a move');
  assert.equal(h.go(9), null, 'nor is one out of range');
  assert.equal(h.go(-1), null);
  const e = h.go(1);
  assert.equal(e.tag, tagOf(1, 1), 'set 1 replays from its second bar');
  assert.equal(h.pending, true);
  assert.equal(h.current.meta.name, 'set 1');
  assert.equal(h.cancel(), true, 'a jump that reached no symphony is taken back');
  assert.equal(h.current.meta.name, 'set 3');
  h.go(0);
  assert.equal(h.observe(tagOf(0, 1)), 'replay', 'its landing pushes nothing');
  assert.equal(h.state().list.length, 4);
  assert.equal(h.canForward, true, 'the later sets stay, to walk forward through');
});

test('THE HISTORY: a natural new set while walking back cuts the forward sets, as a browser does; the cap drops the oldest', () => {
  const h = createSetHistory();
  for (const n of [0, 1, 2, 3]) { h.observe(tagOf(n, 0)); h.observe(tagOf(n, 1)); }
  h.back();
  h.back();
  h.observe(tagOf(1, 1)); // the replay of set 1 lands
  assert.equal(h.state().cursor, 1);
  assert.equal(h.observe(tagOf(9, 0)), 'new', 'the replayed set ended on its own');
  assert.deepEqual(h.state().list.map((e) => setIdOf(e.first).set), [0, 1, 9]);
  assert.equal(h.canForward, false);
  const c = createSetHistory({ cap: 3 });
  for (let n = 0; n < 7; n++) { c.observe(tagOf(n, 0)); c.observe(tagOf(n, 1)); }
  assert.deepEqual(c.state().list.map((e) => setIdOf(e.first).set), [4, 5, 6]);
  assert.equal(c.state().cursor, 2);
  assert.equal(SKIP.historyCap, 64);
  // a move whose replay reached no symphony is taken back, and the next natural set is not swallowed
  assert.equal(c.cancel(), false, 'nothing to take back');
  c.back();
  assert.equal(c.cancel(), true);
  assert.equal(c.state().cursor, 2);
  assert.equal(c.pending, false);
  assert.equal(c.observe(tagOf(7, 0)), 'new');
});

test('THE DOORS: nextSet and replaySet reach every subscriber and nobody else; a bad tag sends nothing', () => {
  const seen = [];
  const before = djSkipRequests.listeners;
  const off = djSkipRequests.subscribe((q) => seen.push(q));
  assert.equal(djSkipRequests.listeners, before + 1);
  assert.equal(nextSet(), before + 1);
  assert.equal(replaySet('ABCD.house.v1.X'), before + 1);
  assert.equal(replaySet(''), 0);
  assert.equal(replaySet(null), 0);
  off();
  assert.deepEqual(seen.map((q) => q.type), ['next', 'replay']);
  assert.equal(seen[1].tag, 'ABCD.house.v1.X');
});

// run a symphony bar by bar on the fake clock: one tick a half second, a bar every 2 s; returns the bars taken
function barsUntil(s, E, pred, max = 400) {
  let bars = 0;
  let last = djLive.get().bar;
  for (let k = 0; k < max; k++) {
    E.ctx.currentTime += 0.5;
    s.tick();
    const b = djLive.get().bar;
    if (b !== last) { bars++; last = b; if (pred()) return bars; }
  }
  return -1;
}

function withSetEvents(fn) {
  const had = globalThis.window;
  const target = new EventTarget();
  globalThis.window = target;
  const events = [];
  target.addEventListener('settle-hear:set', (e) => events.push(e.detail));
  try { return fn(events); } finally { if (had === undefined) delete globalThis.window; else globalThis.window = had; }
}

test('NEXT on the old DJ: nothing changes until the next bar line, then a new set begins, the theme moves, the set hooks fire, and no vote is written', () => withSetEvents((events) => {
  configure({ createContext: () => new Ctx() });
  djVotes.clear();
  const s = createSymphony({ seed: 21, theme: 'highlands', auto: false, house: true, steer: null, votes: null });
  const E = unlockNow();
  barsUntil(s, E, () => false, 24);
  const before = decodeTag(s.state.tag);
  const beforeTheme = s.state.theme.key;
  const n0 = events.length;
  assert.equal(nextSet(), 1, 'one playing symphony heard it');
  assert.equal(decodeTag(s.state.tag).set, before.set, 'nothing changes before the bar line');
  const bars = barsUntil(s, E, () => true, 8);
  assert.equal(bars, 1, 'it lands on the very next bar line');
  const after = decodeTag(s.state.tag);
  assert.equal(after.set, before.set + 1, 'a new set');
  assert.equal(after.setBar, 0, 'from its first bar');
  assert.notEqual(s.state.theme.key, beforeTheme, 'the theme moved on, as at a natural set end');
  const ev = events.slice(n0);
  assert.equal(ev.length, 1, 'the set hooks fire once');
  assert.equal(ev[0].reason, 'a new set', 'announced exactly as a natural set change');
  assert.equal(djVotes.list().length, 0, 'a skip is never a vote');
  s.dispose();
}));

test('PREV: an earlier set plays again from its tag on the next bar line, announced as a set, and the history walks', () => withSetEvents((events) => {
  configure({ createContext: () => new Ctx() });
  djVotes.clear();
  const s = createSymphony({ seed: 33, theme: 'highlands', auto: false, house: true, steer: null, votes: null });
  const E = unlockNow();
  const h = createSetHistory();
  const off = djLive.subscribe((st) => h.observe(st.tag, { theme: st.theme }));
  barsUntil(s, E, () => false, 12);
  const firstTheme = s.state.theme.key;
  const firstTune = s.state.mix.tune.label;
  const firstSet = decodeTag(s.state.tag).set;
  nextSet();
  // two bars into the new set, whatever the wall clock did to the bar grid (lane DJSKIPFIX)
  assert.ok(barsUntil(s, E, () => decodeTag(s.state.tag).set !== firstSet && decodeTag(s.state.tag).setBar >= 2, 40) > 0, 'the new set plays');
  assert.equal(h.state().list.length, 2, 'two sets seen');
  assert.notEqual(s.state.theme.key, firstTheme);
  const e = h.back();
  assert.ok(e && setIdOf(e.tag).setBar >= 1, 'the entry replays from its second bar');
  const n0 = events.length;
  assert.equal(replaySet(e.tag), 1);
  const bars = barsUntil(s, E, () => true, 8);
  assert.equal(bars, 1, 'it lands on the next bar line');
  assert.equal(s.state.theme.key, firstTheme, 'the first set\'s theme is back');
  assert.equal(s.state.mix.tune.label, firstTune, 'and its tune');
  assert.equal(h.pending, false, 'the history took the landing');
  assert.equal(h.state().list.length, 2, 'a replay is not a new entry');
  const ev = events.slice(n0);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].reason, 'a replayed set');
  assert.equal(djVotes.list().length, 0, 'a skip is never a vote');
  off();
  s.dispose();
}));

test('NEXT on the trained DJ: a new trained set, a new seed, on the next bar line', async () => {
  configure({ createContext: () => new Ctx() });
  const store = createBrainStore('trained');
  // the live-settle path; a dealt piece's NEXT is in tests/piecesplay.test.mjs (lane PIECESPLAY)
  const s = createSymphony({ seed: 8, theme: 'embers', auto: false, house: true, steer: null, votes: null, djBrain: store, pieces: false });
  const E = unlockNow();
  await loadTrainedModels();
  await new Promise((r) => setTimeout(r, 0));
  barsUntil(s, E, () => false, 12);
  assert.equal(s.state.mix.brain, 'trained');
  const before = decodeTag(s.state.tag);
  nextSet();
  assert.equal(barsUntil(s, E, () => true, 8), 1);
  const after = decodeTag(s.state.tag);
  assert.equal(s.state.mix.brain, 'trained', 'the trained DJ composed it');
  assert.equal(after.set, before.set + 1);
  assert.notEqual(after.trained.seed, before.trained.seed, 'a newly settled set');
  s.dispose();
});

test('a skip request and a playTag request (the playlist\'s door): the last one before the bar line wins', () => {
  configure({ createContext: () => new Ctx() });
  const s = createSymphony({ seed: 5, theme: 'deepsea', auto: false, house: true, steer: null, votes: null });
  const E = unlockNow();
  barsUntil(s, E, () => false, 10);
  const keep = s.state.tag;
  const before = decodeTag(keep);
  // NEXT, then the playlist's playTag before the bar line: the tag wins, no new set
  nextSet();
  playTag(keep);
  barsUntil(s, E, () => true, 8);
  assert.equal(decodeTag(s.state.tag).set, before.set, 'the tag replaced the skip');
  // the other way round: the tag, then NEXT: a new set
  const now = decodeTag(s.state.tag).set;
  playTag(s.state.tag);
  nextSet();
  barsUntil(s, E, () => true, 8);
  assert.equal(decodeTag(s.state.tag).set, now + 1, 'the skip replaced the tag');
  // and two skip requests: the last one (a replay) wins
  const k2 = s.state.tag;
  nextSet();
  replaySet(k2);
  barsUntil(s, E, () => true, 8);
  assert.equal(decodeTag(s.state.tag).set, decodeTag(k2).set, 'the replay replaced the skip');
  s.dispose();
});

test('NEXT with the McKusker flute moves to the next tune; with the classic DJ, to the next theme', () => {
  configure({ createContext: () => new Ctx() });
  for (const mode of ['pure', 'classic']) {
    const s = createSymphony({ seed: 4, theme: 'cathedral', auto: false, pure: mode === 'pure', steer: null, votes: null });
    const E = unlockNow();
    barsUntil(s, E, () => false, 16);
    const before = { tune: djLive.get().tune, theme: s.state.theme.key };
    nextSet();
    barsUntil(s, E, () => true, 8);
    if (mode === 'pure') {
      assert.equal(s.state.theme.key, before.theme, 'the flute keeps its theme');
      assert.notEqual(djLive.get().tune, before.tune, 'and plays its next tune');
    } else {
      assert.notEqual(s.state.theme.key, before.theme, 'the classic DJ moves to the next theme');
    }
    s.dispose();
  }
});

test('the tag of a new set\'s first bar names the new theme, so a history reads one set (lane DJSKIPFIX)', () => {
  configure({ createContext: () => new Ctx() });
  const s = createSymphony({ seed: 33, theme: 'highlands', auto: false, house: true, steer: null, votes: null });
  const E = unlockNow();
  barsUntil(s, E, () => false, 10);
  const before = decodeTag(s.state.tag);
  nextSet();
  barsUntil(s, E, () => decodeTag(s.state.tag).set !== before.set, 40);
  const first = decodeTag(s.state.tag);
  assert.equal(first.setBar, 0, 'the new set\'s first bar');
  assert.notEqual(s.state.theme.key, before.theme, 'the theme moved');
  assert.equal(first.theme, s.state.theme.key, 'and its first tag says so');
  s.dispose();
});
