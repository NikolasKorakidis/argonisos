// Argonisos — Island Prologue (three.js playtest prototype)
// Single-module game: world gen, characters, survival, combat, crafting, quests, sailing ending.
import * as THREE from 'three';
import { FBXLoader } from './jsm/loaders/FBXLoader.js';
import { Water } from './jsm/objects/Water.js';
import { Sky } from './jsm/objects/Sky.js';
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from './jsm/postprocessing/ShaderPass.js';
import { OutputPass } from './jsm/postprocessing/OutputPass.js';
import { VignetteShader } from './jsm/shaders/VignetteShader.js';

// ============================================================
// Utilities
// ============================================================
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
let seed = 1337;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const rr = (a, b) => a + rand() * (b - a);

// Value noise + fBm for the island heightmap
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(hash(xi, zi), hash(xi + 1, zi), u), lerp(hash(xi, zi + 1), hash(xi + 1, zi + 1), u), v);
}
function fbm(x, z) { let a = 0.5, f = 1, s = 0; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); f *= 2; a *= 0.5; } return s; }

const ISLAND_R = 95;
const RUINS = new THREE.Vector3(0, 0, -52);
function heightAt(x, z) {
  const d = Math.hypot(x, z * 1.1) / ISLAND_R;
  let h = (1 - d * d) * 10 + (fbm(x * 0.035 + 10, z * 0.035) - 0.5) * 9 - 1.2;
  h -= Math.max(0, d - 0.92) * 40;                   // steep drop into the sea
  const rd = Math.hypot(x - RUINS.x, z - RUINS.z);      // flattened hill for the ruins
  if (rd < 16) h = lerp(11, h, clamp((rd - 10) / 6, 0, 1));
  return h;
}

// ============================================================
// Renderer / scene
// ============================================================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9cc8e8, 140, 950);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 3000);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6a7a3a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffdca0, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 220 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
scene.add(sun, sun.target);

// ============================================================
// Graphics: procedural textures, physical sky, image-based reflections, post-processing
// ============================================================
// Tileable value noise on a canvas (period-wrapped so textures repeat seamlessly)
function tileNoise(size, period, octaves, seedOff = 0) {
  const h = (x, z) => { x = ((x % period) + period) % period; z = ((z % period) + period) % period; return hash(x + seedOff, z - seedOff); };
  const f = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let a = 0.5, fr = 1, v = 0;
    for (let o = 0; o < octaves; o++) {
      const px = (x / size) * period * fr, pz = (y / size) * period * fr, P = period * fr;
      const xi = Math.floor(px), zi = Math.floor(pz), xf = px - xi, zf = pz - zi, u = xf * xf * (3 - 2 * xf), w = zf * zf * (3 - 2 * zf);
      const hh = (i, j) => { const X = ((i % P) + P) % P, Z = ((j % P) + P) % P; return hash(X + seedOff * 3 + o * 17, Z + o * 31); };
      v += a * lerp(lerp(hh(xi, zi), hh(xi + 1, zi), u), lerp(hh(xi, zi + 1), hh(xi + 1, zi + 1), u), w);
      a *= 0.5; fr *= 2;
    }
    f[y * size + x] = v;
  }
  void h; return f;
}
function canvasTex(size, fill, repeat) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size); fill(img.data); g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat, repeat);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
// Water ripple normal map from a height field
const waterNormals = (() => {
  const N = 256, hf = tileNoise(N, 8, 4, 7);
  const t = canvasTex(N, (d) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, hx = hf[y * N + ((x + 1) % N)] - hf[y * N + ((x - 1 + N) % N)], hz = hf[((y + 1) % N) * N + x] - hf[((y - 1 + N) % N) * N + x];
      const nx = -hx * 6, nz = -hz * 6, l = Math.hypot(nx, nz, 1);
      d.set([(nx / l * 0.5 + 0.5) * 255, (nz / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255, 255], i * 4);
    }
  });
  return t;
})();
// Ground detail: soft mottling that breaks up the flat colours
const groundDetail = (() => {
  const N = 256, hf = tileNoise(N, 16, 5, 3);
  const t = canvasTex(N, (d) => { for (let i = 0; i < N * N; i++) { const v = 200 + hf[i] * 55; d.set([v, v, v, 255], i * 4); } }, 60);
  t.colorSpace = THREE.SRGBColorSpace; return t;
})();

// Physical sky (Rayleigh/Mie scattering) + a copy used to build reflection lighting
const sky = new Sky(); sky.scale.setScalar(2500); scene.add(sky);
sky.material.uniforms.turbidity.value = 2.6;
sky.material.uniforms.rayleigh.value = 2.2; sky.material.uniforms.mieCoefficient.value = 0.004; sky.material.uniforms.mieDirectionalG.value = 0.85;
const sunDir = new THREE.Vector3(0, 1, 0);
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene(); const envSky = new Sky(); envSky.material = sky.material; envSky.scale.setScalar(1000); envScene.add(envSky);
let envRT = null, envTimer = 0;
function refreshEnvironment() {
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene, 0.04); scene.environment = envRT.texture;
}
const GFX = { high: true };

// Material helpers: flat-shaded world, smooth "Pixar" characters
const flatMats = {};
const flat = (c) => flatMats[c] || (flatMats[c] = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9 }));
const smooth = (c, r = 0.55) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m); return m;
}

// ============================================================
// Terrain + sea + sky dressing
// ============================================================
{
  const size = 260, seg = 150;
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, cols = [];
  const cSand = new THREE.Color(0xe3cf98), cGrass = new THREE.Color(0x4f6e2a), cGrass2 = new THREE.Color(0x3b5822), cDry = new THREE.Color(0x8a8a3c), cRock = new THREE.Color(0x9a8f80), cDeep = new THREE.Color(0xb8a676);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z); pos.setY(i, h);
    let c;
    if (h < 0) c = cDeep; else if (h < 1.3) c = cSand;
    else if (h > 12.5) c = cRock;
    else { c = cGrass.clone().lerp(cGrass2, fbm(x * 0.08, z * 0.08)); c.lerp(cDry, clamp((fbm(x * 0.03 + 9, z * 0.03 - 4) - 0.5) * 2.5, 0, 0.6)); }
    const j = 0.93 + hash(x, z) * 0.1; cols.push(c.r * j, c.g * j, c.b * j);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const t = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.95, map: groundDetail, envMapIntensity: 0.4 }));
  t.receiveShadow = true; scene.add(t);
}
// Reflective sea (planar mirror + animated ripple normals). Low-quality mode swaps in a plain plane.
const water = new Water(new THREE.PlaneGeometry(2400, 2400), {
  textureWidth: 1024, textureHeight: 1024, waterNormals, sunDirection: new THREE.Vector3(0, 1, 0),
  sunColor: 0xfff1d6, waterColor: 0x14708f, distortionScale: 2.2, fog: true,
});
water.rotation.x = -Math.PI / 2; water.position.y = -0.15; water.material.uniforms.size.value = 3; scene.add(water);
const waterLow = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x1f6f96, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.88 }));
waterLow.position.y = -0.15; waterLow.visible = false; scene.add(waterLow);

// Greece on the horizon: rugged low-poly ranges with snow caps, visible from the first minute
{
  const land = new THREE.Group();
  const cols = [0x5f7a8f, 0x6b8499, 0x7890a3, 0x566f63];
  const peak = (r, h, x, z, col, snow) => {
    const g = new THREE.IcosahedronGeometry(1, 1), a = g.attributes.position;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i); const k = 0.85 + hash(a.getX(i) * 7 + x, a.getZ(i) * 7 + z) * 0.35;
      a.setXYZ(i, a.getX(i) * r * k, Math.max(y, -0.2) * h * (y > 0.6 ? 1.15 : 1), a.getZ(i) * r * k);
    }
    g.computeVertexNormals();
    const m = mesh(g, flat(col), x, 0, z, land); m.castShadow = false; m.receiveShadow = false;
    if (snow) { const c = mesh(new THREE.ConeGeometry(r * 0.3, h * 0.3, 6), flat(0xeef2f6), x, h * 0.86, z, land); c.castShadow = false; }
  };
  for (let i = 0; i < 14; i++) { const h = rr(50, 130); peak(rr(45, 85), h, rr(-420, 420), rr(-10, 60), cols[i % 4], h > 95); }
  for (let i = 0; i < 10; i++) peak(rr(50, 90), rr(18, 35), rr(-380, 380), rr(-60, -20), 0x5c7a4e, false);   // green foothills in front
  land.position.z = 640; scene.add(land);
}
// Clouds
const clouds = [];
for (let i = 0; i < 18; i++) {
  const c = new THREE.Group();
  for (let k = 0; k < 4; k++) mesh(new THREE.IcosahedronGeometry(rr(4, 8), 0), flat(0xffffff), k * 5 - 8, rr(-1, 2), rr(-3, 3), c).castShadow = false;
  c.position.set(rr(-300, 300), rr(85, 115), rr(-300, 300)); scene.add(c); clouds.push(c);
}

// ============================================================
// Colliders & world objects
// ============================================================
const colliders = [];  // {x,z,r,alive:()=>bool}
const resources = [];  // trees / rocks (hit with swings)
const pickups = [];    // E-interactables: branches, pebbles, bushes, reeds, chest
function landSpot(minH, maxH, avoid = []) {
  for (let i = 0; i < 200; i++) {
    const x = rr(-90, 90), z = rr(-90, 90), h = heightAt(x, z);
    if (h < minH || h > maxH) continue;
    if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r)) continue;
    return new THREE.Vector3(x, h, z);
  }
  return null;
}

// Find beach on the south side (facing Greece) for the dock
const DOCK = new THREE.Vector3();
for (let r = 40; r < 120; r += 0.5) { if (heightAt(0, r) < 0.2) { DOCK.set(0, 0, r); break; } }
const START = new THREE.Vector3(6, 0, DOCK.z - 14); START.y = heightAt(START.x, START.z);
const HUT = new THREE.Vector3(-12, 0, DOCK.z - 26); HUT.y = heightAt(HUT.x, HUT.z);
const AVOID = [{ x: HUT.x, z: HUT.z, r: 12 }, { x: RUINS.x, z: RUINS.z, r: 16 }, { x: DOCK.x, z: DOCK.z, r: 12 }, { x: START.x, z: START.z, r: 5 }];

// --- Trees (from nature concept sheet: oak, pine, birch, cypress) ---
const trunkMat = flat(0x7a4f2c), birchMat = flat(0xe9e2d2);
const leafMats = {};
const leafMat = (c) => leafMats[c] || (leafMats[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
function canopy(g, cx, cy, cz, count, spread, rMin, rMax, color, stretchY = 1) {
  const centre = new THREE.Vector3(cx, cy, cz);
  for (let i = 0; i < count; i++) {
    const r = rr(rMin, rMax), pos = new THREE.Vector3(cx + rr(-spread, spread), cy + rr(-spread, spread) * 0.7 * stretchY, cz + rr(-spread, spread));
    const geo = new THREE.IcosahedronGeometry(r, 2), a = geo.attributes.position, nrm = geo.attributes.normal, v = new THREE.Vector3();
    for (let k = 0; k < a.count; k++) { v.fromBufferAttribute(a, k).add(pos).sub(centre); v.y /= stretchY; v.normalize(); nrm.setXYZ(k, v.x, v.y, v.z); }
    const tint = new THREE.Color(color).offsetHSL(rr(-0.015, 0.015), rr(-0.05, 0.05), rr(-0.04, 0.04));
    mesh(geo, leafMat(tint.getHex()), pos.x, pos.y, pos.z, g);
  }
}
function makeTree(kind) {
  const g = new THREE.Group(); const s = rr(0.8, 1.25);
  if (kind === 'pine') {
    mesh(new THREE.CylinderGeometry(0.2, 0.35, 2, 6), trunkMat, 0, 1, 0, g);
    for (let i = 0; i < 4; i++) mesh(new THREE.ConeGeometry(2.1 - i * 0.45, 2.2, 9), leafMat(0x2f5a33), 0, 2.2 + i * 1.05, 0, g);
  } else if (kind === 'cypress') {
    mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.4, 6), trunkMat, 0, 0.7, 0, g);
    canopy(g, 0, 3.2, 0, 9, 0.4, 0.55, 0.8, 0x3f6a2e, 2.6);
  } else {
    const birch = kind === 'birch';
    mesh(new THREE.CylinderGeometry(0.25, 0.42, 2.6, 6), birch ? birchMat : trunkMat, 0, 1.3, 0, g);
    const leaf = birch ? (rand() < 0.35 ? 0xe0922e : 0x9fb23e) : (rand() < 0.5 ? 0x5a8a32 : 0x4c7a2c);
    canopy(g, 0, 3.7, 0, 7, 0.95, 0.9, 1.35, leaf);
  }
  g.scale.setScalar(s); g.rotation.y = rr(0, 6.28); return g;
}
for (let i = 0; i < 150; i++) {
  const p = landSpot(1.8, 13, AVOID); if (!p) continue;
  const kinds = ['oak', 'pine', 'birch', 'cypress'];
  const g = makeTree(kinds[Math.floor(rand() * 4)]); g.position.copy(p); scene.add(g);
  const res = { type: 'tree', obj: g, hp: 8, max: 8, alive: true, pos: p, r: 0.7, fall: 0 };
  resources.push(res); colliders.push({ x: p.x, z: p.z, r: 0.7, ref: res });
}
// --- Rocks ---
const rockMat = flat(0x9b958c);
for (let i = 0; i < 45; i++) {
  const p = landSpot(0.8, 14, AVOID); if (!p) continue;
  const g = new THREE.Group();
  const main = mesh(new THREE.DodecahedronGeometry(rr(0.9, 1.5), 0), rockMat, 0, 0.5, 0, g); main.scale.y = rr(0.6, 1);
  mesh(new THREE.DodecahedronGeometry(0.4, 0), rockMat, rr(0.8, 1.3), 0.15, rr(-0.5, 0.5), g);
  g.rotation.y = rr(0, 6.28); g.position.copy(p); scene.add(g);
  const res = { type: 'rock', obj: g, hp: 8, max: 8, alive: true, pos: p, r: 1.2 };
  resources.push(res); colliders.push({ x: p.x, z: p.z, r: 1.2, ref: res });
}
// --- Ground pickups ---
function addPickup(kind, p, build, extra = {}) {
  const obj = build(); obj.position.copy(p); scene.add(obj);
  const pk = { kind, obj, pos: p, alive: true, regrow: 0, ...extra }; pickups.push(pk); return pk;
}
const branch = () => { const g = new THREE.Group(); const m = mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.3, 5), trunkMat, 0, 0.08, 0, g); m.rotation.z = Math.PI / 2; m.rotation.y = rr(0, 3); return g; };
const pebble = () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) mesh(new THREE.DodecahedronGeometry(0.16, 0), rockMat, rr(-0.25, 0.25), 0.1, rr(-0.25, 0.25), g); return g; };
function bush() {
  const g = new THREE.Group(); const berries = new THREE.Group();
  for (let i = 0; i < 3; i++) mesh(new THREE.IcosahedronGeometry(rr(0.5, 0.75), 0), flat(0x55803a), rr(-0.4, 0.4), 0.45, rr(-0.4, 0.4), g);
  for (let i = 0; i < 7; i++) mesh(new THREE.SphereGeometry(0.08, 6, 4), flat(0xc42f3a), rr(-0.6, 0.6), rr(0.4, 0.95), rr(-0.6, 0.6), berries);
  g.add(berries); g.userData.berries = berries; return g;
}
function reeds() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) { const r = mesh(new THREE.ConeGeometry(0.05, rr(1, 1.6), 3), flat(0x8a9a4a), rr(-0.3, 0.3), 0.6, rr(-0.3, 0.3), g); r.rotation.z = rr(-0.2, 0.2); }
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 5), flat(0x6b4a2e), 0, 1.3, 0, g);
  return g;
}
for (let i = 0; i < 45; i++) { const p = landSpot(1.2, 12, AVOID); if (p) addPickup('branch', p, branch); }
for (let i = 0; i < 40; i++) { const p = landSpot(0.4, 12, AVOID); if (p) addPickup('pebble', p, pebble); }
for (let i = 0; i < 40; i++) { const p = landSpot(1.5, 11, AVOID); if (p) addPickup('bush', p, bush); }
for (let i = 0; i < 30; i++) { const p = landSpot(0.15, 1.2, AVOID); if (p) addPickup('reeds', p, reeds); }
// A few starter materials right at the wake-up spot, so the first minute teaches pickup
for (let i = 0; i < 3; i++) { const p = START.clone().add(new THREE.Vector3(rr(-4, 4), 0, rr(-5, -2))); p.y = heightAt(p.x, p.z); addPickup(i < 2 ? 'branch' : 'pebble', p, i < 2 ? branch : pebble); }

// --- Grass & flowers: instanced, swaying in the wind ---
const windUniform = { value: 0 };
function windify(mat, strength) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windUniform;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 ip = instanceMatrix[3];
      float bend = pow(max(position.y, 0.0) * 2.0, 2.0) * ${strength.toFixed(3)};
      transformed.x += sin(uWind * 1.7 + ip.x * 0.35 + ip.z * 0.2) * bend;
      transformed.z += cos(uWind * 1.3 + ip.z * 0.3) * bend * 0.6;`);
  };
  return mat;
}
// Grass carpet that travels with the player (the "infinite grass" technique):
// blades live in a T×T tile that wraps around the player; height/mask/colour come from a baked heightmap texture.
const grassU = { uWind: windUniform, uCenter: { value: new THREE.Vector2() }, uTile: { value: 56 }, uHeight: { value: null },
  uBaseA: { value: new THREE.Color(0x2f4a1c) }, uBaseB: { value: new THREE.Color(0x45581f) },
  uTipA: { value: new THREE.Color(0x9cc14a) }, uTipB: { value: new THREE.Color(0xd9c46a) } };
{
  const N = 256, W = 260, data = new Uint16Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i + 0.5) / N * W - W / 2, z = (j + 0.5) / N * W - W / 2, h = heightAt(x, z);
    let mask = clamp((h - 1.3) / 0.6, 0, 1) * clamp((12.5 - h) / 1, 0, 1);
    mask *= clamp((Math.hypot(x - RUINS.x, z - RUINS.z) - 10) / 2, 0, 1) * clamp((Math.hypot(x - HUT.x, z - HUT.z) - 4) / 1.5, 0, 1);
    mask *= clamp((fbm(x * 0.05 + 3, z * 0.05) - 0.3) / 0.08, 0, 1);            // natural bare patches
    const k = (j * N + i) * 4;
    data[k] = THREE.DataUtils.toHalfFloat(h); data[k + 1] = THREE.DataUtils.toHalfFloat(mask);
    data[k + 2] = THREE.DataUtils.toHalfFloat(fbm(x * 0.03 + 9, z * 0.03 - 4)); data[k + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true; grassU.uHeight.value = tex;

  const H = 0.42, blade = new THREE.PlaneGeometry(0.075, H, 1, 4); blade.translate(0, H / 2, 0);
  const bp = blade.attributes.position; for (let i = 0; i < bp.count; i++) bp.setX(i, bp.getX(i) * (1 - Math.pow(bp.getY(i) / H, 1.5)));
  const COUNT = 95000, T = grassU.uTile.value;
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, grassU);
    sh.vertexShader = `uniform float uWind, uTile; uniform vec2 uCenter; uniform sampler2D uHeight; varying float vGH, vVar;\n` + sh.vertexShader
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')   // soft, uniform lighting like a painted field
      .replace('#include <begin_vertex>', `
        vec3 ip = instanceMatrix[3].xyz;
        vec2 wp = ip.xz + uTile * floor((uCenter - ip.xz) / uTile + 0.5);
        vec4 hm = texture2D(uHeight, (wp + 130.0) / 260.0);
        float rnd = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
        float fade = 1.0 - smoothstep(0.72, 1.0, length(wp - uCenter) / (uTile * 0.5));
        float sc = hm.g * fade * (0.65 + rnd * 0.8);
        vec3 p = position; p.y *= sc; p.x *= step(0.01, sc);
        float a = rnd * 6.2831; p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
        float gh = position.y / ${H.toFixed(2)};
        float gust = sin(uWind * 0.6 + wp.x * 0.05) * 0.5 + 0.5;
        float bend = gh * gh * sc * (0.07 + gust * 0.1);
        p.x += sin(uWind * 1.9 + wp.x * 0.35 + wp.y * 0.22) * bend;
        p.z += cos(uWind * 1.5 + wp.y * 0.3) * bend * 0.7;
        vec3 transformed = p + vec3(wp.x, hm.r - 0.03, wp.y) - ip;
        vGH = gh; vVar = hm.b;`);
    sh.fragmentShader = `uniform vec3 uBaseA, uBaseB, uTipA, uTipB; varying float vGH, vVar;\n` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float v = smoothstep(0.35, 0.7, vVar);
        diffuseColor.rgb = mix(mix(uBaseA, uBaseB, v), mix(uTipA, uTipB, v * 0.8), smoothstep(0.0, 1.0, vGH));`);
  };
  const grass = new THREE.InstancedMesh(blade, mat, COUNT), gm = new THREE.Matrix4();
  for (let i = 0; i < COUNT; i++) grass.setMatrixAt(i, gm.makeTranslation(rr(0, T), 0, rr(0, T)));
  grass.frustumCulled = false; grass.receiveShadow = true; scene.add(grass);
  const m2 = new THREE.Matrix4(), col = new THREE.Color(); let n = 0;
  // Wildflowers (white, yellow, purple, red) from the plants concept sheet
  const petal = new THREE.IcosahedronGeometry(0.07, 0); petal.translate(0, 0.38, 0);
  const stem = new THREE.CylinderGeometry(0.01, 0.01, 0.38, 3); stem.translate(0, 0.19, 0);
  const FL = 3500, flowers = new THREE.InstancedMesh(petal, windify(new THREE.MeshStandardMaterial({ roughness: 0.6 }), 0.06), FL);
  const stems = new THREE.InstancedMesh(stem, windify(new THREE.MeshStandardMaterial({ color: 0x4e7a2e }), 0.06), FL);
  const fcols = [0xf4f1e6, 0xf3c83a, 0x9c6cc9, 0xd2463f, 0xf29ab8]; n = 0;
  const m = m2;
  for (let i = 0; i < FL * 4 && n < FL; i++) {
    const x = rr(-90, 90), z = rr(-90, 90), h = heightAt(x, z);
    if (h < 1.8 || h > 11 || fbm(x * 0.09, z * 0.09 + 5) < 0.55) continue;
    m.makeTranslation(x, h - 0.02, z); flowers.setMatrixAt(n, m); stems.setMatrixAt(n, m);
    flowers.setColorAt(n, col.setHex(fcols[Math.floor(rand() * fcols.length)])); n++;
  }
  flowers.count = stems.count = n; flowers.frustumCulled = stems.frustumCulled = false; scene.add(flowers, stems);
}

// --- Nestor's hut (small house from the buildings sheet) ---
{
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(6, 3.2, 5), flat(0xefe4cf), 0, 1.6, 0, g);
  mesh(new THREE.BoxGeometry(6.3, 0.4, 5.3), flat(0x9a8f80), 0, 0.2, 0, g);
  const roof = mesh(new THREE.CylinderGeometry(0.01, 4.4, 2.4, 4, 1), flat(0xc9643a), 0, 4.4, 0, g); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.85);
  mesh(new THREE.BoxGeometry(0.8, 2, 0.8), flat(0xd8d0c0), 1.8, 5, -0.8, g);
  mesh(new THREE.BoxGeometry(1.2, 2, 0.15), flat(0x6b4a2e), 0, 1, 2.52, g);
  mesh(new THREE.BoxGeometry(0.9, 0.8, 0.15), flat(0x3a2a1a), -1.9, 1.9, 2.52, g);
  mesh(new THREE.BoxGeometry(0.9, 0.8, 0.15), flat(0x3a2a1a), 1.9, 1.9, 2.52, g);
  for (const x of [-2.9, 2.9]) mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), flat(0x6b4a2e), x, 1.6, 2.55, g);
  const awning = mesh(new THREE.BoxGeometry(2.6, 0.08, 1.8), flat(0xe8d7a0), 2.4, 2.6, 3.3, g); awning.rotation.x = 0.25;
  mesh(new THREE.BoxGeometry(1.6, 0.5, 0.5), flat(0x7a4f2c), -2, 0.35, 3.4, g);  // bench
  g.position.copy(HUT); g.position.y -= 0.2; g.rotation.y = 0.3; scene.add(g);
  colliders.push({ x: HUT.x, z: HUT.z, r: 3.6 });
}
// Chimney smoke
const smoke = [];
for (let i = 0; i < 6; i++) {
  const s = mesh(new THREE.IcosahedronGeometry(0.4, 0), new THREE.MeshStandardMaterial({ color: 0x777777, transparent: true, opacity: 0.5, flatShading: true }), 0, 0, 0);
  s.castShadow = false; s.userData.t = i / 6; scene.add(s); smoke.push(s);
}
const CHIMNEY = new THREE.Vector3(1.8, 6, -0.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.3).add(HUT);

// --- Ruins (columns, blocks, chest) ---
const ruinsGroup = new THREE.Group();
{
  const stone = flat(0xd8cfbd);
  mesh(new THREE.CylinderGeometry(9, 9.5, 0.6, 12), flat(0xb9ae98), 0, 0.3, 0, ruinsGroup);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, broken = i % 3 === 1, h = broken ? rr(1.2, 2.5) : 5;
    const x = Math.cos(a) * 7, z = Math.sin(a) * 7;
    mesh(new THREE.CylinderGeometry(0.45, 0.5, h, 10), stone, x, 0.6 + h / 2, z, ruinsGroup);
    colliders.push({ x: RUINS.x + x, z: RUINS.z + z, r: 0.6 });
    if (!broken) mesh(new THREE.BoxGeometry(1.2, 0.35, 1.2), stone, x, 5.75, z, ruinsGroup);
  }
  for (let i = 0; i < 6; i++) { const b = mesh(new THREE.BoxGeometry(rr(1, 2), 0.7, 0.8), stone, rr(-8, 8), 0.8, rr(-8, 8), ruinsGroup); b.rotation.y = rr(0, 3); }
  ruinsGroup.position.set(RUINS.x, 10.7, RUINS.z); scene.add(ruinsGroup);
}
const chestObj = new THREE.Group();
mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), flat(0x7a4f2c), 0, 0.35, 0, chestObj);
const chestLid = mesh(new THREE.BoxGeometry(1.25, 0.25, 0.85), flat(0xb08a3a), 0, 0.8, 0, chestObj);
const chestPos = RUINS.clone().setY(11.3);
const chest = addPickup('chest', chestPos, () => chestObj);
colliders.push({ x: chestPos.x, z: chestPos.z, r: 0.8 });

// --- Old dock & raft site ---
const dockGroup = new THREE.Group();
{
  const wood = flat(0x8a6238);
  for (let i = 0; i < 8; i++) mesh(new THREE.BoxGeometry(3, 0.2, 0.7), wood, 0, 0.5, -4 + i * 0.8, dockGroup);
  for (const x of [-1.4, 1.4]) for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.4, 6), wood, x, 0, -3.8 + i * 2.6, dockGroup);
  dockGroup.position.set(DOCK.x, 0, DOCK.z); scene.add(dockGroup);
}
const RAFT_SITE = DOCK.clone().add(new THREE.Vector3(3.6, 0, 1));
const raftGroup = new THREE.Group(); raftGroup.position.set(RAFT_SITE.x, 0.05, RAFT_SITE.z); scene.add(raftGroup);
const raftParts = [];
{
  const wood = flat(0x9b6e3f);
  for (let i = 0; i < 7; i++) { const l = mesh(new THREE.CylinderGeometry(0.28, 0.28, 5, 7), wood, -1.8 + i * 0.6, 0.15, 0, raftGroup); l.rotation.x = Math.PI / 2; raftParts.push(l); }
  for (const z of [-1.8, 1.8]) { const b = mesh(new THREE.BoxGeometry(4.4, 0.12, 0.25), flat(0xcdb68a), 0, 0.45, z, raftGroup); raftParts.push(b); }
  const mast = mesh(new THREE.CylinderGeometry(0.12, 0.14, 5, 6), wood, 0, 2.8, -0.5, raftGroup); raftParts.push(mast);
  const sail = mesh(new THREE.PlaneGeometry(3, 3.2, 3, 3), new THREE.MeshStandardMaterial({ color: 0xf1e8d4, side: THREE.DoubleSide, flatShading: true }), 0, 3.3, -0.35, raftGroup); raftParts.push(sail);
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshStandardMaterial({ color: 0xb0392e, side: THREE.DoubleSide })); cross.position.set(0, 3.3, -0.33); raftGroup.add(cross); raftParts.push(cross);
  raftParts.forEach((p) => (p.visible = false));
}
// Ghost outline so players see where the raft goes
const raftGhost = mesh(new THREE.BoxGeometry(4.4, 0.3, 5), new THREE.MeshBasicMaterial({ color: 0xe8c27a, wireframe: true, transparent: true, opacity: 0.5 }), RAFT_SITE.x, 0.3, RAFT_SITE.z);
raftGhost.castShadow = false; scene.add(raftGhost);

// ============================================================
// Characters — rounded Pixar-like proportions
// ============================================================
const skinMat = smooth(0xd9a178, 0.6);
function makeEye(parent, x, y, z, s = 1) {
  const w = mesh(new THREE.SphereGeometry(0.075 * s, 16, 12), smooth(0xffffff, 0.2), x, y, z, parent);
  const p = mesh(new THREE.SphereGeometry(0.045 * s, 12, 10), smooth(0x2a1a10, 0.1), 0, 0, 0.045 * s, w);
  mesh(new THREE.SphereGeometry(0.014 * s, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.015 * s, 0.018 * s, 0.035 * s, p);
  return w;
}
function makeHumanoid({ tunic = 0xefe7d6, belt = 0x6b4a2e, hair = 0x3b2414, beard = null, skin = skinMat, cape = null, headScale = 1, bald = false } = {}) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0.14 * s, 0.82, 0); body.add(hip);
    mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 10), skin, 0, -0.35, 0, hip);
    mesh(new THREE.CapsuleGeometry(0.1, 0.1, 4, 10), smooth(0x6b4a2e), 0, -0.72, 0.05, hip).rotation.x = Math.PI / 2; // sandal
    legs.push(hip);
    const sh = new THREE.Group(); sh.position.set(0.36 * s, 1.42, 0); body.add(sh);
    mesh(new THREE.CapsuleGeometry(0.075, 0.45, 4, 10), skin, 0, -0.3, 0, sh);
    mesh(new THREE.SphereGeometry(0.09, 12, 10), skin, 0, -0.6, 0, sh);
    arms.push(sh);
  }
  const torso = mesh(new THREE.CapsuleGeometry(0.3, 0.45, 6, 16), smooth(tunic, 0.8), 0, 1.2, 0, body); torso.scale.set(1, 1, 0.75);
  const skirt = mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.35, 16), smooth(tunic, 0.8), 0, 0.85, 0, body); skirt.scale.z = 0.8;
  mesh(new THREE.TorusGeometry(0.29, 0.04, 6, 20), smooth(belt), 0, 1.0, 0, body).rotation.x = Math.PI / 2;
  if (cape) { const c = mesh(new THREE.BoxGeometry(0.6, 0.9, 0.05), smooth(cape, 0.9), 0, 1.15, -0.25, body); c.rotation.x = 0.08; }
  const head = new THREE.Group(); head.position.set(0, 1.85, 0); head.scale.setScalar(headScale); body.add(head);
  mesh(new THREE.SphereGeometry(0.3, 24, 18), skin, 0, 0, 0, head).scale.set(1, 1.05, 0.95);
  mesh(new THREE.SphereGeometry(0.06, 10, 8), skin, 0, -0.02, 0.29, head);         // nose
  for (const s of [-1, 1]) {
    makeEye(head, 0.11 * s, 0.05, 0.24, 1.15);
    mesh(new THREE.BoxGeometry(0.12, 0.025, 0.03), smooth(hair), 0.11 * s, 0.16, 0.27, head).rotation.z = -0.15 * s; // brows
    mesh(new THREE.SphereGeometry(0.06, 10, 8), skin, 0.3 * s, 0, 0, head);        // ears
  }
  mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), smooth(0x7a3a2a), 0, -0.12, 0.26, head).rotation.z = Math.PI; // smile
  if (!bald) { const h = mesh(new THREE.SphereGeometry(0.315, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), smooth(hair, 0.9), 0, 0.03, -0.02, head); h.rotation.x = -0.25; }
  if (beard) { const b = mesh(new THREE.ConeGeometry(0.2, 0.45, 12), smooth(beard, 0.9), 0, -0.3, 0.14, head); b.rotation.x = Math.PI + 0.35; }
  root.userData = { body, legs, arms, head, torso };
  return root;
}
function animateHumanoid(ch, speed, t, swing = 0) {
  const { legs, arms, body } = ch.userData; const a = Math.sin(t * 10) * Math.min(speed / 5, 1) * 0.7;
  legs[0].rotation.x = a; legs[1].rotation.x = -a;
  arms[0].rotation.x = -a * 0.8;
  arms[1].rotation.x = swing > 0 ? -2.4 + (1 - swing) * 3.2 : a * 0.8;
  body.position.y = Math.abs(Math.sin(t * 10)) * 0.05 * Math.min(speed / 5, 1) + Math.sin(t * 2) * 0.01;
}

// Held tools for the hero
function makeTools() {
  const axe = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 6), trunkMat, 0, 0, 0, axe);
  mesh(new THREE.BoxGeometry(0.08, 0.2, 0.25), rockMat, 0, 0.3, 0.1, axe);
  const spear = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 2, 6), trunkMat, 0, 0.3, 0, spear);
  mesh(new THREE.ConeGeometry(0.07, 0.3, 4), rockMat, 0, 1.4, 0, spear);
  for (const t of [axe, spear]) { t.rotation.x = Math.PI / 2; t.position.set(0, -0.62, 0.15); t.visible = false; }
  return { axe, spear };
}

// ============================================================
// Player
// ============================================================
const player = makeHumanoid({ tunic: 0xf1ead9, belt: 0x7a4f2c, hair: 0x3a2412 });
player.position.copy(START); scene.add(player);
const tools = makeTools(); player.userData.arms[1].add(tools.axe, tools.spear);
// Hero model (static FBX, no rig): replaces the procedural body once loaded and gets procedural animation.
const hero = { wrap: new THREE.Group(), model: null, rig: null };
player.add(hero.wrap);
// ---- Auto-rig: the FBX is a static T-pose mesh, so build a skeleton and skin weights in code ----
// Model space: feet at y=0, height 1.95, facing +z. Right side of the character is -x.
function autoRig(obj) {
  obj.updateMatrixWorld(true);
  const meshes = []; obj.traverse((m) => { if (m.isMesh) meshes.push(m); });
  // Gather vertices in model space to find landmarks
  const geos = meshes.map((m) => { const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); return g; });
  const H = 1.95; let X = 0;
  for (const g of geos) { const a = g.attributes.position; for (let i = 0; i < a.count; i++) X = Math.max(X, Math.abs(a.getX(i))); }
  let ay = 0, an = 0;                                                    // arm height = mean y of the outer arm
  for (const g of geos) { const a = g.attributes.position; for (let i = 0; i < a.count; i++) if (Math.abs(a.getX(i)) > X * 0.7) { ay += a.getY(i); an++; } }
  ay /= Math.max(an, 1);
  let torsoW = 0;                                                        // torso half-width just under the armpit
  for (const g of geos) { const a = g.attributes.position; for (let i = 0; i < a.count; i++) { const y = a.getY(i); if (y > ay - 0.34 && y < ay - 0.2) torsoW = Math.max(torsoW, Math.abs(a.getX(i))); } }
  torsoW = Math.min(torsoW, X * 0.45);
  const sx = torsoW - 0.02, ex = sx + (X - sx) * 0.47;                 // shoulder / elbow x
  const hipY = H * 0.47, kneeY = H * 0.25, neckY = ay + 0.14, hipX = 0.11;
  console.log('autoRig', { X: X.toFixed(2), armY: ay.toFixed(2), torsoW: torsoW.toFixed(2) });

  const mk = (name, x, y, z, parent) => { const b = new THREE.Bone(); b.name = name; const wp = new THREE.Vector3(x, y, z); b.userData.wp = wp; if (parent) { b.position.copy(wp).sub(parent.userData.wp); parent.add(b); } else b.position.copy(wp); return b; };
  const B = {};
  B.hips = mk('hips', 0, hipY, 0);
  B.spine = mk('spine', 0, ay - 0.3, 0, B.hips);
  B.head = mk('head', 0, neckY, 0, B.spine);
  for (const [side, sg] of [['L', 1], ['R', -1]]) {
    B['arm' + side] = mk('arm' + side, sg * sx, ay, 0, B.spine);
    B['fore' + side] = mk('fore' + side, sg * ex, ay, 0, B['arm' + side]);
    B['thigh' + side] = mk('thigh' + side, sg * hipX, hipY, 0, B.hips);
    B['shin' + side] = mk('shin' + side, sg * hipX, kneeY, 0, B['thigh' + side]);
  }
  const list = Object.values(B), idx = (b) => list.indexOf(b);
  const sm = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // Two influences per vertex: pick the region, blend with its parent near the joint
  function weigh(x, y) {
    const ax = Math.abs(x), side = x >= 0 ? 'L' : 'R';
    if (ax > sx - 0.05 && Math.abs(y - ay) < 0.22 && y > hipY + 0.2) {      // arm
      const tArm = sm(sx - 0.05, sx + 0.07, ax);
      if (ax > ex - 0.05) { const tf = sm(ex - 0.05, ex + 0.05, ax); return [B['fore' + side], B['arm' + side], tf]; }
      return [B['arm' + side], B.spine, tArm];
    }
    if (y < hipY + 0.04) {                                                  // leg
      const tLeg = sm(hipY + 0.04, hipY - 0.14, y);
      if (y < kneeY + 0.06) { const ts = sm(kneeY + 0.06, kneeY - 0.06, y); return [B['shin' + side], B['thigh' + side], ts]; }
      return [B['thigh' + side], B.hips, tLeg];
    }
    if (y > neckY - 0.04) return [B.head, B.spine, sm(neckY - 0.04, neckY + 0.04, y)];
    return [B.spine, B.hips, sm(hipY, ay - 0.3, y)];
  }
  const root = new THREE.Group(); root.add(B.hips); hero.wrap.add(root);
  const skinned = [];
  meshes.forEach((m, k) => {
    const g = geos[k], a = g.attributes.position, si = [], sw = [];
    for (let i = 0; i < a.count; i++) { const [b1, b2, w] = weigh(a.getX(i), a.getY(i)); si.push(idx(b1), idx(b2), 0, 0); sw.push(w, 1 - w, 0, 0); }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    const sk = new THREE.SkinnedMesh(g, m.material); sk.castShadow = sk.receiveShadow = true; sk.frustumCulled = false;
    hero.wrap.add(sk); skinned.push(sk);
  });
  hero.wrap.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  skinned.forEach((sk) => sk.bind(skeleton));
  return { bones: B, handOffset: new THREE.Vector3(-(X - ex) + 0.06, 0, 0) };
}

// Pose the rig every frame. speed: m/s, ph: gait phase, sw: attack swing 1→0, t: time
function poseHero(speed, ph, sw, t) {
  const B = hero.rig.bones, k = Math.min(speed / 5, 1), run = k > 0.9 ? 1 : k;
  const s = Math.sin(ph), breathe = Math.sin(t * 2) * 0.02;
  // Arms down from the T-pose (rotate about z), then swing about x
  B.armL.rotation.set(-s * 0.55 * run, 0, -1.25 + breathe);
  B.armR.rotation.set(s * 0.55 * run, 0, 1.25 - breathe);
  B.foreL.rotation.set(0, -0.25 - 0.3 * run, 0);
  B.foreR.rotation.set(0, 0.25 + 0.3 * run, 0);
  if (sw > 0) {                                     // overhead chop: raise forward, then strike down
    const a = sw > 0.55 ? lerp(0.4, -2.3, (1 - sw) / 0.45) : lerp(-2.3, 0.6, (0.55 - sw) / 0.55);
    B.armR.rotation.set(a, 0, 1.25); B.foreR.rotation.set(0, 0.2, 0);
    B.spine.rotation.set(sw > 0.55 ? -0.12 : 0.18, sw > 0.55 ? -0.3 : 0.25, 0);
  } else B.spine.rotation.set(0.06 * run + breathe, s * 0.08 * run, 0);
  // Legs: thigh swing, knee bends on the back-swing
  B.thighL.rotation.x = s * 0.7 * run; B.thighR.rotation.x = -s * 0.7 * run;
  B.shinL.rotation.x = Math.max(0, s) * 0.9 * run; B.shinR.rotation.x = Math.max(0, -s) * 0.9 * run;
  B.hips.position.y = B.hips.userData.wp.y + Math.abs(Math.cos(ph)) * 0.05 * run - (1 - Math.abs(Math.cos(ph))) * 0.02 * run;
  B.head.rotation.set(-0.04 * run, -s * 0.06 * run, 0);
}

// Axe model: lies on the ground in front of the start. Pick it up with E, toggle it with 2.
function fixMaterials(obj) {
  obj.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true;
    const mats = [].concat(m.material).map((o) => new THREE.MeshStandardMaterial({ map: o.map || null, normalMap: o.normalMap || null, color: o.map ? 0xffffff : o.color, roughness: 0.7, metalness: 0 }));
    mats.forEach((mt) => { if (mt.map) mt.map.colorSpace = THREE.SRGBColorSpace; });
    m.material = mats.length === 1 ? mats[0] : mats;
  });
}
// Re-orient a prop so its longest axis is +y, the heavy end (head) on top, grip end at y=0, length L
function normalizeHandle(model, L) {
  const wrap = new THREE.Group(), obj = new THREE.Group(); obj.add(model); wrap.add(obj);  // keep the FBX's own axis fix untouched
  obj.updateMatrixWorld(true);
  let size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  if (size.x >= size.y && size.x >= size.z) obj.rotation.z = Math.PI / 2; else if (size.z >= size.y) obj.rotation.x = Math.PI / 2;
  obj.updateMatrixWorld(true); size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  obj.scale.multiplyScalar(L / size.y); obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj), mid = (box.min.y + box.max.y) / 2;
  // Head = the end with the wider spread of vertices
  let top = 0, bot = 0; const v = new THREE.Vector3();
  obj.traverse((m) => { if (!m.isMesh) return; const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i += 3) { v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); const w = Math.hypot(v.x, v.z); if (v.y > mid) top = Math.max(top, w); else bot = Math.max(bot, w); } });
  if (bot > top) { obj.rotation.x += Math.PI; obj.updateMatrixWorld(true); }
  const b2 = new THREE.Box3().setFromObject(obj), c = b2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y;
  return wrap;
}
const groundAxe = new THREE.Group();
{
  const p = START.clone().add(new THREE.Vector3(1.4, 0, -1.8)); p.y = heightAt(p.x, p.z) + 0.08;
  addPickup('axeitem', p, () => groundAxe);
}
loadModelBuffer('axe').then((buf) => new FBXLoader().parse(buf, '')).then((obj) => {
  fixMaterials(obj);
  const held = normalizeHandle(obj, 0.85);
  held.position.y = -0.18;                                    // grip a little above the handle end
  tools.axe.clear(); tools.axe.add(held);
  const ground = held.clone(); ground.position.set(0, 0, 0); ground.rotation.set(0, 0.6, Math.PI / 2);
  ground.position.x = 0.4; groundAxe.add(ground);
}).catch((e) => { console.warn('Axe model failed to load, using placeholder', e); const g = tools.axe.clone(); g.visible = true; g.rotation.set(0, 0, Math.PI / 2); groundAxe.add(g); });

// Try the raw .fbx first (local server); fall back to the base64 module (artifact hosting can't serve .fbx).
async function loadModelBuffer(name) {
  try { const r = await fetch(`models/${name}.fbx`); if (r.ok) return await r.arrayBuffer(); } catch { /* fall through */ }
  const b64 = (await import(`./models/${name}.fbx.js`)).default;
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}
loadModelBuffer('hero').then((buf) => new FBXLoader().parse(buf, '')).then((obj) => {
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
  const s = 1.95 / size.y; obj.scale.setScalar(s);
  const b2 = new THREE.Box3().setFromObject(obj), c = b2.getCenter(new THREE.Vector3());
  obj.position.set(-c.x, -b2.min.y, -c.z);
  obj.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    m.material = mats.map((o) => new THREE.MeshStandardMaterial({ map: o.map || null, normalMap: o.normalMap || null, color: o.map ? 0xffffff : o.color, roughness: 0.75, metalness: 0 }));
    if (m.material.length === 1) m.material = m.material[0];
    for (const mt of [].concat(m.material)) if (mt.map) mt.map.colorSpace = THREE.SRGBColorSpace;
  });
  hero.rig = autoRig(obj); hero.model = obj;
  player.userData.body.visible = false;
  const rf = hero.rig.bones.foreR;   // tools go in the right fist (end of the right forearm)
  for (const t of [tools.axe, tools.spear]) { rf.add(t); t.position.copy(hero.rig.handOffset); t.rotation.set(0.7, 0, -1.25, 'ZYX'); }   // undo the arm's T-pose drop so the tool points forward-up
}).catch((e) => console.warn('Hero model failed to load, keeping placeholder', e));
const P = { vel: new THREE.Vector3(), yaw: Math.PI, onGround: true, swing: 0, swingHit: false, hurtT: 0, animT: 0, dead: false };

// NPC Nestor the hermit (the Elder from the cast sheet)
const nestor = makeHumanoid({ tunic: 0xe9e0cc, belt: 0x6b4a2e, hair: 0xe8e4dc, beard: 0xefebe4, cape: 0x8a3b2b, headScale: 1.05 });
const staff = mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.1, 6), trunkMat, 0, -0.1, 0.1, nestor.userData.arms[0]);
staff.rotation.x = 0.1;
const NESTOR_POS = HUT.clone().add(new THREE.Vector3(3, 0, 5)); NESTOR_POS.y = heightAt(NESTOR_POS.x, NESTOR_POS.z);
nestor.position.copy(NESTOR_POS); scene.add(nestor);

// ============================================================
// Creatures (animals & enemies)
// ============================================================
function makeRabbit() {
  const g = new THREE.Group(), fur = flat(0xb98a5a);
  const b = mesh(new THREE.IcosahedronGeometry(0.3, 1), fur, 0, 0.3, 0, g); b.scale.set(0.8, 0.8, 1.1);
  mesh(new THREE.IcosahedronGeometry(0.2, 1), fur, 0, 0.5, 0.3, g);
  for (const s of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.06, 0.35, 5), fur, 0.07 * s, 0.8, 0.28, g); e.rotation.z = 0.1 * s; makeEye(g, 0.1 * s, 0.55, 0.45, 0.6); }
  mesh(new THREE.IcosahedronGeometry(0.09, 0), flat(0xffffff), 0, 0.35, -0.33, g);
  return g;
}
function makeQuad(color, len, height, { tusks = false, tail = 0x000000, snout = 0.3, ears = true } = {}) {
  const g = new THREE.Group(), fur = flat(color);
  const b = mesh(new THREE.IcosahedronGeometry(0.5, 1), fur, 0, height, 0, g); b.scale.set(0.8 * len, 0.8, 1.4 * len);
  const head = new THREE.Group(); head.position.set(0, height + 0.15, 0.75 * len); g.add(head);
  mesh(new THREE.IcosahedronGeometry(0.28, 1), fur, 0, 0, 0, head);
  const sn = mesh(new THREE.ConeGeometry(0.15, snout, 6), fur, 0, -0.05, 0.25, head); sn.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    makeEye(head, 0.13 * s, 0.08, 0.17, 0.7);
    if (ears) mesh(new THREE.ConeGeometry(0.08, 0.2, 4), fur, 0.14 * s, 0.26, 0, head);
    if (tusks) { const t = mesh(new THREE.ConeGeometry(0.03, 0.15, 4), flat(0xf4ecd8), 0.1 * s, -0.08, 0.35, head); t.rotation.x = -0.8; }
  }
  const legs = [];
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const l = new THREE.Group(); l.position.set(0.22 * x * len, height - 0.1, 0.4 * z * len); g.add(l);
    mesh(new THREE.CylinderGeometry(0.07, 0.06, height, 5), flat(color), 0, -height / 2, 0, l); legs.push(l);
  }
  const tl = mesh(new THREE.ConeGeometry(0.1, 0.5, 5), flat(tail || color), 0, height + 0.1, -0.8 * len, g); tl.rotation.x = -2;
  g.userData.legs = legs; g.userData.head = head; return g;
}
function makeSkeleton() {
  const bone = smooth(0xe9e0c9, 0.7);
  const ch = makeHumanoid({ tunic: 0x6b5238, belt: 0x3a2a1a, skin: bone, bald: true });
  const { torso, head } = ch.userData; torso.scale.set(0.6, 1, 0.5);
  // Hollow eyes: dark spheres over the eye whites
  head.children.filter((c) => c.geometry?.type === 'SphereGeometry' && c.position.z > 0.2 && Math.abs(c.position.x) > 0.05).forEach((e) => { e.material = new THREE.MeshBasicMaterial({ color: 0x100806 }); e.children.forEach((k) => (k.visible = false)); });
  const sword = new THREE.Group(); mesh(new THREE.BoxGeometry(0.06, 0.9, 0.12), smooth(0x9aa3a8, 0.3), 0, 0.5, 0, sword);
  sword.rotation.x = Math.PI / 2; sword.position.set(0, -0.62, 0.1); ch.userData.arms[1].add(sword);
  return ch;
}

const creatures = [];
const TYPES = {
  rabbit: { hp: 10, speed: 5.5, dmg: 0, flee: true, drops: { rawmeat: 1 }, r: 0.4, reach: 0 },
  boar: { hp: 45, speed: 5, dmg: 12, flee: false, retaliate: true, drops: { rawmeat: 2, hide: 1 }, r: 0.8, reach: 1.8 },
  wolf: { hp: 35, speed: 6.2, dmg: 9, hostile: true, drops: { hide: 1, rawmeat: 1 }, r: 0.7, reach: 1.8 },
  skeleton: { hp: 55, speed: 3.4, dmg: 12, hostile: true, drops: {}, r: 0.5, reach: 1.9, aggro: 13 },
};
function spawnCreature(type, pos) {
  let obj;
  if (type === 'rabbit') obj = makeRabbit();
  else if (type === 'boar') obj = makeQuad(0x6e4630, 1.1, 0.55, { tusks: true, snout: 0.3 });
  else if (type === 'wolf') obj = makeQuad(0x77706a, 1.1, 0.7, { tail: 0x8a847c, snout: 0.4 });
  else obj = makeSkeleton();
  obj.position.copy(pos); scene.add(obj);
  const c = { type, obj, def: TYPES[type], hp: TYPES[type].hp, state: 'wander', target: pos.clone(), t: rr(0, 5), atkCd: 0, flash: 0, dead: false, home: pos.clone(), vy: 0 };
  obj.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); } });
  creatures.push(c); return c;
}
for (let i = 0; i < 7; i++) { const p = landSpot(1.5, 10, AVOID); if (p) spawnCreature('rabbit', p); }
for (let i = 0; i < 3; i++) { const p = landSpot(3, 12, AVOID); if (p) spawnCreature('boar', p); }
const skeletons = [];
for (let i = 0; i < 3; i++) { const a = i * 2.1; const p = new THREE.Vector3(RUINS.x + Math.cos(a) * 4, 11, RUINS.z + Math.sin(a) * 4); skeletons.push(spawnCreature('skeleton', p)); }

// ============================================================
// Game state
// ============================================================
const DAY_LEN = 300;  // seconds per in-game day
const S = {
  hp: 100, food: 100, sta: 100, time: 0.3, day: 1, nights: 0, wasNight: false,
  inv: { wood: 0, stone: 0, fiber: 0, berries: 0, rawmeat: 0, meat: 0, hide: 0, rope: 0, sail: 0 },
  tools: { axe: false, spear: false }, slot: 0,
  kills: { rabbit: 0, boar: 0, wolf: 0, skeleton: 0 }, cooked: 0, campfire: null, raftBuilt: false,
  timeScale: 1, running: false, paused: true, talkedNestor: false, sailing: false, questIdx: 0, deaths: 0, nightsAtStart: 0, started: 0,
};
const ICONS = { wood: '🪵', stone: '🪨', fiber: '🌾', berries: '🫐', rawmeat: '🥩', meat: '🍖', hide: '🟫', rope: '🧶', sail: '⛵' };
const NAMES = { wood: 'Wood', stone: 'Stone', fiber: 'Fiber', berries: 'Berries', rawmeat: 'Raw Meat', meat: 'Cooked Meat', hide: 'Hide', rope: 'Rope', sail: 'Sailcloth' };
const isNight = () => S.time < 0.23 || S.time > 0.8;

// ============================================================
// Audio (tiny WebAudio blips, no assets)
// ============================================================
let actx;
function sfx(freq = 220, dur = 0.08, type = 'square', vol = 0.06, slide = 0) {
  try {
    actx = actx || new AudioContext();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq; if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), actx.currentTime + dur);
    g.gain.setValueAtTime(vol, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
  } catch { /* audio is optional */ }
}

// ============================================================
// UI helpers
// ============================================================
function toast(msg, big = false) {
  const d = document.createElement('div'); d.className = 'toast' + (big ? ' big' : ''); d.innerHTML = msg;
  $('toasts').appendChild(d); setTimeout(() => d.remove(), 3300);
}
const dmgTexts = [];
function floatText(text, pos, color = '#fff') {
  const d = document.createElement('div'); d.className = 'dmg'; d.textContent = text; d.style.color = color;
  $('hud').appendChild(d); dmgTexts.push({ d, pos: pos.clone(), t: 0 });
}
function give(item, n, at) {
  S.inv[item] += n; if (at) floatText(`+${n} ${ICONS[item]}`, at, '#f5e6b8'); sfx(660, 0.06, 'triangle', 0.05, 200);
}
// Hit particles
const chips = [];
function burst(pos, color, n = 8) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), flat(color)); m.position.copy(pos);
    scene.add(m); chips.push({ m, v: new THREE.Vector3(rr(-3, 3), rr(2, 5), rr(-3, 3)), t: 0 });
  }
}

// Hotbar
const SLOTS = [{ k: 'hands', ic: '✊', n: 'Hands' }, { k: 'axe', ic: '🪓', n: 'Axe' }, { k: 'spear', ic: '🔱', n: 'Spear' }];
function renderHUD() {
  $('hpB').style.width = S.hp + '%'; $('foodB').style.width = S.food + '%'; $('staB').style.width = S.sta + '%';
  $('hotbar').innerHTML = SLOTS.map((s, i) => {
    const locked = s.k !== 'hands' && !S.tools[s.k];
    return `<div class="slot ${S.slot === i ? 'sel' : ''} ${locked ? 'locked' : ''}"><b>${i + 1}</b>${s.ic}<small>${s.n}</small></div>`;
  }).join('') + `<div class="slot"><b>F</b>${S.inv.meat ? '🍖' : '🫐'}<small>Eat</small><em>${S.inv.meat || S.inv.berries}</em></div>`;
  $('inv').innerHTML = Object.keys(S.inv).filter((k) => S.inv[k] > 0).map((k) => `<span>${ICONS[k]} ${NAMES[k]}</span><b>${S.inv[k]}</b>`).join('') || '<span style="opacity:.6">Empty pouch</span>';
  const hours = Math.floor(S.time * 24), mins = Math.floor((S.time * 24 - hours) * 60);
  $('clock').innerHTML = `<b class="cinzel">Day ${S.day}</b> · ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${isNight() ? '🌙' : '☀️'}${S.timeScale > 1 ? ` <span style="color:#e8c27a">×${S.timeScale}</span>` : ''}`;
  $('vignette').style.boxShadow = `inset 0 0 160px rgba(200,20,20,${P.hurtT > 0 ? 0.6 : S.hp < 30 ? 0.35 : 0})`;
}

// ============================================================
// Crafting
// ============================================================
const RECIPES = [
  { id: 'rope', ic: '🧶', name: 'Rope', desc: 'Twisted fiber. Holds a raft together.', cost: { fiber: 3 }, make: () => give('rope', 1) },
  { id: 'axe', ic: '🪓', name: 'Stone Axe', desc: 'Fells trees and breaks rocks 4× faster.', cost: { wood: 3, stone: 2, fiber: 1 }, once: () => S.tools.axe, make: () => { S.tools.axe = true; S.slot = 1; } },
  { id: 'spear', ic: '🔱', name: 'Spear', desc: 'Long reach, heavy damage. For hunting and fights.', cost: { wood: 4, stone: 1, fiber: 2 }, once: () => S.tools.spear, make: () => { S.tools.spear = true; S.slot = 2; } },
  { id: 'fire', ic: '🔥', name: 'Campfire', desc: 'Light, warmth, cooking. Wolves keep their distance. Placed in front of you.', cost: { wood: 5, stone: 3 }, make: placeCampfire },
];
const canAfford = (cost) => Object.entries(cost).every(([k, v]) => S.inv[k] >= v);
function renderCraft() {
  $('recipes').innerHTML = RECIPES.map((r) => {
    const owned = r.once && r.once();
    const cost = Object.entries(r.cost).map(([k, v]) => `<span class="${S.inv[k] >= v ? '' : 'no'}">${ICONS[k]} ${S.inv[k]}/${v}</span>`).join('');
    return `<div class="recipe"><div class="ic">${r.ic}</div><div class="info"><b>${r.name}</b><div>${r.desc}</div><div class="cost">${cost}</div></div>
      <button data-r="${r.id}" ${owned || !canAfford(r.cost) ? 'disabled' : ''}>${owned ? 'Owned' : 'Craft'}</button></div>`;
  }).join('') + `<p style="font-size:12px;opacity:.7">The raft is built at the old dock on the south beach, not here.</p>`;
}
$('recipes').addEventListener('click', (e) => {
  const id = e.target.dataset?.r; if (!id) return;
  const r = RECIPES.find((x) => x.id === id); if (!canAfford(r.cost)) return;
  for (const [k, v] of Object.entries(r.cost)) S.inv[k] -= v;
  r.make(); toast(`Crafted <b>${r.name}</b>`); sfx(440, 0.15, 'triangle', 0.07, 300); renderCraft();
});
function placeCampfire() {
  const f = new THREE.Group();
  for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28; mesh(new THREE.DodecahedronGeometry(0.22, 0), rockMat, Math.cos(a) * 0.6, 0.1, Math.sin(a) * 0.6, f); }
  for (let i = 0; i < 4; i++) { const l = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 5), trunkMat, 0, 0.25, 0, f); l.rotation.set(0.9, (i / 4) * 6.28, 0); }
  const flames = [];
  for (let i = 0; i < 3; i++) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22 - i * 0.05, 0.7 - i * 0.1, 6), new THREE.MeshBasicMaterial({ color: [0xff7a1a, 0xffb02e, 0xffe27a][i] })); fl.position.y = 0.45; f.add(fl); flames.push(fl); }
  const light = new THREE.PointLight(0xff9a40, 60, 18, 1.4); light.position.y = 1.2; f.add(light);
  const p = player.position.clone().add(new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw)).multiplyScalar(2));
  p.y = heightAt(p.x, p.z); f.position.copy(p); scene.add(f);
  if (S.campfire) scene.remove(S.campfire.obj);  // one fire at a time keeps it simple
  S.campfire = { obj: f, flames, light, pos: p };
}

// ============================================================
// Dialogue
// ============================================================
let dialogQueue = [], dialogDone = null;
function say(lines, done) {
  dialogQueue = lines.slice(); dialogDone = done || null; $('dialog').classList.remove('hidden'); nextLine();
}
function nextLine() {
  if (!dialogQueue.length) { $('dialog').classList.add('hidden'); const d = dialogDone; dialogDone = null; if (d) d(); return; }
  const [who, txt] = dialogQueue.shift(); $('dialog').querySelector('.who').textContent = who; $('dialog').querySelector('.txt').textContent = txt;
}
const inDialog = () => !$('dialog').classList.contains('hidden');
$('dialog').addEventListener('click', nextLine);

// ============================================================
// Quests
// ============================================================
const Q = [
  { title: 'Washed Ashore', desc: 'You wake on a strange beach. Smoke rises from a hut nearby. Someone lives here.',
    obj: () => [['Talk to the hermit near the hut', S.talkedNestor]], target: () => nestor.position },
  { title: 'Hands of a Survivor', desc: 'Nestor says you need tools before anything else. Pick up branches and pebbles, harvest bushes and reeds, or punch trees and rocks.',
    obj: () => [[`Wood ${Math.min(S.inv.wood, 6)}/6`, S.inv.wood >= 6 || S.tools.axe], [`Stone ${Math.min(S.inv.stone, 4)}/4`, S.inv.stone >= 4 || S.tools.axe], [`Fiber ${Math.min(S.inv.fiber, 3)}/3`, S.inv.fiber >= 3 || S.tools.axe]], target: () => null },
  { title: 'Tools of the Wreck', desc: 'Open crafting with C. The axe works wood and stone fast. The spear keeps beasts at a distance.',
    obj: () => [['Craft a Stone Axe', S.tools.axe], ['Craft a Spear', S.tools.spear]], target: () => null },
  { title: 'Fire Before Dark', desc: 'Nights here are long and the wolves come out. Build a campfire. Resting at it with R makes time pass faster.',
    obj: () => [['Build a Campfire (C)', !!S.campfire]], target: () => null },
  { title: 'The Hunt', desc: 'Berries alone will not keep you alive. Hunt rabbits and a wild boar, then cook the meat at your fire with E.',
    obj: () => [[`Rabbits ${Math.min(S.kills.rabbit, 2)}/2`, S.kills.rabbit >= 2], [`Boar ${Math.min(S.kills.boar, 1)}/1`, S.kills.boar >= 1], [`Cook meat ${Math.min(S.cooked, 3)}/3`, S.cooked >= 3]],
    target: () => nearestCreature('boar') },
  { title: 'The Long Night', desc: 'Survive until dawn. Stay near the fire, keep your spear ready and eat when you are hungry.',
    obj: () => [[`Survive a night (${S.nights - S.nightsAtStart}/1)`, S.nights - S.nightsAtStart >= 1]], target: () => S.campfire?.pos, start: () => { S.nightsAtStart = S.nights; } },
  { title: 'Ruins of the Old Ones', desc: 'Nestor remembers a sail stored in the hilltop ruins, before the dead started walking. Clear the skeletons and open the chest.',
    obj: () => { const k = skeletons.filter((s) => s.dead).length; return [[`Skeletons ${k}/3`, k >= 3], ['Loot the old chest', !chest.alive]]; }, target: () => chestPos },
  { title: 'The Raft', desc: 'Lash logs together at the old dock on the south beach. You need rope, the sail, and food for the crossing.',
    obj: () => [[`Wood ${Math.min(S.inv.wood, 12)}/12`, S.inv.wood >= 12 || S.raftBuilt], [`Rope ${Math.min(S.inv.rope, 4)}/4`, S.inv.rope >= 4 || S.raftBuilt], [`Sailcloth ${S.inv.sail}/1`, S.inv.sail >= 1 || S.raftBuilt], [`Cooked meat ${Math.min(S.inv.meat, 3)}/3`, S.inv.meat >= 3 || S.raftBuilt], ['Build the raft at the dock (E)', S.raftBuilt]],
    target: () => RAFT_SITE },
  { title: 'To Greece!', desc: 'Say goodbye to Nestor if you like, then board the raft and sail south toward the mountains on the horizon.',
    obj: () => [['Set sail from the dock (E)', S.sailing]], target: () => RAFT_SITE },
];
function nearestCreature(type) {
  let best = null, bd = 1e9;
  for (const c of creatures) if (!c.dead && c.type === type) { const d = c.obj.position.distanceTo(player.position); if (d < bd) { bd = d; best = c.obj.position; } }
  return best;
}
function renderQuest() {
  const q = Q[S.questIdx]; $('quest').classList.toggle('hidden', !q); if (!q) return;
  $('quest').innerHTML = `<div class="step">Quest ${S.questIdx + 1} / ${Q.length}</div><h3 class="cinzel">${q.title}</h3><p>${q.desc}</p><ul>${q.obj().map(([t, d]) => `<li class="${d ? 'done' : ''}">${d ? '✔' : '○'} ${t}</li>`).join('')}</ul>`;
}
function checkQuest() {
  const q = Q[S.questIdx]; if (!q) return;
  if (q.obj().every(([, d]) => d)) {
    toast(`Quest complete: ${q.title}`, true); sfx(523, 0.12, 'triangle', 0.08); setTimeout(() => sfx(784, 0.25, 'triangle', 0.08), 120);
    S.questIdx++; const n = Q[S.questIdx]; if (n?.start) n.start();
    if (n) setTimeout(() => toast(`New quest: <b>${n.title}</b>`), 900);
    if (S.questIdx === 6) setTimeout(() => say([['Nestor', 'You lived through the night. Good. Now listen: I once saw a sail up in the ruins on the hill, in a bronze-bound chest.'], ['Nestor', 'Three dead soldiers guard it. They do not sleep. Take your spear, and a full belly.']]), 1500);
  }
}

// Nestor's lines depend on quest progress
function talkNestor() {
  const i = S.questIdx;
  if (i === 0) return say([
    ['Nestor', 'By Poseidon... another one the sea spat out. Easy, friend, you are safe. Mostly.'],
    ['Nestor', 'I am Nestor. The storms put me on this rock twelve summers ago, and I never left.'],
    ['Nestor', 'You want to reach Greece? You can see it from the south beach on a clear day. But the sea does not give free passage.'],
    ['Nestor', 'First you need tools. Pick up branches and stones, pull fiber from the bushes and reeds. Hit trees and rocks if you must.'],
  ], () => { S.talkedNestor = true; });
  const lines = {
    1: 'Wood, stone, fiber. Every good tool starts with those three.',
    2: 'Press C and use what you gathered. An axe first. Then a spear, trust me.',
    3: 'The sun falls fast here. When it is gone the wolves come out of the pines. Build a fire.',
    4: 'Rabbits run and boars fight back. Keep the spear pointed at the tusks. Cook the meat, raw meat will make you sick.',
    5: 'Stay close to the fire tonight. The wolves are cowards, but hungry ones.',
    6: 'The ruins are north, on the high ground. Bring me back a story. Or do not come back at all, ha.',
    7: 'The old dock is on the south beach. Twelve logs, four ropes, the sail, and food for three days at sea.',
    8: 'Fair winds, friend. When you find Ithaca... tell them old Nestor is still waiting.',
  };
  say([['Nestor', lines[i] || 'The sea is calm today.']]);
}

// ============================================================
// Input
// ============================================================
const keys = {};
let locked = false;
const canvas = renderer.domElement;
canvas.addEventListener('click', () => { if (S.running && !S.sailing && !inDialog() && $('craft').classList.contains('hidden')) canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked && S.running && $('title').classList.contains('hidden')) setPause(false);
  if (!locked && S.running && !S.sailing && $('craft').classList.contains('hidden') && !inDialog()) setPause(true);
});
document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  camYaw -= e.movementX * 0.0025; camPitch = clamp(camPitch + e.movementY * 0.0022, -0.35, 1.1);
});
document.addEventListener('mousedown', (e) => { if (locked && e.button === 0) startSwing(); });
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (!S.running) return;
  if (inDialog()) { if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') nextLine(); return; }
  if (S.sailing) return;
  if (e.code === 'KeyC') toggleCraft();
  if (!$('craft').classList.contains('hidden')) return;
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyF') eat();
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5) - 1; if (n >= 0 && n < 3 && (n === 0 || S.tools[SLOTS[n].k])) S.slot = S.slot === n ? 0 : n; }
  if (e.code === 'KeyT') { S.timeScale = S.timeScale === 1 ? 10 : 1; toast(`Playtest: time ×${S.timeScale}`); }
  if (e.code === 'KeyG') { for (const k of ['wood', 'stone', 'fiber', 'rawmeat', 'rope']) S.inv[k] += 10; toast('Playtest: +10 materials'); }
  if (e.code === 'KeyN') debugSkipQuest();
});
addEventListener('keyup', (e) => (keys[e.code] = false));
function toggleCraft() {
  const c = $('craft'); const open = c.classList.contains('hidden');
  c.classList.toggle('hidden', !open);
  if (open) { renderCraft(); document.exitPointerLock(); } else canvas.requestPointerLock();
}
$('closeCraft').onclick = toggleCraft;
function setPause(p) { S.paused = p; $('pause').classList.toggle('hidden', !p); }
$('resume').onclick = () => { setPause(false); canvas.requestPointerLock(); };
$('toTitle').onclick = () => { $('title').classList.remove('hidden'); $('pause').classList.add('hidden'); $('startBtn').textContent = 'Resume'; };
function debugSkipQuest() {
  const i = S.questIdx;
  if (i === 0) S.talkedNestor = true;
  if (i === 1) Object.assign(S.inv, { wood: S.inv.wood + 6, stone: S.inv.stone + 4, fiber: S.inv.fiber + 3 });
  if (i === 2) Object.assign(S.tools, { axe: true, spear: true });
  if (i === 3) placeCampfire();
  if (i === 4) { S.kills.rabbit = Math.max(2, S.kills.rabbit); S.kills.boar = Math.max(1, S.kills.boar); S.cooked = Math.max(3, S.cooked); S.inv.meat += 3; }
  if (i === 5) S.nights++;
  if (i === 6) { skeletons.forEach((s) => { if (!s.dead) killCreature(s); }); openChest(); }
  if (i === 7) { Object.assign(S.inv, { wood: S.inv.wood + 12, rope: S.inv.rope + 4, meat: S.inv.meat + 3 }); player.position.set(RAFT_SITE.x - 2, 0.5, RAFT_SITE.z - 3); }
  toast('Playtest: quest step skipped');
}

// ============================================================
// Interaction (E)
// ============================================================
function getInteractable() {
  const pp = player.position; let best = null, bd = 2.6;
  const consider = (d, v) => { if (d < bd) { bd = d; best = v; } };
  consider(pp.distanceTo(nestor.position), { label: 'Talk to Nestor', act: talkNestor });
  for (const pk of pickups) {
    if (!pk.alive || (pk.kind === 'bush' && pk.regrow > 0)) continue;
    const labels = { axeitem: 'Pick up the axe', branch: 'Pick up branch', pebble: 'Pick up pebbles', bush: 'Harvest bush', reeds: 'Cut reeds', chest: 'Open the old chest' };
    consider(pp.distanceTo(pk.pos), { label: labels[pk.kind], act: () => harvest(pk) });
  }
  if (S.campfire && pp.distanceTo(S.campfire.pos) < 3) {
    const d = pp.distanceTo(S.campfire.pos) - 0.5;
    if (S.inv.rawmeat > 0) consider(d, { label: `Cook ${S.inv.rawmeat} raw meat`, act: cook });
  }
  const rd = Math.hypot(pp.x - RAFT_SITE.x, pp.z - RAFT_SITE.z);
  if (rd < 4.5) {
    if (!S.raftBuilt) consider(Math.max(0, rd - 2.5), { label: S.questIdx >= 7 ? 'Build the raft' : 'Old dock: a raft could launch here', act: buildRaft });
    else consider(Math.max(0, rd - 2.5), { label: 'Set sail for Greece', act: setSail });
  }
  return best;
}
function interact() { const it = getInteractable(); if (it) it.act(); }
function harvest(pk) {
  if (pk.kind === 'chest') {
    if (skeletons.some((s) => !s.dead)) { toast('The dead still guard the chest.'); return; }
    return openChest();
  }
  if (pk.kind === 'axeitem') { S.tools.axe = true; S.slot = 1; toast('Picked up the <b>Axe</b>. Press 2 to put it away or take it out.'); sfx(440, 0.2, 'triangle', 0.08, 200); }
  if (pk.kind === 'branch') give('wood', 1, pk.pos);
  if (pk.kind === 'pebble') give('stone', 1, pk.pos);
  if (pk.kind === 'reeds') give('fiber', 2, pk.pos);
  if (pk.kind === 'bush') { give('berries', 2, pk.pos); give('fiber', 1); pk.regrow = 90; pk.obj.userData.berries.visible = false; return; }
  pk.alive = false; scene.remove(pk.obj);
}
function openChest() {
  if (!chest.alive) return; chest.alive = false; chestLid.rotation.x = -1.2; chestLid.position.z = -0.35;
  give('sail', 1, chestPos); give('hide', 2); toast('Found <b>Sailcloth</b> with a faded red cross'); sfx(330, 0.4, 'sine', 0.08, 400);
}
function cook() {
  const n = S.inv.rawmeat; S.inv.rawmeat = 0; S.inv.meat += n; S.cooked += n;
  floatText(`+${n} 🍖`, S.campfire.pos.clone().setY(S.campfire.pos.y + 1.5), '#ffcf7a'); sfx(180, 0.3, 'sawtooth', 0.03, -60);
}
function buildRaft() {
  if (S.questIdx < 7) { say([['You', 'Old planks and rotten rope. With enough wood, rope and a sail, a raft could launch from here.']]); return; }
  const need = { wood: 12, rope: 4, sail: 1, meat: 3 };
  if (!canAfford(need)) { toast('Missing materials. Check the quest list.'); return; }
  for (const [k, v] of Object.entries(need)) S.inv[k] -= v;
  S.raftBuilt = true; raftGhost.visible = false;
  raftParts.forEach((p, i) => setTimeout(() => { p.visible = true; burst(raftGroup.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 0x9b6e3f, 4); sfx(200 + i * 40, 0.08); }, i * 180));
  toast('The raft is ready.', true);
}
function eat() {
  if (S.inv.meat > 0) { S.inv.meat--; S.food = clamp(S.food + 35, 0, 100); S.hp = clamp(S.hp + 10, 0, 100); toast('Ate cooked meat 🍖'); }
  else if (S.inv.berries > 0) { S.inv.berries--; S.food = clamp(S.food + 10, 0, 100); toast('Ate berries 🫐'); }
  else if (S.inv.rawmeat > 0) { S.inv.rawmeat--; S.food = clamp(S.food + 12, 0, 100); hurtPlayer(8, 'Raw meat made you sick'); }
  else { toast('Nothing to eat'); return; }
  sfx(300, 0.1, 'triangle', 0.05, -100);
}

// ============================================================
// Combat & gathering (left click)
// ============================================================
const TOOL_STATS = { hands: { dmg: 5, wood: 1, stone: 1, reach: 2.3 }, axe: { dmg: 11, wood: 4, stone: 4, reach: 2.6 }, spear: { dmg: 24, wood: 1, stone: 1, reach: 3.4 } };
function startSwing() {
  if (P.swing > 0 || P.dead || S.paused) return;
  if (S.sta < 6) { toast('Too tired'); return; }
  S.sta -= 8; P.swing = 1; P.swingHit = false; sfx(120, 0.07, 'sawtooth', 0.03, -40);
}
function doHit() {
  const tool = TOOL_STATS[SLOTS[S.slot].k], pp = player.position;
  const fwd = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
  const inFront = (p, reach) => { const d = new THREE.Vector3(p.x - pp.x, 0, p.z - pp.z); const len = d.length(); return len < reach && (len < 0.8 || d.normalize().dot(fwd) > 0.45); };
  // Creatures first
  let hitAny = false;
  for (const c of creatures) {
    if (c.dead || !inFront(c.obj.position, tool.reach + c.def.r)) continue;
    const dmg = Math.round(tool.dmg * rr(0.85, 1.15));
    c.hp -= dmg; c.flash = 0.15; hitAny = true;
    floatText(dmg, c.obj.position.clone().setY(c.obj.position.y + 1.6), '#ffdf8a');
    c.obj.position.addScaledVector(fwd, 0.6);
    if (c.def.flee) c.state = 'flee'; else c.state = 'chase';
    burst(c.obj.position.clone().setY(c.obj.position.y + 0.6), c.type === 'skeleton' ? 0xe9e0c9 : 0xa33a2a, 5);
    sfx(90, 0.1, 'square', 0.07, -30);
    if (c.hp <= 0) killCreature(c);
  }
  if (hitAny) return;
  for (const r of resources) {
    if (!r.alive || !inFront(r.pos, tool.reach + r.r)) continue;
    const pow = r.type === 'tree' ? tool.wood : tool.stone;
    r.hp -= pow; r.shake = 0.25;
    burst(r.pos.clone().setY(r.pos.y + 1), r.type === 'tree' ? 0x7a4f2c : 0x9b958c, 5);
    sfx(r.type === 'tree' ? 160 : 520, 0.06, 'square', 0.05);
    if (r.type === 'rock' && pow >= 4) give('stone', 1, r.pos.clone().setY(r.pos.y + 1.5));
    if (r.hp <= 0) {
      r.alive = false;
      if (r.type === 'tree') { r.fall = 0.001; give('wood', 4, r.pos.clone().setY(r.pos.y + 2)); }
      else { scene.remove(r.obj); give('stone', 3, r.pos.clone().setY(r.pos.y + 1.5)); }
    } else if (SLOTS[S.slot].k === 'hands' && r.hp % 4 === 0 && r.type === 'tree') floatText('Tip: an axe is 4× faster', r.pos.clone().setY(r.pos.y + 2.5), '#cfd8e8');
    return;
  }
}
function killCreature(c) {
  c.dead = true; c.deadT = 0; S.kills[c.type]++;
  for (const [k, v] of Object.entries(c.def.drops)) give(k, v, c.obj.position.clone().setY(c.obj.position.y + 1.2));
  if (c.type === 'skeleton') burst(c.obj.position.clone().setY(c.obj.position.y + 1), 0xe9e0c9, 16);
}
function hurtPlayer(dmg, reason) {
  if (P.dead) return;
  S.hp -= dmg; P.hurtT = 0.25; sfx(70, 0.2, 'sawtooth', 0.08, -20);
  floatText(`-${dmg}`, player.position.clone().setY(player.position.y + 2.3), '#ff6b5b');
  if (reason) toast(reason);
  if (S.hp <= 0) die();
}
function die() {
  P.dead = true; S.deaths++; toast('You fell... Nestor drags you back to the hut.', true);
  setTimeout(() => {
    S.hp = 60; S.food = Math.max(S.food, 40); S.inv.rawmeat = Math.floor(S.inv.rawmeat / 2);
    player.position.copy(NESTOR_POS).add(new THREE.Vector3(0, 0, 2)); P.dead = false;
    creatures.filter((c) => c.type === 'wolf').forEach((c) => (c.state = 'flee'));
  }, 2200);
}

// ============================================================
// Creature AI
// ============================================================
const tmp = new THREE.Vector3();
function updateCreature(c, dt) {
  const o = c.obj;
  if (c.dead) {
    c.deadT += dt; o.rotation.z = Math.min(c.deadT * 4, Math.PI / 2); o.position.y -= dt * (c.deadT > 1.5 ? 0.6 : 0);
    if (c.deadT > 3) { scene.remove(o); c.gone = true; } return;
  }
  const d = c.def, pp = player.position; const dist = o.position.distanceTo(pp);
  c.t -= dt; c.atkCd -= dt;
  const fireNear = S.campfire && S.campfire.pos.distanceTo(o.position) < 7;
  if (d.hostile) {
    const aggro = d.aggro || 40;
    if (c.type === 'skeleton' && c.home.distanceTo(pp) > 22) c.state = 'return';
    else if (dist < aggro && !P.dead) c.state = 'chase';
    if (c.type === 'wolf' && (!isNight() || fireNear)) c.state = 'flee';
  } else if (d.flee && dist < 7) c.state = 'flee';
  else if (c.state === 'flee' && dist > 16) c.state = 'wander';
  if (c.type === 'boar' && c.state === 'chase' && dist > 18) c.state = 'wander';

  let speed = 0; const goal = tmp;
  if (c.state === 'wander') {
    if (c.t <= 0) { c.t = rr(2, 6); c.target.set(c.home.x + rr(-10, 10), 0, c.home.z + rr(-10, 10)); c.idle = rand() < 0.4; }
    goal.copy(c.target); speed = c.idle ? 0 : d.speed * 0.3;
  } else if (c.state === 'flee') {
    goal.copy(o.position).multiplyScalar(2).sub(pp); speed = d.speed;
    if (c.type === 'wolf') { c.fleeT = (c.fleeT || 0) + dt; if (c.fleeT > 6) { scene.remove(o); c.gone = true; return; } }
  } else if (c.state === 'return') { goal.copy(c.home); speed = d.speed; if (o.position.distanceTo(c.home) < 1) c.state = 'wander'; }
  else if (c.state === 'chase') {
    goal.copy(pp); speed = d.speed;
    if (dist < d.reach + 0.2) {
      speed = 0;
      if (c.atkCd <= 0 && !P.dead) { c.atkCd = c.type === 'skeleton' ? 1.4 : 1.1; c.lunge = 0.3; hurtPlayer(d.dmg); }
    }
  }
  if (speed > 0) {
    const dir = new THREE.Vector3(goal.x - o.position.x, 0, goal.z - o.position.z);
    if (dir.lengthSq() > 0.05) {
      dir.normalize();
      const nx = o.position.x + dir.x * speed * dt, nz = o.position.z + dir.z * speed * dt;
      if (heightAt(nx, nz) > 0.3 || c.type === 'skeleton') { o.position.x = nx; o.position.z = nz; }
      else c.t = 0;
      const targetYaw = Math.atan2(dir.x, dir.z);
      o.rotation.y += Math.atan2(Math.sin(targetYaw - o.rotation.y), Math.cos(targetYaw - o.rotation.y)) * Math.min(1, dt * 8);
    }
  }
  const gy = heightAt(o.position.x, o.position.z);
  o.position.y = c.type === 'skeleton' && Math.hypot(o.position.x - RUINS.x, o.position.z - RUINS.z) < 9 ? 11.3 : gy;
  // Animation
  c.anim = (c.anim || 0) + dt * (speed > 0 ? speed * 1.6 : 0);
  if (c.type === 'rabbit') o.children[0].position.y = 0.3 + Math.abs(Math.sin(c.anim * 1.5)) * (speed > 0 ? 0.25 : 0);
  else if (c.type === 'skeleton') animateHumanoid(o, speed, c.anim / 3.4, c.lunge > 0 ? c.lunge / 0.3 : 0);
  else o.userData.legs.forEach((l, i) => (l.rotation.x = Math.sin(c.anim * 2.5 + (i % 3 ? Math.PI : 0)) * 0.6));
  if (c.lunge > 0) c.lunge -= dt;
  const flashing = c.flash > 0; c.flash -= dt;
  o.traverse((m) => { if (m.isMesh && m.material.emissive) m.material.emissive.setHex(flashing ? 0x882211 : 0x000000); });
}

// ============================================================
// Camera + player update
// ============================================================
let camYaw = Math.PI, camPitch = 0.35;
function collide(pos, r) {
  for (const c of colliders) {
    if (c.ref && !c.ref.alive) continue;
    const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
    if (d < m && d > 0.0001) { pos.x = c.x + (dx / d) * m; pos.z = c.z + (dz / d) * m; }
  }
}
function updatePlayer(dt) {
  if (P.dead) { player.rotation.z = lerp(player.rotation.z, Math.PI / 2, dt * 4); return; }
  player.rotation.z = 0;
  const input = new THREE.Vector3((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), 0, (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0));
  const ground = heightAt(player.position.x, player.position.z);
  const swimming = ground < -0.6;
  let speed = 0;
  if (input.lengthSq() > 0 && locked) {
    input.normalize();
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);             // camera forward on XZ
    // right vector = (-fz, fx); world dir = forward*z + right*x
    const dir = new THREE.Vector3().set(fx * input.z + -fz * input.x, 0, fz * input.z + fx * input.x).normalize();
    const sprint = keys.ShiftLeft && S.sta > 1 && !swimming;
    speed = swimming ? 2.4 : sprint ? 8 : 4.6;
    if (sprint) S.sta -= 18 * dt;
    player.position.x += dir.x * speed * dt; player.position.z += dir.z * speed * dt;
    const ty = Math.atan2(dir.x, dir.z);
    P.yaw += Math.atan2(Math.sin(ty - P.yaw), Math.cos(ty - P.yaw)) * Math.min(1, dt * 12);
  } else if (locked && P.swing > 0) {
    P.yaw = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));        // face where the camera looks when attacking
  }
  if (!(keys.ShiftLeft && speed > 0)) S.sta = clamp(S.sta + (swimming ? 4 : 16) * dt, 0, 100);
  if (swimming) { S.sta = Math.max(0, S.sta - 6 * dt); if (S.sta <= 0) { S.hp -= 5 * dt; if (S.hp <= 0) die(); } }
  // Keep the island a closed arena: the sea gets rough past the reef
  const r = Math.hypot(player.position.x, player.position.z);
  if (r > 112) { player.position.multiplyScalar(112 / r); if (!P.warned) { toast('The currents are too strong to swim. Build a raft.'); P.warned = true; setTimeout(() => (P.warned = false), 5000); } }
  collide(player.position, 0.4);
  player.rotation.y = P.yaw;
  // Jump / gravity
  if (keys.Space && P.onGround && S.sta > 10 && !swimming) { P.vel.y = 6.5; P.onGround = false; S.sta -= 10; }
  P.vel.y -= 20 * dt; player.position.y += P.vel.y * dt;
  const floor = Math.max(heightAt(player.position.x, player.position.z), swimming ? -1.2 : -99);
  const onRuins = Math.hypot(player.position.x - RUINS.x, player.position.z - RUINS.z) < 9.2;
  const fl = onRuins ? Math.max(floor, 11.3) : floor;
  if (player.position.y <= fl) { player.position.y = fl; P.vel.y = 0; P.onGround = true; }
  // Swing
  if (P.swing > 0) { P.swing -= dt * 3.2; if (!P.swingHit && P.swing < 0.55) { P.swingHit = true; doHit(); } }
  P.animT += dt * (speed > 0 ? speed / 4.6 : 0.3);
  animateHumanoid(player, speed, P.animT, Math.max(P.swing, 0));
  if (hero.rig) poseHero(speed, P.animT * 10, Math.max(P.swing, 0), performance.now() / 1000);
  tools.axe.visible = S.slot === 1; tools.spear.visible = S.slot === 2;
  if (P.hurtT > 0) P.hurtT -= dt;
}
function updateCamera(dt) {
  const target = player.position.clone().add(new THREE.Vector3(0, 1.7, 0));
  const dist = 7;
  const off = new THREE.Vector3(Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch)).multiplyScalar(dist);
  const want = target.clone().add(off);
  want.y = Math.max(want.y, heightAt(want.x, want.z) + 0.6, 0.3);
  camera.position.lerp(want, Math.min(1, dt * 12)); camera.lookAt(target);
}

// ============================================================
// Day/night, world upkeep
// ============================================================
const skyDay = new THREE.Color(0x86b8e2), skyDusk = new THREE.Color(0xf0a070), skyNight = new THREE.Color(0x0b1630);
let wolfTimer = 5;
function updateWorld(dt, t) {
  S.time += (dt * S.timeScale * (P.resting ? 8 : 1)) / DAY_LEN;
  if (S.time >= 1) { S.time -= 1; S.day++; }
  const night = isNight();
  if (S.wasNight && !night) { S.nights++; toast(`Dawn of day ${S.day}`, true); creatures.filter((c) => c.type === 'wolf').forEach((c) => (c.state = 'flee')); }
  if (!S.wasNight && night) toast('Night falls. Wolves are hunting.', true);
  S.wasNight = night;

  const e = -Math.cos(S.time * Math.PI * 2);                    // -1 midnight, +1 noon
  const day = clamp(e * 2.2 + 0.35, 0, 1), dusk = clamp(1 - Math.abs(e) * 3.5, 0, 1);
  const skyCol = skyNight.clone().lerp(skyDay, day).lerp(skyDusk, dusk * 0.55);
  scene.fog.color.copy(skyCol); scene.background = skyCol;
  sun.intensity = 0.15 + day * 2.9; sun.color.setHex(dusk > 0.4 ? 0xffb070 : 0xffe2b0);
  hemi.intensity = 0.2 + day * 0.45;
  const sa = S.time * Math.PI * 2;
  sun.position.set(player.position.x + Math.sin(sa) * 60, Math.max(8, e * 80), player.position.z + 30 + Math.cos(sa) * 20);
  if (e < -0.1) sun.position.y = 50;   // moonlight from above
  sun.target.position.copy(player.position);
  // Physical sky + reflections follow the true sun; at night the sky shader fades and a moonlit tint takes over
  const sa2 = S.time * Math.PI * 2;
  sunDir.set(Math.sin(sa2) * 0.55, e, 0.35 + Math.cos(sa2) * 0.25).normalize();
  sky.material.uniforms.sunPosition.value.copy(sunDir);
  sky.visible = day > 0.02; renderer.toneMappingExposure = lerp(0.5, 0.82, day);
  water.material.uniforms.sunDirection.value.copy(sunDir.y > 0 ? sunDir : new THREE.Vector3(0.2, 0.6, 0.3).normalize());
  water.material.uniforms.sunColor.value.setHex(day > 0.1 ? (dusk > 0.4 ? 0xffb070 : 0xfff1d6) : 0x8fa6d6);
  water.material.uniforms.time.value += dt * 0.6 + 0.0005;
  windUniform.value = t; grassU.uCenter.value.set(player.position.x, player.position.z);
  envTimer -= 1;
  if (envTimer <= 0) { envTimer = 240; refreshEnvironment(); scene.environmentIntensity = lerp(0.15, 1, day); }

  // Hunger & regen
  S.food = clamp(S.food - dt * S.timeScale * (P.resting ? 8 : 1) * 0.28, 0, 100);
  if (S.food <= 0) { S.hp -= dt * 1.5; if (S.hp <= 0 && !P.dead) die(); }
  else if (S.food > 50 && S.hp < 100) S.hp = Math.min(100, S.hp + dt * 1.2);

  // Night wolves
  if (night && !P.dead) {
    wolfTimer -= dt * S.timeScale;
    const wolves = creatures.filter((c) => c.type === 'wolf' && !c.dead && !c.gone).length;
    if (wolfTimer <= 0 && wolves < Math.min(1 + S.day, 4)) {
      wolfTimer = 18;
      for (let i = 0; i < 12; i++) {
        const a = rr(0, 6.28), p = player.position.clone().add(new THREE.Vector3(Math.cos(a) * 28, 0, Math.sin(a) * 28));
        p.y = heightAt(p.x, p.z);
        if (p.y > 1 && Math.hypot(p.x - RUINS.x, p.z - RUINS.z) > 12) { spawnCreature('wolf', p).state = 'chase'; break; }
      }
    }
  }
  // Keep game animals stocked
  for (const [type, n] of [['rabbit', 6], ['boar', 2]]) {
    if (creatures.filter((c) => c.type === type && !c.dead).length < n && rand() < dt * 0.05) {
      const p = landSpot(2, 11, AVOID.concat([{ x: player.position.x, z: player.position.z, r: 30 }])); if (p) spawnCreature(type, p);
    }
  }
  for (let i = creatures.length - 1; i >= 0; i--) if (creatures[i].gone) creatures.splice(i, 1);

  // Bushes regrow
  for (const pk of pickups) if (pk.kind === 'bush' && pk.regrow > 0) { pk.regrow -= dt * S.timeScale; if (pk.regrow <= 0) pk.obj.userData.berries.visible = true; }
  // Falling trees
  for (const r of resources) {
    if (r.fall > 0) { r.fall += dt * 1.8; r.obj.rotation.x = Math.min(r.fall * r.fall, Math.PI / 2); if (r.fall > 2) { scene.remove(r.obj); r.fall = 0; } }
    if (r.shake > 0 && r.alive) { r.shake -= dt; r.obj.rotation.z = Math.sin(t * 60) * r.shake * 0.2; }
  }
  // Campfire flicker + rest
  if (S.campfire) {
    S.campfire.flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 13 + i * 2) * 0.2; f.rotation.y = t * (i + 1); });
    S.campfire.light.intensity = 55 + Math.sin(t * 17) * 8 + (night ? 40 : 0);
  }
  P.resting = !!(keys.KeyR && S.campfire && player.position.distanceTo(S.campfire.pos) < 4 && !creatures.some((c) => c.state === 'chase' && !c.dead));
  // Water, smoke, clouds, NPC
  smoke.forEach((s) => { s.userData.t = (s.userData.t + dt * 0.15) % 1; const k = s.userData.t; s.position.set(CHIMNEY.x + k * 2, CHIMNEY.y + k * 6, CHIMNEY.z); s.scale.setScalar(0.5 + k * 1.8); s.material.opacity = 0.5 * (1 - k); });
  clouds.forEach((c) => { c.position.x += dt * 2; if (c.position.x > 320) c.position.x = -320; });
  const nd = nestor.position.distanceTo(player.position);
  nestor.rotation.y = nd < 8 ? Math.atan2(player.position.x - nestor.position.x, player.position.z - nestor.position.z) : nestor.rotation.y;
  animateHumanoid(nestor, 0, t);
  if (S.raftBuilt && !S.sailing) raftGroup.position.y = 0.05 + Math.sin(t * 1.5) * 0.08;
}

// ============================================================
// Minimap & waypoint
// ============================================================
const mm = $('minimap').getContext('2d');
const mmBase = document.createElement('canvas'); mmBase.width = mmBase.height = 160;
{
  const c = mmBase.getContext('2d'); const img = c.createImageData(160, 160);
  for (let y = 0; y < 160; y++) for (let x = 0; x < 160; x++) {
    const wx = (x - 80) * 0.8, wz = (y - 80) * 0.8, h = heightAt(wx, wz), i = (y * 160 + x) * 4;
    const col = h < 0 ? [44, 110, 160] : h < 1.3 ? [226, 205, 150] : h > 12.5 ? [150, 140, 128] : [110, 140, 70];
    img.data.set([...col, 255], i);
  }
  c.putImageData(img, 0, 0);
}
const waypoint = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshBasicMaterial({ color: 0xe8c27a }));
scene.add(waypoint);
function drawMinimap(target) {
  mm.save(); mm.clearRect(0, 0, 160, 160); mm.beginPath(); mm.arc(80, 80, 79, 0, 6.28); mm.clip();
  mm.drawImage(mmBase, 0, 0);
  const toMap = (p) => [80 + p.x / 0.8, 80 + p.z / 0.8];
  mm.fillStyle = '#b0392e'; creatures.forEach((c) => { if (!c.dead && c.def.hostile) { const [x, y] = toMap(c.obj.position); mm.fillRect(x - 1.5, y - 1.5, 3, 3); } });
  mm.fillStyle = '#fff'; { const [x, y] = toMap(nestor.position); mm.fillRect(x - 2, y - 2, 4, 4); }
  if (target) { const [x, y] = toMap(target); mm.fillStyle = '#e8c27a'; mm.beginPath(); mm.moveTo(x, y - 5); mm.lineTo(x + 4, y); mm.lineTo(x, y + 5); mm.lineTo(x - 4, y); mm.fill(); }
  const [px, py] = toMap(player.position); mm.translate(px, py); mm.rotate(-P.yaw + Math.PI);
  mm.fillStyle = '#ffe9b0'; mm.beginPath(); mm.moveTo(0, -6); mm.lineTo(4, 4); mm.lineTo(-4, 4); mm.fill();
  mm.restore();
  mm.fillStyle = '#e8c27a'; mm.font = 'bold 11px Cinzel, serif'; mm.fillText('N', 76, 12);
}

// ============================================================
// Sailing ending
// ============================================================
function setSail() {
  if (S.questIdx < 8) return;
  S.sailing = true; document.exitPointerLock(); $('prompt').classList.add('hidden'); checkQuest();
  say([['Nestor', '(from the shore) Fair winds! Watch the sky, and pray to Poseidon!'], ['You', 'Greece... here I come.']], () => {
    const start = performance.now();
    player.position.set(0, 0.5, 0.8); player.rotation.set(0, 0, 0); raftGroup.add(player); P.yaw = 0;
    const tick = () => {
      const k = (performance.now() - start) / 1000;
      raftGroup.position.z += 0.08 + k * 0.01; raftGroup.rotation.z = Math.sin(k * 1.4) * 0.05;
      if (k > 9) { $('fade').style.opacity = 1; }
      if (k > 11.5) {
        $('ending').classList.remove('hidden');
        $('endStats').innerHTML = `Survived <b>${S.day}</b> days · Rabbits ${S.kills.rabbit} · Boars ${S.kills.boar} · Wolves ${S.kills.wolf} · Skeletons ${S.kills.skeleton} · Deaths ${S.deaths}<br>Time played: ${Math.round((performance.now() - S.started) / 60000)} min<br><br>Next in the Unity build: landfall in the Pedias biome, the first village, and character creation.`;
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

// ============================================================
// Main loop
// ============================================================
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
composer.setPixelRatio(Math.min(devicePixelRatio, 2)); composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, 0.5, 0.92); composer.addPass(bloom);
const vignette = new ShaderPass(VignetteShader); vignette.uniforms.offset.value = 0.95; vignette.uniforms.darkness.value = 1.15; composer.addPass(vignette);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.2 }, warm: { value: new THREE.Vector3(1.04, 1.0, 0.93) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat; uniform vec3 warm; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, sat) * warm; gl_FragColor = c; }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());
function setQuality(high) {
  GFX.high = high; water.visible = high; waterLow.visible = !high;
  renderer.shadowMap.type = high ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024); sun.shadow.map?.dispose(); sun.shadow.map = null;
  renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 2) : 1); renderer.setSize(innerWidth, innerHeight);
  const gb = document.getElementById('gfxBtn'); if (gb) gb.textContent = `Graphics: ${high ? 'High' : 'Performance'}`;
}
document.getElementById('gfxBtn')?.addEventListener('click', () => setQuality(!GFX.high));
const clock = new THREE.Clock();
let hudT = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (S.running && !S.paused) {
    const frozen = inDialog() || !$('craft').classList.contains('hidden');
    if (!S.sailing && !frozen) updatePlayer(dt);
    if (!frozen) { updateWorld(dt, t); for (const c of creatures) updateCreature(c, dt); }
    if (S.sailing) {
      const rp = raftGroup.position; camera.position.lerp(new THREE.Vector3(rp.x - 10, 6, rp.z - 14), dt); camera.lookAt(rp.x, 2, rp.z + 20);
    } else updateCamera(dt);
    // Chips
    for (let i = chips.length - 1; i >= 0; i--) { const c = chips[i]; c.t += dt; c.v.y -= 15 * dt; c.m.position.addScaledVector(c.v, dt); if (c.t > 0.7) { scene.remove(c.m); chips.splice(i, 1); } }
    // Floating texts
    for (let i = dmgTexts.length - 1; i >= 0; i--) {
      const f = dmgTexts[i]; f.t += dt; f.pos.y += dt * 1.2; const v = f.pos.clone().project(camera);
      f.d.style.left = (v.x * 0.5 + 0.5) * innerWidth + 'px'; f.d.style.top = (-v.y * 0.5 + 0.5) * innerHeight + 'px'; f.d.style.opacity = 1 - f.t;
      if (f.t > 1 || v.z > 1) { f.d.remove(); dmgTexts.splice(i, 1); }
    }
    // Interaction prompt, quest, waypoint
    if (!S.sailing) {
      const it = !frozen && getInteractable();
      $('prompt').classList.toggle('hidden', !it && !P.resting);
      if (P.resting) $('prompt').innerHTML = 'Resting by the fire… time flows faster';
      else if (it) $('prompt').innerHTML = `<kbd>E</kbd> ${it.label}`;
      else if (S.campfire && player.position.distanceTo(S.campfire.pos) < 4) { $('prompt').classList.remove('hidden'); $('prompt').innerHTML = '<kbd>R</kbd> Hold to rest by the fire'; }
    }
    checkQuest();
    const q = Q[S.questIdx], target = q && q.target();
    waypoint.visible = !!target && !S.sailing;
    if (target) { waypoint.position.set(target.x, target.y + 3.2 + Math.sin(t * 3) * 0.2, target.z); waypoint.rotation.y = t * 2; }
    hudT -= dt; if (hudT <= 0) { hudT = 0.1; renderHUD(); renderQuest(); drawMinimap(target); }
  } else if (!S.running) {
    // Title screen flyover
    const a = t * 0.05; camera.position.set(Math.sin(a) * 120, 45, Math.cos(a) * 120); camera.lookAt(0, 5, 0);
    updateWorld(0, t); S.time = 0.3;
  }
  if (GFX.high) composer.render(); else renderer.render(scene, camera);
}
loop();

// ============================================================
// Title screen wiring
// ============================================================
document.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tabpage').forEach((p) => p.classList.toggle('hidden', p.id !== b.dataset.tab));
});
document.querySelectorAll('.gallery img').forEach((img) => img.onclick = () => { $('lightbox').querySelector('img').src = img.src; $('lightbox').classList.remove('hidden'); });
$('lightbox').onclick = () => $('lightbox').classList.add('hidden');
$('startBtn').onclick = () => {
  $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
  const first = !S.running;
  S.running = true; setPause(false); canvas.requestPointerLock();
  if (first) {
    S.started = performance.now();
    camYaw = P.yaw + Math.PI; camera.position.copy(player.position).add(new THREE.Vector3(0, 4, -7));
    setTimeout(() => say([['You', '...Salt. Sand. I\'m alive? The ship is gone.'], ['You', 'There is smoke over there, from a chimney. Someone lives on this island.']]), 600);
    toast('Follow the gold ◆ marker', false);
  }
};
window.ARG = { S, player, hero, poseHero, P, tools, camera, look: (y, pch) => { camYaw = y; if (pch !== undefined) camPitch = pch; }, snap: () => { updateCamera(1); composer.render(); return renderer.domElement.toDataURL("image/jpeg", 0.85); } };  // console access for playtesting
