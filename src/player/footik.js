// Feet on the ground: the walk and run clips are made on a flat floor, so on slopes, steps and stairs a foot would float
// or sink. After the clip has posed a Mixamo rig, each foot looks for the real surface under it (terrain, floors, stairs,
// the temple steps), the hips drop as far as the lower foot needs, each leg bends (two-bone IK) to set its foot on its
// own ground, and a planted foot tilts to the slope. The clip's own stride and lift stay on top, so a swinging foot still
// swings; it just swings over the ground that is really there.
import * as THREE from 'three';
import { clamp, lerp } from '../util/math.js';

const _h = new THREE.Vector3(), _k = new THREE.Vector3(), _a = new THREE.Vector3(), _t = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3(), _n = new THREE.Vector3();
const _g = new THREE.Vector3(), _f = new THREE.Vector3(), _s = new THREE.Vector3();
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), _fq = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
const MAX_DROP = 0.5, MAX_LIFT = 0.55, MAX_TILT = 0.45;
// a locked foot (FootIK lock): planted while within lift of as low as it goes, held until the clip has carried it reach away
// (both in metres at a man's size), and let go of over ease seconds
const LOCK = { lift: 0.06, reach: 0.45, ease: 0.15 };

// turn a bone by a world-space rotation q, keeping its parent where it is
function rotateWorld(bone, q) {
  bone.parent.getWorldQuaternion(_pq); bone.getWorldQuaternion(_bq);
  bone.quaternion.copy(_pq.invert().multiply(q.multiply(_bq))); bone.updateMatrixWorld(true);
}

// How the sole lies in a foot bone's own space: its up and its length (heel to toe, level), taken while the body stands in
// the pose it was modelled in (toe: the next bone along the foot), for FootIK to set a planted foot flat across the ground
export function soleOf(foot, toe) {
  const q = foot.getWorldQuaternion(new THREE.Quaternion()).invert(), along = toe.getWorldPosition(new THREE.Vector3()).sub(foot.getWorldPosition(new THREE.Vector3())); along.y = 0;
  return { up: UP.clone().applyQuaternion(q), along: along.normalize().applyQuaternion(q) };
}

export class FootIK {
  // bones: the rig's bones by name (a foot's userData.sole, from soleOf, lets it be levelled across); ground(x, z, y) → the height of whatever you'd stand on there, reaching up to ~0.5 m
  // above y; legs('Left' | 'Right') → the names of that leg's thigh, shin and foot bones (Mixamo's unless told); k: how
  // much bigger than a man the body is (a giant boss's feet reach and lift as much further)
  // lock: a planted foot stays where it came down until the clip lifts it again (a giant's: its clips' strides never
  // quite match the ground going by, and it turns where it stands), let go of over a moment so it doesn't snap
  constructor(bones, ground, legs = (s) => [`mixamorig${s}UpLeg`, `mixamorig${s}Leg`, `mixamorig${s}Foot`], k = 1, lock = false) {
    this.ground = ground; this.w = 0; this.pelvis = 0; this.k = k; this.lock = lock;
    this.legs = ['Left', 'Right'].map((s) => { const [up, knee, foot] = legs(s).map((n) => bones[n]); return { up, knee, foot, d: 0, tilt: new THREE.Quaternion(), sole: foot?.userData.sole, at: null, ox: 0, oz: 0 }; }).filter((l) => l.up && l.knee && l.foot);
  }
  // Before the pose is solved: where is the ground under each foot, relative to where the body stands (rootY)? Sets the
  // pelvis drop (returned, in metres, ≤ 0) for the caller to apply before solve()
  plan(dt, rootY, active) {
    this.w = lerp(this.w, active ? 1 : 0, Math.min(1, dt * 8)); if (this.w < 0.01) { this.pelvis = lerp(this.pelvis, 0, Math.min(1, dt * 10)); return this.pelvis; }
    let low = 0;
    for (const L of this.legs) {
      L.foot.getWorldPosition(_a);
      // (eased, so a foot doesn't pop as its ground jumps at a step's edge; but rising ground is followed more than twice
      // as fast as falling: up a hillside the ground under a foot swinging forward rises a metre a second and more, and
      // eased as falling ground is the foot came down 5 to 10 cm short of it, into the slope)
      const g = this.ground(_a.x, _a.z, rootY), d = clamp(g - rootY, -MAX_DROP * this.k, MAX_LIFT * this.k);
      L.d = lerp(L.d, d, Math.min(1, dt * (d > L.d ? 45 : 18))); low = Math.min(low, L.d);
    }
    this.pelvis = lerp(this.pelvis, low * this.w, Math.min(1, dt * 12));
    return this.pelvis;
  }
  // After the pelvis drop is applied and the rig's matrices are current: bend each leg so its foot meets its ground
  solve(rootY, dt = 0) {
    if (this.w < 0.01) { for (const L of this.legs) { L.at = null; L.ox = L.oz = 0; } return; }
    for (const L of this.legs) {
      const need = (L.d - this.pelvis) * this.w;
      // (a planted foot held where it came down: how far the clip has carried it off that spot, ox and oz, eased back to
      // nothing once the clip lifts it or it would have to reach too far)
      if (this.lock) {
        L.foot.getWorldPosition(_a); const lift = _a.y + need - (rootY + L.d); L.base = Math.min((L.base ?? lift) + dt * 0.05 * this.k, lift);   // (base: the ankle's height when it's down, the lowest of late)
        const down = lift - L.base < LOCK.lift * this.k;
        if (down && !L.at) L.at = { x: _a.x, z: _a.z };
        if (L.at && (!down || Math.hypot(L.at.x - _a.x, L.at.z - _a.z) > LOCK.reach * this.k)) L.at = null;
        if (L.at) { L.ox = L.at.x - _a.x; L.oz = L.at.z - _a.z; } else { const f = Math.max(0, 1 - dt / LOCK.ease); L.ox *= f; L.oz *= f; }
      }
      const off = Math.hypot(L.ox, L.oz) * this.w;
      if (Math.abs(need) < 0.004 && off < 0.004 && !L.sole) continue;
      if (Math.abs(need) >= 0.004 || off >= 0.004) {
        L.up.getWorldPosition(_h); L.knee.getWorldPosition(_k); L.foot.getWorldPosition(_a);
        _t.copy(_a); _t.y += need; _t.x += L.ox * this.w; _t.z += L.oz * this.w;
        const a = _h.distanceTo(_k), b = _k.distanceTo(_a), d = clamp(_h.distanceTo(_t), Math.abs(a - b) + 1e-3, a + b - 1e-3);
        // knee: open or close it until hip-to-ankle is the distance we need (law of cosines)
        _u.subVectors(_a, _k); _v.subVectors(_h, _k);
        const cur = _u.angleTo(_v), want = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
        _n.crossVectors(_u, _v); if (_n.lengthSq() < 1e-10) continue; _n.normalize();
        rotateWorld(L.knee, _q.setFromAxisAngle(_n, cur - want));
        // hip: swing the whole leg so the ankle lands on the target
        L.foot.getWorldPosition(_a); _u.subVectors(_a, _h).normalize(); _v.subVectors(_t, _h).normalize();
        rotateWorld(L.up, _q.setFromUnitVectors(_u, _v));
      }
      // a foot near the ground lies along the slope (a lifted one keeps the clip's angle)
      L.foot.getWorldPosition(_a); const lift = _a.y - (rootY + L.d), plant = 1 - clamp((lift - 0.12 * this.k) / (0.2 * this.k), 0, 1);
      if (plant > 0.01) {
        const e = 0.3 * this.k, gx = this.ground(_a.x + e, _a.z, rootY) - this.ground(_a.x - e, _a.z, rootY), gz = this.ground(_a.x, _a.z + e, rootY) - this.ground(_a.x, _a.z - e, rootY);
        _g.set(-gx / (2 * e), 1, -gz / (2 * e)).normalize(); const ang = Math.min(UP.angleTo(_g), MAX_TILT);
        if (ang > 0.01) { _v.crossVectors(UP, _g).normalize(); _g.copy(UP).applyAxisAngle(_v, ang); rotateWorld(L.foot, _q.setFromAxisAngle(_v, ang * plant * this.w)); }
        // and level across it: turned about its own length until the sole lies on the ground from edge to edge, its heel
        // and toe left as the clip lifts them. The clips roll a planted foot onto an edge (Mixamo's walk and the old sprint by
        // up to 10°: an ankle seen to buckle), and a wider stance (hero.js STANCE) or a slope across the way would too
        if (L.sole) {
          L.foot.getWorldQuaternion(_fq); _f.copy(L.sole.along).applyQuaternion(_fq); _s.copy(L.sole.up).applyQuaternion(_fq);
          const tip = _g.dot(_f), flat = plant * (1 - clamp((Math.abs(tip) - 0.17) / 0.33, 0, 1));   // (only while it lies near flat: a heel coming down or a foot pushing off on its toes keeps the clip's roll)
          _g.addScaledVector(_f, -tip); if (flat > 0.01 && _g.lengthSq() > 1e-6) { _g.normalize(); const roll = Math.atan2(_n.crossVectors(_s, _g).dot(_f), _s.dot(_g)); rotateWorld(L.foot, _q.setFromAxisAngle(_f, roll * flat * this.w)); }
        }
      }
    }
  }
}
