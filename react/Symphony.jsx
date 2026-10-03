// settle-hear/react · Symphony - the hero symphony for React: a hook, and HeroSymphony, the one-line mount that plays
// the sound and draws THE DJ's visualiser (a mini panel bottom left, a larger view on click, hidden toggles inside).
//
// <claudes_code_comments>
// ** Function List **
// useSymphony(opts)           - one symphony for a component: { symphony, state }; disposed on unmount
// useHouseLive()             - settle-hear's houseLive store as React state: { house, audible, chain }
// HeroSymphony's big view is a popup (djPopupStep, src/popup.js): outside pointerdown, Escape, the x, closeWhen
// HouseChain({ house })       - THE HOUSE SET in the DJ view: the passes playing now, each with its plain line
// VoicesPanel({ voices })     - THE VOICES (lane MELODYFX): each melodic part's instrument and its chain this set
// HeroSymphony(props)         - the one-line mount: stats (the picture's onStats object), playing (the hero's own
//                               sound button; omit and it plays), level, seed, theme, tracks (track toggles at
//                               creation, e.g. the flute alone), style, className, line (the
//                               mini as ONE strip: theme, Hz, the six lights, mode, tune; the same view on click)
// DJLights({ decision, size, animate }) - the six yes/no lights, each settling through the bar's sweeps
// SettleTrace({ decision, animate })    - the bar's anneal as a grid: one row per choice, one column per sweep
// HarmonicBars({ n, root, minor })      - partials 1..7 of the drone root, the sounding ones lit
// MelodyStrip({ recent })               - the last notes the flute played, as a little piano roll
// WhyList({ lean })                     - the parts of one light's lean, biggest first
// Toggles({ s, state })                 - the hidden controls: tracks, theme, lock theme, hold 40 Hz, clamps, tune, level
// MixPanel({ mix, tag })                - THE HOUSE DJ (lane SETTLEDJ): the planner's arc and top plans with their scores,
//                                         the mix machine's eleven choices with their leans, the composer's tune (sources,
//                                         books, seed, ABC, the copy check), the rack's amounts, the tag
// lineTune(state)                       - the DJ line's tune words: pure names the tune and its book; the opener
//                                         names its slot and its time (lane OPENINGSET)
// OpenerPanel({ opener })               - THE OPENING BLEND in the big view: the arc, the slot now, the settled details
//
// ** Technical Review **
// - Sound rules are the library's: nothing before the first click or key press, MUTE ALL silences it, a hidden tab
//   suspends it. Under prefers-reduced-motion the symphony starts stopped (like every hearing) and the trace is
//   drawn whole rather than revealed.
// - The visualiser re-renders on each bar (the symphony emits once a bar, about every 2 to 4 s) and, while the view
//   is open, runs one requestAnimationFrame loop for about 1.2 s to reveal the bar's sweeps. Nothing flickers: a
//   light changes at most once a sweep reveal (about 20 a second for 1.2 s, as a left-to-right wipe, not a flash),
//   and the mini lights change once a bar.
// - Colours: the panel is chrome (red light: --ink, --prime, the near-black ground); the DJ's lights are a SETTLE
//   picture and wear the neon code (--neon-yes lit, --neon-no unlit, --neon-lean for leans, --neon-pull for pulls,
//   each theme in its own neon).
// </claudes_code_comments>

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createSymphony, TRACKS, MINOR_MODES, rootMidiOf } from '../src/symphony.js';
import { DJ_CHOICES, DJ_PULLS } from '../src/dj.js';
import { THEMES } from '../src/themes.js';
import { FLUTE_MODE_NAME, FLUTE_MODE_ALIAS, midiHz } from '../src/tuning.js';
import { houseLive } from '../src/spectrumlive.js';
import { PASSES, HOUSE } from '../src/house.js';
import { MIX_CHOICES, MIX_PULLS } from '../src/mix-machine.js';
import { sectionOf, SECTIONS } from '../src/mix-planner.js';
import { djPopupStep, djInside, djRoom, djHeadline, traceColumns } from '../src/popup.js';
import './symphony.css';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (m) => (m == null ? 'rest' : `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`);
const hz = (f) => (f >= 100 ? f.toFixed(1) : f.toFixed(2));

// the influence window lives across visits in this browser's storage when it can (dj-influence.js; guarded)
const influenceStore = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };

// opener (true by default here, lane OPENINGSET): the visit's first set is THE OPENING BLEND; false yields it
export function useSymphony({ seed, theme, level, playing, tracks, house, pure, opener = true, bases = null } = {}) {
  const ref = useRef(null);
  const [state, setState] = useState(null);
  useEffect(() => {
    const s = createSymphony({ seed, theme, level, tracks, house: !!house, pure: !!pure, opener: opener !== false, influenceStorage: influenceStore(), playing: playing ?? !reduced(), bases: bases ?? null });
    ref.current = s;
    setState(s.state);
    const off = s.subscribe(setState);
    return () => { off(); s.dispose(); if (ref.current === s) ref.current = null; };
  }, []);
  useEffect(() => {
    if (playing == null || !ref.current) return;
    if (playing) ref.current.play();
    else ref.current.stop();
  }, [playing]);
  useEffect(() => { if (level != null) ref.current?.setLevel(level); }, [level]);
  useEffect(() => { if (house != null) ref.current?.setHouse(house); }, [house]);
  useEffect(() => { if (pure != null) ref.current?.setPure(pure); }, [pure]);
  // a page that stops wanting the opener (the visitor picked a sound) yields it at once
  useEffect(() => { if (opener === false) ref.current?.yieldOpener?.('a sound pick'); }, [opener]);
  return { symphony: ref, state };
}

function useReveal(decision, active) {
  const [k, setK] = useState(999);
  useEffect(() => {
    if (!decision || !active || reduced()) { setK(999); return undefined; }
    const t0 = performance.now();
    let id = 0;
    const step = () => {
      const f = Math.min(1, (performance.now() - t0) / 1200);
      setK(Math.ceil(f * decision.trace.length));
      if (f < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [decision, active]);
  return k;
}

export function DJLights({ decision, size = 12, reveal = 999 }) {
  const tr = decision?.trace ?? [];
  const w = tr[Math.min(tr.length, reveal) - 1];
  return (
    <span className="dj-lights" role="img" aria-label={decision ? DJ_CHOICES.map((c) => `${c.label} ${decision.yes[c.key] ? 'yes' : 'no'}`).join(', ') : 'the DJ has not decided yet'}>
      {DJ_CHOICES.map((c, i) => {
        const on = w ? w.s[i] > 0 : !!decision?.yes[c.key];
        const held = decision?.clamps?.[c.key] != null;
        return (
          <span key={c.key} className={`dj-light${on ? ' is-yes' : ''}${held ? ' is-held' : ''}`} style={{ width: size, height: size }} title={`${c.label}: ${c.question} ${on ? 'yes' : 'no'}`}>
            <span className="dj-light__k">{c.short}</span>
          </span>
        );
      })}
    </span>
  );
}

export function SettleTrace({ decision, reveal = 999 }) {
  if (!decision) return null;
  const tr = decision.trace;
  return (
    <div className="dj-trace" role="img" aria-label={`the bar's settle: ${tr.length} sweeps, cooling from temperature ${tr[0]?.T.toFixed(2)} to ${tr[tr.length - 1]?.T.toFixed(2)}`}>
      {DJ_CHOICES.map((c, i) => (
        <div key={c.key} className="dj-trace__row">
          <span className="dj-trace__name">{c.label}</span>
          <span className="dj-trace__cells" style={{ gridTemplateColumns: traceColumns(tr.length) }}>
            {tr.map((w, j) => (
              <span key={j} className={`dj-trace__cell${j < reveal ? (w.s[i] > 0 ? ' is-yes' : ' is-no') : ''}`} />
            ))}
          </span>
          <span className="dj-trace__p mono">{Math.round(decision.pYes[c.key] * 100)}%</span>
        </div>
      ))}
      <div className="dj-trace__axis mono">{reveal < tr.length ? `sweep ${Math.max(1, reveal)} of ${tr.length}, settling` : `${tr.length} sweeps, T ${tr[0]?.T.toFixed(2)} → ${tr[tr.length - 1]?.T.toFixed(2)}`}</div>
    </div>
  );
}

export function HarmonicBars({ n = 0, root = 108, minor = false }) {
  return (
    <span className="dj-harm" role="img" aria-label={`${n > 1 ? n : 'no'} harmonics of ${hz(root)} Hz`}>
      {[1, 2, 3, 4, 5, 6, 7].map((k) => {
        const lit = n > 1 && k <= n && !(minor && k === 5);
        return (
          <span key={k} className={`dj-harm__bar${lit ? ' is-on' : ''}`} style={{ height: `${30 + 70 / k}%` }} title={`partial ${k}: ${hz(root * k)} Hz${minor && k === 5 ? ' (left out: a minor theme)' : ''}`}>
            <i>{k}</i>
          </span>
        );
      })}
    </span>
  );
}

export function MelodyStrip({ recent = [] }) {
  const notes = recent.filter((r) => r.midi != null).slice(-16);
  if (!notes.length) return <span className="dj-strip dj-strip--empty">the flute is resting</span>;
  const lo = Math.min(...notes.map((r) => r.midi));
  const hi = Math.max(...notes.map((r) => r.midi));
  return (
    <span className="dj-strip" role="img" aria-label={`the last notes: ${notes.map((r) => noteName(r.midi)).join(' ')}`}>
      {notes.map((r, i) => (
        <span key={i} className="dj-strip__note" style={{ flexGrow: r.beats }} title={`${noteName(r.midi)} ${hz(midiHz(r.midi))} Hz`}>
          <i style={{ bottom: `${hi === lo ? 40 : ((r.midi - lo) / (hi - lo)) * 80}%` }} />
        </span>
      ))}
    </span>
  );
}

export function WhyList({ lean }) {
  // THE STEERING (lane RATELOOK): the visitor's own lean, the part named 'you', is always shown and marked
  const all = [...(lean?.parts ?? [])];
  const you = all.find((p) => p.why === 'you');
  const parts = all.filter((p) => p.why !== 'you').sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, you ? 3 : 4);
  if (you) parts.unshift(you);
  return (
    <span className="dj-why">
      {parts.map((p) => (
        <span key={p.why} className={`${p.v > 0 ? 'is-up' : 'is-down'}${p.why === 'you' ? ' is-you' : ''}`}>{p.why} {p.v > 0 ? '+' : ''}{p.v.toFixed(1)}</span>
      ))}
    </span>
  );
}

function Seg({ value, options, onChange, label }) {
  return (
    <span className="dj-seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value === v} className={value === v ? 'is-on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </span>
  );
}

function Toggles({ s, state }) {
  const S = s.current;
  if (!S || !state) return null;
  return (
    <details className="dj-toggles">
      <summary>tracks and controls</summary>
      <div className="dj-toggles__grid">
        <span className="dj-k">tracks</span>
        <span className="dj-checks">
          {TRACKS.map((t) => (
            <label key={t}><input type="checkbox" checked={state.tracks[t]} onChange={(e) => S.setTrack(t, e.target.checked)} /> {t}</label>
          ))}
        </span>
        <span className="dj-k">theme</span>
        <Seg label="theme" value={state.theme.key} options={THEMES.map((t) => [t.key, t.label])} onChange={(k) => S.setTheme(k)} />
        <span className="dj-k">hold</span>
        <span className="dj-checks">
          <label><input type="checkbox" checked={state.themeLocked} onChange={(e) => S.lockTheme(e.target.checked)} /> lock the theme</label>
          <label><input type="checkbox" checked={state.beatHeld} onChange={(e) => S.holdBeat(e.target.checked)} /> hold the beat at 40 Hz</label>
        </span>
        {DJ_CHOICES.map((c) => (
          <React.Fragment key={c.key}>
            <span className="dj-k">{c.label.toLowerCase()}</span>
            <Seg label={`${c.label}: the DJ decides, or held yes or no`} value={state.clamps[c.key]} options={[[null, 'DJ'], [true, 'yes'], [false, 'no']]} onChange={(v) => S.clamp(c.key, v)} />
          </React.Fragment>
        ))}
        <span className="dj-k">tune</span>
        <span className="dj-checks">
          <button type="button" className="dj-btn" onClick={() => S.nextTune()}>next tune</button>
          <button type="button" className="dj-btn" onClick={() => S.toggle()} aria-pressed={state.playing}>{state.playing ? 'stop the symphony' : 'play the symphony'}</button>
        </span>
        <span className="dj-k">level</span>
        <input type="range" min={0} max={1} step={0.01} value={state.level} onChange={(e) => S.setLevel(+e.target.value)} aria-label="symphony level" />
      </div>
    </details>
  );
}

export function useHouseLive() {
  const [st, set] = useState(() => houseLive.get());
  useEffect(() => houseLive.subscribe(set), []);
  return st;
}

// THE HOUSE DJ (lane SETTLEDJ): the planner's arc and plan, the mix machine's eleven choices with their leans, the
// composer's tune with its sources and ABC, the rack and its amounts, the tag
export function MixPanel({ mix, tag }) {
  if (!mix) return null;
  const P = mix.plan;
  return (
    <>
      <section className="dj-sec dj-mix">
        <h3>THE PLANNER · {mix.sectionLabel} · BAR {mix.setBar} OF SET {mix.set + 1}</h3>
        <p className="dj-dim">Every four bars the planner scores {P ? P.count : 'each'} plans of the next sixteen bars against the set's energy arc, the theme, the picture, your steering and the votes, with a habit prior that keeps changes on 8 and 16 bar lines, and settles one, cooling like the lights do.</p>
        <div className="dj-arc" role="img" aria-label={`the arc: ${SECTIONS.map((x) => x.label).join(', ')}; now ${mix.sectionLabel}`}>
          {SECTIONS.map((x) => <span key={x.key} className={`dj-arc__s${x.key === mix.section ? ' is-on' : ''}${x.key === mix.next && mix.next !== mix.section ? ' is-next' : ''}`}>{x.label}</span>)}
        </div>
        {P && (
          <ol className="dj-plans">
            {P.top.map((x, i) => (
              <li key={i} className={x.plan.join() === P.chosen.join() ? 'is-on' : ''}>
                <span className="mono">{x.plan.map((k) => sectionOf(k).label.slice(0, 5)).join(' > ')}</span>
                <span className="mono dj-dim">G {x.G.toFixed(2)} · p {Math.round(x.p * 100)}%</span>
              </li>
            ))}
          </ol>
        )}
        {P && <p className="dj-dim mono">chosen: {Object.entries(P.parts).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(' · ')}</p>}
        <ul className="dj-in">
          <li><span>energy</span><span className="dj-meter"><i style={{ width: `${Math.round(mix.energy * 100)}%` }} /></span><span className="mono">{Math.round(mix.energy * 100)}%</span></li>
          <li><span>the arc</span><span className="dj-meter"><i style={{ width: `${Math.round(mix.energyTarget * 100)}%` }} /></span><span className="mono">{Math.round(mix.energyTarget * 100)}%</span></li>
          <li><span>next</span><span>{sectionOf(mix.next).label} at bar {mix.nextAt}{mix.moves.length ? ` · now: ${mix.moves.map((m) => m.label).join(', ')}` : ''}</span><span /></li>
        </ul>
      </section>
      <section className="dj-sec">
        <h3>THE MIX MACHINE SETTLES ELEVEN CHOICES, ONCE A BAR</h3>
        <p className="dj-dim">Each is a p-bit. Inside a phrase each leans hard to stay as it is; on a 4-bar line and at a section change the section, the picture, the theme, your steering and the votes decide.</p>
        <div className="dj-leans">
          {MIX_CHOICES.map((c) => (
            <div key={c.key} className="dj-lean">
              <span className={`dj-light dj-light--lg${mix.yes[c.key] ? ' is-yes' : ''}`}><span className="dj-light__k">{c.short}</span></span>
              <span className="dj-lean__q">{c.question}</span>
              <span className="dj-lean__v mono">lean {(mix.leans[c.key].total > 0 ? '+' : '') + mix.leans[c.key].total.toFixed(1)}</span>
              <WhyList lean={mix.leans[c.key]} />
            </div>
          ))}
        </div>
        <p className="dj-dim dj-pulls">pulls: {MIX_PULLS.map(([a, b, w]) => `${a} ${w > 0 ? 'with' : 'against'} ${b} ${w > 0 ? '+' : ''}${w}`).join(' · ')}</p>
        <p className="dj-dim">drums {mix.drumFamily} · bass {mix.bassStyle} · texture {mix.texture}{mix.keyLift ? ` · key lifted ${mix.keyLift}` : ''}{mix.section === 'hum' ? ` · the hum: ${mix.hum.variant} at ${mix.hum.rate}` : ''}</p>
      </section>
      <section className="dj-sec">
        <h3>THE COMPOSER</h3>
        {mix.surfacing ? <p>the old tune surfaces: <b>{mix.surfacing.label}</b>, note for note</p> : null}
        {mix.tune ? (
          <>
            <p><b>{mix.tune.label}</b> <span className="dj-dim mono">seed {mix.tune.seed}</span></p>
            <ul className="dj-src">
              {(mix.tune.sources ?? []).map((x) => <li key={x.id}>{x.title}{x.source?.book ? <> · <i>{x.source.book}</i>{x.source.year ? ` (${x.source.year})` : ''}{x.source.where ? `, ${x.source.where}` : ''}</> : null}</li>)}
            </ul>
            {mix.tune.copy?.length ? <p className="dj-dim mono">longest run shared with a source: {mix.tune.copy.map((c) => `${c.beats} beats`).join(', ')} (one phrase at most)</p> : null}
            {mix.tune.abc && <details className="dj-abc"><summary>the new tune in ABC</summary><pre>{mix.tune.abc}</pre></details>}
          </>
        ) : <p className="dj-dim">no tune yet</p>}
        <p className="dj-dim">{mix.influence.words}{mix.votes.n ? ` · leans on ${mix.votes.n} rated tags` : ''}</p>
      </section>
      <section className="dj-sec">
        <h3>THE RACK · {mix.chain.length} EFFECTS, AMOUNTS MOVED BY THE DJ</h3>
        <ol className="dj-house__list">
          {mix.chain.map((c) => <li key={c.key}><b>{c.label}</b> <span className="dj-meter dj-meter--inline"><i style={{ width: `${Math.round(c.amount * 100)}%` }} /></span> <span className="mono dj-dim">{Math.round(c.amount * 100)}%</span></li>)}
        </ol>
        {tag && <p className="dj-dim mono dj-tag">tag {tag}</p>}
      </section>
    </>
  );
}

// THE VOICES (lane MELODYFX): each melodic instrument's own chain this set; the clear flute plays dry
const SLOT_WORD = { lead: 'lead', arps: 'arps', answer: 'answer', chop: 'chop', fiddle: 'fiddle', harp: 'harp', bells: 'bells', crystal: 'crystal' };
export function VoicesPanel({ voices }) {
  if (!voices) return null;
  return (
    <section className="dj-sec dj-voices">
      <h3>THE VOICES · EVERY INSTRUMENT THROUGH ITS OWN CHAIN</h3>
      <p className="dj-dim">Each melodic part plays through a warm drive and two to four more effects, settled fresh each set from a deck so no part wears the same chain twice in a row. The clear flute is the one instrument with no effects.{voices.swing ? ` Swing ${voices.swing} of a beat.` : ''}</p>
      <ul className="dj-house__list">
        {voices.mode === 'pure'
          ? <li><b>flute</b> <span className="dj-dim">{voices.lines[0]}</span></li>
          : voices.voices.map((v, i) => <li key={v.slot}><b>{SLOT_WORD[v.slot] ?? v.slot}</b> <span className="dj-dim">{voices.lines[i]}</span></li>)}
      </ul>
    </section>
  );
}

export function HouseChain({ house }) {
  if (!house?.on) return null;
  return (
    <section className="dj-sec dj-house">
      <h3>THE HOUSE SET · {house.keys.length} OF {PASSES.length} PASSES</h3>
      <p className="dj-dim">The tune sits about 14 dB under a soft four-on-the-floor and a pad, through these passes, then a limiter. The DJ swaps two at a bar line after {HOUSE.swapMinBars} bars when its beat or split light says yes, the whole chain on a new theme, and never mid-bar.</p>
      <ol className="dj-house__list">
        {house.keys.map((k, i) => (
          <li key={k}><b>{house.labels[i]}</b> <span className="dj-dim">{house.lines[i]}</span></li>
        ))}
      </ol>
      <p className="dj-dim mono">cost {house.cost} of {HOUSE.budget} units · {house.swaps} swaps · {house.barsSince} bars with this chain</p>
    </section>
  );
}

// the DJ line's tune: pure mode names the tune and its book; house names the composed tune; else the old wording
function lineTune(state) {
  if (!state) return '';
  if (state.opener?.on) return ` · ${state.opener.phase === 'waiting' ? 'waits for the first sound' : `${state.opener.slotLabel}, ${clock(state.opener.at)} of ${clock(state.opener.length)}`}`;
  const t = state.tune;
  if (state.pure && t && !t.generated) return ` · ${t.title}${t.source?.book ? `, ${t.source.book}` : t.source?.dataset ? `, ${t.source.dataset}` : ''}`;
  if (state.mix?.surfacing) return ` · ${state.mix.surfacing.label}, surfacing`;
  if (state.mix?.tune) return ` · ${state.mix.tune.label}`;
  return t && !t.generated ? ` · ${t.title}` : t?.generated ? ' · a generated phrase' : '';
}

const clock = (s) => `${Math.floor((s ?? 0) / 60)}:${String(Math.floor((s ?? 0) % 60)).padStart(2, '0')}`;
// THE OPENING BLEND in the big view: the arc's slots, the one playing now lit, and what this visit settled
export function OpenerPanel({ opener }) {
  if (!opener?.on) return null;
  return (
    <section className="dj-sec dj-opener">
      <h3>THE OPENING BLEND</h3>
      <p className="dj-dim">Every visit opens with this ambient set, never house: soft tones, isochronic pulses (one tone switched on and off cleanly at a slow rate), a warm pad and a gentle 40 Hz pulse. In DEFAULT MODE it plays alone: the picture's static and the binaural pair rest until the handover. The shape is the same every visit; the key, the order of the rates, the tones and the timings are settled fresh. At {clock(opener.length)} it blends into the DJ's first set over {opener.handover} s.</p>
      <ol className="dj-opener__arc">
        {opener.slots.map((s) => (
          <li key={s.key} className={opener.slot === s.key ? 'is-now' : ''}>
            <span className="mono dj-dim">{clock(s.start)}</span> {s.label}{s.rateLabel ? ` (${s.rateLabel})` : ''}
          </li>
        ))}
        <li className={opener.slot === 'handover' ? 'is-now' : ''}><span className="mono dj-dim">{clock(opener.length)}</span> the handover to the DJ</li>
      </ol>
      <p className="dj-dim mono">tones {opener.timbres.join(' and ')} · {opener.f0.toFixed(1)} Hz to {opener.fEnd.toFixed(1)} Hz · {opener.bells} bells · {opener.tag}</p>
    </section>
  );
}

function status(state) {
  if (!state) return '';
  if (state.muted) return 'muted (MUTE ALL)';
  if (!state.playing) return 'stopped';
  if (!state.unlocked) return 'starts on your first click or key press';
  return 'playing';
}

export function HeroSymphony({ stats, playing, level, seed, theme, tracks, style, className = '', line = false, house, pure, opener = true, closeWhen = false, onAir = null, modeName = null, bases = null }) {
  // tracks: the symphony's track toggles at creation ({ flute: true, ... }); undefined keeps every track on
  const { symphony, state } = useSymphony({ seed, theme, level, playing, house, pure, opener, bases, tracks });
  const [open, setOpen] = useState(false);
  // shown outlives open by the close motion (a short fade and fold), so the panel folds away rather than vanishing
  const [shown, setShown] = useState(false);
  const [room, setRoom] = useState(null);
  // the big view is a popup (lane HOUSEDJ): a pointerdown outside the panel and its toggle, Escape, the x, or
  // closeWhen shuts it; Escape and the x hand focus back to the DJ line (lane DJRATELINE)
  const djRoot = useRef(null);
  const viewRef = useRef(null);
  const toggleRef = useRef(null);
  const step = (a) => setOpen((o) => djPopupStep(o, a));
  const closeTo = (type) => { step({ type }); toggleRef.current?.focus(); };
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => {
      const inside = djInside(e.target, { view: viewRef.current, toggle: toggleRef.current });
      if (!inside && viewRef.current?.contains(document.activeElement)) toggleRef.current?.focus();
      step({ type: 'outside', inside });
    };
    const key = (e) => { if (e.key === 'Escape') closeTo('escape'); };
    document.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
    };
  }, [open]);
  useEffect(() => { if (closeWhen) step({ type: 'dismiss' }); }, [closeWhen]);
  useEffect(() => {
    if (open) { setShown(true); return undefined; }
    if (reduced()) { setShown(false); return undefined; }
    const id = setTimeout(() => setShown(false), 160);
    return () => clearTimeout(id);
  }, [open]);
  // THE ROOM: the panel never runs past the DJ line or under the header; its body scrolls inside the cap
  useLayoutEffect(() => {
    if (!shown) return undefined;
    const measure = () => {
      const v = viewRef.current;
      const l = toggleRef.current;
      if (!v || !l || typeof window === 'undefined') return;
      const vr = v.getBoundingClientRect();
      const lr = l.getBoundingClientRect();
      const css = getComputedStyle(document.documentElement);
      const head = parseFloat(css.getPropertyValue('--head-h')) || 0;
      const foot = parseFloat(css.getPropertyValue('--foot-strip')) || 0;
      let top = head;
      let bottom = window.innerHeight - foot;
      for (let n = djRoot.current?.parentElement; n && n !== document.body; n = n.parentElement) {
        const o = getComputedStyle(n);
        if (o.overflowY !== 'visible' || o.overflowX !== 'visible') {
          const r = n.getBoundingClientRect();
          top = Math.max(top, r.top);
          bottom = Math.min(bottom, r.bottom);
          break;
        }
      }
      // a page can keep the panel clear of its own controls at the top of the bound: --dj-room-top on the .dj root
      top += parseFloat(getComputedStyle(djRoot.current).getPropertyValue('--dj-room-top')) || 0;
      setRoom(djRoom({ lineTop: lr.top, lineBottom: lr.bottom, boundTop: top, boundBottom: bottom, above: vr.top < lr.top }));
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [shown]);
  useEffect(() => { if (stats) symphony.current?.update(stats); }, [stats]);
  const d = state?.decision ?? null;
  const reveal = useReveal(d, open);
  const th = state?.theme;
  const minor = th ? MINOR_MODES.has(th.mode) : false;
  const root = th ? midiHz(rootMidiOf(th)) : 108;
  const droneHz = root > 160 ? root / 2 : root;
  const tune = state?.tune;
  const src = tune?.source;
  const head = djHeadline({ modeName, beat: state?.beat, carrier: state?.carrier, status: status(state), fallback: FLUTE_MODE_NAME });
  return (
    <div ref={djRoot} className={`dj ${open ? 'dj--open' : ''} ${className}`} style={{ '--dj-theme': th ? `var(--neon-${th.neon})` : 'var(--prime)', ...style }}>
      {shown && state && (
        <div ref={viewRef} className={`dj-view${open ? '' : ' dj-view--closing'}`} role="region" aria-label="The DJ at work" style={{ maxHeight: room }}>
          <div className="dj-view__head">
            <div className="dj-view__title">
              <b>{head.title}</b>
              <span className="dj-dim">{modeName ? head.sub : `${FLUTE_MODE_ALIAS} · ${head.sub}`}</span>
            </div>
            <button type="button" className="dj-x" aria-label="close" onClick={() => closeTo('close')}>×</button>
          </div>
          <div className="dj-view__body">
          <p className="dj-dim dj-view__note">Use headphones to hear the binaural beat.</p>
          <OpenerPanel opener={state.opener} />
          {state.mix && <MixPanel mix={state.mix} tag={state.tag} />}
          <section className="dj-sec">
            <h3>THE DJ SETTLES SIX CHOICES, ONCE A BAR</h3>
            <p className="dj-dim">Each choice is a p-bit. Its lean comes from the hero picture; the pulls tie them together; the DJ cools them like the hero cools its lights, then plays what they say.</p>
            <SettleTrace decision={d} reveal={reveal} />
            <div className="dj-leans">
              {DJ_CHOICES.map((c) => (
                <div key={c.key} className="dj-lean">
                  <span className={`dj-light dj-light--lg${d?.yes[c.key] ? ' is-yes' : ''}`}><span className="dj-light__k">{c.short}</span></span>
                  <span className="dj-lean__q">{c.question}</span>
                  <span className="dj-lean__v mono">lean {d ? (d.leans[c.key].total > 0 ? '+' : '') + d.leans[c.key].total.toFixed(1) : '...'}</span>
                  <WhyList lean={d?.leans[c.key]} />
                </div>
              ))}
            </div>
            <p className="dj-dim dj-pulls">pulls: {DJ_PULLS.map(([a, b, w]) => `${a} ${w > 0 ? 'with' : 'against'} ${b} ${w > 0 ? '+' : ''}${w}`).join(' · ')}</p>
          </section>
          <section className="dj-sec dj-sec--two">
            <div>
              <h3>WHAT THE HERO SAYS</h3>
              {d ? (
                <ul className="dj-in">
                  {[['heat', d.inputs.heat], ['overlap', d.inputs.overlap], ['flips', d.inputs.flips]].map(([k, v]) => (
                    <li key={k}><span>{k}</span><span className="dj-meter"><i style={{ width: `${v * 100}%` }} /></span><span className="mono">{Math.round(v * 100)}%</span></li>
                  ))}
                  <li><span>picture</span><span>{d.inputs.film ? `a film${d.inputs.frame != null ? `, frame ${d.inputs.frame}` : ''}` : d.inputs.word ? `the word ${d.inputs.word}` : d.inputs.shape ? `the shape ${d.inputs.shape}` : 'unknown'}</span></li>
                  <li><span>phase</span><span>{d.inputs.phase}{d.inputs.landed ? ' (landed)' : ''}</span></li>
                </ul>
              ) : <p className="dj-dim">waiting for the picture's first numbers</p>}
            </div>
            <div>
              <h3>THE SOUND</h3>
              <ul className="dj-in">
                <li><span>theme</span><span className="dj-theme">{th?.label}</span></li>
                <li><span></span><span className="dj-dim">{th?.line}</span></li>
                <li><span>mode</span><span>{d?.mode ?? '...'}{d?.mode === 'static' && d.harmonics > 1 ? `, split into ${d.harmonics}${d.splitHow ? ` (${d.splitHow})` : ''}` : ''}</span></li>
                <li><span>tempo</span><span className="mono">{state.bpm ? `${Math.round(state.bpm)} bpm` : '...'} in {th?.bpm.join(' to ')}</span></li>
                <li><span>beat</span><span className="mono">{state.beat} Hz{state.beat === 40 ? ' (home)' : ''}</span></li>
                <li><span>ears</span><span className="mono">L {hz(state.carrier)} · R {hz(state.carrier + state.beat)} Hz</span></li>
                <li><span>harmonics</span><HarmonicBars n={d?.mode === 'static' ? d.harmonics : 0} root={droneHz} minor={minor} /></li>
              </ul>
            </div>
          </section>
          {!state.mix && <HouseChain house={state.house} />}
          {!state.opener?.on && <VoicesPanel voices={state.voices} />}
          <section className="dj-sec">
            <h3>{state.pure ? 'THE McKUSKER FLUTE · PURE' : 'THE TUNE'}</h3>
            {state.pure && <p className="dj-dim">A collected tune as written, on the raw flute alone, in a light room. Nothing else sounds.</p>}
            {tune ? (
              tune.generated ? <p>generated from the {th?.mode} scale, not an old tune</p> : (
                <p><b>{tune.title}</b> · {src?.compiler}, <i>{src?.book}</i> ({src?.year}), {src?.where}</p>
              )
            ) : <p className="dj-dim">no tune yet</p>}
            <MelodyStrip recent={state.recent} />
            <p className="dj-dim">every pitch from A = 432 Hz · {state.tunesAvailable} cleared tunes</p>
          </section>
          <Toggles s={symphony} state={state} />
          </div>
        </div>
      )}
      {line ? (
        // the one-line mode: THE DJ as a single strip (theme, Hz, the six lights, mode, tune); a click opens the same view
        <button ref={toggleRef} type="button" className="dj-mini dj-mini--line" aria-expanded={open} onClick={() => step({ type: 'toggle' })} title={open ? 'Close the DJ view' : 'Open the DJ view: how the sound follows the picture'}>
          <b>THE DJ</b>
          {onAir && <><span className="dj-line__sep" aria-hidden="true">·</span><span className="dj-line__onair">{onAir}</span></>}
          {modeName && (
            <>
              <span className="dj-line__sep" aria-hidden="true">·</span>
              <span className="dj-line__mode">{modeName}</span>
            </>
          )}
          <span className="dj-line__sep" aria-hidden="true">·</span>
          <span className="dj-theme">{th?.label ?? '...'}</span>
          <span className="dj-line__sep" aria-hidden="true">·</span>
          <span className="mono">{state?.opener?.on ? (state.opener.rateHz ? `${state.opener.rateHz} Hz pulse` : 'no pulse yet') : state ? `${state.beat} Hz` : ''}</span>
          <span className="dj-line__sep" aria-hidden="true">·</span>
          <DJLights decision={d} size={8} reveal={open ? reveal : 999} />
          <span className="dj-line__sep" aria-hidden="true">·</span>
          <span className="dj-mini__mode">{state?.opener?.on ? 'opening blend' : state?.mix ? state.mix.sectionLabel.toLowerCase() : state?.pure ? 'pure flute' : d?.mode ?? 'waiting'}{state?.house?.on && !state?.opener?.on ? ' · house' : ''}</span>
          <span className="dj-line__tune dj-dim">
            <span className="dj-line__sep" aria-hidden="true">·</span>
            {status(state)}{lineTune(state)}
          </span>
          {state?.tag && <span className="dj-line__tag mono dj-dim" title={state.tag}><span className="dj-line__sep" aria-hidden="true">·</span>{state.tag.slice(0, 18)}</span>}
          <span className="dj-mini__open" aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
      ) : (
      <button ref={toggleRef} type="button" className="dj-mini" aria-expanded={open} onClick={() => step({ type: 'toggle' })} title={open ? 'Close the DJ view' : 'Open the DJ view: how the sound follows the picture'}>
        <span className="dj-mini__row">
          <b>THE DJ</b>
          <span className="dj-theme">{th?.label ?? '...'}</span>
          <span className="mono">{state ? `${state.beat} Hz` : ''}</span>
          <span className="dj-mini__open" aria-hidden="true">{open ? '▾' : '▸'}</span>
        </span>
        <span className="dj-mini__row">
          <DJLights decision={d} reveal={open ? reveal : 999} />
          <HarmonicBars n={d?.mode === 'static' ? d.harmonics : 0} root={droneHz} minor={minor} />
          <span className="dj-mini__mode">{d?.mode ?? 'waiting'}</span>
        </span>
        <span className="dj-mini__row dj-dim">{status(state)}{tune && !tune.generated ? ` · ${tune.title}` : tune?.generated ? ' · a generated phrase' : ''}</span>
      </button>
      )}
    </div>
  );
}
