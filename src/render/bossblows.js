// What follows each of the bosses' blows, and the fight's storm (trial.js; the user, 25 Nov: "every attack gets a special
// effect that follows it", Valheim's bosses the measure of weight and spectacle). Particles from the GPU pool (emit.js)
// and a few marks on the ground and in the air, each kept in the scene unseen and reused:
//   scorch: a burnt patch where a bolt fell or the fire poured, its embers glowing a while in it
//   glow:   cracks glowing hot where a great blow bit (the slam, a pounce's landing, a charge into a wall), cooling
//   arc:    the bright sweep a blade or claws leave through the air, drawn out along the swing and fading
//   runes:  the goat head's spell, a ring of glowing signs on the ground round the Chimera as it calls the forest
// Everything bright goes through the settings: Reduce flashing (LIGHTNING.soft) dims the glows and the light thrown,
// and every shake goes through fx.js (the Shake setting).
import * as THREE from 'three';
import { scene } from './core.js';
import { spawn, rr, dir } from './emit.js';
import { askLight } from './lights.js';
import { LIGHTNING } from '../world/lightning.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const soft = () => (LIGHTNING.soft ? 0.45 : 1);
// ---- textures, drawn once on canvases
const canvasTex = (n, draw) => { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; };
const scorchTex = canvasTex(128, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n);
  for (let i = 0; i < 260; i++) { const a = Math.random() * 6.283, r = Math.random() ** 0.7 * n * 0.5; x.fillStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.35})`; x.beginPath(); x.arc(n / 2 + Math.cos(a) * r, n / 2 + Math.sin(a) * r, 1 + Math.random() * 5, 0, 6.283); x.fill(); } });
const crackTex = canvasTex(256, (x, N) => { x.strokeStyle = '#fff'; x.lineCap = 'round';
  const arm = (px, py, a, len, w) => { for (let i = 0; i < 8 && len > 4; i++) { const nx = px + Math.cos(a) * len / 8 * 1.6, ny = py + Math.sin(a) * len / 8 * 1.6; x.lineWidth = w; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke(); px = nx; py = ny; a += (Math.random() - 0.5) * 0.8; w *= 0.84; if (Math.random() < 0.3) arm(px, py, a + (Math.random() < 0.5 ? -0.9 : 0.9), len * 0.45, w * 0.7); } };
  for (let i = 0; i < 11; i++) arm(N / 2, N / 2, (i / 11) * Math.PI * 2 + Math.random() * 0.4, N * (0.3 + Math.random() * 0.17), 6); });
const runeTex = canvasTex(256, (x, n) => { x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 4; const c = n / 2;
  for (const r of [0.47, 0.4, 0.22]) { x.beginPath(); x.arc(c, c, n * r, 0, 6.283); x.stroke(); }
  x.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283, b = a + 6.283 * 2 / 6; x.beginPath(); x.moveTo(c + Math.cos(a) * n * 0.4, c + Math.sin(a) * n * 0.4); x.lineTo(c + Math.cos(b) * n * 0.4, c + Math.sin(b) * n * 0.4); x.stroke(); }
  x.font = 'bold 22px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; const signs = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';
  for (let i = 0; i < 18; i++) { const a = (i / 18) * 6.283; x.save(); x.translate(c + Math.cos(a) * n * 0.435, c + Math.sin(a) * n * 0.435); x.rotate(a + Math.PI / 2); x.fillText(signs[(i * 7) % signs.length], 0, 0); x.restore(); } });
// ---- the marks: a pool of each, unseen until used
const flat = (o) => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -3, toneMapped: false, ...o });
const pool = (n, geo, mat) => Array.from({ length: n }, () => { const m = new THREE.Mesh(geo, mat.clone()); m.visible = false; m.frustumCulled = false; m.renderOrder = 5; scene.add(m); return m; });
const plane = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
const SCORCH = pool(10, plane, flat({ map: scorchTex, color: 0x0d0907 })), EMBER = pool(10, plane, flat({ map: scorchTex, alphaMap: crackTex, blending: THREE.AdditiveBlending, color: 0xff5a14 }));
const GLOW = pool(6, plane, flat({ alphaMap: crackTex, blending: THREE.AdditiveBlending, color: 0xff6a20 })), RUNES = pool(2, plane, flat({ alphaMap: runeTex, blending: THREE.AdditiveBlending, color: 0x9a6cff }));
// an arc: a band round an axis, uv.x along the sweep and uv.y across it, drawn out (uReveal) and faded (uFade)
const arcGeo = (() => { const g = new THREE.BufferGeometry(), S = 40, pos = [], uv = [], idx = [];
  for (let i = 0; i <= S; i++) for (let j = 0; j < 2; j++) { const t = i / S; pos.push(t, j, 0); uv.push(t, j); }
  for (let i = 0; i < S; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g; })();
const arcMat = new THREE.ShaderMaterial({ uniforms: { uR0: { value: 3 }, uR1: { value: 9 }, uA0: { value: -1 }, uA1: { value: 1 }, uReveal: { value: 0 }, uFade: { value: 0 }, uCol: { value: new THREE.Color() } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  vertexShader: `uniform float uR0, uR1, uA0, uA1; varying vec2 vUv;
    void main() { vUv = uv; float a = mix(uA0, uA1, position.x), r = mix(uR0, uR1, position.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(sin(a) * r, 0.0, cos(a) * r, 1.0); }`,
  fragmentShader: `uniform float uReveal, uFade; uniform vec3 uCol; varying vec2 vUv;
    void main() { float y = clamp(vUv.y, 0.0, 1.0), lead = uReveal - vUv.x; if (lead < 0.0) discard;   // (clamped: a sample just off the band must not go below 0, or pow() gives NaN, drawn black)
      float tail = exp(-lead * 1.6), edge = (0.25 + 0.75 * y * y) * smoothstep(0.0, 0.3, y) * (1.0 - smoothstep(0.88, 1.0, y));   // (brightest at the blade's edge and its leading end)
      float a = tail * edge * uFade; if (a < 0.003) discard; gl_FragColor = vec4(uCol * a, 1.0); }` });
const ARCS = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(arcGeo, arcMat.clone()); m.visible = false; m.frustumCulled = false; m.renderOrder = 6; scene.add(m); return m; });
const live = [];   // { m, t, life, f(m, t) }
const take = (list) => { const m = list.find((x) => !x.visible) || list.reduce((a, b) => ((a.userData.t0 ?? 0) < (b.userData.t0 ?? 0) ? a : b)); for (let i = live.length - 1; i >= 0; i--) if (live[i].m === m) live.splice(i, 1); m.visible = true; m.userData.t0 = performance.now(); return m; };
const onGround = (m, p, r, lift = 0.1) => { m.position.set(p.x, p.y + lift, p.z); m.scale.set(r, 1, r); m.rotation.set(0, Math.random() * 6.283, 0); };
// a burnt patch r metres across its half, with embers glowing in it that die down over glow seconds; it fades after life
export function scorch(p, { r = 3, life = 14, glow = 5 } = {}) {
  const s = take(SCORCH), e = take(EMBER); onGround(s, p, r, 0.09); onGround(e, p, r * 0.85, 0.11); const k = soft();
  live.push({ m: s, t: 0, life, f: (m, t) => { m.material.opacity = 0.8 * Math.min(1, t * 8) * Math.min(1, (life - t) / 3); } });
  live.push({ m: e, t: 0, life: glow, f: (m, t) => { m.material.opacity = k * 1.6 * Math.min(1, t * 10) * (1 - t / glow) ** 1.5 * (0.8 + 0.2 * Math.sin(t * 13 + p.x)); } });
}
// cracks glowing hot where a great blow bit, r metres out, cooling over life seconds
export function hotCracks(p, { r = 6, life = 3.5 } = {}) { const m = take(GLOW), k = soft(); onGround(m, p, r, 0.12); live.push({ m, t: 0, life, f: (m, t) => { m.material.opacity = k * 1.8 * Math.min(1, t * 14) * (1 - t / life) ** 2; } }); }
// a sweep through the air: round the point at (its heading yaw), from r0 to r1 metres out, from angle a0 to a1 either side
// of the heading (radians), drawn out over time seconds, then fading over fade; tilt: the plane of it leaning (radians)
export function arc(at, yaw, { r0 = 3, r1 = 9, a0 = -1, a1 = 1, time = 0.2, fade = 0.45, col = 0xffe2a8, k = 2.2, tilt = 0 } = {}) {
  const m = take(ARCS), U = m.material.uniforms; m.position.copy(at); m.rotation.set(0, 0, 0); m.rotateY(yaw); m.rotateZ(tilt);
  U.uR0.value = r0; U.uR1.value = r1; U.uA0.value = a0; U.uA1.value = a1; U.uCol.value.set(col).multiplyScalar(k * soft()); U.uReveal.value = 0; U.uFade.value = 1;
  live.push({ m, t: 0, life: time + fade, f: (m, t) => { U.uReveal.value = Math.min(1.3, t / time); U.uFade.value = t < time ? 1 : 1 - (t - time) / fade; } });
}
// the goat head's signs on the ground round at, r metres out, turning slowly as they flare and fade over life seconds
export function runes(at, { r = 9, life = 3.2 } = {}) { const m = take(RUNES), k = soft(); onGround(m, at, r, 0.15);
  live.push({ m, t: 0, life, f: (m, t) => { m.rotation.y = t * 0.6; m.material.opacity = k * 1.5 * Math.min(1, t * 3) * Math.min(1, (life - t) / 1) * (0.8 + 0.2 * Math.sin(t * 9)); } }); }
export function updateBlows(dt) { for (let i = live.length - 1; i >= 0; i--) { const e = live[i]; e.t += dt; if (e.t >= e.life) { e.m.visible = false; live.splice(i, 1); continue; } e.f(e.m, e.t); } }
export const blowsWarm = () => [SCORCH[0], EMBER[0], GLOW[0], RUNES[0], ARCS[0]].map((m) => new THREE.Mesh(m.geometry, m.material));

// ---- particles: the pieces the effects are made of
const DUST = 0x7a6c5c;
// a cloud of dust rolling out from p along the ground, n puffs, as far as r
function dustRing(p, n, r, { col = DUST, size = 1.6, up = 1, life = 2.6 } = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = rr(0.5, 1); spawn(V(p.x, p.y + 0.3, p.z), V(Math.cos(a) * r * 2.2 * s, up * rr(0.5, 2), Math.sin(a) * r * 2.2 * s), { life: life * rr(0.7, 1.2), size: size * rr(0.6, 1.2), col, cover: 0.9, drag: 2.2, grow: 2.2, soft: 1, wind: 0.25, turb: 0.3, fade: 0.08, grav: -0.15 }); } }
// chunks of stone and earth flung up and falling
function debris(p, n, { speed = 9, up = 8, size = 0.35, col = 0x5e554b } = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = speed * rr(0.3, 1); spawn(V(p.x, p.y + 0.3, p.z), V(Math.cos(a) * s, up * rr(0.5, 1.2), Math.sin(a) * s), { life: rr(1.1, 2), size: size * rr(0.5, 1.4), col, k: rr(0.7, 1.1), cover: 1, grav: 18, drag: 0.3 }); } }
// hot sparks spraying out, falling and burning out
function sparks(p, n, { speed = 8, up = 5, col = 0xffb860, k = 4, life = 0.6, size = 0.08 } = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = speed * rr(0.3, 1); spawn(V(p.x, p.y, p.z), V(Math.cos(a) * s, up * rr(0.3, 1.3), Math.sin(a) * s), { life: life * rr(0.6, 1.4), size: size * rr(0.6, 1.3), col, k: k * soft(), cover: 0, grav: 12, drag: 1, heat: 0.8 }); } }
// embers drifting up off something burning, carried on the wind, flickering; delay: over how many seconds they come
function embers(p, n, { r = 1, life = 3, delay = 0, k = 3, size = 0.07 } = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = Math.random() * r; spawn(V(p.x + Math.cos(a) * s, p.y + 0.2, p.z + Math.sin(a) * s), V(rr(-0.6, 0.6), rr(1, 2.6), rr(-0.6, 0.6)), { life: life * rr(0.6, 1.3), size: size * rr(0.6, 1.4), col: 0xff8a30, k: k * soft(), cover: 0, grav: -0.6, drag: 0.8, heat: 0.9, turb: 0.8, wind: 0.35, flick: 0.6, delay: Math.random() * delay }); } }
// smoke rising and spreading
function smoke(p, n, { r = 1, life = 4, size = 1.4, col = 0x2a2522, delay = 0, up = 1.2 } = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = Math.random() * r; spawn(V(p.x + Math.cos(a) * s, p.y + 0.3, p.z + Math.sin(a) * s), V(rr(-0.4, 0.4), up * rr(0.6, 1.4), rr(-0.4, 0.4)), { life: life * rr(0.7, 1.3), size: size * rr(0.6, 1.3), col, cover: 0.85, grav: -0.25, drag: 0.6, grow: 2.6, soft: 1, wind: 0.55, turb: 0.4, fade: 0.2, delay: Math.random() * delay }); } }

// ---- the Minotaur
// the labrys brought down: stone and earth flung up, the dust rolling out in a ring, sparks off the blade, the ground split and glowing
export function slamFx(p, k = 1) { debris(p, Math.round(46 * k), { speed: 11, up: 10, size: 0.42 }); dustRing(p, Math.round(40 * k), 7 * k, { size: 2.2 }); sparks(p.clone().setY(p.y + 0.4), 30, { speed: 11, up: 6 }); hotCracks(p, { r: 6.5 * k }); smoke(p, 10, { r: 2, life: 3, size: 1.8, col: 0x4a4036 }); askLight(p.clone().setY(p.y + 2), 30 * soft(), 22, 0xff8a40, undefined, false); }
// the war cry: his breath steaming out in a cone, embers blown off him, and (enraged) red sparks crackling round him
export function roarFx(head, fwd, enrage) {
  for (let i = 0; i < 40; i++) { const v = fwd.clone().multiplyScalar(rr(6, 14)).add(V(rr(-2.5, 2.5), rr(-1.5, 1.5), rr(-2.5, 2.5))); spawn(head.clone().addScaledVector(fwd, 1), v, { life: rr(1.2, 2.2), size: rr(0.8, 1.4), col: 0xd8d4cc, k: 0.55, cover: 0.55, drag: 2.4, grow: 2.5, soft: 1, wind: 0.3, fade: 0.05 }); }
  for (let i = 0; i < 50; i++) { const v = dir(0.6, 1).normalize().multiplyScalar(rr(4, 12)); spawn(head.clone().setY(head.y - rr(0, 4)), v, { life: rr(0.8, 1.8), size: rr(0.06, 0.12), col: enrage ? 0xff3a1a : 0xff9040, k: 3 * soft(), cover: 0, drag: 1.5, heat: 0.7, flick: 0.4 }); }
  if (enrage) { sparks(head, 40, { speed: 9, up: 6, col: 0xff4020, k: 4 }); askLight(head.clone(), 40 * soft(), 30, 0xff3a20, undefined, false); }
}
// the labrys swung flat across in front of him: its bright arc through the air (side: which way it goes), dust thrown
// up along it, sparks where it ends
export function sweepFx(c, reach, arcW, side = 1) {
  const at = c.pos.clone().setY(c.pos.y + 1.6); arc(at, c.yaw, { r0: reach * 0.35, r1: reach, a0: arcW * side, a1: -arcW * side, time: 0.18, fade: 0.5, col: 0xffe8c0, k: 2.4 });
  for (let i = 0; i < 18; i++) { const a = c.yaw + (i / 17 - 0.5) * 2 * arcW, r = reach * rr(0.6, 1); const p = V(c.pos.x + Math.sin(a) * r, c.pos.y + 0.2, c.pos.z + Math.cos(a) * r);
    spawn(p, V(Math.cos(a) * -side * 4, rr(1, 3), -Math.sin(a) * -side * 4), { life: rr(1.2, 2), size: rr(1, 1.8), col: DUST, cover: 0.85, drag: 2.2, grow: 2, soft: 1, wind: 0.25, delay: (i / 17) * 0.15 }); }
}
// the charge: dust kicked up behind and clods flung from his hooves at each stride, a wake of dust on the air behind him
export function chargeFx(c, v, dt) {
  const f = V(Math.sin(c.yaw), 0, Math.cos(c.yaw)), n = Math.min(6, Math.round(dt * 60 * (0.5 + v / 10)));
  for (let i = 0; i < n; i++) { const p = c.pos.clone().addScaledVector(f, -c.T.r * rr(0.3, 1)).add(V(rr(-1, 1) * c.T.r * 0.6, 0.2, rr(-1, 1) * c.T.r * 0.6));
    spawn(p, f.clone().multiplyScalar(-v * rr(0.1, 0.35)).add(V(rr(-1, 1), rr(1, 3.5), rr(-1, 1))), { life: rr(1.4, 2.4), size: rr(1.2, 2.4), col: DUST, cover: 0.8, drag: 1.6, grow: 2.2, soft: 1, wind: 0.3, turb: 0.3 });
    if (Math.random() < 0.5) spawn(p, f.clone().multiplyScalar(-v * 0.4).add(V(rr(-2, 2), rr(3, 6), rr(-2, 2))), { life: rr(0.8, 1.3), size: rr(0.15, 0.35), col: 0x4e4234, cover: 1, grav: 16 }); }
}
// into a wall: stone bursting off it, dust, sparks, the ground cracked under him
export function crashFx(p, g) { debris(p, 50, { speed: 12, up: 9, size: 0.45, col: 0x8a8378 }); dustRing(p, 30, 5, { size: 2.4, col: 0x8a7a68 }); sparks(p, 24, { speed: 10 }); if (g) hotCracks(g, { r: 5, life: 2.5 }); }
// a stone torn out of the ground: earth and pebbles falling from it as he lifts it; the rock's trail of grit as it flies;
// and where it comes down, stone bursting and a ring of dust
export function rockCrumbs(p) { spawn(p.clone().add(V(rr(-0.8, 0.8), -0.6, rr(-0.8, 0.8))), V(rr(-0.5, 0.5), 0, rr(-0.5, 0.5)), { life: 1, size: rr(0.1, 0.25), col: 0x5e5246, cover: 1, grav: 14 }); }
export function rockTrail(p) { spawn(p.clone().add(V(rr(-0.5, 0.5), rr(-0.5, 0.5), rr(-0.5, 0.5))), V(rr(-0.6, 0.6), rr(-0.2, 0.6), rr(-0.6, 0.6)), { life: rr(0.9, 1.5), size: rr(0.8, 1.4), col: 0x8a7a68, cover: 0.6, drag: 1, grow: 2, soft: 1, wind: 0.3 }); }
export function rockLandFx(p) { debris(p, 30, { speed: 8, up: 7, size: 0.4, col: 0x8f8678 }); dustRing(p, 24, 4, { size: 1.8, col: 0x8a7a68 }); sparks(p, 8, { speed: 6 }); }
// a giant's foot coming down: a puff of dust round it and a little grit thrown up (k: how big the beast)
export function stepFx(p, k = 1) { dustRing(p, Math.round(5 * k), 0.9 * k, { size: 0.9 * k, up: 0.5, life: 1.6 }); if (Math.random() < 0.6) debris(p, 3, { speed: 2.5, up: 3, size: 0.12 }); }
// the dead of the Labyrinth clawing their way up: pale wisps of grave-light and the earth bursting
export function riseFx(p) { for (let i = 0; i < 26; i++) spawn(p.clone().add(V(rr(-0.8, 0.8), 0.2, rr(-0.8, 0.8))), V(rr(-0.4, 0.4), rr(1.5, 3.5), rr(-0.4, 0.4)), { life: rr(1.4, 2.6), size: rr(0.25, 0.6), col: 0x7ff0d0, k: 1.6 * soft(), cover: 0.1, soft: 1, turb: 0.9, drag: 0.8, grav: -0.5, fade: 0.15 }); debris(p, 12, { speed: 3, up: 5, size: 0.2, col: 0x4e3e2e }); dustRing(p, 8, 1.2, { size: 1 }); }

// ---- the Chimera
// claws raking down in front of it: three bright tears through the air, and the ground torn where the paw lands
export function clawFx(c, paw) {
  // (in front of its paws, clear of its own head and chest: a beast that long reaches well out in front of its middle)
  const f = V(Math.sin(c.yaw), 0, Math.cos(c.yaw)), at = (paw ? paw.clone() : c.pos.clone().addScaledVector(f, (c.T.body?.[1] ?? 0) + c.T.r)).addScaledVector(f, 1.5).setY(c.pos.y + c.T.h * 0.3);
  for (let i = 0; i < 3; i++) arc(at.clone().add(V(f.z * (i - 1) * 1.1, 0, -f.x * (i - 1) * 1.1)), c.yaw, { r0: 3.2 + i * 0.2, r1: 4.1 + i * 0.2, a0: 1, a1: -0.7, time: 0.14, fade: 0.45, col: 0xffd0a0, k: 3, tilt: Math.PI / 2 });
  if (paw) { debris(paw, 16, { speed: 6, up: 6, size: 0.3 }); dustRing(paw, 12, 2.5, { size: 1.6 }); }
}
// the serpent's sting: a streak of venom whipping round from the tail, droplets sprayed and a sickly mist where it struck
export function stingFx(tail, to) {
  const d = to.clone().sub(tail); for (let i = 0; i < 40; i++) spawn(tail.clone().addScaledVector(d, i / 40), V(rr(-0.4, 0.4), rr(-0.2, 0.4), rr(-0.4, 0.4)), { life: rr(0.5, 0.8), size: rr(0.4, 0.7), col: 0xb8ff40, k: 2 * soft(), cover: 0.2, soft: 1, delay: (i / 40) * 0.12 });
  for (let i = 0; i < 70; i++) spawn(to.clone(), dir(1, 1).multiplyScalar(rr(2, 7)), { life: rr(0.6, 1.1), size: rr(0.12, 0.22), col: 0x9aff30, k: 2.4 * soft(), cover: 0.4, grav: 10, drag: 0.8 });
  for (let i = 0; i < 24; i++) spawn(to.clone().add(V(rr(-1.5, 1.5), rr(0, 1.5), rr(-1.5, 1.5))), V(rr(-0.5, 0.5), rr(0.2, 0.8), rr(-0.5, 0.5)), { life: rr(2, 3.2), size: rr(1.6, 2.6), col: 0x7aba28, k: 0.9, cover: 0.5, drag: 1, grow: 2, soft: 1, wind: 0.3, fade: 0.15 });
  askLight(to.clone(), 18 * soft(), 14, 0x9aff40, undefined, false);
}
// the fire, every frame it pours: a white-hot core out of the jaws, flames rolling out and up, black smoke over them,
// embers falling out of it; and where it reaches the ground, scorch (scorchT: the caller's timer)
export function breathFx(mouth, f, dt, ground) {
  const n = Math.round(dt * 260); const side = V(f.z, 0, -f.x);
  for (let i = 0; i < n; i++) { const s = Math.random(), v = f.clone().multiplyScalar(rr(18, 30)).addScaledVector(side, rr(-3, 3)).add(V(0, rr(-3.5, 0.5), 0));
    if (s < 0.25) spawn(mouth, v, { life: rr(0.3, 0.5), size: rr(0.5, 0.9), col: 0xfff0c0, k: 3 * soft(), cover: 0.05, drag: 1.2, grow: 3, soft: 1, heat: 0.6, grav: -2 });
    else if (s < 0.75) spawn(mouth, v.multiplyScalar(0.85), { life: rr(0.6, 1), size: rr(0.8, 1.4), col: 0xff7a20, k: 2.2 * soft(), cover: 0.15, drag: 1.4, grow: 3.2, soft: 1, heat: 1, grav: -4, turb: 0.8, flick: 0.3 });
    else if (s < 0.9) spawn(mouth.clone().addScaledVector(f, rr(6, 14)), v.multiplyScalar(0.4).add(V(0, 2, 0)), { life: rr(1.6, 2.8), size: rr(1.4, 2.4), col: 0x1e1a18, cover: 0.85, drag: 1, grow: 2.5, soft: 1, grav: -1.5, wind: 0.5, turb: 0.5, fade: 0.25 });
    else spawn(mouth, v.multiplyScalar(0.7).add(V(0, 3, 0)), { life: rr(1, 1.8), size: rr(0.05, 0.1), col: 0xffa040, k: 3.5 * soft(), cover: 0, drag: 0.6, grav: 8, heat: 0.9, flick: 0.5 }); }
  if (ground) { for (let i = 0; i < Math.round(dt * 40); i++) spawn(ground.clone().add(V(rr(-2, 2), 0.2, rr(-2, 2))), V(rr(-3, 3), rr(1, 4), rr(-3, 3)), { life: rr(0.5, 0.9), size: rr(0.8, 1.6), col: 0xff6a18, k: 2 * soft(), cover: 0.15, drag: 2, grow: 2, soft: 1, heat: 1, grav: -3 }); }
}
// crouched to spring: dust drawn in round its paws; the leap: dust blown back; the landing: the ground split and glowing,
// stone and a wall of dust out round it
export function crouchFx(c) { if (Math.random() < 0.4) { const a = Math.random() * 6.283, r = c.T.r + 4; const p = V(c.pos.x + Math.cos(a) * r, c.pos.y + 0.2, c.pos.z + Math.sin(a) * r); spawn(p, V(-Math.cos(a) * 4, 0.5, -Math.sin(a) * 4), { life: 1, size: 1, col: DUST, cover: 0.6, drag: 1.5, grow: 1, soft: 1 }); } }
export function leapFx(p) { dustRing(p, 26, 4, { size: 2 }); debris(p, 16, { speed: 6, up: 6 }); }
export function landFx(p, r) { debris(p, 60, { speed: 13, up: 10, size: 0.45 }); dustRing(p, 50, r * 0.6, { size: 2.6, life: 3 }); hotCracks(p, { r: r * 0.7, life: 3 }); sparks(p, 20, { speed: 9 }); askLight(p.clone().setY(p.y + 2), 30 * soft(), 25, 0xff9a50, undefined, false); }
// the goat head's spell (the Chimera calling the forest): signs flaring on the ground round it, motes of violet light
// swirling up off its back and streaming away to where each of the forest's own will rise
export function goatSpellFx(back, ground, to = []) {
  runes(ground, { r: 11 }); askLight(back.clone(), 30 * soft(), 30, 0x9a6cff, undefined, false);
  for (let i = 0; i < 70; i++) spawn(back.clone().add(V(rr(-1, 1), rr(0, 1), rr(-1, 1))), V(rr(-1.5, 1.5), rr(2, 5), rr(-1.5, 1.5)), { life: rr(1.2, 2.4), size: rr(0.12, 0.3), col: i % 3 ? 0xb890ff : 0x80ffb0, k: 2.6 * soft(), cover: 0, drag: 0.8, turb: 2.2, grav: -0.5, flick: 0.4 });
  for (const t of to) { const d = t.clone().sub(back); for (let i = 0; i < 30; i++) { const k = i / 30; spawn(back.clone().addScaledVector(d, k).add(V(0, Math.sin(k * Math.PI) * 6, 0)), V(rr(-0.5, 0.5), rr(-0.2, 0.5), rr(-0.5, 0.5)), { life: rr(0.6, 1), size: rr(0.2, 0.4), col: 0xb890ff, k: 2.4 * soft(), cover: 0, soft: 1, delay: 0.3 + k * 0.6 }); }
    for (let i = 0; i < 30; i++) spawn(t.clone().setY(t.y + 0.3), V(rr(-1, 1), rr(1, 4), rr(-1, 1)), { life: rr(1, 1.8), size: rr(0.15, 0.35), col: 0x80ffb0, k: 2.2 * soft(), cover: 0, turb: 1.4, delay: 0.9 + Math.random() * 0.3 }); }
}

// ---- Zeus's storm
// where a bolt came down: the ground blasted (stone and earth flung up, a white burst of sparks), a burnt patch with
// embers glowing in it, smoke rising off it and embers drifting up a while after (big: how great a bolt)
export function boltFx(p, big = 1) {
  debris(p, Math.round(26 * big), { speed: 9, up: 9, size: 0.3, col: 0x3a3430 }); sparks(p.clone().setY(p.y + 0.4), Math.round(60 * big), { speed: 12, up: 8, col: 0xe0ecff, k: 5, life: 0.5 }); sparks(p.clone().setY(p.y + 0.4), 30, { speed: 7, up: 6 });
  dustRing(p, 16, 3 * big, { size: 1.6, col: 0x6a6a72 }); scorch(p, { r: 2.6 * big, life: 16, glow: 6 }); smoke(p, 14, { r: 1.2, life: 5, size: 1.4, delay: 3 }); embers(p, Math.round(30 * big), { r: 1.6 * big, life: 3, delay: 4 });
}
