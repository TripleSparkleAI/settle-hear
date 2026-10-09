// THE DJ PANEL (lane DJRATELINE): an outside click closes it even where the .dj root's own box reaches, the panel
// fits between the top of the hero and the DJ line with its body scrolling inside, the title names the mode playing,
// the p-bit track is as wide as its sweeps, and the close button is a small glyph on the title row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { djInside, djRoom, djHeadline, traceColumns } from '../src/index.js';

const jsx = readFileSync(new URL('../react/Symphony.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../react/symphony.css', import.meta.url), 'utf8');
const rule = (sel) => {
  const i = css.indexOf(`${sel} {`);
  assert.ok(i >= 0, `${sel} has a rule`);
  return css.slice(i, css.indexOf('}', i));
};

// a tiny DOM: an element contains itself and its descendants
const el = (parent = null) => {
  const e = { parent, contains(x) { for (let n = x; n; n = n.parent) if (n === e) return true; return false; } };
  return e;
};

test('inside means the panel or its own toggle; the .dj root box itself is outside', () => {
  const root = el();
  const view = el(root);
  const row = el(view);
  const toggle = el(root);
  assert.equal(djInside(row, { view, toggle }), true, 'a slider in the panel');
  assert.equal(djInside(toggle, { view, toggle }), true, 'the DJ line toggles it itself');
  assert.equal(djInside(root, { view, toggle }), false, 'the empty part of the .dj box is outside (the bug: it kept the panel open)');
  assert.equal(djInside(el(), { view, toggle }), false, 'the hero picture');
  assert.equal(djInside(null, { view, toggle }), false);
});

test('the .dj root takes no clicks of its own, only its panel and its line do', () => {
  assert.match(rule('.dj'), /pointer-events: none/);
  assert.match(css, /\.dj > \* \{[^}]*pointer-events: auto/);
  assert.match(jsx, /djInside\(e\.target, \{ view: viewRef\.current, toggle: toggleRef\.current \}\)/);
});

test('the room: from the top bound to the line above it, or from the line to the bottom bound below it', () => {
  assert.equal(djRoom({ lineTop: 815, lineBottom: 841, boundTop: 64, boundBottom: 900, above: true }), 815 - 64 - 12);
  assert.equal(djRoom({ lineTop: 113, lineBottom: 135, boundTop: 0, boundBottom: 860, above: false }), 860 - 135 - 12);
  assert.equal(djRoom({ lineTop: 100, lineBottom: 120, boundTop: 64, boundBottom: 900, above: true }), 160, 'never below the floor');
});

test('the panel is capped to the room, its header stays put and its body scrolls with a thin bar', () => {
  assert.match(jsx, /style=\{\{ maxHeight: room \}\}/);
  assert.match(rule('.dj-view'), /display: flex/);
  assert.match(rule('.dj-view'), /flex-direction: column/);
  assert.match(rule('.dj-view'), /overflow: hidden/);
  assert.match(rule('.dj-view__head'), /flex: none/);
  assert.match(rule('.dj-view__body'), /overflow-y: auto/);
  assert.match(rule('.dj-view__body'), /scrollbar-width: thin/);
  assert.match(rule('.dj-view__body'), /min-height: 0/);
});

test('the close glyph sits on the title row: small, round, no full-width bar, no native tooltip', () => {
  const head = jsx.slice(jsx.indexOf('className="dj-view__head"'), jsx.indexOf('className="dj-view__body"'));
  assert.match(head, /className="dj-view__title"/);
  assert.match(head, /className="dj-x" aria-label=\{w\('close'\)\}/);
  assert.doesNotMatch(head, /title="close"/, 'no native tooltip over the title');
  const x = rule('.dj-x');
  assert.match(x, /width: 28px/);
  assert.match(x, /border-radius: 50%/);
  assert.match(x, /background: transparent/);
  assert.doesNotMatch(x, /position: sticky|float:/);
  assert.match(css, /\.dj-x:focus-visible \{[^}]*outline: 2px solid/);
});

test('the title names the mode playing, its beat and carrier, from the same state the DJ line reads', () => {
  const h = djHeadline({ modeName: 'SHUFFLE · ALPHA CALM', beat: 10, carrier: 216, status: 'playing' });
  assert.equal(h.title, 'SHUFFLE · ALPHA CALM');
  assert.equal(h.sub, '10 Hz beat · carrier 216.0 Hz · playing');
  const f = djHeadline({ modeName: null, beat: 40, carrier: 216, status: 'stopped', fallback: 'FLUTE MODE' });
  assert.equal(f.title, 'FLUTE MODE', 'outside the site the library keeps its own name');
  assert.match(jsx, /djHeadline\(\{ modeName, beat: state\?\.beat, carrier: state\?\.carrier/);
});

test('the p-bit track is as wide as its sweeps: no fixed 24 columns, unrevealed cells draw nothing', () => {
  assert.equal(traceColumns(24), 'repeat(24, minmax(4px, 14px))');
  assert.equal(traceColumns(0), 'repeat(1, minmax(4px, 14px))');
  assert.doesNotMatch(css, /repeat\(24, 1fr\)/);
  assert.match(jsx, /gridTemplateColumns: traceColumns\(tr\.length\)/);
  assert.match(rule('.dj-trace__cell'), /background: transparent/);
});

test('it closes with a short fade and fold, instantly under reduced motion, and focus goes back to the DJ line', () => {
  assert.match(css, /@keyframes dj-out/);
  assert.match(css, /\.dj-view--closing \{[^}]*animation: dj-out/);
  assert.match(css, /prefers-reduced-motion: reduce\)[\s\S]*\.dj-view,\s*\.dj-view--closing \{ animation: none; \}/);
  assert.match(jsx, /toggleRef\.current\?\.focus\(\)/);
});
