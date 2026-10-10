// Feet on the ground: the walk and run clips are made on a flat floor, so on slopes, steps and stairs a foot would float
// or sink. After the clip has posed a Mixamo rig, each foot looks for the real surface under it (terrain, floors, stairs,
// the temple steps), the hips drop as far as the lower foot needs, each leg bends (two-bone IK) to set its foot on its
// own ground, and a planted foot tilts to the slope. The clip's own stride and lift stay on top, so a swinging foot still
// swings; it just swings over the ground that is really there.
import * as THREE from 'three';

const _h = new THREE.Vector3(), _k = new THREE.Vector3(), _a = new THREE.Vector3(), _t = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3(), _n = new THREE.Vector3();
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const MAX_DROP = 0.5, MAX_LIFT = 0.55, MAX_TILT = 0.45;

// turn a bone by a world-space rotation q, keeping its parent where it is
function rotateWorld(bone, q) {
  bone.parent.getWorldQuaternion(_pq); bone.getWorldQuaternion(_bq);
  bone.quaternion.copy(_pq.invert().multiply(q.multiply(_bq))); bone.updateMatrixWorld(true);
}

export class FootIK {
  // bones: the rig's bones by name; ground(x, z, y) → the height of whatever you'd stand on there, reaching up to ~0.5 m
  // above y; lift(y): moves the whole body up or down (the pelvis drop), e.g. a wrapper group's position
  constructor(bones, ground) {
    this.ground = ground; this.w = 0; this.pelvis = 0;
    this.legs = ['Left', 'Right'].map((s) => ({ up: bones[`mixamorig${s}UpLeg`], knee: bones[`mixamorig${s}Leg`], foot: bones[`mixamorig${s}Foot`], d: 0, tilt: new THREE.Quaternion() })).filter((l) => l.up && l.knee && l.foot);
  }
  // Before the pose is solved: where is the ground under each foot, relative to where the body stands (rootY)? Sets the
  // pelvis drop (returned, in metres, ≤ 0) for the caller to apply before solve()
  plan(dt, rootY, active) {
    this.w = lerp(this.w, active ? 1 : 0, Math.min(1, dt * 8)); if (this.w < 0.01) { this.pelvis = lerp(this.pelvis, 0, Math.min(1, dt * 10)); return this.pelvis; }
    let low = 0;
    for (const L of this.legs) {
      L.foot.getWorldPosition(_a);
      const g = this.ground(_a.x, _a.z, rootY), d = clamp(g - rootY, -MAX_DROP, MAX_LIFT);
      L.d = lerp(L.d, d, Math.min(1, dt * 18)); low = Math.min(low, L.d);
    }
    this.pelvis = lerp(this.pelvis, low * this.w, Math.min(1, dt * 12));
    return this.pelvis;
  }
  // After the pelvis drop is applied and the rig's matrices are current: bend each leg so its foot meets its ground
  solve(rootY) {
    if (this.w < 0.01) return;
    for (const L of this.legs) {
      const need = (L.d - this.pelvis) * this.w; if (Math.abs(need) < 0.004) continue;
      L.up.getWorldPosition(_h); L.knee.getWorldPosition(_k); L.foot.getWorldPosition(_a);
      _t.copy(_a); _t.y += need;
      const a = _h.distanceTo(_k), b = _k.distanceTo(_a), d = clamp(_h.distanceTo(_t), Math.abs(a - b) + 1e-3, a + b - 1e-3);
      // knee: open or close it until hip-to-ankle is the distance we need (law of cosines)
      _u.subVectors(_a, _k); _v.subVectors(_h, _k);
      const cur = _u.angleTo(_v), want = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
      _n.crossVectors(_u, _v); if (_n.lengthSq() < 1e-10) continue; _n.normalize();
      rotateWorld(L.knee, _q.setFromAxisAngle(_n, cur - want));
      // hip: swing the whole leg so the ankle lands on the target
      L.foot.getWorldPosition(_a); _u.subVectors(_a, _h).normalize(); _v.subVectors(_t, _h).normalize();
      rotateWorld(L.up, _q.setFromUnitVectors(_u, _v));
      // a foot near the ground lies along the slope (a lifted one keeps the clip's angle)
      L.foot.getWorldPosition(_a); const lift = _a.y - (rootY + L.d), plant = 1 - clamp((lift - 0.12) / 0.2, 0, 1);
      if (plant > 0.01) {
        const e = 0.3, gx = this.ground(_a.x + e, _a.z, rootY) - this.ground(_a.x - e, _a.z, rootY), gz = this.ground(_a.x, _a.z + e, rootY) - this.ground(_a.x, _a.z - e, rootY);
        _n.set(-gx / (2 * e), 1, -gz / (2 * e)).normalize(); const ang = Math.min(UP.angleTo(_n), MAX_TILT);
        if (ang > 0.01) { _v.crossVectors(UP, _n).normalize(); rotateWorld(L.foot, _q.setFromAxisAngle(_v, ang * plant * this.w)); }
      }
    }
  }
}
