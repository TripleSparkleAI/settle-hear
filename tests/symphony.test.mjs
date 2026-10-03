// The hero symphony: tuning at A = 432 exactly, the ABC reader, the tune rule, the five themes, the DJ's settled
// decisions (seeded, deterministic), the harmonic splits, the hidden toggles, and the player against a fake
// AudioContext (nothing before a gesture, the binaural pair dry and 40 Hz apart at home, no NaN reaching a param).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  A4, BEAT_HOME, FLUTE_MODE_NAME, midiHz, noteHz, harmonics, binaural, clampBeat, parseAbc, keyAccidentals, tuneBeats,
  TUNES, tuneProblems, playableTunes, placeTune, generatedPhrase, THEMES, themeOf, DJ_CHOICES, readHero, leans, anneal,
  DJ_PULLS, createDJ, rng, pickSplit, pickTheme, pickBeat, createSymphony, carrierOf, TRACKS, configure, unlockNow, getEngine, sound,
} from '../src/index.js';

// ── tuning ──
test('A = 432 exactly: midi 69 is 432 Hz, octaves are exact, A3 is 216', () => {
  assert.equal(A4, 432);
  assert.equal(midiHz(69), 432);
  assert.equal(midiHz(57), 216);
  assert.equal(midiHz(81), 864);
  assert.equal(noteHz('A4'), 432);
  assert.ok(Math.abs(noteHz('C4') - 256.87) < 0.01, `C4 at A=432 is ${noteHz('C4')}`);
  assert.ok(Number.isNaN(midiHz('x')) && Number.isNaN(noteHz('H9')));
});

test('the mode name is one constant', () => {
  assert.equal(typeof FLUTE_MODE_NAME, 'string');
  assert.match(FLUTE_MODE_NAME, /40 Hz/);
  assert.match(FLUTE_MODE_NAME, /432 Hz/);
});

test('harmonics are exact whole multiples, clamped to 1..7', () => {
  assert.deepEqual(harmonics(108, 3), [108, 216, 324]);
  assert.equal(harmonics(100, 99).length, 7);
  assert.equal(harmonics(100, 0).length, 1);
  assert.deepEqual(harmonics(NaN, 2), [108, 216]);
});

test('the binaural pair: right = left + beat, home 40 Hz, garbage clamped', () => {
  assert.deepEqual(binaural(216, 40), { left: 216, right: 256, beat: 40 });
  assert.equal(binaural(216).beat, BEAT_HOME);
  assert.equal(clampBeat(400), 45);
  assert.equal(clampBeat(-3), 1);
  assert.equal(clampBeat('x'), 40);
});

// ── ABC ──
test('ABC: key signatures, octaves, lengths, broken rhythm, triplets, repeats with endings', () => {
  assert.deepEqual(keyAccidentals('D'), { C: 1, D: 0, E: 0, F: 1, G: 0, A: 0, B: 0 });
  assert.equal(keyAccidentals('F#m').G, 1);
  assert.equal(keyAccidentals('Edor').C, 1);
  assert.equal(keyAccidentals('Bb').E, -1);
  const t = parseAbc('X:1\nT:test\nM:4/4\nL:1/8\nK:D\n|:A>B c2 d2 (3efg|1 a4 z4:|2 a8|]');
  assert.equal(t.title, 'test');
  assert.equal(t.key.pc, 2);
  const m = t.notes.map((n) => n.midi);
  // A4 B4 C#5 D5 E5 F#5 G5 A5 rest, again, then the second ending A5
  assert.deepEqual(m.slice(0, 9), [69, 71, 73, 74, 76, 78, 79, 81, null]);
  assert.equal(t.notes[0].beats, 0.75);
  assert.equal(t.notes[1].beats, 0.25);
  assert.ok(Math.abs(t.notes[4].beats - 1 / 3) < 1e-9);
  // the section (7 notes, 4 beats), the first ending (a4 z4), the section again, the second ending (a8)
  assert.equal(t.notes.length, 17);
  assert.equal(t.notes[16].beats, 4);
  assert.equal(tuneBeats(t.notes), 16);
});

test('ABC: accidentals last to the bar line, ties join, a chord keeps its first note', () => {
  const t = parseAbc('K:C\nL:1/4\n^F F | F2- F2 | [CEG] c');
  assert.deepEqual(t.notes.map((n) => n.midi), [66, 66, 65, 60, 72]);
  assert.equal(t.notes[2].beats, 4);
});

// ── tunes ──
test('every tune in TUNES names a public-domain printed source and parses', () => {
  for (const t of TUNES) assert.deepEqual(tuneProblems(t), [], `${t.id}: ${tuneProblems(t).join(', ')}`);
});

test('the tune rule refuses a tune with no book, a modern book, or no place in the book', () => {
  const ok = { id: 'x', title: 'x', abc: 'K:D\nL:1/8\nABcd efga|', source: { book: 'b', compiler: 'c', year: 1816, where: 'p. 1' } };
  assert.deepEqual(tuneProblems(ok), []);
  assert.ok(tuneProblems({ ...ok, source: { ...ok.source, book: '' } }).some((p) => /book/.test(p)));
  assert.ok(tuneProblems({ ...ok, source: { ...ok.source, year: 1950 } }).some((p) => /1950/.test(p)));
  assert.ok(tuneProblems({ ...ok, source: { ...ok.source, where: null } }).some((p) => /place/.test(p)));
  assert.ok(tuneProblems({ ...ok, abc: 'K:D\nABC' }).some((p) => /notes/.test(p)));
  assert.equal(playableTunes([ok, { ...ok, source: {} }]).length, 1);
  const cc0 = { ...ok, source: { kind: 'cc0', dataset: 'GregoBase', record: 'chant 1', licence: 'CC0', book: 'the Vatican edition' } };
  assert.deepEqual(tuneProblems(cc0), []);
  assert.ok(tuneProblems({ ...cc0, source: { ...cc0.source, licence: 'CC BY-SA' } }).some((p) => /CC0/.test(p)));
  assert.ok(tuneProblems({ ...cc0, source: { ...cc0.source, record: '' } }).some((p) => /record/.test(p)));
});

test('the cleared tunes: at least four, each parsed, the in-scale Sakura on E and the chants on their finals', () => {
  const ok = playableTunes();
  assert.ok(ok.length >= 4);
  const sakura = ok.find((t) => t.id === 'sakura');
  const pcs = new Set(sakura.parsed.notes.filter((n) => n.midi != null).map((n) => n.midi % 12));
  assert.deepEqual([...pcs].sort((a, b) => a - b), [0, 4, 5, 9, 11], 'E F A B C');
  const dies = ok.find((t) => t.id === 'dies-irae').parsed.notes;
  assert.equal(dies[dies.length - 1].midi % 12, 2, 'Dies irae ends on its final D');
  const ave = ok.find((t) => t.id === 'ave-maris-stella').parsed.notes;
  assert.equal(ave[2].midi, 70, 'the B is flat');
});

test('placeTune moves the tonic to the theme root and the middle near G5', () => {
  const p = parseAbc('K:D\nL:1/8\nDEFG ABcd|');
  const placed = placeTune(p, 57); // A
  assert.equal(((placed.notes[0].midi % 12) + 12) % 12, 9);
  const mids = placed.notes.map((n) => n.midi).sort((a, b) => a - b);
  assert.ok(Math.abs(mids[4] - 79) <= 6);
});

test('a generated phrase ends on the root and fills its beats', () => {
  const ph = generatedPhrase(rng(3), themeOf('highlands'), 8);
  assert.equal(ph[ph.length - 1].deg, 12);
  assert.ok(Math.abs(ph.reduce((a, n) => a + n.beats, 0) - 8) < 1e-9);
});

// ── themes ──
test('five themes, each complete, every beat set holds 40 Hz home', () => {
  assert.equal(THEMES.length, 5);
  assert.deepEqual(THEMES.map((t) => t.label), ['CRYSTALS', 'HIGHLANDS', 'DEEP SEA', 'CATHEDRAL', 'EMBERS']);
  for (const t of THEMES) {
    assert.ok(t.beats.includes(40), t.key);
    assert.ok(t.bpm[0] < t.bpm[1], t.key);
    assert.ok(Number.isFinite(noteHz(t.root)), t.key);
    assert.ok(t.instruments.flute > 0, `${t.key} has the flute`);
    const c = carrierOf(t);
    assert.ok(c >= 150 && c <= 300, `${t.key} carrier ${c}`);
  }
  assert.equal(carrierOf('highlands'), 216);
  assert.equal(themeOf('nonsense').key, 'highlands');
});

test('the theme pick is random, seeded, and never repeats the one we leave', () => {
  const r = rng(9);
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const t = pickTheme(r, 'crystals');
    assert.notEqual(t.key, 'crystals');
    seen.add(t.key);
  }
  assert.equal(seen.size, 4);
  const a = Array.from({ length: 10 }, ((r) => () => pickTheme(r, null).key)(rng(5)));
  const b = Array.from({ length: 10 }, ((r) => () => pickTheme(r, null).key)(rng(5)));
  assert.deepEqual(a, b);
});

test('pickBeat stays inside the theme set and comes home', () => {
  const r = rng(2);
  const t = themeOf('deepsea');
  let home = 0;
  for (let i = 0; i < 400; i++) {
    const b = pickBeat(r, t, 5, 10);
    assert.ok(t.beats.includes(b));
    if (b === 40) home++;
  }
  assert.ok(home > 200, `came home ${home} of 400`);
  for (let i = 0; i < 50; i++) assert.notEqual(pickBeat(r, t, 40, 0), 40);
});

// ── the DJ ──
const cooling = (k, item = { word: 'SETTLE' }) => {
  const u = (k % 6) / 5;
  return { T: 3 * Math.pow(0.15, u), q: 0.2 + 0.78 * u, flips: Math.round(200 * (1 - u)), n: 400, phase: u >= 0.8 ? 'settled' : 'cooling', index: Math.floor(k / 6), item };
};

test('readHero maps the stats into 0..1 and refuses garbage', () => {
  const hot = readHero({ T: 3, q: -0.2, flips: 200, n: 400, phase: 'cooling', item: { word: 'p-bit' } });
  assert.equal(hot.heat, 1);
  assert.equal(hot.overlap, 0);
  assert.equal(hot.flips, 1);
  assert.equal(hot.letters, 4);
  const cold = readHero({ T: 0.45, q: 0.97, phase: 'settled', item: { film: 'h.json' }, film: { frame: 3 } }, { index: 0, frame: 2 });
  assert.equal(cold.heat, 0);
  assert.equal(cold.landed, true);
  assert.equal(cold.film, true);
  assert.equal(cold.frameMoved, true);
  const junk = readHero({ T: NaN, q: 'x', n: 0 });
  for (const k of ['heat', 'overlap', 'flips']) assert.ok(Number.isFinite(junk[k]) && junk[k] >= 0 && junk[k] <= 1);
  assert.equal(readHero(null).live, false);
});

test('leans follow the picture: a landed, high-overlap field leans static; a hot one leans away from it', () => {
  const mem = { barsSinceBeat: 0, barsSinceTheme: 0, barsStatic: 0, barsFlute: 0, barsQuiet: 0, barsDrone: 0, beatAway: 0, beat: 40 };
  const landed = leans(readHero({ T: 0.45, q: 0.95, flips: 4, n: 400, phase: 'settled', item: { shape: 'sdm' } }), mem, themeOf('highlands'));
  const hot = leans(readHero({ T: 3, q: 0.05, flips: 200, n: 400, phase: 'cooling', item: { shape: 'sdm' } }), mem, themeOf('highlands'));
  assert.ok(landed.static.total > 1, `landed static ${landed.static.total}`);
  assert.ok(hot.static.total < -1, `hot static ${hot.static.total}`);
  assert.ok(hot.beat.total > landed.beat.total);
  assert.ok(landed.static.parts.some((p) => p.why === 'landed'));
});

test('anneal is the p-bit rule: strong leans win, clamps hold, the trace has every sweep', () => {
  const h = { beat: -6, theme: -6, static: 6, split: 0, flute: 0, drone: -6 };
  const A = anneal(h, DJ_PULLS, {}, rng(1));
  assert.equal(A.trace.length, 24);
  assert.equal(A.yes.static, true);
  assert.equal(A.yes.beat, false);
  assert.equal(A.yes.split, true, 'the static-split pull carries split');
  const withStatic = anneal(h, DJ_PULLS, {}, rng(1), { clamps: { static: true, drone: false } }).pYes.flute;
  const without = anneal(h, DJ_PULLS, {}, rng(1), { clamps: { static: false, drone: false } }).pYes.flute;
  assert.ok(withStatic < without, `the static-flute pull pushes the flute out: ${withStatic} < ${without}`);
  const C = anneal(h, DJ_PULLS, {}, rng(1), { clamps: { static: false } });
  assert.equal(C.yes.static, false);
  assert.ok(C.trace.every((w) => w.s[2] === -1));
  assert.ok(A.trace[0].T > A.trace[23].T);
});

test('the DJ is deterministic: same seed and same stats, the same set', () => {
  const run = (seed) => { const dj = createDJ({ seed }); return Array.from({ length: 60 }, (_, k) => { const d = dj.bar(cooling(k)); return `${d.theme.key}/${d.mode}/${d.beat}/${d.harmonics}`; }); };
  assert.deepEqual(run(42), run(42));
  assert.notDeepEqual(run(42), run(43));
});

test('over a long set the DJ visits every mode, changes beat and theme, and comes home to 40 Hz', () => {
  const dj = createDJ({ seed: 7 });
  const items = [{ word: 'SETTLE' }, { shape: 'sdm' }, { film: 'h.json' }, { word: 'neuron' }];
  const modes = new Set();
  const themes = new Set();
  const beats = [];
  for (let k = 0; k < 400; k++) {
    const d = dj.bar({ ...cooling(k, items[Math.floor(k / 6) % 4]), film: { frame: k } });
    modes.add(d.mode);
    themes.add(d.theme.key);
    beats.push(d.beat);
    assert.equal(DJ_CHOICES.length, Object.keys(d.yes).length);
  }
  assert.deepEqual([...modes].sort(), ['drone', 'static', 'tune'].concat(modes.has('bed') ? ['bed'] : []).sort());
  assert.ok(themes.size >= 3, `themes ${[...themes]}`);
  assert.ok(new Set(beats).size >= 4, 'many beats');
  const home = beats.filter((b) => b === 40).length / beats.length;
  assert.ok(home > 0.35, `home ${home}`);
});

test('harmonic splits: 2..7, by the word letters or a random draw, only in static mode', () => {
  const ns = new Set();
  const r = rng(11);
  for (let i = 0; i < 300; i++) {
    const p = pickSplit(r, { letters: 6, word: 'SETTLE' });
    assert.ok(p.n >= 2 && p.n <= 7);
    ns.add(p.n);
    if (/letters/.test(p.how)) assert.equal(p.n, 6);
  }
  assert.equal(ns.size, 6, `every split from 2 to 7: ${[...ns]}`);
  assert.equal(pickSplit(rng(1), { letters: 40, word: 'x'.repeat(40) }).n <= 7, true);
  const dj = createDJ({ seed: 3 });
  let splits = 0;
  for (let k = 0; k < 300; k++) {
    const d = dj.bar(cooling(k));
    if (d.mode !== 'static' && !d.yes.static) assert.equal(d.harmonics, 1);
    if (d.harmonics > 1) { splits++; assert.ok(d.harmonics >= 2 && d.harmonics <= 7); }
  }
  assert.ok(splits > 0);
});

test('hidden toggles: lock the theme, hold the beat at 40, clamp a light', () => {
  const dj = createDJ({ seed: 5, theme: 'embers' });
  dj.lockTheme(true);
  dj.holdBeat(true);
  dj.clamp('drone', true);
  for (let k = 0; k < 200; k++) {
    const d = dj.bar(cooling(k));
    assert.equal(d.theme.key, 'embers');
    assert.equal(d.beat, 40);
    assert.equal(d.yes.drone, true);
    assert.equal(d.mode, 'drone');
  }
  dj.clamp('drone', null);
  dj.lockTheme(false);
  assert.equal(dj.clamps.drone, null);
});

// ── the player, against a fake AudioContext ──
const writes = [];
class Param {
  constructor(v, min = -3.4e38, max = 3.4e38) { this.value = v; this.minValue = min; this.maxValue = max; }
  rec(v) { writes.push(v); if (!Number.isFinite(v)) throw new TypeError(`non-finite ${v}`); }
  setValueAtTime(v) { this.rec(v); this.value = v; }
  setTargetAtTime(v) { this.rec(v); this.value = v; }
  linearRampToValueAtTime(v) { this.rec(v); this.value = v; }
  exponentialRampToValueAtTime(v) { this.rec(v); this.value = v; }
  cancelScheduledValues() {}
}
const made = [];
class Node {
  constructor(kind, params = {}) { this.kind = kind; this.out = []; Object.assign(this, params); made.push(this); }
  connect(n, a, b) { this.out.push({ n, a, b }); return n; }
  disconnect() { this.out = []; }
}
class Ctx {
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = new Node('destination'); }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
  createGain() { return new Node('gain', { gain: new Param(1) }); }
  createBiquadFilter() { return new Node('biquad', { type: 'lowpass', frequency: new Param(350, 0, 24000), Q: new Param(1), gain: new Param(0) }); }
  createDynamicsCompressor() { return new Node('compressor', { threshold: new Param(-24), knee: new Param(30), ratio: new Param(12), attack: new Param(0.003), release: new Param(0.25) }); }
  createConvolver() { return new Node('convolver', { buffer: null }); }
  createDelay() { return new Node('delay', { delayTime: new Param(0) }); }
  createStereoPanner() { return new Node('panner', { pan: new Param(0, -1, 1) }); }
  createWaveShaper() { return new Node('shaper', { curve: null, oversample: 'none' }); }
  createChannelMerger(n) { return new Node('merger', { inputs: n }); }
  createOscillator() { return new Node('osc', { type: 'sine', frequency: new Param(440, 0, 24000), detune: new Param(0), start() {}, stop() {}, onended: null }); }
  createBufferSource() { return new Node('src', { buffer: null, loop: false, playbackRate: new Param(1), start() {}, stop() {} }); }
  createBuffer(ch, n, rate) { const data = Array.from({ length: ch }, () => new Float32Array(n)); return { numberOfChannels: ch, length: n, sampleRate: rate, getChannelData: (c) => data[c] }; }
}

test('the player: no audio before a gesture, but the DJ still decides', () => {
  let built = 0;
  configure({ createContext: () => { built++; return new Ctx(); } });
  const s = createSymphony({ seed: 1, auto: false });
  s.update(cooling(0));
  s.tick(100);
  s.tick(103);
  assert.equal(getEngine(), null);
  assert.equal(built, 0);
  assert.ok(s.state.decision, 'a decision was made on the wall clock');
  s.dispose();
});

test('the player after a gesture: a dry binaural pair at the theme root and root + 40, finite params, voices built', () => {
  unlockNow();
  sound.setMuted(false);
  const E = getEngine();
  assert.ok(E);
  const s = createSymphony({ seed: 4, theme: 'highlands', auto: false });
  s.dj.lockTheme(true);
  s.dj.holdBeat(true);
  const osc0 = made.length;
  for (let k = 0; k < 40; k++) {
    E.ctx.currentTime = k * 2.5;
    s.update({ ...cooling(k), film: { frame: k } });
    s.tick();
  }
  assert.ok(s.state.audible);
  const mergers = made.filter((n) => n.kind === 'merger');
  assert.ok(mergers.length >= 1, 'a channel merger for the two ears');
  const earOscs = made.filter((n) => n.kind === 'gain' && n.out.some((o) => o.n.kind === 'merger'));
  assert.deepEqual(earOscs.map((g) => g.out[0].b).sort(), [0, 1], 'one gain into each ear');
  // the two ear oscillators sit at 216 and 256 (A3 and A3 + 40)
  const freqs = made.filter((n) => n.kind === 'osc' && n.out.some((o) => earOscs.includes(o.n))).map((o) => o.frequency.value).sort((a, b) => a - b);
  assert.deepEqual(freqs, [216, 256]);
  // the pair's chain never touches the reverb or the delay
  const reach = (n, seen = new Set()) => { if (seen.has(n)) return seen; seen.add(n); for (const o of n.out) reach(o.n, seen); return seen; };
  const hit = reach(mergers[0]);
  assert.ok(![...hit].some((n) => n.kind === 'convolver' || n.kind === 'delay'), 'binaural is dry');
  assert.ok(made.length > osc0 + 20, 'notes were scheduled');
  assert.ok(writes.every(Number.isFinite));
  assert.equal(s.state.tracks.flute, true);
  s.dispose();
});

test('hidden toggles on the player: a track switched off schedules no notes of it', () => {
  const E = getEngine();
  const s = createSymphony({ seed: 9, theme: 'highlands', auto: false, tracks: { flute: false, fiddle: false, harp: false, bells: false, crystal: false } });
  s.dj.lockTheme(true);
  s.dj.clamp('flute', true);
  s.dj.clamp('static', false);
  s.dj.clamp('drone', false);
  const before = made.length;
  for (let k = 0; k < 20; k++) { E.ctx.currentTime = 200 + k * 3; s.update(cooling(k)); s.tick(); }
  const newOscs = made.slice(before).filter((n) => n.kind === 'osc');
  // only the long voices (drone 3, harmonics 7, binaural 2) are built, no struck notes
  assert.ok(newOscs.length <= 12, `oscillators ${newOscs.length}`);
  assert.equal(s.state.decision.mode, 'tune');
  s.setTrack('flute', true);
  const b2 = made.length;
  for (let k = 20; k < 30; k++) { E.ctx.currentTime = 200 + k * 3; s.update(cooling(k)); s.tick(); }
  assert.ok(made.slice(b2).filter((n) => n.kind === 'osc').length > 4, 'the flute plays once switched on');
  assert.deepEqual(TRACKS.slice().sort(), Object.keys(s.tracks).sort());
  s.dispose();
});

test('the player schedules nothing while muted or stopped', () => {
  const E = getEngine();
  const s = createSymphony({ seed: 12, auto: false });
  sound.setMuted(true);
  const before = made.length;
  for (let k = 0; k < 10; k++) { E.ctx.currentTime = 500 + k * 3; s.update(cooling(k)); s.tick(); }
  assert.equal(made.slice(before).filter((n) => n.kind === 'osc').length, 0);
  sound.setMuted(false);
  s.stop();
  const b2 = made.length;
  for (let k = 0; k < 10; k++) { E.ctx.currentTime = 600 + k * 3; s.update(cooling(k)); s.tick(); }
  assert.equal(made.slice(b2).filter((n) => n.kind === 'osc').length, 0);
  assert.equal(s.state.playing, false);
  s.dispose();
});

// ── THE MASTER BEAT (lane MASTERBEAT): every bar is a whole number of master ticks and starts on one ──
import { toMasterTime, snapToTick } from '../src/masterbeat.js';

test('on the audio clock every bar line the DJ schedules is a master tick, and every bar is whole ticks long', () => {
  unlockNow();
  sound.setMuted(false);
  const E = getEngine();
  const s = createSymphony({ seed: 21, theme: 'highlands', auto: false });
  const bars = [];
  s.subscribe((st) => { if (st.bpm) bars.push(st.bpm); });
  for (let k = 0; k < 60; k++) {
    E.ctx.currentTime = 300 + k * 0.25;
    s.update(cooling(k));
    s.tick();
  }
  assert.ok(bars.length >= 4, `${bars.length} bars`);
  for (const bpm of bars) {
    const barMs = (4 * 60000) / bpm;
    assert.ok(Math.abs(barMs / 500 - Math.round(barMs / 500)) < 1e-6, `a ${barMs} ms bar`);
  }
  // snapToTick is the identity on a tick (the bar lines it returns are ticks)
  const t = snapToTick(E.ctx, 301.234);
  assert.ok(Math.abs(toMasterTime(E.ctx, t) / 500 - Math.round(toMasterTime(E.ctx, t) / 500)) < 1e-6);
  s.dispose();
});
