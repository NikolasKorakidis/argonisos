// The dev menu (pause menu → Dev menu): for playing around and testing. Fly anywhere fast, never die, craft and build
// for free, spawn any item or creature, uncover the map, unlock every recipe, jump to any place, set the time and the
// weather, call the bosses, lift the storm over Valtos. The toggles are remembered between sessions.
import { ITEMS } from '../game/items.js';
import { TYPES } from '../creatures/creatures.js';
import { SITES } from '../world/sites.js';
import { setWeather, snapWeather, WEATHER } from '../world/weather.js';
import { STORM_WALL } from '../world/stormwall.js';
import { icon } from './icons.js';

const KEY = 'argonisos.dev.v1';
const DEV = { god: false, free: false, peaceful: false, valtos: false, flySpeed: 40 };
try { Object.assign(DEV, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* defaults */ }
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(DEV)); } catch { /* private mode */ } };

const KITS = {
  tools: [['hammer', 1], ['crudeAxe', 1], ['pickaxe', 1], ['crudeClub', 1], ['crudeBow', 1], ['crudeArrow', 100], ['crudeShield', 1], ['torch', 1], ['hoe', 1]],
  best: [['lightstoneAxe', 1], ['lightstoneSpear', 1], ['lightstoneDagger', 1], ['cretanBow', 1], ['crudeArrow', 100], ['crudeTowerShield', 1], ['cretanHelmet', 1], ['cretanArmor', 1], ['cretanLegs', 1], ['cretanCape', 1]],
  mats: [['wood', 50], ['stone', 50], ['rope', 50], ['leather', 50], ['resin', 50], ['feather', 50], ['lightstone', 50], ['deerHide', 50], ['foxHide', 50]],
  food: [['cookedMeat', 20], ['cookedFish', 20], ['olive', 30], ['pomegranate', 30], ['acorn', 30]],
  tribute: [['deerHide', 5], ['olive', 10], ['dryadHeart', 3], ['pomegranate', 10]],
};
const PLACES = () => [['Start', { x: 6, z: 4 }], ['Ancient Temple', SITES.temple], ['Abandoned House', SITES.house], ['The Labyrinth', SITES.labyrinth], ["Chimera's Shrine", SITES.chimera],
  ...SITES.olives.map((s, i) => [`Olive ${i + 1}`, s]), ...SITES.caves.map((s, i) => [`Cave ${i + 1}`, s]), ['Valtos edge', { x: -330, z: 520 }]];
const WEATHERS = [['', 'Auto'], ['clear', 'Clear'], ['cloudy', 'Cloudy'], ['lightRain', 'Rain'], ['heavyRain', 'Downpour'], ['thunder', 'Storm'], ['fog', 'Fog']];

export function devMenu(g) {
  const el = document.createElement('div'); el.id = 'devPanel'; el.className = 'hidden';
  const items = Object.values(ITEMS).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  el.innerHTML = `<div class="pnl"><h2>Dev menu</h2><button class="xbtn" id="dvBack">${icon('close')}</button><div class="pbody">
    <p class="psub">Movement</p>
    <div class="set"><span>Fly (F9)</span><button class="btn small" data-t="fly"></button></div>
    <div class="set"><span>Fly speed <b id="dvSpd"></b></span><input type="range" id="dvSpeed" min="10" max="400" step="10"></div>
    <div class="set"><span>God mode: no damage, endless stamina</span><button class="btn small" data-t="god"></button></div>
    <p class="psub">Free stuff</p>
    <div class="set"><span>Free crafting and building</span><button class="btn small" data-t="free"></button></div>
    <div class="row">${Object.keys(KITS).map((k) => `<button class="btn small ghost" data-kit="${k}">${{ tools: 'Tool kit', best: 'Best gear', mats: 'Materials ×50', food: 'Food', tribute: 'Both tributes' }[k]}</button>`).join('')}</div>
    <div class="row"><select id="dvItem">${items.map((d) => `<option value="${d.id}">${d.name} (${d.type})</option>`).join('')}</select><button class="btn small" data-give="1">+1</button><button class="btn small" data-give="10">+10</button><button class="btn small" data-give="stack">Stack</button></div>
    <div class="row"><button class="btn small ghost" id="dvHeal">Full heal</button><button class="btn small ghost" id="dvClear">Empty pack</button></div>
    <p class="psub">Unlocks</p>
    <div class="row"><button class="btn small ghost" id="dvMap">Reveal the whole map</button><button class="btn small ghost" id="dvRecipes">Unlock all recipes and tiers</button><button class="btn small ghost" id="dvClues">Reveal both boss lairs</button></div>
    <div class="set"><span>Lift Zeus's storm over Valtos</span><button class="btn small" data-t="valtos"></button></div>
    <p class="psub">Teleport</p>
    <div class="row wrap">${PLACES().map(([n], i) => `<button class="btn small ghost" data-tp="${i}">${n}</button>`).join('')}</div>
    <p class="psub">Time and weather</p>
    <div class="set"><span>Time of day <b id="dvClock"></b></span><input type="range" id="dvTime" min="0" max="1000"></div>
    <div class="set"><span>Time speed</span><div class="seg" id="dvTs">${[1, 10, 60, 300].map((v) => `<button data-v="${v}">×${v}</button>`).join('')}</div></div>
    <div class="set"><span>Weather</span><div class="seg" id="dvW">${WEATHERS.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div></div>
    <p class="psub">Creatures</p>
    <div class="set"><span>Peaceful: nothing spawns</span><button class="btn small" data-t="peaceful"></button></div>
    <div class="row"><select id="dvMob">${Object.entries(TYPES).filter(([, t]) => !t.boss).map(([k, t]) => `<option value="${k}">${t.name}</option>`).join('')}</select><select id="dvLvl"><option value="0">Level 0</option><option value="1">★</option><option value="2">★★</option></select><button class="btn small" id="dvSpawn">Spawn in front</button><button class="btn small ghost" id="dvKill">Kill everything near</button></div>
    <div class="row"><button class="btn small" data-boss="minotaur">Fight the Minotaur</button><button class="btn small" data-boss="chimera">Fight the Chimera</button></div>
    <p class="hint">Fighting a boss takes you to its altar and lays the tribute for you.</p>
  </div></div>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s), P = g.player;
  const sync = () => {
    el.querySelectorAll('[data-t]').forEach((b) => { const k = b.dataset.t, on = k === 'fly' ? g.S.fly : DEV[k]; b.textContent = on ? 'On' : 'Off'; b.classList.toggle('ghost', !on); });
    $('#dvSpeed').value = DEV.flySpeed; $('#dvSpd').textContent = `${DEV.flySpeed} m/s`;
    $('#dvTime').value = Math.round(g.S.time * 1000); $('#dvClock').textContent = document.getElementById('clock')?.textContent.split('·')[1] || '';
    el.querySelectorAll('#dvTs button').forEach((b) => b.classList.toggle('on', +b.dataset.v === g.S.timeScale));
    el.querySelectorAll('#dvW button').forEach((b) => b.classList.toggle('on', b.dataset.v === (WEATHER.forced || '')));
  };
  // apply the remembered toggles
  const apply = () => { P.stats.god = DEV.god; g.S.freeBuild = DEV.free; g.S.peaceful = DEV.peaceful; STORM_WALL.open = DEV.valtos; g.S.flySpeed = DEV.flySpeed; };
  apply();
  const toast = (m) => g.hud.toast(m);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.t) { const k = b.dataset.t; if (k === 'fly') { g.pause(false); g.setFly(!g.S.fly); close(); return; } DEV[k] = !DEV[k]; store(); apply(); g.crafting?.draw(); toast(`${b.parentElement.querySelector('span').textContent}: <b>${DEV[k] ? 'on' : 'off'}</b>`); }
    if (b.dataset.kit) { for (const [id, n] of KITS[b.dataset.kit]) g.give(id, n); }
    if (b.dataset.give) { const id = $('#dvItem').value, n = b.dataset.give === 'stack' ? ITEMS[id].stack : +b.dataset.give; g.give(id, n); }
    if (b.dataset.tp) { const [name, s] = PLACES()[+b.dataset.tp]; close(); g.pause(false); teleport(s.x + 4, s.z + 10); toast(`Teleported to <b>${name}</b>`); }
    if (b.dataset.boss) { fightBoss(b.dataset.boss); return; }
    sync();
  });
  $('#dvSpeed').oninput = (e) => { DEV.flySpeed = +e.target.value; store(); apply(); sync(); };
  $('#dvTime').oninput = (e) => { g.S.time = e.target.value / 1000; sync(); };
  $('#dvTs').onclick = (e) => { const b = e.target.closest('button'); if (b) { g.S.timeScale = +b.dataset.v; sync(); } };
  $('#dvW').onclick = (e) => { const b = e.target.closest('button'); if (b) { setWeather(b.dataset.v || null); snapWeather(); sync(); } };
  $('#dvHeal').onclick = () => { P.stats.health = P.stats.maxHealth; P.stats.stamina = P.stats.maxStamina; for (const c of ['wet', 'cold', 'stunned', 'poisoned']) P.stats.remove(c); toast('Healed'); };
  $('#dvClear').onclick = () => { if (!confirm('Throw away everything in your pack?')) return; g.inv.slots.fill(null); g.inv.onChange?.(); };
  $('#dvMap').onclick = () => { const m = g.map; m.fctx.clearRect(0, 0, m.fog.width, m.fog.height); for (const s of m.sites()) m.know(s); toast('The whole island is on your map'); };
  $('#dvRecipes').onclick = () => { for (const r of g.crafting.list()) g.crafting.known.add(r.key); for (const id of Object.keys(ITEMS)) g.inv.seen.add(id); g.S.tier = 2; g.crafting.draw(); toast('Every recipe and tier unlocked'); };
  $('#dvClues').onclick = () => { for (const k of ['labyrinth', 'chimera']) { g.trial.st.revealed[k] = true; g.map.reveal(SITES[k]); } toast('The Labyrinth and the Chimera\'s Shrine are on your map'); };
  $('#dvSpawn').onclick = () => { const k = $('#dvMob').value, f = 6; const c = g.creatures.spawn(k, P.pos.x + Math.sin(P.yaw) * f, P.pos.z + Math.cos(P.yaw) * f, { level: +$('#dvLvl').value }); c.yaw = P.yaw + Math.PI; toast(`Spawned a ${TYPES[k].name.toLowerCase()}`); };
  $('#dvKill').onclick = () => { let n = 0; for (const c of g.creatures.list) if (!c.dead && c.pos.distanceTo(P.pos) < 80) { g.creatures.hurt(c, [[1e6, 'force']], null); n++; } toast(`${n} creatures struck down`); };
  $('#dvBack').onclick = () => { close(); };
  function teleport(x, z) { if (g.S.fly) g.setFly(false); P.spawn(x, z); P.camYaw = Math.atan2(4, 10); P.yaw = P.camYaw + Math.PI; snapWeather(); }
  function fightBoss(boss) {
    const u = g.structures.uses.find((v) => v.kind === 'summon' && v.boss === boss); if (!u) return;
    if (g.trial.boss) { toast('A boss fight is already on'); return; }
    g.trial.st.down[boss] = false; g.trial.st.revealed[boss === 'minotaur' ? 'labyrinth' : 'chimera'] = true;
    for (const [id, n] of boss === 'minotaur' ? [['deerHide', 5], ['olive', 10]] : [['dryadHeart', 3], ['pomegranate', 10]]) g.give(id, n);
    close(); g.pause(false); teleport(u.at.x, u.at.z + 3); setTimeout(() => g.trial.summon(u), 600);
  }
  function close() { el.classList.add('hidden'); document.getElementById('pause')?.classList.toggle('hidden', !g.paused); }
  g.devMenu = { open: () => { sync(); el.classList.remove('hidden'); document.getElementById('pause')?.classList.add('hidden'); }, close, DEV };
}
