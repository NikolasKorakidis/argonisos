// HUD and the inventory screen. The HUD redraws its bars every frame and everything else when it changes.
import { icon, glyph } from './icons.js';
import { ITEMS } from '../game/items.js';
import { usedIn } from '../game/crafting.js';
import { COLS, ROWS, MAX_WEIGHT, hotKey } from '../game/inventory.js';
import { CONDITIONS, SKILLS, xpForLevel, Stats } from '../player/stats.js';
import { input, lock, unlock } from '../input.js';
import { sound } from '../audio/sound.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const fmtT = (s) => (s >= 60 ? `${Math.ceil(s / 60)}m` : `${Math.ceil(s)}s`);
const RETICLE = [46, 12];
const BAD = new Set(['wet', 'cold', 'freezing', 'stunned']), GREAT = new Set(['zeusBuff', 'zeusBlessing']);

export class HUD {
  constructor() {
    const hud = el('div'); hud.id = 'hud';
    hud.innerHTML = `
      <div id="hurt"></div><div id="hurtDir" style="position:absolute;inset:0;pointer-events:none;opacity:0"></div>
      <div id="hotbar"></div>
      <div id="status"><div id="clock"></div><div id="conds"></div></div>
      <div id="toasts"></div><div id="pickups"></div><div id="skillPops"></div>
      <div id="region"><div class="rname"></div><div class="rsub"></div></div>
      <div id="cross"></div>
      <div id="prompt" class="hidden"></div>
      <div id="act" class="hidden"><i></i><span></span></div>
      <div id="stam" class="full"><div class="vbar"><i class="ghost"></i><i class="val"></i></div><u></u></div>
      <div id="vitals"><div id="foods"></div><div class="vbar" id="hpBar"><span>${icon('health')}</span><i class="ghost"></i><i class="val"></i><u></u></div></div>`;
    document.body.appendChild(hud);
    const death = el('div', '', '<h1>You have fallen</h1><p>Zeus is not done with you yet…</p>'); death.id = 'death'; document.body.appendChild(death);
    this.inv = null; this.player = null; this.last = {}; this.open = false; this.sel = -1; this.skillQ = []; this.skillT = null;
    // inventory screen
    const p = el('div'); p.id = 'invPanel'; p.className = 'hidden';
    p.innerHTML = `<div class="pnl" id="packPnl"><h2>Pack</h2><button class="xbtn" id="invX">${icon('close')}</button><div class="pbody"><div class="grid" id="invGrid"></div><div id="invInfo"></div><div id="invFoot"></div>
      <p id="invHelp">Drag to move · <span class="kbd">Shift</span> split · <span class="kbd">RMB</span> use · <span class="kbd">Shift</span>+<span class="kbd">RMB</span> break down · drag out to drop</p></div></div>
      <div class="pnl" id="charPanel"><h2>Hero</h2><div class="pbody" id="charBody"></div></div>`;
    document.body.appendChild(p); this.panel = p;
    $('invX').onclick = () => this.toggle(false);
    p.addEventListener('click', (e) => { if (e.target.closest('#invSort')) { this.inv.sort(COLS, this.inv.slots.length); this.drawGrid(); } });   // the pack rows; the hotbar stays as you arranged it
    addEventListener('resize', () => this.open && this.fit());
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
  // A skill found (learned) or up a level: a banner on the right that rises in and fades, its glyph, name and level, and
  // a soft chime. Several at once wait their turn a beat apart, three on screen at most, so none lands on another; one
  // still waiting that goes up again is told once, at its newest level
  skill(s, level, learned = false) {
    const q = this.skillQ.find((x) => x.s === s); if (q) { q.level = level; return; }
    this.skillQ.push({ s, level, learned }); this.nextSkill();
  }
  nextSkill() {
    const box = $('skillPops'); if (!this.skillQ.length || this.skillT || box.children.length >= 3) return;
    const { s, level, learned } = this.skillQ.shift(), d = SKILLS[s];
    const e = el('div', 'skillPop' + (learned ? ' new' : ''), `<i>${glyph(d.icon || 'star')}</i><div><small>${learned ? 'Skill learned' : 'Skill improved'}</small><span><b>${d.name}</b>, level ${level}</span></div>`);
    e.dataset.s = s; box.appendChild(e); sound('skill', { learned });
    setTimeout(() => { e.remove(); this.nextSkill(); }, 4600);
    this.skillT = setTimeout(() => { this.skillT = null; this.nextSkill(); }, 450);
  }
  region(name, sub) { const r = $('region'); r.querySelector('.rname').textContent = name; r.querySelector('.rsub').textContent = sub || ''; r.classList.remove('show'); void r.offsetWidth; r.classList.add('show'); }
  prompt(key, text, sub, alt) {
    const p = $('prompt'), html = key ? `<kbd>${key}</kbd><span>${text}</span>${sub ? `<small>${sub}</small>` : ''}${alt ? `<i class="sep"></i><kbd>${alt.key}</kbd><span>${alt.label}</span>` : ''}` : '';
    if (html === this.last.prompt) return; this.last.prompt = html;
    p.classList.toggle('hidden', !key); p.innerHTML = html;
  }
  // Something under way that takes a few seconds (eating, praying): a ring filling round its icon, and what it is.
  // k: 0..1, or null to hide it
  progress(k, label, ic) {
    const e = $('act');
    if (k === null || k === undefined) { if (this.last.act) { e.classList.add('hidden'); this.last.act = null; } return; }
    const key = label + '|' + ic; if (key !== this.last.act) { this.last.act = key; e.classList.remove('hidden'); e.querySelector('i').innerHTML = icon(ic); e.querySelector('span').textContent = label; }
    e.style.setProperty('--k', (Math.min(1, Math.max(0, k)) * 100).toFixed(1) + '%');
  }
  // The bow's draw, Valheim's way (combat.js updateBow): a ring round the crosshair closing in as the string comes back,
  // from RETICLE[0] across to RETICLE[1] (px) at a full draw, where it brightens (only a full draw gives the bow its whole
  // damage); no bar. k: 0..1, or null to let it fade where it was
  reticle(k) {
    const e = $('cross'), on = k !== null && k !== undefined; if (on !== this.last.retOn) { this.last.retOn = on; e.classList.toggle('drawing', on); } if (!on) return;
    const f = Math.min(1, Math.max(0, k)), full = f >= 1; if (full !== this.last.retFull) { this.last.retFull = full; e.classList.toggle('full', full); }
    e.style.setProperty('--d', (RETICLE[0] + (RETICLE[1] - RETICLE[0]) * (1 - (1 - f) ** 2)).toFixed(1) + 'px');   // (closing in quickly at first, settling into the full draw)
  }
  // A number that pops off a creature when you hit it
  damageNumber(world, n) {
    const v = world.clone().project(this.camera || window.AG?.camera); if (v.z > 1) return;
    const e = el('div', 'dmgn', Math.max(1, Math.round(n))); e.style.left = (v.x * 0.5 + 0.5) * innerWidth + 'px'; e.style.top = (-v.y * 0.5 + 0.5) * innerHeight + 'px';
    document.getElementById('hud').appendChild(e); setTimeout(() => e.remove(), 900);
  }
  // which way a blow came from: a red glow at that edge of the screen (x: to the right of the view, y: ahead of it), held a
  // moment and fading
  hurtFrom(x, y, k = 0.5) { const e = $('hurtDir'), n = Math.hypot(x, y) || 1; e.style.transition = 'none'; e.style.background = `radial-gradient(ellipse 60% 60% at ${50 + (x / n) * 60}% ${50 - (y / n) * 60}%, rgba(215,24,16,${Math.min(0.85, 0.35 + k * 0.5)}) 0%, rgba(215,24,16,0) 70%)`; e.style.opacity = 1; void e.offsetWidth; e.style.transition = 'opacity .8s ease-in .2s'; e.style.opacity = 0; }
  hurt(k) { $('hurt').style.boxShadow = `inset 0 0 160px rgba(200,20,20,${Math.min(0.75, k)})`; clearTimeout(this.hurtT); this.hurtT = setTimeout(() => ($('hurt').style.boxShadow = ''), 250); }
  // The death screen; lost: what death took of each skill (stats.js deathPenalty), named under the title, the most first
  death(on, lost = []) {
    const d = $('death'); d.classList.toggle('show', on); let el = d.querySelector('.toll'); if (!el) { el = document.createElement('div'); el.className = 'toll'; d.appendChild(el); }
    const top = on ? lost.slice().sort((a, b) => b[3] - a[3]).slice(0, 6) : [];
    el.innerHTML = top.length ? `<small>Death takes 5% of all you have learned</small>${top.map(([n, a, b]) => `<span>${n} ${b < a ? `<b>${a} → ${b}</b>` : a}</span>`).join('')}` : '';
  }
  // Fade out, let the night pass, fade back in
  sleep(cb) {
    const d = $('death'); d.querySelector('h1').textContent = 'You sleep'; d.querySelector('p').textContent = 'The night passes…'; d.classList.add('show');
    setTimeout(() => { cb(); setTimeout(() => { d.classList.remove('show'); setTimeout(() => { d.querySelector('h1').textContent = 'You have fallen'; d.querySelector('p').textContent = 'Zeus is not done with you yet…'; }, 1300); }, 600); }, 2200);
  }
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
    const stn = `${Math.ceil(S.stamina)} / ${Math.round(ms)}`; if (stn !== this.last.stam) { this.last.stam = stn; st.querySelector('u').textContent = stn; }   // (the number under the bar, as the health bar has its own)
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
        const C = CONDITIONS[c]; return `<div class="cond ${BAD.has(c) ? 'bad' : GREAT.has(c) ? 'great' : ''}">${glyph(C.icon)}${t !== Infinity ? `<small>${fmtT(t)}</small>` : ''}<div class="tip"><b>${C.name}</b>${C.desc}</div></div>`;
      }).join('');
    }
    if (clockText !== this.last.clock) { this.last.clock = clockText; $('clock').innerHTML = `${icon(night ? 'moon' : 'sun')}<span>${clockText}</span>`; }
    if (this.dirtyInv) { this.dirtyInv = false; this.drawHotbar(); if (this.open) this.drawGrid(); }
    if (this.open) this.drawChar();
  }
  slotHTML(s, i, hot) {
    if (!s) return `<div class="slot empty" data-i="${i}">${hot ? `<b>${hotKey(i)}</b>` : ''}</div>`;
    const d = ITEMS[s.id], dur = d.dur ? `<div class="dur"><i style="width:${(s.dur / d.dur) * 100}%;${s.dur / d.dur < 0.25 ? 'background:#d65446' : ''}"></i></div>` : '';
    return `<div class="slot${s.worn ? ' worn' : ''}${i === this.sel ? ' sel' : ''}${d.dur && s.dur <= 0 ? ' broken' : ''}" data-i="${i}" title="${d.name}${d.dur && s.dur <= 0 ? ' (broken: mend it at a workbench)' : ''}">${hot ? `<b>${hotKey(i)}</b>` : ''}${icon(d.icon || 'stone')}${s.n > 1 ? `<em>${s.n}</em>` : ''}${dur}</div>`;
  }
  drawHotbar() { $('hotbar').innerHTML = this.inv.slots.slice(0, COLS).map((s, i) => this.slotHTML(s, i, true)).join(''); }
  // ---- inventory screen
  toggle(on = !this.open) {
    if (on !== !!this.open) sound('ui', { open: on, kind: 'pack' }); this.open = on; this.panel.classList.toggle('hidden', !on); input.uiOpen = on;
    if (on) { unlock(); this.drawGrid(); this.drawChar(); } else { lock(); this.sel = -1; this.onClose?.(); }
    this.onToggle?.(on);
    if (on) this.fit();
  }
  // Ask before something in the pack is lost: a small box over it, Enter or the button to go on, Esc or "Keep it" not to.
  // yes runs only if the slot still holds the same thing (it may have been moved or used meanwhile)
  ask(i, title, text, verb, yes) {
    const s = this.inv.slots[i]; if (!s) return; const d = ITEMS[s.id];
    let box = document.getElementById('dropAsk'); if (!box) { box = el('div', 'pnl'); box.id = 'dropAsk'; document.body.appendChild(box); }
    box.innerHTML = `<div class="pbody"><div class="big">${icon(d.icon || 'stone')}</div><h3>${title}</h3><p>${text}</p>
      <div class="btns"><button class="btn ghost" id="dropNo">Keep it</button><button class="btn" id="dropYes">${verb}</button></div></div>`;
    box.classList.remove('hidden');
    const done = (ok) => { box.classList.add('hidden'); removeEventListener('keydown', key, true); if (ok && this.inv.slots[i] === s) yes(); this.drawGrid(); };
    const key = (e) => { if (e.code === 'Escape') { e.stopPropagation(); done(false); } if (e.code === 'Enter') done(true); };
    addEventListener('keydown', key, true);
    box.querySelector('#dropNo').onclick = () => done(false); box.querySelector('#dropYes').onclick = () => done(true);
  }
  // Ask before throwing something away
  confirmDrop(i) {
    const s = this.inv.slots[i]; if (!s) return; const d = ITEMS[s.id];
    this.ask(i, `Drop ${d.name}${s.n > 1 ? ` ×${s.n}` : ''}?`, `${s.worn ? 'You are using it. ' : ''}It will lie on the ground where you stand.`, 'Drop', () => this.onDrop?.(i));
  }
  // Break a crafted thing down for half its materials (Shift + right-click: crafting.js salvage), asked first, since a
  // slip of the mouse would cost the gear; worn things and plain materials are refused with a word why
  confirmBreak(i) {
    const b = this.salvage?.(i); if (!b) return; if (typeof b === 'string') { this.toast(b); return; }
    const d = ITEMS[b.id], back = Object.entries(b.mats).map(([m, k]) => `${icon(ITEMS[m].icon || 'stone')} ${k} ${ITEMS[m].name.toLowerCase()}`).join(', ');
    this.ask(i, `Break down ${d.name}${b.n > 1 ? ` ×${b.n}` : ''}?`, `You get back half of what it took: <span class="back">${back}</span>`, 'Break down', () => this.onBreak?.(i));
  }
  // Scale the screen down to fit small windows
  fit() {
    const p = this.panel; p.style.transform = 'translate(-50%,-50%)';
    const k = Math.min(1, (innerWidth - 24) / p.scrollWidth, (innerHeight - 24) / p.scrollHeight);
    p.style.transform = `translate(-50%,-50%) scale(${k})`;
  }
  buildGrid() {
    const g = $('invGrid'); let drag = null, ghost = null;
    g.addEventListener('pointerdown', (e) => {
      const s = e.target.closest('.slot'); if (!s) return; const i = +s.dataset.i;
      if (e.button === 2) { if (e.shiftKey) this.confirmBreak(i); else this.onUse?.(i); return; }   // right click: use / equip / eat; with Shift: break down
      if (this.onSlotClick?.(i)) { this.drawGrid(); return; }                          // a chest is open: click moves things across
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
      else if (!e.target.closest?.('#invPanel')) this.confirmDrop(drag);              // dragged outside the panel: ask, then throw it on the ground
      drag = null; this.drawGrid();
    });
    g.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  drawGrid() {
    const g = $('invGrid'), sl = this.inv.slots;
    g.innerHTML = sl.slice(0, COLS).map((s, i) => this.slotHTML(s, i, true)).join('') + '<div class="hot"></div>' + sl.slice(COLS).map((s, i) => this.slotHTML(s, i + COLS, false)).join('');
    const w = this.inv.weight;
    $('invFoot').innerHTML = `${icon('weight')}<span class="${w > MAX_WEIGHT ? 'heavy' : ''}">${w.toFixed(1)} / ${MAX_WEIGHT}</span><button class="btn small" id="invSort" title="Merge piles and sort by name (the hotbar and worn things stay put)">Sort Items</button>`;
    void ROWS;
  }
  info(i) {
    const s = this.inv.slots[i], box = $('invInfo'); if (!s) { box.innerHTML = ''; return; }
    const d = ITEMS[s.id], bits = [];
    if (d.food) bits.push(d.food.health >= 0 ? `+${d.food.health} health, +${d.food.stamina} stamina, ${d.food.regen} hp/s for ${fmtT(d.food.duration)}` : `Inedible like this (${d.food.health} health)`);
    if (d.dmg) bits.push('Damage ' + d.dmg.map(([n, k]) => `${n} ${k}`).join(' + '));
    if (d.draw) bits.push(`Full draw ${d.draw} s`);   // (a bow's: quicker with the Bowman skill, combat.js drawTime)
    if (d.block) bits.push(`Block ${d.block}`); if (d.armor) bits.push(`Armour ${d.armor}`);
    if (d.speed) bits.push(`${d.speed > 0 ? '+' : ''}${Math.round(d.speed * 100)}% speed`); if (d.resist) bits.push(`Resists ${d.resist.join(', ')}`); if (d.regen) bits.push(`+${Math.round(d.regen * 100)}% health regeneration`);
    if (d.dur) bits.push(`Durability ${Math.ceil(s.dur)} / ${d.dur}`);
    bits.push(`Weight ${(d.weight * s.n).toFixed(1)}`);
    const use = usedIn(s.id);   // (what it goes into: crafting.js)
    box.innerHTML = `<b>${d.name}</b>${s.n > 1 ? ` ×${s.n}` : ''}<br>${d.note ? d.note + '<br>' : ''}${bits.join(' · ')}${use.length ? `<br><i>Used in ${use.slice(0, 6).join(', ')}${use.length > 6 ? ` and ${use.length - 6} more` : ''}</i>` : ''}${this.breakable?.(s.id) ? '<br><i class="brk"><span class="kbd">Shift</span>+<span class="kbd">RMB</span> break down for half its materials</i>' : ''}`;
    box.scrollTop = 0; box.title = box.scrollHeight > box.clientHeight + 1 ? box.textContent : '';   // (the box keeps its size: a long one scrolls, and says it all on hover too)
  }
  drawChar() {
    const S = this.player.stats, armor = this.armor?.() ?? 0;
    const sk = Object.entries(SKILLS).map(([k, d]) => { const s = S.skills[k], a = xpForLevel(s.level), b = xpForLevel(s.level + 1); return `<div class="skill"><span>${d.name}</span><b>${s.level}</b><i><u style="width:${Math.min(100, Math.max(0, ((s.xp - a) / (b - a)) * 100))}%"></u></i></div>`; }).join('');   // (kept within the bar, whatever an old save holds)
    const html = `<div class="statrow"><span>Health</span><b>${Math.ceil(S.health)} / ${Math.round(S.maxHealth)}</b></div><div class="statrow"><span>Stamina</span><b>${Math.ceil(S.stamina)} / ${Math.round(S.maxStamina)}</b></div>
      <div class="statrow"><span>Armour</span><b>${armor}</b></div><p class="psub" style="margin-top:14px">Skills</p><div class="skills">${sk}</div>`;
    if (html !== this.last.char) { this.last.char = html; $('charBody').innerHTML = html; }
  }
}
