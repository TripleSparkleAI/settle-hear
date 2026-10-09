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
// createHumDealer(r)         - THE DECK RULE: .next(ctx) deals humChoice's rate and variant from decks
// humChoice(r, ctx)          - the warm-down's pulse rate and variant: a deep warm-down after a peak leans delta or
//                              theta, a calm one alpha or Schumann; a set with an earlier motif plays it slowed
// composeFrom(ids, theme, seed, window, decay, pool) - the composer as a tag names it (sources in deal order)
// SETTLE_CARD / PIECE_WAIT_BARS / PIECE_ONLY_FAMILIES - stage 3's pieces in the deck (lane PIECESPLAY): the card that
//                              settles a set live, the bars a dealt piece may keep the set before playing, and the
//                              families no theme deals live that join a theme's deck for their piece (eurodance)
// createHouseDJ(opts)        - the brain: .bar(input) -> the bar's house decision; .influence (the window);
//                              .tune; .state; .noteVote(stars); .load(decoded, rebuilt) (a replay); with opts.bases
//                              (a base library, bases/base-library.js) the decision carries `bases`: the phrase's
//                              base plan from the hook (bases/base-dj.js), the realised base once loaded, and the bar
//                              inside it (lane HOUSEBASES); with opts.trained (the trained models, dj-trained.js)
//                              every new set is composed from them (lane DJWIRE): .setTrained(models),
//                              .setBrain('trained' | 'old') (an A/B: a new set on the next bar), .brain, .trainedSet,
//                              .setPieces(list, { load }) (stage 3's pieces, whole or as cards fetched when dealt, in
//                              each family's deck beside one live-settle card: lane PIECESPLAY), .pieceCards,
//                              .pendingPiece;
//                              .nextSet() (lane DJSKIP: a new set on the next bar, the restart a brain switch makes)
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
// - THE TRAINED DJ (lane DJWIRE): with trained models and the brain set to 'trained', a NEW SET is settled whole from
//   the models (dj-trained.js settleTrainedSet: a genre family dealt from the theme's families by THE DECK RULE, a
//   seed from the DJ's stream) and played by the trained planner (dj-trained-plan.js) in place of mix-planner.js:
//   the sections, the drops and the moves sit where the trained set put them, the mix machine takes the set's
//   block-by-block layers as strong leans (mix-machine.js TRAINED_LEAN; the steering, the votes and the holds still
//   apply), and the decision carries `trained` (the bar's settled groove, the feel) for mix-layers.js to play. After
//   the set and its warm-down the next set is settled. Without models, or with the brain 'old', the old planner
//   plays exactly as before: THE FALLBACK. A switch of brain starts a new set on the next bar.
// - THE PIECES (lane PIECESPLAY, navigator 2026-10-06: "the piece's own lead, play minor as it is"): stage 3's ten
//   pieces join each family's deck beside one SETTLE card (THE DECK RULE). A dealt piece card is fetched then
//   (opts.loadPiece or setPieces' load); until it arrives the set before plays on, at most PIECE_WAIT_BARS bars, then a
//   live settle plays instead. At a set's warm-down the next deal is peeked and its piece prefetched, so a natural set
//   change finds it ready. While a piece plays, the decision's lead is the piece's own lead (kind 'piece'), the root,
//   mode and chord are the piece's (no shift, no key lift, a minor piece stays minor under any theme), the old tune
//   never surfaces, and `piece` names it (with the deal's clock on its first bar). A replay of a piece's tag fetches
//   the piece first and loads it on the bar it arrives.
// - Deterministic for a seed: every random choice comes from one deckRng stream (the trained set's seed is drawn
//   from it, and the trained planner has its own).
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
import { settleTrainedSet } from './dj-trained.js';
import { createTrainedPlanner, THEME_FAMILY, FAMILY_STYLE } from './dj-trained-plan.js';
import { pieceToSet, isPiece, pieceMode, pieceRoot, chordOfBar, leadOfBar } from './dj-trained-notes.js';
import { tuneHash } from './dj-tag.js';

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

// THE DECK RULE for the warm-downs (lane MATHSHAPES' cycle audit): a set plays many hums, so the rate and the variant
// are dealt like decks rather than drawn fresh each time, every choice once before any repeats. The motif variant
// keeps its double weight as two cards a round. humChoice above stays as the one-off pure helper.
export function createHumDealer(r) {
  const rates = { deep: createBag(HUM_DEEP, { random: r }), calm: createBag(HUM_CALM, { random: r }) };
  const variants = {
    motif: createBag(['motif', 'pulse', 'pair'], { random: r, weights: [2, 1, 1] }),
    plain: createBag(['pulse', 'breath', 'rain', 'pair'], { random: r }),
  };
  return {
    next({ after = 'peak', energy = 0.5, motif = null } = {}) {
      const deep = after === 'peak' || energy > 0.6;
      return { rate: (deep ? rates.deep : rates.calm).next(), variant: (motif && motif.length ? variants.motif : variants.plain).next(), deep };
    },
  };
}

const clamp01 = (x) => Math.min(1, Math.max(0, Number(x) || 0));

// the composer as the tag names it: the source tunes IN DEAL ORDER (the order changes the phrase skeleton), the
// theme, the seed and the influence window. Used live by the brain and again by playTag, so both make one tune.
export function composeFrom(ids, theme, seed, window = [], decay = 0.6, pool = playableTunes()) {
  const picks = ids.map((id) => pool.find((t) => t.id === id)).filter(Boolean);
  if (!picks.length) return null;
  return composeTune({ sources: picks, theme, seed, influence: { window, decay } });
}

// THE PIECES IN THE DECK (lane PIECESPLAY): a family's deck holds its pieces and one card that settles a set live
export const SETTLE_CARD = 'settle';
// a dealt piece still on its way: the set it replaces plays on, at most this many bars, then a live settle plays
export const PIECE_WAIT_BARS = 4;
// a family no theme deals live but stage 3 wrote a piece in: eurodance (Neon rush) joins highlands' family deck while
// its piece is in the deck, as a PIECE-ONLY family (its deck holds the piece and no settle card)
export const PIECE_ONLY_FAMILIES = Object.freeze({ highlands: ['eurodance'] });
const LIVE_FAMILIES = new Set(Object.values(THEME_FAMILY).flat());
const clockNow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

export function createHouseDJ({ seed = 1, theme = 'highlands', tunes = TUNES, influence = null, storage = null, bases = null, trained = null, brainMode = 'trained', notes = null, pieces = null, loadPiece = null, now = clockNow } = {}) {
  const r = deckRng(((Number(seed) >>> 0) ^ 0x3c6ef372) >>> 0 || 1);
  // THE BASES (lane HOUSEBASES): when a library is given, the hook settles a base plan per phrase and the layers play it
  const baseHook = bases ? createBaseDJ(bases, { seed: ((Number(seed) >>> 0) ^ 0x27d4eb2f) >>> 0 || 1 }) : null;
  let basePlan = null;
  let baseRealised = null;
  let basePlanBar = 0;
  let baseError = null; // why the last plan did not realise, for the panel (null while it loads or once it has)
  const planner = createPlanner({ seed: ((Number(seed) >>> 0) ^ 0x1b873593) >>> 0 || 1 });
  // THE TRAINED DJ (lane DJWIRE): the models (null until given), the brain wanted, the trained planner, the families
  // dealt per theme (THE DECK RULE), and whether the set now playing is a trained one
  let models = trained;
  let brainWant = brainMode === 'old' ? 'old' : 'trained';
  const tplanner = createTrainedPlanner({ seed: ((Number(seed) >>> 0) ^ 0x2545f491) >>> 0 || 1 });
  const familyDecks = {};
  // the theme's families, plus a piece-only family whose piece is in the deck (PIECE_ONLY_FAMILIES)
  const familiesOf = (key) => {
    const base = THEME_FAMILY[key] ?? THEME_FAMILY.highlands;
    const extra = (PIECE_ONLY_FAMILIES[key] ?? []).filter((f) => !base.includes(f) && cards.some((c) => c.family === f));
    return [...base, ...extra];
  };
  const familyDeckOf = (key) => {
    if (!familyDecks[key]) familyDecks[key] = createBag(familiesOf(key), { random: r });
    return familyDecks[key];
  };
  const familyOf = (key) => familyDeckOf(key).next();
  let curTrained = false;
  let restart = false;
  let setCount = 0;
  let trainedSet = null;
  let notesHook = notes;
  // STAGE 3 (lane DJNOTES' pieces, the seam in dj-trained-notes.js; played by lane PIECESPLAY): the pieces as CARDS,
  // each a whole piece or an index card whose piece is fetched when it is dealt (opts.loadPiece, dj-pieces.js). A
  // family's deck holds its cards and one SETTLE card (THE DECK RULE): a round plays each piece once and one set
  // settled live from the models once. A dealt card whose piece has not arrived waits in `pending`.
  let pieceDecks = {};
  let cards = [];
  let fetchPiece = typeof loadPiece === 'function' ? loadPiece : null;
  let pending = null; // { n, family, seed, card, theme, dealtAt, bars }
  let pendingLoad = null; // a replay's tag waiting for its piece: { d, rebuilt, card, waited }
  let pieceStart = null; // the first bar of a piece set: { id, name, dealtAt, loadedAt, waitBars, prefetched }
  const cardOf = (x) => {
    if (isPiece(x)) return { id: x.id ?? null, name: x.name ?? null, family: x.family ?? null, key: x.key ?? null, piece: x, loading: null, failed: false, loadedAt: null, prefetched: false };
    if (x && typeof x === 'object' && typeof x.id === 'string' && typeof x.family === 'string') return { id: x.id, name: x.name ?? null, family: x.family, key: x.key ?? null, piece: null, loading: null, failed: false, loadedAt: null, prefetched: false };
    return null;
  };
  const setPieceList = (list, load) => {
    cards = (list ?? []).map(cardOf).filter(Boolean);
    if (typeof load === 'function') fetchPiece = load;
    pieceDecks = {};
    for (const k of Object.keys(familyDecks)) delete familyDecks[k];
    // a deal that was waiting on the old list is dealt again from the new one on the next bar
    if (pending) { pending = null; restart = true; }
  };
  setPieceList(pieces);
  const pieceDeckOf = (family) => {
    const of = cards.filter((c) => c.family === family);
    if (!of.length) return null;
    if (!pieceDecks[family]) pieceDecks[family] = createBag(LIVE_FAMILIES.has(family) ? [...of, SETTLE_CARD] : of, { random: r });
    return pieceDecks[family];
  };
  const cardFor = (family) => { const c = pieceDeckOf(family)?.next() ?? SETTLE_CARD; return c === SETTLE_CARD ? null : c; };
  const fetchCard = (card) => {
    if (!card || card.piece || card.loading) return;
    if (!fetchPiece) { card.failed = true; return; }
    card.failed = false;
    card.loading = Promise.resolve().then(() => fetchPiece(card.id)).then((p) => {
      if (isPiece(p)) { card.piece = p; card.loadedAt = now(); } else card.failed = true;
      card.loading = null;
    }).catch(() => { card.failed = true; card.loading = null; });
  };
  const findCard = (PC) => cards.find((c) => c.id != null && (c.id === PC.id || tuneHash(c.id) === PC.hash)) ?? null;
  const machine = createMixMachine({ seed });
  const pool = playableTunes(tunes);
  const dealer = createTuneDealer({ random: r });
  const window = createInfluenceWindow({ storage, initial: influence });
  const passDeck = createBag(CHAIN_PASSES, { random: r });
  const humDealer = createHumDealer(r);
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

  // THE PLAN OF THIS BAR (lane DJWIRE): the trained planner while a trained set plays, else the old planner. A new
  // set begins when the trained set and its warm-down end, when the old planner opens one, or on a restart (the
  // models arrived, or the brain was switched). Its brain is chosen then: trained when wanted and the models are here.
  // A NEW TRAINED SET (lane PIECESPLAY's deal): a family from the theme's deck, then a card from the family's deck. A
  // SETTLE card settles the set live now; a piece card plays the piece once it is here, and until then the set
  // before plays on ('wait', at most PIECE_WAIT_BARS bars, then a live settle). Returns true, 'wait' or false.
  function startTrained(n) {
    let deal = pending && pending.theme === T.key ? pending : null;
    if (pending && !deal && pending.card) pieceDeckOf(pending.family)?.putBack(pending.card); // a new theme: the card goes back on top
    if (!deal) {
      const family = familyOf(T.key);
      const s = Math.floor(r() * 4294967296) >>> 0 || 1;
      const card = cardFor(family);
      deal = { n, family, seed: s, card, theme: T.key, dealtAt: now(), bars: 0 };
      fetchCard(card);
    }
    pending = null;
    const card = deal.card;
    if (card && !card.piece && !card.failed && deal.bars < PIECE_WAIT_BARS) { deal.bars += 1; pending = deal; return 'wait'; }
    try {
      // a piece plays in its own key and mode under any theme (navigator 2026-10-06): no shift
      trainedSet = card?.piece
        ? pieceToSet(card.piece, { family: deal.family, seed: deal.seed, shift: 0 })
        : settleTrainedSet(models, deal.family, { seed: deal.seed, notes: notesHook });
    } catch { trainedSet = null; return false; }
    pieceStart = card?.piece ? { id: card.id, name: card.name, dealtAt: deal.dealtAt, loadedAt: card.loadedAt, waitBars: deal.bars, prefetched: card.prefetched } : null;
    setCount = deal.n;
    tplanner.load(trainedSet, { set: deal.n });
    curTrained = true;
    return true;
  }
  // THE WARM-DOWN PREFETCH (lane PIECESPLAY): when a set reaches its hum, the next deal is PEEKED (nothing dealt) and a
  // piece card it shows starts fetching, so a natural set change finds the piece already here
  function prefetchNext() {
    if (!(brainWant === 'trained' && models) || !cards.length) return;
    const family = familyDeckOf(T.key).peek();
    const c = pieceDeckOf(family)?.peek();
    if (c && c !== SETTLE_CARD && !c.piece && !c.loading) { c.prefetched = true; fetchCard(c); }
  }
  function nextPlan(input, leans, mixSteer, blend) {
    const wantTrained = brainWant === 'trained' && !!models;
    if (!wantTrained) pending = null;
    const oldInput = { theme: T.key, mood: input.mood, steer: { static: leans.static ?? 0, theme: leans.theme ?? 0, energy: mixSteer.energy ?? 0 }, votes: input.votes, influence: blend };
    const oldNew = () => {
      curTrained = false;
      setCount += 1;
      planner.force({ section: 'intro', setBar: 0, set: setCount });
      return { ...planner.bar(oldInput), newSet: true, changed: true };
    };
    // while a dealt piece is on its way, what was playing plays on
    const hold = () => (curTrained ? tplanner.bar(input) : planner.bar(oldInput));
    if (pending) {
      const got = startTrained(pending.n);
      if (got === true) { restart = false; return tplanner.bar(input); }
      if (got === 'wait') return hold();
    }
    if (restart) {
      restart = false;
      if (wantTrained) {
        const got = startTrained(setCount + 1);
        if (got === true) return tplanner.bar(input);
        if (got === 'wait') return hold();
      }
      return oldNew();
    }
    if (curTrained) {
      // a full push of the theme lean (a new theme wanted) cuts the set to its warm-down at the next 8-bar line
      if ((leans.theme ?? 0) >= 1) tplanner.endSoon();
      if (!tplanner.done) {
        const Pt = tplanner.bar(input);
        if (Pt.section === 'hum' && Pt.changed) prefetchNext();
        return Pt;
      }
      if (wantTrained) {
        const got = startTrained(setCount + 1);
        if (got === true) return tplanner.bar(input);
        if (got === 'wait') return hold();
      }
      return oldNew();
    }
    if (barNo === 0 && wantTrained && startTrained(0) === true) return tplanner.bar(input);
    const P = planner.bar(oldInput);
    if (P.newSet) {
      setCount = P.set;
      if (wantTrained && startTrained(P.set) === true) return tplanner.bar(input);
    }
    return P;
  }

  const brain = {
    get influence() { return window; },
    get tune() { return tune; },
    get state() { return { theme: T.key, planner: curTrained ? tplanner.state : planner.state, mix: machine.state, chain: chain.slice(), drumFamily, bassStyle, texture, hum, voices, brain: curTrained ? 'trained' : 'old', trained: curTrained && trainedSet ? { family: trainedSet.family, seed: trainedSet.seed, blocks: trainedSet.blocks } : null }; },
    // THE TRAINED DJ (lane DJWIRE): the models arrive (or go), the brain is chosen; a change starts a new set next bar
    setTrained(m) { const had = !!models; models = m ?? null; if (!!models !== had && brainWant === 'trained' && barNo > 0) restart = true; },
    setBrain(b) { const want = b === 'old' ? 'old' : 'trained'; if (want !== brainWant) { brainWant = want; if (barNo > 0) restart = true; } },
    // NEXT SET (lane DJSKIP): a new set on the next bar, the same restart a brain switch makes (none before the first bar)
    nextSet() { if (barNo > 0) restart = true; },
    setNotes(fn) { notesHook = typeof fn === 'function' ? fn : null; },
    // STAGE 3's pieces (lane DJNOTES; lane PIECESPLAY): whole pieces, or index cards with opts.load(id) -> the piece,
    // dealt by family beside one live-settle card
    setPieces(list, { load = null } = {}) { setPieceList(list, load); },
    // what the deck holds and what has been fetched, for the tests and the measurement
    get pieceCards() { return cards.map((c) => ({ id: c.id, family: c.family, loaded: !!c.piece, loading: !!c.loading, failed: c.failed, prefetched: c.prefetched })); },
    get pendingPiece() { return pending?.card ? { id: pending.card.id, bars: pending.bars } : null; },
    get brain() { return curTrained ? 'trained' : 'old'; },
    get brainWanted() { return brainWant; },
    get trainedSet() { return curTrained ? trainedSet : null; },
    get voices() { return voices; },
    setTheme(key) { T = themeOf(key); },
    // a rating of the current set: it rides into the set's influence record when the set ends
    noteVote(stars) { if (Number.isInteger(stars) && stars >= 1 && stars <= 5) vote = stars; },
    // a REPLAY (dj-replay.js): load a decoded tag. The theme, the tune at its bar, the chain, the drums, the bass, the
    // texture, the hum and the influence window come from the tag; the planner jumps to its section and bar; the
    // mix machine holds the tag's layers for the next 8 bars, then settles freely again.
    load(d, rebuilt, { waited = false } = {}) {
      // a piece's tag whose piece is not here yet (lane PIECESPLAY): fetch it, play on, and load once it arrives
      const PCw = d?.trained?.piece ?? null;
      const cw = PCw ? findCard(PCw) : null;
      if (!waited && cw && !cw.piece) { fetchCard(cw); if (!cw.failed) { pendingLoad = { d, rebuilt, card: cw, waited: 0 }; return; } }
      pendingLoad = null;
      T = themeOf(d.theme);
      // a trained set's tag rebuilds the set from its family, seed and length (dj-trained.js is deterministic)
      curTrained = false;
      // a piece's tag (lane HEROPASS) plays the same piece again, moved the same way; a piece this brain does not hold
      // is never settled from the seed in its place (that would be another set under the same tag)
      const PC = d.trained?.piece ?? null;
      const piece = PC ? findCard(PC)?.piece ?? null : null;
      if (PC && piece) {
        try {
          trainedSet = pieceToSet(piece, { family: d.trained.family, seed: d.trained.seed, shift: PC.shift ?? 0 });
          tplanner.load(trainedSet, { set: d.set });
          tplanner.force({ setBar: d.setBar });
          curTrained = true;
          setCount = d.set;
          pieceStart = { id: piece.id ?? null, name: piece.name ?? null, dealtAt: now(), loadedAt: findCard(PC)?.loadedAt ?? null, waitBars: 0, prefetched: false, replay: true };
        } catch { curTrained = false; }
      } else if (!PC && d.trained && models?.families?.[d.trained.family]) {
        try {
          trainedSet = settleTrainedSet(models, d.trained.family, { seed: d.trained.seed, blocks: d.trained.blocks, notes: notesHook });
          tplanner.load(trainedSet, { set: d.set });
          tplanner.force({ setBar: d.setBar });
          curTrained = true;
          setCount = d.set;
        } catch { curTrained = false; }
      }
      if (!curTrained) planner.force({ section: d.section, setBar: d.setBar, set: d.set, keyLift: d.keyLift });
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
      if (pendingLoad) {
        const L = pendingLoad;
        L.waited += 1;
        if (L.card.piece || L.card.failed || L.waited >= PIECE_WAIT_BARS) brain.load(L.d, L.rebuilt, { waited: true });
      }
      if (input.theme && input.theme !== T.key) T = themeOf(input.theme);
      // the set that is playing as this bar begins (its influence record reads the piece's key when it was a piece)
      const endedPiece = curTrained && trainedSet?.piece ? trainedSet : null;
      const leans = input.steer?.leans ?? {};
      const mixSteer = { ...(input.steer?.mix ?? {}), flute: leans.flute ?? 0, drone: leans.drone ?? 0, split: leans.split ?? 0, static: leans.static ?? 0 };
      const blend = window.blend();
      const P = nextPlan(input, leans, mixSteer, blend);
      // A PIECE PLAYS AS WRITTEN (lane PIECESPLAY, navigator 2026-10-06: "the piece's own lead, play minor as it is"):
      // while a trained set is a piece, its own lead is the lead, and the bar's root, mode and chord are the piece's
      const PS = P.trained && curTrained && trainedSet?.piece ? trainedSet : null;
      const started = P.newSet && PS ? pieceStart : null;
      let newTune = false;
      if (P.newSet || !tune) {
        if (tune && setEnergy.length) {
          // the set that ended leaves its influence
          const EK = endedPiece?.piece?.key ?? null;
          window.push({ vote, keyPc: EK ? (((EK.tonic + (endedPiece.piece.shift ?? 0)) % 12) + 12) % 12 : tune.composed?.key?.pc ?? rootMidi() % 12, mode: EK ? pieceMode(EK) : tune.composed?.key?.mode7 ?? composeMode(T.mode).name, motif: tune.composed?.motif ?? [], theme: T.key, energy: setEnergy.reduce((a, b) => a + b, 0) / setEnergy.length, fx: chain.map((c) => c.key).slice(0, 3) });
        }
        setEnergy = [];
        vote = null;
        drumFamily = (THEME_DRUMS[T.key] ?? THEME_DRUMS.highlands)[Math.floor(r() * (THEME_DRUMS[T.key] ?? THEME_DRUMS.highlands).length)];
        // a trained set plays on its own family's kit (lane DJWIRE)
        if (P.trained) { const st = FAMILY_STYLE[P.trained.family] ?? [drumFamily]; drumFamily = st[Math.floor(r() * st.length) % st.length]; }
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
      if (P.changed && P.section === 'breakdown' && !PS) surfacing = surface();
      if (PS) surfacing = null;
      if (P.changed && P.section !== 'breakdown') surfacing = null;
      if (P.changed && P.section === 'hum') hum = humDealer.next({ after: prevSection, energy: blend?.energy ?? 0.5, motif: tune?.composed?.motif });
      if (P.changed && tune) { tune.pos = 0; tune.offset = 0; tune.barNo = 0; }
      if (P.changed && P.section === 'peak' && prevSection === 'breakdown') {
        // a roll at the second peak: the oldest pass gives way to a new one; the hall and the sidechain stay
        const keep = chain.slice(1);
        let k = passDeck.next(); let guard = 0;
        while (keep.some((c) => c.key === k) && guard++ < 10) k = passDeck.next();
        chain = [{ key: k, amount: 0.4 }, ...keep];
      }
      if (replayHold > 0) { replayHold -= 1; if (replayHold === 0) for (const k of Object.keys(machine.clamps)) machine.clamp(k, null); }
      const M = machine.bar({ section: P.section, changed: P.changed, onLine: P.lines[4], mood: input.mood, theme: T.key, steer: mixSteer, votes: input.votes, holds: input.holds, trained: P.trained?.layers ?? null });
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
      // a piece is never lifted: its notes are as written
      const lift = PS ? 0 : P.keyLift ?? 0;
      let notes = [];
      let lead = null;
      if (surfacing && P.section === 'breakdown') { notes = take(surfacing, meter); lead = surfacing; }
      else if (tune) { notes = take(tune, meter); lead = tune; }
      if (PS) notes = leadOfBar(P.trained.notes);
      if (lift) notes = notes.map((n) => ({ ...n, midi: n.midi == null ? null : n.midi + lift }));
      const pieceKey = PS ? PS.piece.key : null;
      const root = PS ? pieceRoot(pieceKey, rootMidi(), PS.piece.shift ?? 0) : rootMidi() + lift;
      const mode = PS ? pieceMode(pieceKey) : T.mode;
      const pieceChord = PS && P.trained.chord ? chordOfBar(PS, P.setBar, root) : null;
      // THE BASES: the plan for the phrase (settled on a 4-bar line or a section change, held inside it); the base
      // itself loads beside the bar and plays from the bar after it arrives, the family pattern until then
      let bases = null;
      if (baseHook) {
        const bp = baseHook.plan({ section: P.section, energy: M.energy, drumFamily, root, mode, bpm: input.bpm ?? null, mix: M, plan: P });
        if (!bp.held) {
          basePlan = bp;
          basePlanBar = barNo;
          baseRealised = null;
          baseError = null;
          Promise.resolve().then(() => baseHook.realise(bp)).then((b) => { if (basePlan === bp) { baseRealised = b; if (!b) baseError = 'the slices did not combine'; } }).catch((e) => { if (basePlan === bp) { baseRealised = null; baseError = String(e?.message ?? e); } });
        }
        bases = { plan: bp, realised: baseRealised, bar: barNo - basePlanBar, error: baseError };
      }
      const chord = pieceChord?.notes ?? progression(root, mode, barNo);
      if (!voices) voices = voiceDealer.palette({ theme: T.key, slots: HOUSE_SLOTS });
      // the lead's middle pitch (the median of its notes): the layers move it by whole octaves to the instrument
      const ln = (PS ? notes : lead?.notes ?? []).map((n) => n.midi).filter((m) => m != null).sort((a, b) => a - b);
      const leadCentre = ln.length ? ln[Math.floor(ln.length / 2)] + lift : null;
      setEnergy.push(M.energy);
      barNo += 1;
      prevSection = P.section;
      lastSection = P.section;
      const steps = MODES[mode] ?? MODES.ionian;
      const keyName = PS ? `${pieceKey?.tonic_name ?? ''} ${pieceKey?.mode ?? ''}`.trim() : null;
      return {
        bar: barNo,
        plan: P,
        mix: M,
        section: P.section,
        newSet: P.newSet,
        newTune,
        moves: PS ? P.moves.filter((m) => m.key !== 'key-lift') : P.moves,
        chain: chain.map((c) => ({ ...c })),
        notes,
        lead: PS
          ? { kind: 'piece', label: PS.piece.name ?? PS.piece.id, sources: [], input: [], seed: PS.seed, bar: P.setBar, abc: null, keyName, keyPc: ((root % 12) + 12) % 12 }
          : lead ? { kind: lead.kind, label: lead.label, sources: lead.sources, input: lead.input ?? [], seed: lead.seed, bar: Math.max(0, lead.barNo - 1), abc: lead.composed?.abc ?? null, keyName: lead.composed?.key?.name ?? null, keyPc: lead.composed?.key?.pc ?? (rootMidi() % 12) } : null,
        // THE PIECE OF THIS BAR (lane PIECESPLAY): its id and name, key, the chord of the bar, and on its first bar the
        // deal's clock (dealt, loaded, bars waited, prefetched at the warm-down), or null when no piece plays
        piece: PS ? { id: PS.piece.id, name: PS.piece.name, keyName, minor: pieceKey?.mode === 'minor', chordName: pieceChord?.name ?? null, start: started } : null,
        // a dealt piece still on its way (the set before plays on this bar): its id and the bars waited, or null
        pieceWait: pending?.card ? { id: pending.card.id, bars: pending.bars } : null,
        tune: tune ? { kind: tune.kind, label: tune.label, sources: tune.sources, input: tune.input ?? [], bar: tune.barNo, seed: tune.seed, abc: tune.composed?.abc ?? null, motif: tune.composed?.motif ?? [], copy: tune.composed?.copy ?? [], notes: tune.notes ?? null } : null, // notes: the tune's own array, by reference (lane DJVISUAL draws it)
        surfacing: surfacing ? { label: surfacing.label, sources: surfacing.sources } : null,
        root,
        mode,
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
        brain: P.trained ? 'trained' : 'old',
        // THE TRAINED SET'S BAR (lane DJWIRE): the family, the block, the bar's settled groove and the feel
        trained: P.trained ?? null,
        influence: { decay: window.decay, window: window.list, blend },
      };
    },
  };
  return brain;
}
