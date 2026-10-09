// settle-hear · tools/dj_trained_measure - DO THE HERO'S SETS SHOW THE TRAINED TIMING HABITS? (lane DJWIRE)
//
// <claudes_code_comments>
// ** Function List **
// lineClass(b)                - a bar line's kind in a set: 32, 16, 8, or 'mid' (a bar inside a block)
// gridStats(set)              - one trained set's grid, measured as REPORT_TIMING.md measures a track: roles changed
//                               across each 32 / 16 / 8-bar line, the drops (the kick back after a breakdown) by
//                               line kind, the section lengths in bars
// runBrain(brain, theme, seed, sets) - THE HERO'S BRAIN (mix-dj.js createHouseDJ), bar by bar with no steering, for a
//                               number of sets: every bar's mix layers, section and set bar
// heroStats(runs)             - the decisions measured the same way, on the seven mix layers the trained grid
//                               decides: changes per line kind (and inside a block), the drums layer's returns, the
//                               KICK's returns as heard (back after 4 bars or more without it) by line kind, and the
//                               runs of an unchanged mix
// main()                      - both brains over the five themes and a set of seeds; the trained sets' grids per
//                               family against the report's held-out stage-2 numbers; prints a table and writes JSON
//
// ** Technical Review **
// - Usage: node tools/dj_trained_measure.mjs [--seeds 12] [--sets 3] [--out file.json]. Pure (no audio): it drives
//   the same brain the hero plays, with no picture, no steering and no votes, at THE MASTER BEAT's bar (a bar is a
//   bar; the clock does not change what the brain decides).
// - TWO LEVELS. The GRID level is the trained set itself (10 roles x 8-bar blocks), measured exactly as
//   gridlib.arrangement_stats measures a track, so it is comparable to REPORT_TIMING.md section 7.2. The HERO level is
//   what the visitor hears: the mix machine's seven layers (drums, bass, pad, lead, arps, answer, chain) as settled
//   bar by bar, with the trained grid's leans; the same line classes, and the drums layer's returns as the drops.
//   The old DJ is measured at the hero level only (it has no grid).
// - THE LINES: bar 0 of a set is a 32-bar line (the trained set's offset 0; the old planner's set bar 0). The warm-
//   down (the neutral hum) is left out of every count; so is the old DJ's hum.
// </claudes_code_comments>

import { writeFileSync } from 'node:fs';
import { createHouseDJ } from '../src/mix-dj.js';
import { settleTrainedSet, FAMILIES } from '../src/dj-trained.js';
import models from '../src/dj-trained-models.js';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SEEDS = Number(arg('--seeds', 12));
const SETS = Number(arg('--sets', 3));
const OUT = arg('--out', null);
const THEMES = ['crystals', 'highlands', 'deepsea', 'cathedral', 'embers'];
const LAYERS = ['drums', 'bass', 'pad', 'lead', 'arps', 'answer', 'chain'];

const lineClass = (b) => (b % 32 === 0 ? 32 : b % 16 === 0 ? 16 : b % 8 === 0 ? 8 : 'mid');
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function gridStats(set) {
  const T = set.blocks;
  const R = set.grid.length;
  const flips = { 32: [], 16: [], 8: [] };
  for (let t = 1; t < T; t++) {
    let n = 0;
    for (let r = 0; r < R; r++) if (set.grid[r][t] !== set.grid[r][t - 1]) n += 1;
    flips[lineClass(8 * t)].push(n);
  }
  const kick = set.grid[set.roles.indexOf('kick')].map((v) => v === 1);
  const drops = [];
  if (T >= 6 && mean(kick.map(Number)) >= 0.5) {
    let k = 1;
    while (k < T - 1) {
      if (kick[k - 1] && !kick[k]) {
        let j = k;
        while (j < T && !kick[j]) j += 1;
        if (j < T) drops.push(j);
        k = j;
      } else k += 1;
    }
  }
  const secs = [];
  let c = 1;
  for (let t = 1; t < T; t++) {
    let same = true;
    for (let r = 0; r < R; r++) if (set.grid[r][t] !== set.grid[r][t - 1]) same = false;
    if (same) c += 1; else { secs.push(8 * c); c = 1; }
  }
  secs.push(8 * c);
  return { flips, drops: drops.map((t) => lineClass(8 * t)), secs };
}

function runBrain(brainMode, theme, seed, sets) {
  const dj = createHouseDJ({ seed, theme, trained: brainMode === 'trained' ? models : null, brainMode });
  const runs = [];
  let cur = null;
  let guard = 0;
  while (runs.length <= sets && guard++ < 4000) {
    const d = dj.bar({ theme, mood: { heat: 0.5 } });
    if (d.newSet || !cur) { if (cur) runs.push(cur); cur = { brain: d.brain, family: d.trained?.family ?? null, bars: [] }; }
    // the kick as heard: the drums layer on, and (a trained bar) a kick step in the bar's settled groove
    const kick = !!d.mix.yes.drums && (d.trained?.groove ? d.trained.groove.steps.kick.some((v) => v > 0) : true);
    cur.bars.push({ setBar: d.plan.setBar, section: d.section, kick, yes: Object.fromEntries(LAYERS.map((k) => [k, !!d.mix.yes[k]])) });
  }
  return runs.slice(0, sets);
}

export function heroStats(runs) {
  const changes = { 32: [], 16: [], 8: [], mid: [] };
  const drops = { 32: 0, 16: 0, 8: 0, mid: 0 };
  const kickDrops = { 32: 0, 16: 0, 8: 0, mid: 0 };
  const secs = [];
  for (const run of runs) {
    const bars = run.bars.filter((x) => x.section !== 'hum');
    let everOn = false;
    let kickEver = false;
    let rest = 0;
    let secLen = 1;
    for (let i = 1; i < bars.length; i++) {
      const a = bars[i - 1].yes;
      const b = bars[i].yes;
      const n = LAYERS.filter((k) => a[k] !== b[k]).length;
      changes[lineClass(bars[i].setBar)].push(n);
      if (a.drums) everOn = true;
      if (everOn && !a.drums && b.drums) drops[lineClass(bars[i].setBar)] += 1;
      if (n === 0) secLen += 1; else { secs.push(secLen); secLen = 1; }
      // a DROP as heard: the kick back after at least 4 bars without it (a one-bar drop-out is not a drop)
      if (bars[i - 1].kick) { kickEver = true; rest = 0; } else rest += 1;
      if (kickEver && bars[i].kick && rest >= 4) kickDrops[lineClass(bars[i].setBar)] += 1;
    }
    secs.push(secLen);
  }
  const nd = drops[32] + drops[16] + drops[8] + drops.mid;
  const nk = kickDrops[32] + kickDrops[16] + kickDrops[8] + kickDrops.mid;
  return {
    sets: runs.length,
    changesPerLine: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, +mean(v).toFixed(3)])),
    changeShareOnBlockLines: +((changes[32].concat(changes[16], changes[8]).reduce((x, y) => x + y, 0)) / Math.max(1, Object.values(changes).flat().reduce((x, y) => x + y, 0))).toFixed(3),
    drops: { ...drops, total: nd, on16or32: nd ? +((drops[32] + drops[16]) / nd).toFixed(3) : null },
    kickDrops: { ...kickDrops, total: nk, on16or32: nk ? +((kickDrops[32] + kickDrops[16]) / nk).toFixed(3) : null },
    sectionBarsMean: +mean(secs).toFixed(2),
  };
}

function main() {
  const out = { note: 'lane DJWIRE, tools/dj_trained_measure.mjs', seeds: SEEDS, setsPerRun: SETS, hero: {}, grid: {} };
  for (const brain of ['trained', 'old']) {
    const all = [];
    for (const theme of THEMES) for (let s = 1; s <= SEEDS; s++) all.push(...runBrain(brain, theme, 1000 * s + 7, SETS));
    out.hero[brain] = heroStats(all);
    if (brain === 'trained') out.hero.trainedFamilies = Object.fromEntries(FAMILIES.map((f) => [f, all.filter((r) => r.family === f).length]).filter(([, n]) => n));
  }
  for (const f of FAMILIES) {
    const flips = { 32: [], 16: [], 8: [] };
    const dropLines = [];
    const secs = [];
    for (let s = 1; s <= 10 * SEEDS; s++) {
      const g = gridStats(settleTrainedSet(models, f, { seed: 7919 * s + 1 }));
      for (const k of [32, 16, 8]) flips[k].push(...g.flips[k]);
      dropLines.push(...g.drops);
      secs.push(...g.secs);
    }
    const h = models.families[f].heldout;
    out.grid[f] = {
      sets: 10 * SEEDS,
      flipsPerLine: { 32: +mean(flips[32]).toFixed(2), 16: +mean(flips[16]).toFixed(2), 8: +mean(flips[8]).toFixed(2) },
      report: { stage2: h.flips_per_line, data: h.data_flips_per_line },
      drops: dropLines.length,
      dropsOn16or32: dropLines.length ? +(dropLines.filter((k) => k !== 8).length / dropLines.length).toFixed(3) : null,
      reportDropsOn16or32: { stage2: h.drops_on_16_or_32, data: h.data_drops_on_16_or_32 },
      sectionBarsMean: +mean(secs).toFixed(2),
      reportSectionBarsMean: { stage2: h.section_bars_mean, data: h.data_section_bars_mean },
    };
  }
  const p = (x) => (x == null ? '-' : `${Math.round(100 * x)}%`);
  console.log('THE HERO\'S DECISIONS (seven mix layers, no steering), %d themes x %d seeds x %d sets', THEMES.length, SEEDS, SETS);
  for (const b of ['trained', 'old']) {
    const h = out.hero[b];
    console.log(`  ${b.padEnd(8)} sets ${h.sets} · layers changed per line 32/16/8/inside a block: ${h.changesPerLine[32]} / ${h.changesPerLine[16]} / ${h.changesPerLine[8]} / ${h.changesPerLine.mid} · share of changes on 8-bar lines ${p(h.changeShareOnBlockLines)} · drums layer back ${h.drops.total}, on 16/32 ${p(h.drops.on16or32)} · KICK BACK after 4+ bars ${h.kickDrops.total}, on a 16- or 32-bar line ${p(h.kickDrops.on16or32)} (32: ${h.kickDrops[32]}, 16: ${h.kickDrops[16]}, 8: ${h.kickDrops[8]}, inside a block: ${h.kickDrops.mid}) · mean run of an unchanged mix ${h.sectionBarsMean} bars`);
  }
  console.log('THE TRAINED SETS\' GRIDS (10 roles), %d sets a family, against REPORT_TIMING.md 7.2 (held out: data / stage 2)', 10 * SEEDS);
  for (const [f, g] of Object.entries(out.grid)) {
    console.log(`  ${f.padEnd(10)} roles changed 32/16/8: ${g.flipsPerLine[32]} / ${g.flipsPerLine[16]} / ${g.flipsPerLine[8]} (data ${g.report.data['32-bar']} / ${g.report.data['16-bar']} / ${g.report.data['8-bar']}, stage 2 ${g.report.stage2['32-bar']} / ${g.report.stage2['16-bar']} / ${g.report.stage2['8-bar']}) · drops ${g.drops}, on 16/32 ${p(g.dropsOn16or32)} (data ${p(g.reportDropsOn16or32.data)}, stage 2 ${p(g.reportDropsOn16or32.stage2)}) · section ${g.sectionBarsMean} bars (data ${g.reportSectionBarsMean.data}, stage 2 ${g.reportSectionBarsMean.stage2})`);
  }
  if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 1));
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
