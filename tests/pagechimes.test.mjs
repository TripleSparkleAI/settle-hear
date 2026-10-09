// THE PAGE CHIMES (lane PAGECHIMES): the 50 recipes (distinct by fingerprint and by sound), each one short, soft at
// both ends and at its level, well under THE DJ's quietest voice and under the sfx cap when layered on the page
// sound; the deck dealing all 50 before a repeat; the page trigger (a change plays, the load and the same page do
// not); every silence (MUTE ALL, the switch, volume 0, a hidden page, a veto); and rapid changes never stacking.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, all } from './fakeaudio.mjs';
import { renderSound, measure, likenessPrint, likeness, dbfs } from './offline.mjs';
import { configure, unlockNow, getEngine, sound, setMaster, sfxPage, resetSfx } from '../src/index.js';
import {
  PAGE_CHIME, CHIME_KEY, pageChimes, createChimeSwitch, readChimesOn, addChimeVeto, loadPageChimes, chimesLoaded,
  chimeRefusal, playPageChime, pageChimeChange, onPageChime, resetPageChimes,
} from '../src/pagechime.js';
import {
  PAGE_CHIMES, PAGE_CHIME_RECIPES, CHIME_FAMILIES, CHIME_VOICES, CHIME_TRIM_DB, CHIME_RAW_TARGET_DB, recipeFingerprint, chimeNotes,
} from '../src/pagechimes.js';
import { INSTRUMENT_KEYS } from '../src/instruments.js';
import { djVoices, chimeRows, layered } from '../tools/pagechime_levels.mjs';

const N = 50;
const LIKENESS_MAX = 0.95; // the sfx decks' ruled distinctness bound (SETTLE/runs/animesfx/CHANNEL.md)

test('THE TABLE: exactly 50 recipes, frozen, unique ids, names and fingerprints, every family, THE DJ\'s voices only', () => {
  assert.equal(PAGE_CHIMES.length, N);
  assert.equal(PAGE_CHIME_RECIPES.length, N);
  assert.ok(Object.isFrozen(PAGE_CHIMES));
  assert.equal(new Set(PAGE_CHIMES.map((e) => e.id)).size, N, 'ids');
  assert.equal(new Set(PAGE_CHIMES.map((e) => e.name)).size, N, 'names');
  assert.equal(new Set(PAGE_CHIMES.map((e) => e.fingerprint)).size, N, 'no two recipes share a fingerprint');
  for (const f of CHIME_FAMILIES) assert.ok(PAGE_CHIMES.some((e) => e.family === f), `family ${f}`);
  // the family's character is the little note figure: most of the 50 are two to four notes
  const figures = PAGE_CHIME_RECIPES.filter((r) => Array.isArray(r.notes) && r.notes.length >= 2 && r.notes.length <= 4).length;
  assert.ok(figures >= 30, `${figures} note figures`);
  for (const v of CHIME_VOICES) assert.ok(INSTRUMENT_KEYS.includes(v), `${v} is one of THE DJ's instruments`);
  for (const e of PAGE_CHIMES) {
    assert.ok(Object.isFrozen(e));
    assert.match(e.id, /^chime-[a-z0-9-]+$/);
    assert.equal(e.deck, 'chime');
    assert.equal(e.lane, 'PAGECHIMES');
    assert.match(e.fingerprint, /^[0-9a-f]{8}$/);
    assert.ok(e.dur >= 0.12 && e.dur <= 0.6, `${e.id} recipe length ${e.dur}`);
    for (const n of chimeNotes(e.recipe)) {
      if (n.kind === 'note') assert.ok(CHIME_VOICES.includes(n.voice), `${e.id} plays ${n.voice}`);
      assert.ok(n.at + n.len <= e.dur + 1e-9, `${e.id}: a note runs past the recipe's end`);
    }
  }
});

test('the fingerprint reads the sound, never the name: renaming keeps it, a changed note changes it', () => {
  const r = PAGE_CHIME_RECIPES[0];
  assert.equal(recipeFingerprint({ ...r, id: 'x', name: 'y' }), recipeFingerprint(r));
  const moved = { ...r, notes: r.notes.map((n, i) => (i === 0 ? [n[0] + 1, ...n.slice(1)] : n)) };
  assert.notEqual(recipeFingerprint(moved), recipeFingerprint(r));
});

// one offline render per chime, shared below
const SR = 48000;
const AT = 0.01;
const renders = new Map(PAGE_CHIMES.map((e) => [e.id, renderSound((c, d, t) => e.render(c, t, d, { strength: 1 }), { seconds: e.dur + 0.3, at: AT })]));

test('every chime sounds for 120 to 600 ms, lifts softly and ends at exactly zero (no click)', () => {
  const bad = [];
  for (const e of PAGE_CHIMES) {
    const r = renders.get(e.id);
    const m = measure(r);
    if (!(m.duration >= 0.12 && m.duration <= 0.6)) bad.push(`${e.id} sounds ${m.duration.toFixed(3)} s`);
    const abs = (i) => Math.max(Math.abs(r.L[i] ?? 0), Math.abs(r.R[i] ?? 0));
    const s0 = Math.round(AT * SR);
    let lift = 0; for (let i = s0; i < s0 + SR * 0.001; i++) lift = Math.max(lift, abs(i));
    if (lift > 0.35 * m.peak) bad.push(`${e.id}: the first ms reaches ${(lift / m.peak).toFixed(2)} of the peak`);
    const end = Math.round((AT + e.dur) * SR);
    let edge = 0; for (let i = end - SR * 0.002; i < end; i++) edge = Math.max(edge, abs(i));
    let after = 0; for (let i = end + 48; i < r.L.length; i++) after = Math.max(after, abs(i));
    if (edge > 0.06 * m.peak) bad.push(`${e.id}: the last 2 ms still reach ${(edge / m.peak).toFixed(3)} of the peak`);
    if (after > 1e-6) bad.push(`${e.id}: sound after its end (${after})`);
  }
  assert.deepEqual(bad, []);
});

test('DISTINCT BY SOUND: every pair of the 50 stays under the decks\' ruled likeness of their spectra over time', () => {
  const prints = PAGE_CHIMES.map((e) => [e.id, likenessPrint(renders.get(e.id))]);
  const close = [];
  for (let i = 0; i < prints.length; i++) for (let j = i + 1; j < prints.length; j++) {
    const v = likeness(prints[i][1], prints[j][1]);
    if (v >= LIKENESS_MAX) close.push(`${prints[i][0]} ~ ${prints[j][0]} ${v.toFixed(3)}`);
  }
  assert.deepEqual(close, []);
  // the measure can fail: a chime is alike to itself
  assert.ok(likeness(prints[0][1], prints[0][1]) > LIKENESS_MAX);
});

// the trim table is measured in Chromium (tools/pagechime_levels.py); this node renderer agrees within a few dB
// (its biquads and envelopes are k-rate approximations), so it holds each chime to the target within 3 dB
test('THE LEVEL: every chime lands near its target at the master input, and the trim table covers all 50', () => {
  assert.equal(Object.keys(CHIME_TRIM_DB).length, N);
  for (const e of PAGE_CHIMES) assert.ok(Number.isFinite(CHIME_TRIM_DB[e.id]), `${e.id} trimmed`);
  const off = [];
  for (const e of PAGE_CHIMES) {
    const pk = dbfs(measure(renders.get(e.id)).peak);
    if (Math.abs(pk - CHIME_RAW_TARGET_DB) > 3) off.push(`${e.id} ${pk.toFixed(2)} against ${CHIME_RAW_TARGET_DB.toFixed(2)}`);
  }
  assert.deepEqual(off, [], 'a changed recipe owes a fresh table: python3 tools/pagechime_levels.py --trim');
});

test('THE LEVEL: every chime peaks at least 3 dB under THE DJ\'s quietest voice, at the master input', () => {
  const dj = djVoices();
  const quiet = Math.min(...dj.map((v) => v.peakDb));
  assert.ok(quiet < -25 && quiet > -45, `the reference itself is sane (${quiet})`);
  const loud = chimeRows().filter((r) => r.masterDb > quiet - 3);
  assert.deepEqual(loud.map((r) => `${r.id} ${r.masterDb.toFixed(2)}`), []);
});

test('LAYERED: the loudest chime on every sword page card stays under the sfx decks\' cap (the loudest click)', () => {
  const lay = layered();
  assert.ok(lay.worst.both <= lay.capDb, `${lay.worst.id} with the chime ${lay.worst.both.toFixed(2)} over ${lay.capDb.toFixed(2)}`);
  assert.ok(lay.worst.both - lay.worst.alone < 3, 'the chime adds less than 3 dB to the quietest page card');
});

// ---- the player, on the fake context ----

const ensure = async () => {
  configure({ createContext: () => new Ctx() });
  if (!getEngine()) unlockNow();
  sound.setMuted(false);
  setMaster(0.8);
  pageChimes.setOn(true);
  await loadPageChimes();
};

test('THE DECK RULE: 150 page chimes deal every one of the 50 once a round, with no repeat across a reshuffle', async () => {
  await ensure();
  assert.ok(chimesLoaded());
  resetPageChimes({ seed: 11 });
  const ids = Array.from({ length: 3 * N }, () => playPageChime({ reason: 'test' }).id);
  for (let r = 0; r < 3; r++) assert.equal(new Set(ids.slice(r * N, r * N + N)).size, N, `round ${r} holds all 50`);
  for (let i = 1; i < ids.length; i++) assert.notEqual(ids[i], ids[i - 1], `no repeat at ${i}`);
  // an audition by id deals no card
  resetPageChimes({ seed: 11 });
  playPageChime({ id: 'chime-hush' });
  const again = Array.from({ length: N }, () => playPageChime().id);
  assert.equal(new Set(again).size, N);
});

test('THE TRIGGER: the first page is the load and plays no chime; a new page plays one; the same page does not', async () => {
  await ensure();
  let now = 500000;
  resetSfx({ seed: 4, now: () => now });
  resetPageChimes({ seed: 4, now: () => now });
  const heard = [];
  const off = onPageChime((d) => heard.push(d));
  sfxPage({ key: 'home' });
  assert.equal(heard.length, 0, 'the page load plays no chime');
  now += 3000;
  sfxPage({ key: 'home' });
  assert.equal(heard.length, 0, 'the same page (an anchor jump keeps the key) plays no chime');
  sfxPage({ key: 'what' });
  assert.equal(heard.filter((d) => d.played).length, 1, 'a page change plays one');
  assert.equal(heard[0].reason, 'page');
  off();
});

test('SILENCE: MUTE ALL, the switch, volume 0, a hidden page and a veto each refuse and build nothing', async () => {
  await ensure();
  resetPageChimes({ seed: 2 });
  const tries = [
    ['muted', () => sound.setMuted(true), () => sound.setMuted(false)],
    ['off', () => pageChimes.setOn(false), () => pageChimes.setOn(true)],
    ['volume-0', () => setMaster(0), () => setMaster(0.8)],
    ['hidden', () => { globalThis.document = { hidden: true }; }, () => { delete globalThis.document; }],
    ['hero-sound-off', () => { tries.offVeto = addChimeVeto(() => 'hero-sound-off'); }, () => tries.offVeto()],
  ];
  for (const [why, on, undo] of tries) {
    on();
    try {
      const before = all.length;
      assert.equal(chimeRefusal(), why);
      assert.equal(playPageChime(), null, why);
      assert.equal(pageChimeChange({ key: `k-${why}` }), null, why);
      assert.equal(all.length, before, `${why}: no node built`);
    } finally {
      undo();
    }
  }
  assert.equal(chimeRefusal(), null, 'every silence undone');
  assert.ok(playPageChime(), 'and a chime plays again');
});

test('RAPID CHANGES NEVER STACK: each new chime cuts the one still sounding with a short fade to zero', async () => {
  await ensure();
  resetPageChimes({ seed: 8 });
  const heard = [];
  const off = onPageChime((d) => heard.push(d));
  const start = all.length;
  for (let i = 0; i < 6; i++) pageChimeChange({ key: `r${i}` });
  off();
  const played = heard.filter((d) => d.played);
  assert.equal(played.length, 6);
  assert.equal(played[0].cut, null);
  for (let i = 1; i < 6; i++) assert.equal(played[i].cut, played[i - 1].id, `chime ${i} cut chime ${i - 1}`);
  // every chime's output gain but the last ends on a linear ramp to 0 within PAGE_CHIME.cutFadeS of the next start
  // (a cut output carries exactly two events: hold its level at the new start, then a linear ramp to 0)
  const outs = all.slice(start).filter((n) => n.kind === 'gain' && n.gain.events.length === 2 && n.gain.events[0][0] === 'set' && n.gain.events[1][0] === 'lin' && n.gain.events[1][1] === 0);
  assert.equal(outs.length, 5, `${outs.length} cut outputs faded`);
  for (const o of outs) {
    const lin = o.gain.events.filter((e) => e[0] === 'lin' && e[1] === 0).pop();
    const set = o.gain.events.filter((e) => e[0] === 'set').pop();
    assert.ok(Math.abs(lin[2] - set[2] - PAGE_CHIME.cutFadeS) < 1e-9, 'the cut fade');
  }
});

test('THE SWITCH: on by default, OFF kept in session storage under its key, a broken storage reads as on', () => {
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  const sw = createChimeSwitch({ storage });
  assert.equal(sw.on, true);
  const seen = [];
  sw.subscribe((v) => seen.push(v));
  sw.toggle();
  assert.equal(sw.on, false);
  assert.equal(store.get(CHIME_KEY), '0');
  assert.equal(createChimeSwitch({ storage }).on, false, 'kept for the visit');
  assert.deepEqual(seen, [false]);
  assert.equal(readChimesOn({ getItem() { throw new Error('blocked'); } }), true);
  assert.equal(CHIME_KEY, 'settle-hear:pagechimes');
});

test('AN AUDITION (a press on #/hear) passes the switch and a veto, never MUTE ALL, and deals no card', async () => {
  await ensure();
  resetPageChimes({ seed: 12 });
  pageChimes.setOn(false);
  const offVeto = addChimeVeto(() => 'hero-sound-off');
  try {
    assert.equal(playPageChime(), null, 'a page chime is off');
    const d = playPageChime({ id: 'chime-bing-boop', audition: true });
    assert.equal(d?.id, 'chime-bing-boop');
    assert.equal(d.dealt, false);
    sound.setMuted(true);
    assert.equal(playPageChime({ id: 'chime-bing-boop', audition: true }), null, 'MUTE ALL still wins');
  } finally {
    sound.setMuted(false);
    pageChimes.setOn(true);
    offVeto();
  }
});
