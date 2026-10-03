// settle-hear · houseset - THE HOUSE SET: the bed (a soft four-on-the-floor thump and a soft pad), the tune at a subtle
// level, and a chain of passes over both, swapped by THE DJ at bar lines with a one-beat crossfade.
//
// <claudes_code_comments>
// ** Function List **
// createHouseSet(ctx, out, { seed, now }) - the set: bar(t0, d, beatDur, { notes, root, mode, heat, flute }) plays
//                              one bar; state() says what is playing; voices is the tune's lead bus (lane
//                              MELODYFX2); dispose() fades it out and frees it
// houseBpm(heat, prev)       - the tempo: 118 bpm (calm) to 126 (hot), smoothed bar to bar
//
// ** Technical Review **
// - Signal flow: bed (thump + pad) and the tune (the flute, at HOUSE.melodyLevel, about 14 dB down) meet in one source
//   gain -> the current chain (passes in series, then its limiter) -> a slot fader -> `out` (the symphony's house
//   channel, then the page's master, mute and master limiter).
// - A SWAP (houseSwap: a new theme replaces the chain; the DJ's beat or split light rolls two passes) builds the new
//   chain beside the old one at the bar line, fades the old out and the new in over HOUSE.crossfadeBeats, and frees
//   the old after the fade. Never mid-bar: bar() is the only place a swap happens.
// - THE DJ's modes in a house set: 'tune' plays the tune; 'bed' drops it; 'drone' is a breakdown (no thump, only the
//   pad and the chain's voices); 'static' keeps the groove and holds the tune back.
// - THE VOICE CHAIN (lane MELODYFX2): the tune plays on a dealt 'lead' (the clear flute dry, the distorted flute or
//   the lo-fi keys through a warm drive and two to four effects), dealt again on every full swap. No page plays this
//   set today (the symphony plays mix-layers.js createMixSet); it is kept as an API and given the same rule.
// - Everything is scheduled on the audio clock, a bar ahead at most; nothing runs per sample.
// </claudes_code_comments>

import { HOUSE, createPassBag, fillChain, houseSwap, progression, buildChain, strike, passOf } from './house.js';
import { playNote } from './instruments.js';
import { createVoiceDealer, createVoiceBuses } from './voice-fx.js';
import { midiHz } from './tuning.js';

export function houseBpm(heat = 0, prev = null) {
  const [lo, hi] = HOUSE.bpm;
  const h = Number.isFinite(heat) ? Math.min(1, Math.max(0, heat)) : 0;
  const want = lo + (hi - lo) * h;
  return prev == null ? want : Math.min(hi, Math.max(lo, 0.7 * prev + 0.3 * want));
}

export function createHouseSet(ctx, out, { seed = 1 } = {}) {
  const bag = createPassBag({ seed });
  let keys = fillChain(bag, []);
  const src = ctx.createGain();
  const bed = ctx.createGain();
  bed.gain.value = HOUSE.bedLevel;
  const melody = ctx.createGain();
  melody.gain.value = HOUSE.melodyLevel;
  bed.connect(src);
  melody.connect(src);
  // the pad: three soft triangles under a low-pass
  const padLp = ctx.createBiquadFilter();
  padLp.type = 'lowpass';
  padLp.frequency.value = 1100;
  const padG = ctx.createGain();
  padG.gain.value = 0.045;
  padLp.connect(padG);
  padG.connect(bed);
  const pad = [0, 1, 2].map(() => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 216; o.connect(padLp); o.start(); return o; });
  // the tune's voice chain (lane MELODYFX2): built on the first note, a new palette on every full swap
  const dealer = createVoiceDealer({ seed: ((Number(seed) >>> 0) ^ 0x7e1ead) >>> 0 || 1 });
  const voices = createVoiceBuses(ctx, melody, ['lead']);
  voices.palette(dealer.palette({ slots: ['lead'] }));

  const slot = (k) => {
    const chain = buildChain(ctx, k);
    const fade = ctx.createGain();
    fade.gain.value = 0;
    src.connect(chain.input);
    chain.output.connect(fade);
    fade.connect(out);
    return { chain, fade };
  };
  let cur = slot(keys);
  cur.fade.gain.setValueAtTime(0, ctx.currentTime);
  cur.fade.gain.linearRampToValueAtTime(HOUSE.out, ctx.currentTime + 1.5);
  const retiring = new Set();
  let bar = 0;
  let barsSince = 0;
  let swaps = 0;
  let dead = false;

  const swapTo = (next, t0, beatDur) => {
    const old = cur;
    cur = slot(next);
    const x = HOUSE.crossfadeBeats * beatDur;
    cur.fade.gain.setValueAtTime(0, t0);
    cur.fade.gain.linearRampToValueAtTime(HOUSE.out, t0 + x);
    old.fade.gain.setValueAtTime(HOUSE.out, t0);
    old.fade.gain.linearRampToValueAtTime(0, t0 + x);
    retiring.add(old);
    const id = setTimeout(() => {
      retiring.delete(old);
      try { src.disconnect(old.chain.input); } catch { /* gone */ }
      old.chain.dispose();
      try { old.fade.disconnect(); } catch { /* gone */ }
    }, (t0 - ctx.currentTime + x) * 1000 + 300);
    id?.unref?.();
  };

  return {
    bar(t0, d, beatDur, { notes = [], root = 57, mode = 'ionian', heat = 0, flute = true } = {}) {
      if (dead) return null;
      const sw = houseSwap(d, barsSince);
      if (sw) {
        keys = fillChain(bag, sw === 'all' ? [] : keys.slice(HOUSE.swapCount));
        swapTo(keys, t0, beatDur);
        if (sw === 'all') voices.palette(dealer.palette({ slots: ['lead'] }), t0, beatDur);
        barsSince = 0;
        swaps += 1;
      } else barsSince += 1;
      const chord = progression(root, mode, bar);
      // the pad follows the chord
      chord.forEach((m, i) => { const o = pad[i]; o.frequency.setValueAtTime(o.frequency.value, t0); o.frequency.linearRampToValueAtTime(midiHz(m), t0 + 0.12); });
      // the thump: the heart of the groove, absent in a breakdown
      const dmode = d?.mode ?? 'tune';
      if (dmode !== 'drone') {
        let bm = root;
        while (midiHz(bm) > 70) bm -= 12;
        for (let b = 0; b < 4; b++) strike(ctx, bed, 'sine', midiHz(bm) * 2, t0 + b * beatDur, { peak: 0.32, attack: 0.002, decay: 0.22, glideTo: midiHz(bm), glide: 0.07 });
      }
      // the tune, subtle
      const melodyNotes = dmode === 'tune' ? notes : [];
      const leadInst = voices.voiceOf('lead').inst;
      if (flute) for (const n of melodyNotes) if (n.midi != null) playNote(ctx, voices.input('lead', t0), leadInst, midiHz(n.midi), t0 + n.at * beatDur, n.beats * beatDur * 0.95, 0.85);
      cur.chain.bar(t0, { beatDur, bar, chord, root, melody: melodyNotes, heat });
      bar += 1;
      return { swap: sw, keys: keys.slice(), chord };
    },
    state() {
      return {
        keys: keys.slice(),
        labels: keys.map((k) => passOf(k)?.label ?? k),
        lines: keys.map((k) => passOf(k)?.line ?? ''),
        cost: cur.chain.cost,
        nodes: cur.chain.nodes,
        swaps,
        bar,
        barsSince,
        nextSwapMin: Math.max(0, HOUSE.swapMinBars - barsSince),
        nextSwapMax: Math.max(0, HOUSE.swapMaxBars - barsSince),
      };
    },
    get chain() { return cur.chain; },
    get voices() { return voices; },
    get source() { return src; },
    dispose() {
      if (dead) return;
      dead = true;
      const t = ctx.currentTime;
      for (const s of [cur, ...retiring]) { s.fade.gain.setValueAtTime(s.fade.gain.value, t); s.fade.gain.linearRampToValueAtTime(0, t + 0.3); }
      const id = setTimeout(() => {
        for (const s of [cur, ...retiring]) { s.chain.dispose(); try { s.fade.disconnect(); } catch { /* gone */ } }
        for (const o of pad) try { o.stop(); o.disconnect(); } catch { /* gone */ }
        voices.dispose();
        for (const n of [src, bed, melody, padLp, padG]) try { n.disconnect(); } catch { /* gone */ }
      }, 450);
      id?.unref?.();
    },
  };
}
