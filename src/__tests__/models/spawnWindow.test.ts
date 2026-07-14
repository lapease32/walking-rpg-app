import {
  CREATURE_TEMPLATES,
  SPAWN_WINDOW_BY_TYPE,
  spawnWindowFor,
  canSpawnAt,
  pickEncounterTemplateOfRarity,
  type Rarity,
} from '../../models/Creature';

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic'];

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

describe('canSpawnAt', () => {
  it('day creatures spawn only in daylight, night creatures only in the dark', () => {
    expect(canSpawnAt({ type: 'Beast' }, true)).toBe(true);
    expect(canSpawnAt({ type: 'Beast' }, false)).toBe(false);
    expect(canSpawnAt({ type: 'Undead' }, false)).toBe(true);
    expect(canSpawnAt({ type: 'Undead' }, true)).toBe(false);
  });

  it('"any" creatures spawn in both', () => {
    expect(canSpawnAt({ type: 'Ooze' }, true)).toBe(true);
    expect(canSpawnAt({ type: 'Ooze' }, false)).toBe(true);
  });
});

describe('the roster is spawnable around the clock', () => {
  // If a rarity had no eligible creature at some time of day, the picker would fall back to the
  // unfiltered pool — correct, but it would silently defeat the feature. Assert we never rely on it.
  it.each(RARITIES)('%s has at least one creature by day AND by night', rarity => {
    const pool = CREATURE_TEMPLATES.filter(t => t.rarity === rarity);
    expect(pool.filter(t => canSpawnAt(t, true)).length).toBeGreaterThan(0);
    expect(pool.filter(t => canSpawnAt(t, false)).length).toBeGreaterThan(0);
  });
});

describe('pickEncounterTemplateOfRarity — time of day is COSMETIC', () => {
  // The load-bearing guarantee. Time of day must change WHICH creature you meet and never how
  // rewarding it is: rewarding night walking would push players to walk alone in the dark.
  it.each(RARITIES)('always returns the requested rarity, day or night (%s)', rarity => {
    for (let i = 0; i < 60; i++) {
      expect(pickEncounterTemplateOfRarity(rarity, true).rarity).toBe(rarity);
      expect(pickEncounterTemplateOfRarity(rarity, false).rarity).toBe(rarity);
    }
  });

  it('only ever returns creatures eligible for the given time', () => {
    for (let i = 0; i < 80; i++) {
      expect(canSpawnAt(pickEncounterTemplateOfRarity('common', true), true)).toBe(true);
      expect(canSpawnAt(pickEncounterTemplateOfRarity('common', false), false)).toBe(true);
    }
  });

  it('actually produces DIFFERENT creatures by day than by night', () => {
    const byDay = new Set<string>();
    const byNight = new Set<string>();
    for (let i = 0; i < 200; i++) {
      byDay.add(pickEncounterTemplateOfRarity('common', true).id);
      byNight.add(pickEncounterTemplateOfRarity('common', false).id);
    }
    // Day-only creatures (e.g. Alley Cur) must never turn up at night, and vice versa.
    expect(byDay.has('alley_cur')).toBe(true);
    expect(byNight.has('alley_cur')).toBe(false);
    expect(byNight.has('ash_wretch')).toBe(true);
    expect(byDay.has('ash_wretch')).toBe(false);
  });

  it('applies no filter when the caller has no sun information (debug / tests)', () => {
    // `undefined` daylight must not narrow anything — debug encounter-forcing relies on this.
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) {
      ids.add(pickEncounterTemplateOfRarity('common').id);
    }
    expect(ids.has('alley_cur')).toBe(true); // a day creature
    expect(ids.has('ash_wretch')).toBe(true); // a night creature — both reachable
  });
});
