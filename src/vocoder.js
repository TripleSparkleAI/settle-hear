// settle-hear · vocoder - a channel vocoder and a ring modulator, both from native Web Audio nodes, both subtle by
// default and switchable (depth 0 is a straight wire).
//
// <claudes_code_comments>
// ** Function List **
// VOCODER                    - the vocoder's fixed numbers: band count, the band edges (Hz), Q, the follower's
//                              cutoff (Hz), the follower's makeup gain, the output gain
// vocoderBands(n, lo, hi)    - n band centres spaced evenly in log frequency from lo to hi
// absCurve(n)                - the rectifier's WaveShaper curve, |x|
// createVocoder(ctx, opts)   - { modulator, carrier, output, bands: [{ hz, mod, follow, gain, car }], setDepth(v),
//                              dispose() }: the modulator's band envelopes open the carrier's bands
// createRingMod(ctx, opts)   - { input, output, osc, lfo, setRate(hz), setDepth(v), dispose() }: input x a sine,
//                              mixed in at a depth that breathes slowly
//
// ** Technical Review **
// - THE VOCODER: for each band k, modulator -> bandpass(hz_k, Q) -> |x| (a WaveShaper) -> lowpass(followHz) is the
//   envelope follower; its output feeds the GAIN PARAMETER of a GainNode whose base value is 0 and whose signal
//   input is carrier -> bandpass(hz_k, Q). So silence into the modulator leaves every band gain at 0 and the output
//   silent, whatever the carrier does; the carrier is heard only where the modulator has energy, band by band. The
//   follower's makeup (VOCODER.makeup) scales the envelope into a 0..1 gain and a tanh curve caps it below 1.
// - THE RING MODULATOR: output = (1 - depth) x input + depth x input x sin(2 pi rate t). The product is a GainNode
//   whose gain is driven by the oscillator (base 0, so with the oscillator silent nothing passes). A second, very
//   slow sine (breath) sweeps the wet gain between 0 and depth, so the shimmer swells and fades instead of sitting
//   still. With depth 0 the wet path is silent and the dry path is unity: a wire.
// - Nothing here runs per sample; every node is native. Both are inserts: they live inside a channel or a pass chain
//   and never reach the speakers except through the page master, its mute and its limiter.
// </claudes_code_comments>

export const VOCODER = {
  bands: 12,
  lo: 140,
  hi: 5600,
  q: 6,
  followHz: 24,
  makeup: 6,
  out: 0.9,
};

export function vocoderBands(n = VOCODER.bands, lo = VOCODER.lo, hi = VOCODER.hi) {
  const k = Math.max(1, Math.round(n));
  const a = Math.max(1, lo);
  const b = Math.max(a * 1.01, hi);
  if (k === 1) return [Math.sqrt(a * b)];
  return Array.from({ length: k }, (_, i) => a * Math.pow(b / a, i / (k - 1)));
}

export function absCurve(n = 512) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = Math.abs((2 * i) / (n - 1) - 1);
  return c;
}

function tanhCapCurve(n = 512) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (2 * i) / (n - 1) - 1; c[i] = Math.tanh(x); }
  return c;
}

export function createVocoder(ctx, { bands = VOCODER.bands, lo = VOCODER.lo, hi = VOCODER.hi, q = VOCODER.q, followHz = VOCODER.followHz, makeup = VOCODER.makeup, depth = 1 } = {}) {
  const modulator = ctx.createGain();
  const carrier = ctx.createGain();
  const output = ctx.createGain();
  output.gain.value = VOCODER.out * Math.min(1, Math.max(0, depth));
  const nodes = [modulator, carrier, output];
  const rect = absCurve();
  const cap = tanhCapCurve();
  const list = vocoderBands(bands, lo, hi).map((hz) => {
    const mod = ctx.createBiquadFilter();
    mod.type = 'bandpass';
    mod.frequency.value = hz;
    mod.Q.value = q;
    const rectifier = ctx.createWaveShaper();
    rectifier.curve = rect;
    const follow = ctx.createBiquadFilter();
    follow.type = 'lowpass';
    follow.frequency.value = followHz;
    follow.Q.value = 0.5;
    const mk = ctx.createGain();
    mk.gain.value = makeup;
    const capper = ctx.createWaveShaper();
    capper.curve = cap;
    const car = ctx.createBiquadFilter();
    car.type = 'bandpass';
    car.frequency.value = hz;
    car.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0; // the envelope is the whole gain: silence in, silence out
    modulator.connect(mod);
    mod.connect(rectifier);
    rectifier.connect(follow);
    follow.connect(mk);
    mk.connect(capper);
    capper.connect(gain.gain);
    carrier.connect(car);
    car.connect(gain);
    gain.connect(output);
    nodes.push(mod, rectifier, follow, mk, capper, car, gain);
    return { hz, mod, follow, gain, car };
  });
  return {
    modulator,
    carrier,
    output,
    bands: list,
    setDepth(v) { const d = Math.min(1, Math.max(0, Number.isFinite(+v) ? +v : 0)); try { output.gain.setTargetAtTime(VOCODER.out * d, ctx.currentTime, 0.1); } catch { output.gain.value = VOCODER.out * d; } },
    dispose() { for (const n of nodes) try { n.disconnect(); } catch { /* gone */ } },
  };
}

export function createRingMod(ctx, { rate = 432, depth = 0.25, breath = 0.07, start = ctx.currentTime } = {}) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const d = Math.min(1, Math.max(0, Number.isFinite(+depth) ? +depth : 0));
  const dry = ctx.createGain();
  dry.gain.value = 1 - d;
  const product = ctx.createGain();
  product.gain.value = 0; // driven by the oscillator alone
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = Math.max(0.01, rate);
  osc.connect(product.gain);
  const wet = ctx.createGain();
  wet.gain.value = d / 2;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = Math.max(0.001, breath);
  const lfoAmt = ctx.createGain();
  lfoAmt.gain.value = d / 2;
  lfo.connect(lfoAmt);
  lfoAmt.connect(wet.gain);
  input.connect(dry);
  dry.connect(output);
  input.connect(product);
  product.connect(wet);
  wet.connect(output);
  osc.start(start);
  lfo.start(start);
  const nodes = [input, output, dry, product, osc, wet, lfo, lfoAmt];
  let cur = d;
  const setDepth = (v) => {
    cur = Math.min(1, Math.max(0, Number.isFinite(+v) ? +v : 0));
    const t = ctx.currentTime;
    const put = (p, x) => { try { p.setTargetAtTime(x, t, 0.1); } catch { p.value = x; } };
    put(dry.gain, 1 - cur);
    put(wet.gain, cur / 2);
    put(lfoAmt.gain, cur / 2);
  };
  return {
    input,
    output,
    osc,
    lfo,
    get depth() { return cur; },
    setRate(hz) { const f = Math.max(0.01, Number.isFinite(+hz) ? +hz : rate); try { osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.2); } catch { osc.frequency.value = f; } },
    setDepth,
    dispose() {
      for (const o of [osc, lfo]) try { o.stop(); } catch { /* already stopped */ }
      for (const n of nodes) try { n.disconnect(); } catch { /* gone */ }
    },
  };
}
