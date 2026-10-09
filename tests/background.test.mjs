// SOUNDDOCTOR: the sound keeps playing in the background like a video (a hidden tab, an idle reader), stops only
// for MUTE ALL, PAUSE ALL or nothing to hear (then the context is suspended, never left running silent), and comes
// back by itself after the system suspends or interrupts it. Each test failed on the engine before lane SOUNDDOCTOR.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, Node } from './fakeaudio.mjs';

const win = new EventTarget();
const doc = Object.assign(new EventTarget(), { hidden: false });
globalThis.window = win;
globalThis.document = doc;

// a fake context that reports statechange, as a browser does
class StateCtx extends Ctx {
  constructor() {
    super();
    this.ev = new EventTarget();
    this.calls = [];
  }
  addEventListener(...a) { this.ev.addEventListener(...a); }
  removeEventListener(...a) { this.ev.removeEventListener(...a); }
  set(state) { this.state = state; this.ev.dispatchEvent(new Event('statechange')); }
  resume() { this.calls.push('resume'); this.set('running'); return Promise.resolve(); }
  suspend() { this.calls.push('suspend'); this.set('suspended'); return Promise.resolve(); }
  getOutputTimestamp() { return { contextTime: this.currentTime, performanceTime: 0 }; }
}

let ctx = null;
const engine = await import('../src/engine.js');
engine.configure({ createContext: () => (ctx = new StateCtx()), sleepMs: 30 });
const { sound } = await import('../src/control.js');
const { createGammaSound } = await import('../src/binaural.js');
const { createHearing, STALE_MS } = await import('../src/hear.js');
const { createSymphony } = await import('../src/symphony.js');
const { makeVoice } = await import('../src/voices.js');
const { heroBus } = await import('../src/heroinput.js');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ticker = (state) => win.dispatchEvent(Object.assign(new Event('settle:ticker'), { detail: { state, reason: state } }));
const hide = (h) => { doc.hidden = h; doc.dispatchEvent(new Event('visibilitychange')); };

engine.unlockNow();
sound.setMuted(false);

test('a hidden tab keeps the sound: the context runs and the mute gain stays open', async () => {
  const g = createGammaSound({ mode: 'alpha-calm', level: 0.5 });
  await wait(50);
  assert.equal(ctx.state, 'running');
  hide(true);
  ticker('hidden');
  await wait(400);
  assert.equal(ctx.state, 'running', 'the context was suspended in a hidden tab');
  assert.equal(engine.getEngine().mute.gain.value, 1, 'the mute gain closed in a hidden tab');
  hide(false);
  ticker('running');
  g.dispose();
  await wait(60);
});

test('an idle reader (five minutes, the ticker away) keeps the sound', async () => {
  const g = createGammaSound({ mode: 'theta-deep', level: 0.5 });
  await wait(50);
  ticker('away');
  await wait(400);
  assert.equal(ctx.state, 'running', 'the context was suspended for an idle reader');
  assert.equal(engine.isAway(), false, 'an idle reader is not PAUSE ALL');
  ticker('running');
  g.dispose();
  await wait(60);
});

test('PAUSE ALL (the ticker held) still silences and suspends', async () => {
  const g = createGammaSound({ mode: 'delta-sleep', level: 0.5 });
  await wait(50);
  ticker('held');
  await wait(400);
  assert.equal(engine.isAway(), true);
  assert.equal(ctx.state, 'suspended');
  ticker('running');
  await wait(50);
  assert.equal(ctx.state, 'running', 'PAUSE ALL off resumes');
  g.dispose();
  await wait(60);
});

test('MUTE ALL still silences and suspends, and unmuting resumes', async () => {
  const g = createGammaSound({ mode: 'love-528', level: 0.5 });
  await wait(50);
  sound.setMuted(true);
  await wait(400);
  assert.equal(ctx.state, 'suspended');
  sound.setMuted(false);
  await wait(50);
  assert.equal(ctx.state, 'running');
  g.dispose();
  await wait(60);
});

test('a master level of 0 is MUTE ALL to the context: it suspends, and any level above 0 resumes (lane HEROPASS)', async () => {
  const g = createGammaSound({ mode: 'love-528', level: 0.5 });
  await wait(50);
  assert.equal(ctx.state, 'running');
  const was = engine.getMaster();
  engine.setMaster(0);
  // poll rather than sleep a fixed time: this file's hidden-tab symphony test below breaks when the file runs long
  // under load (measured: +900 ms of waiting reds it 8 runs in 10 with 10 files in parallel, +500 ms never)
  for (let i = 0; i < 100 && ctx.state !== 'suspended'; i++) await wait(10);
  assert.equal(ctx.state, 'suspended', 'the volume at 0% left the context running silent');
  assert.equal(engine.getEngine().mute.gain.value, 0, 'the mute gain closes as MUTE ALL closes it');
  assert.equal(sound.muted, false, 'it is not MUTE ALL itself: the switch is untouched');
  engine.setMaster(0.05);
  await wait(30);
  assert.equal(ctx.state, 'running', 'a level above 0 wakes it');
  // a level that only moves above 0 never suspends (the control): no sleep is armed at all
  engine.setMaster(0.6);
  assert.equal(engine.getEngine().sleep ?? null, null, 'a level above 0 armed a suspend');
  assert.equal(ctx.state, 'running');
  engine.setMaster(was);
  g.dispose();
  await wait(60);
});

test('nothing to hear: the context is suspended, never left running silent; a sound wakes it', async () => {
  const g = createGammaSound({ mode: 'gamma-focus', level: 0.5 });
  await wait(50);
  assert.equal(ctx.state, 'running');
  g.stop();
  await wait(300);
  assert.equal(ctx.state, 'suspended', 'a stopped sound left the context running silent');
  g.play();
  await wait(50);
  assert.equal(ctx.state, 'running', 'playing again did not resume the context');
  g.dispose();
  await wait(300);
  assert.equal(ctx.state, 'suspended');
});

test('negative control: a sound that plays keeps the context running past the sleep delay', async () => {
  const g = createGammaSound({ mode: 'beta-study', level: 0.5 });
  await wait(300);
  assert.equal(ctx.state, 'running');
  g.dispose();
  await wait(300);
});

test('the system suspends or interrupts the context while sound is wanted: the engine resumes it', async () => {
  const g = createGammaSound({ mode: 'schumann', level: 0.5 });
  await wait(50);
  ctx.calls.length = 0;
  ctx.set('interrupted');
  await wait(50);
  assert.ok(ctx.calls.includes('resume'), 'no resume after an interruption');
  assert.equal(ctx.state, 'running');
  ctx.calls.length = 0;
  ctx.set('suspended');
  await wait(50);
  assert.ok(ctx.calls.includes('resume'), 'no resume after a system suspend');
  g.dispose();
  await wait(300);
  ctx.calls.length = 0;
  ctx.set('running');
  ctx.set('suspended'); // nothing wanted now: no fight
  await wait(50);
  assert.ok(!ctx.calls.includes('resume'), 'resumed a context nobody wants to hear');
});

test('the picture halted by a hidden tab: the static holds its last sound rather than falling quiet', async () => {
  const h = createHearing({ preset: 'crackle', playing: true });
  const st = { T: 1.2, flips: 50, n: 400, ePer: -0.5, q: 0.5, phase: 'cooling', index: 0, power: 0, maxPower: 8, sweeps: 1 };
  h.update(st);
  await wait(30);
  hide(true);
  ticker('hidden');
  await wait(STALE_MS + 300);
  assert.equal(engine.getEngine().ctx.state, 'running', 'the context stopped while the static should hold');
  assert.ok(engine.soundWanted(), 'the static fell quiet in a hidden tab');
  hide(false);
  ticker('running');
  h.dispose();
  await wait(60);
});

test('negative control: a picture the reader paused (stats stop, tab visible) falls quiet', async () => {
  const h = createHearing({ preset: 'crackle', playing: true });
  h.update({ T: 1.2, flips: 50, n: 400, ePer: -0.5, q: 0.5, phase: 'cooling', index: 0, power: 0, maxPower: 8, sweeps: 1 });
  await wait(STALE_MS + 300);
  assert.equal(engine.soundWanted(), false, 'a paused picture kept its static');
  h.dispose();
  await wait(60);
});

test('the symphony keeps scheduling bars in a hidden tab, far enough ahead for a throttled timer', async () => {
  const S = createSymphony({ seed: 7, auto: false, playing: true });
  await wait(20);
  const E = engine.getEngine();
  hide(true);
  E.ctx.currentTime = 50;
  S.tick();
  const bar0 = S.state.decision?.bar ?? -1;
  E.ctx.currentTime = 50.2;
  S.tick();
  const st = S.state;
  assert.ok(st.audible, 'the symphony is not audible in a hidden tab');
  assert.ok((st.decision?.bar ?? -1) >= bar0 && st.decision, 'no bar was decided in a hidden tab');
  hide(false);
  S.dispose();
  await wait(60);
});

test('a grain voice fills a long window: a 1.5 s look-ahead is not capped at 12 grains', () => {
  const c = new Ctx();
  const out = c.createGain();
  const v = makeVoice('crackle', c, out);
  v.update({ grains: 60, level: 1 }, 0);
  let n = 0;
  const orig = c.createBufferSource.bind(c);
  c.createBufferSource = () => { n += 1; return orig(); };
  v.tick(0, 1.5);
  assert.ok(n > 12, `only ${n} grains in a 1.5 s window`);
});

test('a mode swap frees its vocoder from the hero bus (no edge left to a dead node)', async () => {
  const g = createGammaSound({ mode: 'alpha-calm', level: 0.5 });
  await wait(30);
  const bus = heroBus(engine.getEngine());
  const edges0 = bus.out.size;
  for (const m of ['beta-study', 'gamma-focus', 'theta-deep', 'alpha-calm']) g.setMode(m, { fade: 0.01 });
  await wait(700);
  assert.ok(bus.out.size <= edges0, `the hero bus grew from ${edges0} to ${bus.out.size} edges`);
  assert.ok([...bus.out].every((n) => n instanceof Node));
  g.dispose();
  await wait(60);
});
