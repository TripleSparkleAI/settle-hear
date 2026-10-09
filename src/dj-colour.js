// settle-hear · dj-colour - THE DJ's OVERDRIVE AND VOCODER, the light half (lane DJOVERDRIVE, 2026-10-08): the hook
// on a set of voice buses, the words, and the loader of the audio half (dj-colour-stage.js), which waits in its own chunk.
//
// <claudes_code_comments>
// ** Function List **
// loadColour()               - fetch dj-colour-stage.js once; the same promise for every caller; a failed fetch may be
//                              retried
// colourNow()                - the loaded audio half, or null while it is still on its way
// colourBuses(buses, ctx)    - THE HOOK on a set of voice buses (voice-fx.js createVoiceBuses): the same object, but
//                              input(slot) answers the slot's colour stage when it has one; .colour(map, t, tau)
//                              colours the slots the map names and returns every other built stage to dry
// SLOT_WORDS                 - each part's name in words
// colourWords(colour)        - the plain words for a resolved colour ("overdrive on the lead · vocoder on the harp,
//                              warbling"), only the voices sounding now
//
// ** Technical Review **
// - THE FIRST LOAD (the site's bundle guard, settle-site tests/bundleslim.test.mjs): the hero's DJ is in the site's
//   entry chunk, so anything symphony.js or dj-fx.js imports statically is too, and the entry sat 171 B under its
//   ceiling before this lane. The valve, the vocoder and the colour stage (dj-colour-stage.js) are heard only once THE
//   DJ deals them, so they wait in their own chunk, as echoguitar.js does. The symphony asks for them when its sound
//   starts; THE DECK RULE keeps the visit's first phrase calm, so they have arrived long before OVERDRIVE or a colour
//   is first dealt. Until they arrive a stage is not built: the voice plays dry, and the line names no colour (the
//   symphony's colourView reads colourNow()).
// - THE HOOK (colourBuses): voice-fx.js gives each melodic part its own bus; the colour stage sits BEFORE the bus's
//   chain (the notes go into the stage, the stage into the bus), so the part's own effects, its trim and its mute gate
//   (432 Hz McKUSKER MODE) come after it: a muted voice is muted with its overdrive and its vocoder. The wrapper is
//   the buses object itself (Object.create), so every method the buses gain later still answers.
// - The audio half's own law (the valve, never louder, the oversampling, the vocoder, the warble) is written at the
//   top of dj-colour-stage.js.
// </claudes_code_comments>

let mod = null;
let promise = null;

export function loadColour() {
  if (!promise) promise = import('./dj-colour-stage.js').then((m) => { mod = m; return m; }).catch((e) => { promise = null; throw e; });
  return promise;
}

export const colourNow = () => mod;

// THE HOOK on a set of voice buses: the same object, with each coloured part's notes sent into its colour stage
export function colourBuses(buses, ctx) {
  if (!buses) return buses;
  const stages = {};
  const w = Object.create(buses);
  w.input = (slot, t0 = ctx.currentTime) => {
    const inner = buses.input(slot, t0);
    return stages[slot]?.input ?? inner;
  };
  // map: { [slot]: { drive, vocoder } }; a built stage the map leaves out goes back to dry
  w.colour = (map = {}, t0 = ctx.currentTime, tau = 0.35) => {
    const m = map && typeof map === 'object' ? map : {};
    for (const [slot, plan] of Object.entries(m)) {
      if (!plan || (!plan.drive && !plan.vocoder)) continue;
      if (stages[slot]) continue;
      const C = colourNow();
      if (!C) { loadColour().catch(() => { /* the voice stays dry until a later bar loads it */ }); continue; }
      stages[slot] = C.createColourStage(ctx, buses.input(slot, t0));
    }
    for (const [slot, st] of Object.entries(stages)) st.set(m[slot] ?? {}, t0, tau);
    return w.colourState();
  };
  w.colourState = () => Object.fromEntries(Object.entries(stages).map(([slot, st]) => [slot, st.state]));
  w.colourStages = () => ({ ...stages });
  w.dispose = () => {
    for (const st of Object.values(stages)) st.dispose();
    buses.dispose();
  };
  return w;
}

export const SLOT_WORDS = Object.freeze({
  lead: 'the lead', arps: 'the arps', answer: 'the answer', chop: 'the chop', fiddle: 'the fiddle', harp: 'the harp',
  bells: 'the bells', crystal: 'the crystal', flute: 'the McKusker flute',
});

// a resolved colour (symphony.js fxView: { drive: { slot, present }, vocoder: { slot, warble, present } }) in words
export function colourWords(colour) {
  const out = [];
  const d = colour?.drive;
  const v = colour?.vocoder;
  if (d?.present) out.push(`overdrive on ${SLOT_WORDS[d.slot] ?? d.slot}`);
  if (v?.present) out.push(`vocoder on ${SLOT_WORDS[v.slot] ?? v.slot}${v.warble ? ', warbling' : ''}`);
  return out.join(' · ');
}
