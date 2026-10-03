// settle-hear - SETTLE's hearing library: the sound of p-bits settling, mapped honestly from the physics.
//
// <claudes_code_comments>
// ** Function List **
// createHearing(opts) / hear(handle, opts) / activeHearings() - hear.js: one settle's sound
// PRESETS / DEMOS / ALL / resolvePreset                        - presets.js: named mixes
// createGammaSound / GAMMA_SOUNDS / CARRIERS / binauralPair /
//   pulseTrain / pinkNoise / onsets / GAMMA_BEAT                - binaural.js: 40 Hz gamma sound (binaural, isochronic)
// BINAURAL_MODES / MODE_KEYS / MODE_CYCLE / modeOf / modePair   - modes.js: the popular binaural modes, one table
// TONE / LEVELS / softEnvelope / gentleDetune                   - tone.js: the tone rules as constants
// createBag / bagSequence / deckRng / freshSeed                  - deck.js: THE DECK RULE (a copy of settle-see's)
// createVocoder / createRingMod / VOCODER                       - vocoder.js: the channel vocoder, the ring modulator
// HERO_INPUT / heroBus / feedHeroInput / onHeroInput / heroNudge - heroinput.js: the one bus every mode plugs the hero into
// VOICES / VOICE_NOTES / makeVoice                             - voices.js: the seven voices
// sound / createSwitch / readMuted / writeMuted / MUTE_KEY     - control.js: the page-wide mute (remembered)
// armUnlock / unlockNow / requestStart / gestureWaiting / getEngine / onEngine / configure /
//   setMaster / getMaster / setReturn / isAway                 - engine.js: the one AudioContext, the mixer
// CLICK_NOISES / playClickNoise / armClickNoises / onClickNoise / clickBag - clicks.js: 24 click noises, a seeded bag
// CLICK_LOCK / createClickLock / lockRng - clicklock.js: the click lock (a cycle locked until a random 1 to 3 s quiet)
// SOUND_PULSE / soundPulseShape / soundPulse / registerPulseTarget - pulse.js: the sound's answer to a radial pulse
// heat / flipFraction / crackleRate / settledness / dronePitch /
//   consonance / chordRatios / brightness / pulseCount / pulsePitch /
//   sparkleRate / heldLevel / soundParams / clamp01 / smooth   - map.js: physics to sound, pure
// masterGrid / masterStartTime / snapToTick / quantizeBar /
//   lockGlide / toAudioTime / toMasterTime                     - masterbeat.js: THE MASTER BEAT on the audio clock
//
// ** Technical Review **
// - No dependencies. React parts are in settle-hear/react. settle-hear reads settle-see's stats stream; it never
//   imports settle-see, and settle-see never imports it, so each stands alone.
// </claudes_code_comments>

export { createHearing, hear, activeHearings, STALE_MS } from './hear.js';
export { PRESETS, DEMOS, ALL, resolvePreset } from './presets.js';
export { VOICES, VOICE_NOTES, makeVoice } from './voices.js';
export { sound, createSwitch, readMuted, writeMuted, browserStorage, MUTE_KEY } from './control.js';
export { armUnlock, unlockNow, requestStart, gestureWaiting, GESTURE_EVENTS, FOCUS_KEYS, BLOCK_DECIDE_MS, getEngine, onEngine, configure, setMaster, getMaster, setReturn, createChannel, isAway, pageHalted, wantSound, holdSound, soundWanted, masterAnalyser } from './engine.js';
export * from './map.js';
export { CLICK_NOISES, CLICK_TONE, clickBag, playClickNoise, armClickNoises, onClickNoise } from './clicks.js';
export { CLICK_LOCK, lockRng, createClickLock } from './clicklock.js';
// THE SOUND'S ANSWER TO A RADIAL PULSE (lane RADIALPULSE): every playing channel brightens, swells and pans toward a
// passing wave, within the limits; the page hands it the bus's wave
export { SOUND_PULSE, soundPulseShape, pulseNodes, registerPulseTarget, pulseTargets, applyPulse, soundPulse } from './pulse.js';
export { GAMMA_BEAT, CARRIERS, GAMMA_SOUNDS, gammaSound, gammaCarrierOf, binauralPair, pulseTrain, pinkNoise, onsets, createGammaSound, activeGammaSounds } from './binaural.js';
// THE BINAURAL MODES (lane BINAURALMODES): the popular beats and carriers, one table; the tone rules; the vocoder
// and the ring modulator
export { BINAURAL_MODES, MODE_KEYS, MODE_CYCLE, modeOf, isMode, modePair } from './modes.js';
export { createBag, indexDeck, bagSequence, deckRng, freshSeed } from './deck.js'; // THE DECK RULE (copy of settle-see's deck.js)
export { TONE, LEVELS, dbToGain, gainToDb, softEnvelope, gentleDetune } from './tone.js';
export { VOCODER, vocoderBands, createVocoder, createRingMod } from './vocoder.js';
export { HERO_INPUT, heroBus, feedHeroInput, readHeroInput, onHeroInput, heroNudge } from './heroinput.js';
// the hero symphony (lane SYMPHONY): tuning at A = 432, the ABC reader, the tunes, the five themes, the DJ, the
// instruments and the player
export * from './symphony-index.js';
// THE MASTER BEAT, heard (lane MASTERBEAT): the page's one grid mapped onto the audio clock
export { MASTER_GRID, masterGrid, masterNow, nextLine, audioOffsetMs, toAudioTime, toMasterTime, masterStartTime, nextMasterBar, snapToTick, quantizeBar, lockGlide, beatPhaseError } from './masterbeat.js';
export { configureSoundLog, soundLog, soundLogOn, soundLogTail, flushSoundLog } from './soundlog.js'; // SOUNDLOG
// THE BASES (lane HOUSEBASES): house and ambient rhythm beds in our own format, the importer, the library, slicing
// and combining, the player, the melody over a base, and the DJ hook
export * from './bases/index.js';
