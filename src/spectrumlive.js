// settle-hear · spectrumlive - THE SPECTRUM SETTLE, the live half: the page's analyser read into bars, a live target
// function a settle-see item can call, the bass level, and the house set's public state for the hero.
//
// <claudes_code_comments>
// ** Function List **
// createSpectrumSource({ analyser, now }) - a reader over one AnalyserNode (or a function returning one): view()
//                              reads it at most once per 8 ms and keeps the Winamp motion; target(w, h, style) is
//                              the settle-see live function; bass() is the low end's level, 0..1
// spectrum                   - the page's source, over engine.js's masterAnalyser
// spectrumTarget(style)      - (w, h) => bits for a settle-see live item: { live: spectrumTarget('bars') }
// houseLive                  - the house set's public state: { house, audible, chain }; get(), set(patch),
//                              subscribe(fn)
//
// ** Technical Review **
// - One read per frame, whoever asks: the hero's live item and the bass nudge both call view(), and a second call
//   inside 8 ms returns the same view, so the analyser is read once and the falloff advances once per frame.
// - No engine, no analyser, or a silent page: view() returns empty levels, and spectrumBits turns those into an empty
//   target. The source never invents a spectrum.
// - houseLive is written by the symphony (it knows when its house set plays and whether sound is audible) and read
//   by the hero, which shows the spectrum items only while the house set is actually heard.
// </claudes_code_comments>

import { masterAnalyser } from './engine.js';
import { SPECTRUM, bandEdges, barLevels, createBars, bassLevel, isSilent, spectrumBits } from './spectrum.js';

const clockNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function createSpectrumSource({ analyser = masterAnalyser, now = clockNow } = {}) {
  const getAn = typeof analyser === 'function' ? analyser : () => analyser;
  const bars = createBars(SPECTRUM.bars);
  let edges = null;
  let rate = 0;
  let freq = null;
  let time = null;
  let wave = null;
  let last = -1e9;
  let view = { levels: new Float32Array(SPECTRUM.bars), peaks: new Float32Array(SPECTRUM.bars), wave: null, bass: 0, silent: true };
  const read = () => {
    const t = now();
    if (t - last < 8) return view;
    last = t;
    const an = getAn();
    if (!an) { bars.reset(); view = { ...view, levels: bars.levels, peaks: bars.peaks, wave: null, bass: 0, silent: true }; return view; }
    const sr = an.context?.sampleRate ?? 48000;
    if (!edges || sr !== rate || freq?.length !== an.frequencyBinCount) {
      rate = sr;
      edges = bandEdges(sr, { fftSize: an.fftSize });
      freq = new Uint8Array(an.frequencyBinCount);
      time = new Uint8Array(an.fftSize);
      wave = new Float32Array(an.fftSize);
    }
    an.getByteFrequencyData(freq);
    an.getByteTimeDomainData?.(time);
    for (let i = 0; i < time.length; i++) wave[i] = (time[i] - 128) / 128;
    const lv = bars.step(barLevels(freq, edges));
    view = { levels: lv.levels, peaks: lv.peaks, wave, bass: bassLevel(lv.levels, edges, sr, an.fftSize), silent: isSilent(lv.levels) };
    return view;
  };
  return {
    view: read,
    target(w, h, style = 'bars') { return spectrumBits(read(), w, h, style); },
    bass() { return read().bass; },
  };
}

export const spectrum = createSpectrumSource();

export function spectrumTarget(style = 'bars', source = spectrum) {
  return (w, h) => source.target(w, h, style);
}

function store(init) {
  let st = { ...init };
  const subs = new Set();
  return {
    get() { return st; },
    set(patch) {
      const next = { ...st, ...patch };
      if (Object.keys(next).every((k) => next[k] === st[k])) return;
      st = next;
      for (const f of subs) f(st);
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

export const houseLive = store({ house: false, audible: false, chain: '' });
