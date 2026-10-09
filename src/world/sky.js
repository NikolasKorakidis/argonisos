// Sky and time of day. One in-game day lasts 32 real minutes: 24 of daylight and 8 of night (the GDD's cycle).
// The dome shader paints the day gradient and sun, and at night a starfield with the Milky Way, a cratered moon
// and, on some nights, aurora curtains. A physical-sky copy lights reflections; clouds drift with the wind.
import * as THREE from 'three';
import { Sky } from '../../jsm/objects/Sky.js';
import { scene, camera, renderer, sun, hemi } from '../render/core.js';

export const DAY_SECONDS = 32 * 60, DAY_FRACTION = 24 / 32;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;

export const skyDome = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x3a78c8) }, hor: { value: new THREE.Color(0xb8dcf0) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(0xfff0c8) },
    night: { value: 0 }, uT: { value: 0 }, moonDir: { value: new THREE.Vector3(0, 1, 0) }, aurora: { value: 0 } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol, moonDir; uniform float night, uT, aurora; varying vec3 vDir;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
    float stars(vec3 d, float scale, float thr){ vec2 uv = vec2(atan(d.z, d.x) * scale, asin(clamp(d.y, -1.0, 1.0)) * scale); vec2 id = floor(uv), f = fract(uv) - 0.5;
      float h = h21(id); if (h < thr) return 0.0; vec2 o = vec2(h21(id + 3.1), h21(id + 7.7)) - 0.5; float r = length(f - o * 0.6);
      float tw = 0.65 + 0.35 * sin(uT * (1.5 + h * 4.0) + h * 60.0); return smoothstep(0.09, 0.0, r) * tw * (h - thr) / (1.0 - thr); }
    void main(){
      vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
      vec3 c = mix(hor, top, pow(h, 0.55));
      float s = max(dot(d, normalize(sunDir)), 0.0);
      c += sunCol * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.25) * (1.0 - night);
      if (night > 0.01 && d.y > -0.05) {
        float up = smoothstep(-0.02, 0.25, d.y);
        // Milky Way: a soft, mottled band across the sky with extra dense stars inside it
        vec3 N = normalize(vec3(0.35, 0.55, 0.76)); float band = exp(-pow(dot(d, N) / 0.2, 2.0));
        float neb = vn(d.xz * 9.0 + d.y * 4.0) * 0.6 + vn(d.xz * 23.0) * 0.4;
        c += vec3(0.55, 0.6, 0.85) * band * (0.08 + neb * 0.16) * night * up;
        c -= vec3(0.03) * band * smoothstep(0.55, 0.8, vn(d.xz * 14.0)) * night;                      // dust lanes
        float st = stars(d, 160.0, 0.93) * 1.2 + stars(d, 320.0, 0.955) * 0.8 + stars(d, 320.0, 0.9) * band * 1.2;
        c += vec3(0.95, 0.97, 1.0) * st * night * up;
        // moon: disc with maria, a tight glow and a wide halo
        float m = dot(d, normalize(moonDir));
        vec3 md = normalize(moonDir), mt = normalize(cross(md, vec3(0.0, 1.0, 0.0))), mb = cross(mt, md); vec2 mp = vec2(dot(d, mt), dot(d, mb)) / 0.028;
        float disc = smoothstep(1.0, 0.96, length(mp)) * step(0.0, m);
        float maria = vn(mp * 2.2 + 4.0) * 0.6 + vn(mp * 5.0) * 0.4;
        c = mix(c, vec3(0.92, 0.93, 0.88) * (0.78 + maria * 0.3), disc * night);
        c += vec3(0.55, 0.62, 0.8) * (pow(max(m, 0.0), 900.0) * 0.8 + pow(max(m, 0.0), 40.0) * 0.12) * night;
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
          c += ac * curtain * fade * aurora * night * 0.55;
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
let envRT = null, envTimer = 0;
function refreshEnvironment() { if (envRT) envRT.dispose(); envRT = pmrem.fromScene(envScene, 0.04); scene.environment = envRT.texture; }

// ---- Clouds: soft billboard puffs, high and drifting
const cloudTex = (() => {   // puffs with sunlit tops over grey-blue undersides, so a cloud has a shape rather than a white blot
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'); let s = 11; const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const puffs = []; for (let i = 0; i < 34; i++) { const x = 100 + r() * 312, y = 120 + r() * 70 - Math.sin((x - 100) / 312 * Math.PI) * 60, rad = 34 + r() * 38; puffs.push([x, y, rad]); }
  const blob = (x, y, rad, a, b) => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, a); gr.addColorStop(0.62, a); gr.addColorStop(1, b); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 6.28); g.fill(); };
  for (const [x, y, rad] of puffs) blob(x, y + rad * 0.12, rad, 'rgba(196,206,222,0.95)', 'rgba(196,206,222,0)');
  for (const [x, y, rad] of puffs) blob(x - rad * 0.08, y - rad * 0.3, rad * 0.72, 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0)');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
export const clouds = [], stormClouds = [];
{ let s = 3; const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 70; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, transparent: true, depthWrite: false, opacity: 0.8 + r() * 0.2, color: new THREE.Color(1.3, 1.3, 1.34) }));
    const a = r() * 6.28, d = 300 + r() * 2600, w = 160 + r() * 260;
    sp.scale.set(w, w * 0.5, 1); sp.position.set(Math.cos(a) * d, 300 + r() * 160, Math.sin(a) * d); sp.renderOrder = -1; scene.add(sp); clouds.push(sp);
  }
  for (let i = 0; i < 90; i++) {           // low, heavy rain clouds, shown by the weather
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, transparent: true, depthWrite: false, opacity: 0, color: new THREE.Color(0.42, 0.45, 0.5) }));
    const a = r() * 6.28, d = Math.sqrt(r()) * 1600, w = 300 + r() * 320;
    sp.scale.set(w, w * (0.38 + r() * 0.17), 1); sp.userData = { a, d, o: 0.75 + r() * 0.25, y: 150 + r() * 70 }; sp.visible = false; scene.add(sp); stormClouds.push(sp);
  }
}

// ---- Time of day. t in [0,1): daylight for the first 3/4 of the cycle, night for the last quarter.
export const sunDir = new THREE.Vector3(0, 1, 0), moonDir = new THREE.Vector3(0, 1, 0);
const skyDay = new THREE.Color(0xa9cfe8), skyDusk = new THREE.Color(0xf0a070), skyNight = new THREE.Color(0x0b1630);
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
  const az = dayArc * Math.PI;                                            // the sun crosses from east to west
  sunDir.set(Math.cos(az), Math.max(e, -0.3), -0.35).normalize();
  moonDir.set(-Math.cos((dayArc - 1) * Math.PI), Math.max(0.3, night * 0.75 + 0.15), 0.4).normalize();
  lightDir.copy(sunDir).lerp(moonDir, sstep(0.06, -0.12, e)).normalize(); if (lightDir.y < 0.08) { lightDir.y = 0.08; lightDir.normalize(); }
  const skyCol = _c1.copy(skyNight).lerp(skyDay, day).lerp(skyDusk, dusk * 0.55);
  scene.fog.color.copy(skyCol); scene.background = skyCol;
  sun.intensity = lerp(0.15 + day * 2.9, 0.42, night) * (1 - overcast * 0.8) * (1 - dark * 0.75);
  sun.color.setHex(0xffe2b0).lerp(_c2.setHex(0xffa060), dusk * 0.85).lerp(_c2.setHex(0x9fb8ff), night);
  hemi.intensity = (0.22 + day * 0.45 + night * 0.15) * (1 - overcast * 0.5) * (1 - dark * 0.45);
  hemi.color.setHex(0xbfdcff).lerp(_c2.setHex(0x5a74b8), night); hemi.groundColor.setHex(0x3f6a5a).lerp(_c2.setHex(0x1a2030), night);
  const U = skyDome.material.uniforms;
  U.top.value.copy(skyNight).lerp(_c2.setHex(0x3a78c8), day).lerp(_c2.setHex(0x6a6fae), dusk * 0.4);
  U.hor.value.setHex(0x1a2a48).lerp(_c2.setHex(0xb8dcf0), day).lerp(_c2.setHex(0xf2b27a), dusk * 0.7);
  U.sunDir.value.copy(sunDir); U.night.value = night; U.uT.value = time; U.moonDir.value.copy(moonDir);
  skyDome.position.copy(camera.position);
  sky.material.uniforms.sunPosition.value.copy(sunDir);
  renderer.toneMappingExposure = lerp(0.5, 0.84, day) * (1 - overcast * 0.3) * (1 - dark * 0.25);
  envTimer -= dt; if (envTimer <= 0) { envTimer = 2; refreshEnvironment(); }
  scene.environmentIntensity = lerp(0.15, 1, day) * (1 - overcast * 0.65) * (1 - dark * 0.4);
  // clouds drift with the wind, warm at dusk, dark at night
  const cc = _c1.setRGB(1.3, 1.3, 1.34).lerp(_c2.setRGB(1.6, 0.95, 0.75), dusk * 0.6).lerp(_c2.setRGB(0.1, 0.12, 0.2), night);
  const wind = 2 + overcast * 20;
  for (const c of clouds) { c.position.x += dt * wind; if (c.position.x > 3000) c.position.x = -3000; c.material.color.copy(cc).lerp(_c2.setRGB(0.55, 0.58, 0.64).multiplyScalar(0.4 + day * 0.6), overcast * 0.85); }
  for (const c of stormClouds) {
    c.visible = overcast > 0.02; if (!c.visible) continue;
    c.userData.a += dt * wind * 0.00006;
    c.position.set(camera.position.x + Math.cos(c.userData.a) * c.userData.d, c.userData.y, camera.position.z + Math.sin(c.userData.a) * c.userData.d);
    c.material.opacity = overcast * c.userData.o; c.material.color.setRGB(0.42, 0.45, 0.5).multiplyScalar(0.35 + day * 0.65);
  }
  return { day, dusk, night };
}
// In mist the sky melts into the fog: pull the dome's colours towards the fog colour by k (0..1)
export function fogSky(k) {
  if (k <= 0) return; const U = skyDome.material.uniforms;
  U.hor.value.lerp(scene.fog.color, k); U.top.value.lerp(scene.fog.color, k * 0.92);
}
