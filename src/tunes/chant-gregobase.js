// settle-hear · tunes/chant-gregobase - plainchant from the CC0 GregoBase corpus (bacor/gregobasecorpus, the
// 2019-10-24 dump), each record typeset from the Vatican edition of the chant. Converted from gabc: the clef's
// line is C, every note one unit long (free rhythm), neume shapes and rhythmic signs dropped.
// The first three were converted by lane ANCIENT (wikis/WIKI_OLD_MELODIES/03-ANCIENT-AND-WORLD.md).
// The forty-seven after the first three were chosen by lane MELODIES200 among the records the dump joins to a book printed
// before 1929 (Graduale Romanum 1908, Antiphonale Romanum 1912, Cantus varii 1902, Hymnarium Cisterciense 1909,
// Processionarium O.P. 1913) and converted by SETTLE/runs/melodies200/tools/gregobase.py --emit
// with the rows in tools/chant_rows.json; each names its book, year and page. Three more were dropped because
// tunecheck found they share a melody with one kept (Crux fidelis, Memento salutis Auctor, Aeterne Rex altissime).

export const SOURCE = {
  kind: 'cc0',
  dataset: 'GregoBase (2019-10-24 dump, bacor/gregobasecorpus)',
  licence: 'CC0',
};

const ANCIENT = 'wikis/WIKI_OLD_MELODIES/03-ANCIENT-AND-WORLD.md (lane ANCIENT, branch wiki-ancient)';

export const TUNES = [
  {
    id: 'dies-irae',
    title: 'Dies irae (first strophe)',
    region: 'chant',
    kind: 'chant',
    key: 'D',
    mode: 'mode 1 (dorian)',
    meter: 'free',
    origin: 'Gregorian sequence, 13th-century text, mode 1 (final D)',
    tags: ['chant', 'ancient', 'slow', 'air'],
    abc: 'X:2\nT:Dies irae, first strophe\nM:none\nL:1/8\nK:C\nF E F D E C D D |\nF FG FE DC E F E D |\nA, CD D DC E F E D |]',
    source: { ...SOURCE, record: 'chant 3441, Vatican version', book: 'Graduale Romanum (Vatican, 1908)', year: 1908, where: 'p. 83* (Liber Usualis p. 1810 to find it)', scan: 'https://gregobase.selapa.net/chant.php?id=3441' },
    transcription: `converted from the CC0 gabc by lane ANCIENT; ${ANCIENT}`,
  },
  {
    id: 'veni-creator',
    title: 'Veni Creator Spiritus (first stanza)',
    region: 'chant',
    kind: 'hymn',
    key: 'G',
    mode: 'mode 8 (hypomixolydian)',
    meter: 'free',
    origin: 'Gregorian hymn, mode 8 (final G)',
    tags: ['chant', 'ancient', 'slow', 'air'],
    abc: 'X:3\nT:Veni Creator Spiritus\nM:none\nL:1/8\nK:C\nG A GF G AG c d c |\nc G A c dc d e d |\nc de cB AG cd G A c |\nBc A GF A ABA G F G |]',
    source: { ...SOURCE, record: 'chant 3431, Vatican version', book: 'Graduale Romanum (Vatican, 1908)', year: 1908, where: 'p. 121*', scan: 'https://gregobase.selapa.net/chant.php?id=3431' },
    transcription: `converted from the CC0 gabc by lane ANCIENT; ${ANCIENT}`,
  },
  {
    id: 'ave-maris-stella',
    title: 'Ave maris stella (Little Office tune)',
    region: 'chant',
    kind: 'hymn',
    key: 'D',
    mode: 'mode 1 (dorian)',
    meter: 'free',
    origin: 'Gregorian hymn, mode 1 (final D), the B flat',
    tags: ['chant', 'ancient', 'slow', 'air'],
    abc: 'X:4\nT:Ave maris stella\nM:none\nL:1/8\nK:C\nD A_B A G A G |\nG A G F G A |\nF E F GF E D |\nE F D CD D D |]',
    source: { ...SOURCE, record: 'chant 3285, Vatican version, Officium Parvum BMV', book: 'the Vatican edition of the chant (the 2019 dump joins no book page to this record)', where: 'GregoBase chant 3285', scan: 'https://gregobase.selapa.net/chant.php?id=3285' },
    transcription: `converted from the CC0 gabc by lane ANCIENT; ${ANCIENT}`,
  },
  {
    "id": "chant-gloria-laus",
    "title": "Gloria laus et honor (Palm Sunday hymn)",
    "region": "chant",
    "kind": "hymn",
    "key": "A",
    "mode": "mode 1 (dorian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 1 (dorian), final A; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Gloria laus et honor (Palm Sunday hymn)\nM:none\nL:1/8\nK:C\nA G GA GG F G GA F E D |\nG G E G GG F |\nFA A A AGF G GA FE DF |\nF FE D DC EF D D |\nA G A ABc cB AG |\nGA c cd c cB A G A A |\nA A G A Bc c cB AG |\nGA c cd cB A GA A |\nA G A ABc cB AG |\nGA c cd cB A G A A |\nA A G ABc cB AG |\nGA c cd c cB A GA A |\nA G A ABc cB AG |\nGA c cd cB A G A A |\nA A G A ABc cB AG |\nGA c cd cB A GA A |\nA G A ABc cB AG |\nGA c cd cB A G A A |\nA A G ABc cB AG |\nGA c cd cB A GA A |\nA A G A ABc cB AG |\nGA c cd c cB A G A A |\nA A G ABc cB AG |\nGA c cd cB A GA A |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 537, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 151", scan: "https://gregobase.selapa.net/chant.php?id=537" }
  },
  {
    "id": "chant-pange-lingua-gloriosi-proelium",
    "title": "Pange lingua gloriosi proelium (Good Friday hymn)",
    "region": "chant",
    "kind": "hymn",
    "key": "D",
    "mode": "mode 1 (dorian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 1 (dorian), final D; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Pange lingua gloriosi proelium (Good Friday hymn)\nM:none\nL:1/8\nK:C\nD E GA AG A c cB AG |\nB c de AG c BA A |\nA AcB G GE F DC DE EFE |\nD DA AG ED F ED D |\nA AcB G GE F DC DE EFE |\nD DA AG ED F ED D |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 1529, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 187", scan: "https://gregobase.selapa.net/chant.php?id=1529" }
  },
  {
    "id": "chant-vexilla-regis",
    "title": "Vexilla Regis prodeunt (Passiontide hymn)",
    "region": "chant",
    "kind": "hymn",
    "key": "D",
    "mode": "final D",
    "meter": "free",
    "origin": "Gregorian hymn, mode not given in the dump, final D; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Vexilla Regis prodeunt (Passiontide hymn)\nM:none\nL:1/8\nK:C\nF GA _B AGF G GAG F ED |\nG G A FD F EF D CD |\nD D F DC F FGA G GF |\nF FA_BAG A FD F EF D CD |]",
    "transcription": "typeset in gabc by a GregoBase transcriber (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 2992, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 191", scan: "https://gregobase.selapa.net/chant.php?id=2992" }
  },
  {
    "id": "chant-o-gloriosa-virginum",
    "title": "O gloriosa virginum (hymn)",
    "region": "chant",
    "kind": "hymn",
    "key": "A",
    "mode": "mode 2 (hypodorian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 2 (hypodorian), final A; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:O gloriosa virginum (hymn)\nM:none\nL:1/8\nK:C\nA AG ED G Ac cB A B |\nAd d B cB A BA G A |\nd d B d ded cB AB BAG |\ncB cd B cB A BA G A |]",
    "transcription": "typeset in gabc by a GregoBase transcriber (CC0) from the 1912 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 3291, Vatican version", book: "Antiphonale Romanum (Vatican, 1912)", year: 1912, where: "p. [83]", scan: "https://gregobase.selapa.net/chant.php?id=3291" }
  },
  {
    "id": "chant-sacris-solemniis",
    "title": "Sacris solemniis (Corpus Christi hymn)",
    "region": "chant",
    "kind": "hymn",
    "key": "E",
    "mode": "mode 4 (hypophrygian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 4 (hypophrygian), final E; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Sacris solemniis (Corpus Christi hymn)\nM:none\nL:1/8\nK:C\nDAB A AG ABc BAG A |\nA F G G F E |\nF G FGA F E D |\nF D C EF D D |\nA B cB G A G |\nBA B cB A G A |\nDA_B A G FED E FG F E |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 3475, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 124*", scan: "https://gregobase.selapa.net/chant.php?id=3475" }
  },
  {
    "id": "chant-jesu-nostra-redemptio",
    "title": "Jesu nostra redemptio (Ascension hymn)",
    "region": "chant",
    "kind": "hymn",
    "key": "E",
    "mode": "mode 4 (hypophrygian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 4 (hypophrygian), final E; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Jesu nostra redemptio (Ascension hymn)\nM:none\nL:1/8\nK:C\nF EFGA G FD F EFG F E |\nG Ac A GF G G F ED |\nCD D DC D FE DE E E |\nG GA G FD F EFG F E |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 3774, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 126*", scan: "https://gregobase.selapa.net/chant.php?id=3774" }
  },
  {
    "id": "chant-pange-lingua-corporis",
    "title": "Pange lingua gloriosi corporis (Corpus Christi hymn)",
    "region": "chant",
    "kind": "hymn",
    "key": "E",
    "mode": "mode 3 (phrygian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 3 (phrygian), final E; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Pange lingua gloriosi corporis (Corpus Christi hymn)\nM:none\nL:1/8\nK:C\nE E F ED G G Ac c |\ncd c c B A c BAG |\nG A c B A G A G |\nA B G G E A AD |\nE G G E G A A G |\nA B G AG FE D E |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 3855, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 124*", scan: "https://gregobase.selapa.net/chant.php?id=3855" }
  },
  {
    "id": "chant-verbum-supernum",
    "title": "Verbum supernum prodiens (Corpus Christi hymn)",
    "region": "chant",
    "kind": "hymn",
    "key": "G",
    "mode": "mode 8 (hypomixolydian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 8 (hypomixolydian), final G; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Verbum supernum prodiens (Corpus Christi hymn)\nM:none\nL:1/8\nK:C\nG GAcBA GF AG ABA G F G |\nG B c d cB AG A c |\nc A c G GA AG F G |\nF AG Ac cB AG E F G |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 3932, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 125*", scan: "https://gregobase.selapa.net/chant.php?id=3932" }
  },
  {
    "id": "chant-gaude-mater-ecclesia",
    "title": "Gaude Mater Ecclesia (Dominican hymn)",
    "region": "chant",
    "kind": "hymn",
    "key": "G",
    "mode": "mode 7 (mixolydian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 7 (mixolydian), final G; Dominican 1913 version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Gaude Mater Ecclesia (Dominican hymn)\nM:none\nL:1/8\nK:C\nG AGF G A G ABcB BA AG B ded c BA G AG F G B d d e d c B ABG G AGF G A G ABcB AG G |]",
    "transcription": "typeset in gabc by a GregoBase transcriber (CC0) from the 1913 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 4587, Dominican 1913 version", book: "Processionarium O.P. (Cormier) (Dominican, 1913)", year: 1913, where: "p. 97", scan: "https://gregobase.selapa.net/chant.php?id=4587" }
  },
  {
    "id": "chant-te-lucis-ante-terminum",
    "title": "Te lucis ante terminum (Compline hymn, Advent tone)",
    "region": "chant",
    "kind": "hymn",
    "key": "D",
    "mode": "mode 2 (hypodorian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 2 (hypodorian), final D; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Te lucis ante terminum (Compline hymn, Advent tone)\nM:none\nL:1/8\nK:C\nCD D DF C DF FE D E |\nG FE D E FE D C D |\nDG D DG F FE DE D C |\nC D E FE D ED C D |\nCD D DF C DF FE D E |\nG FE D E FE D C D |\nDG D DG F FE DE D C |\nC D E FE D ED C D |\nCD D DF C DF FE D E |\nG FE D E FE D C D |\nDG D DG F FE DE D C |\nC D E FE D ED C D |\nDED CD |]",
    "transcription": "typeset in gabc by a GregoBase transcriber (CC0) from the 1912 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 4659, Vatican version", book: "Antiphonale Romanum (Vatican, 1912)", year: 1912, where: "p. 187", scan: "https://gregobase.selapa.net/chant.php?id=4659" }
  },
  {
    "id": "chant-en-clara-vox",
    "title": "En clara vox redarguit (Advent hymn)",
    "region": "chant",
    "kind": "hymn",
    "key": "A",
    "mode": "mode 1 (dorian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 1 (dorian), final A; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:En clara vox redarguit (Advent hymn)\nM:none\nL:1/8\nK:C\nE C E G A B A A |\nG A B c BG A B A |\nA A B G EG F E D |\nE C E G A B A A |\nABA GA |]",
    "transcription": "typeset in gabc by a GregoBase transcriber (CC0) from the 1912 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 4665, Vatican version", book: "Antiphonale Romanum (Vatican, 1912)", year: 1912, where: "p. 189", scan: "https://gregobase.selapa.net/chant.php?id=4665" }
  },
  {
    "id": "chant-tu-natale-solum",
    "title": "Tu natale solum (hymn)",
    "region": "chant",
    "kind": "hymn",
    "key": "G",
    "mode": "mode 7 (mixolydian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 7 (mixolydian), final G; Roman version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Tu natale solum (hymn)\nM:none\nL:1/8\nK:C\nG B c de dc d |\nG AB c BAG A G |\nG B c de dc d |\nG AB c BAG A G |\ndc d de g f ede |\ng f e d dc BAB |\nBcd A GF A GA B cBA G |\nG B c de dc d |\nG AB c BAG A G |\nG B c de dc d |\nG AB c BAG A G |\ndc d de g f ede |\ng f e d dc BAB |\nBcd A GF A GA B cBA G |\nG B c de dc d |\nG AB c BAG A G |\nG B c de dc d |\nG AB c BAG A G |\ndc d de g f ede |\ng f e d dc BAB |\nBcd A GF A GA B cBA G |\nG B c de dc d |\nG AB c BAG A G |\nG B c de dc d |\nG AB c BAG A G |\ndc d de g f ede |\ng f e d dc BAB |\nBcd A GF A GA B cBA G |\nGAG FG |]",
    "transcription": "typeset in gabc by a GregoBase transcriber (CC0) from the 1912 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 7262, Roman version", book: "Antiphonale Romanum (Vatican, 1912)", year: 1912, where: "p. 527", scan: "https://gregobase.selapa.net/chant.php?id=7262" }
  },
  {
    "id": "chant-caeli-deus-sanctissime",
    "title": "Caeli Deus sanctissime (hymn)",
    "region": "chant",
    "kind": "hymn",
    "key": "D",
    "mode": "mode 1 (dorian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 1 (dorian), final D; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Caeli Deus sanctissime (hymn)\nM:none\nL:1/8\nK:C\nF F G A G G F E |\nG E F D C F G F |\nF F G A G G F E |\nG E F D C F D D |]",
    "transcription": "typeset in gabc by a GregoBase transcriber (CC0) from the 1912 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 7396, Vatican version", book: "Antiphonale Romanum (Vatican, 1912)", year: 1912, where: "p. 121", scan: "https://gregobase.selapa.net/chant.php?id=7396" }
  },
  {
    "id": "chant-aurora-jam-spargit-polum",
    "title": "Aurora jam spargit polum (hymn)",
    "region": "chant",
    "kind": "hymn",
    "key": "F",
    "mode": "mode 4 (hypophrygian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 4 (hypophrygian), final F; ? version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Aurora jam spargit polum (hymn)\nM:none\nL:1/8\nK:C\nE C D F EF G F E |\nE C D F EF G G G |\nG G A F G F E E |\nC D F EF G F E FGF |]",
    "transcription": "typeset in gabc by Ben Yanke (CC0) from the 1912 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 7548, ? version", book: "Antiphonale Romanum (Vatican, 1912)", year: 1912, where: "p. 165", scan: "https://gregobase.selapa.net/chant.php?id=7548" }
  },
  {
    "id": "chant-aeterne-rerum-conditor",
    "title": "Aeterne rerum Conditor (hymn of Ambrose, Cistercian tone)",
    "region": "chant",
    "kind": "hymn",
    "key": "D",
    "mode": "mode 2 (hypodorian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 2 (hypodorian), final D; Cistercian version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Aeterne rerum Conditor (hymn of Ambrose, Cistercian tone)\nM:none\nL:1/8\nK:C\nD D A, C C ED CD D |\nG G E F D ED CD D |\nG G E G A G E D |\nD E F E D ED CD D |]",
    "transcription": "typeset in gabc by Kloster Helfta (CC0) from the 1909 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 7877, Cistercian version", book: "Hymnarium Cisterciense (Westmalle, 1909)", year: 1909, where: "p. 1", scan: "https://gregobase.selapa.net/chant.php?id=7877" }
  },
  {
    "id": "chant-nocte-surgentes",
    "title": "Nocte surgentes (hymn, Cistercian tone)",
    "region": "chant",
    "kind": "hymn",
    "key": "G",
    "mode": "mode 8 (hypomixolydian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 8 (hypomixolydian), final G; Cistercian version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Nocte surgentes (hymn, Cistercian tone)\nM:none\nL:1/8\nK:C\nA F G GA GF |\nA A AcA B G G |\nc B d c Bc |\nA G A B AA G |\nGA c B GAG E |\nF G E F E D |\nA F FG GA G |]",
    "transcription": "typeset in gabc by Kloster Helfta (CC0) from the 1909 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 7878, Cistercian version", book: "Hymnarium Cisterciense (Westmalle, 1909)", year: 1909, where: "p. 2", scan: "https://gregobase.selapa.net/chant.php?id=7878" }
  },
  {
    "id": "chant-splendor-paternae-gloriae",
    "title": "Splendor paternae gloriae (hymn of Ambrose, Cistercian tone)",
    "region": "chant",
    "kind": "hymn",
    "key": "D",
    "mode": "mode 2 (hypodorian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 2 (hypodorian), final D; Cistercian version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Splendor paternae gloriae (hymn of Ambrose, Cistercian tone)\nM:none\nL:1/8\nK:C\nD D C D F F E D |\nD D F F C D F FGFE |\nD E F G E F E D |\nD D F FE DC DE D CD |]",
    "transcription": "typeset in gabc by Kloster Helfta (CC0) from the 1909 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 7879, Cistercian version", book: "Hymnarium Cisterciense (Westmalle, 1909)", year: 1909, where: "p. 3", scan: "https://gregobase.selapa.net/chant.php?id=7879" }
  },
  {
    "id": "chant-ecce-iam-noctis",
    "title": "Ecce iam noctis (hymn, Cistercian tone)",
    "region": "chant",
    "kind": "hymn",
    "key": "G",
    "mode": "mode 8 (hypomixolydian)",
    "meter": "free",
    "origin": "Gregorian hymn, mode 8 (hypomixolydian), final G; Cistercian version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Ecce iam noctis (hymn, Cistercian tone)\nM:none\nL:1/8\nK:C\nGAG E F G G |\nA G A B c G |\nc A c B A |\nA G E F G G |\nG E G FE DC |\nG G A B A G |\nABc A B A G |]",
    "transcription": "typeset in gabc by Kloster Helfta (CC0) from the 1909 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 7880, Cistercian version", book: "Hymnarium Cisterciense (Westmalle, 1909)", year: 1909, where: "p. 4", scan: "https://gregobase.selapa.net/chant.php?id=7880" }
  },
  {
    "id": "chant-veni-sancte-spiritus",
    "title": "Veni Sancte Spiritus (Pentecost sequence)",
    "region": "chant",
    "kind": "chant",
    "key": "D",
    "mode": "mode 1 (dorian)",
    "meter": "free",
    "origin": "Gregorian sequence, mode 1 (dorian), final D; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Veni Sancte Spiritus (Pentecost sequence)\nM:none\nL:1/8\nK:C\nC D E F ED C D |\nF G A _B AGF G A |\nC D F G FED C D |\nC D E F ED C D |\nF G A _B AGF G A |\nC D F G FED C D |\nA c d d cB c d |\nc A cB G FE D C |\nG F GA G FED C D |\nA c d d cB c d |\nc A cB G FE D C |\nG F GA G FED C D |\nd d cB c dc B A |\nF D C D F G F |\nGA _B A G FED C D |\nd d cB c dc B A |\nF D C D F G F |\nGA _B A G FED C D |\nA c BA B cB A G |\nA A FE F GF E D |\nE G A G c B A |\nA c BA B cB A G |\nA A FE F GF E D |\nE G A G c B A |\nd d G A c B A |\nA _B AG A F G F |\nE G A D F E D |\nd d G A c B A |\nA _B AG A F G F |\nE G A D F E D |\nDED CD |\nC F ED D |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 1402, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 249", scan: "https://gregobase.selapa.net/chant.php?id=1402" }
  },
  {
    "id": "chant-victimae-paschali-laudes",
    "title": "Victimae paschali laudes (Easter sequence)",
    "region": "chant",
    "kind": "chant",
    "key": "D",
    "mode": "mode 1 (dorian)",
    "meter": "free",
    "origin": "Gregorian sequence, mode 1 (dorian), final D; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Victimae paschali laudes (Easter sequence)\nM:none\nL:1/8\nK:C\nD C D F G F E D |\nA G E G F E D |\nA c d A G A A |\nA G A G F E D |\nF G D E D C E F E D |\nA c d A G A A |\nA G A G F E D |\nF G D E D C E F E D |\nA, C D F G ED |\nC F E D E C D |\nF A G A F G FE D |\nD G F G A G F G FE D |\nA, C D F G ED |\nC F E D E C D |\nF A G A F G FE D |\nD G F G A G F G FE D |\nA c d A A G A A |\nA c G F E D |\nC F E G A A |\nF G FE D |\nDED CD |\nC F ED D |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 1718, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 204", scan: "https://gregobase.selapa.net/chant.php?id=1718" }
  },
  {
    "id": "chant-ubi-caritas",
    "title": "Ubi caritas (antiphon)",
    "region": "chant",
    "kind": "chant",
    "key": "F",
    "mode": "mode 6 (hypolydian)",
    "meter": "free",
    "origin": "Gregorian antiphon, mode 6 (hypolydian), final F; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Ubi caritas (antiphon)\nM:none\nL:1/8\nK:C\nF F GA AG A _B AG AG |\nF F F G G |\nF F GA AG A _B AG AG |\nF F G G |\nF F GA AG A _B AG AG |\nF F G G |\nF G F GA A F GF DC G A G F |\nF G F GA A F GF DC G GAG FDF F |\nF F GA AG A _B AG AG |\nF F F G G |\nF F GA AG A _B AG AG |\nF F G G |\nF F GA AG A _B AG AG |\nF F G G |\nF G F GA A F GF DC G A G F |\nF G F GA A F GF DC G GAG FDF F |\nF F GA AG A _B AG AG |\nF F F G G |\nF F GA AG A _B AG AG |\nF F G G |\nF F GA AG A _B AG AG |\nF F G G |\nF G F GA A F GF DC G A G F |\nF G F GA A F GF DC G GAG FDF F |\nFGF EF |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 1696, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 175", scan: "https://gregobase.selapa.net/chant.php?id=1696" }
  },
  {
    "id": "chant-asperges-me",
    "title": "Asperges me (antiphon)",
    "region": "chant",
    "kind": "chant",
    "key": "G",
    "mode": "mode 7 (mixolydian)",
    "meter": "free",
    "origin": "Gregorian antiphon, mode 7 (mixolydian), final G; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Asperges me (antiphon)\nM:none\nL:1/8\nK:C\nGA cBA Bc d |\nefg gf ed |\ne dc Bc dcA B GAG G |\nGA cBA Bc d |\ndefed cB A c Bc dcA B GAG G |\nGcB cd d d df e ed de |\ndB cd d d d d d d def d c ccc AG |\nGcB cd d d d d d d d |\nd d df e e ed de |\ndB cd d d d d d d d |\nd df e ed de |\ndB cd d d d d def d c ccc AG |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 3466, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 1*", scan: "https://gregobase.selapa.net/chant.php?id=3466" }
  },
  {
    "id": "chant-in-paradisum",
    "title": "In paradisum (antiphon)",
    "region": "chant",
    "kind": "chant",
    "key": "G",
    "mode": "mode 7 (mixolydian)",
    "meter": "free",
    "origin": "Gregorian antiphon, mode 7 (mixolydian), final G; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:In paradisum (antiphon)\nM:none\nL:1/8\nK:C\nG B c d d |\nd e d c B cd d |\nA c c c cd c |\nBc d c B A G Ac cB |\nB c d d d |\nd d d e d ccd dA BA B G G |\nGc A AG F GA G |\nBc dcA c c B |\nB c de c A c BG A G F |\nF AG GABcBA G A AB G G G |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 3541, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 92*", scan: "https://gregobase.selapa.net/chant.php?id=3541" }
  },
  {
    "id": "chant-assumpta-est-maria",
    "title": "Assumpta est Maria (antiphon)",
    "region": "chant",
    "kind": "chant",
    "key": "A",
    "mode": "mode 7 (mixolydian)",
    "meter": "free",
    "origin": "Gregorian antiphon, mode 7 (mixolydian), final A; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Assumpta est Maria (antiphon)\nM:none\nL:1/8\nK:C\nG G G B c d e c dd B |\ncB GA c c B |\nBc de d cB A B A G G G |\nd d e d c BA |]",
    "transcription": "typeset in gabc by a GregoBase transcriber (CC0) from the 1912 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 3290, Vatican version", book: "Antiphonale Romanum (Vatican, 1912)", year: 1912, where: "p. 690", scan: "https://gregobase.selapa.net/chant.php?id=3290" }
  },
  {
    "id": "chant-nigra-sum",
    "title": "Nigra sum (antiphon)",
    "region": "chant",
    "kind": "chant",
    "key": "B",
    "mode": "mode 3 (phrygian)",
    "meter": "free",
    "origin": "Gregorian antiphon, mode 3 (phrygian), final B; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Nigra sum (antiphon)\nM:none\nL:1/8\nK:C\nG G B c A c B |\nG A A A B A G |\nB B A A c B G A |\nG A F G G E |\nF D EF GA GF E E |\nG GF E E |\nc c c A c B |]",
    "transcription": "typeset in gabc by a GregoBase transcriber (CC0) from the 1912 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 3282, Vatican version", book: "Antiphonale Romanum (Vatican, 1912)", year: 1912, where: "p. [78]", scan: "https://gregobase.selapa.net/chant.php?id=3282" }
  },
  {
    "id": "chant-pulchra-es-et-decora",
    "title": "Pulchra es et decora (antiphon)",
    "region": "chant",
    "kind": "chant",
    "key": "G",
    "mode": "mode 1 (dorian)",
    "meter": "free",
    "origin": "Gregorian antiphon, mode 1 (dorian), final G; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Pulchra es et decora (antiphon)\nM:none\nL:1/8\nK:C\nF F A _B G A FA |\nA G A F G FE DEF |\nCD F FG G |\nF G A GF G FE DG E FE D D |\nA A G F G GAG |]",
    "transcription": "typeset in gabc by a GregoBase transcriber (CC0) from the 1912 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 3297, Vatican version", book: "Antiphonale Romanum (Vatican, 1912)", year: 1912, where: "p. 691", scan: "https://gregobase.selapa.net/chant.php?id=3297" }
  },
  {
    "id": "chant-jam-hiems-transiit",
    "title": "Jam hiems transiit (antiphon)",
    "region": "chant",
    "kind": "chant",
    "key": "G",
    "mode": "mode 8 (hypomixolydian)",
    "meter": "free",
    "origin": "Gregorian antiphon, mode 8 (hypomixolydian), final G; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Jam hiems transiit (antiphon)\nM:none\nL:1/8\nK:C\nGc A GF GA A G |\nB c d c A c c B B |\ncd cB A B c AGF F |\nABcAB G G |\nAB A G G |\nc c B c A G |]",
    "transcription": "typeset in gabc by a GregoBase transcriber (CC0) from the 1912 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 3283, Vatican version", book: "Antiphonale Romanum (Vatican, 1912)", year: 1912, where: "p. [78]", scan: "https://gregobase.selapa.net/chant.php?id=3283" }
  },
  {
    "id": "chant-mandatum-novum",
    "title": "Mandatum novum (antiphon)",
    "region": "chant",
    "kind": "chant",
    "key": "A",
    "mode": "mode 3 (phrygian)",
    "meter": "free",
    "origin": "Gregorian antiphon, mode 3 (phrygian), final A; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Mandatum novum (antiphon)\nM:none\nL:1/8\nK:C\nG G A c cA c c B |\nA G A A A B A G |\nB c B A G AB G GF E E E |\nG Ac c c c c d c c BA ccc |\nBG Ac c c c ccB AG A B GA |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 1475, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 171", scan: "https://gregobase.selapa.net/chant.php?id=1475" }
  },
  {
    "id": "chant-ecce-lignum-crucis",
    "title": "Ecce lignum Crucis (antiphon)",
    "region": "chant",
    "kind": "chant",
    "key": "F",
    "mode": "mode 6 (hypolydian)",
    "meter": "free",
    "origin": "Gregorian antiphon, mode 6 (hypolydian), final F; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Ecce lignum Crucis (antiphon)\nM:none\nL:1/8\nK:C\nF FF DEFE DC FGAGA GF |\nFGF F GA_B A GAGF GGF |\nF GAGFGA_BAG AG |\nAGF ABc GFFDED |\nFFE G GAGFG GF |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 1435, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 182", scan: "https://gregobase.selapa.net/chant.php?id=1435" }
  },
  {
    "id": "chant-hosanna-filio-david",
    "title": "Hosanna filio David (antiphon)",
    "region": "chant",
    "kind": "chant",
    "key": "G",
    "mode": "mode 7 (mixolydian)",
    "meter": "free",
    "origin": "Gregorian antiphon, mode 7 (mixolydian), final G; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Hosanna filio David (antiphon)\nM:none\nL:1/8\nK:C\nG Gd d d c B c ded |\nB c ded cdc |\nc AG GF Ac cA B AB G G G |\nc ccc AcdcBc cB |\nG Gd decA B AB G G |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 1627, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 143", scan: "https://gregobase.selapa.net/chant.php?id=1627" }
  },
  {
    "id": "chant-vidi-aquam",
    "title": "Vidi aquam (antiphon)",
    "region": "chant",
    "kind": "chant",
    "key": "G",
    "mode": "mode 8 (hypomixolydian)",
    "meter": "free",
    "origin": "Gregorian antiphon, mode 8 (hypomixolydian), final G; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Vidi aquam (antiphon)\nM:none\nL:1/8\nK:C\nGA AFAG GAG G |\nG GAcB BA cc AB GA GccdA AGABA |\nGA Gccd A AG AcGA GF |\nG GAFG GAcAB AG |\nGA GABc c c c BA Bc B |\ncccB Ad cB cdcBcBAGAG |\nGcccd c cded cBA A |\nAG AcGA GF |\nGA A ABA A |\nAGF GAcABc GAG G |\nG AG Gc c c c c c cB cd d cd c |\ncA Ac c c c c c c c c ccB GA cB A G |\nG AG Gc c c c c c c |\nc c cB cd d cd c |\ncA Ac c c c c c c c |\ncB cd d cd c |\ncA Ac c c c c ccB GA cB A G |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 3744, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 2*", scan: "https://gregobase.selapa.net/chant.php?id=3744" }
  },
  {
    "id": "chant-puer-natus-est",
    "title": "Puer natus est (Christmas introit)",
    "region": "chant",
    "kind": "chant",
    "key": "G",
    "mode": "mode 7 (mixolydian)",
    "meter": "free",
    "origin": "Gregorian introit, mode 7 (mixolydian), final G; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Puer natus est (Christmas introit)\nM:none\nL:1/8\nK:C\nGd d ded c ccc dced d |\nGd ded cB A ccd c c cdcc GAG |\nG A c Bdef dc c |\nc c dced cB ccc cAcBcBA BA |\ncB c ced c ccc c ccc cdBcBA BA |\nce d Gc c cccA A AcABc GAG G |\nGcB cd d d d d df e e ed de |\ndB cd d d def d c ccc AG |\nGcB cd d d d |\nd def d c ccc AG |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 1403, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 30", scan: "https://gregobase.selapa.net/chant.php?id=1403" }
  },
  {
    "id": "chant-rorate-caeli",
    "title": "Rorate caeli (Advent introit)",
    "region": "chant",
    "kind": "chant",
    "key": "F",
    "mode": "mode 1 (dorian)",
    "meter": "free",
    "origin": "Gregorian introit, mode 1 (dorian), final F; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Rorate caeli (Advent introit)\nM:none\nL:1/8\nK:C\nCD DA_B A |\nAccA AG ABc cBcdcd dc |\nF A_BA G ccA A GFAGFGF F |\nF G A ABc G FGFD D |\nDFE FG G FGFD DEF CED DED D |\nF GA A A A Ac A A AG GA |\nGF GA A A A A A A A |\nA A A AcA G F FFF D |\nF GA A A A |\nA AcA G F FFF DCDF |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 1407, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 19", scan: "https://gregobase.selapa.net/chant.php?id=1407" }
  },
  {
    "id": "chant-resurrexi",
    "title": "Resurrexi (Easter introit)",
    "region": "chant",
    "kind": "chant",
    "key": "F",
    "mode": "mode 4 (hypophrygian)",
    "meter": "free",
    "origin": "Gregorian introit, mode 4 (hypophrygian), final F; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Resurrexi (Easter introit)\nM:none\nL:1/8\nK:C\nD DFD F FFFDED |\nFE FG G G F EFGFG |\nGFFF DFE EGFF FE |\nFGF FF FGA GAG GFFF DEFGF F |\nFFF DEF FGFE F |\nFFF DFE FGFF DFFDF |\nC CDFEF F F FFFG DEDCD DC |\nEFG GAG F FFF GFAG G |\nGF EFG GF EFGFG |\nGFFF DFE EGFF FE |\nAG GA A A A A A AG GB B AB A A |\nAG GA A A A A A A A A A |\nA A A A A GF GA G E |\nAG GA A A A |\nA A GF GA G EGFF |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 1703, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 202", scan: "https://gregobase.selapa.net/chant.php?id=1703" }
  },
  {
    "id": "chant-requiem-aeternam",
    "title": "Requiem aeternam (introit)",
    "region": "chant",
    "kind": "chant",
    "key": "F",
    "mode": "mode 6 (hypolydian)",
    "meter": "free",
    "origin": "Gregorian introit, mode 6 (hypolydian), final F; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Requiem aeternam (introit)\nM:none\nL:1/8\nK:C\nFFG F F FGA AGGFG GF |\nFGA AG A AcAGA_BAG F FGAGFG GF |\nAG AGF A GA GF F |\nAG A AcAGA_BAG FGAGFG GF |\nFG GF GA A A A A A G A |\nF G A A A A A A A G _B G A |\nF GA A A A A A A A A |\nA A A A F GA G F F |\nFFG F F |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 3882, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 81*", scan: "https://gregobase.selapa.net/chant.php?id=3882" }
  },
  {
    "id": "chant-lux-aeterna",
    "title": "Lux aeterna (communion)",
    "region": "chant",
    "kind": "chant",
    "key": "G",
    "mode": "mode 8 (hypomixolydian)",
    "meter": "free",
    "origin": "Gregorian communion, mode 8 (hypomixolydian), final G; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Lux aeterna (communion)\nM:none\nL:1/8\nK:C\nA GF GA G |\nA c B c A G FG G |\nA c B c A B c A GAG |\nE F GA A G |\nG A c c c c c c c d d c c |\nA c c c c c c B c A G |\nA c B c A B c A GAG |\nE F GA A G |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 3879, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 88*", scan: "https://gregobase.selapa.net/chant.php?id=3879" }
  },
  {
    "id": "chant-viderunt-omnes-communion",
    "title": "Viderunt omnes (Christmas communion)",
    "region": "chant",
    "kind": "chant",
    "key": "D",
    "mode": "mode 1 (dorian)",
    "meter": "free",
    "origin": "Gregorian communion, mode 1 (dorian), final D; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Viderunt omnes (Christmas communion)\nM:none\nL:1/8\nK:C\nFG GFF DE CD D |\nDFG GA AccG GFAGE |\nF GAG AFAcAGEF F |\nFDFECFAG GAFEF DED D |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 1735, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 33", scan: "https://gregobase.selapa.net/chant.php?id=1735" }
  },
  {
    "id": "chant-alleluia-pascha-nostrum",
    "title": "Alleluia, Pascha nostrum (Easter alleluia)",
    "region": "chant",
    "kind": "chant",
    "key": "G",
    "mode": "mode 7 (mixolydian)",
    "meter": "free",
    "origin": "Gregorian alleluia, mode 7 (mixolydian), final G; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Alleluia, Pascha nostrum (Easter alleluia)\nM:none\nL:1/8\nK:C\nG G GAcAdBd dd |\nBdedededcdcAAG |\ndedededBcdcdcAAG |\ndGAGAFAcABAAG |\nc B dede dedeBcdedeBcdccB |\nc d dgagfgfefffdfagfgfefffdedcccABcdefdcdcAAGBcdBddBd BdBAGBAGAG G |\nGAcAdBd ddG |\ndedcdcAAG |\ndGAGAFAcABAAG |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 1612, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 203", scan: "https://gregobase.selapa.net/chant.php?id=1612" }
  },
  {
    "id": "chant-pascha-nostrum-communion",
    "title": "Pascha nostrum (Easter communion)",
    "region": "chant",
    "kind": "chant",
    "key": "F",
    "mode": "mode 6 (hypolydian)",
    "meter": "free",
    "origin": "Gregorian communion, mode 6 (hypolydian), final F; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Pascha nostrum (Easter communion)\nM:none\nL:1/8\nK:C\nF FAGA F EDEFD |\nFE F GA GFEFGFG GF F FEFDF |\nF F FAGF F |\nD FFFDCDFFAGAF F F FEF FDEC C |\nF GAGA AGA GFG FD FE F G F E GA GA FGF F |\nF FDFEFD DEF C |\nDC FGAGAGF GA A |\nFG G_BAG AGGFG GF |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 1677, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 205", scan: "https://gregobase.selapa.net/chant.php?id=1677" }
  },
  {
    "id": "chant-terra-tremuit",
    "title": "Terra tremuit (Easter offertory)",
    "region": "chant",
    "kind": "chant",
    "key": "E",
    "mode": "mode 4 (hypophrygian)",
    "meter": "free",
    "origin": "Gregorian offertory, mode 4 (hypophrygian), final E; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Terra tremuit (Easter offertory)\nM:none\nL:1/8\nK:C\nDFE FFFDF EFG GFA A |\nAccAG FGAG GFAG DGFEFGFD |\nDFFFD EF GA GF FAcccA |\nDA A AccA G GBAGA EFAGEFD D |\nDFFFFEFA_BAGFFE GAGFGEFDDFAGDFAGFGEFDAGFG E EGFGFFE |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 1599, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 205", scan: "https://gregobase.selapa.net/chant.php?id=1599" }
  },
  {
    "id": "chant-christus-factus-est",
    "title": "Christus factus est (gradual)",
    "region": "chant",
    "kind": "chant",
    "key": "D",
    "mode": "mode 5 (lydian)",
    "meter": "free",
    "origin": "Gregorian gradual, mode 5 (lydian), final D; Vatican version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Christus factus est (gradual)\nM:none\nL:1/8\nK:C\nFFG F |\nFG F F F GAFEDGEFG F |\nF AFGAccdcd cBc AG |\nAccA F F_BAGA FGF F |\nFAA_B G Gcc cABcBGABAG FFF FC |\nFGAGFEGAFAGAGGF C D D D FE EA A |\nA A A A A BAAEABABAAE |\nABdedBcAF |\nAGBcAcBAcBAAGF |\nF FAB B B BAcdBAAF |\nAFAAA AFGABABcAABBA |\nD D D D DFED EF FAGFAAA AAF |\n_GFGEDFGEDFEAAAAFFDFEFEED |]",
    "transcription": "typeset in gabc by Andrew Hinkley (CC0) from the 1908 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 1649, Vatican version", book: "Graduale Romanum (Vatican, 1908)", year: 1908, where: "p. 169", scan: "https://gregobase.selapa.net/chant.php?id=1649" }
  },
  {
    "id": "chant-laetabundus",
    "title": "Laetabundus (Christmas sequence)",
    "region": "chant",
    "kind": "chant",
    "key": "F",
    "mode": "final F",
    "meter": "free",
    "origin": "Gregorian chant, mode not given in the dump, final F; Solesmes version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Laetabundus (Christmas sequence)\nM:none\nL:1/8\nK:C\nF GF GA F |\nB d c B d B c c |\nF GF GA F |\nF GF GA F |\nB d c B d B c c |\nF GF GA F |\nF FG A AG B BAG A |\nA c c AG B BAG A |\nF GF GA F |\nF FG A AG B BAG A |\nA c c AG B BAG A |\nF GF GA F |\nF FE DC CD F GF F |\nF FG A AG B BAG A |\nF GF GA F |\nF FE DC CD F GF F |\nF FG A AG B BAG A |\nF GF GA F |\nc c d B c BAG A |\nc A B AG FGA A A |\nB GFE G F |\nc c d B c BAG A |\nc A B AG FGA A A |\nB GFE G F |\nc c e f dc B c |\nf e d c c BAG A |\nc A B AG FGA A A |\nB GFE G F |\nc c e f dc B c |\nf e d c c BAG A |\nc A B AG FGA A A |\nB GFE G F |\nD F G E G F |\nD F G E G F |\nA c B AG F |\nG E G F |\nD F G E G F |\nD F G E G F |\nA c B AG F |\nG E G E |\nF GF GA F |]",
    "transcription": "typeset in gabc by Christopher Tatum (CC0) from the 1902 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 7597, Solesmes version", book: "Cantus varii romano-seraphici (Solesmes, 1902)", year: 1902, where: "p. 36", scan: "https://gregobase.selapa.net/chant.php?id=7597" }
  },
  {
    "id": "chant-jesu-dulcis-memoria",
    "title": "Jesu dulcis memoria (hymn)",
    "region": "chant",
    "kind": "chant",
    "key": "E",
    "mode": "final E",
    "meter": "free",
    "origin": "Gregorian chant, mode not given in the dump, final E; Solesmes version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Jesu dulcis memoria (hymn)\nM:none\nL:1/8\nK:C\nE GA A AG A c B A |\nB d c BA B GA B A |\nE GA A AG EDE F E D |\nA D E G FE D E E |]",
    "transcription": "typeset in gabc by Christopher Tatum (CC0) from the 1902 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 7594, Solesmes version", book: "Cantus varii romano-seraphici (Solesmes, 1902)", year: 1902, where: "p. 38", scan: "https://gregobase.selapa.net/chant.php?id=7594" }
  },
  {
    "id": "chant-tota-pulchra-es",
    "title": "Tota pulchra es, Maria (antiphon)",
    "region": "chant",
    "kind": "chant",
    "key": "D",
    "mode": "mode 1 (dorian)",
    "meter": "free",
    "origin": "Gregorian chant, mode 1 (dorian), final D; Solesmes version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Tota pulchra es, Maria (antiphon)\nM:none\nL:1/8\nK:C\nD D F F G |\nA B A |\nA A F A c |\nd B A |\nd d c d A c B A G |\nd d c d |\nA B A G F G F E D |\nA A G A |\nA |\nF G A Bc d c d |\nd |\nc B A G DF G A |\nD |\nD D F G E D D F G A B A |\nd |\nc d B A F G E D |\nd cB cd A |\nA GF GA D |\nd d c d B A A |\nA A F G E D D |\nd d cB cd A |\nA G F G D FE D |\nF G A B |\nG A DFE D |]",
    "transcription": "typeset in gabc by Christopher Tatum (CC0) from the 1902 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 7556, Solesmes version", book: "Cantus varii romano-seraphici (Solesmes, 1902)", year: 1902, where: "p. 3", scan: "https://gregobase.selapa.net/chant.php?id=7556" }
  },
  {
    "id": "chant-gaudete-vos-fideles",
    "title": "Gaudete vos fideles (sequence)",
    "region": "chant",
    "kind": "chant",
    "key": "F",
    "mode": "final F",
    "meter": "free",
    "origin": "Gregorian chant, mode not given in the dump, final F; Solesmes version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Gaudete vos fideles (sequence)\nM:none\nL:1/8\nK:C\nA c AF AG AGFE G F |\nDD F GA BA GFE G F |\nA A c AF AG AGFE G F |\nDD F GA A BA GFE G F |\nc d c cAB G F |\nc AGA cBc AGA BA A |\nB GFE G F |\nc d c cAB G F |\nc AGA cBc AGA BA A |\nB GFE G F |\nD F G F A A G B A |\nA cB AGA BA GFE G F |\nD F G F A A G B A |\nA cB AGA BA GFE G F |\nF D C D F G F |\nA A G BA GFE G F |\nF D C D F G F |\nA A G BA GFE G F |\nF F G A B AGFGA F |\nB B c BAB AGFG F |\nF C FE DC F G ABGF D E FGEDC F |\nF F G A B AGFGA F |\nB B c B AB AGFG F |\nF C FE DC F G ABGF D E FGEDC F |\nFD E D C F G AccA F |\nc c F GA B AGFE G F |\nFD E D C F G AccA F |\nc c F GA B AGFE G F |\nFDCDFGABGFFAccBAGFFDGAGG F |]",
    "transcription": "typeset in gabc by Christopher Tatum (CC0) from the 1902 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 7599, Solesmes version", book: "Cantus varii romano-seraphici (Solesmes, 1902)", year: 1902, where: "p. 42", scan: "https://gregobase.selapa.net/chant.php?id=7599" }
  },
  {
    "id": "chant-adoro-te-devote",
    "title": "Adoro te devote (hymn)",
    "region": "chant",
    "kind": "chant",
    "key": "F",
    "mode": "final F",
    "meter": "free",
    "origin": "Gregorian chant, mode not given in the dump, final F; Solesmes version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Adoro te devote (hymn)\nM:none\nL:1/8\nK:C\nc c _B A A =B A c c d c c |\nc B A A c A G F A G F |\nc A B c d c B A c B A |\nc A B c d c B A GAG F F |\nf e d c |\nc B A c B A |\nc c A B c d c c |\nA B A G F F |\nc c B A A B A c c d c |\nc B A A c A G F A G F |\nc A B c d c B A c B A |\nc A B c d c B A GAG F F |\nc c B A A B A c c d c |\nc B A A c A G F A G F |\nc A B c d c B A c B A |\nc A B c d c B A GAG F F |\nc c B A A B A c c d c |\nc B A A c A G F A G F |\nc A B c d c B A c B A |\nc A B c d c B A GAG F F |\nc c B A A B A c c d c |\nc B A A c A G F A G F |\nc A B c d c B A c B A |\nc A B c d c B A GAG F F |\nc c B A A B A c c d c |\nc B A A c A G F A G F |\nc A B c d c B A c B A |\nc A B c d c B A GAG F F |\nc c B A A B A c c d c |\nc B A A c A G F A G F |\nc A B c d c B A c B A |\nc A B c d c B A GAG F F |\nFGF EF |]",
    "transcription": "typeset in gabc by Christopher Tatum (CC0) from the 1902 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 7655, Solesmes version", book: "Cantus varii romano-seraphici (Solesmes, 1902)", year: 1902, where: "p. 97", scan: "https://gregobase.selapa.net/chant.php?id=7655" }
  },
  {
    "id": "chant-tantum-ergo",
    "title": "Tantum ergo (hymn)",
    "region": "chant",
    "kind": "hymn",
    "key": "C",
    "mode": "final C",
    "meter": "free",
    "origin": "Gregorian hymn, mode not given in the dump, final C; Solesmes version",
    "tags": [
      "chant",
      "ancient",
      "slow",
      "air"
    ],
    "abc": "X:1\nT:Tantum ergo (hymn)\nM:none\nL:1/8\nK:C\nc dede f ed c cB d c |\ne c de g fe f g |\ne g f ed c dc B c |\ng a gf ed cdc d e |\ng f ed c A c BA G |\nc de fed c d B c |\nc dede f ed c cB d c |\ne c de g fe f g |\ne g f ed c dc B c |\ng a gf ed cdc d e |\ng f ed c A c BA G |\nc de fed c d B c |\ncdc Bc |]",
    "transcription": "typeset in gabc by a GregoBase transcriber (CC0) from the 1902 book; converted to ABC by runs/melodies200/tools/gregobase.py (lane MELODIES200): the clef line as c or F, every note one unit, neume shapes dropped",
    "source": { ...SOURCE, record: "chant 8112, Solesmes version", book: "Cantus varii romano-seraphici (Solesmes, 1902)", year: 1902, where: "p. 102", scan: "https://gregobase.selapa.net/chant.php?id=8112" }
  },
];

export default TUNES;
