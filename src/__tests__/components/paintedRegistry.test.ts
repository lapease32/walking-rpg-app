import {
  resolvePaintedCreature,
  PAINTED_CREATURES,
} from '../../components/combat/creatures/paintedRegistry';

describe('resolvePaintedCreature — the art follows the sun', () => {
  it('returns undefined for a creature with no painted art (falls back to the plate)', () => {
    expect(resolvePaintedCreature('not_a_creature', false)).toBeUndefined();
    expect(resolvePaintedCreature(undefined, false)).toBeUndefined();
  });

  it('shows the day key by day when one exists, with no gloom', () => {
    const r = resolvePaintedCreature('ash_wretch', true)!;
    expect(r.key).toBe(PAINTED_CREATURES.ash_wretch.day);
    expect(r.gloom).toBe(false);
  });

  it('shows the night key by night, with no gloom', () => {
    const r = resolvePaintedCreature('ash_wretch', false)!;
    expect(r.key).toBe(PAINTED_CREATURES.ash_wretch.night);
    expect(r.gloom).toBe(false);
  });

  it('falls back to night art in daylight for a night-ONLY creature, WITH gloom', () => {
    // Simulate a creature that has no day key yet by reading the night key directly:
    // the resolver must gloom when daylight is true and no day art exists.
    const nightOnly = { ...PAINTED_CREATURES.ash_wretch, day: undefined };
    const orig = PAINTED_CREATURES.mock_night_only;
    (PAINTED_CREATURES as Record<string, unknown>).mock_night_only = nightOnly;
    try {
      const r = resolvePaintedCreature('mock_night_only', true)!;
      expect(r.key).toBe(nightOnly.night);
      expect(r.gloom).toBe(true);
    } finally {
      if (orig === undefined) {
        delete (PAINTED_CREATURES as Record<string, unknown>).mock_night_only;
      }
    }
  });

  it('applies no gloom when the sun is unknown (debug force / test), using night art', () => {
    const r = resolvePaintedCreature('ash_wretch', undefined)!;
    expect(r.key).toBe(PAINTED_CREATURES.ash_wretch.night);
    expect(r.gloom).toBe(false);
  });

  it('carries the creature scale through', () => {
    const r = resolvePaintedCreature('ash_wretch', false)!;
    expect(r.scale).toBe(PAINTED_CREATURES.ash_wretch.scale);
  });
});

describe('PAINTED_CREATURES registry integrity', () => {
  it('every creature has a night key with valid framing', () => {
    for (const [id, c] of Object.entries(PAINTED_CREATURES)) {
      expect(c.night.source).toBeDefined();
      expect(c.night.framing.aspect).toBeGreaterThan(0);
      expect(c.night.framing.footLeft).toBeLessThan(c.night.framing.footRight);
      expect(c.night.framing.stanceDepth).toBeGreaterThan(0);
      expect(c.scale).toBeGreaterThan(0);
      // a present day key must also be well-formed
      if (c.day) {
        expect(c.day.framing.footLeft).toBeLessThan(c.day.framing.footRight);
      }
      expect(id).toMatch(/^[a-z_]+$/);
    }
  });
});
