// THE SPECTRUM SETTLE (lane HOUSEDJ): a known tone lands in its own bar (a real DFT, the analyser's own byte mapping),
// silence gives an empty target in every style, the Winamp motion rises at once and falls slowly, the bass level
// hears the low end, and the live source reads once a frame and never invents a spectrum.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECTRUM, SPECTRUM_STYLES, bandEdges, barOf, byteOfDb, barLevels, createBars, isSilent, bassLevel, spectrumBits,
  createSpectrumSource, spectrumTarget,
} from '../src/index.js';

const SR = 48000;
const N = SPECTRUM.fftSize;
// the AnalyserNode's computation: a Blackman window, |X_k| / N, in dB, mapped onto bytes
function analyse(signal) {
  const a0 = 0.42;
  const a1 = 0.5;
  const a2 = 0.08;
  const x = signal.map((v, n) => v * (a0 - a1 * Math.cos((2 * Math.PI * n) / N) + a2 * Math.cos((4 * Math.PI * n) / N)));
  const bytes = new Uint8Array(N / 2);
  for (let k = 0; k < N / 2; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) { const ph = (2 * Math.PI * k * n) / N; re += x[n] * Math.cos(ph); im -= x[n] * Math.sin(ph); }
    const mag = Math.hypot(re, im) / N;
    bytes[k] = byteOfDb(mag > 0 ? 20 * Math.log10(mag) : -Infinity);
  }
  return bytes;
}
const tone = (f, amp = 0.5) => Array.from({ length: N }, (_, n) => amp * Math.sin((2 * Math.PI * f * n) / SR));
const argmax = (a) => a.reduce((b, v, i) => (v > a[b] ? i : b), 0);

test('the bars: 32 log-spaced bands from 30 Hz, strictly increasing, every bar its own bins', () => {
  const e = bandEdges(SR);
  assert.equal(e.length, SPECTRUM.bars + 1);
  for (let i = 1; i < e.length; i++) assert.ok(e[i] > e[i - 1], `edge ${i}`);
  assert.ok(e[0] >= 1 && e[e.length - 1] <= N / 2);
  assert.equal(barOf(10, e, SR), -1, 'below the range');
  assert.ok(barOf(1000, e, SR) > barOf(432, e, SR) && barOf(432, e, SR) > barOf(110, e, SR));
});

test('positive control: a known tone puts its tallest bar where its frequency lives, at 110, 432, 1000, 3000 and 8000 Hz', () => {
  const e = bandEdges(SR);
  for (const f of [110, 432, 1000, 3000, 8000]) {
    const levels = barLevels(analyse(tone(f)), e);
    assert.equal(argmax(levels), barOf(f, e, SR), `${f} Hz`);
    assert.ok(levels[argmax(levels)] > 0.5, `${f} Hz is loud: ${levels[argmax(levels)]}`);
    const far = [...levels].filter((_, i) => Math.abs(i - barOf(f, e, SR)) > 3);
    assert.ok(Math.max(...far) < levels[argmax(levels)] - 0.3, `${f} Hz stays in its own bars`);
  }
});

test('the target: a tone lights its own bar column from the bottom; silence lights nothing, in every style', () => {
  const e = bandEdges(SR);
  const levels = barLevels(analyse(tone(432)), e);
  const W = 128;
  const H = 40;
  const bits = spectrumBits({ levels }, W, H, 'bars');
  const bw = Math.floor(W / 32);
  const col = (i) => { let n = 0; for (let x = i * bw; x < (i + 1) * bw; x++) for (let y = 0; y < H; y++) n += bits[y * W + x] > 0; return n; };
  const k = barOf(432, e, SR);
  const counts = Array.from({ length: 32 }, (_, i) => col(i));
  assert.equal(argmax(counts), k, 'the tallest column is the tone\'s bar');
  assert.equal(bits[(H - 1) * W + k * bw], 1, 'it stands on the bottom row');
  const silent = new Float32Array(32);
  for (const style of SPECTRUM_STYLES) {
    const b = spectrumBits({ levels: silent, wave: new Float32Array(64) }, W, H, style);
    assert.equal(b.filter((v) => v > 0).length, 0, `${style}: silence is an empty target`);
    assert.equal(b.length, W * H);
  }
  // positive control for every style: the same tone lights something
  for (const style of SPECTRUM_STYLES) {
    const wave = Float32Array.from({ length: 256 }, (_, i) => 0.6 * Math.sin(i / 6));
    assert.ok(spectrumBits({ levels, wave }, W, H, style).some((v) => v > 0), `${style} lights a tone`);
  }
  assert.ok(isSilent(silent) && !isSilent(levels));
});

test('the Winamp motion: a bar rises at once, falls at most `fall` a step; its peak holds, then falls', () => {
  const b = createBars(2);
  b.step([0.9, 0.2]);
  assert.ok(Math.abs(b.levels[0] - 0.9) < 1e-6);
  b.step([0, 0]);
  assert.ok(Math.abs(b.levels[0] - (0.9 - SPECTRUM.fall)) < 1e-6, 'a slow fall');
  for (let k = 0; k < SPECTRUM.peakHold - 1; k++) b.step([0, 0]);
  assert.ok(Math.abs(b.peaks[0] - 0.9) < 1e-6, 'the peak holds');
  for (let k = 0; k < 10; k++) b.step([0, 0]);
  assert.ok(b.peaks[0] < 0.9 && b.peaks[0] >= b.levels[0]);
  b.step([NaN, 2]);
  assert.ok(b.levels[1] === 1 && Number.isFinite(b.levels[0]), 'garbage is clamped');
});

test('the bass level hears a kick-low tone and not a high one', () => {
  const e = bandEdges(SR);
  const low = bassLevel(barLevels(analyse(tone(55)), e), e, SR);
  const high = bassLevel(barLevels(analyse(tone(3000)), e), e, SR);
  assert.ok(low > 0.3, `low ${low}`);
  assert.ok(high < 0.05, `high ${high}`);
});

test('the live source: no analyser gives an empty target; it reads the analyser once per frame, not once per caller', () => {
  let t = 0;
  const none = createSpectrumSource({ analyser: () => null, now: () => t });
  assert.equal(none.target(16, 8).filter((v) => v > 0).length, 0);
  let reads = 0;
  const bytes = analyse(tone(432));
  const an = { fftSize: N, frequencyBinCount: N / 2, context: { sampleRate: SR }, getByteFrequencyData(a) { reads++; a.set(bytes); }, getByteTimeDomainData(a) { a.fill(128); } };
  const src = createSpectrumSource({ analyser: an, now: () => t });
  const live = spectrumTarget('mirror', src);
  const a = live(64, 32);
  src.bass();
  src.view();
  assert.equal(reads, 1, 'three callers in one frame, one read');
  t = 20;
  live(64, 32);
  assert.equal(reads, 2);
  assert.ok(a.some((v) => v > 0));
});
