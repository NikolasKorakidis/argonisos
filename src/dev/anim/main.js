// The animation viewer (dev/anims.html, http://localhost:8000/dev/anims.html): every clip a subject has (the hero for
// now; the animals next), on a stage with steps and slopes, to be played, stopped, scrubbed and stepped a frame at a time,
// blended from one to the next, walked through the game's own blending (Walk), looked at bone by bone (Rig), flagged
// where something's wrong (Notes) and checked by machine for sliding feet, limbs through the ground and broken tracks
// (Check). Developer-only, like the asset browser beside it: it touches nothing of the game's.
import * as THREE from 'three';
import { camera, scene, render, renderer, aimSun, followGrid, grid, fitView } from '../look.js';
import { View, Labels, typing } from '../view.js';
import { FootIK } from '../../player/footik.js';
import { buildStage, groundAt, topAt, STEP_UP } from './stage.js';
import { SUBJECTS } from './subjects.js';
import { ClipPlayer } from './clip.js';
import { Rig } from './rig.js';
import { Timeline } from './timeline.js';
import { analyse, LIMITS } from './check.js';
import { samplerOf } from './pose.js';
import { notes } from './notes.js';

const $ = (s) => document.querySelector(s), DEG = 180 / Math.PI;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => { t.style.display = 'none'; }, 2000); };
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); return true; } catch { /* (no clipboard permission: select and copy instead) */ }
  const ta = document.createElement('textarea'); ta.value = s; document.body.append(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { /* nothing more to try */ } ta.remove(); return ok;
}
const KEY = 'argonisos.dev.anims';
const S = Object.assign({ subject: 'hero', mode: 'clips', clip: 'walk', speed: 1, loop: true, travel: 'place', blend: 0.25, upper: 'auto', ik: false, pane: 'rig', q: '', notesAll: false,
  rig: { skeleton: false, axes: false, body: 'solid', wire: false, contacts: true, path: true }, limits: { slideCm: LIMITS.slideCm, jumpDeg: LIMITS.jumpDeg, belowCm: LIMITS.belowCm }, sounds: true }, (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } })());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* the page starts fresh next time */ } };

// ---- the stage and the camera, its picture centred on the part of the window the panels leave free (a view offset, as
// look.js fitView does for the asset browser's one panel, here for three)
function fitFree() {
  fitView(0); const W = innerWidth, H = innerHeight, l = $('#side').getBoundingClientRect().right, r = $('#right').getBoundingClientRect().left, b = $('#transport').getBoundingClientRect().top;
  const dx = Math.round((l + r) / 2 - W / 2), dy = Math.round(b / 2 - H / 2), fw = W + 2 * Math.abs(dx), fh = H + 2 * Math.abs(dy);
  camera.aspect = fw / fh; camera.setViewOffset(fw, fh, dx < 0 ? 2 * -dx : 0, dy < 0 ? 2 * -dy : 0, W, H); camera.updateProjectionMatrix();
}
addEventListener('resize', fitFree); fitFree();
const view = new View(camera, renderer.domElement); view.set(new THREE.Vector3(0, 1, 0), 4.6, 0.62, 0.22);
buildStage(scene);
const layer = document.createElement('div'); layer.className = 'labels'; document.body.append(layer);
const labels = new Labels(layer, camera), rig = new Rig(scene, labels);
const stage = { groundAt, topAt, STEP_UP };
const status = (s, bad = false) => { $('#status').innerHTML = s; $('#status').classList.toggle('bad', bad); };

// ---- the subject picker (the hero only, for now)
$('#subjects').innerHTML = SUBJECTS.map((s) => `<button data-sub="${s.id}"${s.make ? '' : ' disabled title="Coming soon"'} class="${s.id === S.subject ? 'on' : ''}">${esc(s.name)}${s.make ? '' : '<small>soon</small>'}</button>`).join('');
const pick = SUBJECTS.find((s) => s.id === S.subject && s.make) || SUBJECTS[0];
const sub = pick.make(scene);
await sub.load((s) => status(s));
if (sub.problems.length) status(sub.problems.map((p) => '⚠ ' + esc(p)).join('<br>'), true); else status('');
if (!sub.clips.length) { $('#missing').style.display = 'flex'; $('#missingWhat').innerHTML = sub.problems.map((p) => `<li>${esc(p)}</li>`).join(''); }
const player = new ClipPlayer(sub); Object.assign(player, { speed: S.speed, loop: S.loop, blend: S.blend });
const byName = new Map(sub.clips.map((E) => [E.name, E]));
let E = null, quick = null, ik = null, spot = { x: 0, z: 0, yaw: 0 }, clipY = 0, results = new Map();
rig.attach(sub); for (const [k, v] of Object.entries(S.rig)) rig.opt[k] = v; rig.apply();

// ---- the look and gear (the subject's own panel)
if (S.gear && sub.gear) { Object.assign(sub.gear, S.gear); for (const k of Object.keys(S.gear)) if (S.gear[k]) await sub.dress(k); }   // (what he held and wore last time)
sub.panel($('#dress'));
sub.onRebind = (why) => { if (why === 'gear' && sub.gear) { S.gear = { ...sub.gear }; save(); } if (why === 'body') { rig.attach(sub); ik = null; results.clear(); boneTree(); } else rig.refresh(); if (why !== 'look') results.clear(); if (E) clipData(); };

// ---- the clip list
function clipList() {
  const q = S.q.toLowerCase(), n = (E2) => notes.of(sub.id, E2.name).length, r = (E2) => results.get(E2.name);
  let h = '';
  for (const [g, list] of sub.groups) {
    const shown = list.filter((x) => !q || `${x.name} ${x.mixamo} ${x.file} ${g}`.toLowerCase().includes(q)); if (!shown.length) continue;
    h += `<div class="g"><div class="grp">${esc(g)} <span>${shown.length}</span></div>`;   // (each group in a box of its own: its heading sticks only while it's in view)
    for (const x of shown) {
      const R = r(x), errs = R?.issues.filter((i) => i.sev === 'err').length, warns = R?.issues.filter((i) => i.sev === 'warn').length;
      h += `<div class="clip${x === E ? ' sel' : ''}" data-clip="${esc(x.name)}" title="${esc(x.mixamo ? `Mixamo: ${x.mixamo} · ` : '')}${esc(x.file)}"><span class="nm">${esc(x.name)}</span>`
        + `${x.loop ? '<span class="tag">loop</span>' : ''}${x.root ? '<span class="tag">travel</span>' : ''}${n(x) ? `<span class="tag note">${n(x)} ✎</span>` : ''}`
        + `${R ? (errs ? `<span class="tag err">${errs}</span>` : '') + (warns ? `<span class="tag warn">${warns}</span>` : '') + (!errs && !warns ? '<span class="tag ok">ok</span>' : '') : ''}<span class="dur">${x.C.dur.toFixed(2)} s</span></div>`;
    }
    h += '</div>';
  }
  $('#clips').innerHTML = h || '<div class="empty">No clips match.</div>'; $('#clips .clip.sel')?.scrollIntoView({ block: 'nearest' });
}
$('#clips').addEventListener('click', (e) => { const c = e.target.closest('.clip'); if (c) choose(byName.get(c.dataset.clip)); });
$('#q').value = S.q; $('#q').addEventListener('input', () => { S.q = $('#q').value.trim(); clipList(); save(); });

// A clip chosen: played on the stage (Clips), or as the game's action over the walk (Walk)
function choose(E2, { at } = {}) {
  if (!E2) return;
  if (S.mode === 'walk') {
    sub.action(E2, { upper: S.upper === 'auto' ? 'auto' : S.upper === 'upper', loop: S.loop, root: S.travel === 'root' ? 'move' : undefined, blend: S.blend, rate: S.speed });
    toast(`hero.action('${E2.name}')`);
  }
  if (E2 !== E) { E = E2; player.play(E); clipData(); } else if (at === undefined && S.mode === 'clips') player.play(E);
  if (at !== undefined) { player.playing = false; player.seekFrame(at); }
  S.clip = E.name; save(); clipList(); notesList(); boneInfo(true);
}
// what the scrub bar shows for the clip: its feet, the footfalls, the notes, what the checks found
function clipData() {
  try { quick = analyse(sub, E, { limits: S.limits }); } catch (err) { console.warn('analysis failed', err); quick = null; }
  timeline.set({ frames: player.frames, contacts: quick?.contacts, falls: sub.footfalls?.(E) || [], notes: notes.of(sub.id, E.name).map((n) => n.frame), issues: (results.get(E.name) || quick)?.issues || [] });
  $('#clipName').textContent = E.name; $('#clipFrom').textContent = `${E.file}${E.mixamo ? ' · Mixamo “' + E.mixamo + '”' : ''} · ${quick?.info || ''}`;
  pathLine(); rig.clearTrails();
}
function pathLine() {
  const { pts, ticks } = player.path(spot.yaw), y = groundAt(spot.x, spot.z, clipY + 0.3) + 0.02;
  const place = (v) => { v.x += spot.x; v.z += spot.z; v.y = groundAt(v.x, v.z, y + 0.3) + 0.02; return v; };
  rig.setPath(pts.map(place), ticks.map(place));
}

// ---- the transport: play, step, scrub, speed, loop, travel, blend
const timeline = new Timeline($('#timeline'), (f, dragging) => { if (f === null) return; player.playing = false; player.seekFrame(Math.round(f * (player.frames - 1))); if (dragging) rig.clearTrails(); });
const sync = () => {
  $('#play').textContent = player.playing ? '❚❚' : '▶'; $('#loop').classList.toggle('on', S.loop);
  for (const b of document.querySelectorAll('[data-travel]')) b.classList.toggle('on', b.dataset.travel === S.travel);
  $('#speed').value = S.speed; $('#speedV').textContent = S.speed.toFixed(2) + '×'; $('#blend').value = S.blend; $('#blendV').textContent = S.blend.toFixed(2) + ' s';
  $('#upper').value = S.upper; $('#ik').checked = S.ik;
};
$('#play').onclick = () => { player.toggle(); sync(); };
$('#back').onclick = () => { player.step(-1); sync(); }; $('#fwd').onclick = () => { player.step(1); sync(); };
$('#start').onclick = () => { player.seek(0); rig.clearTrails(); sync(); }; $('#end').onclick = () => { player.playing = false; player.seek(player.dur); sync(); };
$('#loop').onclick = () => { S.loop = player.loop = !S.loop; sync(); save(); };
$('#speed').oninput = () => { S.speed = player.speed = +$('#speed').value; sync(); save(); };
$('#blend').oninput = () => { S.blend = player.blend = +$('#blend').value; sync(); save(); };
$('#upper').onchange = () => { S.upper = $('#upper').value; save(); };
$('#stopActs').onclick = () => sub.hero?.stopActions(0.2);
document.querySelectorAll('[data-travel]').forEach((b) => { b.onclick = () => { S.travel = b.dataset.travel; player.loops = 0; rig.clearTrails(); sync(); save(); }; });
$('#home').onclick = () => { spot = { x: 0, z: 0, yaw: 0 }; clipY = 0; if (S.mode === 'walk') { sub.root.position.set(0, 0, 0); sub.w.yaw = 0; } pathLine(); rig.clearTrails(); view.set(new THREE.Vector3(0, 1, 0), 4.6, 0.62, 0.22); };

// ---- modes
function setMode(m) {
  if (m === S.mode && setMode.done) return;
  if (setMode.done && S.mode === 'walk' && m === 'clips') { sub.walkEnd(); spot = { x: sub.root.position.x, z: sub.root.position.z, yaw: sub.w.yaw }; clipY = sub.root.position.y; pathLine(); }
  if (m === 'walk') { if (!sub.walk) return toast(`${sub.name} can't walk yet`); sub.root.position.set(spot.x, clipY, spot.z); sub.root.rotation.set(0, spot.yaw, 0); sub.walkBegin(); view.set(sub.root.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 5.5, spot.yaw + Math.PI, 0.25); }
  S.mode = m; setMode.done = true; document.body.dataset.mode = m;
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m)); rig.clearTrails(); hints(); fitFree(); save();
}
document.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });
function hints() {
  const H = (k, w) => `<b>${k}</b> ${w}`;
  $('#hints').innerHTML = (S.mode === 'walk'
    ? [H('WASD', 'walk'), H('Shift', 'sprint'), H('Ctrl / C', 'sneak'), H('Space', 'jump (roll with the guard up)'), H('click', 'strike / loose'), H('hold RMB', 'block / draw'), H('drag', 'turn the camera'), H('wheel', 'zoom'), H('a clip', 'plays as hero.action')]
    : [H('Space', 'play'), H('← →', 'frame (Shift ×10)'), H('Home', 'start'), H('N', 'note'), H('L', 'loop'), H('R', 'travel'), H('K', 'skeleton'), H('F', 'frame him'), H('drag', 'turn'), H('right drag', 'pan'), H('click a joint', 'select it')]).join(' · ');
}

// ---- the rig pane
const rigChecks = [['skeleton', 'Skeleton'], ['axes', 'Bone axes'], ['contacts', 'Foot contacts'], ['path', 'Root path and hips trail'], ['wire', 'Wireframe']];
$('#rigOpts').innerHTML = rigChecks.map(([k, n]) => `<label><input type="checkbox" data-rig="${k}"${S.rig[k] ? ' checked' : ''}> ${n}</label>`).join('')
  + `<label title="The game's foot IK (footik.js) on the steps and slopes, in Clips too"><input type="checkbox" id="ik"${S.ik ? ' checked' : ''}> Foot IK in Clips</label>`;
$('#ik').onchange = () => { S.ik = $('#ik').checked; ik = null; save(); };
$('#rigOpts').addEventListener('change', (e) => { const k = e.target.dataset.rig; if (!k) return; S.rig[k] = e.target.checked; rig.set(k, e.target.checked); save(); });
document.querySelectorAll('[data-body]').forEach((b) => { b.onclick = () => { S.rig.body = b.dataset.body; rig.set('body', S.rig.body); bodyButtons(); save(); }; });
const bodyButtons = () => document.querySelectorAll('[data-body]').forEach((b) => b.classList.toggle('on', b.dataset.body === S.rig.body));
function boneTree() {
  const out = [], top = Object.values(sub.bones).filter((b) => !b.parent?.isBone);
  const walk = (b, d) => { out.push(`<div class="bone${b === rig.sel ? ' sel' : ''}" data-bone="${esc(b.name)}" style="padding-left:${4 + d * 9}px">${esc(b.name.replace('mixamorig', ''))}</div>`); for (const c of b.children) if (c.isBone) walk(c, d + 1); };
  for (const b of top) walk(b, 0); $('#bones').innerHTML = out.join('');
}
$('#bones').addEventListener('click', (e) => { const r = e.target.closest('.bone'); if (!r) return; selectBone(sub.bones[r.dataset.bone]); });
function selectBone(b) {
  rig.select(rig.sel === b ? null : b); document.querySelectorAll('#bones .bone').forEach((r) => r.classList.toggle('sel', r.dataset.bone === rig.sel?.name));
  $('#bones .bone.sel')?.scrollIntoView({ block: 'nearest' }); boneInfo(true);
  if (rig.sel && !S.rig.skeleton) { S.rig.skeleton = true; rig.set('skeleton', true); $('[data-rig=skeleton]').checked = true; save(); }
}
const _e = new THREE.Euler(), _p = new THREE.Vector3();
function boneInfo(force) {
  const b = rig.sel, el = $('#boneInfo');
  if (!b) { if (force) el.innerHTML = '<span class="dim">Pick a bone below, or click a joint on the skeleton.</span>'; return; }
  _e.setFromQuaternion(b.quaternion, 'XYZ'); const rest = sub.rest.get(b), off = rest ? b.quaternion.angleTo(rest.q) * DEG : 0; b.getWorldPosition(_p);
  const tracked = E && samplerOf(sub, E).some((s) => s.bone === b);
  el.innerHTML = `<b>${esc(b.name)}</b><span class="dim"> ← ${esc(b.parent?.name || '')}</span><dl>
    <dt>Rotation</dt><dd>x ${(_e.x * DEG).toFixed(1)}°, y ${(_e.y * DEG).toFixed(1)}°, z ${(_e.z * DEG).toFixed(1)}°</dd>
    <dt>Quaternion</dt><dd>${b.quaternion.toArray().map((v) => v.toFixed(3)).join(', ')}</dd>
    <dt>From rest</dt><dd>${off.toFixed(1)}°</dd><dt>World</dt><dd>${_p.x.toFixed(2)}, ${_p.y.toFixed(2)}, ${_p.z.toFixed(2)} m</dd>
    <dt>In ${esc(E?.name || '')}</dt><dd>${tracked ? 'has a track' : '<span class="warn">no track: held at rest</span>'}</dd></dl>`;
}

// ---- notes
function notesList() {
  const list = S.notesAll ? [...notes.all()].sort((a, b) => a.clip.localeCompare(b.clip) || a.frame - b.frame) : E ? notes.of(sub.id, E.name) : [];
  $('#noteList').innerHTML = list.length ? list.map((n) => `<div class="note" data-id="${n.id}"><button data-go="${n.id}" title="Go to this frame">${S.notesAll ? esc(n.clip) + ' · ' : ''}f${n.frame}</button><span class="tx">${esc(n.text)}</span><button class="x" data-del="${n.id}" title="Delete">×</button></div>`).join('')
    : `<div class="dim">${S.notesAll ? 'No notes yet.' : 'No notes on this clip.'} Stop on a bad frame, write what's wrong and press Enter (or N).</div>`;
  $('#noteCount').textContent = `${notes.all().length} in all`;
  if (E) timeline.set({ ...timeline.data, notes: notes.of(sub.id, E.name).map((n) => n.frame) });
}
function addNote() {
  const text = $('#noteText').value.trim(); if (!text || !E) { $('#noteText').focus(); return; }
  notes.add({ subject: sub.id, clip: E.name, file: E.file, frame: player.frame, time: player.time, text, setup: `${sub.setup?.() || ''}${S.travel === 'root' ? ', root motion' : ''}${player.prev ? ', mid-blend' : ''}` });
  $('#noteText').value = ''; notesList(); clipList(); toast(`Noted ${E.name} at frame ${player.frame}`);
}
$('#noteAdd').onclick = addNote;
$('#noteText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); } });
$('#noteText').addEventListener('focus', () => { player.playing = false; sync(); $('#noteWhere').textContent = E ? `${E.name} · frame ${player.frame} · ${player.time.toFixed(2)} s` : ''; });
$('#notesAll').checked = S.notesAll; $('#notesAll').onchange = () => { S.notesAll = $('#notesAll').checked; notesList(); save(); };
$('#noteList').addEventListener('click', (e) => {
  const go = e.target.dataset.go, del = e.target.dataset.del;
  if (del && confirm('Delete this note?')) { notes.remove(del); notesList(); clipList(); }
  if (go) { const n = notes.all().find((x) => x.id === go); if (n) { if (S.mode !== 'clips') setMode('clips'); choose(byName.get(n.clip), { at: n.frame }); sync(); } }
});
$('#notesCopy').onclick = async () => toast(await copyText(notes.text()) ? `Copied ${notes.all().length} notes` : 'Could not copy');

// ---- the checks
const limitsBox = $('#limits');
limitsBox.innerHTML = [['slideCm', 'Planted foot slides more than', 'cm'], ['belowCm', 'Below the ground more than', 'cm'], ['jumpDeg', 'A bone turns in one frame more than', '°']]
  .map(([k, n, u]) => `<label>${n}<input type="number" min="0" step="0.5" data-lim="${k}" value="${S.limits[k]}"><span>${u}</span></label>`).join('');
limitsBox.addEventListener('change', (e) => { const k = e.target.dataset.lim; if (!k) return; S.limits[k] = Math.max(0, +e.target.value || 0); results.clear(); save(); if (E) clipData(); checkList(); clipList(); });
async function runChecks(list) {
  $('#checkOne').disabled = $('#checkAll').disabled = true; let i = 0;
  for (const x of list) {
    $('#checkProgress').textContent = `Checking ${x.name} (${++i} of ${list.length})…`; await new Promise((r) => setTimeout(r, 0));
    try { results.set(x.name, analyse(sub, x, { mesh: true, limits: S.limits })); } catch (err) { results.set(x.name, { issues: [{ sev: 'err', text: 'the check failed: ' + err.message }], info: '' }); }
  }
  $('#checkProgress').textContent = `${list.length} clip${list.length > 1 ? 's' : ''} checked`; $('#checkOne').disabled = $('#checkAll').disabled = false;
  checkList(); clipList(); if (E) clipData();
}
$('#checkOne').onclick = () => E && runChecks([E]);
$('#checkAll').onclick = () => runChecks(sub.clips);
function checkList() {
  const rows = [...results].sort((a, b) => score(b[1]) - score(a[1]));
  $('#checkList').innerHTML = rows.length ? rows.map(([name, R]) => `<div class="res"><div class="rh" data-clip="${esc(name)}"><b>${esc(name)}</b>${R.issues.filter((i) => i.sev !== 'info').length ? '' : ' <span class="tag ok">ok</span>'}<span class="dim"> ${esc(R.info || '')}</span></div>`
    + R.issues.map((i) => `<div class="iss ${i.sev}"${i.frame !== undefined ? ` data-go="${esc(name)}" data-f="${i.frame}"` : ''}>${i.sev === 'err' ? '●' : i.sev === 'warn' ? '▲' : '·'} ${esc(i.text)}</div>`).join('') + '</div>').join('')
    : '<div class="dim">Run the checks on this clip or on every clip. They sample each frame on the body as it is dressed now: feet sliding while planted (the clip\'s travel added back), the body through the ground, joints jumping between frames, a loop\'s seam, NaN or missing tracks.</div>';
}
const score = (R) => R.issues.reduce((s, i) => s + (i.sev === 'err' ? 100 : i.sev === 'warn' ? 10 : 0), 0);
$('#checkList').addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]'), h = e.target.closest('.rh');
  if (g) { if (S.mode !== 'clips') setMode('clips'); choose(byName.get(g.dataset.go), { at: +g.dataset.f }); sync(); }
  else if (h) { if (S.mode !== 'clips') setMode('clips'); choose(byName.get(h.dataset.clip)); sync(); }
});
$('#checkCopy').onclick = async () => {
  let s = `Argonisos animation checks: ${sub.name}, ${sub.setup?.() || ''} (${new Date().toISOString().slice(0, 10)})\nLimits: slide ${S.limits.slideCm} cm, below ground ${S.limits.belowCm} cm, ${S.limits.jumpDeg}°/frame\n`;
  for (const [name, R] of [...results].sort((a, b) => score(b[1]) - score(a[1]))) { const I = R.issues.filter((i) => i.sev !== 'info'); s += `\n${name}: ${I.length ? '' : 'ok · '}${R.info}\n`; for (const i of I) s += `  ${i.sev === 'err' ? 'ERROR' : 'warn '} ${i.text}\n`; }
  toast(await copyText(s) ? 'Copied the report' : 'Could not copy');
};

// ---- the panes
function setPane(p) { S.pane = p; document.querySelectorAll('[data-pane]').forEach((b) => b.classList.toggle('on', b.dataset.pane === p)); document.querySelectorAll('.pane').forEach((x) => { x.style.display = x.id === 'pane-' + p ? '' : 'none'; }); save(); }
document.querySelectorAll('[data-pane]').forEach((b) => { b.onclick = () => setPane(b.dataset.pane); });

// ---- the walk's input, and clicks on the stage
const keys = new Set(), hits = new Set(), I = { down: (c) => keys.has(c), hit: (c) => hits.has(c), rmb: false, click: false };
addEventListener('keydown', (e) => {
  if (typing(e)) { if (e.code === 'Escape') e.target.blur(); return; }
  if (e.code === 'Slash') { e.preventDefault(); $('#q').focus(); return; }
  if (S.mode === 'walk') { if (!e.repeat) hits.add(e.code); keys.add(e.code); if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault(); if (e.code === 'Escape') setMode('clips'); return; }
  if (e.ctrlKey || e.metaKey) return;
  const k = e.code, big = e.shiftKey ? 10 : 1;
  if (k === 'Space') { e.preventDefault(); player.toggle(); }
  else if (k === 'ArrowLeft' || k === 'Comma') { e.preventDefault(); player.step(-big); }
  else if (k === 'ArrowRight' || k === 'Period') { e.preventDefault(); player.step(big); }
  else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); const list = sub.clips.filter((x) => !S.q || $(`#clips [data-clip="${CSS.escape(x.name)}"]`)), i = list.indexOf(E); choose(list[(i + (k === 'ArrowDown' ? 1 : -1) + list.length) % list.length]); }
  else if (k === 'Home') player.seek(0);
  else if (k === 'End') { player.playing = false; player.seek(player.dur); }
  else if (k === 'KeyN') { e.preventDefault(); setPane('notes'); $('#noteText').focus(); }
  else if (k === 'KeyL') { S.loop = player.loop = !S.loop; save(); }
  else if (k === 'KeyR') { S.travel = S.travel === 'root' ? 'place' : 'root'; player.loops = 0; rig.clearTrails(); save(); }
  else if (k === 'KeyK') { S.rig.skeleton = !S.rig.skeleton; rig.set('skeleton', S.rig.skeleton); $('[data-rig=skeleton]').checked = S.rig.skeleton; save(); }
  else if (k === 'KeyF') frameHero();
  else if (k === 'KeyG') grid.visible = !grid.visible;
  else if (k === 'BracketLeft' || k === 'BracketRight') { S.speed = player.speed = THREE.MathUtils.clamp(+(S.speed + (k === 'BracketRight' ? 0.1 : -0.1)).toFixed(2), 0.1, 2); save(); }
  sync();
});
addEventListener('keyup', (e) => keys.delete(e.code)); addEventListener('blur', () => { keys.clear(); I.rmb = false; });
view.claim = (e) => { if (S.mode === 'walk' && e.button === 2) { I.rmb = true; return true; } return false; };
addEventListener('pointerup', (e) => { if (e.button === 2) I.rmb = false; });
view.onClick = (e) => {
  if (S.mode === 'walk') { I.click = true; return; }
  if (S.rig.skeleton) { const b = rig.pick(camera, view.dom, e.clientX, e.clientY); if (b) selectBone(b); }
};
function frameHero() { sub.root.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(sub.model); if (!b.isEmpty()) view.frame(b); }

// ---- footsteps heard in the walk: a soft thump, and the side lit in the readout
let audio = null; const lastStep = { Left: 0, Right: 0 };
sub.onFootfall = (side) => {
  lastStep[side] = performance.now(); if (!S.sounds || S.mode !== 'walk') return;
  try {
    audio ||= new AudioContext(); const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.frequency.setValueAtTime(side === 'Left' ? 120 : 105, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.09); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.13);
  } catch { /* no sound here */ }
};
$('#sounds').checked = S.sounds; $('#sounds').onchange = () => { S.sounds = $('#sounds').checked; save(); };
const bar = (n, w, cls = '') => `<div class="wrow ${cls}"><span>${esc(n)}</span><i style="width:${Math.round(w * 100)}%"></i><em>${(w * 100).toFixed(0)}%</em></div>`;
function liveView() {
  const L = sub.live?.(); if (!L) return; const lit = (s) => performance.now() - lastStep[s] < 160 ? ' lit' : '';
  $('#liveIn').innerHTML = `<div class="big">${L.speed.toFixed(2)} <small>m/s</small><span class="feet"><b class="L${lit('Left')}">L</b><b class="R${lit('Right')}">R</b></span></div>
    <div class="flags">${[L.ground ? 'on the ground' : 'in the air', L.sprint && 'sprinting', L.sneak && 'sneaking', L.guard && 'guard', L.block && 'blocking', L.bow && 'bow: ' + L.bow, L.swing && 'strike: ' + L.swing, L.moveK < 0.99 && `held ${(L.moveK * 100).toFixed(0)}%`].filter(Boolean).join(' · ')}</div>
    <div class="sub">Base layer</div>${L.weights.filter((w) => w[1] > 0.005).map(([n, w]) => bar(n, w)).join('')}
    ${L.actions.length ? `<div class="sub">Actions</div>${L.actions.map(([n, w, t]) => bar(`${n} ${t.toFixed(2)}s`, w, 'act')).join('')}` : ''}
    <div class="sub">Blends</div><div class="blends">${Object.entries(L.blends).map(([k, v]) => `<span>${k} <b>${v.toFixed(2)}</b></span>`).join('')}<span>pelvis <b>${(L.pelvis * 100).toFixed(1)} cm</b></span></div>`;
}

// ---- start
boneTree(); bodyButtons(); setPane(S.pane); sync();
setMode.done = false; const startMode = S.mode; S.mode = 'clips'; setMode('clips'); if (startMode === 'walk') setMode('walk');
choose(byName.get(S.clip) || byName.get('walk') || sub.clips[0]); boneInfo(true); checkList(); notesList();

// ---- the frame
const clock = new THREE.Clock(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
let frames = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1); frames++;
  if (S.mode === 'walk') {
    camera.getWorldDirection(_d); const aim = _o.copy(camera.position).addScaledVector(_d, 30);
    sub.walk(dt, I, view.yaw, aim, stage); hits.clear(); I.click = false;
    view.target.lerp(_d.copy(sub.root.position).add(new THREE.Vector3(0, 1.3, 0)), Math.min(1, dt * 8));
    const k = view.keys; view.keys = new Set(); view.update(dt); view.keys = k;   // (WASD walks him here, not the camera)
    if (frames % 4 === 0) liveView();
  } else if (E) {
    player.update(dt); player.pose();
    const off = S.travel === 'root' ? player.offset(spot.yaw, _o) : _o.set(0, 0, 0);
    if (off.lengthSq() > 30 * 30) { player.loops = 0; rig.clearTrails(); }   // (a cycle carried 30 m off comes back round)
    const x = spot.x + off.x, z = spot.z + off.z; clipY = groundAt(x, z, clipY);
    sub.root.position.set(x, clipY, z); sub.root.rotation.set(0, spot.yaw, 0); sub.wrap.position.set(0, 0, 0); sub.root.updateMatrixWorld(true);
    if (S.ik) { ik ||= new FootIK(sub.bones, groundAt); sub.wrap.position.y += ik.plan(dt, clipY, true); sub.root.updateMatrixWorld(true); ik.solve(clipY); }
    sub.afterPose(dt); sub.root.updateMatrixWorld(true);
    view.update(dt);
    $('#frameNo').textContent = `${player.frame} / ${player.frames - 1}`; $('#timeNo').textContent = `${player.time.toFixed(2)} / ${player.dur.toFixed(2)} s`;
    $('#blendNo').textContent = player.prev ? `blending ${(player.blendK * 100).toFixed(0)}%` : '';
    if (player.playing !== frame.wasPlaying) { frame.wasPlaying = player.playing; sync(); }
    timeline.draw(player.time * player.fps);
    if (frames % 6 === 0) { boneInfo(); if (S.pane === 'notes') $('#noteWhere').textContent = `${E.name} · frame ${player.frame} · ${player.time.toFixed(2)} s`; }
  }
  rig.update(dt, groundAt); labels.update();
  aimSun(view.target, Math.max(view.dist, 8)); followGrid(view.target);
  render(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// (for checks in headless Chrome, and a console to poke at)
window.DEV_ANIM = { THREE, sub, player, rig, view, analyse, notes, results, choose: (n, at) => choose(byName.get(n), { at }), setMode, setPane, runChecks, get clip() { return E; }, state: S, frameHero, selectBone: (n) => selectBone(sub.bones[n]) };
