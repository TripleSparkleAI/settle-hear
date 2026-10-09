// THE DJ VIEW AS A POPUP (lane HOUSEDJ round 2): a click outside closes it, a click inside does not, Escape closes it,
// the x closes it, another hero popover or the bar closes it; and the React part is wired to exactly this rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { djPopupStep } from '../src/index.js';

const jsx = readFileSync(new URL('../react/Symphony.jsx', import.meta.url), 'utf8');

test('the rule: toggle opens and closes; outside, Escape, the x and dismiss close; inside keeps it open', () => {
  const open = djPopupStep(false, { type: 'toggle' });
  assert.equal(open, true);
  assert.equal(djPopupStep(open, { type: 'toggle' }), false);
  assert.equal(djPopupStep(open, { type: 'outside', inside: false }), false, 'a click outside closes it');
  assert.equal(djPopupStep(open, { type: 'outside', inside: true }), true, 'a click inside (a toggle, a slider) keeps it');
  assert.equal(djPopupStep(open, { type: 'escape' }), false, 'Escape closes it');
  assert.equal(djPopupStep(open, { type: 'close' }), false, 'the x closes it');
  assert.equal(djPopupStep(open, { type: 'dismiss' }), false, 'another popover or the bar closes it');
  assert.equal(djPopupStep(false, { type: 'outside', inside: false }), false, 'a closed view stays closed');
  assert.equal(djPopupStep(open, { type: 'nonsense' }), true);
});

test('the wiring: a document pointerdown while open, judged against the panel and its toggle (not the .dj root), Escape, the x, and closeWhen', () => {
  assert.match(jsx, /const inside = djInside\(e\.target, \{ view: viewRef\.current, toggle: toggleRef\.current \}\);/);
  assert.match(jsx, /step\(\{ type: 'outside', inside \}\);/);
  assert.doesNotMatch(jsx, /djRoot\.current\?\.contains\(e\.target\)/, 'the root box itself is not inside (lane DJRATELINE)');
  assert.match(jsx, /document\.addEventListener\('pointerdown', down\);/);
  assert.match(jsx, /document\.removeEventListener\('pointerdown', down\);/, 'the listener goes when it closes');
  assert.match(jsx, /if \(!open\) return undefined;/, 'listening only while open');
  assert.match(jsx, /if \(e\.key === 'Escape'\) closeTo\('escape'\);/);
  assert.match(jsx, /<button type="button" className="dj-x" aria-label=\{w\('close'\)\} onClick=\{\(\) => closeTo\('close'\)\}>×<\/button>/);
  assert.match(jsx, /const closeTo = \(type\) => \{ step\(\{ type \}\); toggleRef\.current\?\.focus\(\); \};/);
  assert.match(jsx, /useEffect\(\(\) => \{ if \(closeWhen\) step\(\{ type: 'dismiss' \}\); \}, \[closeWhen\]\);/);
  assert.doesNotMatch(jsx, /setOpen\(\(o\) => !o\)/, 'every toggle goes through the rule');
});
