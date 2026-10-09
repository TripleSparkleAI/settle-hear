// settle-hear · weather - THE WEATHER PROFILES (lane SOUNDSHAKE, navigator 2026-10-04: "the drone, mainly the main drone,
// and the deep things adjust the visual ... the DJ can set some things for this on his whim"). How the low end of THE
// DJ's sound should move a settling picture, as plain data THE DJ deals once a phrase.
//
// <claudes_code_comments>
// ** Function List **
// WEATHER_PARTS          - the four knobs a profile moves: heat (the temperature), lean, pull, rate (sweeps a second)
// WEATHERS / WEATHER_KEYS - the six profiles: BREATH, DEEP SWELL, TREMOR, UNDERTOW, COLD FRONT, SQUALL
// HELD_WEATHER           - the profile while THE DJ is held (the opening blend, the pure flute): BREATH
// weatherOf(key)         - one profile by key (BREATH for an unknown key)
// weatherCoeffs(key, hard) - the profile's coefficients as { heat: { breath, tremble }, ... }; hard (an overdone
//                          phrase) plays it 1.5 times as hard. Every coefficient is finite and small
//
// ** Technical Review **
// - A PROFILE SAYS HOW THE DRONE MOVES THE PICTURE, NEVER WHAT IT LOOKS LIKE. Each of the four knobs is a fraction of
//   the picture's own value: heat 0.10 means "at a full low end, 10% hotter". Two parts feed each knob: BREATH, the slow
//   level of the low band (the drone swelling over seconds), and TREMBLE, its quick wobble about that level (the bass
//   notes, the kick). The page that joins the sound to a picture (the site's src/soundShake.js) reads the two, scales
//   them by its mode and clamps every knob to a safe range; settle-hear only names the intent.
// - THE DJ DEALS THEM (dj-fx.js createDjFx): one profile a phrase, by THE DECK RULE (createBag over WEATHER_KEYS:
//   every profile once before any repeats, never the same one across a seam), published on djLive as fx.weather.
//   An overdone phrase plays its weather hard (x 1.5, still clamped by the page). A held DJ breathes.
// - Plain data and pure functions: settle-hear imports nothing from settle-see, and nothing here touches audio.
// </claudes_code_comments>

export const WEATHER_PARTS = Object.freeze(['heat', 'lean', 'pull', 'rate']);

const P = (breath, tremble = 0) => Object.freeze({ breath, tremble });

export const WEATHERS = Object.freeze([
  { key: 'breath', label: 'BREATH', line: 'the drone breathes the heat a little up and down', heat: P(0.1, 0.04), lean: P(-0.03), pull: P(0), rate: P(0.08) },
  { key: 'swell', label: 'DEEP SWELL', line: 'the bass gathers the lights: the pull rises with it', heat: P(0.04, 0.02), lean: P(0), pull: P(0.18, 0.04), rate: P(0.12) },
  { key: 'tremor', label: 'TREMOR', line: 'every pulse of the low end shivers the field', heat: P(0.03, 0.12), lean: P(0, -0.04), pull: P(0), rate: P(0.05, 0.2) },
  { key: 'undertow', label: 'UNDERTOW', line: 'the drone loosens the picture: the lean slackens', heat: P(0.06, 0.02), lean: P(-0.1, -0.02), pull: P(0.05), rate: P(0) },
  { key: 'cold-front', label: 'COLD FRONT', line: 'a loud low end cools and sharpens the field', heat: P(-0.1, 0.02), lean: P(0.05), pull: P(0.08), rate: P(-0.1) },
  { key: 'squall', label: 'SQUALL', line: 'quick and restless: the sweeps hurry with the bass', heat: P(0.06, 0.06), lean: P(-0.02), pull: P(-0.06), rate: P(0.3, 0.15) },
].map(Object.freeze));

export const WEATHER_KEYS = Object.freeze(WEATHERS.map((w) => w.key));
export const HELD_WEATHER = 'breath';
const BY_KEY = new Map(WEATHERS.map((w) => [w.key, w]));
export const weatherOf = (key) => BY_KEY.get(key) ?? WEATHERS[0];

export const HARD = 1.5;

export function weatherCoeffs(key, hard = false) {
  const w = weatherOf(key);
  const k = hard ? HARD : 1;
  const out = {};
  for (const p of WEATHER_PARTS) out[p] = { breath: w[p].breath * k, tremble: w[p].tremble * k };
  return out;
}
