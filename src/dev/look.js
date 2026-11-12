// The asset browser's stage: the game's renderer settings, its midday light and an empty grass field, so a pack model
// looks here as it will in the world. Copied rather than imported: core.js and sky.js build the game's whole scene
// (composer, sky dome, clouds, the time of day) the moment they load, and the page only wants their noon.
import * as THREE from 'three';
import { Sky } from '../../vendor/three/jsm/objects/Sky.js';
import { GLTFLoader } from '../../vendor/three/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '../../vendor/three/jsm/utils/SkeletonUtils.js';
import { loadGLB } from '../assets.js';

// core.js's tone mapping, with the meadows' grade from the atmosphere pass (white balance, saturation, the shadows' tint)
// put in front of it, since the page renders straight to the screen without that pass
THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace('vec3 CustomToneMapping( vec3 color ) { return color; }',
  `vec3 CustomToneMapping( vec3 color ) {
    color *= vec3(1.04, 1.0, 0.93); float g = dot(color, vec3(0.2126, 0.7152, 0.0722)); color = max(mix(vec3(g), color, 1.08), 0.0);
    color += vec3(0.02, 0.0, -0.02) * (1.0 - smoothstep(0.0, 0.35, g)) * 0.06;
    float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = max(mix(vec3(l), color, 1.12) * vec3(1.04, 1.0, 0.93) + (1.0 - smoothstep(0.0, 0.5, l)) * vec3(-0.012, 0.01, 0.03), 0.0);
    return AgXToneMapping(color * 1.15); }`);

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.CustomToneMapping; renderer.toneMappingExposure = 0.84; renderer.outputColorSpace = THREE.SRGBColorSpace;   // (0.84: what sky.js sets in full daylight, over core.js's 0.95)
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xa9cfe8, 700, 3600);   // (the game's day fog colour, kept far off: here it only softens the horizon)
export const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 8000);
addEventListener('resize', () => fitView());

// Midday as sky.js leaves it: the sun's colour and strength, the hemisphere light and the sky's light in reflections.
// The sun stands a little lower than the game's noon (which is nearly overhead) so shapes read from their shading.
const SUN_DIR = new THREE.Vector3(0.55, 1, 0.42).normalize();
export const hemi = new THREE.HemisphereLight(0xbfdcff, 0x3f6a5a, 0.67); scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffe2b0, 3.05);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
scene.add(sun, sun.target);
// The shadow box follows what you look at, and grows when you step back to see a big model or a whole row
export function aimSun(target, dist) {
  const r = THREE.MathUtils.clamp(dist * 0.9, 12, 400), c = sun.shadow.camera;
  if (Math.abs(c.right - r) > r * 0.1) { Object.assign(c, { left: -r, right: r, top: r, bottom: -r, near: 1, far: r * 6 + 200 }); c.updateProjectionMatrix(); }
  const step = r / 50; sun.target.position.set(Math.round(target.x / step) * step, 0, Math.round(target.z / step) * step);   // (stepped, so shadow edges don't crawl as you pan)
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, r * 3 + 100);
}

// The sky: the game's dome colours at noon in a plain gradient, and the physical sky that lights reflections (as sky.js)
const dome = new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x3a78c8) }, hor: { value: new THREE.Color(0xb8dcf0) } },
  vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top, hor; varying vec3 vDir;
    void main() { gl_FragColor = vec4(mix(hor, top, pow(smoothstep(0.0, 0.85, max(vDir.y, 0.0)), 0.6)), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
dome.renderOrder = -1; dome.frustumCulled = false; scene.add(dome);
{ const sky = new Sky(), U = sky.material.uniforms; U.turbidity.value = 1.8; U.rayleigh.value = 3.0; U.mieCoefficient.value = 0.004; U.mieDirectionalG.value = 0.85; U.sunPosition.value.copy(SUN_DIR);
  sky.scale.setScalar(1000); const env = new THREE.Scene(); env.add(sky); scene.environment = new THREE.PMREMGenerator(renderer).fromScene(env, 0.04).texture; scene.environmentIntensity = 1; }

// The empty map: flat meadow grass (gen.js's two meadow greens in a soft tiling noise, under the terrain's roughness and
// reflection strength), and a 1 m / 10 m grid over it for judging sizes.
const grassTex = (() => {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), img = g.createImageData(N, N);
  const a = new THREE.Color(0x5b8a32), b = new THREE.Color(0x6f9a3a), d = new THREE.Color(0x4f7a2c); let s = 7; const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const cells = (k) => { const v = []; for (let i = 0; i < k * k; i++) v.push(r()); return (x, y) => { const fx = x * k / N, fy = y * k / N, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, at = (i, j) => v[((j % k + k) % k) * k + ((i % k + k) % k)];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); return (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy; }; };   // (tiling value noise: wraps at the edge)
  const n1 = cells(4), n2 = cells(16), n3 = cells(64), col = new THREE.Color(), rgb = {};
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = n1(x, y) * 0.5 + n2(x, y) * 0.3 + n3(x, y) * 0.2; col.copy(a).lerp(b, THREE.MathUtils.smoothstep(k, 0.35, 0.7)).lerp(d, THREE.MathUtils.smoothstep(n3(x, y), 0.6, 0.95) * 0.5);
    col.getRGB(rgb, THREE.SRGBColorSpace); const o = (y * N + x) * 4; img.data[o] = rgb.r * 255; img.data[o + 1] = rgb.g * 255; img.data[o + 2] = rgb.b * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1000, 1000); t.anisotropy = 8; return t;
})();
export const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95, envMapIntensity: 0.4 }));
ground.receiveShadow = true; scene.add(ground);
// (drawn in a shader on a plane over the ground: lines a pixel wide at any distance, each grid fading out before its lines
// crowd into a shimmer; the plane moves with the view in whole 10 m steps, so the lines stay on the metre)
export const grid = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  vertexShader: 'varying vec2 vP; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `varying vec2 vP;
    float lines(float s) { vec2 c = vP / s, w = fwidth(c), g = abs(fract(c - 0.5) - 0.5) / w; return (1.0 - min(min(g.x, g.y), 1.0)) * (1.0 - smoothstep(0.12, 0.35, max(w.x, w.y))); }
    void main() { float a = lines(1.0) * 0.22, b = lines(10.0) * 0.42;
      gl_FragColor = vec4(mix(vec3(0.07, 0.11, 0.04), vec3(0.96, 0.93, 0.84), b / max(a + b, 1e-4)), max(a, b)); }`,
}));
grid.position.y = 0.004; grid.renderOrder = 1; scene.add(grid);
export function followGrid(target) { grid.position.set(Math.round(target.x / 10) * 10, 0.004, Math.round(target.z / 10) * 10); }

// The panels cover the left of the window: the picture's centre moves over to the middle of what's left (a view offset,
// so the camera aims at the middle of the free part and clicks still land where they should)
let inset = 0;
export function fitView(px = inset) {
  inset = px; const W = innerWidth, H = innerHeight; renderer.setSize(W, H);
  camera.aspect = (W + inset) / H; camera.setViewOffset(W + inset, H, 0, 0, W, H); camera.updateProjectionMatrix();
}
export const freeAspect = () => (innerWidth - inset) / innerHeight;

// A model as the game shows it. site-pack.js's rule for the pack's props: standard materials, the atlas under a grey of
// 0xb4b4b4 (the palettes come out bright in our light), plain colours at 80%, rough and not metallic. Shared by what they
// show, so a gallery of a few hundred models has a few dozen materials, and never disposed.
const looks = new Map();
function lookFor(src, vc) {
  const key = `${src.map ? src.map.uuid : src.color.getHexString()}|${vc}|${src.side}|${src.transparent}|${src.alphaTest}`;
  if (!looks.has(key)) looks.set(key, new THREE.MeshStandardMaterial({ map: src.map || null, color: src.map ? 0xb4b4b4 : src.color.clone().multiplyScalar(0.8), vertexColors: vc, roughness: 0.85, metalness: 0,
    side: src.side, transparent: src.transparent, opacity: src.opacity, alphaTest: src.alphaTest, depthWrite: src.depthWrite }));
  return looks.get(key);
}
export function gameLook(root) {
  root.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true; const vc = !!m.geometry.attributes.color && ![].concat(m.material).some((x) => x.map);   // (Synty's vertex colours on textured models are Unity's wind data, not colours)
    m.material = Array.isArray(m.material) ? m.material.map((x) => lookFor(x, vc)) : lookFor(m.material, vc);
  });
  return root;
}

// A model from the full export (assets/models/pack/all/<id>.glb). As assets.js loadPack, each material named tex:<key>
// gets the pack's atlas, but the file isn't kept once parsed: loadPack's cache keeps every file it has read, and a long
// browse through ~5,000 models would hold them all.
const URL_ROOT = new URL('../../assets/models/pack/', import.meta.url), gltf = new GLTFLoader(), texLoader = new THREE.TextureLoader(), atlases = {};
const atlas = (key) => (atlases[key] ||= (() => { const t = texLoader.load(new URL(`tex/${key}.webp`, URL_ROOT).href); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })());
// Textures cut out where they're clear (leaves, grass cards: the catalogue's cutout, key → threshold), shown from both sides
export const CUT = {};
export async function loadModel(id) {
  const gl = await gltf.loadAsync(new URL(`all/${id}.glb`, URL_ROOT).href);
  gl.scene.traverse((m) => { for (const mt of [].concat(m.material || [])) if (mt.name.startsWith('tex:')) { const k = mt.name.slice(4); mt.map = atlas(k); if (CUT[k] !== undefined) { mt.alphaTest = CUT[k]; mt.side = THREE.DoubleSide; } mt.needsUpdate = true; } });
  return gameLook(gl.scene);
}
export const copyModel = (root) => cloneSkinned(root);   // (rigged ones need their skeleton cloned with them)
// Geometry only: the materials are shared (above) and the atlases live for the page
export function disposeModel(root) { root.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); }

// The hero, for scale, as hero.js load() dresses him: 1.95 m tall, the pale palette under a grey, his own head, body,
// legs and hair, and none of the armour parts (wear_*). Each call gets its own copy of the one loaded.
let heroP = null;
export function hero() {
  heroP ||= loadGLB('pack/hero').then((gl) => {
    const obj = gl.scene; obj.updateMatrixWorld(true); let map = null; obj.traverse((m) => { if (m.isMesh && !map) map = m.material.map; });
    const mat = new THREE.MeshStandardMaterial({ map, color: 0xc4c4c4, roughness: 0.8, metalness: 0 });
    const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()); obj.scale.multiplyScalar(1.95 / size.y);
    obj.traverse((m) => { if (!m.isMesh) return; m.material = mat; m.castShadow = m.receiveShadow = true; m.frustumCulled = false; if (m.name.startsWith('wear_')) m.visible = false; });
    obj.updateMatrixWorld(true); obj.position.y -= new THREE.Box3().setFromObject(obj).min.y;   // (feet on the ground)
    return obj;
  }).catch(() => {   // (no pack: a plain figure of the same height)
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xe9e0cc, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.0, 4, 10), m); body.position.y = 0.95; const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), m); head.position.y = 1.72;
    for (const x of [body, head]) { x.castShadow = true; g.add(x); } return g;
  });
  return heroP.then((h) => { const c = cloneSkinned(h); c.userData.hero = true; return c; });
}

export function render() { dome.position.copy(camera.position); renderer.render(scene, camera); }
