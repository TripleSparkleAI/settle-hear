// settle-hear · bases/base-dj - THE DJ HOOK: how the house DJ's brain (mix-dj.js, lane SETTLEDJ) chooses bases and
// slices from the library by settling over their features, and lays the melody over them. This is the adapter:
// it reads one bar's decision (section, energy, drum family, root, mode, tempo, the eleven layer bits) and
// answers with a BASE PLAN for the phrase: which base gives the drums, which the bass, which the chords, and the
// slice of each. It is pure, so the brain can call it with no audio, and the player (base-play.js) plays the plan.
//
// <claudes_code_comments>
// ** Function List **
// SECTION_WANT               - what each section asks of the library (energy, density, the parts in)
// wantFromDecision(d, opts)  - a mix-dj decision -> the wanted features: { kind, family, bpm, energy, density,
//                              syncopation, swing, key, parts, bars }
// createBaseDJ(lib, opts)    - the hook: .plan(d) -> the bar's base plan { drums, bass, chords, texture, melody,
//                              changed, why }; .state; .usePlanner(fn) (a replay)
// planFromWant(lib, want, r, state) - the settle: pickBases for the drums (kick, snare, hats, perc from one base,
//                              the groove stays whole), the bass and the chords (each may come from another base
//                              compatible with the drums' base), returns slices and the compatibility verdicts
// melodyPlan(base, tune, d)  - the collected tune (placeTune output) laid over the drum base with the filters
//
// ** Technical Review **
// - THE CONTRACT with SETTLEDJ (posted in SETTLE_CHANNEL.md): the brain calls hook.plan(decision) once a bar; on
//   a 4-bar line (decision.plan.lines[4]) or a section change the hook may settle new bases, otherwise it holds
//   the phrase (the same holding rule the mix machine follows). The plan names slices by base id, part and bar
//   range; mix-layers.js can then call playBaseBar for the drums in place of DRUM_PATTERNS when a plan is present,
//   and the bass and chords likewise. Until SETTLEDJ lands, the adapter stands alone and the tests drive it with a
//   decision-shaped object.
// - THE GROOVE STAYS WHOLE: the four drum parts always come from ONE base, because a kick from one groove and
//   hats from another is two grooves. The bass and the chords may come from other bases, each checked by the
//   compatibility rule against the drums' base (meter, tempo overlap, key or a transposition).
// - THE SETTLE: pickBases(want) in base-library.js, with the habit cost against the last base so a phrase does not
//   repeat its predecessor back to back, and a hold inside the phrase.
// - WHAT IS WANTED: the section sets the energy and density targets (SECTION_WANT), the brain's drumFamily names
//   the family, its root and mode the key, the bpm the tempo; the layer bits (mix.yes) say which parts are
//   wanted at all: no bass base is picked when the bass is out.
// - THE MELODY: a collected tune (tunes.js placeTune, in the theme's key) is quantised onto the drum base's grid,
//   gated to the hats and ducked under the kick (base-play.js melodyOverBase); the cutoff follows the energy.
// </claudes_code_comments>

import { deckRng } from '../deck.js';
import { slice, combine } from './base-slice.js';
import { compatible, DRUM_PARTS } from './base-format.js';
import { rowAsBase } from './base-library.js';
import { melodyOverBase } from './base-play.js';

export const SECTION_WANT = {
  intro: { energy: 0.3, density: 0.8, parts: ['kick', 'hats'] },
  build: { energy: 0.55, density: 1.2, parts: ['kick', 'snare', 'hats'] },
  peak: { energy: 0.8, density: 1.6, parts: ['kick', 'snare', 'hats', 'perc'] },
  breakdown: { energy: 0.2, density: 0.4, parts: [] },
  outro: { energy: 0.35, density: 0.8, parts: ['kick', 'hats'] },
  hum: { energy: 0.05, density: 0.1, parts: [] },
};

const MINOR = new Set(['aeolian', 'dorian', 'phrygian', 'locrian', 'minor', 'minor pentatonic']);

export function wantFromDecision(d, { bars = 4 } = {}) {
  const section = d?.section ?? 'intro';
  const S = SECTION_WANT[section] ?? SECTION_WANT.intro;
  const yes = d?.mix?.yes ?? {};
  const house = section !== 'hum' && section !== 'breakdown';
  const parts = [];
  if (yes.drums !== false && house) parts.push(...S.parts);
  const root = Number.isFinite(d?.root) ? ((d.root % 12) + 12) % 12 : null;
  const mode = d?.mode ?? 'aeolian';
  return {
    kind: house ? 'house' : 'ambient',
    family: d?.drumFamily ?? null,
    bpm: Number.isFinite(d?.bpm) ? d.bpm : null,
    energy: Number.isFinite(d?.energy) ? 0.5 * d.energy + 0.5 * S.energy : S.energy,
    density: S.density,
    key: root == null ? null : { pc: root, mode: MINOR.has(mode) ? 'aeolian' : 'ionian' },
    parts,
    bars,
    wantBass: !!yes.bass,
    wantChords: !!(yes.pad || yes.arps),
    wantTexture: !!yes.texture,
  };
}

export function planFromWant(lib, want, r, state = {}) {
  const avoid = state.last ? [state.last.drums?.id, state.last.bass?.id, state.last.chords?.id].filter(Boolean) : [];
  const out = { drums: null, bass: null, chords: null, texture: null, compat: [], why: {} };
  const drumsWant = { ...want, parts: want.parts.length ? want.parts : want.kind === 'house' ? ['kick'] : [] };
  const [drumsPick] = lib.pickBases(drumsWant, { n: 1, avoid, random: r });
  if (!drumsPick) return out;
  out.drums = { id: drumsPick.id, row: drumsPick.row, parts: DRUM_PARTS.filter((p) => drumsPick.row.parts.includes(p)), G: drumsPick.G, p: drumsPick.p, parts_why: drumsPick.parts };
  out.why.drums = drumsPick.parts;
  const anchor = rowAsBase(drumsPick.row);
  const pitchedWant = (part) => ({ kind: want.kind, family: want.family, bpm: want.bpm ?? anchor.bpm, energy: want.energy, key: want.key ?? anchor.key, parts: [part], bars: want.bars });
  if (want.wantBass) {
    // the drums' own base first when it carries a bass; else the nearest compatible one
    if (anchor.parts.includes('bass')) out.bass = { id: anchor.id, row: anchor, parts: ['bass'], G: 0, p: 1, same: true };
    else {
      const picks = lib.pickBases(pitchedWant('bass'), { n: 3, avoid, random: r });
      for (const pk of picks) {
        const c = compatible(anchor, rowAsBase(pk.row));
        out.compat.push({ part: 'bass', id: pk.id, ...c });
        if (c.ok) { out.bass = { id: pk.id, row: pk.row, parts: ['bass'], G: pk.G, p: pk.p, transpose: c.transpose, parts_why: pk.parts }; break; }
      }
    }
  }
  if (want.wantChords) {
    if (anchor.parts.includes('chords')) out.chords = { id: anchor.id, row: anchor, parts: ['chords'], G: 0, p: 1, same: true };
    else {
      const picks = lib.pickBases(pitchedWant('chords'), { n: 3, avoid, random: r });
      for (const pk of picks) {
        const c = compatible(anchor, rowAsBase(pk.row));
        out.compat.push({ part: 'chords', id: pk.id, ...c });
        if (c.ok) { out.chords = { id: pk.id, row: pk.row, parts: ['chords'], G: pk.G, p: pk.p, transpose: c.transpose, parts_why: pk.parts }; break; }
      }
    }
  }
  if (want.wantTexture) {
    const picks = lib.pickBases({ kind: 'ambient', parts: ['texture'], key: want.key ?? anchor.key, energy: 0.1 }, { n: 2, avoid, random: r });
    for (const pk of picks) {
      const c = compatible(anchor, rowAsBase(pk.row), { tempoTolerance: 10 });
      if (c.ok || c.reasons.every((x) => x.startsWith('tempo'))) { out.texture = { id: pk.id, row: pk.row, parts: ['texture'], G: pk.G, p: pk.p, transpose: c.transpose }; break; }
    }
  }
  return out;
}

export function melodyPlan(base, notes, d, opts = {}) {
  if (!base || !notes?.length) return null;
  const e = Number.isFinite(d?.energy) ? d.energy : 0.6;
  const gate = d?.section === 'peak' || d?.section === 'build' ? 'hats' : null;
  return melodyOverBase(base, notes, { gate, duck: 0.4, energy: e, ...opts });
}

export function createBaseDJ(lib, { seed = 1, phraseBars = 4 } = {}) {
  const r = deckRng(((Number(seed) >>> 0) ^ 0x1b873593) >>> 0 || 1);
  let last = null;
  let bar = 0;
  let lastPlan = null;
  let lastSection = null;
  const hook = {
    get state() { return { bar, last: lastPlan, section: lastSection }; },
    // d: a mix-dj.js decision (section, energy, drumFamily, root, mode, bpm, mix.yes, plan.lines); returns the
    // phrase's base plan, settled afresh on a 4-bar line or a section change, held otherwise
    plan(d = {}, { force = false } = {}) {
      bar += 1;
      const onLine = d?.plan?.lines?.[phraseBars] ?? ((bar - 1) % phraseBars === 0);
      const changed = d?.section !== lastSection;
      if (lastPlan && !onLine && !changed && !force) return { ...lastPlan, held: true, bar };
      const want = wantFromDecision(d, { bars: phraseBars });
      const P = planFromWant(lib, want, r, { last });
      const sliceOf = (pick, parts) => (pick ? { id: pick.id, parts, bars: [0, Math.min(pick.row.bars, phraseBars * Math.max(1, Math.ceil(pick.row.bars / phraseBars)))], transpose: pick.transpose ?? 0 } : null);
      const plan = {
        bar,
        section: d?.section ?? 'intro',
        want,
        drums: sliceOf(P.drums, P.drums?.parts ?? []),
        bass: sliceOf(P.bass, ['bass']),
        chords: sliceOf(P.chords, ['chords']),
        texture: sliceOf(P.texture, ['texture']),
        compat: P.compat,
        why: P.why,
        held: false,
        changed,
      };
      last = P;
      lastPlan = plan;
      lastSection = d?.section ?? 'intro';
      return plan;
    },
    // the plan made playable: the slices loaded and combined into one base (async, the loader reads the files)
    async realise(plan) {
      if (!plan?.drums) return null;
      const slices = [];
      for (const k of ['drums', 'bass', 'chords', 'texture']) {
        const s = plan[k];
        if (!s) continue;
        const base = await lib.load(s.id);
        const sl = slice(base, { parts: s.parts, bars: s.bars });
        // a texture is a held drone from an ambient bed: it takes the groove's tempo and meter, having none of its own
        if (k === 'texture' && slices[0]) { sl.tempo = { ...slices[0].tempo }; sl.meter = { ...slices[0].meter }; }
        slices.push(sl);
      }
      const c = combine(slices, { id: `combined-${plan.bar}` });
      return c.ok ? c.base : null;
    },
    melody(base, notes, d, opts) { return melodyPlan(base, notes, d, opts); },
  };
  return hook;
}
