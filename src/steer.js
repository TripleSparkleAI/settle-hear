// settle-hear · steer - THE STEERING: the visitor's hand on the automatic DJ. A small store the page writes and the
// symphony reads once a bar, so every change lands on a bar line (a master tick) and never mid-bar.
//
// <claudes_code_comments>
// ** Function List **
// STEER_IDLE                 - the DJ alone: no leans, no held tracks, no wanted beat or theme, no holds
// STEER_BEATS                - the popular beats a visitor may point the DJ at (Hz, from the binaural modes)
// STEER_THEMES               - the theme keys a visitor may point the DJ at (THEME_KEYS)
// STEER_FX                   - THE DJ'S DESK controls (lane DJFX): mood, reverb, delay, drive, tone; overdrive and
//                              vocoder (lane DJOVERDRIVE)
// djSteer                    - the store: get(), set(next), patch(part), reset(), subscribe(fn)
// isIdleSteer(s)             - true when every control sits at "the DJ decides"
// applySteer(api, next, prev) - call the symphony's hooks for what changed between prev and next: dj.steer per
//                              choice, setMixLean per mix lean, dj.wantBeat, dj.wantTheme, holdBeat, lockTheme,
//                              setTrack per track, setFxSteer (THE DJ'S DESK), nextTune
//                              once per skip; returns the calls it made (name, args) so a fake api can be checked
//
// ** Technical Review **
// - THE SHAPE: { leans: { beat, theme, static, split, flute, drone: -1 | 0 | 1 }, mix: { energy, drums, bass, pad, fx:
//   -1 | 0 | 1 } (the house mix machine's leans, applied through api.setMixLean), tracks: { flute, fiddle, harp,
//   bells, crystal, drone, harmonics, binaural: null (the DJ) | false (held out) }, wantBeat: Hz | null,
//   wantTheme: key | null, holdBeat: bool, lockTheme: bool, skips: n (a counter: every increment is one "next
//   tune") }. Centre everywhere is STEER_IDLE: the symphony then runs exactly as it did before this file existed.
// - A lean never sets a choice (dj.js: the part named 'you'); a track hold is a real setTrack, because a layer in
//   or out is the one thing the visitor may decide outright; a wanted beat or theme decides where the DJ's own
//   change lands. The symphony applies the diff at the top of each bar (symphony.js runBar), so a click waits for
//   the next bar line at most (2 to 4 s). MUTE ALL is untouched: the channels still go through the engine's mute,
//   and applying a steer never calls play().
// - applySteer is a pure diff: it touches only what moved, so the DJ panel's own hidden toggles (which call the
//   same hooks directly) are not clobbered once a bar.
// </claudes_code_comments>

import { THEME_KEYS } from './themes.js';
import { DJ_CHOICES } from './dj.js';
import { BINAURAL_MODES } from './modes.js';

// the eight tracks a listener can hold in or out; symphony.js re-exports this list as TRACKS (one source, no cycle)
export const STEER_TRACKS = Object.freeze(['flute', 'fiddle', 'harp', 'bells', 'crystal', 'drone', 'harmonics', 'binaural']);
const TRACKS = STEER_TRACKS;
const KEYS = DJ_CHOICES.map((c) => c.key);
export const STEER_BEATS = [...new Set(BINAURAL_MODES.map((m) => m.beat))].sort((a, b) => b - a);
export const STEER_THEMES = THEME_KEYS.slice();
// THE MIX LEANS (lane SETTLEDJ): the house mix machine's own controls, -1 | 0 | 1 each (mix-machine.js MIX_STEER)
export const STEER_MIX = Object.freeze(['energy', 'drums', 'bass', 'pad', 'fx']);
// THE DJ'S DESK (lane DJFX, dj-fx.js): the visitor's hand on the DJ's effects. mood is a MOOD_KEYS key or null; reverb,
// delay, drive and tone are 0..1 or null (null = the DJ decides). A set value overrides the DJ for that effect only.
// Lane DJOVERDRIVE (dj-colour.js): overdrive (0..1: the bus's valve blend and every dealt voice overdrive; 0 never deals
// OVERDRIVE or a voice overdrive) and vocoder (0..1: 0 never deals one, above 0 keeps one on, the lead's when none dealt)
export const STEER_FX = Object.freeze(['mood', 'reverb', 'delay', 'drive', 'tone', 'overdrive', 'vocoder']);

export const STEER_IDLE = Object.freeze({
  leans: Object.freeze(Object.fromEntries(KEYS.map((k) => [k, 0]))),
  mix: Object.freeze(Object.fromEntries(STEER_MIX.map((k) => [k, 0]))),
  tracks: Object.freeze(Object.fromEntries(TRACKS.map((t) => [t, null]))),
  fx: Object.freeze(Object.fromEntries(STEER_FX.map((k) => [k, null]))),
  wantBeat: null,
  wantTheme: null,
  holdBeat: false,
  lockTheme: false,
  skips: 0,
});

export function isIdleSteer(s) {
  if (!s) return true;
  return KEYS.every((k) => !(s.leans?.[k])) && STEER_MIX.every((k) => !(s.mix?.[k])) && TRACKS.every((t) => s.tracks?.[t] == null)
    && STEER_FX.every((k) => s.fx?.[k] == null)
    && s.wantBeat == null && s.wantTheme == null && !s.holdBeat && !s.lockTheme;
}

function store(init) {
  let st = init;
  const subs = new Set();
  const api = {
    get: () => st,
    set(next) { st = next; for (const f of subs) f(st); },
    patch(part) {
      const next = { ...st, ...part };
      if (part.leans) next.leans = { ...st.leans, ...part.leans };
      if (part.mix) next.mix = { ...st.mix, ...part.mix };
      if (part.tracks) next.tracks = { ...st.tracks, ...part.tracks };
      if (part.fx) next.fx = { ...st.fx, ...part.fx };
      api.set(next);
    },
    reset() { api.set({ ...STEER_IDLE, skips: st.skips }); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
  return api;
}

export const djSteer = store(STEER_IDLE);

export function applySteer(api, next, prev = STEER_IDLE) {
  const calls = [];
  const call = (name, ...args) => { calls.push([name, ...args]); };
  if (!api || !next) return calls;
  const dj = api.dj ?? api;
  for (const k of KEYS) {
    const v = next.leans?.[k] ?? 0;
    if (v !== (prev?.leans?.[k] ?? 0)) { dj.steer?.(k, v); call('steer', k, v); }
  }
  for (const k of STEER_MIX) {
    const v = next.mix?.[k] ?? 0;
    if (v !== (prev?.mix?.[k] ?? 0)) { api.setMixLean?.(k, v); call('mix', k, v); }
  }
  if ((next.wantBeat ?? null) !== (prev?.wantBeat ?? null)) { dj.wantBeat?.(next.wantBeat ?? null); call('wantBeat', next.wantBeat ?? null); }
  if ((next.wantTheme ?? null) !== (prev?.wantTheme ?? null)) { dj.wantTheme?.(next.wantTheme ?? null); call('wantTheme', next.wantTheme ?? null); }
  if (!!next.holdBeat !== !!prev?.holdBeat) { api.holdBeat?.(!!next.holdBeat); call('holdBeat', !!next.holdBeat); }
  if (!!next.lockTheme !== !!prev?.lockTheme) { api.lockTheme?.(!!next.lockTheme); call('lockTheme', !!next.lockTheme); }
  for (const t of TRACKS) {
    const v = next.tracks?.[t] ?? null;
    if (v !== (prev?.tracks?.[t] ?? null)) { api.setTrack?.(t, v !== false); call('setTrack', t, v !== false); }
  }
  if (STEER_FX.some((k) => (next.fx?.[k] ?? null) !== (prev?.fx?.[k] ?? null))) {
    const fx = Object.fromEntries(STEER_FX.map((k) => [k, next.fx?.[k] ?? null]));
    api.setFxSteer?.(fx);
    call('fx', fx);
  }
  const skips = (next.skips ?? 0) - (prev?.skips ?? 0);
  for (let i = 0; i < skips; i++) { api.nextTune?.(); call('nextTune'); }
  return calls;
}
