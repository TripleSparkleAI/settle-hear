// THE SQUARED VOLUME (lane VOLUMECURVE, navigator 2026-10-06: "can it go to 1? and you decide the best simple thing
// for 0.1 volume", then "0..1"): the master LEVEL is a fader's value, 0 to 1, and the engine sets the master GAIN to
// the level squared, the standard volume law. 1 is loudness 1.0, the fresh 0.8 plays at 0.64, and 0.1 plays at 0.01
// (40 dB down). Every fader of the one master (the hero's volume line, /hear's MasterFader) moves the level, so all of
// them sit on the same curve. Before this lane the gain WAS the level (linear), and 0.1 on a fader was only 20 dB down.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ctx } from './fakeaudio.mjs';

globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), { hidden: false });

const engine = await import('../src/engine.js');
const index = await import('../src/index.js');
engine.configure({ createContext: () => new Ctx(), sleepMs: 30 });
const { sound } = await import('../src/control.js');
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} against ${b}`);

test('levelGain is the square of the level, clamped to 0..1, and the package exports it', () => {
  assert.equal(typeof engine.levelGain, 'function', 'engine.levelGain exists');
  assert.equal(index.levelGain, engine.levelGain, 'the package index exports it');
  near(engine.levelGain(1), 1, '1 is loudness 1.0');
  near(engine.levelGain(0.8), 0.64, 'the fresh level');
  near(engine.levelGain(0.5), 0.25, 'half');
  near(engine.levelGain(0.1), 0.01, '0.1 is 40 dB down');
  near(engine.levelGain(0), 0, 'silence');
  near(engine.levelGain(1.7), 1, 'clamped above');
  near(engine.levelGain(-2), 0, 'clamped below');
  near(engine.levelGain('junk'), 0, 'junk is silence');
  near(20 * Math.log10(engine.levelGain(0.1)), -40, '0.1 is -40 dB');
});

test('the master starts at the squared default, and getMaster still answers the LEVEL', () => {
  assert.equal(engine.getMaster(), 0.8, 'the level a fader shows');
  sound.setMuted(false);
  const E = engine.unlockNow();
  near(E.master.gain.value, 0.64, 'the gain the master node holds');
});

test('a set ramps the master GAIN to the level squared and onMaster carries the LEVEL', () => {
  const heard = [];
  const off = engine.onMaster((v) => heard.push(v));
  engine.setMaster(0.5);
  near(engine.getEngine().master.gain.value, 0.25, '0.5 -> 0.25');
  engine.setMaster(0.1);
  near(engine.getEngine().master.gain.value, 0.01, '0.1 -> 0.01');
  engine.setMaster(1);
  near(engine.getEngine().master.gain.value, 1, '1 -> 1');
  off();
  assert.deepEqual(heard, [0.5, 0.1, 1], 'a fader hears the level it shows, never the gain');
  assert.equal(engine.getMaster(), 1);
});

test('a level set before the build is squared at the build', async () => {
  // a fresh module instance: the build path, not the ramp path
  const fresh = await import(`../src/engine.js?fresh=${Date.now()}`);
  fresh.configure({ createContext: () => new Ctx(), sleepMs: 30 });
  fresh.setMaster(0.3);
  const ctl = await import('../src/control.js');
  ctl.sound.setMuted(false);
  const E = fresh.unlockNow();
  near(E.master.gain.value, 0.09, 'the remembered 0.3 starts at 0.09');
});

test('the /hear master fader reads and speaks the level 0 to 1, never a percent', async () => {
  const { readFileSync } = await import('node:fs');
  const a11y = await import('../react/a11y.js');
  assert.equal(typeof a11y.levelText, 'function', 'react/a11y.js exports levelText');
  assert.equal(a11y.levelText(0.8), '0.80 of 1');
  assert.equal(a11y.levelText(0.1), '0.10 of 1');
  assert.equal(a11y.levelText(1), '1.00 of 1');
  assert.equal(a11y.levelText(0), '0.00 of 1');
  const jsx = readFileSync(new URL('../react/Hear.jsx', import.meta.url), 'utf8');
  const i = jsx.indexOf('export function MasterFader');
  const body = jsx.slice(i, jsx.indexOf('\nexport function useGammaSound', i));
  assert.match(body, /aria-valuetext=\{U\.level\(v\)\}/, 'the fader speaks the number');
  assert.doesNotMatch(body, /U\.percent/, 'never a percent');
  assert.match(body, /\{v\.toFixed\(2\)\}/, 'the readout shows the number to two places');
  assert.match(jsx, /const UNITS = \{[^}]*level: levelText/, 'the default units carry the level');
  const idx = readFileSync(new URL('../react/index.js', import.meta.url), 'utf8');
  assert.match(idx, /levelText/, 'the react index exports levelText');
});
