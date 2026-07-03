import { mitigateDamage } from '../../models/combat';

describe('mitigateDamage — ratio-based defense mitigation', () => {
  it('applies no mitigation when defense is 0 (full attack)', () => {
    expect(mitigateDamage(40, 0)).toBe(40);
    expect(mitigateDamage(7, 0)).toBe(7);
  });

  it('halves the hit when defense equals the attack', () => {
    expect(mitigateDamage(40, 40)).toBe(20);
    expect(mitigateDamage(100, 100)).toBe(50);
  });

  it('diminishes strictly with more defense (every point helps, never wasted)', () => {
    const seq = [0, 10, 25, 40, 80, 160].map(def => mitigateDamage(40, def));
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeLessThan(seq[i - 1]);
    }
    // exact curve for attack 40
    expect(mitigateDamage(40, 10)).toBe(32);
    expect(mitigateDamage(40, 25)).toBe(24);
    expect(mitigateDamage(40, 80)).toBe(13);
  });

  it('NEVER hard-walls to 1 (the whole point) — high defense still scales with attack', () => {
    // Old subtractive `max(1, attack - defense)` returned 1 for every one of these.
    expect(mitigateDamage(40, 40)).toBe(20); // was 1 (defense == attack)
    expect(mitigateDamage(40, 80)).toBe(13); // was 1
    expect(mitigateDamage(40, 200)).toBeGreaterThan(1); // 6 — proportional, not chipped to 1
    expect(mitigateDamage(20, 100)).toBe(3); // was 1 — no immunity from stacking defense
  });

  it('applies the damage multiplier to the mitigated hit', () => {
    expect(mitigateDamage(40, 40, 2)).toBe(40); // 20 * 2
    expect(mitigateDamage(40, 0, 1.5)).toBe(60); // 40 * 1.5
  });

  it('returns integer damage with a min-1 display floor (a floor, not a wall)', () => {
    expect(Number.isInteger(mitigateDamage(37, 13))).toBe(true);
    // genuinely tiny hit floors to 1 — but this is a real floor, damage scales smoothly above it
    expect(mitigateDamage(1, 1000)).toBe(1);
  });

  it('clamps negative inputs defensively', () => {
    expect(mitigateDamage(40, -5)).toBe(40); // negative defense → treated as 0
    expect(mitigateDamage(-5, 10)).toBe(1); // negative attack → 0 → min-1 floor
  });
});
