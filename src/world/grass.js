// Grass and wildflowers: a carpet of ~160k swaying blades (and patches of daisies, buttercups, poppies, cornflowers and
// lavender) in a tile that wraps around the player, the "infinite grass" technique. Height, grass amount, tint and
// flower density come from a small ground texture around the player, re-baked by a worker as you travel.
// The grass reaches GRASS_R round the player (tester feedback, 16 Oct: 80 m or more, with the mist lying on its edge):
// past 30 m a second, much wider carpet of fewer, broader blades takes over from the dense one, blade by blade, and
// thins away between GRASS_R and GRASS_END, inside the mist (all in reach.js).
// In Pedias the blades give way to the pack's grass clumps (reviewer, 16 Nov: PolygonNatureBiomes' Meadow clumps, mostly
// the short one, the tall one in the tall patches), drawn the same way: see "The meadow's clumps" below.
import * as THREE from 'three';
import { scene, renderer } from '../render/core.js';
import { windUniform, LIGHT_U, WIND_U } from './trees.js';
import { GRASS_R, GRASS_END } from './reach.js';
import { cutList, onCutsChanged, shapeGround } from './groundcut.js';
import { PRIORITY } from './pool.js';
import { wettable } from './wetness.js';
import { ULTRA } from '../render/quality.js';
import { loadPack, loadTex, bake } from '../assets.js';
import { seeded } from '../util/math.js';

let s0 = 4242; const rand = () => ((s0 = (s0 * 16807) % 2147483647) - 1) / 2147483646, rr = (a, b) => a + rand() * (b - a);
export const GRASS = { mesh: null, far: null, flowers: [], clumps: [], settled: false };   // (settled: the clumps are in, or known not to be: main.js waits for it before compiling the shaders)
export const TEX_N = ULTRA ? 710 : 400, TEX_SIZE = ULTRA ? 440 : 248;      // 0.62 m per texel over 248 m, re-centred when you move 25 m (the far carpet, 95 m out, never runs off it)
// On Ultra (render/quality.js) both carpets reach further at the same density as High's: the dense one out to 48 m
// rather than 37, the sparse one to GRASS_END, 180 m rather than 95, so each takes more blades for its wider tile.
// (DENSE: the near carpet's blades; HAND: where it hands over to the far one; THIN: where its own blades start thinning.)
const NEAR_TILE = ULTRA ? 100 : 76, FAR_TILE = 2 * GRASS_END, AREA = (NEAR_TILE / 76) ** 2, DENSE = Math.round(160000 * AREA), FAR_COUNT = Math.round(100000 * (FAR_TILE / 190) ** 2);
const HAND = ULTRA ? [36, 48] : [26, 37], THIN = ULTRA ? [14, 46] : [10, 34];
const FAR_KEEP = (FAR_COUNT / FAR_TILE ** 2) / (DENSE / NEAR_TILE ** 2);   // how sparse the far carpet is next to the near one
// (Ultra's far carpet thins to half again, each blade wider, from 110 to 140 m: deep in the mist there, a third of its
// blades for nobody to tell apart. [from, to, share kept])
const FAR_THIN = ULTRA ? [110, 140, 0.5] : null;
// Wet, the blades darken to about two thirds (reviewer 20 Nov: in heavy rain the meadow stayed sunny lime), glossy but not
// mirror-like: they face mostly up in the shader, and any more gloss mirrored the sky white
const WET = { dark: 0.65, gloss: 0.7, shine: 0 };
export const grassU = { ...LIGHT_U, ...WIND_U, uWind: windUniform, uCenter: { value: new THREE.Vector2() }, uTile: { value: NEAR_TILE }, uHeight: { value: null },
  uMeadow: { value: null }, uClumps: { value: 0 },   // (how much of Pedias each place is, and whether its clumps are in: the blades give way to them there)
  uOrigin: { value: new THREE.Vector2(-1e6, -1e6) }, uSize: { value: TEX_SIZE },
  uBaseA: { value: new THREE.Color(0x1d3a24) }, uBaseB: { value: new THREE.Color(0x3a4a1e) },
  uTipA: { value: new THREE.Color(0x6f9a40) }, uTipB: { value: new THREE.Color(0xa9a85c) } };   // (tips muted from lime and near-yellow, reviewer 20 Nov: the meadow read as one sea of lime)
// The carpets' blades and clumps are instances of one shape, each placed by its own spot in the tile alone (aOff: x and z,
// eight bytes where a whole matrix took sixty-four, fetched four times over for every vertex for the one column used). A
// mesh of an instanced geometry, with an InstancedMesh's count (settings.js draws a share of them by it).
class Carpet extends THREE.Mesh {
  get count() { return this.geometry.instanceCount; }
  set count(n) { this.geometry.instanceCount = n; }
  get instanceMatrix() { return this.geometry.attributes.aOff; }   // (how many there are, as settings.js asks an InstancedMesh)
  raycast() { /* (nothing to hit: the blades stand where the shader puts them) */ }
}
const carpetGeo = (shape, at) => { const g = new THREE.InstancedBufferGeometry().copy(shape); g.setAttribute('aOff', new THREE.InstancedBufferAttribute(at, 2)); g.instanceCount = at.length / 2; return g; };
// A blade or clump's own facing, a little of it (BLADE_N) mixed into the meadow's upward light, turned to the camera's side:
// lit straight up, as a painted field, no blade was shaded apart from its neighbour; and a two-sided blade seen from its
// back took the upward light turned down, out of the sun (three turns a back face's normal over: undone in the fragment).
const BLADE_N = 0.3, UNFLIP = { from: '#include <normal_fragment_begin>', to: '#include <normal_fragment_begin>\n  normal *= faceDirection; nonPerturbedNormal = normal;   // (the normal was made to face the camera already)' };
// Before anything else is worked out for a blade (two looks into the ground textures, its wind, its light), one that isn't
// drawn here is put out of sight and left: most blades of each carpet aren't, somewhere in its tile (the near one's past
// its hand-over and thinned further out, the far one's inside it and past the grass's edge, both under the meadow's clumps)
const DROP = 'if (fade <= 0.0) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }';
// Nothing grows where the ground texture doesn't reach: just after a jump (a teleport, a respawn) the carpet is round the
// new place a moment before the worker has baked its texture, and the old one, clamped at its edge, stood every blade at the
// old place's height, green streaks across the sky (graphics review, 21 Nov)
const COVERED = '{ vec2 tc = (wp - uOrigin) / uSize; fade *= step(0.0, min(tc.x, tc.y)) * step(max(tc.x, tc.y), 1.0); }';
{
  const H = 0.5, bladeGeo = (segs) => {   // a tapered blade (one bend for the far carpet: nobody sees it bow out there)
    const g = new THREE.PlaneGeometry(0.14, H, 1, segs); g.translate(0, H / 2, 0);
    const bp = g.attributes.position; for (let i = 0; i < bp.count; i++) bp.setX(i, bp.getX(i) * (1 - Math.pow(bp.getY(i) / H, 1.5))); return g; };
  const carpet = (far) => {
    const COUNT = far ? FAR_COUNT : DENSE, T = far ? FAR_TILE : NEAR_TILE, U = { ...grassU, uTile: { value: T } };
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 }); mat.defines = { SUN_SHADOW_CHEAP: '' };   // (one bilinear look into the sun's shadow: the blades are most of the pixels on screen)
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = `uniform float uWind, uTile, uSize, uWindStr, uClumps; uniform vec2 uCenter, uOrigin, uWindDir; uniform sampler2D uHeight, uMeadow; attribute vec2 aOff; varying float vGH, vVar, vShade, vGust, vTall; varying vec3 vWorld;\n` + sh.vertexShader
        .replace('#include <beginnormal_vertex>', `
          vec3 ip = vec3(aOff.x, 0.0, aOff.y);
          vec2 wp = ip.xz + uTile * floor((uCenter - ip.xz) / uTile + 0.5);
          float rnd = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
          // further out fewer blades, each a little wider, so the meadow reads the same with far less to draw (Ghost of
          // Tsushima's trick); a blade seen edge-on is widened so it doesn't thin away to a line. Between 26 and 37 m the
          // near carpet hands over to the far one blade by blade (by count, not by shrinking them), and the far one thins
          // away the same way at the edge of the grass.
          float dc = length(wp - uCenter), hand = smoothstep(${HAND[0].toFixed(1)}, ${HAND[1].toFixed(1)}, dc), r2 = fract(rnd * 91.73), r3 = fract(rnd * 53.17);
          ${far ? `float keep = ${FAR_KEEP.toFixed(4)}${FAR_THIN ? ` * mix(1.0, ${FAR_THIN[2].toFixed(2)}, smoothstep(${FAR_THIN[0].toFixed(1)}, ${FAR_THIN[1].toFixed(1)}, dc))` : ''}, fade = step(r3, hand * (1.0 - smoothstep(${GRASS_R.toFixed(1)}, ${GRASS_END.toFixed(1)}, dc)))${FAR_THIN ? ` * step(r2, keep / ${FAR_KEEP.toFixed(4)})` : ''};`
                : `float keep = mix(1.0, 0.42, smoothstep(${THIN[0].toFixed(1)}, ${THIN[1].toFixed(1)}, dc)), fade = step(r2, keep) * step(r3, 1.0 - hand);`}
          ${COVERED}
          ${DROP}
          ${far ? '' : `fade *= step(texture2D(uMeadow, (wp - uOrigin) / uSize).r * uClumps, fract(rnd * 27.31));   // (in Pedias the clumps grow instead, one for one as the meadow comes in)
          ${DROP}`}
          float a = rnd * 6.2831; vec2 bn = vec2(sin(a), cos(a)), tv = normalize(cameraPosition.xz - wp + 1e-4);
          vec3 objectNormal = normalize(vec3(bn.x, 0.0, bn.y) * (dot(bn, tv) < 0.0 ? -${BLADE_N.toFixed(2)} : ${BLADE_N.toFixed(2)}) + vec3(0.0, ${(1 - BLADE_N).toFixed(2)}, 0.0));`)
        .replace('#include <begin_vertex>', `
          vec4 hm = texture2D(uHeight, (wp - uOrigin) / uSize);
          // the grass amount, and whether it's a tall patch (there it all stands about 0.7x the hero's height, 1.35 m: the
          // amount only says whether a blade grows, not how tall, and the blades barely differ)
          float gg = max(hm.g, 0.0), tl = floor(gg * 0.5) / 7.0, amt = gg - floor(gg * 0.5) * 2.0;
          float sc = fade * mix(amt * (0.55 + rnd * 0.62), step(0.3, amt) * (0.94 + rnd * 0.12) * 2.35, smoothstep(0.0, 0.15, tl));
          sc *= mix(1.0, smoothstep(1.5, 4.0, length(wp - cameraPosition.xz)), smoothstep(0.1, 0.4, tl));   // (tall grass shrinks away round the camera, so you look over it, not into it)
          // (in the woods and the marsh, where the grass is short and thin, a short blade is narrower too and a little lower:
          // shortened alone, it kept its width and read as a fat green cone, row on row of them, reviewer 20 Nov)
          float fk = floor(hm.b * 0.5), wood = fk / 15.0; sc *= 1.0 - wood * 0.15;
          vec3 p = position; p.y *= sc; p.x *= step(0.01, sc) / sqrt(keep) * (1.0 + tl * 0.4) * mix(1.0, clamp(sc * 1.1, 0.45, 1.0), wood); vTall = tl;
          p.x *= 1.0 + (1.0 - abs(dot(bn, tv))) * 0.9;
          p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
          float gh = position.y / ${H.toFixed(2)};
          float gust = sin(uWind * 0.6 + wp.x * 0.05) * 0.5 + 0.5;
          // gusts sweeping across the meadow: bands that bend the grass further and catch the light as they pass
          float wave = smoothstep(0.6, 1.0, sin(dot(wp, uWindDir) * 0.055 - uWind * (1.0 + uWindStr * 1.2)) * 0.5 + 0.5 + (fract(sin(dot(floor(wp / 11.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.25);   // (rolling downwind)
          float bend = gh * gh * min(sc, 1.6) * (0.07 + gust * 0.1) * (1.0 + wave * 1.3) * (1.0 + tl * 0.8);   // (tall grass sways further, but not wildly)
          p.x += sin(uWind * 1.9 + wp.x * 0.35 + wp.y * 0.22) * bend;
          p.z += cos(uWind * 1.5 + wp.y * 0.3) * bend * 0.7;
        // and every blade leans downwind, further in the gusts and the rolling waves (a gentle lean in a breeze, flattened in a storm)
        float lean = gh * gh * min(sc, 1.6) * uWindStr * (0.3 + gust * 0.25 + wave * 0.45) * 0.42; p.xz += uWindDir * lean; p.y -= lean * 0.35;
          vec2 away = wp - uCenter; float pd = length(away), push = (1.0 - smoothstep(0.12, 0.75, pd)) * gh * sc;   // blades part around your legs (in a ring half as wide as it was: reviewer, 16 Nov)
          p.xz += away / max(pd, 0.001) * push * 0.55; p.y *= 1.0 - push * 0.35;
          vec3 transformed = p + vec3(wp.x, hm.r - 0.03, wp.y);
          vGH = gh; vVar = hm.b - fk * 2.0; vShade = wood;
          vVar = clamp(vVar + (fract(sin(dot(floor(wp / 2.7), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.3, 0.0, 1.0);   // colour in clumps
          vGust = wave; vWorld = p + vec3(wp.x, hm.r, wp.y);`);
      // each blade takes the sun's shadow from low on its stem (a quarter of its height up), so the shade of a tree, a rock
      // or the hero lies across the meadow as it would on bare ground, not only on the few blades it happens to cross
      sh.vertexShader = sh.vertexShader.replace('#include <shadowmap_vertex>', `{ vec4 wSaved = worldPosition; worldPosition.y = hm.r + (worldPosition.y - hm.r) * 0.25;
          #include <shadowmap_vertex>
          worldPosition = wSaved; }`);
      sh.fragmentShader = `uniform vec3 uBaseA, uBaseB, uTipA, uTipB, uSunDir, uSunCol; varying float vGH, vVar, vShade, vGust, vTall; varying vec3 vWorld;\n` + sh.fragmentShader
        .replace(UNFLIP.from, UNFLIP.to)
        .replace('#include <tonemapping_fragment>', `gl_FragColor.rgb *= 1.0 + vGust * 0.2 * vGH;   // the gust's lighter band
          float shine = pow(max(dot(normalize(vWorld - cameraPosition), uSunDir), 0.0), 4.0) * vGH * vGH;   // sun through the blade tips
          gl_FragColor.rgb += diffuseColor.rgb * uSunCol * shine * 0.32 / (1.0 + vTall * 2.0);   // (less glow through tall grass: a lot of blade catches the light)
          #include <tonemapping_fragment>`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float v = smoothstep(0.35, 0.7, vVar);
          diffuseColor.rgb = mix(mix(uBaseA, uBaseB, v), mix(uTipA, uTipB, min(1.0, v * 0.8 + vTall * 0.25)), smoothstep(0.0, 1.0, vGH));   // (tall grass ripens golden at the tips)
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.68, 0.6), vShade);   // deep forest and marsh: darker, bluer grass`);
    };
    mat.customProgramCacheKey = () => 'grass' + far;
    wettable(mat, WET);   // (wetness.js)
    const at = new Float32Array(COUNT * 2); for (let i = 0; i < COUNT * 2; i++) at[i] = rr(0, T);
    const grass = new Carpet(carpetGeo(bladeGeo(far ? 1 : 2), at), mat); grass.userData.max = COUNT;
    grass.frustumCulled = false; grass.receiveShadow = true; scene.add(grass); return grass;
  };
  GRASS.mesh = carpet(false); GRASS.far = carpet(true);
  const T = NEAR_TILE;
  // Flowers use the same wrap-around carpet, placed by the flower-density channel of the heightmap
  const flowerCarpet = (geo, count, colors, size) => {
    const fm = new THREE.MeshStandardMaterial({ roughness: 0.7 }); fm.defines = { SUN_SHADOW_CHEAP: '' };
    fm.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, grassU);
      sh.vertexShader = `uniform float uWind, uTile, uSize, uWindStr; uniform vec2 uCenter, uOrigin, uWindDir; uniform sampler2D uHeight;\n` + sh.vertexShader.replace('#include <begin_vertex>', `
        vec3 ip = instanceMatrix[3].xyz;
        vec2 wp = ip.xz + uTile * floor((uCenter - ip.xz) / uTile + 0.5);
        vec4 hm = texture2D(uHeight, (wp - uOrigin) / uSize);
        float rnd = fract(sin(dot(ip.xz, vec2(39.3, 11.7))) * 43758.5453);
        float fade = 1.0 - smoothstep(0.6, 1.0, length(wp - uCenter) / (uTile * 0.5));
        ${COVERED}
        float gg = max(hm.g, 0.0), on = step(rnd, hm.a) * step(0.5, gg - floor(gg * 0.5) * 2.0) * step(gg, 1.99) * fade;   // (the amount, unpacked; none in tall grass)
        vec3 p = position * on * ${size.toFixed(2)} * (0.8 + rnd * 0.5);
        float bend = max(position.y, 0.0) * 0.12;
        p.x += sin(uWind * 1.9 + wp.x * 0.35 + wp.y * 0.22) * bend;
        p.xz += uWindDir * max(position.y, 0.0) * uWindStr * 0.18;   // (nodding downwind)
        vec3 transformed = p + vec3(wp.x, hm.r - 0.03, wp.y) - ip;`);
    };
    const im = new THREE.InstancedMesh(geo, fm, count), mm = new THREE.Matrix4(), cc = new THREE.Color();
    for (let i = 0; i < count; i++) { im.setMatrixAt(i, mm.makeTranslation(rr(0, T), 0, rr(0, T))); im.setColorAt(i, cc.setHex(colors[Math.floor(rand() * colors.length)])); }
    im.frustumCulled = false; im.receiveShadow = true; im.userData.max = count; GRASS.flowers.push(im); scene.add(im); return im;
  };
  const merge = (parts) => {           // tiny manual merge of non-indexed geometries with vertex colours
    const pos = [], nor = [], col = [];
    for (const [g, c] of parts) { const gg = g.index ? g.toNonIndexed() : g; gg.computeVertexNormals(); const cl = new THREE.Color(c);
      pos.push(...gg.attributes.position.array); nor.push(...gg.attributes.normal.array); for (let i = 0; i < gg.attributes.position.count; i++) col.push(cl.r, cl.g, cl.b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
  };
  // Daisy / poppy head: flat petal disc + centre on a stem (instance colour tints the petals)
  // Petal rings: each petal a tapered quad tilted up (cup) around a centre, on a stem with two leaves
  const flower = (petals, len, wid, cup, petalCol, eyeCol, stemH) => {
    const P = [];
    for (let i = 0; i < petals; i++) {
      const g = new THREE.PlaneGeometry(wid, len, 1, 1); g.translate(0, len / 2, 0);
      const a = g.attributes.position; for (let k = 0; k < a.count; k++) if (a.getY(k) < 0.01) a.setX(k, a.getX(k) * 0.3);   // narrow base
      g.rotateX(-Math.PI / 2 + cup); g.rotateY(i / petals * Math.PI * 2); g.translate(0, stemH, 0); P.push([g, petalCol]);
    }
    P.push([new THREE.OctahedronGeometry(len * 0.32, 0).translate(0, stemH + 0.01, 0), eyeCol]);
    P.push([new THREE.CylinderGeometry(0.01, 0.013, stemH, 3).translate(0, stemH / 2, 0), 0x3f6a2a]);
    for (const sgn of [-1, 1]) { const l = new THREE.PlaneGeometry(0.05, 0.14).translate(0, 0.07, 0); l.rotateZ(sgn * 0.9); l.translate(0, stemH * 0.35, 0); P.push([l, 0x4c7a30]); }
    return merge(P);
  };
  const mk = (geo, n, col, size) => { const f = flowerCarpet(geo, n, [col], size); f.material.vertexColors = true; f.material.side = THREE.DoubleSide; return f; };
  mk(flower(10, 0.09, 0.035, 0.35, 0xffffff, 0xe8b830, 0.42), Math.round(3200 * AREA), 0xffffff, 1);        // daisies
  mk(flower(5, 0.08, 0.06, 0.55, 0xffd23a, 0xc98a1a, 0.36), Math.round(2400 * AREA), 0xffffff, 1);          // buttercups
  mk(flower(4, 0.12, 0.11, 0.95, 0xd8322a, 0x201810, 0.5), Math.round(2200 * AREA), 0xffffff, 1.05);       // poppies (cupped)
  mk(flower(8, 0.08, 0.04, 0.4, 0x4f74e0, 0x2a2a60, 0.44), Math.round(1600 * AREA), 0xffffff, 1);          // cornflowers
  // Lavender spikes
  const spikeParts = [[new THREE.CylinderGeometry(0.012, 0.012, 0.55, 3).translate(0, 0.27, 0), 0x3f6a2a]];
  for (let i = 0; i < 6; i++) spikeParts.push([new THREE.OctahedronGeometry(0.045 - i * 0.004, 0).translate(0, 0.42 + i * 0.07, 0), 0xffffff]);
  const f2 = flowerCarpet(merge(spikeParts), Math.round(2600 * AREA), [0x7a5fd0, 0x5b4fc4, 0x9a6ad8], 1.1);
  f2.material.vertexColors = true;
}
// The meadow's clumps: in Pedias the near carpet's blades give way to the pack's clumps (a dozen crossed cards cut out
// of a picture of blades), in a wrap-around carpet like theirs, standing on and coloured by the same ground texture,
// swaying in the same wind, parting round your legs the same way, and handing over to the far carpet's blades as they do.
// Each corner of a card stands on the ground beneath it and folds down where the grass stops (a clearing, a rock, a
// tree's foot), so a clump two metres across drapes over a slope and never reaches into a floor. A short clump is 26
// triangles over two square metres or so, where the blades take about 110 a square metre; but where the meadow meets the
// forest both are drawn, so there are no more of them than the woods' triangle budget leaves room for (the far carpet
// stays blades: past 30 m they read the same, and cost less). Without the pack the blades grow here as everywhere else.
// (D: short and tall clumps a square metre; WIDE: how much wider than the pack's they're drawn, for fewer to cover more)
const CLUMP_D = [1.2, 0.7], WIDE = 1.15;
const clumpCarpet = (geo, map, tall) => {
  const T = NEAR_TILE, COUNT = Math.round(T * T * CLUMP_D[tall ? 1 : 0]), HM = geo.boundingBox.max.y, U = { ...grassU, uTile: { value: T }, uCount: { value: COUNT } }, f = (v) => v.toFixed(4);
  const mat = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: 0.9, alphaTest: 0.5 }); mat.defines = { SUN_SHADOW_CHEAP: '' };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = `uniform float uWind, uTile, uSize, uWindStr, uCount; uniform vec2 uCenter, uOrigin, uWindDir; uniform sampler2D uHeight, uMeadow; attribute vec2 aOff; varying float vGH, vVar, vShade, vGust, vTall; varying vec3 vWorld;\n` + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `
        vec3 ip = vec3(aOff.x, 0.0, aOff.y);
        vec2 wp = ip.xz + uTile * floor((uCenter - ip.xz) / uTile + 0.5);
        float rnd = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453), r2 = fract(rnd * 91.73), r3 = fract(rnd * 53.17) * 0.85, r4 = (float(gl_InstanceID) + 0.5) / uCount;   // (r4 by the clump's place in the list: see showCarpets)
        // thinning further out and handing over to the far carpet clump by clump as the blades do, but each sinking into the
        // ground over a stretch rather than vanishing whole
        float dc = length(wp - uCenter), hand = smoothstep(${HAND[0].toFixed(1)}, ${HAND[1].toFixed(1)}, dc);
        float keep = mix(1.0, 0.6, smoothstep(${THIN[0].toFixed(1)}, ${THIN[1].toFixed(1)}, dc)), fade = step(r2, keep) * smoothstep(r3, r3 + 0.15, 1.0 - hand);
        ${COVERED}
        ${DROP}
        fade *= step(r4, texture2D(uMeadow, (wp - uOrigin) / uSize).r);   // (only in Pedias: where it fades into the next land, clumps give way to blades one for one)
        ${DROP}
        // (lit as the blades are: mostly from above, a little by the card's own facing, turned to the camera's side)
        float a = rnd * 6.2831; vec2 cn = mat2(cos(a), -sin(a), sin(a), cos(a)) * normal.xz, tv = normalize(cameraPosition.xz - wp + 1e-4);
        vec3 objectNormal = normalize(vec3(cn.x, 0.0, cn.y) * (dot(cn, tv) < 0.0 ? -${BLADE_N.toFixed(2)} : ${BLADE_N.toFixed(2)}) + vec3(0.0, ${(1 - BLADE_N).toFixed(2)}, 0.0));`)
      .replace('#include <begin_vertex>', `
        vec4 hm = texture2D(uHeight, (wp - uOrigin) / uSize);
        float gg = max(hm.g, 0.0), tl = floor(gg * 0.5) / 7.0, amt = gg - floor(gg * 0.5) * 2.0;
        ${tall ? `float sc = fade * step(0.3, amt) * step(0.5, tl) * (1.06 + rnd * 0.14) * smoothstep(1.5, 4.0, length(wp - cameraPosition.xz));   // (only in the tall patches, all about as tall as the tall blades; shrinking away round the camera as they do)`
               : `float sc = fade * smoothstep(0.0, 0.3, amt) * (0.75 + rnd * 0.45) * (0.7 + amt * 0.3) * (1.0 + step(0.5, tl) * 0.3);   // (a little taller under the tall clumps, filling in below them)`}
        vec3 p = position * sc; p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz * ${f(WIDE)} / sqrt(keep);
        vec2 vp = wp + p.xz; vec4 hv = texture2D(uHeight, (vp - uOrigin) / uSize);   // this corner's own ground
        float gv = max(hv.g, 0.0), gh = clamp(position.y / ${f(HM)}, 0.0, 1.0), se = min(sc * ${f(HM / 0.5)}, 1.6);   // (se: its height against a blade's)
        p.y *= smoothstep(0.02, 0.25, gv - floor(gv * 0.5) * 2.0);   // (folded down where the grass stops)
        float gust = sin(uWind * 0.6 + vp.x * 0.05) * 0.5 + 0.5;
        float wave = smoothstep(0.6, 1.0, sin(dot(vp, uWindDir) * 0.055 - uWind * (1.0 + uWindStr * 1.2)) * 0.5 + 0.5 + (fract(sin(dot(floor(vp / 11.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.25);
        float bend = gh * gh * se * (0.07 + gust * 0.1) * (1.0 + wave * 1.3) * (1.0 + tl * 0.8);
        p.x += sin(uWind * 1.9 + vp.x * 0.35 + vp.y * 0.22) * bend;
        p.z += cos(uWind * 1.5 + vp.y * 0.3) * bend * 0.7;
        float lean = gh * gh * se * uWindStr * (0.3 + gust * 0.25 + wave * 0.45) * 0.42; p.xz += uWindDir * lean; p.y -= lean * 0.35;
        vec2 away = vp - uCenter; float pd = length(away), push = (1.0 - smoothstep(0.12, 0.75, pd)) * gh * se;   // (parting round your legs, as the blades do)
        p.xz += away / max(pd, 0.001) * push * 0.55; p.y *= 1.0 - push * 0.35;
        vec3 transformed = vec3(wp.x + p.x, hv.r - 0.03 + p.y, wp.y + p.z);
        vGH = gh; float fk = floor(hm.b * 0.5); vVar = hm.b - fk * 2.0; vShade = fk / 15.0; vTall = tl; vGust = wave; vWorld = transformed;
        vVar = clamp(vVar + (fract(sin(dot(floor(wp / 2.7), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.3, 0.0, 1.0);`)
      .replace('#include <shadowmap_vertex>', `{ vec4 wSaved = worldPosition; worldPosition.y = hv.r + (worldPosition.y - hv.r) * 0.25;
        #include <shadowmap_vertex>
        worldPosition = wSaved; }`);   // (the shadow taken from low on the stem, as on the blades)
    // coloured as the blades are (base to tip, the meadow's tints, darker in the woods), the picture giving only the light
    // and shade of its blades; and its cut-out kept as solid in the distance as near (the picture's smaller copies blur
    // the edges into half-seen, which a cut-out drops: the clumps would thin away with distance)
    sh.fragmentShader = `uniform vec3 uBaseA, uBaseB, uTipA, uTipB, uSunDir, uSunCol; varying float vGH, vVar, vShade, vGust, vTall; varying vec3 vWorld;\n` + sh.fragmentShader
      .replace(UNFLIP.from, UNFLIP.to)
      .replace('#include <alphatest_fragment>', `{ vec2 ts = vec2(textureSize(map, 0)), du = dFdx(vMapUv) * ts, dv = dFdy(vMapUv) * ts; diffuseColor.a *= 1.0 + max(0.0, 0.5 * log2(max(dot(du, du), dot(dv, dv)))) * 0.25; }
        #include <alphatest_fragment>`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / 0.14, v = smoothstep(0.35, 0.7, vVar);   // (0.14: the picture's own average)
        diffuseColor.rgb = mix(mix(uBaseA, uBaseB, v), mix(uTipA, uTipB, min(1.0, v * 0.8 + vTall * 0.25)), smoothstep(0.0, 0.7, vGH)) * mix(1.0, lum, 0.4);   // (seen from above, most of a clump is its upper half)
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.68, 0.6), vShade);`)
      .replace('#include <tonemapping_fragment>', `gl_FragColor.rgb *= 1.0 + vGust * 0.2 * vGH;
        float shine = pow(max(dot(normalize(vWorld - cameraPosition), uSunDir), 0.0), 4.0) * vGH * vGH;
        gl_FragColor.rgb += diffuseColor.rgb * uSunCol * shine * 0.32 / (1.0 + vTall * 2.0);
        #include <tonemapping_fragment>`);
  };
  mat.customProgramCacheKey = () => 'grassClump' + tall;
  wettable(mat, WET);
  // spread over the tile on a jittered grid (an even cover from few clumps), in a shuffled order so that drawing fewer
  // (a lower graphics preset) thins them evenly
  const rnd = seeded(313 + (tall ? 1 : 0)), g = Math.ceil(Math.sqrt(COUNT)), k = T / g, at = [];
  for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) at.push([(i + rnd()) * k, (j + rnd()) * k]);
  for (let i = at.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [at[i], at[j]] = [at[j], at[i]]; }
  const im = new Carpet(carpetGeo(geo, new Float32Array(at.slice(0, COUNT).flat())), mat);
  im.frustumCulled = false; im.receiveShadow = true; im.userData = { max: COUNT, U };
  GRASS.clumps.push(im); return im;
};
{
  const tex = (key) => { const t = loadTex(`pack/tex/${key}.webp`); t.flipY = false; return t; };   // (the clumps' own pictures: the export gave them the pack's atlas)
  const geo = (gl) => { const g = bake(gl.scene); g.computeBoundingBox(); return g; };
  Promise.all([loadPack('all/pnb-meadow-forest/sm-env-grass-med-clump-03'), loadPack('all/pnb-meadow-forest/sm-env-grass-tall-clump-02')]).then(([med, tall]) => {
    const mg = geo(med), tg = geo(tall), mt = tex('pnb-meadow-forest-grass-mid-01'), tt = tex('pnb-meadow-forest-grass-01');
    GRASS.mesh.add(clumpCarpet(mg, mt, false), clumpCarpet(tg, tt, true));   // (riding on the blade carpet they stand in for, so hiding it hides them too)
    grassU.uClumps.value = 1; showCarpets();
  }).catch(() => { /* no pack: the blades grow in Pedias too */ }).finally(() => { GRASS.settled = true; });
}
// Deep in the forest the clumps have nothing to draw, out in the meadow the near blades nothing (640k triangles): such
// a carpet isn't drawn at all. The worker finds the least and most of Pedias within the near carpet's reach of the
// texture's middle and some way past it, for the walk till the next one (SPAN_R, metres), so nothing it would draw is
// ever missing. And where the meadow comes in only partly (at most a share of it within reach), only that share of the
// clumps is sent: a clump grows where the meadow is more than its place in the (shuffled) list, so the ones past that
// share would grow nowhere here. The graphics preset draws a share of them all, as of the near blades (settings.js).
const SPAN_R = [HAND[1] + 40]; let meadowSpan = null, share = 1;
export function clumpShare(q) { share = q; showCarpets(); }
function showCarpets() {
  const s = meadowSpan; if (!s || !GRASS.mesh) return;
  GRASS.mesh.material.visible = !grassU.uClumps.value || s[0] < 255;   // (the material: the carpet itself stays, holding its clumps)
  for (const c of GRASS.clumps) { const n = c.userData.max * share; c.userData.U.uCount.value = n; c.count = Math.min(c.userData.max, Math.ceil(n * s[1] / 255) + 1); c.visible = s[1] > 0; }
}
let pending = false, lastX = 1e9, lastZ = 1e9, cur = null;
// Places where grass doesn't grow: under logs, floors, fires and the like. Each is a circle (x, z, r) or a rotated
// rectangle (x, z, hw, hd, rot); they are stamped into the grass channel of the local ground texture.
const clears = new Map();
// What has changed since the texture was last stamped: restamp (all of it: the ground was reshaped under a building) or
// the patches of texels round each clearing that came or went (a pickup taken or come into reach, a stump, a fire). Only
// those patches are stamped again and sent to the card: stamping the whole texture and sending it again (2.5 MB, on Ultra
// 8 MB) came about once a second as you walked, as pickups came into reach and left it.
let restamp = false; const dirty = [];
onCutsChanged.add(() => { restamp = true; });
export function clearGrass(key, shape) { const old = clears.get(key); if (old) mark(old); if (shape) { clears.set(key, shape); mark(shape); } else clears.delete(key); }
// the texels a clearing reaches, in the current texture (as stamp works them out), clipped to it; null if none
function span(c, s, x0r = 0, z0r = 0, x1r = Infinity, z1r = Infinity) {
  const { N, x0, z0 } = c, k = TEX_SIZE / N, r = s.r ?? Math.hypot(s.hw, s.hd);
  const i0 = Math.max(0, x0r, Math.floor((s.x - r - 1 - x0) / k)), i1 = Math.min(N - 1, x1r, Math.ceil((s.x + r + 1 - x0) / k));
  const j0 = Math.max(0, z0r, Math.floor((s.z - r - 1 - z0) / k)), j1 = Math.min(N - 1, z1r, Math.ceil((s.z + r + 1 - z0) / k));
  return i0 <= i1 && j0 <= j1 ? [i0, j0, i1, j1] : null;
}
function mark(s) { if (!cur || restamp) return; const q = span(cur, s); if (q) dirty.push(q); }
// Stamp the clearings and the reshaped ground into the texture, over the rectangle of texels [i0, j0, i1, j1] (all of it
// by default): each texel is the worker's grass with every clearing and cut over it applied, so a patch stamped again
// comes out as the whole would
function stamp(c, R = [0, 0, c.N - 1, c.N - 1]) {
  const { data, N, x0, z0, base } = c, k = TEX_SIZE / N, [I0, J0, I1, J1] = R;
  if (I0 === 0 && J0 === 0 && I1 === N - 1 && J1 === N - 1) data.set(base);   // start from the worker's grass, then cut every clearing into it
  else for (let j = J0; j <= J1; j++) data.set(base.subarray((j * N + I0) * 4, (j * N + I1 + 1) * 4), (j * N + I0) * 4);
  for (const s of clears.values()) {
    const q = span(c, s, I0, J0, I1, J1); if (!q) continue; const [i0, j0, i1, j1] = q;
    const cs = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = x0 + (i + 0.5) * k - s.x, dz = z0 + (j + 0.5) * k - s.z;
      let d;   // distance outside the shape (negative inside)
      if (s.r !== undefined) d = Math.hypot(dx, dz) - s.r;
      else { const u = Math.abs(dx * cs - dz * sn) - s.hw, v = Math.abs(dx * sn + dz * cs) - s.hd; d = Math.max(u, v); }
      const f = Math.min(1, Math.max(0, (d - 0.1) / 0.5)), o = (j * N + i) * 4 + 1;   // none at all inside, fading back in just outside the edge
      const tl = Math.max(0, Math.floor(data[o] / 2) * 2); data[o] = data[o] > 0 ? tl + (data[o] - tl) * f : data[o]; data[o + 2] *= f;   // grass and flowers both (keeping the tallness packed in with the grass)
    }
  }
  // under and around buildings the blades stand on the reshaped ground (the same rule as the terrain shader)
  for (const c2 of cutList()) {
    const r = Math.hypot(c2.hw, c2.hd) + c2.shoulder + 3.5, i0 = Math.max(I0, Math.floor((c2.x - r - x0) / k)), i1 = Math.min(I1, Math.ceil((c2.x + r - x0) / k));
    const j0 = Math.max(J0, Math.floor((c2.z - r - z0) / k)), j1 = Math.min(J1, Math.ceil((c2.z + r - z0) / k));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const o = (j * N + i) * 4; data[o] = shapeGround(base[o], x0 + (i + 0.5) * k, z0 + (j + 0.5) * k, true); }
  }
}
// the changed patches stamped again and sent to the card, each on its own (a few texels round a pickup)
const _at = new THREE.Vector2();
function restampDirty(c) {
  for (const R of dirty.splice(0)) {
    stamp(c, R); const [i0, j0, i1, j1] = R, w = i1 - i0 + 1, h = j1 - j0 + 1, part = new Float32Array(w * h * 4);
    for (let j = 0; j < h; j++) part.set(c.data.subarray(((j0 + j) * c.N + i0) * 4, ((j0 + j) * c.N + i1 + 1) * 4), j * w * 4);
    const src = new THREE.DataTexture(part, w, h, THREE.RGBAFormat, THREE.FloatType); renderer.copyTextureToTexture(_at.set(i0, j0), src, c.tex);
  }
}
export function updateGrass(pool, pos) {
  grassU.uCenter.value.set(pos.x, pos.z);
  if (restamp && cur) { restamp = false; dirty.length = 0; stamp(cur); cur.tex.needsUpdate = true; }
  else if (dirty.length && cur) restampDirty(cur);
  if (pending || Math.hypot(pos.x - lastX, pos.z - lastZ) < 25) return;
  pending = true; const x0 = Math.round(pos.x) - TEX_SIZE / 2, z0 = Math.round(pos.z) - TEX_SIZE / 2;
  pool.post({ type: 'grassTex', N: TEX_N, x0, z0, size: TEX_SIZE, reach: SPAN_R }, PRIORITY.urgent).then((m) => {   // (ahead of everything queued: it's under your feet)
    // (the same texture each time, its data replaced: a new one was made on the card and the old freed, every 25 m)
    const old = grassU.uHeight.value; let t = old;
    if (old?.userData.grass && old.image.width === m.N) t.image.data = m.data;
    else { old?.dispose(); t = new THREE.DataTexture(m.data, m.N, m.N, THREE.RGBAFormat, THREE.FloatType); t.magFilter = t.minFilter = THREE.LinearFilter; t.userData.grass = true; }
    cur = { data: m.data, base: m.base, N: m.N, x0: m.x0, z0: m.z0, tex: t }; dirty.length = 0; restamp = false; stamp(cur); t.needsUpdate = true;
    grassU.uHeight.value = t; grassU.uOrigin.value.set(m.x0, m.z0);
    // and how much of Pedias each place is, where the clumps grow instead of the blades (one byte a texel, the same texture refilled)
    const om = grassU.uMeadow.value; if (om?.image.width === m.N) { om.image.data = m.meadow; om.needsUpdate = true; }
    else { om?.dispose(); const mt = new THREE.DataTexture(m.meadow, m.N, m.N, THREE.RedFormat, THREE.UnsignedByteType); mt.magFilter = mt.minFilter = THREE.LinearFilter; mt.unpackAlignment = 1; mt.needsUpdate = true; grassU.uMeadow.value = mt; }
    meadowSpan = m.span; showCarpets();
    lastX = m.x0 + TEX_SIZE / 2; lastZ = m.z0 + TEX_SIZE / 2; pending = false;
  });
}
