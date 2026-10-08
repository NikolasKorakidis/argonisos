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
export function treeDensity(x, z, h, w) {
  if (h < 1.6 && w.v < 0.5) return 0;
  const grove = smooth(0.52, 0.68, fbm(x * 0.0075 + 21, z * 0.0075 - 4, 3));
  const pedias = (1 / 900) + grove * (1 / 70);
  const clearing = smooth(0.38, 0.28, fbm(x * 0.01 - 3, z * 0.01 + 6, 3));      // forest glades
  const yleos = (1 / 38) * (1 - clearing * 0.9);
  const valtos = 1 / 160;
  return w.p * pedias + w.y * yleos + w.v * valtos;
}
// Lay out one cell: returns a flat Float32Array of [species, variant, x, y, z, rotY, scale] per item
export function layoutCell(cx, cz) {
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
  return new Float32Array(out);
}
export const STRIDE = 7;
