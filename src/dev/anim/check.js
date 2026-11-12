// The automatic checks: a clip sampled frame by frame on the subject itself (standing at the origin, the pose rebuilt from
// rest each frame as pose.js does), looking for what reads as a glitch in the game:
// - feet: when each heel (the ankle) and ball (the toe) is down (within 2.5 cm of its height at rest, and slower than a
//   swing), and a planted one that slides more than the limit, the clip's own travel added back so a cycle's feet should
//   stand still;
// - below the ground: the lowest point of the visible body each frame (for the clips the game plays with the feet off
//   the ground, after the lift it gives them: hero.floorLift) (skinned vertices, about 1,500 of them, each counted
//   for the bone that moves it most: hands, feet, head or the rest);
// - jumps: a bone turning more in one frame than a fast swing does (a flipped key, a broken track), the hips leaping;
// - a cycle's seam: its last frame should come back to its first;
// - tracks: NaN values, bones that never move or have no track at all (possibly missing), tracks for bones the rig hasn't;
// - the clip's length, frames, fps and travel.
import * as THREE from 'three';
import { samplerOf, resetRest, applyClip, rootAt, fpsOf } from './pose.js';
import { FEET_OFF } from '../../player/hero.js';

export const LIMITS = { slideCm: 4, plantCm: 2.5, plantSpeed: 0.8, belowCm: 2, jumpDeg: 35, flipDeg: 70, hipsCm: 12, seamDeg: 6 };
const SIDES = ['Left', 'Right'], DEG = 180 / Math.PI;
const _v = new THREE.Vector3(), _r = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const cm = (m) => (m * 100).toFixed(1) + ' cm';

// What a vertex belongs to, by the bone that moves it most
const regionOf = (name) => /LeftHand/.test(name) ? 'left hand' : /RightHand/.test(name) ? 'right hand' : /Left(Foot|Toe)/.test(name) ? 'left foot' : /Right(Foot|Toe)/.test(name) ? 'right foot' : /Head|Neck/.test(name) ? 'head' : 'body';
function vertexPlan(sub) {
  const key = 'verts:' + sub.meshes().map((m) => m.uuid).join(); if (sub.cache[key]) return sub.cache[key];
  const meshes = sub.meshes(), total = meshes.reduce((s, m) => s + m.geometry.attributes.position.count, 0), every = Math.max(1, Math.round(total / 1500)), plan = [];
  for (const m of meshes) {
    const SI = m.geometry.attributes.skinIndex, SW = m.geometry.attributes.skinWeight; if (!SI) continue;
    for (let i = 0; i < m.geometry.attributes.position.count; i += every) {
      let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > bw) { bw = w; best = SI.getComponent(i, k); } }
      plan.push({ m, i, region: regionOf(m.skeleton.bones[best]?.name || '') });
    }
  }
  return (sub.cache[key] = plan);
}
// Stand the subject at the origin, plainly, for sampling; give back a function that puts everything back
function holdStill(sub) {
  const R = sub.root, W = sub.wrap, rp = R.position.clone(), rr = R.rotation.clone(), wp = W.position.clone(), bones = [...sub.rest.keys()].map((b) => [b, b.quaternion.clone(), b.position.clone()]);
  R.position.set(0, 0, 0); R.rotation.set(0, 0, 0); W.position.set(0, 0, 0);
  return () => { R.position.copy(rp); R.rotation.copy(rr); W.position.copy(wp); for (const [b, q, p] of bones) { b.quaternion.copy(q); b.position.copy(p); } R.updateMatrixWorld(true); };
}

// Frame by frame: { fps, n, dur, contacts: { Left: { heel: [bool], ball: [bool] }, Right }, issues: [{ sev, text, frame }], info }
// o.mesh: also the lowest points of the body (slower); o.limits: the thresholds (LIMITS)
export function analyse(sub, E, o = {}) {
  const L = { ...LIMITS, ...o.limits }, C = E.C, fps = fpsOf(C), n = Math.max(2, Math.round(C.dur * fps) + 1), dt = C.dur / (n - 1), S = samplerOf(sub, E);
  const lifts = !!sub.hero?.floorLift && FEET_OFF.has(E.name), back = holdStill(sub), rest = sub.restFeet, plan = o.mesh ? vertexPlan(sub) : null, issues = [];
  const feet = {}, low = {}, quats = S.map(() => new Float32Array(n * 4)), hips = new Float32Array(n * 3);
  for (const s of SIDES) feet[s] = { heel: new Float32Array(n * 3), ball: new Float32Array(n * 3) };
  try {
    for (let i = 0; i < n; i++) {
      const t = Math.min(i * dt, C.dur);
      resetRest(sub); applyClip(sub, E, t); sub.wrap.position.y = 0; sub.root.updateMatrixWorld(true);
      // (lying, rolling, getting up: the game lifts the body clear of the floor, hero.js floorLift; so do we)
      if (lifts) { sub.wrap.position.y = sub.hero.floorLift(() => 0); sub.root.updateMatrixWorld(true); }
      rootAt(E, t, _r).multiplyScalar(sub.s);   // (the travel, in metres, along +z: the subject faces +z here)
      for (const s of SIDES) for (const k of ['heel', 'ball']) { sub.feet[s][k].getWorldPosition(_v).add(_r); feet[s][k].set([_v.x, _v.y, _v.z], i * 3); }
      S.forEach((x, j) => x.bone.quaternion.toArray(quats[j], i * 4));
      sub.hips.position.toArray(hips, i * 3);
      if (plan) for (const p of plan) { p.m.getVertexPosition(p.i, _v).applyMatrix4(p.m.matrixWorld); const was = low[p.region]; if (!was || _v.y < was.y) low[p.region] = { y: _v.y, frame: i }; }
    }
    // tracks: NaN anywhere, and quaternions that never move
    for (const tr of C.clip.tracks) if (tr.values.some((v) => Number.isNaN(v))) issues.push({ sev: 'err', text: `NaN in ${tr.name}` });
    if (S.unbound.length) issues.push({ sev: 'warn', text: `${S.unbound.length} track${S.unbound.length > 1 ? 's' : ''} for bones the rig hasn't: ${S.unbound.slice(0, 4).join(', ')}${S.unbound.length > 4 ? '…' : ''}` });
    const finger = /Hand(Thumb|Index|Middle|Ring|Pinky)/, still = [], has = new Set(S.map((x) => x.bone));
    S.forEach((x, j) => { if (finger.test(x.bone.name)) return; _q2.fromArray(quats[j], 0); let most = 0; for (let i = 1; i < n; i++) most = Math.max(most, _q2.angleTo(_q.fromArray(quats[j], i * 4))); if (most * DEG < 0.1) still.push(x.bone.name.replace('mixamorig', '')); });
    const none = sub.animated.filter((b) => !has.has(b) && !finger.test(b.name)).map((b) => b.name.replace('mixamorig', ''));
    if (none.length) issues.push({ sev: 'warn', text: `no track for ${none.length} bone${none.length > 1 ? 's' : ''} (held at rest): ${none.slice(0, 6).join(', ')}${none.length > 6 ? '…' : ''}` });
    if (still.length) issues.push({ sev: 'info', text: `${still.length} bone${still.length > 1 ? 's' : ''} never move${still.length > 1 ? '' : 's'}: ${still.slice(0, 6).join(', ')}${still.length > 6 ? '…' : ''}` });
    // jumps between frames: the worst bones
    const jumps = [];
    S.forEach((x, j) => { if (finger.test(x.bone.name)) return; let most = 0, at = 0; for (let i = 1; i < n; i++) { const a = _q.fromArray(quats[j], (i - 1) * 4).angleTo(_q2.fromArray(quats[j], i * 4)) * DEG; if (a > most) { most = a; at = i; } } if (most * 30 / fps > L.jumpDeg) jumps.push({ b: x.bone.name.replace('mixamorig', ''), most, at }); });
    jumps.sort((a, b) => b.most - a.most);
    for (const J of jumps.slice(0, 3)) issues.push({ sev: J.most * 30 / fps > L.flipDeg ? 'err' : 'warn', frame: J.at, text: `${J.b} turns ${J.most.toFixed(0)}° in one frame (f${J.at - 1}→f${J.at})` });
    if (jumps.length > 3) issues.push({ sev: 'info', text: `…and ${jumps.length - 3} more bones jump past ${L.jumpDeg}°/frame` });
    let hj = 0, ha = 0; for (let i = 1; i < n; i++) { const d = Math.hypot(hips[i * 3] - hips[i * 3 - 3], hips[i * 3 + 1] - hips[i * 3 - 2], hips[i * 3 + 2] - hips[i * 3 - 1]) * sub.s; if (d > hj) { hj = d; ha = i; } }
    if (hj * 30 / fps > L.hipsCm / 100) issues.push({ sev: 'warn', frame: ha, text: `the hips leap ${cm(hj)} in one frame (f${ha - 1}→f${ha})` });
    // a cycle's seam
    if (E.loop) {
      let worst = 0, wb = ''; S.forEach((x, j) => { if (finger.test(x.bone.name)) return; const a = _q.fromArray(quats[j], 0).angleTo(_q2.fromArray(quats[j], (n - 1) * 4)) * DEG; if (a > worst) { worst = a; wb = x.bone.name.replace('mixamorig', ''); } });
      if (worst > L.seamDeg) issues.push({ sev: 'warn', frame: n - 1, text: `loop seam: ${wb} is ${worst.toFixed(1)}° off between the last frame and the first (a pop each cycle)` });
      const hs = Math.hypot(hips[0] - hips[(n - 1) * 3], hips[1] - hips[(n - 1) * 3 + 1], hips[2] - hips[(n - 1) * 3 + 2]) * sub.s;
      if (hs > 0.02) issues.push({ sev: 'warn', frame: n - 1, text: `loop seam: the hips are ${cm(hs)} off between the last frame and the first` });
    }
    // the feet: down (near their resting height), and sliding while down
    const contacts = {};
    for (const s of SIDES) {
      contacts[s] = {};
      for (const k of ['heel', 'ball']) {
        // (down: low, and not swinging: a foot shuffled back low over the ground in a walk backwards is still a step, so
        // anything moving faster than plantSpeed is in the air, however low; a skid slower than that is what's caught)
        const P = feet[s][k], sp = (i) => { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); return Math.hypot(P[b * 3] - P[a * 3], P[b * 3 + 2] - P[a * 3 + 2]) / ((b - a) * dt); };
        const down = Array.from({ length: n }, (_, i) => P[i * 3 + 1] < rest[s][k] + L.plantCm / 100 && sp(i) < L.plantSpeed); contacts[s][k] = down;
        let worst = null;
        for (let i = 0; i < n;) {
          if (!down[i]) { i++; continue; } let j = i; while (j + 1 < n && down[j + 1]) j++;
          const a = i + 1, b = j - 1;   // (the frames it touches down and lifts off are left out: a foot rolls onto and off the ground)
          if (b - a >= 1) { let d = 0, at = a; for (let f = a + 1; f <= b; f++) { const x = Math.hypot(P[f * 3] - P[a * 3], P[f * 3 + 2] - P[a * 3 + 2]); if (x > d) { d = x; at = f; } } if (!worst || d > worst.d) worst = { d, from: i, to: j, at }; }
          i = j + 1;
        }
        if (worst && worst.d * 100 > L.slideCm) issues.push({ sev: worst.d * 100 > L.slideCm * 2.5 ? 'err' : 'warn', frame: worst.at, text: `${s.toLowerCase()} ${k} slides ${cm(worst.d)} while planted (f${worst.from}–f${worst.to})` });
      }
    }
    // the footfalls the game hears in a travelling cycle (the hero's footsteps, and how its cycles are kept in step)
    if (E.loop && E.root && sub.footfalls) { const f = sub.footfalls(E), sides = new Set(f.map((x) => x.side)); if (sides.size < 2) issues.push({ sev: 'warn', text: `the game finds ${sides.size ? 'only the ' + [...sides][0].toLowerCase() + ' foot coming down' : 'no footfalls'} in this cycle (hero.footfalls): ${sides.size ? 'half' : 'no'} footstep sounds, and its step isn't lined up with the other cycles'` }); }
    // below the ground
    if (plan) for (const [region, { y, frame }] of Object.entries(low)) if (y < -L.belowCm / 100) issues.push({ sev: y < -L.belowCm * 2.5 / 100 ? 'err' : 'warn', frame, text: `${region} ${cm(-y)} below the ground at f${frame}` });
    const travel = rootAt(E, C.dur, _r).length() * sub.s;
    const info = `${C.dur.toFixed(2)} s · ${n} frames at ${fps} fps · ${C.clip.tracks.length} tracks${E.loop ? ' · loop' : ''}${travel > 0.05 ? ` · travels ${travel.toFixed(2)} m${E.loop ? ` (${(travel / C.dur).toFixed(2)} m/s)` : ''}` : ''}`;
    const order = { err: 0, warn: 1, info: 2 }; issues.sort((a, b) => order[a.sev] - order[b.sev]);
    return { fps, n, dur: C.dur, contacts, issues, info, low };
  } finally { back(); }
}
