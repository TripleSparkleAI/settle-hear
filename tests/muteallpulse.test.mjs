// THE BLOCKED PULSE (lane AUTOSTART): MUTE ALL wears the blocked pulse only while the browser holds the sound back,
// never when the visitor muted, never once the sound plays; the reduced-motion rule turns it into a steady highlight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { muteAllPulseClass } from '../react/muteall.js';

test('the blocked pulse appears only while blocked', () => {
  assert.equal(muteAllPulseClass({ blocked: true }), ' hear-muteall--blocked');
  assert.equal(muteAllPulseClass({ blocked: true, muted: true }), '', 'a muted visitor saw the waiting pulse');
  assert.equal(muteAllPulseClass({ blocked: true, unlocked: true }), '', 'the pulse outlived the start');
  assert.equal(muteAllPulseClass({ blocked: false }), '');
  assert.equal(muteAllPulseClass({ blocked: false, pulse: true }), ' hear-muteall--pulse', 'the first-load pulse still works');
  assert.equal(muteAllPulseClass({ blocked: true, pulse: true }), ' hear-muteall--blocked', 'blocked wins over the first-load pulse');
});

const css = readFileSync(new URL('../react/hear.css', import.meta.url), 'utf8');
const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

test('the pulse moves only opacity and transform (the compositor runs it), in the prime red', () => {
  for (const name of ['hear-wait-glow', 'hear-wait-ring']) {
    const body = css.slice(css.indexOf(`@keyframes ${name}`), css.indexOf('}\n}', css.indexOf(`@keyframes ${name}`)));
    assert.ok(body.length > 20, name);
    assert.doesNotMatch(body, /box-shadow|filter|width|height|top|left/, `${name} animates a property that repaints`);
  }
  assert.match(css, /--hear-wait:\s*var\(--prime/);
});

test('reduced motion: the blocked glow and ring stop and hold a steady highlight', () => {
  assert.match(reduced, /\.hear-muteall--blocked::before\s*\{[^}]*animation:\s*none/);
  assert.match(reduced, /\.hear-muteall__halo\s*\{[^}]*animation:\s*none[^}]*opacity:\s*1/);
});

test('the hover and focus words are shown from the button\'s data-tip', () => {
  assert.match(css, /\.hear-muteall--blocked\[data-tip\]:hover::after,\s*\n\.hear-muteall--blocked\[data-tip\]:focus-visible::after\s*\{[^}]*content:\s*attr\(data-tip\)/);
  const jsx = readFileSync(new URL('../react/Hear.jsx', import.meta.url), 'utf8');
  assert.match(jsx, /data-tip=\{waits \? L\.tipBlocked : undefined\}/);
  assert.match(jsx, /aria-live="polite"/);
});
