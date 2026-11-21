// The river's water (Patch 24), drawn over the channel river.js carves: the surface, the falls' curtains and their spray.
//
// The surface is a mesh over the river's corridor, in tiles of 2 m squares laid on the world grid, each vertex at the
// river's level there (river.js waterAt, the same function the ground was carved by, so the banks hide its edges and the
// water line is where the ground meets it) and carrying the way and speed the water flows, its depth and how much foam
// rides on it; gathered into chunks some 150 m along the river, culled as such.
//
// On Medium and up the water is drawn over a copy of the scene as it stands before it (grab: the colour and the depth of
// everything opaque, copied out of the multisampled scene buffer when the first chunk is drawn): so it shows the real bed
// through itself, bent by the ripples (refraction), dimmed and coloured by how much water the eye looks through (light
// absorbed red first, then green: clear green-blue over the shallows, dark in the pools), with the sun's caustics playing
// on the bed; on High and Ultra it mirrors the banks, the trees and the mountain by marching the reflected line of sight
// through that depth (screen-space reflections, the sea's way: atmosphere.js SEA_SSR), and where that finds nothing,
// the sky as drawn behind it, else the sky's colours. Fresnel decides how much is mirror and how much is water. The
// ripples ride the current (a flow map of two phases, crossfaded), quick and broken over the riffles and the rapids, the
// lake all but still but for the wind's ripples; foam gathers on the riffles, at the banks and below the falls, and rain
// rings it. On Low (no copy of the scene) it is drawn see-through over the bed instead.
//
// The falls (river.js RIVER.falls): each a curtain from the lip down the line the water takes as it falls (thrown out a
// little, then dropping), its streaks moving down at the speed falling water has at each height, ragged at the edges and
// breaking up towards the foot; a white plunge and spray thrown up from the pool and mist drifting off it with the wind,
// and, where the sun stands behind you, a rainbow in the mist. All on the GPU: the particles' paths are worked out in
// their vertex shader from the clock.
import * as THREE from 'three';
import { scene, camera, renderer, waterNormals, sceneTarget, GFX, sun, sunFar } from '../render/core.js';
import { RIVER, riverAt } from './river.js';
import { heightAt } from './gen.js';
import { WATER_U } from './water.js';
import { WET_U, RIPPLES } from './wetness.js';
import { WIND_U } from './trees.js';
import { ULTRA } from '../render/quality.js';
import { ATMO, MIST_TONE } from '../render/atmosphere.js';
import { smooth } from '../util/math.js';

const TILE = 32, G = 2, NT = TILE / G + 1, CHUNK = 75;   // (tile size and grid step, m; samples of the course per chunk)
export const RIVER_GFX = { chunks: [], falls: [], grabbed: false, visible: 0, enabled: true };

// ---- The copy of the scene the water is drawn over: the scene's buffer resolved into a plain one of the same size and
// formats (colour and depth), by a framebuffer blit, the first time a chunk is drawn in a frame
const grabRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false });
grabRT.depthTexture = new THREE.DepthTexture(1, 1); grabRT.depthTexture.minFilter = grabRT.depthTexture.magFilter = THREE.NearestFilter;
let grabFrame = -1, frameNo = 0;
function grab(r, cam) {
  if (grabFrame === frameNo) return; grabFrame = frameNo; shadowMats();
  // (the camera as it draws this frame, whatever moved it since the frame began: a shake, the free camera)
  RIVER_U.uProjInv.value.copy(cam.projectionMatrixInverse); RIVER_U.uCamWorld.value.copy(cam.matrixWorld); RIVER_U.uVP.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); RIVER_U.uNF.value.set(cam.near, cam.far);
  const src = sceneTarget(); if (!src || r.getRenderTarget() !== src) return;
  const gl = r.getContext(), st = r.state, p = r.properties.get(src), d = r.properties.get(grabRT), read = p.__webglMultisampledFramebuffer || p.__webglFramebuffer;
  if (!read || !d.__webglFramebuffer || grabRT.width !== src.width || grabRT.height !== src.height) return;
  st.bindFramebuffer(gl.READ_FRAMEBUFFER, read); st.bindFramebuffer(gl.DRAW_FRAMEBUFFER, d.__webglFramebuffer);
  gl.blitFramebuffer(0, 0, src.width, src.height, 0, 0, src.width, src.height, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
  st.bindFramebuffer(gl.FRAMEBUFFER, read);
  RIVER_GFX.grabbed = true;
}
// (kept the scene buffer's size, outside the drawing: a target is made on the GPU when first set)
function fitGrab() {
  const src = sceneTarget(); if (!src) return false;
  if (grabRT.width !== src.width || grabRT.height !== src.height || !renderer.properties.get(grabRT).__webglFramebuffer) {
    grabRT.setSize(src.width, src.height); const prev = renderer.getRenderTarget(); renderer.setRenderTarget(grabRT); renderer.setRenderTarget(prev);
  }
  return true;
}

// ---- The surface's shader
export const RIVER_U = {
  uTime: WATER_U.uTime, uDay: WATER_U.uDay, uSky: WATER_U.uSky, uHor: WATER_U.uHor, uSunDir: WATER_U.uSunDir, uSunCol: WATER_U.uSunCol, uNorm: { value: waterNormals },
  uRainK: WET_U.uRainK, uRainT: WET_U.uRainT, uAmb: { value: new THREE.Color(0.5, 0.6, 0.7) }, uWind: WIND_U.uWindDir,
  tGrab: { value: grabRT.texture }, tGrabD: { value: grabRT.depthTexture }, uRes: { value: new THREE.Vector2(1, 1) }, uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
  uVP: { value: new THREE.Matrix4() }, uNF: { value: new THREE.Vector2(0.15, 6000) },
  tShadow: { value: null }, tShadowN: { value: null }, shadowMat: { value: new THREE.Matrix4() }, shadowMatN: { value: new THREE.Matrix4() }, shNSize: { value: new THREE.Vector2(1, 1) }, uShadowOn: { value: 0 },
  // (the player's mist, as the atmosphere pass lays it: what the water mirrors far off lies in it too, atmosphere.js)
  mzC: ATMO.mzC, mzR0: ATMO.mzR0, mzR1: ATMO.mzR1, mzAmt: ATMO.mzAmt, mzTop: ATMO.mzTop, mzSoft: ATMO.mzSoft, mzCol: ATMO.mzCol, mzColUp: ATMO.mzColUp, mzSun: ATMO.mzSun, mzSunDir: ATMO.mzSunDir,
};
const SHADOW_GLSL = `uniform sampler2D tShadow, tShadowN; uniform mat4 shadowMat, shadowMatN; uniform vec2 shNSize; uniform float uShadowOn;
  float unpackD(vec4 v) { return dot(v, vec4(255.0 / 256.0) / vec4(16777216.0, 65536.0, 256.0, 1.0)); }
  // how much sun reaches a point (1 lit, 0 in shade): the near shadow map, filtered over four texels, eased into the far
  // one towards its edge, and that into lit towards its own (as atmosphere.js nearLit, so the water's shade matches the land's)
  float farLit(vec3 p) { vec4 s = shadowMat * vec4(p, 1.0); s.xyz /= s.w; float k = smoothstep(0.0, 0.12, min(min(s.x, 1.0 - s.x), min(s.y, 1.0 - s.y))) * step(s.z, 1.0);
    return k <= 0.0 ? 1.0 : mix(1.0, step(s.z - 0.0015, unpackD(texture2D(tShadow, s.xy))), k); }
  float tapN(vec2 uv, float z) { return step(z, unpackD(texture2D(tShadowN, uv))); }
  float sunLit(vec3 p) { if (uShadowOn < 0.5) return 1.0; vec4 s = shadowMatN * vec4(p, 1.0); s.xyz /= s.w;
    float k = smoothstep(0.0, 0.1, min(min(s.x, 1.0 - s.x), min(s.y, 1.0 - s.y))) * step(s.z, 1.0), far = farLit(p); if (k <= 0.0) return far;
    vec2 q = s.xy * shNSize - 0.5, f = fract(q), t = 1.0 / shNSize, b = (floor(q) + 0.5) * t; float z = s.z - 0.0008;
    return mix(far, mix(mix(tapN(b, z), tapN(b + vec2(t.x, 0.0), z), f.x), mix(tapN(b + vec2(0.0, t.y), z), tapN(b + t, z), f.x), f.y), k); }`;
const VERT = `attribute vec2 flow; attribute vec4 aux; varying vec3 vW; varying vec2 vFlow; varying vec4 vAux;
  #include <fog_pars_vertex>
  void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vFlow = flow; vAux = aux; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
  }`;
// (aux: x depth to the bed, y foam riding on it, z metres past the water's edge, w how calm: 1 the lake and the deep reach)
const FRAG = `${RIPPLES}${SHADOW_GLSL}
  uniform float uTime, uDay, uRainK, uRainT; uniform vec3 uSky, uHor, uSunDir, uSunCol, uAmb; uniform vec2 uWind; uniform sampler2D uNorm;
  #ifdef GRAB
  uniform sampler2D tGrab, tGrabD; uniform vec2 uRes, uNF; uniform mat4 uProjInv, uCamWorld, uVP; uniform vec2 mzC; uniform float mzR0, mzR1, mzAmt, mzTop, mzSoft;
  ${MIST_TONE}
  float linD(float d) { return uNF.x * uNF.y / (uNF.y - d * (uNF.y - uNF.x)); }
  vec3 worldAt(vec2 uv, float d) { vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); v /= v.w; return (uCamWorld * v).xyz; }
  #endif
  varying vec3 vW; varying vec2 vFlow; varying vec4 vAux;
  #include <fog_pars_fragment>
  vec3 nrm(vec2 uv) { vec3 t = texture2D(uNorm, uv).rgb * 2.0 - 1.0; return vec3(t.r, t.b, t.g); }
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  // the ripples carried by the current: two copies of the pattern, each dragged downstream for one cycle and then sent
  // back, crossfaded so neither's jump shows; each spot's cycle offset by the noise, so the whole river doesn't pulse
  vec3 flowN(vec2 p, vec2 f, float sc, float t, float T) {
    float j = texture2D(uNorm, p * 0.013 + 0.3).g, a = fract(t / T + j), b = fract(t / T + j + 0.5), wa = 1.0 - abs(1.0 - 2.0 * a);
    return nrm((p - f * a * T) * sc) * wa + nrm((p - f * b * T) * sc + 0.43) * (1.0 - wa);
  }
  float foamTex(vec2 p, vec2 f, float t) {   // (lumps of foam carried along, the same two-phase way)
    float j = vn(p * 0.4), a = fract(t * 0.5 + j), b = fract(t * 0.5 + j + 0.5), wa = 1.0 - abs(1.0 - 2.0 * a);
    vec2 pa = p - f * a * 2.0, pb = p - f * b * 2.0 + 1.7;
    return (vn(pa * 1.9) * 0.55 + vn(pa * 5.3) * 0.45) * wa + (vn(pb * 1.9) * 0.55 + vn(pb * 5.3) * 0.45) * (1.0 - wa);
  }
  float caustic(vec2 p, float t) {   // (the sun's light gathered by the ripples into a moving net on the bed)
    vec2 q = p * 0.55; float c1 = abs(sin(q.x * 1.7 + t * 1.1 + sin(q.y * 1.3 - t * 0.7) * 1.6)), c2 = abs(sin(q.y * 1.9 - t * 0.9 + sin(q.x * 1.1 + t * 0.6) * 1.5));
    vec2 r = p * 1.31 + 3.3; float c3 = abs(sin(r.x * 1.5 - t * 0.8 + sin(r.y * 1.7 + t * 0.5) * 1.4)), c4 = abs(sin(r.y * 1.6 + t * 1.0 + sin(r.x * 1.2 - t * 0.6) * 1.3));
    return pow(1.0 - min(c1, c2), 6.0) * 0.7 + pow(1.0 - min(c3, c4), 8.0) * 0.5;
  }
  #ifdef SSR_N
  // the reflected line of sight marched through the copy's depth, in steps growing with the distance, until it passes
  // just behind something; refined by halving; faded towards the screen's edges and far away
  vec4 ssr(vec3 W, vec3 R) {
    // (each pixel starts a little further along than its neighbours, a fixed pattern, so the steps' bands break up into
    // a fine grain instead of lines)
    float jit = 0.0;
    float s = 0.3 + jit * 0.3, s0 = 0.0, hit = 0.0; vec2 u = vec2(0.0);
    for (int i = 0; i < SSR_N; i++) { vec4 q = uVP * vec4(W + R * s, 1.0); if (q.w <= 0.0) break; u = q.xy / q.w * 0.5 + 0.5;
      if (u.x < 0.0 || u.x > 1.0 || u.y < 0.0 || u.y > 1.0) break;
      float sd = texture2D(tGrabD, u).x, zs = linD(sd); if (sd < 0.99999 && q.w > zs && q.w - zs < max(0.5, s * 0.12)) { hit = 1.0; break; }
      s0 = s; s = s * SSR_G + 0.3 * (0.8 + 0.4 * jit); }
    if (hit < 0.5) return vec4(0.0);
    float a = s0, b = s; for (int k = 0; k < 5; k++) { float m = 0.5 * (a + b); vec4 q = uVP * vec4(W + R * m, 1.0); if (q.w > linD(texture2D(tGrabD, q.xy / q.w * 0.5 + 0.5).x)) b = m; else a = m; }
    vec4 q = uVP * vec4(W + R * b, 1.0); u = q.xy / q.w * 0.5 + 0.5; vec2 e = smoothstep(vec2(0.0), vec2(0.06), u) * smoothstep(vec2(1.0), vec2(0.94), u);
    // (softened, more the further the thing mirrored: eight looks round it on a turned pattern, which takes the grain the
    // stepping leaves out of the picture)
    vec2 o = (2.0 + b * 0.05) / uRes; vec3 c = vec3(0.0); float ang = jit * 6.2832;
    for (int k = 0; k < 8; k++) { float a = ang + float(k) * 0.7854, r = 0.5 + 0.5 * fract(float(k) * 0.618 + jit); c += texture2D(tGrab, u + vec2(cos(a), sin(a)) * o * r * 2.0).rgb; }
    c *= 0.125;
    // (and the player's mist over it, as over the thing itself where it stands: the copy is taken before the mist is laid)
    vec3 Q = W + R * b; c = mix(c, mistTone(R), mzAmt * smoothstep(mzR0, mzR1, length(Q.xz - mzC)) * mistUp(Q.y));
    return vec4(c, e.x * e.y * (1.0 - smoothstep(250.0, 600.0, b)));
  }
  #endif
  void main() {
    float t = uTime, speed = length(vFlow), calm = vAux.w; vec3 V = normalize(cameraPosition - vW); float dist = length(cameraPosition - vW);
    // the surface: the current's ripples (two sizes; rougher the quicker it runs), the wind's on the still water, and the
    // rain's rings; smoothed out with distance, where they would only sparkle
    float far = smoothstep(40.0, 260.0, dist), turb = smoothstep(0.25, 1.8, speed);
    vec3 f1 = flowN(vW.xz, vFlow, 0.085, t, 1.7), f2 = flowN(vW.xz, vFlow * 1.15, 0.29, t + 0.7, 1.1);
    vec3 w1 = nrm(vW.xz * 0.045 + uWind * t * 0.012), w2 = nrm(vW.xz * 0.17 - uWind.yx * t * 0.02);
    float fa = (0.5 + 1.6 * turb) * (1.0 - calm) * (1.0 - far * 0.6), wa = mix(0.22, 0.42, calm) * (1.0 - far * 0.5);
    vec3 n = normalize(vec3((f1.x + f2.x * 0.7) * fa + (w1.x + w2.x * 0.6) * wa, 3.0, (f1.z + f2.z * 0.7) * fa + (w1.z + w2.z * 0.6) * wa));
    if (uRainK > 0.01) { vec2 rs = wetRipples(vW.xz, uRainT) * uRainK * (1.0 - smoothstep(20.0, 45.0, dist)); n = normalize(n + vec3(-rs.x, 0.0, -rs.y) * 1.6); }
    float lit = sunLit(vW + vec3(0.0, 0.05, 0.0)), sunUp = smoothstep(-0.05, 0.12, uSunDir.y);
    vec3 L = normalize(uSunDir), amb = uAmb;
    float F = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
    // ---- what lies under it
    vec3 sigma = mix(vec3(0.26, 0.065, 0.05), vec3(0.4, 0.12, 0.1), calm);   // (light absorbed per metre: red soon, green later; the still water a little greener)
    vec3 scat = mix(vec3(0.028, 0.085, 0.075), vec3(0.025, 0.075, 0.06), calm) * (amb * 0.9 + uSunCol * 0.35 * lit * sunUp);
    #ifdef GRAB
    vec2 suv = gl_FragCoord.xy / uRes; float zS = linD(gl_FragCoord.z);
    float d0 = texture2D(tGrabD, suv).x, thick0 = max(linD(d0) - zS, 0.0);
    vec2 ruv = clamp(suv + n.xz * vec2(0.9, 1.0) * 0.05 * smoothstep(0.0, 1.5, thick0) / max(1.0, zS * 0.06), vec2(0.001), vec2(0.999));
    float dR = texture2D(tGrabD, ruv).x; if (linD(dR) < zS) { ruv = suv; dR = d0; }   // (never what stands in front of the water)
    vec3 B = worldAt(ruv, min(dR, 0.99999)); float len = dR >= 0.99999 ? 60.0 : min(distance(B, vW), 60.0), dep = max(vW.y - B.y, 0.0);
    vec3 bed = texture2D(tGrab, ruv).rgb;
    // the caustics, where the sun reaches the bed through the water (the bed's own shade from the shadow map there)
    bed *= 1.0 + caustic(B.xz + n.xz * 0.6, t) * 1.1 * sunUp * uDay * sunLit(B) * exp(-dep * 0.45) * smoothstep(0.03, 0.4, dep) * (1.0 - far);
    vec3 T = exp(-sigma * len);
    vec3 under = bed * T + scat * (1.0 - T);
    float edge = smoothstep(0.0, 0.25, len);
    #else
    float dep = max(vAux.x, 0.0), len = dep / max(V.y, 0.3), edge = smoothstep(0.0, 0.3, dep); vec3 T = exp(-sigma * len);
    vec3 under = scat * (1.0 - T);
    #endif
    // ---- what it mirrors
    vec3 R = reflect(-V, n); R.y = max(R.y, 0.01);
    vec3 sky = mix(uHor, uSky, clamp(R.y * 1.6, 0.0, 1.0)); float cl = vn(R.xz / (R.y + 0.3) * 1.6 + vec2(t * 0.015, 0.0)) * 0.65 + vn(R.xz / (R.y + 0.3) * 4.0) * 0.35;
    sky = mix(sky, vec3(1.0) * mix(0.25, 1.0, uDay), smoothstep(0.55, 0.8, cl) * 0.3 * clamp(R.y * 3.0, 0.0, 1.0));
    vec3 refl = sky;
    #ifdef GRAB
    { vec4 q = uVP * vec4(vW + R * 4000.0, 1.0); vec2 u = q.xy / q.w * 0.5 + 0.5;   // (the sky as it is drawn behind, where it shows on screen there)
      if (q.w > 0.0 && u.x > 0.0 && u.x < 1.0 && u.y > 0.0 && u.y < 1.0 && texture2D(tGrabD, u).x >= 0.99999) refl = mix(sky, texture2D(tGrab, u).rgb, smoothstep(0.0, 0.05, min(min(u.x, 1.0 - u.x), min(u.y, 1.0 - u.y)))); }
    #endif
    #ifdef SSR_N
    if (dist < 420.0) { vec4 h = ssr(vW, normalize(mix(R, reflect(-V, vec3(0.0, 1.0, 0.0)), 0.55))); refl = mix(refl, h.rgb, h.a); }   // (the broad ripples only: the fine ones scatter it into speckle)
    #endif
    vec3 col = mix(under, refl, clamp(F, 0.0, 1.0) * edge);
    // the sun's (or the moon's) glints, none in shade
    vec3 Hh = normalize(L + V); float sp = max(dot(n, Hh), 0.0);
    col += uSunCol * (pow(sp, 300.0) * 3.5 + pow(sp, 40.0) * 0.12) * lit * edge;
    // ---- foam: riding the riffles and the rapids, gathered at the banks where the current runs, and white below the falls
    float ft = foamTex(vW.xz, vFlow, t), shore = (1.0 - smoothstep(0.05, 0.5, len)) * smoothstep(0.15, 0.6, speed);
    // (in lumps and streaks with clear water between, more of it the more there is: never a milky sheet)
    float foam = clamp(vAux.y * smoothstep(0.62 - vAux.y * 0.3, 0.8 - vAux.y * 0.25, ft) + shore * smoothstep(0.55, 0.8, ft) * 0.6, 0.0, 1.0) * (1.0 - far * 0.5);
    col = mix(col, vec3(0.9, 0.93, 0.95) * (amb * 0.85 + uSunCol * 0.55 * lit * sunUp), foam * 0.9);
    #ifdef GRAB
    gl_FragColor = vec4(col, 1.0);
    #else
    gl_FragColor = vec4(col, max(clamp(1.0 - dot(T, vec3(0.333)) + F * 0.6, 0.0, 0.95) * edge, foam));
    #endif
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;
function surfaceMat(kind) {
  const defines = kind === 'plain' ? {} : kind === 'grab' ? { GRAB: '' } : { GRAB: '', SSR_N: ULTRA ? 56 : 28, SSR_G: ULTRA ? '1.09' : '1.17' };
  const m = new THREE.ShaderMaterial({ uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), RIVER_U), defines, vertexShader: VERT.replace(/#include <(\w+)>/g, '\n#include <$1>\n'), fragmentShader: FRAG,
    fog: true, transparent: true, depthWrite: kind !== 'plain', blending: kind === 'plain' ? THREE.NormalBlending : THREE.NoBlending, side: THREE.DoubleSide });
  m.customProgramCacheKey = () => 'river-' + kind; return m;
}
const MATS = { plain: surfaceMat('plain'), grab: surfaceMat('grab'), ssr: surfaceMat('ssr') };
const matFor = () => (!GFX.post ? MATS.plain : GFX.level === 'medium' ? MATS.grab : MATS.ssr);

// ---- Building the surface
function buildSurface() {
  const R = RIVER, tiles = new Map();
  // the tiles the water reaches: round every sample, as far as its widest side and the strip past its edge
  for (let i = 0; i < R.n; i++) { const r = Math.max(R.WL[i], R.WR[i]) + 6; for (let x = Math.floor((R.X[i] - r) / TILE); x <= Math.floor((R.X[i] + r) / TILE); x++) for (let z = Math.floor((R.Z[i] - r) / TILE); z <= Math.floor((R.Z[i] + r) / TILE); z++) { const k = x + ',' + z; if (!tiles.has(k)) tiles.set(k, { x, z, i }); } }
  for (const f of R.falls) { const r = f.r0 + 4; for (let x = Math.floor((f.px - r) / TILE); x <= Math.floor((f.px + r) / TILE); x++) for (let z = Math.floor((f.pz - r) / TILE); z <= Math.floor((f.pz + r) / TILE); z++) { const k = x + ',' + z; if (!tiles.has(k)) tiles.set(k, { x, z, i: f.pool }); } }
  const groups = new Map(), q = {};
  for (const tl of tiles.values()) {
    const pos = [], flow = [], aux = [], idx = [], at = new Int32Array(NT * NT).fill(-1), Ws = [];
    for (let j = 0; j < NT; j++) for (let i = 0; i < NT; i++) {
      const x = tl.x * TILE + i * G, z = tl.z * TILE + j * G, r = riverAt(x, z, q); if (!r || r.out > 3) continue;
      const ground = heightAt(x, z), depth = r.W - ground; if (r.W < 0.1 && ground < 0) continue;   // (out at sea the sea's own water takes over)
      // the foam riding on it: over the riffles and rapids (quick and shallow), and below a fall, thick in its pool and
      // thinning away downstream of it
      let foam = smooth(0.7, 2.2, r.speed) * smooth(1.6, 0.35, depth) * 0.9 + (r.kind === 'M' ? 0.25 * smooth(0.6, 2, r.speed) : 0);
      if (r.fall >= 0) { const f = R.falls[r.fall], d = Math.hypot(x - f.px, z - f.pz); foam = Math.max(foam, smooth(f.r0 * 1.1, f.r0 * 0.15, d), 0.7 * smooth(f.r0 + 16, f.r0, d)); }
      at[j * NT + i] = pos.length / 3; Ws.push(r.W);
      pos.push(x, r.W, z); flow.push(r.fx * r.speed, r.fz * r.speed); aux.push(depth, Math.min(1, foam), r.out, r.kind === 'K' || r.kind === 'D' ? 1 : r.kind === 'E' ? 0.6 : 0);
    }
    for (let j = 0; j < NT - 1; j++) for (let i = 0; i < NT - 1; i++) {
      const a = at[j * NT + i], b = at[j * NT + i + 1], c = at[(j + 1) * NT + i], d = at[(j + 1) * NT + i + 1];
      const tri = (p, q2, s) => { if (p < 0 || q2 < 0 || s < 0) return; const w = [Ws[p], Ws[q2], Ws[s]]; if (Math.max(...w) - Math.min(...w) > 0.8) return;   // (not across a fall's face: the curtain is drawn there)
        if (Math.min(aux[p * 4], aux[q2 * 4], aux[s * 4]) < -2.5) return; idx.push(p, q2, s); };   // (nor where the bank stands well over it all round)
      tri(a, c, b); tri(b, c, d);
    }
    if (!idx.length) continue;
    const key = Math.floor(tl.i / CHUNK); let g = groups.get(key); if (!g) groups.set(key, (g = { pos: [], flow: [], aux: [], idx: [] }));
    const o = g.pos.length / 3; g.pos.push(...pos); g.flow.push(...flow); g.aux.push(...aux); for (const k of idx) g.idx.push(k + o);
  }
  for (const g of groups.values()) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3)); geo.setAttribute('flow', new THREE.Float32BufferAttribute(g.flow, 2)); geo.setAttribute('aux', new THREE.Float32BufferAttribute(g.aux, 4));
    geo.setIndex(g.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(g.idx, 1) : new THREE.Uint16BufferAttribute(g.idx, 1)); geo.computeBoundingSphere(); geo.computeBoundingBox();
    const m = new THREE.Mesh(geo, MATS.ssr); m.renderOrder = -1; m.matrixAutoUpdate = false; m.receiveShadow = false; m.castShadow = false;
    m.onBeforeRender = (r, sc, cam) => { grab(r, cam); RIVER_GFX.visible++; };
    m.name = 'river'; scene.add(m); RIVER_GFX.chunks.push(m);
  }
}

// ---- The falls' curtains
const CURTAIN_U = { uTime: WATER_U.uTime, uDay: WATER_U.uDay, uSunDir: WATER_U.uSunDir, uSunCol: WATER_U.uSunCol, uAmb: RIVER_U.uAmb, uNorm: { value: waterNormals } };
const curtainMat = new THREE.ShaderMaterial({
  uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), CURTAIN_U), fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: `attribute vec4 fa; varying vec4 vA; varying vec3 vW, vN;
    #include <fog_pars_vertex>
    void main() { vA = fa; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
    }`.replace(/#include <(\w+)>/g, '\n#include <$1>\n'),
  // (fa: x across -1..1, y metres fallen, z the fall's height, w its own seed; the streaks move by the time of flight,
  // the square root of the distance fallen, so they quicken as they drop and stretch as they quicken)
  fragmentShader: `uniform float uTime, uDay; uniform vec3 uSunDir, uSunCol, uAmb; uniform sampler2D uNorm; varying vec4 vA; varying vec3 vW, vN;
    #include <fog_pars_fragment>
    float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
    void main() {
      float u = vA.x, y = max(vA.y, 0.0), H = vA.z, s = vA.w, tau = sqrt(2.0 * y / 9.8), t = uTime, low = y / H;
      vec2 p = vec2(u * 5.0 + s, (tau - t) * 3.2), p2 = vec2(u * 13.0 - s, (tau - t * 1.07) * 7.5);
      float st = vn(p) * 0.55 + vn(p2) * 0.3 + vn(vec2(u * 31.0, (tau - t) * 15.0)) * 0.15;
      // a sheet at the lip, glassy for its first metre, breaking up into streaks and lace as it falls; ragged at the edges
      float sheet = mix(0.92, 0.55, smoothstep(0.5, 6.0, y)) * (1.0 - 0.45 * smoothstep(0.35, 1.0, low));
      float edge = 1.0 - smoothstep(0.55 + 0.3 * vn(vec2(y * 0.3 + s, t * 0.5)), 1.0, abs(u));
      float a = clamp(smoothstep(0.5 - sheet * 0.45, 0.85 - sheet * 0.3, st) * edge * (1.0 - smoothstep(0.86, 1.0, low)), 0.0, 1.0);
      float glass = 1.0 - smoothstep(0.3, 1.6, y);
      vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), L = normalize(uSunDir), V = normalize(cameraPosition - vW);
      float diff = 0.45 + 0.55 * max(dot(N, L), 0.0), back = pow(max(dot(-V, L), 0.0), 6.0) * 0.8, sunUp = smoothstep(-0.05, 0.12, uSunDir.y);
      vec3 white = vec3(0.86, 0.9, 0.93) * (uAmb * 0.95 + uSunCol * (diff + back) * 0.7 * sunUp);
      vec3 col = mix(white * (0.82 + 0.3 * st), vec3(0.16, 0.3, 0.28) * (uAmb + uSunCol * 0.4 * sunUp), glass * 0.65);
      gl_FragColor = vec4(col, max(a, glass * 0.75 * edge));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
});
curtainMat.customProgramCacheKey = () => 'river-curtain';
function buildCurtains() {
  const R = RIVER, ROWS = 36, COLS = 11;
  R.falls.forEach((f, k) => {
    // down the face, sample by sample from the lip to the pool, a little clear of the rock and more so lower down
    // (thrown out from the lip, then falling close by the face); wider as it falls, spreading as water does
    const pos = [], fa = [], idx = [], last = f.b + 1;
    for (const layer of [0, 1]) {   // (two sheets, a little apart, for some body: the second a looser veil in front)
      const o = pos.length / 3;
      for (let r = 0; r <= ROWS; r++) {
        const u = Math.pow(r / ROWS, 1.3), q = f.i + (last - f.i) * u, i = Math.min(R.n - 2, Math.floor(q)), t = q - i, L = (A) => A[i] + (A[i + 1] - A[i]) * t;
        const cx = L(R.X), cz = L(R.Z), tx = L(R.TX), tz = L(R.TZ), nx = -tz, nz = tx, y = r === 0 ? f.top : Math.max(L(R.W), f.foot) + 0.15;
        const off = 0.25 + 1.1 * Math.sqrt(u) + layer * (0.45 + 0.4 * u), wide = f.w * (0.95 + 0.4 * u + layer * 0.12) + 0.2;
        for (let c = 0; c < COLS; c++) { const v = (c / (COLS - 1)) * 2 - 1; pos.push(cx + tx * off + nx * v * wide, y + (r === 0 ? 0.04 : 0.3 + layer * 0.15), cz + tz * off + nz * v * wide); fa.push(v, f.top - y, f.h, k * 7.3 + layer * 3.1); }
      }
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS - 1; c++) { const a = o + r * COLS + c, b = a + 1, d = a + COLS, e = d + 1; idx.push(a, d, b, b, d, e); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('fa', new THREE.Float32BufferAttribute(fa, 4)); geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, curtainMat); m.renderOrder = 2; m.matrixAutoUpdate = false; m.name = 'fall'; scene.add(m);
    RIVER_GFX.falls.push({ curtain: m, f });
  });
}

// ---- Spray and mist off the plunge pools, and the rainbow in them
const SPRAY_U = { uTime: WATER_U.uTime, uDay: WATER_U.uDay, uSunDir: WATER_U.uSunDir, uSunCol: WATER_U.uSunCol, uAmb: RIVER_U.uAmb, uWind: WIND_U.uWindDir, uWindStr: WIND_U.uWindStr, uPx: { value: 800 } };
function sprayMat(mist) {
  const m = new THREE.ShaderMaterial({
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), SPRAY_U), fog: true, transparent: true, depthWrite: false,
    // (seed: x, y, z random 0..1, w the fall's strength; origin from the position, the plunge point. Each particle's life
    // starts again every period: launched up and out from the plunge, slowed by the air, falling back; the mist rises
    // slowly and drifts off downwind, growing as it thins)
    vertexShader: `attribute vec4 seed; uniform float uTime, uPx, uWindStr; uniform vec2 uWind; varying float vA; varying vec3 vW;
      #include <fog_pars_vertex>
      void main() {
        float P = ${mist ? '7.0' : '2.2'}, life = fract(uTime / P + seed.x * 7.13), age = life * P; float a = seed.y * 6.2832, k = seed.w;
        ${mist
          ? 'vec3 o = position + vec3(cos(a), 0.0, sin(a)) * (1.0 + seed.z * 4.0 * k) + vec3(uWind.x, 0.0, uWind.y) * age * (0.6 + uWindStr * 2.0) + vec3(0.0, age * (0.5 + seed.z * 0.6) * k, 0.0); float sz = (3.0 + age * 1.6) * (0.6 + k * 0.5); vA = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.5, 1.0, life)) * 0.16;'
          : 'float sp = (3.0 + seed.z * 6.0) * (0.6 + k * 0.6), up = 0.35 + seed.z * 0.65; vec3 v = vec3(cos(a) * sqrt(1.0 - up * up), up, sin(a) * sqrt(1.0 - up * up)) * sp; float dr = 1.8, e = (1.0 - exp(-dr * age)) / dr; vec3 o = position + v * e + vec3(uWind.x, 0.0, uWind.y) * age * 1.5 - vec3(0.0, 4.9 * age * age * 0.55, 0.0); o.y = max(o.y, position.y - 0.3); float sz = 0.25 + age * 1.1; vA = (1.0 - smoothstep(0.25, 1.0, life)) * 0.5 * smoothstep(0.0, 0.05, life);'}
        vW = o; vec4 mvPosition = viewMatrix * vec4(o, 1.0); gl_Position = projectionMatrix * mvPosition; gl_PointSize = clamp(sz * uPx / max(-mvPosition.z, 0.5), 1.0, 360.0);
        #include <fog_vertex>
      }`.replace(/#include <(\w+)>/g, '\n#include <$1>\n'),
    fragmentShader: `uniform float uDay; uniform vec3 uSunDir, uSunCol, uAmb; varying float vA; varying vec3 vW;
      #include <fog_pars_fragment>
      void main() {
        vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; if (r > 1.0) discard;
        float a = vA * exp(-r * r * 3.5) * (1.0 - r) * smoothstep(${mist ? '4.0, 14.0' : '0.6, 3.0'}, length(vW - cameraPosition)); float sunUp = smoothstep(-0.05, 0.12, uSunDir.y);   // (a soft round puff, faded out as it comes near the eye)
        vec3 L = normalize(uSunDir), V = normalize(vW - cameraPosition);
        vec3 col = vec3(0.9, 0.93, 0.96) * (uAmb + uSunCol * (0.5 + 0.6 * pow(max(dot(V, L), 0.0), 4.0)) * sunUp);
        ${mist ? `// the rainbow: light turned back towards you by the drops at some 42° from the point opposite the sun (red outside, violet in)
        float th = degrees(acos(clamp(dot(V, -L), -1.0, 1.0))), b = (th - 40.4) / 2.2;
        if (b > -0.3 && b < 1.3) { vec3 sp = clamp(vec3(abs(b * 6.0 - 3.0) - 1.0, 2.0 - abs(b * 6.0 - 2.0), 2.0 - abs(b * 6.0 - 4.0)), 0.0, 1.0); col += sp.bgr * uSunCol * 1.6 * sunUp * uDay * smoothstep(-0.3, 0.15, b) * (1.0 - smoothstep(0.85, 1.3, b)); a *= 1.6; }` : ''}
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  m.customProgramCacheKey = () => (mist ? 'river-mist' : 'river-spray'); return m;
}
const SPRAY = sprayMat(false), MIST = sprayMat(true);
function buildSpray() {
  let s = 91; const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (const F of RIVER_GFX.falls) {
    const f = F.f, k = Math.min(1, f.h / 60);
    for (const mist of [false, true]) {
      const n = mist ? 110 : 520, pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { const a = rnd() * 6.283, r = rnd() * f.w * 0.9; pos.set([f.px + Math.cos(a) * r, f.foot + 0.1, f.pz + Math.sin(a) * r], i * 3); seed.set([rnd(), rnd(), rnd(), k], i * 4); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(f.px, f.foot + 10, f.pz), mist ? 50 : 22);
      const p = new THREE.Points(geo, mist ? MIST : SPRAY); p.renderOrder = mist ? 4 : 3; p.matrixAutoUpdate = false; p.name = mist ? 'fall-mist' : 'fall-spray'; scene.add(p); F[mist ? 'mist' : 'spray'] = p;
    }
  }
}

// ---- Fish: little shoals in the lake and the deep reach, each fish following its shoal as it wanders about the deep
// water (never into the shallows), its tail beating as it swims; drawn under the surface like the bed, so the water
// tints and bends them. Moved only while you are near enough to see them (FISH.near).
const FISH = { n: 42, shoals: 6, near: 90 }, fishU = { uTime: WATER_U.uTime };
const fishMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 });
fishMat.onBeforeCompile = (sh) => { sh.uniforms.uTime = fishU.uTime;
  sh.vertexShader = 'uniform float uTime; attribute float phase;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    float back = smoothstep(0.02, -0.18, transformed.z); transformed.x += sin(uTime * 9.0 + phase - transformed.z * 14.0) * 0.055 * back;   // (the tail beats, the head holds)`); };
fishMat.customProgramCacheKey = () => 'river-fish';
function fishGeo() {
  // a body tapering to the tail, flattened side to side, dark olive above and silver below, and a forked tail fin
  const g = new THREE.SphereGeometry(0.06, 10, 6).scale(0.55, 0.85, 3.2), tail = new THREE.ConeGeometry(0.07, 0.12, 4).rotateX(-Math.PI / 2).scale(0.25, 1, 1).translate(0, 0, -0.24);
  const parts = [g, tail].map((q) => q.toNonIndexed()), pos = [], col = [];
  for (const q of parts) { const p = q.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); pos.push(p.getX(i), y, p.getZ(i)); const k = y > 0.01 ? 0 : 0.8; col.push(0.09 + 0.6 * k, 0.11 + 0.58 * k, 0.07 + 0.55 * k); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals(); return geo;
}
function buildFish() {
  const R = RIVER, deep = []; for (let i = 0; i < R.n; i++) if ((R.K[i] === 4 || R.K[i] === 3) && R.D[i] > 2.5) deep.push(i);   // (the lake's and the deep reach's samples)
  if (!deep.length) return; let sd = 7; const rnd = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646;
  const geo = fishGeo(), ph = new Float32Array(FISH.n); for (let i = 0; i < FISH.n; i++) ph[i] = rnd() * 6.28; geo.setAttribute('phase', new THREE.InstancedBufferAttribute(ph, 1));
  const mesh = new THREE.InstancedMesh(geo, fishMat, FISH.n); mesh.frustumCulled = false; mesh.castShadow = false; mesh.name = 'fish'; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mesh);
  const shoals = [...Array(FISH.shoals)].map(() => { const i = deep[Math.floor(rnd() * deep.length)]; return { x: R.X[i], z: R.Z[i], y: R.W[i] - 1.2, hx: 0, hz: 1, t: 0 }; });
  const fish = [...Array(FISH.n)].map((_, k) => { const s = shoals[k % FISH.shoals]; return { s, x: s.x + (rnd() - 0.5) * 4, z: s.z + (rnd() - 0.5) * 4, y: s.y, ox: (rnd() - 0.5) * 3, oz: (rnd() - 0.5) * 3, oy: (rnd() - 0.5) * 0.8, yaw: 0, sp: 0.6 + rnd() * 0.5, k: 1.25 + rnd() * 0.6 }; });
  RIVER_GFX.fish = { mesh, shoals, fish, deep, rnd };
}
const _fm = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _fe = new THREE.Euler(), _fp = new THREE.Vector3(), _fs = new THREE.Vector3();
function updateFish(dt, cam) {
  const F = RIVER_GFX.fish; if (!F) return; const R = RIVER, near = F.shoals.some((s) => Math.hypot(s.x - cam.x, s.z - cam.z) < FISH.near); F.mesh.visible = near; if (!near) return;
  const q = {}, deepAt = (x, z) => { const r = riverAt(x, z, q); return r && r.out < -2 ? r.depth : 0; };
  for (const s of F.shoals) {   // (each shoal wanders, turning back from the shallows, now and then heading for another part of the deep water)
    s.t -= dt; if (s.t <= 0) { const i = F.deep[Math.floor(F.rnd() * F.deep.length)]; s.tx = R.X[i] + (F.rnd() - 0.5) * 10; s.tz = R.Z[i] + (F.rnd() - 0.5) * 10; s.t = 8 + F.rnd() * 14; }
    let ax = s.tx - s.x, az = s.tz - s.z; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
    for (const a of [0.6, -0.6]) { const c = Math.cos(a), sn = Math.sin(a), px = s.x + (s.hx * c - s.hz * sn) * 3, pz = s.z + (s.hz * c + s.hx * sn) * 3; if (deepAt(px, pz) < 1.6) { ax -= (s.hx * c - s.hz * sn) * 2; az -= (s.hz * c + s.hx * sn) * 2; } }
    s.hx += (ax - s.hx) * Math.min(1, dt * 0.8); s.hz += (az - s.hz) * Math.min(1, dt * 0.8); const hl = Math.hypot(s.hx, s.hz) || 1; s.hx /= hl; s.hz /= hl;
    if (deepAt(s.x + s.hx * 0.8 * dt, s.z + s.hz * 0.8 * dt) > 1.2) { s.x += s.hx * 0.8 * dt; s.z += s.hz * 0.8 * dt; } const d = deepAt(s.x, s.z); s.y = waterLevel(s.x, s.z) - Math.min(Math.max(1.0, d * 0.45), 2.4);
  }
  F.fish.forEach((f, k) => {
    const tx = f.s.x + f.ox, tz = f.s.z + f.oz, dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz), sp = Math.min(d * 0.9, 1.6) * f.sp;
    if (d > 0.05) { const want = Math.atan2(dx, dz); f.yaw += Math.atan2(Math.sin(want - f.yaw), Math.cos(want - f.yaw)) * Math.min(1, dt * 4); }
    f.x += Math.sin(f.yaw) * sp * dt; f.z += Math.cos(f.yaw) * sp * dt; f.y += (f.s.y + f.oy - f.y) * Math.min(1, dt);
    if (F.rnd() < dt * 0.15) { f.ox = (F.rnd() - 0.5) * 3.5; f.oz = (F.rnd() - 0.5) * 3.5; }   // (each finds a new place in the shoal now and then)
    F.mesh.setMatrixAt(k, _fm.compose(_fp.set(f.x, f.y, f.z), _fq.setFromEuler(_fe.set(0, f.yaw, 0)), _fs.setScalar(f.k)));
  });
  F.mesh.instanceMatrix.needsUpdate = true;
}
const waterLevel = (x, z) => { const r = riverAt(x, z); return r ? r.W : 0; };

export function buildRiverWater() {
  if (!RIVER.on) return; buildSurface(); buildCurtains(); buildSpray(); buildFish();
}
// the meshes to compile at the start (main.js warmUp): one of each material
export function riverWarm(group) {
  const g = RIVER_GFX.chunks[0]?.geometry; if (g) for (const m of Object.values(MATS)) group.add(new THREE.Mesh(g, m));
  const F = RIVER_GFX.falls[0]; if (F) { group.add(new THREE.Mesh(F.curtain.geometry, curtainMat), new THREE.Points(F.spray.geometry, SPRAY), new THREE.Points(F.mist.geometry, MIST)); }
  if (RIVER_GFX.fish) group.add(new THREE.InstancedMesh(RIVER_GFX.fish.mesh.geometry, fishMat, 1));
}

// Each frame, before the scene is drawn: the material for the preset, the copy's size, the camera's matrices, the light
export function updateRiverWater(light, hemi, dt = 0) {
  if (!RIVER_GFX.chunks.length) return; frameNo++; updateFish(dt, camera.position); RIVER_GFX.grabbed = false; RIVER_GFX.visible = 0;
  const m = matFor(), grabOK = m === MATS.plain || fitGrab(), use = grabOK ? m : MATS.plain;
  for (const c of RIVER_GFX.chunks) if (c.material !== use) c.material = use;
  RIVER_U.uRes.value.set(grabRT.width, grabRT.height);
  // (the sky's light on the water: the hemisphere's upper colour, dimmed by night)
  RIVER_U.uAmb.value.copy(hemi.color).multiplyScalar(hemi.intensity * (0.35 + 0.65 * Math.min(1, light.day + light.dusk * 0.4)));
  // (the shadow maps as drawn this frame: their matrices are the ones three made for them, before the scene is drawn)
  const N = sun.shadow, F = sunFar.shadow; RIVER_U.uShadowOn.value = N.map ? 1 : 0;
  if (N.map) { RIVER_U.tShadowN.value = N.map.texture; RIVER_U.shNSize.value.set(N.map.width, N.map.height); }
  if (F.map && sunFar.visible) { RIVER_U.tShadow.value = F.map.texture; } else RIVER_U.tShadow.value = N.map?.texture || null;
  SPRAY_U.uPx.value = renderer.domElement.height * 0.5 / Math.tan(camera.fov * Math.PI / 360);
}
// (the shadow matrices as three made them for this frame's maps, which it draws before the scene: so read when the first
// chunk is drawn, not before)
function shadowMats() { RIVER_U.shadowMatN.value.copy(sun.shadow.matrix); RIVER_U.shadowMat.value.copy(sunFar.visible && sunFar.shadow.map ? sunFar.shadow.matrix : sun.shadow.matrix); }
