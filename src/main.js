// Argonisos: the trial of Zeus. Entry point: builds the world and the player, runs the frame loop.
import * as THREE from 'three';
import { renderer, scene, camera, render, followShadow, groundDetail, sun } from './render/core.js';
import { Terrain } from './world/terrain.js';
import { WorkerPool } from './world/pool.js';
import { Vegetation } from './world/vegetation.js';
import { windUniform } from './world/trees.js';
import { updateGrass } from './world/grass.js';
import { heightAt, biomeWeights, BIOME_NAMES, biomeAt, WORLD } from './world/gen.js';
import { skyDome, updateSky, fogSky, sunDir, moonDir, LIGHT, DAY_SECONDS, DAY_FRACTION } from './world/sky.js';
import { updateWeather, setWeather, snapWeather, WEATHER } from './world/weather.js';
import { setHeightTexture, updateWater } from './world/water.js';
import { buildStormWall, updateStormWall, STORM_WALL } from './world/stormwall.js';
import { SPECIES, STRIDE } from './world/flora.js';
import { colliders } from './world/colliders.js';
import { input, endFrame, hit, down } from './input.js';
import { Player } from './player/player.js';
import { Inventory } from './game/inventory.js';
import { ITEMS } from './game/items.js';
import { HUD } from './ui/hud.js';
import { installGame } from './game/game.js';
import { titleScreen, pauseMenu } from './ui/title.js';
import { devMenu } from './ui/dev.js';

const $ = (id) => document.getElementById(id);

// ---- World
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: groundDetail, envMapIntensity: 0.4 });
const pool = new WorkerPool(Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1)));
const terrain = new Terrain(scene, terrainMat, pool);
terrain.requestHeightTexture(1024, WORLD.SIZE).then(setHeightTexture);
const veg = new Vegetation(scene, pool);
veg.prebuild();
buildStormWall(scene);
// trees and rocks near the player become colliders (felled ones are skipped)
veg.onCell = (key, items, cx, cz) => {
  if (!items) { colliders.removeGroup('v' + key); return; }
  const list = [];
  for (let i = 0; i < items.length / STRIDE; i++) {
    const o = i * STRIDE, sp = SPECIES[items[o]]; if (!sp.col || veg.removed.has(`${cx},${cz},${i}`)) continue;
    const s = items[o + 6]; list.push({ x: items[o + 2], z: items[o + 4], y: items[o + 3], r: sp.col * s, h: sp.h ? sp.h * s * 1.4 : undefined, ref: { cx, cz, i, sp: items[o], s } });
  }
  colliders.addGroup('v' + key, list);
};

// ---- State
export const S = { time: 0.06, day: 1, timeScale: 1, debug: false, fly: false, flySpeed: 40, bed: null };
const SPAWN = { x: 6, z: 4 };

// ---- Player, pack and HUD
const player = new Player(scene);
player.spawn(SPAWN.x, SPAWN.z); player.camYaw = Math.PI * 0.8; player.yaw = player.camYaw + Math.PI;
const inv = new Inventory(), hud = new HUD();
hud.bind(player, inv);
player.onToast = (m) => hud.toast(m);
player.stats.onLevel = (s, L) => hud.toast(`<b>${s[0].toUpperCase() + s.slice(1)}</b> skill is now level ${L}`);
const baseDeath = player.stats.onDeath;
player.stats.onDeath = () => { baseDeath(); hud.death(true); game.onDeath?.(); setTimeout(respawn, 5500); };
function respawn() {
  hud.death(false);
  const skills = Object.values(player.stats.skills), k = skills[Math.floor(Math.random() * skills.length)]; k.xp *= 0.95;   // death costs 5% of one skill's progress
  const bed = S.bed || SPAWN; player.revive(bed.x, bed.z); snapWeather();
  hud.toast('Zeus lifts you up again. <b>Zeus\'s Favour</b> carries you for a while.');
}
// hotbar: 1-8 use the item in that slot (equip a tool or weapon, eat food)
hud.onUse = (i) => useSlot(i);
function useSlot(i) {
  const s = inv.slots[i]; if (!s) return; const d = ITEMS[s.id];
  if (d.type === 'food') {
    const why = player.stats.eat(s.id, d.food); if (why) { hud.toast(`${d.name}: ${why}`); return; }
    inv.take(s.id, 1); hud.toast(d.food.health < 0 ? `That ${d.name.toLowerCase()} made you sick` : `Ate ${d.name.toLowerCase()}`); return;
  }
  if (['tool', 'weapon', 'shield', 'armor'].includes(d.type)) game.equip?.(i);
}

// ---- Debug free camera (F9): flies without the player, for looking around the world
const fly = { pos: new THREE.Vector3(), yaw: 0, pitch: -0.2 };
function updateFly(dt) {
  if (input.locked) { fly.yaw -= input.dx * 0.0022 * input.sens; fly.pitch = Math.max(-1.5, Math.min(1.5, fly.pitch - input.dy * 0.0022 * input.sens)); }
  const f = new THREE.Vector3(-Math.sin(fly.yaw), 0, -Math.cos(fly.yaw)), r = new THREE.Vector3(-f.z, 0, f.x), mv = new THREE.Vector3();
  if (down('KeyW')) mv.add(f); if (down('KeyS')) mv.sub(f); if (down('KeyD')) mv.add(r); if (down('KeyA')) mv.sub(r);
  const sp = S.flySpeed * (down('ShiftLeft') ? 4 : 1); if (mv.lengthSq()) fly.pos.addScaledVector(mv.normalize(), sp * dt);
  if (down('Space')) fly.pos.y += sp * dt; if (down('KeyQ')) fly.pos.y -= sp * dt;
  fly.pos.y = Math.max(fly.pos.y, Math.max(heightAt(fly.pos.x, fly.pos.z), 0) + 1.5);
  camera.position.copy(fly.pos); camera.rotation.set(fly.pitch, fly.yaw, 0, 'YXZ');
}

// ---- Biome banners: announce a biome when you're well inside it
const REGION_SUB = ['The plains of the hero', 'The dark forest', 'The drowned marsh'];
let regionNow = -1;
function updateRegion() {
  const w = biomeWeights(player.pos.x, player.pos.z), b = biomeAt(player.pos.x, player.pos.z), k = [w.p, w.y, w.v][b];
  if (b !== regionNow && k > 0.75) { regionNow = b; hud.region(BIOME_NAMES[b], REGION_SUB[b]); }
}
// ---- Conditions the world puts on you: rain soaks you unless you're under a roof; night or wet makes you cold unless
// you're by a fire (or dressed for it)
function updateConditions() {
  const st = player.stats, night = S.time >= DAY_FRACTION - 0.01 || LIGHT.night > 0.4;
  const roof = game.underRoof?.(player.pos) ?? false, fire = game.nearFire?.(player.pos) ?? false;
  st.set('underRoof', roof); st.set('nearFire', fire);
  if (WEATHER.k.rain > 0.3 && !roof) st.add('wet');
  if (fire) st.remove('wet');
  st.set('cold', (night || st.has('wet')) && !fire && !(game.warmArmor?.() ?? false));
}
// Game systems (crafting, building, creatures...) plug in here
export const game = { player, inv, hud, veg, colliders, scene, S, pool, useSlot };
installGame(game);
// Free flight (F9 or the dev menu): the camera flies; leaving it sets the hero down on the ground below
game.setFly = (on) => {
  if (on === S.fly) return; S.fly = on;
  if (on) { fly.pos.copy(camera.position); fly.yaw = player.camYaw; fly.pitch = player.camPitch; hud.toast('Flying: <span class="kbd">WASD</span> move · <span class="kbd">Space</span> / <span class="kbd">Q</span> up / down · <span class="kbd">Shift</span> ×4 · <span class="kbd">F9</span> land'); }
  else { player.spawn(camera.position.x, camera.position.z); player.camYaw = fly.yaw; player.yaw = fly.yaw + Math.PI; snapWeather(); }
};
// the title screen until the land around you and the hero are in (?play skips it, for tests)
const readiness = () => Math.min(1, (terrain.drawn > 40 && terrain.pending === 0 ? 0.6 : terrain.drawn / 70) + (player.hero.model ? 0.25 : 0) + (veg.near.size > 6 ? 0.15 : 0));
pauseMenu(game); devMenu(game);
if (new URLSearchParams(location.search).has('play')) game.started = true; else titleScreen(game, readiness);
const clockText = () => { const t = S.time, h = t < DAY_FRACTION ? 6 + (t / DAY_FRACTION) * 15 : (21 + ((t - DAY_FRACTION) / (1 - DAY_FRACTION)) * 9) % 24; return `Day ${S.day} · ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 6) * 10).padStart(2, '0')}`; };

// ---- Loop
const clock = new THREE.Clock(); let fpsT = 0, frames = 0, fps = 60, atmo = { overcast: 0, dark: 0 };
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (!game.paused) S.time += dt * S.timeScale / DAY_SECONDS; if (S.time >= 1) { S.time -= 1; S.day++; hud.toast(`<b>Day ${S.day}</b> dawns`); }
  // keys
  const busy = !game.started || game.paused;
  const pauseKey = hit('KeyP') || (hit('Escape') && performance.now() - (game.pausedAt || 0) > 400);   // (the Esc that just paused us via the mouse release doesn't unpause)
  if (game.started && pauseKey && !hud.open && !game.map?.open && !game.owl?.open && !(game.build?.sel && !game.paused)) game.pause(!game.paused);
  if (!busy && (hit('Tab') || hit('KeyI') || (hit('Escape') && hud.open))) hud.toggle();
  if (!busy && !input.uiOpen) for (let k = 1; k <= 8; k++) if (hit('Digit' + k)) useSlot(k - 1);
  if (hit('F3')) { S.debug = !S.debug; $('dbg').classList.toggle('hidden', !S.debug); }
  if (hit('F9') && !busy) game.setFly(!S.fly);
  if (S.debug && hit('KeyT')) S.timeScale = S.timeScale === 1 ? 60 : 1;
  if (!busy) game.update?.(dt, t);
  player.frozen = S.fly || hud.open || busy; if (!game.paused) player.update(dt);
  if (S.fly) updateFly(dt);
  if (!busy) { updateConditions(); player.stats.update(dt); updateRegion(); }
  const focus = S.fly ? camera.position : player.pos;
  updateSky(S.time, dt, t, atmo.overcast, atmo.dark);
  atmo = updateWeather(dt, focus, LIGHT, (k) => setTimeout(() => game.sound?.('thunder', Math.min(1.5, k * 0.6)), 300 + k * 900));
  fogSky(Math.min(1, Math.max(0, 1 - scene.fog.far / 1400, atmo.overcast)));
  updateWater(t, camera.position, LIGHT, skyDome, sunDir, moonDir);
  updateStormWall(t, LIGHT);
  followShadow(focus, sunDir.y > 0 ? sunDir : moonDir);
  terrain.update(camera.position);
  veg.update(dt, focus); windUniform.value = t; updateGrass(pool, focus);
  game.lateUpdate?.(dt, t);
  hud.update(dt, clockText(), S.time >= DAY_FRACTION);
  render();
  endFrame();
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
  if (S.debug) {
    const p = focus, w = biomeWeights(p.x, p.z);
    $('dbg').textContent = `${BIOME_NAMES[biomeAt(p.x, p.z)]} (P ${w.p.toFixed(2)} Y ${w.y.toFixed(2)} V ${w.v.toFixed(2)}) · ${p.x.toFixed(0)}, ${p.z.toFixed(0)} h ${heightAt(p.x, p.z).toFixed(1)} · ${fps.toFixed(0)} fps · patches ${terrain.drawn} (${terrain.pending}) · veg ${veg.near.size}/${veg.far.size} · ${WEATHER.type}`;
  }
}
loop();
window.AG = { game, player, inv, hud, STORM_WALL, setWeather, snapWeather, WEATHER, THREE, scene, camera, renderer, terrain, veg, pool, S, heightAt, biomeWeights, sun, render, fly,
  teleport(x, z, yaw = player.camYaw, pitch = player.camPitch) { player.spawn(x, z); player.camYaw = yaw; player.yaw = yaw + Math.PI; player.camPitch = pitch; snapWeather(); },
  get fps() { return fps; } };
