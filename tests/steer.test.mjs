// THE STEERING (lane RATELOOK): the visitor's controls steer the automatic DJ, they never replace it. A control adds a
// lean to one of the six choices (the part named 'you'), holds a track in or out, or names where the DJ's own beat
// or theme change lands; centre is the DJ alone. The symphony reads the store once a bar, and MUTE ALL still wins.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DJ_CHOICES, leans, readHero, createDJ, pickBeat, pickTheme, THEMES, TRACKS, BEAT_HOME, STEER_LEAN,
  STEER_IDLE, STEER_BEATS, STEER_THEMES, STEER_TRACKS, djSteer, isIdleSteer, applySteer, createSymphony,
  configure, unlockNow, getEngine, sound,
} from '../src/index.js';

const KEYS = DJ_CHOICES.map((c) => c.key);
const jsx = readFileSync(new URL('../react/Symphony.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../react/symphony.css', import.meta.url), 'utf8');
const cooling = (k, item = { word: 'SETTLE' }) => {
  const u = (k % 6) / 5;
  return { T: 3 * Math.pow(0.15, u), q: 0.2 + 0.78 * u, flips: Math.round(200 * (1 - u)), n: 400, phase: u >= 0.8 ? 'settled' : 'cooling', index: Math.floor(k / 6), item };
};
const inp = readHero(cooling(2));
const mem = { barsSinceBeat: 2, barsSinceTheme: 5, barsStatic: 0, barsFlute: 1, barsQuiet: 0, barsDrone: 0, beatAway: 0, beat: BEAT_HOME };

// a store of one's own, so a test never leaks into the page store
function fakeStore(init = STEER_IDLE) {
  let st = init;
  const subs = new Set();
  return { get: () => st, set(n) { st = n; for (const f of subs) f(st); }, subscribe(f) { subs.add(f); return () => subs.delete(f); } };
}

test('a lean is a part named you, STEER_LEAN strong, on the one choice steered; centre adds nothing', () => {
  const base = leans(inp, mem, THEMES[1]);
  const you = leans(inp, mem, THEMES[1], { flute: -1 });
  for (const k of KEYS) {
    const part = you[k].parts.find((p) => p.why === 'you');
    if (k === 'flute') {
      assert.equal(part.v, -STEER_LEAN);
      assert.equal(you[k].total, base[k].total - STEER_LEAN);
    } else {
      assert.equal(part, undefined, `${k} is untouched`);
      assert.equal(you[k].total, base[k].total);
    }
  }
  const half = leans(inp, mem, THEMES[1], { static: 0.5 });
  assert.equal(half.static.parts.find((p) => p.why === 'you').v, STEER_LEAN / 2);
  const centre = leans(inp, mem, THEMES[1], { flute: 0, static: 0 });
  assert.deepEqual(centre, base, 'centre is exactly the DJ alone');
  const clamped = leans(inp, mem, THEMES[1], { drone: 7 });
  assert.equal(clamped.drone.parts.find((p) => p.why === 'you').v, STEER_LEAN, 'a push is clamped to one');
});

test('the DJ records a steer as a lean the lights settle with, never as the choice itself (a clamp is the control)', () => {
  const a = createDJ({ seed: 7, theme: 'highlands' });
  const b = createDJ({ seed: 7, theme: 'highlands' });
  const c = createDJ({ seed: 7, theme: 'highlands' });
  b.steer('flute', -1);
  c.clamp('flute', false);
  let leaned = 0;
  let aYes = 0;
  let bYes = 0;
  let cYes = 0;
  for (let k = 0; k < 24; k++) {
    const da = a.bar(cooling(k));
    const db = b.bar(cooling(k));
    const dc = c.bar(cooling(k));
    if (db.leans.flute.parts.some((p) => p.why === 'you' && p.v === -STEER_LEAN)) leaned++;
    assert.equal(db.clamps.flute, null, 'a steer is not a clamp');
    assert.equal(db.steer.leans.flute, -1, 'the decision carries the steering');
    assert.deepEqual(da.steer.leans, Object.fromEntries(KEYS.map((x) => [x, 0])), 'the unsteered DJ carries zeros');
    aYes += da.yes.flute ? 1 : 0;
    bYes += db.yes.flute ? 1 : 0;
    cYes += dc.yes.flute ? 1 : 0;
  }
  assert.equal(leaned, 24, 'the lean is in every bar');
  assert.equal(cYes, 0, 'the clamp forces no');
  assert.ok(bYes < aYes, `the lean argues the flute down (${bYes} yes bars against ${aYes})`);
  assert.deepEqual(b.steers, { ...Object.fromEntries(KEYS.map((x) => [x, 0])), flute: -1 });
  b.steer('flute', 0);
  assert.equal(b.steers.flute, 0);
  assert.equal(b.bar(cooling(30)).leans.flute.parts.some((p) => p.why === 'you'), false, 'back at centre the part is gone');
});

test('a wanted beat or theme decides where a change lands, never whether it happens', () => {
  const r = () => 0.99;
  assert.equal(pickBeat(r, THEMES[1], 40, 0, 10), 10, 'the wanted beat');
  assert.equal(pickBeat(r, THEMES[1], 10, 0, 10) !== 10, true, 'the same beat again is no change, so the pool decides');
  assert.equal(pickBeat(r, THEMES[1], 10, 0, null) !== 10, true, 'no want: as before');
  assert.equal(pickTheme(r, 'crystals', 'embers').key, 'embers');
  assert.notEqual(pickTheme(r, 'embers', 'embers').key, 'embers', 'never the theme we are leaving');
  const dj = createDJ({ seed: 3, theme: 'highlands' });
  dj.wantBeat(14);
  dj.wantTheme('deepsea');
  dj.clamp('beat', true);
  const d = dj.bar(cooling(1));
  assert.equal(d.beat, 14);
  assert.deepEqual(dj.wanted, { beat: 14, theme: 'deepsea' });
  dj.clamp('beat', null);
  dj.clamp('theme', true);
  const e = dj.bar(cooling(2));
  assert.equal(e.theme.key, 'deepsea');
  assert.equal(e.beat, 14, 'a theme change lands on the wanted beat too');
  dj.wantBeat(null);
  dj.wantTheme('nope');
  assert.deepEqual(dj.wanted, { beat: null, theme: null }, 'an unknown theme and a null beat are the DJ alone');
});

test('the store: STEER_IDLE is centre everywhere; patch merges; reset returns to centre and keeps the skip count', () => {
  assert.ok(isIdleSteer(STEER_IDLE));
  assert.deepEqual(Object.keys(STEER_IDLE.leans), KEYS);
  assert.deepEqual(Object.keys(STEER_IDLE.tracks), TRACKS);
  assert.deepEqual(STEER_TRACKS, TRACKS, 'one list of tracks');
  assert.deepEqual(STEER_BEATS, [40, 14, 10, 7.83, 6, 3]);
  assert.deepEqual(STEER_THEMES, THEMES.map((t) => t.key));
  const seen = [];
  const off = djSteer.subscribe((s) => seen.push(s));
  djSteer.patch({ leans: { beat: 1 } });
  djSteer.patch({ tracks: { harp: false }, wantBeat: 10, holdBeat: true, skips: 2 });
  const s = djSteer.get();
  assert.equal(s.leans.beat, 1);
  assert.equal(s.leans.flute, 0, 'a patch merges the leans');
  assert.equal(s.tracks.harp, false);
  assert.equal(s.tracks.flute, null);
  assert.equal(isIdleSteer(s), false);
  djSteer.reset();
  assert.ok(isIdleSteer(djSteer.get()));
  assert.equal(djSteer.get().skips, 2, 'a skip already taken is not untaken');
  assert.equal(seen.length, 3);
  off();
});

test('applySteer calls the real hooks for what moved, with a fake api that records the calls; reset undoes every one', () => {
  const calls = [];
  const api = {
    dj: { steer: (k, v) => calls.push(['steer', k, v]), wantBeat: (v) => calls.push(['wantBeat', v]), wantTheme: (v) => calls.push(['wantTheme', v]) },
    holdBeat: (v) => calls.push(['holdBeat', v]),
    lockTheme: (v) => calls.push(['lockTheme', v]),
    setTrack: (t, v) => calls.push(['setTrack', t, v]),
    nextTune: () => calls.push(['nextTune']),
    play: () => calls.push(['play']),
  };
  const full = {
    leans: { ...STEER_IDLE.leans, drone: 1, split: -1 },
    tracks: { ...STEER_IDLE.tracks, bells: false },
    wantBeat: 7.83, wantTheme: 'embers', holdBeat: true, lockTheme: true, skips: 1,
  };
  const made = applySteer(api, full, STEER_IDLE);
  assert.deepEqual(made, calls);
  assert.deepEqual(calls.sort(), [
    ['holdBeat', true], ['lockTheme', true], ['nextTune'], ['setTrack', 'bells', false],
    ['steer', 'drone', 1], ['steer', 'split', -1], ['wantBeat', 7.83], ['wantTheme', 'embers'],
  ].sort());
  assert.equal(calls.some((c) => c[0] === 'play'), false, 'a steer never starts sound');
  calls.length = 0;
  assert.deepEqual(applySteer(api, full, full), [], 'nothing moved, nothing called');
  applySteer(api, { ...STEER_IDLE, skips: 1 }, full);
  assert.deepEqual(calls.sort(), [
    ['holdBeat', false], ['lockTheme', false], ['setTrack', 'bells', true],
    ['steer', 'drone', 0], ['steer', 'split', 0], ['wantBeat', null], ['wantTheme', null],
  ].sort(), 'reset returns every control to the DJ, and does not skip again');
});

test('every one of the twenty site controls has a real hook here: 6 leans, 8 tracks, wanted beat and theme, two holds, skip, reset', () => {
  const dj = createDJ({ seed: 1 });
  for (const k of KEYS) { dj.steer(k, 1); assert.equal(dj.steers[k], 1, k); }
  const s = createSymphony({ seed: 1, auto: false, steer: fakeStore() });
  for (const t of TRACKS) { s.setTrack(t, false); assert.equal(s.tracks[t], false, t); }
  assert.equal(typeof s.holdBeat, 'function');
  assert.equal(typeof s.lockTheme, 'function');
  assert.equal(typeof s.nextTune, 'function');
  assert.equal(typeof s.dj.wantBeat, 'function');
  assert.equal(typeof s.dj.wantTheme, 'function');
  assert.equal(KEYS.length + TRACKS.length + 2 + 2 + 1 + 1, 20);
  s.dispose();
});

test('the symphony reads its store once a bar: a steer lands on the next bar line, and the state says so', () => {
  const st = fakeStore();
  const s = createSymphony({ seed: 5, theme: 'highlands', auto: false, steer: st });
  s.update(cooling(0));
  s.tick(100);
  assert.deepEqual(s.state.steers, Object.fromEntries(KEYS.map((k) => [k, 0])));
  st.set({ ...STEER_IDLE, leans: { ...STEER_IDLE.leans, static: 1 }, tracks: { ...STEER_IDLE.tracks, harp: false }, wantTheme: 'embers' });
  assert.equal(s.state.steers.static, 0, 'not yet: it waits for the bar line');
  assert.equal(s.tracks.harp, true);
  for (let k = 1; k < 8; k++) { s.update(cooling(k)); s.tick(100 + k * 3); }
  assert.equal(s.state.steers.static, 1);
  assert.equal(s.tracks.harp, false);
  assert.equal(s.state.wanted.theme, 'embers');
  assert.equal(s.state.decision.leans.static.parts.some((p) => p.why === 'you'), true);
  st.set(STEER_IDLE);
  for (let k = 8; k < 16; k++) { s.update(cooling(k)); s.tick(100 + k * 3); }
  assert.equal(s.state.steers.static, 0);
  assert.equal(s.tracks.harp, true, 'reset puts the track back');
  s.dispose();
});

// a fake AudioContext, as the symphony tests use, so MUTE ALL can be checked against real scheduling
const made = [];
class Param {
  constructor(v) { this.value = v; }
  setValueAtTime(v) { this.value = v; }
  setTargetAtTime(v) { this.value = v; }
  linearRampToValueAtTime(v) { this.value = v; }
  exponentialRampToValueAtTime(v) { this.value = v; }
  cancelScheduledValues() {}
}
class Node {
  constructor(kind, params = {}) { this.kind = kind; this.out = []; Object.assign(this, params); made.push(this); }
  connect(n) { this.out.push(n); return n; }
  disconnect() { this.out = []; }
}
class Ctx {
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = new Node('destination'); }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
  createGain() { return new Node('gain', { gain: new Param(1) }); }
  createBiquadFilter() { return new Node('biquad', { type: 'lowpass', frequency: new Param(350), Q: new Param(1), gain: new Param(0) }); }
  createDynamicsCompressor() { return new Node('compressor', { threshold: new Param(-24), knee: new Param(30), ratio: new Param(12), attack: new Param(0.003), release: new Param(0.25) }); }
  createConvolver() { return new Node('convolver', { buffer: null }); }
  createDelay() { return new Node('delay', { delayTime: new Param(0) }); }
  createStereoPanner() { return new Node('panner', { pan: new Param(0) }); }
  createChannelMerger(n) { return new Node('merger', { inputs: n }); }
  createOscillator() { return new Node('osc', { type: 'sine', frequency: new Param(440), detune: new Param(0), start() {}, stop() {}, onended: null }); }
  createBufferSource() { return new Node('src', { buffer: null, loop: false, playbackRate: new Param(1), start() {}, stop() {} }); }
  createBuffer(ch, n, rate) { const data = Array.from({ length: ch }, () => new Float32Array(n)); return { numberOfChannels: ch, length: n, sampleRate: rate, getChannelData: (c) => data[c] }; }
}

test('MUTE ALL still silences a steered symphony: a steer under mute schedules no voice and starts nothing', () => {
  configure({ createContext: () => new Ctx() });
  unlockNow();
  const E = getEngine();
  assert.ok(E);
  const st = fakeStore();
  const s = createSymphony({ seed: 9, theme: 'highlands', auto: false, steer: st });
  sound.setMuted(true);
  st.set({ ...STEER_IDLE, leans: { ...STEER_IDLE.leans, flute: 1, static: -1 }, wantBeat: 10, skips: 1 });
  const before = made.length;
  for (let k = 0; k < 10; k++) { E.ctx.currentTime = 50 + k * 3; s.update(cooling(k)); s.tick(50 + k * 3); }
  assert.equal(made.slice(before).filter((n) => n.kind === 'osc').length, 0, 'no oscillator under MUTE ALL');
  assert.equal(s.state.steers.flute, 1, 'the steer was still taken at the bar line');
  assert.equal(s.state.audible, false);
  sound.setMuted(false);
  s.dispose();
});

test('the DJ panel marks the visitor\'s lean: WhyList keeps the part named you first and the stylesheet marks it', () => {
  assert.match(jsx, /p\.why === 'you'/);
  assert.match(jsx, /is-you/);
  assert.match(css, /\.dj-why \.is-you \{[^}]*font-weight: 600/);
  assert.doesNotMatch(jsx + css, /[–—]/, 'no en or em dashes');
});
