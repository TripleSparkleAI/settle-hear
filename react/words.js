// words - THE DJ's word helpers at runtime (lane FINISHDJ, 2026-10-09): the default words function and the three
// helpers the big view calls. They import nothing, so a page that draws THE DJ does not carry the word lists
// (lineWords.js), which only a site's catalogue extractor and the tests read.
//
// <claudes_code_comments>
// ** Function List **
// enWords(en, vars)  - the default words function: the English template with its {name} values filled in
// whyWords(why, w)   - one lean part's name in the page's language: 'theme X' and 'section X' keep the name
// splitWords(how, w) - dj.js pickSplit's "how" in the page's language
// clip(s, n)         - the first n characters a reader sees (grapheme clusters where the runtime knows them)
//
// ** Technical Review **
// - A words function is (en, vars) -> string. It is called with the exact English templates lineWords.js lists; a
//   site maps each to its translation and fills the values. enWords fills the English, so without a site's function
//   every word reads as it always did, byte for byte.
// - whyWords keeps a theme name as it is and reads a section key as its word ('section peak' -> the page's "peak").
// - clip cuts a section's name to five characters for the planner's plan rows; Intl.Segmenter keeps a Hindi syllable
//   or a combining mark whole, and Array.from is the fallback.
// </claudes_code_comments>

export const enWords = (en, vars) => (vars ? String(en).replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k]))) : String(en));

// one lean part's name: the theme and the section parts carry a name, which stays (a section key reads as a word)
export function whyWords(why, w = enWords) {
  const s = String(why);
  if (s.startsWith('theme ')) return w('theme {name}', { name: s.slice(6) });
  if (s.startsWith('section ')) return w('section {name}', { name: w(s.slice(8)) });
  return w(s);
}

// dj.js pickSplit's how: "the 6 letters of SETTLE" or "a random draw"
export function splitWords(how, w = enWords) {
  const m = /^the (\d+) letters of (.+)$/.exec(String(how));
  return m ? w('the {n} letters of {word}', { n: m[1], word: m[2] }) : w(String(how));
}

// the first n characters a reader sees: a Hindi syllable or an emoji is one, not two or three code units
export function clip(s, n) {
  const str = String(s);
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str)].slice(0, n).map((x) => x.segment).join('');
  }
  return Array.from(str).slice(0, n).join('');
}
