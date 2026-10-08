// Argonisos — the trial of Zeus. Entry point: builds the world, runs the frame loop.
import * as THREE from 'three';
import { renderer, scene, camera, render, followShadow, groundDetail, sun } from './render/core.js';
import { Terrain } from './world/terrain.js';
import { WorkerPool } from './world/pool.js';
import { Vegetation } from './world/vegetation.js';
import { windUniform } from './world/trees.js';
import { updateGrass } from './world/grass.js';
import { heightAt, biomeWeights, BIOME_NAMES, biomeAt, WORLD } from './world/gen.js';
import { skyDome, updateSky, fogSky, sunDir, moonDir, LIGHT, DAY_SECONDS } from './world/sky.js';
import { updateWeather, setWeather, snapWeather, WEATHER } from './world/weather.js';
import { setHeightTexture, updateWater } from './world/water.js';
import { buildStormWall, updateStormWall, STORM_WALL } from './world/stormwall.js';

const $ = (id) => document.getElementById(id);

// ---- Terrain
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: groundDetail, envMapIntensity: 0.4 });
const pool = new WorkerPool(Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1)));
const terrain = new Terrain(scene, terrainMat, pool);
terrain.requestHeightTexture(1024, WORLD.SIZE).then(setHeightTexture);
const veg = new Vegetation(scene, pool);
veg.prebuild();
buildStormWall(scene);

// ---- State
export const S = { time: 0.12, day: 1, timeScale: 1 };

// ---- Free camera for exploring the world (the player character replaces it in the next phase)
const cam = { pos: new THREE.Vector3(0, 0, 0), yaw: 0, pitch: -0.15, walk: false, vel: 0 };
cam.pos.set(0, heightAt(0, 0) + 1.7, 0);
const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; if (e.code === 'KeyE') cam.walk = !cam.walk; if (e.code === 'KeyT') S.timeScale = S.timeScale === 1 ? 60 : 1; });
addEventListener('keyup', (e) => { keys[e.code] = false; });
renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
addEventListener('mousemove', (e) => { if (document.pointerLockElement !== renderer.domElement) return; cam.yaw -= e.movementX * 0.0022; cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - e.movementY * 0.0022)); });
function updateCam(dt) {
  const f = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), r = new THREE.Vector3(-f.z, 0, f.x);
  const mv = new THREE.Vector3();
  if (keys.KeyW) mv.add(f); if (keys.KeyS) mv.sub(f); if (keys.KeyD) mv.add(r); if (keys.KeyA) mv.sub(r);
  const speed = cam.walk ? (keys.ShiftLeft ? 9 : 4.5) : keys.ShiftLeft ? 160 : 40;
  if (mv.lengthSq()) cam.pos.addScaledVector(mv.normalize(), speed * dt);
  const g = heightAt(cam.pos.x, cam.pos.z);
  if (cam.walk) cam.pos.y = Math.max(g, 0) + 1.7;
  else { if (keys.Space) cam.pos.y += speed * dt; if (keys.KeyQ) cam.pos.y -= speed * dt; cam.pos.y = Math.max(cam.pos.y, Math.max(g, 0) + 1.5); }
  camera.position.copy(cam.pos); camera.rotation.set(cam.pitch, cam.yaw, 0, 'YXZ');
}

// ---- Loop
const clock = new THREE.Clock(); let fpsT = 0, frames = 0, fps = 60, atmo = { overcast: 0, dark: 0 };
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  S.time += dt * S.timeScale / DAY_SECONDS; if (S.time >= 1) { S.time -= 1; S.day++; }
  updateCam(dt);
  updateSky(S.time, dt, t, atmo.overcast, atmo.dark);
  atmo = updateWeather(dt * S.timeScale ** 0.5, camera.position, LIGHT);
  fogSky(Math.min(1, Math.max(0, 1 - scene.fog.far / 1400, atmo.overcast)));
  updateWater(t, camera.position, LIGHT, skyDome, sunDir, moonDir);
  updateStormWall(t, LIGHT);
  followShadow(camera.position, sunDir.y > 0 ? sunDir : moonDir);
  terrain.update(camera.position);
  veg.update(dt, camera.position); windUniform.value = t; updateGrass(pool, camera.position);
  render();
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
  const w = biomeWeights(cam.pos.x, cam.pos.z), hrs = (S.time * 24 + 6) % 24;
  $('dbg').textContent = `${BIOME_NAMES[biomeAt(cam.pos.x, cam.pos.z)]}  (P ${w.p.toFixed(2)} Y ${w.y.toFixed(2)} V ${w.v.toFixed(2)})  ·  ${cam.pos.x.toFixed(0)}, ${cam.pos.z.toFixed(0)}  h ${heightAt(cam.pos.x, cam.pos.z).toFixed(1)} m  ·  ${String(Math.floor(hrs)).padStart(2, '0')}:${String(Math.floor(hrs % 1 * 60)).padStart(2, '0')}  ·  ${fps.toFixed(0)} fps  ·  patches ${terrain.drawn} (${terrain.pending} building) · veg ${veg.near.size}/${veg.far.size} cells (${pool.busy} jobs)  ·  calls ${renderer.info.render.calls}  ·  ${cam.walk ? 'walking' : 'flying'}  ·  ${WEATHER.type}`;
}
loop();
window.AG = { STORM_WALL, setWeather, snapWeather, WEATHER, THREE, scene, camera, renderer, terrain, veg, pool, cam, S, heightAt, biomeWeights, sun, render };
