// Settings: graphics preset, render resolution, fullscreen, volume, mouse sensitivity, and the hero's look last chosen
// in the character creator (the next new game starts from it). Kept in browser storage.
// Fullscreen captures the Escape key where the browser allows it (Keyboard Lock), so a tap still opens the pause menu
// and you hold Esc for two seconds to leave fullscreen. Where it doesn't (Safari, Firefox), Esc leaves fullscreen and
// the game puts it back on your next click.
import * as THREE from 'three';
import { renderer, bloom, sun, sunFar, SHADOW, shadowSoftness, camera, GFX, setScale } from '../render/core.js';
import { ATMO } from '../render/atmosphere.js';
import { GRASS } from '../world/grass.js';
import { setVolume, setMusicVolume } from '../audio/sound.js';
import { input } from '../input.js';
import { LIGHTNING } from '../world/lightning.js';

const KEY = 'argonisos.settings.v1';
export const SETTINGS = { graphics: 'high', res: 1, volume: 0.8, music: 0.5, sens: 1, fullscreen: false, look: null, calmFlash: false };
try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* defaults */ }
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(SETTINGS)); } catch { /* private mode */ } };

// Low: lower resolution, no post effects, hard small shadows near you only, a third of the grass. High: everything.
// (shadow: the near shadow map's size; farShadow: the far one's, 0 for none; ao: the shade in corners and at the feet)
export const PRESETS = {
  low: { name: 'Low', scale: 1, post: false, bloom: false, shadow: 1024, farShadow: 0, soft: false, grass: 0.35, flowers: 0.4, far: 4000 },
  medium: { name: 'Medium', scale: 1.5, post: true, bloom: false, shadow: 2048, farShadow: 1024, ao: true, soft: false, grass: 0.65, flowers: 0.7, far: 5000 },
  high: { name: 'High', scale: 2, post: true, bloom: true, shadow: 2048, farShadow: 2048, ao: true, soft: true, grass: 1, flowers: 1, far: 6000 },
};
export const RES = [[0.6, '60%'], [0.75, '75%'], [0.85, '85%'], [1, '100%']];

export function applyGraphics() {
  const Q = PRESETS[SETTINGS.graphics] || PRESETS.high;
  GFX.level = SETTINGS.graphics; GFX.post = Q.post; bloom.enabled = Q.bloom; ATMO.rays.value = Q.bloom ? 1 : 0;   // (shafts of sun on High)
  GFX.scale = Math.min(devicePixelRatio, Q.scale) * SETTINGS.res;
  setScale();   // (times the automatic resolution factor)
  const type = Q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  const fresh = (L, n) => { if (renderer.shadowMap.type === type && L.shadow.mapSize.x === n) return; L.shadow.mapSize.set(n, n); L.shadow.map?.dispose(); L.shadow.map = null; };
  fresh(sun, Q.shadow); if (Q.farShadow) fresh(sunFar, Q.farShadow); renderer.shadowMap.type = type; SHADOW.far = !!Q.farShadow; shadowSoftness();
  ATMO.ao.value = Q.ao ? 1 : 0;
  if (GRASS.mesh) GRASS.mesh.count = Math.floor(GRASS.mesh.instanceMatrix.count * Q.grass);
  for (const f of GRASS.flowers) f.count = Math.floor(f.userData.max * Q.flowers);
  camera.far = Q.far; camera.updateProjectionMatrix();
}
export function setGraphics(level) { SETTINGS.graphics = level; store(); applyGraphics(); }
export function setRes(r) { SETTINGS.res = r; store(); applyGraphics(); }
export function setVol(v) { SETTINGS.volume = v; store(); setVolume(v); }
export function setMusic(v) { SETTINGS.music = v; store(); setMusicVolume(v); }
export function setSens(s) { SETTINGS.sens = s; store(); input.sens = s; }
// Reduce flashing (for the photosensitive): lightning softer and slower, and nothing blinds (lightning.js)
export function setCalmFlash(on) { SETTINGS.calmFlash = on; store(); LIGHTNING.soft = on; }
// the look chosen in the creator (the game keeps its own with the save; this one is where the next creator starts)
export function rememberLook(look) { SETTINGS.look = { ...look }; delete SETTINGS.hero; store(); }

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

input.sens = SETTINGS.sens; setVolume(SETTINGS.volume); setMusicVolume(SETTINGS.music); LIGHTNING.soft = SETTINGS.calmFlash;
if (SETTINGS.fullscreen) wantFs = true;   // fullscreen needs a click to come back after a reload: the first one does it
