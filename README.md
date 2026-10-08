# Argonisos: the Trial of Zeus

An open-world survival game in three.js, in the spirit of Valheim: you wake on Nisos with nothing, learn what you can
make from what you pick up, build shelter against the cold and the rain, and track down the beasts that rule each land.

## Run
ES modules need a local server:
```bash
npm run dev   # then open http://localhost:8000
```
The dev server reloads open pages when a file changes. three.js r160 is vendored, so it runs offline.
`index.html?play` skips the title screen (handy for testing).

## The trial
- **Explore.** A 2.9 km island: the meadows of **Pedias** in the middle, the dark forest hills of **Yleos** around them,
  and the marsh of **Valtos**, sealed this milestone behind Zeus's storm wall.
- **Craft.** Recipes appear once you've held one of their materials (**C**). Better gear needs a workbench, most of it
  under a roof; stronger materials need the bosses' heads.
- **Survive.** No hunger: health 25 and stamina 50, raised for a while by what you eat (three food slots). Rain soaks
  you, night and wet make you cold; a fire and a roof put that right. Sleep in a bed to wake rested and to come back
  there when you fall (your belongings stay in a grave where you died).
- **Build** with the hammer: walls, floors, roofs, doors, stairs, fences, beams, plus workbench, campfire, cooking
  stand, bed, chest and torches. Pieces snap together and need support: the hammer tints them by how well they're held.
- **The bosses.** Marks carved in ancient olive trees lead to the Minotaur's Labyrinth; carvings in the Giants' caves
  lead to the Chimera's shrine. Lay the tribute on the altar to call the beast, then take its head to the Ancient
  Temple: Zeus grants its power (**F**) and the next tier of crafting. Pray at his altar once a day for his blessing.
- An owl tells you all this the first time you pick something up.

## Controls
WASD move · Shift sprint · Space jump · Ctrl sneak · mouse look (click to lock) · LMB strike / place / loose ·
RMB block, draw the bow, or (hammer) open the build menu · E use · 1–8 hotbar · Tab pack · C craft · M map ·
F power · R turn a piece · MMB / X take a piece down · Esc pause.
Debug: F3 info line · F9 free camera · T (with F3 on) time ×60.

## Code
- `src/world`: generation (`gen.js`), sites, streamed terrain (`terrain.js` + `terrain-worker.js` in a worker pool),
  vegetation in three bands (full trees, light far meshes, impostor cards), grass, sky, water, weather, storm wall,
  pickups, structures.
- `src/player`: the hero rig and its clips, controller and camera, stats, held models.
- `src/game`: items and recipes, inventory, crafting, harvesting, combat, the trial (bosses, clues, offerings), the owl,
  saving.
- `src/build`: building pieces and the build system. `src/creatures`: bodies and AI. `src/ui`: HUD, map, title, icons.
- `src/audio/sound.js`: all sound is synthesised (WebAudio), no files.
- The world saves to browser storage every minute and when the page closes.

## The classic prologue
The earlier quest-driven prototype (Nestor, the Windbinder, the Drowned Ship) is still playable at `classic.html`
(`game.js`, `play.html`).
