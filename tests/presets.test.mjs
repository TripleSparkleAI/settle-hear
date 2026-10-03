// The presets: every one names real voices at sane levels, and the hero is the loudest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, DEMOS, ALL, resolvePreset } from '../src/presets.js';
import { VOICES, VOICE_NOTES } from '../src/voices.js';

test('five presets and six demos, every voice real and documented, every level in [0, 1]', () => {
  assert.deepEqual(Object.keys(PRESETS), ['crackle', 'choir', 'drone', 'chime', 'pulse']);
  assert.equal(Object.keys(DEMOS).length, 6);
  for (const [name, p] of Object.entries(ALL)) {
    assert.ok(p.note && p.note.length > 10, `${name} has a note`);
    assert.ok(p.level > 0 && p.level <= 1, `${name} level`);
    for (const [v, x] of Object.entries(p.voices)) {
      assert.ok(VOICES.includes(v), `${name}: ${v} is a voice`);
      assert.ok(x >= 0 && x <= 1, `${name}.${v}`);
    }
    for (const k of ['reverb', 'delay']) assert.ok(p.fx[k] >= 0 && p.fx[k] <= 1, `${name}.${k}`);
  }
  for (const v of VOICES) assert.ok(VOICE_NOTES[v], `${v} says what it follows`);
});

test('the hero is the loudest and the fullest setup', () => {
  const others = Object.entries(ALL).filter(([k]) => k !== 'hero');
  assert.ok(others.every(([, p]) => p.level < DEMOS.hero.level));
  assert.equal(Object.keys(DEMOS.hero.voices).length, VOICES.length);
});

test('resolvePreset copies (so edits never leak into the table) and merges custom mixes', () => {
  const a = resolvePreset('choir');
  a.voices.choir = 0;
  assert.equal(PRESETS.choir.voices.choir, 0.85);
  const c = resolvePreset({ voices: { drone: 1, nonsense: 1 }, fx: { reverb: 0.9 } });
  assert.deepEqual(c.voices, { drone: 1 });
  assert.equal(c.fx.reverb, 0.9);
  assert.throws(() => resolvePreset('nope'), /no preset called nope/);
});
