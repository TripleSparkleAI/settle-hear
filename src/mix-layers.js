// settle-hear · mix-layers - THE HOUSE MIX, HEARD: plays one bar of the house DJ's decision (mix-dj.js): the drum
// machine pattern, the bass, the pad, the flute lead, the drone, the arps, the answering voice, the sampler chop of
// the old tune, the field texture and the NEUTRAL HUM, through the effect rack whose amounts the DJ moves, with the
// planner's transition moves on the bus.
//
// <claudes_code_comments>
// ** Function List **
// MIX_LEVELS                 - each layer's level (the tune sits under the groove; the hum and the textures are
//                              capped by their own modules)
// BASS_STYLES_PLAY           - the four bass styles as players: sub (off-beat sine), rolling (sixteenths on the root
//                              and fifth), acid (a 303 line, voice-acid.js), organ (one held pedal note a bar); sub
//                              and rolling leave the last beat to a turnaround (opts.turn, lane DJWIRE)
// bassTurn(ctx, out, t0, beatDur, opts) - a trained bar's turnaround: root, third, fifth, seventh on the last beat
// LEAD_LIFT                  - each lead instrument's level against the flute it replaced (lane MELODYFX)
// arpVelocity / answerVelocity - the velocity that gives the arps and the answer their peak on any instrument
// octaveShift(inst, centre)  - whole octaves that move a tune's middle toward the instrument's register
// swingAt(at, swing)         - an off-beat eighth (at x.5) pushed late by the set's swing, in beats
// createMixSet(ctx, out, { seed }) - the set: bar(t0, d, beatDur) plays one decision; state() names what is playing
//                              (layers, rack, beds, moves); muteSlot(slot, on, t0) closes one part's bus (lane
//                              McKUSKER: the lead, for 432 Hz McKUSKER MODE's mute); dispose() fades and frees it
//
// ** Technical Review **
// - THE SIGNAL FLOW:
//     melodic layers -> mix in -> THE RACK (mix-rack.js buildRack: the chain slots, each a dry/wet crossfade, then
//     the house limiter) -> bus in;   drums -> bus in (the drums skip the chain so the sidechain never ducks the kick)
//     bus in -> bus filter (low-pass: the mix machine's FILTER bit, the filter drop) -> bus level (the one-bar
//     silence, the tape stop) -> slot fade -> out;   a move's own sound (riser, cymbal, snare roll) -> after the bus
//     level, so a silence before the drop leaves the riser sounding into it
// - A CHAIN CHANGE (a new set, a roll at a second peak) builds the new rack beside the old one at the bar line and
//   crossfades over one beat, never mid-bar. Amount changes glide over the whole bar (a sweep, a build).
// - BEDS: the evolving pad, the field texture and the hum are continuous; a bed starts when its bit turns on (the
//   hum: when the section becomes the hum) and fades out when it turns off. The hum plays on the heaviest key of the
//   influence window and, in its motif variant, the window's motif slowed right down: the set carries the sets
//   before it into the quiet.
// - CALL AND RESPONSE: on the second bar of each two, the ANSWER voice plays the first three notes the lead played
//   in the bar before, in the bar's second half, on the set's answer instrument at its own register. When the set's
//   answer is THE ECHO GUITAR (lane ECHOGUITAR, echoguitar.js) it plays its own phrase instead, from beat 1.5, a card
//   of its phrase deck dealt once a set, in the bar's key, through its tempo-synced echo and small room.
// - THE GUITARS (lanes ECHOGUITAR and DJGUITARS): dealt as the answer, THE ECHO GUITAR or THE FUZZ LEAD answers with
//   its own phrase from beat 1.5 on every second bar; dealt as the arps, THE PHASE GUITAR plays the bar's chord (a
//   piece's own chord when a piece plays) as its set's part (an arpeggio, a strum or a swell) through its set's
//   modulation (the phaser or the flanger). Every deck (one card a set) and every pedalboard (built once a set, so its
//   LFOs run free across the bars, and let ring out when the set changes) lives in djguitars.js createSetGuitars, and
//   this file makes one call a bar: the site's first load carries only that glue. The module (djguitars.js, which
//   re-exports echoguitar.js) loads on demand through echoguitar-lazy.js, fetched when the set is made; a bar before
//   it arrives plays nothing in that part. A base's own chords still play as the base's triads.
// - THE VOICE CHAINS (lane MELODYFX, voice-fx.js): the lead, the arps, the answer and the chop each play into their
//   own bus, whose chain (a warm drive and two to four more) the brain settles per set (d.voices). The clear flute's
//   bus has no chain. A new set's chains crossfade in over one beat on the bar line. The lead is moved by whole
//   octaves to its instrument's register (octaveShift: the keys sit an octave under the flute), the off-beat eighths
//   of the lead and the arps lean late by the set's swing (swingAt), and every note's velocity varies a little
//   (fixed for a bar). The arps are eighth notes in the chord's own octave (they were sixteenth triangles an octave
//   up), the organ bass holds one pedal note a bar (it was stabs on 1 and 3).
// - THE OLD TUNE INSIDE THE HOUSE TRACK: in a build, the sampler chop cuts a phrase of the current tune, rendered
//   once into a buffer (voice-chop.js), into sixteenths under the groove.
// - THE BASES (lane HOUSEBASES): when the decision carries a realised base (d.bases.realised, the brain's hook with
//   a library), the drums are the base's four drum parts through the family's kit (bases/base-play.js playBasePart),
//   the bass and the arps are the base's bass and chords when it carries them, and the lead is gated to the base's
//   hats and ducked under its kick (gateNotesToBase). Without a base every layer plays as before.
// - THE TRAINED SET (lane DJWIRE): when the decision carries a trained bar (d.trained.groove), the drums are that
//   bar's settled steps through the set's kit (dj-trained-play.js: the learned levels, hat voices, clap or snare,
//   the family's swing and played feel, the crash where it fired), in place of the base's drums and the family
//   pattern; a bar whose settled turnaround fired walks the bass up root, third, fifth, seventh on its last beat
//   (sub and rolling bass). STAGE 3's seam (lane DJNOTES, dj-trained-notes.js): when the trained bar carries a
//   piece's notes (d.trained.notes), its bass notes replace the style's bass, its arp notes play on the set's arp
//   instrument in place of the chord eighths, and its chords sound as a soft triad under the pad. Since lane
//   PIECESPLAY the lead is THE PIECE'S OWN LEAD (d.lead.kind 'piece': d.notes are the piece's lead notes, each on its
//   sixteenth with the piece's swing and its velocity as an accent), and the bar's root and chord are the piece's,
//   so the pad, the drone and the answer follow the piece's key. See SETTLE/DJ_CHANNEL.md.
// - Every pitch from midiHz (A = 432). Everything is scheduled on the audio clock for the bar ahead.
// </claudes_code_comments>

import { buildRack } from './mix-rack.js';
import { fxOf } from './fx-index.js';
import { strike } from './house.js';
import { playNote } from './instruments.js';
import { midiHz } from './tuning.js';
import { DRUM_PATTERNS, playPattern, DRUM_KITS } from './voice-drum-machines.js';
import { playBasePart, gateNotesToBase } from './bases/base-play.js'; // THE BASES (lane HOUSEBASES)
import { acidLine, playAcidBar } from './voice-acid.js';
import { renderPhrase, chopBar, CHOP_PATTERNS } from './voice-chop.js';
import { createVoiceBuses, HOUSE_SLOTS, REGISTER, CLEAN_INSTRUMENTS, velocityFor, INST_PEAK } from './voice-fx.js';
import { playTrainedDrums } from './dj-trained-play.js'; // THE TRAINED DJ (lane DJWIRE)
import { loadEchoGuitar, echoGuitarNow } from './echoguitar-lazy.js'; // THE ECHO GUITAR (lane ECHOGUITAR), on demand

// THE VOICE CHAINS (lane MELODYFX): the bar's notes moved by whole octaves toward the instrument's home pitch, the
// off-beat eighths pushed late by the set's swing, the velocity varied a little note by note (fixed for a bar)
export function octaveShift(inst, centre) {
  if (!Number.isFinite(centre)) return 0;
  return 12 * Math.round(((REGISTER[inst] ?? centre) - centre) / 12);
}
export function swingAt(at, swing) {
  const frac = at - Math.floor(at);
  return Math.abs(frac - 0.5) < 1e-6 ? at + (swing || 0) : at;
}
const humanize = (bar, i) => 0.88 + 0.12 * ((Math.sin((bar + 1) * 12.9898 + i * 78.233) * 43758.5453) % 1 + 1) % 1;

export const MIX_LEVELS = { drums: 0.75, bass: 0.32, lead: 0.42, surfacing: 0.6, drone: 0.05, arps: 0.07, answer: 0.18, chop: 0.12, pad: 0.05, texture: 0.04, hum: 0.04 };
// lane MELODYFX: the lead's level against the flute it replaces (the keys fall away while held, so they start higher)
export const LEAD_LIFT = { 'flute-drive': 1, keys: 1.3, fiddle: 1.2 };
// the arps' and the answer's peak levels: the arps were sixteenth triangles peaking at 0.07 x (0.5 + 0.5 energy);
// as eighth notes, half as many and shorter, they peak higher, at 0.112 x (0.55 + 0.45 energy); the answer peaks where the old bells did
export const arpVelocity = (inst, energy = 0.5) => velocityFor(inst, MIX_LEVELS.arps * 1.6 * (0.55 + 0.45 * energy));
export const answerVelocity = (inst) => velocityFor(inst, MIX_LEVELS.answer * INST_PEAK.bells);

const at = (p, v, t) => { try { p.setValueAtTime(v, t); } catch { p.value = v; } };
const lin = (p, v, t) => { try { p.linearRampToValueAtTime(v, t); } catch { p.value = v; } };
const expo = (p, v, t) => { try { p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); } catch { p.value = v; } };
const bassOf = (m) => { let x = m; while (midiHz(x) > 80) x -= 12; while (midiHz(x) < 38) x += 12; return x; };

export const BASS_STYLES_PLAY = {
  sub(ctx, out, t0, beatDur, { chord, energy, turn = false }) {
    const f = midiHz(bassOf(chord[0]));
    for (let b = 0; b < (turn ? 3 : 4); b++) strike(ctx, out, 'sine', f, t0 + b * beatDur + beatDur / 2, { peak: MIX_LEVELS.bass * (0.6 + 0.4 * energy), attack: 0.01, decay: beatDur * 0.4 });
  },
  rolling(ctx, out, t0, beatDur, { chord, energy, turn = false }) {
    const r = bassOf(chord[0]);
    const seq = [r, r, r + 7, r, r, r + 12, r + 7, r];
    for (let i = 0; i < 16; i++) {
      if (i % 4 === 0 || (turn && i >= 12)) continue; // the kick's step stays clear; a turnaround takes the last beat
      strike(ctx, out, 'triangle', midiHz(seq[i % seq.length]), t0 + (i * beatDur) / 4, { peak: MIX_LEVELS.bass * 0.7 * (0.6 + 0.4 * energy), attack: 0.005, decay: beatDur * 0.22, filter: 600 });
    }
  },
  acid(ctx, out, t0, beatDur, { chord, energy, seed, mode }) {
    playAcidBar(ctx, out, t0, beatDur, { notes: acidLine(seed, bassOf(chord[0]) + 12, mode), cutoff: 300 + 900 * energy, level: MIX_LEVELS.bass * 0.55 });
  },
  // lane MELODYFX: the organ held the root as stabs on beats 1 and 3, an oom-pah under a major tune (half of the
  // circus sound); it now holds one long pedal note a bar, a triangle with a quiet filtered square an octave up
  organ(ctx, out, t0, beatDur, { chord, energy }) {
    const f = midiHz(bassOf(chord[0]));
    strike(ctx, out, 'triangle', f, t0, { peak: MIX_LEVELS.bass * 0.55 * (0.6 + 0.4 * energy), attack: 0.03, decay: beatDur * 3.2, filter: 500 });
    strike(ctx, out, 'square', f * 2, t0, { peak: MIX_LEVELS.bass * 0.12, attack: 0.04, decay: beatDur * 2.6, filter: 600 });
  },
};

// THE TURNAROUND (lane DJWIRE): a trained bar whose settled turnaround fired walks the bass up root, third, fifth,
// seventh in sixteenths on its last beat (the sub and the rolling bass; the acid line and the organ keep their own)
export function bassTurn(ctx, out, t0, beatDur, { chord, energy = 1, mode = 'ionian', style = 'sub' } = {}) {
  if (style !== 'sub' && style !== 'rolling') return 0;
  const r = bassOf(chord[0]);
  const third = ['ionian', 'lydian', 'mixolydian'].includes(mode) ? 4 : 3;
  [0, third, 7, 10].forEach((d, i) => strike(ctx, out, 'triangle', midiHz(r + d), t0 + 3 * beatDur + (i * beatDur) / 4, { peak: MIX_LEVELS.bass * 0.7 * (0.6 + 0.4 * energy), attack: 0.005, decay: beatDur * 0.2, filter: 700 }));
  return 4;
}

export function createMixSet(ctx, out, { seed = 1, wrapVoices = null } = {}) {
  const mixIn = ctx.createGain();
  const drumsIn = ctx.createGain();
  drumsIn.gain.value = MIX_LEVELS.drums;
  const busIn = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 18000;
  filter.Q.value = 0.9;
  const level = ctx.createGain();
  const fade = ctx.createGain();
  fade.gain.value = 0;
  drumsIn.connect(busIn);
  busIn.connect(filter);
  filter.connect(level);
  level.connect(fade);
  fade.connect(out);
  const moveIn = ctx.createGain();
  moveIn.connect(fade);
  const bus = { input: moveIn, level, filter, out: fade };
  at(fade.gain, 0, ctx.currentTime);
  lin(fade.gain, 0.8, ctx.currentTime + 1.5);
  // the drone: one held oscillator pair, its level ramped
  const droneG = ctx.createGain();
  droneG.gain.value = 0;
  droneG.connect(mixIn);
  const droneO = [ctx.createOscillator(), ctx.createOscillator()];
  droneO[0].type = 'sine';
  droneO[1].type = 'triangle';
  const droneLp = ctx.createBiquadFilter();
  droneLp.type = 'lowpass';
  droneLp.frequency.value = 400;
  for (const o of droneO) { o.frequency.value = 55; o.connect(droneLp); o.start(); }
  droneLp.connect(droneG);

  // THE VOICE CHAINS (lane MELODYFX): one bus per melodic part, its own chain, into the mix (and so the rack)
  const voiceBus = (typeof wrapVoices === 'function' ? wrapVoices : (b) => b)(createVoiceBuses(ctx, mixIn, HOUSE_SLOTS)); // lane DJOVERDRIVE: THE DJ's colour hook (dj-colour.js colourBuses)
  let rack = null;
  let rackKeys = '';
  const retiring = new Set();
  const beds = { pad: null, texture: null, hum: null };
  let lastLead = [];
  let chop = { label: null, buffer: null };
  // THE ECHO GUITAR's phrases (lane ECHOGUITAR): a deck, one card a set, so every phrase comes round before any repeats
  loadEchoGuitar().catch(() => { /* the guitar stays silent until a later set loads it */ });
  // THE PSYCH GUITARS (lane DJGUITARS): the set's two guitars (their decks and boards) live in the on-demand module,
  // so the site's first load carries only this glue; the first bar that deals a guitar fetches the module and plays
  // nothing in that part, and the next bar plays it
  let psych = null;
  const guitars = () => { const G = echoGuitarNow(); if (!G) { loadEchoGuitar().catch(() => {}); return null; } return (psych ??= G.createSetGuitars(ctx, { seed })); };
  let dead = false;
  let lastState = { layers: {}, rack: [], beds: [], moves: [] };

  function newRack(slots, t0, beatDur) {
    const next = buildRack(ctx, slots);
    const nf = ctx.createGain();
    mixIn.connect(next.input);
    next.output.connect(nf);
    nf.connect(busIn);
    if (!rack) { at(nf.gain, 1, t0); rack = { r: next, f: nf }; return; }
    const old = rack;
    at(nf.gain, 0, t0);
    lin(nf.gain, 1, t0 + beatDur);
    at(old.f.gain, 1, t0);
    lin(old.f.gain, 0, t0 + beatDur);
    retiring.add(old);
    const id = setTimeout(() => {
      retiring.delete(old);
      try { mixIn.disconnect(old.r.input); } catch { /* gone */ }
      old.r.dispose();
      try { old.f.disconnect(); } catch { /* gone */ }
    }, Math.max(0, (t0 - ctx.currentTime + beatDur) * 1000) + 300);
    id?.unref?.();
    rack = { r: next, f: nf };
  }

  function bed(name, on, t0, start) {
    if (on && !beds[name]) { try { beds[name] = start(); } catch { beds[name] = null; } }
    if (!on && beds[name]) { try { beds[name].stop(t0); } catch { /* gone */ } beds[name] = null; }
  }

  return {
    bus,
    // d: a mix-dj.js decision; beatDur: seconds a beat
    bar(t0, d, beatDur) {
      if (dead || !d) return null;
      const y = d.mix.yes;
      const e = d.energy;
      // THE RACK: rebuild on a new set of keys, else glide every amount over the bar
      const keys = d.chain.map((c) => c.key).join('|');
      if (keys !== rackKeys) { newRack(d.chain, t0, beatDur); rackKeys = keys; }
      else for (const c of d.chain) rack.r.amount(c.key, c.amount, t0, 4 * beatDur * 0.95);
      rack.r.bar(t0, { beatDur, bar: d.bar, chord: d.chord, root: d.root, melody: d.notes, heat: e });
      // the bus filter: closed for the FILTER bit (a build opens it bar by bar), open otherwise
      const closedTo = d.section === 'build' ? 700 + 9000 * Math.min(1, (d.plan.barsIn + 1) / 8) : 650;
      at(filter.frequency, filter.frequency.value, t0);
      expo(filter.frequency, y.filter ? closedTo : 18000, t0 + 4 * beatDur * 0.9);
      // THE BASES (lane HOUSEBASES): the phrase's base once its plan has loaded; the family pattern until then
      const B = d.bases?.realised ?? null;
      const bBar = d.bases?.bar ?? 0;
      const kit = DRUM_KITS[(DRUM_PATTERNS[d.drumFamily] ?? DRUM_PATTERNS.chicago).kit] ?? DRUM_KITS['909'];
      // DRUMS: the trained set's settled bar (lane DJWIRE), else the base's four drum parts, else the family's pattern
      const TG = d.trained?.groove ?? null;
      if (y.drums) {
        if (TG) playTrainedDrums(ctx, drumsIn, t0, beatDur, TG, { kit, feel: d.trained.feel, clap: d.trained.clap, energy: e, bar: d.bar });
        else if (B) for (const p of ['kick', 'snare', 'hats', 'perc']) playBasePart(ctx, drumsIn, t0, beatDur, B, p, { bar: bBar, energy: e, kit });
        else playPattern(ctx, drumsIn, t0, beatDur, DRUM_PATTERNS[d.drumFamily] ?? DRUM_PATTERNS.chicago, { energy: e, tune: 0 });
      }
      // STAGE 3's seam (lane DJNOTES, dj-trained-notes.js): a piece's own pitched notes for this bar, by role
      const PN = d.trained?.notes ?? null;
      const pnStep = beatDur / 4;
      const pnSwing = Math.max(0, Math.min(0.4, Number(d.trained?.feel?.swing) || 0));
      const pnAt = (s) => t0 + (s + (s % 2 ? pnSwing : 0)) * pnStep;
      // BASS from a piece's bass notes, else the base when it carries one, else by the set's style
      if (y.bass && PN?.bass?.length) {
        for (const [s, dur, p, v] of PN.bass) strike(ctx, mixIn, 'triangle', midiHz(bassOf(p)), pnAt(s), { peak: MIX_LEVELS.bass * 0.7 * (0.6 + 0.4 * e) * (v / 127), attack: 0.005, decay: Math.max(0.05, Math.min(dur * pnStep, beatDur * 2)), filter: 700 });
      } else if (y.bass) {
        if (B?.parts?.bass) playBasePart(ctx, mixIn, t0, beatDur, B, 'bass', { bar: bBar, energy: e });
        else (BASS_STYLES_PLAY[d.bassStyle] ?? BASS_STYLES_PLAY.sub)(ctx, mixIn, t0, beatDur, { chord: d.chord, energy: e, seed: (seed + d.plan.set) >>> 0, mode: d.mode, turn: !!TG?.events?.turn });
        if (TG?.events?.turn && !B?.parts?.bass) bassTurn(ctx, mixIn, t0, beatDur, { chord: d.chord, energy: e, mode: d.mode, style: d.bassStyle });
      }
      // THE VOICE CHAINS: each part takes the set's instrument and chain (a new set crossfades over one beat)
      const P = d.voices;
      voiceBus.palette(P, t0, beatDur, { beatDur, bar: d.bar, chord: d.chord, root: d.root, melody: d.notes, heat: e });
      const voiceOf = voiceBus.voiceOf;
      const swing = P?.swing ?? 0;
      const into = (slot) => voiceBus.input(slot, t0);
      // LEAD: the composed tune, or the old tune surfacing in the breakdown, on the set's lead instrument
      const leadV = voiceOf('lead');
      const leadShift = octaveShift(leadV.inst, d.leadCentre);
      const leadLevel = (d.surfacing ? MIX_LEVELS.surfacing : MIX_LEVELS.lead) * (CLEAN_INSTRUMENTS.has(leadV.inst) ? 1 : LEAD_LIFT[leadV.inst] ?? 1);
      // over a base the tune is gated to its hats (in a build or at the peak) and ducked under its kick
      const leadNotes = B ? gateNotesToBase(B, bBar, d.notes, { gate: d.section === 'build' || d.section === 'peak' ? 'hats' : null, duck: 0.4 }) : d.notes.map((n) => ({ ...n, level: 1 }));
      // a piece's own lead (lane PIECESPLAY): each note on its sixteenth with the piece's swing, its velocity an accent
      const pieceLead = d.lead?.kind === 'piece';
      const leadAt = (n) => (pieceLead && Number.isFinite(n.step) ? pnAt(n.step) : t0 + swingAt(n.at, swing) * beatDur);
      const leadVel = (n) => (pieceLead && Number.isFinite(n.vel) ? 0.75 + 0.25 * Math.min(1, n.vel / 127) : 1);
      // legato: a note holds to the next one (the keys a touch past it, a pedal), never a detached staccato
      const legato = leadV.inst === 'keys' ? 1.08 : 1;
      if (y.lead) leadNotes.forEach((n, i) => { if (n.midi != null) playNote(ctx, into('lead'), leadV.inst, midiHz(n.midi + leadShift), leadAt(n), n.beats * beatDur * legato, leadLevel * n.level * leadVel(n) * humanize(d.bar, i)); });
      // ANSWER: the lead's opening three notes of the bar before, in this bar's second half, at the answer
      // instrument's own register (lane MELODYFX: no longer a bell an octave above the tune)
      const ansV = voiceOf('answer');
      // THE ECHO GUITAR and THE FUZZ LEAD answer with their own phrases (THE GUITARS' call below); they are not
      // playNote instruments, so this line plays nothing for them
      if (y.answer && d.bar % 2 === 0 && lastLead.length) {
        const sh = octaveShift(ansV.inst, lastLead.reduce((a, m) => a + m, 0) / lastLead.length);
        lastLead.slice(0, 3).forEach((m, i) => playNote(ctx, into('answer'), ansV.inst, midiHz(m + sh), t0 + (2 + i * 0.5) * beatDur, beatDur * 0.9, answerVelocity(ansV.inst) * humanize(d.bar, i + 7)));
      }
      lastLead = d.notes.filter((n) => n.midi != null).map((n) => n.midi);
      // ARPS: the base's chords when it carries them, else the chord as eighth notes on the set's arp instrument,
      // in the chord's own octave, swung, every other note softer (lane MELODYFX: was sixteenth triangles an octave up)
      const arpV = voiceOf('arps');
      // a piece's arp notes (stage 3's seam) on the set's arp instrument; its chords as a soft held triad under the pad
      // THE GUITARS (lanes ECHOGUITAR and DJGUITARS): dealt, the echo guitar or the fuzz lead answers every second bar
      // and the phase guitar plays the bar's chord as its set's part (djguitars.js createSetGuitars bar(), which holds
      // their decks and boards). They are not playNote instruments, so the answer and arp lines play nothing for them
      const phaseGuitar = arpV.inst === 'phase-guitar';
      if (/-guitar|fuzz/.test(ansV.inst + arpV.inst)) try { guitars()?.bar(into, d, t0, beatDur, y, ansV.inst, arpV.inst, answerVelocity(ansV.inst) * humanize(d.bar, 7), arpVelocity(arpV.inst, e), swing); } catch { /* a bar that fails stays silent */ }
      if (y.arps && PN?.arp?.length) {
        const sh = octaveShift(arpV.inst, PN.arp.reduce((a, n) => a + n[2], 0) / PN.arp.length);
        for (const [s, dur, p, v] of PN.arp) playNote(ctx, into('arps'), arpV.inst, midiHz(p + sh), pnAt(s), Math.max(0.05, dur * pnStep * 0.9), arpVelocity(arpV.inst, e) * (v / 127));
      }
      if (y.pad && PN?.chords?.length) {
        for (const [s, dur, p, v] of PN.chords) strike(ctx, mixIn, 'triangle', midiHz(p), pnAt(s), { peak: 0.03 * (0.55 + 0.45 * e) * (v / 127), attack: 0.06, decay: Math.max(0.1, Math.min(dur * pnStep, 4 * beatDur)), filter: 1400 });
      }
      if (PN?.arp?.length || phaseGuitar) { /* the piece's arps or the phase guitar played above */ } else if (y.arps && B?.parts?.chords) playBasePart(ctx, into('arps'), t0, beatDur, B, 'chords', { bar: bBar, energy: e, level: MIX_LEVELS.arps * 1.5 });
      else if (y.arps) {
        const c = d.chord;
        const seq = [c[0], c[1], c[2], c[0] + 12, c[2], c[1], c[0], c[2]];
        const sh = octaveShift(arpV.inst, (c[0] + c[2]) / 2);
        const arpLevel = arpVelocity(arpV.inst, e);
        for (let i = 0; i < 8; i++) playNote(ctx, into('arps'), arpV.inst, midiHz(seq[i] + sh), t0 + swingAt(i / 2, swing) * beatDur, beatDur * 0.45, arpLevel * (i % 2 ? 0.7 : 1) * humanize(d.bar, i + 13));
      }
      // THE CHOP: the old tune cut into sixteenths under a build
      if (d.section === 'build' && y.lead && d.tune) {
        if (chop.label !== d.tune.label) { try { chop = { label: d.tune.label, buffer: renderPhrase(ctx, d.notes.length ? d.notes : [{ midi: d.root + 12, beats: 1 }], beatDur) }; } catch { chop = { label: d.tune.label, buffer: null }; } }
        if (chop.buffer) chopBar(ctx, into('chop'), t0, beatDur, { buffer: chop.buffer, pattern: CHOP_PATTERNS[d.plan.barsIn % 2 ? 'skip' : 'stutter'], level: MIX_LEVELS.chop });
      }
      // DRONE
      const droneHz = midiHz(bassOf(d.root));
      for (const o of droneO) { at(o.frequency, o.frequency.value, t0); expo(o.frequency, droneHz, t0 + 0.5); }
      at(droneG.gain, droneG.gain.value, t0);
      lin(droneG.gain, y.drone ? MIX_LEVELS.drone : 0, t0 + beatDur);
      // BEDS: the pad, the texture, the hum
      bed('pad', y.pad, t0, () => fxOf('evolving-pad').start(ctx, mixIn, t0, { root: d.root - 12, chord: d.chord.map((m) => m - 12), beatDur, level: MIX_LEVELS.pad }));
      bed('texture', y.texture, t0, () => fxOf('field-texture').start(ctx, mixIn, t0, { variant: d.texture, level: MIX_LEVELS.texture, seed }));
      const blend = d.influence?.blend;
      const humRoot = blend ? 48 + blend.keyPc : d.root;
      const humMotif = blend?.motif?.length ? blend.motif.reduce((a, s) => [...a, a[a.length - 1] + s], [humRoot + 24]) : null;
      bed('hum', d.section === 'hum', t0, () => fxOf('neutral-hum').start(ctx, busIn, t0, { variant: d.hum.variant, rate: d.hum.rate, root: humRoot, motif: humMotif, beatDur, level: MIX_LEVELS.hum }));
      // THE MOVES on the bus
      for (const m of d.moves) {
        const F = fxOf(m.key);
        if (F?.play) { try { F.play(ctx, bus, t0, { beatDur, bars: m.bars, root: d.root, lift: m.lift }); } catch { /* a move that fails stays silent */ } }
      }
      lastState = {
        base: B ? { id: B.id, bar: bBar % Math.max(1, B.bars), slices: B.slices ?? null } : null,
        trained: d.trained ? { family: d.trained.family, block: d.trained.block, drums: !!(y.drums && TG), turn: !!TG?.events?.turn, notes: PN ? Object.fromEntries(Object.entries(PN).map(([k, v]) => [k, v.length])) : null } : null,
        layers: { ...y },
        rack: rack.r.amounts(),
        beds: Object.entries(beds).filter(([, v]) => v).map(([k]) => k),
        moves: d.moves.map((m) => m.key),
        voices: voiceBus.states(),
      };
      return lastState;
    },
    state() { return { ...lastState, cost: rack?.r.cost ?? 0, nodes: rack?.r.nodes ?? 0 }; },
    get rack() { return rack?.r ?? null; },
    muteSlot(slot, on, t0 = ctx.currentTime) { if (!dead) voiceBus.mute(slot, !!on, t0); },
    dispose() {
      if (dead) return;
      dead = true;
      const t = ctx.currentTime;
      at(fade.gain, fade.gain.value, t);
      lin(fade.gain, 0, t + 0.3);
      for (const b of Object.values(beds)) try { b?.stop(t); } catch { /* gone */ }
      try { psych?.dispose(t + 0.3); } catch { /* gone */ }
      const id = setTimeout(() => {
        for (const s of [rack, ...retiring]) { if (!s) continue; s.r.dispose(); try { s.f.disconnect(); } catch { /* gone */ } }
        voiceBus.dispose();
        for (const o of droneO) try { o.stop(); o.disconnect(); } catch { /* gone */ }
        for (const n of [mixIn, drumsIn, busIn, filter, level, fade, moveIn, droneG, droneLp]) try { n.disconnect(); } catch { /* gone */ }
      }, 450);
      id?.unref?.();
    },
  };
}
