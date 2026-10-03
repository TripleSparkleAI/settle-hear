# The tone rules (settle-hear, 2026-10-01)

The navigator's standing word: nice, good tones, always. These rules are constants in `src/tone.js` (`TONE`,
`LEVELS`) and every voice reads them. A later lane changes a number there, not in a voice.

## The rules

1. No note starts or stops at a step. Every voice ramps from zero and back to zero: an attack of at least 4 ms
   (`TONE.attackMin`, a struck bell) and a release of at least 60 ms (`TONE.releaseMin`). A sustained voice (the flute,
   a pad, the fiddle) uses 30 ms and 120 ms or more (`TONE.attackSoft`, `TONE.releaseSoft`). `softEnvelope()` applies
   the floors; `strike()` in house.js and voices.js clamp to them.
2. No raw sawtooth or square reaches the output. A saw passes a low-pass at or below 2.4 kHz (`TONE.rawCeiling`)
   first: the fiddle (2.2 kHz), the pipes drone (1.1 kHz), the supersaw pad (its sweep capped at the ceiling), the
   pulse voice's sweep, every house strike that asks for a saw. Sines and triangles may go bare.
3. Detune is gentle: unison voices spread across at most 6 cents (`TONE.detuneCents`, `gentleDetune()`); the fiddle's
   two saws sit 4 cents apart, the pipes drone's three voices 3 cents, a mode's pad voices 6.
4. A pad swells in over at least 2.5 s and never faster, whatever the crossfade asked for.
5. A little reverb on the musical voices (the symphony's wet channel, the house plate); none on a binaural pair or a
   mode pad, since the shared reverb is stereo and would mix each ear's tone into the other.
6. Levels are balanced in the order static > binaural pair > pad > flute, by the written aims in `LEVELS` (dBFS at
   the master's input): static -18, binaural -24, pad -27, flute -28, house -20, clicks -30, logo -22 (the site's logo click,
   lane LOGOSETTLE: one short note under the static, its sources also sent into the hero bus). The master limiter
   (engine.js, -14 dB threshold) and the house chain's own limiter (-16 dB) sit last; nothing a voice does can clip.
7. A mode swap crossfades: 6 s when the shuffle moves on (`TONE.modeFade`), 0.8 s on a hand pick (`TONE.pickFade`).
8. The 10 kHz click train keeps its stimulus shape (1 ms bursts, a 0.2 ms ramp, `TONE.clickRampMin`): it is a
   demonstration of a published sound, kept at -30 dBFS, and not a nice tone by design.

## Measured readings

None yet. The aims in `LEVELS` are by ear and by arithmetic on the gains in each voice. A lane that reads the real
RMS per channel (the master analyser after the limiter, `masterAnalyser()`, in a Playwright run) writes the
reading here beside its aim with the date and the build, and moves the constant only on that reading.

## What a new voice does

Build its envelope with `softEnvelope()` (or clamp to `TONE.attackMin` and `TONE.releaseMin`), filter any saw or
square under `TONE.rawCeiling`, detune with `gentleDetune()`, pick its aim from `LEVELS` (or add a row there), and
add it to the envelope test in `tests/modes.test.mjs` ("the tone rules") so the floors are checked on it.
