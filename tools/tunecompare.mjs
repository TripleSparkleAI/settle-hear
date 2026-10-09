#!/usr/bin/env node
// tunecompare - compare two independent readings of the same printed tune, note by note.
//
// <claudes_code_comments>
// ** Function List **
// noteSeq(abc)        - the tune as the flute plays it: [{ midi, beats }] (repeats unfolded, tied notes merged)
// alignNotes(a, b)    - an edit-distance alignment of two note lists: { same, diff, ops }
// main()              - read a JSON file of { id, abc } blind readings and compare each with the tune in the list
//
// ** Technical Review **
// - The check behind the blind re-read: a second reader, who has not seen the first reader's ABC, writes the
//   same tune from the same scan. Both are parsed with the flute's own reader, so ornaments and spelling that do
//   not change the sound do not count; a pitch or a length that differs does.
// - alignNotes() is a plain Levenshtein alignment where two notes match only if pitch and length both match.
//   The report gives the agreement (same / longer list) and the first places they part, so a person can open
//   the scan at that bar and settle it.
// </claudes_code_comments>
//
// Usage: node tools/tunecompare.mjs readings.json      (readings.json = [{ "id": "...", "abc": "..." }, ...])
import { readFileSync } from 'node:fs';
import { parseAbc } from '../src/abc.js';
import { TUNES } from '../src/tunes.js';

export function noteSeq(abc) {
  return parseAbc(abc).notes.filter((n) => n.midi != null).map((n) => ({ midi: n.midi, beats: Math.round(n.beats * 1000) / 1000 }));
}

export function alignNotes(a, b) {
  const n = a.length, m = b.length;
  const D = Array.from({ length: n + 1 }, (_, i) => new Int32Array(m + 1).fill(0).map((_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  const eq = (x, y) => x.midi === y.midi && x.beats === y.beats;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (eq(a[i - 1], b[j - 1]) ? 0 : 1));
  }
  const ops = [];
  let i = n, j = m, same = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (eq(a[i - 1], b[j - 1]) ? 0 : 1)) {
      if (eq(a[i - 1], b[j - 1])) same++;
      else ops.push({ at: i - 1, op: 'change', a: a[i - 1], b: b[j - 1] });
      i--; j--;
    } else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.push({ at: i - 1, op: 'only-first', a: a[i - 1] }); i--; }
    else { ops.push({ at: i, op: 'only-second', b: b[j - 1] }); j--; }
  }
  return { same, diff: D[n][m], ops: ops.reverse() };
}

function main() {
  const file = process.argv[2];
  if (!file) { console.log('usage: node tools/tunecompare.mjs readings.json'); process.exit(2); }
  const readings = JSON.parse(readFileSync(file, 'utf8'));
  let total = 0, agree = 0;
  for (const r of readings) {
    const t = TUNES.find((x) => x.id === r.id);
    if (!t) { console.log(`?    ${r.id}: not in the list`); continue; }
    const a = noteSeq(t.abc), b = noteSeq(r.abc);
    const { same, diff, ops } = alignNotes(a, b);
    const share = same / Math.max(a.length, b.length);
    total++; if (diff === 0) agree++;
    console.log(`${diff === 0 ? 'SAME' : 'DIFF'} ${r.id}  ${same}/${Math.max(a.length, b.length)} notes agree (${(share * 100).toFixed(1)}%)`);
    for (const o of ops.slice(0, 6)) console.log(`       note ${o.at + 1}: ${o.op} ${o.a ? `${o.a.midi}/${o.a.beats}` : ''} ${o.b ? `-> ${o.b.midi}/${o.b.beats}` : ''}`);
  }
  console.log(`${agree} of ${total} readings agree note for note`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
