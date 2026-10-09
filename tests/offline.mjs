// settle-hear · tests/offline.mjs - A SMALL OFFLINE RENDERER: a sample-accurate WebAudio graph in plain JS (no
// dependency), so a test can render a sound to samples and measure it (peak, loudness, spectrum, pitch, duration).
//
// <claudes_code_comments>
// ** Function List **
// OfflineCtx                    - an AudioContext with the node subset below; render(seconds) returns { L, R, sampleRate }
// RParam                        - an AudioParam: set, linear, exponential, setTarget, setValueCurve, plus audio-rate input
// renderSound(fn, opts)         - build fn(ctx, dest, t) on a fresh context, render it, return the stereo samples
// mono(r)                       - the mono mixdown 0.5 * (L + R)
// fft(re, im)                   - an in-place radix-2 complex FFT
// measure(r, opts)              - peak, loudest 50 ms RMS, duration to -60 dB, spectral centroid, share above 10 kHz,
//                                 pitch movement in semitones, a 12-band energy profile and an 8-slice envelope
// featureDistance(a, b)         - one number for how different two measured sounds are
// likenessPrint(r)              - the deck's ruled distinctness fingerprint (16 bands x 12 slices, see below)
// likeness(a, b)                - the cosine of two fingerprints; every pair in one deck stays under 0.95
// dbfs(x)                       - 20 log10 x
//
// ** Technical Review **
// - THE NODE SUBSET (agreed in SETTLE/runs/animesfx/CHANNEL.md): gain, oscillator (sine, square, sawtooth, triangle,
//   with PolyBLEP band-limiting so a square or saw does not alias into the top end; the triangle is naive, its
//   harmonics already fall 12 dB an octave), biquad (the WebAudio spec's cookbook
//   formulas, with lowpass and highpass Q in dB as the spec has it), waveshaper (the spec's curve mapping), buffer
//   source (playbackRate, detune, loop, offset), constant source, delay (its output takes its input's channel count, as Chromium's does; cycles allowed: a delay on a cycle is held to
//   at least one 128-frame block, as the spec does), stereo panner (the spec's equal-power law for mono and stereo
//   input). A sound that calls anything else throws here, which is the point: every sound in the decks must be
//   measurable.
// - The graph is pulled block by block (128 frames, as WebAudio). Each node computes a block once and caches it.
//   Channel counts follow the spec's discrete rule in practice: a source is mono, a mix of mono and stereo upmixes,
//   a panner always outputs stereo. A param's audio input is mixed down to mono and added to its automated value.
// - Filter coefficients are computed per block from the param values at the block's first frame (a k-rate
//   approximation of the a-rate spec; a 2.7 ms step is below anything a test measures).
// - measure() works on the mono mixdown: frames of 2048 with a Hann window and a hop of 512; the centroid and the
//   band profile are energy-weighted over all frames; pitch movement is the change of the energy-weighted centroid
//   between the first and last third of the sound's active span, in semitones, so a falling hit reads negative.
// </claudes_code_comments>

const BLOCK = 128;

export class RParam {
  constructor(v, min = -3.4e38, max = 3.4e38) {
    this._default = v;
    this.minValue = min;
    this.maxValue = max;
    this.events = [];
    this.inputs = [];
  }
  get value() { return this._default; }
  set value(v) { if (Number.isFinite(v)) this._default = v; }
  _push(e) {
    if (!Number.isFinite(e.v) || !Number.isFinite(e.t)) throw new TypeError(`non-finite automation ${e.type} ${e.v} at ${e.t}`);
    let i = this.events.length;
    while (i > 0 && this.events[i - 1].t > e.t) i--;
    this.events.splice(i, 0, e);
    return this;
  }
  setValueAtTime(v, t) { return this._push({ type: 'set', v, t }); }
  linearRampToValueAtTime(v, t) { return this._push({ type: 'lin', v, t }); }
  exponentialRampToValueAtTime(v, t) {
    if (v === 0) throw new RangeError('exponential ramp to 0');
    return this._push({ type: 'exp', v, t });
  }
  setTargetAtTime(v, t, tau) { return this._push({ type: 'target', v, t, tau: Math.max(1e-6, tau) }); }
  setValueCurveAtTime(curve, t, dur) {
    const c = Float32Array.from(curve);
    this._push({ type: 'curve', v: c[c.length - 1], t, dur, curve: c });
    return this._push({ type: 'set', v: c[c.length - 1], t: t + dur });
  }
  cancelScheduledValues(t) { this.events = this.events.filter((e) => e.t < t); return this; }
  cancelAndHoldAtTime(t) { return this.cancelScheduledValues(t); }
  // the automated value at time t, from events [0, n)
  _at(t, n = this.events.length) {
    const ev = this.events;
    let i = -1;
    for (let k = 0; k < n && ev[k].t <= t; k++) i = k;
    let j = i + 1;
    if (j < n && (ev[j].type === 'lin' || ev[j].type === 'exp')) {
      const t0 = i >= 0 ? ev[i].t : 0;
      const v0 = i >= 0 ? this._end(i) : this._default;
      const { t: t1, v: v1 } = ev[j];
      const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 1;
      if (ev[j].type === 'lin') return v0 + (v1 - v0) * f;
      if (v0 === 0 || v0 * v1 < 0) return v0;
      return v0 * Math.pow(v1 / v0, f);
    }
    if (i < 0) return this._default;
    const e = ev[i];
    if (e.type === 'target') {
      const s = e._start ?? (e._start = this._at(e.t, i));
      return e.v + (s - e.v) * Math.exp(-(t - e.t) / e.tau);
    }
    if (e.type === 'curve') {
      const c = e.curve;
      if (t >= e.t + e.dur) return c[c.length - 1];
      const x = ((t - e.t) / e.dur) * (c.length - 1);
      const k = Math.floor(x);
      return c[k] + (c[Math.min(c.length - 1, k + 1)] - c[k]) * (x - k);
    }
    return e.v;
  }
  _end(i) {
    const e = this.events[i];
    if (e.type === 'target') return e._start ?? (e._start = this._at(e.t, i));
    return e.v;
  }
  // one block of values: automation plus the mono mix of anything connected to the param
  block(ctx, b) {
    const out = new Float32Array(BLOCK);
    const t0 = b * BLOCK;
    if (this.events.length === 0) out.fill(this._default);
    else for (let s = 0; s < BLOCK; s++) out[s] = this._at((t0 + s) / ctx.sampleRate);
    for (const n of this.inputs) {
      const r = n.pull(b);
      if (r.data.length === 1) for (let s = 0; s < BLOCK; s++) out[s] += r.data[0][s];
      else for (let s = 0; s < BLOCK; s++) out[s] += 0.5 * (r.data[0][s] + r.data[1][s]);
    }
    for (let s = 0; s < BLOCK; s++) {
      if (!Number.isFinite(out[s])) throw new TypeError(`non-finite param value ${out[s]}`);
      if (out[s] < this.minValue) out[s] = this.minValue; else if (out[s] > this.maxValue) out[s] = this.maxValue;
    }
    return out;
  }
}

const zeros = (ch) => Array.from({ length: ch }, () => new Float32Array(BLOCK));

class RNode {
  constructor(ctx, kind) {
    this.context = ctx;
    this.kind = kind;
    this.inputs = [];
    this._outs = [];
    this._b = -1;
    this._cache = null;
    this.channelCount = 2;
    ctx._nodes.push(this);
  }
  // connecting the same output to the same input twice is one connection, as in WebAudio (a set, not a list)
  connect(to) {
    if (!(to instanceof RParam) && !(to instanceof RNode)) throw new TypeError('connect to a node or a param');
    if (this._outs.includes(to)) return to;
    to.inputs.push(this);
    this._outs.push(to);
    return to;
  }
  disconnect(to) {
    const outs = to ? this._outs.filter((o) => o === to) : this._outs.slice();
    for (const o of outs) { const i = o.inputs.indexOf(this); if (i >= 0) o.inputs.splice(i, 1); }
    this._outs = to ? this._outs.filter((o) => o !== to) : [];
  }
  // the mix of every input, upmixed to the widest
  mixIn(b) {
    if (this.inputs.length === 0) return { data: zeros(1) };
    const rs = this.inputs.map((n) => n.pull(b));
    const ch = Math.max(...rs.map((r) => r.data.length));
    const data = zeros(ch);
    for (const r of rs) for (let c = 0; c < ch; c++) {
      const src = r.data[Math.min(c, r.data.length - 1)];
      const d = data[c];
      for (let s = 0; s < BLOCK; s++) d[s] += src[s];
    }
    return { data };
  }
  pull(b) {
    if (this._b === b) return this._cache;
    this._cache = this.process(b);
    this._b = b;
    return this._cache;
  }
}

class Scheduled extends RNode {
  constructor(ctx, kind) { super(ctx, kind); this._start = Infinity; this._stop = Infinity; this.onended = null; }
  start(t = 0, offset = 0, duration) {
    this._start = Math.max(0, t);
    this._offset = offset;
    if (Number.isFinite(duration)) this._stop = Math.min(this._stop, this._start + duration);
  }
  stop(t = 0) { this._stop = Math.max(0, t); }
  _live(frame) { const t = frame / this.context.sampleRate; return t >= this._start && t < this._stop; }
}

// PolyBLEP: the band-limiting correction at a discontinuity
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

class Osc extends Scheduled {
  constructor(ctx) {
    super(ctx, 'osc');
    this.type = 'sine';
    this.frequency = new RParam(440, -ctx.sampleRate / 2, ctx.sampleRate / 2);
    this.detune = new RParam(0);
    this._ph = 0;
  }
  setPeriodicWave() { throw new Error('PeriodicWave is not in the shared node subset'); }
  process(b) {
    const out = zeros(1); const o = out[0];
    const f = this.frequency.block(this.context, b);
    const dt = this.detune.block(this.context, b);
    const sr = this.context.sampleRate;
    for (let s = 0; s < BLOCK; s++) {
      if (!this._live(b * BLOCK + s)) continue;
      const inc = (f[s] * Math.pow(2, dt[s] / 1200)) / sr;
      const p = this._ph;
      const ai = Math.min(0.5, Math.abs(inc)) || 1e-9;
      let v;
      if (this.type === 'sine') v = Math.sin(2 * Math.PI * p);
      else if (this.type === 'sawtooth') v = 2 * p - 1 - blep(p, ai);
      else if (this.type === 'square') v = (p < 0.5 ? 1 : -1) + blep(p, ai) - blep((p + 0.5) % 1, ai);
      else if (this.type === 'triangle') v = p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
      else throw new Error(`oscillator type ${this.type} is not in the subset`);
      o[s] = v;
      this._ph = p + inc; this._ph -= Math.floor(this._ph);
    }
    return { data: out };
  }
}

class BufSrc extends Scheduled {
  constructor(ctx) {
    super(ctx, 'src');
    this.buffer = null;
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.playbackRate = new RParam(1);
    this.detune = new RParam(0);
    this._pos = null;
  }
  process(b) {
    const buf = this.buffer;
    const ch = buf ? buf.numberOfChannels : 1;
    const out = zeros(ch);
    if (!buf) return { data: out };
    const pr = this.playbackRate.block(this.context, b);
    const dt = this.detune.block(this.context, b);
    const sr = this.context.sampleRate;
    const n = buf.length;
    for (let s = 0; s < BLOCK; s++) {
      if (!this._live(b * BLOCK + s)) continue;
      if (this._pos === null) this._pos = (this._offset || 0) * buf.sampleRate;
      let p = this._pos;
      if (this.loop) {
        const ls = this.loopStart > 0 ? this.loopStart * buf.sampleRate : 0;
        const le = this.loopEnd > 0 ? this.loopEnd * buf.sampleRate : n;
        if (p >= le) p = ls + ((p - ls) % (le - ls));
      } else if (p >= n || p < 0) continue;
      const k = Math.floor(p); const fr = p - k;
      for (let c = 0; c < ch; c++) {
        const d = buf.getChannelData(c);
        out[c][s] = d[k] + ((k + 1 < n ? d[k + 1] : this.loop ? d[0] : 0) - d[k]) * fr;
      }
      this._pos = p + pr[s] * Math.pow(2, dt[s] / 1200) * (buf.sampleRate / sr);
    }
    return { data: out };
  }
}

class Const extends Scheduled {
  constructor(ctx) { super(ctx, 'const'); this.offset = new RParam(1); }
  process(b) {
    const out = zeros(1);
    const v = this.offset.block(this.context, b);
    for (let s = 0; s < BLOCK; s++) if (this._live(b * BLOCK + s)) out[0][s] = v[s];
    return { data: out };
  }
}

class Gain extends RNode {
  constructor(ctx) { super(ctx, 'gain'); this.gain = new RParam(1); }
  process(b) {
    const { data } = this.mixIn(b);
    const g = this.gain.block(this.context, b);
    for (const d of data) for (let s = 0; s < BLOCK; s++) d[s] *= g[s];
    return { data };
  }
}

class Biquad extends RNode {
  constructor(ctx) {
    super(ctx, 'biquad');
    this.type = 'lowpass';
    this.frequency = new RParam(350, 0, ctx.sampleRate / 2);
    this.detune = new RParam(0);
    this.Q = new RParam(1);
    this.gain = new RParam(0);
    this._z = [];
  }
  coeffs(b) {
    const sr = this.context.sampleRate;
    const f0 = Math.min(sr / 2, Math.max(0, this.frequency.block(this.context, b)[0] * Math.pow(2, this.detune.block(this.context, b)[0] / 1200)));
    const Q = this.Q.block(this.context, b)[0];
    const G = this.gain.block(this.context, b)[0];
    const A = Math.pow(10, G / 40);
    const w0 = (2 * Math.PI * f0) / sr;
    const cw = Math.cos(w0); const sw = Math.sin(w0);
    let b0, b1, b2, a0, a1, a2;
    const aQ = (q) => sw / (2 * Math.max(1e-4, q));
    switch (this.type) {
      case 'lowpass': { const al = sw / (2 * Math.pow(10, Q / 20)); b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break; }
      case 'highpass': { const al = sw / (2 * Math.pow(10, Q / 20)); b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break; }
      case 'bandpass': { const al = aQ(Q); b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break; }
      case 'notch': { const al = aQ(Q); b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break; }
      case 'allpass': { const al = aQ(Q); b0 = 1 - al; b1 = -2 * cw; b2 = 1 + al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break; }
      case 'peaking': { const al = aQ(Q); b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; break; }
      case 'lowshelf': { const al = (sw / 2) * Math.sqrt(2); const s2 = 2 * Math.sqrt(A) * al;
        b0 = A * (A + 1 - (A - 1) * cw + s2); b1 = 2 * A * (A - 1 - (A + 1) * cw); b2 = A * (A + 1 - (A - 1) * cw - s2);
        a0 = A + 1 + (A - 1) * cw + s2; a1 = -2 * (A - 1 + (A + 1) * cw); a2 = A + 1 + (A - 1) * cw - s2; break; }
      case 'highshelf': { const al = (sw / 2) * Math.sqrt(2); const s2 = 2 * Math.sqrt(A) * al;
        b0 = A * (A + 1 + (A - 1) * cw + s2); b1 = -2 * A * (A - 1 + (A + 1) * cw); b2 = A * (A + 1 + (A - 1) * cw - s2);
        a0 = A + 1 - (A - 1) * cw + s2; a1 = 2 * (A - 1 - (A + 1) * cw); a2 = A + 1 - (A - 1) * cw - s2; break; }
      default: throw new Error(`biquad type ${this.type} is not in the subset`);
    }
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  process(b) {
    const { data } = this.mixIn(b);
    const [b0, b1, b2, a1, a2] = this.coeffs(b);
    data.forEach((d, c) => {
      const z = this._z[c] ?? (this._z[c] = [0, 0, 0, 0]);
      for (let s = 0; s < BLOCK; s++) {
        const x = d[s];
        const y = b0 * x + b1 * z[0] + b2 * z[1] - a1 * z[2] - a2 * z[3];
        z[1] = z[0]; z[0] = x; z[3] = z[2]; z[2] = Math.abs(y) < 1e-30 ? 0 : y;
        d[s] = z[2];
      }
    });
    return { data };
  }
}

class Shaper extends RNode {
  constructor(ctx) { super(ctx, 'shaper'); this.curve = null; this.oversample = 'none'; }
  process(b) {
    const { data } = this.mixIn(b);
    const c = this.curve;
    if (!c || c.length < 2) return { data };
    const n = c.length;
    for (const d of data) for (let s = 0; s < BLOCK; s++) {
      const v = ((n - 1) / 2) * (d[s] + 1);
      if (v <= 0) d[s] = c[0];
      else if (v >= n - 1) d[s] = c[n - 1];
      else { const k = Math.floor(v); d[s] = c[k] + (c[k + 1] - c[k]) * (v - k); }
    }
    return { data };
  }
}

class Delay extends RNode {
  constructor(ctx, max = 1) {
    super(ctx, 'delay');
    this.delayTime = new RParam(0, 0, max);
    this._len = Math.ceil(max * ctx.sampleRate) + 2 * BLOCK + 2;
    this._ring = [new Float32Array(this._len), new Float32Array(this._len)];
    this._ch = 1; // a delay's output has its input's channel count (Chromium does this): mono in, mono out
    this.inCycle = false; // set by render(): a delay on a cycle reads only its past and is written after the block
    this._wrote = -1;
  }
  _write(b) {
    if (this._wrote === b) return;
    this._wrote = b;
    const { data } = this.mixIn(b);
    if (data.length > this._ch) this._ch = data.length;
    for (let s = 0; s < BLOCK; s++) {
      const w = (b * BLOCK + s) % this._len;
      for (let c = 0; c < 2; c++) this._ring[c][w] = data[Math.min(c, data.length - 1)][s];
    }
  }
  _read(b, minFrames) {
    const sr = this.context.sampleRate;
    const dt = this.delayTime.block(this.context, b);
    const out = zeros(this._ch);
    for (let s = 0; s < BLOCK; s++) {
      const w = b * BLOCK + s;
      const d = Math.max(minFrames, dt[s] * sr);
      const p = w - d;
      if (p < 0) continue;
      const k = Math.floor(p); const fr = p - k;
      for (let c = 0; c < this._ch; c++) {
        const r = this._ring[c];
        out[c][s] = r[k % this._len] + (r[(k + 1) % this._len] - r[k % this._len]) * fr;
      }
    }
    return out;
  }
  // a delay on a cycle is held to at least one block (the spec's rule), so its output for block b depends only on
  // blocks before b: it answers from the ring without pulling its input, and render() writes its input once every
  // node has computed block b. That breaks the cycle without any node computing a block twice. A delay on no
  // cycle pulls its input first and may be shorter than a block.
  pull(b) {
    if (this._b === b) return this._cache;
    if (!this.inCycle) this._write(b);
    this._cache = { data: this._read(b, this.inCycle ? BLOCK : 0) };
    this._b = b;
    return this._cache;
  }
}

class Panner extends RNode {
  constructor(ctx) { super(ctx, 'panner'); this.pan = new RParam(0, -1, 1); }
  process(b) {
    const { data } = this.mixIn(b);
    const p = this.pan.block(this.context, b);
    const out = zeros(2);
    for (let s = 0; s < BLOCK; s++) {
      const pan = Math.max(-1, Math.min(1, p[s]));
      if (data.length === 1) {
        const x = ((pan + 1) / 2) * (Math.PI / 2);
        out[0][s] = data[0][s] * Math.cos(x); out[1][s] = data[0][s] * Math.sin(x);
      } else if (pan <= 0) {
        const x = (pan + 1) * (Math.PI / 2);
        out[0][s] = data[0][s] + data[1][s] * Math.cos(x); out[1][s] = data[1][s] * Math.sin(x);
      } else {
        const x = pan * (Math.PI / 2);
        out[0][s] = data[0][s] * Math.cos(x); out[1][s] = data[1][s] + data[0][s] * Math.sin(x);
      }
    }
    return { data: out };
  }
}

class Dest extends RNode {
  constructor(ctx) { super(ctx, 'destination'); }
  process(b) { return this.mixIn(b); }
}

const refuse = (what) => () => { throw new Error(`${what} is not in the shared node subset (SETTLE/runs/animesfx/CHANNEL.md)`); };

export class OfflineCtx {
  constructor({ sampleRate = 48000 } = {}) {
    this.sampleRate = sampleRate;
    this.currentTime = 0;
    this.state = 'running';
    this._nodes = [];
    this.destination = new Dest(this);
  }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
  createGain() { return new Gain(this); }
  createOscillator() { return new Osc(this); }
  createBiquadFilter() { return new Biquad(this); }
  createWaveShaper() { return new Shaper(this); }
  createBufferSource() { return new BufSrc(this); }
  createConstantSource() { return new Const(this); }
  createDelay(max = 1) { return new Delay(this, max); }
  createStereoPanner() { return new Panner(this); }
  createBuffer(ch, n, rate) {
    const data = Array.from({ length: ch }, () => new Float32Array(n));
    return { numberOfChannels: ch, length: n, sampleRate: rate, duration: n / rate, getChannelData: (c) => data[c] };
  }
  createConvolver = refuse('ConvolverNode');
  createPeriodicWave = refuse('PeriodicWave');
  createScriptProcessor = refuse('ScriptProcessorNode');
  createAnalyser = refuse('AnalyserNode');
  createDynamicsCompressor = refuse('DynamicsCompressorNode');
  // a node feeds the nodes it connects to, and the owner of every param it connects to
  _feeds(n) { return n._outs.map((o) => (o instanceof RParam ? o.owner : o)).filter(Boolean); }
  _onCycle(start) {
    const seen = new Set();
    const q = [...this._feeds(start)];
    while (q.length) {
      const n = q.shift();
      if (n === start) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      q.push(...this._feeds(n));
    }
    return false;
  }
  render(seconds) {
    for (const n of this._nodes) for (const v of Object.values(n)) if (v instanceof RParam) v.owner = n;
    const delays = this._nodes.filter((n) => n instanceof Delay);
    for (const d of delays) d.inCycle = this._onCycle(d);
    const blocks = Math.ceil((seconds * this.sampleRate) / BLOCK);
    const L = new Float32Array(blocks * BLOCK);
    const R = new Float32Array(blocks * BLOCK);
    for (let b = 0; b < blocks; b++) {
      this.currentTime = (b * BLOCK) / this.sampleRate;
      const { data } = this.destination.pull(b);
      L.set(data[0], b * BLOCK);
      R.set(data[Math.min(1, data.length - 1)], b * BLOCK);
      for (const d of delays) if (d.inCycle) d._write(b);
    }
    return { L, R, sampleRate: this.sampleRate };
  }
}

// build fn(ctx, dest, t) on a fresh context and render it; t = 0.01 s so the first frame is silence
export function renderSound(fn, { seconds = 2, sampleRate = 48000, at = 0.01 } = {}) {
  const ctx = new OfflineCtx({ sampleRate });
  const end = fn(ctx, ctx.destination, at);
  const r = ctx.render(seconds);
  r.end = end;
  r.at = at;
  return r;
}

export const mono = (r) => { const m = new Float32Array(r.L.length); for (let i = 0; i < m.length; i++) m[i] = 0.5 * (r.L[i] + r.R[i]); return m; };

export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    const wr = Math.cos(a); const wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1; let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k]; const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

export const BANDS = (() => { const e = []; for (let i = 0; i <= 12; i++) e.push(60 * Math.pow(16000 / 60, i / 12)); return e; })();

export function measure(r, { frame = 2048, hop = 512 } = {}) {
  const x = Array.isArray(r) || r instanceof Float32Array ? r : mono(r);
  const sr = r.sampleRate ?? 48000;
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(r.L ? Math.max(Math.abs(r.L[i]), Math.abs(r.R[i])) : x[i]));
  // the loudest 50 ms RMS
  const w = Math.round(0.05 * sr);
  let acc = 0; let rms50 = 0;
  for (let i = 0; i < x.length; i++) { acc += x[i] * x[i]; if (i >= w) acc -= x[i - w] * x[i - w]; if (i >= w - 1) rms50 = Math.max(rms50, Math.sqrt(Math.max(0, acc) / w)); }
  // active span: first and last frames within 60 dB of the peak (5 ms RMS windows)
  const ws = Math.round(0.005 * sr);
  const floor = peak * 1e-3;
  let first = -1; let last = -1;
  for (let i = 0; i + ws <= x.length; i += ws) {
    let e = 0; for (let k = i; k < i + ws; k++) e += x[k] * x[k];
    if (Math.sqrt(e / ws) > floor) { if (first < 0) first = i; last = i + ws; }
  }
  const startT = first < 0 ? 0 : first / sr;
  const endT = last < 0 ? 0 : last / sr;
  const duration = Math.max(0, endT - startT);
  // spectra
  const win = new Float32Array(frame); for (let i = 0; i < frame; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frame - 1));
  const bandE = new Float64Array(BANDS.length - 1);
  let eTot = 0; let eHigh = 0; let cNum = 0;
  const frames = [];
  for (let i = 0; i + frame <= x.length; i += hop) {
    const re = new Float64Array(frame); const im = new Float64Array(frame);
    for (let k = 0; k < frame; k++) re[k] = x[i + k] * win[k];
    fft(re, im);
    let fe = 0; let fc = 0;
    for (let k = 1; k < frame / 2; k++) {
      const f = (k * sr) / frame;
      const p = re[k] * re[k] + im[k] * im[k];
      fe += p; fc += p * f;
      if (f >= 10000) eHigh += p;
      for (let bi = 0; bi < bandE.length; bi++) if (f >= BANDS[bi] && f < BANDS[bi + 1]) { bandE[bi] += p; break; }
    }
    eTot += fe; cNum += fc;
    frames.push({ t: (i + frame / 2) / sr, e: fe, c: fe > 0 ? fc / fe : 0 });
  }
  const centroid = eTot > 0 ? cNum / eTot : 0;
  const highShare = eTot > 0 ? eHigh / eTot : 0;
  const bandSum = bandE.reduce((a, b) => a + b, 0) || 1;
  const bands = Array.from(bandE, (e) => e / bandSum);
  // pitch movement: the energy-weighted centroid of the first third against the last third of the active span
  const third = duration / 3;
  const cAt = (t0, t1) => { let n = 0; let d = 0; for (const f of frames) if (f.t >= t0 && f.t < t1) { n += f.e * f.c; d += f.e; } return d > 0 ? n / d : 0; };
  const c0 = cAt(startT, startT + third + 1e-3); const c1 = cAt(endT - third - 1e-3, endT + 1e-3);
  const pitchMove = c0 > 0 && c1 > 0 ? 12 * Math.log2(c1 / c0) : 0;
  // envelope: energy in 8 equal slices of the active span, normalised
  const env = new Float64Array(8);
  if (duration > 0) for (let i = first; i < last; i++) { const k = Math.min(7, Math.floor(((i - first) / (last - first)) * 8)); env[k] += x[i] * x[i]; }
  const envSum = env.reduce((a, b) => a + b, 0) || 1;
  return { peak, rms50, startT, endT, duration, centroid, highShare, pitchMove, bands, env: Array.from(env, (e) => e / envSum) };
}

// how different two measured sounds are: duration and centroid on a log scale, pitch movement in octaves, and the
// L1 distances of the band profile and the envelope shape
export function featureDistance(a, b) {
  const ld = Math.abs(Math.log2(Math.max(0.01, a.duration) / Math.max(0.01, b.duration)));
  const lc = Math.abs(Math.log2(Math.max(50, a.centroid) / Math.max(50, b.centroid)));
  const pm = Math.abs(a.pitchMove - b.pitchMove) / 12;
  let bd = 0; for (let i = 0; i < a.bands.length; i++) bd += Math.abs(a.bands[i] - b.bands[i]);
  let ed = 0; for (let i = 0; i < a.env.length; i++) ed += Math.abs(a.env[i] - b.env[i]);
  return ld + lc + pm + bd + ed;
}

// THE LIKENESS FINGERPRINT, the deck's distinctness measure as ruled in the channel (SWORDSWISH, after HYPERRADIAL's
// tools/sfx_levels.py): the active region (|mono| above peak - 50 dB), frames of 1024 with a Hann window and a hop of
// 256, 16 log-spaced bands from 60 Hz to Nyquist (any band holding no FFT bin skipped) x 12 time slices, log10 of the
// mean band energy, mean removed, then
// 8 slots holding 4 x the length in seconds so a long and a short sweep differ. likeness() is the cosine of two.
export function likenessPrint(r) {
  const x0 = mono(r);
  const sr = r.sampleRate;
  let peak = 0;
  for (let i = 0; i < x0.length; i++) peak = Math.max(peak, Math.abs(x0[i]));
  const thr = peak * Math.pow(10, -50 / 20);
  let s0 = -1; let s1 = -1;
  for (let i = 0; i < x0.length; i++) if (Math.abs(x0[i]) > thr) { if (s0 < 0) s0 = i; s1 = i + 1; }
  if (s0 < 0) return new Float64Array(15 * 12 + 8);
  const x = x0.subarray(s0, s1);
  const n = 1024; const hop = 256;
  const win = new Float64Array(n); for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  const edges = []; for (let j = 0; j <= 16; j++) edges.push(60 * Math.pow(sr / 2 / 60, j / 16));
  const bin = new Int16Array(n / 2 + 1).fill(-1);
  for (let k = 0; k <= n / 2; k++) { const f = (k * sr) / n; for (let j = 0; j < 16; j++) if (f >= edges[j] && f < edges[j + 1]) { bin[k] = j; break; } }
  // a band that holds no FFT bin (at 48 kHz, band 0, 60 to 89 Hz, against a 46.9 Hz bin spacing) is skipped: its
  // constant -12 column was shared by every sound and inflated every cosine (found by HYPERRADIAL, ruled by SWORDSWISH)
  const live = Array.from({ length: 16 }, (_, j) => bin.includes(j));
  const frames = [];
  for (let i = 0; i < Math.max(1, x.length - n); i += hop) {
    const re = new Float64Array(n); const im = new Float64Array(n);
    for (let k = 0; k < n; k++) re[k] = (i + k < x.length ? x[i + k] : 0) * win[k];
    fft(re, im);
    const b = new Float64Array(16);
    for (let k = 0; k <= n / 2; k++) if (bin[k] >= 0) b[bin[k]] += re[k] * re[k] + im[k] * im[k];
    frames.push(b);
  }
  const env = [];
  const N = frames.length; const base = Math.floor(N / 12); const extra = N % 12;
  let at = 0;
  for (let s = 0; s < 12; s++) {
    const len = base + (s < extra ? 1 : 0);
    for (let j = 0; j < 16; j++) {
      if (!live[j]) continue;
      if (len === 0) { env.push(-12); continue; }
      let m = 0; for (let q = at; q < at + len; q++) m += frames[q][j];
      env.push(Math.log10(m / len + 1e-12));
    }
    at += len;
  }
  const mean = env.reduce((a, b) => a + b, 0) / env.length;
  const out = env.map((v) => v - mean);
  for (let i = 0; i < 8; i++) out.push(((s1 - s0) / sr) * 4);
  return Float64Array.from(out);
}

export function likeness(a, b) {
  let ab = 0; let aa = 0; let bb = 0;
  for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return ab / (Math.sqrt(aa * bb) + 1e-12);
}

export const dbfs = (x) => (x > 0 ? 20 * Math.log10(x) : -999);
