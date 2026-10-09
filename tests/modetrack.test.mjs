// EVERY TRACK IS THE DJ'S (lane DJSILENCE, navigator 2026-10-07: "assume the DJ PLAYS EVERYTHING ... the controls are
// the same for each track"): a binaural mode has its own track tag in the shape of THE DJ's tags, so the set history
// treats a mode as a set: NEXT and PREV move through every kind, and a mode is a new set whenever the mode changes.
// Each test fails on the code before this lane: modes.js had no track tag and setIdOf read a mode's tag as nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODE_KEYS, modeTrackTag, modeOfTrackTag, modeTrackName, setIdOf, isNewSet, createSetHistory } from '../src/index.js';

test('a mode\'s track tag: one per mode, in THE DJ\'s tag shape, and it reads back to its mode', () => {
  assert.ok(MODE_KEYS.length >= 7);
  const tags = MODE_KEYS.map((k) => modeTrackTag(k));
  assert.equal(new Set(tags).size, MODE_KEYS.length, 'two modes share a tag');
  for (const [i, k] of MODE_KEYS.entries()) {
    assert.match(tags[i], /^[A-Z]{4}\.mode\.v1\.[0-9A-Z]+$/, k);
    assert.equal(modeOfTrackTag(tags[i]), k);
  }
  assert.equal(modeTrackTag('schumann'), 'SCHU.mode.v1.144B783');
  assert.equal(modeTrackTag('nope'), null);
  for (const bad of [null, '', 'SCHU.mode.v1.144B700', 'GAMM.mode.v1.144B783', 'HIGH.house.v1.4KM0NBPG769P']) assert.equal(modeOfTrackTag(bad), null, bad);
});

test('a mode\'s track is named by the mode and its beat', () => {
  assert.deepEqual(modeTrackName('schumann'), ['SCHUMANN 7.83 Hz']);
  assert.deepEqual(modeTrackName('gamma-focus'), ['GAMMA FOCUS', '40 Hz']);
  assert.deepEqual(modeTrackName('nope'), []);
});

test('the set history takes a mode as a set: a new mode is a new set, the same mode is not, a DJ set after a mode is new', () => {
  const s = setIdOf(modeTrackTag('alpha-calm'));
  assert.equal(s?.mode, 'alpha-calm');
  assert.equal(isNewSet(s, setIdOf(modeTrackTag('alpha-calm'))), false);
  assert.equal(isNewSet(s, setIdOf(modeTrackTag('theta-deep'))), true);
  const djSet = { opener: false, theme: 'highlands', set: 3, setBar: 0, pure: false };
  assert.equal(isNewSet(s, djSet), true, 'THE DJ\'s set after a mode');
  assert.equal(isNewSet(djSet, s), true, 'a mode after THE DJ\'s set');
  const h = createSetHistory();
  const A = modeTrackTag('alpha-calm');
  const B = modeTrackTag('theta-deep');
  assert.equal(h.observe(A, { kind: 'mode', mode: 'alpha-calm' }), 'new');
  assert.equal(h.observe(A, { kind: 'mode', mode: 'alpha-calm' }), null, 'the same mode on a later bar is the same track');
  assert.equal(h.observe(B, { kind: 'mode', mode: 'theta-deep' }), 'new');
  assert.equal(h.canBack, true);
  const back = h.back();
  assert.equal(back.tag, A, 'PREV goes back to the first mode');
  assert.equal(h.observe(A, { kind: 'mode', mode: 'alpha-calm' }), 'replay');
});
