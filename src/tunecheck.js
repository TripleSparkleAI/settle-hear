// settle-hear · tunecheck - the checks a hand-read tune must pass before it joins the flute's tunes: every bar
// the length the meter says, and no tune in the list twice.
//
// <claudes_code_comments>
// ** Function List **
// meterBeats(meter)          - an M: field -> the length of one bar in quarter beats (null for free rhythm)
// abcBars(text)              - the tune's bars as printed, before repeats are unfolded:
//                              [{ text, beats, before, after, ending, edge }]
// barProblems(text)          - the bars whose length disagrees with the meter: [{ bar, beats, want, why }]
// melodyPrint(text, n)       - the shape of the opening: the first n intervals in semitones between changes of
//                              pitch, as a string (the same tune in another key gives the same print)
// normTitle(title)           - a title folded for comparison (case, punctuation, a leading "the", brackets)
// duplicateTunes(list, opts) - pairs of tunes that share a folded title or an opening print
// metaProblems(tune)        - missing metadata (region, kind, key, mode, meter, origin, transcription), no theme tag,
//                              a bad id, bars off the meter without an `irregular` note
//
// ** Technical Review **
// - A tune read from an old scan by eye can lose or gain a note. The commonest slip changes a bar's length, so
//   abcBars() measures every bar with the same reader the flute uses (parseAbc) and barProblems() lists the bars
//   that do not fill the meter. An EDGE bar (the first bar, the last, a bar beside a double bar or a repeat sign,
//   a bar inside a first or second ending) may be short, because that is where pickups and their complements
//   sit; an edge bar may never be long. Every other bar must be exactly one bar long.
// - A printed irregularity (an engraver's short bar, a bar of free time in an air) is kept as printed, and the
//   tune names it in an `irregular` field; the tests accept a bar problem only on a tune that says why.
// - melodyPrint() unfolds repeats, drops rests, merges repeated notes and keeps the first n intervals. Two
//   settings of one tune from two books usually share their opening contour, so duplicateTunes() reports them.
//   A pair that is truly two tunes can be listed in `allow` as 'idA|idB'.
// </claudes_code_comments>

import { parseAbc } from './abc.js';
import { THEMES } from './themes.js';

export function meterBeats(meter) {
  const m = String(meter ?? '').trim();
  if (!m || /^none$/i.test(m) || /^free$/i.test(m)) return null;
  if (m === 'C') return 4;
  if (m === 'C|') return 4;
  const f = /^(\d+)\s*\/\s*(\d+)$/.exec(m);
  if (!f) return null;
  return (+f[1] * 4) / +f[2];
}

function header(text, field) {
  const m = new RegExp(`^${field}:\\s*(.*)$`, 'm').exec(text);
  return m ? m[1].trim() : null;
}

function cleanBody(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .filter((l) => !/^[A-Za-z]:/.test(l))
    .map((l) => l.replace(/%.*$/, ''))
    .join(' ')
    .replace(/"[^"]*"/g, ' ')
    .replace(/![^!]*!/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\[[A-Za-z]:[^\]]*\]/g, ' ');
}

const BAR = /(\[\||:*\|\]|::|:*\|\|?:*)/;

export function abcBars(text) {
  const M = header(text, 'M') ?? '4/4';
  const L = header(text, 'L') ?? '1/8';
  const K = header(text, 'K') ?? 'C';
  const body = cleanBody(text).replace(/\[(\d)/g, ' @$1 ').replace(/\|(\d)/g, '| @$1 ');
  const parts = body.split(BAR);
  const bars = [];
  let before = 'start';
  for (let i = 0; i < parts.length; i += 2) {
    const seg = parts[i];
    const after = i + 1 < parts.length ? parts[i + 1] : 'end';
    const notes = seg.replace(/@\d/g, ' ');
    if (/[A-Ga-gzx]/.test(notes)) {
      const p = parseAbc(`M:${M}\nL:${L}\nK:${K}\n${notes}`);
      const beats = p.notes.reduce((a, n) => a + n.beats, 0);
      bars.push({ text: seg.trim(), beats, before, after, ending: /@\d/.test(seg) });
    }
    before = after;
  }
  bars.forEach((b, i) => {
    const plain = (d) => d === '|';
    b.edge = i === 0 || i === bars.length - 1 || !plain(b.before) || !plain(b.after) || b.ending;
  });
  return bars;
}

export function barProblems(text) {
  const want = meterBeats(header(text, 'M'));
  if (want == null) return [];
  const out = [];
  abcBars(text).forEach((b, i) => {
    const d = b.beats - want;
    if (d > 1e-6) out.push({ bar: i + 1, beats: b.beats, want, why: 'too long', text: b.text });
    else if (d < -1e-6 && !b.edge) out.push({ bar: i + 1, beats: b.beats, want, why: 'too short', text: b.text });
  });
  return out;
}

export function melodyPrint(text, n = 12) {
  let notes;
  try { notes = parseAbc(text).notes; } catch { return ''; }
  const pitches = [];
  for (const x of notes) {
    if (x.midi == null) continue;
    if (pitches.length && pitches[pitches.length - 1] === x.midi) continue;
    pitches.push(x.midi);
    if (pitches.length > n) break;
  }
  const iv = [];
  for (let i = 1; i < pitches.length; i++) iv.push(pitches[i] - pitches[i - 1]);
  return iv.length >= n ? iv.join(',') : '';
}

export function normTitle(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/^\s*the\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function duplicateTunes(list, { allow = [] } = {}) {
  const ok = new Set(allow.flatMap((p) => [p, p.split('|').reverse().join('|')]));
  const out = [];
  const byTitle = new Map();
  const byPrint = new Map();
  for (const t of list) {
    const k = normTitle(t.title);
    const p = melodyPrint(t.abc);
    for (const [map, key, why] of [[byTitle, k, 'title'], [byPrint, p, 'opening']]) {
      if (!key) continue;
      const other = map.get(key);
      if (other && !ok.has(`${other.id}|${t.id}`)) out.push({ a: other.id, b: t.id, why, key });
      else if (!other) map.set(key, t);
    }
  }
  return out;
}

const THEME_WORDS = new Set(THEMES.flatMap((t) => t.tags ?? []));
const REGIONS = new Set(['scottish', 'irish', 'english', 'welsh', 'manx', 'breton', 'scandinavian', 'ancient', 'chant', 'japanese', 'cornish', 'medieval', 'other']);

// the fields the DJ and the wiki need, a theme word in the tags, and the bars (unless the tune names an irregularity)
export function metaProblems(t) {
  const p = [];
  for (const f of ['region', 'kind', 'key', 'mode', 'meter', 'origin', 'transcription']) if (!t[f]) p.push(`no ${f}`);
  if (t.region && !REGIONS.has(t.region)) p.push(`unknown region ${t.region}`);
  if (!(t.tags ?? []).some((g) => THEME_WORDS.has(g))) p.push('no theme tag');
  if (!/^[a-z0-9-]+$/.test(t.id ?? '')) p.push('id is not lowercase-hyphenated');
  const m = /^M:\s*(.*)$/m.exec(t.abc ?? '');
  if (!m) p.push('no M: in the abc');
  if (barProblems(t.abc).length && !t.irregular) p.push(`${barProblems(t.abc).length} bar(s) off the meter`);
  return p;
}

