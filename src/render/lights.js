// Fire light. Every point light costs every lit pixel (grass included), so there is one small fixed pool shared by all
// fires, braziers and torches: each frame, sources ask for light and the ones nearest the camera get it. The pool size
// never changes, so shaders never recompile.
import * as THREE from 'three';
import { scene, camera } from './core.js';

const N = 3, pool = [], asks = [];
for (let i = 0; i < N; i++) { const L = new THREE.PointLight(0xffa050, 0, 18, 1.6); L.castShadow = false; scene.add(L); pool.push(L); }
// Ask for light this frame (call every frame while lit)
export function askLight(pos, intensity, distance = 18, color = 0xffa050) { asks.push({ pos, intensity, distance, color, d: pos.distanceToSquared(camera.position) }); }
export function updateLights() {
  asks.sort((a, b) => a.d - b.d);
  pool.forEach((L, i) => { const a = asks[i]; if (!a || a.d > 70 * 70) { L.intensity = 0; return; } L.position.copy(a.pos); L.intensity = a.intensity; L.distance = a.distance; L.color.setHex(a.color); });
  asks.length = 0;
}
