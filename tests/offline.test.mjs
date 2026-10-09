// THE OFFLINE RENDERER (tests/offline.mjs) answers known questions correctly: a sine's peak and RMS, a filter's
// attenuation, a ramp's end value, the equal-power panner, a delay's lag, a loop through a delay, the nodes it
// refuses, and the click noises measured against headless Chromium's OfflineAudioContext (the channel's table).
import test from 'node:test';
import assert from 'node:assert/strict';
import { OfflineCtx, renderSound, measure, likenessPrint, likeness, dbfs, mono } from './offline.mjs';
import { CLICK_NOISES } from '../src/clicks.js';

const rms = (x, a = 0, b = x.length) => { let e = 0; for (let i = a; i < b; i++) e += x[i] * x[i]; return Math.sqrt(e / (b - a)); };

test('a sine at gain 1 peaks at 1 and has an RMS of 0.707, and is silent before start and after stop', () => {
  const r = renderSound((c, d, t) => { const o = c.createOscillator(); o.frequency.value = 1000; o.connect(d); o.start(t); o.stop(t + 0.5); return t + 0.5; }, { seconds: 1 });
  const m = mono(r);
  assert.ok(Math.abs(Math.max(...m) - 1) < 1e-3);
  assert.ok(Math.abs(rms(m, 4800, 24000) - Math.SQRT1_2) < 1e-3);
  assert.equal(rms(m, 0, 400), 0, 'silent before start');
  assert.equal(rms(m, 30000, 48000), 0, 'silent after stop');
});

test('a 200 Hz lowpass passes 100 Hz and cuts 4 kHz by more than 40 dB', () => {
  const at = (f) => { const r = renderSound((c, d, t) => { const o = c.createOscillator(); o.frequency.value = f; const lp = c.createBiquadFilter(); lp.frequency.value = 200; lp.Q.value = 0; o.connect(lp); lp.connect(d); o.start(t); return t + 1; }, { seconds: 1 }); return rms(mono(r), 24000, 48000); };
  assert.ok(at(100) > 0.6);
  assert.ok(dbfs(at(4000) / Math.SQRT1_2) < -40);
});

test('linear and exponential ramps reach their values on time, and setTarget decays by e per time constant', () => {
  const c = new OfflineCtx();
  const g = c.createGain();
  g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1, 0.1); g.gain.exponentialRampToValueAtTime(0.01, 0.2); g.gain.setTargetAtTime(1, 0.3, 0.05);
  assert.ok(Math.abs(g.gain._at(0.05) - 0.5) < 1e-9);
  assert.ok(Math.abs(g.gain._at(0.15) - 0.1) < 1e-9);
  assert.ok(Math.abs(g.gain._at(0.35) - (1 - 0.99 / Math.E)) < 1e-9);
  assert.throws(() => g.gain.exponentialRampToValueAtTime(0, 1));
  assert.throws(() => g.gain.setValueAtTime(NaN, 1));
});

test('the stereo panner is equal-power: a mono source at centre gives 0.707 a side, hard left gives all left', () => {
  const side = (p) => { const r = renderSound((c, d, t) => { const s = c.createConstantSource(); const pn = c.createStereoPanner(); pn.pan.value = p; s.connect(pn); pn.connect(d); s.start(t); return t + 0.1; }, { seconds: 0.1 }); return [r.L[2000], r.R[2000]]; };
  const [l0, r0] = side(0);
  assert.ok(Math.abs(l0 - Math.SQRT1_2) < 1e-6 && Math.abs(r0 - Math.SQRT1_2) < 1e-6);
  const [l1, r1] = side(-1);
  assert.ok(Math.abs(l1 - 1) < 1e-6 && Math.abs(r1) < 1e-6);
});

test('a delay lags by its time, and a feedback loop through a delay renders and decays', () => {
  const r = renderSound((c, d, t) => { const s = c.createConstantSource(); const dl = c.createDelay(1); dl.delayTime.value = 0.1; s.connect(dl); dl.connect(d); s.start(0.2); s.stop(0.21); return 0.5; }, { seconds: 0.5 });
  const m = mono(r);
  assert.equal(m[Math.round(0.29 * 48000)], 0);
  assert.ok(m[Math.round(0.305 * 48000)] > 0.9);
  const echo = renderSound((c, d, t) => {
    const o = c.createOscillator(); o.frequency.value = 500;
    const e = c.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.5, t + 0.005); e.gain.linearRampToValueAtTime(0, t + 0.05);
    const dl = c.createDelay(1); dl.delayTime.value = 0.12; const fb = c.createGain(); fb.gain.value = 0.5;
    o.connect(e); e.connect(d); e.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(d);
    o.start(t); o.stop(t + 0.06); return t + 1;
  }, { seconds: 1.2 });
  const em = mono(echo);
  assert.ok(em.every(Number.isFinite));
  assert.ok(rms(em, Math.round(0.13 * 48000), Math.round(0.17 * 48000)) > 0.05, 'the first echo is heard');
  assert.ok(rms(em, Math.round(0.85 * 48000), Math.round(1.1 * 48000)) < rms(em, Math.round(0.13 * 48000), Math.round(0.17 * 48000)) / 4, 'and it decays');
});

test('a delay keeps a mono signal mono, so a panner after it applies the mono law (PSYRADIAL\'s finding)', () => {
  const lvl = (withDelay) => {
    const r = renderSound((c, d, t) => { const s = c.createConstantSource(); let head = s; if (withDelay) { const dl = c.createDelay(1); dl.delayTime.value = 0.01; s.connect(dl); head = dl; } const pn = c.createStereoPanner(); pn.pan.value = 0.5; head.connect(pn); pn.connect(d); s.start(0); return 0.2; }, { seconds: 0.2 });
    return [r.L[6000], r.R[6000]];
  };
  const [l0, r0] = lvl(false);
  const [l1, r1] = lvl(true);
  assert.ok(Math.abs(l0 - l1) < 1e-6 && Math.abs(r0 - r1) < 1e-6, `direct ${l0.toFixed(3)} ${r0.toFixed(3)}, through a delay ${l1.toFixed(3)} ${r1.toFixed(3)}`);
});

test('a filter inside a delay loop computes each block once: the first echo of a burst equals the burst (Chromium: both -20.04 dBFS)', () => {
  const r = renderSound((c, d, t) => {
    const o = c.createOscillator(); o.frequency.value = 1300;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1, t + 0.004); g.gain.setTargetAtTime(0, t + 0.004, 0.00875);
    const dl = c.createDelay(0.2); dl.delayTime.value = 0.09; const fb = c.createGain(); fb.gain.value = 0.55;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.7;
    o.connect(g); g.connect(d); g.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(d);
    o.start(t); o.stop(t + 0.4); return t + 0.8;
  }, { seconds: 0.8 });
  const pk = (a, b) => { let m = 0; for (let i = Math.round(a * 48000); i < Math.round(b * 48000); i++) m = Math.max(m, Math.abs(r.L[i])); return m; };
  const direct = pk(0, 0.09); const echo = pk(0.09, 0.18);
  assert.ok(Math.abs(dbfs(direct) - -20.04) < 0.05, `direct ${dbfs(direct).toFixed(2)}`);
  assert.ok(Math.abs(dbfs(echo) - dbfs(direct)) < 0.1, `echo ${dbfs(echo).toFixed(2)} against direct ${dbfs(direct).toFixed(2)}`);
});

test('connecting one node to the same input twice is one connection, as in WebAudio', () => {
  const r = renderSound((c, d, t) => { const s = c.createConstantSource(); const g = c.createGain(); s.connect(g); s.connect(g); g.connect(d); g.connect(d); const m = c.createConstantSource(); m.offset.value = 0.25; m.connect(g.gain); m.connect(g.gain); s.start(0); m.start(0); return 0.1; }, { seconds: 0.1 });
  assert.ok(Math.abs(r.L[2000] - 1.25) < 1e-6, `${r.L[2000]}: the source once, the gain 1 + 0.25 once`);
});

test('a waveshaper follows the spec\'s curve mapping, and an oscillator can frequency-modulate another', () => {
  const r = renderSound((c, d, t) => { const s = c.createConstantSource(); s.offset.value = 0.5; const sh = c.createWaveShaper(); sh.curve = new Float32Array([-1, 0, 0.2]); s.connect(sh); sh.connect(d); s.start(t); return t + 0.1; }, { seconds: 0.1 });
  assert.ok(Math.abs(r.L[2000] - 0.1) < 1e-6, 'x = 0.5 lands halfway between curve[1] and curve[2]');
  const fm = renderSound((c, d, t) => { const car = c.createOscillator(); car.frequency.value = 400; const mod = c.createOscillator(); mod.frequency.value = 50; const depth = c.createGain(); depth.gain.value = 300; mod.connect(depth); depth.connect(car.frequency); car.connect(d); car.start(t); mod.start(t); return t + 0.5; }, { seconds: 0.5 });
  const m = measure(fm);
  assert.ok(m.peak > 0.99 && m.peak < 1.01);
});

test('nodes outside the shared subset are refused by name', () => {
  const c = new OfflineCtx();
  assert.throws(() => c.createConvolver(), /ConvolverNode/);
  assert.throws(() => c.createPeriodicWave(), /PeriodicWave/);
  assert.throws(() => c.createScriptProcessor(), /ScriptProcessor/);
  assert.throws(() => c.createOscillator().setPeriodicWave(), /PeriodicWave/);
});

// The channel's Chromium table (SETTLE/runs/animesfx/CHANNEL.md, HYPERRADIAL and PSYRADIAL, 2026-10-05): the 24
// click noises at strength 1 straight into an OfflineAudioContext destination. This renderer must agree within 0.5 dB.
test('the click noises measure as headless Chromium measures them, within 0.5 dB, and their likeness ranks agree', () => {
  const rows = CLICK_NOISES.map((n) => { const r = renderSound((c, d, t) => n.play(c, d, t, { strength: 1 })); return { name: n.name, m: measure(r), p: likenessPrint(r) }; });
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
  const near = (a, b, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a.toFixed(2)} vs ${b}`);
  near(dbfs(Math.max(...rows.map((r) => r.m.peak))), -15.37);
  near(dbfs(Math.max(...rows.map((r) => r.m.rms50))), -22.76);
  near(dbfs(byName['tick low'].m.peak), -32.07);
  near(dbfs(byName['tick low'].m.rms50), -43.79);
  near(byName['tick air'].m.highShare, 0.668, 0.03);
  near(likeness(byName['pop up'].p, byName.bubble.p), 0.979, 0.01); // HYPERRADIAL's fixed print: 0.979
  near(likeness(byName['tick low'].p, byName['wood block'].p), 0.972, 0.01);
});
