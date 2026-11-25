// Small effects: bursts of chips, splinters and dust, and the camera's shake. Three instanced meshes do it all: chips that
// fall (rock shards from the team's particle pack, tools/assets), dust that floats (soft puffs), and sparks, unlit and
// bright enough for the bloom to catch; little cubes until the pack's shapes load.
import * as THREE from 'three';
import { scene } from './core.js';
import { loadPack, bake } from '../assets.js';
import { pixelate } from './pixel.js';

const N = 600, mat = pixelate(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), 'grain');   // (the chips and the dust in texels, render/pixel.js)
const make = (mt = mat) => { const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mt, N); m.count = 0; m.frustumCulled = false; m.castShadow = false; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); scene.add(m); return m; };
const chips = make(), puffs = make(), glints = make(new THREE.MeshBasicMaterial({ toneMapped: false })), MESHES = [chips, puffs, glints];
// (a model's shape, a unit across, in place of the cube)
for (const [m, f] of [[chips, 'fxShard'], [puffs, 'fxPuff']]) loadPack(f).then((gl) => { const g = bake(gl.scene); g.computeBoundingBox(); const b = g.boundingBox, s = 1 / Math.max(...b.getSize(new THREE.Vector3()).toArray()), c = b.getCenter(new THREE.Vector3()); g.translate(-c.x, -c.y, -c.z).scale(s, s, s); m.geometry.dispose(); m.geometry = g; }).catch(() => {});
const P = [];   // { p, v, s, life, t, c }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _c = new THREE.Color();
// A burst of n bits at pos: colour, speed, size, how long they last, gravity (dust floats, chips fall)
// (glow: a spark, drawn unlit at several times its colour)
export function burst(pos, { color = 0x8a6a48, n = 10, speed = 3, size = 0.07, life = 0.9, grav = 14, up = 2.5, spread = 1, glow = false } = {}) {
  for (let i = 0; i < n; i++) {
    if (P.length >= N) P.shift();
    const a = Math.random() * 6.283, sp = speed * (0.4 + Math.random() * 0.8);
    P.push({ p: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3 * spread, Math.random() * 0.3, (Math.random() - 0.5) * 0.3 * spread)),
      v: new THREE.Vector3(Math.cos(a) * sp * spread, up * (0.5 + Math.random()), Math.sin(a) * sp * spread), s: size * (0.6 + Math.random() * 0.8), life: life * (0.7 + Math.random() * 0.6), t: 0,
      c: _c.set(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.12).getHex(), rot: Math.random() * 6, grav, glow });
  }
}
export function dust(pos, n = 14, color = 0xb8a684, size = 0.35) { burst(pos, { color, n, speed: 1.6, size, life: 1.4, grav: -0.6, up: 0.7, spread: 1.6 }); }
// ---- The camera's shake (tester, 14 Nov: "like Valheim"). Two kinds, both turning the camera a little after it has been
// placed (player.js), so nothing carries over into the next frame's follow and the view never drifts or wobbles:
// - punch(k, dir): an impact, a blow landing or taken. A quick kick that peaks within PUNCH_T0 and is gone by about a
//   quarter of a second, nodding the view along the blow (dir, across the ground) with a short rattle over it. k from 0 to 1:
//   about 0.1 for a twig, 0.3 for an axe in a trunk, 0.45 for a pickaxe on rock, 0.6 for a tree crashing down beside you.
// - addShake(k): a rumble that dies away over a second or so (a boss's slam, thunder, the storm wall's buffeting).
// SHAKE.k is the setting (On 1, Reduced 0.4, Off 0: settings.js); every shake goes through it.
// GAIN: every shake a tenth stronger (a Greek reviewer, 23 Nov: "camera shake 10% stronger"), whatever asked for it, and
// CAP the most the view may turn on any axis however many come at once (radians: 4.5°, more than a boss's landing at its
// peak, so only a pile of them meets it), so a slam, a roar and a blow landing together never throw the view about.
export const SHAKE = { k: 1 };
export const shake = { k: 0, kicks: [], n: 0, last: 0 };   // (n, last: how many punches so far and the last one's strength, for the tests)
const PUNCH_T0 = 0.035, PUNCH_END = 0.28, PUNCH_A = 0.045, RUMBLE_A = 0.02, GAIN = 1.1, CAP = 0.08;   // (seconds; radians at full strength: 2.6° and 1.1°, before GAIN)
export function addShake(k) { shake.k = Math.min(1, shake.k + k); }
// a rumble held at k for as long as it's asked for each frame (the ground shaking as a boss comes)
export function rumble(k) { shake.k = Math.max(shake.k, Math.min(1, k)); }
export function punch(k, dir) {
  k = Math.min(1, k); if (!(k > 0)) return; shake.n++; shake.last = k;
  if (shake.kicks.length > 6) shake.kicks.shift();
  const l = dir ? Math.hypot(dir.x, dir.z) : 0;
  shake.kicks.push({ k, t: 0, dx: l ? dir.x / l : 0, dz: l ? dir.z / l : 0, side: Math.random() < 0.5 ? -1 : 1, ph: Math.random() * 6.283 });
}
const _f = new THREE.Vector3();
function applyShake(dt, camera) {
  let pitch = 0, yaw = 0, roll = 0;
  if (shake.kicks.length) camera.getWorldDirection(_f);
  const fx = _f.x, fz = _f.z, fl = Math.hypot(fx, fz) || 1;
  for (let i = shake.kicks.length - 1; i >= 0; i--) {
    const q = shake.kicks[i]; q.t += dt; if (q.t > PUNCH_END) { shake.kicks.splice(i, 1); continue; }
    const u = q.t / PUNCH_T0, env = u * Math.exp(1 - u), rattle = Math.sin(q.t * 70 + q.ph) * Math.exp(-q.t * 22), A = q.k * PUNCH_A;
    // (a blow going away from the camera nods the view down, one across it turns it a touch; always a little roll)
    const along = q.dx || q.dz ? (q.dx * fx + q.dz * fz) / fl : 1, across = q.dx || q.dz ? (q.dx * -fz + q.dz * fx) / fl : 0;
    pitch -= A * (0.55 * along * env + 0.3 * rattle); yaw -= A * (0.45 * across * env + 0.15 * q.side * rattle); roll += A * q.side * (0.35 * env + 0.25 * rattle);
  }
  if (shake.k > 0.001) {
    const t = performance.now() / 1000, a = shake.k * shake.k * RUMBLE_A;
    pitch += a * (Math.sin(t * 37) * 0.6 + Math.sin(t * 61 + 1.3) * 0.4); yaw += a * (Math.sin(t * 43 + 2.1) * 0.6 + Math.sin(t * 71 + 0.4) * 0.4); roll += a * 0.5 * Math.sin(t * 29 + 4);
    shake.k = Math.max(0, shake.k - dt * 2.5);
  }
  const k = SHAKE.k * GAIN, cap = (a) => Math.max(-CAP, Math.min(CAP, a * k)); shake.turn = 0; if (!k || !(pitch || yaw || roll)) return;
  shake.turn = Math.max(Math.abs(cap(yaw)), Math.abs(cap(pitch)), Math.abs(cap(roll)));   // (the largest turn this frame, for the tests)
  camera.rotateY(cap(yaw)); camera.rotateX(cap(pitch)); camera.rotateZ(cap(roll));
}
// What a blow throws up, by what it struck: wood chips and pale splinters off a trunk or log, stone chips, dust and a
// spark off rock, leaves and twigs off a bush, a puff and a few sparks off a creature's hide. k: how hard (0 to 1)
export function impact(at, kind, k = 0.5) {
  const n = (a) => Math.max(1, Math.round(a * (0.6 + k)));
  if (kind === 'wood') { burst(at, { color: 0x9a7650, n: n(10), speed: 3.2, size: 0.09 }); burst(at, { color: 0xd8c09a, n: n(6), speed: 2.6, size: 0.06 }); burst(at, { color: 0x4e3a28, n: n(4), speed: 2, size: 0.11, life: 1.2 }); dust(at, n(2), 0x6e5e46, 0.14); }   // (chips, splinters, bark, a puff of sawdust: dust shows far paler in the sun than its colour)
  else if (kind === 'stone') { burst(at, { color: 0x8f897f, n: n(9), speed: 3.6, size: 0.08 }); dust(at, n(3), 0x645f57, 0.18); spark(at, n(4)); }
  else if (kind === 'leaves') { burst(at, { color: 0x4f6e2c, n: n(12), speed: 2, size: 0.1, grav: 3.5, life: 1.6, up: 2, spread: 1.4 }); burst(at, { color: 0x7a9a44, n: n(5), speed: 1.5, size: 0.07, grav: 3, life: 1.7, spread: 1.4 }); burst(at, { color: 0x6a4a30, n: n(4), speed: 2.4, size: 0.07 }); }   // (leaves drift down, twigs drop)
  else if (kind === 'hide') { dust(at, n(3), 0xc8b8a0, 0.2); spark(at, n(2)); }
  else if (kind === 'dull') { burst(at, { color: 0x9b958c, n: 3, speed: 1.6, size: 0.04 }); spark(at, 1); }
}
// a few hot, quick sparks (they fly fast, fall and burn out within a third of a second)
export function spark(at, n = 3) { burst(at, { color: 0xffc070, n, speed: 4.5, size: 0.045, grav: 9, life: 0.3, up: 2, glow: true }); }
// ---- A boss's arrival (trial.js): a pillar of light rising where it will come down, then the blast as it lands, a white
// flash and a shockwave racing out along the ground, the dust it raises following it out. One of each, made at load and kept
// in the scene unseen (so their shaders are compiled with the rest: main.js warmUp), moved and faded here.
const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false, toneMapped: false });   // (one pass: added light needs no back-then-front order)
const flashM = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), glowMat(new THREE.Color(2, 1.8, 1.5))), waveM = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 72).rotateX(-Math.PI / 2), glowMat(new THREE.Color(1.8, 1.45, 1)));
const pillarM = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.8, 1, 28, 1, true).translate(0, 0.5, 0), glowMat(new THREE.Color(2.4, 2, 1.4)));
for (const m of [flashM, waveM, pillarM]) { m.visible = false; m.frustumCulled = false; m.renderOrder = 6; scene.add(m); }
const ARRIVE = { pillar: null, blast: null };
// the pillar over at (a Vector3 on the ground): it gathers for rise seconds, then shoots up as high as high, stands, and
// fades as the blast comes (blast() ends it)
export function pillar(at, { rise = 1.2, high = 70, r = 2.4 } = {}) { ARRIVE.pillar = { at: at.clone(), t: 0, rise, high, r }; }
// the blast at at: the flash, the shockwave out to reach metres over a second, its dust ring
export function blast(at, { reach = 38, dust: col = 0x6e6254 } = {}) { ARRIVE.blast = { at: at.clone(), t: 0, reach, col, last: 0 }; if (ARRIVE.pillar) ARRIVE.pillar.end = ARRIVE.pillar.t; }
function updateArrival(dt) {
  const A = ARRIVE.pillar;
  if (A) { A.t += dt; const up = Math.min(1, A.t / A.rise), out = A.end !== undefined ? Math.min(1, (A.t - A.end) / 0.35) : 0, h = A.high * (0.08 + 0.92 * up * up);
    pillarM.visible = out < 1; pillarM.position.copy(A.at); pillarM.scale.set(A.r * (1 + out * 0.6), h, A.r * (1 + out * 0.6)); pillarM.material.opacity = (0.15 + 0.6 * up) * (1 - out) * (0.85 + 0.15 * Math.sin(A.t * 37));
    if (Math.random() < dt * 30 * (1 - out)) burst(A.at, { color: 0x6e6254, n: 1, speed: 1.2, up: 6 + up * 8, grav: -2, size: 0.5 + 0.5 * up, life: 2, spread: 1.2 });   // (the dust drawn up the column)
    if (out >= 1) { ARRIVE.pillar = null; pillarM.visible = false; } }
  const B = ARRIVE.blast;
  if (B) { B.t += dt; const f = Math.min(1, B.t / 0.28), w = Math.min(1, B.t / 1.1), r = B.reach * (1 - (1 - w) ** 2.2);
    flashM.visible = f < 1; flashM.position.copy(B.at).setY(B.at.y + 2); flashM.scale.setScalar(3 + 9 * Math.sqrt(f)); flashM.material.opacity = 0.8 * (1 - f) ** 2;
    waveM.visible = w < 1; waveM.position.copy(B.at).setY(B.at.y + 0.25); waveM.scale.set(r, 1, r); waveM.material.opacity = 0.9 * (1 - w) ** 1.3;
    // (the dust ring the wave throws up as it passes, thinning as it goes out)
    if (w < 1) for (let i = 0, n = Math.round(4 * (1 - w)); i < n; i++) { const a = Math.random() * 6.283; burst(_c2.set(B.at.x + Math.cos(a) * r, B.at.y + 0.3, B.at.z + Math.sin(a) * r), { color: B.col, n: 1, speed: 2, up: 1.2, grav: -0.5, size: 0.55 + 0.55 * (1 - w), life: 1.6, spread: 1.5 }); }
    if (w >= 1 && f >= 1) { ARRIVE.blast = null; flashM.visible = waveM.visible = false; } }
}
const _c2 = new THREE.Vector3();
// ---- On the ground, for a boss fight (trial.js): rings racing out from a roar or a slam (ring), and marks lying on the
// ground: a glow where a blow or a bolt is about to fall, the shadow of a thrown rock where it will land (mark), and the
// cracks a slam leaves (cracks). A few of each made at load and kept in the scene unseen, as the arrival's are, each with
// its own copy of one material (one program), reused round and round.
const discTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 63);
  gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.72, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.9, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const crackTex = (() => { const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); x.strokeStyle = '#fff'; x.lineCap = 'round';
  const arm = (px, py, a, len, w) => { for (let i = 0; i < 7 && len > 4; i++) { const nx = px + Math.cos(a) * len / 7 * 1.6, ny = py + Math.sin(a) * len / 7 * 1.6; x.lineWidth = w; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke(); px = nx; py = ny; a += (Math.random() - 0.5) * 0.7; w *= 0.85; if (Math.random() < 0.25) arm(px, py, a + (Math.random() < 0.5 ? -0.8 : 0.8), len * 0.4, w * 0.7); } };
  for (let i = 0; i < 9; i++) arm(N / 2, N / 2, (i / 9) * Math.PI * 2 + Math.random() * 0.4, N * (0.32 + Math.random() * 0.14), 5); return new THREE.CanvasTexture(c); })();
const flatMat = (o) => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, ...o });
const pool = (n, geo, mat) => Array.from({ length: n }, () => { const m = new THREE.Mesh(geo, mat.clone()); m.visible = false; m.frustumCulled = false; m.renderOrder = 5; scene.add(m); return m; });
const RINGS = pool(6, new THREE.RingGeometry(0.9, 1, 96).rotateX(-Math.PI / 2), glowMat(new THREE.Color(1.6, 1.3, 0.9)));
const GLOWS = pool(8, new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), flatMat({ map: discTex, blending: THREE.AdditiveBlending, toneMapped: false }));
const SHADOWS = pool(4, new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), flatMat({ map: discTex, color: 0x000000 }));
const CRACKS = pool(4, new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), flatMat({ alphaMap: crackTex, color: 0x140f0a }));
const live = [];   // { m, t, life, f(m, t): sets it for its age t }
const take = (list) => { const m = list.find((x) => !x.visible) || list.reduce((a, b) => ((a.userData.t0 ?? 0) < (b.userData.t0 ?? 0) ? a : b)); for (let i = live.length - 1; i >= 0; i--) if (live[i].m === m) live.splice(i, 1); m.visible = true; m.userData.t0 = performance.now(); return m; };
// a ring racing out along the ground from at to reach metres over time seconds, fading as it goes (k: how bright; color);
// or (grow: false) standing at reach, swelling into sight and fading over time (how far something will reach)
export function ring(at, { reach = 15, time = 0.6, k = 0.9, color, grow = true } = {}) {
  const m = take(RINGS); m.position.copy(at).setY(at.y + 0.3); if (color) m.material.color.set(color).multiplyScalar(1.6); else m.material.color.setRGB(1.6, 1.3, 0.9);
  live.push({ m, t: 0, life: time * 1.15, f: (m, t) => { const u = Math.min(1, t / time), r = grow ? reach * (1 - (1 - u) ** 2) : reach; m.scale.set(r, 1, r); m.material.opacity = k * (grow ? (1 - u) ** 1.2 * Math.min(1, t * 20) : Math.sin(Math.PI * u) ** 0.5); } });
}
// A mark on the ground, r metres across its half, at (its y: the ground there): glow (lit, additive: a blow or a bolt to
// come; color) or a shadow (dark: where a rock will land). Returns it: set(k) brings it in and out (0..1, and r grown
// or shrunk with r2), done() lets it go. Left alone it fades out after life seconds.
export function mark(at, { r = 3, color = 0xff8040, shadow = false, life = 6 } = {}) {
  const m = take(shadow ? SHADOWS : GLOWS); m.position.copy(at).setY(at.y + 0.12); m.scale.set(r, 1, r); if (!shadow) m.material.color.set(color); m.material.opacity = 0;
  const h = { m, k: 0, t: 0, life, set: (k, r2) => { h.k = k; if (r2) m.scale.set(r2, 1, r2); }, done: () => { h.life = Math.min(h.life, h.t + 0.25); h.out = true; } };
  live.push({ m, t: 0, life: 99, f: (m, t, e) => { h.t = t; const fade = h.out || t > h.life ? Math.max(0, 1 - (t - h.life + 0.25) / 0.25) : 1; m.material.opacity = (shadow ? 0.55 : 0.9) * h.k * fade; if (fade <= 0) e.life = 0; } });
  return h;
}
// the cracks a great blow leaves in the ground, r metres out, dark, fading over life seconds
export function cracks(at, { r = 6, life = 7 } = {}) {
  const m = take(CRACKS); m.position.copy(at).setY(at.y + 0.1); m.scale.set(r, 1, r); m.rotation.y = Math.random() * 6.283;
  live.push({ m, t: 0, life, f: (m, t) => { m.material.opacity = 0.85 * Math.min(1, t * 12) * Math.min(1, (life - t) / 2); } });
}
function updateMarks(dt) {
  for (let i = live.length - 1; i >= 0; i--) { const e = live[i]; e.t += dt; if (e.t >= e.life) { e.m.visible = false; live.splice(i, 1); continue; } e.f(e.m, e.t, e); if (e.life <= 0) { e.m.visible = false; live.splice(i, 1); } }
}
// ---- slow motion: a moment of it as a boss lands (main.js scales the frame's time by TIME.k, eased back to 1 over real time)
const TIME = { k: 1, hold: 0, low: 1 };
export function slowMo(secs, k = 0.3) { TIME.hold = Math.max(TIME.hold, secs); TIME.low = Math.min(TIME.low, k); }
export function timeK(raw) {
  if (TIME.hold > 0) { TIME.hold -= raw; TIME.k += (TIME.low - TIME.k) * Math.min(1, raw * 14); } else { TIME.low = 1; TIME.k += (1 - TIME.k) * Math.min(1, raw * 5); if (TIME.k > 0.995) TIME.k = 1; }
  return TIME.k;
}
export function updateFx(dt, camera) {
  updateArrival(dt); updateMarks(dt);
  const n = [0, 0, 0];
  for (let i = P.length - 1; i >= 0; i--) {
    const b = P[i]; b.t += dt; if (b.t >= b.life) { P.splice(i, 1); continue; }
    b.v.y -= b.grav * dt; b.v.multiplyScalar(1 - dt * (b.grav < 0 ? 2.5 : 0.6)); b.p.addScaledVector(b.v, dt); b.rot += dt * 6;
    const k = 1 - Math.max(0, (b.t - b.life * 0.6) / (b.life * 0.4));
    _e.set(b.rot, b.rot * 0.7, 0); _q.setFromEuler(_e); _s.setScalar(b.s * k);
    const k2 = b.glow ? 2 : b.grav < 0 ? 1 : 0, mesh = MESHES[k2]; mesh.setMatrixAt(n[k2], _m.compose(b.p, _q, _s)); _c.set(b.c); if (b.glow) _c.multiplyScalar(4 * k); mesh.setColorAt(n[k2], _c); n[k2]++;
  }
  // (only the bits alive are sent to the card, and nothing when there are none: the buffers hold room for 600 each)
  for (const [k2, mesh] of MESHES.entries()) { mesh.count = n[k2]; if (!n[k2]) continue; for (const [a, w] of [[mesh.instanceMatrix, 16], [mesh.instanceColor, 3]]) { a.clearUpdateRanges(); a.addUpdateRange(0, n[k2] * w); a.needsUpdate = true; } }
  applyShake(dt, camera);
}
