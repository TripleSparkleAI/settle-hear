// settle-hear · bases/index - THE BASES (lane HOUSEBASES): house and ambient rhythm beds in our own format, the
// MIDI importer that makes them, the library the DJ chooses from, the slicing and combining rules, the player, the
// melody-over-base filters and the DJ hook. The library files live in settle-hear/bases/ (index.json, base-NNNN.json,
// ledger.json) and are built by tools/bases_build.mjs; nothing here reads a MIDI file at run time.
export { BASE_FORMAT, PARTS, DRUM_PARTS, PITCHED_PARTS, KINDS, FAMILIES, ALL_FAMILIES, ORIGINS, beatsPerBar, ticksPerBar, eventBar, validateBase, isBase, compatible, relativeKey } from './base-format.js';
export { partFeatures, syncopationOf, keyOf, KEY_PROFILES, PC_NAMES, fourFloorOf, backbeatOf, familyOf, kindOf, signatureOf, swingFromOffsets } from './base-features.js';
export { parseMidi, readVarLen, GM_DRUMS, GM_ROLE, gmRole } from './midi.js';
export { IMPORT_DEFAULTS, rolesOf, quantiseNotes, windowOf, importMidi, numberBase } from './base-import.js';
export { slice, transposeSlice, loopSlice, rescaleSlice, sliceBarOf, combine } from './base-slice.js';
export { FEATURE_WEIGHTS, featureCost, settleIndex, balanceOf, createLibrary, indexRow, rowAsBase, readIndex, loaderFor } from './base-library.js';
export { HOUSE_RECIPES, AMBIENT_RECIPES, CHORD_LOOPS, RECIPE_NOTES, AUTHOR_VERSION, AUTHORED_FAMILIES, rowToEvents, chordNotes, authorHouse, authorAmbient, authorBase } from './base-author.js';
export { PART_LEVELS, DRUM_VOICE_OF, defaultKit, playBasePart, playBaseBar, melodyOverBase, gateNotesToBase, BASE_VOICE_SLOTS, createBaseVoices } from './base-play.js';
export { SECTION_WANT, wantFromDecision, planFromWant, melodyPlan, createBaseDJ } from './base-dj.js';
