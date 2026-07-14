import {
  CREATURE_TEMPLATES,
  SPAWN_WINDOW_BY_TYPE,
  SPAWN_WEIGHTS,
  spawnWindowFor,
  spawnWeightAt,
  pickEncounterTemplateOfRarity,
  type Rarity,
} from '../../models/Creature';

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic'];

/** Sample the picker many times and count which creatures came back. */
function sample(rarity: Rarity, daylight: boolean, n = 4000): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const id = pickEncounterTemplateOfRarity(rarity, daylight).id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

describe('spawnWindowFor', () => {
  it('defaults from the creature type — the type already encodes mundane vs supernatural', () => {
    expect(spawnWindowFor({ type: 'Beast' })).toBe('day'); // a feral dog could exist
    expect(spawnWindowFor({ type: 'Undead' })).toBe('night'); // a wretch should not
    expect(spawnWindowFor({ type: 'Ooze' })).toBe('any'); // liminal
  });

  it('an explicit spawnWindow on the template overrides its type default', () => {
    expect(spawnWindowFor({ type: 'Earth', spawnWindow: 'any' })).toBe('any');
    expect(spawnWindowFor({ type: 'Beast', spawnWindow: 'night' })).toBe('night');
  });

  it('falls back to "any" for an unknown type rather than making a creature unspawnable', () => {
    expect(spawnWindowFor({ type: 'Voidstuff' })).toBe('any');
  });

  it('every type in the roster has a declared window', () => {
    const types = Array.from(new Set(CREATURE_TEMPLATES.map(t => t.type)));
    for (const type of types) {
      expect(SPAWN_WINDOW_BY_TYPE[type]).toBeDefined();
    }
  });
});

describe('spawnWeightAt — a weighting, not a gate', () => {
  it('weights a creature heavily toward its own window', () => {
    expect(spawnWeightAt({ type: 'Beast' }, true)).toBe(SPAWN_WEIGHTS.inWindow);
    expect(spawnWeightAt({ type: 'Undead' }, false)).toBe(SPAWN_WEIGHTS.inWindow);
  });

  it('still allows a creature out of its window — rare, but the world is not a clock', () => {
    expect(spawnWeightAt({ type: 'Beast' }, false)).toBe(SPAWN_WEIGHTS.offWindow);
    expect(spawnWeightAt({ type: 'Undead' }, true)).toBe(SPAWN_WEIGHTS.offWindow);
  });

  it('NEVER returns zero — every creature stays possible at every hour', () => {
    for (const template of CREATURE_TEMPLATES) {
      expect(spawnWeightAt(template, true)).toBeGreaterThan(0);
      expect(spawnWeightAt(template, false)).toBeGreaterThan(0);
    }
  });

  it('is far more likely in-window than out (that is what makes day and night feel distinct)', () => {
    expect(SPAWN_WEIGHTS.inWindow / SPAWN_WEIGHTS.offWindow).toBeGreaterThan(4);
  });

  it('"any" creatures are equally at home in either light', () => {
    expect(spawnWeightAt({ type: 'Ooze' }, true)).toBe(spawnWeightAt({ type: 'Ooze' }, false));
  });
});

describe('pickEncounterTemplateOfRarity — weighted selection', () => {
  it('walks the weighted pool in order for a given roll (deterministic rng)', () => {
    // rng ≈ 0 must land on the first template of the rarity; ≈ 1 on the last.
    const commons = CREATURE_TEMPLATES.filter(t => t.rarity === 'common');
    expect(pickEncounterTemplateOfRarity('common', true, () => 0).id).toBe(commons[0].id);
    expect(pickEncounterTemplateOfRarity('common', true, () => 0.999999).id).toBe(
      commons[commons.length - 1].id,
    );
  });

  it('applies no weighting when the caller has no sun information (debug forcing)', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 300; i++) {
      ids.add(pickEncounterTemplateOfRarity('common').id);
    }
    expect(ids.has('alley_cur')).toBe(true); // a day creature
    expect(ids.has('ash_wretch')).toBe(true); // a night creature — both freely reachable
  });
});

describe('TIME OF DAY IS COSMETIC — it must never touch balance', () => {
  // The load-bearing guarantee: time changes WHICH creature you meet, never how rewarding it is.
  // Rewarding night walking would push players to walk alone in the dark.
  it.each(RARITIES)('always returns the requested rarity, day or night (%s)', rarity => {
    for (let i = 0; i < 60; i++) {
      expect(pickEncounterTemplateOfRarity(rarity, true).rarity).toBe(rarity);
      expect(pickEncounterTemplateOfRarity(rarity, false).rarity).toBe(rarity);
    }
  });
});

describe('the resulting feel', () => {
  it('day is dominated by mundane creatures, but a supernatural one still turns up', () => {
    const counts = sample('common', true);
    const cur = counts.get('alley_cur') ?? 0; // Beast — day
    const wretch = counts.get('ash_wretch') ?? 0; // Undead — night, out of place
    expect(cur).toBeGreaterThan(wretch * 3); // strongly favoured…
    expect(wretch).toBeGreaterThan(0); // …but the wretch is still out there
  });

  it('night is dominated by supernatural creatures, but a stray dog still wanders through', () => {
    const counts = sample('common', false);
    const wretch = counts.get('ash_wretch') ?? 0; // Undead — night
    const cur = counts.get('alley_cur') ?? 0; // Beast — day, out of place
    expect(wretch).toBeGreaterThan(cur * 3);
    expect(cur).toBeGreaterThan(0);
  });

  it('the same creature is much likelier in its own window than outside it', () => {
    const byDay = sample('common', true).get('alley_cur') ?? 0;
    const byNight = sample('common', false).get('alley_cur') ?? 0;
    expect(byDay).toBeGreaterThan(byNight * 3);
  });

  it('every creature of a rarity remains reachable at both times', () => {
    for (const daylight of [true, false]) {
      const seen = sample('common', daylight, 6000);
      const commons = CREATURE_TEMPLATES.filter(t => t.rarity === 'common');
      for (const t of commons) {
        expect(seen.get(t.id) ?? 0).toBeGreaterThan(0);
      }
    }
  });
});
