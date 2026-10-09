// settle-hear · dj-trained-play - THE TRAINED GROOVE, HEARD: one bar of a trained set's drums (dj-trained.js) through a
// drum machine kit, with the set's swing and played feel. Used by the house set (mix-layers.js) and by the settle-site's
// #/gridlearn page, so the hero and the page play a settled bar the same way.
//
// <claudes_code_comments>
// ** Function List **
// ROLE_SEED                   - a seed per drum role for the played feel's offsets
// trainedJitter(bar, role, step, spread) - a seeded offset in steps for a played feel, about N(0, spread), bounded
// stepTime(i, swing, jitter, step) - a hit's time in the bar: step i, odd sixteenths late by swing, plus the jitter
// hitFor(kit, role, i, hats, clap) - the kit voice for one hit: the kick; the clap or the snare; a closed, open or
//                               ride hat by its settled voice letter; the rim, the cowbell on a beat's last sixteenth
// playTrainedDrums(ctx, out, t0, beatDur, groove, opts) - every settled hit of one bar, and the crash where the
//                               crash event fired; returns the number of hits scheduled
//
// ** Technical Review **
// - groove is dj-trained-plan.js barOf(set, b): steps per role as 16 levels 0..1, the hat voice letters, the events.
//   opts: { kit (a DRUM_KITS entry), feel ({ swing, played, spread }), clap (the set's snare-role choice), energy
//   (0..1, scales every level by 0.5 + 0.5 energy, the drum machine's own scale), bar (for the seeded feel) }.
// - Swing: odd sixteenths come late by feel.swing steps (clamped to 0.4). A PLAYED set adds a seeded offset per hit
//   with the spread the family's played transcriptions showed (about 0.01 to 0.12 of a step), the same on every play;
//   perc takes the hats' spread. No hit is placed before the bar's start.
// - The crash: the kit's open hat at full level and its ride at 0.8, on the bar's first sixteenth.
// </claudes_code_comments>

export const ROLE_SEED = { kick: 1, snare: 2, hats: 3, perc: 4 };

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function trainedJitter(bar, role, step, spread) {
  if (!(spread > 0)) return 0;
  const rnd = mulberry(100003 * (bar + 1) + 101 * (ROLE_SEED[role] ?? 5) + step);
  const g = rnd() + rnd() + rnd() - 1.5; // about N(0, 0.5), bounded
  return Math.max(-0.45, Math.min(0.45, 2 * g * spread));
}

export const stepTime = (i, swing, jitter, step) => (i + (i % 2 ? swing : 0) + jitter) * step;

export function hitFor(kit, role, i, hats, clap) {
  if (role === 'kick') return kit.kick;
  if (role === 'snare') return clap ? kit.clap ?? kit.snare : kit.snare ?? kit.clap;
  if (role === 'hats') return { o: kit.openHat, r: kit.ride }[hats?.[i]] ?? kit.closedHat;
  if (role === 'perc') return i % 4 === 3 ? kit.cowbell ?? kit.rim : kit.rim ?? kit.cowbell;
  return null;
}

export function playTrainedDrums(ctx, out, t0, beatDur, groove, { kit, feel = {}, clap = false, energy = 1, bar = 0 } = {}) {
  if (!groove || !kit) return 0;
  const step = beatDur / 4;
  const swing = Math.max(0, Math.min(0.4, Number(feel.swing) || 0));
  const spread = feel.played ? feel.spread ?? {} : {};
  const scale = 0.5 + 0.5 * Math.min(1, Math.max(0, Number(energy) || 0));
  let n = 0;
  for (const role of ['kick', 'snare', 'hats', 'perc']) {
    const list = groove.steps?.[role];
    if (!list) continue;
    for (let i = 0; i < 16; i++) {
      if (!(list[i] > 0)) continue;
      const hit = hitFor(kit, role, i, groove.hats, clap);
      if (typeof hit !== 'function') continue;
      const j = trainedJitter(bar, role, i, spread[role === 'perc' ? 'hats' : role] ?? 0);
      hit(ctx, out, t0 + Math.max(0, stepTime(i, swing, j, step)), { level: list[i] * scale });
      n += 1;
    }
  }
  if (groove.crash && typeof kit.openHat === 'function') {
    kit.openHat(ctx, out, t0, { level: scale });
    if (typeof kit.ride === 'function') kit.ride(ctx, out, t0, { level: 0.8 * scale });
  }
  return n;
}
