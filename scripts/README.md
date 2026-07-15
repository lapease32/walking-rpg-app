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
