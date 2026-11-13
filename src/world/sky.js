// Sky and time of day. One in-game day lasts 32 real minutes: 24 of daylight and 8 of night (the GDD's cycle).
// The dome shader paints the day gradient and sun, and at night a starfield with the Milky Way, a cratered moon
// and, on some nights, aurora curtains, all hidden as the sky clouds over. A physical-sky copy lights reflections. The
// clouds themselves are in clouds.js.
import * as THREE from 'three';
import { Sky } from '../../vendor/three/jsm/objects/Sky.js';
import { scene, camera, renderer, sun, hemi } from '../render/core.js';
import { clamp, lerp } from '../util/math.js';

export const DAY_SECONDS = 32 * 60, DAY_FRACTION = 24 / 32;

export const skyDome = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x3a78c8) }, hor: { value: new THREE.Color(0xb8dcf0) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(0xfff0c8) },
    night: { value: 0 }, uT: { value: 0 }, moonDir: { value: new THREE.Vector3(0, 1, 0) }, aurora: { value: 0 }, dusk: { value: 0 }, glowCol: { value: new THREE.Color(0xff8a40) }, cover: { value: 0 } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol, moonDir, glowCol; uniform float night, uT, aurora, dusk, cover; varying vec3 vDir;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
    float stars(vec3 d, float scale, float thr){ vec2 uv = vec2(atan(d.z, d.x) * scale, asin(clamp(d.y, -1.0, 1.0)) * scale); vec2 id = floor(uv), f = fract(uv) - 0.5;
      float h = h21(id); if (h < thr) return 0.0; vec2 o = vec2(h21(id + 3.1), h21(id + 7.7)) - 0.5; float r = length(f - o * 0.6);
      float tw = 0.65 + 0.35 * sin(uT * (1.5 + h * 4.0) + h * 60.0); return smoothstep(0.09, 0.0, r) * tw * (h - thr) / (1.0 - thr); }
    void main(){
      vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
      vec3 c = mix(hor, top, pow(h, 0.55));
      float s = max(dot(d, normalize(sunDir)), 0.0);
      // (under a heavy sky (cover) no disc, only a faint brightening where the sun is; the stars and the moon go too)
      c += sunCol * (pow(s, 600.0) * 3.0 * (1.0 - cover) + pow(s, 12.0) * 0.25 * (1.0 - cover * 0.7)) * (1.0 - night);
      // dawn and dusk: a glow gathered about the sun low on the horizon; opposite, the pink Belt of Venus over the
      // blue of the earth's shadow
      if (dusk > 0.01) {
        vec2 hz = normalize(d.xz + 1e-5), sz = normalize(normalize(sunDir).xz + 1e-5); float toward = dot(hz, sz), low = pow(1.0 - h, 4.0);
        c += glowCol * dusk * (low * (0.22 + pow(max(toward, 0.0), 3.0) * 1.1) + pow(s, 8.0) * 0.5);
        float away = pow(max(-toward, 0.0), 2.0);
        c += vec3(0.6, 0.34, 0.44) * dusk * away * smoothstep(0.02, 0.12, d.y) * smoothstep(0.34, 0.1, d.y) * 0.4;
        c = mix(c, c * vec3(0.55, 0.62, 0.86), dusk * away * smoothstep(0.09, 0.0, d.y) * 0.5);
      }
      float sn = night * (1.0 - cover); if (sn > 0.01 && d.y > -0.05) {   // (sn: how much of the night sky shows through the cloud)
        float up = smoothstep(-0.02, 0.25, d.y);
        // Milky Way: a soft, mottled band across the sky with extra dense stars inside it
        vec3 N = normalize(vec3(0.35, 0.55, 0.76)); float band = exp(-pow(dot(d, N) / 0.2, 2.0));
        float neb = vn(d.xz * 9.0 + d.y * 4.0) * 0.6 + vn(d.xz * 23.0) * 0.4;
        c += vec3(0.55, 0.6, 0.85) * band * (0.08 + neb * 0.16) * sn * up;
        c -= vec3(0.03) * band * smoothstep(0.55, 0.8, vn(d.xz * 14.0)) * sn;                      // dust lanes
        float st = stars(d, 160.0, 0.93) * 1.2 + stars(d, 320.0, 0.955) * 0.8 + stars(d, 320.0, 0.9) * band * 1.2;
        c += vec3(0.95, 0.97, 1.0) * st * sn * up;
        // moon: disc with maria, a tight glow and a wide halo
        float m = dot(d, normalize(moonDir));
        vec3 md = normalize(moonDir), mt = normalize(cross(md, vec3(0.0, 1.0, 0.0))), mb = cross(mt, md); vec2 mp = vec2(dot(d, mt), dot(d, mb)) / 0.028;
        float disc = smoothstep(1.0, 0.96, length(mp)) * step(0.0, m);
        float maria = vn(mp * 2.2 + 4.0) * 0.6 + vn(mp * 5.0) * 0.4;
        c = mix(c, vec3(0.92, 0.93, 0.88) * (0.78 + maria * 0.3), disc * sn);
        c += vec3(0.55, 0.62, 0.8) * (pow(max(m, 0.0), 900.0) * 0.8 + pow(max(m, 0.0), 40.0) * 0.12) * sn;
        // aurora: layered curtains over the northern horizon (-z), green at the foot, violet at the top
        if (aurora > 0.01 && d.z < 0.2) {
          float az = atan(d.x, -d.z), alt = d.y;
          float curtain = 0.0;
          for (int i = 0; i < 3; i++) { float fi = float(i);
            float wave = sin(az * (3.0 + fi) + uT * (0.12 + fi * 0.05) + sin(az * 7.0 - uT * 0.2) * 0.6) * 0.06;
            float base = 0.07 + fi * 0.05 + wave, rays = 0.55 + 0.45 * vn(vec2(az * 40.0 + fi * 10.0, uT * 0.4));
            curtain += smoothstep(base, base + 0.02, alt) * smoothstep(base + 0.32, base + 0.05, alt) * rays * (1.0 - fi * 0.25); }
          float fade = smoothstep(0.2, -0.4, d.z) * smoothstep(1.3, 0.3, abs(az));
          vec3 ac = mix(vec3(0.15, 1.0, 0.55), vec3(0.6, 0.3, 1.0), smoothstep(0.1, 0.4, alt));
          c += ac * curtain * fade * aurora * sn * 0.55;
        }
      }
      if (vDir.y < 0.0) c = hor;
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
scene.add(skyDome);
const sky = new Sky(); sky.material.uniforms.turbidity.value = 1.8; sky.material.uniforms.rayleigh.value = 3.0;
sky.material.uniforms.mieCoefficient.value = 0.004; sky.material.uniforms.mieDirectionalG.value = 0.85;
const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(), envSky = new Sky(); envSky.material = sky.material; envSky.scale.setScalar(1000); envScene.add(envSky);
let envRT = null, envTimer = 0, envE = 9, envOv = 9;
function refreshEnvironment() { if (envRT) envRT.dispose(); envRT = pmrem.fromScene(envScene, 0.04); scene.environment = envRT.texture; }

// (the clouds are in clouds.js, which reads the lightning's flashes itself; these two stay empty, for lightning.js)
export const clouds = [], stormClouds = [];

// ---- Time of day. t in [0,1): daylight for the first 3/4 of the cycle, night for the last quarter.
export const sunDir = new THREE.Vector3(0, 1, 0), moonDir = new THREE.Vector3(0, 1, 0);
// (the island is the same every game: Olympos stands at about (350, -1020) and the storm-sealed marsh's middle at about
// (-830, 865), so the mountain-to-storm line points (-0.53, 0.85) in x, z. The sun rises square to it, on the left of
// someone facing the storm, and leans at noon towards the mountain)
const SUN_RISE = new THREE.Vector2(0.848, 0.53), SUN_LEAN = new THREE.Vector2(0.53, -0.848);
const skyDay = new THREE.Color(0xa9cfe8), skyDusk = new THREE.Color(0xf0a070), skyNight = new THREE.Color(0x0e1c3e);   // (night: a moonlit navy, so trees and hills stand dark against it)
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
export const LIGHT = { day: 1, dusk: 0, night: 0, elev: 1 };   // shared with water, weather, fog
export function isNight(t) { return t >= DAY_FRACTION; }
// elevation of the sun: 0 at sunrise, 1 at noon, 0 at sunset; through the night it only dips a little below the
// horizon, so dusk and dawn are long, slow twilights instead of a sudden drop into darkness
function sunElevation(t) { return t < DAY_FRACTION ? Math.sin(Math.PI * t / DAY_FRACTION) : -0.42 * Math.sin(Math.PI * (t - DAY_FRACTION) / (1 - DAY_FRACTION)); }
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
export const lightDir = new THREE.Vector3(0, 1, 0);   // where the shadows come from: the sun, handing over smoothly to the moon
export function updateSky(t, dt, time, overcast = 0, dark = 0) {
  const e = sunElevation(t), dayArc = t < DAY_FRACTION ? t / DAY_FRACTION : 1 + (t - DAY_FRACTION) / (1 - DAY_FRACTION);   // 0..1 across the day, 1..2 across the night
  const day = sstep(-0.14, 0.4, e), dusk = sstep(0.42, 0.04, Math.abs(e - 0.04)) * (t < DAY_FRACTION ? 1 : 0.75), night = sstep(0.02, -0.34, e);
  LIGHT.day = day; LIGHT.dusk = dusk; LIGHT.night = night; LIGHT.elev = e;
  // The sun crosses square to the line from Olympos to Zeus's storm (SUN_RISE), so it never sinks behind either: facing the
  // storm with the mountain at your back it rises on your left and sets on your right, leaning a little towards Olympos at
  // noon (SUN_LEAN); the moon goes the same way round, leaning towards the storm
  const az = dayArc * Math.PI, mz = Math.cos((dayArc - 1) * Math.PI), y = Math.max(e, -0.3);
  sunDir.set(SUN_RISE.x * Math.cos(az) + SUN_LEAN.x * 0.2, y, SUN_RISE.y * Math.cos(az) + SUN_LEAN.y * 0.2).normalize();
  moonDir.set(-SUN_RISE.x * mz - SUN_LEAN.x * 0.4, Math.max(0.3, night * 0.75 + 0.15), -SUN_RISE.y * mz - SUN_LEAN.y * 0.4).normalize();
  const swap = sstep(0.06, -0.12, e); LIGHT.moon = swap > 0.5; lightDir.copy(sunDir).lerp(moonDir, swap).normalize(); if (lightDir.y < 0.08) { lightDir.y = 0.08; lightDir.normalize(); }
  const skyCol = _c1.copy(skyNight).lerp(skyDay, day).lerp(skyDusk, dusk * 0.55);
  scene.fog.color.copy(skyCol); scene.background = skyCol;
  // the light fades right down while the shadows hand over from the sun to the moon, so they never swing across the ground
  sun.intensity = lerp(0.15 + day * 2.9, 0.55, night) * (1 - overcast * 0.8) * (1 - dark * 0.75) * (1 - 0.92 * 4 * swap * (1 - swap));
  sun.color.setHex(0xffe2b0).lerp(_c2.setHex(0xffa060), dusk * 0.85).lerp(_c2.setHex(0xff6a38), sstep(0.16, 0.0, e) * (t < DAY_FRACTION ? 0.7 : 0)).lerp(_c2.setHex(0x9fb8ff), night);
  // morning mist: thick at first light, burning off through the morning; a little at dusk and through the night
  LIGHT.mist = (t < DAY_FRACTION ? sstep(0.17, 0.0, t) + sstep(0.62, 0.75, t) * 0.25 : 0.35 + sstep(0.85, 1, t) * 0.5) * (1 - overcast * 0.4);
  // the night (the light study): a cool blue moonlight and sky light, dark but readable, so a fire is the only warm light
  hemi.intensity = (0.22 + day * 0.45 + night * 0.28) * (1 - overcast * 0.5) * (1 - dark * 0.45);
  hemi.color.setHex(0xbfdcff).lerp(_c2.setHex(0x4c6cc4), night); hemi.groundColor.setHex(0x3f6a5a).lerp(_c2.setHex(0x182440), night);
  const U = skyDome.material.uniforms;
  U.top.value.copy(skyNight).lerp(_c2.setHex(0x3a78c8), day).lerp(_c2.setHex(0x6a6fae), dusk * 0.4);
  U.hor.value.setHex(0x203560).lerp(_c2.setHex(0xb8dcf0), day).lerp(_c2.setHex(0xf2b27a), dusk * 0.7);
  U.sunDir.value.copy(sunDir); U.night.value = night; U.uT.value = time; U.moonDir.value.copy(moonDir); U.dusk.value = dusk * (1 - overcast * 0.8); U.cover.value = sstep(0.4, 0.9, overcast);
  U.sunCol.value.copy(sun.color).lerp(_c2.setHex(0xfff0c8), 0.4); U.glowCol.value.setHex(0xff8a40).lerp(_c2.setHex(0xff5a50), sstep(0.1, -0.05, e));
  skyDome.position.copy(camera.position);
  sky.material.uniforms.sunPosition.value.copy(sunDir);
  renderer.toneMappingExposure = lerp(0.56, 0.84, day) * (1 - overcast * 0.3) * (1 - dark * 0.25);
  // the sky's light for reflections and ambient, re-baked in small steps whenever the sun has moved (at most four times a
  // second), rather than a jump every two seconds that showed at dawn and dusk and when time runs fast
  envTimer -= dt; if (envTimer <= 0 && (Math.abs(e - envE) > 0.004 || Math.abs(overcast - envOv) > 0.03 || envTimer < -6)) { envTimer = 0.25; envE = e; envOv = overcast; refreshEnvironment(); }
  scene.environmentIntensity = lerp(0.15, 1, day) * (1 - overcast * 0.65) * (1 - dark * 0.4);
  return { day, dusk, night };
}
// How thick the fog is for hiding the sky: 0 for any rainy sky's mist, 1 once you see only a few tens of metres
export function fogThick() { const f = Math.min(1, Math.max(0, (1 - scene.fog.far / 1400 - 0.86) / 0.11)); return f * f * (3 - 2 * f); }
// In mist the sky melts into the fog: pull the dome's colours towards the fog colour by k (0..1)
export function fogSky(k) {
  // a thick fog (you see a few tens of metres) hides the sky altogether: the dome all fog, no clouds above it (they're
  // drawn without fog); a rainy sky's mist, much thinner, keeps them
  const thick = fogThick();
  if (k <= 0) return; const U = skyDome.material.uniforms;
  U.hor.value.lerp(scene.fog.color, k); U.top.value.lerp(scene.fog.color, k * (0.92 + 0.08 * thick));
}
