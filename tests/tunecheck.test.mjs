// The tune checks: every bar the meter's length (pickups and section ends allowed short), the opening print,
// title folding and the duplicate finder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meterBeats, abcBars, barProblems, melodyPrint, normTitle, duplicateTunes } from '../src/tunecheck.js';

const REEL = 'X:1\nT:t\nM:C|\nL:1/8\nK:A\ne|cAAB ABAF|EFAB c2 BA|dBBc dcBA|BcdB A3:|\n|:e|cAec fAec|cAec ABAF|1EFAB c2BA:|2EFAB c2 A2|]';

test('meterBeats reads C, C|, fractions and free time', () => {
  assert.equal(meterBeats('C'), 4);
  assert.equal(meterBeats('C|'), 4);
  assert.equal(meterBeats('6/8'), 3);
  assert.equal(meterBeats('9/8'), 4.5);
  assert.equal(meterBeats('3/4'), 3);
  assert.equal(meterBeats('none'), null);
});

test('abcBars measures each bar and marks the edges (pickup, section ends, endings)', () => {
  const bars = abcBars(REEL);
  assert.equal(bars.length, 10);
  assert.deepEqual(bars.map((b) => b.beats), [0.5, 4, 4, 4, 3.5, 0.5, 4, 4, 4, 4]);
  assert.deepEqual(bars.map((b) => b.edge), [true, false, false, false, true, true, false, false, true, true]);
});

test('a correct reel has no bar problems; one extra note is caught as a long bar', () => {
  assert.deepEqual(barProblems(REEL), []);
  const long = barProblems(REEL.replace('dBBc', 'dBBcd'));
  assert.equal(long.length, 1);
  assert.equal(long[0].why, 'too long');
  const short = barProblems(REEL.replace('cAec fAec', 'cAec fAe'));
  assert.equal(short.length, 1);
  assert.equal(short[0].why, 'too short');
});

test('a short bar at an edge is allowed, a long one never; free time is not checked', () => {
  assert.deepEqual(barProblems('M:6/8\nL:1/8\nK:D\nA|dfa afd|e3 e2:|'), []);
  assert.equal(barProblems('M:6/8\nL:1/8\nK:D\nAB|dfa afd|e3 e2:|').length, 0);
  assert.equal(barProblems('M:6/8\nL:1/8\nK:D\nABCDEFG|dfa afd|').length, 1);
  assert.deepEqual(barProblems('M:none\nL:1/8\nK:C\nABC DEF GABc|d'), []);
});

test('triplets, broken rhythm and ties are counted as the flute plays them', () => {
  assert.deepEqual(barProblems('M:C\nL:1/8\nK:D\nA>BA>F D>FA>d|(3efg (3fed A2 d2|d4-d4|]'), []);
});

test('melodyPrint is the same in any key and ignores repeated notes', () => {
  assert.equal(melodyPrint('K:D\nL:1/8\nDDEF GABc d', 6), melodyPrint('K:G\nL:1/8\nGABc defg a', 6));
  assert.equal(melodyPrint('K:C\nL:1/8\nCDE', 6), '');
});

test('normTitle folds case, punctuation, a leading "the" and brackets', () => {
  assert.equal(normTitle("The Mason's Apron"), normTitle('Masons Apron'));
  assert.equal(normTitle('Coolin (with variations)'), 'coolin');
  assert.equal(normTitle('Féidh'), 'feidh');
});

test('duplicateTunes finds a shared title or a shared opening, and honours the allow list', () => {
  const a = { id: 'a', title: 'The Coolin', abc: 'K:D\nL:1/8\nDEFG ABcd efga b' };
  const b = { id: 'b', title: 'Coolin', abc: 'K:G\nL:1/8\nGFED CB,A,G, F,E,D,C,' };
  const c = { id: 'c', title: 'Other', abc: 'K:G\nL:1/8\nGABc defg abc\'d\' e\'' };
  const d = duplicateTunes([a, b, c]);
  assert.deepEqual(d.map((x) => [x.a, x.b, x.why]).sort(), [['a', 'b', 'title'], ['a', 'c', 'opening']]);
  assert.deepEqual(duplicateTunes([a, b, c], { allow: ['a|b', 'c|a'] }), []);
});
