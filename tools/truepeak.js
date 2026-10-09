// THE TRUE PEAK (lane VOLUMEFULL, 2026-10-09): the peak of a signal between its samples, read by 4x oversampling.
// A sample peak can sit under the wave's real top when the top falls between two samples; a digital-to-analogue
// converter draws the wave through them and can clip there. ITU-R BS.1770 reads the true peak by 4x oversampling;
// this does the same with a windowed-sinc interpolator (16 zero crossings each side, a Hann window), close to the
// standard's 48-tap filter and a little sharper. Used by tools/djfx_levels.html, djoverdrive_levels.html and
// volumefull_levels.html, and by the site's tools/volumefull_live.py on the live master.
//
// <claudes_code_comments>
// ** Function List **
// kernel(over, zc)       - the polyphase interpolation taps: one row per fractional phase, a Hann-windowed sinc
// truePeakOf(data, over) - the largest absolute value of one channel at `over` times the sample rate
// truePeak(buf, from)    - the largest true peak over every channel of an AudioBuffer, from `from` seconds
//
// ** Technical Review **
// - The integer phase (k = 0) is the sample itself, so a true peak is never under the sample peak.
// - Each fractional phase k/over is the sum over 2*zc neighbours of x[n+j] * sinc(j - k/over) * hann(j - k/over).
// - Cost is 2*zc*(over-1) multiplies a sample: an 8 s stereo render at 48 kHz is about 37 M, well under a second.
// </claudes_code_comments>

export function kernel(over = 4, zc = 16) {
  const rows = [];
  for (let k = 1; k < over; k++) {
    const f = k / over;
    const row = new Float64Array(2 * zc);
    for (let j = -zc + 1; j <= zc; j++) {
      const x = j - f; // the distance from the neighbour at offset j to the point between samples
      const s = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const w = 0.5 + 0.5 * Math.cos((Math.PI * x) / zc);
      row[j + zc - 1] = s * w;
    }
    rows.push(row);
  }
  return { rows, zc };
}

const K4 = kernel(4, 16);

export function truePeakOf(data, over = 4, start = 0) {
  const { rows, zc } = over === 4 ? K4 : kernel(over, 16);
  let peak = 0;
  const n = data.length;
  for (let i = start; i < n; i++) {
    const a = Math.abs(data[i]);
    if (a > peak) peak = a;
    for (const row of rows) {
      let s = 0;
      for (let j = -zc + 1; j <= zc; j++) {
        const m = i + j;
        if (m >= 0 && m < n) s += data[m] * row[j + zc - 1];
      }
      const b = Math.abs(s);
      if (b > peak) peak = b;
    }
  }
  return peak;
}

export function truePeak(buf, from = 0) {
  const start = Math.floor(from * buf.sampleRate);
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) peak = Math.max(peak, truePeakOf(buf.getChannelData(c), 4, start));
  return peak;
}
