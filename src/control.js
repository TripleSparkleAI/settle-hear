// settle-hear · control - the page-wide sound switch: the mute preference (the one thing remembered), the unlock
// state (the browser let the page's sound start) and the blocked state (the browser refused it on load).
//
// <claudes_code_comments>
// ** Function List **
// MUTE_KEY                        - the storage key: 'settle-hear:muted'
// readMuted(storage)              - the stored mute choice: true, false, or null when nothing is stored or storage fails
// writeMuted(storage, muted)      - store the mute choice; returns false (and never throws) when storage fails
// createSwitch({ storage, defaultMuted }) - a switch: { muted, unlocked, blocked, setMuted, toggle, unlock, setBlocked,
//                                   subscribe }
// browserStorage()                - window.localStorage when it can be reached, else null (private windows can throw)
// sound                           - the page's one switch, built on browserStorage()
//
// ** Technical Review **
// - Sound is ON by default as a preference (defaultMuted false). Nothing plays until `unlocked`. THE START RULE (lane
//   AUTOSTART, engine.js): the engine tries to start the sound on page load and sets `unlocked` the moment the
//   browser runs the context; when the browser refuses (its autoplay rule decides), `blocked` turns true until the
//   first gesture starts it. The site shows `blocked` (the header's pulse, the hero's CLICK TO PLAY).
// - unlock() also clears `blocked`: a running context is never blocked.
// - Only the mute choice is persisted. Per-settle play/stop is not remembered, and nothing else is written.
// - Every storage access is wrapped in try/catch: a throwing storage (a private window, blocked site data) leaves the
//   switch working for the visit, just without memory.
// - subscribe(fn) calls fn({ muted, unlocked, blocked }) on every change and returns an unsubscribe function.
// </claudes_code_comments>

export const MUTE_KEY = 'settle-hear:muted';

export function readMuted(storage) {
  if (!storage) return null;
  try {
    const v = storage.getItem(MUTE_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
    return null;
  } catch {
    return null;
  }
}

export function writeMuted(storage, muted) {
  if (!storage) return false;
  try {
    storage.setItem(MUTE_KEY, muted ? '1' : '0');
    return true;
  } catch {
    return false;
  }
}

export function createSwitch({ storage = null, defaultMuted = false } = {}) {
  const stored = readMuted(storage);
  const state = { muted: stored ?? !!defaultMuted, unlocked: false, blocked: false, remembered: stored !== null };
  const subs = new Set();
  const emit = () => {
    const snap = { muted: state.muted, unlocked: state.unlocked, blocked: state.blocked };
    for (const fn of subs) fn(snap);
  };
  return {
    get muted() { return state.muted; },
    get unlocked() { return state.unlocked; },
    // true while the browser refused to start the sound and no gesture has started it yet
    get blocked() { return state.blocked; },
    // true when this visit's starting choice came from storage (a returning visitor's choice)
    get remembered() { return state.remembered; },
    // playing means: not muted and the page has had its first gesture
    get audible() { return !state.muted && state.unlocked; },
    setMuted(m) {
      const v = !!m;
      if (v === state.muted) return;
      state.muted = v;
      writeMuted(storage, v);
      emit();
    },
    toggle() { this.setMuted(!state.muted); return state.muted; },
    unlock() {
      if (state.unlocked && !state.blocked) return;
      state.unlocked = true;
      state.blocked = false;
      emit();
    },
    setBlocked(b) {
      const v = !!b && !state.unlocked;
      if (v === state.blocked) return;
      state.blocked = v;
      emit();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function browserStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

// the page's one switch (a module singleton; every import of settle-hear shares it)
const KEY = Symbol.for('settle-hear.switch');
const g = typeof globalThis !== 'undefined' ? globalThis : {};
export const sound = g[KEY] || (g[KEY] = createSwitch({ storage: browserStorage() }));
