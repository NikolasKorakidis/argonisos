// The Build tab: an empty field with the hero at the origin, where pack models are placed, moved, turned and scaled to
// try little scenes out. The scene is kept in this browser (localStorage, when it's there) and goes out as JSON,
// { version: 1, items: [{ id, x, y, z, rotY, scale }] }: each model's own pivot in metres, its turn about the vertical in
// radians, so it can be turned into game content later.
import * as THREE from 'three';
import { loadModel, copyModel, hero } from './look.js';

const KEY = 'argonisos.dev.scene', DEG = Math.PI / 180;
const store = { get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* no storage: the scene lives for the visit */ } } };
const round = (v, k = 1000) => Math.round(v * k) / k;
const helper = (c) => { const h = new THREE.Box3Helper(new THREE.Box3(), c); h.material.depthTest = false; h.material.transparent = true; h.renderOrder = 5; h.visible = false; return h; };

export class Sandbox {
  constructor(scene, view, catalogue, labels) {
    this.view = view; this.cat = catalogue; this.labels = labels; this.root = new THREE.Group(); this.root.visible = false; scene.add(this.root);
    this.items = []; this.sel = null; this.ghost = null; this.drag = null; this.undos = []; this.redos = []; this.snap = 0; this.uid = 1;
    this.templates = new Map(); this.onSelect = () => {}; this.onChange = () => {}; this.mouse = null;
    this.hoverBox = helper(0xffffff); this.selBox = helper(0xffc861); this.root.add(this.hoverBox, this.selBox);
    hero().then((h) => { h.rotation.y = 0; this.root.add(h); });
    this.heroLabel = labels.add('hero · 1.95 m', new THREE.Vector3(0, 2.15, 0), { cls: 'head', prio: 1 });
    const saved = store.get(); if (saved?.items) this.sync(saved.items.map((it) => ({ ...it, uid: this.uid++ })));
  }
  get active() { return this.root.visible; }
  // one copy of each model's file, from which every placed one is cloned
  template(id) {
    if (!this.templates.has(id)) this.templates.set(id, loadModel(id).then((m) => { m.updateMatrixWorld(true); m.userData.rest = -new THREE.Box3().setFromObject(m).min.y; return m; }));
    return this.templates.get(id);
  }
  // ---- the scene as data: every change goes through here, so undo can put any earlier state back
  state() { return this.items.map(({ uid, id, x, y, z, rotY, scale }) => ({ uid, id, x, y, z, rotY, scale })); }
  commit() { this.undos.push(JSON.stringify(this.state())); if (this.undos.length > 200) this.undos.shift(); this.redos = []; }
  undo() { if (!this.undos.length) return; this.redos.push(JSON.stringify(this.state())); this.sync(JSON.parse(this.undos.pop())); }
  redo() { if (!this.redos.length) return; this.undos.push(JSON.stringify(this.state())); this.sync(JSON.parse(this.redos.pop())); }
  sync(list) {
    const keep = new Map(this.items.map((it) => [it.uid, it])), next = [];
    for (const d of list) {
      let it = keep.get(d.uid); keep.delete(d.uid);
      if (!it || it.id !== d.id) { if (it) this.drop(it); it = this.make(d); }
      Object.assign(it, { x: d.x, y: d.y, z: d.z, rotY: d.rotY, scale: d.scale }); this.pose(it); next.push(it);
    }
    for (const it of keep.values()) this.drop(it);
    this.items = next; if (this.sel && !next.includes(this.sel)) this.select(null); else this.select(this.sel);
    this.changed();
  }
  make(d) {
    const it = { uid: d.uid ?? this.uid++, id: d.id, x: 0, y: 0, z: 0, rotY: 0, scale: 1, obj: new THREE.Group(), item: this.cat?.byId.get(d.id) || null };
    this.uid = Math.max(this.uid, it.uid + 1); it.obj.userData.placed = it; this.root.add(it.obj);
    this.template(d.id).then((t) => { if (!it.obj.parent) return; it.obj.add(copyModel(t)); it.rest = t.userData.rest; if (this.sel === it) this.select(it); })
      .catch(() => { it.missing = true; const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0xff6a50, wireframe: true })); it.obj.add(b); });   // (not on this machine: a red box keeps its place)
    return it;
  }
  drop(it) { it.obj.removeFromParent(); }   // (geometry belongs to the template, kept for the next copy)
  pose(it) { it.obj.position.set(it.x, it.y, it.z); it.obj.rotation.set(0, it.rotY, 0); it.obj.scale.setScalar(it.scale); }
  changed() {
    clearTimeout(this.saving); this.saving = setTimeout(() => store.set({ version: 1, items: this.state() }), 250);
    this.onChange();
  }
  // ---- what the page asks of it
  setActive(on) { this.root.visible = on; this.labels.layer.style.display = on ? '' : 'none'; if (!on) this.cancel(); }
  select(it) {
    this.sel = it; if (it) { it.obj.updateMatrixWorld(true); this.selBox.box.setFromObject(it.obj); }
    this.selBox.visible = !!it && !this.selBox.box.isEmpty(); if (it) this.hoverBox.visible = false;
    this.onSelect(it);
  }
  // A model to place: its ghost follows the cursor over the ground; a click puts it down (Shift+click: and another)
  async place(item) {
    this.cancel(); const token = this.ghostToken = {};
    const t = await this.template(item.id).catch(() => null); if (!t || token !== this.ghostToken) return;
    const g = copyModel(t), mats = new Map();
    g.traverse((m) => { if (!m.isMesh) return; m.castShadow = false; m.material = [].concat(m.material).map((x) => { if (!mats.has(x)) { const c = x.clone(); c.transparent = true; c.opacity = 0.55; c.depthWrite = false; mats.set(x, c); } return mats.get(x); }); if (m.material.length === 1) m.material = m.material[0]; });
    this.ghost = { item, obj: g, mats: [...mats.values()], rest: t.userData.rest, rotY: this.lastRot || 0, scale: 1 };
    this.root.add(g); this.moveGhost(); this.onChange();
  }
  cancel() { this.ghostToken = null; if (!this.ghost) return; this.ghost.obj.removeFromParent(); for (const m of this.ghost.mats) m.dispose(); this.ghost = null; this.onChange(); }
  snapped(v) { if (this.snap) { v.x = Math.round(v.x / this.snap) * this.snap; v.z = Math.round(v.z / this.snap) * this.snap; } return v; }
  moveGhost() {
    const G = this.ghost; if (!G || !this.mouse) return; const p = this.view.groundAt(this.mouse.x, this.mouse.y); if (!p) return;
    this.snapped(p); G.obj.position.set(p.x, G.rest * G.scale, p.z); G.obj.rotation.y = G.rotY; G.obj.scale.setScalar(G.scale);
  }
  hit(e) {
    const ray = this.view.ray(e.clientX, e.clientY), h = ray.intersectObjects(this.items.map((it) => it.obj), true).find((x) => x.object.isMesh);
    let o = h?.object; while (o && !o.userData.placed) o = o.parent; return o?.userData.placed || null;
  }
  // a press on a placed model selects it and starts dragging it over the ground (the camera doesn't get that press)
  claim(e) {
    if (!this.active || e.button !== 0 || this.ghost || e.shiftKey) return false;
    const it = this.hit(e); if (!it) return false;
    this.select(it); const p = this.view.groundAt(e.clientX, e.clientY, it.y) || new THREE.Vector3(it.x, it.y, it.z);
    this.drag = { it, id: e.pointerId, dx: it.x - p.x, dz: it.z - p.z, moved: false, sx: e.clientX, sy: e.clientY };
    this.view.dom.setPointerCapture(e.pointerId); return true;
  }
  pointerMove(e) {
    this.mouse = { x: e.clientX, y: e.clientY };
    const D = this.drag;
    if (D && D.id === e.pointerId) {
      if (!D.moved && Math.hypot(e.clientX - D.sx, e.clientY - D.sy) < 3) return;
      if (!D.moved) { D.moved = true; this.commit(); }
      const p = this.view.groundAt(e.clientX, e.clientY, D.it.y); if (!p) return;
      const v = this.snapped(new THREE.Vector3(p.x + D.dx, 0, p.z + D.dz)); D.it.x = round(v.x); D.it.z = round(v.z); this.pose(D.it); this.select(D.it); return;
    }
    this.moveGhost();
    const it = !this.ghost && !this.view.drag ? this.hit(e) : null;
    if (it) { it.obj.updateMatrixWorld(true); this.hoverBox.box.setFromObject(it.obj); } this.hoverBox.visible = !!it && it !== this.sel && !this.hoverBox.box.isEmpty();
    this.view.dom.style.cursor = it ? 'move' : this.ghost ? 'crosshair' : '';
  }
  pointerUp(e) { const D = this.drag; if (!D || D.id !== e.pointerId) return; this.drag = null; if (D.moved) this.changed(); }
  click(e) {
    const G = this.ghost;
    if (G) {
      this.commit(); const p = G.obj.position, it = this.make({ id: G.item.id });
      Object.assign(it, { x: round(p.x), y: round(p.y), z: round(p.z), rotY: round(G.rotY, 1e4), scale: round(G.scale, 1e4) }); this.pose(it); this.items.push(it);
      this.lastRot = G.rotY; if (!e.shiftKey) this.cancel(); this.select(it); this.changed(); return;
    }
    this.select(this.hit(e));
  }
  // ---- the keys; true when one was used
  key(e) {
    const T = this.ghost || this.sel, cmd = e.ctrlKey || e.metaKey, alt = e.altKey;
    if (cmd && e.code === 'KeyZ') { e.shiftKey ? this.redo() : this.undo(); return true; }
    if (cmd && e.code === 'KeyY') { this.redo(); return true; }
    if (e.code === 'Escape') { if (this.ghost) this.cancel(); else this.select(null); return true; }
    if (!T) return false;
    const it = this.ghost ? null : this.sel, edit = (fn) => { if (it) { this.commit(); fn(it); this.pose(it); this.select(it); this.changed(); } else { fn(this.ghost); this.moveGhost(); } };
    if (e.code === 'KeyR' && !cmd) { const a = (alt ? 1 : 15) * DEG * (e.shiftKey ? -1 : 1); edit((o) => { o.rotY = round(((o.rotY + a) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), 1e4); }); this.lastRot = T.rotY; return true; }
    if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
      const k = Math.pow(alt ? 1.01 : 1.1, e.code === 'BracketRight' ? 1 : -1);
      edit((o) => { const was = (o.rest ?? 0) * o.scale, on = !it || Math.abs(o.y - was) < 0.002; o.scale = round(THREE.MathUtils.clamp(o.scale * k, 0.01, 100), 1e4); if (it && on) o.y = round((o.rest ?? 0) * o.scale); });   // (one standing on the ground stays on it)
      return true;
    }
    if (!it) return false;
    if ((e.code === 'KeyE' || e.code === 'KeyQ') && !cmd) { const s = (alt ? 0.05 : 0.25) * (e.code === 'KeyE' ? 1 : -1); edit((o) => { o.y = round(o.y + s); }); return true; }
    if (e.code === 'End') { edit((o) => { o.y = round((o.rest ?? 0) * o.scale); }); return true; }
    if (e.code === 'Delete' || e.code === 'Backspace') { this.commit(); this.items = this.items.filter((x) => x !== it); this.drop(it); this.select(null); this.changed(); return true; }
    if (cmd && e.code === 'KeyD') {
      this.commit(); const c = this.make({ id: it.id }), step = this.snap || 1; Object.assign(c, { x: round(it.x + step), y: it.y, z: round(it.z + step), rotY: it.rotY, scale: it.scale });
      c.rest = it.rest; this.pose(c); this.items.push(c); this.select(c); this.changed(); return true;
    }
    return false;
  }
  // ---- out and in
  toJSON() { return { version: 1, items: this.items.map(({ id, x, y, z, rotY, scale }) => ({ id, x: round(x), y: round(y), z: round(z), rotY: round(rotY, 1e4), scale: round(scale, 1e4) })) }; }
  load(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    if (d?.version !== 1 || !Array.isArray(d.items)) throw new Error('not an Argonisos scene (version 1, items)');
    const list = d.items.filter((it) => typeof it?.id === 'string').map((it) => ({ uid: this.uid++, id: it.id, x: +it.x || 0, y: +it.y || 0, z: +it.z || 0, rotY: +it.rotY || 0, scale: +it.scale || 1 }));
    this.commit(); this.sync(list); return list.length;
  }
  clear() { if (!this.items.length) return; this.commit(); this.sync([]); }
  update() { if (this.sel && this.sel.obj.children.length) { this.sel.obj.updateMatrixWorld(true); this.selBox.box.setFromObject(this.sel.obj); this.selBox.visible = true; } }
  boxOf(it) { it.obj.updateMatrixWorld(true); return new THREE.Box3().setFromObject(it.obj); }
}
