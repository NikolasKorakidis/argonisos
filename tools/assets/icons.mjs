// Inventory icons from the game's own models, the way the tester asked for them ("a screenshot of the 3D asset on an
// off-white background", like Unity's Model2Icon): node tools/assets/icons.mjs [name…]
// Each icon is the item's model as the game shows it (a tool as the hero holds it, player/held.js; a building piece as
// it's built, build/kit.js; a pickup or anything from the pack catalogue, assets/models/pack/), seen from three quarters
// above in a soft studio light and saved as a 128 px WebP with a clear background: the slot behind it is the off-white
// (ui.css), so the same picture sits on a square slot, a round food badge or a toast. The interface sprites the game
// uses from SharpUI (the tester's UI pack) are copied over at the same time, made smaller. Both are pack art, so they go
// to assets/ui/pack/ (git-ignored like assets/models/pack/), with index.json listing what's there: without it the game
// keeps its black-figure SVG icons and its own CSS. Names given on the command line redo only those icons.
import fs from 'node:fs';
import path from 'node:path';
import { serve, ROOT } from '../../tests/lib/server.mjs';
import { launch } from '../../tests/lib/harness.mjs';

const OUT = path.join(ROOT, 'assets/ui/pack'), SIZE = 128;

// What each icon shows, by the icon name the game uses (items.js; build pieces as p_<piece id>). One source each:
// held: an item's model in the hand · kit: a building piece's model · pack: a converted model ('all/<pack>/<model>' for
// any in the catalogue). How it's laid out: pose 'tool' lays a long thing corner to corner, head to the top right (spin
// turns it about its own length first, to show its best side); otherwise it's seen from yaw/pitch degrees (35/28: from
// the front right, above). turn and tilt: the model's own yaw and roll. tint: its colours multiplied; mat: every
// material replaced ({ color, roughness, metalness, emissive }); only: the names of the parts to show; fill: how much
// of the frame it fills.
const T = (o = {}) => ({ pose: 'tool', ...o });
const ICONS = {
  // materials
  stone: { pack: 'pStone', tint: 0x9c968c }, branch: { pack: 'pBranch2', yaw: 20, pitch: 50 }, log: { pack: 'all/polygonnature/sm-tree-log-01', yaw: 30 },
  wood: { pack: 'sFirewood' }, feather: { pack: 'pFeather', pitch: 55, fill: 0.9, tint: 0xd8d0c0 },
  lightstone: { pack: 'pLight0', mat: { color: 0x98a2b0, roughness: 0.25, metalness: 0.4, emissive: 0x18243a, flatShading: true } },
  coal: { pack: 'pStone', mat: { color: 0x2b2724, roughness: 0.6, metalness: 0.2 }, turn: 70 },
  resin: { pack: 'all/pnb-enchanted-forest/sm-prop-crystal-02', mat: { color: 0xd88a1c, roughness: 0.25, emissive: 0x3a1a00 } },
  rope: { pack: 'all/polygonvikings/sm-prop-rope-02' }, fiber: { pack: 'all/polygonancientempire/sm-prop-straw-bundle-01' },
  leather: { pack: 'all/rpgpp-ag/rpgpp-ag-cloth-01', tint: 0xc08a58 },
  bone: { pack: 'all/pnb-swamp-marshland/sm-prop-bone-01', pitch: 45 },
  dandelion: { pack: 'pDandelion0', pitch: 20 }, moonflower: { pack: 'pMoon0', pitch: 20 },
  cone: { pack: 'all/pnb-alpine-mountain/sm-env-pine-cone-01' },
  foxHide: { pack: 'all/polygonvikings/sm-prop-fur-roll-01', tint: 0xff9a5a }, deerHide: { pack: 'all/polygonvikings/sm-prop-fur-roll-02', tint: 0xd8a070 },
  rabbitHide: { pack: 'all/polygonvikings/sm-prop-fur-roll-03', tint: 0xe8ddd0 }, boarHide: { pack: 'all/polygonvikings/sm-prop-fur-roll-01', tint: 0x8a6a58 },
  giantHide: { pack: 'all/polygonvikings/sm-prop-fur-roll-02', tint: 0xb0a090 }, minotaurHide: { pack: 'all/polygonvikings/sm-prop-fur-roll-03', tint: 0x6a4030 },
  chimeraHide: { pack: 'all/polygonvikings/sm-prop-fur-roll-01', tint: 0xd8b060 },
  heart: { pack: 'all/pnb-enchanted-forest/sm-prop-crystal-05', mat: { color: 0x7fbf4a, roughness: 0.3, emissive: 0x1a3a08 } },
  oliveScrap: { pack: 'all/polygonancientempire/sm-prop-scroll-01' }, caveCarving: { pack: 'sStele', yaw: 25, pitch: 15 },
  // food
  meat: { pack: 'all/polygongeneric/sm-gen-prop-food-meat-01' }, cookedMeat: { pack: 'all/polygongeneric/sm-gen-prop-food-meat-02' },
  spoiledMeat: { pack: 'all/polygongeneric/sm-gen-prop-food-meat-01', tint: 0x8a9a60 },
  fish: { pack: 'all/polygonvikings/sm-prop-fish-01', pitch: 40 }, cookedFish: { pack: 'all/polygonvikings/sm-prop-fish-01', pitch: 40, tint: 0xc08050 },
  spoiledFish: { pack: 'all/polygonvikings/sm-prop-fish-01', pitch: 40, tint: 0x7a8a58 },
  pomegranate: { pack: 'all/polygongeneric/sm-gen-prop-food-vegetable-01', tint: 0xd06a78 },
  // tools and weapons, as held
  hammer: T({ held: 'hammer' }), hoe: T({ held: 'hoe' }), torch: T({ held: 'torch' }), pickaxe: T({ held: 'pickaxe' }),
  axe: T({ held: 'crudeAxe' }), axeLight: T({ held: 'lightstoneAxe' }), dagger: T({ held: 'crudeDagger' }), daggerLight: T({ held: 'lightstoneDagger' }),
  club: T({ held: 'crudeClub' }), bow: T({ held: 'crudeBow' }), cretanBow: T({ held: 'cretanBow' }),
  spear: T({ held: 'crudeSpear' }), spearLight: T({ held: 'lightstoneSpear' }), arrow: T({ pack: 'arrow' }),
  shield: { held: 'crudeShield', yaw: 200, pitch: 15 }, towerShield: { held: 'crudeTowerShield', yaw: 200, pitch: 15 },
  // armour: the parts the hero wears (heroArmour, wear_<item>), standing as worn; the cape from the Ancient Empire pack
  throwerHelmet: { pack: 'heroArmour', only: ['wear_throwerHelmet'] }, throwerArmor: { pack: 'heroArmour', only: ['wear_throwerArmor'], arms: 12, yaw: 25, pitch: 15 },
  throwerLegs: { pack: 'heroArmour', only: ['wear_throwerLegs'], yaw: 25, pitch: 15 },
  cretanHelmet: { pack: 'heroArmour', only: ['wear_cretanHelmet'] }, cretanArmor: { pack: 'heroArmour', only: ['wear_cretanArmor'], arms: 12, yaw: 25, pitch: 15 },
  cretanLegs: { pack: 'heroArmour', only: ['wear_cretanLegs'], yaw: 25, pitch: 15 },
  cape: { pack: 'all/polygonancientempire/sk-chr-attach-cape-01', yaw: 200, pitch: 15 },
  // building pieces (the build menu shows these by piece; crafting's Build list by their shared icon names below, which
  // the conditions, the map and the patch notes keep drawn: ui/icons.js glyph)
  ...Object.fromEntries(['wall', 'wallHalf', 'doorframe', 'door', 'beamV', 'beamH', 'beamD', 'floor', 'roof63', 'roof65', 'roof94', 'end63', 'end65', 'end94',
    'stairs', 'stairsLong', 'fence', 'stockade', 'awning', 'gateL', 'gateR', 'workbench', 'campfire', 'bed', 'cookingStand', 'chest', 'torchStand'].map((id) => ['p_' + id, { kit: id, pitch: 24 }])),
  wall: { kit: 'wall', pitch: 24 }, door: { kit: 'doorframe', pitch: 24 }, beam: { kit: 'beamV', pitch: 24 }, floor: { kit: 'floor', pitch: 35 },
  roofEnd: { kit: 'end63', pitch: 24 }, stairs: { kit: 'stairs', pitch: 24 }, fence: { kit: 'fence', pitch: 24 }, stockade: { kit: 'stockade', pitch: 24 },
  gate: { kit: 'gateL', pitch: 24 }, chest: { kit: 'chest', pitch: 24 }, roof: { kit: 'roof63', pitch: 30 }, anvil: { kit: 'workbench', pitch: 24 },
  fire: { kit: 'campfire', pitch: 30 }, rested: { kit: 'bed', pitch: 30 },
};
// The SharpUI sprites the interface uses (ui.css, under html.packui), made smaller (scale) so their nine-slice borders
// stay whole numbers or halves
const UI = {
  slot: ['square_button_neutral', 1 / 3], slotOn: ['square_button_selected', 1 / 3], round: ['round_button', 1 / 4], roundOn: ['round_button_selected', 1 / 4],
  button: ['rect_button', 1 / 2], header: ['dialog_header_background', 1 / 2], bar: ['resourc_bar_frame', 1 / 2], barFill: ['resource_bar_fill', 1 / 2],
  box: ['info_box', 1 / 2], line: ['notification_line', 1 / 2], fade: ['fade_line_bi_linear', 1 / 2], load: ['loading_bar_frame', 1 / 2], loadFill: ['loading_bar_inner', 1 / 2],
  scroll: ['scroll_background', 1], thumb: ['scroll_handle', 1],
};

// ---- the page: renders one icon at a time (window.icon(job) → a WebP data URL, job.size square) and shrinks sprites (window.sprite)
async function page() {
  const THREE = await import('three'), { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
  const { heldModel } = await import('../../src/player/held.js'), { loadKit } = await import('../../src/build/kit.js'), { loadPack } = await import('../../src/assets.js');
  const S = 512, r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(S, S); r.setClearColor(0x000000, 0); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(), pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(r), 0.04).texture;
  // soft light from the upper left, a fill from the sky and the ground, a little rim from behind
  scene.add(new THREE.HemisphereLight(0xfff6e6, 0x7a6650, 1.1));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.2), rim = new THREE.DirectionalLight(0xdfe8ff, 0.9); scene.add(key, rim);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100); scene.add(cam);
  const D = Math.PI / 180, v = new THREE.Vector3();
  const pieces = {};
  async function model(job) {
    if (job.held) { const m = await heldModel(job.held); if (!m) throw new Error('no held model'); return m; }
    if (job.kit) {
      const p = pieces[job.kit] ||= { id: job.kit }; if (!p.meshes) await loadKit([p]); if (!p.meshes) throw new Error('no kit model');
      const g = new THREE.Group(); for (const { geo, mat } of p.meshes) g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: mat.map, color: 0xb4b4b4, roughness: 0.85 }))); return g;
    }
    const gl = await loadPack(job.pack); return gl.scene;
  }
  // textures stream in after the model: wait for every one (or a black icon comes out)
  async function textured(root) {
    const maps = new Set(); root.traverse((o) => { if (o.isMesh) for (const mt of [].concat(o.material)) for (const k of ['map', 'emissiveMap', 'normalMap']) if (mt[k]) maps.add(mt[k]); });
    for (let t = 0; t < 200 && [...maps].some((m) => !(m.image?.width > 0) || m.image.complete === false); t++) await new Promise((ok) => setTimeout(ok, 50));
  }
  window.icon = async (job) => {
    const m = await model(job), root = new THREE.Group(), turn = new THREE.Group(); turn.add(m); root.add(turn); scene.add(root);
    try {
      await textured(m);
      if (job.arms !== undefined) for (const side of ['Left', 'Right']) {   // (armour on a T-posed rig: its arms let down, job.arms degrees out from the side)
        const b = m.getObjectByName('mixamorig' + side + 'Arm'), c = m.getObjectByName('mixamorig' + side + 'ForeArm'); if (!b || !c) continue; m.updateWorldMatrix(true, true);
        const from = c.getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3())).normalize(), to = new THREE.Vector3(Math.sign(from.x) * Math.sin(job.arms * D), -Math.cos(job.arms * D), 0);
        const world = new THREE.Quaternion().setFromUnitVectors(from, to).multiply(b.getWorldQuaternion(new THREE.Quaternion()));
        b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
      }
      m.traverse((o) => { if (!o.isMesh) return; if (job.only && !job.only.includes(o.name)) { o.visible = false; return; } o.frustumCulled = false;
        const mats = [].concat(o.material).map((mt) => { if (job.mat) { const c = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, ...job.mat }); c.side = mt.side; return c; }
          const c = mt.clone(); if (job.tint !== undefined) c.color?.multiply(new THREE.Color(job.tint)); return c; });
        o.material = Array.isArray(o.material) ? mats : mats[0]; });
      let yaw = (job.yaw ?? 35) * D, pitch = (job.pitch ?? 28) * D;
      if (job.pose === 'tool') { turn.rotation.y = (job.spin ?? 0) * D; root.rotation.z = -Math.PI / 4; yaw = (job.yaw ?? 18) * D; pitch = (job.pitch ?? 12) * D; }
      else { turn.rotation.y = (job.turn ?? 0) * D; turn.rotation.z = (job.tilt ?? 0) * D; }
      const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      cam.position.copy(dir).multiplyScalar(50); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
      key.position.copy(cam.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.7).add(new THREE.Vector3(0, 30, 0)); rim.position.copy(dir).multiplyScalar(-50).add(new THREE.Vector3(0, 20, 0));
      // framed by the model's own points as the camera sees them (skinned parts posed as worn)
      root.updateMatrixWorld(true); const lo = new THREE.Vector3(Infinity, Infinity, Infinity), hi = lo.clone().negate();
      root.traverse((o) => { if (!o.isMesh || !o.visible) return; const n = o.geometry.attributes.position.count;
        for (let i = 0; i < n; i++) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld).applyMatrix4(cam.matrixWorldInverse); lo.min(v); hi.max(v); } });
      if (!isFinite(lo.x)) throw new Error('nothing to see');
      const cx = (lo.x + hi.x) / 2, cy = (lo.y + hi.y) / 2, h = Math.max(hi.x - lo.x, hi.y - lo.y) / 2 / (job.fill ?? 0.86);
      cam.left = cx - h; cam.right = cx + h; cam.top = cy + h; cam.bottom = cy - h; cam.near = -hi.z - 1; cam.far = -lo.z + 1; cam.updateProjectionMatrix();
      r.render(scene, cam);
      return shrink(r.domElement, job.size, job.size);
    } finally { scene.remove(root); }
  };
  // halving steps down to the size wanted, so the edges stay smooth
  function shrink(src, w, h) {
    let c = src, cw = src.width, ch = src.height;
    while (cw / 2 >= w && ch / 2 >= h && (cw > w || ch > h)) { const n = document.createElement('canvas'); n.width = cw = Math.round(cw / 2); n.height = ch = Math.round(ch / 2); const x = n.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, cw, ch); c = n; }
    if (cw !== w || ch !== h || !c.toDataURL) { const n = document.createElement('canvas'); n.width = w; n.height = h; const x = n.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, w, h); c = n; }
    return c.toDataURL('image/webp', 0.92);
  }
  window.sprite = async (url, k) => { const im = new Image(); im.src = url; await im.decode(); return shrink(im, Math.round(im.width * k), Math.round(im.height * k)); };
  window.ready = true;
}

const want = process.argv.slice(2), names = want.length ? want : Object.keys(ICONS);
for (const n of names) if (!ICONS[n]) { console.error(`no icon called ${n}`); process.exit(1); }
const sharp = (() => { const base = path.join(ROOT, 'incoming assets'); const find = (d, depth) => { if (depth > 4 || !fs.existsSync(d)) return null; if (fs.existsSync(path.join(d, 'SharpUI/Textures'))) return path.join(d, 'SharpUI/Textures');
  for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) { const f = find(path.join(d, e.name), depth + 1); if (f) return f; } return null; }; return find(base, 0); })();

const server = await serve(), browser = await launch(), tab = await browser.newPage();
tab.on('pageerror', (e) => console.error('page:', e.message));
const html = `<!doctype html><meta charset="utf-8"><script type="importmap">{ "imports": { "three": "/vendor/three/three.module.js", "three/examples/": "/node_modules/three/examples/" } }</script>
<script type="module">(${page})()</script>`;
await tab.route('**/tools/assets/__icons.html', (rt) => rt.fulfill({ contentType: 'text/html', body: html }));
await tab.goto(server.url + '/tools/assets/__icons.html');   // (a page that isn't on disk: the module paths are relative to this folder)
await tab.waitForFunction(() => window.ready, null, { timeout: 60000 });
const write = (file, url) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); };
let made = 0;
for (const n of names) {
  try { write(path.join(OUT, 'icons', n + '.webp'), await tab.evaluate((j) => window.icon(j), { ...ICONS[n], size: SIZE })); made++; }
  catch (e) { console.warn(`${n}: ${e.message.split('\n')[0]} (keeps its SVG)`); fs.rmSync(path.join(OUT, 'icons', n + '.webp'), { force: true }); }
}
if (sharp) fs.rmSync(path.join(OUT, 'ui'), { recursive: true, force: true });
if (sharp) for (const [k, [file, s]] of Object.entries(UI)) write(path.join(OUT, 'ui', k + '.webp'), await tab.evaluate(([u, s]) => window.sprite(u, s), ['/' + path.relative(ROOT, path.join(sharp, file + '.png')).split(path.sep).map(encodeURIComponent).join('/'), s]));
else console.warn('SharpUI not found under incoming assets/: the interface keeps its own look');
// what's there, for the game (ui/icons.js)
const list = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)).sort() : []);
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ made: new Date().toISOString(), icons: Object.keys(ICONS).filter((n) => fs.existsSync(path.join(OUT, 'icons', n + '.webp'))).sort(), ui: list(path.join(OUT, 'ui')) }, null, 1) + '\n');
console.log(`${made} of ${names.length} icons → ${path.relative(ROOT, OUT)}/icons${sharp ? `, ${Object.keys(UI).length} interface sprites → ui` : ''}`);
await browser.close(); server.close();
