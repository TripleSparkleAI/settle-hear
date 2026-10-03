// Fixture tunes for the composer tests: two dance tunes in the shape of a reel (two 8-bar halves of four 2-bar
// phrases) and one free air. They were written for these tests and are not collected tunes; they claim no book.
export const FIX_REEL_A = {
  id: 'fixture-reel-a', title: 'Fixture Reel A', tags: ['reel', 'highlands'],
  abc: 'X:1\nT:Fixture Reel A\nM:4/4\nL:1/8\nK:D\n|:A|d2 fd AdFA|dfaf gefd|cBAB cdec|dcBA GFED|\nd2 fd AdFA|dfaf gefd|cBAB cAGE|FDD2 D3:|\n|:g|fdfa bafd|gfge c2ec|fdfa bafg|afge d3e|\nfdfa bafd|gfge cdeg|faeg fdec|dBAF D3:|',
};
export const FIX_REEL_B = {
  id: 'fixture-reel-b', title: 'Fixture Reel B', tags: ['reel', 'highlands'],
  abc: 'X:2\nT:Fixture Reel B\nM:4/4\nL:1/8\nK:G\nGABG dBGB|cBAG FAdc|BGdG BGdG|ABcA BGGF|\nGABG dBGB|cBAG FAdc|BdgB cAFA|AGFA G4|\ngfgd edBd|gfga bgab|gfgd edBG|ABcA BGGB|\ngfgd edBd|gfga b2ag|fgaf gedB|AGFA G4|]',
};
export const FIX_AIR = {
  id: 'fixture-air', title: 'Fixture Air', tags: ['air', 'slow'],
  abc: 'X:3\nT:Fixture Air\nM:none\nL:1/8\nK:Ador\nA2 c d e2 d c |\nB G A B c2 B A |\nE G A B c B A G |\nA c B G E2 D E A2 |]',
};
