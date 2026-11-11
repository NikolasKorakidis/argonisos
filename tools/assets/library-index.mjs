// The texture each pack material uses, for the Blender library (library.py): node tools/assets/library-index.mjs out.json
// Unity finds an FBX's materials by name inside its pack (the .meta files remap nothing), and each .mat names its colour
// texture by GUID; the GUIDs come from the .meta files beside every asset. A pack's most used texture stands in for
// materials it can't find (most packs paint everything from one atlas).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..'), PACK = path.join(ROOT, 'incoming assets/Argonisos-Assets/Assets');
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else out.push(p); } return out; };
const files = walk(PACK), guid = new Map();
for (const f of files) if (f.endsWith('.meta')) { const m = fs.readFileSync(f, 'utf8').match(/^guid: (\w+)/m); if (m) guid.set(m[1], f.slice(0, -5)); }
// which pack a file belongs to: Synty/<pack>, or the top folder
// (Nature Biomes paints each biome from its own atlas: a pack of its own each)
const packOf = (f) => { const r = path.relative(PACK, f).split(path.sep); return r[1] === 'PolygonNatureBiomes' ? r.slice(0, 3).join('/') : r[0] === 'Synty' || r[0] === 'Magic Pig Games (Infinity PBR)' || r[0] === 'PolyArt' ? r.slice(0, 2).join('/') : r[0]; };
const COLOUR = /^_(BaseMap|MainTex|Albedo(_Map)?|BaseColorMap|Base_Texture|Texture|Diffuse|Albedo_Texture|Color_Map)$/i;
const mats = {}, uses = {};
for (const f of files) {
  if (!f.endsWith('.mat')) continue;
  const s = fs.readFileSync(f, 'utf8'); let tex = null;
  for (const m of s.matchAll(/- (_\w+):\n\s+m_Texture: \{fileID: \d+, guid: (\w+)/g)) if (COLOUR.test(m[1]) && guid.has(m[2])) { tex = guid.get(m[2]); break; }
  if (!tex) continue;
  const p = packOf(f); (mats[p] ||= {})[path.basename(f, '.mat')] = tex; (uses[p] ||= {})[tex] = (uses[p][tex] || 0) + 1;
}
// (effects' textures never stand in: circles, glows, clouds, water... and the Greek pack's red atlas is the one the game uses)
const FX = /fx|circle|glow|particle|cloud|sky|water|smoke|spark|flare|trail|hit|noise|ripple|test|foam|caustic/i;
const defaults = Object.fromEntries(Object.entries(uses).map(([p, u]) => { const L = Object.entries(u).sort((a, b) => b[1] - a[1]), ok = L.filter(([t]) => !FX.test(path.basename(t))); return [p, (ok[0] || L[0])[0]]; }));
for (const [p, t] of Object.entries(defaults)) if (/GreekWarfareTextureBlue/.test(t)) defaults[p] = t.replace('Blue', 'Red');
// the Synty packs' main atlases (the ones tools/assets/manifest.json uses), and each biome's
const ATLAS = { 'Synty/PolygonAncientEmpire': 'Textures/Alts/PolygonAncientEmpire_01_A.png', 'Synty/PolygonGeneric': 'Textures/Alts/Generic_01_A.png', 'Synty/PolygonNature': 'Textures/PolygonNature_01.png',
  'Synty/PolygonFantasyRivals': 'Textures/FantasyRivals_01_A.png', 'Synty/PolygonVikings': 'Textures/PolygonVikings_01.png' };
for (const [p, t] of Object.entries(ATLAS)) defaults[p] = path.join(PACK, p, t);
for (const f of files) if (/^PolygonNatureBiomes\w*_Texture_01\.png$/.test(path.basename(f))) defaults[packOf(f)] = f;
fs.writeFileSync(process.argv[2], JSON.stringify({ pack: PACK, mats, defaults }));
console.log(Object.entries(mats).map(([p, m]) => `${p}: ${Object.keys(m).length} materials, default ${path.basename(defaults[p])}`).join('\n'));
