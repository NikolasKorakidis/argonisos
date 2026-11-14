// Zeus's storm wall: Valtos stays sealed this milestone. A wall of storm cloud some 800 m high stands on the marsh
// border (a contour of the biome field, so it follows the same wiggles as the land), turning slowly round the marsh and
// boiling upward, lit from inside by lightning, and anything that walks into it is pushed back out by the wind.
//   The cloud is marched as a volume (storm-shader.js) at a quarter of the resolution after the atmosphere pass, against
//   the scene's depth, so the land and trees in front of it hide it and its foot melts into the ground; it does its own
//   aerial perspective (darkened and blued with distance, but never lost in the player's mist), so it looms on the
//   horizon from anywhere on the island. Its shape comes from a 2D field of how far each place lies inside the border,
//   baked once.
//   Lightning (lightning.js, shared with the weather's thunderstorms): flashes in the cloud every second or so, some
//   striking down out of it as bolts; thunder follows at the speed of sound.
//   Near the wall the wind turns and blows into it, rain falls, the light darkens and dust is swept in.
//   On Low graphics (no post passes) a plain curtain stands in for it.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from '../../vendor/three/jsm/postprocessing/Pass.js';
import { biomeWeights, heightAt } from './gen.js';
import { scene, camera, composer, atmosphere, renderer, GFX, hemi } from '../render/core.js';
import { ATMO } from '../render/atmosphere.js';
import { WIND } from './wind.js';
import { WEATHER } from './weather.js';
import { strike, flashP, flashI, boltGeo, BOLT_U } from './lightning.js';
import { addShake } from '../render/fx.js';
import { stormAmbience } from '../audio/sound.js';
import { buildStormRings, updateStormRings } from './storm-rings.js';
import { COMMON, NOISE_FRAG, MARCH_FRAG, BLUR_FRAG, KEEP_FRAG, BOLT_VERT, BOLT_FRAG, DUST_VERT, DUST_FRAG } from './storm-shader.js';
import { ULTRA } from '../render/quality.js';

const WALL_V = 0.3, TOP = 790, SCALE = ULTRA ? 2 : 4;   // (the cloud is marched at a quarter of the resolution: it is soft, and it is costly. On Ultra at half: its billows' edges sharper)
const E = 2600, FS = 20, FN = Math.round((2 * E) / FS) + 1;   // (the border field: ±E metres, a texel every FS)
const CENTRE = new THREE.Vector2(-950, 950);                   // (the marsh's middle, which the storm turns round)
const _w = { p: 0, y: 0, v: 0, r: 0 };
const vAt = (x, z) => biomeWeights(x, z, _w).v;

export const STORM_WALL = { open: false, quiet: false, mesh: null, near: 0, away: 9999, flashes: 0 };   // (quiet: no lightning in the wall, for tests that weigh one frame against the next)
// How far inside the wall a point is (0 outside, rising to 1 a few metres in): the player controller pushes back by this
export function stormWallDepth(x, z) { if (STORM_WALL.open) return 0; return Math.min(1, Math.max(0, (vAt(x, z) - WALL_V) / 0.08)); }
// Direction out of the storm (towards lower Valtos weight), for the push-back
export function stormWallOut(x, z, out = new THREE.Vector2()) {
  const e = 3, gx = vAt(x + e, z) - vAt(x - e, z), gz = vAt(x, z + e) - vAt(x, z - e), l = Math.hypot(gx, gz) || 1;
  return out.set(-gx / l, -gz / l);
}

// ---- The border field: the signed distance to the border (inside Valtos positive) from the biome field's crossings
// spread outward (a two-pass chamfer), and the ground under it, smoothed, for the cloud's heights. Also the border's
// points and which way is in, where the lightning strikes.
let FIELD = null;
function buildField() {
  const N = FN, f = new Float32Array(N * N), d = new Float32Array(N * N).fill(1e9), pts = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) f[j * N + i] = vAt(-E + i * FS, -E + j * FS) - WALL_V;
  const cross = (a, b, xa, za, dx, dz) => {   // a crossing between two texels: each gets its distance to it
    const t = f[a] / (f[a] - f[b]); d[a] = Math.min(d[a], t * FS); d[b] = Math.min(d[b], (1 - t) * FS);
    const x = xa + dx * t * FS, z = za + dz * t * FS, s = f[b] > 0 ? 1 : -1; pts.push({ x, z, nx: dx * s, nz: dz * s });
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, x = -E + i * FS, z = -E + j * FS;
    if (i + 1 < N && (f[k] > 0) !== (f[k + 1] > 0)) cross(k, k + 1, x, z, 1, 0);
    if (j + 1 < N && (f[k] > 0) !== (f[k + N] > 0)) cross(k, k + N, x, z, 0, 1);
  }
  const D = FS * Math.SQRT2, pass = (k, n, w) => { if (d[n] + w < d[k]) d[k] = d[n] + w; };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; if (i > 0) pass(k, k - 1, FS); if (j > 0) { pass(k, k - N, FS); if (i > 0) pass(k, k - N - 1, D); if (i + 1 < N) pass(k, k - N + 1, D); } }
  for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) { const k = j * N + i; if (i + 1 < N) pass(k, k + 1, FS); if (j + 1 < N) { pass(k, k + N, FS); if (i + 1 < N) pass(k, k + N + 1, D); if (i > 0) pass(k, k + N - 1, D); } }
  // the ground near the border (sea level elsewhere), smoothed over some 100 m: the cloud's heights are measured from it
  const g = new Float32Array(N * N), g2 = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; if (d[k] < 700) g[k] = Math.max(0, heightAt(-E + i * FS, -E + j * FS)); }
  for (let r = 0; r < 2; r++) for (const [src, dst, step] of [[g, g2, 1], [g2, g, N]]) for (let k = 0; k < N * N; k++) {
    let s = 0, n = 0; for (let o = -3; o <= 3; o++) { const m = k + o * step; if (m >= 0 && m < N * N && (step === N || Math.floor(m / N) === Math.floor(k / N))) { s += src[m]; n++; } } dst[k] = s / n;
  }
  const data = new Uint16Array(N * N * 2); let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, sd = (f[k] > 0 ? 1 : -1) * Math.min(d[k], 3000);
    data[k * 2] = THREE.DataUtils.toHalfFloat(sd); data[k * 2 + 1] = THREE.DataUtils.toHalfFloat(g[k]);
    if (sd > -720) { const x = -E + i * FS, z = -E + j * FS; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }   // (the box the march stays in: the anvil and its billows reach some 550 m past the border)
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGFormat, THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  // the tiles (400 m) that hold any cloud, each a box from below the ground to over the anvil: what the view is tested
  // against each frame to tell whether the wall can be seen at all
  const T = 20, tiles = [];
  for (let tj = 0; tj < N; tj += T) for (let ti = 0; ti < N; ti += T) {
    let any = false; for (let j = tj; j < Math.min(N, tj + T + 1) && !any; j++) for (let i = ti; i < Math.min(N, ti + T + 1); i++) if (f[j * N + i] > 0 || d[j * N + i] < 720) { any = true; break; }
    if (any) tiles.push(new THREE.Box3(new THREE.Vector3(-E + ti * FS - 20, -40, -E + tj * FS - 20), new THREE.Vector3(-E + (ti + T) * FS + 20, TOP + 320, -E + (tj + T) * FS + 20)));
  }
  return { tex, pts, tiles, bounds: new THREE.Vector4(x0, z0, x1, z1) };
}
// the signed distance and smoothed ground at a place, read back from the field (bilinear, as the shader reads it)
function fieldAt(x, z) {
  const u = (x + E) / FS, v = (z + E) / FS, i = Math.max(0, Math.min(FN - 2, Math.floor(u))), j = Math.max(0, Math.min(FN - 2, Math.floor(v))), fu = Math.min(1, Math.max(0, u - i)), fv = Math.min(1, Math.max(0, v - j));
  const at = (a, b, c) => THREE.DataUtils.fromHalfFloat(FIELD.tex.image.data[((j + b) * FN + i + a) * 2 + c]);
  const lerp2 = (c) => (at(0, 0, c) * (1 - fu) + at(1, 0, c) * fu) * (1 - fv) + (at(0, 1, c) * (1 - fu) + at(1, 1, c) * fu) * fv;
  return [lerp2(0), lerp2(1)];
}
// the cloud's reach out over the land at a height (the shader's `reach`, for placing the bolts)
const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const reach = (h) => Math.max(125 * sm(46, 64, h) * (1 - sm(70, 290, h)), -4 + 46 * sm(0, 260, h), 320 * sm(470, 760, h));

// ---- Lightning (lightning.js): a flash somewhere along the wall every second or so, mostly within sight of the camera,
// now and then anywhere; a third of them strike down out of the cloud onto the land in front of it
let nextFlash = 2, CAVES = [];
function flash(cam, forced, near) {
  const pts = FIELD.pts; let best = null, bd = Infinity;
  for (let i = 0; i < 6; i++) { const c = pts[Math.floor(Math.random() * pts.length)], dd = Math.hypot(c.x - cam.x, c.z - cam.z) * (0.6 + Math.random()); if (dd < bd) { bd = dd; best = c; } }
  if (!forced && Math.random() < 0.25) best = pts[Math.floor(Math.random() * pts.length)];
  if (near) { bd = Infinity; for (const c of pts) { const dd = Math.hypot(c.x - near.x, c.z - near.z); if (dd < bd) { bd = dd; best = c; } } }
  const bolt = forced === 'bolt' || (forced !== 'cloud' && Math.random() < 0.35);
  const [, g] = fieldAt(best.x, best.z), h = bolt ? 120 + Math.random() * 300 : 80 + Math.random() * 640, inward = bolt ? -reach(h) + 10 : 30 + Math.random() * 220;
  const at = new THREE.Vector3(best.x + best.nx * inward, g + h, best.z + best.nz * inward);
  let ground = null;
  if (bolt) { const out = 30 + Math.random() * 110, gx = best.x - best.nx * out + (Math.random() - 0.5) * 80, gz = best.z - best.nz * out + (Math.random() - 0.5) * 80; ground = new THREE.Vector3(gx, Math.max(heightAt(gx, gz), -1), gz); }
  // (never down into a Giant's cave: the land's height over one is its floor, under the rock)
  if (ground && CAVES.some((c) => Math.hypot(c.x - ground.x, c.z - ground.z) < 50)) ground = null;
  // (it lights the land round you only when you're near the wall: from across the island it flickers in the cloud alone)
  STORM_WALL.flashes++; const far = sm(350, 800, at.distanceTo(cam));
  // (and you hear it only near the wall: a faint rumble now and then from the temple, nothing at all from Olympos, the
  // whole storm within a couple of hundred metres; measured from where you stand to the border)
  const hear = STORM_WALL.away > 600 && Math.random() > 0.35 ? 0 : (1 - sm(150, 1500, STORM_WALL.away)) ** 2.5;   // (from far off only now and then)
  return strike({ at, r: bolt ? 180 : 90 + Math.random() * 260, ground, light: (bolt ? 0.6 : 0.25) * (1 - far), big: bolt ? 1 : 0.8, hear });
}

// ---- The passes. Before the atmosphere pass, while the scene's depth is still whole (the composer's buffers share
// their depth, and the atmosphere's pass writes over it): the cloud marched at a quarter of the resolution, then softened,
// for the atmosphere pass to lay over the frame (atmosphere.js stormAt: in the same pass, so it costs no resolve of its
// own). After it, only while a bolt is lit: the bolts, over the cloud, against the depth kept for them. Each pass is
// switched off altogether when it has nothing to do (updateStormWall).
const U = {
  tDepth: { value: null }, tLin: { value: null }, tField: { value: null }, tNoise: { value: null }, tStorm: { value: null },
  projInv: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, fullRes: { value: new THREE.Vector2(1, 1) }, halfRes: { value: new THREE.Vector2(1, 1) }, camNF: { value: new THREE.Vector2(0.15, 6000) },
  bounds: { value: new THREE.Vector4() }, field: { value: new THREE.Vector3(E, FS, FN) }, centre: { value: CENTRE }, uT: { value: 0 }, uTop: { value: TOP }, scale: { value: SCALE },
  sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, ambCol: { value: new THREE.Color() }, fogCol: { value: new THREE.Color() },
  flashCol: { value: new THREE.Color(0.55, 0.62, 1.0) }, glowCol: { value: new THREE.Color(0.35, 0.55, 1.0) }, fogV: { value: 2400 }, fogMax: { value: 0.62 }, glow: { value: 0.3 },
  flashP: { value: flashP }, flashI: { value: flashI }, ...BOLT_U,
  caves: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
  mzR1: ATMO.mzR1, mzAmt: ATMO.mzAmt, mzTop: ATMO.mzTop, mzSoft: ATMO.mzSoft, mzCol: ATMO.mzCol,   // (the player's mist, over the wall's foot as over the land)   // (x, floor, z, radius of the Giants' caves near the wall: no cloud in them)
};
const quad = (fragmentShader) => new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: U, depthTest: false, depthWrite: false, vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader }));
const _frustum = new THREE.Frustum(), _m = new THREE.Matrix4(), _cc = new THREE.Color();
class StormPass extends Pass {
  constructor() {
    super(); this.needsSwap = false; this.wall = false; this.rings = false;
    const rt = (w = 2) => { const t = new THREE.WebGLRenderTarget(w, w, { type: THREE.HalfFloatType, depthBuffer: false }); t.texture.generateMipmaps = false; return t; };
    this.rt = rt(); this.soft = rt(); this.lin = rt(); this.lin.texture.minFilter = this.lin.texture.magFilter = THREE.NearestFilter;
    this.march = quad(MARCH_FRAG); this.blur = quad(BLUR_FRAG); this.keep = quad(KEEP_FRAG);
  }
  setSize(w, h) {
    const lw = Math.max(1, Math.ceil(w / SCALE)), lh = Math.max(1, Math.ceil(h / SCALE)); this.rt.setSize(lw, lh); this.soft.setSize(lw, lh); this.lin.setSize(w, h);
    U.fullRes.value.set(w, h); U.halfRes.value.set(lw, lh); ATMO.stormRes.value.set(lw, lh); ATMO.stormScale.value = SCALE;
  }
  render(renderer, writeBuffer, readBuffer) {
    ATMO.stormOn.value = 0; if (!U.tNoise.value) bakeNoise(renderer);
    U.fogCol.value.copy(scene.fog.color).multiplyScalar(0.8); U.fogV.value = Math.max(scene.fog.far * 2.2, 170);   // (the fog as it is drawn: high up it has opened out)
    const veil = Math.min(1, Math.max(0, (60 - scene.fog.far) / 40)); U.fogV.value += (scene.fog.far * 0.5 - U.fogV.value) * veil; U.fogMax.value = 0.62 + 0.38 * veil; U.fogCol.value.multiplyScalar(1 + 0.25 * veil);   // (a thick fog veils the wall as it does the land, in the fog's own colour)
    U.tDepth.value = readBuffer.depthTexture; U.projInv.value.copy(camera.projectionMatrixInverse); U.camWorld.value.copy(camera.matrixWorld); U.camPos.value.copy(camera.position); U.camNF.value.set(camera.near, camera.far);
    const ac = renderer.autoClear; renderer.autoClear = false; renderer.getClearColor(_cc); const ca = renderer.getClearAlpha();
    if (this.wall) {
      renderer.setRenderTarget(this.rt); renderer.setClearColor(0x000000, 0); renderer.clear(); this.march.render(renderer);
      U.tStorm.value = this.rt.texture; renderer.setRenderTarget(this.soft); this.blur.render(renderer);
      ATMO.tStorm.value = this.soft.texture; ATMO.stormOn.value = 1;
    }
    if (BOLTS_LIT() || this.rings) { renderer.setRenderTarget(this.lin); this.keep.render(renderer); U.tLin.value = this.lin.texture; }
    renderer.setClearColor(_cc, ca); renderer.autoClear = ac;
  }
}
class BoltPass extends Pass {
  constructor() {
    super(); this.needsSwap = false;
    this.bolts = new THREE.Mesh(boltGeo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: BOLT_VERT, fragmentShader: BOLT_FRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    this.bolts.frustumCulled = false; this.scene = new THREE.Scene(); this.scene.add(this.bolts);
  }
  render(renderer, writeBuffer, readBuffer) {   // (the bolts of the wall and of the weather's storms)
    const ac = renderer.autoClear; renderer.autoClear = false; renderer.setRenderTarget(this.renderToScreen ? null : readBuffer); renderer.render(this.scene, camera); renderer.autoClear = ac;
  }
}
const BOLTS_LIT = () => BOLT_U.boltI.value.some((k) => k > 0);
// Whether any of the wall can be seen: the field's tiles that hold cloud, each a box, against the view (within the
// distance it shows at); none from deep in a cave. Held on for a moment once seen, so it never flickers at the edge.
let PASS = null, BOLT_PASS = null, seenT = 0;
function wallInView(dt, inside) {
  camera.updateMatrixWorld(); _frustum.setFromProjectionMatrix(_m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const p = camera.position, far = Math.min(camera.far, 5000);
  const seen = !inside && FIELD.tiles.some((b) => b.distanceToPoint(p) < far && _frustum.intersectsBox(b));
  seenT = seen ? 0.5 : seenT - dt; return seenT > 0;
}
// the cloud noise, baked once on the GPU into a 64³ texture, a layer at a time
function bakeNoise(r) {
  const S = 64, rt = new THREE.WebGL3DRenderTarget(S, S, S, { depthBuffer: false }), t = rt.texture;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  const mat = new THREE.ShaderMaterial({ uniforms: { uZ: { value: 0 } }, vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: NOISE_FRAG, depthTest: false, depthWrite: false });
  const q = new FullScreenQuad(mat), prev = r.getRenderTarget();
  for (let z = 0; z < S; z++) { mat.uniforms.uZ.value = (z + 0.5) / S; r.setRenderTarget(rt, z); q.render(r); }
  r.setRenderTarget(prev); q.dispose(); mat.dispose(); U.tNoise.value = t;
}

// ---- Dust and leaves swept into the wall round the camera when you're near it
const DUST_N = 500, dustGeo = new THREE.BufferGeometry(), seeds = new Float32Array(DUST_N * 4);
for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST_N * 3), 3)); dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
const DU = { camPos: U.camPos, inward: { value: new THREE.Vector2(1, 0) }, uT: { value: 0 }, amount: { value: 0 }, speed: { value: 9 }, pxScale: { value: 400 }, dustCol: { value: new THREE.Color(0.16, 0.14, 0.11) } };
const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({ uniforms: DU, vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false }));
dust.frustumCulled = false; dust.visible = false;

// ---- On Low graphics (no post passes): the old curtain, taller, along the border
function buildCurtain(scene) {
  const pos = [], up = [], idx = [];
  for (const c of FIELD.pts) {   // (a short upright quad at each crossing, across the border's normal)
    const tx = -c.nz * 11, tz = c.nx * 11, [, g] = fieldAt(c.x, c.z), y = g - 6, n = pos.length / 3;
    pos.push(c.x - tx, y, c.z - tz, c.x + tx, y, c.z + tz, c.x + tx, y + TOP, c.z + tz, c.x - tx, y + TOP, c.z - tz); up.push(0, 0, 1, 1); idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aUp', new THREE.Float32BufferAttribute(up, 1)); geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: U.uT, uDay: { value: 1 } },
    vertexShader: 'attribute float aUp; varying float vUp; varying vec3 vW; void main() { vUp = aUp; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uT, uDay; varying float vUp; varying vec3 vW;
      float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(h(i), h(i + vec3(1, 0, 0)), f.x), mix(h(i + vec3(0, 1, 0)), h(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(h(i + vec3(0, 0, 1)), h(i + vec3(1, 0, 1)), f.x), mix(h(i + vec3(0, 1, 1)), h(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
      void main() { vec3 q = vW * 0.006 + vec3(uT * 0.01, -uT * 0.03, 0.0); float n = vn(q) * 0.6 + vn(q * 2.7) * 0.4;
        float a = smoothstep(0.0, 0.05, vUp) * (1.0 - smoothstep(0.75, 1.0, vUp) * (1.0 - n)) * smoothstep(2.0, 20.0, length(cameraPosition - vW));
        gl_FragColor = vec4(mix(vec3(0.01, 0.012, 0.02), vec3(0.08, 0.085, 0.11), n) * uDay, clamp(a, 0.0, 0.96)); }` });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.name = 'stormWall'; scene.add(mesh); return mesh;
}

export function buildStormWall(scene) {
  FIELD = buildField(); U.tField.value = FIELD.tex; U.bounds.value.copy(FIELD.bounds);
  // the caves within reach of the cloud (it reaches some 450 m out past the border at its widest). (sites.js is already
  // loaded by now: taken this way so as not to change the order the modules are first run in, which the heights rely on)
  import('./sites.js').then(({ SITES }) => { CAVES = SITES.caves.filter((c) => fieldAt(c.x, c.z)[0] > -720).slice(0, 4); CAVES.forEach((c, i) => U.caves.value[i].set(c.x, c.y ?? heightAt(c.x, c.z), c.z, 42)); });
  STORM_WALL.mesh = buildCurtain(scene); scene.add(dust);
  PASS = new StormPass(); BOLT_PASS = new BoltPass(); PASS.enabled = BOLT_PASS.enabled = false;
  composer.insertPass(PASS, composer.passes.indexOf(atmosphere)); composer.insertPass(BOLT_PASS, composer.passes.indexOf(atmosphere) + 1);
  buildStormRings(fieldAt, U, COMMON);   // (the bands of cloud wheeling round it)
  return STORM_WALL.mesh;
}

// Per frame, straight after the weather: the cloud's light, the lightning and thunder, and what being near the wall
// does to the wind, rain, light and sound. (still: the screenshot tests: the churn held, no lightning.)
const _c = new THREE.Color(), _o = new THREE.Vector2();
export function updateStormWall(time, dt, { light, focus, still, atmo, sun, sunDir, fogCol, inside = false }) {
  const open = STORM_WALL.open, m = STORM_WALL.mesh; if (!m || !FIELD) return;
  m.visible = !open && !GFX.post;
  // the pass only while some of the wall can be seen, or a bolt is lit (it draws the weather's too), or the rings round it are in
  // view (storm-rings.js: they need the scene's depth kept)
  if (PASS) { PASS.wall = !open && wallInView(dt, inside); PASS.rings = updateStormRings(!open && !inside); BOLT_PASS.enabled = BOLTS_LIT(); PASS.enabled = PASS.wall || PASS.rings || BOLT_PASS.enabled; if (!PASS.enabled) ATMO.stormOn.value = 0; } m.material.uniforms.uDay.value = 0.25 + light.day * 0.75;
  U.uT.value = time;
  // the cloud's light: the sun (or moon) and the sky's light round it, from the hemisphere light's sky colour; its
  // distance haze from the fog, but thinner (it must read from across the island) and never quite closing in
  U.sunDir.value.copy(sunDir).normalize(); U.sunCol.value.copy(sun.color).multiplyScalar(Math.min(1.6, sun.intensity) * 0.55);
  U.ambCol.value.copy(hemi.color).multiplyScalar(hemi.intensity * 0.9).lerp(fogCol, 0.3);
  U.glow.value = 0.12 + light.night * 0.5 + light.dusk * 0.2;
  // how near the wall the player is: 1 at the border, nothing 350 m out
  const [D] = fieldAt(focus.x, focus.z), near = open ? 0 : Math.max(0, Math.min(1, 1 + D / 350)); STORM_WALL.near = near; STORM_WALL.away = open ? 9999 : Math.max(0, -D);
  // near it: the wind turns to blow in, harder; rain; the light darkens; dust and leaves are swept in
  if (near > 0.01) {
    stormWallOut(focus.x, focus.z, _o); const k = near * near;
    WIND.dir.lerp(_o.negate(), k * 0.85).normalize(); WIND.speed = Math.max(WIND.speed, 3 + k * 12); WIND.gust = Math.max(WIND.gust, k * 0.6);
    DU.inward.value.copy(WIND.dir);
    atmo.overcast = Math.max(atmo.overcast, k * 0.95); atmo.dark = Math.max(atmo.dark, k * 0.5);
  }
  WEATHER.stormRain = near * near;
  dust.visible = near > 0.05 && !still; DU.amount.value = Math.min(1, near * 1.4); DU.uT.value = time; DU.pxScale.value = renderer.domElement.height * 0.5;
  _c.copy(fogCol).multiplyScalar(0.4); DU.dustCol.value.setRGB(0.12, 0.1, 0.08).lerp(_c, 0.5);
  stormAmbience(open ? 0 : 1 - sm(60, 550, STORM_WALL.away));   // (its roar and gale: in full within a couple of hundred metres, gone by 550)
  if (near > 0.5 && !still) addShake(dt * (near - 0.5) * 0.5);   // (the wind buffets you at its foot)
  // lightning: a flash every second or so somewhere along the wall, more often in a storm
  if (still || open || STORM_WALL.quiet) return;
  nextFlash -= dt; if (nextFlash <= 0) { nextFlash = (0.4 + Math.random() * 2.2) / (1 + WEATHER.storm); flash(camera.position); }
}
// For tests and a look in the dev tools: set off a flash now ('bolt' or 'cloud')
export function stormFlash(kind = 'bolt', near) { if (FIELD) return flash(camera.position, kind, near); }
