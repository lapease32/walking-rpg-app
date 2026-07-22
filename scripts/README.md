# scripts/cutout.swift — painted-creature cutout tool

Turns a raw AI-generated creature painting (Midjourney, 1024² on an arbitrary backdrop) into a
game-ready sprite: background removed, edges cleaned, trimmed to the creature, with **framing
metadata emitted straight from the alpha** for the combat stage (`src/models/stageLayout.ts`).

macOS only — it uses the Vision framework's subject-lift (the engine behind Preview's "Copy
Subject"), so no service, no model download, no API key.

## Usage

```sh
swiftc -O scripts/cutout.swift -o /tmp/cutout
/tmp/cutout input.png output.png
```

It prints one line of JSON — paste the numbers into the creature's entry in
`src/components/combat/creatures/paintedRegistry.ts`:

```json
{"file":"ash_wretch_night.png","w":722,"h":830,"aspect":0.870,"footLeft":0.017,"footRight":0.884,"stanceDepth":0.223}
```

- `aspect` — width / height of the trimmed sprite (the stage contain-fits to this).
- `footLeft` / `footRight` — the leftmost/rightmost ground contact, as fractions of width. The
  grounding pool spans these **independently** (a creature's feet aren't centred on its body).
- `stanceDepth` — how far up the sprite the contacts spread, so the pool reaches a quadruped's
  raised back feet, not just the lowest paw.

## Options

- `fill=1` (default) fills enclosed cracks by restoring source colour — SOLID creatures. **`fill=0`** for
  OPEN/tattered creatures OR any creature with large negative-space pockets between limbs (else a black or
  gray backdrop gets fill-painted into those pockets as opaque blobs).
- `bgguard=1` — during fill, skip gaps whose source ≈ the bright backdrop (MIXED: solid body + open
  sub-structure). Bright backdrop only (`bgLum>0.45`).
- `whitekey=T` — final pass: delete opaque pixels within colour-distance `T` of the sampled backdrop.
  UNGATED (white OR gray backdrops). Safe only when creature colours are clearly separated from the
  backdrop — a dark creature on dark-gray is NOT (keying shreds it). Measure T from the image.
- `despeckle=L` / `maxLum=L` — opt-in speck / brightness-ceiling removal (rarely needed).
- `shadow=S` / `dropshadow=S` — day ground-shadow experiments, **PARKED**: the project keeps the AI's
  painted day shadow via **manual Photopea passes** on the day cuts instead (Vision leaves opaque shadow
  remnants + a light edge fringe that only hand-cleanup removes cleanly).

**Backdrop for cuttability:** a dark NIGHT creature wants a **solid black** source backdrop; a DAY
creature wants **white** — never a mid-gray (same value as the creature → uncuttable).

## `trim.swift` — trim a hand-cleaned export

`swiftc -O scripts/trim.swift -o /tmp/trim && /tmp/trim in.png out.png` — trims a manually-cleaned
full-canvas Photopea export (users export at 1024², untrimmed) to its alpha bbox — NO re-cut (Vision would
reprocess a finished sprite). Prints framing + **`creatureCenterX`** (the SOLID creature's horizontal
centre, `alpha>200`, excluding a semi-transparent shadow) so the combat stage can centre on the creature,
not the shadow-inclusive bbox.

## What it does, and why each stage exists

Each stage fixes a failure mode we actually hit — see the git history of this file for the gory
details. In order:

1. **Vision subject mask** → the foreground silhouette.
2. **Matting decontamination** — solves `F = (C − (1−a)B)/a` with a *spatially varying* background
   estimate, so a split backdrop (Midjourney sometimes returns white-over-black) doesn't leave a
   bright fringe on thin geometry (fingers, cloth strands).
3. **Enclosed-pocket key** — removes background trapped between limbs that the mask filled in solid.
   Thresholds come from the sprite's own histogram (every bright pixel in the art is a *saturated*
   ember; the leaks are bright and *desaturated*), not eyeballed.
4. **Connected-components cleanup** — drops detached mask spill (a chunk of baked ground-shadow near
   the feet) under 1.5% of the largest island.
5. **Trim** to the alpha bounding box, so the sprite's bottom edge IS the creature's lowest point
   and the stage's grounding pool lands under its feet with no per-asset nudging.
6. **Measure** the ground contacts + stance depth → the JSON above.

## The day/night pipeline

Each creature is painted **twice** — a night key and a day key — from one style block, swapping only
the lighting language (see the painted-art pipeline note). Run the tool on each. A creature with only
a night key falls back to it in daylight with a "gloom pool" (handled in `CreatureStage`); add the
day art later to retire the fallback.

> Note: night-key art crushes its shadow recesses to near-black, which reads as holes on the pale day
> stage. That's why the day key is a real requirement, not optional polish — a night sprite can't
> just be shown brighter.
