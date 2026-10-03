// settle-hear · dj-votes - THE VOTES THE DJ LEANS ON: every rating names one tag; the tag names the whole situation;
// so a rating speaks for the section, the layers and the effects that were in it. This file turns rated tags into
// small leans for the planner and the mix machine.
//
// <claudes_code_comments>
// ** Function List **
// VOTE_LEAN                  - the rule's numbers: on (true), the minimum ratings before a lean shows (1), the cap
// djVotes                    - the store: add({ tag, stars }) (one rating per tag; a second rating of a tag replaces
//                              the first), list(), clear(), subscribe(fn)
// votesFromTags(list, decode) - [{ tag, stars }] -> { sections: { key: -1..1 }, layers: { key: -1..1 },
//                              fx: { key: -1..1 }, themes: { key: -1..1 }, n }
//
// ** Technical Review **
// - THE RULE, simple and on by default: a rating's score is (stars - 1) / 4 - 0.5, so 1 star is -0.5 and 5 stars
//   +0.5. For every attribute a rated tag carries (its section, each layer in, each chain effect, each move, its
//   theme), the lean is the mean of 2 x score over the ratings that carried it. A layer that was OUT in a rated tag
//   takes the opposite sign. The planner adds 0.8 x the section lean / 2 to a plan's score; the mix machine adds 1.2 x
//   the layer lean; chooseFx adds 0.8 x the move's lean. With no ratings every lean is absent and the DJ is unchanged.
// - The feedback bandit on the site (lane FEEDBACKRL) only picks a starting theme and is off by default; this rule is
//   separate and reads only the tags rated in this browser (the site pushes each rating here as it is made).
// </claudes_code_comments>

export const VOTE_LEAN = Object.freeze({ on: true, min: 1, cap: 1 });

function store() {
  let list = [];
  const subs = new Set();
  const api = {
    list: () => list.slice(),
    add({ tag, stars }) {
      if (typeof tag !== 'string' || !tag || !Number.isInteger(stars) || stars < 1 || stars > 5) return false;
      list = [...list.filter((v) => v.tag !== tag), { tag, stars }].slice(-200);
      for (const f of subs) f(list);
      return true;
    },
    clear() { list = []; for (const f of subs) f(list); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
  return api;
}

export const djVotes = store();

export function votesFromTags(list = [], decode) {
  const acc = { sections: {}, layers: {}, fx: {}, themes: {} };
  const add = (bucket, key, v) => { const b = (acc[bucket][key] ??= { s: 0, n: 0 }); b.s += v; b.n += 1; };
  let n = 0;
  for (const { tag, stars } of list) {
    let d;
    try { d = decode(tag); } catch { continue; }
    const v = 2 * ((stars - 1) / 4 - 0.5);
    n += 1;
    add('sections', d.section, v);
    add('themes', d.theme, v);
    for (const [k, on] of Object.entries(d.layers ?? {})) add('layers', k, on ? v : -v);
    for (const c of d.chain ?? []) if (c.key) add('fx', c.key, v);
    for (const m of d.moves ?? []) if (m) add('fx', m, v);
  }
  const out = { n };
  for (const b of ['sections', 'layers', 'fx', 'themes']) {
    out[b] = {};
    for (const [k, { s, n: c }] of Object.entries(acc[b])) if (c >= VOTE_LEAN.min) out[b][k] = Math.max(-VOTE_LEAN.cap, Math.min(VOTE_LEAN.cap, s / c));
  }
  return out;
}
