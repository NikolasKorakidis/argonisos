// Gameplay glue: equipping from the hotbar, strikes and what they hit, E to interact, picking up and dropping, durability.
import * as THREE from 'three';
import { ITEMS } from './items.js';
import { Pickups, KINDS } from '../world/pickups.js';
import { Harvest } from './harvest.js';
import { Crafting } from './crafting.js';
import { Build } from '../build/build.js';
import { Creatures } from '../creatures/creatures.js';
import { Combat } from './combat.js';
import { WEATHER, flashSky } from '../world/weather.js';
import { heldModel, isLeftHanded } from '../player/held.js';
import { updateFx } from '../render/fx.js';
import { camera } from '../render/core.js';
import { input, hit } from '../input.js';

export function installGame(g) {
  const { player, inv, hud } = g;
  g.pickups = new Pickups(g.scene);
  g.harvest = new Harvest(g);
  g.build = new Build(g);
  g.crafting = new Crafting(g);
  g.creatures = new Creatures(g);
  g.combat = new Combat(g);
  player.floorAt = (p) => g.build.floorAt(p.x, p.z, p.y);
  player.camBlock = (a, b) => g.build.rayBlock(a, b);
  g.underRoof = (p) => g.build.underRoof(p);
  g.nearFire = (p) => !!g.build.nearFire(p);
  g.weatherRain = () => WEATHER.k.rain;
  g.flashSky = flashSky;
  g.nearMsg = (pos, m) => { if (pos.distanceTo(player.pos) < 25) hud.toast(m); };
  g.sound ||= () => {};

  // ---- giving items: into the pack, the rest at your feet
  g.give = (id, n = 1, extra) => {
    const left = inv.add(id, n, extra); if (n - left > 0) hud.pickup(id, n - left);
    if (left > 0) { g.pickups.drop(id, left, player.pos.x + (Math.random() - 0.5), player.pos.z + (Math.random() - 0.5), extra); hud.toast('Your pack is full'); }
  };
  hud.onDrop = (i) => { const s = inv.slots[i]; if (!s) return; if (s.worn) unequip(i); const d = inv.drop(i); const f = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)); g.pickups.drop(d.id, d.n, player.pos.x + f.x * 1.2, player.pos.z + f.z * 1.2, d.dur ? { dur: d.dur } : undefined); };

  // ---- equipment: one item in the right hand, a shield or bow in the left; armour in its own slots
  const worn = (slot) => inv.slots.findIndex((s) => s?.worn === slot);
  g.held = () => { const i = worn('hand'); return i >= 0 ? ITEMS[inv.slots[i].id] : null; };
  g.bow = () => { const i = worn('left'); return i >= 0 && ITEMS[inv.slots[i].id].bow ? ITEMS[inv.slots[i].id] : null; };
  g.heldSlot = () => { const i = worn('hand'); return i >= 0 ? inv.slots[i] : null; };
  g.equippedTool = (tool) => g.held()?.tool === tool;
  g.warmArmor = () => inv.slots.some((s) => s?.worn && ITEMS[s.id].warm);
  g.armor = () => { let a = 0; const sets = {}; for (const s of inv.slots) if (s?.worn && ITEMS[s.id].armor) { a += ITEMS[s.id].armor; const st = ITEMS[s.id].set; sets[st] = (sets[st] || 0) + 1; } if (Object.values(sets).some((n) => n >= 3)) a *= 1.05; return Math.round(a); };
  hud.armor = g.armor;
  function refreshLook() {
    const r = worn('hand'), l = worn('left');
    const rid = r >= 0 ? inv.slots[r].id : null, lid = l >= 0 ? inv.slots[l].id : null;
    if (rid !== g._rid) { g._rid = rid; player.hero.holdRight(null); if (rid && !isLeftHanded(rid)) heldModel(rid).then((m) => { if (g._rid === rid) { player.hero.holdRight(m); g.torchLight = m?.userData.light || null; } }); else g.torchLight = null; }
    if (lid !== g._lid) { g._lid = lid; player.hero.holdLeft(null); if (lid) heldModel(lid).then((m) => { if (g._lid === lid) player.hero.holdLeft(m); }); }
    let sp = 0; for (const s of inv.slots) if (s?.worn && ITEMS[s.id].speed) sp += ITEMS[s.id].speed; player.speedMod = sp;
    player.overweight = inv.overweight;
    hud.dirtyInv = true;
  }
  function unequip(i) { const s = inv.slots[i]; if (!s) return; delete s.worn; refreshLook(); }
  g.equip = (i) => {
    const s = inv.slots[i]; if (!s) return; const d = ITEMS[s.id];
    if (s.worn) { player.equip = { kind: 'disarm', t: 0 }; unequip(i); g.sound('sheathe'); return; }
    if (d.type === 'armor') { const o = inv.slots.findIndex((x) => x?.worn === d.slot); if (o >= 0) delete inv.slots[o].worn; s.worn = d.slot; refreshLook(); hud.toast(`Wearing ${d.name.toLowerCase()}`); return; }
    const slot = d.type === 'shield' || d.bow ? 'left' : 'hand';
    const clear = (w) => { const o = worn(w); if (o >= 0) delete inv.slots[o].worn; };
    clear(slot);
    if (d.bow || d.hands === 2) { clear('hand'); clear('left'); }                                   // bows and spears take both hands
    if (slot === 'left') { const o = worn('hand'); if (o >= 0 && ITEMS[inv.slots[o].id].hands === 2) clear('hand'); }
    if (slot === 'hand') { const o = worn('left'); if (o >= 0 && ITEMS[inv.slots[o].id].bow) clear('left'); }
    s.worn = slot;
    player.equip = { kind: 'equip', t: 0 }; g.sound('draw');
    refreshLook();
  };
  inv.onChange = ((base) => () => { base?.(); for (const s of inv.slots) if (s?.worn && !s.n) delete s.worn; refreshLook(); })(inv.onChange);

  // ---- strikes
  player.onStrike = () => {
    const slot = g.heldSlot(), item = slot ? ITEMS[slot.id] : null;
    const hitSomething = g.combat.strike(item) || g.harvest.strike(item) || false;
    if (hitSomething && slot?.dur !== undefined) { slot.dur -= 1; if (slot.dur <= 0) { hud.toast(`Your ${ITEMS[slot.id].name.toLowerCase()} broke`); inv.slots[inv.slots.indexOf(slot)] = null; } hud.dirtyInv = true; refreshLook(); }
    if (!item) player.stats.train('unarmed', 12.5);
  };

  // ---- E: the nearest thing you can use
  function target() {
    const f = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)), front = player.pos.clone().addScaledVector(f, 0.9);
    const p = g.pickups.nearest(front, 1.9);
    if (p) { const id = p.kind === 'drop' ? p.item : KINDS[p.kind].item, n = p.kind === 'drop' ? p.n : 1; return { kind: 'pickup', p, label: `Pick up ${ITEMS[id].name}${n > 1 ? ` ×${n}` : ''}` }; }
    const s = g.build?.interactable?.(player.pos, f); if (s) return s;
    const t = g.harvest.fruitTree(); if (t) return { kind: 'fruit', t, label: t.ready ? `Pick ${t.fruit[0]}s` : 'Picked clean' };
    return null;
  }
  g.interact = () => {
    const t = target(); if (!t) return;
    if (t.kind === 'pickup') { const [id, n, extra] = g.pickups.take(t.p); g.give(id, n, extra?.dur ? { dur: extra.dur } : undefined); g.sound('pick'); return; }
    if (t.kind === 'fruit') { g.harvest.pick(t.t); return; }
    t.use?.();
  };

  // ---- per frame
  g.update = (dt) => {
    if (hit('KeyC') && !(hud.open && g.crafting.tab === 'craft')) { if (!hud.open) hud.toggle(true); g.crafting.open('craft'); }
    if (input.uiOpen || player.dead) { hud.prompt(null); g.build.update(dt); g.creatures.update(dt); g.combat.update(dt); return; }
    const t = target();
    if (!g.build.active && !(g.equippedTool('build') && g.build.aimPiece)) hud.prompt(t ? 'E' : null, t?.label, t?.sub);
    if (hit('KeyE')) g.interact();
    // attack / use with LMB (the hammer and the bow have their own handlers)
    for (const b of input.clicks) {
      if (b !== 0) continue;
      const d = g.held();
      if (d?.tool === 'build' && g.build?.active) continue;
      if (g.bow()) { g.combat?.bowClick?.(); continue; }
      player.strike(d ? 'tool' : 'punch', 5);
    }
    if (input.lmb && !input.clicks.length && player.swing <= 0 && !g.bow() && !(g.held()?.tool === 'build' && g.build?.active)) player.strike(g.held() ? 'tool' : 'punch', 5);   // hold to keep swinging
    g.pickups.update(player.pos, g.S.day);
    g.harvest.update(dt);
    g.build.update(dt);
    g.creatures.update(dt);
    g.combat.update(dt);
    // loot from kills is picked up as you walk over it
    for (const d of [...g.pickups.drops]) if (d.extra?.auto && Math.hypot(d.x - player.pos.x, d.z - player.pos.z) < 1.8 && Math.abs(d.y - player.pos.y) < 2) { g.pickups.take(d); g.give(d.item, d.n); g.sound('pick'); }
    if (g.torchLight) g.torchLight.intensity = 5 + Math.sin(performance.now() * 0.02) * 0.6 + Math.random() * 0.4;
  };
  g.lateUpdate = (dt) => { updateFx(dt, camera); };
  hud.onToggle = (on) => { if (on) g.crafting.open(); };
  refreshLook();
}
