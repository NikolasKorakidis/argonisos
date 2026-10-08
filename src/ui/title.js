// The title screen while the world streams in (Continue / New Game), and the pause menu on Escape.
import { hasSave, clearSave } from '../game/save.js';
import { input, lock, unlock } from '../input.js';
import { SETTINGS, PRESETS, RES, applyGraphics, setGraphics, setRes, setVol, setSens, toggleFullscreen, isFullscreen, onFullscreenChange } from './settings.js';

export function titleScreen(g, ready) {
  const el = document.createElement('div'); el.id = 'title';
  el.innerHTML = `<div class="tbox"><div class="sup">The trial of Zeus</div><h1>Argonisos</h1><div class="meander"></div>
    <div class="load"><i></i></div><p class="tip">The island is rising from the sea…</p>
    <div class="btns hidden">${g.loaded ? '<button class="btn" id="tCont">Continue</button>' : ''}<button class="btn ${g.loaded ? 'ghost' : ''}" id="tNew">${g.loaded ? 'New Game' : 'Begin'}</button></div>
    <button class="btn ghost small" id="tFs">Fullscreen</button></div>`;
  document.body.appendChild(el); input.uiOpen = true;
  const bar = el.querySelector('.load i');
  const tick = () => { const k = ready(); bar.style.width = Math.round(k * 100) + '%'; if (k >= 1) { el.querySelector('.load').classList.add('hidden'); el.querySelector('.tip').textContent = g.loaded ? `Day ${g.S.day}. Nisos waits for you.` : 'You wake on a quiet shore of Nisos…'; el.querySelector('.btns').classList.remove('hidden'); } else requestAnimationFrame(tick); };
  tick();
  const start = () => { el.classList.add('out'); setTimeout(() => el.remove(), 900); input.uiOpen = false; lock(); g.started = true; };
  el.querySelector('#tCont')?.addEventListener('click', start);
  el.querySelector('#tNew').addEventListener('click', () => { if (g.loaded) { if (!confirm('Start a new trial? Your saved world will be lost.')) return; clearSave(); removeEventListener('beforeunload', g.save); g.save = () => false; location.reload(); return; } start(); });
  el.querySelector('#tFs').onclick = () => toggleFullscreen((m) => g.hud.toast(m));
  void hasSave;
}

// ---- the pause menu (Esc or P), with the settings
export function pauseMenu(g) {
  const pm = document.createElement('div'); pm.id = 'pause'; pm.className = 'hidden';
  pm.innerHTML = `<div class="pnl"><h2>Paused</h2><div class="pbody">
    <div class="pcol"><button class="btn" id="pResume">Resume</button><button class="btn" id="pSave">Save</button><button class="btn ghost" id="pDev">Dev tools</button><button class="btn ghost" id="pNew">New trial</button></div>
    <p class="psub">Settings</p>
    <div class="set"><span>Fullscreen</span><button class="btn small" id="sFs"></button></div>
    <div class="set"><span>Graphics</span><div class="seg" id="sGfx">${Object.entries(PRESETS).map(([k, q]) => `<button data-v="${k}">${q.name}</button>`).join('')}</div></div>
    <div class="set"><span>Resolution</span><div class="seg" id="sRes">${RES.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="set"><span>Volume</span><input type="range" id="sVol" min="0" max="100"></div>
    <div class="set"><span>Mouse sensitivity</span><input type="range" id="sSens" min="30" max="250"></div>
    <p class="hint">Esc or P pauses · in fullscreen, hold Esc to leave it · the world saves itself every minute</p></div></div>`;
  document.body.appendChild(pm);
  const sync = () => {
    pm.querySelector('#sFs').textContent = isFullscreen() ? 'On' : 'Off'; const tf = document.getElementById('tFs'); if (tf) tf.textContent = isFullscreen() ? 'Exit fullscreen' : 'Fullscreen';
    pm.querySelectorAll('#sGfx button').forEach((b) => b.classList.toggle('on', b.dataset.v === SETTINGS.graphics));
    pm.querySelectorAll('#sRes button').forEach((b) => b.classList.toggle('on', +b.dataset.v === SETTINGS.res));
    pm.querySelector('#sVol').value = Math.round(SETTINGS.volume * 100); pm.querySelector('#sSens').value = Math.round(SETTINGS.sens * 100);
  };
  pm.querySelector('#sFs').onclick = async () => { await toggleFullscreen((m) => g.hud.toast(m)); sync(); };
  pm.querySelector('#sGfx').onclick = (e) => { const b = e.target.closest('button'); if (b) { setGraphics(b.dataset.v); sync(); } };
  pm.querySelector('#sRes').onclick = (e) => { const b = e.target.closest('button'); if (b) { setRes(+b.dataset.v); sync(); } };
  pm.querySelector('#sVol').oninput = (e) => setVol(e.target.value / 100);
  pm.querySelector('#sSens').oninput = (e) => setSens(e.target.value / 100);
  onFullscreenChange(sync); sync(); applyGraphics();
  pm.querySelector('#pDev').onclick = () => g.devMenu?.open();
  g.pause = (on) => { pm.classList.toggle('hidden', !on); if (!on) document.getElementById('devPanel')?.classList.add('hidden'); g.paused = on; input.uiOpen = on; if (on) { unlock(); sync(); g.pausedAt = performance.now(); } else lock(); };
  pm.querySelector('#pResume').onclick = () => g.pause(false);
  pm.querySelector('#pSave').onclick = () => { g.hud.toast(g.save() ? 'Saved' : 'Could not save'); g.pause(false); };
  pm.querySelector('#pNew').onclick = () => { if (!confirm('Start a new trial? Your saved world will be lost.')) return; clearSave(); g.save = () => false; location.reload(); };
  // the browser keeps the Esc press that frees the mouse to itself, so losing the mouse mid-game pauses too
  input.onUnlock = () => { if (g.started && !g.paused && !input.uiOpen && !g.player.dead) g.pause(true); };
}
