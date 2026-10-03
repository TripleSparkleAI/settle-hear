// THE DECK RULE in settle-hear: every cycle deals like a deck of cards. For each converted cycle, N consecutive deals
// from an N-item cycle contain every item exactly once, and no item follows itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rng, createThemeDealer, createBeatDealer } from '../src/dj.js';
import { THEMES, themeOf } from '../src/themes.js';
import { BEAT_HOME } from '../src/tuning.js';
import { TUNES, playableTunes, tunesFor, createTuneDealer } from '../src/tunes.js';
import { createChimeRoots } from '../src/voices.js';
import { createPassBag, PASS_KEYS } from '../src/house.js';
import { clickBag, CLICK_NOISES } from '../src/clicks.js';

const once = (seq, items, why) => assert.deepEqual([...seq].map(String).sort(), [...items].map(String).sort(), why);
const noRepeat = (seq, why) => { for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], `${why}: twice at ${i}`); };

test('THE DJ\'s themes: each run of N theme changes deals all N themes, never the theme it is leaving', () => {
  const n = THEMES.length;
  for (const seed of [1, 2, 3, 9, 77]) {
    const d = createThemeDealer(rng(seed), THEMES[0].key);
    let cur = THEMES[0].key;
    const seq = [];
    for (let i = 0; i < n * 6; i++) {
      const t = d.next(cur);
      assert.notEqual(t.key, cur, `seed ${seed}: left ${cur} for itself`);
      cur = t.key;
      seq.push(cur);
    }
    for (let k = 0; k < 6; k++) once(seq.slice(k * n, (k + 1) * n), THEMES.map((t) => t.key), `seed ${seed} round ${k}`);
  }
});

test('THE DJ\'s beats: away from the pull home, a theme\'s beats deal like a deck', () => {
  for (const t of THEMES) {
    // a generator that never comes home (the home pull draws first and loses), so every pick is a deal
    const r0 = rng(5);
    let first = true;
    const r = () => { if (first) { first = false; return 0.999; } return r0(); };
    const d = createBeatDealer(() => r());
    const deals = [];
    let beat = null; // no beat yet, so the first deal cannot be skipped as the current one
    const n = t.beats.length;
    for (let i = 0; i < n * 4; i++) {
      first = true;
      beat = d.next(t, beat, 0);
      deals.push(beat);
    }
    noRepeat(deals, t.key);
    for (let k = 0; k < 4; k++) once(deals.slice(k * n, (k + 1) * n), t.beats, `${t.key} round ${k}`);
  }
});

test('the flute\'s tunes: N tune changes on one theme play all N of that theme\'s tunes', () => {
  const pool = playableTunes(TUNES);
  for (const t of THEMES) {
    const fit = tunesFor(t, pool);
    const d = createTuneDealer({ random: rng(11) });
    const ids = Array.from({ length: fit.length * 4 }, () => d.next(t, pool).id);
    for (let k = 0; k < 4; k++) once(ids.slice(k * fit.length, (k + 1) * fit.length), fit.map((x) => x.id), `${t.key} round ${k}`);
    if (fit.length > 1) noRepeat(ids, t.key);
  }
  assert.equal(createTuneDealer().next(themeOf('nothing'), []), undefined);
});

test('the chime\'s roots: five chimes ring all five pentatonic roots', () => {
  const d = createChimeRoots(rng(3));
  const seq = Array.from({ length: 25 }, () => d.next());
  for (let k = 0; k < 5; k++) once(seq.slice(k * 5, k * 5 + 5), [0, 2, 4, 7, 9], `round ${k}`);
  noRepeat(seq, 'chime');
});

test('the house passes: the pass bag is the deck, every pass once a round', () => {
  const n = PASS_KEYS.length;
  const bag = createPassBag({ seed: 4 });
  const seq = Array.from({ length: n * 3 }, () => bag.next());
  for (let k = 0; k < 3; k++) once(seq.slice(k * n, (k + 1) * n), PASS_KEYS, `round ${k}`);
  noRepeat(seq, 'passes');
});

test('the click noises: 24 clicks play all 24 noises (the bag under THE CLICK LOCK)', () => {
  const n = CLICK_NOISES.length;
  const b = clickBag(n, 9);
  const seq = Array.from({ length: n * 4 }, () => b.next());
  for (let k = 0; k < 4; k++) once(seq.slice(k * n, (k + 1) * n), [...Array(n).keys()], `round ${k}`);
  noRepeat(seq, 'clicks');
  assert.equal(clickBag(0, 1).next(), -1, 'an empty bag answers -1');
});
