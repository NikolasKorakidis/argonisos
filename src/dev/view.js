// The asset browser's camera and labels. An orbit camera written here (the project vendors no OrbitControls): left drag
// turns round the point you look at, right or middle drag pans, the wheel zooms towards the cursor, WASD slides over the
// ground. Name labels are plain elements over the canvas, placed each frame, the nearest first, and any that would
// overlap one already shown are left out, so a row of pebbles doesn't turn into a smear of text.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _plane = new THREE.Plane(UP, 0), _ray = new THREE.Raycaster();

export class View {
  constructor(camera, dom) {
    this.camera = camera; this.dom = dom; this.target = new THREE.Vector3(); this.yaw = 0.5; this.pitch = 0.45; this.dist = 14;
    this.keys = new Set(); this.drag = null; this.tween = null; this.aspect = () => camera.aspect;   // (the free part of the window, for framing)
    this.claim = () => false;   // (a mode that wants a press for itself, e.g. to drag a placed model, answers true)
    this.onClick = () => {}; this.onDouble = () => {};
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => {
      if (this.claim(e)) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, pan: e.button !== 0 || e.shiftKey, moved: false };
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointermove', (e) => {
      const d = this.drag; if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY;
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) d.moved = true; if (!d.moved) return;
      this.tween = null;
      if (d.pan) { const k = this.dist * 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / dom.clientHeight; this.slide(-dx * k, dy * k / Math.max(Math.sin(this.pitch), 0.35)); }
      else { this.yaw -= dx * 0.006; this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.005, 0.03, 1.52); }
    });
    const up = (e) => { const d = this.drag; if (!d || d.id !== e.pointerId) return; this.drag = null; if (!d.moved && e.button === 0) this.onClick(e); };
    dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', () => { this.drag = null; });
    dom.addEventListener('dblclick', (e) => this.onDouble(e));
    dom.addEventListener('wheel', (e) => {
      e.preventDefault(); this.tween = null;
      const k = Math.pow(1.0015, THREE.MathUtils.clamp(e.deltaY * (e.deltaMode === 1 ? 33 : 1), -200, 200)), nd = THREE.MathUtils.clamp(this.dist * k, 0.4, 3000);
      const p = this.groundAt(e.clientX, e.clientY);   // (towards what's under the cursor, as map viewers do)
      if (p && p.distanceTo(this.camera.position) < 6000) { const s = nd / this.dist; this.target.sub(p).multiplyScalar(s).add(p); this.target.y = Math.max(0, this.target.y); }
      this.dist = nd;
    }, { passive: false });
    addEventListener('keydown', (e) => { if (!typing(e)) this.keys.add(e.code); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  // move the point looked at across the ground: x to the right of the view, z away from it
  slide(x, z) {
    _f.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); _r.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.target.addScaledVector(_r, x).addScaledVector(_f, z);
  }
  // where a point on the screen meets the ground (or null, looking up into the sky)
  groundAt(x, y, h = 0) { this.ray(x, y); _plane.constant = -h; return _ray.ray.intersectPlane(_plane, new THREE.Vector3()); }
  ray(x, y) { const b = this.dom.getBoundingClientRect(); _ray.setFromCamera({ x: ((x - b.left) / b.width) * 2 - 1, y: -((y - b.top) / b.height) * 2 + 1 }, this.camera); return _ray; }
  // a smooth move to show a box whole (a model, or a whole row)
  frame(box, { pitch, yaw } = {}) {
    if (box.isEmpty()) return; const c = box.getCenter(new THREE.Vector3()), r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.3);
    const fov = THREE.MathUtils.degToRad(this.camera.fov / 2), fit = r / Math.sin(Math.min(fov, Math.atan(Math.tan(fov) * this.aspect()))) * 1.1;
    let y0 = this.yaw; if (yaw !== undefined) y0 = yaw + Math.round((this.yaw - yaw) / (2 * Math.PI)) * 2 * Math.PI;   // (the short way round)
    this.tween = { t: 0, from: { target: this.target.clone(), dist: this.dist, pitch: this.pitch, yaw: this.yaw }, to: { target: c, dist: THREE.MathUtils.clamp(fit, 1.2, 3000), pitch: pitch ?? THREE.MathUtils.clamp(this.pitch, 0.25, 0.7), yaw: yaw === undefined ? this.yaw : y0 } };
  }
  set(target, dist, yaw = this.yaw, pitch = this.pitch) { this.target.copy(target); this.dist = dist; this.yaw = yaw; this.pitch = pitch; this.tween = null; }
  update(dt) {
    if (this.tween) {
      const T = this.tween; T.t = Math.min(1, T.t + dt / 0.45); const k = 1 - Math.pow(1 - T.t, 3);
      this.target.lerpVectors(T.from.target, T.to.target, k); this.dist = THREE.MathUtils.lerp(T.from.dist, T.to.dist, k); this.pitch = THREE.MathUtils.lerp(T.from.pitch, T.to.pitch, k); this.yaw = THREE.MathUtils.lerp(T.from.yaw, T.to.yaw, k);
      if (T.t >= 1) this.tween = null;
    }
    const K = this.keys, run = (K.has('ShiftLeft') || K.has('ShiftRight')) ? 3 : 1, sp = Math.max(this.dist, 3) * 0.9 * run * dt;
    if (!K.has('ControlLeft') && !K.has('MetaLeft') && !K.has('ControlRight') && !K.has('MetaRight')) {
      const x = (K.has('KeyD') ? 1 : 0) - (K.has('KeyA') ? 1 : 0), z = (K.has('KeyW') ? 1 : 0) - (K.has('KeyS') ? 1 : 0);
      if (x || z) { this.tween = null; this.slide(x * sp, z * sp); }
    }
    const c = Math.cos(this.pitch);
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * c * this.dist, this.target.y + Math.sin(this.pitch) * this.dist, this.target.z + Math.cos(this.yaw) * c * this.dist);
    if (this.camera.position.y < 0.1) this.camera.position.y = 0.1;
    this.camera.lookAt(this.target);
  }
}
// (keys typed into the search box or a field are not for the camera)
export const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) && e.target.type !== 'checkbox';

// Labels over the 3D view: add(text, position, { cls, prio }) returns a handle to move or remove
export class Labels {
  constructor(layer, camera) { this.layer = layer; this.camera = camera; this.list = new Set(); }
  add(text, pos, { cls = '', prio = 0, title = '' } = {}) {
    const el = document.createElement('div'); el.className = 'lbl ' + cls; el.textContent = text; if (title) el.title = title; this.layer.append(el);
    const L = { el, pos: pos.clone(), prio, w: 0, h: 0, on: true }; this.list.add(L); return L;
  }
  remove(L) { if (!L) return; L.el.remove(); this.list.delete(L); }
  clear() { for (const L of this.list) L.el.remove(); this.list.clear(); }
  update(show = true) {
    const W = this.layer.clientWidth, H = this.layer.clientHeight, placed = [], cam = this.camera.position, all = [];
    for (const L of this.list) {
      if (!L.w) { L.w = L.el.offsetWidth || 60; L.h = L.el.offsetHeight || 16; }   // (measured once, when first laid out)
      _v.copy(L.pos).project(this.camera);
      const vis = show && L.on && _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
      if (!vis) { if (L.shown !== false) { L.el.style.visibility = 'hidden'; L.shown = false; } continue; }
      all.push({ L, x: (_v.x + 1) / 2 * W, y: (1 - _v.y) / 2 * H, d: L.pos.distanceToSquared(cam) - L.prio * 1e6 });
    }
    all.sort((a, b) => a.d - b.d);
    for (const a of all) {
      const { L } = a, x0 = a.x - L.w / 2, y0 = a.y - L.h, box = [x0 - 2, y0 - 1, x0 + L.w + 2, y0 + L.h + 1];
      const hit = a.d > 2.5e5 && !L.prio ? true : placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);   // (and none past 500 m)
      if (hit) { if (L.shown !== false) { L.el.style.visibility = 'hidden'; L.shown = false; } continue; }
      placed.push(box); L.el.style.transform = `translate(${x0.toFixed(1)}px, ${y0.toFixed(1)}px)`; if (L.shown !== true) { L.el.style.visibility = 'visible'; L.shown = true; }
    }
  }
}
