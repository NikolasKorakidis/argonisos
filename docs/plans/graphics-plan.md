# Making Argonisos more beautiful: the plan

A plan to raise the look and sound of the game another level, from what other games do that we don't. It is ordered
by what the player will notice most for the least cost, with the **weather first**.

## Ground rules

- **Browser first.** Every item has a cost budget, a Low/Medium/High setting where it's expensive, and must keep the
  perf suite's budgets (draw calls, triangles, 60 fps at the test places on an M-series Mac). Heavy items are High only.
- **Measured, not guessed.** Each item lands with before-and-after screenshots from the test tour; the screenshot
  baselines are updated on purpose, with the old and new pictures compared side by side.
- **One look.** Painterly, warm, a little stylised (like Valheim, Breath of the Wild, Ghost of Tsushima's grass), not
  photo-real. Every effect follows the same light: the sun, the sky and the weather.
- **One wind.** A single wind (direction, strength, gusts) drives grass, trees, clouds, rain, particles and sound, so
  everything moves together. Today grass, trees and clouds each have their own.
- **One wetness.** A single wetness value (rises in rain, dries slowly in sun) drives every surface, puddle and sound.

## Where we are

Already in the game, so not in this plan except to build on: sky dome with stars, Milky Way, moon and aurora; sun
shafts; the player's mist and focus blur; height mist; cloud shadows; AgX tone mapping and a grade; one shadow-casting
sun (an 80 m square that follows you); bloom; a pool of fire lights; water with depth colour, caustics, shore foam and
the marsh; 160k-blade grass plus the far carpet; trees with leaf cards, alpha-to-coverage and crown-normal shading,
three distance bands and impostors; the rock surface on steep ground; pollen, fireflies, leaves and summit snow;
synthesised sound with layered rain (roof, muffled indoors), wind, birds, crickets, frogs and footsteps by surface.

**What's missing**, compared with the games below:
- nothing gets wet in the rain;
- the rain is 2,200 CPU-driven lines with no splashes, and it falls through roofs;
- lightning is only a white screen flash;
- every cloud is the same sprite;
- the ground is vertex colour plus one detail texture;
- grass has no clumping;
- trees sway as one piece;
- buildings have no ambient occlusion and no weathering;
- there are no shadows past 40 m;
- the effects are little cubes;
- sounds aren't placed in 3D;
- the map has no ink or paper.

## Phase 1: the weather (first, as asked)

| # | What | What others do | Build | Cost |
| --- | --- | --- | --- | --- |
| 1.1 | **The world gets wet** | Every modern weather game darkens and glosses surfaces in rain (Tatarchuk's ToyShop rain; the UDK rain demo) | A global `wetness` uniform (0 to 1, rising with rain, drying over minutes in sun) patched into the terrain, rock, building, tree-bark and site materials: albedo darker (×0.6–0.75), roughness down (0.95 → 0.35), a little more environment reflection. Upward faces get wettest; under roofs and dense crowns stays dry (rain occlusion, 1.3). | Low: a few shader lines |
| 1.2 | **Puddles and ripples** | Puddles as flat, mirror-smooth patches with animated ripple normals (ToyShop, UDK) | Puddles fill in the hollows the terrain already knows (its cavity value), on paths and flat ground, growing with wetness. An animated ripple normal map, made in code like the rock texture, ripples puddles, the sea and the marsh while it rains. | Medium |
| 1.3 | **Rain that belongs in the world** | Rain drawn on the GPU in a volume round the camera, stretched by fall speed and camera motion, slanted by the wind; occluded under cover (ToyShop: image-space rain plus particles) | Replace the CPU lines with a GPU rain volume: a fixed set of quads scrolled in the shader, stretched along velocity, slanted by the shared wind, lit by the sun and lightning, thinning with distance. **Rain occlusion**: a small top-down depth map of roofs and crowns round the player (re-rendered when you move a few metres), so no rain falls inside houses or thickly under trees. | Medium |
| 1.4 | **Splashes and drips** | Splash flipbooks where drops land; drips off roof edges | Splash sprites spawned on the ground and on water near the camera (GPU-placed using the rain-occlusion depth); drip lines off roof edges (the build system knows roof eaves); drops on the hero (darker, glossier tunic when wet, linked to the wet status). | Medium |
| 1.5 | **Real lightning** | Branching bolts that light the scene for a few frames, thunder delayed by distance | A procedural branching bolt (a random binary tree, re-rolled every 60–90 ms for the flicker) drawn as glowing ribbons; it lights the world (a brief directional flash from the bolt's direction, the sky and clouds lit from inside); thunder waits distance ÷ 343 m/s and gets duller and longer with distance. Rare strikes on tall trees on the storm wall. | Low–Medium |
| 1.6 | **The storm feels like a storm** | Valheim: stronger wind, darker light, fog rolling in, trees bending | The shared wind drives a storm state: grass and trees bend harder, leaves and debris fly, clouds race, rain slants, the grade goes colder and flatter, shadows soften (lower sun intensity, bigger shadow blur). | Low |
| 1.7 | **Fog that moves** | Valheim's ground mist and rolling fog banks | Fog banks: the height mist gets slow-moving density noise (it's a uniform function today), thicker in valleys at dawn and in fog weather; low cloud sheets drift over hills. | Low |
| 1.8 | **After the rain** | Breath of the Wild's rainbows, glistening surfaces | A rainbow arc when rain ends with the sun low behind you (a screen-space band); surfaces stay glossy while they dry; drips from leaves for a minute. | Low |
| 1.9 | **Snow on Olympos** | Snow that settles on up-facing surfaces | Falling snow above the snow line (the existing ambient snow, denser in weather); snow cover on top faces of rocks, ruins and buildings up there (the same up-facing mask as wetness). | Low |

## Phase 2: sky and clouds

| # | What | What others do | Build | Cost |
| --- | --- | --- | --- | --- |
| 2.1 | **Clouds with shape and light** | Sea of Thieves: art-directed clouds without ray marching, drawn off-screen at quarter resolution and blurred, lit by the sun; Breath of the Wild: stretched billboard clouds that scroll with the wind | Several cloud shapes (cumulus, towers, flat stratus) painted in code, each with a lighting map so they light from the sun's side: bright edges towards the sun ("silver lining"), dark bellies, warm at dusk. The weather sets coverage and type: scattered cumulus in clear weather, a grey deck in rain, anvil towers in storms. | Medium |
| 2.2 | **A high cloud layer** | Every open-world sky has wispy cirrus far above | A cirrus layer on the sky dome: scrolling noise lit by the sun, catching sunset colour. | Low |
| 2.3 | **Cloud shadows that match the clouds** | | Drive the cloud-shadow noise from the same cloud field, so a shadow passes under a cloud you can see. | Low |
| 2.4 | **Volumetric clouds (High only)** | Horizon, Red Dead: ray-marched volumetric clouds; for three.js, the `@takram/three-clouds` library (Beer shadow maps, temporal upscaling, light shafts) | A trial on the High preset, if the frame budget allows after Phases 1 and 3. It needs the `postprocessing` library; measure before committing. | High |
| 2.5 | **Sun and moon** | | A soft glow and lens bloom round the sun through thin cloud; moonlight tinting the night blue and lighting cloud edges. | Low |

## Phase 3: the ground

| # | What | What others do | Build | Cost |
| --- | --- | --- | --- | --- |
| 3.1 | **Real ground textures** | Every terrain shader: a handful of tiling materials (grass, earth, rock, sand, snow) blended by height and slope, with **height-based blending** (the grain of the higher material wins at the border) | Five ground materials (painted in code now, or the Unity team's textures later) blended by the biome weights and slope we already have, height-blended so borders look like real edges, not smudges. Rock keeps its surface. | Medium |
| 3.2 | **No visible tiling** | Stochastic (anti-tiling) sampling; a macro variation texture; detail near, macro far | Anti-tiling sampling, a large-scale tint and brightness variation, and a near-to-far blend from detail to macro. | Low |
| 3.3 | **Paths** | Valheim's worn trails | Trodden earth paths between the start, the farmhouse, the temple and the olive sites (from the site graph), and footpaths that wear in where the player walks often (a small trodden-ness texture, saved). | Medium |
| 3.4 | **Cliffs and outcrops** | Valheim and most open worlds: rock meshes on steep ground, not just a painted slope | Rock outcrop meshes placed along the steepest rock (the slope rule decides where), using the rock surface's colours. | Medium |
| 3.5 | **Shore and wet ground** | | Darker wet sand at the waterline (already in colour) with a moving wet band as waves come in; mud in the marsh glossy. | Low |

## Phase 4: grass and flowers

| # | What | What others do | Build | Cost |
| --- | --- | --- | --- | --- |
| 4.1 | **Clumps** | Ghost of Tsushima: blades grouped in clumps (Voronoi cells) that share height, lean and colour, so a field reads as tufts, not noise | Voronoi clumps in the grass shader: each clump has its own lean, height and tint; blades lean away from the clump centre. | Low |
| 4.2 | **Rounded blades** | Ghost of Tsushima: blade normals tilted across the blade so one flat quad shades as if curved; base-to-tip colour; darker at the root (self-shadow) | Tilted normals per blade side; darker roots from blade height and density; blades take the ground's colour at the base so they sit in it. | Low |
| 4.3 | **Light through grass** | Translucency and glints when looking towards the sun | Stronger translucent glow towards the sun at the tips (it exists; tune it with the wind waves), a faint specular sheen sweeping across the field with the gusts. | Low |
| 4.4 | **The shared wind** | Ghost of Tsushima's "Blowing from the West": one wind field moving grass, trees, particles and cloth | A scrolling wind texture (direction plus gust strength) sampled by grass, trees, flowers, rain, clouds, particles and the hero's tunic. | Medium |
| 4.5 | **Trails and trampling** | | Grass flattened along where you have walked, slowly standing back up (a small trail texture round the player). | Medium |
| 4.6 | **More life in the meadow** | | Taller flower spikes, seed heads in the tall grass, butterflies over flowers by day (ambient particles). | Low |

## Phase 5: trees and leaves

| # | What | What others do | Build | Cost |
| --- | --- | --- | --- | --- |
| 5.1 | **Wind in layers** | Crysis (GPU Gems 3, ch. 16): a main bend of the whole tree along the wind, a detail bend of branches, and leaf flutter, each with its own stiffness and phase | Three layers in the tree shader: trunk sway (by height), branch sway (by distance from the trunk, per-branch phase), leaf flutter (per card). Driven by the shared wind; storms bend harder. | Medium |
| 5.2 | **Leaves that glow against the sun** | Leaf translucency (Habel; Kusternig): back-lit leaves let light through | A translucency term: leaves between you and the sun glow yellow-green, stronger at the crown's edge. | Low |
| 5.3 | **Depth in the crown** | Ambient occlusion inside foliage | Darken leaf cards towards the crown's centre and underside (we know the crown's centre per tree); a little colour variation per tree. | Low |
| 5.4 | **Better far trees** | Octahedral impostors with normal maps, lit like the real trees | Impostor cards that carry a normal map, so far trees light from the sun the same way as near ones (today they take a flat sky brightness); a few view angles per species. | Medium |
| 5.5 | **Leaves that fall and stir** | | Leaves shaken off when a tree is struck, swirling in gusts; fruit that sways. | Low |

## Phase 6: buildings and the trial's places

| # | What | What others do | Build | Cost |
| --- | --- | --- | --- | --- |
| 6.1 | **Ambient occlusion** | Every stylised builder (Valheim, Tiny Glade) grounds buildings with soft contact shadow in corners and under eaves | Screen-space AO (N8AO, which looks clean at few samples and has a half-resolution mode) on Medium and High; on Low, baked AO per building piece at its corners and joins. | Medium |
| 6.2 | **Weathering** | Tiny Glade wears the plaster round windows (a single distance attribute); Valheim's pieces are dirty at the base and darker where rain runs | Dirt and moss rising from the ground on every piece (by height above the terrain), darker streaks under eaves, edge wear on planks, moss on the north faces of stone. Wet in rain (1.1), snow on top (1.9). | Low–Medium |
| 6.3 | **Variation** | | Each piece slightly different: plank pattern offset, tint, a knot or two, so a wall of ten pieces doesn't repeat. | Low |
| 6.4 | **Living buildings** | Valheim's smoking roofs and glowing doorways at night | Smoke from campfires and through roofs, glow from doors and windows at night when a fire burns inside, embers rising from the fire. | Low–Medium |
| 6.5 | **The ruins** | | Ivy and moss on the temple's and ruins' stones, broken marble edges, faded paint, leaves gathered in corners; marble with veining. | Medium |

## Phase 7: light and the picture as a whole

| # | What | What others do | Build | Cost |
| --- | --- | --- | --- | --- |
| 7.1 | **Shadows further out** | Cascaded shadow maps: sharp near, coarse far | A second, coarse shadow cascade (about 300 m) so hills and woods throw shadows beyond 40 m; updated every few frames. | Medium |
| 7.2 | **Colour by place and weather** | Breath of the Wild and Valheim each light every biome and weather differently | A colour-grading table (3D LUT) per biome and weather, blended as you walk and as weather changes: golden meadows, cool green forest, grey-blue storms. | Low |
| 7.3 | **Eyes adjusting** | Exposure adaptation entering and leaving dark places | Exposure eases when you walk into the giant forest or a cave and out again. | Low |
| 7.4 | **Wading and swimming** | | Wakes and ripples where you wade or swim, rain ripples on water (1.2), underwater fog. | Medium |

## Phase 8: effects

| # | What | What others do | Build | Cost |
| --- | --- | --- | --- | --- |
| 8.1 | **Real particles** | Flipbook sprites (Breath of the Wild's dust and smoke are stretched, scrolling billboards) | Replace the little cubes with sprite flipbooks: wood chips and splinters, stone chips, dust puffs, leaves, sparks, blood-free hit flashes; all lit and pushed by the wind. | Medium |
| 8.2 | **Fire** | | Flame flipbook with flicker, smoke, embers and a faint heat shimmer; fire light flickering with it (the light pool exists). | Low–Medium |
| 8.3 | **Footprints and dust** | | Footprints in sand, mud and snow that fade; dust kicked up running on dry ground; splashes in puddles; breath mist in the cold. | Medium |
| 8.4 | **Pick-ups and power** | | A soft glint on things to pick up; a better effect for Zeus's power and the blessing. | Low |

## Phase 9: sound

| # | What | What others do | Build | Cost |
| --- | --- | --- | --- | --- |
| 9.1 | **Sounds placed in the world** | The usual chain: distance attenuation, then spatialisation, then occlusion, then the space's effect | Fires, creatures, waterfalls, the sea and the storm wall as 3D sources (WebAudio PannerNode with HRTF), fading with distance. | Low |
| 9.2 | **Occlusion** | A ray from listener to source; muffle what's behind walls | Sounds behind buildings or hills low-passed (the build system's colliders and the terrain height). | Low |
| 9.3 | **The space you're in** | Reverb zones: a forest clearing, inside a room (Wwise Rooms and Reverb Zones) | Reverb by place: open meadow (dry), forest (soft, short), inside a building (small room), the temple (stone hall), caves (long, dark), blended at the edges. | Low |
| 9.4 | **Rain on what it falls on** | | Rain layers by surface near you: leaves overhead (a soft hiss under trees), water (patter), stone (sharp), roof (drumming, exists), with the rain-occlusion map deciding which. Drips after rain. | Low |
| 9.5 | **Thunder that matches the lightning** | | Thunder delayed by the bolt's distance, sharper and louder near (with 1.5). | Low |
| 9.6 | **Variety and mix discipline** | Randomise anything heard more than twice; a few clear sounds beat many layers; voice limits and ducking | Round-robin variations and pitch spread for every repeated sound; a voice limit; dialogue and boss sounds duck the ambience. | Low |
| 9.7 | **Music with moods** | | Music states: exploring (the lyre), night, danger near, boss, the temple; crossfades between them. | Medium |
| 9.8 | **Recorded sounds** | | As the asset list says: replace synthesised sounds with recordings one by one, keeping the synth as fallback. | Ongoing |

## Phase 10: the map

| # | What | What others do | Build | Cost |
| --- | --- | --- | --- | --- |
| 10.1 | **An old chart** | Valheim's map; stylised maps with a fog-of-war mask blurred at the edges and a colour shift where it's uncovered | Parchment texture, ink coastlines and contour lines, a wash of colour per biome, a soft burned edge where the uncovered part meets the fog, a compass rose. | Medium |
| 10.2 | **Hand-drawn icons and the path you took** | | Ink icons for places (temple, labyrinth, caves, olives), your trail as a dotted line, pins you can place with a note. | Medium |
| 10.3 | **Weather on the map** | | Today's weather drawn over the map as soft cloud. | Low |

## Phase 11: the platform (longer term)

| # | What | Why | Cost |
| --- | --- | --- | --- |
| 11.1 | **Upgrade three.js** (r160 is late 2023) | Fixes (the `compileAsync` bug worked round in the review), better AO and shadow tools, and the way to WebGPU | Medium–High |
| 11.2 | **WebGPU for grass and particles** | Compute shaders and indirect drawing run millions of grass blades and particles on the GPU (the False Earth landscape does exactly this); the WebGPU renderer falls back to WebGL 2 | High |

## The first sprint

The ten changes the player will notice most, in this order:

1. The world gets wet, with puddles and ripples (1.1, 1.2)
2. GPU rain that stops under roofs and trees, with splashes (1.3, 1.4)
3. Real lightning that lights the world, with thunder at the right delay (1.5, 9.5)
4. Clouds with shape and light, set by the weather, and a cirrus layer (2.1, 2.2, 2.3)
5. The storm state and moving fog banks (1.6, 1.7)
6. The shared wind, grass clumps and rounded blades (4.4, 4.1, 4.2)
7. Trees in three layers of wind, with glowing leaves (5.1, 5.2, 5.3)
8. Ambient occlusion and weathering on buildings (6.1, 6.2)
9. Colour by place and weather (7.2)
10. Sounds placed in the world, occlusion and reverb by place (9.1–9.4)

Each lands as its own pull request into `main`, with screenshots, perf numbers and patch notes.

## Sources

- Rain: [Tatarchuk, artist-directable real-time rain (ToyShop)](https://advances.realtimerendering.com/s2006/Chapter3-Artist-Directable_Real-Time_Rain_Rendering_in_City_Environments.pdf),
  [rendering wet roads](https://cescg.org/wp-content/uploads/2021/03/Nguyenova-Rendering-Wet-Roads-in-Driving-Simulations-1.pdf),
  [puddles in the UDK rain demo](https://polycount.com/discussion/comment/1267567),
  [stylised rain VFX](https://80.lv/articles/see-how-stylized-rain-vfx-can-be-set-up-in-houdini-octane-render)
- Clouds: [The Technical Art of Sea of Thieves (SIGGRAPH 2018)](https://history.siggraph.org/wp-content/uploads/2022/09/2018-Talks-Ang_The-Technical-Art-of-Sea-of-Thieves.pdf),
  [@takram/three-clouds](https://cdn.jsdelivr.net/npm/@takram/three-clouds@0.7.4/README.md),
  [efficient volumetric clouds in three.js](https://discourse.threejs.org/t/efficient-volumetric-clouds/66067),
  [Breath of the Wild dust and cloud particles](https://realtimevfx.com/t/zelda-breath-of-the-wild-dust-particles/10639)
- Grass and wind: [Procedural Grass in Ghost of Tsushima (GDC)](https://gdcvault.com/play/1027214/Advanced-Graphics-Summit-Procedural-Grass),
  [Blowing from the West (GDC)](https://gdcvault.com/play/1027124/Blowing-from-the-West-Simulating),
  [a reimplementation](https://github.com/2Retr0/GodotGrass),
  [grass rendering theory](https://hexaquo.at/pages/grass-rendering-series-part-1-theory/)
- Trees: [Vegetation animation and shading in Crysis (GPU Gems 3, ch. 16)](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch16.html),
  [leaf translucency (Habel)](https://www.cg.tuwien.ac.at/research/publications/2009/Habel_2009_PhD/),
  [real-time vegetation (Kusternig)](https://www.cg.tuwien.ac.at/research/publications/2009/kusternig-2009-rtr/)
- Terrain: [Terrain3D shader design](https://github.com/TokisanGames/Terrain3D/blob/main/doc/docs/shader_design.md),
  [procedural stochastic terrain shader](https://github.com/unitycoder/Procedural-Stochastic-Terrain-Shader),
  [height blending and triplanar](https://makegamessa.com/discussion/comment/48221/)
- Buildings and light: [Tiny Glade's procedural windows](https://80.lv/articles/procedural-windows-in-pounce-light-s-tiny-glade-get-an-upgrade),
  [N8AO](https://github.com/N8python/n8ao), [AO in three.js compared](https://discourse.threejs.org/t/new-ambient-occlusion-example-hbao-vs-n8ao/58847),
  [Valheim's lighting](https://iguzzini.com/it/lighthinking-comunicazione-design/quanto-conta-la-luce-in-un-videogioco-il-caso-valheim)
- Lightning: [procedural lightning (Reis and Fernandes)](https://repositorium.uminho.pt/handle/1822/90396)
- Sound: [reverb zones (Audiokinetic)](https://blog.audiokinetic.com/en/reverb-zones/),
  [rooms and portals](https://audiokinetic.com/zh/blog/rooms-and-portals-with-wwise-spatial-audio),
  [creating the spaces of ambience](https://designingsound.org/2012/12/creating-the-spaces-of-ambience)
- Map: [stylised fog of war (Sasha Mills)](https://sashamills.artstation.com/projects/WmxVg2)
- Platform: [False Earth: from WebGL limits to WebGPU](https://tympanus.net/codrops/2026/04/21/false-earth-from-webgl-limits-to-a-webgpu-driven-world/),
  [three.js performance tips](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
