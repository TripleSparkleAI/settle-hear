// settle-hear · dj-influence - INFLUENCES CARRY BETWEEN SETS. Each set the house DJ plays leaves a small record (its
// key, its opening motif, its theme, its energy, the effects that sounded, its vote), and the next set reads the
// last few of them through a decaying window: nearer sets count more. Not a copy: a lean toward continuity.
//
// <claudes_code_comments>
// ** Function List **
// INFLUENCE                   - the window: size 4, decay 0.6 (weights 1, 0.6, 0.36, 0.22 before normalising)
// makeInfluence(fields)       - a checked influence record: { keyPc 0..11, mode, motif (up to 4 semitone steps,
//                               -7..7), theme, energy 0..1, fx (up to 3 rack keys), vote (1..5 or null) }
// influenceWeights(n, decay)  - newest-first weights for a window of n, summing to 1
// blendInfluence(window, decay) - the weighted view the planner and the hum read: { energy, keyPc (the heaviest key),
//                               motif (the weighted mean step, rounded), themes { key: weight }, weights }
// createInfluenceWindow(opts) - the window: push(rec) (newest first, oldest falls off), list, weights, blend(),
//                               vote(stars) (marks the newest record), clear(); opts.storage (a localStorage-like
//                               object) keeps it across visits under INFLUENCE.key
// influenceSay(window)        - the same words as [english template, values] pairs, for a page in another language
// describeInfluence(window)   - plain words for the parts popover ("carries the key of the last set (D) and its
//                               opening motif")
//
// ** Technical Review **
// - THE WINDOW (navigator, 2026-10-02: "each set considers its previous sets over some window"): the composer
//   pulls each note toward the pitch classes of each earlier set's key and the opening steps toward each set's
//   motif, every pull scaled by that set's weight (tune-composer.js); the planner shifts its energy arc a little
//   toward the window's mean energy (mix-planner.js); the NEUTRAL HUM plays on the heaviest earlier key and its
//   motif, slowed right down. The window and its decay ride in the tag (dj-tag.js), so playTag rebuilds the
//   same pulls.
// - Weights: w_k = decay^k for k = 0 (newest) .. n-1, divided by their sum. With decay 0.6 and four sets that is
//   0.459, 0.275, 0.165, 0.099: the newest set counts about 4.6 times the oldest.
// - Storage is optional and guarded: a failing storage is ignored and the window lives in memory.
// </claudes_code_comments>

export const INFLUENCE = Object.freeze({ size: 4, decay: 0.6, key: 'settle-hear:influence:v1' });

const MODES7 = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'];
const clampInt = (x, a, b) => Math.min(b, Math.max(a, Math.round(Number(x) || 0)));
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function makeInfluence({ keyPc = 0, mode = 'ionian', motif = [], theme = null, energy = 0.5, fx = [], vote = null } = {}) {
  return {
    keyPc: ((clampInt(keyPc, -99, 99) % 12) + 12) % 12,
    mode: MODES7.includes(mode) ? mode : 'ionian',
    motif: (Array.isArray(motif) ? motif : []).slice(0, 4).map((m) => clampInt(m, -7, 7)),
    theme: typeof theme === 'string' ? theme : null,
    energy: Math.min(1, Math.max(0, Number.isFinite(+energy) ? +energy : 0.5)),
    fx: (Array.isArray(fx) ? fx : []).filter((k) => typeof k === 'string').slice(0, 3),
    vote: Number.isInteger(vote) && vote >= 1 && vote <= 5 ? vote : null,
  };
}

export function influenceWeights(n, decay = INFLUENCE.decay) {
  const raw = Array.from({ length: Math.max(0, n) }, (_, k) => Math.pow(decay, k));
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((w) => w / sum);
}

export function blendInfluence(window = [], decay = INFLUENCE.decay) {
  const list = window.filter(Boolean);
  if (!list.length) return null;
  const w = influenceWeights(list.length, decay);
  const keys = new Map();
  const themes = {};
  let energy = 0;
  list.forEach((r, k) => {
    energy += w[k] * r.energy;
    keys.set(r.keyPc, (keys.get(r.keyPc) ?? 0) + w[k]);
    if (r.theme) themes[r.theme] = (themes[r.theme] ?? 0) + w[k];
  });
  const motif = [];
  for (let i = 0; i < 4; i++) {
    let s = 0;
    let ws = 0;
    list.forEach((r, k) => { if (Number.isFinite(r.motif[i])) { s += w[k] * r.motif[i]; ws += w[k]; } });
    if (ws > 0) motif.push(Math.round(s / ws));
  }
  const keyPc = [...keys.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return { energy, keyPc, motif, themes, weights: w, count: list.length };
}

export function createInfluenceWindow({ size = INFLUENCE.size, decay = INFLUENCE.decay, storage = null, initial = null } = {}) {
  let list = [];
  const load = () => {
    try {
      const raw = storage?.getItem?.(INFLUENCE.key);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) list = arr.slice(0, size).map(makeInfluence);
    } catch { /* a broken store is ignored */ }
  };
  const save = () => {
    try { storage?.setItem?.(INFLUENCE.key, JSON.stringify(list)); } catch { /* memory only */ }
  };
  if (Array.isArray(initial)) list = initial.slice(0, size).map(makeInfluence);
  else load();
  return {
    get list() { return list.slice(); },
    get size() { return size; },
    get decay() { return decay; },
    weights() { return influenceWeights(list.length, decay); },
    blend() { return blendInfluence(list, decay); },
    push(rec) { list = [makeInfluence(rec), ...list].slice(0, size); save(); return list[0]; },
    vote(stars) { if (list[0]) { list[0] = makeInfluence({ ...list[0], vote: stars }); save(); } },
    clear() { list = []; save(); },
  };
}

// the same words as templates, [english, values] each (lane FINISHDJ): a page in another language fills them itself
export function influenceSay(window = []) {
  const b = blendInfluence(window);
  if (!b) return [['the first set: nothing carried yet', null]];
  const newest = window[0];
  const parts = [['carries the key of the last set ({key})', { key: `${NAMES[newest.keyPc]}${newest.mode === 'ionian' ? '' : ` ${newest.mode}`}` }]];
  if (newest.motif.length) parts.push(['its opening motif', null]);
  if (b.count > 1) parts.push(['leans on {n} earlier sets, the nearer ones more', { n: b.count }]);
  return parts;
}

const fillEn = (en, vars) => (vars ? String(en).replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k]))) : String(en));

export function describeInfluence(window = []) {
  return influenceSay(window).map(([en, vars]) => fillEn(en, vars)).join(', ');
}
