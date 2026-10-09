// settle-hear · dj-skip - NEXT AND PREVIOUS FOR THE DJ'S SETS (lane DJSKIP, navigator 2026-10-06: "for the DJ, we do
// need some sort of next and previous buttons that let us move next and previous on the DJ system, from track to
// track"). Two live doors the symphony lands on its next bar line, and the visit's set history the site walks.
//
// <claudes_code_comments>
// ** Function List **
// SKIP                       - the numbers: the history keeps the last 64 sets of the visit
// djSkipRequests             - THE SKIP DOOR: subscribe(fn) -> off, listeners; the symphony subscribes and lands each
//                              request on its next bar line (the last request before that line wins)
// nextSet()                  - ask the playing symphony to end the set on the next bar line and start a new one, as a
//                              natural set change does; returns how many symphonies heard it
// replaySet(tag)             - ask the playing symphony to play a set again from its tag on the next bar line, and to
//                              announce it as a set; returns how many symphonies heard it
// setIdOf(tag)               - pure: a tag's set identity { opener, theme, set, setBar, pure }, or null for no tag; a
//                              mode's track tag (modes.js modeTrackTag) is { mode, ... } (lane DJSILENCE)
// isNewSet(prev, next)       - pure: does `next` start a set after `prev` (an opener began or ended, the set number or
//                              the mode changed, or the set's bar went back; an opener's theme changing)
// createSetHistory(opts)     - the visit's sets: observe(tag, meta) -> 'new' | 'replay' | 'upgrade' | null; back() and
//                              forward() move the cursor and return the entry to replay (null at either end); go(i)
//                              jumps to entry i (the #/hear list, lane HEROPASS);
//                              cancel() takes the last move back; canBack, canForward, current, pending, state()
//
// ** Technical Review **
// - THE DOORS. nextSet() and replaySet(tag) are messages, like playTag's live door (dj-replay.js djTagRequests): this
//   file holds no symphony. A symphony keeps the last request and takes it at the top of its next runBar, so the change
//   lands on the bar line, which sits on THE MASTER BEAT's bar grid. A playTag request after a skip request replaces it,
//   and the other way round.
// - NEXT IS A NATURAL SET CHANGE. In house mode the brain (mix-dj.js nextSet) restarts as a brain switch does: the
//   trained DJ settles a new set when it is on, the old planner opens one otherwise, and the symphony moves the theme
//   and fires the set hooks (dj.onSetCycle and the 'settle-hear:set' page event) exactly as at a set's natural end. So
//   the rate marks, the track tags and the playlist see a new set. A skip is never a vote: nothing here or in the
//   symphony's skip path writes to djVotes, the bandit or a rating.
// - THE HISTORY is fed by the tags the symphony emits (djLive.tag): a tag that starts a set (isNewSet) pushes an entry,
//   cutting any forward history as a browser does. The entry keeps the set's first tag, then the tag of its second bar
//   (an 'upgrade'): a replay of a bar-0 tag would meet the planner's new-set branch on its first bar and compose a
//   fresh tune over the loaded one, so a set is replayed from its second bar. back() and forward() move the cursor at
//   once (PREV pressed twice before the bar line walks two sets back) and mark a replay as pending; the first new tag
//   after that is its landing and pushes nothing. forward() at the end returns null: the caller composes a new set.
// - Pure and deterministic; the site's live half is SETTLE/settle-site/src/heroSkipLive.js.
// </claudes_code_comments>

import { decodeTag } from './dj-tag.js';
import { modeOfTrackTag } from './modes.js';

export const SKIP = Object.freeze({ historyCap: 64 });

const subs = new Set();
export const djSkipRequests = {
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  get listeners() { return subs.size; },
};

function send(req) {
  let n = 0;
  for (const f of subs) { try { f(req); n++; } catch { /* a listener that fails is skipped */ } }
  return n;
}

export function nextSet() { return send(Object.freeze({ type: 'next' })); }

export function replaySet(tag) {
  if (typeof tag !== 'string' || !tag) return 0;
  return send(Object.freeze({ type: 'replay', tag }));
}

export function setIdOf(tag) {
  if (typeof tag !== 'string' || !tag) return null;
  // a mode's own tag (modes.js modeTrackTag, lane DJSILENCE): every track is THE DJ's, a binaural mode included
  const mode = modeOfTrackTag(tag);
  if (mode) return { mode, opener: false, theme: null, set: -2, setBar: 1, pure: false };
  try {
    const d = decodeTag(tag);
    if (d.kind === 'opener') return { opener: true, theme: d.theme ?? null, set: -1, setBar: 0, pure: false };
    return { opener: false, theme: d.theme, set: d.set, setBar: d.setBar, pure: !!d.pure };
  } catch {
    return null;
  }
}

export function isNewSet(prev, next) {
  if (!next) return false;
  if (!prev) return true;
  if (prev.mode || next.mode) return prev.mode !== next.mode;
  if (prev.opener !== next.opener) return true;
  if (next.opener) return prev.theme !== next.theme;
  // the set number, not the theme: every set change moves the number in the same bar's tag (the house planner's set,
  // the classic DJ's cycleSet), and a theme alone is not a set (lane DJSKIPFIX)
  return prev.set !== next.set || next.setBar < prev.setBar || prev.pure !== next.pure;
}

export function createSetHistory({ cap = SKIP.historyCap } = {}) {
  let list = [];
  let c = -1;
  let lastTag = null;
  let lastId = null;
  let pending = false;
  const trim = () => {
    if (list.length > cap) {
      const drop = list.length - cap;
      list = list.slice(drop);
      c = Math.max(0, c - drop);
    }
  };
  let undo = null;
  const nav = (i) => { undo = { c, pending }; c = i; pending = true; return list[c]; };
  return {
    observe(tag, meta = null) {
      if (typeof tag !== 'string' || !tag || tag === lastTag) return null;
      const id = setIdOf(tag);
      if (!id) return null;
      const fresh = isNewSet(lastId, id);
      lastTag = tag;
      lastId = id;
      if (pending) { pending = false; return 'replay'; }
      if (fresh) {
        list = list.slice(0, c + 1);
        list.push({ tag, first: tag, meta, ready: id.opener || id.setBar > 0 });
        c = list.length - 1;
        trim();
        return 'new';
      }
      const e = list[list.length - 1];
      if (e && c === list.length - 1 && !e.ready) {
        list[list.length - 1] = { ...e, tag, meta: meta ?? e.meta, ready: true };
        return 'upgrade';
      }
      return null;
    },
    back() { return c > 0 ? nav(c - 1) : null; },
    forward() { return c >= 0 && c < list.length - 1 ? nav(c + 1) : null; },
    // THE VISIT'S SETS, replayable (lane HEROPASS, for #/hear's list): move the cursor to entry i at once, as back()
    // and forward() do, and return the entry to replay; null for the entry already playing or one out of range
    go(i) { return Number.isInteger(i) && i >= 0 && i < list.length && i !== c ? nav(i) : null; },
    // the last back() or forward() is taken back (its replay reached no symphony, so nothing will land)
    cancel() { if (!undo) return false; c = undo.c; pending = undo.pending; undo = null; return true; },
    get canBack() { return c > 0; },
    get canForward() { return c >= 0 && c < list.length - 1; },
    get current() { return c >= 0 ? list[c] : null; },
    get pending() { return pending; },
    state: () => ({ list: list.map((e) => ({ ...e })), cursor: c, pending }),
  };
}
