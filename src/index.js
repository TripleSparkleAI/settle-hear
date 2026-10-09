// settle-hear - SETTLE's hearing library: the sound of p-bits settling, mapped honestly from the physics.
//
// <claudes_code_comments>
// ** Function List **
// createHearing(opts) / hear(handle, opts) / activeHearings() - hear.js: one settle's sound
// soundEvery / soundAfter / configureSoundClock / soundClockKind - soundclock.js: THE SOUND CLOCK, a worker's tick
//   for every sound scheduler, so a hidden tab plays on as a visible one (lane DJSILENCE)
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
//   setMaster / getMaster / onMaster / levelGain / MASTER_DEFAULT / setReturn / isAway - engine.js: the one AudioContext, the mixer
// CLICK_NOISES / playClickNoise / armClickNoises / onClickNoise / clickBag - clicks.js: 24 click noises, a seeded bag
// DROP / DROP_PEAK_DB / DROP_CARDS / dropGainDb / playDropNoise / onDropSound - clicks.js: THE DROP, a dropped box sounds as one event; clickGainDb: a single click on the same level table
// HEARTBEAT / playHeartbeat / heartbeatPlan / renderPlan - heartbeat.js: THE BADUMP's heartbeat (lane HEROKEYS)
// CLICK_LOCK / createClickLock / lockRng - clicklock.js: the click lock (a cycle locked until a random 1 to 3 s quiet)
// SFX_FILES / sfxDecks / loadSfxModules / sfxLoaded / sfxById - sfx-decks.js: the four lane files found and dealt as
//   two decks of 50 (fetched on demand under vite since lane BUNDLESLIM)
// SFX / playSfx / sfxPage / armSfx / onSfx / createClickCards - sfx.js: the decks played: page load and change, one
//                                                              click lock in four, the machine's random waves
// PAGE_CHIME / pageChimes / pageChimeChange / playPageChime / loadPageChimes / addChimeVeto - pagechime.js: THE PAGE
//   CHIMES, one quiet chime per page change dealt by THE DECK RULE from pagechimes.js's 50 (fetched on demand)
// SOUND_PULSE / soundPulseShape / soundPulse / registerPulseTarget - pulse.js: the sound's answer to a radial pulse
// WOBBLE / createWobble / wobbleDepth / soundWobble / onSoundHit  - pulse.js: THE WOBBLE, the other direction (lane
//                                                               SOUNDSHAKE): the waves a visitor starts wobble THE DJ
// DUCK / duckGainAt / duckShape / duckDrop / duckTargets / onDuck - duck.js: THE DUCK (lane DROPDUCK), THE DJ dips
//                                                               3.5 dB for about 300 ms under every drag-box drop
// BANDS / createBandTap / createFollower / createOnsets / levelOf  - bands.js: the hero's low and high bands (SOUNDSHAKE)
// WEATHERS / WEATHER_KEYS / weatherOf / weatherCoeffs             - weather.js: THE WEATHER profiles THE DJ deals
// heat / flipFraction / crackleRate / settledness / dronePitch /
//   consonance / chordRatios / brightness / pulseCount / pulsePitch /
//   sparkleRate / heldLevel / soundParams / clamp01 / smooth   - map.js: physics to sound, pure
// loadEchoGuitar / echoGuitarNow / ECHO_PHRASE_COUNT           - echoguitar-lazy.js: THE ECHO GUITAR, on demand (lane
//   ECHOGUITAR); its voice, echo, room and phrases are echoguitar.js, imported by path, never from here
//   THE PSYCH GUITARS (lane DJGUITARS) ride in the same chunk: loadEchoGuitar() fetches djguitars.js, which re-exports
//   echoguitar.js; their voices, pedals and parts are djguitars.js, imported by path
// masterGrid / masterStartTime / snapToTick / quantizeBar /
//   lockGlide / toAudioTime / toMasterTime                     - masterbeat.js: THE MASTER BEAT on the audio clock
//
// ** Technical Review **
// - No dependencies. React parts are in settle-hear/react. settle-hear reads settle-see's stats stream; it never
//   imports settle-see, and settle-see never imports it, so each stands alone.
// </claudes_code_comments>

export { createHearing, hear, activeHearings, STALE_MS } from './hear.js';
export { SOUND_TICK_MS, configureSoundClock, soundEvery, soundAfter, soundClockKind, soundClockSteady } from './soundclock.js';
export { PRESETS, DEMOS, ALL, resolvePreset } from './presets.js';
export { VOICES, VOICE_NOTES, makeVoice } from './voices.js';
export { sound, createSwitch, readMuted, writeMuted, browserStorage, MUTE_KEY } from './control.js';
export { armUnlock, unlockNow, requestStart, gestureWaiting, GESTURE_EVENTS, FOCUS_KEYS, BLOCK_DECIDE_MS, getEngine, onEngine, configure, setMaster, getMaster, onMaster, levelGain, MASTER_DEFAULT, setReturn, createChannel, isAway, pageHalted, wantSound, holdSound, soundWanted, masterAnalyser } from './engine.js';
export * from './map.js';
export { CLICK_NOISES, CLICK_TONE, clickBag, playClickNoise, armClickNoises, onClickNoise, DROP, DROP_PEAK_DB, DROP_CARDS, dropGainDb, clickGainDb, playDropNoise, onDropSound } from './clicks.js';
// THE BADUMP's sound (lane HEROKEYS): two soft thumps and a tone in THE DJ's key, on the next flash line
export { HEARTBEAT, heartbeatKey, heartbeatPlan, renderPlan, playHeartbeat } from './heartbeat.js';
export { CLICK_LOCK, lockRng, createClickLock } from './clicklock.js';
// THE SFX DECKS (lane SWORDSWISH and the ANIMESFX lanes): two decks of 50, the sword deck and the radial deck, and
// their triggers: the page load and page change, one radial click lock in four, the machine's random waves
export { SFX_FILES, SFX_DECKS, sfxDecks, loadSfxModules, sfxLoaded, sfxById } from './sfx-decks.js';
export { SFX, shareDeck, sfxBag, nextSfx, playSfx, createClickCards, sfxPage, armSfx, onSfx, resetSfx } from './sfx.js';
// THE PAGE CHIMES (lane PAGECHIMES): 50 quiet chimes, one per page change; the table itself (pagechimes.js) loads on
// demand through loadPageChimes() and is never in this index
export { PAGE_CHIME, CHIME_KEY, readChimesOn, writeChimesOn, createChimeSwitch, pageChimes, addChimeVeto, loadPageChimes, chimesLoaded, chimeRefusal, playPageChime, pageChimeChange, onPageChime, resetPageChimes } from './pagechime.js';
// THE SOUND'S ANSWER TO A RADIAL PULSE (lane RADIALPULSE): every playing channel brightens, swells and pans toward a
// passing wave, within the limits; the page hands it the bus's wave
export { SOUND_PULSE, soundPulseShape, pulseNodes, registerPulseTarget, pulseTargets, applyPulse, soundPulse, onPulseTargets, WOBBLE, wobbleEnvelope, wobbleDepth, createWobble, registerWobbleTarget, soundWobble, wobbleLevel, wobbleTargets, soundHit, onSoundHit } from './pulse.js';
// THE SOUND AND THE PICTURE (lane SOUNDSHAKE): the hero's two bands, and THE WEATHER profiles THE DJ deals
// THE DUCK (lane DROPDUCK): a drop dips THE DJ's bus, the way radio ducks the music under the host
export { DUCK, MACHINE_FROM, duckGainAt, duckShape, scheduleDuck, registerDuckTarget, duckTargets, duckGain, registerDuckChannel, duckChannels, duckDrop, onDuck } from './duck.js';
export { BANDS, levelOf, rmsOf, createFollower, createOnsets, createBandTap } from './bands.js';
export { WEATHER_PARTS, WEATHERS, WEATHER_KEYS, HELD_WEATHER, weatherOf, weatherCoeffs } from './weather.js';
export { GAMMA_BEAT, CARRIERS, GAMMA_SOUNDS, gammaSound, gammaCarrierOf, binauralPair, pulseTrain, pinkNoise, onsets, createGammaSound, activeGammaSounds } from './binaural.js';
// THE BINAURAL MODES (lane BINAURALMODES): the popular beats and carriers, one table; the tone rules; the vocoder
// and the ring modulator
export { BINAURAL_MODES, MODE_KEYS, MODE_CYCLE, modeOf, isMode, modePair, modeTrackTag, modeOfTrackTag, modeTrackName } from './modes.js';
export { createBag, indexDeck, bagSequence, deckRng, freshSeed } from './deck.js'; // THE DECK RULE (copy of settle-see's deck.js)
export { TONE, LEVELS, dbToGain, gainToDb, softEnvelope, gentleDetune } from './tone.js';
export { VOCODER, vocoderBands, createVocoder, createRingMod } from './vocoder.js';
export { HERO_INPUT, heroBus, feedHeroInput, readHeroInput, onHeroInput, heroNudge } from './heroinput.js';
// the hero symphony (lane SYMPHONY): tuning at A = 432, the ABC reader, the tunes, the five themes, the DJ, the
// instruments and the player
export * from './symphony-index.js';
// THE ECHO GUITAR (lane ECHOGUITAR): an electric guitar of our own, loaded on demand so the site's first load does not
// carry it; a static re-export here would pull echoguitar.js into every bundle that imports this index
export { loadEchoGuitar, echoGuitarNow, ECHO_PHRASE_COUNT } from './echoguitar-lazy.js';
// THE MASTER BEAT, heard (lane MASTERBEAT): the page's one grid mapped onto the audio clock
export { MASTER_GRID, masterGrid, masterNow, nextLine, audioOffsetMs, toAudioTime, toMasterTime, masterStartTime, nextMasterBar, snapToTick, quantizeBar, lockGlide, beatPhaseError } from './masterbeat.js';
export { configureSoundLog, soundLog, soundLogOn, soundLogTail, flushSoundLog } from './soundlog.js'; // SOUNDLOG
// THE BASES (lane HOUSEBASES): house and ambient rhythm beds in our own format, the importer, the library, slicing
// and combining, the player, the melody over a base, and the DJ hook
export * from './bases/index.js';
