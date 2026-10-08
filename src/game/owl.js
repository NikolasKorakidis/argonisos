// The Owl, Athena's messenger. The first time you pick something up she glides down, perches nearby and tells you how
// the trial works, a card at a time. Talk to her again (E) for a reminder; she leaves at dusk and comes back by day.
import * as THREE from 'three';
import { heightAt } from '../world/gen.js';
import { icon } from '../ui/icons.js';
import { input, lock, unlock } from '../input.js';

const CARDS = [
  { title: 'The Trial', body: 'You wake on Nisos because Zeus wills it. This island is your trial: survive it, grow strong on it, and bring down the beasts that rule its lands.<br><br>I am the Owl. I will tell you what I know.' },
  { title: 'Everything Teaches', body: 'Whatever you pick up shows you what it can become. A stone and a branch are the start of a club, a fire, a hammer.<br><br>Press <span class="kbd">C</span> to see what you can make. Press <span class="kbd">Tab</span> for your pack.' },
  { title: 'Fire and a Roof', body: 'The nights are cold and the rain soaks you to the bone. Light a fire and keep it fed; rain will drown it unless it has a roof over it.<br><br>Make a <b>hammer</b> and raise walls and a roof. A <b>bed</b> under a roof lets you sleep the night away, and calls you back when you fall.' },
  { title: 'The Masters of the Lands', body: 'Each land has a master. Their lairs are hidden, but the old ones left marks: carvings on <b>ancient olive trees</b> in the plains, and in the <b>caves of the Giants</b> in the forest. Find three and you will know the way.<br><br>At the lair, lay the <b>tribute</b> its altar asks for, and the beast will come.' },
  { title: 'Zeus', body: 'Take each beast\'s head to the <b>Ancient Temple</b> (it is on your map, <span class="kbd">M</span>). Zeus will grant you its power, <span class="kbd">F</span>, and teach you to work stronger things.<br><br>Pray at his altar once a day for his blessing. The marsh of Valtos lies behind his storm: it is not yet your time.' },
  { title: 'How You Move', body: '<span class="kbd">WASD</span> move · <span class="kbd">Shift</span> sprint · <span class="kbd">Space</span> jump · <span class="kbd">Ctrl</span> sneak<br><span class="kbd">LMB</span> strike · <span class="kbd">RMB</span> block (or draw the bow) · <span class="kbd">E</span> use · <span class="kbd">1</span>–<span class="kbd">8</span> hotbar<br><br>Go well, hero. I will be near.' },
];

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
  return { g, head, wings };
}

export class Owl {
  constructor(g) {
    this.g = g; this.st = (g.S.owl ||= { met: false }); this.o = owlModel(); this.o.g.visible = false; g.scene.add(this.o.g);
    this.state = 'away'; this.t = 0; this.pos = this.o.g.position; this.card = 0;
    const box = document.createElement('div'); box.id = 'owlTalk'; box.className = 'pnl hidden';
    box.innerHTML = `<div class="who">${icon('star')}<span>The Owl</span></div><h3></h3><p></p><div class="foot"><span class="dots"></span><button class="btn" id="owlNext">Next</button></div>`;
    document.body.appendChild(box); this.box = box; box.querySelector('#owlNext').onclick = () => this.next();
    const base = g.onFirstItem; g.onFirstItem = (id) => { base?.(id); if (!this.st.met && this.state === 'away') this.arrive(); };
  }
  arrive() { const P = this.g.player.pos; this.state = 'fly'; this.t = 0; this.o.g.visible = true; this.from = P.clone().add(new THREE.Vector3(30, 25, -20)); this.pos.copy(this.from); this.perch(); this.g.sound?.('owl'); }
  perch() { const P = this.g.player.pos, a = this.g.player.yaw + 0.6, x = P.x + Math.sin(a) * 3.2, z = P.z + Math.cos(a) * 3.2; this.to = new THREE.Vector3(x, Math.max(heightAt(x, z), this.g.player.floorAt?.(new THREE.Vector3(x, P.y + 1, z)) ?? -1e9, 0) + 0.02, z); }
  talk() { this.card = 0; this.open = true; this.box.classList.remove('hidden'); input.uiOpen = true; unlock(); this.draw(); this.g.sound?.('owl'); }
  next() { this.card++; if (this.card >= CARDS.length) { this.close(); return; } this.draw(); }
  close() { this.open = false; this.box.classList.add('hidden'); input.uiOpen = this.g.hud.open || this.g.map?.open || false; if (!input.uiOpen) lock(); this.st.met = true; }
  draw() { const c = CARDS[this.card]; this.box.querySelector('h3').textContent = c.title; this.box.querySelector('p').innerHTML = c.body; this.box.querySelector('.dots').innerHTML = CARDS.map((_, i) => `<i class="${i === this.card ? 'on' : ''}"></i>`).join(''); this.box.querySelector('#owlNext').textContent = this.card === CARDS.length - 1 ? 'Farewell' : 'Next'; }
  interactable(pos) { if (this.state !== 'perched' || this.pos.distanceTo(pos) > 3.2) return null; return { label: 'Talk to the Owl', sub: "Athena's messenger", use: () => this.talk() }; }
  update(dt) {
    const o = this.o, P = this.g.player; this.t += dt;
    if (this.open && (input.keys.Enter || input.pressed.has('KeyE') || input.pressed.has('Space'))) this.next();
    if (this.open && input.pressed.has('Escape')) this.close();
    if (this.state === 'fly') {
      const k = Math.min(1, this.t / 4), e = k * k * (3 - 2 * k); this.pos.lerpVectors(this.from, this.to, e); this.pos.y += Math.sin(k * Math.PI) * 4;
      o.g.lookAt(this.to.x, this.pos.y, this.to.z); o.wings.forEach((w, i) => (w.rotation.z = Math.sin(this.t * 14) * 0.7 * (i ? -1 : 1)));
      if (k >= 1) { this.state = 'perched'; this.t = 0; o.wings.forEach((w) => (w.rotation.z = 0)); if (!this.st.met) setTimeout(() => this.talk(), 600); }
    } else if (this.state === 'perched') {
      o.head.rotation.y = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z) - o.g.rotation.y + Math.sin(this.t * 0.7) * 0.3;
      o.g.position.y = this.to.y + Math.abs(Math.sin(this.t * 0.8)) * 0.01;
      // she follows at a distance; if you go far she flies to you again, and leaves at night
      if (this.st.met && P.pos.distanceTo(this.pos) > 45) { this.from = this.pos.clone(); this.perch(); this.state = 'fly'; this.t = 0; }
      if (this.g.S.time > 0.74 && this.st.met) { this.state = 'leave'; this.t = 0; this.from = this.pos.clone(); this.to = this.pos.clone().add(new THREE.Vector3(40, 40, 20)); }
    } else if (this.state === 'leave') {
      const k = Math.min(1, this.t / 4); this.pos.lerpVectors(this.from, this.to, k * k); o.wings.forEach((w, i) => (w.rotation.z = Math.sin(this.t * 14) * 0.7 * (i ? -1 : 1)));
      if (k >= 1) { this.state = 'away'; o.g.visible = false; }
    } else if (this.state === 'away' && this.st.met && this.g.S.time > 0.05 && this.g.S.time < 0.7 && Math.random() < dt * 0.01) this.arrive();
  }
}
