// Light on the lens, and light in the fog. Folded into the bloom's last step (the one that adds its blurred mips
// together, at half resolution), so it costs no pass of its own; on Low and Medium, without bloom, it is off.
//   Lens dirt (Valheim's): soft stains on the "lens", blotches, smears and a few rings, lit by the sun's glare when
//   you look towards it: faint on a clear day, stronger when the sun is veiled by fog, the morning mist or a forest's
//   haze and the whole air round it glows. Only where there is bright light behind them (the sky, the lit fog), never
//   over a dark trunk; fading as you turn away from the sun. The stains are drawn once, at load, into a texture.
//   Sunlit fog: the fog in front of you brighter and warmer towards the sun, as real fog is (three's own fog is one
//   colour all round).
//   Fire in the fog: a soft halo round each fire, brazier and torch the light pool lights (lights.js), wider and
//   brighter the thicker the fog, dimmed where something stands in front of the flame.
// Its strength follows the graphics preset (High as it is, Ultra a little richer) and is gentler with Reduce flashing.
// weather.js sets how much daylight there is and how veiled the sun is (LENS); nothing here moves with time, so the
// screenshot tests' S.still needs nothing of its own.
import * as THREE from 'three';
import { seeded } from '../util/math.js';

export const LENS = { day: 1, veil: 0, calm: false, k: { low: 0, medium: 0, high: 1, ultra: 1.3 } };
const NL = 6;   // (as many lights as the pool can have: lights.js)

// The stains: a wide soft mottle, blobs of every size, smears dragged across the glass, rings and a dusting of specks,
// brighter towards the edges of the frame, where a lens gathers its dirt. One channel, soft enough for half resolution.
function dirtTexture() {
  const W = 512, H = 288, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), r = seeded(9137); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const blob = (x, y, rx, ry, a, rot = 0, ring = false) => {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx), v = (k) => `rgba(255,255,255,${(a * k).toFixed(3)})`;
    if (ring) { gr.addColorStop(0, v(0.15)); gr.addColorStop(0.62, v(0.25)); gr.addColorStop(0.82, v(1)); gr.addColorStop(1, v(0)); }
    else { gr.addColorStop(0, v(1)); gr.addColorStop(0.45, v(0.6)); gr.addColorStop(1, v(0)); }
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
  };
  const edge = (x, y) => 0.45 + 0.55 * Math.min(1, Math.hypot((x / W - 0.5) * 1.6, y / H - 0.5) * 1.6);   // (more dirt towards the frame's edges)
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) { const x = r() * W, y = r() * H; blob(x, y, 70 + r() * 90, 50 + r() * 70, 0.05 + r() * 0.05, r() * 3); }
  for (let i = 0; i < 46; i++) { const x = r() * W, y = r() * H, s = 4 + Math.pow(r(), 2) * 34; blob(x, y, s, s * (0.75 + r() * 0.25), (0.1 + r() * 0.3) * edge(x, y), r() * 3); }
  for (let i = 0; i < 12; i++) { const x = r() * W, y = r() * H, l = 24 + r() * 80; blob(x, y, l, l * (0.1 + r() * 0.15), (0.06 + r() * 0.12) * edge(x, y), r() * Math.PI); }
  for (let i = 0; i < 7; i++) { const x = r() * W, y = r() * H, s = 9 + r() * 22; blob(x, y, s, s, (0.08 + r() * 0.1) * edge(x, y), 0, true); }
  for (let i = 0; i < 140; i++) { const x = r() * W, y = r() * H; blob(x, y, 0.8 + r() * 2.2, 0.8 + r() * 2.2, (0.2 + r() * 0.5) * edge(x, y)); }
  const t = new THREE.CanvasTexture(c); t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; return t;
}

const PARS = `uniform sampler2D tDirt, tScene, tDepth; uniform mat4 projInv, camWorld; uniform vec2 camNF, fogNF, sunUV, sceneTexel; uniform vec3 sunDir, sunTint, fogCol;
  uniform float aspect, dirtSun, dirtBloom, fogGlow, halo; uniform vec4 lights[${NL}]; uniform vec3 lightCol[${NL}];
  float lensLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  float lensLinD(float d) { return camNF.x * camNF.y / (camNF.y - d * (camNF.y - camNF.x)); }
  vec3 lensLight() {
    vec3 add = vec3(0.0); float d = texture2D(tDepth, vUv).x, sky = step(0.99999, d), z = sky > 0.5 ? 1e5 : lensLinD(d);
    // the sun through the fog: forward-scattered, a wide glow and a tighter one round the sun, on what the fog covers
    if (fogGlow > 0.0) {
      vec4 v = projInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec3 rd = normalize(mat3(camWorld) * (v.xyz / v.w));
      float toSun = max(dot(rd, sunDir), 0.0), fogA = sky > 0.5 ? 1.0 : smoothstep(fogNF.x, fogNF.y, z);
      add += sunTint * lensLum(fogCol) * fogA * fogGlow * (pow(toSun, 3.0) * 0.22 + pow(toSun, 16.0) * 0.6);
    }
    // fires in the fog: a soft halo round each, dimmed where the flame itself is hidden or something stands before it
    if (halo > 0.0) for (int i = 0; i < ${NL}; i++) { vec4 L = lights[i]; if (L.w <= 0.0) continue;
      float r = length((vUv - L.xy) * vec2(aspect, 1.0)), h = exp(-r / L.w) * 0.55 + exp(-r / (L.w * 0.25)) * 0.45;
      vec2 at = clamp(L.xy, 0.0, 1.0); float seen = mix(0.35, 1.0, step(L.z - 0.8, lensLinD(texture2D(tDepth, at).x)));
      add += lightCol[i] * h * seen * mix(0.3, 1.0, smoothstep(L.z - 2.5, L.z, z)) * halo; }
    // the stains on the lens, lit by the bloom's widest light and by the sun's glare near it on the screen, only where the
    // picture behind them is bright
    if (dirtSun + dirtBloom > 0.0) {
      float dirt = texture2D(tDirt, vUv).r;
      if (dirt > 0.002) {
        vec3 s = texture2D(tScene, vUv + sceneTexel * vec2(6.0, 4.0)).rgb + texture2D(tScene, vUv - sceneTexel * vec2(6.0, 4.0)).rgb
          + texture2D(tScene, vUv + sceneTexel * vec2(-4.0, 6.0)).rgb + texture2D(tScene, vUv - sceneTexel * vec2(-4.0, 6.0)).rgb;
        float bright = smoothstep(0.12, 0.7, lensLum(s) * 0.25);
        vec3 wide = texture2D(blurTexture4, vUv).rgb * 0.6 + texture2D(blurTexture5, vUv).rgb;
        float nearSun = exp(-length((vUv - sunUV) * vec2(aspect, 1.0)) * 1.6);
        add += dirt * (wide * dirtBloom + sunTint * nearSun * bright * dirtSun);
      }
    }
    return add;
  }
`;

const _f = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
// Fit it into the bloom (core.js): its compositing shader gains lensLight(), added on top of the bloom (the bloom's sum is
// laid over the picture weighed by its own alpha, so ours is divided by it to come out at its own strength)
export function fitLens(bloom, { camera, scene, atmo, gfx }) {
  const M = bloom.compositeMaterial, A = atmo;
  const U = { tDirt: { value: dirtTexture() }, tScene: { value: null }, tDepth: A.tDepth, projInv: A.projInv, camWorld: A.camWorld, camNF: A.camNF, sunUV: A.sunUV, sunDir: A.sunDir,
    fogNF: { value: new THREE.Vector2() }, sceneTexel: { value: new THREE.Vector2() }, sunTint: { value: new THREE.Color() }, fogCol: { value: new THREE.Color() },
    aspect: { value: 1 }, dirtSun: { value: 0 }, dirtBloom: { value: 0 }, fogGlow: { value: 0 }, halo: { value: 0 },
    lights: { value: Array.from({ length: NL }, () => new THREE.Vector4()) }, lightCol: { value: Array.from({ length: NL }, () => new THREE.Vector3()) } };
  Object.assign(M.uniforms, U);
  M.fragmentShader = M.fragmentShader.replace('void main()', PARS + 'void bloomMain()') + `
    void main() { bloomMain(); vec4 b = gl_FragColor; gl_FragColor = vec4(b.rgb + lensLight() / max(b.a, 1e-3), b.a); }`;
  M.needsUpdate = true;
  let pool = null; const draw = bloom.render;
  bloom.render = function (renderer, writeBuffer, readBuffer, ...rest) {
    pool ??= scene.children.filter((o) => o.isPointLight);
    const k = (LENS.k[gfx.level] ?? 1) * (LENS.calm ? 0.6 : 1), fog = scene.fog, day = LENS.day, veil = Math.min(1, LENS.veil);
    U.tScene.value = readBuffer.texture; U.sceneTexel.value.set(1 / readBuffer.width, 1 / readBuffer.height); U.aspect.value = readBuffer.width / readBuffer.height;
    U.fogNF.value.set(fog.near, fog.far); U.fogCol.value.copy(fog.color);
    // (the sun's hue, at full brightness: the light it gives the ground is dimmed in fog, but its glare isn't)
    _c.copy(A.sunCol.value); const top = Math.max(_c.r, _c.g, _c.b, 1e-4); U.sunTint.value.copy(_c.multiplyScalar(1 / top));
    camera.getWorldDirection(_f); const ahead = _f.dot(A.sunDir.value), facing = THREE.MathUtils.smoothstep(ahead, -0.15, 0.85);
    const thick = 1 - THREE.MathUtils.smoothstep(fog.far, 14, 220);   // (how thick the air is: 1 in a fog, nothing in the meadows' haze)
    U.dirtSun.value = k * day * facing * facing * (0.12 + 0.65 * veil * Math.max(veil, thick));
    U.dirtBloom.value = k * 0.5;
    U.fogGlow.value = k * day * thick * (LENS.calm ? 0.7 : 1);
    // the lights, where they are on the screen and how far off, their halo's radius on the screen (a few metres across
    // in the fog), and their colour; those behind the camera are left out
    U.halo.value = k * Math.max(thick, veil * 0.3); let n = 0;
    for (const L of pool) { if (n >= NL) break; if (!(L.intensity > 0)) continue;
      _p.copy(L.position).applyMatrix4(camera.matrixWorldInverse); const z = -_p.z; if (z < 0.3) continue;
      _p.applyMatrix4(camera.projectionMatrix); const rad = Math.min(0.6, (1.2 + 2.2 * thick) * camera.projectionMatrix.elements[5] * 0.5 / z);
      U.lights.value[n].set(_p.x * 0.5 + 0.5, _p.y * 0.5 + 0.5, z, rad); U.lightCol.value[n].set(L.color.r, L.color.g, L.color.b).multiplyScalar(L.intensity * 0.018 * Math.min(1, 9 / z)); n++; }
    for (let i = n; i < NL; i++) U.lights.value[i].w = 0;
    return draw.call(this, renderer, writeBuffer, readBuffer, ...rest);
  };
}
