// 432 Hz McKUSKER MODE (lane McKUSKER, navigator 2026-10-05): the symphony says when the flute plays the melody
// (state.melody and djLive.melody), and one mute closes that voice alone, at once, without touching the DJ's plan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, all, reach } from './fakeaudio.mjs';
import {
  configure, unlockNow, createSymphony, djLive, djSnapshot, DJ_IDLE, melodyOf, melodyMute, MCKUSKER_VOICES,
  MCKUSKER_MODE_NAME, FLUTE_MODE_NAME, createVoiceBuses, createMixSet, SYMPHONY_SLOTS,
} from '../src/index.js';

// a sounding oscillator reaches the speakers; an LFO only reaches a parameter's depth gain
const audibleOsc = (o) => [...reach(o)].some((n) => n.kind === 'destination');
const lastValue = (param) => (param.events.length ? param.events[param.events.length - 1][1] : param.value);

test('the name is one constant beside the mode\'s other names, and reads as the navigator gave it', () => {
  assert.equal(MCKUSKER_MODE_NAME, '432 Hz McKUSKER MODE');
  assert.notEqual(MCKUSKER_MODE_NAME, FLUTE_MODE_NAME, 'the tag is its own name, not the 40 Hz mode\'s');
});

test('melodyOf: present only while a flute plays the melody part this bar and the symphony is heard', () => {
  const base = { audible: true, opener: false, flute: true };
  assert.deepEqual(melodyOf({ ...base, pure: true, tuneRunning: true }), { voice: 'flute', present: true });
  assert.equal(melodyOf({ ...base, pure: true, tuneRunning: false }).present, false, 'a rest between tunes');
  assert.equal(melodyOf({ ...base, mode: 'tune', voice: 'flute' }).present, true);
  assert.equal(melodyOf({ ...base, mode: 'tune', voice: 'flute-drive' }).present, true, 'the distorted flute is a flute');
  assert.equal(melodyOf({ ...base, mode: 'bed', voice: 'flute' }).present, false, 'no melody in a bed bar');
  assert.equal(melodyOf({ ...base, house: true, leadOn: true, voice: 'flute' }).present, true);
  assert.equal(melodyOf({ ...base, house: true, leadOn: false, voice: 'flute' }).present, false, 'the LEAD layer is out');
  assert.equal(melodyOf({ ...base, house: true, leadOn: true, voice: 'keys' }).present, false, 'keys are not a flute');
  assert.equal(melodyOf({ ...base, audible: false, pure: true, tuneRunning: true }).present, false, 'paused or muted');
  assert.equal(melodyOf({ ...base, opener: true, pure: true, tuneRunning: true }).present, false, 'the opening blend');
  assert.equal(melodyOf({ ...base, flute: false, mode: 'tune', voice: 'flute' }).present, false, 'steered out');
  assert.deepEqual([...MCKUSKER_VOICES], ['flute', 'flute-drive']);
});

test('djSnapshot carries melody as plain data and DJ_IDLE has none', () => {
  assert.equal(DJ_IDLE.melody, null);
  const s = djSnapshot({ melody: { voice: 'flute', present: 1, muted: 0, extra: 'x' }, house: {} });
  assert.deepEqual(s.melody, { voice: 'flute', present: true, muted: false });
});

test('the voice buses: a slot mute closes that bus alone, after its chain, and a later bus is born muted', () => {
  const ctx = new Ctx();
  const out = ctx.createGain();
  const buses = createVoiceBuses(ctx, out, SYMPHONY_SLOTS);
  const leadIn = buses.input('lead', 0);
  const harpIn = buses.input('harp', 0);
  const gateOf = (input) => [...reach(input)].find((n) => n.kind === 'gain' && n.out.has(out));
  const leadGate = gateOf(leadIn);
  const harpGate = gateOf(harpIn);
  assert.ok(leadGate && harpGate && leadGate !== harpGate, 'each bus ends in its own gate before the out');
  buses.mute('lead', true, 1);
  assert.equal(lastValue(leadGate.gain), 0, 'the lead closes');
  assert.equal(lastValue(harpGate.gain), 1, 'the harp stays open');
  assert.equal(buses.muted('lead'), true);
  buses.mute('bells', true, 1);
  const bellsGate = gateOf(buses.input('bells', 2));
  assert.equal(lastValue(bellsGate.gain), 0, 'a bus built after its mute is born closed');
  buses.mute('lead', false, 3);
  assert.equal(lastValue(leadGate.gain), 1, 'and opens again');
  buses.dispose();
});

test('the house set exposes muteSlot for its lead bus and it never throws', () => {
  const ctx = new Ctx();
  const out = ctx.createGain();
  const set = createMixSet(ctx, out, { seed: 3 });
  assert.equal(typeof set.muteSlot, 'function');
  assert.doesNotThrow(() => set.muteSlot('lead', true, 0));
  set.dispose();
});

test('THE McKUSKER FLUTE: present while it plays, the mute closes the flute alone at once, and brings it back', () => {
  configure({ createContext: () => new Ctx() });
  melodyMute.set(false);
  const born = all.length;
  const s = createSymphony({ seed: 4, theme: 'cathedral', auto: false, pure: true, steer: null, votes: null });
  const E = unlockNow();
  let present = false;
  for (let k = 0; k < 24 && !present; k++) { E.ctx.currentTime += 0.5; s.tick(); present = s.state.melody.present; }
  assert.equal(present, true, 'the flute is playing the melody');
  assert.equal(s.state.melody.voice, 'flute');
  assert.equal(djLive.get().melody.present, true, 'djLive carries it');
  const tagBefore = s.state.tag;
  const mine = () => all.slice(born);
  const notes = mine().filter((n) => n.kind === 'osc' && n.started && n.stopped && audibleOsc(n));
  const held = mine().filter((n) => n.kind === 'osc' && n.started && !n.stopped && audibleOsc(n)); // the drone, the pair, the harmonics
  assert.ok(notes.length > 0 && held.length > 0);
  const before = new Map(mine().filter((n) => n.gain).map((n) => [n, n.gain.events.length]));
  melodyMute.set(true);
  const moved = [...before].filter(([n, len]) => n.gain.events.length > len).map(([n]) => n);
  assert.ok(moved.length >= 1, 'the mute moved a gain at once, not on the next bar');
  assert.ok(moved.every((g) => lastValue(g.gain) === 0), 'the flute\'s gate closes');
  assert.ok(moved.every((g) => notes.some((o) => reach(o).has(g))), 'the gate sits on the flute notes\' path');
  assert.ok(moved.every((g) => held.every((o) => !reach(o).has(g))), 'no drone, pair or harmonic passes it');
  assert.equal(s.state.melody.muted, true);
  assert.equal(s.state.melody.present, true, 'still present: the DJ plays on, so the tag stays to bring it back');
  assert.equal(djLive.get().melody.muted, true);
  assert.equal(s.state.tag, tagBefore, 'the DJ\'s plan is untouched');
  melodyMute.set(false);
  assert.ok(moved.every((n) => lastValue(n.gain) === 1), 'and opens again');
  assert.equal(s.state.melody.muted, false);
  s.dispose();
});

test('a symphony born while muted starts with the flute closed, and MUTE ALL is not touched by the melody mute', () => {
  configure({ createContext: () => new Ctx() });
  melodyMute.set(true);
  const born = all.length;
  const s = createSymphony({ seed: 9, theme: 'highlands', auto: false, pure: true, steer: null, votes: null });
  const E = unlockNow();
  const masterBefore = E.master.gain.value;
  for (let k = 0; k < 12; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  assert.equal(s.state.melody.muted, true, 'the mute holds for the visit');
  assert.equal(s.state.muted, false, 'MUTE ALL is the engine\'s and stays as it was');
  assert.equal(E.master.gain.value, masterBefore);
  const notes = all.slice(born).filter((n) => n.kind === 'osc' && n.started && n.stopped && audibleOsc(n));
  assert.ok(notes.length > 0, 'the DJ still schedules the flute');
  const closed = all.slice(born).filter((n) => n.kind === 'gain' && n.gain.value === 0 && notes.every((o) => reach(o).has(n)));
  assert.ok(closed.length >= 1, 'every flute note is born behind a closed gate');
  s.setMelodyMute(false);
  assert.equal(melodyMute.get(), false, 'setMelodyMute writes the one store');
  s.dispose();
});
