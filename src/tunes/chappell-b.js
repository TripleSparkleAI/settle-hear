// settle-hear · tunes/chappell-b - melodies written out by hand from one public-domain printed source.
// The source, its scan and its licence are named in SOURCE below and in wikis/WIKI_OLD_MELODIES/. Each tune
// names its place in the book. The notes were read from the scan; nothing here is copied from a modern
// transcription. Fill this file by the reader brief: SETTLE/runs/melodies200/READER_BRIEF.md.
//
// Volume 2 of Chappell's Popular Music of the Olden Time, a book for voice and piano. Only the voice line is
// read (the stems-up notes that carry the words on the upper staff). The printed page number is the PDF page
// number plus 376 in this scan. Book page: wikis/WIKI_OLD_MELODIES/books/BOOK_CHAPPELL_B.md.

export const SOURCE = {
  kind: 'print',
  book: 'Popular Music of the Olden Time, volume 2',
  compiler: 'William Chappell, accompaniments by G. A. Macfarren',
  year: 1859,
  scan: 'https://archive.org/details/popularmusicofol02chapuoft',
};

const READ = (pdf) => `read from the scan (PDF page ${pdf}, the voice line in sections at 500 to 800 dpi) and proofed bar by bar by lane MELODIES200 reader chappell-b, 2026-10-02`;

export const TUNES = [
  {
    id: 'chappell2-p538-barbara-allen',
    title: 'Barbara Allen',
    region: 'english',
    kind: 'ballad',
    key: 'D', mode: 'major', meter: '3/4',
    origin: 'English ballad tune; Chappell prints it with the words of Percy\'s version and calls it "the tune from tradition"; marked Slowly',
    tags: ['air', 'slow', 'english'],
    abc: 'X:1\nT:Barbara Allen\nM:3/4\nL:1/8\nK:D\nz D | F G A3 G | F E D3 E | F A d2 d2 | c A3 z c |\nd B G2 A B | A F D3 E | F A B2 A2 | F D3 |]',
    source: { ...SOURCE, where: 'p. 538 (PDF page 162)' },
    transcription: READ(162),
  },
  {
    id: 'chappell2-p707-drink-to-me-only',
    title: 'Drink to Me Only with Thine Eyes',
    region: 'english',
    kind: 'song-air',
    key: 'Eb', mode: 'major', meter: '6/8',
    origin: 'English song air to Ben Jonson\'s words; Chappell says every attempt to find the composer, Dr. Burney\'s among them, had failed; marked Slowly and smoothly',
    tags: ['air', 'slow', 'english'],
    abc: 'X:2\nT:Drink to Me Only with Thine Eyes\nM:6/8\nL:1/8\nK:Eb\nG G G A2 A | B A G F G A | B E A G2 F | E3- E3 |\nG G G A2 A | B A G F G A | B E A G2 F | E3- E2 || B |\nB G B e2 B | B G B B2 B | c2 B B A G | G3 F3 ||\nG G G A2 A | B A G F G A | B E A G2 F | E6 |]',
    source: { ...SOURCE, where: 'p. 707 (PDF page 331)' },
    transcription: READ(331),
  },
  {
    id: 'chappell2-p710-the-girl-i-left-behind-me',
    title: 'The Girl I Left Behind Me',
    region: 'english',
    kind: 'song-air',
    key: 'Eb', mode: 'major', meter: 'C',
    origin: 'English air, also called Brighton Camp; Chappell finds it in a manuscript of about 1770 and in military collections, calls it a march, and dates it to about 1758; marked Gracefully',
    tags: ['air', 'march', 'english'],
    abc: 'X:3\nT:The Girl I Left Behind Me\nM:C\nL:1/8\nK:Eb\ne d | c2 A2 G2 F2 | G2 E2 C3 D | E2 E2 E F G A | B4 G2 e d |\nc2 B A G2 F2 | G2 E2 C2 E2 | D E F2 B,2 D2 | E4 E2 || B A |\nG2 B2 c2 d2 | e2 B2 G2 B A | G2 B2 c2 d2 | e4 d2 e d |\nc2 B A G2 F2 | G2 E2 C2 E2 | D E F2 B,2 D2 | E4 E2 |]',
    source: { ...SOURCE, where: 'p. 710 (PDF page 334)' },
    transcription: READ(334),
  },
];

export default TUNES;
