// settle-hear/react · Symphony - the hero symphony for React: a hook, and HeroSymphony, the one-line mount that plays
// the sound and draws THE DJ's visualiser (a mini panel bottom left, a larger view on click, hidden toggles inside).
//
// <claudes_code_comments>
// ** Function List **
// useSymphony(opts)           - one symphony for a component: { symphony, state }; disposed on unmount; its house
//                               sets come from THE DJ's trained models (lane DJWIRE: the djBrain store, dj-brain.js)
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
// lineTune(state, w)                    - the DJ line's tune words: pure names the tune and its book; the opener
//                                         names its slot and its time (lane OPENINGSET)
// OpenerPanel({ opener })               - THE OPENING BLEND in the big view: the arc, the slot now, the settled details
// secWord(label, w) / withNode(text, key, node) - a section's name in the page's language (upper case as drawn); a
//                                         template with one React node set into its {key}
//
// THE WORDS (lanes AUDITHOME and FINISHDJ): every part above takes `w`, the words function HeroSymphony's `words` prop
// carries (lineWords.js lists every template it is called with); without it every word is English, byte for byte.
// Names stay as they are: themes, moods, tunes, effects, styles, keys and the set's tag. The set's tag is shown in the
// big view only (lane FINISHDJ: the line showed it as DEEP.OPEN.V1.8G0TV, a code a visitor cannot read).
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
import { djBrain } from '../src/dj-brain.js'; // THE TRAINED DJ (lane DJWIRE): the hero's house sets come from the trained models
import { DJ_CHOICES, DJ_PULLS } from '../src/dj.js';
import { THEMES } from '../src/themes.js';
import { FLUTE_MODE_NAME, FLUTE_MODE_ALIAS, midiHz } from '../src/tuning.js';
import { houseLive } from '../src/spectrumlive.js';
import { PASSES, HOUSE } from '../src/house.js';
import { MIX_CHOICES, MIX_PULLS } from '../src/mix-machine.js';
import { sectionOf, SECTIONS } from '../src/mix-planner.js';
import { djPopupStep, djInside, djRoom, djHeadline, traceColumns } from '../src/popup.js';
import { enWords, whyWords, splitWords, clip } from './words.js'; // THE DJ's words (lanes AUDITHOME, FINISHDJ): a site may pass a `words` function; lineWords.js lists them
import { chainLine } from '../src/voice-fx.js';
import './symphony.css';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (m) => (m == null ? 'rest' : `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`);
const hz = (f) => (f >= 100 ? f.toFixed(1) : f.toFixed(2));
// a section's name in the page's language, upper case as the view draws it (the catalogue lists it in lower case)
const secWord = (label, w = enWords) => w(String(label).toLowerCase()).toUpperCase();
// a template with one React node set into its {key} (a name in bold, say)
function withNode(text, key, node) {
  const at = text.indexOf(`{${key}}`);
  if (at < 0) return text;
  return <>{text.slice(0, at)}{node}{text.slice(at + key.length + 2)}</>;
}
const pullWords = (w) => ([a, b, wt]) => w(wt > 0 ? '{a} with {b} {w}' : '{a} against {b} {w}', { a: w(a), b: w(b), w: `${wt > 0 ? '+' : ''}${wt}` });

// the influence window lives across visits in this browser's storage when it can (dj-influence.js; guarded)
const influenceStore = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };

// opener (true by default here, lane OPENINGSET): the visit's first set is THE OPENING BLEND; false yields it
export function useSymphony({ seed, theme, level, playing, tracks, house, pure, opener = true, bases = null } = {}) {
  const ref = useRef(null);
  const [state, setState] = useState(null);
  useEffect(() => {
    const s = createSymphony({ seed, theme, level, tracks, house: !!house, pure: !!pure, opener: opener !== false, influenceStorage: influenceStore(), playing: playing ?? !reduced(), bases: bases ?? null, djBrain });
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

export function DJLights({ decision, size = 12, reveal = 999, w = enWords }) {
  const tr = decision?.trace ?? [];
  const at = tr[Math.min(tr.length, reveal) - 1];
  return (
    <span className="dj-lights" role="img" aria-label={decision ? DJ_CHOICES.map((c) => w('{label} {answer}', { label: w(c.label), answer: w(decision.yes[c.key] ? 'yes' : 'no') })).join(', ') : w('the DJ has not decided yet')}>
      {DJ_CHOICES.map((c, i) => {
        const on = at ? at.s[i] > 0 : !!decision?.yes[c.key];
        const held = decision?.clamps?.[c.key] != null;
        return (
          <span key={c.key} className={`dj-light${on ? ' is-yes' : ''}${held ? ' is-held' : ''}`} style={{ width: size, height: size }} title={w('{label}: {question} {answer}', { label: w(c.label), question: w(c.question), answer: w(on ? 'yes' : 'no') })}>
            <span className="dj-light__k">{c.short}</span>
          </span>
        );
      })}
    </span>
  );
}

export function SettleTrace({ decision, reveal = 999, w = enWords }) {
  if (!decision) return null;
  const tr = decision.trace;
  const from = `${tr[0]?.T.toFixed(2)}`;
  const to = `${tr[tr.length - 1]?.T.toFixed(2)}`;
  return (
    <div className="dj-trace" role="img" aria-label={w("the bar's settle: {n} sweeps, cooling from temperature {from} to {to}", { n: tr.length, from, to })}>
      {DJ_CHOICES.map((c, i) => (
        <div key={c.key} className="dj-trace__row">
          <span className="dj-trace__name">{w(c.label)}</span>
          <span className="dj-trace__cells" style={{ gridTemplateColumns: traceColumns(tr.length) }}>
            {tr.map((w, j) => (
              <span key={j} className={`dj-trace__cell${j < reveal ? (w.s[i] > 0 ? ' is-yes' : ' is-no') : ''}`} />
            ))}
          </span>
          <span className="dj-trace__p mono">{Math.round(decision.pYes[c.key] * 100)}%</span>
        </div>
      ))}
      <div className="dj-trace__axis mono">{reveal < tr.length ? w('sweep {k} of {n}, settling', { k: Math.max(1, reveal), n: tr.length }) : w('{n} sweeps, T {from} → {to}', { n: tr.length, from, to })}</div>
    </div>
  );
}

export function HarmonicBars({ n = 0, root = 108, minor = false, w = enWords }) {
  return (
    <span className="dj-harm" role="img" aria-label={n > 1 ? w('{n} harmonics of {hz} Hz', { n, hz: hz(root) }) : w('no harmonics of {hz} Hz', { hz: hz(root) })}>
      {[1, 2, 3, 4, 5, 6, 7].map((k) => {
        const lit = n > 1 && k <= n && !(minor && k === 5);
        return (
          <span key={k} className={`dj-harm__bar${lit ? ' is-on' : ''}`} style={{ height: `${30 + 70 / k}%` }} title={w(minor && k === 5 ? 'partial {k}: {hz} Hz (left out: a minor theme)' : 'partial {k}: {hz} Hz', { k, hz: hz(root * k) })}>
            <i>{k}</i>
          </span>
        );
      })}
    </span>
  );
}

export function MelodyStrip({ recent = [], w = enWords }) {
  const notes = recent.filter((r) => r.midi != null).slice(-16);
  if (!notes.length) return <span className="dj-strip dj-strip--empty">{w('the flute is resting')}</span>;
  const lo = Math.min(...notes.map((r) => r.midi));
  const hi = Math.max(...notes.map((r) => r.midi));
  return (
    <span className="dj-strip" role="img" aria-label={w('the last notes: {notes}', { notes: notes.map((r) => noteName(r.midi)).join(' ') })}>
      {notes.map((r, i) => (
        <span key={i} className="dj-strip__note" style={{ flexGrow: r.beats }} title={`${noteName(r.midi)} ${hz(midiHz(r.midi))} Hz`}>
          <i style={{ bottom: `${hi === lo ? 40 : ((r.midi - lo) / (hi - lo)) * 80}%` }} />
        </span>
      ))}
    </span>
  );
}

export function WhyList({ lean, w = enWords }) {
  // THE STEERING (lane RATELOOK): the visitor's own lean, the part named 'you', is always shown and marked
  const all = [...(lean?.parts ?? [])];
  const you = all.find((p) => p.why === 'you');
  const parts = all.filter((p) => p.why !== 'you').sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, you ? 3 : 4);
  if (you) parts.unshift(you);
  return (
    <span className="dj-why">
      {parts.map((p) => (
        <span key={p.why} className={`${p.v > 0 ? 'is-up' : 'is-down'}${p.why === 'you' ? ' is-you' : ''}`}>{whyWords(p.why, w)} {p.v > 0 ? '+' : ''}{p.v.toFixed(1)}</span>
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

function Toggles({ s, state, w = enWords }) {
  const S = s.current;
  if (!S || !state) return null;
  return (
    <details className="dj-toggles">
      <summary>{w('tracks and controls')}</summary>
      <div className="dj-toggles__grid">
        <span className="dj-k">{w('tracks')}</span>
        <span className="dj-checks">
          {TRACKS.map((t) => (
            <label key={t}><input type="checkbox" checked={state.tracks[t]} onChange={(e) => S.setTrack(t, e.target.checked)} /> {w(t)}</label>
          ))}
        </span>
        <span className="dj-k">{w('theme')}</span>
        <Seg label={w('theme')} value={state.theme.key} options={THEMES.map((t) => [t.key, t.label])} onChange={(k) => S.setTheme(k)} />
        <span className="dj-k">{w('hold')}</span>
        <span className="dj-checks">
          <label><input type="checkbox" checked={state.themeLocked} onChange={(e) => S.lockTheme(e.target.checked)} /> {w('lock the theme')}</label>
          <label><input type="checkbox" checked={state.beatHeld} onChange={(e) => S.holdBeat(e.target.checked)} /> {w('hold the beat at 40 Hz')}</label>
        </span>
        {DJ_CHOICES.map((c) => (
          <React.Fragment key={c.key}>
            <span className="dj-k">{w(c.label).toLowerCase()}</span>
            <Seg label={w('{label}: the DJ decides, or held yes or no', { label: w(c.label) })} value={state.clamps[c.key]} options={[[null, 'DJ'], [true, w('yes')], [false, w('no')]]} onChange={(v) => S.clamp(c.key, v)} />
          </React.Fragment>
        ))}
        <span className="dj-k">{w('tune')}</span>
        <span className="dj-checks">
          <button type="button" className="dj-btn" onClick={() => S.nextTune()}>{w('next tune')}</button>
          <button type="button" className="dj-btn" onClick={() => S.toggle()} aria-pressed={state.playing}>{state.playing ? w('stop the symphony') : w('play the symphony')}</button>
        </span>
        <span className="dj-k">{w('level')}</span>
        <input type="range" min={0} max={1} step={0.01} value={state.level} onChange={(e) => S.setLevel(+e.target.value)} aria-label={w('symphony level')} />
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
export function MixPanel({ mix, tag, w = enWords }) {
  if (!mix) return null;
  const P = mix.plan;
  const details = [
    w('drums {drums} · bass {bass} · texture {texture}', { drums: `${mix.drumFamily}`, bass: `${mix.bassStyle}`, texture: `${mix.texture}` }),
    mix.keyLift ? w('key lifted {n}', { n: mix.keyLift }) : null,
    mix.section === 'hum' ? w('the hum: {variant} at {rate}', { variant: `${mix.hum.variant}`, rate: `${mix.hum.rate}` }) : null,
  ].filter(Boolean).join(' · ');
  return (
    <>
      <section className="dj-sec dj-mix">
        <h3>{w('THE PLANNER · {section} · BAR {bar} OF SET {set}', { section: secWord(mix.sectionLabel, w), bar: mix.setBar, set: mix.set + 1 })}</h3>
        <p className="dj-dim">{w("Every four bars the planner scores {count} plans of the next sixteen bars against the set's energy arc, the theme, the picture, your steering and the votes, with a habit prior that keeps changes on 8 and 16 bar lines, and settles one, cooling like the lights do.", { count: P ? P.count : w('each') })}</p>
        <div className="dj-arc" role="img" aria-label={w('the arc: {sections}; now {section}', { sections: SECTIONS.map((x) => secWord(x.label, w)).join(', '), section: secWord(mix.sectionLabel, w) })}>
          {SECTIONS.map((x) => <span key={x.key} className={`dj-arc__s${x.key === mix.section ? ' is-on' : ''}${x.key === mix.next && mix.next !== mix.section ? ' is-next' : ''}`}>{secWord(x.label, w)}</span>)}
        </div>
        {P && (
          <ol className="dj-plans">
            {P.top.map((x, i) => (
              <li key={i} className={x.plan.join() === P.chosen.join() ? 'is-on' : ''}>
                <span className="mono">{x.plan.map((k) => clip(secWord(sectionOf(k).label, w), 5)).join(' > ')}</span>
                <span className="mono dj-dim">G {x.G.toFixed(2)} · p {Math.round(x.p * 100)}%</span>
              </li>
            ))}
          </ol>
        )}
        {P && <p className="dj-dim mono">{w('chosen: {parts}', { parts: Object.entries(P.parts).map(([k, v]) => `${w(k)} ${v.toFixed(2)}`).join(' · ') })}</p>}
        <ul className="dj-in">
          <li><span>{w('energy')}</span><span className="dj-meter"><i style={{ width: `${Math.round(mix.energy * 100)}%` }} /></span><span className="mono">{Math.round(mix.energy * 100)}%</span></li>
          <li><span>{w('the arc')}</span><span className="dj-meter"><i style={{ width: `${Math.round(mix.energyTarget * 100)}%` }} /></span><span className="mono">{Math.round(mix.energyTarget * 100)}%</span></li>
          <li><span>{w('next')}</span><span>{w('{section} at bar {bar}', { section: secWord(sectionOf(mix.next).label, w), bar: mix.nextAt })}{mix.moves.length ? ` · ${w('now: {moves}', { moves: mix.moves.map((m) => m.label).join(', ') })}` : ''}</span><span /></li>
        </ul>
      </section>
      <section className="dj-sec">
        <h3>{w('THE MIX MACHINE SETTLES ELEVEN CHOICES, ONCE A BAR')}</h3>
        <p className="dj-dim">{w('Each is a p-bit. Inside a phrase each leans hard to stay as it is; on a 4-bar line and at a section change the section, the picture, the theme, your steering and the votes decide.')}</p>
        <div className="dj-leans">
          {MIX_CHOICES.map((c) => (
            <div key={c.key} className="dj-lean">
              <span className={`dj-light dj-light--lg${mix.yes[c.key] ? ' is-yes' : ''}`}><span className="dj-light__k">{c.short}</span></span>
              <span className="dj-lean__q">{w(c.question)}</span>
              <span className="dj-lean__v mono">{w('lean {v}', { v: (mix.leans[c.key].total > 0 ? '+' : '') + mix.leans[c.key].total.toFixed(1) })}</span>
              <WhyList lean={mix.leans[c.key]} w={w} />
            </div>
          ))}
        </div>
        <p className="dj-dim dj-pulls">{w('pulls: {pulls}', { pulls: MIX_PULLS.map(pullWords(w)).join(' · ') })}</p>
        <p className="dj-dim">{details}</p>
      </section>
      <section className="dj-sec">
        <h3>{w('THE COMPOSER')}</h3>
        {mix.surfacing ? <p>{withNode(w('the old tune surfaces: {tune}, note for note'), 'tune', <b>{mix.surfacing.label}</b>)}</p> : null}
        {mix.tune ? (
          <>
            <p><b>{mix.tune.label}</b> <span className="dj-dim mono">{w('seed {n}', { n: mix.tune.seed })}</span></p>
            <ul className="dj-src">
              {(mix.tune.sources ?? []).map((x) => <li key={x.id}>{x.title}{x.source?.book ? <> · <i>{x.source.book}</i>{x.source.year ? ` (${x.source.year})` : ''}{x.source.where ? `, ${x.source.where}` : ''}</> : null}</li>)}
            </ul>
            {mix.tune.copy?.length ? <p className="dj-dim mono">{w('longest run shared with a source: {runs} (one phrase at most)', { runs: mix.tune.copy.map((c) => w('{n} beats', { n: c.beats })).join(', ') })}</p> : null}
            {mix.tune.abc && <details className="dj-abc"><summary>{w('the new tune in ABC')}</summary><pre>{mix.tune.abc}</pre></details>}
          </>
        ) : <p className="dj-dim">{w('no tune yet')}</p>}
        <p className="dj-dim">{mix.influence.say ? mix.influence.say.map(([en, vars]) => w(en, vars)).join(', ') : mix.influence.words}{mix.votes.n ? ` · ${w('leans on {n} rated tags', { n: mix.votes.n })}` : ''}</p>
      </section>
      <section className="dj-sec">
        <h3>{w('THE RACK · {n} EFFECTS, AMOUNTS MOVED BY THE DJ', { n: mix.chain.length })}</h3>
        <ol className="dj-house__list">
          {mix.chain.map((c) => <li key={c.key}><b>{c.label}</b> <span className="dj-meter dj-meter--inline"><i style={{ width: `${Math.round(c.amount * 100)}%` }} /></span> <span className="mono dj-dim">{Math.round(c.amount * 100)}%</span></li>)}
        </ol>
        {tag && <p className="dj-dim mono dj-tag">{w('tag {tag}', { tag })}</p>}
      </section>
    </>
  );
}

// THE VOICES (lane MELODYFX): each melodic instrument's own chain this set; the clear flute plays dry
const SLOT_WORD = { lead: 'lead', arps: 'arps', answer: 'answer', chop: 'chop', fiddle: 'fiddle', harp: 'harp', bells: 'bells', crystal: 'crystal' };
export function VoicesPanel({ voices, w = enWords }) {
  if (!voices) return null;
  // the pure flute's line is the clear flute's own chain line, so the page's words can say it
  const pureLine = voices.lines[0] === chainLine({ inst: 'flute', chain: [] }) ? chainLine({ inst: 'flute', chain: [] }, w) : voices.lines[0];
  return (
    <section className="dj-sec dj-voices">
      <h3>{w('THE VOICES · EVERY INSTRUMENT THROUGH ITS OWN CHAIN')}</h3>
      <p className="dj-dim">{w('Each melodic part plays through a warm drive and two to four more effects, settled fresh each set from a deck so no part wears the same chain twice in a row. The clear flute is the one instrument with no effects.')}{voices.swing ? ` ${w('Swing {swing} of a beat.', { swing: voices.swing })}` : ''}</p>
      <ul className="dj-house__list">
        {voices.mode === 'pure'
          ? <li><b>{w('flute')}</b> <span className="dj-dim">{pureLine}</span></li>
          : voices.voices.map((v, i) => <li key={v.slot}><b>{w(SLOT_WORD[v.slot] ?? v.slot)}</b> <span className="dj-dim">{v.chain ? chainLine(v, w) : voices.lines[i]}</span></li>)}
      </ul>
    </section>
  );
}

export function HouseChain({ house, w = enWords }) {
  if (!house?.on) return null;
  return (
    <section className="dj-sec dj-house">
      <h3>{w('THE HOUSE SET · {n} OF {total} PASSES', { n: house.keys.length, total: PASSES.length })}</h3>
      <p className="dj-dim">{w('The tune sits about 14 dB under a soft four-on-the-floor and a pad, through these passes, then a limiter. The DJ swaps two at a bar line after {bars} bars when its beat or split light says yes, the whole chain on a new theme, and never mid-bar.', { bars: HOUSE.swapMinBars })}</p>
      <ol className="dj-house__list">
        {house.keys.map((k, i) => (
          <li key={k}><b>{house.labels[i]}</b> <span className="dj-dim">{house.lines[i]}</span></li>
        ))}
      </ol>
      <p className="dj-dim mono">{w('cost {cost} of {budget} units · {swaps} swaps · {bars} bars with this chain', { cost: house.cost, budget: HOUSE.budget, swaps: house.swaps, bars: house.barsSince })}</p>
    </section>
  );
}

// the DJ line's tune: pure mode names the tune and its book; house names the composed tune; else the old wording
function lineTune(state, w = enWords) {
  if (!state) return '';
  if (state.opener?.on) return ` · ${state.opener.phase === 'waiting' ? w('waits for the first sound') : w('{slot}, {at} of {length}', { slot: state.opener.slotLabel ? w(state.opener.slotLabel) : '', at: clock(state.opener.at), length: clock(state.opener.length) })}`;
  const t = state.tune;
  if (state.pure && t && !t.generated) return ` · ${t.title}${t.source?.book ? `, ${t.source.book}` : t.source?.dataset ? `, ${t.source.dataset}` : ''}`;
  if (state.mix?.surfacing) return ` · ${w('{label}, surfacing', { label: state.mix.surfacing.label })}`;
  if (state.mix?.tune) return ` · ${state.mix.tune.label}`;
  return t && !t.generated ? ` · ${t.title}` : t?.generated ? ` · ${w('a generated phrase')}` : '';
}

const clock = (s) => `${Math.floor((s ?? 0) / 60)}:${String(Math.floor((s ?? 0) % 60)).padStart(2, '0')}`;
// THE OPENING BLEND in the big view: the arc's slots, the one playing now lit, and what this visit settled
export function OpenerPanel({ opener, w = enWords }) {
  if (!opener?.on) return null;
  const tones = (opener.timbres ?? []).reduce((a, b) => (a === null ? `${b}` : w('{a} and {b}', { a, b: `${b}` })), null) ?? '';
  return (
    <section className="dj-sec dj-opener">
      <h3>{w('THE OPENING BLEND')}</h3>
      <p className="dj-dim">{w("Every visit opens with this ambient set, never house: soft tones, isochronic pulses (one tone switched on and off cleanly at a slow rate), a warm pad and a gentle 40 Hz pulse. In DEFAULT MODE it plays alone: the picture's static and the binaural pair rest until the handover. The shape is the same every visit; the key, the order of the rates, the tones and the timings are settled fresh. At {length} it blends into the DJ's first set over {handover} s.", { length: clock(opener.length), handover: opener.handover })}</p>
      <ol className="dj-opener__arc">
        {opener.slots.map((s) => (
          <li key={s.key} className={opener.slot === s.key ? 'is-now' : ''}>
            <span className="mono dj-dim">{clock(s.start)}</span> {w(s.label)}{s.rateLabel ? ` (${s.rateLabel})` : ''}
          </li>
        ))}
        <li className={opener.slot === 'handover' ? 'is-now' : ''}><span className="mono dj-dim">{clock(opener.length)}</span> {w('the handover to the DJ')}</li>
      </ol>
      <p className="dj-dim mono">{w('tones {tones} · {from} Hz to {to} Hz · {bells} bells · {tag}', { tones, from: opener.f0.toFixed(1), to: opener.fEnd.toFixed(1), bells: opener.bells, tag: `${opener.tag}` })}</p>
    </section>
  );
}

function status(state, w = enWords) {
  if (!state) return '';
  if (state.muted) return w('muted (MUTE ALL)');
  if (!state.playing) return w('stopped');
  if (!state.unlocked) return w('starts on your first click or key press');
  return w('playing');
}

export function HeroSymphony({ stats, playing, level, seed, theme, tracks, style, className = '', line = false, house, pure, opener = true, closeWhen = false, onAir = null, modeName = null, bases = null, words = enWords }) {
  // words(en, vars): THE DJ's words, the line's and the big view's, in the page's language (lineWords.js lists every
  // template); English by default
  const w = typeof words === 'function' ? words : enWords;
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
  const head = djHeadline({ modeName, beat: state?.beat, carrier: state?.carrier, status: status(state, w), fallback: FLUTE_MODE_NAME, words: w });
  return (
    <div ref={djRoot} className={`dj ${open ? 'dj--open' : ''} ${className}`} style={{ '--dj-theme': th ? `var(--neon-${th.neon})` : 'var(--prime)', ...style }}>
      {shown && state && (
        <div ref={viewRef} className={`dj-view${open ? '' : ' dj-view--closing'}`} role="region" aria-label={w('The DJ at work')} style={{ maxHeight: room }}>
          <div className="dj-view__head">
            <div className="dj-view__title">
              <b>{head.title}</b>
              <span className="dj-dim">{modeName ? head.sub : `${FLUTE_MODE_ALIAS} · ${head.sub}`}</span>
            </div>
            <button type="button" className="dj-x" aria-label={w('close')} onClick={() => closeTo('close')}>×</button>
          </div>
          <div className="dj-view__body">
          <p className="dj-dim dj-view__note">{w('Use headphones to hear the binaural beat.')}</p>
          <OpenerPanel opener={state.opener} w={w} />
          {state.mix && <MixPanel mix={state.mix} tag={state.tag} w={w} />}
          <section className="dj-sec">
            <h3>{w('THE DJ SETTLES SIX CHOICES, ONCE A BAR')}</h3>
            <p className="dj-dim">{w('Each choice is a p-bit. Its lean comes from the hero picture; the pulls tie them together; the DJ cools them like the hero cools its lights, then plays what they say.')}</p>
            <SettleTrace decision={d} reveal={reveal} w={w} />
            <div className="dj-leans">
              {DJ_CHOICES.map((c) => (
                <div key={c.key} className="dj-lean">
                  <span className={`dj-light dj-light--lg${d?.yes[c.key] ? ' is-yes' : ''}`}><span className="dj-light__k">{c.short}</span></span>
                  <span className="dj-lean__q">{w(c.question)}</span>
                  <span className="dj-lean__v mono">{w('lean {v}', { v: d ? (d.leans[c.key].total > 0 ? '+' : '') + d.leans[c.key].total.toFixed(1) : '...' })}</span>
                  <WhyList lean={d?.leans[c.key]} w={w} />
                </div>
              ))}
            </div>
            <p className="dj-dim dj-pulls">{w('pulls: {pulls}', { pulls: DJ_PULLS.map(pullWords(w)).join(' · ') })}</p>
          </section>
          <section className="dj-sec dj-sec--two">
            <div>
              <h3>{w('WHAT THE HERO SAYS')}</h3>
              {d ? (
                <ul className="dj-in">
                  {[['heat', d.inputs.heat], ['overlap', d.inputs.overlap], ['flips', d.inputs.flips]].map(([k, v]) => (
                    <li key={k}><span>{w(k)}</span><span className="dj-meter"><i style={{ width: `${v * 100}%` }} /></span><span className="mono">{Math.round(v * 100)}%</span></li>
                  ))}
                  <li><span>{w('picture')}</span><span>{d.inputs.film ? (d.inputs.frame != null ? w('a film, frame {n}', { n: d.inputs.frame }) : w('a film')) : d.inputs.word ? w('the word {word}', { word: d.inputs.word }) : d.inputs.shape ? w('the shape {shape}', { shape: d.inputs.shape }) : w('unknown')}</span></li>
                  <li><span>{w('phase')}</span><span>{d.inputs.landed ? w('{phase} (landed)', { phase: w(`${d.inputs.phase}`) }) : w(`${d.inputs.phase}`)}</span></li>
                </ul>
              ) : <p className="dj-dim">{w("waiting for the picture's first numbers")}</p>}
            </div>
            <div>
              <h3>{w('THE SOUND')}</h3>
              <ul className="dj-in">
                <li><span>{w('theme')}</span><span className="dj-theme">{th?.label}</span></li>
                <li><span></span><span className="dj-dim">{th?.line ? w(th.line) : th?.line}</span></li>
                <li><span>{w('mode')}</span><span>{d?.mode ? (d.mode === 'static' && d.harmonics > 1 ? (d.splitHow ? w('{mode}, split into {n} ({how})', { mode: w(d.mode), n: d.harmonics, how: splitWords(d.splitHow, w) }) : w('{mode}, split into {n}', { mode: w(d.mode), n: d.harmonics })) : w(d.mode)) : '...'}</span></li>
                <li><span>{w('tempo')}</span><span className="mono">{state.bpm ? w('{bpm} bpm in {from} to {to}', { bpm: Math.round(state.bpm), from: th?.bpm[0], to: th?.bpm[1] }) : w('... in {from} to {to}', { from: th?.bpm[0], to: th?.bpm[1] })}</span></li>
                <li><span>{w('beat')}</span><span className="mono">{state.beat === 40 ? w('{beat} Hz (home)', { beat: state.beat }) : `${state.beat} Hz`}</span></li>
                <li><span>{w('ears')}</span><span className="mono">L {hz(state.carrier)} · R {hz(state.carrier + state.beat)} Hz</span></li>
                <li><span>{w('harmonics')}</span><HarmonicBars n={d?.mode === 'static' ? d.harmonics : 0} root={droneHz} minor={minor} w={w} /></li>
              </ul>
            </div>
          </section>
          {!state.mix && <HouseChain house={state.house} w={w} />}
          {!state.opener?.on && <VoicesPanel voices={state.voices} w={w} />}
          <section className="dj-sec">
            <h3>{state.pure ? w('THE McKUSKER FLUTE · PURE') : w('THE TUNE')}</h3>
            {state.pure && <p className="dj-dim">{w('A collected tune as written, on the raw flute alone, in a light room. Nothing else sounds.')}</p>}
            {tune ? (
              tune.generated ? <p>{w('generated from the {mode} scale, not an old tune', { mode: `${th?.mode}` })}</p> : (
                <p><b>{tune.title}</b> · {src?.compiler}, <i>{src?.book}</i> ({src?.year}), {src?.where}</p>
              )
            ) : <p className="dj-dim">{w('no tune yet')}</p>}
            <MelodyStrip recent={state.recent} w={w} />
            <p className="dj-dim">{w('every pitch from A = 432 Hz · {n} cleared tunes', { n: state.tunesAvailable })}</p>
          </section>
          {/* THE SET'S TAG (lane FINISHDJ): shown here only, never on the line; the mix shows it under its rack and the
              opening blend under its arc */}
          {state.tag && !state.mix && !state.opener?.on && <p className="dj-dim mono dj-tag">{w('tag {tag}', { tag: state.tag })}</p>}
          <Toggles s={symphony} state={state} w={w} />
          </div>
        </div>
      )}
      {line ? (
        // the one-line mode: THE DJ as a single strip (theme, Hz, the six lights, mode, tune); a click opens the same view
        <button ref={toggleRef} type="button" className="dj-mini dj-mini--line" aria-expanded={open} onClick={() => step({ type: 'toggle' })} title={open ? w('Close the DJ view') : w('Open the DJ view: how the sound follows the picture')}>
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
          <span className="mono">{state?.opener?.on ? (state.opener.rateHz ? w('{n} Hz pulse', { n: state.opener.rateHz }) : w('no pulse yet')) : state ? `${state.beat} Hz` : ''}</span>
          <span className="dj-line__sep" aria-hidden="true">·</span>
          <DJLights decision={d} size={8} reveal={open ? reveal : 999} w={w} />
          <span className="dj-line__sep" aria-hidden="true">·</span>
          <span className="dj-mini__mode">{state?.opener?.on ? w('opening blend') : state?.mix ? w(state.mix.sectionLabel.toLowerCase()) : state?.pure ? w('pure flute') : d?.mode ? w(d.mode) : w('waiting')}{state?.house?.on && !state?.opener?.on ? ` · ${w('house')}` : ''}</span>
          {state?.fx && !state.fx.held && (
            // THE DJ'S DESK (lane DJFX): the mood playing, and an overdo marked while its phrase lasts
            <span className={`dj-line__fx${state.fx.overdo ? ' dj-line__fx--over' : ''}`} title={w("the DJ's effects: {mood}, {drive} drive, {band} {q} resonance", { mood: `${state.fx.moodLabel}`, drive: `${state.fx.flavour.drive}`, band: `${state.fx.flavour.band}`, q: `${state.fx.flavour.q}` })}>
              <span className="dj-line__sep" aria-hidden="true">·</span>
              {state.fx.moodLabel}{state.fx.overdoLabel ? ` · ${state.fx.overdoLabel}` : ''}
            </span>
          )}
          {state?.fx?.colourLabel && (
            // THE DJ's OVERDRIVE AND VOCODER (lane DJOVERDRIVE): a voice's overdrive or vocoder, named while it sounds
            <span className="dj-line__fx dj-line__colour" title={w("THE DJ's colour on one voice: a harmonic overdrive, a vocoder")}>
              <span className="dj-line__sep" aria-hidden="true">·</span>
              {state.fx.colourLabel}
            </span>
          )}
          <span className="dj-line__tune dj-dim">
            <span className="dj-line__sep" aria-hidden="true">·</span>
            {status(state, w)}{lineTune(state, w)}
          </span>
          <span className="dj-mini__open" aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
      ) : (
      <button ref={toggleRef} type="button" className="dj-mini" aria-expanded={open} onClick={() => step({ type: 'toggle' })} title={open ? w('Close the DJ view') : w('Open the DJ view: how the sound follows the picture')}>
        <span className="dj-mini__row">
          <b>THE DJ</b>
          <span className="dj-theme">{th?.label ?? '...'}</span>
          <span className="mono">{state ? `${state.beat} Hz` : ''}</span>
          <span className="dj-mini__open" aria-hidden="true">{open ? '▾' : '▸'}</span>
        </span>
        <span className="dj-mini__row">
          <DJLights decision={d} reveal={open ? reveal : 999} w={w} />
          <HarmonicBars n={d?.mode === 'static' ? d.harmonics : 0} root={droneHz} minor={minor} w={w} />
          <span className="dj-mini__mode">{d?.mode ? w(d.mode) : w('waiting')}</span>
        </span>
        <span className="dj-mini__row dj-dim">{status(state, w)}{tune && !tune.generated ? ` · ${tune.title}` : tune?.generated ? ` · ${w('a generated phrase')}` : ''}</span>
      </button>
      )}
    </div>
  );
}
