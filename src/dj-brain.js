// settle-hear · dj-brain - WHICH DJ PLAYS THE HOUSE SETS: the trained one (lane DJWIRE: sets composed from THE DJ's
// trained models, dj-trained.js) or the old one (the hand-written planner, mix-planner.js). A small store the page
// reads and a dev-only switch writes, so the two can be heard one after the other (an A/B).
//
// <claudes_code_comments>
// ** Function List **
// DJ_BRAINS                   - 'trained' and 'old'
// djBrain                     - the store: get(), set(mode), subscribe(fn); 'trained' by default, one per page load
//
// ** Technical Review **
// - createSymphony({ djBrain }) reads it: 'trained' loads the trained models (a lazy import, its own chunk) and the
//   brain composes every new set from them; until they arrive, or when they fail to load, the old DJ plays (the
//   fallback). 'old' keeps the old DJ. A change lands on the next bar line as a new set, so an A/B is heard at once.
// - A symphony created without the option keeps the old DJ, so code and tests that never asked for the trained one
//   are unchanged.
// </claudes_code_comments>

export const DJ_BRAINS = Object.freeze(['trained', 'old']);

function brainStore(init) {
  let mode = DJ_BRAINS.includes(init) ? init : 'trained';
  const subs = new Set();
  return {
    get: () => mode,
    set(v) {
      if (!DJ_BRAINS.includes(v) || v === mode) return;
      mode = v;
      for (const f of subs) { try { f(mode); } catch { /* a listener that fails is skipped */ } }
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

export const djBrain = brainStore('trained');
export const createBrainStore = brainStore;
