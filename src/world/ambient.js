// Life in the air round the camera: pollen drifting over the meadows by day, fireflies blinking at dusk and through the
// night, leaves spinning down in the forests, snow blowing off the summit of Olympos. Each is a few hundred soft points,
// moved on the CPU (cheap at this count) and drawn in one call; how many show follows the place, the hour and the weather.
import * as THREE from 'three';
import { scene, renderer } from '../render/core.js';
import { groundAt } from './groundcut.js';

const KINDS = {
  pollen: { n: 260, R: 18, H: 5, size: 0.07, color: [1.0, 0.95, 0.75], add: false },
  firefly: { n: 110, R: 22, H: 2.6, size: 0.16, color: [2.6, 3.2, 1.0], add: true },
  leaf: { n: 160, R: 18, H: 14, size: 0.16, color: [0.42, 0.36, 0.12], add: false },
  snow: { n: 420, R: 20, H: 12, size: 0.1, color: [1.1, 1.12, 1.18], add: false },
};
const systems = {};
let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
for (const [name, K] of Object.entries(KINDS)) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(K.n * 3), a = new Float32Array(K.n);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aA', new THREE.BufferAttribute(a, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Vector3(...K.color) }, uSize: { value: K.size }, uScale: { value: 400 }, uOp: { value: 0 } },
    vertexShader: 'attribute float aA; varying float vA; uniform float uSize, uScale; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(uSize * uScale / max(-mv.z, 0.1), 14.0); vA = aA * smoothstep(0.6, 2.0, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; uniform float uOp; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5), a = smoothstep(0.5, 0.12, d) * vA * uOp; if (a < 0.01) discard; gl_FragColor = vec4(uCol, a); }',
    transparent: true, depthWrite: false, blending: K.add ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 4; scene.add(pts);
  systems[name] = { K, pts, pos, a, vel: new Float32Array(K.n * 3), ph: Float32Array.from({ length: K.n }, () => rnd() * 6.28), init: false };
}
const respawn = (S, i, c, top) => {
  const K = S.K, x = c.x + (rnd() - 0.5) * 2 * K.R, z = c.z + (rnd() - 0.5) * 2 * K.R, g = groundAt(x, z);
  S.pos[i * 3] = x; S.pos[i * 3 + 2] = z; S.pos[i * 3 + 1] = top ? Math.max(g, c.y) + K.H * (0.6 + rnd() * 0.4) : g + 0.3 + rnd() * K.H;
};

// amounts 0..1 per kind; c: the camera position; t: seconds
export function updateAmbient(dt, c, amounts, t) {
  const scale = renderer.domElement.height / 2;
  for (const [name, S] of Object.entries(systems)) {
    const amt = Math.max(0, Math.min(1, amounts[name] || 0)), m = S.pts.material; m.uniforms.uOp.value += (amt - m.uniforms.uOp.value) * Math.min(1, dt * 0.8);
    const op = m.uniforms.uOp.value; S.pts.visible = op > 0.01; if (!S.pts.visible) { S.init = false; continue; }
    m.uniforms.uScale.value = scale;
    const K = S.K, n = K.n, p = S.pos;
    if (!S.init) { for (let i = 0; i < n; i++) respawn(S, i, c, false); S.init = true; }
    for (let i = 0; i < n; i++) {
      let x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2]; const ph = S.ph[i];
      if (name === 'pollen') { x += (0.35 + Math.sin(t * 0.3 + ph) * 0.2) * dt; y += Math.sin(t * 0.9 + ph * 3) * 0.12 * dt; z += Math.cos(t * 0.4 + ph) * 0.15 * dt; S.a[i] = 0.5 + 0.5 * Math.sin(t * 0.5 + ph); }
      else if (name === 'firefly') { x += Math.sin(t * 0.7 + ph * 5) * 0.5 * dt; y += Math.sin(t * 1.1 + ph * 2) * 0.25 * dt; z += Math.cos(t * 0.6 + ph * 3) * 0.5 * dt; S.a[i] = Math.max(0, Math.sin(t * (1.2 + (ph % 1)) + ph * 9)) ** 3; }
      else if (name === 'leaf') { y -= (0.55 + (ph % 1) * 0.4) * dt; x += (Math.sin(t * 1.7 + ph * 4) * 0.6 + 0.25) * dt; z += Math.cos(t * 1.3 + ph * 2) * 0.4 * dt; S.a[i] = 0.9; }
      else { x += (3.5 + Math.sin(t + ph) * 1.5) * dt; y -= (0.6 + (ph % 1) * 0.6) * dt; z += Math.sin(t * 2 + ph * 7) * 0.8 * dt; S.a[i] = 0.85; }
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
      // drifted out of the box round the camera, or fallen to the ground: start again somewhere else in the box
      if (Math.abs(x - c.x) > K.R || Math.abs(z - c.z) > K.R || y < c.y - K.H || y > c.y + K.H * 1.5 || ((name === 'leaf' || name === 'snow') && y < groundAt(x, z))) respawn(S, i, c, name === 'leaf' || name === 'snow');
    }
    S.pts.geometry.attributes.position.needsUpdate = true; S.pts.geometry.attributes.aA.needsUpdate = true;
  }
}
