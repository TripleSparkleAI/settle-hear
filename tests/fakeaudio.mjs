// A fake AudioContext for the house and spectrum tests: every node records what it connects to, every parameter
// records each value written (and refuses a non-finite one), oscillators and sources record start and stop.
export const writes = [];
export class Param {
  constructor(v, min = -3.4e38, max = 3.4e38) { this.value = v; this.minValue = min; this.maxValue = max; this.events = []; this.kind = 'param'; }
  rec(type, v, t) { writes.push(v); this.events.push([type, v, t]); if (!Number.isFinite(v)) throw new TypeError(`non-finite ${v}`); }
  setValueAtTime(v, t) { this.rec('set', v, t); this.value = v; }
  setTargetAtTime(v, t, tau) { this.rec('target', v, t); this.events[this.events.length - 1].push(tau); this.value = v; }
  linearRampToValueAtTime(v, t) { this.rec('lin', v, t); this.value = v; }
  exponentialRampToValueAtTime(v, t) { this.rec('exp', v, t); if (v <= 0) throw new RangeError('exp ramp to 0'); this.value = v; }
  cancelScheduledValues() {}
}
export const all = [];
export class Node {
  constructor(kind, params = {}) { this.kind = kind; this.out = new Set(); this.started = false; this.stopped = false; Object.assign(this, params); all.push(this); }
  connect(n) { this.out.add(n); return n; }
  disconnect(n) { if (n) this.out.delete(n); else this.out.clear(); }
}
export class Ctx {
  constructor() { this.currentTime = 0; this.sampleRate = 48000; this.state = 'suspended'; this.destination = new Node('destination'); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  createGain() { return new Node('gain', { gain: new Param(1) }); }
  createBiquadFilter() { return new Node('biquad', { type: 'lowpass', frequency: new Param(350, 0, 24000), Q: new Param(1), gain: new Param(0) }); }
  createDynamicsCompressor() {
    return new Node('compressor', { threshold: new Param(-24), knee: new Param(30), ratio: new Param(12), attack: new Param(0.003), release: new Param(0.25) });
  }
  createConvolver() { return new Node('convolver', { buffer: null }); }
  createDelay(max = 1) { return new Node('delay', { delayTime: new Param(0, 0, max) }); }
  createStereoPanner() { return new Node('panner', { pan: new Param(0, -1, 1) }); }
  createWaveShaper() { return new Node('shaper', { curve: null, oversample: 'none' }); }
  createChannelMerger() { return new Node('merger'); }
  createChannelSplitter() { return new Node('splitter'); }
  createAnalyser() { return new Node('analyser', { fftSize: 2048, frequencyBinCount: 1024, smoothingTimeConstant: 0.8, minDecibels: -100, maxDecibels: -30, getByteFrequencyData(a) { a.fill(0); }, getByteTimeDomainData(a) { a.fill(128); } }); }
  createPeriodicWave() { return {}; }
  createOscillator() {
    const n = new Node('osc', { type: 'sine', frequency: new Param(440, 0, 24000), detune: new Param(0), onended: null });
    n.connect = function (to, out = 0, input = 0) { this.out.add(to); this.links = this.links ?? []; this.links.push({ to, out, input }); return to; };
    n.start = () => { n.started = true; };
    n.stop = () => { n.stopped = true; };
    n.setPeriodicWave = () => {};
    return n;
  }
  createBufferSource() {
    const n = new Node('src', { buffer: null, loop: false, playbackRate: new Param(1) });
    n.start = () => { n.started = true; };
    n.stop = () => { n.stopped = true; };
    return n;
  }
  createBuffer(ch, n, rate) {
    const data = Array.from({ length: ch }, () => new Float32Array(n));
    return { numberOfChannels: ch, length: n, sampleRate: rate, getChannelData: (c) => data[c] };
  }
}

// every node reachable from `from` along connections to nodes (parameters are not followed)
export function reach(from) {
  const seen = new Set([from]);
  const q = [from];
  while (q.length) for (const n of q.shift().out) if (n instanceof Node && !seen.has(n)) { seen.add(n); q.push(n); }
  return seen;
}
