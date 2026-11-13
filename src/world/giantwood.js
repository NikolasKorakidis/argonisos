// The giant forest's air: under the canopy the light dims and turns green, and dust drifts in it. Everything follows how
// deep you stand in the band (titanBand), so it fades in and out as you walk. (Its shafts of sun are the woods' own now,
// atmosphere.js: the billboards that stood here came and went round you and popped in and out of sight.)
import * as THREE from 'three';
import { scene, sun, hemi } from '../render/core.js';
import { titanBand } from './flora.js';

const lerp = (a, b, t) => a + (b - a) * t;
export const GIANTWOOD = { k: 0 };
const motes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(400 * 3), 3)),
  new THREE.PointsMaterial({ color: 0xfff0c8, size: 0.06, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
motes.frustumCulled = false; scene.add(motes);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// after the sky and weather have set the light for this frame: dim it under the canopy, move the motes
export function updateGiantwood(dt, pos, cam, lightDir, day, still = false) {   // (still: screenshot tests, the shade settled at once and the dust held still)
  const target = titanBand(pos.x, pos.z); GIANTWOOD.k = lerp(GIANTWOOD.k, target, still ? 1 : Math.min(1, dt * 0.8)); const k = GIANTWOOD.k;
  if (k > 0.01) {
    sun.intensity *= 1 - 0.62 * k; hemi.intensity *= 1 - 0.5 * k; scene.environmentIntensity *= 1 - 0.55 * k;
    scene.fog.near *= 1 - 0.6 * k; scene.fog.far *= 1 - 0.55 * k; scene.fog.color.lerp(_c.setRGB(0.16, 0.24, 0.18).multiplyScalar(0.4 + day * 0.6), 0.45 * k);
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
