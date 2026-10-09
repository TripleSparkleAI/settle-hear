#!/usr/bin/env node
// bases_build - build THE LIBRARY: every source MIDI in the sources manifest through the importer, every authored
// recipe through the author, numbered base-NNNN in one pass, written to settle-hear/bases/ with index.json, the
// ledger (ledger.json + LEDGER.md) and a BUILD.md report. The raw MIDI files are read from the manifest's paths
// (SETTLE/runs/housebases/raw/, gitignored) and are never copied into bases/.
//
// <claudes_code_comments>
// ** Function List **
// readSources(path)          - the sources manifest: [{ path, licence, url, excerpt, author, title, downloaded,
//                              sha256, kind, family, bpm, maxBars, note }]
// sha256Of(bytes)            - the hash the ledger records
// buildOne(src, id)          - one midi source -> { base, report } or null when the import is empty or invalid
// authoredPlan(n, counts)    - how many authored bases per family are needed to reach the 50/50 target
// main()                     - the whole build; prints the counts and writes everything
//
// ** Technical Review **
// - ORDER: midi sources in manifest order, then authored bases to fill. Ids are dealt in that order, so a rebuild
//   with the same manifest gives the same ids (the ledger is the map from id to source).
// - THE TARGET: --target N (default 300) and --house-share (default 0.5). Every source is imported; a kind that
//   overflows its share keeps the share less --min-authored (default 24) of them, ambient ranked by the least
//   density (a bed) and house by four-on-the-floor; the rest are listed in BUILD.md as over the share. Then the
//   author fills each kind up to its share, cycling the families so the library covers every family, each base
//   from a fresh seed (family index x 1000 + k), with the recipe named in the ledger row.
// - A midi base whose import carries fewer than 8 onsets in its window or fails validateBase is dropped and listed
//   in BUILD.md with its reason.
// - LEDGER ROW: { id, origin, source: { title, author, url, page, licence, licenceText, downloaded, sha256, bytes,
//   file (the raw file's basename only) }, kind, family, bars, bpm, note }. For an authored base the source is
//   { recipe, seed, version, theory: RECIPE_NOTES[family] }.
// - Usage: node tools/bases_build.mjs --sources <sources.json> [--out bases] [--target 300] [--house-share 0.5] [--min-authored 24]
// </claudes_code_comments>

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseMidi } from '../src/bases/midi.js';
import { importMidi, numberBase } from '../src/bases/base-import.js';
import { validateBase } from '../src/bases/base-format.js';
import { indexRow, balanceOf } from '../src/bases/base-library.js';
import { authorBase, AUTHORED_FAMILIES, RECIPE_NOTES, AUTHOR_VERSION } from '../src/bases/base-author.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SOURCES = arg('--sources', null);
const OUT = path.resolve(HERE, '..', arg('--out', 'bases'));
const TARGET = Number(arg('--target', 300));
const SHARE = Number(arg('--house-share', 0.5));
const MIN_AUTHORED = Number(arg('--min-authored', 24));

// the house writes no em or en dash; a source title that carries one is written with a hyphen
export const plain = (x) => (typeof x === 'string' ? x.replace(/[\u2013\u2014]/g, '-') : x);

export function sha256Of(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

export function readSources(p) {
  const list = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!Array.isArray(list)) throw new Error('sources manifest is not a list');
  return list;
}

export function buildOne(src, id) {
  const bytes = fs.readFileSync(src.path);
  const sha = sha256Of(bytes);
  if (src.sha256 && src.sha256 !== sha) return { error: `sha256 differs from the manifest (${sha.slice(0, 12)} vs ${src.sha256.slice(0, 12)})` };
  let parsed;
  try { parsed = parseMidi(bytes); } catch (e) { return { error: `midi: ${e.message}` }; }
  const { base, report } = importMidi(parsed, { id, kind: src.kind ?? null, family: src.family ?? null, bpm: src.bpm ?? null, maxBars: src.maxBars ?? null });
  const onsets = Object.values(base.parts).reduce((a, p) => a + p.events.length, 0);
  if (onsets < 8) return { error: `only ${onsets} onsets in the window` };
  const problems = validateBase(base);
  if (problems.length) return { error: problems.join('; ') };
  return { base, report, sha, bytes: bytes.length };
}

export function authoredPlan(current, target, share) {
  const want = { house: Math.round(target * share), ambient: target - Math.round(target * share) };
  return { house: Math.max(0, want.house - current.house), ambient: Math.max(0, want.ambient - current.ambient), want };
}

function ledgerMd(rows, counts, built) {
  const lines = [];
  lines.push('# THE BASES LEDGER');
  lines.push('');
  lines.push(`Built ${built}. ${rows.length} bases: ${counts.house} house, ${counts.ambient} ambient; origins ${Object.entries(counts.origins).map(([k, v]) => `${k} ${v}`).join(', ')}.`);
  lines.push('');
  lines.push('One row per base. A base file carries no source; this ledger is the only map from base-NNNN to where it came');
  lines.push('from, under which licence, on which day, with the sha256 of the raw file. The raw files are not shipped.');
  lines.push('Every licence here allows redistribution in converted form: CC0, public domain, CC BY and CC BY-SA (attribution');
  lines.push('kept in this row). An authored base names its recipe, its seed and the theory it follows.');
  lines.push('');
  lines.push('| id | kind | family | bars | bpm | origin | source | author | licence | downloaded | sha256 |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const s = r.source;
    if (r.origin === 'authored') lines.push(`| ${r.id} | ${r.kind} | ${r.family} | ${r.bars} | ${r.bpm} | authored | recipe ${s.recipe} seed ${s.seed} v${s.version}: ${s.theory} | settle-hear | authored here | | |`);
    else lines.push(`| ${r.id} | ${r.kind} | ${r.family} | ${r.bars} | ${r.bpm} | midi | [${(s.title ?? s.file).replace(/\|/g, '/')}](${s.url}) | ${(s.author ?? '').replace(/\|/g, '/')} | ${s.licence} | ${s.downloaded ?? ''} | ${(s.sha256 ?? '').slice(0, 16)} |`);
  }
  lines.push('');
  lines.push('## The sources, by licence');
  lines.push('');
  const bySrc = new Map();
  for (const r of rows) if (r.origin === 'midi') { const k = r.source.collection ?? r.source.url; if (!bySrc.has(k)) bySrc.set(k, { ...r.source, n: 0 }); bySrc.get(k).n += 1; }
  for (const s of bySrc.values()) lines.push(`- ${s.collection ?? s.title}: ${s.n} bases, ${s.licence}. ${s.licenceText ?? ''} (${s.url})`);
  lines.push('');
  lines.push('> Ledger written by tools/bases_build.mjs; edit the sources manifest and rebuild, never this file.');
  return lines.join('\n');
}

export function main() {
  if (!SOURCES) { console.error('usage: node tools/bases_build.mjs --sources <sources.json> [--out bases] [--target 300] [--house-share 0.5]'); process.exit(2); }
  const sources = readSources(SOURCES);
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/^base-\d{4}\.json$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const bases = [];
  const ledger = [];
  const dropped = [];
  // 1. import every source, then keep at most the kind's share less the authored minimum, preferring the
  //    least dense ambient beds (a bed, not a busy piece) and the most four-on-the-floor house grooves
  const imported = [];
  for (const src of sources) {
    const r = buildOne(src, 'base-0000');
    if (r.error) { dropped.push({ path: path.basename(src.path), reason: r.error }); continue; }
    imported.push({ src, r });
  }
  const want = { house: Math.round(TARGET * SHARE), ambient: TARGET - Math.round(TARGET * SHARE) };
  const keep = [];
  for (const kind of ['house', 'ambient']) {
    const ofKind = imported.filter((x) => x.r.base.kind === kind);
    const cap = Math.max(0, want[kind] - MIN_AUTHORED);
    if (ofKind.length <= cap) { keep.push(...ofKind); continue; }
    const ranked = ofKind.slice().sort((a, b) => (kind === 'ambient' ? a.r.base.signature.density - b.r.base.signature.density : b.r.base.signature.fourFloor - a.r.base.signature.fourFloor));
    keep.push(...ranked.slice(0, cap));
    for (const x of ranked.slice(cap)) dropped.push({ path: path.basename(x.src.path), reason: `over the ${kind} share (${ofKind.length} imported, ${cap} kept; ranked by ${kind === 'ambient' ? 'density' : 'four-on-the-floor'})` });
  }
  const keepSet = new Set(keep);
  let n = 1;
  for (const x of imported) {
    if (!keepSet.has(x)) continue;
    const { src, r } = x;
    const id = numberBase(n);
    const b = { ...r.base, id };
    bases.push(b);
    ledger.push({ id, origin: 'midi', kind: b.kind, family: b.family, bars: b.bars, bpm: b.tempo.bpm, source: { collection: plain(src.collection ?? null), title: plain(src.title ?? null), author: plain(src.author ?? null), url: src.url ?? null, page: src.page ?? null, licence: src.licence, licenceText: src.excerpt ?? null, downloaded: src.downloaded ?? null, sha256: r.sha, bytes: r.bytes, file: path.basename(src.path), styleHint: src.style ?? null }, quantise: b.quantise, window: r.report.window, note: src.note ?? null });
    n += 1;
  }
  const current = balanceOf(bases);
  const plan = authoredPlan(current, TARGET, SHARE);
  for (const kind of ['house', 'ambient']) {
    const fams = AUTHORED_FAMILIES[kind];
    for (let k = 0; k < plan[kind]; k++) {
      const family = fams[k % fams.length];
      const seed = (fams.indexOf(family) + 1) * 1000 + Math.floor(k / fams.length) + 1;
      const id = numberBase(n);
      const b = authorBase(kind, family, seed);
      b.id = id;
      const problems = validateBase(b);
      if (problems.length) { dropped.push({ path: `authored ${kind}/${family}/${seed}`, reason: problems.join('; ') }); continue; }
      bases.push(b);
      ledger.push({ id, origin: 'authored', kind, family, bars: b.bars, bpm: b.tempo.bpm, source: { recipe: family, seed, version: AUTHOR_VERSION, theory: RECIPE_NOTES[family] }, note: null });
      n += 1;
    }
  }
  for (const b of bases) {
    const file = { ...b };
    delete file.recipe;
    fs.writeFileSync(path.join(OUT, `${b.id}.json`), JSON.stringify(file));
  }
  const index = bases.map(indexRow);
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
  fs.writeFileSync(path.join(OUT, 'ledger.json'), JSON.stringify(ledger, null, 1));
  const counts = { ...balanceOf(bases), origins: {}, families: {} };
  for (const b of bases) { counts.origins[b.origin] = (counts.origins[b.origin] ?? 0) + 1; counts.families[b.family] = (counts.families[b.family] ?? 0) + 1; }
  const built = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(OUT, 'LEDGER.md'), ledgerMd(ledger, counts, built));
  const midiBases = bases.filter((b) => b.origin === 'midi');
  const q = midiBases.map((b) => b.quantise.meanAbsMs);
  const report = [
    `# THE BASES BUILD (${built})`,
    '',
    `${bases.length} bases: ${counts.house} house (${(counts.share * 100).toFixed(1)}%), ${counts.ambient} ambient.`,
    `Origins: ${Object.entries(counts.origins).map(([k, v]) => `${k} ${v}`).join(', ')}. Authored to fill: house ${plan.house}, ambient ${plan.ambient} (target ${TARGET} at ${SHARE} house).`,
    `Families: ${Object.entries(counts.families).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `Quantise error over the ${midiBases.length} midi bases: mean of meanAbsMs ${(q.reduce((a, b) => a + b, 0) / Math.max(1, q.length)).toFixed(2)} ms, largest meanAbsMs ${Math.max(0, ...q).toFixed(2)} ms.`,
    '',
    `Dropped ${dropped.length}:`,
    ...dropped.map((d) => `- ${d.path}: ${d.reason}`),
    '',
    'Rebuild: `node tools/bases_build.mjs --sources <manifest>` from settle-hear.',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'BUILD.md'), report);
  console.log(report);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
