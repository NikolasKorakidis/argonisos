// Argonisos — Island Prologue (three.js playtest prototype)
// Single-module game: world gen, characters, survival, combat, crafting, quests, sailing ending.
import * as THREE from 'three';
import { FBXLoader } from './jsm/loaders/FBXLoader.js';
import { Sky } from './jsm/objects/Sky.js';
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from './jsm/postprocessing/ShaderPass.js';
import { OutputPass } from './jsm/postprocessing/OutputPass.js';
import { VignetteShader } from './jsm/shaders/VignetteShader.js';
import { GLTFLoader } from './jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from './jsm/utils/SkeletonUtils.js';
import QTREES from './models/qtrees.js';
import { initAudio, snd, updateAmbience, setVolume, VOL } from './audio.js';

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

// ---- World layout (metres). +z is south, towards Pedias. ----
const ISLAND_R = 290;
const RUINS = new THREE.Vector3(40, 0, 150);        // old hill clearing (now just a trail junction)
const MOUNT = new THREE.Vector3(60, 0, -150);       // Mount Olympos
const CAVE_MOUTH = new THREE.Vector3(-4, 0, -96);  // Cave of Echoes: a ravine leads to a mouth in the mountain's flank,
const CAVE_DIR = new THREE.Vector3(64, 0, -54).normalize();   // a tunnel runs inward to a chamber
const CH_R = 13, TUN_W = 2.6, TUN_LEN = 12;
const CAVE = CAVE_MOUTH.clone().addScaledVector(CAVE_DIR, TUN_LEN + CH_R * 0.85);   // chamber centre
const CAVE_APPROACH = CAVE_MOUTH.clone().addScaledVector(CAVE_DIR, -16);
const LAKE = new THREE.Vector3(140, 0, -60);        // Lake Kastalia (+ waterfall)
const TEMPLE = new THREE.Vector3(205, 0, 60);       // Temple of Athena plateau
const SWAMP = new THREE.Vector3(-175, 0, 115);      // Stymphalian Marsh
const FOREST = new THREE.Vector3(-165, 0, -60);     // Hylaea Woods
const OLIVE = new THREE.Vector3(125, 0, 175);       // Olive terraces & vineyard
const TOWER = new THREE.Vector3(-150, 0, -212);     // Watchtower of Aeolus on the north-west cliffs
function baseHeight(x, z) {
  const d = Math.hypot(x, z * 1.05) / ISLAND_R;
  let h = (1 - d * d) * 14 + (fbm(x * 0.012 + 10, z * 0.012) - 0.5) * 20 + (fbm(x * 0.05, z * 0.05) - 0.5) * 4 - 1.5;
  const dm = Math.hypot(x - MOUNT.x, z - MOUNT.z);                       // the mountain: broad base, rugged ridges
  h += 100 * Math.exp(-(dm * dm) / (2 * 60 * 60)) * (0.8 + 0.4 * fbm(x * 0.035, z * 0.035));
  h += 20 * Math.exp(-(dm * dm) / (2 * 108 * 108));
  const dw = Math.hypot(x - TOWER.x, z - TOWER.z); h += 24 * Math.exp(-(dw * dw) / (2 * 42 * 42));   // cliff headland
  const dp = Math.hypot(x - TEMPLE.x, z - TEMPLE.z); h += 12 * Math.exp(-(dp * dp) / (2 * 45 * 45)); // temple hill
  const ds = Math.hypot(x - SWAMP.x, z - SWAMP.z), sw = clamp(1 - (ds - 55) / 40, 0, 1);        // swamp basin
  h = lerp(h, Math.max(0.02, 0.24 + (fbm(x * 0.08, z * 0.08) - 0.5) * 1.3), sw * sw * (3 - 2 * sw));   // never below sea level, or the ocean shows through
  h -= Math.max(0, d - 0.9) * 140;                                          // coastline
  return h;
}
function segDist(x, z, a, b) { const dx = b.x - a.x, dz = b.z - a.z, t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1); return Math.hypot(x - a.x - dx * t, z - a.z - dz * t); }
// foot: distance outside the walkable cave (≤0 inside: ravine, tunnel, chamber); over: distance from the roofed part
function caveDist(x, z) {
  const ch = Math.hypot(x - CAVE.x, z - CAVE.z) - CH_R, tun = segDist(x, z, CAVE_MOUTH, CAVE) - TUN_W, rav = segDist(x, z, CAVE_APPROACH, CAVE_MOUTH) - 3.2;
  return { foot: Math.min(ch, tun, rav), over: Math.min(ch, tun) - 2, roofed: Math.min(ch, tun) < 0 && ((x - CAVE_MOUTH.x) * CAVE_DIR.x + (z - CAVE_MOUTH.z) * CAVE_DIR.z) > -0.5 };
}
const flatten = (h, x, z, c, r0, r1, target) => { const t = clamp((Math.hypot(x - c.x, z - c.z) - r0) / (r1 - r0), 0, 1); return lerp(target, h, t * t * (3 - 2 * t)); };
const RUINS_Y = baseHeight(RUINS.x, RUINS.z) + 3, CAVE_Y = baseHeight(CAVE_MOUTH.x, CAVE_MOUTH.z) - 2.5, TEMPLE_Y = baseHeight(TEMPLE.x, TEMPLE.z) + 1.5, LAKE_Y = baseHeight(LAKE.x, LAKE.z) - 1;
const SUMMIT = MOUNT.clone(), SUMMIT_Y = baseHeight(MOUNT.x, MOUNT.z) - 14; const ARENA_R = 38; SUMMIT.y = SUMMIT_Y;   // boss arena on the peak
RUINS.y = RUINS_Y; CAVE.y = CAVE_Y; TEMPLE.y = TEMPLE_Y; LAKE.y = LAKE_Y;
let CHAN = null;   // sea channel into Nestor's cove, set once the cove is found
let CAUSEWAY = null;
let HUT_PAD = null;   // flat ground under Nestor's farmhouse, smithy and paddock, set once the hut is placed   // the marsh trail, raised a little above the water
function heightAt(x, z) {
  let h = baseHeight(x, z);
  h = flatten(h, x, z, RUINS, 10, 22, RUINS_Y);
  h = flatten(h, x, z, SUMMIT, ARENA_R, ARENA_R + 28, SUMMIT_Y);
  // Cave: the mountain is kept tall over the chamber, then the footprint is carved down to the cave floor
  const cd = caveDist(x, z);
  if (cd.over < 10) h = Math.max(h, lerp(CAVE_Y + 13, h, clamp(cd.over / 10, 0, 1)));
  if (cd.foot < 6) { const t = clamp(cd.foot / 6, 0, 1); h = Math.min(h, lerp(CAVE_Y, h, t * t * (3 - 2 * t))); }
  h = flatten(h, x, z, TEMPLE, 26, 40, TEMPLE_Y);
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z) * (0.85 + fbm(x * 0.045 + 3, z * 0.045 - 7) * 0.4);   // lake bowl, irregular shore
  h = flatten(h, x, z, LAKE, 22, 40, LAKE_Y + 0.6);
  if (dl > 20 && dl < 36) h = Math.max(h, LAKE_Y + 0.55 - Math.max(0, dl - 31) * 0.25);   // a natural rim so the lake never spills downhill
  if (dl < 24) h = Math.min(h, LAKE_Y - 2.4 * (1 - dl / 24) + 0.2);
  if (CAUSEWAY && Math.hypot(x - SWAMP.x, z - SWAMP.z) < 120) {
    let d = 99; for (let i = 0; i < CAUSEWAY.length - 1; i++) { const [ax, az] = CAUSEWAY[i], [bx, bz] = CAUSEWAY[i + 1]; if (Math.abs(x - ax) > 30 && Math.abs(x - bx) > 30) continue; const dx = bx - ax, dz = bz - az, q = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1); d = Math.min(d, Math.hypot(x - ax - dx * q, z - az - dz * q)); }
    if (d < 5) { const k = clamp((d - 1.9) / 3, 0, 1); h = Math.max(h, lerp(0.85, h, k * k * (3 - 2 * k))); }
  }
  if (HUT_PAD) h = flatten(h, x, z, HUT_PAD, 17, 25, HUT_PAD.y);
  if (CHAN) {                                                                  // cove + channel out to the open sea
    const w = (fbm(x * 0.07, z * 0.07) - 0.5) * 5, dc = segDist(x, z, CHAN.a, CHAN.b) + w, db = Math.hypot(x - CHAN.a.x, z - CHAN.a.z) + w;
    const k1 = clamp((dc - 4.5) / 9, 0, 1), k2 = clamp((db - 7) / 9, 0, 1);
    h = Math.min(h, lerp(-2.2, h, k1 * k1 * (3 - 2 * k1)), lerp(-1.6, h, k2 * k2 * (3 - 2 * k2)));
  }
  return h;
}
const REGIONS = [
  { key: 'cave', name: 'Cave of Echoes', sub: 'Something old sleeps in the dark', c: CAVE, r: 0 },
  { key: 'temple', name: 'Temple of Athena', sub: 'Marble that remembers the gods', c: TEMPLE, r: 42 },
  { key: 'lake', name: 'Lake Kastalia', sub: 'Snowmelt from the high peaks', c: LAKE, r: 38 },
  { key: 'summit', name: 'Throne of Olympos', sub: 'A champion waits above the clouds', c: SUMMIT, r: ARENA_R + 12 },
  { key: 'tower', name: 'Watchtower of Aeolus', sub: 'Climb it to see the whole island', c: TOWER, r: 55 },
  { key: 'mountain', name: 'Mount Olympos', sub: 'Thin air, cold stone, old snow', c: MOUNT, r: 100, minH: 26 },
  { key: 'swamp', name: 'Stymphalian Marsh', sub: 'Keep to the reeds. Mind the mist', c: SWAMP, r: 92 },
  { key: 'forest', name: 'Hylaea Woods', sub: 'Deep, old and never quiet', c: FOREST, r: 105 },
  { key: 'olive', name: 'Olive Terraces', sub: 'Groves planted by hands long gone', c: OLIVE, r: 70 },
];
const MEADOW = { key: 'meadow', name: "Nestor's Cove", sub: 'Where the sea left you' };
function regionAt(x, z, h = heightAt(x, z)) {
  if (caveDist(x, z).roofed) return REGIONS[0];
  for (const R of REGIONS) if (Math.hypot(x - R.c.x, z - R.c.z) < R.r && (!R.minH || h > R.minH)) return R;
  return MEADOW;
}

// ============================================================
// Renderer / scene
// ============================================================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Colour grade lives inside tone mapping: saturation, a warm push and teal shadows, then ACES. Every material
// already runs this code, so the grade costs nothing extra (it used to be its own full-screen pass).
THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace('vec3 CustomToneMapping( vec3 color ) { return color; }',
  `vec3 CustomToneMapping( vec3 color ) {
    float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = max(mix(vec3(l), color, 1.12) * vec3(1.04, 1.0, 0.93) + (1.0 - smoothstep(0.0, 0.5, l)) * vec3(-0.012, 0.01, 0.03), 0.0);
    return ACESFilmicToneMapping(color); }`);
renderer.toneMapping = THREE.CustomToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9cc8e8, 160, 1150);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 3000);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

const hemi = new THREE.HemisphereLight(0xbfdcff, 0x3f6a5a, 0.9);
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
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'); g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, N, N); g.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {                       // short vertical-ish strokes read as a grass carpet from afar
    const x = rand() * N, y = rand() * N, l = rr(3, 9), a = rr(-0.5, 0.5), v = Math.floor(rr(185, 255));
    g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = rr(1, 2.2);
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.sin(a) * l, y + oy - Math.cos(a) * l); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(220, 220);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

// Physical sky (Rayleigh/Mie scattering) + a copy used to build reflection lighting
const sky = new Sky(); sky.scale.setScalar(2500);   // used only to light reflections (env map)
// Sky dome: day gradient + sun; at night a starfield with the Milky Way, a cratered moon with a halo,
// and on some nights aurora curtains rippling over the northern horizon
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(2400, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x3a78c8) }, hor: { value: new THREE.Color(0xb8dcf0) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(0xfff0c8) },
    night: { value: 0 }, uT: { value: 0 }, moonDir: { value: new THREE.Vector3(0, 1, 0) }, aurora: { value: 0 } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol, moonDir; uniform float night, uT, aurora; varying vec3 vDir;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
    float stars(vec3 d, float scale, float thr){ vec2 uv = vec2(atan(d.z, d.x) * scale, asin(clamp(d.y, -1.0, 1.0)) * scale); vec2 id = floor(uv), f = fract(uv) - 0.5;
      float h = h21(id); if (h < thr) return 0.0; vec2 o = vec2(h21(id + 3.1), h21(id + 7.7)) - 0.5; float r = length(f - o * 0.6);
      float tw = 0.65 + 0.35 * sin(uT * (1.5 + h * 4.0) + h * 60.0); return smoothstep(0.09, 0.0, r) * tw * (h - thr) / (1.0 - thr); }
    void main(){
      vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
      vec3 c = mix(hor, top, pow(h, 0.55));
      float s = max(dot(d, normalize(sunDir)), 0.0);
      c += sunCol * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.25) * (1.0 - night);
      if (night > 0.01 && d.y > -0.05) {
        float up = smoothstep(-0.02, 0.25, d.y);
        // Milky Way: a soft, mottled band across the sky with extra dense stars inside it
        vec3 N = normalize(vec3(0.35, 0.55, 0.76)); float band = exp(-pow(dot(d, N) / 0.2, 2.0));
        float neb = vn(d.xz * 9.0 + d.y * 4.0) * 0.6 + vn(d.xz * 23.0) * 0.4;
        c += vec3(0.55, 0.6, 0.85) * band * (0.08 + neb * 0.16) * night * up;
        c -= vec3(0.03) * band * smoothstep(0.55, 0.8, vn(d.xz * 14.0)) * night;                      // dust lanes
        float st = stars(d, 160.0, 0.93) * 1.2 + stars(d, 320.0, 0.955) * 0.8 + stars(d, 320.0, 0.9) * band * 1.2;
        c += vec3(0.95, 0.97, 1.0) * st * night * up;
        // moon: disc with maria, a tight glow and a wide halo
        float m = dot(d, normalize(moonDir));
        vec3 md = normalize(moonDir), mt = normalize(cross(md, vec3(0.0, 1.0, 0.0))), mb = cross(mt, md); vec2 mp = vec2(dot(d, mt), dot(d, mb)) / 0.028;
        float disc = smoothstep(1.0, 0.96, length(mp)) * step(0.0, m);
        float maria = vn(mp * 2.2 + 4.0) * 0.6 + vn(mp * 5.0) * 0.4;
        c = mix(c, vec3(0.92, 0.93, 0.88) * (0.78 + maria * 0.3), disc * night);
        c += vec3(0.55, 0.62, 0.8) * (pow(max(m, 0.0), 900.0) * 0.8 + pow(max(m, 0.0), 40.0) * 0.12) * night;
        // aurora: layered curtains over the northern horizon (-z), green at the foot, violet at the top
        if (aurora > 0.01 && d.z < 0.2) {
          float az = atan(d.x, -d.z), alt = d.y;
          float curtain = 0.0;
          for (int i = 0; i < 3; i++) { float fi = float(i);
            float wave = sin(az * (3.0 + fi) + uT * (0.12 + fi * 0.05) + sin(az * 7.0 - uT * 0.2) * 0.6) * 0.06;
            float base = 0.07 + fi * 0.05 + wave, rays = 0.55 + 0.45 * vn(vec2(az * 40.0 + fi * 10.0, uT * 0.4));
            curtain += smoothstep(base, base + 0.02, alt) * smoothstep(base + 0.32, base + 0.05, alt) * rays * (1.0 - fi * 0.25); }
          float fade = smoothstep(0.2, -0.4, d.z) * smoothstep(1.3, 0.3, abs(az));
          vec3 ac = mix(vec3(0.15, 1.0, 0.55), vec3(0.6, 0.3, 1.0), smoothstep(0.1, 0.4, alt));
          c += ac * curtain * fade * aurora * night * 0.55;
        }
      }
      if (vDir.y < 0.0) c = hor;
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
scene.add(skyDome);
sky.material.uniforms.turbidity.value = 1.8;
sky.material.uniforms.rayleigh.value = 3.0; sky.material.uniforms.mieCoefficient.value = 0.004; sky.material.uniforms.mieDirectionalG.value = 0.85;
const sunDir = new THREE.Vector3(0, 1, 0), moonDir = new THREE.Vector3(0, 1, 0);
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene(); const envSky = new Sky(); envSky.material = sky.material; envSky.scale.setScalar(1000); envScene.add(envSky);
let envRT = null, envTimer = 0;
function refreshEnvironment() {
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene, 0.04); scene.environment = envRT.texture;
}
const GFX = { high: false, level: 'medium', near: 70, scale: 1, base: 1 };

// Material helpers: flat-shaded world, smooth "Pixar" characters
const flatMats = {};
const flat = (c) => flatMats[c] || (flatMats[c] = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9 }));
const smooth = (c, r = 0.55) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m); return m;
}

// ============================================================
// Find beach on the south side (facing Greece) for the dock
const DOCK = new THREE.Vector3();
for (let r = 150; r < 400; r += 0.5) { if (heightAt(0, r) < 0.2) { DOCK.set(0, 0, r); break; } }
// Open the cove to the sea: a channel runs from the pond south to deep water
{ let sea = null; for (let r = DOCK.z + 6; r < 460; r += 1) if (baseHeight(0, r) < -3) { sea = new THREE.Vector3(0, 0, r + 12); break; }
  CHAN = { a: DOCK.clone().add(new THREE.Vector3(0, 0, 7)), b: sea || new THREE.Vector3(0, 0, DOCK.z + 80) }; }
const SEA_OUT = CHAN.b.clone();
// The wreck: your boat, broken on the cove's west shore. You wake up beside it.
const WRECK = DOCK.clone().add(new THREE.Vector3(-7, 0, 2));
for (let dx = -2; dx > -22; dx -= 0.5) { const h = heightAt(DOCK.x + dx, DOCK.z + 2); if (h > -0.35 && h < 0.25) { WRECK.set(DOCK.x + dx, 0, DOCK.z + 2); break; } }
const START = WRECK.clone().add(new THREE.Vector3(3.8, 0, -3.2)); START.y = heightAt(START.x, START.z);
const HUT = new THREE.Vector3(-12, 0, DOCK.z - 26);
// Level a pad for the house, the smithy and the paddock so nothing sits on a slope or floats
{ const c = new THREE.Vector3(HUT.x - 6 * Math.cos(0.3) - Math.sin(0.3), 0, HUT.z + 6 * Math.sin(0.3) - Math.cos(0.3)); c.y = heightAt(HUT.x, HUT.z) + 0.05; HUT_PAD = c; }
HUT.y = heightAt(HUT.x, HUT.z);
// Dirt paths: dock → start → Nestor's hut → winding up to the ruins
// A trail network like a real island: every landmark is reachable on foot
const PATHS = [
  [[DOCK.x, DOCK.z - 3], [START.x - 2, START.z + 2], [HUT.x + 3, HUT.z + 7], [HUT.x + 11.5, HUT.z + 1.7], [HUT.x + 16, HUT.z - 20], [RUINS.x - 6, RUINS.z + 12]],
  [[RUINS.x, RUINS.z - 10], [30, 90], [10, 20], [-4, -40], [CAVE_APPROACH.x, CAVE_APPROACH.z], [CAVE_MOUTH.x, CAVE_MOUTH.z]],
  [[10, 20], [80, 30], [150, 45], [TEMPLE.x - 26, TEMPLE.z]],
  [[80, 30], [120, -10], [LAKE.x - 14, LAKE.z + 18]],
  [[RUINS.x + 10, RUINS.z], [OLIVE.x - 30, OLIVE.z - 10]],
  [[10, 20], [-60, 30], [-110, -20], [-150, -120], [TOWER.x + 8, TOWER.z + 20]],
  [[-60, 30], [-110, 80], [SWAMP.x + 30, SWAMP.z - 10]],
];
// The Ascent: a switchback road that spirals up Mount Olympos from the cave junction to the summit arena.
// Its bed is cut into the slope as a level shelf (see heightAt below), so it reads as a built road, not a scribble.
const ASCENT = [];
{
  const S0 = [-9, -60];   // branches off the cave trail ~30 m before the ravine
  const a0 = Math.atan2(S0[1] - MOUNT.z, S0[0] - MOUNT.x), r0 = Math.hypot(S0[0] - MOUNT.x, S0[1] - MOUNT.z), sweep = Math.PI * 2.3, n = 96;
  for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + sweep * t, r = lerp(r0, ARENA_R + 1, Math.pow(t, 0.85)) + Math.sin(t * 40) * 2.5 * (1 - t);
    ASCENT.push([MOUNT.x + Math.cos(a) * r, MOUNT.z + Math.sin(a) * r]); }
}
// Smooth every trail with a centripetal Catmull-Rom so corners become curves (sampled every ~3 m)
const PATH_KIND = PATHS.map((_, i) => (i === 2 ? 'paved' : 'dirt'));   // the Sacred Way to the temple is paved
PATHS.push(ASCENT); PATH_KIND.push('ascent');
for (let k = 0; k < PATHS.length; k++) {
  if (PATHS[k] === ASCENT) continue;
  const c = new THREE.CatmullRomCurve3(PATHS[k].map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const n = Math.max(2, Math.ceil(c.getLength() / 3)); PATHS[k] = c.getSpacedPoints(n).map((v) => [v.x, v.z]);
}
CAUSEWAY = PATHS[6];   // the marsh trail
function pathDist(x, z) {
  let best = 1e9;
  for (const P of PATHS) for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az;
    if ((x < Math.min(ax, bx) - 20) || (x > Math.max(ax, bx) + 20) || (z < Math.min(az, bz) - 20) || (z > Math.max(az, bz) + 20)) continue;   // cheap reject
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best + (fbm(x * 0.2, z * 0.2) - 0.5) * 0.9;     // wobbly edges
}
// Cut the Ascent into the mountain: a monotonic height profile along the road, blended into the slope
{
  const prof = [], cum = [0];
  for (let i = 0; i < ASCENT.length; i++) { prof.push(heightAt(ASCENT[i][0], ASCENT[i][1])); if (i) cum.push(cum[i - 1] + Math.hypot(ASCENT[i][0] - ASCENT[i - 1][0], ASCENT[i][1] - ASCENT[i - 1][1])); }
  const sm = prof.map((_, i) => { let s = 0, w = 0; for (let j = Math.max(0, i - 5); j <= Math.min(prof.length - 1, i + 5); j++) { s += prof[j]; w++; } return s / w; });
  for (let i = 1; i < sm.length; i++) sm[i] = Math.max(sm[i], sm[i - 1] + 0.05);
  const end = sm.length - 1, lift = SUMMIT_Y - sm[end];
  for (let i = 0; i < sm.length; i++) sm[i] += lift * Math.pow(cum[i] / cum[end], 3);            // ease the last stretch into the arena
  var ASCENT_H = sm, ASCENT_LEN = cum;
  const h0 = heightAt;
  heightAt = (x, z) => {
    const h = h0(x, z);
    if (Math.hypot(x - MOUNT.x, z - MOUNT.z) > 110) return h;
    let best = 9, bh = 0;
    for (let i = 0; i < ASCENT.length - 1; i++) {
      const [ax, az] = ASCENT[i], [bx, bz] = ASCENT[i + 1];
      if (x < Math.min(ax, bx) - 9 || x > Math.max(ax, bx) + 9 || z < Math.min(az, bz) - 9 || z > Math.max(az, bz) + 9) continue;
      const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d < best) { best = d; bh = lerp(sm[i], sm[i + 1], t); }
    }
    if (best >= 9) return h;
    const k = clamp((best - 2.6) / 6, 0, 1), s = k * k * (3 - 2 * k);
    return lerp(bh, h, s);
  };
}
// Bake height + trail distance into a 1.25 m grid once; everything else samples it (fast world generation)
const GN = 513, GW = 640, GSTEP = GW / (GN - 1), HGRID = new Float32Array(GN * GN), PGRID = new Float32Array(GN * GN);
for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) { const x = -GW / 2 + i * GSTEP, z = -GW / 2 + j * GSTEP; HGRID[j * GN + i] = heightAt(x, z); PGRID[j * GN + i] = pathDist(x, z); }
function sampleGrid(G, x, z) {
  const fx = clamp((x + GW / 2) / GSTEP, 0, GN - 1.001), fz = clamp((z + GW / 2) / GSTEP, 0, GN - 1.001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * GN + i;
  return lerp(lerp(G[k], G[k + 1], u), lerp(G[k + GN], G[k + GN + 1], u), v);
}
heightAt = (x, z) => (Math.abs(x) > GW / 2 || Math.abs(z) > GW / 2 ? -30 : sampleGrid(HGRID, x, z));
pathDist = (x, z) => sampleGrid(PGRID, x, z);
// Terrain + sea + sky dressing
// ============================================================
{
  const size = 640, seg = 300;
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, cols = [];
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  const C = (h) => new THREE.Color(h);
  const cSand = C(0xe3cf98), cGrass = C(0x4a6a2e), cGrass2 = C(0x35532a), cDry = C(0x7d8438), cDirt = C(0xb59a6a), cRock = C(0x8a8178), cRock2 = C(0x6d665f),
    cDeep = C(0xb8a676), cSnow = C(0xf2f5f8), cMud = C(0x4a4630), cMoss = C(0x3d5226), cForest = C(0x2f4524), cOlive = C(0x8a8a4a), cMarble = C(0xcfc6b0);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i), slope = 1 - nrm.getY(i), R = regionAt(x, z, h);
    let c;
    if (h < 0) c = cDeep; else if (h < 1.1 && R.key !== 'swamp') c = cSand;
    else { c = cGrass.clone().lerp(cGrass2, fbm(x * 0.08, z * 0.08)); c.lerp(cDry, clamp((fbm(x * 0.03 + 9, z * 0.03 - 4) - 0.5) * 2.5, 0, 0.6)); }
    if (R.key === 'swamp' || (Math.hypot(x - SWAMP.x, z - SWAMP.z) < 110 && h < 1.4)) c = cMud.clone().lerp(cMoss, fbm(x * 0.1, z * 0.1));
    if (R.key === 'forest') c.lerp(cForest, 0.6);
    if (R.key === 'olive') c.lerp(cOlive, 0.35 + fbm(x * 0.2, z * 0.2) * 0.3);
    if (h >= 1.1) { const pd = pathDist(x, z);
      c = c.clone().lerp(C(0x6d5a3a), clamp((2.9 - pd) / 0.7, 0, 1) * 0.55);                                     // worn, darker rim
      c.lerp(cDirt.clone().lerp(C(0xcbb892), fbm(x * 0.6, z * 0.6)), clamp((1.9 - pd) / 0.5, 0, 1)); }            // gravel core
    const rocky = clamp((slope - 0.22) * 4, 0, 1) + clamp((h - 34) / 10, 0, 1);
    c = c.clone().lerp(cRock.clone().lerp(cRock2, fbm(x * 0.15, z * 0.15)), clamp(rocky, 0, 1));
    const snow = clamp((h - 56 - fbm(x * 0.06, z * 0.06) * 10) / 5, 0, 1) * clamp(1 - slope * 1.5, 0.35, 1);
    c.lerp(cSnow, snow);
    if (Math.hypot(x - TEMPLE.x, z - TEMPLE.z) < 24) c.lerp(cMarble, 0.25);
    { const cd = caveDist(x, z); if (cd.foot < 4) c = c.clone().lerp(C(0x5a544c).lerp(cMud, fbm(x * 0.3, z * 0.3) * 0.6), clamp(1 - cd.foot / 4, 0, 1)); }
    const j = 0.93 + hash(x, z) * 0.1; cols.push(c.r * j, c.g * j, c.b * j);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const t = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.95, map: groundDetail, envMapIntensity: 0.4 }));
  t.receiveShadow = true; scene.add(t);
}
// One cheap water shader for sea, lake and marsh: depth colour from the baked heightmap, two scrolling ripple
// layers, fresnel sky reflection, sun glints and animated shoreline foam. Far cheaper than a mirror pass.
const WATER_U = { uTime: { value: 0 }, uH: { value: null }, uNorm: { value: waterNormals }, uSky: { value: new THREE.Color(0x3a78c8) },
  uHor: { value: new THREE.Color(0xb8dcf0) }, uDay: { value: 1 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(0xfff1d6) } };
function makeWaterMat({ level, shallow, deep, foam = 1, depthScale = 6, clarity = 1, weed = 0, ripple = 1 }) {
  const u = Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), WATER_U,
    { uLevel: { value: level }, uShallow: { value: new THREE.Color(shallow) }, uDeep: { value: new THREE.Color(deep) }, uFoam: { value: foam }, uDS: { value: depthScale }, uClar: { value: clarity },
      uWeed: { value: weed }, uRip: { value: ripple } });
  return new THREE.ShaderMaterial({
    uniforms: u, transparent: true, fog: true, depthWrite: false,
    vertexShader: `varying vec3 vW; #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition; #include <fog_vertex> }`.replace(/#include <(\w+)>/g, '\n#include <$1>\n'),
    fragmentShader: `uniform float uTime, uLevel, uFoam, uDS, uClar, uWeed, uRip, uDay; uniform sampler2D uH, uNorm; uniform vec3 uShallow, uDeep, uSky, uHor, uSunDir, uSunCol; varying vec3 vW;
      #include <fog_pars_fragment>
      vec3 nrm(vec2 uv){ vec3 t = texture2D(uNorm, uv).rgb * 2.0 - 1.0; return vec3(t.r, t.b, t.g); }
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        float t = uTime;
        vec2 huv = (vW.xz + 320.0) / 640.0;
        float ground = (huv.x > 0.0 && huv.x < 1.0 && huv.y > 0.0 && huv.y < 1.0) ? texture2D(uH, huv).r : -40.0;
        float depth = max(uLevel - ground, 0.0);
        vec3 V = normalize(cameraPosition - vW); float dist = length(cameraPosition - vW);
        // three ripple scales; far away the small ones fade so the surface doesn't sparkle into noise
        float nk = mix(1.0, 0.3, smoothstep(40.0, 280.0, dist));
        vec3 n1 = nrm(vW.xz * 0.035 * uRip + vec2(t * 0.02, t * 0.013)), n2 = nrm(vW.xz * 0.11 * uRip - vec2(t * 0.03, -t * 0.021)), n3 = nrm(vW.xz * 0.008 + vec2(-t * 0.004, t * 0.006));
        vec3 n = normalize(vec3((n1.x + n2.x * 0.7 * nk + n3.x * 1.3) * nk, 3.2, (n1.z + n2.z * 0.7 * nk + n3.z * 1.3) * nk));
        float F = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        // body colour: light absorbed with depth (Beer-Lambert)
        float ab = 1.0 - exp(-depth / uDS * 2.4);
        vec3 body = mix(uShallow, uDeep, ab) * mix(vec3(0.07, 0.1, 0.18), vec3(1.0), uDay);   // water darkens to moonlit blue at night
        // caustics dancing on the shallow bottom
        vec2 cp = vW.xz * 0.42 + n.xz * 0.8;
        float c1 = abs(sin(cp.x * 1.7 + t * 1.1 + sin(cp.y * 1.3 - t * 0.7) * 1.6)), c2 = abs(sin(cp.y * 1.9 - t * 0.9 + sin(cp.x * 1.1 + t * 0.6) * 1.5));
        body += pow(1.0 - min(c1, c2), 7.0) * (1.0 - ab) * smoothstep(0.05, 0.7, depth) * 0.45 * min(uClar, 1.5) * (1.0 - uWeed * 0.8);
        // reflection: sky gradient with drifting cloud shapes, and the sun
        vec3 R = reflect(-V, n);
        vec3 refl = mix(uHor, uSky, clamp(R.y * 1.5, 0.0, 1.0));
        float cl = vn(R.xz / (R.y + 0.3) * 1.6 + vec2(t * 0.015, 0.0)) * 0.65 + vn(R.xz / (R.y + 0.3) * 4.0) * 0.35;
        refl = mix(refl, vec3(1.0), smoothstep(0.55, 0.8, cl) * 0.35 * clamp(R.y * 3.0, 0.0, 1.0));
        vec3 col = mix(body, refl, clamp(F * 0.85 + 0.04, 0.0, 1.0));
        vec3 Hh = normalize(normalize(uSunDir) + V); float sp = max(dot(n, Hh), 0.0);
        col += uSunCol * (pow(sp, 320.0) * 3.2 + pow(sp, 45.0) * 0.1) * (1.0 - uWeed * 0.6);
        // shoreline: a solid wet line plus foam lapping in and out, broken up by noise
        float edge = 1.0 - smoothstep(0.0, 1.0, depth);
        float nz = texture2D(uNorm, vW.xz * 0.07 + vec2(t * 0.01, -t * 0.007)).r;
        float lap = smoothstep(0.6, 0.95, sin(depth * 8.0 - t * 1.5 + nz * 5.0) * 0.5 + 0.5);
        float foam = clamp(pow(edge, 3.0) * 1.3 + lap * edge * 0.9, 0.0, 1.0) * smoothstep(0.3, 0.62, nz + edge * 0.45) * uFoam;
        col = mix(col, vec3(0.96, 0.98, 1.0) * mix(0.25, 1.0, uDay), foam * 0.85);
        // marsh: floating duckweed rafts
        float wk = 0.0;
        if (uWeed > 0.0) { float w = vn(vW.xz * 0.11) * 0.6 + vn(vW.xz * 0.45) * 0.4; wk = smoothstep(0.52, 0.6, w) * uWeed;
          col = mix(col, vec3(0.2, 0.31, 0.09) * (0.75 + 0.5 * vn(vW.xz * 3.0)), wk); }
        float alpha = mix(0.4, 0.97, smoothstep(0.0, 1.6 / uClar, depth));
        alpha = max(alpha, max(foam, wk)) * smoothstep(0.0, 0.05, depth + foam * 0.05);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}
const waterLow = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 1, 1).rotateX(-Math.PI / 2), makeWaterMat({ level: -0.15, shallow: 0x4ad3c8, deep: 0x0a3b66, foam: 1, depthScale: 7 }));
waterLow.position.y = -0.15; waterLow.renderOrder = 1; scene.add(waterLow);

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
  land.position.z = ISLAND_R + 520; scene.add(land);
}
// Clouds
const clouds = [], _cc = new THREE.Color(), _cd = new THREE.Color();
const cloudTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = rr(50, 206), y = rr(55, 95) - Math.sin((x - 50) / 156 * Math.PI) * 30, r = rr(18, 36);
    const gr = g.createRadialGradient(x, y - r * 0.3, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(245,247,252,0.8)'); gr.addColorStop(1, 'rgba(220,228,240,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
for (let i = 0; i < 38; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, transparent: true, depthWrite: false, opacity: rr(0.8, 1), color: new THREE.Color(1.5, 1.5, 1.55) }));
  const a2 = rr(0, 6.28), d = rr(200, 1300), w = rr(110, 240);
  sp.scale.set(w, w * 0.5, 1); sp.position.set(Math.cos(a2) * d, rr(190, 280), Math.sin(a2) * d); scene.add(sp); clouds.push(sp);
}


// ============================================================
// Colliders & world objects
// ============================================================
const colliders = [];  // {x,z,r,alive:()=>bool}
const resources = [];  // trees / rocks (hit with swings)
const pickups = [];    // E-interactables: branches, pebbles, bushes, reeds, chest
function landSpot(minH, maxH, avoid = []) {
  for (let i = 0; i < 200; i++) {
    const x = rr(-ISLAND_R, ISLAND_R), z = rr(-ISLAND_R, ISLAND_R), h = heightAt(x, z);
    if (h < minH || h > maxH) continue;
    if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r)) continue;
    return new THREE.Vector3(x, h, z);
  }
  return null;
}

const AVOID = [{ x: HUT.x, z: HUT.z, r: 16 }, { x: OLIVE.x, z: OLIVE.z, r: 19 }, { x: SUMMIT.x, z: SUMMIT.z, r: ARENA_R + 8 }, { x: DOCK.x, z: DOCK.z, r: 12 }, { x: START.x, z: START.z, r: 5 }, { x: WRECK.x, z: WRECK.z, r: 8 },
  { x: CAVE.x, z: CAVE.z, r: CH_R + 8 }, { x: CAVE_MOUTH.x, z: CAVE_MOUTH.z, r: 12 }, { x: CAVE_APPROACH.x, z: CAVE_APPROACH.z, r: 8 }, { x: TEMPLE.x, z: TEMPLE.z, r: 30 }, { x: LAKE.x, z: LAKE.z, r: 26 }, { x: TOWER.x, z: TOWER.z, r: 10 }];

const windUniformEarly = { value: 0 };
// --- Props: every tree/rock species is one merged geometry, drawn with InstancedMesh per 100 m chunk
// (frustum culling per chunk keeps thousands of trees cheap). Trees sway in the wind in the vertex shader.
const trunkMat = flat(0x7a4f2c), birchMat = flat(0xe9e2d2), rockMat = flat(0x9b958c);
// Leaf-cluster texture (drawn once): ~30 pointed leaves with midribs on transparent background, near-neutral so species tint it
const leafTex = (() => {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  for (let i = 0; i < 34; i++) {
    const a = rand() * 6.28, d = Math.sqrt(rand()) * N * 0.36, x = N / 2 + Math.cos(a) * d, y = N / 2 + Math.sin(a) * d, L = rr(34, 56), W = L * rr(0.34, 0.45), rot = a + rr(-0.6, 0.6);
    const v = Math.floor(rr(185, 255)); g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = `rgb(${v * 0.92},${v},${v * 0.82})`; g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, -W, L / 2, 0); g.quadraticCurveTo(0, W, -L / 2, 0); g.fill();
    g.strokeStyle = `rgba(40,50,20,0.35)`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
})();
const _sv1 = new THREE.Vector3(), _sv2 = new THREE.Vector3(), _sv3 = new THREE.Vector3(), _sv4 = new THREE.Vector3(), _sv5 = new THREE.Vector3();
let CARD_PARTS = [];   // collected while building a tree's high-detail version
function leafCards(centre, rx, ry, n, color, size0 = 1.5, size1 = 2.2, nc = centre) {
  if (PROP_LO) return;
  for (let i = 0; i < n; i++) {
    const u = rand() * 6.28, v = Math.acos(rr(-0.55, 1)), sh = rr(0.72, 1.08);
    const p = new THREE.Vector3(Math.sin(v) * Math.cos(u) * rx * sh, Math.cos(v) * ry * sh, Math.sin(v) * Math.sin(u) * rx * sh).add(centre);
    const size = rr(size0, size1), g = new THREE.PlaneGeometry(size, size);
    g.rotateZ(rand() * 6.28); g.rotateX(rr(-1.2, 1.2)); g.rotateY(rand() * 6.28); g.translate(p.x, p.y, p.z);
    const nrm = p.clone().sub(nc); nrm.y = nrm.y / ry * rx + 0.35; nrm.normalize();   // soft, rounded crown lighting
    const na = g.attributes.normal; for (let k = 0; k < na.count; k++) na.setXYZ(k, nrm.x, nrm.y, nrm.z);
    CARD_PARTS.push([g, new THREE.Color(color).offsetHSL(rr(-0.02, 0.02), rr(-0.05, 0.05), rr(-0.06, 0.06)).getHex()]);
  }
}
function mergeCards(parts) {
  const pos = [], nor = [], col = [], uv = [];
  for (const [g0, c] of parts) { const g = g0.index ? g0.toNonIndexed() : g0, a = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv, cl = new THREE.Color(c);
    for (let i = 0; i < a.count; i++) { pos.push(a.getX(i), a.getY(i), a.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(t.getX(i), t.getY(i)); const j = 0.72 + (n.getY(i) * 0.5 + 0.5) * 0.5; col.push(cl.r * j, cl.g * j, cl.b * j); } }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeBoundingSphere(); return g;
}
function mergeGeometries(geos) {      // concatenate geometries (non-indexed) sharing the first one's attributes
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g)), out = new THREE.BufferGeometry();
  for (const name of Object.keys(list[0].attributes)) {
    const size = list[0].attributes[name].itemSize, arr = new Float32Array(list.reduce((n, g) => n + g.attributes[name].count * size, 0)); let o = 0;
    for (const g of list) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere(); return out;
}
function mergeParts(parts) {            // parts: [geometry(already placed), hexColour]; keeps each part's normals
  const pos = [], nor = [], col = [];
  for (const [g0, c] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0; if (!g.attributes.normal) g.computeVertexNormals();
    const cl = new THREE.Color(c).offsetHSL(rr(-0.008, 0.008), rr(-0.02, 0.02), rr(-0.012, 0.012)), a = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < a.count; i++) {
      pos.push(a.getX(i), a.getY(i), a.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i));
      const j = 0.74 + (n.getY(i) * 0.5 + 0.5) * 0.4;           // darker underside, sun-kissed tops (cheap fake AO)
      col.push(cl.r * j, cl.g * j, cl.b * j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeBoundingSphere(); return g;
}
// Fluffy canopy blob: normals point away from the canopy centre so the whole crown shades as one soft volume
let PROP_LO = false;   // true while building the far-distance LOD
function blob(r, x, y, z, centre, stretchY = 1, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, PROP_LO ? 0 : detail); g.translate(x, y, z);
  const a = g.attributes.position, v = new THREE.Vector3(), n = new Float32Array(a.count * 3);
  for (let k = 0; k < a.count; k++) {
    v.fromBufferAttribute(a, k); v.x += (hash(v.x * 9, v.z * 9) - 0.5) * r * 0.25; v.y += (hash(v.y * 9, v.x * 5) - 0.5) * r * 0.2;
    a.setXYZ(k, v.x, v.y, v.z); v.sub(centre); v.y /= stretchY; v.normalize(); n.set([v.x, v.y, v.z], k * 3);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); return g;
}
function limb(r0, r1, len, x, y, z, rx, rz, seg = 6) {   // tapered trunk / branch segment
  const g = new THREE.CylinderGeometry(r1, r0, len, PROP_LO ? Math.min(seg, 4) : seg, PROP_LO ? 1 : 2); g.translate(0, len / 2, 0);
  g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); return g;
}
// Branching tree generator: a gnarled trunk that forks into limbs and twigs (tapered segments with knots), and every
// twig ends in a leaf cluster (a dark core blob + leaf cards), so the foliage actually grows out of the branches.
const UPV = new THREE.Vector3(0, 1, 0);
function segGeo(a, b, r0, r1, sides) {
  const d = b.clone().sub(a), L = d.length(), g = new THREE.CylinderGeometry(r1, r0, L, sides, 1, true); g.translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UPV, d.normalize())); g.translate(a.x, a.y, a.z); return g;
}
// Root flare: the trunk widens at its foot and buttress roots arch out from it and dive into the soil
// (they start on the trunk, bend over and end below ground, so nothing sits on top of the grass like a starfish)
function addRoots(P, R, n, bark) {
  if (!PROP_LO) P.push([new THREE.CylinderGeometry(R * 0.98, R * 1.38, 0.9, 12, 1, true).translate(0, 0.1, 0), bark]);
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + rr(-0.25, 0.25), a2 = a + rr(-0.25, 0.25), sp = rr(0.85, 1.2);
    const p0 = new THREE.Vector3(Math.cos(a) * R * 0.6, R * rr(0.55, 0.8), Math.sin(a) * R * 0.6);
    const p1 = new THREE.Vector3(Math.cos(a) * R * 1.3 * sp, R * 0.16, Math.sin(a) * R * 1.3 * sp);
    const p2 = new THREE.Vector3(Math.cos(a2) * R * 2.2 * sp, -0.5, Math.sin(a2) * R * 2.2 * sp);
    P.push([segGeo(p0, p1, R * 0.4, R * 0.27, PROP_LO ? 4 : 6), bark], [segGeo(p1, p2, R * 0.27, R * 0.06, PROP_LO ? 4 : 5), bark]);
    if (!PROP_LO) P.push([new THREE.IcosahedronGeometry(R * 0.28, 0).translate(p1.x, p1.y, p1.z), bark]);
  }
}
function growTree(P, o) {
  const tips = [], bark = o.bark, sidesOf = (r) => (PROP_LO ? 4 : r > 0.25 ? 8 : r > 0.1 ? 6 : 4);
  const grow = (a, dir, len, r0, depth) => {
    const n = PROP_LO ? 2 : (depth === o.depth ? o.trunkSteps : 3); let p = a.clone(), d = dir.clone(), r = r0; const rEnd = r0 * o.taper;
    for (let i = 0; i < n; i++) {
      d.x += rr(-o.gnarl, o.gnarl); d.z += rr(-o.gnarl, o.gnarl); d.y += o.rise; d.normalize();
      const q = p.clone().addScaledVector(d, len / n), r2 = lerp(r0, rEnd, (i + 1) / n);
      if (!PROP_LO || depth >= o.depth - 1) P.push([segGeo(p, q, r, r2, sidesOf(r)), bark]);   // far LOD: trunk + main limbs only
      if (!PROP_LO && r2 > 0.16) P.push([new THREE.IcosahedronGeometry(r2 * (o.knot || 1.08), 0).translate(q.x, q.y, q.z), bark]);   // joint knot hides the seams
      p = q; r = r2;
    }
    if (depth <= 0) { tips.push({ p, d }); return; }
    const k = o.kids(depth);
    for (let j = 0; j < k; j++) {
      const az = (j / k) * Math.PI * 2 + rr(-0.5, 0.5), tilt = o.spread(depth) * rr(0.8, 1.2);
      const side = new THREE.Vector3(Math.cos(az), 0, Math.sin(az)), cd = d.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(side, Math.sin(tilt)).normalize();
      grow(p, cd, len * o.lenF * rr(0.8, 1.15), Math.max(0.03, r * o.rF), depth - 1);
    }
    if (o.midKids && depth >= 1) { const mp = a.clone().lerp(p, rr(0.45, 0.7)), az = rand() * 6.28;   // a side limb from mid-branch
      grow(mp, new THREE.Vector3(Math.cos(az), 0.6, Math.sin(az)).normalize(), len * o.lenF * 0.8, Math.max(0.03, r0 * o.rF * 0.8), depth - 1); }
  };
  const ln = o.lean || 0, la = rand() * 6.28;
  grow(o.start ? o.start.clone() : new THREE.Vector3(0, -0.25, 0), o.dir ? o.dir.clone().normalize() : new THREE.Vector3(Math.cos(la) * ln + rr(-0.08, 0.08), 1, Math.sin(la) * ln + rr(-0.08, 0.08)).normalize(), o.trunkH, o.trunkR, o.depth);
  if (o.roots) addRoots(P, o.trunkR, o.roots, bark);
  // foliage at every tip, normals from the whole crown so it shades as one soft mass
  const cc = new THREE.Vector3(); tips.forEach((t) => cc.add(t.p)); cc.multiplyScalar(1 / Math.max(1, tips.length)); cc.y -= o.clusterR * 0.6;
  if (o.noLeaf) return tips;
  for (let ti = 0; ti < tips.length; ti++) {
    const t = tips[ti]; if (PROP_LO && ti % 3) continue;           // far LOD: one fat blob stands in for three clusters
    const c = t.p.clone().addScaledVector(t.d, o.clusterR * 0.35);
    const core = PROP_LO ? o.leaf : new THREE.Color(o.leaf).multiplyScalar(0.58).getHex();
    P.push([blob(o.clusterR * (PROP_LO ? 1.7 : o.core || 0.62), c.x, c.y, c.z, cc, 1, 0), core]);
    if (!PROP_LO && o.extraBlob) P.push([blob(o.clusterR * 0.45, c.x + rr(-0.5, 0.5), c.y + o.clusterR * 0.4, c.z + rr(-0.5, 0.5), cc, 1), core]);
    leafCards(c, o.clusterR, o.clusterR * o.flat, o.cards, o.leaf, o.card0, o.card1, cc);
  }
  return tips;
}
const TREE_BUILDERS = {
  oak(v) {
    // three personalities: a broad old spreader, a tall upright one, and a wind-bent twisted one
    const P = [], leaf = [0x4f7f2e, 0x5d8a34, 0x46752b][v % 3];
    const T = [
      { trunkH: rr(2.6, 3.1), trunkR: rr(0.6, 0.72), gnarl: 0.22, rise: 0.02, lean: 0.05, spread: (d) => (d === 2 ? 1.1 : 0.7), kids: (d) => (d === 2 ? 4 : 2), lenF: 0.8, clusterR: 1.6 },
      { trunkH: rr(4, 4.8), trunkR: rr(0.45, 0.55), gnarl: 0.12, rise: 0.3, lean: 0.02, spread: (d) => (d === 2 ? 0.6 : 0.55), kids: (d) => (d === 2 ? 3 : 2), lenF: 0.62, clusterR: 1.35 },
      { trunkH: rr(3, 3.6), trunkR: rr(0.5, 0.6), gnarl: 0.38, rise: 0.06, lean: 0.35, spread: (d) => (d === 2 ? 0.95 : 0.7), kids: (d) => (d === 2 ? 3 : 2), lenF: 0.75, clusterR: 1.45 },
    ][v % 3];
    growTree(P, { bark: 0x6b4a30, leaf, trunkSteps: 4, depth: 2, taper: 0.6, roots: 5, knot: 1.15, rF: 0.62, midKids: true, flat: 0.75, cards: 12, card0: 1.25, card1: 1.85, ...T });
    return P;
  },
  autumn(v) {
    const col = [0xd07a2a, 0xe0a030, 0xc4532a][v % 3], start = CARD_PARTS.length;
    const P = TREE_BUILDERS.oak(v).map(([g, c]) => [g, c === 0x6b4a30 || c === 0x5d4029 ? c : new THREE.Color(col).multiplyScalar(PROP_LO ? 1 : 0.75).getHex()]);
    for (let i = start; i < CARD_PARTS.length; i++) CARD_PARTS[i][1] = new THREE.Color(col).offsetHSL(rr(-0.03, 0.03), 0, rr(-0.06, 0.06)).getHex();
    return P;
  },
  pine(v) {
    // Mediterranean stone pine: a tall, gently curving bare trunk and a flat umbrella crown. v2 is a mountain fir.
    if (v % 3 === 2) return TREE_BUILDERS.fir(v);
    const P = [], leaf = [0x2f5a34, 0x365f38][v % 2];
    growTree(P, { bark: 0x7a5236, leaf, trunkH: rr(6.5, 8), trunkR: rr(0.34, 0.42), trunkSteps: 5, depth: 2, taper: 0.55, gnarl: 0.14, rise: 0.12, lean: 0.18, roots: 3,
      kids: (d) => (d === 2 ? 4 : 2), spread: (d) => (d === 2 ? 1.25 : 0.9), lenF: 0.48, rF: 0.55, clusterR: 1.9, flat: 0.34, cards: 14, card0: 1.2, card1: 1.9 });
    return P;
  },
  fir(v) {
    const P = [], H = rr(7, 9.5);
    P.push([limb(0.42, 0.18, H, 0, -0.2, 0, 0, 0, 7), 0x5e3f28]);
    const tiers = 6 + (v % 2);
    for (let i = 0; i < tiers; i++) {
      const r = lerp(2.6, 0.7, i / tiers) * rr(0.9, 1.1), g = new THREE.ConeGeometry(r, 2.3, 9, 1, true);
      const a = g.attributes.position; for (let k = 0; k < a.count; k++) if (a.getY(k) < 0) a.setY(k, a.getY(k) - 0.35 - hash(a.getX(k) * 7, a.getZ(k) * 7) * 0.35); // droopy tips
      g.computeVertexNormals(); g.translate(0, 2.4 + i * (H - 2.6) / tiers, 0);
      P.push([g, i % 2 ? 0x2d5a3a : 0x274f34]);
      if (!PROP_LO) {                                   // needle fringe: drooping cards around each tier's rim
        const ty = 2.4 + i * (H - 2.6) / tiers - 0.9;
        for (let k = 0; k < 12; k++) { const a = k / 12 * 6.28 + rr(-0.2, 0.2), sz = r * rr(0.7, 1);
          const cg = new THREE.PlaneGeometry(sz, sz * 0.8); cg.rotateX(-0.9); cg.translate(0, 0, r * 0.62); cg.rotateY(a); cg.translate(0, ty, 0);
          const na = cg.attributes.normal, nx = Math.sin(a) * 0.6, nz = Math.cos(a) * 0.6; for (let q = 0; q < na.count; q++) na.setXYZ(q, nx, 0.8, nz);
          CARD_PARTS.push([cg, new THREE.Color(0x2f5e3a).offsetHSL(rr(-0.02, 0.02), 0, rr(-0.05, 0.05)).getHex()]); }
      }
    }
    return P;
  },
  birch(v) {
    const P = [], leaf = [0x9fb23e, 0xb7bf45, 0x86a83a][v % 3];
    growTree(P, { bark: 0xe9e4d8, leaf, trunkH: rr(4.6, 5.8), trunkR: 0.24, trunkSteps: 4, depth: 2, taper: 0.55, gnarl: [0.05, 0.14, 0.09][v % 3], rise: 0.35, roots: 0, lean: [0.02, 0.22, 0.1][v % 3],
      kids: (d) => (d === 2 ? 3 : 2), spread: (d) => (d === 2 ? 0.55 : 0.5), lenF: 0.5, rF: 0.55, clusterR: 0.95, flat: 1.2, cards: 9, card0: 0.9, card1: 1.4 });
    if (!PROP_LO) for (let i = 0; i < 6; i++) { const y = rr(0.4, 3.6), r = lerp(0.24, 0.16, y / 5) + 0.012; P.push([limb(r, r, rr(0.04, 0.08), 0, y, 0, 0, 0, 8), 0x55504a]); }   // bark marks
    return P;
  },
  // ---- Native trees of Greece ----
  aleppo(v) {
    // Aleppo pine (Pinus halepensis): the pine of the Greek coast. A crooked, leaning trunk with reddish-grey bark,
    // an open, uneven crown of light grey-green tufts you can see the sky through.
    const P = [], leaf = [0x6f8f4a, 0x7a9650, 0x67884a][v % 3];
    growTree(P, { bark: 0x7a6656, leaf, trunkH: rr(4.6, 6), trunkR: rr(0.3, 0.38), trunkSteps: 5, depth: 2, taper: 0.55, gnarl: 0.3, rise: 0.05, lean: [0.35, 0.2, 0.45][v % 3], roots: 3,
      kids: (d) => (d === 2 ? 3 : 2), spread: (d) => (d === 2 ? 1.05 : 0.8), lenF: 0.6, rF: 0.55, midKids: true, clusterR: 1.25, flat: 0.45, cards: 10, card0: 1.1, card1: 1.7 });
    return P;
  },
  plane(v) {
    // Oriental plane (Platanus orientalis): the great shade tree of Greek springs and village squares. Massive pale
    // trunk, wide limbs and a huge domed crown of big bright leaves.
    const P = [], leaf = [0x5f9a3a, 0x6aa040, 0x568f36][v % 3];
    growTree(P, { bark: 0x9c9682, leaf, trunkH: rr(3.6, 4.4), trunkR: rr(0.7, 0.85), trunkSteps: 4, depth: 3, taper: 0.62, gnarl: 0.14, rise: 0.12, lean: 0.06, roots: 6, knot: 1.12,
      kids: (d) => (d === 3 ? 3 : 2), spread: (d) => (d === 3 ? 0.85 : 0.7), lenF: 0.72, rF: 0.62, clusterR: 1.65, flat: 0.75, cards: 12, card0: 1.5, card1: 2.3 });
    return P;
  },
  holm(v) {
    // Holm / kermes oak (Quercus ilex): evergreen, dense, almost black-green rounded crowns on a short dark trunk.
    const P = [], leaf = [0x3f5a2e, 0x46623a, 0x3a5430][v % 3];
    growTree(P, { bark: 0x4a3e32, leaf, trunkH: rr(2.4, 3.2), trunkR: rr(0.42, 0.52), trunkSteps: 3, depth: 2, taper: 0.6, gnarl: 0.2, rise: 0.08, lean: 0.08, roots: 5,
      kids: (d) => (d === 2 ? 4 : 3), spread: (d) => (d === 2 ? 0.8 : 0.65), lenF: 0.65, rF: 0.6, clusterR: 1.45, flat: 0.85, cards: 13, card0: 1.0, card1: 1.5, core: 0.72 });
    return P;
  },
  carob(v) {
    // Carob (Ceratonia siliqua): a broad, low dome of glossy dark leaves on a thick, gnarled trunk; pods hang below.
    const P = [], leaf = [0x3e6a2c, 0x467232, 0x3a6228][v % 3];
    const tips = growTree(P, { bark: 0x6a5a4a, leaf, trunkH: rr(1.8, 2.3), trunkR: rr(0.5, 0.6), trunkSteps: 3, depth: 2, taper: 0.6, gnarl: 0.35, rise: 0.02, lean: 0.12, roots: 5, knot: 1.2,
      kids: (d) => (d === 2 ? 4 : 2), spread: (d) => (d === 2 ? 1.15 : 0.8), lenF: 0.75, rF: 0.6, clusterR: 1.4, flat: 0.6, cards: 12, card0: 1.1, card1: 1.6, core: 0.55 });
    if (!PROP_LO) tips.forEach((t, i) => { if (i % 2) return; for (let k = 0; k < 3; k++) P.push([new THREE.CylinderGeometry(0.03, 0.02, 0.45, 4).translate(t.p.x + rr(-0.6, 0.6), t.p.y - 0.9, t.p.z + rr(-0.6, 0.6)), 0x4a2e1a]); });
    return P;
  },
  arbutus(v) {
    // Strawberry tree (Arbutus): several smooth stems with red-orange peeling bark, glossy dark leaves and red berries.
    const P = [], leaf = [0x47703a, 0x4f7a40, 0x426a36][v % 3];
    for (let s2 = 0; s2 < 2 + (v % 2); s2++) {
      const sub = [], cs = CARD_PARTS.length, a = s2 * 2.4 + v;
      const tips = growTree(sub, { bark: 0x8e5038, leaf, trunkH: rr(2.2, 3), trunkR: 0.17, trunkSteps: 3, depth: 2, taper: 0.6, gnarl: 0.22, rise: 0.15, roots: 0,
        dir: new THREE.Vector3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35), start: new THREE.Vector3(Math.cos(a) * 0.15, -0.2, Math.sin(a) * 0.15),
        kids: (d) => 2, spread: (d) => 0.7, lenF: 0.6, rF: 0.6, clusterR: 0.95, flat: 0.8, cards: 9, card0: 0.8, card1: 1.2, core: 0.6 });
      P.push(...sub);
      if (!PROP_LO) tips.forEach((t) => { for (let k = 0; k < 4; k++) P.push([new THREE.IcosahedronGeometry(0.07, 0).translate(t.p.x + rr(-0.7, 0.7), t.p.y + rr(-0.5, 0.2), t.p.z + rr(-0.7, 0.7)), k % 2 ? 0xd2401e : 0xe8902a]); });
    }
    return P;
  },
  fig(v) {
    // Fig (Ficus carica): smooth grey limbs branching low from the ground, sparse crown of very large leaves.
    const P = [], leaf = [0x7aa848, 0x82b04c, 0x709e42][v % 3];
    for (let s2 = 0; s2 < 3; s2++) {
      const a = s2 * 2.1 + v * 0.7;
      growTree(P, { bark: 0x9a958a, leaf, trunkH: rr(1.4, 2), trunkR: 0.2, trunkSteps: 3, depth: 2, taper: 0.6, gnarl: 0.25, rise: 0.05, roots: 0,
        dir: new THREE.Vector3(Math.cos(a) * 0.8, 1, Math.sin(a) * 0.8), start: new THREE.Vector3(0, -0.2, 0),
        kids: (d) => 2, spread: (d) => 0.8, lenF: 0.65, rF: 0.6, clusterR: 1.05, flat: 0.7, cards: 7, card0: 1.6, card1: 2.4, core: 0.45 });
    }
    return P;
  },
  cypress(v) {
    const P = [[limb(0.3, 0.14, 6.5, 0, -0.2, 0, rr(-0.04, 0.04), rr(-0.04, 0.04), 6), 0x5e3f28]], c = new THREE.Vector3(0, 4.5, 0), col = [0x345c2c, 0x3d6630, 0x2e5528][v % 3];
    const H = [7.5, 9, 6.5][v % 3], tw = rr(-0.6, 0.6);
    for (let i = 0; i < 11; i++) { const y = 1.4 + i * (H - 1.4) / 11, w = Math.sin(Math.PI * Math.pow((i + 0.5) / 11, 0.8)) * 1.05 + 0.2, a = i * tw;
      P.push([blob(w * 0.8, Math.cos(a) * 0.15, y, Math.sin(a) * 0.15, c, 3, 0), new THREE.Color(col).multiplyScalar(PROP_LO ? 1 : 0.7).getHex()]);
      leafCards(new THREE.Vector3(Math.cos(a) * 0.15, y, Math.sin(a) * 0.15), w, 0.55, 7, col, 0.7, 1.1, c.clone().setY(y)); }
    return P;
  },
  olive(v) {
    // Olive: a short, twisted, often split trunk, wide low limbs, many silvery-green clusters of small leaves
    const P = [], leaf = [0x95a67a, 0x879b6c, 0xa2b086][v % 3];
    for (let s2 = 0; s2 < (v % 2 ? 2 : 1); s2++) {                                                      // some olives split into two trunks
      const sub = [], cs = CARD_PARTS.length; growTree(sub, { bark: 0x6e6252, leaf, trunkH: rr(1.6, 2.2), trunkR: rr(0.34, 0.44) * (v % 2 ? 0.8 : 1), trunkSteps: 4, depth: 3, taper: 0.6, gnarl: 0.42, rise: 0.02, roots: 4, knot: 1.25,
        kids: (d) => (d === 3 ? (v % 2 ? 2 : 3) : 2), spread: (d) => (d === 3 ? 1.0 : d === 2 ? 0.75 : 0.55), lenF: 0.78, rF: 0.62,
        clusterR: 1.15, flat: 0.6, cards: 14, card0: 0.85, card1: 1.3, core: 0.42 });
      const off = v % 2 ? (s2 ? 0.35 : -0.35) : 0, tl = v % 2 ? (s2 ? 0.25 : -0.25) : 0;
      for (const [g] of sub) { g.rotateZ(tl); g.translate(off, 0, 0); }
      for (let q = cs; q < CARD_PARTS.length; q++) { CARD_PARTS[q][0].rotateZ(tl); CARD_PARTS[q][0].translate(off, 0, 0); }
      P.push(...sub);
    }
    return P;
  },
  dead(v) {
    const P = [];
    growTree(P, { bark: 0x4a4136, leaf: 0, trunkH: rr(3.4, 4.6), trunkR: rr(0.34, 0.42), trunkSteps: 4, depth: 2, taper: 0.4, gnarl: 0.45, rise: 0.08, lean: 0.25, roots: 4, knot: 1.2,
      kids: (d) => (d === 2 ? 3 : 2), spread: (d) => 0.9, lenF: 0.7, rF: 0.55, noLeaf: true, clusterR: 1 });
    if (v % 2) for (let i = 0; i < 5; i++) P.push([limb(0.04, 0.02, rr(0.8, 1.6), rr(-1.2, 1.2), rr(2.2, 3.6), rr(-1.2, 1.2), Math.PI, 0, 3), 0x6a7a40]);   // hanging moss
    return P;
  },
  rock(v) {
    const g = new THREE.IcosahedronGeometry(1, PROP_LO ? 1 : 2), a = g.attributes.position, vv = new THREE.Vector3();
    for (let k = 0; k < a.count; k++) { vv.fromBufferAttribute(a, k);
      let f = 0.72 + fbm(vv.x * 1.8 + v * 3, vv.z * 1.8 + vv.y) * 0.5 + (fbm(vv.x * 6 + v, vv.y * 6) - 0.5) * 0.12;   // big shape + chips
      let y = vv.y * f * 0.72; y = Math.round(y * 4.5) / 4.5 * 0.55 + y * 0.45;                                        // stepped strata ledges
      a.setXYZ(k, vv.x * f * 1.3, Math.max(y, -0.3), vv.z * f); }
    const g2 = g.index ? g.toNonIndexed() : g; g2.computeVertexNormals();
    const rk = mergeParts([[g2, [0x8f887e, 0x857d72, 0x999184][v % 3]]]), col = rk.attributes.color, nn = rk.attributes.normal, pp = rk.attributes.position;
    for (let k = 0; k < col.count; k++) {
      const band = 0.9 + Math.sin(pp.getY(k) * 14 + v) * 0.06 + (hash(Math.floor(k / 3), v) - 0.5) * 0.1;          // strata + facet variation
      col.setXYZ(k, col.getX(k) * band, col.getY(k) * band, col.getZ(k) * band);
      const mo = clamp((nn.getY(k) - 0.6) * 4, 0, 1) * (pp.getY(k) > 0.05 ? 0.85 : 0) * (0.6 + hash(k, v) * 0.4);          // moss caps, blended in
      if (mo > 0) col.setXYZ(k, lerp(col.getX(k), 0.13, mo), lerp(col.getY(k), 0.2, mo), lerp(col.getZ(k), 0.07, mo));
    }
    return rk;
  },
};
// ---- Imported stylised trees (the uploaded pack): broadleaf 'qtree', 'qpine', and leafless 'qdead' (tree trunks, weathered).
// Packed as quantised binary (models/qtrees.js). Trunks get vertex colours sampled from the bark texture, so they share
// propMat with every other tree; leaf clusters keep their own alpha-cut textures.
const b64arr = (str, T) => { const u = Uint8Array.from(atob(str), (ch) => ch.charCodeAt(0)); return new T(u.buffer); };
function qGeo(g, tint) {
  const geo = new THREE.BufferGeometry(), p = b64arr(g.p, Int16Array), n = b64arr(g.nr, Int8Array), uv = b64arr(g.uv, Int16Array);
  geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(p, (v) => v / 1000), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(n, (v) => v / 127), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(Float32Array.from(uv, (v) => v / 4096), 2));
  if (g.c) { const c = b64arr(g.c, Uint8Array); geo.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(c, (v, i) => v / 255 * tint[i % 3]), 3)); }
  return geo;
}
function qLeafMat(file, tint) {
  const t = new THREE.TextureLoader().load(`models/${file}`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, color: tint, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });   // tinted down to the island palette
  m.onBeforeCompile = leafMat.onBeforeCompile; return m;
}
const Q_SRC = { qtree: 'qtree', qpine: 'qpine', qdead: 'qtree', qbirch: 'qbirch' };
const Q_TINT = { qbirch: [0.85, 0.83, 0.8], qtree: [0.72, 0.62, 0.52], qpine: [0.68, 0.58, 0.5], qdead: [0.62, 0.6, 0.57] };
let Q_LEAF_MATS = null;
function qBuild(species, v) {
  Q_LEAF_MATS ||= { qbirch: qLeafMat('q_birch_leaves.png', 0x9cb27a), qtree: qLeafMat('q_tree_leaves.png', 0x9ab884), qpine: qLeafMat('q_pine_leaves.png', 0x6f8f62) };
  const src = QTREES[Q_SRC[species]][v % QTREES[Q_SRC[species]].length];
  const geo = qGeo(src.bark, Q_TINT[species]);
  const cards = species !== 'qdead' && src.leaves ? qGeo(src.leaves) : null;
  return { geo, lo: geo, cards, cardMat: cards && Q_LEAF_MATS[species], leafFar: true };
}
const PROPS = {};  // key -> { geo, variants:[geo], chunks: Map }
const CHUNK = 100;
function propGeo(species, v) {
  const k = species + v;
  if (!PROPS[k] && Q_SRC[species]) { const q = qBuild(species, v); PROPS[k] = { species, v, ...q, items: [] }; }
  if (!PROPS[k]) {
    CARD_PARTS = [];
    const s0 = seed, r = TREE_BUILDERS[species](v), s1 = seed, cards = CARD_PARTS.length ? mergeCards(CARD_PARTS) : null; CARD_PARTS = [];
    seed = s0; PROP_LO = true; const lo = TREE_BUILDERS[species](v); PROP_LO = false; seed = s1;
    PROPS[k] = { species, geo: r.isBufferGeometry ? r : mergeParts(r), lo: lo.isBufferGeometry ? lo : mergeParts(lo), cards, items: [] };
  }
  return PROPS[k];
}
const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
propMat.onBeforeCompile = (sh) => {
  sh.uniforms.uWind = windUniformEarly;
  sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    vec4 ipp = instanceMatrix[3];
    float sway = max(position.y - 2.0, 0.0) * 0.018;
    transformed.x += sin(uWind * 1.1 + ipp.x * 0.13 + ipp.z * 0.07) * sway;
    transformed.z += cos(uWind * 0.9 + ipp.z * 0.11) * sway * 0.7;`);
};
const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
leafMat.onBeforeCompile = (sh) => {
  sh.uniforms.uWind = windUniformEarly;
  sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    vec4 ipp = instanceMatrix[3];
    float sway = max(position.y - 2.0, 0.0) * 0.02;
    transformed.x += sin(uWind * 1.1 + ipp.x * 0.13 + ipp.z * 0.07) * sway + sin(uWind * 4.0 + position.x * 3.0 + position.y) * 0.035;
    transformed.z += cos(uWind * 0.9 + ipp.z * 0.11) * sway * 0.7 + cos(uWind * 3.6 + position.z * 3.0) * 0.03;`);
};
const _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _pe = new THREE.Euler(0, 0, 0, 'YXZ'), _ps = new THREE.Vector3();
function placeProp(species, v, pos, rotY, scale) {
  const P = propGeo(species, v), key = Math.floor(pos.x / CHUNK) + ',' + Math.floor(pos.z / CHUNK);
  const item = { P, key, idx: 0, pos, rotY, scale, tilt: 0 };
  (P.chunks || (P.chunks = new Map())).has(key) || P.chunks.set(key, []);
  P.chunks.get(key).push(item); return item;
}
function propMatrix(it, hidden) {
  _pe.set(it.tilt, it.rotY, 0); _pq.setFromEuler(_pe); _ps.setScalar(hidden ? 0 : it.scale);
  return _pm.compose(it.pos, _pq, _ps);
}
const PROP_CHUNKS = [], LO_GROUPS = {};   // { hi, lo, cx, cz }: near chunks draw full detail + shadows, far chunks the light version
function buildProps() {
  for (const P of Object.values(PROPS)) if (P.chunks) for (const [key, items] of P.chunks) {
    const hi = new THREE.InstancedMesh(P.geo, propMat, items.length);
    items.forEach((it, i) => { it.mesh = hi; it.idx = i; hi.setMatrixAt(i, propMatrix(it)); });
    hi.castShadow = hi.receiveShadow = true; hi.computeBoundingSphere(); scene.add(hi);
    const lk = P.species + (P.leafFar ? P.v : '') + '|' + key;  // imported trees: far trunk must match its own canopy
    (LO_GROUPS[lk] || (LO_GROUPS[lk] = { geo: P.lo, items: [] })).items.push(...items);
    const lo = LO_GROUPS[lk];
    let leaf = null;
    if (P.cards) { leaf = new THREE.InstancedMesh(P.cards, P.cardMat || leafMat, items.length); items.forEach((it, i) => { it.meshLeaf = leaf; leaf.setMatrixAt(i, propMatrix(it)); }); leaf.castShadow = leaf.receiveShadow = true; leaf.computeBoundingSphere(); scene.add(leaf); }
    const [cx, cz] = key.split(',').map((n) => (+n + 0.5) * CHUNK); PROP_CHUNKS.push({ hi, loGroup: lo, leaf, leafFar: !!P.leafFar, cx, cz });
  }
  for (const G of Object.values(LO_GROUPS)) {       // far version: all variants of a species in a chunk share one draw
    const im = new THREE.InstancedMesh(G.geo, propMat, G.items.length);
    G.items.forEach((it, i) => { it.meshLo = im; it.loIdx = i; im.setMatrixAt(i, propMatrix(it)); });
    im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere(); im.visible = false; scene.add(im); G.mesh = im;
  }
  for (const c of PROP_CHUNKS) c.lo = c.loGroup.mesh;
}
function updatePropLOD() {
  const px = camera.position.x, pz = camera.position.z, near = GFX.near;
  const cut = GFX.level === 'low' ? (GFX.fogFar || 520) : 1e9;
  for (const G of Object.values(LO_GROUPS)) if (G.mesh) G.mesh.visible = false;
  for (const c of PROP_CHUNKS) { const d = Math.hypot(c.cx - px, c.cz - pz) - CHUNK * 0.7; c.hi.visible = d < near; if (c.leaf) c.leaf.visible = c.hi.visible || (c.leafFar && d < cut); if (!c.hi.visible && d < cut) c.lo.visible = true; }
}
function updateProp(it, hidden = false) {
  const m = propMatrix(it, hidden);
  it.mesh.setMatrixAt(it.idx, m); it.mesh.instanceMatrix.needsUpdate = true;
  it.meshLo.setMatrixAt(it.loIdx, m); it.meshLo.instanceMatrix.needsUpdate = true;
  if (it.meshLeaf) { it.meshLeaf.setMatrixAt(it.idx, m); it.meshLeaf.instanceMatrix.needsUpdate = true; }
}
// Bake a static building into ONE mesh (vertex colours): hundreds of draw calls become one
const bakedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, flatShading: true });
// Surface detail for every baked building: world-space grain and blotches (plaster, stone, marble, timber) so walls
// read as material instead of flat colour. A few ALU ops per pixel, no textures.
bakedMat.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
    varying vec3 vSW;
    float bh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    float bn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(bh(i), bh(i + vec3(1,0,0)), f.x), mix(bh(i + vec3(0,1,0)), bh(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(bh(i + vec3(0,0,1)), bh(i + vec3(1,0,1)), f.x), mix(bh(i + vec3(0,1,1)), bh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      float blot = bn(vSW * 0.9) * 0.6 + bn(vSW * 3.1) * 0.4, grain = bn(vSW * 14.0);
      diffuseColor.rgb *= 0.88 + blot * 0.16 + (grain - 0.5) * 0.07;`);
};
// Dry-stone wall: rough base blocks, a smaller top course, wedge stones, capstones and fallen stones at the foot.
// coping = 'plaster' gives the whitewashed Greek courtyard cap instead of capstones.
const ROUGH = []; for (let v = 0; v < 6; v++) { const q = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2), a = q.attributes.position; for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * rr(0.86, 1.08), a.getY(i) * rr(0.85, 1.1), a.getZ(i) * rr(0.86, 1.08)); q.computeVertexNormals(); ROUGH.push(q); }
const WALL_MATS = [0xb5ab98, 0xa89e8a, 0xc2b9a6, 0x9c9282].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true })), WALL_MOSS = new THREE.MeshStandardMaterial({ color: 0x7d8a52, roughness: 1, flatShading: true }), WALL_LIME = new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.9 });
function dryStone(g, px, y, pz, yaw, w, opt = {}) {
  const R = () => ROUGH[Math.floor(rand() * 6)], M = () => WALL_MATS[Math.floor(rand() * 4)], hb = opt.h || 0.55;
  const b = mesh(R(), M(), px, y + hb * 0.42, pz, g); b.scale.set(w, hb * rr(0.88, 1.1), opt.d || rr(0.75, 0.9)); b.rotation.set(rr(-0.04, 0.04), -yaw + rr(-0.05, 0.05), rr(-0.04, 0.04));
  for (let j = 0; j < 2; j++) { if (rand() < 0.15) continue; const t2 = mesh(R(), rand() < 0.1 ? WALL_MOSS : M(), px + Math.cos(yaw) * (j - 0.5) * w * 0.48, y + hb + 0.15, pz + Math.sin(yaw) * (j - 0.5) * w * 0.48, g);
    t2.scale.set(w * rr(0.4, 0.52), rr(0.28, 0.38), (opt.d || 0.8) * rr(0.7, 0.85)); t2.rotation.set(0, -yaw + rr(-0.15, 0.15), rr(-0.08, 0.08)); }
  if (rand() < 0.35) { const wd = mesh(R(), M(), px + Math.cos(yaw) * w * 0.5, y + hb * 0.9, pz + Math.sin(yaw) * w * 0.5, g); wd.scale.set(0.16, 0.14, 0.5); wd.rotation.y = -yaw; }   // wedge stone in the joint
  if (opt.coping === 'plaster') { const c = mesh(ROUGH[0], WALL_LIME, px, y + hb + 0.42, pz, g); c.scale.set(w + 0.06, 0.16, (opt.d || 0.8) + 0.08); c.rotation.y = -yaw; }
  else if (rand() < 0.25) { const cap = mesh(ROUGH[0], WALL_MATS[2], px, y + hb + 0.36, pz, g); cap.scale.set(w * 0.9, 0.14, 0.8); cap.rotation.y = -yaw; }
  if (!opt.noRubble && rand() < 0.3) { const rb = mesh(R(), M(), px + rr(-0.3, 0.3), y + 0.06, pz + (rand() < 0.5 ? 1 : -1) * rr(0.6, 0.9), g); rb.scale.setScalar(rr(0.18, 0.3)); rb.rotation.set(rand(), rand(), rand()); }
}
function bakeGroup(g) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), parts = [], drop = [];
  g.traverse((m) => {
    if (!m.isMesh || m.userData.keep || m.isSkinnedMesh) return;
    const mt = m.material; if (Array.isArray(mt) || mt.isMeshBasicMaterial || mt.isShaderMaterial || mt.transparent || (mt.metalness || 0) > 0.4 || mt.side === THREE.DoubleSide) return;
    if (mt.emissive && mt.emissive.getHex() && mt.emissiveIntensity > 0) return;
    const geo = m.geometry.clone(); geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    parts.push([geo, mt.color.getHex()]); drop.push(m);
  });
  if (!parts.length) return;
  drop.forEach((m) => m.parent.remove(m));
  const merged = new THREE.Mesh(mergeParts(parts), bakedMat); merged.castShadow = merged.receiveShadow = true; g.add(merged);
}

// Scatter by region: density per square metre + species mix, like a hand-dressed open world
const FLORA = {   // native Greek mixes per region (birch removed: not a tree of the Aegean)
  meadow: { d: 0.004, mix: [['oak', 3], ['olive', 3], ['carob', 2], ['cypress', 2], ['pine', 1], ['fig', 1], ['autumn', 1], ['qtree', 2]] },
  ruins: { d: 0.002, mix: [['cypress', 2], ['olive', 3], ['carob', 1]] },
  forest: { d: 0.029, mix: [['holm', 5], ['aleppo', 4], ['oak', 2], ['arbutus', 2], ['autumn', 1], ['qtree', 3], ['qpine', 2]] },   // Hylaea: evergreen oak and pine woods
  mountain: { d: 0.01, mix: [['fir', 6], ['aleppo', 2], ['holm', 1], ['qpine', 4], ['qbirch', 1]] },
  swamp: { d: 0.006, mix: [['dead', 5], ['plane', 2], ['qdead', 4]] },
  olive: { d: 0.003, mix: [['olive', 3], ['cypress', 1]] },
  temple: { d: 0.002, mix: [['cypress', 3], ['olive', 3], ['pine', 1]] },
  lake: { d: 0.007, mix: [['plane', 4], ['aleppo', 1], ['arbutus', 1], ['qtree', 2], ['qbirch', 1]] },          // great planes by the water
  tower: { d: 0.005, mix: [['aleppo', 3], ['cypress', 1], ['qpine', 1]] },
  cave: { d: 0, mix: [] },
};
function pickSpecies(mix) { let t = rand() * mix.reduce((a, m) => a + m[1], 0); for (const [s2, w] of mix) if ((t -= w) <= 0) return s2; return mix[0][0]; }
function addTree(species, pos, scale) {
  const it = placeProp(species, Math.floor(rand() * (Q_SRC[species] ? QTREES[Q_SRC[species]].length : 3)), pos, rr(0, 6.28), scale);
  const TR = { oak: 0.55, autumn: 0.55, olive: 0.42, pine: 0.38, birch: 0.24, cypress: 0.3, dead: 0.38, aleppo: 0.34, plane: 0.78, holm: 0.48, carob: 0.55, arbutus: 0.35, fig: 0.4, fir: 0.42, qtree: 0.4, qpine: 0.34, qdead: 0.36, qbirch: 0.26 }[species] || 0.45;
  const res = { type: 'tree', item: it, hp: 8, max: 8, alive: true, pos, r: TR * scale + 0.15, fall: 0 };
  resources.push(res); colliders.push({ x: pos.x, z: pos.z, r: res.r, ref: res }); return res;
}
for (let z = -ISLAND_R; z < ISLAND_R; z += 4) for (let x = -ISLAND_R; x < ISLAND_R; x += 4) {
  const px = x + rr(0, 4), pz = z + rr(0, 4), h = heightAt(px, pz);
  if (h < 1.3 || h > 62 || pathDist(px, pz) < 3) continue;
  if (AVOID.some((a) => Math.hypot(a.x - px, a.z - pz) < a.r)) continue;
  const R = regionAt(px, pz, h), F = FLORA[R.key]; if (!F || !F.mix.length) continue;
  let d = F.d * 16 * (0.4 + fbm(px * 0.02 + 3, pz * 0.02) * 1.2);           // clumps and clearings
  if (R.key === 'mountain') d *= clamp((50 - h) / 20, 0, 1);                 // tree line
  if (rand() > d) continue;
  addTree(pickSpecies(F.mix), new THREE.Vector3(px, h - 0.1, pz), rr(0.8, 1.3) * (R.key === 'forest' ? 1.2 : 1));
}
// Olive terraces: planted rows
for (let i = -5; i <= 5; i++) for (let j = -4; j <= 4; j++) {
  const px = OLIVE.x + i * 7 + j * 1.5 + rr(-0.8, 0.8), pz = OLIVE.z + j * 8 + rr(-0.8, 0.8), h = heightAt(px, pz);
  const rowD = Math.min(...[-2, -1, 0, 1, 2].map((k) => Math.abs(pz - OLIVE.z - k * 16)));
  if (h > 1.5 && rowD > 3.2 && Math.hypot(i * 7, j * 8) < 42 && Math.hypot(i * 7, j * 8) > 19 && pathDist(px, pz) > 3) addTree('olive', new THREE.Vector3(px, h - 0.1, pz), rr(0.9, 1.2));
}
// --- Rocks: choppable stone + big non-choppable boulders on the mountain and cliffs
function addRock(pos, scale, choppable) {
  if (pathDist(pos.x, pos.z) < 2.4 + scale * 1.2) return;    // keep trails clear
  const it = placeProp('rock', Math.floor(rand() * 3), pos, rr(0, 6.28), scale);
  if (choppable) { const res = { type: 'rock', item: it, hp: 8, max: 8, alive: true, pos, r: scale * 1.0 }; resources.push(res); colliders.push({ x: pos.x, z: pos.z, r: res.r, ref: res, h: scale * 0.75 }); }
  else colliders.push({ x: pos.x, z: pos.z, r: scale * 1.0, h: scale * 0.7 });
}
for (let i = 0; i < 170; i++) { const p = landSpot(0.8, 40, AVOID); if (p) addRock(p, rr(0.8, 1.4), true); }
for (let i = 0; i < 220; i++) {
  const a = rand() * 6.28, d = rr(20, 110), px = MOUNT.x + Math.cos(a) * d, pz = MOUNT.z + Math.sin(a) * d, h = heightAt(px, pz);
  if (h > 8 && caveDist(px, pz).foot > 6 && Math.hypot(px - LAKE.x, pz - LAKE.z) > 28 && d > ARENA_R + 10) addRock(new THREE.Vector3(px, h - 0.4, pz), rr(1.5, 4), false);
}
for (let i = 0; i < 40; i++) { const a = rand() * 6.28, d = rr(10, 45), px = TOWER.x + Math.cos(a) * d, pz = TOWER.z + Math.sin(a) * d, h = heightAt(px, pz); if (h > 2 && d > 8) addRock(new THREE.Vector3(px, h - 0.3, pz), rr(1.2, 3), false); }
// --- Ground pickups ---
// Merge a prop group's direct mesh children per material (recursing into sub-groups, which stay toggleable): a bush drops from 10 draw calls to 2
function collapseGroup(g) {
  const byMat = new Map();
  for (const m of [...g.children]) {
    if (m.isGroup) { collapseGroup(m); continue; }
    if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh || m.userData.keep || Array.isArray(m.material)) continue;
    if (!byMat.has(m.material)) byMat.set(m.material, []); byMat.get(m.material).push(m);
  }
  for (const [mt, list] of byMat) {
    if (list.length < 2) continue;
    const geos = list.map((m) => { m.updateMatrix(); const q = m.geometry.clone().applyMatrix4(m.matrix); for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k); return q; });
    list.forEach((m) => g.remove(m)); g.add(new THREE.Mesh(mergeGeometries(geos), mt));
  }
}
function addPickup(kind, p, build, extra = {}) {
  const obj = build(); if (kind !== 'axeitem' && kind !== 'bowitem' && kind !== 'chest') collapseGroup(obj); obj.position.copy(p); obj.traverse((m) => { if (m.isMesh) m.castShadow = false; }); scene.add(obj);
  const pk = { kind, obj, pos: p, alive: true, regrow: 0, ...extra }; pickups.push(pk); return pk;
}
const branch = () => { const g = new THREE.Group(); const m = mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.3, 5), trunkMat, 0, 0.08, 0, g); m.rotation.z = Math.PI / 2; m.rotation.y = rr(0, 3); return g; };
const pebble = () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) mesh(new THREE.DodecahedronGeometry(0.16, 0), rockMat, rr(-0.25, 0.25), 0.1, rr(-0.25, 0.25), g); return g; };
// Leafy bush made of leaf-cluster cards (the tree pack's foliage texture) arranged as a dome: reads as a real shrub
// from every angle instead of a faceted blob. n cards, radius r, height h.
function cardBushGeo(n, r, h) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const s2 = rr(0.85, 1.25) * r * 1.5, q = new THREE.PlaneGeometry(s2, s2), a = (i / n) * Math.PI * 2 + rr(-0.3, 0.3), up = i < n * 0.35;
    if (up) q.rotateX(-Math.PI / 2 + rr(-0.5, 0.5)); else q.rotateY(a + Math.PI / 2 + rr(-0.4, 0.4));
    q.rotateZ(rr(-0.25, 0.25));
    const d = up ? rr(0, r * 0.4) : r * rr(0.35, 0.6);
    q.translate(Math.cos(a) * d, up ? h * rr(0.8, 1.0) : h * rr(0.45, 0.65), Math.sin(a) * d); parts.push(q);
  }
  return mergeGeometries(parts);
}
const BUSH_GEOS = [0, 1, 2].map(() => cardBushGeo(13, 0.95, 1.4));
let BUSH_MAT = null;
// Berry bush: a dark, glossy bush heavy with bright red berry clusters. Clearly different from the plain green shrubs.
function bush() {
  BUSH_MAT ||= new THREE.MeshStandardMaterial({ map: new THREE.TextureLoader().load('models/q_tree_leaves.png', (t) => { t.colorSpace = THREE.SRGBColorSpace; }), color: 0x5f8a48, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 });
  const g = new THREE.Group(); const berries = new THREE.Group();
  const leaves = new THREE.Mesh(BUSH_GEOS[Math.floor(rand() * 3)], BUSH_MAT); leaves.userData.keep = true; leaves.rotation.y = rr(0, 6.28); leaves.scale.setScalar(rr(0.85, 1.1)); g.add(leaves);
  const core = mesh(new THREE.IcosahedronGeometry(0.62, 1), flat(0x2f5222), 0, 0.6, 0, g); core.scale.set(1.25, 0.9, 1.25);   // fills the gaps between cards
  const berryM = new THREE.MeshStandardMaterial({ color: 0xe0203a, emissive: 0x5a0010, emissiveIntensity: 0.6, roughness: 0.25 });
  for (let c = 0; c < 8; c++) {                                  // clusters of 3-5 berries on the outside of the bush
    const a = rr(0, 6.28), y = rr(0.5, 1.3), rad = 0.85 + (1.3 - y) * 0.15, cx = Math.cos(a) * rad, cz = Math.sin(a) * rad;
    for (let k = 0; k < 4; k++) mesh(new THREE.SphereGeometry(rr(0.08, 0.11), 8, 6), berryM, cx + rr(-0.1, 0.1), y + rr(-0.08, 0.08), cz + rr(-0.1, 0.1), berries);
  }
  g.add(berries); g.userData.berries = berries; return g;
}
function reeds() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) { const r = mesh(new THREE.ConeGeometry(0.05, rr(1, 1.6), 3), flat(0x8a9a4a), rr(-0.3, 0.3), 0.6, rr(-0.3, 0.3), g); r.rotation.z = rr(-0.2, 0.2); }
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 5), flat(0x6b4a2e), 0, 1.3, 0, g);
  return g;
}
{ // fallen branches lie under trees (in the drip line of the crown), not in the open
  const trees = resources.filter((r) => r.type === 'tree');
  for (let i = 0, n = 0; i < 2000 && n < 420; i++) { const t = trees[Math.floor(rand() * trees.length)], a = rand() * 6.28, d = t.r + rr(0.7, 3.2);
    const p = new THREE.Vector3(t.pos.x + Math.cos(a) * d, 0, t.pos.z + Math.sin(a) * d); p.y = heightAt(p.x, p.z);
    if (p.y < 1.2 || p.y > 30 || pathDist(p.x, p.z) < 1.8 || AVOID.some((v) => Math.hypot(v.x - p.x, v.z - p.z) < v.r) || colliders.some((c) => Math.abs(c.x - p.x) < 2 && Math.abs(c.z - p.z) < 2 && Math.hypot(c.x - p.x, c.z - p.z) < c.r + 0.4)) continue;
    addPickup('branch', p, branch); n++; } }
for (let i = 0; i < 360; i++) { const p = landSpot(0.4, 40, AVOID); if (p) addPickup('pebble', p, pebble); }
for (let i = 0; i < 170; i++) { const p = landSpot(1.5, 25, AVOID); if (p) addPickup('bush', p, bush); }
for (let i = 0; i < 70; i++) { const p = landSpot(0.15, 1.2, AVOID); if (p) addPickup('reeds', p, reeds); }
for (let i = 0; i < 90; i++) { const a = rand() * 6.28, d = rr(0, 85), p = new THREE.Vector3(SWAMP.x + Math.cos(a) * d, 0, SWAMP.z + Math.sin(a) * d); p.y = heightAt(p.x, p.z); if (p.y > -0.5) addPickup('reeds', p, reeds); }
// A few starter materials right at the wake-up spot, so the first minute teaches pickup
for (let i = 0; i < 9; i++) { const p = START.clone().add(new THREE.Vector3(rr(-9, 9), 0, rr(-14, -2))); p.y = heightAt(p.x, p.z); addPickup(i % 3 < 2 ? 'branch' : 'pebble', p, i % 3 < 2 ? branch : pebble); }

// --- Grass & flowers: instanced, swaying in the wind ---
const windUniform = windUniformEarly;
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
const grassU = { uWind: windUniform, uCenter: { value: new THREE.Vector2() }, uTile: { value: 70 }, uHeight: { value: null },
  uBaseA: { value: new THREE.Color(0x1d3a24) }, uBaseB: { value: new THREE.Color(0x3a4a1e) },
  uTipA: { value: new THREE.Color(0x7fae45) }, uTipB: { value: new THREE.Color(0xc9c35a) } };
{
  const N = 512, W = 640, data = new Uint16Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i + 0.5) / N * W - W / 2, z = (j + 0.5) / N * W - W / 2, h = heightAt(x, z);
    const R = regionAt(x, z, h), sl = Math.hypot(heightAt(x + 1, z) - h, heightAt(x, z + 1) - h);
    let mask = clamp((h - 1.3) / 0.6, 0, 1) * clamp((44 - h) / 6, 0, 1) * clamp((1.1 - sl) / 0.4, 0, 1);
    mask *= clamp((Math.hypot(x - SUMMIT.x, z - SUMMIT.z) - ARENA_R) / 3, 0, 1) * clamp((Math.hypot(x - HUT.x, z - HUT.z) - 4) / 1.5, 0, 1);
    mask *= clamp((caveDist(x, z).foot - 1) / 3, 0, 1) * clamp((Math.hypot(x - LAKE.x, z - LAKE.z) - 24) / 3, 0, 1);
    if (Math.abs(x - TEMPLE.x) < 14 && Math.abs(z - TEMPLE.z) < 20) mask = 0;
    if (R.key === 'swamp') mask *= 0.35; if (R.key === 'forest') mask *= 0.55;
    mask *= clamp((fbm(x * 0.05 + 3, z * 0.05) - 0.22) / 0.08, 0, 1) * clamp((pathDist(x, z) - 1.2) / 1.0, 0, 1);
    const k = (j * N + i) * 4;
    data[k] = THREE.DataUtils.toHalfFloat(h); data[k + 1] = THREE.DataUtils.toHalfFloat(mask);
    data[k + 2] = THREE.DataUtils.toHalfFloat(fbm(x * 0.03 + 9, z * 0.03 - 4)); data[k + 3] = THREE.DataUtils.toHalfFloat(clamp((fbm(x * 0.07, z * 0.07 + 5) - 0.42) * 3, 0, 1) * (R.key === 'meadow' || R.key === 'olive' || R.key === 'temple' ? 1 : R.key === 'forest' ? 0.3 : 0.1));
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true; grassU.uHeight.value = tex; WATER_U.uH.value = tex;

  const H = 0.5, blade = new THREE.PlaneGeometry(0.14, H, 1, 2); blade.translate(0, H / 2, 0);
  const bp = blade.attributes.position; for (let i = 0; i < bp.count; i++) bp.setX(i, bp.getX(i) * (1 - Math.pow(bp.getY(i) / H, 1.5)));
  const COUNT = 150000, T = grassU.uTile.value;
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, grassU);
    sh.vertexShader = `uniform float uWind, uTile; uniform vec2 uCenter; uniform sampler2D uHeight; varying float vGH, vVar;\n` + sh.vertexShader
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')   // soft, uniform lighting like a painted field
      .replace('#include <begin_vertex>', `
        vec3 ip = instanceMatrix[3].xyz;
        vec2 wp = ip.xz + uTile * floor((uCenter - ip.xz) / uTile + 0.5);
        vec4 hm = texture2D(uHeight, (wp + 320.0) / 640.0);
        float rnd = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
        float fade = 1.0 - smoothstep(0.6, 1.0, length(wp - uCenter) / (uTile * 0.5));
        float sc = hm.g * fade * (0.65 + rnd * 0.8);
        vec3 p = position; p.y *= sc; p.x *= step(0.01, sc);
        float a = rnd * 6.2831; p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
        float gh = position.y / ${H.toFixed(2)};
        float gust = sin(uWind * 0.6 + wp.x * 0.05) * 0.5 + 0.5;
        float bend = gh * gh * sc * (0.07 + gust * 0.1);
        p.x += sin(uWind * 1.9 + wp.x * 0.35 + wp.y * 0.22) * bend;
        p.z += cos(uWind * 1.5 + wp.y * 0.3) * bend * 0.7;
        vec2 away = wp - uCenter; float pd = length(away), push = (1.0 - smoothstep(0.25, 1.5, pd)) * gh * sc;   // blades part around your legs
        p.xz += away / max(pd, 0.001) * push * 0.55; p.y *= 1.0 - push * 0.35;
        vec3 transformed = p + vec3(wp.x, hm.r - 0.03, wp.y) - ip;
        vGH = gh; vVar = hm.b;`);
    sh.fragmentShader = `uniform vec3 uBaseA, uBaseB, uTipA, uTipB; varying float vGH, vVar;\n` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float v = smoothstep(0.35, 0.7, vVar);
        diffuseColor.rgb = mix(mix(uBaseA, uBaseB, v), mix(uTipA, uTipB, v * 0.8), smoothstep(0.0, 1.0, vGH));`);
  };
  const grass = new THREE.InstancedMesh(blade, mat, COUNT), gm = new THREE.Matrix4(); GFX.grass = grass; GFX.grassMax = COUNT;
  for (let i = 0; i < COUNT; i++) grass.setMatrixAt(i, gm.makeTranslation(rr(0, T), 0, rr(0, T)));
  grass.frustumCulled = false; grass.receiveShadow = true; scene.add(grass);
  // Flowers use the same wrap-around carpet, placed by the flower-density channel of the heightmap
  const flowerCarpet = (geo, count, colors, size) => {
    const fm = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    fm.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, grassU);
      sh.vertexShader = `uniform float uWind, uTile; uniform vec2 uCenter; uniform sampler2D uHeight;\n` + sh.vertexShader.replace('#include <begin_vertex>', `
        vec3 ip = instanceMatrix[3].xyz;
        vec2 wp = ip.xz + uTile * floor((uCenter - ip.xz) / uTile + 0.5);
        vec4 hm = texture2D(uHeight, (wp + 320.0) / 640.0);
        float rnd = fract(sin(dot(ip.xz, vec2(39.3, 11.7))) * 43758.5453);
        float fade = 1.0 - smoothstep(0.6, 1.0, length(wp - uCenter) / (uTile * 0.5));
        float on = step(rnd, hm.a) * step(0.5, hm.g) * fade;
        vec3 p = position * on * ${size.toFixed(2)} * (0.8 + rnd * 0.5);
        float bend = max(position.y, 0.0) * 0.12;
        p.x += sin(uWind * 1.9 + wp.x * 0.35 + wp.y * 0.22) * bend;
        vec3 transformed = p + vec3(wp.x, hm.r - 0.03, wp.y) - ip;`);
    };
    const im = new THREE.InstancedMesh(geo, fm, count), mm = new THREE.Matrix4(), cc = new THREE.Color();
    for (let i = 0; i < count; i++) { im.setMatrixAt(i, mm.makeTranslation(rr(0, T), 0, rr(0, T))); im.setColorAt(i, cc.setHex(colors[Math.floor(rand() * colors.length)])); }
    im.frustumCulled = false; im.userData.max = count; (GFX.flowers || (GFX.flowers = [])).push(im); scene.add(im); return im;
  };
  const merge = (parts) => {           // tiny manual merge of non-indexed geometries with vertex colours
    const pos = [], nor = [], col = [];
    for (const [g, c] of parts) { const gg = g.index ? g.toNonIndexed() : g; gg.computeVertexNormals(); const cl = new THREE.Color(c);
      pos.push(...gg.attributes.position.array); nor.push(...gg.attributes.normal.array); for (let i = 0; i < gg.attributes.position.count; i++) col.push(cl.r, cl.g, cl.b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
  };
  // Daisy / poppy head: flat petal disc + centre on a stem (instance colour tints the petals)
  // Petal rings: each petal a tapered quad tilted up (cup) around a centre, on a stem with two leaves
  const flower = (petals, len, wid, cup, petalCol, eyeCol, stemH) => {
    const P = [];
    for (let i = 0; i < petals; i++) {
      const g = new THREE.PlaneGeometry(wid, len, 1, 1); g.translate(0, len / 2, 0);
      const a = g.attributes.position; for (let k = 0; k < a.count; k++) if (a.getY(k) < 0.01) a.setX(k, a.getX(k) * 0.3);   // narrow base
      g.rotateX(-Math.PI / 2 + cup); g.rotateY(i / petals * Math.PI * 2); g.translate(0, stemH, 0); P.push([g, petalCol]);
    }
    P.push([new THREE.OctahedronGeometry(len * 0.32, 0).translate(0, stemH + 0.01, 0), eyeCol]);
    P.push([new THREE.CylinderGeometry(0.01, 0.013, stemH, 3).translate(0, stemH / 2, 0), 0x3f6a2a]);
    for (const sgn of [-1, 1]) { const l = new THREE.PlaneGeometry(0.05, 0.14).translate(0, 0.07, 0); l.rotateZ(sgn * 0.9); l.translate(0, stemH * 0.35, 0); P.push([l, 0x4c7a30]); }
    return merge(P);
  };
  const mk = (geo, n, col, size) => { const f = flowerCarpet(geo, n, [col], size); f.material.vertexColors = true; f.material.side = THREE.DoubleSide; return f; };
  mk(flower(10, 0.09, 0.035, 0.35, 0xffffff, 0xe8b830, 0.42), 3200, 0xffffff, 1);        // daisies
  mk(flower(5, 0.08, 0.06, 0.55, 0xffd23a, 0xc98a1a, 0.36), 2400, 0xffffff, 1);          // buttercups
  mk(flower(4, 0.12, 0.11, 0.95, 0xd8322a, 0x201810, 0.5), 2200, 0xffffff, 1.05);       // poppies (cupped)
  mk(flower(8, 0.08, 0.04, 0.4, 0x4f74e0, 0x2a2a60, 0.44), 1600, 0xffffff, 1);          // cornflowers
  // Lavender spikes
  const spikeParts = [[new THREE.CylinderGeometry(0.012, 0.012, 0.55, 3).translate(0, 0.27, 0), 0x3f6a2a]];
  for (let i = 0; i < 6; i++) spikeParts.push([new THREE.OctahedronGeometry(0.045 - i * 0.004, 0).translate(0, 0.42 + i * 0.07, 0), 0xffffff]);
  const f2 = flowerCarpet(merge(spikeParts), 2600, [0x7a5fd0, 0x5b4fc4, 0x9a6ad8], 1.1);
  f2.material.vertexColors = true;
}

// ============================================================
// Landmarks: temple, cave, watchtower, lake + waterfall, marsh, olive farm
// ============================================================
// Walkable surfaces above the terrain (temple floor, tower platform, cave floor)
const FLOORS = [];
function floorAt(p) {
  let y = -99;
  for (const f of FLOORS) {
    const inside = f.rect ? Math.abs(p.x - f.x) < f.w && Math.abs(p.z - f.z) < f.d : Math.hypot(p.x - f.x, p.z - f.z) < f.r;
    if (inside && p.y > f.y - 0.7) y = Math.max(y, f.y);
  }
  return y;
}
const marble = new THREE.MeshStandardMaterial({ color: 0xeee6d4, roughness: 0.55 });
const marbleDark = new THREE.MeshStandardMaterial({ color: 0xd4cab4, roughness: 0.7 });
const terracotta = new THREE.MeshStandardMaterial({ color: 0xb8583a, roughness: 0.8 });
const rockDark = new THREE.MeshStandardMaterial({ color: 0x5f5850, roughness: 0.95, flatShading: true });
function wallColliders(x0, z0, x1, z1, r = 0.7, h = 99) { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (r * 1.4)); for (let i = 0; i <= n; i++) colliders.push({ x: lerp(x0, x1, i / n), z: lerp(z0, z1, i / n), r, h }); }

// ---- Temple of Athena: a Doric peristyle (6×11), painted frieze with triglyphs and metopes, sculpted pediments,
//      tiled roof with antefixes, a pronaos with bronze doors, and inside a two-tier colonnade around a reflecting pool
//      and a chryselephantine Athena Parthenos (after Pheidias): gold peplos and aegis, ivory skin, Nike on her palm.
const braziers = [];
var ATHENA_OFFER;
{
  const g = new THREE.Group(), W = 11, D = 19, TY = TEMPLE_Y, top = 1.5, colH = 9, capH = 0.75;
  const paint = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const blue = paint(0x2c4a80), red = paint(0xa3392c), ochre = paint(0xd6ac4c, 0.5), ivoryM = paint(0xf2e9d8, 0.45);
  const goldM = new THREE.MeshStandardMaterial({ color: 0xd9ad4a, metalness: 0.85, roughness: 0.28 });
  const limbTo = (a, b, r0, r1, m, parent) => { const d = b.clone().sub(a), c = mesh(new THREE.CylinderGeometry(r1, r0, d.length(), 10), m, 0, 0, 0, parent);
    c.position.copy(a).add(b).multiplyScalar(0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return c; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // Stylobate: three steps, plus a wide stair on the entrance side
  for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry((W + 1.8 - i * 0.9) * 2, 0.5, (D + 1.8 - i * 0.9) * 2), i === 2 ? marble : marbleDark, 0, 0.25 + i * 0.5, 0, g);
  for (let j = 0; j < 6; j++) { const tj = 1.5 - 0.25 * j, dep = 0.9 + 0.45 * (j + 1); mesh(new THREE.BoxGeometry(9, tj, dep), j % 2 ? marbleDark : marble, 0, tj / 2, D + dep / 2, g);
    FLOORS.push({ rect: true, x: TEMPLE.x, z: TEMPLE.z + D + 0.9 + 0.45 * j + 0.225, w: 4.5, d: 0.225, y: TY - 0.2 + tj }); }
  // Columns: 20 flutes, entasis swell, echinus + abacus capitals, necking rings
  const col = new THREE.CylinderGeometry(0.6, 0.74, colH, 40, 8);
  { const a = col.attributes.position; for (let i = 0; i < a.count; i++) { const ang = Math.atan2(a.getZ(i), a.getX(i)), y01 = a.getY(i) / colH + 0.5, f = (1 - 0.06 * (0.5 + 0.5 * Math.cos(ang * 20))) * (1 + 0.035 * Math.sin(Math.PI * y01)); a.setX(i, a.getX(i) * f); a.setZ(i, a.getZ(i) * f); } col.computeVertexNormals(); }
  const echinus = new THREE.LatheGeometry([new THREE.Vector2(0.6, 0), new THREE.Vector2(0.78, 0.12), new THREE.Vector2(0.92, 0.3), new THREE.Vector2(0.95, 0.4)], 24);
  const abacus = new THREE.BoxGeometry(2.0, 0.34, 2.0), neck = new THREE.TorusGeometry(0.62, 0.05, 5, 24).rotateX(Math.PI / 2);
  const spots = [];
  for (let i = 0; i < 6; i++) { const x = -W + 1 + i * (2 * W - 2) / 5; spots.push([x, -D + 1], [x, D - 1]); }
  for (let j = 1; j < 10; j++) { const z = -D + 1 + j * (2 * D - 2) / 10; spots.push([-W + 1, z], [W - 1, z]); }
  for (const [x, z] of spots) {
    mesh(col, marble, x, top + colH / 2, z, g); mesh(neck, marbleDark, x, top + colH - 0.35, z, g);
    mesh(echinus, marble, x, top + colH, z, g); mesh(abacus, marble, x, top + colH + 0.4 + 0.17, z, g);
    colliders.push({ x: TEMPLE.x + x, z: TEMPLE.z + z, r: 0.85 });
  }
  // Entablature: architrave, taenia, frieze of blue triglyphs and red metopes with gilt rosettes, cornice with blue mutules
  const eY = top + colH + capH;
  mesh(new THREE.BoxGeometry(W * 2 + 0.3, 1.1, D * 2 + 0.3), marble, 0, eY + 0.55, 0, g);
  mesh(new THREE.BoxGeometry(W * 2 + 0.5, 0.14, D * 2 + 0.5), red, 0, eY + 1.15, 0, g);
  mesh(new THREE.BoxGeometry(W * 2 + 0.2, 1.2, D * 2 + 0.2), marble, 0, eY + 1.82, 0, g);
  const fY = eY + 1.82, tri = new THREE.BoxGeometry(0.75, 1.2, 0.14), met = new THREE.BoxGeometry(1.0, 1.0, 0.06), ros = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12).rotateX(Math.PI / 2);
  const frieze = (len, place) => { const n = Math.round(len / 1.8); for (let i = 0; i <= n; i++) { const u = -len / 2 + i * len / n; place(tri, blue, u, 0);
    if (i < n) { place(met, red, u + len / n / 2, -0.03); place(ros, ochre, u + len / n / 2, 0.02); } } };
  frieze(W * 2, (geo, m, u, o) => { for (const sz of [-1, 1]) { const q = mesh(geo, m, u, fY, sz * (D + 0.17 + o), g); } });
  frieze(D * 2, (geo, m, u, o) => { for (const sx of [-1, 1]) { const q = mesh(geo, m, sx * (W + 0.17 + o), fY, u, g); q.rotation.y = Math.PI / 2; } });
  mesh(new THREE.BoxGeometry(W * 2 + 1.3, 0.42, D * 2 + 1.3), marble, 0, eY + 2.63, 0, g);                         // cornice
  for (let u = -W; u <= W; u += 1.1) for (const sz of [-1, 1]) mesh(new THREE.BoxGeometry(0.6, 0.12, 0.45), blue, u, eY + 2.37, sz * (D + 0.42), g);
  for (let u = -D; u <= D; u += 1.1) for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.45, 0.12, 0.6), blue, sx * (W + 0.42), eY + 2.37, u, g);
  // Pediments: raking cornice, blue tympanum, a sculpted group (Athena's birth: tallest figure at the centre)
  const pY = eY + 2.84, pH = 3.6;
  for (const sz of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(-W - 0.65, 0); sh.lineTo(W + 0.65, 0); sh.lineTo(0, pH); sh.closePath();
    const pg = new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: false }); pg.translate(0, 0, -0.45);
    mesh(pg, marble, 0, pY, sz * (D + 0.2), g);
    const ti = new THREE.Shape(); ti.moveTo(-W + 0.6, 0.25); ti.lineTo(W - 0.6, 0.25); ti.lineTo(0, pH - 0.55); ti.closePath();
    mesh(new THREE.ShapeGeometry(ti), blue, 0, pY, sz * (D + 0.66), g).rotation.y = sz > 0 ? 0 : Math.PI;
    for (let k = -4; k <= 4; k++) { const hgt = (pH - 0.8) * (1 - Math.abs(k) / 5.2), x = k * 2.1;
      const fig = new THREE.Group(); fig.position.set(x, pY + 0.3, sz * (D + 0.85)); g.add(fig);
      if (Math.abs(k) >= 4) { const b = mesh(new THREE.CapsuleGeometry(0.22, 1.1, 3, 8), ivoryM, 0, 0.3, 0, fig); b.rotation.z = Math.sign(k) * 1.35; mesh(new THREE.SphereGeometry(0.2, 10, 8), ivoryM, -Math.sign(k) * 0.7, 0.45, 0, fig); }
      else { mesh(new THREE.CylinderGeometry(0.2, 0.36, hgt * 0.72, 10), ivoryM, 0, hgt * 0.36, 0, fig); mesh(new THREE.SphereGeometry(0.19, 10, 8), ivoryM, 0, hgt * 0.72 + 0.2, 0, fig);
        limbTo(V(0.26, hgt * 0.66, 0), V(0.45 + (k % 2) * 0.2, hgt * 0.4 + (k % 2) * 0.5, 0.1), 0.07, 0.06, ivoryM, fig); } }
    for (const sx of [-1, 1]) { const rk = mesh(new THREE.BoxGeometry(Math.hypot(W + 0.8, pH) + 0.4, 0.4, 1.3), marble, sx * (W + 0.8) / 2, pY + pH / 2 + 0.12, sz * (D + 0.25), g); rk.rotation.z = -sx * Math.atan2(pH, W + 0.8); }
    for (const [ax, ay, s2] of [[0, pH + 0.5, 1.3], [-W - 0.5, 0.5, 0.9], [W + 0.5, 0.5, 0.9]]) {    // acroteria: gilt palmettes
      const p = new THREE.Group(); p.position.set(ax, pY + ay, sz * (D + 0.3)); p.scale.setScalar(s2); g.add(p);
      for (let l = -3; l <= 3; l++) { const lf = mesh(new THREE.SphereGeometry(0.22, 8, 6), ochre, Math.sin(l * 0.35) * 0.5, 0.3 + Math.cos(l * 0.35) * 0.5, 0, p); lf.scale.set(0.45, 1.3, 0.3); lf.rotation.z = -l * 0.35; }
      mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.35, 8), ochre, 0, 0.1, 0, p); }
  }
  // Roof: terracotta planes with cover-tile ridges and antefixes along the eaves
  const slope = Math.atan2(pH, W + 0.65), rl = Math.hypot(W + 0.9, pH);
  for (const sx of [-1, 1]) {
    const r = mesh(new THREE.BoxGeometry(rl, 0.3, D * 2 + 1.6), terracotta, sx * (W + 0.65) / 2, pY + pH / 2 + 0.28, 0, g); r.rotation.z = -sx * slope;
    for (let u = -D; u <= D; u += 0.95) { const rb = mesh(new THREE.CylinderGeometry(0.11, 0.11, rl, 5), terracotta, sx * (W + 0.65) / 2, pY + pH / 2 + 0.45, u, g); rb.rotation.z = Math.PI / 2 - sx * slope;
      const af = mesh(new THREE.ConeGeometry(0.2, 0.45, 5), ochre, sx * (W + 0.7), pY + 0.55, u, g); af.scale.z = 0.3; af.rotation.y = Math.PI / 2; }
  }
  mesh(new THREE.CylinderGeometry(0.2, 0.2, D * 2 + 1.6, 8), terracotta, 0, pY + pH + 0.35, 0, g).rotation.x = Math.PI / 2;
  // Cella: orthostate base course, walls, crowning moulding; pronaos with two columns in antis and open bronze doors
  const cw = 6, cd = 11, ch = 8.6;
  const wall = (w, d, x, z) => { mesh(new THREE.BoxGeometry(w, ch, d), marbleDark, x, top + ch / 2, z, g); mesh(new THREE.BoxGeometry(w + 0.12, 1.1, d + 0.12), marble, x, top + 0.55, z, g); mesh(new THREE.BoxGeometry(w + 0.2, 0.3, d + 0.2), red, x, top + ch - 0.2, z, g); };
  wall(cw * 2, 0.8, 0, -cd); wall(0.8, cd * 2, -cw, 0); wall(0.8, cd * 2, cw, 0);
  for (const sgn of [-1, 1]) wall(cw - 1.8, 0.8, sgn * (cw / 2 + 0.9), cd);
  mesh(new THREE.BoxGeometry(4.2, 0.9, 1.1), marble, 0, top + 6.9, cd, g);                                         // door lintel
  mesh(new THREE.BoxGeometry(3.6, ch - 6.45, 0.8), marbleDark, 0, top + 6.45 + (ch - 6.45) / 2, cd, g);            // wall above the door
  for (const sgn of [-1, 1]) { mesh(new THREE.BoxGeometry(0.35, 6.45, 1.1), marble, sgn * 1.97, top + 3.22, cd, g);
    const dr = new THREE.Group(); dr.position.set(sgn * 1.8, top, cd - 0.1); dr.rotation.y = sgn * -1.25; g.add(dr);
    const leaf = mesh(new THREE.BoxGeometry(1.8, 6.3, 0.12), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, metalness: 0.75, roughness: 0.35 }), -sgn * 0.9, 3.15, 0, dr); leaf.userData.keep = true;
    for (let k = 0; k < 4; k++) mesh(new THREE.BoxGeometry(1.5, 0.08, 0.16), ochre, -sgn * 0.9, 0.9 + k * 1.5, 0.04, dr); }
  for (const sgn of [-1, 1]) { mesh(new THREE.CylinderGeometry(0.5, 0.6, colH * 0.9, 24), marble, sgn * 3.6, top + colH * 0.45, cd + 3, g); mesh(echinus, marble, sgn * 3.6, top + colH * 0.9, cd + 3, g); colliders.push({ x: TEMPLE.x + sgn * 3.6, z: TEMPLE.z + cd + 3, r: 0.7 }); }
  wallColliders(TEMPLE.x - cw, TEMPLE.z - cd, TEMPLE.x + cw, TEMPLE.z - cd); wallColliders(TEMPLE.x - cw, TEMPLE.z - cd, TEMPLE.x - cw, TEMPLE.z + cd);
  wallColliders(TEMPLE.x + cw, TEMPLE.z - cd, TEMPLE.x + cw, TEMPLE.z + cd);
  wallColliders(TEMPLE.x - cw, TEMPLE.z + cd, TEMPLE.x - 1.8, TEMPLE.z + cd); wallColliders(TEMPLE.x + 1.8, TEMPLE.z + cd, TEMPLE.x + cw, TEMPLE.z + cd);
  // Coffered ceiling: blue coffers with gold stars
  mesh(new THREE.BoxGeometry(cw * 2, 0.4, cd * 2), marbleDark, 0, top + ch + 0.2, 0, g);
  for (let x = -cw + 1; x < cw - 0.5; x += 1.5) for (let z = -cd + 1; z < cd - 0.5; z += 1.5) { mesh(new THREE.BoxGeometry(1.1, 0.05, 1.1), blue, x + 0.25, top + ch - 0.03, z + 0.25, g); mesh(new THREE.OctahedronGeometry(0.12, 0), ochre, x + 0.25, top + ch - 0.08, z + 0.25, g); }
  for (let x = -cw; x <= cw; x += 1.5) mesh(new THREE.BoxGeometry(0.22, 0.35, cd * 2), marble, x - 0.5, top + ch - 0.17, 0, g);
  for (let z = -cd; z <= cd; z += 1.5) mesh(new THREE.BoxGeometry(cw * 2, 0.35, 0.22), marble, 0, top + ch - 0.17, z - 0.5, g);
  // Interior: polished tiled floor, U-shaped two-tier Doric colonnade, reflecting pool
  { const c = document.createElement('canvas'); c.width = c.height = 256; const x2 = c.getContext('2d');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = (i + j) % 2 ? 232 : 206; x2.fillStyle = `rgb(${v},${v - 6},${v - 18})`; x2.fillRect(i * 64, j * 64, 64, 64);
      x2.strokeStyle = 'rgba(120,110,95,.25)'; for (let k = 0; k < 3; k++) { x2.beginPath(); x2.moveTo(i * 64 + Math.random() * 64, j * 64); x2.bezierCurveTo(i * 64 + Math.random() * 64, j * 64 + 20, i * 64 + Math.random() * 64, j * 64 + 44, i * 64 + Math.random() * 64, j * 64 + 64); x2.stroke(); } }
    x2.strokeStyle = 'rgba(90,80,65,.5)'; x2.lineWidth = 2; for (let i = 0; i <= 4; i++) { x2.beginPath(); x2.moveTo(i * 64, 0); x2.lineTo(i * 64, 256); x2.moveTo(0, i * 64); x2.lineTo(256, i * 64); x2.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(cw / 1.5, cd / 1.5);
    const fl = mesh(new THREE.PlaneGeometry(cw * 2 - 0.8, cd * 2 - 0.8), new THREE.MeshStandardMaterial({ map: t, roughness: 0.18, metalness: 0.05, envMapIntensity: 1.1 }), 0, top + 0.02, 0, g); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; fl.userData.keep = true; }
  const icol = new THREE.CylinderGeometry(0.3, 0.36, 4.1, 20), icol2 = new THREE.CylinderGeometry(0.24, 0.28, 3.3, 16);
  const inner = []; for (let z = -cd + 1.4; z < cd - 3; z += 2.3) inner.push([-3.9, z], [3.9, z]);
  for (const [x, z] of inner) { mesh(icol, marble, x, top + 2.05, z, g); mesh(new THREE.BoxGeometry(0.9, 0.2, 0.9), marble, x, top + 4.2, z, g); mesh(icol2, marble, x, top + 4.3 + 1.65, z, g); mesh(new THREE.BoxGeometry(0.7, 0.18, 0.7), marble, x, top + 7.7, z, g); colliders.push({ x: TEMPLE.x + x, z: TEMPLE.z + z, r: 0.45 }); }
  for (const sx of [-1, 1]) { mesh(new THREE.BoxGeometry(0.6, 0.35, cd * 2 - 4.4), marble, sx * 3.9, top + 4.4, -1.6, g); mesh(new THREE.BoxGeometry(0.5, 0.3, cd * 2 - 4.4), marble, sx * 3.9, top + 7.9, -1.6, g); }
  const poolZ0 = -4.6, poolZ1 = -0.6, poolX = 2.1;
  for (const [w, d, x, z] of [[poolX * 2 + 0.5, 0.35, 0, poolZ0], [poolX * 2 + 0.5, 0.35, 0, poolZ1], [0.35, poolZ1 - poolZ0, -poolX, (poolZ0 + poolZ1) / 2], [0.35, poolZ1 - poolZ0, poolX, (poolZ0 + poolZ1) / 2]]) mesh(new THREE.BoxGeometry(w, 0.32, d), marbleDark, x, top + 0.16, z, g);
  const pool = mesh(new THREE.PlaneGeometry(poolX * 2 - 0.3, poolZ1 - poolZ0 - 0.3), new THREE.MeshStandardMaterial({ color: 0x0b1a22, roughness: 0.04, metalness: 0.9, envMapIntensity: 1.4 }), 0, top + 0.22, (poolZ0 + poolZ1) / 2, g); pool.rotation.x = -Math.PI / 2; pool.userData.keep = true;
  wallColliders(TEMPLE.x - poolX, TEMPLE.z + poolZ0, TEMPLE.x + poolX, TEMPLE.z + poolZ0, 0.35); wallColliders(TEMPLE.x - poolX, TEMPLE.z + poolZ1, TEMPLE.x + poolX, TEMPLE.z + poolZ1, 0.35);
  wallColliders(TEMPLE.x - poolX, TEMPLE.z + poolZ0, TEMPLE.x - poolX, TEMPLE.z + poolZ1, 0.35); wallColliders(TEMPLE.x + poolX, TEMPLE.z + poolZ0, TEMPLE.x + poolX, TEMPLE.z + poolZ1, 0.35);
  // Offering table between the pool and the pedestal
  mesh(new THREE.BoxGeometry(1.6, 0.9, 0.7), marble, 0, top + 0.45, -5.6, g); mesh(new THREE.BoxGeometry(1.9, 0.12, 0.9), ochre, 0, top + 0.95, -5.6, g);
  colliders.push({ x: TEMPLE.x, z: TEMPLE.z - 5.6, r: 0.8 });
  ATHENA_OFFER = new THREE.Vector3(TEMPLE.x, TY - 0.2 + top + 1.02, TEMPLE.z - 5.6);
  // ---- Athena Parthenos ----
  const st = new THREE.Group(); st.position.set(0, top, -8); g.add(st);
  mesh(new THREE.BoxGeometry(3.6, 0.35, 2.8), marbleDark, 0, 0.17, 0, st); mesh(new THREE.BoxGeometry(3.2, 0.8, 2.4), marble, 0, 0.75, 0, st);
  mesh(new THREE.BoxGeometry(3.25, 0.28, 2.45), ochre, 0, 0.78, 0, st); mesh(new THREE.BoxGeometry(3.5, 0.18, 2.7), marbleDark, 0, 1.24, 0, st);
  colliders.push({ x: TEMPLE.x, z: TEMPLE.z - 8, r: 1.8 }, { x: TEMPLE.x - 1.6, z: TEMPLE.z - 8, r: 1.1 });
  const fig = new THREE.Group(); fig.position.y = 1.33; fig.scale.setScalar(1.15); st.add(fig);
  const fold = (geo, amp, n, y0, y1) => { const a = geo.attributes.position; for (let i = 0; i < a.count; i++) { const x = a.getX(i), z = a.getZ(i), y = a.getY(i), an = Math.atan2(z, x), k = 1 + amp * Math.cos(an * n) * clamp((y1 - y) / (y1 - y0), 0.2, 1); a.setX(i, x * k); a.setZ(i, z * k); } geo.computeVertexNormals(); return geo; };
  const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  mesh(fold(lathe([[0.001, 0], [1.02, 0], [1.0, 0.14], [0.9, 0.9], [0.78, 1.8], [0.66, 2.5], [0.58, 2.98], [0.52, 3.08]]), 0.06, 14, 0, 3), goldM, 0, 0, 0, fig);   // peplos
  mesh(fold(lathe([[0.69, 2.3], [0.68, 2.45], [0.62, 2.9], [0.54, 3.25], [0.5, 3.3]]), 0.05, 10, 2.3, 3.3), goldM, 0, 0, 0, fig);                              // overfold
  mesh(new THREE.TorusGeometry(0.53, 0.05, 6, 28).rotateX(Math.PI / 2), goldM, 0, 3.02, 0, fig);                                                              // snake belt
  mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.9, 20), goldM, 0, 3.45, 0, fig);                                                                              // torso
  for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.16, 12, 8), goldM, sx * 0.17, 3.62, 0.34, fig);
  mesh(new THREE.CylinderGeometry(0.46, 0.64, 0.5, 24, 1, true), goldM, 0, 3.72, 0, fig);                                                                      // aegis
  for (let i = 0; i < 16; i++) { const an = i / 16 * Math.PI * 2; mesh(new THREE.SphereGeometry(0.06, 6, 4), goldM, Math.cos(an) * 0.64, 3.46, Math.sin(an) * 0.64, fig); }
  mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16).rotateX(Math.PI / 2), ivoryM, 0, 3.7, 0.5, fig);                                                     // gorgoneion
  mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.3, 12), ivoryM, 0, 4.05, 0, fig);                                                                             // neck
  const head = mesh(new THREE.SphereGeometry(0.27, 20, 14), ivoryM, 0, 4.42, 0.02, fig); head.scale.set(0.92, 1.08, 1);
  mesh(new THREE.BoxGeometry(0.05, 0.1, 0.07), ivoryM, 0, 4.4, 0.28, fig);                                                                                    // nose
  for (const sx of [-1, 1]) { mesh(new THREE.SphereGeometry(0.035, 8, 6), paint(0x1f3566, 0.3), sx * 0.09, 4.46, 0.24, fig); mesh(new THREE.CapsuleGeometry(0.07, 0.4, 3, 6), goldM, sx * 0.2, 4.1, -0.1, fig); }   // lapis eyes, locks
  mesh(new THREE.SphereGeometry(0.31, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), goldM, 0, 4.47, -0.01, fig);                                                  // Attic helmet
  mesh(new THREE.TorusGeometry(0.3, 0.04, 5, 20, Math.PI), goldM, 0, 4.55, 0.02, fig).rotation.x = -0.25;
  for (const sx of [-1, 1]) { const cg = mesh(new THREE.BoxGeometry(0.04, 0.2, 0.16), goldM, sx * 0.3, 4.62, 0.1, fig); cg.rotation.z = sx * 0.6; }
  for (const [cx, r] of [[-0.13, 0.38], [0, 0.5], [0.13, 0.38]]) {                                                                                            // triple crest
    const sh = new THREE.Shape(); sh.absarc(0, 0, r, 0, Math.PI, false); sh.closePath();
    const cr = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: false, curveSegments: 16 }), ivoryM, cx - 0.035, 4.74, 0, fig); cr.rotation.y = Math.PI / 2;
    mesh(new THREE.BoxGeometry(0.06, 0.12, 0.1), goldM, cx, 4.74, 0, fig); }
  // right arm forward, Nike on the palm, supported by a small column
  limbTo(V(0.52, 3.85, 0), V(0.72, 3.3, 0.2), 0.13, 0.11, ivoryM, fig); limbTo(V(0.72, 3.3, 0.2), V(0.8, 3.24, 0.95), 0.11, 0.09, ivoryM, fig);
  mesh(new THREE.SphereGeometry(0.14, 10, 8), ivoryM, 0.52, 3.86, 0, fig); mesh(new THREE.SphereGeometry(0.1, 8, 6), ivoryM, 0.8, 3.22, 1.0, fig);
  mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.1, 14), marble, 0.8, 1.55, 1.0, fig);
  { const nk = new THREE.Group(); nk.position.set(0.8, 3.3, 1.02); nk.scale.setScalar(0.55); fig.add(nk);
    mesh(fold(lathe([[0.001, 0], [0.32, 0], [0.26, 0.6], [0.18, 1.0], [0.12, 1.1]], 16), 0.05, 8, 0, 1), goldM, 0, 0, 0, nk); mesh(new THREE.SphereGeometry(0.11, 10, 8), ivoryM, 0, 1.23, 0, nk);
    for (const sx of [-1, 1]) { const wg = mesh(new THREE.SphereGeometry(0.3, 10, 6), goldM, sx * 0.3, 1.05, -0.12, nk); wg.scale.set(1, 1.6, 0.18); wg.rotation.z = sx * -0.5; }
    mesh(new THREE.TorusGeometry(0.12, 0.025, 5, 14), paint(0x5c7a34), 0.25, 0.9, 0.2, nk); }
  // left arm down to the shield; the shield stands at her side with Erichthonios coiled inside; spear against the shoulder
  limbTo(V(-0.52, 3.85, 0), V(-0.82, 3.3, 0.08), 0.13, 0.11, ivoryM, fig); limbTo(V(-0.82, 3.3, 0.08), V(-1.02, 2.72, 0.12), 0.11, 0.09, ivoryM, fig);
  mesh(new THREE.SphereGeometry(0.14, 10, 8), ivoryM, -0.52, 3.86, 0, fig);
  { const sh = new THREE.Group(); sh.position.set(-1.38, 1.3, 0.05); sh.rotation.y = -Math.PI / 2 + 0.55; fig.add(sh);
    mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.1, 40).rotateX(Math.PI / 2), goldM, 0, 0, 0, sh);
    mesh(new THREE.TorusGeometry(1.25, 0.07, 6, 40), goldM, 0, 0, 0.03, sh); mesh(new THREE.TorusGeometry(0.85, 0.035, 5, 36), goldM, 0, 0, 0.06, sh);
    const gh = mesh(new THREE.SphereGeometry(0.28, 14, 10), ivoryM, 0, 0, 0.08, sh); gh.scale.z = 0.35;
    for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2; const f = mesh(new THREE.CapsuleGeometry(0.05, 0.2, 2, 5), ivoryM, Math.cos(an) * 1.05, Math.sin(an) * 1.05, 0.08, sh); f.rotation.z = an; } }
  { const pts = []; for (let i = 0; i <= 60; i++) { const t = i / 60, an = t * Math.PI * 5; pts.push(new THREE.Vector3(-0.95 + Math.cos(an) * 0.35 * (1 - t * 0.4), 0.1 + t * 1.5 + (t > 0.85 ? (t - 0.85) * 3 : 0), 0.35 + Math.sin(an) * 0.35 * (1 - t * 0.4))); }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.07, 6), new THREE.MeshStandardMaterial({ color: 0x5f7442, metalness: 0.7, roughness: 0.35 }), 0, 0, 0, fig); }
  limbTo(V(-0.98, 0, -0.35), V(-0.72, 6.1, -0.5), 0.05, 0.045, goldM, fig);
  mesh(new THREE.ConeGeometry(0.1, 0.45, 8), goldM, -0.71, 6.34, -0.51, fig);
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.2, 0.08, 0.34), ivoryM, sx * 0.28, 0.04, 0.9, fig);                                                   // toes under the hem
  // Light: a shaft from the roof opening onto the statue, gilt tripods either side
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, ch - 0.4, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  shaft.position.set(0, top + ch / 2, -7.2); shaft.rotation.x = 0.12; g.add(shaft);
  const stL = new THREE.PointLight(0xffd9a0, 40, 18, 1.4); stL.position.set(0, top + 5.2, -3.6); g.add(stL);
  for (const sx of [-1, 1]) { const b = new THREE.Group(); b.position.set(sx * 2.7, top, -6.4); g.add(b);
    for (let k = 0; k < 3; k++) { const leg = mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.7, 5), goldM, Math.cos(k * 2.1) * 0.25, 0.85, Math.sin(k * 2.1) * 0.25, b); leg.rotation.set(Math.sin(k * 2.1) * 0.15, 0, -Math.cos(k * 2.1) * 0.15); }
    mesh(new THREE.CylinderGeometry(0.45, 0.2, 0.3, 12), goldM, 0, 1.75, 0, b);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 7), new THREE.MeshBasicMaterial({ color: 0xffa030 })); fl.position.y = 2.2; b.add(fl); braziers.push(fl); colliders.push({ x: TEMPLE.x + sx * 2.7, z: TEMPLE.z - 6.4, r: 0.45 }); }
  // Braziers at the entrance, and Athena's owls on plinths beside the stair
  for (const sgn of [-1, 1]) {
    const b = new THREE.Group(); b.position.set(sgn * 3.2, top, D + 1.6); g.add(b);
    mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x6a5030, metalness: 0.6, roughness: 0.4 }), 0, 0.6, 0, b);
    mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0x8a6a30, metalness: 0.7, roughness: 0.35 }), 0, 1.3, 0, b);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 7), new THREE.MeshBasicMaterial({ color: 0xffa030 })); fl.position.y = 1.85; b.add(fl);
    const L = new THREE.PointLight(0xff9a40, 25, 14, 1.6); L.position.y = 2.2; b.add(L); braziers.push(fl);
    const ow = new THREE.Group(); ow.position.set(sgn * 5.6, 0, D + 4.4); g.add(ow);
    mesh(new THREE.BoxGeometry(1.1, 1.3, 1.1), marble, 0, 0.65, 0, ow); const owl = new THREE.Group(); owl.position.y = 1.3; ow.add(owl);
    const bd = mesh(new THREE.SphereGeometry(0.38, 14, 10), marbleDark, 0, 0.42, 0, owl); bd.scale.set(0.9, 1.15, 0.85);
    mesh(new THREE.SphereGeometry(0.3, 14, 10), marbleDark, 0, 0.92, 0.04, owl);
    for (const ex of [-1, 1]) { mesh(new THREE.SphereGeometry(0.1, 10, 8), ochre, ex * 0.12, 0.95, 0.26, owl); mesh(new THREE.SphereGeometry(0.045, 6, 4), paint(0x1a1410), ex * 0.12, 0.95, 0.35, owl); const ear = mesh(new THREE.ConeGeometry(0.07, 0.2, 4), marbleDark, ex * 0.18, 1.2, 0, owl); ear.rotation.z = -ex * 0.3; }
    mesh(new THREE.ConeGeometry(0.05, 0.12, 4), ochre, 0, 0.86, 0.33, owl).rotation.x = Math.PI;
    colliders.push({ x: TEMPLE.x + sgn * 5.6, z: TEMPLE.z + D + 4.4, r: 0.8 });
  }
  g.position.copy(TEMPLE); g.position.y = TY - 0.2; bakeGroup(g);
  // gold and ivory: merge each into one mesh so the statue costs two draw calls
  { const byMat = new Map(); g.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    g.traverse((m) => { if (m.isMesh && m.material === goldM) { const geo = m.geometry.clone(); geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k); if (!byMat.has(m.material)) byMat.set(m.material, []); byMat.get(m.material).push([geo, m]); } });
    for (const [mt, list] of byMat) { list.forEach(([, m]) => m.parent.remove(m)); const mm = new THREE.Mesh(mergeGeometries(list.map((l) => l[0])), mt); mm.castShadow = true; g.add(mm); } }
  scene.add(g);
  FLOORS.push({ rect: true, x: TEMPLE.x, z: TEMPLE.z, w: W + 0.4, d: D + 0.4, y: TY + 1.3 });
  FLOORS.push({ rect: true, x: TEMPLE.x, z: TEMPLE.z, w: W + 1.3, d: D + 1.3, y: TY + 0.8 });
  FLOORS.push({ rect: true, x: TEMPLE.x, z: TEMPLE.z, w: W + 1.8, d: D + 1.8, y: TY + 0.3 });
}

// ---- Cave of Echoes: a rock dome in the mountain flank, entrance facing south, crystals inside
const CAVE_R = CH_R;
const crystals = [], caveTorches = [], caveInner = [], CAVE_VEILS = { mat: null };
const bouldMatEarly = () => new THREE.MeshStandardMaterial({ color: 0x575049, roughness: 1, flatShading: true });
let _glowTex; function glowTex() { if (_glowTex) return _glowTex; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (_glowTex = new THREE.CanvasTexture(c)); }
{
  const g = new THREE.Group(), rockIn = new THREE.MeshStandardMaterial({ color: 0x5d564e, roughness: 1, flatShading: true, side: THREE.DoubleSide });
  const lumpy = (geo, amp, seedOff) => { const a = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i); const f = 1 + (fbm(v.x * 0.35 + seedOff, v.z * 0.35 + v.y * 0.3) - 0.5) * amp; a.setXYZ(i, v.x * f, v.y * f, v.z * f); } geo.computeVertexNormals(); return geo; };
  // Chamber ceiling: an irregular rock vault resting on the carved walls
  const vault = lumpy(new THREE.SphereGeometry(CH_R + 1.2, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), 0.4, 3); vault.scale(1, 0.62, 1);
  const vm = new THREE.Mesh(vault, rockIn); vm.position.set(CAVE.x, CAVE_Y - 0.5, CAVE.z); vm.castShadow = vm.receiveShadow = true; vm.userData.keep = true; g.add(vm);
  // Mountain cap: the heightfield has to be carved down to the cave floor, which left an open pit on the flank.
  // This skin restores the mountain surface over the chamber and tunnel (the vault and tube stay inside it).
  { const cx0 = Math.min(CAVE.x, CAVE_MOUTH.x) - CH_R - 10, cx1 = Math.max(CAVE.x, CAVE_MOUTH.x) + CH_R + 10, cz0 = Math.min(CAVE.z, CAVE_MOUTH.z) - CH_R - 10, cz1 = Math.max(CAVE.z, CAVE_MOUTH.z) + CH_R + 10, N = 48;
    const geo = new THREE.PlaneGeometry(cx1 - cx0, cz1 - cz0, N, N); geo.rotateX(-Math.PI / 2); geo.translate((cx0 + cx1) / 2, 0, (cz0 + cz1) / 2);
    const a = geo.attributes.position, col = [], rockC = new THREE.Color(0x8a8178), mossC = new THREE.Color(0x6d665f);
    const orig = (x, z) => { let h = baseHeight(x, z); h = flatten(h, x, z, SUMMIT, ARENA_R, ARENA_R + 28, SUMMIT_Y); return Math.max(h, CAVE_Y + 13); };
    for (let i = 0; i < a.count; i++) { const x = a.getX(i), z = a.getZ(i), ch = Math.hypot(x - CAVE.x, z - CAVE.z) - CH_R, tn = segDist(x, z, CAVE_MOUTH, CAVE) - TUN_W,
        along = (x - CAVE_MOUTH.x) * CAVE_DIR.x + (z - CAVE_MOUTH.z) * CAVE_DIR.z, inside = Math.min(ch, tn) < 7 && along > 2.5;
      const w = clamp((7 - Math.min(ch, tn)) / 5, 0, 1) * clamp((along - 2.5) / 4, 0, 1), y = lerp(heightAt(x, z) - 1.5, orig(x, z), w);
      a.setY(i, y); const c = rockC.clone().lerp(mossC, fbm(x * 0.2, z * 0.2) * 0.7).multiplyScalar(0.85 + hash(x, z) * 0.15); col.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
    const cap = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })); cap.receiveShadow = cap.castShadow = true; cap.userData.keep = true; g.add(cap); }
  // Tunnel: an arched rock tube from the mouth to the chamber
  const tube = lumpy(new THREE.CylinderGeometry(TUN_W + 0.9, TUN_W + 0.9, TUN_LEN + 4, 18, 8, true, -Math.PI / 2, Math.PI), 0.35, 7);
  tube.rotateZ(Math.PI / 2); tube.rotateX(-Math.PI / 2); tube.rotateY(-Math.atan2(CAVE_DIR.z, CAVE_DIR.x));
  const tm = new THREE.Mesh(tube, rockIn); tm.position.copy(CAVE_MOUTH).addScaledVector(CAVE_DIR, (TUN_LEN + 4) / 2 - 0.5); tm.position.y = CAVE_Y - 0.3; tm.castShadow = tm.receiveShadow = true; tm.userData.keep = true; g.add(tm);
  // The mouth: stone lintel on two pillars framed by boulders, with hanging vines
  const side = new THREE.Vector3(-CAVE_DIR.z, 0, CAVE_DIR.x), yaw = Math.atan2(CAVE_DIR.x, CAVE_DIR.z);
  const lintelM = new THREE.MeshStandardMaterial({ color: 0x847b6e, roughness: 1, flatShading: true });
  // A natural rock arch frames the mouth: a lumpy half-torus, thick at the base, with a keystone overhang
  const archR = TUN_W + 1.25, arch = lumpy(new THREE.TorusGeometry(archR, 1.35, 9, 22, Math.PI), 0.5, 11); arch.scale(1, 1.25, 1);
  const am = mesh(arch, new THREE.MeshStandardMaterial({ color: 0x6a625a, roughness: 1, flatShading: true }), 0, 0, 0, g); am.position.copy(CAVE_MOUTH); am.position.y = CAVE_Y - 0.4; am.rotation.y = yaw;
  const arch2 = lumpy(new THREE.TorusGeometry(archR + 1.6, 1.6, 7, 16, Math.PI), 0.6, 13); arch2.scale(1, 1.3, 1.3);
  const am2 = mesh(arch2, bouldMatEarly(), 0, 0, 0, g); am2.position.copy(CAVE_MOUTH).addScaledVector(CAVE_DIR, 1.4); am2.position.y = CAVE_Y - 0.6; am2.rotation.y = yaw;
  for (const sg of [-1, 1]) { const foot = mesh(lumpy(new THREE.IcosahedronGeometry(1.7, 1), 0.4, 20 + sg), lintelM, 0, 0, 0, g); foot.position.copy(CAVE_MOUTH).addScaledVector(side, sg * (archR + 0.4)).addScaledVector(CAVE_DIR, -0.6); foot.position.y = CAVE_Y + 0.4; foot.scale.set(1, 0.8, 1.2); }
  // Darkness: two soft black veils inside the mouth sell the depth; they fade away once you step in
  const veilMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uO: { value: 1 } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform float uO; varying vec2 vU; void main(){ float e = smoothstep(0.,.22,vU.x)*smoothstep(1.,.78,vU.x)*smoothstep(1.,.7,vU.y); gl_FragColor = vec4(0.012,0.01,0.008, e*uO);\n#include <colorspace_fragment>\n}' });
  CAVE_VEILS.mat = veilMat;
  for (const [dd, sc] of [[1.2, 1], [3.8, 0.92], [7, 0.85]]) { const v = new THREE.Mesh(new THREE.PlaneGeometry(archR * 2.1 * sc, 7 * sc), veilMat); v.position.copy(CAVE_MOUTH).addScaledVector(CAVE_DIR, dd); v.position.y = CAVE_Y + 3.3 * sc; v.rotation.y = yaw + Math.PI; v.renderOrder = 2; g.add(v); }
  // Entrance torches in iron sconces: the mouth reads from far away, day or night
  for (const sg of [-1, 1]) {
    const tp = CAVE_MOUTH.clone().addScaledVector(side, sg * (archR - 0.3)).addScaledVector(CAVE_DIR, -1.3); tp.y = CAVE_Y + 2.6;
    mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.8 }), tp.x, tp.y - 0.3, tp.z, g).userData.keep = true;
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.55, 7), new THREE.MeshBasicMaterial({ color: 0xffa640 })); fl.position.copy(tp).setY(tp.y + 0.35); g.add(fl);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff9a40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(2.6); glow.position.copy(fl.position); g.add(glow);
    caveTorches.push({ fl, L: glow.material, glow: true });
  }
  const bould = new THREE.MeshStandardMaterial({ color: 0x575049, roughness: 1, flatShading: true });
  for (let i = 0; i < 22; i++) { const sg = i % 2 ? 1 : -1, b = mesh(lumpy(new THREE.IcosahedronGeometry(rr(1.2, 2.6), 1), 0.45, i), bould, 0, 0, 0, g);
    b.position.copy(CAVE_MOUTH).addScaledVector(side, sg * rr(TUN_W + 2, TUN_W + 7)).addScaledVector(CAVE_DIR, rr(-6, 3)); b.position.y = heightAt(b.position.x, b.position.z) + rr(-0.5, 1.5); b.rotation.set(rand(), rand(), rand()); }
  for (let i = 0; i < 8; i++) { const b = mesh(lumpy(new THREE.IcosahedronGeometry(rr(1.2, 2.2), 1), 0.45, i + 40), bould, 0, 0, 0, g); b.position.copy(CAVE_MOUTH).addScaledVector(side, rr(-5, 5)).addScaledVector(CAVE_DIR, rr(1, 6)); b.position.y = CAVE_Y + rr(7, 9); }
  const vineM = new THREE.MeshStandardMaterial({ color: 0x4f7a30, roughness: 0.9 });
  for (let i = 0; i < 14; i++) { const v = mesh(new THREE.CylinderGeometry(0.03, 0.02, rr(1.2, 3), 3), vineM, 0, 0, 0, g); const sx = rr(-TUN_W, TUN_W); v.position.copy(CAVE_MOUTH).addScaledVector(side, sx).addScaledVector(CAVE_DIR, -0.9); v.position.y = CAVE_Y - 0.4 + Math.sqrt(Math.max(0, (TUN_W + 1.25) ** 2 - sx * sx)) * 1.25 - 1.2 - rr(0, 0.8); }
  // Interior dressing: stalactites + stalagmites, rubble, bones, crystals, glowing mushrooms, wall torches, altar
  const dark = new THREE.MeshStandardMaterial({ color: 0x4d4741, roughness: 1, flatShading: true });
  for (let i = 0; i < 46; i++) { const an = rand() * 6.28, d = Math.sqrt(rand()) * CH_R * 0.85, x = CAVE.x + Math.cos(an) * d, z = CAVE.z + Math.sin(an) * d;
    const ceil = CAVE_Y - 0.5 + (CH_R + 1.2) * 0.62 * Math.sqrt(Math.max(0, 1 - (d / (CH_R + 1.2)) ** 2));
    const st = mesh(new THREE.ConeGeometry(rr(0.15, 0.5), rr(0.8, 2.8), 6), dark, x, ceil - 0.8, z, g); st.rotation.x = Math.PI;
    if (i % 3 === 0 && d > 4) mesh(new THREE.ConeGeometry(rr(0.25, 0.6), rr(0.6, 1.8), 6), dark, x + rr(-1, 1), CAVE_Y + 0.5, z + rr(-1, 1), g); }
  for (let i = 0; i < 30; i++) { const an = rand() * 6.28, d = rr(3, CH_R - 1); mesh(new THREE.DodecahedronGeometry(rr(0.2, 0.7), 0), dark, CAVE.x + Math.cos(an) * d, CAVE_Y + 0.15, CAVE.z + Math.sin(an) * d, g); }
  const bone = new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.7 });
  for (let i = 0; i < 12; i++) { const an = rand() * 6.28, d = rr(2, CH_R - 2), b = mesh(new THREE.CapsuleGeometry(0.05, rr(0.35, 0.6), 2, 5), bone, CAVE.x + Math.cos(an) * d, CAVE_Y + 0.08, CAVE.z + Math.sin(an) * d, g); b.rotation.set(Math.PI / 2, rand() * 3, 0);
    if (i % 4 === 0) mesh(new THREE.SphereGeometry(0.16, 8, 6), bone, b.position.x + 0.3, CAVE_Y + 0.14, b.position.z, g); }
  const cryMat = [new THREE.MeshStandardMaterial({ color: 0x5fe0ff, emissive: 0x2ab8e8, emissiveIntensity: 1.6, roughness: 0.2 }), new THREE.MeshStandardMaterial({ color: 0xc08bff, emissive: 0x8a4ae0, emissiveIntensity: 1.4, roughness: 0.2 })];
  for (let i = 0; i < 12; i++) {
    const an = i / 12 * 6.28 + rr(-0.2, 0.2), d = CH_R - rr(1.2, 2.5), cl = new THREE.Group(); cl.position.set(CAVE.x + Math.cos(an) * d, CAVE_Y, CAVE.z + Math.sin(an) * d); g.add(cl);
    if (Math.abs(Math.atan2(Math.sin(an - Math.atan2(-CAVE_DIR.z, -CAVE_DIR.x)), Math.cos(an - Math.atan2(-CAVE_DIR.z, -CAVE_DIR.x)))) < 0.5) continue;   // keep the tunnel entrance clear
    for (let k = 0; k < 5; k++) { const c = mesh(new THREE.OctahedronGeometry(rr(0.25, 0.65), 0), cryMat[i % 2], rr(-0.5, 0.5), 0.4, rr(-0.5, 0.5), cl); c.scale.y = rr(2, 3.8); c.rotation.set(rr(-0.5, 0.5), 0, rr(-0.5, 0.5)); c.castShadow = false; }
    collapseGroup(cl); cl.children.forEach((c) => { c.castShadow = false; crystals.push(c); }); caveInner.push(cl);
  }
  const shroom = new THREE.MeshStandardMaterial({ color: 0x9fffd0, emissive: 0x3fd09a, emissiveIntensity: 1.2 }), shG = new THREE.Group(); g.add(shG); caveInner.push(shG);
  for (let i = 0; i < 24; i++) { const an = rand() * 6.28, d = rr(CH_R * 0.6, CH_R - 1), x = CAVE.x + Math.cos(an) * d, z = CAVE.z + Math.sin(an) * d;
    mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.2, 5), shroom, x, CAVE_Y + 0.1, z, shG); mesh(new THREE.SphereGeometry(0.1, 8, 4, 0, 6.28, 0, 1.6), shroom, x, CAVE_Y + 0.2, z, shG); }
  collapseGroup(shG);
  const torchWood = new THREE.MeshStandardMaterial({ color: 0x5a3c22, roughness: 0.9 });
  for (const an of [0.7, 2.2, 3.8, 5.3].map((a) => a + Math.atan2(CAVE_DIR.z, CAVE_DIR.x))) {
    const x = CAVE.x + Math.cos(an) * (CH_R - 0.6), z = CAVE.z + Math.sin(an) * (CH_R - 0.6);
    const tw = mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.9, 5), torchWood, x, CAVE_Y + 2.4, z, g); tw.rotation.set(Math.sin(an) * 0.5, 0, -Math.cos(an) * 0.5); tw.userData.keep = true;
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 6), new THREE.MeshBasicMaterial({ color: 0xffa030 })); fl.position.set(x - Math.cos(an) * 0.25, CAVE_Y + 3.05, z - Math.sin(an) * 0.25); g.add(fl);
    const L = new THREE.PointLight(0xff9a40, 14, 13, 1.6); L.position.copy(fl.position); g.add(L); caveTorches.push({ fl, L });
  }
  for (const [c, k] of [[0x40c8ff, 0.4], [0xa060ff, -0.4]]) { const L = new THREE.PointLight(c, 22, 18, 1.5); L.position.set(CAVE.x + Math.cos(k) * 5, CAVE_Y + 3, CAVE.z + Math.sin(k) * 5); g.add(L); }
  // Altar at the back wall, facing the tunnel
  const altar = new THREE.Group(); altar.position.copy(CAVE).addScaledVector(CAVE_DIR, CH_R * 0.6); altar.position.y = CAVE_Y; altar.rotation.y = yaw; g.add(altar);
  mesh(new THREE.BoxGeometry(2.6, 1.1, 1.5), lintelM, 0, 0.55, 0, altar); mesh(new THREE.BoxGeometry(3, 0.2, 1.9), lintelM, 0, 1.2, 0, altar);
  for (const sx of [-1.7, 1.7]) mesh(new THREE.CylinderGeometry(0.28, 0.32, 2.6, 10), lintelM, sx, 1.3, -0.3, altar);
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 2), new THREE.MeshBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.55 })); orb.position.y = 1.7; altar.add(orb); crystals.push(orb);
  bakeGroup(g); scene.add(g);
  colliders.push({ x: altar.position.x, z: altar.position.z, r: 1.5 });
  var CAVE_ALTAR = altar.position.clone();
}
// Is a point inside the walkable cave (ravine + tunnel + chamber)? Used for collision, ground, camera and lighting
function inCaveInterior(x, z) { const cd = caveDist(x, z); return cd.roofed; }
function caveCollide(pos) {
  // Inside at cave level: stay within the chamber / tunnel. Above (on the mountain): stay off the roof.
  const ch = Math.hypot(pos.x - CAVE.x, pos.z - CAVE.z), tun = segDist(pos.x, pos.z, CAVE_MOUTH, CAVE);
  const along = (pos.x - CAVE_MOUTH.x) * CAVE_DIR.x + (pos.z - CAVE_MOUTH.z) * CAVE_DIR.z;
  const inZone = (ch < CH_R + 3.5 || (tun < TUN_W + 3 && along > -0.3));
  if (!inZone) return;
  const low = pos.y < CAVE_Y + 4.5;
  if (low) {
    if (ch < CH_R - 0.9 || (tun < TUN_W - 0.5)) return;
    // pull back to the nearest walkable point
    const a = new THREE.Vector3(CAVE.x - pos.x, 0, CAVE.z - pos.z), toC = CAVE.clone().addScaledVector(a.normalize(), -(CH_R - 0.9)); toC.set(CAVE.x + (pos.x - CAVE.x) / ch * (CH_R - 0.9), pos.y, CAVE.z + (pos.z - CAVE.z) / ch * (CH_R - 0.9));
    const dx = CAVE.x - CAVE_MOUTH.x, dz = CAVE.z - CAVE_MOUTH.z, t = clamp(((pos.x - CAVE_MOUTH.x) * dx + (pos.z - CAVE_MOUTH.z) * dz) / (dx * dx + dz * dz), 0, 1);
    const cx = CAVE_MOUTH.x + dx * t, cz = CAVE_MOUTH.z + dz * t, dd = Math.hypot(pos.x - cx, pos.z - cz) || 1, toT = new THREE.Vector3(cx + (pos.x - cx) / dd * (TUN_W - 0.5), pos.y, cz + (pos.z - cz) / dd * (TUN_W - 0.5));
    const pick = toC.distanceTo(pos) < toT.distanceTo(pos) ? toC : toT; if (along > -0.3 || ch < CH_R) { pos.x = pick.x; pos.z = pick.z; }
  } else {
    const d = Math.min(ch - (CH_R + 3.5), tun - (TUN_W + 3));
    if (d < 0) { if (ch - (CH_R + 3.5) > tun - (TUN_W + 3)) { const dx = CAVE.x - CAVE_MOUTH.x, dz = CAVE.z - CAVE_MOUTH.z, t = clamp(((pos.x - CAVE_MOUTH.x) * dx + (pos.z - CAVE_MOUTH.z) * dz) / (dx * dx + dz * dz), 0, 1), cx = CAVE_MOUTH.x + dx * t, cz = CAVE_MOUTH.z + dz * t, dd = Math.hypot(pos.x - cx, pos.z - cz) || 1; pos.x = cx + (pos.x - cx) / dd * (TUN_W + 3); pos.z = cz + (pos.z - cz) / dd * (TUN_W + 3); }
      else { pos.x = CAVE.x + (pos.x - CAVE.x) / ch * (CH_R + 3.5); pos.z = CAVE.z + (pos.z - CAVE.z) / ch * (CH_R + 3.5); } }
  }

}

// ---- Watchtower of Aeolus (from the buildings sheet): climb it to reveal the map
const TOWER_TOP = new THREE.Vector3(TOWER.x, heightAt(TOWER.x, TOWER.z) + 13.4, TOWER.z);
{
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0x7a5534, roughness: 0.9 }), stone = new THREE.MeshStandardMaterial({ color: 0xbdb4a4, roughness: 0.9, flatShading: true });
  for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(5.4 - i * 0.3, 1.2, 5.4 - i * 0.3), stone, 0, 0.6 + i * 1.2, 0, g);
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { const l = mesh(new THREE.CylinderGeometry(0.2, 0.25, 10, 7), wood, x * 0.85, 8.4, z * 0.85, g); l.rotation.set(z * 0.02, 0, -x * 0.02); }
  for (let lv = 0; lv < 2; lv++) for (let s2 = 0; s2 < 4; s2++) { const b = mesh(new THREE.BoxGeometry(0.15, 5.4, 0.15), wood, 0, 6.2 + lv * 3.6, 0, g); const a = s2 * Math.PI / 2; b.position.x = Math.cos(a) * 1.7; b.position.z = Math.sin(a) * 1.7; b.rotation.set(Math.sin(a) * 0.7, 0, Math.cos(a) * 0.7); }
  mesh(new THREE.BoxGeometry(5, 0.3, 5), wood, 0, 13.3, 0, g);
  for (const [x, z, w, d] of [[0, 2.4, 5, 0.15], [0, -2.4, 5, 0.15], [2.4, 0, 0.15, 5], [-2.4, 0, 0.15, 5]]) mesh(new THREE.BoxGeometry(w, 1, d), wood, x, 14, z, g);
  for (const [x, z] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]]) mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 6), wood, x, 15, z, g);
  const roof = mesh(new THREE.ConeGeometry(4.2, 2.6, 4), new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.9 }), 0, 17.8, 0, g); roof.rotation.y = Math.PI / 4;
  const ban = mesh(new THREE.PlaneGeometry(1.2, 2.2), new THREE.MeshStandardMaterial({ color: 0xb0392e, side: THREE.DoubleSide }), 0, 12, 2.5, g);
  mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 0, 12.3, 2.51, g);
  const fire = new THREE.PointLight(0xffb060, 20, 18, 1.5); fire.position.y = 15.5; g.add(fire);
  g.position.set(TOWER.x, heightAt(TOWER.x, TOWER.z) - 0.2, TOWER.z); bakeGroup(g); scene.add(g);
  colliders.push({ x: TOWER.x, z: TOWER.z, r: 3.2 });
  FLOORS.push({ x: TOWER.x, z: TOWER.z, r: 2.4, y: TOWER_TOP.y });
}

// ---- Lake Kastalia with a waterfall off the mountain
const lakeWater = new THREE.Mesh(new THREE.CircleGeometry(30, 48).rotateX(-Math.PI / 2), makeWaterMat({ level: LAKE_Y + 0.25, shallow: 0x7fe0cf, deep: 0x13607e, foam: 0.55, depthScale: 2.6, clarity: 1.3, ripple: 1.6 }));
lakeWater.position.set(LAKE.x, LAKE_Y + 0.25, LAKE.z); scene.add(lakeWater);
const fallU = { t: { value: 0 } }, fallFx = [];
{
  // Waterfall: a stream spills over a lip of stacked rock, curves out and falls into a foaming plunge pool with mist
  const dir = new THREE.Vector3(MOUNT.x - LAKE.x, 0, MOUNT.z - LAKE.z).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x), fp = LAKE.clone().addScaledVector(dir, 24);
  const topY = Math.max(heightAt(fp.x, fp.z) + 7, LAKE_Y + 15), hgt = topY - LAKE_Y, W = 5.5;
  const g = new THREE.Group(), rock = new THREE.MeshStandardMaterial({ color: 0x6e675e, roughness: 1, flatShading: true }), rock2 = new THREE.MeshStandardMaterial({ color: 0x5a544c, roughness: 1, flatShading: true });
  const lump = (r, seedOff) => { const q = new THREE.IcosahedronGeometry(r, 1), a = q.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i); const f = 1 + (fbm(v.x * 0.6 + seedOff, v.y * 0.6 + v.z * 0.4) - 0.5) * 0.55; a.setXYZ(i, v.x * f, v.y * f * 0.8, v.z * f); } q.computeVertexNormals(); return q; };
  // cliff: two flanking rock columns and a back wall, built from stacked boulders
  for (let k = 0; k < 26; k++) {
    const sg = k % 3 === 0 ? 0 : k % 3 === 1 ? -1 : 1, y = LAKE_Y + rr(0, hgt + 1), r = rr(2.2, 3.6);
    const p = fp.clone().addScaledVector(side, sg ? sg * rr(W / 2 + 1.6, W / 2 + 4) : rr(-W / 2, W / 2)).addScaledVector(dir, sg ? rr(-1, 2.5) : rr(2.4, 4));
    const m = mesh(lump(r, k * 3.1), k % 2 ? rock : rock2, p.x, y, p.z, g); m.rotation.set(rand(), rand() * 6, rand());
  }
  const lip = mesh(lump(2.2, 99), rock2, 0, 0, 0, g); lip.position.copy(fp).addScaledVector(dir, 1.8); lip.position.y = topY - 1.4; lip.scale.set(2, 0.7, 1.2); lip.rotation.y = Math.atan2(dir.x, dir.z);
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, p = fp.clone().addScaledVector(dir, -3).add(new THREE.Vector3(Math.cos(a) * 6.5, 0, Math.sin(a) * 6.5));   // plunge-pool boulders
    if (Math.cos(a) * dir.x + Math.sin(a) * dir.z < -0.3) continue; mesh(lump(rr(0.7, 1.4), k + 40), rock, p.x, LAKE_Y + 0.2, p.z, g); }
  bakeGroup(g); scene.add(g);
  // the falling sheet: leaves the lip horizontally then drops (a parabola), ragged edges, streaks, white at the bottom
  const geo = new THREE.PlaneGeometry(W, hgt, 8, 24), a = geo.attributes.position;
  for (let i = 0; i < a.count; i++) { const y01 = (a.getY(i) + hgt / 2) / hgt; a.setZ(i, Math.pow(y01, 3) * 1.6 + Math.sin(a.getX(i) * 1.7) * 0.15); a.setX(i, a.getX(i) * (0.85 + (1 - y01) * 0.25)); }
  geo.computeVertexNormals();
  const wf = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: fallU, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float t; varying vec2 vUv; float h(float n){ return fract(sin(n) * 43758.5); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = h(i.x + i.y * 57.0), b = h(i.x + 1.0 + i.y * 57.0), c = h(i.x + (i.y + 1.0) * 57.0), d = h(i.x + 1.0 + (i.y + 1.0) * 57.0); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
      void main(){
        vec2 p = vec2(vUv.x * 9.0, vUv.y * 2.5 + t * 1.6);
        float n = vn(p * vec2(1.0, 3.0)) * 0.6 + vn(p * vec2(2.3, 7.0) + 3.0) * 0.4;
        float streak = smoothstep(0.45, 0.8, n);
        float bottom = 1.0 - smoothstep(0.0, 0.3, vUv.y);
        vec3 c = mix(vec3(0.42, 0.72, 0.84), vec3(1.0), clamp(streak * 0.85 + bottom * 0.8 + (1.0 - vUv.y) * 0.2, 0.0, 1.0));
        float edge = smoothstep(0.0, 0.1 + n * 0.1, vUv.x) * smoothstep(1.0, 0.9 - n * 0.1, vUv.x);
        gl_FragColor = vec4(c, clamp((0.55 + streak * 0.4 + bottom * 0.3) * edge, 0.0, 0.95));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  wf.position.copy(fp).addScaledVector(dir, 1.2); wf.position.y = LAKE_Y + hgt / 2; wf.lookAt(wf.position.clone().sub(dir)); wf.renderOrder = 2; scene.add(wf);
  // plunge-pool foam: churning noise ring
  const foam = new THREE.Mesh(new THREE.CircleGeometry(5.5, 32).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: fallU, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float t; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.5); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){ vec2 d = vUv - 0.5; float r = length(d) * 2.0, a = atan(d.y, d.x);
        float n = vn(vec2(a * 3.0, r * 6.0 - t * 1.4)) * 0.6 + vn(vec2(a * 7.0, r * 11.0 - t * 2.2)) * 0.4;
        float m = smoothstep(0.35, 0.7, n + (1.0 - r) * 0.45) * (1.0 - smoothstep(0.75, 1.0, r));
        gl_FragColor = vec4(vec3(0.97, 0.99, 1.0), m * 0.85);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` }));
  foam.position.copy(fp).addScaledVector(dir, -1.5); foam.position.y = LAKE_Y + 0.3; foam.renderOrder = 3; scene.add(foam);
  // mist: soft additive puffs drifting up from the pool
  for (let k = 0; k < 7; k++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xe8f4ff, transparent: true, opacity: 0.35, depthWrite: false }));
    m.userData.base = fp.clone().addScaledVector(dir, -1.5).addScaledVector(side, rr(-3, 3)); m.userData.ph = rand() * 6; scene.add(m); fallFx.push(m); }
  // lily pads and reeds along the far shore
  const pad = new THREE.CircleGeometry(0.45, 10, 0.3, 5.9).rotateX(-Math.PI / 2), pads = new THREE.InstancedMesh(pad, new THREE.MeshStandardMaterial({ color: 0x4f7a30, roughness: 0.7 }), 60), mm = new THREE.Matrix4();
  let n = 0; for (let i = 0; i < 600 && n < 60; i++) { const an = rand() * 6.28, d = rr(12, 24), x = LAKE.x + Math.cos(an) * d, z = LAKE.z + Math.sin(an) * d, hh = heightAt(x, z);
    if (hh < LAKE_Y && hh > LAKE_Y - 1.2 && Math.hypot(x - fp.x, z - fp.z) > 9) { mm.compose(new THREE.Vector3(x, LAKE_Y + 0.27, z), new THREE.Quaternion().setFromAxisAngle(UPV, rand() * 6), new THREE.Vector3(1, 1, 1).multiplyScalar(rr(0.7, 1.3))); pads.setMatrixAt(n++, mm); } }
  pads.count = n; scene.add(pads);
}

// ---- Stymphalian Marsh: murky water, lily pads, fireflies at night
const swampWater = new THREE.Mesh(new THREE.CircleGeometry(98, 64).rotateX(-Math.PI / 2), makeWaterMat({ level: 0.5, shallow: 0x5d6a34, deep: 0x22301c, foam: 0.15, depthScale: 1.1, clarity: 2.6, weed: 1, ripple: 0.7 }));
swampWater.position.set(SWAMP.x, 0.5, SWAMP.z); scene.add(swampWater);
{
  const pad = new THREE.CircleGeometry(0.5, 10, 0.3, 5.9).rotateX(-Math.PI / 2), pads = new THREE.InstancedMesh(pad, new THREE.MeshStandardMaterial({ color: 0x4f7a30, roughness: 0.7 }), 400), m = new THREE.Matrix4();
  let n = 0;
  for (let i = 0; i < 2000 && n < 400; i++) { const a = rand() * 6.28, d = rr(0, 85), x = SWAMP.x + Math.cos(a) * d, z = SWAMP.z + Math.sin(a) * d; if (heightAt(x, z) < 0.45) { m.compose(new THREE.Vector3(x, 0.52, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28), new THREE.Vector3().setScalar(rr(0.6, 1.4))); pads.setMatrixAt(n++, m); } }
  pads.count = n; scene.add(pads);
}
const fireflies = (() => {
  const N = 260, g = new THREE.BufferGeometry(), a = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const an = rand() * 6.28, d = rr(0, 90); a.set([SWAMP.x + Math.cos(an) * d, rr(0.8, 3.5), SWAMP.z + Math.sin(an) * d], i * 3); }
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd8ff70, size: 0.35, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(pts); return pts;
})();

// ---- Olive terraces: dry-stone walls, vine rows, a roofless farmhouse
{
  const stone = new THREE.MeshStandardMaterial({ color: 0xb5ab98, roughness: 1, flatShading: true }), og = new THREE.Group();
  // Dry-stone terrace walls: a base course of big rough blocks, a top course of smaller stones and the odd flat
  // capstone, following the ground and gently curving. They stop cleanly at trees, paths and the sacred circle.
  const sm = [0xb5ab98, 0xa89e8a, 0xc2b9a6, 0x9c9282].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true })), moss = new THREE.MeshStandardMaterial({ color: 0x7d8a52, roughness: 1, flatShading: true });
  const rough = []; for (let v = 0; v < 6; v++) { const q = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2), a = q.attributes.position; for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * rr(0.86, 1.08), a.getY(i) * rr(0.85, 1.1), a.getZ(i) * rr(0.86, 1.08)); q.computeVertexNormals(); rough.push(q); }
  const treeNear = (x, z, pad) => resources.some((t) => t.type === 'tree' && Math.abs(t.pos.x - x) < 6 && Math.abs(t.pos.z - z) < 6 && Math.hypot(t.pos.x - x, t.pos.z - z) < t.r + pad);
  for (let k = -2; k <= 2; k++) {
    const len = 80 - Math.abs(k) * 12, zAt = (x) => OLIVE.z + k * 16 + Math.sin(x * 0.045 + k) * 1.4;
    for (let x = -len / 2; x < len / 2;) {
      const w = rr(0.8, 1.35), px = OLIVE.x + x + w / 2, pz = zAt(x + w / 2); x += w + 0.04;
      if (pathDist(px, pz) < 2.6 || Math.hypot(px - OLIVE.x, pz - OLIVE.z) < 19 || treeNear(px, pz, 0.9)) continue;
      const h = heightAt(px, pz), yaw = Math.atan2(zAt(x) - zAt(x - w), w);
      dryStone(og, px, h - 0.05, pz, yaw, w);
      colliders.push({ x: px, z: pz, r: 0.55, h: 0.95 });
    }
  }
  const vine = new THREE.MeshStandardMaterial({ color: 0x4f7a2e, roughness: 0.9 }), grape = new THREE.MeshStandardMaterial({ color: 0x5a2d6a, roughness: 0.4 });
  for (let r = 0; r < 6; r++) {                        // vineyard east of the olives
    const z = OLIVE.z - 20 + r * 5;
    for (let x = 0; x < 24; x += 2) { const px = OLIVE.x + 48 + x, h = heightAt(px, z); if (h < 1.5) continue;
      mesh(new THREE.BoxGeometry(1.9, 1.1, 0.7), vine, px, h + 0.55, z, og); if (rand() < 0.6) mesh(new THREE.SphereGeometry(0.16, 6, 5), grape, px + rr(-0.6, 0.6), h + 0.6, z + 0.4, og); }
  }
  bakeGroup(og); scene.add(og);
  const fh = new THREE.Group(), wallM = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.9 });
  mesh(new THREE.BoxGeometry(8, 3, 0.5), wallM, 0, 1.5, -3, fh); mesh(new THREE.BoxGeometry(0.5, 3, 6), wallM, -4, 1.5, 0, fh); mesh(new THREE.BoxGeometry(0.5, 2, 6), wallM, 4, 1, 0, fh);
  mesh(new THREE.BoxGeometry(3, 2.4, 0.5), wallM, -2.5, 1.2, 3, fh);
  mesh(new THREE.CylinderGeometry(0.6, 0.5, 1.2, 10), terracotta, 2, 0.6, 1, fh); mesh(new THREE.CylinderGeometry(0.5, 0.45, 1, 10), terracotta, 2.8, 0.5, -1.5, fh);   // amphorae
  const fp = new THREE.Vector3(OLIVE.x + 30, 0, OLIVE.z + 30); fh.position.set(fp.x, heightAt(fp.x, fp.z) - 0.1, fp.z); fh.rotation.y = 0.4; bakeGroup(fh); scene.add(fh);
  colliders.push({ x: fp.x, z: fp.z, r: 4 });
}
// Pollen / dust motes drifting in the light around the camera (day only)
const pollen = (() => {
  const N = 220, g = new THREE.BufferGeometry(), a = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) a.set([rr(-18, 18), rr(0, 6), rr(-18, 18)], i * 3);
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const p2 = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff2b0, size: 0.06, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(p2); return p2;
})();
// Birds: a few flocks gliding over the island (flapping wings by vertex scale)
const birds = [];
{
  const wing = new THREE.BufferGeometry(); wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.3, -0.9, 0.1, -0.1, 0, 0, -0.2, 0, 0, 0.3, 0, 0, -0.2, 0.9, 0.1, -0.1], 3)); wing.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: 0x2a2a30, side: THREE.DoubleSide, fog: true });
  for (let f = 0; f < 5; f++) { const c0 = new THREE.Vector3(rr(-200, 200), rr(45, 90), rr(-200, 200)), r = rr(30, 80);
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(wing, mat); b.userData = { c0, r, ph: rr(0, 6.28), off: new THREE.Vector3(rr(-4, 4), rr(-2, 2), rr(-4, 4)), sp: rr(0.12, 0.18) }; scene.add(b); birds.push(b); } }
}
// Low snow near the summit: falling flakes around the camera when high up
const snow = (() => {
  const N = 1200, g = new THREE.BufferGeometry(), a = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) a.set([rr(-30, 30), rr(0, 25), rr(-30, 30)], i * 3);
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const p2 = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(p2); return p2;
})();

// --- Forest floor: ferns and shrubs (instanced, wind-swayed) ---
{
  const fronds = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.PlaneGeometry(0.22, 0.9, 1, 3); g.translate(0, 0.45, 0);
    const a = g.attributes.position; for (let k = 0; k < a.count; k++) { const y = a.getY(k); a.setX(k, a.getX(k) * (1 - y / 1.0)); a.setZ(k, -y * y * 0.45); }   // arching frond
    g.rotateY(i / 9 * Math.PI * 2 + rr(-0.2, 0.2)); g.computeVertexNormals(); fronds.push([g, i % 2 ? 0x4f7f32 : 0x5f8f3a]);
  }
  PROP_LO = true;
  const fernGeo = mergeParts(fronds), shrubGeo = mergeParts([[blob(0.6, 0, 0.45, 0, new THREE.Vector3(0, 0.3, 0)), 0x4d7a30], [blob(0.5, 0.45, 0.35, 0.1, new THREE.Vector3(0, 0.3, 0)), 0x5a8638], [blob(0.45, -0.35, 0.3, 0.3, new THREE.Vector3(0, 0.3, 0)), 0x46702c]]);
  PROP_LO = false;
  const fernMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }), 0.05);
  const place = (geo, mat, n, pick) => {
    const im = new THREE.InstancedMesh(geo, mat, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0); let k = 0;
    for (let i = 0; i < n * 6 && k < n; i++) { const p2 = pick(); if (!p2) continue; m.compose(p2, q.setFromAxisAngle(up, rand() * 6.28), new THREE.Vector3().setScalar(rr(0.7, 1.4))); im.setMatrixAt(k++, m); }
    im.count = k; im.receiveShadow = true; scene.add(im); return im;
  };
  const inForest = () => { const a = rand() * 6.28, d = Math.sqrt(rand()) * 100, x = FOREST.x + Math.cos(a) * d, z = FOREST.z + Math.sin(a) * d, h = heightAt(x, z); return h > 1.5 && h < 40 && pathDist(x, z) > 2.5 ? new THREE.Vector3(x, h - 0.05, z) : null; };
  place(fernGeo, fernMat, 2600, inForest);
  place(fernGeo, fernMat, 500, () => { const a = rand() * 6.28, d = Math.sqrt(rand()) * 90, x = SWAMP.x + Math.cos(a) * d, z = SWAMP.z + Math.sin(a) * d, h = heightAt(x, z); return h > 0.5 ? new THREE.Vector3(x, h, z) : null; });
  const shrubs = place(cardBushGeo(9, 0.65, 1.0), qLeafMat('q_tree_leaves.png', 0x86a86c), 1400, () => { const x = rr(-ISLAND_R, ISLAND_R), z = rr(-ISLAND_R, ISLAND_R), h = heightAt(x, z); const R = regionAt(x, z, h); return h > 1.6 && h < 38 && pathDist(x, z) > 3 && (R.key === 'forest' || R.key === 'meadow' || R.key === 'lake') && fbm(x * 0.04, z * 0.04) > 0.45 ? new THREE.Vector3(x, h - 0.1, z) : null; });
  shrubs.castShadow = false;
}

const RAFT_SITE_EARLY = DOCK.clone().add(new THREE.Vector3(3.6, 0, 1));
// --- Roads: gravel core, darker worn edges (terrain colour), border stones, flagstones near buildings, signposts ---
{
  // Path ribbons: a textured strip draped on the terrain per trail, with ragged alpha-cut edges. One draw call per surface type.
  const pathTex = (kind) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
    const R = (a, b) => a + Math.random() * (b - a);
    if (kind === 'dirt') {
      g.fillStyle = '#b39a6c'; g.fillRect(0, 0, 256, 512);
      for (let i = 0; i < 2600; i++) { const v = R(-30, 30) | 0; g.fillStyle = `rgba(${150 + v},${128 + v},${88 + v},${R(0.3, 0.8)})`; g.fillRect(R(0, 256), R(0, 512), R(1, 4), R(1, 4)); }
      g.fillStyle = 'rgba(95,75,48,.28)'; for (const x of [78, 178]) for (let y = 0; y < 512; y += 2) g.fillRect(x + Math.sin(y * 0.05) * 3 - 9, y, 18, 2);   // cart ruts
      for (let i = 0; i < 160; i++) { const x = R(20, 236), y = R(0, 512), r = R(2, 6); const pv = R(120, 175) | 0; g.fillStyle = `rgb(${pv},${pv - 12},${pv - 30})`; g.beginPath(); g.ellipse(x, y, r, r * 0.7, R(0, 3), 0, 7); g.fill(); g.fillStyle = 'rgba(40,30,20,.25)'; g.fillRect(x - r, y + r * 0.5, r * 2, 1.5); }
    } else {
      g.fillStyle = '#6f675a'; g.fillRect(0, 0, 256, 512);            // mortar
      let y = 0;
      while (y < 512) { const h = kind === 'ascent' && Math.random() < 0.25 ? 46 : R(34, 60); let x = R(-30, 0);
        while (x < 256) { const w = R(40, 90), v = R(-18, 18) | 0; g.fillStyle = `rgb(${188 + v},${178 + v},${158 + v})`;
          g.beginPath(); g.roundRect(x + 3, y + 3, w - 6, h - 6, 7); g.fill();
          g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 6, y + 5, w - 14, 3); g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x + 5, y + h - 8, w - 10, 3);
          for (let k = 0; k < 10; k++) { g.fillStyle = `rgba(${90 + v},${85 + v},${70 + v},.25)`; g.fillRect(x + R(6, w - 8), y + R(6, h - 8), R(2, 6), R(1, 3)); }
          x += w; }
        if (kind === 'ascent' && h === 46) { g.fillStyle = 'rgba(40,34,28,.55)'; g.fillRect(0, y + h - 6, 256, 6); }   // step riser shadow
        y += h; }
      g.fillStyle = 'rgba(80,120,50,.55)'; for (let i = 0; i < 260; i++) g.fillRect(R(0, 256), R(0, 512), R(1, 3), R(3, 7));   // grass in the cracks
    }
    // ragged edges: alpha fades out with noise so the path eats into the grass unevenly
    const im = g.getImageData(0, 0, 256, 512), d = im.data;
    for (let y = 0; y < 512; y++) { const e1 = 18 + Math.sin(y * 0.07) * 8 + Math.sin(y * 0.23) * 5, e2 = 18 + Math.sin(y * 0.05 + 2) * 8 + Math.sin(y * 0.31) * 5;
      for (let x = 0; x < 256; x++) { const edge = Math.min(x - e1, 255 - x - e2) + (Math.random() - 0.5) * 10; d[(y * 256 + x) * 4 + 3] = edge < 0 ? 0 : 255; } }
    g.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  };
  const W_OF = { dirt: 3.4, paved: 3.8, ascent: 4.2 }, byKind = { dirt: [], paved: [], ascent: [] };
  PATHS.forEach((Pt, k) => {
    const kind = PATH_KIND[k], W = W_OF[kind], pos = [], uv = [], idx = [];
    const pts = []; for (let i = 0; i < Pt.length - 1; i++) { const [ax, az] = Pt[i], [bx, bz] = Pt[i + 1], L = Math.hypot(bx - ax, bz - az);
      for (let d = 0; d < L; d += 1) pts.push([ax + (bx - ax) * d / L, az + (bz - az) * d / L]); }
    pts.push(Pt[Pt.length - 1]);
    let v = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i], [x0, z0] = pts[Math.max(0, i - 1)], [x1, z1] = pts[Math.min(pts.length - 1, i + 1)], L = Math.hypot(x1 - x0, z1 - z0) || 1, nx = -(z1 - z0) / L, nz = (x1 - x0) / L;
      if (i) v += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]) / (W * 2);
      for (let j = 0; j <= 4; j++) { const o = (j / 4 - 0.5) * W, px = x + nx * o, pz = z + nz * o; const hh = heightAt(px, pz), sl = Math.abs(heightAt(px + 1, pz) - hh) + Math.abs(heightAt(px, pz + 1) - hh); pos.push(px, hh + 0.07 + Math.min(0.6, sl * 0.25), pz); uv.push(j / 4, v); }
      if (i) for (let j = 0; j < 4; j++) { const a = (i - 1) * 5 + j, b = a + 5; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    byKind[kind].push(geo);
  });
  for (const kind of Object.keys(byKind)) {
    const geo = mergeGeometries(byKind[kind]); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: pathTex(kind), alphaTest: 0.5, roughness: kind === 'dirt' ? 0.95 : 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    m.receiveShadow = true; m.name = 'paths'; scene.add(m);
  }
  // The Ascent: retaining wall on the downhill side, rope posts, stone steps where it climbs, torches at intervals, a gate at its foot
  const asc = new THREE.Group(), wallM = new THREE.MeshStandardMaterial({ color: 0x8e8577, roughness: 1, flatShading: true }), wood = new THREE.MeshStandardMaterial({ color: 0x5e4128, roughness: 0.9 }),
    rope = new THREE.MeshStandardMaterial({ color: 0xa88e5e, roughness: 1 }), stepM = new THREE.MeshStandardMaterial({ color: 0xa79d8b, roughness: 1 });
  const flames = [];
  let prevPost = null, walked = 0;
  for (let i = 1; i < ASCENT.length - 1; i++) {
    const [ax, az] = ASCENT[i], [bx, bz] = ASCENT[i + 1], L = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / L, tz = (bz - az) / L, nx = -tz, nz = tx;
    const down = heightAt(ax + nx * 8, az + nz * 8) < heightAt(ax - nx * 8, az - nz * 8) ? 1 : -1, yaw = Math.atan2(tx, tz);
    const grade = (ASCENT_H[i + 1] - ASCENT_H[i]) / L;
    for (let d = 0; d < L; d += 1.3) {
      const x = ax + tx * d, z = az + tz * d, h = heightAt(x, z), wx = x + nx * down * 2.4, wz = z + nz * down * 2.4;
      const blk = mesh(new THREE.BoxGeometry(0.7, rr(0.55, 0.8), 1.25), wallM, wx, heightAt(wx, wz) + 0.12, wz, asc); blk.rotation.y = yaw + rr(-0.06, 0.06);
      if (grade > 0.11 && ((walked + d) % 2.6) < 1.3) { const st = mesh(new THREE.BoxGeometry(3.6, 0.22, 0.55), stepM, x, h + 0.04, z, asc); st.rotation.y = yaw; }
    }
    walked += L;
    if (walked % 6 < L) {   // rope post on the drop side
      const px = ax + nx * down * 2.7, pz = az + nz * down * 2.7, ph = heightAt(px, pz) + 0.3;
      mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 5), wood, px, ph + 0.65, pz, asc);
      if (prevPost && Math.hypot(px - prevPost.x, pz - prevPost.z) < 9) {
        const a = new THREE.Vector3(px, ph + 1.1, pz), mid = a.clone().add(prevPost).multiplyScalar(0.5), len = a.distanceTo(prevPost);
        const r = mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 4), rope, mid.x, mid.y - 0.12, mid.z, asc); r.lookAt(a.x, a.y - 0.12, a.z); r.rotateX(Math.PI / 2);
      }
      prevPost = new THREE.Vector3(px, ph + 1.1, pz);
    }
    if (i % 9 === 0) {   // bronze torch stand on the uphill side
      const px = ax - nx * down * 2.6, pz = az - nz * down * 2.6, ph = heightAt(px, pz);
      mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.9, 6), wood, px, ph + 0.95, pz, asc);
      mesh(new THREE.CylinderGeometry(0.28, 0.14, 0.25, 8), wallM, px, ph + 1.95, pz, asc);
      flames.push(new THREE.ConeGeometry(0.2, 0.55, 6).translate(px, ph + 2.3, pz));
    }
  }
  // Gate at the foot of the Ascent: two marble pillars and a lintel
  { const [x0, z0] = ASCENT[3], [x1, z1] = ASCENT[5], L = Math.hypot(x1 - x0, z1 - z0), nx = -(z1 - z0) / L, nz = (x1 - x0) / L, h = heightAt(x0, z0), yaw = Math.atan2(x1 - x0, z1 - z0);
    for (const sg of [-1, 1]) { mesh(new THREE.BoxGeometry(0.9, 4.2, 0.9), marble, x0 + nx * sg * 2.8, h + 2.1, z0 + nz * sg * 2.8, asc); colliders.push({ x: x0 + nx * sg * 2.8, z: z0 + nz * sg * 2.8, r: 0.6 }); }
    const lin = mesh(new THREE.BoxGeometry(7.2, 0.7, 1.1), marble, x0, h + 4.55, z0, asc); lin.rotation.y = yaw + Math.PI / 2;
    const cap = mesh(new THREE.BoxGeometry(7.8, 0.25, 1.4), marbleDark, x0, h + 5.0, z0, asc); cap.rotation.y = yaw + Math.PI / 2; }
  bakeGroup(asc); scene.add(asc);
  const fm = new THREE.Mesh(mergeGeometries(flames), new THREE.MeshBasicMaterial({ color: 0xffa640 })); fm.name = 'ascentFlames'; scene.add(fm);
  // border stones on the dirt trails only (the stone roads have their own kerb)
  PATHS.forEach((Pt, k) => { if (PATH_KIND[k] !== 'dirt') return; for (let i = 0; i < Pt.length - 1; i++) {
    const [ax, az] = Pt[i], [bx, bz] = Pt[i + 1], len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
    if (rand() > 0.3) continue;
    const sgn = rand() < 0.5 ? -1 : 1, w = 2.5 + rand() * 0.5, x = ax + nx * w * sgn, z = az + nz * w * sgn, h = heightAt(x, z);
    if (h > 0.6) placeProp('rock', Math.floor(rand() * 3), new THREE.Vector3(x, h - 0.12, z), rr(0, 6.28), rr(0.14, 0.26));
  } });
  // Signposts at trail junctions, each board names where it leads (BotW / RDR2 wayfinding)
  const signTex = (txt) => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#8a6440'; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#5a3f26'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 58);
    g.fillStyle = '#f3e6c8'; g.font = 'bold 26px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 128, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const post = new THREE.MeshStandardMaterial({ color: 0x6a4a2e, roughness: 0.9 });
  const sign = (x, z, boards) => {
    const g = new THREE.Group(), h = heightAt(x, z); g.position.set(x, h, z); scene.add(g);
    mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.6, 6), post, 0, 1.3, 0, g);
    boards.forEach(([txt, tx, tz], i) => { const b = mesh(new THREE.BoxGeometry(1.6, 0.36, 0.06), [post, post, post, post, new THREE.MeshStandardMaterial({ map: signTex(txt) }), new THREE.MeshStandardMaterial({ map: signTex(txt) })], 0, 2.2 - i * 0.45, 0, g);
      b.rotation.y = Math.atan2(tx - x, tz - z) - Math.PI / 2; b.position.x = Math.sin(b.rotation.y + Math.PI / 2) * 0.7; b.position.z = Math.cos(b.rotation.y + Math.PI / 2) * 0.7; });
    colliders.push({ x, z, r: 0.3 });
  };
  sign(12, 24, [['Temple', TEMPLE.x, TEMPLE.z], ['Cave · Summit', CAVE.x, CAVE.z], ['Hylaea Woods', -60, 30]]);
  sign(82, 34, [['Lake Kastalia', LAKE.x, LAKE.z], ['Temple', TEMPLE.x, TEMPLE.z]]);
  sign(-58, 34, [['Marsh', SWAMP.x, SWAMP.z], ['Watchtower', TOWER.x, TOWER.z]]);
  sign(RUINS.x + 4, RUINS.z - 4, [['Olive Terraces', OLIVE.x, OLIVE.z], ["Nestor's Cove", HUT.x, HUT.z], ['Mountain', 10, 20]]);
  sign(-14, -56, [['Cave of Echoes', CAVE_MOUTH.x, CAVE_MOUTH.z], ['The Ascent · Summit', ASCENT[6][0], ASCENT[6][1]]]);
}

// --- Nestor's house: a proper island farmhouse. Whitewashed stone, an upper room, a tiled porch on wooden columns,
//     a walled courtyard with a vine pergola, storage jars and a garden, and on the west side the smithy:
//     workbench, anvil and a glowing forge. Tools (axe, spear) can only be made here.
const HUT_ROT = 0.3, hutW = (lx, lz) => new THREE.Vector3(HUT.x + lx * Math.cos(HUT_ROT) + lz * Math.sin(HUT_ROT), 0, HUT.z - lx * Math.sin(HUT_ROT) + lz * Math.cos(HUT_ROT));
const BENCH = hutW(-6.6, 1.4); BENCH.y = heightAt(BENCH.x, BENCH.z);
const hutGlow = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, emissive: 0xffa24a, emissiveIntensity: 0, roughness: 0.6 });
const forgeGlow = new THREE.MeshStandardMaterial({ color: 0xff6a20, emissive: 0xff5a10, emissiveIntensity: 2.2 });
{
  const g = new THREE.Group(), M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
  const plaster = M(0xf1e8d6), plaster2 = M(0xe6dac2), timber = M(0x6b4a2e), stoneM = M(0xa39a8a), stoneD = M(0x8a8174), tile = M(0xc4613a), tile2 = M(0xa84e2e), blue = M(0x3f6f8a), iron = M(0x3a3632);
  const roof = (w, d, x, y, z, pitch = 0.5) => { for (const sg of [-1, 1]) { const sl = mesh(new THREE.BoxGeometry(w / 2 / Math.cos(pitch) + 0.5, 0.16, d + 0.8), tile2, x + sg * w / 4, y + Math.tan(pitch) * w / 4, z, g); sl.rotation.z = -sg * pitch;
      for (let r = 0; r < Math.round(w / 1.1); r++) { const dd = -w / 4 + r * 0.55, rib = mesh(new THREE.CylinderGeometry(0.08, 0.08, d + 0.8, 6), tile, x + sg * (w / 4 + Math.cos(pitch) * dd * 0.5), y + Math.tan(pitch) * w / 4 - Math.sin(pitch) * dd * 0.5 + 0.12, z, g); rib.rotation.x = Math.PI / 2; } }
    mesh(new THREE.CylinderGeometry(0.15, 0.15, d + 0.8, 8), tile2, x, y + Math.tan(pitch) * w / 2 + 0.05, z, g).rotation.x = Math.PI / 2;
    const gab = new THREE.Shape(); gab.moveTo(-w / 2, 0); gab.lineTo(w / 2, 0); gab.lineTo(0, Math.tan(pitch) * w / 2); gab.closePath();
    for (const sz of [d / 2, -d / 2 - 0.06]) mesh(new THREE.ExtrudeGeometry(gab, { depth: 0.06, bevelEnabled: false }), plaster2, x, y, z + sz, g); };
  // main house 9 × 6.4, stone socle, whitewashed walls, corner quoins
  mesh(new THREE.BoxGeometry(9.4, 0.6, 6.8), stoneD, 0, 0.3, 0, g);
  mesh(new THREE.BoxGeometry(9, 3.4, 6.4), plaster, 0, 2.3, 0, g);
  for (const [x, z] of [[-4.5, 3.2], [4.5, 3.2], [-4.5, -3.2], [4.5, -3.2]]) for (let k = 0; k < 5; k++) mesh(new THREE.BoxGeometry(0.5, 0.55, 0.5), k % 2 ? stoneM : stoneD, x, 0.9 + k * 0.62, z, g);
  roof(9.6, 6.4, 0, 4.0, 0);
  // upper room over the east half, with its own roof and a small balcony
  mesh(new THREE.BoxGeometry(4.2, 2.6, 4.4), plaster, 2.4, 5.6, -0.6, g); roof(4.8, 4.4, 2.4, 6.9, -0.6, 0.55);
  mesh(new THREE.BoxGeometry(2.6, 0.15, 1.1), timber, 2.4, 4.9, 2.1, g); for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), timber, 1.2 + i * 0.48, 5.35, 2.6, g); mesh(new THREE.BoxGeometry(2.6, 0.08, 0.1), timber, 2.4, 5.75, 2.6, g);
  // door with a painted frame, shuttered windows (they glow warm at night)
  mesh(new THREE.BoxGeometry(1.5, 2.4, 0.1), timber, -0.6, 1.8, 3.22, g); mesh(new THREE.BoxGeometry(1.9, 0.25, 0.25), blue, -0.6, 3.1, 3.25, g);
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.2, 2.6, 0.22), blue, -0.6 + sx * 0.85, 1.9, 3.25, g);
  const win = (x, y, z, ry = 0) => { const w = mesh(new THREE.BoxGeometry(0.9, 0.9, 0.08), hutGlow, x, y, z, g); w.rotation.y = ry; w.userData.keep = true;
    const fr = mesh(new THREE.BoxGeometry(1.1, 0.12, 0.2), timber, x, y - 0.52, z + (ry ? 0 : 0.06), g); fr.rotation.y = ry;
    for (const sx of [-1, 1]) { const sh = mesh(new THREE.BoxGeometry(0.42, 0.95, 0.06), blue, x + (ry ? 0 : sx * 0.7), y, z + (ry ? sx * 0.7 : 0.1), g); sh.rotation.y = ry + (sx > 0 ? -0.4 : 0.4); } };
  win(-3, 2.4, 3.22); win(1.6, 2.4, 3.22); win(3.4, 2.4, 3.22); win(2.4, 5.7, 1.62); win(4.52, 2.4, 0, Math.PI / 2);
  // porch: four columns, beam and a tiled lean-to roof; bench and potted plants
  for (const x of [-3.8, -1.3, 1.3, 3.8]) { mesh(new THREE.CylinderGeometry(0.16, 0.19, 2.9, 10), timber, x, 2.05, 5.2, g); mesh(new THREE.BoxGeometry(0.45, 0.25, 0.45), stoneM, x, 0.72, 5.2, g); }
  mesh(new THREE.BoxGeometry(8.4, 0.25, 0.3), timber, 0, 3.55, 5.2, g);
  const pr = mesh(new THREE.BoxGeometry(9, 0.14, 2.6), tile2, 0, 3.75, 4.2, g); pr.rotation.x = 0.25;
  for (let i = 0; i < 12; i++) { const rb = mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 5), tile, -4.2 + i * 0.76, 3.86, 4.2, g); rb.rotation.x = Math.PI / 2 + 0.25; }
  mesh(new THREE.BoxGeometry(9, 0.2, 2.2), stoneM, 0, 0.62, 4.3, g);
  mesh(new THREE.BoxGeometry(2, 0.12, 0.5), timber, -3, 1.2, 3.6, g); for (const x of [-3.8, -2.2]) mesh(new THREE.BoxGeometry(0.12, 0.5, 0.45), timber, x, 0.95, 3.6, g);
  for (const x of [-4.2, 4.2]) { mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.5, 10), M(0xb4613a), x, 0.97, 5.9, g); mesh(new THREE.IcosahedronGeometry(0.4, 1), M(0x4f7f2e), x, 1.45, 5.9, g); }
  // courtyard wall with a gate gap on the path side
  const wallSeg = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 0.9);
    for (let k = 0; k < n; k++) { const t2 = (k + 0.5) / n; dryStone(g, lerp(x0, x1, t2), 0, lerp(z0, z1, t2), Math.atan2(z1 - z0, x1 - x0), L / n + 0.02, { h: 0.6, d: 0.62, coping: 'plaster', noRubble: true }); }
    const a = hutW(x0, z0), b2 = hutW(x1, z1); wallColliders(a.x, a.z, b2.x, b2.z, 0.5, 1.05); };
  wallSeg(9, 7, 9, 10); wallSeg(9, 10, 5.5, 10); wallSeg(-1, 10, -9.5, 10); wallSeg(-9.5, 10, -9.5, 4.5);
  // vine pergola in the courtyard
  for (const [x, z] of [[5.6, 4.5], [8.4, 4.5], [5.6, 8.6], [8.4, 8.6]]) mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.8, 6), timber, x, 1.4, z, g);
  for (const z of [4.5, 8.6]) mesh(new THREE.BoxGeometry(3.4, 0.14, 0.14), timber, 7, 2.85, z, g);
  for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(0.1, 0.1, 4.6), timber, 5.5 + i * 0.6, 2.95, 6.55, g);
  for (let i = 0; i < 16; i++) mesh(new THREE.IcosahedronGeometry(rr(0.45, 0.8), 1), M([0x4f7f2e, 0x5d8a34, 0x46752b][i % 3]), rr(5.4, 8.6), 3.1 + rr(-0.1, 0.25), rr(4.3, 8.8), g);
  for (let i = 0; i < 7; i++) mesh(new THREE.SphereGeometry(0.12, 6, 4), M(0x5a2a5a), rr(5.6, 8.4), 2.7, rr(4.6, 8.4), g);          // grapes
  mesh(new THREE.BoxGeometry(1.8, 0.1, 1), timber, 7, 0.95, 6.5, g); for (const [x, z] of [[6.3, 6.1], [7.7, 6.9]]) mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 5), timber, x, 0.5, z, g);
  // storage jars (pithoi), amphorae, woodpile, garden beds
  const pithos = (x, z, sc) => mesh(new THREE.LatheGeometry([[0.001, 0], [0.3, 0.05], [0.5, 0.5], [0.52, 0.9], [0.35, 1.3], [0.26, 1.42], [0.3, 1.5]].map(([r, y]) => new THREE.Vector2(r * sc, y * sc)), 14), M(0xb2663a), x, 0, z, g);
  pithos(-4.9, -2.2, 1); pithos(-4.9, -1, 0.85); pithos(4.9, 2, 0.9);
  for (let i = 0; i < 12; i++) { const l = mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.3, 7), M(0x8a6238), 5.1, 0.7 + Math.floor(i / 4) * 0.27, -2.4 + (i % 4) * 0.29 + (Math.floor(i / 4) % 2) * 0.14, g); l.rotation.z = Math.PI / 2; }
  for (let r = 0; r < 3; r++) { mesh(new THREE.BoxGeometry(3, 0.25, 0.8), M(0x5a3e28), -5.8, 0.15, 5.4 + r * 1.3, g); for (let i = 0; i < 6; i++) mesh(new THREE.IcosahedronGeometry(0.22, 0), M(r === 1 ? 0x6f9a3a : 0x5d8a34), -7.1 + i * 0.5, 0.45, 5.4 + r * 1.3, g); }
  // ---- the smithy wing (west): stone back wall, lean-to roof on posts, forge, anvil, workbench, tool rack
  mesh(new THREE.BoxGeometry(0.6, 3, 5.2), stoneM, -9, 1.5, 0, g); mesh(new THREE.BoxGeometry(4.5, 3, 0.6), stoneM, -6.75, 1.5, -2.6, g);
  for (const z of [2.4]) for (const x of [-8.6, -4.9]) mesh(new THREE.CylinderGeometry(0.14, 0.16, 3, 8), timber, x, 1.5, z, g);
  const lt = mesh(new THREE.BoxGeometry(5, 0.14, 5.8), tile2, -6.8, 3.25, 0, g); lt.rotation.z = 0.18;
  mesh(new THREE.BoxGeometry(5, 0.15, 4.9), stoneD, -6.8, 0.08, 0, g);
  // forge: stone hearth with glowing coals, hood and chimney, bellows
  mesh(new THREE.BoxGeometry(1.8, 1, 1.4), stoneD, -8, 0.5, -1.5, g); const coals = mesh(new THREE.BoxGeometry(1.2, 0.12, 0.9), forgeGlow, -8, 1.02, -1.5, g); coals.userData.keep = true;
  mesh(new THREE.CylinderGeometry(0.4, 1.0, 1.1, 4), stoneM, -8, 2.2, -1.5, g).rotation.y = Math.PI / 4; mesh(new THREE.BoxGeometry(0.6, 2.6, 0.6), stoneM, -8, 3.9, -1.5, g);
  mesh(new THREE.BoxGeometry(0.7, 0.3, 0.9), M(0x6a4a30), -6.8, 0.9, -1.9, g);
  const forgeL = new THREE.PointLight(0xff7a2a, 30, 12, 1.6); forgeL.position.set(-8, 1.6, -0.9); g.add(forgeL);
  // anvil on a stump
  mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.7, 10), M(0x6a4a30), -6.4, 0.45, -0.2, g);
  mesh(new THREE.BoxGeometry(0.8, 0.28, 0.35), iron, -6.4, 0.95, -0.2, g); mesh(new THREE.ConeGeometry(0.16, 0.45, 6), iron, -5.85, 0.99, -0.2, g).rotation.z = -Math.PI / 2; mesh(new THREE.BoxGeometry(0.4, 0.25, 0.3), iron, -6.4, 0.72, -0.2, g);
  // workbench with tools laid out
  mesh(new THREE.BoxGeometry(2.4, 0.14, 1), M(0x8a6238), -6.6, 1.0, 1.4, g); for (const [x, z] of [[-7.7, 1], [-5.5, 1], [-7.7, 1.8], [-5.5, 1.8]]) mesh(new THREE.BoxGeometry(0.12, 0.95, 0.12), timber, x, 0.5, z, g);
  mesh(new THREE.BoxGeometry(0.5, 0.08, 0.14), iron, -7.1, 1.12, 1.3, g); mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5), timber, -6.9, 1.1, 1.35, g).rotation.z = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.3, 0.2, 0.22), stoneM, -6.1, 1.17, 1.5, g); mesh(new THREE.BoxGeometry(0.6, 0.06, 0.3), M(0xb89a64), -5.9, 1.1, 1.2, g);
  // tool rack on the back wall
  mesh(new THREE.BoxGeometry(2.2, 0.1, 0.1), timber, -6.8, 2.2, -2.25, g);
  for (let i = 0; i < 4; i++) { mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), timber, -7.6 + i * 0.55, 1.7, -2.2, g); mesh(new THREE.BoxGeometry(0.25, 0.18, 0.06), iron, -7.6 + i * 0.55, 1.2, -2.18, g); }
  // ---- lived-in details: rafter ends under the eaves, geranium boxes, door steps, bougainvillea, garlic and peppers, a paved yard
  for (let x = -4.6; x <= 4.6; x += 0.75) for (const z of [3.42, -3.42]) mesh(new THREE.BoxGeometry(0.16, 0.16, 0.5), timber, x, 3.95, z + Math.sign(z) * 0.1, g);
  for (const x of [-3, 1.6, 3.4]) { mesh(new THREE.BoxGeometry(1.0, 0.22, 0.3), M(0x8a5a34), x, 1.82, 3.42, g);
    for (let i = 0; i < 6; i++) { mesh(new THREE.IcosahedronGeometry(0.09, 0), M(0x3f6f2a), x - 0.4 + i * 0.16, 1.98, 3.44, g); if (i % 2 === 0) mesh(new THREE.IcosahedronGeometry(0.07, 0), M([0xd8283a, 0xe0507a, 0xf2f2f2][i % 3]), x - 0.38 + i * 0.16, 2.08, 3.48, g); } }
  for (let k = 0; k < 2; k++) mesh(new THREE.BoxGeometry(1.9 - k * 0.3, 0.16, 0.45), M(0xd9d2c2), -0.6, 0.66 + k * 0.16, 3.55 - k * 0.12 + 0.35, g);
  for (let i = 0; i < 26; i++) mesh(new THREE.IcosahedronGeometry(rr(0.09, 0.15), 0), M([0xc0287a, 0xd23a8c, 0xa81e68][i % 3]), rr(5.4, 8.6), 3.05 + rr(-0.15, 0.3), rr(4.3, 8.8), g);   // bougainvillea
  for (const [x, c] of [[-1.75, 0xf0ead8], [0.55, 0xc8281e]]) { mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 3), M(0x8a7a5a), x, 2.65, 3.38, g);
    for (let i = 0; i < 6; i++) { const b = mesh(c === 0xc8281e ? new THREE.ConeGeometry(0.045, 0.16, 5) : new THREE.IcosahedronGeometry(0.06, 0), M(c), x + rr(-0.04, 0.04), 2.95 - i * 0.12, 3.42, g); if (c === 0xc8281e) b.rotation.x = Math.PI; } }
  for (let i = 0; i < 9; i++) { const sl = mesh(ROUGH[i % 6], M([0xcfc6b4, 0xbfb6a2, 0xd8d0be][i % 3]), 0.5 + Math.sin(i * 0.7) * 0.3, 0.05, 5.6 + i * 0.5, g); sl.scale.set(rr(0.7, 1.0), 0.1, rr(0.45, 0.6)); sl.rotation.y = rr(-0.3, 0.3); }
  // lantern by the door
  const lan = mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffa040, emissiveIntensity: 1.5 }), 0.5, 2.7, 3.4, g); lan.userData.keep = true;
  const LL = new THREE.PointLight(0xffb060, 10, 12, 1.6); LL.position.set(0.5, 2.6, 4); g.add(LL);
  g.position.copy(HUT); g.position.y -= 0.2; g.rotation.y = HUT_ROT; bakeGroup(g); scene.add(g);
  // colliders: the house, the smithy's back walls, the forge
  { const c = [[-4.5, -3.2], [4.5, -3.2], [4.5, 3.2], [-4.5, 3.2]].map(([x, z]) => hutW(x, z)); for (let i = 0; i < 4; i++) wallColliders(c[i].x, c[i].z, c[(i + 1) % 4].x, c[(i + 1) % 4].z, 0.6); }
  { const a = hutW(-9, -2.6), b2 = hutW(-9, 2.6), c2 = hutW(-4.5, -2.6); wallColliders(a.x, a.z, b2.x, b2.z, 0.4); wallColliders(a.x, a.z, c2.x, c2.z, 0.4); }
  for (const [x, z, r] of [[-8, -1.5, 1], [-6.4, -0.2, 0.5], [-6.6, 1.4, 0.8]]) { const w = hutW(x, z); colliders.push({ x: w.x, z: w.z, r }); }
  for (const [x, z] of [[-3.8, 5.2], [-1.3, 5.2], [1.3, 5.2], [3.8, 5.2]]) { const w = hutW(x, z); colliders.push({ x: w.x, z: w.z, r: 0.25 }); }
}
// ---- Paddock west of the smithy: post-and-rail fence, a gate facing the house, water trough, hay rack and bales.
//      Nestor's donkey, cow, horse and alpaca live here. A stone well stands outside the courtyard by the path.
const PEN = { x0: -22, x1: -12, z0: -6, z1: 5 };
{
  const g = new THREE.Group(), M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 });
  const wood = M(0x7a5634), woodD = M(0x5e4128), hay = M(0xd8b860), hayD = M(0xc09a45), stoneM = M(0xa39a8a), water = M(0x4a7f99);
  const rail = (x0, z0, x1, z1, gate) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 2.2), ang = Math.atan2(z1 - z0, x1 - x0);
    for (let k = 0; k <= n; k++) { const t2 = k / n, px = lerp(x0, x1, t2), pz = lerp(z0, z1, t2); const po = mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.35, 6), woodD, px, 0.62, pz, g); po.rotation.z = rr(-0.04, 0.04); }
    for (let k = 0; k < n; k++) { if (gate && k === Math.floor(n / 2)) continue;
      const mx = lerp(x0, x1, (k + 0.5) / n), mz = lerp(z0, z1, (k + 0.5) / n);
      for (const y of [0.55, 1.05]) { const r2 = mesh(new THREE.BoxGeometry(L / n + 0.1, 0.09, 0.07), wood, mx, y + rr(-0.03, 0.03), mz, g); r2.rotation.y = -ang; } }
    const a = hutW(x0, z0), b2 = hutW(x1, z1); wallColliders(a.x, a.z, b2.x, b2.z, 0.35, 1.2);
  };
  rail(PEN.x0, PEN.z0, PEN.x1, PEN.z0); rail(PEN.x0, PEN.z1, PEN.x1, PEN.z1); rail(PEN.x0, PEN.z0, PEN.x0, PEN.z1); rail(PEN.x1, PEN.z0, PEN.x1, PEN.z1, true);
  // trough
  mesh(new THREE.BoxGeometry(2.2, 0.5, 0.7), stoneM, -14, 0.25, -4.6, g); mesh(new THREE.BoxGeometry(2.0, 0.06, 0.5), water, -14, 0.46, -4.6, g);
  // hay rack with hay, and bales in the corner
  for (const x of [-20.6, -18.4]) mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 5), woodD, x, 0.75, 3.9, g);
  mesh(new THREE.BoxGeometry(2.4, 0.08, 0.08), wood, -19.5, 1.45, 3.9, g);
  const hp = mesh(new THREE.IcosahedronGeometry(0.75, 1), hay, -19.5, 0.85, 3.9, g); hp.scale.set(1.5, 0.75, 0.6);
  for (const [x, z, y, r] of [[-21, -5, 0.3, 0.3], [-19.9, -5.1, 0.3, -0.2], [-20.5, -5, 0.85, 0.1]]) { const b = mesh(new THREE.BoxGeometry(1.0, 0.55, 0.6), (x + z) % 2 ? hay : hayD, x, y, z, g); b.rotation.y = r; }
  // straw scattered on the ground
  for (let i = 0; i < 26; i++) { const st = mesh(new THREE.BoxGeometry(0.5, 0.02, 0.05), hayD, rr(PEN.x0 + 1, PEN.x1 - 1), 0.04, rr(PEN.z0 + 1, PEN.z1 - 1), g); st.rotation.y = rr(0, 3); }
  // the well: round stone drum, wooden frame and a bucket
  const W = [12, -2];
  mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.85, 14), stoneM, W[0], 0.42, W[1], g); mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 14), water, W[0], 0.78, W[1], g);
  for (const dx of [-0.75, 0.75]) mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.9, 6), woodD, W[0] + dx, 1.3, W[1], g);
  const ax = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 6), wood, W[0], 2.1, W[1], g); ax.rotation.z = Math.PI / 2;
  const roofW = mesh(new THREE.ConeGeometry(1.15, 0.7, 4), M(0xa84e2e), W[0], 2.6, W[1], g); roofW.rotation.y = Math.PI / 4;
  mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.26, 8), wood, W[0] + 0.3, 1.0, W[1] + 0.2, g);
  colliders.push({ x: hutW(W[0], W[1]).x, z: hutW(W[0], W[1]).z, r: 1.0 });
  g.position.copy(HUT); g.position.y -= 0.2; g.rotation.y = HUT_ROT; bakeGroup(g); scene.add(g);
}
// keep penned animals inside the paddock (local hut coordinates)
function clampToPen(o) {
  const dx = o.position.x - HUT.x, dz = o.position.z - HUT.z, c = Math.cos(HUT_ROT), sn = Math.sin(HUT_ROT);
  let lx = dx * c - dz * sn, lz = dx * sn + dz * c;
  lx = clamp(lx, PEN.x0 + 1.3, PEN.x1 - 1.3); lz = clamp(lz, PEN.z0 + 1.3, PEN.z1 - 1.3);
  const w = hutW(lx, lz); o.position.x = w.x; o.position.z = w.z;
}
const CHIMNEY_L = [-8, 5.4, -1.5];
// Chimney smoke
const smoke = [];
for (let i = 0; i < 6; i++) {
  const s = mesh(new THREE.IcosahedronGeometry(0.4, 0), new THREE.MeshStandardMaterial({ color: 0x777777, transparent: true, opacity: 0.5, flatShading: true }), 0, 0, 0);
  s.castShadow = false; s.userData.t = i / 6; scene.add(s); smoke.push(s);
}
const CHIMNEY = new THREE.Vector3(...CHIMNEY_L).applyAxisAngle(new THREE.Vector3(0, 1, 0), HUT_ROT).add(HUT);

// --- Throne of Olympos: the summit arena. A paved ring ~38 m across and the ruins of a great Temple of Zeus at its north end,
//     broken columns, a standing corner of entablature, a fallen pediment, toppled drums and an empty colossal throne. Boss fight goes here.
const ruinsGroup = new THREE.Group();
{
  const g = ruinsGroup, stone = new THREE.MeshStandardMaterial({ color: 0xd9d0bd, roughness: 0.75 }), stoneD = new THREE.MeshStandardMaterial({ color: 0xbdb29c, roughness: 0.85 }),
    blue = new THREE.MeshStandardMaterial({ color: 0x3a5480, roughness: 0.8 }), red = new THREE.MeshStandardMaterial({ color: 0x8e3a2e, roughness: 0.8 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x7a5a2a, metalness: 0.75, roughness: 0.4 });
  // Arena floor: weathered flagstones with cracks and grass, a mosaic ring and a sunburst of Zeus in the centre
  { const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
    x.fillStyle = '#8f877a'; x.fillRect(0, 0, 1024, 1024);
    for (let ring = 0; ring < 16; ring++) { const r0 = 40 + ring * 30, n = Math.floor(6 + ring * 5.5);
      for (let k = 0; k < n; k++) { const a0 = (k + (ring % 2) * 0.5) / n * Math.PI * 2, a1 = a0 + Math.PI * 2 / n, v = (Math.random() * 30 - 15) | 0;
        x.fillStyle = `rgb(${196 + v},${188 + v},${170 + v})`; x.beginPath(); x.arc(512, 512, r0 + 27, a0 + 0.012, a1 - 0.012); x.arc(512, 512, r0 + 2, a1 - 0.012, a0 + 0.012, true); x.closePath(); x.fill(); } }
    x.strokeStyle = '#c9a13a'; x.lineWidth = 10; x.beginPath(); x.arc(512, 512, 250, 0, 7); x.stroke(); x.lineWidth = 4; x.beginPath(); x.arc(512, 512, 272, 0, 7); x.stroke();
    x.fillStyle = '#c9a13a'; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; x.beginPath(); x.moveTo(512 + Math.cos(a) * 30, 512 + Math.sin(a) * 30); x.lineTo(512 + Math.cos(a + 0.12) * 140, 512 + Math.sin(a + 0.12) * 140); x.lineTo(512 + Math.cos(a - 0.12) * 140, 512 + Math.sin(a - 0.12) * 140); x.fill(); }
    x.fillStyle = '#2f4a78'; x.beginPath(); x.arc(512, 512, 34, 0, 7); x.fill();
    x.strokeStyle = 'rgba(40,34,28,.55)'; x.lineWidth = 2; for (let k = 0; k < 60; k++) { let px = Math.random() * 1024, py = Math.random() * 1024; x.beginPath(); x.moveTo(px, py); for (let q = 0; q < 6; q++) { px += Math.random() * 40 - 20; py += Math.random() * 40 - 20; x.lineTo(px, py); } x.stroke(); }
    x.fillStyle = 'rgba(80,110,50,.6)'; for (let k = 0; k < 900; k++) x.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 5);
    const im = x.getImageData(0, 0, 1024, 1024), d = im.data;                  // broken, ragged outer edge
    for (let py = 0; py < 1024; py++) for (let px = 0; px < 1024; px++) { const r = Math.hypot(px - 512, py - 512), e = 505 - Math.sin(Math.atan2(py - 512, px - 512) * 9) * 10 - Math.random() * 12; if (r > e) d[(py * 1024 + px) * 4 + 3] = 0; }
    x.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const fl = new THREE.Mesh(new THREE.CircleGeometry(ARENA_R - 1, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    fl.position.y = 0.36; fl.receiveShadow = true; fl.userData.keep = true; g.add(fl); }
  // Ring of broken columns around the arena
  const col = new THREE.CylinderGeometry(0.75, 0.85, 1, 24, 1);
  { const a = col.attributes.position; for (let i = 0; i < a.count; i++) { const ang = Math.atan2(a.getZ(i), a.getX(i)), f = 1 - 0.06 * (0.5 + 0.5 * Math.cos(ang * 20)); a.setX(i, a.getX(i) * f); a.setZ(i, a.getZ(i) * f); } col.computeVertexNormals(); }
  const drum = (x, z, rot, rz) => { const d = mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.5, 20), stoneD, x, 0.75, z, g); d.rotation.set(0, rot, Math.PI / 2 + (rz || 0)); };
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2; if (Math.sin(a) < -0.55) continue;                                     // gap to the north where the temple stands
    const x = Math.cos(a) * (ARENA_R - 3), z = Math.sin(a) * (ARENA_R - 3), h = [8, 2.5, 5.5, 1.2, 7, 3.4][i % 6] * rr(0.85, 1.1);
    const c = mesh(col, stone, x, 0.3 + h / 2, z, g); c.scale.y = h; colliders.push({ x: SUMMIT.x + x, z: SUMMIT.z + z, r: 0.9 });
    if (h > 7.5) mesh(new THREE.BoxGeometry(2.1, 0.45, 2.1), stone, x, 0.3 + h + 0.22, z, g);
    else { const top = mesh(new THREE.CylinderGeometry(0.78, 0.8, 0.5, 9), stoneD, x, 0.3 + h + 0.1, z, g); top.rotation.set(rr(-0.2, 0.2), rand(), rr(-0.2, 0.2)); }
    if (h < 4) drum(x + Math.cos(a + 1.3) * 2.2, z + Math.sin(a + 1.3) * 2.2, a, rr(-0.1, 0.1));
  }
  // The temple: platform, a 6×10 Doric peristyle (most columns broken), a surviving corner with its entablature, ruined cella walls
  const TW = 10, TD = 15, TZ = -(ARENA_R - TD - 4), top = 1.5, colH = 9;
  for (let i = 0; i < 3; i++) { mesh(new THREE.BoxGeometry((TW + 1.8 - i * 0.9) * 2, 0.5, (TD + 1.8 - i * 0.9) * 2), i === 2 ? stone : stoneD, 0, 0.55 + i * 0.5, TZ, g);
    FLOORS.push({ rect: true, x: SUMMIT.x, z: SUMMIT.z + TZ, w: TW + 1.8 - i * 0.9, d: TD + 1.8 - i * 0.9, y: SUMMIT_Y - 0.3 + 0.8 + i * 0.5 }); }
  const echinus = new THREE.LatheGeometry([new THREE.Vector2(0.62, 0), new THREE.Vector2(0.8, 0.12), new THREE.Vector2(0.95, 0.3), new THREE.Vector2(0.98, 0.4)], 20);
  const spots = [];
  for (let i = 0; i < 6; i++) { const x = -TW + 1 + i * (2 * TW - 2) / 5; spots.push([x, TZ - TD + 1], [x, TZ + TD - 1]); }
  for (let j = 1; j < 9; j++) { const z = TZ - TD + 1 + j * (2 * TD - 2) / 9; spots.push([-TW + 1, z], [TW - 1, z]); }
  const standing = new Set([0, 1, 2, 3, 4]);                  // the north-west corner still carries its architrave
  spots.forEach(([x, z], i) => {
    const corner = x < -TW + 2 && z < TZ - TD + 2 + (2 * TD - 2) / 9 * 2.1 || (z < TZ - TD + 2 && x < -TW + 1 + (2 * TW - 2) / 5 * 1.1);
    const h = corner ? colH : [0.8, 3.2, 1.6, 5.4, 2.4, 0][i % 6] * rr(0.8, 1.2);
    if (h < 0.4) { drum(x + rr(-1, 1), z + rr(1.5, 3), rr(0, 3)); drum(x + rr(-1, 1), z + rr(3.5, 5), rr(0, 3)); return; }
    const c = mesh(col, stone, x, top + 0.5 + h / 2, z, g); c.scale.y = h; colliders.push({ x: SUMMIT.x + x, z: SUMMIT.z + z, r: 0.9 });
    if (corner) mesh(echinus, stone, x, top + 0.5 + colH, z, g), mesh(new THREE.BoxGeometry(2.1, 0.36, 2.1), stone, x, top + 0.5 + colH + 0.58, z, g);
    else { const tp = mesh(new THREE.CylinderGeometry(0.72, 0.76, 0.35, 9), stoneD, x, top + 0.5 + h + 0.05, z, g); tp.rotation.set(rr(-0.25, 0.25), 0, rr(-0.25, 0.25)); if (h > 2) drum(x + rr(1.4, 2.4) * Math.sign(x || 1), z + rr(-1.5, 1.5), rr(0, 3)); }
  });
  { const eY = top + 0.5 + colH + 0.76, x0 = -TW + 1, z0 = TZ - TD + 1, lenX = (2 * TW - 2) / 5 * 1 + 1.4, lenZ = (2 * TD - 2) / 9 * 2 + 1.4;
    mesh(new THREE.BoxGeometry(lenX, 1.1, 1.6), stone, x0 + lenX / 2 - 0.7, eY + 0.55, z0, g); mesh(new THREE.BoxGeometry(1.6, 1.1, lenZ), stone, x0, eY + 0.55, z0 + lenZ / 2 - 0.7, g);
    for (let u = 0; u < lenX - 1; u += 1.8) { mesh(new THREE.BoxGeometry(0.7, 1.1, 0.12), blue, x0 + u, eY + 1.65, z0 - 0.82, g); mesh(new THREE.BoxGeometry(1, 0.95, 0.06), red, x0 + u + 0.9, eY + 1.65, z0 - 0.79, g); }
    mesh(new THREE.BoxGeometry(lenX, 1.1, 1.5), stone, x0 + lenX / 2 - 0.7, eY + 1.65, z0, g); mesh(new THREE.BoxGeometry(1.5, 1.1, lenZ), stone, x0, eY + 1.65, z0 + lenZ / 2 - 0.7, g);
    mesh(new THREE.BoxGeometry(lenX + 0.6, 0.4, 2), stone, x0 + lenX / 2 - 0.7, eY + 2.4, z0, g); }
  // fallen pediment slab leaning against the platform, and a toppled chunk of cornice
  { const sh = new THREE.Shape(); sh.moveTo(-6, 0); sh.lineTo(6, 0); sh.lineTo(0, 2.6); sh.closePath();
    const pd = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: false }), stone, 8, 1.2, TZ + TD + 4.5, g); pd.rotation.set(-1.15, 0.35, 0.12);
    const ty = new THREE.Shape(); ty.moveTo(-5, 0.3); ty.lineTo(5, 0.3); ty.lineTo(0, 2.2); ty.closePath(); const tm = mesh(new THREE.ShapeGeometry(ty), blue, 0, 0, 0, pd); tm.position.z = 0.92;
    const cr = mesh(new THREE.BoxGeometry(5, 1.1, 1.6), stoneD, -9, 0.9, TZ + TD + 3, g); cr.rotation.set(0.2, 0.8, 0.35);
    colliders.push({ x: SUMMIT.x + 8, z: SUMMIT.z + TZ + TD + 4.5, r: 3.5 }, { x: SUMMIT.x - 9, z: SUMMIT.z + TZ + TD + 3, r: 2 }); }
  // Cella: walls broken to uneven heights, a doorway to the south
  const cw = 6, cd = 10, wall = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 1.2);
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, hh = Math.max(0.6, 4.5 * (0.5 + 0.5 * Math.sin(k * 0.9 + x0)) + rr(-1, 1));
      for (let y = 0; y < hh; y += 0.6) { if (y + 0.6 > hh && rand() < 0.5) break; const b = mesh(new THREE.BoxGeometry(1.18, 0.58, 0.9), (k + Math.round(y / 0.6)) % 3 ? stoneD : stone, lerp(x0, x1, t), top + 0.8 + y, TZ + lerp(z0, z1, t), g); b.rotation.y = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2 + rr(-0.03, 0.03); } }
    wallColliders(SUMMIT.x + x0, SUMMIT.z + TZ + z0, SUMMIT.x + x1, SUMMIT.z + TZ + z1); };
  wall(-cw, -cd, cw, -cd); wall(-cw, -cd, -cw, cd); wall(cw, -cd, cw, cd); wall(-cw, cd, -1.8, cd); wall(1.8, cd, cw, cd);
  // The empty throne of Zeus: colossal, marble with gilt bronze, a broken statue's feet still on the seat, the head fallen at its base
  { const th = new THREE.Group(); th.position.set(0, top + 0.5, TZ - cd + 3.2); g.add(th);
    mesh(new THREE.BoxGeometry(6, 1.2, 4.2), stoneD, 0, 0.6, 0, th); mesh(new THREE.BoxGeometry(5.2, 1.6, 3.6), stone, 0, 2, 0.1, th);
    mesh(new THREE.BoxGeometry(5.4, 6.5, 0.9), stone, 0, 4.5, -1.5, th);
    for (const sx of [-1, 1]) { mesh(new THREE.BoxGeometry(0.8, 1.6, 3.4), stone, sx * 2.6, 3.4, 0.1, th); mesh(new THREE.SphereGeometry(0.5, 12, 8), bronze, sx * 2.6, 4.3, 1.6, th); mesh(new THREE.BoxGeometry(0.9, 0.4, 3.6), bronze, sx * 2.6, 4.2, 0.1, th); }
    mesh(new THREE.BoxGeometry(5.6, 0.5, 1.1), bronze, 0, 7.9, -1.5, th); mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 24).rotateX(Math.PI / 2), bronze, 0, 6.2, -1.0, th);
    const bolt = new THREE.Shape(); bolt.moveTo(0.1, 0.8); bolt.lineTo(-0.35, 0); bolt.lineTo(0, 0.05); bolt.lineTo(-0.15, -0.8); bolt.lineTo(0.35, 0.1); bolt.lineTo(0, 0.05); bolt.closePath();
    mesh(new THREE.ExtrudeGeometry(bolt, { depth: 0.1, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xffd060, emissive: 0xffa020, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3 }), 0, 6.2, -0.8, th);
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.9, 0.7, 1.6), stone, sx * 0.8, 3.15, 1.2, th);                 // the feet that remain
    const head = new THREE.Group(); head.position.set(3.4, 0.9, 5.2); head.rotation.set(0.25, 0.9, 1.3); th.add(head);
    mesh(new THREE.SphereGeometry(1.3, 18, 14), stone, 0, 0, 0, head).scale.set(0.9, 1.1, 1);
    mesh(new THREE.SphereGeometry(1.0, 14, 10), stoneD, 0, -1.1, 0.4, head).scale.set(1.1, 0.9, 0.8);                        // beard
    mesh(new THREE.SphereGeometry(1.2, 14, 10, 0, Math.PI * 2, 0, 1.1), stoneD, 0, 0.35, -0.1, head);                        // hair
    mesh(new THREE.BoxGeometry(0.25, 0.5, 0.3), stone, 0, -0.05, 1.2, head);
    colliders.push({ x: SUMMIT.x, z: SUMMIT.z + TZ - cd + 3.2, r: 3.2 }, { x: SUMMIT.x + 3.4, z: SUMMIT.z + TZ - cd + 8.4, r: 1.6 }); }
  // Rubble and blocks all over; four great bronze braziers mark the fighting ring
  for (let i = 0; i < 40; i++) { const a = rand() * 6.28, d = rr(6, ARENA_R - 4), b = mesh(new THREE.BoxGeometry(rr(0.5, 1.6), rr(0.3, 0.8), rr(0.5, 1.2)), rand() < 0.5 ? stone : stoneD, Math.cos(a) * d, 0.5, Math.sin(a) * d, g); b.rotation.set(rr(-0.3, 0.3), rand() * 3, rr(-0.3, 0.3)); }
  for (const [bx, bz, lit] of [[-14, 10, true], [14, 10, true], [-15, -4, false], [15, -4, false]]) {
    const b = new THREE.Group(); b.position.set(bx, 0.35, bz); g.add(b);
    mesh(new THREE.CylinderGeometry(0.9, 1.2, 0.6, 12), stoneD, 0, 0.3, 0, b);
    for (let k = 0; k < 3; k++) { const leg = mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.6, 6), bronze, Math.cos(k * 2.1) * 0.55, 1.8, Math.sin(k * 2.1) * 0.55, b); leg.rotation.set(Math.sin(k * 2.1) * 0.18, 0, -Math.cos(k * 2.1) * 0.18); }
    mesh(new THREE.CylinderGeometry(1.3, 0.55, 0.7, 14), bronze, 0, 3.3, 0, b);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2, 8), new THREE.MeshBasicMaterial({ color: 0xff8a2a })); fl.position.y = 4.5; b.add(fl); braziers.push(fl);
    if (lit) { const L = new THREE.PointLight(0xff8a3a, 60, 30, 1.4); L.position.y = 5.4; b.add(L); }
    colliders.push({ x: SUMMIT.x + bx, z: SUMMIT.z + bz, r: 1.3 });
  }
  ruinsGroup.position.set(SUMMIT.x, SUMMIT_Y - 0.3, SUMMIT.z); bakeGroup(ruinsGroup); scene.add(ruinsGroup);
}
const chestObj = new THREE.Group();
mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), flat(0x7a4f2c), 0, 0.35, 0, chestObj);
const chestLid = mesh(new THREE.BoxGeometry(1.25, 0.25, 0.85), flat(0xb08a3a), 0, 0.8, 0, chestObj);
const chestPos = CAVE.clone().addScaledVector(CAVE_DIR, CH_R * 0.45).addScaledVector(new THREE.Vector3(-CAVE_DIR.z, 0, CAVE_DIR.x), 3.4).setY(CAVE_Y);
const chest = addPickup('chest', chestPos, () => chestObj);
colliders.push({ x: chestPos.x, z: chestPos.z, r: 0.8 });

// --- Old dock & raft site ---
const dockGroup = new THREE.Group();
{
  const wood = flat(0x8a6238);
  for (let i = 0; i < 8; i++) mesh(new THREE.BoxGeometry(3, 0.2, 0.7), wood, 0, 0.5, -4 + i * 0.8, dockGroup);
  for (const x of [-1.4, 1.4]) for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.4, 6), wood, x, 0, -3.8 + i * 2.6, dockGroup);
  dockGroup.position.set(DOCK.x, 0, DOCK.z); bakeGroup(dockGroup); scene.add(dockGroup);
}
// --- Your boat: wrecked on the cove shore at the start, mended later (main quest) and sailed out through the channel ---
const RAFT_SITE = WRECK.clone();
const boatYaw = Math.atan2(SEA_OUT.x - WRECK.x, SEA_OUT.z - WRECK.z);            // bow toward the open sea
function boatHull(g, broken) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.85, side: THREE.DoubleSide, flatShading: true }), dark = flat(0x5a3a22), paint = flat(0x2f4f86), white = flat(0xefe6d2), black = flat(0x151515);
  // planked hull: a half-ellipsoid shell with plank bands in alternating tones; the wreck is missing a chunk of its side
  const hull = new THREE.SphereGeometry(1, 28, 10, broken ? 0.9 : 0, broken ? Math.PI * 2 - 1.5 : Math.PI * 2, Math.PI / 2, Math.PI / 2);
  { const a = hull.attributes.position, c = []; for (let i = 0; i < a.count; i++) { const band = Math.floor(-a.getY(i) * 6) % 2, col = new THREE.Color(band ? 0x7a4e2c : 0x93623a); c.push(col.r, col.g, col.b); } hull.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); }
  const hm = new THREE.Mesh(hull, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, flatShading: true })); hm.scale.set(1.15, 0.8, 2.9); hm.userData.keep = true; hm.castShadow = true; g.add(hm);
  const gun = mesh(new THREE.TorusGeometry(1, 0.07, 5, 40, broken ? Math.PI * 1.4 : Math.PI * 2), dark, 0, 0, 0, g); gun.rotation.x = Math.PI / 2; gun.scale.set(1.15, 2.9, 1);
  mesh(new THREE.TorusGeometry(1.01, 0.05, 4, 40, broken ? Math.PI * 1.3 : Math.PI * 2), paint, 0, -0.14, 0, g).rotation.x = Math.PI / 2;   // painted strake
  g.children[g.children.length - 1].scale.set(1.13, 2.87, 1);
  for (let i = -2; i <= 2; i++) { if (broken && i === 1) continue; const rib = mesh(new THREE.TorusGeometry(1, 0.05, 4, 12, Math.PI), dark, 0, 0, i * 0.95, g); rib.rotation.z = Math.PI; rib.scale.set(1.1 * Math.sqrt(1 - (i * 0.95 / 2.9) ** 2), 0.76 * Math.sqrt(1 - (i * 0.95 / 2.9) ** 2), 1); }
  for (let i = -1; i <= 1; i++) mesh(new THREE.BoxGeometry(2.1 * Math.sqrt(1 - (i * 1.2 / 2.9) ** 2), 0.08, 0.35), wood, 0, -0.12, i * 1.2, g);   // thwarts
  // stem post curling up at the bow, stern post, and the painted eyes (oculi) that let a Greek ship see its way
  const stem = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.6, 2.7), new THREE.Vector3(0, 0.1, 3.05), new THREE.Vector3(0, 0.8, 3.1), new THREE.Vector3(0, 1.2, 2.85)]);
  mesh(new THREE.TubeGeometry(stem, 12, 0.09, 6), dark, 0, 0, 0, g);
  const stern = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.6, -2.7), new THREE.Vector3(0, 0.2, -3.0), new THREE.Vector3(0, 0.9, -2.8), new THREE.Vector3(0, 1.3, -2.4)]);
  if (!broken) mesh(new THREE.TubeGeometry(stern, 12, 0.08, 6), dark, 0, 0, 0, g);
  for (const sx of [-1, 1]) { if (broken && sx > 0) continue; const e = mesh(new THREE.CircleGeometry(0.16, 14), white, sx * 0.62, -0.12, 2.45, g); e.rotation.y = sx * 1.25; const pu = mesh(new THREE.CircleGeometry(0.08, 10), black, sx * 0.63, -0.12, 2.46, g); pu.rotation.y = sx * 1.25; pu.position.x += sx * 0.005; }
  return wood;
}
// the wreck
const wreckGroup = new THREE.Group();
{
  const g = wreckGroup; boatHull(g, true);
  const wood = flat(0x8a5a32), cloth = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.95, side: THREE.DoubleSide, flatShading: true });
  mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.4, 6), wood, 0, 0.3, 0.6, g).rotation.z = 0.2;                                   // snapped mast stump
  const mast = mesh(new THREE.CylinderGeometry(0.1, 0.12, 4.2, 6), wood, 0, 0, 0, g); mast.position.set(2.6, -0.2, 0.5); mast.rotation.set(0.1, 0.3, Math.PI / 2 - 0.08);
  // torn sail draped over the sand
  const sg = new THREE.PlaneGeometry(3, 2.4, 10, 8); { const a = sg.attributes.position; for (let i = 0; i < a.count; i++) { const x = a.getX(i), y = a.getY(i); a.setZ(i, Math.sin(x * 2.2) * 0.12 + Math.cos(y * 3 + x) * 0.08 + (x > 1.2 && y > 0.6 ? -0.4 : 0)); } sg.computeVertexNormals(); }
  const sail = mesh(sg, cloth, 2.9, -0.45, -1.2, g); sail.rotation.set(-Math.PI / 2 + 0.08, 0, 0.4); sail.userData.keep = true;
  for (let i = 0; i < 7; i++) { const pl = mesh(new THREE.BoxGeometry(rr(1.2, 2.2), 0.07, 0.28), wood, rr(-3.5, 3.5), -0.5, rr(-3, 3.5), g); pl.rotation.set(rr(-0.2, 0.2), rand() * 3, rr(-0.15, 0.15)); }
  for (let i = 0; i < 3; i++) { const am = new THREE.Group(); am.position.set(rr(-3, -1.8), -0.45, rr(-2.5, 1.5)); am.rotation.set(Math.PI / 2 - 0.2, rand() * 3, 0); g.add(am);    // amphorae
    mesh(new THREE.LatheGeometry([[0.001, 0], [0.16, 0.05], [0.28, 0.35], [0.26, 0.7], [0.1, 0.95], [0.08, 1.15], [0.11, 1.2]].map(([r, y]) => new THREE.Vector2(r, y)), 12), flat(0xb2663a), 0, 0, 0, am); }
  mesh(new THREE.TorusGeometry(0.35, 0.08, 6, 14), flat(0xb89a64), -1.6, -0.5, 2.2, g).rotation.x = Math.PI / 2;                   // rope coil
  g.position.copy(WRECK); g.position.y = Math.max(heightAt(WRECK.x, WRECK.z), -0.4) + 0.8; g.rotation.set(0.06, boatYaw + 0.5, 0.3);
  bakeGroup(g); scene.add(g); colliders.push({ x: WRECK.x, z: WRECK.z, r: 2.4 });
}
// the mended boat (hidden until you repair it); sailing moves this group
const raftGroup = new THREE.Group(); raftGroup.position.set(RAFT_SITE.x, -0.05, RAFT_SITE.z); raftGroup.rotation.y = boatYaw; scene.add(raftGroup);
const raftParts = [];
{
  const hullG = new THREE.Group(); raftGroup.add(hullG); const wood = boatHull(hullG, false); raftParts.push(hullG);
  const mast = mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.2, 7), flat(0x6a4a2e), 0, 2.4, 0.5, raftGroup); raftParts.push(mast);
  const yard = mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 6), flat(0x6a4a2e), 0, 4.6, 0.62, raftGroup); yard.rotation.z = Math.PI / 2; raftParts.push(yard);
  const sg = new THREE.PlaneGeometry(3.4, 2.9, 6, 6); { const a = sg.attributes.position; for (let i = 0; i < a.count; i++) a.setZ(i, (1 - (a.getX(i) / 1.7) ** 2) * 0.35); sg.computeVertexNormals(); }
  const sail = mesh(sg, new THREE.MeshStandardMaterial({ color: 0xf1e8d4, side: THREE.DoubleSide, flatShading: true }), 0, 3.15, 0.75, raftGroup); raftParts.push(sail);
  for (const y of [2.1, 3.1, 4.1]) { const st = mesh(new THREE.PlaneGeometry(3.42, 0.22), new THREE.MeshStandardMaterial({ color: 0xa3392c, side: THREE.DoubleSide }), 0, y, 0.77 + (1 - 0) * 0.02, raftGroup); raftParts.push(st); }
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const o = mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 5), flat(0x9b6e3f), sx * 1.6, 0.05, -1 + i * 0.9, raftGroup); o.rotation.z = sx * 1.2; raftParts.push(o); }
  raftParts.forEach((p) => (p.visible = false));
}
const raftGhost = { visible: false };

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
player.position.copy(START); player.rotation.order = "YXZ"; scene.add(player);
const tools = makeTools(); player.userData.arms[1].add(tools.axe, tools.spear);
const backAxe = new THREE.Group(), backSpear = new THREE.Group();
backAxe.position.set(0.02, 0.28, -0.2); backAxe.rotation.set(0.1, 0, 2.45); backAxe.visible = false;
backSpear.position.set(-0.04, 0.2, -0.24); backSpear.rotation.set(0.05, 0, -0.5); backSpear.visible = false;
// Hero model (static FBX, no rig): replaces the procedural body once loaded and gets procedural animation.
const hero = { wrap: new THREE.Group(), model: null, rig: null };
player.add(hero.wrap);
// ---- Auto-rig: the FBX is a static T-pose mesh, so build a skeleton and skin weights in code ----
// Model space: feet at y=0, height 1.95, facing +z. Right side of the character is -x.
function autoRig(obj, wrap = hero.wrap) {
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
  const root = new THREE.Group(); root.add(B.hips); wrap.add(root);
  const skinned = [];
  meshes.forEach((m, k) => {
    const g = geos[k], a = g.attributes.position, si = [], sw = [];
    for (let i = 0; i < a.count; i++) { const [b1, b2, w] = weigh(a.getX(i), a.getY(i)); si.push(idx(b1), idx(b2), 0, 0); sw.push(w, 1 - w, 0, 0); }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    const sk = new THREE.SkinnedMesh(g, m.material); sk.castShadow = sk.receiveShadow = true; sk.frustumCulled = false;
    wrap.add(sk); skinned.push(sk);
  });
  wrap.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  skinned.forEach((sk) => sk.bind(skeleton));
  return { bones: B, handOffset: new THREE.Vector3(-(X - ex) + 0.06, 0, 0) };
}

// ---- Mixamo run clip retargeted onto the auto-rig ----
// The clip plays on its own (invisible) Mixamo skeleton; each frame we take every mapped bone's rotation
// relative to its T-pose rest (in model space) and apply that delta to our bone, which is also in T-pose at rest.
const RUN_MAP = { hips: 'Hips', spine: 'Spine1', head: 'Head', armL: 'LeftArm', foreL: 'LeftForeArm', armR: 'RightArm', foreR: 'RightForeArm',
  thighL: 'LeftUpLeg', shinL: 'LeftLeg', thighR: 'RightUpLeg', shinR: 'RightLeg' };
const _q = new THREE.Quaternion();
function modelQuat(clipObj, obj, out) { obj.getWorldQuaternion(out); return out.premultiply(clipObj.rootInv); }
// Load a Mixamo clip (animation-only FBX) onto its own hidden skeleton, ready to retarget
function loadClip(name) {
  const C = { ready: false, mixer: null, root: null, src: {}, rest: {}, rootInv: new THREE.Quaternion() };
  loadModelBuffer(name).then((buf) => new FBXLoader().parse(buf, '')).then((obj) => {
    const clip = obj.animations[0]; if (!clip) throw new Error(`no animation in ${name}.fbx`);
    for (const t of clip.tracks) if (/Hips\.position/.test(t.name)) {          // keep it in place: we move the player ourselves
      const v = t.values, x0 = v[0], z0 = v[2], n = v.length; C.rootSpeed = Math.hypot(v[n - 3] - x0, v[n - 1] - z0) / clip.duration;   // cm/s of root motion, if the clip has any
      for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
    }
    obj.updateMatrixWorld(true); obj.getWorldQuaternion(C.rootInv).invert();
    obj.traverse((o) => { for (const [mine, mx] of Object.entries(RUN_MAP)) if (o.name === 'mixamorig' + mx || o.name.endsWith(':' + mx) || o.name === mx) C.src[mine] = o; });
    for (const [k, o] of Object.entries(C.src)) C.rest[k] = modelQuat(C, o, new THREE.Quaternion()).invert();
    C.mixer = new THREE.AnimationMixer(obj); C.action = C.mixer.clipAction(clip); C.action.play(); C.dur = clip.duration; C.root = obj;
    C.ready = Object.keys(C.src).length >= 9;
    if (!C.ready) console.warn(`${name}.fbx: bones not matched`, Object.keys(C.src));
  }).catch((e) => console.warn(`${name} animation failed to load`, e));
  return C;
}
const RUN = loadClip('run');        // Slow Run: normal movement
const SPRINT = loadClip('sprint');  // Running: hold Shift
const JUMP = loadClip('jump'), ATTACK = loadClip('attack'), PUNCH = loadClip('punch'), EQUIP = loadClip('equip'), DISARM = loadClip('disarm');   // one-shots, scrubbed by game time
const LOWER = ['hips', 'thighL', 'shinL', 'thighR', 'shinR'];
// Pose a one-shot clip at a normalised time t (0..1) and blend it in; `skip` lists bones to leave alone
function applyClipAt(C, t, w, skip = []) {
  if (!C.ready || w <= 0.001) return;
  C.action.time = clamp(t, 0, 0.999) * C.dur; C.mixer.update(0);
  applyRun(C, 0, 0, w, false, skip);
}

// Blend the retargeted run into the current (procedural) pose by weight w; skip the right arm while attacking
function applyRun(C, dt, rate, w, attacking, skipList = []) {
  C.mixer.update(dt * rate);
  C.root.updateMatrixWorld(true);
  const B = hero.rig.bones, order = ['hips', 'spine', 'head', 'armL', 'foreL', 'armR', 'foreR', 'thighL', 'shinL', 'thighR', 'shinR'];
  const parentOf = { hips: null, spine: 'hips', head: 'spine', armL: 'spine', foreL: 'armL', armR: 'spine', foreR: 'armR', thighL: 'hips', shinL: 'thighL', thighR: 'hips', shinR: 'thighR' };
  const world = {};                                        // resulting model-space rotations of our bones
  for (const k of order) {
    const par = parentOf[k] ? world[parentOf[k]] : new THREE.Quaternion();
    const src = C.src[k];
    const skip = skipList.includes(k) || (attacking && (k === 'armR' || k === 'foreR' || k === 'spine' || k === 'armL' || k === 'foreL' || k === 'head'));
    if (src && !skip) {
      const want = modelQuat(C, src, _q).multiply(C.rest[k]);             // delta from T-pose, model space
      const local = par.clone().invert().multiply(want);
      B[k].quaternion.slerp(local, w);
    }
    world[k] = par.clone().multiply(B[k].quaternion);
  }
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
  if (S.slot === 3 && S.tools.bow && sw <= 0) {          // archer stance: bow arm out front, draw hand at the cheek
    const pull = P.drawT > 0 ? P.drawT / 0.35 : 1;
    B.armL.rotation.set(-1.45, 0, -0.15); B.foreL.rotation.set(0, 0, 0);
    B.armR.rotation.set(-1.35, 0, 0.4 * pull + 0.1); B.foreR.rotation.set(0, 1.2 * pull + 0.4, 0);
    B.spine.rotation.set(0.05, -0.35, 0);
  }
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
}
// Olive branch for Athena's offering, on the Olive Terraces
const oliveBranch = () => { const g = new THREE.Group(); const st = mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.9, 5), trunkMat, 0, 0.06, 0, g); st.rotation.z = Math.PI / 2;
  const lm = flat(0x7d9a4a), om = flat(0x3d4a26); for (let i = 0; i < 12; i++) { const l = mesh(new THREE.SphereGeometry(0.07, 5, 3), lm, rr(-0.4, 0.4), rr(0.08, 0.16), rr(-0.08, 0.08), g); l.scale.set(1, 0.3, 2.4); l.rotation.y = rr(-1, 1); }
  for (let i = 0; i < 5; i++) mesh(new THREE.SphereGeometry(0.04, 6, 4), om, rr(-0.3, 0.3), 0.12, rr(-0.06, 0.06), g);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffe0a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(1.6); glow.position.y = 0.3; g.add(glow); return g; };
// The Sacred Olive: an ancient, colossal olive at the heart of the terraces, ringed with stones, lamps and offerings.
// The quest branch is cut from it.
const SACRED_OLIVE = OLIVE.clone(); SACRED_OLIVE.y = heightAt(OLIVE.x, OLIVE.z);
const sacredMotes = [];
{
  const g = new THREE.Group(); g.position.copy(SACRED_OLIVE); scene.add(g);
  const P = [], cs = CARD_PARTS.length;
  // an ancient olive: three trunks twist around one another as they rise, each splitting into gnarled limbs
  const bark = 0x7d6f5e, H = 2.4;
  addRoots(P, 1.0, 10, bark);
  for (let k = 0; k < 3; k++) {
    const ph = k * 2.094 + 0.3; let prev = null;
    for (let i = 0; i <= 18; i++) { const t = i / 18, a = ph + t * 2.2, rad = lerp(0.5, 0.42, t) + Math.sin(t * 9 + k) * 0.04;
      const q = new THREE.Vector3(Math.cos(a) * rad * (1 + t * 0.35), -0.2 + t * H, Math.sin(a) * rad * (1 + t * 0.35)), r = lerp(0.47, 0.34, t) * (1 + Math.sin(t * 13 + k * 2) * 0.05);
      if (prev) P.push([segGeo(prev.q, q, prev.r, r, 12), bark]);
      if (i % 6 === 3) { const bu = new THREE.IcosahedronGeometry(r * 0.55, 1); bu.scale(1, 1.4, 1); bu.translate(q.x + Math.cos(a + 1) * r * 0.75, q.y, q.z + Math.sin(a + 1) * r * 0.75); P.push([bu, 0x6e6252]); }   // burls
      prev = { q, r }; }
    const out = new THREE.Vector3(prev.q.x, 0, prev.q.z).normalize();
    growTree(P, { start: prev.q, dir: new THREE.Vector3(out.x * 0.9, 1, out.z * 0.9), bark, leaf: 0xc4d19c, trunkH: 1.5, trunkR: 0.33, trunkSteps: 3, depth: 3, taper: 0.62, gnarl: 0.42, rise: 0.02, knot: 1.25,
      kids: (d) => (d === 3 ? 3 : 2), spread: (d) => (d === 3 ? 0.95 : d === 2 ? 0.75 : 0.55), lenF: 0.82, rF: 0.62, clusterR: 1.1, flat: 0.6, cards: 15, card0: 0.8, card1: 1.25, core: 0.4 });
  }
  const cards = CARD_PARTS.splice(cs);
  // bark: one continuous material (no per-segment tint), with vertical fissures and ridges shaded in the shader
  const barkParts = P.filter(([, c]) => c === bark || c === 0x6e6252).map(([geo]) => { const q = geo.clone(); for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k); if (!q.attributes.normal) q.computeVertexNormals(); return q; });
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x8a7b68, roughness: 0.95 });
  barkMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBP;').replace('#include <color_fragment>', `#include <color_fragment>
      float ang = atan(vBP.z, vBP.x), f = fract(ang * 2.4 + sin(vBP.y * 1.7 + ang * 3.0) * 0.35 + vBP.y * 0.12);
      float fis = smoothstep(0.42, 0.5, abs(f - 0.5)), grain = fract(sin(dot(floor(vBP * 9.0), vec3(12.9, 78.2, 37.7))) * 43758.5);
      diffuseColor.rgb *= mix(1.05, 0.55, fis) * (0.92 + grain * 0.12);`);
  };
  const tree = new THREE.Mesh(mergeGeometries(barkParts), barkMat); tree.castShadow = tree.receiveShadow = true;
  const coreParts = P.filter(([, c]) => !(c === bark || c === 0x6e6252));
  if (coreParts.length) { const cm = new THREE.Mesh(mergeParts(coreParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })); cm.castShadow = true; tree.add(cm); }
  const leaves = new THREE.Mesh(mergeCards(cards), new THREE.MeshStandardMaterial({ map: leafTex, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, emissive: 0x6a5a18, emissiveIntensity: 0.35 })); leaves.castShadow = true;
  const T = new THREE.Group(); T.scale.setScalar(3.4); T.add(tree, leaves); g.add(T);
  // a ring of standing stones with a gap facing the path, a low altar with oil lamps, votive jars
  const st = new THREE.MeshStandardMaterial({ color: 0xa69d8a, roughness: 1, flatShading: true }), lampM = new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffa040, emissiveIntensity: 1.6 });
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; if (Math.abs(Math.sin(a) - 1) < 0.25) continue; const sh = rr(1.1, 1.9), sg = new THREE.DodecahedronGeometry(0.5, 0); sg.scale(0.9, sh, 0.7); const b = mesh(sg, st, Math.cos(a) * 15, sh * 0.35, Math.sin(a) * 15, g); b.rotation.set(rr(-0.08, 0.08), -a, rr(-0.08, 0.08)); }
  mesh(new THREE.BoxGeometry(2.2, 0.8, 1), st, 0, 0.4, 7.5, g); mesh(new THREE.BoxGeometry(2.5, 0.12, 1.25), st, 0, 0.86, 7.5, g);
  for (const x of [-0.8, 0, 0.8]) { mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 8), st, x, 0.98, 7.5, g); const fl = mesh(new THREE.SphereGeometry(0.06, 6, 4), lampM, x, 1.1, 7.5, g); fl.userData.keep = true; }
  for (let i = 0; i < 6; i++) { const a = rr(0, 6.28), r = rr(3.2, 4.5); mesh(new THREE.LatheGeometry([[0.001, 0], [0.14, 0.03], [0.22, 0.25], [0.12, 0.45], [0.09, 0.52]].map(([x, y]) => new THREE.Vector2(x, y)), 10), flat(0xb2663a), Math.cos(a) * r, 0, Math.sin(a) * r, g); }
  const L = new THREE.PointLight(0xffd890, 18, 14, 1.6); L.position.set(0, 1.6, 7.5); g.add(L);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff0b0, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(36); halo.position.y = 12; g.add(halo);
  // golden motes drifting in the crown
  const N = 70, mg = new THREE.BufferGeometry(), ma = new Float32Array(N * 3); for (let i = 0; i < N; i++) sacredMotes.push([rand() * 6.28, rr(3, 12), rr(5, 16), rand()]);
  mg.setAttribute('position', new THREE.BufferAttribute(ma, 3)); const motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xffe08a, size: 0.14, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); motes.frustumCulled = false; g.add(motes); sacredMotes.pts = motes;
  colliders.push({ x: OLIVE.x, z: OLIVE.z, r: 3.4 });
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; if (Math.abs(Math.sin(a) - 1) < 0.25) continue; colliders.push({ x: OLIVE.x + Math.cos(a) * 15, z: OLIVE.z + Math.sin(a) * 15, r: 0.55, h: 1.0 }); }
  const bp = OLIVE.clone().add(new THREE.Vector3(2.2, 0, 4.4)); bp.y = heightAt(bp.x, bp.z) + 0.1; addPickup('olivebranch', bp, oliveBranch);
}
loadModelBuffer('axe').then((buf) => new FBXLoader().parse(buf, '')).then((obj) => {
  fixMaterials(obj);
  const held = normalizeHandle(obj, 0.85);
  held.position.y = -0.18;                                    // grip a little above the handle end
  tools.axe.clear(); tools.axe.add(held); backAxe.clear(); const onBack = held.clone(); onBack.position.set(0, -0.3, 0); backAxe.add(onBack);
  const ground = held.clone(); ground.position.set(0, 0, 0); ground.rotation.set(0, 0.6, Math.PI / 2);
  ground.position.x = 0.4; groundAxe.add(ground);
}).catch((e) => { console.warn('Axe model failed to load, using placeholder', e); const g = tools.axe.clone(); g.visible = true; g.rotation.set(0, 0, Math.PI / 2); groundAxe.add(g); });

// Load a textured FBX (geometry from the FBX, colour from a compact JPG), normalised to a given height
var texLoader;   // hoisted: created on first use (props load from anywhere in world setup)
function loadTexturedFBX(name, height, cb) {
  const tex = (texLoader ||= new THREE.TextureLoader()).load(`models/${name}.jpg`); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  loadModelBuffer(name).then((buf) => new FBXLoader().parse(buf, '')).then((obj) => {
    obj.traverse((m) => { if (m.isMesh) { m.material = mat; m.castShadow = true; m.receiveShadow = true; } });
    if (height) {
      const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()); obj.scale.multiplyScalar(height / size.y);
      const b2 = new THREE.Box3().setFromObject(obj), c = b2.getCenter(new THREE.Vector3()); obj.position.set(-c.x, -b2.min.y, -c.z);
    }
    cb(obj);
  }).catch((e) => console.warn(`${name} failed to load`, e));
}
// Arms-down idle for any auto-rigged NPC (breathing, slight sway, head turns)
function poseIdleRig(rig, t, look = 0) {
  const B = rig.bones, br = Math.sin(t * 1.6) * 0.025;
  B.armL.rotation.set(0.05, 0, -1.28 + br); B.armR.rotation.set(0.05, 0, 1.28 - br);
  B.foreL.rotation.set(0, -0.3, 0); B.foreR.rotation.set(0, 0.3, 0);
  B.spine.rotation.set(0.04 + br, Math.sin(t * 0.4) * 0.04, 0); B.head.rotation.set(-0.05, look + Math.sin(t * 0.7) * 0.1, 0);
  B.thighL.rotation.x = B.thighR.rotation.x = 0; B.shinL.rotation.x = B.shinR.rotation.x = 0;
}

// Try the raw .fbx first (local server); fall back to the base64 module (artifact hosting can't serve .fbx).
async function loadModelBuffer(name) {
  try { const r = await fetch(`models/${name}.fbx`); if (r.ok) return await r.arrayBuffer(); } catch { /* fall through */ }
  const b64 = (await import(`./models/${name}.fbx.js`)).default;
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}
const loadStaticHero = () => loadModelBuffer('hero').then((buf) => new FBXLoader().parse(buf, '')).then((obj) => {
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
  hero.rig.bones.foreL.add(bowHeld); bowHeld.position.copy(hero.rig.handOffset).multiply(new THREE.Vector3(-1, 1, 1)); bowHeld.rotation.set(0, 0, 1.25, 'ZYX');
  for (const t of [tools.axe, tools.spear]) { rf.add(t); t.position.copy(hero.rig.handOffset); t.rotation.set(0.7, 0, -1.25, 'ZYX'); }   // undo the arm's T-pose drop so the tool points forward-up
  hero.rig.bones.spine.add(backAxe, backSpear);                  // stowed: axe slung diagonally across the back, spear behind it
}).catch((e) => console.warn('Hero model failed to load, keeping placeholder', e));

// ---- Native Mixamo hero ----
// hero_rig.fbx is the hero auto-rigged by Mixamo, so the Mixamo clips play on its own skeleton: no retargeting.
// Base layer (idle / run / sprint) runs on an AnimationMixer with speed-matched playback.
// One-shots (jump, strike, punch, draw, sheathe) are sampled straight from their tracks and blended over it,
// full body when standing, upper body only while moving.
const HA = { mixer: null, root: null, bones: {}, acts: {}, samplers: {}, s: 1, t: 0 };
const UPPER = /Spine|Neck|Head|Shoulder|Arm|Hand/;
const _hq = new THREE.Quaternion();
function heroAct(key, C, idleAt) {
  if (HA.acts[key] || !C.ready) return HA.acts[key];
  const a = HA.mixer.clipAction(C.action.getClip().clone());
  if (idleAt !== undefined) { a.time = C.dur * idleAt; a.paused = true; }   // a held frame used as the idle pose
  a.setEffectiveWeight(0); a.play(); return (HA.acts[key] = a);
}
// Quaternion samplers for every bone in a one-shot clip, built once
function heroSampler(C) {
  if (!C.ready) return null;
  let S_ = HA.samplers[C.dur + ':' + C.action.getClip().uuid]; if (S_) return S_;
  S_ = [];
  for (const tr of C.action.getClip().tracks) {
    if (!tr.name.endsWith('.quaternion')) continue;
    const bone = HA.bones[tr.name.slice(0, -11)]; if (!bone) continue;
    S_.push({ bone, upper: UPPER.test(bone.name), interp: tr.createInterpolant() });
  }
  return (HA.samplers[C.dur + ':' + C.action.getClip().uuid] = S_);
}
// Blend clip C at normalised time t (0..1) over the current pose with weight w
function heroOverlay(C, t, w, upperOnly) {
  const S_ = heroSampler(C); if (!S_ || w <= 0.001) return;
  const time = clamp(t, 0, 0.999) * C.dur;
  for (const s of S_) { if (upperOnly && !s.upper) continue; const v = s.interp.evaluate(time); _hq.fromArray(v); s.bone.quaternion.slerp(_hq, w); }
}
loadModelBuffer('hero_rig').then((buf) => new FBXLoader().parse(buf, '')).then((obj) => {
  const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  HA.s = 1.95 / size.y; obj.scale.setScalar(HA.s);
  const tl = new THREE.TextureLoader(), map = tl.load('models/hero_diffuse.jpg'), nrm = tl.load('models/hero_normal.jpg');
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  obj.traverse((m) => {
    if (m.isBone) HA.bones[m.name] = m;
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;   // skinned bounds don't follow the pose
    m.material = new THREE.MeshStandardMaterial({ map, normalMap: nrm, roughness: 0.8, metalness: 0 });
  });
  obj.animations = [];
  hero.wrap.add(obj); hero.model = obj; hero.native = true;
  HA.mixer = new THREE.AnimationMixer(obj); HA.root = obj;
  player.userData.body.visible = false;
  // Tools in the right palm; stowed tools on the upper back. Bones are in cm, so undo the model scale.
  const hand = HA.bones.mixamorigRightHand, back = HA.bones.mixamorigSpine2, inv = 1 / HA.s;
  for (const t of [tools.axe, tools.spear]) { hand.add(t); t.scale.setScalar(inv); t.position.set(0, 9, 3); t.rotation.set(0, 0, -1.4); }   // handle across the palm, head out past the thumb
  hand.add(bowHeld); bowHeld.scale.setScalar(inv);
  for (const g of [backAxe, backSpear]) { back.add(g); g.scale.setScalar(inv); }
  backAxe.position.set(2, 8, -16); backSpear.position.set(-4, 4, -18);
}).catch((e) => { console.warn('Rigged hero failed to load, using the static model', e); loadStaticHero(); });

// Drive the hero every frame. speed in m/s.
function animateHero(dt, speed) {
  if (!HA.mixer) return;
  const idle = heroAct('idle', DISARM, 0.97), run = heroAct('run', RUN), sprint = heroAct('sprint', SPRINT);
  const moveW = clamp(speed / 2.2, 0, 1);
  P.sprintW = lerp(P.sprintW || 0, P.sprinting && sprint ? 1 : 0, Math.min(1, dt * 6));
  // Play rate follows ground speed so feet don't skate (clip root speed if it has one, else a measured stride)
  const runV = RUN.rootSpeed > 50 ? RUN.rootSpeed * HA.s : 3.9, sprV = SPRINT.rootSpeed > 50 ? SPRINT.rootSpeed * HA.s : 7.2;
  if (run) { run.setEffectiveWeight(moveW * (1 - P.sprintW)); run.timeScale = clamp(speed / runV, 0.55, 1.5); }
  if (sprint) {
    sprint.setEffectiveWeight(moveW * P.sprintW); sprint.timeScale = clamp(speed / sprV, 0.7, 1.4);
    if (run) sprint.time = (run.time / RUN.dur) * SPRINT.dur;        // keep both gaits on the same foot
  }
  if (idle) idle.setEffectiveWeight(Math.max(1 - moveW, run ? 0 : 1));
  HA.mixer.update(dt);
  // The mixer only writes a bone when its clip value changed since last frame. The idle is a held frame, so without this
  // the breathing and one-shot overlays below would pile up frame after frame (the hero slowly rocked and then snapped).
  const off = (HA.mixer._accuIndex + 1);
  for (const b of HA.mixer._bindings) b.binding.setValue(b.buffer, off * b.valueSize);
  // Gentle breathing on top of the held idle frame
  HA.t += dt;
  const sp = HA.bones.mixamorigSpine2; if (sp) sp.rotateX(Math.sin(HA.t * 1.9) * 0.02 * (1 - moveW));
  const moving = speed > 0.5;
  // Jump: skip the wind-up crouch, map airtime onto the rise/fall, then a short landing settle
  // Only a real jump or a real fall plays it: a one-frame ground-contact flicker on uneven ground must not twitch the body
  if (!P.onGround) P.airT = (P.airT || 0) + dt; else { if (P.airT > 0.3) P.landT = 0.25; P.airT = 0; P.jumped = false; }
  P.jumpT = P.jumped || P.airT > 0.25 ? P.airT : 0;
  if (P.landT > 0) P.landT -= dt;
  if (P.jumpT > 0) heroOverlay(JUMP, 0.28 + P.jumpT / 0.7 * 0.5, Math.min(1, P.jumpT * 8), false);
  else if (P.landT > 0) heroOverlay(JUMP, 0.8 + (0.25 - P.landT) * 0.6, P.landT / 0.25, false);
  if (P.equip) {
    P.equip.t += dt / 0.9;
    const C = P.equip.kind === 'equip' ? EQUIP : DISARM, w = Math.min(1, Math.sin(Math.min(P.equip.t, 1) * Math.PI) * 2.5);
    heroOverlay(C, P.equip.t, w, moving);
    if (P.equip.t >= 1) P.equip = null;
  }
  const AC = S.slot === 0 ? PUNCH : ATTACK;
  if (P.swing > 0) heroOverlay(AC, 1 - P.swing, Math.min(1, P.swing * 6, (1 - P.swing) * 8 + 0.2), moving || !P.onGround);
}
const P = { vel: new THREE.Vector3(), yaw: Math.PI, onGround: true, swing: 0, swingHit: false, hurtT: 0, animT: 0, dead: false };

// NPC Nestor the hermit (the Elder from the cast sheet)
const nestor = makeHumanoid({ tunic: 0xe9e0cc, belt: 0x6b4a2e, hair: 0xe8e4dc, beard: 0xefebe4, cape: 0x8a3b2b, headScale: 1.05 });
const staff = mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.1, 6), trunkMat, 0, -0.1, 0.1, nestor.userData.arms[0]);
// Nestor: the user's elder model replaces the placeholder once loaded (auto-rigged for an idle pose)
const nestorWrap = new THREE.Group(); nestor.add(nestorWrap);
loadTexturedFBX('elder', 1.85, (obj) => {
  obj.updateMatrixWorld(true);
  nestor.userData.rig = autoRig(obj, nestorWrap); nestor.userData.body.visible = false;
});
staff.rotation.x = 0.1;
const NESTOR_POS = hutW(0.6, 6.4); NESTOR_POS.y = heightAt(NESTOR_POS.x, NESTOR_POS.z);
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
  const bone = new THREE.MeshStandardMaterial({ color: 0xd9c6a2, roughness: 0.75, flatShading: true }), dark = new THREE.MeshBasicMaterial({ color: 0x1a0f08 });
  const ch = makeHumanoid({ tunic: 0x6b4a2e, belt: 0x5a3a22, skin: bone, bald: true });
  const { torso, head, body, arms, legs } = ch.userData; torso.visible = false;
  body.children.forEach((c) => { if (c.geometry?.type === 'CylinderGeometry' && c.position.y < 1) c.visible = false; });   // hide the old skirt
  // spine + ribcage + sternum + pelvis
  for (let i = 0; i < 9; i++) mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.07, 6), bone, 0, 0.95 + i * 0.085, -0.05, body);
  for (let i = 0; i < 5; i++) { const r = mesh(new THREE.TorusGeometry(0.2 - i * 0.012, 0.025, 4, 12, Math.PI * 1.6), bone, 0, 1.52 - i * 0.09, 0, body); r.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI * 0.7); r.scale.set(1, 0.75, 1); }
  mesh(new THREE.BoxGeometry(0.06, 0.32, 0.04), bone, 0, 1.38, 0.15, body);
  for (const sx of [-1, 1]) { const c = mesh(new THREE.CapsuleGeometry(0.035, 0.26, 2, 5), bone, sx * 0.17, 1.62, 0.02, body); c.rotation.z = Math.PI / 2; }   // collarbones
  mesh(new THREE.TorusGeometry(0.15, 0.05, 4, 8), bone, 0, 0.9, 0, body).rotation.x = Math.PI / 2;
  // belt with studs + gold boss, tattered skirt
  mesh(new THREE.TorusGeometry(0.2, 0.035, 4, 16), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8 }), 0, 0.93, 0, body).rotation.x = Math.PI / 2;
  mesh(new THREE.DodecahedronGeometry(0.055, 0), new THREE.MeshStandardMaterial({ color: 0xc9a13a, metalness: 0.7, roughness: 0.35 }), 0, 0.93, 0.2, body);
  const skirtG = new THREE.CylinderGeometry(0.21, 0.3, 0.42, 14, 1, true), sa = skirtG.attributes.position;
  for (let i = 0; i < sa.count; i++) if (sa.getY(i) < 0) sa.setY(i, sa.getY(i) - (i % 2 ? 0.14 : 0) - hash(i, 3) * 0.08);   // jagged hem
  skirtG.computeVertexNormals(); mesh(skirtG, new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9, side: THREE.DoubleSide, flatShading: true }), 0, 0.73, 0, body);
  // thin limbs with knobbly joints
  for (const L of [...arms, ...legs]) L.children.forEach((c) => { if (c.geometry?.type === 'CapsuleGeometry') c.scale.set(0.5, 1, 0.5); });
  for (const L of legs) mesh(new THREE.SphereGeometry(0.075, 6, 5), bone, 0, -0.36, 0.01, L);
  // skull: sockets, nasal hole, jaw with teeth
  head.children.forEach((c) => { if (c.geometry?.type === 'TorusGeometry' || (c.geometry?.type === 'BoxGeometry' && c.position.y > 0.1) || (c.geometry?.type === 'SphereGeometry' && Math.abs(c.position.x) > 0.25)) c.visible = false; });
  head.scale.set(0.78, 0.86, 0.82);
  head.children.forEach((c) => { if (c.geometry?.type === 'SphereGeometry' && Math.abs(c.position.x) < 0.01 && c.position.z > 0.25) c.visible = false;               // no nose ball
    if (c.material === dark || c.material?.isMeshBasicMaterial) { c.scale.set(1.1, 0.8, 0.6); c.rotation.z = c.position.x > 0 ? -0.35 : 0.35; } });                  // angled, menacing sockets
  for (const L of legs) L.children.forEach((c) => { if (c.geometry?.type === 'CapsuleGeometry' && c.position.y < -0.6) { c.material = bone; c.scale.set(0.6, 1, 0.8); } });   // bony feet
  mesh(new THREE.ConeGeometry(0.035, 0.07, 3), dark, 0, -0.03, 0.29, head).rotation.x = Math.PI;
  mesh(new THREE.BoxGeometry(0.2, 0.08, 0.16), bone, 0, -0.2, 0.12, head);
  mesh(new THREE.BoxGeometry(0.17, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: 0xf0e6d0 }), 0, -0.15, 0.2, head);
  // Hollow eyes: dark spheres over the eye whites
  head.children.filter((c) => c.geometry?.type === 'SphereGeometry' && c.position.z > 0.2 && Math.abs(c.position.x) > 0.05).forEach((e) => { e.material = new THREE.MeshBasicMaterial({ color: 0x100806 }); e.children.forEach((k) => (k.visible = false)); });
  const sword = new THREE.Group(); mesh(new THREE.BoxGeometry(0.06, 0.9, 0.12), smooth(0x9aa3a8, 0.3), 0, 0.5, 0, sword);
  sword.rotation.x = Math.PI / 2; sword.position.set(0, -0.62, 0.1); ch.userData.arms[1].add(sword);
  return ch;
}

buildProps();
const creatures = [];
const TYPES = {
  rabbit: { hp: 10, speed: 5.5, dmg: 0, flee: true, drops: { rawmeat: 1 }, r: 0.4, reach: 0 },
  boar: { hp: 45, speed: 5, dmg: 12, flee: false, retaliate: true, drops: { rawmeat: 2, hide: 1 }, r: 0.8, reach: 1.8 },
  wolf: { hp: 35, speed: 6.2, dmg: 9, hostile: true, drops: { hide: 1, rawmeat: 1 }, r: 0.7, reach: 1.8 },
  skeleton: { hp: 55, speed: 3.4, dmg: 12, hostile: true, drops: {}, r: 0.5, reach: 1.9, aggro: 13 },
  deer: { hp: 30, speed: 7.5, dmg: 0, flee: true, drops: { rawmeat: 2, hide: 1 }, r: 0.6, reach: 0 },
  stag: { hp: 60, speed: 6.8, dmg: 14, flee: false, retaliate: true, drops: { rawmeat: 3, hide: 2 }, r: 0.75, reach: 2.1 },
  fox: { hp: 14, speed: 7, dmg: 0, flee: true, drops: { hide: 1 }, r: 0.4, reach: 0 },
  // Nestor's farm animals: they graze inside the courtyard and can't be hurt
  donkey: { hp: 1, speed: 1.4, dmg: 0, passive: true, drops: {}, r: 0.8, reach: 0, roam: 3 },
  cow: { hp: 1, speed: 1.2, dmg: 0, passive: true, drops: {}, r: 0.9, reach: 0, roam: 3 },
  horse: { hp: 1, speed: 1.6, dmg: 0, passive: true, drops: {}, r: 0.9, reach: 0, roam: 3 },
  alpaca: { hp: 1, speed: 1.3, dmg: 0, passive: true, drops: {}, r: 0.7, reach: 0, roam: 3 },
  shibainu: { hp: 1, speed: 2.2, dmg: 0, passive: true, drops: {}, r: 0.4, reach: 0, roam: 1.5 },          // Nestor's dog
  horse_white: { hp: 1, speed: 1.4, dmg: 0, passive: true, drops: {}, r: 0.9, reach: 0, roam: 8 },     // Athena's sacred mare
  bull: { hp: 90, speed: 6, dmg: 18, flee: false, retaliate: true, drops: { rawmeat: 4, hide: 2 }, r: 1.0, reach: 2.4 },   // wild bulls of the plain
  // A stray husky in the woods: walk up to it and it joins you, follows you around and goes for wolves and boars that come close
  husky: { hp: 1, speed: 7.5, dmg: 0, passive: true, companion: true, drops: {}, r: 0.5, reach: 1.6, roam: 6 },
};
// ---- Animated animal models (the uploaded low-poly pack: ~2k triangles, rigged, with Idle/Walk/Gallop/Attack/Hit/Death/Eating).
// One template per species is loaded lazily; each creature gets a skeleton clone and its own mixer.
// len: nose-to-tail length in metres the model is scaled to.
const ANIMALS = { wolf: { file: 'wolf', len: 1.45 }, deer: { file: 'deer', len: 1.6 }, stag: { file: 'stag', len: 1.9 }, fox: { file: 'fox', len: 0.95 },
  donkey: { file: 'donkey', len: 1.7 }, cow: { file: 'cow', len: 2.2 }, horse: { file: 'horse', len: 2.3 },
  alpaca: { file: 'alpaca', len: 1.5 }, shibainu: { file: 'shibainu', len: 0.85 }, horse_white: { file: 'horse_white', len: 2.3 }, bull: { file: 'bull', len: 2.4 }, husky: { file: 'husky', len: 1.15 } };
const ANIM_TPL = {};
async function loadGlb(name) {
  try { const r = await fetch(`models/${name}.glb`); if (r.ok) return await r.arrayBuffer(); } catch { /* fall through */ }
  const b64 = (await import(`./models/${name}.glb.js`)).default;
  return Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)).buffer;
}
function animalTemplate(type) {
  const A = ANIMALS[type];
  return (ANIM_TPL[type] ||= loadGlb(A.file).then((buf) => new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej))).then((gl) => {
    const root = gl.scene; root.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    root.scale.multiplyScalar(A.len / Math.max(size.x, size.z));
    root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
    const clips = {}; for (const c of gl.animations) clips[c.name.replace('Attack_Headbutt', 'Attack')] = c;
    return { root, clips };
  }));
}
// Give creature c its animated body once the template is in
function attachAnimal(c) {
  animalTemplate(c.type).then((T) => {
    if (c.gone) return;
    const m = cloneSkinned(T.root);
    m.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map((mt) => mt.clone()) : o.material.clone(); });   // own materials for the hit flash
    c.obj.clear(); c.obj.add(m);
    c.mixer = new THREE.AnimationMixer(m); c.acts = {};
    for (const [k, clip] of Object.entries(T.clips)) c.acts[k] = c.mixer.clipAction(clip);
    for (const k of ['Death', 'Attack', 'Idle_HitReact1']) if (c.acts[k]) { c.acts[k].setLoop(THREE.LoopOnce); c.acts[k].clampWhenFinished = true; }
    c.cur = null; c.mixer.update(rr(0, 2));
  }).catch((e) => console.warn(`${c.type} model failed, keeping the placeholder`, e));
}
// Pick and crossfade the animal's clip from its state
function animateAnimal(c, speed, dt) {
  if (!c.mixer) return false;
  let want = 'Idle', rate = 1;
  if (c.dead) want = 'Death';
  else if (c.lunge > 0) want = 'Attack';
  else if (c.flash > 0 && c.acts.Idle_HitReact1) want = 'Idle_HitReact1';
  else if (speed > c.def.speed * 0.55) { want = 'Gallop'; rate = clamp(speed / (c.def.speed * 0.85), 0.7, 1.4); }
  else if (speed > 0) { want = 'Walk'; rate = clamp(speed / (c.def.speed * 0.3), 0.6, 1.6); }
  else if (c.idle && !c.def.hostile && (c.t % 6) > 3) want = 'Eating';
  if (want === 'Idle_HitReact1' && c.cur === 'Attack') want = 'Attack';
  const a = c.acts[want] || c.acts.Idle;
  if (c.cur !== want) {
    const prev = c.acts[c.cur]; a.reset().setEffectiveWeight(1).fadeIn(0.18).play(); if (prev) prev.fadeOut(0.18);
    c.cur = want;
  }
  a.timeScale = rate; c.mixer.update(dt); return true;
}
function spawnCreature(type, pos) {
  let obj;
  if (type === 'skeleton') obj = makeSkeleton();
  else obj = new THREE.Group();                                    // model-only animals: empty until the model streams in
  obj.position.copy(pos); scene.add(obj);
  const c = { type, obj, def: TYPES[type], hp: TYPES[type].hp, state: 'wander', target: pos.clone(), t: rr(0, 5), atkCd: 0, flash: 0, dead: false, home: pos.clone(), vy: 0 };
  obj.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); } });
  if (ANIMALS[type]) attachAnimal(c);
  creatures.push(c); return c;
}
// Wildlife: every animal is a real animated model (the old block rabbits and boars are gone).
// Deer are the easy game, stags and bulls fight back, foxes are skittish and give hides.
for (let i = 0; i < 16; i++) { const p = landSpot(2, 40, AVOID); if (p) spawnCreature('deer', p); }
for (let i = 0; i < 7; i++) { const p = landSpot(4, 45, AVOID); if (p) spawnCreature('stag', p); }
for (let i = 0; i < 8; i++) { const p = landSpot(2, 35, AVOID); if (p) spawnCreature('fox', p); }
// A small herd of wild bulls on the open plain
{ const p0 = landSpot(3, 20, AVOID); if (p0) for (let i = 0; i < 3; i++) { const p = p0.clone().add(new THREE.Vector3(rr(-6, 6), 0, rr(-6, 6))); p.y = heightAt(p.x, p.z); if (p.y > 1) spawnCreature('bull', p); } }
// Athena's white mare grazes on the temple plateau
{ const p = TEMPLE.clone().add(new THREE.Vector3(-14, 0, 10)); p.y = heightAt(p.x, p.z); spawnCreature('horse_white', p); }
// The stray husky waits in the forest
const HUSKY = (() => { for (let k = 0; k < 400; k++) { const p = landSpot(4, 30, AVOID); if (p && regionAt(p.x, p.z).key === 'forest') return spawnCreature('husky', p); } const p = landSpot(4, 30, AVOID); return p && spawnCreature('husky', p); })();
// The Wolf of the Cave: a bronze wolf crouched on a rock at the ravine before the Cave of Echoes (the uploaded sculpt).
// Static and detailed, so it's a monument rather than a creature; it streams in after start-up.
{
  const side = new THREE.Vector3(-CAVE_DIR.z, 0, CAVE_DIR.x), p = CAVE_MOUTH.clone().addScaledVector(CAVE_DIR, -7).addScaledVector(side, 4.2);
  p.y = heightAt(p.x, p.z);
  const g = new THREE.Group(); g.position.copy(p); g.rotation.y = Math.atan2(-CAVE_DIR.x, -CAVE_DIR.z) + 0.5; scene.add(g);   // looks down the ravine at whoever comes
  const plinth = new THREE.Mesh(new THREE.DodecahedronGeometry(1.25, 1), rockMat); plinth.scale.set(1.5, 0.75, 1.9); plinth.position.y = 0.35; plinth.castShadow = plinth.receiveShadow = true; g.add(plinth);
  colliders.push({ x: p.x, z: p.z, r: 2.1, h: 2.2 });
  import('./models/wolfstatue.js').then(({ default: W }) => {
    const geo = new THREE.BufferGeometry(), P = b64arr(W.p, Int16Array), N = b64arr(W.nr, Int8Array), U = b64arr(W.uv, Uint16Array);
    geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(P, (v) => v / 10000), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(N, (v) => v / 127), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(Float32Array.from(U, (v) => v / 65535), 2));
    const map = new THREE.TextureLoader().load('models/wolfstatue.jpg'); map.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, color: 0xb59a74, metalness: 0.55, roughness: 0.45 }));   // weathered bronze over the fur sculpt
    m.scale.setScalar(1.6); m.position.y = 0.95; m.castShadow = m.receiveShadow = true; g.add(m);
  }).catch((e) => console.warn('wolf statue failed', e));
}
// Nestor's livestock in the meadow beside the farmhouse
for (const [type, lx, lz] of [['donkey', -15, 2], ['cow', -19, -2], ['horse', -15.5, -3.5], ['alpaca', -19.5, 2.5]]) { const p = hutW(lx, lz); p.y = heightAt(p.x, p.z); spawnCreature(type, p).pen = true; }
{ const p = hutW(2.6, 6.2); p.y = heightAt(p.x, p.z); spawnCreature('shibainu', p); }   // Nestor's dog dozes by the porch
const skeletons = [];
for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4; const p = new THREE.Vector3(CAVE.x + Math.cos(a) * 5, CAVE_Y, CAVE.z + Math.sin(a) * 5); const sk = spawnCreature('skeleton', p); sk.home.copy(p); skeletons.push(sk); }

// ============================================================
// Game state
// ============================================================
const DAY_LEN = 900;  // seconds per in-game day (15 min: ~10 of daylight)
const S = {
  hp: 100, food: 100, sta: 100, time: 0.3, day: 1, nights: 0, wasNight: false,
  inv: { wood: 0, stone: 0, fiber: 0, berries: 0, rawmeat: 0, meat: 0, hide: 0, rope: 0, sail: 0, arrows: 0 },
  tools: { axe: false, spear: false, bow: false }, slot: 0, energy: 100,
  kills: { rabbit: 0, boar: 0, wolf: 0, skeleton: 0, deer: 0, stag: 0, fox: 0, bull: 0 }, cooked: 0, campfire: null, raftBuilt: false,
  timeScale: 1, running: false, paused: true, talkedNestor: false, sailing: false, questIdx: 0, deaths: 0, nightsAtStart: 0, started: 0,
};
const ICONS = { wood: '🪵', stone: '🪨', fiber: '🌾', berries: '🫐', rawmeat: '🥩', meat: '🍖', hide: '🟫', rope: '🧶', sail: '⛵', arrows: '➶' };
const NAMES = { wood: 'Wood', stone: 'Stone', fiber: 'Fiber', berries: 'Berries', rawmeat: 'Raw Meat', meat: 'Cooked Meat', hide: 'Hide', rope: 'Rope', sail: 'Sailcloth', arrows: 'Arrows' };
const isNight = () => S.time < 0.2 || S.time > 0.845;
// daylight is stretched: sunrise ~05:00, sunset ~20:00; the sky/sun follow this warped clock
const sunClock = (t) => { if (t >= 0.2 && t <= 0.84) return 0.23 + (t - 0.2) / 0.64 * 0.54; const u = t < 0.2 ? t + 1 : t; return (0.77 + (u - 0.84) / 0.36 * 0.46) % 1; };

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
let regionTimer = 0;
function showRegion(R) {
  if (R.key) $('mmLabel').textContent = R.name;
  const el = $('region'); el.innerHTML = `<div class="rname">${R.name}</div><div class="rsub">${R.sub}</div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(regionTimer); regionTimer = setTimeout(() => el.classList.remove('show'), 4200);
}
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
  S.inv[item] += n; if (at) floatText(`+${n} ${ICONS[item]}`, at, '#f5e6b8'); snd.pickup();
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
  $('enB').style.width = S.energy + '%'; $('enN').textContent = Math.ceil(S.energy); $('hpN').textContent = Math.ceil(S.hp); $('staN').textContent = Math.ceil(S.sta); $('foodN').textContent = Math.ceil(S.food);
  const hb = SLOTS.map((s, i) => {
    const locked = s.k !== 'hands' && !S.tools[s.k];
    return `<div class="slot ${S.slot === i ? 'sel' : ''} ${locked ? 'locked' : ''}"><b>${i + 1}</b>${s.ic}<small>${s.n}</small></div>`;
  }).join('') + `<div class="slot"><b>F</b>${S.inv.meat ? '🍖' : '🫐'}<em>${S.inv.meat || S.inv.berries}</em></div>` + ['wood', 'stone', 'fiber', 'rope'].map((k, i) => `<div class="slot"><b>${i + 5}</b>${S.inv[k] ? ICONS[k] : ''}<em>${S.inv[k] || ''}</em></div>`).join('');
  if (hb !== renderHUD.hb) { renderHUD.hb = hb; $('hotbar').innerHTML = hb; }
  const iv = Object.keys(S.inv).filter((k) => S.inv[k] > 0).map((k) => `<span>${ICONS[k]} ${NAMES[k]}</span><b>${S.inv[k]}</b>`).join('') || '<span style="opacity:.6">Empty pouch</span>';
  if (iv !== renderHUD.iv) { renderHUD.iv = iv; $('inv').innerHTML = iv; }
  const hours = Math.floor(S.time * 24), mins = Math.floor((S.time * 24 - hours) * 60);
  $('clock').innerHTML = `<b class="cinzel">Day ${S.day}</b> · ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${isNight() ? '🌙' : '☀️'}${S.timeScale > 1 ? ` <span style="color:#e8c27a">×${S.timeScale}</span>` : ''} <span style="color:var(--dim);font-size:11px">· ${Math.round(FPS.fps)} fps</span>`;
  // Compass bar: cardinal points, ticks and the quest target with distance
  {
    const W = $('compass').clientWidth || 500, head = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw)); // facing angle (atan2(x,z))
    const pos = (ang) => { let d = ang - head; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) < 1.3 ? W / 2 - (d / 1.3) * (W / 2) : null; };
    let html = '';
    const marks = [['S', 0], ['SE', Math.PI / 4], ['E', Math.PI / 2], ['NE', Math.PI * 0.75], ['N', Math.PI], ['NW', -Math.PI * 0.75], ['W', -Math.PI / 2], ['SW', -Math.PI / 4]];
    for (const [l, ang] of marks) { const x = pos(ang); if (x !== null) html += `<span style="left:${x}px;${l.length > 1 ? 'font-size:11px;top:10px;opacity:.7' : ''}">${l}</span>`; }
    for (let k = 0; k < 24; k++) { const x = pos(k / 24 * Math.PI * 2 + Math.PI / 24); if (x !== null) html += `<span class="tick" style="left:${x}px"></span>`; }
    const tgt = Q[S.questIdx]?.target();
    if (tgt) { const x = pos(Math.atan2(tgt.x - player.position.x, tgt.z - player.position.z)); if (x !== null) html += `<span class="goal" style="left:${x}px"><b>◆</b>${Math.round(Math.hypot(tgt.x - player.position.x, tgt.z - player.position.z))} m</span>`; }
    $('compassInner').innerHTML = html;
  }
  $('vignette').style.boxShadow = `inset 0 0 160px rgba(200,20,20,${P.hurtT > 0 ? 0.6 : S.hp < 30 ? 0.35 : 0})`;
}

// ============================================================
// Crafting
// ============================================================
const RECIPES = [
  { id: 'rope', ic: '🧶', name: 'Rope', desc: 'Twisted fiber. Holds a raft together.', cost: { fiber: 3 }, make: () => give('rope', 1) },
  { id: 'axe', bench: true, ic: '🪓', name: 'Stone Axe', desc: 'Fells trees and splits rocks. Made at Nestor\'s workbench.', cost: { wood: 3, stone: 2, fiber: 1 }, once: () => S.tools.axe, make: () => { S.tools.axe = true; S.slot = 1; } },
  { id: 'spear', bench: true, ic: '🔱', name: 'Spear', desc: 'Long reach, heavy damage. For hunting and fights. Made at Nestor\'s workbench.', cost: { wood: 4, stone: 1, fiber: 2 }, once: () => S.tools.spear, make: () => { S.tools.spear = true; S.slot = 2; } },
  { id: 'fire', ic: '🔥', name: 'Campfire', desc: 'Light, warmth, cooking. Wolves keep their distance. Placed in front of you.', cost: { wood: 5, stone: 3 }, make: placeCampfire },
];
const nearBench = () => Math.hypot(player.position.x - BENCH.x, player.position.z - BENCH.z) < 4.5;
const canAfford = (cost) => Object.entries(cost).every(([k, v]) => S.inv[k] >= v);
let craftSel = 'axe';
function renderCraft() {
  $('recipes').innerHTML = RECIPES.map((r) => `<button class="rrow ${r.id === craftSel ? 'on' : ''} ${canAfford(r.cost) ? '' : 'no'}" data-sel="${r.id}"><i>${r.ic}</i>${r.name}</button>`).join('');
  const r = RECIPES.find((x) => x.id === craftSel), owned = r.once && r.once(), away = r.bench && !nearBench();
  const cost = Object.entries(r.cost).map(([k, v]) => `<div class="slot ${S.inv[k] >= v ? '' : 'no'}" title="${NAMES[k]}">${ICONS[k]}<em>${v}</em></div>`).join('');
  $('rdetail').innerHTML = `<h3>${r.name}</h3><div class="big">${r.ic}</div><div class="desc">${r.desc}</div><div class="cost">${cost}</div>
    <button class="btn primary" data-r="${r.id}" ${owned || away || !canAfford(r.cost) ? 'disabled' : ''}>${owned ? 'Owned' : away ? 'Needs the workbench' : 'Craft'}</button>`;
}
$('recipes').addEventListener('click', (e) => { const b = e.target.closest('[data-sel]'); if (b) { craftSel = b.dataset.sel; renderCraft(); } });
$('rdetail').addEventListener('click', (e) => {
  const id = e.target.dataset?.r; if (!id) return;
  const r = RECIPES.find((x) => x.id === id); if (!canAfford(r.cost) || (r.bench && !nearBench())) return;
  for (const [k, v] of Object.entries(r.cost)) S.inv[k] -= v;
  r.make(); toast(`Crafted <b>${r.name}</b>`); snd.craft(); renderCraft();
});
const FIRE_SAFE_R = 9;   // beasts will not step into the firelight
const FIRES = [];
function makeFire(p, perm = false) {
  const f = new THREE.Group();
  for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28; mesh(new THREE.DodecahedronGeometry(0.24, 0), rockMat, Math.cos(a) * 0.7, 0.1, Math.sin(a) * 0.7, f); }
  for (let i = 0; i < 5; i++) { const l = mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 5), trunkMat, 0, 0.28, 0, f); l.rotation.set(0.95, (i / 5) * 6.28, 0); }
  mesh(new THREE.CircleGeometry(0.55, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5a10 }), 0, 0.06, 0, f);               // glowing embers bed
  const flames = [], add = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  [[0.42, 1.3, 0xff5a10, 0.7], [0.32, 1.05, 0xff9a2a, 0.8], [0.2, 0.75, 0xffe08a, 0.9]].forEach(([r, h, c, o]) => { const fl = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), add(c, o)); fl.position.y = 0.2 + h / 2; f.add(fl); flames.push(fl); });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff8a30, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(5); glow.position.y = 0.9; f.add(glow);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(FIRE_SAFE_R, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xff8a3a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.position.y = 0.08; f.add(pool);
  const N = 40, eg = new THREE.BufferGeometry(), seeds = []; for (let i = 0; i < N; i++) seeds.push([rand() * 6.28, rand(), rr(0.4, 1)]);
  eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xffb050, size: 0.09, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); embers.frustumCulled = false; f.add(embers);
  const light = new THREE.PointLight(0xff9a40, 90, 26, 1.3);
  f.position.copy(p); scene.add(f);
  const fire = { obj: f, flames, light, pos: p.clone(), glow, embers, seeds, perm }; FIRES.push(fire); addEmitter(light, p.clone().setY(p.y + 1.3));
  colliders.push({ x: p.x, z: p.z, r: 0.75, h: 0.6 });
  return fire;
}
function placeCampfire() {
  const p = player.position.clone().add(new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw)).multiplyScalar(2)); p.y = heightAt(p.x, p.z);
  if (S.campfire) { scene.remove(S.campfire.obj); removeEmitter(S.campfire.light); FIRES.splice(FIRES.indexOf(S.campfire), 1); }  // one campfire of your own at a time
  S.campfire = makeFire(p);
  toast('Campfire lit. Beasts will not enter the firelight.', true);
}
const nearestFire = (p, r) => { let best = null, bd = r; for (const f of FIRES) { const d = Math.hypot(p.x - f.pos.x, p.z - f.pos.z); if (d < bd) { bd = d; best = f; } } return best; };
// Safe places: any fire's light, and Nestor's house and courtyard (nothing hunts on his doorstep)
const HUT_SAFE = { pos: hutW(0, 3.5), r: 24 };
function zoneOf(p) {
  for (const f of FIRES) if (Math.hypot(p.x - f.pos.x, p.z - f.pos.z) < FIRE_SAFE_R) return { pos: f.pos, r: FIRE_SAFE_R };
  if (HUT_SAFE.pos && Math.hypot(p.x - HUT_SAFE.pos.x, p.z - HUT_SAFE.pos.z) < HUT_SAFE.r) return HUT_SAFE;
  return null;
}

// ============================================================
// Dialogue
// ============================================================
let dialogQueue = [], dialogDone = null, lineShownAt = 0;
function say(lines, done) {
  if (inCard()) { setTimeout(() => say(lines, done), 500); return; }             // let the open card be read first
  dialogQueue = lines.slice(); dialogDone = done || null; $('dialog').classList.remove('hidden');
  if (lines.some(([w]) => w === 'Nestor') && !S.explore && player.position.distanceTo(nestor.position) < 10) startTalkCam(nestor);
  nextLine();
}
function nextLine() {
  if (!dialogQueue.length) { $('dialog').classList.add('hidden'); if (talkCam.on && !talkCam.fixed) stopTalkCam(); const d = dialogDone; dialogDone = null; if (d) d(); setTimeout(flushPendingCards, 500); return; }
  const [who, txt] = dialogQueue.shift(); $('dialog').querySelector('.who').textContent = who; $('dialog').querySelector('.txt').textContent = txt;
  talkCam.who = who === 'You' ? 'you' : 'npc'; talkCam.lineT = 0; lineShownAt = performance.now(); snd.page();
}
// ---- Conversation camera: letterbox, over-the-shoulder shots that cut between speakers and drift slowly (a gentle
//      handheld dolly), so quest scenes play like cutscenes. Also used for fixed shots (the offering to Athena).
const talkCam = { on: false, t: 0, lineT: 0, who: 'npc', npc: null, look: new THREE.Vector3(), fixed: null };
function startTalkCam(npc, fixed = null) {
  Object.assign(talkCam, { on: true, t: 0, lineT: 0, npc, fixed, shot: null }); talkCam.look.copy(fixed ? fixed.look : npc.position).setY(fixed ? fixed.look.y : npc.position.y + 1.6);
  $('cine').classList.remove('hidden'); $('cineText').classList.remove('show'); requestAnimationFrame(() => $('cine').classList.add('on'));
  $('hud').classList.add('hidden');
}
function stopTalkCam() {
  talkCam.on = false; talkCam.fixed = null; $('cine').classList.remove('on'); setTimeout(() => { if (!talkCam.on && !S.cine) $('cine').classList.add('hidden'); }, 1400);
  $('hud').classList.remove('hidden'); camYaw = P.yaw + Math.PI;
  setTimeout(flushPendingCards, 600);
}
function updateTalkCam(dt) {
  talkCam.t += dt; talkCam.lineT += dt; const k = Math.min(1, dt * 2.2);
  if (talkCam.fixed) {                                     // scripted shot: slow push from p0 to p1
    const F = talkCam.fixed, u = clamp(talkCam.t / F.dur, 0, 1), e = u * u * (3 - 2 * u);
    camera.position.lerpVectors(F.p0, F.p1, e); camera.position.y += Math.sin(talkCam.t * 0.6) * 0.05; camera.lookAt(F.look);
    if (u >= 1 && F.done) { const d = F.done; F.done = null; stopTalkCam(); d(); }
    return;
  }
  // One set shot for the whole conversation: side-on to both speakers, glides in from the gameplay camera,
  // then very slowly pulls back while they talk. No cuts between lines.
  const P0 = player.position, N = talkCam.npc.position, ax = new THREE.Vector3(N.x - P0.x, 0, N.z - P0.z); ax.normalize();
  P.yaw = Math.atan2(ax.x, ax.z); player.rotation.y = P.yaw; talkCam.npc.rotation.y = Math.atan2(-ax.x, -ax.z);
  if (!talkCam.shot) {
    const mid = P0.clone().lerp(N, 0.5), side = new THREE.Vector3(-ax.z, 0, ax.x); if (side.dot(camera.position.clone().sub(mid)) < 0) side.negate();
    talkCam.shot = { mid, side, from: camera.position.clone(), fromLook: talkCam.look.clone() };
  }
  const sh = talkCam.shot, pull = Math.min(1, talkCam.t / 24), e = pull * (2 - pull);                 // ease-out over ~24 s
  const want = sh.mid.clone().addScaledVector(sh.side, 3.9 + e * 2.4).addScaledVector(ax, -0.5 - e * 0.6); want.y = sh.mid.y + 1.45 + e * 0.5;
  want.y = Math.max(want.y, heightAt(want.x, want.z) + 0.8);
  const look = sh.mid.clone().setY(sh.mid.y + 0.7);    // full figures, heads well inside the letterbox, feet behind the dialogue box
  const gl = Math.min(1, talkCam.t / 1.4), gk = gl * gl * (3 - 2 * gl);                                  // glide in from where the camera was
  camera.position.copy(sh.from).lerp(want, gk); talkCam.look.copy(sh.fromLook).lerp(look, gk); camera.lookAt(talkCam.look);
}
const inDialog = () => !$('dialog').classList.contains('hidden') || !$('card').classList.contains('hidden');
$('dialog').addEventListener('click', nextLine);

// ============================================================
// Quests
// ============================================================
const Q = [
  { title: 'The Chosen One', desc: 'Your boat broke on the rocks of Nisos, the first island of Argonisos. An old man lives by the hut above the cove: Nestor, the guide Zeus set here for the chosen.',
    obj: () => [['Meet Nestor by his hut', S.talkedNestor]], target: () => nestor.position },
  { title: 'The First Tool', desc: 'Nestor wants to see you make something with your own hands. Pick up branches and pebbles from the ground and pull fiber from bushes and reeds, then craft a Stone Axe at the workbench in Nestor\'s smithy.',
    obj: () => [[`Wood ${Math.min(S.inv.wood, 3)}/3`, S.inv.wood >= 3 || S.tools.axe], [`Stone ${Math.min(S.inv.stone, 2)}/2`, S.inv.stone >= 2 || S.tools.axe], [`Fiber ${Math.min(S.inv.fiber, 1)}/1`, S.inv.fiber >= 1 || S.tools.axe], ['Craft a Stone Axe at the workbench', S.tools.axe]], target: () => (S.inv.wood >= 3 && S.inv.stone >= 2 && S.inv.fiber >= 1 ? BENCH : null) },
  { title: 'A Gift for Athena', desc: 'Every chosen one must honour Athena before the trial begins. Gather berries from the bushes, then cut a branch from the Sacred Olive, the ancient tree at the heart of the Olive Terraces.',
    obj: () => [[`Berries ${Math.min(S.inv.berries, 3)}/3`, S.inv.berries >= 3], ['A branch of the Sacred Olive', !!S.oliveBranch]], target: () => (S.oliveBranch ? null : OLIVE) },
  { title: 'The Temple of Athena', desc: 'Carry the offering east to the Temple of Athena and place it before her statue in the cella.',
    obj: () => [['Place the offering at the statue (E)', !!S.offered]], target: () => ATHENA_OFFER },
  { title: 'Return to Nestor', desc: 'The goddess answered. Go back to Nestor and tell him what you saw.',
    obj: () => [['Report to Nestor', !!S.reported]], target: () => nestor.position },
  { title: 'Arms of the Chosen', desc: 'An axe works wood. A spear keeps beasts at a distance. Craft one at the workbench in Nestor\'s smithy.',
    obj: () => [['Craft a Spear at the workbench', S.tools.spear]], target: () => BENCH },
  { title: 'Fire Before Dark', desc: 'Nights on Nisos are long and the wolves come out. Build a campfire. Resting at it with R makes time pass faster.',
    obj: () => [['Build a Campfire (C)', !!S.campfire]], target: () => null },
  { title: 'The Hunt', desc: 'Berries alone will not keep you alive. Hunt two deer, then a stag or a wild bull (they fight back), and cook the meat at your fire with E.',
    obj: () => [[`Deer ${Math.min(S.kills.deer, 2)}/2`, S.kills.deer >= 2], [`Stag or wild bull ${Math.min(S.kills.stag + S.kills.bull, 1)}/1`, S.kills.stag + S.kills.bull >= 1], [`Cook meat ${Math.min(S.cooked, 3)}/3`, S.cooked >= 3]],
    target: () => (S.kills.deer < 2 ? nearestCreature('deer') : S.kills.stag + S.kills.bull < 1 ? nearestCreature('stag', 'bull') : null) },
  { title: 'The Long Night', desc: 'Survive until dawn. Stay near the fire, keep your spear ready and eat when you are hungry.',
    obj: () => [[`Survive a night (${S.nights - S.nightsAtStart}/1)`, S.nights - S.nightsAtStart >= 1]], target: () => S.campfire?.pos, start: () => { S.nightsAtStart = S.nights; } },
  { title: 'The Cave of Echoes', desc: 'Zeus left a sail in the cave on the mountain\'s flank for the chosen. Chosen who failed now guard it. Clear the skeletons and open the chest.',
    obj: () => { const k = skeletons.filter((s) => s.dead).length; return [[`Skeletons ${k}/3`, k >= 3], ['Loot the old chest', !chest.alive]]; }, target: () => chestPos },
  { title: 'Mend Your Boat', desc: 'Your boat lies broken in the cove. Patch the hull with timber, lash it with rope, rig the sail from the cave and stock food for the crossing to Pedias.',
    obj: () => [[`Wood ${Math.min(S.inv.wood, 12)}/12`, S.inv.wood >= 12 || S.raftBuilt], [`Rope ${Math.min(S.inv.rope, 4)}/4`, S.inv.rope >= 4 || S.raftBuilt], [`Sailcloth ${S.inv.sail}/1`, S.inv.sail >= 1 || S.raftBuilt], [`Cooked meat ${Math.min(S.inv.meat, 3)}/3`, S.inv.meat >= 3 || S.raftBuilt], ['Mend the boat in the cove (E)', S.raftBuilt]],
    target: () => RAFT_SITE },
  { title: 'To Pedias', desc: 'Your trial on Nisos is done. Say goodbye to Nestor, then board your boat and sail through the channel to the fertile fields of Pedias, the first of the nine biomes.',
    obj: () => [['Set sail from the cove (E)', S.sailing]], target: () => RAFT_SITE },
];
function nearestCreature(...types) {
  let best = null, bd = 1e9;
  for (const c of creatures) if (!c.dead && !c.gone && types.includes(c.type)) { const d = c.obj.position.distanceTo(player.position); if (d < bd) { bd = d; best = c.obj.position; } }
  return best;
}
// Quest tracker (top left): full card when something changes, then it settles to just the title and objectives.
// L opens the journal: the active quest (green), the main quest, and what you've finished. No quest picking.
let questSig = '', questShownT = 0;
function renderQuest() {
  const q = Q[S.questIdx]; $('quest').classList.toggle('hidden', !q || !!S.explore); if (!q) return;
  const li = (list) => list.map(([t, d]) => `<li class="${d ? 'done' : ''}">${d ? '✔' : '○'} ${t}</li>`).join('');
  const obj = q.obj(), sig = S.questIdx + '|' + obj.map((o) => o[1] ? 1 : 0).join('');
  if (sig !== questSig) { questSig = sig; questShownT = performance.now(); $('quest').classList.remove('compact'); }
  else if (performance.now() - questShownT > 9000) $('quest').classList.add('compact');
  let html = `<div class="step">Quest ${S.questIdx + 1} / ${Q.length}</div><h3 class="cinzel">${q.title}</h3><p>${q.desc}</p><ul>${li(obj)}</ul>`;
  if (S.questIdx >= 1 && S.questIdx < 10 && !S.raftBuilt) html += `<div class="step" style="margin-top:10px">Main quest</div><h3 class="cinzel qmain" style="font-size:14px;margin-top:6px">Mend Your Boat</h3>`;
  html += '<div class="qhint">L · Quest journal</div>';
  $('quest').innerHTML = html;
}
function renderJournal() {
  const li = (list) => list.map(([t, d]) => `<li class="${d ? 'done' : ''}">${d ? '✔' : '○'} ${t}</li>`).join('');
  const q = Q[S.questIdx]; let h = '<h4>Active</h4>';
  h += q ? `<div class="jq active"><h3>${q.title}</h3><p>${q.desc}</p><ul>${li(q.obj())}</ul></div>` : '<p class="jdone">Your trial on Nisos is complete.</p>';
  if (S.questIdx < 10 && S.questIdx >= 1) h += `<h4>Main quest</h4><div class="jq"><h3>Mend Your Boat</h3><p>${Q[10].desc}</p><ul>${li(Q[10].obj())}</ul></div>`;
  if (S.questIdx > 0) h += '<h4>Completed</h4>' + Q.slice(0, S.questIdx).map((x) => `<div class="jdone">${x.title}</div>`).join('');
  $('journalBody').innerHTML = h;
}
function checkQuest() {
  if (S.explore) return;
  const q = Q[S.questIdx]; if (!q) return;
  if (q.obj().every(([, d]) => d)) {
    toast(`Quest complete: ${q.title}`, true); snd.questDone(); setTimeout(() => saveGame(false), 2500);
    S.questIdx++; const n = Q[S.questIdx]; if (n?.start) n.start();
    if (n) setTimeout(() => questCard(n), 900);
    if (S.questIdx === 9) setTimeout(() => say([['Nestor', 'You lived through the night. Good. Now listen: Zeus left a sail in the Cave of Echoes, up on the flank of the mountain, in a bronze-bound chest.'], ['Nestor', 'Chosen ones who failed guard it now. They do not sleep. Take your spear, and a full belly.']]), 1500);
  }
}

// Nestor's lines depend on quest progress
function talkNestor() {
  const i = S.questIdx;
  if (i === 0) return say([
    ['Nestor', 'So. Zeus chose you, and Poseidon broke your boat on the way in. He does that to all of them. Let me look at you... Thin arms, but steady eyes. It will do.'],
    ['Nestor', 'I am Nestor. Once a king of Pylos, now a teacher. The Father of the Gods set me on Nisos to prepare the chosen ones.'],
    ['Nestor', 'Hera killed Hercules. Zeus built Argonisos so that someone worthy can inherit his strength. Nine lands, nine Guardians, and Olympos at the end.'],
    ['Nestor', 'Your boat can be mended. Timber, rope, a sail and food, and she will carry you to Pedias. That is the road off this island.'],
    ['Nestor', 'But nobody mends a boat with bare hands. Your first task: make me a Stone Axe. Listen closely, I will only say this once.'],
  ], () => { S.talkedNestor = true; showCards(TUTORIAL); });
  if (i === 4) return say([
    ['Nestor', 'A column of gold over the temple. I saw it from here. So did half of Olympos, I think.'],
    ['Nestor', 'Athena does not answer everyone. Good. Very good.'],
    ['Nestor', 'Now the real work. The nights here are long and the beasts are real. You will need a spear, a fire and a full belly.'],
  ], () => { S.reported = true; });
  const lines = {
    1: 'Three wood, two stone, one fiber, all from the ground. Then make the axe at my workbench in the smithy, round the west side.',
    2: 'Berries grow on the bushes all over the island. The Sacred Olive stands at the heart of the terraces to the south-east, older than anyone remembers. Cut one branch, no more.',
    3: 'The temple is east, past the lake. Place the offering at Athena\'s feet. Kneel if you want to, she likes that.',
    5: 'An axe first, now a spear. Use the workbench in the smithy. Trust me on the spear.',
    6: 'The sun falls fast here. When it is gone the wolves come out of the pines. Build a fire.',
    7: 'Deer run, but stags and wild bulls fight back. Keep the spear pointed at the horns. Cook the meat, raw meat will make you sick.',
    8: 'Stay close to the fire tonight. The wolves are cowards, but hungry ones.',
    9: 'The cave is north, where the trail climbs the mountain. Bring courage. Or do not come back at all, ha.',
    10: 'Your boat is still in the cove. Twelve logs, four ropes, the sail from the cave, and food for the crossing.',
    11: 'Pedias waits across the water. When you face its Guardian, remember what old Nestor taught you.',
  };
  say([['Nestor', lines[i] || 'The gods are watching. Do not bore them.']]);
}

// ============================================================
// Story & tutorial cards: full-screen panels that pause the game
// ============================================================
const STORY = [
  { kicker: 'Argonisos', title: 'Hercules Is Dead', body: 'After centuries of hatred, Hera has finally slain Hercules. His strength, the greatest ever given to a mortal, has no heir.', img: 'concept/world-characters.webp' },
  { kicker: 'The grief of Zeus', title: 'A World Made for a Trial', body: 'Mourning his son, Zeus shapes a demi-plane between the earth and the sky: <b>Argonisos</b>. Here mortals must prove themselves worthy to inherit the power of Hercules.', img: 'concept/nature.webp' },
  { kicker: 'The path', title: 'Nine Lands, Nine Guardians', body: 'Argonisos holds nine biomes, each ruled by a Guardian Boss. Conquer all nine and you ascend to <b>Olympos</b> to claim the power of a demigod.', img: 'concept/buildings.webp' },
  { kicker: 'You', title: 'One of the Chosen', body: 'You did not wash up here by accident. Zeus chose you. Your trial begins on <b>Nisos</b>, a small island at the edge of Argonisos. Pass it, and the fertile fields of Pedias open to you.<br><br>Zeus left a guide on Nisos: <b>Nestor</b>. Find him.', img: 'concept/animals.webp', btn: 'Begin the trial' },
];
const TUTORIAL = [
  { kicker: 'Nestor teaches · 1/5', title: 'Gather', body: 'Walk up to branches, pebbles, bushes and reeds and press <b>E</b> to pick them up. Bushes give berries and grow back.', keys: [['E', 'Interact / pick up'], ['WASD', 'Move'], ['Shift', 'Sprint'], ['Space', 'Jump']] },
  { kicker: 'Nestor teaches · 2/5', title: 'Fight', body: 'Your fists are for beasts, not trees: <b>Left Click</b> to strike. Wood and stone come from branches and pebbles on the ground; once you have an axe you can fell trees and split rocks.', keys: [['LMB', 'Swing / attack'], ['1–3', 'Hands · Axe · Spear']] },
  { kicker: 'Nestor teaches · 3/5', title: 'Craft', body: 'Tools are made at the <b>workbench</b> in my smithy, beside the house: walk up and press <b>E</b>. A Stone Axe needs 3 wood, 2 stone and 1 fiber. Simple things like rope and a campfire you can make anywhere with <b>C</b>. Your bag is on <b>Tab</b>.', keys: [['C', 'Crafting'], ['Tab', 'Inventory']] },
  { kicker: 'Nestor teaches · 4/5', title: 'Stay Alive', body: 'Watch your bars: <b>health</b>, <b>stamina</b>, <b>hunger</b> and <b>energy</b>. Press <b>F</b> to eat. Energy drains through the day; when you tire, <b>sleep</b> by a fire or at my hearth (walk up and press <b>E</b>), and choose how long. You wake rested, but hungrier. Nothing hunts near my house.', keys: [['F', 'Eat'], ['E', 'Sleep at a fire'], ['R', 'Rest at a fire']] },
  { kicker: 'Nestor teaches · 5/5', title: 'Find Your Way', body: 'Follow the gold <b>◆</b> marker on the compass to your current objective. <b>M</b> opens the map. Climbing the watchtower in the north-west reveals the whole island.', keys: [['M', 'Map'], ['◆', 'Objective marker']] },
];
let cardQueue = [], cardDone = null, curCard = null;
// Cards queue up: a new batch waits until the one on screen has been read and closed (never replaces it)
let cardShownAt = 0;
const pendingCards = [];
const convoBusy = () => !$('dialog').classList.contains('hidden') || talkCam.on || S.sleeping;
function flushPendingCards() { if (convoBusy()) return; const pc = pendingCards.splice(0); pc.forEach(([l, d]) => showCards(l, d)); }
function showCards(list, done) {
  if (S.explore) { if (done) done(); return; }
  if (convoBusy()) { pendingCards.push([list, done]); return; }              // never cut into a conversation: wait for it to end
  const batch = list.map((c) => ({ ...c })); if (batch.length) batch[batch.length - 1].__done = done || null;
  const wasOpen = inCard(); cardQueue.push(...batch);
  if (!wasOpen) { document.exitPointerLock(); $('card').classList.remove('hidden'); nextCard(); }
  else updateCardButtons();
}
function updateCardButtons() { const el = $('card'), last = !cardQueue.length || cardQueue[0].__batchStart; el.querySelector('.cnext').textContent = cardQueue.length ? 'Continue' : (el.dataset.btn || 'Got it'); el.querySelector('.cskip').style.visibility = cardQueue.length ? 'visible' : 'hidden'; }
function nextCard(fromKey) {
  if (fromKey && performance.now() - cardShownAt < 700) return;                  // give every card a moment on screen
  if (curCard && curCard.__done) { const d = curCard.__done; curCard.__done = null; setTimeout(d, 0); }
  if (!cardQueue.length) { curCard = null; $('card').classList.add('hidden'); if (S.running && !S.sailing && !talkCam.on) canvas.requestPointerLock(); return; }
  const c = cardQueue.shift(), el = $('card'); snd.page(); curCard = c; cardShownAt = performance.now(); el.dataset.btn = c.btn || '';
  el.querySelector('.ck').textContent = c.kicker || ''; el.querySelector('h2').textContent = c.title; el.querySelector('.cb').innerHTML = c.body;
  el.querySelector('.ckeys').innerHTML = (c.keys || []).map(([k, t]) => `<span><span class="kbd">${k}</span>${t}</span>`).join('');
  el.querySelector('.cimg').style.backgroundImage = c.img ? `url(${c.img})` : ''; el.classList.toggle('noimg', !c.img);
  updateCardButtons();
  el.querySelector('.cin').classList.remove('anim'); void el.offsetWidth; el.querySelector('.cin').classList.add('anim');
}
const inCard = () => !$('card').classList.contains('hidden');
$('card').querySelector('.cnext').onclick = () => nextCard();
$('card').querySelector('.cskip').onclick = () => { const ds = cardQueue.filter((c) => c.__done).map((c) => c.__done); cardQueue = []; nextCard(); ds.forEach((d) => d()); };
function questCard(q) {
  showCards([{ kicker: `New quest · ${Q.indexOf(q) + 1} / ${Q.length}`, title: q.title, body: q.desc, keys: q.obj().map(([t]) => ['○', t]) }]);
  snd.questNew();
}

// ============================================================
// Input
// ============================================================
const keys = {};
let locked = false;
const canvas = renderer.domElement;
canvas.addEventListener('click', () => { if (S.running && !S.sailing && !S.cine && !inDialog() && !menuOpen()) canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked && S.running && $('title').classList.contains('hidden')) setPause(false);
  if (!locked && S.running && !S.sailing && !S.cine && !talkCam.on && !menuOpen() && !inDialog()) setPause(true);
});
document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  camYaw -= e.movementX * 0.0025; camPitch = clamp(camPitch + e.movementY * 0.0022, -0.35, 1.1);
});
document.addEventListener('mousedown', (e) => { if (locked && e.button === 0) startSwing(); });
addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat) P.jumpBuf = 0.15;
  keys[e.code] = true;
  if (!S.running) return;
  if (S.cine) { if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') endIntro(); return; }
  if (inCard()) { if (!e.repeat && (e.code === 'KeyE' || e.code === 'Enter')) nextCard(true); return; }
  if (inDialog()) { if (!e.repeat && (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') && performance.now() - lineShownAt > 350) nextLine(); return; }
  // P: pause / resume / close a panel without Esc, which can't be held back from leaving fullscreen in every browser
  if (e.code === 'KeyP' && !e.repeat) {
    if (menuOpen()) { MENUS.forEach((m) => $(m).classList.add('hidden')); canvas.requestPointerLock(); }
    else if (S.paused) { setPause(false); canvas.requestPointerLock(); }
    else { setPause(true); document.exitPointerLock(); }
    return;
  }
  if (S.sailing) return;
  if (e.code === 'KeyC') toggleCraft();
  if (e.code === 'KeyM') openMenu('mapPanel');
  if (e.code === 'KeyL') openMenu('journalPanel');
  if (e.code === 'Tab' || e.code === 'KeyI') { e.preventDefault(); openMenu('invPanel'); }
  if (menuOpen()) return;
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyF') eat();
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5) - 1; if (n >= 0 && n < SLOTS.length && (n === 0 || S.tools[SLOTS[n].k])) {
    const prev = S.slot; S.slot = S.slot === n ? 0 : n;
    if (prev !== 1 && S.slot === 1) P.equip = { kind: 'equip', t: 0 };        // draw the axe
    else if (prev === 1 && S.slot !== 1) P.equip = { kind: 'disarm', t: 0 };  // put it away
  } }
  if (S.explore) {
    if (e.code === 'KeyV') { P.fly = !P.fly; toast(P.fly ? 'Flying: WASD · Space up · Z down · Shift fast' : 'Walking'); }
    if (e.code === 'KeyO') openMenu('explorePanel');
    if (e.code === 'BracketLeft' || e.code === 'BracketRight') { S.time = (S.time + (e.code === 'BracketLeft' ? -1 : 1) / 48 + 1) % 1; S.timeLock = true; syncExplore(); }
    if (e.code === 'KeyH') $('hud').classList.toggle('hidden');
  }
  if (e.code === 'KeyT') { S.timeScale = S.timeScale === 1 ? 10 : 1; toast(`Playtest: time ×${S.timeScale}`); }
  if (e.code === 'KeyG') { for (const k of ['wood', 'stone', 'fiber', 'rawmeat', 'rope']) S.inv[k] += 10; toast('Playtest: +10 materials'); }
  if (e.code === 'KeyN') debugSkipQuest();
});
addEventListener('keyup', (e) => (keys[e.code] = false));
const MENUS = ['craft', 'invPanel', 'mapPanel', 'explorePanel', 'journalPanel', 'sleepPanel'];
document.querySelectorAll('#sleepPanel [data-h]').forEach((b) => (b.onclick = () => sleep(b.dataset.h === 'dawn' ? 'dawn' : +b.dataset.h)));
const menuOpen = () => MENUS.some((m) => !$(m).classList.contains('hidden'));
function openMenu(id) {                      // one panel at a time; frees the mouse while open
  const el = $(id), opening = el.classList.contains('hidden');
  MENUS.forEach((m) => $(m).classList.add('hidden'));
  snd.ui();
  if (opening) { el.classList.remove('hidden'); document.exitPointerLock(); if (id === 'craft') renderCraft(); if (id === 'invPanel') renderInv(); if (id === 'mapPanel') drawBigMap(); if (id === 'journalPanel') renderJournal(); }
  else canvas.requestPointerLock();
}
document.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => openMenu(b.dataset.close));
function renderInv() {
  const items = [];
  if (S.tools.axe) items.push(['🪓', 1, 'Axe']); if (S.tools.spear) items.push(['🔱', 1, 'Spear']);
  for (const k of Object.keys(S.inv)) if (S.inv[k] > 0) items.push([ICONS[k], S.inv[k], NAMES[k]]);
  let html = ''; for (let i = 0; i < 20; i++) { const it = items[i]; html += it ? `<div class="slot" title="${it[2]}">${it[0]}<em>${it[1]}</em></div>` : '<div class="slot"></div>'; }
  $('invGrid').innerHTML = html;
  const wt = Object.values(S.inv).reduce((a, b) => a + b, 0) * 2 + (S.tools.axe ? 6 : 0) + (S.tools.spear ? 5 : 0);
  $('invWt').style.width = Math.min(100, wt / 3) + '%'; $('invWtN').textContent = `${wt} / 300`;
}
function toggleCraft() { openMenu('craft'); }
$('closeCraft').onclick = toggleCraft; $('craftX').onclick = toggleCraft;
function setPause(p) { S.paused = p; $('pause').classList.toggle('hidden', !p); }
$('resume').onclick = () => { setPause(false); canvas.requestPointerLock(); };
$('toTitle').onclick = () => { $('title').classList.remove('hidden'); $('pause').classList.add('hidden'); $('startBtn').textContent = 'Continue'; document.querySelector('.tabs button[data-tab="t-how"]').click(); };
function debugSkipQuest() {
  const i = S.questIdx;
  if (inCard()) { const ds = cardQueue.filter((c) => c.__done).map((c) => c.__done); cardQueue = []; nextCard(); ds.forEach((d) => d()); }
  if (i === 0) S.talkedNestor = true;
  if (i === 1) S.tools.axe = true;
  if (i === 2) { S.inv.berries += 3; S.oliveBranch = true; }
  if (i === 3) S.offered = true;
  if (i === 4) S.reported = true;
  if (i === 5) S.tools.spear = true;
  if (i === 6) placeCampfire();
  if (i === 7) { S.kills.deer = Math.max(2, S.kills.deer); S.kills.stag = Math.max(1, S.kills.stag); S.cooked = Math.max(3, S.cooked); S.inv.meat += 3; }
  if (i === 8) S.nights++;
  if (i === 9) { skeletons.forEach((s) => { if (!s.dead) killCreature(s); }); openChest(); }
  if (i === 10) { Object.assign(S.inv, { wood: S.inv.wood + 12, rope: S.inv.rope + 4, meat: S.inv.meat + 3, sail: Math.max(1, S.inv.sail) }); player.position.set(START.x, START.y + 0.5, START.z); }
  toast('Playtest: quest step skipped');
}

// ============================================================
// Interaction (E)
// ============================================================
function getInteractable() {
  const pp = player.position; let best = null, bd = 2.6;
  const consider = (d, v) => { if (d < bd) { bd = d; best = v; } };
  consider(pp.distanceTo(nestor.position), { label: 'Talk to Nestor', act: talkNestor });
  consider(Math.hypot(pp.x - BENCH.x, pp.z - BENCH.z) + 0.3, { label: 'Use the workbench', act: () => openMenu('craft') });
  for (const pk of pickups) {
    if (!pk.alive || (pk.kind === 'bush' && pk.regrow > 0) || Math.abs(pk.pos.x - pp.x) > 3 || Math.abs(pk.pos.z - pp.z) > 3) continue;
    const labels = { bowitem: 'Pick up the bow and arrows', axeitem: 'Pick up the axe', olivebranch: 'Cut a branch from the Sacred Olive', branch: 'Pick up branch', pebble: 'Pick up pebbles', bush: 'Harvest bush', reeds: 'Cut reeds', chest: 'Open the old chest' };
    consider(pp.distanceTo(pk.pos), { label: labels[pk.kind], act: () => harvest(pk) });
  }
  const nf = nearestFire(pp, 3.5);
  if (nf) consider(Math.hypot(pp.x - nf.pos.x, pp.z - nf.pos.z) - 0.3, { label: nf.perm ? 'Sleep by Nestor\'s hearth' : 'Sleep by the fire', act: () => openMenu('sleepPanel') });
  if (nf && S.inv.rawmeat > 0) {
    const d = Math.hypot(pp.x - nf.pos.x, pp.z - nf.pos.z) - 0.6;
    if (S.inv.rawmeat > 0) consider(d, { label: `Cook ${S.inv.rawmeat} raw meat`, act: cook });
  }
  const dT = Math.hypot(pp.x - TOWER.x, pp.z - TOWER.z);
  if (dT < 5.5 && pp.y < TOWER_TOP.y - 2) consider(Math.max(0, dT - 3.5), { label: 'Climb the watchtower', act: climbTower });
  if (dT < 2.6 && pp.y > TOWER_TOP.y - 1) consider(0.5, { label: 'Climb down', act: () => { player.position.set(TOWER.x + 4.5, heightAt(TOWER.x + 4.5, TOWER.z) + 0.5, TOWER.z); } });
  if (CAVE_ALTAR && pp.distanceTo(CAVE_ALTAR) < 3.4) consider(1, { label: 'Examine the altar', act: () => say([['You', 'An old altar, cold as snow. There is a hollow in the stone, as if something is meant to rest here.'], ['You', 'Not yet. But I will be back.']]) });
  if (S.questIdx === 3 && Math.hypot(pp.x - ATHENA_OFFER.x, pp.z - ATHENA_OFFER.z) < 2.6) consider(0.8, { label: 'Place the offering before Athena', act: makeOffering });
  const rd = Math.hypot(pp.x - RAFT_SITE.x, pp.z - RAFT_SITE.z);
  if (rd < 5.5) {
    if (!S.raftBuilt) consider(Math.max(0, rd - 2.8), { label: S.questIdx >= 1 ? 'Mend your boat' : 'Your broken boat', act: buildRaft });
    else consider(Math.max(0, rd - 2.5), { label: 'Set sail for Pedias', act: setSail });
  }
  return best;
}
// Offering at the statue: berries + olive branch, answered by a column of golden light
// A column of golden light from the sky (Athena's answer, Zeus delivering a chosen one). One persistent light, no shader recompiles.
const divineLight = new THREE.PointLight(0xffcf70, 0, 30); divineLight.userData.dyn = true; scene.add(divineLight);
function divineBeam(base, life = 6, r = 1.6) {
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.5, 60, 24, 1, true), beamMat); beam.position.copy(base).setY(base.y + 30); scene.add(beam);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.5, 60, 12, 1, true), beamMat.clone()); core.position.copy(beam.position); scene.add(core);
  divineLight.position.copy(base).setY(base.y + 4);
  const t0 = performance.now(), fadeIn = 0.6, hold = life - 2.6;
  const tick = () => { const k = (performance.now() - t0) / 1000, a = k < fadeIn ? k / fadeIn : k < hold ? 1 : Math.max(0, 1 - (k - hold) / 2);
    beamMat.opacity = a * 0.3; core.material.opacity = a * 0.6; divineLight.intensity = a * 70; beam.rotation.y = k * 0.4; beam.scale.x = beam.scale.z = 1 + Math.sin(k * 3) * 0.05;
    if (k < life) requestAnimationFrame(tick); else { scene.remove(beam); scene.remove(core); divineLight.intensity = 0; } };
  tick();
}
function makeOffering() {
  S.inv.berries = Math.max(0, S.inv.berries - 3); S.offered = true; document.exitPointerLock();
  const base = new THREE.Vector3(TEMPLE.x, TEMPLE_Y + 1.3, TEMPLE.z - 8);
  { const og = new THREE.Group(); og.position.copy(ATHENA_OFFER); scene.add(og); for (let i = 0; i < 9; i++) mesh(new THREE.SphereGeometry(0.06, 6, 4), flat(0x6a2a6a), rr(-0.25, 0.25), 0.05, rr(-0.15, 0.15), og); const br = oliveBranch(); br.scale.setScalar(0.8); br.position.set(0.1, 0, 0); og.add(br); }
  divineBeam(base, 6);
  snd.blessing();
  const head = new THREE.Vector3(TEMPLE.x, TEMPLE_Y + 6.2, TEMPLE.z - 8);
  startTalkCam(null, { p0: new THREE.Vector3(TEMPLE.x + 2.6, TEMPLE_Y + 1.6, TEMPLE.z - 1.5), p1: new THREE.Vector3(TEMPLE.x + 1.2, TEMPLE_Y + 2.6, TEMPLE.z - 4.2), look: head, dur: 6,
    done: () => showCards([{ kicker: 'The goddess answers', title: 'Athena\'s Blessing', body: 'The branch turns to gold in your hands, then to light. Somewhere above the clouds, grey eyes open and look at you for the first time.<br><br>Athena has seen you. Return to Nestor and tell him.', keys: [] }]) });
}
function climbTower() {
  player.position.set(TOWER_TOP.x, TOWER_TOP.y + 0.2, TOWER_TOP.z); P.vel.y = 0;
  revealMap(TOWER.x, TOWER.z, 420); showRegion({ name: 'The island unfolds', sub: 'Map revealed. Press M to open it' });
  snd.questDone();
}
function interact() { const it = getInteractable(); if (it) it.act(); }
function harvest(pk) {
  if (pk.kind === 'chest') {
    if (skeletons.some((s) => !s.dead)) { toast('The dead still guard the chest.'); return; }
    return openChest();
  }
  if (pk.kind === 'bowitem') { S.tools.bow = true; S.slot = 3; give('arrows', 12); toast('Picked up a <b>Bow</b> and 12 arrows. Press 4 to aim, click to shoot.'); }
  if (pk.kind === 'axeitem') { S.tools.axe = true; S.slot = 1; P.equip = { kind: 'equip', t: 0 }; toast('Picked up the <b>Axe</b>. Press 2 to put it away or take it out.'); sfx(440, 0.2, 'triangle', 0.08, 200); }
  if (pk.kind === 'olivebranch') { S.oliveBranch = true; toast('Took the <b>Sacred Olive Branch</b>. Athena\'s tree, Athena\'s gift.', true); snd.pickup(true); }
  if (pk.kind === 'branch') give('wood', 1, pk.pos);
  if (pk.kind === 'pebble') give('stone', 1, pk.pos);
  if (pk.kind === 'reeds') give('fiber', 2, pk.pos);
  if (pk.kind === 'bush') { give('berries', 2, pk.pos); give('fiber', 1); pk.regrow = 90; pk.obj.userData.berries.visible = false; return; }
  pk.alive = false; scene.remove(pk.obj);
}
function openChest() {
  if (!chest.alive) return; chest.alive = false; chestLid.rotation.x = -1.2; chestLid.position.z = -0.35;
  give('sail', 1, chestPos); give('hide', 2); toast('Found <b>Sailcloth</b> with a faded red cross'); snd.chest();
}
function sleep(hours) {
  openMenu('sleepPanel');
  if (!zoneOf(player.position) || creatures.some((c) => c.state === 'chase' && !c.dead && c.obj.position.distanceTo(player.position) < 15)) { toast('You can\'t sleep with danger this close.'); return; }
  if (hours === 'dawn') { const tgt = 0.21; hours = Math.max(1, Math.round((((tgt - S.time) % 1) + 1) % 1 * 24)); }
  S.sleeping = true; document.exitPointerLock(); const fade = $('fade'); fade.style.transition = 'opacity 1.4s'; fade.style.opacity = 1;
  setTimeout(() => {
    S.time += hours / 24; while (S.time >= 1) { S.time -= 1; S.day++; }
    const food0 = S.food, en0 = S.energy;
    S.food = Math.max(0, S.food - hours * 3.5); S.energy = Math.min(100, S.energy + hours * 13); S.hp = Math.min(100, S.hp + hours * 6); S.sta = 40 + S.energy * 0.6;
    if (!isNight()) creatures.forEach((c) => { if (c.type === 'wolf' && !c.dead) { scene.remove(c.obj); c.gone = true; } });
    setTimeout(() => { fade.style.opacity = 0; S.sleeping = false; toast(`Slept ${hours} h · Energy +${Math.round(S.energy - en0)} · Hunger −${Math.round(food0 - S.food)}`, true); saveGame(false); canvas.requestPointerLock(); }, 900);
  }, 1500);
}
function cook() {
  const n = S.inv.rawmeat; S.inv.rawmeat = 0; S.inv.meat += n; S.cooked += n;
  const nf = nearestFire(player.position, 4) || { pos: player.position }; floatText(`+${n} 🍖`, nf.pos.clone().setY(nf.pos.y + 1.5), '#ffcf7a'); snd.sizzle();
}
function buildRaft() {
  if (S.questIdx < 1) { say([['You', 'My boat... Poseidon made kindling of it. I will need wood, rope, a new sail and food before she swims again.']]); return; }
  const need = { wood: 12, rope: 4, sail: 1, meat: 3 };
  if (!canAfford(need)) { toast('Missing materials. Check <b>Mend Your Boat</b> in the quest panel.'); return; }
  for (const [k, v] of Object.entries(need)) S.inv[k] -= v;
  S.raftBuilt = true; wreckGroup.visible = false; colliders.forEach((c) => { if (c.x === WRECK.x && c.z === WRECK.z) c.r = 0; });
  raftParts.forEach((p, i) => setTimeout(() => { p.visible = true; burst(raftGroup.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 0x9b6e3f, 6); snd.hitWood(); }, i * 220));
  setTimeout(() => { toast('Your boat is whole again.', true); snd.questDone(); }, raftParts.length * 220);
}
function eat() {
  if (S.inv.meat > 0) { S.inv.meat--; S.food = clamp(S.food + 35, 0, 100); S.hp = clamp(S.hp + 10, 0, 100); toast('Ate cooked meat 🍖'); }
  else if (S.inv.berries > 0) { S.inv.berries--; S.food = clamp(S.food + 10, 0, 100); toast('Ate berries 🫐'); }
  else if (S.inv.rawmeat > 0) { S.inv.rawmeat--; S.food = clamp(S.food + 12, 0, 100); hurtPlayer(8, 'Raw meat made you sick'); }
  else { toast('Nothing to eat'); return; }
  snd.eat();
}

// ============================================================
// Combat & gathering (left click)
// ============================================================
const TOOL_STATS = { hands: { dmg: 5, wood: 1, stone: 1, reach: 2.3 }, axe: { dmg: 11, wood: 4, stone: 4, reach: 2.6 }, spear: { dmg: 24, wood: 1, stone: 1, reach: 3.4 } };
// ---- Bow & arrows: models from the user's asset pack
const bowHeld = new THREE.Group(), arrowProto = { obj: null }, arrows = [];
// (bow disabled for the prologue: no ranged weapon on Nisos)
loadTexturedFBX('arrow', 0.9, (obj) => { obj.position.y -= 0.45; const g = new THREE.Group(); g.add(obj); g.rotation.x = Math.PI / 2; const w = new THREE.Group(); w.add(g); arrowProto.obj = w; });
function shootArrow() {
  if (S.inv.arrows <= 0) { toast('No arrows. Craft some (C)'); return; }
  S.inv.arrows--; P.drawT = 0.35; snd.bow();
  const dir = new THREE.Vector3(-Math.sin(camYaw) * Math.cos(camPitch - 0.18), -Math.sin(camPitch - 0.18), -Math.cos(camYaw) * Math.cos(camPitch - 0.18)).normalize();
  const o = arrowProto.obj ? arrowProto.obj.clone() : mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4), trunkMat, 0, 0, 0);
  o.position.copy(player.position).add(new THREE.Vector3(0, 1.5, 0)).addScaledVector(dir, 0.8); scene.add(o);
  arrows.push({ o, v: dir.multiplyScalar(48), t: 0, stuck: false });
}
function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i]; a.t += dt;
    if (!a.stuck) {
      a.v.y -= 9.8 * dt * 0.6; const step = a.v.clone().multiplyScalar(dt); a.o.position.add(step);
      a.o.lookAt(a.o.position.clone().add(a.v));
      for (const c of creatures) { if (c.dead || !c.obj.visible) continue; const cp = c.obj.position; if (Math.abs(cp.x - a.o.position.x) + Math.abs(cp.z - a.o.position.z) < 2 && a.o.position.y < cp.y + 2 && a.o.position.y > cp.y - 0.2) {
        const dmg = Math.round(28 * rr(0.9, 1.15)); c.hp -= dmg; c.flash = 0.15; c.state = c.def.flee ? 'flee' : 'chase'; floatText(dmg, cp.clone().setY(cp.y + 1.6), '#ffdf8a'); snd.arrowHit(); (c.type === 'skeleton' ? snd.bones : snd.hitFlesh)();
        if (c.hp <= 0) killCreature(c); a.stuck = true; a.t = 9; break; } }
      if (!a.stuck && a.o.position.y < heightAt(a.o.position.x, a.o.position.z)) { a.stuck = true; a.t = Math.max(a.t, 0); }
    }
    if (a.t > 12) { scene.remove(a.o); arrows.splice(i, 1); }
  }
}
function startSwing() {
  if (S.slot === 3 && S.tools.bow) { if (!(P.drawT > 0)) shootArrow(); return; }
  if (P.swing > 0 || P.dead || S.paused) return;
  if (S.sta < 6) { toast('Too tired'); return; }
  S.sta -= 8; P.swing = 1; P.swingHit = false; setTimeout(() => snd.swing(S.slot !== 0), 120);
}
function doHit() {
  const tool = TOOL_STATS[SLOTS[S.slot].k], pp = player.position;
  const fwd = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
  const inFront = (p, reach) => { const d = new THREE.Vector3(p.x - pp.x, 0, p.z - pp.z); const len = d.length(); return len < reach && (len < 0.8 || d.normalize().dot(fwd) > 0.45); };
  // Creatures first
  let hitAny = false;
  for (const c of creatures) {
    if (c.dead || c.def.passive || !inFront(c.obj.position, tool.reach + c.def.r)) continue;
    const dmg = Math.round(tool.dmg * rr(0.85, 1.15));
    c.hp -= dmg; c.flash = 0.15; hitAny = true;
    floatText(dmg, c.obj.position.clone().setY(c.obj.position.y + 1.6), '#ffdf8a');
    c.obj.position.addScaledVector(fwd, 0.6);
    if (c.def.flee) c.state = 'flee'; else c.state = 'chase';
    burst(c.obj.position.clone().setY(c.obj.position.y + 0.6), c.type === 'skeleton' ? 0xe9e0c9 : 0xa33a2a, 5);
    if (c.type === 'skeleton') snd.bones(); else if (S.slot === 0) snd.punch(); else snd.hitFlesh();
    if (c.hp <= 0) killCreature(c);
  }
  if (hitAny) return;
  if (SLOTS[S.slot].k !== 'axe') {   // bare hands and the spear are for fighting; gather wood and stone from the ground
    if (resources.some((r) => r.alive && inFront(r.pos, tool.reach + r.r)) && !(P.hintT > 0)) { toast('You can\'t break that by hand. Pick up branches and stones from the ground, or use an axe.'); P.hintT = 6; setTimeout(() => (P.hintT = 0), 6000); }
    return;
  }
  for (const r of resources) {
    if (!r.alive || !inFront(r.pos, tool.reach + r.r)) continue;
    const pow = r.type === 'tree' ? tool.wood : tool.stone;
    r.hp -= pow; r.shake = 0.25;
    burst(r.pos.clone().setY(r.pos.y + 1), r.type === 'tree' ? 0x7a4f2c : 0x9b958c, 5);
    if (r.type === 'tree') snd.hitWood(); else snd.hitStone();
    if (r.type === 'rock' && pow >= 4) give('stone', 1, r.pos.clone().setY(r.pos.y + 1.5));
    if (r.hp <= 0) {
      r.alive = false;
      if (r.type === 'tree') { r.fall = 0.001; give('wood', 4, r.pos.clone().setY(r.pos.y + 2)); }
      else { updateProp(r.item, true); give('stone', 3, r.pos.clone().setY(r.pos.y + 1.5)); }
    }
    return;
  }
}
function killCreature(c) {
  c.dead = true; c.deadT = 0; S.kills[c.type]++;
  for (const [k, v] of Object.entries(c.def.drops)) give(k, v, c.obj.position.clone().setY(c.obj.position.y + 1.2));
  if (c.type === 'skeleton') burst(c.obj.position.clone().setY(c.obj.position.y + 1), 0xe9e0c9, 16);
}
function hurtPlayer(dmg, reason) {
  if (S.explore) return;
  if (P.dead) return;
  S.hp -= dmg; P.hurtT = 0.25; snd.hurt();
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
  if (!c.dead && c.type !== 'wolf' && !c.tamed && !o.visible) return;          // far away: frozen until the player comes near
  if (c.dead) {
    c.deadT += dt;
    if (animateAnimal(c, 0, dt)) o.position.y -= dt * (c.deadT > 2 ? 0.4 : 0);     // animated: play Death, then sink
    else { o.rotation.z = Math.min(c.deadT * 4, Math.PI / 2); o.position.y -= dt * (c.deadT > 1.5 ? 0.6 : 0); }
    if (c.deadT > 3) { scene.remove(o); c.gone = true; } return;
  }
  const d = c.def, pp = player.position; const dist = o.position.distanceTo(pp);
  c.t -= dt; c.atkCd -= dt;
  const zone = zoneOf(pp), playerSafe = !!zone;
  if (d.hostile && S.explore) { if (c.state === 'chase') c.state = 'wander'; }
  else if (d.hostile) {
    const aggro = d.aggro || 40;
    if (c.type === 'skeleton' && c.home.distanceTo(pp) > 22) c.state = 'return';
    else if (dist < aggro && !P.dead) c.state = 'chase';
    if (c.type === 'wolf' && !isNight()) c.state = 'flee';
    if (playerSafe && c.state === 'chase' && c.type !== 'skeleton') c.state = 'prowl';            // circle at the edge of the light
  } else if (d.flee && dist < 7) c.state = 'flee';
  else if (c.state === 'flee' && dist > 16) c.state = 'wander';
  if (d.retaliate && c.state === 'chase' && dist > 18) c.state = 'wander';

  let speed = 0; const goal = tmp;
  if (d.companion) {                                   // the husky: waits until you come close, then sticks with you
    if (!c.tamed && dist < 4 && !S.explore) { c.tamed = true; toast('A <b>husky</b> sniffs your hand and decides to follow you.', true); }
    if (c.tamed) {
      const foe = creatures.find((e) => !e.dead && !e.gone && e.def.hostile && e.type !== 'skeleton' && e.obj.position.distanceTo(o.position) < 12 && e.obj.position.distanceTo(pp) < 20);
      if (foe) {
        const fd = foe.obj.position.distanceTo(o.position); goal.copy(foe.obj.position); speed = fd > 1.8 ? d.speed : 0;
        if (fd <= 2 && c.atkCd <= 0) { c.atkCd = 1.2; c.lunge = 0.35; foe.hp -= 8; foe.flash = 0.15; if (foe.def.flee) foe.state = 'flee'; floatText(8, foe.obj.position.clone().setY(foe.obj.position.y + 1.4), '#ffdf8a'); if (foe.hp <= 0) killCreature(foe); }
        if (fd <= 2.2) { const yaw = Math.atan2(foe.obj.position.x - o.position.x, foe.obj.position.z - o.position.z); o.rotation.y = yaw; }
      } else if (dist > 4) { goal.copy(pp); speed = dist > 10 ? d.speed : Math.min(d.speed, 4.8); }
      if (dist > 60) o.position.copy(pp).add(new THREE.Vector3(2, 0, 2));   // never lose it
      c.state = 'companion';
    }
  }
  if (c.state === 'companion') { /* handled above */ }
  else if (c.state === 'wander') {
    if (c.t <= 0) { c.t = rr(2, 6); { const R = d.roam || 10; c.target.set(c.home.x + rr(-R, R), 0, c.home.z + rr(-R, R)); } c.idle = rand() < 0.4; }
    goal.copy(c.target); speed = c.idle ? 0 : d.speed * 0.3;
  } else if (c.state === 'flee') {
    goal.copy(o.position).multiplyScalar(2).sub(pp); speed = d.speed;
    if (c.type === 'wolf') { c.fleeT = (c.fleeT || 0) + dt; if (c.fleeT > 6) { scene.remove(o); c.gone = true; return; } }
  } else if (c.state === 'prowl') {
    if (!playerSafe) c.state = 'chase';
    else { const fp = zone.pos, an = Math.atan2(o.position.z - fp.z, o.position.x - fp.x) + dt * 0.25;
      goal.set(fp.x + Math.cos(an) * (zone.r + 3), 0, fp.z + Math.sin(an) * (zone.r + 3)); speed = d.speed * 0.35; }
  } else if (c.state === 'return') { goal.copy(c.home); speed = d.speed; if (o.position.distanceTo(c.home) < 1) c.state = 'wander'; }
  else if (c.state === 'chase') {
    goal.copy(pp); speed = d.speed;
    if (dist < d.reach + 0.2) {
      speed = 0;
      if (c.atkCd <= 0 && !P.dead && !playerSafe) { c.atkCd = c.type === 'skeleton' ? 1.4 : 1.1; c.lunge = 0.3; hurtPlayer(d.dmg); }
    }
  }
  if (speed > 0) {
    const dir = new THREE.Vector3(goal.x - o.position.x, 0, goal.z - o.position.z);
    if (dir.lengthSq() > 0.05) {
      dir.normalize();
      const nx = o.position.x + dir.x * speed * dt, nz = o.position.z + dir.z * speed * dt;
      if (heightAt(nx, nz) > 0.3 || c.type === 'skeleton') { o.position.x = nx; o.position.z = nz; }
      if (d.hostile && c.type !== 'skeleton') { const zc = zoneOf(o.position); if (zc) { const fp = zc.pos, fx = o.position.x - fp.x, fz = o.position.z - fp.z, fd = Math.hypot(fx, fz) || 1; o.position.x = fp.x + fx / fd * (zc.r + 1); o.position.z = fp.z + fz / fd * (zc.r + 1); } }
      else c.t = 0;
      const targetYaw = Math.atan2(dir.x, dir.z);
      o.rotation.y += Math.atan2(Math.sin(targetYaw - o.rotation.y), Math.cos(targetYaw - o.rotation.y)) * Math.min(1, dt * 8);
    }
  }
  const gy = heightAt(o.position.x, o.position.z);
  if (c.type === 'skeleton') {                           // the dead never leave the cave
    const dx = o.position.x - CAVE.x, dz = o.position.z - CAVE.z, d = Math.hypot(dx, dz), m = CH_R - 1.8;
    if (d > m) { o.position.x = CAVE.x + dx / d * m; o.position.z = CAVE.z + dz / d * m; }
  }
  if (c.pen) { clampToPen(o); }
  o.position.y = heightAt(o.position.x, o.position.z);
  // Animation
  c.anim = (c.anim || 0) + dt * (speed > 0 ? speed * 1.6 : 0);
  if (animateAnimal(c, speed, dt)) { /* skinned model */ }
  else if (c.type === 'skeleton') animateHumanoid(o, speed, c.anim / 3.4, c.lunge > 0 ? c.lunge / 0.3 : 0);
  if (c.lunge > 0) c.lunge -= dt;
  const flashing = c.flash > 0; c.flash -= dt;
  if (flashing !== !!c.flashOn) { c.flashOn = flashing; o.traverse((m) => { if (m.isMesh && m.material.emissive) m.material.emissive.setHex(flashing ? 0x882211 : 0x000000); }); }
}

// ============================================================
// Camera + player update
// ============================================================
let camYaw = Math.PI, camPitch = 0.35;
// Spatial grid over the colliders (8 m cells), rebuilt only when colliders are added
let colGrid = null, colGridN = -1;
function colCells(x, z) {
  if (colGridN !== colliders.length) { colGrid = new Map(); colGridN = colliders.length;
    for (const c of colliders) { const k = Math.floor(c.x / 8) + ',' + Math.floor(c.z / 8); let a = colGrid.get(k); if (!a) colGrid.set(k, (a = [])); a.push(c); } }
  const cx = Math.floor(x / 8), cz = Math.floor(z / 8), out = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = colGrid.get((cx + i) + ',' + (cz + j)); if (a) out.push(a); }
  return out;
}
function collide(pos, r, lift = 0) {
  for (const cell of colCells(pos.x, pos.z)) for (const c of cell) {
    if (c.ref && !c.ref.alive) continue;
    if (c.h !== undefined && lift > c.h) continue;                 // high enough in a jump to clear it
    const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
    if (d < m && d > 0.0001) { pos.x = c.x + (dx / d) * m; pos.z = c.z + (dz / d) * m; }
  }
}
function surfaceAt(p, ground, swimming) {
  if (swimming || ground < 0.05) return 'water';
  if (inCaveInterior(p.x, p.z)) return 'cave';
  if (p.y > ground + 0.25) return 'stone';                     // on a built floor (temple, dock, ruins)
  if (pathDist(p.x, p.z) < 1.9) return Math.hypot(p.x - MOUNT.x, p.z - MOUNT.z) < 112 && ground > 25 ? 'stone' : 'dirt';
  if (ground < 1.2) return 'sand';
  return 'grass';
}
function updatePlayer(dt) {
  if (P.dead) { player.rotation.z = lerp(player.rotation.z, Math.PI / 2, dt * 4); return; }
  player.rotation.z = P.bank || 0; player.rotation.x = P.lean || 0;
  const input = new THREE.Vector3((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), 0, (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0));
  const ground = heightAt(player.position.x, player.position.z);
  const swimming = ground < -0.6;
  let speed = 0;
  P.sprinting = false;
  if (P.fly) {                                   // Explore mode: free flight, no collisions, no gravity
    const fast = keys.ShiftLeft || keys.ShiftRight, v = (fast ? 60 : 18) * dt;
    const fwd = new THREE.Vector3(-Math.sin(camYaw) * Math.cos(camPitch), -Math.sin(camPitch), -Math.cos(camYaw) * Math.cos(camPitch));
    const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    if (locked) { player.position.addScaledVector(fwd, input.z * v).addScaledVector(right, input.x * v);
      if (keys.Space) player.position.y += v; if (keys.KeyZ) player.position.y -= v; }
    player.position.y = Math.max(player.position.y, Math.max(heightAt(player.position.x, player.position.z), -0.2) + 0.3);
    P.yaw = Math.atan2(fwd.x, fwd.z); player.rotation.y = P.yaw; P.vel.y = 0; P.onGround = true;
    animateHumanoid(player, 0, P.animT); if (hero.native) animateHero(dt, 0); else if (hero.rig) poseHero(0, 0, 0, performance.now() / 1000);
    return;
  }
  // Movement with momentum: accelerate into a run, ease to a stop, keep your speed through a jump (little air control)
  if (!P.hv) P.hv = new THREE.Vector3();
  const wantV = new THREE.Vector3();
  if (input.lengthSq() > 0 && locked) {
    input.normalize();
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);             // camera forward on XZ
    const dir = new THREE.Vector3().set(fx * input.z + -fz * input.x, 0, fz * input.z + fx * input.x).normalize();
    const sprint = (keys.ShiftLeft || keys.ShiftRight) && S.sta > 1 && !swimming && S.energy > 5;
    P.sprinting = sprint; wantV.copy(dir).multiplyScalar((swimming ? 2.4 : sprint ? 8 : 4.6) * (S.energy < 20 ? 0.8 : 1));
    if (sprint && P.hv.length() > 3) S.sta -= 18 * dt;
  }
  const acc = !P.onGround ? 2.5 : wantV.lengthSq() > 0 ? 11 : 14;
  P.hv.x += (wantV.x - P.hv.x) * Math.min(1, acc * dt); P.hv.z += (wantV.z - P.hv.z) * Math.min(1, acc * dt);
  speed = Math.hypot(P.hv.x, P.hv.z); if (speed < 0.05) { speed = 0; P.hv.set(0, 0, 0); }
  player.position.x += P.hv.x * dt; player.position.z += P.hv.z * dt;
  if (speed > 0.3 && wantV.lengthSq() > 0) { const ty = Math.atan2(wantV.x, wantV.z); P.yaw += Math.atan2(Math.sin(ty - P.yaw), Math.cos(ty - P.yaw)) * Math.min(1, dt * (P.onGround ? 10 : 4)); }
  else if (locked && P.swing > 0) {
    P.yaw = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));        // face where the camera looks when attacking
  }
  const staMax = 40 + S.energy * 0.6;   // tired = less stamina
  if (!(P.sprinting && speed > 3)) S.sta = clamp(S.sta + (swimming ? 4 : 16) * dt, 0, staMax); else S.sta = Math.min(S.sta, staMax);
  if (swimming) { S.sta = Math.max(0, S.sta - 6 * dt); if (S.sta <= 0) { S.hp -= 5 * dt; if (S.hp <= 0) die(); } }
  // Keep the island a closed arena: the sea gets rough past the reef
  const r = Math.hypot(player.position.x, player.position.z);
  if (r > ISLAND_R + 18) { player.position.multiplyScalar((ISLAND_R + 18) / r); if (!P.warned) { toast('The currents are too strong to swim. Build a raft.'); P.warned = true; setTimeout(() => (P.warned = false), 5000); } }
  const lift = player.position.y - heightAt(player.position.x, player.position.z); collide(player.position, 0.4, lift); caveCollide(player.position);
  const yawRate = (P.yaw - (P.lastYaw ?? P.yaw)) / Math.max(dt, 1e-3); P.lastYaw = P.yaw;
  P.lean = lerp(P.lean || 0, P.onGround ? clamp(speed / 8, 0, 1) * 0.09 : 0, Math.min(1, dt * 6)); P.bank = lerp(P.bank || 0, clamp(-yawRate * 0.03 * clamp(speed / 5, 0, 1), -0.12, 0.12), Math.min(1, dt * 6));
  player.rotation.y = P.yaw;
  // Jump / gravity
  if (P.jumpBuf > 0) P.jumpBuf -= dt;
  if (P.jumpBuf > 0 && P.onGround && S.sta > 10 && !swimming) { P.jumpBuf = 0; P.vel.y = 7.4; P.onGround = false; P.jumped = true; S.sta -= 10; snd.jump(); }
  const wasAir = !P.onGround && P.vel.y < -4;
  P.vel.y -= 20 * dt; player.position.y += P.vel.y * dt;
  const floor = Math.max(heightAt(player.position.x, player.position.z), swimming ? -1.2 : -99);
  const fl = Math.max(floor, floorAt(player.position));
  if (player.position.y <= fl) { if (wasAir) snd.land(); player.position.y = fl; P.vel.y = 0; P.onGround = true; }
  if (speed > 0 && (P.onGround || swimming)) { P.stepD = (P.stepD || 0) + speed * dt; if (P.stepD > (P.sprinting ? 2.3 : 1.6)) { P.stepD = 0; snd.step(surfaceAt(player.position, ground, swimming), P.sprinting); } }
  // Swing
  if (P.swing > 0) { P.swing -= dt * (S.slot === 0 ? (PUNCH.ready ? 2.2 : 3.2) : (ATTACK.ready ? 1.35 : 3.2)); if (!P.swingHit && P.swing < 0.55) { P.swingHit = true; doHit(); } }
  P.animT += dt * (speed > 0 ? speed / 4.6 : 0.3);
  animateHumanoid(player, speed, P.animT, Math.max(P.swing, 0));
  if (hero.native) animateHero(dt, speed);
  else if (hero.rig) {
    poseHero(speed, P.animT * 10, Math.max(P.swing, 0), performance.now() / 1000);
    const moveW = clamp(speed / 3, 0, 1);
    P.sprintW = lerp(P.sprintW || 0, P.sprinting && SPRINT.ready ? 1 : 0, Math.min(1, dt * 6));   // smooth crossfade
    if (RUN.ready) applyRun(RUN, dt, clamp(speed / 3.6, 0.6, 1.4), moveW * (1 - P.sprintW), P.swing > 0);
    if (SPRINT.ready && P.sprintW > 0.01) applyRun(SPRINT, dt, clamp(speed / 7, 0.8, 1.3), moveW * P.sprintW, P.swing > 0);
    // Jump: skip the wind-up crouch, map the airborne time onto the rising/falling part of the clip
    if (!P.onGround) P.jumpT = (P.jumpT || 0) + dt; else if (P.jumpT) { P.landT = 0.25; P.jumpT = 0; }
    if (P.landT > 0) P.landT -= dt;
    if (P.jumpT > 0) applyClipAt(JUMP, 0.28 + P.jumpT / 0.7 * 0.5, 1, P.swing > 0 ? ['armR', 'foreR', 'spine'] : []);
    else if (P.landT > 0) applyClipAt(JUMP, 0.8 + (0.25 - P.landT) * 0.6, P.landT / 0.25);
    // Draw / put away the axe (upper body only so you can keep moving)
    if (P.equip) {
      P.equip.t += dt / 0.9;
      const C = P.equip.kind === 'equip' ? EQUIP : DISARM, w = Math.min(1, Math.sin(Math.min(P.equip.t, 1) * Math.PI) * 2.5);
      applyClipAt(C, P.equip.t, w, speed > 0.5 ? LOWER : []);
      if (P.equip.t >= 1) P.equip = null;
    }
    // Axe strike: full body when standing, upper body while running
    const AC = S.slot === 0 ? PUNCH : ATTACK;   // fists punch, tools strike
    if (P.swing > 0 && AC.ready) applyClipAt(AC, 1 - P.swing, Math.min(1, P.swing * 6, (1 - P.swing) * 8 + 0.2), speed > 0.5 || !P.onGround ? LOWER : []);
  }
  let axeVis = S.slot === 1;
  if (P.equip && (P.equip.kind === 'equip' ? EQUIP : DISARM).ready) axeVis = P.equip.kind === 'equip' ? P.equip.t > 0.5 : P.equip.t < 0.6;
  tools.axe.visible = axeVis; tools.spear.visible = S.slot === 2;
  backAxe.visible = S.tools.axe && !axeVis; backSpear.visible = S.tools.spear && S.slot !== 2;
  if (backSpear.visible && !backSpear.children.length) { const sp = tools.spear.clone(); sp.visible = true; sp.scale.setScalar(1); sp.position.set(0, -0.6, 0); sp.rotation.set(0, 0, 0); backSpear.add(sp); } bowHeld.visible = S.slot === 3 && S.tools.bow;
  if (P.drawT > 0) P.drawT -= dt; updateArrows(dt);
  if (P.hurtT > 0) P.hurtT -= dt;
}
const camTgt = new THREE.Vector3(); let camTgtInit = false;
function updateCamera(dt) {
  const raw = player.position.clone().add(new THREE.Vector3(0, 1.7, 0));
  if (!camTgtInit || camTgt.distanceTo(raw) > 6) { camTgt.copy(raw); camTgtInit = true; }
  camTgt.x += (raw.x - camTgt.x) * Math.min(1, dt * 16); camTgt.z += (raw.z - camTgt.z) * Math.min(1, dt * 16); camTgt.y += (raw.y - camTgt.y) * Math.min(1, dt * 7);
  const target = camTgt.clone();
  const underground = inCaveInterior(player.position.x, player.position.z) && player.position.y < CAVE_Y + 4;
  const dist = underground ? 4.2 : 7, pitch = underground ? Math.min(camPitch, 0.45) : camPitch;
  const off = new THREE.Vector3(Math.sin(camYaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(camYaw) * Math.cos(pitch)).multiplyScalar(dist);
  const want = target.clone().add(off);
  if (underground) { caveCollide(want.setY(CAVE_Y + 1)); want.y = Math.min(target.y + Math.sin(pitch) * dist, CAVE_Y + 5.2); }   // stay under the vault
  want.y = Math.max(want.y, heightAt(want.x, want.z) + 0.6, 0.3);
  camera.position.lerp(want, Math.min(1, dt * 12)); camera.lookAt(target);
}

// ============================================================
// Day/night, world upkeep
// ============================================================
const skyDay = new THREE.Color(0xa9cfe8), skyDusk = new THREE.Color(0xf0a070), skyNight = new THREE.Color(0x0b1630);
let wolfTimer = 5;
function updateWorld(dt, t) {
  if (!S.timeLock) S.time += (dt * S.timeScale * (P.resting ? 8 : 1)) / DAY_LEN;
  if (S.time >= 1) { S.time -= 1; S.day++; }
  const night = isNight();
  if (S.wasNight && !night) { S.nights++; toast(`Dawn of day ${S.day}`, true); creatures.filter((c) => c.type === 'wolf').forEach((c) => (c.state = 'flee')); }
  if (!S.wasNight && night) toast('Night falls. Wolves are hunting. Stay in the firelight.', true);
  if (S.running && !S.explore && S.time > 0.78 && S.time < 0.845 && S.warnDay !== S.day && !convoBusy() && !inCard()) {
    S.warnDay = S.day; const safe = !!nearestFire(player.position, 60) || !!zoneOf(player.position);
    if (!S.warnedOnce) { S.warnedOnce = true; showCards([{ kicker: 'The sun is going down', title: 'Night Is Coming', body: 'When night falls the wolves come out of the pines to hunt.<br><br>Build a <b>campfire</b> (press <b>C</b>: 5 wood, 3 stone). Beasts will not step into its light: stay inside the circle and you are safe. Rest by it with <b>R</b> to let the night pass faster.', keys: [['C', 'Craft a campfire'], ['R', 'Rest by the fire']] }]); }
    else if (!safe) toast('The sun is setting. Get to a fire before dark.', true);
  }
  S.wasNight = night;

  const tv = sunClock(S.time), e = -Math.cos(tv * Math.PI * 2);   // -1 midnight, +1 noon
  const day = clamp(e * 2.2 + 0.35, 0, 1), dusk = clamp(1 - Math.abs(e) * 3.5, 0, 1);
  const skyCol = skyNight.clone().lerp(skyDay, day).lerp(skyDusk, dusk * 0.55);
  scene.fog.color.copy(skyCol); scene.background = skyCol;
  const nightK = clamp(-e * 3 - 0.05, 0, 1);
  sun.intensity = lerp(0.15 + day * 2.9, 0.45, nightK); sun.color.setHex(dusk > 0.4 ? 0xffb070 : 0xffe2b0).lerp(new THREE.Color(0x9fb8ff), nightK);
  hemi.intensity = 0.2 + day * 0.45 + nightK * 0.15; hemi.color.setHex(0xbfdcff).lerp(new THREE.Color(0x5a74b8), nightK); hemi.groundColor.setHex(0x3f6a5a).lerp(new THREE.Color(0x1a2030), nightK);
  const sa = tv * Math.PI * 2;
  sun.position.set(player.position.x + Math.sin(sa) * 60, Math.max(8, e * 80), player.position.z + 30 + Math.cos(sa) * 20);
  moonDir.set(-Math.sin(tv * Math.PI * 2) * 0.5, Math.max(0.35, -e * 0.85 + 0.15), -0.45).normalize();
  if (e < -0.1) sun.position.set(player.position.x + moonDir.x * 70, moonDir.y * 70, player.position.z + moonDir.z * 70);   // moonlight: soft blue, from the moon
  { // texel-snapped shadow frustum: moving the player no longer makes shadow edges shimmer ('electric' flicker on the hero)
    const fwd = _sv1.subVectors(player.position, sun.position).normalize(), right = _sv2.crossVectors(fwd, UPV).normalize(), up2 = _sv3.crossVectors(right, fwd);
    const texel = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x, pp = player.position;
    const r = Math.round(pp.dot(right) / texel) * texel, u = Math.round(pp.dot(up2) / texel) * texel, f = pp.dot(fwd);
    const c = _sv4.copy(right).multiplyScalar(r).addScaledVector(up2, u).addScaledVector(fwd, f), off = _sv5.subVectors(sun.position, player.position);
    sun.target.position.copy(c); sun.position.copy(c).add(off);
  }
  // Physical sky + reflections follow the true sun; at night the sky shader fades and a moonlit tint takes over
  const sa2 = tv * Math.PI * 2;
  sunDir.set(Math.sin(sa2) * 0.55, e, 0.35 + Math.cos(sa2) * 0.25).normalize();
  sky.material.uniforms.sunPosition.value.copy(sunDir);
  skyDome.material.uniforms.top.value.copy(skyNight).lerp(new THREE.Color(0x3a78c8), day).lerp(new THREE.Color(0x6a6fae), dusk * 0.4);
  skyDome.material.uniforms.hor.value.copy(new THREE.Color(0x1a2a48)).lerp(new THREE.Color(0xb8dcf0), day).lerp(new THREE.Color(0xf2b27a), dusk * 0.7);
  hutGlow.emissiveIntensity = nightK * 1.4 + dusk * 0.4; forgeGlow.emissiveIntensity = 1.8 + Math.sin(t * 5) * 0.4;
  { const U = skyDome.material.uniforms; U.night.value = nightK; U.uT.value = t; U.moonDir.value.copy(moonDir); U.aurora.value = lerp(U.aurora.value, hash(S.day * 13.1, 7.7) > 0.45 ? 1 : 0, dt * 0.2); }
  skyDome.material.uniforms.sunDir.value.copy(sunDir); skyDome.position.copy(camera.position); renderer.toneMappingExposure = lerp(0.5, 0.82, day);
  WATER_U.uTime.value = t; WATER_U.uDay.value = clamp(day + dusk * 0.3, 0, 1); WATER_U.uSky.value.copy(skyDome.material.uniforms.top.value); WATER_U.uHor.value.copy(skyDome.material.uniforms.hor.value);
  WATER_U.uSunDir.value.copy(sunDir.y > 0 ? sunDir : moonDir); WATER_U.uSunCol.value.setHex(day > 0.1 ? (dusk > 0.4 ? 0xffb070 : 0xfff1d6) : 0x7088b8).multiplyScalar(0.3 + day * 0.7);
  windUniform.value = t; grassU.uCenter.value.set(player.position.x, player.position.z);
  envTimer -= 1;
  if (envTimer <= 0) { envTimer = 240; refreshEnvironment(); scene.environmentIntensity = lerp(0.15, 1, day); }

  // Region banner + per-region mood (fog, snow, fireflies, cold) — RDR2/BotW style atmosphere
  const here = regionAt(player.position.x, player.position.z);
  if (S.running && here.key !== S.region) { S.regionT = (S.regionT || 0) + dt; if (S.regionT > 0.8) { S.region = here.key; S.regionT = 0; showRegion(here); } } else S.regionT = 0;
  const hy = player.position.y;
  const fogTgt = here.key === 'swamp' ? [15, 150, 0x7d8a6a] : here.key === 'forest' ? [40, 380, 0x8fae9a] : here.key === 'cave' ? [6, 60, 0x1a1c22] : hy > 45 ? [30, 300, 0xdfe8f2] : [GFX.level === 'low' ? 120 : 160, GFX.fogFar || 1150, null];
  scene.fog.near = lerp(scene.fog.near, fogTgt[0], dt * 0.8); scene.fog.far = lerp(scene.fog.far, fogTgt[1], dt * 0.8);
  if (fogTgt[2] !== null) scene.fog.color.lerp(new THREE.Color(fogTgt[2]).multiplyScalar(0.3 + day * 0.7), 0.9);
  const inCave = inCaveInterior(player.position.x, player.position.z) && player.position.y < CAVE_Y + 4;
  caveTorches.forEach((c, i) => { c.fl.scale.y = 1 + Math.sin(t * 14 + i * 2) * 0.25; if (c.glow) c.L.opacity = 0.75 + Math.sin(t * 17 + i) * 0.2; else c.L.intensity = 12 + Math.sin(t * 17 + i) * 3; });
  if (CAVE_VEILS.mat) { const along = (player.position.x - CAVE_MOUTH.x) * CAVE_DIR.x + (player.position.z - CAVE_MOUTH.z) * CAVE_DIR.z, near = segDist(player.position.x, player.position.z, CAVE_MOUTH, CAVE) < TUN_W + 1;
    const want = near && along > -1.5 ? 0 : 1; CAVE_VEILS.mat.uniforms.uO.value += (want - CAVE_VEILS.mat.uniforms.uO.value) * Math.min(1, dt * 4); }
  hemi.intensity *= inCave ? 0.15 : 1; sun.intensity *= inCave ? 0.3 : 1;
  snow.material.opacity = lerp(snow.material.opacity, hy > 42 ? 0.9 : 0, dt); snow.position.set(camera.position.x, camera.position.y - 12, camera.position.z);
  if (snow.material.opacity > 0.01) { const sa3 = snow.geometry.attributes.position; for (let i = 0; i < sa3.count; i++) { let y = sa3.getY(i) - dt * 2.2 * S.timeScale; if (y < 0) y += 25; sa3.setY(i, y); sa3.setX(i, sa3.getX(i) + Math.sin(t + i) * 0.01); } sa3.needsUpdate = true; }
  fireflies.material.opacity = lerp(fireflies.material.opacity, night ? 0.9 * (0.6 + Math.sin(t * 3) * 0.4) : 0, dt * 2);
  crystals.forEach((c, i) => { c.rotation.y += dt * 0.2; if (c.material.emissiveIntensity !== undefined) c.material.emissiveIntensity = 1.3 + Math.sin(t * 2 + i) * 0.4; });
  if (sacredMotes.pts && Math.abs(OLIVE.x - player.position.x) + Math.abs(OLIVE.z - player.position.z) < 120) { const a = sacredMotes.pts.geometry.attributes.position; sacredMotes.forEach(([an, r, y, ph], i) => { const k = t * 0.08 + ph * 6.28; a.setXYZ(i, Math.cos(an + k) * r, y + Math.sin(k * 2) * 0.6, Math.sin(an + k) * r); }); a.needsUpdate = true; }
  fallFx.forEach((m) => { const k = (t * 0.25 + m.userData.ph) % 1; m.position.copy(m.userData.base).setY(m.userData.base.y + 0.5 + k * 5); m.scale.setScalar(3 + k * 6); m.material.opacity = 0.3 * Math.sin(k * Math.PI); });
  braziers.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 13 + i) * 0.2; f.scale.x = f.scale.z = 1 + Math.sin(t * 9 + i * 2) * 0.08; if (f.userData.glow) f.userData.glow.material.opacity = 0.55 + Math.sin(t * 17 + i) * 0.12; });
  fallU.t.value = t;
  pollen.material.opacity = 0.7 * day; pollen.position.set(camera.position.x, Math.max(heightAt(camera.position.x, camera.position.z), 0), camera.position.z);
  { const pa = pollen.geometry.attributes.position; for (let i = 0; i < pa.count; i += 3) { pa.setY(i, (pa.getY(i) + dt * 0.15) % 6); pa.setX(i, pa.getX(i) + Math.sin(t * 0.5 + i) * dt * 0.2); } pa.needsUpdate = true; }
  for (const b of birds) { const u = b.userData, a = t * u.sp + u.ph * 0.1; b.position.set(u.c0.x + Math.cos(a) * u.r, u.c0.y + Math.sin(t * 0.3 + u.ph), u.c0.z + Math.sin(a) * u.r).add(u.off);
    b.rotation.y = -a; b.scale.set(1, 1 + Math.sin(t * 9 + u.ph) * 0.9, 1); }
  if (hy > 50 && !(S.campfire && player.position.distanceTo(S.campfire.pos) < 5)) { S.food = Math.max(0, S.food - dt * 0.6); if (!S.coldWarned) { toast('Freezing up here. Hunger drains faster. Keep moving.'); S.coldWarned = true; } } else if (hy < 40) S.coldWarned = false;
  // Explore to reveal the map
  S.revealT = (S.revealT || 0) - dt; if (S.revealT <= 0 && S.running) { S.revealT = 0.5; revealMap(player.position.x, player.position.z, 55); }

  // Hunger & regen
  S.food = clamp(S.food - dt * S.timeScale * (P.resting ? 8 : 1) * 0.28, 0, 100);
  if (S.food <= 0) { S.hp -= dt * 1.5; if (S.hp <= 0 && !P.dead) die(); }
  else if (S.food > 50 && S.hp < 100) S.hp = Math.min(100, S.hp + dt * 1.2);

  // Night wolves
  if (S.explore) { S.food = S.hp = 100; S.sta = Math.max(S.sta, 60); }
  if (night && !P.dead && !S.explore) {
    wolfTimer -= dt * S.timeScale;
    const wolves = creatures.filter((c) => c.type === 'wolf' && !c.dead && !c.gone).length;
    if (wolfTimer <= 0 && wolves < Math.min(1 + S.day, 4)) {
      wolfTimer = 18;
      for (let i = 0; i < 12; i++) {
        const a = rr(0, 6.28), p = player.position.clone().add(new THREE.Vector3(Math.cos(a) * 28, 0, Math.sin(a) * 28));
        p.y = heightAt(p.x, p.z);
        if (p.y > 1 && Math.hypot(p.x - CAVE.x, p.z - CAVE.z) > 20) { spawnCreature('wolf', p).state = 'chase'; break; }
      }
    }
  }
  // Keep game animals stocked
  for (const [type, n] of [['deer', 14], ['stag', 6], ['fox', 6]]) {
    if (creatures.filter((c) => c.type === type && !c.dead).length < n && rand() < dt * 0.05) {
      const p = landSpot(2, 30, AVOID.concat([{ x: player.position.x, z: player.position.z, r: 30 }])); if (p) spawnCreature(type, p);
    }
  }
  for (let i = creatures.length - 1; i >= 0; i--) if (creatures[i].gone) creatures.splice(i, 1);

  // Bushes regrow
  for (const pk of pickups) if (pk.kind === 'bush' && pk.regrow > 0) { pk.regrow -= dt * S.timeScale; if (pk.regrow <= 0) pk.obj.userData.berries.visible = true; }
  // Falling trees
  for (const r of resources) {
    if (r.fall > 0) { r.fall += dt * 1.8; r.item.tilt = Math.min(r.fall * r.fall, Math.PI / 2); updateProp(r.item, r.fall > 2.2); if (r.fall > 2.2) r.fall = 0; }
    else if (r.shake > 0 && r.alive) { r.shake -= dt; r.item.tilt = Math.sin(t * 60) * r.shake * 0.05; updateProp(r.item); if (r.shake <= 0) { r.item.tilt = 0; updateProp(r.item); } }
  }
  // Campfire flicker + rest
  FIRES.forEach((C, fi) => {
    const fl = Math.sin(t * 17 + fi) * 0.5 + Math.sin(t * 23.3 + fi * 2) * 0.3 + Math.sin(t * 7.1) * 0.2;
    C.flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 13 + i * 2 + fi) * 0.22; f.scale.x = f.scale.z = 1 + Math.sin(t * 9 + i) * 0.08; f.rotation.y = t * (i + 1); });
    C.light.intensity = (night ? 110 : 18) + fl * (night ? 16 : 4);   // firelight matters at night; by day it's a warm accent C.glow.material.opacity = 0.7 + fl * 0.15;
    if (Math.abs(C.pos.x - player.position.x) + Math.abs(C.pos.z - player.position.z) < 80) { const a = C.embers.geometry.attributes.position; C.seeds.forEach(([an, ph, sp], i) => { const k = (t * 0.35 * sp + ph) % 1; a.setXYZ(i, Math.cos(an + k * 3) * (0.2 + k * 0.6), 0.5 + k * 4.5, Math.sin(an + k * 3) * (0.2 + k * 0.6)); }); a.needsUpdate = true; }
  });
  // energy: drains while awake (~4.5 per in-game hour), recovers resting by a fire
  if (!S.explore) { S.energy = clamp(S.energy - dt * S.timeScale * (24 / DAY_LEN) * (P.resting ? -18 : 4.5), 0, 100);
    if (S.energy < 25 && !S.tiredWarned) { S.tiredWarned = true; toast('You are exhausted. Sleep by a fire, or at Nestor\'s hearth.', true); } if (S.energy > 50) S.tiredWarned = false; }
  P.resting = !!(keys.KeyR && nearestFire(player.position, 4) && !creatures.some((c) => c.state === 'chase' && !c.dead));
  // Water, smoke, clouds, NPC
  smoke.forEach((s) => { s.userData.t = (s.userData.t + dt * 0.15) % 1; const k = s.userData.t; s.position.set(CHIMNEY.x + k * 2, CHIMNEY.y + k * 6, CHIMNEY.z); s.scale.setScalar(0.5 + k * 1.8); s.material.opacity = 0.5 * (1 - k); });
  _cc.setRGB(1.5, 1.5, 1.55).lerp(_cd.setRGB(1.6, 0.95, 0.75), dusk * 0.6).lerp(_cd.setRGB(0.1, 0.12, 0.2), nightK);   // clouds: white by day, peach at dusk, dark moonlit at night
  clouds.forEach((c) => { c.position.x += dt * 1.5; if (c.position.x > 1400) c.position.x = -1400; c.material.color.copy(_cc); });
  const nd = nestor.position.distanceTo(player.position);
  nestor.rotation.y = nd < 8 ? Math.atan2(player.position.x - nestor.position.x, player.position.z - nestor.position.z) : nestor.rotation.y;
  if (nestor.userData.rig) poseIdleRig(nestor.userData.rig, t); else animateHumanoid(nestor, 0, t);
  if (S.raftBuilt && !S.sailing) raftGroup.position.y = 0.05 + Math.sin(t * 1.5) * 0.08;
}

// ============================================================
// Minimap & waypoint
// ============================================================
const mm = $('minimap').getContext('2d');
const MAPN = 512, MAPW = 640;                               // map canvas covers 640 m
const mmBase = document.createElement('canvas'); mmBase.width = mmBase.height = MAPN;
{
  const c = mmBase.getContext('2d'); const img = c.createImageData(MAPN, MAPN);
  for (let y = 0; y < MAPN; y++) for (let x = 0; x < MAPN; x++) {
    const wx = (x / MAPN - 0.5) * MAPW, wz = (y / MAPN - 0.5) * MAPW, h = heightAt(wx, wz), R = regionAt(wx, wz, h), i = (y * MAPN + x) * 4;
    const sh = clamp((heightAt(wx - 1.5, wz - 1.5) - h) * 0.25, -0.35, 0.35);   // hill shading
    let col = h < 0 ? [52, 118, 160] : h < 1.1 && R.key !== 'swamp' ? [222, 204, 150] : R.key === 'swamp' ? [92, 98, 62] : R.key === 'forest' ? [62, 96, 52] : h > 56 ? [236, 238, 240] : h > 34 ? [140, 132, 122] : [118, 146, 76];
    if (h > 0 && pathDist(wx, wz) < 1.8) col = [196, 170, 120];
    img.data.set([col[0] * (1 - sh), col[1] * (1 - sh), col[2] * (1 - sh), 255], i);
  }
  c.putImageData(img, 0, 0);
  c.font = 'bold 13px Cinzel, serif'; c.textAlign = 'center'; c.fillStyle = '#2a2014';
  for (const R of REGIONS) { const [x, y] = [(R.c.x / MAPW + 0.5) * MAPN, (R.c.z / MAPW + 0.5) * MAPN]; c.fillStyle = 'rgba(255,248,230,.85)'; c.fillText(R.name, x, y + 1); c.fillStyle = '#2a2014'; c.fillText(R.name, x, y); }
}
const mmFog = document.createElement('canvas'); mmFog.width = mmFog.height = MAPN;
{ const c = mmFog.getContext('2d'); c.fillStyle = '#1b2330'; c.fillRect(0, 0, MAPN, MAPN); }
function revealMap(x, z, r) {
  const c = mmFog.getContext('2d'), px = (x / MAPW + 0.5) * MAPN, pz = (z / MAPW + 0.5) * MAPN, pr = r / MAPW * MAPN;
  const gr = c.createRadialGradient(px, pz, pr * 0.6, px, pz, pr); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalCompositeOperation = 'destination-out'; c.fillStyle = gr; c.beginPath(); c.arc(px, pz, pr, 0, 6.28); c.fill(); c.globalCompositeOperation = 'source-over';
}
const toMapPx = (p) => [(p.x / MAPW + 0.5) * MAPN, (p.z / MAPW + 0.5) * MAPN];
function drawMapMarkers(ctx, tf, target, big) {
  if (!big) {   // minimap: everything you can pick up nearby
    const pp = player.position, ic = { bush: '🫐', branch: '🪵', pebble: '🪨', reeds: '🌾', olivebranch: '🌿', chest: '🧰' };
    ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const pk of pickups) { if (!pk.alive || (pk.kind === 'bush' && pk.regrow > 0) || !ic[pk.kind]) continue;
      if (Math.hypot(pk.pos.x - pp.x, pk.pos.z - pp.z) > 30) continue;
      const [x, y] = tf(pk.pos); ctx.globalAlpha = pk.kind === 'bush' ? 0.95 : 0.85; ctx.fillText(ic[pk.kind], x, y); }
    ctx.globalAlpha = 1;
    for (const f of FIRES) { const [x, y] = tf(f.pos); ctx.fillText('🔥', x, y); }
    // animals within 40 m, each with its own icon (game you can hunt, livestock, your husky)
    const AI = { deer: '🦌', stag: '🦌', fox: '🦊', bull: '🐂', cow: '🐄', horse: '🐎', horse_white: '🐎', donkey: '🫏', alpaca: '🦙', shibainu: '🐕', husky: '🐺' };
    ctx.font = '11px sans-serif';
    for (const c of creatures) { if (c.dead || c.gone || !AI[c.type] || Math.hypot(c.obj.position.x - pp.x, c.obj.position.z - pp.z) > 40) continue; const [x, y] = tf(c.obj.position); ctx.fillText(AI[c.type], x, y); }
  }
  ctx.fillStyle = '#b0392e'; creatures.forEach((c) => { if (!c.dead && c.def.hostile) { const [x, y] = tf(c.obj.position); ctx.fillRect(x - 1.5, y - 1.5, 3, 3); } });
  ctx.fillStyle = '#fff'; { const [x, y] = tf(nestor.position); ctx.fillRect(x - 2, y - 2, 4, 4); }
  for (const m of questMarkers()) { const [x, y] = tf(m.pos); ctx.font = `900 ${big ? 26 : 17}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3.5; ctx.strokeStyle = '#2a1a06'; ctx.strokeText(m.g, x, y - (big ? 10 : 7)); ctx.fillStyle = '#ffd23a'; ctx.fillText(m.g, x, y - (big ? 10 : 7)); }
  if (target && !questMarkers().some((m) => m.pos.distanceTo(target) < 3)) { const [x, y] = tf(target), k = big ? 1.6 : 1; ctx.fillStyle = '#e8c27a'; ctx.beginPath(); ctx.moveTo(x, y - 5 * k); ctx.lineTo(x + 4 * k, y); ctx.lineTo(x, y + 5 * k); ctx.lineTo(x - 4 * k, y); ctx.fill(); }
  const [px, py] = tf(player.position); ctx.save(); ctx.translate(px, py); ctx.rotate(-P.yaw + Math.PI);
  const k = big ? 1.7 : 1; ctx.fillStyle = '#ffe9b0'; ctx.strokeStyle = '#2a2014'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -6 * k); ctx.lineTo(4 * k, 4 * k); ctx.lineTo(-4 * k, 4 * k); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
const waypoint = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshBasicMaterial({ color: 0xe8c27a }));
scene.add(waypoint);
// Quest markers, World of Warcraft style: gold ! = someone has a task for you, gold ? = come here to hand in / deliver
function questMarkers() {
  if (S.explore || S.sailing || talkCam.on || S.cine) return [];
  const i = S.questIdx, out = [];
  if (i === 0) out.push({ pos: nestor.position, g: '!', h: 2.9 });
  if (i === 3) out.push({ pos: ATHENA_OFFER, g: '?', h: 1.2 });
  if (i === 4) out.push({ pos: nestor.position, g: '?', h: 2.9 });
  if (i === 10 && S.inv.wood >= 12 && S.inv.rope >= 4 && S.inv.sail >= 1 && S.inv.meat >= 3) out.push({ pos: RAFT_SITE, g: '?', h: 2.4 });
  if (i === 11) out.push({ pos: RAFT_SITE, g: '!', h: 2.4 });
  return out;
}
const glyphTex = {};
for (const gch of ['!', '?']) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 192; const x = c.getContext('2d');
  x.font = '900 170px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(255,200,60,.9)'; x.shadowBlur = 22; x.lineWidth = 12; x.strokeStyle = '#3a2408'; x.strokeText(gch, 64, 104);
  const gr = x.createLinearGradient(0, 20, 0, 180); gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.45, '#ffd23a'); gr.addColorStop(1, '#d08a10');
  x.shadowBlur = 0; x.fillStyle = gr; x.fillText(gch, 64, 104);
  glyphTex[gch] = new THREE.CanvasTexture(c); glyphTex[gch].colorSpace = THREE.SRGBColorSpace;
}
const markerSprites = [0, 1].map(() => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTex['!'], transparent: true, depthWrite: false, fog: false })); sp.renderOrder = 5; sp.visible = false; scene.add(sp); return sp; });
function updateQuestMarkers(t) {
  const list = questMarkers();
  markerSprites.forEach((sp, k) => { const m = list[k]; sp.visible = !!m; if (!m) return;
    if (sp.material.map !== glyphTex[m.g]) { sp.material.map = glyphTex[m.g]; sp.material.needsUpdate = true; }
    const d = camera.position.distanceTo(m.pos), s = Math.max(0.7, d / 20);
    sp.position.set(m.pos.x, m.pos.y + m.h + 0.3 * s + Math.sin(t * 2.6) * 0.12, m.pos.z); sp.scale.set(0.55 * s, 0.82 * s, 1); });
  return list;
}
function drawMinimap(target) {
  const view = 180, sc = 160 / (view / MAPW * MAPN);                        // minimap shows 180 m around the player
  const [cx, cy] = toMapPx(player.position), src = view / MAPW * MAPN;
  mm.save(); mm.clearRect(0, 0, 160, 160); mm.beginPath(); mm.rect(0, 0, 160, 160); mm.clip();
  mm.fillStyle = '#1b2330'; mm.fillRect(0, 0, 160, 160);
  mm.drawImage(mmBase, cx - src / 2, cy - src / 2, src, src, 0, 0, 160, 160);
  mm.drawImage(mmFog, cx - src / 2, cy - src / 2, src, src, 0, 0, 160, 160);
  const tf = (p) => { const [x, y] = toMapPx(p); return [80 + (x - cx) * sc, 80 + (y - cy) * sc]; };
  let tgt = target; if (tgt) { const [x, y] = tf(tgt), d = Math.hypot(x - 80, y - 80); if (d > 72) tgt = null, mm.fillStyle = '#e8c27a', mm.beginPath(), mm.arc(80 + (x - 80) / d * 72, 80 + (y - 80) / d * 72, 4, 0, 6.28), mm.fill(); }
  drawMapMarkers(mm, tf, tgt, false);
  mm.restore();
  mm.fillStyle = '#e8c27a'; mm.font = 'bold 11px Cinzel, serif'; mm.fillText('N', 76, 12);
}
// Full map (M), BotW style: the island as you've explored it
function drawBigMap() {
  const cv = $('bigmap'), c = cv.getContext('2d'), S2 = cv.width;
  c.clearRect(0, 0, S2, S2); c.drawImage(mmBase, 0, 0, S2, S2); c.drawImage(mmFog, 0, 0, S2, S2);
  const k = S2 / MAPN; drawMapMarkers(c, (p) => { const [x, y] = toMapPx(p); return [x * k, y * k]; }, Q[S.questIdx]?.target(), true);
}

// ============================================================
// Sailing ending
// ============================================================
function setSail() {
  if (S.questIdx < 11) return;
  S.sailing = true; document.exitPointerLock(); $('prompt').classList.add('hidden'); checkQuest();
  say([['Nestor', '(from the shore) Fair winds! May the Guardian of Pedias fear you!'], ['You', 'One island down. Eight lands to go.']], () => {
    const start = performance.now();
    player.position.set(0, 0.5, 0.8); player.rotation.set(0, 0, 0); raftGroup.add(player); P.yaw = 0;
    const tick = () => {
      const k = (performance.now() - start) / 1000;
      { const v = 0.08 + k * 0.01; raftGroup.position.x += Math.sin(boatYaw) * v; raftGroup.position.z += Math.cos(boatYaw) * v; } raftGroup.rotation.z = Math.sin(k * 1.4) * 0.05;
      if (k > 9) { $('fade').style.opacity = 1; }
      if (k > 11.5) {
        $('ending').classList.remove('hidden');
        $('endStats').innerHTML = `Survived <b>${S.day}</b> days · Deer ${S.kills.deer} · Stags ${S.kills.stag} · Bulls ${S.kills.bull} · Wolves ${S.kills.wolf} · Skeletons ${S.kills.skeleton} · Deaths ${S.deaths}<br>Time played: ${Math.round((performance.now() - S.started) / 60000)} min<br><br>Next in the Unity build: landfall in Pedias, the first biome, and its Guardian.`;
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
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.12 }, warm: { value: new THREE.Vector3(1.04, 1.0, 0.93) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat; uniform vec3 warm; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, sat) * warm;
      c.rgb += (1.0 - smoothstep(0.0, 0.5, l)) * vec3(-0.012, 0.01, 0.03);   // teal shadows
      gl_FragColor = c; }`,
});
composer.addPass(new OutputPass());
const PRESETS = {
  low:    { scale: Math.min(devicePixelRatio, 1), min: 0.7, bloom: false, post: false, grass: 0.22, flowers: 0.25, shadow: 512, shadowBox: 22, soft: false, near: 40, far: 700, fogFar: 520, ambient: false },
  medium: { scale: Math.min(devicePixelRatio, 1.5), min: 0.9, bloom: false, post: false, grass: 0.5, flowers: 0.5, shadow: 1024, shadowBox: 32, soft: false, near: 70, far: 3000, fogFar: 1150, ambient: true },
  high:   { scale: Math.min(devicePixelRatio, 2), min: 1, bloom: true, post: true, grass: 1, flowers: 1, shadow: 2048, shadowBox: 36, soft: true, near: 130, far: 3000, fogFar: 1150, ambient: true },
};
function setQuality(level) {
  if (level === true) level = 'high'; if (level === false) level = 'medium';
  const Q2 = PRESETS[level]; GFX.level = level; GFX.high = level === 'high'; GFX.post = Q2.post; GFX.near = Q2.near; GFX.min = Q2.min;
  bloom.enabled = Q2.bloom;
  if (GFX.grass) GFX.grass.count = Math.floor(GFX.grassMax * Q2.grass);
  if (GFX.flowers) GFX.flowers.forEach((f) => (f.count = Math.floor(f.userData.max * Q2.flowers)));
  renderer.shadowMap.type = Q2.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  sun.shadow.mapSize.set(Q2.shadow, Q2.shadow); Object.assign(sun.shadow.camera, { left: -Q2.shadowBox, right: Q2.shadowBox, top: Q2.shadowBox, bottom: -Q2.shadowBox }); sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.map?.dispose(); sun.shadow.map = null;
  camera.far = Q2.far; camera.updateProjectionMatrix(); GFX.fogFar = Q2.fogFar; skyDome.scale.setScalar(Q2.far < 2500 ? 0.27 : 1);
  pollen.visible = Q2.ambient; birds.forEach((b) => (b.visible = Q2.ambient));
  document.getElementById('vig')?.classList.toggle('hidden', !!Q2.post);
  GFX.base = Q2.scale; GFX.scale = Q2.scale; renderer.setPixelRatio(GFX.scale); renderer.setSize(innerWidth, innerHeight); composer.setPixelRatio(GFX.scale); composer.setSize(innerWidth, innerHeight);
  updatePropLOD();
  const gb = document.getElementById('gfxBtn'); if (gb) gb.textContent = `Graphics: ${level[0].toUpperCase() + level.slice(1)}`;
}
document.getElementById('gfxBtn')?.addEventListener('click', () => setQuality({ low: 'medium', medium: 'high', high: 'low' }[GFX.level]));
setQuality('medium');
// Adaptive resolution: keeps Low (and Medium) near 60 fps by scaling the render resolution; auto-drops to Low if Medium struggles
const FPS = { frames: 0, t: 0, fps: 60, lowStreak: 0 };
function trackFps(dt) {
  FPS.frames++; FPS.t += dt; if (FPS.t < 1) return;
  FPS.fps = FPS.frames / FPS.t; FPS.frames = 0; FPS.t = 0;
  if (!S.running || S.paused || S.cine || GFX.level === 'high') return;
  // hysteresis: drop after 2 slow seconds in a row, climb back only after 5 smooth ones, so resolution never pumps
  FPS.slow = FPS.fps < 50 ? (FPS.slow || 0) + 1 : 0; FPS.fast = FPS.fps > 58 ? (FPS.fast || 0) + 1 : 0;
  let s2 = GFX.scale;
  if (FPS.slow >= 2) { s2 = Math.max(GFX.min, s2 - 0.1); FPS.slow = 0; }
  else if (FPS.fast >= 5 && s2 < GFX.base) { s2 = Math.min(GFX.base, s2 + 0.05); FPS.fast = 0; }
  if (Math.abs(s2 - GFX.scale) > 0.001) { GFX.scale = s2; renderer.setPixelRatio(s2); renderer.setSize(innerWidth, innerHeight); composer.setPixelRatio(s2); composer.setSize(innerWidth, innerHeight); }
  if (GFX.level === 'medium' && FPS.fps < 38 && GFX.scale <= GFX.min) { if (++FPS.lowStreak >= 4) { setQuality('low'); toast('Switched to Low graphics for smoother play (change it in the pause menu)'); } } else FPS.lowStreak = 0;
}
const clock = new THREE.Clock();
let hudT = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (S.running && !S.paused) {
    const frozen = inDialog() || menuOpen() || !!S.cine;
    if (!S.sailing && (!frozen || S.cine)) updatePlayer(dt);
    if (!frozen || S.cine || talkCam.on) { updateWorld(dt, t); if (!S.cine) for (const c of creatures) updateCreature(c, dt); }
    if (S.sailing) {
      const rp = raftGroup.position, fx = Math.sin(boatYaw), fz = Math.cos(boatYaw); camera.position.lerp(new THREE.Vector3(rp.x - fx * 14 - fz * 8, 6, rp.z - fz * 14 + fx * 8), dt); camera.lookAt(rp.x + fx * 20, 2, rp.z + fz * 20);
    } else if (S.cine) updateCine(dt); else if (talkCam.on) { updateTalkCam(dt); if (hero.native) animateHero(dt, 0); else if (hero.rig && !talkCam.fixed) poseHero(0, 0, 0, t); } else updateCamera(dt);
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
      else if (nearestFire(player.position, 4)) { $('prompt').classList.remove('hidden'); $('prompt').innerHTML = '<kbd>R</kbd> Hold to rest by the fire'; }
    }
    checkQuest();
    const q = Q[S.questIdx], target = q && q.target();
    const qm = updateQuestMarkers(t);
    waypoint.visible = !!target && !S.sailing && !qm.some((m) => m.pos.distanceTo(target) < 3);
    if (target) { waypoint.position.set(target.x, target.y + 3.2 + Math.sin(t * 3) * 0.2, target.z); waypoint.rotation.y = t * 2; }
    hudT -= dt; if (hudT <= 0) { hudT = 0.1; renderHUD(); renderQuest(); drawMinimap(target); }
  } else if (!S.running) {
    // Title screen flyover
    const a = t * 0.025 + 0.6; camera.position.set(Math.sin(a) * (300 + Math.sin(t * 0.05) * 40), 95 + Math.sin(t * 0.07) * 25, Math.cos(a) * (300 + Math.sin(t * 0.05) * 40)); camera.lookAt(30, 22, -50);
    S.time = 0.73; updateWorld(0, t); S.time = 0.3;
  }
  if (++cullFrame % 12 === 1) {                 // distance culling a few times a second (first pass on frame 1)
    updatePropLOD();
    const cx = camera.position.x, cz = camera.position.z;
    for (const pk of pickups) if (pk.alive) pk.obj.visible = Math.abs(pk.pos.x - cx) + Math.abs(pk.pos.z - cz) < 90;
    { const near = Math.hypot(CAVE.x - cx, CAVE.z - cz) < 70; for (const o of caveInner) o.visible = near; }
    for (const c of creatures) c.obj.visible = S.running && !S.cine && Math.abs(c.obj.position.x - cx) + Math.abs(c.obj.position.z - cz) < (c.type === 'fox' ? 80 : 140);
  }
  ambientSound(dt); updateLightPool();
  renderer.shadowMap.needsUpdate = true;
  renderer.info.reset(); trackFps(dt);
  if (GFX.post) composer.render(); else renderer.render(scene, camera);
}
let cullFrame = 0, shadowTick = 0;
// ---- Save / load (browser storage). The world is generated from a fixed seed, so pickups, trees, rocks and
//      creatures are saved by index: what you picked up, felled or killed stays that way.
const SAVE_KEY = 'argonisos.save.v2'   // v2: new world layout (animal pack, paddock); v1 saves no longer line up, INIT_CREATURES = creatures.length;
const SAVE_FIELDS = ['questIdx', 'inv', 'tools', 'slot', 'day', 'time', 'hp', 'food', 'sta', 'energy', 'talkedNestor', 'oliveBranch', 'offered', 'reported', 'raftBuilt', 'kills', 'cooked', 'nights', 'nightsAtStart', 'warnedOnce', 'warnDay'];
function saveGame(manual) {
  if (!S.running || S.explore || S.sailing) { if (manual) toast('Nothing to save here.'); return; }
  try {
    const d = { v: 1, at: Date.now(), S: {}, pos: player.position.toArray(), yaw: P.yaw,
      pick: pickups.map((p) => (p.alive ? 1 : 0)).join(''), bush: pickups.map((p, i) => (p.kind === 'bush' && p.regrow > 0 ? i : -1)).filter((i) => i >= 0),
      res: resources.map((r) => (r.alive ? 1 : 0)).join(''), dead: creatures.slice(0, INIT_CREATURES).map((c) => (c.dead ? 1 : 0)).join(''),
      fire: S.campfire ? S.campfire.pos.toArray() : null, fog: mmFog.toDataURL('image/png') };
    for (const k of SAVE_FIELDS) d.S[k] = S[k];
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    toast(manual ? 'Game saved.' : 'Autosaved', !!manual); updateContinueBtn();
  } catch (e) { if (manual) toast('Could not save (browser storage is blocked).'); }
}
function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; } }
function loadGame(d) {
  for (const k of SAVE_FIELDS) if (d.S[k] !== undefined) S[k] = typeof d.S[k] === 'object' && d.S[k] ? JSON.parse(JSON.stringify(d.S[k])) : d.S[k];
  S.kills = { rabbit: 0, boar: 0, wolf: 0, skeleton: 0, deer: 0, stag: 0, fox: 0, bull: 0, ...S.kills };
  pickups.forEach((p, i) => { if (d.pick[i] === '0' && p.alive) { p.alive = false; scene.remove(p.obj); } });
  for (const i of d.bush || []) { const p = pickups[i]; if (p) { p.regrow = 60; p.obj.userData.berries.visible = false; } }
  resources.forEach((r, i) => { if (d.res[i] === '0' && r.alive) { r.alive = false; updateProp(r.item, true); } });
  creatures.slice(0, INIT_CREATURES).forEach((c, i) => { if (d.dead[i] === '1' && !c.dead) { c.dead = true; c.gone = true; scene.remove(c.obj); } });
  if (d.fire) { const fp = new THREE.Vector3().fromArray(d.fire); const save = player.position.clone(), sy = P.yaw; player.position.copy(fp).add(new THREE.Vector3(0, 0, -2)); P.yaw = 0; placeCampfire(); player.position.copy(save); P.yaw = sy; }
  if (S.raftBuilt) { wreckGroup.visible = false; raftParts.forEach((p) => (p.visible = true)); }
  if (d.fog) { const im = new Image(); im.onload = () => { const c = mmFog.getContext('2d'); c.clearRect(0, 0, MAPN, MAPN); c.drawImage(im, 0, 0); }; im.src = d.fog; }
  player.position.fromArray(d.pos); P.yaw = d.yaw || 0; player.rotation.y = P.yaw; camYaw = P.yaw + Math.PI; camTgtInit = false;
  S.wasNight = isNight(); S.region = null; questSig = '';
}
function updateContinueBtn() { const d = readSave(), b = $('continueBtn'); if (!b) return; b.style.display = d && !S.running ? '' : 'none';
  if (d) b.innerHTML = `Continue <small style="display:block;font-size:12px;opacity:.75">Day ${d.S.day} · ${Q[d.S.questIdx]?.title || 'Trial complete'}</small>`; }
$('continueBtn').onclick = () => {
  const d = readSave(); if (!d) return; initAudio();
  loadGame(d);
  $('title').classList.add('fading'); setTimeout(() => { $('title').classList.add('hidden'); $('title').classList.remove('fading'); }, 1600);
  S.running = true; S.started = performance.now(); setPause(false); $('hud').classList.remove('hidden'); updateContinueBtn(); $('startBtn').textContent = 'Continue';
  canvas.requestPointerLock(); toast(`Welcome back. Day ${S.day}.`, true);
};
$('saveBtn').onclick = () => { saveGame(true); };
// ---- Fullscreen. While fullscreen the Escape key is captured (Keyboard Lock), so a tap still opens the pause menu
//      and you HOLD Esc to leave fullscreen (Chrome/Edge do the hold natively; this handles the rest).
//      Browsers without Keyboard Lock (Safari, Firefox, or the game inside an embedded frame) always drop fullscreen
//      on Esc. There we remember that you want fullscreen and restore it on your next click or key press.
let wantFs = false;
async function enterFs() { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); try { await navigator.keyboard?.lock?.(['Escape']); } catch {} }
function leaveFs() { wantFs = false; navigator.keyboard?.unlock?.(); if (document.fullscreenElement) document.exitFullscreen(); }
const restoreFs = (e) => { if (!wantFs || document.fullscreenElement || e.code === 'Escape') return; enterFs().catch(() => {}); };
addEventListener('pointerdown', restoreFs, true); addEventListener('keydown', restoreFs, true);
async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) { await enterFs(); wantFs = true; }
    else leaveFs();
    syncFsBtn();
  } catch { toast('Fullscreen is not allowed here. Open the game in its own tab to use it.'); }
}
function syncFsBtn() { const on = !!document.fullscreenElement; $('fsBtn').textContent = `Fullscreen: ${on ? 'On' : 'Off'}`; $('fsBtn2').textContent = on ? 'Exit Fullscreen' : 'Fullscreen'; }
$('fsBtn').onclick = toggleFullscreen; $('fsBtn2').onclick = toggleFullscreen;
document.addEventListener('fullscreenchange', () => { syncFsBtn(); if (document.fullscreenElement) toast('Fullscreen · press <b>P</b> to pause, hold <b>Esc</b> to leave', true); else navigator.keyboard?.unlock?.(); });
let escDownAt = 0, escTimer = null;
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || e.repeat || !wantFs) return;
  escDownAt = performance.now(); clearTimeout(escTimer);
  escTimer = setTimeout(() => { if (escDownAt) { leaveFs(); toast('Left fullscreen'); } }, 2000);   // held 2 s
  if (locked) document.exitPointerLock();          // a tap behaves like normal: release the mouse, open the pause menu
});
addEventListener('keyup', (e) => { if (e.code === 'Escape') { escDownAt = 0; clearTimeout(escTimer); } });
syncFsBtn();
updateContinueBtn();
// ---- Light pool: three.js shades every pixel for every light in the scene, so ~16 torches and braziers were costing
//      everywhere. Instead each source becomes an 'emitter' and 4 real point lights hop to the nearest ones.
//      The light count never changes, so no shader recompiles either.
const EMITTERS = [], LIGHT_POOL = [];
function addEmitter(src, pos) { EMITTERS.push({ src, pos: pos.clone() }); }
function removeEmitter(src) { const i = EMITTERS.findIndex((e) => e.src === src); if (i >= 0) EMITTERS.splice(i, 1); }
{
  scene.updateMatrixWorld(true); const found = [];
  scene.traverse((o) => { if (o.isPointLight) found.push(o); });
  for (const L of found) { addEmitter(L, L.getWorldPosition(new THREE.Vector3())); if (!L.userData.dyn) L.parent.remove(L); }
  divineLight.visible = false;
  for (let i = 0; i < 5; i++) { const L = new THREE.PointLight(0xffffff, 0, 10, 1.5); LIGHT_POOL.push(L); scene.add(L); }
}
// Nestor's hearth: a stone fire pit in his courtyard with log benches. Always burning; you can sleep here.
const HEARTH = hutW(-2.4, 8.2); HEARTH.y = heightAt(HEARTH.x, HEARTH.z);
{ const hf = makeFire(HEARTH, true); hf.name = "Nestor's hearth";
  for (const a of [0.5, 2.3, 4.1]) { const lg = mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.8, 7), trunkMat, HEARTH.x + Math.cos(a) * 2.3, HEARTH.y + 0.22, HEARTH.z + Math.sin(a) * 2.3); lg.rotation.set(0, -a, Math.PI / 2); } }
const _lp = [];
function updateLightPool() {
  const c = S.running && !S.cine ? player.position : camera.position; _lp.length = 0;
  for (const e of EMITTERS) { const src = e.src, p = src.userData.dyn ? src.position : e.pos, inten = src.intensity;
    if (inten <= 0.01) continue; const d = c.distanceTo(p); if (d > src.distance + 20) continue; _lp.push([d, e, p, inten]); }
  _lp.sort((a, b) => a[0] - b[0]);
  LIGHT_POOL.forEach((L, i) => { const it = _lp[i]; if (!it) { L.intensity = 0; return; } const [, e, p, inten] = it;
    L.position.copy(p); L.color.copy(e.src.color); L.distance = e.src.distance; L.decay = e.src.decay; L.intensity = inten; });
}
// Fire: every brazier cone becomes an additive flame with a hot core and a soft glow, so it reads as fire in daylight too
{ const outer = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }),
    core = new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const fl of braziers) { fl.material = outer; fl.castShadow = false; const p = fl.geometry.parameters, c = new THREE.Mesh(new THREE.ConeGeometry(p.radius * 0.5, p.height * 0.6, 7), core); c.position.y = -p.height * 0.15; fl.add(c);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff9a40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(p.height * 3.2); fl.parent.add(gl); gl.position.copy(fl.position); fl.userData.glow = gl; } }
renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
function ambientSound(dt) {
  const p = S.running ? player.position : camera.position, h = S.time * 24, g = heightAt(p.x, p.z);
  const day = clamp(Math.min(h - 5.5, 19.5 - h) / 1.2, 0, 1), r = Math.hypot(p.x, p.z * 1.05) / ISLAND_R;
  let fire = 0; for (const f of [...FIRES.map((x) => x.pos), ...braziers.map((b) => b.getWorldPosition(_v3))]) fire = Math.max(fire, 1 - p.distanceTo(f) / 14);
  updateAmbience({ day, alt: clamp((p.y - 25) / 70, 0, 1), shore: clamp((r - 0.7) / 0.22, 0, 1) * (S.running ? 1 : 0.5), water: clamp(1 - Math.hypot(p.x - LAKE.x, p.z - LAKE.z) / 55, 0, 1),
    fire, cave: S.running && inCaveInterior(p.x, p.z) && p.y < CAVE_Y + 5, forest: regionAt(p.x, p.z, g).key === 'forest' ? 1 : 0.35, title: !S.running, cine: !!S.cine,
    wolves: creatures.some((c) => c.type === 'wolf' && !c.dead && Math.abs(c.obj.position.x - p.x) + Math.abs(c.obj.position.z - p.z) < 120) }, dt);
}
const _v3 = new THREE.Vector3();
addEventListener('pointerdown', initAudio); addEventListener('keydown', initAudio);
for (const [id, k] of [['volMaster', 'master'], ['volMusic', 'music'], ['volSfx', 'sfx']]) { const el = $(id); if (el) { el.value = VOL[k] * 100; el.oninput = () => setVolume(k, el.value / 100); } }
loop();

// ============================================================
// Title screen wiring
// ============================================================
document.querySelectorAll('.tabs button[data-tab]').forEach((b) => b.onclick = () => {
  const same = b.classList.contains('on');
  document.querySelectorAll('.tabs button[data-tab]').forEach((x) => x.classList.toggle('on', x === b && !same));
  document.querySelectorAll('.tabpage').forEach((p) => p.classList.toggle('hidden', same || p.id !== b.dataset.tab));
  $('menuPage').classList.toggle('hidden', same);
});
document.querySelectorAll('.gallery img').forEach((img) => img.onclick = () => { $('lightbox').querySelector('img').src = img.src; $('lightbox').classList.remove('hidden'); });
$('lightbox').onclick = () => $('lightbox').classList.add('hidden');
function travelTo(x, z, look) {
  const y = Math.max(heightAt(x, z), floorAt(new THREE.Vector3(x, 999, z)), 0);
  player.position.set(x, y + (P.fly ? 12 : 0.3), z); P.vel.y = 0; if (look !== undefined) camYaw = look;
  revealMap(x, z, 80);
}
function syncExplore() {
  const h = Math.floor(S.time * 24), m = Math.floor((S.time * 24 - h) * 60);
  $('exTime').value = Math.round(S.time * 96); $('exTimeN').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  $('exFly').textContent = P.fly ? 'Flying (V)' : 'Walking (V)'; $('exLock').textContent = S.timeLock ? 'Time: frozen' : 'Time: running';
}
{
  const spots = [['Nestor\'s Cove', () => [START.x, START.z]], ...REGIONS.map((R) => [R.name, () => (R.key === 'cave' ? [CAVE_APPROACH.x, CAVE_APPROACH.z] : R.key === 'temple' ? [TEMPLE.x, TEMPLE.z + 28] : R.key === 'mountain' ? [MOUNT.x, MOUNT.z + 40] : R.key === 'tower' ? [TOWER.x + 8, TOWER.z + 10] : [R.c.x, R.c.z + 10])])];
  $('exList').innerHTML = spots.map(([n], i) => `<button class="btn" data-go="${i}">${n}</button>`).join('');
  $('exList').onclick = (e) => { const b = e.target.closest('[data-go]'); if (!b) return; const [x, z] = spots[+b.dataset.go][1](); travelTo(x, z, 0); openMenu('explorePanel'); };
  $('exTime').oninput = () => { S.time = $('exTime').value / 96; S.timeLock = true; syncExplore(); };
  $('exLock').onclick = () => { S.timeLock = !S.timeLock; syncExplore(); };
  $('exFly').onclick = () => { P.fly = !P.fly; if (P.fly) player.position.y += 10; syncExplore(); };
  $('exHud').onclick = () => $('hud').classList.toggle('hidden');
  $('exMap').onclick = () => { revealMap(0, 0, 700); toast('Whole map revealed'); };
}
$('exploreBtn').onclick = () => {
  initAudio();
  S.explore = true; Object.assign(S.tools, { axe: true, spear: true });
  $('quest').classList.add('hidden'); $('hints').innerHTML = '<span>Fly / walk</span><span class="kbd">V</span><span>Travel &amp; time</span><span class="kbd">O</span><span>Time of day</span><span class="kbd">[ ]</span><span>Hide HUD</span><span class="kbd">H</span><span>Map</span><span class="kbd">M</span><span>Fast</span><span class="kbd">SHIFT</span>';
  $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
  S.running = true; S.started = performance.now(); setPause(false); canvas.requestPointerLock();
  S.time = 0.4; S.timeLock = true; P.fly = true; travelTo(START.x, START.z, P.yaw + Math.PI);
  syncExplore(); toast('Explore mode: no enemies, no hunger. Press O for travel and time of day', true);
};
// ---- Intro cinematic: the menu fades, the camera leaves the title orbit and flies over Nisos while the story is told,
//      then comes down to the cove where Zeus delivers you in a column of light.
const CINE_LINES = [
  [1.5, 8.0, '<small>Argonisos</small>Hera has finally slain Hercules.'],
  [10.0, 17.0, 'Mourning his son, Zeus shaped a world between the earth and the sky, where mortals can prove themselves worthy of his strength.'],
  [19.0, 25.5, '<small>Nine lands · Nine Guardians</small>Defeat each Guardian and ascend to Olympos with the power of a demigod.'],
  [27.5, 33.5, '<small>The chosen</small>You are one of the chosen. The sea brought you to Nisos, and broke your boat on its shore.'],
  [35.5, 40.5, 'Your trial begins here. Find Nestor.'],
];
function playIntro() {
  S.cine = { t: 0, dur: 42, line: -1 }; $('cine').classList.add('intro');
  $('cine').classList.remove('hidden'); requestAnimationFrame(() => $('cine').classList.add('on'));
  $('hud').classList.add('hidden'); S.time = 0.285;
  // final pose: exactly where the gameplay camera will sit
  camYaw = P.yaw + Math.PI; camPitch = 0.28; const save = camera.position.clone(); camera.position.copy(player.position).add(new THREE.Vector3(0, 4, 7)); updateCamera(1);
  const endPos = camera.position.clone(), endLook = player.position.clone().add(new THREE.Vector3(0, 1.7, 0)); camera.position.copy(save);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // One long, calm approach from far out at sea: high and wide over the water, the island growing on the horizon,
  // sinking low over the waves, in through the channel, and settling on the cove where your boat lies wrecked
  const dir = new THREE.Vector3(SEA_OUT.x - DOCK.x, 0, SEA_OUT.z - DOCK.z).normalize(), far = (d, y, side = 0) => V(SEA_OUT.x + dir.x * d - dir.z * side, y, SEA_OUT.z + dir.z * d + dir.x * side);
  camera.position.copy(far(760, 300, -620));
  S.cine.pos = new THREE.CatmullRomCurve3([far(760, 300, -620), far(540, 210, -430), far(340, 120, -220), far(170, 45, -60), far(60, 14, 0), far(10, 7, 0),
    V(DOCK.x + dir.x * 12, 6, DOCK.z + dir.z * 12), endPos], false, 'centripetal');
  S.cine.look = new THREE.CatmullRomCurve3([V(MOUNT.x, SUMMIT_Y * 0.6, MOUNT.z), V(40, 30, -40), V(20, 18, 20), V(DOCK.x, 6, DOCK.z - 30), V(HUT.x, HUT.y + 3, HUT.z),
    WRECK.clone().setY(1), endLook.clone(), endLook], false, 'centripetal');
  snd.whoosh();
}
function updateCine(dt) {
  const C = S.cine; C.t += dt;
  const u = clamp(C.t / C.dur, 0, 1), e = 1 - Math.pow(1 - u, 2.2);                    // ease-out: steady glide in, slow settle at the end
  camera.position.copy(C.pos.getPointAt(e)); camera.lookAt(C.look.getPoint(e));
  camera.fov = 60 - (1 - e) * 12; camera.updateProjectionMatrix();                          // long lens far out, opening up as we arrive
  const li = CINE_LINES.findIndex(([a, b]) => C.t >= a && C.t < b);
  if (li !== C.line) { C.line = li; const el = $('cineText'); el.classList.remove('show'); if (li >= 0) setTimeout(() => { el.innerHTML = CINE_LINES[li][2]; el.classList.add('show'); }, li === 0 ? 0 : 500); }
  if (C.t >= C.dur) endIntro();
}
function endIntro() {
  if (!S.cine) return; S.cine = null; $('cine').classList.remove('intro'); camera.fov = 60; camera.updateProjectionMatrix();
  camera.position.copy(player.position).add(new THREE.Vector3(0, 4, 7)); updateCamera(1);
  $('cineText').classList.remove('show'); $('cine').classList.remove('on'); setTimeout(() => $('cine').classList.add('hidden'), 1400);
  player.visible = true;
  setTimeout(() => { $('hud').classList.remove('hidden'); questCard(Q[0]); }, 900);
}
$('cineSkip').onclick = () => endIntro();
$('startBtn').onclick = () => {
  const first = !S.running;
  // confirm() is blocked inside the sandboxed artifact frame, so confirm with a second click instead
  const btn = $('startBtn');
  if (first && readSave() && !btn.dataset.armed) {
    btn.dataset.armed = '1'; btn.innerHTML = 'Start over? <small style="display:block;font-size:12px;opacity:.75">Click again. Your save is replaced at the next save.</small>';
    setTimeout(() => { delete btn.dataset.armed; if (!S.running) btn.textContent = 'New Game'; }, 8000); return;
  }
  delete btn.dataset.armed;
  if (first) {
    initAudio(); $('title').classList.add('fading'); setTimeout(() => { $('title').classList.add('hidden'); $('title').classList.remove('fading'); }, 1600);
    S.running = true; S.started = performance.now(); setPause(false); playIntro(); return;
  }
  $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
  S.running = true; setPause(false); canvas.requestPointerLock();
};
renderer.info.autoReset = false;
window.ARG = { gp: () => ({ PROPS, PROP_CHUNKS, LO_GROUPS, renderer, composer, sun, GFX, scene, leafMat, propMat, camera }), prof: () => { const T = {}, time = (k, f, n = 20) => { const t0 = performance.now(); for (let i = 0; i < n; i++) f(); T[k] = +((performance.now() - t0) / n).toFixed(3); }; time("updateWorld", () => updateWorld(0.016, performance.now() / 1000)); time("creatures", () => { for (const c of creatures) updateCreature(c, 0.016); }); time("lightPool", updateLightPool); time("propLOD", updatePropLOD); time("minimap", () => drawMinimap(null)); time("hud", renderHUD); time("quest", renderQuest); time("interact", getInteractable); time("player", () => updatePlayer(0.016)); return T; }, sleep: (h) => sleep(h), backAxe, BENCH_: null, OLIVE, HEARTH, moonDir, sky: skyDome, fire: () => placeCampfire(), setTime: (v) => { S.time = v; }, talkT: (v) => { talkCam.t = v; }, THREE, pickups, dbgLoop: () => ({ cullFrame, shadowTick }), cine: (tt) => { if (S.cine) { S.cine.t = tt; updateCine(0); } }, endIntro: () => endIntro(), nestor, talk: () => talkNestor(), offer: () => makeOffering(), Q, skeletons, creatures, PROPS, arrows, shoot: () => shootArrow(), census: () => { const out = {}; const cam = camera; const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); scene.traverseVisible((o) => { if (!(o.isMesh || o.isPoints || o.isSprite)) return; if (o.frustumCulled && o.geometry && !o.isInstancedMesh) { o.geometry.boundingSphere || o.geometry.computeBoundingSphere(); const sp = o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld); if (!fr.intersectsSphere(sp)) return; } let top = o; while (top.parent && top.parent !== scene) top = top.parent; const k = (o.isInstancedMesh ? "inst:" : "") + (top.name || top.type) + (top.userData.tag ? ":" + top.userData.tag : ""); const t = (o.geometry?.index ? o.geometry.index.count : o.geometry?.attributes.position.count || 0) / 3 * (o.isInstancedMesh ? o.count : 1); out[k] = out[k] || [0, 0]; out[k][0]++; out[k][1] += Math.round(t); }); return Object.entries(out).sort((a, b) => b[1][0] - a[1][0]).slice(0, 18); }, setQ: (l) => setQuality(l), CAVE_MOUTH, CAVE_DIR, world: (t) => { updateWorld(0.016, t); updatePropLOD(); updateLightPool(); const cx = camera.position.x, cz = camera.position.z; for (const c of creatures) c.obj.visible = Math.abs(c.obj.position.x - cx) + Math.abs(c.obj.position.z - cz) < 190; for (const pk of pickups) if (pk.alive) pk.obj.visible = Math.abs(pk.pos.x - cx) + Math.abs(pk.pos.z - cz) < 90; }, info: () => { const i = renderer.info.render; return { calls: i.calls, tris: i.triangles }; }, SUMMIT, CAVE, HUT, BENCH, START, WRECK, DOCK, SEA_OUT, ASCENT, MOUNT, ARENA_R, LAKE, SWAMP, TEMPLE, floorH: (x, z) => Math.max(heightAt(x, z), floorAt(new THREE.Vector3(x, 999, z))) + 0.1, S, player, hero, HA, animateHero, poseHero, P, tools, camera, RUN, SPRINT, JUMP, ATTACK, PUNCH, EQUIP, DISARM, applyRun, applyClipAt, look: (y, pch) => { camYaw = y; if (pch !== undefined) camPitch = pch; }, snap: (cam = true) => { if (cam) updateCamera(1); renderer.shadowMap.needsUpdate = true; renderer.info.reset(); if (GFX.post) composer.render(); else renderer.render(scene, camera); return renderer.domElement.toDataURL("image/jpeg", 0.85); } };  // console access for playtesting
