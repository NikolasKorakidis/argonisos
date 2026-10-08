// Renderer, scene, camera, lights and post-processing. The colour grade (saturation, warm push, teal shadows) lives
// inside tone mapping, so every material runs it for free.
import * as THREE from 'three';
import { EffectComposer } from '../../jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../../jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../../jsm/postprocessing/ShaderPass.js';
import { OutputPass } from '../../jsm/postprocessing/OutputPass.js';
import { VignetteShader } from '../../jsm/shaders/VignetteShader.js';

THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace('vec3 CustomToneMapping( vec3 color ) { return color; }',
  `vec3 CustomToneMapping( vec3 color ) {
    float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = max(mix(vec3(l), color, 1.12) * vec3(1.04, 1.0, 0.93) + (1.0 - smoothstep(0.0, 0.5, l)) * vec3(-0.012, 0.01, 0.03), 0.0);
    return ACESFilmicToneMapping(color); }`);

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.CustomToneMapping; renderer.toneMappingExposure = 0.95; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9cc8e8, 380, 3200);
export const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.15, 6000);

export const hemi = new THREE.HemisphereLight(0xbfdcff, 0x3f6a5a, 0.9); scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffdca0, 2.6);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 400 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
scene.add(sun, sun.target);

export const GFX = { level: 'high', post: true, scale: Math.min(devicePixelRatio, 2) };

export const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
composer.setPixelRatio(GFX.scale); composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, 0.5, 0.92); composer.addPass(bloom);
const vignette = new ShaderPass(VignetteShader); vignette.uniforms.offset.value = 0.95; vignette.uniforms.darkness.value = 1.15; composer.addPass(vignette);
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

export function render() { if (GFX.post) composer.render(); else renderer.render(scene, camera); }

// Keep the sun's shadow box centred on the player, snapped to shadow-map texels so edges don't shimmer as you move
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
export function followShadow(target, dir) {
  const cam = sun.shadow.camera, texel = (cam.right - cam.left) / sun.shadow.mapSize.x;
  const fwd = _a.copy(dir).negate().normalize(), right = _b.crossVectors(fwd, UP).normalize(), up = _c.crossVectors(right, fwd);
  const r = Math.round(target.dot(right) / texel) * texel, u = Math.round(target.dot(up) / texel) * texel, f = target.dot(fwd);
  const centre = _d.copy(right).multiplyScalar(r).addScaledVector(up, u).addScaledVector(fwd, f);
  sun.target.position.copy(centre); sun.position.copy(centre).addScaledVector(dir, 200);
}

// ---- Procedural textures
export function tileNoise(size, period, octaves, hash) {
  const f = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let a = 0.5, fr = 1, v = 0;
    for (let o = 0; o < octaves; o++) {
      const px = (x / size) * period * fr, pz = (y / size) * period * fr, P = period * fr;
      const xi = Math.floor(px), zi = Math.floor(pz), xf = px - xi, zf = pz - zi, u = xf * xf * (3 - 2 * xf), w = zf * zf * (3 - 2 * zf);
      const hh = (i, j) => hash(((i % P) + P) % P + o * 17, ((j % P) + P) % P + o * 31);
      v += a * ((hh(xi, zi) * (1 - u) + hh(xi + 1, zi) * u) * (1 - w) + (hh(xi, zi + 1) * (1 - u) + hh(xi + 1, zi + 1) * u) * w);
      a *= 0.5; fr *= 2;
    }
    f[y * size + x] = v;
  }
  return f;
}
const h21 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
export const waterNormals = (() => {
  const N = 256, hf = tileNoise(N, 8, 4, h21), d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, hx = hf[y * N + ((x + 1) % N)] - hf[y * N + ((x - 1 + N) % N)], hz = hf[((y + 1) % N) * N + x] - hf[((y - 1 + N) % N) * N + x];
    const nx = -hx * 6, nz = -hz * 6, l = Math.hypot(nx, nz, 1);
    d.set([(nx / l * 0.5 + 0.5) * 255, (nz / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255, 255], i * 4);
  }
  const t = new THREE.DataTexture(d, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
})();
// Ground detail: soft painterly strokes that break up flat vertex colour up close (sampled at world xz / 3)
export const groundDetail = (() => {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'); g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, N, N); g.lineCap = 'round';
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 2600; i++) {
    const x = r() * N, y = r() * N, l = 3 + r() * 6, a = r() - 0.5, v = Math.floor(185 + r() * 70);
    g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1 + r() * 1.2;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.sin(a) * l, y + oy - Math.cos(a) * l); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
