// settle-hear/react · muteall - the MUTE ALL button's pulse rule as plain JS, so a node test can check it (lane
// AUTOSTART).
//
// muteAllPulseClass({ muted, unlocked, blocked, pulse }) - the class the button wears: ' hear-muteall--blocked' while the
//   browser holds the sound back (never when muted, never once it plays), else ' hear-muteall--pulse' when the page
//   asked for the first-load pulse, else ''.
export function muteAllPulseClass({ muted = false, unlocked = false, blocked = false, pulse = false } = {}) {
  if (muted) return '';
  if (blocked && !unlocked) return ' hear-muteall--blocked';
  return pulse ? ' hear-muteall--pulse' : '';
}
