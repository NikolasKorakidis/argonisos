// The cape: Synty's Ancient Empire cape, which the pack gives as a plain mesh (its little rig of cloth bones isn't
// kept), hung on the hero here. It is fitted to the body in its rest pose: from the chest bone (Spine2, where Synty's
// prefabs hang it) over the shoulders to the calves, as wide as the shoulders and standing just off the back (or off
// the body armour, when that's worn). It gets a chain of four bones of its own: the top rides the chest, the rest is a
// short rope of points (Verlet) that gravity pulls down and the air holds back, so it streams out behind a run, lifts
// in a fall and swings in a turn, and that is kept behind the back and the legs (a stride never pokes through it).
import * as THREE from 'three';

export const CAPE_MODEL = 'all/polygonancientempire/sk-chr-attach-cape-01';
// where the cape's bones sit, as fractions of its length from the top: the shoulder blades, the small of the back, the knees
const JOINTS = [0, 0.14, 0.42, 0.7];
const DRAG = 0.8, GRAV = 9.8, LEG_R = 0.085, GAP = 0.03;

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), _b = new THREE.Quaternion(), _m = new THREE.Matrix4();
const DOWN = new THREE.Vector3(0, -1, 0);
// turn a bone by a world-space rotation q, keeping its parent where it is
function turnWorld(bone, q) { bone.parent.getWorldQuaternion(_p); bone.getWorldQuaternion(_b); bone.quaternion.copy(_p.invert().multiply(_b.premultiply(q))); bone.updateMatrixWorld(true); }

export class Cape {
  // gl: the loaded pack model; model, bones: the hero's (scaled, on the hero, in its rest pose); parts: its meshes by name
  constructor(gl, model, bones, parts) {
    const src = []; gl.scene.updateMatrixWorld(true); let map = null;
    gl.scene.traverse((m) => { if (m.isMesh) { src.push(m.geometry.clone().applyMatrix4(m.matrixWorld)); map ||= m.material.map; } });
    const geo = src[0]; geo.computeBoundingBox();
    const B = bones, root = model.parent; root.updateMatrixWorld(true);
    const local = (b) => root.worldToLocal(b.getWorldPosition(new THREE.Vector3()));   // (in the hero's own frame: y up, z forward, metres)
    const chest = local(B.mixamorigSpine2), shL = local(B.mixamorigLeftArm), shR = local(B.mixamorigRightArm), foot = local(B.mixamorigLeftFoot), knee = local(B.mixamorigLeftLeg);
    // how far back the body (and each piece of body armour) reaches over the shoulder blades, behind the chest bone
    const back = (m) => { let z = 0; const P = m.geometry.attributes.position;
      for (let i = 0; i < P.count; i++) { m.getVertexPosition(i, _v); root.worldToLocal(_v.applyMatrix4(m.matrixWorld)); if (Math.abs(_v.x - chest.x) < 0.12 && Math.abs(_v.y - chest.y) < 0.1) z = Math.min(z, _v.z - chest.z); }
      return z; };
    this.backBare = parts.base_body ? back(parts.base_body) : -0.13;
    this.backArmour = Math.min(this.backBare, ...Object.entries(parts).filter(([n]) => /^wear_.*Armor$/.test(n)).map(([, m]) => back(m)));
    // fitted: its top a little over the chest bone, its hem at mid-calf, as wide as the shoulders and a hand more
    const bb = geo.boundingBox, top = bb.max.y, len = top - bb.min.y, want = chest.y + 0.12 - (knee.y + foot.y) / 2;
    const ky = want / len, kx = (shL.distanceTo(shR) + 0.1) / (bb.max.x - bb.min.x), kz = (kx + ky) / 2;
    geo.translate(0, -top, 0).scale(kx, ky, kz);   // (top at y = 0, hanging down -y, behind along -z)
    // (the front of its middle over the shoulder blades, which the back meets: its sides wrap forward round the body)
    const P0 = geo.attributes.position; this.front = -Infinity;
    for (let i = 0; i < P0.count; i++) if (Math.abs(P0.getX(i)) < 0.08 && P0.getY(i) < -0.04 && P0.getY(i) > -0.3) this.front = Math.max(this.front, P0.getZ(i));
    if (!Number.isFinite(this.front)) { geo.computeBoundingBox(); this.front = geo.boundingBox.max.z; }
    this.len = want;
    // bones: a chain down the middle of it, hung in a group that rides the chest bone
    this.group = new THREE.Group(); B.mixamorigSpine2.add(this.group);
    this.bones = JOINTS.map((f, i) => { const b = new THREE.Bone(); b.position.y = -(f - (JOINTS[i - 1] ?? 0)) * want * (i ? 1 : 0); return b; });
    this.bones.reduce((a, b) => (a.add(b), b)); this.group.add(this.bones[0]);
    // each vertex follows the bone of the stretch it hangs in, shared half and half with the next across each joint
    const P = geo.attributes.position, n = P.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), Y = JOINTS.map((f) => -f * want);
    for (let i = 0; i < n; i++) {
      const y = P.getY(i); let k = 0; while (k < Y.length - 1 && y < Y[k + 1]) k++;
      const lo = k < Y.length - 1 ? Y[k + 1] : -want, t = (Y[k] - y) / Math.max(1e-4, Y[k] - lo);
      const up = k > 0 ? Math.max(0, 0.5 - 2 * t) : 0, dn = k < Y.length - 1 ? Math.max(0, 0.5 - 2 * (1 - t)) : 0;
      si.set([k, Math.max(0, k - 1), Math.min(Y.length - 1, k + 1), 0], i * 4); sw.set([1 - up - dn, up, dn, 0], i * 4);
    }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    this.mat = new THREE.MeshStandardMaterial({ map, color: 0xb8b0a8, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    this.mesh = new THREE.SkinnedMesh(geo, this.mat); this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.B = B; this.root = root; this.pts = null; this.group.visible = false;
    this.group.add(this.mesh); this.place(false);
    this.group.updateMatrixWorld(true); this.mesh.bind(new THREE.Skeleton(this.bones), this.mesh.matrixWorld);
  }
  // stand it off the bare back, or off the armour
  place(armour) {
    const back = armour ? this.backArmour : this.backBare, chest = this.group.parent;
    // (the group sits in the chest bone's space, which is turned and scaled: set its place and turn from the hero's frame)
    this.root.updateMatrixWorld(true); chest.updateMatrixWorld(true);
    const want = new THREE.Matrix4().compose(this.root.worldToLocal(chest.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, 0.12, back - GAP - this.front)), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    _m.copy(chest.matrixWorld).invert().multiply(this.root.matrixWorld).multiply(want);
    _m.decompose(this.group.position, this.group.quaternion, this.group.scale); this.armour = armour;
  }
  show(on, armour) {
    if (on && armour !== this.armour) this.place(armour);
    if (on && !this.group.visible) this.pts = null;   // (put on: it starts hanging straight)
    this.group.visible = on;
  }
  // After the hero is posed (feet and all): move the rope's points, keep them behind the body, turn the bones to them
  update(dt) {
    if (!this.group.visible) return;
    dt = Math.min(dt, 1 / 30); const bones = this.bones, R = this.root, L = this.len;
    for (const b of bones) b.quaternion.identity(); this.group.updateWorldMatrix(true, true);
    // the rest of the rope hangs from the shoulder-blade bone; its points: that bone, the next two, the hem
    const seg = [JOINTS[2] - JOINTS[1], JOINTS[3] - JOINTS[2], 1 - JOINTS[3]].map((f) => f * L);
    const pin = bones[1].getWorldPosition(new THREE.Vector3());
    if (!this.pts) { this.pts = [pin.clone()]; for (const l of seg) this.pts.push(this.pts.at(-1).clone().addScaledVector(DOWN, l)); this.prev = this.pts.map((p) => p.clone()); this.dt0 = dt; }
    const P = this.pts, Q = this.prev, k = dt / (this.dt0 || dt), damp = Math.max(0, 1 - DRAG * dt); this.dt0 = dt;
    P[0].copy(pin); Q[0].copy(pin);
    for (let i = 1; i < P.length; i++) { _v.copy(P[i]).sub(Q[i]).multiplyScalar(k * damp); Q[i].copy(P[i]); P[i].add(_v); P[i].y -= GRAV * dt * dt; }
    // the body's back and legs, in the hero's frame (y up, z forward): the rope stays behind them
    const inv = _m.copy(R.matrixWorld).invert(), loc = (b, out) => out.setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv), B = this.B;
    const torso = ['mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2'].map((n) => loc(B[n], new THREE.Vector3()));
    const legs = ['Left', 'Right'].map((s) => ['UpLeg', 'Leg', 'Foot'].map((n) => loc(B[`mixamorig${s}${n}`], new THREE.Vector3())));
    const behind = (y) => {   // the farthest back anything reaches at height y
      let z = Infinity;
      const along = (a, b, r) => { if ((y - a.y) * (y - b.y) > 0) return; const t = (y - a.y) / ((b.y - a.y) || 1e-4); z = Math.min(z, a.z + (b.z - a.z) * t - r); };
      for (let i = 0; i < torso.length - 1; i++) along(torso[i], torso[i + 1], -(this.armour ? this.backArmour : this.backBare) * 0.8);
      for (const l of legs) { along(l[0], l[1], LEG_R); along(l[1], l[2], LEG_R * 0.8); }
      return z;
    };
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < P.length; i++) {   // (each stretch keeps its length, pulled from the point above)
        _v.subVectors(P[i], P[i - 1]); const d = _v.length() || 1e-4; P[i].copy(P[i - 1]).addScaledVector(_v, seg[i - 1] / d);
        _w.copy(P[i]).applyMatrix4(inv); const zb = behind(_w.y) - GAP;
        if (_w.z > zb) { _w.z = zb; P[i].copy(_w).applyMatrix4(R.matrixWorld); }
      }
    }
    // turn each bone so it points at the next point down
    for (let i = 1; i < bones.length; i++) {
      const b = bones[i], at = b.getWorldPosition(_v), to = _w.subVectors(P[i], at).normalize();
      const now = new THREE.Vector3(0, -1, 0).applyQuaternion(b.getWorldQuaternion(_q)); turnWorld(b, _q.setFromUnitVectors(now, to));
    }
  }
}
