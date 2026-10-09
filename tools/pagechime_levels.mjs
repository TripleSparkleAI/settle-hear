#!/usr/bin/env node
// pagechime_levels - THE PAGE CHIMES' LEVELS, measured offline (lane PAGECHIMES): every chime's peak at the master's
// input against THE DJ's quietest voice, the sword page sound with a chime layered on it, and the trim table.
//
// <claudes_code_comments>
// ** Function List **
// djVoices()      - THE DJ's symphony voices at the velocities the symphony deals them, one note each through the
//                   DJ channel's fader (0.55): { inst, vel, midi, peakDb, rms50Db }
// chimeRows(raw)  - every chime rendered at strength 1: raw (no trim) or as shipped (its trim), and at the master's
//                   input (x PAGE_CHIME.level): { id, name, family, peakDb, masterDb, rms50Db, dur }
// layered()       - for every sword-deck card at the page strength through the sfx channel, the card alone and the
//                   card with the loudest chime PAGE_CHIME.offsetMs later through the chime channel: the worst
//                   combined peak, against the loudest click noise (the sfx decks' cap)
// main()          - print the report, or --trim: the node renderer's own trim table (a cross-check; the shipped table
//                   is Chromium's, tools/pagechime_levels.py --trim)
//
// ** Technical Review **
// - THE RENDERER is tests/offline.mjs, the sfx decks' own WebAudio graph in plain JS, so the test suite can measure
//   without a browser. THE INSTRUMENT OF RECORD is Chromium (tools/pagechime_levels.py and .html), whose table ships;
//   the two agree within 3 dB per chime (measured 2026-10-09: node -42.9 to -37.9 dBFS against Chromium's -40.0).
// - "AT THE MASTER'S INPUT": every number after a channel's fader, before the master gain and the limiter, which
//   every sound on the page shares. THE DJ's reference is its symphony voices (flute 0.85, fiddle 0.6, harp 0.6,
//   bells 0.5, crystal 0.6 in symphony.js) through the symphony's fader 0.55, dry.
// Usage:
//   node tools/pagechime_levels.mjs          the report
//   node tools/pagechime_levels.mjs --trim   the node renderer's trim table (the shipped one is Chromium's)
//   node tools/pagechime_levels.mjs --json   the report as JSON
// </claudes_code_comments>

import { renderSound, measure, dbfs } from '../tests/offline.mjs';
import { PAGE_CHIMES, CHIME_RAW_TARGET_DB } from '../src/pagechimes.js';
import { PAGE_CHIME } from '../src/pagechime.js';
import { playNote } from '../src/instruments.js';
import { midiHz } from '../src/tuning.js';
import { CLICK_NOISES } from '../src/clicks.js';
import { SFX } from '../src/sfx.js';
import { SWORD_SWISH } from '../src/sfx-sword-swish.js';
import { SWORD_HIT } from '../src/sfx-sword-hit.js';

export const DJ_VOICES = Object.freeze([['flute', 0.85, 81], ['fiddle', 0.6, 69], ['harp', 0.6, 72], ['bells', 0.5, 84], ['crystal', 0.6, 96]]);
export const DJ_FADER = 0.55;
const fader = (lvl) => 20 * Math.log10(lvl);

export function djVoices() {
  return DJ_VOICES.map(([inst, vel, midi]) => {
    const r = renderSound((c, d, t) => { const g = c.createGain(); g.gain.value = DJ_FADER; g.connect(d); playNote(c, g, inst, midiHz(midi), t, 0.5, vel); return t + 3; }, { seconds: 3.5 });
    const m = measure(r);
    return { inst, vel, midi, peakDb: dbfs(m.peak), rms50Db: dbfs(m.rms50) };
  });
}

export function chimeRows({ raw = false } = {}) {
  return PAGE_CHIMES.map((e) => {
    const r = renderSound((c, d, t) => e.render(c, t, d, { strength: 1, raw }), { seconds: e.dur + 0.3 });
    const m = measure(r);
    const peakDb = dbfs(m.peak);
    return { id: e.id, name: e.name, family: e.family, peakDb, masterDb: peakDb + fader(PAGE_CHIME.level), rms50Db: dbfs(m.rms50), dur: m.duration };
  });
}

export function layered() {
  const swords = [...SWORD_SWISH, ...SWORD_HIT];
  const loud = chimeRows().reduce((a, b) => (b.peakDb > a.peakDb ? b : a));
  const chime = PAGE_CHIMES.find((e) => e.id === loud.id);
  const clickCap = Math.max(...CLICK_NOISES.map((n) => measure(renderSound((c, d, t) => n.play(c, d, t, { strength: 1 }))).peak));
  let worst = { id: null, alone: -999, both: -999 };
  for (const s of swords) {
    const sec = Math.min(1.6, s.dur) + 0.9;
    const one = (withChime) => measure(renderSound((c, d, t) => {
      const sw = c.createGain(); sw.gain.value = SFX.level; sw.connect(d);
      s.render(c, t, sw, { strength: SFX.strength.page, seed: 1 });
      if (withChime) { const ch = c.createGain(); ch.gain.value = PAGE_CHIME.level; ch.connect(d); chime.render(c, t + PAGE_CHIME.offsetMs / 1000, ch, { strength: 1 }); }
      return t + sec;
    }, { seconds: sec })).peak;
    const alone = dbfs(one(false));
    const both = dbfs(one(true));
    if (both > worst.both) worst = { id: s.id, alone, both };
  }
  return { chime: loud.id, worst, capDb: dbfs(clickCap * SFX.level), capRawDb: dbfs(clickCap) };
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--trim')) {
    const rows = chimeRows({ raw: true });
    const lines = rows.map((r) => `  '${r.id}': ${(CHIME_RAW_TARGET_DB - r.peakDb).toFixed(2)},`);
    console.log(`export const CHIME_TRIM_DB = Object.freeze({\n${lines.join('\n')}\n});`);
    return;
  }
  const dj = djVoices();
  const quiet = dj.reduce((a, b) => (b.peakDb < a.peakDb ? b : a));
  const rows = chimeRows();
  const lay = layered();
  if (args.has('--json')) { console.log(JSON.stringify({ dj, quiet, rows, lay }, null, 1)); return; }
  const f = (x) => x.toFixed(2).padStart(7);
  console.log('THE DJ\'s symphony voices, one note each through its fader 0.55 (peak dBFS at the master input):');
  for (const v of dj) console.log(`  ${v.inst.padEnd(8)} vel ${v.vel}  midi ${v.midi}  peak ${f(v.peakDb)}  rms50 ${f(v.rms50Db)}`);
  console.log(`  quietest: ${quiet.inst} at ${quiet.peakDb.toFixed(2)} dBFS`);
  console.log(`\nTHE PAGE CHIMES at strength 1 through the chime fader ${PAGE_CHIME.level} (peak at the master input):`);
  for (const r of rows) console.log(`  ${r.id.padEnd(28)} ${r.family.padEnd(9)} ${f(r.masterDb)}  dur ${r.dur.toFixed(3)} s`);
  const lo = Math.min(...rows.map((r) => r.masterDb));
  const hi = Math.max(...rows.map((r) => r.masterDb));
  console.log(`  range ${lo.toFixed(2)} .. ${hi.toFixed(2)} dBFS; the loudest is ${(quiet.peakDb - hi).toFixed(2)} dB under THE DJ's quietest voice`);
  console.log(`\nLAYERED on the sword page sound (strength ${SFX.strength.page}, fader ${SFX.level}), the loudest chime ${PAGE_CHIME.offsetMs} ms later:`);
  console.log(`  worst card ${lay.worst.id}: alone ${lay.worst.alone.toFixed(2)}, with the chime ${lay.worst.both.toFixed(2)} dBFS`);
  console.log(`  the cap (the loudest click noise through the same fader): ${lay.capDb.toFixed(2)} dBFS`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
