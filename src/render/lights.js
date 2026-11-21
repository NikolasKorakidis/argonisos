// Fire light. Every point light costs every lit pixel (grass included), so there is one small fixed pool shared by all
// fires, braziers and torches: each frame, sources ask for light and the ones nearest the camera get it. The pool size
// never changes, so shaders never recompile.
// The nearest of them casts shadows (Valheim's night: the hut's posts and the hero throwing long shadows from the fire),
// on High and Ultra: one small cube shadow map, drawn again only every other frame while it is near the camera (the fire
// stays put; only what moves round it changes) and once whenever it moves to another fire. Whether it casts is fixed for
// the visit's preset as far as the shaders go (a light that starts or stops casting recompiles every lit material), so a
// switch to or from Medium changes it at once but costs that one hitch.
import * as THREE from 'three';
import { scene, camera } from './core.js';
import { ULTRA, BOOT_GFX } from './quality.js';

// (On Ultra, for high-end PCs, twice the pool, and fires light the land from further off: a camp of several fires at
// night is lit by all of them, and a town's braziers are seen across the square)
const N = ULTRA ? 6 : 3, REACH = ULTRA ? 120 : 70, pool = [], asks = [];
for (let i = 0; i < N; i++) { const L = new THREE.PointLight(0xffa050, 0, 18, 1.6); L.castShadow = false; scene.add(L); pool.push(L); }
// the shadow-casting one: its cube map's faces SHADOW_N texels square, a little bias for the rough ground and logs. What
// stands still round a fire casts the same shadow every frame, so it draws again only while something that moves (the
// hero, a creature: a skinned body) is within its reach, and the camera within SHADOW_NEAR metres of it (further off its
// shadows can't be told apart): then every other frame.
// Its six faces draw only what stands within its reach: the things found there (the hut, the workbench, the hero, a
// creature, a column) are put on a layer of their own every so often (CASTS), which is all its shadow camera sees. The
// world-wide batches (the trees, the grass, the ground cover: one draw for every cell) stay off it: drawn six times over
// they made each update cost more than the rest of the frame.
const SHADOW_N = ULTRA ? 512 : 256, SHADOW_NEAR = 40, FIRE_LAYER = 7, CASTS = 0.5, caster = pool[0];
caster.castShadow = BOOT_GFX === 'high' || ULTRA; caster.shadow.mapSize.set(SHADOW_N, SHADOW_N); caster.shadow.bias = -0.004; caster.shadow.normalBias = 0.03;
caster.shadow.camera.near = 0.25; caster.shadow.camera.layers.set(FIRE_LAYER); caster.shadow.autoUpdate = false;
export const FIRE_SHADOW = { on: caster.castShadow, frame: 0, at: new THREE.Vector3(1e9, 0, 0), warm: false, found: 0, moving: [], stir: false };
const _s = new THREE.Sphere(), _p = new THREE.Vector3();
function findCasters() {
  const P = caster.position, R = caster.distance; FIRE_SHADOW.moving.length = 0;
  scene.traverse((o) => {
    if (!o.isMesh || !o.castShadow || (o.isInstancedMesh && !o.frustumCulled)) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    _s.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld); if (_s.center.distanceTo(P) > R + _s.radius) return;
    o.layers.enable(FIRE_LAYER); if (o.isSkinnedMesh) FIRE_SHADOW.moving.push(o);
  });
}
// (whether anything that moves stands within the fire's reach now)
const stirring = () => FIRE_SHADOW.moving.some((o) => o.visible && _p.setFromMatrixPosition(o.matrixWorld).distanceTo(caster.position) < caster.distance + 1);
// (settings.js: on for High and Ultra)
export function setFireShadow(on) { if (caster.castShadow === on) return; caster.castShadow = FIRE_SHADOW.on = on; caster.shadow.map?.dispose(); caster.shadow.map = null; FIRE_SHADOW.at.set(1e9, 0, 0); }
// Ask for light this frame (call every frame while lit). decay: how fast it falls off (a fire's 2: bright close by, gone
// some metres out)
export function askLight(pos, intensity, distance = 18, color = 0xffa050, decay = 1.6) { asks.push({ pos, intensity, distance, color, decay, d: pos.distanceToSquared(camera.position) }); }
export function updateLights() {
  asks.sort((a, b) => a.d - b.d);
  pool.forEach((L, i) => { const a = asks[i]; if (!a || a.d > REACH * REACH) { L.intensity = 0; return; } L.position.copy(a.pos); L.intensity = a.intensity; L.distance = a.distance; L.decay = a.decay; L.color.setHex(a.color); });
  // the caster's map: the first time (behind the loading screen, at the camera, so the shadow's shaders for what stands
  // round you are compiled then rather than at the first fire), whenever it moves to another fire, and every other frame
  // while it is lit near you
  if (caster.castShadow) {
    if (!FIRE_SHADOW.warm) { FIRE_SHADOW.warm = true; caster.position.copy(camera.position); caster.distance = 30; findCasters(); caster.shadow.needsUpdate = true; }
    else if (caster.intensity > 0) {
      const moved = caster.position.distanceToSquared(FIRE_SHADOW.at) > 0.01, near = asks[0].d < SHADOW_NEAR * SHADOW_NEAR;
      const stir = near && stirring(), was = FIRE_SHADOW.stir; FIRE_SHADOW.stir = stir;   // (and once more as it stops, so nothing's shadow is left behind)
      caster.shadow.needsUpdate = moved || (stir && (++FIRE_SHADOW.frame & 1) === 0) || (was && !stir); if (moved) FIRE_SHADOW.at.copy(caster.position);
      const now = performance.now(); if (moved || (near && now - FIRE_SHADOW.found > CASTS * 1000)) { FIRE_SHADOW.found = now; findCasters(); }   // (what has come near it since)
    }
  }
  asks.length = 0;
}
