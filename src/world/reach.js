// How far out things are drawn round the player, in metres. These belong together (tester feedback, 15 and 16 Oct):
// the mist hides how much less is drawn behind it, and lies over the edge of the grass, so change them together.
//   MIST_R0 → MIST_R1  the player's mist thickens from clear to its full strength (atmosphere.js); over the same span
//                      the distant trees, rocks and small plants thin out to the share that stays (vegetation.js)
//   GRASS_R → GRASS_END  the grass thins away (grass.js), half-way into the mist
// On Ultra (high-end PCs, render/quality.js) everything is drawn about twice as far out, the mist pushed back with it.
import { ULTRA } from '../render/quality.js';

export const MIST_R0 = ULTRA ? 120 : 60, MIST_R1 = ULTRA ? 200 : 100;
export const GRASS_R = ULTRA ? 160 : 80, GRASS_END = ULTRA ? 180 : 95;
