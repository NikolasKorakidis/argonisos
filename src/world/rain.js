// Rain (graphics plan 1.3): thousands of thin streaks in a box round the camera, all moved by the GPU (nothing per drop
// on the CPU). Each falls with the wind, stretched along the way it moves and turned to face you; the box wraps round the
// camera so the rain never runs out. A drop is never drawn under a roof or a building (the shelter map in wetness.js),
// only now and then under a tree's crown (leaves let a little through), nor below the ground.
import * as THREE from 'three';
import { scene, camera } from '../render/core.js';
import { WET_U, SHELTER } from './wetness.js';
import { grassU } from './grass.js';

const N = 9000, BOX = 40, H = 24;
export const RAIN_U = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uAmount: { value: 0 }, uWind: { value: new THREE.Vector2(3, 1) },
  uFall: { value: 9 }, uLight: { value: 1 }, uColor: { value: new THREE.Color(0xc2cbd6) } };
const geo = new THREE.InstancedBufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3)); geo.setIndex([0, 1, 2, 0, 2, 3]);
const seed = new Float32Array(N * 4); for (let i = 0; i < N * 4; i++) seed[i] = Math.random();
geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4)); geo.instanceCount = N;
const mat = new THREE.ShaderMaterial({
  uniforms: { ...RAIN_U, ...WET_U, uHeight: grassU.uHeight, uOrigin: grassU.uOrigin, uSize: grassU.uSize },
  transparent: true, depthWrite: false,
  vertexShader: `${SHELTER}
    uniform vec3 uCam; uniform float uTime, uAmount, uFall; uniform vec2 uWind; uniform sampler2D uHeight; uniform vec2 uOrigin; uniform float uSize;
    attribute vec4 aSeed; varying float vA, vT;
    void main() {
      vA = 0.0; vT = position.y; gl_Position = vec4(0.0, 0.0, -2.0, 1.0);   // (hidden: behind the near plane)
      if (aSeed.w > uAmount) return;                                          // light rain draws fewer drops
      float fall = uFall * (0.85 + aSeed.w * 0.3);
      vec3 v = vec3(uWind.x, -fall, uWind.y);
      // where the drop is now: falling through the box, carried by the wind, the box wrapped round the camera
      float y = fract(aSeed.y - uTime * fall / ${H.toFixed(1)}) * ${H.toFixed(1)} - ${(H * 0.4).toFixed(1)};
      vec2 xz = aSeed.xz * ${BOX.toFixed(1)} + uWind * uTime;
      xz = uCam.xz + mod(xz - uCam.xz, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)};
      vec3 p = vec3(xz.x, uCam.y + y, xz.y);
      // never inside: under a roof, mostly not under a crown, not below the ground
      if (p.y < coverTop(uShelter, p.xz) + 0.05) return;
      if (p.y < coverTop(uCanopy, p.xz) + 0.05 && aSeed.w > 0.2) return;
      vec2 huv = (p.xz - uOrigin) / uSize;
      if (huv.x > 0.0 && huv.y > 0.0 && huv.x < 1.0 && huv.y < 1.0 && p.y < texture2D(uHeight, huv).r) return;
      // a streak along the way it moves, turned to face the camera; thicker further off so it doesn't flicker
      float d = distance(p, cameraPosition), len = 0.5 + fall * 0.03;
      vec3 ax = normalize(v), side = normalize(cross(ax, normalize(p - cameraPosition))) * (0.007 + d * 0.0011);
      vec3 w = p - ax * len * position.y + side * position.x;
      vA = (1.0 - smoothstep(10.0, 20.0, d)) * smoothstep(0.6, 2.0, d) * (0.55 + aSeed.w * 0.45);   // (faint far off, none in your face)
      gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
    }`,
  fragmentShader: `uniform vec3 uColor; uniform float uLight, uAmount; varying float vA, vT;
    void main() { float a = vA * (1.0 - vT * 0.7) * (0.28 + uAmount * 0.22); if (a < 0.004) discard; gl_FragColor = vec4(uColor * uLight, a); }`,
});
const rain = new THREE.Mesh(geo, mat); rain.frustumCulled = false; rain.visible = false; rain.renderOrder = 2; scene.add(rain);

// amount 0..1, wind (m/s along x and z), light: how bright the air is (day, lightning)
export function updateRain(dt, amount, wind, light) {
  rain.visible = amount > 0.02; if (!rain.visible) return;
  RAIN_U.uTime.value += dt; RAIN_U.uAmount.value = amount; RAIN_U.uCam.value.copy(camera.position);
  RAIN_U.uWind.value.set(wind.x, wind.y); RAIN_U.uLight.value = light;
}
