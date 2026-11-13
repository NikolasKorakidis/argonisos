# Light study: what Valheim does with light, and what we take from it

Our own summary, November 2026. The player asked for Valheim's forest light (rays through the trees, a little haze even
by day), its blue moonlit nights, and fireflies on summer nights. No official breakdown of Valheim's rendering exists, so
this relies on the game's own per-environment settings as mod tools expose them, on players' threads, and on Unity's
documentation for the effects it uses. Each trait says which parts are sourced and which we inferred by looking at the game.

## What Valheim is, technically

- **Sourced:** Unity's built-in render pipeline with Post Processing Stack v1. It uses ACES tone mapping, SSAO and TAA,
  one directional light with a 150 m, 4-cascade, 2048 shadow map, and point-light shadows only near the player.
- **Sourced:** the look is cheap geometry and low-resolution textures, made to read as beautiful by modern lighting and
  post effects. Composition and light carry it, not texture detail.
- Sources: [GraphicsOverdrive](https://thunderstore.io/c/valheim/p/Wubarrk/GraphicsOverdrive/),
  [ScreenRant](https://screenrant.com/valheim-good-graphics-lighting-low-resolution-textures/).

## The traits

1. **Each weather is a look with four times of day.**
   - Sourced: every environment (biome × weather) carries its own fog colour, sun colour and fog density for morning,
     day, evening and night. It also has a second fog colour used when looking towards the sun, and day and night
     ambient colours.
   - Sources: [Expand World Data: environments](https://github.com/JereKuusela/valheim-expand_world_data/blob/main/docs/environments.md),
     [GammaOfNightLights](https://thunderstore.io/c/valheim/p/shudnal/GammaOfNightLights/v/1.0.8).
   - *Ours:* we already blend biome and hour (`grade()` in `atmosphere.js`, `MOOD` in `weather.js`). The fog towards the
     sun is our `hazeCol`.

2. **The shafts are a screen-space effect, and the crowns make them.**
   - Sourced: Valheim uses Unity's classic Sun Shafts (intensity 1, blur radius 3). That effect finds where the sky shows
     round the sun on the screen and blurs it outward from the sun.
   - Inferred: in the forest, every gap between the crowns becomes a ray. The rays come from silhouettes, not from any
     volume of fog.
   - Sources: [GraphicsOverdrive](https://thunderstore.io/c/valheim/p/Wubarrk/GraphicsOverdrive/),
     [Unity Sun Shafts](https://docs.unity3d.com/550/Documentation/Manual/script-SunShafts.html).
   - *Ours:* we keep our screen-space shafts for looking into the sun. Inside the woods we march a short ray through the
     sun's own shadow map instead. Then the rays slant down between the trunks even when the sun is off screen, which is
     the picture the player remembers.

3. **A low mist lies in the forest.**
   - Sourced: the Black Forest has its own "deep forest ground mist" besides the general fog, and other biomes have a
     low ground mist too. Players describe it as soupy below the knees and pooling in hollows. Raising the ground about
     2 m clears it.
   - Sources: [NoFogBruh](https://thunderstore.io/c/valheim/p/Vapok/NoFogBruh/v/2.0.1/),
     [Steam thread](https://steamcommunity.com/app/892970/discussions/0/5946473955227498355).
   - *Ours:* a haze in the woods that falls off over about 6 m of height above the ground. It is thicker where crowns
     stand overhead (the canopy map in `wetness.js`) and absent in open meadows.

4. **Fog is thin by default, and the hour shapes it.**
   - Sourced: the default density is 0.01 (exponential), with about 0.003 for clear air and 0.03–0.05 for fog. One fog
     example is denser at night than by day.
   - Inferred from the per-hour fields and from footage: the air is thicker and warmer at morning and evening, clearest
     at noon.
   - Sources: [Expand World Data](https://github.com/JereKuusela/valheim-expand_world_data/blob/main/docs/environments.md),
     [BetterFog](https://thunderstore.io/c/valheim/p/JevMods/BetterFog/).
   - *Ours:* the wood haze runs at about 0.012–0.03 per metre near the ground. It is at its thinnest at noon (about half
     strength) and thickest when the sun is low. The `wetAir` input (not yet passed from `main.js`) would thicken it
     in rain and fog.

5. **Shadows go blue.**
   - Sourced: the ambient occlusion colour defaults to a deep navy (about `#01003A`), not black, and its strength rises
     towards night.
   - Source: [Expand World Data](https://github.com/JereKuusela/valheim-expand_world_data/blob/main/docs/environments.md).
   - *Ours:* the grade already pushes a cool tint into the shadows (`gShadow`). At night the whole palette leans blue.

6. **Nights are dark, but the moon lights them blue.**
   - Sourced: the sun is 1.2 by day. At night the sky shows but gives almost no light, and players find the forest and
     swamp pitch black. A night-brightness setting is among the most-asked-for options.
   - Inferred from footage and tuned mod palettes: the night key light is a cool blue (around `#4D6BC7`), the night fog a
     navy (around `#213366`), and open ground stays readable as blue-grey.
   - Sources: [GammaOfNightLights](https://thunderstore.io/c/valheim/p/shudnal/GammaOfNightLights/v/1.0.8),
     [Steam thread](https://steamcommunity.com/app/892970/discussions/0/4939856028582938948),
     [Valheim Visual Enhanced](https://thunderstore.io/c/valheim/p/Pumpkin/ValheimVisualEnhanced/).
   - *Ours:* blue moonlight and a blue ambient. The fog turns navy at night, the forest's included (it used to fall to a
     near-black green). A thin, moonlit haze hangs under the trees. Fires stay the only warm light.

7. **Each time of day has its own warmth.**
   - Inferred from a tuned mod palette, not vanilla: the sun is warm orange at dawn (`#FFB861`), near white at noon
     (`#FFE6BE`) and rose at dusk, with blue moonlight. The fog is a grey-teal by day, violet at dusk and navy by night.
   - Source: [Valheim Visual Enhanced](https://thunderstore.io/c/valheim/p/Pumpkin/ValheimVisualEnhanced/).
   - *Ours:* the sun's colours in `sky.js` already follow this arc. The wood haze takes the sun's colour, so it is golden
     at morning and evening.

8. **Fireflies are sparse.**
   - Sourced: vanilla Valheim has blue fireflies at night only in its "peaceful meadows" variant. A popular visual mod
     adds yellow ones to the meadows: about 36 within 24 m, soft one-pixel glows fading in and out, with no real lights.
     They fade under roofs, in rain and in winter.
   - Sources: [allthings.how](https://allthings.how/valheim-alt-biomes-in-1-0-how-to-find-every-variation/),
     [Valheim Visual Enhanced](https://thunderstore.io/c/valheim/p/Pumpkin/ValheimVisualEnhanced/),
     [Firefly mod](https://github.com/shudnal/Firefly).
   - *Ours:* green-gold sparks in loose swarms, a slow swell and a quick fade each, drifting 0.4–2.5 m over the ground.
     They show on clear nights in the meadows and at the woods' edges, with only strays under thick crowns. GPU-only, with
     no lights: they glow through the bloom.

9. **Bloom is gentle.**
   - Sourced, from a mod's preset rather than vanilla: bloom intensity 0.3 with a threshold of 0.7.
   - Source: [GraphicsOverdrive](https://thunderstore.io/c/valheim/p/Wubarrk/GraphicsOverdrive/).
   - *Ours:* bloom 0.18 with a threshold of 0.92. Fireflies and sunlit flecks are bright enough to catch it, and nothing
     else changes.

## What we built from it

Reworked on 13 November 2026, after a tester found the first version "broken". The beams popped on and off as he walked
towards them and away. Leaving the trees flooded the screen white, and two steps later everything switched off. The
nights felt "too much". There were three causes. The whole woods' light was switched by how many crowns stood round the
*player*. Trees within 20 m cast their real leaves into the shadow map and further ones cast stand-ins, so every
shadow, beam and fleck changed shape at 20 m. And the haze's lit share was sharpened and brightened up to ×2.8 at high
sun. The rule now: **nothing about the light depends on where the player stands, only on what lies along each line of
sight.**

- **One caster per tree** (`vegetation.js`): every tree casts its light far version (with that version's leaf cards)
  into the sun's shadow map at every distance, by day and by night. Trees out of view but inside the shadow box stay
  packed, and the mid band past 75 m casts the same stand-ins into the box. So the shadow of a tree never changes as you
  walk towards it, turn, or let it cross a band. Drawing only stand-ins also took the real leaves' cost out of the
  shadow pass. The shadow box still steps by whole texels, so the shadow stays put in the world.
- **Shafts of sun** (`atmosphere.js`, trait 2): Valheim's own technique. At a quarter of the resolution a mask marks where
  the sky shows, weighted towards the bright sky round the sun (four depth looks per texel, so twigs don't flicker).
  Three passes blur it outward from the sun's place on the screen, reaching further each time. Looks beyond the screen's
  edge count as dark, and each look steps a little to either side, so rays have soft edges. It is added in the sun's
  colour, scaled by how near the view looks towards the sun (eased, so it fades as the sun leaves the screen) and by the
  sun's height (strongest low). It is scaled down by the air in front of each surface, so the hero beside you isn't
  washed out, and kept faint on the open sky. Every gap in the crowns, every column of the temple and every ridge throws
  rays the same way, in the meadow and in the woods.
- **The woods' haze** (trait 3): thin by design, with the shafts carrying the drama.
  - Its thickness at each step of the march comes from the world: a 512² texture of how wooded each place is and how high
    its ground lies, baked once by the worker pool from the same density the trees are laid out by. It lies low over the
    ground, falling off over about 8 m. Within the canopy map round you, it is a little thicker under a crown and thinner
    in a gap, faded smoothly towards the map's edge.
  - It is lit by the shadow map, easing into the usual share of light towards the shadow box's edge.
  - It scatters by Henyey-Greenstein with g = 0.65 and sits under a soft ceiling, so it glows towards the sun and can't
    blow out.
  - It is marched 28 steps to 90 m, denser near the eye, at half resolution. The starting spots turn a little each frame
    (held for screenshots), and the result is blended over the frames before: reprojected through last frame's camera
    and held within this frame's neighbourhood. A depth-aware upsample spreads it back over the screen.
- **Flecks of sun** on the forest floor come from the same shadow map, as much as the place is wooded.
- **Night** (`sky.js`, `weather.js`): bluer moonlight, ambient and fog. The woods' haze is thin and only faintly
  moonlit, there are no shafts, and a little blue is lifted into the darkest parts of the picture.
- **Fireflies** (`fireflies.js`, fed by `ambient.js`).
- **The test** (`tests/suites/light.mjs`): the hero walks out of a wood into the meadow and back, by day and by night, and
  straight towards the sun through the trees. Every 100 ms it compares the picture, and the light the haze and shafts add,
  with the last. It fails if the haze ever jumps (any step over four times the steps round it), or the picture leaps or
  blows out. The first version jumped 13–477×, blew out to a mean of 251 and moved the picture up to 35 levels in a step.

## Not done, worth doing later

- Light on the leaves themselves (translucency towards the sun, graphics plan 5.2) would make the gaps glow more.
- A real low-resolution froxel fog would let the haze carry visible beams across the view, not only towards the sun,
  at a higher cost.
- The shadow box is 80 m. A second, coarser cascade would let the haze's shadows reach further than the box's fade.
