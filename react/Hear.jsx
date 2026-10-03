// settle-hear/react · Hear - the React face of settle-hear: a hook, a drop-in sounding <Settle>, and the controls.
//
// <claudes_code_comments>
// ** Function List **
// useSound()                      - the page-wide switch as React state: { muted, unlocked, blocked, setMuted, toggle }
// useHear(preset, opts)           - one hearing for a component: { hearing, state, onStats, onPointerMove, toggle }
// SpeakerIcon({ state, size })    - the neon speaker: waves when playing, a cross when stopped, a slash when muted
// HearToggle({ hear, label, words }) - a settle's own play/stop button, neon, with aria-pressed and a plain label;
//                                   `words` translates it (TOGGLE_WORDS holds the English)
// MuteAllButton({ pulse, labels, id, shortcut }) - the site-wide MUTE ALL button for a page header; `pulse` makes it
//                                   beat; `labels` translates it; `id` (default hear-muteall) lets a skip link reach
//                                   it; `shortcut` (a key, such as "M") goes into aria-keyshortcuts and the tooltip;
//                                   while the browser holds the sound back (the switch's `blocked`) it pulses red,
//                                   shows "sound waits for your first click" on hover and focus, and says it once
//                                   to a screen reader (lane AUTOSTART)
// (a11y.js) percentText / hertzText / muteAllTitle - a slider's spoken value with its unit ("80 percent",
//                                   "12000 hertz") and MUTE ALL's tooltip with its key (lane A11YSOUND)
// HearSettle(props)               - <Settle> from settle-see with sound: hear="crackle" picks the preset; every
//                                   other prop goes to <Settle>; hearControl places the play/stop button
//                                   (bottom-right, top-left, ... or false); hearLevel, hearLabel; hearPlaying +
//                                   onHearToggle(next) make it controlled
// HearMixer({ hear, units })      - a small mixer for one hearing: fader, one slider per voice, reverb, delay, tone;
//                                   every slider speaks its value with its unit (units.percent, units.hertz)
// MasterFader({ label, units })   - the page's master level, spoken as a percent
// useGammaSound({ enabled, mode, carrier, level }) - a 40 Hz gamma sound (binaural.js) alive while enabled; returns
//                                   its state ({ mode, carrier, level, playing, pair }); props steer it live
//
// ** Technical Review **
// - settle-see never imports settle-hear. This file imports settle-see/react for HearSettle only; useHear works
//   with any component that can call onStats(stats) and forward pointer moves, so a hand-made canvas can sound too.
// - THE START RULE (engine.js, lane AUTOSTART): the sound tries to start on page load; the browser decides. When it
//   refuses, the switch is `blocked` and the first pointerdown, key or tap anywhere starts it. Sound ON is the
//   default preference; MUTE ALL is the one remembered choice, and a muted page is never shown as waiting.
// - Under prefers-reduced-motion a hearing starts stopped (its picture is still); its button can start it.
// - Pressing a settle's play button while the whole site is muted unmutes the site: the press says "I want to hear
//   this", and a button that did nothing would be a lie.
// - Colours come from CSS variables (--hear-on, --hear-off, --hear-mute), which default to the site's neon tokens.
// - ACCESSIBILITY (lane A11YSOUND, navigator 2026-10-04: "all the sound things importantly work with the keyboard and
//   are clearly labelled"): every control is a real button or range input; a slider's aria-valuetext carries its unit;
//   MUTE ALL keeps one fixed name ("Mute all sound") and says its state through aria-pressed, so a screen reader hears
//   "Mute all sound, toggle button, pressed" when muted; the toggle's words can be translated by the page.
// </claudes_code_comments>

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Settle } from 'settle-see/react';
import { createHearing, sound, VOICES, VOICE_NOTES, setMaster, getMaster, createGammaSound } from '../src/index.js';
import { muteAllPulseClass } from './muteall.js';
import { percentText, hertzText, muteAllTitle } from './a11y.js';
import './hear.css';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const keyOf = (v) => (typeof v === 'string' ? v : JSON.stringify(v));

export function useSound() {
  const [s, set] = useState({ muted: sound.muted, unlocked: sound.unlocked, blocked: sound.blocked });
  useEffect(() => sound.subscribe(set), []);
  return { ...s, setMuted: (m) => sound.setMuted(m), toggle: () => sound.toggle() };
}

export function useHear(preset = 'crackle', { level, lean, pull, hot, cold, enabled = true, playing, onToggle } = {}) {
  const hearing = useRef(null);
  const [state, setState] = useState({ playing: false, audible: false, level: 0, preset: typeof preset === 'string' ? preset : 'custom' });
  const pk = keyOf(preset);
  useEffect(() => {
    if (!enabled || !preset) return undefined;
    const h = createHearing({ preset, level, lean, pull, hot, cold, playing: playing ?? !reduced() });
    hearing.current = h;
    setState(h.state);
    const off = h.subscribe(setState);
    return () => { off(); h.dispose(); if (hearing.current === h) hearing.current = null; };
  }, [enabled, pk]);
  useEffect(() => { if (level != null) hearing.current?.setLevel(level); }, [level]);
  // `playing` given with `onToggle` makes the hearing controlled (a page can keep one card sounding at a time)
  useEffect(() => {
    if (playing == null || !hearing.current) return;
    if (playing) hearing.current.play();
    else hearing.current.stop();
  }, [playing]);
  const toggleRef = useRef(onToggle);
  toggleRef.current = onToggle;
  const onStats = useCallback((s) => hearing.current?.update(s), []);
  const onPointerMove = useCallback(() => hearing.current?.poke(0.3), []);
  const toggle = useCallback(() => {
    const h = hearing.current;
    if (!h) return;
    const next = sound.muted ? true : !h.playing;
    if (sound.muted) sound.setMuted(false);
    if (toggleRef.current) toggleRef.current(next);
    else if (next) h.play();
    else h.stop();
  }, []);
  return { hearing, state, onStats, onPointerMove, toggle };
}

export function SpeakerIcon({ state = 'on', size = 18 }) {
  return (
    <svg className={`hear-icon hear-icon--${state}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path className="hear-icon__body" d="M3 9.5h3.5L11 5.5v13l-4.5-4H3z" />
      {state === 'on' && (
        <>
          <path className="hear-icon__wave hear-icon__wave--1" d="M14.5 9.2a4 4 0 0 1 0 5.6" />
          <path className="hear-icon__wave hear-icon__wave--2" d="M17 6.8a7.4 7.4 0 0 1 0 10.4" />
          <path className="hear-icon__wave hear-icon__wave--3" d="M19.5 4.4a10.8 10.8 0 0 1 0 15.2" />
        </>
      )}
      {state === 'off' && <path className="hear-icon__cross" d="M15 9.5l5 5M20 9.5l-5 5" />}
      {state === 'muted' && <path className="hear-icon__slash" d="M3.5 3.5l17 17" />}
      {state === 'waiting' && (
        <>
          <circle className="hear-icon__dot" cx="15.5" cy="12" r="1.1" />
          <circle className="hear-icon__dot" cx="18.5" cy="12" r="1.1" />
          <circle className="hear-icon__dot" cx="21.5" cy="12" r="1.1" />
        </>
      )}
    </svg>
  );
}

// the toggle's words in English; a translated page passes its own `words` (any left out keep these)
export const TOGGLE_WORDS = {
  name: (label) => `Sound of ${label}`,
  titleMuted: (label) => `Sound is muted for the whole site. Press to unmute and hear ${label}.`,
  titlePlay: (label) => `Play the sound of ${label}.`,
  titleWaiting: (label) => `The sound of ${label} starts on your first click or key press. Press to stop it.`,
  titleStop: (label) => `Stop the sound of ${label}.`,
  muted: 'muted',
  sound: 'sound',
  play: 'play sound',
};

export function HearToggle({ hear, label = 'this picture', words = null, className = '', style }) {
  const { muted, unlocked } = useSound();
  const { state, toggle } = hear;
  const W = { ...TOGGLE_WORDS, ...(words || {}) };
  const playing = state.playing;
  const icon = muted ? 'muted' : !playing ? 'off' : !unlocked ? 'waiting' : 'on';
  const title = muted ? W.titleMuted(label) : !playing ? W.titlePlay(label) : !unlocked ? W.titleWaiting(label) : W.titleStop(label);
  return (
    <button
      type="button"
      className={`hear-toggle hear-toggle--${icon} ${className}`}
      style={style}
      onClick={toggle}
      aria-pressed={playing && !muted}
      aria-label={W.name(label)}
      title={title}
    >
      <SpeakerIcon state={icon} size={16} />
      <span className="hear-toggle__text">{muted ? W.muted : playing ? W.sound : W.play}</span>
    </button>
  );
}

// labels (optional, for a translated site): { sound, muted, aria, titleMuted, titleOn, titleWaiting }; any left out
// keep the English below
export const MUTE_ALL_LABELS = {
  sound: 'SOUND',
  muted: 'MUTED',
  aria: 'Mute all sound',
  titleMuted: 'All sound is muted. Press to turn sound back on. This choice is remembered.',
  titleOn: 'Sound is on. Press to mute all sound on the site. This choice is remembered.',
  titleWaiting: 'Sound is on and starts on your first click or key press. Press to mute all sound. This choice is remembered.',
  titleBlocked: 'Your browser holds the sound until your first click or key press anywhere on the page. Press here to mute all sound instead. This choice is remembered.',
  tipBlocked: 'sound waits for your first click',
  liveBlocked: 'Sound waits for your first click or key press.',
  // appended to the tooltip when the page gives a shortcut key ({key} is the key)
  keyHint: 'Key: {key}.',
};

// the blocked line is spoken once per visit, however many times the button mounts
let blockedSaid = false;

export function MuteAllButton({ pulse = false, className = '', labels = null, id = 'hear-muteall', shortcut = null }) {
  const { muted, unlocked, blocked, toggle } = useSound();
  const L = { ...MUTE_ALL_LABELS, ...(labels || {}) };
  const icon = muted ? 'muted' : unlocked ? 'on' : 'waiting';
  const waits = !muted && !unlocked && blocked;
  const base = muted ? L.titleMuted : unlocked ? L.titleOn : waits ? L.titleBlocked : L.titleWaiting;
  const title = muteAllTitle(base, shortcut, L.keyHint);
  const [said, setSaid] = useState('');
  useEffect(() => {
    if (!waits) { setSaid(''); return undefined; }
    if (blockedSaid) return undefined;
    blockedSaid = true;
    // a beat after mount, so a screen reader hears the change rather than missing a region born full
    const id = setTimeout(() => setSaid(L.liveBlocked), 400);
    return () => clearTimeout(id);
  }, [waits]);
  return (
    <>
      <button
        id={id}
        type="button"
        className={`hear-muteall hear-muteall--${icon}${muteAllPulseClass({ muted, unlocked, blocked, pulse })} ${className}`}
        onClick={toggle}
        aria-pressed={muted}
        aria-label={L.aria}
        aria-keyshortcuts={shortcut || undefined}
        aria-describedby={waits ? 'hear-muteall-wait' : undefined}
        title={title}
        data-tip={waits ? L.tipBlocked : undefined}
      >
        {waits && <span className="hear-muteall__halo" aria-hidden="true" />}
        <SpeakerIcon state={icon} size={18} />
        <span className="hear-muteall__text">{muted ? L.muted : L.sound}</span>
      </button>
      {waits && <span id="hear-muteall-wait" className="hear-sr">{L.tipBlocked}</span>}
      <span className="hear-sr" aria-live="polite">{said}</span>
    </>
  );
}

export function HearSettle({ hear = 'crackle', hearLevel, hearLabel, hearWords = null, hearControl = 'bottom-right', hearPlaying, onHearToggle, onStats, children, ...props }) {
  const H = useHear(hear, { level: hearLevel, lean: props.lean, pull: props.pull, enabled: !!hear, playing: hearPlaying, onToggle: onHearToggle });
  const stats = useCallback((s) => { H.onStats(s); onStats?.(s); }, [onStats]);
  const what = hearLabel ?? (props.word ? `the word ${props.word}` : props.shape ? `the ${props.shape}` : 'this picture');
  const pos = hearControl && hearControl !== true ? hearControl : 'bottom-right';
  return (
    <div className="hear-settle" style={{ display: 'contents' }} onPointerMove={H.onPointerMove}>
      <Settle {...props} onStats={stats}>
        {children}
        {hear && hearControl !== false && <HearToggle hear={H} label={what} words={hearWords} className={`hear-toggle--at hear-toggle--${pos}`} />}
      </Settle>
    </div>
  );
}

// a slider's spoken value with its unit: a 0..1 level is a percent, the tone a frequency (lane A11YSOUND, a11y.js)
const UNITS = { percent: percentText, hertz: hertzText };

export function HearMixer({ hear, voices = VOICES, units = null }) {
  const U = { ...UNITS, ...(units || {}) };
  const h = hear.hearing.current;
  const [, bump] = useState(0);
  const [fx, setFx] = useState({ reverb: 0.3, delay: 0.1, filter: 9000 });
  const [mix, setMix] = useState({});
  useEffect(() => {
    const cur = hear.hearing.current;
    if (!cur) return;
    setMix(cur.mix);
    setFx(cur.fx);
  }, [hear.state.preset, !!h]);
  if (!h) return null;
  const row = (name, value, onChange, note, max = 1, step = 0.01) => (
    <label className="hear-mixer__row" key={name} title={note}>
      <span className="hear-mixer__name">{name}</span>
      <input type="range" min={0} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} aria-label={`${name} level`} aria-valuetext={max > 1 ? U.hertz(value) : U.percent(value)} />
      <span className="hear-mixer__val">{max > 1 ? `${Math.round(value)} Hz` : value.toFixed(2)}</span>
    </label>
  );
  return (
    <div className="hear-mixer" role="group" aria-label="sound mixer">
      {row('fader', hear.state.level, (v) => { h.setLevel(v); bump((x) => x + 1); }, 'this settle\'s level')}
      {voices.map((v) => row(v, mix[v] ?? 0, (x) => { h.setMix(v, x); setMix((m) => ({ ...m, [v]: x })); }, VOICE_NOTES[v]))}
      {row('reverb', fx.reverb, (x) => { h.setFx({ reverb: x }); setFx((f) => ({ ...f, reverb: x })); }, 'send to the shared hall')}
      {row('delay', fx.delay, (x) => { h.setFx({ delay: x }); setFx((f) => ({ ...f, delay: x })); }, 'send to the shared echo')}
      {row('tone', fx.filter, (x) => { h.setFx({ filter: x }); setFx((f) => ({ ...f, filter: x })); }, 'a lowpass on this channel', 12000, 50)}
    </div>
  );
}

export function MasterFader({ label = 'master level', units = null }) {
  const U = { ...UNITS, ...(units || {}) };
  const [v, set] = useState(getMaster());
  return (
    <label className="hear-mixer__row hear-mixer__row--master">
      <span className="hear-mixer__name">master</span>
      <input type="range" min={0} max={1} step={0.01} value={v} onChange={(e) => { set(+e.target.value); setMaster(+e.target.value); }} aria-label={label} aria-valuetext={U.percent(v)} />
      <span className="hear-mixer__val">{v.toFixed(2)}</span>
    </label>
  );
}

export function useGammaSound({ enabled = false, mode = 'binaural', carrier = '200', level = 0.5, fade } = {}) {
  const g = useRef(null);
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    const h = createGammaSound({ mode, carrier, level });
    g.current = h;
    setState(h.state);
    const off = h.subscribe(setState);
    return () => { off(); h.dispose(); if (g.current === h) g.current = null; setState(null); };
  }, [enabled]);
  useEffect(() => { g.current?.setMode(mode, fade > 0 ? { fade } : undefined); }, [mode]);
  useEffect(() => { g.current?.setCarrier(carrier); }, [carrier]);
  useEffect(() => { g.current?.setLevel(level); }, [level]);
  return state;
}
