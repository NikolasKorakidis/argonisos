// The title screen while the world streams in (Continue / New Game / Patch Notes), and the pause menu on Escape.
import { hasSave, clearSave } from '../game/save.js';
import { input, lock, unlock } from '../input.js';
import { PATCHES, notesPanel, notesUnread } from './patchnotes.js';
import { SETTINGS, PRESETS, RES, applyGraphics, setGraphics, setRes, setVol, setMusic, setSens, toggleFullscreen, isFullscreen, onFullscreenChange } from './settings.js';

// The title screen is a main menu over the living world: the camera drifts slowly round the hero while the island
// streams in, the HUD stays hidden, and the menu sits on the left (Continue, New Game, Patch Notes, Fullscreen).
export function titleScreen(g, ready) {
  const el = document.createElement('div'); el.id = 'title'; document.body.classList.add('titling');
  const save = (() => { try { return JSON.parse(localStorage.getItem('argonisos.world.v1') || 'null'); } catch { return null; } })();
  const ago = save?.at ? agoText(Date.now() - save.at) : '';
  const item = (id, name, sub, extra = '') => `<button class="titem" id="${id}"><b>${name}</b>${extra}${sub ? `<small>${sub}</small>` : ''}</button>`;
  el.innerHTML = `<div class="tside">
      <div class="tlogo"><div class="sup">The Trial of Zeus</div><h1>Argonisos</h1><div class="meander"></div></div>
      <div class="tload"><div class="load"><i></i></div><p class="tip">The island is rising from the sea…</p></div>
      <nav class="tmenu hidden">
        ${g.loaded ? item('tCont', 'Continue', `Day ${g.S.day}${ago ? ` · saved ${ago}` : ''}`) : ''}
        ${item('tNew', g.loaded ? 'New Game' : 'Begin the Trial', g.loaded ? 'Start a new trial (your saved world is lost)' : 'You wake on a quiet shore of Nisos')}
        ${item('tNotes', 'Patch Notes', `${PATCHES[0].name} · ${PATCHES[0].title}`, notesUnread() ? '<em class="new">New</em>' : '')}
        ${item('tFs', 'Fullscreen', 'Recommended')}
      </nav>
    </div>
    <div class="tfoot"><span>${PATCHES[0].name} · ${PATCHES[0].date}</span><span>Esc pauses · the world saves itself every minute</span></div>`;
  document.body.appendChild(el); input.uiOpen = true;
  const notes = notesPanel();
  const bar = el.querySelector('.load i');
  const tick = () => { const k = ready(); bar.style.width = Math.round(k * 100) + '%'; if (k >= 1) { el.querySelector('.tload').classList.add('hidden'); el.querySelector('.tmenu').classList.remove('hidden'); } else requestAnimationFrame(tick); };
  tick();
  // the slow drift round the hero (the player's own camera, so it hands over seamlessly when you start)
  const P = g.player, cam0 = { d: P.camDist, p: P.camPitch }; let last = performance.now(), on = true;
  P.camDist = 9; P.camPitch = -0.08;
  const drift = (t) => { if (!on) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; P.camYaw += dt * 0.045; requestAnimationFrame(drift); }; requestAnimationFrame(drift);
  const start = () => { on = false; P.camDist = cam0.d; P.camPitch = cam0.p; document.body.classList.remove('titling'); el.classList.add('out'); setTimeout(() => el.remove(), 900); input.uiOpen = false; lock(); g.started = true; };
  el.querySelector('#tCont')?.addEventListener('click', start);
  el.querySelector('#tNew').addEventListener('click', () => { if (g.loaded) { if (!confirm('Start a new trial? Your saved world will be lost.')) return; clearSave(); removeEventListener('beforeunload', g.save); g.save = () => false; location.reload(); return; } start(); });
  el.querySelector('#tNotes').onclick = () => notes.open(() => el.querySelector('#tNotes .new')?.remove());
  el.querySelector('#tFs').onclick = () => toggleFullscreen((m) => g.hud.toast(m));
  void hasSave;
}
const agoText = (ms) => { const m = Math.round(ms / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 60 * 24 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };

// ---- the pause menu (Esc or P), with the settings
export function pauseMenu(g) {
  const pm = document.createElement('div'); pm.id = 'pause'; pm.className = 'hidden';
  pm.innerHTML = `<div class="pnl"><h2>Paused</h2><div class="pbody">
    <div class="pcol"><button class="btn" id="pResume">Resume</button><button class="btn" id="pSave">Save</button><button class="btn ghost" id="pNotes">Patch notes</button><button class="btn ghost" id="pDev">Dev tools</button><button class="btn ghost" id="pNew">New trial</button></div>
    <p class="psub">Settings</p>
    <div class="set"><span>Fullscreen</span><button class="btn small" id="sFs"></button></div>
    <div class="set"><span>Graphics</span><div class="seg" id="sGfx">${Object.entries(PRESETS).map(([k, q]) => `<button data-v="${k}">${q.name}</button>`).join('')}</div></div>
    <div class="set"><span>Resolution</span><div class="seg" id="sRes">${RES.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="set"><span>Volume</span><input type="range" id="sVol" min="0" max="100"></div>
    <div class="set"><span>Music</span><input type="range" id="sMus" min="0" max="100"></div>
    <div class="set"><span>Mouse sensitivity</span><input type="range" id="sSens" min="30" max="250"></div>
    <p class="hint">Esc or P pauses · in fullscreen, hold Esc to leave it · the world saves itself every minute</p></div></div>`;
  document.body.appendChild(pm);
  const sync = () => {
    pm.querySelector('#sFs').textContent = isFullscreen() ? 'On' : 'Off'; const tf = document.querySelector('#tFs b'); if (tf) tf.textContent = isFullscreen() ? 'Exit Fullscreen' : 'Fullscreen';
    pm.querySelectorAll('#sGfx button').forEach((b) => b.classList.toggle('on', b.dataset.v === SETTINGS.graphics));
    pm.querySelectorAll('#sRes button').forEach((b) => b.classList.toggle('on', +b.dataset.v === SETTINGS.res));
    pm.querySelector('#sVol').value = Math.round(SETTINGS.volume * 100); pm.querySelector('#sMus').value = Math.round(SETTINGS.music * 100); pm.querySelector('#sSens').value = Math.round(SETTINGS.sens * 100);
  };
  pm.querySelector('#sFs').onclick = async () => { await toggleFullscreen((m) => g.hud.toast(m)); sync(); };
  pm.querySelector('#sGfx').onclick = (e) => { const b = e.target.closest('button'); if (b) { setGraphics(b.dataset.v); sync(); } };
  pm.querySelector('#sRes').onclick = (e) => { const b = e.target.closest('button'); if (b) { setRes(+b.dataset.v); sync(); } };
  pm.querySelector('#sVol').oninput = (e) => setVol(e.target.value / 100);
  pm.querySelector('#sMus').oninput = (e) => setMusic(e.target.value / 100);
  pm.querySelector('#sSens').oninput = (e) => setSens(e.target.value / 100);
  onFullscreenChange(sync); sync(); applyGraphics();
  pm.querySelector('#pDev').onclick = () => g.devMenu?.open();
  const notes = notesPanel(); pm.querySelector('#pNotes').onclick = () => notes.open();
  g.pause = (on) => { pm.classList.toggle('hidden', !on); if (!on) document.getElementById('devPanel')?.classList.add('hidden'); g.paused = on; input.uiOpen = on; if (on) { unlock(); sync(); g.pausedAt = performance.now(); } else lock(); };
  pm.querySelector('#pResume').onclick = () => g.pause(false);
  pm.querySelector('#pSave').onclick = () => { g.hud.toast(g.save() ? 'Saved' : 'Could not save'); g.pause(false); };
  pm.querySelector('#pNew').onclick = () => { if (!confirm('Start a new trial? Your saved world will be lost.')) return; clearSave(); g.save = () => false; location.reload(); };
  // the browser keeps the Esc press that frees the mouse to itself, so losing the mouse mid-game pauses too
  input.onUnlock = () => { if (g.started && !g.paused && !input.uiOpen && !g.player.dead) g.pause(true); };
}
