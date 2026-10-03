// A fake browser for THE START RULE (lane AUTOSTART): an AudioContext that runs only while the browser allows it
// (an autoplay permission, or inside a user activation), the way Chrome treats one. A refused resume() stays pending,
// as Chrome's does. `gesture(type, { activates })` dispatches one window event inside (or outside) a user activation.
import { Ctx } from './fakeaudio.mjs';

export const browser = { allowed: false, active: false, made: 0, resumes: 0, runs: 0 };

export class GatedCtx extends Ctx {
  constructor() {
    super();
    browser.made += 1;
    this.listeners = new Set();
    if (browser.allowed) this.state = 'running';
  }
  addEventListener(type, fn) { if (type === 'statechange') this.listeners.add(fn); }
  set(state) {
    if (this.state === state) return;
    this.state = state;
    if (state === 'running') browser.runs += 1;
    for (const fn of this.listeners) fn();
  }
  resume() {
    browser.resumes += 1;
    if (browser.allowed || browser.active) { this.set('running'); return Promise.resolve(); }
    return new Promise(() => {});
  }
  suspend() { this.set('suspended'); return Promise.resolve(); }
}

export function installWindow({ muted = null } = {}) {
  const store = new Map(muted == null ? [] : [['settle-hear:muted', muted ? '1' : '0']]);
  const win = new EventTarget();
  win.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  globalThis.window = win;
  return { win, store };
}

export function gesture(type, { activates = true, key } = {}) {
  browser.active = activates;
  const ev = new Event(type);
  if (key) Object.defineProperty(ev, 'key', { value: key });
  try { window.dispatchEvent(ev); } finally { browser.active = false; }
}

export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
