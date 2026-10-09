// THE DUCK (lane DROPDUCK, navigator 2026-10-06: "Add the duck."): on every drag-box drop THE DJ's bus dips 3 to 4 dB
// for about 300 ms, a short attack and a smooth release, on dj-fx.js's bus before its limiter and never on the
// binaural pair. Once per drop, never per noise; nothing under MUTE ALL or PAUSE ALL; never for the machine's own
// waves; never for a single click. Each test here fails on the code before the lane: there was no duck at all.
import test from 'node:test';
import assert from 'node:assert/strict';

const win = new EventTarget();
win.innerWidth = 1000;
win.scrollX = 0;
globalThis.window = win;
const { Ctx, all, reach } = await import('./fakeaudio.mjs');
const hear = await import('../src/index.js');
const { configure, unlockNow, sound, loadSfxModules, armClickNoises, createClickCards, CLICK_NOISES, DROP_CARDS, createFxBus,
  createSymphony, DUCK, duckGainAt, duckShape, duckDrop, duckTargets, registerDuckTarget, onDuck } = hear;

if (!Ctx.prototype.createConstantSource) {
  Ctx.prototype.createConstantSource = function () {
    const n = this.createBufferSource();
    n.kind = 'src';
    n.offset = n.playbackRate;
    return n;
  };
}
await loadSfxModules();
configure({ createContext: () => new Ctx() });
const E = unlockNow();
sound.setMuted(false);

const dB = (g) => 20 * Math.log10(g);
const say = (state) => win.dispatchEvent(Object.assign(new Event('settle:ticker'), { detail: { state } }));
// a bus that records every duck it is asked for
const spyBus = () => {
  const calls = [];
  const bus = { duck: (t) => { calls.push(t); return true; } };
  const off = registerDuckTarget(bus);
  return { calls, off };
};
// a seed whose first lock deals a click card the drop keeps, so every birth plays the same card
const clickSeed = (() => {
  for (let s = 1; s < 5000; s++) {
    const v = createClickCards({ clickCount: CLICK_NOISES.length, seed: s }).next();
    if (Number.isInteger(v) && DROP_CARDS.includes(v)) return s;
  }
  throw new Error('no click seed');
})();
// one drop's four births, as settle-see sends them on the window (global.js ripple detail with drag and part)
const births = (drag, extra = {}) => {
  for (let part = 0; part < 4; part++) {
    win.dispatchEvent(Object.assign(new Event('settle:ripple'), { detail: { x: 500, y: 10, strength: 0.6, kind: 'drop', scope: 'local', source: 'hero', sound: true, drag, part, ...extra } }));
  }
};

test('THE DUCK\'s depth is 3 to 4 dB', () => {
  const s = duckShape();
  assert.ok(s.depthDb >= 3 && s.depthDb <= 4, `depth ${s.depthDb} dB`);
});

test('THE DUCK lasts about 300 ms: the bus sits more than half the depth down for 270 to 330 ms', () => {
  const s = duckShape();
  assert.ok(s.lengthMs >= 270 && s.lengthMs <= 330, `length ${s.lengthMs} ms`);
});

test('the attack is short: 90% of the depth within 30 ms', () => {
  assert.ok(dB(duckGainAt(0.03)) <= -0.9 * DUCK.depthDb, `${dB(duckGainAt(0.03)).toFixed(3)} dB at 30 ms`);
});

test('the release is smooth: no 1 ms step larger than 0.1 dB, and back within 0.1 dB by 600 ms', () => {
  let worst = 0;
  for (let t = DUCK.hold + 0.001; t < 0.8; t += 0.001) worst = Math.max(worst, Math.abs(dB(duckGainAt(t)) - dB(duckGainAt(t - 0.001))));
  assert.ok(worst <= 0.1, `largest 1 ms step ${worst.toFixed(4)} dB`);
  assert.ok(dB(duckGainAt(0.6)) > -0.1, `${dB(duckGainAt(0.6)).toFixed(3)} dB at 600 ms`);
});

test('the gain is 1 before a duck starts and long after it ends', () => {
  assert.equal(duckGainAt(-0.1), 1);
  assert.ok(1 - duckGainAt(5) < 1e-9);
});

test('the duck gain sits on THE DJ\'s bus between THE WOBBLE and the bus limiter, at 1 at rest', () => {
  const ctx = new Ctx();
  const bus = createFxBus({ ctx, master: ctx.createGain() });
  const { trem, duck, limit } = bus.nodes;
  assert.ok(duck && duck.kind === 'gain', 'a duck gain exists');
  assert.equal(duck.gain.value, 1);
  assert.deepEqual([...trem.out], [duck], 'THE WOBBLE feeds only the duck');
  assert.deepEqual([...duck.out], [limit], 'the duck feeds only the limiter');
  bus.dispose();
});

test('every path from the bus input to the limiter passes through the duck', () => {
  const ctx = new Ctx();
  const bus = createFxBus({ ctx, master: ctx.createGain() });
  bus.apply({ reverb: 0.4, delay: 0.3, feedback: 0.4, drive: 0.5, gain: 2, mode: 'fold', hz: 900, Q: 3, res: 3, tone: 8000, size: 0.5, time: 0.5 }, 0);
  const { duck, limit } = bus.nodes;
  const saved = [...duck.out];
  duck.out.clear(); // cut the duck: nothing else may reach the limiter
  assert.equal(reach(bus.input).has(limit), false);
  for (const n of saved) duck.out.add(n);
  bus.dispose();
});

test('bus.duck(t) schedules the dip: down to the depth at t, back to 1 at t + hold', () => {
  const ctx = new Ctx();
  const bus = createFxBus({ ctx, master: ctx.createGain() });
  assert.equal(bus.duck(2), true);
  const ev = bus.nodes.duck.gain.events;
  assert.deepEqual(ev.map((e) => e[0]), ['target', 'target']);
  assert.ok(Math.abs(dB(ev[0][1]) + DUCK.depthDb) < 1e-9 && ev[0][2] === 2 && ev[0][3] === DUCK.attack, `down ${JSON.stringify(ev[0])}`);
  assert.ok(ev[1][1] === 1 && Math.abs(ev[1][2] - (2 + DUCK.hold)) < 1e-12 && ev[1][3] === DUCK.release, `back ${JSON.stringify(ev[1])}`);
  bus.dispose();
});

test('a live DJ bus joins THE DUCK, and leaves it when disposed', () => {
  const ctx = new Ctx();
  const bus = createFxBus({ ctx, master: ctx.createGain() });
  assert.ok(duckTargets().includes(bus));
  bus.dispose();
  assert.equal(duckTargets().includes(bus), false);
});

test('THE HERO SYMPHONY\'s bus is ducked by a drop', () => {
  const s = createSymphony({ seed: 41, theme: 'highlands', auto: false, steer: null, votes: null });
  for (let k = 0; k < 20; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  // the symphony's bus is the newest live target (a disposed symphony lets its bus go 700 ms later)
  const bus = duckTargets().at(-1);
  assert.equal(reach(bus.nodes.duck).has(E.master), true, 'the duck reaches the master');
  assert.equal(bus.nodes.duck.gain.events.length, 0, 'at rest before the drop');
  duckDrop({});
  assert.equal(bus.nodes.duck.gain.events.length, 2, 'the drop scheduled the dip');
  s.dispose();
});

test('the binaural pair never meets the duck', () => {
  const m0 = all.length;
  const s = createSymphony({ seed: 42, theme: 'highlands', auto: false, steer: null, votes: null });
  for (let k = 0; k < 20; k++) { E.ctx.currentTime += 0.5; s.tick(); }
  const duck = duckTargets().at(-1).nodes.duck;
  // the binaural pair's shape (instruments.js makeBinaural): a two-input merger fed by two ear gains of 0.5, each fed
  // by one sine oscillator. The house's mergers feed the bus and do not have this shape
  const made = all.slice(m0);
  const into = (n) => made.filter((x) => x.out.has(n));
  const ear = (g) => g.kind === 'gain' && g.gain.value === 0.5 && into(g).length === 1 && into(g)[0].kind === 'osc' && into(g)[0].type === 'sine';
  const pairs = made.filter((n) => n.kind === 'merger' && into(n).length === 2 && into(n).every(ear) && reach(n).has(E.master));
  assert.equal(pairs.length, 1, 'the binaural pair is built and reaches the master');
  for (const m of pairs) assert.equal(reach(m).has(duck), false, 'the pair reaches the master around the duck');
  s.dispose();
});

test('duckDrop ducks every live bus and tells it', () => {
  const { calls, off } = spyBus();
  const told = [];
  const offT = onDuck((d) => told.push(d));
  assert.ok(duckDrop({ from: 'user' }) >= 1);
  assert.equal(calls.length, 1);
  assert.deepEqual(told.map((d) => [d.ok, d.reason]), [[true, null]]);
  off(); offT();
});

test('MUTE ALL: no duck', () => {
  const { calls, off } = spyBus();
  sound.setMuted(true);
  try {
    assert.equal(duckDrop({}), 0);
    assert.equal(calls.length, 0);
  } finally { sound.setMuted(false); off(); }
});

test('PAUSE ALL: no duck', () => {
  const { calls, off } = spyBus();
  say('held');
  try {
    assert.equal(duckDrop({}), 0);
    assert.equal(calls.length, 0);
  } finally { say('running'); off(); }
});

test('the machine\'s own waves never duck: the sound\'s pops and the key steps', () => {
  const { calls, off } = spyBus();
  const told = [];
  const offT = onDuck((d) => told.push(d.reason));
  assert.equal(duckDrop({ from: 'sound' }), 0);
  assert.equal(duckDrop({ from: 'keys' }), 0);
  assert.equal(calls.length, 0);
  assert.deepEqual(told, ['machine', 'machine']);
  off(); offT();
});

test('a drop through the page: four births duck THE DJ once', () => {
  const { calls, off } = spyBus();
  const offC = armClickNoises({ win, seed: clickSeed, now: () => 1000 });
  births(101);
  assert.equal(calls.length, 1);
  offC(); off();
});

test('two drops through the page duck twice', () => {
  const { calls, off } = spyBus();
  let clock = 2000;
  const offC = armClickNoises({ win, seed: clickSeed, now: () => clock });
  births(201);
  clock += 400;
  births(202);
  assert.equal(calls.length, 2);
  offC(); off();
});

test('a drop THE NOISE GATE held back plays nothing and ducks nothing', () => {
  const { calls, off } = spyBus();
  const offC = armClickNoises({ win, seed: clickSeed, now: () => 3000 });
  births(301, { sound: false });
  assert.equal(calls.length, 0);
  offC(); off();
});

test('a single click never ducks', () => {
  const { calls, off } = spyBus();
  const offC = armClickNoises({ win, seed: clickSeed, now: () => 4000 });
  win.dispatchEvent(Object.assign(new Event('settle:ripple'), { detail: { x: 500, y: 10, strength: 0.6, kind: 'ripple', scope: 'local', source: 'hero', sound: true } }));
  assert.equal(calls.length, 0);
  offC(); off();
});

test('a drop carrying a machine family never ducks', () => {
  const { calls, off } = spyBus();
  const offC = armClickNoises({ win, seed: clickSeed, now: () => 5000 });
  births(501, { from: 'keys' });
  assert.equal(calls.length, 0);
  offC(); off();
});

test('a drop under MUTE ALL ducks nothing', () => {
  const { calls, off } = spyBus();
  const offC = armClickNoises({ win, seed: clickSeed, now: () => 6000 });
  sound.setMuted(true);
  try {
    births(601);
    assert.equal(calls.length, 0);
  } finally { sound.setMuted(false); offC(); off(); }
});
