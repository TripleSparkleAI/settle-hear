// settle-hear · sfx-decks - THE TWO SFX DECKS (lane SWORDSWISH, navigator 2026-10-05: "anime sword sounds on page
// load, and sometimes on click in the radial user click"; "make 50 new other sounds for radial clicks too"). One file
// per lane holds 25 sounds; this module finds the four files and deals them as two decks of 50.
//
// <claudes_code_comments>
// ** Function List **
// SFX_FILES                      - the four lane files: { file, name (the export), deck, lane, prefix }
// SFX_DECKS                      - the two deck names, 'sword' and 'radial'
// loadSfxModules()               - dynamic-import each file not already found (vite: the lazy glob's loaders; node:
//                                  the file's URL); a missing one is left out (OWED), never a failed import. One load
//                                  for the page, however often it is asked. Resolves to sfxDecks()
// sfxLoaded()                    - whether that load has finished
// sfxDecks()                     - { sword, radial, all, owed, found }: the entries found so far, by deck; owed lists
//                                  the lanes whose file has not landed
// sfxById(id)                    - one entry by its id, or null
//
// ** Technical Review **
// - THE ANY-ORDER LANDING: under vite, import.meta.glob('./sfx-{sword,radial}-*.js') is replaced at build time by one
//   loader per file that exists, so a lane's file appears in the site the moment it lands. Since lane BUNDLESLIM
//   (2026-10-07) the glob is lazy, not eager: the decks are their own chunks, and the site calls loadSfxModules()
//   once the first frame is out; until then the decks are empty and every trigger plays nothing, which is what they
//   already do before the visitor's first gesture opens the sound. In node,
//   import.meta.glob is undefined, the call throws and is caught, and loadSfxModules() fills the table with dynamic
//   imports that each catch their own absence. So no lane needs a stub of another's file, and the pieces land in any
//   order.
// - THE FORMAT (SETTLE/runs/animesfx/CHANNEL.md, ruled by SWORDSWISH): each lane file exports one frozen array of
//   entries { id, name, kind, deck, lane, dur, provenance, render(ctx, at, dest, opts) }. render builds every node
//   from ctx, schedules from `at` into `dest`, returns its end time, and takes opts { strength = 1, seed = 1 }.
// - An entry joins a deck only when it says so (entry.deck), so a file's entries are checked, not trusted by name.
//   A duplicate id keeps the first and drops the rest (the format test reports it).
// </claudes_code_comments>

export const SFX_FILES = Object.freeze([
  Object.freeze({ file: './sfx-sword-swish.js', name: 'SWORD_SWISH', deck: 'sword', lane: 'SWORDSWISH', prefix: 'swish-' }),
  Object.freeze({ file: './sfx-sword-hit.js', name: 'SWORD_HIT', deck: 'sword', lane: 'ANIMEHIT', prefix: 'hit-' }),
  Object.freeze({ file: './sfx-radial-psy.js', name: 'RADIAL_PSY', deck: 'radial', lane: 'PSYRADIAL', prefix: 'psy-' }),
  Object.freeze({ file: './sfx-radial-hyper.js', name: 'RADIAL_HYPER', deck: 'radial', lane: 'HYPERRADIAL', prefix: 'hyper-' }),
]);

export const SFX_DECKS = Object.freeze(['sword', 'radial']);

const found = new Map(); // file -> the module's exports

// vite: the files that exist, replaced at build time by one loader each (a LAZY glob since lane BUNDLESLIM: the 100
// sounds are about 75 kB of code a first paint does not need, so they are their own chunks, fetched by
// loadSfxModules()). node: import.meta.glob is undefined, so this throws and is caught, and loadSfxModules() imports
// each file by its URL instead.
const loaders = new Map(); // file -> () => import(file), under vite only
try {
  const mods = import.meta.glob('./sfx-{sword,radial}-*.js');
  for (const [k, load] of Object.entries(mods)) loaders.set(k, load);
} catch { /* node: loadSfxModules() fills the table */ }

let cache = null;
let loading = null;
let loaded = false;

export function loadSfxModules() {
  if (!loading) {
    loading = (async () => {
      for (const f of SFX_FILES) {
        if (found.has(f.file)) continue;
        try {
          const m = loaders.size ? await loaders.get(f.file)?.() : await import(/* @vite-ignore */ new URL(f.file, import.meta.url).href);
          if (m) found.set(f.file, m);
        } catch { /* not landed yet: OWED */ }
      }
      cache = null;
      loaded = true;
      return sfxDecks();
    })();
  }
  return loading;
}

// true once loadSfxModules() has finished: until then the decks are empty, and a sound asked for plays nothing
export function sfxLoaded() {
  return loaded;
}

export function sfxDecks() {
  if (cache) return cache;
  const sword = [];
  const radial = [];
  const owed = [];
  const seen = new Set();
  for (const f of SFX_FILES) {
    const m = found.get(f.file);
    const list = Array.isArray(m?.[f.name]) ? m[f.name] : null;
    if (!list || !list.length) { owed.push(f.lane); continue; }
    for (const e of list) {
      if (!e || typeof e.render !== 'function' || seen.has(e.id)) continue;
      seen.add(e.id);
      if (e.deck === 'sword') sword.push(e);
      else if (e.deck === 'radial') radial.push(e);
    }
  }
  cache = Object.freeze({ sword: Object.freeze(sword), radial: Object.freeze(radial), all: Object.freeze([...sword, ...radial]), owed: Object.freeze(owed), found: found.size });
  return cache;
}

export function sfxById(id) {
  return sfxDecks().all.find((e) => e.id === id) ?? null;
}
