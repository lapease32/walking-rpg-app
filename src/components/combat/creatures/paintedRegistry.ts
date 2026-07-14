import type { ImageSourcePropType } from 'react-native';
import type { SpriteFraming } from '../../../models/stageLayout';

/**
 * Painted creature art — the medium the game settled on (see the painted-art pipeline note): a
 * transparent-cutout sprite per creature, PAINTED IN BOTH LIGHTS, that renders on the combat stage.
 *
 * THE ART FOLLOWS THE SUN. Each creature can carry a `night` key and a `day` key; which one shows is
 * decided by the real sun at the player's location — the same clock that drives the theme and the
 * spawn table. A creature caught out of its own light (a supernatural thing at noon, a mundane one
 * at midnight) is the rare, unrewarded reward the day/night system is built around.
 *
 * Rollout is progressive and never blocking: a creature with only a `night` key falls back to it in
 * daylight, softened by a grounding "gloom pool" (see {@link CreatureStage}) so its crushed shadows
 * read as its own darkness rather than holes in the day. Add `day` art later to retire the fallback.
 *
 * Sprites + framing are produced together by scripts/cutout.swift, which emits the framing straight
 * from each sprite's alpha — never hand-tuned. This is the swap point that supersedes the vector
 * bodies; a creature here renders painted, everything else still falls back to the vector/emblem
 * CreaturePlate.
 */
export interface PaintedKey {
  source: ImageSourcePropType;
  framing: SpriteFraming;
}

export interface PaintedCreature {
  /** Natural-light art — required. */
  night: PaintedKey;
  /** Daylit art — optional until painted; absence triggers the gloom-pool fallback by day. */
  day?: PaintedKey;
  /** Semantic on-stage size (a cur is smaller than a wretch); 1 = fill the stage's contain box. */
  scale: number;
}

export const PAINTED_CREATURES: Record<string, PaintedCreature> = {
  ash_wretch: {
    scale: 1,
    night: {
      source: require('../../../assets/creatures/ash_wretch_night.png'),
      framing: { aspect: 0.87, footLeft: 0.017, footRight: 0.884, stanceDepth: 0.223 },
    },
    day: {
      source: require('../../../assets/creatures/ash_wretch_day.png'),
      framing: { aspect: 0.784, footLeft: 0.178, footRight: 0.911, stanceDepth: 0.223 },
    },
  },
};

/** The chosen art + framing for a creature at this time of day, plus whether it's the gloom fallback. */
export interface ResolvedPaintedCreature {
  key: PaintedKey;
  scale: number;
  /** True when a night-only creature is shown in daylight — render the grounding gloom pool. */
  gloom: boolean;
}

/**
 * Resolve a creature's painted art for the current light. Pure, so the sun-keying is unit-testable
 * and the stage stays a thin renderer.
 *
 * `daylight === undefined` means the caller has no sun information (a debug force, a unit test) →
 * fall back to the natural-light art with no gloom.
 */
export function resolvePaintedCreature(
  creatureId: string | undefined,
  daylight: boolean | undefined,
): ResolvedPaintedCreature | undefined {
  const painted = creatureId ? PAINTED_CREATURES[creatureId] : undefined;
  if (!painted) {
    return undefined;
  }
  if (daylight && painted.day) {
    return { key: painted.day, scale: painted.scale, gloom: false };
  }
  // Night art: either it's actually night, or it's a night-only creature exposed by day (gloom).
  return { key: painted.night, scale: painted.scale, gloom: daylight === true };
}
