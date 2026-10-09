// THE ECHO GUITAR (lane ECHOGUITAR): the voice, its tempo-synced echo, its room, its phrases, its level and its seat
// in THE DJ's answer, each rendered offline (tests/offline.mjs) or traced on the fake context and measured.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderSound, mono, measure } from './offline.mjs';
import { Ctx, all, reach } from './fakeaudio.mjs';
import { TONE } from '../src/tone.js';
import { ECHO_GUITAR, ECHO_PHRASES, guitarNote, createEcho, createRoom, phrasePlan, phraseOf, playEchoPhrase } from '../src/echoguitar.js';
import {
  INSTRUMENT_KEYS, playNote, midiHz, MODES, SLOT_INSTRUMENTS, INST_ALPHABET, INST_PEAK, REGISTER,
  createMixSet, createHouseDJ, realizeVoice, slotIndex, createVoiceDealer, HOUSE_SLOTS,
  loadEchoGuitar, echoGuitarNow, ECHO_PHRASE_COUNT,
} from '../src/index.js';

const SR = 48000;
const SRC = (f) => readFileSync(fileURLToPath(new URL(`../src/${f}`, import.meta.url)), 'utf8');
const noComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const ANALYSIS = JSON.parse(readFileSync(fileURLToPath(new URL('../../runs/echoguitar/analysis.json', import.meta.url)), 'utf8'));

// the envelope of a mono signal in 5 ms windows, in dB
function envDb(x, sr = SR, w = 0.005) {
  const n = Math.round(w * sr); const out = [];
  for (let i = 0; i + n <= x.length; i += n) { let e = 0; for (let k = i; k < i + n; k++) e += x[k] * x[k]; out.push({ t: (i + n / 2) / sr, db: 10 * Math.log10(e / n + 1e-20) }); }
  return out;
}
// the strongest pitch of a short span by a zero-padded DFT scan of one band
function pitchAt(x, t, { lo = 200, hi = 700, span = 0.06, sr = SR } = {}) {
  const a = Math.round((t - span / 2) * sr); const n = Math.round(span * sr);
  let best = 0; let bf = 0;
  for (let f = lo; f <= hi; f += 0.5) {
    let re = 0; let im = 0;
    for (let i = 0; i < n; i++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n); const v = x[a + i] * w; const ph = (2 * Math.PI * f * i) / sr; re += v * Math.cos(ph); im -= v * Math.sin(ph); }
    const m = re * re + im * im; if (m > best) { best = m; bf = f; }
  }
  return bf;
}

test('the reference numbers the voice answers are the measured ones (analysis.json), not typed by hand', () => {
  const R = ECHO_GUITAR.reference;
  assert.equal(R.bpm, ANALYSIS.tempo.bpm);
  assert.equal(R.echoSeconds, ANALYSIS.echo.seconds);
  assert.equal(R.echoBeats, ANALYSIS.echo.beats);
  assert.equal(R.dbPerRepeat, ANALYSIS.feedback.dbPerRepeat);
  assert.equal(R.loopGain, ANALYSIS.feedback.loopGain);
  assert.equal(R.slideSemitones, ANALYSIS.slide.glides[0].semitones);
  assert.equal(R.slideSeconds, ANALYSIS.slide.glides[0].seconds);
  assert.deepEqual([...R.harmonicsDb], ANALYSIS.tone.harmonicsDb.slice(0, 6));
  assert.ok(Math.abs(R.roomCeilingSeconds - ANALYSIS.room.rt60Seconds) < 0.05);
  // the reference ran 2% short of a dotted eighth; ours is locked to it
  assert.ok(Math.abs(ANALYSIS.echo.beats - 0.75) < 0.02 && ECHO_GUITAR.echoBeats === 0.75);
});

test('THE ECHO is locked to the tempo: a dotted eighth at every tempo, and setBeat moves it', () => {
  const ctx = new Ctx();
  for (const bpm of [100, 118, 120, 126, 140]) {
    const e = createEcho(ctx, ctx.destination, { beatDur: 60 / bpm });
    assert.ok(Math.abs(e.seconds - 0.75 * (60 / bpm)) < 1e-9, `${bpm} bpm: ${e.seconds}`);
  }
  const e = createEcho(ctx, ctx.destination, { beatDur: 0.5 });
  e.setBeat(60 / 126, 1);
  assert.ok(Math.abs(e.seconds - 0.75 * (60 / 126)) < 1e-9);
});

test('THE ECHO, rendered: repeats every 0.375 s at 120 bpm, each 3 to 6 dB under the last, and darker', () => {
  const r = renderSound((c, d, t) => { const e = createEcho(c, d, { beatDur: 0.5 }); guitarNote(c, e.input, midiHz(64), t, 0.06, 1); return t; }, { seconds: 3, sampleRate: SR });
  const x = mono(r);
  const env = envDb(x);
  // the strongest window within +- 30 ms of each repeat's expected time
  const at = (c) => env.filter((p) => Math.abs(p.t - c) <= 0.03).reduce((a, p) => (p.db > a.db ? p : a));
  // the dry note's own peak is the anchor (a plucked note peaks some ms after its start), each repeat sought from it
  const dry = env.filter((p) => p.t <= 0.12).reduce((a, p) => (p.db > a.db ? p : a));
  const reps = [1, 2, 3, 4, 5].map((k) => at(dry.t + k * 0.375));
  // the repeat time: the lag (0.25 to 0.5 s, 1 ms steps) at which the linear envelope best matches itself, the
  // reading the analysis used on the reference (a 5 ms window's peak wanders on a repeat's broad top)
  const lin = []; const w1 = Math.round(0.001 * SR);
  for (let i = 0; i + w1 <= x.length; i += w1) { let e = 0; for (let k = i; k < i + w1; k++) e += x[k] * x[k]; lin.push(e); }
  let lag = 0; let bestC = -1;
  for (let L = 250; L <= 500; L++) { let c = 0; let n0 = 0; let n1 = 0; for (let i = 0; i + L < lin.length; i++) { c += lin[i] * lin[i + L]; n0 += lin[i] ** 2; n1 += lin[i + L] ** 2; } c /= Math.sqrt(n0 * n1) || 1; if (c > bestC) { bestC = c; lag = L / 1000; } }
  assert.ok(Math.abs(lag - 0.375) <= 0.002, `the echo repeats every ${lag} s`);
  for (let k = 1; k < reps.length; k++) assert.ok(Math.abs(reps[k].t - reps[0].t - k * 0.375) <= 0.03, `repeat ${k + 1} at ${reps[k].t}`);
  const falls = reps.slice(1).map((p, i) => reps[i].db - p.db);
  for (const f of falls) assert.ok(f >= 3 && f <= 6.5, `a repeat falls ${f.toFixed(2)} dB`);
  // vacuity control: between two repeats the level sits well under both
  const mid = at(dry.t + 2.5 * 0.375);
  assert.ok(mid.db < reps[2].db - 6, `the gap between repeats ${mid.db.toFixed(1)} vs ${reps[2].db.toFixed(1)}`);
  // each repeat is darker: the share of energy above 1.5 kHz falls from the first repeat to the fourth
  const hiShare = (c) => { const a = Math.round((c - 0.02) * SR); const seg = x.slice(a, a + Math.round(0.08 * SR)); const m = measure(Object.assign(seg, { sampleRate: SR })); return m.bands.slice(-6).reduce((s, v) => s + v, 0); };
  assert.ok(hiShare(dry.t + 4 * 0.375) < hiShare(dry.t + 1 * 0.375), 'the fourth repeat is darker than the first');
});

test('THE ROOM is small: its tail falls 60 dB in 0.5 to 1.4 s', () => {
  const r = renderSound((c, d, t) => {
    const room = createRoom(c, d, { wet: 1 });
    const s = c.createBufferSource(); const b = c.createBuffer(1, 240, c.sampleRate); const ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (i % 2 ? 1 : -1) * (1 - i / ch.length);
    s.buffer = b; s.connect(room.input); s.start(t); return t;
  }, { seconds: 2.5, sampleRate: SR });
  const env = envDb(mono(r)).filter((p) => p.t > 0.08 && p.t < 1.2);
  const n = env.length; const mx = env.reduce((a, p) => a + p.t, 0) / n; const my = env.reduce((a, p) => a + p.db, 0) / n;
  const slope = env.reduce((a, p) => a + (p.t - mx) * (p.db - my), 0) / env.reduce((a, p) => a + (p.t - mx) ** 2, 0);
  const rt60 = -60 / slope;
  assert.ok(rt60 > 0.5 && rt60 < 1.4, `RT60 ${rt60.toFixed(2)} s`);
});

test('THE SLIDE: a note slides up one scale step (2 semitones here) in about 0.15 s and holds there', () => {
  const f0 = midiHz(64); const f1 = midiHz(66);
  const r = renderSound((c, d, t) => { guitarNote(c, d, f0, t, 1, 1, { to: f1, at: t + 0.3, time: 0.15 }); return t; }, { seconds: 1.4, sampleRate: SR });
  const x = mono(r);
  const before = pitchAt(x, 0.2); const after = pitchAt(x, 0.7);
  assert.ok(Math.abs(12 * Math.log2(before / f0)) < 0.15, `before ${before} vs ${f0}`);
  assert.ok(Math.abs(12 * Math.log2(after / f1)) < 0.15, `after ${after} vs ${f1}`);
  // control: the same note without a slide stays put
  const r2 = renderSound((c, d, t) => { guitarNote(c, d, f0, t, 1, 1); return t; }, { seconds: 1.4, sampleRate: SR });
  assert.ok(Math.abs(12 * Math.log2(pitchAt(mono(r2), 0.7) / f0)) < 0.15);
});

test('THE PHRASES are our own: single notes, one slide each, in the key, and never the reference\'s falling root steps', () => {
  assert.equal(ECHO_PHRASES.length, 3);
  // the reference held fifths whose roots fell C, B, A, G: steps -1, -2, -2
  const ref = ANALYSIS.notes.reading.includes('C, B, A, G') ? [-1, -2, -2] : null;
  assert.ok(ref, 'the analysis names the reference roots');
  for (const mode of Object.keys(MODES).filter((m) => MODES[m].length === 7)) {
    for (const P of ECHO_PHRASES) {
      const notes = phrasePlan({ root: 57, mode, phrase: P, beatDur: 0.5 });
      assert.equal(notes.filter((n) => n.slideTo != null).length, 1, `${P.key} ${mode}: one slide`);
      const pcs = new Set(MODES[mode].map((s) => (57 + s) % 12));
      for (const n of notes) { assert.ok(pcs.has(n.midi % 12), `${P.key} ${mode}: ${n.midi} in the key`); if (n.slideTo != null) assert.ok(pcs.has(n.slideTo % 12) && n.slideTo > n.midi && n.slideTo - n.midi <= 2); }
      // single notes: no two start together
      const starts = notes.map((n) => n.t);
      assert.equal(new Set(starts).size, starts.length, `${P.key}: single notes, never a dyad`);
      const steps = notes.slice(1).map((n, i) => n.midi - notes[i].midi);
      for (let i = 0; i + ref.length <= steps.length; i++) assert.notDeepEqual(steps.slice(i, i + ref.length), ref, `${P.key} ${mode}`);
      // the phrase sits near the guitar's register
      const mid = notes.reduce((a, n) => a + n.midi, 0) / notes.length;
      assert.ok(Math.abs(mid - REGISTER['echo-guitar']) <= 6, `${P.key} ${mode}: centre ${mid}`);
    }
  }
  assert.deepEqual([0, 1, 2, 3].map((s) => phraseOf(s).key), ['climb', 'turn', 'call', 'climb']);
});

test('THE LEVEL: the whole phrase, echoes and room included, at velocity 1, sits under the loudest existing instrument', () => {
  const others = INSTRUMENT_KEYS;
  const loud = others.map((inst) => {
    const m = measure(renderSound((c, d, t) => { playNote(c, d, inst, midiHz(64), t, 1, 1); return t; }, { seconds: 2, sampleRate: SR }));
    return { inst, rms50: m.rms50, peak: m.peak };
  });
  const top = loud.reduce((a, b) => (b.rms50 > a.rms50 ? b : a));
  const topPeak = Math.max(...loud.map((l) => l.peak));
  // every phrase at three roots (the loudest was the turn at 57 and the call at 64, untrimmed 0.35 peak)
  for (let seed = 0; seed < ECHO_PHRASES.length; seed++) for (const root of [57, 60, 64]) {
    const g = measure(renderSound((c, d) => { const R = playEchoPhrase(c, d, { t0: 0.01, beatDur: 0.5, root, mode: 'ionian', seed, vel: 1 }); return R.end; }, { seconds: 6, sampleRate: SR }));
    const tag = `${phraseOf(seed).key} at ${root}`;
    assert.ok(g.rms50 < top.rms50, `${tag}: the echo guitar ${g.rms50.toFixed(4)} vs ${top.inst} ${top.rms50.toFixed(4)}`);
    assert.ok(g.peak < topPeak, `${tag}: peak ${g.peak.toFixed(4)} vs ${topPeak.toFixed(4)}`);
    // vacuity control: the phrase is not silent
    assert.ok(g.rms50 > top.rms50 * 0.1, `${tag}: the echo guitar sounds: ${g.rms50.toFixed(4)}`);
  }
  assert.equal(INST_PEAK['echo-guitar'], ECHO_GUITAR.peak);
});

test('THE TABLES: the echo guitar is appended to the tag alphabet and sits in the answer\'s bag', () => {
  // append-only: a tag stores an index, so the echo guitar keeps index 9 (lane DJGUITARS appended two after it)
  assert.equal(INST_ALPHABET[9], 'echo-guitar', 'append-only: a tag stores an index');
  assert.deepEqual(INST_ALPHABET.slice(0, 9), ['flute', 'flute-drive', 'keys', 'pluck', 'harp', 'bells', 'crystal', 'fiddle', 'chop']);
  assert.ok(INST_ALPHABET.length <= 16, 'the tag gives an instrument 4 bits');
  assert.ok(SLOT_INSTRUMENTS.answer.includes('echo-guitar'));
  // THE DECK RULE: the answer's bag of five deals the echo guitar within five sets
  const dealer = createVoiceDealer({ seed: 9 });
  const answers = Array.from({ length: SLOT_INSTRUMENTS.answer.length }, () => dealer.palette({ slots: HOUSE_SLOTS }).voices.find((v) => v.slot === 'answer').inst);
  assert.equal(new Set(answers).size, SLOT_INSTRUMENTS.answer.length, answers.join(', '));
});

test('ON DEMAND: no module in the hero\'s static graph imports the voice; the loader fetches it once and holds it', async () => {
  // the site's first load carries settle-hear's index, mix-layers.js and instruments.js; none may import echoguitar.js
  for (const f of ['index.js', 'mix-layers.js', 'instruments.js', 'voice-fx.js', 'symphony-index.js']) {
    assert.doesNotMatch(noComments(SRC(f)), /from '\.\/echoguitar\.js'/, `${f} imports the voice statically`);
  }
  // lane DJGUITARS: the loader fetches djguitars.js, which re-exports this voice, so both guitars share one chunk
  assert.match(noComments(SRC('echoguitar-lazy.js')), /import\('\.\/djguitars\.js'\)/, 'the loader imports it dynamically');
  const a = loadEchoGuitar(); const b = loadEchoGuitar();
  assert.equal(a, b, 'one fetch, one promise');
  const m = await a;
  assert.equal(echoGuitarNow(), m);
  assert.equal(m.ECHO_PHRASES, ECHO_PHRASES, 'the same module the tests import by path (re-exported by djguitars.js)');
  assert.equal(ECHO_PHRASE_COUNT, ECHO_PHRASES.length, 'the deck size the mix uses matches the phrases');
  // the loaded module's dry note makes the guitar's six partials (all under 9 kHz at E4)
  const ctx = new Ctx(); const m0 = all.length;
  assert.ok(m.guitarNote(ctx, ctx.destination, midiHz(64), 0, 0.5, 0.8));
  assert.equal(all.slice(m0).filter((n) => n.kind === 'osc').length, 6);
  // THE TONE RULES, as modes.test.mjs holds them for every playNote instrument: the envelope starts at 0, ramps over
  // at least the attack floor, and lets go with a time constant of at least a third of the release floor
  const env = all.slice(m0).find((n) => n.kind === 'gain' && n.gain.events.length >= 3 && n.gain.events[0][1] === 0);
  assert.ok(env, 'the note has an envelope');
  const [, , t0] = env.gain.events[0]; const up = env.gain.events.find((e) => e[0] === 'lin');
  assert.ok(up && up[2] - t0 >= TONE.attackMin, `attack ${up?.[2] - t0}`);
  const fall = env.gain.events.find((e) => e[0] === 'target' && e[1] === 0);
  assert.ok(fall && fall[3] >= TONE.releaseMin / 3, `release tau ${fall?.[3]}`);
  // the guitar is a phrase voice, not a playNote instrument (like the chop): playNote would have to sound before the
  // module arrives, and the tone rules test every playNote instrument at once
  assert.ok(!INSTRUMENT_KEYS.includes('echo-guitar'));
  assert.equal(noComments(SRC('instruments.js')).includes('echo-guitar'), false);
});

test('THE DJ\'s answer: dealt the echo guitar, a set plays its phrase on the answer bus with a dotted-eighth echo', async () => {
  await loadEchoGuitar();
  const ctx = new Ctx();
  const set = createMixSet(ctx, ctx.destination, { seed: 5 });
  const brain = createHouseDJ({ seed: 5, theme: 'deepsea' });
  const asGuitar = (d) => ({
    ...d,
    mix: { ...d.mix, yes: { ...d.mix.yes, answer: true } },
    voices: { ...d.voices, voices: d.voices.voices.map((v) => (v.slot === 'answer' ? realizeVoice(d.voices.seed, slotIndex('answer'), { slot: 'answer', inst: 'echo-guitar', keys: v.keys }) : v)) },
  });
  let played = 0;
  for (let b = 0; b < 8; b++) {
    const d = asGuitar(brain.bar({}));
    const m0 = all.length;
    set.bar(b * 2, d, 0.5);
    const made = all.slice(m0);
    // the guitar's own room is the marker (its first comb is 29.7 ms, no other voice uses it); its echo sits beside it
    const rooms = made.filter((n) => n.kind === 'delay' && n.delayTime.value === 0.0297);
    const echoes = made.filter((n) => n.kind === 'delay' && Math.abs(n.delayTime.value - 0.375) < 1e-9);
    if (d.bar % 2 === 0) { assert.equal(rooms.length, 1, `bar ${d.bar}: one phrase`); assert.ok(echoes.length >= 1, `bar ${d.bar}: its echo`); played += 1; }
    else assert.equal(rooms.length, 0, `bar ${d.bar}: no answer on an odd bar`);
  }
  assert.ok(played >= 3, `${played} phrases`);
  set.dispose();
  // control: the same bars on the keys play no echo guitar
  const set2 = createMixSet(ctx, ctx.destination, { seed: 5 });
  const brain2 = createHouseDJ({ seed: 5, theme: 'deepsea' });
  const m0 = all.length;
  for (let b = 0; b < 8; b++) {
    const d = brain2.bar({});
    set2.bar(b * 2, { ...d, voices: { ...d.voices, voices: d.voices.voices.map((v) => (v.slot === 'answer' ? realizeVoice(d.voices.seed, slotIndex('answer'), { slot: 'answer', inst: 'keys', keys: v.keys }) : v)) } }, 0.5);
  }
  assert.equal(all.slice(m0).filter((n) => n.kind === 'delay' && n.delayTime.value === 0.0297).length, 0, 'the keys answer with no echo guitar');
  set2.dispose();
});

test('THE PHRASE DECK across sets: a new set deals the next card, and every phrase comes round before one repeats', async () => {
  await loadEchoGuitar();
  const ctx = new Ctx();
  const set = createMixSet(ctx, ctx.destination, { seed: 11 });
  const brain = createHouseDJ({ seed: 11, theme: 'deepsea' });
  const keys = [];
  for (let s = 0; s < 6; s++) {
    const d0 = brain.bar({});
    const d = {
      ...d0,
      bar: 0,
      plan: { ...(d0.plan ?? {}), set: `test-set-${s}` },
      mix: { ...d0.mix, yes: { ...d0.mix.yes, answer: true } },
      voices: { ...d0.voices, voices: d0.voices.voices.map((v) => (v.slot === 'answer' ? realizeVoice(d0.voices.seed, slotIndex('answer'), { slot: 'answer', inst: 'echo-guitar', keys: v.keys }) : v)) },
    };
    const m0 = all.length;
    assert.doesNotThrow(() => set.bar(s * 4, d, 0.5), `set ${s}: the bar plays`);
    // the guitar's oscillators are the ones whose sound reaches its room (the first comb, 29.7 ms, is its own)
    const made = all.slice(m0);
    const isRoom = (n) => n.kind === 'delay' && n.delayTime.value === 0.0297;
    const oscs = made.filter((n) => n.kind === 'osc' && [...reach(n)].some(isRoom));
    assert.ok(oscs.length > 0, `set ${s}: the guitar sounded`);
    // the phrase's rhythm: its note onsets in beats from its first note (six partials share each onset)
    const onsets = [...new Set(oscs.map((o) => o.frequency.events[0][2]))].sort((a, b) => a - b);
    keys.push(onsets.map((t) => Math.round(((t - onsets[0]) / 0.5) * 100) / 100).join(' '));
  }
  set.dispose();
  // the three phrases have three rhythms (climb 0 0.5 1, turn 0 0.5 0.75 1, call 0 0.25 0.5 1)
  const rhythms = new Set(ECHO_PHRASES.map((P) => P.notes.map((n) => n[0] - P.notes[0][0]).join(' ')));
  assert.equal(rhythms.size, 3, 'the phrases are told apart by their rhythm (vacuity control)');
  for (const k of keys) assert.ok(rhythms.has(k), `a dealt rhythm is one of the phrases: ${k}`);
  // a deck of three: sets 0..2 deal all three, and so do sets 3..5
  assert.equal(new Set(keys.slice(0, 3)).size, 3, `three phrases in the first three sets: ${keys.slice(0, 3).join(' | ')}`);
  assert.equal(new Set(keys.slice(3, 6)).size, 3, `three phrases in the next three: ${keys.slice(3, 6).join(' | ')}`);
});
