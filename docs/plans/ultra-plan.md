# Ultra: the plan

Our own summary, November 2026. The player asked for a setting above High for a high-end PC, "literally no
limitations": everything visible from far away, as far as the browser goes. This page lists what WebGL2 in Chrome can
sustain on such a machine, which techniques give the biggest visual step for a stylised open world in three.js r160,
and what we built (the Ultra preset, `src/ui/settings.js`).

## What the browser allows on a high-end PC

The target is an RTX 4080/4090-class card at 1440p to 4K, in Chrome on Windows (ANGLE on Direct3D 11).

- **Draw calls are the ceiling, not triangles.** WebGL validates every call and the CPU pays for each one. Guidance runs
  from 1,000 to 3,000 calls a frame, and ANGLE's own advice is to keep them few.
  Sources: [ANGLE: getting good performance](https://github.com/Microsoft/angle/wiki/Getting-Good-Performance-From-ANGLE),
  [Mozilla](https://bugzilla.mozilla.org/show_bug.cgi?id=1594474).
  Our trees, grass and flowers are instanced, so going further out adds triangles, not calls.
- **Triangles.** There is no authoritative per-frame figure. A 4080's front end handles 10–20M simply shaded triangles a
  frame (our estimate); one report gets 2.5M instanced quads at 60 fps, depending on the ANGLE backend
  ([Babylon forum](https://forum.babylonjs.com/t/mesh-with-thin-instance-slower-than-with-full-vertices/46756)).
  Overdraw of cut-out leaves and the shadow passes limit us before raw triangle count does. We budget 6–10M for Ultra.
- **Fill rate and memory.** A 4080 has 280 GPixel/s and 717 GB/s
  ([spec](https://technical.city/en/gpu/GeForce-RTX-4080)). At 4K, 8× antialiasing on a half-float target costs
  bandwidth (resolves), not ROPs, so the resolution's automatic scaling stays on.
- **Limits.**
  - 8× MSAA is required of every Direct3D 11 card on all formats but RGBA32F, and 93% of Windows WebGL2 reports give
    `MAX_SAMPLES` ≥ 8 ([Microsoft](https://learn.microsoft.com/en-us/windows/win32/api/d3d11/nf-d3d11-id3d11device-checkmultisamplequalitylevels),
    [web3dsurvey](https://web3dsurvey.com/webgl2/parameters/MAX_SAMPLES)).
  - 16× anisotropy is reported by 100% of Windows systems
    ([web3dsurvey](https://web3dsurvey.com/webgl2/parameters/MAX_TEXTURE_MAX_ANISOTROPY_EXT)).
  - 83% of all reports give 16384² textures
    ([web3dsurvey](https://web3dsurvey.com/webgl2/parameters/MAX_TEXTURE_SIZE)).
- **WebGPU is not an option at r160.** In r160 `WebGPURenderer` is an example add-on under `examples/jsm/renderers`. It
  doesn't support `ShaderMaterial` or `onBeforeCompile`: every material would have to be rewritten in TSL node
  materials, and nearly all of ours are patched (wind, wetness, ground, grass, the sun's cascades, the atmosphere).
  The manual still calls it experimental.
  - As late as r173 and r182, users reported it running slower than WebGL for scenes like ours.
  - Its gain is cheaper draw calls (render bundles, compute culling), and our draws are already few.
  - It is worth revisiting only as part of a whole-engine upgrade.

  Sources: [r160 tree](https://github.com/mrdoob/three.js/tree/r160/examples/jsm/renderers),
  [manual](https://threejs.org/manual/en/webgpurenderer),
  [migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide),
  [forum, r173](https://discourse.threejs.org/t/why-webgpurenderer-performance-significantly-lower-than-webglrenderer/77629),
  [forum, r182](https://discourse.threejs.org/t/webgpu-significant-performance-drop-and-shadow-quality-regression-in-r182-vs-webgl-r170/89322).

## The options, ranked by how much they change the picture for what they cost

Costs are our estimates for a 4080 at 1440p; measured numbers on our own machine are at the end.

| # | Option | Impact | Cost | Built |
|---|--------|--------|------|-------|
| 1 | **View distance**: the mist pushed back (60→120 m clear, full at 200 m, and thinner: 42% rather than 68%), full-detail trees to 130 m, light meshes to 340 m, impostors to 1.4 km, every tree kept behind the mist, grass to 180 m, the terrain finer further out, minor sites drawn further | Very high: the whole island opens up, which is what the player asked for first | Triangles (instanced, so few extra draws), one-off streaming and the CPU's per-frame packing of the bands | **Yes** |
| 2 | **8× MSAA** (from 4×) | High on foliage: alpha-to-coverage leaf edges get nine steps instead of five | +1–2 ms at 1440p (bandwidth) | **Yes** |
| 3 | **Resolution above the screen's** when there's room (automatic scaling 0.8–1.5, never wider than 5120 px) | High: supersampling cleans up grass and shimmer | Up to 2.25× the pixels; the automatic scaling backs off as needed | **Yes** |
| 4 | **4096² shadow maps over wider boxes** (near 96 m, far 520 m across) | Medium-high: sharper near shade, tree shadows out past the mist | Shadow fill is cheap; the far map's redraw (every 8 m walked) costs more | **Yes** |
| 5 | **Ambient occlusion at full resolution, 16 looks, to 140 m** | Medium: crisper contact shade, no half-resolution halo at edges | About 4× the AO pass (+0.7–1.5 ms) | **Yes** |
| 6 | **Denser, further grass and flowers** (the dense carpet to 48 m, flowers to 50 m, the sparse one to 180 m) | Medium-high in the meadows | +1–2 ms (vertex work) | **Yes** |
| 7 | **The sea mirrors the shore** (screen-space reflections, sea only) | High at the coast | A short march per sea pixel; nothing elsewhere | **Yes** |
| 8 | **16× anisotropic filtering** on every mipmapped texture | Medium: ground and walls stay sharp at a glancing angle | Near zero on a desktop card | **Yes** |
| 9 | **More of the light in the air**: the woods' haze marched in 64 steps (from 28) over its longer reach; the sun's shafts at half resolution (from a quarter) | Low-medium: smoother beams, no stepping | +0.5–1.5 ms | **Yes** |
| 10 | **The storm wall marched at half resolution** (from a quarter) | Medium when it's in view: crisper billows | 4× its march, only while it's in view | **Yes** |
| 11 | **Twice the fire lights** (6 at once, from 120 m) | Low-medium at night | Each light costs every lit pixel | **Yes** |
| 12 | **Sharper impostors** (512² atlas tiles) and **less edge blur** (focus 3 → 1.5 px) | Low-medium | Memory only | **Yes** |
| 13 | Octahedral impostors (a view per direction, lit like the near trees) | Medium far out | An atlas per species, eight taps a card | Later |
| 14 | A third shadow cascade (to ~600 m) | Medium on long views at a low sun | Another shadow pass and a shader-chunk change | Later |
| 15 | Real PCSS (blocker search) on the near map | Medium under trees | +1–2 ms | Later: our contact-hardening filter covers most of it |
| 16 | GTAO (r160's `GTAOPass`) | Medium | Needs its normal target; our AO reads depth only | Later |
| 17 | TAA | — | `TAARenderPass` only resolves while the camera is still; a reprojecting TAA needs motion vectors that include the wind, or foliage ghosts | No |
| 18 | Planar water reflection (`Reflector`, `Water2`) | High at water | Draws the scene a second time (one user went from 60 to 24 fps) | No: the screen-space version above instead |
| 19 | Shadows from fire light (cube shadow maps) | Medium at night | Six passes per light over our instanced woods | No |

Sources for the table:
- Impostors: [a forest of octahedral impostors](https://discourse.threejs.org/t/a-forest-of-octahedral-impostors/85735),
  [octahedral-impostor](https://github.com/agargaro/octahedral-impostor),
  [open world in the browser: impostors](https://app.cinevva.com/blog/2026-05-04-open-world-browser-part-19-imposters).
- Grass: [Ghost of Tsushima's grass (GDC)](https://gdcvault.com/play/1027214/contactUs),
  [a million blades in three.js](https://discourse.threejs.org/t/real-time-grass-simulation-in-the-browser-over-1-million-blades-at-60-fps/82808).
- Soft shadows: [PCSS (NVIDIA)](https://developer.download.nvidia.com/shaderlibrary/docs/shadow_PCSS.pdf),
  [three.js issue 8933](https://github.com/mrdoob/three.js/issues/8933).
- Cascades: [Babylon forum](https://forum.babylonjs.com/t/cascaded-shadow-maps-performance/28471).
- AO: [N8AO](https://github.com/N8python/n8ao).
- Antialiasing: [TAARenderPass](https://threejs.org/docs/pages/TAARenderPass.html),
  [realism-effects](https://www.npmjs.com/package/realism-effects).
- Water: [SSRPass](https://threejs.org/docs/pages/SSRPass.html),
  [Water.js and frame rate](https://discourse.threejs.org/t/water-js-low-fps-with-object/42234).

## What other browser worlds do

The pattern across all of them is real meshes to about 100 m, impostors beyond, and fog over the hand-over, with the
CPU's draw-call budget as the limit. Ultra goes past that, to 130 m of full trees and 340 m of light ones, because our
bands are batched.

- **agargaro's impostor forest** (three.js): 200k trees, impostors past about 100 units
  ([forum](https://discourse.threejs.org/t/a-forest-of-octahedral-impostors/85735)).
- **The Babylon.js WebGPU forest**: also holds 60 fps on WebGL2
  ([forum](https://forum.babylonjs.com/t/details-about-the-forest-webgpu-demo/47884)).
- **PlayCanvas's After the Flood** (WebGL2): planar mirrors and baked light
  ([PlayCanvas](https://blog.playcanvas.com/mozilla-launches-webgl-2-with-playcanvas/)).

## What we built

**The preset.** Ultra sits above High in the pause menu, with a note that it is for high-end PCs. It is off by default,
and Low, Medium and High are unchanged.
- **Loaded once** (`src/render/quality.js`): the preset the game started with is read before anything is built.
  Everything that is built into shaders and layouts at load follows it: the mist and grass reach in `reach.js`, the
  vegetation bands, the grass carpets, the terrain's detail, the sites' view radii, the shadow boxes, the haze's steps,
  the AO's reach and looks, the storm's march resolution, the light pool and the impostor atlas. Switching to or from
  Ultra shows a toast asking for a reload for these.
- **Applied at once** (`applyGraphics`): resolution and its automatic range, MSAA, shadow map sizes, the AO's and the
  shafts' resolution, and the focus blur.
- **For tests and screenshots**, `?gfx=ultra` in the address picks the preset for one visit without storing it.

**Nothing pops where the bands meet.** Every Ultra radius is moved together from `reach.js`:
- the mist's span is the vegetation's thinning span;
- the grass ends half-way into the mist;
- the near band's dissolve, the mid band's and the impostors' keep their widths;
- the far shadow box covers the woods' haze march (`WOOD_LEN` = `MIST_R1` − 10 m), and the far woods' shade
  (`woodsDark`) starts where the far shadow map ends.

The light suite's rule still holds: the shafts, haze and flecks depend only on what lies along each line of sight.

**Not done** (more effort): octahedral impostors lit like the near trees; a third cascade; real PCSS; GTAO; denser
grass blades near the camera with more bends (Ghost of Tsushima's 15-vertex blades); volumetric clouds (`@takram/three-clouds`).
