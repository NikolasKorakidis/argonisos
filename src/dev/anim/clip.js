// One clip playing on a subject, under the viewer's hand: play and pause, scrub, step a frame, any speed, looped or
// held at its end, in place or travelling its own path, and a blend from the clip before (both kept running while it
// fades across, as a mixer's cross-fade does) to judge the change between two.
import * as THREE from 'three';
import { resetRest, applyClip, rootAt } from './pose.js';

const UP = new THREE.Vector3(0, 1, 0), _r = new THREE.Vector3();
const ease = (x) => x * x * (3 - 2 * x);

export class ClipPlayer {
  constructor(sub) { this.sub = sub; this.E = null; this.time = 0; this.playing = true; this.speed = 1; this.loop = true; this.blend = 0.25; this.prev = null; this.loops = 0; }
  get fps() { return this.E?.fps || 30; }
  get dur() { return this.E?.C.dur || 1; }
  get frames() { return Math.max(2, Math.round(this.dur * this.fps) + 1); }
  get frame() { return Math.round(this.time * this.fps); }
  // start a clip (blending from the one before, when there was one and a blend time is set)
  play(E) {
    this.prev = this.E && this.E !== E && this.blend > 0.001 ? { E: this.E, time: this.time, t: 0 } : null;
    this.E = E; this.time = 0; this.loops = 0; this.playing = true;
  }
  seek(t) { this.time = THREE.MathUtils.clamp(t, 0, this.dur); this.loops = 0; this.prev = null; }
  seekFrame(f) { this.seek(f / this.fps); }
  // a frame on or back (round the ends when looping)
  step(d) { this.playing = false; const n = this.frames; let f = this.frame + d; f = this.loop ? ((f % (n - 1)) + (n - 1)) % (n - 1) : THREE.MathUtils.clamp(f, 0, n - 1); this.seekFrame(f); }
  toggle() { if (!this.playing && !this.loop && this.time >= this.dur - 1e-4) this.seek(0); this.playing = !this.playing; }
  update(dt) {
    if (!this.E || !this.playing) return; const d = dt * this.speed;
    if (this.prev) { const P = this.prev; P.t += d; P.time = P.E.loop || this.loop ? (P.time + d) % P.E.C.dur : Math.min(P.time + d, P.E.C.dur); if (P.t >= this.blend) this.prev = null; }
    let t = this.time + d;
    if (t >= this.dur) { if (this.loop) { this.loops += Math.floor(t / this.dur); t %= this.dur; } else { t = this.dur; this.playing = false; } }
    this.time = t;
  }
  // the pose: rest, the clip before (while fading), this one over it
  pose() {
    const S = this.sub; resetRest(S); if (!this.E) return;
    if (this.prev) { applyClip(S, this.prev.E, this.prev.time, 1); applyClip(S, this.E, this.time, ease(Math.min(1, this.prev.t / this.blend))); }
    else applyClip(S, this.E, this.time, 1);
  }
  get blendK() { return this.prev ? ease(Math.min(1, this.prev.t / this.blend)) : 1; }
  // how far the clip has carried the body (metres in the world, for a body facing yaw), every time round counted
  offset(yaw, out = new THREE.Vector3()) {
    if (!this.E) return out.set(0, 0, 0);
    rootAt(this.E, this.time, out); if (this.loops) out.addScaledVector(rootAt(this.E, this.dur, _r), this.loops);
    return out.multiplyScalar(this.sub.s).applyAxisAngle(UP, yaw);
  }
  // the clip's whole path from where it starts (two rounds of a cycle), and a point every half second
  path(yaw) {
    const pts = [], ticks = [], E = this.E; if (!E) return { pts, ticks };
    const rounds = E.loop ? 2 : 1, n = Math.max(8, Math.round(E.C.dur * rounds * 30)), end = rootAt(E, E.C.dur, new THREE.Vector3());
    for (let i = 0; i <= n; i++) { const T = i / n * E.C.dur * rounds, k = Math.floor(Math.min(T, E.C.dur * rounds - 1e-6) / E.C.dur), t = T - k * E.C.dur; pts.push(rootAt(E, t, new THREE.Vector3()).addScaledVector(end, k).multiplyScalar(this.sub.s).applyAxisAngle(UP, yaw)); }
    for (let T = 0; T <= E.C.dur * rounds + 1e-6; T += 0.5) { const k = Math.floor(Math.min(T, E.C.dur * rounds - 1e-6) / E.C.dur); ticks.push(rootAt(E, T - k * E.C.dur, new THREE.Vector3()).addScaledVector(end, k).multiplyScalar(this.sub.s).applyAxisAngle(UP, yaw)); }
    return { pts, ticks };
  }
}
