// The hero: the Mixamo-rigged character and its clips. A base layer plays on an AnimationMixer: standing (breathing, the
// guard with a shield, crouched), walking, running and sprinting, backing up and strafing (by the way the legs go against
// the way the hero faces), sneaking, swimming and falling, every cycle kept in step and played at the rate the ground
// goes by. One-shots (jump, strikes, draw / sheathe, the bow, the block, hits, and any action: hero.action) are sampled
// straight from their tracks and blended over it: whole body when standing, upper body only while moving.
import * as THREE from 'three';
import { FootIK } from './footik.js';
import { Cape, CAPE_MODEL } from './cape.js';
import { loadFBX, loadGLB, loadPack, loadTex } from '../assets.js';
import { clamp, lerp, smooth } from '../util/math.js';

const ss = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const UPPER = /Spine|Neck|Head|Shoulder|Arm|Hand/, UPV = new THREE.Vector3(0, 1, 0);
// The bodies to choose from (the character creator, ui/creator.js): Synty's plain man and woman in their underwear, fitted
// onto the Mixamo rig (tools/assets/fbx-page.mjs refit: same bones, same clips), each this tall; the tint takes the
// palette's glare off in our light
// (brows: the man's own are one heavy band that reads as dark glasses: newBrows lays a pair of our own in its place)
export const BODIES = { man: { file: 'hero', height: 1.95, tint: 0xb4aeb4, name: 'Man', brows: true }, woman: { file: 'heroWoman', height: 1.86, tint: 0xb4aeb4, name: 'Woman' } };

// ---- The hero's look, chosen in the character creator and kept with the saved game. Hair, beards and wreaths are
// Synty's (Ancient Empire and Generic: pack/heroLooks, each a part of its own, fitted on the head like the helmets);
// colours are the body's palette recoloured where it shows skin, hair, brows, eyes and cloth (lookMaterial)
// [id, name, colour]: the colour each takes, in sRGB
export const SKINS = [['pale', 'Pale', 0xffd8c0], ['fair', 'Fair', 0xffcbad], ['olive', 'Olive', 0xe0ae84], ['tan', 'Sun-browned', 0xc89068], ['bronze', 'Bronze', 0xa8704c], ['brown', 'Brown', 0x845438], ['dark', 'Dark', 0x5e3c28], ['deep', 'Deep', 0x40281c]];
export const HAIR_COLOURS = [['black', 'Black', 0x1a1614], ['darkBrown', 'Dark brown', 0x30221a], ['brown', 'Brown', 0x4f402c], ['chestnut', 'Chestnut', 0x693a22], ['auburn', 'Auburn', 0x80341e], ['copper', 'Copper', 0xa05228], ['darkBlond', 'Dark blond', 0x8c6c40], ['blond', 'Blond', 0xc4a060], ['grey', 'Grey', 0x8c8882], ['white', 'White', 0xdcd8ce]];
export const EYES = [['brown', 'Brown', 0x2a1a10], ['dark', 'Dark', 0x100c0a], ['hazel', 'Hazel', 0x3a2c14], ['green', 'Green', 0x1e3622], ['blue', 'Blue', 0x1c2e4c], ['grey', 'Grey', 0x30363c]];   // (dark: the eye is a flat little panel, a bright one reads as paint)
export const CLOTHS = [['linen', 'Linen', 0xb8ae9a], ['white', 'White', 0xdcd8d0], ['saffron', 'Saffron', 0xd29628], ['madder', 'Madder red', 0xa02c1e], ['purple', 'Tyrian purple', 0x6a1e48], ['indigo', 'Indigo', 0x2c3a6a], ['olive', 'Olive', 0x66693a], ['umber', 'Umber', 0x6e5034]];
// [id, name, part(s)] (the parts in pack/heroLooks; 'hair' is the Greek warriors' curls, from pack/heroArmour), and whom
// it suits first ('m' / 'f': the creator lists those first for the body chosen, and Randomise picks among them)
const G = (n) => 'SM_Gen_Chr_Attach_' + n, AE = (n) => 'SM_Chr_Hair_' + n;
export const HAIRS = [['none', 'Shaven', null, 'mf'], ['curls', 'Warrior\'s curls', 'hair', 'm'],
  ['m1', 'Cropped', AE('Male_01'), 'm'], ['m2', 'Short', AE('Male_02'), 'm'], ['m4', 'Swept up', AE('Male_04'), 'm'], ['m6', 'Thick crop', AE('Male_06'), 'm'],
  ['m5', 'Shaggy', AE('Male_05'), 'm'], ['m3', 'Tied back', AE('Male_03'), 'mf'], ['m7', 'Balding', AE('Male_07'), 'm'],
  ['g9', 'Slicked back', G('Hair_09'), 'm'], ['g9b', 'Close crop', G('Hair_09_alt'), 'm'], ['g10', 'Brush cut', G('Hair_10'), 'm'], ['g11', 'Neat', G('Hair_11'), 'mf'], ['g6', 'Fringe', G('Hair_06'), 'mf'],
  ['f3', 'Bob', AE('Female_03'), 'f'], ['f1', 'Long waves', AE('Female_01'), 'f'], ['f6', 'Long curls', AE('Female_06'), 'f'], ['f2', 'Gathered up', AE('Female_02'), 'f'], ['f4', 'Bound up', AE('Female_04'), 'f'],
  ['f5', 'Banded', AE('Female_05'), 'f'], ['g5', 'Ribboned', G('Hair_05'), 'f'], ['bun', 'Bun', [G('Hair_09'), G('Bun_01')], 'f'], ['tail', 'Ponytail', [G('Hair_09'), G('Ponytail_01')], 'f'],
  ['g1', 'Long and loose', G('Hair_01'), 'f'], ['g1b', 'Long, parted', G('Hair_01_alt'), 'f'], ['g2', 'Flowing', G('Hair_02'), 'f'], ['g3', 'Long and straight', G('Hair_03'), 'f'],
  ['g4', 'Long and thick', G('Hair_04'), 'f'], ['g7', 'Locks', G('Hair_07'), 'f'], ['g8', 'Wild curls', G('Hair_08'), 'f']];
export const BEARDS = [['none', 'None', null], ['full', 'Full beard', AE('Beard_01')], ['short', 'Short beard', AE('Beard_03')], ['philosopher', 'Philosopher\'s', AE('Beard_04')],
  ['long', 'Long beard', G('Beard_01')], ['trim', 'Trimmed', G('Beard_02')], ['moustache', 'Moustache', G('Moustache_01')], ['whiskers', 'Long whiskers', AE('Beard_02')], ['chops', 'Side whiskers', G('Chops_01')]];
export const WREATHS = [['none', 'None', null], ['laurel', 'Laurel wreath', 'SM_Chr_Attach_Crown_Leaf_01'], ['golden', 'Golden wreath', 'SM_Chr_Attach_Crown_Leaf_02']];
// what can be chosen, in the order the creator shows it
const LOOK_OPTIONS = { skin: SKINS, hair: HAIRS, hairColour: HAIR_COLOURS, beard: BEARDS, eyes: EYES, cloth: CLOTHS, wreath: WREATHS };
// the look before anything is chosen (and for ?play and the tests): the hero as he has always been
const LOOK0 = { body: 'man', skin: 'fair', hair: 'curls', hairColour: 'brown', beard: 'none', eyes: 'brown', cloth: 'linen', wreath: 'none' };
// a look made whole: unknown or missing choices fall back to the first look's (older saves had only a body)
export function normLook(l) {
  const o = { ...LOOK0 }; if (!l) return o;
  if (BODIES[l.body]) o.body = l.body;
  for (const [k, list] of Object.entries(LOOK_OPTIONS)) if (list.some((x) => x[0] === l[k])) o[k] = l[k];
  return o;
}
// A random look for a body: its own hair styles mostly, a beard on half the men, eyes and skin from anywhere
export function randomLook(body = Math.random() < 0.5 ? 'man' : 'woman') {
  const pick = (a) => a[Math.floor(Math.random() * a.length)][0], sex = body === 'man' ? 'm' : 'f';
  const hairs = HAIRS.filter((h) => h[0] !== 'none' && h[3].includes(sex));
  return { body, skin: pick(SKINS), hair: Math.random() < 0.08 ? 'none' : pick(hairs), hairColour: pick(HAIR_COLOURS.slice(0, 8)), beard: body === 'man' && Math.random() < 0.55 ? pick(BEARDS.slice(1)) : 'none',
    eyes: pick(EYES), cloth: pick(CLOTHS), wreath: Math.random() < 0.15 ? pick(WREATHS.slice(1)) : 'none' };
}
const LOOK_PARTS = new Set([...HAIRS, ...BEARDS, ...WREATHS].flatMap((x) => [].concat(x[2] || [])));
const colourOf = (list, id) => (list.find((x) => x[0] === id) || list[0])[2];
const lin = (hex) => new THREE.Color(hex);   // (three keeps colours linear: the palette's are compared there)
// The palette's cells (in the refit model's UVs: u across, v up from the bottom of Synty's Generic_01_A), as Synty's own
// SkinMask / HairMask place them, and the colours they hold, which the chosen ones replace
const BASE = { skin: lin(0xffcbad), hair: lin(0x4f402c), cloth: lin(0xc6c2be), curls: lin(0x3e2616) };   // (curls: the Greek warriors' hair, in their own palette)
// The armour's bare arms and legs (the Greek warriors' palette has its skin in two columns) take the chosen skin too
function armourSkin(m, U) {
  if (!U) return m;
  m.onBeforeCompile = (s) => {
    s.uniforms.uSkin = U.uSkin;
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSkin;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n      if (vMapUv.x > 0.505 && vMapUv.x < 0.575 && vMapUv.y < 0.125) diffuseColor.rgb *= uSkin;');
  };
  m.customProgramCacheKey = () => 'heroArmourSkin'; return m;
}
// The man's brows. The model draws them as one heavy band laid straight across the face, its lower edge down over the
// tops of the eyes: from any way off, band and eyes read as a pair of dark glasses, and the band has too few points to be
// reshaped. So it's folded away (its points drawn together into nothing) and a pair of our own is laid on the face: each
// arched, thicker at the inner end, parted over the nose and clear of the eye below, a strip set just off the skin (found
// by a ray onto the head along its forward axis), on the band's bone and in its cell of the palette (coloured as brows).
// In the head's own units (centimetres, the eyes from 187.9 to 190.7 up and 3.1 to 6.1 out from the middle):
// inner and outer ends out from the middle, the lower edge at the ends, how much higher it rises in the arch, the
// thickness at the inner and outer ends, how far off the skin, how many quads along
const isBrow = (u, v) => v < 0.0156 && u > 0.0938 && u < 0.125;
const BROW = { inner: 1.9, outer: 7.3, low: 191.5, arch: 0.6, thick: [1.4, 0.55], off: 0.2, n: 8 };
function newBrows(head, mat) {
  const g = head.geometry, P = g.attributes.position, UV = g.attributes.uv, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, band = new Set();
  for (let i = 0; i < P.count; i++) if (isBrow(UV.getX(i), UV.getY(i))) band.add(i);
  if (!band.size || !SI) return null;
  const i0 = band.values().next().value, idx = g.index ? g.index.array : Array.from({ length: P.count }, (_, i) => i);
  // the skin straight in front of the band's place: the frontmost of the head's own triangles a ray along -z meets there
  const ray = new THREE.Ray(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), hit = new THREE.Vector3(), tris = [];
  for (let t = 0; t < idx.length; t += 3) if (!band.has(idx[t]) && !band.has(idx[t + 1]) && !band.has(idx[t + 2])) tris.push(idx[t], idx[t + 1], idx[t + 2]);
  const skin = (x, y) => {
    ray.set(a.set(x, y, 60), b.set(0, 0, -1)); let best = null;
    for (let t = 0; t < tris.length; t += 3) {
      a.fromBufferAttribute(P, tris[t]); b.fromBufferAttribute(P, tris[t + 1]); c.fromBufferAttribute(P, tris[t + 2]);
      if (Math.max(a.y, b.y, c.y) < y || Math.min(a.y, b.y, c.y) > y || !ray.intersectTriangle(a, b, c, false, hit) || (best && hit.z <= best.p.z)) continue;
      best = { p: hit.clone(), n: new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3()) }; if (best.n.z < 0) best.n.negate();
    }
    return best && best.p.addScaledVector(best.n, BROW.off) && best;
  };
  const pos = [], nor = [], index = [];
  for (const s of [-1, 1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= BROW.n; j++) {
      const u = j / BROW.n, x = s * (BROW.inner + (BROW.outer - BROW.inner) * u), low = BROW.low + BROW.arch * Math.sin(Math.PI * Math.pow(u, 0.75)), th = BROW.thick[0] + (BROW.thick[1] - BROW.thick[0]) * u * u;
      for (const y of [low, low + th]) { const q = skin(x, y) || { p: new THREE.Vector3(x, y, 0), n: new THREE.Vector3(0, 0, 1) }; pos.push(q.p.x, q.p.y, q.p.z); nor.push(q.n.x, q.n.y, q.n.z); }
      // (each quad turned to face out of the face: the two sides run opposite ways along x)
      if (j) { const [b0, t0, b1, t1] = [base + (j - 1) * 2, base + (j - 1) * 2 + 1, base + j * 2, base + j * 2 + 1]; index.push(...(s > 0 ? [b0, b1, t0, t0, b1, t1] : [b0, t0, b1, t0, t1, b1])); }
    }
  }
  // the old band folded into one point inside the head
  for (const i of band) P.setXYZ(i, 0, BROW.low, 0);
  P.needsUpdate = true; g.computeBoundingBox(); g.computeBoundingSphere();
  const n = pos.length / 3, geo = new THREE.BufferGeometry(), rep = (src, k) => new THREE.BufferAttribute(new src.array.constructor(n * k).map((_, i) => src.array[i0 * k + (i % k)]), k, src.normalized);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [UV.getX(i0), UV.getY(i0)]).flat(), 2));
  geo.setAttribute('skinIndex', rep(SI, 4)); geo.setAttribute('skinWeight', rep(SW, 4)); geo.setIndex(index);
  const m = new THREE.SkinnedMesh(geo, mat); m.name = 'brows'; m.position.copy(head.position); m.quaternion.copy(head.quaternion); m.scale.copy(head.scale);
  m.bind(head.skeleton, head.bindMatrix); m.receiveShadow = true; m.frustumCulled = false;
  return m;
}
// The body's material, its palette recoloured where it shows skin (by how much the chosen skin differs from the palette's,
// so lips and stubble keep their shade), hair (the hair cell: Synty's hair and beards, all made on it), the brows (a near
// black band on the man, too heavy: the hair's colour, a little darker), the eyes and the cloth (a grey column)
function lookMaterial(map, tint) {
  const U = { uSkin: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(1, 1, 1) }, uHair: { value: new THREE.Color(1, 1, 1) }, uBrow: { value: new THREE.Color(0.02, 0.02, 0.02) }, uEyes: { value: new THREE.Color(0, 0, 0) }, uCloth: { value: new THREE.Color(1, 1, 1) } };
  const m = new THREE.MeshStandardMaterial({ map, color: tint, roughness: 0.8, metalness: 0 });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSkin, uShade, uHair, uBrow, uEyes, uCloth;').replace('#include <map_fragment>', `#include <map_fragment>
      { vec2 q = vMapUv;
        if (q.x < 0.0361 && q.y > 0.1577 && q.y < 0.1743) diffuseColor.rgb = diffuse * uShade;   // (the man's stubble, a pale grey mask: the skin in shadow)
        else if (q.x < 0.0415 && q.y > 0.1289 && q.y < 0.2188) diffuseColor.rgb *= uSkin;
        else if (q.x > 0.042 && q.x < 0.0586 && q.y > 0.1875 && q.y < 0.2031) diffuseColor.rgb *= uHair;
        else if (q.x > 0.245 && q.x < 0.256 && q.y > 0.0996 && q.y < 0.2188) diffuseColor.rgb *= uCloth;
        else if (q.y < 0.0156 && q.x > 0.0938 && q.x < 0.125) diffuseColor.rgb = diffuse * uBrow;
        else if (q.y < 0.0156 && q.x < 0.0313) diffuseColor.rgb = diffuse * uEyes; }`);
  };
  m.customProgramCacheKey = () => 'heroLook';
  m.userData.look = U; return m;
}
// How the right hand holds a handle, in the hand bone's space (+x thumb side, +y fingers, +z palm; units of the rig, ~0.8 cm):
// where the handle's grip point sits, how far the handle tips from across the palm, and how far each finger joint curls
export const GRIP = { at: [0, 10.6, 4.1], tilt: -1.8, curl: 1.0 };
// A shield is strapped to the left forearm (bone space: +y elbow to wrist, the body's side +z): its middle this far down
// the forearm, its back this far out from the bone, on the outside of the arm, so the arm never passes through it
export const STRAP = { along: 15, out: 5 };
// The run and sprint clips put each foot down across the line under the body (the run's right foot most), a catwalk
// stride on our long-legged heroes: in motion each thigh turns out this far (radians, [left, right] at full stride, the
// run's and the sprint's), its foot turned back flat, which sets the feet down a hand's width either side of it
const STANCE = { run: [0.12, 0.19], sprint: [0.095, 0.095] };
// The swimming clip is a crawl under the water, the body flat: tipped this far head up (radians), the head kept this far
// over the surface (its bone sits at the base of the skull: the face clears it)
const SWIM_TILT = 0.45, SWIM_HEAD = 0.16;

// A clip from an animation-only FBX, with its root motion taken out (we move the player ourselves): only the hips' steady
// travel, start to end, so their sway stays and planted feet stay planted; the travel kept as the clip's root (as
// moves.mjs keeps it), rootSpeed its speed
function loadClip(name) {
  const C = { ready: false, clip: null, dur: 1, rootSpeed: 0, root: null };
  loadFBX(name).then((obj) => {
    const clip = obj.animations[0]; if (!clip) throw new Error(`no animation in ${name}.fbx`);
    for (const t of clip.tracks) if (/Hips\.position/.test(t.name)) {
      const v = t.values, n = v.length, T = t.times[t.times.length - 1] || 1, dx = v[n - 3] - v[0], dz = v[n - 1] - v[2];
      for (let i = 0; i < n; i += 3) { const f = t.times[i / 3] / T; v[i] -= dx * f; v[i + 2] -= dz * f; }
      C.rootSpeed = Math.hypot(dx, dz) / clip.duration; C.root = new THREE.VectorKeyframeTrack('root.position', [0, T], [0, 0, 0, dx, 0, dz]).createInterpolant();
    }
    C.clip = clip; C.dur = clip.duration; C.ready = true;
  }).catch((e) => console.warn(`${name} animation failed to load`, e));
  return C;
}
export const CLIPS = {
  run: loadClip('run'), sprint: loadClip('sprint'), jump: loadClip('jump'), attack: loadClip('attack'), punch: loadClip('punch'),
  equip: loadClip('equip'), disarm: loadClip('disarm'),
  bowEquip: loadClip('bow_equip'), bowDraw: loadClip('bow_draw'), bowAim: loadClip('bow_aim'), bowDisarm: loadClip('bow_disarm'),
};
// ---- The moves library (tools/assets/moves.mjs): Mixamo's clips retargeted onto our rig, in two files. moves.glb (the
// base layer's cycles, the guard and block, the strikes, hits, deaths, falls and the roll) is fetched once the hero
// stands; acts.glb (gestures and the like: drinking, sitting, waving...) the first time one is wanted, or a while into the
// game. Until a clip is in, whatever needs it does as it did before (the run slowed down, the old strike...)
const LIBS = {};
const move = (name) => (CLIPS[name] ||= { ready: false, clip: null, dur: 1, rootSpeed: 0, root: null });
export function loadMoves(file) {
  return (LIBS[file] ||= loadGLB(file).then((gl) => {
    gl.animations.forEach((clip, i) => {
      const x = gl.parser.json.animations[i].extras || {}, C = move(clip.name), rt = clip.tracks.find((t) => t.name === 'root.position');
      // (the hips' travel, kept apart: rootSpeed for a cycle, the path for a one-shot; a still finger's one key)
      clip.tracks = clip.tracks.filter((t) => t !== rt);
      for (const [b, q] of Object.entries(x.hands || {})) clip.tracks.push(new THREE.QuaternionKeyframeTrack(b + '.quaternion', [0], q));
      Object.assign(C, { clip, dur: clip.duration, loop: !!x.loop, rootSpeed: x.speed || 0, root: rt ? rt.createInterpolant() : null, lib: file, extras: x, ready: true });   // (extras.from: its Mixamo file)
    });
    return gl.animations.map((c) => c.name);
  }).catch((e) => { console.warn(`${file}.glb failed to load`, e); return []; }));
}
// a clip by name, fetched from whichever file holds it (moves first)
const want = (name) => { const C = move(name); if (!C.ready) loadMoves('moves').then((names) => { if (!names.includes(name)) loadMoves('acts'); }); return C; };

// The strikes. Each weapon kind goes through its moves in turn while the blows follow each other (a combo); each move is
// a stretch of its clip (from, to: seconds), the moment in it the weapon meets what's in front (hit: the clip's own
// second, found from where the striking hand stops dead), and how long the swing takes in the game (time). The hit is
// when the damage is dealt (player.update → onStrike); tools and fists keep the old clips, stretched as they always were
const STRIKE = {
  punch: { clip: 'punch', from: 0, to: 1.03, hit: 0.46, time: 0.45 }, tool: { clip: 'attack', from: 0, to: 2.27, hit: 1.02, time: 0.74 },
  chop: { clip: 'chop', from: 0.15, to: 1.6, hit: 0.88, time: 0.75 }, sweep: { clip: 'sweep', from: 0.3, to: 1.75, hit: 0.93, time: 0.75 },
  slash: { clip: 'slash', from: 0.4, to: 1.5, hit: 0.84, time: 0.72 }, slash2: { clip: 'slash2', from: 0.12, to: 1.3, hit: 0.62, time: 0.72 },
  stab: { clip: 'stab', from: 0.12, to: 1.35, hit: 0.38, time: 0.7 },
};
const STRIKES = { punch: ['punch'], tool: ['tool'], axe: ['chop', 'sweep'], mace: ['chop', 'sweep'], sword: ['slash', 'slash2'], dagger: ['stab', 'sweep'], spear: ['stab'] };
// the kind of strike an item makes (its weapon skill, or a tool's, or a fist's)
export const strikeKind = (item) => (!item ? 'punch' : STRIKES[item.skill] ? item.skill : 'tool');
// A clip's pose at a time (seconds), straight from its tracks: { bones: { name: [x, y, z, w] }, hips: [x, y, z] (its hips'
// place, travel taken out), root: [x, y, z] (the travel moves.mjs took out, or the old clips' steady travel) }, in the
// rig's own units; null while the clip isn't in
export function samplePose(C, time) {
  if (typeof C === 'string') C = CLIPS[C]; if (!C?.ready) return null;
  const t = clamp(time, 0, C.dur), bones = {}; let hips = null;
  for (const tr of C.clip.tracks) {
    const v = [...(tr._at ||= tr.createInterpolant()).evaluate(t)], n = tr.name.slice(0, tr.name.lastIndexOf('.'));
    if (tr.name.endsWith('.quaternion')) bones[n] = v; else if (n === 'mixamorigHips' && tr.name.endsWith('.position')) hips = v;
  }
  return { bones, hips, root: C.root ? [...C.root.evaluate(t)] : [0, 0, 0] };
}
// the n-th move of a combo with that kind: { C, from, to, time, at (the fraction of the swing where it hits) }
export function strikeOf(kind, n = 0) {
  const list = STRIKES[kind] || STRIKES.tool; let s = STRIKE[list[n % list.length]];
  if (!(CLIPS[s.clip] || want(s.clip)).ready) s = kind === 'punch' ? STRIKE.punch : STRIKE.tool;
  return { ...s, C: CLIPS[s.clip], at: (s.hit - s.from) / (s.to - s.from) };
}
// A hit this hard (or this share of the hero's health) staggers rather than flinches; a fall this fast (m/s) lands hard
const HIT_LARGE = { dmg: 15, share: 0.2 }, HARD_LANDING = 11.5;
// The base layer's cycles, kept in step: [clip, which way it goes (from the way the hero faces)]
const CYCLES = [['walk', 0], ['run', 0], ['sprint', 0], ['walkBack', Math.PI], ['runBack', Math.PI], ['walkLeft', Math.PI / 2], ['jogLeft', Math.PI / 2], ['walkRight', -Math.PI / 2], ['jogRight', -Math.PI / 2],
  ['crouchWalk', 0], ['crouchBack', Math.PI], ['crouchLeft', Math.PI / 2], ['crouchRight', -Math.PI / 2]];
const ZERO3 = [0, 0, 0];
// Nothing through the floor: Mixamo made its clips on a body of other proportions, so lying, rolling or getting up our
// hero's head, back, hands or legs can go under the ground. Some 500 points of what shows are watched (fitBody)
// and the body lifted by however far the lowest goes under (hero.floorLift). FEET_OFF: the clips the game plays with
// the feet off the ground (hero.js, game/acts.js), which it lifts so
export const FEET_OFF = new Set(['roll', 'deathBack', 'deathLeft', 'getUp', 'sit', 'sleep', 'pray']);
const _fa = new THREE.Vector3();
export const BOW_DUR = { equip: 0.88, draw: 0.8, lower: 0.3, disarm: 1.0, blend: 0.14 };

const _hq = new THREE.Quaternion(), _ab = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
const _sq = new THREE.Quaternion(), _sp = new THREE.Quaternion(), _sb = new THREE.Quaternion(), _sv = new THREE.Vector3();
// turn a bone by a world-space rotation q, keeping its parent where it is
function turnWorld(bone, q) { bone.parent.getWorldQuaternion(_sp); bone.getWorldQuaternion(_sb); bone.quaternion.copy(_sp.invert().multiply(_sb.premultiply(q))); }

export class Hero {
  // look: the look to start with (player.js: the one last chosen on this computer; normLook fills in the rest)
  constructor(scene, look) {
    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ'; scene.add(this.root);
    this.wrap = new THREE.Group(); this.root.add(this.wrap);
    this.mixer = null; this.model = null; this.bones = {}; this.acts = {}; this.samplers = {}; this.s = 1; this.t = 0;
    this.sprintW = 0; this.upperK = 0; this.strafeA = 0; this.airT = 0; this.landT = 0;
    // the base layer's blends (each eased in and out), the shared step of every cycle (0 → 1, the left foot down at 0),
    // the way the legs go against the facing (rel), the hips' turn for in-between angles, the swimmer's lift
    this.crouchK = 0; this.swimK = 0; this.guardK = 0; this.blockK = 0; this.fallK = 0; this.ph = 0; this.rel = 0; this.twist = 0; this.lift = 0; this.floorUp = 0; this.blockT = 0;
    this.offs = {}; this.weights = {};
    // actions (hero.action) playing now, the travel they ask of the player this frame (world metres, taken by player.js),
    // how freely the player may move (1 free, 0 held still), how long the hero has stood idle (for a look around)
    this.actions = []; this.step = new THREE.Vector3(); this.moveK = 1; this.stillT = 0; this.fidgetAt = 9; this.calm = false; this.sneak = false;
    // attachment points, filled once the rig loads: right hand (tools and weapons), left hand (bow, shield), back
    this.handR = new THREE.Group(); this.handL = new THREE.Group(); this.armL = new THREE.Group(); this.back = new THREE.Group(); this.backBow = new THREE.Group();
    this.placeholder = this.makePlaceholder(); this.wrap.add(this.placeholder);
    this.look = normLook(look);
    this.ready = this.load();
    // the moves library once the body is in (it would only slow the start), the gestures a while later
    this.ready.then(() => loadMoves('moves')).then(() => setTimeout(() => loadMoves('acts'), 20000));
  }
  // Take a look (the creator, a saved game): another body is loaded and swapped in; anything else changes at once
  setLook(look) {
    const next = normLook(look), body = next.body !== this.look.body; this.look = next;
    if (body) this.ready = this.ready.then(() => this.load()); else this.show();
    return this.ready;
  }
  makePlaceholder() {      // a simple figure while the model streams in
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xe9e0cc, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.0, 4, 10), m); body.position.y = 0.95; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: 0xc89a78 })); head.position.y = 1.72; head.castShadow = true; g.add(head);
    return g;
  }
  async load() {
    // the chosen body, the armour to dress it in (pack/heroArmour: the Greek warriors' pieces, converted on a body of
    // their own and moved onto this one's bones), or the old model when the pack isn't there
    const kind = BODIES[this.look.body] || BODIES.man;
    const [gl, dress, looks, cape] = await Promise.all([...['pack/' + kind.file, 'pack/heroArmour', 'pack/heroLooks'].map((f) => loadGLB(f).catch(() => null)), loadPack(CAPE_MODEL).catch(() => null)]);
    let obj = gl?.scene, mat;
    if (obj) { obj.updateMatrixWorld(true); let map = null; obj.traverse((m) => { if (m.isMesh && !map) map = m.material.map; }); mat = lookMaterial(map, kind.tint); }
    else { obj = await loadFBX('hero_rig'); mat = new THREE.MeshStandardMaterial({ map: loadTex('hero_diffuse.jpg'), normalMap: loadTex('hero_normal.jpg', false), roughness: 0.8, metalness: 0 }); }
    const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    const bones = {};
    obj.traverse((m) => {
      if (m.isBone) bones[m.name] = m;
      if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;   // skinned bounds don't follow the pose
      m.material = mat;
    });
    if (gl && kind.brows) { let head = null; obj.traverse((m) => { if (m.name === 'base_head') head = m; }); const brows = head && newBrows(head, mat); if (brows) head.parent.add(brows); }
    this.mat = gl ? mat : null;
    if (gl && dress) this.dress(obj, dress.scene, bones);
    if (gl && looks) this.dress(obj, looks.scene, bones, mat);
    this.s = (gl ? kind.height : 1.95) / size.y; obj.scale.multiplyScalar(this.s);
    obj.animations = [];
    // (a body swapped in the settings: the old one goes, with what it held, the clips bound to it and its feet)
    const held = [this.handR, this.handL, this.armL, this.back, this.backBow];
    if (this.model) { this.wrap.remove(this.model); this.mixer.stopAllAction(); this.acts = {}; this.samplers = {}; this.ik = null; }
    this.bones = bones; this.parts = {}; obj.traverse((m) => { if (m.isMesh) this.parts[m.name] = m; }); this.show();
    this.wrap.remove(this.placeholder); this.wrap.add(obj); this.model = obj;
    // the cape (cape.js), fitted to this body while it stands in its rest pose, shown when worn
    this.cape = gl && cape ? new Cape(cape, obj, bones, this.parts) : null; this.show();
    this.skin = null;
    this.mixer = new THREE.AnimationMixer(obj);
    // Bones are in centimetres: attachment points sit in bone space, the objects on them undo the model scale
    const B = this.bones;
    B.mixamorigRightHand.add(this.handR); B.mixamorigLeftHand.add(this.handL); B.mixamorigLeftForeArm.add(this.armL);
    for (const g of [this.back, this.backBow]) B.mixamorigSpine2.add(g);
    for (const g of held) for (const o of g.children) o.scale.setScalar(1 / this.s);
    this.back.position.set(2, 8, -16); this.backBow.position.set(-2, 2, -17); this.backBow.rotation.set(0, 0, 0.6);
    return this;
  }
  // The armour's pieces (wear_<item>) and the hair from their own file onto this body, or (looks: the body's material)
  // the hair, beards and wreaths of pack/heroLooks: each keeps its bind (where it sat on the body it came from) and
  // follows the bones of the same name here, so every piece goes where its joints went. Helmets, hair, beards and
  // wreaths are fitted to this head first (the warrior's was smaller, the looks' a man's): moved and scaled from that
  // head's box onto this one's, less the head bone's own move, which the bones then make. Both stand in their rest pose here.
  dress(obj, src, bones, looks) {
    src.updateMatrixWorld(true); obj.updateMatrixWorld(true);
    let host = null; obj.traverse((m) => { if (m.isSkinnedMesh && !host) host = m.parent; });
    let map = null, headA = null; const wear = [];
    src.traverse((m) => { if (!m.isSkinnedMesh) return; if (m.name === 'base_head') headA = m; if (looks ? !m.name.startsWith('base_') : m.name.startsWith('wear_') || m.name === 'hair') { wear.push(m); map ||= m.material.map; } });
    const headB = host?.children.find((m) => m.name === 'base_head');
    const box = (m) => m.geometry.boundingBox.clone().applyMatrix4(m.bindMatrix), Ba = headA && headB && box(headA), Bb = Ba && box(headB);
    const mat = looks || armourSkin(new THREE.MeshStandardMaterial({ map, color: 0xc4c4c4, roughness: 0.8, metalness: 0 }), this.mat?.userData.look);
    // (the wreaths are coloured from the Ancient Empire's palette, not the body's; the curls take the chosen hair colour)
    if (looks) this.wreathMat ||= new THREE.MeshStandardMaterial({ map: loadTex('pack/tex/empire.webp'), color: 0xb4b4b4, roughness: 0.75, metalness: 0 });
    else { this.curlsMat = new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.85, metalness: 0 }); this.curlsMat.userData.base = map; }
    const ca = new THREE.Vector3(), cb = new THREE.Vector3(), ja = new THREE.Vector3(), jb = new THREE.Vector3(), v = new THREE.Vector3(), inv = new THREE.Matrix4();
    for (const m of wear) {
      const list = m.skeleton.bones.map((b) => bones[b.name]); if (!host || list.some((b) => !b)) continue;
      const hi = m.skeleton.bones.findIndex((b) => b.name === 'mixamorigHead');
      if (Bb && hi >= 0 && (looks || /Helmet$|^hair$/.test(m.name))) {
        const k = (Bb.max.x - Bb.min.x) / (Ba.max.x - Ba.min.x); Ba.getCenter(ca); Bb.getCenter(cb);
        ja.setFromMatrixPosition(inv.copy(m.skeleton.boneInverses[hi]).invert()); jb.setFromMatrixPosition(bones.mixamorigHead.matrixWorld);
        const P = m.geometry.attributes.position; inv.copy(m.bindMatrix).invert();
        for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m.bindMatrix).sub(ca).multiplyScalar(k).add(cb).sub(jb).add(ja).applyMatrix4(inv); P.setXYZ(i, v.x, v.y, v.z); }
        P.needsUpdate = true; m.geometry.computeBoundingBox();
      }
      host.add(m); m.bind(new THREE.Skeleton(list, m.skeleton.boneInverses), m.bindMatrix);
      m.material = m.name === 'hair' ? this.curlsMat : /Crown/.test(m.name) ? this.wreathMat : mat; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    }
  }
  // Show the armour worn ({ head, body, legs }: item ids). The pack's hero carries each piece as a part of its own
  // (wear_<id>, from dress) and its own body in three (base_head, base_body, base_legs): armour takes the place of the
  // body under it, and a helmet the hair's. The old model has none: nothing changes on it.
  wear(ids = {}) { this.wearing = ids; this.show(); }
  // Show the armour worn and the look chosen: the chosen hair, beard and wreath (hair and wreath go under a helmet, the
  // beard stays), the body's colours
  show() {
    const P = this.parts; if (!P) return; const ids = this.wearing || {}, L = this.look; this.skin = null;
    const on = (slot) => !!(ids[slot] && P['wear_' + ids[slot]]), part = (list, id) => list.find((x) => x[0] === id)?.[2];
    for (const [n, m] of Object.entries(P)) if (n.startsWith('wear_')) m.visible = Object.values(ids).includes(n.slice(5)); else if (LOOK_PARTS.has(n)) m.visible = false;
    if (P.base_body) P.base_body.visible = !on('body'); if (P.base_legs) P.base_legs.visible = !on('legs');
    this.cape?.show(!!ids.cape, on('body'));
    const want = [part(BEARDS, L.beard), ...(on('head') ? [] : [part(HAIRS, L.hair), part(WREATHS, L.wreath)])].flat();
    for (const n of want) if (n && P[n]) P[n].visible = true;
    const U = this.mat?.userData.look; if (!U) return;
    const hair = lin(colourOf(HAIR_COLOURS, L.hairColour));
    const over = (c, a, b) => c.setRGB(a.r / b.r, a.g / b.g, a.b / b.b);   // (how much the chosen colour differs from the palette's)
    const skin = lin(colourOf(SKINS, L.skin)); over(U.uSkin.value, skin, BASE.skin); U.uShade.value.copy(skin).multiply(new THREE.Color(0.88, 0.8, 0.78)); over(U.uHair.value, hair, BASE.hair);
    U.uBrow.value.copy(hair).multiplyScalar(0.8); U.uEyes.value.copy(lin(colourOf(EYES, L.eyes))); over(U.uCloth.value, lin(colourOf(CLOTHS, L.cloth)), BASE.cloth);
    if (this.curlsMat) over(this.curlsMat.color, hair, BASE.curls);
  }
  // Hold an object in the right hand. A long-handled tool (axe, club, spear...) runs across the palm and is gripped near its
  // end, head up and forward over the thumb (bone +X thumb side, +Y fingers, +Z palm); its head (the model's +x: an axe's
  // blade, a hammer's face, a dagger's edge; held.js turns each so) faces the way the knuckles do, the way the hand
  // strikes, so a blade cuts edge first instead of lying flat across the swing
  holdRight(obj) { this.handR.clear(); if (obj) { this.handR.add(obj); obj.scale.setScalar(1 / this.s); obj.position.fromArray(GRIP.at); obj.rotation.set(0, Math.PI, GRIP.tilt, 'ZYX'); } this.gripR = !!obj; }
  // Sling something across the back (scaled out of bone space like the hand items)
  sling(obj, slot = this.back) { slot.clear(); if (obj) { slot.add(obj); obj.scale.setScalar(1 / this.s); } }
  // Hold something in the left hand (the bow), or strap it on the forearm (a shield: userData.strap, its face along -z)
  holdLeft(obj) {
    this.handL.clear(); this.armL.clear(); this.gripL = !!obj; if (!obj) return;
    obj.scale.setScalar(1 / this.s);
    if (!obj.userData.strap) { this.handL.add(obj); obj.position.fromArray(GRIP.at); obj.rotation.set(0, 0, Math.PI / 2); return; }   // (the bow, by its grip, in the fist)
    obj.rotation.set(0, 0, Math.PI); const back = new THREE.Box3().setFromObject(obj).max.z;   // (turned upright as the arm hangs; how deep its back is, in bone units)
    this.armL.add(obj); obj.position.set(0, STRAP.along, -STRAP.out - back);
  }
  // A base-layer action on the mixer (made the first time its clip is in). idleAt: a held frame of it (the old idle);
  // synced: its time set by the shared step (the cycles), not by the mixer
  act(key, C, idleAt, synced) {
    if (this.acts[key] || !C?.ready || !this.mixer) return this.acts[key];
    const a = this.mixer.clipAction(C.clip.clone());
    if (idleAt !== undefined) { a.time = C.dur * idleAt; a.paused = true; }   // a held frame used as the idle pose
    if (synced) a.paused = true;
    a.setEffectiveWeight(0); a.play(); return (this.acts[key] = a);
  }
  sampler(C) {
    if (!C.ready || !this.mixer) return null;
    let S = this.samplers[C.clip.uuid]; if (S) return S;
    S = [];
    for (const tr of C.clip.tracks) {
      if (!tr.name.endsWith('.quaternion')) continue;
      const bone = this.bones[tr.name.slice(0, -11)]; if (!bone) continue;
      S.push({ bone, upper: UPPER.test(bone.name), interp: tr.createInterpolant() });
    }
    const hp = C.clip.tracks.find((tr) => tr.name === 'mixamorigHips.position');
    if (hp && this.bones.mixamorigHips) S.hips = { bone: this.bones.mixamorigHips, interp: hp.createInterpolant() };
    return (this.samplers[C.clip.uuid] = S);
  }
  // When each foot comes down in a looping clip, as fractions of it. The legs are posed at 60 points through the clip,
  // with the clip's own travel added back (the hips were taken out of it: a planted foot then stands still), and a foot
  // is planted where its heel (the ankle) or its ball (the toe) is both still (slower than half the cycle's own speed)
  // and low (in the lower 60% of its own lift: a foot can land a little high and settle). Each foot steps once a
  // cycle: where its longest planted stretch begins (fwd), or, played backwards, where it ends (back). Found once per clip
  // and body, before the mixer poses the frame
  footfalls(C) {
    const S = this.sampler(C); if (!S) return null; if (S.feet) return S.feet;
    const B = this.bones, N = 60, legs = S.filter((x) => /Hips$|UpLeg$|Leg$|Foot$|ToeBase$/.test(x.bone.name)), P = { Left: [[], []], Right: [[], []] };
    const inv = new THREE.Matrix4().copy(this.model.matrixWorld).invert(), k = this.s * 100, drift = C.root ? C.root.evaluate(C.dur).slice() : ZERO3;   // (in centimetres)
    for (let i = 0; i < N; i++) {
      const time = i / N * C.dur; for (const x of legs) x.bone.quaternion.fromArray(x.interp.evaluate(time));
      if (S.hips) S.hips.bone.position.fromArray(S.hips.interp.evaluate(time));
      B.mixamorigHips.updateMatrixWorld(true);
      for (const side in P) ['Foot', 'ToeBase'].forEach((n, j) => { const b = B[`mixamorig${side}${n}`] || B[`mixamorig${side}Foot`]; _sv.setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv); P[side][j].push([(_sv.x + drift[0] * i / N) * k, _sv.y * k, (_sv.z + drift[2] * i / N) * k]); });
    }
    const fwd = [], back = [], speed = Math.hypot(drift[0], drift[2]) * k / C.dur, still = Math.max(speed / 2, 8);   // (cm/s)
    for (const [side, pts] of Object.entries(P)) {
      const planted = new Array(N).fill(false); let lift = 0;
      for (const p of pts) {
        const low = Math.min(...p.map((q) => q[1])), up = Math.max(...p.map((q) => q[1])) - low, tol = Math.max(2, up * 0.6); lift = Math.max(lift, up);
        for (let i = 0; i < N; i++) {
          const a = p[(i + N - 1) % N], b = p[(i + 1) % N], wrap = i === 0 || i === N - 1 ? 1 : 0;   // (across the seam the travel starts over)
          const v = Math.hypot(b[0] - a[0] + wrap * drift[0] * k, b[2] - a[2] + wrap * drift[2] * k) / (2 * C.dur / N);
          if (p[i][1] - low < tol && v < still) planted[i] = true;
        }
      }
      // (a blip of two samples or less doesn't lift the foot)
      const was = planted.slice(); for (let i = 0; i < N; i++) if (!was[i] && ((was[(i + N - 1) % N] && (was[(i + 1) % N] || was[(i + 2) % N])) || (was[(i + 1) % N] && was[(i + N - 2) % N]))) planted[i] = true;
      if (lift < 3 || planted.every(Boolean) || !planted.some(Boolean)) continue;   // (a foot that never lifts takes no steps)
      let best = null;
      for (let i = 0; i < N; i++) if (planted[i] && !planted[(i + N - 1) % N]) { let n = 0; while (n < N && planted[(i + n) % N]) n++; if (!best || n > best.n) best = { i, n }; }
      fwd.push({ side, at: best.i / N }); back.push({ side, at: ((best.i + best.n) % N) / N });
    }
    return (S.feet = { fwd, back });
  }
  // Blend clip C at normalised time t over the current pose with weight w. upper: true = upper body only, false = whole
  // body, or 0..1 to fade the legs out. hips: true = take the clip's hip height too (crouched stances); 'keep' = and its
  // travel (a fall backwards lands where it lands)
  overlay(C, t, w, upper, hips) {
    const S = this.sampler(C); if (!S || w <= 0.001) return;
    const time = clamp(t, 0, 0.999) * C.dur, lw = w * (upper === true ? 0 : upper ? 1 - upper : 1);
    for (const s of S) { const ww = s.upper ? w : lw; if (ww <= 0.001) continue; _hq.fromArray(s.interp.evaluate(time)); s.bone.quaternion.slerp(_hq, ww); }
    if (hips && lw > 0.001 && S.hips) {
      const v = S.hips.interp.evaluate(time), p = S.hips.bone.position; p.y = lerp(p.y, v[1], lw);
      if (hips === 'keep') { const r = C.root ? C.root.evaluate(time) : ZERO3; p.x = lerp(p.x, v[0] + r[0], lw); p.z = lerp(p.z, v[2] + r[2], lw); }
    }
  }

  // ---- Actions: a clip played over everything else, for the game's own moves (hits, deaths, a hard landing, the roll,
  // a look around) and for whatever else wants one (drinking, sitting, waving...):
  //   const h = hero.action('drink', { upper, loop, hold, rate, from, to, lock, lockFor, cancel, root, feet, blend, fade, weight, layer, quiet, onDone })
  //   upper   'auto' (the default): whole body standing, upper body only while moving (the legs keep walking);
  //           true: upper body only, always; false: whole body, always (the hips' height too)
  //   loop    play round until stopped; hold: stay on the last frame until stopped (a death, sitting down)
  //   rate    playback speed (1); from / to: the stretch of the clip played, in its own seconds
  //   lock    true: the player can't move, jump or strike while it plays; a number: their speed is that share (0.3);
  //           lockFor: only for its first so many seconds
  //   cancel  true: stops (fading) as soon as the player moves or jumps
  //   root    'move': the player is carried along the clip's own travel (a roll, a stagger back); 'keep': the travel
  //           stays in the pose, the player stays put
  //   feet    false: the feet aren't set on the ground while it plays (lying, sitting, rolling)
  //   blend / fade  seconds to blend in (0.2) and out (0.25); weight: its full weight (1)
  //   layer   true: plays alongside what's playing; otherwise it replaces any other action (which fades, onDone('replaced'))
  //   quiet   not counted in hero.busy (the hero's own fidgets)
  //   onDone(why)  'end', 'stopped', 'cancelled', 'replaced' or 'missing' (its clip never came)
  // The clip comes from moves.glb or acts.glb (tools/assets/moves.mjs; fetched if it isn't in yet: the action starts when
  // it arrives, or gives up after 4 s). Returns a handle: h.stop(fade?) to end it, h.playing, h.done, h.t (seconds in),
  // h.w (its weight now). hero.busy: any action not quiet is playing. hero.stopActions(fade?) ends them all.
  action(name, o = {}) {
    const C = want(name), h = { name, C, o: { upper: 'auto', rate: 1, blend: 0.2, fade: 0.25, weight: 1, ...o }, t: 0, time: 0, w: 0, wait: 0, end: null, done: false };
    h.stop = (fade = h.o.fade, why = 'stopped') => { if (h.done || h.end) return; h.end = { fade: Math.max(fade, 1e-3), left: Math.max(fade, 1e-3), w: h.w, why }; };
    Object.defineProperty(h, 'playing', { get: () => !h.done && h.C.ready });
    if (!o.layer) for (const x of this.actions) x.stop(Math.min(x.o.fade, 0.2), 'replaced');
    this.actions.push(h); return h;
  }
  // the moves library is in (the base layer's new clips), and whether a clip is (fetching it if not)
  get crouches() { return move('walk').ready && move('breathe').ready; }
  has(name) { return want(name).ready; }
  get busy() { return this.actions.some((h) => !h.done && !h.o.quiet && !h.end); }
  stopActions(fade = 0) { for (const h of this.actions) { h.stop(fade); if (!fade) h.w = 0; } }
  // Run the actions one frame on: their time, weights, the travel they ask for and the locks they hold
  runActions(dt, st) {
    this.moveK = 1; this.noFeet = 0; let lock = 1;
    for (const h of this.actions) {
      const o = h.o, C = h.C;
      if (!C.ready) { if ((h.wait += dt) > 4) { h.done = true; o.onDone?.('missing'); } continue; }
      const from = o.from ?? 0, to = Math.min(o.to ?? C.dur, C.dur), was = h.time;
      if (!h.t) h.time = from;
      h.t += dt; h.time += dt * o.rate;
      if (h.time >= to) h.time = o.loop ? from + ((h.time - from) % Math.max(to - from, 1e-3)) : to;
      // (a one-shot fades out over its last moments, ending as its clip does)
      if (!o.loop && !o.hold && !h.end && (to - h.time) / o.rate <= o.fade) h.stop((to - h.time) / o.rate, 'end');
      if (o.cancel && st.moving && h.t > 0.1) h.stop(o.fade, 'cancelled');
      if (h.end) { h.end.left -= dt; h.w = h.end.w * Math.max(0, h.end.left / h.end.fade); if (h.end.left <= 0) { h.done = true; h.w = 0; o.onDone?.(h.end.why); continue; } }
      else h.w = o.weight * Math.min(1, h.t / Math.max(o.blend, 1e-3));
      if (o.root === 'move' && C.root && h.time > was) {
        const a = C.root.evaluate(was), ax = a[0], az = a[2], b = C.root.evaluate(h.time), k = this.s * h.w;
        this.step.x += ((b[0] - ax) * Math.cos(this.root.rotation.y) + (b[2] - az) * Math.sin(this.root.rotation.y)) * k;
        this.step.z += (-(b[0] - ax) * Math.sin(this.root.rotation.y) + (b[2] - az) * Math.cos(this.root.rotation.y)) * k;
      }
      if (o.lock !== undefined && o.lock !== false && !(o.lockFor < h.t)) lock = Math.min(lock, 1 - h.w * (1 - (o.lock === true ? 0 : o.lock)));
      if (o.feet === false) this.noFeet = Math.max(this.noFeet, h.w);
    }
    this.actions = this.actions.filter((h) => !h.done); this.moveK = lock;
  }
  // ...and posed over the rest
  poseActions() {
    for (const h of this.actions) {
      if (!h.C.ready || h.w <= 0.001) continue; const up = h.o.upper === 'auto' ? this.upperK : h.o.upper;
      this.overlay(h.C, h.time / h.C.dur, h.w, up, up === true ? false : h.o.root === 'keep' ? 'keep' : true);
    }
  }
  // The game's own: a flinch or (a hard enough blow) a stagger back, a death (held on the ground until revive), a hard
  // landing. Each returns false when its clips aren't in yet (the caller does as before)
  hurt(dmg, maxHealth = 100) {
    const big = dmg >= Math.min(HIT_LARGE.dmg, maxHealth * HIT_LARGE.share), C = want(big ? 'hitLarge' : 'hitSmall'); if (!C.ready || this.death) return false;
    this.action(big ? 'hitLarge' : 'hitSmall', { layer: true, blend: 0.06, fade: 0.3, rate: big ? 1.15 : 1.3, root: big && this.upperK < 0.5 ? 'move' : undefined, lock: big ? 0.35 : undefined, quiet: true });
    return true;
  }
  die() {
    const name = Math.random() < 0.5 ? 'deathBack' : 'deathLeft'; if (!want(name).ready) return false;
    this.death = this.action(name, { upper: false, hold: true, root: 'keep', lock: true, feet: false, blend: 0.12 });
    return true;
  }
  revive() { this.death = null; this.stopActions(0); this.actions = []; }
  landed(fall) {
    if (fall < HARD_LANDING || !want('land').ready || this.death) return false;
    this.action('land', { upper: false, root: 'keep', rate: 1.25, blend: 0.05, fade: 0.3, lock: 0.25, lockFor: 0.7, quiet: true }); this.airT = 0;
    return true;
  }
  // Drive the rig every frame. st: { baseY (how high the body is set this frame before the hero's own lifts and drops:
  // a seat's lift, the old sneaking crouch; 0 if not given: wrap.position.y is set from it here, so the caller needn't
  // reset it), speed, sprinting, onGround, jumped, vy, moving (the player is trying to move),
  // moveRel (walk direction relative to facing while aiming or blocking), sneaking, guard (a one-handed weapon and a
  // shield), blocking, swing (1 → 0 while striking), strike (strikeOf: the move being made), equip ({ kind: 'equip'|'disarm',
  // t }), bow, aimPt, swimming, water (its surface, while swimming), ground (x, z, y → the surface height there) and rootY
  // (where the body stands), for setting the feet on the ground }
  update(dt, st) {
    if (!this.mixer) return;
    this.wrap.position.y = st.baseY ?? 0;
    const C = CLIPS, lib = move('walk').ready && move('breathe').ready, B = this.bones, speed = st.speed, e = (r) => Math.min(1, dt * r);
    // ---- the blends, eased: crouched, in the water, the guard, the block, falling (beyond a jump's arc), sprinting
    if (!st.onGround && !st.swimming) this.airT += dt; else { if (this.airT > 0.3) this.landT = 0.25; this.airT = 0; }
    this.crouchK = lerp(this.crouchK, lib && st.sneaking ? 1 : 0, e(7)); this.swimK = lerp(this.swimK, lib && st.swimming ? 1 : 0, e(5));
    this.guardK = lerp(this.guardK, lib && st.guard ? 1 : 0, e(5)); this.blockK = lerp(this.blockK, lib && st.blocking ? 1 : 0, e(10));
    this.fallK = lerp(this.fallK, lib && !st.swimming && (this.airT > 0.9 || (this.airT > 0.35 && st.vy < -9)) ? 1 : 0, e(5));
    this.sprintW = lerp(this.sprintW, st.sprinting && C.sprint.ready ? 1 : 0, e(6));
    this.rel = angDiff(this.rel + angDiff(st.moveRel || 0, this.rel) * e(10), 0);
    // (sneaking begun or ended standing still: the clip that crouches down or stands up)
    if (lib && !!st.sneaking !== this.sneak && speed < 0.3 && st.onGround && !st.swimming) this.action(st.sneaking ? 'crouchDown' : 'crouchUp', { upper: false, root: 'keep', blend: 0.15, fade: 0.15, cancel: true, layer: true, quiet: true });
    this.sneak = !!st.sneaking;
    const W = this.base(dt, st, lib);
    // (where each cycle stands before this frame, for the footsteps)
    const ph0 = this.ph, feet = W.lead && this.footfalls(C[W.lead]);
    this.ph = (this.ph + W.rate * dt) % 1;
    for (const [n] of CYCLES) { const a = this.acts[n]; if (a && C[n].ready) a.time = this.phaseOf(n, this.ph) * C[n].dur; }
    this.mixer.update(dt);
    // The mixer only writes a bone when its value changed; the idle is a held frame, so re-apply every binding or the
    // overlays below would pile up frame after frame
    const off = this.mixer._accuIndex + 1;
    for (const b of this.mixer._bindings) b.binding.setValue(b.buffer, off * b.valueSize);
    this.t += dt;
    if (B.mixamorigSpine2 && !lib) B.mixamorigSpine2.rotateX(Math.sin(this.t * 1.9) * 0.02 * (1 - W.move));     // breathing (the breathing idle has its own)
    this.upperK = lerp(this.upperK, speed > 0.5 || !st.onGround ? 1 : 0, e(8));
    // walking one way, facing another: the cycle nearest the way the legs go, the hips turned the rest of the way
    if (Math.abs(this.twist) > 0.01 && B.mixamorigHips) B.mixamorigHips.rotateOnWorldAxis(UPV, this.twist);
    // jump: skip the wind-up, map airtime onto the rise and fall, then a short landing settle (or, past a jump's arc, falling)
    const jumpT = st.jumped || this.airT > 0.25 ? this.airT : 0;
    if (this.landT > 0) this.landT -= dt;
    // footsteps: a foot came down in the stride this frame (onFootfall: the player's step sound), while the legs show it
    if (feet && W.move > 0.25 && st.onGround && !st.swimming && jumpT === 0) {
      const p0 = this.phaseOf(W.lead, ph0), p1 = this.phaseOf(W.lead, this.ph), dir = W.back ? -1 : 1, list = feet[dir > 0 ? 'fwd' : 'back'];
      let d = (p1 - p0) * dir; d -= Math.floor(d);   // (how far through the cycle this frame went, its own way round)
      if (d < 0.5) for (const f of list) { let x = (f.at - p0) * dir; x -= Math.floor(x); if (x > 0 && x <= d) this.onFootfall?.(f.side); }
    }
    if (jumpT > 0) this.overlay(C.jump, 0.28 + jumpT / 0.7 * 0.5, Math.min(1, jumpT * 8) * (1 - this.fallK), false);
    else if (this.landT > 0) this.overlay(C.jump, 0.8 + (0.25 - this.landT) * 0.6, this.landT / 0.25, false);
    // (drawing and sheathing: the arms only; the old clips' legs, made on another body, skate on ours)
    if (st.equip) { const E = st.equip.kind === 'equip' ? C.equip : C.disarm, w = Math.min(1, Math.sin(Math.min(st.equip.t, 1) * Math.PI) * 2.5); this.overlay(E, st.equip.t, w, true); }
    // the block: the guard raised, the whole body braced standing (its hips lower), the arms only while moving
    if (this.blockK > 0.01) { this.blockT += dt; this.overlay(C.block, (this.blockT / C.block.dur) % 1, this.blockK, this.upperK, true); } else this.blockT = 0;
    if (st.swing > 0) {
      const S = st.strike || strikeOf(st.swingKind === 'punch' ? 'punch' : 'tool'), p = 1 - st.swing, k = S.time;
      this.overlay(S.C, (S.from + p * (S.to - S.from)) / S.C.dur, Math.min(1, p * k / 0.07, st.swing * k / 0.15 + 0.1), this.upperK);
    }
    // standing idle a while (nothing in hand but a tool, no bow, no guard, not in the creator: calm): a look around
    const idle = lib && speed < 0.05 && st.onGround && !st.swimming && !st.swing && !st.bow && !st.equip && !st.blocking && !st.sneaking && !st.guard && !this.calm && !this.actions.length;
    this.stillT = idle ? this.stillT + dt : 0;
    if (this.stillT > this.fidgetAt) { this.action('look', { cancel: true, blend: 0.5, fade: 0.6, layer: true, quiet: true }); this.stillT = 0; this.fidgetAt = 10 + Math.random() * 8; }
    this.runActions(dt, st); this.poseActions();
    if (st.bow) this.poseBow(st.bow, st.aimPt, st.sprinting);
    this.keepAboveFloor(dt, st);
    // swimming: the old run, leaned into a crawl, while the swimming clips aren't in
    if (st.swimming && B.mixamorigHips && !lib) B.mixamorigHips.rotateX(0.9);
    // a wider stance in motion: each thigh turned out about the way the legs face (the hips', strafing too), its foot
    // turned back flat; before the feet find the ground, so they're set down where the wider legs put them. Only the
    // run and the sprint need it (their feet cross the line under the body); the other cycles step wide enough
    const spr = (1 - Math.min(1, jumpT * 8)) * (1 - this.swimK);
    if (spr > 0.02 && B.mixamorigLeftUpLeg && B.mixamorigRightUpLeg) {
      const tw = lib ? this.twist : this.strafeA, ax = _sv.set(Math.sin(tw), 0, Math.cos(tw)).applyQuaternion(this.root.quaternion);
      for (const [side, k, i] of [['Left', 1, 0], ['Right', -1, 1]]) {
        const a = spr * k * ((W.w.run || 0) * STANCE.run[i] + (W.w.sprint || 0) * STANCE.sprint[i]); if (Math.abs(a) < 1e-3) continue;
        const up = B[`mixamorig${side}UpLeg`], foot = B[`mixamorig${side}Foot`];
        turnWorld(up, _sq.setFromAxisAngle(ax, a)); if (foot) turnWorld(foot, _sq.setFromAxisAngle(ax, -a));
      }
    }
    // a closed fist round a held handle, the bow or the shield's grip (the clips leave the hands open)
    for (const [side, on] of [['Right', this.gripR], ['Left', this.gripL]]) if (on) for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) for (let k = 1; k <= 3; k++) { const b = B[`mixamorig${side}Hand${f}${k}`]; if (b) b.rotation.x += GRIP.curl; }
    // in the water: the head kept just over the surface (the swimming clip is made under it, the body flat: tipped head
    // up a little), the body lifted or let down to put it there
    if (this.swimK > 0.01 && B.mixamorigHead) {
      if (B.mixamorigHips) B.mixamorigHips.rotateOnWorldAxis(_sv.set(1, 0, 0).applyQuaternion(this.root.quaternion), -SWIM_TILT * this.swimK * (W.w.swim || 0));
      this.root.updateMatrixWorld(true); const y = B.mixamorigHead.getWorldPosition(_ab[0]).y;   // (before the lift is added)
      this.lift = lerp(this.lift, clamp((st.water ?? 0) + SWIM_HEAD - y, -0.9, 0.9) * this.swimK, e(6));
    } else this.lift = lerp(this.lift, 0, e(6));
    this.wrap.position.y += this.lift;
    // feet on the real ground: the hips drop for the lower foot, the legs bend, planted feet follow the slope
    if (st.ground) {
      this.ik ||= new FootIK(B, st.ground);
      this.wrap.position.y += this.ik.plan(dt, st.rootY, st.onGround && !st.swimming && jumpT === 0 && this.noFeet < 0.5 && this.fallK < 0.5);
      this.root.updateMatrixWorld(true); this.ik.solve(st.rootY);
    }
    this.cape?.update(dt);
  }
  // The points watched for the floor: every so many of the vertices of what shows (the body, its hair, what it wears:
  // chosen again when that changes, show), each with the bone that moves it most
  fitBody() {
    this.skin = [];
    const meshes = Object.values(this.parts).filter((m) => m.isSkinnedMesh && m.visible), total = meshes.reduce((n, m) => n + m.geometry.attributes.position.count, 0), every = Math.max(1, Math.round(total / 500));
    for (const m of meshes) {
      const SI = m.geometry.attributes.skinIndex, SW = m.geometry.attributes.skinWeight;
      for (let i = 0; i < m.geometry.attributes.position.count; i += every) { let best = 0, bw = -1; for (let k = 0; k < 4; k++) if (SW.getComponent(i, k) > bw) { bw = SW.getComponent(i, k); best = SI.getComponent(i, k); } this.skin.push({ m, i, bone: m.skeleton.bones[best] }); }
    }
  }
  // How far the body must be lifted (metres, ≥ 0) for none of the watched skin to go under floorAt(x, z) (taken under
  // each point's bone), the bones' world matrices current
  floorLift(floorAt) {
    if (!this.skin) this.fitBody(); let want = 0; const floors = new Map(), done = new Set();
    for (const p of this.skin) {
      if (!done.has(p.m)) { p.m.skeleton.update(); done.add(p.m); }   // (the skinning matrices as the bones stand now)
      let f = floors.get(p.bone); if (f === undefined) { p.bone.getWorldPosition(_fa); floors.set(p.bone, (f = floorAt(_fa.x, _fa.z))); }
      p.m.getVertexPosition(p.i, _fa).applyMatrix4(p.m.matrixWorld); want = Math.max(want, f + 0.01 - _fa.y);
    }
    return want;
  }
  // Nothing through the floor (floorLift): while an action with the feet off the ground plays, the body is lifted at
  // once as far as it needs, and let down eased. The floor is the ground where each point is, or the flat floor the hero
  // rests on (st.floorY: a bed's top)
  keepAboveFloor(dt, st) {
    let want = 0;
    // (anything much higher than where the hero stands, a gravestone, a wall's foot, is beside the body, not under it)
    if (this.noFeet > 0.01 && st.rootY !== undefined) { this.root.updateMatrixWorld(true); want = this.floorLift((x, z) => st.floorY ?? (st.ground ? Math.min(st.ground(x, z, st.rootY), st.rootY + 0.25) : st.rootY)); }
    this.floorUp = want > this.floorUp ? want : lerp(this.floorUp, want, Math.min(1, dt * 6));
    this.wrap.position.y += this.floorUp;
  }
  // A cycle's own time (0..1) at the shared step: each is offset so its left foot comes down at step 0; the old run
  // played backwards stands in for backing up while the moves aren't in
  phaseOf(n, ph) { const p = n === 'run' && this.runBack ? 1 - ph : ph; return (p + (this.offs[n] ?? 0) + 1) % 1; }
  // The base layer's weights for this frame (set on the mixer's actions, summing to one), and how fast the shared step
  // goes: { w (by clip), move (how much of it is a moving cycle), lead (the heaviest cycle, for footsteps), back, rate }
  base(dt, st, lib) {
    const C = CLIPS, speed = st.speed, w = {}, v = (n) => (C[n].rootSpeed > 30 ? C[n].rootSpeed * this.s : n === 'sprint' ? 7.2 : 3.9);
    const add = (n, x) => { if (x > 1e-4) w[n] = (w[n] || 0) + x; };
    const moveW = clamp(speed / (lib ? 0.9 : 2.2), 0, 1), water = this.swimK, ground = 1 - water, fall = ground * this.fallK, on = ground - fall;
    const stand = on * (1 - moveW), go = on * moveW, crouch = this.crouchK;
    // standing: breathing (the old held frame until it's in), the guard with a shield up, or crouched
    if (lib) { add('breathe', stand * (1 - crouch) * (1 - this.guardK)); add('guard', stand * (1 - crouch) * this.guardK); } else add('idle', stand);
    add('crouch', stand * crouch); add('fall', fall);
    // in the water: swimming when moving, treading water when not
    const sw = clamp(speed / 0.8, 0, 1); add('swim', water * sw); add('tread', water * (1 - sw));
    // moving: by the way the legs go against the facing, the cycle on either side of it (crossfading between the two
    // near the diagonals), the hips turned the rest of the way; by speed, the walk into the run (or a strafe walk into
    // the jog...), the sprint over both
    this.runBack = false;
    if (lib) {
      const a = (this.rel + Math.PI * 2) % (Math.PI * 2), q = a / (Math.PI / 2), i = Math.floor(q) % 4, t = q - Math.floor(q), x = smooth(0.3, 0.7, t);
      this.twist = (Math.PI / 2) * (t - x) * moveW;
      const dirs = [[i, 1 - x], [(i + 1) % 4, x]], band = (lo, hi) => clamp((speed - v(lo)) / (v(hi) - v(lo)), 0, 1);
      for (const [d, dw] of dirs) {
        if (dw < 1e-4) continue; const up = go * (1 - crouch) * dw, low = go * crouch * dw;
        if (d === 0) { const k = band('walk', 'run'); add('walk', up * (1 - k) * (1 - this.sprintW)); add('run', up * k * (1 - this.sprintW)); add('sprint', up * this.sprintW); add('crouchWalk', low); }
        if (d === 1) { const k = band('walkLeft', 'jogLeft'); add('walkLeft', up * (1 - k)); add('jogLeft', up * k); add('crouchLeft', low); }
        if (d === 2) { const k = band('walkBack', 'runBack'); add('walkBack', up * (1 - k)); add('runBack', up * k); add('crouchBack', low); }
        if (d === 3) { const k = band('walkRight', 'jogRight'); add('walkRight', up * (1 - k)); add('jogRight', up * k); add('crouchRight', low); }
      }
    } else {
      // (the old way: the run, played backwards to back up, the hips turned toward the way the legs go)
      const rel = st.moveRel || 0, back = Math.abs(rel) > 1.95; this.runBack = back; this.twist = 0;
      this.strafeA = lerp(this.strafeA, clamp(back ? angDiff(rel, Math.PI) : rel, -1.35, 1.35), Math.min(1, dt * 10));
      add('run', go * (C.sprint.ready ? 1 - this.sprintW : 1)); add('sprint', go * (C.sprint.ready ? this.sprintW : 0));
    }
    if (!lib && Math.abs(this.strafeA) > 0.01) this.twist = this.strafeA; else if (lib) this.strafeA = 0;
    // onto the mixer: any clip not in yet gives its weight to the old idle or the run
    let sum = 0;
    for (const n of Object.keys(w)) if (n !== 'idle' && !C[n]?.ready) { const to = CYCLES.some((c) => c[0] === n) && C.run.ready ? 'run' : 'idle'; w[to] = (w[to] || 0) + w[n]; delete w[n]; }
    for (const n in w) sum += w[n];
    if (sum < 1e-3) { w.idle = 1; sum = 1; }
    for (const n of new Set([...Object.keys(this.acts), ...Object.keys(w)])) {
      const a = this.acts[n] || this.act(n, n === 'idle' ? C.disarm : C[n], n === 'idle' ? 0.97 : undefined, CYCLES.some((c) => c[0] === n)); if (!a) continue;
      a.setEffectiveWeight((w[n] || 0) / sum);
      if (n === 'swim') a.timeScale = clamp(speed / Math.max(v('swim'), 0.3), 0.7, 1.6);
    }
    // the shared step: as fast as the blend of cycles, each at its own stride, covers the ground going by
    let cw = 0, len = 0, freq = 0, lead = null;
    for (const [n] of CYCLES) { const x = w[n]; if (!x) continue; if (!(n in this.offs)) this.offs[n] = this.footfalls(C[n])?.fwd.find((f) => f.side === 'Left')?.at ?? 0;
      cw += x; len += x * v(n) * C[n].dur; freq += x / C[n].dur; if (!lead || x > w[lead]) lead = n; }
    const f0 = cw ? freq / cw : 1, rate = cw ? clamp(speed / Math.max(len / cw, 0.05), f0 * 0.5, f0 * 1.8) : 0;
    this.weights = w;
    return { w: Object.fromEntries(Object.entries(w).map(([n, x]) => [n, x / sum])), move: cw / sum, lead, back: lead === 'run' && this.runBack, rate };
  }
  // Bow states: equip → ready → draw (hold RMB) → aim (full draw) → lower → ready → disarm
  poseBow(b, aimPt, sprinting) {
    if (b.t < 0) return;
    const C = CLIPS, up = this.upperK, aimPh = (t) => Math.min(t / C.bowAim.dur, 1);
    if (b.st === 'equip') this.overlay(C.bowEquip, b.t / BOW_DUR.equip, Math.min(1, b.t * 6), up, true);
    else if (b.st === 'disarm') this.overlay(C.bowDisarm, b.t / BOW_DUR.disarm, Math.min(1, (BOW_DUR.disarm - b.t) * 5), up, true);
    else if (b.st === 'ready') this.overlay(C.bowDraw, 0, lerp(1, sprinting ? 0.15 : 0.3, up), up, true);
    else if (b.st === 'draw') this.overlay(C.bowDraw, Math.max(b.ph, b.from || 0), 1, up, true);
    else if (b.st === 'aim') this.overlay(C.bowAim, aimPh(b.t), 1, up, true);
    else if (b.st === 'lower') this.overlay(C.bowDraw, 0, 1, up, true);
    const fade = b.st === 'lower' ? 1 - ss(b.t / BOW_DUR.lower) : b.st === 'draw' ? 1 - ss(b.t / BOW_DUR.blend) : 0;
    if (b.fromC && fade > 0) this.overlay(C[b.fromC], b.fromT, fade, up, true);
    const aimW = b.st === 'aim' ? 1 : b.st === 'draw' ? ss((b.ph - 0.6) / 0.3) : b.st === 'lower' && b.fromC ? fade * (b.fromC === 'bowAim' ? 1 : ss((b.fromT - 0.6) / 0.3)) : 0;
    if (aimW > 0.01 && aimPt) this.aimUpperBody(aimPt, aimW);
  }
  // Turn the spine (split over two joints) so the line string hand → bow hand points at the target
  aimUpperBody(target, w) {
    const Bn = this.bones, R = Bn.mixamorigRightHand, L = Bn.mixamorigLeftHand; if (!R || !L) return;
    for (const [bone, part] of [[Bn.mixamorigSpine1, 0.5], [Bn.mixamorigSpine2, 1]]) {
      const r = R.getWorldPosition(_ab[0]), cur = L.getWorldPosition(_ab[1]).sub(r).normalize(), want = _ab[2].copy(target).sub(r).normalize();
      const d = _ab[3].identity().slerp(_ab[4].setFromUnitVectors(cur, want), w * part);
      const pq = bone.parent.getWorldQuaternion(_ab[5]).invert(), wq = bone.getWorldQuaternion(_ab[4]);
      bone.quaternion.copy(pq.multiply(d.multiply(wq)));
    }
  }
}

