// The rigging view: what the body hides. The skeleton (three's SkeletonHelper, a dot on every joint) with one bone
// picked out (gold, its name, its axes), every bone's axes, the body drawn solid, see-through or not at all, or as a
// wireframe; where the feet are down (a ring under each planted heel and ball, and a trail of dots they leave, so a foot
// that slides draws a smear), the clip's own path on the ground and the trail the hips leave over it.
import * as THREE from 'three';

const SIDES = ['Left', 'Right'], COL = { Left: new THREE.Color(0x6cb4ff), Right: new THREE.Color(0xffa850) };
const DOTS = 1600, TRAIL = 240, FADE = 4;   // (trail dots kept, hip points kept, seconds a dot lasts)
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();
const overlay = (m) => { m.depthTest = false; m.depthWrite = false; m.transparent = true; return m; };

export class Rig {
  constructor(scene, labels) {
    this.scene = scene; this.labels = labels; this.opt = { skeleton: false, axes: false, body: 'solid', wire: false, contacts: true, path: true };
    this.sel = null; this.helper = null; this.axes = []; this.mats = new Map(); this.t = 0;
    this.joints = new THREE.Points(new THREE.BufferGeometry(), overlay(new THREE.PointsMaterial({ color: 0xffffff, size: 5, sizeAttenuation: false })));
    this.joints.renderOrder = 11; this.joints.frustumCulled = false; scene.add(this.joints);
    this.marker = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), overlay(new THREE.MeshBasicMaterial({ color: 0xffc861 }))); this.marker.renderOrder = 12; this.marker.visible = false; scene.add(this.marker);
    this.selAxes = new THREE.AxesHelper(1); overlay(this.selAxes.material); this.selAxes.renderOrder = 12;
    this.label = labels.add('', new THREE.Vector3(), { cls: 'head', prio: 1 }); this.label.on = false;
    // where the feet are down: a ring under each heel and ball now, and the dots they leave
    this.rings = {}; for (const s of SIDES) for (const k of ['heel', 'ball']) {
      const r = new THREE.Mesh(new THREE.RingGeometry(k === 'heel' ? 0.05 : 0.035, k === 'heel' ? 0.07 : 0.05, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: COL[s], transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
      r.renderOrder = 3; r.visible = false; scene.add(r); this.rings[s + k] = r;
    }
    this.dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.018, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), DOTS);
    this.dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.dots.count = 0; this.dots.renderOrder = 3; this.dots.frustumCulled = false; scene.add(this.dots);
    this.dotList = []; this.dotAt = 0; this.lastFoot = {};
    // the clip's path, and the hips' trail
    this.path = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.95, depthWrite: false })); this.path.renderOrder = 4; this.path.frustumCulled = false; scene.add(this.path);
    this.pathTicks = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffd060, size: 6, sizeAttenuation: false, depthWrite: false })); this.pathTicks.frustumCulled = false; scene.add(this.pathTicks);
    this.hipsLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.8, depthWrite: false }));
    this.hipsLine.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3)); this.hipsLine.geometry.setDrawRange(0, 0); this.hipsLine.frustumCulled = false; this.hipsLine.renderOrder = 4; scene.add(this.hipsLine);
    this.hipsPts = [];
  }
  // A subject to show (again, after its body was swapped): its skeleton and its materials
  attach(sub) {
    if (this.helper) { this.scene.remove(this.helper); this.helper.dispose(); }
    for (const a of this.axes) { a.removeFromParent(); a.dispose(); } this.axes = []; this.restoreMats();
    this.sub = sub; this.helper = new THREE.SkeletonHelper(sub.model); this.helper.renderOrder = 10; this.scene.add(this.helper);
    // (only the rig's own bones: the cape's little chain, unnamed, hangs there even when no cape is worn)
    const H = this.helper; H.bones = H.bones.filter((b) => b.name); H.geometry.setDrawRange(0, H.bones.filter((b) => b.parent?.isBone).length * 2);
    this.list = sub.animated; this.joints.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.list.length * 3), 3));
    this.sel = this.sel && sub.bones[this.sel.name] || null; this.select(this.sel);
    this.collectMats(); this.apply(); this.clearTrails();
  }
  // the body's materials as they came, to go back to
  collectMats() { this.sub.model.traverse((m) => { if (m.isMesh) for (const x of [].concat(m.material)) if (!this.mats.has(x)) this.mats.set(x, { transparent: x.transparent, opacity: x.opacity, depthWrite: x.depthWrite, visible: x.visible, wireframe: x.wireframe }); }); }
  restoreMats() { for (const [m, o] of this.mats) Object.assign(m, o); this.mats.clear(); }
  // gear or a look changed: new parts may have come in
  refresh() { this.restoreMats(); this.collectMats(); this.apply(); }
  set(k, v) { this.opt[k] = v; this.apply(); }
  apply() {
    const O = this.opt; if (!this.sub) return;
    this.helper.visible = O.skeleton; this.joints.visible = O.skeleton;
    for (const [m, o] of this.mats) { Object.assign(m, o); if (O.body === 'ghost') { m.transparent = true; m.opacity = o.opacity * 0.28; m.depthWrite = false; } if (O.body === 'hidden') m.visible = false; if (O.wire) m.wireframe = true; m.needsUpdate = true; }
    if (O.axes && !this.axes.length) for (const b of this.list) { const a = new THREE.AxesHelper(1); overlay(a.material); a.renderOrder = 11; b.add(a); this.axes.push(a); }
    if (!O.axes) { for (const a of this.axes) { a.removeFromParent(); a.dispose(); } this.axes = []; }
    for (const r of Object.values(this.rings)) r.visible = false; this.dots.visible = O.contacts;
    this.path.visible = this.pathTicks.visible = this.hipsLine.visible = O.path;
  }
  select(bone) {
    this.sel = bone || null; this.selAxes.removeFromParent(); this.marker.visible = !!bone; this.label.on = !!bone;
    if (bone) { bone.add(this.selAxes); this.label.el.textContent = bone.name.replace('mixamorig', ''); this.label.w = 0; }
  }
  // the bone nearest a point on the screen (within 16 px), for clicking on the skeleton
  pick(camera, dom, x, y) {
    const b = dom.getBoundingClientRect(); let best = null, bd = 16 * 16;
    for (const bone of this.list) { bone.getWorldPosition(_v).project(camera); if (_v.z > 1) continue; const dx = (_v.x + 1) / 2 * b.width + b.left - x, dy = (1 - _v.y) / 2 * b.height + b.top - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = bone; } }
    return best;
  }
  // The clip's path: points in the world (metres), with a tick every half second
  setPath(points, ticks) {
    this.path.geometry.dispose(); this.path.geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.pathTicks.geometry.dispose(); this.pathTicks.geometry = new THREE.BufferGeometry().setFromPoints(ticks);
  }
  clearTrails() { this.dotList = []; this.dots.count = 0; this.hipsPts = []; this.hipsLine.geometry.setDrawRange(0, 0); }
  // Each frame, once the pose is final. ground(x, z, y): the stage under a point
  update(dt, ground) {
    const sub = this.sub; if (!sub) return; this.t += dt;
    const s = sub.s, scale = (b) => b.getWorldScale(_s).x || s;
    if (this.opt.skeleton) { const P = this.joints.geometry.attributes.position; this.list.forEach((b, i) => { b.getWorldPosition(_v); P.setXYZ(i, _v.x, _v.y, _v.z); }); P.needsUpdate = true; }
    if (this.axes.length) { const k = 0.07 / scale(this.list[0]); for (const a of this.axes) a.scale.setScalar(k); }
    if (this.sel) {
      this.sel.getWorldPosition(this.marker.position); this.selAxes.scale.setScalar(0.16 / scale(this.sel));
      this.label.pos.copy(this.marker.position); this.label.pos.y += 0.06;
    }
    // the feet: down within 2.5 cm of how high each stands at rest, over the ground under it
    if (this.opt.contacts && sub.feet) {
      for (const side of SIDES) for (const k of ['heel', 'ball']) {
        const b = sub.feet[side][k], r = this.rings[side + k]; b.getWorldPosition(_v); const was = this.lastFoot[side + k] ||= _v.clone(), fast = dt > 0 && Math.hypot(_v.x - was.x, _v.z - was.z) / dt > 0.8; was.copy(_v);
        const g = ground(_v.x, _v.z, _v.y - 0.3), down = !fast && _v.y - g < sub.restFeet[side][k] + 0.025;   // (as the checks: low, and not swinging)
        r.visible = down; if (!down) continue; r.position.set(_v.x, g + 0.006, _v.z);
        const D = { x: _v.x, y: g + 0.005, z: _v.z, t: this.t, c: COL[side].clone().multiplyScalar(k === 'heel' ? 1 : 0.7) };
        if (this.dotList.length < DOTS) this.dotList.push(D); else { this.dotList[this.dotAt] = D; this.dotAt = (this.dotAt + 1) % DOTS; }
      }
      let n = 0;
      for (const D of this.dotList) { const age = this.t - D.t; if (age > FADE) continue; const k = age < FADE - 1 ? 1 : FADE - age; _m.compose(_w.set(D.x, D.y, D.z), _q.identity(), _s.setScalar(k)); this.dots.setMatrixAt(n, _m); this.dots.setColorAt(n, D.c); n++; }
      this.dots.count = n; this.dots.instanceMatrix.needsUpdate = true; if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
    }
    // the hips' trail, on the ground under them
    if (this.opt.path && sub.hips) {
      sub.hips.getWorldPosition(_v); const last = this.hipsPts[this.hipsPts.length - 1];
      if (!last || last.distanceToSquared(_v) > 1e-6) { this.hipsPts.push(new THREE.Vector3(_v.x, ground(_v.x, _v.z, _v.y - 0.8) + 0.012, _v.z)); if (this.hipsPts.length > TRAIL) this.hipsPts.shift(); }
      const P = this.hipsLine.geometry.attributes.position; this.hipsPts.forEach((p, i) => P.setXYZ(i, p.x, p.y, p.z)); P.needsUpdate = true; this.hipsLine.geometry.setDrawRange(0, this.hipsPts.length);
    }
  }
}
