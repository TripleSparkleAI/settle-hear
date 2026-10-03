// settle-hear · bases/base-format - THE BASE FORMAT: the shape of one base (a house or ambient rhythm bed in our own
// JSON), the fixed part names, the families, the validator every base passes, and the compatibility rule the DJ
// asks before it lays one base's part beside another's. Pure: no audio, no files.
//
// <claudes_code_comments>
// ** Function List **
// BASE_FORMAT                 - the format tag written into every base ('settle-base/1')
// PARTS                       - the eight part names, in a fixed order: kick, snare, hats, perc, bass, chords, lead,
//                               texture
// DRUM_PARTS / PITCHED_PARTS  - the two halves of PARTS
// KINDS                       - 'house' | 'ambient'
// FAMILIES                    - every family a base may carry, by kind; the DJ's drum family names (chicago, deep,
//                               acid, garage, progressive, tech, filter-house, dub-techno, balearic, ambient) are
//                               among them so the brain's choice maps straight onto a base
// ticksPerBar(base)           - grid x beats a bar (beats a bar = num x 4 / den)
// beatsPerBar(meter)          - beats a bar for a meter
// eventBar(base, t)           - the bar an event tick falls in
// validateBase(base)          - every reason a base is not a base: [] when it is one
// isBase(base)                - validateBase(base).length === 0
// compatible(a, b, opts)      - THE COMPATIBILITY RULE: { ok, reasons, transpose, tempo }: the meter must match, the
//                               tempo ranges must overlap (a tolerance of 8% either side), and the keys must agree
//                               (the same key, its relative, or a transposition the caller may apply)
// relativeKey(key)            - a key's relative major or minor
//
// ** Technical Review **
// - A BASE is one JSON object: { format, id, kind, family, origin, tempo: { bpm, min, max }, meter: { num, den },
//   grid (ticks a beat), swing (0..0.3, the lateness of every odd tick as a fraction of a tick), key (or null),
//   bars, parts: { name: { events, features } }, signature, quantise, source: 'ledger' }.
// - An EVENT is [t, d, v, p]: t the tick from the start of the base (bar 0 beat 0), d the length in ticks (at least
//   1), v the level 0..1, p the pitch (a midi note for a pitched part, the General MIDI drum note for a drum part,
//   or null). Ticks are integers, so a part can be cut at any bar line and laid under another part without a
//   rounding step; the grid is 4 for house (sixteenths) and 8 for ambient (thirty-seconds), and combine() rescales
//   a coarser grid onto a finer one by a whole factor.
// - THE ID IS THE NAME. A base is base-NNNN and carries no title, no composer and no file name; the ledger
//   (bases/ledger.json) is the only place a base meets its source. That is the navigator's rule: "rename all the
//   house MIDI tracks to a prefix and an id".
// - THE SIGNATURE is what the DJ searches: { kind, family, bpm, energy, density, syncopation, swing, key, parts,
//   fourFloor, backbeat, bars }. The per-part FEATURES are { density, syncopation, energy, register, onsets, bars }.
//   base-features.js computes both and the wiki page 04 gives each formula.
// - THE COMPATIBILITY RULE answers one question: can this slice sit under that one. Meter is strict. Tempo is a
//   range, so two bases are compatible when their ranges overlap after an 8% stretch; the DJ then plays both at
//   one tempo inside the overlap. A key is a pitch class and a mode; two pitched slices agree when the keys are
//   the same or relative, and otherwise `transpose` says how many semitones the second must move, which the DJ
//   may apply (an unpitched slice has no key and is compatible with everything).
// </claudes_code_comments>

export const BASE_FORMAT = 'settle-base/1';
export const PARTS = ['kick', 'snare', 'hats', 'perc', 'bass', 'chords', 'lead', 'texture'];
export const DRUM_PARTS = ['kick', 'snare', 'hats', 'perc'];
export const PITCHED_PARTS = ['bass', 'chords', 'lead', 'texture'];
export const KINDS = ['house', 'ambient'];
export const FAMILIES = {
  house: ['chicago', 'deep', 'acid', 'garage', 'disco', 'tech', 'progressive', 'filter-house', 'dub-techno', 'balearic', 'breaks', 'funk', 'afro', 'latin', 'electro', 'trance'],
  ambient: ['ambient', 'drone', 'pulse', 'chorale', 'piano', 'bells', 'field', 'downtempo'],
};
export const ALL_FAMILIES = [...FAMILIES.house, ...FAMILIES.ambient];
export const ORIGINS = ['midi', 'authored', 'combined'];
const MODES = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian', 'major', 'minor'];

export function beatsPerBar(meter = { num: 4, den: 4 }) {
  const num = Number(meter?.num) || 4;
  const den = Number(meter?.den) || 4;
  return (num * 4) / den;
}

export function ticksPerBar(base) {
  return Math.round((Number(base?.grid) || 4) * beatsPerBar(base?.meter));
}

export function eventBar(base, t) {
  return Math.floor(t / ticksPerBar(base));
}

const isInt = (x) => Number.isInteger(x);

export function validateBase(base) {
  const p = [];
  if (!base || typeof base !== 'object') return ['not an object'];
  if (base.format !== BASE_FORMAT) p.push(`format is not ${BASE_FORMAT}`);
  if (!/^base-\d{4}$/.test(String(base.id ?? '')) && !/^(combined|slice)-/.test(String(base.id ?? ''))) p.push('id is not base-NNNN');
  if (!KINDS.includes(base.kind)) p.push('kind is not house or ambient');
  if (!ALL_FAMILIES.includes(base.family)) p.push(`family ${base.family} is not known`);
  if (base.kind && FAMILIES[base.kind] && base.family && !FAMILIES[base.kind].includes(base.family)) p.push(`family ${base.family} is not a ${base.kind} family`);
  if (!ORIGINS.includes(base.origin)) p.push('origin is not midi, authored or combined');
  const T = base.tempo ?? {};
  if (!(T.bpm > 20 && T.bpm < 400)) p.push('tempo.bpm is not between 20 and 400');
  if (!(T.min > 0 && T.max >= T.min && T.bpm >= T.min && T.bpm <= T.max)) p.push('tempo range does not hold its bpm');
  const M = base.meter ?? {};
  if (!(isInt(M.num) && M.num > 0 && isInt(M.den) && [1, 2, 4, 8, 16].includes(M.den))) p.push('meter is not num/den');
  if (!(isInt(base.grid) && base.grid >= 1 && base.grid <= 16)) p.push('grid is not 1..16 ticks a beat');
  if (!(Number.isFinite(base.swing) && base.swing >= 0 && base.swing <= 0.3)) p.push('swing is not 0..0.3');
  if (base.key != null) {
    const K = base.key;
    if (!(isInt(K.pc) && K.pc >= 0 && K.pc < 12)) p.push('key.pc is not 0..11');
    if (!MODES.includes(K.mode)) p.push(`key.mode ${K.mode} is not a mode`);
  }
  if (!(isInt(base.bars) && base.bars >= 1 && base.bars <= 256)) p.push('bars is not 1..256');
  if (!base.parts || typeof base.parts !== 'object') p.push('no parts');
  else {
    const tpb = ticksPerBar(base);
    const total = tpb * (base.bars || 0);
    let any = 0;
    for (const [name, part] of Object.entries(base.parts)) {
      if (!PARTS.includes(name)) { p.push(`part ${name} is not one of ${PARTS.join(' ')}`); continue; }
      if (!part || !Array.isArray(part.events)) { p.push(`part ${name} has no events list`); continue; }
      let last = -1;
      for (const e of part.events) {
        if (!Array.isArray(e) || e.length !== 4) { p.push(`part ${name} has an event that is not [t, d, v, p]`); break; }
        const [t, d, v, pitch] = e;
        if (!(isInt(t) && t >= 0 && t < total)) { p.push(`part ${name} has an event outside the base (t ${t} of ${total})`); break; }
        if (!(isInt(d) && d >= 1)) { p.push(`part ${name} has an event with no length`); break; }
        if (!(Number.isFinite(v) && v > 0 && v <= 1)) { p.push(`part ${name} has a level outside 0..1`); break; }
        if (!(pitch === null || (isInt(pitch) && pitch >= 0 && pitch <= 127))) { p.push(`part ${name} has a pitch outside 0..127`); break; }
        if (t < last) { p.push(`part ${name} events are not in time order`); break; }
        last = t;
      }
      if (PITCHED_PARTS.includes(name) && part.events.some((e) => e[3] === null)) p.push(`pitched part ${name} has a null pitch`);
      if (!part.features || typeof part.features !== 'object') p.push(`part ${name} has no features`);
      else for (const f of ['density', 'syncopation', 'energy']) if (!Number.isFinite(part.features[f])) p.push(`part ${name} feature ${f} is not a number`);
      any += part.events.length;
    }
    if (!any) p.push('every part is empty');
  }
  const S = base.signature ?? {};
  for (const f of ['energy', 'density', 'syncopation', 'swing', 'bpm']) if (!Number.isFinite(S[f])) p.push(`signature.${f} is not a number`);
  if (S.kind !== base.kind) p.push('signature.kind differs from kind');
  if (S.family !== base.family) p.push('signature.family differs from family');
  if (!Array.isArray(S.parts)) p.push('signature.parts is not a list');
  if (base.origin === 'midi') {
    const Q = base.quantise ?? {};
    if (!(isInt(Q.grid) && Number.isFinite(Q.meanAbsMs) && Number.isFinite(Q.maxMs) && isInt(Q.onsets))) p.push('a midi base must record its quantise error (grid, meanAbsMs, maxMs, onsets)');
  }
  if (base.source !== 'ledger' && base.origin !== 'combined') p.push("source must be the word 'ledger' (the ledger holds the source, the base never does)");
  for (const k of ['title', 'composer', 'artist', 'file', 'url', 'filename']) if (k in base) p.push(`a base carries no ${k}; that belongs to the ledger`);
  return p;
}

export function isBase(base) { return validateBase(base).length === 0; }

const MAJORS = new Set(['ionian', 'major', 'lydian', 'mixolydian']);
const modeClass = (m) => (MAJORS.has(m) ? 'major' : 'minor');

export function relativeKey(key) {
  if (!key) return null;
  return modeClass(key.mode) === 'major' ? { pc: (key.pc + 9) % 12, mode: 'aeolian' } : { pc: (key.pc + 3) % 12, mode: 'ionian' };
}

// THE COMPATIBILITY RULE
export function compatible(a, b, { tempoTolerance = 0.08, allowTranspose = true } = {}) {
  const reasons = [];
  if (!a || !b) return { ok: false, reasons: ['a base is missing'], transpose: 0, tempo: null };
  const ma = a.meter ?? { num: 4, den: 4 };
  const mb = b.meter ?? { num: 4, den: 4 };
  if (ma.num !== mb.num || ma.den !== mb.den) reasons.push(`meter ${ma.num}/${ma.den} against ${mb.num}/${mb.den}`);
  const ta = a.tempo ?? {};
  const tb = b.tempo ?? {};
  const lo = Math.max((ta.min ?? ta.bpm) / (1 + tempoTolerance), (tb.min ?? tb.bpm) / (1 + tempoTolerance));
  const hi = Math.min((ta.max ?? ta.bpm) * (1 + tempoTolerance), (tb.max ?? tb.bpm) * (1 + tempoTolerance));
  let tempo = null;
  if (lo <= hi) {
    // the tempo both can play: the nearest point of the overlap to the first base's own bpm
    tempo = Math.min(hi, Math.max(lo, ta.bpm ?? lo));
  } else reasons.push(`tempo ${ta.min}..${ta.max} against ${tb.min}..${tb.max}`);
  let transpose = 0;
  if (a.key && b.key) {
    const same = a.key.pc === b.key.pc && modeClass(a.key.mode) === modeClass(b.key.mode);
    const rel = relativeKey(a.key);
    const relative = rel && rel.pc === b.key.pc && modeClass(rel.mode) === modeClass(b.key.mode);
    if (!same && !relative) {
      if (modeClass(a.key.mode) === modeClass(b.key.mode)) {
        // move the second onto the first's tonic, the short way round
        let d = (a.key.pc - b.key.pc + 12) % 12;
        if (d > 6) d -= 12;
        transpose = d;
        if (!allowTranspose) reasons.push(`key ${b.key.pc}/${b.key.mode} against ${a.key.pc}/${a.key.mode}`);
      } else {
        const rb = relativeKey(b.key);
        let d = (a.key.pc - rb.pc + 12) % 12;
        if (d > 6) d -= 12;
        transpose = d;
        if (!allowTranspose) reasons.push(`key ${b.key.pc}/${b.key.mode} against ${a.key.pc}/${a.key.mode}`);
      }
    }
  }
  return { ok: reasons.length === 0, reasons, transpose, tempo };
}
