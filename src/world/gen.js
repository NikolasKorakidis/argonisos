// World generation for Argonisos: pure, deterministic functions with no three.js dependency, shared by the main thread
// (gameplay: ground height, biome under your feet) and the terrain worker (meshes, colours, vegetation placement).
//
// Layout of the continent (+x east, +z south), radius WORLD.R:
//   Pedias  — the fertile heart: rolling meadows, olive groves, golden fields, 2–30 m. Where every chosen one wakes up.
//   Yleos   — a ring of dark forested hills around it, 30–100 m, misty valleys and ridges.
//   Valtos  — a swamp sector in the south-west running down to the sea, mostly at water level. Sealed by Zeus.
//   The sea all around, with beaches and bays.
// Biome borders are domain-warped so they wander like real ones; heights blend across them so there are no seams.

export const WORLD = { R: 1450, SIZE: 4096, SEA: 0 };
export const BIOME = { PEDIAS: 0, YLEOS: 1, VALTOS: 2 };
export const BIOME_NAMES = ['Pedias', 'Yleos', 'Valtos'];
const VALTOS_ANG = 2.35;                 // direction of the swamp sector (south-west)

let SEED = 1337;
export function setSeed(s) { SEED = s | 0; }

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export { clamp, lerp, smooth };

// ---- Noise: gradient (Perlin) noise from an integer hash, quintic fade; fBm and ridged variants. Gradient noise has no
// grid-aligned blockiness, so ridges and borders wander naturally. Output is 0..1.
function ihash(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(SEED, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); return h ^ (h >>> 16);
}
export function hash2(ix, iz) { return (ihash(ix, iz) >>> 0) / 4294967296; }
const GX = new Float32Array(16), GZ = new Float32Array(16);
for (let i = 0; i < 16; i++) { GX[i] = Math.cos(i / 16 * Math.PI * 2); GZ[i] = Math.sin(i / 16 * Math.PI * 2); }
export function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = zf * zf * zf * (zf * (zf * 6 - 15) + 10);
  const g = (i, j, dx, dz) => { const k = ihash(i, j) & 15; return GX[k] * dx + GZ[k] * dz; };
  const a = g(xi, zi, xf, zf), b = g(xi + 1, zi, xf - 1, zf), c = g(xi, zi + 1, xf, zf - 1), d = g(xi + 1, zi + 1, xf - 1, zf - 1);
  return 0.5 + (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 0.72;
}
export function fbm(x, z, oct = 4) { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { s += a * noise(x * f + i * 17.3, z * f - i * 9.1); n += a; f *= 2.03; a *= 0.5; } return s / n; }
export function ridged(x, z, oct = 4) { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { const r = 1 - Math.abs(noise(x * f + i * 31.7, z * f + i * 5.3) * 2 - 1); s += a * r * r; n += a; f *= 2.07; a *= 0.5; } return s / n; }

// ---- Biomes: weights (sum to 1) from warped polar position
const _w = { p: 1, y: 0, v: 0 };
export function biomeWeights(x, z, out = _w) {
  // two layers of domain warp: broad lobes and bays, then wiggles along the border
  let wx = x + (fbm(x * 0.0009 + 11, z * 0.0009, 3) - 0.5) * 1100, wz = z + (fbm(x * 0.0009, z * 0.0009 - 7, 3) - 0.5) * 1100;
  wx += (fbm(wx * 0.004 + 2, wz * 0.004, 2) - 0.5) * 160; wz += (fbm(wx * 0.004, wz * 0.004 + 9, 2) - 0.5) * 160;
  const r = Math.hypot(wx, wz) / WORLD.R, a = Math.atan2(wz, wx);
  let da = Math.abs(a - VALTOS_ANG); if (da > Math.PI) da = Math.PI * 2 - da;
  const v = smooth(0.9, 0.66, da) * smooth(0.5, 0.6, r);
  const p = (1 - v) * smooth(0.6, 0.5, r);
  out.p = p; out.v = v; out.y = Math.max(0, 1 - p - v); out.r = r;
  return out;
}
export function biomeAt(x, z) { const w = biomeWeights(x, z); return w.v > 0.5 ? BIOME.VALTOS : w.p >= w.y ? BIOME.PEDIAS : BIOME.YLEOS; }

// How far inland a point is: 1 well inland, 0 at the waterline, negative out at sea (bays and headlands from noise)
export function landness(x, z) {
  const r = Math.hypot(x, z) / WORLD.R, n = (fbm(x * 0.0012 + 3, z * 0.0012 - 5, 4) - 0.5) * 0.42 + (fbm(x * 0.006, z * 0.006, 2) - 0.5) * 0.08;
  return (1 + n - r) / 0.12;
}

// ---- Height (metres above sea level)
export function rawHeight(x, z, w = biomeWeights(x, z)) {
  const hp = 2.2 + fbm(x * 0.0032, z * 0.0032, 4) * 24 + (fbm(x * 0.017, z * 0.017, 2) - 0.5) * 3.5;          // meadows
  const rise = smooth(0.5, 0.78, w.r);                                                                         // foothills first, ridges deeper in
  const hy = 16 + rise * 18 + (ridged(x * 0.0027 + 4, z * 0.0027 - 2, 4) * 60 + fbm(x * 0.011, z * 0.011, 3) * 14) * (0.25 + 0.75 * rise);   // forest hills
  const hv = -0.15 + (fbm(x * 0.013 + 7, z * 0.013, 3) - 0.5) * 3.6 + (fbm(x * 0.05, z * 0.05, 2) - 0.5) * 0.8;    // marsh: islands and pools
  let h = w.p * hp + w.y * hy + w.v * hv;
  const L = landness(x, z);
  const beach = 0.6 + fbm(x * 0.02, z * 0.02, 2) * 1.6;
  if (L < 1.6) h = lerp(lerp(-24, beach, smooth(-1.4, 0.15, L)), h, smooth(0.15, 1.6, L));   // shelf → beach → land
  return h;
}

// Flattened pads for sites (temples, ruins, the starting meadow): registered once, applied on top of the raw height
const PADS = [];   // { x, z, r0, r1, y }
const PAD_CELL = 256, PAD_GRID = new Map();
export function addPad(x, z, r0, r1, y = rawHeight(x, z)) {
  const pad = { x, z, r0, r1, y }; PADS.push(pad);
  for (let i = Math.floor((x - r1) / PAD_CELL); i <= Math.floor((x + r1) / PAD_CELL); i++) for (let j = Math.floor((z - r1) / PAD_CELL); j <= Math.floor((z + r1) / PAD_CELL); j++) {
    const k = i + ',' + j; (PAD_GRID.get(k) || PAD_GRID.set(k, []).get(k)).push(pad);
  }
  return pad;
}
export function heightAt(x, z) {
  let h = rawHeight(x, z);
  const cell = PAD_GRID.get(Math.floor(x / PAD_CELL) + ',' + Math.floor(z / PAD_CELL));
  if (cell) for (const p of cell) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r1) { const t = smooth(p.r0, p.r1, d); h = lerp(p.y, h, t); } }
  return h;
}

// ---- Ground colour (linear-ish RGB 0..1), from biome weights, height, slope and a few noise layers
const C = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const PAL = {
  meadow: C(0x5b8a32), meadow2: C(0x6f9a3a), golden: C(0xb0a24e), dry: C(0x8f8a42),
  forest: C(0x2c4223), moss: C(0x3a5527), needles: C(0x4a3b29),
  mud: C(0x3e3826), marshMoss: C(0x4b5530), reedy: C(0x5d6a36),
  sand: C(0xd9c48e), wetSand: C(0xb8a272), seabed: C(0x9c8c62), rock: C(0x7f786d), rock2: C(0x6a645b),
};
const mix3 = (o, a, t) => { o[0] += (a[0] - o[0]) * t; o[1] += (a[1] - o[1]) * t; o[2] += (a[2] - o[2]) * t; return o; };
export function groundColor(x, z, h, slope, w = biomeWeights(x, z), out = [0, 0, 0]) {
  // Pedias: green meadow with golden fields and dry patches
  const pc = PAL.meadow.slice(); mix3(pc, PAL.meadow2, fbm(x * 0.05, z * 0.05, 2));
  mix3(pc, PAL.golden, smooth(0.56, 0.66, fbm(x * 0.006 + 40, z * 0.006, 3)) * 0.85);
  mix3(pc, PAL.dry, smooth(0.5, 0.7, fbm(x * 0.02 - 9, z * 0.02, 2)) * 0.35);
  // Yleos: dark forest floor, moss and needle litter
  const yc = PAL.forest.slice(); mix3(yc, PAL.moss, fbm(x * 0.04 + 5, z * 0.04, 2)); mix3(yc, PAL.needles, smooth(0.5, 0.7, fbm(x * 0.03, z * 0.03 + 8, 2)) * 0.6);
  // Valtos: mud and marsh moss
  const vc = PAL.mud.slice(); mix3(vc, PAL.marshMoss, fbm(x * 0.06, z * 0.06, 2)); mix3(vc, PAL.reedy, smooth(0.55, 0.7, fbm(x * 0.02 + 3, z * 0.02, 2)) * 0.5);
  out[0] = pc[0] * w.p + yc[0] * w.y + vc[0] * w.v; out[1] = pc[1] * w.p + yc[1] * w.y + vc[1] * w.v; out[2] = pc[2] * w.p + yc[2] * w.y + vc[2] * w.v;
  // beaches and seabed (not in the swamp, which goes straight into the water)
  const sandy = (1 - w.v * 0.9) * smooth(2.6 + fbm(x * 0.03, z * 0.03, 2) * 1.2, 1.2, h);
  mix3(out, h < 0.3 ? PAL.wetSand : PAL.sand, sandy);
  if (h < -0.6) mix3(out, PAL.seabed, smooth(-0.6, -4, h));
  // rock on steep faces and high ridges
  const rocky = smooth(0.55, 0.85, slope) + smooth(85, 100, h + fbm(x * 0.02, z * 0.02, 2) * 10) * 0.6;
  if (rocky > 0) mix3(out, fbm(x * 0.08, z * 0.08, 2) > 0.5 ? PAL.rock : PAL.rock2, clamp(rocky, 0, 1));
  const j = 0.94 + hash2(Math.floor(x * 2), Math.floor(z * 2)) * 0.08;   // tiny per-vertex jitter breaks banding
  out[0] *= j; out[1] *= j; out[2] *= j;
  return out;
}
