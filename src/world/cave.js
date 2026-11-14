// The rock of a Giant's cave (structures.js cave()): the hill over the cave and the chamber hollowed out of it, as one
// mesh. The terrain is cut down to the cave's floor under the chamber, its mouth and the cliff over it (gen.js); this
// is everything above that floor there: a density field (rock where it's positive) made of the hill's surface (the
// same caveHill the terrain follows round about) with a chamber and a passage out to the mouth carved from it, both
// lumpy with noise and banded with ledges like bedded stone, and the cliff's face craggy. Its surface is found with
// surface nets on a half-metre grid and coloured like the ground it stands in for: outside, groundColor itself (so the
// hill's top and the terrain round it are one), inside, dark rock, damp and sooty, moss towards the mouth. Its edges
// tuck under the terrain where the cut ends. Pure (no three.js): it's worked out in the worker pool (terrain-worker.js),
// what it builds is plain arrays, and the field is kept for what needs the rock's shape later (walls to bump into, the
// roof to walk on, the camera, things on the walls).
import { CAVE, CAVE_FORM as F, caveWorld, caveRho, caveCut, caveCliff, caveFloor, caveShade, heightAt, groundColor, biomeWeights } from './gen.js';
import { smooth, clamp, lerp } from '../util/math.js';

export const STEP = 0.5;   // (the grid: the terrain's own mesh is 2 m, so this is four times as fine)
const P = 2.4;            // (the chamber's and the passage's sections: squarer than an ellipse, walls steep at the floor)

// value noise in 3D from an integer hash, smoothly interpolated (each cave its own, from its seed)
function h3(i, j, k, s) { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1440662683) + Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vn(x, y, z, s) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), a = x - i, b = y - j, c = z - k, u = a * a * (3 - 2 * a), v = b * b * (3 - 2 * b), w = c * c * (3 - 2 * c);
  const l = (p, q, t) => p + (q - p) * t;
  return l(l(l(h3(i, j, k, s), h3(i + 1, j, k, s), u), l(h3(i, j + 1, k, s), h3(i + 1, j + 1, k, s), u), v), l(l(h3(i, j, k + 1, s), h3(i + 1, j, k + 1, s), u), l(h3(i, j + 1, k + 1, s), h3(i + 1, j + 1, k + 1, s), u), v), w);
}
const tri = (x) => Math.abs(x - Math.floor(x) - 0.5) * 2;   // (a triangle wave: the ledges)
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);

// Build cave c's rock (gen.js addCave). o.hearth: [u, v] of the giant's fire (soot on the roof over it). Returns
// { pos, nor, col, rock, index } for the mesh, in the cave's frame (x across, y up from its floor, z out of the mouth),
// and the field R (see densityAt and the queries after it).
export function caveRock(c, o = {}) {
  const sd = Math.round(c.seed * 7) | 0, [hx, hz] = o.hearth || [0, -6];
  // the box: wherever the shell has to stand over the cut (until it has tucked under the land beyond it)
  let u0 = 0, u1 = 0, v0 = 0, v1 = 0;
  for (let v = -40; v <= 24; v += 1) for (let u = -30; u <= 30; u += 1) if (caveCut(c, u, v) < F.RAMP + 3.8) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  u0 -= 1.5; u1 += 1.5; v0 -= 1.5; v1 += 1.5;
  const nu = Math.ceil((u1 - u0) / STEP) + 1, nv = Math.ceil((v1 - v0) / STEP) + 1, N2 = nu * nv;
  // the columns: the hill's top (the land as the cut doesn't see it), the floor, how far out of the chamber, the cut
  const HS = new Float32Array(N2), FL = new Float32Array(N2), RHO = new Float32Array(N2), CD = new Float32Array(N2), TOP = new Float32Array(N2), CL = new Float32Array(N2), GU = new Float32Array(N2), GV = new Float32Array(N2);
  CAVE.cut = false;
  try { for (let k = 0; k < nv; k++) for (let i = 0; i < nu; i++) { const u = u0 + i * STEP, v = v0 + k * STEP, [x, z] = caveWorld(c, u, v), n = k * nu + i; HS[n] = heightAt(x, z) - c.y; FL[n] = caveFloor(c, u, v) - c.y; RHO[n] = caveRho(c, u, v); CD[n] = caveCut(c, u, v); } }
  finally { CAVE.cut = true; }
  let ymax = 0, ymin = 0;
  for (let k = 0; k < nv; k++) for (let i = 0; i < nu; i++) {
    const n = k * nu + i, u = u0 + i * STEP, v = v0 + k * STEP, hs = HS[n];
    // how steep the hill is here (its cliff gets craggy), and how far the shell stands proud of it: a hand's breadth over
    // the cut (so the cut's raw edge under it never shows), then tucked under the land round about, deeper where it's steep
    const gx = (HS[k * nu + Math.min(nu - 1, i + 1)] - HS[k * nu + Math.max(0, i - 1)]) / (2 * STEP), gz = (HS[Math.min(nv - 1, k + 1) * nu + i] - HS[Math.max(0, k - 1) * nu + i]) / (2 * STEP), g = Math.hypot(gx, gz);
    CL[n] = smooth(0.8, 2.0, g) * smooth(F.RAMP + 1.2, 0, CD[n]); GU[n] = gx / (g || 1); GV[n] = gz / (g || 1);   // (craggy only where the shell stands for the land: beyond the cut it tucks under the terrain's own cliff)
    const lift = Math.min(lerp(0.15, -0.9 - g * 0.8, smooth(F.RAMP + 0.4, F.RAMP + 3.4, CD[n])), lerp(-0.3, 0.15, smooth(0.4, 1.4, hs - FL[n])));
    // never thin over the chamber or the passage: three metres of rock behind the cliff, two over the mouth (a brow of
    // rock standing out over it)
    const ch = RHO[n] < 1 ? F.HC * Math.pow(1 - Math.pow(RHO[n], P), 1 / P) : -9, pa = Math.abs(u) < F.WM && v > F.VC ? F.HM * Math.pow(1 - Math.pow(Math.abs(u) / F.WM, P), 1 / P) : -9, vc = caveCliff(c, u);
    const over = v < vc + 1.0 ? FL[n] + Math.max(ch, pa) + lerp(3.2, 2.2, smooth(vc - 1.5, vc + 0.5, v)) : -99;
    TOP[n] = smax(hs + lift, over, 2.5); ymax = Math.max(ymax, TOP[n]); ymin = Math.min(ymin, FL[n]);
  }
  // blocks of the same rock fallen from it: big ones at the cliff's foot (o.fallen: [u, how far out from the foot, size]),
  // rubble along the chamber's walls
  const at2 = (u, v) => clamp(Math.round((v - v0) / STEP), 0, nv - 1) * nu + clamp(Math.round((u - u0) / STEP), 0, nu - 1), blocks = [];
  let rs = (sd * 7919 + 13) % 2147483647; const rnd = () => ((rs = (rs * 16807) % 2147483647) - 1) / 2147483646;
  const ground = (n) => (CD[n] >= F.RAMP ? HS[n] : lerp(FL[n], HS[n], smooth(0, F.RAMP, CD[n])));   // (the land as the terrain has it: gen.js caveGround)
  const block = (u, v, s, out) => { const a = rnd() * 6.28, b = { u, v, y: ground(at2(u, v)) + s * (0.15 + rnd() * 0.2), sx: s * (0.9 + rnd() * 0.5), sy: s * (0.55 + rnd() * 0.3), sz: s * (0.75 + rnd() * 0.4), cs: Math.cos(a), sn: Math.sin(a), out }; b.r = Math.max(b.sx, b.sz) * 1.5 + 0.5; blocks.push(b); };
  for (const [bu, out, s] of o.fallen || []) { let v = caveCliff(c, bu) + 9; while (v > v0 + 1 && TOP[at2(bu, v)] - FL[at2(bu, v)] < 1.4) v -= 0.25; block(bu, v + out, s, true); }
  for (let k = 0; k < 20; k++) {
    const a = rnd() * Math.PI * 2, s = 0.5 + rnd() * 0.45; if (Math.sin(a) > 0.5 || (Math.sin(a) < -0.8)) continue;   // (none in the way in, nor before the stele at the back)
    let r = 0; while (r < 14 && RHO[at2(Math.cos(a) * r, F.VC + Math.sin(a) * r * 1.1)] < 0.84) r += 0.25; block(Math.cos(a) * r, F.VC + Math.sin(a) * r * 1.1, s, false);
  }
  const yb = ymin - 2, ny = Math.ceil((ymax + 2.5 - yb) / STEP) + 1, f = new Float32Array(N2 * ny);
  // the field: rock under the hill's top, except in the chamber and the passage (each a section swept round or along,
  // merged smoothly, their walls pushed in and out by the noise and ridged with ledges); below the floor both go straight
  // down, so the walls meet the ground the terrain makes there
  // (the cliff's face craggy: buttresses and bays a few metres across, joints running down it, ledges along it; the face
  // is pushed in and out across itself, the top looked up that far up or down the slope, so it never thins the rock over
  // the cave)
  const topAt = (u, v) => { const x = clamp((u - u0) / STEP, 0, nu - 1.001), z = clamp((v - v0) / STEP, 0, nv - 1.001), i = Math.floor(x), k = Math.floor(z), a = x - i, b = z - k, n = k * nu + i; return lerp(lerp(TOP[n], TOP[n + 1], a), lerp(TOP[n + nu], TOP[n + nu + 1], a), b); };
  const ext = (u, y, v, n) => { if (CL[n] <= 0) return TOP[n] - y; const cr = CL[n] * ((vn(u * 0.14, y * 0.1, v * 0.14, sd + 6) - 0.5) * 3.2 + (vn(u * 0.32, y * 0.3, v * 0.32, sd + 3) - 0.5) * 1.6 + (vn(u * 0.7, y * 0.12, v * 0.7, sd + 4) - 0.5) * 0.9 + 0.35 * tri(y * 0.45 + vn(u * 0.2, y * 0.2, v * 0.2, sd + 5) * 1.5)); return topAt(u + GU[n] * cr, v + GV[n] * cr) - y; };
  const cav = (u, y, v, n) => {
    const yy = Math.max(0, y - FL[n]);
    const dch = (Math.pow(Math.pow(RHO[n], P) + Math.pow(yy / F.HC, P), 1 / P) - 1) * 6.5;
    const dpa = Math.max((Math.pow(Math.pow(Math.abs(u) / F.WM, P) + Math.pow(yy / F.HM, P), 1 / P) - 1) * 3.6, F.VC - v, v - F.MZ - 7);
    const n1 = vn(u * 0.17, y * 0.21, v * 0.17, sd) - 0.5;
    return smin(dch, dpa, 2.6) + n1 * 2.2 + (vn(u * 0.43, y * 0.5, v * 0.43, sd + 1) - 0.5) * 0.9 + (vn(u * 0.95, y * 1.1, v * 0.95, sd + 2) - 0.5) * 0.35 + 0.2 * tri(y * 0.8 + n1 * 1.2);
  };
  const near = Array.from({ length: N2 }, () => null);   // (the blocks over each column)
  for (const b of blocks) for (let k = Math.max(0, Math.floor((b.v - b.r - v0) / STEP)); k <= Math.min(nv - 1, Math.ceil((b.v + b.r - v0) / STEP)); k++) for (let i = Math.max(0, Math.floor((b.u - b.r - u0) / STEP)); i <= Math.min(nu - 1, Math.ceil((b.u + b.r - u0) / STEP)); i++) (near[k * nu + i] ||= []).push(b);
  for (let k = 0; k < nv; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nu; i++) {
    const u = u0 + i * STEP, y = yb + j * STEP, v = v0 + k * STEP, n = k * nu + i;
    let d = Math.min(ext(u, y, v, n), cav(u, y, v, n));
    if (near[n]) for (const b of near[n]) { const t = blockT(b, u, y, v); if (t < 2) d = Math.max(d, (1 - t) * b.sy + (vn(u * 1.1, y * 1.1, v * 1.1, sd + 20) - 0.5) * 0.3); }
    f[(k * ny + j) * nu + i] = d;
  }
  const R = { c, u0, v0, yb, nu, ny, nv, f, TOP, HS, FL, CD, RHO, CL, blocks };
  return { R, ...mesh(R, c, sd, hx, hz) };
}

// how far out a point lies in a fallen block, as a share of its size (1 on its surface: a box with rounded corners)
function blockT(b, u, y, v) {
  const du = u - b.u, dv = v - b.v, dy = y - b.y; if (Math.abs(du) > b.r || Math.abs(dv) > b.r || Math.abs(dy) > b.r) return 9;
  const x = du * b.cs - dv * b.sn, z = du * b.sn + dv * b.cs; return Math.pow((x / b.sx) ** 4 + (dy / b.sy) ** 4 + (z / b.sz) ** 4, 0.25);
}

// ---- surface nets: a vertex in every cell the surface crosses (where its edges cross, averaged), a quad across every
// grid edge it crosses, facing out of the rock
function mesh(R, c, sd, hx, hz) {
  const { u0, v0, yb, nu, ny, nv, f, TOP, HS, CD, CL } = R, at = (i, j, k) => f[(k * ny + j) * nu + i];
  const cellV = new Int32Array(nu * ny * nv).fill(-1), pos = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], co = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], d = new Float32Array(8);
  for (let k = 0; k < nv - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nu - 1; i++) {
    let m = 0; for (let q = 0; q < 8; q++) { d[q] = at(i + co[q][0], j + co[q][1], k + co[q][2]); if (d[q] > 0) m |= 1 << q; }
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of E) { if ((d[a] > 0) === (d[b] > 0)) continue; const t = d[a] / (d[a] - d[b]); sx += co[a][0] + (co[b][0] - co[a][0]) * t; sy += co[a][1] + (co[b][1] - co[a][1]) * t; sz += co[a][2] + (co[b][2] - co[a][2]) * t; cnt++; }
    cellV[(k * ny + j) * nu + i] = pos.length / 3; pos.push(u0 + (i + sx / cnt) * STEP, yb + (j + sy / cnt) * STEP, v0 + (k + sz / cnt) * STEP);
  }
  const cv = (i, j, k) => cellV[(k * ny + j) * nu + i], index = [];
  const quad = (a, b, cc, dd, flip) => { if (a < 0 || b < 0 || cc < 0 || dd < 0) return; if (flip) index.push(a, dd, cc, a, cc, b); else index.push(a, b, cc, a, cc, dd); };
  for (let k = 1; k < nv - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nu - 1; i++) {
    const s0 = at(i, j, k) > 0;
    if (s0 !== (at(i + 1, j, k) > 0)) quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), !s0);       // (along u: around it in y, then v)
    if (s0 !== (at(i, j + 1, k) > 0)) quad(cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1), !s0);       // (along y: in v, then u)
    if (s0 !== (at(i, j, k + 1) > 0)) quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), !s0);       // (along v: in u, then y)
  }
  // normals from the field (out of the rock), and the colours
  const nV = pos.length / 3, nor = new Float32Array(nV * 3), col = new Float32Array(nV * 3), rock = new Float32Array(nV), out = [0, 0, 0, 0], w = { p: 0, y: 0, v: 0, r: 0 };
  CAVE.cut = false;
  try {
    for (let q = 0; q < nV; q++) {
      const u = pos[q * 3], y = pos[q * 3 + 1], v = pos[q * 3 + 2], e = STEP * 0.6;
      let gx = densityAt(R, u + e, y, v) - densityAt(R, u - e, y, v), gy = densityAt(R, u, y + e, v) - densityAt(R, u, y - e, v), gz = densityAt(R, u, y, v + e) - densityAt(R, u, y, v - e);
      const l = Math.hypot(gx, gy, gz) || 1; gx = -gx / l; gy = -gy / l; gz = -gz / l; nor[q * 3] = gx; nor[q * 3 + 1] = gy; nor[q * 3 + 2] = gz;
      // (inside: under the rock, rock over it whichever way it looks up, and well below the hill's top)
      const n = colAt(R, u, v); let cov = 0;
      if (TOP[n] - y > 0.5) for (const [du, dv] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6]]) for (let t = 0.9; t < 16 && y + t < TOP[n] + 2.5; t += 0.9) if (densityAt(R, u + gx * 0.3 + du * t, y + gy * 0.3 + t, v + gz * 0.3 + dv * t) > 0) { cov++; break; }
      const inside = smooth(0.5, 1.9, TOP[n] - y) * smooth(1, 3.5, cov);
      // outside: the ground's own colour, as the terrain worker makes it (hollows a touch darker, ridges lighter)
      let er = 0, eg = 0, eb = 0, ek = 0;
      if (inside < 1) {
        const [x, z] = caveWorld(c, u, v), h = HS[n] + c.y; groundColor(x, z, h, 0, biomeWeights(x, z, w), out);
        const k4 = (du, dv) => HS[colAt(R, u + du, v + dv)], cav = clamp(((k4(-2, 0) + k4(2, 0) + k4(0, -2) + k4(0, 2)) / 4 - HS[n]) * 0.125, -0.05, 0.1);
        er = out[0] * (1 - cav); eg = out[1] * (1 - cav); eb = out[2] * (1 - cav); ek = out[3];
        // a fallen block: bare grey rock, moss on its top
        let tb = 9; for (const b of R.blocks) tb = Math.min(tb, blockT(b, u, y, v)); const wb = smooth(1.4, 1.05, tb);
        if (wb > 0) { const n3 = vn(u * 0.7, y * 0.7, v * 0.7, sd + 21), ms = smooth(0.55, 0.85, gy) * smooth(0.4, 0.7, n3) * 0.8;
          er = lerp(er, lerp(lerp(0.40, 0.48, n3), 0.17, ms), wb); eg = lerp(eg, lerp(lerp(0.375, 0.455, n3), 0.24, ms), wb); eb = lerp(eb, lerp(lerp(0.34, 0.41, n3), 0.1, ms), wb); ek = lerp(ek, 1 - ms * 0.8, wb); }
        // on the cliff (not where the cut ends and the terrain's own rock takes over): dark streaks where the rain runs
        // down it, and moss and grass on its ledges
        const k = CL[n] * smooth(-0.5, -3, CD[n]);
        if (k > 0) { const st = 1 - smooth(0.5, 0.8, vn(u * 0.6, y * 0.05, v * 0.6, sd + 12)) * 0.4 * smooth(0.5, -0.2, gy) * k; er *= st; eg *= st; eb *= st;
          const ms = smooth(0.35, 0.75, gy) * smooth(0.35, 0.6, vn(u * 0.5, y * 0.5, v * 0.5, sd + 13)) * k; er = lerp(er, 0.17, ms); eg = lerp(eg, 0.24, ms); eb = lerp(eb, 0.1, ms); ek *= 1 - ms * 0.8; }
      }
      // inside: two greys of rock in broad patches, darker damp streaks running down, pale mineral on the ledges, moss
      // towards the mouth where the light reaches, soot over the fire; dark in the hollows, and darker the deeper in
      let ir = 0, ig = 0, ib = 0;
      if (inside > 0) {
        const n1 = vn(u * 0.35, y * 0.35, v * 0.35, sd + 9), streak = smooth(0.55, 0.8, vn(u * 0.9, y * 0.09, v * 0.9, sd + 10)), n2 = vn(u * 1.1, y * 1.1, v * 1.1, sd + 11);
        ir = lerp(0.25, 0.19, n1); ig = lerp(0.235, 0.175, n1); ib = lerp(0.21, 0.16, n1);
        const dk = 1 - streak * 0.35; ir *= dk; ig *= dk; ib *= dk;
        const led = smooth(0.45, 0.85, gy) * smooth(0.4, 0.7, n2) * 0.45; ir = lerp(ir, 0.42, led); ig = lerp(ig, 0.40, led); ib = lerp(ib, 0.35, led);
        const moss = smooth(F.MZ - 4, F.MZ + 1, v) * smooth(0.42, 0.65, n2) * (0.5 + 0.5 * smooth(0, -0.6, gy)) * 0.8; ir = lerp(ir, 0.20, moss); ig = lerp(ig, 0.26, moss); ib = lerp(ib, 0.13, moss);
        const soot = Math.exp(-((u - hx) ** 2 + (v - hz) ** 2) / 10) * smooth(2.5, 6.5, y); ir *= 1 - soot * 0.75; ig *= 1 - soot * 0.75; ib *= 1 - soot * 0.75;
        const open = smooth(-0.1, -1.2, densityAt(R, u + gx * 1.0, y + gy * 1.0, v + gz * 1.0)), ao = (0.5 + 0.5 * open) * (y < 1 ? lerp(0.75, 1, y) : 1);
        const sh = caveShade(smooth(F.MZ, F.VC - F.RZ * 0.7, v)) * ao; ir *= sh; ig *= sh; ib *= sh;
      }
      col[q * 3] = lerp(er, ir, inside); col[q * 3 + 1] = lerp(eg, ig, inside); col[q * 3 + 2] = lerp(eb, ib, inside); rock[q] = lerp(ek, 0.75, inside);
    }
  } finally { CAVE.cut = true; }
  return { pos: new Float32Array(pos), nor, col, rock, index: new Uint32Array(index) };
}

// ---- the field, for the queries (all in the cave's frame, y from its floor)
const colAt = (R, u, v) => clamp(Math.round((v - R.v0) / STEP), 0, R.nv - 1) * R.nu + clamp(Math.round((u - R.u0) / STEP), 0, R.nu - 1);
// the rock's density at a point, from the grid (positive in rock; outside the box, rock below the land and air above)
export function densityAt(R, u, y, v) {
  const x = (u - R.u0) / STEP, yy = (y - R.yb) / STEP, z = (v - R.v0) / STEP;
  if (x < 0 || z < 0 || x >= R.nu - 1 || z >= R.nv - 1) return -1;
  if (yy < 0) return 1; if (yy >= R.ny - 1) return -1;
  const i = Math.floor(x), j = Math.floor(yy), k = Math.floor(z), a = x - i, b = yy - j, t = z - k, f = R.f, nu = R.nu, s = R.ny * nu, o = (k * R.ny + j) * nu + i;
  const c0 = f[o] + (f[o + 1] - f[o]) * a, c1 = f[o + nu] + (f[o + nu + 1] - f[o + nu]) * a, c2 = f[o + s] + (f[o + s + 1] - f[o + s]) * a, c3 = f[o + s + nu] + (f[o + s + nu + 1] - f[o + s + nu]) * a;
  const d0 = c0 + (c1 - c0) * b; return d0 + (c2 + (c3 - c2) * b - d0) * t;
}
// how far along the segment a → b (local [u, y, v]) the first rock lies, or null if it's clear
export function rayRock(R, a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.ceil(L / 0.2);
  for (let s = 1; s <= n; s++) { const t = s / n; if (densityAt(R, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t) > 0) return t * L; }
  return null;
}
// the rock's surface from a (in the air) along direction d, within reach: [u, y, v] where it is met and the surface's
// normal there, or null
export function surfaceFrom(R, a, d, reach = 20) {
  let prev = densityAt(R, a[0], a[1], a[2]);
  for (let t = 0.1; t <= reach; t += 0.1) {
    const p = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t], q = densityAt(R, ...p);
    if (q > 0 && prev <= 0) { const s = t - 0.1 * (q / (q - prev)), h = [a[0] + d[0] * s, a[1] + d[1] * s, a[2] + d[2] * s]; return { p: h, n: normalAt(R, ...h) }; }
    prev = q;
  }
  return null;
}
function normalAt(R, u, y, v) {
  const e = 0.3, gx = densityAt(R, u - e, y, v) - densityAt(R, u + e, y, v), gy = densityAt(R, u, y - e, v) - densityAt(R, u, y + e, v), gz = densityAt(R, u, y, v - e) - densityAt(R, u, y, v + e), l = Math.hypot(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l];
}
// the top of the rock over the cut-down ground at (u, v), to walk on (the hill over the chamber, the cliff's top), or
// -Infinity where the ground beneath is the terrain's own or there's no rock standing there
export function roofAt(R, u, v) {
  const x = (u - R.u0) / STEP, z = (v - R.v0) / STEP; if (x < 0 || z < 0 || x > R.nu - 1 || z > R.nv - 1) return -Infinity;
  const n = colAt(R, u, v); if (R.CD[n] > F.RAMP + 0.8) return -Infinity;
  const t = R.TOP[n]; return densityAt(R, u, t - 0.6, v) > 0 ? t : -Infinity;
}
