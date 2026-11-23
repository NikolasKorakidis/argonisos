// The distant trees, rocks and ruins as octahedral impostors (graphics review of Nov 2026, item 11; tester, 21 Nov: "the
// very tall trees from far away look like carton paper"). The old ones were one picture of each species painted from
// one side, on a card turned to face you, lit by a single number: the same flat sheet from every side, too dark, and the
// giant trees forty-odd metres of it. Now each species and look is painted at load from a whole dome of directions
// (a hemi-octahedron: N×N views from the horizon to straight overhead), its colour in one atlas and its surface's
// facing and depth in another. A far tree draws the three views nearest to where you look at it from, blended by how
// near each is, each one projected so its parts stay put as the views hand over (Ryan Brucks's impostors), so it turns
// as you walk round it instead of swinging round to face you. It is lit as the near trees are, through the same
// standard material (the sun with its colour and direction, the sky's light from every side, fog, the wet look), from
// the facings painted in, with the shade under its own crown painted into its colour (canopyShade), and on Ultra its
// depth is pushed back into the depth buffer, so it meets the slope it stands on and the air's haze sees a crown, not a
// sheet.
import * as THREE from 'three';
import { renderer } from '../render/core.js';
import { BOOT_GFX } from '../render/quality.js';
import { patchWet } from './wetness.js';
import { LIGHT_U, A2C_FRAG } from './trees.js';

// Views per side of the dome and pixels per view, by the preset the game started with (the atlas is built once, at load).
// The big trees (the giants) get views twice as sharp, rocks and ruins half as sharp and fewer: they are a few pixels
// at the distance impostors begin. (Ultra: impostors begin at 340 m, the giants' at 600 m past their ring in vegetation.js; High at
// 180 m. The atlases are 4096 × 4032 on Ultra, 4096 × 1728 on High, each twice: colour, and facing and depth.)
const Q = { ultra: { n: 12, px: 56 }, high: { n: 8, px: 48 }, medium: { n: 8, px: 36 }, low: { n: 6, px: 28 } }[BOOT_GFX] || { n: 8, px: 48 };
const IMP_DEPTH = BOOT_GFX === 'ultra';   // (the depth pushed back per pixel, Ultra only: it turns off the early depth test for these, and High's woods are at the M4's limit already)
const PAD = 0.94;   // (each view keeps a clear rim, so its neighbours never bleed into it as the atlas shrinks into its mipmaps)
const W = 4096;     // the atlases' width

// The view directions: a point of the square [-1,1]² to a direction on the upper half of the sphere and back. Its edge
// is the horizon, its middle straight up. And each view's own right and up (as three's lookAt makes them).
const DOME = `
vec3 impDir(vec2 e) { vec2 t = vec2(e.x + e.y, e.x - e.y) * 0.5; return normalize(vec3(t.x, 1.0 - abs(t.x) - abs(t.y), t.y)); }
vec2 impOct(vec3 d) { d /= abs(d.x) + abs(d.y) + abs(d.z); return vec2(d.x + d.z, d.x - d.z); }
void impBasis(vec3 d, out vec3 bx, out vec3 by) { vec3 up = abs(d.y) > 0.999 ? vec3(0.0, 0.0, -1.0) : vec3(0.0, 1.0, 0.0); bx = normalize(cross(up, d)); by = cross(d, bx); }
`;

// ---- the bake: every view of one model in one draw (an instance per view, each placed into its square of the atlas)
const BAKE_V = DOME + `uniform vec3 uC; uniform float uR, uN; attribute float shade;
varying vec2 vUv; varying vec3 vNo, vCol; varying float vZ;
void main() {
  vec2 g = vec2(mod(float(gl_InstanceID), uN), floor(float(gl_InstanceID) / uN));
  vec3 d = impDir(g / (uN - 1.0) * 2.0 - 1.0), bx, by; impBasis(d, bx, by);
  vec3 p = (position - uC) / uR;
  vec2 xy = vec2(dot(p, bx), dot(p, by)); vZ = dot(p, d);
  gl_Position = vec4((g + 0.5 + xy * 0.5 * ${PAD}) / uN * 2.0 - 1.0, -vZ, 1.0);
  vUv = uv; vNo = normal;
  #ifdef USE_COLOR
    vCol = color;
  #else
    vCol = vec3(1.0);
  #endif
  vCol *= shade;
}`;
// (colour pass: the material's own colour, its vertex colours and its texture, cut out as the material is; facing pass:
// the model's own facing, turned to whichever side the view sees as three does for two-sided leaves, and how far
// towards the viewer the point lies. Both written as they are where something is drawn and as nothing where nothing is,
// so the mipmaps average only what's there: the impostor divides by the coverage again.)
const BAKE_F = `uniform vec3 uDiffuse; uniform float uAlphaTest, uPass; uniform sampler2D uMap;
varying vec2 vUv; varying vec3 vNo, vCol; varying float vZ;
void main() {
  vec4 c = vec4(uDiffuse * vCol, 1.0);
  #ifdef IMP_MAP
    c *= textureLod(uMap, vUv, 0.0);   // (the texture's own leaves, not its mipmaps: a view is far smaller than the texture, and its blurred alpha fell under the cut-off, thinning the crowns)
  #endif
  if (c.a < uAlphaTest) discard;
  vec3 n = normalize(vNo);
  #ifdef IMP_TWO_SIDED
    n *= gl_FrontFacing ? 1.0 : -1.0;
  #endif
  gl_FragColor = uPass < 0.5 ? vec4(c.rgb, 1.0) : vec4(n * 0.5 + 0.5, vZ * 0.5 + 0.5);
}`;
const bakeMats = new Map();
function bakeMat(mat, geo) {
  const map = mat.map || null, two = mat.side === THREE.DoubleSide, col = !!(mat.vertexColors && geo.attributes.color), key = `${!!map}${two}${col}`;
  let m = bakeMats.get(key);
  if (!m) { m = new THREE.ShaderMaterial({ vertexShader: BAKE_V, fragmentShader: BAKE_F, side: two ? THREE.DoubleSide : THREE.FrontSide, vertexColors: col,
    defines: { ...(map ? { IMP_MAP: 1 } : {}), ...(two ? { IMP_TWO_SIDED: 1 } : {}) },
    uniforms: { uC: { value: new THREE.Vector3() }, uR: { value: 1 }, uN: { value: 8 }, uDiffuse: { value: new THREE.Color() }, uAlphaTest: { value: 0 }, uPass: { value: 0 }, uMap: { value: null } } });
  bakeMats.set(key, m); }
  return m;
}

// ---- the shade under a tree's own crown, for where no shadow map reaches (tester, 21 Nov: from afar the giants' trunks
// stood bright pink in the sun, a palisade of cardboard, where up close they stand in their crowns' shade). Each corner
// of a model is given how open the sky is above it: the leaves and branches standing over it (each face by its area
// seen from above, a see-through leaf card at half), gathered on a grid of columns round it. The tops of the crowns are
// left as they are; a trunk under a crown, and the leaves deep inside it, are darkened about as the shadows would.
// Kept on the geometry as 'shade' (1 open, down to SHADE_MIN), for the far bands' and the impostors' painting.
const SHADE_MIN = 0.32, SG = 10, SH = 24;
export function canopyShade(parts) {
  const all = parts.filter(([g]) => g && !g.attributes.shade && g.attributes.position.count); if (!all.length) return;
  const b = new THREE.Box3(); for (const [g] of all) { g.computeBoundingBox(); b.union(g.boundingBox); }
  const sx = Math.max(b.max.x - b.min.x, b.max.z - b.min.z, 0.5) / SG * 1.0001, sy = Math.max(b.max.y - b.min.y, 0.5) / SH * 1.0001, mass = new Float32Array(SG * SG * SH);
  const cell = (x, z) => Math.min(SG - 1, Math.max(0, Math.floor((x - b.min.x) / sx))) + Math.min(SG - 1, Math.max(0, Math.floor((z - b.min.z) / sx))) * SG;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), n = new THREE.Vector3();
  for (const [g, card] of all) {
    const p = g.attributes.position, ix = g.index?.array, tc = (ix ? ix.length : p.count) / 3, at = (t, k) => (ix ? ix[t * 3 + k] : t * 3 + k);
    for (let t = 0; t < tc; t++) {
      A.fromBufferAttribute(p, at(t, 0)); B.fromBufferAttribute(p, at(t, 1)); C.fromBufferAttribute(p, at(t, 2));
      const area = Math.abs(n.crossVectors(B.clone().sub(A), C.clone().sub(A)).y) * 0.5 * (card ? 0.5 : 1); if (area < 1e-6) continue;
      const cx = (A.x + B.x + C.x) / 3, cy = (A.y + B.y + C.y) / 3, cz = (A.z + B.z + C.z) / 3, h = Math.min(SH - 1, Math.max(0, Math.floor((cy - b.min.y) / sy)));
      mass[cell(cx, cz) * SH + h] += area;
    }
  }
  // (per column, what stands above each height: summed from the top down)
  for (let c = 0; c < SG * SG; c++) for (let h = SH - 2; h >= 0; h--) mass[c * SH + h] += mass[c * SH + h + 1];
  const reach = sx * sx * 9;
  for (const [g] of all) {
    const p = g.attributes.position, out = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), h = Math.floor((y - b.min.y) / sy) + 1, ci = Math.floor((x - b.min.x) / sx), cj = Math.floor((z - b.min.z) / sx); let m = 0;
      if (h < SH) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = ci + di, c = cj + dj; if (a >= 0 && c >= 0 && a < SG && c < SG) m += mass[(a + c * SG) * SH + h]; }
      out[i] = SHADE_MIN + (1 - SHADE_MIN) * Math.exp(-1.3 * m / reach);
    }
    g.setAttribute('shade', new THREE.BufferAttribute(out, 1));
  }
}

const IMP_U = { uImpCol: { value: null }, uImpNrm: { value: null } };
// The atlases and where each model's views lie in them: ATLAS.of(sp, v) → { rect: [u0, v0, du, dv], c: Vector3, R, n }
export const ATLAS = { col: null, nrm: null, entries: [], byKey: new Map(), w: W, h: 0, maps: [] };
// models: [{ key, parts: [[geometry, material]] }]. Each is given its views' square (sizes by how big it is), packed in
// rows into the two atlases, and painted.
export function bakeImpostors(models) {
  for (const md of models) canopyShade(md.parts.map(([g, m]) => [g, !!m.map]));
  const E = models.map((md) => {
    const b = new THREE.Box3(), v = new THREE.Vector3(); for (const [g] of md.parts) { g.computeBoundingBox(); b.union(g.boundingBox); }
    const c = b.getCenter(new THREE.Vector3()); let r2 = 0;
    for (const [g] of md.parts) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) r2 = Math.max(r2, v.fromBufferAttribute(p, i).distanceToSquared(c)); }
    const R = Math.sqrt(r2) * 1.01, n = R < 4 ? Math.min(Q.n, 8) : Q.n, px = Math.round(R > 14 ? Q.px * 2 : R < 4 ? Q.px * 0.5 : Q.px);
    return { ...md, c, R, n, size: n * px };
  });
  // rows, biggest first
  const order = [...E].sort((a, b) => b.size - a.size); let x = 0, y = 0, row = 0;
  for (const e of order) { if (x + e.size > W) { x = 0; y += row; row = 0; } e.x = x; e.y = y; x += e.size; row = Math.max(row, e.size); }
  const H = Math.ceil((y + row) / 4) * 4;
  if (!ATLAS.col || ATLAS.h !== H) {
    ATLAS.col?.dispose(); ATLAS.nrm?.dispose();
    const opt = { minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false };
    ATLAS.col = new THREE.WebGLRenderTarget(W, H, { ...opt, colorSpace: THREE.SRGBColorSpace }); ATLAS.nrm = new THREE.WebGLRenderTarget(W, H, opt); ATLAS.h = H;
  }
  for (const e of E) { e.rect = [e.x / W, e.y / H, e.size / W, e.size / H]; ATLAS.byKey.set(e.key, e); }
  ATLAS.entries = E;
  const prev = { rt: renderer.getRenderTarget(), cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha(), sc: renderer.getScissorTest(), vp: renderer.getViewport(new THREE.Vector4()), ac: renderer.autoClear };
  const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(), maps = new Set();
  renderer.autoClear = false; renderer.setClearColor(0x000000, 0); renderer.setScissorTest(true);
  // (each pass painted into a target of its own with a depth buffer, then copied into the atlas, which keeps none: the
  // two depth buffers, 63 MB each on Ultra, were only ever needed while painting)
  for (const [pass, rt] of [[0, ATLAS.col], [1, ATLAS.nrm]]) {
    const bake = new THREE.WebGLRenderTarget(W, H, { magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: true, colorSpace: rt.texture.colorSpace });
    renderer.setRenderTarget(bake); renderer.setViewport(0, 0, W, H); renderer.setScissor(0, 0, W, H); renderer.clear();
    for (const e of E) {
      renderer.setViewport(e.x, e.y, e.size, e.size); renderer.setScissor(e.x, e.y, e.size, e.size);
      for (const [geo, mat] of e.parts) {
        const g = new THREE.InstancedBufferGeometry(); g.index = geo.index; for (const k of ['position', 'normal', 'uv', 'color', 'shade']) if (geo.attributes[k]) g.setAttribute(k, geo.attributes[k]);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
        g.instanceCount = e.n * e.n;
        const m = bakeMat(mat, geo), u = m.uniforms; if (mat.map) maps.add(mat.map);
        u.uC.value.copy(e.c); u.uR.value = e.R; u.uN.value = e.n; u.uDiffuse.value.copy(mat.color || new THREE.Color(1, 1, 1)); u.uAlphaTest.value = mat.alphaTest || 0; u.uPass.value = pass; u.uMap.value = mat.map || null;
        const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; sc.add(mesh); renderer.render(sc, cam); sc.remove(mesh); g.dispose();
      }
    }
    renderer.setRenderTarget(rt); const gl = renderer.getContext(), from = renderer.properties.get(bake).__webglFramebuffer, to = renderer.properties.get(rt).__webglFramebuffer;
    renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER, from); renderer.state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, to); renderer.setScissorTest(false);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST); renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER, null); renderer.setRenderTarget(null); renderer.setScissorTest(true); bake.dispose();
  }
  // the mipmaps, once each, now that every view is in
  for (const rt of [ATLAS.col, ATLAS.nrm]) { rt.texture.generateMipmaps = true; renderer.setRenderTarget(rt); renderer.render(sc, cam); rt.texture.generateMipmaps = false; }
  renderer.autoClear = prev.ac; renderer.setScissorTest(prev.sc); renderer.setRenderTarget(prev.rt); renderer.setClearColor(prev.cc, prev.ca); renderer.setViewport(prev.vp);
  IMP_U.uImpCol.value = ATLAS.col.texture; IMP_U.uImpNrm.value = ATLAS.nrm.texture;
  ATLAS.maps = [...maps];
}
// whether every texture painted into the atlas had loaded (one still loading is painted again when it has: vegetation.js)
export const atlasComplete = () => ATLAS.maps.every((t) => !t.isTexture || (t.image && (t.image.width || t.image.videoWidth) > 0));

// ---- the impostors themselves: a square facing the camera, wide as the model's ball, painted from the atlas
// Per instance: aImpRect, its views' square in the atlas; aImpC, its middle (in its own frame, unscaled) and the radius
// of its ball; aImpS, its scale, its turn about the vertical, and its views per side. The instance's own matrix holds
// only where it stands, so three's fog and the wet look see the square where it is drawn.
// bandCode (vegetation.js, its bands' cut-offs): { key, uniforms, vert: impBand(xz, ring) (how much of this one the impostor
// draws at the hand-over from the light meshes, 0 to 1; folded away at 0) and impShrink(xz) (its size at the far edge of
// the drawn world), frag: impCut() (the dissolve, pixel by pixel, from vImpKeep) }
export function impostorMaterial(bandCode, depthHint = IMP_DEPTH) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide });   // (two-sided: it always faces you, and costs nothing more)
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, IMP_U, LIGHT_U, bandCode.uniforms);
    patchWet(sh, { dark: 0.86, gloss: 1, shine: 0 });   // (as the leaves: only a little darker, no gloss)
    sh.vertexShader = DOME + bandCode.vert + `attribute vec4 aImpRect, aImpC; attribute vec3 aImpS;
      varying vec4 vImpRect; varying vec3 vImpW, vImpPos, vImpCam, vImpF0, vImpF1, vImpF2; varying vec2 vImpG0, vImpG1, vImpG2; varying float vImpN, vImpR, vImpKeep; varying vec2 vImpRot, vImpPz;\n`
      + sh.vertexShader.replace('#include <begin_vertex>', `
        vec3 org = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float s = aImpS.x * impShrink(org.xz), rc = cos(aImpS.y), rs = sin(aImpS.y), R = aImpC.w * s, N = abs(aImpS.z);
        vec3 cw = org + vec3(aImpC.x * rc + aImpC.z * rs, aImpC.y, -aImpC.x * rs + aImpC.z * rc) * s;
        vec3 toC = cameraPosition - cw, vd = normalize(toC), bx, by; impBasis(vd, bx, by);
        vec3 corner = cw + (bx * position.x + by * position.y) * R * 1.03;   // (a touch over the ball: seen up close in perspective, its outline is a little wider)
        vImpKeep = impBand(org.xz, aImpS.z < 0.0);
        vec3 transformed = (corner - org) * step(0.001, vImpKeep);
        // the view seen from, in the model's own frame (undoing its turn), held to the horizon or above
        vec3 dO = vec3(vd.x * rc - vd.z * rs, max(vd.y, 0.0), vd.x * rs + vd.z * rc); dO = normalize(dO + vec3(0.0, 1e-4, 0.0));
        vec2 gp = clamp((impOct(dO) * 0.5 + 0.5) * (N - 1.0), 0.0, N - 1.0), b = min(floor(gp), vec2(N - 2.0)), f = gp - b;
        // the three views round it, and how much of each (the corners of the square of views it falls in, split by a diagonal)
        if (f.x + f.y < 1.0) { vImpG0 = b; vImpG1 = b + vec2(1.0, 0.0); vImpG2 = b + vec2(0.0, 1.0); vImpW = vec3(1.0 - f.x - f.y, f.x, f.y); }
        else { vImpG0 = b + vec2(1.0); vImpG1 = b + vec2(0.0, 1.0); vImpG2 = b + vec2(1.0, 0.0); vImpW = vec3(f.x + f.y - 1.0, 1.0 - f.x, 1.0 - f.y); }
        vImpF0 = impDir(vImpG0 / (N - 1.0) * 2.0 - 1.0); vImpF1 = impDir(vImpG1 / (N - 1.0) * 2.0 - 1.0); vImpF2 = impDir(vImpG2 / (N - 1.0) * 2.0 - 1.0);
        // this corner and the camera in the model's own frame, in radii from its middle (each view's picture is found
        // where the line from the camera through the pixel meets that view's plane)
        vec3 q = (corner - cw) / R, cc = toC / R; vImpPos = vec3(q.x * rc - q.z * rs, q.y, q.x * rs + q.z * rc); vImpCam = vec3(cc.x * rc - cc.z * rs, cc.y, cc.x * rs + cc.z * rc);
        vImpRect = aImpRect; vImpN = N; vImpR = R; vImpRot = vec2(rc, rs); vImpPz = vec2(projectionMatrix[2][2], projectionMatrix[3][2]);`);
    sh.fragmentShader = DOME + `uniform sampler2D uImpCol, uImpNrm; uniform vec3 uSunDir, uSunCol;
      varying vec4 vImpRect; varying vec3 vImpW, vImpPos, vImpCam, vImpF0, vImpF1, vImpF2; varying vec2 vImpG0, vImpG1, vImpG2; varying float vImpN, vImpR, vImpKeep; varying vec2 vImpRot, vImpPz;
      vec3 impNrm; float impDepth, impLod;
      ${bandCode.frag}
      void impView(vec3 fd, vec2 g, float w, inout vec4 col, inout vec4 nrm) {
        vec3 rd = vImpPos - vImpCam, bx, by; impBasis(fd, bx, by);
        vec3 h = vImpCam + rd * (-dot(vImpCam, fd) / dot(rd, fd));
        vec2 uv = vec2(dot(h, bx), dot(h, by)) * 0.5 * ${PAD} + 0.5;
        if (w <= 0.0 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return;
        vec2 a = vImpRect.xy + (g + uv) / vImpN * vImpRect.zw;
        col += textureLod(uImpCol, a, impLod) * w; nrm += textureLod(uImpNrm, a, impLod) * w;
      }\n` + sh.fragmentShader
      .replace('#include <map_fragment>', `{ vec4 col = vec4(0.0), nrm = vec4(0.0);
          // (the mipmap level from how many of a view's texels this pixel spans, worked out once for the three views; and
          // the leaves' coverage kept up as the views shrink into their mipmaps, where it averages with the gaps between
          // them and would fall under the cut-off: Ben Golus's fix for alpha-tested foliage)
          vec3 dw = fwidth(vImpPos); impLod = max(0.0, log2(max(max(dw.x, dw.y), dw.z) * 0.5 * ${PAD} * vImpRect.z * float(textureSize(uImpCol, 0).x) / vImpN));
          impView(vImpF0, vImpG0, vImpW.x, col, nrm); impView(vImpF1, vImpG1, vImpW.y, col, nrm); impView(vImpF2, vImpG2, vImpW.z, col, nrm);
          float a = max(col.a, 1e-4); diffuseColor.rgb *= col.rgb / a; diffuseColor.a = col.a * (1.0 + impLod * 0.3);
          vec3 n = nrm.rgb / a * 2.0 - 1.0; impDepth = nrm.a / a * 2.0 - 1.0;
          impNrm = normalize(vec3(n.x * vImpRot.x + n.z * vImpRot.y, n.y, -n.x * vImpRot.y + n.z * vImpRot.x) + 1e-5);
          impCut(); }`)
      .replace('#include <alphatest_fragment>', A2C_FRAG)
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(impNrm, 0.0)).xyz);')
      // leaves glow where the sun shines through them, as the near ones do (trees.js leafMat; the leaves told from the bark by their green)
      .replace('#include <tonemapping_fragment>', `{ float shine = pow(max(dot(normalize(vWetP - cameraPosition), uSunDir), 0.0), 3.0), leaf = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 12.0, 0.0, 1.0);
          gl_FragColor.rgb += diffuseColor.rgb * uSunCol * shine * 0.55 * leaf; }
        #include <tonemapping_fragment>`);
    if (depthHint) sh.fragmentShader = sh.fragmentShader
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        { vec3 p = -vViewPosition; p *= 1.0 - clamp(impDepth * vImpR / length(p), -0.5, 0.5); gl_FragDepth = clamp((vImpPz.x * p.z + vImpPz.y) / -p.z * 0.5 + 0.5, 0.0, 1.0); }`);
  };
  m.customProgramCacheKey = () => 'vegImpostor|' + bandCode.key + (depthHint ? '|d' : '');
  return m;
}
// The square the impostors are drawn on ([-1,1]², facing +z)
export const IMP_QUAD = new THREE.PlaneGeometry(2, 2);
