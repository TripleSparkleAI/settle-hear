// settle-hear · binaural - 40 Hz GAMMA SOUND: binaural beats, isochronic tones, the 10 kHz click train, a pink bed;
// and THE BINAURAL MODES (modes.js) built the same way, each a pair at its own beat and carrier with a soft pad.
//
// <claudes_code_comments>
// ** Function List **
// GAMMA_BEAT                      - 40: the beat every gamma sound carries, in Hz
// CARRIERS                        - the binaural carrier pairs: [{ key, left, right, label }], right - left = 40 Hz
// GAMMA_SOUNDS                    - the sound modes: [{ key, label, note, layers, settle }]
// gammaSound(key) / gammaCarrierOf(key)- look up a mode / a carrier pair (unknown keys fall back to the defaults);
//                                   a key from BINAURAL_MODES resolves to that mode's sound (layers binaural + pad,
//                                   settle true, its own beat and carrier)
// binauralPair(carrier, beat)     - { left, right, beat }: one sine per ear, `beat` Hz apart
// pulseTrain(sampleRate, opts)    - Float32Array: a carrier switched on `rate` times a second, ramped, one second
//                                   long and seamless when looped (the isochronic tone and the 10 kHz click train)
// pinkNoise(n, seed)              - Float32Array of pink noise (Paul Kellet's filter on seeded white noise), peak 0.9
// onsets(samples, sampleRate)     - the start times (s) of each burst in a pulse train (for tests and readouts)
// activeGammaSounds()             - how many gamma sounds are alive
// createGammaSound(opts)          - a gamma sound on the page's engine: { mode, carrier, level, playing, state,
//                                   setMode(key, { fade }), setCarrier, setLevel, play, stop, toggle, subscribe,
//                                   dispose }; fade (s) is the crossfade of a mode swap (TONE.pickFade by default,
//                                   TONE.modeFade for the shuffle)
//
// ** Technical Review **
// - BINAURAL: two OscillatorNodes (sines), left at the carrier and right at carrier + 40 Hz, joined by a
//   ChannelMergerNode into input 0 (left ear) and input 1 (right ear). Each ear hears one steady tone; the 40 Hz
//   beat exists only where the two ears are combined, so it needs headphones. The channel (dryChannel) has no reverb
//   and no delay send at all: the shared reverb and delay are stereo and would leak each ear's tone into the other.
// - ISOCHRONIC: one carrier tone switched on for 12.5 ms and off for 12.5 ms, 40 times a second, with 1.5 ms ramps
//   so the edges do not click. It is heard the same in both ears and needs no headphones.
// - 10 kHz CLICKS: 1 ms tones of 10 kHz, 40 a second (a 4% duty). This is the sound Martorell et al. 2019 (Cell
//   177:256) played to mice. Here it is a demonstration of the stimulus, nothing more.
// - PINK BED: two decorrelated pink noises (one per ear) under the binaural pair.
// - ON THE MASTER BEAT: every layer starts on a master tick (masterbeat.js masterStartTime), the next 500 ms line of
//   the page's one grid mapped onto the audio clock, so the 40 Hz light's onsets, the binaural pair's phase zero and
//   each isochronic burst or click start together.
// - A MODE (modes.js): the pair at the mode's beat and carrier (the console's carrier choice does not apply; the
//   mode's carrier is the point), plus THE PAD: one triangle per chord ratio above the carrier, gently detuned
//   (tone.js), through a low-pass whose cutoff breathes with a very slow sine, through the ring-mod shimmer
//   (vocoder.js, depth = the mode's shimmer, 0 = a wire), fading in over 2.5 s. The pad shares the dry channel: no
//   reverb, so each ear's tone stays its own.
// - THE HERO INPUT (heroinput.js) IS PLUGGED INTO EVERY MODE: the pad passes a 6-band vocoder whose modulator is
//   the hero bus (the picture's static speaks the pad's chord, at HERO_INPUT.vocoderDepth under the dry pad), the
//   pad's low-pass follows the heat and the settledness, and the shimmer and the vocoder widen with the flips. A
//   mode layer carries hero(params) for that; createGammaSound subscribes while a mode plays. The static itself
//   plays under every mode through the hearing (settle: true), at the mode's written fader.
// - A MODE SWAP CROSSFADES: setMode(key, { fade }) ramps the old layers out and the new ones in over `fade` seconds
//   and frees the old ones after; the shuffle uses TONE.modeFade (6 s), a hand pick TONE.pickFade.
// - Pulse trains are rendered once into a one-second AudioBuffer and looped. 40 periods fit one second exactly, so
//   the loop is seamless at any sample rate (burst starts are rounded to the nearest sample: at 44.1 kHz a period is
//   1102.5 samples), and an integer carrier completes whole cycles in one second, so its phase is continuous too.
// - Everything goes through the page's engine: channel -> master -> MUTE gain -> limiter. MUTE ALL silences a gamma
//   sound like every other sound on the site, and nothing here can turn the mute off. Nothing is built before the
//   first user gesture (the browser's rule); until then the sound only keeps its settings.
// - The layers exist only while the sound plays: stop fades the channel and frees the sources 0.4 s later; play
//   builds them again. A mode with no layers ('silent') builds nothing.
// </claudes_code_comments>

import { armUnlock, onEngine, ramp, wantSound } from './engine.js';
import { registerPulseTarget } from './pulse.js';
import { duckGain } from './duck.js';
import { masterStartTime } from './masterbeat.js';
import { modeOf, modePair } from './modes.js';
import { TONE, gentleDetune } from './tone.js';
import { createRingMod, createVocoder } from './vocoder.js';
import { HERO_INPUT, heroBus, heroNudge, onHeroInput, readHeroInput } from './heroinput.js';
import { soundLog, soundLogOn } from './soundlog.js'; // SOUNDLOG
let layerIds = 0; // SOUNDLOG

export const GAMMA_BEAT = 40;

export const CARRIERS = [
  { key: '150', left: 150, right: 190, label: 'low · 150 / 190 Hz' },
  { key: '200', left: 200, right: 240, label: 'warm · 200 / 240 Hz' },
  { key: '300', left: 300, right: 340, label: 'mid · 300 / 340 Hz' },
  { key: '400', left: 400, right: 440, label: 'bright · 400 / 440 Hz' },
];

export const GAMMA_SOUNDS = [
  {
    key: 'binaural',
    label: 'binaural',
    note: 'two sines, one per ear, 40 Hz apart. Use headphones: the beat is made between the ears.',
    layers: { binaural: 1 },
    settle: false,
  },
  {
    key: 'binaural-settle',
    label: 'binaural + settle',
    note: 'the binaural pair under the picture\'s own sound (crackle, drone, chord, bells).',
    layers: { binaural: 0.8 },
    settle: true,
  },
  {
    key: 'isochronic',
    label: 'isochronic 40 Hz',
    note: 'one tone switched on and off 40 times a second (12.5 ms on, 12.5 ms off). No headphones needed.',
    layers: { iso: 1 },
    settle: false,
  },
  {
    key: 'clicks',
    label: '10 kHz clicks',
    note: '1 ms tones of 10 kHz, 40 a second: the sound in Martorell et al. 2019. Sharp; keep it quiet.',
    layers: { clicks: 0.35 },
    settle: false,
  },
  {
    key: 'pink-binaural',
    label: 'pink bed + binaural',
    note: 'soft pink noise, a different one in each ear, under the binaural pair.',
    layers: { binaural: 0.8, pink: 0.5 },
    settle: false,
  },
  {
    key: 'silent',
    label: 'silent',
    note: 'light only: no gamma sound.',
    layers: {},
    settle: false,
  },
];

const DEFAULT_SOUND = 'binaural';
const DEFAULT_CARRIER = '200';

const modeSounds = new Map();
// a BINAURAL_MODES entry as a gamma sound: the pair and the pad, with the picture's static under it (settle: true)
function modeSound(m) {
  if (!modeSounds.has(m.key)) {
    modeSounds.set(m.key, { key: m.key, label: m.label, note: m.note, layers: { binaural: 0.9, pad: m.pad.level }, settle: true, mode: m, group: m.group });
  }
  return modeSounds.get(m.key);
}

export function gammaSound(key) {
  const m = modeOf(key);
  if (m) return modeSound(m);
  return GAMMA_SOUNDS.find((x) => x.key === key) ?? GAMMA_SOUNDS.find((x) => x.key === DEFAULT_SOUND);
}

export function gammaCarrierOf(key) {
  return CARRIERS.find((c) => c.key === String(key)) ?? CARRIERS.find((c) => c.key === DEFAULT_CARRIER);
}

export function binauralPair(carrier = 200, beat = GAMMA_BEAT) {
  const c = Number.isFinite(carrier) && carrier > 0 ? carrier : 200;
  const b = Number.isFinite(beat) && beat > 0 ? beat : GAMMA_BEAT;
  return { left: c, right: c + b, beat: b };
}

export function pulseTrain(sampleRate, { rate = GAMMA_BEAT, carrier = 300, onMs = 12.5, rampMs = 1.5, seconds = 1, amp = 0.8 } = {}) {
  const sr = Math.max(1, Math.round(sampleRate));
  const n = Math.round(sr * seconds);
  const out = new Float32Array(n);
  const on = Math.max(1, Math.round((onMs / 1000) * sr));
  const rp = Math.min(Math.floor(on / 2), Math.max(1, Math.round((rampMs / 1000) * sr)));
  const bursts = Math.round(rate * seconds);
  for (let k = 0; k < bursts; k++) {
    const s0 = Math.round((k * sr) / rate);
    for (let j = 0; j < on && s0 + j < n; j++) {
      const i = s0 + j;
      // raised-cosine ramps at both ends of every burst
      const e = j < rp ? 0.5 - 0.5 * Math.cos((Math.PI * j) / rp) : j >= on - rp ? 0.5 - 0.5 * Math.cos((Math.PI * (on - 1 - j)) / rp) : 1;
      out[i] = amp * e * Math.sin((2 * Math.PI * carrier * i) / sr);
    }
  }
  return out;
}

export function onsets(samples, sampleRate, gap = 0.002) {
  const t = [];
  let lastOn = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] !== 0) {
      if ((i - lastOn) / sampleRate > gap) t.push(i / sampleRate);
      lastOn = i;
    }
  }
  return t;
}

export function pinkNoise(n, seed = 0x9e3779b9) {
  const out = new Float32Array(Math.max(0, n | 0));
  let x = seed >>> 0 || 1;
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    const w = ((x >>> 0) / 4294967296) * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    const p = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
    out[i] = p;
    peak = Math.max(peak, Math.abs(p));
  }
  const k = peak > 0 ? 0.9 / peak : 0;
  for (let i = 0; i < out.length; i++) out[i] *= k;
  return out;
}

const bufferCache = new WeakMap();
function cached(ctx, name, make) {
  let m = bufferCache.get(ctx);
  if (!m) bufferCache.set(ctx, (m = new Map()));
  if (!m.has(name)) m.set(name, make());
  return m.get(name);
}

function monoBuffer(ctx, data) {
  const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
  b.getChannelData(0).set(data);
  return b;
}

// one layer's nodes: { nodes, sources, gain }
function buildLayer(E, name, level, pair, into, { fadeIn = 0.25, mode = null } = {}) {
  const { ctx } = E;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(into);
  const nodes = [gain];
  const sources = [];
  const extras = [];
  let hero = null;
  let heroWired = false;
  // THE MASTER BEAT (masterbeat.js): every layer starts on a master tick, so the binaural pair's phase zero,
  // every isochronic burst and click and a mode's pad start on a 40 Hz flash onset
  const t = masterStartTime(ctx);
  if (name === 'pad' && mode) {
    const P = mode.pad;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = P.cutoff;
    lp.Q.value = 0.7;
    // the breath: a very slow sine sweeps the cutoff by a fifth of itself
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = P.breath;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = P.cutoff * 0.2;
    lfo.connect(lfoAmt);
    lfoAmt.connect(lp.frequency);
    lfo.start(t);
    const n = P.ratios.length;
    P.ratios.forEach((r, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = mode.carrier * r;
      o.detune.value = gentleDetune(i, n);
      const g = ctx.createGain();
      g.gain.value = 0.22 / Math.sqrt(r);
      o.connect(g);
      g.connect(lp);
      o.start(t);
      nodes.push(o, g);
      sources.push(o);
    });
    const ring = createRingMod(ctx, { rate: mode.carrier * 2, depth: P.shimmer, breath: 0.05, start: t });
    lp.connect(ring.input);
    ring.output.connect(gain);
    // THE HERO INPUT: the picture's static opens the pad's bands (the vocoder), under the dry pad
    const voc = createVocoder(ctx, { bands: 6, lo: Math.max(80, mode.carrier * 0.8), hi: Math.min(6000, mode.carrier * 10), depth: HERO_INPUT.vocoderDepth });
    const bus = heroBus(E);
    bus.connect(voc.modulator);
    ring.output.connect(voc.carrier);
    voc.output.connect(gain);
    nodes.push(lp, lfo, lfoAmt);
    sources.push(lfo);
    // freeing the layer also takes the hero bus's edge into this vocoder, or every mode swap would leave one behind
    extras.push(ring, voc, { dispose: () => bus.disconnect(voc.modulator) });
    hero = (params) => {
      const k = heroNudge(params);
      const tt = ctx.currentTime;
      ramp(lp.frequency, P.cutoff * k.cutoff, tt, 0.6);
      ring.setDepth(Math.min(1, P.shimmer * k.shimmer));
      voc.setDepth(Math.min(1, HERO_INPUT.vocoderDepth * k.vocoder));
    };
    hero(readHeroInput());
    heroWired = true;
  } else if (name === 'binaural') {
    const merge = ctx.createChannelMerger(2);
    const ears = [pair.left, pair.right];
    ears.forEach((f, ear) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      o.connect(g);
      // input 0 is the left ear, input 1 the right ear
      g.connect(merge, 0, ear);
      o.start(t);
      nodes.push(o, g);
      sources.push(o);
    });
    merge.connect(gain);
    nodes.push(merge);
  } else if (name === 'iso' || name === 'clicks') {
    const spec = name === 'iso' ? { carrier: pair.left, onMs: 12.5, rampMs: 1.5 } : { carrier: 10000, onMs: 1, rampMs: TONE.clickRampMin * 1000 };
    const buf = cached(ctx, `${name}:${spec.carrier}`, () => monoBuffer(ctx, pulseTrain(ctx.sampleRate, spec)));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(gain);
    src.start(t);
    nodes.push(src);
    sources.push(src);
  } else if (name === 'pink') {
    const buf = cached(ctx, 'pink', () => {
      const n = Math.round(ctx.sampleRate * 4);
      const b = ctx.createBuffer(2, n, ctx.sampleRate);
      b.getChannelData(0).set(pinkNoise(n, 0x1234567));
      b.getChannelData(1).set(pinkNoise(n, 0x7654321));
      return b;
    });
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(gain);
    src.start(t);
    nodes.push(src);
    sources.push(src);
  }
  // a pad swells in slowly whatever the fade; everything else takes the fade given
  const rise = name === 'pad' ? Math.max(fadeIn, 2.5) : fadeIn;
  ramp(gain.gain, level, t, Math.max(0.01, rise / 3));
  const layer = { name, gain, nodes, sources, extras, hero, heroWired };
  layer.id = ++layerIds; // SOUNDLOG
  if (soundLogOn()) soundLog('layer:build', { id: layer.id, name, mode: mode?.key ?? null, level, sources: sources.length, startAt: +t.toFixed(3), now: +ctx.currentTime.toFixed(3), rise, state: ctx.state }); // SOUNDLOG
  return layer;
}

function freeLayer(E, layer, { fadeOut = 0.06 } = {}) {
  const t = E.ctx.currentTime;
  const tau = Math.max(0.02, fadeOut / 3);
  const after = fadeOut + 0.4;
  if (soundLogOn()) soundLog('layer:free', { id: layer.id, name: layer.name, fadeOut, stopAt: +(t + after).toFixed(3), now: +t.toFixed(3) }); // SOUNDLOG
  ramp(layer.gain.gain, 0, t, tau);
  for (const s of layer.sources) try { s.stop(t + after); } catch { /* already stopped */ }
  const done = () => {
    for (const x of layer.extras ?? []) try { x.dispose(); } catch { /* gone */ }
    for (const n of layer.nodes) try { n.disconnect(); } catch { /* already gone */ }
  };
  const id = setTimeout(done, after * 1000 + 50);
  id?.unref?.();
}

// a dry stereo channel: input -> lowpass -> fader -> the page master (and so through MUTE and the limiter). It has
// no reverb or delay sends at all, rather than sends turned down: a send at zero is still a path that a later
// setting could open, and either bus would mix one ear's tone into the other.
function dryChannel(E, level) {
  const { ctx } = E;
  const input = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 18000;
  lp.Q.value = 0.5;
  const fader = ctx.createGain();
  fader.gain.value = 0;
  // THE RADIAL PULSE (pulse.js): the swell alone; a pair's two ears must stay apart, so no pan and no shelf
  const swell = ctx.createGain();
  swell.gain.value = 1;
  input.connect(lp);
  lp.connect(fader);
  // THE MIX'S DUCK (lane DJSILENCE, duck.js): a drop dips this channel's level under the drop, never a tone's pitch
  const dk = duckGain(ctx, 'binaural');
  fader.connect(dk.node);
  dk.node.connect(swell);
  swell.connect(E.master);
  const unpulse = registerPulseTarget({ anchor: null, ctx, gain: swell.gain });
  let lvl = level;
  let on = true;
  const token = {}; // THE DEMAND (engine.js): a playing channel keeps the context awake
  const apply = (tau) => ramp(fader.gain, on ? lvl : 0, ctx.currentTime, tau);
  wantSound(token, true);
  return {
    input,
    setLevel(v) { lvl = v; apply(0.08); },
    setPlaying(p) { on = !!p; apply(on ? 0.3 : 0.05); wantSound(token, on); },
    dispose() {
      ramp(fader.gain, 0, ctx.currentTime, 0.05);
      wantSound(token, false);
      unpulse();
      dk.off();
      const id = setTimeout(() => { for (const n of [input, lp, fader, dk.node, swell]) try { n.disconnect(); } catch { /* already gone */ } }, 300);
      id?.unref?.();
    },
  };
}

const live = new Set();
export function activeGammaSounds() {
  return live.size;
}

export function createGammaSound({ mode = DEFAULT_SOUND, carrier = DEFAULT_CARRIER, level = 0.5, playing = true } = {}) {
  let M = gammaSound(mode);
  let C = gammaCarrierOf(carrier);
  let lvl = Math.min(1, Math.max(0, Number.isFinite(+level) ? +level : 0.5));
  let on = !!playing;
  let E = null;
  let ch = null;
  let layers = [];
  let dead = false;
  const subs = new Set();
  const pairOf = () => (M.mode ? modePair(M.mode) : binauralPair(C.left));
  const snapshot = () => ({ mode: M.key, carrier: C.key, level: lvl, playing: on, built: layers.length, pair: pairOf(), isMode: !!M.mode, label: M.label, heroInput: layers.some((L) => L.heroWired) });
  const emit = () => { const s = snapshot(); for (const f of subs) f(s); };

  const drop = (fadeOut) => {
    if (!E) return;
    for (const L of layers) freeLayer(E, L, { fadeOut });
    layers = [];
  };
  const build = (fade = 0.25) => {
    if (soundLogOn()) soundLog('gamma:build', { mode: M.key, fade, engine: !!E, dead, on, from: layers.map((L) => `${L.name}#${L.id}`).join(',') }); // SOUNDLOG
    if (!E || dead || !on) return;
    drop(fade);
    const pair = pairOf();
    layers = Object.entries(M.layers).map(([name, v]) => buildLayer(E, name, v, pair, ch.input, { fadeIn: fade, mode: M.mode ?? null }));
  };

  armUnlock();
  if (soundLogOn()) soundLog('gamma:create', { mode: M.key, level: lvl, playing: on }); // SOUNDLOG
  const off = onEngine((eng) => {
    if (dead) return;
    E = eng;
    ch = dryChannel(E, lvl);
    ch.setPlaying(on);
    build();
    emit();
  });
  // the hero's numbers reach every mode layer that listens (the pad's filter, the shimmer, the vocoder)
  const offHero = onHeroInput((params) => { for (const L of layers) L.hero?.(params); });
  live.add(snapshot);

  return {
    get mode() { return M.key; },
    get carrier() { return C.key; },
    get level() { return lvl; },
    get playing() { return on; },
    get state() { return snapshot(); },
    // the nodes alive now (tests and readouts)
    get layers() { return layers.map((L) => L.name); },
    get channel() { return ch; },
    setMode(key, { fade = TONE.pickFade } = {}) {
      const next = gammaSound(key);
      if (soundLogOn()) soundLog('gamma:setMode', { from: M.key, to: next.key, asked: key, fade, playing: on }); // SOUNDLOG
      if (next.key === M.key) return;
      M = next;
      build(Number.isFinite(+fade) && +fade > 0 ? +fade : TONE.pickFade);
      emit();
    },
    setCarrier(key) {
      const next = gammaCarrierOf(key);
      if (next.key === C.key) return;
      C = next;
      // only the layers that use the carrier change, but a rebuild is short and keeps one code path; a mode keeps
      // its own carrier, so only its snapshot changes
      if (!M.mode) build();
      emit();
    },
    setLevel(v) {
      const x = Number(v);
      if (!Number.isFinite(x)) return;
      lvl = Math.min(1, Math.max(0, x));
      ch?.setLevel(lvl);
      emit();
    },
    play() {
      if (soundLogOn()) soundLog('gamma:play', { mode: M.key, was: on }); // SOUNDLOG
      if (on) return;
      on = true;
      ch?.setPlaying(true);
      build();
      emit();
    },
    stop() {
      if (soundLogOn()) soundLog('gamma:stop', { mode: M.key, was: on }); // SOUNDLOG
      if (!on) return;
      on = false;
      ch?.setPlaying(false);
      drop();
      emit();
    },
    toggle() { if (on) this.stop(); else this.play(); return on; },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    dispose() {
      if (soundLogOn()) soundLog('gamma:dispose', { mode: M.key, dead }); // SOUNDLOG
      if (dead) return;
      dead = true;
      off();
      offHero();
      drop();
      ch?.dispose();
      ch = null;
      live.delete(snapshot);
      subs.clear();
    },
  };
}
