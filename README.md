# settle-hear

SETTLE's hearing library. It makes sound from a settle's own numbers, the stats that settle-see reports every few
frames. It has no dependencies and sits beside settle-see; settle-see never imports it. React parts are in
`settle-hear/react`.

```jsx
import { HearSettle, MuteAllButton } from 'settle-hear/react';

<HearSettle hear="chime" shape="star" neon="lean" height={240} />   // a <Settle> with sound; every Settle prop works
<MuteAllButton pulse />                                              // the site-wide mute, for a page header
```

```js
import { settle } from 'settle-see';
import { hear } from 'settle-hear';

const handle = settle(canvas, { shape: 'heart' });
const sound = hear(handle, { preset: 'choir' });   // polls handle.stats() and the pointer's held trail
sound.stop(); sound.play(); sound.dispose();
```

## Get it

```sh
git clone https://github.com/triplesparkle/settle-hear
cd settle-hear
npm test
```

Or add it to an app from its repository: `npm install github:triplesparkle/settle-hear`. The repository is
private for now, so both need access until it is made public. It has no dependencies; React is an optional peer.
One test compares `src/deck.js` with settle-see's copy; it runs when a clone of settle-see sits beside this
folder and is skipped otherwise.

## What each sound means

Every value goes through `src/map.js`, a file of pure functions with no audio in it. `tests/map.test.mjs` checks each
one is clamped, never NaN, and monotone in the direction stated here.

| voice | follows | how |
|---|---|---|
| `hiss` | temperature T | loudness grows as heat^1.5, where heat = (ln T - ln 0.45) / (ln 3 - ln 0.45), clamped to 0..1 (the schedule cools geometrically, so equal times of cooling are equal steps); a bandpass centred at 200 Hz + 0.8 x a cutoff that runs from 300 Hz (cold) to 6 kHz (hot), so about 440 Hz to 5 kHz |
| `crackle` | flips per sweep | grains of noise a second = 60 x (flips / n / 0.5)^0.6; an infinitely hot p-bit flips half the time, so 0.5 is the most |
| `drone` | energy per light | pitch = 55 x 2^(1 - s) Hz, where s = -E per light / (lean + 2 pull) is how far the energy has fallen toward the floor of a field that agrees with its target and its neighbours; it sinks one octave as the field settles; its brightness follows the heat |
| `choir` | overlap q with the stored picture | a smoothstep of q from 0.25 to 0.95 moves four voices, in log frequency, from a cluster (1, 17/16, 45/32, 15/8) to a major chord (1, 5/4, 3/2, 2); it also grows louder as it resolves |
| `chime` | the schedule | a bell chord when the phase becomes `settled` (the picture has landed), a soft ping when the target changes |
| `pulse` | click power | a click of power p sends p blips, each a whole tone above the last, the first a semitone higher per level; a sweep at full power |
| `sparkle` | the pointer's held trail | glints a second = 30 x sqrt(held), where held is the mean hold on the field (or, in React, a level fed by pointer moves that decays by 0.82 a frame) |

A hearing falls quiet when its stats stop for 0.9 s (the picture is paused, scrolled off screen, or drawn still under
reduced motion) and returns with the next frame. The sound never describes a picture that is not moving. When the
page halted the picture (a hidden tab, or 5 minutes with nobody there) the hearing holds its last sound instead, so the
sound plays on in the background like a video (lane SOUNDDOCTOR).

## Presets and demo setups

| name | voices | sound |
|---|---|---|
| `crackle` | crackle, hiss, pulse, sparkle | the noise you can count |
| `choir` | choir, chime, sparkle | a chord that resolves as the picture forms |
| `drone` | drone, hiss, pulse | the energy as a falling tone |
| `chime` | chime, sparkle, pulse | bells at each landing, echoed |
| `pulse` | pulse, crackle | click power as rising pulses |
| `hero` | all seven | the loudest and fullest; the home page's |
| `geiger` | crackle | a dry counter |
| `cathedral` | choir, drone, chime | a long hall |
| `arcade` | pulse, chime, sparkle, crackle | a long echo, made for clicking |
| `ambient` | drone, choir, hiss | quiet, nothing sharp |
| `whisper` | hiss, sparkle | the quietest |

A preset is `{ note, voices: { name: 0..1 }, fx: { reverb, delay, filter }, level }`; pass an object to `hear` or
`createHearing` for a custom mix.

## The mixer and the effects

- One `AudioContext` for the whole page. THE START RULE (lane AUTOSTART): `armUnlock()` tries to start the sound on
  page load and the browser decides, read from `ctx.state === 'running'` (and from `navigator.getAutoplayPolicy`
  where it exists, so a `disallowed` answer builds nothing). Allowed, the sound plays with no click. Refused within
  `BLOCK_DECIDE_MS` (250 ms), the switch turns `blocked` and one window listener (`GESTURE_EVENTS`: pointerdown,
  pointerup, keydown, touchend, click) starts it on the first real gesture; it stays armed until the context runs, so
  a touch's non-activating pointerdown cannot lose the tap. Tab, the modifier keys and Escape (`FOCUS_KEYS`) start
  nothing, so a keyboard visitor can reach a "click to play" control and read it first. A saved mute builds nothing and starts nothing; the unmute
  click starts it. `requestStart()` is the call for a "start the sound" control.
- Each hearing is a channel: its voices into a lowpass (`filter`), a fader (`level`), and two sends.
- Shared effects: a convolution reverb (a generated 2.4 s impulse, decorrelated stereo noise under an exponential
  decay) and a feedback delay (320 ms, feedback 0.35, a 2.6 kHz lowpass in the loop).
- The master chain: master gain (0.8 by default, clamped to 1), the mute gain, a DynamicsCompressor set as a limiter
  (threshold -14 dB, ratio 20, attack 2 ms), and a safety gain of 0.9. Nothing can clip.
- Every channel fades in over about 1.5 s. THE BACKGROUND RULE (lane SOUNDDOCTOR): the sound plays on in a hidden
  tab and for an idle reader. Three things stop it, and each suspends the context so the tab is never a silent
  "playing audio" entry: MUTE ALL (fades out in about 0.15 s), PAUSE ALL, and nothing to hear (no channel playing,
  suspended after 1.5 s). A suspend or an interruption the page did not ask for (the system, another app, a device
  change) is resumed at once, or on the next click if the browser refuses.
- Voices exist only while a hearing sounds: a stopped one frees them after its fade, a quiet one after 5 s. A page of
  stopped settles runs no oscillators.
- No per-sample JavaScript: oscillators, filters and buffer sources steered by `setTargetAtTime` at the stats rate.
  Grain voices are scheduled 120 ms ahead by one shared 60 ms timer, capped at 12 grains a tick.

## The site-wide switch

`sound` (from `src/control.js`) is the page's one switch. Sound is on by default. `sound.setMuted(true)` mutes every
hearing and is remembered in `localStorage` under `settle-hear:muted`, the only key settle-hear writes. Every storage
access is wrapped in try/catch: in a private window the switch still works for the visit. The unlock is never
remembered. `sound.blocked` is true while the browser holds the sound back before its first start; `MuteAllButton`
then pulses in the prime red (`--hear-wait`), shows "sound waits for your first click" on hover and focus, and says it
once in a polite live region (labels `titleBlocked`, `tipBlocked`, `liveBlocked`).

## React

| part | what it is |
|---|---|
| `HearSettle` | `<Settle>` with sound. `hear` (a preset name or object, or false), `hearLevel`, `hearLabel`, `hearControl` (`'bottom-right'`, `'top-left'`, ... or false), `hearPlaying` with `onHearToggle(next)` to control it. Every other prop goes to `<Settle>` |
| `useHear(preset, opts)` | `{ hearing, state, onStats, onPointerMove, toggle }` for any component that reports settle stats |
| `HearToggle` | a settle's own play/stop button: a neon speaker, `aria-pressed`, a plain label |
| `MuteAllButton` | MUTE ALL for a header; `pulse` makes it beat |
| `HearMixer`, `MasterFader` | sliders for one hearing's voices and sends, and the master level |
| `useSound()` | the switch as React state |

Pressing a settle's play button while the site is muted unmutes the site, because the press asks to hear it. Under
`prefers-reduced-motion` a hearing starts stopped and the pulse becomes a still outline.

Colours are CSS variables: `--hear-on` (default `--neon-yes`), `--hear-off` (`--neon-no`), `--hear-mute`
(`--neon-miss`). Set them to retheme the controls.

## Adding sound to a settle on the site

Where a page has `<Settle ... />` from `settle-see/react`, swap the import and the tag:

```jsx
import { HearSettle } from 'settle-hear/react';
<HearSettle hear="whisper" hearLabel="the memory picture" shape="sdm" ... />
```

Pick a quiet setup (`whisper`, `ambient`, `geiger`) for a page's secondary pictures; `hero` is the home page's. A
page with several sounding pictures should make them controlled (`hearPlaying` + `onHearToggle`) so one sounds at a
time, as `#/hear` does. A canvas that is not a `<Settle>` can sound too: call `useHear(preset).onStats(stats)` with
an object carrying `T`, `flips`, `n`, `ePer`, `q`, `phase`, `index` and `power`.

## 40 Hz gamma sound (binaural.js)

`createGammaSound({ mode, carrier, level })` plays a 40 Hz sound through the page's engine, so MUTE ALL silences it
and nothing in it can unmute. `useGammaSound({ enabled, mode, carrier, level })` is the React hook.

- **binaural**: two sines merged one per ear (ChannelMergerNode input 0 left, input 1 right), left at the carrier
  and right at carrier + 40 Hz (`CARRIERS`: 150/190, 200/240, 300/340, 400/440). The beat exists only between the
  ears, so it needs headphones. The channel has no reverb or delay send at all: the shared buses are stereo and would
  mix the ears.
- **isochronic 40 Hz**: one tone on for 12.5 ms and off for 12.5 ms, with raised-cosine edges; no headphones needed.
- **10 kHz clicks**: 1 ms tones of 10 kHz, 40 a second, the sound Martorell et al. 2019 played to mice.
- **pink bed + binaural**, **binaural + settle** (the site plays its own sonification with it) and **silent**.
- Pulse trains are rendered once into a seamless one-second loop (40 periods fit one second at any sample rate).
- A demonstration of the stimulus, with no health claim.
- Every layer starts on a master tick (below), so the binaural pair's phase zero and every isochronic burst and
  click start on a 40 Hz flash onset of the site's light.

## THE MASTER BEAT, heard (masterbeat.js, lane MASTERBEAT, 2026-10-01)

The site keeps one master beat (settle-see `masterbeat.js`): origin 0 (the page's time origin), a 500 ms tick, a
120 bpm beat, a 2 s bar and a 25 ms flash cycle. settle-hear reads its numbers from `globalThis.__settleMasterBeat`
(the same numbers when settle-see has not published them) and maps them onto the audio clock.

- `audioOffsetMs(ctx)`: master ms minus audio seconds for the sample leaving the speakers now, from
  `getOutputTimestamp()` (else `currentTime` plus `outputLatency`), held per context and moved only past 2 ms, so the
  readings' own jitter never moves a bar line. `toAudioTime` / `toMasterTime` convert both ways.
- `masterStartTime(ctx)`: the audio time of the next master tick at least 40 ms ahead. The gamma sound's layers and
  the symphony's binaural pair start there.
- THE DJ's bars: `quantizeBar(meter, bpm)` makes a bar a whole number of ticks (the house set's 118 to 126 bpm becomes
  exactly 120, a 2 s bar; 84 bpm becomes a 3 s bar), and the symphony starts a run of bars on a master bar line (2 s),
  every later bar on a master tick (`nextMasterBar`, `snapToTick` every bar, a late bar waits for the next tick). So a bar line, a house pass swap and a
  flash onset coincide.
- The symphony's binaural pair: both ears start on one tick; a beat change glides both ears linearly over a length
  `lockGlide` picks near 4 s, so a whole-number beat lands back on the master phase when the glide ends. A 40 Hz beat
  crosses phase zero on every flash onset; any whole-number beat on every master second, so on every 2 s bar line.
- THE MODES (`modes.js`, lane BINAURALMODES) build their layers through the same path, so every mode, its pad and its
  pair start on a master tick, and a mode swap's new layers start on one. Their beats are 40, 14, 10, 6 and 3 Hz,
  whole numbers that cross phase zero on every master second. SCHUMANN 7.83 is the one exception, named: it starts on
  a tick and then drifts against the grid by 0.83 of a cycle a second.
- THE CLICK NOISES (`clicks.js`, lane GLOBALSETTLE) start on the next 25 ms flash line, at most one 40 Hz cycle after
  the click.
- Drift: an audio device's clock and the system clock can differ by parts per million, so a long steady loop drifts by
  that much (milliseconds a minute at most); the bar line re-snaps every bar and never accumulates it.

## Click noises (clicks.js, lane GLOBALSETTLE)

24 short synthesised sounds for a click on a settle: ticks, pops, drops, bells, glass, chirps, wood and soft pads,
pitched on A = 432. `armClickNoises()` (called once at boot on the site) listens for settle-see's `settle:ripple`
event and plays one noise for every ripple with `sound: true`, panned by where the click was. A seeded bag deals
the 24 in a shuffled order and plays every one before any repeats, never the same one twice in a row.
`playClickNoise({ strength, pan, index, at })` plays one directly; `onClickNoise(fn)` and the window event
`settle:clicknoise` report each one.

THE CLICK LOCK (`clicklock.js`, lane CLICKLOCK, navigator 2026-10-02): the bag is a cycle, and a click locks it.
The first click takes the bag's next noise and locks it; further clicks replay that noise while they keep coming;
once the clicks stop for a quiet period, drawn fresh for each lock from a seeded uniform 1 to 3 seconds
(`CLICK_LOCK`), the next click advances the bag and locks the new noise. The quiet is counted from the last click.
The lock compares timestamps on the master clock at each click and sets no timer. A muted click neither plays nor
takes the lock, and an explicit `index` plays that noise and leaves the lock alone. `createClickLock({ draw, seed,
now })` is the shared rule; the site's logo puts its own lock on its own 24 sounds, so the two never share one.

Nothing is built before the sound starts (THE START RULE), nothing is built while MUTE ALL is on, and nothing plays while PAUSE ALL
holds the page. Every envelope starts and
ends at zero with an attack of at least 4 ms and a release of at least 60 ms, a square passes a 2.4 kHz low-pass
first, and the clicks go through the page's one limiter. When the engine carries the hero input's 'picture' tap
(lane BINAURALMODES), each noise sends a copy into it, so the audio modes hear the clicks with the picture.

## The sound's answer to a radial pulse (pulse.js, lane RADIALPULSE, 2026-10-02)

Every playing channel answers a radial pulse as it passes its on-screen anchor (settle-see's radial pulse bus owns
the geometry and the timing; settle-hear never imports it). `createChannel(E, { anchor })` builds three nodes after
the fader: a unity gain (the swell), a high shelf at 2.2 kHz (the brightening) and a stereo panner (the pan), and
registers the channel as a pulse target under its anchor (`'hero'`, `'page'`, or none); the binaural and symphony
dry channels take the swell alone, so a pair's two ears stay apart. A page hands each arriving wave to
`soundPulse(w, { anchors: ['hero', null] })`: `soundPulseShape(w)` turns the wave's gradient `w.a`, its direction
`w.dir.x` and its crossing time `w.passMs` into a swell of at most +1 dB, a shelf of at most +2.5 dB and a pan of at
most 0.3 toward the wave, and `applyPulse` schedules one rise (`setTargetAtTime`, 60 ms) and one fall (from half
way through the crossing) per parameter. Nothing is written while MUTE ALL is on or before the sound has started,
and the nodes sit before the mute gain and the limiter. `SOUND_PULSE` holds the limits; `tests/pulse.test.mjs`
checks them for every gradient and direction, the nodes on every channel, the dry channels, the mute, and dispose.

## THE DECK (deck.js, lane CYCLEBAG, 2026-10-02)

Every cycle here deals like a deck of cards (THE DECK RULE, `sites/CLAUDE.md`): THE DJ's theme changes
(`createThemeDealer`) and its away beats (`createBeatDealer`, the pull home stays a weighted draw), the flute's tunes
per theme (`createTuneDealer`), the house passes (`createPassBag`) and the chime's chord roots (`createChimeRoots`).
`src/deck.js` is a byte-identical copy of settle-see's `src/deck.js`, kept so settle-hear imports nothing from
settle-see; `tests/deck.test.mjs` fails when the two differ. The click noises' bag (`clickBag`) is lane CLICKLOCK's.

## Tests

`npm test` runs 27 node tests: the mapping (clamped, NaN-free, monotone, and a negative control that garbage maps to
silence), the switch (default on, persistence with a fake storage, a throwing storage, garbage in storage, a negative
control without storage), the presets, and the audio graph against a fake AudioContext (no context before a gesture,
the limiter on the output, only finite values ever written to a parameter across every preset and a cooling run, mute
to zero and back, a stopped hearing building no oscillators, a quiet hearing scheduling no grains).

## The hero symphony and THE DJ

The home hero's default sound, the **40 Hz AND 432 Hz FLUTE MODE** (`FLUTE_MODE_NAME`): a binaural pair on a
40 Hz base, a drone, the flute playing old public-domain tunes, harp, bells and held harmonics, every pitch from
A = 432 Hz. **THE DJ** decides what changes, once a bar, as a six-light settling machine (change beat, new theme,
go static, split, flute, drone) whose leans come from the hero's live stats. Five themes (CRYSTALS, HIGHLANDS,
DEEP SEA, CATHEDRAL, EMBERS) set the shape of a set; a seed from the clock makes each visit different.

```jsx
import { HeroSymphony } from 'settle-hear/react';
<HeroSymphony stats={stats} playing={soundOn} />   // the sound, and the DJ's visualiser bottom left
```

| file | what it is |
|---|---|
| `src/tuning.js` | A = 432, the 40 Hz home, harmonics, the binaural pair, the mode's name |
| `src/abc.js` | a small ABC reader for the tunes |
| `src/tunes.js` | the tunes, each with its public-domain source, and the rule that refuses one without |
| `src/themes.js` | the five themes, plain data |
| `src/dj.js` | THE DJ: readHero, leans, anneal, createDJ (seeded, deterministic) |
| `src/instruments.js` | flute, fiddle, harp, bells, crystal, drones, harmonics, the binaural pair |
| `src/symphony.js` | the player: bar by bar on the audio clock, a dry channel for the binaural pair |
| `react/Symphony.jsx` | useSymphony, HeroSymphony and the visualiser parts |

Everything a sound or visual designer needs, every knob and how to add a theme, a tune or an instrument:
**`DESIGNER_GUIDE.md`** (English) and **`DESIGNER_GUIDE.ja.md`** (Japanese). Headphones are needed to hear a
binaural beat; nothing here makes a health claim. The symphony's tests are in `tests/symphony.test.mjs` and
`tests/visualiser.test.mjs`; `npm test` runs them all (91 after lane HOUSEDJ).

## The house set and THE PASSES (lane HOUSEDJ)

The tunes can also go electronic. With the house set on, the old tunes stop being the lead: the flute plays them
about 14 dB under a soft four-on-the-floor thump and a soft pad, and the whole bed runs through a chain of a few
effect passes chosen at random from 35, then a limiter. THE DJ decides when the chain changes, so it moves like a
house set: every pass gets its turn, the music never stops to change, and a swap only ever lands on a bar line.

```js
import { createSymphony } from 'settle-hear';
const s = createSymphony({ house: true });   // or s.setHouse(true) later
s.state.house;                                  // { on, keys, labels, lines, cost, swaps, barsSince }
```

On the site the house set is part of DEFAULT MODE, one mix for every visitor. Its faders live in one place, the
site's `heroControls.js` `DEFAULT_MIX`:

| layer | what you hear | fader |
|---|---|---|
| the hero settle's own static | the picture's sound in the `crackle` preset: a crackle for every cloud of flips, hiss for the heat, tracking the picture live | 0.9, the loudest |
| the binaural pair | two sines 40 Hz apart, one per ear (headphones) | 0.32 |
| the McKusker flute | the hero symphony through the house passes, the tune 14 dB under its own thump and pad | 0.26, the lowest |

One DEFAULT MODE volume in the console scales all three. The console still offers every other sound, and
"the flute through the house passes" as an option on the flute alone.

THE DJ's big view is a popup: a click outside it, Escape, its x button, another hero popover opening or the hero
shrinking to the bar closes it (`djPopupStep`, `src/popup.js`).

### How it sounds, in plain sound terms

| part | what you hear | where |
|---|---|---|
| the bed | a soft kick-like thump on every beat, tuned to the key, and a soft triangle pad holding the bar's chord | `houseset.js` |
| the tune | the flute, about 14 dB down (`HOUSE.melodyLevel` 0.2 against the bed's 1), so the groove and the pad carry it | `houseset.js` |
| the chords | four bars of I V vi IV in a major mode, i VI III VII in a minor one, on the theme's root | `progression()` |
| the tempo | 118 bpm when the hero is calm to 126 when it is hot, smoothed bar to bar | `houseBpm()` |
| the chain | 2 to 6 passes in series (a budget of 34 cost units), then a hard limiter (-16 dB, ratio 20, attack 1 ms) | `buildChain()` |
| the swap | a new theme replaces the whole chain; THE DJ's beat or split light, after at least 4 bars, rolls the oldest two passes out and two new ones in; 16 bars with no swap forces a roll. Every swap is a one-beat crossfade starting on the bar line | `houseSwap()` |
| the order | a seeded bag: all 35 passes, shuffled, are used before any comes back, and the first of a new round is never the last of the old | `createPassBag()` |

Every pitch still comes from A = 432 Hz, the binaural pair still plays on its own dry channel when its track is on,
MUTE ALL still silences everything, and nothing makes a sound before the browser lets the page start it. Two limiters
stand between any pass and the speakers: the chain's own, then the page's master limiter. Measured in headless
Chromium (`runs/housedj/measure_audio.json`): 60 s through all 25 passes peaks at -5.7 dBFS (measured before lane BINAURALMODES added 26 and 27 and lane
HEROSHUFFLE added 28 to 35; those ten are not measured in Chromium yet).

### THE PASSES

The cost is the pass's share of the CPU budget, about one unit per live audio node (a convolver counts as 6).

| # | pass | family | cost | what you hear | its parameters |
|---|---|---|---|---|---|
| 1 | `lowpass-sweep` RESONANT LOW-PASS SWEEP | filter | 2 | a resonant low-pass opens over one bar and closes over the next: the top end breathes in and out | lo 320 (Hz, closed); hi 5200 (Hz, open); Q 9 (resonance) |
| 2 | `highpass-rise` HIGH-PASS RISE | filter | 2 | a high-pass climbs over four bars and drops back: the low end thins out into a build, then lands | lo 40 (Hz); hi 700 (Hz at the top of the phrase); Q 2 (resonance) |
| 3 | `wah` BAND-PASS WAH | filter | 4 | a narrow band-pass swings up and down once a beat: the sound says wah on every beat | centre 900 (Hz); depth 600 (Hz either side); Q 5 (narrowness); dry 0.35 (dry level) |
| 4 | `pump` SIDECHAIN PUMP | rhythm | 1 | everything ducks on each beat and swells back, as if the kick pushed it down: the house pump | floor 0.3 (level at the beat); back 0.55 (beats to swell back) |
| 5 | `kit` SYNTH KICK AND HATS | voice | 6 | a kick on every beat tuned to the key, closed hats on the off-beats, a clap on two and four | kick 0.75 (kick level); hats 0.14 (hat level); clap 0.16 (clap level) |
| 6 | `tape-delay` TAPE DELAY | time | 7 | echoes a dotted eighth apart that darken and wobble a little as they repeat, like tape | beats 0.75 (echo spacing in beats); feedback 0.42; wet 0.38; tone 2500 (Hz, the loop low-pass) |
| 7 | `ping-pong` PING-PONG DELAY | time | 7 | echoes that bounce left, right, left, half a beat apart | beats 0.5 (echo spacing in beats); feedback 0.45; wet 0.33 |
| 8 | `plate` PLATE REVERB | space | 9 | a bright metal-plate room, 1.8 s long, on everything above 250 Hz | seconds 1.8 (tail); decay 2.6 (how fast it dies); wet 0.32 |
| 9 | `chorus` CHORUS | mod | 8 | two copies a few milliseconds late, each drifting slowly: one voice sounds like several | wet 0.4 (each copy); depth 0.003 (s) |
| 10 | `phaser` PHASER | mod | 8 | four all-pass filters swept slowly: notches glide through the sound, a whoosh | centre 800 (Hz); depth 600 (Hz); rate 0.2 (Hz) |
| 11 | `flanger` FLANGER | mod | 6 | a copy only milliseconds late, fed back and swept: the jet-plane sweep | feedback 0.5; depth 0.0025 (s); rate 0.17 (Hz) |
| 12 | `bitcrush` BITCRUSH | grit | 4 | the wave rounded to 32 steps: a gritty, stepped edge, mixed under the clean sound | bits 5 (bits (32 steps)); wet 0.5 |
| 13 | `rate-reduce` SAMPLE-RATE REDUCTION | grit | 5 | a lo-fi top: two steep low-passes at 2.6 kHz and a faint crush. An approximation: true sample-and-hold needs per-sample code | nyquist 2600 (Hz); crush 0.22 (crush level) |
| 14 | `ring-mod` RING MODULATION | grit | 4 | the sound multiplied by a sine two octaves above the chord root: a bell-like, metallic shimmer in the key | wet 0.3; octaves 2 (above the root) |
| 15 | `trance-gate` TREMOLO GATE | rhythm | 1 | the sound chopped into sixteenth notes in a fixed rhythm: a trance gate | floor 0.2 (level when shut); seed 7 (which rhythm) |
| 16 | `arpeggiator` ARPEGGIATOR | voice | 5 | the bar's chord played as quick sixteenth-note plucks, up and down | level 0.1; octave 1 (octaves above the chord) |
| 17 | `octave-doubler` OCTAVE DOUBLER | voice | 3 | the tune doubled an octave higher as a soft glassy line, quieter than the tune itself | level 0.06 |
| 18 | `supersaw` DETUNED SUPERSAW PAD | voice | 12 | the tune's chords held by nine slightly detuned saw waves under a soft low-pass: the wide house pad | level 0.05; detune 14 (cents either side); tone 1800 (Hz) |
| 19 | `sub-bass` SUB BASS | voice | 3 | a deep sine on the chord root, on the off-beats between the kicks | level 0.35 |
| 20 | `vinyl-riser` VINYL AND NOISE RISER | voice | 5 | a faint vinyl hiss and crackle, and on the fourth bar of each phrase a noise rise that brightens into the downbeat | hiss 0.012; riser 0.05 |
| 21 | `stutter` STUTTER | time | 6 | on every second bar the last beat repeats a tiny slice of itself, a beat-repeat stutter | slice 0.125 (beats); feedback 0.85 |
| 22 | `shimmer` GRANULAR SHIMMER | space | 14 | grains pitched an octave up and sent into a short room: a halo above the sound. Two crossfaded delay lines, no per-sample code | wet 0.22; grain 0.1 (s) |
| 23 | `formant` FORMANT FILTER | filter | 5 | three narrow bands set to a vowel, a new vowel each beat: the sound seems to sing a, e, i, o, u | Q 8 (narrowness); wet 1.1; dry 0.3 |
| 24 | `soft-clip` SOFT CLIP SATURATION | grit | 3 | driven into a gentle tanh curve: warmer, thicker, the peaks rounded instead of cut | drive 2.2; trim 0.6 (level after) |
| 25 | `sweep-in` SWEEP-IN BUILD | filter | 2 | when the chain arrives it starts muffled and half as loud, and opens over four bars into full sound | from 300 (Hz); to 16000 (Hz); bars 4 |
| 28 | `auto-pan` AUTO-PAN | mod | 2 | the sound swings from the left ear to the right and back once a bar, then settles in the middle on the downbeat | width 0.7 (how far it swings, 0 to 1) |
| 29 | `tilt-eq` TILT EQ | filter | 2 | a see-saw equaliser: one bar dark (the bass up, the top down), the next bright, tipping back and forth | tilt 6 (dB at each end); pivot 700 (Hz, the see-saw's middle) |
| 30 | `comb` TUNED COMB | filter | 3 | a very short echo fed back on itself, its length one period of the chord root: the sound rings in the key, metallic | feedback 0.62; wet 0.35 |
| 31 | `dub-echo` DUB ECHO | time | 7 | dotted-eighth echoes through a narrow band, the feedback swelling on the last beat of every fourth bar, then pulled back | feedback 0.5 (normally); swell 0.82 (on the swell); wet 0.3; band 1200 (Hz) |
| 32 | `tape-stop` TAPE STOP | time | 4 | on the last beat of every eighth bar the sound slows and drops in pitch like a tape machine switched off, then starts again on the downbeat | depth 0.24 (s of delay the stop sweeps through) |
| 33 | `gated-reverb` GATED REVERB | space | 9 | a big bright room cut off short a quarter of a beat after every beat: the 1980s drum sound, huge and then gone | wet 0.4; open 0.25 (beats the gate stays open) |
| 34 | `isolator-drop` ISOLATOR DROP | filter | 3 | the DJ mixer's bass kill: the low end is taken out for the first bar of every four, and comes back in on the second | split 180 (Hz, where the bass ends); depth -30 (dB when killed) |
| 35 | `rotary` ROTARY SPEAKER | mod | 6 | a spinning-horn speaker: a wobble in pitch, loudness and side that runs fast for four bars and slow for the next four | fast 6.7 (Hz, the fast spin); slow 0.8 (Hz, the slow spin); depth 0.0015 (s of pitch wobble) |

Two are honest approximations, because Web Audio has no sample-and-hold or pitch shifter without per-sample code:
**sample-rate reduction** is two steep low-passes at the new Nyquist plus a faint crush, and the **granular
shimmer** is two delay lines whose delay time falls at one second per second (an octave up), each windowed by
|cos| so their grains crossfade, into a short plate. To add a pass: copy a block in `PASSES`, give it a key, a
label, a family, a cost, a line and its parameters, and the bag deals it from the next round on. `tests/house.test.mjs`
builds every pass against a fake AudioContext, plays eight bars, checks only finite values reach a parameter and
that the pass frees every node it made.

### Measured cost

On the M5 Max (headless Chromium 148, the page's dev server, load 25 on 18 cores: a busy box, so these are upper
bounds): the bed plus a chain, rendered offline at 48 kHz, takes a median 2.2% of one core and at worst 4.0% over
12 seeded chains. The spectrum read plus the hero's target build takes a median 0.1 ms a frame (the browser's
timer resolution), p90 1 ms.

## THE SPECTRUM SETTLE (lane HOUSEDJ)

The sound is visual too. An AnalyserNode taps the page's master limiter (`masterAnalyser()` in `engine.js`), so it
hears exactly what the speakers get, after MUTE ALL. Its frequency bins become 32 bars, each a third of an octave
or so from 30 Hz to 16 kHz, with Winamp's motion: a bar jumps up at once, falls by at most 0.05 a frame, and its
peak cap holds 6 frames before it drifts down.

```js
import { spectrumTarget } from 'settle-hear';
<Settle items={[{ live: spectrumTarget('bars'), T: 0.6, periodMs: 125, note: 'the sound as bars' }]} />
```

| file | what it is |
|---|---|
| `src/spectrum.js` | pure: `bandEdges`, `barLevels`, `createBars` (the falloff), `bassLevel`, `spectrumBits(view, w, h, style)` with the styles `bars`, `mirror`, `ring` and `scope`; silence gives an empty target in every style |
| `src/spectrumlive.js` | the page's source: reads the analyser once per frame however many callers ask; `spectrumTarget(style)` is a settle-see live function; `bass()` is the low end, 0..1; `houseLive` tells the hero when the house set is heard |

The hero settles toward the spectrum; it never cuts to it. The bars are a settle-see LIVE item (settle-see
`live.js`): sampled on TRUE TIME's grid every 125 ms, and a fresh sample is taken only when the field agrees with
the last one on the lights it changed. While the house set is heard, the hero's rotation puts a spectrum item
after every other item, in turn bars, mirror, ring and scope; on the other items the bass raises the pull by at
most 0.08, so the field holds together a little harder on the kick. `tests/spectrum.test.mjs` runs the analyser's
own computation (a Blackman-windowed DFT in dB, mapped to bytes) on tones at 110, 432, 1000, 3000 and 8000 Hz and
checks each lands in its own bar; in Chromium real oscillators land 5 of 5 and silence lights 0 lights.

## The binaural modes, the tone rules, the vocoder (lane BINAURALMODES, 2026-10-01)

- `src/modes.js` `BINAURAL_MODES`: seven popular modes from the survey
  (`runs/binauralmodes/BINAURAL_MODES_SURVEY.md` in the SETTLE research repository): GAMMA FOCUS 40 Hz on 216, BETA STUDY 14 Hz
  on 288, ALPHA CALM 10 Hz on 216, SCHUMANN 7.83 Hz on 144, THETA DEEP 6 Hz on 162, DELTA SLEEP 3 Hz on 108,
  LOVE 528 6 Hz on 528. A mode key is a gamma sound key: `createGammaSound({ mode: 'alpha-calm' })` plays the pair
  at the mode's beat and carrier, a soft pad, and (through the hearing) the hero's static under it. `MODE_CYCLE`
  holds the shuffle's stretch and fade.
- `src/heroinput.js`: THE HERO INPUT, the one bus every mode plugs the hero settle into: the picture's static (the
  engine's 'picture' tap) is the vocoder's modulator over the pad, and the picture's numbers (heat, settledness,
  flips) move the pad's filter, the shimmer and the vocoder depth. `tests/modes.test.mjs` builds every mode and
  refuses one without it.
- `src/vocoder.js`: a channel vocoder (`createVocoder`: band-pass banks, envelope followers, a carrier; silence in
  gives silence out) and a ring modulator whose depth breathes (`createRingMod`). Two house passes use them:
  VOCODER ON THE STATIC and RING SHIMMER (27 passes now).
- `src/tone.js` and `TONE_RULES.md`: the envelope floors, the saw ceiling, the detune, the level aims; every voice
  keeps them and the tone test checks each one.


## THE JAM: instruments to hit and one looper (jam.js, lane INSTRUMENTS, 2026-10-02)

Ten instruments a visitor hits, in the key THE DJ plays: kick, clap, closed hat, open hat, bass, pluck, bell, chord,
a vocoder-style blip and a settle burst (noise that settles onto a note). `jamKey(themeKey)` reads the theme's root
and scale from `djLive`; with no theme the key is A minor pentatonic. Every pitch comes from `midiHz` (A = 432); the
drums are tuned too (the kick on the root under 80 Hz, the noise band-passed on an octave of the root). The pluck,
the bell and the bass deal their notes from a deck (THE DECK RULE).

```js
import { createJam } from 'settle-hear';
const jam = createJam({ auto: true });   // the page's one jam: tuned to THE DJ, on the master beat
jam.hit('kick');                         // one voice call, quantised to the nearest sixteenth
jam.rec();                               // the take starts on the next master bar line, 1, 2 or 4 bars
jam.toggleOverdub(); jam.toggle(); jam.clear(); jam.cycleBars(); jam.setQuantise(false);
```

- **Quantise:** a sixteenth of the master bar (125 ms). A hit snaps to the nearest line; the sound waits for a line
  ahead and plays at once for a line just gone, so it is never early and at most 62.5 ms late; the loop keeps the
  line. `setQuantise(false)` plays free.
- **The looper:** REC arms it; the take starts on the next bar line and lasts 1, 2 or 4 bars, then the loop plays,
  in phase with the master bars, on the audio clock. OVERDUB adds hits; a hit is never played back on its own turn;
  the same instrument on the same step is kept once. The length on a loop that exists repeats it to grow and keeps
  its start to shrink. One loop, in memory, for the visit.
- **Silence:** every sound goes through one `voice(call)` (default `playOnEngine`: its own channel, the master, the
  mute, the limiter). MUTE ALL and PAUSE ALL stop every voice call; `pause(true)` (the hero's pause) stops the loop.
- Tests: `tests/jam.test.mjs` (a fake voice records every call; a hand clock drives the pump).

## THE LAYERS and YOUR TRACK (layers.js, yourtrack.js, lane LOOPLAYERS, 2026-10-02)

The site's looper is `createLoopJam`: the same ten instruments over a stack of loop layers. `createJam` and
`createLooper` above stay as they were (one loop) and are still exported.

```js
import { createLoopJam, createYourTrack, listenSets } from 'settle-hear';
const jam = createLoopJam({ auto: true });   // many layers, tuned to THE DJ, on the master beat
jam.hit('kick');                             // with no layers, this opens the first take on its own bar
jam.rec();                                   // a new layer on the next bar line; again: end it on the next bar line
jam.stretch(id, 6); jam.timer(id); jam.toggle(id); jam.close(id); jam.toggleAll(); jam.cycleTake();
jam.release();                               // a new set: every layer fades out over one bar
```

- **Layers:** the first loop records itself; REC lays another (six at most). A take is whole bars (1, 2, 4 or 8;
  4 by default) and plays at its end. A take with no hits leaves no layer.
- **Stretch repeats, never time-stretches:** a 4-bar take stretched to 6 plays the take and then its first 2 bars
  again; stretched to 2 it plays its first 2 bars. Every hit stays on a master sixteenth and in the DJ's tempo, which
  a time-stretch would break. The take is kept whole, so stretching back restores it. 1 to 16 bars.
- **Fades:** the timer steps off, 4, 8, 16 bars, off; the gain falls in a line from the gain the layer has now and
  the layer is gone at the end. THE DJ fades one layer at a time: one untouched for 24 bars fades over 8, or with
  more than 4 playing the oldest untouched for 8 bars. Touching a layer (play, stop, stretch) cancels a DJ fade.
- **Your track:** `createYourTrack()` holds the flag the page shows: `mark(ms)` (the first touch of a set says
  "cool"), `cycle(ms, { adjusted, context, set, hadLayers })` (opens a 10 s vote window on the set that ended when
  it was the visitor's), `voted(ms)`, `target(ms)` (what a vote rates now) and `view(ms)`.
- **The set hooks:** `listenSets({ onCycle })` calls `onCycle({ set, adjusted, reason, snapshot })` once per ended
  set from lane SETTLEDJ's window event `settle-hear:set` or `djLive`'s `set`; with neither it counts a theme change
  in `djLive` as a new set. The snapshot is `djLive`'s last state for that set, so a vote in the window rates it.
- Tests: `tests/layers.test.mjs`, `tests/yourtrack.test.mjs`.

## THE SETTLE DJ: two modes, the composer, the planner and the mix machine (lane SETTLEDJ, 2026-10-02)

The symphony has two playing modes, clearly apart.

- **THE McKUSKER FLUTE** (`createSymphony({ pure: true })`, `setPure`). A collected tune plays as written, from its
  first note to its last, on the raw flute alone, in a light room, at one tempo for the whole tune. No drone, no
  harmonics, no binaural pair, no harp, no bells, no house passes. The DJ line names the tune and its book.
- **THE HOUSE DJ** (`house: true`, `setHouse`). The collected tunes become material. Each bar the brain
  (`mix-dj.js`) asks the planner where the set goes, settles the mix, and plays it through `mix-layers.js`.

```
  collected tunes ──▶ THE COMPOSER ──▶ a new tune ──┐
  (dealt like a deck)  note slots settle            │
                                                    ▼
  the hero picture ─┐                         THE MIX MACHINE ──▶ layers in or out ──▶ mix-layers.js
  the theme ────────┼──▶ THE PLANNER ──▶ section ──▶ eleven p-bits              drums, bass, pad,
  your steering ────┤    16 bars ahead,  + moves     (drums, bass, pad, lead,     lead, drone, arps,
  the votes ────────┤    settled every   (riser,      drone, arps, answer,        answer, chop, hum,
  earlier sets ─────┘    4 bars          silence...)  texture, wash, filter, fx)  through THE RACK
```

**The composer** (`tune-composer.js`) cuts each source tune into bars and phrases (abc.js numbers every note's bar)
and turns its notes into scale degrees, so tunes in different keys teach the same model. The new tune is a field of
note slots. Each slot leans toward what the sources play next (an interval model and a degree-pair model), toward
small steps, toward the tonic or the fifth at a phrase end and the tonic at the end of each half, toward a chord tone
on a downbeat, and toward the shape of a source phrase moved by one to three degrees. The field cools from hot to
cold over 48 sweeps, like the hero's lights, and the settled degrees are the tune, written in the theme's key and
mode. A copy check then measures the longest run of notes the tune shares with any one source; a run longer than a
phrase gets a penalty and the field settles again. The same sources, theme, seed and earlier sets give the same tune;
a new seed gives a new one. Its label names its sources: "a new tune after X and Y".

**The planner** (`mix-planner.js`) plans the set's energy arc: intro, build, peak, breakdown, outro and THE NEUTRAL
HUM, a quiet warm-down that pulses at a researched rate (delta or theta after a peak, alpha or Schumann when calm).
Every four bars it scores every plan of the next sixteen bars against the arc, the theme, the picture, the steering
and the votes, adds a habit cost for each change (less on an 8 or 16 bar line), and settles one. A transition brings
its moves: a riser or a snare roll into the drop, a one-bar silence, a reverse cymbal or a filter drop on the last
bar, a downlifter after it, a tape stop into a breakdown, a key lift at a second peak.

**The mix machine** (`mix-machine.js`) settles eleven p-bits once a bar on the master beat. Their leans come from the
section, the picture, the theme, the visitor's steering and the votes; their pulls make them agree (the drums and the
bass come in together; the wash and the drums disagree). Inside a phrase each thing leans hard to stay, so the mix
moves on phrase lines.

**The rack** (`mix-rack.js`) is one registry over the 35 house passes and the fx modules, every parameter with a
range. The DJ moves each effect's amount over the bar. **The tag** (`dj-tag.js`) packs the whole situation into one
string; `playTag(tag)` rebuilds it. A rating is stored against one tag, and well-rated tags lean the DJ
(`dj-votes.js`). Each set leaves an influence record, and the next set reads the last four through a decaying window
(`dj-influence.js`). The deep study of every house effect is `wikis/WIKI_HOUSE_SOUND/`.

## THE BASES (lane HOUSEBASES, 2026-10-02)

A BASE is a house or ambient rhythm bed in our own JSON (`settle-base/1`, spec in `BASE_FORMAT.md`): a tempo range,
a meter, a tick grid (4 a beat for house, 8 for ambient), a swing, a key, and separate PARTS (kick, snare, hats,
perc, bass, chords, lead, texture) as events `[tick, length, level, pitch]`, each part with its features (density,
syncopation, energy, register) and the whole with a signature (family, four-on-the-floor, backbeat, key). The
library in `bases/` is 300 bases, 150 house and 150 ambient: 224 imported from open MIDI (the Groove MIDI Dataset,
CC BY 4.0; Mutopia, public domain and CC BY-SA; OpenGameArt, CC0 and CC BY) and 76 authored from the family
recipes. A base is named `base-NNNN` and carries no source; `bases/ledger.json` and `LEDGER.md` hold every source,
licence, download date and sha256. The raw MIDI is never shipped.

```js
import { readIndex, loaderFor, createLibrary, slice, combine, playBaseBar, melodyOverBase, createBaseDJ } from 'settle-hear';

const lib = createLibrary(await readIndex('bases'), { load: await loaderFor('bases'), seed: 7 });
const [pick] = lib.pickBases({ kind: 'house', family: 'deep', bpm: 122, energy: 0.5, parts: ['kick', 'hats'] });
const drums = slice(await lib.load(pick.id), { parts: ['kick', 'snare', 'hats'], bars: [0, 4] });
const bass = slice(await lib.load('base-0171'), { parts: ['bass'], bars: [0, 8] });
const { ok, base, reasons } = combine([drums, bass]);          // the compatibility rule: meter, tempo overlap, key
playBaseBar(ctx, out, t0, beatDur, base, { bar: 3, energy: 0.8 });
const lead = melodyOverBase(base, placedTuneNotes, { gate: 'hats', duck: 0.4, energy: 0.8 });
const sym = createSymphony({ seed: 7, house: true, bases: lib }); // the house DJ's brain plans a base per phrase and the layers play it
```

| file | what it is |
|---|---|
| `src/bases/midi.js` | a Standard MIDI File reader, format 0 and 1, notes in beats; the GM drum and program maps |
| `src/bases/base-format.js` | the shape, `validateBase`, `compatible` (the rule), `ticksPerBar` |
| `src/bases/base-features.js` | `partFeatures`, `keyOf` (Krumhansl), `familyOf`, `kindOf`, `signatureOf`, `swingFromOffsets` |
| `src/bases/base-import.js` | `importMidi`: roles by channel, program and register; quantise with the recorded error; the window |
| `src/bases/base-author.js` | `authorHouse` and `authorAmbient`: one recipe per family, dealt from a seed |
| `src/bases/base-slice.js` | `slice`, `loopSlice`, `transposeSlice`, `rescaleSlice`, `combine` |
| `src/bases/base-library.js` | `createLibrary`, `featureCost`, `settleIndex`, `pickBases` (p proportional to exp(-G/T), cooled) |
| `src/bases/base-play.js` | `playBaseBar`, `defaultKit`, `melodyOverBase` (quantise, the hats gate, the kick duck, the cutoff) |
| `src/bases/base-dj.js` | `createBaseDJ`: the plan per phrase, held inside it; `wantFromDecision`; wired into `mix-dj.js` (`createHouseDJ({ bases })`) and `mix-layers.js` (the base's drums, bass and chords play in place of the pattern, the style and the plucks; the lead gated to its hats and ducked under its kick) |
| `tools/bases_build.mjs` | rebuilds `bases/` from a sources manifest; `node tools/bases_build.mjs --sources <json>` |
| `tests/bases.test.mjs` | 14 tests on a written MIDI fixture, the library on disk and a fake audio context |

The theory and the formulas, with their sources: `wikis/WIKI_DJ_THEORY/`.

## THE OPENING BLEND: every visit's first set (opener.js, opener-tag.js, lane OPENINGSET, 2026-10-02)

The navigator's ask: when the site loads, the DJ plays one relaxing set first, never house, built from isochronic
tones, soft pure and harmonic tones and a gentle 40 Hz pulse. The shape is the same every visit; the details are not.

```
   0:00 ─ silence ─ one soft tone ─ slow pulse 1 ─ + harmonic, pad ─ slow pulse 2 ─ 40 Hz ─ bloom ─ ease ─┐
                                                                                                         │ 4 to 7 min
                                                                    the DJ's first set fades in here ────┘ 24 to 40 s
```

- **THE ARC (fixed):** seven slots in one order (`OPENER_SLOTS`): silence then one soft tone; the first slow
  isochronic pulse; a harmonic tone and a warm pad join; the second slow pulse takes over; the 40 Hz pulse enters
  very softly; the bloom (the third slow pulse, every voice, a few soft bells); the ease (the voices thin and the
  tones glide to the DJ's key). Then THE HANDOVER: the opener's tail fades out over 24 to 40 s while the house set
  fades in from 0 under it and the house brain starts its first set at bar 0. No drums and no beats play before it.
- **WHAT VARIES (settled per visit, `settleOpener`):** the length (240 to 420 s in 15 s steps, the navigator's 4 to
  7 minutes), each slot's share inside its range, the key (the theme's root, a fourth or a fifth above, in 100 to
  230 Hz), the order of alpha, theta and Schumann in the three rate slots, the first tone's and the harmonic tone's
  timbre, the harmonic ratio, the 40 Hz carrier, the pad's brightness, the bells' spacing and the handover length.
  Each choice is settled (p ~ exp(-G / T) through eight cooling steps, a mild pull to the middle of its range and a
  novelty cost against last visit's choice); THE DECK RULE deals the rate order and the timbres with last visit's deal
  as the card already played (stored under `settle-hear:opener:last`, guarded), so a returning visitor never hears the
  same order twice in a row.
- **WHY 4 TO 7 MINUTES:** the navigator set the range. Inside it every rate slot lasts at least 30 s (a test holds
  it), long enough for a pulse to settle into a steady texture, and the DJ's own sets still start inside
  the first eight minutes of a visit.
- **THE RATES AND THEIR SOURCES** (no health effect is claimed for any of them):
  alpha 10 Hz, the binaural apps' default, and theta 6 Hz, the apps' theta preset
  (`runs/binauralmodes/BINAURAL_MODES_SURVEY.md` §2, §4; `modes.js`); Schumann 7.83 Hz, from the survey's Schumann
  rows (§1), and a sound at 7.83 Hz is not the Earth's resonance (§5); 40 Hz, the rhythm of gamma research: the
  40 Hz auditory steady-state response (Galambos et al. 1981) and the 40 Hz click trains of Martorell et al. 2019, in
  mice, a contested field (`wikis/WIKI_OLD_MELODIES/04-TUNING-432-AND-BINAURAL.md` §6, §7). Every rate is an
  amplitude pulse of an audible tone at 200 Hz or more (THE RULE of `fx-hum.js`): no tone under 40 Hz is played.
- **CLICK-FREE:** an isochronic pulse is one tone switched on and off cleanly. Each burst starts its sine at phase
  zero and rises and falls through raised-cosine edges (slow rates: on half the period, edges a third of the on
  time; 40 Hz: 12.5 ms on, 3 ms edges); the loop buffer ends in silence. The tests hold the largest sample step at
  the sine's own slope. The envelopes are breakpoint lists scheduled bar by bar as linear ramps, each bar starting
  at the value the last ramp reached, and no envelope moves faster than 0.05 a second.
- **LEVELS:** the envelopes' sum stays under 0.62 (a test reads it every 0.1 s); the opener's own limiter is a soft
  clip y = 0.8 tanh(x / 0.8), unity for quiet signals, so it adds no makeup gain; then the channel at the DJ's level,
  the master, MUTE ALL and the page limiter. Rendered through the site's DEFAULT MODE chain: RMS 0.036 to 0.059,
  peak 0.213 (`runs/openingset/render_log.json`).
- **HEARD ALONE (site, DEFAULT MODE):** while the opener plays its arc, the picture's static and the separate binaural
  pair rest at fader 0 (`heroControls.js openerLevels`, read from `djLive.get().opener`), so only the opener sounds;
  they come back at the handover with the DJ. A pinned sound is never quieted.
- **THE RULES IT KEEPS:** the opener's clock moves only while the symphony is audible on the audio clock, so a
  pause, MUTE ALL or a page that has not had its first sound yet holds it, and its first second is the first second
  anyone hears (lane AUTOSTART owns when that is). The hero's volume sets its channel. The visitor's steering, a
  sound pick (`yieldOpener`, the page's `opener` prop), the McKusker flute, a mix lean, a tune skip, a lock, a hold,
  a clamp, a theme or a house tag yields it at once (its voices fade over 2.5 s, the house set comes up over 2 s). A
  reset of the steering to idle does not. The SHUFFLE waits while it plays. One opener per page load; a remounted
  player resumes it where it was.
- **THE TAG:** `"<THEME>.open.v1.<code>"` (`opener-tag.js`) packs every settled choice and the second it is at, so
  `decodeTag`, `tagLines`, `playTag` and the vote store take it like any DJ tag, and `playTag(tag)` on a live
  symphony plays that opener again from its start. The set hooks fire at the handover with the opener's tag, so a
  visitor can vote on it. The DJ line says OPENING BLEND, the slot, the pulse rate and the time; the DJ view shows
  the arc with the slot playing now.
- **HEAR IT:** `runs/openingset/` holds two 60 s windows (start and middle) of two openers and one full opener,
  rendered offline through the real Web Audio graph in Chromium (`render.py`, `render.html`).

## THE VOICE CHAINS: every melodic instrument through its own effects (voice-fx.js, lane MELODYFX, 2026-10-02)

The navigator's ask: the tunes sounded like a scary circus; every melody should go through several effects, at least
three per instrument with a small distortion always among them, so the instruments always sound different; the
clear flute alone stays clean, and a distorted flute joins it.

- **WHY IT SOUNDED LIKE A CIRCUS (read from the code before the lane, commit `bebba0aa7`):** the lead was a sine plus
  a triangle an octave up with a 5.2 Hz vibrato, played near G5 (`placeTune` centres every tune at midi 79): a
  calliope's whistle. The answer repeated the lead's first three notes on bells an octave higher. The arps were
  sixteenth-note triangles an octave above the chord through a 2.6 kHz low-pass: a music box. The organ bass struck
  the root on beats 1 and 3: an oom-pah. Everything sat on the same small room, so every voice shared one dry,
  bright space, and every melodic note left the instrument bare.
- **THE CAUSES, FIXED:** the house lead is dealt per set from the clear flute, the DISTORTED FLUTE (`flute-drive`) and
  the LO-FI KEYS (`keys`, a felt electric piano: two-operator FM with a bark that dies in 0.12 s, a level that falls
  while held, a felt low-pass at six times the pitch); the tune moves by whole octaves to the instrument's own
  register (`REGISTER`: the keys an octave under the flute); the keys hold each note 8% past its length; the lead
  and the arps swing their off-beat eighths by the set's swing (0, 0.04, 0.08 or 0.12 of a beat); every note's
  velocity varies a little. The answer plays at its own instrument's register (keys, bells, the distorted flute or
  crystal). The arps are eighth notes in the chord's own octave on a soft pluck, the keys or the harp. The organ bass
  holds one pedal note a bar. The harp has a soft low-pass and an 8 ms strike; the bells' top partial is softer.
- **THE CLEAR FLUTE** (`flute`) is the one clean instrument, in every mode: no chain anywhere. It is a little
  crisper: a faint third harmonic (0.035), a brighter and tighter breath chiff (4x the pitch, Q 1.8, 0.07), a faint
  steady breath under the tone and a 45 ms attack. Measured, the same tune's spectral centroid rose from 1,287 Hz to
  1,555 Hz (`runs/melodyfx/centroids.json`). THE McKUSKER FLUTE (pure) plays it dry, as before.
- **THE CHAIN** (`realizeVoice`): the WARM DRIVE first (`fx-warm-drive.js`: tanh, valve or tape curve, drive 1.4 to
  2.6, the distorted flute's 3.5 to 5), then two to four more from 19 (`VOICE_CHAIN_POOL`): the six new voice inserts
  in `fx-voice-mods.js` (TAPE WOW AND FLUTTER, DRIFTING LOW-PASS, ENSEMBLE, VIBRATO, TREMOLO, WARM ROOM) and thirteen
  of the house passes at gentle settings (chorus, phaser, flanger, rotary, auto-pan, formant, bitcrush at 7 to 9 bits,
  sample-rate reduction, ring modulation at a low mix, tape delay, ping-pong, plate, granular shimmer). A chain holds
  at most one filter, one extra grit, two mods, one time effect, one space effect, one pitch mover, and one of each
  SAME_KIND pair (chorus or ensemble, phaser or flanger, the two crushes); its order is drive, grit, filter, mod,
  time, space. Every new effect is a rack insert with declared ranges, so `RACK`, `rackRows()` and the tag alphabet
  carry it.
- **HOW THE DJ CHOOSES (THE SETTLE AND THE DECK):** each new set, `createVoiceDealer` deals every part an instrument
  from its own bag and a hand of 7 effects from its own bag of the 19 (THE DECK RULE: every effect comes round
  before any repeats). Each card is a p-bit under G = - fit (the theme's and the instrument's taste) + 0.7 for a card
  in this part's last chain + 1 for a card another part already took this set + 3 for a broken cap + 0.4 (n - 3)^2;
  twelve Gibbs sweeps cool T from 2 to 0.15, and a repair keeps the caps and two extras at least. The settings are
  points on each effect's taste range drawn from the set's seed. The house brain deals a palette per set
  (`decision.voices`); the symphony deals one for the fiddle, harp, bells and crystal per theme.
- **THE TAG** carries the palette after its other fields: the seed, then per part its slot, its instrument and its
  effect keys. `realizePalette` rebuilds every amount and setting from those, so `playTag` plays the same chains
  exactly; a tag written before the voice block reads as no block, and its replay derives a palette from its tune
  seed (`paletteOfTune`), fixed for that tag.
- **THE LEVELS:** the drive's slope at zero is 1 and its post gain is makeup / drive, so a quiet note passes at 1 to
  1.2 times its level (2.4 for the distorted flute, which the hard curve makes quieter) and a full-scale one is capped
  at 0.32. Feedback stays at or under 0.42, the warm room at or under 0.38 of the mix, and each chain ends in a trim
  of 0.95. The arps and the answer ask for a peak (`velocityFor`), so changing the instrument keeps the part's level.
  The voices then pass the house rack's limiter, the page's master limiter and MUTE ALL. A part's chain is built on
  its first note, so a muted page or a track switched off runs no chain.
- **THE OPENING BLEND (lane MELODYFX2 changed this):** its bells now ring through a gentle chain; its tones, pulses
  and pad still take none. See the next section.
- **SEE IT:** the DJ view's THE VOICES panel lists each part's instrument and chain (`react/Symphony.jsx`
  `VoicesPanel`); `state.voices` carries the same. **HEAR IT:** `runs/melodyfx/` holds before-and-after samples
  rendered offline through the real Web Audio graph in Chromium (`render.py`, `render.html`), each chain in
  `render_log.json`.
- Tests: `tests/melodyfx.test.mjs` (320 voices across 80 palettes, the clear flute dry, the pure mode drive-free with a
  control, the deck, the tag round trip, the live replay, the routing and the mute, the level bounds).

## THE VOICE CHAINS, EVERYWHERE: every melody in every mode (lane MELODYFX2, 2026-10-04)

The navigator's clarification: "the trendy piano" was never one instrument. It is the treatment: ANY instrument that
plays a melody, in the house tracks and everywhere else, goes through our many effects with a mandatory bit of
distortion, the clear flute alone excepted, and a version of the flute that does go through them plays wherever the
clear one can.

- **THE CENSUS (every path that plays a pitched line, read 2026-10-04):**

  | path | instrument | before | after |
  |---|---|---|---|
  | house DJ lead, answer, arps, chop (`mix-layers.js`) | flute, distorted flute, keys, pluck, harp, bells, crystal, the chop | chained (MELODYFX) | unchanged, now from a 30-effect pool |
  | house DJ base chords (`playBasePart` into the arps bus) | triangle chords | chained (MELODYFX) | unchanged |
  | symphony tune (`symphony.js` tune mode) | the clear flute | dry | the dealt 'lead': the clear flute dry or the distorted flute through its chain, per theme |
  | symphony fiddle, harp, bells, crystal, the film-frame bells | as named | chained (MELODYFX) | unchanged, 30-effect pool |
  | symphony pure mode (THE McKUSKER FLUTE) | the clear flute | dry | dry: the clear flute's own mode |
  | opener bells (`opener.js` bloom) | sine pings on the key's pentatonic | dry | warm drive + 2 to 4 GENTLE effects |
  | opener tones, pad, isochronic and 40 Hz pulses | held tones and pulses | dry | dry: no tune; an effect would smear a pulse's edges |
  | jam pluck, bell, chord, vox, settle (`jam.js`) | the jam's tonal hits | dry | one chain each ('free' profile), built on the first hit |
  | jam kick, clap, hats, bass | drums and the root | dry | dry: drums carry no tune, the bass carries the root |
  | loop layers (`layers.js`), live radio's followed loops (site `liveradio/`) | the jam's hits | dry | through the jam's chains (`playOnEngine`) |
  | the bases page (site `pages/hearbases.jsx`, `playBaseBar`) | lead: the clear flute; chords | dry | lead dealt (clear flute, distorted flute or keys) + chords through the arps chain (`createBaseVoices`) |
  | the house set API (`houseset.js`, no page plays it) | the clear flute | dry | a dealt 'lead' bus |
  | the neutral hum's motif (`fx-hum.js`) | a slow sine under the pulse | dry | dry: the hum is the neutral warm-down, capped at 0.05, and its only movement is the rate pulse |
  | the house drone, pad, bass lines, acid line, the relax chord bed, logo and click sounds, the hearing's chime/pulse | beds, roots, sound effects | dry | dry: not melodies (harmony beds, the root, or one-shot effects) |

- **THE PROCESSED FLUTE:** every instrument list that holds the clear flute also holds the distorted flute (the house
  lead, the symphony's `SYMPHONY_INSTRUMENTS.lead`, the bases' lead), and the deck deals both in turn.
- **THE POOL REVIEW (`VOICE_CHAIN_POOL`, 30 effects):** MELODYFX's 19 plus the eleven rack effects that suit a melody,
  at gentle settings: resonant low-pass sweep (Q 4.5 to 5.5, mixed at 0.35 to 0.55), high-pass rise (to 180 to 320
  Hz), band-pass wah (a narrow 150 to 350 Hz swing, dry 0.6 to 0.85), tilt EQ (3 to 4 dB), tuned comb (feedback 0.2 to
  0.36), soft clip (drive 1.1 to 1.6), ring shimmer (depth 0.06 to 0.12), tremolo gate (floor 0.55 to 0.75), dub echo
  (feedback 0.2 to 0.36, swell 0.41 to 0.42), gated reverb (wet 0.12 to 0.2) and the hall (wet 0.15 to 0.25). The
  rest are named with a reason in `POOL_EXCLUDED`: the two duckers (the bus's job), the six voices that add their own
  parts, the stutter (feedback 0.85), the tape stop, the sweep-in and the isolator drop (transitions), the vocoder on
  the static (it needs the hero's picture tap), and the warm drive (never dealt: it is always first). A new 'rhythm'
  family (the tremolo gate, cap 1) and two new SAME_KIND pairs (tremolo or tremolo gate, ring mod or ring shimmer)
  keep a chain from doubling one colour.
- **THE PROFILES (`PROFILES`):** 'full' for parts on THE DJ's bar clock (the house set, the symphony, the bases page);
  'free' for the jam (the pool less the five effects that only move on a bar clock: the sweep, the rise, the tilt, the
  gate and the gated room; a jam chain gets one static bar of tempo and key when it is built); 'gentle' for the opener
  (tape wow, drifting low-pass, ensemble, chorus, a slow tremolo at 0.5 to 1.4 Hz, warm room, plate, hall, a long soft
  tape delay; the drive is the tape curve at 1.2 to 1.5 with no makeup). A profile other than 'full' rides in the
  spec; the tag never carries one (its slots are the eight in `VOICE_SLOTS`, whose order is unchanged).
- **THE JAM:** `createJamVoices` builds a part's chain on that instrument's first hit and keeps it; every later hit goes
  into the same bus, so a hit adds only its own few nodes and plays at the time it always did. A new theme deals new
  chains (a 0.4 s crossfade). MUTE ALL and PAUSE ALL stop the hits before any chain is built.
- **THE LEVELS:** the chains cost a few dB (their dry and wet crossfades, the drive's cap, their low-passes), so each
  new path's chain is trimmed back to the part's dry level: `LEVEL_MATCH_DB` holds the mean rms change over eight dealt
  chains, measured in Chromium (`runs/melodyfx2/render.py --survey`), and `levelTrim` turns it into the trim after the
  chain. After the trim every path's mean is within 0.4 dB of dry. The house DJ's and the symphony's chains keep
  MELODYFX's trim of 0.95 (the symphony's distorted flute measured +0.1 dB). The limiters and MUTE ALL are untouched.
- **HEAR IT:** `runs/melodyfx2/` holds before-and-after samples of the symphony's tune, the opener's bells, the jam's
  pluck and bell, and a base's lead and chords, with each chain in `render_log.json` and each spectral centroid in
  `centroids.json`.
- Tests: `tests/melodyfx2.test.mjs` (the census, the processed flute, the symphony red-proven by routing its tune dry,
  the house DJ, the bases, the house set, the pool review, every pool effect dealt in every profile, the opener's
  gentle chains, the jam's one chain per instrument red-proven by re-dealing per hit, the engine path and the mute,
  the tag, the level match); the site's `tests/melodyfx2.test.mjs` (the bases block's wiring and a base heard through
  its chains, the jam row, loop layers and live radio on `playOnEngine`).
