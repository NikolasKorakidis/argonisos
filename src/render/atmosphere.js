// The air, painted after the scene from its depth: morning mist that lies in the low ground and thins with height (heavy
// at first light, burning off as the day warms), a haze that glows towards the sun when you look into the light, and
// shafts of sun breaking past trees, trunks and ridges (rays marched towards the sun on the screen, lit wherever the
// sky shows through). All in linear light, before bloom and tone mapping.
// Under the trees (the light study, docs/plans/light-study.md): a low haze in the woods, lit by shafts of sun that slant
// down between the crowns (marched through the sun's shadow map, so every gap in the leaves throws its own ray), thicker
// in the morning and evening than at noon, blue under the moon; and flecks of sun on the forest floor.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from '../../vendor/three/jsm/postprocessing/Pass.js';
import { MIST_R0, MIST_R1 } from '../world/reach.js';
import { WET_U, SHELTER } from '../world/wetness.js';

export const ATMO = {
  tDiffuse: { value: null }, tDepth: { value: null },
  projInv: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() },
  sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 0.9, 0.7) }, sunUV: { value: new THREE.Vector2(0.5, 0.5) }, sunVis: { value: 0 },
  mistCol: { value: new THREE.Color(0.7, 0.75, 0.8) }, mistAmt: { value: 0 }, mistBase: { value: 0 }, mistH: { value: 14 }, mistDen: { value: 0.012 },
  hazeCol: { value: new THREE.Color(1, 0.75, 0.5) }, hazeAmt: { value: 0 }, rayAmt: { value: 0.5 }, rays: { value: 1 },
  vigOffset: { value: 0.95 }, vigDark: { value: 1.15 },
  // a soft blur on what lies far off, so the end of the view melts into the haze instead of ending in a sharp line
  texel: { value: new THREE.Vector2(1 / 1280, 1 / 720) }, blurNear: { value: 600 }, blurFar: { value: 1100 }, blurAmt: { value: 1 },
  // the focus (tester feedback, 15 Oct): sharp round the crosshair, softening toward the edges of the screen, so the
  // cheaper detail at the edges of your view isn't noticed (focus: the blur radius in pixels at the screen's edge)
  focus: { value: 3 }, aspect: { value: 16 / 9 },
  // the player's mist (tester feedback, 15 and 16 Oct): clear for MIST_R0 round the hero, thickening to mzAmt by MIST_R1
  // (hiding about two thirds of what lies behind) and staying there, half grown where the grass ends (GRASS_R); up to a
  // ceiling (mzTop) a little over the tallest thing standing near, above which the sky stays clear. It hides how much
  // less is drawn out there (see vegetation.js).
  mzC: { value: new THREE.Vector2() }, mzR0: { value: MIST_R0 }, mzR1: { value: MIST_R1 }, mzAmt: { value: 0.68 }, mzTop: { value: 30 }, mzSoft: { value: 10 }, mzCol: { value: new THREE.Color(0.7, 0.75, 0.8) },
  // the grade (white balance, saturation, a tint in the shadows) and the cloud shadows drifting over the land
  gTint: { value: new THREE.Color(1, 1, 1) }, gSat: { value: 1 }, gShadow: { value: new THREE.Color(0, 0, 0) },
  cloudOff: { value: new THREE.Vector2() }, cloudCover: { value: 0.4 }, cloudK: { value: 0 },
  // the woods' light: the shadow map and where it lies (set from the shadow-casting light as the pass renders), the light's
  // direction and colour, how much haze (woodK: by the hour; the crowns overhead decide where), its colour where no shaft
  // lights it, the ground under the player (the haze lies low), and how strong the flecks of sun on the floor are
  tShadow: { value: null }, shadowMat: { value: new THREE.Matrix4() }, lightDir: { value: new THREE.Vector3(0, 1, 0) }, lightCol: { value: new THREE.Color() },
  woodK: { value: 0 }, woodAmb: { value: new THREE.Color() }, woodFoot: { value: new THREE.Vector3() }, fleckK: { value: 0 },
  uCanopy: WET_U.uCanopy, uShelter: WET_U.uShelter, uShelterBox: WET_U.uShelterBox, uShelterNF: WET_U.uShelterNF,
  // the haze as marched at half resolution (its light, and how much of the scene shows through), the size of one of its
  // texels, and the camera's near and far (to tell, as it's spread back over the screen, which of it lies at what depth)
  tHaze: { value: null }, hTexel: { value: new THREE.Vector2(1 / 640, 1 / 360) }, camNF: { value: new THREE.Vector2(0.15, 6000) },
  // a little moonlit blue lifted into the darkest parts of the picture by night (more in the woods), so the dark stays readable
  nightLift: { value: new THREE.Color(0, 0, 0) },
};
const SAMPLES = 32, WOOD_STEPS = 14, WOOD_LEN = 38;   // (the haze is marched to 38 m: inside the 80 m shadow box round the player)
// (how deep in the woods the player stands, once per corner of the screen: the share of 13 spots within 12 m of them
// with a tree's crown standing well over their head, from the canopy map)
const WOODS_VERT = `${SHELTER} uniform float woodK; uniform vec3 woodFoot; varying vec2 vUv; varying float vWoods;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          float n = step(woodFoot.y + 3.0, coverTop(uCanopy, woodFoot.xz));
          if (woodK > 0.001) for (int i = 0; i < 12; i++) { float a = float(i) * 1.0472 + (i < 6 ? 0.0 : 0.5236); vec2 q = woodFoot.xz + vec2(cos(a), sin(a)) * (i < 6 ? 6.0 : 12.0);
            n += step(woodFoot.y + 3.0, coverTop(uCanopy, q)); }
          vWoods = smoothstep(0.12, 0.55, n / 13.0); }`;
// what both passes need to know about where a pixel lies and what the light reaches
const LIGHT_PARS = `${SHELTER} uniform sampler2D tDepth, tShadow; uniform mat4 projInv, camWorld, shadowMat; uniform vec3 camPos, lightDir, lightCol, woodAmb, woodFoot;
  uniform float woodK; varying float vWoods; varying vec2 vUv;
  vec3 worldAt(vec2 uv, float d) { vec4 v = projInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); v /= v.w; return (camWorld * v).xyz; }
  // 1 where the light reaches a point (nothing between it and the sun or moon in the shadow map), 0 in shade
  float sunLit(vec3 p) { vec4 s = shadowMat * vec4(p, 1.0); s.xyz /= s.w;
    if (s.x < 0.0 || s.y < 0.0 || s.x > 1.0 || s.y > 1.0 || s.z > 1.0) return 1.0;
    return step(s.z - 0.0015, dot(texture2D(tShadow, s.xy), vec4(255.0 / 256.0) / vec4(16777216.0, 65536.0, 256.0, 1.0))); }
  // the crowns' shade, from the canopy map: follow the light up from p, and if a crown stands over the way at 3, 9 or
  // 18 m up, the light doesn't reach it (seen from above the map knows only the crowns' tops, which is enough)
  float crownLit(vec3 p) { vec2 sl = lightDir.xz / max(lightDir.y, 0.2);
    return smoothstep(-1.0, 1.0, p.y + 3.0 - coverTop(uCanopy, p.xz + sl * 3.0)) * smoothstep(-1.5, 1.5, p.y + 9.0 - coverTop(uCanopy, p.xz + sl * 9.0)) * smoothstep(-2.0, 2.0, p.y + 18.0 - coverTop(uCanopy, p.xz + sl * 18.0)); }
`;
// The woods' haze, at half resolution: marched from the eye through the shadow map, lying low over the ground and thicker
// where crowns stand overhead; lit where the sun gets through (a shaft), dim where it doesn't. Each pixel starts its march
// at a different spot (a fixed pattern, so a still picture stays still), which the main pass smooths away as it spreads the
// haze back over the screen. Out: the light gathered (rgb) and how much of the scene shows through (a).
const HAZE_FRAG = `${LIGHT_PARS}
  void main() {
    if (vWoods <= 0.01) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    float d = texture2D(tDepth, vUv).x; vec3 P = worldAt(vUv, min(d, 0.9999)); float dist = length(P - camPos);
    float L = min(dist, ${WOOD_LEN}.0), st = L / ${WOOD_STEPS}.0, j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    vec3 rd0 = (P - camPos) / max(dist, 1e-3); float od = 0.0, lit = 0.0, amb = 0.0, mu = dot(rd0, lightDir);
    for (int i = 0; i < ${WOOD_STEPS}; i++) { vec3 s = camPos + rd0 * (float(i) + j) * st;
      float den = woodK * vWoods * exp(-max(s.y - woodFoot.y, 0.0) / 6.0) * (0.45 + 0.55 * smoothstep(s.y + 1.0, s.y + 4.0, coverTop(uCanopy, s.xz)));
      float tr = exp(-od), dd = den * st; lit += tr * dd * sunLit(s) * crownLit(s); amb += tr * dd; od += dd; }
    // (the light scatters mostly forward: the shafts blaze when you look towards the sun, and still show across it)
    float ph = 0.5 + 3.0 * pow(max(mu, 0.0), 8.0) + 1.0 * pow(max(mu, 0.0), 2.0);
    gl_FragColor = vec4(lightCol * lit * ph * 0.9 + woodAmb * amb * 0.4, exp(-od));
  }`;
// (until the first shadow map is drawn: a texel at the far plane, so everything reads as lit)
const LIT = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); LIT.needsUpdate = true; ATMO.tShadow.value = LIT;
export class AtmospherePass extends Pass {
  constructor() {
    super();
    this.material = new THREE.ShaderMaterial({
      uniforms: ATMO, depthTest: false, depthWrite: false,
      // (how deep in the woods the player stands, once per corner of the screen: the share of 13 spots within 12 m of them
      // with a tree's crown standing well over their head, from the canopy map)
      vertexShader: WOODS_VERT,
      fragmentShader: `${LIGHT_PARS} uniform sampler2D tDiffuse, tHaze; uniform vec3 sunDir, sunCol, mistCol, hazeCol, mzCol, nightLift; uniform vec2 hTexel, camNF;
        uniform float fleckK;
        uniform vec2 sunUV, cloudOff, texel, mzC; uniform float blurNear, blurFar, blurAmt, focus, aspect, mzR0, mzR1, mzAmt, mzTop, mzSoft, sunVis, mistAmt, mistBase, mistH, mistDen, hazeAmt, rayAmt, rays, vigOffset, vigDark, gSat, cloudCover, cloudK;
        uniform vec3 gTint, gShadow;
        float h12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
        // the same, softened: two looks side by side across the light, further apart the higher the crown (a crown's shade
        // blurs with the distance it falls), so the pools of sun on the floor have soft edges
        float crownLitSoft(vec3 p) { vec2 sl = lightDir.xz / max(lightDir.y, 0.2), side = normalize(vec2(-lightDir.z, lightDir.x) + 1e-4); float k = 0.0;
          for (int i = 0; i < 2; i++) { vec2 o = side * (float(i) * 2.0 - 1.0);
            k += smoothstep(-1.0, 1.0, p.y + 3.0 - coverTop(uCanopy, p.xz + sl * 3.0 + o * 0.35)) * smoothstep(-1.5, 1.5, p.y + 9.0 - coverTop(uCanopy, p.xz + sl * 9.0 + o * 0.7)) * smoothstep(-2.0, 2.0, p.y + 18.0 - coverTop(uCanopy, p.xz + sl * 18.0 + o * 1.2)); }
          return k * 0.5; }
        // the woods' haze spread back over the screen: nine looks round the pixel in the half-sized haze, each counted as
        // much as it lies at the same depth (so a trunk's edge keeps its own haze, not the air's behind it); their varied
        // starting spots average out into a smooth veil
        float linD(float d) { return camNF.x * camNF.y / (camNF.y - d * (camNF.y - camNF.x)); }
        vec4 hazeAt(vec2 uv, float d0) { float z0 = min(linD(d0), ${WOOD_LEN + 4}.0); vec4 acc = vec4(0.0); float tot = 0.0;
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 q = uv + vec2(float(x), float(y)) * hTexel;
            float z = min(linD(texture2D(tDepth, q).x), ${WOOD_LEN + 4}.0), w = (x == 0 && y == 0 ? 2.0 : abs(float(x * y)) > 0.0 ? 0.7 : 1.0) / (1.0 + abs(z - z0) * 4.0 / (0.08 * z0 + 0.25));
            acc += texture2D(tHaze, q) * w; tot += w; }
          return acc / tot; }
        void main() {
          vec4 col = texture2D(tDiffuse, vUv); float d = texture2D(tDepth, vUv).x;
          // the blur: the focus (growing from the crosshair toward the edges of the screen) and, far off, a little more
          // with distance; eight taps round a ring that widens with both
          float bk = focus * smoothstep(0.15, 0.85, length((vUv - 0.5) * vec2(aspect, 1.0)));
          vec3 P = worldAt(vUv, min(d, 0.9999)); float dist = length(P - camPos);
          if (d < 0.99999) bk = max(bk, 2.4 * blurAmt * smoothstep(blurNear, blurFar, dist));
          if (bk > 0.05) { vec3 acc = col.rgb; float n = 1.0; for (int i = 0; i < 8; i++) { float a = float(i) * 0.7854 + 0.39; acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * texel * bk).rgb; n += 1.0; }
            if (bk > 1.5) for (int i = 0; i < 6; i++) { float a = float(i) * 1.0472; acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * texel * bk * 0.5).rgb; n += 1.0; }   // (an inner ring for the wider blur, so it stays smooth)
            col.rgb = acc / n; }
          if (d < 0.99999) {
            vec3 V = P - camPos; vec3 vd = V / max(dist, 1e-3);
            float toSun = max(dot(vd, sunDir), 0.0);
            // cloud shadows: soft patches of shade drifting across the land with the wind
            if (cloudK > 0.001) { vec2 q = (P.xz + cloudOff) * 0.0035; float n = vn(q) * 0.65 + vn(q * 2.3 + 7.1) * 0.35;
              col.rgb *= 1.0 - cloudK * smoothstep(cloudCover, cloudCover + 0.18, n); }
            // the crowns' shade and flecks of sun on the forest floor: the shadow map holds only the trees' light stand-ins,
            // so the crowns' own shade is read from the canopy map (what the light passes under on its way down). Under
            // it the floor dims; where the light gets through it glows a little warmer, so the floor reads as pools of sun
            // and shade; and through the leaves' little holes (a pattern fixed in the light's own space, so it lies still
            // on everything) small coins of light fall even into the shade.
            if (fleckK > 0.001 && vWoods > 0.01 && dist < 40.0) {
              float fade = fleckK * vWoods * (1.0 - smoothstep(26.0, 40.0, dist)), sm = sunLit(P + lightDir * 0.12), cr = crownLitSoft(P);
              vec4 sc = shadowMat * vec4(P, 1.0); vec2 lq = sc.xy / sc.w * 100.0;
              float coins = smoothstep(0.7, 0.84, vn(lq) * 0.6 + vn(lq * 2.7 + 3.1) * 0.4) * (1.0 - cr), lit = sm * max(cr, coins);
              col.rgb *= mix(1.0, 0.42, sm * (1.0 - max(cr, coins)) * fade);
              col.rgb *= 1.0 + lit * fade * 0.3 * normalize(lightCol + 1e-4) * 1.7;
            }
            // mist: density falling off with height above the valley floor, averaged along the ray from the camera's height
            // to the point's (the exact integral of an exponential), so it pools in hollows and thins up on the hills
            float h0 = max(camPos.y - mistBase, 0.0), h1 = max(P.y - mistBase, 0.0), dh = h1 - h0;
            float avg = abs(dh) < 0.05 ? exp(-h0 / mistH) : mistH * (exp(-h0 / mistH) - exp(-h1 / mistH)) / dh;
            float mist = (1.0 - exp(-mistDen * avg * dist)) * mistAmt;
            col.rgb = mix(col.rgb, mistCol + sunCol * pow(toSun, 6.0) * 0.5, clamp(mist, 0.0, 0.92));
            // haze glowing towards the sun, deeper with distance
            col.rgb += hazeCol * pow(toSun, 5.0) * (1.0 - exp(-dist / 900.0)) * hazeAmt;
          }
          // the woods' haze (marched at half resolution: see HAZE_FRAG)
          if (woodK > 0.001 && vWoods > 0.01) { vec4 h = hazeAt(vUv, d); col.rgb = col.rgb * h.a + h.rgb; }
          // the player's mist: how far out from the hero (across the ground) and how high; for the sky, and for anything past
          // the mist's far edge, where the line of sight is when it reaches that edge, so only the band low over the horizon
          // is covered and nothing far off (a giant tree on a ridge) stands out of the mist above its ceiling
          vec3 rd = normalize(P - camPos); float mpEdge = camPos.y + rd.y * (mzR1 / max(length(rd.xz), 1e-3)), mh = mzR1, mp = mpEdge;
          if (d < 0.99999) { mh = length(P.xz - mzC); mp = mix(P.y, mpEdge, smoothstep(mzR1 * 0.9, mzR1 * 1.1, mh)); }
          col.rgb = mix(col.rgb, mzCol, mzAmt * smoothstep(mzR0, mzR1, mh) * (1.0 - smoothstep(mzTop - mzSoft, mzTop + mzSoft, mp)));
          // shafts of sun: march towards the sun on the screen, gathering light wherever the sky shows through
          if (sunVis > 0.001 && rays > 0.5) {
            vec2 st = (sunUV - vUv) / float(${SAMPLES}) * 0.92, uv = vUv; float lit = 0.0, w = 1.0, tot = 0.0;
            for (int i = 0; i < ${SAMPLES}; i++) { uv += st; float sky = step(0.99999, texture2D(tDepth, clamp(uv, 0.001, 0.999)).x); lit += sky * w; tot += w; w *= 0.95; }
            float fall = 1.0 - smoothstep(0.0, 0.9, length((vUv - sunUV) * vec2(1.6, 1.0)));
            col.rgb += sunCol * (lit / tot) * fall * sunVis * rayAmt;
          }
          // the grade: white balance and saturation for the place and the hour, a cool or warm cast in the shadows
          col.rgb *= gTint; float l = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722)); col.rgb = max(mix(vec3(l), col.rgb, gSat), 0.0);
          col.rgb += gShadow * (1.0 - smoothstep(0.0, 0.35, l)) * 0.06;
          vec2 vu = (vUv - 0.5) * vigOffset; col.rgb = mix(col.rgb, vec3(1.0 - vigDark), dot(vu, vu));   // the vignette
          // by night a little moonlit blue in the darkest parts (after the vignette, so the corners don't fall to black)
          col.rgb += nightLift * (0.6 + 0.4 * vWoods) * (1.0 - smoothstep(0.0, 0.08, dot(col.rgb, vec3(0.2126, 0.7152, 0.0722))));
          gl_FragColor = col;
        }`,
    });
    this.fsQuad = new FullScreenQuad(this.material);
    this.hazeRT = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false }); this.hazeRT.texture.generateMipmaps = false; ATMO.tHaze.value = this.hazeRT.texture;
    this.hazeMat = new THREE.ShaderMaterial({ uniforms: ATMO, depthTest: false, depthWrite: false, vertexShader: WOODS_VERT, fragmentShader: HAZE_FRAG });
    this.hazeQuad = new FullScreenQuad(this.hazeMat);
  }
  render(renderer, writeBuffer, readBuffer) {
    const L = this.light; if (L?.shadow?.map) { ATMO.tShadow.value = L.shadow.map.texture; ATMO.shadowMat.value.copy(L.shadow.matrix); ATMO.lightDir.value.subVectors(L.position, L.target.position).normalize(); ATMO.lightCol.value.copy(L.color).multiplyScalar(L.intensity); }
    ATMO.tDiffuse.value = readBuffer.texture; ATMO.tDepth.value = readBuffer.depthTexture; ATMO.texel.value.set(1 / readBuffer.width, 1 / readBuffer.height); ATMO.aspect.value = readBuffer.width / readBuffer.height;
    // the woods' haze first, at half resolution, when there is any
    if (ATMO.woodK.value > 0.001) {
      const w = Math.max(1, Math.ceil(readBuffer.width / 2)), h = Math.max(1, Math.ceil(readBuffer.height / 2));
      if (this.hazeRT.width !== w || this.hazeRT.height !== h) this.hazeRT.setSize(w, h);
      ATMO.hTexel.value.set(1 / w, 1 / h); renderer.setRenderTarget(this.hazeRT); this.hazeQuad.render(renderer);
    }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); if (this.clear) renderer.clear();
    this.fsQuad.render(renderer);
  }
  dispose() { this.material.dispose(); this.fsQuad.dispose(); this.hazeMat.dispose(); this.hazeQuad.dispose(); this.hazeRT.dispose(); }
}

// Per frame: where the camera and the sun are, and how much mist, haze and light there is
const _v = new THREE.Vector3(), _f = new THREE.Vector3();
// The look for the place and the hour: warm and golden in the meadows, cool and green in the forest and under the giants,
// amber at sunrise and sunset, blue and muted at night
const G = { pedias: [1.04, 1.0, 0.93, 1.08, [0.02, 0.0, -0.02]], yleos: [0.95, 1.01, 0.98, 0.96, [-0.02, 0.01, 0.03]], dusk: [1.1, 0.97, 0.84, 1.12, [0.03, -0.01, -0.03]], night: [0.8, 0.92, 1.18, 0.76, [-0.02, 0.0, 0.06]], giant: [0.92, 1.03, 0.94, 0.94, [-0.03, 0.02, 0.0]] };
const _t = new THREE.Color(), _sh = new THREE.Vector3();
function grade(o) {
  const w = { pedias: o.wp * (1 - o.dusk) * (1 - o.night), yleos: o.wy * (1 - o.dusk) * (1 - o.night), dusk: o.dusk * (1 - o.night), night: o.night, giant: o.giant * 1.2 }; let tot = 0;
  _t.setRGB(0, 0, 0); _sh.set(0, 0, 0); let sat = 0;
  for (const k in w) { const g = G[k], a = w[k]; if (a <= 0) continue; tot += a; _t.r += g[0] * a; _t.g += g[1] * a; _t.b += g[2] * a; sat += g[3] * a; _sh.x += g[4][0] * a; _sh.y += g[4][1] * a; _sh.z += g[4][2] * a; }
  tot = Math.max(tot, 1e-3); ATMO.gTint.value.setRGB(_t.r / tot, _t.g / tot, _t.b / tot); ATMO.gSat.value = sat / tot; ATMO.gShadow.value.setRGB(_sh.x / tot, _sh.y / tot, _sh.z / tot);
}
export function updateAtmosphere(camera, o) {
  grade(o);
  ATMO.cloudOff.value.x += o.dt * (3 + o.overcast * 9); ATMO.cloudOff.value.y += o.dt * 1.2;
  ATMO.cloudCover.value = 0.5 - o.overcast * 0.25; ATMO.cloudK.value = 0.28 * o.day * Math.max(0, Math.min(1, (o.sunDir.y - 0.05) / 0.2)) * (1 - o.overcast * 0.7);
  ATMO.camNF.value.set(camera.near, camera.far); ATMO.nightLift.value.setRGB(0.005, 0.009, 0.022).multiplyScalar(o.night);
  ATMO.projInv.value.copy(camera.projectionMatrixInverse); ATMO.camWorld.value.copy(camera.matrixWorld); ATMO.camPos.value.copy(camera.position);
  ATMO.sunDir.value.copy(o.sunDir).normalize();
  ATMO.sunCol.value.copy(o.sunCol).multiplyScalar(o.sunK);
  ATMO.mistCol.value.copy(o.fogCol).lerp(o.sunCol, 0.15 * o.day).multiplyScalar(0.9 + 0.3 * o.day);
  if (o.fogFar) { ATMO.blurFar.value = o.fogFar * 0.85; ATMO.blurNear.value = o.fogFar * 0.4; }   // (with the fog: high up, where it clears, the blur moves out too)
  if (o.player) ATMO.mzC.value.set(o.player.x, o.player.z);
  if (o.mistTop !== undefined) ATMO.mzTop.value = o.mistTop;
  ATMO.mzCol.value.copy(o.fogCol).lerp(o.sunCol, 0.08 * o.day);
  ATMO.mistAmt.value = o.mist; ATMO.mistBase.value = o.ground - 6; ATMO.mistDen.value = o.mistDen;
  ATMO.hazeCol.value.copy(o.sunCol).multiplyScalar(0.35 * o.sunK); ATMO.hazeAmt.value = (0.25 + o.dusk * 0.9) * o.day;
  // the woods' haze: thick in the low morning and evening sun, thinner at noon, thicker still in rain or fog; at night a
  // thin blue air the moon lights. Unlit it takes the fog's colour, a little warmed by the sun by day (it's lit from all
  // round by the light coming through the leaves), deep blue by night.
  const high = Math.max(0, Math.min(1, (o.sunDir.y - 0.25) / 0.55)), wet = o.wetAir || 0;
  ATMO.woodK.value = (0.035 * (1 - 0.5 * high) * o.day + 0.022 * o.night) * (1 + wet * 0.8);
  ATMO.woodAmb.value.copy(o.fogCol).lerp(o.sunCol, 0.35 * o.day).multiplyScalar(0.55 + 0.25 * o.day);
  if (o.player) ATMO.woodFoot.value.copy(o.player);
  ATMO.fleckK.value = o.day * (1 - o.overcast * 0.85);
  // the sun on the screen, and how strongly its shafts show (only with the sun up, ahead of you, and not behind cloud)
  _v.copy(camera.position).addScaledVector(ATMO.sunDir.value, 1000).project(camera);
  camera.getWorldDirection(_f); const ahead = _f.dot(ATMO.sunDir.value);
  ATMO.sunUV.value.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5);
  ATMO.sunVis.value = Math.max(0, Math.min(1, (ahead - 0.15) / 0.4)) * Math.max(0, Math.min(1, (o.sunDir.y + 0.02) / 0.12)) * o.day * (1 - o.overcast) * o.rays;
}
