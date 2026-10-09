// settle-hear · melody - 432 Hz McKUSKER MODE: whether the flute is playing the melody now, and the one switch that
// mutes that voice and nothing else (navigator, 2026-10-05: "have it be a toggle button that turns it off and on too
// for the user, like a mute button").
//
// <claudes_code_comments>
// ** Function List **
// MCKUSKER_VOICES            - the lead instruments that count as the flute: the clear flute and the distorted flute
// MELODY_FADE                - 0.12 s: how fast the mute closes and opens the voice's gate (a press, never a click)
// isMcKuskerVoice(inst)      - true for an instrument in MCKUSKER_VOICES
// melodyOf(input)            - { voice, present } from the symphony's own state: present when the flute is the lead and
//                              the lead part is in this bar's plan (pure mode with a collected tune running, the
//                              symphony's tune mode, the house set's LEAD layer) and the symphony is audible
// melodyMute                 - the store: get() -> bool, set(v), toggle(), subscribe(fn); one per page load
//
// ** Technical Review **
// - WHAT COUNTS: the McKusker flute (pure mode: a collected tune on the clear flute alone), the symphony's tune when its
//   dealt lead is a flute, and THE HOUSE DJ's LEAD layer when the set's lead is a flute. The keys as a lead do not
//   count. The distorted flute counts because it is the flute playing the same tune through its chain; widen or
//   narrow the set in MCKUSKER_VOICES and nothing else moves.
// - PRESENT reads the plan, not the notes: a long note held across a bar line starts no note in the second bar, so
//   counting notes would flicker the tag. The opening blend, a pause, MUTE ALL and the first gesture not yet given all
//   read as absent, because then no flute sounds.
// - THE MUTE is a gate on the voice's own output: the lead bus's gate (voice-fx.js createVoiceBus mute), the house
//   set's lead bus (mix-layers.js muteSlot) and the pure flute's gate in the symphony. The DJ goes on deciding exactly
//   as before (the plan, the tag and the steering are untouched), so the tag stays visible and a second press brings
//   the flute back at once. MUTE ALL is the engine's and still wins over everything.
// - One store per page load: a remounted symphony reads it at birth, so the mute stays for the visit.
// </claudes_code_comments>

export const MCKUSKER_VOICES = Object.freeze(['flute', 'flute-drive']);
export const MELODY_FADE = 0.12;

export const isMcKuskerVoice = (inst) => MCKUSKER_VOICES.includes(inst);

// input: { audible, opener (true while the opening blend holds the set), pure, house, tuneRunning (pure: a collected
// tune is playing, not resting between tunes), mode (the DJ's bar mode), leadOn (house: the LEAD layer is in this
// bar), flute (the flute track is in: the steering can hold it out), voice (the lead instrument) }
export function melodyOf({ audible = false, opener = false, pure = false, house = false, tuneRunning = false, mode = null, leadOn = false, flute = true, voice = null } = {}) {
  const v = pure ? 'flute' : typeof voice === 'string' ? voice : null;
  if (!audible || opener || !flute || !isMcKuskerVoice(v)) return { voice: v, present: false };
  const inPlan = pure ? !!tuneRunning : house ? !!leadOn : mode === 'tune';
  return { voice: v, present: inPlan };
}

function store(init) {
  let on = !!init;
  const subs = new Set();
  const api = {
    get: () => on,
    set(v) {
      const next = !!v;
      if (next === on) return;
      on = next;
      for (const f of subs) f(on);
    },
    toggle() { api.set(!on); return on; },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
  return api;
}

export const melodyMute = store(true); // the flute starts OFF (navigator 2026-10-07: "a bit much with the flute"); the McKusker toggle turns it on
