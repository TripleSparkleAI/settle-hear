// THE DECK RULE's one helper: settle-hear's src/deck.js is a byte-identical copy of settle-see's src/deck.js, kept
// so settle-hear imports nothing from settle-see. This test fails the moment the two files differ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createBag } from '../src/deck.js';
import * as hear from '../src/index.js';

const here = new URL('../src/deck.js', import.meta.url);
const there = new URL('../../settle-see/src/deck.js', import.meta.url);

// settle-see sits beside settle-hear in the research repository, and beside a clone of github.com/TripleSparkleAI/settle-hear
// when settle-see is cloned next to it; a clone of settle-hear alone has no copy to compare, and says so
const seeAbsent = existsSync(there) ? false : 'settle-see is not beside this folder (clone github.com/TripleSparkleAI/settle-see next to it)';
test('settle-hear/src/deck.js is byte-identical to settle-see/src/deck.js', { skip: seeAbsent }, () => {
  assert.equal(readFileSync(here, 'utf8'), readFileSync(there, 'utf8'));
});

test('the copy deals like a deck: every item once per round, never the same card twice running', () => {
  const deck = createBag(['a', 'b', 'c', 'd'], { seed: 5 });
  const seq = Array.from({ length: 40 }, () => deck.next());
  for (let k = 0; k < 10; k++) assert.deepEqual(seq.slice(k * 4, k * 4 + 4).sort(), ['a', 'b', 'c', 'd']);
  for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1]);
  assert.equal(typeof hear.createBag, 'function');
});
