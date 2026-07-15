/**
 * Combat-stage geometry — pure maths, no React.
 *
 * The stage shows a painted creature (a transparent-cutout sprite) on a lit ground. Two things have
 * to be placed from the sprite's own measured shape rather than eyeballed per creature, because the
 * roster spans bipeds, quadrupeds, oozes and swarms:
 *
 *   1. the sprite's rendered rect inside the stage (a `contain` fit, bottom-anchored), and
 *   2. the GROUNDING POOL — a soft shadow the creature stands in.
 *
 * All of it derives from {@link SpriteFraming}, which the cutout script (scripts/cutout.swift)
 * emits straight from the sprite's alpha channel. Keeping the geometry here — pure and separate from
 * the component — is what makes it unit-testable; the failure modes we hit building this (a
 * levitating creature, a pale foot near the rim, a pool that overshot a dog's head) were all wrong
 * numbers, and numbers are exactly what a test can pin.
 */

/**
 * A sprite's shape, measured from its alpha channel at cutout time. Fractions are of the trimmed
 * sprite's own dimensions (0 = left/top edge, 1 = right/bottom edge).
 */
export interface SpriteFraming {
  /** width / height of the trimmed sprite. */
  aspect: number;
  /** Leftmost ground contact, as a fraction of sprite width. */
  footLeft: number;
  /** Rightmost ground contact, as a fraction of sprite width. */
  footRight: number;
  /**
   * How far UP the sprite the ground contacts spread, as a fraction of height. A mid-stride biped or
   * a quadruped plants feet at different heights; the pool must be at least this deep to reach the
   * highest one instead of pooling under the lowest.
   */
  stanceDepth: number;
}

/** A rectangle in stage pixels. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface StageLayout {
  /** Where the sprite paints inside the stage. */
  sprite: Rect;
  /** The grounding-pool ellipse's bounding box. */
  pool: Rect;
}

/** How much the pool feathers out past the measured stance (1 = exactly the contacts). */
export const POOL_SPREAD = 1.25;
/** Pool depth as a multiple of the measured stance depth. */
export const POOL_DEPTH = 1.6;
/** Fraction of the pool's height that sits BELOW the sprite's baseline (the rest wraps up the feet). */
export const POOL_SINK = 0.34;

/**
 * Place the sprite and its grounding pool inside a stage of the given size.
 *
 * The sprite is `contain`-fitted (never cropped) and anchored to the stage's bottom, because the
 * cutout is trimmed so its bottom edge IS the creature's lowest point. The pool spans the two ground
 * contacts INDEPENDENTLY — a creature's feet aren't centred on its body, so a symmetric pool would
 * overshoot one side to reach the other — then feathers out by an equal amount on each side.
 *
 * @param scale semantic size (a cur is smaller than a wretch); 1 = fill the contain box.
 */
export function computeStageLayout(
  stageWidth: number,
  stageHeight: number,
  framing: SpriteFraming,
  scale = 1,
  opts: { spread?: number; depth?: number } = {},
): StageLayout {
  const spread = opts.spread ?? POOL_SPREAD;
  const depth = opts.depth ?? POOL_DEPTH;

  // contain fit: the limiting axis decides the rendered size.
  let renderW: number;
  let renderH: number;
  if (stageWidth / stageHeight > framing.aspect) {
    renderH = stageHeight;
    renderW = stageHeight * framing.aspect;
  } else {
    renderW = stageWidth;
    renderH = stageWidth / framing.aspect;
  }
  renderW *= scale;
  renderH *= scale;

  const spriteLeft = (stageWidth - renderW) / 2;
  const spriteTop = stageHeight - renderH; // bottom-anchored

  const sprite: Rect = {
    left: spriteLeft,
    top: spriteTop,
    width: renderW,
    height: renderH,
  };

  // Ground contacts in stage pixels, spanned independently, then feathered equally.
  const contactL = spriteLeft + renderW * framing.footLeft;
  const contactR = spriteLeft + renderW * framing.footRight;
  const pad = ((contactR - contactL) * (spread - 1)) / 2;
  const poolLeft = contactL - pad;
  const poolRight = contactR + pad;
  const poolW = poolRight - poolLeft;
  const poolH = renderH * framing.stanceDepth * depth;

  const pool: Rect = {
    left: poolLeft,
    width: poolW,
    height: poolH,
    // straddle the baseline so the pool wraps the feet rather than sitting entirely under them.
    top: stageHeight - poolH * (1 - POOL_SINK),
  };

  return { sprite, pool };
}
