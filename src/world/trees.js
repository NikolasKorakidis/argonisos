// Trees, rocks and bushes: every species is built procedurally once (a gnarled trunk that forks into limbs, leaf clusters
// of textured cards, root flares) or loaded from the imported tree pack, in a full-detail and a far version. Placement
// and streaming live in vegetation.js; this module only makes the geometry and the wind-swayed materials.
import * as THREE from 'three';
import QTREES from '../../models/qtrees.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
let seed = 1337;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const rr = (a, b) => a + rand() * (b - a);
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(hash(xi, zi), hash(xi + 1, zi), u), lerp(hash(xi, zi + 1), hash(xi + 1, zi + 1), u), v);
}
function fbm(x, z) { let a = 0.5, f = 1, s = 0; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); f *= 2; a *= 0.5; } return s; }
const flatMats = {};
const flat = (c) => flatMats[c] || (flatMats[c] = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9 }));
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; if (parent) parent.add(m); return m; }

const windUniformEarly = { value: 0 };
// --- Props: every tree/rock species is one merged geometry, drawn with InstancedMesh per 100 m chunk
// (frustum culling per chunk keeps thousands of trees cheap). Trees sway in the wind in the vertex shader.
const trunkMat = flat(0x7a4f2c), birchMat = flat(0xe9e2d2), rockMat = flat(0x9b958c);
// Leaf-cluster texture (drawn once): ~30 pointed leaves with midribs on transparent background, near-neutral so species tint it
const leafTex = (() => {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  for (let i = 0; i < 34; i++) {
    const a = rand() * 6.28, d = Math.sqrt(rand()) * N * 0.36, x = N / 2 + Math.cos(a) * d, y = N / 2 + Math.sin(a) * d, L = rr(34, 56), W = L * rr(0.34, 0.45), rot = a + rr(-0.6, 0.6);
    const v = Math.floor(rr(185, 255)); g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = `rgb(${v * 0.92},${v},${v * 0.82})`; g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, -W, L / 2, 0); g.quadraticCurveTo(0, W, -L / 2, 0); g.fill();
    g.strokeStyle = `rgba(40,50,20,0.35)`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
})();
const _sv1 = new THREE.Vector3(), _sv2 = new THREE.Vector3(), _sv3 = new THREE.Vector3(), _sv4 = new THREE.Vector3(), _sv5 = new THREE.Vector3();
let CARD_PARTS = [];   // collected while building a tree's high-detail version
function leafCards(centre, rx, ry, n, color, size0 = 1.5, size1 = 2.2, nc = centre) {
  if (PROP_LO) return;
  for (let i = 0; i < n; i++) {
    const u = rand() * 6.28, v = Math.acos(rr(-0.55, 1)), sh = rr(0.72, 1.08);
    const p = new THREE.Vector3(Math.sin(v) * Math.cos(u) * rx * sh, Math.cos(v) * ry * sh, Math.sin(v) * Math.sin(u) * rx * sh).add(centre);
    const size = rr(size0, size1), g = new THREE.PlaneGeometry(size, size);
    g.rotateZ(rand() * 6.28); g.rotateX(rr(-1.2, 1.2)); g.rotateY(rand() * 6.28); g.translate(p.x, p.y, p.z);
    const nrm = p.clone().sub(nc); nrm.y = nrm.y / ry * rx + 0.35; nrm.normalize();   // soft, rounded crown lighting
    const na = g.attributes.normal; for (let k = 0; k < na.count; k++) na.setXYZ(k, nrm.x, nrm.y, nrm.z);
    CARD_PARTS.push([g, new THREE.Color(color).offsetHSL(rr(-0.02, 0.02), rr(-0.05, 0.05), rr(-0.06, 0.06)).getHex()]);
  }
}
function mergeCards(parts) {
  const pos = [], nor = [], col = [], uv = [];
  for (const [g0, c] of parts) { const g = g0.index ? g0.toNonIndexed() : g0, a = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv, cl = new THREE.Color(c);
    for (let i = 0; i < a.count; i++) { pos.push(a.getX(i), a.getY(i), a.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(t.getX(i), t.getY(i)); const j = 0.72 + (n.getY(i) * 0.5 + 0.5) * 0.5; col.push(cl.r * j, cl.g * j, cl.b * j); } }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeBoundingSphere(); return g;
}
function mergeGeometries(geos) {      // concatenate geometries (non-indexed) sharing the first one's attributes
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g)), out = new THREE.BufferGeometry();
  for (const name of Object.keys(list[0].attributes)) {
    const size = list[0].attributes[name].itemSize, arr = new Float32Array(list.reduce((n, g) => n + g.attributes[name].count * size, 0)); let o = 0;
    for (const g of list) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere(); return out;
}
function mergeParts(parts) {            // parts: [geometry(already placed), hexColour]; keeps each part's normals
  const pos = [], nor = [], col = [];
  for (const [g0, c] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0; if (!g.attributes.normal) g.computeVertexNormals();
    const cl = new THREE.Color(c).offsetHSL(rr(-0.008, 0.008), rr(-0.02, 0.02), rr(-0.012, 0.012)), a = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < a.count; i++) {
      pos.push(a.getX(i), a.getY(i), a.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i));
      const j = 0.74 + (n.getY(i) * 0.5 + 0.5) * 0.4;           // darker underside, sun-kissed tops (cheap fake AO)
      col.push(cl.r * j, cl.g * j, cl.b * j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeBoundingSphere(); return g;
}
// Fluffy canopy blob: normals point away from the canopy centre so the whole crown shades as one soft volume
let PROP_LO = false;   // true while building the far-distance LOD
function blob(r, x, y, z, centre, stretchY = 1, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, PROP_LO ? 0 : detail); g.translate(x, y, z);
  const a = g.attributes.position, v = new THREE.Vector3(), n = new Float32Array(a.count * 3);
  for (let k = 0; k < a.count; k++) {
    v.fromBufferAttribute(a, k); v.x += (hash(v.x * 9, v.z * 9) - 0.5) * r * 0.25; v.y += (hash(v.y * 9, v.x * 5) - 0.5) * r * 0.2;
    a.setXYZ(k, v.x, v.y, v.z); v.sub(centre); v.y /= stretchY; v.normalize(); n.set([v.x, v.y, v.z], k * 3);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); return g;
}
function limb(r0, r1, len, x, y, z, rx, rz, seg = 6) {   // tapered trunk / branch segment
  const g = new THREE.CylinderGeometry(r1, r0, len, PROP_LO ? Math.min(seg, 4) : seg, PROP_LO ? 1 : 2); g.translate(0, len / 2, 0);
  g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); return g;
}
// Branching tree generator: a gnarled trunk that forks into limbs and twigs (tapered segments with knots), and every
// twig ends in a leaf cluster (a dark core blob + leaf cards), so the foliage actually grows out of the branches.
const UPV = new THREE.Vector3(0, 1, 0);
function segGeo(a, b, r0, r1, sides) {
  const d = b.clone().sub(a), L = d.length(), g = new THREE.CylinderGeometry(r1, r0, L, sides, 1, true); g.translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UPV, d.normalize())); g.translate(a.x, a.y, a.z); return g;
}
// Root flare: the trunk widens at its foot and buttress roots arch out from it and dive into the soil
// (they start on the trunk, bend over and end below ground, so nothing sits on top of the grass like a starfish)
function addRoots(P, R, n, bark) {
  if (!PROP_LO) P.push([new THREE.CylinderGeometry(R * 0.98, R * 1.38, 0.9, 12, 1, true).translate(0, 0.1, 0), bark]);
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + rr(-0.25, 0.25), a2 = a + rr(-0.25, 0.25), sp = rr(0.85, 1.2);
    const p0 = new THREE.Vector3(Math.cos(a) * R * 0.6, R * rr(0.55, 0.8), Math.sin(a) * R * 0.6);
    const p1 = new THREE.Vector3(Math.cos(a) * R * 1.3 * sp, R * 0.16, Math.sin(a) * R * 1.3 * sp);
    const p2 = new THREE.Vector3(Math.cos(a2) * R * 2.2 * sp, -0.5, Math.sin(a2) * R * 2.2 * sp);
    P.push([segGeo(p0, p1, R * 0.4, R * 0.27, PROP_LO ? 4 : 6), bark], [segGeo(p1, p2, R * 0.27, R * 0.06, PROP_LO ? 4 : 5), bark]);
    if (!PROP_LO) P.push([new THREE.IcosahedronGeometry(R * 0.28, 0).translate(p1.x, p1.y, p1.z), bark]);
  }
}
function growTree(P, o) {
  const tips = [], bark = o.bark, sidesOf = (r) => (PROP_LO ? 4 : r > 0.25 ? 8 : r > 0.1 ? 6 : 4);
  const grow = (a, dir, len, r0, depth) => {
    const n = PROP_LO ? 2 : (depth === o.depth ? o.trunkSteps : 3); let p = a.clone(), d = dir.clone(), r = r0; const rEnd = r0 * o.taper;
    for (let i = 0; i < n; i++) {
      d.x += rr(-o.gnarl, o.gnarl); d.z += rr(-o.gnarl, o.gnarl); d.y += o.rise; d.normalize();
      const q = p.clone().addScaledVector(d, len / n), r2 = lerp(r0, rEnd, (i + 1) / n);
      if (!PROP_LO || depth >= o.depth - 1) P.push([segGeo(p, q, r, r2, sidesOf(r)), bark]);   // far LOD: trunk + main limbs only
      if (!PROP_LO && r2 > 0.16) P.push([new THREE.IcosahedronGeometry(r2 * (o.knot || 1.08), 0).translate(q.x, q.y, q.z), bark]);   // joint knot hides the seams
      p = q; r = r2;
    }
    if (depth <= 0) { tips.push({ p, d }); return; }
    const k = o.kids(depth);
    for (let j = 0; j < k; j++) {
      const az = (j / k) * Math.PI * 2 + rr(-0.5, 0.5), tilt = o.spread(depth) * rr(0.8, 1.2);
      const side = new THREE.Vector3(Math.cos(az), 0, Math.sin(az)), cd = d.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(side, Math.sin(tilt)).normalize();
      grow(p, cd, len * o.lenF * rr(0.8, 1.15), Math.max(0.03, r * o.rF), depth - 1);
    }
    if (o.midKids && depth >= 1) { const mp = a.clone().lerp(p, rr(0.45, 0.7)), az = rand() * 6.28;   // a side limb from mid-branch
      grow(mp, new THREE.Vector3(Math.cos(az), 0.6, Math.sin(az)).normalize(), len * o.lenF * 0.8, Math.max(0.03, r0 * o.rF * 0.8), depth - 1); }
  };
  const ln = o.lean || 0, la = rand() * 6.28;
  grow(o.start ? o.start.clone() : new THREE.Vector3(0, -0.25, 0), o.dir ? o.dir.clone().normalize() : new THREE.Vector3(Math.cos(la) * ln + rr(-0.08, 0.08), 1, Math.sin(la) * ln + rr(-0.08, 0.08)).normalize(), o.trunkH, o.trunkR, o.depth);
  if (o.roots) addRoots(P, o.trunkR, o.roots, bark);
  // foliage at every tip, normals from the whole crown so it shades as one soft mass
  const cc = new THREE.Vector3(); tips.forEach((t) => cc.add(t.p)); cc.multiplyScalar(1 / Math.max(1, tips.length)); cc.y -= o.clusterR * 0.6;
  if (o.noLeaf) return tips;
  for (let ti = 0; ti < tips.length; ti++) {
    const t = tips[ti]; if (PROP_LO && ti % 3) continue;           // far LOD: one fat blob stands in for three clusters
    const c = t.p.clone().addScaledVector(t.d, o.clusterR * 0.35);
    const core = new THREE.Color(o.leaf).multiplyScalar(PROP_LO ? 0.72 : 0.58).getHex();   // far: the blended tone of core + cards, so the hand-over doesn't flash
    P.push([blob(o.clusterR * (PROP_LO ? 1.7 : o.core || 0.62), c.x, c.y, c.z, cc, 1, 0), core]);
    if (!PROP_LO && o.extraBlob) P.push([blob(o.clusterR * 0.45, c.x + rr(-0.5, 0.5), c.y + o.clusterR * 0.4, c.z + rr(-0.5, 0.5), cc, 1), core]);
    leafCards(c, o.clusterR, o.clusterR * o.flat, o.cards, o.leaf, o.card0, o.card1, cc);
  }
  return tips;
}
const TREE_BUILDERS = {
  oak(v) {
    // three personalities: a broad old spreader, a tall upright one, and a wind-bent twisted one
    const P = [], leaf = [0x4f7f2e, 0x5d8a34, 0x46752b][v % 3];
    const T = [
      { trunkH: rr(2.6, 3.1), trunkR: rr(0.6, 0.72), gnarl: 0.22, rise: 0.02, lean: 0.05, spread: (d) => (d === 2 ? 1.1 : 0.7), kids: (d) => (d === 2 ? 4 : 2), lenF: 0.8, clusterR: 1.6 },
      { trunkH: rr(4, 4.8), trunkR: rr(0.45, 0.55), gnarl: 0.12, rise: 0.3, lean: 0.02, spread: (d) => (d === 2 ? 0.6 : 0.55), kids: (d) => (d === 2 ? 3 : 2), lenF: 0.62, clusterR: 1.35 },
      { trunkH: rr(3, 3.6), trunkR: rr(0.5, 0.6), gnarl: 0.38, rise: 0.06, lean: 0.35, spread: (d) => (d === 2 ? 0.95 : 0.7), kids: (d) => (d === 2 ? 3 : 2), lenF: 0.75, clusterR: 1.45 },
    ][v % 3];
    growTree(P, { bark: 0x6b4a30, leaf, trunkSteps: 4, depth: 2, taper: 0.6, roots: 5, knot: 1.15, rF: 0.62, midKids: true, flat: 0.75, cards: 12, card0: 1.25, card1: 1.85, ...T });
    return P;
  },
  autumn(v) {
    const col = [0xd07a2a, 0xe0a030, 0xc4532a][v % 3], start = CARD_PARTS.length;
    const P = TREE_BUILDERS.oak(v).map(([g, c]) => [g, c === 0x6b4a30 || c === 0x5d4029 ? c : new THREE.Color(col).multiplyScalar(PROP_LO ? 1 : 0.75).getHex()]);
    for (let i = start; i < CARD_PARTS.length; i++) CARD_PARTS[i][1] = new THREE.Color(col).offsetHSL(rr(-0.03, 0.03), 0, rr(-0.06, 0.06)).getHex();
    return P;
  },
  pine(v) {
    // Mediterranean stone pine: a tall, gently curving bare trunk and a flat umbrella crown. v2 is a mountain fir.
    if (v % 3 === 2) return TREE_BUILDERS.fir(v);
    const P = [], leaf = [0x2f5a34, 0x365f38][v % 2];
    growTree(P, { bark: 0x7a5236, leaf, trunkH: rr(6.5, 8), trunkR: rr(0.34, 0.42), trunkSteps: 5, depth: 2, taper: 0.55, gnarl: 0.14, rise: 0.12, lean: 0.18, roots: 3,
      kids: (d) => (d === 2 ? 4 : 2), spread: (d) => (d === 2 ? 1.25 : 0.9), lenF: 0.48, rF: 0.55, clusterR: 1.9, flat: 0.34, cards: 14, card0: 1.2, card1: 1.9 });
    return P;
  },
  fir(v) {
    const P = [], H = rr(7, 9.5);
    P.push([limb(0.42, 0.18, H, 0, -0.2, 0, 0, 0, 7), 0x5e3f28]);
    const tiers = 6 + (v % 2);
    for (let i = 0; i < tiers; i++) {
      const r = lerp(2.6, 0.7, i / tiers) * rr(0.9, 1.1), g = new THREE.ConeGeometry(r, 2.3, 9, 1, true);
      const a = g.attributes.position; for (let k = 0; k < a.count; k++) if (a.getY(k) < 0) a.setY(k, a.getY(k) - 0.35 - hash(a.getX(k) * 7, a.getZ(k) * 7) * 0.35); // droopy tips
      g.computeVertexNormals(); g.translate(0, 2.4 + i * (H - 2.6) / tiers, 0);
      P.push([g, i % 2 ? 0x2d5a3a : 0x274f34]);
      if (!PROP_LO) {                                   // needle fringe: drooping cards around each tier's rim
        const ty = 2.4 + i * (H - 2.6) / tiers - 0.9;
        for (let k = 0; k < 12; k++) { const a = k / 12 * 6.28 + rr(-0.2, 0.2), sz = r * rr(0.7, 1);
          const cg = new THREE.PlaneGeometry(sz, sz * 0.8); cg.rotateX(-0.9); cg.translate(0, 0, r * 0.62); cg.rotateY(a); cg.translate(0, ty, 0);
          const na = cg.attributes.normal, nx = Math.sin(a) * 0.6, nz = Math.cos(a) * 0.6; for (let q = 0; q < na.count; q++) na.setXYZ(q, nx, 0.8, nz);
          CARD_PARTS.push([cg, new THREE.Color(0x2f5e3a).offsetHSL(rr(-0.02, 0.02), 0, rr(-0.05, 0.05)).getHex()]); }
      }
    }
    return P;
  },
  birch(v) {
    const P = [], leaf = [0x9fb23e, 0xb7bf45, 0x86a83a][v % 3];
    growTree(P, { bark: 0xe9e4d8, leaf, trunkH: rr(4.6, 5.8), trunkR: 0.24, trunkSteps: 4, depth: 2, taper: 0.55, gnarl: [0.05, 0.14, 0.09][v % 3], rise: 0.35, roots: 0, lean: [0.02, 0.22, 0.1][v % 3],
      kids: (d) => (d === 2 ? 3 : 2), spread: (d) => (d === 2 ? 0.55 : 0.5), lenF: 0.5, rF: 0.55, clusterR: 0.95, flat: 1.2, cards: 9, card0: 0.9, card1: 1.4 });
    if (!PROP_LO) for (let i = 0; i < 6; i++) { const y = rr(0.4, 3.6), r = lerp(0.24, 0.16, y / 5) + 0.012; P.push([limb(r, r, rr(0.04, 0.08), 0, y, 0, 0, 0, 8), 0x55504a]); }   // bark marks
    return P;
  },
  // ---- Native trees of Greece ----
  aleppo(v) {
    // Aleppo pine (Pinus halepensis): the pine of the Greek coast. A crooked, leaning trunk with reddish-grey bark,
    // an open, uneven crown of light grey-green tufts you can see the sky through.
    const P = [], leaf = [0x6f8f4a, 0x7a9650, 0x67884a][v % 3];
    growTree(P, { bark: 0x7a6656, leaf, trunkH: rr(4.6, 6), trunkR: rr(0.3, 0.38), trunkSteps: 5, depth: 2, taper: 0.55, gnarl: 0.3, rise: 0.05, lean: [0.35, 0.2, 0.45][v % 3], roots: 3,
      kids: (d) => (d === 2 ? 3 : 2), spread: (d) => (d === 2 ? 1.05 : 0.8), lenF: 0.6, rF: 0.55, midKids: true, clusterR: 1.25, flat: 0.45, cards: 10, card0: 1.1, card1: 1.7 });
    return P;
  },
  plane(v) {
    // Oriental plane (Platanus orientalis): the great shade tree of Greek springs and village squares. Massive pale
    // trunk, wide limbs and a huge domed crown of big bright leaves.
    const P = [], leaf = [0x5f9a3a, 0x6aa040, 0x568f36][v % 3];
    growTree(P, { bark: 0x9c9682, leaf, trunkH: rr(3.6, 4.4), trunkR: rr(0.7, 0.85), trunkSteps: 4, depth: 3, taper: 0.62, gnarl: 0.14, rise: 0.12, lean: 0.06, roots: 6, knot: 1.12,
      kids: (d) => (d === 3 ? 3 : 2), spread: (d) => (d === 3 ? 0.85 : 0.7), lenF: 0.72, rF: 0.62, clusterR: 1.65, flat: 0.75, cards: 12, card0: 1.5, card1: 2.3 });
    return P;
  },
  holm(v) {
    // Holm / kermes oak (Quercus ilex): evergreen, dense, almost black-green rounded crowns on a short dark trunk.
    const P = [], leaf = [0x3f5a2e, 0x46623a, 0x3a5430][v % 3];
    growTree(P, { bark: 0x4a3e32, leaf, trunkH: rr(2.4, 3.2), trunkR: rr(0.42, 0.52), trunkSteps: 3, depth: 2, taper: 0.6, gnarl: 0.2, rise: 0.08, lean: 0.08, roots: 5,
      kids: (d) => (d === 2 ? 4 : 3), spread: (d) => (d === 2 ? 0.8 : 0.65), lenF: 0.65, rF: 0.6, clusterR: 1.45, flat: 0.85, cards: 13, card0: 1.0, card1: 1.5, core: 0.72 });
    return P;
  },
  carob(v) {
    // Carob (Ceratonia siliqua): a broad, low dome of glossy dark leaves on a thick, gnarled trunk; pods hang below.
    const P = [], leaf = [0x3e6a2c, 0x467232, 0x3a6228][v % 3];
    const tips = growTree(P, { bark: 0x6a5a4a, leaf, trunkH: rr(1.8, 2.3), trunkR: rr(0.5, 0.6), trunkSteps: 3, depth: 2, taper: 0.6, gnarl: 0.35, rise: 0.02, lean: 0.12, roots: 5, knot: 1.2,
      kids: (d) => (d === 2 ? 4 : 2), spread: (d) => (d === 2 ? 1.15 : 0.8), lenF: 0.75, rF: 0.6, clusterR: 1.4, flat: 0.6, cards: 12, card0: 1.1, card1: 1.6, core: 0.55 });
    if (!PROP_LO) tips.forEach((t, i) => { if (i % 2) return; for (let k = 0; k < 3; k++) P.push([new THREE.CylinderGeometry(0.03, 0.02, 0.45, 4).translate(t.p.x + rr(-0.6, 0.6), t.p.y - 0.9, t.p.z + rr(-0.6, 0.6)), 0x4a2e1a]); });
    return P;
  },
  arbutus(v) {
    // Strawberry tree (Arbutus): several smooth stems with red-orange peeling bark, glossy dark leaves and red berries.
    const P = [], leaf = [0x47703a, 0x4f7a40, 0x426a36][v % 3];
    for (let s2 = 0; s2 < 2 + (v % 2); s2++) {
      const sub = [], cs = CARD_PARTS.length, a = s2 * 2.4 + v;
      const tips = growTree(sub, { bark: 0x8e5038, leaf, trunkH: rr(2.2, 3), trunkR: 0.17, trunkSteps: 3, depth: 2, taper: 0.6, gnarl: 0.22, rise: 0.15, roots: 0,
        dir: new THREE.Vector3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35), start: new THREE.Vector3(Math.cos(a) * 0.15, -0.2, Math.sin(a) * 0.15),
        kids: (d) => 2, spread: (d) => 0.7, lenF: 0.6, rF: 0.6, clusterR: 0.95, flat: 0.8, cards: 9, card0: 0.8, card1: 1.2, core: 0.6 });
      P.push(...sub);
      if (!PROP_LO) tips.forEach((t) => { for (let k = 0; k < 4; k++) P.push([new THREE.IcosahedronGeometry(0.07, 0).translate(t.p.x + rr(-0.7, 0.7), t.p.y + rr(-0.5, 0.2), t.p.z + rr(-0.7, 0.7)), k % 2 ? 0xd2401e : 0xe8902a]); });
    }
    return P;
  },
  fig(v) {
    // Fig (Ficus carica): smooth grey limbs branching low from the ground, sparse crown of very large leaves.
    const P = [], leaf = [0x7aa848, 0x82b04c, 0x709e42][v % 3];
    for (let s2 = 0; s2 < 3; s2++) {
      const a = s2 * 2.1 + v * 0.7;
      growTree(P, { bark: 0x9a958a, leaf, trunkH: rr(1.4, 2), trunkR: 0.2, trunkSteps: 3, depth: 2, taper: 0.6, gnarl: 0.25, rise: 0.05, roots: 0,
        dir: new THREE.Vector3(Math.cos(a) * 0.8, 1, Math.sin(a) * 0.8), start: new THREE.Vector3(0, -0.2, 0),
        kids: (d) => 2, spread: (d) => 0.8, lenF: 0.65, rF: 0.6, clusterR: 1.05, flat: 0.7, cards: 7, card0: 1.6, card1: 2.4, core: 0.45 });
    }
    return P;
  },
  cypress(v) {
    const P = [[limb(0.3, 0.14, 6.5, 0, -0.2, 0, rr(-0.04, 0.04), rr(-0.04, 0.04), 6), 0x5e3f28]], c = new THREE.Vector3(0, 4.5, 0), col = [0x345c2c, 0x3d6630, 0x2e5528][v % 3];
    const H = [7.5, 9, 6.5][v % 3], tw = rr(-0.6, 0.6);
    for (let i = 0; i < 11; i++) { const y = 1.4 + i * (H - 1.4) / 11, w = Math.sin(Math.PI * Math.pow((i + 0.5) / 11, 0.8)) * 1.05 + 0.2, a = i * tw;
      P.push([blob(w * 0.8, Math.cos(a) * 0.15, y, Math.sin(a) * 0.15, c, 3, 0), new THREE.Color(col).multiplyScalar(PROP_LO ? 1 : 0.7).getHex()]);
      leafCards(new THREE.Vector3(Math.cos(a) * 0.15, y, Math.sin(a) * 0.15), w, 0.55, 7, col, 0.7, 1.1, c.clone().setY(y)); }
    return P;
  },
  olive(v) {
    // Olive: a short, twisted, often split trunk, wide low limbs, many silvery-green clusters of small leaves
    const P = [], leaf = [0x95a67a, 0x879b6c, 0xa2b086][v % 3];
    for (let s2 = 0; s2 < (v % 2 ? 2 : 1); s2++) {                                                      // some olives split into two trunks
      const sub = [], cs = CARD_PARTS.length; growTree(sub, { bark: 0x6e6252, leaf, trunkH: rr(1.6, 2.2), trunkR: rr(0.34, 0.44) * (v % 2 ? 0.8 : 1), trunkSteps: 4, depth: 3, taper: 0.6, gnarl: 0.42, rise: 0.02, roots: 4, knot: 1.25,
        kids: (d) => (d === 3 ? (v % 2 ? 2 : 3) : 2), spread: (d) => (d === 3 ? 1.0 : d === 2 ? 0.75 : 0.55), lenF: 0.78, rF: 0.62,
        clusterR: 1.15, flat: 0.6, cards: 14, card0: 0.85, card1: 1.3, core: 0.42 });
      const off = v % 2 ? (s2 ? 0.35 : -0.35) : 0, tl = v % 2 ? (s2 ? 0.25 : -0.25) : 0;
      for (const [g] of sub) { g.rotateZ(tl); g.translate(off, 0, 0); }
      for (let q = cs; q < CARD_PARTS.length; q++) { CARD_PARTS[q][0].rotateZ(tl); CARD_PARTS[q][0].translate(off, 0, 0); }
      P.push(...sub);
    }
    return P;
  },
  dead(v) {
    const P = [];
    growTree(P, { bark: 0x4a4136, leaf: 0, trunkH: rr(3.4, 4.6), trunkR: rr(0.34, 0.42), trunkSteps: 4, depth: 2, taper: 0.4, gnarl: 0.45, rise: 0.08, lean: 0.25, roots: 4, knot: 1.2,
      kids: (d) => (d === 2 ? 3 : 2), spread: (d) => 0.9, lenF: 0.7, rF: 0.55, noLeaf: true, clusterR: 1 });
    if (v % 2) for (let i = 0; i < 5; i++) P.push([limb(0.04, 0.02, rr(0.8, 1.6), rr(-1.2, 1.2), rr(2.2, 3.6), rr(-1.2, 1.2), Math.PI, 0, 3), 0x6a7a40]);   // hanging moss
    return P;
  },
  rock(v) {
    const g = new THREE.IcosahedronGeometry(1, PROP_LO ? 1 : 2), a = g.attributes.position, vv = new THREE.Vector3();
    for (let k = 0; k < a.count; k++) { vv.fromBufferAttribute(a, k);
      let f = 0.72 + fbm(vv.x * 1.8 + v * 3, vv.z * 1.8 + vv.y) * 0.5 + (fbm(vv.x * 6 + v, vv.y * 6) - 0.5) * 0.12;   // big shape + chips
      let y = vv.y * f * 0.72; y = Math.round(y * 4.5) / 4.5 * 0.55 + y * 0.45;                                        // stepped strata ledges
      a.setXYZ(k, vv.x * f * 1.3, Math.max(y, -0.3), vv.z * f); }
    const g2 = g.index ? g.toNonIndexed() : g; g2.computeVertexNormals();
    const rk = mergeParts([[g2, [0x8f887e, 0x857d72, 0x999184][v % 3]]]), col = rk.attributes.color, nn = rk.attributes.normal, pp = rk.attributes.position;
    for (let k = 0; k < col.count; k++) {
      const band = 0.9 + Math.sin(pp.getY(k) * 14 + v) * 0.06 + (hash(Math.floor(k / 3), v) - 0.5) * 0.1;          // strata + facet variation
      col.setXYZ(k, col.getX(k) * band, col.getY(k) * band, col.getZ(k) * band);
      const mo = clamp((nn.getY(k) - 0.6) * 4, 0, 1) * (pp.getY(k) > 0.05 ? 0.85 : 0) * (0.6 + hash(k, v) * 0.4);          // moss caps, blended in
      if (mo > 0) col.setXYZ(k, lerp(col.getX(k), 0.13, mo), lerp(col.getY(k), 0.2, mo), lerp(col.getZ(k), 0.07, mo));
    }
    return rk;
  },
};
// ---- Imported stylised trees (the uploaded pack): broadleaf 'qtree', 'qpine', and leafless 'qdead' (tree trunks, weathered).
// Packed as quantised binary (models/qtrees.js). Trunks get vertex colours sampled from the bark texture, so they share
// propMat with every other tree; leaf clusters keep their own alpha-cut textures.
const b64arr = (str, T) => { const u = Uint8Array.from(atob(str), (ch) => ch.charCodeAt(0)); return new T(u.buffer); };
function qGeo(g, tint) {
  const geo = new THREE.BufferGeometry(), p = b64arr(g.p, Int16Array), n = b64arr(g.nr, Int8Array), uv = b64arr(g.uv, Int16Array);
  geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(p, (v) => v / 1000), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(n, (v) => v / 127), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(Float32Array.from(uv, (v) => v / 4096), 2));
  if (g.c) { const c = b64arr(g.c, Uint8Array); geo.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(c, (v, i) => v / 255 * tint[i % 3]), 3)); }
  return geo;
}
function qLeafMat(file, tint) {
  const t = new THREE.TextureLoader().load(`models/${file}`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, color: tint, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });   // tinted down to the island palette
  m.onBeforeCompile = leafMat.onBeforeCompile; return m;
}
const Q_SRC = { qtree: 'qtree', qpine: 'qpine', qdead: 'qtree', qbirch: 'qbirch' };
const Q_TINT = { qbirch: [0.85, 0.83, 0.8], qtree: [0.72, 0.62, 0.52], qpine: [0.68, 0.58, 0.5], qdead: [0.62, 0.6, 0.57] };
let Q_LEAF_MATS = null;
function qBuild(species, v) {
  Q_LEAF_MATS ||= { qbirch: qLeafMat('q_birch_leaves.png', 0x9cb27a), qtree: qLeafMat('q_tree_leaves.png', 0x9ab884), qpine: qLeafMat('q_pine_leaves.png', 0x6f8f62) };
  const src = QTREES[Q_SRC[species]][v % QTREES[Q_SRC[species]].length];
  const geo = qGeo(src.bark, Q_TINT[species]);
  const cards = species !== 'qdead' && src.leaves ? qGeo(src.leaves) : null;
  return { geo, lo: geo, cards, cardMat: cards && Q_LEAF_MATS[species], leafFar: true };
}
const PROPS = {};  // key -> { geo, variants:[geo], chunks: Map }
const CHUNK = 100;
function propGeo(species, v) {
  const k = species + v;
  if (!PROPS[k] && Q_SRC[species]) { const q = qBuild(species, v); PROPS[k] = { species, v, ...q, items: [] }; }
  if (!PROPS[k]) {
    CARD_PARTS = [];
    const s0 = seed, r = TREE_BUILDERS[species](v), s1 = seed, cards = CARD_PARTS.length ? mergeCards(CARD_PARTS) : null; CARD_PARTS = [];
    seed = s0; PROP_LO = true; const lo = TREE_BUILDERS[species](v); PROP_LO = false; seed = s1;
    PROPS[k] = { species, geo: r.isBufferGeometry ? r : mergeParts(r), lo: lo.isBufferGeometry ? lo : mergeParts(lo), cards, items: [] };
  }
  return PROPS[k];
}
const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
propMat.onBeforeCompile = (sh) => {
  sh.uniforms.uWind = windUniformEarly;
  sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    vec4 ipp = instanceMatrix[3];
    float sway = max(position.y - 2.0, 0.0) * 0.018;
    transformed.x += sin(uWind * 1.1 + ipp.x * 0.13 + ipp.z * 0.07) * sway;
    transformed.z += cos(uWind * 0.9 + ipp.z * 0.11) * sway * 0.7;`);
};
const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
leafMat.onBeforeCompile = (sh) => {
  sh.uniforms.uWind = windUniformEarly;
  sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    vec4 ipp = instanceMatrix[3];
    float sway = max(position.y - 2.0, 0.0) * 0.02;
    transformed.x += sin(uWind * 1.1 + ipp.x * 0.13 + ipp.z * 0.07) * sway + sin(uWind * 4.0 + position.x * 3.0 + position.y) * 0.035;
    transformed.z += cos(uWind * 0.9 + ipp.z * 0.11) * sway * 0.7 + cos(uWind * 3.6 + position.z * 3.0) * 0.03;`);
};

const isLow = () => PROP_LO;
export { isLow, windUniformEarly as windUniform, propGeo, propMat, leafMat, mergeParts, mergeGeometries, TREE_BUILDERS, PROPS, rockMat, trunkMat, flat, mesh, rr, rand, hash, fbm };
