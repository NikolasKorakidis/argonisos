// The trial of Zeus: the path from the meadow to the bosses.
//   Clues: three of the five marked olive trees in Pedias piece together the way to the Minotaur's Labyrinth; three of
//   the four Giant caves in Yleos (each guarded) show where the Chimera sleeps.
//   Tribute: lay it on the boss's altar to call it: 5 deer hides and 10 olives for the Minotaur, 3 dryad hearts and
//   10 pomegranates for the Chimera. Mid-fight, the dead (or the forest) come to the boss's aid every 30 seconds.
//   Offering: bring the head to the Ancient Temple. Zeus grants its power (F) and the next tier of crafting.
//   Prayer: once a day at the temple altar, Zeus's Blessing.
import * as THREE from 'three';
import { TYPES } from '../creatures/creatures.js';
import { SITES } from '../world/sites.js';
import { ITEMS } from './items.js';
import { icon } from '../ui/icons.js';
import { dust, burst, addShake } from '../render/fx.js';
import { setWeather } from '../world/weather.js';
import { hit } from '../input.js';

const rr = (a, b) => a + Math.random() * (b - a), FT = 0.3048;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
TYPES.minotaur = { name: 'The Minotaur', boss: true, hp: [500, 500], block: 24, speed: [6 * FT, 9], sight: 70, dmg: [18, 22, 'slash'], reach: 2.8, r: 1.0, h: 3.4, mob: [1, 1], heavy: true,
  weak: ['pierce'], resist: ['slash', 'blunt'], drops: [['sharpBone', 20, 30, 1], ['minotaurHide', 12, 12, 1], ['minotaurHead', 1, 1, 1]], thunder: 'big', helpers: 'skeleton' };
TYPES.chimera = { name: 'The Chimera', boss: true, hp: [2500, 2500], block: 34, speed: [8 * FT, 9.5], sight: 80, dmg: [35, 45, 'pierce'], reach: 3.4, r: 1.8, h: 3.2, mob: [1, 1], heavy: true,
  weak: ['poison'], resist: ['slash', 'fire'], drops: [['dryadHeart', 20, 30, 1], ['chimeraHide', 1, 1, 1], ['chimeraHead', 1, 1, 1]], thunder: 'big', helpers: 'dryad' };
const TRIBUTE = { minotaur: { deerHide: 5, olive: 10 }, chimera: { dryadHeart: 3, pomegranate: 10 } };
const BOSS_NAME = { minotaur: 'the Minotaur', chimera: 'the Chimera' };
export const POWERS = {
  roar: { name: "Minotaur's Roar", icon: 'zeus', cd: 300, desc: 'Press F: a roar that stuns every creature around you and sends them reeling.' },
  claw: { name: "Chimera's Claws", icon: 'blessing', cd: 600, time: 300, desc: 'Press F: for five minutes your bare hands strike like the Chimera\'s claws.' },
};

export class Trial {
  constructor(g) {
    this.g = g; const st = (g.S.trial ||= { scraps: [], carvings: [], revealed: {}, down: {}, offered: {}, prayDay: -1, looted: [], power: null, powerCd: 0, guards: {} });
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
    if (u.kind === 'offering') { const head = u.boss + 'Head'; if (st.offered[u.boss]) return { label: `${ITEMS[head].name} offered`, sub: POWERS[u.boss === 'minotaur' ? 'roar' : 'claw'].name, use: () => this.choosePower(u.boss) };
      return { label: inv.count(head) ? `Offer the ${ITEMS[head].name.toLowerCase()}` : `A place for the head of ${BOSS_NAME[u.boss]}`, sub: 'Offering stand', use: () => this.offer(u) }; }
    if (u.kind === 'loot') return st.looted.includes(u.id) ? { label: 'Empty', sub: 'Old chest', use: () => {} } : { label: 'Search the old chest', sub: 'Abandoned house', use: () => this.loot(u) };
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
  pray(u) {
    const g = this.g; if (this.st.prayDay === g.S.day) { g.hud.toast('Zeus has already blessed you today. Come back tomorrow.'); return; }
    this.st.prayDay = g.S.day; g.player.stats.add('zeusBlessing'); g.player.stats.heal(99);
    burst(u.at.clone().setY(u.at.y + 1.8), { color: 0xffe08a, n: 40, speed: 3, size: 0.07, grav: -3, life: 1.6 }); g.flashSky(0.35); addShake(0.3); g.sound?.('thunder');
    g.hud.region("Zeus's Blessing", 'Your strength grows for a while');
  }
  loot(u) { const g = this.g; this.st.looted.push(u.id); for (const [id, n] of u.items) g.give(id, n); if (u.lid) u.lid.rotation.x = -1.2; g.sound?.('chest'); }
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
    g.inv.takeMats(T); g.sound?.('summon'); setWeather('thunder'); g.flashSky(0.5); addShake(0.6);
    dust(u.center.clone().setY(u.center.y + 1), 40, 0x6a5a48, 0.9);
    g.hud.region(u.boss === 'minotaur' ? 'The Minotaur' : 'The Chimera', u.boss === 'minotaur' ? 'Lord of the Labyrinth' : 'The beast of three natures');
    setTimeout(() => {
      const a = Math.random() * 6.28, p = u.center.clone().add(new THREE.Vector3(Math.cos(a) * 12, 0, Math.sin(a) * 12));
      const c = g.creatures.spawn(u.boss, p.x, p.z, { level: 0, boss: true, aware: true }); c.state = 'chase'; c.arena = u.center.clone(); this.boss = c; this.helperT = 30; this.bossKind = u.boss;
      g.flashSky(0.6); addShake(0.8); dust(p.clone().setY(p.y + 1), 50, 0x9a8a70, 1); g.sound?.('roar');
      this.bar.classList.remove('hidden'); this.bar.querySelector('.bn').textContent = c.T.name;
    }, 3000);
  }
  onKill(c) {
    if (c !== this.boss) return;
    const g = this.g; this.st.down[this.bossKind] = true; this.boss = null; this.bar.classList.add('hidden'); setWeather(null);
    for (const k of g.creatures.list) if (k.summoned && !k.dead) g.creatures.hurt(k, [[9999, 'force']], null);
    g.hud.region(`${BOSS_NAME[this.bossKind][0].toUpperCase()}${BOSS_NAME[this.bossKind].slice(1)} has fallen`, 'Take its head to Zeus at the Ancient Temple');
    g.map?.reveal(SITES.temple);
  }
  offer(u) {
    const g = this.g, head = u.boss + 'Head'; if (!g.inv.count(head)) { g.hud.toast(`Only the head of ${BOSS_NAME[u.boss]} belongs here`); return; }
    g.inv.take(head, 1); this.st.offered[u.boss] = true; this.mountHead(u);
    const tier = u.boss === 'minotaur' ? 1 : 2; g.S.tier = Math.max(g.S.tier || 0, tier);
    this.st.power = u.boss === 'minotaur' ? 'roar' : 'claw'; this.st.powerCd = 0;
    g.flashSky(0.6); addShake(0.6); burst(u.at.clone().setY(u.at.y + 2), { color: 0xffe08a, n: 60, speed: 4, size: 0.08, grav: -2, life: 2 }); g.sound?.('thunder');
    const P = POWERS[this.st.power];
    g.hud.region(P.name, 'Zeus grants you the power of the beast. Press F to use it.');
    setTimeout(() => g.hud.toast(tier === 1 ? 'You can now work <b>lightstone</b>: new weapons and Cretan armour at the workbench.' : 'You can now make the <b>Cretan bow</b>. Zeus\'s storm over Valtos still holds: that trial is yet to come.'), 4500);
    g.crafting.discover(); this.drawPower();
  }
  choosePower(boss) { this.st.power = boss === 'minotaur' ? 'roar' : 'claw'; this.g.hud.toast(`Power set: <b>${POWERS[this.st.power].name}</b>`); this.drawPower(); }
  mountHead(u) {
    const g = new THREE.Group(), hide = new THREE.MeshStandardMaterial({ color: u.boss === 'minotaur' ? 0x4a2c1c : 0xb88a4a, roughness: 0.9 }), horn = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.5 });
    const m = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    if (u.boss === 'minotaur') { m(new THREE.IcosahedronGeometry(0.35, 1), hide, 0, 0.35, 0).scale.set(1.1, 1, 1.2); m(new THREE.CylinderGeometry(0.2, 0.25, 0.35, 8).rotateX(Math.PI / 2), hide, 0, 0.25, 0.35); for (const sx of [-1, 1]) m(new THREE.TorusGeometry(0.35, 0.06, 6, 12, Math.PI * 0.6), horn, sx * 0.25, 0.55, 0).rotation.z = sx > 0 ? -0.35 : Math.PI + 0.35; }
    else { m(new THREE.IcosahedronGeometry(0.4, 1), hide, 0, 0.4, 0); m(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshStandardMaterial({ color: 0x6a3a1a, roughness: 1 }), 0, 0.45, -0.15).scale.set(1.1, 1.1, 0.8); m(new THREE.BoxGeometry(0.36, 0.28, 0.36), hide, 0, 0.3, 0.38); }
    u.mount.add(g);
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
  // ---- boss behaviour on top of the common chase-and-strike
  bossThink(c, dt, d) {
    const g = this.g, P = g.player, T = c.T; c.sp ||= { t: 6 };
    c.sp.t -= dt;
    // leash: a boss doesn't wander off its arena; if you run, it goes back and heals
    if (c.arena && c.pos.distanceTo(c.arena) > 45) { c.state = 'idle'; c.yaw = Math.atan2(c.arena.x - c.pos.x, c.arena.z - c.pos.z); c.hp = Math.min(c.max, c.hp + c.max * 0.05 * dt); }
    if (c.type === 'minotaur') {
      if (c.charge > 0) { c.charge -= dt; c.speed = 11; c.yaw += angDiff(Math.atan2(P.pos.x - c.pos.x, P.pos.z - c.pos.z), c.yaw) * Math.min(1, dt * 1.2); if (d < 2.2 && !c.chargeHit) { c.chargeHit = true; g.combat.hitPlayer(c, [25, 30, 'pierce']); } return 'run'; }
      if (c.sp.t <= 0 && d > 6 && d < 18) { c.sp.t = rr(7, 10); c.charge = 1.6; c.chargeHit = false; g.sound?.('roar'); return 'run'; }
      if (c.sp.t <= 0 && d < 10 && Math.random() < 0.5) { c.sp.t = rr(10, 14); dust(c.pos.clone().setY(c.pos.y + 1), 30, 0xb8a684, 0.7); addShake(0.5); g.sound?.('roar'); if (Math.random() < 0.15 && !P.blocking) { P.stats.add('stunned', 3); g.hud.toast('The roar <b>stuns</b> you!'); } }
    } else if (c.type === 'chimera') {
      if (c.sp.t <= 0 && d < T.reach + 2.5) {
        c.sp.t = rr(3, 5); const behind = Math.abs(angDiff(Math.atan2(P.pos.x - c.pos.x, P.pos.z - c.pos.z), c.yaw)) > 1.8;
        if (behind || Math.random() < 0.35) { c.anim = 'sting'; c.animT = 0.8; setTimeout(() => { if (!c.dead && P.pos.distanceTo(c.pos) < 5.5) { g.combat.hitPlayer(c, [40, 60, 'pierce']); P.stats.add('poisoned', 6); } }, 450); }
        else { c.anim = 'claw'; c.animT = 0.7; setTimeout(() => { if (!c.dead && P.pos.distanceTo(c.pos) < T.reach + 1.5) g.combat.hitPlayer(c, [15, 25, 'slash']); }, 350); }
      }
      if (c.animT > 0) { c.animT -= dt; return c.anim; }
    }
    return null;
  }
  update(dt) {
    const g = this.g, st = this.st;
    if (hit('KeyF') && !g.player.dead && g.altUsed !== 'F') this.usePower();   // (F at a lit fire puts the fire out instead)
    if (st.powerCd > 0) { st.powerCd -= dt; if (Math.floor(st.powerCd) !== this.lastCd) { this.lastCd = Math.floor(st.powerCd); this.drawPower(); } }
    if (g.player.stats.has('poisoned')) g.player.stats.damage(1.5 * dt);
    // boss fight: health bar, and help arrives every 30 seconds
    if (this.boss) {
      const c = this.boss; this.bar.querySelector('i').style.width = (c.hp / c.max) * 100 + '%';
      this.helperT -= dt;
      if (this.helperT <= 0 && !c.dead) { this.helperT = 30; for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28, x = c.arena.x + Math.cos(a) * 14, z = c.arena.z + Math.sin(a) * 14; const h = g.creatures.spawn(c.T.helpers, x, z, { summoned: true, aware: true }); h.state = 'chase'; dust(h.pos.clone().setY(h.pos.y + 0.5), 14, 0x8a7a68, 0.5); } g.hud.toast(c.T.helpers === 'skeleton' ? 'The dead of the Labyrinth rise to fight for their master' : 'Dryads answer the Chimera\'s call'); }
      if (g.player.pos.distanceTo(c.arena) > 70 && !c.dead) { g.creatures.remove(c); this.boss = null; this.bar.classList.add('hidden'); setWeather(null); g.hud.toast('You fled. The altar waits for another tribute.'); }
    }
    // a giant guards each cave whose carving hasn't been taken
    SITES.caves.forEach((cv, i) => {
      if (st.carvings.includes('cave' + i)) return; const d = Math.hypot(cv.x - g.player.pos.x, cv.z - g.player.pos.z), day = g.S.day;
      if (d < 70 && st.guards[i] !== day) { st.guards[i] = day; const gi = g.creatures.spawn('giant', cv.x + 4, cv.z + 6, { level: 0 }); gi.home.set(cv.x, cv.y, cv.z); gi.guard = true; }
    });
  }
}
