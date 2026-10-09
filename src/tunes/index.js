// settle-hear · tunes/index - every book's tunes in one list, in a fixed order.
//
// <claudes_code_comments>
// ** Function List **
// BOOKS     - [slug, tunes] for every source file in this folder, in a fixed order
// ALL_TUNES - every tune from every book, flat, each stamped with its book slug
//
// ** Technical Review **
// - One file per printed source (or per CC0 dataset), so a reader working one book never edits another
//   book's file. The order here is the order the flute's deck is built from; the deck shuffles anyway.
// - A tune's own `book` field is the slug of the file it came from, set here so no file has to repeat it.
// </claudes_code_comments>

import athole_a from './athole-a.js';
import athole_b from './athole-b.js';
import skye1887 from './skye1887.js';
import fraser1816 from './fraser1816.js';
import gow1784 from './gow1784.js';
import harpclaymore1903 from './harpclaymore1903.js';
import mckay1878 from './mckay1878.js';
import smm_vol3 from './smm-vol3.js';
import oswald from './oswald.js';
import oneill1903_airs_a from './oneill1903-airs-a.js';
import oneill1903_airs_b from './oneill1903-airs-b.js';
import oneill1903_airs_c from './oneill1903-airs-c.js';
import oneill1903_carolan from './oneill1903-carolan.js';
import oneill1903_jigs from './oneill1903-jigs.js';
import oneill1903_reels from './oneill1903-reels.js';
import oneill1903_hornpipes from './oneill1903-hornpipes.js';
import joyce1873 from './joyce1873.js';
import petrie1855 from './petrie1855.js';
import bunting from './bunting.js';
import chappell_a from './chappell-a.js';
import chappell_b from './chappell-b.js';
import welsh_jones from './welsh-jones.js';
import manx from './manx.js';
import breton from './breton.js';
import scandinavian from './scandinavian.js';
import ancient from './ancient.js';
import chant_gregobase from './chant-gregobase.js';
import sokyokushu1888 from './sokyokushu1888.js';

export const BOOKS = [
  ['chant-gregobase', chant_gregobase],
  ['sokyokushu1888', sokyokushu1888],
  ['athole-a', athole_a],
  ['athole-b', athole_b],
  ['skye1887', skye1887],
  ['fraser1816', fraser1816],
  ['gow1784', gow1784],
  ['harpclaymore1903', harpclaymore1903],
  ['mckay1878', mckay1878],
  ['smm-vol3', smm_vol3],
  ['oswald', oswald],
  ['oneill1903-airs-a', oneill1903_airs_a],
  ['oneill1903-airs-b', oneill1903_airs_b],
  ['oneill1903-airs-c', oneill1903_airs_c],
  ['oneill1903-carolan', oneill1903_carolan],
  ['oneill1903-jigs', oneill1903_jigs],
  ['oneill1903-reels', oneill1903_reels],
  ['oneill1903-hornpipes', oneill1903_hornpipes],
  ['joyce1873', joyce1873],
  ['petrie1855', petrie1855],
  ['bunting', bunting],
  ['chappell-a', chappell_a],
  ['chappell-b', chappell_b],
  ['welsh-jones', welsh_jones],
  ['manx', manx],
  ['breton', breton],
  ['scandinavian', scandinavian],
  ['ancient', ancient]
];

export const ALL_TUNES = BOOKS.flatMap(([slug, list]) => list.map((t) => ({ ...t, book: slug })));
