# THE HERO SYMPHONY · a designer's guide to the sound and the picture

This guide is for a sound designer and a visual designer. You can change every sound, every theme, every tune,
every colour and every panel described here without knowing how the settling works. The short machine-learning
appendix at the end explains the settling for anyone curious. Nothing in the main part depends on it.

Every file named here sits in `experiments/thermosim/`. The sound lives in `settle-hear/`, the picture in
`settle-see/`, and the site that shows both in `sites/settle-site/`.

## 1 · What happens, in one picture

```
   THE HERO PICTURE                 THE DJ                         THE SOUND
   ─────────────────                ──────                         ─────────
   a field of lights settles        once a bar it reads the        drone, binaural pair,
   into a word, a shape or a        picture's numbers and          flute tune, harp, bells,
   film frame, then reheats         decides six yes/no things      held harmonics
          │                               │                              ▲
          │  numbers, about 6 a second    │  one decision a bar          │
          └──────────────────────────────▶└─────────────────────────────┘
                                           │
                                           ▼
                                     THE VISUALISER
                                     bottom left: a mini panel,
                                     a larger view on a click
```

- The **picture** is a grid of small lights. Each light flickers on and off. The temperature starts hot, so the
  lights are noise. It cools, and the lights gather into the stored word or shape. The picture holds, heats again,
  and moves to the next word.
- The picture reports a few **numbers** several times a second: how hot it is, how much of the word has formed,
  how many lights flipped, and what it is showing.
- **The DJ** reads those numbers once a bar (every two to four seconds) and answers six questions with yes or no.
- **The sound** follows the answers. The **visualiser** shows the answers and why the DJ gave them.

## 2 · The mode and its name

The sound is called the **40 Hz AND 432 Hz FLUTE MODE**, also "the McKusker mode". Both names are single strings
in `settle-hear/src/tuning.js` (`FLUTE_MODE_NAME`, `FLUTE_MODE_ALIAS`). The spelling of McKusker is not confirmed;
change it there and every label follows.

It is the hero's default sound. Three things can silence it:

1. **The browser.** No page may play sound before the visitor clicks, taps or presses a key. Until then the DJ
   still decides and the visualiser still moves; the panel says "starts on your first click or key press".
2. **MUTE ALL** in the header. It silences every sound on the site and the choice is remembered.
3. **The hero's own sound button**, which the hero passes in as `playing`.

Under the system setting "reduce motion" the symphony starts stopped, like every sound on the site. Its play
button (inside the larger view) starts it.

## 3 · The sound, layer by layer

Every layer is made in the browser from plain Web Audio parts: oscillators, filters and gains. There are no
sample files. The code is `settle-hear/src/instruments.js` (the voices) and `settle-hear/src/symphony.js`
(when they play).

```
   ┌ wet channel ─────────────────────────────────────────▶ reverb and echo sends ─┐
   │  flute · fiddle · harp · bells · crystal · drone · harmonics                   │
   │                                                                                ├─▶ master ─▶ MUTE ─▶ limiter ─▶ out
   └ dry channel ───────────────────────────────────────────────────────────────────┘
      the binaural pair only (no reverb, no echo: each ear keeps its own tone)
```

| layer | what it is | when it plays | knobs (file, name) |
|---|---|---|---|
| binaural pair | one sine in the left ear, one in the right, a few hertz apart | always, unless switched off | `makeBinaural`: level 0.18; glide 4 s on a change |
| drone | pipes (two buzzy sawtooths on the root and its fifth, a third an octave down, through a 1.2 kHz lowpass) or pad (soft triangles and sines, 700 Hz lowpass) | always, louder in drone mode | `makeDrone`: kind, the 3/2 fifth, levels 0.35 / 0.22 / 0.3 |
| flute | the prime voice: a sine, a quiet second harmonic, a breath at the start, a slow vibrato | in tune mode | `NOTES.flute`: attack 60 ms, release 120 ms, vibrato 5.2 Hz about 6 cents after 0.18 s, breath 60 ms |
| fiddle | a sawtooth through a 900 Hz body peak and a 2.4 kHz lowpass, faster vibrato | doubles the tune an octave down on every other bar, in themes that have a fiddle | `NOTES.fiddle`: attack 40 ms, vibrato 6 Hz |
| harp | a plucked string: bright attack, a ring of about a second | broken chords under the tune, by the theme's density | `NOTES.harp`: attack 5 ms, ring 0.6 to 1.6 s |
| bells | a struck bar: partials 1, 2.76, 5.4 | now and then at a bar start; a soft bell on each new film frame | `NOTES.bells`: 2.4 s ring |
| crystal | struck glass: partials 1 and 3.01, very soft | now and then; glints on the held harmonics | `NOTES.crystal`: 3 s shimmer |
| harmonics | up to seven sines at 1, 2, 3 ... 7 times the drone's root, each fading in one after another | static mode only | `makeHarmonics`: each partial at 0.12 / k, a stagger of one beat |

The level of each instrument inside a theme is the theme's `instruments` mix (section 6). The whole symphony has
one level (0.55 by default) and sits under the site's master and its limiter, so nothing can clip.

### 3.1 · The four modes the DJ plays in

| mode | what you hear | the DJ's lights that lead to it |
|---|---|---|
| **tune** | the flute plays the tune, harp and bells around it, drone and binaural under it | FLUTE yes, STATIC no, DRONE no |
| **bed** | no melody: harp broken chords and bells over the drone | FLUTE no, STATIC no, DRONE no |
| **static** | the melody stops; the drone's root splits into 2 to 7 held harmonics, one fading in after another | STATIC yes |
| **drone** | only the drone and the binaural pair | DRONE yes (it wins over everything) |

### 3.2 · Tempo

A bar is four beats. The tempo sits inside the theme's range: a hot, noisy picture plays at the fast end and a
settled one at the slow end. It moves smoothly from bar to bar (60% the old tempo, 40% the new) so it never jumps.

## 4 · Tuning: A = 432, and the binaural base

- **Every pitch comes from A = 432 Hz.** Note number 69 (the A above middle C) is exactly 432 Hz. Every other note
  is `432 x 2 ^ ((note - 69) / 12)`: equal temperament, 31.77 cents below the usual A = 440. This is an aesthetic
  choice. The site makes no claim for it beyond the sound.
- **The held harmonics are just intonation**: exact whole multiples of the root (1, 2, 3 ... 7 times). They lock
  with the drone and never beat against it. The melody stays in equal temperament so it can move freely. That
  gentle disagreement between the flute's third and the drone's fifth harmonic is the sound of a flute over pipes.
- **In a minor theme the fifth harmonic is left out.** Harmonic 5 is a major third and clashes with a minor tune.
  CATHEDRAL, DEEP SEA and EMBERS are minor, so their static mode skips it.
- **The binaural pair.** The left ear hears the theme's root, moved into the range 150 to 300 Hz. The right ear
  hears the same plus the DJ's beat. At home the beat is **40 Hz**. In HIGHLANDS that is A3 = 216 Hz on the left and
  256 Hz on the right, exactly 40 Hz apart and both in key.
- **Headphones are needed** to hear a binaural beat: the beat exists only where the two ears meet. The panel says
  this once, in one small line. A 40 Hz beat sits at the edge of what people hear as a beat; many hear a roughness
  or two close tones instead. The site makes **no health claim** for any beat.
- **The DJ varies the beat a lot.** Each theme has its own set of beats (section 6). The DJ moves away from 40 Hz
  and comes back: the longer it has been away, the likelier the next change takes it home.

## 5 · THE DJ, for designers

The DJ answers six questions once a bar. Each answer is a light: lit (yes) or dark (no).

| light | letter | question |
|---|---|---|
| CHANGE BEAT | B | change the binaural beat? |
| NEW THEME | T | move to a new theme? |
| GO STATIC | S | hold still on one great harmonic? |
| SPLIT | H | split the harmonic into more partials? |
| FLUTE | F | bring in the flute with the tune? |
| DRONE | D | drop to the drone alone? |

Each light has a **lean**: a number that says how much it wants to be yes. Positive wants yes, negative wants no,
and about 3 either way is a strong opinion. The lean is a sum of named parts. The visualiser prints the parts
beside each light, so you can always see why. Every part lives in one function, `leans()` in
`settle-hear/src/dj.js`; change a number there and the DJ's taste changes.

### 5.1 · What the picture pushes on each light

| light | part | value | in plain words |
|---|---|---|---|
| CHANGE BEAT | base | -1.6 | normally no |
| | heat | +1.4 x heat | a hot picture asks for a new beat |
| | new target | +1.0 | the picture moved to a new word |
| | bars since a change | +0.09 a bar, up to 20 bars | the longer the beat holds, the readier to move |
| | away from 40 Hz | +0.12 a bar, up to 16 bars | the longer away, the readier to move (and home is likely) |
| | film frame | +0.5 | a film moved on a frame |
| NEW THEME | base | -3.4 | rarely |
| | bars in this theme | +0.05 a bar, up to 64 bars | after a minute or two a new theme becomes likely |
| | new target | +1.4 when the theme is older than 16 bars | a fresh word is a good moment to change |
| GO STATIC | base | -0.9 | normally no |
| | landed | +1.6 | the word has formed |
| | overlap | +1.4 x overlap | how much of the word is there |
| | heat | -1.6 x heat | a hot picture is never still |
| | a film plays | -0.8 | a film keeps moving |
| | held too long | -0.18 a bar, up to 16 | stillness tires |
| SPLIT | base | -1.0 | |
| | overlap | +1.0 x overlap | |
| | landed | +0.6 | |
| FLUTE | base | +0.2 | usually yes |
| | a word | +0.9 | a word sings |
| | a shape | -0.2 | |
| | a film plays | -0.3 | |
| | flips | -0.6 x flips | a busy, noisy picture quiets the flute |
| | playing long | -0.05 a bar, up to 32 | the flute rests sometimes |
| | resting long | +0.08 a bar, up to 16 | and comes back |
| DRONE | base | -1.5 | rarely |
| | calm and landed | +1.2 x (1 - flips) when landed | a still, calm picture invites the drone |
| | a film plays | +0.5 | |
| | droning long | -0.15 a bar, up to 16 | |

Each theme adds its own `bias` to these (section 6). The picture's numbers are read by `readHero()` in the same
file: **heat** (the temperature on a log scale, 0 hot to 1, from 3.0 down to 0.45), **overlap** (how much of the
word is formed, 0 to 1), **flips** (the share of lights that flipped, 0 to 1), **landed** (the picture has formed and
holds), and what it shows (**a word** and its letters, **a shape**, or **a film** and its frame).

### 5.2 · The pulls between the lights

Some answers go together and some do not. A **pull** ties two lights: a positive pull wants them to agree, a
negative one wants them to differ.

| pull | strength | meaning |
|---|---|---|
| static with split | +0.9 | a held harmonic likes to split |
| static against flute | -0.8 | the melody stops while the harmonic holds |
| drone against flute | -0.9 | the drone alone means no flute |
| drone with static | +0.3 | |
| beat with theme | +0.6 | a new theme likes a new beat |
| beat against static | -0.4 | the beat holds still while the harmonic holds |
| theme against static | -0.3 | |

They are in `DJ_PULLS` in `dj.js`.

### 5.3 · How the DJ makes up its mind

Once a bar the DJ lets the six lights **settle**, the same way the picture's lights do. The lights start where they
were last bar. For 24 short rounds each light looks at its lean and at the lights it is pulled to, and picks yes or
no with a little randomness. The randomness starts high and falls round by round, so the lights wander at first and
then agree. The final answer is what the DJ plays.

That is the whole idea: **the DJ settles its choices the way the hero settles its lights.** The larger view draws
those 24 rounds as a grid, six rows by 24 columns, revealed left to right over about a second.

### 5.4 · What the DJ does with a yes

- **NEW THEME**: pick a different theme at random; the beat goes home to 40 Hz; the tune changes.
- **CHANGE BEAT**: pick a new beat from the theme's set. If the beat is away from 40 Hz, it often goes home.
- **GO STATIC**: start from the bare root. **SPLIT** then picks how many harmonics, 2 to 7: either the number of
  letters in the word on screen ("by a choice", six for SETTLE) or a random draw. The harmonics fade in one beat
  apart, so you hear the tone split into 2, then 3, then 4.
- **FLUTE**: the flute plays the next bar of the tune. It resumes where it stopped.
- **DRONE**: strip back to the drone and the binaural pair.

### 5.5 · Every visit is different

The DJ draws all its randomness from one seeded stream. The hero seeds it from the clock, so each visit picks a
different first theme and a different path. A test gives a fixed seed and always gets the same set.

## 6 · The five themes

A theme sets the rough shape of a whole set. They are plain data in `settle-hear/src/themes.js`.

| theme | root, mode | tempo | instruments | drone | beats (Hz) | density, reverb, echo | leans it adds |
|---|---|---|---|---|---|---|---|
| CRYSTALS | E4, lydian | 62 to 84 | crystal 1, flute 0.9, bells 0.6, harp 0.5, pad 0.5 | pad | 40, 10, 12, 20, 30 | 0.5, 0.55, 0.3 | static +0.6, split +0.8, drone -0.3 |
| HIGHLANDS | A3, mixolydian | 84 to 116 | flute 1, fiddle 0.8, pipes 0.8, harp 0.45 | pipes | 40, 6, 8, 10, 20 | 0.65, 0.3, 0.12 | flute +0.8, drone +0.2, static -0.2 |
| DEEP SEA | D3, dorian | 48 to 64 | pad 1, flute 0.7, bells 0.3, harp 0.25 | pad | 40, 4, 5, 6, 8 | 0.25, 0.75, 0.45 | drone +0.9, static +0.2, beat -0.3, flute -0.2 |
| CATHEDRAL | G3, aeolian | 54 to 72 | pad 0.9, flute 0.8, bells 0.8, crystal 0.3 | pad | 40, 7, 10, 12 | 0.35, 0.85, 0.1 | static +0.9, split +0.4 |
| EMBERS | B3, minor pentatonic | 96 to 132 | fiddle 1, harp 0.8, flute 0.8, bells 0.3, pipes 0.3 | pipes | 40, 14, 16, 20, 30 | 0.85, 0.25, 0.2 | beat +0.7, flute +0.2, static -0.5, drone -0.4 |

Every theme also has `bright` (0 to 1, the tone filter: 1,800 Hz plus 9,000 Hz times `bright`), `tags` (which tunes
suit it), `line` (one sentence for the panel) and `neon` (its colour in the visualiser).

### 6.1 · How to add a theme

1. Copy one block in `THEMES` and give it a new `key` and `label`.
2. Set `root` (a note name such as `'D3'`) and `mode` (any name in `MODES` in `tuning.js`).
3. Set `bpm`, `instruments` (0 to 1 each; keep `flute` above 0), `drone` (`'pipes'` or `'pad'`), `beats` (keep 40
   in the list), `density`, `reverb`, `delay`, `bright`, `tags` and `bias`.
4. Pick `neon` from the ten neon names (yes, no, lean, pull, heat, calm, mem, held, data, miss).
5. Run `node --test tests/*.test.mjs` in `settle-hear/`. The test "five themes, each complete" names the five by
   label; update it to six.

Nothing else needs to know the new name: the DJ picks from `THEMES` and the visualiser reads `label` and `neon`.

## 7 · The tunes

### 7.1 · The rule

A tune goes in only when its melody comes from a public-domain source, named with its tune:

- **a printed book** before 1929, with its compiler, its year and the place in the book (page or number); or
- **a dataset that dedicates the notes to the public domain (CC0)**, with the record, and the old edition the
  record was typed from.

An old tune can be free while a modern edition, arrangement or MIDI file of it belongs to someone. So every tune is
a plain melody line written out from the named source, never copied from a modern edition. `tuneProblems()` in
`settle-hear/src/tunes.js` refuses a tune that lacks any of this, and a test checks every tune in the list.

The research behind the sources is in `wikis/WIKI_OLD_MELODIES/` (sources and licences, the Highlands, ancient and
world melodies, tuning, harmonics, instruments).

### 7.2 · The tunes today

| tune | from | tags |
|---|---|---|
| Dies irae (first strophe) | GregoBase chant 3441, Vatican version, CC0 | chant, ancient, slow, air |
| Veni Creator Spiritus (first stanza) | GregoBase chant 3431, Vatican version, CC0 | chant, ancient, slow, air |
| Ave maris stella (Little Office tune) | GregoBase chant 3285, Vatican version, CC0 | chant, ancient, slow, air |
| Sakura (voice part) | Collection of Japanese Koto Music, Tokyo Academy of Music, 1888, No. 2 | ancient, air, slow |

Scottish Highland fiddle and pipe tunes are owed: each needs its printed collection and page checked against a
scan before it goes in. When no tune suits a theme, the flute plays a short phrase made from the theme's own scale.
The panel then says "generated from the scale, not an old tune". Nothing generated is ever given a book.

### 7.3 · How a tune is placed

The tune is moved so its home note is the theme's root (a tune in D over a HIGHLANDS drone in A is moved to A), and
then by whole octaves so its middle note sits near G5, where the flute sounds best.

### 7.4 · How to add a tune

1. Write the melody in ABC (the subset below) from the named source.
2. Add a block to `TUNES` in `tunes.js`:

```js
{
  id: 'a-short-id',
  title: 'The Title',
  origin: 'where and when, the mode',
  tags: ['highlands', 'reel'],               // which themes it suits: see each theme's tags
  abc: 'X:1\nT:The Title\nM:4/4\nL:1/8\nK:Amix\n|:A2 ... :|',
  source: { kind: 'print', book: 'Title of the book', compiler: 'Who made it', year: 1816, where: 'p. 12, No. 3' },
  transcription: 'who read it from which scan',
},
```

3. Run the tests. The tune must parse and have at least eight notes.

**The ABC the reader understands** (`settle-hear/src/abc.js`): the header lines `T:` (title), `M:` (meter), `L:` (the
unit length, 1/8 by default), `K:` (the key: a note and a mode such as `D`, `Em`, `Amix`, `Edor`, or `HP` for the
pipe scale); notes `A` to `G` (the octave from middle C) and `a` to `g` (the octave above), `'` up an octave and `,`
down; `^` sharp, `_` flat, `=` natural, lasting to the bar line; lengths `2`, `3/2`, `/2`, `/`; rests `z`; ties `-`;
the dotted pairs `>` and `<` of strathspeys; triplets `(3abc`; repeats `|:` `:|` `::` with first and second endings
`[1` `[2`. It ignores chord names in quotes, grace notes in braces, decorations, and slurs; in a chord in square
brackets it keeps the first note.

## 8 · How to add an instrument

1. In `settle-hear/src/instruments.js`, add a function to `NOTES`, for example `whistle(ctx, out, f, t, dur, vel)`.
   Build it like `flute`: oscillators into an envelope gain into `out`, started at `t` and stopped a little after
   `t + dur`. Disconnect the nodes in the first oscillator's `onended`.
2. Add its name to `INSTRUMENT_KEYS` and a one-line description to `INSTRUMENTS` in `themes.js`.
3. Give it a level in the `instruments` of the themes that should use it.
4. Decide when it plays, in `scheduleBar()` in `symphony.js`: with the tune, with the bed, or in static mode. Add a
   track for it to `TRACKS` so a listener can switch it off.
5. Keep every value finite and pass long-lived values through `ramp()`; the tests fail on any NaN that reaches an
   audio parameter.

## 9 · The visualiser

The visualiser is `HeroSymphony` in `settle-hear/react/Symphony.jsx`, styled by `settle-hear/react/symphony.css`.

```
   THE MINI (always there, bottom left)
   ┌──────────────────────────────────────────
   │ THE DJ  HIGHLANDS  40 Hz              ▸
   │ ● ● ○ ● ○ ○   ▂▃▄▅▆▇   TUNE
   │ playing · Veni Creator Spiritus
   └──────────────────────────────────────────
     six lights · harmonics 1..7 · mode · status and tune
```

A click on the mini opens **the larger view** above it (below it on a phone). From top to bottom:

1. The mode's name, the status, and the one headphones line.
2. **The DJ settles six choices, once a bar**: the 6 x 24 settle grid (yes rose, no indigo), each light's chance of
   yes at the end, each question with its lean and the lean's biggest parts, and the pulls.
3. **What the hero says**: heat, overlap and flips as bars; what the picture shows (a word, a shape, a film and its
   frame); its phase.
4. **The sound**: the theme and its line, the mode (and how the harmonics were split), the tempo inside the theme's
   range, the beat, the two ears in hertz, and the seven harmonic bars.
5. **The tune**: its title and book (or "generated from the scale"), a little piano roll of the last notes, and the
   number of cleared tunes.
6. **Tracks and controls**, closed by default (section 10).

### 9.1 · Colours and type

- The panel is **chrome**: red light only. Ink `--ink`, highlights `--ink-hi`, the prime red `--prime`, a near-black
  ground at 88 to 94% opacity, hairlines `--hair`.
- The DJ's lights are **a settling picture**, so they wear the neon code: `--neon-yes` (rose) lit, `--neon-no`
  (indigo) unlit, `--neon-lean` (amber) for leans, `--neon-pull` (cyan) for pulls, `--neon-held` (ice) for a held
  light. The theme's colour is its own neon, passed as `--dj-theme`.
- Type is the site's monospace (`--mono`), 12 px in the panel.
- Every colour is a CSS variable with a fallback, so restyling is a matter of setting variables on `.dj`.

### 9.2 · Placement

- Desktop: `position: absolute` inside the hero, `left: var(--gutter)`, `bottom: calc(var(--foot-strip) + 72px)`:
  above the hero's caption and clear of the 75 px footer strip. The gamma controls sit bottom right.
- Phone (700 px and narrower): it hangs at `top: 172px`, under the readout, and opens downward, because the gamma
  console takes the bottom of the hero there.
- A page can move it with the `style` prop.

### 9.3 · Motion

- The mini's lights change once a bar. The grid's reveal is a left-to-right wipe of about a second, only while the
  larger view is open. Nothing flashes.
- Under "reduce motion" the grid is drawn whole at once and the lights do not animate.

## 10 · The hidden controls

The hero plays good defaults and cycles through everything by itself. The controls are for exploring, so they sit
behind "tracks and controls" at the bottom of the larger view:

| control | what it does |
|---|---|
| tracks | switch any of flute, fiddle, harp, bells, crystal, drone, harmonics, binaural on or off |
| theme | jump to one of the five themes |
| lock the theme | the DJ may not change the theme |
| hold the beat at 40 Hz | the DJ may not change the beat |
| a row per light: DJ / yes / no | hold any light yes or no; the other lights still settle around it (it shows an ice ring) |
| next tune | skip to another tune |
| play / stop | the symphony's own switch |
| level | the symphony's volume |

## 11 · How the picture is driven

The picture is `<Settle>` from settle-see. Its README (`settle-see/README.md`) lists every option. The ones a
designer meets most:

- **What it shows**: `items`, a list of words, shapes (`'purkinje'`, `'heart'` and the rest), SVG paths, images, and
  small films.
- **Colour**: `color: 'meaning'` (the neon code: rose agrees, orange is heat, indigo is off), `'single'` with one
  `neon`, or `'duo'`; `dim` for unlit lights; `glow` for the bloom.
- **Density**: `res`, about how many lights fit across (the hero uses 384).
- **Rhythm**: the temperature schedule (hot 3.0, cooling to 0.45 over 170 frames, a hold, a reheat, the next item).
- **The pointer**: it lights what it passes and sends rings on a click.
- **A film**: an item `{ film: 'hero-films/name.json', note, T }`, made by `sites/settle-site/tools/make_hero_film.mjs`
  from a video or a folder of frames. The symphony strikes a soft bell on each new frame, and the DJ reads a film as
  "keep moving": less static, more drone.
- **A burst**: a short disturbance of the live field (a ring or wipe of flipped lights, a shake, a flash along a
  wire) that the cold field then repairs by itself. settle-see's README describes the deck of bursts in its
  "Bursts" section where your copy has it. A burst raises the flips and the heat for a moment, so the DJ leans
  toward a beat change and away from static.

The sound never reads the pixels. It reads only the numbers above, so any new picture works with the symphony
unchanged.

## 12 · Mounting it

The hero mounts the whole symphony with one line inside its room:

```jsx
import { HeroSymphony } from 'settle-hear/react';
<HeroSymphony stats={stats} playing={soundOn} />
```

`stats` is the picture's `onStats` object; `playing` is the hero's own sound button (leave it out and the symphony
plays by default). Optional: `level`, `seed` (a fixed set), `theme` (a fixed first theme), `style`.

## 13 · Tests

`node --test tests/*.test.mjs` in `settle-hear/` checks: A = 432 exactly (note 69 is 432 Hz, A3 is 216 Hz); the
binaural pair is 40 Hz apart at home and dry; the ABC reader; the tune rule and every tune; the five themes; the
theme pick (random, seeded, never the same theme twice in a row); the beat pick coming home; the DJ's decisions
(the same seed and the same picture give the same set); the harmonic splits (every count from 2 to 7, by the
word's letters or at random, only in static mode); the hidden controls; and that a muted or stopped symphony
schedules nothing.

## Appendix · the settling, for the curious

Each light, in the picture and in the DJ, is a **p-bit**: a coin with a lean. It says yes with probability

`P(yes) = (1 + tanh(I / T)) / 2`, with `I = h + sum over its partners of J x s`

- `h` is the light's **lean** (in the picture: toward the stored word; in the DJ: the sum of parts in section 5.1).
- `J` is a **pull** between two lights (in the picture: each light and its four neighbours; in the DJ: the table
  in section 5.2), and `s` is the partner's state, +1 for yes and -1 for no.
- `T` is the **temperature**. High `T` makes every coin fair; low `T` makes each light follow its lean and its pulls.

Lowering `T` slowly lets the whole set fall into a low-energy agreement,
`E = - sum of h s - sum over pairs of J s s'`. The picture does this with tens of thousands of lights, one sweep a
frame. The DJ does it with six lights, 24 sweeps a bar, cooling from `T = 2.0` to `T = 0.25` geometrically, starting
from the last bar's answer so that a state has momentum. A held light (a hidden control) is a **clamp**: it keeps
its value through every sweep while the others settle around it.

The DJ's code is `settle-hear/src/dj.js` (`readHero`, `leans`, `anneal`, `createDJ`).

> Japanese version: `DESIGNER_GUIDE.ja.md`.

## 14 · The house set and the spectrum (lane HOUSEDJ)

The tunes can go electronic: the house set plays the tune about 14 dB under a soft thump and pad, through a chain of
a few of 35 effect passes (filters, delays, reverbs, modulation, grit, a kit, a sub, a supersaw pad, an
arpeggiator), swapped by THE DJ at bar lines. And the sound draws itself: the master analyser's 32 bars become a
live target the hero settles toward. Every pass, its sound and its knobs: the README's sections "The house set and
THE PASSES" and "THE SPECTRUM SETTLE".
