// A pool of GPU particles for the bosses' blows, the fight's storm and a boss's end (bossblows.js, bossfx.js): one draw of
// up to N points, each written once as it is born (where, how fast, how long, how big, its colour, how it moves) into a
// ring of buffers, and moved from then on by the vertex shader alone (as the rain, the fireflies and the aura are):
// drag slowing it, gravity (or, below zero, heat lifting it), the wind (wind.js) carrying it, eddies turning it, growing
// as smoke does or cooling as an ember does, fading in and out. Only the bits written since the last frame are sent to the
// card (addUpdateRange). Blended premultiplied like the aura: smoke and dust cover (cover 1), embers and sparks add light
// (cover 0), and anything between.
import * as THREE from 'three';
import { scene, renderer } from './core.js';
import { WIND } from '../world/wind.js';

const N = 24000;
export const EMIT = { n: 0, now: 0, born: 0 };   // (born: how many so far, for the tests)
const A = { p: new Float32Array(N * 3), v: new Float32Array(N * 3), a: new Float32Array(N * 4), c: new Float32Array(N * 4), b: new Float32Array(N * 4), d: new Float32Array(N * 4) };
const geo = new THREE.BufferGeometry(), attr = {};
for (const [k, name, w] of [['p', 'position', 3], ['v', 'aV', 3], ['a', 'aA', 4], ['c', 'aC', 4], ['b', 'aB', 4], ['d', 'aD', 4]]) {
  A[k + 'w'] = w; const at = new THREE.BufferAttribute(A[k], w).setUsage(THREE.DynamicDrawUsage); geo.setAttribute(name, at); attr[k] = at; }
A.a.fill(-1e9);   // (every slot long dead to begin with)
const U = { uNow: { value: 0 }, uWind: { value: new THREE.Vector3() }, uScale: { value: 400 }, uFogR: { value: new THREE.Vector2(300, 2400) } };
const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
  vertexShader: `uniform float uNow, uScale; uniform vec3 uWind; uniform vec2 uFogR;
    attribute vec3 aV; attribute vec4 aA, aC, aB, aD; varying vec4 vC; varying float vSoft, vCover;
    // aA: born, life, size, gravity · aC: colour, cover · aB: drag, growth, cooling, eddies · aD: soft, wind, flicker, fade-in
    void main() {
      vC = vec4(0.0); vSoft = 0.0; vCover = 0.0; gl_PointSize = 0.0; gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
      float age = uNow - aA.x; if (age < 0.0 || age > aA.y) return;
      float u = age / aA.y, s = fract(sin(dot(position.xz + position.y, vec2(12.9898, 78.233))) * 43758.5453), k = aB.x;
      vec3 p = position + (k > 0.001 ? aV * (1.0 - exp(-k * age)) / k : aV * age) + vec3(0.0, -0.5 * aA.w * age * age, 0.0) + uWind * aD.y * age;
      p += aB.w * age * vec3(sin(age * 2.3 + s * 40.0), 0.5 * sin(age * 1.7 + s * 23.0), cos(age * 2.1 + s * 31.0));
      vec3 col = aC.rgb; float h = aB.z * u; col *= 1.0 - 0.8 * h; col.g *= 1.0 - 0.55 * h; col.b *= 1.0 - 0.9 * h;
      col *= 1.0 - aD.z * (0.5 + 0.5 * sin(uNow * (18.0 + 14.0 * s) + s * 60.0));
      float a = smoothstep(0.0, max(aD.w, 0.001), u) * (1.0 - smoothstep(0.5, 1.0, u));
      vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z; if (d < 0.3) return;
      // (gone before it reaches the lens, as the aura is: a glowing fleck a metre or two away blooms into a disc)
      vC = vec4(col, a * (1.0 - smoothstep(uFogR.x, uFogR.y * 1.2, d)) * smoothstep(2.0, 6.0, d)); vSoft = aD.x; vCover = aC.a;
      gl_PointSize = clamp(aA.z * (1.0 + aB.y * u) * projectionMatrix[1][1] * uScale / max(d, 0.1), 1.0, 300.0); gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `varying vec4 vC; varying float vSoft, vCover;
    void main() { float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard;
      float a = mix(smoothstep(1.0, 0.6, r), pow(1.0 - r, 1.6), vSoft) * vC.a; if (a < 0.003) discard;
      gl_FragColor = vec4(vC.rgb * a, a * vCover); }`,
});
const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 4; scene.add(pts);
let head = 0, lo = Infinity, hi = -1, wrapped = false;
const _c = new THREE.Color();
// One particle: p where (a Vector3), v its velocity, life seconds, size metres across, grav (m/s², below zero: rising),
// col a colour (hex or Color) times k (above 1 for the bloom), cover (1 covers, 0 adds light), drag (per second),
// grow (its size at the end, times), heat (how much it cools to red and dark), turb (eddies, m/s), soft (a puff, not a
// disc), wind (how much the wind carries it), flick (flickering), fade (the share of its life it takes to come in)
export function spawn(p, v, { life = 1, size = 0.2, grav = 0, col = 0xffffff, k = 1, cover = 1, drag = 0, grow = 0, heat = 0, turb = 0, soft = 0, wind = 0, flick = 0, fade = 0.06, delay = 0 } = {}) {
  const i = head; head = (head + 1) % N; if (head === 0) wrapped = true; lo = Math.min(lo, i); hi = Math.max(hi, i); EMIT.born++;
  A.p[i * 3] = p.x; A.p[i * 3 + 1] = p.y; A.p[i * 3 + 2] = p.z; A.v[i * 3] = v.x; A.v[i * 3 + 1] = v.y; A.v[i * 3 + 2] = v.z;
  A.a[i * 4] = EMIT.now + delay; A.a[i * 4 + 1] = life; A.a[i * 4 + 2] = size; A.a[i * 4 + 3] = grav;
  _c.set(col).multiplyScalar(k); A.c[i * 4] = _c.r; A.c[i * 4 + 1] = _c.g; A.c[i * 4 + 2] = _c.b; A.c[i * 4 + 3] = cover;
  A.b[i * 4] = drag; A.b[i * 4 + 1] = grow; A.b[i * 4 + 2] = heat; A.b[i * 4 + 3] = turb;
  A.d[i * 4] = soft; A.d[i * 4 + 1] = wind; A.d[i * 4 + 2] = flick; A.d[i * 4 + 3] = fade;
}
// per frame: the clock, the wind, and what was written since the last frame sent to the card
export function updateEmit(dt) {
  EMIT.now += dt; U.uNow.value = EMIT.now; U.uWind.value.set(WIND.dir.x, 0, WIND.dir.y).multiplyScalar(WIND.speed); U.uScale.value = renderer.domElement.height / 2;
  U.uFogR.value.set(scene.fog?.near ?? 300, scene.fog?.far ?? 2400);
  if (hi < 0) return;
  for (const k of ['p', 'v', 'a', 'c', 'b', 'd']) { const at = attr[k], w = A[k + 'w']; at.clearUpdateRanges(); if (wrapped) at.addUpdateRange(0, N * w); else at.addUpdateRange(lo * w, (hi - lo + 1) * w); at.needsUpdate = true; }
  lo = Infinity; hi = -1; wrapped = false;
}
// a stand-in for the loading screen to compile (main.js warmUp, through bossfx.js)
export const emitWarm = () => { const p = new THREE.Points(geo, mat); p.frustumCulled = false; return p; };
// little helpers for the effects: a random direction round the up axis (spread: how far it leans out), a random number
export const rr = (a, b) => a + Math.random() * (b - a);
export function dir(up = 1, out = 1) { const a = Math.random() * 6.2832; return new THREE.Vector3(Math.cos(a) * out * Math.random(), up * (0.3 + 0.7 * Math.random()), Math.sin(a) * out * Math.random()); }
