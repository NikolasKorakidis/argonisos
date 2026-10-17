// How far out things are drawn round the player, in metres. These belong together (tester feedback, 15 and 16 Oct):
// the mist hides how much less is drawn behind it, and lies over the edge of the grass, so change them together.
//   MIST_R0 → MIST_R1  the player's mist thickens from clear to its full strength (atmosphere.js); over the same span
//                      the distant trees, rocks and small plants thin out to the share that stays (vegetation.js)
//   GRASS_R → GRASS_END  the grass thins away (grass.js), half-way into the mist
export const MIST_R0 = 60, MIST_R1 = 100;
export const GRASS_R = 80, GRASS_END = 95;
