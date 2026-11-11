// The Browse tab's gallery: one page of the filtered models laid out on the ground in rows, each group on rows of its
// own, small to large (as tools/assets/library.py lays them out in Blender), the hero at the start of every row. Each
// model shows first as a faint box of its catalogue size, so the layout is there at once, and loads in nearest to the
// view first, a few at a time; a new page drops (and frees) the old one.
import * as THREE from 'three';
import { loadModel, disposeModel, hero } from './look.js';

const ROW = 36, LOADING = 6;   // (a row's length before it wraps, in metres; files loading at once)
const boxMat = new THREE.MeshBasicMaterial({ color: 0xf4e6c4, transparent: true, opacity: 0.07, depthWrite: false }), edgeMat = new THREE.LineBasicMaterial({ color: 0xf4e6c4, transparent: true, opacity: 0.35 });
const failMat = new THREE.LineBasicMaterial({ color: 0xff6a50 });
export const short = (s, n = 30) => s.length > n ? s.slice(0, n - 1) + '…' : s;

export class Gallery {
  constructor(scene, labels) {
    this.root = new THREE.Group(); scene.add(this.root); this.labels = labels; this.entries = []; this.heroes = []; this.gen = 0; this.active = 0; this.rows = [];
    this.onLoad = () => {};
  }
  // Lay out a page of items (already in the catalogue's order: kind, group, size)
  show(items) {
    this.clear(); const gen = ++this.gen;
    let z = 0, x = 0, depth = 0, group = null, row = null;
    const newRow = (first, it) => {
      if (row) z -= depth + Math.max(2.4, depth * 0.12);
      const r = row = { z, first, kind: it.kind, sub: it.sub, box: new THREE.Box3() }; this.rows.push(r); x = 1.3; depth = 0;
      hero().then((h) => { if (gen !== this.gen) return; h.position.set(0.1, 0, r.z - 0.35); h.rotation.y = 0.35; this.root.add(h); this.heroes.push(h); });
      row.box.expandByPoint(new THREE.Vector3(-0.4, 0, row.z)).expandByPoint(new THREE.Vector3(0.6, 1.95, row.z - 0.7));
      if (first) row.label = this.labels.add(`${it.kind}  ›  ${it.sub}`, new THREE.Vector3(0.1, 2.25, row.z - 0.35), { cls: 'head', prio: 1 });
    };
    for (const it of items) {
      const [w, h, d] = it.size, ww = Math.max(w, 0.12), gap = THREE.MathUtils.clamp(ww * 0.25, 0.35, 4);
      if (it.kind + it.sub !== group) { group = it.kind + it.sub; newRow(true, it); }
      else if (x > 1.3 && x + ww > Math.max(ROW, 6 * ww)) newRow(false, it);   // (giants share a wider row)
      const holder = new THREE.Group(); holder.position.set(x + ww / 2, 0, z - Math.max(d, 0.12) / 2); this.root.add(holder);
      const box = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.02), Math.max(h, 0.02), Math.max(d, 0.02)).translate(0, Math.max(h, 0.02) / 2, 0), boxMat);
      box.add(new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), edgeMat)); holder.add(box);
      const e = { item: it, holder, box, model: null, state: 'wait', row };
      e.label = this.labels.add(short(it.name), new THREE.Vector3(holder.position.x, 0, z + 0.32), { title: it.id });
      holder.userData.entry = e; this.entries.push(e);
      row.box.expandByPoint(new THREE.Vector3(x, 0, z)).expandByPoint(new THREE.Vector3(x + ww, h, z - d));
      x += ww + gap; depth = Math.max(depth, d);
    }
  }
  clear() {
    this.gen++; this.active = 0;
    for (const e of this.entries) { if (e.model) disposeModel(e.model); e.box?.geometry.dispose(); e.box?.children[0]?.geometry.dispose(); this.labels.remove(e.label); }
    for (const r of this.rows) this.labels.remove(r.label);
    this.root.clear(); this.entries = []; this.heroes = []; this.rows = [];
  }
  // Start loading what's waiting, nearest to the point looked at first
  update(near) {
    while (this.active < LOADING) {
      let best = null, bd = Infinity;
      for (const e of this.entries) if (e.state === 'wait') { const d = e.holder.position.distanceToSquared(near); if (d < bd) { bd = d; best = e; } }
      if (!best) return; this.load(best);
    }
  }
  load(e) {
    const gen = this.gen; e.state = 'load'; this.active++;
    loadModel(e.item.id).then((m) => {
      if (gen !== this.gen) { disposeModel(m); return; }
      this.active--; m.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3());
      m.position.set(-c.x, -b.min.y, -c.z);   // (its own pivot can be anywhere, a corner for the building kits: stand it by its box)
      e.holder.remove(e.box); e.box.geometry.dispose(); e.box.children[0].geometry.dispose(); e.box = null;
      e.holder.add(m); e.model = m; e.state = 'ok'; this.onLoad(e);
    }).catch((err) => {
      if (gen !== this.gen) return; this.active--; e.state = 'fail'; e.error = String(err?.message || err); e.box.children[0].material = failMat;
      console.warn(`${e.item.id} failed to load`, err);
    });
  }
  get loading() { return this.entries.filter((e) => e.state === 'wait' || e.state === 'load').length; }
  // the entry under a ray (models, or the boxes of those still loading)
  pick(ray) {
    const hit = ray.intersectObjects(this.entries.map((e) => e.holder), true).find((h) => h.object.isMesh);
    let o = hit?.object; while (o && !o.userData.entry) o = o.parent; return o ? o.userData.entry : null;
  }
  boxOf(e) { e.holder.updateMatrixWorld(true); return new THREE.Box3().setFromObject(e.model || e.box || e.holder); }
  find(id) { return this.entries.find((e) => e.item.id === id); }
}
