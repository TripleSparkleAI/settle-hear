// The DJ visualiser, read as text (settle-hear has no DOM in its tests): it sits clear of the footer strip, keeps
// its controls hidden behind a disclosure, says headphones once, respects reduced motion, and carries no dashes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const jsx = readFileSync(new URL('../react/Symphony.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../react/symphony.css', import.meta.url), 'utf8');
const idx = readFileSync(new URL('../react/index.js', import.meta.url), 'utf8');

test('the mount is one component, exported from settle-hear/react', () => {
  assert.match(idx, /HeroSymphony/);
  assert.match(jsx, /export function HeroSymphony\(\{ stats, playing/);
});

test('it sits bottom left, above the fixed footer strip', () => {
  assert.match(css, /\.dj \{[^}]*left: var\(--gutter/);
  assert.match(css, /bottom: calc\(var\(--foot-strip, 0px\) \+ \d+px\)/);
});

test('the mini opens the larger view, with aria-expanded; the controls hide in a details', () => {
  assert.match(jsx, /className="dj-mini" aria-expanded=\{open\}/);
  assert.match(jsx, /<details className="dj-toggles">/);
  for (const k of ['setTrack', 'lockTheme', 'holdBeat', 'clamp', 'nextTune', 'setTheme', 'setLevel']) assert.ok(jsx.includes(`S.${k}(`), k);
});

test('headphones are named once, with no health claim', () => {
  assert.equal((jsx.match(/headphones/gi) ?? []).length, 1);
  assert.ok(!/(health|heal|cure|therap|alzheimer|focus boost)/i.test(jsx));
});

test('reduced motion: no reveal animation, no light transitions; the mode name is the constant', () => {
  assert.match(jsx, /reduced\(\)\) \{ setK\(999\)/);
  assert.match(css, /prefers-reduced-motion: reduce\)[^}]*\{\s*\.dj-light \{ transition: none; \}/);
  assert.match(jsx, /fallback: FLUTE_MODE_NAME/, 'the constant names the view outside the site; the site passes the mode playing');
});

test('no em or en dashes in the visualiser', () => {
  assert.ok(!/[–—]/.test(jsx + css));
});

test('the line prop: THE DJ as one strip (theme, Hz, the six lights, mode, tune) that opens the same view; off by default', () => {
  assert.match(jsx, /export function HeroSymphony\(\{[^}]*line = false/);
  const strip = jsx.slice(jsx.indexOf('dj-mini dj-mini--line'), jsx.indexOf(') : (', jsx.indexOf('dj-mini dj-mini--line')));
  assert.match(strip, /aria-expanded=\{open\}/);
  for (const part of ['<b>THE DJ</b>', 'dj-theme', 'Hz', '<DJLights decision={d} size={8}', 'dj-mini__mode', 'dj-line__tune']) assert.ok(strip.includes(part), part);
  assert.ok(!strip.includes('dj-mini__row'), 'one strip, no rows');
  assert.match(css, /\.dj-mini\.dj-mini--line \{[^}]*white-space: nowrap/);
  assert.match(css, /\.dj-line__tune \{[^}]*text-overflow: ellipsis/);
  // the three-row mini is still there for a page that does not ask for the line
  assert.match(jsx, /className="dj-mini" aria-expanded=\{open\}/);
});
