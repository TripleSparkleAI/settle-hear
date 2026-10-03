// settle-hear · djlive - THE DJ's public state, read only: what the hero symphony plays right now, in one small object.
//
// <claudes_code_comments>
// ** Function List **
// DJ_IDLE           - the state when no symphony runs: nothing plays, every field null
// djSnapshot(s)     - a symphony snapshot (symphony.js snapshot()) -> the compact public state
// djLive            - the store: get(), set(state), subscribe(fn); written by the symphony, read by anyone
//
// ** Technical Review **
// - Lane FEEDBACKRL needs to name what plays when a listener rates it: the theme, the tune, the house chain, the
//   binaural beat and carrier, the DJ's bar mode. The symphony keeps that state inside HeroSymphony; this store is a
//   one-way window onto it. The symphony writes it from emit() and clears it on dispose(); nothing here can change
//   what the DJ does (there is no setter on the DJ, only on this copy).
// - Lane SETTLEDJ added pure, tag, set, adjusted, section and parts (the parts popover's words), all plain data.
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
});

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);

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
