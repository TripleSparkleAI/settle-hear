// settle-hear · symphony - THE HERO SYMPHONY: the home hero's default sound. A 432 Hz binaural pair on a 40 Hz base,
// a drone, the flute playing old tunes, harp and bells around it, and the DJ deciding, bar by bar, what changes.
//
// <claudes_code_comments>
// ** Function List **
// TRACKS                     - the tracks a listener can switch (hidden toggles): flute, fiddle, harp, bells, crystal,
//                              drone, harmonics, binaural
// MINOR_MODES                - the modes whose static harmonics leave out partial 5 (its major third clashes)
// rootMidiOf(theme)          - the theme's root note as a midi number
// carrierOf(theme)           - the binaural carrier: the theme's root moved into 150 .. 300 Hz
// createSymphony(opts)       - the player: { update(stats), tick(now), play(), stop(), setLevel(v), setTrack(name, on),
//                              setTheme(key), nextTune(), setHouse(on), house, dj, state, subscribe(fn), dispose() };
//                              opts.steer (default djSteer, steer.js): the visitor's steering store, read once a bar
//                              every emit also writes djLive (djlive.js), the read-only public copy
//   opts: seed (the clock by default: a new set each visit), theme (or a random pick), level (0.55),
//         playing (true), tracks ({ name: bool }), tunes (TUNES), auto (true: run its own 60 ms timer),
//         house (false: THE HOUSE DJ; setHouse(on) switches it), pure (false: THE McKUSKER FLUTE; setPure(on)),
//         influenceStorage (a localStorage-like store for the influence window), votes (djVotes)
//   more api: setMixLean(key, v), setPure(v), tag, playTag(tag) (lane SETTLEDJ)
//   opts.opener (false): THE OPENING BLEND (lane OPENINGSET, opener.js) plays the visit's first set; yieldOpener(why)
//
// ** Technical Review **
// - THE CLOCK: one bar at a time. When a bar is due (its start is within 0.15 s), the player asks the DJ for a
//   decision (dj.bar(latest stats)) and schedules that whole bar's notes on the audio clock. Before the first
//   gesture there is no audio clock, so bars run on the wall clock and the DJ still decides (the visualiser shows it
//   working); nothing is scheduled.
// - TEMPO: bpm = slow + (fast - slow) x heat, inside the theme's range, smoothed bar to bar (0.6 old, 0.4 new). A
//   hot field plays at the fast end, a settled one at the slow end. A bar is the theme's meter (4 beats).
// - ON THE MASTER BEAT (masterbeat.js): the bar is then made a whole number of 500 ms master ticks (quantizeBar: the
//   house set's 118-126 bpm becomes exactly 120, a 2 s bar; 84 bpm becomes 3 s), every bar starts on a master tick
//   on the audio clock (nextMasterBar, snapToTick), and a late bar waits for the next tick. So THE DJ's bar line is
//   a TRUE TIME tick and a 40 Hz flash onset. A test that drives tick(at) by hand keeps its own times.
// - THE MODES the DJ settles on, each bar: tune (the flute plays the next bar of the tune, harp and bells around it),
//   bed (no melody: harp broken chords and bells), static (the harmonics: partials 1..n of the drone root fade in one
//   after another; in a minor theme partial 5 is left out), drone (the drone and the binaural pair alone).
// - TUNES: picked from the tunes whose tags meet the theme's, transposed so the tonic is the theme's root and the
//   middle note sits near G5. The flute resumes where it stopped. A tune that ends is followed by another. With no
//   playable tune the flute plays a short phrase generated from the theme's scale, and the state says so.
// - THE BINAURAL PAIR: left = the theme's root (150 .. 300 Hz), right = left + the DJ's beat (40 Hz home). Glides
//   over 4 s when the beat or the theme changes. It sits on its own dry channel: no reverb, no delay, so each ear
//   keeps its own tone. Headphones are needed to hear the beat.
// - A FILM in the hero: every new film frame strikes a soft bell on a partial of the root (it keeps time).
// - MUTE ALL, PAUSE ALL and the first gesture are the engine's (engine.js): the player schedules nothing while sound
//   is not audible, and its two channels go through the master, the mute and the limiter like every sound here. A
//   hidden tab plays on (lane SOUNDDOCTOR's background rule) with a 1.6 s look-ahead, past a throttled timer.
// - THE HOUSE SET (lane HOUSEDJ, houseset.js + house.js): with house on, each bar goes to the house set instead of
//   the instruments: a soft thump and pad, the tune about 14 dB under them, through a chain of a few of the 25
//   passes, swapped by the DJ at bar lines; the tempo moves 118 to 126 bpm with the heat. The binaural pair keeps
//   playing on its dry channel if its track is on; the drone and harmonics rest. The set has its own channel (no
//   theme filter), into the same master, mute and limiter. houseLive (spectrumlive.js) tells the hero when the house
//   set is heard, so the hero can settle toward its spectrum.
// - THE BAR EVENT: every bar decision also fires a window event 'settle-hear:bar' ({ bar, mode, beat, at }), so a
//   page can move at a bar line (the sound shuffle crossfades modes there, lane BINAURALMODES).
// - THE TWO PLAYING MODES (lane SETTLEDJ): opts.pure (setPure) is THE McKUSKER FLUTE: a collected tune played as
//   written, start to end, on the raw flute alone, in a light room (reverb 0.12, no delay), at one steady tempo per
//   tune; no drone, harmonics, binaural pair, harp, bells or house passes. House mode (setHouse) is THE HOUSE DJ: the
//   brain (mix-dj.js: planner, mix machine, composer, rack amounts, influence window) decides each bar and the mix
//   set (mix-layers.js) plays it. In house mode the DJ's own theme light is held; the theme moves on at a new set.
// - THE TAG (dj-tag.js): every bar the symphony packs the whole situation into one tag (state.tag); djVotes ratings
//   of tags lean the planner and the mix machine (dj-votes.js); playTag(tag) loads a tag back into the live DJ.
// - THE SET HOOKS: dj.cycleSet fires at a new house set or a theme change, and a window event 'settle-hear:set'.
// - THE OPENING BLEND (lane OPENINGSET, opts.opener): the first set of a visit is the opener (opener.js), never house:
//   tones, isochronic pulses, a pad, no drums. Its clock (openerVisit.pos, opener seconds) moves only while the
//   symphony is audible on the audio clock, so a pause, MUTE ALL or a hidden start holds it, and its first second is
//   the first second anybody hears. Until it ends the house brain is not asked for a bar (so the DJ's first set
//   starts at its own bar 0) and the DJ's theme light is held. Each bar schedules the opener's envelopes from pos to
//   pos + the bar. At the arc's end THE HANDOVER: the house brain starts its first set, the house set fades in from 0
//   over the handover (a GainNode between the set and its channel) while the opener's tail fades out, and the set
//   hooks fire with the opener's tag (a set the visitor can vote on). The visitor's steering, a mode pick
//   (yieldOpener), setPure, setHouse, a house tag, a tune skip, a mix lean, a lock, a hold, a clamp or a theme
//   yields at once: the opener's voices fade over OPENER.yieldFade (2.5 s) and the house set comes up over 2 s. The
//   opener's tag is "<THEME>.open.v1.<code>" (opener-tag.js); playTag(that tag) plays that opener again.
// - THE VOICE CHAINS (lane MELODYFX, voice-fx.js): in the symphony the fiddle, the harp, the bells and the crystal
//   each play into their own bus, whose chain (a warm drive and two to four more) is dealt per theme from the
//   symphony's own dealer stream; a bus is built on its part's first note. Lane MELODYFX2: the tune is the 'lead'
//   part, dealt per theme between the clear flute (its bus has no chain) and the distorted flute (a hard warm drive
//   and two to four more); pure mode stays the clear flute alone, straight into the channel. state.voices names each
//   part's chain (house mode: the brain's palette; pure mode: the clear flute alone), and the tag carries the
//   palette (dj-tag.js).
// - Determinism: everything random comes from one seeded stream per symphony (the DJ's) plus one for the notes,
//   seeded from the same seed, so a test can drive tick() by hand and get the same decisions every run.
// </claudes_code_comments>

import { armUnlock, onEngine, getEngine, createChannel, ramp, wantSound, isAway } from './engine.js';
import { registerPulseTarget } from './pulse.js';
import { sound } from './control.js';
import { createDJ, rng, pickTheme } from './dj.js';
import { midiHz, noteMidi, BEAT_HOME, MODES } from './tuning.js';
import { themeOf } from './themes.js';
import { TUNES, playableTunes, tunesFor, placeTune, generatedPhrase, createTuneDealer } from './tunes.js';
import { playNote, makeDrone, makeHarmonics, makeBinaural } from './instruments.js';
import { createHouseSet, houseBpm } from './houseset.js';
import { houseLive } from './spectrumlive.js';
import { masterGrid, nextLine, nextMasterBar, snapToTick, quantizeBar } from './masterbeat.js';
import { djLive, djSnapshot, DJ_IDLE } from './djlive.js';
import { soundLog, soundLogOn } from './soundlog.js'; // SOUNDLOG
import { djSteer, applySteer, isIdleSteer, STEER_IDLE, STEER_TRACKS, STEER_MIX } from './steer.js';
import { createHouseDJ } from './mix-dj.js';
import { createMixSet } from './mix-layers.js';
import { encodeTag, decodeTag, situationOf } from './dj-tag.js';
import { playTag as rebuildTag, djTagRequests } from './dj-replay.js';
import { djVotes, votesFromTags, VOTE_LEAN } from './dj-votes.js';
import { describeInfluence } from './dj-influence.js';
import { OPENER, OPENER_RATES, GAMMA_RATE, settleOpener, openerPlan, openerSlotAt, openerVoices, openerVisit, readOpenerMemory, writeOpenerMemory } from './opener.js';
import { encodeOpenerTag, isOpenerTag, decodeOpenerTag } from './opener-tag.js';
import { rackOf } from './mix-rack.js';
import { MIX_CHOICES } from './mix-machine.js';
import { sectionOf } from './mix-planner.js';
import { createVoiceDealer, createVoiceBuses, SYMPHONY_SLOTS, SYMPHONY_INSTRUMENTS, chainLine, specOf } from './voice-fx.js';

export const TRACKS = STEER_TRACKS.slice();
export const MINOR_MODES = new Set(['aeolian', 'dorian', 'phrygian', 'locrian', 'minor pentatonic']);

const LOOKAHEAD = 0.15;
// THE BACKGROUND RULE (lane SOUNDDOCTOR): a hidden tab's timers may fire only once a second, so the player schedules
// a bar this far ahead while hidden; the bar is decided early and plays on the audio clock all the same
export const LOOKAHEAD_HIDDEN = 1.6;
const lookahead = () => (typeof document !== 'undefined' && document.hidden ? LOOKAHEAD_HIDDEN : LOOKAHEAD);

export function rootMidiOf(theme) {
  const m = noteMidi(themeOf(theme?.key ?? theme).root);
  return Number.isFinite(m) ? m : 57;
}

export function carrierOf(theme) {
  let f = midiHz(rootMidiOf(theme));
  while (f > 300) f /= 2;
  while (f < 150) f *= 2;
  return f;
}

function dryChannel(E, level) {
  const { ctx } = E;
  const fader = ctx.createGain();
  fader.gain.value = 0;
  // THE RADIAL PULSE (pulse.js): a dry channel takes the swell alone
  const swell = ctx.createGain();
  swell.gain.value = 1;
  fader.connect(swell);
  swell.connect(E.master);
  const unpulse = registerPulseTarget({ anchor: null, ctx, gain: swell.gain });
  let lvl = level;
  let on = true;
  const token = {}; // THE DEMAND (engine.js): a playing channel keeps the context awake
  const apply = (tau) => ramp(fader.gain, on ? lvl : 0, ctx.currentTime, tau);
  apply(0.5);
  wantSound(token, true);
  return {
    input: fader,
    setLevel(v) { lvl = v; apply(0.1); },
    setPlaying(p) { on = !!p; apply(on ? 0.4 : 0.05); wantSound(token, on); },
    dispose() {
      ramp(fader.gain, 0, ctx.currentTime, 0.05);
      wantSound(token, false);
      unpulse();
      const id = setTimeout(() => { for (const n of [fader, swell]) try { n.disconnect(); } catch { /* gone */ } }, 300);
      id?.unref?.();
    },
  };
}

const wall = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

export function createSymphony({ seed, theme = null, level = 0.55, playing = true, tracks = {}, tunes = TUNES, auto = true, house = false, pure = false, steer = djSteer, influenceStorage = null, votes = djVotes, bases = null, opener = false } = {}) {
  const s0 = Number.isFinite(seed) ? seed : (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  const dj = createDJ({ seed: s0, theme });
  const r = rng(s0 ^ 0x5bd1e995);
  const on = Object.fromEntries(TRACKS.map((t) => [t, tracks[t] ?? true]));
  const pool = playableTunes(tunes);
  const tuneDealer = createTuneDealer({ random: r }); // THE DECK RULE: the flute deals each theme's tunes like a deck
  let lvl = Math.min(1, Math.max(0, Number.isFinite(+level) ? +level : 0.55));
  let isPlaying = !!playing;
  let stats = null;
  let E = null;
  let wet = null;
  let dry = null;
  let drone = null;
  let harm = null;
  let bin = null;
  let droneKind = null;
  let nextBar = null; // time of the next bar, on whichever clock is running
  let onAudioClock = false;
  let bpm = null;
  let decision = null;
  let tune = null; // { tune, notes, pos, offset, generated }
  let lastFrame = null;
  let dead = false;
  const subs = new Set();
  const recent = []; // the last notes played, for the visualiser's melody strip
  let timer = null;
  let houseOn = !!house;
  let houseCh = null;
  let houseSet = null; // THE HOUSE MIX (mix-layers.js createMixSet), heard
  // THE McKUSKER FLUTE (pure): a collected tune as written, on the flute alone, a light room, nothing else
  let pureOn = !!pure && !house;
  let pureBpm = null;
  // THE HOUSE DJ'S BRAIN (mix-dj.js): planner, mix machine, composer, rack amounts, influence window; pure data
  const houseDJ = createHouseDJ({ seed: s0, theme: dj.theme.key, tunes, storage: influenceStorage, bases }); // bases: THE BASES library (lane HOUSEBASES), optional
  let houseDecision = null;
  let tag = null;
  // THE OPENING BLEND (lane OPENINGSET): wanted, the claimed opener (voices, channel), the house set's fade gain
  let opWant = !!opener && !pureOn && openerVisit.state !== 'done';
  let op = null;
  let houseFade = null;
  if (opWant && !openerVisit.plan) {
    const c = settleOpener({ seed: (s0 ^ 0x0be11ed) >>> 0, theme: dj.theme.key, last: readOpenerMemory(influenceStorage) });
    openerVisit.choices = c;
    openerVisit.plan = openerPlan(c);
    openerVisit.pos = 0;
  }
  if (opWant && openerVisit.plan && openerVisit.plan.theme !== dj.theme.key) { dj.setTheme(openerVisit.plan.theme); houseDJ.setTheme(openerVisit.plan.theme); }
  // the opener holds the set while it is wanted and not yet past its arc (playing, or waiting for the first sound)
  const openerHolds = () => opWant && !pureOn && openerVisit.plan && openerVisit.pos < openerVisit.plan.length;
  let played = []; // the voices and notes of the last bar, for the tests and the parts popover
  // THE VOICE CHAINS in the symphony (lane MELODYFX): the fiddle, the harp, the bells and the crystal each play through
  // their own chain, dealt per theme; lane MELODYFX2: the tune is a part too ('lead'), dealt per theme between the
  // clear flute (dry) and the distorted flute (its chain), so a processed flute plays wherever the clear one can
  const symDealer = createVoiceDealer({ seed: (s0 ^ 0x3243f6a8) >>> 0 || 1 });
  let symVoices = null;
  let symBus = null;
  const mixSteer = Object.fromEntries(STEER_MIX.map((k) => [k, 0]));
  let voteLeans = null;
  const recomputeVotes = () => {
    const list = votes?.list?.() ?? [];
    voteLeans = VOTE_LEAN.on && list.length ? votesFromTags(list, (t) => decodeTag(t, { tunes: pool })) : null;
  };
  recomputeVotes();
  const offVotes = votes?.subscribe ? votes.subscribe(() => {
    recomputeVotes();
    // a rating of the tag playing now rides into this set's influence record
    const last = votes.list().at(-1);
    if (last && last.tag === tag) houseDJ.noteVote(last.stars);
  }) : () => {};

  // a hidden tab plays on (the background rule); PAUSE ALL and MUTE ALL stop the schedule
  const audible = () => !!E && isPlaying && sound.audible && !isAway();
  const now = () => (onAudioClock && E ? E.ctx.currentTime : wall());

  const snapshot = () => ({
    playing: isPlaying,
    audible: audible(),
    unlocked: sound.unlocked,
    muted: sound.muted,
    level: lvl,
    tracks: { ...on },
    bpm: bpm ?? null,
    decision,
    theme: dj.theme,
    beat: dj.beat,
    carrier: carrierOf(dj.theme),
    harmonics: dj.harmonics,
    tune: tune ? { title: tune.tune?.title ?? null, source: tune.tune?.source ?? null, generated: !!tune.generated, pos: tune.pos, length: tune.notes.length, shift: tune.shift ?? 0 } : null,
    recent: recent.slice(),
    tunesAvailable: pool.length,
    themeLocked: dj.themeLocked,
    beatHeld: dj.beatHeld,
    clamps: dj.clamps,
    steers: dj.steers,
    wanted: dj.wanted,
    seed: s0,
    house: { on: houseOn, ...houseState() },
    pure: pureOn,
    mix: houseOn ? mixView() : null,
    tag,
    set: dj.set,
    adjusted: dj.adjusted,
    played: played.slice(),
    parts: partsView(),
    opener: openerView(),
    voices: voicesView(),
  });
  // THE VOICE CHAINS as the panel reads them (lane MELODYFX): the palette playing now, one line a part
  function activePalette() {
    if (pureOn) return null;
    if (houseOn) return houseDecision?.voices ?? null;
    return symVoices;
  }
  function voicesView() {
    const P = activePalette();
    if (pureOn) return { mode: 'pure', lines: ['the clear flute: clear, no effects'], voices: [] };
    if (!P) return null;
    return { mode: houseOn ? 'house' : 'symphony', swing: P.swing, lines: P.voices.map(chainLine), voices: P.voices.map((v) => ({ slot: v.slot, inst: v.inst, chain: v.chain.map((c) => ({ key: c.key, amount: c.amount, params: { ...c.params } })) })) };
  }
  // THE OPENING BLEND as the DJ line and the panel read it
  function openerView() {
    if (!opWant && !op) return null;
    const P = op?.plan ?? openerVisit.plan;
    if (!P) return null;
    const at = Math.min(P.end, openerVisit.pos);
    const slot = openerSlotAt(P, at);
    return {
      on: true,
      phase: !op ? 'waiting' : at >= P.length ? 'handover' : 'play',
      at,
      length: P.length,
      handover: P.handover,
      slot: slot.key,
      slotLabel: slot.label,
      // the pulse rate the visitor hears now: the slot's slow rate, 40 Hz from the gamma slot on, none in silence
      rateHz: slot.rate ? OPENER_RATES[slot.rate].hz : ['gamma', 'ease'].includes(slot.key) ? GAMMA_RATE : slot.key === 'harmonic' ? OPENER_RATES[P.slots[1].rate].hz : null,
      slots: P.slots.map((x) => ({ key: x.key, label: x.label, start: x.start, end: x.end, rate: x.rate ?? null, rateLabel: x.rate ? OPENER_RATES[x.rate].label : x.key === 'gamma' ? `${GAMMA_RATE} Hz` : null })),
      rates: P.rates.slice(),
      f0: P.f0,
      fEnd: P.fEnd,
      timbres: [P.choices.timbreFirst, P.choices.timbreHarm],
      bells: P.bells.length,
      tag: encodeOpenerTag(P.choices, at),
    };
  }
  function houseState() {
    const keys = houseDecision ? houseDecision.chain.map((c) => c.key) : [];
    const st = houseSet ? houseSet.state() : { cost: 0 };
    return {
      keys,
      labels: keys.map((k) => rackOf(k)?.label ?? k),
      lines: keys.map((k) => rackOf(k)?.line ?? ''),
      amounts: houseDecision ? houseDecision.chain.map((c) => c.amount) : [],
      cost: st.cost ?? 0,
      swaps: 0,
      bar: houseDecision?.bar ?? 0,
      barsSince: houseDecision?.plan?.barsIn ?? 0,
    };
  }
  function mixView() {
    const h = houseDecision;
    if (!h) return null;
    return {
      section: h.section,
      sectionLabel: sectionOf(h.section).label,
      set: h.plan.set,
      setBar: h.plan.setBar,
      barsIn: h.plan.barsIn,
      next: h.plan.next,
      nextAt: h.plan.nextAt,
      plan: h.plan.plan ? { chosen: h.plan.plan.chosen, G: h.plan.plan.G, parts: h.plan.plan.parts, top: h.plan.plan.top.map((x) => ({ plan: x.plan, G: x.G, p: x.p })), count: h.plan.plan.count, at: h.plan.plan.at } : null,
      energyTarget: h.plan.energyTarget,
      energy: h.energy,
      yes: h.mix.yes,
      pYes: h.mix.pYes,
      leans: h.mix.leans,
      trace: h.mix.trace,
      chain: h.chain.map((c) => ({ ...c, label: rackOf(c.key)?.label ?? c.key, family: rackOf(c.key)?.family ?? '' })),
      moves: h.moves.map((m) => ({ ...m, label: rackOf(m.key)?.label ?? m.key })),
      lead: h.lead,
      tune: h.tune,
      surfacing: h.surfacing,
      keyLift: h.keyLift,
      drumFamily: h.drumFamily,
      bassStyle: h.bassStyle,
      texture: h.texture,
      hum: h.hum,
      influence: { count: h.influence.window.length, decay: h.influence.decay, words: describeInfluence(h.influence.window) },
      votes: voteLeans ? { n: voteLeans.n } : { n: 0 },
    };
  }
  // THE PARTS: what is used to make the music now, in plain words (the parts popover reads this)
  function partsView() {
    const ov = openerHolds() ? openerView() : null;
    if (ov) {
      return {
        mode: 'opening blend',
        tune: null,
        sources: [],
        voices: ['a soft first tone', 'a harmonic tone', 'a warm pad', `isochronic pulses (${ov.rates.join(', ')})`, 'a 40 Hz isochronic pulse', 'a few soft bells'],
        chain: [],
        next: `the DJ's first set at ${Math.floor(ov.length / 60)}:${String(Math.round(ov.length % 60)).padStart(2, '0')}`,
        section: 'OPENING BLEND',
        influence: null,
        tag,
      };
    }
    const voices = [];
    if (pureOn) voices.push('the McKusker flute, alone');
    else if (houseOn && houseDecision) {
      for (const c of MIX_CHOICES) if (houseDecision.mix.yes[c.key] && !['wash', 'filter', 'chain'].includes(c.key)) voices.push(c.label.toLowerCase());
      if (houseDecision.section === 'hum') voices.push(`the neutral hum (${houseDecision.hum.variant}, ${houseDecision.hum.rate})`);
    } else voices.push(...Object.entries(on).filter(([, v]) => v).map(([k]) => k));
    const lead = houseOn ? houseDecision?.lead : null;
    const sources = (lead?.sources ?? (tune?.tune ? [{ id: tune.tune.id, title: tune.tune.title, source: tune.tune.source }] : [])).map((x) => ({ title: x.title, book: x.source?.book ?? x.source?.dataset ?? null, year: x.source?.year ?? null, where: x.source?.where ?? x.source?.record ?? null }));
    return {
      mode: pureOn ? 'McKusker flute' : houseOn ? 'house DJ' : 'symphony',
      tune: pureOn || !houseOn ? (tune?.tune?.title ?? (tune?.generated ? 'a generated phrase' : null)) : lead?.label ?? null,
      sources,
      voices,
      chain: houseOn && houseDecision ? houseDecision.chain.map((c) => `${rackOf(c.key)?.label ?? c.key} ${Math.round(c.amount * 100)}%`) : [],
      next: houseOn && houseDecision ? (houseDecision.plan.next === houseDecision.section ? `stays ${sectionOf(houseDecision.section).label} to bar ${houseDecision.plan.nextAt}` : `${sectionOf(houseDecision.plan.next).label} at bar ${houseDecision.plan.nextAt}`) : null,
      section: houseOn && houseDecision ? sectionOf(houseDecision.section).label : null,
      influence: houseOn && houseDecision ? describeInfluence(houseDecision.influence.window) : null,
      tag,
    };
  }
  const emit = () => {
    const s = snapshot();
    houseLive.set({ house: houseOn, audible: houseOn && s.audible, chain: s.house.keys.join(',') });
    djLive.set(djSnapshot(s)); // read only: lane FEEDBACKRL names what plays (djlive.js)
    for (const f of subs) f(s);
  };

  function ensureHouse() {
    if (!E || !houseOn || houseSet) return;
    houseCh = createChannel(E, { level: lvl, reverb: 0.06, delay: 0, filter: 20000, fadeIn: 1.5 });
    houseCh.setPlaying(isPlaying);
    // THE HANDOVER's fade (lane OPENINGSET): silent while the opener holds the set, then raised under its tail
    houseFade = E.ctx.createGain();
    houseFade.gain.value = openerHolds() ? 0 : 1;
    houseFade.connect(houseCh.input);
    houseSet = createMixSet(E.ctx, houseFade, { seed: (s0 ^ 0x2545f491) >>> 0 });
  }
  function dropHouse() {
    if (!houseSet) return;
    const ch = houseCh;
    const set = houseSet;
    const fade = houseFade;
    houseSet = null;
    houseCh = null;
    houseFade = null;
    const fid = setTimeout(() => { try { fade?.disconnect(); } catch { /* gone */ } }, 700);
    fid?.unref?.();
    ch.setPlaying(false);
    set.dispose();
    const id = setTimeout(() => ch.dispose(), 600);
    id?.unref?.();
  }

  function scheduleHouseBar(t0, d, beatDur) {
    const theme = d.theme;
    ensureVoices(theme);
    ensureHouse();
    const root = rootMidiOf(theme);
    const carrier = carrierOf(theme);
    drone.level(0, t0);
    harm.set(midiHz(root), 0, t0);
    bin.set(carrier, carrier + d.beat, t0, 4);
    bin.level(on.binaural ? 1 : 0, t0);
    const h = houseDecision;
    if (!h) return;
    for (const nt of h.notes) if (nt.midi != null) recent.push({ midi: nt.midi, beats: nt.beats, bar: d.bar });
    while (recent.length > 24) recent.shift();
    houseSet.bar(t0, h, beatDur);
    played = [{ inst: 'house', layers: Object.keys(h.mix.yes).filter((k) => h.mix.yes[k]), moves: h.moves.map((m) => m.key) }];
    void root;
  }

  function newTune() {
    const list = tunesFor(dj.theme, pool);
    if (!list.length) {
      const phrase = generatedPhrase(r, dj.theme, 16);
      const root = rootMidiOf(dj.theme);
      const base = root + 12 * Math.round((76 - root) / 12);
      tune = { tune: null, generated: true, pos: 0, offset: 0, shift: 0, notes: phrase.map((n) => ({ midi: base + n.deg, beats: n.beats })) };
      return;
    }
    const pick = tuneDealer.next(dj.theme, pool);
    const placed = placeTune(pick.parsed, rootMidiOf(dj.theme));
    tune = { tune: pick, generated: false, pos: 0, offset: 0, shift: placed.shift, notes: placed.notes };
  }

  // the next `beats` beats of the tune, from the cursor; advances the cursor
  function takeTune(beats) {
    if (!tune || tune.pos >= tune.notes.length) newTune();
    const out = [];
    let at = 0;
    let guard = 0;
    while (at < beats - 1e-6 && guard++ < 256) {
      if (tune.pos >= tune.notes.length) { newTune(); if (!tune.notes.length) break; }
      const n = tune.notes[tune.pos];
      const left = n.beats - tune.offset;
      const take = Math.min(left, beats - at);
      if (tune.offset === 0) out.push({ midi: n.midi, at, beats: n.beats });
      at += take;
      tune.offset += take;
      if (tune.offset >= n.beats - 1e-6) { tune.pos += 1; tune.offset = 0; }
    }
    return out;
  }

  function ensureVoices(theme) {
    if (!E) return;
    const { ctx } = E;
    if (droneKind !== theme.drone) {
      drone?.dispose();
      drone = makeDrone(ctx, wet.input, theme.drone);
      droneKind = theme.drone;
    }
    if (!harm) harm = makeHarmonics(ctx, wet.input);
    if (!bin) bin = makeBinaural(ctx, dry.input);
    if (!symBus) symBus = createVoiceBuses(ctx, wet.input, SYMPHONY_SLOTS);
  }
  // the symphony's palette for the theme (a theme change deals a new one) and the bus a part plays into
  function symVoicesFor(theme, t0, beatDur, d) {
    if (!symVoices || d?.themeChanged || symVoices.theme !== theme.key) symVoices = { ...symDealer.palette({ theme: theme.key, slots: SYMPHONY_SLOTS, instruments: SYMPHONY_INSTRUMENTS }), theme: theme.key };
    symBus.palette(symVoices, t0, beatDur, { beatDur, bar: d?.bar ?? 0, root: rootMidiOf(theme), chord: [], melody: [] });
  }
  const busIn = (slot) => (symBus ? symBus.input(slot, E?.ctx.currentTime) : wet.input);

  function scheduleBar(t0, d, beatDur) {
    const theme = d.theme;
    const { ctx } = E;
    ensureVoices(theme);
    if (pureOn) { schedulePureBar(t0, d, beatDur); return; }
    const mix = theme.instruments;
    const root = rootMidiOf(theme);
    const droneHz = midiHz(root) > 160 ? midiHz(root - 12) : midiHz(root);
    const carrier = carrierOf(theme);
    // the sends follow the theme
    wet.setSends({ reverb: theme.reverb, delay: theme.delay, filter: 1800 + 9000 * theme.bright });
    // drone and binaural: always, unless switched off
    drone.set(droneHz, t0, d.themeChanged ? 3 : 1);
    drone.level(on.drone ? (mix.pipes ?? mix.pad ?? 0.6) * (d.mode === 'drone' ? 1.2 : 0.8) : 0, t0);
    bin.set(carrier, carrier + d.beat, t0, 4);
    bin.level(on.binaural ? 1 : 0, t0);
    // the harmonics: static mode only
    const minor = MINOR_MODES.has(theme.mode);
    const n = d.mode === 'static' && on.harmonics ? d.harmonics : 0;
    harm.set(droneHz, n, t0, beatDur, minor ? [5] : []);
    const meter = theme.meter ?? 4;
    symVoicesFor(theme, t0, beatDur, d);
    // the melody
    if (d.mode === 'tune') {
      const notes = takeTune(meter);
      for (const nt of notes) {
        if (nt.midi == null) continue;
        const f = midiHz(nt.midi);
        const t = t0 + nt.at * beatDur;
        const dur = nt.beats * beatDur * 0.95;
        if (on.flute) playNote(ctx, busIn('lead'), symBus.voiceOf('lead').inst, f, t, dur, 0.85 * (mix.flute ?? 1));
        if (on.fiddle && mix.fiddle && d.bar % 2 === 0) playNote(ctx, busIn('fiddle'), 'fiddle', f / 2, t, dur, 0.6 * mix.fiddle);
        recent.push({ midi: nt.midi, beats: nt.beats, bar: d.bar });
      }
      while (recent.length > 24) recent.shift();
    }
    // the accompaniment: harp broken chords and bells, by the theme's density
    if (d.mode === 'tune' || d.mode === 'bed') {
      const steps = MODES[theme.mode] ?? MODES.ionian;
      const chord = [0, steps[2] ?? 4, steps[4] ?? 7, 12];
      const base = root - 12 * (root > 60 ? 1 : 0);
      for (let b = 0; b < meter; b++) {
        if (on.harp && mix.harp && r() < theme.density) {
          const k = chord[(b + d.bar) % chord.length];
          playNote(ctx, busIn('harp'), 'harp', midiHz(base + k), t0 + b * beatDur, beatDur, 0.6 * mix.harp);
        }
      }
      if (on.bells && mix.bells && r() < theme.density * 0.5) playNote(ctx, busIn('bells'), 'bells', midiHz(root + 12 + chord[Math.floor(r() * 3)]), t0, 2, 0.5 * mix.bells);
      if (on.crystal && mix.crystal && r() < theme.density * 0.6) playNote(ctx, busIn('crystal'), 'crystal', midiHz(root + 24 + chord[Math.floor(r() * 4)]), t0 + beatDur * Math.floor(r() * meter), 2, 0.6 * mix.crystal);
    }
    if (d.mode === 'static' && on.crystal && (mix.crystal || mix.bells) && r() < 0.5) {
      // a glint on one of the sounding partials
      const k = 1 + Math.floor(r() * Math.max(1, n));
      playNote(ctx, busIn(mix.crystal ? 'crystal' : 'bells'), mix.crystal ? 'crystal' : 'bells', droneHz * k * 2, t0 + beatDur * 2, 2, 0.4);
    }
  }

  // THE McKUSKER FLUTE, pure: the collected tune note for note on the raw flute, a light room, nothing else sounds
  // (no drone, no harmonics, no binaural pair, no harp, no bells, no house passes). A tune that ends rests one bar.
  function schedulePureBar(t0, d, beatDur) {
    const { ctx } = E;
    wet.setSends({ reverb: 0.12, delay: 0, filter: 12000 });
    drone.level(0, t0, 0.3);
    harm.set(110, 0, t0);
    bin.level(0, t0, 0.3);
    played = [];
    if (!on.flute) return;
    for (const nt of takePure(d.theme.meter ?? 4)) {
      if (nt.midi == null) continue;
      playNote(ctx, wet.input, 'flute', midiHz(nt.midi), t0 + nt.at * beatDur, nt.beats * beatDur * 0.95, 0.85);
      recent.push({ midi: nt.midi, beats: nt.beats, bar: d.bar });
      played.push({ inst: 'flute', midi: nt.midi, at: nt.at, beats: nt.beats, bar: d.bar });
    }
    while (recent.length > 24) recent.shift();
  }
  // the pure tune: a COLLECTED tune only (never a generated phrase), from its first note to its last
  let pureRest = 0;
  function takePure(beats) {
    if (pureRest > 0) { pureRest -= 1; return []; }
    if (!tune || tune.generated || tune.pos >= tune.notes.length) {
      if (tune && !tune.generated && tune.pos >= tune.notes.length) { tune = null; pureRest = 0; pureBpm = null; return []; }
      const pick = tunesFor(dj.theme, pool).length ? tuneDealer.next(dj.theme, pool) : null;
      if (!pick) return [];
      const placed = placeTune(pick.parsed, rootMidiOf(dj.theme));
      tune = { tune: pick, generated: false, pos: 0, offset: 0, shift: placed.shift, notes: placed.notes };
    }
    return takeTune(beats);
  }

  // THE OPENING BLEND (lane OPENINGSET): claim it on the first audible bar, schedule one bar of it, hand over, yield
  function claimOpener(t0) {
    if (op || !opWant || pureOn || !openerVisit.plan || !E) return op;
    if (openerVisit.state === 'fresh') writeOpenerMemory(influenceStorage, openerVisit.choices);
    openerVisit.state = 'playing';
    const ch = createChannel(E, { level: lvl, reverb: 0.22, delay: 0, filter: 9000, fadeIn: 0.3 });
    ch.setPlaying(isPlaying);
    op = { plan: openerVisit.plan, choices: openerVisit.choices, ch, voices: openerVoices(E.ctx, ch.input, openerVisit.plan, { startAt: t0 }), t0, from: openerVisit.pos, handed: false };
    return op;
  }
  function scheduleOpenerBar(t0, barSec) {
    if (!claimOpener(t0)) return;
    ensureVoices(dj.theme);
    // the symphony's own drone, harmonics and binaural pair rest under the opener
    drone.level(0, t0, 0.5);
    harm.set(110, 0, t0);
    bin.level(0, t0, 0.5);
    const P = op.plan;
    const from = openerVisit.pos;
    const to = Math.min(P.end, from + barSec);
    op.voices.schedule(t0, from, to);
    op.t0 = t0;
    op.from = from;
    openerVisit.pos = to;
    played = [{ inst: 'opener', slot: openerSlotAt(P, from).key, from, to }];
  }
  // the opener's position at audio time t (the bar in flight is already scheduled ahead of it)
  const openerPosAt = (t) => (op ? Math.max(op.from, Math.min(openerVisit.pos, op.from + (t - op.t0))) : openerVisit.pos);
  function endOpener(fade) {
    const o = op;
    op = null;
    if (!o) return;
    const t = E ? E.ctx.currentTime : 0;
    o.voices.yieldAt(t, openerPosAt(t), fade);
    o.ch.setPlaying(false);
    const id = setTimeout(() => { o.voices.dispose(); o.ch.dispose(); }, (fade + 0.6) * 1000);
    id?.unref?.();
  }
  // the arc ran to its end: the tail's envelope is already at 0 there; stop the sources after it and free them
  function finishOpener(tEnd) {
    const o = op;
    op = null;
    opWant = false;
    openerVisit.state = 'done';
    if (!o) return;
    o.voices.stop(tEnd + 0.1);
    const id = setTimeout(() => { o.voices.dispose(); o.ch.dispose(); }, Math.max(0, (tEnd - (E ? E.ctx.currentTime : 0)) + 1) * 1000);
    id?.unref?.();
  }
  function yieldOpener(why = 'yield') {
    if (!opWant && !op) return false;
    const wasHolding = openerHolds();
    if (soundLogOn()) soundLog('sym:opener:yield', { why, at: openerVisit.pos }); // SOUNDLOG
    if (op && E) {
      const t = E.ctx.currentTime;
      // a yield before the arc's end hands the house set back over two seconds
      if (houseFade && wasHolding) { try { houseFade.gain.cancelScheduledValues(t); houseFade.gain.setValueAtTime(houseFade.gain.value, t); houseFade.gain.linearRampToValueAtTime(1, t + 2); } catch { houseFade.gain.value = 1; } }
      openerVisit.pos = openerPosAt(t);
    } else if (houseFade) houseFade.gain.value = 1;
    endOpener(OPENER.yieldFade);
    opWant = false;
    openerVisit.state = 'done';
    emit();
    return true;
  }

  // THE STEERING lands here, on the bar line (steer.js): the diff since the last applied state, then the DJ decides
  let steerApplied = STEER_IDLE;
  let steerPending = null;
  function takeSteer() {
    if (!steerPending) return;
    const next = steerPending;
    steerPending = null;
    // a steer from the visitor yields the opening blend at once (a reset to idle does not)
    if (!isIdleSteer(next) && opWant) yieldOpener('your steering');
    applySteer(api, next, steerApplied);
    steerApplied = next;
  }
  // THE SET HOOKS (lane LOOPLAYERS): dj.onSetCycle listeners, and a page event with the same object
  function announceSet(reason, endedTag) {
    const ev = dj.cycleSet({ reason, tag: endedTag });
    try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('settle-hear:set', { detail: ev })); } catch { /* no window */ }
  }
  // THE TAG: the whole situation of this bar (dj-tag.js); a vote is stored against it
  function makeTag(d, bpmNow) {
    const st = steer?.get?.() ?? STEER_IDLE;
    const h = houseOn ? houseDecision : null;
    const lead = h?.lead;
    const tuneInfo = h
      ? { kind: lead?.kind ?? 'none', seed: lead?.seed ?? 0, sources: lead?.input ?? [], bar: lead?.bar ?? 0 }
      : tune && !tune.generated ? { kind: 'collected', seed: 0, sources: [tune.tune.id], bar: Math.floor(tuneBeatsDone() / (d.theme.meter ?? 4)) } : { kind: tune?.generated ? 'generated' : 'none', seed: 0, sources: [], bar: 0 };
    try {
      return encodeTag(situationOf({
        theme: d.theme.key,
        pure: pureOn,
        section: h?.section ?? (d.mode === 'drone' ? 'hum' : 'intro'),
        setBar: h?.plan.setBar ?? 0,
        set: h?.plan.set ?? dj.set,
        keyLift: h?.keyLift ?? 0,
        tune: tuneInfo,
        keyPc: h ? lead?.keyPc ?? 0 : ((rootMidiOf(d.theme) % 12) + 12) % 12,
        bpm: bpmNow,
        beat: d.beat,
        layers: h?.mix.yes ?? {},
        energy: h?.energy ?? 0,
        chain: h?.chain ?? [],
        moves: h?.moves.map((m) => m.key) ?? [],
        hum: h?.hum,
        texture: h?.texture,
        drumFamily: h?.drumFamily,
        bassStyle: h?.bassStyle,
        steer: { leans: st.leans, mix: st.mix, wantBeat: st.wantBeat, wantTheme: st.wantTheme, holdBeat: st.holdBeat, lockTheme: st.lockTheme, tracks: st.tracks },
        influence: h ? { decay: h.influence.decay, window: h.influence.window } : { decay: 0.6, window: [] },
        voices: specOf(activePalette()),
      }));
    } catch { return null; }
  }
  function tuneBeatsDone() {
    if (!tune) return 0;
    let b = 0;
    for (let i = 0; i < Math.min(tune.pos, tune.notes.length); i++) b += tune.notes[i].beats;
    return Math.max(0, b - 0.001);
  }

  // THE LIVE DOOR: a tag asked for through settle-hear's playTag lands on the next bar line
  let tagPending = null;
  const offTagReq = djTagRequests.subscribe((t) => { tagPending = t; });
  function runBar(t0) {
    if (tagPending) { const t = tagPending; tagPending = null; try { api.playTag(t); } catch { /* a bad tag is ignored */ } }
    takeSteer();
    // THE OPENING BLEND holds the set: no house bar, the theme held, until its arc ends
    const holding = openerHolds();
    const d = dj.bar(stats, { holdTheme: houseOn || holding });
    decision = d;
    if (pureOn) d.mode = 'tune';
    if (holding) {
      // nothing here: the opener is scheduled below, on the audio clock only
    } else if (houseOn) {
      const st = steer?.get?.() ?? STEER_IDLE;
      const mood = { heat: d.inputs.heat, landed: d.inputs.landed, film: d.inputs.film, word: !!d.inputs.word };
      const holds = { lead: on.flute ? null : false, drone: on.drone ? null : false };
      const prevTag = tag;
      houseDecision = houseDJ.bar({ theme: dj.theme.key, mood, steer: { leans: dj.steers, mix: { ...mixSteer } }, holds, votes: voteLeans, bpm: bpm ?? null });
      if (houseDecision.newSet && houseDecision.plan.set > 0) {
        // a NEW SET: the theme moves on (the visitor's wanted theme, else the deck) and the set hooks fire
        const want = st.wantTheme && st.wantTheme !== dj.theme.key ? st.wantTheme : null;
        if (!dj.themeLocked) { const next = want ?? pickTheme(r, dj.theme.key); dj.setTheme(next); houseDJ.setTheme(next); }
        announceSet('a new set', prevTag);
      }
    } else if (d.themeChanged) announceSet('a new theme', tag);
    // THE BAR LINE as a page event (lane BINAURALMODES): the shuffle swaps modes only here when it can
    try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('settle-hear:bar', { detail: { bar: d.bar, mode: d.mode, beat: d.beat, at: t0 } })); } catch { /* no window */ }
    const heat = d.inputs.heat;
    const [slow, fast] = d.theme.bpm;
    if (houseOn) bpm = houseBpm(heat, bpm != null && bpm >= 100 ? bpm : null);
    else {
      const want = slow + (fast - slow) * heat;
      bpm = bpm == null || d.themeChanged ? want : 0.6 * bpm + 0.4 * want;
      bpm = Math.min(fast, Math.max(slow, bpm));
    }
    if (d.themeChanged) { tune = null; pureBpm = null; }
    // the McKusker flute keeps one steady tempo for a whole tune (as written), set when the tune begins
    if (pureOn && pureBpm != null) bpm = pureBpm;
    // THE MASTER BEAT: a bar is a whole number of master ticks, so every bar line is a tick and a flash onset
    const q = quantizeBar(d.theme.meter ?? 4, bpm, masterGrid().tickMs);
    bpm = q.bpm;
    const beatDur = q.beatDur;
    if (pureOn && pureBpm == null) pureBpm = bpm;
    tag = holding ? encodeOpenerTag(openerVisit.choices, openerVisit.pos) : makeTag(d, bpm);
    if (audible() && onAudioClock) {
      try {
        if (holding) scheduleOpenerBar(t0, q.barSeconds);
        else {
          // THE HANDOVER: the opener's tail plays on over the DJ's first bars while the house set fades in
          if (op && !op.handed) {
            op.handed = true;
            const H = Math.max(1, op.plan.end - openerVisit.pos);
            if (houseFade) { try { houseFade.gain.cancelScheduledValues(t0); houseFade.gain.setValueAtTime(0, t0); houseFade.gain.linearRampToValueAtTime(1, t0 + H); } catch { houseFade.gain.value = 1; } }
            // the opener was a set: the hooks fire with its tag, so the visitor can vote on it
            announceSet('the opening blend', encodeOpenerTag(op.choices, op.plan.length));
          }
          if (op) {
            const from = openerVisit.pos;
            const to = Math.min(op.plan.end, from + q.barSeconds);
            op.voices.schedule(t0, from, to);
            op.t0 = t0;
            op.from = from;
            openerVisit.pos = to;
            if (to >= op.plan.end) finishOpener(t0 + (to - from));
          }
          if (houseOn) scheduleHouseBar(t0, d, beatDur); else scheduleBar(t0, d, beatDur);
        }
      } catch { /* a voice that fails stays silent; the DJ keeps deciding */ }
    } else if (holding) {
      // the opener waits for the first sound (or holds through a pause): its clock does not move
    } else if (pureOn) {
      takePure(d.theme.meter ?? 4); // the pure tune moves on even while silent
    } else if (!houseOn && d.mode === 'tune') {
      takeTune(d.theme.meter ?? 4); // the tune moves on even while silent, so the strip and the sound agree
    }
    emit();
    return q.barSeconds;
  }

  // the first master tick at or after t, on whichever clock is running (the audio clock, or wall seconds)
  const nextTick = (t) => (onAudioClock && E ? nextMasterBar(E.ctx, t) : nextLine(t * 1000) / 1000);
  // the first master BAR line (2 s) at or after t: a run of bars starts there, so 2 s bars sit on the master bar grid
  const nextBarLine = (t) => (onAudioClock && E ? nextMasterBar(E.ctx, t, masterGrid().barMs) : nextLine(t * 1000, masterGrid().barMs) / 1000);
  const snap = (t) => (onAudioClock && E ? snapToTick(E.ctx, t) : Math.round((t * 1000 - masterGrid().origin) / masterGrid().tickMs) * masterGrid().tickMs / 1000 + masterGrid().origin / 1000);

  function tick(at) {
    if (dead) return;
    // move to the audio clock once it exists and sound can play
    if (E && !onAudioClock && audible() && soundLogOn()) soundLog('sym:clock', { to: 'audio', ctxTime: +E.ctx.currentTime.toFixed(3) }); // SOUNDLOG
    if (onAudioClock && !audible() && E && soundLogOn()) soundLog('sym:clock', { to: 'wall', playing: isPlaying, audible: sound.audible, hidden: typeof document !== 'undefined' && document.hidden }); // SOUNDLOG
    if (E && !onAudioClock && audible()) { onAudioClock = true; nextBar = nextBarLine(E.ctx.currentTime + 0.1); }
    if (onAudioClock && !audible() && E) { onAudioClock = false; nextBar = nextBarLine(wall() + 0.1); }
    const t = at ?? now();
    if (nextBar == null) nextBar = at != null ? t : nextBarLine(t);
    let guard = 0;
    while (nextBar <= t + lookahead() && guard++ < 4) {
      // a bar that is already late starts on the next tick rather than off the grid
      const start = nextBar < t && at == null ? nextTick(t) : nextBar;
      if (soundLogOn() && start !== nextBar && onAudioClock) soundLog('sym:bar:late', { lateBy: +(t - nextBar).toFixed(3), movedTo: +start.toFixed(3) }); // SOUNDLOG
      // the next bar line, snapped back to a master tick so the two clocks' drift never accumulates
      nextBar = at != null ? start + runBar(start) : snap(start + runBar(start));
    }
  }

  armUnlock();
  const offEngine = onEngine((eng) => {
    if (dead) return;
    E = eng;
    wet = createChannel(E, { level: lvl, reverb: 0.4, delay: 0.15, filter: 9000, fadeIn: 2 });
    dry = dryChannel(E, lvl * 0.9);
    wet.setPlaying(isPlaying);
    dry.setPlaying(isPlaying);
    ensureHouse();
    emit();
  });
  const offSwitch = sound.subscribe(emit);
  const offSteer = steer && typeof steer.subscribe === 'function'
    ? steer.subscribe((next) => { steerPending = next; })
    : () => {};
  if (steer && typeof steer.get === 'function') { const now = steer.get(); if (now && now !== STEER_IDLE) steerPending = now; }

  if (auto && typeof setInterval !== 'undefined') {
    timer = setInterval(() => tick(), 60);
    timer.unref?.();
  }

  const api = {
    dj,
    get state() { return snapshot(); },
    update(st) {
      if (dead || !st) return;
      stats = st;
      const frame = st.film && Number.isFinite(Number(st.film.frame)) ? Number(st.film.frame) : null;
      if (frame != null && lastFrame != null && frame !== lastFrame && audible() && on.bells && E && wet) {
        const root = rootMidiOf(dj.theme);
        try { playNote(E.ctx, busIn('bells'), 'bells', midiHz(root + 12) * (1 + (frame % 3)), E.ctx.currentTime + 0.02, 1.5, 0.35); } catch { /* silent */ }
      }
      lastFrame = frame;
    },
    tick,
    play() {
      if (soundLogOn()) soundLog('sym:play', { was: isPlaying }); // SOUNDLOG
      if (isPlaying) return; isPlaying = true; wet?.setPlaying(true); dry?.setPlaying(true); houseCh?.setPlaying(true); op?.ch.setPlaying(true); emit();
    },
    stop() {
      if (soundLogOn()) soundLog('sym:stop', { was: isPlaying }); // SOUNDLOG
      if (!isPlaying) return;
      isPlaying = false;
      wet?.setPlaying(false);
      dry?.setPlaying(false);
      houseCh?.setPlaying(false);
      op?.ch.setPlaying(false);
      emit();
    },
    toggle() { if (isPlaying) api.stop(); else api.play(); return isPlaying; },
    get playing() { return isPlaying; },
    setLevel(v) {
      const x = Number(v);
      if (!Number.isFinite(x)) return;
      lvl = Math.min(1, Math.max(0, x));
      wet?.setLevel(lvl);
      dry?.setLevel(lvl * 0.9);
      houseCh?.setLevel(lvl);
      op?.ch.setLevel(lvl);
      emit();
    },
    get level() { return lvl; },
    setTrack(name, v) {
      if (!TRACKS.includes(name)) return;
      on[name] = !!v;
      if (E && !on.binaural) bin?.level(0, E.ctx.currentTime, 0.2);
      if (E && !on.drone) drone?.level(0, E.ctx.currentTime, 0.2);
      if (E && !on.harmonics) harm?.set(110, 0, E.ctx.currentTime);
      emit();
    },
    get tracks() { return { ...on }; },
    setTheme(key) { yieldOpener('a theme'); dj.setTheme(key); tune = null; emit(); },
    lockTheme(v) { if (v) yieldOpener('a theme lock'); dj.lockTheme(v); emit(); },
    holdBeat(v) { if (v) yieldOpener('a beat hold'); dj.holdBeat(v); emit(); },
    clamp(key, v) { if (v != null) yieldOpener('a clamp'); dj.clamp(key, v); emit(); },
    // THE OPENING BLEND (lane OPENINGSET): the page yields it when the visitor picks a sound; .opener is its view
    yieldOpener,
    get opener() { return openerView(); },
    nextTune() { yieldOpener('a tune skip'); tune = null; if (!pureOn) newTune(); dj.markAdjusted(); emit(); },
    // the mix machine's leans from the visitor (steer.js mix): energy, drums, bass, pad, fx, each -1..1
    setMixLean(key, v) { if (STEER_MIX.includes(key)) { mixSteer[key] = Math.min(1, Math.max(-1, Number(v) || 0)); if (mixSteer[key]) { dj.markAdjusted(); yieldOpener('a mix lean'); } } },
    get mixLeans() { return { ...mixSteer }; },
    // THE McKUSKER FLUTE on or off (pure mode); house mode wins when both are asked for
    setPure(v) { const want = !!v && !houseOn; if (want === pureOn) return; if (want) yieldOpener('the McKusker flute'); pureOn = want; tune = null; pureBpm = null; emit(); },
    get pure() { return pureOn; },
    get tag() { return tag; },
    // REPLAY: load a tag into the live DJ (house mode: the brain takes its tune, chain, layers and window; pure mode
    // the collected tune at its bar). Returns the rebuilt situation (dj-replay.js).
    playTag(t) {
      // an opener tag plays that opening blend again, from its start, on the next bar
      if (isOpenerTag(t)) {
        const D = decodeOpenerTag(t);
        if (op) endOpener(OPENER.yieldFade);
        openerVisit.choices = D.choices;
        openerVisit.plan = D.plan;
        openerVisit.pos = 0;
        openerVisit.state = 'replay';
        opWant = true;
        pureOn = false;
        if (houseFade && E) { try { houseFade.gain.cancelScheduledValues(E.ctx.currentTime); houseFade.gain.setValueAtTime(houseFade.gain.value, E.ctx.currentTime); houseFade.gain.linearRampToValueAtTime(0, E.ctx.currentTime + OPENER.yieldFade); } catch { houseFade.gain.value = 0; } }
        if (D.theme !== dj.theme.key) { dj.setTheme(D.theme); houseDJ.setTheme(D.theme); }
        emit();
        return rebuildTag(t, { tunes, live: false });
      }
      yieldOpener('a tag');
      const R = rebuildTag(t, { tunes, live: false });
      const d = R.decoded;
      dj.setTheme(d.theme);
      houseDJ.setTheme(d.theme);
      if (d.pure !== pureOn) { if (d.pure) { api.setHouse(false); api.setPure(true); } else { api.setPure(false); api.setHouse(true); } }
      if (!d.pure) houseDJ.load(d, R);
      else if (R.tune) {
        const src = pool.find((x) => x.id === d.tune.sources[0]?.id);
        if (src) { const placed = placeTune(src.parsed, rootMidiOf(dj.theme)); tune = { tune: src, generated: false, pos: 0, offset: 0, shift: placed.shift, notes: placed.notes }; for (let b = 0; b < d.tune.bar; b++) takeTune(4); }
      }
      emit();
      return R;
    },
    setHouse(v) {
      const want = !!v;
      if (want === houseOn) return;
      yieldOpener('a mode');
      houseOn = want;
      if (houseOn) pureOn = false;
      if (houseOn) ensureHouse();
      else dropHouse();
      emit();
    },
    get house() { return houseOn; },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    dispose() {
      if (soundLogOn()) soundLog('sym:dispose', { dead }); // SOUNDLOG
      if (dead) return;
      dead = true;
      clearInterval(timer);
      offEngine();
      offSwitch();
      offSteer();
      offVotes();
      offTagReq();
      for (const v of [drone, harm, bin]) v?.dispose();
      symBus?.dispose();
      // the opener's voices go; the visit keeps its plan and position, so a remounted player resumes it
      if (op) { const o = op; op = null; try { o.voices.yieldAt(E ? E.ctx.currentTime : 0, openerPosAt(E ? E.ctx.currentTime : 0), 0.3); } catch { /* gone */ } o.ch.dispose(); const id = setTimeout(() => o.voices.dispose(), 600); id?.unref?.(); }
      dropHouse();
      houseLive.set({ house: false, audible: false, chain: '' });
      djLive.set(DJ_IDLE);
      wet?.dispose();
      dry?.dispose();
      subs.clear();
    },
  };
  return api;
}

export { BEAT_HOME };
