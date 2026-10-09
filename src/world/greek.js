// The finer half of the Greek kit, for dressing the sites: painted and dressed-stone materials (each texture with its own
// dice, so nothing else on the island changes), and props built from lathed and extruded shapes: amphorae and storage
// jars, bronze tripods, palmette acroteria and antefixes, a herm, a cart wheel, stacked firewood. Every helper pushes
// [geometry, material] onto a site's part list, in site-local coordinates, like the rest of the kit.
import * as THREE from 'three';

const dice = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; };
function tex(draw, w = 512, h = w, seed = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h, dice(seed));
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const meander = (g, x0, y, w, h, col) => {   // a running Greek key along a band
  g.strokeStyle = col; g.lineWidth = Math.max(2, h / 9); const u = h * 0.8;
  for (let x = x0; x < x0 + w; x += u * 1.25) { g.beginPath(); g.moveTo(x, y + h * 0.9); g.lineTo(x, y + h * 0.1); g.lineTo(x + u, y + h * 0.1); g.lineTo(x + u, y + h * 0.7); g.lineTo(x + u * 0.35, y + h * 0.7); g.lineTo(x + u * 0.35, y + h * 0.4); g.lineTo(x + u * 0.68, y + h * 0.4); g.stroke(); }
};

// dressed limestone: big squared blocks in warm creams, fine joints, weathered towards the foot
const ashlarTex = tex((g, n, _, r) => {
  g.fillStyle = '#9c8f76'; g.fillRect(0, 0, n, n); const rows = 4, h = n / rows;
  for (let row = 0; row < rows; row++) { let x = row % 2 ? -n * 0.18 : 0; while (x < n) { const w = n * (0.32 + r() * 0.22), v = 196 + r() * 26;
    const gr = g.createLinearGradient(0, row * h, 0, row * h + h); gr.addColorStop(0, `rgb(${v},${v - 10},${v - 30})`); gr.addColorStop(1, `rgb(${v - 14},${v - 24},${v - 44})`);
    g.fillStyle = gr; g.fillRect(x + 2, row * h + 2, w - 4, h - 4);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(90,75,55,${r() * 0.12})`; g.beginPath(); g.arc(x + r() * w, row * h + r() * h, 0.5 + r() * 3, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,248,230,.12)'; g.fillRect(x + 2, row * h + 2, w - 4, 3); x += w; } }
});
// whitewashed plaster over rubble: chalky white, mottled, cracked, stone showing through, damp rising from the foot
const whitewashTex = tex((g, n, _, r) => {
  g.fillStyle = '#dcd1b9'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 320; i++) { g.fillStyle = `rgba(${150 + r() * 50},${135 + r() * 45},${105 + r() * 40},${r() * 0.13})`; g.beginPath(); g.arc(r() * n, r() * n, 6 + r() * 40, 0, 7); g.fill(); }
  for (let i = 0; i < 6; i++) {   // where the plaster has flaked off: a dirty halo, and muted stones packed close inside it
    const x = r() * n, y = n * (0.15 + r() * 0.6), w = 50 + r() * 80, halo = g.createRadialGradient(x, y, 0, x, y, w * 0.75);
    halo.addColorStop(0, 'rgba(150,132,104,.45)'); halo.addColorStop(1, 'rgba(150,132,104,0)'); g.fillStyle = halo; g.fillRect(x - w, y - w, w * 2, w * 2);
    for (let k = 0; k < 26; k++) { const v = 150 + r() * 35, d = Math.sqrt(r()) * w * 0.45, q = r() * 6.28; g.fillStyle = `rgba(${v},${v - 10},${v - 26},.75)`; g.beginPath(); g.ellipse(x + Math.cos(q) * d, y + Math.sin(q) * d * 0.6, 5 + r() * 8, 3 + r() * 5, r() * 3, 0, 7); g.fill(); }
  }
  g.strokeStyle = 'rgba(90,80,65,.35)'; g.lineWidth = 1.2; for (let i = 0; i < 12; i++) { let x = r() * n, y = r() * n; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += r() * 30; g.lineTo(x, y); } g.stroke(); }
  const damp = g.createLinearGradient(0, n, 0, n * 0.7); damp.addColorStop(0, 'rgba(110,92,60,.55)'); damp.addColorStop(1, 'rgba(110,92,60,0)'); g.fillStyle = damp; g.fillRect(0, n * 0.7, n, n * 0.3);
}, 512, 512, 7);
// a painted cella wall: Pompeian red dado, a cream field in panels, a meander band under the ceiling
const paintTex = tex((g, w, h, r) => {
  g.fillStyle = '#e4d3ad'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(150,110,60,${r() * 0.05})`; g.beginPath(); g.arc(r() * w, r() * h, 4 + r() * 30, 0, 7); g.fill(); }
  g.fillStyle = '#8e2a1a'; g.fillRect(0, h * 0.68, w, h * 0.32); g.fillStyle = '#1e1410'; g.fillRect(0, h * 0.66, w, h * 0.02);
  g.strokeStyle = 'rgba(120,40,24,.55)'; g.lineWidth = 4; g.strokeRect(w * 0.08, h * 0.2, w * 0.84, h * 0.4);
  g.fillStyle = '#e8d8b4'; g.fillRect(0, 0, w, h * 0.12); meander(g, 0, h * 0.015, w, h * 0.09, '#8e2a1a'); g.fillStyle = '#2b3f63'; g.fillRect(0, h * 0.12, w, h * 0.025);
}, 512, 512, 3);
// polished floor: two marbles in a chequer, veined
const floorTex = tex((g, n, _, r) => {
  const k = n / 4;
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const light = (i + j) % 2 === 0, v = light ? 214 + r() * 10 : 150 + r() * 12; g.fillStyle = light ? `rgb(${v},${v - 6},${v - 16})` : `rgb(${v},${v - 30},${v - 44})`; g.fillRect(i * k, j * k, k, k);
    g.strokeStyle = light ? 'rgba(140,120,100,.25)' : 'rgba(70,40,30,.3)'; g.lineWidth = 1; for (let v2 = 0; v2 < 3; v2++) { g.beginPath(); let x = i * k + r() * k, y = j * k; g.moveTo(x, y); while (y < (j + 1) * k) { x += (r() - 0.5) * 14; y += 10; g.lineTo(x, y); } g.stroke(); } }
  g.strokeStyle = 'rgba(60,45,30,.35)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * k, 0); g.lineTo(i * k, n); g.moveTo(0, i * k); g.lineTo(n, i * k); g.stroke(); }
}, 512, 512, 5);
// a coffered ceiling: deep blue coffers with gold stars between red and cream ribs
const cofferTex = tex((g, n) => {
  g.fillStyle = '#d9c9a4'; g.fillRect(0, 0, n, n); const k = n / 2;
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const x = i * k, y = j * k; g.fillStyle = '#8e2a1a'; g.fillRect(x + k * 0.1, y + k * 0.1, k * 0.8, k * 0.8); g.fillStyle = '#1f3561'; g.fillRect(x + k * 0.16, y + k * 0.16, k * 0.68, k * 0.68);
    g.fillStyle = '#e2b54a'; g.save(); g.translate(x + k / 2, y + k / 2); for (let a = 0; a < 8; a++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(0, 0); g.lineTo(k * 0.04, k * 0.04); g.lineTo(0, k * 0.2); g.lineTo(-k * 0.04, k * 0.04); g.fill(); } g.restore(); }
}, 256, 256, 9);
// the pediment's deep blue field
const tympTex = tex((g, n, _, r) => { g.fillStyle = '#26406b'; g.fillRect(0, 0, n, n); for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(20,30,55,${r() * 0.2})`; g.beginPath(); g.arc(r() * n, r() * n, 3 + r() * 20, 0, 7); g.fill(); } }, 128, 128, 11);
// glazed black-figure pottery: terracotta with a black band and a meander
const potTex = tex((g, w, h) => { g.fillStyle = '#b8643a'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1410'; g.fillRect(0, h * 0.42, w, h * 0.22); meander(g, 0, h * 0.44, w, h * 0.16, '#b8643a'); g.fillRect(0, h * 0.78, w, h * 0.05); g.fillRect(0, 0, w, h * 0.08); }, 256, 128, 2);
// dark, mossy flagstones for the Chimera's court
const darkFlagTex = tex((g, n, _, r) => {
  g.fillStyle = '#23241e'; g.fillRect(0, 0, n, n); const rows = 4;
  for (let row = 0; row < rows; row++) { const h = n / rows; let x = -r() * 60; while (x < n) { const w = 80 + r() * 90, v = 70 + r() * 30; g.fillStyle = `rgb(${v},${v + 2},${v - 6})`; g.fillRect(x + 3, row * h + 3, w - 6, h - 6);
    if (r() < 0.55) { g.fillStyle = `rgba(70,96,46,${0.3 + r() * 0.3})`; g.beginPath(); g.arc(x + r() * w, row * h + r() * h, 8 + r() * 26, 0, 7); g.fill(); } x += w; } }
}, 512, 512, 13);

export const GMAT = {
  ashlar: new THREE.MeshStandardMaterial({ map: ashlarTex, roughness: 0.92, color: 0xcfc3aa }),
  whitewash: new THREE.MeshStandardMaterial({ map: whitewashTex, roughness: 0.97, color: 0xd9cfb9 }),
  // (indoors is always in shade, so the inside materials carry some of it themselves)
  paint: new THREE.MeshStandardMaterial({ map: paintTex, roughness: 0.9, color: 0xb8ad98 }),
  floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.5, envMapIntensity: 0.3, color: 0xbcb3a4 }),
  coffer: new THREE.MeshStandardMaterial({ map: cofferTex, roughness: 0.85, color: 0xa9a49a }),
  tymp: new THREE.MeshStandardMaterial({ map: tympTex, roughness: 0.9 }),
  pot: new THREE.MeshStandardMaterial({ map: potTex, roughness: 0.7 }),
  clay: new THREE.MeshStandardMaterial({ color: 0xa65a34, roughness: 0.9 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd2a03c, roughness: 0.32, metalness: 0.9 }),
  bronze: new THREE.MeshStandardMaterial({ color: 0x9a6b35, roughness: 0.4, metalness: 0.85 }),
  oldBronze: new THREE.MeshStandardMaterial({ color: 0x4f7a62, roughness: 0.6, metalness: 0.5 }),   // verdigris
  wood: new THREE.MeshStandardMaterial({ color: 0x5e4129, roughness: 0.9 }),
  oldWood: new THREE.MeshStandardMaterial({ color: 0x77695a, roughness: 0.95 }),
  wool: new THREE.MeshStandardMaterial({ color: 0x8e3324, roughness: 1 }),
  linen: new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 1, side: THREE.DoubleSide }),
  ash: new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 1 }),
  ember: new THREE.MeshStandardMaterial({ color: 0x1e120c, emissive: 0xc8400c, emissiveIntensity: 0.45, roughness: 1 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x4e6e2c, roughness: 0.85, flatShading: true }),
  ivy: new THREE.MeshStandardMaterial({ color: 0x2f4a24, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }),
  basalt: new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 0.55, metalness: 0.15, flatShading: true }),
  eye: new THREE.MeshStandardMaterial({ color: 0xff6a20, emissive: 0xff4a10, emissiveIntensity: 2.2 }),
  water: new THREE.MeshStandardMaterial({ color: 0x0c1012, roughness: 0.06, metalness: 0.2, envMapIntensity: 1.2 }),
  darkFlags: new THREE.MeshStandardMaterial({ map: darkFlagTex, roughness: 0.95 }),
  caveRock: new THREE.MeshStandardMaterial({ color: 0x4a433b, roughness: 0.95, flatShading: true, envMapIntensity: 0.3 }),
};

// ---- shapes
const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
// a transport amphora: pointed foot, swelling body, narrow neck and two handles
export function amphora(P, x, y, z, s = 1, tilt = 0, rot = 0, mat = GMAT.pot) {
  const g = lathe([[0, 0], [0.05, 0.02], [0.08, 0.12], [0.2, 0.32], [0.24, 0.5], [0.22, 0.66], [0.13, 0.78], [0.07, 0.84], [0.07, 1.02], [0.1, 1.05], [0.09, 1.08], [0, 1.08]]);
  const parts = [g]; for (const sx of [-1, 1]) parts.push(new THREE.TorusGeometry(0.1, 0.022, 5, 10, Math.PI).rotateZ(sx > 0 ? -Math.PI / 2 : Math.PI / 2).translate(sx * 0.09, 0.9, 0));
  for (const q of parts) P.push([q.scale(s, s, s).rotateZ(tilt).rotateY(rot).translate(x, y, z), mat]);
}
// a great storage jar (pithos), often half sunk in the ground
export function pithos(P, x, y, z, s = 1, mat = GMAT.clay) {
  P.push([lathe([[0, 0], [0.22, 0.02], [0.42, 0.3], [0.55, 0.7], [0.52, 1.05], [0.36, 1.32], [0.3, 1.38], [0.36, 1.42], [0.34, 1.48], [0.26, 1.46], [0.2, 1.3]]).scale(s, s, s).translate(x, y, z), mat]);
  for (let k = 0; k < 3; k++) P.push([new THREE.TorusGeometry(0.53 * s - k * 0.03 * s, 0.02 * s, 4, 20).rotateX(Math.PI / 2).translate(x, y + (0.62 + k * 0.18) * s, z), mat]);   // rope-pattern bands
}
// a bowl or a jug (small pottery for shelves and tables)
export const bowl = (P, x, y, z, s = 1, mat = GMAT.pot) => P.push([lathe([[0, 0], [0.08, 0], [0.16, 0.05], [0.2, 0.12], [0.19, 0.13], [0.15, 0.06], [0, 0.03]], 12).scale(s, s, s).translate(x, y, z), mat]);
export const jug = (P, x, y, z, s = 1, mat = GMAT.pot) => P.push([lathe([[0, 0], [0.07, 0], [0.11, 0.08], [0.12, 0.18], [0.07, 0.28], [0.05, 0.34], [0.07, 0.38], [0, 0.37]], 12).scale(s, s, s).translate(x, y, z), mat]);
// a bronze tripod with a cauldron (light a fire in it with the site's fire())
export function tripod(P, x, y, z, h = 1.3, mat = GMAT.bronze) {
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; P.push([new THREE.CylinderGeometry(0.035, 0.045, h * 1.04, 6).rotateZ(0.16).rotateY(-a).translate(x + Math.cos(a) * 0.22, y + h / 2, z + Math.sin(a) * 0.22), mat]);
    P.push([new THREE.TorusGeometry(0.1, 0.022, 5, 10).rotateY(-a + Math.PI / 2).translate(x + Math.cos(a) * 0.36, y + h + 0.2, z + Math.sin(a) * 0.36), mat]); }   // ring handles
  P.push([lathe([[0, 0], [0.18, 0.02], [0.34, 0.14], [0.38, 0.28], [0.36, 0.3], [0, 0.18]], 16).translate(x, y + h - 0.08, z), mat]);
  P.push([new THREE.TorusGeometry(0.3, 0.025, 5, 16).rotateX(Math.PI / 2).translate(x, y + h * 0.42, z), mat]);
}
// a palmette (acroterion or antefix): a fan of leaves on volutes, extruded thin
function palmetteGeo(size, depth = 0.08) {
  const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.bezierCurveTo(-0.55, 0.25, -0.2, 0.2, -0.2, 0.35);
  for (let k = 0; k <= 6; k++) { const a = Math.PI * (0.15 + 0.7 * (k / 6)), r = k % 2 ? 0.78 : 0.95; s.lineTo(Math.cos(Math.PI - a) * 0.45 * r, 0.32 + Math.sin(a) * 0.62 * r); }
  s.lineTo(0.2, 0.35); s.bezierCurveTo(0.2, 0.2, 0.55, 0.25, 0.5, 0); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -depth / 2).scale(size, size, 1);
}
export const acroterion = (P, x, y, z, size, rot = 0, mat = GMAT.gold) => P.push([palmetteGeo(size, 0.12).rotateY(rot).translate(x, y, z), mat]);
// antefixes: a row of little palmettes along an eave, from (x0) to (x1) at height y, facing out along +z (rot turns them)
export function antefixes(P, x0, x1, y, z, rot = 0, mat = GMAT.clay, step = 0.9) { for (let x = x0; x <= x1 + 1e-3; x += step) P.push([palmetteGeo(0.42, 0.05).rotateY(rot).translate(...rotXZ(x, z, rot), 0).translate(0, y, 0), mat]); }
const rotXZ = (x, z, rot) => [x * Math.cos(rot) + z * Math.sin(rot), 0, -x * Math.sin(rot) + z * Math.cos(rot)];
// a herm: a square pillar with a bearded head, a roadside shrine of Hermes
export function herm(P, x, y, z, rot = 0, mat) {
  P.push([new THREE.BoxGeometry(0.42, 1.25, 0.36).translate(0, 0.62, 0).rotateY(rot).translate(x, y, z), mat]);
  P.push([new THREE.BoxGeometry(0.5, 0.16, 0.44).translate(0, 1.32, 0).rotateY(rot).translate(x, y, z), mat]);
  P.push([new THREE.IcosahedronGeometry(0.2, 1).scale(0.9, 1.1, 1).translate(0, 1.58, 0).rotateY(rot).translate(x, y, z), mat]);
  P.push([new THREE.ConeGeometry(0.12, 0.22, 6).rotateX(Math.PI).translate(0, 1.42, 0.12).rotateY(rot).translate(x, y, z), mat]);   // the beard
}
export function cartWheel(P, x, y, z, rot = 0, lean = 0.25, r = 0.6, mat = GMAT.oldWood) {
  const q = [new THREE.TorusGeometry(r, 0.05, 5, 18), new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8).rotateX(Math.PI / 2)];
  for (let k = 0; k < 6; k++) q.push(new THREE.BoxGeometry(0.04, r * 2, 0.04).rotateZ((k / 6) * Math.PI));
  for (const g of q) P.push([g.rotateX(lean).rotateY(rot).translate(x, y + r * Math.cos(lean), z), mat]);
}
export function firewood(P, x, y, z, rot = 0, len = 1.4, rows = 3, mat = GMAT.wood) {
  for (let j = 0; j < rows; j++) for (let i = 0; i < rows - j + 2; i++) P.push([new THREE.CylinderGeometry(0.07, 0.08, len, 6).rotateX(Math.PI / 2).translate(-0.3 + i * 0.15 + j * 0.075, 0.08 + j * 0.13, 0).rotateY(rot).translate(x, y, z), mat]);
}
// low leafy mounds (a vine canopy, ivy cushions, a hedge): flattened, jittered blobs
export function leaves(P, x, y, z, w, d, h = 0.4, n = 8, seed = 1, mat = GMAT.leaf) {
  const r = dice(seed * 31 + 7); for (let k = 0; k < n; k++) P.push([new THREE.IcosahedronGeometry(1, 0).scale(w * (0.22 + r() * 0.14), h * (0.6 + r() * 0.5), d * (0.22 + r() * 0.14)).translate(x + (r() - 0.5) * w * 0.8, y + r() * h * 0.3, z + (r() - 0.5) * d * 0.8), mat]);
}
// soft ground mist: a few faint sprites lying low over a place
const mistTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
export function mist(group, n, R, color = 0xb8c4c0, seed = 3) {
  const r = dice(seed), out = [];
  for (let k = 0; k < n; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color, transparent: true, opacity: 0.22 + r() * 0.12, depthWrite: false })); const a = r() * 6.28, d = Math.sqrt(r()) * R, w = 7 + r() * 8;
    sp.scale.set(w, w * 0.35, 1); sp.position.set(Math.cos(a) * d, 0.6 + r() * 0.5, Math.sin(a) * d); sp.renderOrder = 2; group.add(sp); out.push(sp); }
  return out;
}
export { dice };
