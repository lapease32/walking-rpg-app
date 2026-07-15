import { computeStageLayout, POOL_SPREAD, type SpriteFraming } from '../../models/stageLayout';

// A tall biped (the Ash Wretch, night key) and a wide quadruped (the Alley Cur) — the two shapes
// that broke every symmetric-pool assumption while this was being built.
const BIPED: SpriteFraming = { aspect: 0.87, footLeft: 0.02, footRight: 0.88, stanceDepth: 0.22 };
const QUADRUPED: SpriteFraming = {
  aspect: 1.28,
  footLeft: 0.2,
  footRight: 0.91,
  stanceDepth: 0.21,
};

describe('computeStageLayout — sprite placement', () => {
  it('contain-fits a portrait sprite by its width when the stage is wider than it', () => {
    // stage 400×400 (1:1), sprite aspect 0.87 (taller than wide) → limited by height.
    const { sprite } = computeStageLayout(400, 400, BIPED);
    expect(sprite.height).toBeCloseTo(400);
    expect(sprite.width).toBeCloseTo(400 * 0.87);
    // never cropped: both dimensions fit inside the stage.
    expect(sprite.width).toBeLessThanOrEqual(400);
    expect(sprite.height).toBeLessThanOrEqual(400);
  });

  it('contain-fits a landscape sprite by its height-limited width correctly', () => {
    // stage 400×400, quadruped aspect 1.28 (wider than tall) → limited by width.
    const { sprite } = computeStageLayout(400, 400, QUADRUPED);
    expect(sprite.width).toBeCloseTo(400);
    expect(sprite.height).toBeCloseTo(400 / 1.28);
    expect(sprite.width).toBeLessThanOrEqual(400);
    expect(sprite.height).toBeLessThanOrEqual(400);
  });

  it('anchors the sprite to the stage bottom (feet on the floor, not floating)', () => {
    const { sprite } = computeStageLayout(400, 500, BIPED);
    expect(sprite.top + sprite.height).toBeCloseTo(500);
  });

  it('centres the sprite horizontally', () => {
    const { sprite } = computeStageLayout(400, 500, BIPED);
    expect(sprite.left + sprite.width / 2).toBeCloseTo(200);
  });

  it('shrinks the sprite by scale but keeps it planted and centred', () => {
    const full = computeStageLayout(400, 500, BIPED, 1);
    const half = computeStageLayout(400, 500, BIPED, 0.5);
    expect(half.sprite.width).toBeCloseTo(full.sprite.width * 0.5);
    expect(half.sprite.height).toBeCloseTo(full.sprite.height * 0.5);
    expect(half.sprite.top + half.sprite.height).toBeCloseTo(500); // still on the floor
    expect(half.sprite.left + half.sprite.width / 2).toBeCloseTo(200); // still centred
  });
});

describe('computeStageLayout — grounding pool', () => {
  it('spans the two ground contacts, not the whole sprite', () => {
    // spread = 1 → pool exactly the contacts.
    const { sprite, pool } = computeStageLayout(400, 400, QUADRUPED, 1, { spread: 1 });
    const contactL = sprite.left + sprite.width * QUADRUPED.footLeft;
    const contactR = sprite.left + sprite.width * QUADRUPED.footRight;
    expect(pool.left).toBeCloseTo(contactL);
    expect(pool.left + pool.width).toBeCloseTo(contactR);
  });

  it('is ASYMMETRIC about the sprite centre for an off-centre stance (the Cur case)', () => {
    // QUADRUPED contacts 0.20..0.91 are biased right of centre; the pool must follow, not straddle
    // the body midline (which is what overshot the dog's head).
    const { sprite, pool } = computeStageLayout(400, 400, QUADRUPED, 1, { spread: 1 });
    const spriteMid = sprite.left + sprite.width / 2;
    const poolMid = pool.left + pool.width / 2;
    expect(poolMid).toBeGreaterThan(spriteMid);
  });

  it('feathers out symmetrically from the contacts as spread grows', () => {
    const tight = computeStageLayout(400, 400, BIPED, 1, { spread: 1 });
    const wide = computeStageLayout(400, 400, BIPED, 1, { spread: 1.5 });
    // same centre, wider span.
    const tightMid = tight.pool.left + tight.pool.width / 2;
    const wideMid = wide.pool.left + wide.pool.width / 2;
    expect(wideMid).toBeCloseTo(tightMid);
    expect(wide.pool.width).toBeGreaterThan(tight.pool.width);
  });

  it('deepens with the measured stance depth so raised back feet are reached', () => {
    const shallow = computeStageLayout(400, 400, { ...BIPED, stanceDepth: 0.1 });
    const deep = computeStageLayout(400, 400, { ...BIPED, stanceDepth: 0.3 });
    expect(deep.pool.height).toBeGreaterThan(shallow.pool.height);
  });

  it('straddles the baseline — part below the feet, part wrapping up them', () => {
    const { pool } = computeStageLayout(400, 400, BIPED);
    expect(pool.top).toBeLessThan(400); // starts above the baseline
    expect(pool.top + pool.height).toBeGreaterThan(400); // extends below it
  });

  it('defaults to the module spread constant when none is given', () => {
    const explicit = computeStageLayout(400, 400, BIPED, 1, { spread: POOL_SPREAD });
    const defaulted = computeStageLayout(400, 400, BIPED);
    expect(defaulted.pool.width).toBeCloseTo(explicit.pool.width);
  });
});
