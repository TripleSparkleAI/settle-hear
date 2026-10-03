// settle-hear · mix-dj - THE HOUSE DJ'S BRAIN: one bar at a time it asks the planner where the set is going, settles
// the mix machine, composes a new tune when a set or a build begins, lets the old tune surface in the breakdown,
// moves the effect rack's amounts, picks the warm-down's pulse rate, and keeps the influence window. Pure: no audio.
// mix-layers.js (createMixSet) plays what it decides.
//
// <claudes_code_comments>
// ** Function List **
// THEME_DRUMS / THEME_BASS / CHAIN_FAMILIES - each theme's drum families and bass style; the pass families a chain
//                              may hold (the voices are layers here, so no voice pass sits in the chain)
// SECTION_AMOUNT             - each section's chain amount and hall wash (a peak pushes the chain, a breakdown opens
//                              the hall)
// humChoice(r, ctx)          - the warm-down's pulse rate and variant: a deep warm-down after a peak leans delta or
//                              theta, a calm one alpha or Schumann; a set with an earlier motif plays it slowed
// composeFrom(ids, theme, seed, window, decay, pool) - the composer as a tag names it (sources in deal order)
// createHouseDJ(opts)        - the brain: .bar(input) -> the bar's house decision; .influence (the window);
//                              .tune; .state; .noteVote(stars); .load(decoded, rebuilt) (a replay); with opts.bases
//                              (a base library, bases/base-library.js) the decision carries `bases`: the phrase's
//                              base plan from the hook (bases/base-dj.js), the realised base once loaded, and the bar
//                              inside it (lane HOUSEBASES)
//
// ** Technical Review **
// - THE VOICE CHAINS (lane MELODYFX): a new set also settles the voice palette (voice-fx.js createVoiceDealer): the
//   lead, the arps, the answer and the chop each get an instrument and a chain of three to five effects. The
//   decision carries it as `voices`, with `leadCentre` (the lead's median pitch) so the layers can move the tune to
//   the instrument's register. A replay takes the tag's palette.
// - EACH BAR: the planner (mix-planner.js) gives the section and its moves; the mix machine (mix-machine.js) settles
//   the eleven layers and effects; the chain amounts glide toward the section's targets over the bar (a build's
//   chain rises bar by bar, a filter opens across a build); the lead takes the next bar of the tune.
// - THE TUNES: a NEW SET or a build after a breakdown composes a new tune (tune-composer.js) from one or two of the
//   theme's collected tunes, dealt like a deck (createTuneDealer), with a fresh seed from the DJ's stream and the
//   influence window. In a BREAKDOWN the old tune itself surfaces: a phrase of a source tune, note for note, on the
//   flute, labelled with its title. The cursor goes back to the top of the tune at every section change, so a
//   phrase starts on a section line.
// - THE INFLUENCE: when a set ends (the hum gives way to a new intro) the brain records the set's key, its tune's
//   opening motif, theme, mean energy and the effects that sounded (dj-influence.js), and the window feeds the next
//   composer, the planner's arc and the hum.
// - Deterministic for a seed: every random choice comes from one deckRng stream.
// </claudes_code_comments>

import { deckRng, createBag } from './deck.js';
import { themeOf } from './themes.js';
import { TUNES, playableTunes, tunesFor, createTuneDealer, placeTune } from './tunes.js';
import { composeTune, composeMode } from './tune-composer.js';
import { createPlanner } from './mix-planner.js';
import { createMixMachine } from './mix-machine.js';
import { createInfluenceWindow } from './dj-influence.js';
import { PASSES, progression } from './house.js';
import { noteMidi, MODES } from './tuning.js';
import { createBaseDJ } from './bases/base-dj.js';
import { createVoiceDealer, HOUSE_SLOTS } from './voice-fx.js';

export const THEME_DRUMS = {
  crystals: ['ambient', 'balearic'],
  highlands: ['chicago', 'deep', 'progressive'],
  deepsea: ['dub-techno', 'deep'],
  cathedral: ['deep', 'ambient'],
  embers: ['tech', 'acid', 'garage', 'filter-house'],
};
export const THEME_BASS = { crystals: 'sub', highlands: 'rolling', deepsea: 'sub', cathedral: 'organ', embers: 'acid' };
export const CHAIN_FAMILIES = ['filter', 'time', 'space', 'mod', 'grit', 'rhythm'];
const NO_CHAIN = new Set(['pump', 'trance-gate']);
const CHAIN_PASSES = PASSES.filter((p) => CHAIN_FAMILIES.includes(p.family) && !NO_CHAIN.has(p.key)).map((p) => p.key);

export const SECTION_AMOUNT = {
  intro: { chain: 0.35, hall: 0.35 },
  build: { chain: 0.6, hall: 0.25 },
  peak: { chain: 0.85, hall: 0.2 },
  breakdown: { chain: 0.4, hall: 0.85 },
  outro: { chain: 0.4, hall: 0.5 },
  hum: { chain: 0.15, hall: 0.6 },
};
const HUM_DEEP = ['delta', 'theta'];
const HUM_CALM = ['alpha', 'schumann'];

export function humChoice(r, { after = 'peak', energy = 0.5, motif = null } = {}) {
  const deep = after === 'peak' || energy > 0.6;
  const rates = deep ? HUM_DEEP : HUM_CALM;
  const rate = rates[Math.floor(r() * rates.length) % rates.length];
  const variants = motif && motif.length ? ['motif', 'motif', 'pulse', 'pair'] : ['pulse', 'breath', 'rain', 'pair'];
  const variant = variants[Math.floor(r() * variants.length) % variants.length];
  return { rate, variant, deep };
}

const clamp01 = (x) => Math.min(1, Math.max(0, Number(x) || 0));

// the composer as the tag names it: the source tunes IN DEAL ORDER (the order changes the phrase skeleton), the
// theme, the seed and the influence window. Used live by the brain and again by playTag, so both make one tune.
export function composeFrom(ids, theme, seed, window = [], decay = 0.6, pool = playableTunes()) {
  const picks = ids.map((id) => pool.find((t) => t.id === id)).filter(Boolean);
  if (!picks.length) return null;
  return composeTune({ sources: picks, theme, seed, influence: { window, decay } });
}

export function createHouseDJ({ seed = 1, theme = 'highlands', tunes = TUNES, influence = null, storage = null, bases = null } = {}) {
  const r = deckRng(((Number(seed) >>> 0) ^ 0x3c6ef372) >>> 0 || 1);
  // THE BASES (lane HOUSEBASES): when a library is given, the hook settles a base plan per phrase and the layers play it
  const baseHook = bases ? createBaseDJ(bases, { seed: ((Number(seed) >>> 0) ^ 0x27d4eb2f) >>> 0 || 1 }) : null;
  let basePlan = null;
  let baseRealised = null;
  let basePlanBar = 0;
  let baseError = null; // why the last plan did not realise, for the panel (null while it loads or once it has)
  const planner = createPlanner({ seed: ((Number(seed) >>> 0) ^ 0x1b873593) >>> 0 || 1 });
  const machine = createMixMachine({ seed });
  const pool = playableTunes(tunes);
  const dealer = createTuneDealer({ random: r });
  const window = createInfluenceWindow({ storage, initial: influence });
  const passDeck = createBag(CHAIN_PASSES, { random: r });
  // THE VOICE CHAINS (lane MELODYFX, voice-fx.js): each set settles every melodic part's instrument and chain, from
  // its own stream so the brain's other choices stay as they were for a seed
  const voiceDealer = createVoiceDealer({ seed: ((Number(seed) >>> 0) ^ 0x6a09e667) >>> 0 || 1 });
  let voices = null;
  let T = themeOf(theme);
  let tune = null; // { kind, notes, label, sources, seed, composed, pos, offset, barNo }
  let surfacing = null;
  let chain = [];
  let drumFamily = THEME_DRUMS[T.key][0];
  let bassStyle = THEME_BASS[T.key];
  let texture = 'wind';
  let hum = { rate: 'alpha', variant: 'pulse' };
  let lastSection = null;
  let setEnergy = [];
  let barNo = 0;
  let prevSection = 'intro';
  let vote = null; // the visitor's rating of the current set, carried into its influence record
  let replayHold = 0; // bars a replay keeps the tag's layers clamped

  const rootMidi = () => { const m = noteMidi(T.root); return Number.isFinite(m) ? m : 57; };

  function dealChain() {
    const out = [];
    let guard = 0;
    while (out.length < 3 && guard++ < 20) { const k = passDeck.next(); if (!out.includes(k)) out.push(k); }
    // the hall and the sidechain are always in the rack: the mix machine's wash and the drums' pump
    return [...out.map((key) => ({ key, amount: 0.4 })), { key: 'hall', amount: 0.3 }, { key: 'sidechain', amount: 0.5 }];
  }

  function compose(reason) {
    const list = tunesFor(T, pool);
    const a = dealer.next(T, pool);
    const picks = [a];
    if (list.length > 1 && r() < 0.75) { let b = dealer.next(T, pool); if (b?.id === a?.id) b = dealer.next(T, pool); if (b && b.id !== a.id) picks.push(b); }
    const s = Math.floor(r() * 4294967296) >>> 0 || 1;
    const input = picks.filter(Boolean).map((p) => p.id);
    const t = composeFrom(input, T, s, window.list, window.decay, pool);
    if (!t) return null;
    return { kind: 'composed', notes: t.notes, label: t.label, sources: t.sources, input, seed: s, composed: t, pos: 0, offset: 0, barNo: 0, reason };
  }

  function surface() {
    // a phrase of a source tune, note for note: the old tune surfacing in the breakdown
    const src = tune?.sources?.[0];
    const pick = pool.find((x) => x.id === src?.id) ?? dealer.next(T, pool);
    if (!pick) return null;
    const placed = placeTune(pick.parsed, rootMidi());
    const notes = placed.notes.slice(0, 16);
    return { kind: 'collected', notes, label: pick.title, sources: [{ id: pick.id, title: pick.title, source: pick.source ?? null }], input: [pick.id], seed: 0, pos: 0, offset: 0, barNo: 0 };
  }

  // the next `beats` beats of a tune, from its cursor; a finished tune starts again (a house loop of the new tune)
  function take(t, beats) {
    const out = [];
    if (!t || !t.notes.length) return out;
    let at = 0;
    let guard = 0;
    while (at < beats - 1e-6 && guard++ < 256) {
      if (t.pos >= t.notes.length) { t.pos = 0; t.offset = 0; }
      const n = t.notes[t.pos];
      const take = Math.min(n.beats - t.offset, beats - at);
      if (t.offset === 0) out.push({ midi: n.midi, at, beats: n.beats });
      at += take;
      t.offset += take;
      if (t.offset >= n.beats - 1e-6) { t.pos += 1; t.offset = 0; }
    }
    t.barNo += 1;
    return out;
  }

  const brain = {
    get influence() { return window; },
    get tune() { return tune; },
    get state() { return { theme: T.key, planner: planner.state, mix: machine.state, chain: chain.slice(), drumFamily, bassStyle, texture, hum, voices }; },
    get voices() { return voices; },
    setTheme(key) { T = themeOf(key); },
    // a rating of the current set: it rides into the set's influence record when the set ends
    noteVote(stars) { if (Number.isInteger(stars) && stars >= 1 && stars <= 5) vote = stars; },
    // a REPLAY (dj-replay.js): load a decoded tag. The theme, the tune at its bar, the chain, the drums, the bass, the
    // texture, the hum and the influence window come from the tag; the planner jumps to its section and bar; the
    // mix machine holds the tag's layers for the next 8 bars, then settles freely again.
    load(d, rebuilt) {
      T = themeOf(d.theme);
      planner.force({ section: d.section, setBar: d.setBar, set: d.set, keyLift: d.keyLift });
      window.clear();
      for (const rec of [...d.influence.window].reverse()) window.push(rec);
      if (rebuilt?.tune && d.tune.kind === 'collected') {
        // the old tune surfacing in a breakdown: the lead is a collected phrase; the composed tune is the DJ's own
        surfacing = { kind: 'collected', notes: rebuilt.tune.notes, label: rebuilt.tune.label, sources: rebuilt.tune.sources, input: rebuilt.tune.sources.map((x) => x.id), seed: 0, pos: 0, offset: 0, barNo: 0 };
        for (let b = 0; b < d.tune.bar; b++) take(surfacing, 4);
      } else if (rebuilt?.tune) {
        const t = rebuilt.tune;
        surfacing = null;
        tune = { kind: d.tune.kind, notes: t.notes, label: t.label, sources: t.sources, input: d.tune.sources.map((x) => x.id).filter(Boolean), seed: d.tune.seed, composed: t, pos: 0, offset: 0, barNo: 0 };
        for (let b = 0; b < d.tune.bar; b++) take(tune, 4);
      }
      chain = d.chain.filter((c) => c.key).map((c) => ({ ...c }));
      drumFamily = d.drumFamily;
      bassStyle = d.bassStyle;
      texture = d.texture;
      hum = { ...d.hum };
      // the voice chains as the tag stored them (dj-replay.js realises them, or derives them from the tune seed)
      if (rebuilt?.voices) { voices = rebuilt.voices; voiceDealer.remember(voices); }
      prevSection = d.section;
      for (const [k, v] of Object.entries(d.layers)) machine.clamp(k, v);
      replayHold = 8;
    },
    // input: { theme, mood, steer: { leans (the DJ's six), mix: { energy, drums, bass, pad, fx } }, holds, votes }
    bar(input = {}) {
      if (input.theme && input.theme !== T.key) T = themeOf(input.theme);
      const leans = input.steer?.leans ?? {};
      const mixSteer = { ...(input.steer?.mix ?? {}), flute: leans.flute ?? 0, drone: leans.drone ?? 0, split: leans.split ?? 0, static: leans.static ?? 0 };
      const blend = window.blend();
      const P = planner.bar({ theme: T.key, mood: input.mood, steer: { static: leans.static ?? 0, theme: leans.theme ?? 0, energy: mixSteer.energy ?? 0 }, votes: input.votes, influence: blend });
      let newTune = false;
      if (P.newSet || !tune) {
        if (tune && setEnergy.length) {
          // the set that ended leaves its influence
          window.push({ vote, keyPc: tune.composed?.key?.pc ?? rootMidi() % 12, mode: tune.composed?.key?.mode7 ?? composeMode(T.mode).name, motif: tune.composed?.motif ?? [], theme: T.key, energy: setEnergy.reduce((a, b) => a + b, 0) / setEnergy.length, fx: chain.map((c) => c.key).slice(0, 3) });
        }
        setEnergy = [];
        vote = null;
        drumFamily = (THEME_DRUMS[T.key] ?? THEME_DRUMS.highlands)[Math.floor(r() * (THEME_DRUMS[T.key] ?? THEME_DRUMS.highlands).length)];
        bassStyle = THEME_BASS[T.key] ?? 'sub';
        texture = ['wind', 'water', 'birds'][Math.floor(r() * 3)];
        chain = dealChain();
        voices = voiceDealer.palette({ theme: T.key, slots: HOUSE_SLOTS });
        tune = compose('a new set');
        newTune = true;
      } else if (P.changed && P.section === 'build' && prevSection === 'breakdown') {
        tune = compose('a build after the breakdown') ?? tune;
        newTune = true;
      }
      if (P.changed && P.section === 'breakdown') surfacing = surface();
      if (P.changed && P.section !== 'breakdown') surfacing = null;
      if (P.changed && P.section === 'hum') hum = humChoice(r, { after: prevSection, energy: blend?.energy ?? 0.5, motif: tune?.composed?.motif });
      if (P.changed && tune) { tune.pos = 0; tune.offset = 0; tune.barNo = 0; }
      if (P.changed && P.section === 'peak' && prevSection === 'breakdown') {
        // a roll at the second peak: the oldest pass gives way to a new one; the hall and the sidechain stay
        const keep = chain.slice(1);
        let k = passDeck.next(); let guard = 0;
        while (keep.some((c) => c.key === k) && guard++ < 10) k = passDeck.next();
        chain = [{ key: k, amount: 0.4 }, ...keep];
      }
      if (replayHold > 0) { replayHold -= 1; if (replayHold === 0) for (const k of Object.keys(machine.clamps)) machine.clamp(k, null); }
      const M = machine.bar({ section: P.section, changed: P.changed, onLine: P.lines[4], mood: input.mood, theme: T.key, steer: mixSteer, votes: input.votes, holds: input.holds });
      // the chain amounts glide toward the section's targets, the mix's chain bit pushing or holding them back
      const A = SECTION_AMOUNT[P.section] ?? SECTION_AMOUNT.intro;
      const progress = P.section === 'build' ? Math.min(1, (P.barsIn + 1) / 8) : 1;
      chain = chain.map((c) => {
        let target;
        if (c.key === 'hall') target = M.yes.wash ? Math.max(A.hall, 0.75) : A.hall * 0.6;
        else if (c.key === 'sidechain') target = M.yes.drums ? 0.4 + 0.5 * M.energy : 0;
        else target = (M.yes.chain ? A.chain : A.chain * 0.4) * (0.4 + 0.6 * progress);
        return { key: c.key, amount: clamp01(target) };
      });
      const meter = 4;
      const lift = P.keyLift ?? 0;
      let notes = [];
      let lead = null;
      if (surfacing && P.section === 'breakdown') { notes = take(surfacing, meter); lead = surfacing; }
      else if (tune) { notes = take(tune, meter); lead = tune; }
      if (lift) notes = notes.map((n) => ({ ...n, midi: n.midi == null ? null : n.midi + lift }));
      const root = rootMidi() + lift;
      // THE BASES: the plan for the phrase (settled on a 4-bar line or a section change, held inside it); the base
      // itself loads beside the bar and plays from the bar after it arrives, the family pattern until then
      let bases = null;
      if (baseHook) {
        const bp = baseHook.plan({ section: P.section, energy: M.energy, drumFamily, root, mode: T.mode, bpm: input.bpm ?? null, mix: M, plan: P });
        if (!bp.held) {
          basePlan = bp;
          basePlanBar = barNo;
          baseRealised = null;
          baseError = null;
          Promise.resolve().then(() => baseHook.realise(bp)).then((b) => { if (basePlan === bp) { baseRealised = b; if (!b) baseError = 'the slices did not combine'; } }).catch((e) => { if (basePlan === bp) { baseRealised = null; baseError = String(e?.message ?? e); } });
        }
        bases = { plan: bp, realised: baseRealised, bar: barNo - basePlanBar, error: baseError };
      }
      const chord = progression(root, T.mode, barNo);
      if (!voices) voices = voiceDealer.palette({ theme: T.key, slots: HOUSE_SLOTS });
      // the lead's middle pitch (the median of its notes): the layers move it by whole octaves to the instrument
      const ln = (lead?.notes ?? []).map((n) => n.midi).filter((m) => m != null).sort((a, b) => a - b);
      const leadCentre = ln.length ? ln[Math.floor(ln.length / 2)] + lift : null;
      setEnergy.push(M.energy);
      barNo += 1;
      prevSection = P.section;
      lastSection = P.section;
      const steps = MODES[T.mode] ?? MODES.ionian;
      return {
        bar: barNo,
        plan: P,
        mix: M,
        section: P.section,
        newSet: P.newSet,
        newTune,
        moves: P.moves,
        chain: chain.map((c) => ({ ...c })),
        notes,
        lead: lead ? { kind: lead.kind, label: lead.label, sources: lead.sources, input: lead.input ?? [], seed: lead.seed, bar: Math.max(0, lead.barNo - 1), abc: lead.composed?.abc ?? null, keyName: lead.composed?.key?.name ?? null, keyPc: lead.composed?.key?.pc ?? (rootMidi() % 12) } : null,
        tune: tune ? { kind: tune.kind, label: tune.label, sources: tune.sources, input: tune.input ?? [], bar: tune.barNo, seed: tune.seed, abc: tune.composed?.abc ?? null, motif: tune.composed?.motif ?? [], copy: tune.composed?.copy ?? [] } : null,
        surfacing: surfacing ? { label: surfacing.label, sources: surfacing.sources } : null,
        root,
        mode: T.mode,
        scale: steps,
        chord,
        keyLift: lift,
        drumFamily,
        bassStyle,
        texture,
        hum,
        energy: M.energy,
        voices,
        leadCentre,
        bases,
        influence: { decay: window.decay, window: window.list, blend },
      };
    },
  };
  return brain;
}
