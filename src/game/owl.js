// The Owl, Athena's messenger. She turns up when there's something worth knowing (your first find, the first evening,
// the temple, the house, the clues, the lairs, the bosses, your first death), flies alongside you with a "!" over her
// head until you talk to her (E), tells you what she knows, then flies off until the next time.
import * as THREE from 'three';
import { heightAt, biomeWeights } from '../world/gen.js';
import { SITES } from '../world/sites.js';
import { icon } from '../ui/icons.js';
import { input, lock, unlock } from '../input.js';

const K = (k) => `<span class="kbd">${k}</span>`;
// What she has to say, topic by topic. Each topic is one or more cards.
export const TOPICS = {
  intro: [
    { title: 'The Trial', body: 'You wake on Nisos because Zeus wills it. This island is your trial: survive it, grow strong on it, and bring down the beasts that rule its lands.<br><br>I am the Owl. I will find you whenever there is something you should know.' },
    { title: 'Everything Teaches', body: `Whatever you pick up shows you what it can become. Fallen branches give you wood; wood and stone make a club, a dagger, a hammer.<br><br>Press ${K('C')} to see what you can make, ${K('Tab')} for your pack, ${K('M')} for your map. An abandoned house is marked on it. Somewhere out in the meadows stands Zeus's temple: find it.` },
    { title: 'How You Move', body: `${K('WASD')} move · ${K('Shift')} sprint · ${K('Space')} jump · ${K('Ctrl')} sneak<br>${K('LMB')} strike · ${K('RMB')} block or draw the bow · ${K('E')} use · ${K('1')}–${K('8')} hotbar<br><br>Hunt with care: a beast that hasn't noticed you takes a sneak attack hard.` },
  ],
  night: [{ title: 'Night Is Coming', body: `Night and rain make you cold, and the cold slows your healing. Light a <b>campfire</b> (10 stone, 10 wood) and keep it fed with wood; rain drowns a fire that has no roof over it.<br><br>Make a <b>hammer</b> and hold ${K('RMB')} to build: walls, a roof, a <b>bed</b>. Sleep in it under a roof and the night passes, and you wake there if you fall.` }],
  house: [{ title: 'The Abandoned House', body: 'Someone lived here before you, and left in a hurry. Search the old chest: <b>rope</b> is hard to come by early on, and you will need it for an axe and for building.<br><br>When it runs out, rope comes from <b>leather</b> at a workbench. Leather comes from the animals of the meadows.' }],
  temple: [
    { title: 'The Ancient Temple', body: 'This is Zeus\'s house on Nisos. <b>Pray at the altar</b> before the steps once a day and he will bless you: more health, more speed, harder blows, for a while.<br><br>Its fire never dies. Warm yourself by it on cold nights.' },
    { title: 'The Offering Stands', body: 'The two stands by the steps wait for heads: the <b>Minotaur\'s</b> and the <b>Chimera\'s</b>. Bring them here and Zeus will give you the beast\'s power and teach you to work stronger things.' },
  ],
  olive: [{ title: 'The Marked Olives', body: 'See the marks cut into this ancient olive? The old ones left them to show the way to the <b>Minotaur\'s Labyrinth</b>.<br><br>Copy the marks with ' + K('E') + '. Each tree points to another; <b>three</b> pieces make the map.' }],
  labyrinth: [{ title: 'The Way Is Clear', body: 'The pieces fit. The <b>Labyrinth</b> is marked on your map and compass.<br><br>Its altar asks for a tribute: <b>5 deer hides and 10 olives</b>. Deer give hides; olive trees give olives once a day. Bring them, and bring a bow or a spear: the Minotaur shrugs off cuts and blows, but not points.' }],
  labyrinthAltar: [{ title: 'The Altar of the Minotaur', body: 'Lay the tribute here (' + K('E') + ') and he will come. He swings a great axe, charges, and roars hard enough to stun you. The dead of the Labyrinth rise to help him every half minute.<br><br>Eat well before you call him. If you run, the fight is over and the tribute is lost.' }],
  minotaurDown: [{ title: 'The Minotaur Is Dead', body: 'Well done. Take his <b>head</b> to the Ancient Temple and lay it on its stand. Zeus keeps his promises.' }],
  offered1: [{ title: 'The Next Land', body: `You have the Minotaur's roar now: ${K('F')} stuns everything around you. And you can work <b>lightstone</b>: better axes, spears and daggers, and Cretan armour from deer hides.<br><br>The forest of <b>Yleos</b> is next. Its master is the Chimera.` }],
  yleos: [{ title: 'Yleos', body: '<b>The dark forest.</b> Dryads live here and hunt on sight; they fear fire. Giants walk among the trees, slow but terrible: one blow can kill you. Eat your best food and wear armour.<br><br>Lightstone lies in these hills. A pickaxe breaks it out of the boulders.' }],
  cave: [{ title: 'The Giants\' Caves', body: 'The Giants carve what they see on the walls of their caves, and they have seen where the <b>Chimera</b> sleeps. Each cave has a guard.<br><br>Take a rubbing of the carving inside. Three of them will show you the way.' }],
  chimera: [{ title: 'The Chimera\'s Shrine', body: 'The carvings fit. The <b>Chimera\'s Shrine</b> is on your map.<br><br>Its altar asks for <b>3 dryad hearts and 10 pomegranates</b>. Some dryads carry a heart; pomegranate trees grow in the meadow groves.' }],
  chimeraAltar: [{ title: 'The Altar of the Chimera', body: 'Lion, goat and serpent in one body. It bites, it claws, and its tail stings whoever stands behind it, with venom. The forest answers its call every half minute.<br><br>It is the strongest thing on Nisos. Be ready.' }],
  chimeraDown: [{ title: 'The Chimera Is Dead', body: 'I did not think anyone could. Take its <b>head</b> to the Ancient Temple.' }],
  offered2: [{ title: 'The Trial So Far', body: `The Chimera's claws are yours (${K('F')}), and the Cretan bow.<br><br>Beyond Zeus's storm lies the marsh of <b>Valtos</b>. The storm will not part for you yet: that trial is still to come. Until then, Nisos is yours.` }],
  death: [{ title: 'You Fell', body: 'Zeus lifted you up again, as he will. Everything you carried lies in your <b>grave</b> where you fell: go back and take it (' + K('E') + '). A bed under a roof decides where you wake.' }],
};
const ORDER = Object.keys(TOPICS);

function owlModel() {
  const g = new THREE.Group(), fe = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.9, flatShading: true }), pale = new THREE.MeshStandardMaterial({ color: 0xe0d0b0, roughness: 0.9, flatShading: true });
  const eye = new THREE.MeshStandardMaterial({ color: 0xffc040, emissive: 0xc88010, emissiveIntensity: 0.8 }), dark = new THREE.MeshBasicMaterial({ color: 0x120a04 });
  const m = (geo, mat, x, y, z, p = g) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  m(new THREE.IcosahedronGeometry(0.17, 1), fe, 0, 0.22, 0).scale.set(1, 1.3, 0.95); m(new THREE.IcosahedronGeometry(0.12, 1), pale, 0, 0.2, 0.08).scale.set(1, 1.3, 0.6);
  const head = new THREE.Group(); head.position.y = 0.45; g.add(head); m(new THREE.IcosahedronGeometry(0.13, 1), fe, 0, 0, 0, head).scale.set(1.1, 0.95, 1);
  m(new THREE.CircleGeometry(0.1, 12), pale, 0, 0, 0.115, head).scale.set(1.3, 1, 1);
  for (const sx of [-1, 1]) { m(new THREE.SphereGeometry(0.035, 8, 6), eye, sx * 0.05, 0.01, 0.12, head); m(new THREE.SphereGeometry(0.017, 6, 4), dark, sx * 0.05, 0.01, 0.15, head); m(new THREE.ConeGeometry(0.03, 0.07, 4), fe, sx * 0.08, 0.12, 0, head).rotation.z = -sx * 0.3; }
  m(new THREE.ConeGeometry(0.02, 0.05, 4).rotateX(Math.PI / 2 + 0.6), new THREE.MeshStandardMaterial({ color: 0x4a3a28 }), 0, -0.035, 0.14, head);
  const wings = []; for (const sx of [-1, 1]) { const w = new THREE.Group(); w.position.set(sx * 0.14, 0.32, -0.02); g.add(w); m(new THREE.BoxGeometry(0.42, 0.03, 0.2).translate(sx * 0.2, 0, 0), fe, 0, 0, 0, w); wings.push(w); }
  m(new THREE.BoxGeometry(0.12, 0.03, 0.14).translate(0, 0, -0.05), fe, 0, 0.08, -0.14).rotation.x = 0.4;
  // the "!" that says she has something to tell you
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
  x.font = '900 112px Cinzel, Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = '#211610'; x.strokeText('!', 32, 68); x.fillStyle = '#ffcf4a'; x.fillText('!', 32, 68);
  const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); mark.scale.set(0.32, 0.64, 1); mark.position.y = 1.0; mark.renderOrder = 10; g.add(mark);
  g.scale.setScalar(1.25);
  return { g, head, wings, mark };
}

export class Owl {
  constructor(g) {
    this.g = g; this.st = g.S.owl ||= {}; this.st.done ||= []; this.st.queue ||= [];
    if (this.st.met && !this.st.done.includes('intro')) this.st.done.push('intro');   // older saves
    this.o = owlModel(); this.o.g.visible = false; g.scene.add(this.o.g);
    this.state = 'away'; this.t = 0; this.pos = this.o.g.position; this.vel = new THREE.Vector3(); this.cards = []; this.card = 0; this.checkT = 0;
    const box = document.createElement('div'); box.id = 'owlTalk'; box.className = 'pnl hidden';
    box.innerHTML = `<div class="who">${icon('star')}<span>The Owl</span></div><h3></h3><p></p><div class="foot"><span class="dots"></span><button class="btn" id="owlNext">Next</button></div>`;
    document.body.appendChild(box); this.box = box; box.querySelector('#owlNext').onclick = () => this.next();
    const base = g.onFirstItem; g.onFirstItem = (id) => { base?.(id); this.want('intro'); };
    const bd = g.onDeath; g.onDeath = () => { bd?.(); this.want('death'); };
  }
  // ---- topics
  want(topic) { if (this.st.done.includes(topic) || this.st.queue.includes(topic)) return; this.st.queue.push(topic); this.st.queue.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)); }
  get hasNews() { return this.st.queue.length > 0; }
  watch() {
    const g = this.g, P = g.player.pos, S = SITES, tr = g.trial?.st || {}, near = (s, r) => s && Math.hypot(s.x - P.x, s.z - P.z) < r;
    if (!this.st.done.includes('intro')) return;                           // nothing else before the first meeting
    if (g.S.time > 0.62 && g.S.time < 0.74) this.want('night');
    if (near(S.house, 30)) this.want('house');
    if (near(S.temple, 38)) this.want('temple');
    if (S.olives.some((o) => near(o, 18)) || tr.scraps?.length) this.want('olive');
    if (tr.revealed?.labyrinth) this.want('labyrinth');
    if (near(S.labyrinth, 32)) this.want('labyrinthAltar');
    if (tr.down?.minotaur) this.want('minotaurDown');
    if (tr.offered?.minotaur) this.want('offered1');
    if (biomeWeights(P.x, P.z).y > 0.75) this.want('yleos');
    if (S.caves.some((c) => near(c, 60)) || tr.carvings?.length) this.want('cave');
    if (tr.revealed?.chimera) this.want('chimera');
    if (near(S.chimera, 34)) this.want('chimeraAltar');
    if (tr.down?.chimera) this.want('chimeraDown');
    if (tr.offered?.chimera) this.want('offered2');
  }
  // ---- talking
  talk() {
    if (!this.hasNews) return;
    this.cards = this.st.queue.flatMap((t) => TOPICS[t]); this.talked = [...this.st.queue]; this.card = 0;
    this.open = true; this.box.classList.remove('hidden'); input.uiOpen = true; unlock(); this.draw(); this.g.sound?.('owl');
  }
  next() { this.card++; if (this.card >= this.cards.length) this.close(); else this.draw(); }
  close() {
    this.open = false; this.box.classList.add('hidden'); input.uiOpen = this.g.hud.open || this.g.map?.open || false; if (!input.uiOpen) lock();
    for (const t of this.talked || []) { if (!this.st.done.includes(t)) this.st.done.push(t); this.st.queue.splice(this.st.queue.indexOf(t), 1); }
    this.st.met = true; this.leave();
  }
  draw() { const c = this.cards[this.card]; this.box.querySelector('h3').textContent = c.title; this.box.querySelector('p').innerHTML = c.body; this.box.querySelector('.dots').innerHTML = this.cards.map((_, i) => `<i class="${i === this.card ? 'on' : ''}"></i>`).join(''); this.box.querySelector('#owlNext').textContent = this.card === this.cards.length - 1 ? 'Farewell' : 'Next'; }
  // is she roughly where the hero is facing (then E talks to her before anything else)
  faced() { const P = this.g.player, dx = this.pos.x - P.pos.x, dz = this.pos.z - P.pos.z; return Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - P.yaw), Math.cos(Math.atan2(dx, dz) - P.yaw))) < 1.25; }
  interactable(pos) { if (this.state !== 'escort' || !this.hasNews || this.pos.distanceTo(pos.clone().setY(pos.y + 1.5)) > 4.5) return null; return { label: 'Talk to the Owl', sub: 'She has something to tell you', use: () => this.talk() }; }
  // ---- flying
  arrive() { const P = this.g.player.pos; this.state = 'escort'; this.o.g.visible = true; this.pos.copy(P).add(new THREE.Vector3(25, 22, -15)); this.vel.set(0, 0, 0); this.g.sound?.('owl'); this.g.hud.toast('The <b>Owl</b> has something to tell you <span class="kbd">E</span>'); }
  leave() { this.state = 'leave'; this.t = 0; this.from = this.pos.clone(); }
  escortTarget(out) {
    const P = this.g.player, side = new THREE.Vector3(Math.cos(P.yaw), 0, -Math.sin(P.yaw)), fwd = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    out.copy(P.pos).addScaledVector(side, -1.9).addScaledVector(fwd, 1.1); const gy = Math.max(heightAt(out.x, out.z), P.pos.y - 0.5); out.y = gy + 2.5 + Math.sin(this.t * 1.7) * 0.15;   // up and off to the side, out of your view
    return out;
  }
  update(dt) {
    const g = this.g, o = this.o; this.t += dt;
    if (this.open && (input.pressed.has('Enter') || input.pressed.has('KeyE') || input.pressed.has('Space'))) this.next();
    if (this.open && input.pressed.has('Escape')) this.close();
    this.checkT -= dt; if (this.checkT <= 0) { this.checkT = 0.5; this.watch(); }
    const busy = !!g.trial?.boss || g.player.dead;
    if (this.state === 'away' && this.hasNews && !busy && !this.open) this.arrive();
    if (this.state === 'escort') {
      // fly alongside, catching up quickly when far behind; flap when moving, glide when keeping pace
      const want = this.escortTarget(new THREE.Vector3()), d = want.clone().sub(this.pos), dist = d.length();
      if (dist > 70) this.pos.copy(want).add(new THREE.Vector3(0, 6, 0));
      const k = Math.min(1, dt * (dist > 8 ? 2.2 : 3.5)); this.vel.lerp(d.multiplyScalar(dist > 8 ? 1.6 : 2.5), k); this.pos.addScaledVector(this.vel, dt);
      const sp = this.vel.length(), face = Math.atan2(this.vel.x, this.vel.z);
      if (sp > 0.4) o.g.rotation.y += Math.atan2(Math.sin(face - o.g.rotation.y), Math.cos(face - o.g.rotation.y)) * Math.min(1, dt * 5);
      else { const P = g.player.pos, look = Math.atan2(P.x - this.pos.x, P.z - this.pos.z); o.g.rotation.y += Math.atan2(Math.sin(look - o.g.rotation.y), Math.cos(look - o.g.rotation.y)) * Math.min(1, dt * 3); }
      const flap = sp > 3 ? 14 : 9; o.wings.forEach((w, i) => (w.rotation.z = Math.sin(this.t * flap) * (sp > 3 ? 0.75 : 0.5) * (i ? -1 : 1)));
      o.head.rotation.y = Math.sin(this.t * 0.8) * 0.25;
      o.mark.visible = this.hasNews && !this.open; o.mark.position.y = 1.0 + Math.sin(this.t * 3) * 0.06; o.mark.material.rotation = Math.sin(this.t * 2) * 0.08;
      if (!this.hasNews && !this.open) this.leave();
    } else if (this.state === 'leave') {
      o.mark.visible = false; const k = Math.min(1, this.t / 3.5); this.pos.copy(this.from).add(new THREE.Vector3(30 * k * k, 26 * k * k, -20 * k * k));
      o.wings.forEach((w, i) => (w.rotation.z = Math.sin(this.t * 13) * 0.7 * (i ? -1 : 1))); o.g.rotation.y = Math.atan2(30, -20);
      if (k >= 1) { this.state = 'away'; o.g.visible = false; }
    }
  }
}
