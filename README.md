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
Talk to Nestor → gather wood/stone/fiber → craft axe + spear → campfire → hunt rabbits & boar, cook meat → survive a night (wolves) → clear 3 skeletons at the hilltop ruins, loot the sailcloth → build the raft at the south dock → sail to Greece.

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
