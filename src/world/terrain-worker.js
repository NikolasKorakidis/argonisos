// Terrain worker: builds terrain patches (positions, normals, colours, uvs) off the main thread so streaming the world
// never stutters. Also bakes the world height texture used by the water shader.
import { heightAt, biomeWeights, groundColor, fbm, isRock } from './gen.js';
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
import { layoutCell, CELL, shadeAround, bakeShade, solidsAround, SPECIES, STRIDE } from './flora.js';
// how wide a space to keep round the things that stand about but aren't solid (metres at scale 1)
const CLEAR_R = { lavender: 0.5, broom: 0.7, myrtle: 0.8, fern: 0.6, redbush: 0.7, colfall: 1.4, colstand: 0.6, herm: 0.4, amphorae: 0.7, wallruin: 1.6 };
import './sites.js';   // registers the flattened ground under the trial's sites

function patch({ id, x0, z0, size, res }) {
  const n = res + 1, step = size / res, NV = n * n + 4 * res;
  const pos = new Float32Array(NV * 3), nor = new Float32Array(NV * 3), col = new Float32Array(NV * 3), uv = new Float32Array(NV * 2);
  // heights with a one-sample border so normals match across patch edges
  const m = n + 2, H = new Float32Array(m * m);
  for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) H[j * m + i] = heightAt(x0 + (i - 1) * step, z0 + (j - 1) * step);
  let minH = 1e9, maxH = -1e9; const c = [0, 0, 0], w = { p: 0, y: 0, v: 0, r: 0 };
  // baked shade (near patches): pools of shade under the trees and at the foot of rocks, computed once here
  const occ = new Float32Array(n * n); if (size <= 128) bakeShade(shadeAround(x0, z0, x0 + size, z0 + size), x0, z0, step, n, n, occ);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, x = x0 + i * step, z = z0 + j * step, h = H[(j + 1) * m + i + 1];
    const hl = H[(j + 1) * m + i], hr = H[(j + 1) * m + i + 2], hd = H[j * m + i + 1], hu = H[(j + 2) * m + i + 1];
    let nx = hl - hr, ny = 2 * step, nz = hd - hu; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; nor[k * 3] = nx; nor[k * 3 + 1] = ny; nor[k * 3 + 2] = nz;
    const slope = Math.sqrt(Math.max(0, 1 - ny * ny)) / Math.max(ny, 0.05);   // rise over run
    biomeWeights(x, z, w); groundColor(x, z, h, slope, w, c);
    const cav = Math.max(-0.05, Math.min(0.1, ((hl + hr + hd + hu) / 4 - h) * 0.25 / Math.max(step, 1)));   // hollows a touch darker, ridges a touch lighter
    const ao = (1 - Math.min(0.45, occ[k])) * (1 - cav);
    col[k * 3] = c[0] * ao; col[k * 3 + 1] = c[1] * ao; col[k * 3 + 2] = c[2] * ao;
    uv[k * 2] = x / 3; uv[k * 2 + 1] = z / 3;
    if (h < minH) minH = h; if (h > maxH) maxH = h;
  }
  // skirt: copy of the outer ring, pushed down (deeper for coarse patches whose neighbours may differ more)
  const drop = Math.max(1.5, step * 1.2); let s = n * n;
  const ring = [];
  for (let i = 0; i < res; i++) ring.push(i);                          // top edge, left → right
  for (let j = 0; j < res; j++) ring.push(j * n + res);                // right edge
  for (let i = res; i > 0; i--) ring.push(res * n + i);                // bottom edge, right → left
  for (let j = res; j > 0; j--) ring.push(j * n);                      // left edge
  for (const k of ring) {
    pos[s * 3] = pos[k * 3]; pos[s * 3 + 1] = pos[k * 3 + 1] - drop; pos[s * 3 + 2] = pos[k * 3 + 2];
    nor.set(nor.subarray(k * 3, k * 3 + 3), s * 3); col.set(col.subarray(k * 3, k * 3 + 3), s * 3); uv.set(uv.subarray(k * 2, k * 2 + 2), s * 2); s++;
  }
  return { id, pos, nor, col, uv, minH, maxH };
}

// World height texture for the water: depth below the surface everywhere (shoreline foam, colour by depth)
function heightTexture({ id, N, extent }) {
  const data = new Float32Array(N * N * 2), w = { p: 0, y: 0, v: 0, r: 0 };   // R: ground height, G: swamp weight (murky water)
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = ((i + 0.5) / N - 0.5) * extent, z = ((j + 0.5) / N - 0.5) * extent, k = (j * N + i) * 2;
    data[k] = heightAt(x, z); data[k + 1] = biomeWeights(x, z, w).v;
  }
  return { id, data, N, extent };
}

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'patch') { const r = patch(msg); self.postMessage({ type: 'patch', ...r }, [r.pos.buffer, r.nor.buffer, r.col.buffer, r.uv.buffer]); }
  else if (msg.type === 'heightTex') { const r = heightTexture(msg); self.postMessage({ type: 'heightTex', ...r }, [r.data.buffer]); }
  else if (msg.type === 'grassTex') {      // local ground texture for the grass carpet: R height, G grass amount (+ 2 × tallness 0-7), B tint variation, A flowers
    const { N, x0, z0, size } = msg, data = new Float32Array(N * N * 4), w = { p: 0, y: 0, v: 0, r: 0 };
    const occ = new Float32Array(N * N), kk = size / N; bakeShade(shadeAround(x0, z0, x0 + size, z0 + size), x0 + kk / 2, z0 + kk / 2, kk, N, N, occ);   // the grass shaded under trees too
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = x0 + (i + 0.5) / N * size, z = z0 + (j + 0.5) / N * size, h = heightAt(x, z), k = (j * N + i) * 4;
      biomeWeights(x, z, w);
      const sl = Math.hypot(heightAt(x + 1, z) - h, heightAt(x, z + 1) - h);
      let g = Math.min(1, Math.max(0, (h - 1.4) / 0.8)) * Math.min(1, Math.max(0, (1.15 - sl) / 0.45));
      g *= w.p * 1 + w.y * 0.45 + w.v * (h > 0.4 ? 0.55 : 0);
      g *= Math.min(1, Math.max(0, (fbm(x * 0.05 + 3, z * 0.05, 2) - 0.22) / 0.1));
      g *= Math.min(1, Math.max(0, (190 - h) / 40));   // none on the bare rock and snow of the peak
      data[k] = h; data[k + 1] = g; data[k + 2] = Math.min(0.99, Math.max(0, fbm(x * 0.03 + 9, z * 0.03 - 4, 2))) + Math.round(Math.min(1, w.y + w.v * 0.6 + occ[j * N + i] * 1.3) * 15) * 2;   // tint, plus the forest shade packed above it
      data[k + 3] = Math.min(1, Math.max(0, (fbm(x * 0.07, z * 0.07 + 5, 2) - 0.42) * 3)) * (w.p * 1 + w.y * 0.2);
      // taller grass: patches here and there, 20-40 m across, where it all grows to about 0.7x the hero's height (a crisp
      // edge, the same height throughout); mostly in the meadows, some in the marsh, fewer in the forest (packed into the
      // whole part of G)
      const thr = 0.66 + (1 - Math.min(1, w.p + w.v * 0.8 + w.y * 0.45)) * 0.07, tall = smooth(thr - 0.0015, thr + 0.0015, fbm(x * 0.032 + 50, z * 0.032 - 30, 3));   // (fewer outside the meadows)
      if (data[k + 1] > 0) data[k + 1] = Math.min(0.999, data[k + 1]) + 2 * Math.round(Math.min(1, tall) * 7);
      if (isRock(x, z)) { data[k + 1] = -1; data[k + 3] = 0; }   // bare rock: no grass, no flowers (-1, so blades stop halfway to the next texel)
    }
    // nothing grows in or over a rock, a boulder, a tree's trunk, a shrub or a ruin: a clear space round each (fading back
    // in just outside it), for the short grass and the tall alike, as round the things lying on the ground
    const kk2 = size / N;
    for (let cz = Math.floor(z0 / CELL) - 1; cz <= Math.floor((z0 + size) / CELL) + 1; cz += 3) for (let cx = Math.floor(x0 / CELL) - 1; cx <= Math.floor((x0 + size) / CELL) + 1; cx += 3) {
      const so = solidsAround(cx + 1, cz + 1).slice();   // (a 3×3 block of cells)
      // and round the shrubs, ferns and ruins standing about (not solid, but tall grass mustn't poke up through them)
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const it = layoutCell(cx + i, cz + j); for (let o = 0; o < it.length; o += STRIDE) { const r = CLEAR_R[SPECIES[it[o]].name]; if (r && it[o + 6] > 0) so.push(it[o + 2], it[o + 4], r * it[o + 6]); } }
      for (let s = 0; s < so.length; s += 3) {
        const sx = so[s], sz = so[s + 1], r = so[s + 2] + 0.15, R = r + 0.5;
        const i0 = Math.max(0, Math.floor((sx - R - x0) / kk2)), i1 = Math.min(N - 1, Math.ceil((sx + R - x0) / kk2)), j0 = Math.max(0, Math.floor((sz - R - z0) / kk2)), j1 = Math.min(N - 1, Math.ceil((sz + R - z0) / kk2));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const d = Math.hypot(x0 + (i + 0.5) * kk2 - sx, z0 + (j + 0.5) * kk2 - sz), f = Math.min(1, Math.max(0, (d - r) / 0.5)), k = (j * N + i) * 4;
          if (f >= 1 || data[k + 1] <= 0) continue; const tl = Math.floor(data[k + 1] / 2) * 2; data[k + 1] = tl + (data[k + 1] - tl) * f; data[k + 3] *= f;
        }
      }
    }
    self.postMessage({ type: 'grassTex', id: msg.id, data, N, x0, z0, size }, [data.buffer]);
  }
  else if (msg.type === 'mapImage') {     // the world map: painted like an old chart, hill-shaded
    const { N, extent } = msg, data = new Uint8ClampedArray(N * N * 4), w = { p: 0, y: 0, v: 0, r: 0 }, k = extent / N, H = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = heightAt(-extent / 2 + (i + 0.5) * k, -extent / 2 + (j + 0.5) * k);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -extent / 2 + (i + 0.5) * k, z = -extent / 2 + (j + 0.5) * k, h = H[j * N + i], o = (j * N + i) * 4;
      biomeWeights(x, z, w);
      let r, g, b;
      if (h < 0) { const d = Math.min(1, -h / 25); r = 96 - d * 40; g = 146 - d * 50; b = 168 - d * 30; }
      else if (h < 1.2) { r = 214; g = 196; b = 150; }
      else { r = 150 * w.p + 62 * w.y + 104 * w.v; g = 168 * w.p + 96 * w.y + 104 * w.v; b = 92 * w.p + 56 * w.y + 78 * w.v; }
      const hx = H[j * N + Math.min(N - 1, i + 1)] - H[j * N + Math.max(0, i - 1)], hz = H[Math.min(N - 1, j + 1) * N + i] - H[Math.max(0, j - 1) * N + i];
      const shade = h < 0 ? 1 : Math.max(0.55, Math.min(1.25, 1 + (-hx + -hz) * 0.035));
      const paper = 0.82 + 0.18 * fbm(x * 0.02, z * 0.02, 2);
      data[o] = r * shade * paper; data[o + 1] = g * shade * paper; data[o + 2] = b * shade * paper; data[o + 3] = 255;
      if (h > 0 && h < 30 && Math.abs((h % 10) - 5) < 0.18) { data[o] *= 0.8; data[o + 1] *= 0.8; data[o + 2] *= 0.8; }   // contour lines
    }
    self.postMessage({ type: 'mapImage', id: msg.id, data, N, extent }, [data.buffer]);
  }
  else if (msg.type === 'flora') {         // lay out an n×n block of flora cells
    const parts = []; let len = 0;
    for (let j = 0; j < msg.n; j++) for (let i = 0; i < msg.n; i++) { const a = layoutCell(msg.cx + i, msg.cz + j); parts.push(a); len += a.length; }
    const items = new Float32Array(len); let o = 0; for (const a of parts) { items.set(a, o); o += a.length; }
    self.postMessage({ type: 'flora', id: msg.id, items, cell: CELL }, [items.buffer]);
  }
};
