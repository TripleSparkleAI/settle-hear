// settle-hear · abc - a small reader for ABC notation, enough for the old dance tunes and airs the symphony plays.
//
// <claudes_code_comments>
// ** Function List **
// parseAbc(text)        - ABC text -> { title, meter, unit, key: { tonic, mode, pc }, notes: [{ midi, beats, bar }] }
//                         midi is null for a rest; beats are quarter-note beats; bar counts the bar lines passed
//                         (repeats unfolded), so a tune can be cut into its bars and phrases (tune-composer.js)
// keyAccidentals(key)   - a K: field -> { C: 0, D: 0, F: 1, ... } (the key signature, +1 sharp, -1 flat)
// tuneBeats(notes)      - the total length of a note list, in beats
//
// ** Technical Review **
// - The subset, chosen from what old printed fiddle, pipe and flute tunes need once they are written in ABC:
//   header fields X: T: M: L: K: Q: (others ignored); notes A-G (the octave from middle C) and a-g (the octave
//   above), with ' (up an octave) and , (down); accidentals ^ ^^ _ __ = that last to the end of the bar; lengths
//   (2, 3/2, /2, /, //); rests z and x; ties (-); broken rhythm (> and <, as in strathspeys); triplets (3abc;
//   repeats |: ... :| and :: with first and second endings [1 and [2 (or |1 |2).
// - Ignored on purpose: chord symbols in quotes, grace notes in braces, decorations (~ . H T u v and !...!),
//   lyrics (w:), slurs ( ), and chords in square brackets (the top note is kept). A tune played by one flute
//   needs one line.
// - The key signature applies to every note unless an accidental in the bar overrides it. K: takes a tonic and a
//   mode (maj, m, min, mix, dor, phr, lyd, loc, aeo, ion) and the pipe keys HP / Hp (both read as A mixolydian
//   with F# and C#, the Highland pipe scale written the usual way). A key with five or more accidentals takes
//   the flat side when its tonic is spelled with a flat or is plain F (Db, Bbm, Ebm, Fphr), the sharp side otherwise.
// - midi: ABC 'C' is middle C = midi 60, 'c' = 72. Lengths are in units of L: (default 1/8), converted to quarter
//   beats (1/8 -> 0.5 beat).
// </claudes_code_comments>

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NAT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MODE_SHIFT = { maj: 0, ion: 0, mix: 5, dor: 10, aeo: 3, m: 3, min: 3, phr: 8, lyd: 7, loc: 1 };
const MODE_NAME = { maj: 'ionian', ion: 'ionian', mix: 'mixolydian', dor: 'dorian', aeo: 'aeolian', m: 'aeolian', min: 'aeolian', phr: 'phrygian', lyd: 'lydian', loc: 'locrian' };
// sharps in order, flats in order
const SHARPS = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLATS = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
// the major key with k sharps (k > 0) or flats (k < 0), by pitch class
const MAJOR_BY_PC = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: 7, 5: -1, 10: -2, 3: -3, 8: -4 };

function readKey(field = 'C') {
  const f = field.trim();
  if (/^(HP|Hp)\b/.test(f)) return { tonic: 'A', mode: 'mixolydian', pc: 9, sig: 2 };
  if (/^none\b/i.test(f) || f === '') return { tonic: 'C', mode: 'ionian', pc: 0, sig: 0 };
  const m = /^([A-G])([#b]?)\s*([A-Za-z]*)/.exec(f);
  if (!m) return { tonic: 'C', mode: 'ionian', pc: 0, sig: 0 };
  const pc = (NAT[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const word = m[3].toLowerCase();
  const key = word === '' ? 'maj' : Object.keys(MODE_SHIFT).find((k) => word.startsWith(k) && (k !== 'm' || !/^m[a-z]/.test(word) || word.startsWith('min'))) ?? 'maj';
  const majorPc = (pc + MODE_SHIFT[key]) % 12;
  let sig = MAJOR_BY_PC[majorPc] ?? 0;
  // a flat tonic (or plain F) names the flat side: Db, Gb, Cb majors and their modes (Bbm, Ebm, Fphr) carry 5, 6, 7 flats
  if (sig >= 5 && (m[2] === 'b' || (m[1] === 'F' && m[2] === ''))) sig -= 12;
  return { tonic: m[1] + m[2], mode: MODE_NAME[key], pc, sig };
}

export function keyAccidentals(field) {
  const k = readKey(field);
  const acc = Object.fromEntries(LETTERS.map((l) => [l, 0]));
  if (k.sig > 0) for (const l of SHARPS.slice(0, k.sig)) acc[l] = 1;
  if (k.sig < 0) for (const l of FLATS.slice(0, -k.sig)) acc[l] = -1;
  return acc;
}

function frac(s) {
  if (!s) return 1;
  const m = /^(\d*)(\/*)(\d*)$/.exec(s);
  if (!m) return 1;
  const num = m[1] ? +m[1] : 1;
  let den = 1;
  if (m[2]) den = m[3] ? +m[3] : Math.pow(2, m[2].length);
  return num / den;
}

function headerValue(text, field) {
  const m = new RegExp(`^${field}:\\s*(.*)$`, 'm').exec(text);
  return m ? m[1].trim() : null;
}

// one pass over the body: tokens of { note | rest | bar | repeat-start | repeat-end | ending }
function tokenize(body) {
  const out = [];
  let i = 0;
  const s = body;
  while (i < s.length) {
    const c = s[i];
    if (c === '%') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '"') { i = s.indexOf('"', i + 1); i = i < 0 ? s.length : i + 1; continue; }
    if (c === '{') { i = s.indexOf('}', i + 1); i = i < 0 ? s.length : i + 1; continue; }
    if (c === '!') { const j = s.indexOf('!', i + 1); i = j < 0 ? i + 1 : j + 1; continue; }
    if (c === '[' && /[A-Za-z]:/.test(s.slice(i + 1, i + 3))) { const j = s.indexOf(']', i); i = j < 0 ? s.length : j + 1; continue; }
    if (c === '[' && /\d/.test(s[i + 1] ?? '')) { out.push({ t: 'ending', n: +s[i + 1] }); i += 2; continue; }
    if (c === ':' && s[i + 1] === ':') { out.push({ t: 'end' }, { t: 'start' }); i += 2; continue; }
    if (c === ':' && s[i + 1] === '|') { out.push({ t: 'end' }); i += 2; if (/\d/.test(s[i] ?? '')) { out.push({ t: 'ending', n: +s[i] }); i++; } continue; }
    if (c === '|' && s[i + 1] === ':') { out.push({ t: 'bar' }, { t: 'start' }); i += 2; continue; }
    if (c === '|') {
      out.push({ t: 'bar' });
      i++;
      if (s[i] === ']' || s[i] === '|') i++;
      if (/\d/.test(s[i] ?? '')) { out.push({ t: 'ending', n: +s[i] }); i++; }
      continue;
    }
    if (c === '(' && /\d/.test(s[i + 1] ?? '')) { out.push({ t: 'tuplet', p: +s[i + 1] }); i += 2; continue; }
    if (c === '>' || c === '<') {
      let k = 0;
      while (s[i] === c) { k++; i++; }
      out.push({ t: 'broken', dir: c, k });
      continue;
    }
    if (c === '-') { out.push({ t: 'tie' }); i++; continue; }
    // a chord in square brackets: keep its first note
    if (c === '[') {
      const j = s.indexOf(']', i);
      const inner = s.slice(i + 1, j < 0 ? s.length : j);
      const after = /^[\d/]*/.exec(s.slice((j < 0 ? s.length : j) + 1))[0];
      const n = /^[_^=]*[A-Ga-g][',]*/.exec(inner);
      if (n) out.push(...tokenize(n[0] + after));
      i = (j < 0 ? s.length : j + 1) + after.length;
      continue;
    }
    const note = /^(\^\^|\^|__|_|=)?([A-Ga-gzx])([',]*)(\d*\/*\d*)/.exec(s.slice(i));
    if (note) {
      const [all, acc, letter, oct, len] = note;
      if (letter === 'z' || letter === 'x') out.push({ t: 'rest', len: frac(len) });
      else out.push({ t: 'note', acc: acc ?? null, letter, oct, len: frac(len) });
      i += all.length;
      continue;
    }
    i++;
  }
  return out;
}

// unfold |: :| repeats and [1 [2 endings into a flat token list
function unfold(tokens) {
  const out = [];
  let section = [];
  let ending = 0; // the ending we are inside (0 = none)
  let firstEnding = [];
  let inRepeat = false;
  const flush = () => { out.push(...section); section = []; };
  for (const tk of tokens) {
    if (tk.t === 'start') { flush(); inRepeat = true; ending = 0; firstEnding = []; continue; }
    if (tk.t === 'ending') {
      ending = tk.n;
      continue;
    }
    if (tk.t === 'end') {
      // play the section, its first ending, the section again; the second ending follows in the token stream
      out.push(...section, ...firstEnding, ...section);
      section = [];
      firstEnding = [];
      inRepeat = false;
      ending = 0;
      continue;
    }
    if (ending === 1 && inRepeat) firstEnding.push(tk);
    else if (ending === 2) out.push(tk);
    else section.push(tk);
    if (tk.t === 'bar' && ending === 2) ending = 0;
  }
  // a :| with no |: before it repeats from the start
  out.push(...section);
  return out;
}

export function parseAbc(text) {
  const src = String(text ?? '');
  const lines = src.split(/\r?\n/);
  const body = lines.filter((l) => !/^[A-Za-z]:/.test(l) || /^\|/.test(l)).join('\n');
  const title = headerValue(src, 'T') ?? 'untitled';
  const meter = headerValue(src, 'M') ?? '4/4';
  const L = headerValue(src, 'L');
  const unit = L ? frac(L.replace(/\s/g, '').replace(/^(\d+)\/(\d+)$/, '$1/$2')) : 1 / 8;
  const unitBeats = unit * 4;
  const kField = headerValue(src, 'K') ?? 'C';
  const key = readKey(kField);
  const sig = keyAccidentals(kField);

  const tokens = unfold(tokenize(body));
  const notes = [];
  let barAcc = {};
  let tuplet = null; // { left, scale }
  let pendingBroken = null; // the factor for the next note
  let tieNext = false;
  let barNo = 0;
  for (const tk of tokens) {
    if (tk.t === 'bar') { barAcc = {}; if (notes.length && notes[notes.length - 1].bar === barNo) barNo += 1; continue; }
    if (tk.t === 'tuplet') { tuplet = { left: tk.p, scale: tk.p === 3 ? 2 / 3 : tk.p === 2 ? 3 / 2 : tk.p === 4 ? 3 / 4 : 2 / 3 }; continue; }
    if (tk.t === 'tie') { tieNext = true; continue; }
    if (tk.t === 'broken') {
      const prev = notes[notes.length - 1];
      if (!prev) continue;
      const long = 2 - Math.pow(0.5, tk.k);
      const short = Math.pow(0.5, tk.k);
      const base = prev.beats;
      prev.beats = base * (tk.dir === '>' ? long : short);
      pendingBroken = tk.dir === '>' ? short : long;
      continue;
    }
    if (tk.t !== 'note' && tk.t !== 'rest') continue;
    let beats = tk.len * unitBeats;
    if (tuplet) { beats *= tuplet.scale; tuplet.left -= 1; if (tuplet.left <= 0) tuplet = null; }
    if (pendingBroken) { beats *= pendingBroken; pendingBroken = null; }
    if (tk.t === 'rest') { notes.push({ midi: null, beats, bar: barNo }); tieNext = false; continue; }
    const upper = tk.letter.toUpperCase();
    let octave = tk.letter === upper ? 4 : 5;
    for (const c of tk.oct) octave += c === "'" ? 1 : -1;
    const slot = `${upper}${octave}`;
    if (tk.acc) barAcc[slot] = tk.acc === '^' ? 1 : tk.acc === '^^' ? 2 : tk.acc === '_' ? -1 : tk.acc === '__' ? -2 : 0;
    const alter = barAcc[slot] ?? sig[upper];
    const midi = 12 * (octave + 1) + NAT[upper] + alter;
    const prev = notes[notes.length - 1];
    if (tieNext && prev && prev.midi === midi) prev.beats += beats;
    else notes.push({ midi, beats, bar: barNo });
    tieNext = false;
  }
  return { title, meter, unit, key, notes };
}

export function tuneBeats(notes) {
  return (notes ?? []).reduce((a, n) => a + (Number.isFinite(n.beats) ? n.beats : 0), 0);
}
