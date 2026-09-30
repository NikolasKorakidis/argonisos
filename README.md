# Argonisos — Island Prologue (three.js prototype)

A playable concept slice for testing ideas before building them in Unity.

## Run
ES modules need a local server (opening the file directly won't work):
```bash
cd prototype/argonisos
python3 -m http.server 8000   # then open http://localhost:8000
```
three.js r160 is vendored (`three.module.js`), so it runs offline.

## Loop
Story cards → meet Nestor (tutorial cards) → craft a stone axe → gather berries + sacred olive branch → offering at the Temple of Athena → report to Nestor → craft spear → campfire → hunt rabbits & boar, cook meat → survive a night (wolves) → clear 3 skeletons at the hilltop ruins, loot the sailcloth → build the raft at the south dock → sail to Pedias.

## Controls
WASD move · Shift sprint · Mouse look (click to lock) · LMB swing · E interact · F eat · 1–3 tools · C craft · R rest at fire · Space jump · Esc pause

Playtest keys: **T** time ×10 · **G** +10 materials · **N** skip current quest. State is on `window.ARG` in the console.

## Tuning knobs (game.js)
- `DAY_LEN`: seconds per day (300)
- `TYPES`: creature hp/speed/damage/drops
- `TOOL_STATS`: tool damage, gather power, reach
- `RECIPES` and the raft cost in `buildRaft()`
- Hunger drain in `updateWorld()` (`0.28`/s)

Characters are procedural placeholders. Swap `makeHumanoid()` / `makeQuad()` for GLTF assets later.

## Graphics
Reflective sea (planar mirror), physical sky with image-based reflections, soft shadows, bloom and vignette, and about 60k wind-animated grass blades plus wildflowers. Pause menu → **Graphics** switches to Performance mode (plain water, no post-processing) for slower machines.

## World (v2)
~580 m island (≈9× the original area), nine regions linked by trails:
Nestor's Cove (start) · Hill of the Fallen (skeletons) · Hylaea Woods (dense forest) · Stymphalian Marsh (swamp) · Mount Olympos (90 m, snow, cold) ·
Cave of Echoes (crystals + empty altar, reserved for future content) · Lake Kastalia (waterfall) · Temple of Athena · Olive Terraces (vineyard, farmhouse) · Watchtower of Aeolus (climb to reveal the map).

- Region title banners, map fog-of-war that clears as you explore, **M** for the full map, **Tab** inventory, **C** crafting
- Trees: 7 species × 3 variants, merged + instanced per 100 m chunk (thousands of trees, few draw calls), wind sway in the shader
- Graphics preset defaults to **Performance**; High adds reflective sea, bloom, full grass density, sharper shadows
- Layout constants (`MOUNT`, `CAVE`, `TEMPLE`, …) and `FLORA` densities at the top of `game.js` control the whole map

## v5: sound, intro cinematic, quest markers
- **Audio** (`audio.js`): fully procedural WebAudio. Footsteps per surface (grass, dirt, stone, sand, water, cave), swings, wood/stone/flesh hits, bow, pickups, crafting, UI; ambience (wind by altitude, surf by the shore, waterfall, birds by day, crickets and wolf howls at night, cave drips with reverb, fire crackle); a generative lyre + drone score in D Dorian that changes with mood (title, explore, night, cave, cinematic). Volume sliders in the pause menu.
- **Intro cinematic**: the menu fades, letterbox bars come in, the camera flies over the mountain, the temple and the olive terraces while the story is narrated, then lands at the cove where Zeus delivers you in a column of light. Skip with the button, Space, Enter or Esc.
- **Quest markers** (WoW convention): gold `!` = someone has a task for you, gold `?` = hand in / deliver here. Shown in the world and on the minimap and map.
- **The Ascent**: a paved switchback road cut into Mount Olympos from the cave trail to the summit arena: retaining wall, rope posts, steps on the steep parts, torches, a marble gate at its foot.
- **Paths**: every trail is now a smoothed, textured ribbon (dirt with cart ruts; paved Sacred Way to the temple).
- **Cave mouth**: natural rock arch, dark depth veils that fade as you enter, entrance torches.
- **Temple of Athena**: Doric peristyle with entasis columns and echinus capitals, painted triglyph/metope frieze, sculpted pediments, tiled roof with antefixes, pronaos with bronze doors, coffered ceiling, polished floor, two-tier inner colonnade, reflecting pool, offering table, owls on plinths, and a chryselephantine Athena Parthenos with Nike, shield, serpent and spear.
- **Performance**: pickups merged per material, cave interior merged and distance-culled, creatures culled tighter (and hidden on the title), Low refreshes shadows every other frame.

## v6: cutscene camera, trees, summit arena
- **Intro** now loops the whole island (sea, marsh, woods, watchtower, summit arena, waterfall, temple, olive terraces, cove) in ~53 s, with camera banking on turns and a slow FOV breathe.
- **Conversations** play as cutscenes: letterbox, over-the-shoulder shots that cut between speakers and drift slowly. The offering to Athena gets its own push-in shot on the statue.
- **Trees** are grown from a branching generator: gnarled trunks with knots and roots, limbs forking into twigs, and leaf clusters at every twig tip (oak, birch, autumn oak, and twisted, often split-trunk olives).
- **Summit**: the mountain is bigger and its peak is cut into a ~76 m paved arena ("Throne of Olympos") with a ring of broken columns, four great braziers, and the ruins of a Temple of Zeus: broken peristyle, a standing corner with its painted entablature, a fallen pediment, ruined cella walls and Zeus' empty colossal throne with his fallen head. Built for the boss fight.
- **No bow on Nisos**: bow pickup, arrow recipe and slot 4 removed.
