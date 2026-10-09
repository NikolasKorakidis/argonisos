// The world map (M) and the compass. The map is painted once by a worker and uncovered as you travel; places appear
// on it when you find them, or when a clue or the trial reveals them. The compass band at the top shows the bearing
// and the marked places ahead.
import { icon, iconImg } from './icons.js';
import { SITES } from '../world/sites.js';
import { BIOME_NAMES, biomeAt } from '../world/gen.js';
import { input, lock, unlock } from '../input.js';

const EXT = 3200, N = 512, FOG = 256, SEEN_R = 70;
const LABEL = { temple: 'Ancient Temple', house: 'Abandoned House', labyrinth: 'The Labyrinth', chimera: "Chimera's Shrine", olive: 'Ancient Olive', cave: 'Giant Cave' };
const ICON = { temple: 'temple', house: 'roof', labyrinth: 'goal', chimera: 'goal', olive: 'olivebranch', cave: 'stone' };

export class WorldMap {
  constructor(g) {
    this.g = g; this.open = false; this.zoom = 1; this.cx = 0; this.cz = 0; this.img = null;
    const st = (g.S.map ||= { known: [] }); this.st = st;
    this.fog = document.createElement('canvas'); this.fog.width = this.fog.height = FOG; this.fctx = this.fog.getContext('2d'); this.fctx.fillStyle = '#d4c49a'; this.fctx.fillRect(0, 0, FOG, FOG);   // unexplored: blank parchment
    this.base = document.createElement('canvas'); this.base.width = this.base.height = N;
    g.pool.post({ type: 'mapImage', N, extent: EXT }).then((m) => { const c = this.base.getContext('2d'), id = c.createImageData(N, N); id.data.set(m.data); c.putImageData(id, 0, 0); this.img = true; });
    // panel
    const p = document.createElement('div'); p.id = 'mapPanel'; p.className = 'hidden';
    p.innerHTML = `<div class="pnl"><h2>Nisos</h2><button class="xbtn" id="mapX">${icon('close')}</button><div class="pbody"><canvas id="mapCanvas"></canvas><div id="mapLegend"></div></div></div>`;
    document.body.appendChild(p); this.panel = p; this.cv = p.querySelector('#mapCanvas');
    p.querySelector('#mapX').onclick = () => this.toggle(false);
    this.cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = Math.max(1, Math.min(6, this.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2))); this.draw(); }, { passive: false });
    let drag = null; this.cv.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, y: e.clientY, cx: this.cx, cz: this.cz }));
    addEventListener('pointermove', (e) => { if (!drag) return; const k = EXT / this.zoom / this.cv.clientWidth; this.cx = drag.cx - (e.clientX - drag.x) * k; this.cz = drag.cz - (e.clientY - drag.y) * k; this.draw(); });
    addEventListener('pointerup', () => (drag = null));
    // compass
    const mm = document.createElement('div'); mm.id = 'minimap'; mm.innerHTML = '<canvas width="176" height="176"></canvas><div id="biomeLabel"></div>'; document.getElementById('hud').appendChild(mm); this.mini = mm.querySelector('canvas'); this.biomeEl = mm.querySelector('#biomeLabel');
    const c = document.createElement('div'); c.id = 'compass'; c.innerHTML = '<div id="compassStrip"></div><i></i>'; document.getElementById('hud').appendChild(c); this.strip = c.querySelector('#compassStrip');
    this.know(SITES.house);   // the temple is found by exploring
  }
  know(s) { if (s && !this.st.known.includes(s.x.toFixed(0) + ',' + s.z.toFixed(0))) this.st.known.push(s.x.toFixed(0) + ',' + s.z.toFixed(0)); }
  isKnown(s) { return this.st.known.includes(s.x.toFixed(0) + ',' + s.z.toFixed(0)); }
  reveal(s) { this.know(s); this.uncover(s.x, s.z, 90); }
  uncover(x, z, r) { const k = FOG / EXT, f = this.fctx; f.globalCompositeOperation = 'destination-out'; const g = f.createRadialGradient((x + EXT / 2) * k, (z + EXT / 2) * k, 0, (x + EXT / 2) * k, (z + EXT / 2) * k, r * k); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = g; f.beginPath(); f.arc((x + EXT / 2) * k, (z + EXT / 2) * k, r * k, 0, 7); f.fill(); f.globalCompositeOperation = 'source-over'; }
  done(s) { const st = this.g.trial?.st; if (!st) return false; const i = SITES.olives.indexOf(s); if (i >= 0) return st.scraps.includes('olive' + i); const k = SITES.caves.indexOf(s); return k >= 0 && st.carvings.includes('cave' + k); }
  sites() { return [SITES.temple, SITES.house, SITES.labyrinth, SITES.chimera, ...SITES.olives, ...SITES.caves].filter(Boolean); }
  toggle(on = !this.open) { this.open = on; this.panel.classList.toggle('hidden', !on); input.uiOpen = on || this.g.hud.open; if (on) { unlock(); this.cx = this.g.player.pos.x; this.cz = this.g.player.pos.z; this.zoom = 2; this.fit(); this.draw(); } else if (!this.g.hud.open) lock(); }
  fit() { const s = Math.min(innerWidth - 80, innerHeight - 140, 900); this.cv.width = this.cv.height = s; this.cv.style.width = this.cv.style.height = s + 'px'; }
  draw() {
    if (!this.open) return; const c = this.cv.getContext('2d'), W = this.cv.width, span = EXT / this.zoom, k = W / span, x0 = this.cx - span / 2, z0 = this.cz - span / 2;
    c.fillStyle = '#d8c79c'; c.fillRect(0, 0, W, W); c.imageSmoothingEnabled = true;
    const sx = ((x0 + EXT / 2) / EXT) * N, sz = ((z0 + EXT / 2) / EXT) * N, sw = (span / EXT) * N;
    if (this.img) c.drawImage(this.base, sx, sz, sw, sw, 0, 0, W, W);
    // the unexplored: parchment fog
    c.save(); c.globalAlpha = 0.96; c.drawImage(this.fog, (sx / N) * FOG, (sz / N) * FOG, (sw / N) * FOG, (sw / N) * FOG, 0, 0, W, W); c.restore();
    const P = (x, z) => [(x - x0) * k, (z - z0) * k];
    for (const s of this.sites()) { if (!this.isKnown(s)) continue; const [px, py] = P(s.x, s.z); const im = iconImg(ICON[s.kind]); const done = this.done(s); c.globalAlpha = done ? 0.55 : 1; c.fillStyle = 'rgba(244,230,196,.85)'; c.beginPath(); c.arc(px, py, 13, 0, 7); c.fill(); c.strokeStyle = '#211610'; c.lineWidth = 1.5; c.stroke(); if (im.complete) c.drawImage(im, px - 10, py - 10, 20, 20);
      c.font = '600 13px Cinzel, serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(244,230,196,.9)'; const lb = LABEL[s.kind] + (done ? (s.kind === 'olive' ? ' (copied)' : ' (taken)') : ''); c.strokeText(lb, px, py + 27); c.fillStyle = '#2b1c0f'; c.fillText(lb, px, py + 27); c.globalAlpha = 1; }
    const gt = this.guideTarget; if (gt) { const [gx, gy] = P(gt.x, gt.z); c.strokeStyle = '#c9973a'; c.lineWidth = 3; c.setLineDash([6, 4]); c.beginPath(); c.arc(gx, gy, 22, 0, 7); c.stroke(); c.setLineDash([]); }
    const b = this.g.S.bed; if (b) { const [px, py] = P(b.x, b.z); this.spawnMark(c, px, py, 1); c.font = '600 12px Cinzel, serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(244,230,196,.9)'; c.strokeText('Spawn point', px, py + 24); c.fillStyle = '#7a2614'; c.fillText('Spawn point', px, py + 24); }
    const pl = this.g.player, [px, py] = P(pl.pos.x, pl.pos.z); c.save(); c.translate(px, py); c.rotate(-pl.yaw + Math.PI); c.fillStyle = '#a8401f'; c.strokeStyle = '#fff4dc'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 9); c.lineTo(0, 4); c.lineTo(-8, 9); c.closePath(); c.fill(); c.stroke(); c.restore();
    document.getElementById('mapLegend').innerHTML = `<span>${icon('you')} You</span>${b ? `<span>${icon('roof')} Spawn point</span>` : ''}<span class="dim">Wheel to zoom · drag to pan · <span class="kbd">M</span> close</span>`;
  }
  spawnMark(c, x, y, k) { const r = 11 * k, im = iconImg('roof'); c.fillStyle = '#9a3420'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = '#f4e6c4'; c.lineWidth = 2; c.stroke(); if (im.complete) { c.save(); c.filter = 'invert(1) sepia(0.4)'; c.drawImage(im, x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5); c.restore(); } }
  // ---- the minimap (bottom right): north up, 300 m across, the same painted map and fog as the big one
  drawMini() {
    const cv = this.mini, c = cv.getContext('2d'), W = cv.width, P = this.g.player.pos, span = 300, k = W / span, x0 = P.x - span / 2, z0 = P.z - span / 2;
    c.save(); c.clearRect(0, 0, W, W); c.beginPath(); c.arc(W / 2, W / 2, W / 2, 0, 7); c.clip();
    c.fillStyle = '#d4c49a'; c.fillRect(0, 0, W, W);
    const sx = ((x0 + EXT / 2) / EXT) * N, sz = ((z0 + EXT / 2) / EXT) * N, sw = (span / EXT) * N;
    if (this.img) c.drawImage(this.base, sx, sz, sw, sw, 0, 0, W, W);
    c.globalAlpha = 0.96; c.drawImage(this.fog, (sx / N) * FOG, (sz / N) * FOG, (sw / N) * FOG, (sw / N) * FOG, 0, 0, W, W); c.globalAlpha = 1;
    const at = (x, z) => [(x - x0) * k, (z - z0) * k], inside = ([x, y]) => Math.hypot(x - W / 2, y - W / 2) < W / 2 - 8;
    for (const s of this.sites()) { if (!this.isKnown(s)) continue; const q = at(s.x, s.z); if (!inside(q)) continue; const im = iconImg(ICON[s.kind]); c.globalAlpha = this.done(s) ? 0.5 : 1; c.fillStyle = 'rgba(244,230,196,.9)'; c.beginPath(); c.arc(q[0], q[1], 9, 0, 7); c.fill(); if (im.complete) c.drawImage(im, q[0] - 7, q[1] - 7, 14, 14); c.globalAlpha = 1; }
    const gt = this.guideTarget; if (gt) { const q = at(gt.x, gt.z); if (inside(q)) { c.strokeStyle = '#c9973a'; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); c.arc(q[0], q[1], 11, 0, 7); c.stroke(); c.setLineDash([]); } }
    const b = this.g.S.bed; if (b) { let q = at(b.x, b.z); if (!inside(q)) { const a = Math.atan2(q[1] - W / 2, q[0] - W / 2); q = [W / 2 + Math.cos(a) * (W / 2 - 12), W / 2 + Math.sin(a) * (W / 2 - 12)]; } this.spawnMark(c, q[0], q[1], 0.8); }   // kept on the rim when it's further away
    c.save(); c.translate(W / 2, W / 2); c.rotate(-this.g.player.yaw + Math.PI); c.fillStyle = '#a8401f'; c.strokeStyle = '#fff4dc'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -9); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath(); c.fill(); c.stroke(); c.restore();
    c.restore();
    c.fillStyle = '#211610'; c.font = '700 11px Cinzel, serif'; c.textAlign = 'center'; c.fillText('N', W / 2, 13);
  }
  update(dt) {
    const P = this.g.player.pos; this.t = (this.t || 0) - dt;
    this.mt = (this.mt || 0) - dt; if (this.mt <= 0) { this.mt = 0.125; this.drawMini(); const bn = 'Biome: ' + BIOME_NAMES[biomeAt(P.x, P.z)]; if (bn !== this.lastBiome) { this.lastBiome = bn; this.biomeEl.textContent = bn; } }
    if (this.t <= 0) { this.t = 0.5; this.uncover(P.x, P.z, SEEN_R); for (const s of this.sites()) if (!this.isKnown(s) && Math.hypot(s.x - P.x, s.z - P.z) < (s.kind === 'temple' ? 70 : 45) && (s.kind === 'olive' || s.kind === 'cave' || s.kind === 'house' || s.kind === 'temple')) { this.know(s); this.g.hud.toast(`Found: <b>${LABEL[s.kind]}</b>`); } if (this.open) this.draw(); }
    // compass: 1 px per 0.25°, cardinal points and known places
    const yaw = this.g.player.camYaw, W = this.strip.parentElement.clientWidth || 440, deg = (((yaw * 180) / Math.PI + 180) % 360 + 360) % 360, px = 2.4;
    let html = ''; const put = (bearing, label, cls) => { let d = bearing - deg; d = ((d + 540) % 360) - 180; if (Math.abs(d) > 90) return; html += `<span class="${cls}" style="left:${W / 2 - d * px}px">${label}</span>`; };
    [['N', 180], ['E', 90], ['S', 0], ['W', 270]].forEach(([l, b]) => put(b, l, 'card')); [45, 135, 225, 315].forEach((b) => put(b, '·', 'mid'));
    for (const s of this.sites()) if (this.isKnown(s) && !this.done(s)) { const b = ((Math.atan2(s.x - P.x, s.z - P.z) * 180) / Math.PI + 360) % 360, dist = Math.hypot(s.x - P.x, s.z - P.z); if (dist > 15) put(b, `${icon(ICON[s.kind])}<small>${dist > 999 ? (dist / 1000).toFixed(1) + 'km' : Math.round(dist) + 'm'}</small>`, 'poi'); }
    const sp = this.g.S.bed; if (sp) { const b = ((Math.atan2(sp.x - P.x, sp.z - P.z) * 180) / Math.PI + 360) % 360, dist = Math.hypot(sp.x - P.x, sp.z - P.z); if (dist > 8) put(b, `${icon('roof')}<small>${dist > 999 ? (dist / 1000).toFixed(1) + 'km' : Math.round(dist) + 'm'}</small>`, 'poi spawn'); }
    const gt = this.guideTarget; if (gt) { const b = ((Math.atan2(gt.x - P.x, gt.z - P.z) * 180) / Math.PI + 360) % 360, dist = Math.hypot(gt.x - P.x, gt.z - P.z); if (dist > 6) put(b, `${icon('goal')}<small>${dist > 999 ? (dist / 1000).toFixed(1) + 'km' : Math.round(dist) + 'm'}</small>`, 'poi guide'); }
    if (html !== this.lastC) { this.lastC = html; this.strip.innerHTML = html; }
  }
  toJSON() { return { known: this.st.known, fog: this.fog.toDataURL() }; }
}
