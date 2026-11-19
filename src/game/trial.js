// The trial of Zeus: the path from the meadow to the bosses.
//   Clues: three of the five marked olive trees in Pedias piece together the way to the Minotaur's Labyrinth; three of
//   the four Giant caves in Yleos (each guarded) show where the Chimera sleeps.
//   Tribute: lay it on the boss's altar to call it: 5 deer hides and 10 olives for the Minotaur, 3 dryad hearts and
//   10 pomegranates for the Chimera. Mid-fight, the dead (or the forest) come to the boss's aid every 30 seconds.
//   Offering: bring the head to the Ancient Temple. Zeus grants its power (F) and the next tier of crafting.
//   Prayer: once a day at the temple altar, Zeus's Blessing. (And once ever at the old altar on the top of Olympos,
//   which nothing points the way to: the whole island opens on your map.)
import * as THREE from 'three';
import { TYPES } from '../creatures/creatures.js';
import { SITES } from '../world/sites.js';
import { ITEMS } from './items.js';
import { icon } from '../ui/icons.js';
import { dust, burst, addShake, punch, rumble, pillar, blast, slowMo, spark } from '../render/fx.js';
import { askLight } from '../render/lights.js';
import { setWeather } from '../world/weather.js';
import { hit } from '../input.js';
import { clamp, rr } from '../util/math.js';
import { loadGLB } from '../assets.js';

// what stops a giant boss (creatures.js BIG): not rubble (low), not trees and rocks
const SOLID = (k) => !k.low && k.ref?.sp === undefined;
const FT = 0.3048, angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
// The bosses are giants (Patch 21): the Minotaur stands 10.5 m to his horns, five and a half times the hero, and the
// Chimera is 23 m from its jaws to its tail and nearly 9 m tall at the head (size: its model drawn that many times its
// own size, models.js KIT; pace: its blows and roars played that much slower, for their weight). Their bodies, reach and
// moves (bossThink) are drawn to that size: r, h, the Chimera's long body a capsule (body: from behind its middle to in
// front, creatures.js gap). Stronger to match: nearly twice the Minotaur's health and a third more for the Chimera, their
// blows a third harder than before, so a fight takes a while and a blow taken really hurts, but the gear of the time
// (the first weapons and thrower's armour for the Minotaur, lightstone and Cretan armour for the Chimera) still wins it.
TYPES.minotaur = { name: 'The Minotaur', boss: true, hp: [900, 900], block: 30, speed: [6 * FT, 9.4], sight: 90, dmg: [24, 30, 'slash'], reach: 5, r: 2.4, h: 10.5, size: 3.3, pace: 0.88, mob: [1, 1], heavy: true,
  weak: ['pierce'], resist: ['slash', 'blunt'], drops: [['sharpBone', 20, 30, 1], ['minotaurHide', 12, 12, 1], ['minotaurHead', 1, 1, 1]], thunder: 'big', helpers: 'skeleton' };
TYPES.chimera = { name: 'The Chimera', boss: true, hp: [3300, 3300], block: 40, speed: [8 * FT, 9.6], sight: 100, dmg: [45, 56, 'pierce'], reach: 6.5, r: 4, h: 8.9, size: 3.8, pace: 0.9, body: [-11, 4], mob: [1, 1], heavy: true,
  weak: ['poison'], resist: ['slash', 'fire'], drops: [['dryadHeart', 20, 30, 1], ['chimeraHide', 1, 1, 1], ['chimeraHead', 1, 1, 1]], thunder: 'big', helpers: 'dryad' };
// a boss's coming, in seconds from the tribute (Trial.stage): the pillar of light rises (light), the beast drops into it
// from high metres up (drop) and lands (land), roars a while before it comes for you (roar), and the camera is yours again (done)
const ARRIVE = { light: 1.9, drop: 2.55, land: 2.95, high: 45, roar: 1.8, done: 5.6 };
const TRIBUTE = { minotaur: { deerHide: 5, olive: 10 }, chimera: { dryadHeart: 3, pomegranate: 10 } };
const BOSS_NAME = { minotaur: 'the Minotaur', chimera: 'the Chimera' };
export const POWERS = {
  roar: { name: "Minotaur's Roar", icon: 'zeus', cd: 300, desc: 'Press F: a roar that stuns every creature around you and sends them reeling.' },
  claw: { name: "Chimera's Claws", icon: 'blessing', cd: 600, time: 300, desc: 'Press F: for five minutes your bare hands strike like the Chimera\'s claws.' },
};

// A shaft of light out of the sky onto at (a Vector3): two soft cylinders of gold, wide at the top, that flare up and fade
// over a few seconds, then go
function skyBeam(scene, at) {
  const grp = new THREE.Group(), t0 = performance.now(); grp.position.copy(at);
  for (const [r0, r1, k] of [[0.5, 6, 0.35], [0.18, 2.2, 0.7]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 320, 24, 1, true).translate(0, 160, 0), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.frustumCulled = false; m.onBeforeRender = () => { const t = (performance.now() - t0) / 1000; m.material.opacity = k * Math.min(1, t * 4) * (1 - Math.min(1, Math.max(0, (t - 1.8) / 2.6))); }; grp.add(m);
  }
  scene.add(grp); setTimeout(() => { scene.remove(grp); grp.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); }, 4800);
}

export class Trial {
  constructor(g) {
    this.g = g; const st = (g.S.trial ||= { scraps: [], carvings: [], revealed: {}, down: {}, offered: {}, prayDay: -1, looted: [], power: null, powerCd: 0, guards: {}, olympos: false });
    this.st = st; this.boss = null; this.helperT = 0;
    const bar = document.createElement('div'); bar.id = 'bossBar'; bar.className = 'hidden'; bar.innerHTML = '<div class="bn"></div><div class="bb"><i></i></div>'; document.getElementById('hud').appendChild(bar); this.bar = bar;
    const pw = document.createElement('div'); pw.id = 'power'; pw.className = 'hidden'; document.getElementById('hud').appendChild(pw); this.pw = pw;
    g.onKill = (c) => this.onKill(c);
  }
  // ---- what E does at the trial's places
  interactable(pos) {
    const S = this.g.structures; if (!S) return null;
    let best = null, bd = 99; for (const u of S.uses) { const d = Math.hypot(u.at.x - pos.x, u.at.z - pos.z); if (d < u.r && d < bd && Math.abs(u.at.y - pos.y) < 4) { bd = d; best = u; } }
    if (!best) return null; const u = best, st = this.st, inv = this.g.inv;
    if (u.kind === 'altar') return { label: st.prayDay === this.g.S.day ? 'Zeus has heard you today' : 'Pray to Zeus', sub: 'Altar of Zeus', use: () => this.pray(u) };
    if (u.kind === 'olympos') return st.olympos ? { label: 'The island already lies open before you', sub: 'Altar of Zeus on Olympos', use: () => this.g.hud.toast('Zeus has already opened your eyes: the whole island is on your map (<span class="kbd">M</span>).') }
      : { label: 'Pray to Zeus', sub: 'Altar of Zeus on Olympos', use: () => this.prayOlympos(u) };
    if (u.kind === 'offering') { const head = u.boss + 'Head'; if (st.offered[u.boss]) return { label: `${ITEMS[head].name} offered`, sub: POWERS[u.boss === 'minotaur' ? 'roar' : 'claw'].name, use: () => this.choosePower(u.boss) };
      return { label: inv.count(head) ? `Offer the ${ITEMS[head].name.toLowerCase()}` : `A place for the head of ${BOSS_NAME[u.boss]}`, sub: 'Offering stand', use: () => this.offer(u) }; }
    if (u.kind === 'loot') return st.looted.includes(u.id) ? { label: 'Empty', sub: 'Old chest', use: () => {} } : { label: 'Search the old chest', sub: u.sub || 'Abandoned house', use: () => this.loot(u) };
    if (u.kind === 'scrap') return st.scraps.includes(u.id) ? { label: 'You already copied these marks', sub: this.nextHint('scraps'), use: () => this.pointNext('scraps', true) } : { label: 'Copy the carved marks', sub: 'Ancient olive', use: () => this.clue(u, 'scraps', 'oliveScrap') };
    if (u.kind === 'carving') return st.carvings.includes(u.id) ? { label: 'You already took this carving', sub: this.nextHint('carvings'), use: () => this.pointNext('carvings', true) } : { label: 'Take a rubbing of the carving', sub: 'Giant cave', use: () => this.clue(u, 'carvings', 'caveCarving') };
    if (u.kind === 'summon') {
      if (st.down[u.boss]) return { label: 'The altar is silent', sub: `${BOSS_NAME[u.boss][0].toUpperCase() + BOSS_NAME[u.boss].slice(1)} is no more`, use: () => {} };
      if (this.boss) return { label: 'The fight is on', sub: '', use: () => {} };
      const T = TRIBUTE[u.boss], txt = Object.entries(T).map(([id, n]) => `${n} ${ITEMS[id].name.toLowerCase()}${n > 1 && !ITEMS[id].name.endsWith('s') ? 's' : ''}`).join(' and ');
      return { label: inv.has(T) ? `Lay the tribute: ${txt}` : `The altar asks for ${txt}`, sub: `Altar of ${BOSS_NAME[u.boss]}`, use: () => this.summon(u) };
    }
    return null;
  }
  // Kneel at the altar and pray a few seconds (game/acts.js); stand up first and Zeus doesn't hear you
  pray(u) {
    const g = this.g; if (this.st.prayDay === g.S.day) { g.hud.toast('Zeus has already blessed you today. Come back tomorrow.'); return; }
    if (g.acts?.pose?.kind === 'pray') return;
    if (!g.acts?.pray(u.at, { onDone: () => this.bless(u), onCancel: () => g.hud.toast('You rose before Zeus answered. Kneel again (<span class="kbd">E</span>) and stay still to pray.') })) this.bless(u);
  }
  bless(u) {
    const g = this.g; if (this.st.prayDay === g.S.day) return;
    this.st.prayDay = g.S.day; g.player.stats.add('zeusBlessing'); g.player.stats.heal(99);
    burst(u.at.clone().setY(u.at.y + 1.8), { color: 0xffe08a, n: 40, speed: 3, size: 0.07, grav: -3, life: 1.6 }); g.flashSky(0.35); addShake(0.3); g.sound?.('thunder');
    g.hud.region("Zeus's Blessing", 'Your strength grows for a while');
  }
  // The old altar on the top of Olympos, an Easter egg (no step of the guide and nothing the owl says leads there): praying
  // at it once opens the whole island, the map uncovered everywhere and every place of the trial marked on it (the
  // abandoned town isn't one: map.sites leaves it to be come upon, uncovered but unmarked). Zeus answers with a shaft of
  // light on the altar and a crack of thunder, and the map opens to show it. Kept in the save (st.olympos).
  prayOlympos(u) {
    const g = this.g; if (this.st.olympos || g.acts?.pose?.kind === 'pray') return;
    if (!g.acts?.pray(u.at, { onDone: () => this.reveal(u), onCancel: () => g.hud.toast('You rose before Zeus answered. Kneel again (<span class="kbd">E</span>) and stay still to pray.') })) this.reveal(u);
  }
  reveal(u) {
    const g = this.g, m = g.map; if (this.st.olympos) return; this.st.olympos = true;
    m.fctx.clearRect(0, 0, m.fog.width, m.fog.height); for (const s of m.sites()) m.know(s);
    skyBeam(g.scene, u.at); burst(u.at.clone().setY(u.at.y + 1.8), { color: 0xffe08a, n: 90, speed: 5, size: 0.09, grav: -2, life: 2.4 });
    g.flashSky(0.7); addShake(0.6); g.sound?.('thunder', 1.5); setTimeout(() => g.sound?.('reveal'), 1200);
    g.hud.region('Zeus opens your eyes', 'The whole island lies before you');
    setTimeout(() => { g.hud.toast('Zeus opens your eyes: the whole island lies before you. Every place is on your map now.'); if (!m.open && !g.hud.open && !g.player.dead) m.toggle(true); }, 3200);
  }
  loot(u) { const g = this.g; g.acts?.reach(); this.st.looted.push(u.id); for (const [id, n] of u.items) g.give(id, n); if (u.lid) u.lid.rotation.x = -1.2; g.sound?.('chest'); }
  clue(u, key, item) {
    const g = this.g; this.st[key].push(u.id); u.taken = true; g.give(item, 1); burst(u.at.clone().setY(u.at.y + 1.4), { color: 0xffe7a0, n: 16, speed: 1.4, grav: -1.5 });
    const n = this.st[key].length, boss = key === 'scraps' ? 'labyrinth' : 'chimera';
    if (n < 3) {
      g.hud.toast(key === 'scraps' ? `The marks are part of a map. <b>${n} of 3</b> pieces.` : `A carving of the forest and a beast. <b>${n} of 3</b> pieces.`);
      setTimeout(() => this.pointNext(key), 1800); return;
    }
    if (this.st.revealed[boss]) return;
    this.st.revealed[boss] = true;
    g.hud.region(boss === 'labyrinth' ? 'The Labyrinth' : "The Chimera's Shrine", boss === 'labyrinth' ? 'The pieces fit: the way to the Minotaur is marked on your map' : 'The carvings fit: the Chimera\'s lair is marked on your map');
    g.sound?.('reveal'); g.map?.reveal(SITES[boss]);
  }
  // The clue sites not yet done, by distance from the player
  remaining(key) {
    const P = this.g.player.pos, list = key === 'scraps' ? SITES.olives.map((s, i) => [s, 'olive' + i]) : SITES.caves.map((s, i) => [s, 'cave' + i]);
    return list.filter(([, id]) => !this.st[key].includes(id)).map(([s]) => s).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
  }
  nextHint(key) { const done = this.st[key].length; if (done >= 3) return key === 'scraps' ? 'The Labyrinth is on your map' : "The Chimera's shrine is on your map"; return `${done} of 3 · the next is marked on your map`; }
  // Each piece shows where to find another: mark the nearest one not yet done on the map and compass
  pointNext(key, again) {
    if (this.st[key].length >= 3) return; const s = this.remaining(key)[0]; if (!s) return;
    const known = this.g.map?.isKnown(s); this.g.map?.reveal(s);
    const d = Math.round(Math.hypot(s.x - this.g.player.pos.x, s.z - this.g.player.pos.z));
    if (!known || again) this.g.hud.toast(key === 'scraps' ? `The marks point to another <b>ancient olive</b>, about ${d} m away. It's on your map and compass.` : `The carving shows another <b>Giant cave</b>, about ${d} m away. It's on your map and compass.`);
  }
  summon(u) {
    const g = this.g, T = TRIBUTE[u.boss]; if (!g.inv.has(T)) { g.hud.toast('You don\'t have the tribute yet'); return; }
    g.inv.takeMats(T); g.sound?.('summon'); this.calling = u.boss;   // (the beast is on its way: its music starts now, audio/music.js)
    g.acts?.kneel(u.center, 2.8);   // (kneeling while the beast is called)
    setWeather('thunder'); g.flashSky(0.5); addShake(0.4);
    dust(u.center.clone().setY(u.center.y + 1), 40, 0x6a5a48, 0.9);
    g.hud.region(u.boss === 'minotaur' ? 'The Minotaur' : 'The Chimera', u.boss === 'minotaur' ? 'Lord of the Labyrinth' : 'The beast of three natures');
    this.arrival = { u, t: 0, at: (u.land || u.center).clone(), did: {} }; g.player.focus = this.arrival.at;
  }
  // ---- the boss's coming (ARRIVE, seconds after the tribute is laid): the ground shakes harder and harder, dust and grit
  // falling from the walls; a pillar of light rises where it will come down, and it drops out of the sky inside it, roaring;
  // it lands with a blast (a flash, a shockwave racing out along the ground, rocks and chunks flung out, a moment of slow
  // motion), and the place breaks (structures.js ruin: walls falling, columns toppling, the floor cracked round a crater),
  // knocking you off your feet if you're close; it stands and roars, and the fight is on. The camera turns to watch it
  // (player.focus) and draws back to take it in (player.bossCam). Run from update(), and from game.js while a menu is open.
  stage(dt) {
    const A = this.arrival; if (!A) return; const g = this.g, P = g.player, u = A.u, at = A.at, once = (k) => !A.did[k] && (A.did[k] = true), t = (A.t += dt);
    if (t < ARRIVE.land) rumble(0.18 + 0.4 * Math.min(1, t / ARRIVE.land) ** 2);
    if (once('quake')) g.sound?.('quake', { dur: ARRIVE.land });
    if (t < ARRIVE.land && Math.random() < dt * 14) {   // (dust and grit shaken down off whatever stands round the arena)
      const a = Math.random() * 6.283, r = 8 + Math.random() * 14, p = u.center.clone().add(new THREE.Vector3(Math.cos(a) * r, 0.3 + Math.random() * 2.5, Math.sin(a) * r));
      dust(p, 2, 0x6e6254, 0.35); burst(p, { color: 0x8f8678, n: 3, speed: 1, size: 0.07, up: 0.5 }); }
    if (t > 1.0 && once('thunder')) { g.sound?.('thunder', 1.2); g.flashSky(0.35); }
    if (t > ARRIVE.light && once('light')) { pillar(at, { rise: ARRIVE.drop - ARRIVE.light, high: 80, r: u.boss === 'chimera' ? 4 : 3 }); g.flashSky(0.7); }
    if (t > ARRIVE.drop && once('drop')) {   // out of the sky, roaring
      this.calling = null; const c = g.creatures.spawn(u.boss, at.x, at.z, { level: 0, boss: true, aware: true }); c.state = 'chase'; c.arena = u.center.clone(); this.boss = c; this.helperT = 30; this.bossKind = u.boss;
      c.yaw = Math.atan2(P.pos.x - at.x, P.pos.z - at.z); c.intro = 99; c.ctl = { want: 0, at, air: ARRIVE.high }; A.c = c;
      g.sound?.('roar', { boss: true, long: true, at }); this.bar.classList.remove('hidden'); this.bar.querySelector('.bn').textContent = c.T.name; }
    if (A.c && !A.landed) { const k = Math.min(1, (t - ARRIVE.drop) / (ARRIVE.land - ARRIVE.drop)); A.c.fall = ARRIVE.high * (1 - k * k); }
    if (t > ARRIVE.land && once('land')) {   // the blast
      const c = A.c; A.landed = true; if (c) { c.fall = undefined; c.intro = ARRIVE.roar; }
      blast(at, { reach: u.boss === 'chimera' ? 44 : 40 }); g.sound?.('blast', { at }); g.flashSky(1); punch(1, { x: P.pos.x - at.x, z: P.pos.z - at.z }); addShake(1); slowMo(0.7, 0.3);
      burst(at.clone().setY(at.y + 1), { color: 0x7d7062, n: 70, speed: 16, size: 0.45, life: 2.6, grav: 16, up: 11, spread: 1.4 });   // (rocks and chunks flung out)
      burst(at.clone().setY(at.y + 0.5), { color: 0x5e554b, n: 30, speed: 10, size: 0.6, life: 2.2, grav: 18, up: 7 }); spark(at.clone().setY(at.y + 1), 30);
      dust(at.clone().setY(at.y + 1), 24, 0x6e6254, 1);
      g.structures?.ruin?.(u.boss === 'chimera' ? 'chimera' : 'labyrinth', { live: true }); (this.st.broken ||= {})[u.boss === 'chimera' ? 'chimera' : 'labyrinth'] = true;
      // (near it, you're thrown off your feet: the further, the gentler)
      const d = Math.hypot(P.pos.x - at.x, P.pos.z - at.z), k = Math.max(0, 1 - d / 22);
      if (k > 0 && !P.dead) { const dir = new THREE.Vector3(P.pos.x - at.x, 0, P.pos.z - at.z).normalize(); g.acts?.hurt?.(30); P.hv.addScaledVector(dir, 6 + 10 * k); P.vel.y = 3 + 4 * k; P.onGround = false; if (k > 0.4) P.stats.add('stunned', 0.8); }
    }
    if (A.landed && t < ARRIVE.land + 0.25) askLight(at.clone().setY(at.y + 4), 60, 70, 0xffe2b0);   // (the flash lighting the ruin)
    if (t > ARRIVE.done) { this.arrival = null; P.focus = null; }
  }
  onKill(c) {
    if (c !== this.boss) return;
    const g = this.g; this.st.down[this.bossKind] = true; this.boss = null; this.bar.classList.add('hidden'); setWeather(null);
    for (const k of g.creatures.list) if (k.summoned && !k.dead) g.creatures.hurt(k, [[9999, 'force']], null);
    g.hud.region(`${BOSS_NAME[this.bossKind][0].toUpperCase()}${BOSS_NAME[this.bossKind].slice(1)} has fallen`, 'Take its head to Zeus at the Ancient Temple');
    g.acts?.later.push({ t: 1.2, fn: () => g.acts.cheer() });   // (arms raised in triumph)
    g.map?.reveal(SITES.temple);
  }
  offer(u) {
    const g = this.g, head = u.boss + 'Head'; if (!g.inv.count(head)) { g.hud.toast(`Only the head of ${BOSS_NAME[u.boss]} belongs here`); return; }
    g.inv.take(head, 1); this.st.offered[u.boss] = true; this.mountHead(u); g.acts?.kneel(u.at, 2.6);   // (kneeling as Zeus answers)
    const tier = u.boss === 'minotaur' ? 1 : 2; g.S.tier = Math.max(g.S.tier || 0, tier);
    this.st.power = u.boss === 'minotaur' ? 'roar' : 'claw'; this.st.powerCd = 0;
    g.flashSky(0.6); addShake(0.6); burst(u.at.clone().setY(u.at.y + 2), { color: 0xffe08a, n: 60, speed: 4, size: 0.08, grav: -2, life: 2 }); g.sound?.('thunder'); setTimeout(() => g.sound?.('reveal'), 900);
    const P = POWERS[this.st.power];
    g.hud.region(P.name, 'Zeus grants you the power of the beast. Press F to use it.');
    setTimeout(() => g.hud.toast(tier === 1 ? 'You can now work <b>lightstone</b>: new weapons and Cretan armour at the workbench.' : 'You can now make the <b>Cretan bow</b> and bronze <b>Corinthian armour</b>. Zeus\'s storm over Valtos still holds: that trial is yet to come.'), 4500);
    g.crafting.discover(); this.drawPower();
  }
  choosePower(boss) { this.st.power = boss === 'minotaur' ? 'roar' : 'claw'; this.g.hud.toast(`Power set: <b>${POWERS[this.st.power].name}</b>`); this.drawPower(); }
  // the head on its stand (on offering, and for heads offered before, as the save loads): the boss's own (bossHead), or
  // a carved one without the pack
  mountHead(u) {
    if (u.mounted) return; u.mounted = true;
    bossHead(u.boss).catch((e) => { console.warn(u.boss, 'head failed', e); return null; }).then((h) => u.mount.add(h ? h.clone() : carvedHead(u.boss)));
  }
  // ---- powers (F)
  usePower() {
    const g = this.g, st = this.st; if (!st.power) { g.hud.toast('No power yet. Offer a boss\'s head at the Ancient Temple.'); return; }
    if (st.powerCd > 0) { g.hud.toast(`${POWERS[st.power].name} returns in ${Math.ceil(st.powerCd)}s`); return; }
    st.powerCd = POWERS[st.power].cd; const P = g.player;
    if (st.power === 'roar') {
      dust(P.pos.clone().setY(P.pos.y + 0.5), 40, 0xc8b898, 0.8); addShake(0.7); g.sound?.('roar');
      for (const c of g.creatures.list) if (!c.dead && c.pos.distanceTo(P.pos) < 15) { c.hitT = c.boss ? 1.5 : 4; c.atkCd = 4; if (!c.boss) { c.state = 'flee'; c.t = 4; } g.creatures.hurt(c, [[5, 'force']], P.pos, { knock: 1 }); }
      g.hud.region("Minotaur's Roar", '');
    } else { P.stats.add('claws', POWERS.claw.time); g.hud.toast('Your hands harden into <b>claws</b>'); }
    this.drawPower();
  }
  drawPower() {
    const st = this.st; if (!st.power) { this.pw.classList.add('hidden'); return; } const P = POWERS[st.power];
    this.pw.classList.remove('hidden'); this.pw.innerHTML = `${icon(P.icon)}<span><b>${P.name}</b>${st.powerCd > 0 ? `${Math.ceil(st.powerCd)}s` : '<span class="kbd">F</span> ready'}</span>`;
  }
  // ---- boss behaviour on top of the common chase-and-strike. Each boss has moves on their own timers; every move opens
  // with a wind-up you can read (and get out of the way of), and while it runs it steers the boss (c.ctl). A move with a
  // clip of its own (models.js BLOWS: the roar, the slam, the throw, claws, sting, fire) takes its timing from it: the
  // blow lands, the rock leaves the hand, the fire comes when the clip's moment does (m.hit), and the move lasts until
  // the clip has settled (m.dur). Below half
  // health a boss is enraged: a roar, help from the dead (or the forest) at once, quicker moves and harder blows.
  //   Minotaur: follow-up swings, a bull charge (dazed for a moment if he runs into a wall), a labrys slam that sends a
  //             shockwave round him, a war cry that stuns, and rubble thrown at anyone keeping their distance.
  //   Chimera:  claws, and the serpent's sting for anyone behind it; fire from the lion's mouth; a pounce from afar.
  bossThink(c, dt, d) {
    const g = this.g, P = g.player, T = c.T, toP = Math.atan2(P.pos.x - c.pos.x, P.pos.z - c.pos.z);
    c.cd ||= c.type === 'minotaur' ? { charge: 3, slam: 5, roar: 9, throw: 4 } : { strike: 1, breath: 5, pounce: 7 };
    for (const k in c.cd) c.cd[k] -= dt * (c.enraged ? 1.45 : 1);
    c.ctl = null;
    // coming down out of the sky, then standing and roaring before the fight (stage)
    if (c.fall !== undefined) { c.ctl = { want: 0, air: c.fall, face: c.yaw }; return 'idle'; }
    if (c.intro > 0) { c.intro -= dt; c.ctl = { want: 0, face: toP }; return 'roar'; }
    // leash: a boss doesn't wander off its arena; if you run, it goes back and heals
    if (c.arena && c.pos.distanceTo(c.arena) > 45) { c.move = null; c.state = 'idle'; c.yaw = Math.atan2(c.arena.x - c.pos.x, c.arena.z - c.pos.z); c.hp = Math.min(c.max, c.hp + c.max * 0.05 * dt); return null; }
    if (!c.enraged && c.hp < c.max * 0.5) {
      c.enraged = true; c.dmgK *= 1.15; this.helperT = Math.min(this.helperT, 1.5); c.move = { k: 'roar', ph: 0, enrage: true, ...this.timed(c, 'roar', 1.3) };
      g.hud.region(`${T.name} is enraged`, c.type === 'minotaur' ? 'The dead of the Labyrinth answer his call' : 'The forest answers its call');
    }
    // follow-up swings: after a blow, often another straight away
    if (c.state === 'attack') { if (!c.combo) { c.combo = true; c.atkCd = Math.random() < (c.enraged ? 0.6 : 0.4) ? 0.5 : c.enraged ? 1.5 : 2.1; } } else c.combo = false;
    if (c.move) return this.runMove(c, c.move, dt, d, toP);
    if (c.state !== 'chase' || c.hitT > 0) return null;
    const cd = c.cd, clear = this.clearLine(c, d);
    const start = (k, t, extra) => { c.move = { k, ph: 0, ...extra, ...this.timed(c, k, t) }; return this.runMove(c, c.move, 0, d, toP); };
    if (c.type === 'minotaur') {
      if (cd.roar <= 0 && d < 18) { cd.roar = rr(14, 18); return start('roar', 1.3); }
      if (cd.slam <= 0 && d < 10) { cd.slam = rr(7, 10); return start('slam', 0.95); }
      if (cd.charge <= 0 && d > 11 && d < 42 && clear) { cd.charge = rr(6, 9); return start('charge', 0.75, { dir: toP }); }
      if (cd.throw <= 0 && d > 18) { cd.throw = rr(4.5, 6.5); return start('throw', 0.65); }
    } else if (c.type === 'chimera') {
      if (cd.pounce <= 0 && d > 15 && d < 38 && clear) { cd.pounce = rr(9, 12); return start('pounce', 0.55); }
      if (cd.breath <= 0 && d > 8 && d < 26) { cd.breath = rr(8, 11); return start('breath', 0.6); }
      if (cd.strike <= 0 && d < T.reach + 3.5) {
        cd.strike = rr(3, 5); const behind = Math.abs(angDiff(toP, c.yaw)) > 1.8;
        return start(behind || Math.random() < 0.35 ? 'sting' : 'claw', behind ? 0.8 : 0.7);
      }
    }
    return null;
  }
  // a move's timing: from its clip, if it has one (t: the wind-up, hit: when it lands, dur: when it's over), or t for all
  timed(c, k, t) { const q = c.body.cue?.(k); return q ? { t: q.hit, hit: q.hit, dur: q.dur } : { t, hit: t, dur: t }; }
  // nothing solid between the boss and you (a wall, a column, a tree)
  // (not the rubble of a ruin, which a giant strides over, nor the trees it tramples)
  clearLine(c, d) { const P = this.g.player.pos, dx = (P.x - c.pos.x) / Math.max(d, 0.01), dz = (P.z - c.pos.z) / Math.max(d, 0.01); return !this.g.colliders.pick(c.pos.x + dx * c.T.r, c.pos.z + dz * c.T.r, dx, dz, Math.max(0.1, d - c.T.r - 0.8), SOLID); }
  // one step of a move: wind-up (ph 0), then the move itself (ph 1), sometimes a recovery (ph 2)
  runMove(c, m, dt, d, toP) {
    const g = this.g, P = g.player, T = c.T, at = (k = 0) => c.pos.clone().setY(c.pos.y + k), fwd = () => new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    const done = () => { c.move = null; c.ctl = null; return null; };
    m.t -= dt; m.e = (m.e || 0) + dt;
    switch (m.k) {
      case 'roar':   // war cry: stuns anyone close who isn't behind a raised guard, as the head thrusts out
        c.ctl = { want: 0, face: toP };
        if (!m.done && m.e >= m.hit) { m.done = true; g.sound?.('roar', { boss: true, long: m.enrage, at: c.pos }); addShake(m.enrage ? 1 : 0.75); dust(at(1), 18, 0x8a7a64, 0.9); g.flashSky?.(m.enrage ? 0.4 : 0);
          if (d < 15 && !P.blocking) { P.stats.add('stunned', m.enrage ? 1.6 : 1.2); g.hud.toast(`The roar <b>stuns</b> you!`); } else if (d < 15) g.hud.toast('You hold your guard against the roar'); }
        return m.e >= m.dur ? done() : 'roar';
      case 'slam':   // the labrys raised high, then brought down: a shockwave all round (from where the blade meets the ground)
        c.ctl = { want: 0, face: m.e < m.hit - 0.35 ? toP : undefined };
        if (!m.hit0 && m.e >= m.hit) { m.hit0 = true; const ax = c.body.point?.('axe'), p = ax ? ax.setY(c.pos.y + 0.2) : at(0.2).addScaledVector(fwd(), 6);   // (the shockwave from where the labrys bites the ground)
          for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; dust(p.clone().add(new THREE.Vector3(Math.cos(a) * 6, 0, Math.sin(a) * 6)), 2, 0x7a6c5c, 0.8); }
          burst(p.clone().setY(p.y + 0.5), { color: 0x7d7062, n: 30, speed: 9, size: 0.3, life: 1.8, grav: 16, up: 7 }); const near = Math.max(0, 1 - P.pos.distanceTo(p) / 40);
          addShake(0.5 + 0.5 * near); punch(0.9 * near, { x: P.pos.x - p.x, z: P.pos.z - p.z }); g.sound?.('slam', { at: p, big: true }); if (P.pos.distanceTo(p) < 9 && P.onGround !== false) g.combat.hitPlayer(c, [30, 38, 'blunt']); c.atkCd = Math.max(c.atkCd, 0.8); }
        return m.e >= m.dur ? done() : 'slam';
      case 'throw':  // tears up a block of the ruin and hurls it, from his free hand as the swing comes forward
        c.ctl = { want: 0, face: m.e < m.hit ? toP : undefined };
        if (!m.hit0 && m.e >= m.hit) { m.hit0 = true; g.combat.throwAt(c, [24, 34, 'blunt'], { rock: true, size: 2.6, from: c.body.point?.('LeftHand') }); g.sound?.('boulder', { at: c.pos }); }
        return m.e >= m.dur ? done() : 'throw';
      case 'charge':
        if (m.ph === 0) {   // pawing the ground, head down
          c.ctl = { want: 0, face: toP }; m.dir = toP; if (Math.floor(m.e * 7) !== m.dust) { m.dust = Math.floor(m.e * 7); dust(at(0.1).addScaledVector(fwd(), -1), 6, 0x9a8a70, 0.5); }
          if (!m.snd) { m.snd = true; g.sound?.('roar', { boss: true, at: c.pos }); }
          if (Math.random() < dt * 3) g.sound?.('giantStep', { at: c.pos, k: 0.7 });   // (a hoof scraping the ground)
          if (m.t <= 0) { m.ph = 1; m.t = 1.8; } return 'paw';
        }
        if (m.ph === 1) {   // the charge: fast, turning only a little
          m.dir += clamp(angDiff(toP, m.dir), -0.55 * dt, 0.55 * dt); c.ctl = { want: c.enraged ? 19 : 17, face: m.dir, snap: true };   // (a giant's charge: fast, but you can still step out of its way)
          if (!m.gored && d < T.r + 2.5) { m.gored = true; g.combat.hitPlayer(c, [34, 42, 'pierce']); }
          const ahead = g.colliders.pick(c.pos.x, c.pos.z, Math.sin(m.dir), Math.cos(m.dir), T.r + 1.1, SOLID);
          if (m.e > 0.2 && (ahead || c.stuck > 0.15)) {   // straight into a wall: dazed, with a crash you feel
            const p = at(3).addScaledVector(fwd(), T.r + 0.5), near = Math.max(0, 1 - P.pos.distanceTo(c.pos) / 45);
            m.ph = 2; m.t = 2.4; c.hitT = 2.4; addShake(0.5 + 0.5 * near); punch(0.85 * near, { x: P.pos.x - p.x, z: P.pos.z - p.z }); g.sound?.('slam', { at: p, big: true }); dust(p, 16, 0x7a6c5c, 1); burst(p, { color: 0x8f8678, n: 30, speed: 8, size: 0.3, grav: 14, up: 5 });
            if (!this.dazeTold) { this.dazeTold = true; g.hud.toast('The Minotaur is <b>dazed</b>: strike now!'); } return 'dazed';
          }
          if (m.t <= 0 || (m.gored && m.e > 0.9)) return done(); return 'run';
        }
        c.ctl = { want: 0 }; return m.t <= 0 ? done() : 'dazed';
      case 'claw': case 'sting':   // the old strikes, now as moves: committed a moment before they land, the claws only in front
        c.ctl = { want: 0, face: m.e < m.hit - 0.3 ? toP : undefined };
        if (!m.hit0 && m.e >= m.hit) { m.hit0 = true;
          if (m.k === 'sting' && d < 14) { g.combat.hitPlayer(c, [52, 72, 'pierce']); P.stats.add('poisoned', 6); } else if (m.k === 'claw' && d < T.reach + 1.5 && Math.abs(angDiff(toP, c.yaw)) < 1) g.combat.hitPlayer(c, [22, 32, 'slash']);
          const paw = c.body.point?.(m.k === 'sting' ? 'tail11' : 'Leg_R_F5'); if (paw) { dust(paw.setY(c.pos.y + 0.2), 6, 0x7a6c5c, 0.8); g.sound?.('slam', { at: paw, big: true }); } }
        return m.e >= m.dur ? done() : m.k;
      case 'breath':   // fire from the lion's mouth, swept slowly after you, once its head is down (the clip held there)
        if (m.ph === 0) { c.ctl = { want: 0, face: toP }; if (m.t <= 0) { m.ph = 1; m.t = 1.5; g.sound?.('breath', { at: c.body.point?.('mouth') || c.pos }); } return 'breath'; }
        c.ctl = { want: 0, face: c.yaw + clamp(angDiff(toP, c.yaw), -0.9 * dt, 0.9 * dt) };
        // (the fire a cone from the lion's jaws, as long and as wide as the beast is big: a stream of flame and embers
        // reaching out 24 m and spreading as it goes, its light on the ground)
        { const f = fwd(), mouth = c.body.point?.('mouth')?.addScaledVector(f, 1.5) || at(T.h * 0.62).addScaledVector(f, T.body?.[1] ?? T.r + 1.2);
          for (let i = 0; i < 5; i++) { const s = Math.random(); burst(mouth.clone().addScaledVector(f, s * 20).add(new THREE.Vector3((Math.random() - 0.5) * s * 8, -s * (mouth.y - c.pos.y) * 0.75, (Math.random() - 0.5) * s * 8)), { color: Math.random() < 0.5 ? 0xff7a20 : 0xffc040, n: 4, speed: 4 + s * 6, size: 0.25 + s * 0.6, grav: -2, life: 0.5, glow: Math.random() < 0.3 }); }
          askLight(mouth.clone().addScaledVector(f, 8), 40, 30, 0xff8a30);
          m.tick = (m.tick || 0) - dt;
          if (m.tick <= 0) { m.tick = 0.25; if (d < 26 && Math.abs(angDiff(toP, c.yaw)) < 0.45) { g.combat.hitPlayer(c, [9, 13, 'fire']); P.stats.add('burning', 3); } } }
        return m.t <= 0 ? done() : 'breath';
      case 'pounce':
        if (m.ph === 0) { c.ctl = { want: 0, face: toP }; if (m.t <= 0) { m.ph = 1; m.t = 1; m.from = c.pos.clone(); m.to = P.pos.clone().addScaledVector(new THREE.Vector3(Math.sin(toP), 0, Math.cos(toP)), -5); g.sound?.('roar', { boss: true, at: c.pos }); } return 'crouch'; }
        if (m.ph === 1) { const k = 1 - Math.max(0, m.t) / 1; c.ctl = { want: 0, face: Math.atan2(m.to.x - m.from.x, m.to.z - m.from.z), snap: true, at: m.from.clone().lerp(m.to, k), air: Math.sin(k * Math.PI) * 6 };
          if (m.t <= 0) { const near = Math.max(0, 1 - P.pos.distanceTo(c.pos) / 45); m.ph = 2; m.t = 0.5; addShake(0.6 + 0.4 * near); punch(0.9 * near, { x: P.pos.x - c.pos.x, z: P.pos.z - c.pos.z }); g.sound?.('slam', { at: c.pos, big: true }); dust(at(0.2), 20, 0x7a6c5c, 1.1);
            if (P.pos.distanceTo(c.pos) < T.r + 4.5) g.combat.hitPlayer(c, [40, 50, 'slash']); } return 'leap'; }
        c.ctl = { want: 0 }; return m.t <= 0 ? done() : 'leap';
    }
    return done();
  }
  update(dt) {
    const g = this.g, st = this.st; this.stage(dt);
    // (the boss camera while a fight is on and you're about its arena, or one is coming: player.js BOSS_CAM)
    g.player.bossCam = !!this.arrival || (!!this.boss && !this.boss.dead && g.player.pos.distanceTo(this.boss.pos) < 70);
    if (hit('KeyF') && !g.player.dead && g.altUsed !== 'F') this.usePower();   // (F at a lit fire puts the fire out instead)
    if (st.powerCd > 0) { st.powerCd -= dt; if (Math.floor(st.powerCd) !== this.lastCd) { this.lastCd = Math.floor(st.powerCd); this.drawPower(); } }
    if (g.player.stats.has('poisoned')) g.player.stats.damage(1.5 * dt);
    if (g.player.stats.has('burning')) g.player.stats.damage(2.5 * dt);
    // boss fight: health bar, and help arrives every 30 seconds
    if (this.boss) {
      const c = this.boss; this.bar.querySelector('i').style.width = (c.hp / c.max) * 100 + '%';
      this.helperT -= dt;
      if (this.helperT <= 0 && !c.dead) { this.helperT = 30; for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28, x = c.arena.x + Math.cos(a) * 14, z = c.arena.z + Math.sin(a) * 14; const h = g.creatures.spawn(c.T.helpers, x, z, { summoned: true, aware: true }); h.state = 'chase'; dust(h.pos.clone().setY(h.pos.y + 0.5), 14, 0x8a7a68, 0.5); } g.hud.toast(c.T.helpers === 'skeleton' ? 'The dead of the Labyrinth rise to fight for their master' : 'Dryads answer the Chimera\'s call'); }
      if (g.player.pos.distanceTo(c.arena) > 70 && !c.dead) { g.creatures.remove(c); this.boss = null; this.bar.classList.add('hidden'); setWeather(null); g.hud.toast('You fled. The altar waits for another tribute.'); }
    }
    // a boss's head in the pack: the light over its stand at the temple, and the stand on the compass and map, until it's offered
    this.headT = (this.headT || 0) - dt;
    if (this.headT <= 0 && g.structures) {
      this.headT = 0.25; let want = null;
      for (const u of g.structures.uses) if (u.kind === 'offering') { const on = !st.offered[u.boss] && g.inv.count(u.boss + 'Head') > 0; if (u.beacon) u.beacon.visible = on; if (on) want ||= u; }
      if (want && !this.told?.[want.boss]) { (this.told ||= {})[want.boss] = true; g.map?.reveal(SITES.temple);
        g.hud.toast(`Lay ${BOSS_NAME[want.boss]}'s head on its stand before <b>Zeus's temple</b>, the one with the light over it. It's on your compass and map.`); }
      if (g.map && !g.guide?.on) { if (want) { g.map.guideTarget = { x: want.at.x, z: want.at.z, label: 'Offering stand' }; this.marked = true; } else if (this.marked) { g.map.guideTarget = null; this.marked = false; } }
    }
    // a giant guards each cave whose carving hasn't been taken
    SITES.caves.forEach((cv, i) => {
      if (st.carvings.includes('cave' + i)) return; const d = Math.hypot(cv.x - g.player.pos.x, cv.z - g.player.pos.z), day = g.S.day;
      if (d < 70 && st.guards[i] !== day) { st.guards[i] = day; const gi = g.creatures.spawn('giant', cv.den.x, cv.den.z, { level: 0 }); gi.home.set(cv.x, cv.y, cv.z); gi.guard = true; }   // (waiting in his cave, by his fire: sites.js)
    });
  }
}

// ---- the offered heads. The boss's own: its model in the pose it stands in, cut at the neck (every triangle the head's
// bones and the top of the neck carry, horns, jaw and eyes with them), the stump closed over, drawn a little bigger than the
// boss is (models.js) and sat upright on the stand, looking out the way the stand faces. Loaded once, the first time one is shown.
// (cut: which way the neck's cut is turned: down under the Minotaur's head; behind the Chimera's, a beast's head lying on
// its jaw looking out)
const HEAD = { minotaur: { file: 'pack/minotaur', head: 'Head', neck: 'Neck', h: 3.2, cut: [0, -1, 0] }, chimera: { file: 'pack/chimera', head: 'head', neck: 'neck', len: 6, cut: [0, 0, -1] } };
const NECK = 0.6, KEEP = 0.5;   // (how much of the neck's own pull counts as the head's, and how much a vertex needs to be kept)
const TROPHY = 1.4;   // (a little bigger than the boss wore it, so it reads as a trophy on the stand)
const heads = {};
function bossHead(kind) {
  return (heads[kind] ||= loadGLB(HEAD[kind].file).then((gl) => {
    const H = HEAD[kind], root = gl.scene; root.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()), k = (H.len ? H.len / Math.max(size.x, size.z) : H.h / size.y) * TROPHY;
    let sm = null; root.traverse((o) => { if (o.isSkinnedMesh && !sm) sm = o; }); if (!sm) return null;
    const under = (b) => { for (let o = b; o; o = o.parent) if (o.name === H.head) return true; return false; }, pull = sm.skeleton.bones.map((b) => (under(b) ? 1 : b.name === H.neck ? NECK : 0));
    // where each vertex stands in the pose, and how much of it the head carries
    const G = sm.geometry, pos = G.attributes.position, si = G.attributes.skinIndex, sw = G.attributes.skinWeight, n = pos.count, v = new THREE.Vector3();
    const P = new Float32Array(n * 3), w = new Float32Array(n);
    for (let i = 0; i < n; i++) { for (let c = 0; c < 4; c++) w[i] += sw.getComponent(i, c) * pull[si.getComponent(i, c)]; sm.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(sm.matrixWorld).multiplyScalar(k); v.toArray(P, i * 3); }
    const idx = G.index ? G.index.array : Array.from({ length: n }, (_, i) => i), tri = [];
    for (let t = 0; t < idx.length; t += 3) if (Math.min(w[idx[t]], w[idx[t + 1]], w[idx[t + 2]]) >= KEEP) tri.push(idx[t], idx[t + 1], idx[t + 2]);
    if (tri.length < 30) return null;
    // the open edges (welded, since the model splits its vertices along seams), chained into loops: the cut at the neck is
    // the longest; it and any nearly as long are closed with a fan of flesh to their middle
    const weld = new Map(), wid = (i) => { const key = `${Math.round(P[i * 3] * 500)},${Math.round(P[i * 3 + 1] * 500)},${Math.round(P[i * 3 + 2] * 500)}`; if (!weld.has(key)) weld.set(key, i); return weld.get(key); };
    const edges = new Map(); for (let t = 0; t < tri.length; t += 3) for (let e = 0; e < 3; e++) { const a = wid(tri[t + e]), b = wid(tri[t + (e + 1) % 3]), back = b + ',' + a; if (edges.has(back)) edges.delete(back); else edges.set(a + ',' + b, [a, b]); }
    const next = new Map(); for (const [a, b] of edges.values()) next.set(a, b);
    const loops = [], seen = new Set();
    for (const a0 of next.keys()) { if (seen.has(a0)) continue; const L = []; let a = a0; while (a !== undefined && !seen.has(a)) { seen.add(a); L.push(a); a = next.get(a); } if (a === a0 && L.length > 2) loops.push(L); }
    const len = (L) => L.reduce((s, a, i) => s + Math.hypot(...[0, 1, 2].map((c) => P[a * 3 + c] - P[L[(i + 1) % L.length] * 3 + c])), 0);
    loops.sort((p, q) => len(q) - len(p)); const caps = loops.filter((L) => len(L) > len(loops[0] ?? []) * 0.4);
    const cap = [], down = new THREE.Vector3(), mid = new THREE.Vector3(), a3 = new THREE.Vector3(), b3 = new THREE.Vector3(), c3 = new THREE.Vector3();
    caps.forEach((L, li) => {
      const c = new THREE.Vector3(); for (const a of L) c.add(a3.fromArray(P, a * 3)); c.divideScalar(L.length); if (li === 0) mid.copy(c);
      L.forEach((a, i) => { a3.fromArray(P, L[(i + 1) % L.length] * 3); b3.fromArray(P, a * 3); cap.push(a3.x, a3.y, a3.z, b3.x, b3.y, b3.z, c.x, c.y, c.z);   // (wound against the edge: facing out of the head)
        if (li === 0) down.add(c3.subVectors(b3, a3).cross(mid.clone().sub(a3))); });
    });
    // set on the stand: the neck's cut turned the way it should face (no more turn than that, so it still looks ahead),
    // its lowest point on the tray, over the middle of the cut (the Minotaur's) or of the whole head (the Chimera's)
    const want = new THREE.Vector3(...H.cut), turn = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(down.lengthSq() ? down.normalize() : want, want));
    const place = (g) => g.translate(-mid.x, -mid.y, -mid.z).applyMatrix4(turn);
    const used = [...new Set(tri)], at = new Map(used.map((i, j) => [i, j])), uv = G.attributes.uv, hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(used.flatMap((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]), 3));
    if (uv) hg.setAttribute('uv', new THREE.Float32BufferAttribute(used.flatMap((i) => [uv.getX(i), uv.getY(i)]), 2));
    hg.setIndex(tri.map((i) => at.get(i))); hg.computeVertexNormals(); place(hg);
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cap, 3)); cg.computeVertexNormals(); place(cg);
    hg.computeBoundingBox(); const bb = hg.boundingBox.clone(), c = H.cut[1] < 0 ? new THREE.Vector3() : bb.getCenter(new THREE.Vector3()); for (const g of [hg, cg]) g.translate(-c.x, 0.02 - bb.min.y, -c.z);
    const out = new THREE.Group(), m = sm.material.clone(); m.color?.setScalar(0.78);   // (the pack's palette is pale in our light)
    for (const [g, mt] of [[hg, m], [cg, new THREE.MeshStandardMaterial({ color: 0x5a1c16, roughness: 0.8 })]]) { const o = new THREE.Mesh(g, mt); o.castShadow = o.receiveShadow = true; out.add(o); }
    return out;
  }));
}
// the carved heads, without the pack
function carvedHead(boss) {
  const g = new THREE.Group(), hide = new THREE.MeshStandardMaterial({ color: boss === 'minotaur' ? 0x4a2c1c : 0xb88a4a, roughness: 0.9 }), horn = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.5 });
  const m = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  if (boss === 'minotaur') { m(new THREE.IcosahedronGeometry(0.35, 1), hide, 0, 0.35, 0).scale.set(1.1, 1, 1.2); m(new THREE.CylinderGeometry(0.2, 0.25, 0.35, 8).rotateX(Math.PI / 2), hide, 0, 0.25, 0.35); for (const sx of [-1, 1]) m(new THREE.TorusGeometry(0.35, 0.06, 6, 12, Math.PI * 0.6), horn, sx * 0.25, 0.55, 0).rotation.z = sx > 0 ? -0.35 : Math.PI + 0.35; }
  else { m(new THREE.IcosahedronGeometry(0.4, 1), hide, 0, 0.4, 0); m(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshStandardMaterial({ color: 0x6a3a1a, roughness: 1 }), 0, 0.45, -0.15).scale.set(1.1, 1.1, 0.8); m(new THREE.BoxGeometry(0.36, 0.28, 0.36), hide, 0, 0.3, 0.38); }
  return g;
}
