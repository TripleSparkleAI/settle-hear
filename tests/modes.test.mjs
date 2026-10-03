// THE BINAURAL MODES (lane BINAURALMODES): one table of popular beats and carriers, each built as a pair plus a pad
// with the hero input plugged in; the vocoder and the ring modulator; the tone rules every voice keeps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, Node, all, reach } from './fakeaudio.mjs';
import {
  configure, unlockNow, getEngine, BINAURAL_MODES, MODE_KEYS, MODE_CYCLE, modeOf, isMode, modePair, gammaSound,
  createGammaSound, binauralPair, TONE, LEVELS, dbToGain, gainToDb, softEnvelope, gentleDetune, VOCODER, vocoderBands,
  createVocoder, createRingMod, HERO_INPUT, heroBus, feedHeroInput, readHeroInput, heroNudge, INSTRUMENT_KEYS,
  playNote, makeVoice, VOICES, buildChain, passOf, PASSES, strike,
} from '../src/index.js';

configure({ createContext: () => new Ctx() });

test('the mode table: 6 to 8 modes from one source, every beat and carrier positive and within range', () => {
  assert.ok(BINAURAL_MODES.length >= 6 && BINAURAL_MODES.length <= 8, `${BINAURAL_MODES.length} modes`);
  assert.equal(new Set(MODE_KEYS).size, BINAURAL_MODES.length, 'keys are unique');
  assert.deepEqual(MODE_KEYS, BINAURAL_MODES.map((m) => m.key), 'MODE_KEYS is the table in order');
  for (const m of BINAURAL_MODES) {
    assert.ok(m.beat > 0.5 && m.beat <= 40, `${m.key}: beat ${m.beat} Hz is a brainwave band`);
    assert.ok(m.carrier >= 80 && m.carrier <= 600, `${m.key}: carrier ${m.carrier} Hz is where a beat is heard`);
    assert.equal(m.group, 'modes');
    assert.ok(m.label && m.note && m.listen, `${m.key} is named and explained`);
    assert.ok(m.static > 0 && m.static <= 1, `${m.key}: the hero's static plays under it`);
    assert.ok(m.pad.cutoff >= 200 && m.pad.cutoff <= 4000 && m.pad.level > 0 && m.pad.level <= 1, `${m.key}: a soft pad`);
    assert.ok(m.pad.ratios.length >= 2 && m.pad.ratios.every((r) => r >= 1), `${m.key}: a chord above the carrier`);
    assert.ok(m.pad.breath > 0 && m.pad.shimmer >= 0 && m.pad.shimmer <= 1);
    assert.deepEqual(modePair(m.key), { left: m.carrier, right: m.carrier + m.beat, beat: m.beat });
    assert.equal(modeOf(m.key), m);
    assert.ok(isMode(m.key));
    // the same key is a gamma sound: the pair and the pad, the picture under it
    const g = gammaSound(m.key);
    assert.equal(g.key, m.key);
    assert.ok(g.layers.binaural > 0 && g.layers.pad > 0 && g.settle === true, `${m.key} as a gamma sound`);
    assert.ok(m.static >= g.layers.binaural && m.static >= g.layers.pad, `${m.key}: the SETTLE itself is the loudest layer`);
  }
  assert.equal(modeOf('no-such-mode'), undefined);
  assert.ok(!isMode('binaural'), 'the plain gamma stimuli are not modes');
  assert.equal(modePair('nothing'), null);
  // the popular numbers from the survey are in the table
  const beats = BINAURAL_MODES.map((m) => m.beat);
  for (const b of [40, 10, 7.83, 6, 3]) assert.ok(beats.includes(b), `a ${b} Hz mode`);
  assert.ok(BINAURAL_MODES.some((m) => m.carrier === 528), 'the 528 carrier');
  assert.ok(MODE_CYCLE.stretch >= 120 && MODE_CYCLE.stretch <= 600 && MODE_CYCLE.fade > 0 && MODE_CYCLE.barWait > 0);
});

test('every mode is built with the hero input plugged in: the pad passes a vocoder fed by the picture bus, and the numbers move the filter', () => {
  unlockNow();
  const E = getEngine();
  const bus = heroBus(E);
  assert.ok(bus instanceof Node);
  assert.equal(heroBus(E), bus, 'one bus');
  for (const key of MODE_KEYS) {
    feedHeroInput({ heat: 0, settled: 0, flipFraction: 0 }); // a still picture: the pad sits at its written cutoff
    const before = all.length;
    const g = createGammaSound({ mode: key, level: 0.4 });
    assert.ok(g.state.isMode && g.state.heroInput === true, `${key}: built with the hero input`);
    assert.deepEqual(g.layers.sort(), ['binaural', 'pad'], `${key}: the pair and the pad`);
    assert.deepEqual(g.state.pair, modePair(key), `${key}: at its own beat and carrier`);
    const fresh = all.slice(before);
    const padLp = fresh.filter((n) => n.kind === 'biquad' && n.type === 'lowpass' && n.frequency.value === modeOf(key).pad.cutoff);
    assert.equal(padLp.length, 1, `${key}: the pad's low-pass at ${modeOf(key).pad.cutoff} Hz`);
    const vocMods = fresh.filter((n) => n.kind === 'biquad' && n.type === 'bandpass');
    assert.equal(vocMods.length, 12, `${key}: 6 vocoder bands, a modulator and a carrier filter each`);
    assert.ok(vocMods.some((n) => reach(bus).has(n)), `${key}: the picture bus reaches the vocoder's bands`);
    // the pad's oscillators: one per chord ratio, detuned a few cents, and the filter reaches the page master
    const oscs = fresh.filter((n) => n.kind === 'osc' && n.type !== 'sine' || (n.kind === 'osc' && n.type === 'sine' && n.frequency.value === modeOf(key).carrier));
    assert.ok(oscs.length >= modeOf(key).pad.ratios.length, `${key}: a voice per ratio`);
    assert.ok(reach(padLp[0]).has(E.limit), `${key}: the pad reaches the master limiter`);
    // the hero's numbers: a hot field opens the filter above its written cutoff
    feedHeroInput({ heat: 1, settled: 0, flipFraction: 0.5 });
    const last = padLp[0].frequency.events.at(-1);
    assert.ok(last[1] > modeOf(key).pad.cutoff, `${key}: heat opened the filter (${last[1]} > ${modeOf(key).pad.cutoff})`);
    g.dispose();
  }
  const n = heroNudge(null);
  assert.deepEqual(n, { cutoff: 1, shimmer: 1, vocoder: 1 }, 'no numbers, no nudge');
  assert.ok(heroNudge({ heat: 1 }).cutoff > 1 && heroNudge({ settled: 1 }).cutoff < 1 && heroNudge({ flipFraction: 1 }).shimmer > 1);
  assert.deepEqual(readHeroInput(), { heat: 1, settled: 0, flipFraction: 0.5 });
});

test('a mode swap crossfades: the old layers ramp out over the fade and the new pad swells in; a hand pick is quick', () => {
  unlockNow();
  const g = createGammaSound({ mode: 'alpha-calm' });
  const oldGains = all.filter((n) => n.kind === 'gain' && n.gain.events.length && n.gain.value > 0).length;
  assert.ok(oldGains > 0);
  const mark = all.length;
  g.setMode('theta-deep', { fade: 6 });
  assert.equal(g.mode, 'theta-deep');
  const fresh = all.slice(mark);
  const rises = fresh.filter((n) => n.kind === 'gain' && n.gain.events.some((e) => e[0] === 'target' && e[1] > 0));
  assert.ok(rises.length >= 2, 'the new pair and pad fade in');
  assert.ok(rises.some((n) => n.gain.events.some((e) => e[0] === 'target' && e[1] > 0 && e[3] >= 2 - 1e-9)), 'a 6 s fade is a 2 s time constant');
  const outs = all.slice(0, mark).filter((n) => n.kind === 'gain' && n.gain.events.some((e) => e[0] === 'target' && e[1] === 0 && e[3] >= 2 - 1e-9));
  assert.ok(outs.length >= 1, 'the old layers ramp out over the same fade');
  g.setMode('gamma-focus');
  const quick = all.filter((n) => n.kind === 'gain' && n.gain.events.some((e) => e[0] === 'target' && e[1] === 0 && Math.abs(e[3] - TONE.pickFade / 3) < 1e-9));
  assert.ok(quick.length >= 1, 'a hand pick fades at TONE.pickFade');
  // a mode keeps its own carrier: the console's carrier choice changes nothing it plays
  const built = all.length;
  g.setCarrier('400');
  assert.equal(all.length, built, 'no rebuild');
  assert.deepEqual(g.state.pair, modePair('gamma-focus'));
  g.dispose();
});

test('the vocoder: the band count, centres rising from lo to hi, silence in gives silence out, depth 0 is silent', () => {
  const ctx = new Ctx();
  const centres = vocoderBands(8, 100, 3200);
  assert.equal(centres.length, 8);
  assert.equal(centres[0], 100);
  assert.ok(Math.abs(centres.at(-1) - 3200) < 1e-6);
  for (let i = 1; i < centres.length; i++) assert.ok(centres[i] > centres[i - 1]);
  assert.deepEqual(vocoderBands(1, 100, 400), [200]);
  const v = createVocoder(ctx);
  assert.equal(v.bands.length, VOCODER.bands);
  for (const b of v.bands) {
    assert.equal(b.gain.gain.value, 0, `band ${b.hz}: the gain is the envelope and starts at zero`);
    assert.ok(reach(v.modulator).has(b.follow), 'the modulator reaches the follower');
    assert.ok(reach(v.carrier).has(b.gain) && reach(b.gain).has(v.output), 'the carrier reaches the output through the band gain');
    assert.ok(b.follow.out.size === 1, 'the follower drives one thing: the makeup into the gain parameter');
    assert.ok(!reach(v.modulator).has(v.output), 'the modulator is never heard, only its envelope');
  }
  const quiet = createVocoder(ctx, { depth: 0, bands: 4 });
  assert.equal(quiet.output.gain.value, 0);
  quiet.setDepth(2);
  assert.equal(quiet.output.gain.value, VOCODER.out, 'depth is clamped to 1');
  v.dispose();
  assert.equal(v.output.out.size, 0);
});

test('the ring modulator: dry plus wet never exceeds the input, depth 0 is a wire, and in a chain it stays under the limiter', () => {
  const ctx = new Ctx();
  const r = createRingMod(ctx, { rate: 432, depth: 0.3 });
  assert.ok(r.osc.started && r.lfo.started);
  const dry = all.find((n) => n.kind === 'gain' && n.gain.value === 0.7 && reach(r.input).has(n));
  assert.ok(dry, 'the dry path at 1 - depth');
  assert.ok(reach(r.input).has(r.output));
  r.setDepth(0);
  assert.equal(r.depth, 0);
  r.setDepth(9);
  assert.equal(r.depth, 1, 'clamped');
  r.setRate(NaN);
  assert.equal(r.osc.frequency.value, 432, 'a broken rate keeps the last one');
  r.dispose();
  assert.ok(r.osc.stopped && r.lfo.stopped);
  // in the house chain: the two taste passes end at the chain's limiter, and the vocoder reads the tap as modulator
  const tap = ctx.createGain();
  const chain = buildChain(ctx, ['ring-shimmer', 'vocoder-static'], { env: { tap: (n) => (n === 'picture' ? tap : null) } });
  assert.deepEqual(chain.keys, ['ring-shimmer', 'vocoder-static']);
  assert.equal(chain.output, chain.limiter);
  assert.ok(reach(chain.input).has(chain.limiter), 'input reaches the limiter');
  const mods = all.filter((n) => n.kind === 'biquad' && n.type === 'bandpass' && reach(tap).has(n));
  assert.equal(mods.length, 6, 'the picture tap reaches the six modulator bands');
  chain.bar(0, { root: 57, beatDur: 0.5, chord: [57, 60, 64], melody: [] });
  for (const k of ['vocoder-static', 'ring-shimmer']) {
    const P = passOf(k);
    assert.ok(P && P.line.length > 20 && P.cost > 0 && P.family === 'mod');
  }
  assert.equal(PASSES.length, 35, 'HOUSEDJ 25, these two, and lane HEROSHUFFLE eight');
  chain.dispose();
});

test('the tone rules: every instrument note, every struck voice and the house strike have a nonzero attack and release', () => {
  assert.ok(TONE.attackMin > 0 && TONE.releaseMin > 0 && TONE.attackSoft >= TONE.attackMin && TONE.releaseSoft >= TONE.releaseMin);
  assert.ok(TONE.rawCeiling <= 3000, 'a raw saw is low-passed at or below 3 kHz');
  assert.ok(Math.abs(gainToDb(dbToGain(-18)) + 18) < 1e-9 && dbToGain(NaN) === 0);
  for (const [k, v] of Object.entries(LEVELS)) assert.ok(v < 0 && v > -40, `${k} aims at ${v} dBFS`);
  assert.ok(LEVELS.static > LEVELS.binaural && LEVELS.binaural > LEVELS.pad, 'static loudest, the pair under, the pad under that');
  assert.equal(gentleDetune(0, 3, 6), -6);
  assert.equal(gentleDetune(2, 3, 6), 6);
  assert.equal(gentleDetune(1, 3, 6), 0);
  assert.equal(gentleDetune(0, 1), 0);
  const ctx = new Ctx();
  const out = ctx.createGain();
  // an envelope asked for a 0 s attack and a 0 s release gets the floors
  const e = softEnvelope(ctx, out, 1, { attack: 0, peak: 0.2, hold: 0.5, release: 0 });
  assert.equal(e.attack, TONE.attackMin);
  assert.equal(e.release, TONE.releaseMin);
  // every instrument's note: a gain that starts at 0, ramps up over at least the attack floor, then targets 0 with
  // a time constant of at least a third of the release floor; no raw saw reaches `out` without a low-pass
  const checkEnvelopes = (label, mark) => {
    const gains = all.slice(mark).filter((n) => n.kind === 'gain' && n.gain.events.length >= 2);
    const env = gains.find((n) => {
      const ev = n.gain.events;
      const i = ev.findIndex((x) => x[0] === 'set' && x[1] === 0);
      const j = ev.findIndex((x, k) => k > i && (x[0] === 'lin' || x[0] === 'exp') && x[1] > 0);
      if (i < 0 || j < 0) return false;
      const attack = ev[j][2] - ev[i][2];
      const rel = ev.find((x, k) => k > j && (x[0] === 'target' || x[0] === 'exp') && x[1] <= 0.001);
      return attack >= TONE.attackMin - 1e-9 && rel && (rel[0] === 'exp' ? rel[2] - ev[j][2] : rel[3] * 3) >= TONE.releaseMin - 1e-9;
    });
    assert.ok(env, `${label}: an envelope with a real attack and release`);
    for (const o of all.slice(mark).filter((n) => n.kind === 'osc' && (n.type === 'sawtooth' || n.type === 'square'))) {
      assert.ok([...o.out].every((n) => n.kind === 'biquad' || n.kind === 'gain' && [...n.out].every((m) => m.kind === 'biquad')), `${label}: a raw ${o.type} goes through a filter`);
    }
  };
  for (const inst of INSTRUMENT_KEYS) {
    const mark = all.length;
    assert.ok(playNote(ctx, out, inst, 432, 1, 0.5, 0.8));
    checkEnvelopes(inst, mark);
  }
  for (const [name, kind, d] of [['chime', 'settled', {}], ['pulse', 'click', { power: 8, max: true }]]) {
    const v = makeVoice(name, ctx, out);
    v.update({ level: 1, held: 0, heat: 0, flipFraction: 0, grains: 0, settled: 0, consonance: 0, ratios: [1, 1.25, 1.5, 2], cutoff: 1000, power: 1, phase: 'custom' }, 1);
    const mark = all.length;
    v.event(kind, d, 1);
    checkEnvelopes(`voice ${name}`, mark);
    v.dispose();
  }
  const mark = all.length;
  strike(ctx, out, 'sawtooth', 216, 1, { attack: 0, decay: 0 });
  checkEnvelopes('house strike', mark);
  assert.ok(VOICES.length === 7);
});
