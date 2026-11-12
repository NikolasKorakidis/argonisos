// How the player moves (m/s, m/s²), kept apart from player.js so the animation viewer (src/dev/anim/hero.js) moves its
// hero by the same numbers without loading the game (player.js brings the renderer with it). Data-table speeds, ft → m:
// sprint 25 ft/s, swim 8 ft/s, jump 6 ft up; aiming and blocking slow the run to these
export const RUN = 4.6, SPRINT = 7.6, SWIM = 2.4, SNEAK = 1.6, AIM = 2.2, BLOCK_K = 0.5, GRAV = 20, JUMP_V = Math.sqrt(2 * GRAV * 1.83);
