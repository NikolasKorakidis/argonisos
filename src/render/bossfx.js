// The bosses' presence and their end (trial.js). Two effects, each one draw of points whose every movement is worked out
// in the vertex shader (as the fireflies' and the rain's are), so the main thread only sets a few uniforms a frame:
// - aura: always about a living boss, bound to it as it moves. Round the Minotaur a dark dust swirls low about his
//   hooves, embers rise round him and his muzzle snorts smoke and sparks every few seconds; along the Chimera's long back
//   smoke drifts off on the wind, fiery flecks stream from its mane and flanks, and sparks spit from the lion's jaws.
//   What has risen trails behind as the beast goes (uVel), so a charge leaves a wake.
// - dissolve: its body breaking into particles and blowing away. Every bit is sampled from the pose the body lies in, in
//   its own colours (its texture read at each bit); the body glows up from where Zeus's bolt struck (from), then is torn
//   off in a wave running out from there, each bit flung up and away on the wind (wind.js), cooling from ember to ash.
// Both blend premultiplied, so the dark smoke and ash darken what lies behind them while the embers add light, in one
// draw; the embers are bright enough for the bloom to catch. Made at load and kept in the scene unseen, so their shaders
// are compiled with the rest (warmBossFx: main.js warmUp).
import * as THREE from 'three';
import { scene, renderer, sun, hemi } from './core.js';
import { WIND } from '../world/wind.js';

export const BOSSFX = { aura: null, dissolves: 0, bits: 0 };   // (for the tests: who the aura is on, how many bodies went and into how many bits)
const BLEND = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation };
const COMMON = `uniform float uScale; uniform vec2 uFogR;
  // (a point size in pixels for s metres at view depth d)
  float px(float s, float d) { return clamp(s * projectionMatrix[1][1] * uScale / max(d, 0.1), 1.0, 300.0); }
  float fog(float d) { return 1.0 - smoothstep(uFogR.x, uFogR.y * 1.2, d); }`;
// (vC.rgb the colour, vC.a how opaque; soft: a puff fading to its edge (smoke, dust), else a disc with a soft rim (embers,
// ash, the body's bits); cover: how much it hides what's behind it, the rest of it adding light)
const FRAG = `varying vec4 vC; varying float vSoft, vCover;
  void main() { float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard;
    float a = mix(smoothstep(1.0, 0.6, r), pow(1.0 - r, 1.6), vSoft) * vC.a; if (a < 0.003) discard;
    gl_FragColor = vec4(vC.rgb * a, a * vCover); }`;

// ---- the aura
const N = 1100;
const AURA_U = { uCenter: { value: new THREE.Vector3() }, uYaw: { value: 0 }, uVel: { value: new THREE.Vector3() }, uHead: { value: new THREE.Vector3() }, uTime: { value: 0 }, uAmount: { value: 0 },
  uKind: { value: 0 }, uH: { value: 10 }, uR: { value: 2.4 }, uBody: { value: new THREE.Vector2(-1, 1) }, uWind: { value: new THREE.Vector2(1, 0) }, uScale: { value: 400 }, uFogR: { value: new THREE.Vector2(300, 2400) } };
const auraGeo = (() => {
  const g = new THREE.BufferGeometry(), a = new Float32Array(N * 4), b = new Float32Array(N * 4); let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < N * 4; i++) { a[i] = r(); b[i] = r(); }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(a, 4)); g.setAttribute('aSeed2', new THREE.BufferAttribute(b, 4)); return g;
})();
const auraMat = new THREE.ShaderMaterial({ uniforms: AURA_U, ...BLEND,
  vertexShader: `${COMMON}
    uniform vec3 uCenter, uVel, uHead; uniform float uYaw, uTime, uAmount, uKind, uH, uR; uniform vec2 uBody, uWind;
    attribute vec4 aSeed, aSeed2; varying vec4 vC; varying float vSoft, vCover;
    const float TAU = 6.2832;
    void main() {
      vC = vec4(0.0); vSoft = 0.0; vCover = 0.0; gl_PointSize = 0.0; gl_Position = vec4(0.0, 0.0, -2.0, 1.0);   // (hidden: behind the near plane)
      if (fract(aSeed.w * 7.31) > uAmount) return;                                                          // (thinning in as it comes, out as it dies)
      vec2 fw = vec2(sin(uYaw), cos(uYaw)), sd = vec2(cos(uYaw), -sin(uYaw));
      vec3 F = vec3(fw.x, 0.0, fw.y), Sd = vec3(sd.x, 0.0, sd.y), W = vec3(uWind.x, 0.0, uWind.y);
      float k = aSeed.x, L, u, age, size, alpha; vec3 p, col; float soft = 0.0, cover = 0.0;
      if (uKind < 0.5) {
        if (k < 0.5) {   // the Minotaur's dust, swirling low round his hooves, all one way, rising a little and spreading as it goes
          L = mix(3.0, 6.0, aSeed.y); u = fract(uTime / L + aSeed.z); age = u * L;
          float r = uR * (1.0 + 1.9 * aSeed2.x) * (1.0 + 0.35 * u), a = aSeed2.y * TAU + age * (0.55 + 0.35 * aSeed2.z);
          p = uCenter + vec3(cos(a) * r, 0.15 + u * (0.8 + 2.6 * aSeed2.w), sin(a) * r) + W * age * 0.15 - uVel * age * 0.7;
          col = mix(vec3(0.075, 0.06, 0.05), vec3(0.16, 0.12, 0.09), aSeed2.z); alpha = 0.55 * sin(3.1416 * u); size = (1.5 + 1.8 * aSeed2.x) * (0.6 + 0.7 * u); soft = 1.0; cover = 1.0;
        } else if (k < 0.88) {   // embers rising round him in a loose spiral, flickering
          L = mix(1.8, 3.8, aSeed.y); u = fract(uTime / L + aSeed.z); age = u * L;
          float r = uR * (0.55 + 1.3 * aSeed2.x), a = aSeed2.y * TAU + age * (0.9 + 0.7 * aSeed2.z);
          p = uCenter + vec3(cos(a) * r, u * uH * (0.45 + 0.75 * aSeed2.w), sin(a) * r) + W * age * 0.35 - uVel * age * 0.85;
          float fl = 0.55 + 0.45 * sin(uTime * (9.0 + 8.0 * aSeed2.z) + aSeed.w * 40.0);
          col = mix(vec3(1.0, 0.5, 0.12), vec3(0.85, 0.14, 0.03), u) * 6.5 * fl; alpha = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.55, 1.0, u)); size = 0.15 + 0.17 * aSeed2.x;
        } else {   // a snort every few seconds: smoke out of his muzzle, down and forward, with sparks in it
          float P = 4.5, cyc = floor(uTime / P); age = mod(uTime, P) - aSeed.z * 0.35; L = mix(1.2, 2.4, aSeed.y); if (age < 0.0 || age > L) return; u = age / L;
          vec3 dir = normalize(F * 1.0 + vec3(0.0, -0.35, 0.0) + (vec3(aSeed2.x, aSeed2.y, aSeed2.z) - 0.5) * 0.9 + Sd * (fract(cyc * 0.37) - 0.5) * 0.6);
          p = uHead + F * uR * 0.35 + dir * (3.5 + 3.0 * aSeed2.w) * (1.0 - exp(-age * 2.2)) / 2.2 + vec3(0.0, age * age * 0.6, 0.0) - uVel * age * 0.6;
          if (aSeed2.w < 0.72) { col = vec3(0.09, 0.08, 0.075); alpha = 0.5 * (1.0 - u) * smoothstep(0.0, 0.1, age); size = 0.35 + 1.4 * u; soft = 1.0; cover = 1.0; }
          else { col = vec3(1.0, 0.6, 0.2) * 6.0; alpha = (1.0 - u); size = 0.08; }
        }
      } else {
        float z0 = mix(uBody.x, uBody.y, aSeed2.x);
        if (k < 0.42) {   // the Chimera's smoke, off its back and carried away on the wind
          L = mix(3.0, 6.0, aSeed.y); u = fract(uTime / L + aSeed.z); age = u * L;
          vec3 b = uCenter + F * z0 + Sd * (aSeed2.y - 0.5) * uR * 0.8 + vec3(0.0, uH * (0.5 + 0.3 * aSeed2.w), 0.0);
          p = b + vec3(0.0, age * (0.9 + 0.8 * aSeed2.z), 0.0) + W * age * (0.8 + 0.5 * aSeed2.z) - uVel * age * 0.8;
          col = mix(vec3(0.06, 0.055, 0.05), vec3(0.2, 0.1, 0.05), (1.0 - u) * 0.6); alpha = 0.34 * sin(3.1416 * u); size = (1.4 + 1.8 * aSeed2.x) * (0.5 + 0.9 * u); soft = 1.0; cover = 1.0;
        } else if (k < 0.86) {   // fiery flecks streaming off its mane and flanks, most from the forequarters
          L = mix(1.4, 3.2, aSeed.y); u = fract(uTime / L + aSeed.z); age = u * L;
          float z = mix(uBody.x, uBody.y + uR * 0.6, pow(aSeed2.x, 0.45));
          vec3 b = uCenter + F * z + Sd * (aSeed2.y - 0.5) * uR * 1.3 + vec3(0.0, uH * (0.25 + 0.55 * aSeed2.w), 0.0);
          p = b + vec3(0.0, age * (1.4 + 1.6 * aSeed2.z), 0.0) + W * age * 0.6 + vec3(sin(age * 3.0 + aSeed.w * 30.0), 0.0, cos(age * 2.6 + aSeed.w * 20.0)) * 0.5 - uVel * age * 0.9;
          float fl = 0.6 + 0.4 * sin(uTime * (11.0 + 9.0 * aSeed2.z) + aSeed.w * 50.0);
          col = mix(vec3(1.0, 0.62, 0.18), vec3(0.9, 0.2, 0.04), u) * 3.2 * fl; alpha = smoothstep(0.0, 0.1, u) * (1.0 - smoothstep(0.5, 1.0, u)); size = 0.09 + 0.1 * aSeed2.x;
        } else {   // sparks spitting from the lion's jaws, arcing out and falling
          L = mix(0.6, 1.3, aSeed.y); u = fract(uTime / L + aSeed.z); age = u * L;
          vec3 v = F * (2.0 + 4.0 * aSeed2.x) + Sd * (aSeed2.y - 0.5) * 4.0 + vec3(0.0, 1.0 + 3.0 * aSeed2.z, 0.0);
          p = uHead + F * uR * 0.4 + v * age + vec3(0.0, -4.9 * age * age, 0.0) - uVel * age;
          col = mix(vec3(1.0, 0.85, 0.5), vec3(1.0, 0.35, 0.05), u) * 4.5; alpha = 1.0 - u; size = 0.06 + 0.05 * aSeed2.w;
        }
      }
      vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z; if (d < 0.3) return;
      // (gone before they reach the lens: the boss camera is close, and a glowing fleck a metre or two away blooms into a disc)
      vC = vec4(col, alpha * fog(d) * smoothstep(1.2, 4.5, d)); vSoft = soft; vCover = cover;
      gl_PointSize = px(size, d); gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: FRAG,
});
const aura = new THREE.Points(auraGeo, auraMat); aura.frustumCulled = false; aura.visible = false; aura.renderOrder = 4; scene.add(aura);
// how the aura sits on each boss: its height and girth (from TYPES: h, r), its long body's span along its heading (the
// Chimera's: T.body) and the bone its snorts and sparks come from
const LOOK = { minotaur: { kind: 0, head: 'Head' }, chimera: { kind: 1, head: 'head' } };
const A = { c: null, t: 0, k: 0, last: new THREE.Vector3(), vel: new THREE.Vector3(), head: new THREE.Vector3() };
// put the aura on a boss (null: none); it fades in over a second or so, and out over a couple once the boss is dead
export function bossAura(c) { if (A.c === c) return; A.c = c; A.k = 0; BOSSFX.aura = c?.type || null; if (c) { A.last.copy(c.pos); A.vel.set(0, 0, 0); } }
function updateAura(dt) {
  const c = A.c, L = c && LOOK[c.type]; if (!L) { aura.visible = false; return; }
  A.t += dt; A.k = c.dead || c.gone ? Math.max(0, A.k - dt * (c.gone ? 2 : 0.45)) : Math.min(1, A.k + dt * 0.8);
  if (c.gone && A.k <= 0) { A.c = null; BOSSFX.aura = null; aura.visible = false; return; }
  aura.visible = A.k > 0.01; if (!aura.visible) return;
  const T = c.T, U = AURA_U;
  if (dt > 0) A.vel.lerp(new THREE.Vector3().subVectors(c.pos, A.last).divideScalar(dt).setY(0), Math.min(1, dt * 4)); A.last.copy(c.pos);
  const hp = c.body.point?.(L.head); if (hp) A.head.copy(hp); else A.head.copy(c.pos).setY(c.pos.y + T.h * 0.85);
  U.uCenter.value.copy(c.pos); U.uYaw.value = c.yaw; U.uVel.value.copy(A.vel); U.uHead.value.copy(A.head); U.uTime.value = A.t; U.uAmount.value = A.k;
  U.uKind.value = L.kind; U.uH.value = T.h; U.uR.value = T.r; if (T.body) U.uBody.value.set(T.body[0], T.body[1]); else U.uBody.value.set(-T.r, T.r);
  U.uWind.value.copy(WIND.dir).multiplyScalar(0.6 + WIND.speed * 0.35); U.uScale.value = renderer.domElement.height / 2; U.uFogR.value.set(scene.fog?.near ?? 300, scene.fog?.far ?? 2400);
}

// ---- the body blowing away
const DIS_U = { uT: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector3() }, uSize: { value: 0.3 }, uLit: { value: 1 }, uGlow: { value: 0 }, uScale: AURA_U.uScale, uFogR: AURA_U.uFogR };
const disMat = new THREE.ShaderMaterial({ uniforms: DIS_U, ...BLEND,
  vertexShader: `${COMMON}
    uniform float uT, uSize, uLit, uGlow; uniform vec3 uCenter, uWind;
    attribute vec3 aCol; attribute vec4 aSeed; varying vec4 vC; varying float vSoft, vCover;
    void main() {
      vC = vec4(0.0); vSoft = 0.0; vCover = 0.0; gl_PointSize = 0.0; gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
      float t = uT - aSeed.w, L = 2.2 + 2.0 * aSeed.x;   // (aSeed.w: when this bit is torn off; L: how long it flies)
      if (t > L) return;
      vec3 p = position, ember = vec3(1.0, 0.42, 0.1), ash = vec3(0.1, 0.09, 0.085); float heat, alpha = 1.0, size = uSize * (0.75 + 0.5 * aSeed.y);
      if (t < 0.0) {   // still on the body, glowing up as the wave nears
        heat = max(uGlow * 0.55, smoothstep(-0.6, 0.0, t));
        vC.rgb = mix(aCol * uLit, ember * 3.5, heat);
      } else {   // torn off: out from the body a little, up, and away on the wind, faster as it goes, tumbling in the eddies
        vec3 away = normalize(p - uCenter + vec3(0.0, 0.01, 0.0)), r = aSeed.xyz - 0.5, v = away * (0.6 + 2.0 * aSeed.y) + vec3(0.0, 1.0 + 2.6 * aSeed.z, 0.0) + r * 1.8;
        p += v * t + uWind * (0.5 * t * t) * (0.7 + 0.8 * aSeed.x) + vec3(0.0, 0.5 * t * t, 0.0) + vec3(sin(t * 2.7 + aSeed.x * 31.0), 0.6 * cos(t * 2.1 + aSeed.y * 17.0), sin(t * 2.3 + aSeed.z * 23.0)) * 0.7 * t;
        heat = exp(-t * (1.4 + aSeed.z)); float u = t / L;
        vC.rgb = mix(ash, ember * 5.0, heat * heat); alpha = 1.0 - smoothstep(0.4, 1.0, u); size *= 1.0 - 0.6 * u;
      }
      vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z; if (d < 0.2) return;
      vC.a = alpha * fog(d); vSoft = 0.0; vCover = 1.0 - 0.75 * heat;   // (hot, it adds light; cooled, it covers)
      gl_PointSize = px(size, d); gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: FRAG,
});
const dis = new THREE.Points(new THREE.BufferGeometry(), disMat); dis.frustumCulled = false; dis.visible = false; dis.renderOrder = 4; scene.add(dis);
const D = { on: false, t: 0, end: 0 };
const pix = new WeakMap(), _v = new THREE.Vector3(), _c = new THREE.Color();
// a texture's pixels, read once (small: only for the colour of each bit), or null if they can't be
function pixels(tex) {
  const img = tex?.image; if (!img) return null; if (pix.has(img)) return pix.get(img);
  let out = null; try { const w = Math.min(256, img.width || 0), h = Math.min(256, img.height || 0); if (w && h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h); out = { w, h, d: x.getImageData(0, 0, w, h).data, flip: tex.flipY }; } } catch { out = null; }
  pix.set(img, out); return out;
}
// The body (a creature's, models.js) breaks up: n bits over its surface as it lies now, each torn off from secs after the
// start, those nearest from (where the bolt struck) first; it is best hidden once uGlow has come up (glowFor seconds:
// trial.js hides it then). Returns how many bits.
export function dissolve(obj, from, { n = 14000, glowFor = 0.35, spread = 1.7 } = {}) {
  obj.updateMatrixWorld(true);
  const tris = [], parts = [];   // (each triangle: its part, its three corners, its area so far)
  let total = 0;
  obj.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes.position) return;
    const G = o.geometry, pos = G.attributes.position, uv = G.attributes.uv, nv = pos.count, P = new Float32Array(nv * 3), mt = [].concat(o.material)[0];
    for (let i = 0; i < nv; i++) { _v.fromBufferAttribute(pos, i); if (o.isSkinnedMesh) o.applyBoneTransform(i, _v); _v.applyMatrix4(o.matrixWorld).toArray(P, i * 3); }
    const part = { P, uv, px: pixels(mt?.map), col: mt?.color ? mt.color.clone() : new THREE.Color(0.5, 0.45, 0.4) }; parts.push(part);
    const idx = G.index ? G.index.array : null, m = idx ? idx.length : nv;
    for (let t = 0; t + 2 < m; t += 3) { const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, c = idx ? idx[t + 2] : t + 2;
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      const ar = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); if (!(ar > 0)) continue; total += ar; tris.push(part, a, b, c, total); }
  });
  if (!total) return 0;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed = new Float32Array(n * 4), ctr = new THREE.Vector3(), nt = tris.length / 5;
  let far = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.random() * total; let lo = 0, hi = nt - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (tris[mid * 5 + 4] < x) lo = mid + 1; else hi = mid; }
    const part = tris[lo * 5], a = tris[lo * 5 + 1], b = tris[lo * 5 + 2], c = tris[lo * 5 + 3], P = part.P; let r1 = Math.random(), r2 = Math.random(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; } const r0 = 1 - r1 - r2;
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = P[a * 3 + k] * r0 + P[b * 3 + k] * r1 + P[c * 3 + k] * r2;
    _c.copy(part.col);
    if (part.px && part.uv) { const U = part.uv, u = U.getX(a) * r0 + U.getX(b) * r1 + U.getX(c) * r2, v = U.getY(a) * r0 + U.getY(b) * r1 + U.getY(c) * r2, q = part.px;
      const px = Math.min(q.w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * q.w))), py = Math.min(q.h - 1, Math.max(0, Math.floor(((q.flip ? 1 - v : v) - Math.floor(q.flip ? 1 - v : v)) * q.h))), j = (py * q.w + px) * 4;
      _c.multiply(new THREE.Color().setRGB(q.d[j] / 255, q.d[j + 1] / 255, q.d[j + 2] / 255, THREE.SRGBColorSpace)); }
    _c.toArray(col, i * 3); ctr.x += pos[i * 3]; ctr.y += pos[i * 3 + 1]; ctr.z += pos[i * 3 + 2];
    seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random();
  }
  ctr.divideScalar(n);
  for (let i = 0; i < n; i++) far = Math.max(far, Math.hypot(pos[i * 3] - from.x, pos[i * 3 + 1] - from.y, pos[i * 3 + 2] - from.z));
  for (let i = 0; i < n; i++) seed[i * 4 + 3] = glowFor + spread * Math.hypot(pos[i * 3] - from.x, pos[i * 3 + 1] - from.y, pos[i * 3 + 2] - from.z) / far + 0.3 * Math.random();   // (the wave running out from the strike)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  dis.geometry.dispose(); dis.geometry = g; dis.visible = true;
  // (the bits' size: about the spacing between them, so the body reads whole until it goes; the light it lies in, so its
  // colours are near what the lit body showed)
  DIS_U.uSize.value = Math.sqrt(total / n) * 1.7; DIS_U.uCenter.value.copy(ctr); DIS_U.uT.value = 0; DIS_U.uGlow.value = 0;
  DIS_U.uLit.value = Math.min(1, Math.max(0.08, sun.intensity / 2.6 * 0.5 + hemi.intensity * 0.3));
  DIS_U.uWind.value.set(WIND.dir.x, 0, WIND.dir.y).multiplyScalar(Math.max(2.5, WIND.speed * 0.9));
  D.on = true; D.t = 0; D.glowFor = glowFor; D.end = glowFor + spread + 0.3 + 4.3; BOSSFX.dissolves++; BOSSFX.bits = n;
  return n;
}
function updateDissolve(dt) {
  if (!D.on) return; D.t += dt; DIS_U.uT.value = D.t; DIS_U.uGlow.value = Math.min(1, D.t / D.glowFor);
  if (D.t > D.end) { D.on = false; dis.visible = false; dis.geometry.dispose(); dis.geometry = new THREE.BufferGeometry(); }
}
export const dissolving = () => D.on;
// per frame (trial.js, even while a menu is open, as a boss's coming is)
export function updateBossFx(dt) { updateAura(dt); updateDissolve(dt); }
// stand-ins of both, for the loading screen to compile (main.js warmUp)
export function warmBossFx(w) { for (const m of [auraMat, disMat]) { const p = new THREE.Points(auraGeo, m); p.frustumCulled = false; w.add(p); } }
