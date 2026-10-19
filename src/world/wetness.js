// The wet world (graphics plan 1.1 and 1.2): one wetness for everything, rising while it rains and drying slowly in
// the sun. Wet surfaces turn darker and glossier and reflect more of the sky; up-facing ones get wettest, undersides stay
// dry. On flat open ground puddles gather, growing as the rain goes on, rippled by the drops.
// Shelter (plan 1.3): two small top-down depth maps of what stands over the ground round the player, re-drawn as you
// move: solid cover (roofs, buildings, the sites) and tree crowns. Below either the ground stays dry; no rain falls
// under a roof, and only a little gets through the leaves.
import * as THREE from 'three';

export const WET_U = {
  uWet: { value: 0 },                                   // how wet the world is, 0..1
  uRainK: { value: 0 },                                 // how hard it is raining now (ripples), 0..1
  uRainT: { value: 0 },                                 // the ripples' clock
  uShelter: { value: null },                            // the shelter depth map: roofs and buildings
  uCanopy: { value: null },                             // and tree crowns
  uShelterBox: { value: new THREE.Vector4(-1e6, -1e6, 1, 0) },   // its origin x, z, size, and the camera's height
  uShelterNF: { value: new THREE.Vector2(1, 400) },     // its near and far
};
export const WET = WET_U.uWet;

// Rises while it rains (a heavy shower soaks everything in about a minute), dries over a few minutes, faster in the sun
export function updateWetness(dt, rain, sun) {
  const w = WET.value;
  WET.value = rain > 0.05 ? Math.min(1, w + dt * rain / 50) : Math.max(0, w - dt * (0.25 + 0.75 * sun) / 240);
  WET_U.uRainK.value = rain; WET_U.uRainT.value += dt;
}

// ---- Shelter
const SIZE = 112, RES = 512, LIFT = 120, LAYER = 3;   // (layers 3 and 4: what the two shelter maps draw)
const depthTarget = () => { const t = new THREE.WebGLRenderTarget(RES, RES, { depthBuffer: true, depthTexture: new THREE.DepthTexture(RES, RES) }); t.texture.generateMipmaps = false; return t; };
const solid = depthTarget(), canopy = depthTarget(), CANOPY = LAYER + 1;
const cam = new THREE.OrthographicCamera(-SIZE / 2, SIZE / 2, SIZE / 2, -SIZE / 2, 1, 400); cam.up.set(0, 0, -1);
const depthMat = new THREE.MeshDepthMaterial();
WET_U.uShelter.value = solid.depthTexture; WET_U.uCanopy.value = canopy.depthTexture; WET_U.uShelterNF.value.set(cam.near, cam.far);
let lastX = 1e9, lastZ = 1e9, timer = 0;
// roots(): { solid: placed buildings and site groups, canopy: the near trees }; drawn depth only, no shadows. Re-drawn
// every half second (so a roof you've just built shelters at once) or when you've moved a few metres.
export function updateShelter(renderer, scene, pos, roots, dt, raining = true, force = false) {
  timer -= dt;
  if (!force && timer > 0 && Math.hypot(pos.x - lastX, pos.z - lastZ) < 3) return;
  timer = raining ? 0.5 : 2; lastX = pos.x; lastZ = pos.z;
  const r = roots();
  for (const o of r.solid) o?.traverse((m) => { if (m.isMesh) m.layers.enable(LAYER); });
  for (const o of r.canopy) o?.traverse((m) => { if (m.isMesh) m.layers.enable(CANOPY); });
  cam.position.set(pos.x, pos.y + LIFT, pos.z); cam.lookAt(pos.x, pos.y, pos.z); cam.updateMatrixWorld();
  const prev = { rt: renderer.getRenderTarget(), auto: renderer.shadowMap.autoUpdate, over: scene.overrideMaterial, bg: scene.background };
  renderer.shadowMap.autoUpdate = false; scene.overrideMaterial = depthMat; scene.background = null;
  for (const [t, layer] of [[solid, LAYER], [canopy, CANOPY]]) { cam.layers.set(layer); renderer.setRenderTarget(t); renderer.clear(); renderer.render(scene, cam); }
  renderer.setRenderTarget(prev.rt); renderer.shadowMap.autoUpdate = prev.auto; scene.overrideMaterial = prev.over; scene.background = prev.bg;
  WET_U.uShelterBox.value.set(pos.x - SIZE / 2, pos.z - SIZE / 2, SIZE, cam.position.y);
}

// ---- Shader code
// rain on standing water: rings spreading from random points, each cell on its own clock (two sizes); the slope (x, z)
export const RIPPLES = `float wetHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 wetRipples(vec2 p, float t) {
  vec2 s = vec2(0.0);
  for (int l = 0; l < 2; l++) {
    float k = l == 0 ? 2.2 : 3.4; vec2 q = p * k + float(l) * 7.3, id = floor(q), f = fract(q) - 0.5;
    float h = wetHash(id + float(l) * 13.1), ph = fract(t * (0.8 + h * 0.7) + h * 7.0);
    vec2 c = (vec2(wetHash(id + 3.7), wetHash(id + 9.1)) - 0.5) * 0.5, d = f - c; float r = length(d), R = ph * 0.45;
    s += d / max(r, 1e-3) * sin((r - R) * 46.0) * smoothstep(0.07, 0.0, abs(r - R)) * (1.0 - ph) * step(h, 0.85);
  }
  return s * 0.5;
}
`;
// the top of the cover over a point (from a shelter map), or -1e6 where nothing stands over it
export const SHELTER = `uniform sampler2D uShelter, uCanopy; uniform vec4 uShelterBox; uniform vec2 uShelterNF;
float coverTop(sampler2D map, vec2 xz) {
  vec2 uv = (xz - uShelterBox.xy) / uShelterBox.z; uv.y = 1.0 - uv.y;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -1e6;
  float d = texture2D(map, uv).x; return d >= 0.9999 ? -1e6 : uShelterBox.w - (uShelterNF.x + d * (uShelterNF.y - uShelterNF.x));
}
`;
export const WET_PARS = RIPPLES + SHELTER + `uniform float uWet, uRainK, uRainT;
varying vec3 vWetP;
float wetNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wetHash(i), wetHash(i + vec2(1.0, 0.0)), f.x), mix(wetHash(i + vec2(0.0, 1.0)), wetHash(i + vec2(1.0, 1.0)), f.x), f.y); }
// 1 out in the open, 0 under something standing well over this point (a roof, a tree's crown; not a bush, whose leaf
// cards are solid squares seen from above)
float wetOpen(vec3 p) {
  float top = max(coverTop(uShelter, p.xz), coverTop(uCanopy, p.xz));
  return smoothstep(top - 2.2, top - 1.4, p.y);
}
`;
const WET_VERT = `#include <project_vertex>
  #ifdef USE_INSTANCING
    vWetP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
  #else
    vWetP = (modelMatrix * vec4(transformed, 1.0)).xyz;
  #endif`;
const wetFrag = (dark, gloss, puddles) => `float wetK = 0.0, wetPud = 0.0;
  if (uWet > 0.001) {
    vec3 wn = inverseTransformDirection(normal, viewMatrix);
    wetK = uWet * mix(0.3, 1.0, smoothstep(-0.2, 0.7, wn.y)) * wetOpen(vWetP);   // tops wettest, sides less, undersides and shelter dry
    diffuseColor.rgb *= mix(1.0, ${dark.toFixed(3)}, wetK);
    roughnessFactor = mix(roughnessFactor, min(roughnessFactor, ${gloss.toFixed(3)}), wetK);
    ${puddles ? `// puddles on flat open ground, spreading as the rain goes on; mirror-smooth and rippled while it falls
    float pn = wetNoise(vWetP.xz * 0.11) * 0.65 + wetNoise(vWetP.xz * 0.37 + 5.3) * 0.35, th = mix(1.08, 0.6, uWet);
    wetPud = smoothstep(th, th + 0.05, pn) * smoothstep(0.965, 0.995, wn.y) * wetOpen(vWetP) * (1.0 - smoothstep(22.0, 45.0, distance(vWetP, cameraPosition)));   // (far off, a puddle at a low angle mirrors the hazy sky white, like snow)
    diffuseColor.rgb *= mix(1.0, 0.38, wetPud); roughnessFactor = mix(roughnessFactor, 0.16, wetPud);
    vec2 sl = wetRipples(vWetP.xz, uRainT) * uRainK; vec3 pw = normalize(vec3(-sl.x, 1.0, -sl.y));
    normal = normalize(mix(normal, normalize((viewMatrix * vec4(pw, 0.0)).xyz), wetPud));` : ''}
  }
  #include <lights_physical_fragment>`;
const wetRad = (shine) => `#include <lights_fragment_maps>
  radiance *= 1.0 + wetK * ${shine.toFixed(2)};   // (wet things mirror more of the sky)`;

// Add the wet look to a shader being compiled (for materials that already patch their own shaders)
export function patchWet(sh, { dark = 0.62, gloss = 0.3, puddles = false, shine = 0.5 } = {}) {
  Object.assign(sh.uniforms, WET_U);
  sh.vertexShader = 'varying vec3 vWetP;\n' + sh.vertexShader.replace('#include <project_vertex>', WET_VERT);
  sh.fragmentShader = WET_PARS + sh.fragmentShader.replace('#include <lights_physical_fragment>', wetFrag(dark, gloss, puddles)).replace('#include <lights_fragment_maps>', wetRad(shine));
}
// Make a material wettable (on top of any patch it has). Each kind gets its own program key, so materials with
// different settings never share a compiled shader by mistake.
const OPTS = new WeakMap();
export function wettable(mat, opts = {}) {
  const base = mat.onBeforeCompile, key = mat.customProgramCacheKey(), o = { dark: 0.62, gloss: 0.3, puddles: false, shine: 0.5, ...opts };
  mat.onBeforeCompile = (sh, r) => { base?.call(mat, sh, r); patchWet(sh, o); };
  mat.customProgramCacheKey = () => `${key}|wet${o.dark},${o.gloss},${o.shine},${o.puddles ? 1 : 0}`;
  OPTS.set(mat, o); return mat;
}
// A copy of a material (clones lose their shader patches) made wettable the same way
export const wetLike = (copy, source) => (OPTS.has(source) ? wettable(copy, OPTS.get(source)) : copy);
