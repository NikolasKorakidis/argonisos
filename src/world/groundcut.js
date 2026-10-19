// Ground under buildings: pieces you build reshape the ground beneath them, so on a slope the terrain neither pokes up
// through the boards nor leaves them hanging in the air (tester feedback, 19 Oct). Each piece standing on the ground is a
// rotated rectangle with a level: inside it the ground is cut down to that level where it's higher and, for a piece
// near the ground, filled up to it where it's lower; just outside, it eases back to the land with a cut slope and a
// fill bank. Cuts always win, so where two pieces meet the earth never rises through either's floor. The world's real
// heights never change (nothing to save): the terrain shader moves its vertices, the grass map its blades, and the
// player and creatures walk on groundAt() instead of the raw height.
import * as THREE from 'three';
import { heightAt } from './gen.js';

const MAX = 48;               // cuts the terrain shader knows about (the nearest ones)
// floors: the ground stays at the level a little past the edge, then rises 0.6 m per metre where it's cut and falls
// 0.8 m per metre where it's filled; walls: only right under them (a steep cut, so no trench on the uphill side)
export const SHAPE = { floor: { edge: 0.15, cut: 0.6, fill: 0.8 }, wall: { edge: 0.05, cut: 4, fill: 0.8 } };
const cuts = new Map();       // key → { x, z, hw, hd, cs, sn, y, fill, edge, cut, bank }
let dirty = true, lastX = 1e9, lastZ = 1e9;
export const onCutsChanged = new Set();

export const CUT_U = {
  uCutA: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },   // x, z, cos, sin
  uCutB: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },   // half width, half depth, level, edge
  uCutC: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },   // cut slope, fill slope, fills (0/1)
  uCutN: { value: 0 },
};

// c: { x, z, hw, hd, rot, y, fill, shape: SHAPE.floor | SHAPE.wall }, or null to remove
export function setCut(key, c) {
  if (c) { const sh = c.shape || SHAPE.floor; cuts.set(key, { ...c, cs: Math.cos(c.rot || 0), sn: Math.sin(c.rot || 0), edge: sh.edge, cut: sh.cut, bank: sh.fill, fill: !!c.fill }); }
  else if (!cuts.delete(key)) return;
  dirty = true; for (const f of onCutsChanged) f();
}
// how far (x, z) lies outside a cut's rectangle (negative inside)
const outside = (c, x, z) => { const dx = x - c.x, dz = z - c.z, u = Math.abs(dx * c.cs - dz * c.sn) - c.hw, v = Math.abs(dx * c.sn + dz * c.cs) - c.hd; return Math.max(u, v) > 0 ? Math.hypot(Math.max(u, 0), Math.max(v, 0)) : Math.max(u, v); };
// the ground at (x, z) once the buildings have reshaped it, from its raw height h (the same rule as the terrain shader)
export function shapeGround(h, x, z) {
  let lo = -Infinity, hi = Infinity;
  for (const c of cuts.values()) {
    if (Math.abs(x - c.x) > c.hw + c.hd + 8 || Math.abs(z - c.z) > c.hw + c.hd + 8) continue;
    const d = Math.max(0, outside(c, x, z) - c.edge);
    hi = Math.min(hi, c.y + c.cut * d); if (c.fill) lo = Math.max(lo, c.y - c.bank * d);
  }
  return Math.min(Math.max(h, lo), hi);
}
export const groundAt = (x, z) => { const h = heightAt(x, z); return cuts.size ? shapeGround(h, x, z) : h; };
export const cutList = () => cuts.values();

// Keep the shader's list on the cuts nearest the player
export function updateCuts(pos) {
  if (!dirty && Math.hypot(pos.x - lastX, pos.z - lastZ) < 16) return;
  dirty = false; lastX = pos.x; lastZ = pos.z;
  const near = [...cuts.values()].sort((a, b) => Math.hypot(a.x - pos.x, a.z - pos.z) - Math.hypot(b.x - pos.x, b.z - pos.z)).slice(0, MAX);
  near.forEach((c, i) => { CUT_U.uCutA.value[i].set(c.x, c.z, c.cs, c.sn); CUT_U.uCutB.value[i].set(c.hw, c.hd, c.y, c.edge); CUT_U.uCutC.value[i].set(c.cut, c.bank, c.fill ? 1 : 0, 0); });
  CUT_U.uCutN.value = near.length;
}

// The terrain material: move each vertex to the reshaped ground (the same rule as shapeGround)
export function cutTerrain(mat) {
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base?.call(mat, sh, r);
    Object.assign(sh.uniforms, CUT_U);
    sh.vertexShader = `uniform vec4 uCutA[${MAX}]; uniform vec4 uCutB[${MAX}]; uniform vec4 uCutC[${MAX}]; uniform int uCutN;\n` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { float lo = -1e9, hi = 1e9;
        for (int i = 0; i < ${MAX}; i++) {
          if (i >= uCutN) break;
          vec4 a = uCutA[i], b = uCutB[i], c = uCutC[i]; vec2 d = transformed.xz - a.xy;
          vec2 q = abs(vec2(d.x * a.z - d.y * a.w, d.x * a.w + d.y * a.z)) - b.xy;
          float o = max(0.0, length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - b.w);
          hi = min(hi, b.z + c.x * o); if (c.z > 0.5) lo = max(lo, b.z - c.y * o);
        }
        transformed.y = min(max(transformed.y, lo), hi); }`);
  };
  mat.customProgramCacheKey = () => 'terrainCut';
}
