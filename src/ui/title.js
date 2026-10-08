// The title screen while the world streams in (Continue / New Game), and the pause menu on Escape.
import { hasSave, clearSave } from '../game/save.js';
import { input, lock, unlock } from '../input.js';

export function titleScreen(g, ready) {
  const el = document.createElement('div'); el.id = 'title';
  el.innerHTML = `<div class="tbox"><div class="sup">The trial of Zeus</div><h1>Argonisos</h1><div class="meander"></div>
    <div class="load"><i></i></div><p class="tip">The island is rising from the sea…</p>
    <div class="btns hidden">${g.loaded ? '<button class="btn" id="tCont">Continue</button>' : ''}<button class="btn ${g.loaded ? 'ghost' : ''}" id="tNew">${g.loaded ? 'New Game' : 'Begin'}</button></div></div>`;
  document.body.appendChild(el); input.uiOpen = true;
  const bar = el.querySelector('.load i');
  const tick = () => { const k = ready(); bar.style.width = Math.round(k * 100) + '%'; if (k >= 1) { el.querySelector('.load').classList.add('hidden'); el.querySelector('.tip').textContent = g.loaded ? `Day ${g.S.day}. Nisos waits for you.` : 'You wake on a quiet shore of Nisos…'; el.querySelector('.btns').classList.remove('hidden'); } else requestAnimationFrame(tick); };
  tick();
  const start = () => { el.classList.add('out'); setTimeout(() => el.remove(), 900); input.uiOpen = false; lock(); g.started = true; };
  el.querySelector('#tCont')?.addEventListener('click', start);
  el.querySelector('#tNew').addEventListener('click', () => { if (g.loaded) { if (!confirm('Start a new trial? Your saved world will be lost.')) return; clearSave(); removeEventListener('beforeunload', g.save); g.save = () => false; location.reload(); return; } start(); });
  // pause menu
  const pm = document.createElement('div'); pm.id = 'pause'; pm.className = 'hidden';
  pm.innerHTML = '<div class="pnl"><h2>Paused</h2><div class="pbody"><button class="btn" id="pResume">Resume</button><button class="btn" id="pSave">Save</button><button class="btn ghost" id="pNew">New trial</button><p class="hint">The world saves itself every minute.</p></div></div>';
  document.body.appendChild(pm);
  g.pause = (on) => { pm.classList.toggle('hidden', !on); g.paused = on; input.uiOpen = on; if (on) unlock(); else lock(); };
  pm.querySelector('#pResume').onclick = () => g.pause(false);
  pm.querySelector('#pSave').onclick = () => { g.hud.toast(g.save() ? 'Saved' : 'Could not save'); g.pause(false); };
  pm.querySelector('#pNew').onclick = () => { if (!confirm('Start a new trial? Your saved world will be lost.')) return; clearSave(); g.save = () => false; location.reload(); };
  void hasSave;
}
