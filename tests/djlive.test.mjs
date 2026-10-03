// THE DJ's public state (lane FEEDBACKRL): a read-only copy of what the hero symphony plays, written on every emit and
// cleared on dispose. The ratings popup names this exact combination; nothing here steers the DJ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSymphony, djLive, djSnapshot, DJ_IDLE, themeOf } from '../src/index.js';

test('djSnapshot keeps plain data only and reads a missing state as idle', () => {
  assert.deepEqual(djSnapshot(null), DJ_IDLE);
  assert.deepEqual(djSnapshot('x'), DJ_IDLE);
  const s = djSnapshot({
    playing: true, audible: true, theme: themeOf('crystals'), beat: 40, carrier: 164.8, bpm: 70.2,
    decision: { mode: 'tune', bar: 7 }, tune: { title: 'The Flowers of Edinburgh', generated: false },
    house: { on: true, keys: ['tape', 'crush'] },
  });
  assert.equal(s.theme, 'crystals');
  assert.equal(s.themeLabel, 'CRYSTALS');
  assert.equal(s.djMode, 'tune');
  assert.equal(s.tune, 'The Flowers of Edinburgh');
  assert.equal(s.beat, 40);
  assert.equal(s.carrier, 164.8);
  assert.deepEqual(s.chain, ['tape', 'crush']);
  assert.equal(s.bar, 7);
  assert.doesNotThrow(() => JSON.stringify(s), 'plain data, sendable');
  const gen = djSnapshot({ tune: { title: null, generated: true }, house: { on: false, keys: ['tape'] } });
  assert.equal(gen.tune, null);
  assert.equal(gen.tuneGenerated, true);
  assert.deepEqual(gen.chain, [], 'no chain is named while the house set is off');
});

test('the symphony writes djLive on emit and clears it on dispose; the copy cannot steer the DJ', () => {
  const seen = [];
  const off = djLive.subscribe((s) => seen.push(s));
  const sym = createSymphony({ seed: 4, theme: 'highlands', auto: false });
  sym.setLevel(0.3);
  const now = djLive.get();
  assert.equal(now.live, true);
  assert.equal(now.theme, 'highlands');
  assert.equal(now.theme, sym.state.theme.key);
  assert.equal(now.beat, sym.state.beat);
  assert.equal(now.carrier, sym.state.carrier);
  now.theme = 'embers';
  assert.equal(sym.state.theme.key, 'highlands', 'editing the copy changes nothing');
  sym.dispose();
  assert.deepEqual(djLive.get(), DJ_IDLE);
  assert.ok(seen.length >= 2);
  off();
});
