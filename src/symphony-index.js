// settle-hear · symphony-index - one export line for everything the hero symphony adds, so src/index.js changes by
// one line only (other lanes edit that file too).
export { A4, BEAT_HOME, FLUTE_MODE_NAME, FLUTE_MODE_ALIAS, FLUTE_SOUND_NAME, MCKUSKER_MODE_NAME, midiHz, noteHz, noteMidi, pitchClass, MODES, scaleMidi, harmonics, binaural, clampBeat } from './tuning.js';
export { parseAbc, keyAccidentals, tuneBeats } from './abc.js';
export { TUNES, tuneProblems, playableTunes, tunesFor, placeTune, generatedPhrase, createTuneDealer } from './tunes.js';
export { THEMES, THEME_KEYS, themeOf, INSTRUMENTS } from './themes.js';
export { DJ_CHOICES, DJ_PULLS, SWEEPS, T_HOT, T_COLD, rng, readHero, leans, anneal, pickTheme, pickBeat, pickSplit, createDJ, createThemeDealer, createBeatDealer } from './dj.js';
export { INSTRUMENT_KEYS, playNote, makeDrone, makeHarmonics, makeBinaural } from './instruments.js';
export { TRACKS, MINOR_MODES, rootMidiOf, carrierOf, createSymphony } from './symphony.js';
// the house set and the spectrum settle (lane HOUSEDJ): the passes (35 now), their bag and chain, the house set player,
// the spectrum bars and the live source the hero settles toward
export { HOUSE, PASSES, PASS_KEYS, passOf, graph, tanhCurve, crushCurve, absCurve, createPassBag, fillChain, chainCost, houseSwap, progression, buildChain, strike } from './house.js';
export { createHouseSet, houseBpm } from './houseset.js';
export { SPECTRUM, SPECTRUM_STYLES, bandEdges, barOf, byteOfDb, barLevels, createBars, isSilent, bassLevel, spectrumBits } from './spectrum.js';
export { createSpectrumSource, spectrum, spectrumTarget, houseLive } from './spectrumlive.js';
export { djPopupStep, djInside, djRoom, djHeadline, traceColumns } from './popup.js';
// THE DJ's public state, read only (lane FEEDBACKRL): what plays now, for the ratings popup
export { DJ_IDLE, djSnapshot, djLive } from './djlive.js';
// 432 Hz McKUSKER MODE (lane McKUSKER): whether the flute plays the melody now, and its one mute
export { MCKUSKER_VOICES, MELODY_FADE, isMcKuskerVoice, melodyOf, melodyMute } from './melody.js';
// THE STEERING (lane RATELOOK): the visitor's hand on the automatic DJ, applied once a bar
export { STEER_IDLE, STEER_BEATS, STEER_THEMES, STEER_TRACKS, djSteer, isIdleSteer, applySteer } from './steer.js';
export { STEER_LEAN } from './dj.js';
// THE JAM (lane INSTRUMENTS): ten instruments to hit in the DJ's key, quantised to the master beat, and one looper
export { JAM_KIT, JAM_KEYS, LOOP_BARS, jamKey, jamNotes, jamCall, sixteenthMs, quantiseHit, createLooper, createJam, playJamHit, playOnEngine, JAM_TONAL, createJamVoices, jamVoices } from './jam.js';
// THE LAYERS (lane LOOPLAYERS): many loops stacked as lines, stretched by bars, faded by a timer or by THE DJ; your track and its vote window
export { LAYER_BARS, LAYER_MAX, TAKE_BARS, TIMER_BARS, DJ_FADE, tileEvents, layerEvent, createLayerStack, createLoopJam } from './layers.js';
export { VOTE_WINDOW_MS, COOL_MS, BLOOM_MS, createYourTrack, listenSets } from './yourtrack.js';
// THE SETTLE DJ (lane SETTLEDJ): the composer, the planner, the mix machine, the rack, the house brain and its
// layers, the tag and its replay, the votes, the influence window, the fx modules and the voice machines
export { COMPOSER, composeTune, tuneToAbc, longestCopy, readSource, transitionModel, motifOf, barBeatsOf, composeMode } from './tune-composer.js';
export { SECTIONS, SECTION_KEYS, sectionOf, PLANNER, ARC, arcTarget, TRANSITION_FX, enumeratePlans, planCost, settlePlans, chooseFx, createPlanner } from './mix-planner.js';
export { MIX_CHOICES, MIX_KEYS, MIX_PULLS, SECTION_LEANS, MIX_STEER, mixLeans, settleBits, energyOf, createMixMachine } from './mix-machine.js';
export { RACK, RACK_KEYS, rackOf, paramValues, buildRack, rackRows, passRange, VOICE_FX, CHAIN_KINDS } from './mix-rack.js';
// THE VOICE CHAINS (lane MELODYFX): every melodic instrument but the clear flute through its own chain
export { VOICE_SLOTS, HOUSE_SLOTS, SYMPHONY_SLOTS, SYMPHONY_INSTRUMENTS, OPENER_VOICE_SLOTS, JAM_SLOTS, ALL_SLOTS, slotIndex, POOL_EXCLUDED, CLOCKED_KEYS, GENTLE_POOL, PROFILES, SLOT_INSTRUMENTS, INST_ALPHABET, CLEAN_INSTRUMENTS, INST_LABEL, REGISTER, SATURATOR, VOICE_CHAIN_POOL, POOL_KEYS, DRIVE_TASTE, LEVEL_MATCH_DB, levelTrim, FAMILY_CAP, PITCH_MOVERS, SAME_KIND, MIN_EXTRAS, MAX_EXTRAS, VOICE_TRIM, INST_PEAK, velocityFor, voiceFit, realizeVoice, realizePalette, specOf, swingOf, createVoiceDealer, paletteOfTune, defaultVoice, chainLine, createVoiceBus, createVoiceBuses } from './voice-fx.js';
export { warmDrive, driveCurve, HEADROOM } from './fx-warm-drive.js';
export { VOICE_MODS, tapeWow, driftFilter, ensemble, vibrato, tremolo, warmRoom } from './fx-voice-mods.js';
export { octaveShift, swingAt, LEAD_LIFT, arpVelocity, answerVelocity } from './mix-layers.js';
export { createHouseDJ, composeFrom, humChoice, createHumDealer, THEME_DRUMS, THEME_BASS, SECTION_AMOUNT } from './mix-dj.js';
export { createMixSet, MIX_LEVELS } from './mix-layers.js';
// THE TRAINED DJ (lane DJWIRE): sets composed from THE DJ's trained models (GRIDLEARN stages 1 and 2), their planner,
// their drums, and which DJ plays
export { FAMILIES as TRAINED_FAMILIES, loadTrainedModels, settleTrainedSet, lineKind, blockContext, gateFields, gridFields, mergeFields, phraseFields, grooveUnpack, barContext, levelDigit } from './dj-trained.js';
export { THEME_FAMILY, FAMILY_STYLE, HUM_BARS, TRAINED_LAYERS, layersOf, sectionsOf, dropsOf, exitsOf, movesOf, barOf as trainedBarOf, createTrainedPlanner } from './dj-trained-plan.js';
export { playTrainedDrums, trainedJitter, stepTime as trainedStepTime, hitFor as trainedHitFor } from './dj-trained-play.js';
export { DJ_BRAINS, djBrain, createBrainStore } from './dj-brain.js';
export { PIECE_FORMAT, GM_ROLE, NOTE_ROLES, isPiece, shiftTo, pieceToSet, notesOfBar, pieceMode, pieceRoot, chordOfBar, leadOfBar } from './dj-trained-notes.js'; // stage 3's seam (lane DJNOTES; lane PIECESPLAY)
export { loadPieceIndex, loadPiece, pieceLoads, resetPieceLoads } from './dj-pieces.js'; // the pieces, one at a time (lane PIECESPLAY)
export { SETTLE_CARD, PIECE_WAIT_BARS, PIECE_ONLY_FAMILIES } from './mix-dj.js';
export { TRAINED_LEAN } from './mix-machine.js';
export { bassTurn } from './mix-layers.js';
export { TAG_VERSION, TAG_FX_ALPHABET, encodeTag, decodeTag, tagLines, tuneHash, situationOf, themeCode } from './dj-tag.js';
export { playTag, barNotes, djTagRequests } from './dj-replay.js';
export { SKIP, djSkipRequests, nextSet, replaySet, setIdOf, isNewSet, createSetHistory } from './dj-skip.js'; // lane DJSKIP
export { VIEW_FORMAT, setView, grooveView, tuneView, barOfSet } from './dj-view.js'; // THE SET SEEN WHOLE (lane DJVISUAL)
export { djVotes, votesFromTags, VOTE_LEAN } from './dj-votes.js';
export { INFLUENCE, makeInfluence, influenceWeights, blendInfluence, createInfluenceWindow, describeInfluence } from './dj-influence.js';
export { FX, FX_KEYS, fxOf } from './fx-index.js';
export { HUM_RATES, HUM_MAX_LEVEL, HUM_VARIANTS } from './fx-hum.js';
export { DRUM_KITS, DRUM_FAMILIES, DRUM_PATTERNS, playPattern } from './voice-drum-machines.js';
export { ACID, acidLine, playAcidBar } from './voice-acid.js';
export { renderPhrase, chopBar, CHOP_PATTERNS } from './voice-chop.js';
export { STEER_MIX, STEER_FX } from './steer.js';
// THE DJ'S DESK (lane DJFX): the moods, the settle's flavour, the overdo and the effect bus the hero symphony drives
export { MOODS, MOOD_KEYS, moodOf, DRY, PHRASE_BARS, MOOD_PHRASES, DRIVE_MODES, RES_BANDS, RES_QS, settleFlavour, OVERDO_KINDS, OVERDO, FEEDBACK_CAP, CAPS, clampFx, fxValues, createDjFx, curveFor, DRIVE_REF, driveMakeup, trimFor, BUS_LIMIT, limiterMakeupDb, TAU as FX_TAU, WOBBLE_STAGE, createFxBus, OVERDRIVE_MOOD, DEALT_MOODS, OVERDRIVE_DECK, VOICE_DRIVE_DECK, PURE_DRIVE_DECK, VOCODER_DECK, VOCODER_VOICE_DECK, voiceDriveOf, vocoderOf } from './dj-fx.js';
// THE DJ's OVERDRIVE AND VOCODER (lane DJOVERDRIVE)
// the light half only: the valve, the vocoder and the colour stage are dj-colour-stage.js, loaded on demand and imported
// by path, never from here (a static re-export would pull them into every bundle that imports this index)
export { loadColour, colourNow, colourBuses, SLOT_WORDS, colourWords } from './dj-colour.js';
// THE OPENING BLEND (lane OPENINGSET): the visit's first set, never house; its arc, its settle, its voices and its tag
export { OPENER, OPENER_SLOTS, SLOT_KEYS, OPENER_RATES, RATE_KEYS, GAMMA_RATE, GAMMA_SOURCE, RATE_ORDERS, OPENER_TIMBRES, TIMBRE_KEYS, settlePick, settleOpener, openerPlan, envAt, openerSlotAt, pulseShape, isoSamples, maxStep, openerVoices, openerBellVoice, openerVisit, resetOpenerVisit, readOpenerMemory, writeOpenerMemory } from './opener.js';
export { OPEN_TAG_RE, isOpenerTag, encodeOpenerTag, decodeOpenerTag, openerTagLines } from './opener-tag.js';
