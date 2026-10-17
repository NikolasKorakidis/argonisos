# Argonisos prototype: technical audit

Compared with three well-known three.js worlds: **Bruno Simon's portfolio** (driveable island), **Wildbrush** (painterly foliage and grass) and **Messenger by Abeto** (a small stylised planet you walk around). The comparison is at the level of rendering technique, based on what those projects visibly do. I did not read their source for this audit.

## Measured (software GPU, 800×450, forest view)

| Item | Before | After |
|---|---|---|
| Frame render, Medium preset | 26–29 ms (post-processing chain) | 8.3–8.8 ms (direct render) |
| Post chain share of the frame | ~70 % | 0 % on Low/Medium (High keeps bloom) |
| Player collision per frame | 0.64 ms (all ~3 000 colliders) | 0.37 ms (spatial grid) |
| Interaction scan per frame | 0.40 ms | 0.13 ms |
| HUD DOM rewrites | every 100 ms | only when something changed |

The software GPU is slow, so read these as ratios rather than real frame rates. On real hardware the post-chain saving is larger at high resolution: it was 4× MSAA HalfFloat render targets plus three full-screen passes.

## Where we stand vs. the references

| Area | References | Argonisos | Gap / action |
|---|---|---|---|
| Frame budget | One main pass. Grade and vignette are cheap or baked in. | **Fixed:** grade moved into the tone-mapping chunk, vignette is a CSS overlay, no render targets on Low/Medium. | Done |
| Lighting | Baked lightmaps / AO (Bruno Simon), few dynamic lights | One shadowed sun, hemisphere light, and a pool of 5 point lights for ~20 sources | Next: bake AO into terrain vertex colours under trees and buildings |
| Grass | Dense shell or blade grass reacting to the player (Wildbrush) | Instanced blades, wind, wrap-around tile. **New:** blades part around the player. | Next: distance-based blade LOD, flattened trails |
| Foliage | Painterly alpha cards with normals bent outward | Branching trees with card clusters and crown-normal shading, 2-level LOD | Next: impostors (billboards) for the far LOD would cut ~60 % of tree triangles |
| Water | Stylised depth colour and foam | Depth absorption, caustics, cloud reflection, shore foam | On par |
| Sky / night | Mostly day-only | Stars, Milky Way, moon, aurora, dusk grading | Ahead |
| Atmosphere | Height fog and aerial perspective | Linear distance fog per region | Next: height fog (valleys, marsh mist) |
| Draw calls | Few, heavily merged | 350–550 (chunked instancing) | Next: BatchedMesh per species across chunks |
| Anti-aliasing | FXAA/SMAA or MSAA | Native MSAA (direct path) | Fine |
| Loading | Compressed GLB / KTX2 | FBX in base64 JS (large) | Next: convert models to Draco GLB |

## Changes shipped with this audit
1. Low and Medium render straight to the screen. The colour grade (saturation, warm push, teal shadows, ACES) now lives in `CustomToneMapping`, which every material already runs. Custom shaders (sky, water, waterfall, veil) now include tone mapping and colour-space conversion so they match.
2. The vignette is a CSS radial gradient inside the HUD, so it costs no GPU pass.
3. High keeps the composer (bloom + vignette).
4. Collision uses a spatial grid (8 m cells), the interaction scan skips far pickups early, and the HUD only rewrites its DOM when something changes.
5. Grass blades bend away from the player's legs.

## Recommended next steps (by impact on FPS)
1. Tree impostors for the far LOD (octahedral or 8-view billboards).
2. BatchedMesh per species, to cut ~200 draw calls.
3. Terrain split into chunks with LOD. It is one 180k-triangle mesh drawn every frame.
4. A cached shadow map when the player is still: the sun moves slowly, so shadows can refresh every 4th frame.
5. Draco GLB assets to shorten load times.
