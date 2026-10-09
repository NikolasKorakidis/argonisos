// The building pieces of milestone 1.0: the wooden set (walls, door, beams, floor, thatch roofs and gable ends, stairs,
// fence, stockade, awning, gates) and the equipment you place (workbench, campfire, cooking stand, bed, chest, standing
// torch). Each piece describes its model, snap points, the surfaces you can stand on, what blocks you, and its cost.
//
// Local frame: walls run along x, y up, thickness along z. Floors: top at y = 0. Roofs: the eave runs along x at y = 0,
// z = 0 and the slope climbs towards -z up to the ridge.
import * as THREE from 'three';

// ---- materials: painted planks, rough beams, golden thatch
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
let sd = 3; const r = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646;
const planks = canvasTex(256, 256, (g, w, h) => {
  const n = 6, pw = w / n;
  for (let i = 0; i < n; i++) {
    const base = 120 + r() * 40; g.fillStyle = `rgb(${base + 22},${base - 8},${base - 48})`; g.fillRect(i * pw, 0, pw, h);
    for (let k = 0; k < 40; k++) { const x = i * pw + r() * pw, a = 0.05 + r() * 0.08; g.strokeStyle = `rgba(60,35,15,${a})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + r() * 6 - 3, h * 0.3, x + r() * 6 - 3, h * 0.7, x + r() * 4 - 2, h); g.stroke(); }
    g.fillStyle = 'rgba(40,22,10,.75)'; g.fillRect(i * pw, 0, 2, h);
    const kx = i * pw + 6 + r() * (pw - 12), ky = r() * h; g.fillStyle = 'rgba(60,32,14,.5)'; g.beginPath(); g.ellipse(kx, ky, 2.5, 5, 0, 0, 7); g.fill();
    for (const y of [h * 0.12, h * 0.88]) { g.fillStyle = 'rgba(30,20,12,.8)'; g.beginPath(); g.arc(i * pw + pw / 2, y, 2.2, 0, 7); g.fill(); }   // pegs
  }
});
const beamTex = canvasTex(64, 256, (g, w, h) => {
  g.fillStyle = '#7a5434'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 30; k++) { const x = r() * w; g.strokeStyle = `rgba(40,22,10,${0.1 + r() * 0.15})`; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + r() * 4 - 2, h); g.stroke(); }
});
const thatchTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#b8954e'; g.fillRect(0, 0, w, h);
  for (let row = 0; row < 8; row++) for (let k = 0; k < 220; k++) {
    const x = r() * w, y0 = row * (h / 8) + r() * 6, l = h / 8 + 10 + r() * 10, v = 150 + r() * 70;
    g.strokeStyle = `rgba(${v},${v * 0.78},${v * 0.42},.85)`; g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, y0); g.lineTo(x + r() * 4 - 2, y0 + l); g.stroke();
  }
  for (let row = 1; row < 8; row++) { g.fillStyle = 'rgba(70,45,15,.35)'; g.fillRect(0, row * (h / 8) - 2, w, 3); }
});
export const MAT = {
  plank: new THREE.MeshStandardMaterial({ map: planks, roughness: 0.85 }),
  beam: new THREE.MeshStandardMaterial({ map: beamTex, roughness: 0.9 }),
  thatch: new THREE.MeshStandardMaterial({ map: thatchTex, roughness: 0.95, side: THREE.DoubleSide }),
  dark: new THREE.MeshStandardMaterial({ color: 0x4e3622, roughness: 0.9 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x8f887e, roughness: 0.95, flatShading: true }),
  fur: new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 }),
  cloth: new THREE.MeshStandardMaterial({ color: 0xd9c8a0, roughness: 0.95 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.6, metalness: 0.4 }),
  ember: new THREE.MeshStandardMaterial({ color: 0x3a1a0a, emissive: 0xff5a10, emissiveIntensity: 1.6, roughness: 1 }),
};

// ---- geometry helpers. A box with UVs in metres (so textures tile at a constant size)
function box(w, h, d, x = 0, y = 0, z = 0, uvScale = 1 / 3) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const sx = ax > 0.5 ? d : w, sy = ay > 0.5 ? d : h; uv.setXY(i, uv.getX(i) * sx * uvScale, uv.getY(i) * sy * uvScale);
  }
  return g.translate(x, y, z);
}
const part = (geo, mat) => ({ geo, mat });
const merge = (parts) => {   // group parts by material into one mesh each
  const byMat = new Map(); for (const p of parts) (byMat.get(p.mat) || byMat.set(p.mat, []).get(p.mat)).push(p.geo.index ? p.geo.toNonIndexed() : p.geo);
  return [...byMat].map(([mat, geos]) => { const g = mergeGeos(geos); return { geo: g, mat }; });
};
function mergeGeos(geos) {
  const names = ['position', 'normal', 'uv'], out = {}; let total = 0; for (const g of geos) total += g.attributes.position.count;
  for (const nm of names) { const sz = nm === 'uv' ? 2 : 3, a = new Float32Array(total * sz); let o = 0; for (const g of geos) { const src = g.attributes[nm]; if (src) a.set(src.array, o); o += g.attributes.position.count * sz; } out[nm] = new THREE.BufferAttribute(a, sz); }
  const g = new THREE.BufferGeometry(); for (const nm of names) g.setAttribute(nm, out[nm]); g.computeBoundingSphere(); return g;
}
// A sloped slab from the eave (z = 0, y = 0) up to the ridge (z = -run, y = rise), width w along x, with a little overhang
function slab(w, run, rise, t, mat, over = 0.3) {
  const len = Math.hypot(run, rise) + over, a = Math.atan2(rise, run);
  const g = box(w, t, len, 0, 0, 0, 1 / 3).translate(0, t / 2, -len / 2 + over);
  // thinner towards the ridge: a panel stacked above overlaps this one's top end with its overhang, and without the step
  // the two thatch surfaces would lie in one plane and flicker
  const q = g.attributes.position; for (let i = 0; i < q.count; i++) if (q.getY(i) > t / 2 && q.getZ(i) < -len / 2) q.setY(i, q.getY(i) - 0.04);
  g.rotateX(a);
  return part(g, mat);
}
function triangle(base, height, t, mat) {   // a gable end: base along x at y = 0, apex at (0, height)
  // its sloped edges sit 3 cm under the roof's underside (in the same plane they flickered against the thatch)
  const b = base / 2, L = Math.hypot(b, height), d = 0.03, hb = b - (d * L) / height, hh = height - (d * L) / b;
  const s = new THREE.Shape(); s.moveTo(-hb, 0); s.lineTo(hb, 0); s.lineTo(0, hh); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }).translate(0, 0, -t / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3, uv.getY(i) / 3);
  return part(g, mat);
}

// ---- the pieces
// snaps: [x,y,z] local snap points. solids: boxes [cx,cy,cz,w,h,d] that block movement. tops: surfaces to stand on,
// { x0,x1,z0,z1, y } (flat) or with y0/y1 for a slope along z (y at z0 → y at z1). roof: tops that count as shelter.
const W = 3, T = 0.2;
const corners = (w, h) => [[-w / 2, 0, 0], [w / 2, 0, 0], [-w / 2, h, 0], [w / 2, h, 0], [0, 0, 0], [0, h, 0]];
export const PIECES = [
  { id: 'wall', name: 'Wooden Wall 3×3', cat: 'Walls', icon: 'wall', mats: { wood: 4, rope: 2 }, hp: 800,
    parts: () => [part(box(W, W, T, 0, W / 2, 0), MAT.plank), part(box(0.24, W, 0.26, -W / 2 + 0.12, W / 2, 0), MAT.beam), part(box(0.24, W, 0.26, W / 2 - 0.12, W / 2, 0), MAT.beam), part(box(W, 0.22, 0.26, 0, W - 0.11, 0), MAT.beam)],
    snaps: corners(W, W), solids: [[0, W / 2, 0, W, W, T + 0.1]] },
  { id: 'wallHalf', name: 'Wooden Wall 3×1', cat: 'Walls', icon: 'wall', mats: { wood: 2, rope: 1 }, hp: 400,
    parts: () => [part(box(W, 1, T, 0, 0.5, 0), MAT.plank), part(box(W, 0.18, 0.26, 0, 0.91, 0), MAT.beam)],
    snaps: corners(W, 1), solids: [[0, 0.5, 0, W, 1, T + 0.1]] },
  { id: 'doorframe', name: 'Wooden Door Frame', cat: 'Walls', icon: 'door', mats: { wood: 2, rope: 1 }, hp: 600,
    parts: () => [part(box(0.8, W, T, -1.1, W / 2, 0), MAT.plank), part(box(0.8, W, T, 1.1, W / 2, 0), MAT.plank), part(box(1.4, 0.7, T, 0, 2.65, 0), MAT.plank),
      part(box(0.18, 2.3, 0.3, -0.79, 1.15, 0), MAT.beam), part(box(0.18, 2.3, 0.3, 0.79, 1.15, 0), MAT.beam), part(box(1.76, 0.2, 0.3, 0, 2.3, 0), MAT.beam)],
    snaps: [...corners(W, W), [-0.7, 0, 0], [0.7, 0, 0]], solids: [[-1.1, W / 2, 0, 0.8, W, T + 0.1], [1.1, W / 2, 0, 0.8, W, T + 0.1], [0, 2.65, 0, 1.4, 0.7, T + 0.1]] },
  { id: 'door', name: 'Wooden Door', cat: 'Walls', icon: 'door', mats: { wood: 2, rope: 1 }, hp: 800, door: { w: 1.4, hinge: -0.7 },
    parts: () => [part(box(1.36, 2.28, 0.08, 0.68, 1.14, 0), MAT.plank), part(box(1.3, 0.12, 0.12, 0.68, 0.5, 0.05), MAT.beam), part(box(1.3, 0.12, 0.12, 0.68, 1.8, 0.05), MAT.beam), part(box(0.06, 0.06, 0.1, 1.2, 1.1, 0.08), MAT.iron)],
    snaps: [[0, 0, 0], [1.4, 0, 0]], solids: [[0.7, 1.15, 0, 1.4, 2.3, 0.12]], pivot: [-0.7, 0, 0] },
  { id: 'beamV', name: 'Wooden Vertical Beam 3m', cat: 'Beams', icon: 'beam', mats: { wood: 1 }, hp: 150,
    parts: () => [part(box(0.26, W, 0.26, 0, W / 2, 0), MAT.beam)], snaps: [[0, 0, 0], [0, W, 0], [0, W / 2, 0]], solids: [[0, W / 2, 0, 0.3, W, 0.3]] },
  { id: 'beamH', name: 'Wooden Horizontal Beam 3m', cat: 'Beams', icon: 'beam', mats: { wood: 1 }, hp: 150,
    parts: () => [part(box(W, 0.26, 0.26, 0, 0, 0), MAT.beam)], snaps: [[-W / 2, 0, 0], [W / 2, 0, 0], [0, 0, 0]], solids: [], tops: [{ x0: -1.5, x1: 1.5, z0: -0.13, z1: 0.13, y: 0.13 }] },
  { id: 'beamD', name: 'Wooden Diagonal Beam 3m', cat: 'Beams', icon: 'beam', mats: { wood: 1 }, hp: 150,
    parts: () => [part(box(0.26, Math.hypot(2.12, 2.12), 0.26, 0, 0, 0).rotateZ(-Math.PI / 4).translate(0, 1.06, 0), MAT.beam)], snaps: [[-1.06, 0, 0], [1.06, 2.12, 0]], solids: [] },
  { id: 'floor', name: 'Wooden Floor 3×3', cat: 'Floors', icon: 'floor', mats: { wood: 4, rope: 2 }, hp: 800,
    parts: () => [part(box(W, T, W, 0, -T / 2, 0).rotateY(Math.PI / 2), MAT.plank), part(box(0.22, 0.24, W, -W / 2 + 0.11, -0.2, 0), MAT.beam), part(box(0.22, 0.24, W, W / 2 - 0.11, -0.2, 0), MAT.beam)],
    snaps: [[-1.5, 0, -1.5], [1.5, 0, -1.5], [-1.5, 0, 1.5], [1.5, 0, 1.5], [0, 0, -1.5], [0, 0, 1.5], [-1.5, 0, 0], [1.5, 0, 0], [0, 0, 0]], solids: [], tops: [{ x0: -1.5, x1: 1.5, z0: -1.5, z1: 1.5, y: 0 }], roof: true },
  ...[[6, 3, 'roof63', 'Thatch Roof 6×3', { wood: 2, rope: 1 }, 400], [6, 5, 'roof65', 'Thatch Roof 6×5', { wood: 2, rope: 1 }, 400], [9, 4, 'roof94', 'Thatch Roof 9×4', { wood: 4, rope: 2 }, 500]].map(([span, rise, id, name, mats, hp]) => {
    const run = span / 2;
    return { id, name, cat: 'Roofs', icon: 'roof', mats, hp, roofPitch: Math.atan2(rise, run),
      // rafters along both sides: a centimetre proud of the thatch's ends, a little below its underside and short of its
      // eave and ridge, so no rafter face lies in a thatch face (they flickered against each other)
      parts: () => [slab(W, run, rise, 0.22, MAT.thatch), ...[-1, 1].map((sd) => part(box(0.2, 0.2, Math.hypot(run, rise) + 0.26, sd * (W / 2 - 0.09), 0, 0).translate(0, 0.05, -(Math.hypot(run, rise) + 0.3) / 2 + 0.3).rotateX(Math.atan2(rise, run)), MAT.beam))],
      snaps: [[-W / 2, 0, 0], [W / 2, 0, 0], [0, 0, 0], [-W / 2, rise, -run], [W / 2, rise, -run], [0, rise, -run]], solids: [],
      tops: [{ x0: -1.5, x1: 1.5, z0: 0, z1: -run, y0: 0.25, y1: rise + 0.25 }], roof: true };
  }),
  ...[[6, 3, 'end63', 'Wooden Roof End 6×3', { wood: 4, rope: 2 }, 300], [6, 5, 'end65', 'Wooden Roof End 6×5', { wood: 4, rope: 2 }, 300], [9, 4, 'end94', 'Wooden Roof End 9×4', { wood: 6, rope: 4 }, 400]].map(([span, rise, id, name, mats, hp]) => ({
    id, name, cat: 'Roofs', icon: 'roofEnd', mats, hp,
    parts: () => [triangle(span, rise, T, MAT.plank), part(box(span, 0.22, 0.26, 0, 0.11, 0), MAT.beam)],
    snaps: [[-span / 2, 0, 0], [span / 2, 0, 0], [0, 0, 0], [-span / 2 + 3, 0, 0], [span / 2 - 3, 0, 0], [0, rise, 0]], solids: [[0, rise / 3, 0, span * 0.66, rise * 0.66, T + 0.1]] })),
  { id: 'stairs', name: 'Wooden Stairs Short', cat: 'Floors', icon: 'stairs', mats: { wood: 2, rope: 1 }, hp: 400,
    parts: () => stairs(1.5, 2), snaps: [[-1, 0, 0], [1, 0, 0], [-1, 1.5, -2], [1, 1.5, -2]], solids: [], tops: [{ x0: -1, x1: 1, z0: 0, z1: -2, y0: 0, y1: 1.5 }] },
  { id: 'stairsLong', name: 'Wooden Stairs Long', cat: 'Floors', icon: 'stairs', mats: { wood: 4, rope: 2 }, hp: 600,
    parts: () => stairs(3, 4), snaps: [[-1, 0, 0], [1, 0, 0], [-1, 3, -4], [1, 3, -4]], solids: [], tops: [{ x0: -1, x1: 1, z0: 0, z1: -4, y0: 0, y1: 3 }] },
  { id: 'fence', name: 'Wooden Fence 2m', cat: 'Fences', icon: 'fence', mats: { wood: 2, rope: 1 }, hp: 300,
    parts: () => [part(box(0.14, 1.2, 0.14, -0.95, 0.6, 0), MAT.beam), part(box(0.14, 1.2, 0.14, 0.95, 0.6, 0), MAT.beam), part(box(2, 0.1, 0.06, 0, 0.45, 0), MAT.plank), part(box(2, 0.1, 0.06, 0, 0.95, 0), MAT.plank)],
    snaps: [[-1, 0, 0], [1, 0, 0]], solids: [[0, 0.6, 0, 2, 1.2, 0.2]] },
  { id: 'stockade', name: 'Wooden Stockade 4×4', cat: 'Fences', icon: 'stockade', mats: { wood: 6, rope: 4 }, hp: 800,
    parts: () => { const P = []; for (let i = 0; i < 12; i++) { const x = -1.83 + i * 0.333, h = 3.6 + ((i * 7) % 5) * 0.08; P.push(part(new THREE.CylinderGeometry(0.16, 0.17, h, 7).translate(x, h / 2, 0), MAT.beam), part(new THREE.ConeGeometry(0.16, 0.4, 7).translate(x, h + 0.2, 0), MAT.beam)); }
      P.push(part(box(4, 0.16, 0.12, 0, 1.2, 0.17), MAT.dark), part(box(4, 0.16, 0.12, 0, 2.8, 0.17), MAT.dark)); return P; },
    snaps: [[-2, 0, 0], [2, 0, 0], [-2, 4, 0], [2, 4, 0]], solids: [[0, 2, 0, 4, 4, 0.4]] },
  { id: 'awning', name: 'Wooden Awning', cat: 'Roofs', icon: 'roof', mats: { wood: 2, rope: 1 }, hp: 400,
    parts: () => [slab(W, 1.5, 0.55, 0.12, MAT.plank, 0.2)], snaps: [[-1.5, 0.55, -1.5], [1.5, 0.55, -1.5], [0, 0.55, -1.5]], solids: [], tops: [{ x0: -1.5, x1: 1.5, z0: 0, z1: -1.5, y0: 0.12, y1: 0.67 }], roof: true },
  ...['gateL', 'gateR'].map((id, k) => ({ id, name: k ? 'Wooden Gate Right' : 'Wooden Gate Left', cat: 'Fences', icon: 'gate', mats: { wood: 6, rope: 4 }, hp: 800, door: { w: 2, hinge: k ? 1 : -1 },
    parts: () => { const s = k ? -1 : 1, P = []; for (let i = 0; i < 6; i++) P.push(part(box(0.3, 2.4, 0.1, s * (0.17 + i * 0.33), 1.2, 0), MAT.plank)); P.push(part(box(2, 0.16, 0.12, s * 1, 0.5, 0.08), MAT.dark), part(box(2, 0.16, 0.12, s * 1, 1.9, 0.08), MAT.dark)); return P; },
    snaps: [[0, 0, 0], [k ? -2 : 2, 0, 0]], solids: [[k ? -1 : 1, 1.2, 0, 2, 2.4, 0.15]], pivot: [k ? 1 : -1, 0, 0] })),
  // ---- equipment and furniture (placed on the ground or a floor)
  { id: 'workbench', name: 'Workbench', cat: 'Crafting', icon: 'anvil', mats: { wood: 10 }, hp: 150, station: 'workbench', equip: true, desc: 'Craft better gear at it. Needs a roof over it for most work.',
    parts: () => { const P = [part(box(2, 0.12, 0.9, 0, 0.92, 0), MAT.plank)]; for (const [x, z] of [[-0.9, -0.38], [0.9, -0.38], [-0.9, 0.38], [0.9, 0.38]]) P.push(part(box(0.12, 0.92, 0.12, x, 0.46, z), MAT.beam));
      P.push(part(box(1.8, 0.08, 0.08, 0, 0.3, 0.38), MAT.beam), part(box(0.5, 0.4, 0.05, -0.6, 1.25, -0.42), MAT.plank), part(box(0.05, 0.3, 0.05, 0.3, 1.13, 0.1), MAT.beam), part(box(0.14, 0.08, 0.08, 0.3, 1.27, 0.1), MAT.iron),
        part(new THREE.CylinderGeometry(0.12, 0.14, 0.3, 10).translate(0.7, 1.13, -0.15), MAT.dark)); return P; },
    snaps: [[0, 0, 0]], solids: [[0, 0.5, 0, 2, 1, 0.9]], tops: [{ x0: -1, x1: 1, z0: -0.45, z1: 0.45, y: 0.98 }] },
  { id: 'campfire', name: 'Campfire', cat: 'Crafting', icon: 'fire', mats: { stone: 10, wood: 10 }, hp: 100, fire: true, equip: true, desc: 'Warmth and light. Keep it fed with wood (E). Rain puts out a fire that has no roof over it.',
    parts: () => { const P = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; P.push(part(new THREE.DodecahedronGeometry(0.17, 0).scale(1, 0.75, 1.2).rotateY(-a).translate(Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62), MAT.stone)); }
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; P.push(part(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 6).rotateZ(1.1).rotateY(a).translate(Math.cos(a) * 0.18, 0.22, Math.sin(a) * 0.18), MAT.beam)); }
      P.push(part(new THREE.CylinderGeometry(0.4, 0.45, 0.06, 10).translate(0, 0.03, 0), MAT.ember)); return P; },
    snaps: [[0, 0, 0]], solids: [[0, 0.2, 0, 1.2, 0.4, 1.2]] },
  { id: 'cookingStand', name: 'Cooking Stand', cat: 'Crafting', icon: 'meat', mats: { wood: 6 }, hp: 50, cook: 3, equip: true, desc: 'Place it over a fire, then hang raw meat on it (E).',
    parts: () => [part(box(0.08, 1.1, 0.08, -0.75, 0.55, 0).rotateZ(-0.12), MAT.beam), part(box(0.08, 1.1, 0.08, 0.75, 0.55, 0).rotateZ(0.12), MAT.beam), part(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 6).rotateZ(Math.PI / 2).translate(0, 1.0, 0), MAT.iron)],
    snaps: [[0, 0, 0]], solids: [] },
  { id: 'bed', name: 'Bed', cat: 'Furniture', icon: 'rested', mats: { wood: 8, leather: 2 }, hp: 200, bed: true, equip: true, desc: 'Sleep the night away under a roof, wake rested, and come back here when you fall.',
    parts: () => [part(box(1.1, 0.3, 2.1, 0, 0.25, 0), MAT.plank), part(box(1.15, 0.6, 0.12, 0, 0.4, -1.05), MAT.beam), part(box(1, 0.14, 1.9, 0, 0.46, 0.04), MAT.cloth), part(box(1.02, 0.08, 1.2, 0, 0.55, 0.38), MAT.fur), part(box(0.6, 0.12, 0.3, 0, 0.58, -0.75), MAT.cloth)],
    snaps: [[0, 0, 0]], solids: [[0, 0.3, 0, 1.1, 0.6, 2.1]] },
  { id: 'chest', name: 'Chest', cat: 'Furniture', icon: 'chest', mats: { wood: 10, rope: 1 }, hp: 200, chest: [5, 2], equip: true, desc: 'Keeps 10 piles of things safe.',
    parts: () => [part(box(1, 0.5, 0.6, 0, 0.25, 0), MAT.plank), part(new THREE.CylinderGeometry(0.3, 0.3, 1, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2).scale(1, 0.6, 1).translate(0, 0.5, 0), MAT.plank),
      part(box(1.02, 0.06, 0.62, 0, 0.5, 0), MAT.iron), part(box(0.12, 0.14, 0.04, 0, 0.42, 0.31), MAT.iron)],
    snaps: [[0, 0, 0]], solids: [[0, 0.35, 0, 1, 0.7, 0.6]] },
  { id: 'torchStand', name: 'Standing Torch', cat: 'Furniture', icon: 'torch', mats: { wood: 2, resin: 1 }, hp: 80, torch: true, equip: true, desc: 'Light that lasts while it has resin.',
    parts: () => [part(box(0.1, 1.5, 0.1, 0, 0.75, 0), MAT.beam), part(new THREE.CylinderGeometry(0.1, 0.06, 0.2, 7).translate(0, 1.55, 0), MAT.iron)],
    snaps: [[0, 0, 0]], solids: [[0, 0.7, 0, 0.2, 1.4, 0.2]] },
];
function stairs(rise, run) {
  const n = Math.round(rise / 0.25), P = [part(box(0.12, 0.3, Math.hypot(run, rise) + 0.2, -0.95, 0, 0).translate(0, 0, -Math.hypot(run, rise) / 2).rotateX(Math.atan2(rise, run)), MAT.beam),
    part(box(0.12, 0.3, Math.hypot(run, rise) + 0.2, 0.95, 0, 0).translate(0, 0, -Math.hypot(run, rise) / 2).rotateX(Math.atan2(rise, run)), MAT.beam)];
  for (let i = 0; i < n; i++) P.push(part(box(1.8, 0.08, run / n + 0.06, 0, (i + 1) * (rise / n) - 0.04, -(i + 0.5) * (run / n)), MAT.plank));
  return P;
}
// Trim (every part after the main panel) is grown by a couple of millimetres, a different amount per part, so that no two
// parts of a piece ever share a face exactly: where they did (a wall's posts and top beam on its planks, a floor's edge
// beams) the two surfaces flickered against each other
function grow({ geo, mat }, k) {
  const d = 0.0015 * k; geo.computeBoundingBox(); const b = geo.boundingBox, c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  const f = (n) => (n > 1e-4 ? (n + 2 * d) / n : 1);
  return { geo: geo.translate(-c.x, -c.y, -c.z).scale(f(s.x), f(s.y), f(s.z)).translate(c.x, c.y, c.z), mat };
}
for (const p of PIECES) { p.meshes = null; p.build = () => (p.meshes ||= merge(p.parts().map((q, k) => (k && !p.door ? grow(q, k) : q)))); }
export const PIECE = Object.fromEntries(PIECES.map((p) => [p.id, p]));
