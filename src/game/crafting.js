// Crafting. A recipe shows up in the menu (C) once you have held every one of its materials (and, for a workbench's, have
// stood by one; for a tier's, hold its boss's head); it can be made when you carry everything and stand at the right
// station. Workbench recipes need a workbench close by, and (except rope) a roof over it. Some need a tier that a boss's
// head unlocks. The Build tab lists structures for the hammer (build/pieces.js).
import { ITEMS, RECIPES, SOURCES } from './items.js';
import { PIECES } from '../build/pieces.js';
import { icon } from '../ui/icons.js';

const $ = (id) => document.getElementById(id);
const TIER_HINT = ['', 'Offer the Minotaur\'s head to learn this', 'Offer the Chimera\'s head to learn this'];
const TIER_KEY = ['', 'minotaurHead', 'chimeraHead'];   // (holding the head shows what offering it will teach)
const BATCH = 5;   // (Shift-click, or the ×5 button: that many at once, or as many as you can)
// what each thing is used in (recipes and pieces), for the pack's info and the crafting panel
const USED = {}; for (const r of [...RECIPES, ...PIECES]) for (const m of Object.keys(r.mats)) (USED[m] ||= new Set()).add(ITEMS[r.id]?.name ?? r.name);
export const usedIn = (id) => [...(USED[id] || [])];

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
    $('craftDetail').addEventListener('click', (e) => { if (e.target.closest('#craftGo')) this.make(this.sel, e.shiftKey ? BATCH : 1); if (e.target.closest('#craftGo5')) this.make(this.sel, BATCH); if (e.target.closest('#repairAll')) { this.repairAll(); this.draw(); } const rb = e.target.closest('[data-repair]'); if (rb) { this.repair(+rb.dataset.repair); this.draw(); } });
    g.inv.onNew = (id) => { this.discover(); g.onFirstItem?.(id); };
    this.discover(true);
  }
  // Find recipes newly revealed by what you've held
  // each tab remembers what was selected and how far down the list you were, so the menu reopens where you left it
  get sel() { return this.selBy[this.tab]; }
  set sel(v) { this.selBy[this.tab] = v; }
  // Valheim's rule: a recipe once every one of its materials has been held (the first rope used to reveal 42 at once, gear
  // for bosses not yet met among them, a toast each), a workbench's once you've stood by one, and a boss tier's only once
  // its head is yours (held, or offered: it then shows what offering it will teach). What's new comes in one toast
  learnable(r, seen) {
    if (!Object.keys(r.mats).every((m) => seen.has(m))) return false;
    if (r.at && !seen.has('@' + r.at)) return false;
    return !r.tier || (this.g.S.tier || 0) >= r.tier || seen.has(TIER_KEY[r.tier]);
  }
  discover(silent) {
    const seen = this.g.inv.seen, list = this.list(), B = this.g.build;
    if (!seen.has('@workbench') && (B?.nearStation?.('workbench', this.g.player.pos, 8) || B?.placed?.some((p) => p.def.station === 'workbench'))) seen.add('@workbench');   // (a bench built, or stood by)
    const fresh = [];
    for (const r of list) if (!this.known.has(r.key) && this.learnable(r, seen)) { this.known.add(r.key); if (!silent) { this.fresh.add(r.key); fresh.push(r); } }
    if (fresh.length) this.announce(fresh);
    if (this.g.hud.open) this.draw();
  }
  // (several found at once, or within a moment, as a pile of loot lands in the pack: one toast for them all)
  announce(list) {
    (this.news ||= []).push(...list); clearTimeout(this.newsT);
    this.newsT = setTimeout(() => {
      const n = this.news, names = n.slice(0, 3).map((r) => `<b>${r.name}</b>`).join(', '), more = n.length > 3 ? ` and ${n.length - 3} more` : ''; this.news = [];
      this.g.hud.toast(n.length === 1 ? `New recipe: ${names} <span class="kbd">C</span>` : `${n.length} new recipes: ${names}${more} <span class="kbd">C</span>`);
    }, 250);
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
      if (r.id !== 'rope' && !g.build.sheltered(wb.pos, 1.2)) return 'The workbench needs a roof over it';
    }
    if (!g.inv.has(r.mats)) return g.inv.need(r.mats);   // ("Need 1 more wood, 2 more rope")
    if (r.kind === 'item' && g.inv.room(r.id) < r.n) return 'No room in your pack';
    return null;
  }
  make(key, times = 1) {
    const r = this.list().find((x) => x.key === key); if (!r) return;
    const why = this.blocker(r); if (why) { this.g.hud.toast(why); return; }
    if (r.kind === 'piece') { this.g.hud.toggle(false); this.g.build.select(r.id); return; }        // building: pick the piece, place it in the world
    let made = 0; while (made < times && (made === 0 || !this.blocker(r))) { if (!this.g.S.freeBuild) this.g.inv.takeMats(r.mats); this.g.inv.add(r.id, r.n); made++; }   // (×5: as many as you can, up to five)
    this.g.hud.pickup(r.id, r.n * made); this.g.sound?.('craft');
    this.g.player.stats.train('gathering', 0);
    this.draw();
  }
  open(tab) { if (tab) this.tab = tab; this.discover(true); this.draw(); }
  // ---- Repair at the workbench: free (the bench is all it needs), one item at a time, made as good as new
  nearBench() { return this.g.build?.nearStation?.('workbench', this.g.player.pos, 6); }
  needsRepair(slot) { const def = ITEMS[slot?.id]; return !!def?.dur && slot.dur < def.dur; }
  damaged() { return this.g.inv.slots.map((s, i) => [s, i]).filter(([s]) => this.needsRepair(s)); }
  repair(i) {
    const s = this.g.inv.slots[i]; if (!this.needsRepair(s)) return;
    if (!this.nearBench()) { this.g.hud.toast('Repairs need a workbench nearby'); return; }
    s.dur = ITEMS[s.id].dur; this.g.inv.onChange?.(); this.g.sound?.('repair'); this.g.hud.toast(`${ITEMS[s.id].name} repaired`);
  }
  repairAll() {
    const list = this.damaged(); if (!list.length) return; if (!this.nearBench()) { this.g.hud.toast('Repairs need a workbench nearby'); return; }
    for (const [s] of list) s.dur = ITEMS[s.id].dur; this.g.inv.onChange?.(); this.g.sound?.('repair'); this.g.hud.toast(list.length > 1 ? `${list.length} things repaired` : `${ITEMS[list[0][0].id].name} repaired`);
  }
  drawRepair() {
    const list = this.damaged();
    $('craftDetail').innerHTML = `<div class="big">${icon('repair')}</div><h3>Repair Items</h3><p class="desc">Worn tools, weapons and armour are mended at the workbench, as good as new, broken ones too. It costs nothing.</p>${list.length > 1 ? '<button class="btn small" id="repairAll">Repair all</button>' : ''}
      <div class="repairList">${list.length ? list.map(([s, i]) => { const d = ITEMS[s.id];
        return `<div class="rp"><i>${icon(d.icon)}</i><span><b>${d.name}</b><u><s style="width:${(s.dur / d.dur) * 100}%"></s></u>${s.dur <= 0 ? ' <em>broken</em>' : ''}</span><button class="btn small" data-repair="${i}">Repair</button></div>`; }).join('') : '<p class="desc"><i>Nothing in your pack needs repairing.</i></p>'}</div>`;
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
    const short = Object.entries(r.mats).filter(([m, n]) => this.g.inv.count(m) < n && SOURCES[m]).map(([m]) => m);   // (where to find what's short)
    const stats = [];
    if (d.dmg) stats.push('Damage ' + d.dmg.map(([n, k]) => `${n} ${k}`).join(' + ')); if (d.block) stats.push(`Block ${d.block}`); if (d.armor) stats.push(`Armour ${d.armor}`);
    if (d.food) stats.push(`+${d.food.health} health · +${d.food.stamina} stamina`); if (d.hp) stats.push(`${d.hp} hit points`); if (d.speed) stats.push(`${d.speed > 0 ? '+' : ''}${Math.round(d.speed * 100)}% speed`); if (d.resist) stats.push(`Resists ${d.resist.join(', ')}`); if (d.regen) stats.push(`+${Math.round(d.regen * 100)}% health regeneration`);
    $('craftDetail').innerHTML = `<div class="big">${icon(r.icon)}</div><h3>${r.name}</h3><p class="desc">${d.desc || d.note || ''}${stats.length ? `<br>${stats.join(' · ')}` : ''}</p>
      <div class="cost">${Object.entries(r.mats).map(([m, n]) => { const have = this.g.inv.count(m); return `<div class="slot${have < n ? ' no' : ''}" title="${ITEMS[m].name}: ${n} needed, ${have} carried${SOURCES[m] ? ` · ${SOURCES[m]}` : ''}">${icon(ITEMS[m].icon)}<em>${have >= n ? n : `${have}/${n}`}</em></div>`; }).join('')}</div>
      ${short.length ? `<p class="srcs">${short.map((m) => `<b>${ITEMS[m].name}</b>: ${SOURCES[m]}`).join('<br>')}</p>` : ''}
      ${r.at ? `<p class="where">${icon('anvil')} At a workbench</p>` : ''}<button class="btn" id="craftGo" ${why ? 'disabled' : ''} title="${r.kind === 'item' ? `Shift-click: make ${BATCH}` : ''}">${why || (r.kind === 'piece' ? 'Build' : 'Craft')}</button>${!why && r.kind === 'item' && this.g.inv.has(Object.fromEntries(Object.entries(r.mats).map(([m, n]) => [m, n * 2]))) ? `<button class="btn small" id="craftGo5">Craft ×${BATCH}</button>` : ''}`;
  }
}
