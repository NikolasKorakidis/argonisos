# Project review, 17 October 2026

A review of the whole project (structure, code, performance, quality, tests and automation), and what was changed as a
result. The rule throughout: **nothing the player can notice changes.** That is checked, not assumed:

- the new **world fingerprint** (`npm run test:world`) hashes the generated heights, biomes, slope rule, ground colours,
  sites, trees and pickups, and is identical before and after;
- the **screenshot suite** passes against the baselines committed before the review (no `--update`);
- every other game suite passes, and the pickup layout was compared item by item with `main` (2,993 pickups, same hash).

## What changed

### Folders

| Before | After | Why |
| --- | --- | --- |
| `three.module.js`, `jsm/` at the root | `vendor/three/` | third-party code in one place, never edited |
| `models/` | `assets/models/` | assets apart from code |
| `classic.html`, `play.html`, `game.js`, `audio.js` at the root | `legacy/` | the old prototype, still playable; the deploy redirects its old addresses |
| `concept/*.webp` (the prototype's art, the only tracked files in `concept/`) | `legacy/art/` | `concept/` is now wholly private and wholly git-ignored |
| `icons.js` at the root | `src/ui/icon-set.js` | game code under `src/` |
| `dev-server.mjs` at the root | `tools/dev-server.mjs` | tooling apart from the game |
| `AUDIT.md` | `docs/audit-2026-10.md` | documents together |

The root now holds only `index.html` (GitHub Pages serves it from there) and the project's configuration.

### Code

- **No more circular imports.** `render/core → render/atmosphere → world/vegetation → render/core` went round because the
  mist distances lived in `vegetation.js`. They now live in `world/reach.js` with the grass's reach, the numbers
  CLAUDE.md says to change together.
- **One copy of each helper.** `clamp` and `lerp` were defined in 11 files, `smooth` twice, the sine hash and the tileable
  noise twice. They are in `src/util/math.js` now (worker-safe, no imports).
- **Lint clean.** Nine leftovers removed (unused imports and variables, an unused material, a dead constant).
- **Pickup layout in its own pure module** (`world/pickup-layout.js`), shared by the game and the workers.

### Performance (same pictures, smoother frames)

Measured with a CPU profile of the real game in Chrome on the GPU (Apple M4), standing at the test places and sprinting
through streaming terrain. The main thread was mostly idle already (2–3 ms of work in a 16.7 ms frame); the problems
were stalls, which a frame rate average hides.

| Stall | Before | After | Fix |
| --- | --- | --- | --- |
| Reaching new ground while running | 125–133 ms frames (each new cell's pickups laid out on the main thread) | none | pickups laid out in the worker pool |
| First click or key press | ~140 ms (opening the audio device) | moved behind the loading screen | the audio context opens while the world loads, suspended until the first input |
| Worst frame sprinting through streaming | 133–150 ms | 16.8 ms (quiet machine) | the two above, plus shaders compiled before the loading bar fills |
| Grass catching up after a long jump (respawn) | 2.6–3.4 s, sometimes past the screenshot test's 6 s wait | 1.9–2.5 s | worker jobs queue by priority: the grass under you first, then near terrain, trees and pickups, then distant blocks |
| Rebuilding the mid-distance trees (on every far block) | 3.5 ms | 1.2 ms | each block's matrices worked out once, then copied |

The worker pool change also fixed a flaky screenshot test: the temple and forest shots sometimes caught the grass
before it had re-centred (it waited behind a queue of distant vegetation jobs).

Frame rates at the test places are 60 fps (the display's cap) before and after, with render times of 0.5–2.6 ms;
draw calls (168–320) and triangles (2.0–3.2 M) are unchanged.

### Tests and automation

- **`npm run check`**: ESLint (mistakes only, no style rules: the dense one-line style is intended), Madge (import
  cycles), Knip (unused files and dependencies), the world fingerprint. About 30 s, no browser.
- **GitHub Actions on every PR** (`.github/workflows/ci.yml`): `npm run check`, and a check that refuses PRs whose base
  isn't `main` (the stacked PR of 14 October never reached the live site).
- **Lean deploy with a build stamp** (`pages.yml`): only `index.html`, `src`, `vendor`, `assets` and `legacy` go live
  (not the tests, docs or tooling); the title screen shows the commit and date of the live build.
- **The perf suite reads the machine load first**: on a busy machine (another heavy app open) it records the timings but
  doesn't fail on them; draw calls and triangles are always judged. Most past "performance failures" were this.
- **Claude Code**: every JS file Claude edits is linted at once and the errors handed back (`.claude/settings.json`,
  `tools/lint-hook.mjs`); `/check` runs the checks and the quick suites and reports.
- Two tests made robust: the occlusion test picked "the first cypress", which with a different streaming order had a
  boulder where the hero stands; the building test now clears its site of trees first (since Patch 5's woods).

## Recommended next (not done here)

| Opportunity | Gain | Risk to the game | Effort |
| --- | --- | --- | --- |
| **Re-export the imported models as compressed GLB** (Draco or meshopt geometry, KTX2 textures). `axe.fbx` alone is 8.7 MB because it embeds four PBR textures, two of which the game throws away; the hero's rig, the clips and the animals add ~15 MB. Do it as part of the Unity asset replacement. | load time, GPU memory | the look changes slightly; check with the screenshot suite | M |
| **Drop the `.fbx.js` / `.glb.js` base64 copies** (29 files, 55 MB of the repo). They are the fallback for hosting that refuses `.fbx` (the code says artifact hosting); GitHub Pages serves `.fbx` fine. Only if the game won't be hosted that way again. | repo and deploy size | none on GitHub Pages | S |
| **Move the prototype-only models into `legacy/`** (alpaca, cow, donkey, horses, husky, shiba, wolf, elder, wolf statue, the old 8 MB `hero.fbx`: ~25 MB) | clearer assets | none for the game | S |
| **A faster grass texture bake** (about 1 s per 25 m travelled since the grass reaches 80 m): bake the far ring at half resolution | worker time, streaming on slow machines | the far grass's clearings round rocks get coarser | M |
| **Type checking with JSDoc** (`tsc --noEmit --checkJs`): turned on for the whole game it reports 1,131 errors, nearly all properties added to objects on the fly. Better added file by file (`// @ts-check`) to new or reworked modules. | catches mistakes earlier | none | L, gradual |
| **A GPU runner for the game suites in CI**: a self-hosted runner on a Mac would run perf and screenshots on every PR | the full suite on every PR | none | M |
| **`BatchedMesh` for trees** (in three r160): one draw per material across species instead of one per species | fewer draw calls (already well under budget) | low | M |
| **Upgrade three.js** (r160 is from late 2023): newer releases fix the `compileAsync` disposal bug worked round here, among much else | maintenance | medium: shaders patched by `onBeforeCompile` need checking | M–L |

## Research notes

- three.js performance: draw calls, not triangles, are usually the limit; instancing for repeated meshes, merged static
  geometry, `BatchedMesh` for different meshes sharing a material; dispose what you remove, but not shared resources.
  ([three best practices](https://tessl.io/registry/skills/github/zebbern/claude-code-guide/three-best-practices),
  [threejs-perf](https://skills.sh/opusgamelabs/game-creator/threejs-perf),
  [optimisation guide](https://metadesignsolutions.com/blog/threejs-performance-optimization-best-practices))
- Build-free JavaScript: JSDoc types checked by `tsc --noEmit` with `checkJs`; ESLint for per-file mistakes; Knip for
  what ESLint can't see across files (unused files, exports, dependencies); Madge to gate import cycles in CI.
  ([build-free types](https://skills.cat/skills/paulirish/dotfiles/build-free-types),
  [Knip](https://github.com/viliamkopecky/knip), [Madge](https://tessl.io/registry/testland/madge-deps))
- WebGL in CI: GitHub's runners render with SwiftShader (software), so timings and pixel baselines from a GPU machine
  don't carry over; keep those suites local or on a GPU runner.
  ([GPU tests in CI](https://backiee.wasmer.app/https_davesnider_com/posts/gputests),
  [Chromium headless and SwiftShader](https://chromium.googlesource.com/chromium/src.git/+/d99a9664c873fc38e226e33bc92da974fb852da3))
- Claude Code: hooks for what must happen every time (CLAUDE.md is advice, a hook is enforced); skills for repeatable
  team workflows; plan mode and subagents for large refactors.
  ([best practices](https://www.openhands.dev/blog/claude-code-best-practices-agentic-coding),
  [plan mode](https://www.morphllm.com/claude-code-plan-mode),
  [subagents](https://www.pubnub.com/blog/best-practices-claude-code-subagents-part-two-from-prompts-to-pipelines/))
