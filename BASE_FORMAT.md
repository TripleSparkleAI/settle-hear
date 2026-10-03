# THE BASE FORMAT (settle-base/1)

A BASE is one rhythm bed in our own JSON: a house groove or an ambient bed, cut into separate parts on a tick
grid, with the features the DJ searches and the signature that names its family. A base is what the SETTLE DJ
chooses from, slices, and lays under a melody. It is never a MIDI file: the importer (`src/bases/base-import.js`)
turns a MIDI file into a base, and the raw file stays behind in the ledger.

The code that defines it: `src/bases/base-format.js` (the shape, the validator, the compatibility rule),
`src/bases/base-features.js` (every number), `src/bases/base-slice.js` (slicing and combining). The theory and the
formulas, in prose: `wikis/WIKI_DJ_THEORY/04-THE-BASE-FORMAT.md`.

```
 base-0042.json
 ├─ format     "settle-base/1"
 ├─ id         "base-0042"              the only name a base has
 ├─ kind       "house" | "ambient"
 ├─ family     "deep"                   one of FAMILIES[kind]
 ├─ origin     "midi" | "authored" | "combined"
 ├─ tempo      { bpm: 122, min: 115, max: 129 }
 ├─ meter      { num: 4, den: 4 }
 ├─ grid       4                        ticks a beat: 4 (sixteenths) for house, 8 for ambient
 ├─ swing      0.14                     the lateness of every odd tick, as a fraction of a tick, 0..0.3
 ├─ key        { pc: 9, mode: "aeolian", name: "A aeolian", confidence: 0.81 } | null
 ├─ bars       16
 ├─ parts
 │   ├─ kick    { events: [[t, d, v, p], ...], features: { density, syncopation, energy, register, onsets, bars } }
 │   ├─ snare   (the snare and the clap)
 │   ├─ hats    (closed, open and pedal hats)
 │   ├─ perc    (rims, toms, rides, crashes, cowbell, shakers, congas, claves)
 │   ├─ bass
 │   ├─ chords  (chords and pads)
 │   ├─ lead
 │   └─ texture
 ├─ signature  { kind, family, bpm, energy, density, syncopation, swing, key, parts, fourFloor, backbeat, bars, meter }
 ├─ quantise   { grid, meanAbsMs, maxMs, p90Ms, onsets, swingRead }   (a midi base's recorded error)
 └─ source     "ledger"
```

## The event

`[t, d, v, p]`

- `t` the tick from the start of the base: bar 0, beat 0 is tick 0. Ticks are integers. Tick `t` is in bar
  `floor(t / ticksPerBar)` where `ticksPerBar = grid x num x 4 / den`.
- `d` the length in ticks, at least 1.
- `v` the level, 0 < v <= 1.
- `p` the pitch: a midi note for a pitched part; the General MIDI drum note for a drum part (36 kick, 38 snare,
  39 clap, 42 closed hat, 46 open hat, 37 rim, 51 ride, 56 cowbell, 70 shaker, 63 conga ...), so the player
  knows which kit voice to strike; `null` is allowed only on an unpitched part.

Events are kept in time order. Two events on one tick and one pitch collapse to the louder.

## The parts

Eight names, fixed: `kick snare hats perc bass chords lead texture`. A base carries only the parts it has.
A part is never empty when present. The importer sends each General MIDI drum note to its part
(`src/bases/midi.js GM_DRUMS`) and reads a pitched track's notes by role: notes struck together in threes or
more are chords; the lowest note under midi 52 is bass; a lone note at or above 60 is lead; a bass program is all
bass; a pad or string program is all chords; a sound-effect program is texture.

## The features

Per part, from `partFeatures()`:

- **density** = onsets / (bars x beats a bar). A four-on-the-floor kick is 1.0; sixteenth hats are 4.0.
- **syncopation** = the mean over onsets of a weight: 0 on a beat, 0.5 on the off-beat eighth, 1 anywhere else.
- **energy** = mean level x (1 - e^(-density)).
- **register** = the mean midi pitch of a pitched part; null for drums.
- **onsets**, **bars** (how many bars carry an onset).

The signature, from `signatureOf()`: a weighted mean of the parts' energy, density and syncopation (kick 0.28,
snare 0.18, hats 0.16, perc 0.10, bass 0.14, chords 0.06, lead 0.05, texture 0.03), the key, the parts present,
**fourFloor** (the share of bars whose kick lands on every beat), **backbeat** (the share of bars whose snare
lands on 2 and 4), bars and meter.

The key, from `keyOf()`: a duration-weighted pitch-class histogram of the pitched parts, correlated with the 24
Krumhansl-Kessler profiles; the best correlation is the key and its value the confidence. Major is written
`ionian`, minor `aeolian`.

## The families

house: `chicago deep acid garage disco tech progressive filter-house dub-techno balearic breaks funk afro latin
electro trance`. ambient: `ambient drone pulse chorale piano bells field downtempo`. The ten the DJ's brain names
(`mix-dj.js THEME_DRUMS`) are among the house ones, so a brain choice maps straight onto a base family.
`familyOf()` reads the family from the numbers (wiki page 04 gives the rules); an authored base is born with its
family.

## The quantise record

A midi base says how far it was moved: every onset went to the nearest tick, and `quantise` keeps the mean
absolute error, the largest and the 90th percentile in milliseconds at the base's bpm, the count, and the swing
that was read from the odd-tick lateness before it was straightened. A typeset file reads 0 ms; a human drummer
from the Groove MIDI Dataset reads about 10 to 25 ms.

## Slicing

`slice(base, { parts, bars: [from, to] })` takes any parts over any bar range and re-bases the ticks so the slice
starts at tick 0. An event running past the end is cut at the end. A slice carries the base's id, grid, meter,
tempo range, key and swing, and no features of its own.

`loopSlice(slice, bars)` tiles a slice to a longer bar count. `transposeSlice(slice, n)` moves pitched events by
`n` semitones and leaves the drums. `rescaleSlice(slice, grid)` puts a slice on a finer grid by a whole factor.

## Combining

`combine([anchor, ...others])` lays slices together into one base (`origin: "combined"`). The first slice is the
anchor. Every other slice must pass the compatibility rule against it; a slice whose key differs is transposed
onto the anchor's key by the rule's `transpose`; every slice is looped to the longest slice's bar count and
rescaled to the finest grid. The same part from two slices is the later one's unless `{ merge: true }`.

## The compatibility rule

`compatible(a, b)` answers whether b can sit under a:

- the meter must match (4/4 against 3/4 is refused);
- the tempo ranges must overlap after an 8% stretch either side; the answer carries the tempo to play both at
  (the nearest point of the overlap to a's own bpm);
- the keys must be the same, relative (A minor and C major), or transposable: the answer's `transpose` says how
  many semitones b must move; an unpitched slice has no key and agrees with everything.

## The library and the ledger

`bases/index.json` holds one row per base (the signature plus id, kind, family, origin, tempo range, grid): the DJ
holds it whole and loads a base file only when a slice is wanted. `bases/ledger.json` and `bases/LEDGER.md` hold
the source of every base: title, author, url, licence and its text, download date and sha256 for a midi base; the
recipe, seed, version and the theory line for an authored base. A base file never names its source.
