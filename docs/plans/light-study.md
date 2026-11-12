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

- **The woods' haze and shafts** (`atmosphere.js`): a 14-step march to 38 m through the sun's shadow map at half
  resolution, jittered per pixel by a fixed pattern (still pictures stay still) and smoothed by a depth-aware 3×3 upsample. It is gated by how many crowns stand over and round the player
  (the canopy map, read in the vertex shader), so meadows stay clear. The light scatters mostly forwards, so the shafts
  blaze towards the sun and still show across it.
- **Flecks of sun on the forest floor:** sunlit ground under the crowns brightens warm, and small coins of light (a
  pattern fixed in the light's own space) fall into the shade.
- **Night** (`sky.js`, `weather.js`): bluer moonlight, ambient and fog, slightly higher night exposure, and a forest fog
  that turns navy instead of black.
- **Fireflies** (`fireflies.js`, fed by `ambient.js`).

## Not done, worth doing later

- Light on the leaves themselves (translucency towards the sun, graphics plan 5.2) would make the gaps glow more.
- A real low-resolution, temporally reprojected froxel fog would give smoother shafts than a 16-step march, at a
  higher cost.
