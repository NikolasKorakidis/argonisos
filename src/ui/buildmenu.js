// The hammer's build menu (RMB with the hammer out): category tabs along the top (Q / E to step through them), a grid
// of the pieces you know, and a box describing the one under the cursor with its cost. Clicking a piece closes the
// menu and you're placing it straight away. Esc or RMB closes it again.
import { icon } from './icons.js';
import { ITEMS } from '../game/items.js';
import { input, lock, unlock } from '../input.js';

// Crafting pieces first, then the structure, then the rest
const CATS = ['Crafting', 'Walls', 'Floors', 'Roofs', 'Beams', 'Fences', 'Furniture', 'Tools'];

export class BuildMenu {
  constructor(g) {
    this.g = g; this.open = false; this.cat = 'Crafting'; this.hover = null;
    const el = document.createElement('div'); el.id = 'buildMenu'; el.className = 'hidden';
    el.innerHTML = `<div class="pnl"><div class="bmtabs"><span class="kbd">Q</span><nav></nav><span class="kbd">E</span></div><div class="bmgrid"></div></div>
      <div class="pnl bminfo"></div>
      <div class="bmkeys"><span><span class="kbd">LMB</span> Place</span><span><span class="kbd">MMB</span> / <span class="kbd">X</span> Remove</span><span><span class="kbd">RMB</span> Build menu</span><span><span class="kbd">R</span> / wheel Rotate</span><span><span class="kbd">Esc</span> Stop building</span></div>`;
    document.body.appendChild(el); this.el = el;
    el.querySelector('nav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !b.disabled) { this.cat = b.dataset.c; this.draw(); } });
    const grid = el.querySelector('.bmgrid');
    grid.addEventListener('pointerover', (e) => { const t = e.target.closest('.bmtile'); if (t) { this.hover = t.dataset.id; this.drawInfo(); } });
    grid.addEventListener('click', (e) => { const t = e.target.closest('.bmtile'); if (t) this.pick(t.dataset.id); });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); this.toggle(false); });
  }
  pieces() { const C = this.g.crafting; return this.g.build.pieces.filter((p) => C.known.has('b:' + p.id)); }
  toggle(on = !this.open) {
    this.open = on; this.el.classList.toggle('hidden', !on); input.uiOpen = on;
    if (on) { unlock(); this.g.crafting.discover(true); const known = this.pieces(); if (!known.some((p) => (p.cat || 'Tools') === this.cat)) this.cat = CATS.find((c) => known.some((p) => (p.cat || 'Tools') === c)) || 'Crafting'; this.hover = this.g.build.sel; this.draw(); }
    else lock();
  }
  step(d) { const known = this.pieces(), cats = CATS.filter((c) => known.some((p) => (p.cat || 'Tools') === c)); if (!cats.length) return; this.cat = cats[(cats.indexOf(this.cat) + d + cats.length) % cats.length]; this.draw(); }
  pick(id) { this.toggle(false); this.g.build.select(id); }
  missing(p) { return !this.g.S.freeBuild && !this.g.inv.has(p.mats); }
  draw() {
    const known = this.pieces();
    this.el.querySelector('nav').innerHTML = CATS.map((c) => { const n = known.filter((p) => (p.cat || 'Tools') === c).length; return `<button data-c="${c}" class="${c === this.cat ? 'on' : ''}" ${n ? '' : 'disabled'}>${c} <b>[${n}]</b></button>`; }).join('');
    const list = known.filter((p) => (p.cat || 'Tools') === this.cat), sel = this.g.build.sel;
    const cells = list.map((p) => `<button class="bmtile${p.id === sel ? ' on' : ''}${this.missing(p) ? ' no' : ''}" data-id="${p.id}" title="${p.name}">${icon(p.icon)}<i>${p.name.replace(/^Wooden /, '')}</i></button>`);
    while (cells.length < 18) cells.push('<div class="bmtile empty"></div>');
    this.el.querySelector('.bmgrid').innerHTML = cells.join('');
    if (!list.find((p) => p.id === this.hover)) this.hover = list[0]?.id || null;
    this.drawInfo();
  }
  drawInfo() {
    const box = this.el.querySelector('.bminfo'), p = this.g.build.piece(this.hover);
    if (!p) { box.innerHTML = '<p class="empty">Gather wood and stone to learn what you can build.</p>'; return; }
    const cost = Object.entries(p.mats).map(([m, n]) => { const have = this.g.inv.count(m); return `<div class="slot${have < n && !this.g.S.freeBuild ? ' no' : ''}" title="${ITEMS[m].name}">${icon(ITEMS[m].icon)}<em>${have}/${n}</em></div>`; }).join('');
    box.innerHTML = `<div class="big">${icon(p.icon)}</div><div class="txt"><h3>${p.name}</h3><p>${p.desc || (p.hp ? `${p.hp} hit points` : '')}</p></div><div class="cost">${cost || '<span class="free">No cost</span>'}</div>`;
  }
  update() {
    if (!this.open) return;
    if (input.pressed.has('KeyQ')) this.step(-1); if (input.pressed.has('KeyE')) this.step(1);
    if (input.pressed.has('Escape') || input.clicks.includes(2)) { this.toggle(false); input.pressed.delete('Escape'); input.clicks.length = 0; }   // used up: it mustn't also pause or cancel the piece
  }
}
