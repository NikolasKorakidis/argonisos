// Where every tree and boulder stands. Pure and deterministic (seeded per 64 m cell), so the worker can lay out cells
// and the main thread always agrees on what is where: a tree chopped down is remembered by its cell and index.
//
// Pedias: open meadows with groves (olive, oak, cypress, pomegranate, fig, the odd great plane tree) and lone trees.
// Yleos:  dense dark forest (pines, firs, holm oaks, broadleaves, dead snags) with clearings.
// Valtos: dead and drowned trees, cypresses, sparse.
import { heightAt, biomeWeights, fbm, hash2, smooth } from './gen.js';
import { siteClear } from './sites.js';

export const CELL = 64;
// species: name for the builder, scale range, collision radius (and height) per unit of scale; 'res' marks things you can harvest (trees give logs, rocks stone)
export const SPECIES = [
  { name: 'olive', s: [0.95, 1.25], res: 'tree', col: 0.5 },
  { name: 'oak', s: [0.95, 1.3], res: 'tree', col: 0.6 },
  { name: 'cypress', s: [0.85, 1.2], res: 'tree', col: 0.4 },
  { name: 'pomegranate', s: [0.9, 1.15], res: 'tree', col: 0.25 },
  { name: 'fig', s: [0.95, 1.2], res: 'tree', col: 0.3 },
  { name: 'plane', s: [1.0, 1.25], res: 'tree', col: 0.8 },
  { name: 'qtree', s: [0.9, 1.35], res: 'tree', col: 0.45 },
  { name: 'qpine', s: [0.9, 1.4], res: 'tree', col: 0.4 },
  { name: 'fir', s: [0.9, 1.35], res: 'tree', col: 0.4 },
  { name: 'holm', s: [0.95, 1.3], res: 'tree', col: 0.5 },
  { name: 'qdead', s: [0.85, 1.2], res: 'tree', col: 0.4 },
  { name: 'dead', s: [0.9, 1.2], res: 'tree', col: 0.4 },
  { name: 'rock', s: [0.5, 2.4], res: 'rock', col: 0.95, h: 0.85 },
  { name: 'boulder', s: [2.2, 4.5], res: 'rock', col: 0.95, h: 0.8 },
  { name: 'reeds', s: [0.8, 1.3], res: 'reed' },
  // (added later, at the end so the species numbers above never change) the old world between the trees: ruins you can
  // break up for stone, and the shrubs of a Greek hillside
  { name: 'colfall', s: [0.9, 1.15], res: 'rock', col: 1.0, h: 0.7 },
  { name: 'colstand', s: [0.85, 1.15], res: 'rock', col: 0.55, h: 3.2 },
  { name: 'herm', s: [0.95, 1.05], res: 'rock', col: 0.45, h: 1.7 },
  { name: 'amphorae', s: [0.9, 1.1], noShadow: true },
  { name: 'wallruin', s: [0.9, 1.15], res: 'rock', col: 1.1, h: 1.0 },
  { name: 'lavender', s: [0.8, 1.25], noShadow: true },
  { name: 'broom', s: [0.8, 1.25], noShadow: true },
  { name: 'myrtle', s: [0.8, 1.3], noShadow: true },
  // the giant forest: trunks like columns, a canopy thirty metres up, ferns beneath; and red-leaved bushes in the hills
  { name: 'titan', s: [0.9, 1.15], res: 'tree', col: 1.25 },
  { name: 'fern', s: [0.7, 1.05], noShadow: true },
  { name: 'redbush', s: [0.8, 1.2], noShadow: true },
];
export const SP = Object.fromEntries(SPECIES.map((s, i) => [s.name, i]));
const MIX = {
  grove: [['olive', 40], ['oak', 18], ['cypress', 14], ['pomegranate', 12], ['fig', 10], ['plane', 6]],
  meadow: [['oak', 35], ['olive', 30], ['cypress', 25], ['qtree', 10]],
  forest: [['qpine', 26], ['fir', 22], ['holm', 16], ['qtree', 22], ['qdead', 6], ['oak', 8]],
  swamp: [['dead', 45], ['qdead', 30], ['cypress', 25]],
};
const pick = (mix, r) => { let t = 0; for (const [, w] of mix) t += w; let a = r * t; for (const [n, w] of mix) { a -= w; if (a <= 0) return SP[n]; } return SP[mix[0][0]]; };

// Trees per square metre at a point (0 where nothing can grow)
// Where the giant forest stands: long stretches of the belt where the meadows give way to the forested hills
const _tw = { p: 0, y: 0, v: 0, r: 0 };
export function titanBand(x, z, w = biomeWeights(x, z, _tw)) {
  const edge = smooth(0.1, 0.32, w.y) * smooth(0.86, 0.62, w.y) * (1 - w.v);
  return edge * smooth(0.44, 0.58, fbm(x * 0.0016 + 77, z * 0.0016 - 31, 3));
}
export function treeDensity(x, z, h, w) {
  if (h < 1.6 && w.v < 0.5) return 0;
  if (h > 150) return smooth(205, 150, h) * treeDensity(x, z, 140, w);   // the treeline on Olympos
  const grove = smooth(0.52, 0.68, fbm(x * 0.0075 + 21, z * 0.0075 - 4, 3));
  const pedias = (1 / 900) + grove * (1 / 70);
  const clearing = smooth(0.38, 0.28, fbm(x * 0.01 - 3, z * 0.01 + 6, 3));      // forest glades
  const yleos = (1 / 38) * (1 - clearing * 0.9);
  const valtos = 1 / 160;
  return w.p * pedias + w.y * yleos + w.v * valtos;
}
// Lay out one cell: returns a flat Float32Array of [species, variant, x, y, z, rotY, scale] per item. Trees are kept out of
// rocks and boulders (their own cell's and the neighbours'): one standing in a rock is moved just clear of it, staying in
// its cell and keeping its place in the list (felled trees are remembered by index); if it can't, it isn't drawn.
export function layoutCell(cx, cz) {
  const it = rawCell(cx, cz).slice(), rocks = rocksAround(cx, cz), x0 = cx * CELL, z0 = cz * CELL;
  for (let i = 0; i < it.length; i += STRIDE) {
    const sp = SPECIES[it[i]]; if (sp.res !== 'tree' || it[i] === SP.titan) continue;
    if (titanBand(it[i + 2], it[i + 4]) > 0.35 && hash2(cx * 131 + i, cz * 977 - i) < 0.75) { it[i + 6] = 0; continue; }   // the giants' shade: the understory thins out
    const tr = sp.col * it[i + 6];
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (let k = 0; k < rocks.length; k += 3) {
        const dx = it[i + 2] - rocks[k], dz = it[i + 4] - rocks[k + 1], d = Math.hypot(dx, dz), need = rocks[k + 2] + tr + 0.3;
        if (d >= need) continue;
        const a = d > 1e-3 ? Math.atan2(dz, dx) : hash2(i, k) * 6.283;
        it[i + 2] = Math.min(x0 + CELL - 0.05, Math.max(x0 + 0.05, rocks[k] + Math.cos(a) * need));
        it[i + 4] = Math.min(z0 + CELL - 0.05, Math.max(z0 + 0.05, rocks[k + 1] + Math.sin(a) * need)); moved = true;
      }
      if (!moved) break;
    }
    if (obstructed(rocks, it[i + 2], it[i + 4], tr)) it[i + 6] = 0;   // nowhere to go in its cell
    else it[i + 3] = heightAt(it[i + 2], it[i + 4]) - 0.05;
  }
  return it;
}
const obstructed = (list, x, z, r) => { for (let k = 0; k < list.length; k += 3) if (Math.hypot(x - list[k], z - list[k + 1]) < list[k + 2] + r + 0.25) return true; return false; };
// raw layouts, cached (neighbouring cells are asked for again and again)
const RAW = new Map();
function rawCell(cx, cz) {
  const k = cx + ',' + cz; let r = RAW.get(k);
  if (!r) { r = layoutRaw(cx, cz); RAW.set(k, r); if (RAW.size > 160) RAW.delete(RAW.keys().next().value); }
  return r;
}
// rocks and boulders in a cell and its eight neighbours, as a flat [x, z, radius, ...]
function rocksAround(cx, cz) {
  const out = [];
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const it = rawCell(cx + i, cz + j); for (let o = 0; o < it.length; o += STRIDE) { const sp = SPECIES[it[o]]; if (sp.res === 'rock' || it[o] === SP.titan) out.push(it[o + 2], it[o + 4], sp.col * it[o + 6] + (it[o] === SP.titan ? 1.2 : 0)); } }
  return out;
}
// everything solid around a cell (rocks and tree trunks where they finally stand), for things laid out on the ground
const SOLID = new Map();
export function solidsAround(cx, cz) {
  const k = cx + ',' + cz; let out = SOLID.get(k); if (out) return out;
  out = rocksAround(cx, cz);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const it = layoutCell(cx + i, cz + j); for (let o = 0; o < it.length; o += STRIDE) { const sp = SPECIES[it[o]]; if (sp.res === 'tree' && it[o + 6] > 0) out.push(it[o + 2], it[o + 4], sp.col * it[o + 6]); } }
  SOLID.set(k, out); if (SOLID.size > 80) SOLID.delete(SOLID.keys().next().value);
  return out;
}
export const insideSolid = (list, x, z, r) => obstructed(list, x, z, r);
// What shades the ground in a rectangle (for the terrain and grass to bake in): [x, z, radius, strength, ...] for every
// tree (a canopy-sized pool of shade), giant (a wide, deep one), rock and ruin (a tight one at its foot)
export function shadeAround(x0, z0, x1, z1) {
  const out = [];
  for (let cz = Math.floor((z0 - 12) / CELL); cz <= Math.floor((z1 + 12) / CELL); cz++) for (let cx = Math.floor((x0 - 12) / CELL); cx <= Math.floor((x1 + 12) / CELL); cx++) {
    const it = layoutCell(cx, cz);
    for (let o = 0; o < it.length; o += STRIDE) { const sp = SPECIES[it[o]], s = it[o + 6]; if (s <= 0 || !sp.res) continue;
      if (it[o] === SP.titan) out.push(it[o + 2], it[o + 4], 10 * s, 0.45);
      else if (sp.res === 'tree') out.push(it[o + 2], it[o + 4], 1.6 + sp.col * s * 3.4, 0.3);
      else if (sp.res === 'rock') out.push(it[o + 2], it[o + 4], 0.6 + sp.col * s * 1.25, 0.32); }
  }
  return out;
}
// add up the shade from such a list over a grid (x0, z0, cell size k, nx × nz), into occ[]
export function bakeShade(list, x0, z0, k, nx, nz, occ) {
  for (let t = 0; t < list.length; t += 4) {
    const x = list[t], z = list[t + 1], R = list[t + 2], S = list[t + 3];
    const i0 = Math.max(0, Math.floor((x - R - x0) / k)), i1 = Math.min(nx - 1, Math.ceil((x + R - x0) / k)), j0 = Math.max(0, Math.floor((z - R - z0) / k)), j1 = Math.min(nz - 1, Math.ceil((z + R - z0) / k));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const dx = x0 + i * k - x, dz = z0 + j * k - z, q = (dx * dx + dz * dz) / (R * R); if (q < 1) occ[j * nx + i] += S * (1 - q) * (1 - q); }
  }
}
function layoutRaw(cx, cz) {
  const out = [], x0 = cx * CELL, z0 = cz * CELL, STEP = 4, w = { p: 0, y: 0, v: 0, r: 0 };
  let k = 0;
  const rnd = () => hash2(cx * 7919 + (k++), cz * 104729 - k * 31);
  for (let j = 0; j < CELL / STEP; j++) for (let i = 0; i < CELL / STEP; i++) {
    const x = x0 + (i + rnd()) * STEP, z = z0 + (j + rnd()) * STEP, h = heightAt(x, z), r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd();
    if (siteClear(x, z)) continue;
    biomeWeights(x, z, w);
    // reeds fringe the marsh pools and the low shores
    if (h > -0.5 && h < 1.4 && r1 < w.v * 0.09 * STEP * STEP / 4) { out.push(SP.reeds, Math.floor(r4 * 3), x, h, z, r3 * 6.283, 0.8 + r2 * 0.5); continue; }
    if (h < (w.v > 0.5 ? -0.25 : 0.6)) continue;
    const slope = Math.hypot(heightAt(x + 1.5, z) - h, heightAt(x, z + 1.5) - h) / 1.5;
    // boulders and rocks: more on slopes and in the hills
    if (r1 < (1 / 1100 + slope * 0.006 + w.y * 0.0012) * STEP * STEP) {
      const big = r2 < 0.12 + w.y * 0.1, sp = big ? SP.boulder : SP.rock, S = SPECIES[sp].s;
      out.push(sp, Math.floor(r3 * 3), x, h, z, r4 * 6.283, S[0] + (S[1] - S[0]) * rnd()); continue;
    }
    if (slope > 0.75) continue;
    const d = treeDensity(x, z, h, w); if (r2 >= d * STEP * STEP) continue;
    const grove = smooth(0.52, 0.68, fbm(x * 0.0075 + 21, z * 0.0075 - 4, 3));
    const mix = w.v > 0.5 ? MIX.swamp : w.y > w.p ? MIX.forest : grove > 0.3 ? MIX.grove : MIX.meadow;
    const sp = pick(mix, r3), S = SPECIES[sp].s;
    out.push(sp, Math.floor(r4 * 3), x, h - 0.05, z, rnd() * 6.283, S[0] + (S[1] - S[0]) * rnd());
  }
  // the old world between the trees: Mediterranean shrubs, and here and there a ruin (a fallen column, a herm by the way,
  // a stub of wall, a cache of jars). Laid out last, with dice of their own, so nothing laid out before them moves.
  { const cw = biomeWeights(x0 + 32, z0 + 32, { p: 0, y: 0, v: 0, r: 0 }), h2 = (k) => hash2(cx * 7907 + Math.round(k * 1000), cz * 104723 + Math.round(k * 7919) + 3);   // (the hash takes whole numbers)
    const place = (k) => { const x = x0 + h2(k) * CELL, z = z0 + h2(k + 0.5) * CELL, h = heightAt(x, z); if (h < 1.6 || siteClear(x, z)) return null; return Math.hypot(heightAt(x + 1.5, z) - h, heightAt(x, z + 1.5) - h) / 1.5 > 0.5 ? null : { x, z, h }; };
    if (cw.v < 0.4) {
      const n = Math.round(cw.p * 16 + cw.y * 5);
      for (let k = 0; k < n; k++) { const q = place(k * 2 + 1); if (!q) continue; const r = h2(k * 2 + 1.3), sp = cw.p > cw.y ? (r < 0.42 ? SP.lavender : r < 0.58 ? SP.broom : SP.myrtle) : SP.myrtle, S = SPECIES[sp].s;
        out.push(sp, 0, q.x, q.h - 0.05, q.z, h2(k + 7) * 6.283, S[0] + (S[1] - S[0]) * h2(k + 9)); }
      if (h2(99) < cw.p * 0.4 + cw.y * 0.12) { const q = place(101); if (q) { const r = h2(103), sp = cw.y > cw.p ? (r < 0.6 ? SP.colfall : SP.wallruin) : r < 0.28 ? SP.colfall : r < 0.46 ? SP.colstand : r < 0.66 ? SP.herm : r < 0.82 ? SP.amphorae : SP.wallruin, S = SPECIES[sp].s;
        out.push(sp, Math.floor(h2(105) * 2), q.x, q.h - 0.04, q.z, h2(107) * 6.283, S[0] + (S[1] - S[0]) * h2(109)); } }
    }
    // the giant forest: one great tree in every 13 m square where the band is strong, ferns underneath
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const k = 200 + j * 5 + i, x = x0 + (i + 0.2 + h2(k) * 0.6) * 12.8, z = z0 + (j + 0.2 + h2(k + 0.5) * 0.6) * 12.8, b = titanBand(x, z);
      if (b < 0.15 || h2(k + 0.25) > b * 1.1) continue; const h = heightAt(x, z); if (h < 2 || h > 140 || siteClear(x, z)) continue;
      const S = SPECIES[SP.titan].s; out.push(SP.titan, Math.floor(h2(k + 0.75) * 3), x, h - 0.3, z, h2(k + 0.6) * 6.283, S[0] + (S[1] - S[0]) * h2(k + 0.7));
    }
    const bc = titanBand(x0 + 32, z0 + 32), nf = Math.round(bc * 26 + cw.y * (1 - bc) * 6);
    for (let k = 0; k < nf; k++) { const q = place(400 + k * 2); if (!q || q.h > 160) continue; const S = SPECIES[SP.fern].s; out.push(SP.fern, 0, q.x, q.h - 0.05, q.z, h2(401 + k * 2) * 6.283, S[0] + (S[1] - S[0]) * h2(402 + k * 2)); }
    if (cw.y > 0.3 && cw.v < 0.3) for (let k = 0; k < 3; k++) { if (h2(500 + k) > cw.y * 0.5) continue; const q = place(510 + k * 2); if (!q || q.h > 160) continue; const S = SPECIES[SP.redbush].s; out.push(SP.redbush, 0, q.x, q.h - 0.05, q.z, h2(511 + k) * 6.283, S[0] + (S[1] - S[0]) * h2(512 + k)); }
  }
  return new Float32Array(out);
}
export const STRIDE = 7;
