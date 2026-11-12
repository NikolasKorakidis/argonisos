// The hero: the Mixamo-rigged character and its clips. A base layer (idle / run / sprint) plays on an AnimationMixer at
// a rate matched to ground speed; one-shots (jump, strike, punch, draw / sheathe, the bow) are sampled straight from
// their tracks and blended over it: whole body when standing, upper body only while moving.
import * as THREE from 'three';
import { FootIK } from './footik.js';
import { Cape, CAPE_MODEL } from './cape.js';
import { loadFBX, loadGLB, loadPack, loadTex } from '../assets.js';
import { clamp, lerp } from '../util/math.js';
import { SETTINGS } from '../ui/settings.js';

const ss = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const UPPER = /Spine|Neck|Head|Shoulder|Arm|Hand/, UPV = new THREE.Vector3(0, 1, 0);
// The bodies to choose from (the character creator, ui/creator.js): Synty's plain man and woman in their underwear, fitted
// onto the Mixamo rig (tools/assets/fbx-page.mjs refit: same bones, same clips), each this tall; the tint takes the
// palette's glare off in our light
// (brows: the man's are one heavy band, read as a pair of dark glasses: drawn this much thinner, and parted over the nose)
export const BODIES = { man: { file: 'hero', height: 1.95, tint: 0xb4aeb4, name: 'Man', brows: 0.45 }, woman: { file: 'heroWoman', height: 1.86, tint: 0xb4aeb4, name: 'Woman' } };

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
// The brows (the near-black cell they're drawn in) made thinner: each point drawn towards the middle of the brow where it
// stands, and the two parted where they meet over the nose
const isBrow = (u, v) => v < 0.0156 && u > 0.0938 && u < 0.125;
function thinBrows(g, k) {
  const P = g.attributes.position, UV = g.attributes.uv, at = [];
  for (let i = 0; i < P.count; i++) if (isBrow(UV.getX(i), UV.getY(i))) at.push(i);
  const xs = at.map((i) => P.getX(i)), mid = (Math.min(...xs) + Math.max(...xs)) / 2, half = (Math.max(...xs) - Math.min(...xs)) / 2;
  const ys = at.map((i) => P.getY(i));
  at.forEach((i, j) => {
    const x = xs[j], near = ys.filter((_, n) => Math.abs(xs[n] - x) < half * 0.25), cy = near.reduce((s, y) => s + y, 0) / near.length;
    // (within a seventh of the middle the brow is pushed out to the side: a gap over the nose)
    const gap = half * 0.14, nx = Math.abs(x - mid) < gap ? mid + Math.sign(x - mid || 1) * gap : x;
    P.setXY(i, nx, cy + (ys[j] - cy) * k);
  });
  P.needsUpdate = true; g.computeBoundingBox();
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

// A clip from an animation-only FBX, with its root motion flattened (we move the player ourselves)
function loadClip(name) {
  const C = { ready: false, clip: null, dur: 1, rootSpeed: 0 };
  loadFBX(name).then((obj) => {
    const clip = obj.animations[0]; if (!clip) throw new Error(`no animation in ${name}.fbx`);
    for (const t of clip.tracks) if (/Hips\.position/.test(t.name)) {
      const v = t.values, x0 = v[0], z0 = v[2], n = v.length; C.rootSpeed = Math.hypot(v[n - 3] - x0, v[n - 1] - z0) / clip.duration;
      for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
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
export const BOW_DUR = { equip: 0.88, draw: 0.8, lower: 0.3, disarm: 1.0, blend: 0.14 };

const _hq = new THREE.Quaternion(), _ab = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
const _sq = new THREE.Quaternion(), _sp = new THREE.Quaternion(), _sb = new THREE.Quaternion(), _sv = new THREE.Vector3();
// turn a bone by a world-space rotation q, keeping its parent where it is
function turnWorld(bone, q) { bone.parent.getWorldQuaternion(_sp); bone.getWorldQuaternion(_sb); bone.quaternion.copy(_sp.invert().multiply(_sb.premultiply(q))); }

export class Hero {
  constructor(scene) {
    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ'; scene.add(this.root);
    this.wrap = new THREE.Group(); this.root.add(this.wrap);
    this.mixer = null; this.model = null; this.bones = {}; this.acts = {}; this.samplers = {}; this.s = 1; this.t = 0;
    this.sprintW = 0; this.upperK = 0; this.strafeA = 0; this.airT = 0; this.landT = 0;
    // attachment points, filled once the rig loads: right hand (tools and weapons), left hand (bow, shield), back
    this.handR = new THREE.Group(); this.handL = new THREE.Group(); this.armL = new THREE.Group(); this.back = new THREE.Group(); this.backBow = new THREE.Group();
    this.placeholder = this.makePlaceholder(); this.wrap.add(this.placeholder);
    // the look last chosen on this computer (or the first one), until a saved game or the creator gives another
    this.look = normLook(SETTINGS.look || (SETTINGS.hero && { body: SETTINGS.hero }));
    this.ready = this.load();
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
    if (gl && kind.brows) obj.traverse((m) => { if (m.name === 'base_head') thinBrows(m.geometry, kind.brows); });
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
    const P = this.parts; if (!P) return; const ids = this.wearing || {}, L = this.look;
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
  act(key, C, idleAt) {
    if (this.acts[key] || !C.ready || !this.mixer) return this.acts[key];
    const a = this.mixer.clipAction(C.clip.clone());
    if (idleAt !== undefined) { a.time = C.dur * idleAt; a.paused = true; }   // a held frame used as the idle pose
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
  // When each foot comes down in a looping clip, as fractions of it: the legs are posed at 60 points through the clip,
  // and a foot is down where the lower of its heel (the ankle) and its ball (the toe) comes within 3.5 cm of the lowest
  // it gets (fwd); played backwards, a foot comes down where it lifted (back). Found once per clip and body, before the
  // mixer poses the frame
  footfalls(C) {
    const S = this.sampler(C); if (!S) return null; if (S.feet) return S.feet;
    const B = this.bones, N = 60, legs = S.filter((x) => /Hips$|UpLeg$|Leg$|Foot$|ToeBase$/.test(x.bone.name)), h = { Left: [[], []], Right: [[], []] };
    const inv = new THREE.Matrix4().copy(this.model.matrixWorld).invert(), k = this.s * 100;   // (heights in centimetres)
    for (let i = 0; i < N; i++) {
      const time = i / N * C.dur; for (const x of legs) x.bone.quaternion.fromArray(x.interp.evaluate(time));
      if (S.hips) S.hips.bone.position.fromArray(S.hips.interp.evaluate(time));
      B.mixamorigHips.updateMatrixWorld(true);
      for (const side in h) ['Foot', 'ToeBase'].forEach((n, j) => { const b = B[`mixamorig${side}${n}`] || B[`mixamorig${side}Foot`]; h[side][j].push(_sv.setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv).y * k); });
    }
    const fwd = [], back = [];
    for (const [side, [heel, ball]] of Object.entries(h)) {
      const hl = Math.min(...heel), bl = Math.min(...ball), y = heel.map((v, i) => Math.min(v - hl, ball[i] - bl)), up = Math.max(...y) / 2, down = 3.5;
      if (up < 2 * down) continue;
      // (a foot only counts as down again once it has been half way up: no double steps from a wobble on the ground)
      for (const [list, dir] of [[fwd, 1], [back, -1]]) {
        let armed = false;
        for (let n = 0; n < N * 2; n++) {
          const i = (N * 2 + dir * n) % N, j = (N * 2 + i + dir) % N;
          if (y[i] > up) armed = true;
          if (armed && y[i] > down && y[j] <= down) { armed = false; if (n >= N) list.push({ side, at: ((i + dir * (y[i] - down) / (y[i] - y[j])) / N + 1) % 1 }); }
        }
      }
    }
    return (S.feet = { fwd, back });
  }
  // Blend clip C at normalised time t over the current pose with weight w. upper: true = upper body only, false = whole
  // body, or 0..1 to fade the legs out. hipsY: take the clip's hip height too (crouched stances)
  overlay(C, t, w, upper, hipsY) {
    const S = this.sampler(C); if (!S || w <= 0.001) return;
    const time = clamp(t, 0, 0.999) * C.dur, lw = w * (upper === true ? 0 : upper ? 1 - upper : 1);
    for (const s of S) { const ww = s.upper ? w : lw; if (ww <= 0.001) continue; _hq.fromArray(s.interp.evaluate(time)); s.bone.quaternion.slerp(_hq, ww); }
    if (hipsY && lw > 0.001 && S.hips) S.hips.bone.position.y = lerp(S.hips.bone.position.y, S.hips.interp.evaluate(time)[1], lw);
  }
  // Drive the rig every frame. st: { speed, sprinting, onGround, jumped, moveRel (walk direction relative to facing while
  // aiming), swing (1 → 0 while striking), swingKind ('punch' | 'tool'), equip ({ kind: 'equip'|'disarm', t }), bow, aimPt, swimming,
  // ground (x, z, y → the surface height there) and rootY (where the body stands), for setting the feet on the ground }
  update(dt, st) {
    if (!this.mixer) return;
    const C = CLIPS, idle = this.act('idle', C.disarm, 0.97), run = this.act('run', C.run), sprint = this.act('sprint', C.sprint);
    const speed = st.speed, moveW = clamp(speed / 2.2, 0, 1);
    this.sprintW = lerp(this.sprintW, st.sprinting && sprint ? 1 : 0, Math.min(1, dt * 6));
    const runV = C.run.rootSpeed > 50 ? C.run.rootSpeed * this.s : 3.9, sprV = C.sprint.rootSpeed > 50 ? C.sprint.rootSpeed * this.s : 7.2;
    // walking while aiming: face the target, legs go where you walk; backing up plays the run in reverse
    const rel = st.moveRel || 0, back = Math.abs(rel) > 1.95;
    this.strafeA = lerp(this.strafeA, clamp(back ? Math.atan2(Math.sin(rel - Math.PI), Math.cos(rel - Math.PI)) : rel, -1.35, 1.35), Math.min(1, dt * 10));
    if (run) { run.setEffectiveWeight(moveW * (1 - this.sprintW)); run.timeScale = (back ? -1 : 1) * clamp(speed / runV, 0.55, 1.5); }
    if (sprint) { sprint.setEffectiveWeight(moveW * this.sprintW); sprint.timeScale = clamp(speed / sprV, 0.7, 1.4); if (run) sprint.time = (run.time / C.run.dur) * C.sprint.dur; }
    if (idle) idle.setEffectiveWeight(Math.max(1 - moveW, run ? 0 : 1));
    // (where the stride stands before this frame: run and sprint share one cycle, the sprint kept in step with the run)
    const feet = run && this.footfalls(C.run), feetS = sprint && this.footfalls(C.sprint), ph0 = run ? run.time / C.run.dur : 0;
    this.mixer.update(dt);
    // The mixer only writes a bone when its value changed; the idle is a held frame, so re-apply every binding or the
    // overlays below would pile up frame after frame
    const off = this.mixer._accuIndex + 1;
    for (const b of this.mixer._bindings) b.binding.setValue(b.buffer, off * b.valueSize);
    this.t += dt;
    const B = this.bones;
    if (B.mixamorigSpine2) B.mixamorigSpine2.rotateX(Math.sin(this.t * 1.9) * 0.02 * (1 - moveW));     // breathing
    this.upperK = lerp(this.upperK, speed > 0.5 || !st.onGround ? 1 : 0, Math.min(1, dt * 8));
    if (Math.abs(this.strafeA) > 0.01 && B.mixamorigHips) B.mixamorigHips.rotateOnWorldAxis(UPV, this.strafeA);
    // jump: skip the wind-up, map airtime onto the rise and fall, then a short landing settle
    if (!st.onGround && !st.swimming) this.airT += dt; else { if (this.airT > 0.3) this.landT = 0.25; this.airT = 0; }
    const jumpT = st.jumped || this.airT > 0.25 ? this.airT : 0;
    if (this.landT > 0) this.landT -= dt;
    // footsteps: a foot came down in the stride this frame (onFootfall: the player's step sound), while the legs show it
    if (feet && moveW > 0.25 && st.onGround && !st.swimming && jumpT === 0) {
      const dir = run.timeScale < 0 ? -1 : 1, list = (this.sprintW > 0.5 && feetS ? feetS : feet)[dir > 0 ? 'fwd' : 'back'];
      let d = (run.time / C.run.dur - ph0) * dir; d -= Math.floor(d);   // (how far through the cycle this frame went, its own way round)
      if (d < 0.5) for (const f of list) { let e = (f.at - ph0) * dir; e -= Math.floor(e); if (e > 0 && e <= d) this.onFootfall?.(f.side); }
    }
    if (jumpT > 0) this.overlay(C.jump, 0.28 + jumpT / 0.7 * 0.5, Math.min(1, jumpT * 8), false);
    else if (this.landT > 0) this.overlay(C.jump, 0.8 + (0.25 - this.landT) * 0.6, this.landT / 0.25, false);
    if (st.equip) { const E = st.equip.kind === 'equip' ? C.equip : C.disarm, w = Math.min(1, Math.sin(Math.min(st.equip.t, 1) * Math.PI) * 2.5); this.overlay(E, st.equip.t, w, this.upperK); }
    if (st.swing > 0) this.overlay(st.swingKind === 'punch' ? C.punch : C.attack, 1 - st.swing, Math.min(1, st.swing * 6, (1 - st.swing) * 8 + 0.2), this.upperK);
    if (st.bow) this.poseBow(st.bow, st.aimPt, st.sprinting);
    // swimming: lean forward into a crawl-ish stroke on top of the run
    if (st.swimming && B.mixamorigHips) B.mixamorigHips.rotateX(0.9);
    // a wider stance in motion: each thigh turned out about the way the legs face (the hips', strafing too), its foot
    // turned back flat; before the feet find the ground, so they're set down where the wider legs put them
    const spread = moveW * (st.swimming ? 0 : 1) * (1 - Math.min(1, jumpT * 8));
    if (spread > 0.02 && B.mixamorigLeftUpLeg && B.mixamorigRightUpLeg) {
      const ax = _sv.set(Math.sin(this.strafeA), 0, Math.cos(this.strafeA)).applyQuaternion(this.root.quaternion);
      for (const [side, k, i] of [['Left', 1, 0], ['Right', -1, 1]]) {
        const up = B[`mixamorig${side}UpLeg`], foot = B[`mixamorig${side}Foot`], a = spread * k * lerp(STANCE.run[i], STANCE.sprint[i], this.sprintW);
        turnWorld(up, _sq.setFromAxisAngle(ax, a)); if (foot) turnWorld(foot, _sq.setFromAxisAngle(ax, -a));
      }
    }
    // a closed fist round a held handle, the bow or the shield's grip (the clips leave the hands open)
    for (const [side, on] of [['Right', this.gripR], ['Left', this.gripL]]) if (on) for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) for (let k = 1; k <= 3; k++) { const b = B[`mixamorig${side}Hand${f}${k}`]; if (b) b.rotation.x += GRIP.curl; }
    // feet on the real ground: the hips drop for the lower foot, the legs bend, planted feet follow the slope
    if (st.ground) {
      this.ik ||= new FootIK(B, st.ground);
      this.wrap.position.y += this.ik.plan(dt, st.rootY, st.onGround && !st.swimming && jumpT === 0);
      this.root.updateMatrixWorld(true); this.ik.solve(st.rootY);
    }
    this.cape?.update(dt);
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

