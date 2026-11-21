# Argonisos: graphics and look review (20 Nov 2026)

> Kept from the review round of 20 November 2026. The screenshots, probe scripts and raw logs it names were in the
> reviewer's scratch folder and are not kept; the line numbers are as of the commit it names.

**Scope.** I looked at 48 screenshots at 1280×720, taken in the real game on the GPU. Most are on High; a subset was repeated on Ultra (`?gfx=ultra`). The views cover:
- Pedias by day, dusk, night and rain;
- Yleos by day, night and in deep fog;
- the giant forest, the shore, Olympos and the storm wall, each from the ground and from 60 m up;
- the temple, the farmhouse, the town, a spot and the Labyrinth;
- a hut with fires at night;
- the hero in the Cretan set, the creatures, and the HUD.

I also read the render code: core.js, atmosphere.js, sky.js, clouds.js, water.js, grass.js, terrain.js, vegetation.js, storm-shader.js and lights.js.

**Where things are.**
- Screenshots: `scratchpad/review/shots/graphics/<name>-<high|ultra>.png`. Below I write only `shots/<name>-high.png`.
- Shot scripts: `scratchpad/review/gshots.mjs` with `spec.json`, `spec2.json` and `spec3.json`. They take a `gfx` argument and can be re-run.

**Caveat.** The machine was under heavy load while I worked: a load average of 12 to 18, with the other reviewers' browsers running. The fps numbers in the logs therefore mean nothing. The pictures are fine.

**How to read effort and payoff.** Effort: S is under half a day, M is one to three days, L is more. Payoff: ★ to ★★★.

---

## Ranked findings

### 1. Zeus's storm wall reads as a black hole in the sky. Effort S/M, payoff ★★★
- **Evidence:**
  - `shots/meadow_horizon-high.png` and `-ultra.png`: a pitch-black mass covers a third of the sky.
  - `shots/meadow_day-high.png`, `hero_back-high.png` and `creatures-high.png`: the whole top of the frame is near #000.
  - `shots/stormwall-high.png`: the sky is pure black above the trees.
  - `shots/vista_storm-high.png` and `vista_storm_air-high.png`.
  - `shots/meadow_dusk-high.png`: a brown-black blot sits over the sunset.
  - Much of Pedias faces north-west, so this is in a large share of everyday frames, including the visual-test baselines (`tests/reports/visual/meadow.png`).
- **Cause:** the march gives the cloud almost no light and almost no aerial perspective.
  - `src/world/storm-shader.js:122-126`. The surface light is scaled by `bump² × 1.6 × (0.2+0.8·skin) × 0.4`. Inside the cloud it falls to `ambCol*0.1`, and the lower half is "sunk in its own shadow".
  - `src/world/stormwall.js:148`. `fogV = max(fog.far*2.2, 170)` is about 7 km on a clear day, so at 700 m the fog takes only ~10% (`fogMax` 0.62 is never approached).
  - `stormwall.js:242-243`. `ambCol` is the hemisphere light, roughly halved.
- **Fix:**
  1. Give the wall its own aerial perspective by day. A `fogV` of about 900–1200 m makes it a slate-blue that deepens towards its foot.
  2. Raise the base surface term about 3× (0.4 → ~1.2) and lift the inner floor from `ambCol*0.1` to ~0.3.
  3. Add a silver lining on the sun-facing billow tops: `sunCol * pow(1-|N·V|,3) * max(N·sunDir,0)`.
  4. Keep the foot dark. Valheim's walls are dark but read as cloud, never as a void.
  5. Re-baseline the visual suite afterwards.

### 2. The clouds look like floating grey rocks. Effort S/M, payoff ★★★
- **Evidence:**
  - `shots/meadow_horizon-high.png` and `vista_olympos-high.png`: many small flat-shaded lumps look like pebbles in the sky.
  - `shots/hero_front-high.png`: a grey boulder floats top right.
  - `shots/shore_sunset-high.png`: brown "sandstone" clouds.
  - `shots/labyrinth_low-high.png`: a cloud close up reads as a tan cliff.
  - `shots/base_night-high.png`: grey rocks against the stars.
- **Cause:**
  - The shapes are faceted with hard normals ("faceted like the rest of the island", `clouds.js:1-9`; the shapes come from `tools/assets/clouds.py`).
  - The lit side is no brighter than the sky behind it. `clouds.js:385` sets `uLit = sun.color × min(3.2,I) × 0.36` (≈1.0). `clouds.js:386` sets `uAmb ≈ 0.55·hor + 0.25·top + 0.33`. The shaded sides come out grey-blue, darker than the horizon.
  - The many small puffs read as debris.
- **Fix:**
  1. Smooth the normals on load (`mergeVertices` + `computeVertexNormals`, or blend 70% towards the normal from the cloud's centre). The silhouette stays low-poly but the shading becomes soft.
  2. Make the sunlit top about 1.5–2× the horizon's brightness (uLit × 1.6) and raise the shade's floor to about the horizon colour.
  3. Soften the base: an alpha or dither fade over the bottom 15%.
  4. Cull or enlarge the smallest puffs, which never read as cloud at any distance.
  5. At night, pull clouds towards the sky colour with only a moonlit rim.

### 3. On High, the player's mist turns every view into a pale grey band with a ceiling. Effort M, payoff ★★★
- **Evidence:**
  - `shots/meadow_day-high.png`, `ui_day-high.png`, `vista_storm-high.png` and `hero_back-high.png`: everything past ~100 m is a flat milky band of one colour, with a horizontal top edge.
  - Compare `shots/meadow_horizon-ultra.png`, where the same view on Ultra has crisp tree lines and reads as a real landscape.
  - From the air (`shots/vista_olympos_air-high.png` and `labyrinth_air-high.png`) the mist is a milky disc round the hero.
- **Cause:** `src/render/atmosphere.js:46` (`mzAmt` 0.68 on High) and `:318-323`.
  - The mist is one flat colour (`mzCol` ≈ the fog colour), the same in every direction.
  - It is cut off at `mzTop`, so the sky above the ceiling is clear and the band below is not.
  - It is centred on the player (`mzC`), not the camera.
- **Fix:**
  1. Colour the mist like aerial perspective. Mix towards the sky dome's colour along the view direction (`mix(hor, top, …)`, as `skyAt` does in clouds.js), plus sun in-scatter (`sunCol·pow(toSun,6)`, as the valley mist already does).
  2. Fade it in by height above the ground under each point instead of a ceiling across the screen.
  3. Lower `mzAmt` on High to ~0.5 and lengthen `mzSoft` (10 → 25).
  4. This keeps the perf trick (it still hides the thinned bands) but turns a grey wall into depth.
  5. Run `tests/suites/light.mjs` and `mist.mjs` afterwards.

### 4. The sun flecks on the floor are hard, stair-stepped and lime-bright. Effort S, payoff ★★
- **Evidence:**
  - `shots/olympos_far-high.png` and the 2× crop `shots/crop_flecks.png`: the shadow-map texels show as blocky staircases.
  - The lit patches are a flat lime about 1.6× the surrounding grass.
- **Cause:** `src/render/atmosphere.js:110-112` (`nearLit`).
  - It makes a single unfiltered `step()` look-up in the shadow map. The material's own shadow (core.js `sunBil`) is bilinear-filtered, so the fleck pass re-sharpens soft shadows.
  - At `:296` the lit side is multiplied by `1 + 0.35·1.7·k` on top of sunlight the material already has.
- **Fix:**
  1. Do a 2×2 bilinear PCF in `nearLit`, the same as `sunBil`, or skip the fleck where the material already took the shadow.
  2. Halve the gain (0.35 → 0.15), so the flecks are a warm accent rather than a second sun.

### 5. The forest "roots and litter" floor is painted on beaches and on the summit. Effort S, payoff ★★
- **Evidence:**
  - `shots/shore-high.png`, `shore_along-high.png` and `-ultra.png`: black scribbles across the sand.
  - `shots/summit-high.png`: the same scribbles on the summit rock.
  - It reads as cracks or graffiti.
- **Cause:** `src/world/terrain.js:156-166` (FLOOR).
  - `froot` and the litter are weighted by `vBio.x`, the Yleos biome weight, not by whether there is any wood.
  - The east coast and Olympos lie in Yleos.
- **Fix:** gate `fy` by how wooded the place is and by height above sea. Two ways to do it:
  - Use the woods texture already baked for the atmosphere (`ATMO.tWoods`, r channel). Pass it to the terrain material, or bake it into the `bio` attribute in terrain-worker.js.
  - Or multiply by `smoothstep(1.5, 4.0, vRockP.y)` and by `1 - sand` from the ground colour.
  - Also lower the root contrast (0.45 → 0.25).

### 6. Rain and overcast don't change the grade. Effort S, payoff ★★
- **Evidence:** `shots/meadow_rain-high.png`. Under heavy rain the meadow stays sunny lime and yellow and the flowers stay vivid; only the sky greys. Valheim's rain drains the colour and drops the contrast.
- **Cause:**
  - `src/render/atmosphere.js:390-397`. `grade()` blends pedias, yleos, dusk, night and giant, but takes no weather input.
  - `src/world/grass.js:98, 223`. The grass is barely wettable (`dark: 0.82`).
- **Fix:**
  1. Add a `wet/overcast` grade entry and weight it by `o.overcast` and the rain amount: about sat 0.72, a tint of (0.94, 0.98, 1.04), and a slight lift of the blacks.
  2. Darken the grass to ~0.65 in rain.
  3. This is the cheapest form of graphics-plan item 7.2.

### 7. Shade is too blue or mauve. Effort S, payoff ★★
- **Evidence:**
  - `shots/pedias_wood-high.png` and `spot-high.png`: the trunks read lilac or purple.
  - `shots/temple_close-high.png`: the marble floor in shade reads saturated blue, like water.
  - `shots/base_night-high.png`: the hero is lavender.
  - `shots/forest_up-high.png`: a pale-blue boulder.
- **Cause:** the shade is lit by a strongly blue sky term.
  - `core.js:31`: hemisphere `0xbfdcff` over `0x3f6a5a`.
  - `sky.js:155-156`.
  - `sky.js:44` and `:63-73`: the PMREM environment is baked from three's physical `Sky` (turbidity 1.8, rayleigh 3), which is very saturated. It is copied at full colour.
  - Brown bark plus a saturated blue fill gives mauve.
- **Fix:**
  1. Desaturate the environment in `envCopy`, e.g. `mix(vec3(luma), c, 0.55)`.
  2. Warm and darken the hemisphere's ground colour (≈`0x4a4a32`).
  3. In the woods, tint the sky's light green (`envK` already dims it there; also tint it).
  4. Check the vertex-coloured pack trunks after the change.

### 8. The grass is over-saturated lime and yellow, lit flat, and has spike-like blades. Effort S/M, payoff ★★
- **Evidence:**
  - `shots/labyrinth-high.png`: a sea of uniform lime.
  - `shots/meadow_day-high.png` and `vista_olympos-high.png`.
  - `shots/forest_day-high.png` and `forest_up-high.png`: the Yleos blades are rows of fat green cones.
  - `shots/labyrinth_air-high.png`: from above, the sparse far carpet is green confetti on olive-yellow ground.
- **Cause:**
  - `src/world/grass.js:32-33`: the tips are `0x7fae45` and `0xc9c35a`, which is near-yellow.
  - `grass.js:47`: the normal is forced to (0,1,0) "like a painted field", so no blade is shaded differently from its neighbour.
  - The ground under the grass keeps its own colour.
- **Fix:**
  1. Lower the tips' saturation and value (`uTipB` → ≈`0xa9a85c`, `uTipA` → ≈`0x6f9a40`).
  2. Blend 25–35% of each blade's own normal back in (graphics-plan 4.2).
  3. Pull the terrain colour towards the grass's mean colour by the grass amount, so a thin carpet blends in.
  4. In Yleos, shorten and narrow the blades, or swap them for the pack's fern or grass clumps; the near carpet reads as spikes.

### 9. The focus blur at the screen's edges softens the sky and periphery on High. Effort S, payoff ★★
- **Evidence:** every High shot. The clouds, the storm and the corners are blurred: `meadow_horizon-high.png`, `vista_storm-high.png`, `summit-high.png`. It reads as a low-resolution or tilt-shift picture. Ultra uses 1.5.
- **Cause:** `src/ui/settings.js:34` (High has no `focus`, so the default is 3) and `atmosphere.js:264`.
- **Fix:**
  - High at 1.0–1.5, and never on the sky (`d ≥ 0.99999`).
  - Or a "focus blur" toggle in Graphics, off by default.
  - This is a one-line change.

### 10. Fire light is weak, small and unshadowed; moonlit bare ground looks like snow. Effort S (light) / M (shadows), payoff ★★
- **Evidence:**
  - `shots/base_night-high.png` and `-ultra.png`: two campfires light a ~2 m pool. The hut's front and the hero barely warm, and nothing casts a shadow.
  - The bare earth between the grass is pale grey-white under the moon, like frost or snow. It also shows in `meadow_night-high.png`.
- **Cause:**
  - `src/build/build.js:604`: intensity 26 × `min(1, 0.4 + fuel/3)`, reach 22 m, decay 1.6.
  - `lights.js`: no shadows.
  - The ground's pale dirt colour plus `groundDetail` (core.js: strokes at 185–255) under the moon's silver light.
- **Fix:**
  1. Make the fire 1.5–2× brighter, with decay 2 and a reach of ~14 m, so the near ring is bright and falls off faster. Flicker the radius as well as the intensity.
  2. Give the nearest fire a 512² cube shadow, refreshed every other frame. This is Valheim's signature night look and the best single upgrade for the base at night (M).
  3. Darken the dirt's albedo, or cut the moon's specular on it.

### 11. Distant forests: impostors dark, flat and dithered, and no trees past FAR_R on High. Effort M, payoff ★★
- **Evidence:**
  - `shots/vista_olympos_air-high.png`: the near trees are bright, the mid and impostor band nearly black-green. The forest stops and leaves bare pale plains (FAR_R 600). Ultra (`-ultra.png`) is much better.
  - Checkerboard dither squares where bands hand over: `hero_dusk-high.png` (x≈990,y≈370), `hero_front-high.png` (x≈400,y≈365), `meadow_horizon-ultra.png` (x≈400,y≈300).
  - Light halo fringes on crowns against the storm: `vista_storm_air-high.png`.
- **Cause:**
  - `vegetation.js:219-232`: unlit `MeshBasicMaterial` impostors, baked from one fixed side light (`buildAtlas`, :198-200). Their brightness comes from one scalar (`:344`).
  - `atmosphere.js:289`: `woodsDark` 0.3 on top.
  - `vegetation.js:16-20`: `FAR_R`.
  - `DITHER` (:173): a fixed ordered pattern.
- **Fix:**
  1. Brighten and lift the impostor scalar so the mid band matches the near trees; check from the air.
  2. Lower `woodsDark` to ~0.15.
  3. Push impostors (they are cheap) to ~1000 m on High.
  4. Make the dither blue-noise and temporal (offset by `ATMO.frame`), so the MSAA and TAA-free resolve averages it.
  5. Longer term: normal-mapped octahedral impostors (graphics-plan 5.4).

### 12. Shore and sea: low contrast, one white foam band, a noisy reflection on Ultra. Effort S/M, payoff ★★
- **Evidence:**
  - `shots/shore-high.png` and `shore_along-high.png`: a pale teal sea, a washed-out sky, and one even white stripe of foam all along the beach.
  - `shots/shore_along-ultra.png`: speckled noise in the screen-space reflection of the tree line (x 100–300, y 360–390), and odd green speckled streaks across the sky (source not identified; they may be the wind lines or drifting leaves at 8× alpha-to-coverage).
- **Cause:**
  - `src/world/water.js:66-70`: the foam is `pow(edge,3)·1.3` plus laps, so a solid line at any depth under ~0.3 m.
  - `water.js:77`: the colours. The deep `0x0a3b66` is fine, but `mix(body, refl, F·0.85+0.04)` and the pale `uHor` wash it out.
- **Fix:**
  1. Break up the foam: mask the solid line with low-frequency noise along the shore, and run the laps as fronts rolling in with a period.
  2. Deepen and saturate the body past 2 m.
  3. Cap the sky reflection by ~0.6 at grazing angles.
  4. On Ultra's SSR, clamp the step jitter and blur the hit by distance (it already blurs a little; more is needed at the tree line).

### 13. The tone mapping looks flat and grey. Effort S, payoff ★★
- **Evidence:** `shots/shore_along-high.png`, `vista_storm-high.png` and `forest_fog-high.png`. Midtones are low-contrast and the distance washed out. Valheim's picture has deeper blacks and more punch.
- **Cause:** `src/render/core.js:14-18`. Three's AgX in r160 is the "base" look, with no contrast or punch. The custom pre-grade only adds saturation.
- **Fix:**
  1. Apply a gentle S-curve after `AgXToneMapping` (AgX's "Punchy" look: contrast ~1.12 about 0.18, saturation 1.05).
  2. Or raise exposure 5% with a slight toe.
  3. One expression; re-baseline the visual suite afterwards.

### 14. Carved placeholders and props clash with the pack art. Effort M, payoff ★★
- **Evidence:**
  - `shots/temple-high.png`: the Italian cypresses (structures.js:82, `CYPRESS`) are flat-shaded green blobs next to textured pack olives and planes.
  - `shots/summit-high.png`: the altar is flat beige slabs.
  - `shots/forest_up-high.png` and `forest_day-ultra.png`: the lightstone pickup reads as a pale-blue untextured boulder (pickups.js:65, `bright: 4`).
  - `shots/labyrinth_air-high.png`: the Labyrinth's paving is a flat disc with a hard round edge on the meadow, with no rubble, grass creeping in or worn edge.
  - `shots/creatures-high.png`: the deer is a vivid orange (vertex colours brightened by the light, CLAUDE.md).
- **Fix:**
  - **Cypress:** add leaf cards, using the pack's conifer foliage cards on a narrow carved core.
  - **Lightstone:** a smaller crystal cluster with a faint emissive core, not a 1 m boulder.
  - **Labyrinth pad:** a ragged edge (noise on the radius), grass clumps allowed on the outer ring, a few rubble pieces.
  - **Deer palette:** darken it.

### 15. Olympos is a smooth cone at middle distance on High. Effort M, payoff ★
- **Evidence:**
  - `shots/vista_olympos_air-high.png`: a grey-green, almost featureless cone with one pale snow shape.
  - On Ultra (`-ultra.png`) there is more relief and rock.
- **Cause:**
  - The terrain's rock texture and relief fade by 70–110 m (`terrain.js` rock relief and `rbk`).
  - The far LOD is coarse on High (`SPLIT` 1.35, terrain.js:13).
- **Fix:**
  - Keep a macro rock tone and strata term at distance (the existing `rmacro`/`rbroad` channels only, no fine detail).
  - Darken the gullies by slope or curvature in the ground colour.
  - A broken snow line from noise instead of one blob.

### 16. Fog edges and the depth resolve. Effort M, payoff ★
- **Evidence:**
  - `shots/vista_storm_air-high.png`: bright fringes on silhouettes against the storm and the mist.
  - `shots/forest_fog-high.png`: dark, unfogged leaf specks in the near crowns.
- **Cause:** the atmosphere pass reads the multisampled scene's resolved depth (one sample) against an averaged colour. Edge pixels marked as sky get sky-only treatment.
- **Fix:** for `d ≥ 0.99999`, look at the 4 neighbours' depth and use the nearest geometry depth for the mist, low fog and storm composite (a depth dilation).

### 17. UI legibility over the game. Effort S, payoff ★
- **Evidence:** `shots/ui_day-high.png`.
  - In Stoix, the clock's zero reads "12:3⊘", like the empty-set sign. Use Alegreya Sans or Cinzel for digits.
  - The hotbar's slot numbers are tiny and the slots are dark on dark.
  - The minimap shows a blurred green blob on parchment.
  - The compass strip sits straight on the black storm with no plate under the letters.
- **Fix:**
  - Digits in a numeral-safe font.
  - A light plate or text shadow under the compass letters.
  - A sharper minimap (higher resolution or ink outlines; graphics-plan Phase 10).

### 18. Hero close up. Effort S, payoff ★
- **Evidence:** `shots/hero_front-high.png`, `hero_back-high.png` and `hero_dusk-high.png`.
  - The gold armour is plain matte yellow plastic (`hero.js:417`: roughness 0.8, metalness 0).
  - The face is featureless at 2.6 m.
  - Nothing rims the hero against busy grass.
  - The Cretan cape was worn (`hero.wear` reported it) but is **not visible** in the back view. This needs a check in `cape.js` or `hero.js:451`; it may be a gameplay bug rather than a look one.
- **Fix:**
  - A metalness/roughness mask for the gold and bronze parts (≈0.6 / 0.4, so they pick up the environment).
  - A faint fresnel rim term on the hero and creatures, about 0.15 of the sky colour.
  - Look into the cape.

### 19. Smaller items
- **Fire smoke** (`shots/base_day-high.png`): white opaque puffs like popcorn. Make them soft, grey-brown, alpha-fading and wind-blown (graphics-plan 8.2).
- **Grass after teleports and respawns:** grass is missing for several seconds (the grass texture re-bakes after a long jump; `shots/town-high.png`, `spot-high.png` and `olympos_far-high.png` show bare lawns). In the game this shows after respawning or teleporting. Make the bake under the player more urgent, or hold the old carpet visible until the new one arrives.
- **Night sky** (`shots/meadow_night-high.png`): the clouds become large out-of-focus blue blobs (partly the focus blur, finding 9).

---

## Bigger ideas, worth the effort later

1. **One aerial-perspective model.** Replace the stack of three's linear fog, the player's mist, the valley mist and the haze with one height fog. Its colour should come from the sky in that direction plus a sun lobe (a small LUT of sky colour by view elevation and sun angle). This fixes findings 3 and 16 at the root and makes vistas read like Valheim's soft blue distance. The far-band savings can stay hidden behind it.
2. **Soft, lit cumulus.** Reuse the storm wall's quarter-resolution raymarcher, which already exists, is temporally stable and is depth-aware. Run it on a thin cumulus layer (2D weather-map noise × height profile) on High and Ultra. Fall back to finding 2's smoothed meshes on Medium.
3. **Shadow-casting fire with embers and heat haze.** One shadowed point light for the nearest fire, ember particles, a slight refraction shimmer above flames, and warm light spilling from doorways at night (graphics-plan 6.4).
4. **A LUT grade per biome, hour and weather** (graphics-plan 7.2). Author 3D LUTs from in-game screenshots in an image editor. This replaces the hand-tuned `G` table and gives art direction precise control.
5. **Real ground materials** (graphics-plan 3.1): sand, dirt, meadow soil, forest litter, rock and snow, height-blended and anti-tiled. The beach and summit problems in finding 5 are symptoms of the floor being one procedural texture.
6. **Normal-mapped octahedral impostors and impostors to the horizon on High.** The island should read as wooded all the way out from any hill.
7. **Exposure adaptation** (graphics-plan 7.3) between meadow, deep woods and caves, so the forest can be truly darker without a manual grade.
8. **Wet look everywhere in rain:** trees' bark and leaves, the hero, and puddles on paths. Pair it with the weather grade in finding 6 so storms feel different.

## What already looks good
These are worth keeping as they are:
- The night forest (`forest_night-high.png`) and the deep fog have real mood.
- The dusk sky gradient, with the Belt of Venus and a warm horizon (`hero_dusk-high.png`).
- The Yleos conifers and giant-forest trunks up close.
- The temple's marble veining.
- Ultra's crisp far tree lines and sharp tree shadows (`forest_day-ultra.png`), which are close to Valheim's look.
- The new hero model in the Cretan set.
