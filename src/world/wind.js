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
import { WIND_U } from './trees.js';

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
// The lines belong to the world, not to you: the ground is divided into CELL-metre squares, each with its own line on its
// own clock (where it starts, how it waves, whether it loops, all from hashes of the square and the cycle). An instance
// draws whichever square lies at its place in a GRID×GRID patch round the camera, so walking only changes which squares
// are drawn, never where a line is; at the patch's edge they fade.
const GRID = 14, CELL = 8, SEG = 96, N = GRID * GRID;   // (out to ~55 m, where the mist begins: spread wide, never crowding round you)
export const WINDLINE_U = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uDir: { value: new THREE.Vector2(1, 0) }, uSpeed: { value: 3 },
  uAmount: { value: 0 }, uLight: { value: 1 } };
const geo = new THREE.InstancedBufferGeometry(), pos = [], idx = [];
for (let i = 0; i <= SEG; i++) for (const s of [-1, 1]) pos.push(i / SEG, s, 0);
for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
const cellOf = new Float32Array(N * 2); for (let i = 0; i < N; i++) { cellOf[i * 2] = (i % GRID) - (GRID - 1) / 2; cellOf[i * 2 + 1] = Math.floor(i / GRID) - (GRID - 1) / 2; }
geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cellOf, 2)); geo.instanceCount = N;
const mat = new THREE.ShaderMaterial({
  uniforms: { ...WINDLINE_U, ...WET_U, uHeight: grassU.uHeight, uOrigin: grassU.uOrigin, uSize: grassU.uSize },
  transparent: true, depthWrite: false,
  vertexShader: `${SHELTER}
    uniform vec3 uCam; uniform float uTime, uSpeed, uAmount; uniform vec2 uDir; uniform sampler2D uHeight; uniform vec2 uOrigin; uniform float uSize;
    attribute vec2 aCell; varying float vA, vS;
    float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
    // one strand's path: along the wind, a gentle wave travelling down it (sideways and a little up and down), and now
    // and then a small hook (a prolate cycloid in the upright plane)
    vec3 path(float u, float len, float k, float t, float waves, float amp, float hookAt, float hookR, vec3 d, vec3 side) {
      float a = u * waves * 6.2832 - t * 1.3 + k * 3.1;
      vec3 p = d * (u * len) + side * sin(a) * amp + vec3(0.0, 1.0, 0.0) * sin(a * 0.7 + k) * amp * 0.45;
      float w = 0.06, q = clamp((u - hookAt + w) / (2.0 * w), 0.0, 1.0);
      if (hookR > 0.0 && q > 0.0 && q < 1.0) { float b = 6.2832 * q; p += d * (-hookR * 1.4 * sin(b)) + vec3(0.0, hookR * 1.4 * (1.0 - cos(b)), 0.0); }
      return p;
    }
    void main() {
      vA = 0.0; vS = position.y; gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
      // which square of ground this instance draws, and that square's own strand
      vec2 cell = floor(uCam.xz / ${CELL.toFixed(1)}) + aCell; float ch = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
      float life = 4.0 + ch * 3.0, cyc = uTime / life + ch * 7.0, k = floor(cyc) + ch * 97.0, ph = fract(cyc);
      if (h1(k * 3.3) > uAmount) return;                                    // (a calm square this time round)
      vec2 at = (cell + vec2(h1(k * 1.3), h1(k * 2.7))) * ${CELL.toFixed(1)};
      vec2 huv = (at - uOrigin) / uSize; if (huv.x <= 0.0 || huv.y <= 0.0 || huv.x >= 1.0 || huv.y >= 1.0) return;
      float ground = texture2D(uHeight, huv).r, lift = 1.2 + h1(k * 4.1) * h1(k * 5.3) * 5.0;   // (over the tall grass)
      if (ground + lift < max(coverTop(uShelter, at), coverTop(uCanopy, at)) + 0.2 || ground < -0.5) return;   // (in the open: not under a roof or a crown, not over the sea)
      // each strand a little off the wind's line, so they flow together without being ruled straight
      float tw = (h1(k * 11.7) - 0.5) * 0.35; vec2 dir2 = vec2(uDir.x * cos(tw) - uDir.y * sin(tw), uDir.x * sin(tw) + uDir.y * cos(tw));
      vec3 d = vec3(dir2.x, 0.0, dir2.y), side = vec3(-dir2.y, 0.0, dir2.x);
      float len = 14.0 + h1(k * 6.7) * 12.0, waves = 1.2 + h1(k * 7.3) * 1.8, amp = 0.2 + h1(k * 8.9) * 0.35;
      float hookR = h1(k * 7.9) > 0.92 ? 0.12 + h1(k * 8.3) * 0.15 : 0.0, hookAt = 0.4 + h1(k * 9.1) * 0.3;
      vec3 start = vec3(at.x, ground + lift, at.y) - d * (len * 0.5) + d * (ph * life * uSpeed * 0.45);   // carried along by the wind
      float u = position.x;
      vec3 p = start + path(u, len, k, uTime, waves, amp, hookAt, hookR, d, side);
      vec3 tang = normalize(path(min(u + 0.005, 1.0), len, k, uTime, waves, amp, hookAt, hookR, d, side) - path(max(u - 0.005, 0.0), len, k, uTime, waves, amp, hookAt, hookR, d, side) + vec3(1e-4, 0.0, 0.0));
      vec3 toCam = normalize(cameraPosition - p), w = normalize(cross(tang, toCam));
      // the drawn part slides along the strand over its life, long and tapering at both ends
      float head = ph * 1.5 + 0.1, tail = head - 0.8, along = clamp((u - tail) / (head - tail), 0.0, 1.0);
      float vis = step(tail, u) * step(u, head) * pow(sin(along * 3.1416), 0.8);
      float bright = 0.28 + pow(h1(k * 12.3), 3.0) * 0.32;                // (most faint, a few a little brighter)
      float dist = distance(p, cameraPosition), width = dist * 0.0019 * (0.8 + bright * 0.5) * (0.3 + 0.7 * vis);   // (a hairline: the same pixels wide near or far)
      vA = vis * bright * smoothstep(0.0, 0.15, ph) * (1.0 - smoothstep(0.8, 1.0, ph)) * (1.0 - smoothstep(40.0, 55.0, length(p.xz - uCam.xz))) * smoothstep(5.0, 11.0, dist);   // (none in your face, the far ones into the mist)
      gl_Position = projectionMatrix * viewMatrix * vec4(p + w * position.y * width, 1.0);
    }`,
  fragmentShader: `uniform float uAmount, uLight; varying float vA, vS;
    void main() { float a = min(1.0, vA * 1.25 * smoothstep(1.0, 0.45, abs(vS))); if (a < 0.003) discard; gl_FragColor = vec4(vec3(1.0, 0.99, 0.97) * uLight, a); }`,
});
const lines = new THREE.Mesh(geo, mat); lines.frustumCulled = false; lines.renderOrder = 3; scene.add(lines);

// light: how bright the air is (dim at night); still: hold them in place (screenshot tests)
export function updateWindLines(dt, { light = 1, rain = 0, still = false } = {}) {
  // what everything bends with (grass, flowers, trees, clouds): the direction, and a strength from a breeze to a storm
  if (still) { WIND_U.uWindDir.value.set(0.94, 0.34); WIND_U.uWindStr.value = 0.1; }
  else { WIND_U.uWindDir.value.copy(WIND.dir); WIND_U.uWindStr.value = Math.min(1.3, Math.max(0, (WIND.speed - 2.3) / 8) + WIND.gust * 0.25); }   // (fair weather ~0.1, rain ~0.6, a storm over 1)
  const amount = still ? 0.3 : Math.min(0.75, 0.22 + Math.max(0, WIND.speed - 2.5) * 0.08);
  lines.visible = amount > 0.02 && light > 0.05; if (!lines.visible) return;
  WINDLINE_U.uTime.value = still ? 7.3 : WINDLINE_U.uTime.value + dt;   // (screenshot tests: held at one moment)
  WINDLINE_U.uCam.value.copy(camera.position); if (still) { WINDLINE_U.uDir.value.set(0.94, 0.34); WINDLINE_U.uSpeed.value = 3; }   // (screenshot tests: one fixed wind)
  else { WINDLINE_U.uDir.value.copy(WIND.dir); WINDLINE_U.uSpeed.value = WIND.speed * (1 + WIND.gust); }
  WINDLINE_U.uAmount.value = amount; WINDLINE_U.uLight.value = light;
}
