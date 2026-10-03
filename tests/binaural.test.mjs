// 40 Hz gamma sound: every binaural pair is 40 Hz apart with one tone per ear, the pulse trains repeat exactly 40
// times a second, nothing is built before the first gesture, and MUTE ALL silences it like every other sound.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  configure, unlockNow, getEngine, sound, CARRIERS, GAMMA_SOUNDS, GAMMA_BEAT, binauralPair, pulseTrain, pinkNoise,
  onsets, createGammaSound, gammaSound, gammaCarrierOf, activeGammaSounds,
} from '../src/index.js';

class Param {
  constructor(v, min = -3.4e38, max = 3.4e38) { this.value = v; this.minValue = min; this.maxValue = max; }
  setValueAtTime(v) { if (!Number.isFinite(v)) throw new TypeError(`${v}`); this.value = v; }
  setTargetAtTime(v) { if (!Number.isFinite(v)) throw new TypeError(`${v}`); this.value = v; }
  cancelScheduledValues() {}
}
const all = [];
class Node {
  constructor(kind, props = {}) { this.kind = kind; this.links = []; this.started = false; this.stopped = false; Object.assign(this, props); all.push(this); }
  connect(n, out = 0, input = 0) { this.links.push({ to: n, out, input }); return n; }
  disconnect() { this.links = []; }
  get out() { return new Set(this.links.map((l) => l.to)); }
}
class Ctx {
  constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'suspended'; this.destination = new Node('destination'); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  createGain() { return new Node('gain', { gain: new Param(1) }); }
  createBiquadFilter() { return new Node('biquad', { type: 'lowpass', frequency: new Param(350, 0, 24000), Q: new Param(1) }); }
  createDynamicsCompressor() { return new Node('compressor', { threshold: new Param(-24), knee: new Param(30), ratio: new Param(12), attack: new Param(0.003), release: new Param(0.25) }); }
  createConvolver() { return new Node('convolver', { buffer: null }); }
  createDelay() { return new Node('delay', { delayTime: new Param(0) }); }
  createChannelMerger(n) { return new Node('merger', { inputs: n }); }
  createOscillator() { return new Node('osc', { type: 'sine', frequency: new Param(440, 0, 24000), start() { this.started = true; }, stop() { this.stopped = true; } }); }
  createBufferSource() { return new Node('src', { buffer: null, loop: false, start() { this.started = true; }, stop() { this.stopped = true; } }); }
  createBuffer(ch, n, rate) {
    const data = Array.from({ length: ch }, () => new Float32Array(n));
    return { numberOfChannels: ch, length: n, sampleRate: rate, getChannelData: (c) => data[c] };
  }
}
configure({ createContext: () => new Ctx() });

// is there a path of connections from a to b?
function reaches(a, b, seen = new Set()) {
  if (a === b) return true;
  if (seen.has(a)) return false;
  seen.add(a);
  return a.links.some((l) => reaches(l.to, b, seen));
}

test('every carrier pair is exactly 40 Hz apart, the right ear the higher tone', () => {
  assert.equal(GAMMA_BEAT, 40);
  assert.ok(CARRIERS.length >= 3);
  for (const c of CARRIERS) {
    assert.equal(c.right - c.left, 40, c.key);
    assert.deepEqual(binauralPair(c.left), { left: c.left, right: c.right, beat: 40 });
  }
  assert.deepEqual(binauralPair(NaN), { left: 200, right: 240, beat: 40 }, 'a broken carrier falls back');
});

test('the sound modes: binaural, binaural + settle, isochronic, clicks, pink + binaural, silent; unknown keys fall back', () => {
  assert.deepEqual(GAMMA_SOUNDS.map((m) => m.key), ['binaural', 'binaural-settle', 'isochronic', 'clicks', 'pink-binaural', 'silent']);
  assert.equal(gammaSound('nope').key, 'binaural');
  assert.equal(gammaCarrierOf('nope').key, '200');
  assert.equal(gammaSound('binaural-settle').settle, true);
  assert.deepEqual(gammaSound('silent').layers, {});
});

for (const sr of [44100, 48000]) {
  test(`the isochronic tone at ${sr} Hz: 40 bursts in one second, on for half of it, silent between`, () => {
    const s = pulseTrain(sr, { carrier: 200, onMs: 12.5, rampMs: 1.5 });
    assert.equal(s.length, sr);
    const t = onsets(s, sr);
    assert.equal(t.length, 40);
    for (let k = 1; k < t.length; k++) assert.ok(Math.abs(t[k] - t[k - 1] - 0.025) < 1.5 / sr + 1e-9, `gap ${t[k] - t[k - 1]}`);
    const period = sr / 40;
    let onCount = 0;
    for (let i = 0; i < s.length; i++) {
      const ph = (i % period) / period;
      if (ph > 0.52 && ph < 0.98) assert.equal(s[i], 0, `sound in the off half at ${i}`);
      if (ph < 0.5) onCount++;
    }
    assert.ok(Math.abs(onCount / s.length - 0.5) < 0.01);
    assert.ok(s.every((x) => Math.abs(x) <= 1));
    assert.ok(Math.abs(s[0]) < 0.01 && Math.abs(s[s.length - 1]) < 0.01, 'the loop seam is quiet');
  });
}

test('the 10 kHz click train: 40 clicks of 1 ms each, a 4% duty', () => {
  const sr = 48000;
  const s = pulseTrain(sr, { carrier: 10000, onMs: 1, rampMs: 0.1 });
  assert.equal(onsets(s, sr).length, 40);
  let nz = 0;
  for (const x of s) if (x !== 0) nz++;
  assert.ok(Math.abs(nz / sr - 0.04) < 0.003, `${nz / sr}`);
});

test('negative control: a 20 Hz train is not counted as 40', () => {
  const s = pulseTrain(44100, { rate: 20 });
  assert.equal(onsets(s, 44100).length, 20);
});

test('pink noise: bounded, seeded, with less high-frequency energy than white noise', () => {
  const p = pinkNoise(1 << 15, 7);
  assert.deepEqual(p, pinkNoise(1 << 15, 7));
  assert.ok(Math.max(...p.map(Math.abs)) <= 0.9 + 1e-6);
  // a first difference measures high-frequency energy: for white noise its power is twice the signal's
  const ratio = (x) => { let a = 0, d = 0; for (let i = 1; i < x.length; i++) { a += x[i] * x[i]; d += (x[i] - x[i - 1]) ** 2; } return d / a; };
  let w = 1;
  const white = new Float32Array(1 << 15).map(() => { w ^= w << 13; w ^= w >>> 17; w ^= w << 5; return ((w >>> 0) / 4294967296) * 2 - 1; });
  assert.ok(ratio(white) > 1.8, `white ${ratio(white)}`);
  assert.ok(ratio(p) < 0.6, `pink ${ratio(p)}`);
});

test('before the first gesture a gamma sound builds nothing', () => {
  const g = createGammaSound({ mode: 'binaural' });
  assert.equal(getEngine(), null);
  assert.deepEqual(g.layers, []);
  assert.equal(all.length, 0);
  g.dispose();
});

test('binaural: one sine per ear, 200 Hz into the left input, 240 Hz into the right, through the mute, with no reverb or delay send', () => {
  const E = unlockNow();
  const g = createGammaSound({ mode: 'binaural', carrier: '200' });
  assert.deepEqual(g.layers, ['binaural']);
  const oscs = all.filter((n) => n.kind === 'osc' && n.started && !n.stopped);
  assert.equal(oscs.length, 2);
  const merger = all.find((n) => n.kind === 'merger');
  const ear = (o) => o.links[0].to.links.find((l) => l.to === merger).input;
  const byEar = Object.fromEntries(oscs.map((o) => [ear(o), o.frequency.value]));
  assert.deepEqual(byEar, { 0: 200, 1: 240 });
  for (const o of oscs) {
    assert.ok(reaches(o, E.mute), 'the tone passes the page mute');
    assert.ok(!reaches(o, E.reverb.input) && !reaches(o, E.delay.input), 'no send would mix the ears');
  }
  g.setCarrier('400');
  const now = all.filter((n) => n.kind === 'osc' && !n.stopped).map((o) => o.frequency.value).sort((a, b) => a - b);
  assert.deepEqual(now, [400, 440]);
  g.dispose();
});

test('MUTE ALL silences a gamma sound, and the gamma sound cannot unmute the page', () => {
  const E = getEngine();
  const g = createGammaSound({ mode: 'binaural' });
  sound.setMuted(true);
  assert.equal(E.mute.gain.value, 0);
  g.play();
  g.setLevel(1);
  g.setMode('isochronic');
  assert.equal(sound.muted, true, 'nothing a gamma sound does turns the mute off');
  assert.equal(E.mute.gain.value, 0);
  sound.setMuted(false);
  assert.equal(E.mute.gain.value, 1);
  g.dispose();
});

test('modes build their layers: isochronic and clicks loop a one-second buffer, pink adds a stereo bed, silent builds none', () => {
  const g = createGammaSound({ mode: 'isochronic' });
  assert.deepEqual(g.layers, ['iso']);
  const src = all.filter((n) => n.kind === 'src' && !n.stopped).at(-1);
  assert.equal(src.loop, true);
  assert.equal(src.buffer.length, 44100);
  g.setMode('pink-binaural');
  assert.deepEqual(g.layers.sort(), ['binaural', 'pink']);
  const pink = all.filter((n) => n.kind === 'src' && !n.stopped).at(-1);
  assert.equal(pink.buffer.numberOfChannels, 2);
  const before = all.length;
  g.setMode('silent');
  assert.deepEqual(g.layers, []);
  assert.equal(all.filter((n, i) => i >= before && (n.kind === 'osc' || n.kind === 'src')).length, 0);
  g.dispose();
});

test('stop frees the sources, play builds them again, level is clamped and NaN refused, dispose leaves nothing alive', () => {
  const g = createGammaSound({ mode: 'binaural', level: 0.4 });
  const mine = () => all.filter((n) => n.kind === 'osc' && !n.stopped).length;
  assert.equal(mine(), 2);
  g.stop();
  assert.equal(mine(), 0);
  assert.equal(g.playing, false);
  g.play();
  assert.equal(mine(), 2);
  g.setLevel(5);
  assert.equal(g.level, 1);
  g.setLevel(NaN);
  assert.equal(g.level, 1);
  g.setLevel(-1);
  assert.equal(g.level, 0);
  g.dispose();
  assert.equal(mine(), 0);
  assert.equal(activeGammaSounds(), 0);
});
