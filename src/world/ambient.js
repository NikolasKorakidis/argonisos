// Life in the air round the camera: pollen drifting over the meadows by day, fireflies blinking at dusk and through the
// night, leaves spinning down in the forests, snow blowing off the summit of Olympos. Each is a few hundred soft points,
// moved on the CPU (cheap at this count) and drawn in one call; how many show follows the place, the hour and the weather.
// (The fireflies live on the GPU, in fireflies.js; they take their amount from here like the rest.)
// Each biome has its own life in the air too (the reviewer, 16 Nov), all on the GPU (DRIFT below), one draw each:
// butterflies over the meadows by day; in the forest, motes and spores drifting in the air that light up only where the
// sun gets through, so they show in its shafts; at the marsh, low banks of mist drifting over the ground and pale
// wisps of swamp gas rising and fading. Each comes in as much as you stand in its biome, eased, so nothing pops.
import * as THREE from 'three';
import { scene, renderer } from '../render/core.js';
import { groundAt } from './groundcut.js';
import { updateFireflies } from './fireflies.js';
import { WEATHER } from './weather.js';
import { LIGHT } from './sky.js';
import { biomeWeights } from './gen.js';
import { grassU } from './grass.js';
import { ATMO } from '../render/atmosphere.js';
import { WIND } from './wind.js';

const KINDS = {
  pollen: { n: 260, R: 18, H: 5, size: 0.07, color: [1.0, 0.95, 0.75], add: false },
  leaf: { n: 160, R: 18, H: 14, size: 0.16, color: [0.42, 0.36, 0.12], add: false },
  snow: { n: 420, R: 20, H: 12, size: 0.1, color: [1.1, 1.12, 1.18], add: false },
};
const systems = {};
let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
for (const [name, K] of Object.entries(KINDS)) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(K.n * 3), a = new Float32Array(K.n);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aA', new THREE.BufferAttribute(a, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Vector3(...K.color) }, uSize: { value: K.size }, uScale: { value: 400 }, uOp: { value: 0 } },
    vertexShader: 'attribute float aA; varying float vA; uniform float uSize, uScale; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(uSize * uScale / max(-mv.z, 0.1), 14.0); vA = aA * smoothstep(0.6, 2.0, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; uniform float uOp; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5), a = smoothstep(0.5, 0.12, d) * vA * uOp; if (a < 0.01) discard; gl_FragColor = vec4(uCol, a); }',
    transparent: true, depthWrite: false, blending: K.add ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 4; scene.add(pts);
  systems[name] = { K, pts, pos, a, vel: new Float32Array(K.n * 3), ph: Float32Array.from({ length: K.n }, () => rnd() * 6.28), init: false };
}
const respawn = (S, i, c, top) => {
  const K = S.K, x = c.x + (rnd() - 0.5) * 2 * K.R, z = c.z + (rnd() - 0.5) * 2 * K.R, g = groundAt(x, z);
  S.pos[i * 3] = x; S.pos[i * 3 + 2] = z; S.pos[i * 3 + 1] = top ? Math.max(g, c.y) + K.H * (0.6 + rnd() * 0.4) : g + 0.3 + rnd() * K.H;
};

// amounts 0..1 per kind; c: the camera position; t: seconds. With dt 0 (screenshot tests hold everything still) each
// amount is taken at once rather than eased, so a still picture never keeps what an earlier place had.
let fireflies = 0;
export function updateAmbient(dt, c, amounts, t) {
  const scale = renderer.domElement.height / 2, ease = dt === 0 ? 1 : Math.min(1, dt * 0.8);
  // fireflies want a clear night: fewer under cloud, none in the rain (the amount brings that)
  fireflies += (Math.max(0, Math.min(1, amounts.firefly || 0)) * (1 - WEATHER.k.overcast * 0.7) - fireflies) * ease; updateFireflies(fireflies, c, t);
  updateDrift(dt, c, t);
  for (const [name, S] of Object.entries(systems)) {
    const amt = Math.max(0, Math.min(1, amounts[name] || 0)), m = S.pts.material; m.uniforms.uOp.value += (amt - m.uniforms.uOp.value) * ease;
    const op = m.uniforms.uOp.value; S.pts.visible = op > 0.01; if (!S.pts.visible) { S.init = false; continue; }
    m.uniforms.uScale.value = scale;
    const K = S.K, n = K.n, p = S.pos;
    if (!S.init) { for (let i = 0; i < n; i++) respawn(S, i, c, false); S.init = true; }
    for (let i = 0; i < n; i++) {
      let x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2]; const ph = S.ph[i];
      if (name === 'pollen') { x += (0.35 + Math.sin(t * 0.3 + ph) * 0.2) * dt; y += Math.sin(t * 0.9 + ph * 3) * 0.12 * dt; z += Math.cos(t * 0.4 + ph) * 0.15 * dt; S.a[i] = 0.5 + 0.5 * Math.sin(t * 0.5 + ph); }
      else if (name === 'leaf') { y -= (0.55 + (ph % 1) * 0.4) * dt; x += (Math.sin(t * 1.7 + ph * 4) * 0.6 + 0.25) * dt; z += Math.cos(t * 1.3 + ph * 2) * 0.4 * dt; S.a[i] = 0.9; }
      else { x += (3.5 + Math.sin(t + ph) * 1.5) * dt; y -= (0.6 + (ph % 1) * 0.6) * dt; z += Math.sin(t * 2 + ph * 7) * 0.8 * dt; S.a[i] = 0.85; }
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
      // drifted out of the box round the camera, or fallen to the ground: start again somewhere else in the box
      if (Math.abs(x - c.x) > K.R || Math.abs(z - c.z) > K.R || y < c.y - K.H || y > c.y + K.H * 1.5 || ((name === 'leaf' || name === 'snow') && y < groundAt(x, z))) respawn(S, i, c, name === 'leaf' || name === 'snow');
    }
    S.pts.geometry.attributes.position.needsUpdate = true; S.pts.geometry.attributes.aA.needsUpdate = true;
  }
}

// ---- The biomes' life in the air, on the GPU. Each kind is a few dozen to a few hundred points whose places are fixed in
// the world (a box of them wrapped round the camera, as the fireflies), each moving on its own loop by the clock, set on
// the ground from the grass's height map; gone at the box's edge and in the fog. n: how many, box: the box's size (m),
// size: across (m), add: glowing (added) rather than laid over.
const DRIFT = {
  butterfly: { n: 64, box: 44, size: 0.24, add: false },
  mote: { n: 360, box: 30, size: 0.035, add: true },
  marshMist: { n: 70, box: 90, size: 9, add: false },
  gas: { n: 48, box: 46, size: 0.5, add: true },
};
// where each kind is and how it moves (p: its place, h: how high over the ground, s: the size; aSeed four numbers 0..1)
const MOVE = {
  butterfly: `vec2 off = vec2(sin(t * (0.23 + aSeed.y * 0.2) + ph * 3.0) + 0.6 * sin(t * 1.3 + ph), cos(t * (0.19 + aSeed.z * 0.2) + ph * 2.0) + 0.6 * cos(t * 1.1 + ph * 5.0)) * 2.6;
    h = 0.35 + aSeed.z * 1.3 + abs(sin(t * 2.1 + ph * 4.0)) * 0.35; vK = abs(sin(t * (11.0 + aSeed.y * 6.0) + ph * 9.0));`,
  mote: `vec2 off = vec2(sin(t * 0.07 + ph * 3.0), cos(t * 0.05 + ph * 2.0)) * 3.0 + uWind * t * 0.04;
    h = mod(0.3 + aSeed.z * 9.0 + sin(t * 0.11 + ph) * 0.6 - t * 0.03, 9.0); vK = 0.6 + 0.4 * sin(t * 0.9 + ph * 7.0);`,
  marshMist: `vec2 off = uWind * t * 0.35 + vec2(sin(t * 0.03 + ph), cos(t * 0.025 + ph * 3.0)) * 6.0;
    h = 0.4 + aSeed.z * 1.6; vK = 0.5 + 0.5 * sin(t * 0.05 + ph * 5.0); s *= 0.6 + aSeed.y * 0.8;`,
  gas: `float life = fract(t / (7.0 + aSeed.y * 6.0) + aSeed.z * 5.0); vec2 off = vec2(sin(ph * 5.0), cos(ph * 3.0)) * 4.0 + vec2(sin(t * 0.4 + ph), cos(t * 0.3 + ph)) * 0.3 * life;
    h = 0.1 + life * 2.6; vK = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.55, 1.0, life)); s *= 0.6 + life * 1.4;`,
};
// how each looks (vK from MOVE: a butterfly's wings beating, a mote's twinkle, a wisp's life; vA how much it shows)
const LOOK = {
  butterfly: `vec2 q = gl_PointCoord - 0.5; float wing = 0.12 + 0.3 * vK; vec2 l = vec2(abs(q.x) - wing * 0.55, q.y) / vec2(wing * 0.6 + 0.02, 0.24);
    float a = step(dot(l, l), 1.0) + step(abs(q.x), 0.03) * step(abs(q.y), 0.22); if (a < 0.5 || vA < 0.01) discard;
    gl_FragColor = vec4(vCol * (abs(q.x) < 0.03 ? 0.3 : 1.0), vA);`,
  mote: `float r = length(gl_PointCoord - 0.5) * 2.0, a = pow(max(1.0 - r, 0.0), 2.0) * vA; if (a < 0.003) discard; gl_FragColor = vec4(vCol * a, 1.0);`,
  marshMist: `float r = length(gl_PointCoord - 0.5) * 2.0, a = pow(max(1.0 - r, 0.0), 1.8) * vA; if (a < 0.003) discard; gl_FragColor = vec4(vCol, a);`,
  gas: `float r = length(gl_PointCoord - 0.5) * 2.0, a = pow(max(1.0 - r, 0.0), 2.5) * vA; if (a < 0.003) discard; gl_FragColor = vec4(vCol * a, 1.0);`,
};
// each one's colour and how much it shows (the motes by the sun where it reaches them: the near shadow map)
const SHADE = {
  butterfly: `float hue = fract(aSeed.w * 7.3); vCol = (hue < 0.3 ? vec3(0.95, 0.92, 0.8) : hue < 0.55 ? vec3(0.95, 0.75, 0.15) : hue < 0.8 ? vec3(0.9, 0.42, 0.1) : vec3(0.3, 0.45, 0.95)) * uLight; vA = 1.0;`,
  mote: `vec4 sc = uShadowMat * vec4(p, 1.0); sc.xyz /= sc.w; float inBox = step(0.0, sc.x) * step(sc.x, 1.0) * step(0.0, sc.y) * step(sc.y, 1.0);
    float lit = inBox * step(sc.z - 0.001, dot(texture2D(uShadow, sc.xy), vec4(255.0 / 256.0) / vec4(16777216.0, 65536.0, 256.0, 1.0)));
    vCol = uSunCol * lit * 0.9 + vec3(0.03); vA = vK * (0.05 + lit * 0.95);`,
  marshMist: `vCol = uCol; vA = 0.22 * vK * smoothstep(3.0, 14.0, d);`,
  gas: `vCol = mix(vec3(0.55, 0.85, 0.5), vec3(0.75, 0.95, 0.7), aSeed.w) * (0.25 + uNight * 0.9); vA = vK;`,
};
const drift = {};
{ let sd = 71; const r = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646;
  for (const [name, K] of Object.entries(DRIFT)) {
    const g = new THREE.BufferGeometry(), seed = new Float32Array(K.n * 4); for (let i = 0; i < seed.length; i++) seed[i] = r();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(K.n * 3), 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const U = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uAmount: { value: 0 }, uScale: { value: 400 }, uFogR: { value: new THREE.Vector2(300, 2400) },
      uWind: { value: new THREE.Vector2() }, uLight: { value: 1 }, uNight: { value: 0 }, uCol: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
      uShadow: ATMO.tShadowN, uShadowMat: ATMO.shadowMatN, uHeight: grassU.uHeight, uOrigin: grassU.uOrigin, uSize: grassU.uSize };
    const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: K.add ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `uniform vec3 uCam, uCol, uSunCol; uniform float uTime, uAmount, uScale, uLight, uNight, uSize; uniform vec2 uFogR, uWind, uOrigin; uniform sampler2D uHeight, uShadow; uniform mat4 uShadowMat;
        attribute vec4 aSeed; varying float vA, vK; varying vec3 vCol;
        void main() {
          vA = 0.0; vK = 0.0; vCol = vec3(0.0); gl_PointSize = 0.0; gl_Position = vec4(0.0, 0.0, -2.0, 1.0);   // (hidden: behind the near plane)
          if (aSeed.w > uAmount) return;                                                                          // (a thin show has only some of them)
          vec2 c = uCam.xz + mod(vec2(aSeed.x, aSeed.y) * ${K.box}.0 - uCam.xz, ${K.box}.0) - ${K.box / 2}.0;
          float t = uTime, ph = aSeed.z * 6.2832, h = 0.0, s = ${K.size.toFixed(3)};
          ${MOVE[name]}
          vec2 xz = c + off, huv = (xz - uOrigin) / uSize; if (huv.x < 0.0 || huv.y < 0.0 || huv.x > 1.0 || huv.y > 1.0) return;
          vec3 p = vec3(xz.x, texture2D(uHeight, huv).r + h, xz.y);
          vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z; if (d < 0.3) return;
          ${SHADE[name]}
          vec2 e = abs(xz - uCam.xz); vA *= (1.0 - smoothstep(${(K.box * 0.36).toFixed(1)}, ${(K.box * 0.48).toFixed(1)}, max(e.x, e.y))) * (1.0 - smoothstep(uFogR.x, uFogR.y, d)) * smoothstep(0.5, 1.5, d);
          gl_PointSize = clamp(s * uScale / d, 1.5, 256.0); gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vA, vK; varying vec3 vCol; void main() { ${LOOK[name]} }`,
    });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 4; scene.add(pts);
    drift[name] = { pts, U, k: 0 };
  }
}
const _bw = { p: 1, y: 0, v: 0, r: 0 };
// The biomes' kinds: how many by where the camera is, the hour and the weather, eased (at once in still pictures, dt 0)
function updateDrift(dt, c, t) {
  const w = biomeWeights(c.x, c.z, _bw), marsh = Math.min(1, w.v / 0.3), dry = 1 - Math.min(1, WEATHER.k.rain * 1.5), clear = 1 - WEATHER.k.overcast * 0.8, day = LIGHT.day * Math.min(1, Math.max(0, LIGHT.elev / 0.1));
  const want = { butterfly: day * w.p * dry * clear * (1 - WEATHER.k.fog), mote: day * w.y * dry * clear, marshMist: marsh * (0.7 + 0.3 * LIGHT.night), gas: marsh * dry * (0.5 + 0.5 * LIGHT.night) };
  const ease = dt === 0 ? 1 : Math.min(1, dt * 0.5), scale = renderer.domElement.height / 2;
  for (const [name, D] of Object.entries(drift)) {
    D.k += (want[name] - D.k) * ease; D.pts.visible = D.k > 0.01; if (!D.pts.visible) continue;
    const U = D.U; U.uAmount.value = D.k; U.uCam.value.copy(c); U.uTime.value = t; U.uScale.value = scale; U.uFogR.value.set(scene.fog.near, scene.fog.far);
    U.uWind.value.copy(WIND.dir).multiplyScalar(WIND.speed); U.uLight.value = 0.15 + 0.5 * LIGHT.day * (1 - WEATHER.k.overcast * 0.5); U.uNight.value = LIGHT.night;
    U.uCol.value.copy(scene.fog.color).lerp(ATMO.lowCol.value, 0.5).multiplyScalar(1.1); U.uSunCol.value.copy(ATMO.sunCol.value).multiplyScalar(0.8);
  }
}
