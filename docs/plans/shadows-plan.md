# Shadows and shade: the plan

Our own summary, November 2026. The player asked for "the next level" of shadows: the trees' shade in the forest, and
in the open the hero's, the rocks' and everything else's, without making the game heavy. This page lists what three.js
r160 offers, what similar games do, what each option costs us, and what we built (Patch 19).

## What we found in our own game first

- **The trees cast no shadows at all.** Patch 18 moved each tree's shadow onto a light stand-in, on a layer that only the
  sun's shadow camera sees. But three r160 decides what goes into a shadow map from the *viewing* camera's layers, not
  the shadow camera's (`WebGLShadowMap.renderObject` tests `object.layers.test(camera.layers)` with the main camera; this
  is still true at r185, and only three's development branch has changed it). In the forest, 5% of the shadow map was
  covered; with the stand-ins drawn it is 58%. Fixing this was the biggest single gain.
  Source: [r160 WebGLShadowMap.js](https://raw.githubusercontent.com/mrdoob/three.js/r160/src/renderers/webgl/WebGLShadowMap.js).
- **Shadows read faint.** The sky lights our world far more than the sun does. `scene.environment` (the sky, prefiltered)
  plus the hemisphere light give about 79% of a meadow's brightness; switching the sun off left the ground at 151 of 191
  levels. So a shadow that only removes the sun is a 20% smudge.
- **They ended 40 m out**, the edge of an 80 m box round the player, and the meadow grass and flowers didn't take them.

## The options, ranked by how much they change the feel for what they cost

| # | Option | Impact | Cost | Built |
|---|--------|--------|------|-------|
| 1 | Make the trees' shadow stand-ins reach the shadow map (draw each map with its own camera's layers) | Very high: the forest gets its shade, dapple and beams back | Shadow pass grows by about 60k triangles and 30 draws in the woods | **Yes** |
| 2 | A shadow takes a share of the sky's light too (the caster hides part of the sky) | High: shadows go from a smudge to a real shade, in every scene | Two multiplies per pixel; no draws | **Yes** |
| 3 | A second, coarse cascade out to 110 m, blended with the near one | High in woods and long views; medium in open meadow | About 90 draws and 0.15–0.35M triangles, about 1.5–2 ms, but only on the frames that redraw it (about once a second walking, never standing still) | **Yes** |
| 4 | Screen-space ambient occlusion, half resolution, navy tint | Medium-high: rocks sit in the ground, trunks meet the earth, steps and corners read | Two half-resolution passes; within the noise of our frame timing (whole offscreen frames with it matched HEAD's) | **Yes** (our own, see below) |
| 5 | Grass and flowers take the sun's shadow from low on the stem | Medium: tree, rock and hero shadows lie across the meadow | One extra bilinear lookup per blade pixel | **Yes** |
| 6 | Soft shadows that harden at contact (PCSS-style) | Medium: crown shade soft, feet and stones sharp | 21 texel reads per pixel (three's PCF soft filter reads 25) | **Yes, a light version** |
| 7 | Far forests darkened beneath their crowns past the shadow maps | Low-medium: far woods read dark beneath and lit on top | One texture read per far pixel | **Yes** |
| 8 | Full cascaded shadow maps (three's `CSM` add-on, 3–4 cascades) | High | One pass per cascade; breaks our materials (below) | No |
| 9 | Screen-space contact shadows (Days Gone style ray march in the depth buffer) | Medium for small detail | A full-screen march; overlaps what 4 and 6 give | Later |
| 10 | Baked vertex AO in tree crowns and on rocks | Medium | An asset-pipeline job; option 2 already darkens crowns from inside | Later |

### Why not three's CSM add-on

`CSM.setupMaterial` *replaces* each material's `onBeforeCompile` (ours are patched for wind, wetness, the ground and the
grass), and the add-on rewrites `lights_fragment_begin` for every material on the page, so any material not set up is
lit once per cascade. It also needs one shadow-casting light per cascade.
Sources: [r160 CSM.js](https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/jsm/csm/CSM.js),
[CSMShader.js](https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/jsm/csm/CSMShader.js).
We built the same idea in two cascades with a small, global shader-chunk patch instead (below).

### Why our own AO rather than N8AO or GTAO

- **N8AO** is excellent and public domain (CC0), but its `N8AOPass` renders the scene itself by default. Its README says
  hardware antialiasing doesn't work with it, and it expects the `postprocessing` library on the import map. Our scene
  is drawn with 4× MSAA into a target whose depth the atmosphere pass already reads.
  Sources: [N8AO](https://github.com/N8python/n8ao), [README](https://raw.githubusercontent.com/N8python/n8ao/master/README.md).
- **GTAOPass** arrived in r160. Without a normal buffer it rebuilds normals from depth, but its `setSize` and `dispose`
  still expect its own normal target. **SAOPass** and **SSAOPass** draw the scene again with `MeshNormalMaterial` as an
  override, which loses our wind and turns leaf cards into solid quads.
  Sources: [GTAOPass r160](https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/jsm/postprocessing/GTAOPass.js),
  [SAOPass](https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/jsm/postprocessing/SAOPass.js).
- Ours is about 40 lines in the atmosphere pass. It reads the depth we already have, so wind and cut-out leaves count
  as drawn, and it is applied before the mist and haze. It is tinted navy, as Valheim's is (its AO colour defaults to
  about `#01003A`, from the light study).

### What Valheim does (for scale)

Unity's built-in pipeline, one sun with a 150 m, 4-cascade shadow distance, and SSAO as a menu toggle (from mod pages
that list its quality settings, not an official source). We stop at two cascades and 110 m, because our mist hides
two thirds of everything past 100 m.
Sources: [ValheimFPSPlus](https://thunderstore.io/c/valheim/p/KillerGoldFisch/ValheimFPSPlus/),
[GraphicsOverdrive](https://thunderstore.io/c/valheim/p/Wubarrk/GraphicsOverdrive/).

## What we built

- **Each shadow map drawn with its own camera's layers** (`core.js`, the wrapped `renderer.shadowMap.render`). Before
  each pass a hook (`SHADOW.onPass`) lets the vegetation set what that map draws.
- **Two cascades** (`core.js`, `SHADOW`):
  - The near one is 2048² over 64 m (3.1 cm a texel). It sits a third of its size ahead of the player along the view,
    and is drawn every frame.
  - The far one is a second directional light that gives no light, only a 2048² map over 220 m (10.7 cm a texel),
    centred on the player. Each map keeps the box it was drawn with, so the two never disagree.
  - The far map is drawn again only when you are `SHADOW.farStep` (6 m) from where it was drawn or the sun has turned
    `SHADOW.farTurn` (0.2°): about once a second walking, never standing still. Drawn every other frame, it cost the
    forest a hitch every other frame (45–54 fps on an M4; 60 now).
  - Both boxes step by whole texels, so shadows stay put in the world.
  - A patch to `lights_fragment_begin` gives the sun `sunShadow()`. It uses the near map, eases into the far one over
    the near box's outer tenth, and eases to full light at the far box's edge.
  - The far map holds only what stands still and looks the same wherever you stand in it, so it can wait to be drawn:
    - what moves or is too small to see from afar is marked `userData.nearShadow` and casts into the near map alone:
      the hero, creatures and pickups; small ground cover doesn't cast into it either;
    - trees cast into it with their leaves only (a trunk only where a tree has no leaf cards): trunks' shadows come
      from the near map, fading out across its edge with the hand-over.
    - This also kept the woods within the 650-draw / 3.5M-triangle budget.
  - By moonlight the far map is drawn empty once, at the moment the sun hands over to the moon. Trees cast into the near
    map only within `SHADOW.nightR` (20 m) of you, and the shaders fade the moon's shadows out between 8 and
    `SHADOW.nightFade` (14 m) from the camera, so nothing pops: they are faint, and the moonlit pass was costing the night
    several frames a second.
- **Sky light in shade** (`lights_fragment_end` patch): where the sun is blocked, the sky's light is cut by 40% by day
  and less by night. The share reaches every material as the far light's colour, a uniform they all already have.
- **Soft, contact-hardening filter** (`sunMap`):
  - Five bilinear looks round the point, spread over 5 cm of ground in either map, so the hand-over between cascades
    doesn't show.
  - The spread is up to three times wider where the caster stands high over the receiver (measured at the centre
    texel), so crowns throw soft shade and a foot a sharp one.
  - Grass and flowers (`SUN_SHADOW_CHEAP`) take a single bilinear look.
- **Grass takes the ground's shadow:** each blade looks up its shadow a quarter of the way up its stem.
- **Ambient occlusion** (`atmosphere.js`, `AO_FRAG` and `AO_BLUR`):
  - At half resolution, eight looks within 0.9 m round each point. The normal comes from the depth beside the point,
    snapped to full-resolution texel centres, so neighbouring looks never land on the same texel.
  - The disc turns by a fixed 4×4 pattern, removed by a depth-aware 4×4 blur, and the result is spread back over the
    screen by depth.
  - It is tinted navy and weaker on brightly sunlit pixels, gone by 75 m, and a little stronger at night. It runs on
    Medium and High.
- **Far forests in shade:** past 85 m, the floor and trunks of the woods (from the atmosphere's woods texture) are
  darkened by day.
- **The haze in the woods** marches through the far map. It reaches past the haze's 90 m everywhere, so the haze no
  longer depends on where the near box sits. The flecks of sun on the floor read the near map.

## Worth doing next

- Baked vertex AO in the tree crowns (inner leaves darker) and at the foot of trunks and rocks.
- Screen-space contact shadows for the hero's feet and small props (Bend Studio's technique; their code is published
  with the SIGGRAPH 2023 talk: [Bend screen-space shadows](https://bendstudio.com/blog/inside-bend-screen-space-shadows/)).
- Hills casting shadows at low sun: the terrain doesn't cast. A very coarse third map, drawn every second or two, would do.
- When three.js is upgraded: hardware shadow comparison (`sampler2DShadow`) would make every filter look cheaper.
