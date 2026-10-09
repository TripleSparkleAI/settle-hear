// settle-hear · popup - THE DJ VIEW as a popup: when the big view opens and what closes it, as one pure rule.
//
// <claudes_code_comments>
// ** Function List **
// djPopupStep(open, action) - the next open state: 'toggle' (the one-line DJ) flips it; 'close' (the x), 'escape'
//                             and 'dismiss' (another hero popover opened, or the hero shrank to the bar) shut it;
//                             'outside' shuts it unless the pointer went down inside the DJ's own root
// djInside(target, {view, toggle}) - true when a pointerdown landed in the panel or on its own toggle (the DJ line);
//                             the .dj root's empty box is outside
// djRoom({lineTop, lineBottom, boundTop, boundBottom, above, margin, min}) - the panel's max height: from the top
//                             bound to the line when it opens above, from the line to the bottom bound below
// djHeadline({modeName, beat, carrier, status, fallback, words}) - the panel's title and its one dim line under it;
//                             words(en, vars) gives the line in the page's language (lane FINISHDJ), English by default
// traceColumns(n)           - the p-bit track's columns: one 4 to 14 px column a sweep, never wider than its sweeps
//
// ** Technical Review **
// - The navigator asked for the DJ's big view to behave like a usual tooltip or popup. HeroSymphony keeps `open` and
//   routes every event through this rule: a pointerdown listener on the document while open (inside the .dj root it
//   is ignored), a keydown listener for Escape, the x button, and its closeWhen prop. Being pure, the rule is tested
//   in node; the browser wiring is checked by the site's tools/perf/housedj_hero.py.
// - THE OUTSIDE BUG (lane DJRATELINE): the .dj root is a flex column as wide as its longest child, so with the DJ line
//   showing a long tune its box covered most of the hero, and a click on that empty box counted as inside. Inside now
//   means the panel or the toggle, and the root takes no pointer events of its own (symphony.css).
// - THE ROOM: the hero clips its children, so a panel taller than the space above the DJ line ran under the line. The
//   React part measures the line and the bounds (the clipping ancestor, the site's --head-h and --foot-strip) and
//   caps the panel with djRoom; the panel's body scrolls inside it.
// </claudes_code_comments>

export function djPopupStep(open, a = {}) {
  switch (a.type) {
    case 'toggle': return !open;
    case 'close':
    case 'escape':
    case 'dismiss': return false;
    case 'outside': return a.inside ? open : false;
    default: return open;
  }
}

export function djInside(target, { view = null, toggle = null } = {}) {
  if (!target) return false;
  return !!(view?.contains?.(target) || toggle?.contains?.(target));
}

export const DJ_ROOM = Object.freeze({ margin: 12, min: 160 });

export function djRoom({ lineTop = 0, lineBottom = 0, boundTop = 0, boundBottom = 0, above = true, margin = DJ_ROOM.margin, min = DJ_ROOM.min } = {}) {
  const room = above ? lineTop - boundTop - margin : boundBottom - lineBottom - margin;
  return Math.max(min, Math.floor(room));
}

const hz1 = (f) => (Number.isFinite(f) ? f.toFixed(1) : null);

const fillEn = (en, vars) => (vars ? String(en).replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k]))) : String(en));

export function djHeadline({ modeName = null, beat = null, carrier = null, status = '', fallback = 'THE DJ', words = null } = {}) {
  const w = typeof words === 'function' ? words : fillEn;
  const sub = [
    Number.isFinite(beat) ? w('{beat} Hz beat', { beat }) : null,
    hz1(carrier) != null ? w('carrier {hz} Hz', { hz: hz1(carrier) }) : null,
    status || null,
  ].filter(Boolean).join(' · ');
  return { title: modeName || fallback, sub };
}

export function traceColumns(n = 0) {
  return `repeat(${Math.max(1, Math.floor(n) || 0)}, minmax(4px, 14px))`;
}
