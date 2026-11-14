// The graphics preset the game started with (settings.js keeps the choice). Ultra, for high-end PCs, draws the world
// much further out: the mist, the grass, the trees' bands, the shadows' reach and the like are built into shaders and
// layouts as the game loads, so they are read once, here, before anything else is built, and switching to or from
// Ultra takes a reload for them (the rest of a preset switches at once: settings.js applyGraphics).
// ?gfx=ultra (or low, medium, high) in the address picks a preset for this visit only, without storing it (tests,
// screenshots). Nothing here may touch three.js or the DOM beyond the address and storage: reach.js imports it.
export const SETTINGS_KEY = 'argonisos.settings.v1';
const pick = () => {
  try { const q = new URLSearchParams(globalThis.location?.search || '').get('gfx'); if (q) return q; } catch { /* no address */ }
  try { return JSON.parse(globalThis.localStorage?.getItem(SETTINGS_KEY) || '{}').graphics || 'high'; } catch { return 'high'; }
};
export const BOOT_GFX = pick();
export const ULTRA = BOOT_GFX === 'ultra';
