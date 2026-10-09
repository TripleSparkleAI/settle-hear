// settle-hear · tunes/chappell-a - melodies written out by hand from one public-domain printed source.
// The source, its scan and its licence are named in SOURCE below and in wikis/WIKI_OLD_MELODIES/. Each tune
// names its place in the book. The notes were read from the scan; nothing here is copied from a modern
// transcription. Fill this file by the reader brief: SETTLE/runs/melodies200/READER_BRIEF.md.
// Book page: wikis/WIKI_OLD_MELODIES/books/BOOK_CHAPPELL_A.md. Voice and piano: only the voice line is read.

export const SOURCE = {
  kind: 'print',
  book: 'Popular Music of the Olden Time, Vol. I',
  compiler: 'William Chappell (1809 to 1888); airs harmonized by G. A. Macfarren',
  year: 1859,
  scan: 'https://archive.org/details/popularmusicofol01chapuoft',
};

const S = SOURCE;
const READ = (pdf) => `read from the scan (PDF page ${pdf}, each staff in halves at 300 dpi or more, the voice line only) and proofed bar by bar by lane MELODIES200 reader chappell-a, 2026-10-02`;

export const TUNES = [
  {
    id: 'chappell1-p230-green-sleeves',
    title: 'Green Sleeves',
    region: 'english',
    kind: 'ballad',
    key: 'E', mode: 'minor', meter: '6/8',
    origin: 'English ballad tune, the oldest copy, which Chappell takes from William Ballet\'s Lute Book compared with Sir John Hawkins\' transcripts of virginal music; the ballad was licensed in 1580; marked Smoothly and in moderate time',
    tags: ['air', 'slow', 'ancient', 'english'],
    abc: 'X:1\nT:Green Sleeves\nM:6/8\nL:1/8\nK:Em\nE | G2 A B3/2c/B | A2 F D3/2E/F | G2 E E3/2^D/E | F2 ^D B,2 E |\nG2 A B3/2c/B | A2 F D3/2E/F | G3/2F/E ^D3/2^C/D | E3 E2 || z |\nd3 d3/2^c/B | A2 F D3/2E/F | G2 E E3/2^D/E | F2 ^D B,3 |\nd3 d3/2^c/B | A2 F D3/2E/F | G3/2F/E ^D3/2^C/D | E3 E2 |]',
    source: { ...S, where: 'p. 230, Tune of Green Sleeves, oldest copy (PDF page 262)' },
    transcription: READ(262),
  },
  {
    id: 'chappell1-p059-the-three-ravens',
    title: 'The Three Ravens',
    region: 'english',
    kind: 'ballad',
    key: 'G', mode: 'dorian', meter: 'C',
    origin: 'English ballad, which Chappell takes from Ravenscroft\'s Melismata, 1611, among the Country Pastimes; marked Slowly, smoothly, and with great expression',
    tags: ['air', 'slow', 'ancient', 'english'],
    abc: 'X:1\nT:The Three Ravens\nM:C\nL:1/8\nK:Gdor\nG2 | G2 A2 B2 d2 | c2 B2 c4 | G3 A B2 A2 | d3 e d2 d2 |\nG2 A2 B2 G2 | A2 B2 c2 B c | d8- | d6 d2 |\nd2 f2 e2 d2 | c2 B2 A3 A | B2 d2 c2 B2 | A2 ^F2 D2 B c | d4 c B A G | ^F G A2 G2 |]',
    source: { ...S, where: 'p. 59, The Three Ravens (PDF page 91)' },
    transcription: READ(91),
  },
  {
    id: 'chappell1-p060-the-kinges-hunt-is-upp',
    title: 'The Kinges Hunt is upp',
    region: 'english',
    kind: 'ballad',
    key: 'Eb', mode: 'major', meter: '6/8',
    origin: 'English song of the reign of Henry VIII (The Hunt is up, known by 1537 and attributed to William Gray), which Chappell gives from a manuscript of Mr. Collier\'s; marked Merrily',
    tags: ['air', 'ancient', 'english'],
    abc: 'X:1\nT:The Kinges Hunt is upp\nM:6/8\nL:1/8\nK:Eb\nB | e2 B G3/2A/B | e2 B G3/2A/B | c3/2B/A G3/2F/E |\nF3- F2 B | c A B c2 B | A3/2G/A B2 B | c3/2d/e d3/2e/f | e3- e2 |]',
    source: { ...S, where: 'p. 60, The Kinges Hunt is upp (PDF page 92)' },
    transcription: READ(92),
  },
  {
    id: 'chappell1-p123-walsingham',
    title: 'Walsingham',
    region: 'english',
    kind: 'ballad',
    key: 'A', mode: 'minor', meter: '3/4',
    origin: 'English ballad tune (As I went to Walsingham), which Chappell finds in Queen Elizabeth\'s and Lady Neville\'s Virginal Books (with variations by Dr. John Bull), in Holborne\'s Cittharn Schoole 1597 and Barley\'s New Booke of Tabliture 1596; marked Slow and plaintive',
    tags: ['air', 'slow', 'ancient', 'english'],
    abc: 'X:1\nT:Walsingham\nM:3/4\nL:1/8\nK:Am\nc d e2 d2 | c2 A2 E2 | c d e2 d2 | c6 |\nB3/2c/ d d e d | c2 A2 E2 | B c d2 c B | A6 |]',
    source: { ...S, where: 'p. 123, Walsingham (PDF page 155)' },
    transcription: READ(155),
  },
];

export default TUNES;
