// The giant forest's air: under the canopy the light dims and turns green, shafts of sun slant down between the trunks,
// and dust drifts in them. Everything follows how deep you stand in the band (titanBand), so it fades in and out as you
// walk; the shafts and dust only exist near you.
import * as THREE from 'three';
import { scene, sun, hemi } from '../render/core.js';
import { titanBand } from './flora.js';
import { groundAt } from './groundcut.js';

const N = 16, R = 26, lerp = (a, b, t) => a + (b - a) * t;
export const GIANTWOOD = { k: 0 };
// a soft vertical gradient for the shafts: bright in the middle, fading along both edges and towards the ends
const shaftTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  for (let y = 0; y < 256; y++) { const v = Math.sin((y / 255) * Math.PI); const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${v})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, y, 64, 1); }
  return new THREE.CanvasTexture(c); })();
const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, color: 0xffe6b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
const shafts = [];
for (let i = 0; i < N; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shaftMat); m.visible = false; m.renderOrder = 3; scene.add(m); shafts.push({ m, x: 0, z: 0, w: 1, life: 0 }); }
const motes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(400 * 3), 3)),
  new THREE.PointsMaterial({ color: 0xfff0c8, size: 0.06, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
motes.frustumCulled = false; scene.add(motes);
const _d = new THREE.Vector3(), _q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// after the sky and weather have set the light for this frame: dim it under the canopy, move the shafts and motes
export function updateGiantwood(dt, pos, cam, lightDir, day) {
  const target = titanBand(pos.x, pos.z); GIANTWOOD.k = lerp(GIANTWOOD.k, target, Math.min(1, dt * 0.8)); const k = GIANTWOOD.k;
  if (k > 0.01) {
    sun.intensity *= 1 - 0.62 * k; hemi.intensity *= 1 - 0.5 * k; scene.environmentIntensity *= 1 - 0.55 * k;
    scene.fog.near *= 1 - 0.6 * k; scene.fog.far *= 1 - 0.55 * k; scene.fog.color.lerp(_c.setRGB(0.16, 0.24, 0.18).multiplyScalar(0.4 + day * 0.6), 0.45 * k);
  }
  const show = k * day * Math.max(0, lightDir.y - 0.1) * 1.4, on = show > 0.02;
  shaftMat.opacity = Math.min(0.22, show * 0.22);
  _d.copy(lightDir).normalize();
  for (const s of shafts) {
    s.m.visible = on; if (!on) continue;
    s.life -= dt; if (s.life <= 0 || Math.hypot(s.x - pos.x, s.z - pos.z) > R * 1.3) { const a = rnd() * 6.28, r = 4 + rnd() * R; s.x = pos.x + Math.cos(a) * r; s.z = pos.z + Math.sin(a) * r; s.w = 0.8 + rnd() * 2.2; s.life = 6 + rnd() * 10; }
    // a long strip along the light, from the canopy (~28 m up) to the ground, turned about its own axis to face you
    const gy = groundAt(s.x, s.z), len = 28 / Math.max(0.3, _d.y), mid = new THREE.Vector3(s.x, gy, s.z).addScaledVector(_d, len / 2);
    s.m.position.copy(mid); s.m.scale.set(s.w, len, 1);
    _q.setFromUnitVectors(UP, _d); s.m.quaternion.copy(_q);
    const toCam = cam.position.clone().sub(mid), axis = _d, side = toCam.addScaledVector(axis, -toCam.dot(axis)).normalize(), local = side.applyQuaternion(_q.clone().invert());
    s.m.rotateY(Math.atan2(local.x, local.z));
  }
  // dust in the light
  motes.material.opacity = Math.min(0.7, k * day * 1.2); motes.visible = motes.material.opacity > 0.02;
  if (motes.visible) { const p = motes.geometry.attributes.position, t = performance.now() * 0.0002;
    for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (Math.abs(x - pos.x) > 14 || Math.abs(z - pos.z) > 14 || y < pos.y - 1 || y > pos.y + 9) { x = pos.x + (rnd() - 0.5) * 28; z = pos.z + (rnd() - 0.5) * 28; y = pos.y + rnd() * 9; }
      p.setXYZ(i, x + Math.sin(t * 7 + i) * 0.004, y + Math.sin(t * 3 + i * 1.7) * 0.003, z + Math.cos(t * 5 + i) * 0.004); }
    p.needsUpdate = true; }
}
const _c = new THREE.Color();
