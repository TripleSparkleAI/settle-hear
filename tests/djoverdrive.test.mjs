// THE DJ's OVERDRIVE AND VOCODER (lane DJOVERDRIVE, dj-fx.js + dj-colour.js): the OVERDRIVE mood (GRIT refitted) dealt
// one phrase in five on a valve stage of the bus; a harmonic overdrive on single voices, mostly the lead, and on the
// McKusker flute; a vocoder of our own synthesis on a voice for a set, warbling or steady; never louder than the dry
// path; the binaural pair never enters; MUTE ALL builds nothing; the steering overrides; djLive and the line name it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, all, reach } from './fakeaudio.mjs';
import { renderSound, mono } from './offline.mjs';
import {
  MOODS, MOOD_KEYS, moodOf, PHRASE_BARS, CAPS, fxValues, createDjFx, createFxBus, OVERDRIVE_MOOD, DEALT_MOODS,
  VOCODER, vocoderBands, colourBuses, loadColour, colourNow,
  colourWords, createVoiceBuses, SYMPHONY_SLOTS, playNote, midiHz, createSymphony, configure, unlockNow, sound, djLive,
  djSnapshot, STEER_IDLE, applySteer,
} from '../src/index.js';
// the audio half waits in its own chunk (dj-colour-stage.js, loaded on demand); imported by path, never from the index
import { TUBE, tube, tubeCurve, identityCurve, OVERSAMPLE, createTube, VOICE_VOCODER, createColourStage } from '../src/dj-colour-stage.js';

await loadColour();

const bars = (dj, n, opts = {}) => { const out = []; for (let b = 0; b < n; b++) out.push(dj.bar({ inputs: opts.inputs ?? {}, steer: opts.steer ?? null, newSet: opts.newSetEvery ? b > 0 && b % opts.newSetEvery === 0 : false, hold: !!opts.hold, pure: !!opts.pure })); return out; };
const phraseHeads = (states) => states.filter((_, i) => i % PHRASE_BARS === 0);
const rms = (x) => { let a = 0; for (const v of x) a += v * v; return Math.sqrt(a / x.length); };
const peak = (r) => { let p = 0; for (let i = 0; i < r.L.length; i++) p = Math.max(p, Math.abs(r.L[i]), Math.abs(r.R[i])); return p; };

test('OVERDRIVE is GRIT refitted: still ten moods, GRIT gone, the valve on the bus and no parallel drive', () => {
  assert.equal(MOODS.length, 10);
  assert.ok(!MOOD_KEYS.includes('grit'), 'GRIT is refitted, not kept beside it');
  const od = moodOf(OVERDRIVE_MOOD);
  assert.equal(od.key, 'overdrive');
  assert.equal(od.label, 'OVERDRIVE');
  assert.ok(od.tube > 0.5 && od.tubeGain >= 3, 'the valve is pushed');
  assert.equal(od.drive, 0, 'the settle\'s parallel shapers rest under the valve');
  assert.deepEqual([...DEALT_MOODS].sort(), MOOD_KEYS.filter((k) => k !== 'overdrive').sort(), 'the bag deals the other nine');
  for (const m of MOODS) if (m.key !== 'overdrive') assert.equal(fxValues(m).tube, 0, `${m.key}: no valve`);
  const v = fxValues(od);
  assert.ok(v.tube > 0 && v.tube <= CAPS.tube[1] && v.tubeGain >= CAPS.tubeGain[0] && v.tubeGain <= CAPS.tubeGain[1]);
});

test('THE OVERDRIVE DECK: one phrase in five over many seeds, never two in a row, the visit\'s first phrase calm', () => {
  let over = 0;
  let total = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const ps = phraseHeads(bars(createDjFx({ seed }), PHRASE_BARS * 100));
    assert.equal(ps[0].overdrive, false, `seed ${seed}: the first phrase is calm`);
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.overdrive) {
        over += 1;
        assert.equal(p.mood, 'overdrive');
        assert.equal(p.moodLabel, 'OVERDRIVE');
        assert.ok(p.values.tube > 0, 'the bus takes the valve');
        assert.notEqual(p.baseMood, 'overdrive', 'the dealt mood stays underneath');
      } else assert.equal(p.values.tube, 0, 'no valve outside OVERDRIVE');
      if (i > 0) assert.ok(!(p.overdrive && ps[i - 1].overdrive), `seed ${seed}: two OVERDRIVE phrases in a row at ${i}`);
    }
    total += ps.length;
  }
  const rate = over / total;
  assert.ok(rate >= 0.19 && rate <= 0.21, `OVERDRIVE rate ${rate}`);
  // it holds for its whole phrase and changes only on a phrase line
  const all4 = bars(createDjFx({ seed: 7 }), PHRASE_BARS * 30);
  for (let b = 0; b < all4.length; b++) if (b % PHRASE_BARS) assert.equal(all4[b].overdrive, all4[b - 1].overdrive);
});

test('held phrases never overdrive the bus; the steering: a steered mood wins, overdrive 0 never deals it, a steered overdrive sets the valve', () => {
  for (const s of bars(createDjFx({ seed: 3 }), 40, { hold: true })) { assert.equal(s.overdrive, false); assert.equal(s.values.tube, 0); assert.equal(s.colour.drive, null); }
  const steered = phraseHeads(bars(createDjFx({ seed: 5 }), PHRASE_BARS * 60, { steer: { mood: 'cathedral' } }));
  assert.ok(steered.every((p) => !p.overdrive && p.mood !== 'overdrive' && p.values.size === moodOf('cathedral').size && p.values.tube === 0), 'the steered mood holds, OVERDRIVE never takes it');
  const off = phraseHeads(bars(createDjFx({ seed: 5 }), PHRASE_BARS * 60, { steer: { overdrive: 0 } }));
  assert.ok(off.every((p) => !p.overdrive && p.values.tube === 0 && !p.colour.drive), 'overdrive 0: no OVERDRIVE and no voice overdrive');
  const on = phraseHeads(bars(createDjFx({ seed: 5 }), PHRASE_BARS * 20, { steer: { overdrive: 0.5 } }));
  assert.ok(on.every((p) => Math.abs(p.values.tube - 0.5 * CAPS.tube[1]) < 1e-12), 'a steered overdrive sets the valve in every mood');
  const vocOff = phraseHeads(bars(createDjFx({ seed: 9 }), PHRASE_BARS * 60, { newSetEvery: PHRASE_BARS * 2, steer: { vocoder: 0 } }));
  assert.ok(vocOff.every((p) => !p.colour.vocoder), 'vocoder 0: never a vocoder');
  const vocOn = phraseHeads(bars(createDjFx({ seed: 9 }), PHRASE_BARS * 10, { steer: { vocoder: 1 } }));
  assert.ok(vocOn.every((p) => p.colour.vocoder && p.colour.vocoder.amount > 0), 'vocoder 1: always one');
  // the store carries the two new parts and applySteer hands them on
  const calls = [];
  applySteer({ setFxSteer: (fx) => calls.push(fx) }, { ...STEER_IDLE, fx: { ...STEER_IDLE.fx, overdrive: 0, vocoder: 1 } }, STEER_IDLE);
  assert.equal(calls[0].overdrive, 0);
  assert.equal(calls[0].vocoder, 1);
});

test('THE VOICE COLOUR DECKS: about three phrases in eight overdrive a voice (the lead twice as often), never on an OVERDRIVE phrase; the McKusker flute one in four; a vocoder one set in three, warbling and steady', () => {
  const tally = { phrases: 0, drive: 0, lead: 0, other: 0, pure: 0, purePhrases: 0, sets: 0, voc: 0, warble: 0, steady: 0 };
  for (let seed = 1; seed <= 40; seed++) {
    const ps = phraseHeads(bars(createDjFx({ seed }), PHRASE_BARS * 200));
    for (const p of ps) {
      if (p.overdrive) { assert.equal(p.colour.drive, null, 'no single voice is pushed on an OVERDRIVE phrase'); continue; }
      tally.phrases += 1;
      const d = p.colour.drive;
      if (d) { tally.drive += 1; tally[d.voice] += 1; assert.ok(d.amount > 0 && d.amount <= 1 && d.gain >= 3 && d.gain <= 6); }
    }
    const pure = phraseHeads(bars(createDjFx({ seed }), PHRASE_BARS * 100, { hold: true, pure: true }));
    tally.purePhrases += pure.length;
    for (const p of pure) { if (p.colour.drive) { tally.pure += 1; assert.equal(p.colour.drive.voice, 'flute'); } assert.equal(p.colour.vocoder, null, 'the McKusker flute is never vocoded'); assert.equal(p.values.tube, 0); }
    // sets every two phrases: the vocoder is dealt per set and held through it
    const sets = phraseHeads(bars(createDjFx({ seed }), PHRASE_BARS * 240, { newSetEvery: PHRASE_BARS * 2 }));
    for (let i = 0; i < sets.length; i += 2) {
      tally.sets += 1;
      const v = sets[i].colour.vocoder;
      if (i + 1 < sets.length) assert.deepEqual(sets[i + 1].colour.vocoder, v, 'a vocoder holds for its set');
      if (v) { tally.voc += 1; tally[v.warble ? 'warble' : 'steady'] += 1; assert.ok(v.rate >= 0.35 && v.rate <= 0.6); }
    }
  }
  const driveRate = tally.drive / tally.phrases;
  assert.ok(driveRate > 0.33 && driveRate < 0.42, `voice overdrive rate ${driveRate}`);
  assert.ok(tally.lead / tally.drive > 0.6 && tally.lead / tally.drive < 0.73, `lead share ${tally.lead / tally.drive}`);
  const pureRate = tally.pure / tally.purePhrases;
  assert.ok(pureRate > 0.22 && pureRate < 0.28, `McKusker overdrive rate ${pureRate}`);
  const vocRate = tally.voc / tally.sets;
  assert.ok(vocRate > 0.28 && vocRate < 0.39, `vocoder rate ${vocRate}`);
  assert.ok(tally.warble > 0.4 * tally.voc && tally.steady > 0.4 * tally.voc, `warble ${tally.warble} steady ${tally.steady}`);
});

test('THE VALVE: slope 1 at zero, never larger than its input, sign kept, asymmetric, and both even and odd harmonics', () => {
  for (let i = -400; i <= 400; i++) { const u = i / 100; assert.ok(Math.abs(tube(u)) <= Math.abs(u) + 1e-12, `|tube(${u})|`); assert.ok(Math.sign(tube(u)) === Math.sign(u)); }
  assert.ok(Math.abs(tube(1e-4) / 1e-4 - 1) < 1e-3 && Math.abs(tube(-1e-4) / -1e-4 - 1) < 1e-3, 'unity for a quiet signal');
  assert.ok(Math.abs(tube(1) + tube(-1)) > 0.05, 'the two half-waves clip differently');
  // a sine pushed into it: the second and third harmonics, against a symmetric tanh that makes no second
  const harm = (f, k) => { const N = 4096; let re = 0; let im = 0; for (let n = 0; n < N; n++) { const y = f(3 * Math.sin((2 * Math.PI * 8 * n) / N)); re += y * Math.cos((2 * Math.PI * 8 * k * n) / N); im += y * Math.sin((2 * Math.PI * 8 * k * n) / N); } return Math.hypot(re, im); };
  const h1 = harm(tube, 1);
  assert.ok(harm(tube, 2) / h1 > 0.05, `even: ${harm(tube, 2) / h1}`);
  assert.ok(harm(tube, 3) / h1 > 0.05, `odd: ${harm(tube, 3) / h1}`);
  const sym = (u) => Math.tanh(1.7 * u) / 1.7;
  assert.ok(harm(sym, 2) / harm(sym, 1) < 1e-6, 'control: a symmetric curve makes no second harmonic');
  // the curves: the valve and the straight line, over the same span
  const c = tubeCurve();
  const id = identityCurve();
  assert.equal(c.length, TUBE.n);
  assert.ok(Math.abs(id[0] + TUBE.span) < 1e-6 && Math.abs(id[TUBE.n - 1] - TUBE.span) < 1e-6);
});

test('THE TUBE on the bus: built only for a valve blend, both legs oversampled 4x, handed over from the direct path, behind the bus limiter', () => {
  const ctx = new Ctx();
  const master = ctx.createGain();
  const bus = createFxBus({ ctx, master });
  bus.apply(fxValues(moodOf('dub-echo')), 0);
  assert.equal(bus.nodes.tube, null, 'no valve outside OVERDRIVE');
  bus.apply(fxValues(moodOf('overdrive')), 1);
  const T = bus.nodes.tube;
  assert.ok(T, 'built once wanted');
  assert.equal(T.nodes.valve.oversample, OVERSAMPLE);
  assert.equal(T.nodes.twin.oversample, OVERSAMPLE, 'the dry leg carries the same latency');
  assert.equal(OVERSAMPLE, '4x');
  // the handover: the direct path ramps to 0 while the tube's output ramps to 1, and set() never touched the output
  assert.deepEqual(bus.nodes.tubeDirect.gain.events.filter((e) => e[0] === 'lin').map((e) => e[1]), [0]);
  assert.deepEqual(T.output.gain.events.filter((e) => e[0] === 'lin').map((e) => e[1]), [1]);
  assert.ok(Math.abs(T.amount - moodOf('overdrive').tube) < 1e-12);
  // every path from the input to the master still passes the bus limiter
  const { limit, unmake } = bus.nodes;
  assert.deepEqual(all.filter((n) => n.out.has(master)), [unmake]);
  assert.ok(reach(T.input).has(limit));
  // back to a calm mood: the valve's blend goes to 0 (the stage stays built, its dry leg aligned)
  bus.apply(fxValues(moodOf('clean')), 2);
  assert.equal(T.amount, 0);
});

test('NEVER LOUDER THAN THE DRY PATH (offline): an overdriven voice and a vocoded voice render at or under the dry RMS and peak, for every melodic instrument', () => {
  const notes = [74, 79, 76, 72];
  const phrase = (ctx, out, inst, t, vel) => notes.forEach((m, i) => playNote(ctx, out, inst, midiHz(m - (inst === 'harp' ? 12 : 0)), t + i * 0.35, 0.33, vel));
  const render = (inst, plan, vel) => renderSound((ctx, dest, t) => {
    let into = dest;
    if (plan) { const st = createColourStage(ctx, dest); st.set(plan, 0, 0.001); into = st.input; }
    phrase(ctx, into, inst, t, vel);
  }, { seconds: 1.5 });
  const rows = [];
  // a loud phrase and a soft one: the band bank's envelope is capped, so a soft voice is the vocoder's loudest case
  for (const [inst, vel] of [['flute', 0.85], ['flute', 0.3], ['flute-drive', 0.85], ['keys', 0.85], ['keys', 0.3], ['harp', 0.85], ['bells', 0.85], ['pluck', 0.85]]) {
    const render1 = (plan) => render(inst, plan, vel);
    const dry = render1(null);
    const d = { r: rms(mono(dry)), p: peak(dry) };
    assert.ok(d.r > 0.005, `${inst} plays`);
    // the hardest push THE DJ deals (amount 0.9, gain 6) and the gentlest (gain 3)
    for (const drive of [{ amount: 0.9, gain: 6 }, { amount: 0.55, gain: 3 }]) {
      const o = render1({ drive });
      rows.push([`${inst} ${vel}`, 'drive', drive.gain, rms(mono(o)) / d.r, peak(o) / d.p]);
    }
    for (const vocoder of [{ amount: 1, warble: true, rate: 0.6, depth: 0.007, rootHz: 300 }, { amount: 1, warble: false, rootHz: 150 }]) {
      const v = render1({ vocoder });
      rows.push([`${inst} ${vel}`, 'vocoder', vocoder.rootHz, rms(mono(v)) / d.r, peak(v) / d.p]);
    }
  }
  for (const [inst, kind, k, r, p] of rows) {
    assert.ok(r <= 1, `${inst} ${kind} ${k}: RMS ${r.toFixed(3)} of dry`);
    assert.ok(p <= 1, `${inst} ${kind} ${k}: peak ${p.toFixed(3)} of dry`);
  }
  // and the overdrive is audible: the flute's harder push takes level off its peaks (the valve is working)
  assert.ok(rows.find((x) => x[0] === 'flute 0.85' && x[1] === 'drive' && x[2] === 6)[4] < 0.9);
});

test('NEVER LOUDER on the bus (offline): the OVERDRIVE valve on a hero-like mix stays under the dry mix', () => {
  const mix = (ctx, out, t) => {
    for (const f of [196, 246.9, 293.7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.04; o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.2); }
    [587.3, 659.3, 784, 659.3].forEach((f, i) => playNote(ctx, out, 'flute', f, t + i * 0.3, 0.28, 0.85));
  };
  const dry = renderSound((ctx, dest, t) => mix(ctx, dest, t), { seconds: 1.3 });
  const v = fxValues(moodOf('overdrive'));
  const wet = renderSound((ctx, dest, t) => { const T = createTube(ctx); T.output.connect(dest); T.set(v.tube, v.tubeGain, 0, 0.001); mix(ctx, T.input, t); }, { seconds: 1.3 });
  assert.ok(rms(mono(wet)) <= rms(mono(dry)), `RMS ${rms(mono(wet)) / rms(mono(dry))}`);
  assert.ok(peak(wet) <= peak(dry), `peak ${peak(wet) / peak(dry)}`);
});

test('THE VOCODER: the shared band bank (vocoder.js), each envelope opening its own band of our carrier; silent with no voice; the warble swings, steady rests', () => {
  const ctx = new Ctx();
  const st = createColourStage(ctx, ctx.createGain());
  st.set({ vocoder: { amount: 0.7, warble: true, rate: 0.5, depth: 0.006, rootHz: 200 } }, 0, 0.1);
  const V = st.vocoder;
  assert.equal(V.bands.length, VOCODER.bands, 'the shared bank, not a second one');
  const c = vocoderBands();
  for (let i = 1; i < c.length; i++) assert.ok(Math.abs(c[i] / c[i - 1] - c[1] / c[0]) < 1e-9, 'log-spaced');
  for (const b of V.bands) {
    assert.equal(b.gain.gain.value, 0, 'a band is closed with no voice');
    assert.equal(b.mod.frequency.value, b.car.frequency.value, 'the same band on both sides');
    assert.ok(reach(V.input).has(b.mod), 'the voice is the modulator');
  }
  // our carrier: the voice squared and the saw chord, through the warble delay, into every carrier band
  assert.ok(V.bands.every((b) => reach(V.saws[0]).has(b.car)), 'the chord reaches every band');
  assert.deepEqual(V.saws.map((o) => Math.round(o.frequency.value)), [200, 300, 400], 'the chord on the set\'s root');
  assert.equal(V.warble, true);
  assert.ok(V.lfoDelay.gain.value > 0, 'warbling: the delay swings');
  st.set({ vocoder: { amount: 0.7, warble: false, rootHz: 200 } }, 1, 0.1);
  assert.equal(V.warble, false);
  assert.equal(V.lfoDelay.gain.value, 0, 'steady: it rests');
  assert.ok(VOICE_VOCODER.warbleRate[1] <= 0.6, 'a slow warble');
  // silent with no voice, rendered (the carrier runs, every band stays shut)
  const r = renderSound((octx, dest) => { const s2 = createColourStage(octx, dest); s2.set({ vocoder: { amount: 1, warble: true, rootHz: 220 } }, 0, 0.001); }, { seconds: 0.6 });
  assert.ok(peak(r) < 1e-6, `no voice, no sound: ${peak(r)}`);
  // off: it is freed once faded
  st.set({}, 2, 0.01);
  assert.equal(st.state.vocoder, null);
  st.dispose();
});

test('colourBuses: the same buses, a coloured part\'s notes go through its stage, the rest and every method untouched, dispose frees both', () => {
  const ctx = new Ctx();
  const out = ctx.createGain();
  const inner = createVoiceBuses(ctx, out, SYMPHONY_SLOTS);
  const w = colourBuses(inner, ctx);
  const plain = w.input('harp', 0);
  assert.equal(plain, inner.input('harp', 0), 'an uncoloured part plays straight into its bus');
  assert.equal(typeof w.palette, 'function');
  assert.equal(w.voiceOf, inner.voiceOf);
  w.colour({ lead: { drive: { amount: 0.8, gain: 4 } } }, 0);
  const leadIn = w.input('lead', 0);
  assert.notEqual(leadIn, inner.input('lead', 0), 'the lead goes through its stage');
  assert.ok(reach(leadIn).has(inner.input('lead', 0)), 'and the stage plays into the lead\'s own bus, before its chain and its mute');
  assert.deepEqual(Object.keys(w.colourState()), ['lead']);
  assert.equal(w.colourState().lead.drive.amount, 0.8);
  // a plan that leaves the lead out takes it back to dry; the stage stays (no latency jump mid-phrase)
  w.colour({}, 1);
  assert.equal(w.colourState().lead.drive, null);
  assert.equal(w.input('lead', 1), leadIn);
  w.dispose();
});

test('THE HERO SYMPHONY: the lead takes THE DJ\'s colour, djLive and the line name it while it sounds, the binaural pair never meets a stage, MUTE ALL builds nothing', () => {
  configure({ createContext: () => new Ctx() });
  const E = unlockNow();
  sound.setMuted(false);
  const s = createSymphony({ seed: 31, theme: 'highlands', auto: false, steer: null, votes: null });
  for (const k of ['fiddle', 'harp', 'bells', 'crystal']) s.setTrack(k, false);
  s.dj.lockTheme(true);
  s.dj.clamp('flute', true);
  // a steered overdrive and vocoder: the deck still chooses which voice, the steering keeps them on
  s.setFxSteer({ overdrive: 0.8, vocoder: 1 });
  s.setMelodyMute(false); // the flute starts off (melody.js); the McKusker toggle brings it in
  const m0 = all.length;
  let named = null;
  let label = null;
  for (let k = 0; k < 80 && !(named && label); k++) {
    E.ctx.currentTime += 0.5;
    s.tick();
    const fx = djLive.get().fx;
    if (fx?.colour?.vocoder?.present) named = fx.colour;
    if (fx?.colourLabel) label = fx.colourLabel;
  }
  assert.ok(named, 'djLive names the vocoder while the lead sounds');
  assert.equal(named.vocoder.slot, 'lead');
  assert.match(label, /vocoder on the lead/);
  assert.equal(colourWords({ drive: { slot: 'lead', present: true }, vocoder: { slot: 'harp', warble: true, present: true } }), 'overdrive on the lead · vocoder on the harp, warbling');
  assert.equal(colourWords({ drive: { slot: 'lead', present: false } }), '', 'a voice not sounding is not named');
  const made = all.slice(m0);
  const stages = made.filter((n) => n.kind === 'shaper' && n.oversample === '4x');
  assert.ok(stages.length >= 2, 'the lead\'s valve and its twin were built');
  // the binaural pair: its oscillators reach no colour stage and no vocoder band
  const vocNodes = new Set(made.filter((n) => n.kind === 'biquad' && n.type === 'bandpass'));
  const binOscs = all.filter((n) => n.kind === 'osc' && n.type === 'sine' && [...n.out].some((g) => [...(g.out ?? [])].some((m) => m.kind === 'merger')));
  assert.ok(binOscs.length >= 2, 'the binaural pair found');
  for (const o of binOscs) for (const n of reach(o)) { assert.ok(!stages.includes(n), 'the binaural pair never meets a valve'); assert.ok(!vocNodes.has(n), 'nor a vocoder band'); }
  assert.doesNotThrow(() => JSON.stringify(djLive.get()));
  assert.deepEqual(djSnapshot({ fx: { mood: 'clean' } }).fx.colour, { drive: null, vocoder: null });
  s.setMelodyMute(true);
  s.dispose();
  // MUTE ALL: a muted symphony deals the colour but builds no stage
  sound.setMuted(true);
  const m1 = all.length;
  const q = createSymphony({ seed: 32, theme: 'highlands', auto: false, steer: null, votes: null });
  q.setFxSteer({ overdrive: 0.8, vocoder: 1 });
  for (let k = 0; k < 40; k++) { E.ctx.currentTime += 0.5; q.tick(); }
  assert.equal(q.state.audible, false);
  assert.equal(all.slice(m1).filter((n) => n.kind === 'shaper' && n.oversample === '4x').length, 0, 'muted: no valve');
  assert.equal(all.slice(m1).filter((n) => n.kind === 'osc' && n.type === 'sawtooth').length, 0, 'muted: no vocoder carrier');
  assert.equal(q.state.fx.colourLabel, null, 'muted: nothing is named');
  q.dispose();
  sound.setMuted(false);
  // the McKusker flute: its own overdrive, through the pure gate
  const p = createSymphony({ seed: 33, theme: 'highlands', auto: false, pure: true, steer: null, votes: null });
  p.setFxSteer({ overdrive: 0.7 });
  p.setMelodyMute(false);
  const m2 = all.length;
  let pureNamed = false;
  for (let k = 0; k < 120 && !pureNamed; k++) { E.ctx.currentTime += 0.5; p.tick(); pureNamed = /overdrive on the McKusker flute/.test(p.state.fx.colourLabel ?? ''); }
  assert.ok(pureNamed, 'the McKusker flute is overdriven on some phrase and named');
  assert.ok(all.slice(m2).some((n) => n.kind === 'shaper' && n.oversample === '4x'), 'through its own valve');
  assert.equal(p.state.fx.values.tube, 0, 'the bus stays dry under the pure flute');
  p.setMelodyMute(true);
  p.dispose();
});
