// settle-hear · tunes/oneill1903-carolan - melodies written out by hand from one public-domain printed source.
// The source, its scan and its licence are named in SOURCE below and in wikis/WIKI_OLD_MELODIES/. Each tune
// names its place in the book. The notes were read from the scan; nothing here is copied from a modern
// transcription. Fill this file by the reader brief: SETTLE/runs/melodies200/READER_BRIEF.md.
//
// The book: O'Neill's Music of Ireland, Eighteen Hundred and Fifty Melodies, collected and edited by
// Capt. Francis O'Neill, arranged by James O'Neill, Chicago: Lyon & Healy, 1903. The section headed
// "O'Carolan's Compositions", Nos. 626 to 700, printed pages 111 to 129 (PDF pages 122 to 140 of the
// Internet Archive scan oneills-1850: PDF page = printed page + 11). Turlough O'Carolan lived 1670 to 1738.

export const SOURCE = {
  kind: 'print',
  book: "O'Neill's Music of Ireland: Eighteen Hundred and Fifty Melodies",
  compiler: "Francis O'Neill, arranged by James O'Neill",
  year: 1903,
  scan: 'https://archive.org/details/oneills-1850',
};

const READ = (pdfPage) => `read from the scan (Internet Archive oneills-1850, PDF page ${pdfPage}, each staff in halves at 300 dpi and in thirds at 600 dpi) and proofed bar by bar by lane MELODIES200 reader oneill1903-carolan, 2026-10-02`;

export const TUNES = [
  {
    id: 'oneill-0677-planxty-irwin',
    title: 'Planxty Irwin',
    region: 'irish',
    kind: 'planxty',
    key: 'D', mode: 'major', meter: '6/8',
    origin: "O'Carolan, printed among O'Carolan's Compositions; Gaelic title Pleraca Iarbhain; marked Spirited",
    tags: ['air', 'ancient', 'irish', 'planxty'],
    abc: 'X:677\nT:Planxty Irwin\nM:6/8\nL:1/8\nK:D\nA | d2 c Bcd | A2 G FED | G2 E FGA | C2 D E2 c |\nd2 c Bcd | A2 G FED | G2 E FGA | D2 C D2 :|\nA | d>e d d2 d | e2 e ecA | A/f3/2f e2 d | dcB ABc |\nd2 c Bcd | A2 G FED | G2 E FGA | D2 C D2 :|',
    source: { ...SOURCE, where: 'No. 677, p. 123 (PDF page 134)' },
    transcription: READ(134),
  },
  {
    id: 'oneill-0700-ocarolans-farewell-to-music',
    title: "O'Carolan's Farewell to Music",
    region: 'irish',
    kind: 'air',
    key: 'A', mode: 'minor', meter: 'C',
    origin: "O'Carolan, said to be his last composition; printed among O'Carolan's Compositions; Gaelic title Ceileabrad Ui Cearbhallain le Ceol; marked With feeling",
    tags: ['air', 'slow', 'ancient', 'irish'],
    abc: "X:700\nT:O'Carolan's Farewell to Music\nM:C\nL:1/8\nK:Am\nAB | c2 BA G2 AB | c2 BA G2 cd | e2 de c2 BA | A4 G2 de |\nf2 fg e2 ef | d^cde a3 ^g | a=ged cAB^G | A4 A2 :|\ne2 | gede g2 ga | gede g2 e2 | a^gab a=geg | b4 abag |\n^f2 fg e2 e^f | d^cde a3 ^g | a=ged cAB^G | A4 A2 :|",
    source: { ...SOURCE, where: 'No. 700, p. 129 (PDF page 140)' },
    transcription: READ(140),
  },
  {
    id: 'oneill-0673-planxty-fanny-powers',
    title: 'Planxty Fanny Powers',
    region: 'irish',
    kind: 'planxty',
    key: 'A', mode: 'major', meter: '6/8',
    origin: "O'Carolan, printed among O'Carolan's Compositions; Gaelic title Pleraca Fanni ni Paor; marked Lively; the first strain repeats, the second is printed once",
    tags: ['air', 'ancient', 'irish', 'planxty'],
    abc: 'X:673\nT:Planxty Fanny Powers\nM:6/8\nL:1/8\nK:A\n|: A2 E ABc | d2 c B2 A | G2 F EFE | G2 A B2 d |\ncBA cde | f2 B B2 A | GFE EFG | A3 A2 z :|\ne c/d/e e c/d/e | A2 A A2 A | f d/e/f f d/e/f | B2 B B2 B |\ncde fga | gab efe | cBA BcB | A3 A2 z |]',
    source: { ...SOURCE, where: 'No. 673, p. 122 (PDF page 133)' },
    transcription: READ(133),
  },
];

export default TUNES;
