// settle-hear · bases/midi - a small reader for Standard MIDI Files (format 0 and 1), enough to turn a drum groove or
// a piano piece into notes on a beat grid. Pure: bytes in, notes in beats out. Nothing here is shipped as MIDI; the
// importer (base-import.js) turns what this reads into our own base format and the raw file stays in the ledger.
//
// <claudes_code_comments>
// ** Function List **
// readVarLen(bytes, pos)      - a MIDI variable-length number: { value, next }
// parseMidi(bytes)            - Uint8Array -> { format, ticksPerBeat, tracks, tempos, timeSigs, keySigs, lengthBeats }
//                               each track { index, name, channel (the most used), program, notes: [{ t, d, p, v,
//                               ch }] } with t and d in quarter-note beats (ticks / ticksPerBeat, never tempo-scaled)
// GM_DRUMS                    - General MIDI percussion notes -> our drum part and voice ({ part, voice })
// GM_ROLE                     - a General MIDI program number -> the role family we read it as (bass, chords, lead,
//                               texture, keys)
// gmRole(program)             - the role family for one program number
//
// ** Technical Review **
// - A note is the pair of a note-on (velocity > 0) and the next note-off (or note-on at velocity 0) on the same
//   channel and pitch. Running status is honoured. Meta events read: track name (0x03), set tempo (0x51), time
//   signature (0x58), key signature (0x59), end of track (0x2F). Everything else is skipped by length.
// - Times are kept in BEATS (quarter notes), as ticks / ticksPerBeat. A tempo change does not move a note on the
//   grid, so the importer can quantise against the written grid; the tempo list is reported beside it.
// - Channel 10 (index 9) is the General MIDI drum channel. GM_DRUMS maps its note numbers onto our four drum parts
//   (kick, snare, hats, perc) and names the voice (clap, rim, open hat, ride, tom...), which the base keeps as
//   the event's pitch so the player can pick the kit voice.
// - SMPTE time division (the high bit set) is rare in these files and is refused with a clear error.
// </claudes_code_comments>

export function readVarLen(bytes, pos) {
  let value = 0;
  let i = pos;
  for (let k = 0; k < 4; k++) {
    const b = bytes[i++];
    value = (value << 7) | (b & 0x7f);
    if (!(b & 0x80)) break;
  }
  return { value, next: i };
}

function str(bytes, a, n) {
  let s = '';
  for (let i = 0; i < n; i++) s += String.fromCharCode(bytes[a + i]);
  return s;
}

function u32(b, i) { return ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0; }
function u16(b, i) { return (b[i] << 8) | b[i + 1]; }

export function parseMidi(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (str(bytes, 0, 4) !== 'MThd') throw new Error('not a MIDI file (no MThd)');
  const headLen = u32(bytes, 4);
  const format = u16(bytes, 8);
  const nTracks = u16(bytes, 10);
  const division = u16(bytes, 12);
  if (division & 0x8000) throw new Error('SMPTE time division is not supported');
  const ticksPerBeat = division || 480;
  let pos = 8 + headLen;
  const tracks = [];
  const tempos = [];
  const timeSigs = [];
  const keySigs = [];
  let lengthTicks = 0;
  for (let ti = 0; ti < nTracks && pos + 8 <= bytes.length; ti++) {
    if (str(bytes, pos, 4) !== 'MTrk') { pos += 8 + u32(bytes, pos + 4); continue; }
    const len = u32(bytes, pos + 4);
    let i = pos + 8;
    const end = Math.min(bytes.length, i + len);
    let tick = 0;
    let status = 0;
    const open = new Map(); // `${ch}:${p}` -> { tick, v }
    const notes = [];
    const chCount = new Map();
    const programs = new Map();
    let name = '';
    while (i < end) {
      const dv = readVarLen(bytes, i);
      tick += dv.value;
      i = dv.next;
      let b = bytes[i];
      if (b === 0xff) {
        const type = bytes[i + 1];
        const l = readVarLen(bytes, i + 2);
        const dataAt = l.next;
        if (type === 0x03) name = str(bytes, dataAt, l.value);
        else if (type === 0x51 && l.value === 3) {
          const us = (bytes[dataAt] << 16) | (bytes[dataAt + 1] << 8) | bytes[dataAt + 2];
          tempos.push({ tick, t: tick / ticksPerBeat, bpm: us > 0 ? 60000000 / us : 120 });
        } else if (type === 0x58 && l.value >= 2) timeSigs.push({ tick, t: tick / ticksPerBeat, num: bytes[dataAt], den: Math.pow(2, bytes[dataAt + 1]) });
        else if (type === 0x59 && l.value >= 2) keySigs.push({ tick, t: tick / ticksPerBeat, sharps: (bytes[dataAt] << 24) >> 24, minor: bytes[dataAt + 1] === 1 });
        i = dataAt + l.value;
        if (type === 0x2f) break;
        continue;
      }
      if (b === 0xf0 || b === 0xf7) {
        const l = readVarLen(bytes, i + 1);
        i = l.next + l.value;
        continue;
      }
      if (b & 0x80) { status = b; i++; } else if (!status) { i++; continue; }
      const kind = status & 0xf0;
      const ch = status & 0x0f;
      if (kind === 0x90 || kind === 0x80) {
        const p = bytes[i];
        const v = bytes[i + 1];
        i += 2;
        const key = `${ch}:${p}`;
        if (kind === 0x90 && v > 0) {
          if (open.has(key)) {
            const o = open.get(key);
            notes.push({ t: o.tick / ticksPerBeat, d: Math.max(1, tick - o.tick) / ticksPerBeat, p, v: o.v / 127, ch });
          }
          open.set(key, { tick, v });
          chCount.set(ch, (chCount.get(ch) ?? 0) + 1);
        } else if (open.has(key)) {
          const o = open.get(key);
          notes.push({ t: o.tick / ticksPerBeat, d: Math.max(1, tick - o.tick) / ticksPerBeat, p, v: o.v / 127, ch });
          open.delete(key);
        }
      } else if (kind === 0xc0) { programs.set(ch, bytes[i]); i += 1; }
      else if (kind === 0xd0) i += 1;
      else i += 2; // 0xA0 0xB0 0xE0
    }
    for (const [key, o] of open) {
      const [ch, p] = key.split(':').map(Number);
      notes.push({ t: o.tick / ticksPerBeat, d: Math.max(1, tick - o.tick) / ticksPerBeat, p, v: o.v / 127, ch });
    }
    notes.sort((a, b) => a.t - b.t || a.p - b.p);
    lengthTicks = Math.max(lengthTicks, tick);
    let channel = null;
    let best = -1;
    for (const [c, n] of chCount) if (n > best) { best = n; channel = c; }
    tracks.push({ index: ti, name, channel, program: channel == null ? null : programs.get(channel) ?? null, programs: Object.fromEntries(programs), notes });
    pos = end;
  }
  return { format, ticksPerBeat, tracks, tempos, timeSigs, keySigs, lengthBeats: lengthTicks / ticksPerBeat };
}

// General MIDI percussion: note number -> our drum part and the voice name the player picks
export const GM_DRUMS = {
  35: { part: 'kick', voice: 'kick' }, 36: { part: 'kick', voice: 'kick' },
  37: { part: 'perc', voice: 'rim' }, 38: { part: 'snare', voice: 'snare' }, 39: { part: 'snare', voice: 'clap' }, 40: { part: 'snare', voice: 'snare' },
  41: { part: 'perc', voice: 'tom-low' }, 43: { part: 'perc', voice: 'tom-low' }, 45: { part: 'perc', voice: 'tom-mid' }, 47: { part: 'perc', voice: 'tom-mid' },
  48: { part: 'perc', voice: 'tom-high' }, 50: { part: 'perc', voice: 'tom-high' },
  42: { part: 'hats', voice: 'closed' }, 44: { part: 'hats', voice: 'pedal' }, 46: { part: 'hats', voice: 'open' },
  49: { part: 'perc', voice: 'crash' }, 57: { part: 'perc', voice: 'crash' }, 52: { part: 'perc', voice: 'crash' }, 55: { part: 'perc', voice: 'crash' },
  51: { part: 'perc', voice: 'ride' }, 59: { part: 'perc', voice: 'ride' }, 53: { part: 'perc', voice: 'ride' },
  54: { part: 'perc', voice: 'tambourine' }, 56: { part: 'perc', voice: 'cowbell' }, 58: { part: 'perc', voice: 'vibraslap' },
  60: { part: 'perc', voice: 'bongo' }, 61: { part: 'perc', voice: 'bongo' }, 62: { part: 'perc', voice: 'conga' }, 63: { part: 'perc', voice: 'conga' }, 64: { part: 'perc', voice: 'conga' },
  65: { part: 'perc', voice: 'timbale' }, 66: { part: 'perc', voice: 'timbale' }, 67: { part: 'perc', voice: 'agogo' }, 68: { part: 'perc', voice: 'agogo' },
  69: { part: 'perc', voice: 'shaker' }, 70: { part: 'perc', voice: 'shaker' }, 75: { part: 'perc', voice: 'clave' }, 76: { part: 'perc', voice: 'woodblock' }, 77: { part: 'perc', voice: 'woodblock' },
  80: { part: 'perc', voice: 'triangle' }, 81: { part: 'perc', voice: 'triangle' }, 82: { part: 'perc', voice: 'shaker' },
};

// General MIDI programs, 0-based, by family; a role the importer starts from before it reads the notes
export const GM_ROLE = [
  [0, 7, 'keys'], [8, 15, 'keys'], [16, 23, 'chords'], [24, 31, 'keys'], [32, 39, 'bass'], [40, 47, 'lead'],
  [48, 51, 'chords'], [52, 54, 'chords'], [55, 55, 'perc'], [56, 63, 'lead'], [64, 71, 'lead'], [72, 79, 'lead'],
  [80, 87, 'lead'], [88, 95, 'chords'], [96, 103, 'texture'], [104, 111, 'lead'], [112, 119, 'perc'], [120, 127, 'texture'],
];

export function gmRole(program) {
  const p = Number(program);
  if (!Number.isFinite(p)) return 'keys';
  for (const [a, b, role] of GM_ROLE) if (p >= a && p <= b) return role;
  return 'keys';
}
