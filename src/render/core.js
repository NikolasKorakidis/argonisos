// Renderer, scene, camera, lights and post-processing. A light base grade (saturation, warm push, teal shadows) lives
// inside tone mapping (AgX), so every material runs it for free; the grade for each place and hour is in the atmosphere pass.
import * as THREE from 'three';
import { EffectComposer } from '../../vendor/three/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/three/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/three/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/three/jsm/postprocessing/OutputPass.js';
import { AtmospherePass, ATMO } from './atmosphere.js';
import { fitLens } from './lensdirt.js';
import { tileNoise, hash21 } from '../util/math.js';
import { ULTRA } from './quality.js';

THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace('vec3 CustomToneMapping( vec3 color ) { return color; }',
  `vec3 CustomToneMapping( vec3 color ) {
    float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = max(mix(vec3(l), color, 1.12) * vec3(1.04, 1.0, 0.93) + (1.0 - smoothstep(0.0, 0.5, l)) * vec3(-0.012, 0.01, 0.03), 0.0);
    return AgXToneMapping(color * 1.15); }`);   // (AgX: holds bright snow, marble and sky without burning out, and keeps the grass's depth)

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.CustomToneMapping; renderer.toneMappingExposure = 0.95; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);
// On Ultra every mipmapped texture is filtered at the card's best (16× anisotropic on any desktop card), so the ground,
// bark, marble and roof tiles stay sharp to the horizon at a glancing angle. Set on the prototype, before anything is
// loaded, so each texture made anywhere takes it; three applies it only where it means something (mipmapped, linear).
if (ULTRA) { const top = renderer.capabilities.getMaxAnisotropy(); Object.defineProperty(THREE.Texture.prototype, 'anisotropy', { get: () => top, set() { /* (Ultra: always the best) */ }, configurable: true }); }

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9cc8e8, 380, 3200);
export const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.15, 6000);

export const hemi = new THREE.HemisphereLight(0xbfdcff, 0x3f6a5a, 0.9); scene.add(hemi);
// The sun's shadows come in two cascades (docs/plans/shadows-plan.md): a sharp near one, SHADOW.nearR round a spot a
// little ahead of the player, and a coarse far one, SHADOW.farR round the player, so trees, rocks and buildings shade the
// land out into the mist. The far one is a second light that gives no light of its own, only its shadow map (one per light is
// what three draws); the lighting code below reads both maps for the sun and blends from one to the other. Each map
// is filtered over the same few centimetres of ground, widening where the caster stands high over the receiver (a
// crown's shade soft, a foot's sharp), so the hand-over doesn't show.
// (On Ultra, render/quality.js, both boxes are wider, the near one half as wide again and the far one out past the
// pushed-back mist, with maps twice the size: the near one sharper than High's, the far one as sharp over more than
// twice the ground; drawn again a little less often, as there is more in it.)
export const SHADOW = { nearR: ULTRA ? 48 : 32, farR: ULTRA ? 260 : 110, ahead: 0.35, depth: ULTRA ? 520 : 400, soft: 0.05, far: true, sky: 0.4,
  farStep: ULTRA ? 8 : 6, farTurn: 0.2,   // (the far map is drawn again only when you are this many metres from where it was drawn, or the sun has turned this many degrees)
  nightR: 20, nightFade: 14,  // (by moonlight trees cast only this near you, their shadows fading out by this far from the camera: faint, and cheap)
  night: false };
export const sun = new THREE.DirectionalLight(0xffdca0, 2.6);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -SHADOW.nearR, right: SHADOW.nearR, top: SHADOW.nearR, bottom: -SHADOW.nearR, near: 1, far: SHADOW.depth });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
export const sunFar = new THREE.DirectionalLight(0x000000, 1);   // (its colour carries the share of sky light a shadow takes: setShadowSky)
sunFar.castShadow = true; sunFar.shadow.mapSize.set(2048, 2048);
Object.assign(sunFar.shadow.camera, { left: -SHADOW.farR, right: SHADOW.farR, top: SHADOW.farR, bottom: -SHADOW.farR, near: 1, far: SHADOW.depth });
sunFar.shadow.bias = -0.0006; sunFar.shadow.normalBias = 0.18;
scene.add(sunFar, sunFar.target);   // (after the sun, so it is always the second directional light the shaders see)
// each map's filter radius in its own texels, so both soften over the same width of ground (settings.js calls this
// again when the map sizes change)
export function shadowSoftness() {
  for (const [L, r] of [[sun, SHADOW.nearR], [sunFar, SHADOW.farR]]) L.shadow.radius = Math.max(0.75, SHADOW.soft * L.shadow.mapSize.x / (2 * r));
}
shadowSoftness();
export function setShadowSky(k, fade = 0) { sunFar.color.setRGB(k, fade / 100, 0); }   // (and how far from the camera shadows fade out, 0 for not at all)
// three r160 draws into a shadow map whatever the *viewing* camera's layers allow, not the shadow camera's, so the
// trees' shadow stand-ins (on a layer only the shadow cameras see, vegetation.js) never reached the map. Each light's
// map is drawn on its own here, with the viewing camera's layers set to its shadow camera's for that pass (the scene's
// own draw list is already made by then). SHADOW.onPass(light) runs before each pass and onPass(null) after them all,
// so the vegetation can draw into each map only what lies in its box (vegetation.js). What moves, or is too small to
// see from afar, is marked userData.nearShadow (the hero, creatures, pickups) and casts into the near map alone: the far
// map holds only what stands still, so it needn't be drawn again until you have walked on (followShadow).
const drawShadows = renderer.shadowMap.render, one = [], _off = [];
renderer.shadowMap.render = function (lights, scn, cam) {
  const mask = cam.layers.mask;
  for (const L of lights) { if (L.shadow.autoUpdate === false && !L.shadow.needsUpdate) continue;
    one[0] = L; cam.layers.mask = L.shadow.camera.layers.mask; SHADOW.onPass?.(L);
    if (L === sunFar) scn.traverse((o) => { if (o.userData.nearShadow) o.traverse((m) => { if (m.castShadow) { m.castShadow = false; _off.push(m); } }); });
    drawShadows.call(this, one, scn, cam);
    for (const m of _off) m.castShadow = true; _off.length = 0; }
  cam.layers.mask = mask; SHADOW.onPass?.(null);
};
// The sun's shadow in every lit material: the near map where it reaches (eased into the far one over its outer tenth),
// the far one beyond (eased out to full light at its own edge). Each look is five bilinear looks (twenty texels) round
// the point, spread wider where the caster stands high above it (the gap measured at the centre: up to three times as
// wide eight metres up), so leaves' shade is soft and a foot's or a stone's sharp. Grass (SUN_SHADOW_CHEAP) takes one
// bilinear look: it is most of the pixels on screen. The far light itself adds nothing.
const SUN_SHADOW = `
  #if NUM_DIR_LIGHT_SHADOWS > 1
    float sunTap(sampler2D m, vec2 uv, float z) { return step(z, unpackRGBAToDepth(texture2D(m, uv))); }
    float sunBil(sampler2D m, vec2 size, vec2 uv, float z) { vec2 p = uv * size - 0.5, f = fract(p), t = 1.0 / size, b = (floor(p) + 0.5) * t;
      return mix(mix(sunTap(m, b, z), sunTap(m, b + vec2(t.x, 0.0), z), f.x), mix(sunTap(m, b + vec2(0.0, t.y), z), sunTap(m, b + t, z), f.x), f.y); }
    float sunMap(sampler2D m, DirectionalLightShadow s, vec3 c) {
      c.z += s.shadowBias;
      #ifdef SUN_SHADOW_CHEAP
        return sunBil(m, s.shadowMapSize, c.xy, c.z);
      #else
        float gap = c.z - unpackRGBAToDepth(texture2D(m, c.xy)); vec2 o = s.shadowRadius * (1.0 + 2.0 * smoothstep(0.0, ${(8 / SHADOW.depth).toFixed(5)}, gap)) / s.shadowMapSize;
        return (2.0 * sunBil(m, s.shadowMapSize, c.xy, c.z) + sunBil(m, s.shadowMapSize, c.xy + o * vec2(0.8, 0.3), c.z) + sunBil(m, s.shadowMapSize, c.xy + o * vec2(-0.3, 0.8), c.z)
          + sunBil(m, s.shadowMapSize, c.xy + o * vec2(-0.8, -0.3), c.z) + sunBil(m, s.shadowMapSize, c.xy + o * vec2(0.3, -0.8), c.z)) / 6.0;
      #endif
    }
    float sunLitK = 1.0;   // (how much sun reached this point: the sky's light is cut by a share of the same)
    float sunEdge(vec3 c, float w) { return smoothstep(0.0, w, min(min(c.x, 1.0 - c.x), min(c.y, 1.0 - c.y))) * step(c.z, 1.0); }
    float sunCascades() {
      vec3 n = vDirectionalShadowCoord[0].xyz / vDirectionalShadowCoord[0].w; float kn = sunEdge(n, 0.1);
      if (kn > 0.999) return sunMap(directionalShadowMap[0], directionalLightShadows[0], n);
      vec3 f = vDirectionalShadowCoord[1].xyz / vDirectionalShadowCoord[1].w; float kf = sunEdge(f, 0.08);
      float s = kf > 0.0 ? mix(1.0, sunMap(directionalShadowMap[1], directionalLightShadows[1], f), kf) : 1.0;
      return kn > 0.0 ? mix(s, sunMap(directionalShadowMap[0], directionalLightShadows[0], n), kn) : s;
    }
    // (fade: how far from the camera the shadows fade out, by moonlight; 0 by day)
    float sunShadow(float dist, float fade) { if (fade > 0.0 && dist > fade) return 1.0; float s = sunCascades(); return fade > 0.0 ? mix(s, 1.0, smoothstep(fade * 0.6, fade, dist)) : s; }
  #endif
`;
// The sky lights our world far more than the sun does (its light from every side, scene.environment), so a shadow that
// only took the sun away read as a faint smudge. A point the sun can't reach usually sees less of the sky too (the
// caster hides part of it): the sky's light there is cut by SHADOW.sky (by day; less by night and under cloud). It
// reaches the shaders as the far light's colour (that light adds nothing itself), which every lit material has.
THREE.ShaderChunk.lights_fragment_end = `
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 1
    { float skyK = 1.0 - directionalLights[ 1 ].color.r * ( 1.0 - sunLitK );
      #if defined( RE_IndirectDiffuse )
        irradiance *= skyK;
      #endif
      #if defined( RE_IndirectSpecular )
        iblIrradiance *= skyK; radiance *= skyK;
      #endif
    }
  #endif
` + THREE.ShaderChunk.lights_fragment_end;
THREE.ShaderChunk.shadowmap_pars_fragment = THREE.ShaderChunk.shadowmap_pars_fragment.replace('\tvec2 cubeToUV(', SUN_SHADOW + '\tvec2 cubeToUV(');
{
  const line = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
  if (!THREE.ShaderChunk.lights_fragment_begin.includes(line)) throw new Error('lights_fragment_begin has changed: the sun\'s cascades need patching anew');
  THREE.ShaderChunk.lights_fragment_begin = THREE.ShaderChunk.lights_fragment_begin.replace(line, `
    #if NUM_DIR_LIGHT_SHADOWS > 1 && UNROLLED_LOOP_INDEX == 0
      sunLitK = ( directLight.visible && receiveShadow ) ? sunShadow( length( geometryPosition ), directionalLights[ 1 ].color.g * 100.0 ) : 1.0; directLight.color *= sunLitK;
    #elif NUM_DIR_LIGHT_SHADOWS > 1
      directLight.color = vec3( 0.0 );
    #else
      ${line}
    #endif`);
}

export const GFX = { level: 'high', post: true, scale: Math.min(devicePixelRatio, 2) };

// (the scene's depth is kept with its colour, for the atmosphere pass)
const sceneRT = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }); sceneRT.depthTexture = new THREE.DepthTexture(innerWidth, innerHeight);
export const composer = new EffectComposer(renderer, sceneRT);
composer.setPixelRatio(GFX.scale); composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
export const atmosphere = new AtmospherePass(); atmosphere.light = sun; atmosphere.far = sunFar; composer.addPass(atmosphere);   // (it marches the woods' haze through the sun's far shadow map)
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, 0.5, 0.92); composer.addPass(bloom);
fitLens(bloom, { camera, scene, atmo: ATMO, gfx: GFX });   // (light on the lens, the sun in the fog and halos round fires, in the bloom's last step: lensdirt.js)
// (the vignette lives in the atmosphere pass now: one full-screen pass fewer)
composer.addPass(new OutputPass());
// The scene's antialiasing: 4× on Low to High, 8× on Ultra where the card allows (alpha-to-coverage then gives leaf
// edges nine steps of see-through instead of five). Both of the composer's buffers take it; disposed, they are made
// again at the new count when next drawn.
const MAX_SAMPLES = renderer.getContext().getParameter(renderer.getContext().MAX_SAMPLES) || 4;
export function setSamples(n) {
  n = Math.min(n, MAX_SAMPLES); if (composer.renderTarget1.samples === n) return;
  for (const t of [composer.renderTarget1, composer.renderTarget2]) { t.samples = n; t.dispose(); }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

// Render one frame, timing it on the GPU where the browser allows (EXT_disjoint_timer_query_webgl2): GPU.ms, smoothed.
// renderer.info counts the whole frame (all passes), reset here each frame.
const gl = renderer.getContext(), timer = gl.getExtension('EXT_disjoint_timer_query_webgl2'), queries = [];
export const GPU = { ms: 0, ok: !!timer };
renderer.info.autoReset = false;
export function render() {
  renderer.info.reset();
  let q = null; if (timer && queries.length < 4) { q = gl.createQuery(); gl.beginQuery(timer.TIME_ELAPSED_EXT, q); }
  if (GFX.post) composer.render(); else renderer.render(scene, camera);
  if (q) { gl.endQuery(timer.TIME_ELAPSED_EXT); queries.push(q); }
  while (queries.length && gl.getQueryParameter(queries[0], gl.QUERY_RESULT_AVAILABLE)) {
    const done = queries.shift(), ns = gl.getQueryParameter(done, gl.QUERY_RESULT); gl.deleteQuery(done);
    if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) GPU.ms += (ns / 1e6 - GPU.ms) * 0.1;
  }
}
// Resolution that follows the frame time: when frames run long the picture is drawn a little smaller (down to 70%), and
// when the GPU has room again it climbs back. Steps of 10%, at most one every two seconds, with a dead band in between so
// it never hunts; it never goes above the resolution chosen in the settings (on Ultra it may: up to half as much again,
// drawn larger than the screen and shrunk to it, when the card has room; a step above the screen's own it had to leave is
// not tried again for two minutes, so a card just short of it doesn't stutter every twenty seconds).
// (Decided on the frame time alone: some browsers' GPU timers report the whole frame interval, not the GPU's work. While
// the world is still streaming in it waits; and a step it had to leave for being too slow isn't retried for 20 s.)
export const ADAPT = { on: true, k: 1, t: 3, frame: 16.7, until: {}, min: 0.7, max: 1 };
export function adaptResolution(dt, loading) {
  ADAPT.frame += (Math.min(dt, 0.1) * 1000 - ADAPT.frame) * 0.05; ADAPT.t -= dt; if (!ADAPT.on || ADAPT.t > 0) return;
  if (loading) { ADAPT.t = 1; return; }
  const now = performance.now(), slow = ADAPT.frame > 19.5, up = Math.min(ADAPT.max, +(ADAPT.k + 0.1).toFixed(1)), roomy = ADAPT.frame < 17.3 && !(ADAPT.until[up] > now) && !(up > 1 && !bigEnough(up));
  const k = slow ? Math.max(ADAPT.min, +(ADAPT.k - 0.1).toFixed(1)) : roomy ? up : ADAPT.k;
  if (slow && k !== ADAPT.k) ADAPT.until[ADAPT.k] = now + (ADAPT.k > 1 ? 120000 : 20000);
  if (k !== ADAPT.k) { ADAPT.k = k; ADAPT.t = 2.5; setScale(); } else ADAPT.t = 0.5;
}
// (above the screen's own resolution: never wider than 5120 pixels drawn, 4K's width and a third)
const bigEnough = (k) => innerWidth * GFX.scale * k <= 5120;
export function setScale() { const s = GFX.scale * ADAPT.k; renderer.setPixelRatio(s); composer.setPixelRatio(s); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); }

// Keep the sun's shadow boxes round the player, snapped to shadow-map texels so edges don't shimmer as you move: the near
// one a little ahead along the view (what lies behind the camera needs less of its detail), drawn every frame; the far
// one centred on you. The far map holds only what stands still (see the shadow pass above), so it is drawn again only
// once you are SHADOW.farStep metres from where it was drawn or the sun has turned SHADOW.farTurn degrees: about once a
// second walking, not at all standing still. Each map keeps the box it was drawn with, so the two never disagree, and
// its texels stay put in the world, so a redraw changes nothing that was already in it.
// By the moon (farOn false) the far map is left empty, drawn once with nothing in it, and the trees cast into the near
// map only close by (SHADOW.night: vegetation.js; the shaders fade the shadows out, setShadowSky): moonlit shadows
// further off can't be seen in the dark. The switch comes as the sun hands over to the moon, when there's no light.
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
sunFar.shadow.autoUpdate = false;
function boxAt(L, target, dir) {
  const cam = L.shadow.camera, texel = (cam.right - cam.left) / L.shadow.mapSize.x;
  const fwd = _a.copy(dir).negate().normalize(), right = _b.crossVectors(fwd, UP).normalize(), up = _c.crossVectors(right, fwd);
  const r = Math.round(target.dot(right) / texel) * texel, u = Math.round(target.dot(up) / texel) * texel, f = target.dot(fwd);
  const centre = _d.copy(right).multiplyScalar(r).addScaledVector(up, u).addScaledVector(fwd, f);
  L.target.position.copy(centre); L.position.copy(centre).addScaledVector(dir, SHADOW.depth / 2);
}
const FAR_LAYERS = sunFar.shadow.camera.layers, farAt = new THREE.Vector3(1e9, 0, 0), farDir = new THREE.Vector3(); let farMask = null;
export function followShadow(target, dir, farOn = true) {
  camera.getWorldDirection(_e); _e.y = 0; const l = _e.length();
  boxAt(sun, _e.multiplyScalar(l > 1e-3 ? SHADOW.nearR * SHADOW.ahead / l : 0).add(target), dir);
  SHADOW.night = !farOn; sunFar.visible = SHADOW.far; if (!SHADOW.far) return;
  farMask ??= FAR_LAYERS.mask; const mask = farOn ? farMask : 0, switched = FAR_LAYERS.mask !== mask; FAR_LAYERS.mask = mask;
  const moved = Math.hypot(target.x - farAt.x, target.z - farAt.z) > SHADOW.farStep, turned = mask && dir.angleTo(farDir) > SHADOW.farTurn * Math.PI / 180;
  if (switched || !sunFar.shadow.map || (mask && (moved || turned))) { boxAt(sunFar, target, dir); sunFar.shadow.needsUpdate = true; farAt.copy(target); farDir.copy(dir); }
}

// ---- Procedural textures
export const waterNormals = (() => {
  const N = 256, hf = tileNoise(N, 8, 4, hash21), d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, hx = hf[y * N + ((x + 1) % N)] - hf[y * N + ((x - 1 + N) % N)], hz = hf[((y + 1) % N) * N + x] - hf[((y - 1 + N) % N) * N + x];
    const nx = -hx * 6, nz = -hz * 6, l = Math.hypot(nx, nz, 1);
    d.set([(nx / l * 0.5 + 0.5) * 255, (nz / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255, 255], i * 4);
  }
  const t = new THREE.DataTexture(d, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
})();
ATMO.tWaterN.value = waterNormals;   // (the sea's reflections ripple with the water: atmosphere.js SEA_SSR)
// Ground detail: soft painterly strokes that break up flat vertex colour up close (sampled at world xz / 3)
export const groundDetail = (() => {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'); g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, N, N); g.lineCap = 'round';
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 2600; i++) {
    const x = r() * N, y = r() * N, l = 3 + r() * 6, a = r() - 0.5, v = Math.floor(185 + r() * 70);
    g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1 + r() * 1.2;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.sin(a) * l, y + oy - Math.cos(a) * l); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
