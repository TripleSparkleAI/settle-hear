// settle-hear · voices - the seven sounds a settle can make, each built from native Web Audio nodes.
//
// <claudes_code_comments>
// ** Function List **
// VOICES                     - the voice names, in mixing order
// VOICE_NOTES                - one line each: which number of the physics the voice follows
// makeVoice(name, ctx, out)  - build a voice into the node `out`; returns { update(p, t), tick(t0, t1), event(kind, d, t), dispose() }
// createChimeRoots(random)   - THE DECK RULE: the chime's chord roots as a deck over the pentatonic
//   hiss     - filtered noise: loudness and brightness follow the temperature
//   crackle  - grains of noise: their density follows the flips per sweep
//   drone    - two detuned saws and a sub: the pitch follows the energy (it sinks as the energy falls), the
//              brightness follows the temperature
//   choir    - four soft voices: a cluster that resolves to a major chord as the overlap with the picture rises
//   chime    - bells: a chord when the picture lands (phase becomes settled), one ping at each new target; the
//              chord's root deals from the pentatonic like a deck (createChimeRoots, THE DECK RULE)
//   pulse    - blips on a click: one more and a step higher for every level of click power, a sweep at max power
//   sparkle  - high glints: their rate follows the pointer's held trail
//
// ** Technical Review **
// - No per-sample JavaScript. Continuous voices are oscillators and filters steered by setTargetAtTime at the stats
//   rate (about 6 times a second). Grain voices (crackle, sparkle) are scheduled a little ahead by tick(t0, t1),
//   which the hearing calls about every 60 ms; each grain is one AudioBufferSourceNode started at a future time.
// - Grain counts are capped (crackle 60 a second, sparkle 30) and a tick never schedules more than 12 grains.
// - Event voices (chime, pulse) build a few nodes per strike and let them stop themselves.
// - p is soundParams() from map.js plus `held` (0 .. 1) and `level` (the voice's mix level, 0 .. 1).
// </claudes_code_comments>

import { noiseBuffer, ramp } from './engine.js';
import { TONE } from './tone.js';
import { pulsePitch, sparkleRate, chordRatios, dronePitch } from './map.js';
import { createBag } from './deck.js';

export const VOICES = ['hiss', 'crackle', 'drone', 'choir', 'chime', 'pulse', 'sparkle'];

export const VOICE_NOTES = {
  hiss: 'filtered noise; louder and brighter the hotter the field (temperature)',
  crackle: 'grains of noise, one cloud per sweep; the denser, the more lights flipped (flips per sweep)',
  drone: 'a low drone; its pitch sinks as the energy falls, its tone darkens as the field cools',
  choir: 'a soft chord; a cluster while the field is noise, resolving to a major chord as the overlap with the picture rises',
  chime: 'bells; a chord when the picture lands (the schedule reaches settled), a ping at each new target',
  pulse: 'rising blips on a click; one more and higher for each level of click power, a sweep at full power',
  sparkle: 'high glints; as many as the pointer is holding lights (the held trail)',
};

const PENTA = [0, 2, 4, 7, 9];
const rnd = (() => {
  let x = 0x1234567;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
})();

// THE DECK RULE: the chime's chord roots deal from the pentatonic like a deck, all five before any comes back
export function createChimeRoots(random = rnd) {
  return createBag(PENTA, { random });
}

function grainBuffer(ctx, ms, shape) {
  const n = Math.max(8, Math.round((ctx.sampleRate * ms) / 1000));
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  const noise = noiseBuffer(ctx).getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = shape(i / n, i) * noise[(i * 7) % noise.length];
  return b;
}

function strike(ctx, out, { freq, partials = [[1, 1]], decay = 1.5, gain = 0.2, type = 'sine', t, attack = TONE.attackMin }) {
  attack = Math.max(TONE.attackMin, attack);
  decay = Math.max(TONE.releaseMin, decay);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.setTargetAtTime(0, t + attack, decay / 4);
  g.connect(out);
  const oscs = partials.map(([r, a]) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq * r;
    const pg = ctx.createGain();
    pg.gain.value = a;
    o.connect(pg);
    pg.connect(g);
    o.start(t);
    o.stop(t + decay * 1.6 + 0.05);
    return o;
  });
  oscs[0].onended = () => { try { g.disconnect(); } catch { /* gone */ } };
}

const BUILD = {
  hiss(ctx, out) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.6;
    bp.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(bp);
    bp.connect(g);
    g.connect(out);
    src.start();
    return {
      update(p, t) {
        ramp(g.gain, p.level * 0.16 * Math.pow(p.heat, 1.5), t, 0.25);
        ramp(bp.frequency, p.cutoff * 0.8 + 200, t, 0.25);
      },
      dispose() { try { src.stop(); } catch { /* gone */ } g.disconnect(); },
    };
  },

  crackle(ctx, out) {
    const bufs = [2, 4, 7].map((ms) => grainBuffer(ctx, ms, (u) => Math.exp(-6 * u)));
    const pans = [-0.6, 0.6].map((x) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = x;
        g.connect(p);
        p.connect(out);
      } else g.connect(out);
      return g;
    });
    let rate = 0;
    let next = 0;
    return {
      update(p, t) {
        rate = p.grains;
        for (const g of pans) ramp(g.gain, p.level * 0.5, t, 0.1);
      },
      tick(t0, t1) {
        if (rate < 0.5) { next = t1; return; }
        if (next < t0) next = t0;
        let k = 0;
        // at most 12 grains a tick, more for a long look-ahead (a hidden tab), at the 60 a second cap
        const cap = Math.max(12, Math.ceil((t1 - t0) * 60));
        while (next < t1 && k < cap) {
          const s = ctx.createBufferSource();
          s.buffer = bufs[Math.floor(rnd() * bufs.length)];
          s.playbackRate.value = 0.5 + rnd() * 1.6;
          s.connect(pans[rnd() < 0.5 ? 0 : 1]);
          s.start(next);
          next += -Math.log(1 - rnd() * 0.999) / rate;
          k++;
        }
      },
      dispose() { for (const g of pans) g.disconnect(); },
    };
  },

  drone(ctx, out) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    lp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.value = 0;
    lp.connect(g);
    g.connect(out);
    const parts = [[1, 'sawtooth', -7, 0.35], [1, 'sawtooth', 7, 0.35], [0.5, 'sine', 0, 0.6]].map(([r, type, cents, a]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = cents;
      o.frequency.value = 55 * r;
      const pg = ctx.createGain();
      pg.gain.value = a;
      o.connect(pg);
      pg.connect(lp);
      o.start();
      return { o, r };
    });
    return {
      update(p, t) {
        const f = dronePitch(p.settled, 55, 1);
        for (const { o, r } of parts) ramp(o.frequency, f * r, t, 0.6);
        ramp(lp.frequency, 120 + p.cutoff * 0.35, t, 0.3);
        ramp(g.gain, p.level * 0.22, t, 0.5);
      },
      dispose() { for (const { o } of parts) try { o.stop(); } catch { /* gone */ } g.disconnect(); },
    };
  },

  choir(ctx, out) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.value = 0;
    lp.connect(g);
    g.connect(out);
    const root = 220;
    const oscs = chordRatios(0).map((r, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = root * r;
      o.detune.value = (i - 1.5) * 3;
      const pg = ctx.createGain();
      pg.gain.value = 0.25;
      o.connect(pg);
      pg.connect(lp);
      o.start();
      return o;
    });
    return {
      update(p, t) {
        p.ratios.forEach((r, i) => ramp(oscs[i].frequency, root * r, t, 0.35));
        ramp(g.gain, p.level * 0.2 * (0.35 + 0.65 * p.consonance), t, 0.4);
      },
      dispose() { for (const o of oscs) try { o.stop(); } catch { /* gone */ } g.disconnect(); },
    };
  },

  chime(ctx, out) {
    let lvl = 0;
    const roots = createChimeRoots();
    const bell = (freq, t, gain) => strike(ctx, out, { freq, t, gain: gain * lvl, decay: 2.4, partials: [[1, 1], [2.76, 0.35], [5.4, 0.12]] });
    return {
      update(p) { lvl = p.level; },
      event(kind, d, t) {
        if (kind === 'settled') {
          const root = 440 * Math.pow(2, roots.next() / 12);
          [1, 5 / 4, 3 / 2].forEach((r, i) => bell(root * r, t + i * 0.09, 0.09));
        } else if (kind === 'target') bell(880, t, 0.05);
      },
      dispose() {},
    };
  },

  pulse(ctx, out) {
    let lvl = 0;
    return {
      update(p) { lvl = p.level; },
      event(kind, d, t) {
        if (kind !== 'click' || lvl <= 0) return;
        const n = Math.max(1, Math.min(8, d.power || 1));
        for (let k = 0; k < n; k++) strike(ctx, out, { freq: pulsePitch(k, n), t: t + k * 0.07, decay: 0.18, gain: 0.12 * lvl, type: 'triangle' });
        if (d.max) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          // the saw never goes bare (tone.js): a low-pass at the ceiling rounds the sweep
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = TONE.rawCeiling;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.06 * lvl, t + 0.05);
          g.gain.setTargetAtTime(0, t + 0.5, 0.15);
          o.frequency.setValueAtTime(220, t);
          o.frequency.exponentialRampToValueAtTime(1760, t + 0.6);
          o.connect(lp);
          lp.connect(g);
          g.connect(out);
          o.start(t);
          o.stop(t + 1.2);
          o.onended = () => { try { g.disconnect(); lp.disconnect(); } catch { /* gone */ } };
        }
      },
      dispose() {},
    };
  },

  sparkle(ctx, out) {
    let lvl = 0;
    let rate = 0;
    let next = 0;
    return {
      update(p) { lvl = p.level; rate = sparkleRate(p.held); },
      tick(t0, t1) {
        if (rate < 0.5 || lvl <= 0) { next = t1; return; }
        if (next < t0) next = t0;
        let k = 0;
        const cap = Math.max(6, Math.ceil((t1 - t0) * 30));
        while (next < t1 && k < cap) {
          const semis = 24 + PENTA[Math.floor(rnd() * PENTA.length)] + 12 * Math.floor(rnd() * 2);
          strike(ctx, out, { freq: 220 * Math.pow(2, semis / 12), t: next, decay: 0.12, gain: 0.05 * lvl });
          next += -Math.log(1 - rnd() * 0.999) / rate;
          k++;
        }
      },
      dispose() {},
    };
  },
};

export function makeVoice(name, ctx, out) {
  const b = BUILD[name];
  if (!b) throw new Error(`settle-hear: no voice called ${name}`);
  const v = b(ctx, out);
  return { update: v.update, tick: v.tick ?? (() => {}), event: v.event ?? (() => {}), dispose: v.dispose };
}
