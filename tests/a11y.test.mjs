// THE SOUND CONTROLS ARE KEYBOARD CONTROLS WITH CLEAR NAMES (lane A11YSOUND, navigator 2026-10-04: "do accessibility for
// all, for disabled users ... all the sound things importantly work with the keyboard and are clearly labelled").
// The React file is JSX, which node cannot import, so the spoken values live in react/a11y.js (imported here) and the
// markup is checked by reading the source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { percentText, hertzText, muteAllTitle } from '../react/a11y.js';

const jsx = readFileSync(new URL('../react/Hear.jsx', import.meta.url), 'utf8');
const between = (a, b) => jsx.slice(jsx.indexOf(a), jsx.indexOf(b, jsx.indexOf(a)));

test('a level is spoken as a percent and the tone as hertz', () => {
  assert.equal(percentText(0.8), '80 percent');
  assert.equal(percentText(0), '0 percent');
  assert.equal(percentText(1), '100 percent');
  assert.equal(percentText(0.333), '33 percent');
  assert.equal(hertzText(12000), '12000 hertz');
  assert.equal(hertzText(9000.4), '9000 hertz');
});

test('MUTE ALL names its key in the tooltip only when the page gives one', () => {
  assert.equal(muteAllTitle('Sound is on.', null), 'Sound is on.');
  assert.equal(muteAllTitle('Sound is on.', 'M'), 'Sound is on. Key: M.');
  assert.equal(muteAllTitle('Sound is on.', 'M', 'Taste: {key}.'), 'Sound is on. Taste: M.');
});

test('MUTE ALL: one fixed name, its state in aria-pressed, an id a skip link can reach, its key in aria-keyshortcuts', () => {
  const body = between('export function MuteAllButton', '\nexport function HearSettle');
  assert.match(body, /<button\s+id=\{id\}/);
  assert.match(body, /id = 'hear-muteall'/);
  assert.match(body, /aria-pressed=\{muted\}/);
  assert.match(body, /aria-label=\{L\.aria\}/, 'the name changed with the state');
  assert.match(body, /aria-keyshortcuts=\{shortcut \|\| undefined\}/);
});

test('every mixer slider and the master fader speak their value with its unit', () => {
  const mixer = between('export function HearMixer', '\nexport function MasterFader');
  assert.match(mixer, /aria-valuetext=\{max > 1 \? U\.hertz\(value\) : U\.percent\(value\)\}/);
  assert.match(mixer, /type="range"/);
  const master = between('export function MasterFader', '\nexport function useGammaSound');
  assert.match(master, /aria-valuetext=\{U\.level\(v\)\}/, 'the master speaks its level 0 to 1 (lane VOLUMECURVE)');
  assert.match(master, /aria-label=\{label\}/);
});

test('the play toggle is a real button with aria-pressed and translatable words', () => {
  const body = between('export function HearToggle', '\n// labels (optional');
  assert.match(body, /<button\s+type="button"/);
  assert.match(body, /aria-pressed=\{playing && !muted\}/);
  assert.match(body, /aria-label=\{W\.name\(label\)\}/);
  assert.match(jsx, /export const TOGGLE_WORDS = \{/);
  assert.match(jsx, /<HearToggle hear=\{H\} label=\{what\} words=\{hearWords\}/);
});
