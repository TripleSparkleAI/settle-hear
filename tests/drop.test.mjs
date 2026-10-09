// THE DROP (lane HERODRAGFIX): a dropped box's four noises are one event. The first noise takes THE CLICK LOCK once,
// all four play one click noise brought to the drop's target peak, a sword or radial card the lock holds plays once
// WITH them and never instead, and every refusal (THE NOISE GATE, MUTE ALL) is told. Each test here fails on the code
// before the lane: there a drop was four separate clicks, a sword card replaced the noises, and a refusal said nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, all } from './fakeaudio.mjs';
import {
  configure, unlockNow, getEngine, sound, CLICK_NOISES, armClickNoises, onClickNoise, onSfx, loadSfxModules,
  createClickCards, DROP, DROP_PEAK_DB, DROP_CARDS, dropGainDb, clickGainDb, playClickNoise, playDropNoise, onDropSound,
} from '../src/index.js';

if (!Ctx.prototype.createConstantSource) {
  Ctx.prototype.createConstantSource = function () {
    const n = this.createBufferSource();
    n.kind = 'src';
    n.offset = n.playbackRate;
    return n;
  };
}
await loadSfxModules();
configure({ createContext: () => new Ctx() });
unlockNow();
sound.setMuted(false);

const mkWin = () => {
  const ls = {};
  return { ls, win: { innerWidth: 1000, scrollX: 0, addEventListener: (k, fn) => { ls[k] = fn; }, removeEventListener: (k) => { delete ls[k]; } } };
};
// one drop's four births, as settle-see sends them (global.js ripple detail with drag and part)
const births = (ls, drag, { sound: loud = true, source = 'hero' } = {}) => {
  for (let part = 0; part < 4; part++) ls['settle:ripple']({ detail: { x: 500, y: 10, strength: 0.6, kind: 'drop', scope: 'local', source, sound: loud, drag, part } });
};
// a seed whose first lock deals a card of this kind (createClickCards is exactly the lock's cycle)
const seedFor = (want) => {
  for (let s = 1; s < 5000; s++) {
    const v = createClickCards({ clickCount: CLICK_NOISES.length, seed: s }).next();
    if (want === 'click' ? Number.isInteger(v) && DROP_CARDS.includes(v) : want === 'quiet' ? Number.isInteger(v) && !DROP_CARDS.includes(v) : v && typeof v === 'object' && v.deck === want) return s;
  }
  throw new Error(`no seed deals a ${want} first`);
};

test('THE DROP\'s level: every card has a measured peak; the drop cards are the ones 12 dB or less from the target', () => {
  assert.equal(DROP.targetPeakDb, -16);
  for (const n of CLICK_NOISES) assert.ok(Number.isFinite(DROP_PEAK_DB[n.name]), `${n.name} measured`);
  assert.equal(Object.keys(DROP_PEAK_DB).length, CLICK_NOISES.length);
  for (const k of DROP_CARDS) {
    assert.ok(dropGainDb(k) <= DROP.maxGainDb, `${CLICK_NOISES[k].name} needs ${dropGainDb(k)} dB`);
    assert.ok(Math.abs(DROP_PEAK_DB[CLICK_NOISES[k].name] + dropGainDb(k) - DROP.targetPeakDb) < 1e-9, 'the gain lands it on the target');
  }
  const quiet = CLICK_NOISES.map((n, k) => k).filter((k) => !DROP_CARDS.includes(k)).map((k) => CLICK_NOISES[k].name).sort();
  assert.deepEqual(quiet, ['blip', 'chirp down', 'chirp up', 'tick air', 'tick high', 'tick low', 'wood block'], 'the quiet seven give way');
});

test('a drop is ONE event: four births take the lock once and play one card four times, at the drop\'s level', () => {
  const { ls, win } = mkWin();
  const heard = [];
  const told = [];
  const offN = onClickNoise((d) => heard.push(d));
  const offD = onDropSound((d) => told.push(d));
  let clock = 1000;
  const off = armClickNoises({ win, seed: seedFor('click'), now: () => clock });
  const start = all.length;
  births(ls, 1);
  assert.equal(heard.length, 4, 'four noises');
  assert.equal(new Set(heard.map((d) => d.index)).size, 1, 'one card');
  assert.ok(heard.every((d) => d.drop === true), 'each is a drop noise');
  assert.ok(heard.every((d) => d.locked === false), 'the lock was taken once: no birth replayed it');
  assert.deepEqual(heard.map((d) => d.part), [0, 1, 2, 3]);
  const g = Math.pow(10, dropGainDb(heard[0].index) / 20);
  const outs = all.slice(start).filter((n) => n.kind === 'gain' && Math.abs(n.gain.value - g) < 1e-9);
  assert.equal(outs.length, 4, 'each noise leaves through the drop gain');
  assert.deepEqual(told.map((d) => d.ok), [true, true, true, true]);
  // a click within the quiet period replays the same lock: a click then a drop share one sound
  clock += 300;
  births(ls, 2);
  assert.equal(heard[4].index, heard[0].index, 'the next drop in the burst replays the lock');
  assert.equal(heard[4].locked, true);
  off(); offN(); offD();
});

test('a sword card plays WITH the drop\'s noises, once, never instead of them', () => {
  const { ls, win } = mkWin();
  const heard = [];
  const swords = [];
  const offN = onClickNoise((d) => heard.push(d));
  const offS = onSfx((d) => swords.push(d));
  const off = armClickNoises({ win, seed: seedFor('sword'), now: () => 5000 });
  births(ls, 7);
  assert.equal(swords.length, 1, 'the sword plays once');
  assert.equal(swords[0].deck, 'sword');
  assert.equal(swords[0].reason, 'drop');
  const clicks = heard.filter((d) => d.index >= 0);
  assert.equal(clicks.length, 4, 'and the four click noises still play');
  assert.ok(DROP_CARDS.includes(clicks[0].index), 'from the drop cards');
  off(); offN(); offS();
});

test('a quiet locked card gives way to a drop card; the drop is never one of the quiet seven', () => {
  const { ls, win } = mkWin();
  const heard = [];
  const offN = onClickNoise((d) => heard.push(d));
  const off = armClickNoises({ win, seed: seedFor('quiet'), now: () => 9000 });
  births(ls, 3);
  assert.equal(heard.length, 4);
  assert.ok(DROP_CARDS.includes(heard[0].index), `${CLICK_NOISES[heard[0].index].name} is a drop card`);
  off(); offN();
});

test('every refusal is told: THE NOISE GATE and MUTE ALL never leave a drop silent without a word', () => {
  const { ls, win } = mkWin();
  const told = [];
  const offD = onDropSound((d) => told.push(d));
  const off = armClickNoises({ win, seed: 11, now: () => 12000 });
  births(ls, 4, { sound: false });
  assert.deepEqual(told.map((d) => d.reason), ['gate', 'gate', 'gate', 'gate']);
  told.length = 0;
  sound.setMuted(true);
  const before = all.length;
  births(ls, 5);
  assert.equal(all.length, before, 'muted: nothing built');
  assert.deepEqual(told.map((d) => [d.ok, d.reason]), Array(4).fill([false, 'muted']));
  sound.setMuted(false);
  off(); offD();
});

test('playDropNoise without a drag id is a drop of its own each time (an old caller still sounds)', () => {
  const a = playDropNoise({ pan: 0 });
  assert.ok(a && a.drop === true);
  assert.ok(DROP_CARDS.includes(a.index));
  assert.ok(getEngine());
});

// THE CLICK'S LEVEL (lane HEROPASS): a single click is evened out by the drop's table, so the card the lock deals no
// longer decides whether a click is heard. Red on the code before: a click left through a gain of 1 whatever its card.
test('a single click of every card leaves through the drop table\'s gain, capped at DROP.maxGainDb', () => {
  const spread = [];
  for (let k = 0; k < CLICK_NOISES.length; k++) {
    const want = Math.min(DROP.maxGainDb, DROP.targetPeakDb - DROP_PEAK_DB[CLICK_NOISES[k].name]);
    assert.ok(Math.abs(clickGainDb(k) - want) < 1e-9, `${CLICK_NOISES[k].name}: ${clickGainDb(k)} dB`);
    const start = all.length;
    const d = playClickNoise({ index: k, strength: 0.6 });
    assert.ok(d, 'played');
    assert.equal(d.gainDb, clickGainDb(k), 'the click names its gain');
    const g = Math.pow(10, want / 20);
    assert.ok(all.slice(start).some((n) => n.kind === 'gain' && Math.abs(n.gain.value - g) < 1e-9), `${CLICK_NOISES[k].name} leaves through its gain`);
    spread.push(DROP_PEAK_DB[CLICK_NOISES[k].name] + clickGainDb(k));
  }
  // the spread of the cards' peaks, before and after: 21.3 dB of lottery shrinks to what the cap leaves
  const before = Math.max(...Object.values(DROP_PEAK_DB)) - Math.min(...Object.values(DROP_PEAK_DB));
  const after = Math.max(...spread) - Math.min(...spread);
  const quietest = Math.min(...Object.values(DROP_PEAK_DB));
  assert.ok(Math.abs(after - (DROP.targetPeakDb - (quietest + DROP.maxGainDb))) < 1e-9, `the card spread is what the cap leaves: ${after.toFixed(1)} dB`);
  assert.ok(after < before, `the card spread ${after.toFixed(1)} dB, was ${before.toFixed(1)}`);
  assert.equal(clickGainDb(-1), 0, 'a card the table does not hold is left at its own level');
});
