// Fire light. Every point light costs every lit pixel (grass included), so there is one small fixed pool shared by all
// fires, braziers and torches: each frame, sources ask for light and the ones nearest the camera get it. The pool size
// never changes, so shaders never recompile.
// The nearest of them casts shadows (Valheim's night: the hut's posts and the hero throwing long shadows from the fire),
// on High and Ultra: one small cube shadow map, drawn again only every other frame while it is near the camera (the fire
// stays put; only what moves round it changes) and once whenever it moves to another fire. Whether it casts is fixed for
// the visit's preset as far as the shaders go (a light that starts or stops casting recompiles every lit material), so a
// switch to or from Medium changes it at once but costs that one hitch.
import * as THREE from 'three';
import { scene, camera, CONTEXT } from './core.js';
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
// creature, a column) are put on a layer of their own every so often (CASTS), which is all its shadow camera sees, and
// taken off it again once out of reach (left on, every mesh that had ever stood by a fire, a deer that once grazed by
// one, was drawn into all six faces wherever it had gone). The world-wide batches (the trees, the grass, the ground
// cover: one draw for every cell) stay off it: drawn six times over they made each update cost more than the rest of
// the frame. And the faces are drawn from that list alone (CASTERS, core.js), not by walking the whole scene six times:
// some 2,600 objects for each face, for the fifty-odd that stand round a fire.
// Only a light that stays put casts (a fire, a brazier, a stand of torches): the torch in your hand moved the caster
// every frame, and every frame it drew all six faces and searched the scene again. And it keeps its fire while that one
// is lit near you, unless another comes much nearer (KEEP): with the camera turning between two fires of a camp it
// swapped from one to the other and back, each swap all six faces again.
const SHADOW_N = ULTRA ? 512 : 256, SHADOW_NEAR = 40, FIRE_LAYER = 7, CASTS = 0.5, KEEP = 1.3 * 1.3, caster = pool[0];
caster.castShadow = BOOT_GFX === 'high' || ULTRA; caster.shadow.mapSize.set(SHADOW_N, SHADOW_N); caster.shadow.bias = -0.004; caster.shadow.normalBias = 0.03;
caster.shadow.camera.near = 0.25; caster.shadow.camera.layers.set(FIRE_LAYER); caster.shadow.autoUpdate = false;
// (updates: how many times its map has been drawn, for the performance overlay and the tests)
export const FIRE_SHADOW = { on: caster.castShadow, frame: 0, at: new THREE.Vector3(1e9, 0, 0), warm: false, found: 0, moving: [], stir: false, updates: 0, casters: 0 };
// the casters' list as the shadow pass walks it: a stand-in root whose children are the meshes found (never added to it,
// so they keep their own parents), each checked before every update that it is still in the scene and shown
const CASTERS = new THREE.Object3D(); CASTERS.layers.enableAll(); caster.shadow.casters = CASTERS;
let found = new Set(), prior = new Set();
CONTEXT.restored.push(() => FIRE_SHADOW.at.set(1e9, 0, 0));   // (a lost context: the map drawn again)
const _s = new THREE.Sphere(), _p = new THREE.Vector3();
function findCasters() {
  const P = caster.position, R = caster.distance; FIRE_SHADOW.moving.length = 0; [prior, found] = [found, prior]; found.clear();
  scene.traverse((o) => {
    if (!o.isMesh || !o.castShadow || (o.isInstancedMesh && !o.frustumCulled)) return;
    // (an instanced mesh by the ball round all its instances: its geometry's own is one instance's, at the world's middle,
    // so every instanced mesh in the game was 'by' any fire built near the spawn)
    const inst = o.boundingSphere !== undefined; if (inst ? !o.boundingSphere : !o.geometry.boundingSphere) inst ? o.computeBoundingSphere() : o.geometry.computeBoundingSphere();
    _s.copy(inst ? o.boundingSphere : o.geometry.boundingSphere).applyMatrix4(o.matrixWorld); if (_s.center.distanceTo(P) > R + _s.radius) return;
    o.layers.enable(FIRE_LAYER); found.add(o); if (o.isSkinnedMesh) FIRE_SHADOW.moving.push(o);
  });
  for (const o of prior) if (!found.has(o)) o.layers.disable(FIRE_LAYER); prior.clear();
}
// (the list for this update: what is still in the scene and shown, and not inside another found one, whose walk reaches it)
function listCasters() {
  const list = CASTERS.children; list.length = 0;
  for (const o of found) { let p = o.parent, ok = o.visible; for (; p && ok; p = p.parent) { if (!p.visible || found.has(p)) ok = false; if (p === scene) break; } if (ok && p === scene) list.push(o); }
  FIRE_SHADOW.casters = list.length;
}
// The warm-up at load (main.js warmUp): a stand-in of every material in the game drawn once into the fire's map, so the
// shadow's own shaders for each (plain, instanced, cut out by a leaf's or a fern's picture) are made then. Only what stood
// round the camera at load was drawn before, and the first fire you came to linked three programs mid-play (the hero's
// own, skinned, among them: the hero wasn't in yet when that first draw was made). Returns the way back, for after it.
export function warmFireShadow(...groups) {
  if (!caster.castShadow) return null;
  const list = [], keep = { at: caster.position.clone(), d: caster.distance };
  // (on the fire's layer alone for that draw, so the frame's own picture doesn't draw them: that sent every texture of
  // every stand-in to the card, 130 MB, for things you may never meet)
  for (const group of groups) group.traverse((o) => { if (o.isMesh) { o.userData.warm = [o.castShadow, o.layers.mask]; o.castShadow = true; o.layers.set(FIRE_LAYER); list.push(o); } });
  CASTERS.children = list; caster.position.copy(camera.position); caster.distance = 1e4; caster.shadow.needsUpdate = true;   // (its faces reaching all of them: none culled)
  return () => { for (const o of list) { [o.castShadow, o.layers.mask] = o.userData.warm; delete o.userData.warm; } CASTERS.children = []; caster.position.copy(keep.at); caster.distance = keep.d; FIRE_SHADOW.at.set(1e9, 0, 0); };
}
// (whether anything that moves stands within the fire's reach now)
const stirring = () => FIRE_SHADOW.moving.some((o) => o.visible && _p.setFromMatrixPosition(o.matrixWorld).distanceTo(caster.position) < caster.distance + 1);
// (settings.js: on for High and Ultra)
export function setFireShadow(on) { if (caster.castShadow === on) return; caster.castShadow = FIRE_SHADOW.on = on; caster.shadow.map?.dispose(); caster.shadow.map = null; FIRE_SHADOW.at.set(1e9, 0, 0); }
// Ask for light this frame (call every frame while lit). decay: how fast it falls off (a fire's 2: bright close by, gone
// some metres out); still: false for a light that moves or flashes for a moment (the torch in your hand, a boss's fire),
// which never casts the fire's shadows
export function askLight(pos, intensity, distance = 18, color = 0xffa050, decay = 1.6, still = true) { asks.push({ pos, intensity, distance, color, decay, still, d: pos.distanceToSquared(camera.position) }); }
const R2 = REACH * REACH, light = (L, a) => { if (!a || a.d > R2) { L.intensity = 0; return; } L.position.copy(a.pos); L.intensity = a.intensity; L.distance = a.distance; L.decay = a.decay; L.color.setHex(a.color); };
export function updateLights() {
  asks.sort((a, b) => a.d - b.d);
  // the caster's fire (see above), then the rest of the pool to the nearest of what is left
  let c = null;
  if (caster.castShadow) { for (const a of asks) if (a.still) { c = a; break; }
    if (c) for (const a of asks) if (a.still && a !== c && a.d < c.d * KEEP && a.d < R2 && a.pos.distanceToSquared(FIRE_SHADOW.at) < 0.01) { c = a; break; } }
  let j = 0; for (const L of pool) { if (L === caster && caster.castShadow) { light(L, c); continue; } while (asks[j] && asks[j] === c) j++; light(L, asks[j++]); }
  // the caster's map: the first time (behind the loading screen, at the camera, so the shadow's shaders for what stands
  // round you are compiled then rather than at the first fire), whenever it moves to another fire, and every other frame
  // while it is lit near you
  if (caster.castShadow) {
    if (!FIRE_SHADOW.warm) { FIRE_SHADOW.warm = true; caster.position.copy(camera.position); caster.distance = 30; findCasters(); listCasters(); caster.shadow.needsUpdate = true; }
    else if (caster.intensity > 0) {
      const moved = caster.position.distanceToSquared(FIRE_SHADOW.at) > 0.01, near = c.d < SHADOW_NEAR * SHADOW_NEAR;
      const stir = near && stirring(), was = FIRE_SHADOW.stir; FIRE_SHADOW.stir = stir;   // (and once more as it stops, so nothing's shadow is left behind)
      caster.shadow.needsUpdate = moved || (stir && (++FIRE_SHADOW.frame & 1) === 0) || (was && !stir); if (moved) FIRE_SHADOW.at.copy(caster.position);
      const now = performance.now(); if (moved || (near && now - FIRE_SHADOW.found > CASTS * 1000)) { FIRE_SHADOW.found = now; findCasters(); }   // (what has come near it since)
    }
    if (caster.shadow.needsUpdate) { listCasters(); FIRE_SHADOW.updates++; }
  }
  asks.length = 0;
}
