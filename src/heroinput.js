// settle-hear · heroinput - THE HERO INPUT: the one bus every audio mode plugs the hero settle into. Two halves: the
// SOUND (a copy of the picture's own static, the 'picture' tap on the engine) and the NUMBERS (the latest sound
// parameters the picture produced: heat, flips, overlap, settledness). The navigator's rule (2026-10-01): "in all
// audio modes, the SETTLE HERO is plugged in".
//
// <claudes_code_comments>
// ** Function List **
// HERO_INPUT                 - the bus's fixed numbers: the tap's name, how far the pad's filter moves with the heat
//                              and the overlap, how far the shimmer moves with the flips, the vocoder depth
// heroBus(E)                 - the audio half: the engine's 'picture' tap (a GainNode; the hearing sends into it)
// feedHeroInput(params)      - the numbers half: the hearing calls it with soundParams() at every stats frame
// readHeroInput()            - the latest numbers (null before the first frame)
// onHeroInput(fn)            - subscribe to the numbers; returns off()
// heroNudge(params)          - pure: { cutoff (a factor on the pad's filter), shimmer (a factor on the ring depth),
//                              vocoder (a factor on the vocoder depth) } from the numbers, 1 when there are none
//
// ** Technical Review **
// - A mode's layers (binaural.js) read heroBus(E) as the vocoder's modulator over the pad and subscribe to the
//   numbers: a hot field opens the pad's low-pass, a settled one closes it a little; many flips widen the shimmer and
//   the vocoder's depth; a still picture leaves the mode at its written values (every factor is 1).
// - The bus is one GainNode on the engine with no path to the speakers of its own (tapBus): what it carries is heard
//   only where a mode lets it through the vocoder, so the static's own level stays the hearing's business.
// </claudes_code_comments>

import { tapBus } from './engine.js';

export const HERO_INPUT = {
  tap: 'picture',
  cutoffHeat: 0.45, // the pad's low-pass opens by up to this fraction with the heat
  cutoffSettled: 0.2, // and closes by up to this fraction as the field settles
  shimmerFlips: 1.2, // the ring shimmer widens by up to this factor with the flips
  vocoderFlips: 0.8, // the vocoder depth widens by up to this factor with the flips
  vocoderDepth: 0.3, // the vocoder's written depth in a mode (the static speaking the pad)
};

let latest = null;
const subs = new Set();

export function heroBus(E) {
  return tapBus(E, HERO_INPUT.tap);
}

export function feedHeroInput(params) {
  if (!params || typeof params !== 'object') return;
  latest = params;
  for (const fn of subs) { try { fn(latest); } catch { /* a listener that fails stays as it was */ } }
}

export function readHeroInput() {
  return latest;
}

export function onHeroInput(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

const c01 = (x) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

export function heroNudge(p) {
  if (!p) return { cutoff: 1, shimmer: 1, vocoder: 1 };
  const heat = c01(p.heat);
  const settled = c01(p.settled);
  const flips = c01(p.flipFraction);
  return {
    cutoff: 1 + HERO_INPUT.cutoffHeat * heat - HERO_INPUT.cutoffSettled * settled,
    shimmer: 1 + HERO_INPUT.shimmerFlips * flips,
    vocoder: 1 + HERO_INPUT.vocoderFlips * flips,
  };
}
