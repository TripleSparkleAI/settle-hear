// settle-hear · djlive - THE DJ's public state, read only: what the hero symphony plays right now, in one small object.
//
// <claudes_code_comments>
// ** Function List **
// DJ_IDLE           - the state when no symphony runs: nothing plays, every field null
// djSnapshot(s)     - a symphony snapshot (symphony.js snapshot()) -> the compact public state
// colourOf(c)       - THE DJ's colour (lane DJOVERDRIVE) as plain data: the overdrive and the vocoder, each or null
// djLive            - the store: get(), set(state), subscribe(fn); written by the symphony, read by anyone
//
// ** Technical Review **
// - Lane FEEDBACKRL needs to name what plays when a listener rates it: the theme, the tune, the house chain, the
//   binaural beat and carrier, the DJ's bar mode. The symphony keeps that state inside HeroSymphony; this store is a
//   one-way window onto it. The symphony writes it from emit() and clears it on dispose(); nothing here can change
//   what the DJ does (there is no setter on the DJ, only on this copy).
// - Lane DJFX added fx: THE DJ'S DESK (dj-fx.js) - mood, overdo, the settle's flavour and the bus's effect values.
// - Lane SOUNDSHAKE added fx.weather, fx.weatherLabel and fx.weatherHard: THE WEATHER the DJ dealt this phrase.
// - Lane DJOVERDRIVE added fx.overdrive (the OVERDRIVE mood heard on the bus), fx.baseMood (the mood the deck dealt
//   under it), fx.colour (THE DJ's overdrive and vocoder on one voice each, with the part and whether it sounds now)
//   and fx.colourLabel (the words for the ones sounding, or null).
// - Lane SETTLEDJ added pure, tag, set, adjusted, section and parts (the parts popover's words), all plain data.
// - Lane McKUSKER added melody: { voice, present, muted } (melody.js), what the 432 Hz McKUSKER MODE tag reads.
// - Lane DJWIRE added brain ('trained' or 'old': which DJ plays the house set) and trained (the trained set's family,
//   block and length, or null), so a page can show which DJ is playing (the A/B switch on #/gridlearn).
// - Lane DJVISUAL added what THE DJ VISUALISER draws: setBar (the bar of the set, 0 at its first), trained.view (the
//   whole trained set seen at once, dj-view.js, the SAME frozen object bar after bar, so a reader compares by identity
//   to see a new set), trained.seed, trained.groove (the bar's settled steps as levels), trained.notes (stage 3's
//   notes of the bar, or null), layers (the mix machine's eleven yes or no: what the old DJ plays now) and music (the
//   bar's chord, root and mode, and the composed tune's notes, at most 48). Lane PIECESPLAY added music.piece: the
//   stage 3 piece playing (id, name, key, minor, the chord of the bar by name), or null.
// - Plain data only: keys and numbers, no theme objects or audio nodes, so a reader can store or send it as is.
// - The last symphony to emit wins. The site mounts one hero symphony at a time.
// </claudes_code_comments>

export const DJ_IDLE = Object.freeze({
  live: false,
  playing: false,
  audible: false,
  theme: null,
  themeLabel: null,
  djMode: null,
  tune: null,
  tuneGenerated: false,
  beat: null,
  carrier: null,
  house: false,
  chain: [],
  bpm: null,
  bar: 0,
  pure: false,
  tag: null,
  set: 0,
  adjusted: false,
  section: null,
  parts: null,
  opener: null,
  fx: null,
  melody: null,
  brain: null,
  trained: null,
  setBar: null,
  layers: null,
  music: null,
});

import { grooveView, tuneView } from './dj-view.js';

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);

function colourOf(c) {
  if (!c || typeof c !== 'object') return { drive: null, vocoder: null };
  const d = c.drive && typeof c.drive === 'object' ? { slot: typeof c.drive.slot === 'string' ? c.drive.slot : null, amount: num(c.drive.amount), present: !!c.drive.present } : null;
  const v = c.vocoder && typeof c.vocoder === 'object' ? { slot: typeof c.vocoder.slot === 'string' ? c.vocoder.slot : null, warble: !!c.vocoder.warble, present: !!c.vocoder.present } : null;
  return { drive: d, vocoder: v };
}

function fxOf(fx) {
  if (!fx || typeof fx !== 'object') return null;
  const values = {};
  for (const [k, v] of Object.entries(fx.values ?? {})) values[k] = typeof v === 'string' ? v : num(v);
  const f = fx.flavour ?? {};
  return {
    mood: fx.mood ?? null,
    moodLabel: fx.moodLabel ?? null,
    overdo: fx.overdo ?? null,
    overdoLabel: fx.overdoLabel ?? null,
    // lane SOUNDSHAKE: THE WEATHER the DJ dealt this phrase (weather.js), and whether it is played hard (an overdo)
    weather: fx.weather ?? null,
    weatherLabel: fx.weatherLabel ?? null,
    weatherHard: !!fx.weatherHard,
    held: !!fx.held,
    steered: !!fx.steered,
    // lane DJOVERDRIVE: OVERDRIVE heard on the bus (the mood), the mood the deck dealt under it, and THE DJ's colour on
    // one voice: { drive: { slot, amount, present }, vocoder: { slot, warble, present } }, each null when none, and
    // the words for the parts sounding now
    overdrive: !!fx.overdrive,
    baseMood: fx.baseMood ?? null,
    colour: colourOf(fx.colour),
    colourLabel: typeof fx.colourLabel === 'string' && fx.colourLabel ? fx.colourLabel : null,
    flavour: { drive: f.drive ?? null, band: f.band ?? null, q: f.q ?? null },
    values,
  };
}

function trainedOf(t) {
  return {
    family: t.family ?? null,
    block: num(t.block),
    blocks: num(t.blocks),
    seed: num(t.seed),
    view: t.view && typeof t.view === 'object' ? t.view : null,
    groove: grooveView(t.groove),
    notes: t.notes && typeof t.notes === 'object' ? JSON.parse(JSON.stringify(t.notes)) : null,
  };
}

function musicOf(m) {
  if (!m || typeof m !== 'object') return null;
  const tune = m.tune && typeof m.tune === 'object' ? m.tune : null;
  return {
    root: num(m.root),
    mode: typeof m.mode === 'string' ? m.mode : null,
    chord: Array.isArray(m.chord) ? m.chord.map(num) : null,
    tune: tune ? { label: tune.label ?? null, motif: Array.isArray(tune.motif) ? tune.motif.map(num) : [], notes: tuneView(tune.notes), bar: num(tune.bar) } : null,
    // lane PIECESPLAY: the stage 3 piece playing, if one (its own lead is trained.notes.lead)
    piece: m.piece && typeof m.piece === 'object' ? { id: m.piece.id ?? null, name: m.piece.name ?? null, keyName: m.piece.keyName ?? null, minor: !!m.piece.minor, chord: m.piece.chord ?? null } : null,
  };
}

export function djSnapshot(s) {
  if (!s || typeof s !== 'object') return DJ_IDLE;
  const tune = s.tune && typeof s.tune === 'object' ? s.tune : null;
  const house = s.house && typeof s.house === 'object' ? s.house : {};
  return {
    live: true,
    playing: !!s.playing,
    audible: !!s.audible,
    theme: s.theme?.key ?? null,
    themeLabel: s.theme?.label ?? null,
    djMode: s.decision?.mode ?? null,
    tune: tune ? (tune.generated ? null : tune.title ?? null) : null,
    tuneGenerated: !!tune?.generated,
    beat: num(s.beat),
    carrier: num(s.carrier),
    house: !!house.on,
    chain: house.on && Array.isArray(house.keys) ? house.keys.slice() : [],
    bpm: num(s.bpm),
    bar: num(s.decision?.bar) ?? 0,
    // lane SETTLEDJ: the McKusker flute flag, the full-situation tag (a vote is stored against it), the set count and
    // whether the visitor adjusted this set (lane LOOPLAYERS reads both), the house section, and the parts in words
    pure: !!s.pure,
    tag: typeof s.tag === 'string' ? s.tag : null,
    set: num(s.set) ?? 0,
    adjusted: !!s.adjusted,
    section: s.mix?.section ?? null,
    parts: s.parts && typeof s.parts === 'object' ? JSON.parse(JSON.stringify(s.parts)) : null,
    // lane OPENINGSET: THE OPENING BLEND while it holds the first set (phase, second, length, slot, tag), else null
    opener: s.opener && typeof s.opener === 'object' ? { on: !!s.opener.on, phase: s.opener.phase ?? null, at: num(s.opener.at), length: num(s.opener.length), handover: num(s.opener.handover), slot: s.opener.slot ?? null, slotLabel: s.opener.slotLabel ?? null, tag: s.opener.tag ?? null } : null,
    // lane DJFX: THE DJ'S DESK - the mood, the overdo playing now (null when none), the settle's flavour and every
    // effect value the bus is set to, so a reader (the tags row) can name and show them
    fx: fxOf(s.fx),
    // lane McKUSKER: 432 Hz McKUSKER MODE - the flute playing the melody now (present), which flute, and its mute
    melody: s.melody && typeof s.melody === 'object' ? { voice: typeof s.melody.voice === 'string' ? s.melody.voice : null, present: !!s.melody.present, muted: !!s.melody.muted } : null,
    // lane DJWIRE: which DJ plays the house set, and the trained set's family, block and length
    brain: s.mix?.brain ?? null,
    trained: s.mix?.trained ? trainedOf(s.mix.trained) : null,
    // lane DJVISUAL: the bar of the set, what the mix plays now (the old DJ's strip), the music of the bar
    setBar: num(s.mix?.setBar),
    layers: s.mix?.yes && typeof s.mix.yes === 'object' ? Object.fromEntries(Object.entries(s.mix.yes).map(([k, v]) => [k, !!v])) : null,
    music: musicOf(s.mix?.music),
  };
}

function store(init) {
  let st = init;
  const subs = new Set();
  return {
    get: () => st,
    set(next) {
      st = next;
      for (const f of subs) f(st);
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

export const djLive = store(DJ_IDLE);
