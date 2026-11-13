// The trial's buildings and landmarks, built from a small Greek kit: fluted Doric columns, stepped platforms,
// entablatures with triglyphs, pediments and tiled roofs, rubble walls and great boulders. Each site is merged into a
// few meshes, registers what blocks you, what you can stand on and what keeps the rain off, and offers interactions.
import * as THREE from 'three';
import { SITES, HILL } from './sites.js';
import { clearGrass } from './grass.js';
import { loadFBX } from '../assets.js';
import { CLIPS } from '../player/hero.js';
import { askLight } from '../render/lights.js';
import { heightAt, PEAK, CAVE_FORM, caveShade } from './gen.js';
import { caveRock, densityAt, rayRock, surfaceFrom, roofAt, STEP } from './cave.js';
import { rockGround } from './terrain.js';
import { groundDetail } from '../render/core.js';
import { clamp } from '../util/math.js';
import { propGeo, propMat, leafMat } from './trees.js';
import { GMAT, amphora, pithos, bowl, jug, tripod, acroterion, antefixes, cartWheel, firewood, leaves, mist, dice } from './greek.js';
import { wettable } from './wetness.js';
import { siteProp, sitePropAt, piece, pieceAt, hasPiece, chestParts } from './site-pack.js';
import { buildTown, buildSpot } from './town.js';

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
// the temple's precinct: big worn slabs of pale marble in courses of different lengths, fine joints, faint veins, darker
// where feet have worn them and a little lichen in the corners (its own dice, as above)
const pavingTex = canvasTex((g, n) => {
  let ps = 7; const pr = () => ((ps = (ps * 16807) % 2147483647) - 1) / 2147483646;
  g.fillStyle = '#7d766a'; g.fillRect(0, 0, n, n); const rows = 4, h = n / rows;
  for (let r = 0; r < rows; r++) { let x = -pr() * 120; while (x < n) { const w = 110 + pr() * 150, v = 196 + pr() * 34;
    for (const dx of [0, -n, n]) { g.fillStyle = `rgb(${v},${v - 5},${v - 15})`; g.fillRect(x + dx + 2, r * h + 2, w - 4, h - 4); }
    for (let i = 0; i < 26; i++) { const t = pr() < 0.6; g.fillStyle = t ? `rgba(150,140,122,${pr() * 0.16})` : `rgba(255,252,240,${pr() * 0.12})`; g.beginPath(); g.arc(x + pr() * w, r * h + pr() * h, 3 + pr() * 18, 0, 7); g.fill(); }
    g.strokeStyle = `rgba(120,110,95,${0.1 + pr() * 0.12})`; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + pr() * w, r * h); g.bezierCurveTo(x + pr() * w, r * h + h * 0.3, x + pr() * w, r * h + h * 0.7, x + pr() * w, r * h + h); g.stroke();
    if (pr() < 0.25) { g.fillStyle = 'rgba(96,108,70,.22)'; g.beginPath(); g.arc(x + (pr() < 0.5 ? 6 : w - 6), r * h + (pr() < 0.5 ? 6 : h - 6), 4 + pr() * 9, 0, 7); g.fill(); }
    x += w; } }
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
// A flame: a teardrop, white-hot at its heart, orange at its edges, fading out at the tip and the sides, drawn on three
// crossed cards (fire() turns and stretches them as it flickers): reads as fire from any side, at six triangles a fire
function flameTex() {
  const W = 64, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = Math.abs(x / (W - 1) - 0.5) * 2, v = 1 - y / (H - 1), w = 0.92 * Math.pow(v < 0.28 ? Math.sqrt(v / 0.28) : (1 - v) / 0.72, 0.85), d = w > 0 ? u / w : 9;
    const a = Math.pow(Math.max(0, 1 - d), 1.4) * Math.min(1, (1 - v) * 3), h = Math.min(1, d * 1.1 + v * 0.7), i = (y * W + x) * 4;
    im.data.set([255, Math.round(245 - 125 * h), Math.round(205 - 180 * h), Math.round(a * 255)], i);
  }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const FLAME_GEO = (() => { const parts = [0, 1, 2].map((k) => new THREE.PlaneGeometry(0.62, 0.95).translate(0, 0.42, 0).rotateY((k * Math.PI) / 3)), out = new THREE.BufferGeometry();
  for (const a of ['position', 'normal', 'uv']) { const n = parts[0].attributes[a].itemSize, arr = new Float32Array(parts.length * parts[0].attributes[a].count * n); parts.forEach((q, j) => arr.set(q.attributes[a].array, j * q.attributes[a].array.length)); out.setAttribute(a, new THREE.BufferAttribute(arr, n)); }
  const idx = []; parts.forEach((q, j) => q.index.array.forEach((i) => idx.push(i + j * q.attributes.position.count))); out.setIndex(idx); return out; })();
// An Italian cypress, the tree of the Greek sanctuaries (the packs have none: their "cypress" is a spreading pine): a dark
// spire of foliage, widest a quarter of the way up and a little lumpy, on a short trunk, about 11 m tall; vertex-coloured
// (dark: our light brightens vertex colours a lot), cut into facets like the packs' trees, drawn instanced (cypresses())
const CYPRESS = (() => {
  const H = 11, R = 1.15, N = 16, f = (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t / 0.28) / 2), 0.55) * Math.pow(1 - t, 0.85), top = Math.max(...Array.from({ length: N + 1 }, (_, i) => f(i / N)));
  const crown = new THREE.LatheGeometry(Array.from({ length: N + 1 }, (_, i) => new THREE.Vector2((R * f(i / N)) / top, 0.7 + (i / N) * (H - 0.7))), 9).toNonIndexed(), trunk = new THREE.CylinderGeometry(0.15, 0.24, 1.3, 6).translate(0, 0.45, 0).toNonIndexed();
  const p = crown.attributes.position;   // (the bumps depend only on where a corner is, so the faces sharing it stay joined)
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.14 * Math.sin(x * 3.1 + y * 1.7) * Math.cos(z * 2.9 - y * 1.3) + 0.07 * Math.sin(y * 5.3 + x * 4 + z * 2.2); p.setXYZ(i, x * n, y, z * n); }
  const parts = [[crown, (y, h) => { const k = (0.62 + 0.38 * (y / H)) * (0.86 + 0.28 * h); return [0.026 * k, 0.05 * k, 0.03 * k]; }], [trunk, () => [0.06, 0.042, 0.03]]];
  for (const [g, col] of parts) { const q = g.attributes.position, c = new Float32Array(q.count * 3); for (let i = 0; i < q.count; i += 3) { const y = (q.getY(i) + q.getY(i + 1) + q.getY(i + 2)) / 3, h = Math.abs(Math.sin(q.getX(i) * 12.9 + y * 78.2 + q.getZ(i) * 37.7) * 43758.5) % 1; for (let k = 0; k < 3; k++) c.set(col(y, h), (i + k) * 3); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); g.computeVertexNormals(); }
  const out = new THREE.BufferGeometry(); for (const a of ['position', 'normal', 'color']) { const A = parts.map(([g]) => g.attributes[a].array), arr = new Float32Array(A[0].length + A[1].length); arr.set(A[0]); arr.set(A[1], A[0].length); out.setAttribute(a, new THREE.BufferAttribute(arr, 3)); }
  out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2)); return out;
})();
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
  flame: new THREE.MeshBasicMaterial({ map: flameTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),   // (on fire()'s crossed cards)
  glyph: new THREE.MeshStandardMaterial({ color: 0xffe7a0, emissive: 0xffc860, emissiveIntensity: 1.6, transparent: true, opacity: 0.9 }),
  flags: new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.95, color: 0xb9ab96 }),
  bone: new THREE.MeshStandardMaterial({ color: 0xd9cfb4, roughness: 0.75 }),
  paving: new THREE.MeshStandardMaterial({ map: pavingTex, roughness: 0.78, color: 0xbab3a6, envMapIntensity: 0.4 }),   // (a shade under the walls' marble: a whole plaza of it in the sun)
  // a Giant's cave: the stone dripped down from its roof (dark: it hangs in the dark), his supper, his hides and straw,
  // the roots over its mouth
  // (the sky's reflections taken down on all of them: they stand in the dark; the mushrooms glow faintly)
  drip: new THREE.MeshStandardMaterial({ color: 0x6a625a, roughness: 0.8, flatShading: true, envMapIntensity: 0.3 }),
  grit: new THREE.MeshStandardMaterial({ color: 0x48423c, roughness: 0.9, flatShading: true, envMapIntensity: 0.2 }),
  caveWood: new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9, envMapIntensity: 0.15 }),
  meat: new THREE.MeshStandardMaterial({ color: 0x5a2c18, roughness: 0.6, envMapIntensity: 0.2 }),
  hide: new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 1, flatShading: true, envMapIntensity: 0.15 }),
  hide2: new THREE.MeshStandardMaterial({ color: 0x6e6252, roughness: 1, flatShading: true, envMapIntensity: 0.15 }),
  hide3: new THREE.MeshStandardMaterial({ color: 0x3e3129, roughness: 1, flatShading: true, envMapIntensity: 0.15 }),
  straw: new THREE.MeshStandardMaterial({ color: 0x7a6640, roughness: 1, flatShading: true, envMapIntensity: 0.15 }),
  root: new THREE.MeshStandardMaterial({ color: 0x3b2e22, roughness: 0.95 }),
  glowCap: new THREE.MeshStandardMaterial({ color: 0xbfe6d6, emissive: 0x4cc8a8, emissiveIntensity: 0.8, roughness: 0.6 }),
};
for (const [k, o] of Object.entries({ marble: [0.72, 0.28], paving: [0.7, 0.3], stone: [0.66, 0.28], moss: [0.7, 0.45], tile: [0.68, 0.3], frieze: [0.72, 0.3], dark: [0.68, 0.3], rock: [0.66, 0.26], wood: [0.62, 0.32], plaster: [0.72, 0.35], flags: [0.66, 0.26], bone: [0.75, 0.35] })) wettable(SMAT[k], { dark: o[0], gloss: o[1] });   // (wetness.js)
const _nav = new THREE.Vector3();
// the bones of the beasts' meals (other packs' models, site-pack.js), and the pack's pieces grown over with moss (the shrine's)
const BONES = ['all/pnb-swamp-marshland/sm-prop-bone-pile-01', 'all/pnb-swamp-marshland/sm-prop-bone-ribcage-01', 'all/pnb-swamp-marshland/sm-prop-bone-pile-02', 'all/pnb-swamp-marshland/sm-prop-bone-skull-01'];
// the pieces a Giant's cave takes from the packs (site-pack.js loads them): his fire, the bones of big beasts, skulls
const CAVE_PK = { fire: 'all/polygonnature/sm-prop-campfire-01', bones: 'all/pnb-arid-desert/sm-prop-bones-01', bones2: 'all/pnb-arid-desert/sm-prop-bones-04', skull: 'all/polygonnature/sm-prop-skull-01', skull2: 'all/polygongeneric/sm-gen-prop-skull-01' };
const MOSSY = new Map(), mossy = (m) => { if (!MOSSY.has(m)) MOSSY.set(m, wettable(new THREE.MeshStandardMaterial({ map: m.map, color: 0x7d8a6a, roughness: 0.95 }), { dark: 0.7, gloss: 0.4 })); return MOSSY.get(m); };
// how far off each kind of site is drawn: the landmarks you find your way by far out under the mist, the minor sites
// (the farmhouse, the olive markers, the caves) only a little way beyond it
const VIEW_R = { temple: 1700, labyrinth: 1400, chimera: 1200, house: 220, peak: 600, olive: 220, cave: 220, town: 650, spot: 260 };
// The pack's temple is converted at half the demo scene's size (tools/assets/manifest.json plTemple) and stood here TK
// times as big; its plan (templeHall) is written at the converted size and grown by this. At 2.25 it is near the real
// thing, a little larger, as games make their landmarks: its platform 44 × 57 m (the Parthenon's 31 × 70, Zeus's
// temple at Olympia 28 × 64), its outer columns 13 m (theirs 10.4-10.5 m), seven times the hero's 1.9 m; the cella's
// door 5.6 × 10.3 m (the Parthenon's about 4.9 × 10, five times a man), Zeus 9 m in a hall 12 m high (Olympia's sat
// 12.4 m under his roof). Level designers grow a third-person world's spaces 1.3-2 times for the camera's sake; here
// only the building grows: the tables, jars and braziers inside keep the size of things made for people (FK).
// Sources: worldhistory.org/parthenon; en.wikipedia.org/wiki/Temple_of_Zeus,_Olympia; gamesradar.com, "Why are the
// doors so big in video games?"; at 1.5 (Patch 16) players found it too small beside the hero and the house across the meadow.
const TK = 2.25, FK = 1.5;

// ---- kit: every helper pushes [geometry, material] onto a list in site-local coordinates
const uvBox = (w, h, d, s = 1 / 3) => { const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, nn = g.attributes.normal; for (let i = 0; i < uv.count; i++) { const ax = Math.abs(nn.getX(i)), ay = Math.abs(nn.getY(i)); uv.setXY(i, uv.getX(i) * (ax > 0.5 ? d : w) * s, uv.getY(i) * (ay > 0.5 ? d : h) * s); } return g; };
function column(P, x, y, z, h, r, mat = SMAT.marble, broken = 0) {
  if (!broken && mat === SMAT.marble) { const pk = siteProp('column', h, r * 2.5); if (pk) { P.push([pk[0].translate(x, y, z), pk[1]]); return; } }   // (the pack's marble column: site-pack.js)
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
// a stalactite or stalagmite, L long, r across at its root (at the origin, its point up), lumpy and a little bent: the
// bumps depend only on where a vertex is, as the boulders' do, so the faces stay joined
function drip(L, r, k) {
  const g = new THREE.CylinderGeometry(r * 0.16, r, L, 7, 5).translate(0, L / 2, 0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = 1 + 0.28 * Math.sin(y * 9 + k) + 0.18 * Math.sin(x * 23 + z * 17 + k), b = (y / L) ** 2 * L * 0.12; p.setXYZ(i, x * f + Math.sin(k) * b, y, z * f + Math.cos(k) * b); }
  g.computeVertexNormals(); return g;
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

// ---- the light over an offering stand while its boss's head is carried (trial.js shows it, update() moves it): a soft
// column of gold rising from the tray, high enough to stand over the temple's roof from across the meadow (a strip turned
// to face the camera), a ring pulsing out over the ground round the stand, and sparks drifting up. Kept out of the site's
// group (it would count in the mist's ceiling, tallestNear), at p, the stand's foot in the world, turned rot.
const beamTex = (() => { const W = 32, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const up = 1 - y / H, a = Math.exp(-((x / (W - 1) - 0.5) ** 2) / 0.045) * (up < 0.14 ? 0.35 + 0.65 * (up / 0.14) : Math.pow((1 - up) / 0.86, 1.3)) * Math.min(1, up / 0.02), i = (y * W + x) * 4; im.data.set([255, 236, 170, Math.round(a * 255)], i); }   // (gentler at its foot, brightest a few metres up)
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const glow = (o) => ({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, ...o });
const sparkMat = new THREE.PointsMaterial(glow({ color: 0xffe9a0, size: 0.16, side: THREE.FrontSide }));
const SPARKS = 40;
function beacon(scene, p, rot) {
  const b = new THREE.Group(); b.position.copy(p); b.rotation.y = rot; b.visible = false; scene.add(b);
  const col = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 34).translate(0, 17 + 1.6, 0), new THREE.MeshBasicMaterial(glow({ map: beamTex, color: 0xfff0b8 })));
  col.add(new THREE.Mesh(new THREE.PlaneGeometry(10, 34).translate(0, 17 + 1.6, -0.05), new THREE.MeshBasicMaterial(glow({ map: beamTex, color: 0xffd860, opacity: 0.22 }))));   // (and a wide, faint halo)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.88, 1.0, 48).rotateX(-Math.PI / 2).translate(0, 0.06, 0), new THREE.MeshBasicMaterial(glow({ color: 0xffc860 })));
  const sp = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3)), sparkMat);
  for (const o of [col, ring, sp]) { o.frustumCulled = false; o.renderOrder = 5; b.add(o); }
  b.userData = { col, ring, sp }; return b;
}
function moveBeacon(b, t, cam) {
  const { col, ring, sp } = b.userData, k = (t * 0.55) % 1; ring.scale.setScalar(1 + k * 1.8); ring.material.opacity = (1 - k) * 0.85;
  if (cam) col.rotation.y = Math.atan2(cam.x - b.position.x, cam.z - b.position.z) - b.rotation.y; col.material.opacity = 0.75 + 0.2 * Math.sin(t * 2.4);
  const p = sp.geometry.attributes.position; for (let i = 0; i < SPARKS; i++) { const f = (t * 0.22 + i / SPARKS) % 1, a = i * 2.4 + t * (0.6 + (i % 3) * 0.2), r = 0.25 + 0.45 * Math.sin(i * 1.7 + f * 3); p.setXYZ(i, Math.cos(a) * r, 1.8 + f * 6, Math.sin(a) * r); }
  p.needsUpdate = true;
}

export class Structures {
  constructor(g) {
    this.g = g; this.groups = []; this.solids = []; this.tops = []; this.roofs = []; this.uses = []; this.lights = []; this.flames = [];
    this.build();
  }
  // register helpers (site-local → world, sites only rotate about y)
  site(s, rot = 0) { const grp = new THREE.Group(); grp.position.set(s.x, s.y, s.z); grp.rotation.y = rot; grp.userData.viewR = VIEW_R[s.kind] ?? 800; this.g.scene.add(grp); this.groups.push(grp); return { grp, s, rot, P: [] }; }
  // sites far off are not drawn at all (the haze has them long before): checked twice a second
  cull(cam, dt) { this.cam = cam; this.cullT = (this.cullT || 0) - dt; if (this.cullT > 0) return; this.cullT = 0.5; for (const g of this.groups) g.visible = g.position.distanceTo(cam) < g.userData.viewR * (1 + Math.max(0, cam.y - 60) / 200); }
  // the top of the tallest site building within r of pos (for the mist's ceiling), or -Infinity
  tallestNear(pos, r) {
    let top = -Infinity;
    for (const g of this.groups) { if (Math.hypot(g.position.x - pos.x, g.position.z - pos.z) > r + 30) continue; g.userData.top ??= new THREE.Box3().setFromObject(g).max.y; top = Math.max(top, g.userData.top); }
    return top;
  }
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
  fire(ctx, x, y, z, big = 1) { const f = new THREE.Group(); f.position.set(x, y, z); const c1 = new THREE.Mesh(FLAME_GEO, SMAT.flame); c1.scale.setScalar(big); f.add(c1); ctx.grp.add(f); this.flames.push(f); this.lights.push(this.w(ctx, x, z, y + 0.6)); }
  build() {
    const S = SITES;
    if (S.temple) this.temple(S.temple);
    if (S.house) this.house(S.house);
    if (S.labyrinth) this.labyrinth(S.labyrinth);
    if (S.chimera) this.shrine(S.chimera);
    S.olives.forEach((o, i) => this.olive(o, i));
    S.caves.forEach((c, i) => this.cave(c, i));
    if (S.peak) this.summit(S.peak);
    if (S.town) buildTown(this, S.town);   // (last: they throw dice of their own, so the places above keep theirs)
    for (const sp of S.spots) buildSpot(this, sp);
    const col = this.solids.map((c) => ({ ...c, ref: { site: true } })); this.g.colliders.addGroup('sites', col);
  }
  // ---- the Ancient Temple of Zeus: a peripteros on its stepped platform (the pack's own, templeHall, or a carved one) on
  // the flat top of its hill (sites.js HILL), in a precinct paved with marble: the offering stands either side of the
  // steps, the altar on its stepped base before them, statues where the sacred way comes up onto the plaza, and the way
  // itself, paved and kerbed between cypresses, down the hill's front to a gateway and a pair of lions at its foot. A grove
  // frames it all: olives and planes on the hilltop round the plaza, a dark row of cypresses behind the temple (its
  // silhouette stands against them from the front), myrtle and lavender along the kerbs. Fire bowls burn by the altar and
  // beside each stand, so from across the meadow they read as the places to bring something; while a boss's head is
  // carried, a column of light stands over its stand (beacon, lit by trial.js).
  temple(s) {
    const ctx = this.site(s, Math.atan2(-s.x, -s.z)), P = ctx.P, gy = (x, z) => this.groundY(ctx, x, z);     // the front faces the way you came from (the spawn)
    const W = 13, D = 21, pack = hasPiece('plTemple');   // (the carved hall's size: what stands before it is laid out by it)
    if (pack) this.templeHall(ctx); else this.templeCarved(ctx, W, D);
    // The plaza: from PB behind the temple to PF in front, PX either side, its floor PY over the hilltop (all of it inside
    // the hill's flat top); where the platform's lowest step ends at the front (F), how far out the offering stands flank
    // the way up (SX), the altar (az), and half the sacred way's width (WW), to where it ends at the hill's foot (WE)
    const PX = 31, PB = 37, PF = 47, PY = 0.08, F = pack ? 12.66 * TK : D / 2 + 1.8, SX = pack ? 9 : W / 2 + 0.5, az = F + 11, WW = 2.6, WE = HILL.z + HILL.r1 + 3;
    P.push([uvBox(2 * PX, 0.5, PB + PF, 1 / 6).translate(0, PY - 0.25, (PF - PB) / 2), SMAT.paving]); this.top(ctx, -PX, PX, -PB, PF, PY);
    // its kerb: a border of dressed stone a hand high (walked over), open where the sacred way comes in, and down the
    // middle a strip of warmer flagstones from the way to the temple's steps
    const KB = 0.7, KY = 0.22, kerb = (x0, x1, z0, z1) => { P.push([uvBox(x1 - x0, 0.6, z1 - z0, 1 / 2).translate((x0 + x1) / 2, KY - 0.3, (z0 + z1) / 2), GMAT.ashlar]); this.top(ctx, x0, x1, z0, z1, KY); };
    kerb(-PX - KB, -PX, -PB - KB, PF + KB); kerb(PX, PX + KB, -PB - KB, PF + KB); kerb(-PX, PX, -PB - KB, -PB); kerb(-PX, -WW - 0.4, PF, PF + KB); kerb(WW + 0.4, PX, PF, PF + KB);
    P.push([uvBox(2 * WW, 0.1, PF - F + 0.4, 1 / 2.4).translate(0, PY - 0.02, (PF + F) / 2), SMAT.flags]);
    // a fire bowl on a slender marble stand (the pack's), or a bronze tripod, burning
    const fireBowl = (x, z, y = PY) => {
      if (hasPiece('plFireBowl')) { P.push(...piece('twPlinth', x, y - 0.1, z, 0, 1.35), ...piece('plFireBowl', x, y + 1.24, z, 0, 0.8)); this.fire(ctx, x, y + 1.5, z, 0.85); }
      else { tripod(P, x, y, z, 1.1); this.fire(ctx, x, y + 1.25, z, 0.8); }
      this.solid(ctx, x, z, 0.45, 1.8, y); };
    // the altar before the steps, with an undying fire: pray here. It stands a third bigger than a person's altar, on a
    // base of two broad steps, so it holds its own before so big a temple
    const AS = 1.35, ay = PY + 0.48, A = (g) => g.translate(0, 0, -az).scale(AS, AS, AS).translate(0, ay, az);
    for (const [w, d, h] of [[7.6, 5.8, 0.24], [6.0, 4.4, 0.48]]) { P.push([uvBox(w, h + 0.3, d, 1 / 2).translate(0, PY + h / 2 - 0.15, az), SMAT.marble]); this.top(ctx, -w / 2, w / 2, az - d / 2, az + d / 2, PY + h); }
    P.push([A(uvBox(2.6, 1.1 + 0.6, 1.6).translate(0, 0.55 - 0.3, az)), SMAT.marble], [A(uvBox(2.9, 0.18, 1.9).translate(0, 1.19, az)), SMAT.marble]);
    P.push([A(new THREE.CylinderGeometry(0.55, 0.4, 0.35, 12).translate(0, 1.45, az)), SMAT.bronze]); this.fire(ctx, 0, ay + 1.6 * AS, az, 1.3 * AS);
    P.push([A(uvBox(2.62, 0.16, 1.62).translate(0, 0.86, az)), GMAT.tymp]); for (const sx of [-1, 1]) P.push([A(new THREE.CylinderGeometry(0.16, 0.16, 1.64, 10).rotateX(Math.PI / 2).translate(sx * 1.3, 1.02, az)), SMAT.marble]);   // painted band, volutes
    this.solid(ctx, 0, az, 1.3 * AS, 1.3 * AS, ay); this.top(ctx, -1.45 * AS, 1.45 * AS, az - 0.95 * AS, az + 0.95 * AS, ay + 1.28 * AS);
    this.uses.push({ kind: 'altar', at: this.w(ctx, 0, az, ay), r: 3.4 });
    for (const sx of [-1, 1]) fireBowl(sx * 3.3, az + 0.2, PY + 0.24);
    // two statues where the way comes up onto the plaza, a hoplite and a soldier on tall pedestals, facing across it
    for (const sx of [-1, 1]) {
      const x = sx * (WW + 2.4), z = PF - 2.4, y = PY, k = 1.3;
      P.push([uvBox(1.1 * k, 1.4 * k, 1.1 * k).translate(x, y + 0.7 * k, z), SMAT.marble], [uvBox(1.3 * k, 0.2 * k, 1.3 * k).translate(x, y + 1.5 * k, z), SMAT.marble], [uvBox(1.3 * k, 0.2 * k, 1.3 * k).translate(x, y + 0.1 * k, z), GMAT.ashlar]);
      const pk = siteProp(sx > 0 ? 'hoplite' : 'soldier', 2.15 * k); if (pk) P.push([pk[0].rotateY(-sx * Math.PI / 2).translate(x, y + 1.6 * k, z), pk[1]]); else statue(ctx.grp, x, y + 1.6 * k, z, 1.1 * k, -sx * Math.PI / 2, { pose: sx > 0 ? 0.55 : 0.75, bolt: false }); this.solid(ctx, x, z, 0.75 * k);
    }
    // two offering stands for the heads, flanking the steps: a marble pier on a footing, the beast's emblem in gold on its
    // face, a bronze tray on top for the head, and a fire bowl burning either side
    for (const [k, sx] of [['minotaur', -1], ['chimera', 1]]) {
      const x = sx * SX, z = F + 3.2, y = PY, S = (g) => g.translate(x, y, z);
      P.push([S(uvBox(1.6, 0.75, 1.6).translate(0, -0.075, 0)), GMAT.ashlar], [S(uvBox(1.0, 1.15, 1.0).translate(0, 0.875, 0)), SMAT.marble], [S(uvBox(1.4, 0.18, 1.4).translate(0, 1.54, 0)), SMAT.marble]);
      P.push([S(new THREE.CylinderGeometry(0.6, 0.52, 0.08, 20).translate(0, 1.67, 0)), GMAT.bronze]);
      const sym = piece(k === 'minotaur' ? 'plSymMinotaur' : 'plSymChimera', 0, 0, 0, 0, 0.82); if (sym.length) P.push(...sym.map(([g]) => [S(g.translate(0, 0.42, 0.505)), GMAT.gold]));
      this.solid(ctx, x, z, 0.8, 1.75, y); const mount = new THREE.Group(); mount.position.set(x, y + 1.71, z); ctx.grp.add(mount);
      for (const dx of [-1.45, 1.45]) fireBowl(x + dx, z);
      this.uses.push({ kind: 'offering', boss: k, at: this.w(ctx, x, z, y), r: 2.4, mount, beacon: beacon(this.g.scene, this.w(ctx, x, z, y), ctx.rot) });
    }
    // the sacred way down the hill: slabs laid along the ground in 2 m lengths, each tilted to the slope (and lifted to its
    // highest point across the way, so the land never shows through), between kerbs
    for (let z = PF + KB; z < WE; z += 2) {
      const hi = (zz) => Math.max(gy(-WW, zz), gy(0, zz), gy(WW, zz)), y0 = hi(z), y1 = hi(z + 2), a = Math.atan2(y0 - y1, 2), L = Math.hypot(2, y1 - y0) + 0.08, seg = (g) => g.rotateX(a).translate(0, (y0 + y1) / 2 + 0.06, z + 1);
      P.push([seg(uvBox(2 * WW, 0.3, L, 1 / 2.4).translate(0, -0.15, 0)), SMAT.flags]);
      for (const sx of [-1, 1]) P.push([seg(uvBox(0.4, 0.5, L, 1 / 2).translate(sx * (WW + 0.2), -0.12, 0)), GMAT.ashlar]);
    }
    { const c = this.w(ctx, 0, (PF + WE) / 2); clearGrass('templeWay', { x: c.x, z: c.z, hw: WW + 0.8, hd: (WE - PF) / 2 + 1, rot: ctx.rot }); }
    // its gateway at the foot: two marble columns and a lintel over the way, and a pair of marble lions outside, looking out
    { const z = WE - 0.6, y = Math.min(gy(-WW - 0.7, z), gy(WW + 0.7, z)) - 0.1, H = 6.4;
      for (const sx of [-1, 1]) { P.push([uvBox(1.7, 0.5, 1.7).translate(sx * (WW + 0.7), y + 0.25, z), GMAT.ashlar]); column(P, sx * (WW + 0.7), y + 0.5, z, H, 0.55); this.solid(ctx, sx * (WW + 0.7), z, 0.65); }
      P.push([uvBox(2 * WW + 3.4, 0.75, 1.5).translate(0, y + 0.5 + H + 0.37, z), SMAT.marble], [uvBox(2 * WW + 3.5, 0.1, 1.55).translate(0, y + 0.5 + H + 0.1, z), GMAT.gold]);
      for (const sx of [-1, 1]) { const x = sx * (WW + 3.0), zz = z + 2.2, yy = gy(x, zz), pk = siteProp('lion', 1.9); if (!pk) break;
        P.push([uvBox(1.2, 0.8, 1.95).translate(x, yy - 0.05, zz), SMAT.marble], [pk[0].translate(x, yy + 0.35, zz), pk[1]]); this.solid(ctx, x, zz, 0.95, 2.3, yy); } }
    // the grove: Italian cypresses lining the way and in a row behind the temple, olives down the plaza's sides and at its front
    // corners, plane trees at its back corners, myrtle along the side kerbs and lavender along the back and by the way
    const avenue = []; for (let z = PF + 5; z < WE - 3; z += 6) for (const sx of [-1, 1]) avenue.push([sx * (WW + 2.2), z, 1, 0.92 + ((z * 0.37) % 0.18)]);
    const behind = []; for (let x = -PX - 4; x <= PX + 4; x += 5.2) behind.push([x, -PB - 7 - Math.abs(Math.sin(x)) * 2.5, 1.1, 1.05 + Math.abs(Math.cos(x * 1.7)) * 0.3]);
    this.cypresses(ctx, [...avenue, ...behind]);
    const olives = []; for (const sx of [-1, 1]) for (const [x, z, i] of [[PX + 9, -24, 0], [PX + 9, -6, 1], [PX + 9, 12, 2], [PX + 9, 30, 0], [PX + 8, PF + 4, 1]]) olives.push([i, sx * x, z, 1.3 + i * 0.07]);
    for (const v of [0, 1, 2]) this.grove(ctx, 'olive', v, olives.filter((o) => o[0] === v).map((o) => o.slice(1)), 0.5);
    this.grove(ctx, 'plane', 0, [-1, 1].map((sx) => [sx * (PX + 10), -PB - 4, 1.15]), 0.55);
    const myrtle = [], lav = []; for (const sx of [-1, 1]) { for (let z = -PB + 3; z < PF; z += 6.5) myrtle.push([sx * (PX + 2.2), z, 1.1]); for (let z = PF + KB + 1.6; z < HILL.z + HILL.r0; z += 2.4) lav.push([sx * (WW + 1.1), z, 1]); }
    for (let x = -PX + 3; x < PX; x += 6.5) lav.push([x, -PB - KB - 1.4, 1.05]);
    this.grove(ctx, 'myrtle', 0, myrtle); this.grove(ctx, 'lavender', 0, lav.filter((_, i) => i % 2)); this.grove(ctx, 'lavender', 1, lav.filter((_, i) => !(i % 2)));
    this.templeCtx = ctx; this.finish(ctx, { w: 2 * (PX + KB), d: PB + PF + 2 * KB, z: (PF - PB) / 2 });
  }
  // The temple from the pack's demo scene (its "Parthenon", tools/assets/manifest.json plTemple: put together from the scene
  // at half its size, stood here TK times bigger): eight columns by eleven round a platform stepped all round, the cella
  // raised on a plinth inside with stairs at both ends, painted walls, an inner colonnade and a back room, the roof's tiles,
  // pediments and gilded acroteria. Walking and blocking follow its plan, written below at the converted size (measured
  // off the model): the platform 19.7 × 25.3, eight steps a little under a tenth high all round up to the peristyle floor
  // at 0.79, the plinth at 1.55 (|x| 5.6, |z| 7.6) with stairs of seven more such steps at both ends, the cella's walls
  // (its door 2.5 wide in the middle of the front wall), the inner wall to the back room and the back room's own wall to
  // the back porch, whose doors the pack made too low for anyone: both cut out (with their stretch of wall) for doorways as
  // big as the front one, framed in marble. The inner colonnade the pack built in two tiers of posts a few hands thick,
  // which beside the hero read as sticks: taken out for single columns from the floor to the beams, as thick as a man.
  // Inside: Zeus on the dais, tripods burning by him, a runner down the hall between braziers, offering tables and heaped
  // jars in the aisles, banners on the walls; the back room a treasury of jars, a table of offerings and a fire. The
  // furnishings keep the size of things made for people (FK), only their places grow with the hall.
  templeHall(ctx) {
    const P = ctx.P, K = TK;
    const top = (x0, x1, z0, z1, y, roof) => this.top(ctx, x0 * K, x1 * K, z0 * K, z1 * K, y * K, roof), solid = (x, z, r, h = 99, y = 0) => this.solid(ctx, x * K, z * K, r * K, h * K, y * K);
    const wall = (x0, z0, x1, z1, h, t) => this.wall(ctx, x0 * K, z0 * K, x1 * K, z1 * K, h * K, t * K), put = (k, x, y, z, rot = 0, s = 1) => P.push(...piece(k, x * K, y * K, z * K, rot, s * FK));
    const cut = [[-1.875, 1.875, 1.52, 6.0, -2.95, -2.05], [-1.875, 1.875, 1.58, 6.0, -6.7, -5.8]];   // the two doorways
    for (const sx of [-1, 1]) for (const [z0, z1] of [[-6.15, -2.62], [-2.38, 6.15]]) cut.push([sx > 0 ? 2.75 : -3.6, sx > 0 ? 3.6 : -2.75, 1.556, 6.38, z0, z1]);   // the inner colonnade
    P.push(...pieceAt('plTemple', 0, 0, 0, 0, K, cut));
    // its footing, where the land falls away from the platform's corners
    P.push([uvBox(18.7 * K, 3, 24.94 * K).translate(0, -1.5, 0), GMAT.ashlar]);
    const ST = [0.138, 0.231, 0.325, 0.419, 0.513, 0.607, 0.7, 0.794];
    ST.forEach((y, i) => top(-9.84 + i * 0.155, 9.84 - i * 0.155, -12.66 + i * 0.159, 12.66 - i * 0.159, y));             // the krepis, stepped all round
    top(-5.63, 5.63, -7.65, 7.65, 1.548);                                                                                 // the plinth
    for (let j = 1; j < 8; j++) { const e = 8.75 - (j - 1) * 0.157; top(-5.55, 5.55, 7.5, e, 0.794 + 0.0934 * j); top(-5.55, 5.55, -e, -7.5, 0.794 + 0.0934 * j); }   // its stairs
    top(-8.13, 8.13, -11.25, 11.25, 6.75, true);                                                                          // under the roof
    // the columns: eight by eleven round the peristyle, six in each porch, the cella's two rows (in the hall and the back room)
    const ring = [[1.1, 10.65], [3.25, 10.65], [5.4, 10.65], [7.5, 10.65], ...[0, 2.15, 4.3, 6.45, 8.6].map((z) => [7.5, z])];
    for (const [x, z] of ring) for (const sx of [-1, 1]) for (const sz of z ? [-1, 1] : [1]) solid(sx * x, sz * z, 0.42);
    for (const x of [1.1, 3.25, 5.4]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid(sx * x, sz * 8.65, 0.42);
    const fl = 1.548, beam = 6.4;   // (the hall's floor, on the plinth, and the underside of the beams across it)
    for (const sx of [-1, 1]) {
      for (const z of [-1.25, 0, 1.25, 2.5, 3.75, 5.0]) { column(P, sx * 3.13 * K, fl * K, z * K, (beam - fl) * K, 0.27 * K); solid(sx * 3.13, z, 0.3); }
      for (const z of [-5.625, -4.375, -3.125]) { column(P, sx * 3.2 * K, fl * K, z * K, (beam - fl) * K, 0.22 * K); solid(sx * 3.2, z, 0.25); }
    }
    // the cella's walls (from the ground: the porch-ends of the plinth and its stairs' parapets are too high to step up)
    for (const sx of [-1, 1]) { wall(sx * 5.63, -7.5, sx * 5.63, -6.25, 1.5, 0.2); wall(sx * 5.63, -6.25, sx * 5.63, 6.25, 99, 0.25); wall(sx * 5.63, 6.25, sx * 5.63, 7.5, 1.5, 0.2); wall(sx * 5.63, 7.5, sx * 5.63, 8.75, 1.65, 0.15); wall(sx * 5.63, -8.75, sx * 5.63, -7.5, 1.65, 0.15);
      wall(sx * 1.35, 6.25, sx * 5.63, 6.25, 99, 0.25); wall(sx * 1.35, -2.5, sx * 5.63, -2.5, 99, 0.25); wall(sx * 1.35, -6.25, sx * 5.63, -6.25, 99, 0.25); }
    // the two doorways cut through: marble jambs and a lintel over each, a gilded band along it (the inner one's band
    // faces the hall, the back one's the back porch)
    for (const [z, d] of [[-2.5, 1], [-6.25, -1]]) {
      for (const sx of [-1, 1]) P.push([uvBox(0.7 * K, 4.5 * K, 0.62 * K).translate(sx * 1.6 * K, 3.75 * K, z * K), SMAT.marble], [uvBox(0.8 * K, 0.2 * K, 0.72 * K).translate(sx * 1.6 * K, 1.6 * K, z * K), GMAT.ashlar]);
      P.push([uvBox(4.0 * K, 0.5 * K, 0.7 * K).translate(0, 5.75 * K, z * K), SMAT.marble], [uvBox(4.05 * K, 0.08 * K, 0.74 * K).translate(0, 5.5 * K, z * K + d * 0.001), GMAT.gold]);
    }
    // Zeus on the dais in the middle of the hall, on a low stepped base, tripods burning either side of him
    const y = 1.63; P.push([uvBox(2.6 * K, 0.16 * K, 2.6 * K).translate(0, (y + 0.08) * K, 0), GMAT.ashlar], [uvBox(2.2 * K, 0.34 * K, 2.2 * K).translate(0, (y + 0.33) * K, 0), SMAT.marble], [uvBox(2.25 * K, 0.06 * K, 2.25 * K).translate(0, (y + 0.53) * K, 0), GMAT.gold], [uvBox(2.35 * K, 0.12 * K, 2.35 * K).translate(0, (y + 0.62) * K, 0), SMAT.marble]);
    solid(0, 0, 1.3, 2.5, 1.5);
    this.zeus(ctx, 0, (y + 0.68) * K, 0, 4.1 * K);
    for (const sx of [-1, 1]) { tripod(P, sx * 2.0 * K, fl * K, 1.6 * K, 1.15 * K); this.fire(ctx, sx * 2.0 * K, fl * K + 1.3 * K, 1.6 * K, 0.8 * K); solid(sx * 2.0, 1.6, 0.4, 2.5, 1.5); }
    if (!hasPiece('all/polygonancientempire/sm-prop-rug-01')) return;
    const AE = (k) => 'all/polygonancientempire/sm-prop-' + k, up = (h) => fl * K + h * FK;   // (h above the hall's floor, at the furnishings' size)
    // the hall: a runner from the door to the dais (as long as the hall has grown), braziers either side of it
    P.push(...piece(AE('rug-01'), 0, fl * K + 0.005, 3.85 * K, 0, K));
    for (const z of [2.8, 5.0]) for (const sx of [-1, 1]) { put(AE('brazier-03'), sx * 2.3, fl, z, 0, 1.0); this.fire(ctx, sx * 2.3 * K, up(0.9), z * K, 0.55); this.solid(ctx, sx * 2.3 * K, z * K, 0.22 * FK, 1.2 * FK, fl * K); }
    // the aisles: offering tables laid with bowls and jars, heaps of jars by the door, banners hung on the walls between
    for (const sx of [-1, 1]) {
      for (const z of [-0.6, 2.4]) { put(AE('table-02'), sx * 4.45, fl, z, 0, 0.8); this.solid(ctx, sx * 4.45 * K, z * K, 0.5 * FK, 1.2 * FK, fl * K);
        bowl(P, sx * 4.45 * K - sx * 0.22, up(0.62), z * K - 0.22, 1.4); jug(P, sx * 4.45 * K + sx * 0.22, up(0.62), z * K + 0.3, 1.5); amphora(P, sx * 4.45 * K + sx * 0.9, fl * K, z * K + 1.35, 1.1); }
      put(AE('vase-pile-02'), sx * 4.6, fl, 5.2, sx > 0 ? Math.PI : 0, 0.75); this.solid(ctx, sx * 4.6 * K, 5.2 * K, 0.6 * FK, 1 * FK, fl * K);
      for (const z of [0.625, 3.125]) P.push(...piece(AE('banner-01-a'), sx * 5.5 * K, 3.6 * K, z * K, -sx * Math.PI / 2, 1.5 * K));
    }
    // the back room: a treasury, a long table of offerings down one wall and heaped jars down the other, braziers inside the
    // doorway and a rug between (the way through to the back porch's door kept clear)
    P.push(...piece(AE('rug-03'), 0, fl * K + 0.005, -4.4 * K, 0, K)); put(AE('table-08'), -4.55, fl, -4.4, Math.PI / 2, 0.85); for (const z of [-5.3, -4.4, -3.5]) this.solid(ctx, -4.55 * K, z * K, 0.45 * FK, 1.2 * FK, fl * K);
    for (const [dz, f, s] of [[-1.1, bowl, 1.5], [0, jug, 1.6], [1.1, bowl, 1.2]]) f(P, -4.55 * K, up(0.66), -4.4 * K + dz, s);
    put(AE('vase-pile-01'), 4.6, fl, -4.4, Math.PI / 2, 0.55); for (const z of [-5.0, -4.4, -3.8]) this.solid(ctx, 4.6 * K, z * K, 0.5 * FK, 1 * FK, fl * K);
    for (const sx of [-1, 1]) { put(AE('brazier-03'), sx * 2.4, fl, -3.3, 0, 1.0); this.fire(ctx, sx * 2.4 * K, up(0.9), -3.3 * K, 0.55); this.solid(ctx, sx * 2.4 * K, -3.3 * K, 0.22 * FK, 1.2 * FK, fl * K); }
    P.push(...piece(AE('banner-large-01'), 0, 6.15 * K, -6.1 * K, 0, 0.5 * K));
  }
  // the pack's robed and wreathed elder, h metres tall, its marble tinted ivory (the hero's figure without the pack)
  zeus(ctx, x, y, z, h) {
    const pk = siteProp('zeus', h);
    if (pk) ctx.P.push([pk[0].translate(x, y, z), new THREE.MeshStandardMaterial({ map: pk[1].map, color: 0xd9c49a, roughness: 0.45 })]); else statue(ctx.grp, x, y, z, 2.3 * h / 4.4, 0, { mat: SMAT.ivory });
  }
  // the carved hall (without the pack): a Doric peripteros on its stepped platform. Outside: painted pediments with the gods
  // on a blue field, gilded acroteria, antefixes along the eaves. Inside the cella: painted walls under a ceiling of gold
  // stars on blue, two rows of columns, a dark pool before the ivory-and-gold Zeus (as at Olympia), and bronze tripods
  // whose fires light him.
  templeCarved(ctx, W, D) {
    const P = ctx.P, top = steps(P, W, D, 3, 0.42);
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
    this.zeus(ctx, 0, top + 1.4, sz, 4.4);
    const pz = sz + 3.5; P.push([plane(2.5, 3.0, 3).rotateX(-Math.PI / 2).translate(0, top + 0.04, pz), GMAT.water]);
    for (const [w, d, x, z] of [[2.86, 0.18, 0, pz - 1.59], [2.86, 0.18, 0, pz + 1.59], [0.18, 3.0, -1.34, pz], [0.18, 3.0, 1.34, pz]]) P.push([uvBox(w, 0.12, d).translate(x, top + 0.06, z), SMAT.marble]);
    for (const sx of [-1, 1]) { tripod(P, sx * 2.45, top, sz - 0.6, 1.25); this.fire(ctx, sx * 2.45, top + 1.4, sz - 0.6, 0.9); this.solid(ctx, sx * 2.45, sz - 0.6, 0.45);
      for (const z of [-0.2, 2.2]) { P.push([new THREE.CylinderGeometry(0.45, 0.45, 0.06, 20).rotateZ(Math.PI / 2).translate(sx * (iw - 0.04), top + 4.3, z), GMAT.bronze], [new THREE.SphereGeometry(0.1, 8, 6).translate(sx * (iw - 0.08), top + 4.3, z), GMAT.gold]); } }
    // the bronze-bound doors, thrown open into the cella
    for (const sx of [-1, 1]) { const leaf = (g) => g.rotateY(-sx * 1.3).translate(sx * 1.3, top, cz + cd / 2 - 0.36);
      P.push([leaf(uvBox(1.25, 3.5, 0.08).translate(-sx * 0.625, 1.75, 0)), GMAT.wood]); for (const y of [0.5, 1.75, 3.0]) P.push([leaf(uvBox(1.2, 0.08, 0.1).translate(-sx * 0.625, y, 0)), GMAT.bronze]); }
    this.stepTops(ctx, W, D, 3, 0.42);                                            // the steps and the platform you walk on
    this.top(ctx, -W / 2, W / 2, -D / 2, D / 2, eb, true);                       // under the roof
  }
  // ---- an abandoned farmhouse: whitewashed walls on a rubble footing, half its tiled roof fallen in, a walled yard with a
  // well, a clay oven, storage jars and an olive, a vine over the door. Inside: the hearth, a loom, shelves, a bed and the
  // chest someone left behind.
  house(s) {
    if (hasPiece('plFarmhouse')) { this.farmhouse(s); return; }
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
    this.oldChest(ctx, -1.8, -D / 2 + 0.8, 0);
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
  // the chest someone left behind (starter loot: trial.js opens its lid), turned rot
  oldChest(ctx, x, z, rot) { this.chest(ctx, x, z, rot, { id: 'houseChest', items: [['rope', 6], ['leather', 2], ['olive', 5], ['crudeDagger', 1], ['resin', 2], ['torch', 1]] }); }
  // An old chest to search, at x, y, z turned rot (trial.js opens it and keeps its id in what's been looted): the packs'
  // wooden one, its lid on a hinge along the back, or carved boxes without the pack. use: { id, items, sub (where it is) }
  chest(ctx, x, z, rot, use, y = 0) {
    const chest = new THREE.Group(); chest.position.set(x, y, z); chest.rotation.y = rot; ctx.grp.add(chest);
    const C = chestParts(), mk = ([g, m], o = chest) => { const q = new THREE.Mesh(g, m); q.castShadow = q.receiveShadow = true; o.add(q); return q; };
    let lid;
    if (C) { for (const p of C.body) mk(p); lid = new THREE.Group(); lid.position.set(0, C.hinge[0], C.hinge[1]); chest.add(lid); for (const p of C.lid) mk(p, lid); }
    else {
      mk([uvBox(1, 0.55, 0.6, 1).translate(0, 0.28, 0), GMAT.wood]); for (const bx of [-0.35, 0.35]) mk([uvBox(0.08, 0.57, 0.62).translate(bx, 0.28, 0), GMAT.bronze]);
      lid = mk([uvBox(1.04, 0.12, 0.64, 1), SMAT.bronze]); lid.position.y = 0.6;
    }
    this.solid(ctx, x, z, 0.55, 0.75, y);
    this.uses.push({ kind: 'loot', at: this.w(ctx, x, z, y), r: 1.8, lid, ...use });
  }
  // The farmhouse from the pack (tools/assets/manifest.json plFarmhouse: the kit's whitewashed walls, three bays by two,
  // 7.5 × 5 m), the roof still on over the western two bays and bare rafters over the third, its back corner fallen to
  // a stump. Inside: the hearth, the loom, a couch for a bed, shelves, the chest; a table and the fallen tiles under the
  // open sky. The yard: dry-stone walls with a gate, a vine over the door, the well, the bread oven, jars and firewood.
  farmhouse(s) {
    const ctx = this.site(s, 0.4), P = ctx.P, W = 7.5, D = 5, H = 3, put = (k, x, z, rot = 0, sc = 1, y = 0) => P.push(...piece(k, x, y, z, rot, sc));
    P.push(...pieceAt('plFarmhouse', -W / 2, 0, D / 2));
    // its walls (the doorway a metre and a half in the middle of the front; the fallen back corner a stump too high to climb)
    this.wall(ctx, -W / 2, -D / 2, W / 2, -D / 2, H, 0.25); this.wall(ctx, -W / 2, -D / 2, -W / 2, D / 2, H, 0.25); this.wall(ctx, W / 2, D / 2, W / 2, 0, H, 0.25); this.wall(ctx, W / 2, 0, W / 2, -D / 2, 1.5, 0.25);
    this.wall(ctx, -W / 2, D / 2, -0.75, D / 2, H, 0.25); this.wall(ctx, 0.75, D / 2, W / 2, D / 2, H, 0.25);
    this.top(ctx, -W / 2, 1.25, -D / 2, D / 2, H, true);   // (under the roof)
    { const g = new THREE.PlaneGeometry(W - 0.3, D - 0.3), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (W - 0.3) / 2.4, uv.getY(i) * (D - 0.3) / 2.4); P.push([g.rotateX(-Math.PI / 2).translate(0, 0.03, 0), SMAT.flags]); }   // its floor of worn flags
    // the rafters left over the third bay, a broken one hanging, the ridge beam
    const a = Math.atan2(0.75, D / 2), L = (D / 2 + 0.3) / Math.cos(a), slope = (g, sd, x) => g.translate(0, 0, sd * L / 2).rotateX(sd * a).translate(x, H + 0.06, 0);
    for (const sd of [-1, 1]) for (let x = 1.6, k = 0; x < W / 2; x += 0.75, k++) { const broken = (k % 2 === 1) === (sd > 0); P.push([slope(uvBox(0.12, 0.14, broken ? L * 0.5 : L).translate(0, 0, broken ? -sd * L * 0.25 : 0), sd, x), GMAT.oldWood]); }
    P.push([new THREE.CylinderGeometry(0.1, 0.1, W / 2 - 1.1, 8).rotateZ(Math.PI / 2).translate((W / 2 + 1.25) / 2, H + 0.72, 0), GMAT.oldWood]);
    // inside: the hearth, the loom by the west wall, the couch, the shelves, the chest; the table, fallen tiles and a beam in the open
    put('twFirepit', -1.0, 0.1, 0, 0.42); this.solid(ctx, -1.0, 0.1, 0.55, 0.4);
    P.push([new THREE.CylinderGeometry(0.42, 0.45, 0.04, 14).translate(-1.0, 0.03, 0.1), GMAT.ash]); for (let k = 0; k < 3; k++) P.push([new THREE.CylinderGeometry(0.05, 0.06, 0.6, 6).rotateZ(Math.PI / 2).rotateY(k * 1.1).translate(-1.0, 0.08, 0.1), GMAT.ash]); for (let k = 0; k < 5; k++) P.push([new THREE.IcosahedronGeometry(0.05, 0).translate(-1.0 + Math.cos(k * 2.3) * 0.18, 0.06, 0.1 + Math.sin(k * 2.3) * 0.18), GMAT.ember]);
    put('plLoom', -W / 2 + 0.55, -0.4, Math.PI / 2); this.solid(ctx, -W / 2 + 0.55, -0.9, 0.4, 2); this.solid(ctx, -W / 2 + 0.55, 0.1, 0.4, 2);
    put('plBed', -2.3, D / 2 - 0.6, Math.PI); this.solid(ctx, -2.9, D / 2 - 0.6, 0.5, 0.9); this.solid(ctx, -1.8, D / 2 - 0.6, 0.5, 0.9);
    P.push([uvBox(0.6, 0.1, 0.32).translate(-3.1, 0.62, D / 2 - 0.6), GMAT.linen]);
    for (const y of [1.15, 1.7]) { P.push([uvBox(1.7, 0.05, 0.3).translate(-0.4, y, -D / 2 + 0.3), GMAT.wood]); for (let k = 0; k < 4; k++) (k % 2 ? jug : bowl)(P, -1.0 + k * 0.4, y + 0.025, -D / 2 + 0.3, 0.9); }   // shelves
    this.oldChest(ctx, -2.7, -D / 2 + 0.6, 0);
    put('plTable', 2.2, -1.3, 0.1); this.solid(ctx, 1.8, -1.3, 0.45, 0.8); this.solid(ctx, 2.6, -1.3, 0.45, 0.8);
    put('plStool', 2.0, -0.55, 0.4); put('plStool', 3.0, -1.9, 2.2, 1, 0); jug(P, 2.0, 0.78, -1.25, 1.1); bowl(P, 2.5, 0.78, -1.4); bowl(P, 2.7, 0.78, -1.15, 0.8);
    for (let k = 0; k < 12; k++) P.push([uvBox(0.32, 0.03, 0.4).rotateX(rr(-0.4, 0.4)).rotateY(rr(0, 3)).translate(rr(1.6, 3.4), 0.03 + rr(0, 0.1), rr(-0.4, 1.9)), SMAT.tile]);
    P.push([uvBox(0.14, 0.14, 2.6).rotateX(0.35).rotateY(0.6).translate(2.7, 0.5, 0.9), GMAT.oldWood]);
    pithos(P, 3.0, -0.25, 1.8, 0.7); P.push([new THREE.CylinderGeometry(0.5, 0.6, 0.03, 12).translate(2.5, 0.015, 1.9), new THREE.MeshStandardMaterial({ color: 0xc9a85a, roughness: 1 })]);   // a cracked jar, its grain spilt
    // the yard: a low dry-stone wall with a gate, the vine on its pergola over the door, the well, the oven, jars, firewood
    const yz = D / 2 + 6;
    for (const [x0, z0, x1, z1] of [[-W / 2, D / 2 + 0.2, -W / 2, yz], [-W / 2, yz, -1.2, yz], [1.2, yz, W / 2, yz], [W / 2, yz, W / 2, D / 2 + 0.2]]) { rubble(P, x0, z0, x1, z1, 1.0, SMAT.stone, 0.25); this.wall(ctx, x0, z0, x1, z1, 1.0, 0.4); }
    for (const sx of [-1, 1]) { P.push([uvBox(0.55, 1.5, 0.55).translate(sx * 1.45, 0.75, yz), GMAT.ashlar], [uvBox(0.68, 0.14, 0.68).translate(sx * 1.45, 1.55, yz), GMAT.ashlar]); this.solid(ctx, sx * 1.45, yz, 0.4); }
    put('twPergola', 0, D / 2 + 1.35, 0, 0.95); for (const sx of [-1, 1]) for (const dz of [0.25, 2.35]) this.solid(ctx, sx * 1.05, D / 2 + dz, 0.15);
    leaves(P, 0, 2.95, D / 2 + 1.35, 2.8, 2.6, 0.35, 16, 5); for (let k = 0; k < 6; k++) P.push([new THREE.SphereGeometry(0.07, 6, 4).translate(rr(-1.1, 1.1), 2.86, D / 2 + rr(0.4, 2.3)), new THREE.MeshStandardMaterial({ color: 0x4a2a52, roughness: 0.6 })]);   // grapes
    put('twWell', 2.3, D / 2 + 3.7, 0.3, 0.75); this.solid(ctx, 2.3, D / 2 + 3.7, 1.25);
    put('twKiln', -2.4, D / 2 + 2.3, 1.2, 0.72); this.solid(ctx, -2.4, D / 2 + 2.3, 0.85, 1.3);
    for (const [k, x, z, r, sc] of [['twJars', -2.7, yz - 1.2, 0.6, 0.9], ['twVase', 3.1, D / 2 + 0.7, 0.3, 0.9], ['twJar', 3.25, D / 2 + 1.4, 0.3, 1], ['twLogs', -1.4, D / 2 + 0.5, 0.3, 0.9], ['twBasket', 1.5, D / 2 + 0.5, 0.25, 0.9], ['twStrawBundle', 3.0, yz - 1.0, 0.35, 1]]) { put(k, x, z, (x * 7 + z) % 6.3, sc); this.solid(ctx, x, z, r, 1.2); }
    cartWheel(P, W / 2 - 0.25, 0, D / 2 + 5.0, Math.PI / 2, 0.18);
    this.plant(ctx, 'olive', 1, 2.7, 0, yz + 1.6, 1.15); this.solid(ctx, 2.7, yz + 1.6, 0.6);
    this.finish(ctx, { w: W + 1.5, d: D + 1.5 });
  }
  // ---- the Labyrinth: the Minotaur's ruined arena. Three broken rings of wall with offset gaps, a ring of columns, a
  // raised altar in the middle; braziers, bones and fallen statues about the corridors. With the pack: ashlar walls between
  // square posts (each length sunk to its own broken height), the gate's two great columns under a beam and the bull's horns,
  // Doric columns (the broken ones stumps among their drums), the altar a pack plinth on a stepped dais.
  labyrinth(s) {
    const ctx = this.site(s, 0), P = ctx.P, pack = hasPiece('plWall'), Q = {};   // (Q: the pack walls by ring and quarter, drawn apart so a length in the camera's way fades alone)
    // its own dice for the decoration, so the other sites (and their clues) come out as they always have
    let ls = 1234; const lr = (a, b) => a + (((ls = (ls * 16807) % 2147483647) - 1) / 2147483646) * (b - a), dr = dice(9090);
    // the gaps are remembered, so the Minotaur and the dead can find their way through the rings (navTarget)
    const gaps = { 22: [], 15: [], 9: [] };
    for (const [R, gap, ruin] of [[22, 0.3, 0.45], [15, 2.1, 0.35], [9, 4.2, 0.25]]) {
      const n = Math.ceil(R * 0.9), hs = [], q = (a) => (Q[R + ':' + Math.floor(a / (Math.PI / 2)) % 4] ||= []);
      for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2; if (Math.abs(Math.sin((a0 - gap) / 2)) < 0.12) { gaps[R].push([a0, a1]); hs.push(0); continue; }
        const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R, h = 3.2 * (1 - ruin * Math.abs(Math.sin(i * 1.7 + R))); hs.push(h);
        if (pack) {   // (a 5 m length of ashlar stretched along the chord, sunk into the ground to its height: the courses stay true)
          const len = Math.hypot(x1 - x0, z1 - z0); q(a0).push(...piece('plWall', (x0 + x1) / 2, h - 4.51, (z0 + z1) / 2, -Math.atan2(z1 - z0, x1 - x0), [len / 5 + 0.02, 1, 1.1]));
          if (h < 2.6 && dr() < 0.7) { const t = dr(), out = dr() < 0.5 ? 0.95 : -0.95, rx = (x0 + (x1 - x0) * t) * (1 + out / R), rz = (z0 + (z1 - z0) * t) * (1 + out / R), block = dr() < 0.5;   // fallen blocks at its foot
            P.push(...piece(block ? 'plBlock' : 'twRubbleA', rx, 0.04, rz, dr() * 6.3, 0.6 + dr() * 0.3)); if (block) this.solid(ctx, rx, rz, 0.4, 0.9); }
        } else rubble(P, x0, z0, x1, z1, h, SMAT.stone, 0.15);
        this.wall(ctx, x0, z0, x1, z1, h, 0.42); }
      if (pack) for (let i = 0; i < n; i++) { const h = Math.max(hs[i], hs[(i + n - 1) % n]), a = (i / n) * Math.PI * 2; if (h) q(a).push(...piece('plWallPost', Math.cos(a) * R, h + 0.2 - 4.55, Math.sin(a) * R, -a, [1, 1, 1.2])); }   // a post where two lengths meet
    }
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + 0.3, x = Math.cos(a) * 18.5, z = Math.sin(a) * 18.5;
      if (!pack) column(P, x, 0, z, 5.5, 0.5, SMAT.marble, i % 3 === 1 ? rr(0.25, 0.6) : 0);
      else if (i % 3 !== 1) P.push(...piece('plColumn', x, 0, z, a, 0.92));
      else { const px = Math.cos(a + 0.07) * 20.5, pz = Math.sin(a + 0.07) * 20.5; P.push(...piece('plColumnHalf', x, 0, z, a + i, 0.42), ...piece('plPile', px, 0, pz, a + Math.PI / 2, 0.7)); this.solid(ctx, px, pz, 0.75, 0.7); }   // a stump, its drums fallen outward (clear of the way round the inside)
      this.solid(ctx, x, z, 0.55); }
    let top;
    if (pack) { P.push(...pieceAt('plDais', 0, 0, 0)); top = 1.05; for (let i = 0; i < 3; i++) { const k = 2.625 - i * 0.583; this.top(ctx, -k, k, -k, k, 0.35 * (i + 1)); } }
    else { top = steps(P, 5, 5, 3, 0.35, 0, SMAT.stone); P.push([uvBox(2.2, 1.0, 1.4).translate(0, top + 0.5, 0), SMAT.marble]); this.stepTops(ctx, 5, 5, 3, 0.35); }
    const hy = pack ? top + 2.3 : top + 1.95;   // (the bronze horns of the bull on the altar: a crescent, its tips raised)
    P.push([new THREE.TorusGeometry(0.9, 0.12, 6, 18, Math.PI).rotateZ(Math.PI).translate(0, hy, 0), SMAT.bronze]);
    for (const sx of [-1, 1]) { if (pack) P.push(...piece('plBrazier', sx * 3.4, 0, 2, 0, 0.7)); else P.push([new THREE.CylinderGeometry(0.35, 0.2, 1.1, 10).translate(sx * 3.4, top + 0.55, 2), SMAT.bronze]);
      this.fire(ctx, sx * 3.4, pack ? 1.45 : top + 1.1, 2); if (pack) this.solid(ctx, sx * 3.4, 2, 0.6, 1.4); }
    this.solid(ctx, 0, 0, 1.3, top + 1);
    this.uses.push({ kind: 'summon', boss: 'minotaur', at: this.w(ctx, 0, 1.4), r: 3.2, center: this.w(ctx, 0, 0) });
    // the arena floor: worn flagstones from the outer wall in
    const floor = new THREE.CylinderGeometry(23.4, 23.4, 0.08, 72, 1).translate(0, 0.04, 0), fu = floor.attributes.uv, fp = floor.attributes.position;
    for (let i = 0; i < fu.count; i++) fu.setXY(i, fp.getX(i) / 2.4, fp.getZ(i) / 2.4);
    P.push([floor, SMAT.flags]);
    // the gate: two great pillars at the outer gap, a lintel, and the bull's horns over the way in
    const [g0, g1] = gaps[22][0], gp = [g0, g1].map((a) => [Math.cos(a) * 22, Math.sin(a) * 22]);
    for (const [x, z] of gp) { if (pack) P.push(...piece('plGatePost', x, 0, z, 0, 0.55)); else column(P, x, 0, z, 6.2, 0.7, SMAT.stone); this.solid(ctx, x, z, 0.75); }
    const gl = Math.hypot(gp[1][0] - gp[0][0], gp[1][1] - gp[0][1]) + 1.6, gx = (gp[0][0] + gp[1][0]) / 2, gz = (gp[0][1] + gp[1][1]) / 2, ga = Math.atan2(gp[1][1] - gp[0][1], gp[1][0] - gp[0][0]);
    if (pack) { P.push(...piece('plBeam', gx, 6.6, gz, -ga, [gl / 10, 1.6, 1.2])); for (const sd of [1, -1]) P.push(...piece('plSymMinotaur', gx - Math.sin(ga) * sd * 0.67, 6.62, gz + Math.cos(ga) * sd * 0.67, -ga + (sd < 0 ? Math.PI : 0), 1.2).map(([g]) => [g, SMAT.bronze])); }   // (the bull-man in bronze on both faces of the beam)
    else P.push([uvBox(gl, 0.9, 1.3).rotateY(-ga).translate(gx, 6.6, gz), SMAT.stone]);
    P.push([new THREE.TorusGeometry(1.6, 0.2, 6, 18, Math.PI).rotateZ(Math.PI).rotateY(-ga).translate(gx, 9.3, gz), SMAT.bronze]);   // (the bull's horns over the way in)
    // braziers either side of the inner gaps, lighting the way to the altar
    for (const R of [15, 9]) { const [a0, a1] = gaps[R][0]; for (const a of [a0 - 0.12, a1 + 0.12]) { const x = Math.cos(a) * (R - 1.1), z = Math.sin(a) * (R - 1.1);
      if (pack) P.push(...piece('plBrazier', x, 0, z, a, 0.6)); else P.push([new THREE.CylinderGeometry(0.22, 0.3, 1.1, 8).translate(x, 0.55, z), SMAT.stone], [new THREE.CylinderGeometry(0.42, 0.24, 0.3, 10).translate(x, 1.25, z), SMAT.bronze]);
      this.fire(ctx, x, pack ? 1.25 : 1.35, z, 0.8); this.solid(ctx, x, z, 0.45); } }
    // bones of those who came before, along the corridors
    for (let i = 0; i < 22; i++) {
      const R = i % 2 ? lr(10.5, 13.5) : lr(16.5, 20.5), a = lr(0, Math.PI * 2), x = Math.cos(a) * R, z = Math.sin(a) * R;
      if (hasPiece(BONES[i % 4])) { P.push(...piece(BONES[i % 4], x, 0.06, z, lr(0, 6.3), 1.2)); if (i % 3 === 0) P.push(...piece(BONES[3], x + 0.6, 0.06, z - 0.3, a, 1.1)); continue; }
      for (let k = 0; k < 4; k++) P.push([new THREE.CylinderGeometry(0.035, 0.03, lr(0.35, 0.6), 5).rotateZ(Math.PI / 2).rotateY(lr(0, 6.3)).translate(x + lr(-0.4, 0.4), 0.11, z + lr(-0.4, 0.4)), SMAT.bone]);
      if (i % 3 === 0) { P.push([new THREE.IcosahedronGeometry(0.15, 1).scale(1, 0.9, 1.2).translate(x, 0.2, z), SMAT.bone], [new THREE.BoxGeometry(0.16, 0.06, 0.12).translate(x, 0.09, z + 0.12), SMAT.bone]); }
    }
    // and their statues, broken: a headless warrior and a pair of legs still standing, the rest fallen where the way isn't
    // (fixed places, clear of the paths between the gaps, so the dice above come out as they always have)
    for (const [k, R, a, rot, r] of [['broken1', 20.3, 3.75, 2.2, 0.45], ['broken4', 12.2, 0.7, 3.6, 0.4], ['broken3', 20.0, 5.0, 1.2], ['broken5', 11.8, 5.6, 2.2], ['broken2', 12.6, 1.35, 0.4], ['broken8', 19.6, 4.35, 2.8], ['broken6', 11.6, 0.95, 1.7], ['broken7', 20.6, 3.95, 0.9]]) {
      const x = Math.cos(a) * R, z = Math.sin(a) * R, pk = sitePropAt(k, 1.15); if (!pk) break;
      P.push([pk[0].rotateY(rot).translate(x, 0.08, z), pk[1]]); if (r) this.solid(ctx, x, z, r, 2);
    }
    for (const list of Object.values(Q)) for (const m of mergeByMat(list)) ctx.grp.add(m);
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
    // far round the ring from its gap: along the corridor, a short arc at a time, clear of the wall (a straight line to the
    // gap runs along the wall's foot, where the fallen blocks lie and pin a big body)
    const fa = Math.atan2(from.z - L.c.z, from.x - L.c.x), da = Math.atan2(Math.sin(a - fa), Math.cos(a - fa));
    if (Math.abs(da) > 0.25) { const Rm = R + (bt > bf ? -1.8 : 1.8), s = fa + Math.max(-0.35, Math.min(0.35, da)); return _nav.set(L.c.x + Math.cos(s) * Rm, from.y, L.c.z + Math.sin(s) * Rm); }
    if (Math.hypot(from.x - gx, from.z - gz) > 2.2) return _nav.set(gx, from.y, gz);
    const R2 = R + (bt > bf ? 3 : -3); return _nav.set(L.c.x + Math.cos(a) * R2, from.y, L.c.z + Math.sin(a) * R2);   // through it
  }
  // ---- the Chimera's shrine: a sunken court of dark, mossy flagstones deep in the forest, ringed by columns lost to ivy,
  // some fallen. On the altar the beast itself in black stone (the lion crouched to spring, the goat rising from its back,
  // the serpent coiled over) with ember eyes. Tripods burn round the court and a low mist lies over the stones.
  shrine(s) {
    const ctx = this.site(s, 0.8), P = ctx.P, lr = dice(4242), pack = hasPiece('plSteps'), moss = (list) => list.map(([g, m]) => [g, mossy(m)]);   // (with the pack: its columns, beams, drums and steps, grown over)
    const floor = new THREE.CylinderGeometry(19, 19, 0.08, 64, 1).translate(0, 0.04, 0), fu = floor.attributes.uv, fp = floor.attributes.position;
    for (let i = 0; i < fu.count; i++) fu.setXY(i, fp.getX(i) / 2.6, fp.getZ(i) / 2.6); P.push([floor, GMAT.darkFlags]);
    for (const [r0, r1] of [[9.4, 10], [12.6, 12.9]]) P.push([new THREE.RingGeometry(r0, r1, 64).rotateX(-Math.PI / 2).translate(0, 0.085, 0), GMAT.basalt]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, x = Math.cos(a) * 17, z = Math.sin(a) * 17, br = i % 4 === 2 ? rr(0.3, 0.6) : 0; this.solid(ctx, x, z, 0.6);
      if (!pack) column(P, x, 0, z, 6, 0.55, SMAT.moss, br); else P.push(...moss(br ? piece('plColumnHalf', x, 0, z, a, [0.5, br * 1.3, 0.5]) : piece('plColumn', x, 0, z, a, [1.15, 1, 1.15])));
      if (!br && i % 2 === 0) { const a2 = ((i + 2) / 12) * Math.PI * 2, len = Math.hypot(Math.cos(a2) * 17 - x, Math.sin(a2) * 17 - z) + 1.2, ang = -Math.atan2(Math.sin(a2) * 17 - z, Math.cos(a2) * 17 - x), mx = (x + Math.cos(a2) * 17) / 2, mz = (z + Math.sin(a2) * 17) / 2;
        if (pack) P.push(...moss(piece('plBeam', mx, 5.95, mz, ang, [len / 10, 1, 1.1]))); else P.push([uvBox(len, 0.7, 1.1).rotateY(ang).translate(mx, 6.0, mz), SMAT.moss]); }
      if (br) for (let k = 0; k < 3; k++) { const t = a + Math.PI / 2 + (lr() - 0.5) * 0.5, d = 1.5 + k * 1.1, dx = x + Math.cos(a + 0.5) * d, dz = z + Math.sin(a + 0.5) * d;   // its drums, fallen in a line
        if (pack) P.push(...moss(piece('twDrum', dx, 0, dz, -t, [1.3, 1.3, 0.4]))); else P.push([new THREE.CylinderGeometry(0.5, 0.53, 0.95, 18).rotateZ(Math.PI / 2).rotateY(-t).translate(dx, 0.5, dz), SMAT.moss]); this.solid(ctx, dx, dz, 0.55, 1); }
      if (i % 3 === 0) for (let k = 0; k < 9; k++) { const q = k * 0.85 + i; P.push([new THREE.IcosahedronGeometry(1, 0).scale(0.32, 0.45, 0.3).translate(x + Math.cos(q) * 0.55, 0.3 + k * 0.55, z + Math.sin(q) * 0.55), GMAT.ivy]); }   // ivy climbing
    }
    const top = pack ? 1.4 : steps(P, 7, 7, 4, 0.4, 0, SMAT.moss); if (pack) P.push(...moss(pieceAt('plSteps', 0, 0, 0, 0, 4 / 3)));
    P.push([uvBox(3.2, 1.2, 2.4).translate(0, top + 0.6, 0), GMAT.basalt], [uvBox(3.4, 0.16, 2.6).translate(0, top + 1.28, 0), GMAT.basalt]);
    if (pack) P.push(...piece('plSymChimera', 0, top + 0.12, 1.21, 0, 1.25).map(([g]) => [g, GMAT.oldBronze]));   // the beast in bronze relief on the altar's face
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
    for (let k = 0; k < 16; k++) { const a = lr() * 6.28, r0 = 6.4 + lr() * 2.5, len = 0.4 + lr() * 0.5, rot = lr() * 3, bone = BONES[k % 4];
      if (hasPiece(bone)) { if (k % 2 === 0) P.push(...piece(bone, Math.cos(a) * r0, 0.08, Math.sin(a) * r0, rot * 2, 1.1)); continue; }
      P.push([new THREE.CylinderGeometry(0.04, 0.035, len, 5).rotateZ(Math.PI / 2).rotateY(rot).translate(Math.cos(a) * r0, 0.12, Math.sin(a) * r0), SMAT.bone]); if (k % 5 === 0) P.push([new THREE.IcosahedronGeometry(0.15, 1).scale(1, 0.9, 1.2).translate(Math.cos(a) * r0 + 0.3, 0.2, Math.sin(a) * r0), SMAT.bone]); }
    for (let k = 0; k < 4; k++) { const a = 0.6 + k * 1.6, x = Math.cos(a) * 5.4, z = Math.sin(a) * 5.4; amphora(P, x, 0.25, z, 0.8, 1.4 + lr() * 0.3, a); bowl(P, x + 0.5, 0.09, z + 0.3, 1.1); }
    // a statue of some hero who came for the beast, broken and fallen among the drums (fixed places: the dice above keep theirs)
    for (const [k, R, a, rot, r] of [['broken1', 15.0, 4.25, 1.0, 0.45], ['broken3', 14.2, 1.45, 2.4], ['broken5', 13.4, 3.45, 0.6], ['broken8', 14.6, 5.65, 1.9], ['broken7', 13.0, 1.75, 0.3]]) {
      const x = Math.cos(a) * R, z = Math.sin(a) * R, pk = sitePropAt(k, 1.15); if (!pk) break;
      P.push([pk[0].rotateY(rot).translate(x, 0.08, z), pk[1]]); if (r) this.solid(ctx, x, z, r, 2);
    }
    mist(ctx.grp, 14, 15, 0x9fb0a6, 5);
    this.solid(ctx, 0, 0, 1.7, top + 1.2);
    if (pack) for (let i = 0; i < 3; i++) { const k = 3.5 - i * 0.778; this.top(ctx, -k, k, -k, k, (i + 1) * 0.467); } else this.stepTops(ctx, 7, 7, 4, 0.4);
    this.uses.push({ kind: 'summon', boss: 'chimera', at: this.w(ctx, 0, 1.6), r: 3.4, center: this.w(ctx, 0, 0) });
    this.finish(ctx, { r: 18.5 });
  }
  // ---- an ancient olive with marks cut into a little stele before it, offerings left at its foot and a small fire kept
  // burning beside them, its smoke rising over the meadow so you see from afar that something waits there
  olive(s, i) {
    const ctx = this.site(s, i * 1.3), P = ctx.P, sc = 1.9, gy = (x, z) => Math.max(0, this.groundY(ctx, x, z));
    // the old tree's roots go into the ground like every tree's (flora-pack.js), and what stands before it stands a metre
    // clear of its trunk (tester, 12 Nov: the stele was hidden inside it): R, the trunk's reach at the ground, measured
    const tree = this.plant(ctx, 'olive', i % 3, 0, 0, 0, sc), tp = tree.children[0].geometry.attributes.position; let R = 0.8;
    for (let k = 0; k < tp.count; k++) { const y = tp.getY(k) * sc; if (y > -0.3 && y < 2.4) R = Math.max(R, Math.hypot(tp.getX(k), tp.getZ(k)) * sc); }
    this.solid(ctx, 0, 0, Math.max(0.95, R * 0.75));
    const zs = R + 1.15, ring = zs + 1.6;   // (the stele's middle, its back a metre off the trunk; the ring of stones round it all)
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, x = Math.cos(a) * ring, z = Math.sin(a) * ring; boulder(P, x, gy(x, z) + 0.15, z, 0.35, SMAT.rock, 1.2, 0.6, 1); }   // (none straight in front of the stele)
    const y0 = gy(0, zs);
    P.push([uvBox(0.6, 1.25, 0.24).translate(0, y0 + 0.62, zs), SMAT.marble], [uvBox(0.74, 0.12, 0.36).translate(0, y0 + 1.3, zs), SMAT.marble], [uvBox(0.84, 0.14, 0.46).translate(0, y0 + 0.07, zs), GMAT.ashlar]);
    amphora(P, -0.85, gy(-0.85, zs + 0.05), zs + 0.05, 0.55, 0.12); bowl(P, -0.42, gy(-0.42, zs + 0.5) + 0.02, zs + 0.5, 1.1);
    for (let k = 0; k < 6; k++) P.push([new THREE.SphereGeometry(0.035, 6, 4).translate(-0.42 + Math.cos(k) * 0.08, gy(-0.42, zs + 0.5) + 0.1, zs + 0.5 + Math.sin(k) * 0.08), GMAT.basalt]);
    this.solid(ctx, 0, zs, 0.45, 1.4); this.solid(ctx, -0.85, zs + 0.05, 0.25, 0.7);
    // the offering fire: a bronze bowl on a low stone, small flames, a thread of smoke and a warm light (lit near you only:
    // the fire light pool, lights.js)
    const fx = 0.95, fz = zs + 0.3, fy = gy(fx, fz), bowlY = fy + 0.36;
    P.push([new THREE.CylinderGeometry(0.3, 0.36, 0.36, 10).translate(fx, fy + 0.18, fz), GMAT.ashlar]);
    if (hasPiece('plFireBowl')) P.push(...piece('plFireBowl', fx, bowlY, fz, 0, 0.6));
    else P.push([new THREE.CylinderGeometry(0.34, 0.2, 0.2, 12).translate(fx, bowlY + 0.1, fz), SMAT.bronze]);
    for (let k = 0; k < 3; k++) P.push([new THREE.CylinderGeometry(0.035, 0.045, 0.42, 5).rotateZ(Math.PI / 2).rotateY(k * 1.05).translate(fx, bowlY + 0.2, fz), GMAT.ember]);
    this.fire(ctx, fx, bowlY + 0.18, fz, 0.55); this.flames.push(offeringFire(ctx.grp, fx, bowlY + 0.18, fz, i));
    this.solid(ctx, fx, fz, 0.42, 0.9);
    // at every other one a water-bearer in marble, left by those who tended it (on the stele's other side, clear of the trunk)
    const kore = i % 2 ? null : siteProp('bearer', 1.75), ka = -0.75, kx = Math.sin(ka) * (R + 1.0), kz = Math.cos(ka) * (R + 1.0), ky = gy(kx, kz);
    if (kore) { P.push([uvBox(0.62, 0.5, 0.62).translate(kx, ky + 0.1, kz), GMAT.ashlar], [kore[0].rotateY(0.45).translate(kx, ky + 0.35, kz), kore[1]]); this.solid(ctx, kx, kz, 0.42, 2.2); }
    const glyphs = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.6), SMAT.glyph.clone()); glyphs.material.map = glyphTex(i); glyphs.position.set(0, y0 + 0.78, zs + 0.125); ctx.grp.add(glyphs);
    this.uses.push({ kind: 'scrap', id: 'olive' + i, at: this.w(ctx, 0, zs + 0.6, y0), r: 2.2, glyphs });
    this.finish(ctx, { r: ring });
  }
  // ---- a Giant cave: a hill of its own on the hillside (gen.js caveHill), wooded on its slopes, a cliff on its downhill
  // face and the mouth at the cliff's foot. The terrain round it is the hill; the rock over the cave is one mesh in the
  // terrain's own material (cave.js), so the two are one. Big boulders lie fallen at the cliff's foot, roots and ferns
  // hang over the mouth and a path is worn down from it. Inside, a chamber taller than its giant: his fire with his supper
  // on the spit, its smoke rising to the sooty roof; his bed of straw and hides; the bones and skulls of what he ate heaped
  // by the wall, his club leant against it; hunts daubed on the walls in ochre and charcoal; stalactites, stalagmites and
  // pale mushrooms glowing in the damp; at the back the carved stele, lit cold so it can be found.
  // The rock is worked out in the worker pool (cave.js: it's heavy) and the cave is furnished when it comes back, a moment
  // after the world is up; its walls go in as colliders of their own then.
  cave(s, i) {
    const F = CAVE_FORM, ctx = this.site(s, s.rot), hx = 2.8, hz = F.VC + 3.6;
    // (big blocks fallen at the cliff's foot: [across, out from the foot, size])
    const o = { hearth: [hx, hz], fallen: [[-(F.WM + 1.6), 1.2, 1.5], [F.WM + 2.0, 1.3, 1.8], [-(F.WM + 5.0), 1.0, 1.2], [F.WM + 6.0, 1.4, 1.1], [-3.0, 6.5, 0.9], [5.5, 9.0, 1.0], [-7.5, 3.0, 0.7]] };
    const done = (r) => {
      const keep = this.solids; this.solids = []; r.R.c = s.form; this.furnishCave(ctx, s, i, r, hx, hz);
      const mine = this.solids; this.solids = keep; keep.push(...mine); this.g.colliders.addGroup('cave' + i, mine.map((c) => ({ ...c, ref: { site: true } }))); delete ctx.grp.userData.top;
    };
    if (this.g.pool) this.g.pool.post({ type: 'caveRock', i, o }).then(done); else done(caveRock(s.form, o));
  }
  furnishCave(ctx, s, i, { R, pos, nor, col, rock, index }, hx, hz) {
    const F = CAVE_FORM, P = ctx.P, lr = dice(50 + i), fy = (x, z) => this.groundY(ctx, x, z);
    for (const b of R.blocks) if (b.out) this.solid(ctx, b.u, b.v, Math.max(b.sx, b.sz) * 0.95, b.sy * 2, b.y - b.sy);
    // the rock, drawn as far as the hill is seen (without it the hill would show a hole) and never faded when it stands
    // between the camera and the hero (the camera is kept out of it instead: rayBlock); its uv as the terrain's, from the
    // side on the walls
    { const n = pos.length / 3, uv = new Float32Array(n * 2), c = Math.cos(ctx.rot), sn = Math.sin(ctx.rot), g = new THREE.BufferGeometry();
      for (let k = 0; k < n; k++) {
        const x = s.x + pos[k * 3] * c + pos[k * 3 + 2] * sn, y = s.y + pos[k * 3 + 1], z = s.z - pos[k * 3] * sn + pos[k * 3 + 2] * c, ax = Math.abs(nor[k * 3] * c + nor[k * 3 + 2] * sn), ay = Math.abs(nor[k * 3 + 1]), az = Math.abs(-nor[k * 3] * sn + nor[k * 3 + 2] * c);
        uv[k * 2] = (ay >= ax && ay >= az ? x : ax > az ? z : x) / 3; uv[k * 2 + 1] = (ay >= ax && ay >= az ? z : y) / 3;
      }
      for (const [k, a, m] of [['position', pos, 3], ['normal', nor, 3], ['color', col, 3], ['uv', uv, 2], ['rock', rock, 1]]) g.setAttribute(k, new THREE.BufferAttribute(a, m));
      g.setIndex(new THREE.BufferAttribute(index, 1)); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, caveMat()); m.castShadow = m.receiveShadow = true;
      const far = new THREE.Group(); far.position.copy(ctx.grp.position); far.rotation.y = ctx.rot; far.userData.viewR = 1100; far.add(new THREE.Group().add(m)); this.g.scene.add(far); this.groups.push(far); }
    (this.caveRocks ||= []).push({ ctx, R });
    // its walls to bump into: posts just inside the rock at hip height, round the chamber and the passage and along the
    // cliff's foot (not where the hill's own slope rises gently out of the cut: that is walked up)
    { const placed = [];
      for (let k = 1; k < R.nv - 1; k++) for (let j = 1; j < R.nu - 1; j++) {
        const n = k * R.nu + j, u = R.u0 + j * STEP, v = R.v0 + k * STEP, y = R.FL[n] + 1.0; if (R.CD[n] > 0 || densityAt(R, u, y, v) <= 0) continue;
        let wall = false; for (const [du, dv] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) { if (densityAt(R, u + du, y, v + dv) > 0) continue; const m = n + Math.sign(dv) * R.nu + Math.sign(du); if (R.TOP[m] > y + 1.5 || Math.abs(R.TOP[n] - R.TOP[m]) > 1.2 * STEP) wall = true; }
        if (!wall || placed.some(([a, b]) => (a - u) ** 2 + (b - v) ** 2 < 0.36)) continue;
        placed.push([u, v]); this.solid(ctx, u, v, 0.42, Math.max(1.2, Math.min(6, R.TOP[n] - R.FL[n] - 1.6)), R.FL[n] - 0.3);
      } }
    const glow = SMAT.glowCap, DRIP = SMAT.drip, W = SMAT.caveWood;
    // the giant's fire: a ring of stones and the logs burning in it, a pile of firewood by it, its smoke rising to the roof
    const hy = fy(hx, hz);
    if (hasPiece(CAVE_PK.fire)) P.push(...piece(CAVE_PK.fire, hx, hy - 0.05, hz, 0.4, 1.8));
    else for (let k = 0; k < 10; k++) { const q = (k / 10) * Math.PI * 2; boulder(P, hx + Math.cos(q) * 1.0, hy + 0.12, hz + Math.sin(q) * 1.0, 0.24, SMAT.rock); }
    for (let k = 0; k < 4; k++) P.push([new THREE.CylinderGeometry(0.09, 0.11, 1.2, 6).rotateZ(Math.PI / 2).rotateY(k * 0.8).translate(hx, hy + 0.14, hz), GMAT.ember]);
    this.fire(ctx, hx, hy + 0.25, hz, 1.5); this.flames.push(offeringFire(ctx.grp, hx, hy + 0.3, hz, i, 0x3a3734));
    firewood(P, hx + 2.4, hy, hz + 1.4, 1.3, 1.6, 4);
    // his supper on the spit, turning over the fire on two forked posts
    for (const sx of [-1, 1]) P.push([new THREE.CylinderGeometry(0.07, 0.09, 1.75, 6).translate(hx + sx * 1.3, hy + 0.87, hz), W], [new THREE.ConeGeometry(0.1, 0.3, 5).rotateZ(sx * 0.6).translate(hx + sx * 1.36, hy + 1.8, hz), W]);
    P.push([new THREE.CylinderGeometry(0.045, 0.045, 3.0, 6).rotateZ(Math.PI / 2).translate(hx, hy + 1.68, hz), W]);
    // (a whole goat, spitted: its body along the spit, the head drooping at one end, the legs bound under it)
    P.push([new THREE.CapsuleGeometry(0.27, 0.8, 4, 10).rotateZ(Math.PI / 2).scale(1, 1, 0.85).translate(hx, hy + 1.6, hz), SMAT.meat], [new THREE.CapsuleGeometry(0.11, 0.22, 3, 8).rotateZ(-0.9).translate(hx + 0.78, hy + 1.45, hz), SMAT.meat]);
    for (const [lx, a] of [[-0.35, 0.5], [-0.25, 0.8], [0.3, -0.5], [0.4, -0.8]]) P.push([new THREE.CylinderGeometry(0.035, 0.05, 0.55, 5).rotateZ(a).translate(hx + lx, hy + 1.32, hz + (a > 0 ? 0.08 : -0.08)), SMAT.meat]);
    P.push([new THREE.CylinderGeometry(0.3, 0.34, 1.8, 9).rotateZ(Math.PI / 2).rotateY(0.5).translate(hx - 0.6, hy + 0.3, hz + 2.4), W]);   // (a log for a seat)
    this.solid(ctx, hx, hz, 1.25, 1.9, hy); this.solid(ctx, hx - 0.6, hz + 2.4, 0.9, 0.7, hy);
    // his bed against the wall at the back: a heap of straw under hides
    const bx = -3.7, bz = F.VC - 3.0, by = fy(bx, bz);
    if (hasPiece('twStraw')) P.push(...piece('twStraw', bx, by - 0.1, bz, 0.5, [1.6, 0.8, 1.6]));
    else P.push([new THREE.IcosahedronGeometry(1, 1).scale(1.9, 0.35, 1.5).rotateY(0.5).translate(bx, by + 0.1, bz), SMAT.straw]);
    for (const [dx, dz, w, d, a, m] of [[0, 0, 1.5, 1.1, 0.5, SMAT.hide], [0.6, -0.5, 1.2, 0.9, 1.4, SMAT.hide2], [-0.5, 0.5, 1.1, 0.8, 2.6, SMAT.hide3]]) P.push([new THREE.IcosahedronGeometry(1, 2).scale(w, 0.07, d).rotateY(a).translate(bx + dx, by + 0.42 + dx * 0.05, bz + dz), m]);
    this.solid(ctx, bx, bz, 1.4, 0.6, by);
    // the bones of his meals heaped against the wall, skulls among them
    const ox = 4.2, oz = F.VC - 2.6, oy = fy(ox, oz);
    const heap = [[CAVE_PK.bones, 0, 0, 0.7, 1.15], [CAVE_PK.bones2, 1.3, 1.0, 2.2, 1.2], [BONES[1], -0.9, 0.8, 1.2, 1.5], [BONES[0], 0.4, -0.9, 0.3, 1.6], [BONES[2], -0.6, -0.4, 2.4, 1.5], [BONES[3], 0.9, 0.4, 0.4, 1.3], [CAVE_PK.skull, -0.2, 1.4, 0.2, 1.4], [CAVE_PK.skull2, 1.1, -0.2, 2.8, 1.3], [CAVE_PK.skull, 0.2, 0.5, 1.6, 1.2]];
    if (hasPiece(CAVE_PK.bones)) for (const [k, dx, dz, a, sc] of heap) P.push(...piece(k, ox + dx, fy(ox + dx, oz + dz) + 0.02, oz + dz, a, sc));
    else for (let k = 0; k < 18; k++) P.push([new THREE.CylinderGeometry(0.05, 0.04, 0.4 + lr() * 0.6, 5).rotateZ(Math.PI / 2).rotateY(lr() * 3).translate(ox - 0.8 + lr() * 1.6, oy + 0.06 + lr() * 0.2, oz - 0.8 + lr() * 1.6), SMAT.bone]);
    for (const [x, z] of [[1.6, 2.2], [-1.4, 1.0], [0.8, 3.4]]) { const pk = hasPiece(CAVE_PK.skull) ? piece(CAVE_PK.skull, hx + x, fy(hx + x, hz + z), hz + z, x * 2, 1.2) : [[new THREE.IcosahedronGeometry(0.17, 1).scale(1, 0.9, 1.25).translate(hx + x, fy(hx + x, hz + z) + 0.15, hz + z), SMAT.bone]]; P.push(...pk); }   // (a few by the fire, where he ate)
    this.solid(ctx, ox, oz, 1.2, 0.9, oy);
    // his club, leant against the wall by his bed
    { const hit = surfaceFrom(R, [-3, 1.2, F.VC + 0.5], [-1, 0, 0.1]);
      if (hit) { const [wx, , wz] = hit.p, top = new THREE.Vector3(wx + hit.n[0] * 0.25, fy(wx, wz) + 2.6, wz + hit.n[2] * 0.25), base = new THREE.Vector3(wx + hit.n[0] * 1.15, 0, wz + hit.n[2] * 1.15); base.y = fy(base.x, base.z);
        const d = top.clone().sub(base), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
        P.push([new THREE.CylinderGeometry(0.34, 0.13, d.length(), 8).translate(0, d.length() / 2, 0).applyQuaternion(q).translate(base.x, base.y, base.z), W]);
        for (let k = 0; k < 5; k++) { const t = 0.72 + k * 0.05, p = base.clone().addScaledVector(d, t); P.push([new THREE.ConeGeometry(0.07, 0.3, 4).rotateZ(Math.PI / 2).rotateY(k * 1.4).translate(p.x, p.y, p.z), SMAT.bone]); }   // (studded with teeth)
        this.solid(ctx, base.x, base.z, 0.4, 2.2, base.y); } }
    // the hunts on the walls: giants with clubs and spears after deer, goats and boars, in red ochre and charcoal
    for (const [k, from, dir, w, h] of [[0, [0, 2.5, F.VC + 1], [-1, 0, 0.25], 4.6, 2.3], [1, [0, 2.7, F.VC - 1.5], [1, 0, -0.15], 4.8, 2.4], [2, [-1, 2.6, F.VC - 1], [-0.55, 0, -1], 3.6, 1.8]]) {
      const geo = wallDecal(R, from, dir, w, h); if (geo) { const sh = caveShade(clamp((F.MZ - from[2]) / (F.MZ - F.VC + F.RZ * 0.7), 0, 1)) * 0.8; ctx.grp.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: huntTex(i * 3 + k), color: new THREE.Color(sh, sh, sh), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 1 }))); }
    }
    // stalactites hanging from the roof in clusters, stalagmites rising under some of them and by the walls
    for (let k = 0; k < 14; k++) {
      const u = (lr() - 0.5) * F.RX * 1.5, v = F.VC + (lr() - 0.5) * F.RZ * 1.6, top = surfaceFrom(R, [u, 2.0, v], [0, 1, 0], 14); if (!top) continue;
      for (let q = 0; q < 1 + Math.floor(lr() * 4); q++) {
        const x = u + (lr() - 0.5) * 1.4, z = v + (lr() - 0.5) * 1.4, t = surfaceFrom(R, [x, 2.0, z], [0, 1, 0], 14); if (!t || t.p[1] - fy(x, z) < 5.2) continue;
        const L = 0.4 + lr() * lr() * 2.0; P.push([drip(L + 0.4, 0.07 + L * 0.1, x * 3 + z).rotateX(Math.PI).translate(x, t.p[1] + 0.2, z), DRIP]);
        if (lr() < 0.3) { const H = 0.3 + lr() * 0.8; P.push([drip(H + 0.1, 0.14 + H * 0.17, x + z * 5).translate(x, fy(x, z) - 0.1, z), DRIP]); }
      }
    }
    for (let k = 0; k < 22; k++) {
      const a = lr() * Math.PI * 2, from = [0, 0.6, F.VC], hit = surfaceFrom(R, from, [Math.cos(a), 0, Math.sin(a) * 1.15], 12); if (!hit) continue;
      const x = hit.p[0] + hit.n[0] * (0.5 + lr() * 0.6), z = hit.p[2] + hit.n[2] * (0.5 + lr() * 0.6), y0 = fy(x, z); if (Math.hypot(x - hx, z - hz) < 2.5 || Math.hypot(x - bx, z - bz) < 2.4 || Math.hypot(x - ox, z - oz) < 2.2 || (Math.abs(x) < 2 && z < F.VC - 4)) continue;
      const H = 0.4 + lr() * lr() * 1.8; P.push([drip(H + 0.1, 0.16 + H * 0.2, x * 2 - z).translate(x, y0 - 0.1, z), DRIP]); if (H > 0.9) this.solid(ctx, x, z, 0.2 + H * 0.12, H, y0);
      // and in the damp at the wall's foot, a cluster of pale mushrooms glowing faintly
      if (k % 3 === 0) for (let q = 0; q < 6; q++) { const mx = x + (lr() - 0.5) * 0.9, mz = z + (lr() - 0.5) * 0.9, my = fy(mx, mz), sh = 0.1 + lr() * 0.22, cr = 0.08 + lr() * 0.12; P.push([new THREE.CylinderGeometry(0.025, 0.035, sh, 5).translate(mx, my + sh / 2, mz), glow], [new THREE.SphereGeometry(cr, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1).translate(mx, my + sh, mz), glow]); }
    }
    // stones and grit along the walls (the blocks fallen from them are the rock's own: cave.js)
    for (let k = 0; k < 16; k++) { const a = lr() * Math.PI * 2, hit = surfaceFrom(R, [0, 0.3, F.VC], [Math.cos(a), 0, Math.sin(a) * 1.15], 12); if (!hit) continue; for (let q = 0; q < 3; q++) { const x = hit.p[0] + hit.n[0] * (0.4 + lr()) + (lr() - 0.5), z = hit.p[2] + hit.n[2] * (0.4 + lr()) + (lr() - 0.5); boulder(P, x, fy(x, z) + 0.04, z, 0.12 + lr() * 0.22, SMAT.grit, 1.2, 0.6, 1); } }
    // the carved stele at the back of the chamber, lit with a cold light so it can be found in the dark
    const back = surfaceFrom(R, [0, 1.4, F.VC], [0, 0, -1], 14), sz = (back ? back.p[2] : F.VC - F.RZ) + 1.5, sy = fy(0, sz);
    const st = (g) => g.rotateX(-0.1).translate(0, sy, sz);
    P.push([st(uvBox(1.6, 2.4, 0.35).translate(0, 1.2, 0)), GMAT.basalt], [uvBox(2.0, 0.3, 0.8).translate(0, sy + 0.12, sz), SMAT.rock]);
    for (const [w, h, x, y] of [[1.7, 0.12, 0, 2.42], [1.7, 0.12, 0, 0.05], [0.12, 2.4, -0.82, 1.2], [0.12, 2.4, 0.82, 1.2]]) P.push([st(uvBox(w, h, 0.4).translate(x, y, 0)), DRIP]);
    const glyphs = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.7), SMAT.glyph.clone()); glyphs.material.map = glyphTex(10 + i); glyphs.material.color.setHex(0xaee0ff); glyphs.material.emissive.setHex(0x60b0ff);
    glyphs.position.set(0, sy + 1.25 * Math.cos(0.1) + 0.175 * Math.sin(0.1), sz + 0.175 * Math.cos(0.1) - 1.25 * Math.sin(0.1) + 0.012); glyphs.rotation.x = -0.1; ctx.grp.add(glyphs);
    this.solid(ctx, 0, sz, 1.0, 2.6, sy); (this.glows ||= []).push({ p: this.w(ctx, 0, sz + 1.3, sy + 1.8), k: 7, d: 8, c: 0x86b8ff });
    this.uses.push({ kind: 'carving', id: 'cave' + i, at: this.w(ctx, 0, sz + 1.4, sy), r: 2.4, glyphs, cave: s });
    // outside: roots and ferns hanging over the mouth from the cliff above it, the hill's top wooded over the cave, and the
    // path worn down from the mouth (the blocks fallen at the cliff's foot are the rock's own, above)
    for (let u = -3.6; u <= 3.6; u += 0.45) {
      const lip = surfaceFrom(R, [u, 1.5, F.MZ + 1.0], [0, 1, 0], 10); if (!lip || lr() < 0.35) continue;
      const L = 0.8 + lr() * 2.2, x = lip.p[0], y = lip.p[1] + 0.25, z = lip.p[2], k = (lr() - 0.5) * 0.4;
      P.push([new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x, y, z), new THREE.Vector3(x + k, y - L * 0.5, z + 0.12), new THREE.Vector3(x + k * 1.6, y - L, z + 0.05)]), 6, 0.02 + lr() * 0.03, 4), SMAT.root]);
    }
    { const ferns = [], bush = [];
      for (let u = -9; u <= 9; u += 1.6) { const e = surfaceFrom(R, [u, F.HM + 1.2 + Math.abs(u) * 0.2, F.MZ + 9], [0, 0, -1], 14); if (!e || e.n[1] > 0.6) continue; const top = roofAt(R, e.p[0], e.p[2] - 1.2); if (top > -Infinity) (lr() < 0.6 ? ferns : bush).push([e.p[0], top - 0.1, e.p[2] - 1.0, 0.9 + lr() * 0.5, lr() * 6]); }
      this.scatter(ctx, 'fern', 0, ferns); this.scatter(ctx, 'bush', 1, bush); }
    { const trees = [[-6.5, F.VC - 1, 'qpine'], [5.5, F.VC - 5.5, 'fir'], [-2, F.VC - 10, 'holm'], [8, F.VC + 1.5, 'qpine'], [-9, F.VC - 7, 'fir']], under = [];
      for (const [u, v, sp] of trees) { const t = roofAt(R, u, v); if (t === -Infinity) continue; this.scatter(ctx, sp, Math.floor(lr() * 3), [[u, t - 0.3, v, 0.95 + lr() * 0.25, lr() * 6]]); this.solid(ctx, u, v, 0.45, 12, t - 0.3); for (let q = 0; q < 3; q++) { const a = lr() * 6.3, x = u + Math.cos(a) * 2.2, z = v + Math.sin(a) * 2.2, y = roofAt(R, x, z); if (y > -Infinity) under.push([x, y - 0.1, z, 0.8 + lr() * 0.4, a]); } }
      this.scatter(ctx, 'fern', 1, under.filter((_, k) => k % 2)); this.scatter(ctx, 'bush', 0, under.filter((_, k) => !(k % 2))); }
    { const c = this.w(ctx, 0, F.MZ + 14); clearGrass('cavePath' + i, { x: c.x, z: c.z, hw: 2.4, hd: 13, rot: ctx.rot }); }
    this.finish(ctx);
  }
  // ---- the summit of Olympos: the old altar of Zeus, alone above the clouds. A ring of weathered standing stones round
  // the top, open where the path comes up; inside it the carved altar on two worn marble steps with a fire that never
  // goes out, the bronze eagle of Zeus on a broken column behind it, looking out over the island, and the offerings left
  // at its foot by the few who climbed before (cups, a plate of coins, a laurel wreath, a jar, bowls), a fallen statue
  // in the snow. Down the mountain, cairns mark the path (gen.js PEAK.route), a stele and a great cairn where it starts,
  // and the rock steps on the crest under the top (PEAK.steps) are boulders. Praying here (trial.js) opens the whole
  // island on your map, once. Site-local +z looks down the crest, the way the path comes up.
  summit(s) {
    const rot = Math.PI / 2 - PEAK.a, ctx = this.site(s, rot), P = ctx.P, lr = dice(77), c = Math.cos(rot), sn = Math.sin(rot);
    const loc = (x, z) => [(x - s.x) * c - (z - s.z) * sn, (x - s.x) * sn + (z - s.z) * c];   // (world → site-local)
    const AE = (k) => 'all/polygonancientempire/' + k, rock = (x, y, z, r, sx = 1, sy = 1, sz = 1, yaw = 0) => { const T = []; boulder(T, 0, 0, 0, r, SMAT.rock, sx, sy, sz); P.push([T[0][0].rotateY(yaw).translate(x, y, z), SMAT.rock]); };
    const cairn = (x, z, n, r0) => { const y0 = this.groundY(ctx, x, z); for (let k = 0; k < n; k++) { const t = k / n, a = lr() * 6.28, o = (1 - t) * r0 * 0.35; rock(x + Math.cos(a) * o, y0 + 0.1 + t * r0 * 2.6, z + Math.sin(a) * o, r0 * (1 - t * 0.6), 1, 0.7, 1, lr() * 3); } this.solid(ctx, x, z, r0 * 0.9); };
    // the two steps and the altar on them
    for (const [w, d, h] of [[4.2, 3.6, 0.2], [3.0, 2.5, 0.4]]) { P.push([uvBox(w, h + 0.4, d, 1 / 2).translate(0, h / 2 - 0.2, 0), SMAT.marble]); this.top(ctx, -w / 2, w / 2, -d / 2, d / 2, h); }
    if (hasPiece('plBomos')) { P.push(...piece('plBomos', 0, 0.4, 0, 0, [2.05, 1.4, 1.3]), ...piece('plFireBowl', 0, 1.35, 0, 0, 0.85)); this.fire(ctx, 0, 1.75, 0, 0.9); }   // (the pack's carved altar block and a bronze fire bowl)
    else { P.push([uvBox(1.6, 0.9, 1.0).translate(0, 0.85, 0), SMAT.marble], [uvBox(1.8, 0.14, 1.2).translate(0, 1.37, 0), SMAT.marble]); tripod(P, 0, 1.44, 0, 0.6); this.fire(ctx, 0, 2.1, 0, 0.9); }
    this.solid(ctx, 0, 0, 1.0, 1.6); this.uses.push({ kind: 'olympos', at: this.w(ctx, 0, 0, 0.4), r: 3.2 });
    // the offerings: on the steps and in the snow at the altar's foot
    const off = (k, x, y, z, r = 0, sc = 1) => P.push(...piece(k, x, y, z, r, sc));
    off(AE('sm-prop-goblet-01'), -0.55, 0.4, 0.75, 0.4); off(AE('sm-prop-goblet-02'), 0.7, 0.4, 0.8, 1.2); off(AE('sm-prop-goblet-01'), 1.05, 0.2, 1.45, 2.1);
    off(AE('sm-prop-plate-01'), -1.05, 0.2, 1.4, 0.3, 0.55); off('all/polygongeneric/sm-gen-prop-coin-pile-01', -1.05, 0.25, 1.4, 0.8, 0.5);
    off(AE('sm-chr-attach-crown-leaf-01'), 0.15, 0.42, 1.0, 0.6, 1.4);
    bowl(P, 1.4, 0.0, -0.9, 1.6); bowl(P, -1.6, 0.0, -0.5, 1.3); jug(P, -1.75, 0.0, 0.6, 1.1); amphora(P, 2.4, 0.22, 0.9, 0.8, Math.PI / 2 - 0.1, 0.7);
    // the eagle on its column, behind the altar, looking out the way the path comes up
    const ey = 3.6; if (hasPiece(AE('sm-bld-pillar-monument-01-damaged-01'))) P.push(...piece(AE('sm-bld-pillar-monument-01-damaged-01'), 0, 0, -3.4, 0.3, 0.3)); else column(P, 0, 0, -3.4, ey, 0.34, SMAT.marble);
    if (hasPiece('all/pnb-alpine-mountain/fx-hawk-01')) P.push(...piece('all/pnb-alpine-mountain/fx-hawk-01', 0, ey - 0.3, -3.4, Math.PI / 2, 1.6).map(([g]) => [g, GMAT.bronze]));
    else { const E = GMAT.bronze;   // (a carved one, wings half spread)
      P.push([new THREE.SphereGeometry(0.32, 10, 8).scale(0.8, 0.9, 1.4).translate(0, ey + 0.35, -3.4), E], [new THREE.SphereGeometry(0.16, 8, 6).translate(0, ey + 0.72, -3.05), E], [new THREE.ConeGeometry(0.07, 0.2, 5).rotateX(Math.PI / 2).translate(0, ey + 0.68, -2.86), GMAT.gold]);
      for (const sx of [-1, 1]) P.push([new THREE.BoxGeometry(1.3, 0.05, 0.5).translate(sx * 0.65, 0, 0).rotateZ(sx * 0.45).translate(sx * 0.18, ey + 0.55, -3.45), E]); }
    this.solid(ctx, 0, -3.4, 0.6);
    // the ring of standing stones, open towards the path; a fallen statue and column drums in the snow
    for (let k = 0; k < 11; k++) { const a = Math.PI / 2 + 0.5 + (k / 10) * (Math.PI * 2 - 1.0), r = 6.6 + lr() * 0.8, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.6 + lr() * 1.1, y = this.groundY(ctx, x, z);
      rock(x, y + h * 0.4, z, 0.55, 0.9 + lr() * 0.5, h * 1.4, 0.7, -a); this.solid(ctx, x, z, 0.6); }
    const fallen = sitePropAt('broken2', 1); if (fallen) P.push([fallen[0].rotateY(1.9).translate(-3.6, 0, -1.2), fallen[1]]);
    for (const [x, z, a] of [[3.3, -2.2, 0.4], [4.1, -1.1, 1.3]]) P.push([new THREE.CylinderGeometry(0.34, 0.34, 0.75, 16).rotateZ(Math.PI / 2).rotateY(a).translate(x, 0.3, z), SMAT.marble]);
    cairn(-2.6, 5.2, 9, 0.42);
    // the rock steps on the crest: a boulder over each, its top where the path goes on
    for (const st of PEAK.steps) {
      const [x, z] = loc(st.x, st.z), lx = Math.sin(st.a) * c - Math.cos(st.a) * sn, lz = Math.sin(st.a) * sn + Math.cos(st.a) * c, y = st.y - s.y;
      rock(x + lx * 0.75, y + 0.5, z + lz * 0.75, 1, 2.1, 0.95, 1.05, Math.atan2(lx, lz));
      for (const side of [-1, 1]) rock(x + lx * 0.4 + lz * side * 1.9, y + 0.3, z + lz * 0.4 - lx * side * 1.9, 0.75 + lr() * 0.3, 1, 1.2, 1, lr() * 3);
    }
    // cairns along the path, every 80 m or so, on its outer edge; the stele and a great cairn at its foot
    const R = PEAK.route; for (let i = 40; i < R.length - 60; i += 40) { const a = R[i - 1], b = R[i + 1], l = Math.hypot(b.x - a.x, b.z - a.z) || 1, [x, z] = loc(R[i].x + (b.z - a.z) / l * 2.2, R[i].z - (b.x - a.x) / l * 2.2); cairn(x, z, 5, 0.26); }
    if (R.length) { const [x, z] = loc(R[0].x, R[0].z), y = this.groundY(ctx, x - 2.4, z); cairn(x + 2.4, z, 11, 0.5); P.push([uvBox(0.6, 1.5, 0.2).rotateZ(0.06).rotateY(rot + PEAK.a).translate(x - 2.4, y + 0.6, z), SMAT.marble]); this.solid(ctx, x - 2.4, z, 0.4); }
    this.finish(ctx, { r: 7 });
  }
  // ---- queries
  // ground height at a site-local point, relative to the site (for things standing beyond its levelled pad)
  groundY(ctx, x, z) { const p = this.w(ctx, x, z); return heightAt(p.x, p.z) - ctx.s.y; }
  // a stand of one tree or bush, drawn as one batch (a draw a part however many there are): at site-local [x, z, size] on
  // the ground, each turned its own way (r: its trunk's radius at size 1, blocking)
  grove(ctx, name, v, list, r = 0) {
    if (!list.length) return; const pg = propGeo(name, v), g = new THREE.Group(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const [geo, mat] of [[pg.geo, propMat], pg.cards ? [pg.cards, pg.cardMat || leafMat] : null].filter(Boolean)) {
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, z, s], i) => m.setMatrixAt(i, m4.compose(p.set(x, this.groundY(ctx, x, z), z), q.setFromAxisAngle(up, (x * 7.3 + z * 3.1) % 6.28), sc.setScalar(s))));
      m.castShadow = m.receiveShadow = true; m.computeBoundingSphere(); g.add(m);
    }
    ctx.grp.add(g); if (r) for (const [x, z, s] of list) this.solid(ctx, x, z, r * s);
  }
  // Italian cypresses (CYPRESS) at site-local [x, z, size, stretch] on the ground, in one batch, each turned its own way
  cypresses(ctx, list) {
    const m = new THREE.InstancedMesh(CYPRESS, propMat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3();
    list.forEach(([x, z, s, k = 1], i) => { m.setMatrixAt(i, m4.compose(p.set(x, this.groundY(ctx, x, z) - 0.2, z), q.setFromAxisAngle(up, (x * 5.1 + z * 2.3) % 6.28), sc.set(s, s * k, s))); this.solid(ctx, x, z, 0.35 * s); });
    m.castShadow = m.receiveShadow = true; m.computeBoundingSphere(); ctx.grp.add(new THREE.Group().add(m));   // (in a group of its own: occlusion.js fades a site's meshes whole, and one tree in the way would fade the avenue)
  }
  // a stand of one plant or stone from the vegetation set at given places [x, y, z, size, turn] (site-local), one batch
  // (in a group of its own, like the cypresses, so the occlusion fade takes one at a time)
  scatter(ctx, name, v, list) {
    if (!list.length) return; const pg = propGeo(name, v), g = new THREE.Group(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const [geo, mat] of [[pg.geo, propMat], pg.cards ? [pg.cards, pg.cardMat || leafMat] : null].filter(Boolean)) {
      const m = new THREE.InstancedMesh(geo, mat, list.length); list.forEach(([x, y, z, s, a], i) => m.setMatrixAt(i, m4.compose(p.set(x, y, z), q.setFromAxisAngle(up, a), sc.setScalar(s))));
      m.castShadow = m.receiveShadow = true; m.computeBoundingSphere(); g.add(m);
    }
    ctx.grp.add(new THREE.Group().add(g));
  }
  // a tree or bush from the vegetation set, standing at a site (drawn at any distance, unlike the streamed ones)
  plant(ctx, name, v, x, y, z, sc = 1) {
    const pg = propGeo(name, v), g = new THREE.Group(), I = new THREE.Matrix4();
    for (const [geo, mat] of [[pg.geo, propMat], pg.cards ? [pg.cards, pg.cardMat || leafMat] : null].filter(Boolean)) { const m = new THREE.InstancedMesh(geo, mat, 1); m.setMatrixAt(0, I); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; g.add(m); }
    g.position.set(x, y, z); g.scale.setScalar(sc); g.rotation.y = (v * 2.1 + x) % 6.28; ctx.grp.add(g); return g;
  }
  local(t, x, z) { const dx = x - t.ctx.s.x, dz = z - t.ctx.s.z, c = Math.cos(-t.ctx.rot), s = Math.sin(-t.ctx.rot); return [dx * c + dz * s, -dx * s + dz * c]; }
  floorAt(x, z, y, step = 0.6) { let best = -Infinity; for (const t of this.tops) { if (Math.abs(x - t.ctx.s.x) > 75 || Math.abs(z - t.ctx.s.z) > 75) continue; const [lx, lz] = this.local(t, x, z); if (lx >= t.x0 && lx <= t.x1 && lz >= t.z0 && lz <= t.z1) { const ty = t.ctx.s.y + t.y; if (ty <= y + step && ty > best) best = ty; } }
    for (const k of this.caveRocks || []) { if (Math.abs(x - k.ctx.s.x) > 70 || Math.abs(z - k.ctx.s.z) > 70) continue; const [u, v] = this.local(k, x, z), ty = k.ctx.s.y + roofAt(k.R, u, v); if (ty <= y + step && ty > best) best = ty; }   // (the hill's rock over a cave)
    return best; }
  underRoof(p) { if (this.inCave(p)) return true; for (const t of this.roofs) { if (Math.abs(p.x - t.ctx.s.x) > 75 || Math.abs(p.z - t.ctx.s.z) > 75) continue; const [lx, lz] = this.local(t, p.x, p.z); if (lx >= t.x0 && lx <= t.x1 && lz >= t.z0 && lz <= t.z1 && t.ctx.s.y + t.y > p.y + 1) return true; } return false; }
  // in a cave, under its rock (out of the rain, the wind and the sky)
  inCave(p) { for (const k of this.caveRocks || []) { if (Math.abs(p.x - k.ctx.s.x) > 40 || Math.abs(p.z - k.ctx.s.z) > 40) continue; const [u, v] = this.local(k, p.x, p.z), y = p.y - k.ctx.s.y; if (densityAt(k.R, u, y + 1, v) <= 0 && surfaceFrom(k.R, [u, y + 1, v], [0, 1, 0], 16)) return true; } return false; }
  // how far along a → b the rock of a cave first lies (to keep the camera inside the cave with the hero), or null
  rayBlock(a, b) {
    let best = null;
    for (const k of this.caveRocks || []) { if (Math.abs(a.x - k.ctx.s.x) > 50 || Math.abs(a.z - k.ctx.s.z) > 50) continue; const A = this.local(k, a.x, a.z), B = this.local(k, b.x, b.z), y = k.ctx.s.y, d = rayRock(k.R, [A[0], a.y - y, A[1]], [B[0], b.y - y, B[1]]); if (d !== null && (best === null || d < best)) best = d; }
    return best;
  }
  nearSacredFire(p) { return this.lights.some((l) => l.distanceTo(p) < 6); }
  update(dt) {
    const t = performance.now() * 0.001, P = this.g.player.pos;
    this.flames.forEach((f, i) => { f.scale.set(1, 1 + Math.sin(t * 11 + i) * 0.12 + Math.sin(t * 5.3 + i * 2) * 0.08, 1); f.rotation.y = t * 0.6; });
    this.lights.forEach((p, i) => { if (p.distanceToSquared(P) < 80 * 80) askLight(p, 18 * (1 + Math.sin(t * 13 + i) * 0.08), 18); });
    for (const q of this.glows || []) if (q.p.distanceToSquared(P) < 40 * 40) askLight(q.p, q.k, q.d, q.c);   // (the caves' steles, lit cold)
    for (const u of this.uses) if (u.glyphs) u.glyphs.material.emissiveIntensity = u.taken ? 0.15 : 1.2 + Math.sin(t * 2 + u.at.x) * 0.4;
    for (const u of this.uses) if (u.beacon?.visible) { moveBeacon(u.beacon, t, this.cam); askLight(u.at.clone().setY(u.at.y + 2.4), 14, 12, 0xffc860); }   // (the stand lit gold too)
    void dt;
  }
}
// An olive's offering fire (and a giant's, its smoke darker: tint), beyond the flame fire() makes: a hotter core inside it (returned, to flicker with the flames)
// and a thin column of smoke, soft puffs each rising and widening as it fades, drifting a little to one side. Each puff
// moves itself when it's drawn (onBeforeRender), from the clock alone, so it costs nothing while the site is out of sight.
let SMOKE = null;
function offeringFire(grp, x, y, z, seed, tint = 0xd6d1c8) {
  SMOKE ||= {
    tex: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');   // (a few soft blobs together: a puff, not a ball)
      for (const [bx, by, br] of [[32, 34, 26], [22, 28, 16], [42, 26, 15], [30, 20, 14]]) { const gr = g.createRadialGradient(bx, by, 0, bx, by, br); gr.addColorStop(0, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
      return new THREE.CanvasTexture(c); })(),
    core: new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.26, 7, 1, true).translate(0, 0.13, 0), SMOKE.core); core.position.set(x, y, z); grp.add(core);
  const N = 18, RISE = 9, H = 6, drift = seed * 2.4;   // (a puff takes RISE seconds to climb H metres)
  for (let k = 0; k < N; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE.tex, color: tint, transparent: true, opacity: 0, depthWrite: false, rotation: k * 2.3 }));
    sp.frustumCulled = false; sp.renderOrder = 3; grp.add(sp);
    sp.onBeforeRender = () => {
      const t = performance.now() / 1000, u = (t / RISE + k / N) % 1, lean = u * u * 1.1;
      sp.position.set(x + Math.cos(drift) * lean + Math.sin(t * 0.9 + k * 1.7) * 0.07 * u, y + 0.35 + u * H, z + Math.sin(drift) * lean + Math.cos(t * 0.7 + k) * 0.07 * u);
      sp.scale.setScalar(0.35 + u * 1.9); sp.material.rotation = k * 2.3 + u * 1.5; sp.material.opacity = Math.min(1, u * 5) * Math.pow(1 - u, 1.6); sp.updateMatrixWorld();
    };
  }
  return core;
}
// The rock of the Giants' caves: the terrain's own material (the colours in the vertices, the ground's painted detail, the
// bare rock's surface where 'rock' says), without the cuts under buildings and with puddles left to the ground
let CAVE_MAT = null;
function caveMat() {
  if (CAVE_MAT) return CAVE_MAT;
  CAVE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: groundDetail, envMapIntensity: 0.4 }); rockGround(CAVE_MAT);
  CAVE_MAT.customProgramCacheKey = () => 'caveRock'; return wettable(CAVE_MAT, { dark: 0.54, gloss: 0.4, shine: 0.3 });
}
// A hunt daubed on a cave's wall (each its own): giants with clubs and spears, deer, goats and boars running before them,
// a sun, handprints, in red ochre and charcoal, the strokes rough and faded in places
function huntTex(seed) {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); let sd = seed * 131 + 7; const r = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646;
  g.lineCap = g.lineJoin = 'round';
  const ink = (a) => (r() < 0.75 ? `rgba(${120 + r() * 40},${38 + r() * 18},${22 + r() * 10},${a})` : `rgba(28,22,18,${a})`);
  const line = (pts, w, col) => { for (let k = 0; k < 2; k++) { g.strokeStyle = col; g.lineWidth = w * (0.8 + r() * 0.4); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + (r() - 0.5) * 2, y + (r() - 0.5) * 2) : g.moveTo(x, y))); g.stroke(); } };
  const beast = (x, y, s, f, col) => {   // (a running four-legged beast, facing f: horns or antlers on some)
    g.fillStyle = col; g.beginPath(); g.ellipse(x, y, 22 * s, 9 * s, 0, 0, 7); g.fill();
    line([[x + f * 18 * s, y - 4 * s], [x + f * 30 * s, y - 14 * s], [x + f * 36 * s, y - 10 * s]], 5 * s, col);
    for (const [lx, d] of [[-14, -1], [-8, 1], [10, -1], [16, 1]]) line([[x + lx * s, y + 5 * s], [x + (lx + d * 6) * s, y + 22 * s]], 3 * s, col);
    line([[x - f * 22 * s, y - 2 * s], [x - f * 30 * s, y - 8 * s]], 2.5 * s, col);
    if (r() < 0.6) for (const k of [-1, 1]) line([[x + f * 30 * s, y - 14 * s], [x + f * (28 + k * 4) * s, y - 28 * s], [x + f * (34 + k * 6) * s, y - 34 * s]], 2 * s, col);
  };
  const giant = (x, y, s, col) => {   // (a man twice as tall as the beasts, a club or a spear raised)
    line([[x, y - 46 * s], [x, y - 8 * s]], 6 * s, col); g.fillStyle = col; g.beginPath(); g.arc(x, y - 54 * s, 8 * s, 0, 7); g.fill();
    line([[x, y - 8 * s], [x - 10 * s, y + 18 * s]], 5 * s, col); line([[x, y - 8 * s], [x + 12 * s, y + 18 * s]], 5 * s, col);
    line([[x, y - 38 * s], [x - 16 * s, y - 22 * s]], 4 * s, col); line([[x, y - 38 * s], [x + 18 * s, y - 52 * s]], 4 * s, col);
    if (r() < 0.5) line([[x + 18 * s, y - 52 * s], [x + 30 * s, y - 70 * s]], 9 * s, col); else line([[x + 4 * s, y - 40 * s], [x + 60 * s, y - 70 * s]], 2.5 * s, col);
  };
  const n = 2 + Math.floor(r() * 2); for (let k = 0; k < n; k++) giant(50 + k * 80 + r() * 25, 190 + r() * 20, 1.4 + r() * 0.3, ink(0.75 + r() * 0.2));
  for (let k = 0; k < 3 + Math.floor(r() * 2); k++) beast(250 + k * 70 + r() * 25, 120 + r() * 70, 1.0 + r() * 0.5, 1, ink(0.65 + r() * 0.3));
  g.strokeStyle = ink(0.6); g.lineWidth = 5; g.beginPath(); g.arc(440 + r() * 40, 50, 22, 0, 7); g.stroke(); for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.28; line([[440 + Math.cos(a) * 28, 50 + Math.sin(a) * 28], [440 + Math.cos(a) * 40, 50 + Math.sin(a) * 40]], 3, ink(0.5)); }
  for (let k = 0; k < 5; k++) { const x = 30 + r() * 160, y = 30 + r() * 70; g.fillStyle = ink(0.45); g.beginPath(); g.ellipse(x, y, 9, 11, 0, 0, 7); g.fill(); for (let f = 0; f < 5; f++) { const a = -2.6 + f * 0.5; line([[x + Math.cos(a) * 8, y + Math.sin(a) * 9], [x + Math.cos(a) * 20, y + Math.sin(a) * 22]], 4, ink(0.45)); } }
  // faded and flaked: the rock showing through in patches, the edges soft
  g.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 260; k++) { g.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.5})`; g.beginPath(); g.arc(r() * W, r() * H, 2 + r() * 10, 0, 7); g.fill(); }
  const fade = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.55); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = fade; g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// A decal laid on a cave's rock (cave.js field R, site-local): the wall found along dir from a point in the chamber, a
// w × h sheet there, each of its points pressed onto the rock a few centimetres proud of it, so it follows the bumps
function wallDecal(R, from, dir, w, h) {
  const l = Math.hypot(...dir), d = dir.map((x) => x / l), hit = surfaceFrom(R, from, d, 14); if (!hit) return null;
  const n = new THREE.Vector3(...hit.n), t = new THREE.Vector3(0, 1, 0).cross(n).normalize(), b = n.clone().cross(t).normalize(), c = new THREE.Vector3(...hit.p);
  const NX = 16, NY = 8, pos = new Float32Array((NX + 1) * (NY + 1) * 3), uv = new Float32Array((NX + 1) * (NY + 1) * 2), idx = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const k = j * (NX + 1) + i, p = c.clone().addScaledVector(t, (i / NX - 0.5) * w).addScaledVector(b, (j / NY - 0.5) * h), q = surfaceFrom(R, p.clone().addScaledVector(n, 1.2).toArray(), n.clone().negate().toArray(), 2.6);
    (q ? new THREE.Vector3(...q.p).addScaledVector(n, 0.04) : p).toArray(pos, k * 3); uv[k * 2] = 1 - i / NX; uv[k * 2 + 1] = j / NY;
    if (i < NX && j < NY) idx.push(k, k + 1, k + NX + 2, k, k + NX + 2, k + NX + 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
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
