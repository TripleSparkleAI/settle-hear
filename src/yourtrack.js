// settle-hear · yourtrack - YOUR TRACK: the moment a visitor touches THE DJ's set (a hit, a loop, a steer) the set is
// theirs too. The DJ says "cool" and the vote asks for a rating; when the DJ cycles to a new set, the vote stays open
// on the old one for ten seconds, and the new set starts clean.
//
// <claudes_code_comments>
// ** Function List **
// VOTE_WINDOW_MS              - 10,000: how long the vote on your track stays open after the DJ cycles
// COOL_MS                     - 2,400: how long the DJ's "cool" shows after your first touch of a set
// BLOOM_MS                    - 900: how long the reset bloom runs when a new set returns the controls to the DJ
// createYourTrack({ windowMs, coolMs }) - the flag, pure, driven by an explicit clock: mark, cycle, voted, target, view
// listenSets({ target, live, onCycle, defer }) - THE SET LISTENER: calls onCycle({ set, adjusted, reason, snapshot })
//                               once per set that ends; returns off()
//
// ** Technical Review **
// - THE HOOKS (lane SETTLEDJ, dj.js): the symphony dispatches a window event `settle-hear:set` with { set, adjusted,
//   reason, tag, theme } for the set that ended, and djLive carries `set` (the set playing) and `adjusted`. The
//   listener takes both and fires once per ended set number. The live path waits one task (`defer`) so the window
//   event, which carries the ended set's own `adjusted`, wins when both arrive together.
// - DEGRADING: with neither hook (a DJ older than SETTLEDJ's), a change of theme in djLive counts as a new set, so the
//   reset and the vote window still work; `adjusted` is then only what the page itself marked.
// - THE SNAPSHOT: the listener keeps djLive's last state per set number, so the vote in the window rates the set that
//   ended (its theme, tune, beat), never the one that just began.
// - "ADJUSTED" HERE: the page marks the current set itself (mark()); for the set that ended it also takes the hook's
//   own `adjusted`. The current set's flag never reads dj.adjusted, because the page resets the steering on every
//   cycle and a steer carried over by dj.js would otherwise mark a set the visitor has not touched.
// </claudes_code_comments>

import { djLive } from './djlive.js';

export const VOTE_WINDOW_MS = 10_000;
export const COOL_MS = 2_400;
export const BLOOM_MS = 900;

export function createYourTrack({ windowMs = VOTE_WINDOW_MS, coolMs = COOL_MS } = {}) {
  let st = { mine: false, votedMine: false, coolUntil: 0, window: null, bloomAt: null, cycles: 0 };
  const open = (ms) => !!st.window && ms < st.window.until;
  const api = {
    get state() { return { ...st, window: st.window ? { ...st.window } : null }; },
    // the visitor touched the set: true the first time in this set (the DJ says "cool")
    mark(ms) {
      if (st.mine) return false;
      st = { ...st, mine: true, votedMine: false, coolUntil: ms + coolMs };
      return true;
    },
    // the DJ cycled: open the vote window on the set that ended when it was the visitor's and they have not voted on it
    cycle(ms, { adjusted = false, context = null, set = null, hadLayers = false } = {}) {
      const ended = st.mine || !!adjusted;
      const vote = ended && !st.votedMine;
      const bloom = ended || !!hadLayers;
      st = {
        mine: false,
        votedMine: false,
        coolUntil: 0,
        window: vote ? { set, context, until: ms + windowMs } : null,
        bloomAt: bloom ? ms : st.bloomAt,
        cycles: st.cycles + 1,
      };
      return { vote, bloom };
    },
    // a vote landed: in the window it rated the set that ended and closes the window; else it rated the set now
    voted(ms) {
      if (open(ms)) { st = { ...st, window: null }; return 'window'; }
      if (st.mine) st = { ...st, votedMine: true };
      return 'now';
    },
    // what a vote at ms rates: the set that ended (with its context) while the window is open, else the set now
    target(ms) {
      return open(ms) ? { kind: 'window', set: st.window.set, context: st.window.context } : { kind: 'now', set: null, context: null };
    },
    // the view: ask 'window' (the countdown) | 'mine' (your track, before the cycle) | null; cool; left (whole
    // seconds); bloom (the reset bloom is running)
    view(ms) {
      const w = open(ms);
      return {
        ask: w ? 'window' : st.mine && !st.votedMine ? 'mine' : null,
        cool: st.mine && ms < st.coolUntil,
        left: w ? Math.max(1, Math.ceil((st.window.until - ms) / 1000 - 1e-9)) : null,
        bloom: st.bloomAt != null && ms >= st.bloomAt && ms - st.bloomAt < BLOOM_MS,
      };
    },
  };
  return api;
}

const defaultDefer = (fn) => setTimeout(fn, 0);

export function listenSets({ target = typeof window !== 'undefined' ? window : null, live = djLive, onCycle = () => {}, defer = defaultDefer, eventName = 'settle-hear:set' } = {}) {
  let cur = live?.get?.() ?? null;
  const bySet = new Map();
  const remember = (s) => { if (s?.live && Number.isFinite(s.set)) bySet.set(s.set, s); if (bySet.size > 8) bySet.delete(bySet.keys().next().value); };
  remember(cur);
  let lastSet = Number.isFinite(cur?.set) ? cur.set : null;
  let lastTheme = cur?.theme ?? null;
  let hooked = lastSet != null;
  let prev = null;
  const done = new Set();
  const fire = (set, adjusted, reason, snapshot) => {
    if (set != null) { if (done.has(set)) return; done.add(set); }
    try { onCycle({ set, adjusted: !!adjusted, reason, snapshot: snapshot ?? null }); } catch { /* a listener that fails does not stop the next */ }
  };

  const onEvent = (e) => {
    const d = e?.detail ?? {};
    hooked = true;
    const set = Number.isFinite(d.set) ? d.set : null;
    // a track that is not THE DJ's set (lane DJSILENCE: a binaural mode's track) brings its own snapshot
    fire(set, d.adjusted, d.reason ?? 'set', (d.snapshot && typeof d.snapshot === 'object' ? d.snapshot : null) ?? (set != null ? bySet.get(set) : null) ?? prev ?? cur);
  };
  const onLive = (s) => {
    const before = cur;
    cur = s;
    if (Number.isFinite(s?.set)) {
      hooked = true;
      if (lastSet != null && s.set > lastSet) {
        const ended = lastSet;
        const snap = bySet.get(ended) ?? before;
        defer(() => fire(ended, false, 'live', snap));
      }
      lastSet = s.set;
    } else if (!hooked && s?.theme && lastTheme && s.theme !== lastTheme) {
      fire(null, false, 'theme', before);
    }
    if (s?.theme) lastTheme = s.theme;
    prev = before;
    remember(s);
  };

  target?.addEventListener?.(eventName, onEvent);
  const offLive = live?.subscribe?.(onLive) ?? (() => {});
  return () => { target?.removeEventListener?.(eventName, onEvent); offLive(); };
}
