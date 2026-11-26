// Texels on the surfaces (the Greek reviewer, 23 Nov: Valheim's look of low-resolution textures with nearest filtering,
// on the world's surfaces themselves, never as a filter over the picture): the detail a surface lays on in its shader
// (the stone's grain and lichen, the bark's furrows, the planks' grain, the ground's litter) is looked up on a grid of
// texels, each about the detail at its middle (filtered over half its square), so every texel is a flat patch of one
// colour and a crack still shows as a line of darker ones, while the light stays per pixel and smooth (a surface's relief
// and normals are worked out from the unsnapped detail). One uniform for every material that uses it, set by the Pixel
// texture setting (settings.js): texels per metre, 0 for none. Where a texel would come under a couple of pixels on the
// screen the snapping fades out, so the distance doesn't shimmer.
//   pixelSnap(p, k): p (any units) snapped to the middle of its texel, k texels to one unit of p, eased back to p itself
//     as the texels shrink on the screen; k 0 leaves p as it is.
//   pixelTex(map, uv, k): a texture looked up at pixelSnap(uv, k), filtered over the whole texel (its mipmap for a texel
//     that size) and, where the snapping has faded, as usual. k: texels to one unit of uv (uTexel × metres per unit; a
//     vec2 where the texture is stretched, k for each way).
// Every program that includes PIXEL_GLSL takes PIXEL_U among its uniforms.
import * as THREE from 'three';

export const PIXEL = { off: 0, mild: 16, strong: 8 };   // (the setting's choices, texels per metre: at seven, as first tried, a rock's cracks and the bark's furrows were lost in the squares)
export const PIXEL_U = { uTexel: { value: PIXEL.mild } };
export const PIXEL_GLSL = `uniform float uTexel;
  float pixelK(vec2 p, vec2 k) { return k.x <= 0.0 ? 0.0 : 1.0 - smoothstep(0.3, 0.65, max(length(dFdx(p) * k), length(dFdy(p) * k))); }
  vec2 pixelSnap(vec2 p, float k) { float s = pixelK(p, vec2(k)); return s <= 0.0 ? p : mix(p, (floor(p * k) + 0.5) / k, s); }
  vec3 pixelSnap(vec3 p, float k) { if (k <= 0.0) return p; float s = 1.0 - smoothstep(0.3, 0.65, max(max(fwidth(p.x), fwidth(p.y)), fwidth(p.z)) * k); return s <= 0.0 ? p : mix(p, (floor(p * k) + 0.5) / k, s); }
  vec4 pixelTex(sampler2D map, vec2 uv, vec2 k) {
    vec2 dx = dFdx(uv), dy = dFdy(uv); float s = pixelK(uv, k);
    if (s <= 0.0) return textureGrad(map, uv, dx, dy);
    vec2 t = 1.0 / k; return textureGrad(map, mix(uv, (floor(uv * k) + 0.5) * t, s), mix(dx, vec2(t.x * 0.5, 0.0), s), mix(dy, vec2(0.0, t.y * 0.5), s));
  }
  vec4 pixelTex(sampler2D map, vec2 uv, float k) { return pixelTex(map, uv, vec2(k)); }
`;
// (for a texture of its own: nearest when magnified, so each of its texels is a flat square close up)
export const nearestUp = (t) => { if (t) { t.magFilter = THREE.NearestFilter; t.needsUpdate = true; } return t; };

// ---- Texels on everything else (the Greek reviewer, 24 Nov: "if it goes on everything, characters, objects, VFX, foliage,
// ground, it will tie the game together", the trunks the sample of how it should look). Most of the game's models are
// the packs' low-poly ones, one flat colour a face from a palette in their vertices or a small atlas, so a flat colour
// snapped to texels would show nothing: each texel is given a tone of its own instead, lighter or darker and warmer or
// cooler than the face's colour (averaging out to it), over patches a few texels across with darker texels along their
// edges, as a painted low-resolution texture has (as strong as the bark's furrows: under the tone curve a tenth either
// way barely shows). pixelate(material, look) lays it on any standard or basic material (on top of any patch
// it has), one program for every material so made (the look is in its uniforms, not its code):
//   the texels lie on the face of the model's box the face turns to most (worked out per face from the screen
//     derivatives, so a facet is one patch of squares), in metres, in the model's own frame: they stick to what moves (a
//     creature's body in its rest pose, as skinned meshes are before their bones move them, a held tool, a leaf in the
//     wind) and each instance of a model has its own pattern;
//   a texture of the material's own (a painted canvas, a leaf card, a tiling marble) is looked up in texels too, at the
//     texture's size on the model (metres per unit of its uv, from the derivatives of both, as a power of two so a face's
//     triangles agree; each way only where our texel is the bigger), a leaf's outline with it; the tones then follow its
//     texels, one grid. A palette atlas, its faces' uvs gathered on a swatch, has nothing to snap and keeps the tones in
//     the model's frame;
//   the light stays smooth (nothing here touches the normal), and it all fades out where a texel would come under a
//     couple of pixels, and goes with the Pixel texture setting: Off draws the material as it was.
// (look: j how far each texel's tone strays from its neighbours'; b how far the patches' do (three tones, a patch blot
// texels across, longer up the face where it streaks); edge how much darker the texels along a patch's edge are, a
// line a texel wide like a crack or a painted stroke's edge; hue how far a texel leans warm or cool; streak texels run
// together up the face in streaks that long; map 0 leaves the material's own texture smooth, 2 snaps a cut-out's outline too;
// dense: texels to the world's, 2 for small things)
export const PX_LOOK = {
  grain: { j: 0.34, b: 0.4, blot: 4, edge: 0.3, hue: 0.1 },                  // (painted things: pots, plaster, cloth, sacks, the packs' props)
  stone: { j: 0.28, b: 0.4, blot: 5, edge: 0.42, hue: 0.06 },                // (worked stone and the sites' marble: slabs and cracks)
  wood: { j: 0.4, b: 0.3, blot: 3, edge: 0.3, hue: 0.08, streak: 6 },        // (the grain running up a post or along a plank)
  metal: { j: 0.14, b: 0.22, blot: 5, edge: 0.2, hue: 0.04 },
  leaf: { j: 0.4, b: 0.26, blot: 2, edge: 0.3, hue: 0.2, map: 2 },          // (each texel of a crown its own green, some yellower, some bluer)
  plant: { j: 0.45, b: 0.34, blot: 2, edge: 0.3, hue: 0.2 },                 // (the shrubs, ground cover and pickups)
  fur: { j: 0.5, b: 0.2, blot: 3, edge: 0.16, hue: 0.08, streak: 3 },        // (the animals' coats: short streaks of hair)
  hide: { j: 0.34, b: 0.4, blot: 4, edge: 0.4, hue: 0.08 },                  // (the giants and the bosses: a cracked, leathery hide)
  flame: { j: 0.5, b: 0.3, blot: 2, edge: 0, hue: 0.16 },                    // (a fire's flames and embers: flickering squares)
  // (gear: weapons, tools and shields, in the hand or on the ground. Small things, a blade a few centimetres across, so
  // at the hero's density, twice the world's, as his armour is (hero-look.js), and as strong as the bark's furrows: the
  // user, 26 Nov, on the world's own six-centimetre texels, "on the armours, shields and weapons it is not really there")
  gear: { j: 0.46, b: 0.4, blot: 3, edge: 0.36, hue: 0.08, dense: 2 },
};
const PX_VERT = `#include <project_vertex>
  {
    #ifdef USE_INSTANCING
      mat4 pxM = modelMatrix * instanceMatrix; vec2 pxI = floor(pxM[3].xz * 4.0);
      vec3 pxO = fract(vec3(pxI.x * 0.1031, pxI.y * 0.1137, (pxI.x + pxI.y) * 0.1379) * 97.31) * 31.0;   // (each instance its own pattern: from where it stands, so a hit tree's sway doesn't change it)
    #else
      mat4 pxM = modelMatrix; vec3 pxO = vec3(0.0);
    #endif
    vPxP = position * vec3(length(pxM[0].xyz), length(pxM[1].xyz), length(pxM[2].xyz)) + pxO;
  }`;
export const PX_SURF_GLSL = `${PIXEL_GLSL}
  varying vec3 vPxP; uniform vec4 uPxK; uniform vec3 uPxS; uniform float uPxMap;
  #define PX_DENSE uPxS.z
  vec2 pxMapK = vec2(0.0); float pxMapS = 0.0;   // (the texture's texels: how many to a unit of its u and v, and how far they show; 0 none)
  float pxH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float pxV(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(pxH(i), pxH(i + vec2(1.0, 0.0)), f.x), mix(pxH(i + vec2(0.0, 1.0)), pxH(i + vec2(1.0, 1.0)), f.x), f.y); }
  vec3 pxSurface(vec3 c) {
    if (uTexel <= 0.0) return c;
    vec3 a = abs(cross(dFdx(vPxP), dFdy(vPxP)));   // (the face's own facing, flat)
    vec2 q = a.x > a.y && a.x > a.z ? vPxP.zy : a.y > a.z ? vPxP.xz + 0.37 : vPxP.xy + 0.71;
    float s = pixelK(q, vec2(uTexel * PX_DENSE)); vec2 cell = floor(q * uTexel * PX_DENSE);
    #ifdef USE_MAP
      if (pxMapK.x > 0.0) { s = pxMapS; cell = floor(vMapUv * pxMapK); }
    #endif
    if (s <= 0.0) return c;
    cell = mod(cell, 4096.0);
    // (the patches: a noise blot texels across, in three tones, and the texels where the tone changes to the next one's
    // over or beside it darker; each texel its own tone over that, in streaks if the look has them)
    vec2 pk = 1.0 / vec2(uPxK.z, uPxK.z * max(1.0, uPxS.x * 0.5));
    float L = floor(pxV((cell + 0.5) * pk) * 3.0), e = L != floor(pxV((cell + vec2(1.5, 0.5)) * pk) * 3.0) || L != floor(pxV((cell + vec2(0.5, 1.5)) * pk) * 3.0) ? 1.0 : 0.0;
    float j = pxH(uPxS.x > 1.0 ? vec2(cell.x, floor(cell.y / uPxS.x)) : cell) - 0.5, h = pxH(cell + 17.3) - 0.5;
    vec3 t = (1.0 + uPxK.x * j + uPxK.y * (L - 1.0) * 0.5) * (1.0 - uPxS.y * e) / (1.0 - uPxS.y * 0.25) * (1.0 + uPxK.w * h * vec3(1.0, 0.25, -1.0));   // (0.25: about the share of texels on an edge, so the colour keeps its mean)
    return c * mix(vec3(1.0), t, s);
  }
`;
// (the material's texture in texels, for map_fragment: p, a varying of where the fragment lies in metres, for the
// texture's size on the model; it sets pxMapK and pxMapS, which a shader not using pxSurface declares itself)
export const pxMapChunk = (p) => `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  {
    // (metres to a unit of u and of v, from how both change across the screen: [dp/du dp/dv] = [dp/dx dp/dy] J⁻¹; each
    // way as a power of two, so a face's triangles agree, and only where our texel is bigger than the texture's own:
    // a texture stretched along a face, or a palette's swatch, is left smooth the way it has nothing to snap)
    vec2 ux = dFdx(vMapUv), uy = dFdy(vMapUv); vec3 qx = dFdx(${p}), qy = dFdy(${p}); float det = ux.x * uy.y - uy.x * ux.y;
    vec2 kk = vec2(0.0);
    if (abs(det) > 0.05 * length(ux) * length(uy) && uTexel > 0.0 && uPxMap > 0.5) {   // (not where the texture runs along a line on the face, its uv the same one way: nothing to measure)
      vec2 m = vec2(length(qx * uy.y - qy * ux.y), length(qy * ux.x - qx * uy.x)) / abs(det), k = uTexel * PX_DENSE * exp2(floor(log2(m) + 0.5)), ts = vec2(textureSize(map, 0)) * 0.7;
      kk = vec2(k.x < ts.x ? k.x : 0.0, k.y < ts.y ? k.y : 0.0);
    }
    float s = kk.x + kk.y > 0.0 ? 1.0 - smoothstep(0.3, 0.65, max(length(ux * kk), length(uy * kk))) : 0.0;
    if (s > 0.0) {
      vec2 t = 1.0 / max(kk, vec2(1e-6)), c0 = (floor(vMapUv * kk) + 0.5) * t, sn = vec2(kk.x > 0.0 ? c0.x : vMapUv.x, kk.y > 0.0 ? c0.y : vMapUv.y);
      #ifdef USE_ALPHATEST
        // (a cut-out's picture, leaves or grass, is taken at its texel's middle as it is, not averaged over the texel,
        // which would mix in the see-through parts' dark colour; with the look's map 2 its outline too, so a leaf's edge
        // steps texel by texel as a low-resolution texture's does, the steps fixed on the card; with 1 the outline stays
        // smooth, for blades thinner than a texel, which would break up, and a middle in a see-through part keeps the
        // fragment's own colour)
        vec4 c = textureGrad(map, sn, ux, uy);
        if (uPxMap > 1.5) sampledDiffuseColor = mix(sampledDiffuseColor, c, s); else if (c.a >= 0.5) sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, c.rgb, s);
      #else
        vec2 w = vec2(kk.x > 0.0 ? t.x * 0.5 : max(abs(ux.x), abs(uy.x)), kk.y > 0.0 ? t.y * 0.5 : max(abs(ux.y), abs(uy.y)));
        sampledDiffuseColor.rgb = textureGrad(map, mix(vMapUv, sn, s), mix(ux, vec2(w.x, 0.0), s), mix(uy, vec2(0.0, w.y), s)).rgb;
      #endif
      if (kk.x > 0.0 && kk.y > 0.0) { pxMapK = kk; pxMapS = s; }
    }
  }
  diffuseColor *= sampledDiffuseColor;
#endif`;
// (a material with texels of its own, the stone's, the bark's and the planks' and the hero's, is marked by its patch and
// left as it is)
const PX = new WeakMap(), OWN = new WeakSet();
export const ownTexels = (mat) => { OWN.add(mat); return mat; };
export function pixelate(mat, look = 'grain', over = {}) {
  if (PX.has(mat) || OWN.has(mat)) return mat;
  const L = { map: 1, streak: 0, edge: 0, dense: 1, ...PX_LOOK[look], ...over }, base = mat.onBeforeCompile, key = mat.customProgramCacheKey() + '|px';
  const U = { uPxK: { value: new THREE.Vector4(L.j, L.b, L.blot, L.hue) }, uPxS: { value: new THREE.Vector3(L.streak, L.edge, L.dense) }, uPxMap: { value: L.map } };
  mat.onBeforeCompile = (sh, r) => {
    base?.call(mat, sh, r); Object.assign(sh.uniforms, PIXEL_U, U);
    sh.vertexShader = 'varying vec3 vPxP;\n' + sh.vertexShader.replace('#include <project_vertex>', PX_VERT);
    sh.fragmentShader = sh.fragmentShader.replace('#include <uv_pars_fragment>', `#include <uv_pars_fragment>\n${PX_SURF_GLSL}`).replace('#include <map_fragment>', pxMapChunk('vPxP')).replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = pxSurface(diffuseColor.rgb);');
  };
  mat.customProgramCacheKey = () => key;
  PX.set(mat, [look, over, base === THREE.Material.prototype.onBeforeCompile]); return mat;
}
// The look for a material that isn't given one: what glows (flames, embers, sparks, eyes) flickers in squares, metal
// barely, the rest as painted things; null for what has no surface to show (lines, points, sprites, the depth's) or
// none of its own (water, glossy and dark, and what is see-through: a decal, a glyph)
export function autoLook(m) {
  if (!(m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isMeshLambertMaterial)) return null;
  if ((m.transparent && m.blending !== THREE.AdditiveBlending) || (m.isMeshStandardMaterial && m.roughness < 0.2)) return null;
  if (m.isMeshBasicMaterial || m.blending === THREE.AdditiveBlending || (m.emissive && m.emissiveIntensity > 0.5 && m.emissive.getHex() !== 0)) return 'flame';
  return m.metalness >= 0.3 ? 'metal' : 'grain';
}
export const pixelateAuto = (m) => { const l = OWN.has(m) ? null : autoLook(m); return l ? pixelate(m, l) : m; };
// (for merging what looks alike, structures.js: a material whose only patch is this one, and its look; else null)
export const pxPlain = (m) => { const q = PX.get(m); return q && q[2] ? q[0] + JSON.stringify(q[1]) : null; };
// A copy of a material (clones lose their shader patches) given the texels the same way
export const pixelLike = (copy, source) => (PX.has(source) ? pixelate(copy, ...PX.get(source)) : copy);
// A sprite's picture in texels (the fires' smoke: k texels a metre on Mild for a sprite a metre across, so a puff is a
// cloud of squares that grow as it does), one program for every sprite so made
export function pixelSprite(mat, k = 0.75) {
  const base = mat.onBeforeCompile, key = mat.customProgramCacheKey() + '|pxSprite' + k;
  mat.onBeforeCompile = (sh, r) => {
    base?.call(mat, sh, r); Object.assign(sh.uniforms, PIXEL_U);
    sh.fragmentShader = PIXEL_GLSL + sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP\n  diffuseColor *= pixelTex(map, vMapUv, uTexel * ${k.toFixed(3)});\n#endif`);
  };
  mat.customProgramCacheKey = () => key; return mat;
}
// Stand-ins for the warm-up at load (main.js warmUp): the kinds of material in texels that first come into view later
// (a torch's flame and a campfire's, a carved or the packs' tool in hand), so their programs are ready before they're
// needed; kept, so their programs are too
let WARM = null;
export function warmPixel() {
  if (!WARM) {
    const tex = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(0.01, 0.01);
    WARM = [
      pixelate(new THREE.MeshBasicMaterial({ color: 0xff9a30 }), 'flame'),
      pixelate(new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 'flame'),
      pixelate(new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.85 })),
      pixelate(new THREE.MeshStandardMaterial({ color: 0x8f887e, roughness: 0.9, flatShading: true })),
      pixelate(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })),
    ].map((m) => { const o = new THREE.Mesh(geo, m); o.frustumCulled = false; return o; });
  }
  return WARM;
}
