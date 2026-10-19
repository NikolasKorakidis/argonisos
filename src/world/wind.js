// The wind (graphics plan 4.4 and the tester's feedback, 19 Oct): one wind for everything that shows it, its direction
// wandering slowly and its strength set by the weather, with gusts. The rain slants with it, and wind lines show it: thin
// white strokes drifting through the air the way stylised games draw the wind (Valheim, Breath of the Wild, Genshin).
// Each line is a ribbon along a gently waving path, now and then curling into a loop, along which a short bright stroke
// travels, drawing itself and fading; all on the GPU, a few dozen round the camera, more in a stronger wind, only in the
// open (none under a roof or a tree's crown).
import * as THREE from 'three';
import { scene, camera } from '../render/core.js';
import { WET_U, SHELTER } from './wetness.js';
import { grassU } from './grass.js';
import { seeded } from '../util/math.js';

export const WIND = { dir: new THREE.Vector2(1, 0.35).normalize(), speed: 3, gust: 0, angle: 0.34 };
let target = 3, drift = 0, gustT = 0, gustTo = 0;
// strength (m/s) for the weather: a breeze in fair weather, a gale in a storm
export function updateWind(dt, { rain = 0, storm = 0, overcast = 0 } = {}) {
  target = 2.6 + overcast * 1.6 + rain * 2.2 + storm * 6;
  WIND.speed += (target - WIND.speed) * Math.min(1, dt * 0.15);
  // the direction wanders slowly (a full turn takes many minutes), faster in a storm
  drift += dt * (0.02 + storm * 0.05); WIND.angle += Math.sin(drift * 0.7) * dt * 0.012 * (1 + storm * 2);
  WIND.dir.set(Math.cos(WIND.angle), Math.sin(WIND.angle));
  gustT -= dt; if (gustT <= 0) { gustT = 2 + Math.random() * 5; gustTo = Math.random() * (0.5 + storm * 0.5); }
  WIND.gust += (gustTo - WIND.gust) * Math.min(1, dt * 0.8);
}

// ---- Wind lines
const N = 56, SEG = 96;
export const WINDLINE_U = { uCam: { value: new THREE.Vector3() }, uFwd: { value: 0 }, uTime: { value: 0 }, uDir: { value: new THREE.Vector2(1, 0) }, uSpeed: { value: 3 },
  uAmount: { value: 0 }, uLight: { value: 1 } };
const geo = new THREE.InstancedBufferGeometry(), pos = [], idx = [];
for (let i = 0; i <= SEG; i++) for (const s of [-1, 1]) pos.push(i / SEG, s, 0);
for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
const seed = new Float32Array(N * 4), rnd = seeded(31); for (let i = 0; i < N * 4; i++) seed[i] = rnd();   // (seeded: the same lines every run)
geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4)); geo.instanceCount = N;
const mat = new THREE.ShaderMaterial({
  uniforms: { ...WINDLINE_U, ...WET_U, uHeight: grassU.uHeight, uOrigin: grassU.uOrigin, uSize: grassU.uSize },
  transparent: true, depthWrite: false,
  vertexShader: `${SHELTER}
    uniform vec3 uCam; uniform float uTime, uSpeed, uAmount, uFwd; uniform vec2 uDir; uniform sampler2D uHeight; uniform vec2 uOrigin; uniform float uSize;
    attribute vec4 aSeed; varying float vA, vS;
    float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
    // the path of one line: along the wind, waving gently; with a loop (a prolate cycloid in the upright plane) if it has one
    vec3 path(float u, float len, float k, float loopAt, float loopR, vec3 d, vec3 side) {
      float s = u * len; vec3 p = d * s + side * sin(u * 5.0 + k * 3.1) * 0.35 + vec3(0.0, 1.0, 0.0) * sin(u * 3.7 + k * 1.7) * 0.22;
      float w = 0.13, t = clamp((u - loopAt + w) / (2.0 * w), 0.0, 1.0);
      if (loopR > 0.0 && t > 0.0 && t < 1.0) { float a = 6.2832 * t; p += d * (-loopR * 1.7 * sin(a)) + vec3(0.0, loopR * 1.7 * (1.0 - cos(a)), 0.0); }
      return p;
    }
    void main() {
      vA = 0.0; vS = position.y; gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
      if (aSeed.w > uAmount) return;
      // each line lives a few seconds, then starts again somewhere else round the camera
      float life = 3.0 + aSeed.y * 2.2, cyc = (uTime + aSeed.x * life) / life, k = floor(cyc) + aSeed.z * 97.0, ph = fract(cyc);
      float ang = uFwd + (h1(k * 1.3) - 0.5) * 2.6, r = 4.0 + h1(k * 2.7) * 14.0;   // (mostly where you're looking)
      vec2 at = uCam.xz + vec2(cos(ang), sin(ang)) * r;
      vec2 huv = (at - uOrigin) / uSize; float ground = (huv.x > 0.0 && huv.y > 0.0 && huv.x < 1.0 && huv.y < 1.0) ? texture2D(uHeight, huv).r : uCam.y - 2.0;
      float lift = 0.5 + h1(k * 4.1) * h1(k * 5.3) * 5.0;
      if (ground + lift < max(coverTop(uShelter, at), coverTop(uCanopy, at)) + 0.2 || ground < -0.5) return;   // (in the open: not under a roof or a crown, not over the sea)
      vec3 d = vec3(uDir.x, 0.0, uDir.y), side = vec3(-uDir.y, 0.0, uDir.x);
      float len = 5.0 + h1(k * 6.7) * 5.0, loopR = h1(k * 7.9) > 0.55 ? 0.35 + h1(k * 8.3) * 0.35 : 0.0, loopAt = 0.35 + h1(k * 9.1) * 0.3;
      vec3 start = vec3(at.x, ground + lift, at.y) + d * (ph * life * uSpeed * 0.55);   // carried along by the wind
      float u = position.x;
      vec3 p = start + path(u, len, k, loopAt, loopR, d, side);
      vec3 tang = normalize(path(min(u + 0.01, 1.0), len, k, loopAt, loopR, d, side) - path(max(u - 0.01, 0.0), len, k, loopAt, loopR, d, side) + vec3(1e-4, 0.0, 0.0));
      vec3 toCam = normalize(cameraPosition - p), w = normalize(cross(tang, toCam));
      // a stroke running along the line: its head moves from start to end over the line's life, its tail a third behind
      float head = ph * 1.6 - 0.05, tail = head - 0.55, along = clamp((u - tail) / (head - tail), 0.0, 1.0);
      float vis = step(tail, u) * step(u, head) * sin(along * 3.1416);
      float dist = distance(p, cameraPosition), width = (0.065 + dist * 0.0028) * (0.35 + 0.65 * vis);
      vA = vis * smoothstep(0.0, 0.15, ph) * (1.0 - smoothstep(0.85, 1.0, ph)) * (1.0 - smoothstep(18.0, 28.0, dist)) * smoothstep(1.5, 4.0, dist);
      gl_Position = projectionMatrix * viewMatrix * vec4(p + w * position.y * width, 1.0);
    }`,
  fragmentShader: `uniform float uAmount, uLight; varying float vA, vS;
    void main() { float a = vA * (1.0 - vS * vS * vS * vS) * 0.8; if (a < 0.003) discard; gl_FragColor = vec4(vec3(1.0, 0.99, 0.96) * uLight, a); }`,
});
const _f = new THREE.Vector3(), lines = new THREE.Mesh(geo, mat); lines.frustumCulled = false; lines.renderOrder = 3; scene.add(lines);

// light: how bright the air is (dim at night); still: hold them in place (screenshot tests)
export function updateWindLines(dt, { light = 1, rain = 0, still = false } = {}) {
  const amount = still ? 0.3 : Math.min(1, 0.25 + Math.max(0, WIND.speed - 2.5) * 0.16) * (1 - rain * 0.4);
  lines.visible = amount > 0.02 && light > 0.05; if (!lines.visible) return;
  WINDLINE_U.uTime.value = still ? 7.3 : WINDLINE_U.uTime.value + dt;   // (screenshot tests: held at one moment)
  WINDLINE_U.uCam.value.copy(camera.position); camera.getWorldDirection(_f); WINDLINE_U.uFwd.value = Math.atan2(_f.z, _f.x); if (still) { WINDLINE_U.uDir.value.set(0.94, 0.34); WINDLINE_U.uSpeed.value = 3; }   // (screenshot tests: one fixed wind)
  else { WINDLINE_U.uDir.value.copy(WIND.dir); WINDLINE_U.uSpeed.value = WIND.speed * (1 + WIND.gust); }
  WINDLINE_U.uAmount.value = amount; WINDLINE_U.uLight.value = light;
}
