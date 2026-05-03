import { shouldDropItem, selectRandomItem, dropItem } from '../../services/LootService';
import { ALL_ITEMS } from '../../models/items';
import { LOOT_CONFIG } from '../../constants/config';

describe('LootService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('shouldDropItem', () => {
    it('returns true when Math.random is below the drop threshold', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.1);
      expect(shouldDropItem()).toBe(true);
    });

    it('returns false when Math.random is at or above the drop threshold', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      expect(shouldDropItem()).toBe(false);
    });

    it('returns false at exactly the threshold boundary', () => {
      jest.spyOn(Math, 'random').mockReturnValue(LOOT_CONFIG.BASE_DROP_CHANCE); // not < threshold
      expect(shouldDropItem()).toBe(false);
    });
  });

  describe('selectRandomItem', () => {
    it('returns a non-null item from the item pool', () => {
      const item = selectRandomItem();
      expect(item).not.toBeNull();
    });

    it('returns an item that exists in ALL_ITEMS', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      const item = selectRandomItem();
      expect(ALL_ITEMS.some(i => i.id === item?.id)).toBe(true);
    });

    it('returns a shallow copy, not the original reference', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      const item1 = selectRandomItem();
      const item2 = selectRandomItem();
      // Same content but different objects
      expect(item1).toEqual(item2);
      expect(item1).not.toBe(item2);
    });
  });

  describe('dropItem', () => {
    it('always returns an item when forceDrop is true', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.99); // would fail normal check
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
  });
});
