// settle-hear · fx-index - THE MIX FX: the transition moves, inserts and beds the mix planner triggers, one list.
//
// <claudes_code_comments>
// ** Function List **
// FX                         - every effect, in menu order: riser, downlifter, reverse cymbal, snare roll, hall,
//                              one-bar silence, filter drop, bus tape stop, key lift, sidechain, the neutral hum,
//                              the evolving pad, field textures
// FX_KEYS                    - their keys, in the same order
// fxOf(key)                  - one effect by key (undefined for an unknown key)
//
// ** Technical Review **
// - Three kinds share one shape { key, label, family, kind, line, famous, cost, params }:
//   'move'   play(ctx, bus, t0, opts) -> { nodes, until }: a one-shot on the audio clock, self-stopping; a move that
//            automates bus.level or bus.filter sets them back by `until`.
//   'insert' build(ctx, p) -> { g, input, output, set(amount, t), bar?(t0, info) }: lives in a layer's chain.
//   'bed'    start(ctx, out, t0, opts) -> { nodes, peak, stop(t) }: a quiet continuous texture, level-capped.
// - Each param is [default, meaning, min, max]. The house.js passes are the other half of the effects; the lane's
//   mix-rack.js is the one registry over both.
// </claudes_code_comments>

import { riser } from './fx-riser.js';
import { downlifter } from './fx-downlifter.js';
import { reverseCymbal } from './fx-reverse-cymbal.js';
import { snareRoll } from './fx-snare-roll.js';
import { hall } from './fx-hall.js';
import { silence } from './fx-silence.js';
import { filterDrop } from './fx-filter-drop.js';
import { tapeStopBus } from './fx-tape-stop-bus.js';
import { keyLiftFx } from './fx-key-lift.js';
import { sidechain } from './fx-sidechain.js';
import { hum } from './fx-hum.js';
import { evolvingPad } from './fx-pad-evolve.js';
import { fieldTexture } from './fx-field.js';

export const FX = [riser, downlifter, reverseCymbal, snareRoll, hall, silence, filterDrop, tapeStopBus, keyLiftFx, sidechain, hum, evolvingPad, fieldTexture];
export const FX_KEYS = FX.map((f) => f.key);
const BY_KEY = new Map(FX.map((f) => [f.key, f]));

export function fxOf(key) {
  return BY_KEY.get(key);
}
