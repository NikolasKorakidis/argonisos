// HUD and the inventory screen. The HUD redraws its bars every frame and everything else when it changes.
import { icon } from './icons.js';
import { ITEMS } from '../game/items.js';
import { COLS, ROWS, MAX_WEIGHT } from '../game/inventory.js';
import { CONDITIONS, SKILLS, xpForLevel, Stats } from '../player/stats.js';
import { input, lock, unlock } from '../input.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const fmtT = (s) => (s >= 60 ? `${Math.ceil(s / 60)}m` : `${Math.ceil(s)}s`);
const BAD = new Set(['wet', 'cold', 'freezing', 'stunned']), GREAT = new Set(['zeusBuff', 'zeusBlessing']);

export class HUD {
  constructor() {
    const hud = el('div'); hud.id = 'hud';
    hud.innerHTML = `
      <div id="hurt"></div>
      <div id="hotbar"></div>
      <div id="status"><div id="clock"></div><div id="conds"></div></div>
      <div id="toasts"></div><div id="pickups"></div>
      <div id="region"><div class="rname"></div><div class="rsub"></div></div>
      <div id="cross"></div>
      <div id="prompt" class="hidden"></div>
      <div id="stam" class="full"><div class="vbar"><i class="ghost"></i><i class="val"></i></div></div>
      <div id="vitals"><div id="foods"></div><div class="vbar" id="hpBar"><span>${icon('health')}</span><i class="ghost"></i><i class="val"></i><u></u></div></div>`;
    document.body.appendChild(hud);
    const death = el('div', '', '<h1>You have fallen</h1><p>Zeus is not done with you yet…</p>'); death.id = 'death'; document.body.appendChild(death);
    this.inv = null; this.player = null; this.last = {}; this.open = false; this.sel = -1;
    // inventory screen
    const p = el('div'); p.id = 'invPanel'; p.className = 'hidden';
    p.innerHTML = `<div class="pnl"><h2>Pack</h2><button class="xbtn" id="invX">${icon('close')}</button><div class="pbody"><div class="grid" id="invGrid"></div><div id="invInfo"></div><div id="invFoot"></div></div></div>
      <div class="pnl" id="charPanel"><h2>Hero</h2><div class="pbody" id="charBody"></div></div>`;
    document.body.appendChild(p); this.panel = p;
    $('invX').onclick = () => this.toggle(false);
    this.side = null;     // optional extra panel (crafting) placed beside the pack
  }
  bind(player, inv) {
    this.player = player; this.inv = inv;
    inv.onChange = () => { this.dirtyInv = true; };
    this.buildGrid(); this.dirtyInv = true;
  }
  // ---- toasts, pickups, banners
  toast(msg) { const t = el('div', 'toast', msg); $('toasts').appendChild(t); setTimeout(() => t.remove(), 3400); while ($('toasts').children.length > 4) $('toasts').firstChild.remove(); }
  pickup(id, n) {
    const box = $('pickups'), def = ITEMS[id]; if (!def) return;
    const cur = [...box.children].find((c) => c.dataset.id === id && Date.now() - c.dataset.t < 2500);
    if (cur) { cur.dataset.n = +cur.dataset.n + n; cur.querySelector('em').textContent = '×' + cur.dataset.n; cur.style.animation = 'none'; void cur.offsetWidth; cur.style.animation = ''; cur.dataset.t = Date.now(); return; }
    const e = el('div', 'pick', `${icon(def.icon || 'stone')}<span>${def.name}</span><em>×${n}</em>`); e.dataset.id = id; e.dataset.n = n; e.dataset.t = Date.now();
    box.appendChild(e); setTimeout(() => e.remove(), 3000); while (box.children.length > 6) box.firstChild.remove();
  }
  region(name, sub) { const r = $('region'); r.querySelector('.rname').textContent = name; r.querySelector('.rsub').textContent = sub || ''; r.classList.remove('show'); void r.offsetWidth; r.classList.add('show'); }
  prompt(key, text, sub) {
    const p = $('prompt'), html = key ? `<kbd>${key}</kbd><span>${text}</span>${sub ? `<small>${sub}</small>` : ''}` : '';
    if (html === this.last.prompt) return; this.last.prompt = html;
    p.classList.toggle('hidden', !key); p.innerHTML = html;
  }
  hurt(k) { $('hurt').style.boxShadow = `inset 0 0 160px rgba(200,20,20,${Math.min(0.75, k)})`; clearTimeout(this.hurtT); this.hurtT = setTimeout(() => ($('hurt').style.boxShadow = ''), 250); }
  death(on) { $('death').classList.toggle('show', on); }
  // ---- per frame
  update(dt, clockText, night) {
    const P = this.player, S = P.stats;
    // health: value plus a pale ghost that lingers after a hit
    const mh = S.maxHealth, hb = $('hpBar'), w = 280 + Math.max(0, mh - 25) * 1.6;
    hb.style.width = Math.min(w, 520) + 'px';
    hb.querySelector('.val').style.width = (S.health / mh) * 100 + '%'; hb.querySelector('.ghost').style.width = (S.health / mh) * 100 + '%';
    hb.querySelector('u').textContent = `${Math.ceil(S.health)} / ${Math.round(mh)}`;
    const ms = S.maxStamina, st = $('stam'), sk = S.stamina / ms;
    st.querySelector('.vbar').style.width = Math.min(240 + (ms - 50) * 1.4, 480) + 'px';
    st.querySelector('.val').style.width = sk * 100 + '%'; st.querySelector('.ghost').style.width = sk * 100 + '%';
    st.classList.toggle('full', sk > 0.995); st.classList.toggle('low', sk < 0.2);
    this.t = (this.t || 0) - dt; if (this.t > 0 && !this.dirtyInv) return; this.t = 0.2;
    // food slots
    const fk = S.food.map((f) => `${f.id}:${Math.round(Stats.foodK(f) * 20)}`).join() + S.food.length;
    if (fk !== this.last.food) {
      this.last.food = fk;
      $('foods').innerHTML = [0, 1, 2].map((i) => { const f = S.food[i]; return f ? `<div class="food" style="--k:${Stats.foodK(f) * 100}%" title="${ITEMS[f.id].name}: ${fmtT(f.t)}">${icon(ITEMS[f.id].icon)}</div>` : '<div class="food empty"></div>'; }).join('');
    }
    // conditions
    const ck = Object.entries(S.cond).map(([c, t]) => c + (t === Infinity ? '' : Math.ceil(t / (t > 60 ? 60 : 1)))).join();
    if (ck !== this.last.cond) {
      this.last.cond = ck;
      $('conds').innerHTML = Object.entries(S.cond).filter(([c]) => CONDITIONS[c]).map(([c, t]) => {
        const C = CONDITIONS[c]; return `<div class="cond ${BAD.has(c) ? 'bad' : GREAT.has(c) ? 'great' : ''}">${icon(C.icon)}${t !== Infinity ? `<small>${fmtT(t)}</small>` : ''}<div class="tip"><b>${C.name}</b>${C.desc}</div></div>`;
      }).join('');
    }
    if (clockText !== this.last.clock) { this.last.clock = clockText; $('clock').innerHTML = `${icon(night ? 'moon' : 'sun')}<span>${clockText}</span>`; }
    if (this.dirtyInv) { this.dirtyInv = false; this.drawHotbar(); if (this.open) this.drawGrid(); }
    if (this.open) this.drawChar();
  }
  slotHTML(s, i, hot) {
    if (!s) return `<div class="slot empty" data-i="${i}">${hot ? `<b>${i + 1}</b>` : ''}</div>`;
    const d = ITEMS[s.id], dur = d.dur ? `<div class="dur"><i style="width:${(s.dur / d.dur) * 100}%;${s.dur / d.dur < 0.25 ? 'background:#d65446' : ''}"></i></div>` : '';
    return `<div class="slot${s.worn ? ' worn' : ''}${i === this.sel ? ' sel' : ''}" data-i="${i}" title="${d.name}">${hot ? `<b>${i + 1}</b>` : ''}${icon(d.icon || 'stone')}${s.n > 1 ? `<em>${s.n}</em>` : ''}${dur}</div>`;
  }
  drawHotbar() { $('hotbar').innerHTML = this.inv.slots.slice(0, COLS).map((s, i) => this.slotHTML(s, i, true)).join(''); }
  // ---- inventory screen
  toggle(on = !this.open) {
    this.open = on; this.panel.classList.toggle('hidden', !on); input.uiOpen = on;
    if (on) { unlock(); this.drawGrid(); this.drawChar(); } else { lock(); this.sel = -1; this.onClose?.(); }
    this.onToggle?.(on);
  }
  buildGrid() {
    const g = $('invGrid'); let drag = null, ghost = null;
    g.addEventListener('pointerdown', (e) => {
      const s = e.target.closest('.slot'); if (!s) return; const i = +s.dataset.i;
      if (e.button === 2) { this.onUse?.(i); return; }                                  // right click: use / equip / eat
      if (!this.inv.slots[i]) return;
      if (e.shiftKey) { this.inv.split(i); return; }
      drag = i; s.classList.add('drag'); ghost = el('div', 'slot', icon(ITEMS[this.inv.slots[i].id].icon)); ghost.id = 'dragGhost'; document.body.appendChild(ghost);
      ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; this.sel = i; this.info(i);
    });
    addEventListener('pointermove', (e) => {
      if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
      if (!this.open) return; const s = e.target.closest?.('#invGrid .slot'); if (s && drag === null) this.info(+s.dataset.i);
    });
    addEventListener('pointerup', (e) => {
      if (drag === null) return; ghost?.remove(); ghost = null;
      const s = document.elementFromPoint(e.clientX, e.clientY)?.closest('#invGrid .slot');
      if (s) this.inv.move(drag, +s.dataset.i);
      else if (!e.target.closest?.('#invPanel')) this.onDrop?.(drag);                 // dropped outside the panel: throw it on the ground
      drag = null; this.drawGrid();
    });
    g.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  drawGrid() {
    const g = $('invGrid'), sl = this.inv.slots;
    g.innerHTML = sl.slice(0, COLS).map((s, i) => this.slotHTML(s, i, true)).join('') + '<div class="hot"></div>' + sl.slice(COLS).map((s, i) => this.slotHTML(s, i + COLS, false)).join('');
    const w = this.inv.weight;
    $('invFoot').innerHTML = `${icon('weight')}<span class="${w > MAX_WEIGHT ? 'heavy' : ''}">${w.toFixed(1)} / ${MAX_WEIGHT}</span><span style="margin-left:auto">Drag to move · <span class="kbd">Shift</span> split · <span class="kbd">RMB</span> use · drag out to drop</span>`;
    void ROWS;
  }
  info(i) {
    const s = this.inv.slots[i], box = $('invInfo'); if (!s) { box.innerHTML = ''; return; }
    const d = ITEMS[s.id], bits = [];
    if (d.food) bits.push(d.food.health >= 0 ? `+${d.food.health} health, +${d.food.stamina} stamina, ${d.food.regen} hp/s for ${fmtT(d.food.duration)}` : `Inedible like this (${d.food.health} health)`);
    if (d.dmg) bits.push('Damage ' + d.dmg.map(([n, k]) => `${n} ${k}`).join(' + '));
    if (d.block) bits.push(`Block ${d.block}`); if (d.armor) bits.push(`Armour ${d.armor}`);
    if (d.speed) bits.push(`${d.speed > 0 ? '+' : ''}${Math.round(d.speed * 100)}% speed`);
    if (d.dur) bits.push(`Durability ${Math.ceil(s.dur)} / ${d.dur}`);
    bits.push(`Weight ${(d.weight * s.n).toFixed(1)}`);
    box.innerHTML = `<b>${d.name}</b>${s.n > 1 ? ` ×${s.n}` : ''}<br>${d.note ? d.note + '<br>' : ''}${bits.join(' · ')}`;
  }
  drawChar() {
    const S = this.player.stats, armor = this.armor?.() ?? 0;
    const sk = Object.entries(SKILLS).map(([k, d]) => { const s = S.skills[k], a = xpForLevel(s.level), b = xpForLevel(s.level + 1); return `<div class="skill"><span>${d.name}</span><b>${s.level}</b><i><u style="width:${((s.xp - a) / (b - a)) * 100}%"></u></i></div>`; }).join('');
    const html = `<div class="statrow"><span>Health</span><b>${Math.ceil(S.health)} / ${Math.round(S.maxHealth)}</b></div><div class="statrow"><span>Stamina</span><b>${Math.ceil(S.stamina)} / ${Math.round(S.maxStamina)}</b></div>
      <div class="statrow"><span>Armour</span><b>${armor}</b></div><p class="psub" style="margin-top:14px">Skills</p><div class="skills">${sk}</div>`;
    if (html !== this.last.char) { this.last.char = html; $('charBody').innerHTML = html; }
  }
}
