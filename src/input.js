// Keyboard and mouse. Mouse look while the pointer is locked; panels (inventory, crafting, build menu) free the cursor.
import { renderer } from './render/core.js';

export const input = { sens: 1, keys: {}, pressed: new Set(), lmb: false, rmb: false, clicks: [], wheel: 0, dx: 0, dy: 0, locked: false, uiOpen: false };
const canvas = renderer.domElement;
// The game's keys that the browser takes for its own with Ctrl (or ⌘) held, as Ctrl is the sneak: W closes the tab, T and
// N open another, S saves the page, D bookmarks it, R reloads, the digits switch tabs. Held with Ctrl in play they're the
// game's (their default stopped), and in fullscreen the page asks for them all (Keyboard Lock, ui/settings.js), the only
// way it may have Ctrl+W, Ctrl+T or Ctrl+N; in a window those three the browser keeps (a game in progress asks before the
// tab goes: ui/title.js)
export const BROWSER_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyT', 'KeyN', 'KeyF', ...[...Array(10).keys()].map((i) => 'Digit' + i)];
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (!input.keys[e.code]) input.pressed.add(e.code);
  input.keys[e.code] = true;
  if (['Tab', 'Space', 'F3', 'F10'].includes(e.code)) e.preventDefault();   // (F3: the performance overlay, not the browser's find bar; F10: the HUD hidden while seated, not the browser's menu)
  if ((e.ctrlKey || e.metaKey) && BROWSER_KEYS.includes(e.code) && (e.code === 'KeyW' || input.locked || document.fullscreenElement)) e.preventDefault();   // (Ctrl+W always: never the tab closed from the page)
});
// (⌘ held, the Mac sends no key-up for the keys pressed with it: on letting go of it every key counts as up, or ⌘W
// declined at the browser's question would leave W held down and the hero running on)
addEventListener('keyup', (e) => { input.keys[e.code] = false; if (e.key === 'Meta') for (const k in input.keys) input.keys[k] = false; });
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
