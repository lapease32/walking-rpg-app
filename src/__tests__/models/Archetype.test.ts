import { Archetype, ARCHETYPE_CONFIGS } from '../../models/Archetype';

describe('Archetype', () => {
  it('keeps stable enum IDs — these are persisted in saves and used as E2E testIDs, so they must not change', () => {
    expect(Archetype.Martial).toBe('martial');
    expect(Archetype.Agile).toBe('agile');
    expect(Archetype.Mage).toBe('mage');
  });

  it('exposes the player-facing display names', () => {
    expect(ARCHETYPE_CONFIGS[Archetype.Martial].name).toBe('Warrior');
    expect(ARCHETYPE_CONFIGS[Archetype.Agile].name).toBe('Rogue');
    expect(ARCHETYPE_CONFIGS[Archetype.Mage].name).toBe('Mage');
  });

  it('defines a complete config (non-empty name + expected resource) for every archetype', () => {
    const expectedResource: Record<Archetype, string> = {
      [Archetype.Martial]: 'rage',
      [Archetype.Agile]: 'energy',
      [Archetype.Mage]: 'mana',
    };
    for (const archetype of Object.values(Archetype)) {
      const cfg = ARCHETYPE_CONFIGS[archetype];
      expect(cfg).toBeDefined();
      expect(typeof cfg.name).toBe('string');
      expect(cfg.name.length).toBeGreaterThan(0);
      expect(cfg.resource).toBe(expectedResource[archetype]);
    }
  });
});
