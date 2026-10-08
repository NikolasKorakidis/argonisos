// Settings: graphics preset, render resolution, fullscreen, volume and mouse sensitivity. Kept in browser storage.
// Fullscreen captures the Escape key where the browser allows it (Keyboard Lock), so a tap still opens the pause menu
// and you hold Esc for two seconds to leave fullscreen. Where it doesn't (Safari, Firefox), Esc leaves fullscreen and
// the game puts it back on your next click.
import * as THREE from 'three';
import { renderer, composer, bloom, sun, camera, GFX } from '../render/core.js';
import { GRASS } from '../world/grass.js';
import { setVolume } from '../audio/sound.js';
import { input } from '../input.js';

const KEY = 'argonisos.settings.v1';
export const SETTINGS = { graphics: 'high', res: 1, volume: 0.8, sens: 1, fullscreen: false };
try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* defaults */ }
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(SETTINGS)); } catch { /* private mode */ } };

// Low: lower resolution, no post effects, hard small shadows, a third of the grass. High: everything.
export const PRESETS = {
  low: { name: 'Low', scale: 1, post: false, bloom: false, shadow: 1024, soft: false, grass: 0.35, flowers: 0.4, far: 4000 },
  medium: { name: 'Medium', scale: 1.5, post: true, bloom: false, shadow: 2048, soft: false, grass: 0.65, flowers: 0.7, far: 5000 },
  high: { name: 'High', scale: 2, post: true, bloom: true, shadow: 2048, soft: true, grass: 1, flowers: 1, far: 6000 },
};
export const RES = [[0.6, '60%'], [0.75, '75%'], [0.85, '85%'], [1, '100%']];

export function applyGraphics() {
  const Q = PRESETS[SETTINGS.graphics] || PRESETS.high;
  GFX.level = SETTINGS.graphics; GFX.post = Q.post; bloom.enabled = Q.bloom;
  GFX.scale = Math.min(devicePixelRatio, Q.scale) * SETTINGS.res;
  renderer.setPixelRatio(GFX.scale); renderer.setSize(innerWidth, innerHeight); composer.setPixelRatio(GFX.scale); composer.setSize(innerWidth, innerHeight);
  const type = Q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (renderer.shadowMap.type !== type || sun.shadow.mapSize.x !== Q.shadow) { renderer.shadowMap.type = type; sun.shadow.mapSize.set(Q.shadow, Q.shadow); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  if (GRASS.mesh) GRASS.mesh.count = Math.floor(GRASS.mesh.instanceMatrix.count * Q.grass);
  for (const f of GRASS.flowers) f.count = Math.floor(f.userData.max * Q.flowers);
  camera.far = Q.far; camera.updateProjectionMatrix();
}
export function setGraphics(level) { SETTINGS.graphics = level; store(); applyGraphics(); }
export function setRes(r) { SETTINGS.res = r; store(); applyGraphics(); }
export function setVol(v) { SETTINGS.volume = v; store(); setVolume(v); }
export function setSens(s) { SETTINGS.sens = s; store(); input.sens = s; }

// ---- fullscreen
let wantFs = false;
export const isFullscreen = () => !!document.fullscreenElement;
async function enterFs() { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); try { await navigator.keyboard?.lock?.(['Escape']); } catch { /* not supported */ } }
function leaveFs() { wantFs = false; navigator.keyboard?.unlock?.(); if (document.fullscreenElement) document.exitFullscreen(); }
export async function toggleFullscreen(toast) {
  try { if (!document.fullscreenElement) { await enterFs(); wantFs = true; } else leaveFs(); SETTINGS.fullscreen = wantFs; store(); }
  catch { toast?.('Fullscreen is not allowed here. Open the game in its own tab to use it.'); }
}
// where Esc always drops fullscreen, put it back on the next click or key
const restoreFs = (e) => { if (!wantFs || document.fullscreenElement || e.code === 'Escape') return; enterFs().catch(() => {}); };
addEventListener('pointerdown', restoreFs, true); addEventListener('keydown', restoreFs, true);
// hold Esc for two seconds to leave fullscreen
let escTimer = null;
addEventListener('keydown', (e) => { if (e.code !== 'Escape' || e.repeat || !document.fullscreenElement) return; clearTimeout(escTimer); escTimer = setTimeout(() => { leaveFs(); SETTINGS.fullscreen = false; store(); onFsChange?.(); }, 2000); });
addEventListener('keyup', (e) => { if (e.code === 'Escape') clearTimeout(escTimer); });
let onFsChange = null;
export function onFullscreenChange(f) { onFsChange = f; document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) navigator.keyboard?.unlock?.(); f(); }); }

input.sens = SETTINGS.sens; setVolume(SETTINGS.volume);
if (SETTINGS.fullscreen) wantFs = true;   // fullscreen needs a click to come back after a reload: the first one does it
