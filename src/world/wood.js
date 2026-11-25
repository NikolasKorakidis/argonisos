// Wood (the Greek reviewer, 23 Nov: the trunks, the flowers and the building pieces worked over as the rocks were,
// rock.js): low-poly as everything else, the detail laid on in the shader, so it costs no geometry, no extra draws and
// one program for each kind.
//   Bark, on every tree's trunk and limbs, the stumps, logs and roots: vertical fibres and furrows (one tileable texture
//   made here, drawn stretched up the trunk from each side in turn and blended by the face's facing, so no seam runs up
//   it), each tree its own hue and shade from a hash of where it stands, moss on the shaded side (away from the noon sun)
//   and round the foot, as much as the place is wooded, and dark when wet. Only what is bark: the leaves' cores and
//   the moss hanging from the dead trees (green over red) and fruit (pure colour) are left as they are. The fine detail
//   fades out with distance and the moss before the distant trees' pictures take over (impostors.js), so those, painted
//   in the plain colours, stay as bright and as brown as the trees nearer in: the fibres and the hue are made to average
//   out to the colour they lie on.
//   Worked wood, on the building kit's planks, beams and logs: grain running along each plank (rings round a heart off
//   its middle, waving along it, so a flat face shows the long lines of sawn timber and an end the rings), the seams
//   dark where a plank ends against the next, its edges worn pale, and each piece and each plank its own tone. A plank's
//   run is found once per model (woodFrame: each loose part of it, its longest axis).
// The colour of both is looked up in texels when the Pixel texture setting is on (render/pixel.js); their relief, and so
// the light on them, is not. The patched materials keep their patches when copied (keep): placed pieces are copies
// (build.js dress).
import * as THREE from 'three';
import { hash21, tileNoise } from '../util/math.js';
import { patchWet } from './wetness.js';
import { ATMO } from '../render/atmosphere.js';
import { PIXEL_GLSL, PIXEL_U, ownTexels } from '../render/pixel.js';

// ---- The bark's texture, tileable: R fine fibres, G the ridges between furrows (1 on a ridge, 0 down a furrow: the
// creases of a noise, so they branch and join as bark's do), B where moss grows (blotches), A a broad variation
const N = 256;
export const BARK_TEX = (() => {
  const noise = (period, oct, seed) => tileNoise(N, period, oct, (x, z) => hash21(x + seed, z - seed));
  const fib = noise(48, 2, 3), rid = noise(9, 2, 11), rid2 = noise(18, 2, 19), moss = noise(7, 3, 23), broad = noise(3, 2, 31), d = new Uint8Array(N * N * 4);
  for (let k = 0; k < N * N; k++) {
    const r = 1 - Math.abs(rid[k] * 2 - 0.94), r2 = 1 - Math.abs(rid2[k] * 2 - 0.94), ridge = Math.min(1, Math.max(0, r * 0.75 + r2 * 0.35 - 0.1));
    d.set([Math.min(255, fib[k] * 1.1 * 255), ridge * 255, moss[k] * 255, broad[k] * 255], k * 4);
  }
  const t = new THREE.DataTexture(d, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true;
  // (the tone the fibres and furrows give, on average, so it can be divided out and the bark's mean stays its colour)
  let m = 0; for (let k = 0; k < N * N; k++) { const g = d[k * 4 + 1] / 255, s = Math.min(1, Math.max(0, (g - 0.45) / 0.5)); m += (0.42 + 0.8 * s * s * (3 - 2 * s)) * (0.8 + 0.4 * d[k * 4] / 255); }
  t.userData.mean = m / (N * N); return t;
})();

// ---- A model's planks: each loose part (the triangles that share corners) is one plank, beam or log, its run along its
// longest axis (the main axis of its corners' spread). Each corner is given where it lies in its plank's own frame (aWoodL:
// metres along the run and across it, from the plank's middle) and the plank's half-sizes in that frame and a dice of its
// own (aWoodH), so the shader knows how far each point is from the plank's ends and edges.
function axes(c) {   // the eigenvectors of a symmetric 3×3 (Jacobi), longest first
  const a = [[c[0], c[1], c[2]], [c[1], c[3], c[4]], [c[2], c[4], c[5]]], v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 12; sweep++) for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
    if (Math.abs(a[p][q]) < 1e-12) continue;
    const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), cs = Math.cos(th), sn = Math.sin(th);
    for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = cs * x - sn * y; a[k][q] = sn * x + cs * y; }
    for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = cs * x - sn * y; a[q][k] = sn * x + cs * y; }
    for (let k = 0; k < 3; k++) { const x = v[k][p], y = v[k][q]; v[k][p] = cs * x - sn * y; v[k][q] = sn * x + cs * y; }
  }
  return [0, 1, 2].sort((i, j) => a[j][j] - a[i][i]).map((i) => new THREE.Vector3(v[0][i], v[1][i], v[2][i]));
}
export function woodFrame(geo) {
  if (geo.attributes.aWoodL) return geo;
  const P = geo.attributes.position, n = P.count, ix = geo.index?.array, up = new Int32Array(n).map((_, i) => i), at = new Map();
  const find = (i) => { while (up[i] !== i) i = up[i] = up[up[i]]; return i; }, join = (a, b) => { a = find(a); b = find(b); if (a !== b) up[a] = b; };
  for (let i = 0; i < n; i++) { const key = `${Math.round(P.getX(i) * 1e3)},${Math.round(P.getY(i) * 1e3)},${Math.round(P.getZ(i) * 1e3)}`, o = at.get(key); if (o === undefined) at.set(key, i); else join(i, o); }
  const tc = (ix ? ix.length : n) / 3, vi = (t, k) => (ix ? ix[t * 3 + k] : t * 3 + k);
  for (let t = 0; t < tc; t++) { join(vi(t, 0), vi(t, 1)); join(vi(t, 0), vi(t, 2)); }
  const parts = new Map(); for (let i = 0; i < n; i++) { const r = find(i); (parts.get(r) || parts.set(r, []).get(r)).push(i); }
  const L = new Float32Array(n * 3), H = new Float32Array(n * 4), c = new THREE.Vector3(), q = new THREE.Vector3();
  for (const list of parts.values()) {
    c.set(0, 0, 0); for (const i of list) c.add(q.fromBufferAttribute(P, i)); c.divideScalar(list.length);
    const cv = [0, 0, 0, 0, 0, 0]; for (const i of list) { q.fromBufferAttribute(P, i).sub(c); cv[0] += q.x * q.x; cv[1] += q.x * q.y; cv[2] += q.x * q.z; cv[3] += q.y * q.y; cv[4] += q.y * q.z; cv[5] += q.z * q.z; }
    const [e1, e2, e3] = axes(cv), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const i of list) { q.fromBufferAttribute(P, i).sub(c); const u = [q.dot(e1), q.dot(e2), q.dot(e3)]; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], u[k]); hi[k] = Math.max(hi[k], u[k]); } }
    const mid = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2), half = [0, 1, 2].map((k) => Math.max(1e-3, (hi[k] - lo[k]) / 2)), dice = hash21(c.x * 7.3 + c.y * 1.7, c.z * 5.1 - c.y);
    for (const i of list) { q.fromBufferAttribute(P, i).sub(c); L.set([q.dot(e1) - mid[0], q.dot(e2) - mid[1], q.dot(e3) - mid[2]], i * 3); H.set([...half, dice], i * 4); }
  }
  geo.setAttribute('aWoodL', new THREE.BufferAttribute(L, 3)); geo.setAttribute('aWoodH', new THREE.BufferAttribute(H, 4));
  return geo;
}

// ---- The shaders
// (each tree, piece or plank its own: from where it stands, as the rocks are)
const VERT_PARS = `varying vec3 vWdO, vWdN, vWdNW, vWdW; varying float vWdS;
  #ifdef WOOD_FRAME
  attribute vec3 aWoodL; attribute vec4 aWoodH; varying vec3 vWoodL; varying vec4 vWoodH;
  #endif
`;
const VERT = `#include <project_vertex>
  {
    #ifdef USE_INSTANCING
      mat4 wdM = modelMatrix * instanceMatrix;
    #else
      mat4 wdM = modelMatrix;
    #endif
    vWdS = fract(sin(dot(floor(wdM[3].xz * 4.0), vec2(12.9898, 78.233))) * 43758.5453);
    vWdO = transformed; vWdN = objectNormal; vWdNW = normalize(mat3(wdM) * objectNormal); vWdW = (wdM * vec4(transformed, 1.0)).xyz;
    #ifdef WOOD_FRAME
      vWoodL = aWoodL; vWoodH = aWoodH;
    #endif
  }`;
const FRAG_PARS = `varying vec3 vWdO, vWdN, vWdNW, vWdW; varying float vWdS;
  #ifdef WOOD_FRAME
  varying vec3 vWoodL; varying vec4 vWoodH;
  #endif
  uniform sampler2D uBarkTex, uWoods; uniform float uWoodsExt, uBarkMean;
  ${PIXEL_GLSL}
  float wdH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wdN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(wdH(i), wdH(i + vec2(1.0, 0.0)), f.x), mix(wdH(i + vec2(0.0, 1.0)), wdH(i + vec2(1.0, 1.0)), f.x), f.y); }
  #ifdef WOOD_FRAME
  // the grain at a point L of a plank (half-sizes H.xyz, dice H.w), and aa: how much of the lines show (they fade to their
  // average where they'd come closer than a pixel or two): the late wood's dark lines, and the fibres
  vec2 wdGrain(vec3 L, vec4 H, vec2 aa) {
    float hs = H.w; vec2 heart = (vec2(fract(hs * 7.13), fract(hs * 3.37)) - 0.5) * 2.4 * H.yz + vec2(0.0, H.z * (1.2 + fract(hs * 5.9)));
    float along = L.x, r0 = length(L.yz - heart), rad = r0 + (wdN(vec2(along * 0.9 + hs * 40.0, r0 * 3.0)) - 0.5) * 0.035 + (wdN(vec2(along * 4.0, hs * 9.0)) - 0.5) * 0.006;
    return vec2(smoothstep(0.72, 1.0, abs(fract(rad * 24.0) - 0.5) * 2.0) * aa.x, mix(0.5, wdN(vec2(along * 2.2, rad * 160.0 + hs * 50.0)), aa.y));
  }
  #endif
`;
// (the shaded side: away from where the sun stands at noon, sky.js SUN_LEAN)
const BARK = `#include <color_fragment>
  float wdRelief = 0.0;
  {
    vec3 c0 = diffuseColor.rgb; float mx = max(c0.r, max(c0.g, c0.b)), mn = min(c0.r, min(c0.g, c0.b)), l0 = dot(c0, vec3(0.2126, 0.7152, 0.0722));
    float bark = (1.0 - smoothstep(0.0, 0.03, c0.g - c0.r * 1.05)) * (1.0 - smoothstep(0.88, 0.95, (mx - mn) / max(mx, 1e-4)));
    float dist = length(vViewPosition), near = 1.0 - smoothstep(25.0, 70.0, dist);
    vec3 n = normalize(vWdN), aw = pow(abs(n), vec3(4.0)); aw /= aw.x + aw.y + aw.z;
    vec3 p = vWdO + vec3(vWdS * 31.0, vWdS * 7.0, vWdS * 17.0);
    // up the trunk the texture is drawn long and narrow: plates of bark a hand or two across between deep furrows, in
    // fibres (broad, stylised, so they still read in the Pixel texture's texels)
    // (s: for the relief; sc: in texels, square in metres however the texture is stretched, for the colour)
    vec4 s = texture2D(uBarkTex, vec2(p.z * 0.85, p.y * 0.16)) * aw.x + texture2D(uBarkTex, vec2(p.x * 0.85 + 0.5, p.y * 0.16)) * aw.z + texture2D(uBarkTex, p.xz * 0.85 + 0.25) * aw.y;
    vec2 tk = uTexel / vec2(0.85, 0.16);
    vec4 sc = pixelTex(uBarkTex, vec2(p.z * 0.85, p.y * 0.16), tk) * aw.x + pixelTex(uBarkTex, vec2(p.x * 0.85 + 0.5, p.y * 0.16), tk) * aw.z + pixelTex(uBarkTex, p.xz * 0.85 + 0.25, uTexel / 0.85) * aw.y;
    float ridge = smoothstep(0.45, 0.95, s.g), ridgeC = smoothstep(0.45, 0.95, sc.g), tone = (0.42 + 0.8 * ridgeC) * (0.8 + 0.4 * sc.r) / uBarkMean;
    vec3 c = c0 * mix(1.0, tone, near * bark);
    // each tree its own hue and shade: a little warmer or greyer, lighter or darker
    c *= mix(vec3(1.0), mix(vec3(1.06, 1.0, 0.92), vec3(0.95, 0.99, 1.06), fract(vWdS * 3.7)) * (0.86 + 0.28 * fract(vWdS * 7.3)), bark);
    // moss: in the woods, on the shaded side and thickest round the foot, in blotches; gone before the distant trees'
    // pictures, which are painted without it
    vec3 wn = normalize(vWdNW);
    float wood = smoothstep(0.1, 0.55, texture2D(uWoods, vWdW.xz / uWoodsExt + 0.5).r) * (1.0 - smoothstep(120.0, 170.0, dist));
    float side = smoothstep(-0.35, 0.75, dot(wn.xz, vec2(-0.53, 0.848))) * 0.75 + 0.25 * smoothstep(0.3, 0.9, wn.y), foot = 1.0 - smoothstep(0.4, 3.5, vWdO.y);
    float cover = wood * (0.32 * side + 0.38 * foot * (0.5 + 0.5 * side));
    float m = smoothstep(1.0 - cover, 1.18 - cover, sc.b * 0.75 + sc.a * 0.35 + (1.0 - ridgeC) * 0.12) * bark;
    float mr = smoothstep(1.0 - cover, 1.18 - cover, s.b * 0.75 + s.a * 0.35 + (1.0 - ridge) * 0.12) * bark;   // (the same from the smooth look, for the relief: from the texels it would step, and the light with it)
    c = mix(c, vec3(l0) * vec3(0.62, 1.0, 0.34) * 1.05, m * 0.85);
    diffuseColor.rgb = c;
    wdRelief = (ridge * 0.9 + s.r * 0.25) * near * bark * (1.0 - mr * 0.6);
  }`;
const WOOD = `#include <color_fragment>
  float wdRelief = 0.0;
  {
    vec3 c0 = diffuseColor.rgb; float l0 = dot(c0, vec3(0.2126, 0.7152, 0.0722));
    float wood = smoothstep(0.15, 0.5, (c0.r - c0.b) / max(l0, 1e-3));   // (only what's wood: not iron, stone or rope)
    float dist = length(vViewPosition), near = 1.0 - smoothstep(14.0, 45.0, dist);
    vec3 L = vWoodL; vec4 H = vWoodH; float hs = H.w;
    // the grain: rings round a heart off the plank's middle (each plank its own), waving gently along the run, the late
    // wood a thin dark line (wdGrain); for the colour in texels, for the relief as it is
    float rr = length(L.yz) * 24.0; vec2 aa = vec2(1.0 - smoothstep(0.35, 0.8, fwidth(rr)), 1.0 - smoothstep(0.3, 0.9, fwidth(rr * 6.67)));
    vec3 Ls = pixelSnap(L, uTexel); vec2 gc = wdGrain(Ls, H, aa), gs = wdGrain(L, H, aa);
    float late = gs.x, fib = gs.y, along = Ls.x;
    float tone = (1.0 - 0.32 * gc.x) * (0.92 + 0.16 * gc.y) / (1.0 - 0.32 * 0.14 * aa.x);   // (divided by its average: the plank keeps its colour)
    // the plank's edges: the distance to the nearest one on this face (on a face one of the three is nil: the next is it)
    vec3 e = max(H.xyz - abs(L), 0.0); float e1 = min(e.x, min(e.y, e.z)), e3 = max(e.x, max(e.y, e.z)), e2 = e.x + e.y + e.z - e1 - e3;
    float seam = 1.0 - smoothstep(0.0, max(0.008, fwidth(e2) * 1.5), e2), ew = 1.0 - smoothstep(0.0, 0.045, e2);
    float wear = ew * smoothstep(0.35, 0.7, wdN(vec2(along * 6.0 + hs * 13.0, (Ls.y + Ls.z) * 20.0))), wearR = ew * smoothstep(0.35, 0.7, wdN(vec2(L.x * 6.0 + hs * 13.0, (L.y + L.z) * 20.0)));   // (wearR: the smooth one, for the relief)
    // each piece its own tone (from where it stands) and each plank a little apart from its neighbours
    float pt = (0.88 + 0.24 * vWdS) * (0.93 + 0.14 * fract(hs * 11.3));
    vec3 c = c0 * mix(1.0, tone, near * wood) * mix(1.0, pt, wood) * mix(vec3(1.0), mix(vec3(1.04, 1.0, 0.94), vec3(0.97, 1.0, 1.04), fract(hs * 2.9 + vWdS)), wood);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(c, vec3(l * 1.3) * vec3(1.06, 1.0, 0.9), wear * 0.55 * wood * near);   // (worn: paler and greyer)
    c *= 1.0 - 0.5 * seam * wood;
    diffuseColor.rgb = c;
    wdRelief = (late * 0.15 * (1.0 - smoothstep(0.0, 1.0, uTexel)) + (fib - 0.5) * 0.12 - seam * 0.9 - wearR * 0.3) * near * wood;   // (the grain's lines only faintly, and not at all in texels: a thin line's slopes lit up white where the texel's colour no longer darkened it)
  }`;
// the relief tilts the normal (bump mapping from screen-space derivatives, as the stone's does)
const BUMP = (k) => `#include <normal_fragment_maps>
  {
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), r1 = cross(sy, normal), r2 = cross(normal, sx);
    float det = dot(sx, r1) * faceDirection, hx = dFdx(wdRelief) * ${k}, hy = dFdy(wdRelief) * ${k};
    normal = normalize(abs(det) * normal - sign(det) * (hx * r1 + hy * r2));
  }`;
const U = { uBarkTex: { value: BARK_TEX }, uBarkMean: { value: BARK_TEX.userData.mean }, uWoods: ATMO.tWoods, uWoodsExt: ATMO.woodsExt, ...PIXEL_U };

// A copy of a patched material keeps its patches (a plain copy loses them; build.js copies each placed piece's)
export function keep(mat) {
  mat.clone = function () { const c = new this.constructor().copy(this); c.onBeforeCompile = this.onBeforeCompile; c.customProgramCacheKey = this.customProgramCacheKey; c.clone = this.clone; return ownTexels(c); };
  return mat;
}
// The wet look as part of a material's own patch (wetness.js patchWet: not registered as wettable, so a copy made with
// wetLike isn't patched twice), kept by its copies
export function wetKept(mat, wet) {
  const base = mat.onBeforeCompile, key = mat.customProgramCacheKey() + `|wetK${wet.dark},${wet.gloss},${wet.shine ?? 0.5}`;
  mat.onBeforeCompile = (sh, r) => { base?.call(mat, sh, r); patchWet(sh, wet); };
  mat.customProgramCacheKey = () => key; return keep(mat);
}
function patch(mat, kind, wet) {
  const base = mat.onBeforeCompile, key = mat.customProgramCacheKey() + '|' + kind, def = kind === 'wood' ? '#define WOOD_FRAME\n' : '';
  mat.onBeforeCompile = (sh, r) => {
    base?.call(mat, sh, r); Object.assign(sh.uniforms, U);
    sh.vertexShader = def + VERT_PARS + sh.vertexShader.replace('#include <project_vertex>', VERT);
    sh.fragmentShader = def + FRAG_PARS + sh.fragmentShader.replace('#include <color_fragment>', kind === 'wood' ? WOOD : BARK).replace('#include <normal_fragment_maps>', BUMP(kind === 'wood' ? '0.05' : '0.07'));
  };
  mat.customProgramCacheKey = () => key; ownTexels(mat);
  return wet ? wetKept(mat, wet) : keep(mat);
}
// Bark on a vertex-coloured material (the trees' trunks: no wind, trees.js); worked wood on a building piece's (its
// models given woodFrame)
export const barky = (mat, wet = { dark: 0.6, gloss: 0.7, shine: 0.1 }) => patch(mat, 'bark', wet);
export const woody = (mat, wet = { dark: 0.62, gloss: 0.32 }) => patch(mat, 'wood', wet);
