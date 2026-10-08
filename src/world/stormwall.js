// Zeus's storm wall: Valtos stays sealed this milestone. A curtain of churning storm cloud, shot through with lightning,
// is traced along the marsh border (a contour of the biome field, so it follows the same wiggles as the land), and
// anything that walks into it is pushed back out by the wind.
import * as THREE from 'three';
import { biomeWeights, heightAt, WORLD } from './gen.js';

const WALL_V = 0.3, STEP = 12, HEIGHT = 150;
const _w = { p: 0, y: 0, v: 0, r: 0 };
const vAt = (x, z) => biomeWeights(x, z, _w).v;

export const STORM_WALL = { open: false, mesh: null };
// How far inside the wall a point is (0 outside, rising to 1 a few metres in): the player controller pushes back by this
export function stormWallDepth(x, z) { if (STORM_WALL.open) return 0; return Math.min(1, Math.max(0, (vAt(x, z) - WALL_V) / 0.08)); }
// Direction out of the storm (towards lower Valtos weight), for the push-back
export function stormWallOut(x, z, out = new THREE.Vector2()) {
  const e = 3, gx = vAt(x + e, z) - vAt(x - e, z), gz = vAt(x, z + e) - vAt(x, z - e), l = Math.hypot(gx, gz) || 1;
  return out.set(-gx / l, -gz / l);
}

// Marching squares over the biome field: one line segment per crossing cell
function traceBorder() {
  const L = WORLD.R * 1.25, N = Math.ceil((L * 2) / STEP) + 1, f = new Float32Array(N * N), segs = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) f[j * N + i] = vAt(-L + i * STEP, -L + j * STEP) - WALL_V;
  const cross = (a, b, xa, za, xb, zb) => { const t = a / (a - b); return [xa + (xb - xa) * t, za + (zb - za) * t]; };
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    const a = f[j * N + i], b = f[j * N + i + 1], c = f[(j + 1) * N + i + 1], d = f[(j + 1) * N + i];
    const x0 = -L + i * STEP, z0 = -L + j * STEP, x1 = x0 + STEP, z1 = z0 + STEP, pts = [];
    if ((a > 0) !== (b > 0)) pts.push(cross(a, b, x0, z0, x1, z0));
    if ((b > 0) !== (c > 0)) pts.push(cross(b, c, x1, z0, x1, z1));
    if ((c > 0) !== (d > 0)) pts.push(cross(c, d, x1, z1, x0, z1));
    if ((d > 0) !== (a > 0)) pts.push(cross(d, a, x0, z1, x0, z0));
    for (let k = 0; k + 1 < pts.length; k += 2) segs.push(pts[k], pts[k + 1]);
  }
  return segs;
}

export function buildStormWall(scene) {
  const segs = traceBorder(), pos = [], base = [], idx = [];
  for (let s = 0; s < segs.length; s += 2) {
    const [ax, az] = segs[s], [bx, bz] = segs[s + 1], ya = Math.max(heightAt(ax, az), -2) - 6, yb = Math.max(heightAt(bx, bz), -2) - 6, n = pos.length / 3;
    pos.push(ax, ya, az, bx, yb, bz, bx, yb + HEIGHT, bz, ax, ya + HEIGHT, az); base.push(0, 0, 1, 1);
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aUp', new THREE.Float32BufferAttribute(base, 1)); geo.setIndex(idx);
  geo.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uDay: { value: 1 } }]),
    vertexShader: `attribute float aUp; varying float vUp; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vUp = aUp; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uT, uDay; varying float vUp; varying vec3 vW;
      #include <fog_pars_fragment>
      float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
      float fbm(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * vn(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }
      void main(){
        vec3 p = vW * 0.018; float t = uT;
        // cloud rolls upwards and sideways, churning on itself
        vec3 q = vec3(p.x + t * 0.05, p.y - t * 0.11, p.z - t * 0.04);
        float n = fbm(q + fbm(q * 1.7 + t * 0.03) * 1.4);
        float dens = smoothstep(0.32, 0.72, n);
        // a dense foot at the ground, thinning and fraying towards the top
        float a = (0.84 + 0.16 * dens) * smoothstep(0.0, 0.08, vUp) * (1.0 - smoothstep(0.7, 1.0, vUp) * (1.0 - dens * 0.7));
        // up close it parts like mist rather than ending in a hard sheet
        float d = length(cameraPosition - vW); a *= smoothstep(1.5, 18.0, d);
        float rim = smoothstep(0.45, 0.8, fbm(q * 2.3 - t * 0.02));                                    // lit edges of the billows
        vec3 col = (mix(vec3(0.010, 0.012, 0.02), vec3(0.06, 0.065, 0.085), dens) + vec3(0.1, 0.105, 0.12) * rim * dens) * mix(0.35, 1.0, uDay);
        // lightning: patches of the wall light up from inside for a moment
        vec2 cell = floor(vW.xz / 90.0 + vec2(floor(vW.y / 60.0)));
        float strike = step(0.996, h31(vec3(cell, floor(t * 6.0)))) * (0.6 + 0.4 * sin(t * 90.0));
        col += vec3(0.45, 0.55, 0.9) * strike * dens * 1.2;
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.97));
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.name = 'stormWall';
  scene.add(mesh); STORM_WALL.mesh = mesh;
  return mesh;
}
export function updateStormWall(time, light) {
  const m = STORM_WALL.mesh; if (!m) return;
  m.visible = !STORM_WALL.open; m.material.uniforms.uT.value = time; m.material.uniforms.uDay.value = 0.25 + light.day * 0.75;
}
