// lineWords - THE DJ's own words, in one list, so a site can show the line and the big view in its visitor's language
// (lane AUDITHOME, 2026-10-09: the line read "no pulse yet" and "opening blend" in English on a Japanese page; lane
// FINISHDJ, 2026-10-09: the big view, opened by a click on the line, read in English in every language too).
//
// <claudes_code_comments>
// ** Function List **
// enWords / whyWords / splitWords / clip - re-exported from words.js, the runtime helpers (no lists there)
// DJ_LINE_WORDS      - every English template THE DJ line can show: its fixed words, the opening blend's slots,
//                      the mix's sections and the DJ's four modes
// DJ_VIEW_WORDS      - every English template THE DJ's big view can show: its headings, paragraphs and labels, the
//                      lights' names and questions, the lean parts, the pulls' names, the themes' lines, the
//                      instruments, the tracks, the picture's phases, the planner's parts, the carried-set words
// DJ_WORDS           - both lists in one, each template once: what a site's catalogue lists
// LEAN_WHY_WORDS     - the fixed names of a light's lean parts (dj.js leans, mix-machine.js mixLeans)
//
// ** Technical Review **
// - HeroSymphony takes a `words` prop, a function (en, vars) -> string, and calls it with these templates exactly.
//   A site maps each template to its translation and fills the values (the SETTLE site: src/djLineWords.js, the
//   catalogue's `djline` table). Without the prop every word is English, as before, byte for byte.
// - NAMES STAY AS THEY ARE: theme names (CRYSTALS, DEEP SEA ...), the moods (CATHEDRAL, TAPE ...), tune titles and
//   books, effect names (TAPE DELAY ...), the drum, bass and texture styles, scale and key names, and the set's tag.
// - The house passes' long lines (house.js PASSES) are not listed: the big view draws them only while the house set
//   has no decision yet, when the list is empty, so no reader meets them.
// - Plain node can import this file (no React), so a site's catalogue extractor can read the list. A page's runtime
//   never imports it: HeroSymphony takes its helpers from words.js, so the lists stay out of the page's bundle.
// </claudes_code_comments>

import { OPENER_SLOTS } from '../src/opener.js';
import { SECTIONS } from '../src/mix-planner.js';
import { DJ_CHOICES, DJ_PULLS } from '../src/dj.js';
import { MIX_CHOICES, MIX_PULLS } from '../src/mix-machine.js';
import { THEMES } from '../src/themes.js';
import { INST_LABEL } from '../src/voice-fx.js';
import { STEER_TRACKS } from '../src/steer.js';

// the runtime helpers live in words.js (no lists there, so a page drawing THE DJ does not carry these lists)
export { enWords, whyWords, splitWords, clip } from './words.js';

export const DJ_LINE_MODES = ['drone', 'static', 'tune', 'bed'];

export const DJ_LINE_WORDS = Object.freeze([
  '{n} Hz pulse',
  'no pulse yet',
  'opening blend',
  'pure flute',
  'waiting',
  'house',
  'muted (MUTE ALL)',
  'stopped',
  'starts on your first click or key press',
  'playing',
  'waits for the first sound',
  '{slot}, {at} of {length}',
  '{label}, surfacing',
  'a generated phrase',
  'Close the DJ view',
  'Open the DJ view: how the sound follows the picture',
  'the handover to the DJ',
  "the DJ's effects: {mood}, {drive} drive, {band} {q} resonance",
  "THE DJ's colour on one voice: a harmonic overdrive, a vocoder",
  ...OPENER_SLOTS.map((s) => s.label),
  ...SECTIONS.map((s) => s.label.toLowerCase()),
  ...DJ_LINE_MODES,
]);

// the fixed names of a light's lean parts; 'theme X' and 'section X' carry a name and go through whyWords
export const LEAN_WHY_WORDS = Object.freeze([
  'base', 'heat', 'new target', 'bars since a change', 'away from 40 Hz', 'film frame', 'bars in this theme',
  'landed', 'overlap', 'a film plays', 'held too long', 'a word', 'a shape', 'flips', 'playing long', 'resting long',
  'calm and landed', 'droning long', 'you', 'the trained set', 'the picture', 'votes', 'holding the phrase', 'momentum',
]);

// the voices' parts (VoicesPanel); the pure flute's own part is 'flute'
export const DJ_VOICE_SLOTS = Object.freeze(['lead', 'arps', 'answer', 'chop', 'fiddle', 'harp', 'bells', 'crystal', 'flute']);
// the hero picture's phases, as THE DJ reads them
export const DJ_PHASES = Object.freeze(['hot', 'cooling', 'settled', 'reheating', 'unknown']);
// the planner's cost parts (mix-planner.js planCost)
export const PLAN_PARTS = Object.freeze(['arc', 'habit', 'you', 'votes', 'length']);

const pullNames = [...new Set([...DJ_PULLS, ...MIX_PULLS].flatMap(([a, b]) => [a, b]))];

export const DJ_VIEW_WORDS = Object.freeze([
  // the view itself
  'The DJ at work',
  'close',
  'Use headphones to hear the binaural beat.',
  '{beat} Hz beat',
  'carrier {hz} Hz',
  // THE OPENING BLEND
  'THE OPENING BLEND',
  'Every visit opens with this ambient set, never house: soft tones, isochronic pulses (one tone switched on and off cleanly at a slow rate), a warm pad and a gentle 40 Hz pulse. In DEFAULT MODE it plays alone: the picture\'s static and the binaural pair rest until the handover. The shape is the same every visit; the key, the order of the rates, the tones and the timings are settled fresh. At {length} it blends into the DJ\'s first set over {handover} s.',
  'tones {tones} · {from} Hz to {to} Hz · {bells} bells · {tag}',
  '{a} and {b}',
  // THE PLANNER
  'THE PLANNER · {section} · BAR {bar} OF SET {set}',
  'Every four bars the planner scores {count} plans of the next sixteen bars against the set\'s energy arc, the theme, the picture, your steering and the votes, with a habit prior that keeps changes on 8 and 16 bar lines, and settles one, cooling like the lights do.',
  'each',
  'the arc: {sections}; now {section}',
  'chosen: {parts}',
  'energy',
  'the arc',
  'next',
  '{section} at bar {bar}',
  'now: {moves}',
  // THE MIX MACHINE
  'THE MIX MACHINE SETTLES ELEVEN CHOICES, ONCE A BAR',
  'Each is a p-bit. Inside a phrase each leans hard to stay as it is; on a 4-bar line and at a section change the section, the picture, the theme, your steering and the votes decide.',
  'lean {v}',
  'pulls: {pulls}',
  '{a} with {b} {w}',
  '{a} against {b} {w}',
  'drums {drums} · bass {bass} · texture {texture}',
  'key lifted {n}',
  'the hum: {variant} at {rate}',
  'theme {name}',
  'section {name}',
  // THE COMPOSER
  'THE COMPOSER',
  'the old tune surfaces: {tune}, note for note',
  'seed {n}',
  'longest run shared with a source: {runs} (one phrase at most)',
  '{n} beats',
  'the new tune in ABC',
  'no tune yet',
  'leans on {n} rated tags',
  'the first set: nothing carried yet',
  'carries the key of the last set ({key})',
  'its opening motif',
  'leans on {n} earlier sets, the nearer ones more',
  // THE RACK
  'THE RACK · {n} EFFECTS, AMOUNTS MOVED BY THE DJ',
  'tag {tag}',
  // THE VOICES
  'THE VOICES · EVERY INSTRUMENT THROUGH ITS OWN CHAIN',
  'Each melodic part plays through a warm drive and two to four more effects, settled fresh each set from a deck so no part wears the same chain twice in a row. The clear flute is the one instrument with no effects.',
  'Swing {swing} of a beat.',
  'clear, no effects',
  // THE HOUSE SET
  'THE HOUSE SET · {n} OF {total} PASSES',
  'The tune sits about 14 dB under a soft four-on-the-floor and a pad, through these passes, then a limiter. The DJ swaps two at a bar line after {bars} bars when its beat or split light says yes, the whole chain on a new theme, and never mid-bar.',
  'cost {cost} of {budget} units · {swaps} swaps · {bars} bars with this chain',
  // THE DJ'S SIX CHOICES
  'THE DJ SETTLES SIX CHOICES, ONCE A BAR',
  'Each choice is a p-bit. Its lean comes from the hero picture; the pulls tie them together; the DJ cools them like the hero cools its lights, then plays what they say.',
  'the bar\'s settle: {n} sweeps, cooling from temperature {from} to {to}',
  'sweep {k} of {n}, settling',
  '{n} sweeps, T {from} → {to}',
  'the DJ has not decided yet',
  '{label} {answer}',
  '{label}: {question} {answer}',
  'yes',
  'no',
  // WHAT THE HERO SAYS
  'WHAT THE HERO SAYS',
  'heat',
  'overlap',
  'flips',
  'picture',
  'phase',
  'a film',
  'a film, frame {n}',
  'the word {word}',
  'the shape {shape}',
  '{phase} (landed)',
  'waiting for the picture\'s first numbers',
  // THE SOUND
  'THE SOUND',
  'theme',
  'mode',
  '{mode}, split into {n}',
  '{mode}, split into {n} ({how})',
  'the {n} letters of {word}',
  'a random draw',
  'tempo',
  '{bpm} bpm in {from} to {to}',
  '... in {from} to {to}',
  'beat',
  '{beat} Hz (home)',
  'ears',
  'harmonics',
  '{n} harmonics of {hz} Hz',
  'no harmonics of {hz} Hz',
  'partial {k}: {hz} Hz',
  'partial {k}: {hz} Hz (left out: a minor theme)',
  // THE TUNE
  'THE McKUSKER FLUTE · PURE',
  'THE TUNE',
  'A collected tune as written, on the raw flute alone, in a light room. Nothing else sounds.',
  'generated from the {mode} scale, not an old tune',
  'the flute is resting',
  'the last notes: {notes}',
  'every pitch from A = 432 Hz · {n} cleared tunes',
  // the controls
  'tracks and controls',
  'tracks',
  'hold',
  'lock the theme',
  'hold the beat at 40 Hz',
  '{label}: the DJ decides, or held yes or no',
  'tune',
  'next tune',
  'stop the symphony',
  'play the symphony',
  'level',
  'symphony level',
  // the data the view names, in plain words
  ...DJ_CHOICES.flatMap((c) => [c.label, c.question]),
  ...MIX_CHOICES.map((c) => c.question),
  ...pullNames,
  ...LEAN_WHY_WORDS,
  ...THEMES.map((t) => t.line),
  ...Object.values(INST_LABEL),
  ...STEER_TRACKS,
  ...DJ_VOICE_SLOTS,
  ...DJ_PHASES,
  ...PLAN_PARTS,
  'hum',
]);

export const DJ_WORDS = Object.freeze([...new Set([...DJ_LINE_WORDS, ...DJ_VIEW_WORDS])]);
