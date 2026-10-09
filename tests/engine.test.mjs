// The audio graph, against a fake AudioContext: the limiter sits on the output, no NaN ever reaches an
// AudioParam, mute takes the output to zero, and a hearing driven through a cooling settle builds and frees cleanly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { configure, unlockNow, getEngine, createHearing, sound, ALL, activeHearings, setMaster, STALE_MS } from '../src/index.js';

const writes = [];
class Param {
  constructor(v, min = -3.4e38, max = 3.4e38) { this.value = v; this.minValue = min; this.maxValue = max; }
  rec(v) { writes.push(v); if (!Number.isFinite(v)) throw new TypeError(`non-finite ${v}`); }
  setValueAtTime(v) { this.rec(v); this.value = v; }
  setTargetAtTime(v) { this.rec(v); this.value = v; }
  linearRampToValueAtTime(v) { this.rec(v); this.value = v; }
  exponentialRampToValueAtTime(v) { this.rec(v); if (v <= 0) throw new RangeError('exp ramp to 0'); this.value = v; }
  cancelScheduledValues() {}
}
let nodes = 0;
class Node {
  constructor(kind, params = {}) { nodes++; this.kind = kind; this.out = new Set(); Object.assign(this, params); }
  connect(n) { this.out.add(n); return n; }
  disconnect() { this.out.clear(); }
}
class Ctx {
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'suspended'; this.destination = new Node('destination'); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  createGain() { return new Node('gain', { gain: new Param(1) }); }
  createBiquadFilter() { return new Node('biquad', { type: 'lowpass', frequency: new Param(350, 0, 24000), Q: new Param(1) }); }
  createDynamicsCompressor() {
    return new Node('compressor', { threshold: new Param(-24), knee: new Param(30), ratio: new Param(12), attack: new Param(0.003), release: new Param(0.25) });
  }
  createConvolver() { return new Node('convolver', { buffer: null }); }
  createDelay() { return new Node('delay', { delayTime: new Param(0) }); }
  createStereoPanner() { return new Node('panner', { pan: new Param(0, -1, 1) }); }
  createOscillator() {
    return new Node('osc', { type: 'sine', frequency: new Param(440, 0, 24000), detune: new Param(0), start() {}, stop() {}, onended: null });
  }
  createBufferSource() { return new Node('src', { buffer: null, loop: false, playbackRate: new Param(1), start() {}, stop() {} }); }
  createBuffer(ch, n, rate) {
    const data = Array.from({ length: ch }, () => new Float32Array(n));
    return { numberOfChannels: ch, length: n, sampleRate: rate, getChannelData: (c) => data[c] };
  }
}

let ctx = null;
configure({ createContext: () => (ctx = new Ctx()) });

const cooling = (k, N = 60) => {
  const u = k / N;
  return { T: 3 * Math.pow(0.45 / 3, u), flips: Math.round(200 * (1 - u)), n: 400, ePer: -1.5 * u, q: 0.3 + 0.68 * u, phase: u < 1 ? 'cooling' : 'settled', index: 0, power: k === 20 ? 3 : 0, maxPower: 8, sweeps: k };
};

test('before the first gesture there is no AudioContext at all', () => {
  const h = createHearing({ preset: 'hero' });
  assert.equal(getEngine(), null);
  h.update(cooling(1)); // keeps params, makes no sound
  h.dispose();
  assert.equal(ctx, null);
});

test('the output chain ends in a limiter and a safety gain below 1', () => {
  const E = unlockNow();
  assert.ok(E && ctx);
  assert.equal(E.limit.kind, 'compressor');
  assert.ok(E.limit.ratio.value >= 12 && E.limit.threshold.value <= -6, 'a hard limiter');
  assert.ok(E.mute.out.has(E.limit) && [...E.limit.out][0].gain.value <= 1);
  setMaster(5);
  assert.ok(E.master.gain.value <= 1, 'the master is clamped to 1');
  setMaster(0.8);
});

test('every preset, driven through a whole cooling run, writes only finite values', () => {
  for (const name of Object.keys(ALL)) {
    writes.length = 0;
    const h = createHearing({ preset: name });
    for (let k = 0; k <= 60; k++) { h.update(cooling(k)); h.poke(0.5); h._tick(k * 0.1, k * 0.1 + 0.12); }
    h.click(8, 8);
    assert.ok(writes.length > 0, `${name} wrote parameters`);
    assert.ok(writes.every(Number.isFinite), `${name}: a non-finite parameter`);
    h.dispose();
  }
  assert.equal(activeHearings(), 0);
});

test('garbage stats never reach an AudioParam as NaN', () => {
  writes.length = 0;
  const h = createHearing({ preset: 'hero' });
  for (const s of [{}, { T: NaN, flips: Infinity, n: 0, ePer: NaN, q: NaN, power: NaN }, { T: -1 }]) h.update(s);
  assert.ok(writes.every(Number.isFinite));
  h.dispose();
});

test('mute takes the output gain to zero; unmute brings it back; stop silences one hearing only', () => {
  const E = getEngine();
  sound.setMuted(true);
  assert.equal(E.mute.gain.value, 0);
  sound.setMuted(false);
  assert.equal(E.mute.gain.value, 1);
  const a = createHearing({ preset: 'drone' });
  const b = createHearing({ preset: 'choir' });
  a.stop();
  assert.equal(a.playing, false);
  assert.equal(b.playing, true);
  a.dispose();
  b.dispose();
});

test('negative control: a stopped hearing schedules no grains', () => {
  const h = createHearing({ preset: 'geiger' });
  h.update(cooling(0));
  h.stop();
  const before = nodes;
  h._tick(0, 5);
  assert.equal(nodes, before, 'stopped: nothing built');
  h.play();
  h._tick(0, 5);
  assert.ok(nodes > before, 'playing: the crackle builds grains');
  h.dispose();
});

test('a hearing whose stats stop falls quiet, and the next stats frame brings it back', () => {
  const h = createHearing({ preset: 'geiger' });
  h.update(cooling(0));
  h._check(Date.now() + STALE_MS + 100); // the picture stopped (paused, off screen, drawn still)
  const before = nodes;
  h._tick(0, 5);
  assert.equal(nodes, before, 'quiet: no grains while the picture is still');
  assert.equal(h.playing, true, 'quiet is not the same as stopped: the reader did not press stop');
  h.update(cooling(1));
  h._tick(0, 5);
  assert.ok(nodes > before, 'moving again: grains again');
  h.dispose();
});

test('a stopped hearing builds its channel only: no oscillators run until it is played', () => {
  const before = nodes;
  const h = createHearing({ preset: 'hero', playing: false });
  h.update(cooling(5));
  assert.equal(nodes - before, 9, 'input, THE DUCK\'s gain (lane DJSILENCE), filter, fader, two sends, and the three radial pulse nodes (the swell, the shelf, the pan)');
  h.play();
  assert.ok(nodes - before > 20, 'played: every voice of the hero is built');
  h.dispose();
});
