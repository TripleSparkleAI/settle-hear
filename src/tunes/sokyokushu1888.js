// settle-hear · tunes/sokyokushu1888 - the voice part of Sakura, read from the 1888 Tokyo Academy of Music print.
// Read from the scan by lane ANCIENT (wikis/WIKI_OLD_MELODIES/03-ANCIENT-AND-WORLD.md).

export const SOURCE = {
  kind: 'print',
  book: 'Collection of Japanese Koto Music (Sokyokushu)',
  compiler: 'Tokyo Academy of Music, under Shuji Isawa',
  year: 1888,
  scan: 'https://archive.org/details/collectionjapan00gakkgoog',
};

export const TUNES = [
  {
    id: 'sakura',
    title: 'Sakura (voice part)',
    region: 'japanese',
    kind: 'song-air',
    key: 'E',
    mode: 'in scale',
    meter: 'C',
    origin: 'Edo-period urban song, the in scale on E',
    tags: ['ancient', 'air', 'slow'],
    abc: 'X:5\nT:Sakura\nM:C\nL:1/4\nK:C\nA A B2 | A A B2 | A B c B | A (B/A/) F2 |\nE C E F | E (E/C/) B,2 | A B c B | A (B/A/) F2 |\nE C E F | E (E/C/) B,2 | A A B2 | A A B2 |\nz E F2 | (B/A/) F E2 |]',
    source: { ...SOURCE, where: 'No. 2 (Internet Archive collectionjapan00gakkgoog, page images 22 to 25)' },
    transcription: 'read from the 1888 scan by lane ANCIENT; wikis/WIKI_OLD_MELODIES/03-ANCIENT-AND-WORLD.md (lane ANCIENT, branch wiki-ancient)',
  },
];

export default TUNES;
