// THE SFX DECKS ON DEMAND (lane BUNDLESLIM, 2026-10-07): under vite the four deck files are a LAZY glob, their own
// chunks, fetched by loadSfxModules(); the load is one for the page however often it is asked, sfxLoaded() says when
// it has finished, and the page-load sword sound waits for it rather than playing nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as decks from '../src/sfx-decks.js';

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');

test('the decks load once for the page, and say when they have', async () => {
  assert.equal(typeof decks.sfxLoaded, 'function');
  assert.equal(decks.sfxLoaded(), false, 'nothing is loaded before the first ask');
  assert.equal(decks.sfxDecks().all.length, 0, 'and the decks are empty');
  const a = decks.loadSfxModules();
  const b = decks.loadSfxModules();
  assert.equal(a, b, 'a second ask while loading is the same load');
  const d = await a;
  assert.equal(decks.sfxLoaded(), true);
  assert.equal(d.sword.length, 50);
  assert.equal(d.radial.length, 50);
  assert.equal(decks.loadSfxModules(), a, 'an ask after the load is the same, finished load');
});

test('under vite the glob is lazy, and the page-load sound waits for the decks', () => {
  assert.match(src('sfx-decks.js'), /import\.meta\.glob\('\.\/sfx-\{sword,radial\}-\*\.js'\)/);
  assert.doesNotMatch(src('sfx-decks.js'), /eager:\s*true/);
  assert.match(src('sfx.js'), /loadSfxModules\(\)\.then\(\(\) => \{[^\n]*playSfx\(\{ deck: 'sword', strength: SFX\.strength\.load, reason: 'load', page: true \}\)/);
  assert.match(src('index.js'), /loadSfxModules, sfxLoaded, sfxById \} from '\.\/sfx-decks\.js'/);
});
