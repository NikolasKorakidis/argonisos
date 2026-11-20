# The team's "OLD" models: what's there and what to do with it

A review of `incoming assets/audio/0. OLD/` (git-ignored, unzipped) apart from the music: what each file is, how it
compares with what the game uses now, and whether to bring it in. Nothing in the game was changed for this review.

**How it was looked at.** Every FBX and OBJ (and the four nested zips, unpacked to a scratch folder) was opened in
headless Blender 5.1 for triangle counts, textures, armatures and vertex groups; the bone names and rest positions of the
armour were compared with the GreekWarfare characters the game already converts. Each model was then rendered next to
the one the game uses for the same item (a clean EEVEE render, orthographic, same sun; not the game's own light: that
would have needed each model converted into `assets/models/pack/` first). The game's RPGPP props (lightstone axe and
dagger, spade, torch) come out white in Blender because of how their shared atlas maps, so for those the game's own
inventory icons (`assets/ui/pack/icons/`, rendered from the held models) are the fairer picture of "now".

## The lineups

Scratch renders (left, blue labels: what the game uses; right, red labels: the OLD delivery):

| Image | What |
|---|---|
| `/private/tmp/claude-501/-Users-nikolaskorakidis-codebase-games-argonisos/7ebc60a2-5510-4c99-bf7d-56c2f1d6ad57/scratchpad/shots/1-axes.png` | axes: crude, lightstone, the AI fallback; OLD stone, lightstone, bronze, iron, gold |
| `…/scratchpad/shots/2-blades-clubs.png` | daggers, club; OLD daggers, bronze sword, wood club, bronze mace |
| `…/scratchpad/shots/3-spears-bows.png` | spears and bows |
| `…/scratchpad/shots/4-arrows-quiver.png` | arrows (six OLD kinds) and quivers |
| `…/scratchpad/shots/5-shields.png` | shields |
| `…/scratchpad/shots/6-tools.png` | hammer, pickaxe, hoe, torch; OLD flask and Hephaestus belt |
| `…/scratchpad/shots/7-materials.png` | olive, acorn, pomegranate, cones, feather, lightning bolt, shoes |
| `…/scratchpad/shots/8-armour-game.png` | the hero bare, in the Thrower set and in the Cretan set (as `heroArmour.glb` has them), then the OLD Javelin Thrower, Cretan, Athenian and Theban sets on a grey body |
| `…/scratchpad/shots/9-armour-heroes-a.png` | OLD Achilles, Hercules, Jason, Odyssey, Perseus sets |
| `…/scratchpad/shots/10-armour-heroes-b.png` | OLD Bellerophon, Theseus, Corinthian, Spartan, Slinger sets |
| `…/scratchpad/shots/11-enemy.png` | the game's skeleton beside the OLD "enemy" |
| `…/scratchpad/shots/game-icons.png` | the game's current inventory icons for the same items |
| `…/scratchpad/shots/ui-sheet.png`, `current-ui.png` | the OLD UI elements; the SharpUI sprites the game uses now |
| `…/scratchpad/shots/refs-sheet.png` | the reference PNGs (concept art, previews) |

(`…` is `/private/tmp/claude-501/-Users-nikolaskorakidis-codebase-games-argonisos/7ebc60a2-5510-4c99-bf7d-56c2f1d6ad57`;
the scratch folder may be cleared by a reboot. The scripts that made them are next to them, in `scratchpad/scripts/`.)

## What the delivery is, in short

- **Armour (54 FBX).** Not new models from scratch: they are the GreekWarfare characters (the pack the game's armour
  already comes from) cut into helmet, body and left and right leg pieces, re-exported through Blender, with seven
  sets kitbashed and recoloured into heroes (Achilles, Hercules with a lion-pelt hood, Jason, Odysseus, Perseus,
  Bellerophon, Theseus). Each piece is **skinned to the GreekWarfare skeleton** (same bone names apart from the fingers,
  which gain `_L`/`_R`; same rest pose: hips 0.871 m, head 1.583 m) and UV-mapped onto the pack's
  `GreekWarfareTextureBlue.png`, which is in the pack but not in the delivery. They're the best thing here.
- **Weapons and tools (35 FBX).** Low-poly (100–600 triangles), each with its **own hand-painted 1024–2048 px texture
  embedded in the FBX**, static (no rig), in odd units (normalising handles that). Their painted, noisy surface is a
  different style from the game's flat-coloured Polygon look, so most look out of place beside the hero.
  Several share one mesh: stone/lightstone axe, stone/lightstone dagger, bronze/gold axe (iron is a variant), and five
  of the six arrows.
- **AI-generated models (4 zips, 34k–72k triangles, 4×2048 PBR maps each):** axe, bow, arrow, the "enemy" skeleton and
  the "faretra" (quiver). The axe, bow and arrow are **byte for byte the files already in `assets/models/`**
  (`axe.fbx` is the held axe's fallback, `bow.fbx` is the crude bow the game shows now, `arrow.fbx` the arrow's
  fallback). The skeleton and quiver are unrigged.
- **Materials (9 FBX).** Low-poly food and nature pieces made with plain material colours (no textures): olive on a
  twig, acorn, pomegranate (flat and smooth versions), pine and fir cones, a feather, a lightning bolt. The four PNGs
  beside them are watermarked previews.
- **UI elements (48 PNG).** A bright casual-mobile kit: gold-rimmed round buttons and bars, blue panels, parchment panels,
  emoji-like heart/food/water/happiness icons, a touch joystick, slot frames.
- **Other:** 4 concept-art sheets (reference only), `character-mesh-male/` holds only a roughness texture (no mesh),
  `Simple_Shoes` (static, unrigged, 156 tris).

## Inventory

Tris are triangles after import. "Own tex" = one texture of its own embedded in the FBX (a loose PNG copy sits beside most).

### Weapons, shields, ammunition

| File | Tris | Texture | Rig | In the game now | Verdict | Effort |
|---|---|---|---|---|---|---|
| Stone_Axe | 224 | own 2048 | none | Crude Axe = RPGPP `axeCrude` | **Skip**: a round stone blob on a stick, worse than now | – |
| Lightstone_Axe | 224 (same mesh) | own 2048 | none | Lightstone Axe = RPGPP `axeGood` | **Skip**: same blob, paler | – |
| Bronze_Axe | 568 | own 1024 | none | none (no bronze tier) | **Later, probably not**: a fantasy half-moon head, not Greek | S |
| Iron_Axe | 504 | 32 px palette | none | none | **Later**: the only flat-palette weapon, closest to the game's look | S |
| Gold_Axe | 568 (Bronze's mesh) | own 1024 | none | none | **Later, probably not**: as Bronze | S |
| Stone_Dagger / Lightstone_Dagger | 172 each (one mesh) | own 2048 | none | RPGPP `knifeCrude` / `knifeGood` | **Skip**: tidy but no better; painted style | – |
| Bronze_Dagger | 506 | own 2048 | none | none | **Later** (a bronze tier) | S |
| Bronze_Sword | 198 | own 2048 | none | none (no swords) | **Later**: decent leaf blade; the pack's in-style Xiphos A–F and Kopis are the alternative | S |
| Wood_Club | 352 | own 2048 | none | Synty `club` | **Skip**: equal at best | – |
| Bronze_Mace | 336 | own 2048 | none | none | **Skip**: reads as a rolling pin | – |
| Stone_Spear | 220 | own 2048 | none | Crude Spear = a Synty palisade stake thinned to 30% | **Use now**: a real spear instead of a sharpened post | S |
| Lightstone_Spear | 254 | own 2048 | none | GreekWarfare Doru A | **Skip**: the Doru is in style and as good | – |
| Bronze_Spear | 128 | own 2048 | none | none | **Later** (or Doru B/C/E from the pack) | S |
| Crude_Bow | 260 | own 2048 | none | the AI `bow.fbx` | **Skip**: boxy, worse than now | – |
| Cretan_Bow | 432 | own 2048 | none | GreekWarfare Cretan bow | **Skip**: thinner, no better, off-style | – |
| Stone / Lightstone / SharpBone / Fire / Poison_Arrow | 274 each (one mesh) | own 2048 each | none | GreekWarfare arrow | **Later** for ammo kinds, but tinting the game's arrow head and fletching gives the same result for free | S |
| Bronze_Arrow | 160 | own 1024 | none | – | **Later** with the others | S |
| Wood_Shield | 108 | own 2048 | none | Crude Shield = the painted Cretan small shield | **Use now (optional)**: a plain plank shield suits "crude" better than a painted double-axe one | S |
| Wood_Tower_Shield | 300 | own 2048 | none | Crude Tower Shield = Hoplon Athens | **Skip** for now: loose planks with no bracing, looks unfinished | – |
| Aspis_Shield | 956 | own 2048 | none | none | **Later, probably not**: the pack's seven in-style hoplons (Sparta, Thebes, Corinth, Champion A/B, General) do this better | S |
| axe/ (AI, zip-free folder) | 34,140 | 4×2048 PBR | none | already `assets/models/axe.fbx` | **Nothing to do** | – |
| bow/model.zip (AI) | 36,356 | 4×2048 PBR | none | already `assets/models/bow.fbx` (the crude bow) | **Nothing to do** | – |
| arrow/arrow.zip (AI) | 65,628 (5 LODs) | 4×2048 PBR | none | already `assets/models/arrow.fbx` | **Nothing to do** | – |

### Tools

| File | Tris | Texture | In the game now | Verdict | Effort |
|---|---|---|---|---|---|
| Wooden_Hammer | 316 | own 2048 | RPGPP mallet | **Skip**: equal | – |
| Stone_Pickaxe | 212 | own 2048 | Synty pickaxe | **Skip**: a one-sided pick that reads as a sickle | – |
| Bronze_Pickaxe | 354 | own 2048 | none (`tier: 1` only) | **Later**: a good second-tier pick | S |
| Hoe | 188 | own 2048 | RPGPP spade used as a hoe | **Use now**: a real hoe, blade at right angles | S (no `flat` turn) |
| Cultivator | 412 | own 2048 | none | **Skip**: odd shape | – |
| Torch | 160 | own 2048 | RPGPP torch | **Skip**: equal | – |
| Flask | 366 | own 2048 | none | **Later** if water or potions come | S |
| Hephaestus_Belt | 1,416 | own 2048 | none | **Later**: a worn trinket; not skinned, would need a waist bone parent | M |

### Armour (all skinned to the GreekWarfare skeleton, `GreekWarfareTextureBlue`)

| Set | Helmet | Body (torso, skirt, bracers) | Left + right leg (greave and sandal) | Source | Verdict |
|---|---|---|---|---|---|
| Achilles | 304 | 1,290 | 215 + 215 | kitbash, gold cuirass, red crest | **Use** (hero set) |
| Hercules | 582 (lion pelt over the shoulders) | 1,216 | 199 + 199 | kitbash | **Use**: the most striking |
| Jason | 234 | 1,416 | 192 + 192 | kitbash | **Use** |
| Odyssey (Odysseus) | 374 | 1,848 | 167 + 167 | kitbash, red | **Use** |
| Perseus | 392 | 2,076 | 206 + 206 | kitbash, dark leather | **Use** |
| Bellerofont | 336 | 1,853 | 221 + 221 | kitbash | **Use** |
| Theseus | – (none delivered) | 1,868 | 177 + 177 | kitbash | **Use** (needs a helmet: one from the pack) |
| JevelinThrower | 306 | 679 | 370 + 370 | pack Javelin Thrower, blue | **Later**: a blue-trim twin of what the Thrower set already uses |
| Cretan | 472 | 987 | 162 + 162 | pack Cretan Archer, blue | **Later**: twin of the current Cretan helmet |
| Athenian | 330 | 2,036 | 206 + 206 | pack Athenian Hoplite, blue | **Later**: the current Cretan body and legs, blue |
| Theban | 304 | 2,618 | 217 + 217 | pack Theban Hoplite, blue | **Later**: the current Thrower body and legs, blue |
| Corinthian | 530 | 1,894 | 242 + 242 | pack, bronze | **Use later** for a tier |
| Spartan | 328 | 1,890 | 231 + 231 | pack, bronze and blue | **Use later** for a tier |
| Slinger | 120 (hair band) | 1,037 | 231 + 231 | pack Slinger | **Later** (a light set) |
| Simple_Shoes | – | – | 156, own 2048, static | – | **Skip**: not skinned |

### Materials, characters, other

| File | Tris | Texture | In the game now | Verdict | Effort |
|---|---|---|---|---|---|
| Green Olive | 3,036 | 6 material colours | no olive icon (black-figure fallback) | **Use now** for the olive's icon (and a pickup look) | S |
| Acorn Flat / smooth | 344 | 2 colours | no acorn icon | **Use now** (Flat) for the acorn's icon | S |
| Pomegranate Flat / smooth | 1,216 | 3 colours | a Synty vegetable tinted red | **Use now** (Flat): clearly a pomegranate, with its crown | S |
| Pine cone / Fir cone | 772 / 1,918 | 1 colour | a pine cone from the alpine pack | **Skip**: the current one is better | – |
| Feather | 500 | 2 colours | `pFeather` | **Skip**: equal | – |
| zeus_lightning | 32 | 1 colour | – | **Later, maybe**: a bolt emblem (a map marker or an effect) | S |
| enemy (skeleton, AI) | 72,324 (LOD) / 37,330 (OBJ) | 4×2048 PBR | rigged pack skeleton | **Skip**: unrigged, 70× heavier, painted style | L |
| faretra (quiver, AI) | 34,708 | 4×2048 PBR | none worn | **Skip**: the pack's `Quiver_CretanArcher` (already exported, unused, in style) is the one to wear | – |
| character-mesh-male | – | roughness PNG only | – | **Skip**: the mesh is missing; ask the team if it matters | – |
| concept art (4 PNG) | – | – | – | reference only; keep out of the repo | – |

### UI elements (48 PNG, 100–2048 px, RGBA)

Gold-rimmed round buttons (close, pause, coloured "bar" discs), blue rectangular buttons and panels, parchment panels
(big, long, square, in two tones), long and tall parchment bars, gradient fill bars (red, green, blue, yellow), slots
with selected and highlight frames, soft circle and square masks, a loading ring, a refresh arrow, a clock, a touch
joystick, and four status icons (heart in hands, soup bowl, water drop, smiley for "happiness").

- **Skip as a replacement** for the interface: the game's SharpUI set (`assets/ui/pack/ui`, dark bronze and leather)
  matches the black-figure Greek look; this kit is bright casual-mobile and would clash. Its bars for water and
  happiness belong to systems the game doesn't have.
- **Later, maybe:** the parchment panels for paper-like screens (the olive-tree scraps, notes, the map's frame),
  and the joystick only if a touch version ever comes.

## Recommendations and effort

S = an hour or two (a manifest entry, a `PACKED` line in `held.js` with a length and grip offset, an icon, a look in the
game); M = half a day to a day (converter change plus fitting checks); L = more than that.

### The best wins

1. **The armour sets: use them (M).** Fourteen ready-made sets on the very skeleton `heroArmour` is converted from,
   already split into the slots the game has (head, body, legs), on a texture the pack already provides
   (`pack/tex/greekwarfare-greekwarfaretextureblue.webp` exists). The seven hero sets are new looks the game can't get
   from the pack, ready for a later tier or a trophy reward; Corinthian and Spartan suit a bronze tier.
   What it takes:
   - `convert.mjs`/`fbx-page.mjs`: a `wear` item that takes **several files** (the left and right leg are separate
     FBX; today a wear item is one mesh from one file), and `src` paths outside the pack folder (or move the
     delivery to e.g. `incoming assets/old/`: it sits oddly under `audio/` now).
   - Finger bones are named `Finger_01_L` rather than `Finger_01`; `mixamoName` already maps both, and `posed` falls
     back to the piece's own bones when a name isn't in the pose, which hold the same rest pose. Only the Odysseus and
     Corinthian bodies are weighted to hand or finger bones at all (their bracers reach the hand).
   - **They are shells.** The game's current wear parts are whole regions of a dressed character (tunic, arms and
     all), so wearing body armour hides the hero's own torso (`base_body`) and legs armour hides `base_legs`. These
     pieces are just the cuirass and skirt, and greaves and sandals: worn that way the arms and thighs would vanish. Either
     keep the base body showing under them (with the pack tunic beneath, e.g. a region cut from the Cretan Archer as
     now, plus the shell), or add the under-layer to each item in the converter. On a grey stand-in body the body
     shows through in places (Odysseus's skirt, Theseus's waist), so expect to push a few pieces out or hide what's
     under them. Check on the woman's body too.
   - `heroArmour.glb` grows by about 2.5–3.5k triangles per set while every set is carried as hidden parts; past
     a few sets, split it into a file per set loaded on equip.
2. **Food models for icons and pickups (S each).** The olive on its twig, the flat acorn and the flat pomegranate are in the
   game's flat low-poly style and fill real gaps: olive and acorn have no pack icon today, and the pomegranate's is a
   tinted vegetable. Convert as static models (scale them down hugely: the olive comes in at 46 units across) and point
   `icons.mjs` at them; the same models can be the fruit pickups.
3. **Stone_Spear and Hoe (S each, with a style caveat).** The right shapes where the game makes do with a palisade
   stake and a spade. Through `normalizeHandle` and `headAlong` they need only a length and the grip offset (the hoe
   without `flat`). Downscale their textures to 256–512 px; better still, bake each face's average colour into vertex
   colours so they share the game's flat look (a small `convert.py` option worth having for any OLD weapon).

### What would need work

- **The rest of the weapons for later tiers** (bronze dagger, sword and spear, the arrow kinds, Bronze_Pickaxe,
  Iron_Axe): S each to bring in, but all except the Iron Axe carry the painted style. Prefer the pack's in-style
  GreekWarfare swords, spears and hoplons for a bronze tier, and use these where the pack has nothing (the pickaxe,
  arrow kinds, a flask).
- **Hephaestus belt (M):** unskinned; it would need parenting to the hips bone and fitting to both bodies.
- **Wood_Shield as the crude shield (S):** a design call (plainer suits "crude") rather than a quality win.

### What to skip

The stone and lightstone axes and daggers, the bronze mace, wood club, crude and Cretan bows, lightstone spear, tower
shield, stone pickaxe, hammer, torch and cultivator (equal to or worse than what's in now); the AI axe, bow and arrow (already in the
game); the AI skeleton and quiver (unrigged, 35–72k triangles; the game's rigged skeleton and the pack's quiver are
better); the shoes (not skinned); the cones and feather (current ones are better or equal); the UI kit as an interface
replacement; `character-mesh-male` (no mesh).

## Housekeeping

- Everything here is team or pack art and stays out of the public repo like `assets/models/pack/`: the armour is
  derived from the licensed GreekWarfare pack, and the material previews carry a commission site's watermark, so treat
  the weapons and food the same way. Converted output goes to `assets/models/pack/` (git-ignored); add anything used
  to the private assets backup that feeds the deploy.
- Without the pack, anything brought in must keep a carved or existing fallback, as `held.js` does now.
