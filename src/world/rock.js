// Stone (the player, 21 Nov: "the rocks and the boulders look very flat now, very simple, very boring"): one look for
// every rock on the island, the meadows' boulders and the forest's, the stones on the coast and up Olympos, the pebbles
// and the stones you pick up, the sites' boulders and cairns. Low-poly as everything else is, the detail laid on in the
// shader in world space, so it costs no geometry, no textures per model and no extra draws:
//   a grain and slabs split by fine cracks, projected along each facet's own face (so the pattern turns with the facets
//   and follows them, as a chisel's would), at two sizes so no tiling shows; bedding, thin dark seams dipping a little
//   each rock its own way; each rock its own shade and hue, from a hash of where it stands; its facets' ridges caught
//   pale by the light and its creases darker, and its hollows darker than its knuckles (rockEdges, worked out once per
//   model from how its faces meet); lichen and moss on what faces up, green and thick in the woods, a pale crust bleached
//   by the sun in the open meadows, sparse up the mountain and none where the sea washes; and dark and glossy when wet
//   (wetness.js). It fades to the plain colour with distance, where the mipmaps would only grey it.
// One shader for all of them: each material made stony here shares its program with every other made the same way.
import * as THREE from 'three';
import { hash21, tileNoise, seeded } from '../util/math.js';
import { wettable } from './wetness.js';
import { ATMO } from '../render/atmosphere.js';

// ---- One tileable texture, made here at start-up: R the stone's tone (slabs, each its own, and the cracks between
// them dark), G its relief (the slabs rounded off towards their cracks, and the grain), B where lichen grows (blotches),
// A a broad variation. (The terrain's bare rock, terrain.js rockGround, is made the same way, at a larger scale.)
export const STONE_TEX = (() => {
  const N = 256, r = seeded(4271), d = new Uint8Array(N * N * 4);
  const noise = (period, oct, seed) => tileNoise(N, period, oct, (x, z) => hash21(x + seed, z - seed));
  const grain = noise(48, 3, 5), broad = noise(4, 3, 13), lichen = noise(10, 4, 29), wa = noise(5, 3, 37), wb = noise(5, 3, 43);
  // (the edges of a Voronoi pattern warped by noise, so the cracks wander and kink; C cells across the tile, each with a
  // tone of its own, split again by finer cracks, three times as many)
  const grid = (C) => Array.from({ length: C * C }, () => [r(), r(), r()]);
  const cells = (u, v, C, P) => { const ci = Math.floor(u), cj = Math.floor(v); let f1 = 9, f2 = 9, id = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = ci + di, j = cj + dj, p = P[((j % C) + C) % C * C + ((i % C) + C) % C], dd = Math.hypot(i + p[0] - u, j + p[1] - v);
      if (dd < f1) { f2 = f1; f1 = dd; id = p[2]; } else if (dd < f2) f2 = dd;
    }
    return [f2 - f1, id]; };
  const C = 3, big = grid(C), fine = grid(3 * C);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = y * N + x, g = grain[k], ox = (wa[k] - 0.5) * 0.8, oz = (wb[k] - 0.5) * 0.8;
    const [e1, id] = cells(x / N * C + ox, y / N * C + oz, C, big), [e2, id2] = cells(x / N * 3 * C + ox * 2, y / N * 3 * C + oz * 2, 3 * C, fine);
    const c1 = Math.min(1, e1 / (0.04 + wa[k] * 0.05)), c2 = 1 - (1 - Math.min(1, e2 / 0.07)) * 0.3;   // (the cracks' widths vary along them; the fine ones fainter)
    const tone = (0.62 + id * 0.3 + (id2 - 0.5) * 0.14 + (g - 0.5) * 0.45) * (0.42 + 0.58 * c1 * c1) * c2;
    const relief = Math.min(1, e1 / 0.45) * 0.5 + Math.min(1, e2 / 0.25) * 0.2 + g * 0.3;
    d.set([Math.min(255, tone * 255), relief * 255, lichen[k] * 255, broad[k] * 255], k * 4);
  }
  const t = new THREE.DataTexture(d, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true; return t;
})();

// ---- How a model's faces meet, worked out once per model (non-indexed, flat-faceted, as the packs' rocks come): for
// each corner of each face, aEdge xyz its distance (in the model's units) from the face's three edges (each corner's own
// height over the edge opposite it, the others 0: drawn across the face this gives the distance to each edge exactly)
// and w how far that corner stands out from its neighbours (1 level, more on a knuckle, less in a hollow); aRidge, for
// the face, how sharply each of its edges turns (positive a ridge, negative a crease, 0 where it meets nothing).
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _e = new THREE.Vector3();
export function rockEdges(geo) {
  if (geo.attributes.aEdge || geo.index) return geo;
  const P = geo.attributes.position, T = P.count / 3, key = (i) => `${Math.round(P.getX(i) * 1e3)},${Math.round(P.getY(i) * 1e3)},${Math.round(P.getZ(i) * 1e3)}`;
  const fn = new Float32Array(T * 3), fc = new Float32Array(T * 3), edges = new Map(), corner = new Map();
  for (let t = 0; t < T; t++) {
    _a.fromBufferAttribute(P, t * 3); _b.fromBufferAttribute(P, t * 3 + 1); _c.fromBufferAttribute(P, t * 3 + 2);
    _n.crossVectors(_e.subVectors(_b, _a), _c.clone().sub(_a)); const area = _n.length(); _n.normalize(); fn.set([_n.x, _n.y, _n.z], t * 3);
    fc.set([(_a.x + _b.x + _c.x) / 3, (_a.y + _b.y + _c.y) / 3, (_a.z + _b.z + _c.z) / 3], t * 3);
    for (let k = 0; k < 3; k++) {
      const i = t * 3 + k, j = t * 3 + (k + 1) % 3, o = t * 3 + (k + 2) % 3, ki = key(i), kj = key(j), ek = ki < kj ? ki + '|' + kj : kj + '|' + ki;
      (edges.get(ek) || edges.set(ek, []).get(ek)).push(t, (k + 2) % 3);   // (the face, and its corner opposite this edge)
      const q = corner.get(ki) || corner.set(ki, { n: new THREE.Vector3(), p: new THREE.Vector3().fromBufferAttribute(P, i), nb: new Map() }).get(ki);
      q.n.addScaledVector(_n, area); q.nb.set(kj, j); q.nb.set(key(o), o);   // (its two neighbours round this face)
    }
  }
  const ridge = new Float32Array(T * 3), edge = new Float32Array(T * 12), d = (t, k) => fn[t * 3] * (fc[k * 3] - fc[t * 3]) + fn[t * 3 + 1] * (fc[k * 3 + 1] - fc[t * 3 + 1]) + fn[t * 3 + 2] * (fc[k * 3 + 2] - fc[t * 3 + 2]);
  for (const list of edges.values()) {
    if (list.length !== 4) continue;   // (an open edge, or three faces on one: left alone)
    const [t1, o1, t2, o2] = list, cos = fn[t1 * 3] * fn[t2 * 3] + fn[t1 * 3 + 1] * fn[t2 * 3 + 1] + fn[t1 * 3 + 2] * fn[t2 * 3 + 2];
    const sharp = Math.min(1, Math.max(0, (0.996 - cos) / 0.2)), v = (d(t1, t2) + d(t2, t1) < 0 ? 1 : -1) * Math.sqrt(sharp);   // (the other face's middle behind this one's plane: a ridge)
    ridge[t1 * 3 + o1] = v; ridge[t2 * 3 + o2] = v;
  }
  for (const q of corner.values()) {   // (a corner's standing out: how far it lies above its neighbours' middle, along its own normal, for the size of its faces)
    q.n.normalize(); let m = 0, L = 0; _e.set(0, 0, 0); for (const i of q.nb.values()) { _a.fromBufferAttribute(P, i); _e.add(_a); L += _a.distanceTo(q.p); m++; }
    q.out = m ? Math.max(-1, Math.min(1, q.n.dot(_b.subVectors(q.p, _e.divideScalar(m))) / (L / m) * 2.5)) : 0;
  }
  for (let t = 0; t < T; t++) for (let k = 0; k < 3; k++) {
    const i = t * 3 + k; _a.fromBufferAttribute(P, i); _b.fromBufferAttribute(P, t * 3 + (k + 1) % 3); _c.fromBufferAttribute(P, t * 3 + (k + 2) % 3);
    const base = _c.clone().sub(_b), h = _n.crossVectors(base, _e.subVectors(_a, _b)).length() / Math.max(base.length(), 1e-6);   // (the corner's height over the edge opposite it)
    edge[i * 4 + k] = h; edge[i * 4 + 3] = 1 + 0.5 * (corner.get(key(i))?.out ?? 0);
  }
  const rg = new Float32Array(T * 9); for (let t = 0; t < T; t++) for (let k = 0; k < 3; k++) rg.set(ridge.subarray(t * 3, t * 3 + 3), (t * 3 + k) * 3);
  geo.setAttribute('aEdge', new THREE.BufferAttribute(edge, 4)); geo.setAttribute('aRidge', new THREE.BufferAttribute(rg, 3));
  return geo;
}

// ---- The shader
const VERT_PARS = `varying vec3 vStoneP, vStoneN; varying float vStoneS, vStoneH;
  #ifdef STONE_EDGES
  attribute vec4 aEdge; attribute vec3 aRidge; varying vec4 vStoneE; varying vec3 vStoneR;
  #endif
`;
const VERT = `#include <project_vertex>
  {
    #ifdef USE_INSTANCING
      mat4 stM = modelMatrix * instanceMatrix;
      vStoneS = fract(sin(dot(floor(stM[3].xz * 4.0), vec2(12.9898, 78.233))) * 43758.5453);   // (each rock its own, from where it stands)
    #else
      mat4 stM = modelMatrix; vStoneS = 0.37;   // (a site's stones, merged into one: their shades come from the broad variation)
    #endif
    vStoneP = (stM * vec4(transformed, 1.0)).xyz; vStoneN = normalize(mat3(stM) * objectNormal);
    vStoneH = (vStoneP.y - stM[3].y) / max(length(stM[1].xyz), 1e-3);   // (how high up the rock, in its own size: the moss creeps over from its top)
    #ifdef STONE_EDGES
      vStoneE = vec4(aEdge.xyz * length(stM[0].xyz), aEdge.w); vStoneR = aRidge;   // (the distances in metres, as the rock is drawn)
    #endif
  }`;
// (the woods texture, atmosphere.js: how wooded each place is (r), for the moss)
export const STONE_GLSL = `uniform sampler2D uStoneTex, uWoods; uniform float uWoodsExt;
  // the texture projected along a face's own normal (w: how much each way, from it)
  vec4 stoneTri(vec3 p, vec3 w) { return texture2D(uStoneTex, p.zy) * w.x + texture2D(uStoneTex, p.xz + 0.31) * w.y + texture2D(uStoneTex, p.xy + 0.67) * w.z; }
`;
const FRAG_PARS = `varying vec3 vStoneP, vStoneN; varying float vStoneS, vStoneH;
  #ifdef STONE_EDGES
  varying vec4 vStoneE; varying vec3 vStoneR;
  #endif
  ${STONE_GLSL}`;
const FRAG = `#include <color_fragment>
  float stoneRelief = 0.0;
  {
    vec3 fN = normalize(cross(dFdx(vStoneP), dFdy(vStoneP))), bw = pow(abs(fN), vec3(8.0)); bw /= bw.x + bw.y + bw.z;   // (the facet's own face, flat)
    float sd = vStoneS, dist = length(vViewPosition), near = 1.0 - smoothstep(30.0, 90.0, dist);
    vec3 p = vStoneP + vec3(sd * 31.0, sd * 7.0, sd * 17.0);
    vec4 s = stoneTri(p / 4.2, bw), f = stoneTri(p / 0.9 + 0.5, bw); float broad = texture2D(uStoneTex, vStoneP.xz / 17.0 + sd).a;
    // bedding: thin dark seams a hand or two apart, dipping each rock its own way, wandering with the slabs
    vec3 dip = normalize(vec3(sin(sd * 6.283) * 0.3, 1.0, cos(sd * 6.283) * 0.3));
    float lay = dot(vStoneP, dip) / (0.45 + sd * 0.4) + (s.a - 0.5) * 3.0, bed = abs(fract(lay) - 0.5), seam = (1.0 - smoothstep(0.0, 0.04, bed)) * near;
    float tone = mix(1.0, (0.7 + s.r * 0.5) * (0.84 + f.r * 0.32) * mix(0.95, 1.04, step(0.5, fract(lay * 0.5))) * (1.0 - 0.2 * seam), near) * (0.84 + broad * 0.32);
    // each rock its own hue and shade: a little warmer or cooler, lighter or darker; and greyed a touch towards limestone
    float l0 = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 c = diffuseColor.rgb * tone * mix(vec3(1.05, 1.0, 0.93), vec3(0.95, 0.99, 1.06), fract(sd * 3.7)) * (0.86 + 0.26 * fract(sd * 7.3));
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, 0.68) * 0.95;
    #ifdef STONE_EDGES
      // the ridges caught pale and the creases dark, a few centimetres either side (at least a pixel and a half, and gone
      // with distance, where they'd only outline the rock); its knuckles lighter than its hollows
      vec3 ed = vStoneE.xyz, fw = fwidth(ed), w1 = clamp(fw * 1.5, 0.04, 0.1), w2 = clamp(fw * 2.5, 0.1, 0.22);   // (and no wider: where a face turns away at the outline, the distance changes fast)
      float fine = 1.0 - smoothstep(0.012, 0.04, max(fw.x, max(fw.y, fw.z)));   // (gone once a pixel spans a few centimetres: a small rock a few metres off was all outline)
      vec3 at1 = 1.0 - smoothstep(vec3(0.0), w1, ed), at2 = 1.0 - smoothstep(vec3(0.0), w2, ed);
      float ridge = dot(at1, max(vStoneR, 0.0)), crease = dot(at2, max(-vStoneR, 0.0)), knuckle = vStoneE.w - 1.0;
      c *= (1.0 + 0.32 * min(ridge, 1.0) * fine * (0.6 + 0.4 * s.g)) * (1.0 - 0.35 * min(crease, 1.0) * (0.4 + 0.6 * fine)) * (1.0 + 0.4 * knuckle);
    #endif
    // lichen and moss on what faces up: as much as the place is wooded, green and thick there, a pale crust bleached by
    // the sun out in the open; thinner high up the mountain and none where the sea washes over
    float wood = smoothstep(0.1, 0.55, texture2D(uWoods, vStoneP.xz / uWoodsExt + 0.5).r), up = vStoneN.y;
    float cover = (0.3 + 0.18 * wood) * smoothstep(1.5, 5.0, vStoneP.y) * (1.0 - 0.75 * smoothstep(220.0, 420.0, vStoneP.y));
    float m = smoothstep(1.0 - cover, 1.16 - cover, s.b * 0.6 + f.b * 0.25 + broad * 0.15 + (up - 0.5) * 0.4 + (clamp(vStoneH, 0.0, 1.5) - 0.6) * 0.3) * smoothstep(0.0, 0.55, up + (f.b - 0.5) * 0.5);
    vec3 lich = vec3(l0 * (0.82 + 0.3 * f.g)) * mix(vec3(1.2, 1.17, 0.96), vec3(0.52, 0.86, 0.28), wood);   // (over the cracks: it grows across them)
    c = mix(c, lich, m * mix(0.75, 1.0, wood));
    diffuseColor.rgb = c;
    stoneRelief = (s.g * 0.6 + f.g * 0.5 + seam * 0.4) * near * (1.0 - m * 0.5);
  }`;
// the relief tilts the normal (bump mapping from screen-space derivatives, as the terrain's rock does)
const BUMP = `#include <normal_fragment_maps>
  {
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), r1 = cross(sy, normal), r2 = cross(normal, sx);
    float det = dot(sx, r1) * faceDirection, hx = dFdx(stoneRelief) * 0.09, hy = dFdy(stoneRelief) * 0.09;
    normal = normalize(abs(det) * normal - sign(det) * (hx * r1 + hy * r2));
  }`;
const U = { uStoneTex: { value: STONE_TEX }, uWoods: ATMO.tWoods, uWoodsExt: ATMO.woodsExt };
// Make a standard material stony (on top of any patch it has), and wettable unless it already is (wet: false). edges:
// its models carry rockEdges' corners and ridges. Every material made the same way shares one program.
export function stony(mat, { edges = false, wet = { dark: 0.55, gloss: 0.7, shine: 0.1 } } = {}) {
  if (wet) wettable(mat, wet);
  const base = mat.onBeforeCompile, key = mat.customProgramCacheKey() + (edges ? '|stoneE' : '|stone');
  const def = edges ? '#define STONE_EDGES\n' : '';   // (in the code, not the material's defines: a copy of a standard material loses those)
  mat.onBeforeCompile = (sh, r) => {
    base?.call(mat, sh, r); Object.assign(sh.uniforms, U);
    sh.vertexShader = def + VERT_PARS + sh.vertexShader.replace('#include <project_vertex>', VERT);
    sh.fragmentShader = def + FRAG_PARS + sh.fragmentShader.replace('#include <color_fragment>', FRAG).replace('#include <normal_fragment_maps>', BUMP);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}
// The streamed rocks, boulders and pebbles (vegetation.js; their colours baked in the vertices, their faces' edges marked)
export const ROCK_MAT = stony(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), { edges: true });
