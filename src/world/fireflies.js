// Fireflies (the light study, docs/plans/light-study.md): on clear nights, warm green-gold sparks drifting slowly a
// little over the meadows and along the woods' edges, in loose swarms, each blinking on its own slow clock. All on the GPU
// like the rain (rain.js): one draw of a few hundred points whose swarms are fixed in the world and wrap round the camera,
// so walking never runs out of them; set on the ground from the grass's height map, and few under thick crowns (the canopy
// map in wetness.js), where the dark woods keep only a stray one or two. No lights: they glow through the bloom alone.
import * as THREE from 'three';
import { scene, renderer } from '../render/core.js';
import { WET_U, SHELTER } from './wetness.js';
import { grassU } from './grass.js';

const N = 420, SWARMS = 28, BOX = 56;
export const FIREFLY_U = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uAmount: { value: 0 }, uScale: { value: 400 }, uFogR: { value: new THREE.Vector2(300, 2400) } };
const seed = new Float32Array(N * 4); { let s = 29; const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; for (let i = 0; i < N * 4; i++) seed[i] = r(); }
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
const mat = new THREE.ShaderMaterial({
  uniforms: { ...FIREFLY_U, ...WET_U, uHeight: grassU.uHeight, uOrigin: grassU.uOrigin, uSize: grassU.uSize },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `${SHELTER}
    uniform vec3 uCam; uniform float uTime, uAmount, uScale; uniform vec2 uFogR; uniform sampler2D uHeight; uniform vec2 uOrigin; uniform float uSize;
    attribute vec4 aSeed; varying float vA;
    float fh(float n) { return fract(sin(n * 91.345) * 47453.5453); }
    void main() {
      vA = 0.0; gl_PointSize = 0.0; gl_Position = vec4(0.0, 0.0, -2.0, 1.0);   // (hidden: behind the near plane)
      if (aSeed.w > uAmount) return;                                          // (a thin night shows only some of them)
      // its swarm: a spot fixed in the world, the box of them wrapped round the camera
      float sw = floor(aSeed.x * ${SWARMS}.0);
      vec2 c = vec2(fh(sw + 1.3), fh(sw + 7.9)) * ${BOX}.0;
      c = uCam.xz + mod(c - uCam.xz, ${BOX}.0) - ${BOX / 2}.0;
      // drifting slowly about the swarm's middle, each on its own lazy loop
      float t = uTime, ph = aSeed.y * 6.2832;
      vec2 off = (vec2(aSeed.y, aSeed.z) - 0.5) * 9.0 + vec2(sin(t * 0.21 + ph * 3.0) + 0.5 * sin(t * 0.53 + ph), cos(t * 0.17 + ph * 2.0) + 0.5 * cos(t * 0.47 + ph * 5.0)) * 1.4;
      vec2 xz = c + off;
      vec2 huv = (xz - uOrigin) / uSize; if (huv.x < 0.0 || huv.y < 0.0 || huv.x > 1.0 || huv.y > 1.0) return;
      float y = texture2D(uHeight, huv).r + 0.35 + aSeed.z * 1.9 + sin(t * 0.7 + ph * 4.0) * 0.25;
      vec3 p = vec3(xz.x, y, xz.y);
      // few under the trees' crowns: the dark woods keep only the odd one
      float under = step(p.y + 2.0, coverTop(uCanopy, p.xz)); if (under > 0.5 && fract(aSeed.w * 13.7) > 0.18) return;
      // blinking: a slow swell and a quick fade, every few seconds, with a faint glow between
      float b = fract(t / (2.6 + aSeed.x * 4.0) + aSeed.z * 7.0), blink = smoothstep(0.0, 0.18, b) * (1.0 - smoothstep(0.22, 0.55, b));
      // gone at the box's edge (so the wrap never shows) and right in your face
      vec2 e = abs(xz - uCam.xz); float edge = 1.0 - smoothstep(${BOX * 0.36}, ${BOX * 0.48}, max(e.x, e.y));
      vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z;
      vA = (0.08 + 0.92 * blink) * edge * smoothstep(0.8, 2.0, d) * (1.0 - smoothstep(uFogR.x, uFogR.y * 1.4, d));   // (a glow reaches a little further through the fog than a leaf does)
      gl_PointSize = clamp(0.5 * uScale / max(d, 0.1), 3.0, 22.0);
      gl_Position = projectionMatrix * mv;
    }`,
  // a hot core in a soft halo (the bloom spreads it further)
  fragmentShader: `uniform float uAmount; varying float vA;
    void main() { float r = length(gl_PointCoord - 0.5) * 2.0, core = smoothstep(0.3, 0.0, r), halo = pow(max(1.0 - r, 0.0), 2.5) * 0.45;
      float a = (core + halo) * vA; if (a < 0.004) discard;
      gl_FragColor = vec4(vec3(0.82, 1.0, 0.32) * (core * 4.0 + halo) * vA, 1.0); }`,
});
const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 4; scene.add(pts);

// amount 0..1 (night, the meadows, clear weather), cam: the camera's position, t: the clock (fixed for screenshots)
export function updateFireflies(amount, cam, t) {
  pts.visible = amount > 0.01; if (!pts.visible) return;
  FIREFLY_U.uAmount.value = amount; FIREFLY_U.uCam.value.copy(cam); FIREFLY_U.uTime.value = t; FIREFLY_U.uScale.value = renderer.domElement.height / 2; FIREFLY_U.uFogR.value.set(scene.fog.near, scene.fog.far);
}
