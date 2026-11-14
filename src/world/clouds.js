// Clouds (the player's request, 13 Nov: "when it's a storm I can still see the stars… it should be very, very thick
// clouds… lower… and some clouds between the mountain"). All low-poly, faceted like the rest of the island, and each
// kind one or a few instanced draws, placed on the GPU:
//   Fair-weather cumulus: our own (tools/assets/clouds.py: domed billows over a flat base, evenly faceted, how open each
//   corner is to the sky in its colour), wide ones, a few towers and small puffs, their bases all at about one height as
//   real cumulus stand, drifting with the wind over a 9 km tile that wraps round the camera (out at the haze, where a
//   cloud has shrunk away), more of them the cloudier it is, and a few great ones out at the horizon. Lit by the sun or
//   moon from the sky's own colours: warm on the sunlit side at dawn and dusk, the shade cool, grey under a heavy sky,
//   dark blue by night.
//   The storm deck: one sheet of faceted lumps hung low over the island (some 150–230 m up), whole in a storm, broken into
//   drifting patches on a cloudy day, gone in fair weather; dark and heavy beneath, dipping to the horizon so little sky
//   shows. Ragged scud races along under it.
//   Olympos's own clouds: a cap on the summit and a banner streaming from it downwind, banks lying in the gullies of its
//   flanks, and mist in the valleys at its foot in the mornings; thicker in bad weather and early in the day, sometimes
//   clearing. Walking into one you are in a fog (cloudAt, folded into the scene's fog), so the climb goes up through it.
//   Lightning lights them all from within: the flashes' places and strengths come straight from lightning.js.
// Everything here belongs to the world, not to where you stand (the light test): the cumulus and the deck move only with
// the wind, and a cloud wraps round only where it has shrunk into the haze.
import * as THREE from 'three';
import { scene, camera, sun } from '../render/core.js';
import { loadPack, bake } from '../assets.js';
import { mergeGeometries, mergeVertices } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
import { skyDome, lightDir, LIGHT, fogThick } from './sky.js';
import { WIND_U } from './trees.js';
import { WEATHER } from './weather.js';
import { flashP, flashI, LIGHTNING } from './lightning.js';
import { heightAt, PEAK } from './gen.js';
import { SITES } from './sites.js';
import { stormWallDepth, STORM_WALL } from './stormwall.js';
import { clamp, lerp, smooth, seeded } from '../util/math.js';

// ---- Shapes. Each is normalised: centred in x and z, one unit wide, its base at y 0 (its height h is kept on it)
const norm = (g) => {
  g.computeBoundingBox(); const b = g.boundingBox, w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); g.scale(1 / w, 1 / w, 1 / w);
  g.computeBoundingBox(); g.userData.h = g.boundingBox.max.y; return g;
};
// A lumpy low-poly blob, for the scud (a single hull reads cleanly when seen through): an icosphere pushed out in a few
// big swellings, flattened beneath
function blobGeo(seed, flat = 0.3) {
  const r = seeded(seed), g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, v = new THREE.Vector3();
  const bumps = Array.from({ length: 7 }, () => [new THREE.Vector3(r() - 0.5, r() * 0.7, r() - 0.5).normalize(), 0.15 + r() * 0.25]);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const d = v.clone().normalize(); let k = 1;
    for (const [b, a] of bumps) k += a * Math.max(0, d.dot(b)) ** 3;
    v.multiplyScalar(k); v.y = Math.max(v.y, -flat); p.setXYZ(i, v.x, v.y, v.z);
  }
  const out = g.toNonIndexed(); out.computeVertexNormals(); return norm(out);   // (not indexed: a normal per face, faceted)
}
// A heap of overlapping ragged blobs, biggest in the middle, its base cut flat: the cumulus when the packs aren't there,
// and the mountain's banks (long and low: spread). Each blob's corners pushed in or out by a hash of where they are, so
// the blobs stay closed and every facet catches the light a little differently.
function heapGeo(seed, { n = 5, spread = 2.4, depth = 0.6, detail = 1 } = {}) {
  const r = seeded(seed), parts = [], v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) - 0.5 : 0, s = 0.5 + (1 - Math.abs(t) * 1.5) * 0.5 + r() * 0.25, g = new THREE.IcosahedronGeometry(s, detail), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k); const h = Math.sin(v.x * 91.7 + v.y * 47.3 + v.z * 13.1 + i * 7.7) * 43758.5453; v.multiplyScalar(1 + ((h - Math.floor(h)) - 0.5) * 0.22); p.setXYZ(k, v.x, v.y, v.z); }
    g.translate(t * spread + (r() - 0.5) * 0.3, s * (0.35 + r() * 0.25), (r() - 0.5) * depth); g.deleteAttribute('uv'); parts.push(g.index ? g.toNonIndexed() : g);
  }
  const g = mergeGeometries(parts), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.max(p.getY(i), 0));
  g.computeVertexNormals(); return norm(g);
}
// Valley mist: a few flat, ragged discs stacked one over another, each thick in the middle and gone at its rim (fade),
// so from the side it is a soft band lying in the hollow, and from above a pale pool
function mistGeo(seed) {
  const r = seeded(seed), pos = [], fade = [], nrm = [], N = 11;
  [[0, 1, 1], [0.45, 0.85, 0.8], [0.9, 0.6, 0.55]].forEach(([y, rad, f]) => {
    const ring = Array.from({ length: N }, (_, i) => { const a = (i / N) * Math.PI * 2 + (r() - 0.5) * 0.3, k = rad * (0.75 + r() * 0.4); return [Math.cos(a) * k, y + (r() - 0.5) * 0.15, Math.sin(a) * k]; });
    for (let i = 0; i < N; i++) { const a = ring[i], b = ring[(i + 1) % N]; pos.push(0, y + 0.08, 0, ...b, ...a); fade.push(f, 0, 0); nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0); }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('fade', new THREE.Float32BufferAttribute(fade, 1)); return norm(g);
}
// our cumulus (git-ignored with the packs: blender -b -P tools/assets/clouds.py), each with how many there are on the tile,
// how wide (metres), and its dice's floor (the towers only once the sky has filled a little)
const CUMULUS = [
  ['clouds/cumulus-wide-1', 30, 240, 520, 0], ['clouds/cumulus-wide-2', 30, 220, 480, 0], ['clouds/cumulus-wide-3', 26, 260, 560, 0.1], ['clouds/cumulus-long', 26, 300, 640, 0],
  ['clouds/cumulus-tower-1', 8, 320, 560, 0.35], ['clouds/cumulus-tower-2', 10, 280, 520, 0.25],
  ['clouds/cumulus-puff-1', 44, 80, 190, 0], ['clouds/cumulus-puff-2', 44, 70, 170, 0], ['clouds/cumulus-puff-3', 40, 90, 200, 0],
];

// ---- Light. Shared by every cloud material: the uniforms the sky (sky.js) and the lightning (lightning.js) already keep
// are used as they are, so a flash or a fog that greys the dome reaches the clouds in the same frame
const DOME = skyDome.material.uniforms;
const CU = {
  uLightDir: { value: lightDir }, uLit: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() }, uTop: DOME.top, uHor: DOME.hor, uFog: { value: scene.fog.color },
  uFlashP: { value: flashP }, uFlashI: { value: flashI }, uFlashCol: { value: new THREE.Color(0.78, 0.84, 1.0) }, uGlow: { value: 0 }, uHide: { value: 0 }, uFogR: { value: new THREE.Vector2(300, 2400) },
  uStorm: { value: null }, uStormOn: { value: 0 },
};
// ---- Zeus's storm: no cloud of the sky's may stand in its wall, nor show beyond it (the wall is drawn over the frame
// afterwards, so one there shows through it, or is cut off as the wall's own pass comes and goes). How far each place
// lies from the storm, in metres, kept in a texture over the island and its sea (STORM_R either way), made once the
// land is there: what is in the storm (stormWallDepth) spread outward, two passes of a chamfer
const STORM_R = 6400, SN = 129, SF = (2 * STORM_R) / (SN - 1);
function stormMap() {
  const d = new Float32Array(SN * SN), D = SF * Math.SQRT2, pass = (k, n, w) => { if (d[n] + w < d[k]) d[k] = d[n] + w; };
  for (let j = 0; j < SN; j++) for (let i = 0; i < SN; i++) d[j * SN + i] = stormWallDepth(-STORM_R + i * SF, -STORM_R + j * SF) > 0 ? 0 : 1e9;
  for (let j = 0; j < SN; j++) for (let i = 0; i < SN; i++) { const k = j * SN + i; if (i > 0) pass(k, k - 1, SF); if (j > 0) { pass(k, k - SN, SF); if (i > 0) pass(k, k - SN - 1, D); if (i + 1 < SN) pass(k, k - SN + 1, D); } }
  for (let j = SN - 1; j >= 0; j--) for (let i = SN - 1; i >= 0; i--) { const k = j * SN + i; if (i + 1 < SN) pass(k, k + 1, SF); if (j + 1 < SN) { pass(k, k + SN, SF); if (i + 1 < SN) pass(k, k + SN + 1, D); if (i > 0) pass(k, k + SN - 1, D); } }
  const data = new Uint16Array(SN * SN); for (let k = 0; k < SN * SN; k++) data[k] = THREE.DataUtils.toHalfFloat(Math.min(d[k], 6000));
  const t = new THREE.DataTexture(data, SN, SN, THREE.RedFormat, THREE.HalfFloatType); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}
const STORM_GLSL = `uniform sampler2D uStorm; uniform float uStormOn;
  float stormD(vec2 xz) { return texture2D(uStorm, xz / ${(2 * STORM_R).toFixed(1)} + 0.5).r; }
  // a cloud r metres across its middle, at c: gone well clear of the wall, and gone if the wall stands between it and you
  float stormClear(vec2 c, float r) {
    if (uStormOn < 0.5) return 1.0;
    float k = smoothstep(450.0, 750.0, stormD(c) - r);
    for (int i = 1; i < 8; i++) k = min(k, smoothstep(0.0, 250.0, stormD(mix(cameraPosition.xz, c, float(i) / 8.0))));
    return k;
  }`;
const LIGHT_GLSL = `uniform vec3 uLightDir, uLit, uAmb, uTop, uHor, uFog, uFlashCol; uniform vec4 uFlashP[4]; uniform float uFlashI[4], uGlow, uHide; uniform vec2 uFogR;
  // lightning: each flash lights the cloud round it, out to a share of its reach, and the whole sky a little
  vec3 flashAt(vec3 p, float spread) { vec3 c = vec3(0.0); for (int i = 0; i < 4; i++) { if (uFlashI[i] < 0.001) continue;
    float d = distance(p, uFlashP[i].xyz) / (uFlashP[i].w * spread); c += uFlashCol * uFlashI[i] * exp(-d * d); } return c + uFlashCol * uGlow * 0.3; }
  // the sky behind a point (the dome's own gradient), for the haze a far cloud melts into
  vec3 skyAt(vec3 p) { vec3 d = normalize(p - cameraPosition); return mix(uHor, uTop, pow(clamp(d.y, 0.0, 1.0), 0.55)); }
  // a cloud's colour: the sky's light all round (more on top, less in its creases: ao, how open the corner is to the
  // sky), the sun's or moon's wrapped round the side facing it, so the billows turn away softly rather than to black;
  // the shade a little cooler, the flat base in the cloud's own shade; a silver lining round its edge with the sun behind
  vec3 cloudLight(vec3 n, vec3 p, float up, float ao) {
    vec3 V = normalize(p - cameraPosition); float base = mix(0.6, 1.0, smoothstep(0.0, 0.6, up)), o = mix(0.5, 1.0, ao);
    float w = dot(n, uLightDir), l = clamp((w + 0.45) / 1.45, 0.0, 1.0);
    vec3 amb = uAmb * (0.64 + 0.36 * n.y) * o * mix(0.78, 1.0, base);
    vec3 c = mix(amb, amb * vec3(0.86, 0.94, 1.08), clamp(-w, 0.0, 1.0) * 0.7) + uLit * l * l * base * mix(0.7, 1.0, ao);
    c += uLit * pow(max(dot(V, uLightDir), 0.0), 6.0) * (0.15 + 1.2 * pow(1.0 - abs(dot(n, V)), 3.0));   // (lit through towards the sun, brightest at the rim)
    return c + flashAt(p, 1.8);
  }`;
const NOISE_GLSL = `float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }`;

// ---- One instanced kind of cloud: aPos where it is (or, with a tile, where it started, wrapped round the camera as the
// wind carries it), aSize its size in metres, aMisc its turn, its dice (it shows once the cover passes it) and how much
// of it there is (soft ones: set each frame)
// (own: the shape keeps its own proportions, aSize scaling each way; otherwise aSize.y is the height in metres. ring: a
// collar, bent round a contour of RING bearings, uRad (metres from aPos); aSize.x is its tube's half-width and aSize.y
// its height, and aMisc.x turns its billows round it. land: lying on Olympos, in the land's fog; the rest are the sky's,
// and keep out of Zeus's storm)
const RING = 32;
function cloudMat({ soft = false, mist = false, land = false, own = false, ring = false, tint = 1, tile = 0, haze = [1200, 4300] } = {}) {
  const U = { ...CU, uCam: { value: new THREE.Vector3() }, uOff: { value: new THREE.Vector2() }, uTile: { value: tile }, uCover: { value: 1 }, uH: { value: 1 },
    uTint: { value: tint }, uHaze: { value: new THREE.Vector2(...haze) }, uRad: { value: new Array(RING).fill(100) }, uR0: { value: 0.4 }, uRW: { value: 0.05 } };
  const g = soft ? 'mix(0.7, 1.0, k)' : 'k';
  return new THREE.ShaderMaterial({
    uniforms: U, transparent: soft, depthWrite: !soft, fog: false, side: mist ? THREE.DoubleSide : THREE.FrontSide,
    vertexShader: `uniform vec3 uCam; uniform vec2 uOff; uniform float uTile, uCover, uH, uRad[${RING}], uR0, uRW; attribute vec3 aPos, aSize, aAo; attribute vec4 aMisc;${mist ? ' attribute float fade;' : ''}
      varying vec3 vN, vP; varying float vUp, vK, vFade, vAo; ${land ? '' : STORM_GLSL}
      void main() {
        vec3 at = aPos;
        if (uTile > 0.0) { vec2 rel = mod(aPos.xz + uOff - uCam.xz + 0.5 * uTile, uTile) - 0.5 * uTile; at.xz = uCam.xz + rel; }
        // (a cloud grows in as the cover passes its dice, and shrinks away towards the tile's edge, where it wraps)
        float k = smoothstep(aMisc.y, aMisc.y + 0.12, uCover) * aMisc.z;
        if (uTile > 0.0) k *= 1.0 - smoothstep(uTile * 0.38, uTile * 0.47, length(at.xz - uCam.xz));
        ${land ? '' : 'k *= stormClear(at.xz, max(aSize.x, aSize.z) * 0.5);'}
        vK = k; vUp = position.y / uH; vFade = ${mist ? 'fade' : '1.0'}; vAo = aAo.r;
        ${ring ? `// round the contour: each corner's bearing (turned with the billows) finds the contour's radius there, and its
        // place across the tube is laid out from it; the normal follows the stretch each way (across, along, up)
        float r = max(length(position.xz), 1e-4), ang = atan(position.z, position.x) + aMisc.x, t = fract(ang / 6.2831853) * ${RING}.0;
        int i0 = int(floor(t)), i1 = i0 == ${RING - 1} ? 0 : i0 + 1; float Rc = mix(uRad[i0], uRad[i1], fract(t));
        float sr = aSize.x / uRW * ${g}, sy = aSize.y / uH * ${g}, st = Rc / r; vec2 er = vec2(cos(ang), sin(ang)), et = vec2(-er.y, er.x), q = position.xz / r;
        vec3 p = vec3(0.0, position.y * sy, 0.0); p.xz = er * (Rc + (r - uR0) * sr);
        vec3 n = vec3(0.0, normal.y / sy, 0.0); n.xz = er * (dot(normal.xz, q) / sr) + et * (dot(normal.xz, vec2(-q.y, q.x)) / st); vN = normalize(n);` : `
        float c = cos(aMisc.x), s = sin(aMisc.x); mat2 R = mat2(c, s, -s, c);
        vec3 sz = ${own ? 'aSize' : 'vec3(aSize.x, aSize.y / uH, aSize.z)'}, p = position * sz * ${g}; p.xz = R * p.xz;   // (aSize: width, height and depth in metres, whatever the shape's own height; own: a scale each way)
        vec3 n = normal / sz; n.xz = R * n.xz; vN = normalize(n);`}
        vP = at + p; gl_Position = k < 0.001 ? vec4(0.0, 0.0, -2.0, 1.0) : projectionMatrix * viewMatrix * vec4(vP, 1.0);
      }`,
    fragmentShader: `${LIGHT_GLSL} uniform vec2 uHaze; uniform float uTint; varying vec3 vN, vP; varying float vUp, vK, vFade, vAo;
      void main() {
        vec3 n = normalize(vN), c = cloudLight(n, vP, vUp, vAo) * uTint; float dist = distance(vP, cameraPosition);
        c = mix(c, skyAt(vP), max(smoothstep(uHaze.x, uHaze.y, dist), uHide));
        ${land ? `c = mix(c, uFog, smoothstep(uFogR.x, uFogR.y, dist));   // (lying on the land, they're in its fog as the land is)` : ''}
        ${soft ? `// soft: the edges seen side-on thin away, and it fades as you walk into it (the fog takes over: cloudAt)
        float a = vK * ${mist ? 'vFade * 0.6' : 'smoothstep(0.0, 0.5, abs(dot(n, normalize(vP - cameraPosition))))'} * smoothstep(10.0, ${mist ? '45.0' : '110.0'}, dist);   // (mist: soft to its rims, whichever way it's seen)
        if (a < 0.003) discard; gl_FragColor = vec4(c, a);` : 'gl_FragColor = vec4(c, 1.0);'}
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
class Kind {
  constructor(geo, n, mat, place) {
    this.n = n; this.mat = mat; this.a = { aPos: new Float32Array(n * 3), aSize: new Float32Array(n * 3), aMisc: new Float32Array(n * 4) };
    for (let i = 0; i < n; i++) place(i, this.a);
    this.mesh = new THREE.Mesh(this.shape(geo), mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = mat.transparent ? -1 : 0; scene.add(this.mesh);
  }
  shape(geo) {
    const g = new THREE.InstancedBufferGeometry(); g.index = geo.index; for (const k of ['position', 'normal', 'fade']) if (geo.attributes[k]) g.setAttribute(k, geo.attributes[k]);
    g.setAttribute('aAo', geo.attributes.color || new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));   // (how open to the sky, baked: all open without)
    for (const [k, v] of Object.entries(this.a)) g.setAttribute(k, new THREE.InstancedBufferAttribute(v, k === 'aMisc' ? 4 : 3).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = this.n; this.h = this.mat.uniforms.uH.value = geo.userData.h; return g;
  }
  swap(geo) { const old = this.mesh.geometry; this.mesh.geometry = this.shape(geo); old.dispose(); }
  // (the instances kept in the order of their dice, so only those the cover has reached are drawn: a fair sky's few
  // cumulus cost a few, not the whole tile's)
  byDice() {
    const o = [...Array(this.n).keys()].sort((p, q) => this.a.aMisc[p * 4 + 1] - this.a.aMisc[q * 4 + 1]);
    for (const v of Object.values(this.a)) { const w = v.length / this.n, c = v.slice(); o.forEach((j, i) => v.set(c.subarray(j * w, j * w + w), i * w)); }
    this.dirty(); return this;
  }
  cover(c) { let i = 0; while (i < this.n && this.a.aMisc[i * 4 + 1] < c) i++; this.mesh.geometry.instanceCount = i; this.mat.uniforms.uCover.value = c; }
  dirty() { for (const k in this.a) this.mesh.geometry.attributes[k].needsUpdate = true; }
}

// ---- Fair-weather cumulus: each shape its own draw, scattered over a TILE-metre square that wraps round you. Their
// bases lie at about one height, as real cumulus do (where the rising air is cool enough for its damp to cloud)
const TILE = 9000, BASE = 620, cumulus = [], shapes = {};
CUMULUS.forEach(([name, n, w0, w1, floor], v) => {
  const r = seeded(101 + v * 17), K = new Kind(heapGeo(7 + v), n, cloudMat({ tile: TILE, own: true }), (i, a) => {
    const w = w0 + r() ** 1.5 * (w1 - w0);
    a.aPos.set([(r() - 0.5) * TILE, BASE + (r() - 0.5) * 60, (r() - 0.5) * TILE], i * 3); a.aSize.set([w, w * (0.85 + r() * 0.3), w * (0.85 + r() * 0.3)], i * 3);
    a.aMisc.set([r() * 6.28, floor + r() * (0.9 - floor), 1, 0], i * 4);
  }).byDice();
  cumulus.push(K); shapes[name] = loadPack(name).then((gl) => { const g = norm(bake(gl.scene, true)); K.swap(g); return g; });   // (with their baked colours; without the pack files: the heaps)
  shapes[name].catch(() => {});   // (the others that reuse a shape catch on their own)
});
// ---- Out at the horizon, always round you like the sky itself (the tile's own thin out into the haze long before): a few
// great cumulus and towers, and a ring of long, low banks lying along the sea's edge. Each: its bearing, how far, how
// wide, how high its base
const HERO = [
  ['clouds/cumulus-wide-3', [[0.3, 3900, 1300, 560], [1.9, 4300, 1500, 560], [3.4, 3700, 1150, 560], [4.6, 4500, 1600, 560], [5.7, 4100, 1250, 560]]],
  ['clouds/cumulus-tower-1', [[1.1, 4400, 1200, 520], [2.8, 4000, 1000, 520], [5.1, 4600, 1300, 520]]],
  ['clouds/cumulus-long', Array.from({ length: 16 }, (_, i) => { const r = seeded(900 + i); return [(i + r() * 0.6) / 16 * Math.PI * 2, 4600 + r() * 500, 700 + r() * 500, 260 + r() * 120]; })],
];
const heroes = HERO.map(([name, list], v) => {
  const K = new Kind(heapGeo(60 + v), list.length, cloudMat({ own: true, haze: [2000, 7000] }), (i, a) => { const [ang, , w] = list[i]; a.aSize.set([w, w * (v === 2 ? 0.6 : 0.9), w * 0.8], i * 3); a.aMisc.set([ang * 2.3 + (v === 2 ? 0 : 1), (v === 2 ? 0 : 0.1) + ((i * 0.37 + v * 0.21) % 0.5), 1, 0], i * 4); });
  K.list = list; shapes[name].then((g) => K.swap(g)).catch(() => {}); return K;
});

// ---- Scud: ragged low cloud racing along under the storm deck
const SCUD_TILE = 3200, scud = new Kind(blobGeo(31, 0.15), 90, cloudMat({ soft: true, tint: 0.5, tile: SCUD_TILE, haze: [700, 2600] }), (i, a) => {
  const r = seeded(500 + i * 7), w = 80 + r() * 140;
  a.aPos.set([(r() - 0.5) * SCUD_TILE, -50 - r() * 45, (r() - 0.5) * SCUD_TILE], i * 3); a.aSize.set([w * 1.6, w * (0.16 + r() * 0.12), w * 0.7], i * 3);
  a.aMisc.set([0, r() * 0.85, 1, (r() - 0.5) * 0.5], i * 4);
}).byDice();
shapes['clouds/cumulus-long'].then((g) => scud.swap(g)).catch(() => {});   // (ragged shreds of the long, low cumulus, flattened)

// ---- The storm deck: a lattice of CELL-metre squares fixed to the cloud (it moves only with the wind), shifted by whole
// squares to stay round you, so a point of the deck is always the same lump. (Squares of 30 m: from beneath, 200 m up,
// bigger facets read as panes of glass)
const CELL = 30, CELLS = 250, DECK_R = CELL * CELLS * 0.5;
const deckGeo = new THREE.PlaneGeometry(CELL * CELLS, CELL * CELLS, CELLS, CELLS).rotateX(Math.PI / 2);   // (facing down: seen from beneath)
const DU = { ...CU, uOrigin: { value: new THREE.Vector2() }, uOff: { value: new THREE.Vector2() }, uCam: { value: new THREE.Vector3() }, uBase: { value: 220 }, uAmp: { value: 60 },
  uCover: { value: 1 }, uR: { value: DECK_R }, uLo: { value: new THREE.Color() }, uHi: { value: new THREE.Color() }, uHaze: { value: new THREE.Vector2(400, 2500) } };
const deck = new THREE.Mesh(deckGeo, new THREE.ShaderMaterial({
  uniforms: DU, transparent: true, side: THREE.DoubleSide, fog: false,   // (it writes depth: what lies above it, the mountain's clouds, the sun's shafts, is hidden)
  vertexShader: `${NOISE_GLSL} ${STORM_GLSL} uniform vec2 uOrigin, uOff; uniform vec3 uCam; uniform float uBase, uAmp, uCover, uR; varying vec3 vP, vS; varying vec2 vQ; varying float vEdge, vLump;
    // lumps hanging from it at four scales (the smallest finer than a square, so each facet is tilted its own way)
    float lumpAt(vec2 q) { return vn(q * 0.0055) * 0.52 + vn(q * 0.016 + 3.1) * 0.28 + vn(q * 0.043 + 7.7) * 0.14 + vn(q * 0.11 + 1.7) * 0.06; }
    void main() {
      vec2 xz = uOrigin + position.xz, q = xz - uOff;
      // (and, unless it's a full deck, breaks where it thins and lifts)
      float lump = lumpAt(q);
      float hole = vn(q * 0.0014 + 11.3) * 0.65 + vn(q * 0.0047 + 5.1) * 0.35, a = smoothstep(uCover - 0.1, uCover + 0.1, hole);
      // (and it bends down to the horizon, so little sky shows below it)
      float d = length(xz - uCam.xz), y = uBase - pow(lump, 1.3) * uAmp * a + (1.0 - a) * 40.0 - pow(d / uR, 2.0) * 300.0;
      vEdge = (1.0 - smoothstep(uR * 0.8, uR * 0.96, d)) * (uStormOn < 0.5 ? 1.0 : smoothstep(250.0, 600.0, stormD(xz))); vLump = lump; vQ = q;   // (and it stops short of Zeus's wall)
      // the big lumps' own slope, without the small ones: half of each facet's light, so the underside rolls softly
      vec2 e = vec2(12.0, 0.0); float gx = lumpAt(q + e.xy) - lumpAt(q - e.xy), gz = lumpAt(q + e.yx) - lumpAt(q - e.yx);
      vS = normalize(vec3(gx * uAmp * a / 24.0, -1.0, gz * uAmp * a / 24.0));
      vP = vec3(xz.x, y, xz.y); gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0);
    }`,
  fragmentShader: `${LIGHT_GLSL} ${NOISE_GLSL} uniform vec3 uLo, uHi; uniform vec2 uHaze; uniform float uCover; varying vec3 vP, vS; varying vec2 vQ; varying float vEdge, vLump;
    void main() {
      // the breaks drawn per pixel, so their edges are soft rather than cut along the squares
      float hole = vn(vQ * 0.0014 + 11.3) * 0.65 + vn(vQ * 0.0047 + 5.1) * 0.35 + vn(vQ * 0.02) * 0.06 - 0.03, a = smoothstep(uCover - 0.07, uCover + 0.07, hole) * vEdge;
      if (a < 0.01) discard;
      vec3 f = normalize(cross(dFdx(vP), dFdy(vP))); if (f.y > 0.0) f = -f;   // (the facet's own normal, turned down: low poly)
      vec3 n = normalize(mix(f, normalize(vS), 0.5));
      vec3 c; float dist = distance(vP, cameraPosition);
      if (cameraPosition.y < vP.y) {
        // beneath: the hanging lumps darkest and heaviest, the hollows between paler, thin cloud by a break palest; each
        // facet lighter as it turns towards the sun's side of the sky, darker turned away; a soft mottle over it, and the
        // belly overhead darker than the deck far off, which the light reaches through thinner cloud
        float side = dot(n.xz, normalize(uLightDir.xz + 1e-4)), V = normalize(vP - cameraPosition).y;
        float t = 0.5 + (0.5 - vLump) * 1.4 + side * 0.3 + (1.0 - a) * 0.5 + (vn(vQ * 0.006 + 4.4) - 0.5) * 0.25 + (0.45 - V) * 0.3;
        c = mix(uLo, uHi, clamp(t, 0.0, 1.0));
        c += flashAt(vP + vec3(0.0, 60.0, 0.0), 2.4) * 0.7;   // (the flash inside the cloud, lighting it from above the base)
      } else c = cloudLight(-n, vP, 1.0, 1.0);   // (from above, on Olympos: its top, in the sun)
      c = mix(c, uFog, max(smoothstep(uHaze.x, uHaze.y, dist), uHide));
      gl_FragColor = vec4(c, a * (1.0 - uHide));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
deck.frustumCulled = false; deck.renderOrder = -2; deck.visible = false; scene.add(deck);
const deckOff = new THREE.Vector2(), cuOff = new THREE.Vector2(), scudOff = new THREE.Vector2();

// ---- Olympos: laid out once the mountain stands (sites.js), from the land's own shape. Collars of cloud lie round its
// upper slopes one over another, each bent round the mountain's own contour at its height and turning slowly about it: a
// full band low down, a thinner collar over it, a halo just under the summit, and now and then in fair weather a cap
// wrapped round the summit itself (the halo's shape drawn tight); mist lies in the valleys at its foot. Each: its shape,
// its height (a share of the mountain's), its tube's half-width and its height in metres, its dice and which way it turns
const RINGS = [['clouds/olympos-band', 0.5, 72, 78, 0.1, 1], ['clouds/olympos-collar', 0.68, 48, 56, 0.26, -1], ['clouds/olympos-halo', 0.86, 30, 36, 0.02, 1], ['clouds/olympos-halo', 0.97, 34, 34, 0.3, -1]];
const MTN = { rings: [], mist: null, sheets: [], k: 0, cap: 0, capK: 0, mistK: 0 };
const mistMat = cloudMat({ soft: true, mist: true, land: true, tint: 1.05, haze: [900, 3200] });
// (without the pack files: a plain low-poly ring)
const ringGeo = () => { const g = new THREE.TorusGeometry(0.42, 0.05, 6, 48).rotateX(Math.PI / 2).toNonIndexed(); g.deleteAttribute('uv'); g.computeVertexNormals(); return norm(g); };
// the mountain's clouds lit softer than the sky's: each facet's normal turned most of the way to the smooth one round
// it, so the collars roll smoothly in the light while their outline stays faceted (seen near, from the path)
function soften(g, k = 0.45) {
  const m = g.clone(); m.deleteAttribute('normal'); for (const a of Object.keys(m.attributes)) if (a !== 'position') m.deleteAttribute(a);
  const sm = mergeVertices(m, 1e-4); sm.computeVertexNormals(); const sn = sm.toNonIndexed().attributes.normal, n = g.attributes.normal, v = new THREE.Vector3(), w = new THREE.Vector3();
  if (sn.count !== n.count) return g;
  for (let i = 0; i < n.count; i++) { v.fromBufferAttribute(n, i).lerp(w.fromBufferAttribute(sn, i), k).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  return g;
}
// a collar's middle and half-thickness in its own shape, which the shader lays round the contour
function fitRing(K, g) {
  const p = g.attributes.position; let lo = Infinity, hi = 0;
  for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getZ(i)); lo = Math.min(lo, r); hi = Math.max(hi, r); }
  K.mat.uniforms.uR0.value = (lo + hi) / 2; K.mat.uniforms.uRW.value = (hi - lo) / 2;
}
function layMountain() {
  const P = SITES.peak, at = (a, d) => heightAt(P.x + Math.cos(a) * d, P.z + Math.sin(a) * d), r = seeded(4242);
  for (const [name, f, tube, h, seed, spin] of RINGS) {
    // the contour at its height, every RING bearings, smoothed (a collar, not every gully), and out a little, so the
    // tube lies half over the slope and half against it
    const y = PEAK.base + (P.y - PEAK.base) * f, rad = [];
    for (let i = 0; i < RING; i++) { const a = (i / RING) * Math.PI * 2; let d = 8; while (d < PEAK.r * 1.6 && at(a, d) > y) d += 4; rad.push(Math.max(d, 26)); }   // (the cap: drawn in tight round the top)
    for (let n = 0; n < 3; n++) { const c = rad.slice(); for (let i = 0; i < RING; i++) rad[i] = (c[(i + RING - 1) % RING] + c[i] * 2 + c[(i + 1) % RING]) / 4 + (n === 2 ? tube * 0.3 : 0); }
    const mat = cloudMat({ soft: true, land: true, ring: true, haze: [1400, 4200] }); mat.uniforms.uRad.value = rad;
    const g0 = ringGeo(), K = new Kind(g0, 1, mat, () => {}); fitRing(K, g0); K.mesh.position.set(P.x, y, P.z);   // (where three.js sorts it among the see-through things)
    loadPack(name).then((gl) => { const g = soften(norm(bake(gl.scene, true))); K.swap(g); fitRing(K, g); }).catch(() => {});
    MTN.rings.push({ K, y: y - h * 0.4, tube, h, seed, spin, rad, ph: r() * 6.28, vis: 0 });
  }
  // mist in the valleys at its foot: the low ground round it (lower than the land about it), on dry land
  const mist = [];
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2, d = PEAK.r * (0.7 + r() * 0.9), x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d, h = heightAt(x, z);
    if (h < 2) continue; let s = 0; for (let k = 0; k < 8; k++) s += heightAt(x + Math.cos(k * 0.785) * 70, z + Math.sin(k * 0.785) * 70); mist.push({ x, z, h, v: s / 8 - h });
  }
  mist.sort((p, q) => q.v - p.v); const sheets = [];
  for (const m of mist) { if (sheets.length >= 10 || m.v < 3) break; if (sheets.some((s) => Math.hypot(s.x - m.x, s.z - m.z) < 160)) continue;
    const w = 170 + r() * 110; sheets.push({ kind: 'mist', x: m.x, y: m.h + 3, z: m.z, sx: w, sy: 14 + r() * 8, sz: w * (0.6 + r() * 0.3), yaw: r() * 6.28, seed: 0.05 + r() * 0.6, ph: r() * 6.28 }); }
  MTN.sheets = sheets; MTN.mist = new Kind(mistGeo(91), sheets.length, mistMat, () => {});
  mistMat.uniforms.uCover.value = 1;
}
// write the mountain's clouds for this frame: how much of each there is, the collars turning, a slow rise and fall
function placeMountain(time, wd) {
  const P = SITES.peak, put = (K, i, b, x, y, z, yaw, vis) => { K.a.aPos.set([x, y, z], i * 3); K.a.aSize.set([b.sx, b.sy, b.sz], i * 3); K.a.aMisc.set([yaw, 0, vis, 0], i * 4); };
  for (const R of MTN.rings) {
    R.vis = smooth(R.seed, R.seed + 0.2, [MTN.k, MTN.k, MTN.cap, MTN.capK][MTN.rings.indexOf(R)]); R.K.mat.uniforms.uCover.value = 1;
    R.K.a.aPos.set([P.x, R.y + Math.sin(time * 0.03 + R.ph) * 4, P.z], 0); R.K.a.aSize.set([R.tube, R.h, 0], 0); R.K.a.aMisc.set([R.ph + R.spin * time * 0.005, 0, R.vis, 0], 0); R.K.dirty();
  }
  MTN.sheets.forEach((s, i) => { s.vis = smooth(s.seed, s.seed + 0.25, MTN.mistK); put(MTN.mist, i, s, s.x, s.y, s.z, s.yaw + Math.sin(time * 0.01 + s.ph) * 0.1, s.vis); });
  MTN.mist.dirty();
}
// how deep in cloud a point is (0 clear, 1 deep in): the mountain's collars and mist, and the storm deck
const _v = new THREE.Vector3();
function cloudAt(p) {
  let k = 0;
  if (MTN.rings.length) {
    const P = SITES.peak, dx = p.x - P.x, dz = p.z - P.z, t = (((Math.atan2(dz, dx) / (Math.PI * 2)) % 1) + 1) % 1 * RING, i0 = Math.floor(t) % RING, f = t - Math.floor(t), d = Math.hypot(dx, dz);
    for (const R of MTN.rings) {
      if (!(R.vis > 0.01)) continue; const rr = R.rad[i0] * (1 - f) + R.rad[(i0 + 1) % RING] * f;
      k = Math.max(k, R.vis * smooth(1.05, 0.55, Math.hypot((d - rr) / R.tube, (p.y - R.y - R.h * 0.45) / (R.h * 0.55))));
    }
  }
  for (const b of MTN.sheets) {
    if (!(b.vis > 0.01)) continue; _v.set(p.x - b.x, p.y - b.y - b.sy * 0.4, p.z - b.z); const c = Math.cos(-b.yaw), s = Math.sin(-b.yaw), lx = c * _v.x - s * _v.z, lz = s * _v.x + c * _v.z;
    const q = Math.hypot(lx / (b.sx * 0.5), _v.y / (b.sy * 0.6), lz / (b.sz * 0.5)); k = Math.max(k, b.vis * smooth(1.05, 0.55, q));
  }
  if (deck.visible) k = Math.max(k, DECK.k * smooth(70, 15, Math.abs(p.y - DECK.base + DECK.amp * 0.3)));
  return k;
}
const DECK = { k: 0, base: 230, amp: 60 };

// ---- Per frame, after the weather, the storm wall and the lightning, before fogSky (main.js). time: the clock (held
// in screenshot tests), still: the screenshot tests (nothing drifts), dayT: the hour (0..1), dayN: the day.
const _c = new THREE.Color(), _c2 = new THREE.Color(), WARM = new THREE.Color(1.0, 0.62, 0.42);
export function updateClouds(dt, { time = 0, still = false, dayT = 0.3, dayN = 1 } = {}) {
  const W = WEATHER.k, ov = clamp(Math.max(W.overcast, W.rain * 0.9), 0, 1), storm = WEATHER.storm, wd = WIND_U.uWindDir.value, cam = camera.position;
  // how much cloud: a few cumulus on a fair day, crowding in as it clouds over; the deck from a cloudy sky on, whole in
  // heavy rain and storms, and lower the worse it is; scud with the rain
  const cover = 0.4 + ov * 0.7, deckK = smooth(0.45, 0.88, ov), scudK = smooth(0.7, 1.0, ov) * (0.45 + 0.55 * Math.max(storm, W.rain));
  DECK.k = deckK; DECK.base = lerp(330, 215, smooth(0.5, 1, ov)); DECK.amp = lerp(60, 95, Math.max(storm, smooth(0.8, 1, ov) * 0.6));
  // the wind carries them: the deck faster than the fair-weather cumulus, the scud fastest of all
  if (still) { cuOff.set(0, 0); deckOff.set(0, 0); scudOff.set(0, 0); }
  else { const s = Math.max(0.3, WIND_U.uWindStr.value); cuOff.addScaledVector(wd, dt * (5 + ov * 8)); deckOff.addScaledVector(wd, dt * (7 + s * 9)); scudOff.addScaledVector(wd, dt * (16 + s * 22));
    for (const [o, T] of [[cuOff, TILE], [scudOff, SCUD_TILE]]) { o.x %= T; o.y %= T; } }   // (they wrap by whole tiles: kept small, so the GPU's floats stay exact)
  // the light: the sun's (or moon's) own colour and strength, as the sky has set it (a flash already in it), and the sky's
  const day = LIGHT.day;
  CU.uLit.value.copy(sun.color).multiplyScalar(Math.min(3.2, sun.intensity) * 0.36).lerp(_c.copy(sun.color).multiplyScalar(0.5).multiply(WARM), LIGHT.dusk * 0.35);
  CU.uAmb.value.copy(DOME.hor.value).multiplyScalar(0.55).add(_c.copy(DOME.top.value).multiplyScalar(0.25)).add(_c.setScalar(0.03 + day * 0.3)).lerp(_c.copy(scene.fog.color).multiplyScalar(1.1), ov * 0.75);   // (the sky's colour, paled: a cloud's shade is grey-blue, not blue; under a heavy sky the weather's grey)
  CU.uAmb.value.lerp(DOME.hor.value, LIGHT.dusk * 0.35 * (1 - ov));   // (at dawn and dusk the shade takes the glow of the horizon)
  CU.uGlow.value = LIGHTNING.glow;
  for (const m of [mistMat, ...MTN.rings.map((R) => R.K.mat)]) m.uniforms.uTint.value = lerp(1, 0.62, ov);   // (the mountain's clouds as grey as the sky in bad weather)
  // Zeus's storm, once the land is there to find it (and none once it's open)
  if (!CU.uStorm.value) CU.uStorm.value = stormMap();
  CU.uStormOn.value = STORM_WALL.open ? 0 : 1;
  // the deck: a heavy slate beneath, paler where it thins, from the fog's colour (the weather's own grey), near black by night
  DU.uLo.value.copy(scene.fog.color).multiplyScalar(0.22);
  DU.uHi.value.copy(scene.fog.color).multiplyScalar(1.25).lerp(_c2.copy(CU.uLit.value).multiplyScalar(0.6), 0.1 + (1 - deckK) * 0.3);
  // where it melts into the air: in a storm's low fog the deck shows only overhead and fades towards the horizon
  DU.uHaze.value.set(Math.max(500, scene.fog.far * 0.6), Math.max(2600, scene.fog.far * 3.2));
  DU.uOrigin.value.set(deckOff.x + Math.round((cam.x - deckOff.x) / CELL) * CELL, deckOff.y + Math.round((cam.z - deckOff.y) / CELL) * CELL);
  DU.uOff.value.copy(deckOff); DU.uCam.value.copy(cam); DU.uBase.value = DECK.base; DU.uAmp.value = DECK.amp; DU.uCover.value = lerp(1.05, -0.2, deckK);
  deck.visible = deckK > 0.01;
  for (const K of cumulus) { const U = K.mat.uniforms; U.uCam.value.copy(cam); U.uOff.value.copy(cuOff); K.cover(cover); }
  for (const K of heroes) { K.list.forEach(([ang, d, , y], i) => K.a.aPos.set([cam.x + Math.cos(ang) * d, y, cam.z + Math.sin(ang) * d], i * 3)); K.mesh.geometry.attributes.aPos.needsUpdate = true; K.mat.uniforms.uCover.value = cover; }
  const su = scud.mat.uniforms; su.uCam.value.copy(cam); su.uOff.value.copy(scudOff); scud.cover(scudK); scud.mesh.visible = scudK > 0.01;
  // (the scud hangs under the deck, turned along the wind: its height and turn per frame, on the whole kind)
  if (scud.mesh.visible && scud.under !== DECK.base + DECK.amp) { scud.under = DECK.base + DECK.amp; for (let i = 0; i < scud.n; i++) { scud.a.aPos[i * 3 + 1] = DECK.base - DECK.amp * 0.85 - 12 - (i * 37 % 40); } scud.mesh.geometry.attributes.aPos.needsUpdate = true; }
  if (scud.mesh.visible) { const wa = Math.atan2(wd.y, wd.x); for (let i = 0; i < scud.n; i++) scud.a.aMisc[i * 4] = wa + scud.a.aMisc[i * 4 + 3]; scud.mesh.geometry.attributes.aMisc.needsUpdate = true; }
  // Olympos: thicker in bad weather and in the mornings, coming and going over the days; the halo under the summit a
  // little more often; the cap on some fair days; the valley mist with the morning's
  if (!MTN.mist && PEAK.on && SITES.peak) layMountain();
  if (MTN.mist) {
    const morning = dayT < 0.75 ? smooth(0.22, 0.0, dayT) : smooth(0.88, 1, dayT) * 0.6, drift = Math.sin((dayT * 2.7 + dayN * 0.61) * Math.PI * 2) * 0.5 + Math.sin((dayT * 5.3 + dayN * 1.7) * Math.PI * 2) * 0.25;
    MTN.k = clamp(0.12 + ov * 0.75 + morning * 0.4 + drift * 0.35, 0, 1); MTN.cap = clamp(MTN.k + 0.12 + W.fog * 0.2, 0, 1);
    MTN.capK = smooth(0.82, 0.97, 0.5 + 0.5 * Math.sin((dayN * 0.83 + dayT * 1.9) * Math.PI * 2)) * (1 - smooth(0.3, 0.6, ov));
    MTN.mistK = clamp(LIGHT.mist * 0.85 + W.fog * 0.5 + W.rain * 0.25, 0, 1);
    placeMountain(time, wd);
  }
  // walking into a cloud: the fog closes in, pale by day and dark by night (folded into the scene's fog after the
  // weather has set it, so thick enough it hides the sky: fogSky)
  const k = cloudAt(cam);
  if (k > 0.001) {
    const f = scene.fog, far = Math.min(f.far, Math.max(28, f.far * Math.pow(Math.min(1, 28 / f.far), k)));   // (never opening a thicker fog out)
    f.near = Math.min(f.near, lerp(f.near, 0.5, k)); f.far = far;
    f.color.lerp(_c.copy(CU.uAmb.value).multiplyScalar(0.9).add(_c2.copy(CU.uLit.value).multiplyScalar(0.35)), k * 0.85);
  }
  CU.uFogR.value.set(scene.fog.near, scene.fog.far);
  // a fog so thick you see a few tens of metres hides the sky, and the clouds in it (fogSky): fade them with it
  CU.uHide.value = smooth(0.2, 0.6, fogThick());
  const hidden = CU.uHide.value > 0.99; for (const K of [...cumulus, ...heroes]) K.mesh.visible = !hidden; if (hidden) { deck.visible = false; scud.mesh.visible = false; }
  if (MTN.mist) for (const K of [MTN.mist, ...MTN.rings.map((R) => R.K)]) K.mesh.visible = !hidden || k > 0.001;
  return k;
}
// (for the tests and the dev menu: what is drawn)
export const CLOUDS = { deck, cumulus, heroes, scud, MTN, DECK, DU, CU, cloudAt };
