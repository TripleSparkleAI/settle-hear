// settle-hear · dj-pieces - THE PIECES, ONE AT A TIME (lane PIECESPLAY, navigator 2026-10-06: "the piece's own lead,
// play minor as it is"). Stage 3's ten pieces (lane DJNOTES, SETTLE/gridlearn) are written into this package by
// SETTLE/gridlearn/export_pieces.py: a small index of cards (dj-pieces-index.js) and one module a piece (./pieces/).
// This file is the door: the brain deals from the cards, and a piece is fetched only when THE DJ deals it.
//
// <claudes_code_comments>
// ** Function List **
// loadPieceIndex()            - the cards (dj-pieces-index.js), imported once and lazily; resolves { pieces, fence }
// loadPiece(id)               - one piece module, imported once and lazily; rejects an id that is not exported;
//                               resolves the djnotes-piece/v1 object (with its `fence` numbers)
// pieceLoads()                - every fetch so far: { id, bytes, startedAt, loadedAt, ms, ok }, oldest first
// resetPieceLoads()           - forget the fetches (tests and the measurement)
//
// ** Technical Review **
// - ONE PIECE A FETCH: `import(`./pieces/${id}.js`)` with the id in the path, so vite's dynamic-import-vars turns
//   the folder into one chunk a piece and only the dealt piece crosses the wire; node imports the same file in the
//   tests. An id is checked against the index's cards first, so a tag carrying a made-up id never builds a path.
// - THE CACHE is a promise per id: a second deal of the same piece is free, and a failed fetch is forgotten so the
//   next deal tries again.
// - THE LOG (pieceLoads) is what the measurement reads: the time each fetch started and finished on the page clock
//   (performance.now) and the module's byte size from its card.
// </claudes_code_comments>

let indexPromise = null;
const cache = new Map();
const loads = [];
const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

let ids = null;

export function loadPieceIndex() {
  if (!indexPromise) indexPromise = import('./dj-pieces-index.js').then((m) => m.default).catch((e) => { indexPromise = null; throw e; });
  return indexPromise;
}

async function knownIds() {
  if (ids) return ids;
  ids = new Set((await loadPieceIndex()).pieces.map((c) => c.id));
  return ids;
}

export function loadPiece(id) {
  const key = String(id ?? '');
  const hit = cache.get(key);
  if (hit) return hit;
  const row = { id: key, bytes: null, startedAt: now(), loadedAt: null, ms: null, ok: false };
  const p = (async () => {
    const known = await knownIds();
    if (!/^[a-z0-9-]+$/.test(key) || !known.has(key)) throw new Error(`no stage 3 piece named "${key}"`);
    loads.push(row);
    const m = await import(`./pieces/${key}.js`);
    const piece = m.default;
    row.loadedAt = now();
    row.ms = row.loadedAt - row.startedAt;
    row.ok = true;
    try { row.bytes = (await loadPieceIndex()).pieces.find((c) => c.id === key)?.bytes ?? null; } catch { /* no card, no size */ }
    return piece;
  })().catch((e) => { cache.delete(key); row.ok = false; throw e; });
  cache.set(key, p);
  return p;
}

export function pieceLoads() { return loads.map((r) => ({ ...r })); }

export function resetPieceLoads() { loads.length = 0; cache.clear(); }
