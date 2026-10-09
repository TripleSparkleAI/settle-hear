<!-- settle-banner -->
```text
··●··●● ●●● ●●● ●   ●●●     ● ● ●●●  ●  ●●
·   ●  · ●   ●  ●   ●       ● ● ●   ● ● ● ●
·●· ●●   ●   ●  ●   ●●  ●●● ●●● ●●  ●●● ●●
 ·●··    ●   ●  ●   ●       ● ● ●   ● ● ● ●
●●  ·●●· ●   ●  ●●● ●●●     ● ● ●●● ● ● ● ●
↑↓↓↑↓↑↑↑↑↑ ●●●●●●●●
✦ sound made from a settle's own numbers, beside settle-see
```

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

Or add it to an app from its public repository: `npm install github:triplesparkle/settle-hear`. It is under the MIT
licence (`LICENSE`). It has no dependencies; React is an optional peer.
One test compares `src/deck.js` with settle-see's copy; it runs when a clone of settle-see sits beside this
folder and is skipped otherwise. A path below that starts `runs/` or `wikis/` names a file in the research
repository this package is developed in (a measurement under `SETTLE/runs/`, a study under the repository's
`wikis/`), not a file in this package.

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
  Grain voices are scheduled 120 ms ahead by one shared 60 ms timer, capped at 12 grains a tick. In a hidden tab,
  whose timers may fire once a second, the look-ahead grows to 1.5 s and the cap grows with it.

## The site-wide switch

`sound` (from `src/control.js`) is the page's one switch. Sound is on by default. `sound.setMuted(true)` mutes every
hearing and is remembered in `localStorage` under `settle-hear:muted`. settle-hear writes two more keys, both through
the store `HeroSymphony` hands the symphony: `settle-hear:opener:last` (last visit's opening blend, so the next one
differs) and `settle-hear:influence:v1` (the last four sets, which lean the next one). Every storage access is wrapped
in try/catch: in a private window the switch still works for the visit. The unlock is never remembered.
`sound.blocked` is true while the browser holds the sound back before its first start; `MuteAllButton` then pulses in
the prime red (`--hear-wait`), shows "sound waits for your first click" on hover and focus, and says it once in a
polite live region (labels `titleBlocked`, `tipBlocked`, `liveBlocked`).

The master level is the engine's: `setMaster(v)` (0 to 1) sets it, `getMaster()` reads it, and `onMaster(fn)` calls
`fn(level)` on every change and returns an unsubscribe. The engine keeps the level from before the context is built, so
a page can restore a remembered level on load (the site's hero volume, lane HEROSOUNDCTL). The master sits before the
mute gain: MUTE ALL silences everything and leaves the level as it was. `MasterFader` listens through `onMaster`, so two
faders of one master agree.
The level is what a fader shows; the master GAIN is the level squared (`levelGain(v)`, lane VOLUMECURVE), the standard
volume law. A level of 1 is loudness 1.0, the default 0.8 plays at 0.64, and 0.1 plays at 0.01, 40 dB down. The square
is taken once, in the engine, so every fader of the one master is on the same curve. `MasterFader` shows the level to two
places and speaks it as the number (`levelText`: "0.80 of 1"), never as a percent; pass `units.level` to translate it.
A master level of 0 counts as MUTE ALL for THE BACKGROUND RULE (lane HEROPASS): the mute gain closes and the context
is suspended after 250 ms, so the hero's volume at 0% never leaves a context running silent, and any level above 0
resumes it. It is not MUTE ALL itself: the switch is untouched and the level is the only thing that moved.

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

## THE MASTER BEAT, heard (masterbeat.js)

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

## Click noises (clicks.js)

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

THE DROP (lane HERODRAGFIX, navigator 2026-10-06: "the sound on the drop is like chance whether it hits or not"). A
dropped box on the hero (settle-see THE DRAG BOX) sends four births, ripples of kind `drop` carrying `drag` (the drop's
id) and `part` (0 to 3). `armClickNoises()` plays them with `playDropNoise({ key, part, pan })`, as ONE event:

- the first birth takes THE CLICK LOCK once and fixes the card all four play; the other three replay it without
  touching the lock;
- the four noises are one click noise from `DROP_CARDS`, each brought to `DROP.targetPeakDb` (-16 dBFS at the
  speakers) by an output gain of `dropGainDb(k)`, from each card's measured peak in `DROP_PEAK_DB` (measured in
  Chromium through the master analyser, four plays 90 ms apart at strength 0.6; the house DJ's median peak in the
  same measurement is -21.6 dBFS). A card that would need more than `DROP.maxGainDb` (12 dB) is not a drop card: the
  three ticks, the wood block, the blip and the two chirps. A locked click noise that is a drop card is kept, so a
  click and then a drop share one sound; a quiet one gives way to the drop's own deck (THE DECK RULE);
- a sword or radial card the lock holds plays once WITH the first noise, never instead of the four;
- every drop noise played or refused (THE NOISE GATE's `sound: false`, MUTE ALL, before the first gesture, PAUSE ALL,
  no engine) is told through `onDropSound(fn)` and the window event `settle:dragsound`, with its reason.

Measured before and after (`SETTLE/runs/herodragfix/MEASURED.md`): the four noises' peak ran from -39 to -18 dBFS by
the card the lock dealt, so about two drops in five added under 1.5 dB over the DJ; after, every drop lands within a
few dB of -16 dBFS and every one measured adds 1.5 dB or more over the DJ.

THE CLICK'S LEVEL (lane HEROPASS, from HERODRAGFIX's note that "a click is the same lottery"). A single click takes the
same evening-out: `playClickNoise` brings each click noise toward the drop's target by `clickGainDb(k)`, the drop's gain
capped at `DROP.maxGainDb`, so the seven quiet cards rise 12 dB and stay a little under the rest rather than vanish.
The strength still scales a click, and an sfx card keeps its own level. `playClickNoise({ raw: true })` plays a card at
its own level, which is how `herodragfix_loudness.py --cards` measures the table. Measured
(`SETTLE/runs/heropass/clicklevel.py`, one click of each of the 24 at strength 0.6 into silence, the arms interleaved,
3 rounds, M5 in high power at load 19.71 on 18 cores, so BUSY): the peaks ran from -39.2 to -22.6 dBFS
(median -27.45, a 16.6 dB spread) at the cards' own level and from -27.3 to -16.0 dBFS (median -18.9,
11.3 dB, all of it the capped cards) evened out.

## THE SFX DECKS: the sword deck and the radial deck (sfx.js, sfx-decks.js)

Two decks of 50 short procedural sounds (lanes SWORDSWISH, ANIMEHIT, PSYRADIAL, HYPERRADIAL; navigator 2026-10-05:
"anime sword sounds on page load, and sometimes on click in the radial user click", "make 50 new other sounds for
radial clicks too"). Every sound is our own WebAudio synthesis: no sample, no recording from any film or game.

```
   THE SWORD DECK   sfx-sword-swish.js  SWORD_SWISH  25  swish, whoosh, swing, slash, blade draw, shing
                    sfx-sword-hit.js    SWORD_HIT    25  parry, ki charge, dash, impact, fighting-game hits
   THE RADIAL DECK  sfx-radial-psy.js   RADIAL_PSY   25  acid squelch, laser zap, sweeps, tape stop, warp
                    sfx-radial-hyper.js RADIAL_HYPER 25  bitcrush, wavefold, glitch, granular, ring mod
```

THE FORMAT (ruled in `SETTLE/runs/animesfx/CHANNEL.md`): each lane file exports one frozen array of entries
`{ id, name, kind, deck, lane, dur, provenance, render(ctx, at, dest, opts) }`. `render` builds every node from `ctx`,
schedules from `at` into `dest`, returns its end time and takes `{ strength = 1, seed = 1 }`; the seed gives all of its
variation (no `Math.random`), so one seed renders the same samples twice. Nodes are the subset Gain, Oscillator,
BiquadFilter, WaveShaper, BufferSource, Delay, StereoPanner and ConstantSource; anything sample-level is computed into
a `createBuffer`. The tone rules of the clicks hold (envelopes from zero to zero, attack 4 ms or more, release 60 ms
or more, a raw saw or square low-passed at 2.4 kHz first) and every sound ends in a low-pass at or below 9 kHz.
`provenance` is `{ method: 'procedural', made, recipe }`.

THE LOADER (`sfx-decks.js`): `sfxDecks()` returns `{ sword, radial, all, owed, found }`. Under vite it finds the four
files with a LAZY `import.meta.glob` (since lane BUNDLESLIM, 2026-10-07: the 100 sounds are their own chunks, not
part of a page's first load); in node it imports each by its URL. Either way `loadSfxModules()` does the load, once a
page however often it is asked, each file with a catch, and `sfxLoaded()` says when it has finished; until then the
decks are empty and a trigger plays nothing. The site calls it once the browser is idle after the first render, and
the page-load sound waits for it. A file that has not landed is an empty deck and its lane is listed in `owed`, so the
four files land in any order.

THE TRIGGERS (`sfx.js`):

- **The page load and a page change.** The site calls `sfxPage({ key })` with each page's key: the first call is the
  load, which waits up to 1.5 s for a running context (THE START RULE: a refused page lets it go, because the visitor's
  first click makes its own sound); a later call with a new key is a page change, at most one per 700 ms.
- **The radial user click.** `clicks.js` draws THE CLICK LOCK's cycle from `createClickCards`: one deck holding the 24
  click noises and the radial deck's 50, and a 4-card share deck in front of it, so exactly one lock in four (at a
  random place in each round of four) deals a sword sound instead. A locked sword or radial sound replays through the
  burst like a click noise and reports `{ index: -1, family: 'sfx-<deck>', id }`.
- **The machine's random waves.** `armSfx()` (once at boot) listens to settle-see's `settle:pulse`; a wave `from:
  'sound'` (a song's pop) deals from a 12-card share deck with one sword card, and never sooner than 6 s after the last
  machine sword: at the pops' usual one a second, a quiet sword sound every 12 s or more. A person's wave never counts.

THE RULES: everything plays through one sfx channel at the clicks' level (`SFX.level` is `CLICK_TONE.level`), with a
little room, into the page's one limiter, on the next 25 ms flash line of THE MASTER BEAT, and with a copy into the
engine's 'picture' tap when there is one. MUTE ALL builds nothing; PAUSE ALL plays nothing; a hidden tab or a halted
page plays no page or machine sound. `playSfx({ deck | id | entry, strength, pan, at, reason, seed })` plays one
directly; `onSfx(fn)` and the window event `settle:sfx` report each one.

LOUDNESS, measured in headless Chromium's OfflineAudioContext at strength 1, straight into the destination (the 24
click noises the same way: loudest peak -15.4 dBFS, loudest 50 ms RMS -22.8, median peak about -20): the sword swish
deck sits at peak -19.0 to -20.5 dBFS and 50 ms RMS -25.5 to -35.7, so every sound is under the clicks' loudest and the
deck's median sits at the clicks' median peak. Each lane's table is in `SETTLE/runs/animesfx/`. Hear all 100 one by one
in a dev build: `?sfx=1` on the site (`devtools/sfxaudition/`). Tests: `tests/sfxwiring.test.mjs` (the loader, the
deck's shape and tone rules on the graph, the triggers) and ANIMEHIT's `tests/sfx.test.mjs` (every sound rendered by
`tests/offline.mjs` and measured against the clicks).

## THE PAGE CHIMES: one quiet chime per page change (pagechime.js, pagechimes.js)

Fifty short, quiet sounds, one of which plays each time the visitor changes page, on top of the page's own sound
(lane PAGECHIMES, 2026-10-09). Each is a recipe of plain parameters in `src/pagechimes.js`, played live; none is a
recording.

- **THE DJ'S PARTS.** Every pitched note is one of THE DJ's own instruments through `instruments.js` `playNote` (the
  clear flute, the harp, the bells, the crystal, the lo-fi keys, the soft pluck), on THE DJ's scales from
  `tuning.js` (`MODES`, `scaleMidi`, A = 432). Each note's velocity comes from `voice-fx.js` `INST_PEAK`, so every
  voice reaches the same envelope peak. The breaths are the engine's own seeded noise (`engine.js` `noiseBuffer`)
  through a band-pass. Four small voices of our own fill the rest under THE TONE RULES: a sine blip, a sine glide, a
  breath, and a string harmonic.
- **THE SIX FAMILIES.** FIGURE (22: two to four quick notes, "bing boop de doop"), SETTLE (8: hot notes scattered
  high that cool onto the root), RECALL (6: a note and its softer echo, a cue and a reply), BLIP (6), BREATH (4),
  HARMONIC (4). `PAGE_CHIME_RECIPES` lists them; `PAGE_CHIMES` is the same 50 in the sfx deck format (`deck:
  'chime'`), so `tools/sfx_levels.py --mod ../src/pagechimes.js --exp PAGE_CHIMES` measures them as it is.
- **SHAPE.** Every chime is 120 to 600 ms. One gate lifts from 0 over 4 ms and falls linearly to exactly 0 at the
  recipe's end, with a fade of at least 60 ms, so a bell that would ring on is ended without a click.
- **DISTINCT.** `recipeFingerprint` hashes every sounding field (never the name), and no two of the 50 share one.
  Rendered, every pair stays under the decks' ruled likeness of 0.95 (`tests/offline.mjs`, max 0.939), and under it
  in Chromium too (`tools/sfx_levels.py`, max 0.949).
- **LEVEL.** `CHIME_TRIM_DB` brings each chime to -40.00 dBFS at the master input through the chime fader
  (`PAGE_CHIME.level` 0.55), measured in Chromium's OfflineAudioContext by `python3 tools/pagechime_levels.py`. THE
  DJ's quietest symphony voice (the crystal at velocity 0.6 through the symphony's fader 0.55) peaks at -33.87 dBFS,
  so every chime sits 6.12 dB under it. Layered 50 ms after the loudest sword page card, the worst combined peak is
  -27.93 dBFS against the click noises' cap of -20.56 dBFS. `tools/pagechime_levels.mjs` measures the same in node
  (within 3 dB per chime); the test suite runs it. The binaural pair is never touched.
- **THE TRIGGER.** `sfx.js` `sfxPage` hands every page change (a new page key, never the first load) to
  `pageChimeChange`, after the page's own sound, so the chime lands `PAGE_CHIME.offsetMs` (50 ms, two flash lines)
  behind it on THE MASTER BEAT's grid. The table is fetched on demand (`loadPageChimes`), 1.5 s after the first page.
- **THE ROTATION.** THE DECK RULE: one `indexDeck` over the 50, a fresh seed per visit. A refused chime deals no
  card. An audition by id (`playPageChime({ id, audition: true })`, the #/hear list) deals none either.
- **SILENCE.** Nothing builds an AudioContext: with no engine, or before the visitor's first gesture, a chime is
  refused. MUTE ALL, a master volume of 0, PAUSE ALL, a hidden page and the switch OFF refuse it, and `addChimeVeto`
  lets the site add more (the hero's own sound pause). `chimeRefusal()` names the reason; `onPageChime` and the
  window event `settle:pagechime` report every chime played or refused.
- **ONE AT A TIME.** A newer chime fades the one still sounding to 0 over 30 ms at its own start, so rapid page
  changes never stack. Cleanup waits run on THE SOUND CLOCK. A chime never ducks THE DJ.
- **THE SWITCH.** `pageChimes` (`on`, `setOn`, `toggle`, `subscribe`), ON by default, kept for the visit in
  sessionStorage under `settle-hear:pagechimes`.

Tests: `tests/pagechimes.test.mjs` (the table, the shape, distinctness, the levels, the deck, the trigger, the
silences, rapid changes, the switch, the audition) and `tests/pagechimes_start.test.mjs` (THE START RULE and PAUSE
ALL, in its own process).

## The heartbeat: the hero step's sound (heartbeat.js)

The navigator: "the LEFT and RIGHT keyboard keys make the HERO go next and previous! With a BADUMP! And a sound".
`playHeartbeat({ strength, pan, theme })` plays a short heartbeat: two low soft thumps `HEARTBEAT.gapMs` (140 ms) apart,
the second 1.4 times the first (ba-DUMP), each a sine falling from 70 Hz to 45 Hz with a partial at twice the pitch
(0.35 of its level, so a small speaker that cannot play 45 Hz still hears the beat), and one gentle sine on THE DJ's
key (`heartbeatKey`: the playing theme's root through `jamKey` and `midiHz`, folded into 196 to 392 Hz; no theme gives
A3 at 216 Hz on A = 432), quieter than either thump, starting with the second. The first thump starts on THE MASTER
BEAT's next 25 ms flash line, as a click noise does. Every envelope starts and ends at zero (attack at least 4 ms,
release at least 60 ms); sines only.

It plays through its own mixer channel at the click channel's level (`createChannel`, level 0.55), so it passes the
master, the radial pulse's swell and MUTE ALL's gain like every other hero sound. It returns null and builds nothing
before the first gesture, under MUTE ALL and while the page is away. **It takes no click lock**: it is one fixed sound,
so a lock (which holds a choice among sounds) has nothing to hold; the site's step throttle (one step per 250 ms)
bounds how often it plays.

**THE LEVEL, MEASURED** (`renderPlan` sums the voices in plain JS as the audio graph draws them, 16 kHz):

```
                                       peak     loudest 50 ms RMS   at the channel's 0.55
heartbeat (strength 1)                 0.0442   0.0238              -32.3 dBFS peak
the softest hero click (strength 0.52) 0.0567   0.0312              -30.1 dBFS peak
the loudest click (strength 1)         0.11                         -24.4 dBFS peak
```

So the heartbeat sits under every click a visitor's hero click can make, in peak and in RMS, and `tests/heartbeat.test.mjs`
holds it there. The site plays it only while the hero's own sound is on. Pure helpers: `heartbeatPlan`,
`renderPlan`, `heartbeatKey`.

## The sound's answer to a radial pulse (pulse.js)

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

## THE DECK (deck.js)

Every cycle here deals like a deck of cards (THE DECK RULE, `sites/CLAUDE.md`): THE DJ's theme changes
(`createThemeDealer`) and its away beats (`createBeatDealer`, the pull home stays a weighted draw), the flute's tunes
per theme (`createTuneDealer`), the house passes (`createPassBag`) and the chime's chord roots (`createChimeRoots`).
`src/deck.js` is a byte-identical copy of settle-see's `src/deck.js`, kept so settle-hear imports nothing from
settle-see; `tests/deck.test.mjs` fails when the two differ. The click noises' bag (`clickBag`) is lane CLICKLOCK's.

## Tests

`npm test` runs every file in `tests/` with node's own runner: 356 tests in 45 files, all passing on 2026-10-05
(count them again rather than quoting this). No browser is needed: the audio graph runs against a fake AudioContext
(`tests/fakeaudio.mjs`). The first tests cover the mapping (clamped, NaN-free, monotone, and a negative control that
garbage maps to silence), the switch (default on, persistence with a fake storage, a throwing storage, garbage in
storage, a negative control without storage), the presets, and the audio graph (no context before a gesture, the
limiter on the output, only finite values ever written to a parameter across every preset and a cooling run, mute to
zero and back, a stopped hearing building no oscillators, a quiet hearing scheduling no grains). Each section below
names its own test file.

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

**THE DJ IN THE PAGE'S LANGUAGE.** `HeroSymphony` takes a `words` prop, a function `(en, vars) -> string`. It is called
with the exact English templates in `react/lineWords.js`, for the line and for the big view a click on the line opens
(lanes AUDITHOME and FINISHDJ, 2026-10-09); a site looks each one up and fills its `{values}`. Without the prop every
word is English, as before. Names stay as they are: themes, moods, tunes and books, effects, drum and bass styles,
keys and the set's tag. The set's tag is shown in the big view only, never on the line.

| file | what it is |
|---|---|
| `src/tuning.js` | A = 432, the 40 Hz home, harmonics, the binaural pair, the mode's name |
| `src/abc.js` | a small ABC reader for the tunes |
| `src/tunes.js` | the tunes, each with its public-domain source, and the rule that refuses one without |
| `src/themes.js` | the five themes, plain data |
| `src/dj.js` | THE DJ: readHero, leans, anneal, createDJ (seeded, deterministic) |
| `src/dj-trained.js` and its siblings | THE TRAINED DJ: the house sets composed from THE DJ's models (section below) |
| `src/dj-skip.js` | NEXT AND PREVIOUS SET: the skip door and the visit's set history (section below) |
| `src/instruments.js` | flute, fiddle, harp, bells, crystal, drones, harmonics, the binaural pair |
| `src/symphony.js` | the player: bar by bar on the audio clock, a dry channel for the binaural pair |
| `react/Symphony.jsx` | useSymphony, HeroSymphony and the visualiser parts |
| `react/words.js` | the words helpers HeroSymphony uses at runtime (`enWords`, `whyWords`, `splitWords`, `clip`) |
| `react/lineWords.js` | every English template THE DJ line and its big view can show (`DJ_LINE_WORDS`, `DJ_VIEW_WORDS`, `DJ_WORDS`), for a site's catalogue |

Everything a sound or visual designer needs, every knob and how to add a theme, a tune or an instrument:
**`DESIGNER_GUIDE.md`** (English) and **`DESIGNER_GUIDE.ja.md`** (Japanese). Headphones are needed to hear a
binaural beat; nothing here makes a health claim. The symphony's tests are in `tests/symphony.test.mjs` and
`tests/visualiser.test.mjs`; `npm test` runs them with the rest.

## The house set and THE PASSES

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
Chromium (`runs/housedj/measure_audio.json`): 60 s through the first 25 passes peaks at -5.7 dBFS. That run came
before lane BINAURALMODES added the vocoder and the ring shimmer (25 and 26 in the table below) and lane HEROSHUFFLE
added 28 to 35; those ten passes are not measured in Chromium yet.

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
| 25 | `vocoder-static` VOCODER ON THE STATIC | mod | 16 | the picture's own static opens the sound's bands (a 6-band vocoder): the picture speaks the chord, quietly, under the dry sound | wet 0.35; bands 6 (180 to 4200 Hz) |
| 26 | `ring-shimmer` RING SHIMMER | mod | 8 | the sound multiplied by a sine an octave above the chord root, at a depth that breathes over twenty seconds: a slow glassy shimmer | depth 0.18; breath 0.05 (Hz) |
| 27 | `sweep-in` SWEEP-IN BUILD | filter | 2 | when the chain arrives it starts muffled and half as loud, and opens over four bars into full sound | from 300 (Hz); to 16000 (Hz); bars 4 |
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

## THE SPECTRUM SETTLE

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

## The binaural modes, the tone rules, the vocoder

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
  VOCODER ON THE STATIC and RING SHIMMER (passes 25 and 26 in the table above).
- `src/tone.js` and `TONE_RULES.md`: the envelope floors, the saw ceiling, the detune, the level aims; every voice
  keeps them and the tone test checks each one.


## THE JAM: instruments to hit and one looper (jam.js)

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

## THE LAYERS and YOUR TRACK (layers.js, yourtrack.js)

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

## THE SETTLE DJ: two modes, the composer, the planner and the mix machine

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
Since lane DJWIRE the hero's sets come from THE TRAINED DJ (section below): its trained planner takes this planner's
place while a trained set plays, and this planner is the fallback.

**The mix machine** (`mix-machine.js`) settles eleven p-bits once a bar on the master beat. Their leans come from the
section, the picture, the theme, the visitor's steering and the votes; their pulls make them agree (the drums and the
bass come in together; the wash and the drums disagree). Inside a phrase each thing leans hard to stay, so the mix
moves on phrase lines.

**The rack** (`mix-rack.js`) is one registry over the 35 house passes and the fx modules, every parameter with a
range. The DJ moves each effect's amount over the bar. **The tag** (`dj-tag.js`) packs the whole situation into one
string; `playTag(tag)` rebuilds it. A rating is stored against one tag, and well-rated tags lean the DJ
(`dj-votes.js`). Each set leaves an influence record, and the next set reads the last four through a decaying window
(`dj-influence.js`). The deep study of every house effect is `wikis/WIKI_HOUSE_SOUND/`.

## THE TRAINED DJ: the house sets composed from THE DJ's models (lane DJWIRE)

The navigator: bring THE DJ's trained models into the live site. Since lane DJWIRE (2026-10-06) the hero's house DJ
composes each set from the GRIDLEARN models (stages 1 and 2, `SETTLE/gridlearn/`): which roles play in each 8-bar
block, where the drops land, the phrase events, a groove for every bar, the swing and the played feel. It does this
inside the existing house machinery: the same mix machine, layers, kits, rack, moves, tunes, steering, votes, tags
and DJ's desk, on THE MASTER BEAT's 120 bpm bar grid.

```
  new set ──▶ a genre family dealt from the theme's (THE DECK RULE) ──▶ settleTrainedSet (dj-trained.js)
              line plan + drop pull ─▶ grid section by section ─▶ phrase events ─▶ a groove a block, a bar a bar
                                         │
  the trained planner (dj-trained-plan.js) reads it bar by bar:
     sections (intro, build, peak, breakdown, outro, then 8 bars of THE NEUTRAL HUM)
     moves where the set changes (a riser over the settled lift bars into a drop, a snare roll, a reverse cymbal
       into the settled crash, a downlifter on the drop, the old DJ's breakdown, outro and hum moves)
     the block's layers ─▶ the mix machine as strong leans (TRAINED_LEAN 2.4; steering, votes and holds still apply)
     the bar's settled groove ─▶ mix-layers.js plays it through the set's kit (dj-trained-play.js), with the
       turnaround's bass walk on its settled bars
```

| file | what it is |
|---|---|
| `src/dj-trained.js` | the port: the line plan, the drop pull, the merged grid, the phrase level, the grooves with THE ON RULE, the feel, levels, hat voices and clap; `settleTrainedSet(models, family, { seed, blocks })`; `loadTrainedModels()` (a lazy import) |
| `src/dj-trained-models.js` | the models, GENERATED by `SETTLE/gridlearn/export_dj.py` (parameters and aggregate tables only, no song); its own chunk in the site's build (about 320 kB, 119 kB gzipped), loaded only when the trained DJ is wanted |
| `src/dj-trained-plan.js` | the trained planner: sections, drops, exits, moves and block layers from a set, in mix-planner.js's bar shape |
| `src/dj-trained-play.js` | one bar of a trained groove through a kit, with swing and the played feel; the site's `#/gridlearn` player uses it too |
| `src/dj-brain.js` | `djBrain`, the store that says which DJ composes: `'trained'` (the default) or `'old'` |
| `src/dj-trained-notes.js` | stage 3's seam: a `djnotes-piece/v1` piece (lane DJNOTES) as a trained set with its notes |
| `src/dj-pieces.js` | the pieces, one at a time (lane PIECESPLAY): `loadPieceIndex()` (the cards), `loadPiece(id)` (one piece's module, fetched when dealt), `pieceLoads()` (the fetch log) |
| `src/dj-pieces-index.js`, `src/pieces/<id>.js` | the ten pieces' cards and one module a piece, GENERATED by `SETTLE/gridlearn/export_pieces.py`; each module is its own chunk in the site's build |
| `tests/piecesplay.test.mjs` | the export, one fetch a deal, THE DECK RULE with the settle card, the wait, the piece's own lead and key, the replay, the layers, and the symphony with the pieces on |
| `tools/dj_trained_measure.mjs` | the timing habits of the hero's decisions, trained against old, and of the trained grids against the report |
| `tests/djtrained.test.mjs` | the agreement with Python, the planner, the brain, the steering, the tag, the layers, the symphony and the seam |

**THE SAME SET AS PYTHON.** `SETTLE/gridlearn/dj_ref.py` builds every field with the training code itself
(`arrange2.py`, `phrasemodel.py`, `stage2lib.py`, `groovemodel.py`) and samples with this port's rule and stream
(settle-hear's `deckRng`, mulberry32): one site at a time in a random order, `u = 2 unit - 1`, `s = +1` when
`tanh(beta I) > u`. `export_dj.py` writes the models and a fixture of six whole sets (house, techno, ambient, breaks
with a drawn length, and two trance sets, one swung and one played); the port settles them identically, bar for bar,
and the first stages' fields match to 1e-9. The training scripts sampled many tracks at once in float32 with numpy's
stream; the port keeps their models and schedules and changes only the stream.

**THE BRAINS AND THE FALLBACK.** `createSymphony({ djBrain })` (the React mount passes the page store) loads the
models when `'trained'` is wanted; until they arrive, if they fail, or with `'old'`, the old planner plays exactly as
before. Without `djBrain` a symphony keeps the old DJ, so every older caller and test is unchanged. A change of brain
starts a new set on the next bar. `createHouseDJ({ trained, brainMode, pieces })`, `.setTrained(models)`,
`.setBrain(mode)`, `.setPieces(list)`. A full push of the theme lean sends a trained set to its warm-down at the next
8-bar line (after its first 32 bars). The decision carries `brain` and `trained` (family, seed, length, block,
layers, the bar's groove, the feel, and stage 3's notes); djLive carries `brain` and `trained`; the tag carries the
trained set (family, seed, length) after the voice chains, and a replay settles it again.

**THE MAPS.** Theme to families: crystals ambient or synth; highlands house or trance; deep sea techno or ambient;
cathedral ambient or trance; embers techno, breaks or house. Family to kit style: house chicago or deep, techno tech
or dub-techno, trance progressive, ambient ambient, breaks garage, eurodance filter-house, synth balearic, electronic
tech. Grid roles to mix layers: drums (kick, snare and clap, hats, perc), bass, pad (pad and chords), lead (lead or
vocal line), arps (arp), answer (vocal line), chain (fx and riser). A set's length is drawn from the family's own
quartiles of minutes at its own tempo, then played at 120 bpm.

**MEASURED** (`node tools/dj_trained_measure.mjs --seeds 12 --sets 3`, 2026-10-06, the M5, pure node, no audio; the
record is `SETTLE/runs/djwire/dj_trained_measure_2026-10-06.json`). Five themes, 12 seeds, 3 sets each, no steering:

| the hero's decisions | trained DJ | old DJ |
|---|---|---|
| sets | 180 | 180 |
| the kick back after 4 bars or more without it, on a 16- or 32-bar line | **82%** (60 of 73: 36 on 32, 24 on 16) | 39% (71 of 183, none on 32) |
| mix layers changed across a 32 / 16 / 8-bar line | 0.77 / 0.70 / 0.67 | 0.04 / 2.74 / 1.13 |
| mix layers changed on a bar inside a block | 0 | 0.044 |

The trained sets' own grids (10 roles, 120 sets a family) against REPORT_TIMING.md 7.2: drops on a 16- or 32-bar line
71% to 96% (the report's stage 2, held out: 79% to 94%; the data: 33% to 75%); mean section 12.9 to 15.4 bars (report
12.1 to 14.3); roles changed across a 32-bar line above the 8-bar line in every family, but by less than the report's
held-out check (house 1.33 against 1.20, the report 1.85 against 1.23): these sets take their arc from the bank's four
smooth shapes, where the report used each held-out song's own arc.

⚠ **NO FENCE IN THE BROWSER.** compose2.py checked every settled bar against the keys of real bars and settled again
the 3.1% within 2 steps of a song's distinctive bar. That corpus stays on the Spark (a rare key is one song's bar),
so a set settled here is not checked. It plays once and is not stored.

**STAGE 3, THE NOTE LEVEL (lane DJNOTES): THE SEAM.** DJNOTES writes settled, fenced pieces
(`SETTLE/gridlearn/results/pieces/<id>.json`, format `djnotes-piece/v1`, `SETTLE/DJ_CHANNEL.md`). `pieceToSet` turns
one into a trained set: its own arrangement, its drums track as the settled steps, its swing, and its bass, chords,
lead and arp notes moved to the theme's tonic. `setPieces(list)` makes the brain play a piece of the dealt family
in place of a settle; the layers then play its bass, arp and chords (the lead stays the DJ's tune). The pieces had not
landed on 2026-10-06; the wiring is tested on a hand-made piece. THE PIECE IN THE TAG (lane HEROPASS): a piece's set names the piece in its tag
(the piece id's 16-bit hash and the semitones it was moved by, after the trained block), so a replay plays the same
piece again, found by the hash in the brain's pieces; a brain without that piece never settles another set under its
tag. `decodeTag(tag, { pieces })` resolves the name for the parts popover.

**STAGE 3 PLAYS IN THE HERO (lane PIECESPLAY, 2026-10-06; navigator: "the piece's own lead, play minor as it
is").** The sentences above about the theme's tonic and the DJ's tune were the seam's first state; this paragraph
replaces them.

- **ONE PIECE AT A TIME.** `SETTLE/gridlearn/export_pieces.py` writes `src/dj-pieces-index.js` (ten cards: id, name,
  family, key, size, the note fence's numbers; 3.8 kB) and `src/pieces/<id>.js` (one module a piece, 36.9 to 270.9
  kB). The symphony loads the cards with the trained models and hands them over with `setPieces(cards, { load:
  loadPiece })`; `loadPiece(id)` imports one module when the DJ deals that piece, never all ten. `export_pieces.py
  --check` refuses a hand-edited module.
- **THE DECK.** Each family's deck holds its pieces and one SETTLE card (a set settled live from the models), so a
  round plays each piece once and one live settle once (THE DECK RULE). Eurodance has no theme in `THEME_FAMILY`, so
  Neon rush joins highlands' family deck as a piece-only family (`PIECE_ONLY_FAMILIES`).
- **THE WAIT.** A dealt piece plays from the first bar line after it arrives; until then the set before plays on, at
  most `PIECE_WAIT_BARS` (4) bars, then a live settle plays (never silence). When a set reaches its warm-down the next
  deal is peeked and its piece fetched, so a natural set change finds it ready.
- **AS WRITTEN.** While a piece plays, the lead is the piece's own lead track (`d.lead.kind` `'piece'`, each note on
  its sixteenth), the bar's root, mode and chord are the piece's (`pieceRoot`, `pieceMode`, `chordOfBar`), a minor
  piece stays minor under any theme, nothing is shifted or key-lifted, and the old tune never surfaces. The pad,
  drone, answer and arps follow the piece's key. The decision's `piece` names it (id, name, key, the chord of the bar)
  and its first bar carries the deal's clock; the symphony fires `settle-hear:piece` then. A replay of a piece's tag
  fetches the piece and loads it on the bar it arrives.

## NEXT AND PREVIOUS SET: the skip door and the set history (dj-skip.js, lane DJSKIP)

The navigator: "for the DJ, we do need some sort of next and previous buttons that let us move next and previous on the
DJ system, from track to track." Two doors and one history; the site's glyphs are THE CONTROLS LINE in the hero's left
block (`sites/CLAUDE.md`).

```js
import { nextSet, replaySet, createSetHistory, djLive } from 'settle-hear';
nextSet();                       // the playing symphony ends the set on its next bar line and starts a new one
const h = createSetHistory();    // the visit's sets, fed by the tags the symphony emits
djLive.subscribe((s) => h.observe(s.tag, { theme: s.theme }));
const e = h.back();              // the set before (null at the first set); replaySet(e.tag) plays it from the next bar
```

- **THE DOORS.** `nextSet()` and `replaySet(tag)` are messages on `djSkipRequests`, like playTag's live door
  (`djTagRequests`). The symphony keeps the last request and takes it at the top of its next `runBar`, so the change
  lands on the bar line. A playTag request after a skip request replaces it, and the other way round. Each returns
  how many symphonies heard it (0 with nothing playing).
- **NEXT IS A NATURAL SET CHANGE.** In house mode the symphony's `nextSet()` calls the brain's `nextSet()`
  (`mix-dj.js`): the same restart a brain switch makes, so the trained DJ settles a new set when it is on and the old
  planner opens one otherwise. The symphony then moves the theme and fires the set hooks (`dj.onSetCycle` and the
  `settle-hear:set` page event, reason "a new set"), as at a set's natural end. With the McKusker flute it moves to the
  next tune; with the classic DJ, to the next theme. A skip out of the opening blend yields it first.
- **PREVIOUS PLAYS A SET AGAIN.** `replaySet(tag)` is a playTag on the bar line plus the set hooks (reason "a replayed
  set"). The history keeps each set's tag from its SECOND bar: a bar-0 tag would meet the planner's new-set branch on
  its first bar and compose a fresh tune over the loaded one.
- **THE HISTORY** (`createSetHistory({ cap })`, 64 sets): `observe(tag, meta)` answers `'new'` when the tag starts a
  set (`isNewSet`: an opener began or ended, the set number, the theme or the mode changed, or the set's bar went back;
  a new set cuts any forward history, as a browser does), `'upgrade'` when the newest entry takes its second-bar tag,
  and `'replay'` for the first new tag after a `back()` or `forward()`, which pushes nothing. `back()` and `forward()`
  move the cursor at once (two presses before the bar line walk two sets) and return the entry to replay, null at either
  end; `cancel()` takes the last move back when its replay reached no symphony.
- **A SKIP IS NEVER A VOTE.** Nothing in the skip path writes `djVotes`, a rating or the bandit.
- **A FIX ON THE WAY:** the natural new-set branch passed `pickTheme`'s theme object to `setTheme`, which takes a key,
  so every new set without a wanted theme fell back to `themeOf`'s default, highlands. It passes `.key` now.

Tests: `tests/djskip.test.mjs` (the identity rule, the walk, the cut, the cap and `cancel`, the doors, NEXT on the old
DJ landing on the very next bar with the theme moved and the hooks fired once and no vote, PREV bringing the first set's
theme and tune back announced as a replay, NEXT on the trained DJ settling a new seed, and the last request winning
between the skip door and playTag; NEXT with the McKusker flute playing its next tune, and with the classic DJ moving to
the next theme). Every one of them was proven to fail under an aimed mutation.

## THE SET SEEN WHOLE: dj-view.js (lane DJVISUAL)

The trained DJ settles a whole set in one shot, so a page can draw it whole. `setView(set)` turns a trained set into
one small read-only view, built once per set (a WeakMap) and frozen: `{ format: 'dj-view/v1', family, seed, blocks,
bars, roles, grid, gates, lines, drops, exits, sections, arc, events, feel, clap, piece, fence, notes }`. `lines` is
`lineKind` per block (0 a 32-bar line, 1 a 16-bar line, 2 an 8-bar line: where a drop WANTS to land), `drops` where
it DID (`dropsOf`), `sections` each block's section. `fence` is `'spark'` for a piece DJNOTES fenced and `'none'` for a
set settled in the browser, never more. `barOfSet(view, setBar)` says where a bar sits (block, a drop now, the next
drop, the section); `grooveView` and `tuneView` turn a bar's groove and a composed tune into plain numbers.

The trained planner hands the view on every bar (`trained.view`, the same object all through the set and its
warm-down), and djLive carries it by reference with `setBar`, `trained.seed`, `trained.groove` (the bar's steps as
levels), `trained.notes`, `layers` (the mix machine's eleven yes or no, what the old DJ plays) and `music` (the bar's
chord, root and mode, and the composed tune's notes, at most 48). A reader sees a new set by the view's identity. The
site's THE DJ VISUALISER draws it (`sites/CLAUDE.md`). Tests: `tests/djview.test.mjs`.

## THE BASES

A BASE is a house or ambient rhythm bed in our own JSON (`settle-base/1`, spec in `BASE_FORMAT.md`): a tempo range, a
meter, a tick grid (4 a beat for house, 8 for ambient; one house base in the library uses 8), a swing, a key, and
separate PARTS (kick, snare, hats, perc, bass, chords, lead, texture) as events `[tick, length, level, pitch]`, each
part with its features (density, syncopation, energy, register) and the whole with a signature (family,
four-on-the-floor, backbeat, key). The library in `bases/` is 300 bases, 150 house and 150 ambient: 224 imported from
open MIDI (the Groove MIDI Dataset, CC BY 4.0; Mutopia, public domain, CC BY and CC BY-SA; OpenGameArt, CC0 and CC BY)
and 76 authored from the family recipes. A base is named `base-NNNN` and carries no source; `bases/ledger.json` and
`LEDGER.md` hold every source, licence, download date and sha256. The raw MIDI is never shipped.

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
| `tools/bases_build.mjs` | rebuilds `bases/` from a sources manifest; `node tools/bases_build.mjs --sources <json>`. It writes the base files, `index.json`, `ledger.json`, `LEDGER.md` and `BUILD.md`; edit none of those by hand |
| `bases/LEDGER.md` | the source of every base as a table: title, author, link, licence, download date and the first 16 hex digits of the raw file's sha256 (`ledger.json` holds all 64 and the licence text) |
| `bases/BUILD.md` | the last build's report: the counts, the quantise error, and the 160 imported files left out, each with its reason |
| `tests/bases.test.mjs` | 15 tests on a written MIDI fixture, the library on disk and a fake audio context |

The theory and the formulas, with their sources: `wikis/WIKI_DJ_THEORY/`.

## THE OPENING BLEND: every visit's first set (opener.js, opener-tag.js)

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

## THE VOICE CHAINS: every melodic instrument through its own effects (voice-fx.js)

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

## THE VOICE CHAINS, EVERYWHERE: every melody in every mode

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

## THE DJ'S DESK: moods, the settle's flavour, and the overdo (dj-fx.js)

The navigator, after playing with the desk on `#/hear`: "Can the DJ have access to all this stuff too? And it can
overdo it sometimes on delay or reverb ... some random 10% or 20% of the time ... The rest of the time the DJ just has
access to make it nice, and has some good profiles to select from: moods. And our settle chooser can choose the mode of
the distortion and the resonance." The hero symphony now plays through the DJ's own effect bus.

- **THE BUS (`createFxBus`):** input, a drive (a dry path and three shapers crossfaded by gain), a resonance (a peaking
  band), a tone (a lowpass), a room and a hall reverb, a tempo-synced delay, a trim, and a bus limiter, then the
  engine's master, mute and master limiter. The symphony's wet channel, the house set and the opener play through it.
  The binaural pair does not: it stays on its own dry channel, so the 40 Hz beat and each ear's tone are untouched.
  Each section is built the first time its amount is above zero, so a muted page builds none of them.
- **THE MOODS (10; nine dealt by THE DECK RULE, `createBag`, and OVERDRIVE from its own deck, see THE DJ's OVERDRIVE
  AND VOCODER below):** a mood lasts 4 phrases of 4 bars, or until a new set, and changes on a phrase line only. Values: reverb send, size (room 0 to hall 1), delay send, feedback, delay time in
  beats, tone in Hz, drive mix, drive gain, resonance in dB.

| mood | reverb | size | delay | fb | time | tone | drive | gain | res dB |
|---|---|---|---|---|---|---|---|---|---|
| CLEAN | 0.08 | 0.2 | 0 | 0.2 | 3/4 | 16000 | 0 | 1 | 0 |
| WARM ROOM | 0.22 | 0.25 | 0.06 | 0.25 | 3/4 | 7000 | 0.25 | 1.6 | 2 |
| CATHEDRAL | 0.55 | 1 | 0.05 | 0.3 | 1 | 9000 | 0 | 1 | 1.5 |
| DUB ECHO | 0.18 | 0.4 | 0.35 | 0.55 | 3/4 | 5200 | 0.2 | 1.8 | 3 |
| TAPE | 0.15 | 0.3 | 0.18 | 0.4 | 1/2 | 6000 | 0.45 | 2.2 | 2 |
| OVERDRIVE | 0.1 | 0.2 | 0.06 | 0.3 | 1/2 | 11000 | 0 (the valve: blend 0.85, push 4) | 1 | 2.5 |
| UNDERWATER | 0.35 | 0.7 | 0.15 | 0.45 | 1 | 1400 | 0.1 | 1.4 | 6 |
| SHIMMER | 0.45 | 0.9 | 0.22 | 0.5 | 1/2 | 14000 | 0 | 1 | 3 |
| NIGHT RADIO | 0.12 | 0.3 | 0.1 | 0.35 | 3/4 | 3400 | 0.35 | 2.4 | 5 |
| ATTIC | 0.3 | 0.45 | 0.1 | 0.3 | 1 | 4800 | 0.15 | 1.5 | 2 |

- **THE SETTLE CHOOSES THE FLAVOUR (`settleFlavour`), once a phrase.** The mood sets how much; the settle sets which kind.

| reading | low (< 0.34) | middle (< 0.67) | high |
|---|---|---|---|
| agitation = 0.6 heat + 0.4 flips | SOFT CLIP (tanh) | FOLD (sine fold) | CRUSH (amplitude steps) |
| energy = 1 - settledness | LOW 320 Hz | MID 900 Hz | HIGH 2400 Hz |
| overlap (agreement with the target) | SHARP Q 7 | FIRM Q 3.5 | GENTLE Q 1.4 |

- **THE OVERDO:** once a phrase the DJ deals from a seven-card deck (six calm cards, one OVER), so one phrase in seven
  overdoes one effect: too much delay (send 0.6, feedback 0.74), too much reverb (0.85, all hall) or too much
  distortion (mix 0.9, gain 4.5). The seam rule of the deck means two overdone phrases never follow each other, and the
  visit's first phrase is calm. Measured over 60 seeds and 8,400 phrases: 1,200 overdone, 14.29%.
- **SAFETY:** every value passes `CAPS`; the delay feedback is capped at 0.78 with a lowpass in the loop; each drive
  curve satisfies |curve(x)| <= |x| and its post gain is loudness-matched to the dry path (`driveMakeup`, at most x2);
  `trimFor` lowers the bus as the wet returns rise; the bus limiter (-6 dB, ratio 20) holds the peaks, and a fixed gain
  after it takes back the makeup gain every Web Audio compressor adds on its own (+3.4 dB at these settings).
- **MEASURED LEVELS (`python3 tools/djfx_levels.py`, an OfflineAudioContext in headless Chromium, a hero-like mix,
  8 s, through a copy of the engine's master chain):** the old dry path peaks at -6.70 dB, RMS -22.54 dB. Every mood
  and every overdo measured sits at RMS -22.73 to -24.05 dB and peaks at -6.55 to -13.79 dB; the worst peak is 0.4703 of
  full scale. Nothing clips, and no mood or overdo is louder than the path it replaced. Record:
  `SETTLE/runs/djfx/levels_2026-10-04.txt`.
- **SMOOTH:** every change is a ramp on the bar line (0.6 s into a mood, 0.35 s into an overdo, 1.2 s out of one); a
  drive mode change crossfades shapers that are already running; the delay time glides over 0.8 s.
- **THE STEERING (`steer.js` fx part):** `{ mood, reverb, delay, drive, tone }`, each null for "the DJ decides". A set
  value overrides the DJ for that effect, and an overdo never touches an effect the visitor holds.
  `symphony.setFxSteer(fx)` applies it directly; both land on the next bar line.
- **HELD:** the opening blend and the McKusker flute keep the bus dry (`DRY`), and the decks do not move while held.
- **VISIBLE:** the DJ line names the mood and marks an overdo ("DUB ECHO · too much delay"); `djLive.get().fx` carries
  `mood`, `moodLabel`, `overdo`, `overdoLabel`, `held`, `steered`, the flavour and every effect value; the site's corner
  glyph says the mood on its sound line.
- Tests: `tests/djfx.test.mjs` (the moods, the deck, the flavour table, the overdo rate and spacing red-proven by
  shrinking the calm deck to two cards, the caps, the limiter on every path, the lazy sections, the steering, the
  symphony through the bus, MUTE ALL and the held pure flute).

## THE DJ's OVERDRIVE AND VOCODER (dj-colour.js, dj-colour-stage.js, lane DJOVERDRIVE)

The navigator: "I'm loving the overdrive energy of just turning the volume up in the headphones. So THE DJ gets about a
20% chance of OVERDRIVE MODE, which is just another mode with more overdrive (refit one of the existing modes with
this), and put it a bit on some effects too, at random, and especially on the tunes we play, the melodies, and
sometimes on the McKusker flute too. Overdrive, harmonic. And add a vocoder sometimes: a vocoder warble on some, and
just on for some. You decide."

- **OVERDRIVE IS GRIT REFITTED.** GRIT was already the desk's driven mood, so a second drive mood would crowd the deck.
  OVERDRIVE keeps GRIT's short room and swaps its symmetric drive for a valve stage on the bus (`createTube`). It
  leaves the mood bag, which now deals nine moods, and comes from its own five-card deck (`OVERDRIVE_DECK`: four calm,
  one over), dealt once a phrase. THE DECK RULE's seam means two OVERDRIVE phrases never follow each other, and the
  visit's first phrase is calm. Measured over 60 seeds and 8,400 phrases: 1,680 OVERDRIVE phrases, 20.00%, none two in
  a row. The mood the bag dealt stays underneath (`baseMood`) and comes back after.
- **THE VALVE (`tube(u)`):** an asymmetric soft clip, `tanh(k u) / k` with a knee of 1.7 on the top half and 0.85 on
  the bottom, so a pushed voice rounds its top early and its bottom late. The two halves differ, so the output carries
  even harmonics (the octave, warmth) as well as odd ones. Slope 1 at 0, `|tube(u)| <= |u|`, sign kept. The shaper and
  a straight-line twin on the dry leg are both oversampled 4x, so both legs carry the same latency and never comb. A 5 Hz
  DC block and a 9 kHz low-pass follow the curve. The stage is `(1 - a) x + a tube(g x) / g`: never louder than its
  input by construction.
- **ON SINGLE VOICES (`VOICE_DRIVE_DECK`, `PURE_DRIVE_DECK`):** outside OVERDRIVE phrases, once a phrase, the brain
  deals a harmonic overdrive onto one melodic voice: the lead two cards in eight, another melodic part one in eight
  (the answer or the arps in the house set; the harp, bells, crystal or fiddle in the symphony). Measured: 2,520 of
  6,720 calm phrases, 37.50%, the lead in 1,680 of them. In the McKusker flute's mode the flute itself is overdriven one
  phrase in four (2,100 of 8,400, 25.00%). The push follows the settle: a hotter, more agitated field drives harder
  (`voiceDriveOf`: blend 0.55 to 0.9, push 3 to 6).
- **THE VOCODER (`createVoiceVocoder`, our own synthesis):** once a set the brain deals a vocoder onto a voice
  (`VOCODER_DECK`: one warbling, one steady, four none; measured 720 of 2,100 sets, 34.29%, 360 warbling and 360
  steady). The voice is the modulator through vocoder.js's shared band bank; the carrier is the voice squared and a
  sawtooth chord on the set's root. A warbling set swings the carrier's delay and the saws' detune with one slow sine
  (0.35 to 0.6 Hz, about 25 cents); a steady set rests. The vocoder's rectifier curve has an odd point count, so a
  silent voice opens no band (with 512 points the carrier leaked through a silent modulator at peak 0.00125).
- **WHERE IT SITS:** a colour stage sits before a voice's own chain (`colourBuses`, a hook on voice-fx.js's buses and,
  through `createMixSet`'s `wrapVoices` option, on the house set's), so the part's effects, trim and mute gate come
  after it: a muted voice is muted with its colour. The binaural pair never meets a stage or the bus.
- **LOADED ON DEMAND:** the valve, the vocoder and the stage are `dj-colour-stage.js`, fetched when the symphony's sound
  starts (`loadColour`), so the site's first load does not carry them. Until they arrive nothing is built and the line
  names no colour.
- **THE LAWS KEPT:** MUTE ALL and the pause suspend the context, so the vocoder's oscillators stop with it; the
  steering store overrides (`overdrive` 0..1: the bus valve and every voice push, 0 never deals one; `vocoder` 0..1: 0
  never deals one, above 0 keeps one on, the lead's when none was dealt); THE SOUND CLOCK's bar line decides every
  change. THE DJ line and `djLive.get().fx` name the mood (`overdrive`, `baseMood`) and the colour (`colour`,
  `colourLabel`, only for the parts sounding now).
- **MEASURED LEVELS (`python3 tools/djoverdrive_levels.py`, an OfflineAudioContext in headless Chromium 148):** on the
  bus, OVERDRIVE sits at RMS -23.70 to -25.44 dB and peaks at -8.76 to -10.28 dB through the master chain, against
  CLEAN's -22.73 dB and -6.83 dB; the worst peak is 0.4624 of full scale. On the voices, every instrument loud and soft,
  the loudest coloured voice is 0.9825 of its dry RMS and 0.9880 of its dry peak. Record:
  `SETTLE/runs/djoverdrive/MEASURED.md`.

## THE SOUND AND THE PICTURE: the bands, THE WEATHER, THE WOBBLE (bands.js, weather.js, pulse.js, dj-fx.js)

The navigator: "The sonics must interrupt the picture, with MOVEMENT ONLY, like a TREMBLE, but subtle ... The drone,
mainly the main drone, and the deep things adjust the visual ... It goes both ways, but only on RADIAL EVENTS: user
clicks and user rectangles." settle-hear supplies the ears and the sound's half; it imports nothing from settle-see,
and the site joins the two (SETTLE/settle-site/src/soundShake.js and useSoundShake.js).

- **THE BAND TAP (bands.js).** `createBandTap()` connects the hero's channels (anchor `'hero'` and the unanchored ones,
  the same set a radial pulse answers) into one sum, a 250 Hz lowpass into a 1,024-sample analyser (THE LOW BAND: the
  drone, the bass, the deep melodies) and a 2.5 kHz highpass into a 256-sample one (THE HIGH BAND). Every channel now
  hands its last node to the pulse registry (`registerPulseTarget({ node })`), and `onPulseTargets` lets the tap follow
  channels as they come and go; a page instrument (anchor `'page'`) never joins. `read()` copies two time-domain windows
  into buffers made once and returns `{ low, high }` levels (an RMS over -66 .. -12 dB). The site reads it at 30 Hz.
  Pure helpers: `levelOf`, `rmsOf`, `createFollower` (breath: the level over 1.5 s; tremble: the 90 ms level minus the
  breath) and `createOnsets` (a jump past 1.8 x the 400 ms average and the floor, one every 90 ms at most).
- **THE WEATHER (weather.js).** Six profiles, how the low end should move a picture, as fractions of the picture's own
  heat, lean, pull and sweep rate, each fed by the breath and the tremble: BREATH, DEEP SWELL, TREMOR, UNDERTOW, COLD
  FRONT, SQUALL. THE DJ deals one a phrase by THE DECK RULE (createDjFx, its own deck; held: BREATH), plays it hard
  (x 1.5) on an overdone phrase, and publishes `fx.weather`, `fx.weatherLabel` and `fx.weatherHard` on djLive.
- **THE WOBBLE (pulse.js, the other direction).** `createWobble()` holds the waves a visitor started on the hero (a
  click: 3.2 s; a box: its own life); its energy is the sum of each wave's strength times `wobbleEnvelope` of its age (an
  80 ms rise, then (1 - u)^2, exactly zero at the end), saturated by `wobbleDepth` (cap `WOBBLE.calm` 0.45 or
  `WOBBLE.alive` 0.9). `soundWobble(x)` hands it to every registered bus; it sends 0 while MUTE ALL or PAUSE ALL hold.
- **THE WOBBLE STAGE (dj-fx.js).** THE DJ's bus gains a 6 ms delay line and a gain between its trim and its limiter;
  `bus.wobble(x)` ramps a 5.2 Hz LFO into the delay time (a vibrato of at most 0.45 ms either way, about 25 cents) and a
  3.7 Hz one into the gain as `1 - d/2 + (d/2) sin` with d at most 0.22, so it can only lower the level. The LFOs are
  built on the first wobble. The binaural pair plays on its own dry channel and never meets the bus, so its beat
  frequency never wobbles.
- **THE HITS.** `jam.js playOnEngine` announces every played hit (`soundHit({ key, family, looped, vel, delayMs })`,
  `onSoundHit(fn)`), so the hero can answer a visitor's hit or a loop's in its picture when it is heard.

Tests: `tests/soundshake.test.mjs`.

## 432 Hz McKUSKER MODE: when the flute plays, and its one mute (melody.js)

The navigator's word (2026-10-05): when a melody plays on the flute, or a clear simple melody, that is McKusker mode at
432 Hz, called **432 Hz McKUSKER MODE**, and the visitor can turn that voice off and on like a mute button. The name
is one constant, `MCKUSKER_MODE_NAME` in `src/tuning.js`, beside `FLUTE_MODE_NAME` and `FLUTE_SOUND_NAME`; the
spelling of McKusker is unconfirmed and lives there only.

- **WHEN THE FLUTE PLAYS.** The symphony reads it from its own plan on every bar and publishes it as
  `state.melody` and `djLive.get().melody`: `{ voice, present, muted }` (`melodyOf` in `src/melody.js`). It is present
  in pure mode (THE McKUSKER FLUTE) while a collected tune runs, in the tune mode when the dealt lead is a flute, and
  in the house set while its LEAD layer is in and its lead is a flute. The flutes are `MCKUSKER_VOICES`, the clear
  flute and the distorted flute; the keys as a lead do not count. It is absent while the opening blend holds the set,
  while the flute track is steered out, and whenever the symphony is not heard (a pause, MUTE ALL, no gesture yet).
  It reads the plan, not the notes, so a note held across a bar line does not make it flicker.
- **THE MUTE.** `melodyMute` is one store a page load (`get`, `set`, `toggle`, `subscribe`). The symphony closes the
  flute at once, never on the next bar line, through a gate after the voice's chain: the symphony's lead bus and the
  house set's lead bus (`createVoiceBuses` `mute(slot, on)`, `createMixSet` `muteSlot`; a bus built later is born
  muted) and the pure flute's own gate, in 120 ms (`MELODY_FADE`). The DJ goes on deciding as before: the plan, the
  tag and the steering do not change, so the site's tag stays visible and a second press brings the flute back. A
  symphony mounted later reads the store, so the mute lasts the visit. MUTE ALL is the engine's and still wins.
- The site's tag at the right end of the hero's tags row reads this: `SETTLE/settle-site/src/feedback/mckusker.js`.

Tests: `tests/mckusker.test.mjs` (the name, `melodyOf`, the snapshot, a bus mute that leaves the other buses open, a
pure flute closed at once with the plan and tag unchanged, a symphony born muted).

## THE GUITARS: the echo guitar and the psych guitars (echoguitar.js, djguitars.js)

Three electric guitars of our own that THE DJ can deal, each a phrase voice rather than a playNote instrument, all
loaded on demand in one chunk: `echoguitar-lazy.js` fetches `djguitars.js`, which re-exports `echoguitar.js`, so the
site's first load carries only one small loader and one call a bar in `mix-layers.js`.

- **THE ECHO GUITAR** (lane ECHOGUITAR, `echoguitar.js`): a few notes and a slide through a tempo-locked echo and a
  small room, dealt as a set's answer. Its measurement is `SETTLE/runs/echoguitar/`.
- **THE FUZZ LEAD** (lane DJGUITARS, `djguitars.js`, tag `fuzz-lead`): two sawtooths 3 cents apart, a fuzz with its
  gain and bias inside the curve (gain 20, bias 0.3, 4x oversampled, a DC block), the '59 Bassman tone stack as
  biquads, a cabinet (150 Hz high-pass, two low-passes at `CABINET_CORNER_HZ`), a squash made of nodes, a Small Stone
  shaped phaser (two all-pass biquads at Q 0.5, ±1,800 cents around 682 Hz, a triangle at 0.15 Hz), a tempo-locked
  tape echo (a dotted eighth, its loop darkened, saturated and wobbled) and a 0.7 s room. Four phrases of our own,
  each with one bend; dealt as the answer, it plays from beat 1.5 on every second bar.
- **THE PHASE GUITAR** (tag `phase-guitar`): the same string into a symmetric crunch (gain 10), the same tone stack,
  cabinet and squash, a phaser or a feed-forward flanger (0.7 to 4.3 ms) dealt per set, a CE-2 shaped chorus, a
  half-beat echo, the room, panned -0.35 as the reference's guitar. Three parts of our own: a ringing arpeggio
  coloured by the chord root's 4th where the key holds it, a strum with palm-muted ghosts, a swelled power chord.
  Dealt as the arps, it plays the bar's chord (a piece's own chord when a piece plays) every bar.
- **THE DECKS AND THE BOARDS** live in `djguitars.js` `createSetGuitars`: one card a set from each deck (the echo
  guitar's phrases, the lead's phrases, the rhythm's parts, the rhythm's modulation), and each guitar's pedalboard
  built once a set so its LFOs run free across bars, rung out when the set changes.
- **THE CABINET'S CORNER** is one constant, `CABINET_CORNER_HZ`, held at `TONE.rawCeiling` (2.4 kHz) until the
  navigator rules between 2.4 kHz and 3.5 kHz for a voice that ends in a cabinet (THE GUITAR STUDY's ruling).
- **THE REFERENCE**, measured where its guitar plays alone (`SETTLE/runs/djguitars/`): centroid 538 Hz, -9.2 dB an
  octave from 1 to 6 kHz, +4.9 dB left, L/R correlation 0.92, a note losing 2.4 dB in 250 ms, 125.2 bpm. The phase
  guitar measures 540 Hz, -16.6 dB an octave (the 2.4 kHz corner), +4.8 dB, 0.97, 0.7 dB. The 30:07 to 30:37 stretch
  first read as a guitar wash is speech; nothing is taken from it.
- **LEVELS**: every phrase and part, effects included, stays under the loudest instrument (the distorted flute's
  loudest 50 ms RMS 0.1615, peak 0.2412): the fuzz lead 0.0626 and 0.2072, the phase guitar 0.0455 and 0.2039.
- **THE STYLE** is written up in `wikis/WIKI_PSYCH_GUITAR_TONE/`; THE GUITAR STUDY's ten reports are
  `SETTLE/runs/guitarstudy/`. Owed: a Karplus-Strong string (study report 09), measuring the fuzz in headless
  Chromium (the offline renderer ignores `oversample`), and the study's own guitar slots and tag block.
- Tests: `tests/djguitars.test.mjs` (the reference pinned to the analysis, the phaser's notches measured, the flanger
  free of loops, the squash's ratio, the fuzz's even harmonics, the echo's repeats, the parts in key, the tone rules,
  the level against the loudest instrument, ours against the reference, the tables, the loader, THE DJ's answer and
  arps); `tests/echoguitar.test.mjs`.

## Docs in this folder

| file | what it is |
|---|---|
| `README.md` | this reference: the voices, presets, mixer, the hero symphony, THE DJ, the house set, THE TRAINED DJ, next and previous set, the bases, 432 Hz McKUSKER MODE and the tests |
| `DESIGNER_GUIDE.md`, `DESIGNER_GUIDE.ja.md` | the sound designer's guide, in English and Japanese: each instrument, how to add a tune or an instrument |
| `TONE_RULES.md` | the envelope floors, the saw ceiling, the detune and the level aims every voice keeps |
| `BASE_FORMAT.md` | the `settle-base/1` JSON format of a rhythm bed |
| `bases/LEDGER.md` | generated by `tools/bases_build.mjs`: the source, licence and sha256 of every base; never edit by hand |
| `bases/BUILD.md` | generated by `tools/bases_build.mjs`: the last build's counts and the files left out; never edit by hand |

> Index verified 2026-10-06
