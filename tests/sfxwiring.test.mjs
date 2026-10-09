// THE SFX WIRING (lane SWORDSWISH): the two decks found in any landing order, the sword-swish deck's shape and tone
// rules on the graph, playSfx's rules (THE START RULE, MUTE ALL, a hidden page), THE CLICK LOCK dealing one sword
// card in four, the page trigger, and the machine's random waves. A lane file that has not landed is reported OWED.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, all, reach } from './fakeaudio.mjs';
import {
  configure, unlockNow, getEngine, sound, CLICK_NOISES, CLICK_TONE, playClickNoise, armClickNoises,
  SFX, SFX_FILES, sfxDecks, loadSfxModules, sfxById, playSfx, onSfx, createClickCards, shareDeck, sfxPage, armSfx, resetSfx,
} from '../src/index.js';
import { SWORD_SWISH } from '../src/sfx-sword-swish.js';

// the fake context has no ConstantSource; a lane may use one (it is in the node subset), so give the fake one here
if (!Ctx.prototype.createConstantSource) {
  Ctx.prototype.createConstantSource = function () {
    const n = this.createBufferSource();
    n.kind = 'src';
    n.offset = n.playbackRate;
    return n;
  };
}
const decks = await loadSfxModules();

for (const f of SFX_FILES) {
  if (decks.owed.includes(f.lane)) test.todo(`OWED: ${f.lane}'s ${f.file} (${f.name}) has not landed; its deck plays empty`);
}

test('the loader finds every landed lane file and reports the rest as owed, never failing an import', () => {
  assert.ok(decks.found >= 1, 'at least this lane\'s file');
  assert.ok(!decks.owed.includes('SWORDSWISH'));
  const landed = SFX_FILES.filter((f) => !decks.owed.includes(f.lane));
  assert.equal(decks.sword.length + decks.radial.length, decks.all.length);
  for (const f of landed) assert.ok(decks.all.some((e) => e.lane === f.lane), `${f.lane} dealt`);
  assert.equal(sfxById(SWORD_SWISH[0].id), SWORD_SWISH[0]);
  assert.equal(sfxById('no-such-sound'), null);
  assert.equal(new Set(decks.all.map((e) => e.id)).size, decks.all.length, 'ids unique over every landed deck');
});

test('THE SWORD SWISH DECK: 25 frozen entries, prefixed ids, the sword deck, a procedural recipe each', () => {
  assert.equal(SWORD_SWISH.length, 25);
  assert.ok(Object.isFrozen(SWORD_SWISH));
  assert.equal(new Set(SWORD_SWISH.map((e) => e.id)).size, 25);
  assert.equal(new Set(SWORD_SWISH.map((e) => e.name)).size, 25);
  const kinds = new Set(SWORD_SWISH.map((e) => e.kind));
  for (const k of ['swish', 'whoosh', 'swing', 'slash', 'draw', 'shing']) assert.ok(kinds.has(k), `a ${k}`);
  for (const e of SWORD_SWISH) {
    assert.ok(Object.isFrozen(e));
    assert.match(e.id, /^swish-\d\d-[a-z0-9-]+$/);
    assert.equal(e.deck, 'sword');
    assert.equal(e.lane, 'SWORDSWISH');
    assert.ok(e.dur > 0.05 && e.dur <= 1.5, `${e.id} dur ${e.dur}`);
    assert.equal(e.provenance.method, 'procedural');
    assert.match(e.provenance.made, /^\d{4}-\d\d-\d\d$/);
    assert.ok(e.provenance.recipe.length > 20);
  }
});

const SUBSET = new Set(['gain', 'osc', 'biquad', 'shaper', 'src', 'delay', 'panner']);
const renderOn = (e, seed = 1, strength = 1) => {
  const ctx = new Ctx();
  const dest = ctx.createGain();
  const start = all.length;
  const end = e.render(ctx, 0.05, dest, { strength, seed });
  return { ctx, dest, end, made: all.slice(start) };
};

test('every swish builds only the node subset, ends where it says, and reaches dest through a low-pass at or below 9 kHz', () => {
  for (const e of SWORD_SWISH) {
    const { dest, end, made } = renderOn(e);
    assert.ok(Number.isFinite(end) && end > 0.05 && end <= 0.05 + e.dur + 0.1, `${e.id} end ${end}`);
    for (const n of made) assert.ok(SUBSET.has(n.kind), `${e.id}: ${n.kind} is outside the subset`);
    // the one node that feeds dest is a low-pass at or below 9 kHz
    const feeders = made.filter((n) => n.out.has(dest));
    assert.equal(feeders.length, 1, `${e.id} one feeder`);
    assert.equal(feeders[0].kind, 'biquad');
    assert.equal(feeders[0].type, 'lowpass');
    assert.ok(feeders[0].frequency.value <= 9000, `${e.id} final low-pass ${feeders[0].frequency.value}`);
    // every source is started and reaches dest, or modulates a parameter, or is the silent keeper (a zero gain)
    for (const s of made.filter((n) => n.kind === 'osc' || n.kind === 'src')) {
      assert.ok(s.started && s.stopped, `${e.id} source started and stopped`);
      const r = reach(s);
      const modulates = [...r].some((x) => [...x.out].some((o) => o?.kind === 'param'));
      const keeper = s.out.size === 0 || (s.out.size === 1 && [...s.out][0].kind === 'gain' && [...s.out][0].gain.value === 0);
      assert.ok(r.has(dest) || modulates || keeper, `${e.id} a ${s.kind} that goes nowhere`);
    }
  }
});

test('THE TONE RULES on the graph: envelopes from zero to zero within the floors, raw saw and square low-passed first', () => {
  for (const e of SWORD_SWISH) {
    const { made } = renderOn(e);
    const envs = made.filter((n) => n.kind === 'gain' && n.gain.events.length && n.gain.events[0][0] === 'set' && n.gain.events[0][1] === 0 && n.gain.events.some((x) => x[0] === 'lin'));
    assert.ok(envs.length > 0, `${e.id} has an envelope`);
    for (const g of envs) {
      const ev = g.gain.events;
      assert.equal(ev.at(-1)[1], 0, `${e.id} ends at zero`);
      const firstUp = ev.findIndex((x, i) => i > 0 && x[1] > 0);
      assert.ok(ev[firstUp][2] - ev[0][2] >= 0.004 - 1e-9, `${e.id} attack`);
      const lastNonZero = ev.length - 2;
      assert.ok(ev.at(-1)[2] - ev[lastNonZero][2] > 0, `${e.id} a release`);
      assert.ok(ev.at(-1)[2] - ev[0][2] >= 0.064 - 1e-9, `${e.id} attack + release >= the floors`);
    }
    for (const o of made.filter((n) => n.kind === 'osc' && (n.type === 'square' || n.type === 'sawtooth'))) {
      const next = [...o.out][0];
      assert.equal(next.kind, 'biquad', `${e.id} raw ${o.type}`);
      assert.equal(next.type, 'lowpass');
      assert.ok(next.frequency.value <= CLICK_TONE.rawCeiling);
    }
  }
});

test('the seed gives all variation: one seed builds the same graph twice, another seed moves it, strength scales the level', () => {
  const trace = (made) => JSON.stringify(made.map((n) => [n.kind, n.frequency?.events ?? n.frequency?.value ?? null, n.gain?.events ?? null]));
  for (const e of SWORD_SWISH) {
    const a = renderOn(e, 7);
    const b = renderOn(e, 7);
    assert.equal(trace(a.made), trace(b.made), `${e.id} deterministic`);
  }
  const moved = SWORD_SWISH.filter((e) => trace(renderOn(e, 1).made) !== trace(renderOn(e, 2).made));
  assert.ok(moved.length >= 20, `most sounds vary with the seed (${moved.length})`);
  const lvl = (r) => r.made.find((n) => n.kind === 'gain').gain.value;
  assert.ok(lvl(renderOn(SWORD_SWISH[0], 1, 0.3)) < lvl(renderOn(SWORD_SWISH[0], 1, 1)));
});

test('no Math.random in the sword swish deck (the seed is the only source of variation)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/sfx-sword-swish.js', import.meta.url), 'utf8');
  assert.equal(/Math\.random/.test(src.replace(/\/\/.*$/gm, '')), false);
});

test('SFX: the channel sits at the clicks\' level, and the shares are the stated ones', () => {
  assert.equal(SFX.level, CLICK_TONE.level);
  assert.deepEqual([...SFX.clickShare], [1, 3]);
  assert.ok(SFX.machineShare >= 8 && SFX.machineGapMs >= 4000, 'the machine rate is low');
});

test('shareDeck: exactly `hits` yes cards in every round of `of`, at shuffled places', () => {
  const d = shareDeck(1, 4, 11);
  const seq = Array.from({ length: 400 }, () => d.next());
  for (let k = 0; k < 100; k++) assert.equal(seq.slice(k * 4, k * 4 + 4).filter(Boolean).length, 1);
  const places = new Set(Array.from({ length: 100 }, (_, k) => seq.slice(k * 4, k * 4 + 4).indexOf(true)));
  assert.ok(places.size >= 3, 'the sword card moves around the round');
});

test('before the first gesture nothing is built', () => {
  configure({ createContext: () => new Ctx() });
  assert.equal(getEngine(), null);
  assert.equal(playSfx({ deck: 'sword' }), null);
  assert.equal(sfxPage({ key: 'x' }), 'load');
});

test('playSfx plays a dealt sword card through one channel at the clicks\' level, reaches the limiter, and tells', () => {
  resetSfx({ seed: 3 });
  unlockNow();
  const E = getEngine();
  sound.setMuted(false);
  const heard = [];
  const off = onSfx((d) => heard.push(d));
  const start = all.length;
  const d = playSfx({ deck: 'sword', strength: 0.8, reason: 'test' });
  assert.ok(d, 'played');
  assert.equal(d.deck, 'sword');
  assert.equal(d.reason, 'test');
  assert.equal(heard.length, 1);
  const made = all.slice(start);
  const src = made.find((n) => n.kind === 'osc' || n.kind === 'src');
  assert.ok(reach(src).has(E.limit), 'reaches the limiter');
  // the channel's fader ramps to SFX.level
  const fader = made.find((n) => n.kind === 'gain' && n.gain.events.some((x) => Math.abs(x[1] - SFX.level) < 1e-9));
  assert.ok(fader, 'a fader at the clicks\' level');
  // the second play reuses the channel
  const before = all.length;
  playSfx({ deck: 'sword' });
  assert.equal(all.slice(before).filter((n) => n.kind === 'gain' && n.gain.events.some((x) => Math.abs(x[1] - SFX.level) < 1e-9)).length, 0);
  off();
});

test('the sword deck deals every card once before any repeats', () => {
  resetSfx({ seed: 9 });
  const n = sfxDecks().sword.length;
  const ids = Array.from({ length: n }, () => playSfx({ deck: 'sword' }).id);
  assert.equal(new Set(ids).size, n);
});

test('MUTE ALL builds nothing; a hidden page plays no page sound but a click still may', () => {
  sound.setMuted(true);
  const before = all.length;
  assert.equal(playSfx({ deck: 'sword' }), null);
  assert.equal(all.length, before);
  sound.setMuted(false);
  globalThis.document = { hidden: true };
  try {
    assert.equal(playSfx({ deck: 'sword', page: true }), null);
    assert.ok(playSfx({ deck: 'sword' }));
  } finally {
    delete globalThis.document;
  }
});

test('the hero input: an sfx sends a copy into the engine\'s picture tap when there is one', () => {
  const E = getEngine();
  const tap = E.ctx.createGain();
  E.taps = new Map([['picture', tap]]);
  const start = all.length;
  playSfx({ deck: 'sword' });
  assert.equal(all.slice(start).filter((n) => n.kind === 'gain' && n.out.has(tap)).length, 1);
  delete E.taps;
});

test('createClickCards: one lock in four deals a sword card; the rest deal the click noises and the radial deck', () => {
  const c = createClickCards({ clickCount: CLICK_NOISES.length, seed: 4 });
  const draws = Array.from({ length: 400 }, () => c.next());
  const swords = draws.filter((x) => typeof x === 'object' && x.deck === 'sword');
  assert.equal(swords.length, 100, 'exactly one in four');
  const clicks = draws.filter((x) => typeof x === 'number');
  assert.ok(clicks.every((k) => k >= 0 && k < CLICK_NOISES.length));
  const radial = draws.filter((x) => typeof x === 'object' && x.deck === 'radial');
  assert.equal(clicks.length + radial.length, 300);
  if (sfxDecks().radial.length) assert.ok(radial.length > 0, 'the radial deck joins the click noises');
  else assert.equal(new Set(clicks).size, CLICK_NOISES.length, 'with no radial deck the 24 clicks alone');
});

test('THE CLICK LOCK holds a sword card like a click noise: a burst replays it, the next lock deals again', () => {
  let now = 0;
  armClickNoises({ seed: 77, now: () => now });
  const seen = [];
  for (let lockN = 0; lockN < 16; lockN++) {
    now += 10000; // past any quiet period: a new lock
    const a = playClickNoise();
    now += 200;
    const b = playClickNoise();
    assert.ok(a && b);
    assert.equal(b.locked, true);
    assert.equal(b.name, a.name, 'the burst replays the locked sound');
    seen.push(a);
  }
  const swordLocks = seen.filter((d) => d.family === 'sfx-sword');
  assert.equal(swordLocks.length, 4, 'one lock in four');
  for (const d of swordLocks) {
    assert.equal(d.index, -1);
    assert.match(d.id, /^(swish|hit)-/);
  }
  // an explicit index still plays that click noise and leaves the lock alone
  assert.equal(playClickNoise({ index: 2 }).index, 2);
});

test('the page trigger: a page change plays a sword sound, the same page or a quick second change does not', () => {
  let now = 100000;
  resetSfx({ seed: 5, now: () => now });
  assert.equal(sfxPage({ key: 'home' }), 'load');
  now += 5000;
  assert.equal(sfxPage({ key: 'home' }), null, 'the same page');
  assert.equal(sfxPage({ key: 'what' }), 'page');
  now += 200;
  assert.equal(sfxPage({ key: 'settle' }), null, 'too soon after the last change');
  now += 2000;
  assert.equal(sfxPage({ key: 'kanerva' }), 'page');
});

test('the page load plays once the context runs', async () => {
  let now = 0;
  resetSfx({ seed: 6, now: () => now });
  const heard = [];
  const off = onSfx((d) => heard.push(d));
  getEngine().ctx.state = 'running';
  assert.equal(sfxPage({ key: 'home' }), 'load');
  await new Promise((r) => setTimeout(r, SFX.loadDelayMs + 60));
  assert.equal(heard.length, 1);
  assert.equal(heard[0].reason, 'load');
  assert.equal(heard[0].deck, 'sword');
  off();
});

test('the machine\'s random waves: one sound pop in twelve deals a sword sound, never closer than the gap; a person\'s wave never does', () => {
  let now = 0;
  const ls = {};
  const win = { innerWidth: 1000, addEventListener: (k, fn) => { ls[k] = fn; }, removeEventListener: (k) => { delete ls[k]; } };
  const off = armSfx({ win, seed: 8, now: () => now });
  const heard = [];
  const offS = onSfx((d) => heard.push(d));
  for (let i = 0; i < 48; i++) { now += 100; ls['settle:pulse']({ detail: { from: 'user', x: 500, strength: 1 } }); }
  assert.equal(heard.length, 0, 'a person\'s wave plays no machine sword');
  // one pop a minute: the gap never binds, so exactly one in twelve
  for (let i = 0; i < 120; i++) { now += 60000; ls['settle:pulse']({ detail: { from: 'sound', x: 800, strength: 1 } }); }
  assert.equal(heard.length, 10);
  assert.ok(heard.every((d) => d.reason === 'machine' && d.deck === 'sword' && d.pan > 0));
  // a pop every 100 ms: the gap holds them to one per SFX.machineGapMs
  heard.length = 0;
  for (let i = 0; i < 1200; i++) { now += 100; ls['settle:pulse']({ detail: { from: 'sound', x: 500, strength: 1 } }); }
  assert.ok(heard.length <= Math.ceil(120000 / SFX.machineGapMs), `${heard.length}`);
  off();
  offS();
  assert.equal(ls['settle:pulse'], undefined);
});
