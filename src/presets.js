// settle-hear · presets - named mixes of voices and effects: five presets and six demo setups.
//
// <claudes_code_comments>
// ** Function List **
// PRESETS              - crackle, choir, drone, chime, pulse: one voice leads each, a few support it
// DEMOS                - hero, geiger, cathedral, arcade, ambient, whisper: ready setups for pages
// ALL                  - PRESETS and DEMOS in one table
// resolvePreset(spec)  - a name or a preset object -> a complete preset { voices, fx, level, note }
//
// ** Technical Review **
// - A preset is { note, voices: { name: mix 0..1 }, fx: { reverb 0..1, delay 0..1, filter Hz }, level 0..1 }.
//   `level` is the channel's fader; the voice mixes sit under it; the master and the limiter sit above all channels.
// - `hero` is the loudest and fullest (every voice); the others are quieter and leaner, so a page with several
//   sounding settles stays calm. tests/presets.test.mjs checks every preset names only real voices and every level
//   lies in [0, 1], and that hero is the loudest.
// - resolvePreset merges an object over the `crackle` preset, so { voices: { drone: 1 } } is a valid custom mix.
// </claudes_code_comments>

import { VOICES } from './voices.js';

export const PRESETS = {
  crackle: {
    note: 'the noise you can count: a crackle for every cloud of flips, hiss for the heat, glints under the pointer',
    voices: { crackle: 0.9, hiss: 0.3, pulse: 0.5, sparkle: 0.4 },
    fx: { reverb: 0.15, delay: 0, filter: 9000 },
    level: 0.5,
  },
  choir: {
    note: 'a chord that resolves as the picture forms, with bells when it lands',
    voices: { choir: 0.85, chime: 0.5, sparkle: 0.3 },
    fx: { reverb: 0.55, delay: 0.1, filter: 7000 },
    level: 0.45,
  },
  drone: {
    note: 'a low drone whose pitch sinks with the energy and whose tone darkens as the field cools',
    voices: { drone: 0.85, hiss: 0.35, pulse: 0.3 },
    fx: { reverb: 0.3, delay: 0.25, filter: 4000 },
    level: 0.45,
  },
  chime: {
    note: 'bells at each landing and each new target, echoed; glints and pulses on touch',
    voices: { chime: 0.9, sparkle: 0.5, pulse: 0.5 },
    fx: { reverb: 0.45, delay: 0.35, filter: 9000 },
    level: 0.45,
  },
  pulse: {
    note: 'click power as rising pulses, over a faint crackle',
    voices: { pulse: 1, crackle: 0.3 },
    fx: { reverb: 0.2, delay: 0.3, filter: 9000 },
    level: 0.45,
  },
};

export const DEMOS = {
  hero: {
    note: 'everything at once, the loudest: crackle and hiss while hot, the drone sinking, the chord resolving, bells as the word lands',
    voices: { crackle: 0.8, hiss: 0.3, drone: 0.6, choir: 0.7, chime: 0.7, pulse: 0.8, sparkle: 0.6 },
    fx: { reverb: 0.4, delay: 0.2, filter: 12000 },
    level: 0.8,
  },
  geiger: {
    note: 'a dry counter: only the crackle, one grain cloud per sweep of flips',
    voices: { crackle: 1 },
    fx: { reverb: 0, delay: 0, filter: 12000 },
    level: 0.4,
  },
  cathedral: {
    note: 'chord, drone and bells in a long hall',
    voices: { choir: 0.8, drone: 0.5, chime: 0.6 },
    fx: { reverb: 0.85, delay: 0.1, filter: 6000 },
    level: 0.4,
  },
  arcade: {
    note: 'pulses, bells and glints through a long echo: made for clicking',
    voices: { pulse: 0.9, chime: 0.6, sparkle: 0.7, crackle: 0.3 },
    fx: { reverb: 0.25, delay: 0.55, filter: 10000 },
    level: 0.4,
  },
  ambient: {
    note: 'a quiet drone and chord, nothing sharp',
    voices: { drone: 0.6, choir: 0.6, hiss: 0.2 },
    fx: { reverb: 0.6, delay: 0.2, filter: 3500 },
    level: 0.3,
  },
  whisper: {
    note: 'the quietest: hiss for the heat and glints under the pointer',
    voices: { hiss: 0.5, sparkle: 0.6 },
    fx: { reverb: 0.4, delay: 0, filter: 8000 },
    level: 0.25,
  },
};

export const ALL = { ...PRESETS, ...DEMOS };

export function resolvePreset(spec = 'crackle') {
  if (typeof spec === 'string') {
    const p = ALL[spec];
    if (!p) throw new Error(`settle-hear: no preset called ${spec} (have ${Object.keys(ALL).join(', ')})`);
    return { ...p, voices: { ...p.voices }, fx: { ...p.fx } };
  }
  const base = PRESETS.crackle;
  const voices = Object.fromEntries(Object.entries(spec.voices ?? base.voices).filter(([k]) => VOICES.includes(k)));
  return { note: spec.note ?? 'a custom mix', voices, fx: { ...base.fx, ...(spec.fx ?? {}) }, level: spec.level ?? base.level };
}
