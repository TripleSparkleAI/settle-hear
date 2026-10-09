// settle-hear · tunes/ancient - the oldest melodies with a known notation, written out by hand from public-domain
// printed transcriptions (each published before 1929 by an editor long dead).
// The sources, their scans and their licences are named below and in wikis/WIKI_OLD_MELODIES/books/BOOK_ANCIENT.md
// and wikis/WIKI_OLD_MELODIES/03-ANCIENT-AND-WORLD.md. Each tune names its place in the book. The notes were read
// from the scan; nothing here is copied from a modern transcription. Method:
// SETTLE/runs/melodies200/READER_BRIEF.md.

const JAN1899 = {
  kind: 'print',
  book: 'Musici scriptores graeci, Supplementum: Melodiarum reliquiae',
  compiler: 'Karl von Jan (1836-1899)',
  year: 1899,
  scan: 'https://archive.org/details/musiciscriptores00jank',
};

export const SOURCE = [JAN1899];

export const TUNES = [
  {
    id: 'jan1899-04-song-of-seikilos',
    title: 'Song of Seikilos (Sicili epitaphium)',
    region: 'ancient',
    kind: 'song-air',
    key: 'E', mode: 'dorian', meter: '6/8',
    origin: 'Greek song inscribed with its notation on the grave stele of Seikilos, Tralles (Asia Minor), usually dated 1st to 2nd century AD; words Hoson zes phainou; transcribed by Karl von Jan in modern notation (signature two sharps, ends on E with a pause)',
    tags: ['ancient', 'air', 'slow'],
    abc: 'X:1\nT:Song of Seikilos\nM:6/8\nL:1/8\nK:Edor\nA e2 | e3 c d e | d3 c2 d | e d c B A2 |\nB G2 A c e | d c d c A2 | B G2 A c B |\nd e c A A2 | A F E2 |]',
    source: { ...JAN1899, where: 'No. 4, Sicili epitaphium, p. 39 (PDF page 43)' },
    transcription: 'read from the scan (PDF page 43, each staff at 700 to 1400 dpi) and proofed bar by bar by lane MELODIES200 reader ancient, 2026-10-02',
  },
  {
    id: 'jan1899-06-hymn-to-the-sun',
    title: 'Hymn to the Sun (Eis Helion), attributed to Mesomedes',
    region: 'ancient',
    kind: 'hymn',
    key: 'A', mode: 'phrygian', meter: 'C and 6/8 (mixed, as printed)',
    origin: 'Greek hymn to Helios, attributed to Mesomedes of Crete (2nd century AD), notated in Byzantine manuscripts of Greek music theory and first printed by Vincenzo Galilei in 1581; Karl von Jan transcribes verses 7 to 25 (the six opening verses carry no notation); signature one flat, ends on A with a pause',
    tags: ['ancient', 'air', 'slow'],
    irregular: 'the print marks the meter C 6/8 and its bars hold 8, 7, 6 or 4 eighths as printed; written with M:none and every printed bar line kept. Two notes printed in small type (verse 15, the second e of its second bar; verse 16, the e before the bar end) are kept as printed',
    abc: 'X:2\nT:Hymn to the Sun\nM:none\nL:1/8\nK:Aphr\nA A | A2 A d A2 B A | G3 A2\nG c | c2 c c A2 G c | d3 c2\nc | d2 c d B2 c d | e3 e2\nc2 | e2 c e d2 c d | c2 e d2\nc d | e2 d c d2 B G | A B B A2\nA2 | B2 c c c2 c c | c2 d c2\nd2 | c2 B c d2 e d | c B2 A2\nA B | c2 c c A2 F G | c3 c2\nc d | e2 e e | e2 e f | d2 f e2\nB2 | c2 d e e2 e d | c2 B A2 ||\nA2 | G2 A B c2 c c | B2 B A2\nc d | c2 c d B2 c d | e3 e2\ne e | c2 e e c2 e d | f3 e2\nc2 | d2 e e c2 d B | G2 e e2 ||\nA B | c2 c c A2 B c | c d2 c2\nd c | d2 c c B2 c d | e3 e2\nc d | e2 d c d2 G A | B c B A2\nA A | A2 A A A2 B A | B G B c\nc d | e2 d c d2 G A | B c B A2 |]',
    source: { ...JAN1899, where: 'No. 6, Hymnus ad Solem, verses 7 to 25, pp. 49, 51, 53, 55 (PDF pages 53, 55, 57, 59)' },
    transcription: 'read from the scan (PDF pages 53 to 59, each staff in thirds at 1000 dpi, doubtful notes at 1300 to 2400 dpi) and proofed bar by bar by lane MELODIES200 reader ancient, 2026-10-02',
  },
];

export default TUNES;
