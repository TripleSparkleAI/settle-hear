// settle-hear · tunes/breton - Breton airs written out by hand from public-domain printed sources.
// The sources, their scans and their licences are named in SOURCE below and in
// wikis/WIKI_OLD_MELODIES/books/BOOK_BRETON.md. Each tune names its place in the book. The notes were read
// from the scan; nothing here is copied from a modern transcription. Filled by the reader brief:
// SETTLE/runs/melodies200/READER_BRIEF.md (lane MELODIES200, reader breton).
//
// From Bourgault-Ducoudray's Trente melodies each tune is the plain Breton melody the book prints after its
// harmonised French version (the voice line only, in the Breton words), not the piano setting.

const BD = {
  kind: 'print',
  book: 'Trente melodies populaires de Basse-Bretagne',
  compiler: 'L.-A. Bourgault-Ducoudray (1840-1910), French verse translation by Francois Coppee',
  year: 1885,
  place: 'Paris: Henry Lemoine',
  scan: 'https://archive.org/details/trentemlodiespo00coppgoog',
};

export const SOURCE = [BD];

export const TUNES = [
  {
    id: 'breton-bd-01-ma-douce-annette',
    title: 'Ma douce Annette',
    region: 'breton',
    kind: 'song-air',
    key: 'G', mode: 'aeolian', meter: '2/4',
    origin: 'Breton song from the Tregor, Breton title Deutu ganeme (Come with me); marked Andantino; the book calls it hypodorian; the two printed quarter-and-eighth triplets are written as tied eighth triplets; sung by Francoise Legall, Belle-Isle-en-Terre; collected by L.-A. Bourgault-Ducoudray',
    tags: ['air', 'slow', 'breton'],
    abc: 'X:1\nT:Ma douce Annette\nM:2/4\nL:1/8\nK:Gm\nd2 de | f3 c | BA cB | G2- G z | d2 cB | c2 f2 | B3 A | G4- | G2- G z |\nGA Bc | de fg | d3 B | B2- B z | d2 gd | c2 B2 | (3G-GA B2- | B2- B z |\nd2 de | f3 c | BA cB | G2- G z | d2 (3c-cB | c2 f2 | B3 A | G4 |]',
    source: { ...BD, where: 'No. 1, the Breton melody Deutu ganeme, p. 3 (PDF page 27)' },
    transcription: 'read from the scan (PDF page 27, each staff in halves at 300 to 600 dpi) and proofed bar by bar by lane MELODIES200 reader breton, 2026-10-02',
  },
  {
    id: 'breton-bd-06-le-sabotier',
    title: 'Le Sabotier',
    region: 'breton',
    kind: 'song-air',
    key: 'Bb', mode: 'lydian', meter: '2/4',
    origin: 'Breton dance song from the Vannetais, Breton title Er sabotier (The clog-maker); marked Allegro; solo and chorus alternate (the chorus sings tran lar di re no); printed with one flat and ending on B flat, no E occurs and the book calls it major; sung by M. Loth, Guemene; collected by L.-A. Bourgault-Ducoudray. The two bars of introductory rest and the paused rest before the pickup are left out',
    tags: ['dance', 'breton'],
    abc: 'X:2\nT:Le Sabotier\nM:2/4\nL:1/8\nK:Bblyd\nF | FB BB | cB B2 | c2 dB | c2 BB |\nBd cB | AG F2 | F2 FF | GA Bz | c2 dB | c2 B2 |]',
    source: { ...BD, where: 'Er sabotier, the Breton melody of Le Sabotier, p. 27 (PDF page 51)' },
    transcription: 'read from the scan (PDF page 51, each staff in thirds at 450 to 500 dpi with drawn staff-line guides) and proofed bar by bar by lane MELODIES200 reader breton, 2026-10-02',
  },
  {
    id: 'breton-bd-07-silvestrik',
    title: 'Silvestrik',
    region: 'breton',
    kind: 'song-air',
    key: 'F', mode: 'dorian', meter: '2/4',
    origin: 'Breton gwerz (ballad) of the son who went away to sea; marked Molto moderato; printed with three flats and ending on F, with E natural throughout, which the book calls minor; four phrases of seven bars, each ending in the singer\'s rest; sung by M. Le Goas, Guingamp; collected by L.-A. Bourgault-Ducoudray',
    tags: ['air', 'slow', 'breton'],
    abc: 'X:3\nT:Silvestrik\nM:2/4\nL:1/8\nK:Fdor\nC2 | F3 F | A2 c2 | c>B AG | F2 AG | F2 =E2 | F4- | F z C2 |\nF3 F | A2 c2 | c>B AG | F2 AG | F2 =E2 | F4- | F z AB |\nc3 B | d2 c2 | B/c/B/A/ AB | c3 B | A2 B/A/G/A/ | G4- | G z GA |\nB3 A | B2 c2 | c>B AG | F2 AG | F2 =E2 | F4- | F z z2 |]',
    source: { ...BD, where: 'Silvestrik, the Breton melody, p. 31 (PDF page 55)' },
    transcription: 'read from the scan (PDF page 55, each staff in quarters at 450 dpi and the doubtful bars again at 600 to 900 dpi with drawn staff-line guides) and proofed bar by bar by lane MELODIES200 reader breton, 2026-10-02',
  },
  {
    id: 'breton-bd-13-le-paradis',
    title: 'Le Paradis',
    region: 'breton',
    kind: 'hymn',
    key: 'A', mode: 'aeolian', meter: '6/8',
    origin: 'Breton cantique Ar baradoz (Paradise), one of the best-known hymns of Brittany; marked Lento; no signature, ending on A, which the book calls hypodorian; the melody uses only G, A, B and c; sung by the Vicomte Hersart de la Villemarque, Quimperle; collected by L.-A. Bourgault-Ducoudray. The last bar ends with the printed rests, completing the pickup',
    tags: ['air', 'slow', 'chant', 'breton'],
    abc: 'X:4\nT:Le Paradis\nM:6/8\nL:1/8\nK:Am\nA | c2 B AB c | B3- B z A | c2 B AB c | B3- B z A | A2 A AB A | G3 A3 |\ncB A GA B | A3- A z A | A2 A AB A | G3 A3 | cB A GA B | A6- | A z z z2 |]',
    source: { ...BD, where: 'Ar baradoz, the Breton melody of Le Paradis, p. 60 (PDF page 84)' },
    transcription: 'read from the scan (PDF page 84, each staff in quarters at 500 dpi with drawn staff-line guides and a head-position aid, the end again at 700 dpi) and proofed bar by bar by lane MELODIES200 reader breton, 2026-10-02',
  },
];

export default TUNES;
