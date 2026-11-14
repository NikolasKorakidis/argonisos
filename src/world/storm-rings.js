// The rings of cloud round Zeus's storm (the player's requests, 14 Nov: "circles clouds around the massive storm… in a
// few layers and they spin around slowly to look more epic"; then "way closer to the storm… very, very circular, like
// good circles… only 3 rings: one small on the bottom, one medium in the middle, and then one big on the top… a little
// bit thinner"). Three thin bands of faceted cloud wheel round the storm wall (stormwall.js), true circles round the
// middle it turns about, one over another: a small one low round its foot, a wider one round its flanks and the widest
// round the rim of its anvil, each turning its own way, once in some eight to ten minutes.
//   Each is as tight as it can be: just outside the nearest the storm's billows reach at its heights (from the wall's
//   border field), so it never strays out over the island. The storm isn't round, so elsewhere a ring runs into it, and
//   is lost in the cloud there.
//   The lumps are one low-poly heap drawn as instances (one draw for every band), placed in the vertex shader and lit per
//   pixel: storm grey, lighter on their tops, lit from inside by the wall's lightning, hazed with distance as the wall is.
//   They are drawn on the finished frame, after the marched wall has been laid over it, against the scene's depth kept
//   for them, and each corner of a lump looks along the line of sight through the wall's own shape (its border field and
//   its great lobes, as the march finds them, its billows pushed out a little to be safe) for how much of the wall stands
//   in front of it: where a ring runs into the storm it sinks into the cloud softly, where it passes in front it crosses
//   in front, and no lump ever shows sharp over the cloud. (Drawn into the scene instead, the march would stop at them a
//   quarter-sized pixel at a time and leave a rim of sky round every lump.) The frame's grade is laid on them as the
//   atmosphere pass lays it on everything else.
//   Only drawn while a band is in view (each held in one ball, so none is ever dropped while any of it shows), with the
//   post passes on (on Low the wall is a plain curtain), and gone once the wall opens.
import * as THREE from 'three';
import { OutputPass } from '../../vendor/three/jsm/postprocessing/OutputPass.js';
import { camera, scene, composer } from '../render/core.js';
import { ATMO } from '../render/atmosphere.js';
import { mergeGeometries, mergeVertices } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
import { seeded, smooth } from '../util/math.js';

// The bands: absolute height of the middle (m), half its thickness, how far out its lumps straggle (m), its turn (rad/s,
// the sign its way), the room it leaves the storm (m), how much wider than the one below it is at least, its tilt (m) and
// the bearing of its highest point, how much sun reaches it, and how big its lumps are (m)
const BANDS = [
  { h: 260, th: 12, w: 25, spin: (2 * Math.PI) / 600, gap: 40, grow: 1, tilt: 0, tiltA: 0, lit: 0.6, size: [40, 65] },
  { h: 520, th: 15, w: 30, spin: -(2 * Math.PI) / 540, gap: 60, grow: 1.18, tilt: 20, tiltA: 2.2, lit: 0.8, size: [50, 80] },
  { h: 830, th: 18, w: 35, spin: (2 * Math.PI) / 480, gap: 80, grow: 1.18, tilt: 35, tiltA: 4.0, lit: 1, size: [65, 105] },
];
const NR = BANDS.length;

// ---- The storm's outline, as the wall's march draws it (storm-shader.js): how far past the border its billows can reach
// at a height over the ground, at most (the noise pushed all the way out), and how high its tops can stand at a distance
// from the island's middle (its arms sink and fray away out at sea)
const reach = (h) => Math.max(125 * smooth(46, 64, h) * (1 - smooth(70, 290, h)), -4 + 46 * smooth(0, 260, h), 320 * smooth(470, 760, h));
const furthest = (h) => reach(h) + (26 + 0.13 * Math.max(h, 0)) * 1.7 + 18 + 0.04 * Math.max(h, 0);
const tallest = (r) => (r > 2790 ? 0 : 960 * (1 - 0.85 * smooth(1650, 2450, r - 130)));
// The nearest the storm comes to its middle at a band's heights, over every bearing: the furthest out it reaches along
// each (most of the way out to where its billows can reach: they seldom get so far, and where one does it swallows the
// lump softly), and the least of those
function nearest(b, field, centre) {
  const lo = b.h - b.th - b.size[1] * 0.6, hi = b.h + b.th + b.size[1] * 0.6, hs = [lo, (lo + hi) / 2, hi]; let near = Infinity;
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a); let last = 0;
    for (let r = 20; r < 3400; r += 10) {
      const x = centre.x + dx * r, z = centre.y + dz * r, [sd, g] = field(x, z), R = Math.hypot(x, z);
      if (hs.some((h) => sd > -furthest(h - g) * 0.8 && h < tallest(R))) last = r;
    }
    if (last > 0) near = Math.min(near, last);
  }
  return near;
}

// ---- One lump: three overlapping low-poly balls, the middle one biggest, their corners pushed about, the bottom
// flattened; long along the band (x), shallower across it (z). Indexed, each corner once (its faces are found on the
// screen, so it is drawn faceted like the sky's clouds while the costly look into the wall is made once per corner)
function lumpGeo() {
  const r = seeded(4111), parts = [], v = new THREE.Vector3();
  [[-0.5, 0.62], [0.05, 0.85], [0.55, 0.58]].forEach(([x, s]) => {
    const g = new THREE.IcosahedronGeometry(s, 1), p = g.attributes.position, lift = s * (0.3 + r() * 0.2);   // (each corner pushed by a hash of where it is, so the faces still meet)
    for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k); const h = Math.sin(v.x * 91.7 + v.y * 47.3 + v.z * 13.1 + x * 7.7) * 43758.5453; v.multiplyScalar(1 + (h - Math.floor(h) - 0.5) * 0.25); p.setXYZ(k, v.x * 1.1 + x, Math.max(v.y + lift, 0), v.z * 0.8); }
    g.deleteAttribute('normal'); g.deleteAttribute('uv'); parts.push(mergeVertices(g));
  });
  const m = mergeGeometries(parts), g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', m.attributes.position); g.setIndex(m.index); return g;
}

// (COMMON: the wall's own border field, profile and turning, shared with its march)
const vert = (COMMON) => `${COMMON}
  attribute vec4 aA, aB;   // (band, where along it (turns), how far out across it (0..1), how high in it; size, length, a turn of its own, shade)
  uniform vec4 ringA[${NR}], ringB[${NR}]; uniform float fogV, fogMax; uniform vec4 flashP[4]; uniform float flashI[4];
  varying vec3 vW; varying vec4 vK;   // (where it is; how high in its lump, its shade, how much sun reaches its band, the lightning on it)
  varying float vA, vDist, vFog;
  // How much of the wall stands between the eye and a point: twelve looks along the line of sight at the wall's shape (the
  // border field, the profile and the great lobes, as the march finds them, the finer billows taken at half their
  // furthest), closer together towards the point, where a ring meets the cloud
  float wallBefore(vec3 w) {
    vec3 o = cameraPosition, d = w - o; float od = 0.0, L = length(d);
    for (int i = 0; i < 12; i++) {
      float x = (float(i) + 0.5) / 12.0, f = 1.0 - (1.0 - x) * (1.0 - x);
      vec3 p = o + d * f; vec2 fg = fieldAt(p.xz); float h = p.y - fg.y, r = length(p.xz);
      if (h > uTop + 200.0 || fg.x < -900.0) continue;
      float lo = texture(tNoise, turn(p, uT * (0.0014 + h * 0.000003)) / vec3(1500.0, 2200.0, 1500.0)).r;
      float env = fg.x + reach(h) + (lo - 0.5) * 2.0 * amp(h) * 1.7 + (18.0 + 0.04 * max(h, 0.0)) * 0.5, tail = smoothstep(1650.0, 2450.0, r + (lo - 0.5) * 260.0), topH = (uTop + (lo - 0.5) * 260.0) * (1.0 - tail * 0.85);
      od += smoothstep(-60.0, 20.0, env) * smoothstep(topH + 40.0, topH - 100.0, h) * smoothstep(-25.0, 10.0, h) * (1.0 - smoothstep(2250.0, 2650.0, r)) * 2.0 * (1.0 - x) / 12.0;
    }
    return 1.0 - exp(-od * L * 0.05);   // (a few tens of metres of cloud hide it)
  }
  void main() {
    int r = int(aA.x + 0.5); vec4 A = ringA[r], B = ringB[r];
    float u = fract(aA.y + A.w * uT / 6.2831853), a = u * 6.2831853;
    // round its circle, each lump lying along the band, turned a little its own way
    vec2 c = centre + vec2(cos(a), sin(a)) * (B.w + aA.z * A.z), tg = vec2(-sin(a), cos(a));
    float s = aB.x, cy = cos(aB.z), sy = sin(aB.z); tg = vec2(cy * tg.x - sy * tg.y, sy * tg.x + cy * tg.y); vec2 nm = vec2(tg.y, -tg.x);
    vec3 X = vec3(tg.x, 0.0, tg.y), Z = vec3(nm.x, 0.0, nm.y), sc = vec3(0.0), mid = vec3(c.x, A.x + aA.w * A.y + B.x * sin(a - B.y) - s * 0.35, c.y);
    // a lump wholly out of view is folded away before anything costly (every corner finds the same, so none is left half drawn)
    // (its ball against the frustum's sides, each side's slope taken into account, so none is folded while any of it shows)
    vec4 cc = projectionMatrix * viewMatrix * vec4(mid, 1.0); float rr = s * 2.2, px = projectionMatrix[0][0], py = projectionMatrix[1][1];
    if (cc.w < -rr || abs(cc.x) - rr * sqrt(px * px + 1.0) > cc.w || abs(cc.y) - rr * sqrt(py * py + 1.0) > cc.w) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    // where a band runs into the wall it thins and frays: each lump shrinks as the cloud closes in front of it, some sooner
    // than others
    float fray = smoothstep(0.0, 0.7, 1.0 - wallBefore(mid) + (fract(aA.y * 97.31) - 0.5) * 0.5); s *= mix(0.25, 1.0, fray);
    sc = vec3(s * aB.y, s * 0.6, s * 0.75); mid.y += (aB.x - s) * 0.35;
    vec3 w = mid + X * position.x * sc.x + vec3(0.0, position.y * sc.y, 0.0) + Z * position.z * sc.z;
    // the wall's lightning, lighting them from within over a long way
    float fl = 0.0; for (int k = 0; k < 4; k++) if (flashI[k] > 0.0) fl += flashI[k] * exp(-length(w - flashP[k].xyz) / (flashP[k].w * 3.0));
    // hazed with distance as the wall is (stormwall.js: thinner than the fog, never closing in)
    float t = length(w - cameraPosition); vFog = min(fogMax, 1.0 - exp(-t / fogV));
    vW = w; vK = vec4(smoothstep(0.0, 1.1, position.y), aB.w, B.z, min(fl, 2.0)); vA = 1.0 - wallBefore(w); vDist = t;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;
// Lit per pixel, each face by its own slope: storm grey, lighter on top (the sky's light on what faces up, the sun on what
// faces it, the undersides in shade); hidden behind the land (the scene's depth, kept as distance for the bolts and for
// these); graded as the frame is
const FRAG = `
  uniform sampler2D tLin; uniform vec2 fullRes; uniform vec3 sunDir, sunCol, ambCol, fogCol, flashCol, gTint; uniform float gSat, vigOffset, vigDark;
  varying vec3 vW; varying vec4 vK; varying float vA, vDist, vFog;
  void main() {
    vec2 uv = gl_FragCoord.xy / fullRes; if (vA < 0.02 || texture2D(tLin, uv).r < vDist - 2.0) discard;
    vec3 n = normalize(cross(dFdy(vW), dFdx(vW))); float top = vK.x, sky = 0.5 + 0.5 * n.y, sun = max(dot(n, sunDir), 0.0);
    vec3 amb = mix(ambCol, vec3(dot(ambCol, vec3(0.3, 0.5, 0.2))) * vec3(0.86, 0.92, 1.05), 0.8);   // (the sky's light greyed and cooled a little: the wall's palette, not the meadow's)
    vec3 c = vec3(0.085, 0.09, 0.105) * vK.y * (amb * (0.25 + 0.75 * sky) * (0.3 + 0.7 * top) * 1.5 + sunCol * sun * top * 1.3 * vK.z) + flashCol * vK.w * (0.12 + 0.2 * top);
    c = mix(c, fogCol, vFog) * gTint; float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = max(mix(vec3(l), c, gSat), 0.0);
    vec2 vu = (uv - 0.5) * vigOffset; c = mix(c, vec3(1.0 - vigDark), dot(vu, vu));
    gl_FragColor = vec4(c, vA);
    #include <colorspace_fragment>
  }`;

// Drawn on the finished frame, straight after the output pass has put it on the screen: on the screen's own buffer, in
// the same pass on the GPU (a pass of their own into the composer's full-sized, multisampled frame costs more than the
// bands themselves). With a depth of their own (the lumps only need to hide one another); the screen takes only the
// sRGB step, as the output pass gives it.
const SCENE = new THREE.Scene(), RINGS = { on: false };
function drawRings(renderer) {
  const R = MESH.material.uniforms; R.fogCol.value.copy(scene.fog.color).multiplyScalar(0.8); R.fogV.value = Math.max(scene.fog.far * 2.2, 170);   // (the wall's haze, from the fog as it is drawn, as its pass takes it)
  const veil = Math.min(1, Math.max(0, (60 - scene.fog.far) / 40)); R.fogV.value += (scene.fog.far * 0.5 - R.fogV.value) * veil; R.fogCol.value.multiplyScalar(1 + 0.25 * veil);   // (and a thick fog's: stormwall.js)
  const ac = renderer.autoClear; renderer.autoClear = false; renderer.setRenderTarget(null); renderer.clearDepth(); renderer.render(SCENE, camera); renderer.autoClear = ac;
}

let MESH = null; const BALLS = [], _frustum = new THREE.Frustum(), _m = new THREE.Matrix4();
// Built with the wall: field(x, z) its border field ([signed distance, smoothed ground]), U its uniforms (the field, the
// noise, the light and the lightning and the time are shared, so the bands always match the wall), COMMON its shaders'
// shared part.
export const RING_RADII = [];   // (each band's radius round the storm's middle, for a look in the dev tools)
export function buildStormRings(field, U, COMMON) {
  const centre = U.centre.value;
  BANDS.forEach((b, k) => { RING_RADII[k] = Math.round(Math.max(nearest(b, field, centre) + b.gap + b.w + b.size[1] * 0.6, (RING_RADII[k - 1] ?? 0) * b.grow)); });
  // the lumps: close round each circle, swelling and thinning along it, broken here and there by a small gap, a smaller
  // one heaped on most of them
  const g = lumpGeo(), A = [], B = [], r = seeded(7919);
  BANDS.forEach((b, k) => {
    const R = RING_RADII[k], gaps = Array.from({ length: 5 }, () => [r(), r() * Math.PI * 2]), swell = [2 + Math.floor(r() * 3), r() * 6.28, 5 + Math.floor(r() * 4), r() * 6.28];
    const n = Math.round((2 * Math.PI * R) / ((b.size[0] + b.size[1]) * 0.28));   // (close enough that they run together into one roll)
    for (let i = 0; i < n; i++) {
      const u = (i + (r() - 0.5) * 0.6) / n, thin = gaps.reduce((s, [f, p]) => s + Math.sin(u * Math.PI * 2 * (2 + Math.floor(f * 4)) + p), 0) / 5;
      if (thin < -0.45 && r() < 0.5) continue;
      const fat = 0.8 + 0.22 * Math.sin(u * Math.PI * 2 * swell[0] + swell[1]) + 0.12 * Math.sin(u * Math.PI * 2 * swell[2] + swell[3]), size = (b.size[0] + (b.size[1] - b.size[0]) * r()) * fat;
      A.push(k, (u + 1) % 1, 0.3 + r() * 0.4, (r() - 0.5) * 0.6); B.push(size, 1.3 + r() * 0.4, (r() - 0.5) * 0.2, 0.92 + r() * 0.16);
      if (r() < fat * 0.4) { A.push(k, (u + (r() - 0.5) / n + 1) % 1, 0.3 + r() * 0.4, 0.9 + r() * 0.6); B.push(size * (0.55 + r() * 0.25), 1.3 + r() * 0.3, (r() - 0.5) * 0.3, 1 + r() * 0.08); }   // (a smaller one on top, for a gentle bump)
    }
    // one ball that holds the whole band wherever its lumps are on their way round, for telling whether any is in view
    BALLS.push(new THREE.Sphere(new THREE.Vector3(centre.x, b.h, centre.y), R + b.w + b.tilt + b.th * 2 + b.size[1] * 2.5));
  });
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(new Float32Array(A), 4)); g.setAttribute('aB', new THREE.InstancedBufferAttribute(new Float32Array(B), 4)); g.instanceCount = A.length / 4;
  const ringA = BANDS.map((b) => new THREE.Vector4(b.h, b.th, b.w, b.spin)), ringB = BANDS.map((b, k) => new THREE.Vector4(b.tilt, b.tiltA, b.lit, RING_RADII[k]));
  const mat = new THREE.ShaderMaterial({ vertexShader: vert(COMMON), fragmentShader: FRAG, transparent: true, toneMapped: false, uniforms: {
    ...U, ringA: { value: ringA }, ringB: { value: ringB }, fogV: { value: 2400 }, fogCol: { value: new THREE.Color() },
    gTint: ATMO.gTint, gSat: ATMO.gSat, vigOffset: ATMO.vigOffset, vigDark: ATMO.vigDark } });
  MESH = new THREE.Mesh(g, mat); MESH.frustumCulled = false; MESH.name = 'stormRings'; SCENE.add(MESH);
  const out = composer.passes.find((p) => p instanceof OutputPass), put = out.render.bind(out);
  out.render = (renderer, ...rest) => { put(renderer, ...rest); if (RINGS.on && out.renderToScreen) drawRings(renderer); };
}
// Per frame (stormwall.js): whether to draw them (only while a band is in view and the wall stands); the answer, so the
// wall keeps the scene's depth for them
export function updateStormRings(on) {
  if (!MESH) return false;
  if (on) { _frustum.setFromProjectionMatrix(_m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); on = BALLS.some((b) => _frustum.intersectsSphere(b)); }
  return (RINGS.on = on);
}
