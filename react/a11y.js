// settle-hear/react · a11y - the spoken values of the sound controls as plain JS, so a node test can check them
// (lane A11YSOUND, navigator 2026-10-04: "all the sound things importantly work with the keyboard and are clearly
// labelled").
//
// percentText(v)    - a 0..1 level as a screen reader should say it: 0.8 -> "80 percent"
// hertzText(v)      - a frequency as a screen reader should say it: 12000 -> "12000 hertz"
// muteAllTitle(base, shortcut, hint) - MUTE ALL's tooltip: the state sentence, then the key when the page gives one
export const percentText = (v) => `${Math.round(v * 100)} percent`;
export const hertzText = (v) => `${Math.round(v)} hertz`;
export const muteAllTitle = (base, shortcut, hint = 'Key: {key}.') => (shortcut ? `${base} ${hint.replace('{key}', shortcut)}` : base);
