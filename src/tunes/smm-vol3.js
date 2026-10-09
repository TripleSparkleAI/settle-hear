// settle-hear · tunes/smm-vol3 - melodies written out by hand from one public-domain printed source.
// The source, its scan and its licence are named in SOURCE below and in wikis/WIKI_OLD_MELODIES/. Each tune
// names its place in the book. The notes were read from the scan; nothing here is copied from a modern
// transcription. Fill this file by the reader brief: SETTLE/runs/melodies200/READER_BRIEF.md.
//
// Book: James Johnson (with Robert Burns), The Scots Musical Museum, Volume Third, Edinburgh 1790 (the
// preface is dated Edinburgh, February 2d 1790). Voice over a figured bass: the voice staff only is read.
// Grace notes, small appoggiatura notes, slurs and figures are left out. The scan was read from the
// Internet Archive page images (page/n<PDF page - 1>.jpg), which are sharper than the PDF's own images.
// Printed page = PDF page + 198 (approximately; page 209 is not numbered in the scan).

export const SOURCE = {
  kind: 'print',
  book: 'The Scots Musical Museum, Volume Third',
  compiler: 'James Johnson, with songs collected and written by Robert Burns',
  year: 1790,
  scan: 'https://archive.org/details/scotsmusicalmuse03john',
};

const READ = 'proofed bar by bar by lane MELODIES200 reader smm-vol3, 2026-10-03';

export const TUNES = [
  {
    id: 'smm-3-203-gill-morice',
    title: 'Gill Morice',
    region: 'scottish',
    kind: 'song-air',
    key: 'C', mode: 'mixolydian', meter: '3/4',
    origin: 'Scots ballad air, words begin "Gill Morice was an earle\'s son"; marked Slow. Each half ends on a small appoggiatura A before the long C; the small note is left out',
    tags: ['highlands', 'air', 'slow', 'ballad', 'scottish'],
    abc: 'X:1\nT:Gill Morice\nM:3/4\nL:1/8\nK:Cmix\nF3/2G/ | A2 A2 GA | d2 c2 A G/F/ | c2 c2 de | f4 e2 |\nd2 c2 Ac | d2 f3/2A/ G F/D/ | F2 F2 G3/2A/ | c4 |:\nf/g/a/g/ | f2 d2 Ac | d2 f3/2A/ G F/D/ | F2 F2 G3/2A/ | c4 :|',
    source: { ...SOURCE, where: 'No. 203, p. 212 (PDF page 14)' },
    transcription: 'read from the scan (page image n13, each staff in halves at about 450 dpi, doubtful heads at about 750 dpi) and ' + READ,
  },
  {
    id: 'smm-3-213-ay-waukin-o',
    title: 'Ay waukin, O',
    region: 'scottish',
    kind: 'song-air',
    key: 'A', mode: 'mixolydian', meter: '3/2',
    origin: 'Scots song air, words begin "Simmer\'s a pleasant time"; marked Slow. The print ends on A, as here; a fermata on the A in bar 2 and the slurs are left out. In bar 1 a small stemless mark below the second note is taken as a blot, not a note',
    tags: ['highlands', 'air', 'slow', 'scottish'],
    abc: 'X:1\nT:Ay waukin, O\nM:3/2\nL:1/8\nK:Amix\nd2 d3/2c/ B2 A2 F4 | d3 c B2 e2 c2 A3/2A/ |\nd2 d3/2c/ B2 A2 F3 A | B2 Bc d2 c2 B2 A2 || F4 F2 F2 E4 |\nF2 F2 F2 A2 B2 d2 | F2 F2 F2 F2 E2 FA | B2 A2 d3 c B2 A2 |]',
    source: { ...SOURCE, where: 'No. 213, p. 222 (PDF page 24)' },
    transcription: 'read from the scan (page image n23, each staff in thirds at about 900 dpi with staff-line guides, doubtful heads at about 1500 dpi) and ' + READ,
  },
  {
    id: "smm-3-264-ca-the-ewes-to-the-knowes",
    title: "Ca' the ewes to the knowes",
    region: 'scottish',
    kind: 'song-air',
    key: 'B', mode: 'phrygian', meter: '2/4',
    origin: "Scots song air, the old words collected by Burns, beginning \"Ca' the ewes to the knowes, Ca' them whare the heather grows\"; marked Slow. One sharp; the print ends on B, so the mode is named from that final. The last bar is printed short (three quavers) before the double bar",
    tags: ['highlands', 'air', 'slow', 'scottish'],
    abc: "X:1\nT:Ca' the ewes to the knowes\nM:2/4\nL:1/8\nK:Bphr\nE3/2F/ B2 | A/F3/2 A2 | F3/2E/ D3/2d/ | c3/2d/ e2 |\nf3/2B/ B3/2B/ | A3/2d/ F2 | E2 F3/2A/ | B2 B |]",
    source: { ...SOURCE, where: 'No. 264, p. 273 (PDF page 75)' },
    transcription: 'read from the scan (page image n74, each staff in thirds at about 900 dpi with staff-line guides, the low notes at about 1500 dpi) and ' + READ,
  },
  {
    id: 'smm-3-296-tam-glen',
    title: 'Tam Glen',
    region: 'scottish',
    kind: 'song-air',
    key: 'G', mode: 'minor', meter: '9/8',
    origin: 'Scots song air to Burns\'s words beginning "My heart is a breaking, dear Tittie". Two flats: the second staff shows both clearly; on the first staff the signature is faintly printed, and the natural the engraver set before the E in bar 1 confirms the E flat. The F sharps are printed in the bars',
    tags: ['highlands', 'air', 'slow', 'scottish'],
    abc: 'X:1\nT:Tam Glen\nM:9/8\nL:1/8\nK:Gm\nD | GAG BAG ^F=ED | GAG AFA c2A |\nGAG BAG ^FGA | f=ed cAF G2 |]',
    source: { ...SOURCE, where: 'No. 296, p. 306 (PDF page 108)' },
    transcription: 'read from the scan (page image n107, each staff in thirds at about 900 dpi with staff-line guides, one doubtful head settled by the pixel rows of the scan) and ' + READ,
  },
  {
    id: 'smm-3-260-john-anderson-my-jo',
    title: 'John Anderson my Jo',
    region: 'scottish',
    kind: 'song-air',
    key: 'A', mode: 'minor', meter: 'C|',
    origin: 'Scots song air to Burns\'s words beginning "John Anderson my jo, John, When we were first acquent"; marked Lively. No key signature; the print ends on A, with G sharp before the final and F sharp in bar 3.',
    tags: ['highlands', 'air', 'scottish'],
    abc: 'X:1\nT:John Anderson my Jo\nM:C|\nL:1/8\nK:Am\nAG | E2 A2 A2 B2 | c4 c2 dc | B3 A G2 ^F2 | G6 AG |\nE2 A2 A2 B2 | c4 c2 d2 | e3 d c2 d2 | e6 g3/2f/ |\ne3 d c2 d2 | e3 f g2 fe | d3 c B2 c2 | d6 cd |\ne2 c2 d2 cB | c2 BA B2 AG | E2 A2 A2 ^G2 | A6 |]',
    source: { ...SOURCE, where: 'No. 260, p. 269 (PDF page 71)' },
    transcription: 'read from the scan (page image n70, each staff in thirds at about 900 dpi with staff-line guides, doubtful heads at about 1200 dpi and checked by a note-head finder) and ' + READ,
  },
  {
    id: 'smm-3-280-hardyknute',
    title: 'Hardyknute: Or, The Battle of Largs',
    region: 'scottish',
    kind: 'ballad',
    key: 'A', mode: 'minor', meter: '3/4',
    origin: 'Scots ballad air, words begin "Stately stept he east the wa"; marked Very Slow. No key signature; the print ends on A. Four small grace notes and a trill are left out. In bar 7 a dot stands high beside the first D, well away from its head; the bar adds up only without it, so it is read as a stray mark',
    tags: ['highlands', 'air', 'slow', 'scottish'],
    abc: 'X:1\nT:Hardyknute\nM:3/4\nL:1/8\nK:Am\nA2 A2 c3/2d/ | e2 g2 d3/2c/ | A2 d2 d3/2c/ | A4 z c |\nA2 A3/2c/ G3/2E/ | E2 G2 D3/2C/ | D2 D2 E3/2G/ | A4 |]',
    source: { ...SOURCE, where: 'No. 280, p. 289 (PDF page 91)' },
    transcription: 'read from the scan (page image n90, each staff in thirds at about 900 dpi with staff-line guides and a note-head finder, doubtful bars at about 1500 dpi) and ' + READ,
  },
];

export default TUNES;
