#!/usr/bin/env node
// tunelint - check hand-read tunes before they join the flute's list.
//
// <claudes_code_comments>
// ** Function List **
// main()  - lint the named book files (or every book) and print one line per tune, then the duplicates
//
// ** Technical Review **
// - For each tune: tuneProblems() (the source rule and the parse), barProblems() (every bar the meter's length,
//   pickups and section ends allowed short), the metadata fields the DJ and the wiki need (region, kind, key,
//   mode, meter, tags with at least one theme word), and an M: line in the ABC.
// - Every book file is loaded on its own, so a file another reader has half-written is reported and skipped.
// - Then duplicates across EVERY book (a folded title or the same opening shape), so a reader sees at once
//   whether a tune is already in another book's file.
// - Exit 1 if any tune fails, so it can gate a commit.
// </claudes_code_comments>
//
// Usage:
//   node tools/tunelint.mjs                         every book
//   node tools/tunelint.mjs src/tunes/athole-a.js   one book (duplicates still checked against all)
//   node tools/tunelint.mjs --abc <id>              print one tune's ABC and its bars with their lengths
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { tuneProblems } from '../src/tunes.js';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { barProblems, abcBars, duplicateTunes, melodyPrint, metaProblems } from '../src/tunecheck.js';

// every book file, loaded one by one so a file another reader is half-way through cannot stop this one
async function loadAll() {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'tunes');
  const all = [];
  const broken = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'index.js').sort()) {
    try {
      const mod = await import(pathToFileURL(path.join(dir, f)).href + `?t=${Date.now()}`);
      for (const t of mod.default ?? mod.TUNES ?? []) all.push({ ...t, book: f.replace(/\.js$/, '') });
    } catch (e) { broken.push(`${f}: ${e.message.split('\n')[0]}`); }
  }
  return { all, broken };
}

async function main() {
  const args = process.argv.slice(2);
  const { all: ALL_TUNES, broken } = await loadAll();
  for (const b of broken) console.log(`BROKEN FILE ${b}`);
  if (args[0] === '--abc') {
    const t = ALL_TUNES.find((x) => x.id === args[1]);
    if (!t) { console.log(`no tune ${args[1]}`); process.exit(1); }
    console.log(t.abc);
    abcBars(t.abc).forEach((b, i) => console.log(`${String(i + 1).padStart(3)} ${b.beats.toFixed(3).padStart(7)}${b.edge ? ' edge' : '     '}  ${b.text}`));
    for (const b of barProblems(t.abc)) console.log(`  BAR ${b.bar}: ${b.why} (${b.beats} of ${b.want}) ${b.text}`);
    return;
  }
  let list = ALL_TUNES;
  if (args.length) {
    list = [];
    for (const a of args) {
      const mod = await import(pathToFileURL(path.resolve(a)).href + `?t=${Date.now()}`);
      list.push(...(mod.default ?? mod.TUNES ?? []));
    }
  }
  let bad = 0;
  for (const t of list) {
    const p = [...tuneProblems(t), ...metaProblems(t)];
    const bars = barProblems(t.abc);
    if (p.length) bad++;
    console.log(`${p.length ? 'FAIL' : 'ok  '} ${t.id}  [${melodyPrint(t.abc, 8)}]${p.length ? '  ' + p.join('; ') : ''}`);
    if (bars.length && !t.irregular) for (const b of bars) console.log(`       bar ${b.bar}: ${b.why} (${+b.beats.toFixed(3)} of ${b.want})  ${b.text}`);
  }
  const ids = new Map();
  for (const t of ALL_TUNES) ids.set(t.id, (ids.get(t.id) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) { bad++; console.log(`DUPLICATE ID ${id} x${n}`); }
  const dups = duplicateTunes(ALL_TUNES);
  const mine = new Set(list.map((t) => t.id));
  for (const d of dups) if (mine.has(d.a) || mine.has(d.b)) { bad++; console.log(`DUPLICATE ${d.why}: ${d.a} ~ ${d.b}`); }
  console.log(`${list.length} tunes, ${bad} problems; ${ALL_TUNES.length} tunes in all books`);
  process.exit(bad ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
