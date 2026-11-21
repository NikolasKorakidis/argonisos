// Saving the world in the browser: the player, the pack, time and the trial's progress, everything built, every tree
// felled and stone taken, the explored map, graves. Saved every minute and when the page closes.
import * as THREE from 'three';
import { loadPack, bake } from '../assets.js';
import { ITEMS } from './items.js';
import { SKILLS, BASE } from '../player/stats.js';

const KEY = 'argonisos.world.v1', BAK = KEY + '.bak', LOST = 'argonisos.saveLost';
// What the player is told when a save couldn't be read (the title screen and a toast): it is kept, not thrown away
export const SAVE_LOST = 'Your saved world could not be loaded (it is damaged, or from a version too different). A copy of it is kept in this browser, and a new trial begins.';
export const hasSave = () => { try { return !!localStorage.getItem(KEY); } catch { return false; } };
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* private mode */ } }

// The layout of the land (which trees and pickups stand where). Saves remember felled trees and gathered pickups by their
// place in that layout, so when it changes (2: the woods of Pedias and bare rock on steep ground, Patch 4; 3: woods over
// most of Pedias, Patch 5; 4: the abandoned town and the small scenes about the island, Patch 11; 5: the temple's hill,
// its marble precinct and the meadow cleared round it; 6: a fifth fewer trees in the meadows' woods, new trees in the
// hills, the mushrooms gone and tomato bushes in the meadows, Patch 20) an older save keeps everything else but lets the
// trees and pickups come back.
const WORLD_LAYOUT = 6;
export function save(g) {
  const P = g.player, S = g.S;
  // (saved on the death screen: as you'll wake, at your bed with the pack in the grave, Zeus's Favour on you and no food)
  const dead = P.dead || P.stats.dead, wake = dead ? S.bed || g.spawnAt || P.pos : null, Y = wake && wake !== P.pos ? undefined : P.pos.y;
  const stats = P.stats.toJSON(); if (dead) Object.assign(stats, { health: BASE.health, stamina: BASE.stamina, food: [], cond: { zeusBuff: 90 } });
  const data = {
    v: 1, world: WORLD_LAYOUT, at: Date.now(),
    S: { time: S.time, day: S.day, tier: S.tier || 0, bed: S.bed, trial: S.trial, map: S.map, owl: S.owl, guide: S.guide },
    player: { x: wake ? wake.x : P.pos.x, y: Y, z: wake ? wake.z : P.pos.z, yaw: P.yaw, cam: P.camYaw, stats, look: P.hero.look },
    inv: g.inv.toJSON(), build: g.build.toJSON(), harvest: g.harvest.toJSON(), pickups: g.pickups.toJSON(),
    fog: g.map.fog.toDataURL('image/png'), graves: g.graves?.toJSON() || [], offered: g.trial.st.offered,
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { console.warn('save failed', e); return false; }
}

// Load the save, if there is one. Returns true when it loaded, false when there was none; 'lost' when it couldn't be read
// (damaged, or made by a version this one can't follow): it is moved aside to KEY.bak, kept, and the page is to start
// again on a new trial (game.js), told so then (g.saveLost: the title screen and a toast). Should moving it aside fail
// (storage blocked), it is left where it was and this page goes on without saving over it.
export function load(g) {
  let raw; try { raw = localStorage.getItem(KEY); g.saveLost = !!sessionStorage.getItem(LOST); sessionStorage.removeItem(LOST); } catch { return false; }
  if (!raw) return false;
  try { const d = JSON.parse(raw); if (!d || d.v !== 1 || !d.player || !d.S || !d.inv) throw new Error('not a save this version knows'); loadSave(g, d); return true; }
  catch (e) {
    console.warn('the save could not be loaded; kept as', BAK, e);
    try { localStorage.removeItem(KEY); localStorage.setItem(BAK, raw); sessionStorage.setItem(LOST, '1'); return 'lost'; }
    catch { try { localStorage.setItem(KEY, raw); } catch { /* still there, or nowhere to put it */ } g.saveBlocked = g.saveLost = true; return false; }
  }
}
// What an older save holds that this version no longer knows is left out: items (in the pack, worn, in chests, dropped,
// in graves, eaten) whose ids are gone, and skills are merged onto this version's, so one added since starts
// at level 1 rather than missing
const known = (s) => !!(s && ITEMS[s.id]);
const wearable = (s) => { const d = ITEMS[s.id]; return d.type === 'armor' ? d.slot === s.worn : (d.type === 'shield' || d.bow ? 'left' : 'hand') === s.worn && ['tool', 'weapon', 'shield'].includes(d.type); };
function loadSave(g, d) {
  const P = g.player, S = g.S;
  Object.assign(S, { time: d.S.time, day: d.S.day, tier: d.S.tier, bed: d.S.bed });
  if (d.S.trial) Object.assign(g.trial.st, d.S.trial);
  if (d.S.map) Object.assign(g.map.st, d.S.map);
  if (d.S.owl) Object.assign(g.owl.st, d.S.owl);
  if (d.S.guide) Object.assign(g.guide.st, d.S.guide);
  if (S.trial?.fight) { (S.trial.paid ||= {})[S.trial.fight] = true; delete S.trial.fight; }   // (saved mid-fight: the beast is gone, its tribute still on the altar, trial.js)
  // the pack and the hero
  g.inv.load({ slots: d.inv.slots || [], seen: d.inv.seen || [] });   // (seen keeps more than items: '@workbench'; inventory.js leaves out unknown slots)
  for (const s of g.inv.slots) if (s?.worn && !wearable(s)) delete s.worn;
  const st = d.player.stats || {}; P.stats.health = st.health ?? BASE.health; P.stats.stamina = st.stamina ?? BASE.stamina; P.stats.cond = st.cond || {};
  for (const k of Object.keys(SKILLS)) Object.assign(P.stats.skills[k], st.skills?.[k]);
  P.stats.food = (st.food || []).filter((f) => ITEMS[f.id]?.food).map((f) => ({ id: f.id, t: f.t, def: ITEMS[f.id].food }));
  P.spawn(d.player.x, d.player.z); if (Number.isFinite(d.player.y)) P.pos.y = d.player.y; P.yaw = d.player.yaw ?? P.yaw; P.camYaw = d.player.cam ?? P.camYaw;
  if (d.player.look) P.hero.setLook(d.player.look);   // (the look made in the creator; older saves keep the one last chosen here)
  // the world's changes
  if ((d.world || 1) === WORLD_LAYOUT) {
    for (const id of d.harvest.removed || []) g.veg.removed.add(id);
    g.harvest.hp = new Map(d.harvest.hp || []); g.harvest.picked = new Map(d.harvest.picked || []); g.harvest.bare = new Map(d.harvest.bare || []);   // (bare: the tomato bushes picked, drawn so once loaded: harvest.js growBack)
    for (const s of d.harvest.stumps || []) g.harvest.addStump(s.x, s.y, s.z, s.r);
    g.harvest.loadLogs(d.harvest.logs || []);   // (the felled trees' logs, where they came to rest: harvest.js)
    g.pickups.load({ taken: d.pickups?.taken || [], drops: (d.pickups?.drops || []).filter((q) => ITEMS[q.item]) });
  } else { g.pickups.load({ taken: [], drops: (d.pickups?.drops || []).filter((q) => ITEMS[q.item]) }); setTimeout(() => g.hud.toast('The land has changed since you were last here: the trees and what lies on the ground have grown back'), 4000); }
  for (const p of d.build || []) { if (p.state?.slots) p.state.slots = p.state.slots.map((s) => (known(s) ? s : null)); }
  g.build.load(d.build || []);
  for (const u of g.structures.uses) { if (u.kind === 'scrap' && g.trial.st.scraps.includes(u.id)) u.taken = true; if (u.kind === 'carving' && g.trial.st.carvings.includes(u.id)) u.taken = true; if (u.kind === 'offering' && g.trial.st.offered[u.boss]) g.trial.mountHead(u); if (u.kind === 'loot' && g.trial.st.looted.includes(u.id) && u.lid) u.lid.rotation.x = -1.2; }
  for (const k of Object.keys(g.trial.st.broken || {})) g.structures.ruin(k, { live: false });   // (a site a boss broke stays in ruins: trial.js stage)
  g.trial.drawPower();
  if (d.fog) { const im = new Image(); im.onload = () => { const c = g.map.fctx, W = g.map.fog.width, H = g.map.fog.height; c.clearRect(0, 0, W, H); c.drawImage(im, 0, 0, W, H); }; im.src = d.fog; }   // (stretched to the mask's size: older saves kept a smaller one)
  g.graves?.load((d.graves || []).map((gr) => ({ ...gr, slots: (gr.slots || []).filter(known) })).filter((gr) => gr.slots.length));
  g.crafting.discover(true);
}

// ---- graves: when you fall, everything you carried stays where you fell, under a little marble stele with a light (the
// Ancient Empire pack's marble finial on its plinth, tools/assets sStele, once it's loaded; a carved slab without the pack)
const STELE_H = 1.1, steleMat = new THREE.MeshStandardMaterial({ color: 0xe0d8c8, roughness: 0.6 });
export class Graves {
  constructor(g) {
    this.g = g; this.list = []; this.stele = null;
    loadPack('sStele').then((gl) => {
      let map = null; gl.scene.traverse((m) => { if (m.isMesh && !map) map = m.material.map; });
      const geo = bake(gl.scene); geo.computeBoundingBox(); const b = geo.boundingBox, k = STELE_H / (b.max.y - b.min.y);
      geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2).scale(k, k, k);
      this.stele = { geo, mat: new THREE.MeshStandardMaterial({ map, color: 0xa8a49c, roughness: 0.6 }) }; for (const gr of this.list) this.dress(gr);
    }).catch(() => {});
  }
  dress(gr) {
    const st = gr.stone; st.clear(); const add = (geo, mat, y = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = m.receiveShadow = true; st.add(m); };
    if (this.stele) { add(this.stele.geo, this.stele.mat); return; }
    add(new THREE.BoxGeometry(0.5, 0.9, 0.16), steleMat, 0.45); add(new THREE.CylinderGeometry(0.25, 0.25, 0.16, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), steleMat, 0.9);
  }
  make(x, y, z, slots) {
    const grp = new THREE.Group(); grp.position.set(x, y, z);
    const stone = new THREE.Group(); grp.add(stone);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, 40, 8, 1, true).translate(0, 20, 0), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }));   // (one pass: added light needs no order)
    grp.add(beam); this.g.scene.add(grp);
    const gr = { grp, stone, beam, x, y, z, slots }; this.dress(gr); this.list.push(gr); return gr;
  }
  // on death: put everything you carry in a grave
  fall() { const P = this.g.player, slots = this.g.inv.slots.map((s) => (s ? { ...s, worn: undefined } : null)).filter(Boolean); if (!slots.length) return; this.make(P.pos.x, P.pos.y, P.pos.z, slots); this.g.inv.slots.fill(null); this.g.inv.onChange?.(); }
  interactable(pos) { for (const gr of this.list) if (Math.hypot(gr.x - pos.x, gr.z - pos.z) < 2.2) return { label: 'Take back your belongings', sub: 'Your grave', use: () => this.recover(gr) }; return null; }
  recover(gr) { for (const s of gr.slots) { const left = this.g.inv.add(s.id, s.n, s.dur !== undefined ? { dur: s.dur } : {}); if (left) this.g.pickups.drop(s.id, left, gr.x, gr.z, undefined, gr.y); } this.g.scene.remove(gr.grp); this.list.splice(this.list.indexOf(gr), 1); this.g.sound?.('chime'); this.g.hud.toast('You take back what was yours'); }
  update(dt) { const t = performance.now() * 0.001; for (const gr of this.list) gr.beam.material.opacity = 0.14 + Math.sin(t * 2) * 0.05; void dt; }
  toJSON() { return this.list.map((g) => ({ x: g.x, y: g.y, z: g.z, slots: g.slots })); }
  load(list) { for (const o of list) this.make(o.x, o.y, o.z, o.slots); }
}
