// THE VOICE CHAINS (lane MELODYFX, 2026-10-02): every melodic instrument but the clear flute plays through a chain
// of at least three effects that starts with a warm drive; the clear flute plays dry in every mode; the chains
// change set to set by the deck; the tag carries the chain and rebuilds it exactly; the levels stay bounded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, writes, reach, all } from './fakeaudio.mjs';
import {
  configure, unlockNow, createSymphony, sound, encodeTag, decodeTag, situationOf, playTag, tagLines, createHouseDJ,
  createMixSet, rackOf, RACK_KEYS, TAG_FX_ALPHABET, VOICE_FX, INSTRUMENT_KEYS, playNote,
  HOUSE_SLOTS, SYMPHONY_SLOTS, VOICE_SLOTS, SLOT_INSTRUMENTS, INST_ALPHABET, CLEAN_INSTRUMENTS, SATURATOR, POOL_KEYS,
  VOICE_CHAIN_POOL, FAMILY_CAP, PITCH_MOVERS, SAME_KIND, MIN_EXTRAS, MAX_EXTRAS, VOICE_TRIM, realizeVoice, realizePalette, specOf,
  createVoiceDealer, paletteOfTune, defaultVoice, createVoiceBus, createVoiceBuses, chainLine, driveCurve, HEADROOM,
  warmDrive, octaveShift, swingAt, THEME_KEYS, velocityFor, INST_PEAK,
} from '../src/index.js';

const famOf = (k) => rackOf(k).family;
const paletteRuns = () => {
  const out = [];
  for (const seed of [1, 2, 3, 7, 11, 42, 99, 1234]) {
    const d = createVoiceDealer({ seed });
    for (const theme of THEME_KEYS) for (const slots of [HOUSE_SLOTS, SYMPHONY_SLOTS]) out.push(d.palette({ theme, slots }));
  }
  return out;
};

function checkVoice(v, where) {
  if (CLEAN_INSTRUMENTS.has(v.inst)) {
    assert.equal(v.chain.length, 0, `${where}: the clear flute plays dry`);
    return;
  }
  assert.ok(v.chain.length >= 3, `${where}: ${v.chain.length} effects`);
  assert.equal(v.chain[0].key, SATURATOR, `${where}: the chain starts with the warm drive`);
  const extras = v.chain.slice(1).map((c) => c.key);
  assert.ok(extras.length >= MIN_EXTRAS && extras.length <= MAX_EXTRAS, `${where}: ${extras.length} extras`);
  assert.equal(new Set(extras).size, extras.length, `${where}: no effect twice`);
  for (const k of extras) assert.ok(VOICE_CHAIN_POOL[k], `${where}: ${k} is in the pool`);
  const fam = {};
  for (const k of extras) fam[famOf(k)] = (fam[famOf(k)] ?? 0) + 1;
  for (const [f, n] of Object.entries(fam)) assert.ok(n <= (FAMILY_CAP[f] ?? 1), `${where}: ${n} ${f}`);
  assert.ok(extras.filter((k) => PITCH_MOVERS.has(k)).length <= 1, `${where}: one pitch mover at most`);
  for (const grp of SAME_KIND) assert.ok(extras.filter((k) => grp.includes(k)).length <= 1, `${where}: one of ${grp.join(' or ')}`);
  for (const c of v.chain) {
    const e = rackOf(c.key);
    assert.ok(c.amount > 0 && c.amount <= 1, `${where}: ${c.key} amount ${c.amount}`);
    for (const [n, x] of Object.entries(c.params)) {
      assert.ok(Number.isFinite(x), `${where}: ${c.key}.${n}`);
      assert.ok(x >= e.params[n].min - 1e-9 && x <= e.params[n].max + 1e-9, `${where}: ${c.key}.${n} = ${x} in its range`);
    }
  }
}

test('every melodic voice in every palette: at least three effects, a warm drive first, the caps kept', () => {
  let n = 0;
  for (const P of paletteRuns()) for (const v of P.voices) { checkVoice(v, `${v.slot} ${v.inst}`); n += 1; }
  assert.ok(n > 300, `${n} voices checked`);
  // every part that can play a non-clean instrument; the lead may be the clear flute and nothing else may
  for (const [slot, insts] of Object.entries(SLOT_INSTRUMENTS)) {
    for (const inst of insts) if (CLEAN_INSTRUMENTS.has(inst)) assert.equal(slot, 'lead', 'only the lead may be the clear flute');
  }
  for (const slot of VOICE_SLOTS) checkVoice(defaultVoice(slot), `default ${slot}`);
});

test('the clear flute has no chain; the distorted flute is driven hard; every other voice gently', () => {
  assert.deepEqual(realizeVoice(5, 0, { slot: 'lead', inst: 'flute', keys: ['tape-wow', 'warm-room'] }).chain, []);
  const ctx = new Ctx();
  const out = ctx.createGain();
  const clean = createVoiceBus(ctx, out, { slot: 'lead' });
  clean.set(realizeVoice(5, 0, { slot: 'lead', inst: 'flute', keys: [] }), 0, 0);
  assert.equal(clean.keys.length, 0);
  assert.ok(![...reach(clean.input)].some((n) => n.kind === 'shaper' || n.kind === 'convolver' || n.kind === 'delay'), 'the clear flute meets no effect node');
  for (const P of paletteRuns()) for (const v of P.voices) {
    if (CLEAN_INSTRUMENTS.has(v.inst)) continue;
    const drive = v.chain[0].params.drive;
    if (v.inst === 'flute-drive') assert.ok(drive >= 3.5, `the distorted flute drives at ${drive}`);
    else assert.ok(drive <= 2.8, `${v.inst} drives gently at ${drive}`);
  }
  // a driven bus reaches a WaveShaper (the drive) and its chain has three effects or more
  const keys = createVoiceBus(ctx, out, { slot: 'lead' });
  keys.set(realizeVoice(5, 0, { slot: 'lead', inst: 'keys', keys: ['tape-wow', 'warm-room'] }), 0, 0);
  assert.ok([...reach(keys.input)].some((n) => n.kind === 'shaper'), 'the keys reach the warm drive');
  assert.ok(keys.keys.length >= 3);
});

test('THE McKUSKER FLUTE, pure: the clear flute alone, no WaveShaper anywhere; the symphony drives its other voices', () => {
  configure({ createContext: () => new Ctx() });
  const s = createSymphony({ seed: 4, theme: 'highlands', auto: false, pure: true, steer: null, votes: null });
  const E = unlockNow();
  for (let k = 0; k < 40; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  assert.equal(s.state.pure, true);
  assert.deepEqual(s.state.voices.lines, ['the clear flute: clear, no effects']);
  s.dispose();
  const t = createSymphony({ seed: 4, theme: 'highlands', auto: false, steer: null, votes: null });
  t.dj.lockTheme(true);
  t.dj.clamp('flute', true);
  for (let k = 0; k < 40; k++) { E.ctx.currentTime += 0.5; t.tick(); }
  const V = t.state.voices;
  assert.equal(V.mode, 'symphony');
  assert.deepEqual(V.voices.map((v) => v.slot).sort(), [...SYMPHONY_SLOTS].sort());
  // lane MELODYFX2: the tune is the 'lead' part, the clear flute (dry) or the distorted flute (chained)
  for (const v of V.voices) assert.ok(CLEAN_INSTRUMENTS.has(v.inst) ? v.chain.length === 0 : v.chain.length >= 3 && v.chain[0].key === SATURATOR, `${v.slot}`);
  t.dispose();
});

test('the pure flute builds no WaveShaper; the house set does (the vacuity control)', () => {
  configure({ createContext: () => new Ctx() });
  const E = unlockNow();
  const m0 = all.length;
  const s = createSymphony({ seed: 21, theme: 'cathedral', auto: false, pure: true, steer: null, votes: null });
  for (let k = 0; k < 40; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  s.dispose();
  assert.equal(all.slice(m0).filter((n) => n.kind === 'shaper').length, 0, 'no drive in pure mode');
  // vacuity control: the same run with the house DJ does build drives
  const m1 = all.length;
  const h = createSymphony({ seed: 21, theme: 'cathedral', auto: false, house: true, steer: null, votes: null });
  for (let k = 0; k < 40; k++) { E.ctx.currentTime += 0.5; h.tick(); }
  h.dispose();
  assert.ok(all.slice(m1).filter((n) => n.kind === 'shaper').length > 0, 'the house set drives its voices');
});

test('THE DECK: chains vary across sets, two sets in a row never share a part\'s chain, every effect comes round', () => {
  for (const seed of [1, 5, 9]) {
    const d = createVoiceDealer({ seed });
    const seen = Object.fromEntries(HOUSE_SLOTS.map((s) => [s, new Set()]));
    const insts = Object.fromEntries(HOUSE_SLOTS.map((s) => [s, new Set()]));
    let prev = null;
    for (let set = 0; set < 16; set++) {
      const P = d.palette({ theme: THEME_KEYS[set % THEME_KEYS.length], slots: HOUSE_SLOTS });
      for (const v of P.voices) {
        insts[v.slot].add(v.inst);
        for (const k of v.keys) seen[v.slot].add(k);
        const before = prev?.voices.find((x) => x.slot === v.slot);
        if (before && v.keys.length && before.keys.length) assert.notDeepEqual([...v.keys].sort(), [...before.keys].sort(), `seed ${seed} set ${set} ${v.slot}: a new chain`);
      }
      // inside one set, the parts do not all wear the same chain
      const sigs = P.voices.filter((v) => v.keys.length).map((v) => v.keys.join('+'));
      assert.ok(new Set(sigs).size === sigs.length, `seed ${seed} set ${set}: each part its own chain`);
      prev = P;
    }
    for (const slot of HOUSE_SLOTS) {
      assert.deepEqual([...insts[slot]].sort(), [...SLOT_INSTRUMENTS[slot]].sort(), `${slot}: every instrument dealt`);
      if (slot !== 'lead') assert.ok(seen[slot].size >= 12, `${slot}: ${seen[slot].size} of ${POOL_KEYS.length} effects used in 16 sets`);
    }
  }
  // the same seed deals the same palettes (determinism)
  const a = createVoiceDealer({ seed: 77 });
  const b = createVoiceDealer({ seed: 77 });
  for (let i = 0; i < 5; i++) assert.deepEqual(a.palette({ theme: 'embers' }), b.palette({ theme: 'embers' }));
});

test('THE TAG round-trips the chain: seed, instruments and keys rebuild every amount and setting exactly', () => {
  for (const seed of [3, 8, 1000]) {
    const P = createVoiceDealer({ seed }).palette({ theme: 'deepsea', slots: HOUSE_SLOTS });
    const tag = encodeTag(situationOf({ theme: 'deepsea', tune: { kind: 'composed', seed: 5, sources: ['x'], bar: 2 }, voices: specOf(P) }));
    const d = decodeTag(tag);
    assert.deepEqual(d.voices, specOf(P));
    assert.deepEqual(realizePalette(d.voices), P, 'the rebuilt palette is the same, number for number');
    const R = playTag(tag, { live: false });
    assert.deepEqual(R.voices, P);
    const line = tagLines(d).find(([k]) => k === 'voices');
    assert.ok(line && line[1].includes('warm drive'), line?.[1]);
  }
  // a symphony palette in the tag is kept for display, and the replay plays a full house palette
  const S = createVoiceDealer({ seed: 4 }).palette({ theme: 'crystals', slots: SYMPHONY_SLOTS });
  const tagS = encodeTag(situationOf({ theme: 'crystals', tune: { kind: 'composed', seed: 9, sources: [], bar: 0 }, voices: specOf(S) }));
  const RS = playTag(tagS, { live: false });
  assert.deepEqual(RS.palette, S);
  assert.deepEqual(RS.voices.voices.map((v) => v.slot), [...HOUSE_SLOTS]);
  // a tag written before the voice block: no voices decoded, and the replay derives one from the tune seed, fixed
  const old = encodeTag(situationOf({ theme: 'embers', tune: { kind: 'composed', seed: 12345, sources: [], bar: 0 } }));
  assert.equal(decodeTag(old).voices, null);
  const R1 = playTag(old, { live: false });
  const R2 = playTag(old, { live: false });
  assert.deepEqual(R1.voices, R2.voices);
  assert.deepEqual(R1.voices, paletteOfTune(12345, 'embers'));
  for (const v of R1.voices.voices) checkVoice(v, `old tag ${v.slot}`);
  // a pure tag carries no chain: the clear flute
  const pureTag = encodeTag(situationOf({ theme: 'highlands', pure: true, tune: { kind: 'collected', seed: 0, sources: [], bar: 0 } }));
  assert.equal(playTag(pureTag, { live: false }).voices, null);
  // every rack effect, the voice inserts included, has a tag index
  for (const k of RACK_KEYS) assert.ok(TAG_FX_ALPHABET.includes(k), k);
  for (const e of VOICE_FX) assert.ok(TAG_FX_ALPHABET.includes(e.key), e.key);
  assert.ok(TAG_FX_ALPHABET.length <= 128, 'the 7-bit fx index');
  assert.ok(INST_ALPHABET.length <= 16 && VOICE_SLOTS.length <= 8, 'the 4-bit and 3-bit voice fields');
});

test('the live house DJ: the tag it writes carries its palette, and another symphony replays it', () => {
  configure({ createContext: () => new Ctx() });
  const E = unlockNow();
  const a = createSymphony({ seed: 31, theme: 'highlands', auto: false, house: true, steer: null, votes: null });
  for (let k = 0; k < 40; k++) { E.ctx.currentTime += 0.5; a.tick(); }
  const tag = a.state.tag;
  const lines = a.state.voices.lines;
  const pal = a.state.voices.voices;
  a.dispose();
  const d = decodeTag(tag);
  assert.ok(d.voices, 'the house tag carries the voice block');
  assert.deepEqual(d.voices.voices.map((v) => v.slot), [...HOUSE_SLOTS]);
  for (const v of pal) checkVoice(v, `live ${v.slot}`);
  assert.equal(lines.length, HOUSE_SLOTS.length);
  const b = createSymphony({ seed: 77, theme: 'embers', auto: false, house: true, steer: null, votes: null });
  for (let k = 0; k < 4; k++) { E.ctx.currentTime += 0.5; b.tick(); }
  const R = b.playTag(tag);
  assert.deepEqual(R.voices.voices.map((v) => ({ slot: v.slot, inst: v.inst, chain: v.chain })), pal, 'the rebuilt palette is the leader\'s');
  // the next bar the follower plays wears that palette (the very next one: a later bar may start a new set)
  const bar0 = b.state.house.bar;
  for (let k = 0; k < 12 && b.state.house.bar === bar0; k++) { E.ctx.currentTime += 0.25; b.tick(); }
  assert.notEqual(b.state.house.bar, bar0, 'a bar was played');
  // unless that bar began a new set (a tag taken on a set's last bar), it plays the leader's chains exactly
  if (b.state.mix.setBar !== 0) assert.deepEqual(b.state.voices.voices, pal, 'the follower plays the same chains, setting for setting');
  else for (const v of b.state.voices.voices) assert.ok(CLEAN_INSTRUMENTS.has(v.inst) || v.chain.length >= 3);
  b.dispose();
});

test('the house set routes every melodic part through its bus; muted, it builds no chain at all', () => {
  const ctx = new Ctx();
  const set = createMixSet(ctx, ctx.destination, { seed: 2 });
  const brain = createHouseDJ({ seed: 2, theme: 'embers' });
  writes.length = 0;
  let st = null;
  for (let b = 0; b < 48; b++) st = set.bar(b * 2, brain.bar({}), 0.5);
  assert.ok(writes.every(Number.isFinite));
  const built = st.voices.filter((v) => v.built);
  assert.ok(built.length >= 2, `${built.length} parts played`);
  for (const v of built) {
    if (CLEAN_INSTRUMENTS.has(v.inst)) assert.equal(v.keys.length, 0);
    else assert.ok(v.keys.length >= 3 && v.keys[0] === SATURATOR, `${v.slot}: ${v.keys.join(', ')}`);
  }
  set.dispose();
  // MUTE ALL: a muted symphony schedules nothing, so no part's bus is ever built
  configure({ createContext: () => new Ctx() });
  const E = unlockNow();
  sound.setMuted(true);
  const m0 = all.length;
  const s = createSymphony({ seed: 3, theme: 'embers', auto: false, house: true, steer: null, votes: null });
  for (let k = 0; k < 30; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  assert.equal(s.state.audible, false);
  assert.equal(all.slice(m0).filter((n) => n.kind === 'shaper').length, 0, 'muted: no drive is built');
  s.dispose();
  sound.setMuted(false);
  // vacuity control: the same symphony unmuted builds drives
  const m1 = all.length;
  const u = createSymphony({ seed: 3, theme: 'embers', auto: false, house: true, steer: null, votes: null });
  for (let k = 0; k < 30; k++) { E.ctx.currentTime += 0.5; u.tick(); }
  assert.ok(all.slice(m1).filter((n) => n.kind === 'shaper').length > 0, 'unmuted: the drives are built');
  u.dispose();
});

test('LEVELS: the drive passes a quiet note at unity and caps a loud one; feedback and wet stay low; the trim', () => {
  for (const c of [0, 1, 2]) {
    const k = driveCurve(c, 4097);
    const mid = 2048;
    const slope = (k[mid + 1] - k[mid - 1]) / (2 * (2 / 4096));
    assert.ok(Math.abs(slope - 1) < 0.03, `curve ${c}: slope ${slope} at 0`);
    assert.ok(Math.abs(k[mid]) < 1e-6, `curve ${c}: zero in, zero out`);
    const top = Math.max(...k.map(Math.abs));
    assert.ok(top <= 0.4, `curve ${c}: at most ${top}`);
  }
  // built with a drive of d, the pre gain is d and the post gain 1 / d: unity for a quiet note, a cap for a loud one
  const ctx = new Ctx();
  for (const drive of [1.2, 2, 5]) {
    const b = warmDrive.build(ctx, { drive });
    assert.equal(b.input.gain.value, drive);
    assert.ok(Math.abs(b.output.gain.value * drive - 1) < 1e-12, 'makeup 1: a quiet note at unity');
  }
  // every dealt drive: a quiet note at most 1.2 louder (2.4 for the distorted flute), a full-scale one capped at 0.32
  const curveTop = Math.max(...[0, 1, 2].map((c) => Math.max(...driveCurve(c).map(Math.abs))));
  for (const P of paletteRuns()) for (const v of P.voices) {
    if (!v.chain.length) continue;
    const { drive, makeup } = v.chain[0].params;
    assert.ok(makeup <= (v.inst === 'flute-drive' ? 2.4 : 1.2) + 1e-9, `${v.inst} makeup ${makeup}`);
    assert.ok((makeup * curveTop) / drive <= 0.32, `${v.inst}: loudest out ${(makeup * curveTop) / drive}`);
  }
  // a part asks for a peak and gets it on any instrument
  for (const inst of ['keys', 'pluck', 'harp', 'bells']) assert.ok(Math.abs(velocityFor(inst, 0.04) * INST_PEAK[inst] - 0.04) < 1e-12);
  assert.equal(velocityFor('crystal', 5), 1, 'never past full velocity');
  for (const P of paletteRuns()) for (const v of P.voices) for (const c of v.chain) {
    if ('feedback' in c.params) assert.ok(c.params.feedback <= 0.42 + 1e-9, `${c.key} feedback ${c.params.feedback}`);
    if (c.key === 'tremolo') assert.ok(c.params.depth <= 0.35 + 1e-9);
    if (c.key === 'warm-room') assert.ok(c.amount <= 0.38 + 1e-9);
  }
  assert.ok(VOICE_TRIM <= 1);
});

test('the new instruments play with finite values; the lead moves by whole octaves; the swing pushes off-beats late', () => {
  const ctx = new Ctx();
  const out = ctx.createGain();
  writes.length = 0;
  for (const inst of ['flute', 'flute-drive', 'keys', 'pluck']) {
    assert.ok(INSTRUMENT_KEYS.includes(inst));
    for (const f of [110, 432, 1500]) assert.ok(playNote(ctx, out, inst, f, 1, 0.5, 0.8), `${inst} ${f}`);
  }
  assert.ok(writes.every(Number.isFinite));
  assert.equal(octaveShift('keys', 79), -12);
  assert.equal(octaveShift('flute', 79), 0);
  assert.equal(octaveShift('pluck', 64), 0);
  assert.equal(octaveShift('keys', null), 0);
  assert.equal(octaveShift('crystal', 72), 12);
  assert.equal(swingAt(1.5, 0.08), 1.58);
  assert.equal(swingAt(1, 0.08), 1);
  assert.equal(swingAt(0.25, 0.08), 0.25);
  assert.ok(chainLine(defaultVoice('arps')).startsWith('soft pluck: warm drive'), chainLine(defaultVoice('arps')));
  // a part's bus is built on its first note only
  const B = createVoiceBuses(ctx, out, HOUSE_SLOTS);
  assert.ok(B.states().every((x) => !x.built));
  B.input('arps', 0);
  assert.deepEqual(B.states().filter((x) => x.built).map((x) => x.slot), ['arps']);
  B.dispose();
});
