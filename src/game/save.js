// Saving the world in the browser: the player, the pack, time and the trial's progress, everything built, every tree
// felled and stone taken, the explored map, graves. Saved every minute and when the page closes.
import * as THREE from 'three';
import { loadPack, bake } from '../assets.js';

const KEY = 'argonisos.world.v1';
export const hasSave = () => { try { return !!localStorage.getItem(KEY); } catch { return false; } };
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* private mode */ } }

// The layout of the land (which trees and pickups stand where). Saves remember felled trees and gathered pickups by their
// place in that layout, so when it changes (2: the woods of Pedias and bare rock on steep ground, Patch 4; 3: woods over
// most of Pedias, Patch 5; 4: the abandoned town and the small scenes about the island, Patch 11) an older save keeps
// everything else but lets the trees and pickups come back.
const WORLD_LAYOUT = 4;
export function save(g) {
  const P = g.player, S = g.S;
  const data = {
    v: 1, world: WORLD_LAYOUT, at: Date.now(),
    S: { time: S.time, day: S.day, tier: S.tier || 0, bed: S.bed, trial: S.trial, map: S.map, owl: S.owl, guide: S.guide },
    player: { x: P.pos.x, y: P.pos.y, z: P.pos.z, yaw: P.yaw, cam: P.camYaw, stats: P.stats.toJSON() },
    inv: g.inv.toJSON(), build: g.build.toJSON(), harvest: g.harvest.toJSON(), pickups: g.pickups.toJSON(),
    fog: g.map.fog.toDataURL('image/png'), graves: g.graves?.toJSON() || [], offered: g.trial.st.offered,
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { console.warn('save failed', e); return false; }
}

export function load(g) {
  let d; try { d = JSON.parse(localStorage.getItem(KEY)); } catch { return false; } if (!d || d.v !== 1) return false;
  const P = g.player, S = g.S;
  Object.assign(S, { time: d.S.time, day: d.S.day, tier: d.S.tier, bed: d.S.bed });
  if (d.S.trial) Object.assign(g.trial.st, d.S.trial);
  if (d.S.map) Object.assign(g.map.st, d.S.map);
  if (d.S.owl) Object.assign(g.owl.st, d.S.owl);
  if (d.S.guide) Object.assign(g.guide.st, d.S.guide);
  // the pack and the hero
  g.inv.load(d.inv);
  const st = d.player.stats; P.stats.health = st.health; P.stats.stamina = st.stamina; P.stats.cond = st.cond || {}; P.stats.skills = st.skills || P.stats.skills;
  P.stats.food = (st.food || []).map((f) => ({ id: f.id, t: f.t, def: g.ITEMS[f.id].food }));
  P.spawn(d.player.x, d.player.z); P.pos.y = d.player.y; P.yaw = d.player.yaw; P.camYaw = d.player.cam;
  // the world's changes
  if ((d.world || 1) === WORLD_LAYOUT) {
    for (const id of d.harvest.removed || []) g.veg.removed.add(id);
    g.harvest.hp = new Map(d.harvest.hp || []); g.harvest.picked = new Map(d.harvest.picked || []);
    for (const s of d.harvest.stumps || []) g.harvest.addStump(s.x, s.y, s.z, s.r);
    g.pickups.load(d.pickups);
  } else { g.pickups.load({ taken: [], drops: d.pickups?.drops || [] }); setTimeout(() => g.hud.toast('The land has changed since you were last here: the trees and what lies on the ground have grown back'), 4000); }
  g.build.load(d.build || []);
  for (const u of g.structures.uses) { if (u.kind === 'scrap' && g.trial.st.scraps.includes(u.id)) u.taken = true; if (u.kind === 'carving' && g.trial.st.carvings.includes(u.id)) u.taken = true; if (u.kind === 'offering' && g.trial.st.offered[u.boss]) g.trial.mountHead(u); if (u.kind === 'loot' && g.trial.st.looted.includes(u.id) && u.lid) u.lid.rotation.x = -1.2; }
  g.trial.drawPower();
  if (d.fog) { const im = new Image(); im.onload = () => { const c = g.map.fctx; c.clearRect(0, 0, g.map.fog.width, g.map.fog.height); c.drawImage(im, 0, 0); }; im.src = d.fog; }
  g.graves?.load(d.graves || []);
  g.crafting.discover(true);
  return true;
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
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, 40, 8, 1, true).translate(0, 20, 0), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    grp.add(beam); this.g.scene.add(grp);
    const gr = { grp, stone, beam, x, y, z, slots }; this.dress(gr); this.list.push(gr); return gr;
  }
  // on death: put everything you carry in a grave
  fall() { const P = this.g.player, slots = this.g.inv.slots.map((s) => (s ? { ...s, worn: undefined } : null)).filter(Boolean); if (!slots.length) return; this.make(P.pos.x, P.pos.y, P.pos.z, slots); this.g.inv.slots.fill(null); this.g.inv.onChange?.(); }
  interactable(pos) { for (const gr of this.list) if (Math.hypot(gr.x - pos.x, gr.z - pos.z) < 2.2) return { label: 'Take back your belongings', sub: 'Your grave', use: () => this.recover(gr) }; return null; }
  recover(gr) { for (const s of gr.slots) { const left = this.g.inv.add(s.id, s.n, s.dur !== undefined ? { dur: s.dur } : {}); if (left) this.g.pickups.drop(s.id, left, gr.x, gr.z, undefined, gr.y); } this.g.scene.remove(gr.grp); this.list.splice(this.list.indexOf(gr), 1); this.g.sound?.('reveal'); this.g.hud.toast('You take back what was yours'); }
  update(dt) { const t = performance.now() * 0.001; for (const gr of this.list) gr.beam.material.opacity = 0.14 + Math.sin(t * 2) * 0.05; void dt; }
  toJSON() { return this.list.map((g) => ({ x: g.x, y: g.y, z: g.z, slots: g.slots })); }
  load(list) { for (const o of list) this.make(o.x, o.y, o.z, o.slots); }
}
