// settle-hear · THE DJ's OVERDRIVE AND VOCODER, loaded on demand (lane DJOVERDRIVE): the valve, the vocoder and the
// colour stage live in dj-colour-stage.js, fetched the first time the sound starts, so the site's first load does not
// carry them. Before they arrive nothing is built and nothing is named; once they arrive the next bar builds them.
// This file never loads the module before its first test, so the "before" state is real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Ctx } from './fakeaudio.mjs';
import { fxValues, moodOf, createFxBus, colourBuses, colourNow, loadColour, createVoiceBuses, SYMPHONY_SLOTS } from '../src/index.js';

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');

test('THE FIRST LOAD: nothing statically imports the audio half; the index re-exports the light half only', () => {
  for (const f of ['index.js', 'symphony-index.js', 'symphony.js', 'dj-fx.js', 'dj-colour.js', 'mix-layers.js']) {
    assert.doesNotMatch(src(f), /from '\.\/dj-colour-stage\.js'/, `${f} imports dj-colour-stage.js statically`);
  }
  assert.match(src('dj-colour.js'), /import\('\.\/dj-colour-stage\.js'\)/, 'dj-colour.js fetches it on demand');
});

test('BEFORE IT ARRIVES the bus plays without its valve and a voice plays dry; the next apply after it arrives builds both', async () => {
  assert.equal(colourNow(), null, 'not loaded at the start of this file');
  const ctx = new Ctx();
  const master = ctx.createGain();
  const bus = createFxBus({ ctx, master });
  bus.apply(fxValues(moodOf('overdrive')), 0);
  assert.equal(bus.nodes.tube, null, 'no valve before the module arrives');
  const buses = colourBuses(createVoiceBuses(ctx, ctx.createGain(), SYMPHONY_SLOTS), ctx);
  buses.colour({ lead: { drive: { amount: 0.6, gain: 3 } } }, 0);
  assert.deepEqual(Object.keys(buses.colourStages()), [], 'no stage before the module arrives');
  const m = await loadColour();
  assert.equal(colourNow(), m);
  assert.equal(await loadColour(), m, 'one fetch for every caller');
  bus.apply(fxValues(moodOf('overdrive')), 1);
  assert.ok(bus.nodes.tube, 'the next bar builds the valve');
  buses.colour({ lead: { drive: { amount: 0.6, gain: 3 } } }, 1);
  assert.deepEqual(Object.keys(buses.colourStages()), ['lead'], 'the next bar builds the stage');
});
