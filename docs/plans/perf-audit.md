# Performance audit: the plan and what we fixed

Our own summary, 14 November 2026. A player on a high-end Windows PC (RTX 5080, 64 GB, Chrome, a 60 Hz screen, Ultra)
reported the game "lagging here and there": hitches, not a low frame rate. We measured every preset, found what made
the hitches, and fixed what could be fixed without changing the picture. The visual suite stays within its noise and
the world fingerprint is unchanged.

## How we measured

A probe outside the repo drove the real game in headless Chrome on the GPU (`--use-angle=metal`), at the perf suite's
places (`tests/lib/places.mjs`) and on a 60 s sprint from the meadow into the woods with the camera sweeping 90° every
two seconds (about 350 m, through streaming, the far shadow's redraws and new cells). `main.js` was served instrumented
through a route (a timestamp before each statement of the loop), so the code itself was not changed for it. Per run:

- frame intervals from `requestAnimationFrame`, and the game's own JS time per frame and per section of the loop;
- WebGL calls, by wrapping the context: draws, program switches, bytes sent with `bufferSubData`/`bufferData` and the
  texture uploads, shader compiles and links (each link logged with its shader's defines and the JS caller), syncs;
- which attributes changed each frame and their size (version counters), to say who uploads what;
- a Chrome trace for GC pauses and long tasks, and the sampling heap profiler for where the garbage comes from;
- GPU time per pass with `gl.finish` brackets, and passes turned off one at a time.

This Mac (Apple M4, ANGLE on Metal) is not the player's machine. Two things follow:

- **CPU-side costs and stutter transfer**; on Windows (ANGLE on Direct3D 11) they are usually worse: each buffer upload
  and each shader compile costs more there (HLSL compiles, staging copies).
- **This GPU cannot run Ultra at 60 fps** at any size: Chrome's trace shows the GPU process waiting on Metal's
  back-pressure 70% of the time, and it stays near 35 fps even at 640×360 (it is the triangles, about 7M, and the
  vegetation: hiding the trees alone gives +58%). An RTX 5080 has several times the throughput. So for Ultra we judge
  stutter at 640×360, where the game's CPU-side work is the same as at full size, by the frames whose own code ran
  long and by frames more than twice the usual interval, not by the 60 fps line.

## What was wrong, by cost

1. **Shader programs compiled mid-play: 30 to 50 a minute of walking, each a 60–190 ms freeze.** These were the worst
   hitches on every preset (all the frames over 100 ms in the baseline). Four causes:
   - *Every bake of the sky's light* (`refreshEnvironment` in `sky.js`, every few seconds as the sun moves) went through
     three's `PMREMGenerator.fromScene`, which makes a background-box material, draws with it and disposes it: its
     program went with it and was compiled again at the next bake. 15–18 a minute, 65–150 ms each.
   - *The occlusion fader* (`occlusion.js`) cloned a tree's or a wall's materials when it came between the camera and the
     hero and disposed the copies afterwards: the programs went too. Walking through woods, trunk after trunk: 15–35 a
     minute (a transparent double-sided leaf card takes two programs).
   - *The vegetation's band materials* (`cut` in `vegetation.js`) each had a program key of their own (the material's
     uuid), so every species' leaf cards compiled a separate, identical program per band, many of them the first time
     that species came into view. 179 programs at High in the forest; 119 now.
   - *The warm-up at load* (`renderer.compile` in `main.js`) compiled for the screen, but with post-processing on the
     scene is drawn into the composer's buffer, for which three makes different programs (no tone mapping, linear
     output). So on Medium, High and Ultra it warmed programs that were never used. And Chrome links a program only
     when first asked, so even a correct warm-up stalled the first frame that drew with it.
2. **Megabytes of instance data sent to the GPU every frame**: 1.7–5.5 MB a frame (Ultra up to 5.5 MB, 330 MB/s).
   Every vegetation batch (`veg.cull`) set `instanceMatrix.needsUpdate` on its whole buffer, sized for every tree in
   reach, though only the front of it was drawn; the mid band on Ultra was 2.4 MB a frame alone. The effects' and the
   pickups' buffers likewise. This saturated Chrome's command buffer (the trace shows the page waiting for the GPU
   process to drain it, `WaitForToken`) and is the kind of cost ANGLE on Direct3D 11 pays most for.
3. **The grass texture re-stamped and re-sent whole about once a second while walking**: any clearing that came or went
   (a pickup coming into reach or leaving it, a stump) re-stamped every texel and re-sent the texture: 2.5 MB on High,
   8 MB on Ultra (`grass.js`). Plus a fresh texture on the card at each 25 m re-centre, and an 8 MB copy on the main thread.
4. **Every lit material looked its program up again twice per shelter-map redraw** (`updateShelter` in `wetness.js`,
   every 0.5–2 s and every 3 m walked). Three keeps one set of lights per scene; drawing the scene with a camera that saw
   no lights changed it, and the next frame every material re-evaluated its shader (hundreds of them).
5. **Garbage: 25–36 MB a second**, 60–80 minor GCs and 3–4 major GCs (up to 24 ms) a minute. The biggest sources: the
   vegetation's shadow pass (closures per batch, three times a frame: 5 MB/s), `heightAt` and `noise` (a string key and
   a closure per call: 5 MB/s, mostly from re-working every near tree's matrix at each cell rebuild), and the near
   rebuild's per-tree string keys.
6. **Slow frames that weren't GPU work**: the occlusion fader's rays tested every instance of every near batch (and
   rebuilt each batch's bounding ball first), 4–9 ms at 12 Hz on Ultra; each near-band rebuild re-computed every tree's
   sunk matrix (three height samples each) for thousands of trees.
7. **Resolution scaling that hunted**: it averaged frame times, so one hitch pushed the average over the line, the
   picture dropped a step and every buffer was made again (a hitch of its own); on Ultra it climbs back later. With
   vsync at 60 Hz the frames never show headroom, so on a fast card it climbs to 150% and any hitch could start this.
8. **Smaller**: the composer's second buffer was multisampled like the scene's (8× on Ultra), so the atmosphere's and the
   bloom's whole-screen pictures were resolved from 8 samples a pixel for nothing, and the two buffers swapped roles
   every frame; the GPU timer query ran every frame though only the debug line shows it.

What was checked and found fine: frames are paced by `requestAnimationFrame` with one composer render a frame; no
`readPixels`, `getError` or `finish` in the loop; render targets are only resized on a real change; terrain patches,
flora and grass are built in the workers; the HUD only writes text when it changes (4 times a second); the far shadow
map is redrawn about 40 times a minute walking, costing about 1 ms of GPU on this Mac.

## What we fixed (no change to the picture)

- **Programs**: the vegetation's band materials share programs by their base material's key (`cut`, `vegetation.js`);
  the fader keeps its faded copies for reuse instead of disposing them (`occlusion.js`); a kept copy of the PMREM
  background material holds its program (`sky.js`); the warm-up at load compiles one stand-in of every species in each
  band, the faded copies of every tree and site material, for the buffer the scene is really drawn into, and finishes
  every link before the loading bar fills (`main.js` `warmUp`, `core.js` `sceneTarget`). Mid-play links per minute of
  walking: 41 → 0 on High, 29–41 → 0 on Ultra, 48 → 0 on Low.
- **Uploads**: only the instances drawn are sent (`addUpdateRange`) for the vegetation, effects and pickups; the grass
  texture is re-stamped and re-sent only round the clearings that changed (`copyTextureToTexture`), its texture object is
  reused at a re-centre and its spare copy is made in the worker. 3.3 MB → 0.07 MB a frame on High walking;
  4.6 → 0.25 MB on Ultra.
- **The sky's light** is copied into one lasting texture at each bake, so the scene's environment never changes object
  and no material re-evaluates its shader (`sky.js`).
- **The shelter maps' draws** see the lights on a layer of their own, so the scene's light state stays put
  (`wetness.js`); the shadow-map hook returns at once when no map is to be drawn, as three's own does (`core.js`).
- **Garbage**: no closures in the shadow pass; `noise`'s gradient helper and the pad and cave grids' keys no longer make
  garbage per call (`gen.js`, the world fingerprint unchanged); near trees' matrices are worked out once per cell and
  the near rebuild uses number keys and looks up felled trees only in cells where something was felled
  (`vegetation.js`). 31 → 20 MB/s on Ultra walking.
- **Rays against the trees** pass over instances out of the ray's reach without the full test (exact: same hits), and
  don't rebuild the batch's bounding ball first (`batchRaycast`, `vegetation.js`).
- **Resolution scaling** goes by the typical frame (the middle of the last 90 and the one nine in ten beat), not an
  average, so a hitch no longer changes the resolution (`adaptResolution`, `core.js`).
- **The composer** keeps the samples and the depth on the scene's buffer only; the other is a plain buffer, and the roles
  no longer swap (`core.js`). The GPU timer runs only while the overlay shows it.

## Before and after

At 1280×720 with the resolution pinned at 100% (as the perf suite), except Ultra†, measured at 640×360 (see above).
"Walk" is the 60 s sprint with the camera sweeping. Upload is instance and vertex data sent per frame; links are shader
programs linked mid-play during the walk. The machine's load was 2–4 throughout.

Per place (fps · p95 ms · worst ms · game JS ms per frame · upload KB per frame), before → after:

| Preset | meadow | forest | night | programs alive |
|---|---|---|---|---|
| Low | 60 · 16.7 · 16.8 · 3.2 · 1689 → 60 · 16.8 · 16.8 · 3.1 · 40 | 60 · 16.7 · 16.8 · 3.8 · 2664 → 60 · 16.8 · 16.8 · 3.8 · 73 | 60 · 16.8 · 16.8 · 3.7 · 3092 → 60 · 16.8 · 16.8 · 3.4 · 87 | 107 → 101 |
| Medium | 60 · 16.7 · 16.8 · 3.5 · 1902 → 60 · 16.7 · 16.8 · 3.0 · 40 | 60 · 16.7 · 16.8 · 4.3 · 2940 → 60 · 16.8 · 16.8 · 3.9 · 92 | 60 · 16.8 · 16.8 · 4.0 · 3407 → 60 · 16.8 · 16.8 · 3.5 · 104 | 178 → 112 |
| High | 60 · 16.7 · 16.8 · 3.9 · 1769 → 60 · 16.7 · 16.8 · 3.0 · 40 | 50 · 33.4 · 66.6 · 5.1 · 2745 → 51 · 33.4 · 33.4 · 5.3 · 92 | 57 · 33.3 · 33.3 · 3.9 · 3286 → 60 · 16.8 · 16.8 · 3.3 · 104 | 184 → 119 |
| Ultra | 38 · 50 · 66.7 · 5.0 · 2961 → 33 · 50 · 50.1 · 4.6 · 196 | 31 · 50 · 100 · 7.2 · 4423 → 26 · 50.1 · 50.1 · 6.4 · 288 | 25 · 50.1 · 116.7 · 8.3 · 5266 → 30 · 50 · 50.1 · 5.8 · 292 | 185 → 119 |

Draw calls and triangles are unchanged at every place (e.g. High forest 525 draws, 3.35M triangles; Ultra forest 646,
7.04M). The Ultra fps on this Mac is GPU-bound and varied ±15% with the machine's load between runs (the after runs had
a load of 5, the before runs 3); its worst frames are what changed.

The 60 s walk (frames over 17 ms and over 33 ms per minute, worst frame, game JS per frame avg and p99, upload per
frame, programs linked mid-play, minor GCs and allocation per second):

| Preset | before | after |
|---|---|---|
| Low | 2/min, 2/min · worst 167 ms · JS 3.9 (p99 6.9) · 3.1 MB · 48 links · 63 GC, 28 MB/s | 0, 0 · worst 16.8 · JS 3.4 (p99 5.6) · 58 KB · 0 links · 49 GC, 22 MB/s |
| Medium‡ | 102/min, 16/min · worst 133 · JS 5.9 (p99 13.6), JS over 33 ms 20/min · 2.7 MB · 50 links · 74 GC, 33 MB/s | 79/min, 0 · worst 33.4 · JS 4.0 (p99 8.6), 0/min · 70 KB · 1 link · 50 GC, 22 MB/s |
| High | 393/min, 24/min · worst 133 · JS 7.5 (p99 22.6) · 3.3 MB · 41 links · 80 GC, 36 MB/s | 267/min, 9/min · worst 67 · JS 5.1 (p99 10.8), JS over 33 ms 0/min · 70 KB · 0 links · 48 GC, 21 MB/s |
| Ultra (1280×720) | 1153/min, 633/min · worst 183 · JS 27.3 (p99 139) · 5.5 MB · 29 links · 52 GC, 25 MB/s | 1478/min, 493/min · worst 67 · JS 8.1 (p99 14.7), JS over 16 ms 7/min, over 33 ms 0 · 252 KB · 0 links · 31 GC, 14 MB/s |
| Ultra† (640×360) | over twice the usual interval 43/min · worst 200 · JS 11.1 (p99 124), JS over 16 ms 87/min, over 33 ms 55/min · 4.7 MB · 41 links · 69 GC, 32 MB/s | 0/min · worst 50 · JS 7.6 (p99 13.9), JS over 16 ms 10/min, over 33 ms 0 · 249 KB · 0 links · 41 GC, 18 MB/s |

‡ Medium measured before and after back to back at the same machine load (the first after run was taken at a higher
load). On High, Medium and Ultra the remaining frames over 17 ms are this Mac's GPU (at 50–55 fps in the woods on High,
about 30 on Ultra), not the game's code: the game's own code went over 33 ms in no frame after the fixes, on any preset.
The slowest remaining frames of game code (Ultra, 16–20 ms on this Mac) are a near- or mid-band rebuild as a block
streams in (`veg.cull`, up to 11 ms) or the occlusion fader's rays and the effects (`lateUpdate`, up to 9 ms).
Loading takes about a second longer (the warm-up now compiles and links everything it should).

## Proposals that would change the picture (not done)

Measured on this Mac at Ultra in the forest (28 fps with everything on), one thing turned off at a time:

| Change | Frame rate | Note |
|---|---|---|
| Vegetation hidden (the upper bound of any thinning) | 28 → 45 fps | Ultra's 7M triangles are mostly trees: shortening Ultra's full-detail band (`SPLIT` 45 m, `NEAR_R` 130 m) or its mid band (`MID_R` 340 m) is where the GPU time is |
| No post-processing | 28 → 34 fps | the atmosphere, bloom and output passes together |
| No grass | 28 → 31 fps | |
| No bloom, no AO, no woods' haze, MSAA 4× instead of 8×, no shadows | ±1 fps each | not where the time goes on this GPU |

None of these is needed on an RTX 5080: there the GPU has room and the hitches were CPU-side and compile stalls.

Without a visual change, still open:
- the grass texture's re-centre still sends the whole texture every 25 m walked (8 MB on Ultra, 2.5 MB on High); a
  ring-buffer (toroidal) texture would send only the new strip;
- a near-band or mid-band rebuild when cells stream in still takes up to ~9 ms on Ultra on this Mac (`rebuildMid`,
  `rebuildNear`); it could be spread over frames;
- three re-evaluates the programs of a few materials every frame (about 1.5 MB/s of garbage from `getParameters`),
  most likely a material shared by an instanced and a plain mesh; worth finding;
- content that first appears after load (creatures, held tools, building ghosts) still compiles on first sight; a
  second warm-up when the packs have loaded would cover it;
- the canvas's own antialiasing (`antialias: true`) is only needed on Low (no post-processing) and for the storm rings;
  turning it off with post-processing on needs a reload and wasn't measured.

## The performance overlay

F3, or Settings → Performance overlay (off by default, remembered): the preset, the resolution scale and the drawn size,
the screen's refresh rate, fps with the average, p99 and worst frame time, the game's own code per frame with its three
costliest parts, draws, triangles and shader programs, the count of hitches (frames longer than the refresh by half
again) per minute and over 33 ms, and the last hitch's cause: a shader compile, the longest part of the game's code if
it took most of the frame, or the browser and GPU when the game's code was quick. Below it a graph of the last 240
frames (green, yellow over a refresh, red over 33 ms, with the game's own time in pale). The old debug line shows with
it. Off, it costs a flag test per section; on, a few timestamps and one canvas column a frame (`src/ui/perf.js`).
