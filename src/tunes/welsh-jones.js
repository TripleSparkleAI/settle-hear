// settle-hear · tunes/welsh-jones - melodies written out by hand from one public-domain printed source.
// The source, its scan and its licence are named in SOURCE below and in wikis/WIKI_OLD_MELODIES/. Each tune
// names its place in the book. The notes were read from the scan; nothing here is copied from a modern
// transcription. Fill this file by the reader brief: SETTLE/runs/melodies200/READER_BRIEF.md.
// Book page: wikis/WIKI_OLD_MELODIES/books/BOOK_WELSH_JONES.md. The book is for harp or harpsichord; the top
// line of the treble staff is read (the voice line where words are printed), and the top note of any chord.

export const SOURCE = {
  kind: 'print',
  book: 'Musical and Poetical Relicks of the Welsh Bards (new edition, 1794)',
  compiler: 'Edward Jones (1752 to 1824), Bard to the Prince of Wales',
  year: 1794,
  scan: 'https://archive.org/details/musicalandpoeti00jonegoog',
};

const S = SOURCE;
const WHO = 'read from the scan (each staff in halves at 450 to 1000 dpi) and proofed bar by bar by lane MELODIES200 reader welsh-jones, 2026-10-02';

export const TUNES = [
  {
    id: 'jones1794-p151-ar-hyd-y-nos',
    title: 'Ar hyd y nos (The live-long night)',
    region: 'welsh',
    kind: 'song-air',
    key: 'Bb', mode: 'major', meter: 'C',
    origin: 'Welsh air, Ar hyd y nos, printed gloss The live-long night; marked Maestoso; the voice line with the harp chorus Ar hyd y nos; the air only, the variations that follow are left out; the half rest in bar 4 is faintly printed',
    tags: ['air', 'slow', 'welsh'],
    abc: 'X:1\nT:Ar hyd y nos\nM:C\nL:1/8\nK:Bb\nB3A G2B2 | c3B A2F2 | G4 A3A | B4 z4 |\nB3A G2B2 | c3B A2F2 | G4 A3A | B4 ||\ne2d2 e2f2 | g2f2 e2d2 | e2d2 c2B2 | d2c2 B2A2 |\nB3A G2B2 | c3B A2F2 | G4 A3A | B4 |]',
    source: { ...S, where: 'p. 151 (PDF page 165)' },
    transcription: WHO,
  },
];

export default TUNES;
