// THE DJ VIEW'S WORDS (lane FINISHDJ, 2026-10-09): the big view THE DJ line opens read in English on every page
// language, and the line showed the set's tag (DEEP.OPEN.V1.8G0TV), a code a visitor cannot read. Every word the view
// writes now goes through the `words` function (react/lineWords.js lists each template), and the tag lives in the
// view only. These checks read the source (settle-hear's suite needs no React) and run the pure word helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  enWords, DJ_LINE_WORDS, DJ_VIEW_WORDS, DJ_WORDS, LEAN_WHY_WORDS, whyWords, splitWords, clip,
} from '../react/lineWords.js';
import { pickSplit, rng, leans } from '../src/dj.js';
import { mixLeans } from '../src/mix-machine.js';
import { influenceSay, describeInfluence, makeInfluence } from '../src/dj-influence.js';
import { chainLine, INST_LABEL } from '../src/voice-fx.js';
import { djHeadline } from '../src/popup.js';

const jsx = readFileSync(new URL('../react/Symphony.jsx', import.meta.url), 'utf8');
const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// the part of the file that draws the big view and its panels (everything above the line's own button)
const viewPart = () => {
  const code = noComments(jsx);
  const panels = code.slice(code.indexOf('export function DJLights('), code.indexOf('function status(state'));
  const body = code.slice(code.indexOf('{shown && state && ('), code.indexOf('{line ? ('));
  return { panels, body };
};

test('the big view writes no English of its own: no JSX text and no text prop with words outside w()', () => {
  const { panels, body } = viewPart();
  for (const [name, part] of [['panels', panels], ['view body', body]]) {
    // a run of JSX text: between tags and expressions, once every string literal is gone (a phrase inside w('...') is
    // a string; a phrase written straight into the JSX is not); code reads as code
    const stripped = part.replace(/`(?:[^`\\]|\\.)*`/g, '``').replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
    const code = /\breturn\b|=>|!=|==|\bconst\b|\?\.|[[\]]|&&|\|\||\.(map|slice|filter|join)\(|[;=]|\s\?\s/;
    const unit = /^(Hz|bpm|dB|·|\s)+$/; // a unit beside a number is not a word to translate
    const texts = [...stripped.matchAll(/>([^<>{}]*)(?=[<{])|\}([^<>{}]*)(?=<)/g)].map((m) => (m[1] ?? m[2]).trim()).filter((t) => /[A-Za-z]{2,}/.test(t) && !code.test(t) && !unit.test(t));
    assert.deepEqual(texts, [], `${name}: English JSX text ${JSON.stringify(texts)}`);
    const props = [...part.matchAll(/\b(aria-label|title|label|alt|placeholder)="([^"]*)"/g)].filter((m) => /[A-Za-z]{2,}/.test(m[2]));
    assert.deepEqual(props.map((m) => m[0]), [], `${name}: a text prop in English`);
    // a phrase chosen in a ternary and drawn as it is (a template with {values} is chosen inside w() and filled there)
    const chosen = [...part.matchAll(/(?:\?|:)\s*'([a-z][^'{]*[a-z][^'{]*)'/g)].map((m) => m[1]).filter((t) => / /.test(t));
    assert.deepEqual(chosen, [], `${name}: an English phrase chosen bare in a ternary`);
  }
});

test('every template the view and the line pass to w() is in DJ_WORDS, and each list holds each template once', () => {
  const code = noComments(jsx);
  const used = [
    ...[...code.matchAll(/\bw\('((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'")),
    ...[...code.matchAll(/\bw\("((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]),
    ...[...noComments(src('popup.js')).matchAll(/\bw\('((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]),
  ];
  assert.ok(used.length >= 100, `the view uses its words (${used.length})`);
  for (const en of used) assert.ok(DJ_WORDS.includes(en), `${en} is in DJ_WORDS`);
  assert.equal(new Set(DJ_WORDS).size, DJ_WORDS.length);
  for (const en of [...DJ_LINE_WORDS, ...DJ_VIEW_WORDS]) assert.ok(DJ_WORDS.includes(en), en);
  for (const en of DJ_WORDS) assert.doesNotMatch(en, /[\u2013\u2014]/, `${en}: no en or em dash`);
});

test('the set\'s tag is drawn in the big view only, never on THE DJ line', () => {
  const code = noComments(jsx);
  const line = code.slice(code.indexOf('{line ? ('), code.indexOf(') : (', code.indexOf('{line ? (')));
  assert.doesNotMatch(line, /state\??\.tag|dj-line__tag/, 'the line carries no tag');
  assert.doesNotMatch(readFileSync(new URL('../react/symphony.css', import.meta.url), 'utf8'), /\.dj-line__tag\s*\{/);
  assert.match(code, /\{tag && <p className="dj-dim mono dj-tag">\{w\('tag \{tag\}', \{ tag \}\)\}<\/p>\}/, 'the mix shows it under its rack');
  assert.match(code, /\{state\.tag && !state\.mix && !state\.opener\?\.on && <p className="dj-dim mono dj-tag">\{w\('tag \{tag\}', \{ tag: state\.tag \}\)\}<\/p>\}/, 'and the view shows it when no panel does');
  assert.match(code, /bells: opener\.bells, tag: `\$\{opener\.tag\}`/, 'the opening blend shows its own');
});

test('English stays byte for byte: the default words fill each template exactly as the old code wrote it', () => {
  assert.equal(enWords('{a} with {b} {w}', { a: 'drums', b: 'bass', w: '+1' }), 'drums with bass +1');
  assert.equal(enWords('THE PLANNER · {section} · BAR {bar} OF SET {set}', { section: 'PEAK', bar: 9, set: 2 }), 'THE PLANNER · PEAK · BAR 9 OF SET 2');
  assert.equal(enWords('{n} sweeps, T {from} → {to}', { n: 24, from: '2.00', to: '0.10' }), '24 sweeps, T 2.00 → 0.10');
  assert.equal(djHeadline({ beat: 40, carrier: 216, status: 'playing' }).sub, '40 Hz beat · carrier 216.0 Hz · playing');
  const marked = djHeadline({ beat: 40, carrier: 216, status: 'S', words: (en, v) => `<${en}>${JSON.stringify(v)}` }).sub;
  assert.equal(marked, '<{beat} Hz beat>{"beat":40} · <carrier {hz} Hz>{"hz":"216.0"} · S');
  assert.equal(clip('BREAKDOWN', 5), 'BREAK');
  assert.equal(clip('ब्रेकडाउन', 1), 'ब्रे', 'a Hindi syllable counts as one, its vowel sign kept');
});

test('the lean parts: every name dj.js and mix-machine.js write is listed, and theme and section keep their name', () => {
  const names = new Set();
  for (const f of ['dj.js', 'mix-machine.js']) {
    const s = src(f);
    for (const m of s.matchAll(/^\s*\['([^']+)', -?[\d.]/gm)) names.add(m[1]);
    for (const m of s.matchAll(/why: '([^']+)'/g)) names.add(m[1]);
  }
  for (const n of ['overlap', 'heat', 'flips']) names.delete(n); // also leans: present in the list too
  for (const n of names) assert.ok(LEAN_WHY_WORDS.includes(n), `${n} is listed`);
  // a real run's parts: every name the leans produce reads through whyWords with no English left
  const inp = { heat: 0.5, overlap: 0.4, flips: 0.3, landed: true, film: true, frame: 3, frameMoved: true, newTarget: true, word: 'SETTLE', letters: 6, shape: 'heart', phase: 'cooling' };
  const mem = { barsSinceBeat: 4, barsSinceTheme: 20, barsStatic: 3, barsFlute: 5, barsDrone: 2, beatAway: 3, beat: 7, barsQuiet: 2 };
  const parts = [
    ...Object.values(leans(inp, mem, null, { beat: 0.5, theme: -0.5, static: 0.4, split: 0.2, flute: 0.3, drone: -0.2 })).flatMap((l) => l.parts),
    ...Object.values(mixLeans({ section: 'peak', theme: 'crystals', mood: { heat: 0.5, film: true, landed: true, word: 'X' }, prev: { drums: true }, changed: false, onLine: false, votes: { layers: { drums: 0.5 } } })).flatMap((l) => l.parts),
  ];
  assert.ok(parts.length > 20);
  const mark = (en, v) => (v ? `#${Object.values(v).join('|')}` : '#');
  for (const p of parts) assert.match(whyWords(p.why, mark), /^#/, p.why);
  assert.equal(whyWords('theme DEEP SEA', mark), '#DEEP SEA', 'a theme name stays');
  assert.equal(whyWords('section peak', mark), '##', 'a section key reads as its word');
  for (const p of parts) assert.equal(whyWords(p.why), p.why, 'English unchanged');
});

test('the split\'s how, the carried set and the voices\' lines read in the page\'s words, English unchanged', () => {
  const r = rng(3);
  const hows = new Set();
  for (let i = 0; i < 60; i++) hows.add(pickSplit(r, { letters: 6, word: 'SETTLE' }).how);
  assert.ok(hows.has('a random draw') && hows.has('the 6 letters of SETTLE'));
  for (const h of hows) {
    assert.equal(splitWords(h), h);
    assert.match(splitWords(h, (en, v) => `#${v ? v.word : ''}`), /^#(SETTLE)?$/);
  }
  const win = [makeInfluence({ keyPc: 2, mode: 'dorian', motif: [2, -1], vote: 5 }), makeInfluence({ keyPc: 7, mode: 'ionian', motif: [1] })];
  for (const w of [[], win]) assert.equal(influenceSay(w).map(([en, v]) => enWords(en, v)).join(', '), describeInfluence(w));
  for (const [en] of influenceSay(win)) assert.ok(DJ_VIEW_WORDS.includes(en), en);
  assert.equal(influenceSay([])[0][0], 'the first set: nothing carried yet');
  const v = { inst: 'keys', chain: [{ key: 'warm-drive' }, { key: 'tape-delay' }] };
  assert.equal(chainLine(v, enWords), chainLine(v));
  assert.equal(chainLine({ inst: 'flute', chain: [] }), 'the clear flute: clear, no effects', 'the pure line the symphony writes');
  assert.equal(chainLine({ inst: 'flute', chain: [] }, (en) => `#${en.length}`), '#15: #17');
  assert.equal([v].map(chainLine)[0], chainLine(v), 'as a map callback the index is not a words function');
  for (const label of Object.values(INST_LABEL)) assert.ok(DJ_VIEW_WORDS.includes(label), label);
});
