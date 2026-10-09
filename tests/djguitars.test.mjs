// THE PSYCH GUITARS (lane DJGUITARS): the fuzz lead and the phase guitar, their pedals (squash, fuzz, phaser, flanger,
// chorus, tape echo), their parts, their level, their seats in THE DJ's bags and their loading on demand. Sounds are
// rendered offline (tests/offline.mjs) and measured; graphs are traced on the fake context (tests/fakeaudio.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderSound, mono, measure, fft } from './offline.mjs';
import { Ctx, all, reach } from './fakeaudio.mjs';
import { TONE } from '../src/tone.js';
import * as G from '../src/djguitars.js';
import {
  INSTRUMENT_KEYS, playNote, midiHz, MODES, SLOT_INSTRUMENTS, INST_ALPHABET, INST_PEAK, REGISTER, INST_LABEL,
  createMixSet, createHouseDJ, realizeVoice, slotIndex, createVoiceDealer, HOUSE_SLOTS,
  loadEchoGuitar, echoGuitarNow,
} from '../src/index.js';

const SR = 48000;
const SRC = (f) => readFileSync(fileURLToPath(new URL(`../src/${f}`, import.meta.url)), 'utf8');
const noComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const ANALYSIS = JSON.parse(readFileSync(fileURLToPath(new URL('../../runs/djguitars/analysis.json', import.meta.url)), 'utf8'));
const P = G.PSYCH_GUITARS;
const SEVEN = Object.keys(MODES).filter((m) => MODES[m].length === 7);

// the power spectrum of a mono signal, averaged over frames of n
function spectrum(x, n = 8192) {
  const A = new Float64Array(n / 2);
  for (let s = 0; s + n <= x.length; s += n / 2) {
    const re = new Float64Array(n); const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = x[s + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
    fft(re, im);
    for (let k = 0; k < n / 2; k++) A[k] += re[k] * re[k] + im[k] * im[k];
  }
  return { A, df: SR / n };
}
const bandDb = ({ A, df }, lo, hi) => { let v = 0; for (let k = Math.round(lo / df); k < Math.round(hi / df); k++) v += A[k]; return 10 * Math.log10(v + 1e-20); };
const peakDb = ({ A, df }, f) => { let v = 0; for (let k = Math.round((f * 0.98) / df); k <= Math.round((f * 1.02) / df); k++) v = Math.max(v, A[k]); return 10 * Math.log10(v + 1e-20); };

test('the reference numbers the voices answer are the measured ones (analysis.json), from the guitar alone, never the disputed speech', () => {
  const R = P.reference;
  const A = ANALYSIS.sections.alone;
  assert.equal(R.file, 'SETTLE/runs/djguitars/analysis.json');
  assert.equal(R.arpeggioBpm, ANALYSIS.tempo.arpeggio.bpm);
  assert.equal(R.eighthSeconds, ANALYSIS.tempo.arpeggio.eighthSeconds);
  assert.equal(R.beatCorr, ANALYSIS.tempo.arpeggio.strongestLags[0].corr);
  assert.equal(R.centroidHz, A.centroidHz);
  assert.equal(R.rolloff85Hz, A.rolloff85Hz);
  assert.equal(R.rolloff95Hz, A.rolloff95Hz);
  assert.equal(R.slopeDbPerOctave, A.slope1to6kDbPerOctave);
  assert.equal(R.band4to8kDb, A.octaveBandsDb['4000-8000']);
  assert.equal(R.leftMinusRightDb, A.leftMinusRightDb);
  assert.equal(R.corr, ANALYSIS.alone.stereo.corr1800);
  assert.equal(R.sustainDropDb, ANALYSIS.alone.sustain.dropDbAt250msMedian);
  assert.equal(R.registerMidi, ANALYSIS.alone.register.medianMidi);
  assert.equal(R.echoSeconds, ANALYSIS.outroEcho.medianGapSeconds);
  assert.equal(R.echoDbPerRepeat, ANALYSIS.outroEcho.dbPerRepeat);
  assert.equal(R.guitarUnderKickDb, ANALYSIS.band.drums.guitarBandMinusKickBandDb);
  assert.equal(R.pumpDb, ANALYSIS.band.drums.guitarAfterMinusBeforeDb);
  assert.equal(R.tonalCentre, ANALYSIS.band.tonalCentre.centre);
  // THE CORRECTION: the 30:07 to 30:37 stretch is recorded as disputed (speech, by THE GUITAR STUDY's separation), and
  // no reference number names it: the voices' constants hold no wash
  assert.match(ANALYSIS.correction, /speech/);
  assert.ok(ANALYSIS.sections.disputed && !('wash' in ANALYSIS.sections));
  assert.ok(!Object.keys(R).some((k) => /wash|burst/i.test(k)), 'no reference number from the disputed stretch');
  // the clip's time origin was measured, not assumed, and the guitar-alone window starts where the study puts it
  assert.equal(ANALYSIS.source.origin.corr, 1);
  assert.match(ANALYSIS.source.sectionTimes.alone, /^30:51\.7/);
  // the outro's echo agrees with THE GUITAR STUDY's (210.2 ms): two methods, one echo
  assert.ok(Math.abs(R.echoSeconds - 0.2102) < 0.003, `${R.echoSeconds} s`);
  // the voices sit where the reference put them: the crunch's register, its pan and a short room
  assert.ok(Math.abs(P.rhythm.register - R.registerMidi) <= 4);
  assert.ok(P.rhythm.pan < 0, 'panned left, as the reference');
  assert.ok(P.lead.room.rt60 <= 0.8 && P.rhythm.room.rt60 <= 0.8, 'a short room (THE GUITAR STUDY: about 0.7 s)');
});

test('THE CABINET CORNER is one constant, and the string meets TONE.rawCeiling before any drive whatever it is', () => {
  assert.equal(G.CABINET_CORNER_HZ, TONE.rawCeiling, 'A until the navigator rules');
  assert.equal(P.cabinet.high, G.CABINET_CORNER_HZ);
  const ctx = new Ctx(); const m0 = all.length;
  G.createFuzz(ctx, ctx.destination, P.lead.fuzz);
  const lps = all.slice(m0).filter((n) => n.kind === 'biquad' && n.type === 'lowpass');
  assert.equal(lps.length, 2, 'two low-pass stages');
  for (const f of lps) assert.equal(f.frequency.value, G.CABINET_CORNER_HZ);
  assert.equal(P.pick.open, TONE.rawCeiling);
  // the shaper oversamples and the tone stack is the three Bassman biquads
  assert.equal(all.slice(m0).find((n) => n.kind === 'shaper').oversample, '4x');
  assert.deepEqual(all.slice(m0).filter((n) => n.kind === 'biquad' && ['lowshelf', 'peaking', 'highshelf'].includes(n.type)).map((n) => n.type), ['lowshelf', 'peaking', 'highshelf']);
});

test('THE PHASER: two all-pass biquads at Q 0.5 each side (four first-order stages), a triangle LFO on detune, notches where the Small Stone puts them', () => {
  const ctx = new Ctx(); const m0 = all.length;
  const ph = G.createPhaser(ctx, ctx.destination, P.lead.phaser);
  const made = all.slice(m0);
  const ap = made.filter((n) => n.kind === 'biquad' && n.type === 'allpass');
  assert.equal(ap.length, 4, 'two all-passes a side');
  for (const a of ap) { assert.equal(a.Q.value, 0.5); assert.equal(a.frequency.value, 682); }
  assert.equal(ph.lfos.length, 1); assert.equal(ph.lfos[0].type, 'triangle'); assert.equal(ph.lfos[0].frequency.value, 0.15);
  const depths = made.filter((n) => n.kind === 'gain' && Math.abs(n.gain.value) === 1800);
  assert.deepEqual(depths.map((d) => Math.sign(d.gain.value)).sort(), [-1, 1], 'the two sides sweep against each other');
  // the lower notch 0.414 f0 over the whole sweep: 100 to 800 Hz, as the measured pedal's (guitstudy 04)
  const lo = 0.4142 * 682 * 2 ** (-1800 / 1200); const hi = 0.4142 * 682 * 2 ** (1800 / 1200);
  assert.ok(Math.abs(lo - 100) < 3 && Math.abs(hi - 800) < 3, `${lo.toFixed(1)} to ${hi.toFixed(1)} Hz`);
  // measured: noise through the phaser held still (depth 0) has its two notches at 0.414 and 2.414 times 682 Hz
  const r = renderSound((c, d, t) => {
    const px = G.createPhaser(c, d, { centre: 682, cents: 0, rate: 0.15, mix: 0.5, t });
    const src = c.createBufferSource(); const b = c.createBuffer(1, SR * 3, SR); const ch = b.getChannelData(0);
    let s = 12345; for (let i = 0; i < ch.length; i++) { s = (s * 1103515245 + 12345) >>> 0; ch[i] = (s / 2 ** 32 - 0.5) * 0.5; }
    src.buffer = b; src.connect(px.input); src.start(t);
    return t;
  }, { seconds: 3, sampleRate: SR });
  const S = spectrum(mono(r));
  const around = (f) => bandDb(S, f * 0.75, f * 0.9) / 2 + bandDb(S, f * 1.1, f * 1.3) / 2;
  for (const f of [0.4142 * 682, 2.4142 * 682]) assert.ok(bandDb(S, f * 0.96, f * 1.04) < around(f) - 6, `a notch at ${f.toFixed(0)} Hz`);
  // control: between the notches the level is not cut
  assert.ok(bandDb(S, 640, 720) > bandDb(S, 0.4142 * 682 * 0.96, 0.4142 * 682 * 1.04) + 6);
});

test('THE FLANGER is feed-forward: a swept delay of 0.7 to 4.3 ms with no loop (a loop would hold it to 2.67 ms or more)', () => {
  const ctx = new Ctx(); const m0 = all.length;
  const fl = G.createFlanger(ctx, ctx.destination, P.rhythm.flanger);
  const delays = all.slice(m0).filter((n) => n.kind === 'delay');
  assert.equal(delays.length, 2);
  const F = P.rhythm.flanger;
  assert.ok(Math.abs((F.base - F.depth) * 1000 - 0.7) < 1e-9 && Math.abs((F.base + F.depth) * 1000 - 4.3) < 1e-9);
  for (const d of delays) assert.ok(![...reach([...d.out][0])].includes(d), 'the delay\'s output never reaches it again');
  assert.equal(fl.lfos[0].type, 'triangle');
  // control: the tape echo does loop (its delay reaches itself), so the check can see a loop
  const ctx2 = new Ctx(); const m1 = all.length;
  G.createTapeEcho(ctx2, ctx2.destination, { beatDur: 0.5 });
  const ed = all.slice(m1).find((n) => n.kind === 'delay');
  assert.ok([...reach([...ed.out][0])].includes(ed), 'the echo loops');
});

test('THE SQUASH compresses: 12 dB more in gives well under 12 dB more out above its threshold; a quiet note passes at its makeup', () => {
  const lvl = (amp) => {
    const r = renderSound((c, d, t) => {
      const sq = G.createSquash(c, d, { thresholdDb: -24, ratio: 4, makeup: 1 });
      const o = c.createOscillator(); o.frequency.value = 220; const g = c.createGain(); g.gain.value = amp;
      o.connect(g); g.connect(sq.input); o.start(t); o.stop(t + 1.5);
      return t;
    }, { seconds: 1.5, sampleRate: SR });
    const x = mono(r); let e = 0; for (let i = Math.round(1.0 * SR); i < Math.round(1.4 * SR); i++) e += x[i] * x[i];
    return 10 * Math.log10(e / (0.4 * SR));
  };
  const loud = lvl(0.5); const louder = lvl(0.5 * 4);
  assert.ok(louder - loud < 6, `+12 dB in gives ${(louder - loud).toFixed(2)} dB out`);
  assert.ok(louder - loud > 0, 'and still more');
  // control: under the threshold the squash is unity (a 0.01 sine: -43 dB, well under -24 dB)
  const q1 = lvl(0.01); const q2 = lvl(0.02);
  assert.ok(Math.abs(q2 - q1 - 6.02) < 0.5, `quiet notes pass unchanged: ${(q2 - q1).toFixed(2)} dB for +6 dB`);
});

test('THE FUZZ: a pure tone comes out rich in odd and even harmonics; with no bias the even ones all but vanish', () => {
  const tone = (bias) => {
    const r = renderSound((c, d, t) => {
      const fz = G.createFuzz(c, d, { gain: 14, bias, tight: 20, scoopHz: 900, scoopDb: 0, tone: 9000 });
      const o = c.createOscillator(); o.frequency.value = 250; const g = c.createGain(); g.gain.value = 0.2;
      o.connect(g); g.connect(fz.input); o.start(t); o.stop(t + 1);
      return t;
    }, { seconds: 1, sampleRate: SR });
    const S = spectrum(mono(r).slice(Math.round(0.2 * SR)), 16384);
    return [1, 2, 3, 4, 5].map((h) => peakDb(S, 250 * h));
  };
  const asym = tone(0.18); const sym = tone(0);
  assert.ok(asym[2] - asym[0] > -20, `harmonic 3 at ${(asym[2] - asym[0]).toFixed(1)} dB: a clip, not a clean tone`);
  assert.ok(asym[1] - asym[0] > -25, `harmonic 2 at ${(asym[1] - asym[0]).toFixed(1)} dB: the bias makes even harmonics`);
  assert.ok(sym[1] - sym[0] < asym[1] - asym[0] - 15, `no bias: harmonic 2 at ${(sym[1] - sym[0]).toFixed(1)} dB`);
});

test('THE TAPE ECHO: a dotted eighth locked to the tempo, its loop darkened, saturated and wobbled, its repeats falling', () => {
  const ctx = new Ctx(); const m0 = all.length;
  const e = G.createTapeEcho(ctx, ctx.destination, { beatDur: 0.5, ...P.lead.echo });
  assert.ok(Math.abs(e.seconds - 0.375) < 1e-9, 'a dotted eighth at 120 bpm');
  e.setBeat(60 / 100, 1);
  const made = all.slice(m0);
  const d = made.find((n) => n.kind === 'delay');
  assert.ok(d.delayTime.events.some(([type, v]) => type === 'set' && Math.abs(v - 0.45) < 1e-9), 'the tempo moves the echo');
  const lp = made.find((n) => n.kind === 'biquad' && n.type === 'lowpass');
  assert.equal(lp.frequency.value, P.lead.echo.tone);
  assert.ok(made.some((n) => n.kind === 'shaper'), 'a soft clip in the loop');
  assert.equal(e.lfos[0].frequency.value, P.lead.echo.wowRate);
  // measured: a click's repeats arrive 0.375 s apart and each is quieter than the one before
  const r = renderSound((c, dd, t) => {
    const ec = G.createTapeEcho(c, dd, { beatDur: 0.5, ...P.lead.echo, wow: 0, t });
    const o = c.createOscillator(); o.frequency.value = 800; const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 0.005); g.gain.linearRampToValueAtTime(0, t + 0.05);
    o.connect(g); g.connect(ec.input); o.start(t); o.stop(t + 0.1);
    return t;
  }, { seconds: 2, sampleRate: SR });
  const x = mono(r);
  const lev = (s) => { let m = 0; for (let i = Math.round(s * SR); i < Math.round((s + 0.08) * SR); i++) m = Math.max(m, Math.abs(x[i])); return m; };
  const reps = [1, 2, 3].map((k) => lev(k * 0.375 - 0.01));
  assert.ok(reps[0] > 0.01 && reps[1] < reps[0] && reps[2] < reps[1], reps.map((v) => v.toFixed(4)).join(' > '));
  assert.ok(lev(0.2) < reps[0] * 0.2, 'silence between the click and its first repeat');
});

test('THE LEAD PHRASES are our own: single notes in the key, one bend each up one scale step, around the lead\'s register', () => {
  assert.equal(G.LEAD_PHRASES.length, 4);
  for (const mode of SEVEN) for (const root of [52, 57, 60, 64]) for (const ph of G.LEAD_PHRASES) {
    const notes = G.leadPlan({ root, mode, phrase: ph, beatDur: 0.5 });
    const pcs = new Set(MODES[mode].map((s) => (root + s) % 12));
    assert.equal(notes.filter((n) => n.bendTo != null).length, 1, `${ph.key} ${mode}: one bend`);
    for (const n of notes) {
      assert.ok(pcs.has(((n.midi % 12) + 12) % 12), `${ph.key} ${mode} ${root}: ${n.midi} in the key`);
      if (n.bendTo != null) { assert.ok(pcs.has(n.bendTo % 12)); assert.ok(n.bendTo - n.midi >= 1 && n.bendTo - n.midi <= 2, 'a bend of one step'); assert.ok(n.bendAt > n.t && n.bendAt < n.t + n.dur); }
    }
    assert.equal(new Set(notes.map((n) => n.t)).size, notes.length, 'single notes');
    const mid = notes.reduce((a, n) => a + n.midi, 0) / notes.length;
    assert.ok(Math.abs(mid - REGISTER['fuzz-lead']) <= 6, `${ph.key}: centre ${mid}`);
    assert.ok(notes.every((n) => n.t + n.dur <= 2.6 * 0.5), 'a phrase fits the answer\'s half bar and a little');
  }
  // the swell phrase swells in
  assert.equal(G.leadPlan({ phrase: G.LEAD_PHRASES.find((p) => p.key === 'swell') })[0].kind, 'swell');
});

test('THE RHYTHM PARTS are our own: chord tones only, eighth arpeggios, strums spread by a strum, a swell that rings', () => {
  assert.equal(G.RHYTHM_PATTERNS.length, 3);
  assert.equal(G.MOD_KINDS.length, 2);
  const chord = [57, 60, 64];
  for (const pat of G.RHYTHM_PATTERNS) {
    const notes = G.rhythmPlan({ chord, pattern: pat, beatDur: 0.5 });
    const pcs = new Set(chord.map((m) => m % 12));
    for (const n of notes) assert.ok(pcs.has(n.midi % 12), `${pat.key}: ${n.midi} is a chord tone (no key given: the colour is the third)`);
    assert.ok(notes.every((n) => n.t >= 0 && n.t < 2), `${pat.key}: inside one bar`);
    const mid = notes.reduce((a, n) => a + n.midi, 0) / notes.length;
    assert.ok(Math.abs(mid - REGISTER['phase-guitar']) <= 8, `${pat.key}: centre ${mid}`);
  }
  const arp = G.rhythmPlan({ chord, pattern: G.RHYTHM_PATTERNS[0], beatDur: 0.5 });
  assert.deepEqual(arp.map((n) => n.t), [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75], 'eighths at 120 bpm (the reference part\'s rhythm)');
  // the notes ring over each other: each holds about a beat, so about two sound at once (the reference: about 3)
  assert.ok(arp.every((n) => n.dur >= 0.45), 'ringing notes');
  // THE COLOUR: in a key, the arpeggio carries the chord root's 4th where the key holds it (A minor in A aeolian: D)
  for (const mode of SEVEN) for (const root of [57, 60, 62]) for (const ch of [[57, 60, 64], [53, 57, 60], [55, 59, 62]]) {
    const keyPcs = new Set(MODES[mode].map((st) => (root + st) % 12));
    const ns = G.rhythmPlan({ chord: ch, pattern: G.RHYTHM_PATTERNS[0], root, mode });
    for (const n of ns) assert.ok(keyPcs.has(n.midi % 12) || ch.some((m) => m % 12 === n.midi % 12), `${mode} ${root}: ${n.midi} in the key or the chord`);
  }
  const am = G.rhythmPlan({ chord, pattern: G.RHYTHM_PATTERNS[0], root: 57, mode: 'aeolian' });
  assert.ok(am.some((n) => n.midi % 12 === 2), 'the 4th of A (D) colours the A minor arpeggio');
  // control: with no key, no colour tone outside the chord
  assert.ok(!arp.some((n) => n.midi % 12 === 2));
  // the swell is a power stack: no third under the drive
  const sw0 = G.rhythmPlan({ chord, pattern: G.RHYTHM_PATTERNS[2] });
  assert.ok(!sw0.some((n) => n.midi % 12 === 0), 'no third (C) in the swell');
  const strum = G.rhythmPlan({ chord, pattern: G.RHYTHM_PATTERNS[1], beatDur: 0.5 }).filter((n) => n.t < 0.1);
  assert.ok(strum.length >= 3 && Math.abs(strum[1].t - strum[0].t - P.rhythm.strumMs / 1000) < 1e-9, 'a down-strum rolls the strings');
  assert.ok(G.rhythmPlan({ chord, pattern: G.RHYTHM_PATTERNS[1] }).some((n) => n.kind === 'mute'), 'palm-muted ghosts');
  // swing leans the off-beat eighths late, never the down-beats
  const sw = G.rhythmPlan({ chord, pattern: G.RHYTHM_PATTERNS[0], beatDur: 0.5, swing: 0.08 });
  assert.equal(sw[0].t, 0); assert.ok(Math.abs(sw[1].t - (0.5 + 0.08) * 0.5) < 1e-9);
});

test('THE TONE RULES: every note ramps up from 0 and lets go gently; every sawtooth meets a low-pass at or under the raw ceiling first', () => {
  const ctx = new Ctx(); const m0 = all.length;
  assert.ok(G.psychNote(ctx, ctx.destination, midiHz(64), 0, 0.5, 0.8, { bendTo: midiHz(66), bendAt: 0.2, vibrato: true }));
  const made = all.slice(m0);
  const env = made.find((n) => n.kind === 'gain' && n.gain.events[0]?.[1] === 0 && n.gain.events.length >= 4);
  const up = env.gain.events.find((e) => e[0] === 'lin');
  assert.ok(up[2] >= TONE.attackMin, `attack ${up[2]}`);
  const fall = env.gain.events.filter((e) => e[0] === 'target' && e[1] === 0).pop();
  assert.ok(fall[3] >= TONE.releaseMin / 3, `release tau ${fall[3]}`);
  const saws = made.filter((n) => n.kind === 'osc' && n.type === 'sawtooth');
  assert.equal(saws.length, 2, 'two strings, double-tracked');
  for (const o of saws) {
    const g = [...o.out][0]; const f = [...g.out][0];
    assert.equal(f.kind, 'biquad'); assert.equal(f.type, 'lowpass');
    assert.ok(f.frequency.events[0][1] <= TONE.rawCeiling, `the pick filter opens at ${f.frequency.events[0][1]}`);
    assert.ok(o.frequency.events.some((e) => e[0] === 'exp' && Math.abs(e[1] - midiHz(66)) < 1e-6), 'the bend');
  }
  const vib = made.find((n) => n.kind === 'osc' && n.type === 'sine' && n.frequency.value === P.lead.vibratoHz);
  assert.ok(vib, 'the finger vibrato');
  // control: a note with no bend asked for does not bend
  const m1 = all.length;
  G.psychNote(ctx, ctx.destination, midiHz(64), 0, 0.5, 0.8);
  assert.ok(!all.slice(m1).some((n) => n.kind === 'osc' && n.frequency.events.some((e) => e[0] === 'exp')));
  assert.equal(G.psychNote(ctx, ctx.destination, NaN, 0), false);
});

test('THE LEVEL: every lead phrase and every rhythm part, all pedals ringing, at velocity 1, sits under the loudest existing instrument', () => {
  const loud = INSTRUMENT_KEYS.map((inst) => ({ inst, ...measure(renderSound((c, d, t) => { playNote(c, d, inst, midiHz(64), t, 1, 1); return t; }, { seconds: 2, sampleRate: SR })) }));
  const top = loud.reduce((a, b) => (b.rms50 > a.rms50 ? b : a));
  const topPeak = Math.max(...loud.map((l) => l.peak));
  let leadPeak = 0;
  for (const ph of G.LEAD_PHRASES) for (const root of [52, 57, 64]) {
    const g = measure(renderSound((c, d) => { G.auditionLead(c, d, { t0: 0.01, beatDur: 0.5, root, mode: 'aeolian', phrase: ph }); return 0; }, { seconds: 4, sampleRate: SR }));
    const tag = `${ph.key} at ${root}`;
    assert.ok(g.rms50 < top.rms50, `${tag}: ${g.rms50.toFixed(4)} vs ${top.inst} ${top.rms50.toFixed(4)}`);
    assert.ok(g.peak < topPeak, `${tag}: peak ${g.peak.toFixed(4)} vs ${topPeak.toFixed(4)}`);
    assert.ok(g.rms50 > top.rms50 * 0.1, `${tag}: the lead sounds (${g.rms50.toFixed(4)})`);
    leadPeak = Math.max(leadPeak, g.peak);
  }
  let rhythmPeak = 0;
  for (const pat of G.RHYTHM_PATTERNS) for (const mod of G.MOD_KINDS) for (const chord of [[48, 52, 55], [57, 60, 64], [62, 65, 69]]) {
    const g = measure(renderSound((c, d) => { G.auditionRhythm(c, d, { t0: 0.01, beatDur: 0.5, chord, pattern: pat, mod }); return 0; }, { seconds: 3, sampleRate: SR }));
    const tag = `${pat.key} ${mod} on ${chord[0]}`;
    assert.ok(g.rms50 < top.rms50, `${tag}: ${g.rms50.toFixed(4)} vs ${top.rms50.toFixed(4)}`);
    assert.ok(g.peak < topPeak, `${tag}: peak ${g.peak.toFixed(4)}`);
    assert.ok(g.rms50 > top.rms50 * 0.1, `${tag}: the guitar sounds (${g.rms50.toFixed(4)})`);
    rhythmPeak = Math.max(rhythmPeak, g.peak);
  }
  // the instruments' declared peaks are their measured ones (velocityFor uses them)
  assert.ok(leadPeak <= INST_PEAK['fuzz-lead'] && leadPeak > INST_PEAK['fuzz-lead'] * 0.85, `lead peak ${leadPeak.toFixed(4)}`);
  assert.ok(rhythmPeak <= INST_PEAK['phase-guitar'] && rhythmPeak > INST_PEAK['phase-guitar'] * 0.85, `rhythm peak ${rhythmPeak.toFixed(4)}`);
});

test('OURS ANSWERS THE REFERENCE: the phase guitar\'s brightness, pan and width sit near the clip\'s guitar, and the pinned summary is what a fresh render measures', () => {
  const S = (fn, secs) => renderSound(fn, { seconds: secs, sampleRate: SR });
  const stat = (r) => {
    const x = mono(r); const sp = spectrum(x);
    let tot = 0; let cen = 0; for (let k = 1; k < Math.round(11000 / sp.df); k++) { tot += sp.A[k]; cen += sp.A[k] * k * sp.df; }
    const bp = (sig) => { const w = (2 * Math.PI * 1800) / SR; const al = Math.sin(w) / 1.2; const a0 = 1 + al; const a1 = -2 * Math.cos(w); const a2 = 1 - al; const y = new Float64Array(sig.length); let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0; for (let n = 0; n < sig.length; n++) { const v = (al * sig[n] - al * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = sig[n]; y2 = y1; y1 = v; y[n] = v; } return y; };
    const L = bp(r.L); const R = bp(r.R); let l = 0; let rr = 0; let lr = 0; for (let i = 0; i < L.length; i++) { l += L[i] ** 2; rr += R[i] ** 2; lr += L[i] * R[i]; }
    let el = 0; let er = 0; for (let i = 0; i < r.L.length; i++) { el += r.L[i] ** 2; er += r.R[i] ** 2; }
    return { cen: cen / tot, corr: lr / Math.sqrt(l * rr), lr: 10 * Math.log10(el / er) };
  };
  const avg = (rows, k) => rows.reduce((a, s) => a + s[k], 0) / rows.length;
  const rh = G.RHYTHM_PATTERNS.flatMap((pat) => G.MOD_KINDS.map((mod) => stat(S((c, d) => { G.auditionRhythm(c, d, { t0: 0.01, beatDur: 0.5, chord: [57, 60, 64], pattern: pat, mod }); return 0; }, 3))));
  const cen = avg(rh, 'cen'); const corr = avg(rh, 'corr'); const lr = avg(rh, 'lr');
  assert.ok(Math.abs(cen - P.ours.rhythm.centroidHz) < 25, `centroid ${cen.toFixed(0)} vs pinned ${P.ours.rhythm.centroidHz}`);
  assert.ok(Math.abs(corr - P.ours.rhythm.corr) < 0.02, `width ${corr.toFixed(3)} vs pinned ${P.ours.rhythm.corr}`);
  assert.ok(Math.abs(lr - P.ours.rhythm.leftMinusRightDb) < 0.3, `pan ${lr.toFixed(2)} vs pinned ${P.ours.rhythm.leftMinusRightDb}`);
  // near the clip's guitar: centroid within 25%, the pan within 1.5 dB, the width within 0.1
  assert.ok(Math.abs(cen / P.reference.centroidHz - 1) < 0.25, `centroid ${cen.toFixed(0)} vs the clip's ${P.reference.centroidHz}`);
  assert.ok(Math.abs(lr - P.reference.leftMinusRightDb) < 1.5, `pan ${lr.toFixed(2)} dB vs the clip's ${P.reference.leftMinusRightDb}`);
  assert.ok(Math.abs(corr - P.reference.corr) < 0.1, `width ${corr.toFixed(2)} vs the clip's ${P.reference.corr}`);
  // the drive is heard as sustain: the pinned held-note drop is within the reference's 2.4 dB
  assert.ok(P.ours.rhythm.sustainDropDb <= P.reference.sustainDropDb && P.ours.lead.sustainDropDb <= P.reference.sustainDropDb);
  // the lead's pinned summary is what a fresh render measures
  const ld = G.LEAD_PHRASES.map((ph) => stat(S((c, d) => { G.auditionLead(c, d, { t0: 0.01, beatDur: 0.5, root: 57, mode: 'aeolian', phrase: ph }); return 0; }, 4)));
  assert.ok(Math.abs(avg(ld, 'cen') - P.ours.lead.centroidHz) < 25, `lead centroid ${avg(ld, 'cen').toFixed(0)}`);
  // control: the same crunch with its panner centred is not left of centre (the pan is the panner's)
  const centred = stat(S((c, d) => { const sq = G.createSquash(c, d, P.rhythm.squash); const fz = G.createFuzz(c, sq.input, P.rhythm.fuzz); for (const n of G.rhythmPlan({ chord: [57, 60, 64], t0: 0.01 })) G.psychNote(c, fz.input, midiHz(n.midi), n.t, n.dur, 1); return 0; }, 3));
  assert.ok(Math.abs(centred.lr) < 0.2, `centred: ${centred.lr.toFixed(2)} dB`);
});

test('THE TABLES: both guitars appended to the tag alphabet, seated in the answer\'s and the arps\' bags, dealt within a bag\'s length', () => {
  assert.equal(INST_ALPHABET[9], 'echo-guitar');
  assert.equal(INST_ALPHABET[10], 'fuzz-lead');
  assert.equal(INST_ALPHABET[11], 'phase-guitar');
  assert.ok(INST_ALPHABET.length <= 16, 'the tag gives an instrument 4 bits');
  assert.ok(SLOT_INSTRUMENTS.answer.includes('fuzz-lead') && !SLOT_INSTRUMENTS.arps.includes('fuzz-lead'));
  assert.ok(SLOT_INSTRUMENTS.arps.includes('phase-guitar') && !SLOT_INSTRUMENTS.answer.includes('phase-guitar'));
  assert.equal(INST_LABEL['fuzz-lead'], 'the fuzz lead'); assert.equal(INST_LABEL['phase-guitar'], 'the phase guitar');
  assert.equal(REGISTER['fuzz-lead'], P.lead.register); assert.equal(REGISTER['phase-guitar'], P.rhythm.register);
  assert.equal(INST_PEAK['fuzz-lead'], P.lead.peak); assert.equal(INST_PEAK['phase-guitar'], P.rhythm.peak);
  // THE DECK RULE: every instrument in a bag comes round within the bag's length
  const dealer = createVoiceDealer({ seed: 21 });
  const sets = Array.from({ length: SLOT_INSTRUMENTS.arps.length * SLOT_INSTRUMENTS.answer.length }, () => dealer.palette({ slots: HOUSE_SLOTS }).voices);
  const first = (slot) => sets.slice(0, SLOT_INSTRUMENTS[slot].length).map((vs) => vs.find((v) => v.slot === slot).inst);
  assert.equal(new Set(first('answer')).size, SLOT_INSTRUMENTS.answer.length, first('answer').join(', '));
  assert.equal(new Set(first('arps')).size, SLOT_INSTRUMENTS.arps.length, first('arps').join(', '));
  // the guitars are phrase voices, not playNote instruments (they load on demand)
  for (const k of ['fuzz-lead', 'phase-guitar']) { assert.ok(!INSTRUMENT_KEYS.includes(k)); assert.equal(noComments(SRC('instruments.js')).includes(k), false); }
});

test('ON DEMAND: nothing in the hero\'s static graph imports the voices; the one guitar loader fetches them with the echo guitar', async () => {
  for (const f of ['index.js', 'mix-layers.js', 'instruments.js', 'voice-fx.js', 'symphony-index.js']) {
    assert.doesNotMatch(noComments(SRC(f)), /from '\.\/djguitars\.js'/, `${f} imports the voices statically`);
  }
  assert.match(noComments(SRC('echoguitar-lazy.js')), /import\('\.\/djguitars\.js'\)/, 'the loader imports them dynamically');
  const a = loadEchoGuitar(); const b = loadEchoGuitar();
  assert.equal(a, b, 'one fetch, one promise');
  const m = await a;
  assert.equal(echoGuitarNow(), m);
  assert.equal(m.LEAD_PHRASES, G.LEAD_PHRASES, 'the same module the tests import by path');
  assert.equal(typeof m.playEchoPhrase, 'function', 'the echo guitar rides in the same chunk');
  // the decks live in the module (createSetGuitars), so the first load keeps no deck of its own
  assert.equal(typeof m.createSetGuitars, 'function');
  assert.doesNotMatch(noComments(SRC('mix-layers.js')), /0xf022/, 'the guitars\' decks are not built in the entry');
});

// the marker of a guitar's board: its phaser's all-pass at 682 Hz (no other voice uses one) or its flanger's delay
const isBoard = (n) => (n.kind === 'biquad' && n.type === 'allpass' && n.frequency.value === 682) || (n.kind === 'delay' && n.delayTime.value === P.rhythm.flanger.base);
const dealt = (d, slot, inst) => ({
  ...d,
  mix: { ...d.mix, yes: { ...d.mix.yes, [slot]: true } },
  voices: { ...d.voices, voices: d.voices.voices.map((v) => (v.slot === slot ? realizeVoice(d.voices.seed, slotIndex(slot), { slot, inst, keys: v.keys }) : v)) },
});

test('THE DJ\'s answer: dealt the fuzz lead, a set builds one board and plays its bent phrase on every second bar', async () => {
  await loadEchoGuitar();
  const ctx = new Ctx();
  const set = createMixSet(ctx, ctx.destination, { seed: 7 });
  const brain = createHouseDJ({ seed: 7, theme: 'embers' });
  let boards = 0; let phrases = 0;
  for (let b = 0; b < 8; b++) {
    const d = { ...dealt(brain.bar({}), 'answer', 'fuzz-lead'), plan: { set: 'one-set', barsIn: b } };
    const m0 = all.length;
    set.bar(b * 2, d, 0.5);
    const made = all.slice(m0);
    boards += made.filter(isBoard).length;
    const bends = made.filter((n) => n.kind === 'osc' && n.type === 'sawtooth' && n.frequency.events.some((e) => e[0] === 'exp'));
    if (d.bar % 2 === 0) { assert.ok(bends.length >= 2, `bar ${d.bar}: a bent phrase`); phrases += 1; } else assert.equal(bends.length, 0, `bar ${d.bar}: no answer on an odd bar`);
  }
  assert.ok(phrases >= 3, `${phrases} phrases`);
  assert.equal(boards, 4, 'one board for the whole set (two all-passes a side), built once');
  set.dispose();
  // control: the same bars on the keys build no guitar board
  const set2 = createMixSet(ctx, ctx.destination, { seed: 7 });
  const brain2 = createHouseDJ({ seed: 7, theme: 'embers' });
  const m0 = all.length;
  for (let b = 0; b < 8; b++) set2.bar(b * 2, dealt(brain2.bar({}), 'answer', 'keys'), 0.5);
  assert.equal(all.slice(m0).filter(isBoard).length, 0, 'the keys answer with no guitar');
  set2.dispose();
});

test('THE DJ\'s arps: dealt the phase guitar, every bar plays the chord through the set\'s board; a new set deals new cards and a new board', async () => {
  await loadEchoGuitar();
  const ctx = new Ctx();
  const set = createMixSet(ctx, ctx.destination, { seed: 3 });
  const brain = createHouseDJ({ seed: 3, theme: 'deepsea' });
  const seen = []; let boards = 0;
  for (let s = 0; s < 6; s++) {
    for (let b = 0; b < 2; b++) {
      const d0 = brain.bar({});
      const d = { ...dealt(d0, 'arps', 'phase-guitar'), plan: { ...(d0.plan ?? {}), set: `set-${s}` }, trained: null, bases: null };
      const m0 = all.length;
      set.bar(s * 4 + b * 2, d, 0.5);
      const made = all.slice(m0);
      const saws = made.filter((n) => n.kind === 'osc' && n.type === 'sawtooth');
      assert.ok(saws.length >= 2, `set ${s} bar ${b}: the guitar plays (${saws.length} strings)`);
      const nb = made.filter(isBoard);
      boards += nb.length > 0 ? 1 : 0;
      if (b === 0) seen.push(nb.some((n) => n.kind === 'delay') ? 'flanger' : 'phaser');
      if (b === 1) assert.equal(nb.length, 0, `set ${s}: the second bar reuses the board`);
    }
  }
  assert.equal(boards, 6, 'one board a set');
  // THE DECK RULE: both modulations come round in the first two sets, and again in the next two
  assert.deepEqual([...new Set(seen.slice(0, 2))].sort(), ['flanger', 'phaser']);
  assert.deepEqual([...new Set(seen.slice(2, 4))].sort(), ['flanger', 'phaser']);
  set.dispose();
});
