// THE SETTLE DJ (lane SETTLEDJ): the McKusker flute plays a collected tune note for note on the flute alone; the
// composer settles a new tune in the theme's key from old ones, phrase by phrase, never copying more than a phrase,
// fresh per seed and fixed for a seed; the influence window pulls the next set toward the sets before it, the newest
// most; the mix machine follows its leans; the planner lands its sections on lines and warms down after a peak; the
// tag holds the whole situation and playTag rebuilds the same notes and chain; votes lean the DJ; the set hooks fire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, writes } from './fakeaudio.mjs';
import { FIX_REEL_A, FIX_REEL_B, FIX_AIR } from './tune-fixtures.mjs';
import {
  configure, unlockNow, createSymphony, sound, TUNES, playableTunes, placeTune, rootMidiOf, parseAbc, MODES, themeOf, noteMidi,
  composeTune, longestCopy, readSource, createMixMachine, MIX_KEYS, createPlanner, PLANNER, createHouseDJ, humChoice,
  encodeTag, decodeTag, tagLines, playTag, TAG_FX_ALPHABET, RACK, RACK_KEYS, buildRack, djVotes, votesFromTags,
  createInfluenceWindow, influenceWeights, createDJ, createMixSet, STEER_IDLE,
} from '../src/index.js';

const SRC = (t) => ({ ...t, source: { book: 'test fixture book', compiler: 'test', year: 1800, where: 'p. 1', scan: 'https://archive.org/details/test-fixture' } });
const REELS = [SRC(FIX_REEL_A), SRC(FIX_REEL_B)];
const POOL = playableTunes([...TUNES, ...REELS, SRC(FIX_AIR)]);
const reel = (id) => POOL.find((t) => t.id === id);
const pcIn = (midi, theme) => {
  const T = themeOf(theme);
  const root = noteMidi(T.root);
  const steps = MODES[T.mode];
  return steps.map((s) => (root + s) % 12).includes(((midi % 12) + 12) % 12);
};

test('THE McKUSKER FLUTE: a collected tune note for note, on the flute alone, no house passes, one tempo', () => {
  configure({ createContext: () => new Ctx() });
  const s = createSymphony({ seed: 4, theme: 'cathedral', auto: false, pure: true, steer: null, votes: null });
  const E = unlockNow();
  const played = [];
  const barsSeen = new Set();
  let title = null;
  let bpms = new Set();
  for (let k = 0; k < 80; k++) {
    E.ctx.currentTime += 0.5;
    s.tick();
    const st = s.state;
    for (const p of st.played) if (!barsSeen.has(p.bar)) played.push(p);
    for (const p of st.played) barsSeen.add(p.bar);
    if (st.tune?.title) title ??= st.tune.title;
    if (st.tune?.title === title && st.playing) bpms.add(st.bpm);
  }
  const st = s.state;
  assert.equal(st.pure, true);
  assert.equal(st.house.on, false);
  assert.equal(st.house.keys.length, 0, 'no house passes');
  assert.ok(played.length > 10, 'the flute played');
  assert.ok(played.every((p) => p.inst === 'flute'), 'only the flute sounds');
  assert.ok(title, 'a collected tune is named');
  assert.equal(st.tune.generated, false);
  // note for note: the first notes played are the collected tune's notes, placed in the theme's key, in order
  const tune = POOL.find((t) => t.title === title);
  const placed = placeTune(tune.parsed, rootMidiOf(themeOf('cathedral'))).notes.filter((n) => n.midi != null);
  const first = played.slice(0, placed.length).map((p) => p.midi);
  assert.deepEqual(first, placed.slice(0, first.length).map((n) => n.midi), 'the tune as written, note for note');
  assert.ok(st.parts.voices.every((v) => /flute/.test(v)), 'the parts name the flute alone');
  assert.ok(writes.every(Number.isFinite));
  s.dispose();
});

test('THE COMPOSER: the theme\'s key, phrases of the right length, deterministic for a seed, fresh per seed, names its sources', () => {
  const a = composeTune({ sources: [reel('fixture-reel-a'), reel('fixture-reel-b')], theme: 'highlands', seed: 11 });
  const b = composeTune({ sources: [reel('fixture-reel-a'), reel('fixture-reel-b')], theme: 'highlands', seed: 11 });
  const c = composeTune({ sources: [reel('fixture-reel-a'), reel('fixture-reel-b')], theme: 'highlands', seed: 12 });
  assert.deepEqual(a.notes, b.notes, 'the same seed, the same tune');
  assert.notDeepEqual(a.notes.map((n) => n.midi), c.notes.map((n) => n.midi), 'another seed, another tune');
  for (const n of a.notes) if (n.midi != null) assert.ok(pcIn(n.midi, 'highlands'), `${n.midi} is in A mixolydian`);
  // eight phrases of two 4/4 bars: each phrase is 8 beats long
  const beats = {};
  for (const n of a.notes) beats[n.phrase] = (beats[n.phrase] ?? 0) + n.beats;
  assert.equal(Object.keys(beats).length, 8);
  for (const v of Object.values(beats)) assert.ok(Math.abs(v - 8) < 1e-9, `a phrase of ${v} beats`);
  // each half ends on the tonic
  const ends = [3, 7].map((k) => a.notes.filter((n) => n.phrase === k && n.midi != null).at(-1));
  for (const e of ends) assert.equal(((e.midi - noteMidi('A3')) % 12 + 12) % 12, 0, 'a half ends on the tonic');
  assert.match(a.label, /^a new tune after Fixture Reel A and Fixture Reel B$/);
  assert.deepEqual(parseAbc(a.abc).notes.map((n) => n.midi), a.notes.map((n) => n.midi), 'its ABC reads back note for note');
});

test('THE COMPOSER never copies more than one phrase of any single source, over many seeds', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const t = composeTune({ sources: [reel('fixture-reel-a'), reel('fixture-reel-b')], theme: 'embers', seed });
    for (const c of t.copy) assert.ok(c.beats <= t.phraseBeats + 1e-9, `seed ${seed}: ${c.beats} beats copied from ${c.id}`);
    const mine = t.notes.map((n) => ({ deg: n.deg, beats: n.beats }));
    for (const id of ['fixture-reel-a', 'fixture-reel-b']) assert.ok(longestCopy(mine, readSource(reel(id)).notes).beats <= t.phraseBeats + 1e-9);
  }
  // a single air composes too, freer, with its phrases from the air's own lines
  const air = composeTune({ sources: [reel('fixture-air')], theme: 'cathedral', seed: 3 });
  assert.equal(air.kind, 'air');
  for (const c of air.copy) assert.ok(c.beats <= air.phraseBeats + 1e-9);
});

const motifDist = (t, want) => {
  const s = t.notes.filter((n) => n.midi != null).slice(0, 5).map((n) => n.midi);
  let d = 0;
  for (let i = 1; i < s.length; i++) d += Math.abs((s[i] - s[i - 1]) - want[i - 1]);
  return d;
};
const scaleShare = (t, pc, mode) => {
  const set = new Set(MODES[mode].map((x) => (x + pc) % 12));
  const ms = t.notes.filter((n) => n.midi != null);
  return ms.filter((n) => set.has(n.midi % 12)).length / ms.length;
};

test('INFLUENCES: the next set leans toward the window\'s key and motif, and an older set counts less', () => {
  const src = [reel('fixture-reel-a'), reel('fixture-reel-b')];
  const rec = { keyPc: 3, mode: 'ionian', motif: [4, 3, -2, -5], theme: 'embers', energy: 0.8 }; // E flat major, far from A
  const other = { keyPc: 9, mode: 'mixolydian', motif: [0, 0, 0, 0], theme: 'highlands', energy: 0.4 };
  let base = { d: 0, s: 0 };
  let newest = { d: 0, s: 0 };
  let oldest = { d: 0, s: 0 };
  const N = 24;
  for (let seed = 1; seed <= N; seed++) {
    const t0 = composeTune({ sources: src, theme: 'highlands', seed });
    const t1 = composeTune({ sources: src, theme: 'highlands', seed, influence: { window: [rec, other, other, other] } });
    const t4 = composeTune({ sources: src, theme: 'highlands', seed, influence: { window: [other, other, other, rec] } });
    for (const [acc, t] of [[base, t0], [newest, t1], [oldest, t4]]) { acc.d += motifDist(t, rec.motif) / N; acc.s += scaleShare(t, rec.keyPc, rec.mode) / N; }
  }
  assert.ok(newest.d < base.d, `the motif pulls: ${newest.d.toFixed(2)} under ${base.d.toFixed(2)}`);
  assert.ok(newest.s > base.s, `the key pulls: ${newest.s.toFixed(3)} over ${base.s.toFixed(3)}`);
  assert.ok(newest.d < oldest.d, `the newest set pulls harder than the oldest: ${newest.d.toFixed(2)} under ${oldest.d.toFixed(2)}`);
  assert.ok(newest.s > oldest.s, `and on the key: ${newest.s.toFixed(3)} over ${oldest.s.toFixed(3)}`);
  const w = influenceWeights(4, 0.6);
  assert.ok(w[0] > w[1] && w[1] > w[2] && w[2] > w[3] && Math.abs(w.reduce((a, b) => a + b) - 1) < 1e-12);
  // the window keeps four, newest first, and a store remembers it
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const win = createInfluenceWindow({ storage });
  for (let k = 0; k < 6; k++) win.push({ keyPc: k, motif: [k] });
  assert.deepEqual(win.list.map((r) => r.keyPc), [5, 4, 3, 2]);
  assert.deepEqual(createInfluenceWindow({ storage }).list.map((r) => r.keyPc), [5, 4, 3, 2]);
});

test('THE MIX MACHINE follows its leans: a push toward energy raises the drums and the bass; holding out the flute holds the lead out', () => {
  const count = (steer, section) => {
    const n = { drums: 0, bass: 0 };
    for (let seed = 1; seed <= 40; seed++) {
      const m = createMixMachine({ seed });
      const r = m.bar({ section, changed: true, theme: 'deepsea', steer });
      if (r.yes.drums) n.drums++;
      if (r.yes.bass) n.bass++;
    }
    return n;
  };
  // an intro has no drums or bass of its own; a push toward energy brings both in, together
  const none = count({}, 'intro');
  const up = count({ energy: 1 }, 'intro');
  assert.ok(up.drums > none.drums && up.bass > none.bass, `up ${JSON.stringify(up)} over ${JSON.stringify(none)}`);
  // a build has them; a push away from energy takes them out
  const build = count({}, 'build');
  const down = count({ energy: -1 }, 'build');
  assert.ok(down.drums < build.drums && down.bass < build.bass, `down ${JSON.stringify(down)} under ${JSON.stringify(build)}`);
  const m = createMixMachine({ seed: 2 });
  const r = m.bar({ section: 'peak', changed: true, holds: { lead: false } });
  assert.equal(r.yes.lead, false);
  assert.ok(r.leans.drums.parts.some((p) => /section peak/.test(p.why)), 'the leans carry their reasons');
  // inside a phrase the mix holds: almost no thing flips off a 4-bar line
  const h = createMixMachine({ seed: 5 });
  let flips = 0;
  let prev = h.bar({ section: 'peak', changed: true }).yes;
  for (let b = 1; b < 64; b++) {
    const y = h.bar({ section: 'peak', changed: false, onLine: b % 4 === 0 }).yes;
    if (b % 4 !== 0) flips += MIX_KEYS.filter((k) => y[k] !== prev[k]).length;
    prev = y;
  }
  assert.ok(flips <= 4, `${flips} flips inside phrases over 64 bars`);
});

test('THE PLANNER lands every section change on a 4-bar line, most on 8 or 16, warms down after a peak, and follows the steering', () => {
  const run = (steer, seed = 3, bars = 400) => {
    const p = createPlanner({ seed });
    const out = [];
    for (let b = 0; b < bars; b++) out.push(p.bar({ theme: 'highlands', mood: { heat: 0.4 }, steer }));
    return out;
  };
  const free = run({});
  const changes = free.filter((o) => o.changed);
  assert.ok(changes.length >= 8);
  for (const c of changes) assert.equal(c.setBar % PLANNER.block, 0, `${c.section} at set bar ${c.setBar}`);
  assert.ok(changes.filter((c) => c.setBar % 8 === 0).length / changes.length >= 0.75, 'most land on 8 or 16 bar lines');
  // the hum comes only after a peak, a breakdown or an outro
  for (let i = 1; i < free.length; i++) if (free[i].changed && free[i].section === 'hum') assert.ok(['peak', 'breakdown', 'outro'].includes(free[i - 1].section));
  assert.ok(free.some((o) => o.section === 'hum'), 'a warm-down happens');
  // a push toward static (hold still) makes the quiet sections longer
  const quiet = (os) => os.filter((o) => ['breakdown', 'hum'].includes(o.section)).length;
  assert.ok(quiet(run({ static: 1 })) > quiet(free), 'static leans to breakdowns and the hum');
  // every transition move ends on its line: a drop's riser starts two bars before the peak
  for (const o of free) for (const m of o.moves) assert.equal(m.end - o.setBar, m.bars, `${m.key} spans to its line`);
  // the warm-down's rate: deep after a peak, calm otherwise
  const r = () => 0.3;
  assert.ok(['delta', 'theta'].includes(humChoice(r, { after: 'peak' }).rate));
  assert.ok(['alpha', 'schumann'].includes(humChoice(r, { after: 'outro', energy: 0.3 }).rate));
});

test('THE TAG holds the whole situation and playTag rebuilds the same tune, bar and chain', () => {
  const tunes = [...TUNES, ...REELS];
  const brain = createHouseDJ({ seed: 21, theme: 'highlands', tunes });
  let d;
  for (let b = 0; b < 30; b++) d = brain.bar({ mood: { heat: 0.5 } });
  const lead = d.lead;
  const tag = encodeTag({
    theme: 'highlands', pure: false, section: d.section, setBar: d.plan.setBar, set: d.plan.set, keyLift: d.keyLift,
    tune: { kind: lead.kind, seed: lead.seed, sources: lead.input, bar: lead.bar }, keyPc: lead.keyPc, bpm: 120, beat: 40,
    layers: d.mix.yes, energy: d.energy, chain: d.chain, moves: d.moves.map((m) => m.key), hum: d.hum, texture: d.texture,
    drumFamily: d.drumFamily, bassStyle: d.bassStyle, steer: STEER_IDLE, influence: { decay: d.influence.decay, window: d.influence.window },
  });
  assert.match(tag, /^HIGH\.house\.v1\.[0-9A-Z]+$/);
  const R = playTag(tag, { tunes });
  assert.deepEqual(R.tune.notes.map((n) => n.midi), brain.tune.notes.map((n) => n.midi), 'the same composed tune');
  assert.deepEqual(R.notes.map((n) => n.midi), d.notes.map((n) => n.midi), 'the same bar of it');
  assert.deepEqual(R.chain.map((c) => c.key), d.chain.map((c) => c.key));
  R.chain.forEach((c, i) => assert.ok(Math.abs(c.amount - d.chain[i].amount) <= 1 / 30 + 1e-9));
  assert.deepEqual(R.layers, d.mix.yes);
  const back = decodeTag(tag, { tunes: playableTunes(tunes) });
  assert.equal(back.tune.seed, lead.seed);
  assert.deepEqual(back.tune.sources.map((s) => s.id), lead.input);
  assert.ok(tagLines(back).some(([k]) => k === 'influence'));
});

test('THE TAG carries the influence window, and every rack effect has a place in the tag alphabet and a range', () => {
  const win = [{ keyPc: 2, mode: 'dorian', motif: [2, -1, 3], theme: 'embers', energy: 0.6, vote: 5 }, { keyPc: 7, mode: 'ionian', motif: [1], energy: 0.2 }];
  const t = encodeTag({ theme: 'deepsea', influence: { decay: 0.6, window: win } });
  const d = decodeTag(t);
  assert.equal(d.influence.window.length, 2);
  assert.deepEqual(d.influence.window.map((r) => [r.keyPc, r.mode, r.motif, r.vote]), [[2, 'dorian', [2, -1, 3], 5], [7, 'ionian', [1], null]]);
  assert.equal(d.influence.decay, 0.6);
  for (const k of RACK_KEYS) assert.ok(TAG_FX_ALPHABET.includes(k), `${k} has a tag index`);
  for (const e of RACK) for (const [n, p] of Object.entries(e.params)) assert.ok(p.min <= p.value && p.value <= p.max, `${e.key}.${n}`);
  const ctx = new Ctx();
  const r = buildRack(ctx, [{ key: 'plate', amount: 0.2 }, { key: 'hall', amount: 0.5 }]);
  r.amount('plate', 0.9, 1, 2);
  assert.deepEqual(r.amounts().map((x) => x.amount), [0.9, 0.5]);
});

test('VOTES: a rating names one tag; the DJ leans toward what well-rated tags had', () => {
  djVotes.clear();
  const good = encodeTag({ theme: 'highlands', section: 'peak', layers: { drums: true, bass: true }, chain: [{ key: 'plate', amount: 0.5 }] });
  const bad = encodeTag({ theme: 'highlands', section: 'breakdown', layers: { pad: true }, chain: [{ key: 'bitcrush', amount: 0.5 }] });
  djVotes.add({ tag: good, stars: 5 });
  djVotes.add({ tag: bad, stars: 1 });
  djVotes.add({ tag: good, stars: 4 });
  assert.equal(djVotes.list().length, 2, 'one rating per tag');
  const v = votesFromTags(djVotes.list(), (t) => decodeTag(t));
  assert.ok(v.sections.peak > 0 && v.sections.breakdown < 0);
  assert.ok(v.layers.drums > 0 && v.layers.pad < 0);
  assert.ok(v.fx.plate > 0 && v.fx.bitcrush < 0);
  const m = createMixMachine({ seed: 1 });
  const L = m.bar({ section: 'peak', changed: true, votes: v }).leans;
  assert.ok(L.drums.parts.some((p) => p.why === 'votes' && p.v > 0));
  djVotes.clear();
});

test('THE SET HOOKS: a set cycle tells its listeners whether the visitor adjusted it', () => {
  const dj = createDJ({ seed: 1, theme: 'highlands' });
  const seen = [];
  const off = dj.onSetCycle((e) => seen.push(e));
  assert.equal(dj.adjusted, false);
  dj.cycleSet({ reason: 'a new set', tag: 'X' });
  dj.steer('flute', 1);
  assert.equal(dj.adjusted, true);
  dj.cycleSet({ reason: 'a new set' });
  dj.steer('flute', 0);
  dj.cycleSet({}); // set 2 was adjusted (the push was still on when it began)
  dj.cycleSet({}); // set 3 was not: nothing is steered any more
  off();
  dj.cycleSet({});
  assert.deepEqual(seen.map((e) => [e.set, e.adjusted]), [[0, false], [1, true], [2, true], [3, false]]);
  assert.equal(dj.set, 5);
  assert.equal(seen[0].tag, 'X');
});

test('THE HOUSE DJ in the symphony: a tag every bar, the parts named, the brain and its layers play on the fake clock', () => {
  configure({ createContext: () => new Ctx() });
  const s = createSymphony({ seed: 8, theme: 'embers', auto: false, house: true, steer: null, votes: null });
  const E = unlockNow();
  writes.length = 0;
  for (let k = 0; k < 120; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  const st = s.state;
  assert.ok(st.tag && /^EMBE\.house\.v1\./.test(st.tag) || /\.house\.v1\./.test(st.tag), st.tag);
  assert.ok(st.mix && st.mix.section, 'the mix view');
  assert.ok(st.parts.chain.length >= 3 && st.parts.next, 'the parts name the chain and the next move');
  assert.ok(writes.every(Number.isFinite));
  // the set plays a decision on its own too
  const ctx = new Ctx();
  const set = createMixSet(ctx, ctx.destination, { seed: 1 });
  const brain = createHouseDJ({ seed: 1 });
  for (let b = 0; b < 40; b++) set.bar(b * 2, brain.bar({}), 0.5);
  assert.ok(set.state().rack.length >= 3);
  set.dispose();
  s.dispose();
  sound.setMuted(false);
});

test('THE LIVE DOOR (for LIVERADIO): settle-hear\'s playTag makes a playing symphony take the tag on its next bar; djLive carries the tag', async () => {
  const { djLive } = await import('../src/index.js');
  configure({ createContext: () => new Ctx() });
  const leader = createSymphony({ seed: 31, theme: 'highlands', auto: false, house: true, steer: null, votes: null });
  const E = unlockNow();
  for (let k = 0; k < 60; k++) { E.ctx.currentTime += 0.5; leader.tick(); }
  const tag = leader.state.tag;
  assert.equal(djLive.get().tag, tag, 'djLive carries the tag');
  const leaderTune = leader.state.mix.tune.label;
  leader.dispose();
  const follower = createSymphony({ seed: 77, theme: 'embers', auto: false, house: true, steer: null, votes: null });
  for (let k = 0; k < 6; k++) { E.ctx.currentTime += 0.5; follower.tick(); }
  const R = playTag(tag);
  assert.equal(R.sentLive, 1, 'one playing symphony was asked');
  for (let k = 0; k < 6; k++) { E.ctx.currentTime += 0.5; follower.tick(); }
  const st = follower.state;
  assert.equal(st.theme.key, 'highlands');
  assert.equal(st.mix.tune.label, leaderTune, 'the follower plays the leader\'s composed tune');
  assert.equal(playTag(tag, { live: false }).sentLive, 0);
  follower.dispose();
});
