// Posing a subject straight from a clip's tracks, as hero.js overlay() does, so the viewer can stop, scrub and step a clip
// and the checks can sample it frame by frame, all without an AnimationMixer: every frame starts from the rest pose and
// lays one clip (or two, while blending) over it. Rotations for every bone the clip has; a position only for the hips (as
// the game does: the old clips carry positions for every bone, made on another rig).
import * as THREE from 'three';

const _q = new THREE.Quaternion(), _v = new THREE.Vector3();

// The tracks of clip entry E bound to subject's bones: [{ bone, interp }] and .hips { bone, interp }, and the names the
// clip has that the rig hasn't (kept for the checks)
export function samplerOf(sub, E) {
  const key = E.C.clip.uuid; let S = sub.samplers.get(key); if (S) return S;
  S = []; S.unbound = [];
  for (const tr of E.C.clip.tracks) {
    const dot = tr.name.lastIndexOf('.'), name = tr.name.slice(0, dot), what = tr.name.slice(dot + 1), bone = sub.bones[name];
    if (!bone) { S.unbound.push(tr.name); continue; }
    if (what === 'quaternion') S.push({ bone, interp: tr.createInterpolant(), track: tr });
    else if (what === 'position' && bone === sub.hips) S.hips = { bone, interp: tr.createInterpolant(), track: tr };
  }
  sub.samplers.set(key, S); return S;
}
// Every bone back to how it rests
export function resetRest(sub) { for (const [b, r] of sub.rest) { b.quaternion.copy(r.q); b.position.copy(r.p); } }
// Clip entry E at time (seconds) over the pose with weight w (1: replace)
export function applyClip(sub, E, time, w = 1) {
  const S = samplerOf(sub, E); if (w <= 0.001) return;
  for (const s of S) { _q.fromArray(s.interp.evaluate(time)); if (w >= 0.999) s.bone.quaternion.copy(_q); else s.bone.quaternion.slerp(_q, w); }
  if (S.hips) { const v = S.hips.interp.evaluate(time), p = S.hips.bone.position; if (w >= 0.999) p.fromArray(v); else p.lerp(_v.fromArray(v), w); }
}
// The clip's own travel at time t (the hips' travel moves.mjs took out), in the hips' units, along the subject's facing:
// a one-shot's path, a cycle's steady travel, or for the old clips only their speed straight ahead
export function rootAt(E, t, out = new THREE.Vector3()) {
  const C = E.C;
  if (C.root) { const r = C.root.evaluate(Math.min(t, C.dur)); return out.set(r[0], 0, r[2]); }
  return out.set(0, 0, E.loop ? (C.rootSpeed || 0) * t : 0);
}
// Frames per second of a clip, from its keys (moves.mjs writes 30; the old clips have their own)
export function fpsOf(C) {
  const tr = C.clip.tracks.find((t) => t.times.length > 2); if (!tr) return 30;
  const d = []; for (let i = 1; i < Math.min(tr.times.length, 40); i++) d.push(tr.times[i] - tr.times[i - 1]);
  d.sort((a, b) => a - b); const dt = d[d.length >> 1]; return dt > 0 ? Math.round(1 / dt) : 30;
}
