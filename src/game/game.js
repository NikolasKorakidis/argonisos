// Gameplay glue: equipping from the hotbar, strikes and what they hit, E to interact, picking up and dropping, durability.
import * as THREE from 'three';
import { ITEMS, SET_BONUS } from './items.js';
import { Pickups, KINDS } from '../world/pickups.js';
import { Harvest } from './harvest.js';
import { Crafting } from './crafting.js';
import { Build } from '../build/build.js';
import { Creatures } from '../creatures/creatures.js';
import { Combat } from './combat.js';
import { Acts } from './acts.js';
import { Structures } from '../world/structures.js';
import { Trial } from './trial.js';
import { SITES } from '../world/sites.js';
import { WorldMap } from '../ui/map.js';
import { Owl } from './owl.js';
import { Guide } from './guide.js';
import { BuildMenu } from '../ui/buildmenu.js';
import { Occlusion } from '../render/occlusion.js';
import { save, load, Graves, SAVE_LOST } from './save.js';
import { sound, updateAmbience, listen, fires, waters } from '../audio/sound.js';
import { riverSounds } from '../world/river.js';
import { WIND } from '../world/wind.js';
import { LIGHT } from '../world/sky.js';
import { WEATHER, flashSky } from '../world/weather.js';
import { heightAt, biomeWeights, isRock } from '../world/gen.js';
import { treeDensity } from '../world/flora.js';
import { groundAt } from '../world/groundcut.js';
import { heldModel, isLeftHanded } from '../player/held.js';
import { strikeKind } from '../player/hero.js';
import { updateFx } from '../render/fx.js';
import { askLight, updateLights } from '../render/lights.js';
import { camera } from '../render/core.js';
import { input, hit } from '../input.js';

export function installGame(g) {
  const { player, inv, hud } = g;
  g.pickups = new Pickups(g.scene, g.pool);
  g.harvest = new Harvest(g);
  g.build = new Build(g);
  g.crafting = new Crafting(g);
  g.SITES = SITES;
  g.structures = new Structures(g);
  g.creatures = new Creatures(g);
  g.trial = new Trial(g);
  g.map = new WorldMap(g);
  g.owl = new Owl(g);
  g.guide = new Guide(g);
  g.buildMenu = new BuildMenu(g);
  g.occlusion = new Occlusion(g);
  g.ITEMS = ITEMS; g.graves = new Graves(g); { const od = g.onDeath; g.onDeath = () => { g.graves.fall(); g.sound('death', { voice: !womanVoice() }); od?.(); }; }
  g.combat = new Combat(g);
  g.acts = new Acts(g);
  g.pickups.landAt = (x, z, fy) => { const gy = Math.max(groundAt(x, z), -1.2); return fy === undefined ? gy : Math.max(gy, g.build.floorAt(x, z, fy + 0.3), g.structures.floorAt(x, z, fy + 0.3)); };   // (on what you built, or on the rock over a cave, before the ground below)
  player.floorAt = (p) => Math.max(g.build.floorAt(p.x, p.z, p.y), g.structures.floorAt(p.x, p.z, p.y));
  player.camBlock = (a, b) => { const p = g.build.rayBlock(a, b), q = g.structures.rayBlock(a, b); return p === null ? q : q === null ? p : Math.min(p, q); };   // (walls you built, and the rock of a cave you're in)
  g.underRoof = (p) => g.build.underRoof(p) || g.structures.underRoof(p);
  g.nearFire = (p) => !!g.build.nearFire(p) || g.structures.nearSacredFire(p);
  g.weatherRain = () => WEATHER.k.rain;
  g.flashSky = flashSky;
  g.nearMsg = (pos, m) => { if (pos.distanceTo(player.pos) < 25) hud.toast(m); };
  g.sound = sound;
  // (the team's hurt and death cries are a man's: a woman hero takes her blows without them, sound.js)
  const womanVoice = () => player.hero.look?.body === 'woman'; g.heroVoice = () => !womanVoice();
  // what the feet come down on, for the footsteps and landings: water (swimming or wading), a building's boards, a site's
  // paving or bare rock (the one slope rule), the sand along the shore (not the marsh), the forest's leaf litter, or the
  // meadows' grass and earth
  const surface = () => { const p = player.pos; if (player.swimming || player.wading > 0.05 || groundAt(p.x, p.z) < 0) return 'water'; if (g.build.floorAt(p.x, p.z, p.y) > p.y - 0.1) return 'wood';
    if (g.structures.floorAt(p.x, p.z, p.y) > p.y - 0.1 || isRock(p.x, p.z)) return 'stone'; const w = biomeWeights(p.x, p.z); return heightAt(p.x, p.z) < 1.6 && w.v < 0.5 ? 'sand' : w.y > 0.5 ? 'leaves' : 'ground'; };
  // footsteps and landings by how near the camera is: as loud as ever zoomed right in (1.8 m), a quarter fully out (11 m)
  player.onStep = (k) => sound(k, k === 'step' || k === 'land' ? surface() : undefined, 1 - 0.75 * Math.min(1, Math.max(0, (player.camDist - 1.8) / 9.2)));

  // ---- giving items: into the pack, the rest at your feet
  g.give = (id, n = 1, extra) => {
    const left = inv.add(id, n, extra); if (n - left > 0) hud.pickup(id, n - left);
    if (left > 0) { g.pickups.drop(id, left, player.pos.x + (Math.random() - 0.5), player.pos.z + (Math.random() - 0.5), extra, player.pos.y); hud.toast('Your pack is full'); }
  };
  // dropping something out of the pack: tossed ahead of you (acts.toss), leaving the pack as it leaves your hand
  hud.onDrop = (i) => { const s = inv.slots[i]; if (!s) return; g.acts.toss((far) => {
    const j = inv.slots.indexOf(s); if (j < 0) return;   // (gone meanwhile: into a chest, a grave)
    if (s.worn) unequip(j); const d = inv.drop(j), f = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    g.pickups.drop(d.id, d.n, player.pos.x + f.x * far, player.pos.z + f.z * far, d.dur ? { dur: d.dur } : undefined, player.pos.y); }); };

  // ---- equipment: one item in the right hand, a shield or bow in the left; armour in its own slots
  const worn = (slot) => inv.slots.findIndex((s) => s?.worn === slot);
  g.held = () => { const i = worn('hand'); return i >= 0 ? ITEMS[inv.slots[i].id] : null; };
  g.bow = () => { const i = worn('left'); return i >= 0 && ITEMS[inv.slots[i].id].bow ? ITEMS[inv.slots[i].id] : null; };
  g.heldSlot = () => { const i = worn('hand'); return i >= 0 ? inv.slots[i] : null; };
  g.equippedTool = (tool) => g.held()?.tool === tool;
  g.torchLit = () => g.equippedTool('light') && !player.swimming && !player.dead;   // (a torch in your hand burns, out of the water: a fire the creatures that fear fire keep clear of, creatures.js)
  g.warmArmor = () => inv.slots.some((s) => s?.worn && ITEMS[s.id].warm);
  g.resists = (kind) => inv.slots.some((s) => s?.worn && ITEMS[s.id].resist?.includes(kind));   // (combat.js: a blow of that kind halved)
  g.armor = () => { let a = 0; const sets = {}; for (const s of inv.slots) if (s?.worn && ITEMS[s.id].armor) { a += ITEMS[s.id].armor; const st = ITEMS[s.id].set; sets[st] = (sets[st] || 0) + 1; } if (Object.values(sets).some((n) => n >= 3)) a *= SET_BONUS; return Math.round(a); };
  hud.armor = g.armor;
  function refreshLook() {
    const r = worn('hand'), l = worn('left');
    const rid = r >= 0 ? inv.slots[r].id : null, lid = l >= 0 ? inv.slots[l].id : null;
    if (rid !== g._rid) { g._rid = rid; player.hero.holdRight(null); if (rid && !isLeftHanded(rid)) heldModel(rid).then((m) => { if (g._rid === rid) { player.hero.holdRight(m); g.torchLight = m?.userData.light || null; } }); else g.torchLight = null; }
    if (lid !== g._lid) { g._lid = lid; player.hero.holdLeft(null); if (lid) heldModel(lid).then((m) => { if (g._lid === lid) player.hero.holdLeft(m); }); }
    const id = (slot) => { const i = worn(slot); return i >= 0 ? inv.slots[i].id : null; };
    player.hero.wear({ head: id('head'), body: id('body'), legs: id('legs'), cape: id('cape') });
    let sp = 0; for (const s of inv.slots) if (s?.worn && ITEMS[s.id].speed) sp += ITEMS[s.id].speed; player.speedMod = sp;
    let rg = 0; for (const s of inv.slots) if (s?.worn && ITEMS[s.id].regen) rg += ITEMS[s.id].regen; player.stats.gearRegen = rg;   // (stats.js healthRegenK)
    player.overweight = inv.overweight;
    hud.dirtyInv = true;
  }
  function unequip(i) { const s = inv.slots[i]; if (!s) return; delete s.worn; refreshLook(); }
  g.equip = (i) => {
    const s = inv.slots[i]; if (!s) return; const d = ITEMS[s.id];
    if (!s.worn && d.dur && s.dur <= 0 && d.type !== 'armor') { hud.toast(`Your ${d.name.toLowerCase()} is broken: mend it at a workbench`); return; }   // (broken tools stay in the pack)
    if (s.worn) { player.equip = { kind: 'disarm', t: 0 }; unequip(i); if (d.type !== 'armor') g.sound('sheathe'); return; }
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

  // ---- strikes. A swing's stamina goes by the weapon's heft (SWING): a dagger or a fist is quick and cheap, an axe or a
  // club dearer, a spear's two-handed thrust the dearest; a tool's swing costs what it always has
  const SWING = { unarmed: 4, dagger: 4, axe: 6, mace: 6, spear: 7 }, swingCost = (d) => (d?.type === 'weapon' || !d ? SWING[d?.skill ?? 'unarmed'] : null) ?? 5;
  player.onStrike = () => {
    const slot = g.heldSlot(), item = slot ? ITEMS[slot.id] : null;
    const hitSomething = g.combat.strike(item) || g.harvest.strike(item) || false;
    // (a wrong tool's clink wears nothing; at naught a tool breaks but stays in the pack, put away until it's mended at a
    // workbench, Valheim's way: review, Nov, it used to be lost for good)
    if (hitSomething && hitSomething !== 'clink' && slot?.dur !== undefined) {
      const name = ITEMS[slot.id].name.toLowerCase(), was = slot.dur; slot.dur = Math.max(0, slot.dur - 1);
      if (slot.dur <= 0) { hud.toast(`Your ${name} broke: mend it at a workbench`); delete slot.worn; player.equip = { kind: 'disarm', t: 0 }; } else if (was > ITEMS[slot.id].dur * 0.1 && slot.dur <= ITEMS[slot.id].dur * 0.1) hud.toast(`Your ${name} is wearing out`);
      hud.dirtyInv = true; refreshLook();
    }
    if (!item) player.stats.train('unarmed', 12.5);
  };

  // ---- E: the nearest thing you can use
  function target() {
    const f = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)), front = player.pos.clone().addScaledVector(f, 0.9);
    const owl = g.owl.interactable(player.pos); if (owl && g.owl.faced()) return owl;
    const p = g.pickups.nearest(front, 1.9);
    // (a drop of something this version no longer knows, from an old save, is named by its id rather than stopping the frame)
    if (p) { const K = KINDS[p.kind], id = p.kind === 'drop' ? p.item : K.item, n = p.kind === 'drop' ? p.n : 1, name = ITEMS[id]?.name ?? String(id); return { kind: 'pickup', p, label: `${K.verb || 'Pick up'} ${K.label || name}${n > 1 ? ` ×${n}` : ''}`, sub: K.label ? `+${K.n[0]} ${name.toLowerCase()}` : '' }; }
    const ow = g.owl.interactable(player.pos) || g.graves.interactable(player.pos); if (ow) return ow;
    const tr = g.trial.interactable(player.pos); if (tr) return tr;
    const s = g.build?.interactable?.(player.pos, f); if (s) return s;
    const tb = g.harvest.tomatoBush(); if (tb) return { label: tb.ready ? 'Pick tomatoes' : 'No ripe tomatoes', sub: 'Tomato bush', use: () => g.harvest.pickTomatoes(tb) };
    const t = g.harvest.fruitTree(); if (t) return { kind: 'fruit', t, label: t.ready ? `Pick ${t.fruit[0]}s` : 'Picked clean' };
    return null;
  }
  g.interact = () => {
    const t = target(); if (!t) return;
    if (t.kind === 'pickup') { if (t.p.kind !== 'drop') player.stats.learn('gathering'); const [id, n, extra] = g.pickups.take(t.p); g.give(id, n, extra?.dur ? { dur: extra.dur } : undefined); g.sound('pick'); g.acts.reach(); return; }   // (the first thing picked up off the land finds Gathering)
    if (t.kind === 'fruit') { g.harvest.pick(t.t); return; }
    t.use?.();
  };

  // ---- per frame
  const _bw = { p: 0, y: 0, v: 0, r: 0 }, _look = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), torchAt = new THREE.Vector3();
  // walls round you: of eight ways out at head height, six or more meet a wall within 6 m (what you built, or a site's)
  const walled = (P) => { let n = 0; _a.set(P.x, P.y + 1.5, P.z); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; _b.set(P.x + Math.cos(a) * 6, P.y + 1.5, P.z + Math.sin(a) * 6); if (g.build.rayBlock(_a, _b) !== null || g.structures.rayBlock?.(_a, _b) != null) n++; } return n >= 6; };
  // reaching the top of Olympos
  const olympos = (P) => { const pk = SITES.peak; if (!pk) return; const d = Math.hypot(P.x - pk.x, P.z - pk.z);
    if (d < 40 && P.y > pk.y - 25 && !g.atPeak) { g.atPeak = true; hud.region('Olympos', 'The seat of Zeus. All Argonisos lies below you'); sound('reveal'); } else if (d > 140) g.atPeak = false; };
  g.update = (dt) => {
    g.altUsed = null; g.acts.update(dt);
    g.owl.update(dt); g.guide.update(dt); g.buildMenu.update();
    olympos(player.pos);
    if (g.owl.open) { hud.prompt(null); return; }
    if (hit('KeyM') || (hit('Escape') && g.map.open)) g.map.toggle();
    g.map.update(dt);
    { const f = g.build.nearFire(player.pos, 9), fd = f ? Math.max(0, 1 - f.pos.distanceTo(player.pos) / 9) : g.structures.nearSacredFire(player.pos) ? 0.5 : 0;
      // where you are, sampled twice a second: the biome, how much sea is around you, and how wooded it is round you and
      // just where you stand (the same density the trees are laid out by: the meadows' woods count as much as the forest's)
      if (!(g.ambT > 0)) { g.ambT = 0.5; const P = player.pos, bw = biomeWeights(P.x, P.z), wood = (x, z) => Math.min(1, treeDensity(x, z, heightAt(x, z), biomeWeights(x, z, _bw)) * 36);
        let sea = 0, trees = 0; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; if (heightAt(P.x + Math.cos(a) * 45, P.z + Math.sin(a) * 45) < -0.5) sea++; trees += wood(P.x + Math.cos(a) * 18, P.z + Math.sin(a) * 18); }
        const deep = wood(P.x, P.z); g.amb = { forest: Math.max(bw.y, (trees / 8 + deep) / 2), deep, marsh: bw.v, sea: sea / 8, pedias: bw.p, yleos: bw.y, walled: player.stats.has('underRoof') && walled(P) };
        // the fires burning near you, the nearest few, each heard where it stands (sound.js fires): your campfires and
        // torches, and the sites' own (the temple's, the Giants' caves')
        const near = []; for (const f of g.build.placed) if ((f.def.fire || f.def.torch) && f.state.lit && f.pos.distanceTo(P) < 25) near.push({ id: f.uid, x: f.pos.x, y: f.pos.y + 0.4, z: f.pos.z, k: f.def.fire ? 0.6 + Math.min(1, f.state.fuel / 3) * 0.4 : 0.3, d: f.pos.distanceTo(P) });
        (g.structures.lights || []).forEach((l, i) => { const d = l.distanceTo(P); if (d < 25) near.push({ id: 'site' + i, x: l.x, y: l.y, z: l.z, k: 1, d }); });
        g.fires = near.sort((a, b) => a.d - b.d).slice(0, 3); } g.ambT -= dt;
      // (under a roof you hear the rain drum on it; with walls round you as well, you're inside: the world comes muffled)
      const roof = player.stats.has('underRoof'), inside = (roof && g.amb.walled) || !!g.structures.inCave?.(player.pos);
      listen(camera.position, camera.getWorldDirection(_look)); fires(g.fires || []); waters(riverSounds(camera.position));   // (the river's water: river.js)
      updateAmbience(dt, { wind: Math.min(1, Math.max(0, (WIND.speed - 2.3) / 8)), gust: WIND.gust, windDir: { x: WIND.dir.x, z: WIND.dir.y }, rain: WEATHER.k.rain, night: LIGHT.night, dusk: LIGHT.dusk, fire: fd, roof: roof ? 1 : 0, inside: inside ? 1 : 0, ...g.amb }); }
    if (hit('KeyC') && !g.map.open && !g.buildMenu.open) hud.toggle(!hud.open);   // C opens and closes the pack and crafting, on whichever tab you left it
    if (input.uiOpen || player.dead) { hud.prompt(null); g.build.update(dt); g.creatures.update(dt); g.combat.update(dt); g.structures.update(dt); g.trial.stage(dt); return; }   // (a boss's coming goes on behind a menu)
    const t = target();
    if (!g.build.active && !(g.equippedTool('build') && g.build.aimPiece)) hud.prompt(t ? 'E' : null, t?.label, t?.sub, t?.alt);
    if (hit('KeyE')) g.interact();
    if (t?.alt && hit(`Key${t.alt.key}`)) { t.alt.use(); g.altUsed = t.alt.key; }   // e.g. F: put out the fire (and not the boss power)
    // attack / use with LMB (the hammer and the bow have their own handlers)
    for (const b of input.clicks) {
      if (b !== 0) continue;
      const d = g.held();
      if (d?.tool === 'build' && g.build?.active) continue;
      if (g.bow()) { g.combat?.bowClick?.(); continue; }
      player.strike(strikeKind(d), swingCost(d));
    }
    if (input.lmb && !input.clicks.length && player.swing <= 0 && !g.bow() && !(g.held()?.tool === 'build' && g.build?.active)) player.strike(strikeKind(g.held()), swingCost(g.held()));   // hold to keep swinging
    g.pickups.update(player.pos, g.S.day);
    g.harvest.update(dt);
    g.build.update(dt);
    g.creatures.update(dt);
    g.combat.update(dt);
    g.structures.update(dt);
    g.graves.update(dt);
    g.trial.update(dt);
    // loot from kills is picked up as you walk over it
    for (const d of [...g.pickups.drops]) if (d.extra?.auto && Math.hypot(d.x - player.pos.x, d.z - player.pos.z) < 1.8 && Math.abs(d.y - player.pos.y) < 2) { g.pickups.take(d); g.give(d.item, d.n); g.sound('pick'); }
    if (g.torchLight?.parent) askLight(g.torchLight.getWorldPosition(torchAt), 7 + Math.sin(performance.now() * 0.02) * 0.6 + Math.random() * 0.4, 14, undefined, undefined, false);   // (it moves: never the fire's shadow caster, render/lights.js)
  };
  g.lateUpdate = (dt) => { updateFx(dt, camera); updateLights(); g.occlusion.update(dt); };
  hud.onToggle = (on) => { if (on) g.crafting.open(); };
  g.loaded = load(g);
  // (a save that couldn't be read: load kept a copy of it beside the save and starts the page again on a new trial,
  // saving nothing meanwhile; the title screen and a toast say so, save.js)
  if (g.loaded === 'lost') { g.loaded = false; g.save = () => false; location.reload(); }
  else {
    if (g.saveLost) setTimeout(() => hud.toast(SAVE_LOST), 3000);
    // (a save that fails, the browser's storage full, says so on the HUD, once in a while rather than every minute; a
    // death saves at once, the grave and where you'll wake, so closing the page on the death screen keeps the grave)
    let warnedT = -1e9;
    g.save = () => { if (g.saveBlocked) return false; const ok = save(g); if (!ok && performance.now() - warnedT > 300000) { warnedT = performance.now(); hud.toast('<b>Could not save</b>: the browser\'s storage for this page is full or blocked'); } return ok; };
    const od = g.onDeath; g.onDeath = () => { od?.(); g.save(); };
    setInterval(() => g.save(), 60000); addEventListener('beforeunload', () => g.save());
  }
  refreshLook();
}
