# Argonisos: notes for working on the code

A Valheim-style open-world survival game in three.js r160, plain ES modules, no build step. `index.html` loads
`src/main.js`; an import map points `three` at `vendor/three/three.module.js` (add-ons in `vendor/three/jsm/`).
Layout: `src/` the game · `assets/models/` models, textures and packed plant geometry · `vendor/` third-party code (never
edit) · `legacy/` the old prologue prototype (`classic.html`, `play.html`, `game.js`: leave it alone unless asked) ·
`tests/` · `tools/` the dev server and the Claude Code lint hook · `docs/` reviews and audits · `concept/` private.

## Rules
- **`concept/` is private.** The whole folder is git-ignored; its design docs must never be committed, pushed, quoted
  in commits, PRs or patch notes, or served (the dev and test servers refuse `/concept`, the deploy leaves it out).
- Branch before committing; PRs go to `main` (CI refuses any other base: a stacked PR never reaches the live site). Push with `git -c credential.helper= -c credential.helper='!gh auth git-credential' push`.
- Player-facing changes go in the patch notes (`src/ui/patchnotes.js`, the `PATCHES` list) in plain player language.

## Run and test
- `npm run dev`: dev server on :8000 with live reload (`tools/dev-server.mjs`). `index.html?play` skips the title screen.
- `npm run check`: lint (ESLint, mistakes only, no style rules), import cycles (Madge), unused files and dependencies
  (Knip) and the world fingerprint, all without a browser. GitHub Actions runs it on every PR (`.github/workflows/ci.yml`);
  its runners have no GPU, so the game suites below run here, not there. `/check` (a project skill) runs both.
- `npm run test:world`: the world's fingerprint (`tests/suites/world.mjs`): heights, biomes, slope rule, ground colours,
  sites, trees and pickups hashed in Node. Any refactor must leave it unchanged; when the world is *meant* to change,
  `node tests/run.mjs world --update`, paste the new fingerprint, and bump `WORLD_LAYOUT`.
- Claude Code lints every JS file it edits (`.claude/settings.json` → `tools/lint-hook.mjs`) and gets the errors back.
- `npm test`: every suite in `tests/suites` (about 6 min). `npm run test:quick` skips the slow ones (perf, visual,
  creatures). `node tests/run.mjs loop build` runs suites by file-name prefix; `--headed` to watch.
- `npm run test:update`: accept new screenshot baselines after an intended look change (check
  `tests/reports/visual.html` first). Never to make a refactor pass: a changed picture means the game changed.
- Timings depend on the machine: check `uptime` first; with another heavy app running, perf numbers mean nothing.
- `npm run playtest -- --minutes 20 --seed 7`: the bot plays unattended; report in `tests/reports/playtest/<time>/report.md`.
- Tests drive the real game in headless Chrome **on the GPU** (`--use-angle=metal`); without those flags it falls back to
  software rendering at under 1 fps and every timing check is meaningless. They serve the project on their own port
  (no live reload) and talk to the game through `window.AG` (see the end of `src/main.js`).
- A test step is a page snippet returning `true` or a reason string. In snippets `g` is `AG.game`, `P` the player, `B` the
  build system, `C` crafting, `inv` the pack, `V` `THREE.Vector3`: don't redeclare those names.
- Test setup: saving off, `S.peaceful`, clear weather, `g.weatherRain = () => 0` (random rain puts fires out), the owl's
  talks marked heard (her dialogue pauses the world). Screenshot tests also set `S.still` (holds wind, water, clouds and
  the wind lines, which then use one fixed wind).

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
- **One slope rule** (`slopeGrade`, `rockLimit`, `isRock` in `gen.js`: `ROCK_GRADE` 47% / ~25°, lowered by noise in places
  for a ragged edge, never raised) decides bare rock in the ground colour and the terrain's rock surface (`groundColor`'s
  `out[3]` → the `rock` attribute → `rockGround` in `terrain.js`), where nothing grows (grass texture, flora layout) and
  that only stones lie on rock (pickups). Use it; don't measure slope another way for any of these.
- **The meadows' trees grow only in woods** (`pediasWood` in `flora.js`, about 70% of Pedias, glades round the trial's
  places); no tree may stand alone or in a pair there.
  Tree crowns start above 2.9 m (1.5× the hero) at their smallest size (`tests/suites/woods.mjs` checks it).
- **The player's mist** (`atmosphere.js`: clear to `MIST_R0` 60 m, 68% by `MIST_R1` 100 m, ceiling from `tallestNear`)
  lies over the grass's edge (`GRASS_R` 80 m, gone by `GRASS_END` 95 m: a dense near carpet hands over to a sparse far
  one at ~30 m in `grass.js`); all four live in `world/reach.js`. It hides how much less is drawn behind it (`farKeep`/`keepTo` in `vegetation.js`, `FAR_R`
  600, minor sites' `VIEW_R`). Change them together. The focus blur is the `focus` uniform.
- Saves remember felled trees and pickups by their place in the layout: bump `WORLD_LAYOUT` in `save.js` whenever flora
  or pickup layout changes.
- **The ground isn't just `heightAt`.** Buildings reshape the terrain (`groundcut.js`): under a floor it's always cut down
  below the boards; a wall or flat floor *on the ground* (`build.onGround`: not resting on another piece, `restsOn`, and
  the land nowhere more than `FILL_MAX` 2.5 m below its foot) gets the earth raised to it (a flat shoulder wide enough for
  the 2 m terrain mesh, then a bank) and counts as grounded (full support, however long a row). A wall over a bigger drop
  is refused ("build a wall under it first"); cuts always win. `tests/suites/hillside.mjs` builds rows down real slopes. One rule (`shapeGround`) for the terrain shader, the grass map, pickups and walking: use
  `groundAt(x, z)` for where things stand, `player.groundHere(x, z, y)` to include floors and stairs, and
  `pickups.landAt` for dropped items. `heightAt` stays the raw land (support and snapping use it).
- **Vegetation is batched.** Near trees are one `InstancedMesh` per species and variant across all cells, re-packed every
  frame in `veg.cull`. Hide or find a tree through `veg.hideTree(cell, i, on)` / `veg.treeAt(mesh, instanceId)` and remove
  it with `veg.remove(cx, cz, i)`; never edit instance matrices directly.
- **Snapping** (`placeGhost` in `build.js`) scores each spot by how near the piece's reference point (a wall's foot, a
  roof panel's lower edge; a floor's whole surface) comes to where the aim lands, or to the line of aim metres before it;
  lining up more points only breaks ties. Gaps between pieces of the same kind are found by the line passing through
  them; doors only go into door frames; pieces must stand on the ground or share a snap point. Overlap and contact tests
  use the pieces' real, turned outlines. **Run `node tests/run.mjs placement build structures` after any change to `build.js` or `pieces.js`.** Stairs snap and are aimed by the middles of their ends (`aimAt`); fences on the ground follow it.
- **Building pieces need support.** One not held up from the ground collapses on the next recompute; tests that need a
  roof build walls under it.
- Vertex-coloured site models come out several times brighter under the lighting than their palette suggests: keep
  palettes dark (see `MARBLE` in `vegetation.js`).
- The GPU timer is unreliable on ANGLE/Metal; resolution scaling decides on frame time only.
- `pickups.visible` is rebuilt on the next frame after a pickup is taken; checks right after `interact()` must wait.
- **Heavy, pure work goes to the worker pool** (`world/pool.js`): terrain patches, flora cells and blocks, the grass
  texture, the map, and each cell's pickups (`pickup-layout.js`, laid out off the main thread: a cell's pickups appear a
  moment after you reach it). Jobs wait in one queue and run most urgent first (`PRIORITY`: the grass under your feet,
  then near terrain, trees and pickups, then distant blocks); a worker runs one job at a time and its reply is that job's.
  Anything a worker imports must stay free of three.js and the DOM.
- Shared helpers (`clamp`, `lerp`, `smooth`, `seeded`, `hash21`, `tileNoise`) are in `src/util/math.js`; don't define
  them again. The world's own noise (`noise`, `fbm`, `hash2`) belongs to `gen.js`.
- **Weather look** (graphics plan in `docs/plans/graphics-plan.md`): one wetness (`wetness.js`: `wettable()` patches a
  material, each kind with its own program key; clones lose patches, so placed pieces use `wetLike`), one wind
  (`wind.js`: direction, speed, gusts → `WIND_U` in `trees.js`: grass, flowers, trees, clouds, rain and wind lines all follow it), and the shelter maps (`wetness.js`, two
  top-down depth maps of roofs/buildings and tree crowns round the player, kept up to date): under cover no rain falls,
  nothing gets wet and no wind lines blow. Rain and wind lines are GPU-only (`rain.js`, `wind.js`).

## Code map
- `src/world`: `gen.js` heights, biomes, the Olympos peak · `sites.js` site placement and pads · `flora.js` species and
  layout · `reach.js` how far the mist and grass reach · `vegetation.js` near/mid/impostor bands · `trees.js` tree builders, wind and light uniforms · `grass.js` ·
  `terrain.js` + `terrain-worker.js` (worker pool, `pool.js`) · `structures.js` + `greek.js` the sites' buildings and
  props · `sky.js`, `weather.js` (+ `rain.js`, `wind.js`, `wetness.js`), `water.js`, `giantwood.js`, `ambient.js`, `stormwall.js` · `groundcut.js` · `pickups.js`
  (+ `pickup-layout.js`) · `colliders.js`. `src/util/math.js` shared helpers. `src/assets.js` model and texture loading.
- `src/render`: `core.js` renderer, composer, shadows, adaptive resolution · `atmosphere.js` mist, haze, sun shafts, cloud
  shadows, grade · `occlusion.js` fades what blocks the camera · `fx.js`, `lights.js`.
- `src/player`: `player.js` controller and camera · `hero.js` rig and clips · `footik.js` foot placement · `stats.js` ·
  `held.js`.
- `src/game`: `game.js` wires the systems onto `game` · `items.js` items and recipes · `inventory.js` · `crafting.js` ·
  `harvest.js` · `combat.js` · `trial.js` bosses, clues, offerings · `guide.js` the guided steps · `owl.js` · `save.js`.
- `src/build`: `pieces.js` piece definitions · `build.js` placement, snapping, support. `src/creatures`: `creatures.js`
  AI and spawning · `models.js` bodies. `src/ui`: HUD, map, title, menus, patch notes, `icons.js` (+ the black-figure
  `icon-set.js`, shared with the prototype). `src/audio/sound.js`: synthesised (its context opens while the world loads).

## Style
Comments are full sentences that say why, in plain British English, often on the line they explain; dense one-line
statements are the norm in this codebase. Match the surrounding code rather than reformatting it.
