// The asset browser and sandbox (dev/index.html, http://localhost:8000/dev/): every model in the team's packs, sorted by
// kind, shown as the game shows it at its true size beside the hero (Browse), and an empty field to put little scenes
// together and export them as JSON (Build). Developer-only: it reads the git-ignored pack exports and touches nothing of
// the game's.
import * as THREE from 'three';
import { camera, scene, render, aimSun, followGrid, grid, fitView, freeAspect, CUT } from './look.js';
import { View, Labels, typing } from './view.js';
import { loadCatalogue, test, filter, sizeText } from './catalogue.js';
import { Gallery } from './gallery.js';
import { Sandbox } from './sandbox.js';

const $ = (s) => document.querySelector(s), PAGE = 150, ROW_H = 22;
const UI_KEY = 'argonisos.dev.ui';
const remember = { get() { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}'); } catch { return {}; } }, set(v) { try { localStorage.setItem(UI_KEY, JSON.stringify(v)); } catch { /* no storage: the page starts fresh next time */ } } };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => { t.style.display = 'none'; }, 1800); };
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); return true; } catch { /* (no clipboard permission: select and copy instead) */ }
  const ta = document.createElement('textarea'); ta.value = s; document.body.append(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { /* nothing more to try */ } ta.remove(); return ok;
}

const layer = (name) => { const d = document.createElement('div'); d.className = 'labels'; d.dataset.for = name; document.body.append(d); return d; };
const view = new View(camera, document.querySelector('canvas')); view.aspect = freeAspect;
fitView($('#side').getBoundingClientRect().right);
const labels = { browse: new Labels(layer('browse'), camera), build: new Labels(layer('build'), camera) };
const S = Object.assign({ tab: 'browse', f: { q: '', pack: '', inGame: false, noSnow: false, kind: '', sub: '' }, page: 0, open: {}, snap: 0, cams: {} }, remember.get());
const save = () => remember.set({ tab: S.tab, f: S.f, page: S.page, open: S.open, snap: S.snap, cams: S.cams });

const cat = await loadCatalogue(); Object.assign(CUT, cat?.cutout);
const gallery = new Gallery(scene, labels.browse), sandbox = new Sandbox(scene, view, cat, labels.build);
let list = [], selected = null, hovered = null;   // (selected: { item, entry } in Browse, { item, placed } in Build)

// ---- the sidebar: filters, the kind tree, the pages and the list
function refilter(resetPage = true) {
  if (!cat) return;
  list = filter(cat.items, S.f); if (resetPage) S.page = 0; S.page = Math.min(S.page, Math.max(0, Math.ceil(list.length / PAGE) - 1));
  tree(); listView(); if (S.tab === 'browse') showPage(); save();
}
function tree() {
  const counts = new Map(); let all = 0;
  for (const it of cat.items) if (test(it, S.f, false)) { all++; counts.set(it.kind, (counts.get(it.kind) || 0) + 1); counts.set(it.kind + '|' + it.sub, (counts.get(it.kind + '|' + it.sub) || 0) + 1); }
  const node = (cls, label, n, data, sel, tw = '') => `<div class="node ${cls}${sel ? ' sel' : ''}${n ? '' : ' none'}" ${data}>${tw ? `<span><span class="tw">${tw}</span>${esc(label)}</span>` : `<span>${esc(label)}</span>`}<span class="n">${n}</span></div>`;
  let h = node('kind', 'All kinds', all, 'data-kind=""', !S.f.kind, '·');
  for (const [k, subs] of Object.entries(cat.kinds)) {
    const open = S.open[k] || S.f.kind === k;
    h += node('kind', k, counts.get(k) || 0, `data-kind="${esc(k)}"`, S.f.kind === k && !S.f.sub, open ? '▾' : '▸');
    if (open) for (const s of subs) h += node('sub', s, counts.get(k + '|' + s) || 0, `data-kind="${esc(k)}" data-sub="${esc(s)}"`, S.f.kind === k && S.f.sub === s);
  }
  $('#tree').innerHTML = h; $('#tree .node.sel')?.scrollIntoView({ block: 'nearest' });
}
$('#tree').addEventListener('click', (e) => {
  const n = e.target.closest('.node'); if (!n) return; const k = n.dataset.kind, s = n.dataset.sub || '';
  if (e.target.classList.contains('tw') && k) { S.open[k] = !(S.open[k] || S.f.kind === k); if (S.f.kind === k && !S.open[k]) S.open[k] = false; tree(); save(); return; }   // (the arrow only opens or closes)
  if (k && !s && S.f.kind !== k) S.open = {};   // (choosing another kind folds the rest away; the arrows open several)
  S.f.kind = k; S.f.sub = s; if (k) S.open[k] = true; refilter();
});
// the list: only the rows in sight are in the page, so ~5,000 entries cost no more than thirty
function listView() {
  $('#listCount').textContent = `${list.length.toLocaleString()} model${list.length === 1 ? '' : 's'}`;
  $('#listHint').textContent = S.tab === 'browse' ? 'click to show' : 'click to place';
  $('#listIn').style.height = list.length * ROW_H + 'px'; drawList();
}
function drawList() {
  const box = $('#list'), top = box.scrollTop, from = Math.max(0, Math.floor(top / ROW_H) - 4), to = Math.min(list.length, Math.ceil((top + box.clientHeight) / ROW_H) + 4);
  const pageFrom = S.page * PAGE, sel = selected?.item;
  let h = ''; for (let i = from; i < to; i++) { const it = list[i], here = S.tab === 'browse' && i >= pageFrom && i < pageFrom + PAGE;
    h += `<div class="row${it === sel ? ' sel' : ''}${here ? ' here' : ''}" data-i="${i}" style="top:${i * ROW_H}px" title="${esc(it.id)}"><span class="nm">${esc(it.name)}</span><span class="sz">${it.big.toFixed(it.big >= 10 ? 0 : 1)} m</span></div>`; }
  $('#listIn').innerHTML = h;
}
$('#list').addEventListener('scroll', drawList);
$('#list').addEventListener('click', (e) => {
  const r = e.target.closest('.row'); if (!r) return; const i = +r.dataset.i, it = list[i];
  if (S.tab === 'build') { sandbox.place(it); selectItem({ item: it }); return; }
  const p = Math.floor(i / PAGE); if (p !== S.page) { S.page = p; showPage(); save(); }
  const e2 = gallery.find(it.id); if (e2) { selectItem({ item: it, entry: e2 }); view.frame(gallery.boxOf(e2)); }
});
const pageCount = () => Math.max(1, Math.ceil(list.length / PAGE));
function showPage() {
  const from = S.page * PAGE, items = list.slice(from, from + PAGE);
  gallery.show(items); hover(null); if (selected?.entry) selectItem(null);
  $('#pageText').textContent = list.length ? `${from + 1}–${from + items.length} of ${list.length.toLocaleString()}` : 'nothing matches';
  $('#prev').disabled = S.page === 0; $('#next').disabled = S.page >= pageCount() - 1; drawList();
  if (S.restoreCam) S.restoreCam = false; else if (gallery.rows.length) { const b = gallery.rows[0].box.clone(); b.max.x = Math.min(b.max.x, Math.max(14, b.min.x + gallery.rows[0].box.getSize(new THREE.Vector3()).y * 3)); view.frame(b, { pitch: 0.42, yaw: 0.25 }); }   // (the start of the page's first row, near enough to read)
}
const turnPage = (d) => { const p = THREE.MathUtils.clamp(S.page + d, 0, pageCount() - 1); if (p === S.page) return; S.page = p; showPage(); save(); };
$('#prev').onclick = () => turnPage(-1); $('#next').onclick = () => turnPage(1);
let typingT = null;
$('#q').addEventListener('input', () => { clearTimeout(typingT); typingT = setTimeout(() => { S.f.q = $('#q').value.trim(); refilter(); }, 180); });
$('#pack').addEventListener('change', () => { S.f.pack = $('#pack').value; refilter(); });
$('#inGame').addEventListener('change', () => { S.f.inGame = $('#inGame').checked; refilter(); });
$('#noSnow').addEventListener('change', () => { S.f.noSnow = $('#noSnow').checked; refilter(); });

// ---- the info panel: what a model is, and the id to quote back
function selectItem(sel) {
  selected = sel; const box = $('#info');
  gallery.selBox.visible = !!sel?.entry; if (sel?.entry) gallery.selBox.box.copy(gallery.boxOf(sel.entry));
  if (!sel?.item && !sel?.placed) { box.classList.remove('open'); drawList(); return; }
  const it = sel.item, P = sel.placed, e = sel.entry;
  const badges = (it?.inGame ? '<span class="badge game">in the game</span>' : '') + (it?.rigged ? '<span class="badge rig">rigged</span>' : '') + (e?.state === 'fail' || P?.missing ? '<span class="badge bad">failed to load</span>' : '');
  const id = it?.id || P?.id;
  let h = `<button class="x" title="Close (Esc)">×</button><h2>${esc(it?.name || P.id)}</h2>`;
  if (it) h += `<div class="where">${esc(it.kind)} › ${esc(it.sub)}</div>${badges ? `<div>${badges}</div>` : ''}
    <dl><dt>Pack</dt><dd>${esc(it.pack)}</dd><dt>Size</dt><dd>${sizeText(it.size)}<br><span style="color:var(--dim)">across × up × deep</span></dd><dt>Triangles</dt><dd>${it.tris.toLocaleString()}</dd>
    <dt>Textures</dt><dd>${it.tex?.length ? it.tex.map(esc).join('<br>') : '<span style="color:var(--dim)">none (colours only)</span>'}</dd><dt>Source</dt><dd>${esc(it.file)}</dd></dl>`;
  else h += `<div class="where">not in the catalogue on this machine</div>`;
  if (P) h += `<dl><dt>Placed at</dt><dd>${P.x.toFixed(2)}, ${P.y.toFixed(2)}, ${P.z.toFixed(2)} m</dd><dt>Turned</dt><dd>${(P.rotY * 180 / Math.PI).toFixed(1)}°</dd><dt>Scale</dt><dd>${P.scale.toFixed(3)}</dd></dl>`;
  h += `<div class="id"><code>${esc(id)}</code><button data-act="copy">Copy</button></div><div class="acts">`;
  h += `<button data-act="frame" title="F, or double-click">Frame</button>`;
  if (it && S.tab === 'browse') h += `<button data-act="place" title="Place it on the Build field">Place in Build</button>`;
  if (it && S.tab === 'build') h += `<button data-act="place">Place another</button>`;
  if (P) h += `<button data-act="dup" title="Ctrl+D">Duplicate</button><button data-act="del" title="Delete">Delete</button>`;
  h += `<button data-act="name" title="Copy the model's name">Copy name</button></div>`;
  box.innerHTML = h; box.classList.add('open'); box.dataset.id = id; drawList();
}
$('#info').addEventListener('click', async (e) => {
  if (e.target.classList.contains('x')) { if (S.tab === 'build') sandbox.select(null); else selectItem(null); return; }
  const a = e.target.dataset.act; if (!a || !selected) return; const it = selected.item;
  if (a === 'copy') toast(await copyText($('#info').dataset.id) ? 'Copied the id' : 'Could not copy');
  if (a === 'name') toast(await copyText(it?.name || selected.placed?.id) ? 'Copied the name' : 'Could not copy');
  if (a === 'frame') frameSelected();
  if (a === 'place') { if (S.tab !== 'build') setTab('build'); sandbox.place(it); }
  if (a === 'dup') sandbox.key({ code: 'KeyD', ctrlKey: true });
  if (a === 'del') sandbox.key({ code: 'Delete' });
});
function frameSelected() {
  if (S.tab === 'build') { if (sandbox.sel) view.frame(sandbox.boxOf(sandbox.sel)); else { const b = new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1)); for (const it of sandbox.items) b.union(sandbox.boxOf(it)); view.frame(b); } return; }   // (nothing selected: the whole scene)
  if (selected?.entry) view.frame(gallery.boxOf(selected.entry));
  else if (gallery.rows.length) { const b = new THREE.Box3(); for (const r of gallery.rows) b.union(r.box); view.frame(b); }
}

// ---- hover and the tooltip
const tip = $('#tip'); let mouse = null;
gallery.hoverBox = new THREE.Box3Helper(new THREE.Box3(), 0xffffff); gallery.selBox = new THREE.Box3Helper(new THREE.Box3(), 0xffc861);
for (const h of [gallery.hoverBox, gallery.selBox]) { h.material.depthTest = false; h.material.transparent = true; h.renderOrder = 5; h.visible = false; scene.add(h); }
function hover(e) {
  hovered = e; gallery.hoverBox.visible = !!e && e !== selected?.entry; if (e) gallery.hoverBox.box.copy(gallery.boxOf(e));
  if (!e || !mouse) { tip.style.display = 'none'; return; }
  const it = e.item; tip.innerHTML = `<div class="t">${esc(it.name)}</div><div class="s">${esc(it.sub)} · ${sizeText(it.size)}${it.inGame ? ' · in the game' : ''}${e.state === 'fail' ? ' · failed to load' : e.state !== 'ok' ? ' · loading…' : ''}</div>`;
  tip.style.display = 'block'; const w = tip.offsetWidth; tip.style.left = Math.min(mouse.x + 14, innerWidth - w - 8) + 'px'; tip.style.top = (mouse.y + 16) + 'px';
}
const canvas = view.dom;
canvas.addEventListener('pointermove', (e) => { mouse = { x: e.clientX, y: e.clientY }; if (S.tab === 'build') sandbox.pointerMove(e); });
canvas.addEventListener('pointerup', (e) => sandbox.pointerUp(e));
canvas.addEventListener('pointerleave', () => { mouse = null; hover(null); });
view.claim = (e) => S.tab === 'build' && sandbox.claim(e);
view.onClick = (e) => {
  if (S.tab === 'build') { sandbox.click(e); return; }
  const hit = gallery.pick(view.ray(e.clientX, e.clientY)); selectItem(hit ? { item: hit.item, entry: hit } : null); hover(hovered);
};
view.onDouble = (e) => {
  if (S.tab === 'build') { const it = sandbox.hit(e); if (it) view.frame(sandbox.boxOf(it)); return; }
  const hit = gallery.pick(view.ray(e.clientX, e.clientY)); if (hit) { selectItem({ item: hit.item, entry: hit }); view.frame(gallery.boxOf(hit)); }
};
sandbox.onSelect = (P) => { if (S.tab === 'build') selectItem(P ? { item: P.item, placed: P } : null); };
sandbox.onChange = () => {
  $('#count').textContent = `${sandbox.items.length} placed`; $('#undo').disabled = !sandbox.undos.length; $('#redo').disabled = !sandbox.redos.length; hints();
  if (S.tab === 'build' && selected?.placed) selectItem(selected);
};
gallery.onLoad = (e) => { if (e === selected?.entry) gallery.selBox.box.copy(gallery.boxOf(e)); if (e === hovered) hover(e); };

// ---- Build's bar: snapping, undo, export and import
const snapButtons = () => document.querySelectorAll('#bar [data-snap]').forEach((b) => b.classList.toggle('on', +b.dataset.snap === sandbox.snap));
document.querySelectorAll('#bar [data-snap]').forEach((b) => { b.onclick = () => { sandbox.snap = S.snap = +b.dataset.snap; snapButtons(); save(); }; });
$('#undo').onclick = () => sandbox.undo(); $('#redo').onclick = () => sandbox.redo();
$('#download').onclick = () => {
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob([JSON.stringify(sandbox.toJSON(), null, 1)], { type: 'application/json' }));
  a.href = url; a.download = `argonisos-scene-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Downloaded the scene');
};
$('#copy').onclick = async () => toast(await copyText(JSON.stringify(sandbox.toJSON())) ? `Copied ${sandbox.items.length} models as JSON` : 'Could not copy');
$('#import').onclick = () => $('#file').click();
$('#file').onchange = async () => {
  const f = $('#file').files[0]; if (!f) return; $('#file').value = '';
  try { const n = sandbox.load(await f.text()); toast(`Imported ${n} models`); } catch (err) { toast('Import failed: ' + err.message); }
};
$('#clear').onclick = () => { if (sandbox.items.length && confirm(`Clear all ${sandbox.items.length} placed models? (Undo brings them back.)`)) sandbox.clear(); };

// ---- tabs, keys and hints
function setTab(t, first = false) {
  if (!first) S.cams[S.tab] = { t: view.target.toArray(), d: view.dist, y: view.yaw, p: view.pitch };
  S.tab = t; document.body.classList.toggle('build', t === 'build'); document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  const browse = t === 'browse'; gallery.root.visible = browse; labels.browse.layer.style.display = browse ? '' : 'none'; sandbox.setActive(!browse);
  gallery.hoverBox.visible = gallery.selBox.visible = false; hover(null); selectItem(null); if (!browse) sandbox.select(null);
  $('#bar').classList.toggle('open', !browse); $('#pager').style.display = browse ? '' : 'none';
  const c = S.cams[t]; if (c) view.set(new THREE.Vector3().fromArray(c.t), c.d, c.y, c.p); else if (!browse) view.set(new THREE.Vector3(0, 1, -2), 16, 0.35, 0.45);
  listView(); hints(); save();
}
document.querySelectorAll('.tabs button').forEach((b) => { b.onclick = () => setTab(b.dataset.tab); });
function hints() {
  const H = (k, w) => `<b>${k}</b> ${w}`, common = [H('drag', 'turn'), H('right drag', 'pan'), H('wheel', 'zoom'), H('WASD', 'move'), H('F', 'frame'), H('G', 'grid')];
  $('#hints').innerHTML = (S.tab === 'browse' ? [...common, H('click', 'info'), H('PgUp/PgDn', 'pages')]
    : sandbox.ghost ? [H('click', 'place'), H('Shift+click', 'place and keep going'), H('R / Shift+R', 'turn 15°'), H('[ ]', 'scale'), H('Alt', 'fine'), H('Esc', 'stop'), H('right drag', 'pan'), H('wheel', 'zoom')]
      : [...common.slice(0, 4), H('click', 'select'), H('drag model', 'move'), H('R / Shift+R', 'turn'), H('[ ]', 'scale'), H('Q / E', 'down / up'), H('End', 'to the ground'), H('Del', 'remove'), H('Ctrl+D', 'copy'), H('Ctrl+Z', 'undo')]).join(' · ');
}
addEventListener('keydown', (e) => {
  if (e.code === 'Slash' && !typing(e)) { e.preventDefault(); $('#q').focus(); $('#q').select(); return; }
  if (typing(e)) { if (e.code === 'Escape') e.target.blur(); return; }
  if (S.tab === 'build' && sandbox.key(e)) { e.preventDefault(); hints(); return; }
  if (e.ctrlKey || e.metaKey) return;
  if (e.code === 'KeyF') frameSelected();
  else if (e.code === 'KeyG') grid.visible = !grid.visible;
  else if (e.code === 'Escape') selectItem(null);
  else if (S.tab === 'browse' && e.code === 'PageDown') { e.preventDefault(); turnPage(1); }
  else if (S.tab === 'browse' && e.code === 'PageUp') { e.preventDefault(); turnPage(-1); }
});
addEventListener('beforeunload', () => { S.cams[S.tab] = { t: view.target.toArray(), d: view.dist, y: view.yaw, p: view.pitch }; save(); });

// ---- start
if (!cat) { $('#missing').style.display = 'flex'; $('#total').textContent = 'no catalogue'; }
else {
  $('#total').textContent = `${cat.items.length.toLocaleString()} models`;
  const packs = new Map(); for (const it of cat.items) packs.set(it.pack, (packs.get(it.pack) || 0) + 1);
  $('#pack').innerHTML = `<option value="">All packs</option>` + [...packs].sort((a, b) => a[0].localeCompare(b[0])).map(([p, n]) => `<option value="${esc(p)}">${esc(p.replace(/^Synty\//, ''))} (${n})</option>`).join('');
  if (!packs.has(S.f.pack)) S.f.pack = '';
  $('#q').value = S.f.q; $('#pack').value = S.f.pack; $('#inGame').checked = S.f.inGame; $('#noSnow').checked = S.f.noSnow;
}
sandbox.snap = S.snap; snapButtons(); sandbox.onChange();
S.restoreCam = !!S.cams[S.tab] && S.tab === 'browse';   // (back where you were, not framed afresh)
if (cat) refilter(false);
setTab(S.tab, true);

// ---- the frame
const clock = new THREE.Clock(), near = new THREE.Vector3();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1); view.update(dt); aimSun(view.target, view.dist); followGrid(view.target);
  if (S.tab === 'browse') {
    near.copy(view.target); gallery.update(near);
    if (mouse && !view.drag) { const e = gallery.pick(view.ray(mouse.x, mouse.y)); if (e !== hovered) hover(e); else if (e) hover(e); }
    else if (view.drag?.moved && hovered) hover(null);
    labels.browse.update();
  } else { sandbox.update(); labels.build.update(); }
  render(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// (for the page's own checks in headless Chrome, and a console to poke at)
window.DEV = { THREE, view, gallery, sandbox, cat, get list() { return list; }, get selected() { return selected; }, setTab, selectItem, state: S };
