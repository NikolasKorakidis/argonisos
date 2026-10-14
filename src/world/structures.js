// The trial's buildings and landmarks, built from a small Greek kit: fluted Doric columns, stepped platforms,
// entablatures with triglyphs, pediments and tiled roofs, rubble walls and great boulders. Each site is merged into a
// few meshes, registers what blocks you, what you can stand on and what keeps the rain off, and offers interactions.
import * as THREE from 'three';
import { SITES } from './sites.js';
import { clearGrass } from './grass.js';
import { loadFBX } from '../assets.js';
import { CLIPS } from '../player/hero.js';
import { askLight } from '../render/lights.js';
import { heightAt } from './gen.js';
import { propGeo, propMat, leafMat } from './trees.js';
import { GMAT, amphora, pithos, bowl, jug, tripod, acroterion, antefixes, cartWheel, firewood, leaves, mist, dice } from './greek.js';

const rnd = (() => { let s = 77; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })(), rr = (a, b) => a + rnd() * (b - a);
function canvasTex(draw, n = 512, rep = 1) { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
const marbleTex = canvasTex((g, n) => {
  g.fillStyle = '#e9e2d2'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 1400; i++) { const v = 200 + rnd() * 40; g.fillStyle = `rgba(${v},${v - 6},${v - 18},.25)`; g.beginPath(); g.arc(rnd() * n, rnd() * n, 2 + rnd() * 14, 0, 7); g.fill(); }
  for (let k = 0; k < 9; k++) { g.strokeStyle = `rgba(130,120,105,${0.12 + rnd() * 0.15})`; g.lineWidth = 0.6 + rnd() * 1.4; g.beginPath(); let x = rnd() * n, y = 0; g.moveTo(x, y); while (y < n) { x += rr(-14, 14); y += rr(8, 20); g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(110,100,80,${rnd() * 0.08})`; g.fillRect(rnd() * n, rnd() * n, rr(1, 3), rr(1, 3)); }
});
// worn flagstones: irregular slabs in dusty greys with dark joints and a little moss
const flagTex = canvasTex((g, n) => {
  let fs = 99; const fr = () => ((fs = (fs * 16807) % 2147483647) - 1) / 2147483646;   // its own dice (the shared ones lay out the sites)
  g.fillStyle = '#4a443a'; g.fillRect(0, 0, n, n); const rows = 4;
  for (let r = 0; r < rows; r++) { const h = n / rows; let x = -fr() * 60; while (x < n) { const w = 90 + fr() * 80, v = 120 + fr() * 45; g.fillStyle = `rgb(${v},${v - 6},${v - 16})`; g.fillRect(x + 3, r * h + 3, w - 6, h - 6);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(70,62,50,${fr() * 0.18})`; g.beginPath(); g.arc(x + fr() * w, r * h + fr() * h, 1 + fr() * 5, 0, 7); g.fill(); }
    if (fr() < 0.3) { g.fillStyle = 'rgba(80,100,50,.25)'; g.beginPath(); g.arc(x + fr() * w, r * h + fr() * h, 6 + fr() * 16, 0, 7); g.fill(); } x += w; } }
});
const stoneTex = canvasTex((g, n) => {
  g.fillStyle = '#6e665a'; g.fillRect(0, 0, n, n);
  const rows = 8; for (let r = 0; r < rows; r++) { const h = n / rows; let x = (r % 2) * rr(20, 50) - 40; while (x < n) { const w = rr(60, 130), v = 105 + rnd() * 55; g.fillStyle = `rgb(${v},${v - 8},${v - 22})`; g.fillRect(x + 2, r * h + 2, w - 4, h - 4);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(80,70,55,${rnd() * 0.15})`; g.fillRect(x + rnd() * w, r * h + rnd() * h, 2, 2); } x += w; } }
  g.strokeStyle = 'rgba(60,52,40,.55)'; g.lineWidth = 2; for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(0, (r * n) / rows); g.lineTo(n, (r * n) / rows); g.stroke(); }
});
const mossTex = canvasTex((g, n) => { g.fillStyle = '#5e6052'; g.fillRect(0, 0, n, n); for (let i = 0; i < 500; i++) { const gr = rnd() < 0.35; g.fillStyle = gr ? `rgba(${70 + rnd() * 20},${92 + rnd() * 25},${48},.22)` : `rgba(${80 + rnd() * 25},${78 + rnd() * 20},${66},.2)`; g.beginPath(); g.arc(rnd() * n, rnd() * n, 6 + rnd() * 26, 0, 7); g.fill(); } for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(30,28,22,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(rnd() * n, rnd() * n); g.lineTo(rnd() * n, rnd() * n); g.stroke(); } });
const tileTex = canvasTex((g, n) => { g.fillStyle = '#9a4a2a'; g.fillRect(0, 0, n, n); const rows = 10, cols = 8; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const v = 0.85 + rnd() * 0.3, x = c * n / cols + (r % 2) * n / cols / 2, y = r * n / rows; g.fillStyle = `rgb(${170 * v},${84 * v},${48 * v})`; g.beginPath(); g.ellipse(x, y + n / rows * 0.55, n / cols * 0.48, n / rows * 0.62, 0, 0, Math.PI); g.fill(); g.strokeStyle = 'rgba(60,25,12,.45)'; g.stroke(); } });
const friezeTex = canvasTex((g, n) => {   // triglyphs and painted metopes
  g.fillStyle = '#d9cfb8'; g.fillRect(0, 0, n, n / 2);
  for (let i = 0; i < 4; i++) { const x = i * n / 4; g.fillStyle = '#2e4a6a'; g.fillRect(x, 0, n / 10, n / 2); g.fillStyle = 'rgba(0,0,0,.35)'; for (const k of [0.25, 0.55]) g.fillRect(x + (n / 10) * k, 0, 4, n / 2);
    g.fillStyle = '#a8401f'; g.beginPath(); g.arc(x + n / 10 + (n / 4 - n / 10) / 2, n / 4, n / 14, 0, 7); g.fill(); g.strokeStyle = '#211610'; g.lineWidth = 3; g.stroke(); }
}, 512);
friezeTex.repeat.set(1, 2);
export const SMAT = {
  marble: new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.72, color: 0xc8c0b1, envMapIntensity: 0.45 }),   // (no brighter or shinier: it burned out white and mirrored the sky)
  ivory: new THREE.MeshStandardMaterial({ color: 0xe6d3ad, roughness: 0.42, emissive: 0x1c140a }),
  stone: new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95, color: 0xd8ccb8 }),
  moss: new THREE.MeshStandardMaterial({ map: mossTex, roughness: 1 }),
  tile: new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.85 }),
  frieze: new THREE.MeshStandardMaterial({ map: friezeTex, roughness: 0.7 }),
  bronze: new THREE.MeshStandardMaterial({ color: 0xb08040, roughness: 0.35, metalness: 0.8 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x3e3a34, roughness: 0.95, flatShading: true }),
  rock: new THREE.MeshStandardMaterial({ color: 0x7a7164, roughness: 0.95, flatShading: true, envMapIntensity: 0.5 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6e5238, roughness: 0.9 }),
  plaster: new THREE.MeshStandardMaterial({ color: 0xd8cbb0, roughness: 0.95, map: mossTex }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffb050, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  glyph: new THREE.MeshStandardMaterial({ color: 0xffe7a0, emissive: 0xffc860, emissiveIntensity: 1.6, transparent: true, opacity: 0.9 }),
  flags: new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.95, color: 0xb9ab96 }),
  bone: new THREE.MeshStandardMaterial({ color: 0xd9cfb4, roughness: 0.75 }),
};
const _nav = new THREE.Vector3();
const VIEW_R = { temple: 1700, labyrinth: 1400, chimera: 1200, house: 1000, peak: 600, olive: 700, cave: 900 };   // how far off each kind of site is drawn

// ---- kit: every helper pushes [geometry, material] onto a list in site-local coordinates
const uvBox = (w, h, d, s = 1 / 3) => { const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, nn = g.attributes.normal; for (let i = 0; i < uv.count; i++) { const ax = Math.abs(nn.getX(i)), ay = Math.abs(nn.getY(i)); uv.setXY(i, uv.getX(i) * (ax > 0.5 ? d : w) * s, uv.getY(i) * (ay > 0.5 ? d : h) * s); } return g; };
function column(P, x, y, z, h, r, mat = SMAT.marble, broken = 0) {
  const ch = broken ? h * broken : h - r * 1.1, g = new THREE.CylinderGeometry(r * 0.82, r, ch, 20, 6, false), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), f = 1 - 0.06 * Math.pow(Math.abs(Math.cos(a * 10)), 0.6), yy = p.getY(i) / ch + 0.5, ent = 1 + Math.sin(yy * Math.PI) * 0.04; p.setX(i, p.getX(i) * f * ent); p.setZ(i, p.getZ(i) * f * ent); if (broken && yy > 0.95) p.setY(i, p.getY(i) - rnd() * r * 0.8); }
  g.computeVertexNormals(); g.translate(x, y + ch / 2, z); P.push([g, mat]);
  if (!broken) { P.push([new THREE.CylinderGeometry(r * 1.15, r * 0.84, r * 0.45, 20).translate(x, y + ch + r * 0.22, z), mat]); P.push([uvBox(r * 2.5, r * 0.4, r * 2.5).translate(x, y + ch + r * 0.65, z), mat]); }
}
function steps(P, w, d, n, sh, y0 = 0, mat = SMAT.marble) { for (let i = 0; i < n; i++) { const k = (n - i) * 0.6; P.push([uvBox(w + k * 2, sh, d + k * 2).translate(0, y0 + i * sh + sh / 2, 0), mat]); } return y0 + n * sh; }
function pediment(P, w, h, z, y, d = 0.6, mat = SMAT.marble) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3, uv.getY(i) / 3); g.translate(0, y, z - d / 2); P.push([g, mat]); }
function gableRoof(P, w, len, rise, y, mat = SMAT.tile) {   // two sloped slabs meeting at a ridge along z
  const run = w / 2, sl = Math.hypot(run, rise), a = Math.atan2(rise, run);
  for (const s of [-1, 1]) { const g = uvBox(sl + 0.5, 0.25, len, 1 / 3).translate(s * (sl / 2 + 0.05), 0, 0).rotateZ(-s * a).translate(0, y + rise + 0.12, 0); P.push([g, mat]); }   // from the ridge down past the eaves
  P.push([new THREE.CylinderGeometry(0.22, 0.22, len + 0.2, 8).rotateX(Math.PI / 2).translate(0, y + rise + 0.2, 0), mat]);
}
function rubble(P, x0, z0, x1, z1, h, mat = SMAT.stone, ruin = 0) {   // a dry-stone wall from block courses, optionally broken
  const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0), n = Math.ceil(len / 0.9);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, hh = ruin ? h * (1 - ruin * Math.abs(Math.sin(t * 7 + x0))) * rr(0.6, 1) : h; if (hh < 0.3) continue;
    const g = uvBox(len / n + 0.02, hh, 0.75, 1 / 2).rotateY(-a).translate(x0 + (x1 - x0) * t, hh / 2, z0 + (z1 - z0) * t); P.push([g, mat]); }
}
// a farmhouse wall: a dry-stone footing, whitewashed plaster above (ruin: a broken, uneven top)
function plasterWall(P, x0, z0, x1, z1, h, ruin = 0, seed = 1) {
  rubble(P, x0, z0, x1, z1, 0.65, SMAT.stone);
  const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0), r = dice(seed * 13 + 1);
  if (!ruin) { P.push([uvBox(len, h - 0.65, 0.62).rotateY(-a).translate((x0 + x1) / 2, 0.65 + (h - 0.65) / 2, (z0 + z1) / 2), GMAT.whitewash]); return; }
  const n = Math.max(1, Math.round(len / 0.75));
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, hh = (h - 0.65) * (1 - ruin * Math.abs(Math.sin(t * 5 + seed))) * (0.75 + r() * 0.25); if (hh < 0.15) continue;
    P.push([uvBox(len / n + 0.01, hh, 0.62 - (i % 2) * 0.004).rotateY(-a).translate(x0 + (x1 - x0) * t, 0.65 + hh / 2, z0 + (z1 - z0) * t), GMAT.whitewash]); }
}
function boulder(P, x, y, z, s, mat = SMAT.rock, sx = 1, sy = 1, sz = 1) {
  // the bumps depend only on where a vertex is, so every face sharing a corner moves it the same way and the rock stays whole
  // (a random nudge per vertex tore the faces apart into shards with the sky showing through)
  const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const h = Math.sin(v.x * 12.99 + v.y * 78.23 + v.z * 37.72 + x * 3.1) * 43758.55, f = 0.75 + 0.35 * Math.sin(v.x * 3.1 + x) * Math.cos(v.y * 2.7 + z) + (h - Math.floor(h) - 0.5) * 0.1; p.setXYZ(i, v.x * f * sx, v.y * f * sy, v.z * f * sz); }
  g.computeVertexNormals(); g.scale(s, s, s).translate(x, y, z); P.push([g, mat]);
}
function mergeByMat(P) {
  const by = new Map(); for (const [g, m] of P) { const gg = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k); if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2)); (by.get(m) || by.set(m, []).get(m)).push(gg); }
  const out = []; for (const [m, gs] of by) { let total = 0; for (const g of gs) total += g.attributes.position.count; const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2); let o = 0;
    for (const g of gs) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = mesh.receiveShadow = true; out.push(mesh); }
  return out;
}

// ---- a marble statue of Zeus: the hero's rigged figure, posed and dressed in marble, a gilded bolt in hand
async function statue(group, x, y, z, s, rot, o = {}) {
  const obj = await loadFBX('hero_rig'); const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()); obj.scale.setScalar((1.95 / size.y) * s);
  obj.traverse((m) => { if (m.isMesh) { m.material = o.mat || SMAT.marble; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
  const wait = () => new Promise((res) => { const f = () => (CLIPS.bowDraw.ready ? res() : setTimeout(f, 300)); f(); }); await wait();
  const mixer = new THREE.AnimationMixer(obj), a = mixer.clipAction(CLIPS.bowDraw.clip); a.play(); a.time = CLIPS.bowDraw.dur * (o.pose ?? 0.15); mixer.update(0);   // a raised, commanding stance (other poses for the votive figures)
  obj.position.set(x, y, z); obj.rotation.y = rot; group.add(obj);
  let hand = null; obj.traverse((o) => { if (o.name === 'mixamorigRightHand') hand = o; });
  if (hand && o.bolt !== false) { const bolt = new THREE.Mesh(new THREE.CylinderGeometry(3, 1, 60, 5).translate(0, 30, 0), new THREE.MeshStandardMaterial({ color: 0xffd060, emissive: 0xffa020, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.3 })); bolt.rotation.z = -1.2; bolt.position.set(0, 8, 3); hand.add(bolt); }
}

export class Structures {
  constructor(g) {
    this.g = g; this.groups = []; this.solids = []; this.tops = []; this.roofs = []; this.uses = []; this.lights = []; this.flames = [];
    this.build();
  }
  // register helpers (site-local → world, sites only rotate about y)
  site(s, rot = 0) { const grp = new THREE.Group(); grp.position.set(s.x, s.y, s.z); grp.rotation.y = rot; grp.userData.viewR = VIEW_R[s.kind] ?? 800; this.g.scene.add(grp); this.groups.push(grp); return { grp, s, rot, P: [] }; }
  // sites far off are not drawn at all (the haze has them long before): checked twice a second
  cull(cam, dt) { this.cullT = (this.cullT || 0) - dt; if (this.cullT > 0) return; this.cullT = 0.5; for (const g of this.groups) g.visible = g.position.distanceTo(cam) < g.userData.viewR * (1 + Math.max(0, cam.y - 60) / 200); }
  w(ctx, x, z, y = 0) { const c = Math.cos(ctx.rot), sn = Math.sin(ctx.rot); return new THREE.Vector3(ctx.s.x + x * c + z * sn, ctx.s.y + y, ctx.s.z - x * sn + z * c); }
  solid(ctx, x, z, r, h = 99, y = 0) { const p = this.w(ctx, x, z, y); this.solids.push({ x: p.x, z: p.z, r, y: p.y, h }); }
  wall(ctx, x0, z0, x1, z1, h, t = 0.45) { const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / (t * 1.4))); for (let i = 0; i <= n; i++) this.solid(ctx, x0 + (x1 - x0) * (i / n), z0 + (z1 - z0) * (i / n), t, h); }
  stepTops(ctx, w, d, n, sh) { for (let i = 0; i < n; i++) { const k = (n - i) * 0.6; this.top(ctx, -w / 2 - k, w / 2 + k, -d / 2 - k, d / 2 + k, (i + 1) * sh); } }
  top(ctx, x0, x1, z0, z1, y, roof) { const t = { ctx, x0, x1, z0, z1, y }; (roof ? this.roofs : this.tops).push(t); }
  // merge the site's parts, and keep grass off its footprint (a circle of radius r, or a w × d rectangle)
  finish(ctx, foot) {
    for (const m of mergeByMat(ctx.P)) ctx.grp.add(m);
    if (!foot) return; const key = 'site' + ctx.s.x.toFixed(0) + ctx.s.z.toFixed(0);
    if (foot.r) clearGrass(key, { x: ctx.s.x, z: ctx.s.z, r: foot.r });
    else { const c = this.w(ctx, foot.x || 0, foot.z || 0); clearGrass(key, { x: c.x, z: c.z, hw: foot.w / 2, hd: foot.d / 2, rot: ctx.rot }); }
  }
  fire(ctx, x, y, z, big = 1) { const f = new THREE.Group(); f.position.set(x, y, z); const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.25 * big, 0.8 * big, 8, 1, true).translate(0, 0.4 * big, 0), SMAT.flame); f.add(c1); ctx.grp.add(f); this.flames.push(f); this.lights.push(this.w(ctx, x, z, y + 0.6)); }
  build() {
    const S = SITES;
    if (S.temple) this.temple(S.temple);
    if (S.house) this.house(S.house);
    if (S.labyrinth) this.labyrinth(S.labyrinth);
    if (S.chimera) this.shrine(S.chimera);
    S.olives.forEach((o, i) => this.olive(o, i));
    S.caves.forEach((c, i) => this.cave(c, i));
    if (S.peak) this.summit(S.peak);
    const col = this.solids.map((c) => ({ ...c, ref: { site: true } })); this.g.colliders.addGroup('sites', col);
  }
  // ---- the Ancient Temple of Zeus: a Doric peripteros on its stepped platform. Outside: painted pediments with the gods
  // on a blue field, gilded acroteria, antefixes along the eaves, and a paved sacred way between cypresses and votive
  // statues down to the altar. Inside the cella: painted walls under a ceiling of gold stars on blue, two rows of columns,
  // a dark pool before the ivory-and-gold Zeus (as at Olympia), and bronze tripods whose fires light him.
  temple(s) {
    const ctx = this.site(s, Math.atan2(-s.x, -s.z)), P = ctx.P, gy = (x, z) => this.groundY(ctx, x, z);     // the front faces the way you came from (the spawn)
    const W = 13, D = 21, top = steps(P, W, D, 3, 0.42);
    const cols = [];
    for (let i = 0; i < 4; i++) for (const zz of [-D / 2 + 1.1, D / 2 - 1.1]) cols.push([-W / 2 + 1.1 + i * (W - 2.2) / 3, zz]);
    for (let j = 1; j < 6; j++) for (const xx of [-W / 2 + 1.1, W / 2 - 1.1]) cols.push([xx, -D / 2 + 1.1 + j * (D - 2.2) / 6]);
    const H = 6.4, R = 0.6;
    for (const [x, z] of cols) { column(P, x, top, z, H, R); this.solid(ctx, x, z, R + 0.05); }
    const eb = top + H; P.push([uvBox(W - 0.4, 0.9, D - 0.4).translate(0, eb + 0.45, 0), SMAT.marble]);                       // architrave
    P.push([uvBox(W - 0.2, 0.85, D - 0.2).translate(0, eb + 1.32, 0), SMAT.frieze]);                                          // frieze
    P.push([uvBox(W + 0.3, 0.32, D + 0.3).translate(0, eb + 1.9, 0), SMAT.marble]);                                           // cornice
    pediment(P, W + 0.2, 2.6, D / 2 + 0.05, eb + 2.06); pediment(P, W + 0.2, 2.6, -D / 2 + 0.55, eb + 2.06);
    gableRoof(P, W + 1.2, D + 1.2, 2.6, eb + 2.06);
    // the pediments: the gods in marble on a deep blue field, gilded palmettes at the peaks and the corners
    for (const sd of [1, -1]) {
      const zf = sd > 0 ? D / 2 + 0.36 : -D / 2 + 0.24, f = (g) => (sd > 0 ? g : g.rotateY(Math.PI)).translate(0, 0, zf), yb = eb + 2.16;
      const tri = new THREE.Shape(); tri.moveTo(-W / 2 + 0.7, 0); tri.lineTo(W / 2 - 0.7, 0); tri.lineTo(0, 2.12); tri.closePath();
      P.push([f(new THREE.ExtrudeGeometry(tri, { depth: 0.04, bevelEnabled: false }).translate(0, yb, 0)), GMAT.tymp]);
      P.push([f(new THREE.CapsuleGeometry(0.26, 1.0, 4, 8).translate(0, yb + 0.8, 0.2)), SMAT.marble]);                               // Zeus, standing
      for (const sx of [-1, 1]) {
        P.push([f(new THREE.CapsuleGeometry(0.22, 0.55, 4, 8).translate(sx * 1.6, yb + 0.55, 0.18)), SMAT.marble]);                  // the gods kneeling
        P.push([f(new THREE.CapsuleGeometry(0.2, 0.9, 4, 8).rotateZ(sx * 1.25).translate(sx * 3.4, yb + 0.32, 0.16)), SMAT.marble]);  // and reclining into the corners
      }
      acroterion(P, 0, eb + 4.6, zf - sd * 0.3, 1.3); for (const sx of [-1, 1]) acroterion(P, sx * (W / 2 - 0.2), eb + 2.12, zf - sd * 0.3, 0.75);
    }
    for (const sx of [-1, 1]) antefixes(P, -D / 2 - 0.4, D / 2 + 0.4, eb + 2.1, 7.25, sx * Math.PI / 2, GMAT.clay, 1.05);
    // the cella: dressed stone outside, painted inside, a starry coffered ceiling over the whole colonnade
    const cw = 7, cd = 12, cz = -1.2;
    for (const [x0, z0, x1, z1] of [[-cw / 2, cz - cd / 2, cw / 2, cz - cd / 2], [-cw / 2, cz - cd / 2, -cw / 2, cz + cd / 2], [cw / 2, cz - cd / 2, cw / 2, cz + cd / 2], [-cw / 2, cz + cd / 2, -1.3, cz + cd / 2], [1.3, cz + cd / 2, cw / 2, cz + cd / 2]]) {
      P.push([uvBox(Math.abs(x1 - x0) || 0.6, H, Math.abs(z1 - z0) || 0.6).translate((x0 + x1) / 2, top + H / 2, (z0 + z1) / 2), GMAT.ashlar]); this.wall(ctx, x0, z0, x1, z1, 99, 0.4);
    }
    P.push([uvBox(2.6, H - 3.6, 0.6).translate(0, top + 3.6 + (H - 3.6) / 2, cz + cd / 2), GMAT.ashlar]);
    const lin = (len, h) => { const g = new THREE.PlaneGeometry(len, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * len) / 3); return g; };
    const iw = cw / 2 - 0.31, ib = cz - cd / 2 + 0.31, ifr = cz + cd / 2 - 0.31;
    P.push([lin(cd - 0.62, H).rotateY(Math.PI / 2).translate(-iw, top + H / 2, cz), GMAT.paint], [lin(cd - 0.62, H).rotateY(-Math.PI / 2).translate(iw, top + H / 2, cz), GMAT.paint]);
    P.push([lin(cw - 0.62, H).translate(0, top + H / 2, ib), GMAT.paint]);
    for (const sx of [-1, 1]) P.push([lin(iw - 1.3, H).rotateY(Math.PI).translate(sx * (iw + 1.3) / 2, top + H / 2, ifr), GMAT.paint]);
    const plane = (w, d, k) => { const g = new THREE.PlaneGeometry(w, d), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / k, (uv.getY(i) * d) / k); return g; };
    P.push([plane(cw - 0.62, cd - 0.62, 3).rotateX(-Math.PI / 2).translate(0, top + 0.012, cz), GMAT.floor]);
    P.push([plane(W - 0.45, D - 0.45, 1.6).rotateX(Math.PI / 2).translate(0, eb - 0.015, 0), GMAT.coffer]);
    for (const sx of [-1, 1]) for (const z of [-1.4, 1.0, 3.4]) { column(P, sx * 2.2, top, z, H, 0.3); this.solid(ctx, sx * 2.2, z, 0.36); }
    // Zeus on his stepped base, the pool before him, tripods burning either side, shields hung on the walls
    const sz = cz - cd / 2 + 2.6;
    P.push([uvBox(3.5, 0.3, 3.5).translate(0, top + 0.15, sz), GMAT.ashlar], [uvBox(3.0, 0.8, 3.0).translate(0, top + 0.7, sz), SMAT.marble], [uvBox(3.05, 0.1, 3.05).translate(0, top + 0.98, sz), GMAT.gold], [uvBox(3.2, 0.3, 3.2).translate(0, top + 1.25, sz), SMAT.marble]);
    statue(ctx.grp, 0, top + 1.4, sz, 2.3, 0, { mat: SMAT.ivory });
    const pz = sz + 3.5; P.push([plane(2.5, 3.0, 3).rotateX(-Math.PI / 2).translate(0, top + 0.04, pz), GMAT.water]);
    for (const [w, d, x, z] of [[2.86, 0.18, 0, pz - 1.59], [2.86, 0.18, 0, pz + 1.59], [0.18, 3.0, -1.34, pz], [0.18, 3.0, 1.34, pz]]) P.push([uvBox(w, 0.12, d).translate(x, top + 0.06, z), SMAT.marble]);
    for (const sx of [-1, 1]) { tripod(P, sx * 2.45, top, sz - 0.6, 1.25); this.fire(ctx, sx * 2.45, top + 1.4, sz - 0.6, 0.9); this.solid(ctx, sx * 2.45, sz - 0.6, 0.45);
      for (const z of [-0.2, 2.2]) { P.push([new THREE.CylinderGeometry(0.45, 0.45, 0.06, 20).rotateZ(Math.PI / 2).translate(sx * (iw - 0.04), top + 4.3, z), GMAT.bronze], [new THREE.SphereGeometry(0.1, 8, 6).translate(sx * (iw - 0.08), top + 4.3, z), GMAT.gold]); } }
    // the bronze-bound doors, thrown open into the cella
    for (const sx of [-1, 1]) { const leaf = (g) => g.rotateY(-sx * 1.3).translate(sx * 1.3, top, cz + cd / 2 - 0.36);
      P.push([leaf(uvBox(1.25, 3.5, 0.08).translate(-sx * 0.625, 1.75, 0)), GMAT.wood]); for (const y of [0.5, 1.75, 3.0]) P.push([leaf(uvBox(1.2, 0.08, 0.1).translate(-sx * 0.625, y, 0)), GMAT.bronze]); }
    this.stepTops(ctx, W, D, 3, 0.42);                                            // the steps and the platform you walk on
    this.top(ctx, -W / 2, W / 2, -D / 2, D / 2, eb, true);                       // under the roof
    // the altar before the steps, with an undying fire: pray here
    const az = D / 2 + 6.5; P.push([uvBox(2.6, 1.1, 1.6).translate(0, 0.55, az), SMAT.marble]); P.push([uvBox(2.9, 0.18, 1.9).translate(0, 1.19, az), SMAT.marble]);
    P.push([new THREE.CylinderGeometry(0.55, 0.4, 0.35, 12).translate(0, 1.45, az), SMAT.bronze]); this.fire(ctx, 0, 1.6, az, 1.3);
    P.push([uvBox(2.62, 0.16, 1.62).translate(0, 0.86, az), GMAT.tymp]); for (const sx of [-1, 1]) P.push([new THREE.CylinderGeometry(0.16, 0.16, 1.64, 10).rotateX(Math.PI / 2).translate(sx * 1.3, 1.02, az), SMAT.marble]);   // painted band, volutes
    this.solid(ctx, 0, az, 1.3, 1.3); this.top(ctx, -1.45, 1.45, az - 0.95, az + 0.95, 1.28);
    this.uses.push({ kind: 'altar', at: this.w(ctx, 0, az), r: 2.6 });
    // the sacred way: paving from the steps past the altar, cypresses and two votive statues along it
    for (let z = D / 2 + 1.9; z < az + 4; z += 2) P.push([uvBox(3.2, 0.16, 2.02, 1 / 2.4).translate(0, gy(0, z + 1) + 0.04, z + 1), SMAT.flags]);
    for (const sx of [-1, 1]) {
      for (const [z, v] of [[D / 2 + 3.6, 0], [az + 3.4, 1]]) { this.plant(ctx, 'cypress', v, sx * 4.4, gy(sx * 4.4, z), z, 1.05); this.solid(ctx, sx * 4.4, z, 0.45); }
      const x = sx * 4.4, z = az, y = gy(x, z);
      P.push([uvBox(1.1, 1.4, 1.1).translate(x, y + 0.7, z), SMAT.marble], [uvBox(1.3, 0.2, 1.3).translate(x, y + 1.5, z), SMAT.marble], [uvBox(1.3, 0.2, 1.3).translate(x, y + 0.1, z), GMAT.ashlar]);
      statue(ctx.grp, x, y + 1.6, z, 1.1, -sx * Math.PI / 2, { pose: sx > 0 ? 0.55 : 0.75, bolt: false }); this.solid(ctx, x, z, 0.75);
    }
    // two offering stands for the heads, flanking the steps
    for (const [k, sx] of [['minotaur', -1], ['chimera', 1]]) {
      const x = sx * (W / 2 + 0.5), z = D / 2 + 3.2; P.push([new THREE.CylinderGeometry(0.55, 0.65, 1.3, 10).translate(x, 0.65, z), SMAT.marble]); P.push([uvBox(1.4, 0.16, 1.4).translate(x, 1.38, z), SMAT.marble]);
      this.solid(ctx, x, z, 0.7, 1.4); const mount = new THREE.Group(); mount.position.set(x, 1.46, z); ctx.grp.add(mount);
      this.uses.push({ kind: 'offering', boss: k, at: this.w(ctx, x, z), r: 2.2, mount });
    }
    this.templeCtx = ctx; this.finish(ctx, { w: W + 5, d: D + 18, z: 3.5 });
  }
  // ---- an abandoned farmhouse: whitewashed walls on a rubble footing, half its tiled roof fallen in, a walled yard with a
  // well, a clay oven, storage jars and an olive, a vine over the door. Inside: the hearth, a loom, shelves, a bed and the
  // chest someone left behind.
  house(s) {
    const ctx = this.site(s, 0.4), P = ctx.P, W = 8, D = 6, H = 2.8, t = 0.31;
    plasterWall(P, -W / 2, -D / 2, W / 2, -D / 2, H, 0, 1); plasterWall(P, -W / 2, -D / 2 + t, -W / 2, D / 2 - t, H, 0, 2); plasterWall(P, W / 2, -D / 2 + t, W / 2, D / 2 - t, H, 0.55, 3);
    plasterWall(P, -W / 2, D / 2, -0.8, D / 2, H, 0, 4); plasterWall(P, 0.8, D / 2, W / 2, D / 2, H, 0.25, 5);
    for (const [x0, z0, x1, z1] of [[-W / 2, -D / 2, W / 2, -D / 2], [-W / 2, -D / 2, -W / 2, D / 2], [W / 2, -D / 2, W / 2, D / 2], [-W / 2, D / 2, -0.8, D / 2], [0.8, D / 2, W / 2, D / 2]]) this.wall(ctx, x0, z0, x1, z1, H, 0.42);
    // the roof: a ridge along the house, tiles still on the western two-thirds, bare rafters over the rest
    const a = 0.42, ry = H + Math.tan(a) * (D / 2) + 0.14, L = (D / 2 + 0.45) / Math.cos(a), xt = 1.2, slope = (g, sd, x) => g.translate(0, 0, sd * L / 2).rotateX(sd * a).translate(x, ry, 0);
    for (const sd of [-1, 1]) {
      P.push([slope(uvBox(xt + W / 2 + 0.35, 0.1, L).translate(0, 0.05, 0), sd, (xt - W / 2 - 0.35) / 2), SMAT.tile]);
      for (let x = -W / 2 + 0.25, k = 0; x < W / 2; x += 0.9, k++) { const broken = x > xt && k % 2; P.push([slope(uvBox(0.12, 0.14, broken ? L * 0.45 : L).translate(0, -0.07, broken ? -sd * L * 0.27 : 0), sd, x), GMAT.oldWood]); }
    }
    P.push([new THREE.CylinderGeometry(0.11, 0.11, W + 0.6, 8).rotateZ(Math.PI / 2).translate(0, ry - 0.06, 0), GMAT.oldWood], [new THREE.CylinderGeometry(0.15, 0.15, xt + W / 2 + 0.35, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate((xt - W / 2 - 0.35) / 2, ry + 0.08, 0), SMAT.tile]);
    const gab = new THREE.Shape(); gab.moveTo(-D / 2, 0); gab.lineTo(D / 2, 0); gab.lineTo(0, ry - H - 0.1); gab.closePath();   // the west gable still stands
    const gg = new THREE.ExtrudeGeometry(gab, { depth: 0.62, bevelEnabled: false }), guv = gg.attributes.uv; for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) / 3, guv.getY(i) / 3);
    P.push([gg.rotateY(Math.PI / 2).translate(-W / 2 - 0.31, H, 0), GMAT.whitewash]);
    for (const z of [-D / 2, D / 2]) P.push([uvBox(W, 0.16, 0.2).translate(0, H + 0.02, z), GMAT.oldWood]);   // wall plates
    this.top(ctx, -W / 2, xt, -D / 2, D / 2, H, true);
    // the doorway and the door, fallen off its hinges; shuttered windows
    for (const sx of [-1, 1]) P.push([uvBox(0.18, 2.25, 0.7).translate(sx * 0.89, 1.125, D / 2), GMAT.oldWood]);
    P.push([uvBox(2.1, 0.24, 0.72).translate(0, 2.4, D / 2), GMAT.oldWood], [uvBox(1.35, 0.07, 2.05).rotateZ(0.08).rotateY(0.5).translate(1.9, 0.08, D / 2 + 1.5), GMAT.oldWood]);
    for (const [x, z, ry2] of [[-1.6, -D / 2 - 0.32, Math.PI], [2.1, -D / 2 - 0.32, Math.PI], [-W / 2 - 0.32, 1.2, -Math.PI / 2]]) {
      const wnd = (g) => g.rotateY(ry2).translate(x, 0, z); P.push([wnd(new THREE.PlaneGeometry(0.75, 0.6).translate(0, 1.75, 0.005)), GMAT.ash]);
      for (const sx of [-1, 1]) P.push([wnd(uvBox(0.36, 0.62, 0.04).translate(sx * 0.18, 0, 0).rotateY(sx * 0.9).translate(sx * 0.38, 1.75, 0.05)), GMAT.oldWood]);
    }
    // inside: the hearth, a loom against the west wall, shelves, a bed, a table and stools, fallen tiles in the open end
    for (let k = 0; k < 9; k++) { const q = (k / 9) * Math.PI * 2; boulder(P, 0.3 + Math.cos(q) * 0.55, 0.08, -0.2 + Math.sin(q) * 0.55, 0.13, SMAT.rock); }
    P.push([new THREE.CylinderGeometry(0.42, 0.45, 0.04, 14).translate(0.3, 0.02, -0.2), GMAT.ash]); for (let k = 0; k < 3; k++) P.push([new THREE.CylinderGeometry(0.05, 0.06, 0.6, 6).rotateZ(Math.PI / 2).rotateY(k * 1.1).translate(0.3, 0.07, -0.2), GMAT.ash]); for (let k = 0; k < 5; k++) P.push([new THREE.IcosahedronGeometry(0.05, 0).translate(0.3 + Math.cos(k * 2.3) * 0.18, 0.05, -0.2 + Math.sin(k * 2.3) * 0.18), GMAT.ember]);
    { const lx = -W / 2 + 0.55, lz = -1.4, lm = (g) => g.translate(lx, 0, lz);
      for (const dz of [-0.75, 0.75]) P.push([lm(uvBox(0.1, 1.9, 0.1).rotateZ(0.12).translate(0, 0.95, dz)), GMAT.wood]);
      P.push([lm(uvBox(0.1, 0.1, 1.7).translate(0.1, 1.85, 0)), GMAT.wood], [lm(new THREE.PlaneGeometry(1.4, 0.9).rotateY(Math.PI / 2).rotateZ(0.12).translate(0.04, 1.35, 0)), GMAT.wool]);
      for (let k = 0; k < 12; k++) P.push([lm(uvBox(0.01, 0.8, 0.01).rotateZ(0.12).translate(0.0, 0.5, -0.66 + k * 0.12)), GMAT.linen], [lm(new THREE.ConeGeometry(0.04, 0.1, 5).translate(-0.05, 0.12, -0.66 + k * 0.12)), GMAT.clay]); }
    for (const y of [1.15, 1.7]) { P.push([uvBox(1.7, 0.05, 0.3).translate(2.0, y, -D / 2 + 0.47), GMAT.wood]); for (let k = 0; k < 4; k++) (k % 2 ? jug : bowl)(P, 1.4 + k * 0.4, y + 0.025, -D / 2 + 0.47, 0.9); }
    P.push([uvBox(0.95, 0.35, 1.95).translate(-W / 2 + 1.0, 0.18, 1.5), GMAT.wood], [uvBox(0.9, 0.12, 1.5).translate(-W / 2 + 1.0, 0.41, 1.7), GMAT.wool], [uvBox(0.6, 0.12, 0.35).translate(-W / 2 + 1.0, 0.43, 0.75), GMAT.linen]);
    P.push([uvBox(1.4, 0.08, 0.9, 1).translate(2, 0.85, -1.4), SMAT.wood]); for (const [x, z] of [[1.4, -1.75], [2.6, -1.75], [1.4, -1.05], [2.6, -1.05]]) P.push([uvBox(0.08, 0.85, 0.08).translate(x, 0.42, z), SMAT.wood]);
    jug(P, 1.7, 0.89, -1.3, 1.1); bowl(P, 2.2, 0.89, -1.5); bowl(P, 2.4, 0.89, -1.2, 0.8);
    for (const [x, z] of [[2.1, -0.55], [1.2, -2.0]]) P.push([new THREE.CylinderGeometry(0.2, 0.18, 0.45, 8).translate(x, 0.22, z), GMAT.wood]);
    for (let k = 0; k < 12; k++) P.push([uvBox(0.32, 0.03, 0.4).rotateX(rr(-0.4, 0.4)).rotateY(rr(0, 3)).translate(rr(1.8, 3.5), 0.03 + rr(0, 0.1), rr(-1.8, 1.8)), SMAT.tile]);
    P.push([uvBox(0.14, 0.14, 2.6).rotateX(0.35).rotateY(0.6).translate(2.6, 0.5, 0.6), GMAT.oldWood]);
    pithos(P, -2.6, -0.25, 2.1, 0.7); P.push([new THREE.CylinderGeometry(0.5, 0.6, 0.03, 12).translate(-2.0, 0.015, 2.3), new THREE.MeshStandardMaterial({ color: 0xc9a85a, roughness: 1 })]);   // a cracked jar, its grain spilt
    // the old chest
    const chest = new THREE.Group(); chest.position.set(-1.8, 0, -D / 2 + 0.8); ctx.grp.add(chest);
    const cm = new THREE.Mesh(uvBox(1, 0.55, 0.6, 1), GMAT.wood); cm.position.y = 0.28; cm.castShadow = true; chest.add(cm);
    for (const x of [-0.35, 0.35]) { const band = new THREE.Mesh(uvBox(0.08, 0.57, 0.62), GMAT.bronze); band.position.set(x, 0.28, 0); chest.add(band); }
    const lid = new THREE.Mesh(uvBox(1.04, 0.12, 0.64, 1), SMAT.bronze); lid.position.y = 0.6; chest.add(lid);
    this.solid(ctx, -1.8, -D / 2 + 0.8, 0.55, 0.7);
    this.uses.push({ kind: 'loot', at: this.w(ctx, -1.8, -D / 2 + 0.8), r: 1.8, id: 'houseChest', lid, items: [['rope', 6], ['leather', 2], ['olive', 5], ['crudeDagger', 1], ['resin', 2], ['torch', 1]] });
    // the yard: a low dry-stone wall with a gate, a vine on a pergola over the door, the well, the oven, jars, firewood
    const yz = D / 2 + 6;
    for (const [x0, z0, x1, z1] of [[-W / 2, D / 2 + 0.4, -W / 2, yz], [-W / 2, yz, -1.2, yz], [1.2, yz, W / 2, yz], [W / 2, yz, W / 2, D / 2 + 0.4]]) { rubble(P, x0, z0, x1, z1, 1.0, SMAT.stone, 0.25); this.wall(ctx, x0, z0, x1, z1, 1.0, 0.4); }
    for (const sx of [-1, 1]) { P.push([uvBox(0.55, 1.5, 0.55).translate(sx * 1.45, 0.75, yz), GMAT.ashlar], [uvBox(0.68, 0.14, 0.68).translate(sx * 1.45, 1.55, yz), GMAT.ashlar]); this.solid(ctx, sx * 1.45, yz, 0.4); }
    for (const sx of [-1, 1]) { P.push([new THREE.CylinderGeometry(0.08, 0.09, 2.45, 7).translate(sx * 1.5, 1.22, D / 2 + 2.5), GMAT.oldWood], [uvBox(0.1, 0.1, 2.7).translate(sx * 1.5, 2.45, D / 2 + 1.3), GMAT.oldWood]); this.solid(ctx, sx * 1.5, D / 2 + 2.5, 0.15); }
    for (let z = D / 2 + 0.3; z < D / 2 + 2.7; z += 0.55) P.push([uvBox(3.3, 0.06, 0.06).translate(0, 2.53, z), GMAT.oldWood]);
    leaves(P, 0, 2.5, D / 2 + 1.4, 3.8, 2.9, 0.35, 16, 5); for (let k = 0; k < 6; k++) P.push([new THREE.SphereGeometry(0.07, 6, 4).translate(rr(-1.4, 1.4), 2.42, D / 2 + rr(0.4, 2.4)), new THREE.MeshStandardMaterial({ color: 0x4a2a52, roughness: 0.6 })]);   // grapes
    { const wx = 2.4, wz = D / 2 + 3.3; P.push([new THREE.CylinderGeometry(0.75, 0.8, 0.8, 16, 1, true).translate(wx, 0.4, wz), SMAT.stone], [new THREE.CylinderGeometry(0.7, 0.7, 0.02, 16).translate(wx, 0.55, wz), GMAT.ash], [new THREE.TorusGeometry(0.75, 0.08, 6, 16).rotateX(Math.PI / 2).translate(wx, 0.8, wz), SMAT.stone]);
      for (const sx of [-1, 1]) P.push([uvBox(0.1, 1.9, 0.1).translate(wx + sx * 0.8, 0.95, wz), GMAT.oldWood]); P.push([new THREE.CylinderGeometry(0.06, 0.06, 1.75, 6).rotateZ(Math.PI / 2).translate(wx, 1.85, wz), GMAT.oldWood], [uvBox(0.01, 1.0, 0.01).translate(wx, 1.35, wz), GMAT.linen], [new THREE.CylinderGeometry(0.15, 0.12, 0.25, 8, 1, true).translate(wx, 0.85, wz), GMAT.oldWood]);
      this.solid(ctx, wx, wz, 0.9); }
    { const ox = -3.0, oz = D / 2 + 1.6; P.push([new THREE.SphereGeometry(0.85, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(ox, 0.3, oz), GMAT.clay], [new THREE.CylinderGeometry(0.95, 1.0, 0.3, 14).translate(ox, 0.15, oz), SMAT.stone], [new THREE.CircleGeometry(0.3, 10, 0, Math.PI).translate(ox, 0.3, oz + 0.86), GMAT.ash]);
      P.push([new THREE.CylinderGeometry(0.35, 0.38, 0.18, 12).translate(ox + 1.1, 0.09, oz + 0.3), SMAT.stone]); this.solid(ctx, ox, oz, 1.0); }
    for (const [x, z, sc] of [[-3.3, D / 2 + 4.5, 0.9], [-2.4, D / 2 + 5.2, 0.8], [-3.4, D / 2 + 5.4, 0.75]]) { pithos(P, x, -0.35, z, sc); this.solid(ctx, x, z, 0.5 * sc); }
    amphora(P, 3.4, 0, D / 2 + 0.7, 1.0, 0.18); amphora(P, 3.0, 0.22, D / 2 + 1.3, 1.0, 1.45, 0.8); amphora(P, 3.55, 0, D / 2 + 1.1, 0.9);
    firewood(P, -2.2, 0, D / 2 + 0.55, Math.PI / 2, 1.3, 3); cartWheel(P, W / 2 - 0.25, 0, D / 2 + 4.6, Math.PI / 2, 0.18);
    this.plant(ctx, 'olive', 1, 2.6, 0, D / 2 + 5.4, 1.15); this.solid(ctx, 2.6, D / 2 + 5.4, 0.6);
    this.finish(ctx, { w: W + 1.5, d: D + 1.5 });
  }
  // ---- the Labyrinth: the Minotaur's ruined arena
  labyrinth(s) {
    const ctx = this.site(s, 0), P = ctx.P;
    // its own dice for the decoration, so the other sites (and their clues) come out as they always have
    let ls = 1234; const lr = (a, b) => a + (((ls = (ls * 16807) % 2147483647) - 1) / 2147483646) * (b - a);
    // three broken rings of wall with offset gaps, a ring of columns, a raised altar in the middle. The gaps are
    // remembered, so the Minotaur and the dead can find their way through the rings (navTarget)
    const gaps = { 22: [], 15: [], 9: [] };
    for (const [R, gap, ruin] of [[22, 0.3, 0.45], [15, 2.1, 0.35], [9, 4.2, 0.25]]) {
      const n = Math.ceil(R * 0.9);
      for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2; if (Math.abs(Math.sin((a0 - gap) / 2)) < 0.12) { gaps[R].push([a0, a1]); continue; }
        const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R, h = 3.2 * (1 - ruin * Math.abs(Math.sin(i * 1.7 + R))); rubble(P, x0, z0, x1, z1, h, SMAT.stone, 0.15); this.wall(ctx, x0, z0, x1, z1, h, 0.42); }
    }
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + 0.3, x = Math.cos(a) * 18.5, z = Math.sin(a) * 18.5, br = i % 3 === 1 ? rr(0.25, 0.6) : 0; column(P, x, 0, z, 5.5, 0.5, SMAT.marble, br); this.solid(ctx, x, z, 0.55); }
    const top = steps(P, 5, 5, 3, 0.35, 0, SMAT.stone);
    P.push([uvBox(2.2, 1.0, 1.4).translate(0, top + 0.5, 0), SMAT.marble]);
    for (const sx of [-1, 1]) { const horn = new THREE.TorusGeometry(0.9, 0.12, 6, 14, Math.PI * 0.8).rotateZ(sx > 0 ? -0.2 : Math.PI + 0.2).translate(sx * 0.45, top + 1.4, 0); P.push([horn, SMAT.bronze]); }
    for (const sx of [-1, 1]) { P.push([new THREE.CylinderGeometry(0.35, 0.2, 1.1, 10).translate(sx * 3.4, top + 0.55, 2), SMAT.bronze]); this.fire(ctx, sx * 3.4, top + 1.1, 2); }
    this.solid(ctx, 0, 0, 1.3, top + 1);
    this.stepTops(ctx, 5, 5, 3, 0.35);
    this.uses.push({ kind: 'summon', boss: 'minotaur', at: this.w(ctx, 0, 1.4), r: 3.2, center: this.w(ctx, 0, 0) });
    // the arena floor: worn flagstones from the outer wall in
    const floor = new THREE.CylinderGeometry(23.4, 23.4, 0.08, 72, 1).translate(0, 0.04, 0), fu = floor.attributes.uv, fp = floor.attributes.position;
    for (let i = 0; i < fu.count; i++) fu.setXY(i, fp.getX(i) / 2.4, fp.getZ(i) / 2.4);
    P.push([floor, SMAT.flags]);
    // the gate: two great pillars at the outer gap, a lintel, and the bull's horns over the way in
    const [g0, g1] = gaps[22][0], gp = [g0, g1].map((a) => [Math.cos(a) * 22, Math.sin(a) * 22]);
    for (const [x, z] of gp) { column(P, x, 0, z, 6.2, 0.7, SMAT.stone); this.solid(ctx, x, z, 0.75); }
    const gl = Math.hypot(gp[1][0] - gp[0][0], gp[1][1] - gp[0][1]) + 1.6, gx = (gp[0][0] + gp[1][0]) / 2, gz = (gp[0][1] + gp[1][1]) / 2, ga = Math.atan2(gp[1][1] - gp[0][1], gp[1][0] - gp[0][0]);
    P.push([uvBox(gl, 0.9, 1.3).rotateY(-ga).translate(gx, 6.6, gz), SMAT.stone]);
    for (const sx of [-1, 1]) P.push([new THREE.TorusGeometry(1.5, 0.2, 6, 14, Math.PI * 0.8).rotateZ(sx > 0 ? -0.2 : Math.PI + 0.2).rotateY(-ga).translate(gx + Math.cos(ga) * sx * 0.7, 7.6, gz + Math.sin(ga) * sx * 0.7), SMAT.bronze]);
    // braziers either side of the inner gaps, lighting the way to the altar
    for (const R of [15, 9]) { const [a0, a1] = gaps[R][0]; for (const a of [a0 - 0.12, a1 + 0.12]) { const x = Math.cos(a) * (R - 1.1), z = Math.sin(a) * (R - 1.1);
      P.push([new THREE.CylinderGeometry(0.22, 0.3, 1.1, 8).translate(x, 0.55, z), SMAT.stone], [new THREE.CylinderGeometry(0.42, 0.24, 0.3, 10).translate(x, 1.25, z), SMAT.bronze]); this.fire(ctx, x, 1.35, z, 0.8); this.solid(ctx, x, z, 0.45); } }
    // bones of those who came before, along the corridors
    for (let i = 0; i < 22; i++) {
      const R = i % 2 ? lr(10.5, 13.5) : lr(16.5, 20.5), a = lr(0, Math.PI * 2), x = Math.cos(a) * R, z = Math.sin(a) * R;
      for (let k = 0; k < 4; k++) P.push([new THREE.CylinderGeometry(0.035, 0.03, lr(0.35, 0.6), 5).rotateZ(Math.PI / 2).rotateY(lr(0, 6.3)).translate(x + lr(-0.4, 0.4), 0.11, z + lr(-0.4, 0.4)), SMAT.bone]);
      if (i % 3 === 0) { P.push([new THREE.IcosahedronGeometry(0.15, 1).scale(1, 0.9, 1.2).translate(x, 0.2, z), SMAT.bone], [new THREE.BoxGeometry(0.16, 0.06, 0.12).translate(x, 0.09, z + 0.12), SMAT.bone]); }
    }
    this.lab = { c: this.w(ctx, 0, 0), gaps };
    this.labyrinthCtx = ctx; this.finish(ctx, { r: 23.5 });
  }
  // A waypoint for something inside the Labyrinth trying to reach a point on the other side of a ring of wall: the
  // middle of that ring's gap (and once there, a step through it). Null when the way is open.
  navTarget(from, to) {
    const L = this.lab; if (!L) return null;
    const band = (p) => { const r = Math.hypot(p.x - L.c.x, p.z - L.c.z); return r < 9 ? 0 : r < 15 ? 1 : r < 22 ? 2 : r < 30 ? 3 : -1; };
    const bf = band(from), bt = band(to); if (bf < 0 || bt < 0 || bf === bt || (bf === 3 && bt === 3)) return null;
    const R = [9, 15, 22][bt > bf ? bf : bf - 1], [a0, a1] = L.gaps[R][0], a = (a0 + a1) / 2, gx = L.c.x + Math.cos(a) * R, gz = L.c.z + Math.sin(a) * R;
    if (Math.hypot(from.x - gx, from.z - gz) > 2.2) return _nav.set(gx, from.y, gz);
    const R2 = R + (bt > bf ? 3 : -3); return _nav.set(L.c.x + Math.cos(a) * R2, from.y, L.c.z + Math.sin(a) * R2);   // through it
  }
  // ---- the Chimera's shrine: a sunken court of dark, mossy flagstones deep in the forest, ringed by columns lost to ivy,
  // some fallen. On the altar the beast itself in black stone (the lion crouched to spring, the goat rising from its back,
  // the serpent coiled over) with ember eyes. Tripods burn round the court and a low mist lies over the stones.
  shrine(s) {
    const ctx = this.site(s, 0.8), P = ctx.P, lr = dice(4242);
    const floor = new THREE.CylinderGeometry(19, 19, 0.08, 64, 1).translate(0, 0.04, 0), fu = floor.attributes.uv, fp = floor.attributes.position;
    for (let i = 0; i < fu.count; i++) fu.setXY(i, fp.getX(i) / 2.6, fp.getZ(i) / 2.6); P.push([floor, GMAT.darkFlags]);
    for (const [r0, r1] of [[9.4, 10], [12.6, 12.9]]) P.push([new THREE.RingGeometry(r0, r1, 64).rotateX(-Math.PI / 2).translate(0, 0.085, 0), GMAT.basalt]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, x = Math.cos(a) * 17, z = Math.sin(a) * 17, br = i % 4 === 2 ? rr(0.3, 0.6) : 0; column(P, x, 0, z, 6, 0.55, SMAT.moss, br); this.solid(ctx, x, z, 0.6);
      if (!br && i % 2 === 0) { const a2 = ((i + 2) / 12) * Math.PI * 2; P.push([uvBox(Math.hypot(Math.cos(a2) * 17 - x, Math.sin(a2) * 17 - z) + 1.2, 0.7, 1.1).rotateY(-Math.atan2(Math.sin(a2) * 17 - z, Math.cos(a2) * 17 - x)).translate((x + Math.cos(a2) * 17) / 2, 6.0, (z + Math.sin(a2) * 17) / 2), SMAT.moss]); }
      if (br) for (let k = 0; k < 3; k++) { const t = a + Math.PI / 2 + (lr() - 0.5) * 0.5, d = 1.5 + k * 1.1, dx = x + Math.cos(a + 0.5) * d, dz = z + Math.sin(a + 0.5) * d;   // its drums, fallen in a line
        P.push([new THREE.CylinderGeometry(0.5, 0.53, 0.95, 18).rotateZ(Math.PI / 2).rotateY(-t).translate(dx, 0.5, dz), SMAT.moss]); this.solid(ctx, dx, dz, 0.55, 1); }
      if (i % 3 === 0) for (let k = 0; k < 9; k++) { const q = k * 0.85 + i; P.push([new THREE.IcosahedronGeometry(1, 0).scale(0.32, 0.45, 0.3).translate(x + Math.cos(q) * 0.55, 0.3 + k * 0.55, z + Math.sin(q) * 0.55), GMAT.ivy]); }   // ivy climbing
    }
    const top = steps(P, 7, 7, 4, 0.4, 0, SMAT.moss);
    P.push([uvBox(3.2, 1.2, 2.4).translate(0, top + 0.6, 0), GMAT.basalt], [uvBox(3.4, 0.16, 2.6).translate(0, top + 1.28, 0), GMAT.basalt]);
    // the Chimera in black stone, larger than life and turned three-quarters to whoever comes to the altar
    const y0 = top + 1.36, B = GMAT.basalt, Q = [];
    Q.push([new THREE.SphereGeometry(1, 16, 12).scale(0.62, 0.55, 1.05).translate(0, y0 + 0.75, -0.1), B]);
    for (const [x, z] of [[-0.42, 0.6], [0.42, 0.6], [-0.45, -0.75], [0.45, -0.75]]) Q.push([new THREE.CylinderGeometry(0.15, 0.18, 0.75, 8).translate(x, y0 + 0.37, z), B], [new THREE.SphereGeometry(0.2, 8, 6).scale(1, 0.6, 1.3).translate(x, y0 + 0.08, z + 0.08), B]);
    Q.push([new THREE.IcosahedronGeometry(0.62, 1).scale(1.1, 1.05, 0.85).translate(0, y0 + 1.25, 0.85), B]);
    Q.push([new THREE.IcosahedronGeometry(0.42, 1).scale(1, 0.92, 1.15).translate(0, y0 + 1.2, 1.2), B], [uvBox(0.42, 0.28, 0.4).translate(0, y0 + 1.08, 1.55), B], [uvBox(0.38, 0.1, 0.36).rotateX(0.35).translate(0, y0 + 0.88, 1.5), B]);
    for (const sx of [-1, 1]) Q.push([new THREE.SphereGeometry(0.06, 8, 6).translate(sx * 0.17, y0 + 1.33, 1.5), GMAT.eye], [new THREE.ConeGeometry(0.035, 0.14, 5).rotateX(Math.PI).translate(sx * 0.12, y0 + 0.97, 1.72), SMAT.bone]);
    Q.push([new THREE.CylinderGeometry(0.16, 0.24, 1.0, 8).rotateX(-0.35).translate(0, y0 + 1.55, -0.35), B], [new THREE.IcosahedronGeometry(0.25, 1).scale(0.8, 0.9, 1.35).translate(0, y0 + 2.08, -0.22), B]);
    for (const sx of [-1, 1]) Q.push([new THREE.TorusGeometry(0.2, 0.05, 6, 12, Math.PI * 1.3).rotateY(Math.PI / 2).translate(sx * 0.13, y0 + 2.22, -0.35), B], [new THREE.SphereGeometry(0.04, 6, 4).translate(sx * 0.12, y0 + 2.12, -0.04), GMAT.eye]);
    const tail = new THREE.CatmullRomCurve3([[0, 0.55, -1.1], [0.1, 0.5, -1.6], [0.5, 0.9, -1.8], [0.75, 1.5, -1.3], [0.62, 2.0, -0.7], [0.48, 2.12, -0.25]].map(([x, y, z]) => new THREE.Vector3(x, y0 + y, z)));
    Q.push([new THREE.TubeGeometry(tail, 30, 0.1, 7), GMAT.oldBronze], [new THREE.IcosahedronGeometry(0.15, 1).scale(0.9, 0.7, 1.5).translate(0.48, y0 + 2.14, -0.1), GMAT.oldBronze]);
    for (const sx of [-1, 1]) Q.push([new THREE.SphereGeometry(0.03, 6, 4).translate(0.48 + sx * 0.08, y0 + 2.2, 0.0), GMAT.eye]);
    for (let k = 0; k < 16; k++) { const q = (k / 16) * Math.PI * 2; Q.push([new THREE.ConeGeometry(0.13, 0.55, 5).rotateX(-Math.PI / 2 - 0.5).rotateZ(q).translate(Math.cos(q) * 0.42, y0 + 1.25 + Math.sin(q) * 0.42, 0.7), B]); }   // the mane
    for (const [g, m] of Q) P.push([g.translate(0, -y0, 0).scale(1.35, 1.35, 1.35).rotateY(0.5).translate(0, y0, 0), m]);
    // tripods round the court, roots through the stones, the bones of the beast's meals, broken offerings
    for (const [x, z] of [[-7.2, 7.2], [7.2, 7.2], [-7.2, -7.2], [7.2, -7.2]]) { tripod(P, x, 0, z, 1.3, GMAT.oldBronze); this.fire(ctx, x, 1.45, z, 1.0); this.solid(ctx, x, z, 0.45); }
    for (let i = 0; i < 9; i++) { const a = rr(0, 6.28), r0 = rr(4, 12); P.push([new THREE.TorusGeometry(rr(1, 2.2), rr(0.12, 0.22), 5, 9, Math.PI * rr(0.5, 0.9)).rotateX(Math.PI / 2 + rr(-0.3, 0.3)).rotateY(a).translate(Math.cos(a) * r0, 0, Math.sin(a) * r0), SMAT.wood]); }
    for (let k = 0; k < 16; k++) { const a = lr() * 6.28, r0 = 6.4 + lr() * 2.5; P.push([new THREE.CylinderGeometry(0.04, 0.035, 0.4 + lr() * 0.5, 5).rotateZ(Math.PI / 2).rotateY(lr() * 3).translate(Math.cos(a) * r0, 0.12, Math.sin(a) * r0), SMAT.bone]); if (k % 5 === 0) P.push([new THREE.IcosahedronGeometry(0.15, 1).scale(1, 0.9, 1.2).translate(Math.cos(a) * r0 + 0.3, 0.2, Math.sin(a) * r0), SMAT.bone]); }
    for (let k = 0; k < 4; k++) { const a = 0.6 + k * 1.6, x = Math.cos(a) * 5.4, z = Math.sin(a) * 5.4; amphora(P, x, 0.25, z, 0.8, 1.4 + lr() * 0.3, a); bowl(P, x + 0.5, 0.09, z + 0.3, 1.1); }
    mist(ctx.grp, 14, 15, 0x9fb0a6, 5);
    this.solid(ctx, 0, 0, 1.7, top + 1.2);
    this.stepTops(ctx, 7, 7, 4, 0.4);
    this.uses.push({ kind: 'summon', boss: 'chimera', at: this.w(ctx, 0, 1.6), r: 3.4, center: this.w(ctx, 0, 0) });
    this.finish(ctx, { r: 18.5 });
  }
  // ---- an ancient olive with marks cut into a little stele before it, and offerings left at its foot
  olive(s, i) {
    const ctx = this.site(s, i * 1.3), P = ctx.P;
    this.plant(ctx, 'olive', i % 3, 0, 0, 0, 1.9); this.solid(ctx, 0, 0, 0.95);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; boulder(P, Math.cos(a) * 3.6, 0.15, Math.sin(a) * 3.6, 0.35, SMAT.rock, 1.2, 0.6, 1); }
    P.push([uvBox(0.6, 1.25, 0.24).translate(0, 0.62, 1.55), SMAT.marble], [uvBox(0.74, 0.12, 0.36).translate(0, 1.3, 1.55), SMAT.marble], [uvBox(0.84, 0.14, 0.46).translate(0, 0.07, 1.55), GMAT.ashlar]);
    amphora(P, 0.6, 0, 1.75, 0.55, 0.12); bowl(P, -0.5, 0.02, 1.85, 1.1); for (let k = 0; k < 6; k++) P.push([new THREE.SphereGeometry(0.035, 6, 4).translate(-0.5 + Math.cos(k) * 0.08, 0.1, 1.85 + Math.sin(k) * 0.08), GMAT.basalt]);
    this.solid(ctx, 0, 1.55, 0.45, 1.4);
    const glyphs = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.6), SMAT.glyph.clone()); glyphs.material.map = glyphTex(i); glyphs.position.set(0, 0.78, 1.55 + 0.125); ctx.grp.add(glyphs);
    this.uses.push({ kind: 'scrap', id: 'olive' + i, at: this.w(ctx, 0, 1.2), r: 2.2, glyphs });
    this.finish(ctx, { r: 2.2 });
  }
  // ---- a Giant cave: an outcrop of great rocks on a hillside, the hollow under it dark and smoky. The giant's fire burns
  // inside with his supper on a spit; bones, his club and his bed of hides lie about. At the back stands the carved stele.
  cave(s, i) {
    const ctx = this.site(s, i * 1.7 + 0.5), P = ctx.P, RK = SMAT.rock, IN = GMAT.caveRock, lr = dice(50 + i);
    for (const sx of [-1, 1]) for (const [z, sc] of [[-3.4, 2.7], [-0.6, 2.9], [2.0, 2.4]]) boulder(P, sx * 4.5, 1.8, z, sc, IN, 0.85, 1.25, 1.0);
    boulder(P, -1.8, 2.4, -5.0, 3.0, IN, 1.3, 1.1, 0.8); boulder(P, 1.9, 2.3, -5.1, 3.0, IN, 1.3, 1.1, 0.8);
    boulder(P, 0, 6.2, -1.0, 4.6, IN, 1.4, 0.42, 1.3);                                                         // the roof slab
    boulder(P, -2.6, 5.4, 2.0, 2.6, RK, 1.2, 0.5, 1.0); boulder(P, 2.7, 5.3, 2.1, 2.5, RK, 1.2, 0.5, 1.0);   // the overhang over the mouth
    boulder(P, 0, 5.0, -7.5, 6.5, RK, 1.4, 0.75, 0.9); boulder(P, -6.5, 3.2, -4.5, 4.6, RK, 0.9, 0.8, 1.1); boulder(P, 6.6, 3.0, -4.4, 4.6, RK, 0.9, 0.8, 1.1);   // the hill it belongs to
    for (const [x, y, z, sc] of [[0, 7.7, -1.4, 2.8], [-2.6, 6.2, 2.0, 1.6], [2.7, 6.1, 2.1, 1.5], [0, 9.6, -7.5, 3.6], [-6.4, 6.1, -4.6, 2.4], [6.5, 5.9, -4.4, 2.4]]) P.push([new THREE.IcosahedronGeometry(1, 1).scale(sc, sc * 0.26, sc * 0.9).translate(x, y, z), SMAT.moss]);
    for (let k = 0; k < 14; k++) { const len = 0.4 + lr() * 0.8; P.push([new THREE.ConeGeometry(0.07 + lr() * 0.1, len, 5).rotateX(Math.PI).translate(-2.4 + lr() * 4.8, 4.9 - len / 2, -3.6 + lr() * 5.2), IN]); }   // stalactites
    for (let k = 0; k < 9; k++) { const len = 0.6 + lr() * 1.0; P.push([new THREE.CylinderGeometry(0.02, 0.035, len, 4).translate(-3 + lr() * 6, 4.5 - len / 2, 2.6 + lr() * 0.7), SMAT.wood]); }   // roots hanging over the mouth
    // the giant's fire and his supper on the spit
    const fx = 2.0, fz = 0.4;
    for (let k = 0; k < 9; k++) { const q = (k / 9) * Math.PI * 2; boulder(P, fx + Math.cos(q) * 0.8, 0.12, fz + Math.sin(q) * 0.8, 0.2, RK); }
    for (let k = 0; k < 4; k++) P.push([new THREE.CylinderGeometry(0.07, 0.09, 1.0, 6).rotateZ(Math.PI / 2).rotateY(k * 0.8).translate(fx, 0.12, fz), GMAT.ember]);
    this.fire(ctx, fx, 0.2, fz, 1.2);
    for (const sx of [-1, 1]) P.push([new THREE.CylinderGeometry(0.06, 0.07, 1.35, 6).translate(fx + sx * 1.0, 0.67, fz), GMAT.oldWood]);
    P.push([new THREE.CylinderGeometry(0.035, 0.035, 2.3, 6).rotateZ(Math.PI / 2).translate(fx, 1.3, fz), GMAT.oldWood], [new THREE.IcosahedronGeometry(0.3, 1).scale(1.7, 0.75, 0.8).translate(fx, 1.24, fz), new THREE.MeshStandardMaterial({ color: 0x6b3a22, roughness: 0.7 })]);
    P.push([new THREE.CylinderGeometry(0.34, 0.4, 2.2, 9).rotateZ(Math.PI / 2).rotateY(0.3).translate(fx + 0.3, 0.36, fz + 1.9), GMAT.wood]);
    this.solid(ctx, fx, fz, 1.0, 1.3); this.solid(ctx, fx + 0.3, fz + 1.9, 0.8, 0.7);
    // his club against the wall, his bed of hides, the bones of his meals
    P.push([new THREE.CylinderGeometry(0.12, 0.3, 2.7, 7).rotateZ(0.25).translate(-3.3, 1.3, 1.3), GMAT.oldWood]); for (let k = 0; k < 4; k++) P.push([new THREE.ConeGeometry(0.06, 0.25, 4).rotateZ(Math.PI / 2 + 0.25).rotateY(k * 1.6).translate(-3.0, 2.2 + k * 0.12, 1.3), SMAT.bone]);
    P.push([uvBox(1.7, 0.14, 2.3).rotateY(0.3).translate(-2.2, 0.07, -1.5), new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 1 })], [new THREE.CylinderGeometry(0.25, 0.25, 1.4, 8).rotateZ(Math.PI / 2).rotateY(0.3).translate(-2.4, 0.3, -2.4), new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1 })]);
    for (let k = 0; k < 14; k++) P.push([new THREE.CylinderGeometry(0.05, 0.04, 0.4 + lr() * 0.6, 5).rotateZ(Math.PI / 2).rotateY(lr() * 3).translate(-1.6 + lr() * 1.4, 0.06 + lr() * 0.1, 1.0 + lr() * 1.2), SMAT.bone]);
    for (const [x, z] of [[-1.2, 1.6], [-0.6, 2.2]]) P.push([new THREE.IcosahedronGeometry(0.17, 1).scale(1, 0.9, 1.25).translate(x, 0.17, z), SMAT.bone]);
    for (const [x, z, r] of [[-4.5, 0, 2.6], [4.5, 0, 2.6], [0, -5.0, 3.2], [-4.5, -2.6, 2], [4.5, -2.6, 2], [-4.5, 2.0, 2], [4.5, 2.0, 2]]) this.solid(ctx, x, z, r);
    this.top(ctx, -3.5, 3.5, -4, 3, 4.6, true);
    // the carved stele at the back of the hollow
    const st = (g) => g.translate(0, 0, 0.0).rotateX(-0.12).translate(0, 0, -2.6);
    P.push([st(uvBox(1.6, 2.4, 0.35).translate(0, 1.2, 0)), GMAT.basalt], [uvBox(2.0, 0.3, 0.8).translate(0, 0.15, -2.6), RK]);
    for (const [w, h, x, y] of [[1.7, 0.12, 0, 2.42], [1.7, 0.12, 0, 0.05], [0.12, 2.4, -0.82, 1.2], [0.12, 2.4, 0.82, 1.2]]) P.push([st(uvBox(w, h, 0.4).translate(x, y, 0)), IN]);
    const glyphs = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.7), SMAT.glyph.clone()); glyphs.material.map = glyphTex(10 + i); glyphs.material.color.setHex(0xaee0ff); glyphs.material.emissive.setHex(0x60b0ff);
    glyphs.position.set(0, 1.25 * Math.cos(0.12) + 0.175 * Math.sin(0.12), -2.6 + 0.175 * Math.cos(0.12) - 1.25 * Math.sin(0.12) + 0.012); glyphs.rotation.x = -0.12; ctx.grp.add(glyphs);
    this.uses.push({ kind: 'carving', id: 'cave' + i, at: this.w(ctx, 0, -2.2), r: 2.4, glyphs, cave: s });
    this.finish(ctx, { r: 6 });
  }
  // ---- the summit of Olympos: a cairn of stones, a little marble altar with a fire that never goes out, and the bronze
  // eagle of Zeus on a column, looking out over the whole island
  summit(s) {
    const ctx = this.site(s, 0.3), P = ctx.P, lr = dice(77);
    for (let k = 0; k < 14; k++) { const a = lr() * 6.28, r = lr() * 1.1, y = 0.2 + Math.floor(k / 5) * 0.5; boulder(P, -3 + Math.cos(a) * r * (1 - y / 2), y, 1.5 + Math.sin(a) * r * (1 - y / 2), 0.35 + lr() * 0.2, SMAT.rock); }
    P.push([uvBox(1.6, 0.9, 1.0).translate(1.5, 0.45, -0.5), SMAT.marble], [uvBox(1.8, 0.14, 1.2).translate(1.5, 0.97, -0.5), SMAT.marble]);
    tripod(P, 1.5, 1.04, -0.5, 0.6); this.fire(ctx, 1.5, 1.7, -0.5, 0.8);
    column(P, -0.5, 0, -2.6, 3.2, 0.32, SMAT.marble);
    const ey = 3.3, E = GMAT.bronze;   // the eagle, wings half spread
    P.push([new THREE.SphereGeometry(0.32, 10, 8).scale(0.8, 0.9, 1.4).translate(-0.5, ey + 0.35, -2.6), E], [new THREE.SphereGeometry(0.16, 8, 6).translate(-0.5, ey + 0.72, -2.25), E], [new THREE.ConeGeometry(0.07, 0.2, 5).rotateX(Math.PI / 2).translate(-0.5, ey + 0.68, -2.06), GMAT.gold]);
    for (const sx of [-1, 1]) P.push([new THREE.BoxGeometry(1.3, 0.05, 0.5).translate(sx * 0.65, 0, 0).rotateZ(sx * 0.45).translate(-0.5 + sx * 0.18, ey + 0.55, -2.65), E]);
    this.solid(ctx, -3, 1.5, 1.2); this.solid(ctx, 1.5, -0.5, 1.0, 1.2); this.solid(ctx, -0.5, -2.6, 0.4);
    this.finish(ctx, { r: 4 });
  }
  // ---- queries
  // ground height at a site-local point, relative to the site (for things standing beyond its levelled pad)
  groundY(ctx, x, z) { const p = this.w(ctx, x, z); return heightAt(p.x, p.z) - ctx.s.y; }
  // a tree or bush from the vegetation set, standing at a site (drawn at any distance, unlike the streamed ones)
  plant(ctx, name, v, x, y, z, sc = 1) {
    const pg = propGeo(name, v), g = new THREE.Group(), I = new THREE.Matrix4();
    for (const [geo, mat] of [[pg.geo, propMat], pg.cards ? [pg.cards, pg.cardMat || leafMat] : null].filter(Boolean)) { const m = new THREE.InstancedMesh(geo, mat, 1); m.setMatrixAt(0, I); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; g.add(m); }
    g.position.set(x, y, z); g.scale.setScalar(sc); g.rotation.y = (v * 2.1 + x) % 6.28; ctx.grp.add(g); return g;
  }
  local(t, x, z) { const dx = x - t.ctx.s.x, dz = z - t.ctx.s.z, c = Math.cos(-t.ctx.rot), s = Math.sin(-t.ctx.rot); return [dx * c + dz * s, -dx * s + dz * c]; }
  floorAt(x, z, y, step = 0.6) { let best = -Infinity; for (const t of this.tops) { if (Math.abs(x - t.ctx.s.x) > 40 || Math.abs(z - t.ctx.s.z) > 40) continue; const [lx, lz] = this.local(t, x, z); if (lx >= t.x0 && lx <= t.x1 && lz >= t.z0 && lz <= t.z1) { const ty = t.ctx.s.y + t.y; if (ty <= y + step && ty > best) best = ty; } } return best; }
  underRoof(p) { for (const t of this.roofs) { if (Math.abs(p.x - t.ctx.s.x) > 40 || Math.abs(p.z - t.ctx.s.z) > 40) continue; const [lx, lz] = this.local(t, p.x, p.z); if (lx >= t.x0 && lx <= t.x1 && lz >= t.z0 && lz <= t.z1 && t.ctx.s.y + t.y > p.y + 1) return true; } return false; }
  nearSacredFire(p) { return this.lights.some((l) => l.distanceTo(p) < 6); }
  update(dt) {
    const t = performance.now() * 0.001, P = this.g.player.pos;
    this.flames.forEach((f, i) => { f.scale.set(1, 1 + Math.sin(t * 11 + i) * 0.12 + Math.sin(t * 5.3 + i * 2) * 0.08, 1); f.rotation.y = t * 0.6; });
    this.lights.forEach((p, i) => { if (p.distanceToSquared(P) < 80 * 80) askLight(p, 18 * (1 + Math.sin(t * 13 + i) * 0.08), 18); });
    for (const u of this.uses) if (u.glyphs) u.glyphs.material.emissiveIntensity = u.taken ? 0.15 : 1.2 + Math.sin(t * 2 + u.at.x) * 0.4;
    void dt;
  }
}
// A panel of carved marks (different for each tree or cave)
function glyphTex(seed) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 160; const g = c.getContext('2d'); let s = seed * 97 + 13; const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  g.strokeStyle = '#fff'; g.lineWidth = 5; g.lineCap = 'round';
  for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) { const x = 20 + col * 44, y = 22 + row * 36; g.beginPath(); const k = Math.floor(r() * 5);
    if (k === 0) { g.moveTo(x - 10, y - 10); g.lineTo(x + 10, y + 10); g.moveTo(x + 10, y - 10); g.lineTo(x - 10, y + 10); } else if (k === 1) { g.arc(x, y, 10, 0, 7); } else if (k === 2) { g.moveTo(x - 12, y + 10); g.lineTo(x, y - 12); g.lineTo(x + 12, y + 10); } else if (k === 3) { g.moveTo(x, y - 12); g.lineTo(x, y + 12); g.moveTo(x - 10, y); g.lineTo(x + 10, y); } else { g.moveTo(x - 12, y - 8); g.lineTo(x + 12, y - 8); g.lineTo(x - 12, y + 8); g.lineTo(x + 12, y + 8); }
    g.stroke(); }
  const t = new THREE.CanvasTexture(c); return t;
}
