# Review: crafting, items, inventory, harvesting, building, cooking

> Kept from the review round of 20 November 2026. The screenshots, probe scripts and raw logs it names were in the
> reviewer's scratch folder and are not kept; the line numbers are as of the commit it names.

Reviewed on `dev` at 7e54596. I read the code and then checked it in the game: headless Chrome on the GPU, short sessions
with the owl hidden, using direct `B.place`/`B.invalid`/`placeGhost` calls and fly-camera screenshots. I ran no suites
and changed no repo files. Screenshots are named below by file (`shots/build/`); the session scripts were `sess.mjs` and `exp1.mjs` to `exp7.mjs`.

---------------------------------------------------------------------------------------------------------------------

## Bugs (ranked)

### 1. Loading a save destroys pieces, and loading a base takes seconds (data loss) — S
- **Issue:** `Build.load` places pieces one at a time and `place()` runs a full `recompute()` after each one. If a piece
  was saved *before* the piece that now holds it up, it has no support at the moment it loads, so it collapses for good
  with no refund. This happens whenever a support is rebuilt. Each extra recompute also adds O(n²) cost to the load.
- **Evidence:** the test builds wall A, then a floor on it, then wall B under the floor's other edge, then removes A.
  The save order is `[floor, wall]`. Before saving there are 2 pieces; after `load` there is 1 (the floor is gone).
  A 400-piece base (floors and posts in two storeys) takes **4.7 s** to load (`exp7.mjs`).
- **Cause:** `src/build/build.js:608` (`load` → `place`), and `src/build/build.js:437` (`this.recompute()` at the end of
  every `place`).
- **Fix:** give `place` an `opts.defer` flag that skips `recompute`. `load` places everything deferred, then runs one
  `recompute()`. Better still, the first recompute after a load should never break pieces: log them, so a save can't
  lose a house.

### 2. Pieces that collapse or are destroyed refund nothing — S
- **Issue:** removing one ground wall gives back that wall's cost, but everything it held up is lost. Pieces broken by
  creatures, storms or a boss's coming also vanish without a trace. In Valheim a destroyed piece drops its materials.
  Here one misplaced X costs a whole upper storey.
- **Evidence:** a tower of 2 walls with 4 floors cantilevered off the top. Removing the bottom wall left 6 → 0 pieces,
  and the pack got back only `wood 4, rope 2`. The other 20 wood and 10 rope were lost (`exp2.mjs`).
- **Cause:** `src/build/build.js:464` (`breakPiece(p, false)` on falling pieces) → `:470` `remove(p, false)`. The refund
  only happens when `refund` is true (`:451`).
- **Fix:** in `breakPiece`, drop the piece's `mats` as pickups at its centre (`g.pickups.drop`). All of them for a
  collapse; for a piece destroyed by damage, all of them or a share. This pairs well with improvement 4 (warn before
  removing a load-bearing piece).

### 3. "Ghost trees": invisible zero-size trees can be felled from thin air — S
- **Issue:** flora slots culled by the layout keep their index with scale 0: lone meadow trees, the giants' shade, and
  obstructed slots (`flora.js:131/139/142/155`). They still get a collider of radius 0 with `ref.s = 0`. An axe swing
  through empty meadow can hit one. `treeHP` is 0, so the first blow fells it. It leaves a stump and a 2.2 m log from
  nothing, and the log gives 0 wood. These colliders also count as obstacles for falling trees and rolling logs.
- **Evidence:** 37 of 657 vegetation colliders round the meadow (-208, 384) have `r = 0`. Three axe strikes at one gave
  `strikes [true,…]`, plus 1 new log (L 2.2, wood 0) and 1 new stump (`exp5.mjs`).
- **Cause:** `src/main.js:63-64` (the `onCell` collider list skips `!sp.col` and removed slots, but not `s <= 0`). The
  harvest pick filter at `src/game/harvest.js:180` doesn't check `s` either.
- **Fix:** `if (!sp.col || !(items[o + 6] > 0) || veg.removed.has(...)) continue;` in `main.js`. This does not change the
  world fingerprint: colliders aren't hashed.

### 4. Every placement and removal costs ~120 ms in a 400-piece base — M
- **Issue:** `recompute()` rebuilds `grounded` and the neighbour list for **every** piece on every change. `grounded` →
  `onGround` → `gapUnder` samples `heightAt` about 27 times per piece, plus `restsOn` and box tests. A collapse
  re-enters `recompute()` once per wave. That's a visible hitch on each hammer click once a base grows. Valheim bases
  run to thousands of pieces.
- **Evidence:** 399 pieces: `recompute` 121 ms, and remove + recompute 123 ms (`exp1.mjs`).
- **Cause:** `src/build/build.js:457-466`.
- **Fix:** cache `p.grounded` and `p.nb` and refresh them only for pieces within ~8 m of the change. Then propagate
  support by BFS from the changed pieces (support only falls in the affected component). Recompute from scratch only on
  load (one pass, see bug 1).

### 5. Picking up one rope reveals 42 recipes, including 11 locked ones, each with its own toast — S
- **Issue:** a recipe is known once you have held *any* of its materials. Rope (and wood) are in almost everything, so
  your first rope floods the screen with "New recipe" toasts. That includes Cretan and Corinthian gear that needs a
  boss head first. It spoils the sense of discovery and buries the useful toasts.
- **Evidence:** `C.known` cleared, then `inv.add('rope', 1)` revealed 42 recipes. The tier-locked ones included:
  Lightstone Spear/Axe/Dagger, Cretan Bow/Helmet/Body/Legs/Cape, Corinthian Helmet/Body/Legs (`exp6.mjs`). See the toast
  stack in `01-floors-off-a-wall-raise-earth-and-door-without-frame.png`.
- **Cause:** `src/game/crafting.js:33-34`.
- **Fix:** ignore "common" materials (wood, stone, rope, fiber) when discovering, unless a recipe uses nothing else.
  Keep tier-locked recipes hidden until `S.tier` reaches them, or show them only once, as a single "Offer the
  Minotaur's head to learn 8 more" line. Merge simultaneous discoveries into one toast ("3 new recipes").

### 6. Tools and weapons are destroyed at 0 durability — S
- **Issue:** at 0 the item is deleted ("Your crude axe broke"). Repairs are free at the workbench, so losing the item
  only punishes the player. Valheim keeps it at 0, unusable, until it's mended. Wrong-tool clinks (an axe on rock, a
  pickaxe on a tree) also cost durability, because `harvest.strike` returns true for them.
- **Cause:** `src/game/game.js:126`. The wrong-tool branches return true at `src/game/harvest.js:195/528/545/587`.
- **Fix:** clamp at 0. Make a 0-durability tool do nothing (strike refused, with the toast "Your axe needs mending at a
  workbench") and show its slot red. Don't charge durability on a clink. Warn once at 10%.

### 7. A door keeps standing when its frame is taken down — S
- **Evidence:** `01-floors-off-a-wall-raise-earth-and-door-without-frame.png`. The door at the right stands alone; its
  frame was removed (`exp1.mjs`/`exp4.mjs`: `left: ["door grounded true s 1.00"]`).
- **Cause:** a door's snaps are at ground level, so `grounded()` (`src/build/build.js:330`) holds it up. Only
  `invalid()` checks `doorFrameAt` (`:250`), and `recompute` doesn't.
- **Fix:** in `recompute`, a door (or gate) whose `doorFrameAt`/post is gone gets support 0, so it falls. Better, it
  comes down with its frame, with a refund (bug 2).

### 8. Taking down a cooking stand destroys the meat on it — S
- **Evidence:** a stand with 2 pieces of meat removed with the hammer gave only `wood 6` (`exp1.mjs`).
- **Cause:** `src/build/build.js:448-455`. `remove` drops `p.inv` for chests but ignores `p.state.cook`.
- **Fix:** give back each piece on the stand, cooked or raw, by `c.t >= c.need`. Same treatment for collapse.

### 9. "Too steep here" never fires; beds and benches stand half in the air on any slope — S
- **Issue:** the check compares `heightAt(pos)` with `pos.y`. For an equipment ghost aimed at the ground, `pos` *is* the
  aimed ground point, so the difference is always ~0.
- **Evidence:** on a 42% slope, every piece was allowed (`exp2.mjs`/`exp6.mjs`). Corner heights above the ground were:
  bed −0.49/−0.42/+0.45/+0.41 m, workbench −0.26…+0.22, chest −0.16…+0.15. Half a metre of bed hangs in the air, the
  other half is buried.
- **Cause:** `src/build/build.js:252`.
- **Fix:** sample the first solid's four footprint corners (as `gapUnder` does) and refuse when max − min > ~0.35 m.
  Alternatively set `pos.y` to the highest corner and allow up to ~0.3 m of hang, which a bed's legs hide.

### 10. A deck, porch or balcony under 2.5 m turns into an earth mound — M
- **Issue:** any flat floor not resting on another piece's top, with land within `FILL_MAX` (2.5 m) below it, counts as
  "on the ground", and the earth is raised to 0.3 m under its boards. Floors laid out from a wall 2.2 m up (a raised
  deck or veranda) become a grassy hill, and the floors sink into it. You can't build anything airy close to the ground.
- **Evidence:** `01-floors-off-a-wall-raise-earth-and-door-without-frame.png`. Four floors 2.2 m up off two walls: the
  mound in the middle. Numbers: raw ground 2.16 m below, ground after the cut 0.30 m below, `onGround: true`,
  `rests: false` (`exp2.mjs`).
- **Cause:** `src/build/build.js:329` (`onGround`) and `:83` (`FILL_MAX`). The fill is applied in `place` (`:427-428`).
- **Fix:** fill under a floor only when the player laid it from the ground: it was aimed at terrain, or at least one
  edge is within ~0.6 m of the land. A floor snapped to a structure keeps its own support and leaves the ground alone.
  Walls can keep today's rule, which is what the hillside tester asked for. Re-run `hillside.mjs` after the change.

### 11. Felled trees' stumps poke through floors, can't be cut, and don't block — S
- **Evidence:** `02-stump-through-floor.png` (the stump in the middle of the boards).
- **Cause:** `src/game/harvest.js:331`. `addStump` keeps stumps in its own list: they aren't in the vegetation, so
  `bareUnder` (`build.js:292`) never removes them, and they aren't in `g.colliders`, so the player and creatures walk
  through them. Only logs use `col`. They also can't be chopped. Only the last 512 are drawn (`:333`, `slice(-512)`),
  globally rather than by distance.
- **Fix:** in `place`, remove stumps under a piece's `clearsOf` rectangles (and save that). Make stumps a strike target
  that gives 1–2 wood (Valheim's stumps do), and add them to the colliders. Draw the stumps near the player, not the
  last 512.

### 12. Inventory: dragging onto a same-id slot does nothing; split lands in the hotbar — S
- **Evidence:** an axe dragged onto another axe left both unchanged (durabilities 50/100 stayed put). Two full piles of
  50 wood dragged together also did nothing. Neither swapped. Shift-split of a stone pile went to **slot 0, the hotbar**
  (`exp1.mjs`).
- **Cause:** `src/game/inventory.js:40` (the merge branch is taken even when `k = 0`) and `:45`
  (`this.slots.indexOf(null)` starts at the hotbar).
- **Fix:** swap when nothing can merge (`k === 0`). Split into the first empty slot of the pack rows (from `COLS`), and
  use the hotbar only when the pack is full.

### 13. Dead content: a hoe that does nothing, plus items you can never get — S
- **Issue:** the Hoe is craftable at the workbench and costs leather and rope, but no code gives `tool: 'hoe'` a use.
  Raw/cooked fish and spoiled meat/fish can't be obtained. The `spoil`/`spoilTo` fields in `items.js` are never read,
  so raw meat never spoils. Rabbit and hog hides can't be obtained either: rabbits
  and hogs drop leather.
- **Cause:** `src/game/items.js:50-55, 61, 81`. A grep for `'hoe'` and `spoil` finds no behaviour.
- **Fix:** hide the hoe recipe until farming exists, or give the hoe a first job (level ground for a floor; plant
  seeds, see improvement 12). Implement spoilage, or remove the fields until it exists.

### 14. "Missing materials" doesn't say what's missing — S
- **Evidence:** `06-ghost-missing-materials.png`. The ghost holds 3 of 4 wood and 0 of 2 rope, and the prompt just says
  "Missing materials".
- **Cause:** `src/build/build.js:249` and `src/game/crafting.js:55`.
- **Fix:** name the shortfall: "Need 1 more wood, 2 rope". Put it in the prompt's sub-line, the craft button and the
  build menu's info box.

### 15. Walls and furniture can go straight through tree trunks and rocks — S/M
- **Evidence:** `11-wall-built-through-a-trunk.png`. `B.invalid` returned null for a wall, a workbench and a floor
  centred on an oak's trunk, and for a wall through a rock (`exp5.mjs`). `06-ghost-missing-materials.png` also shows a
  green-able ghost cutting through a branch.
- **Cause:** `src/build/build.js` `overlaps()` tests only placed pieces' solids, not `g.colliders` (trees, rocks, site
  walls).
- **Fix:** refuse when a piece's solid rectangles (`rects(def.solids…)`, shrunk 0.15 m) meet a tree or rock collider
  circle or a site wall, with the message "A tree is in the way" or "Rock is in the way". Floors over small stones can
  stay allowed. CLAUDE.md says building over trees is the player's choice; walls through trunks still read as a bug.

### 16. Long stairs aimed uphill on a slope hover and are refused with a misleading message — M (worth confirming)
- **Evidence:** on the 42% slope, `stairsLong` aimed at the ground facing uphill came out with its foot 1.76 m in the
  air and the message "Attach it to your building". Facing downhill was allowed, with the top 4.65 m over the ground
  (`exp6.mjs`). I didn't chase the cause. It's probably the `aimAt`/`flatReach` end choice in `placeGhost`
  (`src/build/build.js:224-227`), which puts the top end at the aim point when no snap target exists.
- **Fix:** on bare ground, put the stairs' foot on the ground at the aim point and turn them by R. Use the end choice
  only against built pieces. When nothing is attached, say "Stairs must start on the ground or a floor".

### Minor
- `g.build.aimPiece` is never defined, so the check in `src/game/game.js:182` is dead.
- The crafting panel's material count reads "30/5" (have/need, like a fraction). The weight line wraps ("111.5 /
  300"), and the Sort button's label wraps into two lines at 1280 px (`07-crafting-panel.png`).
- The Build tab of the crafting window only says "Hold the hammer to build" (`08-crafting-build-tab-no-hammer.png`). It
  could equip the hammer from the pack instead.
- The three thatch roofs share one icon, and so do the three roof ends (`09-build-menu-roofs.png`). Pitch and span
  can't be told apart without reading the label.
- The `log` item (weight 8, from giants) can't even be broken into wood.

---------------------------------------------------------------------------------------------------------------------

## Improvements (ranked by how much Valheim-feel they buy)

### 1. A piece set worth building a home with — L (piecewise S each)
The current set has a 3×3 wall, a 3×1 wall, a door frame and door, 3 beams, a 3×3 floor, 2 stairs, 3 thatch roofs
(45°, 59°, 42°), 3 gable ends, an awning, a fence, a stockade, gates and 6 equipment pieces. It builds a box with a
gable
roof, and every house looks the same. In order of value:
- **A 26° roof family** on the 3 m grid (6×1.5 panels), and the **45° family completed** with outer and inner corners
  plus a ridge cap. Today's only roofs are steep, and there are no corners, so hip roofs, L-shaped houses and porches
  can't be made.
- **A window wall** (3×3 with an opening and shutters) and a **1.5 m half wall** and **1×1 / 1×2 / 1.5×3 wall pieces**.
  Windows are the single biggest "home" signal.
- **Triangle walls** (26°/45° in 1.5 m and 3 m) to close a gable of any span, instead of only the three fixed ends.
- **Log beams and log walls from the `log` item**. They'd be stronger: lower support loss, like Valheim's core wood.
  This gives the giants' logs a use and raises the ceiling height you can build.
- **A Y-beam** and **a ladder**. **1×1 and 1.5×1.5 floor tiles**, and a **floor triangle**.
- **A stone set from plentiful stone**: floor, wall, stairs and a **stone hearth or fire pit** that the rain doesn't
  put out under the open sky. Stone is everywhere and today only feeds campfires, daggers and pickaxes.
- **Furniture**: a larger chest (and a reinforced one later), an item stand to hang a boss trophy or a weapon, a bench
  and chair you can sit on, a table, rugs, banners, a sign, and wall shelves for jars and amphorae (the sites already
  have these models in the packs).


### 2. Comfort, so a home is worth decorating — M
`rested` is a flat 20 min from a bed (`build.js:538`) or 10 min from sitting by a fire (`acts.js:20`). Add Valheim's
comfort: count distinct comfort groups within ~10 m of the bed or fire (fire, bed, chair, table, rug, banner, trophy
stand) when you wake or sit, and give `rested` 8 min plus 1 min per comfort level. Show the level on the Rested
condition ("Rested · Comfort 5"). This is the one system that makes furniture pay off.

### 3. Ghost feedback — S/M
- Tint the **ghost by the support it would have** (blue, green, yellow or red, from `supportFor`). Today it's green or
  red only, and you see weak support only after placing.
- Name the reason precisely (bug 14). When "Nothing holds it up", say how far support reaches.
- With the hammer out, while aiming at a piece to remove, **flash red every piece that would fall** if it went (run the
  support pass with that piece left out). This removes most collapse surprises (bug 2).
- Show small markers on the snap points near the aim, as Valheim does on hover.

### 4. Deconstruct safely — S
Removal is instant on MMB or X, with no undo. Remove plain pieces at once, but require a short hold (0.4 s) for a piece
that others depend on, and say how many will fall. Refuse to remove a non-empty chest ("Empty it first"). Today the
contents spill on the ground.

### 5. The build menu — S
- Show each piece's support role and cost shortfall in the info box. Show the piece's own 3D thumbnail for the roof
  variants.
- Add number keys 1–9 to pick within the current tab, and a "recent" row of the last 5 pieces placed.
- Keep R for turning, and add Shift+wheel for fine turning off-grid. A "snap off" key (Valheim's Shift) helps when the
  scorer picks the wrong spot.

### 6. Crafting window — M
- **Craft ×N**: Shift-click makes 5, or as many as you can carry. Arrows by 10 is a common chore.
- **Where it comes from**: on hovering a missing material, show its sources ("Deer, hogs, rabbits", "Fiber bushes",
  "Boulders in the Yleos hills"). Show **"Used in"** on every item's info in the pack. This fixes the dead-end feeling
  of the 16 unused materials below.
- **Pin a recipe** to the HUD, with live have/need counts while you gather.
- Filter "can make now" and group recipes by kind (tools, weapons, armour, ammo), not only by station.

### 7. Stations that grow — M
There's one workbench, with nothing to upgrade, and tiers come only from boss heads (`S.tier`). Add Valheim-style
**workbench extensions** that raise its level within range: a chopping block, a tanning rack (for hides), a tool rack.
Gate the Cretan set on level 2 and the boss tier together. Add **item quality levels** (upgrade a crude axe at a higher
bench for more damage and durability). A **forge or kiln**
would give coal a source and lightstone a real processing step.

### 8. Inventory and chests — S/M
- **Ctrl-click** quick-moves between the pack and an open chest (today a plain click moves a whole pile, which is fine),
  and **Take all / Store stacks** buttons on the chest.
- A **split amount** (Shift-click opens a slider or takes one, and Shift+drag takes half).
- **Durability bars in the chest grid** (`drawChest` omits them), and a sort button for the hotbar on its own.
- **Hover a slot and press 1–8** to assign it to the hotbar.

### 9. Repair all at the workbench — S
Repair is free and one item at a time (`crafting.js:68-75`). Add a "Repair all" button, and an automatic repair of the
held tool when you press E at the bench.

### 10. Cooking — M
- **Burning**: a piece left on past about twice its cook time chars ("Burnt Meat" → coal). This gives cooking its
  Valheim tension, and coal a source.
- **Progress**: tint each piece from red to brown as it cooks (today it changes colour only when done), and let the
  label say "Cooking… 12 s".
- **Spoilage** (the fields exist), or delete them.
- **A cauldron or pot** with a few dishes from what is already gathered: olive and tomato salad, acorn porridge,
  meat stew (meat, tomato, dandelion), and a moonflower tea (health regen). This gives 5 dead-end ingredients a use and
  food a mid-tier above "cooked meat".
- **Fish**: the items and the stand already support them; fishing or a fish trap would close the loop.

### 11. Felling and logs — S/M
The new Timber physics works: a felled oak across a 31% slope came down in ~2 s and its log rolled 8 m downhill and
came to rest (`10-fell-on-slope-a…d.png`). Polish:
- Split a log into **two half-logs** on its first break (Valheim), each giving half the wood, rather than all the wood
  at once on the second blow.
- The crown "breaks up" by shrinking and sinking (`harvest.js:277`). Add a leaf burst (`impact(…, 'leaves')`) where it
  lies, so it doesn't read as scaling away.
- Make the camera kick and the creak more distinct at the moment the last blow lands, before the fall: the tree
  hesitates, cracks, then goes. Players love that beat.
- Stumps: see bug 11.

### 12. Give every material a use — M
These have no recipe or piece at all (`exp6.mjs`): `log`, `sharpBone`, `coal`, `dandelion`, `moonflower`, `giantHide`,
`minotaurHide`, `chimeraHide`, `rabbitHide`, `boarHide`, the five seeds and two cones. Suggestions:
- **Sharp bone** (dropped by everything; 20–30 from the Minotaur): bone arrows (more pierce), a bone needle, and a
  fish hook.
- **Giant hide**: a giant-hide tower shield or a bedroll (a portable spawn point).
- **Minotaur hide**: a rug (comfort) and the Minotaur cape (stamina regen).
- **Chimera hide**: a fire-resist cape.
- **Seeds and cones**: plant with the hoe. Olive and pomegranate saplings and a tomato patch give the hoe its job (bug
  13). Cones could grow pine and fir saplings for a wood farm.
- **Dandelion and moonflower**: a healing poultice (instant health) and a night-sight or regen tea at the cauldron.
- **Log**: log walls and beams (improvement 1), or simply "Break down into 6 wood" by hand.
- **Coal**: torches that last longer, and the forge (improvement 7).

### 13. Cantilever reach per metre — S
Support loses 20% per piece sideways (`build.js:22`, Valheim's numbers). Our pieces are 3 m, so a floor can reach
**30 m** out from one wall, and a wall tower can stand **18 walls (54 m)** high (`exp2.mjs`: 10 floors out, 18 walls up).
That's 1.5× Valheim's reach. Scale the loss by the distance between piece centres, not per piece. Also note how many
floors are added before red appears.

---------------------------------------------------------------------------------------------------------------------

## New piece and recipe ideas (quick list)

| Idea | Cost (suggested) | Why |
|---|---|---|
| Thatch roof 26° 3×1.5 + 26° corners in/out, ridge cap | 2 wood 1 rope each | low roofs, porches, L-houses |
| Thatch 45° corners in/out | 2 wood 1 rope | hip roofs |
| Window wall 3×3 with shutters (opens with E) | 4 wood 2 rope | light and views; shelter stays |
| Wall 1.5×3, 1×1, 1×2, triangle 26°/45° | 1–2 wood | closing any gap |
| Log beam 3 m / log wall (core wood: V 0.1, H 0.16) | 1 log | uses `log`; taller buildings |
| Y-beam, ladder, floor 1.5×1.5, floor triangle | 1–2 wood | detail and access |
| Stone floor, stone wall 3×3, stone stairs | 4–6 stone | stone has a building use |
| Stone hearth (fire that the rain can't put out under open sky, 2× light, cooks 4) | 15 stone 5 wood | the home's centre |
| Bench and chair (sit, comfort), table, rug (minotaur/deer hide), banner | 4–6 wood (+ hide) | comfort |
| Item stand (trophy, weapon), sign | 4 wood | show off boss heads |
| Large chest 6×4 | 20 wood 2 leather | storage pressure |
| Chopping block, tanning rack (workbench levels 2–3) | 10 wood 2 stone / 10 wood 4 leather | station growth |
| Cauldron (over a fire or hearth) | 10 stone 4 coal | cooking tier |
| Bone arrows ×10 | 5 wood 2 sharp bone 1 feather | sharp bone use |
| Healing poultice | 3 dandelion 1 fiber | dandelion use |
| Moonflower tea (regen +50% 5 min) | 2 moonflower (cauldron) | moonflower use |
| Bedroll (portable spawn, no rest) | 2 giant hide 4 rope | giant hide use |
| Minotaur cape | 6 minotaur hide 2 rope | boss hide use |
| Sapling/seed planting with the hoe | seed | hoe, seeds and cones |

---------------------------------------------------------------------------------------------------------------------

## What works well (keep)
- Snapping is careful: the line-of-aim scoring, the `lastSnap` hold that stops flicker, gaps filled between roof
  panels, and doors only in frames. The suites cover it closely (`placement`, `build`, `hillside`, `build-houses`).
- Rows of walls on hillsides (the earth is raised to the wall) feel right. The roof patch for the old houses is a nice
  touch.
- The harvest feedback is strong: camera punch by weight, hit-stop, the right particles per material, and the
  wrong-tool clink with a rare toast.
- The cooking stand flow (E routes to the stand or the fire, F douses, one sizzle) is clean and tested.

## Screenshots
- `01-floors-off-a-wall-raise-earth-and-door-without-frame.png`: bug 10 (mound), bug 7 (door), and the toast flood from
  bug 5.
- `02-stump-through-floor.png`: bug 11.
- `06-ghost-missing-materials.png`: bug 14, and the ghost through a branch (bug 15).
- `07-crafting-panel.png`, `08-crafting-build-tab-no-hammer.png`, `09-build-menu-roofs.png`: UI notes.
- `10-fell-on-slope-a.png` to `d.png`: a tree felled on a 31% slope; the log rolls 8 m and sleeps.
- `11-wall-built-through-a-trunk.png`: bug 15.
