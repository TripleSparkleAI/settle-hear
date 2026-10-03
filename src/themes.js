// settle-hear · themes - the five top themes the DJ picks from. A theme sets the rough shape of a whole set: tempo,
// key and mode, which instruments, which binaural beats, how busy, how wet, and how it leans the DJ's choices.
//
// <claudes_code_comments>
// ** Function List **
// THEMES             - the five themes, in menu order: CRYSTALS, HIGHLANDS, DEEP SEA, CATHEDRAL, EMBERS
// THEME_KEYS         - their keys
// themeOf(key)       - a theme by key (an unknown key gives HIGHLANDS, the default home of the flute)
// INSTRUMENTS        - every instrument a theme may name, with one line saying what it sounds like
//
// ** Technical Review **
// - A theme is plain data. A designer adds one by copying a block and changing numbers; nothing else in the code
//   needs to know its name (the DJ reads THEMES, the visualiser reads label and colour).
// - Fields: label, line (one sentence), root (a note name, tuned to A = 432), mode (tuning.MODES), bpm [slow, fast]
//   (the DJ moves inside it: a hot field plays fast, a settled one slow), meter (beats a bar), instruments (0..1 mix
//   levels; flute is the melody voice), drone (the instrument that holds the root), beats (the binaural beats in Hz
//   the DJ may visit; 40 is always home), density (0..1: how many accompaniment notes), reverb and delay (0..1 sends),
//   bright (0..1: the tone filter), tags (which tunes suit it), and bias (extra lean, in the DJ's units, on each of
//   its six choices).
// - Colours are the site's neon code names (the visualiser draws a theme in its neon): crystals ice, highlands calm,
//   deep sea pull, cathedral mem, embers heat.
// </claudes_code_comments>

export const INSTRUMENTS = {
  flute: 'the prime voice: a soft sine with a breath at the start and a slow vibrato; it plays the tunes',
  fiddle: 'a bowed string: a sawtooth through a body filter, faster vibrato, a little bite',
  harp: 'a plucked string: a bright attack that dies away over a second; it plays the broken chords',
  bells: 'struck metal: inharmonic partials (1, 2.76, 5.4), a long ring',
  crystal: 'struck glass: two high pure partials, a long shimmer',
  pipes: 'a Highland pipe drone: a buzzy reed held on the root and its fifth',
  pad: 'a soft held chord of sines and triangles, the room tone under everything',
};

export const THEMES = [
  {
    key: 'crystals',
    label: 'CRYSTALS',
    line: 'glass and bells in a bright mode, slow, with long held harmonics',
    neon: 'held',
    root: 'E4',
    mode: 'lydian',
    bpm: [62, 84],
    meter: 4,
    instruments: { flute: 0.9, crystal: 1, bells: 0.6, harp: 0.5, pad: 0.5 },
    drone: 'pad',
    beats: [40, 10, 12, 20, 30],
    density: 0.5,
    reverb: 0.55,
    delay: 0.3,
    bright: 0.9,
    tags: ['air', 'ancient', 'slow'],
    bias: { beat: 0, theme: 0, static: 0.6, split: 0.8, flute: 0, drone: -0.3 },
  },
  {
    key: 'highlands',
    label: 'HIGHLANDS',
    line: 'flute and fiddle over a pipe drone in A, at a dancing pace',
    neon: 'calm',
    root: 'A3',
    mode: 'mixolydian',
    bpm: [84, 116],
    meter: 4,
    instruments: { flute: 1, fiddle: 0.8, harp: 0.45, pipes: 0.8 },
    drone: 'pipes',
    beats: [40, 6, 8, 10, 20],
    density: 0.65,
    reverb: 0.3,
    delay: 0.12,
    bright: 0.7,
    tags: ['highlands', 'reel', 'jig', 'strathspey', 'march', 'air'],
    bias: { beat: 0, theme: 0, static: -0.2, split: 0, flute: 0.8, drone: 0.2 },
  },
  {
    key: 'deepsea',
    label: 'DEEP SEA',
    line: 'a low drone and a far flute, very slow, very wet, slow beats',
    neon: 'pull',
    root: 'D3',
    mode: 'dorian',
    bpm: [48, 64],
    meter: 4,
    instruments: { flute: 0.7, pad: 1, bells: 0.3, harp: 0.25 },
    drone: 'pad',
    beats: [40, 4, 5, 6, 8],
    density: 0.25,
    reverb: 0.75,
    delay: 0.45,
    bright: 0.35,
    tags: ['air', 'slow', 'ancient'],
    bias: { beat: -0.3, theme: 0, static: 0.2, split: 0, flute: -0.2, drone: 0.9 },
  },
  {
    key: 'cathedral',
    label: 'CATHEDRAL',
    line: 'a long hall: held harmonics, bells, the flute in plain chant',
    neon: 'mem',
    root: 'G3',
    mode: 'aeolian',
    bpm: [54, 72],
    meter: 4,
    instruments: { flute: 0.8, pad: 0.9, bells: 0.8, crystal: 0.3 },
    drone: 'pad',
    beats: [40, 7, 10, 12],
    density: 0.35,
    reverb: 0.85,
    delay: 0.1,
    bright: 0.55,
    tags: ['ancient', 'chant', 'air', 'slow'],
    bias: { beat: 0, theme: 0, static: 0.9, split: 0.4, flute: 0, drone: 0 },
  },
  {
    key: 'embers',
    label: 'EMBERS',
    line: 'fiddle and harp, quick and warm, beats that keep moving',
    neon: 'heat',
    root: 'B3',
    mode: 'minor pentatonic',
    bpm: [96, 132],
    meter: 4,
    instruments: { fiddle: 1, harp: 0.8, flute: 0.8, bells: 0.3, pipes: 0.3 },
    drone: 'pipes',
    beats: [40, 14, 16, 20, 30],
    density: 0.85,
    reverb: 0.25,
    delay: 0.2,
    bright: 0.8,
    tags: ['reel', 'jig', 'highlands', 'dance'],
    bias: { beat: 0.7, theme: 0, static: -0.5, split: 0, flute: 0.2, drone: -0.4 },
  },
];

export const THEME_KEYS = THEMES.map((t) => t.key);

export function themeOf(key) {
  return THEMES.find((t) => t.key === key) ?? THEMES[1];
}
