// THE FLUTE STARTS OFF (navigator, 2026-10-07: "can we have the McKusker flute mode off by default", "a bit much with
// the flute"). A fresh page's melody mute store reads muted, so 432 Hz McKUSKER MODE shows OFF until it is pressed.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('a fresh page starts with the flute muted', async () => {
  const { melodyMute } = await import(`../src/melody.js?fresh=${Date.now()}`);
  assert.equal(melodyMute.get(), true);
});
