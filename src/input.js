// Keyboard and mouse. Mouse look while the pointer is locked; panels (inventory, crafting, build menu) free the cursor.
import { renderer } from './render/core.js';

export const input = { sens: 1, keys: {}, pressed: new Set(), lmb: false, rmb: false, clicks: [], wheel: 0, dx: 0, dy: 0, locked: false, uiOpen: false };
const canvas = renderer.domElement;
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (!input.keys[e.code]) input.pressed.add(e.code);
  input.keys[e.code] = true;
  if (['Tab', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => { input.keys[e.code] = false; });
addEventListener('blur', () => { for (const k in input.keys) input.keys[k] = false; input.lmb = input.rmb = false; });
canvas.addEventListener('mousedown', (e) => {
  if (!input.locked && !input.uiOpen) { lock(); return; }
  if (e.button === 0) { input.lmb = true; input.clicks.push(0); } if (e.button === 1) { input.clicks.push(1); e.preventDefault(); } if (e.button === 2) { input.rmb = true; input.clicks.push(2); }
});
addEventListener('mouseup', (e) => { if (e.button === 0) input.lmb = false; if (e.button === 2) input.rmb = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => { if (!input.locked) return; input.dx += e.movementX; input.dy += e.movementY; });
addEventListener('wheel', (e) => { if (input.locked) input.wheel += Math.sign(e.deltaY); }, { passive: true });
document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; if (!input.locked) { input.lmb = input.rmb = false; input.onUnlock?.(); } });
export function lock() { canvas.requestPointerLock?.()?.catch?.(() => {}); }
export function unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
// Call once at the end of each frame
export function endFrame() { input.pressed.clear(); input.clicks.length = 0; input.wheel = 0; input.dx = input.dy = 0; }
export const down = (c) => !!input.keys[c] && !input.uiOpen;
export const hit = (c) => input.pressed.has(c);
