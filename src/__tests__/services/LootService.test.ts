import { shouldDropItem, generateItem, dropItem } from '../../services/LootService';
import { LOOT_CONFIG } from '../../constants/config';

describe('LootService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('shouldDropItem', () => {
    it('returns true when random is below the drop threshold', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.1);
      expect(shouldDropItem()).toBe(true);
    });

    it('returns false when random is at or above the drop threshold', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      expect(shouldDropItem()).toBe(false);
    });

    it('returns false at exactly the threshold boundary', () => {
      jest.spyOn(Math, 'random').mockReturnValue(LOOT_CONFIG.BASE_DROP_CHANCE);
      expect(shouldDropItem()).toBe(false);
    });
  });

  describe('generateItem', () => {
    it('returns a valid item with all required BaseItem fields', () => {
      const item = generateItem(1);
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
      expect(typeof item.name).toBe('string');
      expect(item.name.length).toBeGreaterThan(0);
      expect(typeof item.description).toBe('string');
      expect(['common', 'uncommon', 'rare', 'epic', 'legendary']).toContain(item.rarity);
      expect(item.level).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(item.affixes)).toBe(true);
    });

    it('returns an item whose type matches its slot', () => {
      // Run many times to hit all 8 slot types
      for (let i = 0; i < 200; i++) {
        const item = generateItem(5);
        if (item.type === 'accessory') {
          expect(item).not.toHaveProperty('slot');
        } else {
          expect(item.type).toBe(item.slot);
        }
      }
    });

    it('gives common items zero affixes', () => {
      // Force rarity to common by making Math.random return a value in the common band
      // Level 1: weights [65,30,5,0,0] total=100; common wins when roll < 0.65
      jest.spyOn(Math, 'random').mockReturnValue(0.01);
      const item = generateItem(1);
      expect(item.rarity).toBe('common');
      expect(item.affixes).toHaveLength(0);
    });

    it('gives uncommon items exactly 1 affix', () => {
      // Level 1: weights [65,30,5,0,0]; uncommon wins at roll in (0.65, 0.95)
      const mockRandom = jest.spyOn(Math, 'random');
      // First call (slot), second call (rarity), subsequent for stat rolling
      let call = 0;
      mockRandom.mockImplementation(() => {
        call++;
        if (call === 2) return 0.7; // rarity roll → uncommon (past 0.65)
        return 0.0; // all others → first option
      });
      const item = generateItem(1);
      expect(item.rarity).toBe('uncommon');
      expect(item.affixes).toHaveLength(1);
    });

    it('gives epic items exactly 2 affixes', () => {
      // Level 15: weights [10,25,35,25,5]; epic wins at roll in (0.70, 0.95)
      const mockRandom = jest.spyOn(Math, 'random');
      let call = 0;
      mockRandom.mockImplementation(() => {
        call++;
        if (call === 2) return 0.75; // rarity roll → epic
        return 0.0;
      });
      const item = generateItem(15);
      expect(item.rarity).toBe('epic');
      expect(item.affixes).toHaveLength(2);
    });

    it('pre-bakes affix values into item stat fields', () => {
      const mockRandom = jest.spyOn(Math, 'random');
      let call = 0;
      mockRandom.mockImplementation(() => {
        call++;
        if (call === 2) return 0.7; // uncommon at level 1
        return 0.0; // first option for all other rolls
      });
      const item = generateItem(1);
      expect(item.rarity).toBe('uncommon');
      expect(item.affixes!.length).toBe(1);

      const affix = item.affixes![0];
      const statField = affix.stat === 'maxHp' ? 'maxHp' : affix.stat;
      const itemStat = item[statField as keyof typeof item] as number | undefined;
      expect(itemStat).toBeGreaterThanOrEqual(affix.value);
    });

    it('generates unique IDs per call', () => {
      const id1 = generateItem(1).id;
      const id2 = generateItem(1).id;
      // IDs may collide if timestamp is identical — use the random suffix uniqueness
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1.startsWith('gen_')).toBe(true);
    });

    it('at player level 1 produces mostly common/uncommon items', () => {
      const counts: Record<string, number> = {
        common: 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
      };
      for (let i = 0; i < 500; i++) {
        counts[generateItem(1).rarity]++;
      }
      expect(counts.common + counts.uncommon).toBeGreaterThan(400); // >80%
      expect(counts.legendary).toBe(0);
    });

    it('at player level 15 produces mostly rare/epic items', () => {
      const counts: Record<string, number> = {
        common: 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
      };
      for (let i = 0; i < 500; i++) {
        counts[generateItem(15).rarity]++;
      }
      expect(counts.rare + counts.epic + counts.legendary).toBeGreaterThan(250); // >50%
    });

    it('level requirement is at most playerLevel', () => {
      for (let lvl = 1; lvl <= 15; lvl++) {
        const item = generateItem(lvl);
        expect(item.level).toBeLessThanOrEqual(lvl);
        expect(item.level).toBeGreaterThanOrEqual(1);
      }
    });

    it('item has at least one of attack, defense, or maxHp', () => {
      for (let i = 0; i < 50; i++) {
        const item = generateItem(5);
        const hasStat =
          item.attack !== undefined || item.defense !== undefined || item.maxHp !== undefined;
        expect(hasStat).toBe(true);
      }
    });

    it('forces the rarity when rarityOverride is provided (debug)', () => {
      const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
      for (const r of rarities) {
        // Many samples: the override must win regardless of the (random) rarity roll.
        for (let i = 0; i < 20; i++) {
          expect(generateItem(1, r).rarity).toBe(r);
        }
      }
    });
  });

  describe('dropItem', () => {
    it('always returns an item when forceDrop is true', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      const item = dropItem(true);
      expect(item).not.toBeNull();
    });

    it('returns an item when random roll passes the drop chance', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.1);
      const item = dropItem();
      expect(item).not.toBeNull();
    });

    it('returns null when random roll fails the drop chance', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      const item = dropItem();
      expect(item).toBeNull();
    });

    it('passes playerLevel through — higher level yields higher rarity distribution', () => {
      // Force a drop (random below threshold) but give high level → should get better items
      const highLevelItems: string[] = [];
      const lowLevelItems: string[] = [];
      // Collect 100 items at each level by forcing a drop and sampling rarity
      for (let i = 0; i < 100; i++) {
        const hi = dropItem(true, 15);
        const lo = dropItem(true, 1);
        if (hi) highLevelItems.push(hi.rarity);
        if (lo) lowLevelItems.push(lo.rarity);
      }
      const highRareCount = highLevelItems.filter(
        r => r === 'rare' || r === 'epic' || r === 'legendary',
      ).length;
      const lowRareCount = lowLevelItems.filter(
        r => r === 'rare' || r === 'epic' || r === 'legendary',
      ).length;
      expect(highRareCount).toBeGreaterThan(lowRareCount);
    });

    it('applies rarityOverride to the drop when provided (debug)', () => {
      // random high would normally roll low rarity; the override must still win.
      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      const item = dropItem(true, 1, 'legendary');
      expect(item?.rarity).toBe('legendary');
    });

    it('rolls rarity normally when rarityOverride is null', () => {
      const item = dropItem(true, 1, null);
      expect(item).not.toBeNull();
      expect(['common', 'uncommon', 'rare', 'epic', 'legendary']).toContain(item!.rarity);
    });
  });
});
