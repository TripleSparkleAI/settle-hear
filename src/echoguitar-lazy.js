// settle-hear · echoguitar-lazy - THE GUITARS, loaded on demand: THE ECHO GUITAR (echoguitar.js) and, since lane
// DJGUITARS, THE PSYCH GUITARS (djguitars.js, which re-exports the echo guitar) share one chunk, fetched the first
// time a set or a note asks for either, so the site's first load carries neither and only one small loader.
//
// <claudes_code_comments>
// ** Function List **
// ECHO_PHRASE_COUNT         - how many phrases echoguitar.js holds (a test pins it to ECHO_PHRASES.length)
// loadEchoGuitar()          - fetch the guitars' module (djguitars.js, which re-exports echoguitar.js) once; the same
//                             promise for every caller; a failed fetch may be retried
// echoGuitarNow()           - the loaded module, or null while it is still on its way
//
// ** Technical Review **
// - THE FIRST LOAD (the site's bundle guard, tests/bundleslim.test.mjs): the hero's DJ is in the site's entry chunk,
//   so anything mix-layers.js or instruments.js imports statically is too. The guitar is only heard when a set's
//   answer deals it, so its 6 KB wait in their own chunk, as dj-trained.js keeps the trained models. Lane DJGUITARS
//   put its two guitars in the same chunk behind this one loader: the entry had about 600 B of room left, and a
//   second loader and its preload map cost about 300 B.
// - createMixSet starts the fetch when a set is made; a bar that deals a guitar before the module has arrived plays
//   nothing in that part, and the next one does. The guitars' decks and boards live in the module (djguitars.js
//   createSetGuitars, the echo guitar's phrase deck among them since lane DJGUITARS), so mix-layers.js holds only one
//   call a bar.
// </claudes_code_comments>

export const ECHO_PHRASE_COUNT = 3;

let mod = null;
let promise = null;

export function loadEchoGuitar() {
  if (!promise) promise = import('./djguitars.js').then((m) => { mod = m; return m; }).catch((e) => { promise = null; throw e; });
  return promise;
}

export const echoGuitarNow = () => mod;
