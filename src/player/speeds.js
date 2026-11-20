// How the player moves (m/s, m/s²), kept apart from player.js so the animation viewer (src/dev/anim/hero.js) moves its
// hero by the same numbers without loading the game (player.js brings the renderer with it). They began as the data
// table's speeds, ft → m (sprint 25 ft/s, swim 8 ft/s), and were all brought down by a quarter in Patch 22 (the hero
// ran too fast for the land to feel big: run 4.6 → 3.45, sprint 7.6 → 5.7), so they keep their relations; the jump
// stays 6 ft up. Aiming and blocking slow the run to these. (hero.js plays each cycle at the pace the ground goes by,
// so the feet don't slide whatever these are.)
const K = 0.75;
export const RUN = 4.6 * K, SPRINT = 7.6 * K, SWIM = 2.4 * K, SNEAK = 1.6 * K, AIM = 2.2 * K, BLOCK_K = 0.5, GRAV = 20, JUMP_V = Math.sqrt(2 * GRAV * 1.83);
