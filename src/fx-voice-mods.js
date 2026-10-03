// settle-hear · fx-voice-mods - the voice inserts that colour one melodic instrument (lane MELODYFX, 2026-10-02):
// tape wow and flutter, a drifting low-pass, an ensemble, a vibrato, a tremolo and a warm room. Each is a mix-rack
// insert with declared ranges; voice-fx.js deals them into each instrument's chain.
//
// <claudes_code_comments>
// ** Function List **
// tapeWow                    - TAPE WOW AND FLUTTER: a short delay whose time drifts slowly and trembles fast, through
//                              a worn-tape high cut: the pitch sways a few cents, like a cassette
// driftFilter                - DRIFTING LOW-PASS: a resonant low-pass whose cutoff swings slowly around its centre
// ensemble                   - ENSEMBLE: three slowly drifting copies a few milliseconds late, spread left to right
// vibrato                    - VIBRATO: one copy whose delay time swings at a singer's rate: the pitch wavers
// tremolo                    - TREMOLO: the level swings at a steady rate, or locked to eighth notes
// warmRoom                   - WARM ROOM: a short dark room behind the voice, its tail low-passed
// VOICE_MODS                 - the six, in menu order
//
// ** Technical Review **
// - Every insert here is fully wet: input -> its nodes -> output. The rack (mix-rack.js buildRack) puts each in a
//   slot whose AMOUNT crossfades the dry and the wet, so the chain decides how much of each colour is heard.
// - Pitch effects (wow, flutter, vibrato, ensemble) move a DelayNode's delayTime with a sine LFO. The pitch change
//   is the delay's slope: a swing of depth d seconds at rate r Hz bends the pitch by up to 2 pi r d (a ratio), so
//   vibrato 0.00025 s at 5.2 Hz is about 14 cents and the default wow 0.0016 s at 0.55 Hz about 10 cents. Every base
//   delay is longer than its total swing, so a delay time never goes below zero.
// - The drifting low-pass swings by depth x cutoff, so its lowest point is cutoff x (1 - depth), never below
//   cutoff x 0.2. The tremolo's level is 1 - depth/2 + (depth/2) sin, so it stays in 1 - depth .. 1: it only ever
//   takes level away. The room's impulse is engine.js impulse(), built once per (context, length, decay).
// - Each build reads its params through a clamp to the declared range, so a bad value lands at the nearest edge.
// </claudes_code_comments>

import { graph } from './house.js';
import { impulse } from './engine.js';

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const ranged = (fx, p) => (k) => { const [d, , lo, hi] = fx.params[k]; const x = Number.isFinite(+p?.[k]) ? +p[k] : d; return Math.min(hi, Math.max(lo, x)); };

export const tapeWow = {
  key: 'tape-wow', label: 'TAPE WOW AND FLUTTER', family: 'mod', kind: 'insert', cost: 5,
  line: 'the pitch sways slowly and trembles a little, and the top is worn away, like a melody played from an old cassette',
  famous: 'lo-fi hip hop and lo-fi house keys, where a tape machine with a tired motor makes every chord drift',
  params: {
    wow: [0.0016, 's of slow drift in the delay time', 0.0003, 0.004],
    wowRate: [0.55, 'Hz, the slow sway', 0.2, 1.5],
    flutter: [0.00012, 's of fast tremble', 0, 0.0005],
    flutterRate: [7, 'Hz, the fast tremble', 4, 12],
    tone: [6500, 'Hz, the worn-tape high cut', 2500, 12000],
  },
  build(ctx, p = {}) {
    const v = ranged(tapeWow, p);
    const g = graph(ctx);
    const input = g.gain(1);
    const d = g.delay(0.05, 0.012);
    const lp = g.filter('lowpass', v('tone'), 0.5);
    const output = g.gain(1);
    input.connect(d);
    d.connect(lp);
    lp.connect(output);
    g.lfo(v('wowRate'), v('wow'), d.delayTime);
    g.lfo(v('flutterRate'), v('flutter'), d.delayTime);
    return { g, input, output };
  },
};

export const driftFilter = {
  key: 'drift-filter', label: 'DRIFTING LOW-PASS', family: 'filter', kind: 'insert', cost: 3,
  line: 'a soft resonant low-pass that slowly opens and closes on its own, so the voice is warm and keeps moving',
  famous: 'deep house pads and keys, where a filter left breathing on a slow LFO keeps a loop alive for minutes',
  params: {
    cutoff: [2400, 'Hz, the centre of the swing', 700, 7000],
    Q: [2.2, 'resonance', 0.5, 7],
    rate: [0.08, 'Hz, the swing (12 s a cycle by default)', 0.02, 0.5],
    depth: [0.45, 'share of the cutoff it swings either side', 0, 0.8],
  },
  build(ctx, p = {}) {
    const v = ranged(driftFilter, p);
    const g = graph(ctx);
    const f = g.filter('lowpass', v('cutoff'), v('Q'));
    g.lfo(v('rate'), v('cutoff') * v('depth'), f.frequency);
    return { g, input: f, output: f };
  },
};

export const ensemble = {
  key: 'ensemble', label: 'ENSEMBLE', family: 'mod', kind: 'insert', cost: 9,
  line: 'three copies a few milliseconds late, each drifting at its own slow rate and placed left, centre and right: one player becomes a section',
  famous: 'string machines and the Juno chorus on pads and electric pianos, the wide soft sound of 1970s and 1980s keys',
  params: {
    depth: [0.0022, 's each copy drifts', 0.0006, 0.005],
    rate: [0.35, 'Hz, the middle copy (the others at 0.7 and 1.4 times)', 0.1, 1.2],
    spread: [0.6, 'how far left and right the outer copies sit', 0, 1],
  },
  build(ctx, p = {}) {
    const v = ranged(ensemble, p);
    const g = graph(ctx);
    const input = g.gain(1);
    const output = g.gain(1);
    const taps = [[0.012, 0.7, -1], [0.017, 1, 0], [0.023, 1.4, 1]];
    for (const [t, k, side] of taps) {
      const d = g.delay(0.05, t);
      const pan = g.panner(side * v('spread'));
      const w = g.gain(1 / taps.length);
      input.connect(d);
      d.connect(pan);
      pan.connect(w);
      w.connect(output);
      g.lfo(v('rate') * k, v('depth'), d.delayTime);
    }
    return { g, input, output };
  },
};

export const vibrato = {
  key: 'vibrato', label: 'VIBRATO', family: 'mod', kind: 'insert', cost: 3,
  line: 'the pitch wavers a few cents up and down at a singer\'s rate, a human wobble on a held note',
  famous: 'the vibrato bank of a Rhodes or a Wurlitzer, and every singer and string player',
  params: {
    rate: [5.2, 'Hz', 3, 7.5],
    depth: [0.00025, 's of delay swing (about 14 cents at 5.2 Hz)', 0.00005, 0.0008],
  },
  build(ctx, p = {}) {
    const v = ranged(vibrato, p);
    const g = graph(ctx);
    const d = g.delay(0.03, 0.006);
    g.lfo(v('rate'), v('depth'), d.delayTime);
    return { g, input: d, output: d };
  },
};

export const tremolo = {
  key: 'tremolo', label: 'TREMOLO', family: 'mod', kind: 'insert', cost: 2,
  line: 'the level swings gently up and down, free or locked to eighth notes: the shimmer of an electric piano\'s amp',
  famous: 'the stereo tremolo of a Rhodes Suitcase piano and the surf guitar amp',
  params: {
    rate: [4.2, 'Hz, when free', 0.5, 9],
    depth: [0.3, 'how much level it takes away at the bottom', 0, 0.7],
    sync: [0, '1: lock the swing to eighth notes on the beat', 0, 1],
  },
  build(ctx, p = {}) {
    const v = ranged(tremolo, p);
    const g = graph(ctx);
    const depth = v('depth');
    const node = g.gain(1 - depth / 2);
    const l = g.lfo(v('rate'), depth / 2, node.gain);
    const sync = v('sync') >= 0.5;
    return {
      g, input: node, output: node,
      bar(t0, { beatDur } = {}) { if (sync && beatDur > 0) at(l.osc.frequency, Math.min(9, 2 / beatDur), t0); },
    };
  },
};

const rooms = new WeakMap();
function roomIR(ctx, seconds, decay) {
  let m = rooms.get(ctx);
  if (!m) { m = new Map(); rooms.set(ctx, m); }
  const k = `${seconds.toFixed(2)}:${decay.toFixed(2)}`;
  if (!m.has(k)) m.set(k, impulse(ctx, seconds, decay));
  return m.get(k);
}

export const warmRoom = {
  key: 'warm-room', label: 'WARM ROOM', family: 'space', kind: 'insert', cost: 9,
  line: 'a short dark room behind the voice, the walls soft and the tail low-passed, so the note sits in a place instead of in the air',
  famous: 'the small wooden room of a felt piano recording and the short ambience of lo-fi keys',
  params: {
    seconds: [1.3, 's, the tail', 0.6, 2.6],
    decay: [3, 'how fast it dies', 1.5, 5],
    tone: [4200, 'Hz, the low-pass on the tail', 2000, 9000],
    predelay: [0.015, 's before the tail', 0, 0.05],
  },
  build(ctx, p = {}) {
    const v = ranged(warmRoom, p);
    const g = graph(ctx);
    const pre = g.delay(0.1, v('predelay'));
    const c = g.conv(roomIR(ctx, Math.round(v('seconds') * 10) / 10, Math.round(v('decay') * 4) / 4));
    const lp = g.filter('lowpass', v('tone'), 0.5);
    pre.connect(c);
    c.connect(lp);
    return { g, input: pre, output: lp };
  },
};

export const VOICE_MODS = [tapeWow, driftFilter, ensemble, vibrato, tremolo, warmRoom];
