// The trial of Zeus: the path from the meadow to the bosses.
//   Clues: three of the five marked olive trees in Pedias piece together the way to the Minotaur's Labyrinth; three of
//   the four Giant caves in Yleos (each guarded) show where the Chimera sleeps.
//   Tribute: lay it on the boss's altar to call it: 5 deer hides and 10 olives for the Minotaur, 3 dryad hearts and
//   10 pomegranates for the Chimera. Run from the fight and it goes on: the beast goes back to its arena and gathers its
//   strength while you're gone (FLEE), and takes you up again when you come back. A fight that ends without the kill (you
//   fell, or left the game mid-fight) leaves the tribute on the altar (st.paid), and E there calls the beast again for nothing more. Mid-fight, the dead (or the forest) come to the boss's aid in waves 30 seconds
//   apart; the Minotaur's first comes sooner if he's brought down to 1500 health first (helpAt).
//   Offering: bring the head to the Ancient Temple. Zeus grants its power (F) and the next tier of crafting.
//   Prayer: once a day at the temple altar, Zeus's Blessing. (And once ever at the old altar on the top of Olympos,
//   which nothing points the way to: the whole island opens on your map.)
import * as THREE from 'three';
import { TYPES } from '../creatures/creatures.js';
import { SITES } from '../world/sites.js';
import { ITEMS } from './items.js';
import { icon } from '../ui/icons.js';
import { dust, burst, addShake, punch, rumble, pillar, blast, slowMo, spark, ring, mark, cracks } from '../render/fx.js';
import { bossAura, dissolve, dissolving, updateBossFx } from '../render/bossfx.js';
import * as FX from '../render/bossblows.js';
import { askLight } from '../render/lights.js';
import { setWeather, gatherStorm, breakStorm } from '../world/weather.js';
import { strike, skyStrike, LIGHTNING } from '../world/lightning.js';
import { daze } from '../audio/sound.js';
import { hit } from '../input.js';
import { clamp, rr } from '../util/math.js';
import { loadGLB } from '../assets.js';

// what stops a giant boss (creatures.js BIG): not rubble (low), not trees and rocks
const SOLID = (k) => !k.low && k.ref?.sp === undefined;
const FT = 0.3048, angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
// a blow that got through (combat.js hitPlayer: some damage, not 'dodged' or 'blocked')
const landed = (r) => typeof r === 'number' && r > 0;
// The bosses are giants (Patch 21): the Minotaur stands 10.5 m to his horns, five and a half times the hero, and the
// Chimera is 23 m from its jaws to its tail and nearly 9 m tall at the head (size: its model drawn that many times its
// own size, models.js KIT; pace: its blows and roars played that much slower, for their weight). Their bodies, reach and
// moves (bossThink) are drawn to that size: r, h, the Chimera's long body a capsule (body: from behind its middle to in
// front, creatures.js gap). Stronger to match: nearly twice the Minotaur's health and a third more for the Chimera, their
// blows a third harder than before, so a fight takes a while and a blow taken really hurts, but the gear of the time
// (the first weapons and thrower's armour for the Minotaur, lightstone and Cretan armour for the Chimera) still wins it.
// helpAt: the health at which the first wave of help comes, if that's before its 30 seconds are up (help, update).
// (Patch 25, the Greek reviewer: "Minotaur: HP ×5, and the camera perspective should not change". His health 900 → 4500,
// and what's counted in it with it: the first wave at 1500 (a third, as 300 was of 900) and Zeus's bolt, bolt, 35 → 175
// (as much of him as before); the enrage at half, the spent ×1.5 and the stagger (a share of his health) stay. And his
// fight keeps the follow camera: bossCam, on the Chimera's entry alone now, is what draws it back (player.js BOSS_CAM).)
// (Patch 22: he walks you down at a giant's pace, 4.5 m/s, gaining on you running and losing you sprinting, turning his
// weight slowly round (turn, acc: creatures.js GIANT); moves: he makes his own, MOVE, rather than the common strike)
TYPES.minotaur = { name: 'The Minotaur', boss: true, moves: true, hp: [4500, 4500], block: 30, speed: [6 * FT, 6], turn: [0.65, 0.85], acc: [2, 5], sight: 90, dmg: [24, 30, 'slash'], reach: 5, r: 2.4, h: 10.5, size: 3.3, pace: 0.88, mob: [1, 1], heavy: true,
  weak: ['pierce'], resist: ['slash', 'blunt'], drops: [['sharpBone', 20, 30, 1], ['minotaurHide', 12, 12, 1], ['minotaurHead', 1, 1, 1]], thunder: 'big', helpers: 'skeleton', helpAt: 1500, bolt: 175 };
TYPES.chimera = { name: 'The Chimera', boss: true, hp: [3300, 3300], block: 40, speed: [8 * FT, 9.6], sight: 100, dmg: [45, 56, 'pierce'], reach: 6.5, r: 4, h: 8.9, size: 3.8, pace: 0.9, body: [-11, 4], mob: [1, 1], heavy: true,
  weak: ['poison'], resist: ['slash', 'fire'], drops: [['dryadHeart', 20, 30, 1], ['chimeraHide', 1, 1, 1], ['chimeraHead', 1, 1, 1]], thunder: 'big', helpers: 'dryad', bossCam: true };
// a boss's coming, in seconds from the tribute (Trial.stage): the pillar of light rises (light), the beast drops into it
// from high metres up (drop) and lands (land), roars a while before it comes for you (roar), and the camera is yours again (done)
const ARRIVE = { light: 1.9, drop: 2.55, land: 2.95, high: 45, roar: 1.8, done: 5.6 };
// The Minotaur's moves, made for a giant against a small hero (Patch 22). Seconds, metres and m/s; where there are two,
// measured and enraged. rest: how long he stands after a move before the next.
//   roar:   the war cry's reach (r) and the stun it leaves (stun s), the ring taking ring s to get there; spent, he only
//           bellows you back (shove: its reach)
//   charge: pawing (paw s), then gathering speed (acc) to his top; turning at turn rad/s at first, almost none at the top;
//           the gore reaches horns m before him and wide m to either side of his middle; after max s or far m, or once
//           past you, he skids to a stop (skid: m/s² shed) and pants (pant s). A hero running (3.45 m/s) steps out of
//           it in under a second, so a sidestep late in it works
//   slam:   the blade bites ahead of him; the wave hurts all within core, a quarter as much at r
//   sweep:  the labrys across in front: reach m from his middle, arc rad either side of his heading
//   throw:  a block of the ruin size m across
//   tired:  spent after after big moves (charges, slams, roars, throws), for secs; after a charge into a wall, for wall
const MOVE = {
  rest: [[1.1, 1.8], [0.5, 0.9]],
  roar: { r: 16, shove: 10, stun: 2, ring: 0.5, cd: [16, 21], t: 1.3 },
  charge: { paw: [1.3, 1], top: [11, 12.5], acc: 5.5, turn: [0.6, 0.12], horns: 2.2, wide: 1.6, max: 4.5, far: 48, skid: 7, pant: 1.6, dmg: [42, 46, 'pierce'], cd: [9, 12] },
  slam: { ahead: 6.5, core: 3.5, r: 13, dmg: [30, 38, 'blunt'], cd: [7, 10], t: 0.95 },
  sweep: { reach: 9, arc: 1.1, cd: [3.5, 5.5], t: 1 },
  throw: { size: 2.6, cd: [5, 7], t: 0.65 },
  tired: { after: [[2, 3], [3, 4]], secs: [[4, 5], [2.6, 3.2]], wall: [4.5, 3.5] },
};
// The fight's storm (Trial.storm): a bolt every every s; that share of them near you (within spread m), their place
// glowing warn s first (never while you're stunned and can't get out of the way); a bolt hurts what stands within r m of
// it (dmg you, boss: the boss, unless its TYPES entry has a bolt of its own; the boss's dead it destroys)
const STORM = { every: [[2.6, 4.2], [1.5, 2.6]], near: [0.3, 0.45], spread: 4, warn: 1.3, r: 2.8, dmg: [14, 18, 'force'], boss: 35 };
// Running from a fight (update, bossThink; the reviewer, 24 Nov: "no more fled from combat"): further than r metres from
// the arena's middle (half again the 70 at which a fight used to end) you're out of it, and back in it once within r - back.
// While you're out the fight waits: the beast walks back to within home metres of its arena's middle and stands there,
// healing heal of its health a second; no help rises and no bolt seeks you; and when you come back it takes you up again.
const FLEE = { r: 105, back: 5, heal: 0.05, home: 10 };   // (home: the altar stands in the middle)
// A boss's end (presence): its body lies lie seconds after the killing blow (the death clip has it down by then), then
// Zeus's bolt strikes it; it glows up over glow seconds and is gone into embers and ash on the wind (bossfx.js dissolve)
const END = { lie: 2.9, glow: 0.35 };
// the block of stone in the Minotaur's hand as he winds up a throw
const ROCK_GEO = new THREE.DodecahedronGeometry(1.3, 0), ROCK_MAT = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.95, flatShading: true });
const TRIBUTE = { minotaur: { deerHide: 5, olive: 10 }, chimera: { dryadHeart: 3, pomegranate: 10 } };
const BOSS_NAME = { minotaur: 'the Minotaur', chimera: 'the Chimera' }, BOSS_HIS = { minotaur: 'his', chimera: 'its' }, BOSS_HEAD = { minotaur: 'Head', chimera: 'head' };
const big = (s) => s[0].toUpperCase() + s.slice(1);
export const POWERS = {
  roar: { name: "Minotaur's Roar", icon: 'zeus', cd: 300, desc: 'Press F: a roar that stuns every creature around you and sends them reeling.' },
  claw: { name: "Chimera's Claws", icon: 'blessing', cd: 600, time: 300, desc: 'Press F: for five minutes your bare hands strike like the Chimera\'s claws.' },
};

// A shaft of light out of the sky onto at (a Vector3): two soft cylinders of gold, wide at the top, that flare up and fade
// over a few seconds, then go
function skyBeam(scene, at) {
  const grp = new THREE.Group(), t0 = performance.now(); grp.position.copy(at);
  for (const [r0, r1, k] of [[0.5, 6, 0.35], [0.18, 2.2, 0.7]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 320, 24, 1, true).translate(0, 160, 0), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false }));   // (one pass: added light needs no order)
    m.frustumCulled = false; m.onBeforeRender = () => { const t = (performance.now() - t0) / 1000; m.material.opacity = k * Math.min(1, t * 4) * (1 - Math.min(1, Math.max(0, (t - 1.8) / 2.6))); }; grp.add(m);
  }
  scene.add(grp); setTimeout(() => { scene.remove(grp); grp.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); }, 4800);
}

export class Trial {
  constructor(g) {
    this.g = g; const st = (g.S.trial ||= { scraps: [], carvings: [], revealed: {}, down: {}, offered: {}, prayDay: -1, looted: [], power: null, powerCd: 0, guards: {}, olympos: false });
    this.st = st; this.boss = null; this.helperT = 0; this.bolts = []; this.marks = []; this.lit = [];
    const bar = document.createElement('div'); bar.id = 'bossBar'; bar.className = 'hidden'; bar.innerHTML = '<div class="bn"></div><div class="bb"><i></i></div>'; document.getElementById('hud').appendChild(bar); this.bar = bar;
    const pw = document.createElement('div'); pw.id = 'power'; pw.className = 'hidden'; document.getElementById('hud').appendChild(pw); this.pw = pw;
    g.onKill = (c) => this.onKill(c);
    { const od = g.onDeath; g.onDeath = () => { od?.(); if (this.boss || this.calling) this.fell = true; }; }   // (fallen in the fight: it ends once you're lifted up again, update)
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
      if (this.boss || this.calling) return { label: 'The fight is on', sub: '', use: () => {} };
      if (st.paid?.[u.boss]) return { label: `Call ${BOSS_NAME[u.boss]} again`, sub: 'Your tribute still lies on the altar', use: () => this.summon(u) };
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
    // (the first prayer, before any olive is found: Zeus shows the way to the nearest marked olive, on the map and compass)
    const st = this.st; if (!st.scraps.length && !st.revealed.labyrinth && !st.shown) { st.shown = true; const s = this.remaining('scraps')[0];
      if (s) setTimeout(() => { g.map?.reveal(s); g.hud.toast(`Zeus shows you an <b>ancient olive</b> where the old ones carved the way, about ${Math.round(Math.hypot(s.x - g.player.pos.x, s.z - g.player.pos.z))} m off. It's on your map and compass.`); g.sound?.('reveal'); }, 3500); }
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
  // (the tribute laid, or already lying there from a fight that ended without the kill: st.paid; while the fight is on
  // it's st.fight, saved, so a game left mid-fight finds it on the altar again: save.js)
  summon(u) {
    const g = this.g, T = TRIBUTE[u.boss], st = this.st; if (this.boss || this.calling) return;   // (not while a beast is on its way or fighting)
    if (st.paid?.[u.boss]) delete st.paid[u.boss]; else if (!g.inv.has(T)) { g.hud.toast('You don\'t have the tribute yet'); return; } else g.inv.takeMats(T);
    st.fight = u.boss; this.fell = false; g.sound?.('summon'); this.calling = u.boss;   // (the beast is on its way: its music starts now, audio/music.js)
    g.acts?.kneel(u.center, 2.8);   // (kneeling while the beast is called)
    gatherStorm(); g.flashSky(0.5); addShake(0.4);   // (Zeus's storm rolls in over the arena: weather.js, and the bolts, storm)
    dust(u.center.clone().setY(u.center.y + 1), 40, 0x6a5a48, 0.9);
    g.hud.region(u.boss === 'minotaur' ? 'The Minotaur' : 'The Chimera', u.boss === 'minotaur' ? 'Lord of the Labyrinth' : 'The beast of three natures');
    this.arrival = { u, t: 0, at: (u.land || u.center).clone(), did: {} }; g.player.focus = this.arrival.at;
  }
  // ---- the boss's coming (ARRIVE, seconds after the tribute is laid): the ground shakes harder and harder, dust and grit
  // falling from the walls; a pillar of light rises where it will come down, and it drops out of the sky inside it, roaring;
  // it lands with a blast (a flash, a shockwave racing out along the ground, rocks and chunks flung out, a moment of slow
  // motion), and the place breaks (structures.js ruin: walls falling, columns toppling, the floor cracked round a crater),
  // knocking you off your feet if you're close; it stands and roars, and the fight is on. The camera turns to watch it
  // (player.focus) and, for the Chimera, draws back to take it in (player.bossCam). Run from update(), and from game.js while a menu is open.
  stage(dt) {
    this.presence(dt);
    const A = this.arrival; if (!A) return; const g = this.g, P = g.player, u = A.u, at = A.at, once = (k) => !A.did[k] && (A.did[k] = true), t = (A.t += dt);
    if (t < ARRIVE.land) rumble(0.18 + 0.4 * Math.min(1, t / ARRIVE.land) ** 2);
    if (once('quake')) g.sound?.('quake', { dur: ARRIVE.land });
    if (t < ARRIVE.land && Math.random() < dt * 14) {   // (dust and grit shaken down off whatever stands round the arena)
      const a = Math.random() * 6.283, r = 8 + Math.random() * 14, p = u.center.clone().add(new THREE.Vector3(Math.cos(a) * r, 0.3 + Math.random() * 2.5, Math.sin(a) * r));
      dust(p, 2, 0x6e6254, 0.35); burst(p, { color: 0x8f8678, n: 3, speed: 1, size: 0.07, up: 0.5 }); }
    if (t > 1.0 && once('thunder')) { g.sound?.('thunder', 1.2); g.flashSky(0.35); }
    if (t > ARRIVE.light && once('light')) { pillar(at, { rise: ARRIVE.drop - ARRIVE.light, high: 80, r: u.boss === 'chimera' ? 4 : 3 }); g.flashSky(0.7); }
    if (t > ARRIVE.drop && once('drop')) {   // out of the sky, roaring
      this.calling = null; const c = g.creatures.spawn(u.boss, at.x, at.z, { level: 0, boss: true, aware: true }); c.state = 'chase'; c.arena = u.center.clone(); this.begin(c, u.boss);
      c.yaw = Math.atan2(P.pos.x - at.x, P.pos.z - at.z); c.intro = 99; c.ctl = { want: 0, at, air: ARRIVE.high }; A.c = c; bossAura(c);
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
    if (A.landed && t < ARRIVE.land + 0.25) askLight(at.clone().setY(at.y + 4), 60, 70, 0xffe2b0, undefined, false);   // (the flash lighting the ruin)
    if (t > ARRIVE.done) { this.arrival = null; P.focus = null; }
  }
  // a fight over without the kill: the tribute stays on the altar (and the beast's dead go back into the ground)
  unpaid() { const st = this.st; if (st.fight) { (st.paid ||= {})[st.fight] = true; delete st.fight; } for (const k of [...this.g.creatures.list]) if (k.summoned && !k.dead) this.g.creatures.remove(k); }
  // the fight is on: the first wave of help 30 seconds from now (or sooner: helpAt)
  begin(c, kind) { this.boss = c; this.bossKind = kind; this.helperT = 30; this.waves = 0; this.away = false; }
  // the fight over without the kill (you fell): the beast gone, its help and its bolts with it, the sky clearing, the
  // tribute left on the altar
  end() { const c = this.boss; this.healBar(false); this.unspend(c); this.calm(); this.g.creatures.remove(c); this.boss = null; this.away = false; this.bar.classList.add('hidden'); setWeather(null); this.unpaid(); bossAura(null); }
  // A fight on, as the owl hears it (owl.js keeps quiet through it): a beast on its way or fighting, even while you're out
  // of its reach (the user, 25 Nov: she waits until it's dead), and its end until its ashes have blown away (presence)
  get fighting() { return !!this.calling || !!this.arrival || (!!this.boss && !this.boss.dead) || !!this.dying; }
  // a wave of help: two of the boss's helpers rising at the arena's edge, not right beside you, and the next in 30 seconds
  help(c) {
    const g = this.g, P = g.player.pos, risen = []; this.helperT = 30; this.waves++;
    for (let i = 0; i < 2; i++) {
      let x = 0, z = 0; for (let k = 0; k < 8; k++) { const a = Math.random() * 6.28; x = c.arena.x + Math.cos(a) * 14; z = c.arena.z + Math.sin(a) * 14; if (Math.hypot(x - P.x, z - P.z) > 6) break; }
      const h = g.creatures.spawn(c.T.helpers, x, z, { summoned: true, aware: true }); h.state = 'chase'; dust(h.pos.clone().setY(h.pos.y + 0.5), 14, 0x8a7a68, 0.5); risen.push(h.pos.clone());
      if (c.T.helpers === 'skeleton') FX.riseFx(h.pos.clone());   // (grave-light as the dead claw their way up)
    }
    // (the Chimera's goat head casts its spell: signs flaring on the ground round it, its light streaming off to the forest's own)
    if (c.T.helpers === 'dryad') { const back = c.body.point?.('spine3')?.add(new THREE.Vector3(0, 2.5, 0)) || c.pos.clone().setY(c.pos.y + c.T.h); FX.goatSpellFx(back, c.pos.clone(), risen); g.sound?.('goatSpell', { at: back }); }
    g.hud.toast(c.T.helpers === 'skeleton' ? 'The dead of the Labyrinth rise to fight for their master' : 'Dryads answer the Chimera\'s call');
  }
  onKill(c) {
    if (c !== this.boss) return;
    // (and the storm breaks: the clouds part and the sun comes through, weather.js)
    const g = this.g, P = g.player; this.st.down[this.bossKind] = true; delete this.st.fight; this.healBar(false); this.unspend(c); this.calm(); this.boss = null; this.away = false; this.bar.classList.add('hidden'); breakStorm();
    // (the killing blow: a hard jolt and a moment of slow motion; Zeus takes the body once it has lain a moment: presence)
    punch(1, { x: P.pos.x - c.pos.x, z: P.pos.z - c.pos.z }); addShake(0.8); slowMo(0.6, 0.35); this.dying = { c, t: 0, did: {} };
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
    setTimeout(() => g.hud.toast(tier === 1 ? 'You can now work <b>lightstone</b>: new weapons, the pelta shield, lightstone arrows and Cretan armour at the workbench.' : 'You can now make the <b>Cretan bow</b>, the <b>lightstone sword</b> and bronze <b>Corinthian armour</b>. Zeus\'s storm over Valtos still holds: that trial is yet to come.'), 4500);
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
  // ---- boss behaviour. A giant boss walks you down and makes its moves, each on its own timer: every move opens with a
  // wind-up you can read from the boss camera (and get out of the way of), and while it runs it steers the boss (c.ctl:
  // its speed, heading, how fast it may turn). A move with a clip of its own (models.js BLOWS: the roar, the slam, the
  // sweep, the throw, claws, sting, fire) takes its timing from it: the blow lands, the rock leaves the hand, the fire
  // comes when the clip's moment does (m.hit), and the move lasts until the clip has settled (m.dur). After each move it
  // stands a moment (c.rest) before the next. Its big moves tire it (c.fatigue): after a few of them, or a charge into a
  // wall, it is spent (tired): it stops, heaving for breath, glowing faintly, and takes blows half again as hard, then
  // bellows you back and comes on. Below half health a boss is enraged: a lightning strike and a roar, quicker moves,
  // shorter rests and spent windows, harder blows, and (the Chimera) help from the forest at once.
  //   Minotaur (MOVE): a war cry that stuns anyone it reaches, a bull charge (paw, accelerate, can't turn; dazed and spent
  //             if he runs into a wall, skidding round and panting if he misses), a labrys slam that sends a shockwave
  //             round where it bites, a sweep of the labrys in front, and rubble thrown at anyone keeping their distance.
  //   Chimera:  claws, and the serpent's sting for anyone behind it; fire from the lion's mouth; a pounce from afar.
  bossThink(c, dt, d) {
    const g = this.g, P = g.player, T = c.T, toP = Math.atan2(P.pos.x - c.pos.x, P.pos.z - c.pos.z);
    c.cd ||= c.type === 'minotaur' ? { charge: 4, slam: 2, roar: 7, throw: 4, sweep: 1 } : { strike: 1, breath: 5, pounce: 7 };
    for (const k in c.cd) c.cd[k] -= dt * (c.enraged ? 1.35 : 1);
    c.rest = Math.max(0, (c.rest || 0) - dt); c.ctl = null;
    // coming down out of the sky, then standing and roaring before the fight (stage)
    if (c.fall !== undefined) { c.ctl = { want: 0, air: c.fall, face: c.yaw, snap: true }; return 'idle'; }
    if (c.intro > 0) { c.intro -= dt; c.ctl = { want: 0, face: toP }; return 'roar'; }
    // you're out of the fight's reach (update: away): back to its arena's middle, to stand there gathering its strength
    if (this.away && c.arena) { this.unspend(c); c.move?.mark?.done(); c.move = null; c.state = 'idle'; const dx = c.arena.x - c.pos.x, dz = c.arena.z - c.pos.z;
      const dd = Math.hypot(dx, dz), face = dd > FLEE.home ? g.creatures.steer(c, Math.atan2(dx, dz), dd, dt) : c.yaw;   // (round what still stands, as it chases: creatures.js)
      c.ctl = dd > FLEE.home ? { want: Math.abs(angDiff(face, c.yaw)) > 0.7 ? 0 : T.speed[1] * 0.5, face } : { want: 0 }; return null; }   // (turning round where it stands first)
    // leash: a boss doesn't wander off its arena; if you run, it goes back and heals
    if (c.arena && c.pos.distanceTo(c.arena) > 45) { this.unspend(c); c.move = null; c.state = 'idle'; c.yaw = Math.atan2(c.arena.x - c.pos.x, c.arena.z - c.pos.z); c.hp = Math.min(c.max, c.hp + c.max * 0.05 * dt); return null; }
    if (!c.enraged && c.hp < c.max * 0.5) {
      c.enraged = true; c.dmgK *= 1.15; if (!T.helpAt) this.helperT = Math.min(this.helperT, 1.5);   // (the Minotaur's dead keep their own time: help)
      if (c.move?.k !== 'tired') c.move = { k: 'roar', ph: 0, enrage: true, ...this.timed(c, 'roar', 1.3) };
      this.bolt(c.pos.clone().add(new THREE.Vector3(Math.sin(c.yaw + 2.2) * (T.r + 3), 0, Math.cos(c.yaw + 2.2) * (T.r + 3))), { warn: 0, big: 1.6 });   // (Zeus's storm answers his rage)
      g.hud.region(`${T.name} is enraged`, c.type === 'minotaur' ? 'His blows come faster and harder' : 'The forest answers its call');
    }
    // (the Chimera's follow-up claws: after a blow, often another straight away)
    if (c.state === 'attack') { if (!c.combo) { c.combo = true; c.atkCd = Math.random() < (c.enraged ? 0.6 : 0.4) ? 0.5 : c.enraged ? 1.5 : 2.1; } } else c.combo = false;
    if (c.move) return this.runMove(c, c.move, dt, d, toP);
    if (c.state !== 'chase' || c.hitT > 0) return null;
    const cd = c.cd, clear = this.clearLine(c, d), front = Math.abs(angDiff(toP, c.yaw)) < 0.9;
    const start = (k, t, extra) => { c.move = { k, ph: 0, ...extra, ...this.timed(c, k, t) }; return this.runMove(c, c.move, 0, d, toP); };
    // spent after its run of big moves (it doesn't wait for its rest to be over: it's done in)
    if ((c.fatigue || 0) >= (c.spent ||= this.spentAfter(c))) return start('tired', rr(...MOVE.tired.secs[c.enraged ? 1 : 0]));
    if (c.rest > 0) return null;
    if (c.type === 'minotaur') {
      const M = MOVE, can = { roar: cd.roar <= 0 && d < M.roar.r - 2, slam: cd.slam <= 0 && d < 10 && front && clear, sweep: cd.sweep <= 0 && d < M.sweep.reach + 0.5 && front && clear,
        charge: cd.charge <= 0 && d > 13 && d < 46 && clear && g.creatures.clearTo(c, toP, T.r + 6) >= T.r + 5.5, throw: cd.throw <= 0 && d > 17 && clear };   // (behind a boulder or a wall you are out of reach of all but his roar: nav.js brings him round to you; a charge needs room for his breadth too)
      const next = c.next; c.next = null;
      for (const k of next && can[next] ? [next] : ['roar', 'slam', 'sweep', 'charge', 'throw']) if (can[k]) { cd[k] = rr(...M[k].cd); return start(k, k === 'charge' ? M.charge.paw[c.enraged ? 1 : 0] : M[k].t, k === 'charge' ? { dir: toP } : {}); }
    } else if (c.type === 'chimera') {
      if (cd.pounce <= 0 && d > 15 && d < 38 && clear) { cd.pounce = rr(9, 12); return start('pounce', 0.75); }
      if (cd.breath <= 0 && d > 8 && d < 26) { cd.breath = rr(8, 11); return start('breath', 0.8); }
      if (cd.strike <= 0 && d < T.reach + 3.5) {
        cd.strike = rr(3, 5); const behind = Math.abs(angDiff(toP, c.yaw)) > 1.8;
        return start(behind || Math.random() < 0.35 ? 'sting' : 'claw', behind ? 0.8 : 0.7);
      }
    }
    return null;
  }
  // how many big moves it makes before it is spent (fewer measured, more enraged: it keeps at you longer, then rests less)
  spentAfter(c) { const [a, b] = MOVE.tired.after[c.enraged ? 1 : 0]; return Math.floor(rr(a, b + 1)); }
  unspend(c) { c.tired = 0; c.glow = 0; if (this.boss === c) this.tiredBar(false); }
  // a move's timing: from its clip, if it has one (t: the wind-up, hit: when it lands, dur: when it's over), or t for all
  timed(c, k, t) { const q = c.body.cue?.(k); return q ? { t: q.hit, hit: q.hit, dur: q.dur } : { t, hit: t, dur: t }; }
  // nothing solid between the boss and you (a wall, a column, a tree)
  // (not the rubble of a ruin, which a giant strides over, nor the trees it tramples). From his middle, as the charge's
  // crash is found: a brazier or a column right against his chest stood inside a line begun at his front
  clearLine(c, d) { const P = this.g.player.pos, dx = (P.x - c.pos.x) / Math.max(d, 0.01), dz = (P.z - c.pos.z) / Math.max(d, 0.01); return !this.g.colliders.pick(c.pos.x, c.pos.z, dx, dz, Math.max(0.1, d - 0.8), SOLID); }
  // One step of a move: wind-up (ph 0), then the move itself (ph 1), sometimes more (a charge's crash or skid). over(big):
  // the move is done; a big one tires the boss, and it stands a moment before the next (c.rest), or goes straight into
  // the move it was leading up to (c.next: a roar into a charge or a slam; enraged, a slam into a sweep)
  runMove(c, m, dt, d, toP) {
    const g = this.g, P = g.player, T = c.T, at = (k = 0) => c.pos.clone().setY(c.pos.y + k), fwd = () => new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw)), en = c.enraged ? 1 : 0;
    const over = (big) => { c.move = null; c.ctl = null; if (big) c.fatigue = (c.fatigue || 0) + 1; c.rest = c.next ? 0.2 : rr(...MOVE.rest[en]); return null; };
    const near = (p, far = 45) => Math.max(0, 1 - P.pos.distanceTo(p) / far);
    m.t -= dt; m.e = (m.e || 0) + dt;
    switch (m.k) {
      case 'roar': {   // war cry: the head thrown back and the bellow, a shockwave racing out (MOVE.roar.r); it stuns anyone it reaches who isn't behind a wall. A bellow (spent, getting his breath back) only shoves you off
        const R = m.bellow ? MOVE.roar.shove : MOVE.roar.r; c.ctl = { want: 0, face: m.e < m.hit - 0.4 ? toP : undefined };
        if (!m.warned) { m.warned = true; if (!m.bellow) ring(at(0.1), { reach: R, grow: false, time: m.hit, k: 0.35, color: 0xff9a50 }); }   // (the reach of it shown on the ground as he draws breath)
        if (!m.done && m.e >= m.hit) { m.done = true; g.sound?.('roar', { boss: true, long: m.enrage, at: c.pos }); addShake(m.enrage ? 1 : 0.75); dust(at(1), 18, 0x8a7a64, 0.9); g.flashSky?.(m.enrage ? 0.4 : 0);
          FX.roarFx(c.body.point?.(BOSS_HEAD[c.type]) || at(T.h * 0.85), fwd(), m.enrage);   // (his breath steaming out, embers blown off him)
          ring(at(0.1), { reach: R, time: MOVE.roar.ring, k: 1 }); ring(at(0.1), { reach: R * 0.8, time: MOVE.roar.ring * 1.3, k: 0.5 }); }
        if (m.done && m.e - m.hit < MOVE.roar.ring) { const u = (m.e - m.hit) / MOVE.roar.ring, r = R * (1 - (1 - u) ** 2);   // (the dust the wave throws up as it races out)
          for (let i = 0; i < 7; i++) { const a = Math.random() * 6.283; dust(new THREE.Vector3(c.pos.x + Math.cos(a) * r, c.pos.y + 0.4, c.pos.z + Math.sin(a) * r), 1, 0x9a8a74, 0.7 + 0.5 * (1 - u)); } }
        if (m.done && !m.reached) {   // (it reaches you when the ring does, if it does)
          const u = Math.min(1, (m.e - m.hit) / MOVE.roar.ring), r = R * (1 - (1 - u) ** 2);
          if (d <= r && P.dead) m.reached = true;
          else if (d <= r) { m.reached = true;
            if (m.bellow) { const a = new THREE.Vector3(P.pos.x - c.pos.x, 0, P.pos.z - c.pos.z).normalize(); P.hv.addScaledVector(a, 9); P.vel.y = 3; P.onGround = false; punch(0.6, a); }
            else if (!this.clearLine(c, d)) g.hud.toast('The wall shields you from the roar');
            else this.stun(MOVE.roar.stun); }
          else if (u >= 1) m.reached = true; }
        if (m.e < m.dur) return 'roar';
        if (!m.bellow && !m.enrage && c.type === 'minotaur') { c.next = d > 13 && this.clearLine(c, d) ? 'charge' : d < 10 ? 'slam' : null; if (c.next) c.cd[c.next] = Math.min(c.cd[c.next], 0); }
        return over(!m.bellow);
      }
      case 'slam': {   // the labrys raised high, then brought down: a glow where it will bite, then a shockwave out from there (MOVE.slam), cracks and stones flung up
        const C = MOVE.slam, aim = () => at(0).addScaledVector(fwd(), C.ahead), lock = m.e >= m.hit - 0.45; c.ctl = { want: 0, face: lock ? undefined : toP, turn: 0.6 };
        if (!m.mark) m.mark = mark(aim(), { r: 1, color: 0xff5a28 }); if (!m.hit0) { if (!lock) m.mark.m.position.copy(aim()).setY(c.pos.y + 0.12); m.mark.set(Math.min(1, m.e / m.hit) * 0.8, C.core * Math.min(1, 0.4 + m.e / m.hit)); }
        if (!m.hit0 && m.e >= m.hit) { m.hit0 = true; m.mark.done(); const ax = c.body.point?.('axe'), p = ax && ax.distanceTo(c.pos) < C.ahead * 1.6 ? ax.setY(c.pos.y + 0.2) : aim();
          ring(p, { reach: C.r, time: 0.45 }); cracks(p, { r: C.core * 2.2 }); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; dust(p.clone().add(new THREE.Vector3(Math.cos(a) * 6, 0, Math.sin(a) * 6)), 2, 0x7a6c5c, 0.8); }
          burst(p.clone().setY(p.y + 0.5), { color: 0x7d7062, n: 34, speed: 9, size: 0.3, life: 1.8, grav: 16, up: 8 }); spark(p.clone().setY(p.y + 0.4), 12); const k0 = near(p, 40); FX.slamFx(p);
          addShake(0.5 + 0.5 * k0); punch(Math.max(0.35, k0), { x: P.pos.x - p.x, z: P.pos.z - p.z }); g.sound?.('slam', { at: p, big: true });
          // (the wave's force falls off from where the blade bit: all of it within core, a quarter at its edge; jump it and it passes under you)
          const dd = Math.hypot(P.pos.x - p.x, P.pos.z - p.z); if (dd < C.r && P.onGround !== false) { const k = dd < C.core ? 1 : 1 - 0.75 * (dd - C.core) / (C.r - C.core); g.combat.hitPlayer(c, [C.dmg[0] * k, C.dmg[1] * k, C.dmg[2]], { from: p }); } }
        if (m.e < m.dur) return 'slam';
        if (c.enraged && c.type === 'minotaur' && Math.random() < 0.6) { c.next = 'sweep'; c.cd.sweep = Math.min(c.cd.sweep, 0); }
        return over(true);
      }
      case 'sweep': {   // the labrys drawn back and swung flat across in front of him at a man's height: roll back out of it, or duck (sneak) and it passes over you
        const C = MOVE.sweep; c.ctl = { want: 0, face: m.e < m.hit - 0.5 ? toP : undefined, turn: 0.7 };
        if (!m.arc && m.e >= m.hit - 0.12) { m.arc = true; FX.sweepFx(c, C.reach, C.arc); g.sound?.('bossSwing', { at: at(2).addScaledVector(fwd(), 5) }); }   // (the labrys's arc through the air, drawn as it swings)
        if (!m.hit0 && m.e >= m.hit) { m.hit0 = true; const inArc = d < C.reach + T.r * 0.3 && Math.abs(angDiff(toP, c.yaw)) < C.arc;
          dust(at(0.3).addScaledVector(fwd(), C.reach * 0.6), 8, 0x8a7a64, 0.6); g.sound?.('slam', { at: at(2).addScaledVector(fwd(), 5) });
          if (inArc && !P.dead) { if (P.sneaking) { if (!this.duckTold) { this.duckTold = true; g.hud.toast('You duck under the labrys'); } } else g.combat.hitPlayer(c, T.dmg); } }
        return m.e >= m.dur ? over(false) : 'sweep';
      }
      case 'throw': {  // tears up a block of the ruin and hurls it, from his free hand as the swing comes forward; its shadow shows where it will come down
        c.ctl = { want: 0, face: m.e < m.hit ? toP : undefined };
        if (!m.rock) { m.rock = new THREE.Mesh(ROCK_GEO, ROCK_MAT); m.rock.castShadow = true; m.rock.userData.nearShadow = true; g.scene.add(m.rock); }
        if (!m.hit0) { const h = c.body.point?.('LeftHand'); if (h) m.rock.position.copy(h); m.rock.scale.setScalar(Math.min(1, m.e / (m.hit * 0.6))); if (Math.random() < dt * 25) FX.rockCrumbs(m.rock.position); }   // (earth falling off it)
        if (!m.hit0 && m.e >= m.hit) { m.hit0 = true; g.scene.remove(m.rock); const t = g.combat.throwAt(c, [24, 34, 'blunt'], { rock: true, size: MOVE.throw.size, from: c.body.point?.('LeftHand') }); g.sound?.('boulder', { at: c.pos });
          const to = P.pos.clone(); to.y = this.g.creatures.groundAt(to.x, to.z, to.y); this.marks.push({ h: mark(to, { r: 0.6, shadow: true, life: 8 }), t, from: t.m.position.distanceTo(to) }); }
        return m.e >= m.dur ? over(true) : 'throw';
      }
      case 'charge': {
        const C = MOVE.charge;
        if (m.ph === 0) {   // pawing the ground, horns lowered, turning to face you: dust kicked up behind him, a snort
          c.ctl = { want: 0, face: toP, turn: 1 }; m.dir = c.yaw;
          if (Math.floor(m.e * 3.5) !== m.dust) { m.dust = Math.floor(m.e * 3.5); const p = at(0.2).addScaledVector(fwd(), -T.r * 0.6); dust(p, 7, 0x9a8a70, 0.7); burst(p, { color: 0x6e604e, n: 5, speed: 3, size: 0.15, up: 3 }); g.sound?.('giantStep', { at: p, k: 0.5 }); }
          if (!m.snd) { m.snd = true; g.sound?.('snort', { at: c.pos }); setTimeout(() => this.boss === c && g.sound?.('snort', { at: c.pos }), 650); }
          // (he runs only once he faces you with nothing right before him: turned slowly round from a brazier or a column
          // he stood against, he charged straight into it, crashed at once and was spent, again and again, never reaching
          // you. Still turning, he paws a moment longer; facing you with no clear run, he gives it up, unspent)
          if (m.t <= 0) { const facing = Math.abs(angDiff(toP, c.yaw)) < 0.35, open = g.creatures.clearTo(c, c.yaw, T.r + 6) >= T.r + 5.5;   // (his whole breadth: creatures.js)
            if (!(facing && open)) return facing || m.t < -1.2 ? over(false) : 'paw';
            m.ph = 1; m.v = 2; m.run = 0; m.from = c.pos.clone(); g.sound?.('charge', { at: c.pos, dur: C.top[en] / C.acc + 1 }); } return 'paw';
        }
        if (m.ph === 1) {   // the charge: gathering speed over a few strides to its top, turning less and less as it goes (and not at all once you're past his shoulder)
          m.run += dt; const top = C.top[en]; m.v = Math.min(top, m.v + C.acc * dt);
          const lim = C.turn[0] + (C.turn[1] - C.turn[0]) * (m.v / top), off = angDiff(toP, m.dir); if (Math.abs(off) < 1.3) m.dir += clamp(off, -lim * dt, lim * dt);
          c.ctl = { want: m.v, face: m.dir, turn: 4, acc: 99, dec: 99 }; FX.chargeFx(c, m.v, dt);
          const dx = P.pos.x - c.pos.x, dz = P.pos.z - c.pos.z, ahead = dx * Math.sin(m.dir) + dz * Math.cos(m.dir), side = Math.abs(dx * Math.cos(m.dir) - dz * Math.sin(m.dir));
          if (!m.gored && !P.dead && m.v > 4 && ahead > -1 && ahead < T.r + C.horns && side < T.r * 0.5 + C.wide) { const r = g.combat.hitPlayer(c, C.dmg); if (r !== 'dodged') m.gored = true; }   // (the ram's gore: docs/plans/balance.md)
          const wall = g.colliders.pick(c.pos.x, c.pos.z, Math.sin(m.dir), Math.cos(m.dir), T.r + 1.2, SOLID);
          // (held up: going under a third of the pace he runs at. creatures.js's stuck counts anything under 3 m/s, and a
          // charge sets off at 2: setting off with a shoulder brushing a brazier, he read as crashed and was spent at once)
          const moved = m.lx === undefined ? Infinity : Math.hypot(c.pos.x - m.lx, c.pos.z - m.lz); m.lx = c.pos.x; m.lz = c.pos.z; m.jam = moved < m.v * dt * 0.3 ? (m.jam || 0) + dt : 0;
          if (m.run > 0.25 && (wall || m.jam > 0.2)) {   // straight into a wall: a crash you feel, stones flying, and he reels, dazed
            const p = at(3).addScaledVector(fwd(), T.r + 0.5), k0 = near(c.pos);
            m.ph = 2; m.t = 1.1; FX.crashFx(p, at(0.1).addScaledVector(fwd(), T.r)); addShake(0.6 + 0.4 * k0); punch(0.9 * k0 + 0.2, { x: P.pos.x - p.x, z: P.pos.z - p.z }); g.sound?.('slam', { at: p, big: true }); g.sound?.('collapse', { at: p, k: 1.2 }); dust(p, 20, 0x7a6c5c, 1.1); burst(p, { color: 0x8f8678, n: 36, speed: 9, size: 0.35, grav: 14, up: 6 }); spark(p, 10);
            return 'dazed';
          }
          // (past you, or run out: he digs his hooves in and skids)
          if ((m.gored && m.run > 0.6) || ahead < -T.r - 2 || m.run > C.max || c.pos.distanceTo(m.from) > C.far) { m.ph = 3; m.e3 = 0; } return 'run';
        }
        if (m.ph === 2) { c.ctl = { want: 0, dec: 30 }; if (m.t > 0) return 'dazed'; c.move = { k: 'tired', ph: 0, wall: true, ...this.timed(c, 'tired', MOVE.tired.wall[en]) }; return this.runMove(c, c.move, 0, d, toP); }   // (then spent, open to your blows)
        m.e3 += dt;
        if (m.ph === 3) {   // skidding to a stop, ploughing up the ground, then turning round
          c.ctl = { want: 0, face: m.dir, dec: C.skid, turn: 0.2 }; if (c.speed > 1) FX.chargeFx(c, c.speed, dt); if (Math.random() < dt * 14 * Math.min(1, c.speed / 4)) { const p = at(0.2).addScaledVector(fwd(), T.r * 0.3); p.x += (Math.random() - 0.5) * T.r; dust(p, 3, 0x8a7a64, 0.8); burst(p, { color: 0x6e604e, n: 3, speed: 2, size: 0.15, up: 2.5 }); }
          if (c.speed < 0.6) { c.ctl.face = toP; c.ctl.turn = 1.1; if (Math.abs(angDiff(toP, c.yaw)) < 0.5 || m.e3 > 4.5) { m.ph = 4; m.t = C.pant; m.breath = 0; } } return c.speed > 1.5 ? 'run' : 'chase';
        }
        c.ctl = { want: 0, face: toP, turn: 0.4 }; if (m.e3 > (m.breath || 0)) { m.breath = m.e3 + 1.5; g.sound?.('pant', { at: c.body.point?.('Head') || at(8), k: 0.8 }); }   // (panting a moment before he comes on)
        return m.t > 0 ? 'tired' : over(true);
      }
      case 'tired': {   // spent: stopped, heaving for breath, steam from his nostrils on each breath out, a glow on him (and the bar) while blows land harder (creatures.js hurt), then a bellow and on he comes
        c.ctl = { want: 0, dec: 8 }; c.tired = Math.max(0.01, m.t); c.glow = 0.28 + 0.16 * Math.sin(m.e * 4.2); if (this.boss === c) this.tiredBar(true);
        if (!m.told) { m.told = true; g.hud.toast(`${T.name} is <b>spent</b>: strike now, your blows land harder!`); }
        if (m.e > (m.breath ?? 0.3)) { m.breath = m.e + 1.5; g.sound?.('pant', { at: c.body.point?.('Head') || at(T.h * 0.8) }); const h = c.body.point?.('Head'); if (h) { const f = fwd(); setTimeout(() => { for (let i = 0; i < 2; i++) burst(h.clone().addScaledVector(f, T.r * 0.55).setY(h.y - 0.3), { color: 0xe8eef2, n: 3, speed: 1.2, size: 0.5, life: 1.4, grav: -0.8, up: 0.6, spread: 1.2 }); }, 750); } }
        if (m.t > 0) return 'tired';
        this.unspend(c); c.fatigue = 0; c.spent = this.spentAfter(c); c.rest = 0;
        c.move = { k: 'roar', ph: 0, bellow: true, ...this.timed(c, 'roar', 1.3) }; return this.runMove(c, c.move, 0, d, toP);
      }
      case 'claw': case 'sting':   // the old strikes, now as moves: committed a moment before they land, the claws only in front
        c.ctl = { want: 0, face: m.e < m.hit - 0.3 ? toP : undefined };
        if (!m.hit0 && m.e >= m.hit) { m.hit0 = true;
          // (the venom only if the sting went in: not rolled clear of, not taken on the guard)
          if (m.k === 'sting' && d < 14) { if (landed(g.combat.hitPlayer(c, [52, 72, 'pierce']))) P.stats.add('poisoned', 6); } else if (m.k === 'claw' && d < T.reach + 1.5 && Math.abs(angDiff(toP, c.yaw)) < 1) g.combat.hitPlayer(c, [22, 32, 'slash']);
          const paw = c.body.point?.(m.k === 'sting' ? 'tail11' : 'Leg_R_F5'); if (paw) { if (m.k === 'sting') FX.stingFx(paw.clone(), d < 14 ? P.pos.clone().setY(P.pos.y + 1) : paw.clone().addScaledVector(fwd(), -6)); else FX.clawFx(c, paw.clone().setY(c.pos.y + 0.2));
            dust(paw.setY(c.pos.y + 0.2), 6, 0x7a6c5c, 0.8); g.sound?.('slam', { at: paw, big: true }); } }
        if (!m.swung && m.e >= m.hit - 0.3) { m.swung = true; g.sound?.(m.k === 'sting' ? 'sting' : 'bossSwing', { at: c.body.point?.(m.k === 'sting' ? 'tail11' : 'Leg_R_F5') || c.pos }); }
        return m.e >= m.dur ? over(false) : m.k;
      case 'breath':   // fire from the lion's mouth, swept slowly after you, once its head is down (the clip held there)
        if (m.ph === 0) { c.ctl = { want: 0, face: toP }; if (m.t <= 0) { m.ph = 1; m.t = 1.5; g.sound?.('breath', { at: c.body.point?.('mouth') || c.pos }); } return 'breath'; }
        c.ctl = { want: 0, face: c.yaw + clamp(angDiff(toP, c.yaw), -0.9 * dt, 0.9 * dt), turn: 9 };
        // (the fire a cone from the lion's jaws, as long and as wide as the beast is big: a stream of flame and embers
        // reaching out 24 m and spreading as it goes, its light on the ground)
        { const f = fwd(), mouth = c.body.point?.('mouth')?.addScaledVector(f, 1.5) || at(T.h * 0.62).addScaledVector(f, T.body?.[1] ?? T.r + 1.2);
          // (the flame itself on the GPU, bossblows.js: a white-hot core, rolling flame, black smoke, embers; where it meets
          // the ground it flares and leaves the ground scorched)
          const gp = mouth.clone().addScaledVector(f, rr(12, 22)); gp.y = g.creatures.groundAt(gp.x, gp.z, c.pos.y + 2); FX.breathFx(mouth, f, dt, gp);
          m.burn = (m.burn || 0) - dt; if (m.burn <= 0) { m.burn = 0.3; FX.scorch(gp, { r: rr(1.2, 1.8), glow: 4 }); }
          askLight(mouth.clone().addScaledVector(f, 8), 40, 30, 0xff8a30, undefined, false);
          m.tick = (m.tick || 0) - dt;
          if (m.tick <= 0) { m.tick = 0.25; if (d < 26 && Math.abs(angDiff(toP, c.yaw)) < 0.45 && landed(g.combat.hitPlayer(c, [9, 13, 'fire']))) P.stats.add('burning', 3); } }
        return m.t <= 0 ? over(true) : 'breath';
      case 'pounce':   // crouched to spring, its landing glowing on the ground under you, then the leap
        if (m.ph === 0) { FX.crouchFx(c); c.ctl = { want: 0, face: toP }; m.to = P.pos.clone().addScaledVector(new THREE.Vector3(Math.sin(toP), 0, Math.cos(toP)), -5); m.mark ||= mark(m.to, { r: T.r + 4.5, color: 0xff6a30 }); m.mark.m.position.set(m.to.x, this.g.creatures.groundAt(m.to.x, m.to.z, m.to.y) + 0.12, m.to.z); m.mark.set(Math.min(1, m.e / m.hit) * 0.7);
          if (m.t <= 0) { m.ph = 1; m.t = 1; m.from = c.pos.clone(); g.sound?.('roar', { boss: true, at: c.pos }); FX.leapFx(at(0.1)); } return 'crouch'; }
        if (m.ph === 1) { const k = 1 - Math.max(0, m.t) / 1; c.ctl = { want: 0, face: Math.atan2(m.to.x - m.from.x, m.to.z - m.from.z), snap: true, at: m.from.clone().lerp(m.to, k), air: Math.sin(k * Math.PI) * 6 };
          if (m.t <= 0) { const k0 = near(c.pos); m.ph = 2; m.t = 0.5; m.mark.done(); ring(at(0.1), { reach: T.r + 8, time: 0.4 }); FX.landFx(at(0.1), T.r + 8); addShake(0.6 + 0.4 * k0); punch(0.9 * k0, { x: P.pos.x - c.pos.x, z: P.pos.z - c.pos.z }); g.sound?.('slam', { at: c.pos, big: true }); dust(at(0.2), 20, 0x7a6c5c, 1.1);
            if (P.pos.distanceTo(c.pos) < T.r + 4.5) g.combat.hitPlayer(c, [40, 50, 'slash']); } return 'leap'; }
        c.ctl = { want: 0 }; return m.t <= 0 ? over(true) : 'leap';
    }
    return over(false);
  }
  // ---- a boss's presence and its end (bossfx.js): its aura while it lives; and once its body has lain a moment
  // (END.lie), Zeus's bolt strikes its head out of the storm's last cloud, the flash, the crack and the boom at once, the
  // ground shaking and a shockwave racing out along it; the body glows up from where the bolt struck (END.glow) and
  // breaks into embers and ash that blow away on the wind, and what it leaves drops where it lay (creatures.js vanish,
  // once it's ashen). Run from stage, so it goes on behind a menu as a boss's coming does.
  presence(dt) {
    updateBossFx(dt); const E = this.dying; if (!E) return; const g = this.g, c = E.c, P = g.player; E.t += dt;
    if (c.gone && !E.did.bolt) { this.dying = null; return; }   // (its body taken away first: a test clearing the arena)
    if (!E.did.bolt && E.t > END.lie) { E.did.bolt = true;
      const head = c.body.point?.(BOSS_HEAD[c.type]) || c.pos.clone().setY(c.pos.y + c.T.h * 0.3); E.at = head; E.ground = c.pos.clone();
      strike({ at: head.clone().add(new THREE.Vector3(rr(-12, 12), 190, rr(-12, 12))), ground: head, light: 1.6, big: 2 });   // (not counted in struck: that's the fight's storm)
      g.sound?.('bossEnd', { at: head }); g.flashSky(1); addShake(1); punch(1, { x: P.pos.x - c.pos.x, z: P.pos.z - c.pos.z }); slowMo(0.35, 0.5);
      ring(E.ground, { reach: c.type === 'chimera' ? 40 : 32, time: 1.1, k: 1 }); spark(head, 40); cracks(E.ground, { r: c.type === 'chimera' ? 12 : 8, life: 14 });
      E.bits = dissolve(c.body.obj, head, { n: c.type === 'chimera' ? 18000 : 14000, glowFor: END.glow });
    }
    if (E.did.bolt && E.t < END.lie + 0.3) askLight(E.at.clone().setY(E.at.y + 3), 90, 60, 0xc8d8ff, undefined, false);   // (the bolt lighting the ruin)
    if (E.did.bolt && !E.did.ash) { c.glow = 3 * Math.min(1, (E.t - END.lie) / END.glow);
      if (E.t > END.lie + END.glow) { E.did.ash = true; c.body.obj.visible = false; c.ashen = true; dust(E.ground.clone().setY(E.ground.y + 1), 30, 0x3a332c, 1.2); burst(E.at, { color: 0xffa040, n: 40, speed: 7, size: 0.12, life: 1.4, grav: 2, up: 5, glow: true }); } }
    if (E.did.ash && !dissolving()) this.dying = null;
  }
  // You're stunned (a roar): no moving or striking for secs (player.js daze), the world muffled round you (sound.js)
  stun(secs) { const g = this.g, P = g.player; P.stats.add('stunned', secs); daze(secs); g.hud.toast('The roar <b>stuns</b> you!'); P.hv.multiplyScalar(0.2); }
  // the boss bar while you're out of the fight's reach: its name says the beast is healing, the bar glowing green round it
  healBar(on) { if (this.barHeal === on) return; this.barHeal = on; const n = this.bar.querySelector('.bn'), b = this.bar.querySelector('.bb'); if (this.boss) n.textContent = this.boss.T.name + (on ? ' · regaining strength' : ''); b.style.boxShadow = on ? '0 0 10px #7fd060' : ''; }
  // the boss bar golden while the boss is spent
  tiredBar(on) { if (this.barTired === on) return; this.barTired = on; const i = this.bar.querySelector('i'); i.style.background = on ? 'linear-gradient(90deg, #c98a2a, #ffd56a)' : ''; i.style.boxShadow = on ? '0 0 12px #ffc850' : ''; }
  // ---- Zeus's storm over a boss fight (update): from the summons until the beast dies, a bolt comes down about the arena
  // every few seconds (sooner once it's enraged), lighting the ruin, its thunder at once; some near you, their place
  // glowing and crackling on the ground a second first (STORM.warn), to be got out of; a bolt hurts whatever it falls on,
  // you, the boss or its dead. The storm itself (rain, wind, the dark) is weather.js's thunder.
  storm(dt) {
    const c = this.boss, P = this.g.player; if (!c?.arena || c.dead || this.arrival) return;
    this.stormT = (this.stormT ?? 2) - dt;
    // (and the sky over it alive with lightning between the bolts: flashes in the clouds and strikes far off, their thunder rolling round)
    this.skyT = (this.skyT ?? 1) - dt; if (this.skyT <= 0) { this.skyT = rr(...(c.enraged ? [0.8, 2] : [1.4, 3.2])); skyStrike(0, Math.random() < 0.5); }
    if (this.stormT <= 0) {
      const en = c.enraged ? 1 : 0; this.stormT = rr(...STORM.every[en]);
      if (Math.random() < STORM.near[en] && !P.dead && !this.away && !P.stats.has('stunned')) { const a = Math.random() * 6.283, r = Math.random() * STORM.spread; this.bolt(P.pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r))); }
      else for (let i = 0; i < 6; i++) { const a = Math.random() * 6.283, r = rr(16, 48), p = c.arena.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); if (p.distanceTo(P.pos) > 10) { this.bolt(p, { warn: 0 }); break; } }
    }
  }
  // a bolt at p (on the ground there): warned (seconds of glow first) or not
  bolt(p, { warn = STORM.warn, big = 1.3 } = {}) { p.y = this.g.creatures.groundAt(p.x, p.z, p.y + 2); const h = warn ? mark(p, { r: STORM.r, color: 0x9fc4ff, life: warn + 1 }) : null; if (warn) this.g.sound?.('zap', { at: p, dur: warn }); this.bolts.push({ p, t: warn, warn, h, big }); }
  updateBolts(dt) {
    const g = this.g, P = g.player;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t -= dt; if (b.h) b.h.set(Math.min(1, 1 - b.t / b.warn) * (0.65 + 0.35 * Math.sin(b.t * 40)));
      if (b.t > 0) continue; this.bolts.splice(i, 1); b.h?.done(); this.struck = (this.struck || 0) + 1;   // (struck: how many so far, for the tests)
      // (heavier than a storm's own (the user, 25 Nov): a brighter strike and a bigger crack, the ground blasted and left
      // scorched with embers in it, smoke and embers rising off it a while, and a jolt if it's near you)
      strike({ at: b.p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 40, 190, (Math.random() - 0.5) * 40)), ground: b.p, light: 1.8, big: b.big * 1.4 });
      spark(b.p.clone().setY(b.p.y + 0.4), 24); burst(b.p.clone().setY(b.p.y + 0.3), { color: 0x4a4038, n: 18, speed: 6, size: 0.18, up: 6 }); dust(b.p.clone().setY(b.p.y + 0.5), 8, 0x6a6a72, 0.6); cracks(b.p, { r: 2.6, life: 9 });
      FX.boltFx(b.p, b.big / 1.3); b.lit = 0.35; this.lit.push(b); g.sound?.('boltHit', { at: b.p });
      { const dn = Math.hypot(P.pos.x - b.p.x, P.pos.z - b.p.z); if (dn < 30) { const k = 1 - dn / 30; punch(0.25 + 0.6 * k, { x: P.pos.x - b.p.x, z: P.pos.z - b.p.z }); addShake(0.5 * k); } }
      if (!b.warn) continue;   // (a far bolt, or the enrage's: lightning only)
      if (!P.dead && Math.hypot(P.pos.x - b.p.x, P.pos.z - b.p.z) < STORM.r) g.combat.hitPlayer({ pos: b.p, dmgK: 1, T: {}, body: {} }, STORM.dmg, { from: b.p });   // (the bolt as the blow's source)
      for (const k of g.creatures.list) if (!k.dead && (k.boss ? g.creatures.gap(k, b.p.x, b.p.z).d < k.T.r + STORM.r : k.pos.distanceTo(b.p) < STORM.r + k.T.r)) { g.creatures.hurt(k, [[k.boss ? k.T.bolt ?? STORM.boss : 999, 'force']], b.p); if (k.boss && !this.boltTold) { this.boltTold = true; g.hud.toast('Zeus\'s lightning strikes the beast!'); } }
    }
    // (the bolts' light on the ruin for a moment after they fall)
    for (let i = this.lit.length - 1; i >= 0; i--) { const b = this.lit[i]; b.lit -= dt; if (b.lit <= 0) { this.lit.splice(i, 1); continue; } askLight(b.p.clone().setY(b.p.y + 3), 90 * b.lit / 0.35 * (LIGHTNING.soft ? 0.4 : 1), 40, 0xc8d8ff, undefined, false); }
    // (a thrown rock's shadow, growing as it comes down, gone when it lands; its trail of grit, and the burst where it lands)
    for (let i = this.marks.length - 1; i >= 0; i--) { const q = this.marks[i]; if (!g.combat.thorns.includes(q.t)) { FX.rockLandFx(q.h.m.position.clone()); q.h.done(); this.marks.splice(i, 1); continue; } FX.rockTrail(q.t.m.position); q.h.set(0.9, 0.6 + 2.2 * Math.max(0, 1 - q.t.m.position.distanceTo(q.h.m.position) / q.from)); }
  }
  // the fight over: no more bolts or marks waiting
  calm() { for (const b of this.bolts) b.h?.done(); for (const q of this.marks) q.h.done(); this.bolts = []; this.marks = []; this.stormT = 3; }
  update(dt) {
    const g = this.g, st = this.st; this.stage(dt); this.storm(dt); this.updateBolts(dt);
    // (the boss camera while a fight is on and you're about its arena, or one is coming: player.js BOSS_CAM; for a boss whose
    // fight has it, bossCam, the Chimera's)
    g.player.bossCam = (!!this.arrival && !!TYPES[this.arrival.u.boss]?.bossCam) || (!!this.boss && !this.boss.dead && !!this.boss.T.bossCam && g.player.pos.distanceTo(this.boss.pos) < 70);
    // (and where its chest is, coming down out of the sky too, for the camera to lean up towards: player.js BOSS_CAM)
    const bc = g.player.bossCam && (this.boss && !this.boss.dead ? this.boss : this.arrival?.c); g.player.bossAt = bc ? (this.bossAt ||= new THREE.Vector3()).copy(bc.pos).setY(bc.pos.y + (bc.fall || 0) + bc.T.h * 0.6) : null;
    if (hit('KeyF') && !g.player.dead && g.altUsed !== 'F') this.usePower();   // (F at a lit fire puts the fire out instead)
    if (st.powerCd > 0) { st.powerCd -= dt; if (Math.floor(st.powerCd) !== this.lastCd) { this.lastCd = Math.floor(st.powerCd); this.drawPower(); } }
    if (g.player.stats.has('poisoned')) g.player.stats.damage(1.5 * dt);
    if (g.player.stats.has('burning')) g.player.stats.damage(2.5 * dt);
    // boss fight: health bar, and help in waves 30 seconds apart; the first sooner if the boss is brought down to helpAt
    // (one wave, should both come in the same moment). Fallen in it, it's over once you're lifted up again; out of its
    // reach (FLEE), it waits for you, the beast healing, no help rising meanwhile
    if (this.boss) {
      const c = this.boss, P = g.player; this.bar.querySelector('i').style.width = (c.hp / c.max) * 100 + '%';
      if (this.fell && !P.dead && !c.dead) { this.end(); g.hud.toast(`You fell. Your tribute still lies on the altar: call ${BOSS_NAME[this.bossKind]} again when you're ready.`); }
      else if (!c.dead && c.arena) {
        const d = Math.hypot(P.pos.x - c.arena.x, P.pos.z - c.arena.z), away = !P.dead && (d > FLEE.r || (this.away && d > FLEE.r - FLEE.back));
        if (away !== this.away) { this.away = away; this.healBar(away); if (away) g.hud.toast(`You have left the arena. ${big(BOSS_NAME[this.bossKind])} goes back to it and gathers ${BOSS_HIS[this.bossKind]} strength while you're away.`); }
        if (away) c.hp = Math.min(c.max, c.hp + c.max * FLEE.heal * dt);
        else { this.helperT -= dt; if (this.helperT <= 0 || (!this.waves && c.hp <= (c.T.helpAt ?? -1))) this.help(c); }
      }
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
