# Pack building pieces: the reviewer's list

Status: **for review** (26 Nov). Every building piece of RPGPP_AG, Synty Vikings and Synty Ancient Empire is in the game
as a piece the hammer can place, **only with the dev tools' Free build on** (Esc → Dev tools → Free crafting and building), each pack in tabs
of its own in the hammer's menu ("RPGPP · Walls", "Vikings · Roofs", "Empire · Stairs"…). Tick the ones that stay
(`[x]`); the rest go. Their textures become stylised texels afterwards.

How they fit our grid (3 m walls and floors, 3 m storeys):
- **RPGPP_AG** is on our grid already (it's the pack our own kit comes from): sizes as the pack names them.
- **Ancient Empire** is built on 2.5 m: stretched to 3 m across (×1.2), its heights kept (its walls are 3 m high).
- **Vikings** isn't modular (whole house bases, roofs to fit them): scaled by 1.2 and rounded to the 1.5 m grid, so a
  house base is 6 × 2.9 × 6 m and its roof sits on it.
- Every model is stretched to the size in the table (by a few per cent at most for RPGPP and Ancient Empire; the
  rounding to the grid can take up to 0.75 m off or on for Vikings), so pieces meet edge to edge.

What each kind does in the game (the "As" column): walls, floors, roofs, gables, stairs, beams and fences snap and hold
each other up as our own pieces do; a door goes into a doorway of about its size and is stretched to fill it; a **trim**
(windows, shutters, ornaments, handrails, roof details) goes on any face of what's built, where you aim; a **block** is
solid with a top to stand on (the Viking house bases have their doors drawn on: you can't go in); ladders can't be
climbed (the game has no climbing, nor has Valheim). Left out: whole buildings (RPGPP's houses and sheds, Vikings' boat
houses and wharf, Ancient Empire's town blocks, amphitheatre and pergola) and the Vikings' crate.

What doesn't fit, and how it's placed instead:
- **RPGPP's L- and U-shaped stairs** (stairs interior 01, 02b–e, wall platform stairs 01b/c, 02b/c) walk as one straight ramp
  across their box; only the straight flights (02a, entrance, wall platform 01a/02a) match their steps.
- **Roof corners and hip ends** (RPGPP roof corner/end 02–03, Ancient Empire roof base corner) and the **towers' and
  balconies' roofs** have no template of their own: they go as trims (where you aim) and give no shelter.
- **Ancient Empire's plain walls, steps and roof sides** show the whole texture atlas across each face in the pack (the
  pack means them to take a plaster material): they get its white plaster instead.
- **Snow** (Vikings) and **light** (RPGPP's optimised, a few triangles) versions are in as their own pieces.
- **Gates** (RPGPP's door gates, Ancient Empire's fence gate) hang as doors only in a doorway about their width (the
  RPGPP gate frames, Ancient Empire's double doorways); the fence gate stands as a fence.

Pictures: `assets/ui/pack/icons/p_<id>.webp` (pack art, so not in the public repo: `node tools/assets/icons.mjs` makes them).

## RPGPP (902)

### RPGPP · Walls (179)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Basement 01 1½m a | wall | 1.5 × 3 × 0.8 | `rpgpp-ag/rpgpp-ag-basement-01-1-5m-a` | ![](../../assets/ui/pack/icons/p_ag.basement-01-1-5m-a.webp) |
| [ ] | Basement 01 3m a | wall | 3 × 3 × 0.8 | `rpgpp-ag/rpgpp-ag-basement-01-3m-a` | ![](../../assets/ui/pack/icons/p_ag.basement-01-3m-a.webp) |
| [ ] | Basement 01 3m corner a | post | 0.92 × 3.5 × 1.02 | `rpgpp-ag/rpgpp-ag-basement-01-3m-corner-a` | ![](../../assets/ui/pack/icons/p_ag.basement-01-3m-corner-a.webp) |
| [ ] | Basement 01 3m corner b | post | 1.72 × 3.5 × 1.72 | `rpgpp-ag/rpgpp-ag-basement-01-3m-corner-b` | ![](../../assets/ui/pack/icons/p_ag.basement-01-3m-corner-b.webp) |
| [ ] | Basement 02 1½m a | wall | 1.5 × 3 × 0.24 | `rpgpp-ag/rpgpp-ag-basement-02-1-5m-a` | ![](../../assets/ui/pack/icons/p_ag.basement-02-1-5m-a.webp) |
| [ ] | Basement 02 3m a | wall | 3 × 3 × 0.24 | `rpgpp-ag/rpgpp-ag-basement-02-3m-a` | ![](../../assets/ui/pack/icons/p_ag.basement-02-3m-a.webp) |
| [ ] | Basement 02 3m b | wall | 3 × 3 × 0.24 | `rpgpp-ag/rpgpp-ag-basement-02-3m-b` | ![](../../assets/ui/pack/icons/p_ag.basement-02-3m-b.webp) |
| [ ] | Basement 02 3m corner a | post | 0.62 × 3 × 0.64 | `rpgpp-ag/rpgpp-ag-basement-02-3m-corner-a` | ![](../../assets/ui/pack/icons/p_ag.basement-02-3m-corner-a.webp) |
| [ ] | Basement 02 3m corner b | post | 1.1 × 3 × 1.1 | `rpgpp-ag/rpgpp-ag-basement-02-3m-corner-b` | ![](../../assets/ui/pack/icons/p_ag.basement-02-3m-corner-b.webp) |
| [ ] | Basement 03 1½m a | wall | 1.5 × 3 × 0.24 | `rpgpp-ag/rpgpp-ag-basement-03-1-5m-a` | ![](../../assets/ui/pack/icons/p_ag.basement-03-1-5m-a.webp) |
| [ ] | Basement 03 3m a | wall | 3 × 3 × 0.24 | `rpgpp-ag/rpgpp-ag-basement-03-3m-a` | ![](../../assets/ui/pack/icons/p_ag.basement-03-3m-a.webp) |
| [ ] | Basement 03 3m b | wall | 3 × 3 × 0.24 | `rpgpp-ag/rpgpp-ag-basement-03-3m-b` | ![](../../assets/ui/pack/icons/p_ag.basement-03-3m-b.webp) |
| [ ] | Basement 03 3m c | wall | 3 × 3 × 0.24 | `rpgpp-ag/rpgpp-ag-basement-03-3m-c` | ![](../../assets/ui/pack/icons/p_ag.basement-03-3m-c.webp) |
| [ ] | Wall 01 1½x3 a | wall | 1.5 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-1-5x3-a` | ![](../../assets/ui/pack/icons/p_ag.wall-01-1-5x3-a.webp) |
| [ ] | Wall 01 1½x4 a | wall | 1.5 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-1-5x4-a` | ![](../../assets/ui/pack/icons/p_ag.wall-01-1-5x4-a.webp) |
| [ ] | Wall 01 3×1 a | wall | 3 × 1 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x1-a` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x1-a.webp) |
| [ ] | Wall 01 3×1 b | wall | 3 × 1 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x1-b` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x1-b.webp) |
| [ ] | Wall 01 3×3 a | wall | 3 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x3-a` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x3-a.webp) |
| [ ] | Wall 01 3×3 b | wall | 3 × 3 × 0.48 | `rpgpp-ag/rpgpp-ag-wall-01-3x3-b` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x3-b.webp) |
| [ ] | Wall 01 3×3 c | wall | 3 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x3-c` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x3-c.webp) |
| [ ] | Wall 01 3×3 door a | wall (doorway) | 3 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x3-door-a` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x3-door-a.webp) |
| [ ] | Wall 01 3×3 door b | wall (doorway) | 3 × 3 × 0.44 | `rpgpp-ag/rpgpp-ag-wall-01-3x3-door-b` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x3-door-b.webp) |
| [ ] | Wall 01 3×3 window a | wall | 3 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x3-window-a` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x3-window-a.webp) |
| [ ] | Wall 01 3×3 window b | wall | 3 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x3-window-b` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x3-window-b.webp) |
| [ ] | Wall 01 3×3 window c | wall | 3 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x3-window-c` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x3-window-c.webp) |
| [ ] | Wall 01 3×3 window d | wall | 3 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x3-window-d` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x3-window-d.webp) |
| [ ] | Wall 01 3×3 window e | wall | 3 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x3-window-e` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x3-window-e.webp) |
| [ ] | Wall 01 3×4 a | wall | 3 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x4-a` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x4-a.webp) |
| [ ] | Wall 01 3×4 b | wall | 3 × 4 × 0.48 | `rpgpp-ag/rpgpp-ag-wall-01-3x4-b` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x4-b.webp) |
| [ ] | Wall 01 3×4 c | wall | 3 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x4-c` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x4-c.webp) |
| [ ] | Wall 01 3×4 door a | wall (doorway) | 3 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x4-door-a` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x4-door-a.webp) |
| [ ] | Wall 01 3×4 door b | wall (doorway) | 3 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x4-door-b` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x4-door-b.webp) |
| [ ] | Wall 01 3×4 door d | wall | 3 × 1 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x4-door-d` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x4-door-d.webp) |
| [ ] | Wall 01 3×4 window a | wall | 3 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x4-window-a` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x4-window-a.webp) |
| [ ] | Wall 01 3×4 window b | wall | 3 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x4-window-b` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x4-window-b.webp) |
| [ ] | Wall 01 3×4 window c | wall | 3 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x4-window-c` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x4-window-c.webp) |
| [ ] | Wall 01 3×4 window d | wall | 3 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x4-window-d` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x4-window-d.webp) |
| [ ] | Wall 01 3×4 window e | wall | 3 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-01-3x4-window-e` | ![](../../assets/ui/pack/icons/p_ag.wall-01-3x4-window-e.webp) |
| [ ] | Wall 02 1½x3 a | wall | 1.5 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-02-1-5x3-a` | ![](../../assets/ui/pack/icons/p_ag.wall-02-1-5x3-a.webp) |
| [ ] | Wall 02 1½x4 a | wall | 1.5 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-02-1-5x4-a` | ![](../../assets/ui/pack/icons/p_ag.wall-02-1-5x4-a.webp) |
| [ ] | Wall 02 3×1 a | wall | 3 × 1 × 0.52 | `rpgpp-ag/rpgpp-ag-wall-02-3x1-a` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x1-a.webp) |
| [ ] | Wall 02 3×1 b | wall | 3 × 1 × 0.52 | `rpgpp-ag/rpgpp-ag-wall-02-3x1-b` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x1-b.webp) |
| [ ] | Wall 02 3×1 c | wall | 3 × 1 × 0.52 | `rpgpp-ag/rpgpp-ag-wall-02-3x1-c` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x1-c.webp) |
| [ ] | Wall 02 3×3 a | wall | 3 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-02-3x3-a` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x3-a.webp) |
| [ ] | Wall 02 3×3 b | wall | 3 × 3 × 0.48 | `rpgpp-ag/rpgpp-ag-wall-02-3x3-b` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x3-b.webp) |
| [ ] | Wall 02 3×3 c | wall | 3 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-02-3x3-c` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x3-c.webp) |
| [ ] | Wall 02 3×3 door a | wall (doorway) | 3 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-02-3x3-door-a` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x3-door-a.webp) |
| [ ] | Wall 02 3×3 door b | wall (doorway) | 3 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-02-3x3-door-b` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x3-door-b.webp) |
| [ ] | Wall 02 3×3 window a | wall | 3 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-02-3x3-window-a` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x3-window-a.webp) |
| [ ] | Wall 02 3×3 window b | wall | 3 × 3 × 0.48 | `rpgpp-ag/rpgpp-ag-wall-02-3x3-window-b` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x3-window-b.webp) |
| [ ] | Wall 02 3×3 window c | wall | 3 × 3 × 0.48 | `rpgpp-ag/rpgpp-ag-wall-02-3x3-window-c` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x3-window-c.webp) |
| [ ] | Wall 02 3×3 window d | wall | 3 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-02-3x3-window-d` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x3-window-d.webp) |
| [ ] | Wall 02 3×3 window e | wall | 3 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-02-3x3-window-e` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x3-window-e.webp) |
| [ ] | Wall 02 3×4 a | wall | 3 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-02-3x4-a` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x4-a.webp) |
| [ ] | Wall 02 3×4 b | wall | 3 × 4 × 0.48 | `rpgpp-ag/rpgpp-ag-wall-02-3x4-b` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x4-b.webp) |
| [ ] | Wall 02 3×4 c | wall | 3 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-02-3x4-c` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x4-c.webp) |
| [ ] | Wall 02 3×4 door a | wall (doorway) | 3 × 4 × 0.52 | `rpgpp-ag/rpgpp-ag-wall-02-3x4-door-a` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x4-door-a.webp) |
| [ ] | Wall 02 3×4 door b | wall (doorway) | 3 × 4 × 0.52 | `rpgpp-ag/rpgpp-ag-wall-02-3x4-door-b` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x4-door-b.webp) |
| [ ] | Wall 02 3×4 door d | wall | 3 × 1 × 0.52 | `rpgpp-ag/rpgpp-ag-wall-02-3x4-door-d` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x4-door-d.webp) |
| [ ] | Wall 02 3×4 window a | wall | 3 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-02-3x4-window-a` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x4-window-a.webp) |
| [ ] | Wall 02 3×4 window b | wall | 3 × 4 × 0.48 | `rpgpp-ag/rpgpp-ag-wall-02-3x4-window-b` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x4-window-b.webp) |
| [ ] | Wall 02 3×4 window c | wall | 3 × 4 × 0.48 | `rpgpp-ag/rpgpp-ag-wall-02-3x4-window-c` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x4-window-c.webp) |
| [ ] | Wall 02 3×4 window d | wall | 3 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-02-3x4-window-d` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x4-window-d.webp) |
| [ ] | Wall 02 3×4 window e | wall | 3 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-wall-02-3x4-window-e` | ![](../../assets/ui/pack/icons/p_ag.wall-02-3x4-window-e.webp) |
| [ ] | Wall 03 1½x3 a | wall | 1.5 × 3 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-1-5x3-a` | ![](../../assets/ui/pack/icons/p_ag.wall-03-1-5x3-a.webp) |
| [ ] | Wall 03 1½x3 a (light) | wall | 1.5 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-1-5x3-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-1-5x3-a-optimized.webp) |
| [ ] | Wall 03 1½x4 a | wall | 1.5 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-1-5x4-a` | ![](../../assets/ui/pack/icons/p_ag.wall-03-1-5x4-a.webp) |
| [ ] | Wall 03 1½x4 a (light) | wall | 1.5 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-1-5x4-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-1-5x4-a-optimized.webp) |
| [ ] | Wall 03 3×3 a | wall | 3 × 3 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-a` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-a.webp) |
| [ ] | Wall 03 3×3 a (light) | wall | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-a-optimized.webp) |
| [ ] | Wall 03 3×3 corner a | post | 1.74 × 3 × 1.72 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-corner-a` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-corner-a.webp) |
| [ ] | Wall 03 3×3 door a | wall (doorway) | 3 × 3 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-door-a` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-door-a.webp) |
| [ ] | Wall 03 3×3 door a (light) | wall (doorway) | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-door-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-door-a-optimized.webp) |
| [ ] | Wall 03 3×3 door b | wall (doorway) | 3 × 3 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-door-b` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-door-b.webp) |
| [ ] | Wall 03 3×3 door b (light) | wall (doorway) | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-door-b-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-door-b-optimized.webp) |
| [ ] | Wall 03 3×3 door c | wall (doorway) | 3 × 3 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-door-c` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-door-c.webp) |
| [ ] | Wall 03 3×3 door c (light) | wall (doorway) | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-door-c-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-door-c-optimized.webp) |
| [ ] | Wall 03 3×3 window a | wall | 3 × 3 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-window-a` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-window-a.webp) |
| [ ] | Wall 03 3×3 window a (light) | wall | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-window-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-window-a-optimized.webp) |
| [ ] | Wall 03 3×3 window b | wall | 3 × 3 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-window-b` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-window-b.webp) |
| [ ] | Wall 03 3×3 window b (light) | wall | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-window-b-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-window-b-optimized.webp) |
| [ ] | Wall 03 3×3 window c | wall | 3 × 3 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-window-c` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-window-c.webp) |
| [ ] | Wall 03 3×3 window c (light) | wall | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-window-c-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-window-c-optimized.webp) |
| [ ] | Wall 03 3×3 window d | wall | 3 × 3 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-window-d` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-window-d.webp) |
| [ ] | Wall 03 3×3 window d (light) | wall | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-window-d-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-window-d-optimized.webp) |
| [ ] | Wall 03 3×3 window e | wall | 3 × 3 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-window-e` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-window-e.webp) |
| [ ] | Wall 03 3×3 window e (light) | wall | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x3-window-e-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x3-window-e-optimized.webp) |
| [ ] | Wall 03 3×4 a | wall | 3 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-a` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-a.webp) |
| [ ] | Wall 03 3×4 a (light) | wall | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-a-optimized.webp) |
| [ ] | Wall 03 3×4 corner a | post | 1.74 × 4 × 1.72 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-corner-a` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-corner-a.webp) |
| [ ] | Wall 03 3×4 door a | wall (doorway) | 3 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-door-a` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-door-a.webp) |
| [ ] | Wall 03 3×4 door a (light) | wall (doorway) | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-door-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-door-a-optimized.webp) |
| [ ] | Wall 03 3×4 door b | wall (doorway) | 3 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-door-b` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-door-b.webp) |
| [ ] | Wall 03 3×4 door b (light) | wall (doorway) | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-door-b-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-door-b-optimized.webp) |
| [ ] | Wall 03 3×4 door c | wall (doorway) | 3 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-door-c` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-door-c.webp) |
| [ ] | Wall 03 3×4 door c (light) | wall (doorway) | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-door-c-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-door-c-optimized.webp) |
| [ ] | Wall 03 3×4 door d | wall | 3 × 1 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-door-d` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-door-d.webp) |
| [ ] | Wall 03 3×4 door d (light) | wall | 3 × 1 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-door-d-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-door-d-optimized.webp) |
| [ ] | Wall 03 3×4 window a | wall | 3 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-window-a` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-window-a.webp) |
| [ ] | Wall 03 3×4 window a (light) | wall | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-window-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-window-a-optimized.webp) |
| [ ] | Wall 03 3×4 window b | wall | 3 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-window-b` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-window-b.webp) |
| [ ] | Wall 03 3×4 window b (light) | wall | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-window-b-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-window-b-optimized.webp) |
| [ ] | Wall 03 3×4 window c | wall | 3 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-window-c` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-window-c.webp) |
| [ ] | Wall 03 3×4 window c (light) | wall | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-window-c-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-window-c-optimized.webp) |
| [ ] | Wall 03 3×4 window d | wall | 3 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-window-d` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-window-d.webp) |
| [ ] | Wall 03 3×4 window d (light) | wall | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-window-d-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-window-d-optimized.webp) |
| [ ] | Wall 03 3×4 window e | wall | 3 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-window-e` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-window-e.webp) |
| [ ] | Wall 03 3×4 window e (light) | wall | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-03-3x4-window-e-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-03-3x4-window-e-optimized.webp) |
| [ ] | Wall 04 1½x3 a | wall | 1.5 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-1-5x3-a` | ![](../../assets/ui/pack/icons/p_ag.wall-04-1-5x3-a.webp) |
| [ ] | Wall 04 1½x3 a (light) | wall | 1.5 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-1-5x3-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-1-5x3-a-optimized.webp) |
| [ ] | Wall 04 1½x4 a | wall | 1.5 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-1-5x4-a` | ![](../../assets/ui/pack/icons/p_ag.wall-04-1-5x4-a.webp) |
| [ ] | Wall 04 1½x4 a (light) | wall | 1.5 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-1-5x4-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-1-5x4-a-optimized.webp) |
| [ ] | Wall 04 3×3 a | wall | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-a` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-a.webp) |
| [ ] | Wall 04 3×3 a (light) | wall | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-a-optimized.webp) |
| [ ] | Wall 04 3×3 corner a | post | 1.7 × 3 × 1.7 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-corner-a` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-corner-a.webp) |
| [ ] | Wall 04 3×3 door a | wall (doorway) | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-door-a` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-door-a.webp) |
| [ ] | Wall 04 3×3 door a (light) | wall (doorway) | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-door-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-door-a-optimized.webp) |
| [ ] | Wall 04 3×3 door b | wall (doorway) | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-door-b` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-door-b.webp) |
| [ ] | Wall 04 3×3 door b (light) | wall (doorway) | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-door-b-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-door-b-optimized.webp) |
| [ ] | Wall 04 3×3 door c | wall (doorway) | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-door-c` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-door-c.webp) |
| [ ] | Wall 04 3×3 door c (light) | wall (doorway) | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-door-c-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-door-c-optimized.webp) |
| [ ] | Wall 04 3×3 window a | wall | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-window-a` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-window-a.webp) |
| [ ] | Wall 04 3×3 window a (light) | wall | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-window-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-window-a-optimized.webp) |
| [ ] | Wall 04 3×3 window b | wall | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-window-b` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-window-b.webp) |
| [ ] | Wall 04 3×3 window b (light) | wall | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-window-b-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-window-b-optimized.webp) |
| [ ] | Wall 04 3×3 window c | wall | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-window-c` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-window-c.webp) |
| [ ] | Wall 04 3×3 window c (light) | wall | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-window-c-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-window-c-optimized.webp) |
| [ ] | Wall 04 3×3 window d | wall | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-window-d` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-window-d.webp) |
| [ ] | Wall 04 3×3 window d (light) | wall | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-window-d-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-window-d-optimized.webp) |
| [ ] | Wall 04 3×3 window e | wall | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-window-e` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-window-e.webp) |
| [ ] | Wall 04 3×3 window e (light) | wall | 3 × 3 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x3-window-e-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x3-window-e-optimized.webp) |
| [ ] | Wall 04 3×4 a | wall | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-a` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-a.webp) |
| [ ] | Wall 04 3×4 a (light) | wall | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-a-optimized.webp) |
| [ ] | Wall 04 3×4 corner a | post | 1.7 × 4 × 1.7 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-corner-a` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-corner-a.webp) |
| [ ] | Wall 04 3×4 door a | wall (doorway) | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-door-a` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-door-a.webp) |
| [ ] | Wall 04 3×4 door a (light) | wall (doorway) | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-door-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-door-a-optimized.webp) |
| [ ] | Wall 04 3×4 door b | wall (doorway) | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-door-b` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-door-b.webp) |
| [ ] | Wall 04 3×4 door b (light) | wall (doorway) | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-door-b-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-door-b-optimized.webp) |
| [ ] | Wall 04 3×4 door c | wall (doorway) | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-door-c` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-door-c.webp) |
| [ ] | Wall 04 3×4 door c (light) | wall (doorway) | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-door-c-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-door-c-optimized.webp) |
| [ ] | Wall 04 3×4 door d | wall | 3 × 1 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-door-d` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-door-d.webp) |
| [ ] | Wall 04 3×4 door d (light) | wall | 3 × 1 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-door-d-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-door-d-optimized.webp) |
| [ ] | Wall 04 3×4 window a | wall | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-window-a` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-window-a.webp) |
| [ ] | Wall 04 3×4 window a (light) | wall | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-window-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-window-a-optimized.webp) |
| [ ] | Wall 04 3×4 window b | wall | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-window-b` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-window-b.webp) |
| [ ] | Wall 04 3×4 window b (light) | wall | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-window-b-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-window-b-optimized.webp) |
| [ ] | Wall 04 3×4 window c | wall | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-window-c` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-window-c.webp) |
| [ ] | Wall 04 3×4 window c (light) | wall | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-window-c-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-window-c-optimized.webp) |
| [ ] | Wall 04 3×4 window d | wall | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-window-d` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-window-d.webp) |
| [ ] | Wall 04 3×4 window d (light) | wall | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-window-d-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-window-d-optimized.webp) |
| [ ] | Wall 04 3×4 window e | wall | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-window-e` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-window-e.webp) |
| [ ] | Wall 04 3×4 window e (light) | wall | 3 × 4 × 0.36 | `rpgpp-ag/rpgpp-ag-wall-04-3x4-window-e-optimized` | ![](../../assets/ui/pack/icons/p_ag.wall-04-3x4-window-e-optimized.webp) |
| [ ] | Wall 05 1½x4 a | wall | 1.5 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-1-5x4-a` | ![](../../assets/ui/pack/icons/p_ag.wall-05-1-5x4-a.webp) |
| [ ] | Wall 05 1½x4 b | wall | 1.5 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-1-5x4-b` | ![](../../assets/ui/pack/icons/p_ag.wall-05-1-5x4-b.webp) |
| [ ] | Wall 05 3×3 a | wall | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x3-a` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x3-a.webp) |
| [ ] | Wall 05 3×3 b | wall | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x3-b` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x3-b.webp) |
| [ ] | Wall 05 3×3 c | wall | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x3-c` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x3-c.webp) |
| [ ] | Wall 05 3×3 corner a | post | 1.7 × 3 × 1.7 | `rpgpp-ag/rpgpp-ag-wall-05-3x3-corner-a` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x3-corner-a.webp) |
| [ ] | Wall 05 3×3 door a | wall (doorway) | 3 × 3 × 0.38 | `rpgpp-ag/rpgpp-ag-wall-05-3x3-door-a` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x3-door-a.webp) |
| [ ] | Wall 05 3×3 door b | wall (doorway) | 3 × 3 × 0.38 | `rpgpp-ag/rpgpp-ag-wall-05-3x3-door-b` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x3-door-b.webp) |
| [ ] | Wall 05 3×3 door c | wall (doorway) | 3 × 3 × 0.38 | `rpgpp-ag/rpgpp-ag-wall-05-3x3-door-c` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x3-door-c.webp) |
| [ ] | Wall 05 3×3 window a | wall | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x3-window-a` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x3-window-a.webp) |
| [ ] | Wall 05 3×3 window b | wall | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x3-window-b` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x3-window-b.webp) |
| [ ] | Wall 05 3×3 window c | wall | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x3-window-c` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x3-window-c.webp) |
| [ ] | Wall 05 3×3 window d | wall | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x3-window-d` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x3-window-d.webp) |
| [ ] | Wall 05 3×3 window e | wall | 3 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x3-window-e` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x3-window-e.webp) |
| [ ] | Wall 05 3×4 a | wall | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x4-a` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x4-a.webp) |
| [ ] | Wall 05 3×4 b | wall | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x4-b` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x4-b.webp) |
| [ ] | Wall 05 3×4 c | wall | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x4-c` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x4-c.webp) |
| [ ] | Wall 05 3×4 corner a | post | 1.7 × 4 × 1.7 | `rpgpp-ag/rpgpp-ag-wall-05-3x4-corner-a` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x4-corner-a.webp) |
| [ ] | Wall 05 3×4 door a | wall (doorway) | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x4-door-a` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x4-door-a.webp) |
| [ ] | Wall 05 3×4 door b | wall (doorway) | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x4-door-b` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x4-door-b.webp) |
| [ ] | Wall 05 3×4 door c | wall (doorway) | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x4-door-c` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x4-door-c.webp) |
| [ ] | Wall 05 3×4 door d | wall | 3 × 1 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x4-door-d` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x4-door-d.webp) |
| [ ] | Wall 05 3×4 window a | wall | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x4-window-a` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x4-window-a.webp) |
| [ ] | Wall 05 3×4 window b | wall | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x4-window-b` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x4-window-b.webp) |
| [ ] | Wall 05 3×4 window c | wall | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x4-window-c` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x4-window-c.webp) |
| [ ] | Wall 05 3×4 window d | wall | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x4-window-d` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x4-window-d.webp) |
| [ ] | Wall 05 3×4 window e | wall | 3 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-wall-05-3x4-window-e` | ![](../../assets/ui/pack/icons/p_ag.wall-05-3x4-window-e.webp) |

### RPGPP · Floors (84)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Balcony 01 4m a | deck | 5 × 1.72 × 2.5 | `rpgpp-ag/rpgpp-ag-balcony-01-4m-a` | ![](../../assets/ui/pack/icons/p_ag.balcony-01-4m-a.webp) |
| [ ] | Balcony 01 4m b | deck | 5 × 1.72 × 2.5 | `rpgpp-ag/rpgpp-ag-balcony-01-4m-b` | ![](../../assets/ui/pack/icons/p_ag.balcony-01-4m-b.webp) |
| [ ] | Balcony 01 6m a | deck | 6 × 1.72 × 2.5 | `rpgpp-ag/rpgpp-ag-balcony-01-6m-a` | ![](../../assets/ui/pack/icons/p_ag.balcony-01-6m-a.webp) |
| [ ] | Balcony 01 6m b | deck | 6 × 1.72 × 2.5 | `rpgpp-ag/rpgpp-ag-balcony-01-6m-b` | ![](../../assets/ui/pack/icons/p_ag.balcony-01-6m-b.webp) |
| [ ] | Ceiling 01 1½x3 a | floor | 1.5 × 0.14 × 3 | `rpgpp-ag/rpgpp-ag-ceiling-01-1-5x3-a` | ![](../../assets/ui/pack/icons/p_ag.ceiling-01-1-5x3-a.webp) |
| [ ] | Ceiling 01 1½x3 b | floor | 3 × 0.14 × 1.5 | `rpgpp-ag/rpgpp-ag-ceiling-01-1-5x3-b` | ![](../../assets/ui/pack/icons/p_ag.ceiling-01-1-5x3-b.webp) |
| [ ] | Ceiling 01 1½x3 c | floor | 1.5 × 0.14 × 1.5 | `rpgpp-ag/rpgpp-ag-ceiling-01-1-5x3-c` | ![](../../assets/ui/pack/icons/p_ag.ceiling-01-1-5x3-c.webp) |
| [ ] | Ceiling 01 3×3 a | floor | 3 × 0.14 × 3 | `rpgpp-ag/rpgpp-ag-ceiling-01-3x3-a` | ![](../../assets/ui/pack/icons/p_ag.ceiling-01-3x3-a.webp) |
| [ ] | Ceiling 01 3×3 a (light) | floor | 3 × 0.14 × 3 | `rpgpp-ag/rpgpp-ag-ceiling-01-3x3-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.ceiling-01-3x3-a-optimized.webp) |
| [ ] | Ceiling 01 3×3 b | floor | 3 × 0.14 × 3 | `rpgpp-ag/rpgpp-ag-ceiling-01-3x3-b` | ![](../../assets/ui/pack/icons/p_ag.ceiling-01-3x3-b.webp) |
| [ ] | Ceiling 02 1½x3 a | floor | 1.5 × 0.14 × 3 | `rpgpp-ag/rpgpp-ag-ceiling-02-1-5x3-a` | ![](../../assets/ui/pack/icons/p_ag.ceiling-02-1-5x3-a.webp) |
| [ ] | Ceiling 02 1½x3 b | floor | 3 × 0.14 × 1.5 | `rpgpp-ag/rpgpp-ag-ceiling-02-1-5x3-b` | ![](../../assets/ui/pack/icons/p_ag.ceiling-02-1-5x3-b.webp) |
| [ ] | Ceiling 02 1½x3 c | floor | 1.5 × 0.14 × 1.5 | `rpgpp-ag/rpgpp-ag-ceiling-02-1-5x3-c` | ![](../../assets/ui/pack/icons/p_ag.ceiling-02-1-5x3-c.webp) |
| [ ] | Ceiling 02 3×3 a | floor | 3 × 0.14 × 3 | `rpgpp-ag/rpgpp-ag-ceiling-02-3x3-a` | ![](../../assets/ui/pack/icons/p_ag.ceiling-02-3x3-a.webp) |
| [ ] | Ceiling 02 3×3 b | floor | 3 × 0.15 × 3 | `rpgpp-ag/rpgpp-ag-ceiling-02-3x3-b` | ![](../../assets/ui/pack/icons/p_ag.ceiling-02-3x3-b.webp) |
| [ ] | Ceiling 03 1½x3 a | floor | 1.5 × 0.14 × 3 | `rpgpp-ag/rpgpp-ag-ceiling-03-1-5x3-a` | ![](../../assets/ui/pack/icons/p_ag.ceiling-03-1-5x3-a.webp) |
| [ ] | Ceiling 03 1½x3 b | floor | 3 × 0.14 × 1.5 | `rpgpp-ag/rpgpp-ag-ceiling-03-1-5x3-b` | ![](../../assets/ui/pack/icons/p_ag.ceiling-03-1-5x3-b.webp) |
| [ ] | Ceiling 03 1½x3 c | floor | 1.5 × 0.14 × 1.5 | `rpgpp-ag/rpgpp-ag-ceiling-03-1-5x3-c` | ![](../../assets/ui/pack/icons/p_ag.ceiling-03-1-5x3-c.webp) |
| [ ] | Ceiling 03 3×3 a | floor | 3 × 0.14 × 3 | `rpgpp-ag/rpgpp-ag-ceiling-03-3x3-a` | ![](../../assets/ui/pack/icons/p_ag.ceiling-03-3x3-a.webp) |
| [ ] | Ceiling 03 3×3 a (light) | floor | 3 × 0.14 × 3 | `rpgpp-ag/rpgpp-ag-ceiling-03-3x3-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.ceiling-03-3x3-a-optimized.webp) |
| [ ] | Ceiling 04 1½x3 a | floor | 1.5 × 0.14 × 3 | `rpgpp-ag/rpgpp-ag-ceiling-04-1-5x3-a` | ![](../../assets/ui/pack/icons/p_ag.ceiling-04-1-5x3-a.webp) |
| [ ] | Ceiling 04 1½x3 b | floor | 3 × 0.14 × 1.5 | `rpgpp-ag/rpgpp-ag-ceiling-04-1-5x3-b` | ![](../../assets/ui/pack/icons/p_ag.ceiling-04-1-5x3-b.webp) |
| [ ] | Ceiling 04 1½x3 c | floor | 1.5 × 0.14 × 1.5 | `rpgpp-ag/rpgpp-ag-ceiling-04-1-5x3-c` | ![](../../assets/ui/pack/icons/p_ag.ceiling-04-1-5x3-c.webp) |
| [ ] | Ceiling 04 3×3 a | floor | 3 × 0.14 × 3 | `rpgpp-ag/rpgpp-ag-ceiling-04-3x3-a` | ![](../../assets/ui/pack/icons/p_ag.ceiling-04-3x3-a.webp) |
| [ ] | Ceiling 04 3×3 a (light) | floor | 3 × 0.14 × 3 | `rpgpp-ag/rpgpp-ag-ceiling-04-3x3-a-optimized` | ![](../../assets/ui/pack/icons/p_ag.ceiling-04-3x3-a-optimized.webp) |
| [ ] | Floor 01 1½x3 a | floor | 1.5 × 0.06 × 3 | `rpgpp-ag/rpgpp-ag-floor-01-1-5x3-a` | ![](../../assets/ui/pack/icons/p_ag.floor-01-1-5x3-a.webp) |
| [ ] | Floor 01 1½x3 b | floor | 3 × 0.06 × 1.5 | `rpgpp-ag/rpgpp-ag-floor-01-1-5x3-b` | ![](../../assets/ui/pack/icons/p_ag.floor-01-1-5x3-b.webp) |
| [ ] | Floor 01 1½x3 c | floor | 1.5 × 0.06 × 1.5 | `rpgpp-ag/rpgpp-ag-floor-01-1-5x3-c` | ![](../../assets/ui/pack/icons/p_ag.floor-01-1-5x3-c.webp) |
| [ ] | Floor 01a 3×3 | floor | 3 × 0.06 × 3 | `rpgpp-ag/rpgpp-ag-floor-01a-3x3` | ![](../../assets/ui/pack/icons/p_ag.floor-01a-3x3.webp) |
| [ ] | Floor 01a 3×3 (light) | floor | 3 × 0.04 × 3 | `rpgpp-ag/rpgpp-ag-floor-01a-3x3-optimized` | ![](../../assets/ui/pack/icons/p_ag.floor-01a-3x3-optimized.webp) |
| [ ] | Floor 01b 3×3 | floor | 3 × 0.06 × 3 | `rpgpp-ag/rpgpp-ag-floor-01b-3x3` | ![](../../assets/ui/pack/icons/p_ag.floor-01b-3x3.webp) |
| [ ] | Floor 02 1½x3 a | floor | 1.5 × 0.06 × 3 | `rpgpp-ag/rpgpp-ag-floor-02-1-5x3-a` | ![](../../assets/ui/pack/icons/p_ag.floor-02-1-5x3-a.webp) |
| [ ] | Floor 02 1½x3 b | floor | 3 × 0.06 × 1.5 | `rpgpp-ag/rpgpp-ag-floor-02-1-5x3-b` | ![](../../assets/ui/pack/icons/p_ag.floor-02-1-5x3-b.webp) |
| [ ] | Floor 02 1½x3 c | floor | 1.5 × 0.06 × 1.5 | `rpgpp-ag/rpgpp-ag-floor-02-1-5x3-c` | ![](../../assets/ui/pack/icons/p_ag.floor-02-1-5x3-c.webp) |
| [ ] | Floor 02a 3×3 | floor | 3 × 0.06 × 3 | `rpgpp-ag/rpgpp-ag-floor-02a-3x3` | ![](../../assets/ui/pack/icons/p_ag.floor-02a-3x3.webp) |
| [ ] | Floor 02b 3×3 | floor | 3 × 0.06 × 3 | `rpgpp-ag/rpgpp-ag-floor-02b-3x3` | ![](../../assets/ui/pack/icons/p_ag.floor-02b-3x3.webp) |
| [ ] | Floor 03 1½x3 a | floor | 1.5 × 0.05 × 3 | `rpgpp-ag/rpgpp-ag-floor-03-1-5x3-a` | ![](../../assets/ui/pack/icons/p_ag.floor-03-1-5x3-a.webp) |
| [ ] | Floor 03 1½x3 b | floor | 3 × 0.05 × 1.5 | `rpgpp-ag/rpgpp-ag-floor-03-1-5x3-b` | ![](../../assets/ui/pack/icons/p_ag.floor-03-1-5x3-b.webp) |
| [ ] | Floor 03 1½x3 c | floor | 1.5 × 0.05 × 1.5 | `rpgpp-ag/rpgpp-ag-floor-03-1-5x3-c` | ![](../../assets/ui/pack/icons/p_ag.floor-03-1-5x3-c.webp) |
| [ ] | Floor 03a 3×3 | floor | 3 × 0.05 × 3 | `rpgpp-ag/rpgpp-ag-floor-03a-3x3` | ![](../../assets/ui/pack/icons/p_ag.floor-03a-3x3.webp) |
| [ ] | Floor 03a 3×3 (light) | floor | 3 × 0.04 × 3 | `rpgpp-ag/rpgpp-ag-floor-03a-3x3-optimized` | ![](../../assets/ui/pack/icons/p_ag.floor-03a-3x3-optimized.webp) |
| [ ] | Floor 03a 3×3 ext 01 left | floor | 3 × 0.25 × 3 | `rpgpp-ag/rpgpp-ag-floor-03a-3x3-ext-01-left` | ![](../../assets/ui/pack/icons/p_ag.floor-03a-3x3-ext-01-left.webp) |
| [ ] | Floor 03a 3×3 ext 01 middle | floor | 3 × 0.25 × 3 | `rpgpp-ag/rpgpp-ag-floor-03a-3x3-ext-01-middle` | ![](../../assets/ui/pack/icons/p_ag.floor-03a-3x3-ext-01-middle.webp) |
| [ ] | Floor 03a 3×3 ext 01 right | floor | 3 × 0.25 × 3 | `rpgpp-ag/rpgpp-ag-floor-03a-3x3-ext-01-right` | ![](../../assets/ui/pack/icons/p_ag.floor-03a-3x3-ext-01-right.webp) |
| [ ] | Floor 03a 3×3 ext 02 left | floor | 3 × 0.25 × 3 | `rpgpp-ag/rpgpp-ag-floor-03a-3x3-ext-02-left` | ![](../../assets/ui/pack/icons/p_ag.floor-03a-3x3-ext-02-left.webp) |
| [ ] | Floor 03a 3×3 ext 02 right | floor | 3 × 0.25 × 3 | `rpgpp-ag/rpgpp-ag-floor-03a-3x3-ext-02-right` | ![](../../assets/ui/pack/icons/p_ag.floor-03a-3x3-ext-02-right.webp) |
| [ ] | Floor 04 1½x3 a | floor | 1.5 × 0.05 × 3 | `rpgpp-ag/rpgpp-ag-floor-04-1-5x3-a` | ![](../../assets/ui/pack/icons/p_ag.floor-04-1-5x3-a.webp) |
| [ ] | Floor 04 1½x3 b | floor | 3 × 0.05 × 1.5 | `rpgpp-ag/rpgpp-ag-floor-04-1-5x3-b` | ![](../../assets/ui/pack/icons/p_ag.floor-04-1-5x3-b.webp) |
| [ ] | Floor 04 1½x3 c | floor | 1.5 × 0.05 × 1.5 | `rpgpp-ag/rpgpp-ag-floor-04-1-5x3-c` | ![](../../assets/ui/pack/icons/p_ag.floor-04-1-5x3-c.webp) |
| [ ] | Floor 04a 3×3 | floor | 3 × 0.05 × 3 | `rpgpp-ag/rpgpp-ag-floor-04a-3x3` | ![](../../assets/ui/pack/icons/p_ag.floor-04a-3x3.webp) |
| [ ] | Floor 04a 3×3 (light) | floor | 3 × 0.04 × 3 | `rpgpp-ag/rpgpp-ag-floor-04a-3x3-optimized` | ![](../../assets/ui/pack/icons/p_ag.floor-04a-3x3-optimized.webp) |
| [ ] | Gate balcony 01a | deck | 5 × 1.72 × 3 | `rpgpp-ag/rpgpp-ag-gate-balcony-01a` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-01a.webp) |
| [ ] | Gate balcony 01b | deck | 5 × 1.72 × 3 | `rpgpp-ag/rpgpp-ag-gate-balcony-01b` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-01b.webp) |
| [ ] | Gate balcony 02a | deck | 5 × 3.46 × 3 | `rpgpp-ag/rpgpp-ag-gate-balcony-02a` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-02a.webp) |
| [ ] | Gate balcony 02b | deck | 5 × 3.46 × 3 | `rpgpp-ag/rpgpp-ag-gate-balcony-02b` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-02b.webp) |
| [ ] | Gate balcony 03 platform 01a | deck | 5 × 3.22 × 5 | `rpgpp-ag/rpgpp-ag-gate-balcony-03-platform-01a` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-03-platform-01a.webp) |
| [ ] | Gate balcony 03 platform 01b | deck | 5 × 3.22 × 5 | `rpgpp-ag/rpgpp-ag-gate-balcony-03-platform-01b` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-03-platform-01b.webp) |
| [ ] | Gate balcony 03 platform 02a | deck | 5 × 1.72 × 5 | `rpgpp-ag/rpgpp-ag-gate-balcony-03-platform-02a` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-03-platform-02a.webp) |
| [ ] | Gate balcony 03 platform 02b | deck | 5 × 1.72 × 5 | `rpgpp-ag/rpgpp-ag-gate-balcony-03-platform-02b` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-03-platform-02b.webp) |
| [ ] | Stockpile 01 | deck | 5 × 1.09 × 4.5 | `rpgpp-ag/rpgpp-ag-stockpile-01` | ![](../../assets/ui/pack/icons/p_ag.stockpile-01.webp) |
| [ ] | Stockpile 02 platform 01a | deck | 5 × 2.42 × 5 | `rpgpp-ag/rpgpp-ag-stockpile-02-platform-01a` | ![](../../assets/ui/pack/icons/p_ag.stockpile-02-platform-01a.webp) |
| [ ] | Stockpile 02 platform 01b | deck | 5 × 2.42 × 5 | `rpgpp-ag/rpgpp-ag-stockpile-02-platform-01b` | ![](../../assets/ui/pack/icons/p_ag.stockpile-02-platform-01b.webp) |
| [ ] | Stockpile 02 platform 02a | deck | 5 × 3.92 × 5 | `rpgpp-ag/rpgpp-ag-stockpile-02-platform-02a` | ![](../../assets/ui/pack/icons/p_ag.stockpile-02-platform-02a.webp) |
| [ ] | Stockpile 02 platform 02b | deck | 5 × 3.92 × 5 | `rpgpp-ag/rpgpp-ag-stockpile-02-platform-02b` | ![](../../assets/ui/pack/icons/p_ag.stockpile-02-platform-02b.webp) |
| [ ] | Tower 01 platform 01a | deck | 5 × 1.72 × 5 | `rpgpp-ag/rpgpp-ag-tower-01-platform-01a` | ![](../../assets/ui/pack/icons/p_ag.tower-01-platform-01a.webp) |
| [ ] | Tower 01 platform 01b | deck | 5 × 1.72 × 5 | `rpgpp-ag/rpgpp-ag-tower-01-platform-01b` | ![](../../assets/ui/pack/icons/p_ag.tower-01-platform-01b.webp) |
| [ ] | Tower 01 platform 01c | deck | 5 × 1.72 × 5 | `rpgpp-ag/rpgpp-ag-tower-01-platform-01c` | ![](../../assets/ui/pack/icons/p_ag.tower-01-platform-01c.webp) |
| [ ] | Tower 01 platform 01d | deck | 5 × 1.72 × 5 | `rpgpp-ag/rpgpp-ag-tower-01-platform-01d` | ![](../../assets/ui/pack/icons/p_ag.tower-01-platform-01d.webp) |
| [ ] | Tower 01 platform 02a | deck | 5 × 3.52 × 5 | `rpgpp-ag/rpgpp-ag-tower-01-platform-02a` | ![](../../assets/ui/pack/icons/p_ag.tower-01-platform-02a.webp) |
| [ ] | Tower 01 platform 02b | deck | 5 × 3.52 × 5 | `rpgpp-ag/rpgpp-ag-tower-01-platform-02b` | ![](../../assets/ui/pack/icons/p_ag.tower-01-platform-02b.webp) |
| [ ] | Tower 01 platform 02c | deck | 5 × 3.52 × 5 | `rpgpp-ag/rpgpp-ag-tower-01-platform-02c` | ![](../../assets/ui/pack/icons/p_ag.tower-01-platform-02c.webp) |
| [ ] | Tower 01 platform 02d | deck | 5 × 3.52 × 5 | `rpgpp-ag/rpgpp-ag-tower-01-platform-02d` | ![](../../assets/ui/pack/icons/p_ag.tower-01-platform-02d.webp) |
| [ ] | Wall platform 01a 4m | floor | 4 × 0.16 × 2.5 | `rpgpp-ag/rpgpp-ag-wall-platform-01a-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-01a-4m.webp) |
| [ ] | Wall platform 01b 4m | floor | 4 × 0.19 × 2.5 | `rpgpp-ag/rpgpp-ag-wall-platform-01b-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-01b-4m.webp) |
| [ ] | Wall platform 01c 4m | floor | 4 × 0.27 × 2.5 | `rpgpp-ag/rpgpp-ag-wall-platform-01c-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-01c-4m.webp) |
| [ ] | Wall platform 01d 4m | floor | 4 × 0.16 × 2.5 | `rpgpp-ag/rpgpp-ag-wall-platform-01d-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-01d-4m.webp) |
| [ ] | Wall platform 01e 4m | floor | 4 × 0.16 × 2 | `rpgpp-ag/rpgpp-ag-wall-platform-01e-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-01e-4m.webp) |
| [ ] | Wall platform 01f 4m | floor | 4 × 0.29 × 2.5 | `rpgpp-ag/rpgpp-ag-wall-platform-01f-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-01f-4m.webp) |
| [ ] | Wall platform 02 corner | floor | 6.5 × 0.42 × 6 | `rpgpp-ag/rpgpp-ag-wall-platform-02-corner` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-02-corner.webp) |
| [ ] | Wall platform 02a | floor | 4 × 0.42 × 2.5 | `rpgpp-ag/rpgpp-ag-wall-platform-02a` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-02a.webp) |
| [ ] | Wall platform 02b | floor | 4 × 0.42 × 2.5 | `rpgpp-ag/rpgpp-ag-wall-platform-02b` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-02b.webp) |
| [ ] | Wall platform 03a | floor | 2.5 × 0.16 × 2.5 | `rpgpp-ag/rpgpp-ag-wall-platform-03a` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-03a.webp) |
| [ ] | Wall platform 03b | floor | 2.5 × 0.27 × 3 | `rpgpp-ag/rpgpp-ag-wall-platform-03b` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-03b.webp) |
| [ ] | Wall platform 03c | floor | 2.5 × 0.19 × 2.5 | `rpgpp-ag/rpgpp-ag-wall-platform-03c` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-03c.webp) |

### RPGPP · Roofs (150)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Awning 01a | trim (on any face) | 2.74 × 2.82 × 2.34 | `rpgpp-ag/rpgpp-ag-awning-01a` | ![](../../assets/ui/pack/icons/p_ag.awning-01a.webp) |
| [ ] | Awning 01b | trim (on any face) | 2.66 × 3.07 × 2.26 | `rpgpp-ag/rpgpp-ag-awning-01b` | ![](../../assets/ui/pack/icons/p_ag.awning-01b.webp) |
| [ ] | Awning standing 01a | on posts | 3.5 × 4.03 × 3.5 | `rpgpp-ag/rpgpp-ag-awning-standing-01a` | ![](../../assets/ui/pack/icons/p_ag.awning-standing-01a.webp) |
| [ ] | Awning standing 01b | on posts | 3.5 × 4.03 × 3.5 | `rpgpp-ag/rpgpp-ag-awning-standing-01b` | ![](../../assets/ui/pack/icons/p_ag.awning-standing-01b.webp) |
| [ ] | Awning standing 01c | on posts | 3.5 × 4.03 × 3.5 | `rpgpp-ag/rpgpp-ag-awning-standing-01c` | ![](../../assets/ui/pack/icons/p_ag.awning-standing-01c.webp) |
| [ ] | Balcony 01 4m a roof a | trim (on any face) | 5.02 × 4.42 × 2.96 | `rpgpp-ag/rpgpp-ag-balcony-01-4m-a-roof-a` | ![](../../assets/ui/pack/icons/p_ag.balcony-01-4m-a-roof-a.webp) |
| [ ] | Balcony 01 4m a roof b | trim (on any face) | 4.8 × 4.73 × 3.02 | `rpgpp-ag/rpgpp-ag-balcony-01-4m-a-roof-b` | ![](../../assets/ui/pack/icons/p_ag.balcony-01-4m-a-roof-b.webp) |
| [ ] | Balcony 01 4m b roof a | trim (on any face) | 5.02 × 4.42 × 2.96 | `rpgpp-ag/rpgpp-ag-balcony-01-4m-b-roof-a` | ![](../../assets/ui/pack/icons/p_ag.balcony-01-4m-b-roof-a.webp) |
| [ ] | Balcony 01 4m b roof b | trim (on any face) | 4.8 × 4.73 × 3.02 | `rpgpp-ag/rpgpp-ag-balcony-01-4m-b-roof-b` | ![](../../assets/ui/pack/icons/p_ag.balcony-01-4m-b-roof-b.webp) |
| [ ] | Balcony 01 6m a roof a | trim (on any face) | 6.14 × 4.43 × 2.94 | `rpgpp-ag/rpgpp-ag-balcony-01-6m-a-roof-a` | ![](../../assets/ui/pack/icons/p_ag.balcony-01-6m-a-roof-a.webp) |
| [ ] | Balcony 01 6m a roof b | trim (on any face) | 6.14 × 4.73 × 3.02 | `rpgpp-ag/rpgpp-ag-balcony-01-6m-a-roof-b` | ![](../../assets/ui/pack/icons/p_ag.balcony-01-6m-a-roof-b.webp) |
| [ ] | Balcony 01 6m b roof a | trim (on any face) | 6.14 × 4.43 × 2.94 | `rpgpp-ag/rpgpp-ag-balcony-01-6m-b-roof-a` | ![](../../assets/ui/pack/icons/p_ag.balcony-01-6m-b-roof-a.webp) |
| [ ] | Balcony 01 6m b roof b | trim (on any face) | 6.14 × 4.73 × 3.02 | `rpgpp-ag/rpgpp-ag-balcony-01-6m-b-roof-b` | ![](../../assets/ui/pack/icons/p_ag.balcony-01-6m-b-roof-b.webp) |
| [ ] | Chimney 01a | block | 2 × 3.11 × 2 | `rpgpp-ag/rpgpp-ag-chimney-01a` | ![](../../assets/ui/pack/icons/p_ag.chimney-01a.webp) |
| [ ] | Chimney 01b | block | 2 × 5.01 × 2 | `rpgpp-ag/rpgpp-ag-chimney-01b` | ![](../../assets/ui/pack/icons/p_ag.chimney-01b.webp) |
| [ ] | Chimney 02a | block | 2 × 3.12 × 2 | `rpgpp-ag/rpgpp-ag-chimney-02a` | ![](../../assets/ui/pack/icons/p_ag.chimney-02a.webp) |
| [ ] | Chimney 02b | block | 2 × 5.01 × 2 | `rpgpp-ag/rpgpp-ag-chimney-02b` | ![](../../assets/ui/pack/icons/p_ag.chimney-02b.webp) |
| [ ] | Chimney 03a | block | 2 × 3.12 × 2 | `rpgpp-ag/rpgpp-ag-chimney-03a` | ![](../../assets/ui/pack/icons/p_ag.chimney-03a.webp) |
| [ ] | Chimney 03b | block | 2 × 5.01 × 2 | `rpgpp-ag/rpgpp-ag-chimney-03b` | ![](../../assets/ui/pack/icons/p_ag.chimney-03b.webp) |
| [ ] | Gate balcony 02 roof 01 | trim (on any face) | 5.02 × 1.54 × 3.18 | `rpgpp-ag/rpgpp-ag-gate-balcony-02-roof-01` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-02-roof-01.webp) |
| [ ] | Gate balcony 02 roof 02 | trim (on any face) | 4.82 × 1.8 × 3.2 | `rpgpp-ag/rpgpp-ag-gate-balcony-02-roof-02` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-02-roof-02.webp) |
| [ ] | Gate balcony 03 roof 01a | trim (on any face) | 6.16 × 3.4 × 5.26 | `rpgpp-ag/rpgpp-ag-gate-balcony-03-roof-01a` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-03-roof-01a.webp) |
| [ ] | Gate balcony 03 roof 01b | trim (on any face) | 6.3 × 3.28 × 5.26 | `rpgpp-ag/rpgpp-ag-gate-balcony-03-roof-01b` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-03-roof-01b.webp) |
| [ ] | Gate balcony 03 roof 02a | trim (on any face) | 6 × 2.82 × 6.02 | `rpgpp-ag/rpgpp-ag-gate-balcony-03-roof-02a` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-03-roof-02a.webp) |
| [ ] | Gate balcony 03 roof 02b | trim (on any face) | 6.06 × 3.37 × 6.04 | `rpgpp-ag/rpgpp-ag-gate-balcony-03-roof-02b` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-03-roof-02b.webp) |
| [ ] | Roof 01 6×3×3 chimney 01 | ridge (both slopes) | 3 × 3.75 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-01-6x3x3-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x3x3-chimney-01.webp) |
| [ ] | Roof 01 6×3×3 corner 01 | trim (on any face) | 6.66 × 4.49 × 6.66 | `rpgpp-ag/rpgpp-ag-roof-01-6x3x3-corner-01` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x3x3-corner-01.webp) |
| [ ] | Roof 01 6×3×3 corner 01 chimney 01 | trim (on any face) | 6.66 × 4.49 × 6.66 | `rpgpp-ag/rpgpp-ag-roof-01-6x3x3-corner-01-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x3x3-corner-01-chimney-01.webp) |
| [ ] | Roof 01 6×3×3 corner 02 | trim (on any face) | 4.36 × 3.96 × 4.3 | `rpgpp-ag/rpgpp-ag-roof-01-6x3x3-corner-02` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x3x3-corner-02.webp) |
| [ ] | Roof 01 6×3×3 end 01a | gable cap | 6.9 × 3.75 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-01-6x3x3-end-01a` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x3x3-end-01a.webp) |
| [ ] | Roof 01 6×3×3 end 01a half | gable cap | 3.9 × 3.75 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-01-6x3x3-end-01a-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x3x3-end-01a-half.webp) |
| [ ] | Roof 01 6×3×3 end 01b | gable cap | 6.9 × 3.75 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-01-6x3x3-end-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x3x3-end-01b.webp) |
| [ ] | Roof 01 6×3×3 end 01b half | gable cap | 3.9 × 3.75 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-01-6x3x3-end-01b-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x3x3-end-01b-half.webp) |
| [ ] | Roof 01 6×3×3 end 02 | trim (on any face) | 8.6 × 3.96 × 4.36 | `rpgpp-ag/rpgpp-ag-roof-01-6x3x3-end-02` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x3x3-end-02.webp) |
| [ ] | Roof 01 6×3×3 end 03 | trim (on any face) | 8.5 × 4.38 × 5.4 | `rpgpp-ag/rpgpp-ag-roof-01-6x3x3-end-03` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x3x3-end-03.webp) |
| [ ] | Roof 01 6×3×3 half chimney 01 | roof panel | 3 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01-6x3x3-half-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x3x3-half-chimney-01.webp) |
| [ ] | Roof 01 6×5×3 chimney 01 | ridge (both slopes) | 3 × 6.05 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-01-6x5x3-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x5x3-chimney-01.webp) |
| [ ] | Roof 01 6×5×3 corner 01 | trim (on any face) | 6.56 × 6.46 × 6.56 | `rpgpp-ag/rpgpp-ag-roof-01-6x5x3-corner-01` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x5x3-corner-01.webp) |
| [ ] | Roof 01 6×5×3 corner 01 chimney 01 | trim (on any face) | 6.56 × 6.46 × 6.56 | `rpgpp-ag/rpgpp-ag-roof-01-6x5x3-corner-01-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x5x3-corner-01-chimney-01.webp) |
| [ ] | Roof 01 6×5×3 corner 02 | trim (on any face) | 4.06 × 5.84 × 4.08 | `rpgpp-ag/rpgpp-ag-roof-01-6x5x3-corner-02` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x5x3-corner-02.webp) |
| [ ] | Roof 01 6×5×3 end 01a | gable cap | 6.9 × 6.05 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-01-6x5x3-end-01a` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x5x3-end-01a.webp) |
| [ ] | Roof 01 6×5×3 end 01a half | gable cap | 3.9 × 6.05 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-01-6x5x3-end-01a-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x5x3-end-01a-half.webp) |
| [ ] | Roof 01 6×5×3 end 01b | gable cap | 6.9 × 6.05 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-01-6x5x3-end-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x5x3-end-01b.webp) |
| [ ] | Roof 01 6×5×3 end 01b half | gable cap | 3.9 × 6.05 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-01-6x5x3-end-01b-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x5x3-end-01b-half.webp) |
| [ ] | Roof 01 6×5×3 end 02 | trim (on any face) | 8.1 × 5.84 × 4.12 | `rpgpp-ag/rpgpp-ag-roof-01-6x5x3-end-02` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x5x3-end-02.webp) |
| [ ] | Roof 01 6×5×3 end 03 | trim (on any face) | 8.1 × 6.01 × 4.98 | `rpgpp-ag/rpgpp-ag-roof-01-6x5x3-end-03` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x5x3-end-03.webp) |
| [ ] | Roof 01 6×5×3 half chimney 01 | roof panel | 3 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01-6x5x3-half-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-01-6x5x3-half-chimney-01.webp) |
| [ ] | Roof 01 9×4×3 chimney 01 | ridge (both slopes) | 3 × 4.7 × 9.9 | `rpgpp-ag/rpgpp-ag-roof-01-9x4x3-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-01-9x4x3-chimney-01.webp) |
| [ ] | Roof 01 9×4×3 corner 01 | trim (on any face) | 8.16 × 5.52 × 8.16 | `rpgpp-ag/rpgpp-ag-roof-01-9x4x3-corner-01` | ![](../../assets/ui/pack/icons/p_ag.roof-01-9x4x3-corner-01.webp) |
| [ ] | Roof 01 9×4×3 corner 01 chimney 01 | trim (on any face) | 8.16 × 5.53 × 8.16 | `rpgpp-ag/rpgpp-ag-roof-01-9x4x3-corner-01-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-01-9x4x3-corner-01-chimney-01.webp) |
| [ ] | Roof 01 9×4×3 corner 02 | trim (on any face) | 7.02 × 5.52 × 7.12 | `rpgpp-ag/rpgpp-ag-roof-01-9x4x3-corner-02` | ![](../../assets/ui/pack/icons/p_ag.roof-01-9x4x3-corner-02.webp) |
| [ ] | Roof 01 9×4×3 end 01a | gable cap | 9.9 × 4.7 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-01-9x4x3-end-01a` | ![](../../assets/ui/pack/icons/p_ag.roof-01-9x4x3-end-01a.webp) |
| [ ] | Roof 01 9×4×3 end 01a half | gable cap | 5.4 × 4.7 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-01-9x4x3-end-01a-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01-9x4x3-end-01a-half.webp) |
| [ ] | Roof 01 9×4×3 end 01b | gable cap | 9.9 × 4.7 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-01-9x4x3-end-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-01-9x4x3-end-01b.webp) |
| [ ] | Roof 01 9×4×3 end 01b half | gable cap | 5.4 × 4.7 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-01-9x4x3-end-01b-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01-9x4x3-end-01b-half.webp) |
| [ ] | Roof 01 9×4×3 end 02 | trim (on any face) | 11.14 × 5.52 × 7.12 | `rpgpp-ag/rpgpp-ag-roof-01-9x4x3-end-02` | ![](../../assets/ui/pack/icons/p_ag.roof-01-9x4x3-end-02.webp) |
| [ ] | Roof 01 9×4×3 end 03 | trim (on any face) | 11.14 × 5.77 × 7.98 | `rpgpp-ag/rpgpp-ag-roof-01-9x4x3-end-03` | ![](../../assets/ui/pack/icons/p_ag.roof-01-9x4x3-end-03.webp) |
| [ ] | Roof 01 9×4×3 half chimney 01 | roof panel | 3 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-01-9x4x3-half-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-01-9x4x3-half-chimney-01.webp) |
| [ ] | Roof 01a 6×3×1½ | ridge (both slopes) | 1.5 × 3.75 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-01a-6x3x1-5` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-6x3x1-5.webp) |
| [ ] | Roof 01a 6×3×1½ half | roof panel | 1.5 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01a-6x3x1-5-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-6x3x1-5-half.webp) |
| [ ] | Roof 01a 6×3×1½ half cut | roof panel | 1.5 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01a-6x3x1-5-half-cut` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-6x3x1-5-half-cut.webp) |
| [ ] | Roof 01a 6×3×3 | ridge (both slopes) | 3 × 3.75 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-01a-6x3x3` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-6x3x3.webp) |
| [ ] | Roof 01a 6×3×3 half | roof panel | 3 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01a-6x3x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-6x3x3-half.webp) |
| [ ] | Roof 01a 6×3×3 half cut | roof panel | 3 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01a-6x3x3-half-cut` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-6x3x3-half-cut.webp) |
| [ ] | Roof 01a 6×5×1½ | ridge (both slopes) | 1.5 × 6.05 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-01a-6x5x1-5` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-6x5x1-5.webp) |
| [ ] | Roof 01a 6×5×1½ half | roof panel | 1.5 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01a-6x5x1-5-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-6x5x1-5-half.webp) |
| [ ] | Roof 01a 6×5×1½ half cut | roof panel | 1.5 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01a-6x5x1-5-half-cut` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-6x5x1-5-half-cut.webp) |
| [ ] | Roof 01a 6×5×3 | ridge (both slopes) | 3 × 6.05 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-01a-6x5x3` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-6x5x3.webp) |
| [ ] | Roof 01a 6×5×3 half | roof panel | 3 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01a-6x5x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-6x5x3-half.webp) |
| [ ] | Roof 01a 6×5×3 half cut | roof panel | 3 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01a-6x5x3-half-cut` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-6x5x3-half-cut.webp) |
| [ ] | Roof 01a 9×4×1½ | ridge (both slopes) | 1.5 × 4.7 × 9.9 | `rpgpp-ag/rpgpp-ag-roof-01a-9x4x1-5` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-9x4x1-5.webp) |
| [ ] | Roof 01a 9×4×1½ half | roof panel | 1.5 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-01a-9x4x1-5-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-9x4x1-5-half.webp) |
| [ ] | Roof 01a 9×4×1½ half cut | roof panel | 1.5 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-01a-9x4x1-5-half-cut` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-9x4x1-5-half-cut.webp) |
| [ ] | Roof 01a 9×4×3 | ridge (both slopes) | 3 × 4.7 × 9.9 | `rpgpp-ag/rpgpp-ag-roof-01a-9x4x3` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-9x4x3.webp) |
| [ ] | Roof 01a 9×4×3 half | roof panel | 3 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-01a-9x4x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-9x4x3-half.webp) |
| [ ] | Roof 01a 9×4×3 half cut | roof panel | 3 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-01a-9x4x3-half-cut` | ![](../../assets/ui/pack/icons/p_ag.roof-01a-9x4x3-half-cut.webp) |
| [ ] | Roof 01b 6×3×3 | ridge (both slopes) | 3 × 3.75 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-01b-6x3x3` | ![](../../assets/ui/pack/icons/p_ag.roof-01b-6x3x3.webp) |
| [ ] | Roof 01b 6×3×3 half | roof panel | 3 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01b-6x3x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01b-6x3x3-half.webp) |
| [ ] | Roof 01b 6×5×3 | ridge (both slopes) | 3 × 6.05 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-01b-6x5x3` | ![](../../assets/ui/pack/icons/p_ag.roof-01b-6x5x3.webp) |
| [ ] | Roof 01b 6×5×3 half | roof panel | 3 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01b-6x5x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01b-6x5x3-half.webp) |
| [ ] | Roof 01b 9×4×3 | ridge (both slopes) | 3 × 4.7 × 9.9 | `rpgpp-ag/rpgpp-ag-roof-01b-9x4x3` | ![](../../assets/ui/pack/icons/p_ag.roof-01b-9x4x3.webp) |
| [ ] | Roof 01b 9×4×3 half | roof panel | 3 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-01b-9x4x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01b-9x4x3-half.webp) |
| [ ] | Roof 01c 6×3×3 half | roof panel | 3 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01c-6x3x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01c-6x3x3-half.webp) |
| [ ] | Roof 01c 6×5×3 half | roof panel | 3 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01c-6x5x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01c-6x5x3-half.webp) |
| [ ] | Roof 01c 9×4×3 half | roof panel | 3 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-01c-9x4x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01c-9x4x3-half.webp) |
| [ ] | Roof 01d 6×3×3 half | roof panel | 3 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01d-6x3x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01d-6x3x3-half.webp) |
| [ ] | Roof 01d 6×5×3 half | roof panel | 3 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01d-6x5x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01d-6x5x3-half.webp) |
| [ ] | Roof 01d 9×4×3 half | roof panel | 3 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-01d-9x4x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01d-9x4x3-half.webp) |
| [ ] | Roof 01e 6×3×3 half | roof panel | 3 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01e-6x3x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01e-6x3x3-half.webp) |
| [ ] | Roof 01e 6×5×3 half | roof panel | 3 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-01e-6x5x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01e-6x5x3-half.webp) |
| [ ] | Roof 01e 9×4×3 half | roof panel | 3 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-01e-9x4x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-01e-9x4x3-half.webp) |
| [ ] | Roof 02 6×3×3 corner 01 | trim (on any face) | 6 × 4.16 × 6 | `rpgpp-ag/rpgpp-ag-roof-02-6x3x3-corner-01` | ![](../../assets/ui/pack/icons/p_ag.roof-02-6x3x3-corner-01.webp) |
| [ ] | Roof 02 6×3×3 corner 02 | trim (on any face) | 4.04 × 4.12 × 4 | `rpgpp-ag/rpgpp-ag-roof-02-6x3x3-corner-02` | ![](../../assets/ui/pack/icons/p_ag.roof-02-6x3x3-corner-02.webp) |
| [ ] | Roof 02 6×3×3 end 01 | gable cap | 6.9 × 3.75 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-02-6x3x3-end-01` | ![](../../assets/ui/pack/icons/p_ag.roof-02-6x3x3-end-01.webp) |
| [ ] | Roof 02 6×3×3 end 01 half | gable cap | 3.9 × 3.75 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-02-6x3x3-end-01-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02-6x3x3-end-01-half.webp) |
| [ ] | Roof 02 6×3×3 end 02 | trim (on any face) | 8.1 × 4.12 × 4.04 | `rpgpp-ag/rpgpp-ag-roof-02-6x3x3-end-02` | ![](../../assets/ui/pack/icons/p_ag.roof-02-6x3x3-end-02.webp) |
| [ ] | Roof 02 6×3×3 end 03 | trim (on any face) | 8.1 × 4.12 × 3.9 | `rpgpp-ag/rpgpp-ag-roof-02-6x3x3-end-03` | ![](../../assets/ui/pack/icons/p_ag.roof-02-6x3x3-end-03.webp) |
| [ ] | Roof 02 6×3×3 end 04 | ridge (both slopes) | 3 × 3.75 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-02-6x3x3-end-04` | ![](../../assets/ui/pack/icons/p_ag.roof-02-6x3x3-end-04.webp) |
| [ ] | Roof 02 6×5×3 corner 01 | trim (on any face) | 6 × 6.2 × 6 | `rpgpp-ag/rpgpp-ag-roof-02-6x5x3-corner-01` | ![](../../assets/ui/pack/icons/p_ag.roof-02-6x5x3-corner-01.webp) |
| [ ] | Roof 02 6×5×3 corner 02 | trim (on any face) | 4.02 × 6.17 × 4.02 | `rpgpp-ag/rpgpp-ag-roof-02-6x5x3-corner-02` | ![](../../assets/ui/pack/icons/p_ag.roof-02-6x5x3-corner-02.webp) |
| [ ] | Roof 02 6×5×3 end 01 | gable cap | 6.9 × 6.05 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-02-6x5x3-end-01` | ![](../../assets/ui/pack/icons/p_ag.roof-02-6x5x3-end-01.webp) |
| [ ] | Roof 02 6×5×3 end 01 half | gable cap | 3.9 × 6.05 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-02-6x5x3-end-01-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02-6x5x3-end-01-half.webp) |
| [ ] | Roof 02 6×5×3 end 02 | trim (on any face) | 8.04 × 6.17 × 4.02 | `rpgpp-ag/rpgpp-ag-roof-02-6x5x3-end-02` | ![](../../assets/ui/pack/icons/p_ag.roof-02-6x5x3-end-02.webp) |
| [ ] | Roof 02 6×5×3 end 03 | trim (on any face) | 8.04 × 6.17 × 3.9 | `rpgpp-ag/rpgpp-ag-roof-02-6x5x3-end-03` | ![](../../assets/ui/pack/icons/p_ag.roof-02-6x5x3-end-03.webp) |
| [ ] | Roof 02 6×5×3 end 04 | ridge (both slopes) | 3 × 6.05 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-02-6x5x3-end-04` | ![](../../assets/ui/pack/icons/p_ag.roof-02-6x5x3-end-04.webp) |
| [ ] | Roof 02 9×4×3 corner 01 | trim (on any face) | 7.5 × 5.27 × 7.5 | `rpgpp-ag/rpgpp-ag-roof-02-9x4x3-corner-01` | ![](../../assets/ui/pack/icons/p_ag.roof-02-9x4x3-corner-01.webp) |
| [ ] | Roof 02 9×4×3 corner 02 | trim (on any face) | 7.04 × 5.27 × 7 | `rpgpp-ag/rpgpp-ag-roof-02-9x4x3-corner-02` | ![](../../assets/ui/pack/icons/p_ag.roof-02-9x4x3-corner-02.webp) |
| [ ] | Roof 02 9×4×3 end 01 | gable cap | 9.9 × 4.7 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-02-9x4x3-end-01` | ![](../../assets/ui/pack/icons/p_ag.roof-02-9x4x3-end-01.webp) |
| [ ] | Roof 02 9×4×3 end 01 half | gable cap | 5.4 × 4.7 × 0.8 | `rpgpp-ag/rpgpp-ag-roof-02-9x4x3-end-01-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02-9x4x3-end-01-half.webp) |
| [ ] | Roof 02 9×4×3 end 02 | trim (on any face) | 11.04 × 5.27 × 7.04 | `rpgpp-ag/rpgpp-ag-roof-02-9x4x3-end-02` | ![](../../assets/ui/pack/icons/p_ag.roof-02-9x4x3-end-02.webp) |
| [ ] | Roof 02 9×4×3 end 03 | trim (on any face) | 11.08 × 5.27 × 7 | `rpgpp-ag/rpgpp-ag-roof-02-9x4x3-end-03` | ![](../../assets/ui/pack/icons/p_ag.roof-02-9x4x3-end-03.webp) |
| [ ] | Roof 02 9×4×3 end 04 | ridge (both slopes) | 3 × 4.7 × 9.9 | `rpgpp-ag/rpgpp-ag-roof-02-9x4x3-end-04` | ![](../../assets/ui/pack/icons/p_ag.roof-02-9x4x3-end-04.webp) |
| [ ] | Roof 02a 6×3×1½ | ridge (both slopes) | 1.5 × 3.75 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-02a-6x3x1-5` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-6x3x1-5.webp) |
| [ ] | Roof 02a 6×3×1½ half | roof panel | 1.5 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-02a-6x3x1-5-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-6x3x1-5-half.webp) |
| [ ] | Roof 02a 6×3×1½ half cut | roof panel | 1.5 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-02a-6x3x1-5-half-cut` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-6x3x1-5-half-cut.webp) |
| [ ] | Roof 02a 6×3×3 | ridge (both slopes) | 3 × 3.75 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-02a-6x3x3` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-6x3x3.webp) |
| [ ] | Roof 02a 6×3×3 half | roof panel | 3 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-02a-6x3x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-6x3x3-half.webp) |
| [ ] | Roof 02a 6×3×3 half cut | roof panel | 3 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-02a-6x3x3-half-cut` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-6x3x3-half-cut.webp) |
| [ ] | Roof 02a 6×5×1½ | ridge (both slopes) | 1.5 × 6.05 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-02a-6x5x1-5` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-6x5x1-5.webp) |
| [ ] | Roof 02a 6×5×1½ half | roof panel | 1.5 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-02a-6x5x1-5-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-6x5x1-5-half.webp) |
| [ ] | Roof 02a 6×5×1½ half cut | roof panel | 1.5 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-02a-6x5x1-5-half-cut` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-6x5x1-5-half-cut.webp) |
| [ ] | Roof 02a 6×5×3 | ridge (both slopes) | 3 × 6.05 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-02a-6x5x3` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-6x5x3.webp) |
| [ ] | Roof 02a 6×5×3 half | roof panel | 3 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-02a-6x5x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-6x5x3-half.webp) |
| [ ] | Roof 02a 6×5×3 half cut | roof panel | 3 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-02a-6x5x3-half-cut` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-6x5x3-half-cut.webp) |
| [ ] | Roof 02a 9×4×1½ | ridge (both slopes) | 1.5 × 4.7 × 9.9 | `rpgpp-ag/rpgpp-ag-roof-02a-9x4x1-5` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-9x4x1-5.webp) |
| [ ] | Roof 02a 9×4×1½ half | roof panel | 1.5 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-02a-9x4x1-5-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-9x4x1-5-half.webp) |
| [ ] | Roof 02a 9×4×1½ half cut | roof panel | 1.5 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-02a-9x4x1-5-half-cut` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-9x4x1-5-half-cut.webp) |
| [ ] | Roof 02a 9×4×3 | ridge (both slopes) | 3 × 4.7 × 9.9 | `rpgpp-ag/rpgpp-ag-roof-02a-9x4x3` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-9x4x3.webp) |
| [ ] | Roof 02a 9×4×3 half | roof panel | 3 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-02a-9x4x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-9x4x3-half.webp) |
| [ ] | Roof 02a 9×4×3 half cut | roof panel | 3 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-02a-9x4x3-half-cut` | ![](../../assets/ui/pack/icons/p_ag.roof-02a-9x4x3-half-cut.webp) |
| [ ] | Roof 02b 6×3×3 | ridge (both slopes) | 3 × 3.75 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-02b-6x3x3` | ![](../../assets/ui/pack/icons/p_ag.roof-02b-6x3x3.webp) |
| [ ] | Roof 02b 6×3×3 half | roof panel | 3 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-02b-6x3x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02b-6x3x3-half.webp) |
| [ ] | Roof 02b 6×5×3 | ridge (both slopes) | 3 × 6.05 × 6.9 | `rpgpp-ag/rpgpp-ag-roof-02b-6x5x3` | ![](../../assets/ui/pack/icons/p_ag.roof-02b-6x5x3.webp) |
| [ ] | Roof 02b 6×5×3 half | roof panel | 3 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-02b-6x5x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02b-6x5x3-half.webp) |
| [ ] | Roof 02b 9×4×3 | ridge (both slopes) | 3 × 4.7 × 9.9 | `rpgpp-ag/rpgpp-ag-roof-02b-9x4x3` | ![](../../assets/ui/pack/icons/p_ag.roof-02b-9x4x3.webp) |
| [ ] | Roof 02b 9×4×3 half | roof panel | 3 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-02b-9x4x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02b-9x4x3-half.webp) |
| [ ] | Roof 02c 6×3×3 half | roof panel | 3 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-02c-6x3x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02c-6x3x3-half.webp) |
| [ ] | Roof 02c 6×5×3 half | roof panel | 3 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-02c-6x5x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02c-6x5x3-half.webp) |
| [ ] | Roof 02c 9×4×3 half | roof panel | 3 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-02c-9x4x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02c-9x4x3-half.webp) |
| [ ] | Roof 02d 6×3×3 half | roof panel | 3 × 3.75 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-02d-6x3x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02d-6x3x3-half.webp) |
| [ ] | Roof 02d 6×5×3 half | roof panel | 3 × 6.05 × 3.5 | `rpgpp-ag/rpgpp-ag-roof-02d-6x5x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02d-6x5x3-half.webp) |
| [ ] | Roof 02d 9×4×3 half | roof panel | 3 × 4.7 × 5 | `rpgpp-ag/rpgpp-ag-roof-02d-9x4x3-half` | ![](../../assets/ui/pack/icons/p_ag.roof-02d-9x4x3-half.webp) |
| [ ] | Stockpile 02 roof 01a | trim (on any face) | 6.16 × 3.4 × 5.26 | `rpgpp-ag/rpgpp-ag-stockpile-02-roof-01a` | ![](../../assets/ui/pack/icons/p_ag.stockpile-02-roof-01a.webp) |
| [ ] | Stockpile 02 roof 01b | trim (on any face) | 6.3 × 3.28 × 5.26 | `rpgpp-ag/rpgpp-ag-stockpile-02-roof-01b` | ![](../../assets/ui/pack/icons/p_ag.stockpile-02-roof-01b.webp) |
| [ ] | Stockpile 02 roof 02a | trim (on any face) | 6 × 2.82 × 6.02 | `rpgpp-ag/rpgpp-ag-stockpile-02-roof-02a` | ![](../../assets/ui/pack/icons/p_ag.stockpile-02-roof-02a.webp) |
| [ ] | Stockpile 02 roof 02b | trim (on any face) | 6.06 × 3.37 × 6.04 | `rpgpp-ag/rpgpp-ag-stockpile-02-roof-02b` | ![](../../assets/ui/pack/icons/p_ag.stockpile-02-roof-02b.webp) |
| [ ] | Tower 01 platform 02 roof 01a | trim (on any face) | 6.16 × 3.4 × 5.26 | `rpgpp-ag/rpgpp-ag-tower-01-platform-02-roof-01a` | ![](../../assets/ui/pack/icons/p_ag.tower-01-platform-02-roof-01a.webp) |
| [ ] | Tower 01 platform 02 roof 01b | trim (on any face) | 6.3 × 3.28 × 5.26 | `rpgpp-ag/rpgpp-ag-tower-01-platform-02-roof-01b` | ![](../../assets/ui/pack/icons/p_ag.tower-01-platform-02-roof-01b.webp) |
| [ ] | Tower 01 platform 02 roof 02a | trim (on any face) | 6 × 2.82 × 6.02 | `rpgpp-ag/rpgpp-ag-tower-01-platform-02-roof-02a` | ![](../../assets/ui/pack/icons/p_ag.tower-01-platform-02-roof-02a.webp) |
| [ ] | Tower 01 platform 02 roof 02b | trim (on any face) | 6.06 × 3.37 × 6.04 | `rpgpp-ag/rpgpp-ag-tower-01-platform-02-roof-02b` | ![](../../assets/ui/pack/icons/p_ag.tower-01-platform-02-roof-02b.webp) |

### RPGPP · Gables (163)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Roof end 01 6×3 beam a | gable end | 6 × 3 × 0.66 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x3-beam-a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x3-beam-a.webp) |
| [ ] | Roof end 01 6×3 beam half a | half gable | 3 × 3 × 0.66 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x3-beam-half-a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x3-beam-half-a.webp) |
| [ ] | Roof end 01 6×3 wall a | gable end | 6 × 3 × 0.44 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x3-wall-a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x3-wall-a.webp) |
| [ ] | Roof end 01 6×3 wall b | gable end | 6 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x3-wall-b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x3-wall-b.webp) |
| [ ] | Roof end 01 6×3 wall beam a | trim (on any face) | 2.48 × 2.98 × 0.56 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x3-wall-beam-a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x3-wall-beam-a.webp) |
| [ ] | Roof end 01 6×3 wall beam b | trim (on any face) | 3.06 × 2.98 × 0.5 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x3-wall-beam-b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x3-wall-beam-b.webp) |
| [ ] | Roof end 01 6×3 wall beam c | trim (on any face) | 3.6 × 3.01 × 0.56 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x3-wall-beam-c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x3-wall-beam-c.webp) |
| [ ] | Roof end 01 6×3 wall beam d | trim (on any face) | 3.8 × 1.81 × 0.56 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x3-wall-beam-d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x3-wall-beam-d.webp) |
| [ ] | Roof end 01 6×3 wall beam e | trim (on any face) | 3.06 × 2.15 × 0.5 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x3-wall-beam-e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x3-wall-beam-e.webp) |
| [ ] | Roof end 01 6×3 wall c | gable end | 6 × 3 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x3-wall-c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x3-wall-c.webp) |
| [ ] | Roof end 01 6×3 wall c (light) | gable end | 6 × 3 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x3-wall-c-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x3-wall-c-optimized.webp) |
| [ ] | Roof end 01 6×3 wall d | gable end | 6 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x3-wall-d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x3-wall-d.webp) |
| [ ] | Roof end 01 6×3 wall d (light) | gable end | 6 × 3 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x3-wall-d-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x3-wall-d-optimized.webp) |
| [ ] | Roof end 01 6×3 wall e | gable end | 6 × 3 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x3-wall-e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x3-wall-e.webp) |
| [ ] | Roof end 01 6×3 wall half a | half gable | 3 × 3 × 0.44 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x3-wall-half-a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x3-wall-half-a.webp) |
| [ ] | Roof end 01 6×5 beam a | gable end | 6 × 5 × 0.66 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-beam-a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-beam-a.webp) |
| [ ] | Roof end 01 6×5 wall a | gable end | 6 × 5 × 0.5 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-a.webp) |
| [ ] | Roof end 01 6×5 wall b | gable end | 6 × 5 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-b.webp) |
| [ ] | Roof end 01 6×5 wall beam a | trim (on any face) | 2.64 × 4.85 × 0.56 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-beam-a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-beam-a.webp) |
| [ ] | Roof end 01 6×5 wall beam b | trim (on any face) | 4.3 × 4.86 × 0.56 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-beam-b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-beam-b.webp) |
| [ ] | Roof end 01 6×5 wall beam c | trim (on any face) | 3.7 × 4.86 × 0.62 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-beam-c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-beam-c.webp) |
| [ ] | Roof end 01 6×5 wall beam d | trim (on any face) | 3.7 × 2.52 × 0.54 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-beam-d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-beam-d.webp) |
| [ ] | Roof end 01 6×5 wall beam e | trim (on any face) | 4.3 × 4.85 × 0.56 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-beam-e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-beam-e.webp) |
| [ ] | Roof end 01 6×5 wall c | gable end | 6 × 5 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-c.webp) |
| [ ] | Roof end 01 6×5 wall c (light) | gable end | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-c-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-c-optimized.webp) |
| [ ] | Roof end 01 6×5 wall d | gable end | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-d.webp) |
| [ ] | Roof end 01 6×5 wall d (light) | gable end | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-d-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-d-optimized.webp) |
| [ ] | Roof end 01 6×5 wall door 01a | gable end (doorway) | 6 × 5 × 0.5 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-01a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-01a.webp) |
| [ ] | Roof end 01 6×5 wall door 01b | gable end (doorway) | 6 × 5 × 0.5 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-01b.webp) |
| [ ] | Roof end 01 6×5 wall door 01d | gable end (doorway) | 6 × 5 × 0.5 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-01d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-01d.webp) |
| [ ] | Roof end 01 6×5 wall door 02a | gable end (doorway) | 6 × 5 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-02a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-02a.webp) |
| [ ] | Roof end 01 6×5 wall door 02b | gable end (doorway) | 6 × 5 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-02b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-02b.webp) |
| [ ] | Roof end 01 6×5 wall door 02d | gable end (doorway) | 6 × 5 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-02d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-02d.webp) |
| [ ] | Roof end 01 6×5 wall door 03a | gable end (doorway) | 6 × 5 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-03a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-03a.webp) |
| [ ] | Roof end 01 6×5 wall door 03a (light) | gable end (doorway) | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-03a-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-03a-optimized.webp) |
| [ ] | Roof end 01 6×5 wall door 03b | gable end (doorway) | 6 × 5 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-03b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-03b.webp) |
| [ ] | Roof end 01 6×5 wall door 03b (light) | gable end (doorway) | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-03b-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-03b-optimized.webp) |
| [ ] | Roof end 01 6×5 wall door 03c | gable end (doorway) | 6 × 5 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-03c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-03c.webp) |
| [ ] | Roof end 01 6×5 wall door 03c (light) | gable end (doorway) | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-03c-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-03c-optimized.webp) |
| [ ] | Roof end 01 6×5 wall door 03d | gable end (doorway) | 6 × 5 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-03d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-03d.webp) |
| [ ] | Roof end 01 6×5 wall door 03d (light) | gable end (doorway) | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-03d-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-03d-optimized.webp) |
| [ ] | Roof end 01 6×5 wall door 04a | gable end (doorway) | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-04a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-04a.webp) |
| [ ] | Roof end 01 6×5 wall door 04a (light) | gable end (doorway) | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-04a-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-04a-optimized.webp) |
| [ ] | Roof end 01 6×5 wall door 04b | gable end (doorway) | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-04b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-04b.webp) |
| [ ] | Roof end 01 6×5 wall door 04b (light) | gable end (doorway) | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-04b-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-04b-optimized.webp) |
| [ ] | Roof end 01 6×5 wall door 04c | gable end (doorway) | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-04c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-04c.webp) |
| [ ] | Roof end 01 6×5 wall door 04c (light) | gable end (doorway) | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-04c-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-04c-optimized.webp) |
| [ ] | Roof end 01 6×5 wall door 04d | gable end (doorway) | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-04d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-04d.webp) |
| [ ] | Roof end 01 6×5 wall door 04d (light) | gable end (doorway) | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-04d-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-04d-optimized.webp) |
| [ ] | Roof end 01 6×5 wall door 05a | gable end (doorway) | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-05a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-05a.webp) |
| [ ] | Roof end 01 6×5 wall door 05b | gable end (doorway) | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-05b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-05b.webp) |
| [ ] | Roof end 01 6×5 wall door 05c | gable end (doorway) | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-05c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-05c.webp) |
| [ ] | Roof end 01 6×5 wall door 05d | gable end (doorway) | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-door-05d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-door-05d.webp) |
| [ ] | Roof end 01 6×5 wall e | gable end | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-e.webp) |
| [ ] | Roof end 01 6×5 wall window 01a | gable end | 6 × 5 × 0.5 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-01a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-01a.webp) |
| [ ] | Roof end 01 6×5 wall window 01b | gable end | 6 × 5 × 0.5 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-01b.webp) |
| [ ] | Roof end 01 6×5 wall window 01c | gable end | 6 × 5 × 0.5 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-01c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-01c.webp) |
| [ ] | Roof end 01 6×5 wall window 01d | gable end | 6 × 5 × 0.5 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-01d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-01d.webp) |
| [ ] | Roof end 01 6×5 wall window 01e | gable end | 6 × 5 × 0.5 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-01e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-01e.webp) |
| [ ] | Roof end 01 6×5 wall window 02a | gable end | 6 × 5 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-02a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-02a.webp) |
| [ ] | Roof end 01 6×5 wall window 02b | gable end | 6 × 5 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-02b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-02b.webp) |
| [ ] | Roof end 01 6×5 wall window 02c | gable end | 6 × 5 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-02c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-02c.webp) |
| [ ] | Roof end 01 6×5 wall window 02d | gable end | 6 × 5 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-02d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-02d.webp) |
| [ ] | Roof end 01 6×5 wall window 02e | gable end | 6 × 5 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-02e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-02e.webp) |
| [ ] | Roof end 01 6×5 wall window 03a | gable end | 6 × 5 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-03a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-03a.webp) |
| [ ] | Roof end 01 6×5 wall window 03a (light) | gable end | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-03a-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-03a-optimized.webp) |
| [ ] | Roof end 01 6×5 wall window 03b | gable end | 6 × 5 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-03b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-03b.webp) |
| [ ] | Roof end 01 6×5 wall window 03b (light) | gable end | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-03b-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-03b-optimized.webp) |
| [ ] | Roof end 01 6×5 wall window 03c | gable end | 6 × 5 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-03c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-03c.webp) |
| [ ] | Roof end 01 6×5 wall window 03c (light) | gable end | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-03c-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-03c-optimized.webp) |
| [ ] | Roof end 01 6×5 wall window 03d | gable end | 6 × 5 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-03d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-03d.webp) |
| [ ] | Roof end 01 6×5 wall window 03d (light) | gable end | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-03d-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-03d-optimized.webp) |
| [ ] | Roof end 01 6×5 wall window 03e | gable end | 6 × 5 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-03e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-03e.webp) |
| [ ] | Roof end 01 6×5 wall window 03e (light) | gable end | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-03e-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-03e-optimized.webp) |
| [ ] | Roof end 01 6×5 wall window 04a | gable end | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-04a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-04a.webp) |
| [ ] | Roof end 01 6×5 wall window 04a (light) | gable end | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-04a-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-04a-optimized.webp) |
| [ ] | Roof end 01 6×5 wall window 04b | gable end | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-04b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-04b.webp) |
| [ ] | Roof end 01 6×5 wall window 04b (light) | gable end | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-04b-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-04b-optimized.webp) |
| [ ] | Roof end 01 6×5 wall window 04c | gable end | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-04c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-04c.webp) |
| [ ] | Roof end 01 6×5 wall window 04c (light) | gable end | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-04c-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-04c-optimized.webp) |
| [ ] | Roof end 01 6×5 wall window 04d | gable end | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-04d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-04d.webp) |
| [ ] | Roof end 01 6×5 wall window 04d (light) | gable end | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-04d-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-04d-optimized.webp) |
| [ ] | Roof end 01 6×5 wall window 04e | gable end | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-04e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-04e.webp) |
| [ ] | Roof end 01 6×5 wall window 04e (light) | gable end | 6 × 5 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-04e-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-04e-optimized.webp) |
| [ ] | Roof end 01 6×5 wall window 05a | gable end | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-05a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-05a.webp) |
| [ ] | Roof end 01 6×5 wall window 05b | gable end | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-05b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-05b.webp) |
| [ ] | Roof end 01 6×5 wall window 05c | gable end | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-05c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-05c.webp) |
| [ ] | Roof end 01 6×5 wall window 05d | gable end | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-05d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-05d.webp) |
| [ ] | Roof end 01 6×5 wall window 05e | gable end | 6 × 5 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-6x5-wall-window-05e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-6x5-wall-window-05e.webp) |
| [ ] | Roof end 01 9×4 beam a | gable end | 9 × 4 × 0.66 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-beam-a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-beam-a.webp) |
| [ ] | Roof end 01 9×4 wall a | gable end | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-a.webp) |
| [ ] | Roof end 01 9×4 wall b | gable end | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-b.webp) |
| [ ] | Roof end 01 9×4 wall beam a | trim (on any face) | 3.52 × 4.23 × 0.56 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-beam-a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-beam-a.webp) |
| [ ] | Roof end 01 9×4 wall beam b | trim (on any face) | 4.18 × 4.26 × 0.58 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-beam-b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-beam-b.webp) |
| [ ] | Roof end 01 9×4 wall beam c | trim (on any face) | 5.1 × 4.23 × 0.58 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-beam-c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-beam-c.webp) |
| [ ] | Roof end 01 9×4 wall beam d | trim (on any face) | 5.1 × 2.56 × 0.54 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-beam-d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-beam-d.webp) |
| [ ] | Roof end 01 9×4 wall beam e | trim (on any face) | 4.12 × 2.89 × 0.58 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-beam-e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-beam-e.webp) |
| [ ] | Roof end 01 9×4 wall c | gable end | 9 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-c.webp) |
| [ ] | Roof end 01 9×4 wall c (light) | gable end | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-c-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-c-optimized.webp) |
| [ ] | Roof end 01 9×4 wall d | gable end | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-d.webp) |
| [ ] | Roof end 01 9×4 wall d (light) | gable end | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-d-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-d-optimized.webp) |
| [ ] | Roof end 01 9×4 wall door 01a | gable end (doorway) | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-01a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-01a.webp) |
| [ ] | Roof end 01 9×4 wall door 01b | gable end (doorway) | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-01b.webp) |
| [ ] | Roof end 01 9×4 wall door 01d | gable end (doorway) | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-01d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-01d.webp) |
| [ ] | Roof end 01 9×4 wall door 02a | gable end (doorway) | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-02a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-02a.webp) |
| [ ] | Roof end 01 9×4 wall door 02b | gable end (doorway) | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-02b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-02b.webp) |
| [ ] | Roof end 01 9×4 wall door 02d | gable end (doorway) | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-02d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-02d.webp) |
| [ ] | Roof end 01 9×4 wall door 03a | gable end (doorway) | 9 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-03a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-03a.webp) |
| [ ] | Roof end 01 9×4 wall door 03a (light) | gable end (doorway) | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-03a-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-03a-optimized.webp) |
| [ ] | Roof end 01 9×4 wall door 03b | gable end (doorway) | 9 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-03b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-03b.webp) |
| [ ] | Roof end 01 9×4 wall door 03b (light) | gable end (doorway) | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-03b-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-03b-optimized.webp) |
| [ ] | Roof end 01 9×4 wall door 03c | gable end (doorway) | 9 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-03c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-03c.webp) |
| [ ] | Roof end 01 9×4 wall door 03c (light) | gable end (doorway) | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-03c-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-03c-optimized.webp) |
| [ ] | Roof end 01 9×4 wall door 03d | gable end (doorway) | 9 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-03d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-03d.webp) |
| [ ] | Roof end 01 9×4 wall door 03d (light) | gable end (doorway) | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-03d-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-03d-optimized.webp) |
| [ ] | Roof end 01 9×4 wall door 04a | gable end (doorway) | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-04a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-04a.webp) |
| [ ] | Roof end 01 9×4 wall door 04a (light) | gable end (doorway) | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-04a-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-04a-optimized.webp) |
| [ ] | Roof end 01 9×4 wall door 04b | gable end (doorway) | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-04b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-04b.webp) |
| [ ] | Roof end 01 9×4 wall door 04b (light) | gable end (doorway) | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-04b-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-04b-optimized.webp) |
| [ ] | Roof end 01 9×4 wall door 04c | gable end (doorway) | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-04c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-04c.webp) |
| [ ] | Roof end 01 9×4 wall door 04c (light) | gable end (doorway) | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-04c-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-04c-optimized.webp) |
| [ ] | Roof end 01 9×4 wall door 04d | gable end (doorway) | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-04d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-04d.webp) |
| [ ] | Roof end 01 9×4 wall door 04d (light) | gable end (doorway) | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-04d-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-04d-optimized.webp) |
| [ ] | Roof end 01 9×4 wall door 05a | gable end (doorway) | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-05a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-05a.webp) |
| [ ] | Roof end 01 9×4 wall door 05b | gable end (doorway) | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-05b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-05b.webp) |
| [ ] | Roof end 01 9×4 wall door 05c | gable end (doorway) | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-05c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-05c.webp) |
| [ ] | Roof end 01 9×4 wall door 05d | gable end (doorway) | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-door-05d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-door-05d.webp) |
| [ ] | Roof end 01 9×4 wall e | gable end | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-e.webp) |
| [ ] | Roof end 01 9×4 wall window 01a | gable end | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-01a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-01a.webp) |
| [ ] | Roof end 01 9×4 wall window 01b | gable end | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-01b.webp) |
| [ ] | Roof end 01 9×4 wall window 01c | gable end | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-01c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-01c.webp) |
| [ ] | Roof end 01 9×4 wall window 01d | gable end | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-01d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-01d.webp) |
| [ ] | Roof end 01 9×4 wall window 01e | gable end | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-01e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-01e.webp) |
| [ ] | Roof end 01 9×4 wall window 02a | gable end | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-02a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-02a.webp) |
| [ ] | Roof end 01 9×4 wall window 02b | gable end | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-02b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-02b.webp) |
| [ ] | Roof end 01 9×4 wall window 02c | gable end | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-02c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-02c.webp) |
| [ ] | Roof end 01 9×4 wall window 02d | gable end | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-02d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-02d.webp) |
| [ ] | Roof end 01 9×4 wall window 02e | gable end | 9 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-02e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-02e.webp) |
| [ ] | Roof end 01 9×4 wall window 03a | gable end | 9 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-03a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-03a.webp) |
| [ ] | Roof end 01 9×4 wall window 03a (light) | gable end | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-03a-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-03a-optimized.webp) |
| [ ] | Roof end 01 9×4 wall window 03b | gable end | 9 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-03b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-03b.webp) |
| [ ] | Roof end 01 9×4 wall window 03b (light) | gable end | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-03b-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-03b-optimized.webp) |
| [ ] | Roof end 01 9×4 wall window 03c | gable end | 9 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-03c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-03c.webp) |
| [ ] | Roof end 01 9×4 wall window 03c (light) | gable end | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-03c-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-03c-optimized.webp) |
| [ ] | Roof end 01 9×4 wall window 03d | gable end | 9 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-03d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-03d.webp) |
| [ ] | Roof end 01 9×4 wall window 03d (light) | gable end | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-03d-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-03d-optimized.webp) |
| [ ] | Roof end 01 9×4 wall window 03e | gable end | 9 × 4 × 0.42 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-03e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-03e.webp) |
| [ ] | Roof end 01 9×4 wall window 03e (light) | gable end | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-03e-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-03e-optimized.webp) |
| [ ] | Roof end 01 9×4 wall window 04a | gable end | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-04a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-04a.webp) |
| [ ] | Roof end 01 9×4 wall window 04a (light) | gable end | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-04a-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-04a-optimized.webp) |
| [ ] | Roof end 01 9×4 wall window 04b | gable end | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-04b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-04b.webp) |
| [ ] | Roof end 01 9×4 wall window 04b (light) | gable end | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-04b-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-04b-optimized.webp) |
| [ ] | Roof end 01 9×4 wall window 04c | gable end | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-04c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-04c.webp) |
| [ ] | Roof end 01 9×4 wall window 04c (light) | gable end | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-04c-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-04c-optimized.webp) |
| [ ] | Roof end 01 9×4 wall window 04d | gable end | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-04d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-04d.webp) |
| [ ] | Roof end 01 9×4 wall window 04d (light) | gable end | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-04d-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-04d-optimized.webp) |
| [ ] | Roof end 01 9×4 wall window 04e | gable end | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-04e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-04e.webp) |
| [ ] | Roof end 01 9×4 wall window 04e (light) | gable end | 9 × 4 × 0.24 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-04e-optimized` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-04e-optimized.webp) |
| [ ] | Roof end 01 9×4 wall window 05a | gable end | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-05a` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-05a.webp) |
| [ ] | Roof end 01 9×4 wall window 05b | gable end | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-05b` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-05b.webp) |
| [ ] | Roof end 01 9×4 wall window 05c | gable end | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-05c` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-05c.webp) |
| [ ] | Roof end 01 9×4 wall window 05d | gable end | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-05d` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-05d.webp) |
| [ ] | Roof end 01 9×4 wall window 05e | gable end | 9 × 4 × 0.4 | `rpgpp-ag/rpgpp-ag-roof-end-01-9x4-wall-window-05e` | ![](../../assets/ui/pack/icons/p_ag.roof-end-01-9x4-wall-window-05e.webp) |

### RPGPP · Rafters (82)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Gate balcony 02 roof support 01 | trim (on any face) | 4.74 × 1.38 × 2.68 | `rpgpp-ag/rpgpp-ag-gate-balcony-02-roof-support-01` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-02-roof-support-01.webp) |
| [ ] | Gate balcony 03 roof support 01 | trim (on any face) | 5 × 2.54 × 4.74 | `rpgpp-ag/rpgpp-ag-gate-balcony-03-roof-support-01` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-03-roof-support-01.webp) |
| [ ] | Gate balcony 03 roof support 02 | trim (on any face) | 4.68 × 1.91 × 4.18 | `rpgpp-ag/rpgpp-ag-gate-balcony-03-roof-support-02` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-03-roof-support-02.webp) |
| [ ] | Roof support 01 6×3×3 | ridge (both slopes) | 3 × 3 × 6 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3.webp) |
| [ ] | Roof support 01 6×3×3 chimney 01 | ridge (both slopes) | 3 × 3 × 6 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-chimney-01.webp) |
| [ ] | Roof support 01 6×3×3 corner a | trim (on any face) | 6.3 × 3.85 × 6.26 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-corner-a` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-corner-a.webp) |
| [ ] | Roof support 01 6×3×3 corner a chimney 01 | trim (on any face) | 6.3 × 3.85 × 6.26 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-corner-a-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-corner-a-chimney-01.webp) |
| [ ] | Roof support 01 6×3×3 corner b | trim (on any face) | 3.74 × 3.52 × 3.66 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-corner-b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-corner-b.webp) |
| [ ] | Roof support 01 6×3×3 end 01 | trim (on any face) | 6.06 × 2.86 × 0.6 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-end-01` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-end-01.webp) |
| [ ] | Roof support 01 6×3×3 end 01 half a | trim (on any face) | 2.26 × 2.06 × 0.54 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-end-01-half-a` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-end-01-half-a.webp) |
| [ ] | Roof support 01 6×3×3 end 01 half b | trim (on any face) | 3.16 × 2.86 × 0.6 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-end-01-half-b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-end-01-half-b.webp) |
| [ ] | Roof support 01 6×3×3 end 01b | trim (on any face) | 8.12 × 3.8 × 0.6 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-end-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-end-01b.webp) |
| [ ] | Roof support 01 6×3×3 end 01b half a | trim (on any face) | 3.3 × 3 × 0.54 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-end-01b-half-a` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-end-01b-half-a.webp) |
| [ ] | Roof support 01 6×3×3 end 01b half b | trim (on any face) | 4.2 × 3.8 × 0.6 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-end-01b-half-b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-end-01b-half-b.webp) |
| [ ] | Roof support 01 6×3×3 end 02 | trim (on any face) | 7.38 × 3.52 × 3.66 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-end-02` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-end-02.webp) |
| [ ] | Roof support 01 6×3×3 half a | rafters | 3 × 3 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-half-a` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-half-a.webp) |
| [ ] | Roof support 01 6×3×3 half a chimney 01 | rafters | 3 × 3 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-half-a-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-half-a-chimney-01.webp) |
| [ ] | Roof support 01 6×3×3 half a roof 01c | rafters | 3 × 3 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-half-a-roof-01c` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-half-a-roof-01c.webp) |
| [ ] | Roof support 01 6×3×3 half a roof 01d | rafters | 3 × 3 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-half-a-roof-01d` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-half-a-roof-01d.webp) |
| [ ] | Roof support 01 6×3×3 half a roof 01e | rafters | 3 × 3 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-half-a-roof-01e` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-half-a-roof-01e.webp) |
| [ ] | Roof support 01 6×3×3 half b | rafters | 3 × 3 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-half-b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-half-b.webp) |
| [ ] | Roof support 01 6×3×3 half b chimney 01 | rafters | 3 × 3 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-half-b-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-half-b-chimney-01.webp) |
| [ ] | Roof support 01 6×3×3 roof 01 end 03 | trim (on any face) | 7.38 × 3.52 × 4.2 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-roof-01-end-03` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-roof-01-end-03.webp) |
| [ ] | Roof support 01 6×3×3 roof 01b | ridge (both slopes) | 3 × 3 × 6 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-roof-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-roof-01b.webp) |
| [ ] | Roof support 01 6×3×3 roof 01b half a | rafters | 3 × 3 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-roof-01b-half-a` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-roof-01b-half-a.webp) |
| [ ] | Roof support 01 6×3×3 roof 01b half b | rafters | 3 × 3 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-roof-01b-half-b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-roof-01b-half-b.webp) |
| [ ] | Roof support 01 6×3×3 roof 02 end 03 | trim (on any face) | 7.38 × 3.52 × 3.66 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-roof-02-end-03` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-roof-02-end-03.webp) |
| [ ] | Roof support 01 6×3×3 roof 02 end 04 | trim (on any face) | 7.38 × 3.52 × 3.66 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x3x3-roof-02-end-04` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x3x3-roof-02-end-04.webp) |
| [ ] | Roof support 01 6×5×3 | ridge (both slopes) | 3 × 5 × 6 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3.webp) |
| [ ] | Roof support 01 6×5×3 chimney 01 | ridge (both slopes) | 3 × 5 × 6 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-chimney-01.webp) |
| [ ] | Roof support 01 6×5×3 corner a | trim (on any face) | 6.28 × 5.49 × 6.22 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-corner-a` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-corner-a.webp) |
| [ ] | Roof support 01 6×5×3 corner a chimney 01 | trim (on any face) | 6.28 × 5.49 × 6.22 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-corner-a-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-corner-a-chimney-01.webp) |
| [ ] | Roof support 01 6×5×3 corner b | trim (on any face) | 3.48 × 5.28 × 3.52 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-corner-b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-corner-b.webp) |
| [ ] | Roof support 01 6×5×3 end 01 | trim (on any face) | 6.26 × 4.46 × 0.58 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-end-01` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-end-01.webp) |
| [ ] | Roof support 01 6×5×3 end 01 half a | trim (on any face) | 2.36 × 3.26 × 0.52 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-end-01-half-a` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-end-01-half-a.webp) |
| [ ] | Roof support 01 6×5×3 end 01 half b | trim (on any face) | 3.26 × 4.46 × 0.58 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-end-01-half-b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-end-01-half-b.webp) |
| [ ] | Roof support 01 6×5×3 end 01b | trim (on any face) | 8.06 × 5.76 × 0.58 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-end-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-end-01b.webp) |
| [ ] | Roof support 01 6×5×3 end 01b half a | trim (on any face) | 3.26 × 4.56 × 0.52 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-end-01b-half-a` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-end-01b-half-a.webp) |
| [ ] | Roof support 01 6×5×3 end 01b half b | trim (on any face) | 4.16 × 5.76 × 0.58 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-end-01b-half-b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-end-01b-half-b.webp) |
| [ ] | Roof support 01 6×5×3 end 02 | trim (on any face) | 6.94 × 5.28 × 3.52 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-end-02` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-end-02.webp) |
| [ ] | Roof support 01 6×5×3 half a | rafters | 3 × 5 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-half-a` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-half-a.webp) |
| [ ] | Roof support 01 6×5×3 half a chimney 01 | rafters | 3 × 5 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-half-a-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-half-a-chimney-01.webp) |
| [ ] | Roof support 01 6×5×3 half a roof 01c | rafters | 3 × 5 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-half-a-roof-01c` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-half-a-roof-01c.webp) |
| [ ] | Roof support 01 6×5×3 half a roof 01d | rafters | 3 × 5 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-half-a-roof-01d` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-half-a-roof-01d.webp) |
| [ ] | Roof support 01 6×5×3 half a roof 01e | rafters | 3 × 5 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-half-a-roof-01e` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-half-a-roof-01e.webp) |
| [ ] | Roof support 01 6×5×3 half b | rafters | 3 × 5 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-half-b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-half-b.webp) |
| [ ] | Roof support 01 6×5×3 half b chimney 01 | rafters | 3 × 5 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-half-b-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-half-b-chimney-01.webp) |
| [ ] | Roof support 01 6×5×3 roof 01 end 03 | trim (on any face) | 6.94 × 5.28 × 3.82 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-roof-01-end-03` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-roof-01-end-03.webp) |
| [ ] | Roof support 01 6×5×3 roof 01b | ridge (both slopes) | 3 × 5 × 6 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-roof-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-roof-01b.webp) |
| [ ] | Roof support 01 6×5×3 roof 01b half a | rafters | 3 × 5 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-roof-01b-half-a` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-roof-01b-half-a.webp) |
| [ ] | Roof support 01 6×5×3 roof 01b half b | rafters | 3 × 5 × 3 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-roof-01b-half-b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-roof-01b-half-b.webp) |
| [ ] | Roof support 01 6×5×3 roof 02 end 03 | trim (on any face) | 6.94 × 5.28 × 3.52 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-roof-02-end-03` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-roof-02-end-03.webp) |
| [ ] | Roof support 01 6×5×3 roof 02 end 04 | trim (on any face) | 6.94 × 5.28 × 3.52 | `rpgpp-ag/rpgpp-ag-roof-support-01-6x5x3-roof-02-end-04` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-6x5x3-roof-02-end-04.webp) |
| [ ] | Roof support 01 9×4×3 | ridge (both slopes) | 3 × 4 × 9 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3.webp) |
| [ ] | Roof support 01 9×4×3 chimney 01 | ridge (both slopes) | 3 × 4 × 9 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-chimney-01.webp) |
| [ ] | Roof support 01 9×4×3 corner a | trim (on any face) | 7.66 × 4.77 × 7.84 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-corner-a` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-corner-a.webp) |
| [ ] | Roof support 01 9×4×3 corner a chimney 01 | trim (on any face) | 7.66 × 4.77 × 7.84 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-corner-a-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-corner-a-chimney-01.webp) |
| [ ] | Roof support 01 9×4×3 corner b | trim (on any face) | 6.4 × 4.94 × 6.58 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-corner-b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-corner-b.webp) |
| [ ] | Roof support 01 9×4×3 end 01 | trim (on any face) | 8.86 × 3.96 × 0.74 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-end-01` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-end-01.webp) |
| [ ] | Roof support 01 9×4×3 end 01 half a | trim (on any face) | 3.66 × 3.26 × 0.74 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-end-01-half-a` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-end-01-half-a.webp) |
| [ ] | Roof support 01 9×4×3 end 01 half b | trim (on any face) | 4.56 × 3.96 × 0.74 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-end-01-half-b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-end-01-half-b.webp) |
| [ ] | Roof support 01 9×4×3 end 01b | trim (on any face) | 10.86 × 4.86 × 0.74 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-end-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-end-01b.webp) |
| [ ] | Roof support 01 9×4×3 end 01b half a | trim (on any face) | 4.66 × 4.16 × 0.74 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-end-01b-half-a` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-end-01b-half-a.webp) |
| [ ] | Roof support 01 9×4×3 end 01b half b | trim (on any face) | 5.56 × 4.86 × 0.74 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-end-01b-half-b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-end-01b-half-b.webp) |
| [ ] | Roof support 01 9×4×3 end 02 | trim (on any face) | 10 × 4.94 × 6.58 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-end-02` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-end-02.webp) |
| [ ] | Roof support 01 9×4×3 half a | rafters | 3 × 4 × 4.5 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-half-a` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-half-a.webp) |
| [ ] | Roof support 01 9×4×3 half a chimney 01 | rafters | 3 × 4 × 4.5 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-half-a-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-half-a-chimney-01.webp) |
| [ ] | Roof support 01 9×4×3 half a roof 01c | rafters | 3 × 4 × 4.5 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-half-a-roof-01c` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-half-a-roof-01c.webp) |
| [ ] | Roof support 01 9×4×3 half a roof 01d | rafters | 3 × 4 × 4.5 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-half-a-roof-01d` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-half-a-roof-01d.webp) |
| [ ] | Roof support 01 9×4×3 half a roof 01e | rafters | 3 × 4 × 4.5 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-half-a-roof-01e` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-half-a-roof-01e.webp) |
| [ ] | Roof support 01 9×4×3 half b | rafters | 3 × 4 × 4.5 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-half-b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-half-b.webp) |
| [ ] | Roof support 01 9×4×3 half b chimney 01 | rafters | 3 × 4 × 4.5 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-half-b-chimney-01` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-half-b-chimney-01.webp) |
| [ ] | Roof support 01 9×4×3 roof 01 end 03 | trim (on any face) | 10 × 4.94 × 7 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-roof-01-end-03` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-roof-01-end-03.webp) |
| [ ] | Roof support 01 9×4×3 roof 01b | ridge (both slopes) | 3 × 4 × 9 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-roof-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-roof-01b.webp) |
| [ ] | Roof support 01 9×4×3 roof 01b half a | rafters | 3 × 4 × 4.5 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-roof-01b-half-a` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-roof-01b-half-a.webp) |
| [ ] | Roof support 01 9×4×3 roof 01b half b | rafters | 3 × 4 × 4.5 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-roof-01b-half-b` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-roof-01b-half-b.webp) |
| [ ] | Roof support 01 9×4×3 roof 02 end 03 | trim (on any face) | 10 × 4.94 × 6.58 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-roof-02-end-03` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-roof-02-end-03.webp) |
| [ ] | Roof support 01 9×4×3 roof 02 end 04 | trim (on any face) | 10 × 4.94 × 6.58 | `rpgpp-ag/rpgpp-ag-roof-support-01-9x4x3-roof-02-end-04` | ![](../../assets/ui/pack/icons/p_ag.roof-support-01-9x4x3-roof-02-end-04.webp) |
| [ ] | Stockpile 02 roof support 01 | trim (on any face) | 5 × 2.54 × 4.74 | `rpgpp-ag/rpgpp-ag-stockpile-02-roof-support-01` | ![](../../assets/ui/pack/icons/p_ag.stockpile-02-roof-support-01.webp) |
| [ ] | Stockpile 02 roof support 02 | trim (on any face) | 4.68 × 1.91 × 4.18 | `rpgpp-ag/rpgpp-ag-stockpile-02-roof-support-02` | ![](../../assets/ui/pack/icons/p_ag.stockpile-02-roof-support-02.webp) |
| [ ] | Tower 01 platform 02 roof support 01 | trim (on any face) | 5 × 2.54 × 4.74 | `rpgpp-ag/rpgpp-ag-tower-01-platform-02-roof-support-01` | ![](../../assets/ui/pack/icons/p_ag.tower-01-platform-02-roof-support-01.webp) |
| [ ] | Tower 01 platform 02 roof support 02 | trim (on any face) | 4.68 × 1.91 × 4.18 | `rpgpp-ag/rpgpp-ag-tower-01-platform-02-roof-support-02` | ![](../../assets/ui/pack/icons/p_ag.tower-01-platform-02-roof-support-02.webp) |

### RPGPP · Doors (29)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Door 01 bottom | door | 1.65 × 1.29 × 0.32 | `rpgpp-ag/rpgpp-ag-door-01-bottom` | ![](../../assets/ui/pack/icons/p_ag.door-01-bottom.webp) |
| [ ] | Door 01 top | door | 1.65 × 1.18 × 0.24 | `rpgpp-ag/rpgpp-ag-door-01-top` | ![](../../assets/ui/pack/icons/p_ag.door-01-top.webp) |
| [ ] | Door 02 bottom | door | 1.44 × 1.13 × 0.34 | `rpgpp-ag/rpgpp-ag-door-02-bottom` | ![](../../assets/ui/pack/icons/p_ag.door-02-bottom.webp) |
| [ ] | Door 02 top | door | 1.44 × 1.13 × 0.24 | `rpgpp-ag/rpgpp-ag-door-02-top` | ![](../../assets/ui/pack/icons/p_ag.door-02-top.webp) |
| [ ] | Door 03a | door | 1.39 × 2.32 × 0.26 | `rpgpp-ag/rpgpp-ag-door-03a` | ![](../../assets/ui/pack/icons/p_ag.door-03a.webp) |
| [ ] | Door 04a | door | 1.37 × 2.41 × 0.46 | `rpgpp-ag/rpgpp-ag-door-04a` | ![](../../assets/ui/pack/icons/p_ag.door-04a.webp) |
| [ ] | Door 05 left | door | 1.03 × 2.26 × 0.34 | `rpgpp-ag/rpgpp-ag-door-05-left` | ![](../../assets/ui/pack/icons/p_ag.door-05-left.webp) |
| [ ] | Door 05 right | door | 1.02 × 2.26 × 0.34 | `rpgpp-ag/rpgpp-ag-door-05-right` | ![](../../assets/ui/pack/icons/p_ag.door-05-right.webp) |
| [ ] | Door 06a | door | 1.31 × 2.19 × 0.28 | `rpgpp-ag/rpgpp-ag-door-06a` | ![](../../assets/ui/pack/icons/p_ag.door-06a.webp) |
| [ ] | Door 07a | door | 1.32 × 2.35 × 0.3 | `rpgpp-ag/rpgpp-ag-door-07a` | ![](../../assets/ui/pack/icons/p_ag.door-07a.webp) |
| [ ] | Door 08a | door | 1.49 × 2.47 × 0.34 | `rpgpp-ag/rpgpp-ag-door-08a` | ![](../../assets/ui/pack/icons/p_ag.door-08a.webp) |
| [ ] | Door frame 01 | wall (doorway) | 2 × 3 × 0.8 | `rpgpp-ag/rpgpp-ag-door-frame-01` | ![](../../assets/ui/pack/icons/p_ag.door-frame-01.webp) |
| [ ] | Door frame 02 | wall (doorway) | 2 × 3 × 0.88 | `rpgpp-ag/rpgpp-ag-door-frame-02` | ![](../../assets/ui/pack/icons/p_ag.door-frame-02.webp) |
| [ ] | Door frame 03 | wall (doorway) | 2.5 × 3 × 0.96 | `rpgpp-ag/rpgpp-ag-door-frame-03` | ![](../../assets/ui/pack/icons/p_ag.door-frame-03.webp) |
| [ ] | Door frame 04 | wall (doorway) | 2.5 × 3 × 0.92 | `rpgpp-ag/rpgpp-ag-door-frame-04` | ![](../../assets/ui/pack/icons/p_ag.door-frame-04.webp) |
| [ ] | Door frame 05 | wall (doorway) | 3 × 3 × 0.58 | `rpgpp-ag/rpgpp-ag-door-frame-05` | ![](../../assets/ui/pack/icons/p_ag.door-frame-05.webp) |
| [ ] | Door frame 06 | wall (doorway) | 2.5 × 3 × 0.64 | `rpgpp-ag/rpgpp-ag-door-frame-06` | ![](../../assets/ui/pack/icons/p_ag.door-frame-06.webp) |
| [ ] | Door frame 07 | wall (doorway) | 2 × 3 × 0.86 | `rpgpp-ag/rpgpp-ag-door-frame-07` | ![](../../assets/ui/pack/icons/p_ag.door-frame-07.webp) |
| [ ] | Door frame 08 | wall (doorway) | 2 × 3 × 0.8 | `rpgpp-ag/rpgpp-ag-door-frame-08` | ![](../../assets/ui/pack/icons/p_ag.door-frame-08.webp) |
| [ ] | Door gate 01 left | door | 2.04 × 3.7 × 0.46 | `rpgpp-ag/rpgpp-ag-door-gate-01-left` | ![](../../assets/ui/pack/icons/p_ag.door-gate-01-left.webp) |
| [ ] | Door gate 01 right | door | 2.04 × 3.7 × 0.46 | `rpgpp-ag/rpgpp-ag-door-gate-01-right` | ![](../../assets/ui/pack/icons/p_ag.door-gate-01-right.webp) |
| [ ] | Door gate 02 left | door | 2.11 × 3.72 × 0.48 | `rpgpp-ag/rpgpp-ag-door-gate-02-left` | ![](../../assets/ui/pack/icons/p_ag.door-gate-02-left.webp) |
| [ ] | Door gate 02 right | door | 2.08 × 3.69 × 0.48 | `rpgpp-ag/rpgpp-ag-door-gate-02-right` | ![](../../assets/ui/pack/icons/p_ag.door-gate-02-right.webp) |
| [ ] | Door gate 03 left | door | 2.08 × 3.72 × 0.44 | `rpgpp-ag/rpgpp-ag-door-gate-03-left` | ![](../../assets/ui/pack/icons/p_ag.door-gate-03-left.webp) |
| [ ] | Door gate 03 right | door | 2.08 × 3.72 × 0.44 | `rpgpp-ag/rpgpp-ag-door-gate-03-right` | ![](../../assets/ui/pack/icons/p_ag.door-gate-03-right.webp) |
| [ ] | Door gate closed 01 | beam | 2 × 0.4 × 0.44 | `rpgpp-ag/rpgpp-ag-door-gate-closed-01` | ![](../../assets/ui/pack/icons/p_ag.door-gate-closed-01.webp) |
| [ ] | Door gate closed 02 | beam | 2 × 0.42 × 0.36 | `rpgpp-ag/rpgpp-ag-door-gate-closed-02` | ![](../../assets/ui/pack/icons/p_ag.door-gate-closed-02.webp) |
| [ ] | Door gate small 01 left | door | 2.43 × 3.72 × 0.48 | `rpgpp-ag/rpgpp-ag-door-gate-small-01-left` | ![](../../assets/ui/pack/icons/p_ag.door-gate-small-01-left.webp) |
| [ ] | Door gate small 01 right | door | 2.43 × 3.7 × 0.48 | `rpgpp-ag/rpgpp-ag-door-gate-small-01-right` | ![](../../assets/ui/pack/icons/p_ag.door-gate-small-01-right.webp) |

### RPGPP · Windows (44)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Roof 01c half window 01 | trim (on any face) | 0.54 × 2.29 × 2.92 | `rpgpp-ag/rpgpp-ag-roof-01c-half-window-01` | ![](../../assets/ui/pack/icons/p_ag.roof-01c-half-window-01.webp) |
| [ ] | Roof 01c half window 02 | trim (on any face) | 0.54 × 2.29 × 2.92 | `rpgpp-ag/rpgpp-ag-roof-01c-half-window-02` | ![](../../assets/ui/pack/icons/p_ag.roof-01c-half-window-02.webp) |
| [ ] | Roof 01c half window 03 | trim (on any face) | 0.54 × 2.29 × 2.92 | `rpgpp-ag/rpgpp-ag-roof-01c-half-window-03` | ![](../../assets/ui/pack/icons/p_ag.roof-01c-half-window-03.webp) |
| [ ] | Roof 01d half window 01 | trim (on any face) | 1.2 × 1.4 × 2.32 | `rpgpp-ag/rpgpp-ag-roof-01d-half-window-01` | ![](../../assets/ui/pack/icons/p_ag.roof-01d-half-window-01.webp) |
| [ ] | Roof 01d half window 01 shutter a | trim (on any face) | 1.06 × 0.96 × 2.14 | `rpgpp-ag/rpgpp-ag-roof-01d-half-window-01-shutter-a` | ![](../../assets/ui/pack/icons/p_ag.roof-01d-half-window-01-shutter-a.webp) |
| [ ] | Roof 01d half window 02 | trim (on any face) | 1.2 × 1.4 × 2.32 | `rpgpp-ag/rpgpp-ag-roof-01d-half-window-02` | ![](../../assets/ui/pack/icons/p_ag.roof-01d-half-window-02.webp) |
| [ ] | Roof 01d half window 03 | trim (on any face) | 1.2 × 1.4 × 2.32 | `rpgpp-ag/rpgpp-ag-roof-01d-half-window-03` | ![](../../assets/ui/pack/icons/p_ag.roof-01d-half-window-03.webp) |
| [ ] | Roof 02 end 03 window 01a | trim (on any face) | 5.24 × 1.65 × 0.58 | `rpgpp-ag/rpgpp-ag-roof-02-end-03-window-01a` | ![](../../assets/ui/pack/icons/p_ag.roof-02-end-03-window-01a.webp) |
| [ ] | Roof 02 end 03 window 01b | trim (on any face) | 5.24 × 1.65 × 0.58 | `rpgpp-ag/rpgpp-ag-roof-02-end-03-window-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-02-end-03-window-01b.webp) |
| [ ] | Roof 02 end 04 window 01a | trim (on any face) | 3.32 × 1.69 × 0.58 | `rpgpp-ag/rpgpp-ag-roof-02-end-04-window-01a` | ![](../../assets/ui/pack/icons/p_ag.roof-02-end-04-window-01a.webp) |
| [ ] | Roof 02 end 04 window 01b | trim (on any face) | 3.32 × 1.69 × 0.58 | `rpgpp-ag/rpgpp-ag-roof-02-end-04-window-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-02-end-04-window-01b.webp) |
| [ ] | Roof 02d half window 01a | trim (on any face) | 0.5 × 1.38 × 2.18 | `rpgpp-ag/rpgpp-ag-roof-02d-half-window-01a` | ![](../../assets/ui/pack/icons/p_ag.roof-02d-half-window-01a.webp) |
| [ ] | Roof 02d half window 01b | trim (on any face) | 0.5 × 1.38 × 2.18 | `rpgpp-ag/rpgpp-ag-roof-02d-half-window-01b` | ![](../../assets/ui/pack/icons/p_ag.roof-02d-half-window-01b.webp) |
| [ ] | Roof 02d half window 01c | trim (on any face) | 0.5 × 1.38 × 2.18 | `rpgpp-ag/rpgpp-ag-roof-02d-half-window-01c` | ![](../../assets/ui/pack/icons/p_ag.roof-02d-half-window-01c.webp) |
| [ ] | Roof 02d half window 01d | trim (on any face) | 0.5 × 1.38 × 2.18 | `rpgpp-ag/rpgpp-ag-roof-02d-half-window-01d` | ![](../../assets/ui/pack/icons/p_ag.roof-02d-half-window-01d.webp) |
| [ ] | Window 01 shutter l | trim (on any face) | 0.78 × 1.01 × 0.1 | `rpgpp-ag/rpgpp-ag-window-01-shutter-l` | ![](../../assets/ui/pack/icons/p_ag.window-01-shutter-l.webp) |
| [ ] | Window 01 shutter r | trim (on any face) | 0.78 × 1.01 × 0.1 | `rpgpp-ag/rpgpp-ag-window-01-shutter-r` | ![](../../assets/ui/pack/icons/p_ag.window-01-shutter-r.webp) |
| [ ] | Window 01a | trim (on any face) | 2.2 × 1.35 × 0.56 | `rpgpp-ag/rpgpp-ag-window-01a` | ![](../../assets/ui/pack/icons/p_ag.window-01a.webp) |
| [ ] | Window 01b | trim (on any face) | 2.2 × 1.35 × 0.56 | `rpgpp-ag/rpgpp-ag-window-01b` | ![](../../assets/ui/pack/icons/p_ag.window-01b.webp) |
| [ ] | Window 01c | trim (on any face) | 2.2 × 1.35 × 0.56 | `rpgpp-ag/rpgpp-ag-window-01c` | ![](../../assets/ui/pack/icons/p_ag.window-01c.webp) |
| [ ] | Window 02 shutter a | trim (on any face) | 2.82 × 1.15 × 0.8 | `rpgpp-ag/rpgpp-ag-window-02-shutter-a` | ![](../../assets/ui/pack/icons/p_ag.window-02-shutter-a.webp) |
| [ ] | Window 02a | trim (on any face) | 3.1 × 1.35 × 0.52 | `rpgpp-ag/rpgpp-ag-window-02a` | ![](../../assets/ui/pack/icons/p_ag.window-02a.webp) |
| [ ] | Window 02b | trim (on any face) | 3.1 × 1.35 × 0.52 | `rpgpp-ag/rpgpp-ag-window-02b` | ![](../../assets/ui/pack/icons/p_ag.window-02b.webp) |
| [ ] | Window 02c | trim (on any face) | 3.1 × 1.35 × 0.52 | `rpgpp-ag/rpgpp-ag-window-02c` | ![](../../assets/ui/pack/icons/p_ag.window-02c.webp) |
| [ ] | Window 03 shutter a | trim (on any face) | 0.82 × 1.08 × 0.12 | `rpgpp-ag/rpgpp-ag-window-03-shutter-a` | ![](../../assets/ui/pack/icons/p_ag.window-03-shutter-a.webp) |
| [ ] | Window 03a | trim (on any face) | 1.06 × 1.32 × 0.7 | `rpgpp-ag/rpgpp-ag-window-03a` | ![](../../assets/ui/pack/icons/p_ag.window-03a.webp) |
| [ ] | Window 03b | trim (on any face) | 1.06 × 1.32 × 0.7 | `rpgpp-ag/rpgpp-ag-window-03b` | ![](../../assets/ui/pack/icons/p_ag.window-03b.webp) |
| [ ] | Window 03c | trim (on any face) | 1.06 × 1.32 × 0.7 | `rpgpp-ag/rpgpp-ag-window-03c` | ![](../../assets/ui/pack/icons/p_ag.window-03c.webp) |
| [ ] | Window 04 shutter a | trim (on any face) | 0.78 × 1.03 × 0.1 | `rpgpp-ag/rpgpp-ag-window-04-shutter-a` | ![](../../assets/ui/pack/icons/p_ag.window-04-shutter-a.webp) |
| [ ] | Window 04 shutter b | trim (on any face) | 0.78 × 1.17 × 0.6 | `rpgpp-ag/rpgpp-ag-window-04-shutter-b` | ![](../../assets/ui/pack/icons/p_ag.window-04-shutter-b.webp) |
| [ ] | Window 04a | trim (on any face) | 0.98 × 1.34 × 0.56 | `rpgpp-ag/rpgpp-ag-window-04a` | ![](../../assets/ui/pack/icons/p_ag.window-04a.webp) |
| [ ] | Window 04b | trim (on any face) | 0.98 × 1.34 × 0.56 | `rpgpp-ag/rpgpp-ag-window-04b` | ![](../../assets/ui/pack/icons/p_ag.window-04b.webp) |
| [ ] | Window 04c | trim (on any face) | 0.98 × 1.34 × 0.56 | `rpgpp-ag/rpgpp-ag-window-04c` | ![](../../assets/ui/pack/icons/p_ag.window-04c.webp) |
| [ ] | Window 05a | trim (on any face) | 1.38 × 1.35 × 0.56 | `rpgpp-ag/rpgpp-ag-window-05a` | ![](../../assets/ui/pack/icons/p_ag.window-05a.webp) |
| [ ] | Window 05b | trim (on any face) | 1.38 × 1.35 × 0.56 | `rpgpp-ag/rpgpp-ag-window-05b` | ![](../../assets/ui/pack/icons/p_ag.window-05b.webp) |
| [ ] | Window 05c | trim (on any face) | 1.38 × 1.35 × 0.56 | `rpgpp-ag/rpgpp-ag-window-05c` | ![](../../assets/ui/pack/icons/p_ag.window-05c.webp) |
| [ ] | Window 06 shutter a | trim (on any face) | 0.78 × 1.03 × 0.1 | `rpgpp-ag/rpgpp-ag-window-06-shutter-a` | ![](../../assets/ui/pack/icons/p_ag.window-06-shutter-a.webp) |
| [ ] | Window 06a | trim (on any face) | 1.22 × 1.46 × 0.78 | `rpgpp-ag/rpgpp-ag-window-06a` | ![](../../assets/ui/pack/icons/p_ag.window-06a.webp) |
| [ ] | Window 06b | trim (on any face) | 1.22 × 1.46 × 0.78 | `rpgpp-ag/rpgpp-ag-window-06b` | ![](../../assets/ui/pack/icons/p_ag.window-06b.webp) |
| [ ] | Window 06c | trim (on any face) | 1.22 × 1.46 × 0.78 | `rpgpp-ag/rpgpp-ag-window-06c` | ![](../../assets/ui/pack/icons/p_ag.window-06c.webp) |
| [ ] | Window 07 shutter a | trim (on any face) | 0.84 × 1.28 × 0.12 | `rpgpp-ag/rpgpp-ag-window-07-shutter-a` | ![](../../assets/ui/pack/icons/p_ag.window-07-shutter-a.webp) |
| [ ] | Window 07a | trim (on any face) | 1.24 × 1.47 × 0.64 | `rpgpp-ag/rpgpp-ag-window-07a` | ![](../../assets/ui/pack/icons/p_ag.window-07a.webp) |
| [ ] | Window 07b | trim (on any face) | 1.24 × 1.47 × 0.64 | `rpgpp-ag/rpgpp-ag-window-07b` | ![](../../assets/ui/pack/icons/p_ag.window-07b.webp) |
| [ ] | Window 07c | trim (on any face) | 1.24 × 1.47 × 0.64 | `rpgpp-ag/rpgpp-ag-window-07c` | ![](../../assets/ui/pack/icons/p_ag.window-07c.webp) |

### RPGPP · Stairs (38)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Ladder 01a | ladder (no climbing) | 0.72 × 3 × 0.58 | `rpgpp-ag/rpgpp-ag-ladder-01a` | ![](../../assets/ui/pack/icons/p_ag.ladder-01a.webp) |
| [ ] | Ladder 01b | ladder (no climbing) | 0.72 × 1.5 × 0.4 | `rpgpp-ag/rpgpp-ag-ladder-01b` | ![](../../assets/ui/pack/icons/p_ag.ladder-01b.webp) |
| [ ] | Ladder 01c | ladder (no climbing) | 0.72 × 3 × 0.58 | `rpgpp-ag/rpgpp-ag-ladder-01c` | ![](../../assets/ui/pack/icons/p_ag.ladder-01c.webp) |
| [ ] | Ladder 02 | ladder (no climbing) | 0.72 × 2 × 1 | `rpgpp-ag/rpgpp-ag-ladder-02` | ![](../../assets/ui/pack/icons/p_ag.ladder-02.webp) |
| [ ] | Ladder tower 01 4m | ladder (no climbing) | 0.72 × 4.5 × 0.58 | `rpgpp-ag/rpgpp-ag-ladder-tower-01-4m` | ![](../../assets/ui/pack/icons/p_ag.ladder-tower-01-4m.webp) |
| [ ] | Stairs entrance 01 | stairs | 2.52 × 1.5 × 2.5 | `rpgpp-ag/rpgpp-ag-stairs-entrance-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-entrance-01.webp) |
| [ ] | Stairs entrance 02 | stairs | 2.44 × 1 × 4 | `rpgpp-ag/rpgpp-ag-stairs-entrance-02` | ![](../../assets/ui/pack/icons/p_ag.stairs-entrance-02.webp) |
| [ ] | Stairs entrance 03 | stairs | 2.42 × 1 × 2 | `rpgpp-ag/rpgpp-ag-stairs-entrance-03` | ![](../../assets/ui/pack/icons/p_ag.stairs-entrance-03.webp) |
| [ ] | Stairs entrance 04 | stairs | 2.1 × 1.5 × 1.5 | `rpgpp-ag/rpgpp-ag-stairs-entrance-04` | ![](../../assets/ui/pack/icons/p_ag.stairs-entrance-04.webp) |
| [ ] | Stairs interior 01a 3m | stairs | 3.14 × 3 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-01a-3m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01a-3m.webp) |
| [ ] | Stairs interior 01a 4m | stairs | 3.14 × 4 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-01a-4m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01a-4m.webp) |
| [ ] | Stairs interior 01b 3m | stairs | 5.92 × 3 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-01b-3m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01b-3m.webp) |
| [ ] | Stairs interior 01b 4m | stairs | 5.9 × 4 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-01b-4m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01b-4m.webp) |
| [ ] | Stairs interior 01c 3m | stairs | 4.9 × 3 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-01c-3m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01c-3m.webp) |
| [ ] | Stairs interior 01c 4m | stairs | 4.88 × 4 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-01c-4m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01c-4m.webp) |
| [ ] | Stairs interior 01d 3m | stairs | 6.22 × 3 × 5.5 | `rpgpp-ag/rpgpp-ag-stairs-interior-01d-3m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01d-3m.webp) |
| [ ] | Stairs interior 01d 4m | stairs | 6.22 × 4 × 5.5 | `rpgpp-ag/rpgpp-ag-stairs-interior-01d-4m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01d-4m.webp) |
| [ ] | Stairs interior 01e 3m | stairs | 6.22 × 3 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-01e-3m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01e-3m.webp) |
| [ ] | Stairs interior 01e 4m | stairs | 6.22 × 4 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-01e-4m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01e-4m.webp) |
| [ ] | Stairs interior 02a 3m | stairs | 2.24 × 3 × 5 | `rpgpp-ag/rpgpp-ag-stairs-interior-02a-3m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02a-3m.webp) |
| [ ] | Stairs interior 02a 4m | stairs | 2.12 × 4 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-02a-4m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02a-4m.webp) |
| [ ] | Stairs interior 02b 3m | stairs | 6.12 × 3 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-02b-3m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02b-3m.webp) |
| [ ] | Stairs interior 02b 4m | stairs | 6 × 4 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-02b-4m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02b-4m.webp) |
| [ ] | Stairs interior 02c 3m | stairs | 5.22 × 3 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-02c-3m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02c-3m.webp) |
| [ ] | Stairs interior 02c 4m | stairs | 5.22 × 4 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-02c-4m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02c-4m.webp) |
| [ ] | Stairs interior 02d 3m | stairs | 6.24 × 3 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-02d-3m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02d-3m.webp) |
| [ ] | Stairs interior 02d 4m | stairs | 6.24 × 4 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-02d-4m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02d-4m.webp) |
| [ ] | Stairs interior 02e 3m | stairs | 6.24 × 3 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-02e-3m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02e-3m.webp) |
| [ ] | Stairs interior 02e 4m | stairs | 6.24 × 4 × 6 | `rpgpp-ag/rpgpp-ag-stairs-interior-02e-4m` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02e-4m.webp) |
| [ ] | Stockpile 01 stairs | stairs | 2.22 × 1 × 1.5 | `rpgpp-ag/rpgpp-ag-stockpile-01-stairs` | ![](../../assets/ui/pack/icons/p_ag.stockpile-01-stairs.webp) |
| [ ] | Wall platform stairs 01a 2m | stairs | 2.32 × 2 × 3 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-01a-2m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-01a-2m.webp) |
| [ ] | Wall platform stairs 01a 4m | stairs | 2.28 × 4 × 6 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-01a-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-01a-4m.webp) |
| [ ] | Wall platform stairs 01b 4m | stairs | 5.1 × 4 × 5 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-01b-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-01b-4m.webp) |
| [ ] | Wall platform stairs 01c 4m | stairs | 2.32 × 4 × 8 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-01c-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-01c-4m.webp) |
| [ ] | Wall platform stairs 02a 2m | stairs | 2.52 × 2 × 3 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-02a-2m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-02a-2m.webp) |
| [ ] | Wall platform stairs 02a 4m | stairs | 2.52 × 4 × 6 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-02a-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-02a-4m.webp) |
| [ ] | Wall platform stairs 02b 4m | stairs | 5.52 × 4 × 5.5 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-02b-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-02b-4m.webp) |
| [ ] | Wall platform stairs 02c 4m | stairs | 2.66 × 4 × 8.5 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-02c-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-02c-4m.webp) |

### RPGPP · Beams (47)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Balcony 01 support a | trim (on any face) | 0.32 × 1.98 × 2.16 | `rpgpp-ag/rpgpp-ag-balcony-01-support-a` | ![](../../assets/ui/pack/icons/p_ag.balcony-01-support-a.webp) |
| [ ] | Balcony 01 support b | beam | 2 × 0.28 × 0.32 | `rpgpp-ag/rpgpp-ag-balcony-01-support-b` | ![](../../assets/ui/pack/icons/p_ag.balcony-01-support-b.webp) |
| [ ] | Gate balcony 03 support 01 | on posts | 5 × 3.87 × 4.5 | `rpgpp-ag/rpgpp-ag-gate-balcony-03-support-01` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-03-support-01.webp) |
| [ ] | Gate balcony support 01 | on posts | 4.5 × 3.89 × 2.5 | `rpgpp-ag/rpgpp-ag-gate-balcony-support-01` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-support-01.webp) |
| [ ] | Gate balcony support 02 | on posts | 4.5 × 2 × 2 | `rpgpp-ag/rpgpp-ag-gate-balcony-support-02` | ![](../../assets/ui/pack/icons/p_ag.gate-balcony-support-02.webp) |
| [ ] | Support beam int 01a 3m | post | 0.44 × 3 × 0.46 | `rpgpp-ag/rpgpp-ag-support-beam-int-01a-3m` | ![](../../assets/ui/pack/icons/p_ag.support-beam-int-01a-3m.webp) |
| [ ] | Support beam int 01a 4m | post | 0.44 × 4 × 0.46 | `rpgpp-ag/rpgpp-ag-support-beam-int-01a-4m` | ![](../../assets/ui/pack/icons/p_ag.support-beam-int-01a-4m.webp) |
| [ ] | Support beam int 01b 3m | post | 0.44 × 3 × 1.8 | `rpgpp-ag/rpgpp-ag-support-beam-int-01b-3m` | ![](../../assets/ui/pack/icons/p_ag.support-beam-int-01b-3m.webp) |
| [ ] | Support beam int 01b 4m | post | 0.44 × 4 × 1.8 | `rpgpp-ag/rpgpp-ag-support-beam-int-01b-4m` | ![](../../assets/ui/pack/icons/p_ag.support-beam-int-01b-4m.webp) |
| [ ] | Support beam int 01c 3m | post | 0.44 × 3 × 3.12 | `rpgpp-ag/rpgpp-ag-support-beam-int-01c-3m` | ![](../../assets/ui/pack/icons/p_ag.support-beam-int-01c-3m.webp) |
| [ ] | Support beam int 01c 4m | post | 0.44 × 4 × 3.12 | `rpgpp-ag/rpgpp-ag-support-beam-int-01c-4m` | ![](../../assets/ui/pack/icons/p_ag.support-beam-int-01c-4m.webp) |
| [ ] | Tower 01 support 01a | on posts | 5.5 × 3.87 × 5 | `rpgpp-ag/rpgpp-ag-tower-01-support-01a` | ![](../../assets/ui/pack/icons/p_ag.tower-01-support-01a.webp) |
| [ ] | Tower 01 support 01b | on posts | 5.5 × 3.87 × 5 | `rpgpp-ag/rpgpp-ag-tower-01-support-01b` | ![](../../assets/ui/pack/icons/p_ag.tower-01-support-01b.webp) |
| [ ] | Wall connector between 01 3m | post | 0.34 × 3 × 0.6 | `rpgpp-ag/rpgpp-ag-wall-connector-between-01-3m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-between-01-3m.webp) |
| [ ] | Wall connector between 01 4m | post | 0.28 × 4 × 0.56 | `rpgpp-ag/rpgpp-ag-wall-connector-between-01-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-between-01-4m.webp) |
| [ ] | Wall connector bottom 01a 3m | beam | 3 × 0.2 × 0.6 | `rpgpp-ag/rpgpp-ag-wall-connector-bottom-01a-3m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-bottom-01a-3m.webp) |
| [ ] | Wall connector bottom 01b 3m | beam | 3 × 0.2 × 0.6 | `rpgpp-ag/rpgpp-ag-wall-connector-bottom-01b-3m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-bottom-01b-3m.webp) |
| [ ] | Wall connector bottom corner 01a | trim (on any face) | 0.72 × 0.3 × 0.72 | `rpgpp-ag/rpgpp-ag-wall-connector-bottom-corner-01a` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-bottom-corner-01a.webp) |
| [ ] | Wall connector bottom corner 01b | trim (on any face) | 1.3 × 0.3 × 1.3 | `rpgpp-ag/rpgpp-ag-wall-connector-bottom-corner-01b` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-bottom-corner-01b.webp) |
| [ ] | Wall connector corner 01a 1m | post | 0.62 × 1 × 0.64 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-01a-1m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-01a-1m.webp) |
| [ ] | Wall connector corner 01a 3m | post | 0.62 × 3 × 0.64 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-01a-3m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-01a-3m.webp) |
| [ ] | Wall connector corner 01a 4m | post | 0.62 × 4 × 0.64 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-01a-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-01a-4m.webp) |
| [ ] | Wall connector corner 01b 1m | post | 1.1 × 1 × 1.1 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-01b-1m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-01b-1m.webp) |
| [ ] | Wall connector corner 01b 3m | post | 1.1 × 3 × 1.1 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-01b-3m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-01b-3m.webp) |
| [ ] | Wall connector corner 01b 4m | post | 1.1 × 4 × 1.1 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-01b-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-01b-4m.webp) |
| [ ] | Wall connector corner 01c 3m | post | 0.62 × 3 × 0.62 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-01c-3m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-01c-3m.webp) |
| [ ] | Wall connector corner 01c 4m | post | 0.62 × 4 × 0.62 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-01c-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-01c-4m.webp) |
| [ ] | Wall connector corner 02 3m | post | 0.96 × 3 × 0.94 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-02-3m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-02-3m.webp) |
| [ ] | Wall connector corner 02a 4m | post | 0.96 × 4 × 0.94 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-02a-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-02a-4m.webp) |
| [ ] | Wall connector corner 03a 3m | post | 0.56 × 3 × 0.64 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-03a-3m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-03a-3m.webp) |
| [ ] | Wall connector corner 03a 4m | post | 0.58 × 4 × 0.64 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-03a-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-03a-4m.webp) |
| [ ] | Wall connector corner 03b 3m | post | 0.56 × 3 × 0.62 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-03b-3m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-03b-3m.webp) |
| [ ] | Wall connector corner 03b 4m | post | 0.58 × 4 × 0.62 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-03b-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-03b-4m.webp) |
| [ ] | Wall connector corner 04 3m | post | 0.74 × 3 × 0.76 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-04-3m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-04-3m.webp) |
| [ ] | Wall connector corner 04 4m | post | 0.74 × 4 × 0.76 | `rpgpp-ag/rpgpp-ag-wall-connector-corner-04-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-connector-corner-04-4m.webp) |
| [ ] | Wall platform 01 2×4 support 01a | on posts | 4 × 1.9 × 2 | `rpgpp-ag/rpgpp-ag-wall-platform-01-2x4-support-01a` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-01-2x4-support-01a.webp) |
| [ ] | Wall platform 01 4×4 support 01a | on posts | 4 × 3.9 × 2 | `rpgpp-ag/rpgpp-ag-wall-platform-01-4x4-support-01a` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-01-4x4-support-01a.webp) |
| [ ] | Wall platform 02 2×4 corner support 01a | on posts | 7 × 1.8 × 7 | `rpgpp-ag/rpgpp-ag-wall-platform-02-2x4-corner-support-01a` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-02-2x4-corner-support-01a.webp) |
| [ ] | Wall platform 02 2×4 support 01a | on posts | 5 × 1.8 × 3 | `rpgpp-ag/rpgpp-ag-wall-platform-02-2x4-support-01a` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-02-2x4-support-01a.webp) |
| [ ] | Wall platform 02 2×4 support 01b | on posts | 4 × 1.8 × 2.5 | `rpgpp-ag/rpgpp-ag-wall-platform-02-2x4-support-01b` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-02-2x4-support-01b.webp) |
| [ ] | Wall platform 02 4×4 corner support 01a | on posts | 7 × 3.87 × 7 | `rpgpp-ag/rpgpp-ag-wall-platform-02-4x4-corner-support-01a` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-02-4x4-corner-support-01a.webp) |
| [ ] | Wall platform 02 4×4 support 01a | on posts | 5 × 3.87 × 3 | `rpgpp-ag/rpgpp-ag-wall-platform-02-4x4-support-01a` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-02-4x4-support-01a.webp) |
| [ ] | Wall platform 02 4×4 support 01b | on posts | 5 × 3.87 × 3 | `rpgpp-ag/rpgpp-ag-wall-platform-02-4x4-support-01b` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-02-4x4-support-01b.webp) |
| [ ] | Wall platform 03 support 01a 4m  | on posts | 2.5 × 3.9 × 2 | `rpgpp-ag/rpgpp-ag-wall-platform-03-support-01a-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-03-support-01a-4m.webp) |
| [ ] | Wall platform 03 support 01a 6m  | on posts | 2.5 × 5.9 × 2 | `rpgpp-ag/rpgpp-ag-wall-platform-03-support-01a-6m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-03-support-01a-6m.webp) |
| [ ] | Wall platform 03 support 01b 4m | on posts | 3 × 3.9 × 3 | `rpgpp-ag/rpgpp-ag-wall-platform-03-support-01b-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-03-support-01b-4m.webp) |
| [ ] | Wall platform 03 support 01b 6m | on posts | 3 × 5.9 × 3 | `rpgpp-ag/rpgpp-ag-wall-platform-03-support-01b-6m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-03-support-01b-6m.webp) |

### RPGPP · Fences (26)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Fence 01 2×2m corner | trim (on any face) | 2.78 × 1.48 × 2.9 | `rpgpp-ag/rpgpp-ag-fence-01-2x2m-corner` | ![](../../assets/ui/pack/icons/p_ag.fence-01-2x2m-corner.webp) |
| [ ] | Fence 01a 2m | fence | 3 × 1.48 × 0.62 | `rpgpp-ag/rpgpp-ag-fence-01a-2m` | ![](../../assets/ui/pack/icons/p_ag.fence-01a-2m.webp) |
| [ ] | Fence 01b 2m | fence | 3 × 1.48 × 0.62 | `rpgpp-ag/rpgpp-ag-fence-01b-2m` | ![](../../assets/ui/pack/icons/p_ag.fence-01b-2m.webp) |
| [ ] | Fence 02a 2×2m corner | trim (on any face) | 4.4 × 1.74 × 4.22 | `rpgpp-ag/rpgpp-ag-fence-02a-2x2m-corner` | ![](../../assets/ui/pack/icons/p_ag.fence-02a-2x2m-corner.webp) |
| [ ] | Fence 02a 2m | fence | 4.5 × 1.74 × 0.58 | `rpgpp-ag/rpgpp-ag-fence-02a-2m` | ![](../../assets/ui/pack/icons/p_ag.fence-02a-2m.webp) |
| [ ] | Fence 02b 2×2m corner | trim (on any face) | 4.4 × 1.76 × 4.22 | `rpgpp-ag/rpgpp-ag-fence-02b-2x2m-corner` | ![](../../assets/ui/pack/icons/p_ag.fence-02b-2x2m-corner.webp) |
| [ ] | Fence 02b 2m | fence | 4.5 × 1.54 × 0.58 | `rpgpp-ag/rpgpp-ag-fence-02b-2m` | ![](../../assets/ui/pack/icons/p_ag.fence-02b-2m.webp) |
| [ ] | Fence 02c 2m | fence | 4.5 × 1.74 × 0.58 | `rpgpp-ag/rpgpp-ag-fence-02c-2m` | ![](../../assets/ui/pack/icons/p_ag.fence-02c-2m.webp) |
| [ ] | Fence 02d 2m | fence | 4.5 × 1.54 × 0.58 | `rpgpp-ag/rpgpp-ag-fence-02d-2m` | ![](../../assets/ui/pack/icons/p_ag.fence-02d-2m.webp) |
| [ ] | Gate small 01 | wall (doorway) | 7 × 5 × 4.36 | `rpgpp-ag/rpgpp-ag-gate-small-01` | ![](../../assets/ui/pack/icons/p_ag.gate-small-01.webp) |
| [ ] | Gate small 02 | wall (doorway) | 6.5 × 5.5 × 1.78 | `rpgpp-ag/rpgpp-ag-gate-small-02` | ![](../../assets/ui/pack/icons/p_ag.gate-small-02.webp) |
| [ ] | Gate small 03 | wall (doorway) | 7.5 × 5 × 1.1 | `rpgpp-ag/rpgpp-ag-gate-small-03` | ![](../../assets/ui/pack/icons/p_ag.gate-small-03.webp) |
| [ ] | Stockade 01a 2×4 | fence | 2 × 4.72 × 0.8 | `rpgpp-ag/rpgpp-ag-stockade-01a-2x4` | ![](../../assets/ui/pack/icons/p_ag.stockade-01a-2x4.webp) |
| [ ] | Stockade 01a 2×6 | fence | 2 × 6.92 × 0.8 | `rpgpp-ag/rpgpp-ag-stockade-01a-2x6` | ![](../../assets/ui/pack/icons/p_ag.stockade-01a-2x6.webp) |
| [ ] | Stockade 01a 2×6 corner | post | 2.74 × 7 × 2.76 | `rpgpp-ag/rpgpp-ag-stockade-01a-2x6-corner` | ![](../../assets/ui/pack/icons/p_ag.stockade-01a-2x6-corner.webp) |
| [ ] | Stockade 01b 2×4 | fence | 2 × 4.52 × 0.8 | `rpgpp-ag/rpgpp-ag-stockade-01b-2x4` | ![](../../assets/ui/pack/icons/p_ag.stockade-01b-2x4.webp) |
| [ ] | Stockade 01b 2×6 | fence | 2 × 6.72 × 0.8 | `rpgpp-ag/rpgpp-ag-stockade-01b-2x6` | ![](../../assets/ui/pack/icons/p_ag.stockade-01b-2x6.webp) |
| [ ] | Stockade 01c 2×4 | fence | 2 × 4.32 × 1 | `rpgpp-ag/rpgpp-ag-stockade-01c-2x4` | ![](../../assets/ui/pack/icons/p_ag.stockade-01c-2x4.webp) |
| [ ] | Stockade 01c 2×6 | fence | 2 × 6.52 × 1 | `rpgpp-ag/rpgpp-ag-stockade-01c-2x6` | ![](../../assets/ui/pack/icons/p_ag.stockade-01c-2x6.webp) |
| [ ] | Stockade 01d 4×4 | fence | 4 × 4.72 × 0.84 | `rpgpp-ag/rpgpp-ag-stockade-01d-4x4` | ![](../../assets/ui/pack/icons/p_ag.stockade-01d-4x4.webp) |
| [ ] | Stockade 01d 4×6 | fence | 4 × 6.72 × 0.84 | `rpgpp-ag/rpgpp-ag-stockade-01d-4x6` | ![](../../assets/ui/pack/icons/p_ag.stockade-01d-4x6.webp) |
| [ ] | Stockade 01e 4×6 | fence | 4 × 6.92 × 0.84 | `rpgpp-ag/rpgpp-ag-stockade-01e-4x6` | ![](../../assets/ui/pack/icons/p_ag.stockade-01e-4x6.webp) |
| [ ] | Stockade 01f 4×6 | fence | 4 × 6.92 × 0.84 | `rpgpp-ag/rpgpp-ag-stockade-01f-4x6` | ![](../../assets/ui/pack/icons/p_ag.stockade-01f-4x6.webp) |
| [ ] | Stockade 01g 4×6 | fence | 4 × 6.92 × 0.84 | `rpgpp-ag/rpgpp-ag-stockade-01g-4x6` | ![](../../assets/ui/pack/icons/p_ag.stockade-01g-4x6.webp) |
| [ ] | Stockade 01h 4×6 | fence | 4 × 5.32 × 0.84 | `rpgpp-ag/rpgpp-ag-stockade-01h-4x6` | ![](../../assets/ui/pack/icons/p_ag.stockade-01h-4x6.webp) |
| [ ] | Stockade end 01a | fence | 4 × 6.72 × 0.84 | `rpgpp-ag/rpgpp-ag-stockade-end-01a` | ![](../../assets/ui/pack/icons/p_ag.stockade-end-01a.webp) |

### RPGPP · Trims (60)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Stairs interior 01a 3m handrail 01 | trim (on any face) | 6.34 × 3.84 × 3.18 | `rpgpp-ag/rpgpp-ag-stairs-interior-01a-3m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01a-3m-handrail-01.webp) |
| [ ] | Stairs interior 01a 4m handrail 01 | trim (on any face) | 6.34 × 4.86 × 3.18 | `rpgpp-ag/rpgpp-ag-stairs-interior-01a-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01a-4m-handrail-01.webp) |
| [ ] | Stairs interior 01b 3m handrail 01 | trim (on any face) | 4.32 × 3.66 × 4.24 | `rpgpp-ag/rpgpp-ag-stairs-interior-01b-3m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01b-3m-handrail-01.webp) |
| [ ] | Stairs interior 01b 4m handrail 01 | trim (on any face) | 4.22 × 4.74 × 4.24 | `rpgpp-ag/rpgpp-ag-stairs-interior-01b-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01b-4m-handrail-01.webp) |
| [ ] | Stairs interior 01c 3m handrail 01 | trim (on any face) | 3.36 × 3.87 × 4.2 | `rpgpp-ag/rpgpp-ag-stairs-interior-01c-3m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01c-3m-handrail-01.webp) |
| [ ] | Stairs interior 01c 4m handrail 01 | trim (on any face) | 3.36 × 4.87 × 4.2 | `rpgpp-ag/rpgpp-ag-stairs-interior-01c-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01c-4m-handrail-01.webp) |
| [ ] | Stairs interior 01d 3m handrail 01 | trim (on any face) | 4.28 × 3.87 × 2.38 | `rpgpp-ag/rpgpp-ag-stairs-interior-01d-3m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01d-3m-handrail-01.webp) |
| [ ] | Stairs interior 01d 4m handrail 01 | trim (on any face) | 4.22 × 4.74 × 2.3 | `rpgpp-ag/rpgpp-ag-stairs-interior-01d-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01d-4m-handrail-01.webp) |
| [ ] | Stairs interior 01e 3m handrail 01 | trim (on any face) | 4.3 × 3.67 × 4.22 | `rpgpp-ag/rpgpp-ag-stairs-interior-01e-3m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01e-3m-handrail-01.webp) |
| [ ] | Stairs interior 01e 4m handrail 01 | trim (on any face) | 4.3 × 4.74 × 4.12 | `rpgpp-ag/rpgpp-ag-stairs-interior-01e-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-01e-4m-handrail-01.webp) |
| [ ] | Stairs interior 02a 3m handrail 01 | trim (on any face) | 6.64 × 4.48 × 3.38 | `rpgpp-ag/rpgpp-ag-stairs-interior-02a-3m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02a-3m-handrail-01.webp) |
| [ ] | Stairs interior 02a 3m handrail 02 | trim (on any face) | 6.64 × 4.51 × 3.38 | `rpgpp-ag/rpgpp-ag-stairs-interior-02a-3m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02a-3m-handrail-02.webp) |
| [ ] | Stairs interior 02a 4m handrail 01 | trim (on any face) | 6.64 × 5.42 × 3.38 | `rpgpp-ag/rpgpp-ag-stairs-interior-02a-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02a-4m-handrail-01.webp) |
| [ ] | Stairs interior 02a 4m handrail 02 | trim (on any face) | 6.64 × 5.42 × 3.38 | `rpgpp-ag/rpgpp-ag-stairs-interior-02a-4m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02a-4m-handrail-02.webp) |
| [ ] | Stairs interior 02b 3m handrail 01 | trim (on any face) | 4.4 × 4.42 × 4.52 | `rpgpp-ag/rpgpp-ag-stairs-interior-02b-3m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02b-3m-handrail-01.webp) |
| [ ] | Stairs interior 02b 3m handrail 02 | trim (on any face) | 4.4 × 4.42 × 4.52 | `rpgpp-ag/rpgpp-ag-stairs-interior-02b-3m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02b-3m-handrail-02.webp) |
| [ ] | Stairs interior 02b 4m handrail 01 | trim (on any face) | 4.4 × 5.46 × 4.52 | `rpgpp-ag/rpgpp-ag-stairs-interior-02b-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02b-4m-handrail-01.webp) |
| [ ] | Stairs interior 02b 4m handrail 02 | trim (on any face) | 4.4 × 5.46 × 4.52 | `rpgpp-ag/rpgpp-ag-stairs-interior-02b-4m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02b-4m-handrail-02.webp) |
| [ ] | Stairs interior 02c 3m handrail 01 | trim (on any face) | 3.36 × 4.42 × 4.46 | `rpgpp-ag/rpgpp-ag-stairs-interior-02c-3m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02c-3m-handrail-01.webp) |
| [ ] | Stairs interior 02c 3m handrail 02 | trim (on any face) | 3.36 × 4.42 × 4.46 | `rpgpp-ag/rpgpp-ag-stairs-interior-02c-3m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02c-3m-handrail-02.webp) |
| [ ] | Stairs interior 02c 4m handrail 01 | trim (on any face) | 3.36 × 5.32 × 4.46 | `rpgpp-ag/rpgpp-ag-stairs-interior-02c-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02c-4m-handrail-01.webp) |
| [ ] | Stairs interior 02c 4m handrail 02 | trim (on any face) | 3.36 × 5.32 × 4.46 | `rpgpp-ag/rpgpp-ag-stairs-interior-02c-4m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02c-4m-handrail-02.webp) |
| [ ] | Stairs interior 02d 3m handrail 01 | trim (on any face) | 4.48 × 4.4 × 4.4 | `rpgpp-ag/rpgpp-ag-stairs-interior-02d-3m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02d-3m-handrail-01.webp) |
| [ ] | Stairs interior 02d 3m handrail 02 | trim (on any face) | 4.52 × 4.41 × 4.4 | `rpgpp-ag/rpgpp-ag-stairs-interior-02d-3m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02d-3m-handrail-02.webp) |
| [ ] | Stairs interior 02d 4m handrail 01 | trim (on any face) | 4.52 × 5.44 × 4.4 | `rpgpp-ag/rpgpp-ag-stairs-interior-02d-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02d-4m-handrail-01.webp) |
| [ ] | Stairs interior 02d 4m handrail 02 | trim (on any face) | 4.52 × 5.38 × 4.4 | `rpgpp-ag/rpgpp-ag-stairs-interior-02d-4m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02d-4m-handrail-02.webp) |
| [ ] | Stairs interior 02e 3m handrail 01 | trim (on any face) | 4.48 × 4.4 × 2.34 | `rpgpp-ag/rpgpp-ag-stairs-interior-02e-3m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02e-3m-handrail-01.webp) |
| [ ] | Stairs interior 02e 3m handrail 02 | trim (on any face) | 4.52 × 4.41 × 2.34 | `rpgpp-ag/rpgpp-ag-stairs-interior-02e-3m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02e-3m-handrail-02.webp) |
| [ ] | Stairs interior 02e 4m handrail 01 | trim (on any face) | 4.46 × 5.26 × 2.34 | `rpgpp-ag/rpgpp-ag-stairs-interior-02e-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02e-4m-handrail-01.webp) |
| [ ] | Stairs interior 02e 4m handrail 02 | trim (on any face) | 4.46 × 5.22 × 2.34 | `rpgpp-ag/rpgpp-ag-stairs-interior-02e-4m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.stairs-interior-02e-4m-handrail-02.webp) |
| [ ] | Wall platform 01 handrail 01 4m | trim (on any face) | 3.9 × 0.89 × 0.16 | `rpgpp-ag/rpgpp-ag-wall-platform-01-handrail-01-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-01-handrail-01-4m.webp) |
| [ ] | Wall platform 01 handrail 02 4m | trim (on any face) | 3.62 × 1.48 × 0.6 | `rpgpp-ag/rpgpp-ag-wall-platform-01-handrail-02-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-01-handrail-02-4m.webp) |
| [ ] | Wall platform 02 handrail 01 corner | trim (on any face) | 4.4 × 1.74 × 4.22 | `rpgpp-ag/rpgpp-ag-wall-platform-02-handrail-01-corner` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-02-handrail-01-corner.webp) |
| [ ] | Wall platform 02 handrail 01a 4m | trim (on any face) | 4.4 × 1.74 × 0.58 | `rpgpp-ag/rpgpp-ag-wall-platform-02-handrail-01a-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-02-handrail-01a-4m.webp) |
| [ ] | Wall platform 02 handrail 01b 4m | trim (on any face) | 4.4 × 1.54 × 0.58 | `rpgpp-ag/rpgpp-ag-wall-platform-02-handrail-01b-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-02-handrail-01b-4m.webp) |
| [ ] | Wall platform 02 handrail 02 corner | trim (on any face) | 4.4 × 1.76 × 4.22 | `rpgpp-ag/rpgpp-ag-wall-platform-02-handrail-02-corner` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-02-handrail-02-corner.webp) |
| [ ] | Wall platform 02 handrail 02a 4m | trim (on any face) | 4.4 × 1.74 × 0.58 | `rpgpp-ag/rpgpp-ag-wall-platform-02-handrail-02a-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-02-handrail-02a-4m.webp) |
| [ ] | Wall platform 02 handrail 02b 4m | trim (on any face) | 4.4 × 1.54 × 0.58 | `rpgpp-ag/rpgpp-ag-wall-platform-02-handrail-02b-4m` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-02-handrail-02b-4m.webp) |
| [ ] | Wall platform 03 handrail 01a | trim (on any face) | 2.48 × 1.03 × 2.38 | `rpgpp-ag/rpgpp-ag-wall-platform-03-handrail-01a` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-03-handrail-01a.webp) |
| [ ] | Wall platform 03 handrail 01b | trim (on any face) | 2.48 × 0.91 × 2.24 | `rpgpp-ag/rpgpp-ag-wall-platform-03-handrail-01b` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-03-handrail-01b.webp) |
| [ ] | Wall platform 03 handrail 01c | trim (on any face) | 2.48 × 1.03 × 2.38 | `rpgpp-ag/rpgpp-ag-wall-platform-03-handrail-01c` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-03-handrail-01c.webp) |
| [ ] | Wall platform 03 handrail 02a | trim (on any face) | 2.8 × 1.48 × 3.04 | `rpgpp-ag/rpgpp-ag-wall-platform-03-handrail-02a` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-03-handrail-02a.webp) |
| [ ] | Wall platform 03 handrail 02b | trim (on any face) | 2.8 × 1.48 × 3.04 | `rpgpp-ag/rpgpp-ag-wall-platform-03-handrail-02b` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-03-handrail-02b.webp) |
| [ ] | Wall platform 03 handrail 02c | trim (on any face) | 2.78 × 1.48 × 2.9 | `rpgpp-ag/rpgpp-ag-wall-platform-03-handrail-02c` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-03-handrail-02c.webp) |
| [ ] | Wall platform stairs 01a 2m handrail 01 | trim (on any face) | 2.66 × 2.36 × 0.16 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-01a-2m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-01a-2m-handrail-01.webp) |
| [ ] | Wall platform stairs 01a 2m handrail 02 | trim (on any face) | 2.84 × 2.83 × 0.6 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-01a-2m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-01a-2m-handrail-02.webp) |
| [ ] | Wall platform stairs 01a 4m handrail 01 | trim (on any face) | 6.02 × 4.63 × 0.16 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-01a-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-01a-4m-handrail-01.webp) |
| [ ] | Wall platform stairs 01a 4m handrail 02 | trim (on any face) | 5.6 × 4.73 × 0.6 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-01a-4m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-01a-4m-handrail-02.webp) |
| [ ] | Wall platform stairs 01b 4m handrail 01 | trim (on any face) | 3.18 × 4.66 × 3.32 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-01b-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-01b-4m-handrail-01.webp) |
| [ ] | Wall platform stairs 01b 4m handrail 02 | trim (on any face) | 3.4 × 5.14 × 3.48 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-01b-4m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-01b-4m-handrail-02.webp) |
| [ ] | Wall platform stairs 01c 4m handrail 01 | trim (on any face) | 8.12 × 4.66 × 0.2 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-01c-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-01c-4m-handrail-01.webp) |
| [ ] | Wall platform stairs 01c 4m handrail 02 | trim (on any face) | 7.84 × 4.85 × 0.68 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-01c-4m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-01c-4m-handrail-02.webp) |
| [ ] | Wall platform stairs 02a 2m handrail 01 | trim (on any face) | 3.22 × 3.28 × 0.6 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-02a-2m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-02a-2m-handrail-01.webp) |
| [ ] | Wall platform stairs 02a 2m handrail 02 | trim (on any face) | 3.22 × 3.28 × 0.6 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-02a-2m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-02a-2m-handrail-02.webp) |
| [ ] | Wall platform stairs 02a 4m handrail 01 | trim (on any face) | 6.22 × 5.28 × 0.6 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-02a-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-02a-4m-handrail-01.webp) |
| [ ] | Wall platform stairs 02a 4m handrail 02 | trim (on any face) | 6.22 × 5.28 × 0.6 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-02a-4m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-02a-4m-handrail-02.webp) |
| [ ] | Wall platform stairs 02b 4m handrail 01 | trim (on any face) | 3.22 × 5.32 × 3.36 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-02b-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-02b-4m-handrail-01.webp) |
| [ ] | Wall platform stairs 02b 4m handrail 02 | trim (on any face) | 3.22 × 5.32 × 3.36 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-02b-4m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-02b-4m-handrail-02.webp) |
| [ ] | Wall platform stairs 02c 4m handrail 01 | trim (on any face) | 8.36 × 5.26 × 0.6 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-02c-4m-handrail-01` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-02c-4m-handrail-01.webp) |
| [ ] | Wall platform stairs 02c 4m handrail 02 | trim (on any face) | 8.36 × 5.26 × 0.6 | `rpgpp-ag/rpgpp-ag-wall-platform-stairs-02c-4m-handrail-02` | ![](../../assets/ui/pack/icons/p_ag.wall-platform-stairs-02c-4m-handrail-02.webp) |

## Vikings (72)

### Vikings · Floors (8)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Dock 01 | on posts | 5 × 5.31 × 6 | `polygonvikings/sm-prop-dock-01` | ![](../../assets/ui/pack/icons/p_vk.dock-01.webp) |
| [ ] | Dock 01 (snow) | on posts | 5 × 5.39 × 6 | `polygonvikings/sm-prop-dock-01-snow` | ![](../../assets/ui/pack/icons/p_vk.dock-01-snow.webp) |
| [ ] | Dock 02 | on posts | 5 × 5.31 × 6 | `polygonvikings/sm-prop-dock-02` | ![](../../assets/ui/pack/icons/p_vk.dock-02.webp) |
| [ ] | Dock 02 (snow) | on posts | 5 × 5.38 × 6 | `polygonvikings/sm-prop-dock-02-snow` | ![](../../assets/ui/pack/icons/p_vk.dock-02-snow.webp) |
| [ ] | Dock 03 | floor | 4 × 0.33 × 4 | `polygonvikings/sm-prop-dock-03` | ![](../../assets/ui/pack/icons/p_vk.dock-03.webp) |
| [ ] | Dock 03 (snow) | floor | 4 × 0.39 × 4 | `polygonvikings/sm-prop-dock-03-snow` | ![](../../assets/ui/pack/icons/p_vk.dock-03-snow.webp) |
| [ ] | Fence Platform 01 | on posts | 3 × 2.75 × 5.5 | `polygonvikings/sm-prop-fence-platform-01` | ![](../../assets/ui/pack/icons/p_vk.fence-platform-01.webp) |
| [ ] | Fence Platform 01 (snow) | on posts | 3 × 2.83 × 5.5 | `polygonvikings/sm-prop-fence-platform-01-snow` | ![](../../assets/ui/pack/icons/p_vk.fence-platform-01-snow.webp) |

### Vikings · Roofs (8)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Roof 01 | ridge (both slopes) | 6 × 3.7 × 6 | `polygonvikings/sm-bld-roof-01` | ![](../../assets/ui/pack/icons/p_vk.roof-01.webp) |
| [ ] | Roof 01 (snow) | ridge (both slopes) | 6 × 3.78 × 6 | `polygonvikings/sm-bld-roof-01-snow` | ![](../../assets/ui/pack/icons/p_vk.roof-01-snow.webp) |
| [ ] | Roof 02 | ridge (both slopes) | 9 × 6.22 × 6 | `polygonvikings/sm-bld-roof-02` | ![](../../assets/ui/pack/icons/p_vk.roof-02.webp) |
| [ ] | Roof 02 (snow) | ridge (both slopes) | 9 × 6.31 × 6 | `polygonvikings/sm-bld-roof-02-snow` | ![](../../assets/ui/pack/icons/p_vk.roof-02-snow.webp) |
| [ ] | Roof Long 01 | ridge (both slopes) | 9 × 3.7 × 6 | `polygonvikings/sm-bld-roof-long-01` | ![](../../assets/ui/pack/icons/p_vk.roof-long-01.webp) |
| [ ] | Roof Long 01 (snow) | ridge (both slopes) | 9 × 3.79 × 6 | `polygonvikings/sm-bld-roof-long-01-snow` | ![](../../assets/ui/pack/icons/p_vk.roof-long-01-snow.webp) |
| [ ] | Stall Cover 01 | on posts | 4 × 4.17 × 2.5 | `polygonvikings/sm-bld-stall-cover-01` | ![](../../assets/ui/pack/icons/p_vk.stall-cover-01.webp) |
| [ ] | Stall Cover 01 (snow) | on posts | 4 × 4.21 × 3 | `polygonvikings/sm-bld-stall-cover-01-snow` | ![](../../assets/ui/pack/icons/p_vk.stall-cover-01-snow.webp) |

### Vikings · Doors (4)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Archway 01 | wall (doorway) | 4 × 3.5 × 0.36 | `polygonvikings/sm-prop-archway-01` | ![](../../assets/ui/pack/icons/p_vk.archway-01.webp) |
| [ ] | Archway 01 (snow) | wall (doorway) | 4 × 3.5 × 0.44 | `polygonvikings/sm-prop-archway-01-snow` | ![](../../assets/ui/pack/icons/p_vk.archway-01-snow.webp) |
| [ ] | Door 01 | door | 2.3 × 2.85 × 0.46 | `polygonvikings/sm-bld-door-01` | ![](../../assets/ui/pack/icons/p_vk.door-01.webp) |
| [ ] | Door 01 (snow) | door | 2.3 × 2.85 × 0.48 | `polygonvikings/sm-bld-door-01-snow` | ![](../../assets/ui/pack/icons/p_vk.door-01-snow.webp) |

### Vikings · Windows (4)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Roof Window 01 | trim (on any face) | 3.64 × 3.36 × 4.98 | `polygonvikings/sm-bld-roof-window-01` | ![](../../assets/ui/pack/icons/p_vk.roof-window-01.webp) |
| [ ] | Roof Window 01 (snow) | trim (on any face) | 3.7 × 3.42 × 5 | `polygonvikings/sm-bld-roof-window-01-snow` | ![](../../assets/ui/pack/icons/p_vk.roof-window-01-snow.webp) |
| [ ] | Window 01 | trim (on any face) | 1.32 × 1.35 × 0.58 | `polygonvikings/sm-bld-window-01` | ![](../../assets/ui/pack/icons/p_vk.window-01.webp) |
| [ ] | Window 01 (snow) | trim (on any face) | 1.32 × 1.38 × 0.58 | `polygonvikings/sm-bld-window-01-snow` | ![](../../assets/ui/pack/icons/p_vk.window-01-snow.webp) |

### Vikings · Stairs (4)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Ladder 01 | ladder (no climbing) | 1.14 × 6 × 0.56 | `polygonvikings/sm-prop-ladder-01` | ![](../../assets/ui/pack/icons/p_vk.ladder-01.webp) |
| [ ] | Ladder 01 (snow) | ladder (no climbing) | 1.14 × 6 × 0.56 | `polygonvikings/sm-prop-ladder-01-snow` | ![](../../assets/ui/pack/icons/p_vk.ladder-01-snow.webp) |
| [ ] | Ladder 02 | ladder (no climbing) | 0.98 × 3.5 × 0.48 | `polygonvikings/sm-prop-ladder-02` | ![](../../assets/ui/pack/icons/p_vk.ladder-02.webp) |
| [ ] | Ladder 02 (snow) | ladder (no climbing) | 0.98 × 3.5 × 0.48 | `polygonvikings/sm-prop-ladder-02-snow` | ![](../../assets/ui/pack/icons/p_vk.ladder-02-snow.webp) |

### Vikings · Beams (12)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Dock Pole 01 | post | 0.6 × 5.5 × 0.56 | `polygonvikings/sm-prop-dock-pole-01` | ![](../../assets/ui/pack/icons/p_vk.dock-pole-01.webp) |
| [ ] | Dock Pole 01 (snow) | post | 0.62 × 5.5 × 0.6 | `polygonvikings/sm-prop-dock-pole-01-snow` | ![](../../assets/ui/pack/icons/p_vk.dock-pole-01-snow.webp) |
| [ ] | Dock Pole 02 | post | 0.7 × 5.5 × 0.7 | `polygonvikings/sm-prop-dock-pole-02` | ![](../../assets/ui/pack/icons/p_vk.dock-pole-02.webp) |
| [ ] | Dock Pole 02 (snow) | post | 0.74 × 5.5 × 0.74 | `polygonvikings/sm-prop-dock-pole-02-snow` | ![](../../assets/ui/pack/icons/p_vk.dock-pole-02-snow.webp) |
| [ ] | Fence Wood Pole 01 | post | 0.82 × 4 × 0.74 | `polygonvikings/sm-prop-fence-wood-pole-01` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-pole-01.webp) |
| [ ] | Fence Wood Pole 01 (snow) | post | 0.82 × 4 × 0.74 | `polygonvikings/sm-prop-fence-wood-pole-01-snow` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-pole-01-snow.webp) |
| [ ] | Fence Wood Pole 02 | post | 0.42 × 5 × 0.48 | `polygonvikings/sm-prop-fence-wood-pole-02` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-pole-02.webp) |
| [ ] | Fence Wood Pole 02 (snow) | post | 0.44 × 5 × 0.5 | `polygonvikings/sm-prop-fence-wood-pole-02-snow` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-pole-02-snow.webp) |
| [ ] | Fence Wood Pole 03 | post | 0.56 × 4 × 0.66 | `polygonvikings/sm-prop-fence-wood-pole-03` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-pole-03.webp) |
| [ ] | Fence Wood Pole 03 (snow) | post | 0.6 × 4 × 0.68 | `polygonvikings/sm-prop-fence-wood-pole-03-snow` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-pole-03-snow.webp) |
| [ ] | Fence Wood Pole 04 | post | 0.82 × 5.5 × 0.84 | `polygonvikings/sm-prop-fence-wood-pole-04` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-pole-04.webp) |
| [ ] | Fence Wood Pole 04 (snow) | post | 0.82 × 5.5 × 0.84 | `polygonvikings/sm-prop-fence-wood-pole-04-snow` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-pole-04-snow.webp) |

### Vikings · Fences (12)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Fence Stick 01 | fence | 4 × 1.41 × 0.28 | `polygonvikings/sm-prop-fence-stick-01` | ![](../../assets/ui/pack/icons/p_vk.fence-stick-01.webp) |
| [ ] | Fence Stick 01 (snow) | fence | 4 × 1.45 × 0.28 | `polygonvikings/sm-prop-fence-stick-01-snow` | ![](../../assets/ui/pack/icons/p_vk.fence-stick-01-snow.webp) |
| [ ] | Fence Wood 01 | fence | 2.5 × 2.03 × 0.28 | `polygonvikings/sm-prop-fence-wood-01` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-01.webp) |
| [ ] | Fence Wood 01 (snow) | fence | 2.5 × 2.07 × 0.28 | `polygonvikings/sm-prop-fence-wood-01-snow` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-01-snow.webp) |
| [ ] | Fence Wood 02 | fence | 2.5 × 2 × 0.28 | `polygonvikings/sm-prop-fence-wood-02` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-02.webp) |
| [ ] | Fence Wood 02 (snow) | fence | 2.5 × 2.05 × 0.28 | `polygonvikings/sm-prop-fence-wood-02-snow` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-02-snow.webp) |
| [ ] | Fence Wood 03 | fence | 2 × 2.03 × 0.28 | `polygonvikings/sm-prop-fence-wood-03` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-03.webp) |
| [ ] | Fence Wood 03 (snow) | fence | 2 × 2.06 × 0.28 | `polygonvikings/sm-prop-fence-wood-03-snow` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-03-snow.webp) |
| [ ] | Fence Wood Large 01 | fence | 4.5 × 4.33 × 0.76 | `polygonvikings/sm-prop-fence-wood-large-01` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-large-01.webp) |
| [ ] | Fence Wood Large 01 (snow) | fence | 4.5 × 4.41 × 0.76 | `polygonvikings/sm-prop-fence-wood-large-01-snow` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-large-01-snow.webp) |
| [ ] | Fence Wood Large 02 | fence | 2 × 4.24 × 0.66 | `polygonvikings/sm-prop-fence-wood-large-02` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-large-02.webp) |
| [ ] | Fence Wood Large 02 (snow) | fence | 2 × 4.32 × 0.68 | `polygonvikings/sm-prop-fence-wood-large-02-snow` | ![](../../assets/ui/pack/icons/p_vk.fence-wood-large-02-snow.webp) |

### Vikings · Big (20)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Base 01 | block | 6 × 2.86 × 6 | `polygonvikings/sm-bld-base-01` | ![](../../assets/ui/pack/icons/p_vk.base-01.webp) |
| [ ] | Base 01 (snow) | block | 6 × 2.94 × 6 | `polygonvikings/sm-bld-base-01-snow` | ![](../../assets/ui/pack/icons/p_vk.base-01-snow.webp) |
| [ ] | Base 02 | block | 6 × 2.74 × 6 | `polygonvikings/sm-bld-base-02` | ![](../../assets/ui/pack/icons/p_vk.base-02.webp) |
| [ ] | Base 02 (snow) | block | 6 × 2.8 × 6 | `polygonvikings/sm-bld-base-02-snow` | ![](../../assets/ui/pack/icons/p_vk.base-02-snow.webp) |
| [ ] | Base Door 01 | block | 6 × 2.99 × 6 | `polygonvikings/sm-bld-base-door-01` | ![](../../assets/ui/pack/icons/p_vk.base-door-01.webp) |
| [ ] | Base Door 01 (snow) | block | 6 × 3.12 × 6 | `polygonvikings/sm-bld-base-door-01-snow` | ![](../../assets/ui/pack/icons/p_vk.base-door-01-snow.webp) |
| [ ] | Base Door 02 | block | 6 × 2.72 × 6 | `polygonvikings/sm-bld-base-door-02` | ![](../../assets/ui/pack/icons/p_vk.base-door-02.webp) |
| [ ] | Base Door 02 (snow) | block | 6 × 2.79 × 6 | `polygonvikings/sm-bld-base-door-02-snow` | ![](../../assets/ui/pack/icons/p_vk.base-door-02-snow.webp) |
| [ ] | Base Long 01 | block | 6 × 2.86 × 9 | `polygonvikings/sm-bld-base-long-01` | ![](../../assets/ui/pack/icons/p_vk.base-long-01.webp) |
| [ ] | Base Long 01 (snow) | block | 6 × 2.94 × 9 | `polygonvikings/sm-bld-base-long-01-snow` | ![](../../assets/ui/pack/icons/p_vk.base-long-01-snow.webp) |
| [ ] | Base Long 02 | block | 6 × 2.74 × 7.5 | `polygonvikings/sm-bld-base-long-02` | ![](../../assets/ui/pack/icons/p_vk.base-long-02.webp) |
| [ ] | Base Long 02 (snow) | block | 6 × 2.79 × 7.5 | `polygonvikings/sm-bld-base-long-02-snow` | ![](../../assets/ui/pack/icons/p_vk.base-long-02-snow.webp) |
| [ ] | Base Long Door 01 | block | 6 × 2.99 × 9 | `polygonvikings/sm-bld-base-long-door-01` | ![](../../assets/ui/pack/icons/p_vk.base-long-door-01.webp) |
| [ ] | Base Long Door 01 (snow) | block | 6 × 3.12 × 9 | `polygonvikings/sm-bld-base-long-door-01-snow` | ![](../../assets/ui/pack/icons/p_vk.base-long-door-01-snow.webp) |
| [ ] | Base Long Door 02 | block | 6 × 2.71 × 7.5 | `polygonvikings/sm-bld-base-long-door-02` | ![](../../assets/ui/pack/icons/p_vk.base-long-door-02.webp) |
| [ ] | Base Long Door 02 (snow) | block | 6 × 2.77 × 7.5 | `polygonvikings/sm-bld-base-long-door-02-snow` | ![](../../assets/ui/pack/icons/p_vk.base-long-door-02-snow.webp) |
| [ ] | Guard Tower 01 | block | 4.5 × 9.6 × 4.5 | `polygonvikings/sm-bld-guard-tower-01` | ![](../../assets/ui/pack/icons/p_vk.guard-tower-01.webp) |
| [ ] | Guard Tower 01 (snow) | block | 4.5 × 9.62 × 4.5 | `polygonvikings/sm-bld-guard-tower-01-snow` | ![](../../assets/ui/pack/icons/p_vk.guard-tower-01-snow.webp) |
| [ ] | Tower 01 | block | 3.5 × 6.78 × 4 | `polygonvikings/sm-bld-tower-01` | ![](../../assets/ui/pack/icons/p_vk.tower-01.webp) |
| [ ] | Tower 01 (snow) | block | 3.5 × 6.83 × 4 | `polygonvikings/sm-bld-tower-01-snow` | ![](../../assets/ui/pack/icons/p_vk.tower-01-snow.webp) |

## Empire (250)

### Empire · Walls (50)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Base Wall 01 | wall | 3 × 3 × 0.28 | `polygonancientempire/sm-bld-base-wall-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-01.webp) |
| [ ] | Base Wall Circle 01 | wall (doorway) | 3 × 3 × 0.42 | `polygonancientempire/sm-bld-base-wall-circle-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-circle-01.webp) |
| [ ] | Base Wall Door 01 | wall (doorway) | 3 × 3 × 0.34 | `polygonancientempire/sm-bld-base-wall-door-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-door-01.webp) |
| [ ] | Base Wall Door Double 01 | wall (doorway) | 3 × 3 × 0.34 | `polygonancientempire/sm-bld-base-wall-door-double-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-door-double-01.webp) |
| [ ] | Base Wall Door Double Large 01 | wall (doorway) | 3 × 3 × 0.34 | `polygonancientempire/sm-bld-base-wall-door-double-large-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-door-double-large-01.webp) |
| [ ] | Base Wall Door Large 01 | wall (doorway) | 3 × 3 × 0.34 | `polygonancientempire/sm-bld-base-wall-door-large-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-door-large-01.webp) |
| [ ] | Base Wall Glass 01 | wall | 3 × 3 × 0.32 | `polygonancientempire/sm-bld-base-wall-glass-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-glass-01.webp) |
| [ ] | Base Wall Glass Blank 01 | wall | 3 × 3 × 0.3 | `polygonancientempire/sm-bld-base-wall-glass-blank-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-glass-blank-01.webp) |
| [ ] | Base Wall Glass Blank Half 01 | wall | 1.5 × 3 × 0.3 | `polygonancientempire/sm-bld-base-wall-glass-blank-half-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-glass-blank-half-01.webp) |
| [ ] | Base Wall Glass Door 01 | wall (doorway) | 3 × 3 × 0.34 | `polygonancientempire/sm-bld-base-wall-glass-door-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-glass-door-01.webp) |
| [ ] | Base Wall Glass Half 01 | wall | 1.5 × 3 × 0.32 | `polygonancientempire/sm-bld-base-wall-glass-half-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-glass-half-01.webp) |
| [ ] | Base Wall Half 01 | wall | 3 × 1.5 × 0.28 | `polygonancientempire/sm-bld-base-wall-half-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-half-01.webp) |
| [ ] | Base Wall Half 02 | wall | 1.5 × 3 × 0.28 | `polygonancientempire/sm-bld-base-wall-half-02` | ![](../../assets/ui/pack/icons/p_ae.base-wall-half-02.webp) |
| [ ] | Base Wall Quarter 01 | wall | 1.5 × 1.5 × 0.28 | `polygonancientempire/sm-bld-base-wall-quarter-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-quarter-01.webp) |
| [ ] | Base Wall Window 01 | wall | 3 × 3 × 0.3 | `polygonancientempire/sm-bld-base-wall-window-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-window-01.webp) |
| [ ] | Base Wall Window Double 01 | wall | 3 × 3 × 0.3 | `polygonancientempire/sm-bld-base-wall-window-double-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-window-double-01.webp) |
| [ ] | Base Wall Window Low 01 | wall | 3 × 3 × 0.3 | `polygonancientempire/sm-bld-base-wall-window-low-01` | ![](../../assets/ui/pack/icons/p_ae.base-wall-window-low-01.webp) |
| [ ] | Bath Edge 01 | wall | 3 × 1.5 × 0.58 | `polygonancientempire/sm-bld-bath-edge-01` | ![](../../assets/ui/pack/icons/p_ae.bath-edge-01.webp) |
| [ ] | Trellis 01 | wall | 3 × 3 × 0.14 | `polygonancientempire/sm-bld-trellis-01` | ![](../../assets/ui/pack/icons/p_ae.trellis-01.webp) |
| [ ] | Trellis 02 | wall | 3 × 0.9 × 0.14 | `polygonancientempire/sm-bld-trellis-02` | ![](../../assets/ui/pack/icons/p_ae.trellis-02.webp) |
| [ ] | Wall 01 | wall | 3 × 3 × 0.28 | `polygonancientempire/sm-bld-wall-01` | ![](../../assets/ui/pack/icons/p_ae.wall-01.webp) |
| [ ] | Wall Alcove 01 | wall | 3 × 3 × 1.1 | `polygonancientempire/sm-bld-wall-alcove-01` | ![](../../assets/ui/pack/icons/p_ae.wall-alcove-01.webp) |
| [ ] | Wall Alcove Large 01 | wall | 3 × 4.5 × 1.46 | `polygonancientempire/sm-bld-wall-alcove-large-01` | ![](../../assets/ui/pack/icons/p_ae.wall-alcove-large-01.webp) |
| [ ] | Wall Balcony 02 | wall | 3 × 3 × 0.28 | `polygonancientempire/sm-bld-wall-balcony-02` | ![](../../assets/ui/pack/icons/p_ae.wall-balcony-02.webp) |
| [ ] | Wall Balcony 03 | wall | 3 × 1 × 0.36 | `polygonancientempire/sm-bld-wall-balcony-03` | ![](../../assets/ui/pack/icons/p_ae.wall-balcony-03.webp) |
| [ ] | Wall Balcony 04 | wall | 3 × 1 × 0.28 | `polygonancientempire/sm-bld-wall-balcony-04` | ![](../../assets/ui/pack/icons/p_ae.wall-balcony-04.webp) |
| [ ] | Wall Balcony 05 | wall | 3 × 1 × 0.54 | `polygonancientempire/sm-bld-wall-balcony-05` | ![](../../assets/ui/pack/icons/p_ae.wall-balcony-05.webp) |
| [ ] | Wall Balcony 06 | wall | 3 × 1 × 0.7 | `polygonancientempire/sm-bld-wall-balcony-06` | ![](../../assets/ui/pack/icons/p_ae.wall-balcony-06.webp) |
| [ ] | Wall Door 01 | wall (doorway) | 3 × 3 × 0.72 | `polygonancientempire/sm-bld-wall-door-01` | ![](../../assets/ui/pack/icons/p_ae.wall-door-01.webp) |
| [ ] | Wall Door 02 | wall (doorway) | 3 × 3 × 0.6 | `polygonancientempire/sm-bld-wall-door-02` | ![](../../assets/ui/pack/icons/p_ae.wall-door-02.webp) |
| [ ] | Wall Door 03 | wall (doorway) | 3 × 3 × 0.68 | `polygonancientempire/sm-bld-wall-door-03` | ![](../../assets/ui/pack/icons/p_ae.wall-door-03.webp) |
| [ ] | Wall Door 04 | wall (doorway) | 3 × 3 × 0.28 | `polygonancientempire/sm-bld-wall-door-04` | ![](../../assets/ui/pack/icons/p_ae.wall-door-04.webp) |
| [ ] | Wall Door Double 01 | wall (doorway) | 3 × 3 × 0.56 | `polygonancientempire/sm-bld-wall-door-double-01` | ![](../../assets/ui/pack/icons/p_ae.wall-door-double-01.webp) |
| [ ] | Wall Door Double 02 | wall (doorway) | 3 × 3 × 0.62 | `polygonancientempire/sm-bld-wall-door-double-02` | ![](../../assets/ui/pack/icons/p_ae.wall-door-double-02.webp) |
| [ ] | Wall Door Double 03 | wall (doorway) | 3 × 3 × 0.28 | `polygonancientempire/sm-bld-wall-door-double-03` | ![](../../assets/ui/pack/icons/p_ae.wall-door-double-03.webp) |
| [ ] | Wall Door Double Large 01 | wall (doorway) | 3 × 3 × 0.54 | `polygonancientempire/sm-bld-wall-door-double-large-01` | ![](../../assets/ui/pack/icons/p_ae.wall-door-double-large-01.webp) |
| [ ] | Wall Door Double Large 02 | wall (doorway) | 3 × 3 × 0.28 | `polygonancientempire/sm-bld-wall-door-double-large-02` | ![](../../assets/ui/pack/icons/p_ae.wall-door-double-large-02.webp) |
| [ ] | Wall Door Large 01 | wall (doorway) | 3 × 3 × 0.72 | `polygonancientempire/sm-bld-wall-door-large-01` | ![](../../assets/ui/pack/icons/p_ae.wall-door-large-01.webp) |
| [ ] | Wall Door Large 02 | wall (doorway) | 3 × 3 × 0.28 | `polygonancientempire/sm-bld-wall-door-large-02` | ![](../../assets/ui/pack/icons/p_ae.wall-door-large-02.webp) |
| [ ] | Wall Large 01 | wall | 6 × 4.5 × 0.82 | `polygonancientempire/sm-bld-wall-large-01` | ![](../../assets/ui/pack/icons/p_ae.wall-large-01.webp) |
| [ ] | Wall Large Window 01 | wall | 6 × 4.5 × 0.82 | `polygonancientempire/sm-bld-wall-large-window-01` | ![](../../assets/ui/pack/icons/p_ae.wall-large-window-01.webp) |
| [ ] | Wall Seat 01 | wall | 3 × 3 × 1.2 | `polygonancientempire/sm-bld-wall-seat-01` | ![](../../assets/ui/pack/icons/p_ae.wall-seat-01.webp) |
| [ ] | Wall Seat Double 01 | wall | 6 × 3 × 1.2 | `polygonancientempire/sm-bld-wall-seat-double-01` | ![](../../assets/ui/pack/icons/p_ae.wall-seat-double-01.webp) |
| [ ] | Wall Tiny 01 | wall | 3 × 0.3 × 0.28 | `polygonancientempire/sm-bld-wall-tiny-01` | ![](../../assets/ui/pack/icons/p_ae.wall-tiny-01.webp) |
| [ ] | Wall Window 01 | wall | 3 × 3 × 0.3 | `polygonancientempire/sm-bld-wall-window-01` | ![](../../assets/ui/pack/icons/p_ae.wall-window-01.webp) |
| [ ] | Wall Window 02 | wall | 3 × 3 × 0.6 | `polygonancientempire/sm-bld-wall-window-02` | ![](../../assets/ui/pack/icons/p_ae.wall-window-02.webp) |
| [ ] | Wall Window 03 | wall | 3 × 3 × 0.6 | `polygonancientempire/sm-bld-wall-window-03` | ![](../../assets/ui/pack/icons/p_ae.wall-window-03.webp) |
| [ ] | Wall Window 04 | wall | 3 × 3 × 0.6 | `polygonancientempire/sm-bld-wall-window-04` | ![](../../assets/ui/pack/icons/p_ae.wall-window-04.webp) |
| [ ] | Wall Window 05 | wall | 3 × 3 × 0.58 | `polygonancientempire/sm-bld-wall-window-05` | ![](../../assets/ui/pack/icons/p_ae.wall-window-05.webp) |
| [ ] | Wall Window 06 | wall | 3 × 3 × 0.28 | `polygonancientempire/sm-bld-wall-window-06` | ![](../../assets/ui/pack/icons/p_ae.wall-window-06.webp) |

### Empire · Floors (7)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Balcony 01 | deck | 3 × 1.36 × 1.2 | `polygonancientempire/sm-bld-balcony-01` | ![](../../assets/ui/pack/icons/p_ae.balcony-01.webp) |
| [ ] | Base Ceiling 01 | floor | 3 × 0.04 × 3 | `polygonancientempire/sm-bld-base-ceiling-01` | ![](../../assets/ui/pack/icons/p_ae.base-ceiling-01.webp) |
| [ ] | Base Floor 01 | floor | 3 × 0.04 × 3 | `polygonancientempire/sm-bld-base-floor-01` | ![](../../assets/ui/pack/icons/p_ae.base-floor-01.webp) |
| [ ] | Base Floor Angled 01 | floor | 3 × 0.04 × 3 | `polygonancientempire/sm-bld-base-floor-angled-01` | ![](../../assets/ui/pack/icons/p_ae.base-floor-angled-01.webp) |
| [ ] | Base Floor Combined 01 | floor | 3 × 0.1 × 3 | `polygonancientempire/sm-bld-base-floor-combined-01` | ![](../../assets/ui/pack/icons/p_ae.base-floor-combined-01.webp) |
| [ ] | Ceiling 02 | floor | 3 × 0.13 × 3 | `polygonancientempire/sm-bld-ceiling-02` | ![](../../assets/ui/pack/icons/p_ae.ceiling-02.webp) |
| [ ] | Wall Balcony 01 | deck | 3 × 0.72 × 0.3 | `polygonancientempire/sm-bld-wall-balcony-01` | ![](../../assets/ui/pack/icons/p_ae.wall-balcony-01.webp) |

### Empire · Roofs (15)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Roof Base Corner 01 | trim (on any face) | 3.2 × 0.82 × 3.2 | `polygonancientempire/sm-bld-roof-base-corner-01` | ![](../../assets/ui/pack/icons/p_ae.roof-base-corner-01.webp) |
| [ ] | Roof Base Corner 02 | trim (on any face) | 3.2 × 0.82 × 3.2 | `polygonancientempire/sm-bld-roof-base-corner-02` | ![](../../assets/ui/pack/icons/p_ae.roof-base-corner-02.webp) |
| [ ] | Roof Base Flat 01 | floor | 3 × 0.75 × 3 | `polygonancientempire/sm-bld-roof-base-flat-01` | ![](../../assets/ui/pack/icons/p_ae.roof-base-flat-01.webp) |
| [ ] | Roof Base Flat 02 | floor | 3 × 0.07 × 3 | `polygonancientempire/sm-bld-roof-base-flat-02` | ![](../../assets/ui/pack/icons/p_ae.roof-base-flat-02.webp) |
| [ ] | Roof Base Flat 03 | floor | 3 × 0.33 × 3 | `polygonancientempire/sm-bld-roof-base-flat-03` | ![](../../assets/ui/pack/icons/p_ae.roof-base-flat-03.webp) |
| [ ] | Roof Base Peak 01 | ridge (both slopes) | 3 × 1.07 × 3 | `polygonancientempire/sm-bld-roof-base-peak-01` | ![](../../assets/ui/pack/icons/p_ae.roof-base-peak-01.webp) |
| [ ] | Roof Base Peak 02 | ridge (both slopes) | 3 × 1.07 × 3 | `polygonancientempire/sm-bld-roof-base-peak-02` | ![](../../assets/ui/pack/icons/p_ae.roof-base-peak-02.webp) |
| [ ] | Roof Base Straight 01 | roof panel | 3 × 0.75 × 3 | `polygonancientempire/sm-bld-roof-base-straight-01` | ![](../../assets/ui/pack/icons/p_ae.roof-base-straight-01.webp) |
| [ ] | Roof Base Straight Thin 01 | roof panel | 3 × 0.69 × 3 | `polygonancientempire/sm-bld-roof-base-straight-thin-01` | ![](../../assets/ui/pack/icons/p_ae.roof-base-straight-thin-01.webp) |
| [ ] | Roof Peak Large 01 | ridge (both slopes) | 9 × 0.39 × 3 | `polygonancientempire/sm-bld-roof-peak-large-01` | ![](../../assets/ui/pack/icons/p_ae.roof-peak-large-01.webp) |
| [ ] | Roof Straight Thin Large 01 | roof panel | 9 × 1.95 × 9 | `polygonancientempire/sm-bld-roof-straight-thin-large-01` | ![](../../assets/ui/pack/icons/p_ae.roof-straight-thin-large-01.webp) |
| [ ] | Trellis Roof 01 | floor | 3 × 0.28 × 3 | `polygonancientempire/sm-bld-trellis-roof-01` | ![](../../assets/ui/pack/icons/p_ae.trellis-roof-01.webp) |
| [ ] | Trellis Roof 02 | floor | 3 × 0.28 × 3 | `polygonancientempire/sm-bld-trellis-roof-02` | ![](../../assets/ui/pack/icons/p_ae.trellis-roof-02.webp) |
| [ ] | Trellis Roof Large 01 | floor | 6.3 × 0.34 × 6.3 | `polygonancientempire/sm-bld-trellis-roof-large-01` | ![](../../assets/ui/pack/icons/p_ae.trellis-roof-large-01.webp) |
| [ ] | Trellis Roof Large 02 | floor | 9.3 × 0.34 × 6.3 | `polygonancientempire/sm-bld-trellis-roof-large-02` | ![](../../assets/ui/pack/icons/p_ae.trellis-roof-large-02.webp) |

### Empire · Gables (7)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Roof Base Flat Side 01 | half gable | 3 × 0.8 × 0.32 | `polygonancientempire/sm-bld-roof-base-flat-side-01` | ![](../../assets/ui/pack/icons/p_ae.roof-base-flat-side-01.webp) |
| [ ] | Roof Base Peak Side 01 | gable end | 3 × 1 × 0.34 | `polygonancientempire/sm-bld-roof-base-peak-side-01` | ![](../../assets/ui/pack/icons/p_ae.roof-base-peak-side-01.webp) |
| [ ] | Roof Base Straight Side 01 | half gable | 3 × 0.8 × 0.34 | `polygonancientempire/sm-bld-roof-base-straight-side-01` | ![](../../assets/ui/pack/icons/p_ae.roof-base-straight-side-01.webp) |
| [ ] | Roof Peak Side Large 01 | gable end | 3 × 0.7 × 0.26 | `polygonancientempire/sm-bld-roof-peak-side-large-01` | ![](../../assets/ui/pack/icons/p_ae.roof-peak-side-large-01.webp) |
| [ ] | Roof Peak Side Large 02 | gable end | 3 × 1 × 0.26 | `polygonancientempire/sm-bld-roof-peak-side-large-02` | ![](../../assets/ui/pack/icons/p_ae.roof-peak-side-large-02.webp) |
| [ ] | Roof Side Large 01 | half gable | 9 × 2 × 0.26 | `polygonancientempire/sm-bld-roof-side-large-01` | ![](../../assets/ui/pack/icons/p_ae.roof-side-large-01.webp) |
| [ ] | Roof Side Large 02 | half gable | 9 × 4 × 0.26 | `polygonancientempire/sm-bld-roof-side-large-02` | ![](../../assets/ui/pack/icons/p_ae.roof-side-large-02.webp) |

### Empire · Doors (19)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Base Door 01 | door | 1.2 × 1.97 × 0.3 | `polygonancientempire/sm-bld-base-door-01` | ![](../../assets/ui/pack/icons/p_ae.base-door-01.webp) |
| [ ] | Base Door Large 01 | door | 1.35 × 2.47 × 0.3 | `polygonancientempire/sm-bld-base-door-large-01` | ![](../../assets/ui/pack/icons/p_ae.base-door-large-01.webp) |
| [ ] | Door 01 | door | 1.2 × 1.97 × 0.2 | `polygonancientempire/sm-bld-door-01` | ![](../../assets/ui/pack/icons/p_ae.door-01.webp) |
| [ ] | Door 02 | door | 1.2 × 1.97 × 0.18 | `polygonancientempire/sm-bld-door-02` | ![](../../assets/ui/pack/icons/p_ae.door-02.webp) |
| [ ] | Door 03 | door | 1.2 × 1.97 × 0.2 | `polygonancientempire/sm-bld-door-03` | ![](../../assets/ui/pack/icons/p_ae.door-03.webp) |
| [ ] | Door 04 | door | 1.2 × 1.96 × 0.12 | `polygonancientempire/sm-bld-door-04` | ![](../../assets/ui/pack/icons/p_ae.door-04.webp) |
| [ ] | Door 05 | door | 1.2 × 1.97 × 0.2 | `polygonancientempire/sm-bld-door-05` | ![](../../assets/ui/pack/icons/p_ae.door-05.webp) |
| [ ] | Door Half 01 | door | 0.6 × 1.97 × 0.28 | `polygonancientempire/sm-bld-door-half-01` | ![](../../assets/ui/pack/icons/p_ae.door-half-01.webp) |
| [ ] | Door Half 02 | door | 0.6 × 1.97 × 0.18 | `polygonancientempire/sm-bld-door-half-02` | ![](../../assets/ui/pack/icons/p_ae.door-half-02.webp) |
| [ ] | Door Half 03 | door | 0.61 × 1.97 × 0.18 | `polygonancientempire/sm-bld-door-half-03` | ![](../../assets/ui/pack/icons/p_ae.door-half-03.webp) |
| [ ] | Door Half 04 | door | 0.6 × 1.97 × 0.1 | `polygonancientempire/sm-bld-door-half-04` | ![](../../assets/ui/pack/icons/p_ae.door-half-04.webp) |
| [ ] | Door Half 05 | door | 0.6 × 1.97 × 0.2 | `polygonancientempire/sm-bld-door-half-05` | ![](../../assets/ui/pack/icons/p_ae.door-half-05.webp) |
| [ ] | Door Large 01 | door | 1.34 × 2.47 × 0.2 | `polygonancientempire/sm-bld-door-large-01` | ![](../../assets/ui/pack/icons/p_ae.door-large-01.webp) |
| [ ] | Door Large 02 | door | 1.35 × 2.47 × 0.22 | `polygonancientempire/sm-bld-door-large-02` | ![](../../assets/ui/pack/icons/p_ae.door-large-02.webp) |
| [ ] | Door Large Half 01 | door | 0.67 × 2.47 × 0.2 | `polygonancientempire/sm-bld-door-large-half-01` | ![](../../assets/ui/pack/icons/p_ae.door-large-half-01.webp) |
| [ ] | Door Large Half 02 | door | 0.67 × 2.47 × 0.2 | `polygonancientempire/sm-bld-door-large-half-02` | ![](../../assets/ui/pack/icons/p_ae.door-large-half-02.webp) |
| [ ] | Door Large Half 03 | door | 0.68 × 2.47 × 0.2 | `polygonancientempire/sm-bld-door-large-half-03` | ![](../../assets/ui/pack/icons/p_ae.door-large-half-03.webp) |
| [ ] | Door Large Half 04 | door | 0.67 × 2.47 × 0.12 | `polygonancientempire/sm-bld-door-large-half-04` | ![](../../assets/ui/pack/icons/p_ae.door-large-half-04.webp) |
| [ ] | Door Large Half 05 | door | 0.68 × 2.47 × 0.2 | `polygonancientempire/sm-bld-door-large-half-05` | ![](../../assets/ui/pack/icons/p_ae.door-large-half-05.webp) |

### Empire · Stairs (17)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Base Stairs 01 | stairs | 3 × 2 × 3 | `polygonancientempire/sm-bld-base-stairs-01` | ![](../../assets/ui/pack/icons/p_ae.base-stairs-01.webp) |
| [ ] | Base Stairs 03 | stairs | 3.22 × 3.5 × 3 | `polygonancientempire/sm-bld-base-stairs-03` | ![](../../assets/ui/pack/icons/p_ae.base-stairs-03.webp) |
| [ ] | Base Staris 02 | stairs | 3 × 3 × 3 | `polygonancientempire/sm-bld-base-staris-02` | ![](../../assets/ui/pack/icons/p_ae.base-staris-02.webp) |
| [ ] | Bath Stairs 01 | stairs | 1.54 × 1.5 × 2.4 | `polygonancientempire/sm-bld-bath-stairs-01` | ![](../../assets/ui/pack/icons/p_ae.bath-stairs-01.webp) |
| [ ] | Stairs 01 | stairs | 3 × 1.5 × 3 | `polygonancientempire/sm-bld-stairs-01` | ![](../../assets/ui/pack/icons/p_ae.stairs-01.webp) |
| [ ] | Stairs 02 | stairs | 3 × 1.5 × 3.3 | `polygonancientempire/sm-bld-stairs-02` | ![](../../assets/ui/pack/icons/p_ae.stairs-02.webp) |
| [ ] | Stairs 03 | stairs | 3 × 3 × 3 | `polygonancientempire/sm-bld-stairs-03` | ![](../../assets/ui/pack/icons/p_ae.stairs-03.webp) |
| [ ] | Stairs Corner 01 | stairs | 3 × 3 × 3 | `polygonancientempire/sm-bld-stairs-corner-01` | ![](../../assets/ui/pack/icons/p_ae.stairs-corner-01.webp) |
| [ ] | Stairs Corner 02 | stairs | 3.22 × 3.5 × 3 | `polygonancientempire/sm-bld-stairs-corner-02` | ![](../../assets/ui/pack/icons/p_ae.stairs-corner-02.webp) |
| [ ] | Step 01 | stairs | 3 × 1.5 × 3 | `polygonancientempire/sm-bld-step-01` | ![](../../assets/ui/pack/icons/p_ae.step-01.webp) |
| [ ] | Step 01 Corner 01 | trim (on any face) | 3 × 1.59 × 3 | `polygonancientempire/sm-bld-step-01-corner-01` | ![](../../assets/ui/pack/icons/p_ae.step-01-corner-01.webp) |
| [ ] | Step 01 Corner 02 | trim (on any face) | 3 × 1.59 × 3 | `polygonancientempire/sm-bld-step-01-corner-02` | ![](../../assets/ui/pack/icons/p_ae.step-01-corner-02.webp) |
| [ ] | Step 01 Insert 01 | trim (on any face) | 2.94 × 1.4 × 2.62 | `polygonancientempire/sm-bld-step-01-insert-01` | ![](../../assets/ui/pack/icons/p_ae.step-01-insert-01.webp) |
| [ ] | Step 02 | stairs | 3 × 1.5 × 3 | `polygonancientempire/sm-bld-step-02` | ![](../../assets/ui/pack/icons/p_ae.step-02.webp) |
| [ ] | Step 02 Corner 01 | trim (on any face) | 3 × 1.59 × 3 | `polygonancientempire/sm-bld-step-02-corner-01` | ![](../../assets/ui/pack/icons/p_ae.step-02-corner-01.webp) |
| [ ] | Step 02 Corner 02 | trim (on any face) | 3 × 1.59 × 3 | `polygonancientempire/sm-bld-step-02-corner-02` | ![](../../assets/ui/pack/icons/p_ae.step-02-corner-02.webp) |
| [ ] | Step 02 Insert 01 | trim (on any face) | 2.94 × 1.4 × 2.66 | `polygonancientempire/sm-bld-step-02-insert-01` | ![](../../assets/ui/pack/icons/p_ae.step-02-insert-01.webp) |

### Empire · Beams (49)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Base Pillar 01 | post | 0.52 × 3 × 0.52 | `polygonancientempire/sm-bld-base-pillar-01` | ![](../../assets/ui/pack/icons/p_ae.base-pillar-01.webp) |
| [ ] | Base Pillar 02 | post | 0.52 × 3 × 0.52 | `polygonancientempire/sm-bld-base-pillar-02` | ![](../../assets/ui/pack/icons/p_ae.base-pillar-02.webp) |
| [ ] | Base Pillar 03 | post | 0.52 × 3 × 0.26 | `polygonancientempire/sm-bld-base-pillar-03` | ![](../../assets/ui/pack/icons/p_ae.base-pillar-03.webp) |
| [ ] | Base Pillar 04 | post | 0.26 × 3 × 0.26 | `polygonancientempire/sm-bld-base-pillar-04` | ![](../../assets/ui/pack/icons/p_ae.base-pillar-04.webp) |
| [ ] | Base Pillar 05 | post | 0.14 × 3 × 0.14 | `polygonancientempire/sm-bld-base-pillar-05` | ![](../../assets/ui/pack/icons/p_ae.base-pillar-05.webp) |
| [ ] | Base Pillar Half 01 | post | 0.46 × 1.5 × 0.46 | `polygonancientempire/sm-bld-base-pillar-half-01` | ![](../../assets/ui/pack/icons/p_ae.base-pillar-half-01.webp) |
| [ ] | Base Pillar Half 02 | post | 0.46 × 1.5 × 0.46 | `polygonancientempire/sm-bld-base-pillar-half-02` | ![](../../assets/ui/pack/icons/p_ae.base-pillar-half-02.webp) |
| [ ] | Base Pillar Half 03 | post | 0.46 × 1.5 × 0.24 | `polygonancientempire/sm-bld-base-pillar-half-03` | ![](../../assets/ui/pack/icons/p_ae.base-pillar-half-03.webp) |
| [ ] | Base Pillar Half 04 | post | 0.24 × 1.5 × 0.24 | `polygonancientempire/sm-bld-base-pillar-half-04` | ![](../../assets/ui/pack/icons/p_ae.base-pillar-half-04.webp) |
| [ ] | Base Pillar Half 05 | post | 0.14 × 1.5 × 0.14 | `polygonancientempire/sm-bld-base-pillar-half-05` | ![](../../assets/ui/pack/icons/p_ae.base-pillar-half-05.webp) |
| [ ] | Base Pillar Metal 01 | post | 0.26 × 3 × 0.26 | `polygonancientempire/sm-bld-base-pillar-metal-01` | ![](../../assets/ui/pack/icons/p_ae.base-pillar-metal-01.webp) |
| [ ] | Base Pillar Metal 02 | post | 0.32 × 3 × 0.32 | `polygonancientempire/sm-bld-base-pillar-metal-02` | ![](../../assets/ui/pack/icons/p_ae.base-pillar-metal-02.webp) |
| [ ] | Bath Corner 01 | post | 0.68 × 1.5 × 0.68 | `polygonancientempire/sm-bld-bath-corner-01` | ![](../../assets/ui/pack/icons/p_ae.bath-corner-01.webp) |
| [ ] | Beam 01 | beam | 3 × 0.14 × 0.28 | `polygonancientempire/sm-prop-beam-01` | ![](../../assets/ui/pack/icons/p_ae.beam-01.webp) |
| [ ] | Beam Large 01 | beam | 12 × 0.72 × 1.32 | `polygonancientempire/sm-bld-beam-large-01` | ![](../../assets/ui/pack/icons/p_ae.beam-large-01.webp) |
| [ ] | Pillar 01 | post | 0.84 × 3 × 0.84 | `polygonancientempire/sm-bld-pillar-01` | ![](../../assets/ui/pack/icons/p_ae.pillar-01.webp) |
| [ ] | Pillar 02 | post | 0.84 × 3 × 0.84 | `polygonancientempire/sm-bld-pillar-02` | ![](../../assets/ui/pack/icons/p_ae.pillar-02.webp) |
| [ ] | Pillar 03 | post | 0.92 × 3 × 0.84 | `polygonancientempire/sm-bld-pillar-03` | ![](../../assets/ui/pack/icons/p_ae.pillar-03.webp) |
| [ ] | Pillar 04 | post | 0.94 × 3 × 0.94 | `polygonancientempire/sm-bld-pillar-04` | ![](../../assets/ui/pack/icons/p_ae.pillar-04.webp) |
| [ ] | Pillar 05 | post | 0.88 × 3 × 0.88 | `polygonancientempire/sm-bld-pillar-05` | ![](../../assets/ui/pack/icons/p_ae.pillar-05.webp) |
| [ ] | Pillar 06 | post | 0.62 × 3 × 0.62 | `polygonancientempire/sm-bld-pillar-06` | ![](../../assets/ui/pack/icons/p_ae.pillar-06.webp) |
| [ ] | Pillar Base 01 | block | 0.9 × 1 × 0.9 | `polygonancientempire/sm-prop-pillar-base-01` | ![](../../assets/ui/pack/icons/p_ae.pillar-base-01.webp) |
| [ ] | Pillar Base 02 | block | 1.2 × 1.5 × 1.2 | `polygonancientempire/sm-prop-pillar-base-02` | ![](../../assets/ui/pack/icons/p_ae.pillar-base-02.webp) |
| [ ] | Pillar Large 01 | post | 0.84 × 6 × 0.84 | `polygonancientempire/sm-bld-pillar-large-01` | ![](../../assets/ui/pack/icons/p_ae.pillar-large-01.webp) |
| [ ] | Pillar Large 02 | post | 0.84 × 6 × 0.84 | `polygonancientempire/sm-bld-pillar-large-02` | ![](../../assets/ui/pack/icons/p_ae.pillar-large-02.webp) |
| [ ] | Pillar Large 03 | post | 0.92 × 6 × 0.84 | `polygonancientempire/sm-bld-pillar-large-03` | ![](../../assets/ui/pack/icons/p_ae.pillar-large-03.webp) |
| [ ] | Pillar Large 04 | post | 0.94 × 6 × 0.94 | `polygonancientempire/sm-bld-pillar-large-04` | ![](../../assets/ui/pack/icons/p_ae.pillar-large-04.webp) |
| [ ] | Pillar Large 04 Corner 01 | post | 0.94 × 6 × 0.94 | `polygonancientempire/sm-bld-pillar-large-04-corner-01` | ![](../../assets/ui/pack/icons/p_ae.pillar-large-04-corner-01.webp) |
| [ ] | Pillar Large 05 | post | 0.88 × 6 × 0.88 | `polygonancientempire/sm-bld-pillar-large-05` | ![](../../assets/ui/pack/icons/p_ae.pillar-large-05.webp) |
| [ ] | Pillar Large 06 | post | 0.62 × 6 × 0.62 | `polygonancientempire/sm-bld-pillar-large-06` | ![](../../assets/ui/pack/icons/p_ae.pillar-large-06.webp) |
| [ ] | Pillar Monument 01 | post | 1.8 × 12 × 1.8 | `polygonancientempire/sm-bld-pillar-monument-01` | ![](../../assets/ui/pack/icons/p_ae.pillar-monument-01.webp) |
| [ ] | Pillar Monument 01 Damaged 01 | post | 1.8 × 12 × 1.8 | `polygonancientempire/sm-bld-pillar-monument-01-damaged-01` | ![](../../assets/ui/pack/icons/p_ae.pillar-monument-01-damaged-01.webp) |
| [ ] | Pillar Monument 02 | post | 1.82 × 12 × 1.82 | `polygonancientempire/sm-bld-pillar-monument-02` | ![](../../assets/ui/pack/icons/p_ae.pillar-monument-02.webp) |
| [ ] | Pillar Monument Half 01 | post | 1.8 × 6 × 1.8 | `polygonancientempire/sm-bld-pillar-monument-half-01` | ![](../../assets/ui/pack/icons/p_ae.pillar-monument-half-01.webp) |
| [ ] | Pillar Monument Half 02 | post | 1.8 × 6 × 1.8 | `polygonancientempire/sm-bld-pillar-monument-half-02` | ![](../../assets/ui/pack/icons/p_ae.pillar-monument-half-02.webp) |
| [ ] | Pillar Top 01 | block | 0.9 × 0.25 × 0.9 | `polygonancientempire/sm-prop-pillar-top-01` | ![](../../assets/ui/pack/icons/p_ae.pillar-top-01.webp) |
| [ ] | Roof Base Pillar 01 | post | 0.38 × 0.9 × 0.38 | `polygonancientempire/sm-bld-roof-base-pillar-01` | ![](../../assets/ui/pack/icons/p_ae.roof-base-pillar-01.webp) |
| [ ] | Roof Base Pillar 02 | post | 0.22 × 0.8 × 0.22 | `polygonancientempire/sm-bld-roof-base-pillar-02` | ![](../../assets/ui/pack/icons/p_ae.roof-base-pillar-02.webp) |
| [ ] | Seat Bench 04 Pillar 01 | block | 1.2 × 1.72 × 0.9 | `polygonancientempire/sm-prop-seat-bench-04-pillar-01` | ![](../../assets/ui/pack/icons/p_ae.seat-bench-04-pillar-01.webp) |
| [ ] | Trellis Pillar 01 | post | 0.38 × 3 × 0.38 | `polygonancientempire/sm-bld-trellis-pillar-01` | ![](../../assets/ui/pack/icons/p_ae.trellis-pillar-01.webp) |
| [ ] | Wall Balcony Pillar 01 | post | 0.28 × 0.7 × 0.28 | `polygonancientempire/sm-bld-wall-balcony-pillar-01` | ![](../../assets/ui/pack/icons/p_ae.wall-balcony-pillar-01.webp) |
| [ ] | Wall Balcony Pillar 04 | post | 0.14 × 1 × 0.14 | `polygonancientempire/sm-bld-wall-balcony-pillar-04` | ![](../../assets/ui/pack/icons/p_ae.wall-balcony-pillar-04.webp) |
| [ ] | Wall Balcony Pillar 05 | post | 0.6 × 1 × 0.6 | `polygonancientempire/sm-bld-wall-balcony-pillar-05` | ![](../../assets/ui/pack/icons/p_ae.wall-balcony-pillar-05.webp) |
| [ ] | Wall Balcony Pillar 06 | post | 0.78 × 1 × 0.74 | `polygonancientempire/sm-bld-wall-balcony-pillar-06` | ![](../../assets/ui/pack/icons/p_ae.wall-balcony-pillar-06.webp) |
| [ ] | Wall Balcony Pillar Inner 06 | post | 0.66 × 1 × 0.7 | `polygonancientempire/sm-bld-wall-balcony-pillar-inner-06` | ![](../../assets/ui/pack/icons/p_ae.wall-balcony-pillar-inner-06.webp) |
| [ ] | Wall End 01 | post | 0.14 × 3 × 0.14 | `polygonancientempire/sm-bld-wall-end-01` | ![](../../assets/ui/pack/icons/p_ae.wall-end-01.webp) |
| [ ] | Wall End Half 01 | post | 0.14 × 1.5 × 0.14 | `polygonancientempire/sm-bld-wall-end-half-01` | ![](../../assets/ui/pack/icons/p_ae.wall-end-half-01.webp) |
| [ ] | Wall Large Pillar 01 | post | 1.1 × 4.5 × 1.1 | `polygonancientempire/sm-bld-wall-large-pillar-01` | ![](../../assets/ui/pack/icons/p_ae.wall-large-pillar-01.webp) |
| [ ] | Wall Tiny End 01 | post | 0.14 × 0.3 × 0.14 | `polygonancientempire/sm-bld-wall-tiny-end-01` | ![](../../assets/ui/pack/icons/p_ae.wall-tiny-end-01.webp) |

### Empire · Fences (4)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Fence Wood 01 | fence | 3 × 1.43 × 0.2 | `polygonancientempire/sm-env-fence-wood-01` | ![](../../assets/ui/pack/icons/p_ae.fence-wood-01.webp) |
| [ ] | Fence Wood 02 | fence | 3.3 × 1.5 × 0.22 | `polygonancientempire/sm-env-fence-wood-02` | ![](../../assets/ui/pack/icons/p_ae.fence-wood-02.webp) |
| [ ] | Fence Wood 03 | fence | 3 × 1.42 × 0.2 | `polygonancientempire/sm-env-fence-wood-03` | ![](../../assets/ui/pack/icons/p_ae.fence-wood-03.webp) |
| [ ] | Fence Wood Gate 01 | fence | 3 × 1.29 × 0.12 | `polygonancientempire/sm-env-fence-wood-gate-01` | ![](../../assets/ui/pack/icons/p_ae.fence-wood-gate-01.webp) |

### Empire · Trims (81)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Banner Roof 01 | trim (on any face) | 3.12 × 0.52 × 3.12 | `polygonancientempire/sm-prop-banner-roof-01` | ![](../../assets/ui/pack/icons/p_ae.banner-roof-01.webp) |
| [ ] | Banner Roof 02 | trim (on any face) | 6.12 × 0.54 × 3.12 | `polygonancientempire/sm-prop-banner-roof-02` | ![](../../assets/ui/pack/icons/p_ae.banner-roof-02.webp) |
| [ ] | Banner Roof 03 | trim (on any face) | 3.16 × 0.52 × 3.14 | `polygonancientempire/sm-prop-banner-roof-03` | ![](../../assets/ui/pack/icons/p_ae.banner-roof-03.webp) |
| [ ] | Banner Roof 04 | trim (on any face) | 6.14 × 0.53 × 3.18 | `polygonancientempire/sm-prop-banner-roof-04` | ![](../../assets/ui/pack/icons/p_ae.banner-roof-04.webp) |
| [ ] | Banner Roof 05 | trim (on any face) | 6.06 × 0.54 × 3.04 | `polygonancientempire/sm-prop-banner-roof-05` | ![](../../assets/ui/pack/icons/p_ae.banner-roof-05.webp) |
| [ ] | Banner Roof 06 | trim (on any face) | 6.06 × 0.55 × 3 | `polygonancientempire/sm-prop-banner-roof-06` | ![](../../assets/ui/pack/icons/p_ae.banner-roof-06.webp) |
| [ ] | Floor Trim 01 | trim (on any face) | 3 × 0.14 × 1.16 | `polygonancientempire/sm-bld-floor-trim-01` | ![](../../assets/ui/pack/icons/p_ae.floor-trim-01.webp) |
| [ ] | Floor Trim 02 | trim (on any face) | 3 × 0.47 × 1.24 | `polygonancientempire/sm-bld-floor-trim-02` | ![](../../assets/ui/pack/icons/p_ae.floor-trim-02.webp) |
| [ ] | Floor Trim Corner 01 | trim (on any face) | 1.18 × 0.17 × 1.18 | `polygonancientempire/sm-bld-floor-trim-corner-01` | ![](../../assets/ui/pack/icons/p_ae.floor-trim-corner-01.webp) |
| [ ] | Floor Trim Corner 02 | trim (on any face) | 1.24 × 0.47 × 1.22 | `polygonancientempire/sm-bld-floor-trim-corner-02` | ![](../../assets/ui/pack/icons/p_ae.floor-trim-corner-02.webp) |
| [ ] | Floor Trim Corner 03 | trim (on any face) | 1.44 × 0.83 × 1.44 | `polygonancientempire/sm-bld-floor-trim-corner-03` | ![](../../assets/ui/pack/icons/p_ae.floor-trim-corner-03.webp) |
| [ ] | Floor Trim Straight 02 | trim (on any face) | 3 × 0.47 × 1.24 | `polygonancientempire/sm-bld-floor-trim-straight-02` | ![](../../assets/ui/pack/icons/p_ae.floor-trim-straight-02.webp) |
| [ ] | Ladder 01 | trim (on any face) | 0.88 × 3.01 × 0.18 | `polygonancientempire/sm-prop-ladder-01` | ![](../../assets/ui/pack/icons/p_ae.ladder-01.webp) |
| [ ] | Ornament 01 | trim (on any face) | 0.88 × 0.74 × 0.16 | `polygonancientempire/sm-bld-ornament-01` | ![](../../assets/ui/pack/icons/p_ae.ornament-01.webp) |
| [ ] | Ornament 02 | trim (on any face) | 0.92 × 0.77 × 0.24 | `polygonancientempire/sm-bld-ornament-02` | ![](../../assets/ui/pack/icons/p_ae.ornament-02.webp) |
| [ ] | Ornament 04 | trim (on any face) | 0.88 × 0.74 × 0.18 | `polygonancientempire/sm-bld-ornament-04` | ![](../../assets/ui/pack/icons/p_ae.ornament-04.webp) |
| [ ] | Ornament 05 | trim (on any face) | 0.88 × 0.74 × 0.2 | `polygonancientempire/sm-bld-ornament-05` | ![](../../assets/ui/pack/icons/p_ae.ornament-05.webp) |
| [ ] | Ornament 06 | trim (on any face) | 0.72 × 0.64 × 0.16 | `polygonancientempire/sm-bld-ornament-06` | ![](../../assets/ui/pack/icons/p_ae.ornament-06.webp) |
| [ ] | Ornament 07 | trim (on any face) | 0.7 × 0.58 × 0.14 | `polygonancientempire/sm-bld-ornament-07` | ![](../../assets/ui/pack/icons/p_ae.ornament-07.webp) |
| [ ] | Ornament 08 | trim (on any face) | 0.7 × 0.58 × 0.14 | `polygonancientempire/sm-bld-ornament-08` | ![](../../assets/ui/pack/icons/p_ae.ornament-08.webp) |
| [ ] | Ornament 09 | trim (on any face) | 0.34 × 0.35 × 0.16 | `polygonancientempire/sm-bld-ornament-09` | ![](../../assets/ui/pack/icons/p_ae.ornament-09.webp) |
| [ ] | Pillar Monument Trim 01 | trim (on any face) | 1.86 × 0.67 × 1.86 | `polygonancientempire/sm-bld-pillar-monument-trim-01` | ![](../../assets/ui/pack/icons/p_ae.pillar-monument-trim-01.webp) |
| [ ] | Pillar Monument Trim 02 | trim (on any face) | 1.86 × 0.67 × 1.86 | `polygonancientempire/sm-bld-pillar-monument-trim-02` | ![](../../assets/ui/pack/icons/p_ae.pillar-monument-trim-02.webp) |
| [ ] | Pillar Trim 01 | trim (on any face) | 0.64 × 0.29 × 0.64 | `polygonancientempire/sm-bld-pillar-trim-01` | ![](../../assets/ui/pack/icons/p_ae.pillar-trim-01.webp) |
| [ ] | Pillar Trim 02 | trim (on any face) | 0.64 × 0.29 × 0.64 | `polygonancientempire/sm-bld-pillar-trim-02` | ![](../../assets/ui/pack/icons/p_ae.pillar-trim-02.webp) |
| [ ] | Pillar Trim 03 | trim (on any face) | 0.64 × 0.29 × 0.64 | `polygonancientempire/sm-bld-pillar-trim-03` | ![](../../assets/ui/pack/icons/p_ae.pillar-trim-03.webp) |
| [ ] | Roof Corner Cap 01 | trim (on any face) | 0.88 × 0.15 × 0.86 | `polygonancientempire/sm-bld-roof-corner-cap-01` | ![](../../assets/ui/pack/icons/p_ae.roof-corner-cap-01.webp) |
| [ ] | Roof Detail 01 | trim (on any face) | 2.84 × 0.57 × 2.6 | `polygonancientempire/sm-bld-roof-detail-01` | ![](../../assets/ui/pack/icons/p_ae.roof-detail-01.webp) |
| [ ] | Roof Detail 02 | trim (on any face) | 2.82 × 0.58 × 2.6 | `polygonancientempire/sm-bld-roof-detail-02` | ![](../../assets/ui/pack/icons/p_ae.roof-detail-02.webp) |
| [ ] | Roof Detail Flat 01 | trim (on any face) | 2.82 × 0.11 × 2.58 | `polygonancientempire/sm-bld-roof-detail-flat-01` | ![](../../assets/ui/pack/icons/p_ae.roof-detail-flat-01.webp) |
| [ ] | Roof Detail Large 01 | trim (on any face) | 8.34 × 1.81 × 8.6 | `polygonancientempire/sm-bld-roof-detail-large-01` | ![](../../assets/ui/pack/icons/p_ae.roof-detail-large-01.webp) |
| [ ] | Roof Detail Large 02 | trim (on any face) | 8.82 × 1.81 × 8.58 | `polygonancientempire/sm-bld-roof-detail-large-02` | ![](../../assets/ui/pack/icons/p_ae.roof-detail-large-02.webp) |
| [ ] | Roof Edge Corner 01 | trim (on any face) | 3.52 × 0.16 × 3.52 | `polygonancientempire/sm-bld-roof-edge-corner-01` | ![](../../assets/ui/pack/icons/p_ae.roof-edge-corner-01.webp) |
| [ ] | Roof Edge Straight 01 | trim (on any face) | 3 × 0.16 × 0.74 | `polygonancientempire/sm-bld-roof-edge-straight-01` | ![](../../assets/ui/pack/icons/p_ae.roof-edge-straight-01.webp) |
| [ ] | Roof Edge Straight Large 01 | trim (on any face) | 9 × 1.02 × 0.5 | `polygonancientempire/sm-bld-roof-edge-straight-large-01` | ![](../../assets/ui/pack/icons/p_ae.roof-edge-straight-large-01.webp) |
| [ ] | Roof End Cap 01 | trim (on any face) | 0.26 × 0.15 × 0.6 | `polygonancientempire/sm-bld-roof-end-cap-01` | ![](../../assets/ui/pack/icons/p_ae.roof-end-cap-01.webp) |
| [ ] | Roof End Cap Large 01 | trim (on any face) | 0.5 × 1.02 × 0.5 | `polygonancientempire/sm-bld-roof-end-cap-large-01` | ![](../../assets/ui/pack/icons/p_ae.roof-end-cap-large-01.webp) |
| [ ] | Roof End Flat 01 | trim (on any face) | 0.26 × 0.14 × 3.04 | `polygonancientempire/sm-bld-roof-end-flat-01` | ![](../../assets/ui/pack/icons/p_ae.roof-end-flat-01.webp) |
| [ ] | Roof End Peak Large 01 | trim (on any face) | 0.5 × 1.31 × 3 | `polygonancientempire/sm-bld-roof-end-peak-large-01` | ![](../../assets/ui/pack/icons/p_ae.roof-end-peak-large-01.webp) |
| [ ] | Roof End Slope 01 | trim (on any face) | 0.26 × 0.72 × 3.06 | `polygonancientempire/sm-bld-roof-end-slope-01` | ![](../../assets/ui/pack/icons/p_ae.roof-end-slope-01.webp) |
| [ ] | Roof End Slope Large 01 | trim (on any face) | 0.5 × 2.88 × 9 | `polygonancientempire/sm-bld-roof-end-slope-large-01` | ![](../../assets/ui/pack/icons/p_ae.roof-end-slope-large-01.webp) |
| [ ] | Roof Peak Large 01 Trim 01 | trim (on any face) | 1.02 × 0.48 × 3.08 | `polygonancientempire/sm-bld-roof-peak-large-01-trim-01` | ![](../../assets/ui/pack/icons/p_ae.roof-peak-large-01-trim-01.webp) |
| [ ] | Roof Peak Large 01 Trim 02 | trim (on any face) | 9 × 0.34 × 1.5 | `polygonancientempire/sm-bld-roof-peak-large-01-trim-02` | ![](../../assets/ui/pack/icons/p_ae.roof-peak-large-01-trim-02.webp) |
| [ ] | Roof Straight Thin Large 01 Trim 01 | trim (on any face) | 1.02 × 2.04 × 9.1 | `polygonancientempire/sm-bld-roof-straight-thin-large-01-trim-01` | ![](../../assets/ui/pack/icons/p_ae.roof-straight-thin-large-01-trim-01.webp) |
| [ ] | Roof Topper 01 | trim (on any face) | 0.38 × 0.53 × 0.4 | `polygonancientempire/sm-bld-roof-topper-01` | ![](../../assets/ui/pack/icons/p_ae.roof-topper-01.webp) |
| [ ] | Roof Topper 02 | trim (on any face) | 0.44 × 0.55 × 0.4 | `polygonancientempire/sm-bld-roof-topper-02` | ![](../../assets/ui/pack/icons/p_ae.roof-topper-02.webp) |
| [ ] | Roof Topper 03 | trim (on any face) | 0.56 × 0.49 × 0.18 | `polygonancientempire/sm-bld-roof-topper-03` | ![](../../assets/ui/pack/icons/p_ae.roof-topper-03.webp) |
| [ ] | Roof Topper 04 | trim (on any face) | 0.68 × 0.83 × 0.68 | `polygonancientempire/sm-bld-roof-topper-04` | ![](../../assets/ui/pack/icons/p_ae.roof-topper-04.webp) |
| [ ] | Roof Topper 05 | trim (on any face) | 0.48 × 0.92 × 0.48 | `polygonancientempire/sm-bld-roof-topper-05` | ![](../../assets/ui/pack/icons/p_ae.roof-topper-05.webp) |
| [ ] | Roof Topper 06 | trim (on any face) | 0.4 × 0.74 × 0.4 | `polygonancientempire/sm-bld-roof-topper-06` | ![](../../assets/ui/pack/icons/p_ae.roof-topper-06.webp) |
| [ ] | Stairs Wall 01 | trim (on any face) | 0.36 × 1.78 × 3 | `polygonancientempire/sm-bld-stairs-wall-01` | ![](../../assets/ui/pack/icons/p_ae.stairs-wall-01.webp) |
| [ ] | Stairs Wall 02 | trim (on any face) | 0.36 × 3.28 × 3 | `polygonancientempire/sm-bld-stairs-wall-02` | ![](../../assets/ui/pack/icons/p_ae.stairs-wall-02.webp) |
| [ ] | Stairs Wall Cap 01 | trim (on any face) | 0.46 × 0.36 × 0.46 | `polygonancientempire/sm-bld-stairs-wall-cap-01` | ![](../../assets/ui/pack/icons/p_ae.stairs-wall-cap-01.webp) |
| [ ] | Stairs Wall Edge 01 | beam | 3 × 0.28 × 0.36 | `polygonancientempire/sm-bld-stairs-wall-edge-01` | ![](../../assets/ui/pack/icons/p_ae.stairs-wall-edge-01.webp) |
| [ ] | Trellis Roof End 01 | trim (on any face) | 0.46 × 0.16 × 2.74 | `polygonancientempire/sm-bld-trellis-roof-end-01` | ![](../../assets/ui/pack/icons/p_ae.trellis-roof-end-01.webp) |
| [ ] | Trellis Roof End 02 | trim (on any face) | 0.38 × 0.09 × 2.72 | `polygonancientempire/sm-bld-trellis-roof-end-02` | ![](../../assets/ui/pack/icons/p_ae.trellis-roof-end-02.webp) |
| [ ] | Trim 01 | trim (on any face) | 3 × 0.1 × 0.1 | `polygonancientempire/sm-bld-trim-01` | ![](../../assets/ui/pack/icons/p_ae.trim-01.webp) |
| [ ] | Trim 01 Window 01 | trim (on any face) | 3 × 0.09 × 0.1 | `polygonancientempire/sm-bld-trim-01-window-01` | ![](../../assets/ui/pack/icons/p_ae.trim-01-window-01.webp) |
| [ ] | Trim 02 | trim (on any face) | 3 × 0.33 × 0.08 | `polygonancientempire/sm-bld-trim-02` | ![](../../assets/ui/pack/icons/p_ae.trim-02.webp) |
| [ ] | Trim 02 Window 01 | trim (on any face) | 3 × 0.33 × 0.08 | `polygonancientempire/sm-bld-trim-02-window-01` | ![](../../assets/ui/pack/icons/p_ae.trim-02-window-01.webp) |
| [ ] | Trim 03 | trim (on any face) | 3 × 0.32 × 0.1 | `polygonancientempire/sm-bld-trim-03` | ![](../../assets/ui/pack/icons/p_ae.trim-03.webp) |
| [ ] | Trim 03 Window 01 | trim (on any face) | 3 × 0.31 × 0.1 | `polygonancientempire/sm-bld-trim-03-window-01` | ![](../../assets/ui/pack/icons/p_ae.trim-03-window-01.webp) |
| [ ] | Trim 04 | trim (on any face) | 3 × 0.33 × 0.1 | `polygonancientempire/sm-bld-trim-04` | ![](../../assets/ui/pack/icons/p_ae.trim-04.webp) |
| [ ] | Trim 04 Window 01 | trim (on any face) | 3 × 0.33 × 0.1 | `polygonancientempire/sm-bld-trim-04-window-01` | ![](../../assets/ui/pack/icons/p_ae.trim-04-window-01.webp) |
| [ ] | Trim 05 | trim (on any face) | 3 × 0.5 × 0.16 | `polygonancientempire/sm-bld-trim-05` | ![](../../assets/ui/pack/icons/p_ae.trim-05.webp) |
| [ ] | Trim 05 Window 01 | trim (on any face) | 3 × 0.5 × 0.16 | `polygonancientempire/sm-bld-trim-05-window-01` | ![](../../assets/ui/pack/icons/p_ae.trim-05-window-01.webp) |
| [ ] | Trim Corner 01 | trim (on any face) | 0.22 × 0.09 × 0.22 | `polygonancientempire/sm-bld-trim-corner-01` | ![](../../assets/ui/pack/icons/p_ae.trim-corner-01.webp) |
| [ ] | Trim Corner 02 | trim (on any face) | 0.22 × 0.33 × 0.22 | `polygonancientempire/sm-bld-trim-corner-02` | ![](../../assets/ui/pack/icons/p_ae.trim-corner-02.webp) |
| [ ] | Trim Corner 03 | trim (on any face) | 0.22 × 0.31 × 0.22 | `polygonancientempire/sm-bld-trim-corner-03` | ![](../../assets/ui/pack/icons/p_ae.trim-corner-03.webp) |
| [ ] | Trim Corner 04 | trim (on any face) | 0.22 × 0.33 × 0.22 | `polygonancientempire/sm-bld-trim-corner-04` | ![](../../assets/ui/pack/icons/p_ae.trim-corner-04.webp) |
| [ ] | Trim Corner 05 | trim (on any face) | 0.3 × 0.5 × 0.3 | `polygonancientempire/sm-bld-trim-corner-05` | ![](../../assets/ui/pack/icons/p_ae.trim-corner-05.webp) |
| [ ] | Trim Large 01 | trim (on any face) | 9 × 0.96 × 0.64 | `polygonancientempire/sm-bld-trim-large-01` | ![](../../assets/ui/pack/icons/p_ae.trim-large-01.webp) |
| [ ] | Trim Large 02 | trim (on any face) | 9 × 0.97 × 0.4 | `polygonancientempire/sm-bld-trim-large-02` | ![](../../assets/ui/pack/icons/p_ae.trim-large-02.webp) |
| [ ] | Trim Large Corner 01 | trim (on any face) | 0.64 × 0.96 × 0.64 | `polygonancientempire/sm-bld-trim-large-corner-01` | ![](../../assets/ui/pack/icons/p_ae.trim-large-corner-01.webp) |
| [ ] | Trim Large Corner 02 | trim (on any face) | 0.5 × 0.96 × 0.5 | `polygonancientempire/sm-bld-trim-large-corner-02` | ![](../../assets/ui/pack/icons/p_ae.trim-large-corner-02.webp) |
| [ ] | Trim Large Single 01 | trim (on any face) | 3 × 0.96 × 0.64 | `polygonancientempire/sm-bld-trim-large-single-01` | ![](../../assets/ui/pack/icons/p_ae.trim-large-single-01.webp) |
| [ ] | Trim Large Single 02 | trim (on any face) | 3 × 0.97 × 0.4 | `polygonancientempire/sm-bld-trim-large-single-02` | ![](../../assets/ui/pack/icons/p_ae.trim-large-single-02.webp) |
| [ ] | Wall Balcony Stairs 01 | trim (on any face) | 3 × 2.22 × 0.28 | `polygonancientempire/sm-bld-wall-balcony-stairs-01` | ![](../../assets/ui/pack/icons/p_ae.wall-balcony-stairs-01.webp) |
| [ ] | Wall Beam Detail 01 | trim (on any face) | 2.44 × 0.16 × 0.46 | `polygonancientempire/sm-bld-wall-beam-detail-01` | ![](../../assets/ui/pack/icons/p_ae.wall-beam-detail-01.webp) |
| [ ] | Wall Large Cap 01 | trim (on any face) | 6.02 × 0.36 × 1.08 | `polygonancientempire/sm-bld-wall-large-cap-01` | ![](../../assets/ui/pack/icons/p_ae.wall-large-cap-01.webp) |
| [ ] | Wall Large Pillar Cap 01 | trim (on any face) | 1.54 × 0.48 × 1.48 | `polygonancientempire/sm-bld-wall-large-pillar-cap-01` | ![](../../assets/ui/pack/icons/p_ae.wall-large-pillar-cap-01.webp) |

### Empire · Big (1)

| Keep | Piece | As | Size in game (m) | Model | Picture |
|---|---|---|---|---|---|
| [ ] | Door Monument 01 | block | 6.3 × 9 × 0.9 | `polygonancientempire/sm-bld-door-monument-01` | ![](../../assets/ui/pack/icons/p_ae.door-monument-01.webp) |

## Left out (33)

- `rpgpp-ag/rpgpp-ag-building-exterior-01` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-building-exterior-02` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-building-exterior-03` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-building-exterior-04` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-building-exterior-05` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-building-exterior-06` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-building-exterior-07` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-building-exterior-08` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-building-exterior-09` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-building-exterior-10` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-building-exterior-11` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-building-exterior-12` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-building-exterior-13` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-building-exterior-14` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-building-exterior-15` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-shed-wood-01a` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-shed-wood-01b` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-shed-wood-02a` (Whole buildings)
- `rpgpp-ag/rpgpp-ag-shed-wood-02b` (Whole buildings)
- `polygonancientempire/sm-bld-amphitheatre-01` (Whole buildings)
- `polygonancientempire/sm-bld-amphitheatre-end-01` (Whole buildings)
- `polygonancientempire/sm-bld-temp-building-01` (Whole buildings)
- `polygonancientempire/sm-bld-temp-building-02` (Whole buildings)
- `polygonancientempire/sm-bld-temp-building-03` (Whole buildings)
- `polygonancientempire/sm-prop-pergola-01` (Market & awnings)
- `polygonvikings/sm-bld-boathouse-01` (Whole buildings)
- `polygonvikings/sm-bld-boathouse-02` (Whole buildings)
- `polygonvikings/sm-bld-wharf-01` (Whole buildings)
- `polygonvikings/sm-prop-crate-base-01` (Foundations)
- `polygonvikings/sm-bld-boathouse-01-snow` (Whole buildings)
- `polygonvikings/sm-bld-boathouse-02-snow` (Whole buildings)
- `polygonvikings/sm-bld-wharf-01-snow` (Whole buildings)
- `polygonvikings/sm-prop-crate-base-01-snow` (Foundations)
