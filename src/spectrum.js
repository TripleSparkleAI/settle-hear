// settle-hear · spectrum - THE SPECTRUM SETTLE, the pure half: an analyser's frequency bins turned into Winamp-style
// bars, and the bars turned into a settle target (+1 lit, -1 dark) a settle-see field can settle toward.
//
// <claudes_code_comments>
// ** Function List **
// SPECTRUM                   - the fixed numbers: 32 bars, 30 Hz to 16 kHz, fftSize 2048, the dB window, the falloff
// SPECTRUM_STYLES            - 'bars', 'mirror', 'ring', 'scope'
// bandEdges(sampleRate, opts) - the bars' edges in FFT bins: log spaced, strictly increasing, every bar at least one bin
// barOf(freq, edges, sampleRate, fftSize) - which bar a frequency lands in (-1 outside the range)
// byteOfDb(db, minDb, maxDb) - the AnalyserNode's own byte mapping, for tests and offline use
// barLevels(bytes, edges, out) - each bar's level, 0..1: the loudest bin in its band over 255
// createBars(n, opts)        - the Winamp motion: a bar rises at once and falls at most `fall` a step; a peak cap
//                              holds `peakHold` steps, then falls by `peakFall` a step
// isSilent(levels, floor)    - true when no bar reaches the floor
// bassLevel(levels, edges, sampleRate, fftSize, hz) - the mean level of the bars below hz (150 Hz): the kick and sub
// spectrumBits(view, w, h, style) - { levels, peaks, wave } -> an Int8Array of w x h; silence gives every light dark
//
// ** Technical Review **
// - THE BARS: the band from 30 Hz to 16 kHz cut into 32 bars of equal width in log frequency (about a third of an
//   octave each), as a graphic equaliser or Winamp's visualiser does. At 48 kHz and fftSize 2048 a bin is 23.4 Hz,
//   so the lowest bars would share a bin; bandEdges pushes each edge at least one bin past the last, so every bar owns
//   its own bins and the low bars are a little wider than a third of an octave.
// - A bar's level is its loudest bin in bytes (the analyser maps minDecibels..maxDecibels, -90..-20 dB here, onto
//   0..255) over 255. A loud bar is a tall bar; a bar under the floor (0.04) is empty.
// - THE TARGET (spectrumBits): 'bars' stand on the bottom row with a one-light gap between them and a two-row peak
//   cap; 'mirror' grows each bar up and down from the middle row; 'ring' turns the bars into rays around a circle,
//   the low bars at the top, mirrored left and right; 'scope' draws the wave itself, a line three lights thick. Every
//   style lights nothing when the levels are silent: silence is an empty target, never a stale picture.
// - Pure: no Web Audio here. spectrumlive.js reads the page's analyser into these functions.
// </claudes_code_comments>

export const SPECTRUM = {
  bars: 32,
  lo: 30,
  hi: 16000,
  fftSize: 2048,
  minDb: -90,
  maxDb: -20,
  smoothing: 0.55,
  floor: 0.04,
  fall: 0.05,
  peakHold: 6,
  peakFall: 0.015,
  bassHz: 150,
};

export const SPECTRUM_STYLES = ['bars', 'mirror', 'ring', 'scope'];

export function bandEdges(sampleRate = 48000, { bars = SPECTRUM.bars, lo = SPECTRUM.lo, hi = SPECTRUM.hi, fftSize = SPECTRUM.fftSize } = {}) {
  const nBins = fftSize / 2;
  const binHz = sampleRate / fftSize;
  const top = Math.min(hi, sampleRate / 2);
  const e = new Int32Array(bars + 1);
  for (let k = 0; k <= bars; k++) {
    const f = lo * Math.pow(top / lo, k / bars);
    e[k] = Math.round(f / binHz);
  }
  e[0] = Math.max(1, e[0]);
  for (let k = 1; k <= bars; k++) e[k] = Math.max(e[k], e[k - 1] + 1);
  for (let k = bars; k >= 0; k--) e[k] = Math.min(e[k], nBins - (bars - k));
  return e;
}

export function barOf(freq, edges, sampleRate = 48000, fftSize = SPECTRUM.fftSize) {
  const bin = Math.round(freq / (sampleRate / fftSize));
  for (let i = 0; i < edges.length - 1; i++) if (bin >= edges[i] && bin < edges[i + 1]) return i;
  return -1;
}

export function byteOfDb(db, minDb = SPECTRUM.minDb, maxDb = SPECTRUM.maxDb) {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(255, Math.floor((255 / (maxDb - minDb)) * (db - minDb))));
}

export function barLevels(bytes, edges, out = new Float32Array(edges.length - 1)) {
  for (let i = 0; i < out.length; i++) {
    let m = 0;
    for (let b = edges[i]; b < edges[i + 1] && b < bytes.length; b++) if (bytes[b] > m) m = bytes[b];
    out[i] = m / 255;
  }
  return out;
}

export function createBars(n = SPECTRUM.bars, { fall = SPECTRUM.fall, peakHold = SPECTRUM.peakHold, peakFall = SPECTRUM.peakFall } = {}) {
  const levels = new Float32Array(n);
  const peaks = new Float32Array(n);
  const hold = new Int32Array(n);
  return {
    levels,
    peaks,
    step(next) {
      for (let i = 0; i < n; i++) {
        const v = Number.isFinite(next[i]) ? Math.min(1, Math.max(0, next[i])) : 0;
        levels[i] = v >= levels[i] ? v : Math.max(v, levels[i] - fall);
        if (levels[i] >= peaks[i]) { peaks[i] = levels[i]; hold[i] = peakHold; }
        else if (hold[i] > 0) hold[i] -= 1;
        else peaks[i] = Math.max(levels[i], peaks[i] - peakFall);
      }
      return { levels, peaks };
    },
    reset() { levels.fill(0); peaks.fill(0); hold.fill(0); },
  };
}

export function isSilent(levels, floor = SPECTRUM.floor) {
  if (!levels) return true;
  for (let i = 0; i < levels.length; i++) if (levels[i] >= floor) return false;
  return true;
}

export function bassLevel(levels, edges, sampleRate = 48000, fftSize = SPECTRUM.fftSize, hz = SPECTRUM.bassHz) {
  const binHz = sampleRate / fftSize;
  let s = 0;
  let k = 0;
  for (let i = 0; i < levels.length; i++) {
    if (edges[i] * binHz >= hz && k > 0) break;
    s += levels[i];
    k++;
  }
  return k ? s / k : 0;
}

export function spectrumBits({ levels, peaks = null, wave = null } = {}, w, h, style = 'bars') {
  const out = new Int8Array(w * h).fill(-1);
  if (!(w > 0 && h > 0) || isSilent(levels)) return out;
  const n = levels.length;
  const on = (x, y) => { if (x >= 0 && x < w && y >= 0 && y < h) out[y * w + x] = 1; };
  if (style === 'ring') {
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    const R = 0.48 * Math.min(w, h);
    const r0 = 0.22 * Math.min(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d < r0 - 1 || d > R) continue;
        // the angle from the top, folded left onto right: 0 at the top, 1 at the bottom
        const a = Math.acos(Math.max(-1, Math.min(1, -dy / (d || 1)))) / Math.PI;
        const i = Math.min(n - 1, Math.floor(a * n));
        if (d <= r0 || d <= r0 + levels[i] * (R - r0)) on(x, y);
      }
    }
    return out;
  }
  if (style === 'scope') {
    if (!wave || !wave.length) return out;
    const mid = (h - 1) / 2;
    let py = null;
    for (let x = 0; x < w; x++) {
      const v = wave[Math.min(wave.length - 1, Math.floor((x / w) * wave.length))];
      const y = Math.round(mid - Math.max(-1, Math.min(1, v)) * mid * 0.9);
      const a = py == null ? y : Math.min(py, y);
      const b = py == null ? y : Math.max(py, y);
      for (let yy = a - 1; yy <= b + 1; yy++) on(x, yy);
      py = y;
    }
    return out;
  }
  const bw = Math.max(1, Math.floor(w / n));
  const gap = bw > 2 ? 1 : 0;
  const x0 = Math.floor((w - bw * n) / 2);
  const mirror = style === 'mirror';
  const span = mirror ? Math.floor(h / 2) : h;
  for (let i = 0; i < n; i++) {
    const hgt = Math.round(levels[i] * span * 0.94);
    const pk = peaks ? Math.round(peaks[i] * span * 0.94) : 0;
    for (let x = x0 + i * bw; x < x0 + (i + 1) * bw - gap; x++) {
      for (let k = 0; k < hgt; k++) {
        if (mirror) { on(x, Math.floor(h / 2) - 1 - k); on(x, Math.ceil(h / 2) + k); }
        else on(x, h - 1 - k);
      }
      if (pk > hgt + 2) {
        for (let k = pk - 2; k < pk; k++) {
          if (mirror) { on(x, Math.floor(h / 2) - 1 - k); on(x, Math.ceil(h / 2) + k); }
          else on(x, h - 1 - k);
        }
      }
    }
  }
  return out;
}
