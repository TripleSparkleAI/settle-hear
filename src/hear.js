// settle-hear · hear - a HEARING: one settle's sound. It reads the settle's stats and steers its voices.
//
// <claudes_code_comments>
// ** Function List **
// createHearing(opts)    - a hearing; returns the handle below. Works before the first gesture (it waits silently)
//   .update(stats)       - feed one stats frame from settle-see (onStats); sets every voice, fires events
//   .poke(strength)      - the pointer moved over the settle (0 .. 1); feeds the sparkle voice's held level
//   .held(level)         - set the held level directly (hear() reads it from the field)
//   .click(power, max)   - a click with this power (for hosts that do not report power in stats)
//   .playing / .play() / .stop() / .toggle()  - this hearing's own play/stop (not remembered)
//   .setLevel(v) / .level                     - this hearing's fader, 0 .. 1
//   .setPreset(spec) / .preset                - swap the mix; voices are rebuilt
//   .setMix(voice, v)    - one voice's mix level inside the preset; .mix reads them all
//   .setFx({ reverb, delay, filter }) - this hearing's reverb and delay sends and its lowpass; .fx reads them
//   .subscribe(fn)       - fn({ playing, audible, level, preset }) on change; returns off()
//   .dispose()           - stop and free every node
// hear(handle, opts)     - attach a hearing to a settle-see handle: polls handle.stats() and the field's held
//                          trail; returns the hearing (its dispose also stops the poll)
// activeHearings()       - how many hearings are alive (for tests and the mute button)
//
// ** Technical Review **
// - A hearing builds its nodes only once the page's engine exists (the first user gesture), via onEngine(). Until
//   then update() just keeps the latest params, so the first sound is already in step with the picture.
// - Events are derived from the stats stream, not from the renderer: phase changing to 'settled' fires the chime
//   chord; index changing fires a ping; power rising fires a click (with max when power reaches maxPower).
// - One shared scheduler (THE SOUND CLOCK, soundclock.js, every 60 ms) ticks every hearing's grain voices with a
//   120 ms look-ahead, only while sound is audible and PAUSE ALL is off. The clock is a worker's timer, so a hidden
//   tab's grains run as a visible one's (lane DJSILENCE); on the page-timer fallback (no Worker) a hidden tab takes a
//   1.5 s look-ahead, since its timers may fire once a second.
// - A hearing falls quiet when its stats stop for STALE_MS (the picture paused, scrolled off screen, or drawn still
//   under reduced motion) and returns with the next frame: sound follows a MOVING picture. When the PAGE halted the
//   picture (a hidden tab, an idle reader: engine pageHalted()) it holds its last sound instead (lane SOUNDDOCTOR).
// - Voices exist only while a hearing sounds: built on play (or when the engine arrives), freed 0.6 s after stop and
//   IDLE_MS after falling quiet, so a page of stopped settles runs no oscillators at all.
// - The pointer's held level decays by 0.82 per stats frame, so a trail fades as the field's hold does.
// - Every parameter goes through soundParams() (map.js) first, then is scaled by the voice's mix level.
// </claudes_code_comments>

import { soundParams, clamp01 } from './map.js';
import { resolvePreset } from './presets.js';
import { makeVoice } from './voices.js';
import { armUnlock, createChannel, onEngine, getEngine, isAway, pageHalted } from './engine.js';
import { heroBus, feedHeroInput } from './heroinput.js';
import { sound } from './control.js';
import { soundEvery, soundClockSteady } from './soundclock.js';
import { duckGain } from './duck.js';
import { soundLog, soundLogOn } from './soundlog.js'; // SOUNDLOG
let hearIds = 0; // SOUNDLOG

const live = new Set();
// a hearing whose stats stop for this long falls quiet (its picture is paused, off screen or drawn still) and
// comes back on the next stats frame, so the sound never describes a picture that is not moving
export const STALE_MS = 900;
// a quiet hearing keeps its voices this long (a short pause resumes at once), then frees them
export const IDLE_MS = 5000;
// the grain look-ahead in a hidden tab, where timers may be clamped to once a second
export const HIDDEN_AHEAD = 1.5;
let timer = null;

function scheduler() {
  if (timer) return;
  // THE SOUND CLOCK (lane DJSILENCE, soundclock.js): a worker's tick, so a hidden tab's grains run as a visible one's
  timer = soundEvery(60, () => {
    const E = getEngine();
    if (!E || !sound.audible || isAway()) return;
    const t0 = E.ctx.currentTime;
    const wall = Date.now();
    // a hidden tab's timer may fire once a second: schedule the grains past it (the background rule)
    const ahead = typeof document !== 'undefined' && document.hidden && !soundClockSteady() ? HIDDEN_AHEAD : 0.12;
    for (const h of live) {
      h._check(wall);
      h._tick(t0, t0 + ahead);
    }
  });
}

function unschedule() {
  if (live.size || !timer) return;
  timer.stop();
  timer = null;
}

export function activeHearings() {
  return live.size;
}

export function createHearing({ preset = 'crackle', level, lean = 0.9, pull = 0.3, hot, cold, playing = true } = {}) {
  let P = resolvePreset(preset);
  let presetName = typeof preset === 'string' ? preset : 'custom';
  let lvl = level ?? P.level;
  let on = !!playing;
  let ch = null;
  let dk = null;
  let voices = {};
  let last = soundParams(null, { lean, pull, hot, cold });
  let heldLevel = 0;
  let prev = null;
  let dead = false;
  let fresh = 0; // wall time of the last stats frame
  let quiet = false; // true while the stats have stopped (picture paused, off screen, or drawn still)
  const subs = new Set();
  const snap = () => ({ playing: on, audible: on && sound.audible, level: lvl, preset: presetName });
  const emit = () => { for (const fn of subs) fn(snap()); };
  const offSwitch = sound.subscribe(emit);

  const now = () => getEngine()?.ctx.currentTime ?? 0;
  const params = (name) => ({ ...last, held: heldLevel, level: clamp01(P.voices[name] ?? 0) });

  const hid = ++hearIds; // SOUNDLOG
  const disposeVoices = () => {
    if (soundLogOn() && Object.keys(voices).length) soundLog('hear:voices:free', { id: hid, preset: presetName, voices: Object.keys(voices).join(',') }); // SOUNDLOG
    for (const v of Object.values(voices)) v.dispose();
    voices = {};
  };
  const buildVoices = () => {
    disposeVoices();
    if (!ch) return;
    const { ctx } = getEngine();
    if (soundLogOn()) soundLog('hear:voices:build', { id: hid, preset: presetName, voices: Object.keys(P.voices).join(',') }); // SOUNDLOG
    for (const name of Object.keys(P.voices)) {
      try {
        voices[name] = makeVoice(name, ctx, ch.input);
        voices[name].update(params(name), ctx.currentTime);
      } catch { /* a voice that cannot build stays silent */ }
    }
  };
  // voices exist only while the hearing sounds: a stopped one frees them after its fade, a quiet one after IDLE_MS
  let teardown = null;
  const apply = (idleMs = 600) => {
    if (!ch) return;
    const sounding = on && !quiet;
    if (soundLogOn()) soundLog('hear:apply', { id: hid, preset: presetName, on, quiet, sounding, level: lvl }); // SOUNDLOG
    ch.setPlaying(sounding);
    clearTimeout(teardown);
    teardown = null;
    if (sounding) {
      if (!Object.keys(voices).length) buildVoices();
    } else if (Object.keys(voices).length) {
      teardown = setTimeout(() => { if (!(on && !quiet)) disposeVoices(); }, idleMs);
      teardown.unref?.();
    }
  };

  const offEngine = onEngine((E) => {
    if (dead) return;
    // THE MIX'S DUCK (lane DJSILENCE, duck.js): a drag-box drop dips the picture's static under the drop
    dk = duckGain(E.ctx, 'static');
    ch = createChannel(E, { level: lvl, ...P.fx, insert: dk.node });
    // a copy of the picture's sound, before its fader, into the 'picture' tap: the vocoder's modulator
    try { ch.input.connect(heroBus(E)); } catch { /* a context without the bus */ }
    apply();
    emit();
  });
  armUnlock();

  const h = {
    update(stats) {
      if (dead || !stats) return;
      fresh = Date.now();
      if (quiet) { quiet = false; apply(); }
      last = soundParams(stats, { lean, pull, hot, cold });
      feedHeroInput(last); // THE HERO INPUT: every audio mode reads these numbers (heroinput.js)
      heldLevel *= 0.82;
      const t = now();
      for (const [name, v] of Object.entries(voices)) v.update(params(name), t);
      if (prev) {
        if (stats.phase === 'settled' && prev.phase !== 'settled') h._event('settled', {});
        if (stats.index !== prev.index && prev.index != null && prev.index >= 0) h._event('target', {});
        if ((stats.power ?? 0) > (prev.power ?? 0)) h._event('click', { power: stats.power, max: stats.power >= (stats.maxPower ?? 8) });
      }
      prev = { phase: stats.phase, index: stats.index, power: stats.power ?? 0 };
    },
    poke(strength = 0.35) {
      heldLevel = clamp01(heldLevel + clamp01(strength));
    },
    held(level) {
      heldLevel = clamp01(level);
    },
    click(power = 1, max = 8) {
      h._event('click', { power, max: power >= max });
    },
    _event(kind, d) {
      if (!on || quiet || !sound.audible) return;
      const t = now() + 0.01;
      for (const v of Object.values(voices)) v.event(kind, d, t);
    },
    _check(wall) {
      if (!quiet && fresh && wall - fresh > STALE_MS && soundLogOn()) soundLog('hear:quiet', { id: hid, preset: presetName, staleMs: wall - fresh, hidden: typeof document !== 'undefined' && document.hidden }); // SOUNDLOG
      // the page halted the picture (a hidden tab, an idle reader): the static holds its last sound, like a video
      if (pageHalted()) { if (fresh) fresh = wall; return; }
      if (!quiet && fresh && wall - fresh > STALE_MS) { quiet = true; apply(IDLE_MS); }
    },
    _tick(t0, t1) {
      if (!on || quiet) return;
      for (const v of Object.values(voices)) v.tick(t0, t1);
    },
    get playing() { return on; },
    play() { on = true; apply(); emit(); },
    stop() { on = false; apply(); emit(); },
    toggle() { if (on) h.stop(); else h.play(); return on; },
    get level() { return lvl; },
    setLevel(v) { lvl = clamp01(v); ch?.setLevel(lvl); emit(); },
    get preset() { return presetName; },
    setPreset(spec) {
      P = resolvePreset(spec);
      presetName = typeof spec === 'string' ? spec : 'custom';
      if (level == null) { lvl = P.level; ch?.setLevel(lvl); }
      ch?.setSends(P.fx);
      if (on && !quiet) buildVoices();
      else disposeVoices();
      emit();
    },
    setMix(name, v) {
      P.voices[name] = clamp01(v);
      if (!voices[name] && ch && on && !quiet) {
        try { voices[name] = makeVoice(name, getEngine().ctx, ch.input); } catch { /* unknown voice */ }
      }
      voices[name]?.update(params(name), now());
    },
    get mix() { return { ...P.voices }; },
    get fx() { return { ...P.fx }; },
    setFx(fx = {}) {
      P.fx = { ...P.fx, ...fx };
      ch?.setSends(fx);
    },
    get state() { return snap(); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    dispose() {
      if (soundLogOn()) soundLog('hear:dispose', { id: hid, preset: presetName, dead }); // SOUNDLOG
      if (dead) return;
      dead = true;
      live.delete(h);
      unschedule();
      offEngine();
      offSwitch();
      clearTimeout(teardown);
      disposeVoices();
      ch?.dispose();
      ch = null;
      dk?.off();
      dk = null;
      subs.clear();
    },
  };
  live.add(h);
  scheduler();
  if (soundLogOn()) soundLog('hear:create', { id: hid, preset: presetName, playing: on, level: lvl }); // SOUNDLOG
  return h;
}

// attach to a settle-see handle (the vanilla API): no React, no onStats wiring needed
export function hear(handle, opts = {}) {
  const h = createHearing(opts);
  let lastSweeps = -1;
  const poll = setInterval(() => {
    const s = handle?.stats?.();
    if (!s || s.sweeps === lastSweeps) return;
    lastSweeps = s.sweeps;
    const F = handle.field;
    if (F?.held) {
      let sum = 0;
      for (let i = 0; i < F.held.length; i++) sum += F.held[i];
      h.held(Math.min(1, (sum / F.held.length) * 40));
    }
    h.update(s);
  }, opts.every ?? 160);
  poll.unref?.();
  const dispose = h.dispose;
  h.dispose = () => { clearInterval(poll); dispose(); };
  return h;
}
