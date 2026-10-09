// The flute's collection as a whole: every tune passes the rule and the bar check, names an old book and a scan,
// no tune is in the list twice, the counts by region, and every theme still has tunes to deal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TUNES, tuneProblems, playableTunes, tunesFor, createTuneDealer } from '../src/tunes.js';
import { BOOKS } from '../src/tunes/index.js';
import { metaProblems, duplicateTunes } from '../src/tunecheck.js';
import { THEMES } from '../src/themes.js';
import { rng } from '../src/dj.js';

// the counts this collection has reached; raise them as books land, never lower them to make a test pass
const AT_LEAST = { all: 395, chant: 50, scottish: 120, irish: 200 };

test('every tune passes the source rule, parses, and carries its metadata and full bars', () => {
  for (const t of TUNES) {
    const p = [...tuneProblems(t), ...metaProblems(t)];
    assert.deepEqual(p, [], `${t.id}: ${p.join('; ')}`);
  }
});

test('every tune names a book before 1929 and a place to see its notes', () => {
  for (const t of TUNES) {
    const s = t.source;
    assert.ok(s.scan || s.kind === 'cc0', `${t.id}: no scan`);
    if (s.kind === 'cc0') {
      assert.ok(s.record && s.dataset && s.licence === 'CC0', `${t.id}: CC0 record incomplete`);
      if (s.year != null) assert.ok(s.year < 1929, `${t.id}: book ${s.year}`);
    } else {
      assert.ok(Number.isFinite(s.year) && s.year < 1929, `${t.id}: year ${s.year}`);
      assert.match(s.scan, /^https:\/\/(archive\.org|imslp\.org|www\.imslp\.org|digital\.nls\.uk|babel\.hathitrust\.org|gregobase)/, `${t.id}: scan ${s.scan}`);
    }
  }
});

test('no tune is in the list twice: ids, titles and opening melodies are unique', () => {
  const ids = TUNES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id');
  assert.deepEqual(duplicateTunes(TUNES).map((d) => `${d.a} ~ ${d.b} (${d.why})`), []);
});

test('the counts the collection has reached', () => {
  const by = (r) => TUNES.filter((t) => t.region === r).length;
  assert.ok(TUNES.length >= AT_LEAST.all, `${TUNES.length} tunes`);
  for (const [r, n] of Object.entries(AT_LEAST)) if (r !== 'all') assert.ok(by(r) >= n, `${r}: ${by(r)} < ${n}`);
  assert.equal(playableTunes().length, TUNES.length, 'every tune is playable');
});

test('every book file is listed once in the index and every tune carries its book', () => {
  const slugs = BOOKS.map(([s]) => s);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const t of TUNES) assert.ok(slugs.includes(t.book), `${t.id}: book ${t.book}`);
});

test('THE DECK RULE still holds for every theme over the whole collection', () => {
  const pool = playableTunes();
  for (const th of THEMES) {
    const fit = tunesFor(th, pool);
    assert.ok(fit.length > 0, th.key);
    const d = createTuneDealer({ random: rng(5) });
    const ids = Array.from({ length: fit.length * 2 }, () => d.next(th, pool).id);
    for (let k = 0; k < 2; k++) assert.deepEqual(ids.slice(k * fit.length, (k + 1) * fit.length).sort(), fit.map((x) => x.id).sort(), `${th.key} round ${k}`);
  }
});
