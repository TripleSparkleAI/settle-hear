// settle-hear · tunes/oswald - melodies written out by hand from one public-domain printed source.
// The source, its scan and its licence are named in SOURCE below and in wikis/WIKI_OLD_MELODIES/. Each tune
// names its place in the book. The notes were read from the scan; nothing here is copied from a modern
// transcription. Fill this file by the reader brief: SETTLE/runs/melodies200/READER_BRIEF.md.
//
// Book: James Oswald, The Caledonian Pocket Companion, London: printed for the author, c.1745 to 1765,
// books 1 to 8 bound in one volume. A single melody line for German flute or violin. Only the air itself is
// read: where a tune is followed by variations, the variations are left out. Grace notes (the small
// appoggiaturas the engraver prints before many notes), trills and slurs are left out.
// Each book is paginated from 1. Measured offsets: book 1, PDF page = printed page + 14; book 2,
// PDF page = printed page + 52.

export const SOURCE = {
  kind: 'print',
  book: 'The Caledonian Pocket Companion, containing all the favourite Scotch tunes with variations for the German flute (books 1 to 8)',
  compiler: 'James Oswald (1710-1769)',
  year: 1745,
  scan: 'https://archive.org/details/caledonianpocket00oswa',
};

const READ = 'proofed bar by bar by lane MELODIES200 reader oswald, 2026-10-03';

export const TUNES = [
  {
    id: 'oswald-b1-p5-wally-wally',
    title: 'Wally wally',
    region: 'scottish',
    kind: 'song-air',
    key: 'D', mode: 'mixolydian', meter: '3/4',
    origin: 'Old Scots song air (Waly Waly); marked Slow. One sharp in the signature with a final on D; the C sharp at the first cadence is printed as an accidental, the C in the second strain is natural. Grace notes left out',
    tags: ['highlands', 'air', 'slow', 'scottish'],
    abc: 'X:1\nT:Wally wally\nM:3/4\nL:1/8\nK:Dmix\nD | FG A2 d2 | e f/g/ e2 E2 | FG A2 d2 | e d/^c/ d3 :|\n|: c | BA G3 A | BA c3 B/A/ | Bd A2 f2 | g f/e/ d3 c |\nBA F3 d | BA E3 c | BA d3 F | G F/E/ D3 :|',
    source: { ...SOURCE, where: 'Book 1, p. 5 (PDF page 19)' },
    transcription: 'read from the scan (PDF page 19, each staff in thirds at 1000 dpi, proofed in quarters at 1100 dpi, the last bar at 1600 dpi) and ' + READ,
  },
  {
    id: 'oswald-b1-p6-polwart-on-the-green',
    title: 'Polwart on the Green',
    region: 'scottish',
    kind: 'song-air',
    key: 'D', mode: 'major', meter: '4/4',
    origin: 'Old Scots song air; marked Andante, common time. The first two strains only: the book prints further strains with the instruction "After every two strains repeat the first two". Grace notes left out',
    tags: ['highlands', 'air', 'slow', 'scottish'],
    irregular: 'the last bar of the second strain is a plain half note D, so with the quarter pickup it is one quarter short, as printed',
    abc: 'X:1\nT:Polwart on the Green\nM:4/4\nL:1/8\nK:D\nA2 | F2 ED A2 A2 | A4 d3 e | f2 ef gfed | c6 A2 |\nF2 ED A2 A2 | G3 A B2 AG | A2 f2 gfef | d6 :|\n|: A2 | defg a2 gf | efga g2 fe | d2 de fefg | e6 A2 |\nF2 ED A2 A2 | G3 A BABG | A2 d2 e2 dc | d4 :|',
    source: { ...SOURCE, where: 'Book 1, p. 6 (PDF page 20)' },
    transcription: 'read from the scan (PDF page 20, each staff in quarters at 1100 dpi and again in thirds at 1000 dpi, doubtful heads at 1300 to 1400 dpi) and ' + READ,
  },
  {
    id: 'oswald-b2-p14-the-lass-of-paties-mill',
    title: "The Lass of Patie's Mill",
    region: 'scottish',
    kind: 'song-air',
    key: 'D', mode: 'major', meter: '4/4',
    origin: "Old Scots song air, printed title The Lass of Paties Mill; marked Slow. The air only: the book follows it with a Variation, left out here. Grace notes left out. The A that ends bar 1 is printed with a lightly inked head; its stem has no flag and the bar needs a quarter, as in the matching bar 5",
    tags: ['highlands', 'air', 'slow', 'scottish'],
    abc: "X:1\nT:The Lass of Patie's Mill\nM:4/4\nL:1/8\nK:D\nA3/2G/ | F2 ED FG A2 | d4 A3 d | Bcd A BAGF | E6 A3/2G/ |\nF2 ED FG A2 | d3 e/f/ A3 d | Bcd B cdec | d3 e d2 :|\n|: f3/2g/ | e3 d c2 BA | d3 e/f/ A3 d | Bcd A BAGF | E6 f3/2g/ |\na/g/f g/f/e fdBg | E4 A2 GF | GBAd ceAc | d3 e d2 :|",
    source: { ...SOURCE, where: 'Book 2, p. 14 (PDF page 66)' },
    transcription: 'read from the scan (PDF page 66, each staff in fifths at 1300 dpi, proofed in thirds at 1000 dpi, every doubtful group at 1600 to 2200 dpi) and ' + READ,
  },
];

export default TUNES;
