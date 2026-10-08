// Grass and wildflowers: a carpet of ~160k swaying blades (and patches of daisies, buttercups, poppies, cornflowers and
// lavender) in a tile that wraps around the player, the "infinite grass" technique. Height, grass amount, tint and
// flower density come from a small ground texture around the player, re-baked by a worker as you travel.
import * as THREE from 'three';
import { scene } from '../render/core.js';
import { windUniform } from './trees.js';

let s0 = 4242; const rand = () => ((s0 = (s0 * 16807) % 2147483647) - 1) / 2147483646, rr = (a, b) => a + rand() * (b - a);
export const GRASS = { mesh: null, flowers: [] };
const TEX_N = 224, TEX_SIZE = 140;      // 0.62 m per texel over 140 m, re-centred when you move 25 m (the 76 m tile never runs off it)
export const grassU = { uWind: windUniform, uCenter: { value: new THREE.Vector2() }, uTile: { value: 76 }, uHeight: { value: null },
  uOrigin: { value: new THREE.Vector2(-1e6, -1e6) }, uSize: { value: TEX_SIZE },
  uBaseA: { value: new THREE.Color(0x1d3a24) }, uBaseB: { value: new THREE.Color(0x3a4a1e) },
  uTipA: { value: new THREE.Color(0x7fae45) }, uTipB: { value: new THREE.Color(0xc9c35a) } };
{
  const H = 0.5, blade = new THREE.PlaneGeometry(0.14, H, 1, 2); blade.translate(0, H / 2, 0);
  const bp = blade.attributes.position; for (let i = 0; i < bp.count; i++) bp.setX(i, bp.getX(i) * (1 - Math.pow(bp.getY(i) / H, 1.5)));
  const COUNT = 160000, T = grassU.uTile.value;
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, grassU);
    sh.vertexShader = `uniform float uWind, uTile, uSize; uniform vec2 uCenter, uOrigin; uniform sampler2D uHeight; varying float vGH, vVar, vShade;\n` + sh.vertexShader
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')   // soft, uniform lighting like a painted field
      .replace('#include <begin_vertex>', `
        vec3 ip = instanceMatrix[3].xyz;
        vec2 wp = ip.xz + uTile * floor((uCenter - ip.xz) / uTile + 0.5);
        vec4 hm = texture2D(uHeight, (wp - uOrigin) / uSize);
        float rnd = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
        float fade = 1.0 - smoothstep(0.6, 1.0, length(wp - uCenter) / (uTile * 0.5));
        float sc = hm.g * fade * (0.55 + rnd * 0.62);
        vec3 p = position; p.y *= sc; p.x *= step(0.01, sc);
        float a = rnd * 6.2831; p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
        float gh = position.y / ${H.toFixed(2)};
        float gust = sin(uWind * 0.6 + wp.x * 0.05) * 0.5 + 0.5;
        float bend = gh * gh * sc * (0.07 + gust * 0.1);
        p.x += sin(uWind * 1.9 + wp.x * 0.35 + wp.y * 0.22) * bend;
        p.z += cos(uWind * 1.5 + wp.y * 0.3) * bend * 0.7;
        vec2 away = wp - uCenter; float pd = length(away), push = (1.0 - smoothstep(0.25, 1.5, pd)) * gh * sc;   // blades part around your legs
        p.xz += away / max(pd, 0.001) * push * 0.55; p.y *= 1.0 - push * 0.35;
        vec3 transformed = p + vec3(wp.x, hm.r - 0.03, wp.y) - ip;
        vGH = gh; float fk = floor(hm.b * 0.5); vVar = hm.b - fk * 2.0; vShade = fk / 15.0;`);
    sh.fragmentShader = `uniform vec3 uBaseA, uBaseB, uTipA, uTipB; varying float vGH, vVar, vShade;\n` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float v = smoothstep(0.35, 0.7, vVar);
        diffuseColor.rgb = mix(mix(uBaseA, uBaseB, v), mix(uTipA, uTipB, v * 0.8), smoothstep(0.0, 1.0, vGH));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.68, 0.6), vShade);   // deep forest and marsh: darker, bluer grass`);
  };
  const grass = new THREE.InstancedMesh(blade, mat, COUNT), gm = new THREE.Matrix4(); GRASS.mesh = grass;
  for (let i = 0; i < COUNT; i++) grass.setMatrixAt(i, gm.makeTranslation(rr(0, T), 0, rr(0, T)));
  grass.frustumCulled = false; grass.receiveShadow = true; scene.add(grass);
  // Flowers use the same wrap-around carpet, placed by the flower-density channel of the heightmap
  const flowerCarpet = (geo, count, colors, size) => {
    const fm = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    fm.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, grassU);
      sh.vertexShader = `uniform float uWind, uTile, uSize; uniform vec2 uCenter, uOrigin; uniform sampler2D uHeight;\n` + sh.vertexShader.replace('#include <begin_vertex>', `
        vec3 ip = instanceMatrix[3].xyz;
        vec2 wp = ip.xz + uTile * floor((uCenter - ip.xz) / uTile + 0.5);
        vec4 hm = texture2D(uHeight, (wp - uOrigin) / uSize);
        float rnd = fract(sin(dot(ip.xz, vec2(39.3, 11.7))) * 43758.5453);
        float fade = 1.0 - smoothstep(0.6, 1.0, length(wp - uCenter) / (uTile * 0.5));
        float on = step(rnd, hm.a) * step(0.5, hm.g) * fade;
        vec3 p = position * on * ${size.toFixed(2)} * (0.8 + rnd * 0.5);
        float bend = max(position.y, 0.0) * 0.12;
        p.x += sin(uWind * 1.9 + wp.x * 0.35 + wp.y * 0.22) * bend;
        vec3 transformed = p + vec3(wp.x, hm.r - 0.03, wp.y) - ip;`);
    };
    const im = new THREE.InstancedMesh(geo, fm, count), mm = new THREE.Matrix4(), cc = new THREE.Color();
    for (let i = 0; i < count; i++) { im.setMatrixAt(i, mm.makeTranslation(rr(0, T), 0, rr(0, T))); im.setColorAt(i, cc.setHex(colors[Math.floor(rand() * colors.length)])); }
    im.frustumCulled = false; im.userData.max = count; GRASS.flowers.push(im); scene.add(im); return im;
  };
  const merge = (parts) => {           // tiny manual merge of non-indexed geometries with vertex colours
    const pos = [], nor = [], col = [];
    for (const [g, c] of parts) { const gg = g.index ? g.toNonIndexed() : g; gg.computeVertexNormals(); const cl = new THREE.Color(c);
      pos.push(...gg.attributes.position.array); nor.push(...gg.attributes.normal.array); for (let i = 0; i < gg.attributes.position.count; i++) col.push(cl.r, cl.g, cl.b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
  };
  // Daisy / poppy head: flat petal disc + centre on a stem (instance colour tints the petals)
  // Petal rings: each petal a tapered quad tilted up (cup) around a centre, on a stem with two leaves
  const flower = (petals, len, wid, cup, petalCol, eyeCol, stemH) => {
    const P = [];
    for (let i = 0; i < petals; i++) {
      const g = new THREE.PlaneGeometry(wid, len, 1, 1); g.translate(0, len / 2, 0);
      const a = g.attributes.position; for (let k = 0; k < a.count; k++) if (a.getY(k) < 0.01) a.setX(k, a.getX(k) * 0.3);   // narrow base
      g.rotateX(-Math.PI / 2 + cup); g.rotateY(i / petals * Math.PI * 2); g.translate(0, stemH, 0); P.push([g, petalCol]);
    }
    P.push([new THREE.OctahedronGeometry(len * 0.32, 0).translate(0, stemH + 0.01, 0), eyeCol]);
    P.push([new THREE.CylinderGeometry(0.01, 0.013, stemH, 3).translate(0, stemH / 2, 0), 0x3f6a2a]);
    for (const sgn of [-1, 1]) { const l = new THREE.PlaneGeometry(0.05, 0.14).translate(0, 0.07, 0); l.rotateZ(sgn * 0.9); l.translate(0, stemH * 0.35, 0); P.push([l, 0x4c7a30]); }
    return merge(P);
  };
  const mk = (geo, n, col, size) => { const f = flowerCarpet(geo, n, [col], size); f.material.vertexColors = true; f.material.side = THREE.DoubleSide; return f; };
  mk(flower(10, 0.09, 0.035, 0.35, 0xffffff, 0xe8b830, 0.42), 3200, 0xffffff, 1);        // daisies
  mk(flower(5, 0.08, 0.06, 0.55, 0xffd23a, 0xc98a1a, 0.36), 2400, 0xffffff, 1);          // buttercups
  mk(flower(4, 0.12, 0.11, 0.95, 0xd8322a, 0x201810, 0.5), 2200, 0xffffff, 1.05);       // poppies (cupped)
  mk(flower(8, 0.08, 0.04, 0.4, 0x4f74e0, 0x2a2a60, 0.44), 1600, 0xffffff, 1);          // cornflowers
  // Lavender spikes
  const spikeParts = [[new THREE.CylinderGeometry(0.012, 0.012, 0.55, 3).translate(0, 0.27, 0), 0x3f6a2a]];
  for (let i = 0; i < 6; i++) spikeParts.push([new THREE.OctahedronGeometry(0.045 - i * 0.004, 0).translate(0, 0.42 + i * 0.07, 0), 0xffffff]);
  const f2 = flowerCarpet(merge(spikeParts), 2600, [0x7a5fd0, 0x5b4fc4, 0x9a6ad8], 1.1);
  f2.material.vertexColors = true;
}
let pending = false, lastX = 1e9, lastZ = 1e9, cur = null;
// Places where grass doesn't grow: under logs, floors, fires and the like. Each is a circle (x, z, r) or a rotated
// rectangle (x, z, hw, hd, rot); they are stamped into the grass channel of the local ground texture.
const clears = new Map();
let restamp = false;
export function clearGrass(key, shape) { if (shape) clears.set(key, shape); else clears.delete(key); restamp = true; }
function stamp(c) {
  const { data, N, x0, z0, base } = c, k = TEX_SIZE / N;
  data.set(base);                                   // start from the worker's grass, then cut every clearing into it
  for (const s of clears.values()) {
    const r = s.r ?? Math.hypot(s.hw, s.hd), i0 = Math.max(0, Math.floor((s.x - r - 1 - x0) / k)), i1 = Math.min(N - 1, Math.ceil((s.x + r + 1 - x0) / k));
    const j0 = Math.max(0, Math.floor((s.z - r - 1 - z0) / k)), j1 = Math.min(N - 1, Math.ceil((s.z + r + 1 - z0) / k));
    const cs = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = x0 + (i + 0.5) * k - s.x, dz = z0 + (j + 0.5) * k - s.z;
      let d;   // distance outside the shape (negative inside)
      if (s.r !== undefined) d = Math.hypot(dx, dz) - s.r;
      else { const u = Math.abs(dx * cs - dz * sn) - s.hw, v = Math.abs(dx * sn + dz * cs) - s.hd; d = Math.max(u, v); }
      const f = Math.min(1, Math.max(0, (d + 0.2) / 0.6)), o = (j * N + i) * 4 + 1;
      data[o] = Math.min(data[o], data[o] * f); data[o + 2] *= f;   // grass and flowers both
    }
  }
}
export function updateGrass(pool, pos) {
  grassU.uCenter.value.set(pos.x, pos.z);
  if (restamp && cur) { restamp = false; stamp(cur); cur.tex.needsUpdate = true; }
  if (pending || Math.hypot(pos.x - lastX, pos.z - lastZ) < 25) return;
  pending = true; const x0 = Math.round(pos.x) - TEX_SIZE / 2, z0 = Math.round(pos.z) - TEX_SIZE / 2;
  pool.post({ type: 'grassTex', N: TEX_N, x0, z0, size: TEX_SIZE }).then((m) => {
    const t = new THREE.DataTexture(m.data, m.N, m.N, THREE.RGBAFormat, THREE.FloatType); t.magFilter = t.minFilter = THREE.LinearFilter;
    cur = { data: m.data, base: m.data.slice(), N: m.N, x0: m.x0, z0: m.z0, tex: t }; stamp(cur); t.needsUpdate = true;
    grassU.uHeight.value?.dispose(); grassU.uHeight.value = t; grassU.uOrigin.value.set(m.x0, m.z0);
    lastX = m.x0 + TEX_SIZE / 2; lastZ = m.z0 + TEX_SIZE / 2; pending = false;
  });
}
