// The animation viewer's stage: the asset browser's field (look.js: the game's noon light, sky and grass, a 1 m / 10 m
// grid) with a few things to walk on beside the middle, where the hero stands: a flight of six steps up to a landing and
// a ramp down from it (stairs and foot IK), two slopes side by side (15° and 30°), and a kerb to step up onto. Each has a
// 1 m grid of its own, finer on the risers, for judging heights. ground(x, z, y) is what a foot would stand on there, as
// the game's player.groundHere: the highest surface no more than a step above y.
import * as THREE from 'three';

const STEP = 0.55;   // (how high a foot reaches up onto something, as footik.js MAX_LIFT)
const parts = [];    // { box: [x0, x1, z0, z1], h(x, z) }

// Stone with a metre grid drawn from where each point is in the world (the faces' own UVs know nothing of metres):
// lines on the two axes along each face, and a faint line every 10 cm up the risers
const stone = new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.92, metalness: 0 });
stone.onBeforeCompile = (s) => {
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
    varying vec3 vWP; varying vec3 vWN;
    float gl1(float v, float s) { float c = v / s, w = fwidth(c); return 1.0 - min(abs(fract(c - 0.5) - 0.5) / max(w, 1e-4), 1.0); }`)
    .replace('#include <map_fragment>', `#include <map_fragment>
    { vec3 n = abs(vWN); float a = 0.0, b = 0.0;
      if (n.y > 0.7) { a = max(gl1(vWP.x, 1.0), gl1(vWP.z, 1.0)); b = max(gl1(vWP.x, 0.25), gl1(vWP.z, 0.25)); }
      else if (n.x > n.z) { a = max(gl1(vWP.z, 1.0), gl1(vWP.y, 1.0)); b = gl1(vWP.y, 0.1); }
      else { a = max(gl1(vWP.x, 1.0), gl1(vWP.y, 1.0)); b = gl1(vWP.y, 0.1); }
      diffuseColor.rgb *= 1.0 - 0.45 * a - 0.14 * b * (1.0 - a); }`);
};
stone.customProgramCacheKey = () => 'animStageStone';
const edgeMat = new THREE.LineBasicMaterial({ color: 0x2c2822, transparent: true, opacity: 0.5 });

function mesh(group, geo) {
  const m = new THREE.Mesh(geo, stone); m.castShadow = true; m.receiveShadow = true; group.add(m);
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat));
  return m;
}
// a box standing on the ground: x from x0 to x1, z from z0 to z1, h high
function block(group, x0, x1, z0, z1, h) {
  mesh(group, new THREE.BoxGeometry(x1 - x0, h, z1 - z0).translate((x0 + x1) / 2, h / 2, (z0 + z1) / 2));
  parts.push({ box: [x0, x1, z0, z1], h: () => h });
}
// a ramp from z0 (on the ground) to z1, rising to h there (or falling, h < 0: from -h at z0 down to the ground at z1)
function ramp(group, x0, x1, z0, z1, h) {
  const up = h > 0, H = Math.abs(h), L = z1 - z0, s = new THREE.Shape();
  if (up) s.moveTo(0, 0).lineTo(L, 0).lineTo(L, H).closePath(); else s.moveTo(0, 0).lineTo(L, 0).lineTo(0, H).closePath();
  // (the profile drawn along z, up y, made thick along x)
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(x1, 0, z0);
  mesh(group, g);
  parts.push({ box: [x0, x1, z0, z1], h: (x, z) => H * (up ? (z - z0) / L : (z1 - z) / L) });
}

export function buildStage(scene) {
  const g = new THREE.Group(); g.name = 'stage'; scene.add(g);
  // the stairs, to the hero's left (+x), climbing away (-z): six steps of 17 by 30 cm, a landing, a 20° ramp back down
  const rise = 0.17, run = 0.3, n = 6, x0 = 3, x1 = 5.4, front = 0.5, top = front - n * run, land = 2;
  for (let i = 0; i < n; i++) block(g, x0, x1, front - (i + 1) * run, front - i * run, (i + 1) * rise);
  block(g, x0, x1, top - land, top, n * rise);
  const down = n * rise / Math.tan(THREE.MathUtils.degToRad(20)); ramp(g, x0, x1, top - land - down, top - land, n * rise);
  // the slopes, to his right (-x), climbing away: 15° and 30°, to 1.2 m, each with a flat top
  for (const [a, xa, xb] of [[15, -5.4, -3.6], [30, -3.4, -1.6]]) {
    const H = 1.2, L = H / Math.tan(THREE.MathUtils.degToRad(a)), z0 = -1, z1 = z0 - L;
    ramp(g, xa, xb, z1, z0, -H); block(g, xa, xb, z1 - 1.5, z1, H);
  }
  // a kerb behind him, a stride's height
  block(g, -1, 1.5, -3.2, -2.8, 0.25);
  return g;
}

// The height of what a foot at (x, z), at about height y, would stand on
export function groundAt(x, z, y = 0) {
  let best = 0;
  for (const p of parts) { const [a, b, c, d] = p.box; if (x < a || x > b || z < c || z > d) continue; const h = p.h(x, z); if (h <= y + STEP && h > best) best = h; }
  return best;
}
// The top of whatever is at (x, z), however high (a wall the body can't walk into)
export function topAt(x, z) {
  let best = 0;
  for (const p of parts) { const [a, b, c, d] = p.box; if (x >= a && x <= b && z >= c && z <= d) best = Math.max(best, p.h(x, z)); }
  return best;
}
export const STEP_UP = STEP;
