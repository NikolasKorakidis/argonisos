// The character creator: who wakes on the shore. Shown when a new trial begins (the title's Begin the Trial) and from
// the pause menu (Appearance). The hero stands in the living world, turned to the light, and the camera frames them on
// the right while the choices sit down the left: body, skin, hair and its colour, beard, eyes, clothes and a wreath.
// Every choice shows at once (hero.setLook); the look goes with the saved game, and is remembered here as the next
// creator's starting point. Drag to turn the hero, the wheel (or the face rows) to look closer.
import * as THREE from 'three';
import { BODIES, SKINS, HAIRS, HAIR_COLOURS, BEARDS, EYES, CLOTHS, WREATHS, normLook, randomLook } from '../player/hero.js';
import { rememberLook } from './settings.js';
import { ATMO } from '../render/atmosphere.js';
import { camera } from '../render/core.js';
import { lightDir } from '../world/sky.js';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');
// the rows: [key, label, kind ('seg' | 'swatch' | 'step'), list, view ('face' brings the camera to the head)]
const ROWS = [['body', 'Body', 'seg', Object.entries(BODIES).map(([id, b]) => [id, b.name]), 'body'], ['skin', 'Skin', 'swatch', SKINS, 'body'],
  ['hair', 'Hair', 'step', HAIRS, 'face'], ['hairColour', 'Hair colour', 'swatch', HAIR_COLOURS, 'face'], ['beard', 'Beard', 'step', BEARDS, 'face'],
  ['eyes', 'Eyes', 'swatch', EYES, 'face'], ['cloth', 'Clothes', 'swatch', CLOTHS, 'body'], ['wreath', 'Wreath', 'step', WREATHS, 'face']];
// the hair styles in the order offered: the body's own first
const hairsFor = (body) => { const s = body === 'woman' ? 'f' : 'm'; return [...HAIRS.filter((h) => h[3].includes(s)), ...HAIRS.filter((h) => !h[3].includes(s))]; };

export function characterCreator(g) {
  const P = g.player, H = P.hero;
  const el = document.createElement('div'); el.id = 'creator'; el.className = 'hidden';
  el.innerHTML = `<div class="cside">
      <div class="csup">The Trial of Zeus</div><h2>Who Wakes on the Shore?</h2><div class="meander"></div>
      <div class="crows">${ROWS.map(([key, label, kind, list]) => `<div class="crow" data-k="${key}"><span class="clabel">${label}<em></em></span>${
        kind === 'seg' ? `<div class="seg">${list.map(([id, name]) => `<button data-v="${id}">${name}</button>`).join('')}</div>`
        : kind === 'swatch' ? `<div class="swatches">${list.map(([id, name, c]) => `<button data-v="${id}" title="${name}" style="--c:${hex(c)}"></button>`).join('')}</div>`
        : '<div class="step"><button class="prev" aria-label="Previous">‹</button><b></b><button class="next" aria-label="Next">›</button><small></small></div>'}</div>`).join('')}</div>
      <div class="cbtns"><button class="btn ghost" id="cRandom">Randomise</button><button class="btn ghost" id="cBack">Back</button><button class="btn" id="cDone">Begin the Trial</button></div>
      <p class="chint">Drag to turn · scroll to look closer</p>
    </div>`;
  document.body.appendChild(el);
  let look = normLook(H.look), before = look, done = null, back = null, view = 0, viewAim = 0, orbit = 0, dragX = null, idle = 0, focus0 = 3, raf = 0, last = 0;
  const C = { open: false };

  // ---- the rows
  const draw = () => {
    for (const [key, , kind, list0] of ROWS) {
      const row = el.querySelector(`.crow[data-k="${key}"]`), list = key === 'hair' ? hairsFor(look.body) : list0;
      row.classList.toggle('hidden', key === 'beard' && look.body === 'woman');
      if (kind === 'step') { const i = Math.max(0, list.findIndex((x) => x[0] === look[key])); row.querySelector('b').textContent = list[i][1]; row.querySelector('small').textContent = `${i + 1} / ${list.length}`; }
      else row.querySelectorAll('button[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === look[key]));
      if (kind === 'swatch') row.querySelector('.clabel em').textContent = list.find((x) => x[0] === look[key])?.[1] || '';
    }
  };
  const set = (patch) => {
    look = normLook({ ...look, ...patch });
    if (look.body === 'woman') look.beard = 'none';
    H.setLook(look); draw();
  };
  el.querySelector('.crows').addEventListener('click', (e) => {
    const b = e.target.closest('button'), row = e.target.closest('.crow'); if (!b || !row) return;
    const key = row.dataset.k, def = ROWS.find((r) => r[0] === key);
    if (b.dataset.v) { set({ [key]: b.dataset.v }); g.sound?.('pick'); return; }
    const list = key === 'hair' ? hairsFor(look.body) : def[3], i = list.findIndex((x) => x[0] === look[key]), d = b.classList.contains('next') ? 1 : -1;
    set({ [key]: list[(i + d + list.length) % list.length][0] }); g.sound?.('pick');
  });
  for (const row of el.querySelectorAll('.crow')) row.addEventListener('pointerenter', () => { viewAim = ROWS.find((r) => r[0] === row.dataset.k)[4] === 'face' ? 1 : 0; });
  el.querySelector('#cRandom').onclick = () => { set(randomLook(look.body)); g.sound?.('pick'); };
  el.querySelector('#cDone').onclick = () => close(true);
  el.querySelector('#cBack').onclick = () => close(false);

  // ---- turning and looking closer: drag anywhere off the panel, the wheel
  el.addEventListener('pointerdown', (e) => { if (e.target.closest('.cside')) return; dragX = e.clientX; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (dragX === null) return; orbit += (e.clientX - dragX) * 0.008; dragX = e.clientX; idle = 0; });
  el.addEventListener('pointerup', () => { dragX = null; });
  el.addEventListener('wheel', (e) => { if (e.target.closest('.crows')) return; viewAim = e.deltaY < 0 ? 1 : 0; }, { passive: true });

  // ---- the camera: the whole hero, or their face, on the right of the screen (the panel takes the left); while nothing
  // is touched the hero sways slowly to and fro, so the hair shows from the sides
  const head = new THREE.Vector3(), tgt = new THREE.Vector3(), dir = new THREE.Vector3(), right = new THREE.Vector3();
  const frame = (t) => {
    if (!C.open) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t; idle += dt;
    view += (viewAim - view) * Math.min(1, dt * 4);
    if (g.paused) { H.update(dt, { speed: 0, onGround: true }); P.root.rotation.y = P.yaw; }   // (from the pause menu: the game stands still, the hero doesn't)
    const sway = Math.sin(idle * 0.45) * 0.5 * Math.min(1, Math.max(0, idle - 2) / 2), a = P.yaw + orbit + sway;
    dir.set(Math.sin(a), 0, Math.cos(a)); right.set(Math.cos(a), 0, -Math.sin(a));
    if (H.bones.mixamorigHead) H.bones.mixamorigHead.getWorldPosition(head); else head.copy(P.pos).setY(P.pos.y + 1.7);
    // (from a little above, looking down over the grass at the whole figure; level with the face up close)
    const d = THREE.MathUtils.lerp(3.6, 1.2, view);
    tgt.copy(P.pos).setY(P.pos.y + 0.95).lerp(head.setY(head.y + 0.06), view).addScaledVector(right, -d * 0.3);
    camera.position.copy(tgt).addScaledVector(dir, d); camera.position.y += THREE.MathUtils.lerp(0.75, 0.02, view); camera.lookAt(tgt);
  };

  // first: the title's new game (Begin the Trial starts it, Back returns to the title); otherwise the pause menu's
  // Appearance (Done keeps the new look, Back puts the old one back)
  C.show = ({ first = false, onDone, onBack } = {}) => {
    look = normLook(H.look); before = look; done = onDone; back = onBack; C.open = true;
    el.querySelector('#cDone').textContent = first ? 'Begin the Trial' : 'Done';
    el.classList.remove('hidden'); document.body.classList.add('creating'); draw();
    // the hero turned to the light, the camera ours (the player's own camera does nothing meanwhile), the focus blur off
    P.yaw = Math.atan2(lightDir.x, lightDir.z); P.root.rotation.y = P.yaw;
    P.updateCamera = () => {}; focus0 = ATMO.focus.value; ATMO.focus.value = 0; H.calm = true;   // (no looking round while the face is framed)
    orbit = 0; idle = 0; view = viewAim = 0; last = performance.now(); raf = requestAnimationFrame(frame);
  };
  function close(keep) {
    C.open = false; cancelAnimationFrame(raf); el.classList.add('hidden'); document.body.classList.remove('creating');
    delete P.updateCamera; ATMO.focus.value = focus0; H.calm = false; P.camYaw = P.yaw + Math.PI;   // (back over the hero's shoulder, looking the way they face)
    if (keep) { rememberLook(look); done?.(look); } else { if (look !== before) H.setLook(before); back?.(); }
  }
  C.close = close;
  return C;
}
