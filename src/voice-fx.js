// settle-hear · voice-fx - THE VOICE CHAINS (lane MELODYFX, 2026-10-02; lane MELODYFX2, 2026-10-04): every instrument
// that plays a melody, in every mode, but the clear flute plays through its own chain of at least three effects,
// always starting with a warm drive, dealt fresh each set so the instruments never sound the same twice in a row;
// the house DJ's chain and its settings ride in the set's tag.
//
// <claudes_code_comments>
// ** Function List **
// VOICE_SLOTS / HOUSE_SLOTS / SYMPHONY_SLOTS - the melodic parts the tag can name: the house DJ's lead, arps,
//                              answer and chop; the symphony's lead (its tune), fiddle, harp, bells and crystal.
//                              VOICE_SLOTS keeps its eight names in their old order (the tag's 3-bit index)
// OPENER_VOICE_SLOTS / JAM_SLOTS / ALL_SLOTS / slotIndex(slot) - the parts outside the tag (lane MELODYFX2): the
//                              opener's bells and the jam's five tonal hits; ALL_SLOTS gives every part its index
// SLOT_INSTRUMENTS           - which instruments each part may play (the DJ deals one per set); the answer's bag holds
//                              lane ECHOGUITAR's echo guitar, which answers with its own phrase and echoes, and lane
//                              DJGUITARS' fuzz lead, which answers with its own bent phrase; the arps' bag holds lane
//                              DJGUITARS' phase guitar, which plays the chord as its own arpeggio, strum or swell
// SYMPHONY_INSTRUMENTS       - the symphony's override: its tune deals the clear flute or the distorted flute
// INST_ALPHABET              - every instrument a tag can name, APPEND-ONLY (a tag stores an index)
// CLEAN_INSTRUMENTS          - the instruments that never take a chain: the clear flute alone
// REGISTER                   - each instrument's home pitch (midi): the tune is moved by whole octaves toward it
// SATURATOR                  - 'warm-drive', the effect every chain starts with
// INST_PEAK / velocityFor(inst, peak) - each instrument's peak at velocity 1; the velocity that gives a part's peak
// VOICE_CHAIN_POOL           - the other effects a chain can hold (30: lane MELODYFX's 19 and the pool review's 11),
//                              each with its taste ranges (inside its rack range) and its amount range
// POOL_EXCLUDED              - every rack effect left out of the pool, with its reason (the pool review)
// CLOCKED_KEYS / GENTLE_POOL / PROFILES - the profiles a part is dealt from: full (the whole pool), free (no effect
//                              that moves only on a bar clock: the jam), gentle (the opener's calm pool and tastes)
// LEVEL_MATCH_DB / levelTrim(dB) - the measured mean level change of each new chained path, and the post-chain trim
//                              that takes it back out
// FAMILY_CAP / PITCH_MOVERS  - how many of a family one chain may hold; the effects that bend pitch (one at most)
// SAME_KIND                  - pairs that sound alike (chorus and ensemble, phaser and flanger, the two crushes):
//                              one of each pair at most
// voiceFit(key, { theme, inst }) - how well an effect suits a theme and an instrument (the settle's lean)
// realizeVoice(seed, slotIdx, { slot, inst, keys, profile }) - the chain's amounts and settings from the set's seed:
//                              the same seed, part, keys and profile always give the same chain, which is how a tag
//                              rebuilds it
// realizePalette(spec)       - every voice of a palette spec realised; adds swing
// swingOf(seed)              - the set's swing in beats (0, 0.04, 0.08 or 0.12)
// createVoiceDealer({ seed }) - THE DEALER: .palette({ theme, slots, instruments, profile }) settles one set's
//                              palette; .remember(spec) takes a replayed palette as the last one; .last
// paletteOfTune(seed, theme, slots) - the palette a tag without a voice block gets, from its tune seed
// defaultVoice(slot)         - a part's fallback voice when no palette names it (still three effects, or the clear flute)
// chainLine(voice, words)    - one voice in plain words ("lo-fi keys: warm drive, tape wow, warm room"); words(en)
//                              gives the instrument and "clear, no effects" in a page's language (lane FINISHDJ);
//                              the effect names stay as they are
// createVoiceBuses(ctx, out, slots, { trim }) - the parts' buses, each built on its first note: { input(slot, t0),
//                              palette(P, t0, fade, info), voiceOf(slot), mute(slot, on, t0), muted(slot), states(),
//                              dispose() }; a muted slot's bus is born muted when it is built later
// createVoiceBus(ctx, out, { slot, trim }) - one part's live chain: { input, set(voice, t0, fade), bar(t0, info),
//                              mute(on, t0, fade), muted, voice, keys, trim, dispose() }; a new chain crossfades in over
//                              `fade` seconds; trim (a number or a function of the voice) is the gain after the chain;
//                              mute closes one gain after the chain (432 Hz McKUSKER MODE's mute, melody.js), tails too
//
// ** Technical Review **
// - THE RULE (navigator, 2026-10-02): "ALL go through many effects ... at least 3 per instrument as a base, and more
//   allowed ... at a minimum all go through some small distortion", "except for flute! ... the clear flute is the
//   only clear instrument", and "have a distorted flute too". So a chain is the warm drive plus two to four more;
//   the clear flute plays dry everywhere; the distorted flute's drive is 3.5 to 5, every other voice's 1.4 to 2.6.
// - THE SETTLE: per part, the dealer deals a HAND of 7 effects from that part's own bag of the pool (THE DECK RULE:
//   every effect comes round before any repeats, so the hands and the chains change set to set). Each card is a
//   p-bit (in the chain or not) under G = - fit (theme and instrument) + 0.7 for each card that was in this part's
//   last chain + 1 for each card another part already took this set + 3 for each family over its cap, for a second
//   pitch mover and for a second of a SAME_KIND pair (chorus and ensemble, phaser and flanger, the two crushes) +
//   0.4 (n - 3)^2. Twelve Gibbs sweeps cool T from 2 to 0.15 with the set's own stream; then a repair keeps the caps and at
//   least two extras. The instrument is dealt from the part's own bag of SLOT_INSTRUMENTS.
// - THE ORDER in a chain: the drive, then filter, grit, mod, time, space (the studio order: saturate, shape, colour,
//   repeat, place).
// - THE SETTINGS come from the set's seed, the part's index and the effect's key (deckRng), each a point of 16 on its
//   taste range (or one of a short list, like a delay of a half, three quarters or one and a half beats), so the tag
//   needs only the seed, the instrument and the keys to rebuild every number exactly.
// - THE LEVEL: a chain ends in a unity gain (buildRack limiter: false) and a trim of 0.95; the warm drive raises
//   a quiet note by at most its makeup (1.2 for a gentle chain) and caps a loud one; a part asks for a PEAK and
//   velocityFor turns it into the instrument's velocity, so swapping a bell for the keys keeps the part's level;
//   every feedback in the taste ranges stays at or under 0.42. The house rack's limiter and the page's master
//   limiter still sit beyond, and MUTE ALL is the engine's.
// - EVERYWHERE (lane MELODYFX2, navigator 2026-10-04: "'the trendy piano' is just ANY instrument that plays the
//   melodies ... all of them except the flute ... and make a version of the flute that DOES go through them"): the
//   symphony's tune is its 'lead' (the clear flute or the distorted flute, dealt per theme); the opener's bells, the
//   jam's pluck, bell, chord, vox and settle, a base's lead and chords and the house set's tune each play through a
//   chain built on the part's first note. THE POOL REVIEW added the eleven rack effects that suit a melody (a sweep,
//   a rise, a wah, a tilt, a comb, a soft clip, a ring shimmer, a tremolo gate, a dub echo, a gated room, a hall);
//   POOL_EXCLUDED names the rest and why. A part outside THE DJ's bar clock is dealt from the 'free' profile, and
//   the opener from the 'gentle' one; a profile other than 'full' rides in the spec, never in the tag.
// </claudes_code_comments>

import { buildRack, rackOf, paramValues } from './mix-rack.js';
import { deckRng, createBag } from './deck.js';

export const HOUSE_SLOTS = Object.freeze(['lead', 'arps', 'answer', 'chop']);
// lane MELODYFX2: the symphony's tune is a part too ('lead', dealt the clear flute or the distorted flute), so a
// processed flute plays wherever the clear flute can. VOICE_SLOTS keeps its eight names in their old order: the tag
// stores a slot as a 3-bit index into it.
export const SYMPHONY_SLOTS = Object.freeze(['lead', 'fiddle', 'harp', 'bells', 'crystal']);
export const VOICE_SLOTS = Object.freeze([...HOUSE_SLOTS, ...SYMPHONY_SLOTS.filter((s) => !HOUSE_SLOTS.includes(s))]);
// lane MELODYFX2: the parts outside THE DJ's tag: the opener's bells and the jam's five tonal hits (the loop layers
// and the live radio's followed loops play through the same jam voices)
export const OPENER_VOICE_SLOTS = Object.freeze(['opener-bells']);
export const JAM_SLOTS = Object.freeze(['jam-pluck', 'jam-bell', 'jam-chord', 'jam-vox', 'jam-settle']);
export const ALL_SLOTS = Object.freeze([...VOICE_SLOTS, ...OPENER_VOICE_SLOTS, ...JAM_SLOTS]);
export const slotIndex = (slot) => ALL_SLOTS.indexOf(slot);
export const SLOT_INSTRUMENTS = Object.freeze({
  lead: ['flute', 'flute-drive', 'keys'],
  arps: ['pluck', 'keys', 'harp', 'phase-guitar'],
  answer: ['keys', 'bells', 'flute-drive', 'crystal', 'echo-guitar', 'fuzz-lead'],
  chop: ['chop'],
  fiddle: ['fiddle'],
  harp: ['harp'],
  bells: ['bells'],
  crystal: ['crystal'],
  'opener-bells': ['opener-bells'],
  'jam-pluck': ['jam-pluck'],
  'jam-bell': ['jam-bell'],
  'jam-chord': ['jam-chord'],
  'jam-vox': ['jam-vox'],
  'jam-settle': ['jam-settle'],
});
// the symphony deals its tune between the two flutes only (the keys stay a house instrument)
export const SYMPHONY_INSTRUMENTS = Object.freeze({ lead: ['flute', 'flute-drive'] });
export const INST_ALPHABET = Object.freeze(['flute', 'flute-drive', 'keys', 'pluck', 'harp', 'bells', 'crystal', 'fiddle', 'chop', 'echo-guitar', 'fuzz-lead', 'phase-guitar']);
export const CLEAN_INSTRUMENTS = new Set(['flute']);
export const INST_LABEL = {
  flute: 'the clear flute', 'flute-drive': 'the distorted flute', keys: 'lo-fi keys', pluck: 'soft pluck', harp: 'harp', bells: 'bells', crystal: 'crystal', fiddle: 'fiddle', chop: 'the chop', 'echo-guitar': 'the echo guitar', 'fuzz-lead': 'the fuzz lead', 'phase-guitar': 'the phase guitar',
  'opener-bells': 'the opener\'s bells', 'jam-pluck': 'the jam pluck', 'jam-bell': 'the jam bell', 'jam-chord': 'the jam chord', 'jam-vox': 'the jam vox', 'jam-settle': 'the jam settle burst',
};
export const REGISTER = { flute: 79, 'flute-drive': 74, keys: 67, pluck: 64, harp: 62, bells: 74, crystal: 84, fiddle: 67, chop: 79, 'echo-guitar': 64, 'fuzz-lead': 74, 'phase-guitar': 62 };
export const SATURATOR = 'warm-drive';

const pick = (...v) => ({ pick: v });
export const VOICE_CHAIN_POOL = Object.freeze({
  'drift-filter': { taste: { cutoff: [1400, 4200], Q: [1, 3.5], rate: [0.03, 0.15], depth: [0.2, 0.55] }, amount: [0.8, 1] },
  formant: { taste: { Q: [4, 7], wet: [0.6, 0.9], dry: [0.5, 0.8] }, amount: [0.25, 0.45] },
  bitcrush: { taste: { bits: pick(7, 8, 9), wet: [0.12, 0.25] }, amount: [0.4, 0.7] },
  'rate-reduce': { taste: { nyquist: [3000, 6000], crush: [0.05, 0.15] }, amount: [0.5, 0.8] },
  'ring-mod': { taste: { wet: [0.06, 0.14], octaves: pick(1, 2) }, amount: [0.4, 0.7] },
  ensemble: { taste: { depth: [0.0012, 0.003], rate: [0.2, 0.6], spread: [0.3, 0.8] }, amount: [0.35, 0.6] },
  chorus: { taste: { wet: [0.25, 0.45], depth: [0.0015, 0.003] }, amount: [0.4, 0.7] },
  phaser: { taste: { centre: [500, 1200], depth: [300, 700], rate: [0.08, 0.3] }, amount: [0.35, 0.6] },
  flanger: { taste: { feedback: [0.2, 0.42], depth: [0.0015, 0.003], rate: [0.08, 0.25] }, amount: [0.25, 0.45] },
  'tape-wow': { taste: { wow: [0.0008, 0.0022], wowRate: [0.35, 0.8], flutter: [0.00004, 0.00018], flutterRate: [5, 9], tone: [4500, 9000] }, amount: [0.85, 1] },
  vibrato: { taste: { rate: [4.5, 6], depth: [0.00012, 0.0003] }, amount: [0.7, 1] },
  tremolo: { taste: { rate: [3, 6], depth: [0.15, 0.35], sync: pick(0, 1) }, amount: [0.6, 1] },
  'auto-pan': { taste: { width: [0.3, 0.6] }, amount: [0.7, 1] },
  rotary: { taste: { depth: [0.0006, 0.0012] }, amount: [0.4, 0.7] },
  'tape-delay': { taste: { beats: pick(0.5, 0.75, 1.5), feedback: [0.2, 0.42], wet: [0.2, 0.35], tone: [1600, 3000] }, amount: [0.5, 0.8] },
  'ping-pong': { taste: { beats: pick(0.5, 0.75), feedback: [0.2, 0.4], wet: [0.18, 0.3] }, amount: [0.5, 0.8] },
  plate: { taste: { seconds: [1.2, 2.2], decay: [2.4, 3.4], wet: [0.18, 0.3] }, amount: [0.5, 0.9] },
  shimmer: { taste: { wet: [0.12, 0.22], grain: [0.08, 0.12] }, amount: [0.4, 0.7] },
  'warm-room': { taste: { seconds: [0.9, 1.8], decay: [2.5, 4], tone: [3000, 6000], predelay: [0.008, 0.03] }, amount: [0.2, 0.38] },
  // lane MELODYFX2: the eleven other rack effects that suit a melody, at gentle settings (the pool review)
  'lowpass-sweep': { taste: { lo: [800, 1250], hi: [3500, 5200], Q: [4.5, 5.5] }, amount: [0.35, 0.55] },
  'highpass-rise': { taste: { hi: [180, 320], Q: [1, 1.6] }, amount: [0.6, 0.9] },
  wah: { taste: { centre: [800, 1400], depth: [150, 350], Q: [2.5, 3.5], dry: [0.6, 0.85] }, amount: [0.3, 0.5] },
  'tilt-eq': { taste: { tilt: [3, 4], pivot: [600, 1200] }, amount: [0.6, 1] },
  comb: { taste: { feedback: [0.2, 0.36], wet: [0.12, 0.22] }, amount: [0.3, 0.5] },
  'soft-clip': { taste: { drive: [1.1, 1.6], trim: [0.75, 0.95] }, amount: [0.3, 0.5] },
  'ring-shimmer': { taste: { depth: [0.06, 0.12], breath: [0.05, 0.08] }, amount: [0.4, 0.7] },
  'trance-gate': { taste: { floor: [0.55, 0.75], seed: pick(5, 7, 9, 11) }, amount: [0.5, 0.8] },
  'dub-echo': { taste: { feedback: [0.2, 0.36], swell: [0.41, 0.42], wet: [0.15, 0.25], band: [900, 1800] }, amount: [0.5, 0.8] },
  'gated-reverb': { taste: { wet: [0.12, 0.2], open: [0.4, 0.8] }, amount: [0.4, 0.7] },
  hall: { taste: { wet: [0.15, 0.25], predelay: [0.015, 0.04], cut: [3500, 6500], seconds: [2.2, 3.5], decay: [1.8, 3] }, amount: [0.5, 0.8] },
});
// THE POOL REVIEW (lane MELODYFX2): every rack effect is in the pool or named here with its reason
export const POOL_EXCLUDED = Object.freeze({
  pump: 'it ducks the whole mix to the kick: the bus\'s job, not one voice\'s',
  sidechain: 'it ducks the whole mix to the kick: the bus\'s job, not one voice\'s',
  kit: 'a voice that adds drums of its own; it does not process the melody',
  arpeggiator: 'a voice that adds its own arpeggio; it does not process the melody',
  'octave-doubler': 'a voice that adds its own line; it does not process the melody',
  supersaw: 'a voice that adds its own pad; it does not process the melody',
  'sub-bass': 'a voice that adds its own bass; it does not process the melody',
  'vinyl-riser': 'a voice that adds its own noise riser; it does not process the melody',
  stutter: 'a beat-repeat glitch at feedback 0.85 (over the 0.42 cap) that cuts the tune off',
  'tape-stop': 'a pitch drop every eighth bar: a transition move, which the bus tape stop already plays',
  'sweep-in': 'an arrival build that halves the level when a chain lands: a transition, not a colour',
  'isolator-drop': 'a drop that cuts the low end by 30 dB: a transition, not a colour',
  'vocoder-static': 'it needs the hero\'s picture tap, which a voice bus has not got, and costs 16 units',
  'warm-drive': 'it is not dealt: it is the mandatory first effect of every chain',
});
export const POOL_KEYS = Object.freeze(Object.keys(VOICE_CHAIN_POOL));
export const DRIVE_TASTE = {
  default: { drive: [1.4, 2.6], character: pick(0, 1, 2), tone: [3500, 7000], makeup: [1, 1.2] },
  'flute-drive': { drive: [3.5, 5], character: pick(0, 1, 2), tone: [3000, 6000], makeup: [1.8, 2.4] },
  keys: { drive: [1.6, 2.8], character: pick(1, 2), tone: [3000, 5500], makeup: [1, 1.2] },
  // lane ECHOGUITAR: an electric guitar likes a little more push than the keys. Its top was 3, over the 2.8 every
  // voice but the distorted flute keeps (tests/melodyfx.test.mjs); lane DJGUITARS' larger bags dealt it at 2.92 and
  // the law's test caught it, so its range now ends at 2.8, the keys' own top
  'echo-guitar': { drive: [1.8, 2.8], character: pick(0, 1), tone: [2800, 5000], makeup: [1, 1.2] },
  // lane MELODYFX2: the opener's soft tape drive (the tape curve only, a little push, no makeup)
  gentle: { drive: [1.2, 1.5], character: pick(2), tone: [3500, 5500], makeup: [1, 1] },
};
// THE PROFILES (lane MELODYFX2): which effects a part may be dealt, and at what taste.
//   full   - the whole pool: the parts that hear THE DJ's bar clock (the house set, the symphony, the bases page)
//   free   - the pool less the five effects that only move on a bar clock (a sweep or a gate that re-arms each bar):
//            the jam, whose hits come at a visitor's whim, gets one static bar of tempo and key at build time
//   gentle - the opener: soft tape drive, warm room, slow tremolo, drifting low-pass, ensemble and their calm
//            cousins, never a crush, a ring or any other grit
export const CLOCKED_KEYS = Object.freeze(['lowpass-sweep', 'highpass-rise', 'tilt-eq', 'trance-gate', 'gated-reverb']);
export const GENTLE_POOL = Object.freeze({
  'tape-wow': { taste: { wow: [0.0006, 0.0014], wowRate: [0.25, 0.5], flutter: [0.00002, 0.00008], flutterRate: [5, 7], tone: [5000, 8000] }, amount: [0.7, 0.9] },
  'drift-filter': { taste: { cutoff: [1800, 3500], Q: [0.7, 1.6], rate: [0.03, 0.08], depth: [0.15, 0.35] }, amount: [0.7, 0.95] },
  ensemble: { taste: { depth: [0.001, 0.0022], rate: [0.15, 0.4], spread: [0.4, 0.8] }, amount: [0.3, 0.5] },
  chorus: { taste: { wet: [0.2, 0.35], depth: [0.0012, 0.0022] }, amount: [0.3, 0.5] },
  tremolo: { taste: { rate: [0.5, 1.4], depth: [0.08, 0.18], sync: pick(0) }, amount: [0.5, 0.8] },
  'warm-room': { taste: { seconds: [1.2, 2.2], decay: [2.5, 3.5], tone: [3000, 5000], predelay: [0.01, 0.03] }, amount: [0.2, 0.35] },
  plate: { taste: { seconds: [1.4, 2.2], decay: [2.6, 3.4], wet: [0.15, 0.25] }, amount: [0.4, 0.7] },
  hall: { taste: { wet: [0.15, 0.25], predelay: [0.02, 0.04], cut: [3500, 6000], seconds: [2.5, 3.5], decay: [2, 3] }, amount: [0.5, 0.8] },
  'tape-delay': { taste: { beats: pick(1.5, 3), feedback: [0.15, 0.3], wet: [0.12, 0.2], tone: [1500, 2500] }, amount: [0.4, 0.7] },
});
export const PROFILES = Object.freeze({
  full: { pool: Object.keys(VOICE_CHAIN_POOL) },
  free: { pool: Object.keys(VOICE_CHAIN_POOL).filter((k) => !CLOCKED_KEYS.includes(k)) },
  gentle: { pool: Object.keys(GENTLE_POOL), taste: GENTLE_POOL, drive: DRIVE_TASTE.gentle },
});
const profileOf = (name) => PROFILES[name] ?? PROFILES.full;
const poolEntry = (profile, key) => profileOf(profile).taste?.[key] ?? VOICE_CHAIN_POOL[key];
// each instrument's own peak at velocity 1 (instruments.js), so a part can ask for a LEVEL and get it on any
// instrument: velocity = level / peak
export const INST_PEAK = { flute: 0.22, 'flute-drive': 0.22, keys: 0.2, pluck: 0.12, harp: 0.16, bells: 0.08, crystal: 0.05, fiddle: 0.11, chop: 1, 'echo-guitar': 0.18, 'fuzz-lead': 0.22, 'phase-guitar': 0.23 };
export const velocityFor = (inst, peak) => Math.min(1, Math.max(0, peak / (INST_PEAK[inst] ?? 0.2)));
export const FAMILY_ORDER = ['grit', 'filter', 'mod', 'rhythm', 'time', 'space'];
export const FAMILY_CAP = { filter: 1, grit: 1, mod: 2, rhythm: 1, time: 1, space: 1 };
export const PITCH_MOVERS = new Set(['tape-wow', 'vibrato', 'rotary', 'flanger']);
// effects that sound alike: one chain holds at most one of each group (a chorus and an ensemble are one colour twice)
export const SAME_KIND = [['chorus', 'ensemble'], ['phaser', 'flanger'], ['bitcrush', 'rate-reduce'], ['tremolo', 'trance-gate'], ['ring-mod', 'ring-shimmer']];
const kindOf = (k) => SAME_KIND.findIndex((g) => g.includes(k));
export const MIN_EXTRAS = 2;
export const MAX_EXTRAS = 4;
export const VOICE_TRIM = 0.95;
// THE LEVEL MATCH (lane MELODYFX2): a chain's dry and wet crossfades, its drive's cap and its low-passes cost a few
// dB. For the paths this lane chained, a post-chain trim puts the chained voice back at the level it played dry:
// each figure is the MEAN rms change over eight dealt chains, measured in Chromium (runs/melodyfx2/render.html
// levelSurvey) with VOICE_TRIM alone, so the trim is VOICE_TRIM x 10^(dB / 20). The house DJ's and the symphony's
// own chains keep VOICE_TRIM (their levels are lane MELODYFX's; the symphony's distorted flute measured +0.1 dB).
export const LEVEL_MATCH_DB = Object.freeze({
  'jam-pluck': 3.7, 'jam-bell': 2.5, 'jam-chord': 5.8, 'jam-vox': 1.9, 'jam-settle': 2.4, 'opener-bells': 5.9,
  'base:lead:keys': 5.9, 'base:lead:flute-drive': -1.9, 'base:arps': 5.0,
});
export const levelTrim = (db) => VOICE_TRIM * 10 ** ((Number.isFinite(db) ? db : 0) / 20);
const HAND = 7;

export const familyOf = (key) => rackOf(key)?.family ?? 'mod';

// the settle's lean: a theme's colours and an instrument's (positive suits, negative does not)
const THEME_TASTE = {
  crystals: { ensemble: 0.8, shimmer: 0.9, plate: 0.7, chorus: 0.6, vibrato: 0.4, 'ring-shimmer': 0.5, hall: 0.4, bitcrush: -0.6, 'rate-reduce': -0.5, 'soft-clip': -0.3 },
  highlands: { 'tape-wow': 0.7, ensemble: 0.6, 'warm-room': 0.7, 'tape-delay': 0.6, 'drift-filter': 0.5, tremolo: 0.3, 'tilt-eq': 0.3, hall: 0.3 },
  deepsea: { 'drift-filter': 0.9, 'tape-delay': 0.7, 'ping-pong': 0.6, phaser: 0.6, 'warm-room': 0.5, tremolo: 0.4, 'dub-echo': 0.8, 'lowpass-sweep': 0.5, comb: 0.3, bitcrush: -0.4 },
  cathedral: { plate: 1, 'warm-room': 0.6, ensemble: 0.6, 'drift-filter': 0.5, formant: 0.4, hall: 0.8, 'gated-reverb': -0.4, bitcrush: -0.7, 'ring-mod': -0.4 },
  embers: { 'rate-reduce': 0.7, bitcrush: 0.6, 'ring-mod': 0.4, 'tape-wow': 0.6, phaser: 0.5, flanger: 0.5, tremolo: 0.4, 'soft-clip': 0.5, wah: 0.4, 'trance-gate': 0.3 },
};
const INST_TASTE = {
  keys: { 'tape-wow': 0.9, tremolo: 0.7, 'warm-room': 0.7, 'drift-filter': 0.6, vibrato: 0.4, chorus: 0.4, wah: 0.3, 'tilt-eq': 0.3, shimmer: -0.3 },
  'flute-drive': { 'tape-delay': 0.7, 'drift-filter': 0.6, phaser: 0.5, 'warm-room': 0.4, 'dub-echo': 0.5, 'soft-clip': 0.3, vibrato: -0.5 },
  pluck: { 'ping-pong': 0.8, 'drift-filter': 0.6, chorus: 0.5, 'tape-delay': 0.4, 'auto-pan': 0.4, 'lowpass-sweep': 0.6, 'trance-gate': 0.4, comb: 0.3 },
  harp: { chorus: 0.5, 'warm-room': 0.6, 'tape-wow': 0.4, plate: 0.3, hall: 0.3 },
  bells: { plate: 0.6, shimmer: 0.5, 'ping-pong': 0.4, hall: 0.4, 'ring-shimmer': 0.3, 'ring-mod': -0.4, bitcrush: -0.3 },
  crystal: { shimmer: 0.6, plate: 0.5, ensemble: 0.4, 'ring-shimmer': 0.4, 'ring-mod': -0.5 },
  fiddle: { ensemble: 0.7, 'warm-room': 0.6, 'drift-filter': 0.4, hall: 0.5, flanger: -0.3 },
  // lane ECHOGUITAR: the guitar carries its own echo and room, so a second delay or a big reverb is pushed away
  'echo-guitar': { phaser: 0.6, 'tape-wow': 0.6, 'drift-filter': 0.5, chorus: 0.4, tremolo: 0.4, wah: 0.4, 'tape-delay': -1, 'dub-echo': -1, 'ping-pong': -1, hall: -0.8, plate: -0.6 },
  chop: { bitcrush: 0.6, 'rate-reduce': 0.6, 'tape-delay': 0.5, flanger: 0.4, 'tape-wow': 0.3, 'trance-gate': 0.5, 'gated-reverb': 0.4 },
  'opener-bells': { 'warm-room': 0.6, ensemble: 0.5, hall: 0.5, 'drift-filter': 0.4, tremolo: 0.3 },
  'jam-pluck': { 'ping-pong': 0.7, 'drift-filter': 0.5, chorus: 0.4, comb: 0.3, 'tape-delay': 0.4 },
  'jam-bell': { plate: 0.5, shimmer: 0.4, hall: 0.4, 'ring-shimmer': 0.3, bitcrush: -0.3 },
  'jam-chord': { chorus: 0.5, 'warm-room': 0.5, 'tape-wow': 0.5, tremolo: 0.4, 'drift-filter': 0.3 },
  'jam-vox': { formant: 0.6, 'ring-shimmer': 0.3, 'tape-delay': 0.4, phaser: 0.3 },
  'jam-settle': { shimmer: 0.5, plate: 0.4, 'drift-filter': 0.3, ensemble: 0.3 },
};
// lane DJGUITARS: the two psych guitars carry their own echo and room, so they lean as the echo guitar does (a second
// delay or a big reverb pushed away). They share its row and take the default warm drive: the site's first load had
// about 1 kB of room under its guard (tests/bundleslim.test.mjs), and a row of their own did not fit
INST_TASTE['fuzz-lead'] = INST_TASTE['phase-guitar'] = INST_TASTE['echo-guitar'];

export function voiceFit(key, { theme = 'highlands', inst = 'keys' } = {}) {
  return (THEME_TASTE[theme]?.[key] ?? 0) + (INST_TASTE[inst]?.[key] ?? 0);
}

// a small string hash (FNV-1a), so a key's settings come from its own stream
function hash(s) {
  let h = 0x811c9dc5;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
const step16 = (r) => Math.min(15, Math.floor(r() * 16)) / 15;
function tasteValue(spec, r) {
  if (spec && Array.isArray(spec.pick)) return spec.pick[Math.min(spec.pick.length - 1, Math.floor(r() * spec.pick.length))];
  const [lo, hi] = spec;
  return lo + (hi - lo) * step16(r);
}

export function swingOf(seed) {
  const r = deckRng((hash(`swing:${seed >>> 0}`) || 1) >>> 0);
  return [0, 0.04, 0.08, 0.12][Math.floor(r() * 4) % 4];
}

// the chain for one part, from the set's seed: the same seed, part index and keys always give the same numbers
export function realizeVoice(seed, slotIdx, { slot, inst, keys = [], profile = 'full' }) {
  if (CLEAN_INSTRUMENTS.has(inst)) return { slot, inst, keys: [], chain: [] };
  const P = profileOf(profile);
  const all = [SATURATOR, ...keys.filter((k) => k !== SATURATOR && VOICE_CHAIN_POOL[k] && P.pool.includes(k))];
  const chain = all.map((key) => {
    const r = deckRng((hash(`${seed >>> 0}:${slotIdx}:${key}`) || 1) >>> 0);
    const taste = key === SATURATOR ? (P.drive ?? DRIVE_TASTE[inst] ?? DRIVE_TASTE.default) : poolEntry(profile, key).taste;
    const raw = Object.fromEntries(Object.entries(taste).map(([n, sp]) => [n, tasteValue(sp, r)]));
    const params = paramValues(key, raw);
    const amount = key === SATURATOR ? 1 : (() => { const [lo, hi] = poolEntry(profile, key).amount; return lo + (hi - lo) * step16(r); })();
    return { key, amount, params };
  });
  const v = { slot, inst, keys: all.slice(1), chain };
  if (profile !== 'full') v.profile = profile;
  return v;
}

export function realizePalette(spec) {
  if (!spec) return null;
  const seed = spec.seed >>> 0;
  return {
    seed,
    swing: swingOf(seed),
    voices: (spec.voices ?? []).map((v) => realizeVoice(seed, slotIndex(v.slot), v)),
  };
}

// the specs a tag stores: the seed and, per part, the slot, the instrument and the extra keys (a profile other than
// 'full' rides along for the parts outside the tag)
export const specOf = (palette) => (palette ? { seed: palette.seed >>> 0, voices: palette.voices.map((v) => ({ slot: v.slot, inst: v.inst, keys: v.keys.slice(), ...(v.profile ? { profile: v.profile } : {}) })) } : null);

function settleHand(hand, { theme, inst, last, taken, r, pool = POOL_KEYS }) {
  const fit = hand.map((k) => voiceFit(k, { theme, inst }));
  const x = hand.map(() => (r() < 0.5 ? 1 : 0));
  const G = () => {
    let g = 0;
    let n = 0;
    const fam = {};
    let movers = 0;
    hand.forEach((k, i) => {
      if (!x[i]) return;
      n += 1;
      g -= fit[i];
      if (last.has(k)) g += 0.7;
      if (taken.has(k)) g += 1;
      const f = familyOf(k);
      fam[f] = (fam[f] ?? 0) + 1;
      if (PITCH_MOVERS.has(k)) movers += 1;
    });
    for (const [f, c] of Object.entries(fam)) g += 3 * Math.max(0, c - (FAMILY_CAP[f] ?? 1));
    g += 3 * Math.max(0, movers - 1);
    for (const grp of SAME_KIND) g += 3 * Math.max(0, grp.filter((k) => hand.includes(k) && x[hand.indexOf(k)]).length - 1);
    g += 0.4 * (n - 3) ** 2;
    return g;
  };
  const sweeps = 12;
  for (let s = 0; s < sweeps; s++) {
    const T = 2 * Math.pow(0.15 / 2, s / (sweeps - 1));
    for (let i = 0; i < hand.length; i++) {
      x[i] = 0;
      const g0 = G();
      x[i] = 1;
      const g1 = G();
      x[i] = r() < 1 / (1 + Math.exp((g1 - g0) / T)) ? 1 : 0;
    }
  }
  // the repair: keep the caps (drop the weakest offender), then at least MIN_EXTRAS and at most MAX_EXTRAS
  let chosen = hand.filter((_, i) => x[i]);
  const score = (k) => voiceFit(k, { theme, inst }) - (last.has(k) ? 0.7 : 0) - (taken.has(k) ? 1 : 0);
  const fits = (list, k) => {
    const f = familyOf(k);
    if (list.filter((c) => familyOf(c) === f).length >= (FAMILY_CAP[f] ?? 1)) return false;
    if (PITCH_MOVERS.has(k) && list.some((c) => PITCH_MOVERS.has(c))) return false;
    if (kindOf(k) >= 0 && list.some((c) => kindOf(c) === kindOf(k))) return false;
    return true;
  };
  const kept = [];
  for (const k of [...chosen].sort((a, b) => score(b) - score(a))) if (kept.length < MAX_EXTRAS && fits(kept, k)) kept.push(k);
  chosen = kept;
  const spare = [...hand, ...pool].filter((k, i, a) => a.indexOf(k) === i && !chosen.includes(k)).sort((a, b) => score(b) - score(a));
  for (const k of spare) { if (chosen.length >= MIN_EXTRAS) break; if (fits(chosen, k)) chosen.push(k); }
  return chosen.sort((a, b) => FAMILY_ORDER.indexOf(familyOf(a)) - FAMILY_ORDER.indexOf(familyOf(b)));
}

export function createVoiceDealer({ seed = 1 } = {}) {
  const r = deckRng(((Number(seed) >>> 0) ^ 0x6a09e667) >>> 0 || 1);
  const fxBags = new Map();
  const instBags = new Map();
  let last = null;
  const bagFor = (map, key, items) => {
    if (!map.has(key)) map.set(key, createBag(items, { random: r }));
    return map.get(key);
  };
  return {
    get last() { return last; },
    remember(palette) { last = palette ?? null; },
    // one set's palette: per part an instrument from its own bag and a hand of effects from its own bag, settled
    // opts.instruments overrides a part's instrument list (the symphony deals its tune on the two flutes);
    // opts.profile names the pool and its tastes (PROFILES: full, free, gentle)
    palette({ theme = 'highlands', slots = HOUSE_SLOTS, instruments = null, profile = 'full' } = {}) {
      const setSeed = (Math.floor(r() * 4294967296) >>> 0) || 1;
      const taken = new Set();
      const pool = profileOf(profile).pool;
      const voices = slots.map((slot) => {
        const list = instruments?.[slot] ?? SLOT_INSTRUMENTS[slot] ?? ['keys'];
        const inst = bagFor(instBags, `${list.join('|')}:${slot}`, list).next();
        if (CLEAN_INSTRUMENTS.has(inst)) return { slot, inst, keys: [] };
        const bag = bagFor(fxBags, `${profile}:${slot}`, pool);
        const hand = [];
        let guard = 0;
        while (hand.length < HAND && guard++ < 40) { const k = bag.next(); if (!hand.includes(k)) hand.push(k); }
        const before = new Set(last?.voices?.find((v) => v.slot === slot)?.keys ?? []);
        const keys = settleHand(hand, { theme, inst, last: before, taken, r, pool });
        for (const k of keys) taken.add(k);
        return profile === 'full' ? { slot, inst, keys } : { slot, inst, keys, profile };
      });
      const palette = realizePalette({ seed: setSeed, voices });
      last = palette;
      return palette;
    },
  };
}

// a tag written before the voice block (or a palette lost) gets one from its tune seed: fixed for that tag
export function paletteOfTune(seed, theme = 'highlands', slots = HOUSE_SLOTS) {
  return createVoiceDealer({ seed: ((Number(seed) >>> 0) ^ 0x51ed270b) >>> 0 || 1 }).palette({ theme, slots });
}

// the voice a part falls back to when no palette names it: the lead on the clear flute, every other part on the
// keys through the drive, a drifting low-pass and a warm room (still three effects)
export function defaultVoice(slot) {
  const inst = slot === 'lead' ? 'flute' : (SLOT_INSTRUMENTS[slot] ?? ['keys']).find((i) => !CLEAN_INSTRUMENTS.has(i)) ?? 'keys';
  return realizeVoice(1, slotIndex(slot), { slot, inst, keys: ['drift-filter', 'warm-room'], profile: OPENER_VOICE_SLOTS.includes(slot) ? 'gentle' : JAM_SLOTS.includes(slot) ? 'free' : 'full' });
}

export function chainLine(v, words = null) {
  if (!v) return '';
  // words is a function only when a caller passes one: as a map callback the second argument is the index
  const say = typeof words === 'function' ? words : (en) => en;
  const who = say(INST_LABEL[v.inst] ?? v.inst);
  if (!v.chain?.length) return `${who}: ${say('clear, no effects')}`;
  return `${who}: ${v.chain.map((c) => (rackOf(c.key)?.label ?? c.key).toLowerCase()).join(', ')}`;
}

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const signature = (v) => JSON.stringify([v?.inst, (v?.chain ?? []).map((c) => [c.key, c.amount, c.params])]);

// one part's live chain: the notes go into `input`; a new voice crossfades in over `fade` seconds at t0; `trim` is
// the gain after a chain (a number, or a function of the voice; VOICE_TRIM by default, at most 2.5)
export function createVoiceBus(ctx, out, { slot = 'lead', trim = VOICE_TRIM } = {}) {
  const trimOf = (voice) => Math.min(2.5, Math.max(0, Number(typeof trim === 'function' ? trim(voice) : trim) || 0));
  const input = ctx.createGain();
  // THE MUTE GATE (lane McKUSKER, melody.js): one gain after every chain, so a mute closes the voice and its tails at
  // once and a new chain crossfading in is born behind the same gate
  const gate = ctx.createGain();
  gate.connect(out);
  let isMuted = false;
  let cur = null; // { rack, fade, sig, voice }
  let dead = false;
  function build(voice, t0, fade) {
    // a context that cannot build a chain (an old browser without a WaveShaper) still plays the notes, dry
    let rack;
    try { rack = buildRack(ctx, voice.chain, { limiter: false }); } catch { rack = buildRack(ctx, [], { limiter: false }); }
    const trimNode = ctx.createGain();
    trimNode.gain.value = voice.chain.length ? trimOf(voice) : 1;
    const f = ctx.createGain();
    input.connect(rack.input);
    rack.output.connect(trimNode);
    trimNode.connect(f);
    f.connect(gate);
    at(f.gain, fade > 0 ? 0 : 1, t0);
    if (fade > 0) lin(f.gain, 1, t0 + fade);
    return { rack, trim: trimNode, fade: f, sig: signature(voice), voice };
  }
  function retire(old, t0, fade) {
    at(old.fade.gain, 1, t0);
    lin(old.fade.gain, 0, t0 + Math.max(0.01, fade));
    const id = setTimeout(() => {
      try { input.disconnect(old.rack.input); } catch { /* gone */ }
      old.rack.dispose();
      for (const n of [old.trim, old.fade]) try { n.disconnect(); } catch { /* gone */ }
    }, Math.max(0, (t0 - ctx.currentTime + fade) * 1000) + 300);
    id?.unref?.();
  }
  return {
    slot,
    input,
    get voice() { return cur?.voice ?? null; },
    get keys() { return cur ? cur.voice.chain.map((c) => c.key) : []; },
    get rack() { return cur?.rack ?? null; },
    get trim() { return cur?.trim.gain.value ?? null; },
    get muted() { return isMuted; },
    mute(on, t0 = ctx.currentTime, fade = 0.12) {
      if (dead) return;
      isMuted = !!on;
      const to = isMuted ? 0 : 1;
      try { gate.gain.cancelScheduledValues(t0); } catch { /* an old param */ }
      at(gate.gain, gate.gain.value, t0);
      if (fade > 0) lin(gate.gain, to, t0 + fade); else at(gate.gain, to, t0);
    },
    set(voice, t0 = ctx.currentTime, fade = 0.5) {
      if (dead || !voice) return;
      const sig = signature(voice);
      if (cur && cur.sig === sig) return;
      const old = cur;
      cur = build(voice, t0, old ? fade : 0);
      if (old) retire(old, t0, fade);
    },
    bar(t0, info) { cur?.rack.bar(t0, info); },
    dispose() {
      if (dead) return;
      dead = true;
      if (cur) { cur.rack.dispose(); for (const n of [cur.trim, cur.fade]) try { n.disconnect(); } catch { /* gone */ } }
      for (const n of [input, gate]) try { n.disconnect(); } catch { /* gone */ }
    },
  };
}

// a set of parts' buses, each built only when its part first plays (a track that is off runs no chain at all):
// .input(slot, t0) is where a note goes; .palette(P, t0, fade, info) moves every built bus to the palette's voice
export function createVoiceBuses(ctx, out, slots = HOUSE_SLOTS, { trim = VOICE_TRIM } = {}) {
  const buses = {};
  const muted = new Set();
  let P = null;
  let lastInfo = null;
  const voiceOf = (slot) => P?.voices?.find((v) => v.slot === slot) ?? defaultVoice(slot);
  return {
    get buses() { return buses; },
    get palette() { return P; },
    voiceOf,
    input(slot, t0 = ctx.currentTime) {
      if (!buses[slot]) {
        buses[slot] = createVoiceBus(ctx, out, { slot, trim });
        buses[slot].set(voiceOf(slot), t0, 0);
        if (muted.has(slot)) buses[slot].mute(true, t0, 0);
        if (lastInfo) buses[slot].bar(t0, lastInfo);
      }
      return buses[slot].input;
    },
    // a part's mute (lane McKUSKER): the built bus closes now, an unbuilt one is born closed
    mute(slot, on, t0 = ctx.currentTime, fade = 0.12) {
      if (on) muted.add(slot); else muted.delete(slot);
      buses[slot]?.mute(!!on, t0, fade);
    },
    muted: (slot) => muted.has(slot),
    palette(next, t0 = ctx.currentTime, fade = 0.5, info = null) {
      if (next) P = next;
      lastInfo = info ?? lastInfo;
      for (const [slot, b] of Object.entries(buses)) { b.set(voiceOf(slot), t0, fade); if (info) b.bar(t0, info); }
    },
    states() { return slots.map((slot) => ({ slot, built: !!buses[slot], inst: buses[slot]?.voice?.inst ?? null, keys: buses[slot]?.keys ?? [] })); },
    dispose() { for (const b of Object.values(buses)) b.dispose(); },
  };
}
