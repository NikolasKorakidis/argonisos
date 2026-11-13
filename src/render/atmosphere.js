// The air, painted after the scene from its depth: morning mist that lies in the low ground and thins with height (heavy
// at first light, burning off as the day warms), a haze that glows towards the sun when you look into the light, and
// shafts of sun breaking past trees, columns and ridges. All in linear light, before bloom and tone mapping.
// The light (docs/plans/light-study.md; reworked after the tester's report of 13 Nov, beams that popped on and off and a
// screen that blew out white as you left the trees): nothing in it depends on where the player stands, only on what lies
// along each line of sight, so it is the same light from afar, close up and walking through it.
//   Shafts of sun (Valheim's own way, Unity's classic Sun Shafts): where the sky shows round the sun on the screen, in the
//   gaps between the crowns, past columns and over ridges, blurred outward from the sun at a quarter of the resolution
//   and added in the sun's colour; strongest with the sun low and ahead of you, fading as it leaves the view.
//   The woods' air: a thin haze lying low over the ground wherever there is wood (a world texture of how wooded each
//   place is, with the crowns' own map for detail near you), lit by the sun through the same shadow map the trees cast
//   into; it scatters mostly forward (Henyey-Greenstein) and is held below a ceiling, so it glows rather than blinds.
//   Marched at half resolution and blended over the frames before, so it doesn't shimmer as you walk.
//   Flecks of sun on the forest floor, from that same shadow map. By night only a faint blue air under the moon.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from '../../vendor/three/jsm/postprocessing/Pass.js';
import { MIST_R0, MIST_R1 } from '../world/reach.js';
import { WET_U, SHELTER } from '../world/wetness.js';

// (until the first shadow map is drawn: a texel at the far plane, so everything reads as lit; until the woods texture is
// baked: no wood anywhere)
const LIT = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); LIT.needsUpdate = true;
const BARE = new THREE.DataTexture(new Float32Array([0, 0]), 1, 1, THREE.RGFormat, THREE.FloatType); BARE.needsUpdate = true;
export const ATMO = {
  tDiffuse: { value: null }, tDepth: { value: null },
  projInv: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() },
  sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 0.9, 0.7) }, sunUV: { value: new THREE.Vector2(0.5, 0.5) },
  mistCol: { value: new THREE.Color(0.7, 0.75, 0.8) }, mistAmt: { value: 0 }, mistBase: { value: 0 }, mistH: { value: 14 }, mistDen: { value: 0.012 },
  hazeCol: { value: new THREE.Color(1, 0.75, 0.5) }, hazeAmt: { value: 0 },
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
  // the shafts of sun: how strong (by the hour, how near the sun the view looks, cloud), and the quarter-sized pictures
  // they're blurred in (rays: 0 turns them off, on the lower graphics settings; tIn: the one a pass reads, shRad: how far it reaches, in screen heights)
  shaftK: { value: 0 }, rays: { value: 1 }, tShafts: { value: null }, tIn: { value: null }, shRad: { value: 0.1 }, qTexel: { value: new THREE.Vector2(1 / 320, 1 / 180) },
  // the woods' light: the shadow map and where it lies (set from the shadow-casting light as the pass renders), the light's
  // direction and colour, how thick the woods' air is (woodK, per metre, by the hour and weather), how much light it
  // throws back (woodLit), its colour lit only from the sky round it (woodAmb), and how strong the flecks of sun on the
  // floor are; the woods texture (how wooded and how high the ground is, everywhere: setWoodsTexture)
  // (the haze reads the far shadow map, which reaches past its march wherever you stand; the flecks the near one, sharper)
  tShadow: { value: LIT }, shadowMat: { value: new THREE.Matrix4() }, tShadowN: { value: LIT }, shadowMatN: { value: new THREE.Matrix4() }, lightDir: { value: new THREE.Vector3(0, 1, 0) }, lightCol: { value: new THREE.Color() },
  woodK: { value: 0 }, woodLit: { value: 0.1 }, woodAmb: { value: new THREE.Color() }, fleckK: { value: 0 },
  tWoods: { value: BARE }, woodsExt: { value: 4096 },
  uCanopy: WET_U.uCanopy, uShelter: WET_U.uShelter, uShelterBox: WET_U.uShelterBox, uShelterNF: WET_U.uShelterNF,
  // the haze as marched at half resolution (its light, and how much of the scene shows through), the size of one of its
  // texels, and the camera's near and far (to tell, as it's spread back over the screen, which of it lies at what depth);
  // for blending it over the frames before: last frame's view, the march just made and the blend so far, and whether
  // there is a blend so far; frame: turns the march's starting spots a little each frame (held still for screenshots)
  tHaze: { value: null }, hTexel: { value: new THREE.Vector2(1 / 640, 1 / 360) }, camNF: { value: new THREE.Vector2(0.15, 6000) },
  prevVP: { value: new THREE.Matrix4() }, tHazeNew: { value: null }, tHazeOld: { value: null }, histOK: { value: 0 }, frame: { value: 0 },
  // a little moonlit blue lifted into the darkest parts of the picture by night, so the dark stays readable
  nightLift: { value: new THREE.Color(0, 0, 0) },
  // the shade in corners, under rocks and at your feet (ambient occlusion, docs/plans/shadows-plan.md): on or off (the
  // graphics setting), how strong, its navy tint (Valheim's AO is a deep navy, not black), how far round each point it
  // looks (metres) and the camera's scale for that; the half-sized result (r: how open, g: the depth it was found at) and
  // the size of one of its texels. And the floor of the far woods, past the shadow maps, kept in shade (woodsDark).
  ao: { value: 1 }, aoK: { value: 0 }, aoTint: { value: new THREE.Color(0.3, 0.34, 0.52) }, aoRad: { value: 0.9 }, aoProj: { value: 1 },
  tAO: { value: null }, aoTexel: { value: new THREE.Vector2(1 / 640, 1 / 360) }, woodsDark: { value: 0 },
  // Zeus's storm wall (stormwall.js), marched at a fraction of the resolution before this pass and laid over the frame
  // here, in the same pass (a pass of its own into the frame cost a whole extra resolve): whether there is any, the
  // march's result and its size, and how many pixels across each of its texels stands for
  stormOn: { value: 0 }, tStorm: { value: null }, stormRes: { value: new THREE.Vector2(1, 1) }, stormScale: { value: 4 },
};
// The woods texture, baked once by the worker pool (terrain-worker.js woodsTexture)
export function setWoodsTexture({ data, N, extent }) {
  const t = new THREE.DataTexture(data, N, N, THREE.RGFormat, THREE.FloatType); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  ATMO.tWoods.value = t; ATMO.woodsExt.value = extent;
}
const WOOD_STEPS = 28, WOOD_LEN = MIST_R1 - 10;   // (marched as far as the player's mist leaves anything to see; denser near the eye)
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
// what the passes need to know about where a pixel lies and what the light reaches
const LIGHT_PARS = `${SHELTER} uniform sampler2D tDepth, tShadow, tShadowN, tWoods; uniform mat4 projInv, camWorld, shadowMat, shadowMatN; uniform vec3 camPos, lightDir, lightCol, woodAmb;
  uniform float woodK, woodLit, woodsExt; varying vec2 vUv;
  vec3 worldAt(vec2 uv, float d) { vec4 v = projInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); v /= v.w; return (camWorld * v).xyz; }
  // how wooded a place is (r) and how high its ground lies (g): fixed in the world
  vec2 woodsAt(vec2 xz) { return texture2D(tWoods, xz / woodsExt + 0.5).rg; }
  // 1 where the light reaches a point (nothing between it and the sun or moon in the shadow map: the trees cast their light
  // stand-ins into it, the same ones at every distance, see vegetation.js), 0 in shade. Towards the edge of the shadow box
  // it eases into 'usual' (the share of light usually found there), so nothing changes where the box ends. The shadow map
  // is fixed in the world (its box steps by whole texels as it follows you), so this is too.
  float sunLit(vec3 p, float usual) { vec4 s = shadowMat * vec4(p, 1.0); s.xyz /= s.w;
    float k = smoothstep(0.0, 0.12, min(min(s.x, 1.0 - s.x), min(s.y, 1.0 - s.y))) * step(s.z, 1.0); if (k <= 0.0) return usual;
    return mix(usual, step(s.z - 0.0015, dot(texture2D(tShadow, s.xy), vec4(255.0 / 256.0) / vec4(16777216.0, 65536.0, 256.0, 1.0))), k); }
  // the same from the near shadow map (sharper, round the player), easing into the far one at its edge
  float nearLit(vec3 p, float usual) { vec4 s = shadowMatN * vec4(p, 1.0); s.xyz /= s.w;
    float k = smoothstep(0.0, 0.1, min(min(s.x, 1.0 - s.x), min(s.y, 1.0 - s.y))) * step(s.z, 1.0), far = sunLit(p, usual); if (k <= 0.0) return far;
    return mix(far, step(s.z - 0.0008, dot(texture2D(tShadowN, s.xy), vec4(255.0 / 256.0) / vec4(16777216.0, 65536.0, 256.0, 1.0))), k); }
  // how much the crowns' map counts at a place (it covers 112 m round the player: faded out towards its edge)
  float canopyK(vec2 xz) { vec2 uv = (xz - uShelterBox.xy) / uShelterBox.z; return smoothstep(0.0, 0.18, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y))); }
`;
// The woods' haze, at half resolution: marched from the eye along the line of sight, its thickness at each step taken
// from the world there (how wooded, how high over the ground; under a crown a little thicker, in a gap a little thinner),
// lit where the shadow map says the sun gets through. The light scattered towards the eye follows the Henyey-Greenstein
// phase (g 0.65: mostly forward, so the air glows towards the sun and the beams show faintly across it), and the whole is
// held under a soft ceiling so it can never wash the picture out. Each pixel starts its march at a different spot (a
// fixed pattern, turned a little each frame), which the blend over frames and the depth-aware upsample smooth away.
// Out: the light gathered (rgb) and how much of the scene shows through (a).
const HAZE_FRAG = `${LIGHT_PARS} uniform float frame;
  void main() {
    float d = texture2D(tDepth, vUv).x; vec3 P = worldAt(vUv, min(d, 0.9999)); float dist = length(P - camPos);
    float L = min(dist, ${WOOD_LEN}.0), j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + frame * 0.618034);
    vec3 rd = (P - camPos) / max(dist, 1e-3); float mu = dot(rd, lightDir), od = 0.0, lit = 0.0, amb = 0.0;
    for (int i = 0; i < ${WOOD_STEPS}; i++) { float u = (float(i) + j) / ${WOOD_STEPS}.0, ds = L * (2.0 * float(i) + 1.0) / ${WOOD_STEPS * WOOD_STEPS}.0;
      vec3 s = camPos + rd * (L * u * u); vec2 w = woodsAt(s.xz); if (w.r < 0.01) continue;
      float under = smoothstep(s.y + 1.0, s.y + 4.0, coverTop(uCanopy, s.xz));
      float den = woodK * w.r * exp(-max(s.y - w.g, 0.0) / 8.0) * mix(1.0, 0.55 + 0.6 * under, canopyK(s.xz)), dd = den * ds, tr = exp(-od);
      lit += tr * dd * sunLit(s, 1.0 - 0.6 * w.r); amb += tr * dd; od += dd; }
    float g = 0.65, hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);   // (relative to scattering evenly: 13.5 straight towards the light, 0.34 across it)
    vec3 c = lightCol * woodLit * hg * lit + woodAmb * amb;
    float cl = max(max(c.r, c.g), c.b); c *= 1.0 / (1.0 + cl / 0.45);   // (the ceiling: a soft knee towards 0.45)
    gl_FragColor = vec4(c, exp(-od));
  }`;
// The march blended over the frames before: last frame's blend, looked up where this pixel's line of sight was then, held
// within what this frame's march shows round the pixel (so nothing lingers that has gone), and mixed in a fifth at a time
const RESOLVE_FRAG = `uniform sampler2D tHazeNew, tHazeOld, tDepth; uniform mat4 projInv, camWorld, prevVP; uniform vec3 camPos; uniform vec2 hTexel; uniform float histOK; varying vec2 vUv;
  void main() {
    vec4 c = texture2D(tHazeNew, vUv), lo = c, hi = c;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec4 q = texture2D(tHazeNew, vUv + vec2(float(x), float(y)) * hTexel); lo = min(lo, q); hi = max(hi, q); }
    vec4 v = projInv * vec4(vUv * 2.0 - 1.0, min(texture2D(tDepth, vUv).x, 0.9999) * 2.0 - 1.0, 1.0); v /= v.w; vec3 P = (camWorld * v).xyz;
    P = camPos + normalize(P - camPos) * min(length(P - camPos), ${WOOD_LEN}.0);
    vec4 q = prevVP * vec4(P, 1.0); vec2 pv = q.xy / q.w * 0.5 + 0.5;
    if (histOK < 0.5 || q.w <= 0.0 || pv.x < 0.0 || pv.y < 0.0 || pv.x > 1.0 || pv.y > 1.0) { gl_FragColor = c; return; }
    gl_FragColor = mix(clamp(texture2D(tHazeOld, pv), lo, hi), c, 0.2);
  }`;
// The shafts' mask, at a quarter of the resolution: how much of each little patch is sky (four looks at the depth, so a
// twig doesn't flicker in and out), counted as much as it is the bright sky close round the sun, a little elsewhere
const MASK_FRAG = `uniform sampler2D tDepth; uniform mat4 projInv, camWorld; uniform vec3 camPos, sunDir; uniform vec2 texel; varying vec2 vUv;
  void main() {
    float sky = 0.0; for (int i = 0; i < 4; i++) { vec2 o = vec2(i == 0 || i == 2 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0) * texel * 1.5; sky += step(0.99999, texture2D(tDepth, vUv + o).x); }
    vec4 v = projInv * vec4(vUv * 2.0 - 1.0, 0.0, 1.0); v /= v.w; vec3 rd = normalize((camWorld * v).xyz - camPos);
    gl_FragColor = vec4(sky / 4.0 * (0.06 + 0.94 * pow(max(dot(rd, sunDir), 0.0), 40.0)), 0.0, 0.0, 1.0);
  }`;
// One pass of the blur outward from the sun: each pixel gathers what lies between it and the sun, up to shRad screen
// heights away (three passes, each reaching further, make long rays from a few looks). The looks step a little to either
// side of the line as they go, so a ray has soft sides; past the edge of the screen nothing is known, and counts as dark
// (so a sun above the picture doesn't draw its top row down the whole screen in hard columns).
const BLUR_FRAG = `uniform sampler2D tIn; uniform vec2 sunUV, qTexel; uniform float shRad, aspect; varying vec2 vUv;
  void main() {
    vec2 to = sunUV - vUv; float l = length(to * vec2(aspect, 1.0)); vec2 st = l > 1e-4 ? to / l * min(l, shRad) / 10.0 : vec2(0.0);
    vec2 side = l > 1e-4 ? normalize(vec2(-to.y * aspect, to.x / aspect)) * qTexel * 0.8 : vec2(0.0);
    float acc = 0.0, w = 1.0, tot = 0.0; for (int i = 0; i < 10; i++) { vec2 q = vUv + st * float(i) + side * (mod(float(i), 2.0) - 0.5);
      vec2 e = smoothstep(vec2(-0.04), vec2(0.0), q) * smoothstep(vec2(1.04), vec2(1.0), q);
      acc += texture2D(tIn, q).r * e.x * e.y * w; tot += w; w *= 0.86; }
    gl_FragColor = vec4(acc / tot, 0.0, 0.0, 1.0);
  }`;

// The shade in corners (ambient occlusion), at half resolution from the scene's depth alone, so every material, wind
// and leaf card counts as drawn: round each point, eight looks within aoRad metres on a disc facing the camera, each
// counting as much as it rises above the surface's own plane (the normal comes from the depth beside it, on each side
// the nearer one, so an edge doesn't bend it) and fading out with distance from the point, so a tree a metre behind
// the hero casts nothing on him. The disc turns by a fixed 4×4 pattern that the blur after it averages away, so it
// holds still. Out: r how open the point is, g its depth (for the blur and the spread back over the screen).
const AO_FAR = 75;
const AO_FRAG = `uniform sampler2D tDepth; uniform mat4 projInv; uniform vec2 texel; uniform float aoRad, aoProj, aspect; varying vec2 vUv;
  vec3 viewAt(vec2 uv) { vec4 v = projInv * vec4(uv * 2.0 - 1.0, texture2D(tDepth, uv).x * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
  void main() {
    vec2 uv = (floor(vUv / texel) + 0.5) * texel;   // (on a full-sized texel's centre: half-way between two, the looks either side could land on the same one)
    if (texture2D(tDepth, uv).x > 0.99999) { gl_FragColor = vec4(1.0, 1e4, 0.0, 1.0); return; }
    vec3 P = viewAt(uv); float z = -P.z; if (z > ${AO_FAR}.0) { gl_FragColor = vec4(1.0, z, 0.0, 1.0); return; }
    vec3 l = viewAt(uv - vec2(texel.x, 0.0)), r = viewAt(uv + vec2(texel.x, 0.0)), b = viewAt(uv - vec2(0.0, texel.y)), t = viewAt(uv + vec2(0.0, texel.y));
    vec3 N = normalize(cross(abs(r.z - P.z) < abs(P.z - l.z) ? r - P : P - l, abs(t.z - P.z) < abs(P.z - b.z) ? t - P : P - b));
    float ru = clamp(aoRad * aoProj / z, texel.y * 3.0, 0.06), a0 = 6.2831 * fract(52.9829189 * fract(dot(floor(mod(gl_FragCoord.xy, 4.0)), vec2(0.06711056, 0.00583715)))), occ = 0.0;
    for (int i = 0; i < 8; i++) { float u = (float(i) + 0.5) / 8.0, th = a0 + float(i) * 2.39996;
      vec3 v = viewAt(uv + vec2(cos(th) / aspect, sin(th)) * ru * u) - P; float vv = dot(v, v);
      occ += max(dot(v, N) * inversesqrt(vv + 1e-4) - 0.08, 0.0) * max(0.0, 1.0 - vv / (aoRad * aoRad)); }
    gl_FragColor = vec4(max(0.0, 1.0 - occ / 8.0 * 3.0), z, 0.0, 1.0);
  }`;
// The blur over that 4×4 pattern: sixteen looks, each counted as much as it lies at the same depth
const AO_BLUR = `uniform sampler2D tIn; uniform vec2 aoTexel; varying vec2 vUv;
  void main() { vec2 c = texture2D(tIn, vUv).rg; float acc = 0.0, tot = 0.0;
    for (int y = -2; y < 2; y++) for (int x = -2; x < 2; x++) { vec2 s = texture2D(tIn, vUv + vec2(float(x), float(y)) * aoTexel).rg;
      float w = 1.0 / (1.0 + abs(s.y - c.y) / (0.03 * c.y + 0.05)); acc += s.r * w; tot += w; }
    gl_FragColor = vec4(acc / tot, c.y, 0.0, 1.0); }`;

export class AtmospherePass extends Pass {
  constructor() {
    super();
    const quad = (fragmentShader) => new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: ATMO, depthTest: false, depthWrite: false, vertexShader: VERT, fragmentShader }));
    this.material = new THREE.ShaderMaterial({
      uniforms: ATMO, depthTest: false, depthWrite: false, vertexShader: VERT,
      fragmentShader: `${LIGHT_PARS} uniform sampler2D tDiffuse, tHaze, tShafts; uniform vec3 sunDir, sunCol, mistCol, hazeCol, mzCol, nightLift; uniform vec2 hTexel, camNF;
        uniform float fleckK, shaftK, ao, aoK, woodsDark; uniform sampler2D tAO; uniform vec2 aoTexel; uniform vec3 aoTint;
        uniform vec2 sunUV, cloudOff, texel, mzC; uniform float blurNear, blurFar, blurAmt, focus, aspect, mzR0, mzR1, mzAmt, mzTop, mzSoft, mistAmt, mistBase, mistH, mistDen, hazeAmt, vigOffset, vigDark, gSat, cloudCover, cloudK;
        uniform vec3 gTint, gShadow; uniform sampler2D tStorm; uniform float stormOn, stormScale; uniform vec2 stormRes;
        float h12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
        // the woods' haze spread back over the screen: nine looks round the pixel in the half-sized haze, each counted as
        // much as it lies at the same depth (so a trunk's edge keeps its own haze, not the air's behind it)
        float linD(float d) { return camNF.x * camNF.y / (camNF.y - d * (camNF.y - camNF.x)); }
        vec4 hazeAt(vec2 uv, float d0) { float z0 = min(linD(d0), ${WOOD_LEN + 4}.0); vec4 acc = vec4(0.0); float tot = 0.0;
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 q = uv + vec2(float(x), float(y)) * hTexel;
            float z = min(linD(texture2D(tDepth, q).x), ${WOOD_LEN + 4}.0), w = (x == 0 && y == 0 ? 2.0 : abs(float(x * y)) > 0.0 ? 0.7 : 1.0) / (1.0 + abs(z - z0) * 4.0 / (0.08 * z0 + 0.25));
            acc += texture2D(tHaze, q) * w; tot += w; }
          return acc / tot; }
        // the shade in corners spread back over the screen: the four half-sized texels round the pixel, each counted by
        // how near it lies and how near its depth is to the pixel's
        float aoAt(vec2 uv, float z0) { vec2 p = uv / aoTexel - 0.5, f = fract(p), b = (floor(p) + 0.5) * aoTexel; float acc = 0.0, tot = 0.0;
          for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) { vec2 s = texture2D(tAO, b + vec2(float(x), float(y)) * aoTexel).rg;
            float w = (x == 0 ? 1.0 - f.x : f.x) * (y == 0 ? 1.0 - f.y : f.y) / (1.0 + abs(s.y - z0) / (0.02 * z0 + 0.04)) + 1e-4; acc += s.r * w; tot += w; }
          return acc / tot; }
        // the storm wall spread back over the screen: the four texels of its march round the pixel, each counted as much as
        // the depth it was marched against (that of one pixel of the patch it stands for) is the same as this pixel's, so
        // a tree's edge in front of the storm stays crisp
        vec4 stormAt(vec2 uv, float d0) { float z0 = linD(d0); vec2 h = (uv / texel - 0.5) / stormScale, i0 = floor(h), f = h - i0; vec4 acc = vec4(0.0); float tot = 0.0;
          for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) { vec2 ih = clamp(i0 + vec2(float(x), float(y)), vec2(0.0), stormRes - 1.0);
            float zt = linD(texture2D(tDepth, (ih * stormScale + 0.5) * texel).x), w = (x == 0 ? 1.0 - f.x : f.x) * (y == 0 ? 1.0 - f.y : f.y) / (1.0 + abs(zt - z0) / (0.03 * z0 + 0.3)) + 1e-5;
            acc += texture2D(tStorm, (ih + 0.5) / stormRes) * w; tot += w; }
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
            // the shade in corners, at the feet and under rocks, in a deep navy rather than grey; less on what the sun
            // lights brightly (it is the sky's light that a corner shuts out), gone before the mist
            if (ao > 0.5 && dist < ${AO_FAR}.0) { float a = aoAt(vUv, linD(d)), k = aoK * (1.0 - smoothstep(${AO_FAR - 30}.0, ${AO_FAR}.0, dist)) * (1.0 - 0.45 * smoothstep(0.25, 1.2, dot(col.rgb, vec3(0.2126, 0.7152, 0.0722))));
              col.rgb *= mix(vec3(1.0), mix(aoTint, vec3(1.0), a), k); }
            // past the shadow maps' reach, the floor and trunks of the woods stay in the crowns' shade (the woods texture:
            // how wooded, and how high the ground lies), so far forests read dark beneath and lit on top, as near ones do
            if (woodsDark > 0.001 && dist > 85.0) { vec2 w = woodsAt(P.xz); col.rgb *= 1.0 - woodsDark * smoothstep(0.2, 0.7, w.r) * (1.0 - smoothstep(3.0, 9.0, P.y - w.g)) * smoothstep(85.0, 130.0, dist); }
            // the sun on the forest floor: where it gets through the leaves (the shadow map, fixed in the world) it glows a
            // little warmer and the shade beside it is a little deeper, so the floor under the crowns reads as pools of sun
            // in the shade; as much as the place is wooded, fading out with distance
            if (fleckK > 0.001 && dist < 36.0) {
              vec3 fn = normalize(cross(dFdx(P), dFdy(P)));   // (only the ground: the hero and the trunks take the sun as it falls)
              float k = fleckK * smoothstep(0.15, 0.6, woodsAt(P.xz).r) * (1.0 - smoothstep(24.0, 36.0, dist)) * smoothstep(0.6, 0.85, abs(fn.y));
              if (k > 0.001) { float lit = nearLit(P + lightDir * 0.12, 0.5); col.rgb *= (1.0 - 0.18 * k * (1.0 - lit)) * (1.0 + lit * k * 0.35 * normalize(lightCol + 1e-4) * 1.7); }
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
          if (woodK > 0.0001) { vec4 h = hazeAt(vUv, d); col.rgb = col.rgb * h.a + h.rgb; }
          // the player's mist: how far out from the hero (across the ground) and how high; for the sky, and for anything past
          // the mist's far edge, where the line of sight is when it reaches that edge, so only the band low over the horizon
          // is covered and nothing far off (a giant tree on a ridge) stands out of the mist above its ceiling
          vec3 rd = normalize(P - camPos); float mpEdge = camPos.y + rd.y * (mzR1 / max(length(rd.xz), 1e-3)), mh = mzR1, mp = mpEdge;
          if (d < 0.99999) { mh = length(P.xz - mzC); mp = mix(P.y, mpEdge, smoothstep(mzR1 * 0.9, mzR1 * 1.1, mh)); }
          col.rgb = mix(col.rgb, mzCol, mzAmt * smoothstep(mzR0, mzR1, mh) * (1.0 - smoothstep(mzTop - mzSoft, mzTop + mzSoft, mp)));
          // the storm wall, over what lies behind it (with the player's mist on its foot already: stormwall.js)
          if (stormOn > 0.5) { vec4 s = stormAt(vUv, d); col.rgb = col.rgb * (1.0 - s.a) + s.rgb; }
          // shafts of sun (blurred outward from the sun at a quarter of the resolution: see MASK_FRAG and BLUR_FRAG); light
          // scattered by the air between you and what you see, so the hero and the trunk beside you take little of it, and
          // the open sky (which has the sun's own glow) only a little
          if (shaftK > 0.001) col.rgb += sunCol * texture2D(tShafts, vUv).r * shaftK * (d < 0.99999 ? 1.0 - exp(-dist / 18.0) : 0.3);
          // the grade: white balance and saturation for the place and the hour, a cool or warm cast in the shadows
          col.rgb *= gTint; float l = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722)); col.rgb = max(mix(vec3(l), col.rgb, gSat), 0.0);
          col.rgb += gShadow * (1.0 - smoothstep(0.0, 0.35, l)) * 0.06;
          vec2 vu = (vUv - 0.5) * vigOffset; col.rgb = mix(col.rgb, vec3(1.0 - vigDark), dot(vu, vu));   // the vignette
          // by night a little moonlit blue in the darkest parts (after the vignette, so the corners don't fall to black)
          col.rgb += nightLift * (1.0 - smoothstep(0.0, 0.08, dot(col.rgb, vec3(0.2126, 0.7152, 0.0722))));
          gl_FragColor = col;
        }`,
    });
    this.fsQuad = new FullScreenQuad(this.material);
    const rt = () => { const t = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false }); t.texture.generateMipmaps = false; return t; };
    this.hazeRT = rt(); this.hist = [rt(), rt()]; this.hi = 0; this.histOK = false; this.sh = [rt(), rt()];
    this.hazeQuad = quad(HAZE_FRAG); this.resolveQuad = quad(RESOLVE_FRAG); this.maskQuad = quad(MASK_FRAG); this.blurQuad = quad(BLUR_FRAG);
    this.aoQuad = quad(AO_FRAG); this.aoBlurQuad = quad(AO_BLUR); this.aoRT = [rt(), rt()]; for (const t of this.aoRT) t.texture.magFilter = t.texture.minFilter = THREE.NearestFilter;
  }
  render(renderer, writeBuffer, readBuffer) {
    // (the sun or moon, and its shadow maps: the haze marches through the far one where there is one, the flecks look in
    // the near one; each map's matrix is the one it was drawn with)
    const L = this.light, F = this.far?.visible && this.far.shadow.map ? this.far : L;
    if (L?.shadow?.map) { ATMO.tShadowN.value = L.shadow.map.texture; ATMO.shadowMatN.value.copy(L.shadow.matrix); ATMO.lightDir.value.subVectors(L.position, L.target.position).normalize(); ATMO.lightCol.value.copy(L.color).multiplyScalar(L.intensity); }
    if (F?.shadow?.map) { ATMO.tShadow.value = F.shadow.map.texture; ATMO.shadowMat.value.copy(F.shadow.matrix); }
    ATMO.tDiffuse.value = readBuffer.texture; ATMO.tDepth.value = readBuffer.depthTexture; ATMO.texel.value.set(1 / readBuffer.width, 1 / readBuffer.height); ATMO.aspect.value = readBuffer.width / readBuffer.height;
    const size = (t, w, h) => { if (t.width === w && t.height === h) return false; t.setSize(w, h); return true; };
    // the woods' haze first, at half resolution, when there is any; then blended with the frames before
    if (ATMO.woodK.value > 0.0001) {
      const w = Math.max(1, Math.ceil(readBuffer.width / 2)), h = Math.max(1, Math.ceil(readBuffer.height / 2));
      if (size(this.hazeRT, w, h) | size(this.hist[0], w, h) | size(this.hist[1], w, h)) this.histOK = false;
      ATMO.hTexel.value.set(1 / w, 1 / h); renderer.setRenderTarget(this.hazeRT); this.hazeQuad.render(renderer);
      ATMO.tHazeNew.value = this.hazeRT.texture; ATMO.tHazeOld.value = this.hist[this.hi].texture; ATMO.histOK.value = this.histOK ? 1 : 0;
      this.hi = 1 - this.hi; renderer.setRenderTarget(this.hist[this.hi]); this.resolveQuad.render(renderer);
      ATMO.tHaze.value = this.hist[this.hi].texture; this.histOK = true;
    } else this.histOK = false;
    // the shafts of sun, at a quarter of the resolution: the sky round the sun, then three blurs outward from it
    if (ATMO.shaftK.value > 0.001) {
      const w = Math.max(1, Math.ceil(readBuffer.width / 4)), h = Math.max(1, Math.ceil(readBuffer.height / 4)), [a, b] = this.sh;
      size(a, w, h); size(b, w, h); ATMO.qTexel.value.set(1 / w, 1 / h);
      renderer.setRenderTarget(a); this.maskQuad.render(renderer);
      for (const [src, dst, r] of [[a, b, 0.05], [b, a, 0.15], [a, b, 0.4]]) { ATMO.tIn.value = src.texture; ATMO.shRad.value = r; renderer.setRenderTarget(dst); this.blurQuad.render(renderer); }
      ATMO.tShafts.value = b.texture;
    }
    // the shade in corners, at half resolution, then blurred over its turning pattern
    if (ATMO.ao.value > 0.5) {
      const w = Math.max(1, Math.ceil(readBuffer.width / 2)), h = Math.max(1, Math.ceil(readBuffer.height / 2)), [a, b] = this.aoRT;
      size(a, w, h); size(b, w, h); ATMO.aoTexel.value.set(1 / w, 1 / h);
      renderer.setRenderTarget(a); this.aoQuad.render(renderer); ATMO.tIn.value = a.texture; renderer.setRenderTarget(b); this.aoBlurQuad.render(renderer); ATMO.tAO.value = b.texture;
    }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); if (this.clear) renderer.clear();
    this.fsQuad.render(renderer);
  }
  dispose() {
    this.material.dispose(); this.fsQuad.dispose();
    for (const q of [this.hazeQuad, this.resolveQuad, this.maskQuad, this.blurQuad, this.aoQuad, this.aoBlurQuad]) { q.material.dispose(); q.dispose(); }
    for (const t of [this.hazeRT, ...this.hist, ...this.sh, ...this.aoRT]) t.dispose();
  }
}

// Per frame: where the camera and the sun are, and how much mist, haze and light there is
const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _vp = new THREE.Matrix4();
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
// How strong the light in the air is (kept together here, so they can be weighed against each other): the woods' air,
// per metre at the ground in a full wood, by day and by night; how much sun and moonlight it scatters; how much of the
// sky's light round it; and the shafts of sun
export const AIR = { woodDay: 0.004, woodNight: 0.004, lit: 0.25, litNight: 0.12, amb: 0.15, ambNight: 0.35, shafts: 1.2, ao: 0.8, woodsDark: 0.3 };
const clamp01 = (x) => Math.max(0, Math.min(1, x)), sstep = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
export function updateAtmosphere(camera, o) {
  grade(o);
  ATMO.cloudOff.value.x += o.dt * (3 + o.overcast * 9); ATMO.cloudOff.value.y += o.dt * 1.2;
  ATMO.cloudCover.value = 0.5 - o.overcast * 0.25; ATMO.cloudK.value = 0.28 * o.day * clamp01((o.sunDir.y - 0.05) / 0.2) * (1 - o.overcast * 0.7);
  ATMO.camNF.value.set(camera.near, camera.far); ATMO.nightLift.value.setRGB(0.006, 0.011, 0.026).multiplyScalar(o.night);
  // (the camera as it will be drawn this frame: its world matrix is otherwise only brought up to date as the scene renders)
  camera.updateMatrixWorld();
  ATMO.prevVP.value.copy(_vp); _vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  ATMO.projInv.value.copy(camera.projectionMatrixInverse); ATMO.camWorld.value.copy(camera.matrixWorld); ATMO.camPos.value.copy(camera.position);
  if (!o.still) ATMO.frame.value = (ATMO.frame.value + 1) % 64;
  ATMO.sunDir.value.copy(o.sunDir).normalize();
  ATMO.sunCol.value.copy(o.sunCol).multiplyScalar(o.sunK);
  ATMO.mistCol.value.copy(o.fogCol).lerp(o.sunCol, 0.15 * o.day).multiplyScalar(0.9 + 0.3 * o.day);
  if (o.fogFar) { ATMO.blurFar.value = o.fogFar * 0.85; ATMO.blurNear.value = o.fogFar * 0.4; }   // (with the fog: high up, where it clears, the blur moves out too)
  if (o.player) ATMO.mzC.value.set(o.player.x, o.player.z);
  if (o.mistTop !== undefined) ATMO.mzTop.value = o.mistTop;
  ATMO.mzCol.value.copy(o.fogCol).lerp(o.sunCol, 0.08 * o.day);
  ATMO.mistAmt.value = o.mist; ATMO.mistBase.value = o.ground - 6; ATMO.mistDen.value = o.mistDen;
  ATMO.hazeCol.value.copy(o.sunCol).multiplyScalar(0.35 * o.sunK); ATMO.hazeAmt.value = (0.25 + o.dusk * 0.9) * o.day;
  // the woods' air: thin by day, a little thicker with the sun low, thicker in rain or fog; by night thinner still and
  // only faintly lit by the moon. Lit only from the sky round it, it takes the fog's colour, a little warmed by the sun by
  // day, a dim blue by night.
  const low = 1 - sstep(0.15, 0.6, o.sunDir.y), wet = o.wetAir || 0;
  ATMO.woodK.value = (AIR.woodDay * (1 + 0.4 * low) * o.day + AIR.woodNight * o.night) * (1 + wet * 0.8);
  ATMO.woodLit.value = AIR.lit * o.day + AIR.litNight * o.night;
  ATMO.woodAmb.value.copy(o.fogCol).lerp(o.sunCol, 0.3 * o.day).multiplyScalar(AIR.amb * o.day + AIR.ambNight * o.night);
  ATMO.fleckK.value = o.day * (1 - o.overcast * 0.85);
  // the shade in corners: a little stronger by night (Valheim's grows towards night), when there's no sun to soften it;
  // the far woods' floor kept in shade by day, less under cloud
  ATMO.aoK.value = AIR.ao * (1 + 0.25 * o.night); ATMO.aoProj.value = camera.projectionMatrix.elements[5] * 0.5;
  ATMO.woodsDark.value = AIR.woodsDark * o.day * (1 - o.overcast * 0.6);
  // the sun on the screen, and how strong its shafts are: the sun up and not behind cloud, strongest low; and how near the
  // view looks towards it, eased so they fade as the sun leaves the screen rather than stopping at its edge (looking
  // across a high sun some still stream down from the gaps overhead)
  camera.getWorldDirection(_f); const ahead = _f.dot(ATMO.sunDir.value);
  _v.copy(camera.position).addScaledVector(ATMO.sunDir.value, 1000).project(camera);
  ATMO.sunUV.value.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5);
  ATMO.shaftK.value = ahead < 0.02 ? 0 : AIR.shafts * sstep(0.0, 0.8, ahead) * (1 - 0.5 * sstep(0.15, 0.8, o.sunDir.y)) * clamp01((o.sunDir.y + 0.02) / 0.12) * o.day * (1 - o.overcast) * (o.rays ?? 1) * ATMO.rays.value;
}
