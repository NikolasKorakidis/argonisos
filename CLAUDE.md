# Argonisos: notes for working on the code

A Valheim-style open-world survival game in three.js r160 (vendored as `three.module.js`, add-ons in `jsm/`), plain ES
modules, no build step. `index.html` loads `src/main.js`. `classic.html` / `play.html` / `game.js` are the old prologue
prototype: leave them alone unless asked.

## Rules
- **`concept/` is private.** The design docs there are git-ignored and must never be committed, pushed, quoted in
  commits, PRs or patch notes, or served (the test server refuses `/concept`). Only the four old `.webp` images are tracked.
- Branch before committing; PRs go to `main`. Push with `git -c credential.helper= -c credential.helper='!gh auth git-credential' push`.
- Player-facing changes go in the patch notes (`src/ui/patchnotes.js`, the `PATCHES` list) in plain player language.

## Run and test
- `npm run dev`: dev server on :8000 with live reload. `index.html?play` skips the title screen.
- `npm test`: every suite in `tests/suites` (about 6 min). `npm run test:quick` skips the slow ones (perf, visual,
  creatures). `node tests/run.mjs loop build` runs suites by file-name prefix; `--headed` to watch.
- `npm run test:update`: accept new screenshot baselines after an intended look change (check
  `tests/reports/visual.html` first).
- `npm run playtest -- --minutes 20 --seed 7`: the bot plays unattended; report in `tests/reports/playtest/<time>/report.md`.
- Tests drive the real game in headless Chrome **on the GPU** (`--use-angle=metal`); without those flags it falls back to
  software rendering at under 1 fps and every timing check is meaningless. They serve the project on their own port
  (no live reload) and talk to the game through `window.AG` (see the end of `src/main.js`).
- A test step is a page snippet returning `true` or a reason string. In snippets `g` is `AG.game`, `P` the player, `B` the
  build system, `C` crafting, `inv` the pack, `V` `THREE.Vector3`: don't redeclare those names.
- Test setup: saving off, `S.peaceful`, clear weather, `g.weatherRain = () => 0` (random rain puts fires out), the owl's
  talks marked heard (her dialogue pauses the world). Screenshot tests also set `S.still` (holds wind, water and clouds).

## How a frame runs (`src/main.js` `loop`)
input → `game.update` (creatures, trial, build, combat…) → `player.update` → sky, weather, fog → giant forest, water,
shadows → terrain and vegetation streaming (`veg.update`, `updateCuts`, `updateGrass`) → `game.lateUpdate` (fx, lights,
occlusion) → HUD → `veg.cull` (packs the visible near trees into their batches) → `structures.cull` → ambient particles →
`updateAtmosphere` → `render()` (RenderPass → atmosphere → bloom → output) → `adaptResolution`.

## Things that bite
- **The world is deterministic.** Terrain, sites, flora and pickups come from hashes of position, and saves refer to
  trees and pickups by index within their cell. Append new species or pickup kinds at the end, with their own hash,
  so existing indices don't shift. Never draw from a shared random sequence in a way that changes the order for code
  after it (`greek.js` textures have their own dice for this reason).
- **Heights change once the sites are placed.** The Olympos peak and the small-scale ground detail (`PEAK.on`,
  `DETAIL.on` in `gen.js`) switch on at the end of `sites.js`, so they can't move sites. Anything that picks places by
  height must run before that, or accept the final heights. Ground detail finer than ~6 m won't match the 2 m terrain mesh.
- **The ground isn't just `heightAt`.** Floors press the terrain down (`groundcut.js`): use `groundAt(x, z)` for where
  things stand, `player.groundHere(x, z, y)` to include floors and stairs, and `pickups.landAt` for dropped items.
- **Vegetation is batched.** Near trees are one `InstancedMesh` per species and variant across all cells, re-packed every
  frame in `veg.cull`. Hide or find a tree through `veg.hideTree(cell, i, on)` / `veg.treeAt(mesh, instanceId)` and remove
  it with `veg.remove(cx, cz, i)`; never edit instance matrices directly.
- **Snapping** (`placeGhost` in `build.js`) scores each spot by how near the piece's reference point (a wall's foot, a
  roof panel's lower edge; a floor's whole surface) comes to where the aim lands, or to the line of aim metres before it;
  lining up more points only breaks ties. Gaps between pieces of the same kind are found by the line passing through
  them; doors only go into door frames; pieces must stand on the ground or share a snap point. Overlap and contact tests
  use the pieces' real, turned outlines. **Run `node tests/run.mjs placement build` after any change to `build.js`.**
- **Building pieces need support.** One not held up from the ground collapses on the next recompute; tests that need a
  roof build walls under it.
- Vertex-coloured site models come out several times brighter under the lighting than their palette suggests: keep
  palettes dark (see `MARBLE` in `vegetation.js`).
- The GPU timer is unreliable on ANGLE/Metal; resolution scaling decides on frame time only.
- `pickups.visible` is rebuilt on the next frame after a pickup is taken; checks right after `interact()` must wait.

## Code map
- `src/world`: `gen.js` heights, biomes, the Olympos peak · `sites.js` site placement and pads · `flora.js` species and
  layout · `vegetation.js` near/mid/impostor bands · `trees.js` tree builders, wind and light uniforms · `grass.js` ·
  `terrain.js` + `terrain-worker.js` (worker pool, `pool.js`) · `structures.js` + `greek.js` the sites' buildings and
  props · `sky.js`, `weather.js`, `water.js`, `giantwood.js`, `ambient.js`, `stormwall.js` · `groundcut.js` · `pickups.js`
  · `colliders.js`.
- `src/render`: `core.js` renderer, composer, shadows, adaptive resolution · `atmosphere.js` mist, haze, sun shafts, cloud
  shadows, grade · `occlusion.js` fades what blocks the camera · `fx.js`, `lights.js`.
- `src/player`: `player.js` controller and camera · `hero.js` rig and clips · `footik.js` foot placement · `stats.js` ·
  `held.js`.
- `src/game`: `game.js` wires the systems onto `game` · `items.js` items and recipes · `inventory.js` · `crafting.js` ·
  `harvest.js` · `combat.js` · `trial.js` bosses, clues, offerings · `guide.js` the guided steps · `owl.js` · `save.js`.
- `src/build`: `pieces.js` piece definitions · `build.js` placement, snapping, support. `src/creatures`: `creatures.js`
  AI and spawning · `models.js` bodies. `src/ui`: HUD, map, title, menus, patch notes. `src/audio/sound.js`: synthesised.

## Style
Comments are full sentences that say why, in plain British English, often on the line they explain; dense one-line
statements are the norm in this codebase. Match the surrounding code rather than reformatting it.
