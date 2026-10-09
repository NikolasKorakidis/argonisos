// Crafting. A recipe shows up in the menu (C) once you have held any one of its materials; it can be made when you carry
// everything and stand at the right station. Workbench recipes need a workbench close by, and (except rope) a roof over
// it. Some need a tier that a boss's head unlocks. The Build tab lists structures for the hammer (build/pieces.js).
import { ITEMS, RECIPES } from './items.js';
import { icon } from '../ui/icons.js';

const $ = (id) => document.getElementById(id);
const TIER_HINT = ['', 'Offer the Minotaur\'s head to learn this', 'Offer the Chimera\'s head to learn this'];

export class Crafting {
  constructor(g) {
    this.g = g; this.tab = 'craft'; this.selBy = { craft: null, build: null }; this.scrollBy = { craft: 0, build: 0 }; this.known = new Set(); this.fresh = new Set();
    const p = document.createElement('div'); p.className = 'pnl'; p.id = 'craftPanel';
    p.innerHTML = `<h2>Craft</h2><div class="pbody"><div id="craftTabs"><button data-t="craft" class="on">${icon('anvil')} Craft</button><button data-t="build">${icon('hammer')} Build</button></div>
      <div id="craftList"></div><div id="craftDetail"></div></div>`;
    $('invPanel').prepend(p); this.panel = p;
    p.querySelectorAll('#craftTabs button').forEach((b) => (b.onclick = () => { this.tab = b.dataset.t; this.draw(); }));
    $('craftList').addEventListener('scroll', () => { this.scrollBy[this.tab] = $('craftList').scrollTop; });
    $('craftList').addEventListener('click', (e) => { const r = e.target.closest('.rrow'); if (!r) return; this.sel = r.dataset.id; this.fresh.delete(this.sel); this.draw(); });
    $('craftList').addEventListener('dblclick', (e) => { const r = e.target.closest('.rrow'); if (r) this.make(r.dataset.id); });
    $('craftDetail').addEventListener('click', (e) => { if (e.target.closest('#craftGo')) this.make(this.sel); const rb = e.target.closest('[data-repair]'); if (rb) { this.repair(+rb.dataset.repair); this.draw(); } });
    g.inv.onNew = (id) => { this.discover(); g.onFirstItem?.(id); };
    this.discover(true);
  }
  // Find recipes newly revealed by what you've held
  // each tab remembers what was selected and how far down the list you were, so the menu reopens where you left it
  get sel() { return this.selBy[this.tab]; }
  set sel(v) { this.selBy[this.tab] = v; }
  discover(silent) {
    const seen = this.g.inv.seen, list = this.list();
    for (const r of list) {
      if (this.known.has(r.key)) continue;
      if (Object.keys(r.mats).some((m) => seen.has(m)) || !Object.keys(r.mats).length) {
        this.known.add(r.key); if (!silent) { this.fresh.add(r.key); this.g.hud.toast(`New recipe: <b>${r.name}</b> <span class="kbd">C</span>`); }
      }
    }
    if (this.g.hud.open) this.draw();
  }
  list() {
    const out = RECIPES.map((r) => ({ key: r.id + (r.n ? 'x' + r.n : ''), id: r.id, name: ITEMS[r.id].name + (r.n > 1 ? ` ×${r.n}` : ''), icon: ITEMS[r.id].icon, mats: r.mats, at: r.at || null, tier: r.tier || 0, n: r.n || 1, kind: 'item' }));
    for (const p of this.g.build?.pieces || []) out.push({ key: 'b:' + p.id, id: p.id, name: p.name, icon: p.icon, mats: p.mats, at: null, tier: p.tier || 0, n: 1, kind: 'piece', cat: p.cat });
    return out;
  }
  // Why a recipe can't be made right now (null if it can)
  blocker(r) {
    const g = this.g;
    if (g.S.freeBuild) return r.kind === 'piece' && !g.equippedTool?.('build') ? 'Hold the hammer to build' : null;   // dev: everything is free
    if (r.tier > (g.S.tier || 0)) return TIER_HINT[r.tier];
    if (r.kind === 'piece') { if (!g.equippedTool?.('build')) return 'Hold the hammer to build'; }
    if (r.at === 'workbench') {
      const wb = g.build?.nearStation?.('workbench', g.player.pos, 6);
      if (!wb) return 'Needs a workbench nearby';
      if (r.id !== 'rope' && !g.build.underRoof(wb.pos, 1.2)) return 'The workbench needs a roof over it';
    }
    if (!g.inv.has(r.mats)) return 'Missing materials';
    if (r.kind === 'item' && g.inv.room(r.id) < r.n) return 'No room in your pack';
    return null;
  }
  make(key) {
    const r = this.list().find((x) => x.key === key); if (!r) return;
    const why = this.blocker(r); if (why) { this.g.hud.toast(why); return; }
    if (r.kind === 'piece') { this.g.hud.toggle(false); this.g.build.select(r.id); return; }        // building: pick the piece, place it in the world
    if (!this.g.S.freeBuild) this.g.inv.takeMats(r.mats); this.g.inv.add(r.id, r.n); this.g.hud.pickup(r.id, r.n); this.g.sound?.('craft');
    this.g.player.stats.train('gathering', 0);
    this.draw();
  }
  open(tab) { if (tab) this.tab = tab; this.discover(true); this.draw(); }
  // ---- Repair at the workbench. The data table gives no repair costs, so they come from each item's own recipe:
  // half of every material, scaled by how worn the item is (at least one of something), and nothing is taken unless
  // the whole repair can be paid for.
  nearBench() { return this.g.build?.nearStation?.('workbench', this.g.player.pos, 6); }
  repairCost(slot) {
    const def = ITEMS[slot.id], rec = RECIPES.find((r) => r.id === slot.id); if (!def?.dur || !rec || slot.dur >= def.dur) return null;
    const worn = 1 - slot.dur / def.dur, cost = {};
    for (const [m, n] of Object.entries(rec.mats)) { const k = Math.ceil(n * 0.5 * worn); if (k > 0) cost[m] = k; }
    if (!Object.keys(cost).length) { const [m] = Object.keys(rec.mats); cost[m] = 1; }
    return cost;
  }
  damaged() { return this.g.inv.slots.map((s, i) => [s, i]).filter(([s]) => s && this.repairCost(s)); }
  repair(i) {
    const s = this.g.inv.slots[i], cost = s && this.repairCost(s); if (!cost) return;
    if (!this.nearBench()) { this.g.hud.toast('Repairs need a workbench nearby'); return; }
    if (!this.g.inv.has(cost)) { this.g.hud.toast('Not enough materials to repair it'); return; }
    this.g.inv.takeMats(cost); s.dur = ITEMS[s.id].dur; this.g.inv.onChange?.(); this.g.sound?.('repair'); this.g.hud.toast(`${ITEMS[s.id].name} repaired`);
  }
  drawRepair() {
    const list = this.damaged(), have = (m) => this.g.inv.count(m);
    $('craftDetail').innerHTML = `<div class="big">${icon('repair')}</div><h3>Repair Items</h3><p class="desc">Worn tools, weapons and armour are mended at the workbench, one at a time. The cost is part of what the item took to make.</p>
      <div class="repairList">${list.length ? list.map(([s, i]) => { const d = ITEMS[s.id], cost = this.repairCost(s), ok = this.g.inv.has(cost);
        return `<div class="rp"><i>${icon(d.icon)}</i><span><b>${d.name}</b><u><s style="width:${(s.dur / d.dur) * 100}%"></s></u></span><span class="rc">${Object.entries(cost).map(([m, n]) => `<em class="${have(m) < n ? 'no' : ''}">${icon(ITEMS[m].icon)}${n}</em>`).join('')}</span><button class="btn small" data-repair="${i}" ${ok ? '' : 'disabled'}>Repair</button></div>`; }).join('') : '<p class="desc"><i>Nothing in your pack needs repairing.</i></p>'}</div>`;
  }
  draw() {
    if (!this.g.hud.open) return;
    this.panel.querySelectorAll('#craftTabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === this.tab));
    this.panel.querySelector('h2').textContent = this.tab === 'craft' ? 'Craft' : 'Build';
    const list = this.list().filter((r) => (this.tab === 'craft' ? r.kind === 'item' : r.kind === 'piece') && this.known.has(r.key));
    if (this.tab === 'craft' && this.nearBench()) list.unshift({ key: 'repair', kind: 'repair', name: `Repair Items${this.damaged().length ? ` (${this.damaged().length})` : ''}`, icon: 'repair', mats: {}, tier: 0 });
    if (!list.length) { $('craftList').innerHTML = `<p class="empty">${this.tab === 'craft' ? 'Pick things up to learn what you can make from them.' : 'Gather wood to learn what you can build.'}</p>`; $('craftDetail').innerHTML = ''; return; }
    if (!this.sel || !list.find((r) => r.key === this.sel)) this.sel = list.find((r) => r.kind !== 'repair')?.key || list[0].key;
    if (this.tab === 'build') list.sort((a, b) => (a.cat === 'Crafting' ? 0 : 1) - (b.cat === 'Crafting' ? 0 : 1));   // crafting pieces first
    const groups = new Map(); for (const r of list) { const k = r.kind === 'piece' ? r.cat || 'Structures' : r.kind === 'repair' || r.at ? 'Workbench' : 'By hand'; (groups.get(k) || groups.set(k, []).get(k)).push(r); }
    const scroll = this.scrollBy[this.tab];
    $('craftList').innerHTML = [...groups].map(([k, rs]) => `<p class="psub">${k}</p>` + rs.map((r) => {
      const why = r.kind === 'repair' ? null : this.blocker(r); return `<button class="rrow${r.key === this.sel ? ' on' : ''}${why ? ' no' : ''}${r.tier > (this.g.S.tier || 0) ? ' locked' : ''}" data-id="${r.key}"><i>${icon(r.icon)}</i><span>${r.name}</span>${this.fresh.has(r.key) ? '<em>new</em>' : ''}</button>`;
    }).join('')).join('');
    $('craftList').scrollTop = scroll;
    if (this.sel === 'repair' && list.find((x) => x.key === 'repair')) { this.drawRepair(); return; }
    const r = list.find((x) => x.key === this.sel), why = this.blocker(r), d = r.kind === 'item' ? ITEMS[r.id] : this.g.build.piece(r.id);
    const stats = [];
    if (d.dmg) stats.push('Damage ' + d.dmg.map(([n, k]) => `${n} ${k}`).join(' + ')); if (d.block) stats.push(`Block ${d.block}`); if (d.armor) stats.push(`Armour ${d.armor}`);
    if (d.food) stats.push(`+${d.food.health} health · +${d.food.stamina} stamina`); if (d.hp) stats.push(`${d.hp} hit points`); if (d.speed) stats.push(`${d.speed > 0 ? '+' : ''}${Math.round(d.speed * 100)}% speed`);
    $('craftDetail').innerHTML = `<div class="big">${icon(r.icon)}</div><h3>${r.name}</h3><p class="desc">${d.desc || d.note || ''}${stats.length ? `<br>${stats.join(' · ')}` : ''}</p>
      <div class="cost">${Object.entries(r.mats).map(([m, n]) => { const have = this.g.inv.count(m); return `<div class="slot${have < n ? ' no' : ''}" title="${ITEMS[m].name}">${icon(ITEMS[m].icon)}<em>${have}/${n}</em></div>`; }).join('')}</div>
      ${r.at ? `<p class="where">${icon('anvil')} At a workbench</p>` : ''}<button class="btn" id="craftGo" ${why ? 'disabled' : ''}>${why || (r.kind === 'piece' ? 'Build' : 'Craft')}</button>`;
  }
}
