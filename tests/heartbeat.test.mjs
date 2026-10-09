// THE BADUMP's sound (heartbeat.js, lane HEROKEYS): two thumps, the second louder, a soft tone in THE DJ's key, on
// the next 40 Hz flash line, through the mixer, silent under MUTE ALL and with no engine, and never louder than the
// softest click a visitor's hero click makes, measured by rendering both.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, all, reach } from './fakeaudio.mjs';
import {
  configure, unlockNow, getEngine, sound, CLICK_TONE, HEARTBEAT, heartbeatKey, heartbeatPlan, renderPlan, playHeartbeat,
  audioOffsetMs, masterGrid, midiHz,
} from '../src/index.js';

const thumps = (plan) => plan.filter((v) => v.f0 < 100);

test('THE PLAN: two thumps HEARTBEAT.gapMs apart, the second louder, each with a soft partial, and one quiet tone', () => {
  const p = heartbeatPlan({ rootHz: 288 });
  const t = thumps(p);
  assert.equal(t.length, 2, 'two thumps');
  assert.equal(t[0].at, 0);
  assert.equal(t[1].at, HEARTBEAT.gapMs / 1000);
  assert.ok(t[1].peak > t[0].peak * 1.2, 'ba-DUMP: the second is louder');
  for (const v of t) assert.ok(v.f1 < v.f0, 'a thump falls in pitch');
  const tone = p.filter((v) => v.f0 === 288);
  assert.equal(tone.length, 1, 'one tone, on the root it was given');
  assert.ok(tone[0].peak < t[0].peak, 'the tone is quieter than either thump');
  for (const v of p) {
    assert.ok(v.attack >= CLICK_TONE.attackMin && v.release >= CLICK_TONE.releaseMin, 'the tone rules');
    assert.equal(v.type, 'sine', 'sines only, so no raw square needs a low-pass');
  }
  // strength scales every voice, and 0 is silent
  assert.ok(heartbeatPlan({ rootHz: 288, strength: 0 }).every((v) => v.peak === 0));
});

test('THE KEY: the tone sits on the DJ theme\'s root, folded into its octave window, on A = 432', () => {
  const f = heartbeatKey(null);
  assert.ok(f >= HEARTBEAT.tone.lo && f < HEARTBEAT.tone.hi);
  // no theme: A minor pentatonic's root A3 (midi 57) on A = 432 is 216 Hz, inside the window as it is
  assert.ok(Math.abs(f - midiHz(57)) < 1e-9);
  for (const th of ['highlands', 'nope', null]) {
    const k = heartbeatKey(th);
    assert.ok(k >= HEARTBEAT.tone.lo && k < HEARTBEAT.tone.hi, `${th}`);
  }
});

test('LOUDNESS, MEASURED: the rendered heartbeat stays under the softest hero click in peak and in RMS', () => {
  const hb = renderPlan(heartbeatPlan({ rootHz: heartbeatKey(null) }));
  // the softest click a hero click makes: strength 0.45 + 0.07 (the first click of a combo), one voice at its peak
  const soft = CLICK_TONE.peak * 0.52;
  const click = renderPlan([{ at: 0, type: 'sine', f0: 600, f1: 600, glide: 0, peak: soft, attack: CLICK_TONE.attackMin, release: 0.1 }]);
  assert.ok(hb.peak < click.peak, `heartbeat peak ${hb.peak} under the click's ${click.peak}`);
  assert.ok(hb.rms < click.rms, `heartbeat RMS ${hb.rms} under the click's ${click.rms}`);
  assert.ok(hb.peak > 0.2 * click.peak, 'and still audible: not a silent stub');
  // the second thump's window is louder than the first's
  const rate = 16000;
  const win = (a, b) => { let m = 0; for (let i = Math.floor(a * rate); i < Math.floor(b * rate); i++) m = Math.max(m, Math.abs(hb.samples[i])); return m; };
  const g = HEARTBEAT.gapMs / 1000;
  assert.ok(win(g, g + 0.08) > win(0, 0.08), 'ba-DUMP in the rendered samples too');
});

test('before the first gesture nothing plays', () => {
  configure({ createContext: () => new Ctx() });
  assert.equal(getEngine(), null);
  assert.equal(playHeartbeat(), null);
});

test('it plays through the mixer, every envelope from zero to zero, on a 40 Hz flash line', () => {
  unlockNow();
  const E = getEngine();
  sound.setMuted(false);
  const start = all.length;
  const d = playHeartbeat({ theme: null });
  assert.ok(d, 'played');
  assert.equal(d.voices, 5);
  const made = all.slice(start);
  const oscs = made.filter((n) => n.kind === 'osc');
  assert.equal(oscs.length, 5);
  for (const o of oscs) {
    assert.ok(reach(o).has(E.limit), 'reaches the master limiter');
    assert.ok(o.started);
  }
  const envs = made.filter((n) => n.kind === 'gain' && n.gain.events.some((e) => e[0] === 'lin'));
  assert.equal(envs.length, 5);
  for (const g of envs) {
    const ev = g.gain.events;
    assert.equal(ev[0][1], 0);
    assert.equal(ev.at(-1)[1], 0);
  }
  // the first thump starts on a flash line of the master grid (25 ms at 40 Hz)
  const ms = d.at * 1000 + audioOffsetMs(E.ctx);
  const period = 1000 / masterGrid().flashHz;
  const off = ((ms - masterGrid().origin) % period + period) % period;
  assert.ok(off < 1e-6 || period - off < 1e-6, `on a flash line (off ${off})`);
});

test('MUTE ALL: a muted page builds nothing and returns null', () => {
  sound.setMuted(true);
  const before = all.length;
  assert.equal(playHeartbeat(), null);
  assert.equal(all.length, before);
  sound.setMuted(false);
});
