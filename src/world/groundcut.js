// Ground cuts: floors you build press the ground down beneath them, so on a slope neither the terrain nor the grass pokes
// up through the boards. Each floor is a rotated rectangle with a level just under its planks; inside it the ground can't
// rise above that level, and just outside it climbs back up at a gentle slope. The world's real heights never change
// (nothing to save): the terrain shader lowers its vertices, the grass map lowers its blades, and the player and
// creatures walk on groundAt() instead of the raw height.
import * as THREE from 'three';
import { heightAt } from './gen.js';

const MAX = 48;               // cuts the terrain shader knows about (the nearest ones)
const EDGE = 0.15, SLOPE = 0.6;   // ground stays at the cut level a little past the edge, then rises 0.6 m per metre
const cuts = new Map();       // key → { x, z, hw, hd, cs, sn, y }
let dirty = true, lastX = 1e9, lastZ = 1e9;
export const onCutsChanged = new Set();

export const CUT_U = {
  uCutA: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },   // x, z, cos, sin
  uCutB: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },   // half width, half depth, level
  uCutN: { value: 0 },
};

export function setCut(key, c) {
  if (c) cuts.set(key, { ...c, cs: Math.cos(c.rot || 0), sn: Math.sin(c.rot || 0) }); else if (!cuts.delete(key)) return;
  dirty = true; for (const f of onCutsChanged) f();
}
// how far (x, z) lies outside a cut's rectangle (negative inside)
const outside = (c, x, z) => { const dx = x - c.x, dz = z - c.z, u = Math.abs(dx * c.cs - dz * c.sn) - c.hw, v = Math.abs(dx * c.sn + dz * c.cs) - c.hd; return Math.max(u, v) > 0 ? Math.hypot(Math.max(u, 0), Math.max(v, 0)) : Math.max(u, v); };
// the highest the ground may be at (x, z) (Infinity where no floor is near)
export function cutLimit(x, z) {
  let lim = Infinity;
  for (const c of cuts.values()) {
    if (Math.abs(x - c.x) > c.hw + c.hd + 8 || Math.abs(z - c.z) > c.hw + c.hd + 8) continue;
    lim = Math.min(lim, c.y + SLOPE * Math.max(0, outside(c, x, z) - EDGE));
  }
  return lim;
}
export const groundAt = (x, z) => { const h = heightAt(x, z); return cuts.size ? Math.min(h, cutLimit(x, z)) : h; };
export const cutList = () => cuts.values();
export { EDGE as CUT_EDGE, SLOPE as CUT_SLOPE };

// Keep the shader's list on the cuts nearest the player
export function updateCuts(pos) {
  if (!dirty && Math.hypot(pos.x - lastX, pos.z - lastZ) < 16) return;
  dirty = false; lastX = pos.x; lastZ = pos.z;
  const near = [...cuts.values()].sort((a, b) => Math.hypot(a.x - pos.x, a.z - pos.z) - Math.hypot(b.x - pos.x, b.z - pos.z)).slice(0, MAX);
  near.forEach((c, i) => { CUT_U.uCutA.value[i].set(c.x, c.z, c.cs, c.sn); CUT_U.uCutB.value[i].set(c.hw, c.hd, c.y, 0); });
  CUT_U.uCutN.value = near.length;
}

// The terrain material: lower each vertex to the cut level (same rule as cutLimit)
export function cutTerrain(mat) {
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base?.call(mat, sh, r);
    Object.assign(sh.uniforms, CUT_U);
    sh.vertexShader = `uniform vec4 uCutA[${MAX}]; uniform vec4 uCutB[${MAX}]; uniform int uCutN;\n` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      for (int i = 0; i < ${MAX}; i++) {
        if (i >= uCutN) break;
        vec4 a = uCutA[i], b = uCutB[i]; vec2 d = transformed.xz - a.xy;
        vec2 q = abs(vec2(d.x * a.z - d.y * a.w, d.x * a.w + d.y * a.z)) - b.xy;
        float o = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
        transformed.y = min(transformed.y, b.z + ${SLOPE.toFixed(2)} * max(0.0, o - ${EDGE.toFixed(2)}));
      }`);
  };
  mat.customProgramCacheKey = () => 'terrainCut';
}
