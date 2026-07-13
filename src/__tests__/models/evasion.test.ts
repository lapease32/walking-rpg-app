import {
  rollEvasion,
  applyEvasionDamage,
  EVASION_CONFIG,
  type EvadeOutcome,
} from '../../models/evasion';

// A deterministic rng returning a fixed value, so each branch is exercised precisely.
const fixed = (v: number) => () => v;

describe('rollEvasion — outcome bands', () => {
  // Equal speed, creature defender: dodge = base 0.03, glance = base 0.08 → bands
  // [0, 0.03) dodged · [0.03, 0.11) glancing · [0.11, 1) normal.
  const params = {
    attackerSpeed: 10,
    defenderSpeed: 10,
    defender: 'creature' as const,
    dodgeStreak: 0,
  };

  it('dodges when the roll falls in the dodge band', () => {
    expect(rollEvasion({ ...params, rng: fixed(0.0) }).outcome).toBe('dodged');
    expect(rollEvasion({ ...params, rng: fixed(0.029) }).outcome).toBe('dodged');
  });

  it('glances in the band above dodge', () => {
    expect(rollEvasion({ ...params, rng: fixed(0.03) }).outcome).toBe('glancing');
    expect(rollEvasion({ ...params, rng: fixed(0.1) }).outcome).toBe('glancing');
  });

  it('is a normal hit above the evasion bands', () => {
    expect(rollEvasion({ ...params, rng: fixed(0.11) }).outcome).toBe('normal');
    expect(rollEvasion({ ...params, rng: fixed(0.99) }).outcome).toBe('normal');
  });
});

describe('rollEvasion — dodge streak (PRD)', () => {
  const base = { attackerSpeed: 10, defenderSpeed: 10, defender: 'creature' as const };

  it('resets the streak to 0 on a dodge, increments it otherwise', () => {
    // At streak 5 the dodge band is ramped to the 0.08 cap, so pick rolls clear of it:
    // 0.0 dodges (reset), 0.10 glances, 0.9 is a normal hit — the latter two both increment.
    expect(rollEvasion({ ...base, dodgeStreak: 5, rng: fixed(0.0) }).nextDodgeStreak).toBe(0);
    expect(rollEvasion({ ...base, dodgeStreak: 5, rng: fixed(0.1) }).nextDodgeStreak).toBe(6); // glancing
    expect(rollEvasion({ ...base, dodgeStreak: 5, rng: fixed(0.9) }).nextDodgeStreak).toBe(6); // normal
  });

  it('raises the dodge chance as the non-dodge streak grows (rising until it procs)', () => {
    // At streak 0 a roll of 0.04 is above the 0.03 dodge band (glancing). With a streak, the ramped
    // dodge chance (0.03 × (1 + 0.5·streak)) climbs past 0.04, flipping the same roll to a dodge.
    expect(rollEvasion({ ...base, dodgeStreak: 0, rng: fixed(0.04) }).outcome).toBe('glancing');
    expect(rollEvasion({ ...base, dodgeStreak: 2, rng: fixed(0.04) }).outcome).toBe('dodged');
  });

  it('never ramps dodge chance past the defender cap', () => {
    // A huge streak would blow past the cap without the clamp; a roll just above the cap must not dodge.
    const cap = EVASION_CONFIG.cap.creature.dodge;
    expect(rollEvasion({ ...base, dodgeStreak: 100, rng: fixed(cap + 0.001) }).outcome).not.toBe(
      'dodged',
    );
  });
});

describe('rollEvasion — player-favored + speed differential', () => {
  it('gives the player higher evasion ceilings than a creature at the same speed edge', () => {
    // Defender much faster than attacker → both hit their caps; the player's caps are higher.
    const fast = { attackerSpeed: 1, defenderSpeed: 100, dodgeStreak: 0 };
    // Roll just below the creature dodge cap but at/above where the player still dodges.
    const atCreatureCap = EVASION_CONFIG.cap.creature.dodge; // 0.08
    expect(
      rollEvasion({ ...fast, defender: 'creature', rng: fixed(atCreatureCap) }).outcome,
    ).not.toBe('dodged');
    expect(rollEvasion({ ...fast, defender: 'player', rng: fixed(atCreatureCap) }).outcome).toBe(
      'dodged',
    );
  });

  it('a slower defender evades less than a faster one (same roll)', () => {
    const roll = fixed(0.1);
    const slow = rollEvasion({
      attackerSpeed: 30,
      defenderSpeed: 5,
      defender: 'player',
      dodgeStreak: 0,
      rng: roll,
    });
    const fast = rollEvasion({
      attackerSpeed: 5,
      defenderSpeed: 30,
      defender: 'player',
      dodgeStreak: 0,
      rng: roll,
    });
    // The fast defender should evade (glance/dodge) where the slow one takes a normal hit.
    expect(slow.outcome).toBe('normal');
    expect(fast.outcome).not.toBe('normal');
  });
});

describe('applyEvasionDamage', () => {
  const cases: [EvadeOutcome, number, number][] = [
    ['normal', 20, 20],
    ['glancing', 20, 10],
    ['glancing', 21, 10], // floor(21 × 0.5)
    ['glancing', 1, 1], // never drops a glancing hit below 1
    ['dodged', 20, 0],
  ];
  it.each(cases)('%s of %d → %d', (outcome, base, expected) => {
    expect(applyEvasionDamage(base, outcome)).toBe(expected);
  });
});
