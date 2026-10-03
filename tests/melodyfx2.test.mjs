// THE VOICE CHAINS, EVERYWHERE (lane MELODYFX2, 2026-10-04): every instrument that plays a melody, in every mode,
// plays through a chain that starts with a warm drive; the clear flute is the one exception; a processed flute is
// dealt wherever the clear flute can play; every melody-suitable rack effect is in the pool and comes round; the
// opener's bells take gentle effects only; the jam builds one chain per instrument, never one per note.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, all } from './fakeaudio.mjs';
import {
  configure, unlockNow, createSymphony, sound, createMixSet, createHouseDJ, createHouseSet, rackOf, RACK, CHAIN_KINDS,
  HOUSE_SLOTS, SYMPHONY_SLOTS, SYMPHONY_INSTRUMENTS, VOICE_SLOTS, OPENER_VOICE_SLOTS, JAM_SLOTS, ALL_SLOTS, SLOT_INSTRUMENTS,
  CLEAN_INSTRUMENTS, SATURATOR, POOL_KEYS, POOL_EXCLUDED, CLOCKED_KEYS, GENTLE_POOL, PROFILES, createVoiceDealer,
  realizePalette, specOf, defaultVoice, THEME_KEYS, settleOpener, openerPlan, openerVoices, openerBellVoice,
  JAM_TONAL, JAM_KIT, createJamVoices, playOnEngine, jamVoices, jamCall, jamKey, playBaseBar, createBaseVoices,
  LEVEL_MATCH_DB, levelTrim, VOICE_TRIM, createVoiceBus,
} from '../src/index.js';

const shapersSince = (m) => all.slice(m).filter((n) => n.kind === 'shaper').length;
const heavySince = (m) => all.slice(m).filter((n) => n.kind === 'shaper' || n.kind === 'convolver' || n.kind === 'delay').length;

function assertChained(v, where) {
  if (CLEAN_INSTRUMENTS.has(v.inst)) { assert.equal((v.chain ?? v.keys ?? []).length, 0, `${where}: the clear flute plays dry`); return; }
  const keys = v.chain ? v.chain.map((c) => c.key) : v.keys;
  assert.ok(keys.length >= 3, `${where}: ${keys.length} effects`);
  assert.equal(keys[0], SATURATOR, `${where}: the chain starts with the warm drive`);
}

// a tiny base with a lead and chords, in A minor
const BASE = {
  id: 'test-base', grid: 4, bars: 1, swing: 0, key: { pc: 9, mode: 'aeolian' }, tempo: { bpm: 120, min: 110, max: 130 }, meter: { num: 4, den: 4 },
  parts: {
    kick: { events: [[0, 1, 0.9, 36], [4, 1, 0.9, 36], [8, 1, 0.9, 36], [12, 1, 0.9, 36]] },
    chords: { events: [[0, 8, 0.7, 57], [0, 8, 0.7, 60], [8, 8, 0.7, 64]] },
    lead: { events: [[0, 2, 0.8, 69], [2, 2, 0.8, 72], [4, 4, 0.8, 76], [8, 4, 0.8, 74], [12, 4, 0.8, 72]] },
  },
};

test('THE CENSUS: every melody part of every path is a known slot, and only the lead may be the clear flute', () => {
  assert.deepEqual(VOICE_SLOTS, ['lead', 'arps', 'answer', 'chop', 'fiddle', 'harp', 'bells', 'crystal'], 'the tag\'s eight slots keep their order');
  assert.ok(VOICE_SLOTS.length <= 8, 'the 3-bit slot field');
  for (const slot of [...HOUSE_SLOTS, ...SYMPHONY_SLOTS, ...OPENER_VOICE_SLOTS, ...JAM_SLOTS]) assert.ok(ALL_SLOTS.includes(slot), slot);
  for (const slot of ALL_SLOTS) {
    assert.ok(SLOT_INSTRUMENTS[slot]?.length, `${slot} has instruments`);
    if (slot !== 'lead') assert.ok(!SLOT_INSTRUMENTS[slot].some((i) => CLEAN_INSTRUMENTS.has(i)), `${slot}: never the clear flute`);
    assertChained(defaultVoice(slot), `default ${slot}`);
  }
  assert.deepEqual(Object.values(JAM_TONAL).sort(), [...JAM_SLOTS].sort(), 'each tonal jam hit has its part');
  for (const k of JAM_KIT) if (k.family === 'tone' && k.key !== 'bass') assert.ok(JAM_TONAL[k.key], `${k.key} plays through a chain`);
});

test('A PROCESSED FLUTE wherever the clear flute can play: every list with the clear flute has the distorted one', () => {
  const lists = [SLOT_INSTRUMENTS.lead, SYMPHONY_INSTRUMENTS.lead];
  for (const L of lists) { assert.ok(L.includes('flute')); assert.ok(L.includes('flute-drive'), L.join(', ')); }
  // and over a few deals both come round, in the house lead, the symphony lead and the bases' lead
  for (const [slots, instruments] of [[HOUSE_SLOTS, null], [SYMPHONY_SLOTS, SYMPHONY_INSTRUMENTS], [['lead', 'arps'], null]]) {
    const d = createVoiceDealer({ seed: 9 });
    const seen = new Set();
    for (let i = 0; i < 6; i++) seen.add(d.palette({ theme: THEME_KEYS[i % THEME_KEYS.length], slots, instruments }).voices.find((v) => v.slot === 'lead').inst);
    assert.ok(seen.has('flute') && seen.has('flute-drive'), `${slots.join('+')}: ${[...seen].join(', ')}`);
  }
});

test('THE SYMPHONY plays its tune through the dealt lead: the clear flute meets no drive, the distorted flute does', () => {
  configure({ createContext: () => new Ctx() });
  const E = unlockNow();
  const seen = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const s = createSymphony({ seed, theme: 'highlands', auto: false, steer: null, votes: null });
    for (const k of ['fiddle', 'harp', 'bells', 'crystal', 'drone', 'harmonics', 'binaural']) s.setTrack(k, false);
    s.dj.lockTheme(true);
    s.dj.clamp('flute', true);
    const m0 = all.length;
    for (let k = 0; k < 40; k++) { E.ctx.currentTime += 0.5; s.tick(); }
    const lead = s.state.voices.voices.find((v) => v.slot === 'lead');
    assert.ok(lead, 'the symphony names its lead');
    assert.ok(SYMPHONY_INSTRUMENTS.lead.includes(lead.inst));
    assertChained(lead, `symphony seed ${seed}`);
    assert.ok(s.state.recent.length > 0, 'the tune played');
    // the only part sounding is the tune: a driven lead builds a WaveShaper, the clear flute builds none
    if (CLEAN_INSTRUMENTS.has(lead.inst)) assert.equal(shapersSince(m0), 0, `seed ${seed}: the clear flute plays dry`);
    else assert.ok(shapersSince(m0) >= 1, `seed ${seed}: the distorted flute reaches its drive`);
    seen.add(lead.inst);
    s.dispose();
  }
  assert.deepEqual([...seen].sort(), ['flute', 'flute-drive'], 'both flutes play the symphony\'s tune across seeds');
  // pure mode is the clear flute's own mode: it stays dry
  const p = createSymphony({ seed: 4, theme: 'highlands', auto: false, pure: true, steer: null, votes: null });
  const m1 = all.length;
  for (let k = 0; k < 30; k++) { E.ctx.currentTime += 0.5; p.tick(); }
  assert.equal(shapersSince(m1), 0);
  p.dispose();
});

test('THE HOUSE DJ: lead, arps, answer and chop each meet the warm drive first (the clear flute aside)', () => {
  const ctx = new Ctx();
  const set = createMixSet(ctx, ctx.destination, { seed: 5 });
  const brain = createHouseDJ({ seed: 5, theme: 'deepsea' });
  let st = null;
  const built = new Set();
  for (let b = 0; b < 64; b++) { st = set.bar(b * 2, brain.bar({}), 0.5); for (const v of st.voices) if (v.built) { built.add(v.slot); assertChained(v, `house ${v.slot}`); } }
  assert.ok(built.size >= 3, [...built].join(', '));
  set.dispose();
});

test('THE BASES PAGE: the lead plays the dealt instrument through its chain, the chords through the arps chain', () => {
  const insts = new Set();
  const dealer = createVoiceDealer({ seed: 12 });
  for (let play = 0; play < 6; play++) {
    const ctx = new Ctx();
    const voices = createBaseVoices(ctx, ctx.destination, { dealer });
    const m0 = all.length;
    for (let bar = 0; bar < 2; bar++) playBaseBar(ctx, ctx.destination, bar * 2, 0.5, BASE, { bar, energy: 0.8, voices });
    const states = voices.states();
    assert.deepEqual(states.filter((x) => x.built).map((x) => x.slot).sort(), ['arps', 'lead'], 'both parts played into their buses');
    const lead = voices.voiceOf('lead');
    insts.add(lead.inst);
    assertChained(lead, `bases lead ${lead.inst}`);
    assertChained(voices.voiceOf('arps'), 'bases chords');
    assert.ok(heavySince(m0) > 0);
    voices.dispose();
  }
  assert.ok(insts.has('flute') && insts.has('flute-drive'), [...insts].join(', '));
  // without voices the base plays as before: the lead straight into `out` on the clear flute, no chain
  const ctx = new Ctx();
  const m1 = all.length;
  playBaseBar(ctx, ctx.destination, 0, 0.5, BASE, { bar: 0, energy: 0.8, parts: ['lead'] });
  assert.equal(shapersSince(m1), 0);
});

test('THE HOUSE SET (houseset.js, kept as an API): its tune plays on a dealt lead with a chain', () => {
  const notes = [{ midi: 72, at: 0, beats: 1 }, { midi: 74, at: 1, beats: 1 }];
  const insts = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const ctx = new Ctx();
    const hs = createHouseSet(ctx, ctx.destination, { seed });
    hs.bar(0, { mode: 'tune' }, 0.5, { notes, root: 57, mode: 'aeolian' });
    const st = hs.voices.states()[0];
    assert.ok(st.built, 'the tune played into its bus');
    assertChained(hs.voices.voiceOf('lead'), `houseset seed ${seed}`);
    insts.add(st.inst);
    hs.dispose();
  }
  assert.ok(insts.size >= 2, [...insts].join(', '));
});

test('THE POOL REVIEW: every chainable rack effect is in the melody pool or excluded with a reason', () => {
  const chainable = RACK.filter((e) => CHAIN_KINDS.includes(e.kind)).map((e) => e.key);
  for (const k of chainable) assert.ok(POOL_KEYS.includes(k) || POOL_EXCLUDED[k], `${k} is accounted for`);
  for (const k of POOL_KEYS) assert.ok(!POOL_EXCLUDED[k], `${k} is not both`);
  for (const [k, why] of Object.entries(POOL_EXCLUDED)) assert.ok(rackOf(k) && why.length > 20, k);
  assert.ok(POOL_KEYS.length >= 30, `${POOL_KEYS.length} effects in the pool`);
  for (const k of ['lowpass-sweep', 'highpass-rise', 'wah', 'tilt-eq', 'comb', 'soft-clip', 'ring-shimmer', 'trance-gate', 'dub-echo', 'gated-reverb', 'hall']) assert.ok(POOL_KEYS.includes(k), k);
  for (const k of CLOCKED_KEYS) assert.ok(!PROFILES.free.pool.includes(k), `${k} needs a bar clock, so the jam never gets it`);
});

test('THE DECK RULE over effects: every pool effect is dealt in every profile over a session', () => {
  const count = (profile, slots, n, extra = {}) => {
    const seen = new Set();
    for (const seed of [1, 2, 3]) {
      const d = createVoiceDealer({ seed });
      for (let i = 0; i < n; i++) for (const v of d.palette({ theme: THEME_KEYS[i % THEME_KEYS.length], slots, profile, ...extra }).voices) for (const k of v.keys) seen.add(k);
    }
    return seen;
  };
  const full = count('full', HOUSE_SLOTS, 24);
  assert.deepEqual(POOL_KEYS.filter((k) => !full.has(k)), [], 'the house DJ deals the whole pool');
  const sym = count('full', SYMPHONY_SLOTS, 24, { instruments: SYMPHONY_INSTRUMENTS });
  assert.deepEqual(POOL_KEYS.filter((k) => !sym.has(k)), [], 'the symphony deals the whole pool');
  const free = count('free', JAM_SLOTS, 12);
  assert.deepEqual(PROFILES.free.pool.filter((k) => !free.has(k)), [], 'the jam deals its whole pool');
  const gentle = count('gentle', OPENER_VOICE_SLOTS, 40);
  assert.deepEqual(Object.keys(GENTLE_POOL).filter((k) => !gentle.has(k)), [], 'the opener deals its whole gentle pool');
});

test('THE OPENER: its bells ring through gentle effects only; the tones, the pad and the pulses stay pure', () => {
  const grit = new Set(POOL_KEYS.filter((k) => rackOf(k).family === 'grit'));
  for (let seed = 1; seed <= 120; seed++) {
    const P = openerPlan(settleOpener({ seed, theme: THEME_KEYS[seed % THEME_KEYS.length] }));
    const v = openerBellVoice(P);
    assert.equal(v.profile, 'gentle');
    assertChained(v, `opener ${seed}`);
    const [drive, ...rest] = v.chain;
    assert.equal(drive.params.character, 2, 'the tape curve');
    assert.ok(drive.params.drive <= 1.5 && drive.params.makeup === 1, `soft: drive ${drive.params.drive}`);
    for (const c of rest) {
      assert.ok(GENTLE_POOL[c.key], `${c.key} is gentle`);
      assert.ok(!grit.has(c.key) && !['ring-mod', 'ring-shimmer', 'bitcrush', 'rate-reduce'].includes(c.key), `never ${c.key}`);
      if (c.key === 'tremolo') assert.ok(c.params.rate <= 1.4 && c.params.depth <= 0.18, `a slow tremolo ${c.params.rate} Hz`);
      if ('feedback' in c.params) assert.ok(c.params.feedback <= 0.3);
    }
    assert.deepEqual(openerBellVoice(P), v, 'a plan always rings through the same chain');
  }
  // the bells build one chain on their first strike; nothing else in the opener reaches it
  const c = settleOpener({ seed: 7, theme: 'cathedral' });
  const P = openerPlan(c);
  assert.ok(P.bells.length > 0);
  const ctx = new Ctx();
  const m0 = all.length;
  const V = openerVoices(ctx, ctx.destination, P, { startAt: 0 });
  const before = shapersSince(m0);
  assert.equal(before, 1, 'before any bell: only the opener\'s own soft-clip limiter');
  assert.equal(V.bellBus, null, 'no bell chain before the first bell');
  for (let t = 0; t < P.end; t += 2) V.schedule(t, t, t + 2);
  assert.ok(V.bellBus, 'the first bell built the chain');
  assert.equal(V.bellBus.keys[0], SATURATOR);
  assert.equal(shapersSince(m0), before + 1, 'exactly one chain for every bell of the visit');
  V.dispose();
});

test('THE JAM: one chain per tonal instrument, built on its first hit and kept; drums and bass play dry', () => {
  const ctx = new Ctx();
  const out = ctx.createGain();
  let theme = 'embers';
  const J = createJamVoices(ctx, out, { seed: 4, theme: () => theme });
  const k = jamKey(theme);
  for (const key of ['kick', 'clap', 'hat', 'open', 'bass']) assert.equal(J.input(jamCall(key, { k }).call, 0), out, `${key} plays dry`);
  assert.ok(J.states().every((x) => !x.built), 'a drum builds no chain');
  const m0 = all.length;
  const first = J.input(jamCall('pluck', { k }).call, 0);
  assert.notEqual(first, out);
  const afterFirst = heavySince(m0);
  assert.ok(afterFirst > 0, 'the first pluck built its chain');
  for (let i = 1; i < 50; i++) assert.equal(J.input(jamCall('pluck', { k }).call, i * 0.125), first, 'the same bus for every pluck');
  assert.equal(heavySince(m0), afterFirst, '49 more plucks built no effect node');
  for (const key of Object.keys(JAM_TONAL)) {
    J.input(jamCall(key, { k }).call, 7);
    const st = J.states().find((x) => x.slot === JAM_TONAL[key]);
    assert.ok(st.built && st.keys[0] === SATURATOR && st.keys.length >= 3, `${key}: ${st.keys.join(', ')}`);
    for (const fx of st.keys.slice(1)) assert.ok(PROFILES.free.pool.includes(fx), `${key}: ${fx} needs no bar clock`);
  }
  // a new theme deals new chains (a crossfade), never one per note
  const sig = JSON.stringify(J.states());
  theme = 'crystals';
  J.input(jamCall('pluck', { k: jamKey(theme) }).call, 10);
  assert.notEqual(JSON.stringify(J.states()), sig);
  J.dispose();
});

test('THE JAM ON THE ENGINE: playOnEngine (the jam, the loop layers, the followed radio) plays through the chains; MUTE ALL builds none', () => {
  configure({ createContext: () => new Ctx() });
  const E = unlockNow();
  sound.setMuted(true);
  const m0 = all.length;
  assert.equal(playOnEngine(jamCall('pluck').call), false);
  assert.equal(shapersSince(m0), 0, 'muted: no chain is built');
  sound.setMuted(false);
  for (let i = 0; i < 20; i++) { E.ctx.currentTime += 0.1; assert.equal(playOnEngine({ ...jamCall('bell').call, at: 0 }), true); }
  const st = jamVoices().states().find((x) => x.slot === 'jam-bell');
  assert.ok(st.built && st.keys[0] === SATURATOR, st.keys.join(', '));
  assert.equal(jamVoices().states().filter((x) => x.built).length, 1, 'only the bell was hit');
});

test('THE TAG: a symphony palette with its dealt lead round-trips; a profile rides along outside the tag', () => {
  const S = createVoiceDealer({ seed: 6 }).palette({ theme: 'cathedral', slots: SYMPHONY_SLOTS, instruments: SYMPHONY_INSTRUMENTS });
  assert.deepEqual(S.voices.map((v) => v.slot), [...SYMPHONY_SLOTS]);
  assert.deepEqual(realizePalette(specOf(S)), S);
  const G = createVoiceDealer({ seed: 6 }).palette({ slots: OPENER_VOICE_SLOTS, profile: 'gentle' });
  assert.equal(specOf(G).voices[0].profile, 'gentle');
  assert.deepEqual(realizePalette(specOf(G)), G);
});

test('THE LEVEL MATCH: each new path trims its chains back to the dry level; the DJ\'s buses keep VOICE_TRIM', () => {
  const ctx = new Ctx();
  const out = ctx.createGain();
  const J = createJamVoices(ctx, out, { seed: 2, theme: () => 'deepsea' });
  for (const key of Object.keys(JAM_TONAL)) J.input(jamCall(key, { k: jamKey('deepsea') }).call, 0);
  for (const [slot, bus] of Object.entries(J.buses.buses)) assert.ok(Math.abs(bus.trim - levelTrim(LEVEL_MATCH_DB[slot])) < 1e-12, `${slot}: ${bus.trim}`);
  const voices = createBaseVoices(ctx, out, { dealer: createVoiceDealer({ seed: 3 }) });
  playBaseBar(ctx, out, 0, 0.5, BASE, { bar: 0, energy: 0.8, voices });
  const lead = voices.buses.lead;
  const want = CLEAN_INSTRUMENTS.has(lead.voice.inst) ? 1 : levelTrim(LEVEL_MATCH_DB[`base:lead:${lead.voice.inst}`]);
  assert.ok(Math.abs(lead.trim - want) < 1e-12, `base lead ${lead.voice.inst}: ${lead.trim}`);
  assert.ok(Math.abs(voices.buses.arps.trim - levelTrim(LEVEL_MATCH_DB['base:arps'])) < 1e-12);
  // the DJ's bus (no trim given) keeps VOICE_TRIM, and every level-match gain stays under the bus's cap
  const dj = createVoiceBus(ctx, out, { slot: 'arps' });
  dj.set(defaultVoice('arps'), 0, 0);
  assert.equal(dj.trim, VOICE_TRIM);
  for (const db of Object.values(LEVEL_MATCH_DB)) assert.ok(Math.abs(db) <= 6 && levelTrim(db) <= 2.5, `${db} dB`);
  assert.equal(levelTrim(0), VOICE_TRIM);
  // the opener's bells bus wears its trim
  const P = openerPlan(settleOpener({ seed: 9, theme: 'highlands' }));
  const V = openerVoices(ctx, ctx.destination, P, { startAt: 0 });
  for (let t = 0; t < P.end; t += 4) V.schedule(t, t, t + 4);
  assert.ok(Math.abs(V.bellBus.trim - levelTrim(LEVEL_MATCH_DB['opener-bells'])) < 1e-12);
  V.dispose();
});

