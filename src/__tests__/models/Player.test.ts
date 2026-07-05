import { Player, Archetype } from '../../models/Player';
import { PLAYER_CONFIG } from '../../constants/config';
import {
  ARCHETYPE_CONFIGS,
  computeAttributes,
  deriveAttack,
  deriveDefense,
  deriveMaxHp,
} from '../../models/Archetype';
import { WeaponItem, AccessoryItem } from '../../models/Item';

const makeWeapon = (overrides: Partial<WeaponItem> = {}): WeaponItem => ({
  id: 'test_sword',
  name: 'Test Sword',
  description: 'A test weapon',
  rarity: 'common',
  level: 1,
  type: 'weapon',
  slot: 'weapon',
  attack: 10,
  dropChance: 0.1,
  ...overrides,
});

const makeAccessory = (overrides: Partial<AccessoryItem> = {}): AccessoryItem => ({
  id: 'test_ring',
  name: 'Test Ring',
  description: 'A test accessory',
  rarity: 'common',
  level: 1,
  type: 'accessory',
  dropChance: 0.1,
  ...overrides,
});

describe('Player', () => {
  describe('constructor', () => {
    it('creates a Martial player with correct level 1 stats', () => {
      const player = new Player();
      const { str, agi, int } = computeAttributes(Archetype.Martial, 1);
      expect(player.archetype).toBe(Archetype.Martial);
      expect(player.level).toBe(1);
      expect(player.str).toBe(str);
      expect(player.agi).toBe(agi);
      expect(player.int).toBe(int);
      expect(player.attack).toBe(deriveAttack(str, agi));
      expect(player.defense).toBe(deriveDefense(str, agi));
      expect(player.maxHp).toBe(deriveMaxHp(Archetype.Martial, str, agi));
      expect(player.hp).toBe(player.maxHp);
    });

    it('scales attributes and stats correctly at level 3', () => {
      const player = new Player({ level: 3 });
      const { str, agi, int } = computeAttributes(Archetype.Martial, 3);
      expect(player.str).toBe(str);
      expect(player.agi).toBe(agi);
      expect(player.int).toBe(int);
      expect(player.attack).toBe(deriveAttack(str, agi));
      expect(player.defense).toBe(deriveDefense(str, agi));
      expect(player.maxHp).toBe(deriveMaxHp(Archetype.Martial, str, agi));
    });

    it('uses explicit stats when provided', () => {
      const player = new Player({ attack: 50, defense: 25, hp: 200, maxHp: 200 });
      expect(player.attack).toBe(50);
      expect(player.defense).toBe(25);
      expect(player.hp).toBe(200);
    });

    it('caps hp at maxHp when hp exceeds maxHp', () => {
      const player = new Player({ hp: 9999, maxHp: 100 });
      expect(player.hp).toBe(100);
    });

    it('initializes a 50-slot inventory of nulls', () => {
      const player = new Player();
      expect(player.inventory).toHaveLength(50);
      expect(player.inventory.every(slot => slot === null)).toBe(true);
    });

    it('pads inventory shorter than 50 slots', () => {
      const player = new Player({ inventory: [] });
      expect(player.inventory).toHaveLength(50);
    });

    it('truncates inventory longer than 50 slots', () => {
      const inventory = Array(60).fill(null);
      const player = new Player({ inventory });
      expect(player.inventory).toHaveLength(50);
    });
  });

  describe('archetype differentiation', () => {
    it('Mage has lower maxHp than Martial at the same level', () => {
      const martial = new Player({ archetype: Archetype.Martial });
      const mage = new Player({ archetype: Archetype.Mage });
      expect(mage.maxHp).toBeLessThan(martial.maxHp);
    });

    it('Agile has lower maxHp than Martial but higher than Mage', () => {
      const martial = new Player({ archetype: Archetype.Martial });
      const agile = new Player({ archetype: Archetype.Agile });
      const mage = new Player({ archetype: Archetype.Mage });
      expect(agile.maxHp).toBeLessThan(martial.maxHp);
      expect(agile.maxHp).toBeGreaterThan(mage.maxHp);
    });

    it('Martial has higher STR than Mage at level 10', () => {
      const martial = new Player({ archetype: Archetype.Martial, level: 10 });
      const mage = new Player({ archetype: Archetype.Mage, level: 10 });
      expect(martial.str).toBeGreaterThan(mage.str);
    });

    it('Mage has higher INT than Martial at level 10', () => {
      const martial = new Player({ archetype: Archetype.Martial, level: 10 });
      const mage = new Player({ archetype: Archetype.Mage, level: 10 });
      expect(mage.int).toBeGreaterThan(martial.int);
    });

    it('each archetype has the correct resource type', () => {
      expect(ARCHETYPE_CONFIGS[Archetype.Martial].resource).toBe('rage');
      expect(ARCHETYPE_CONFIGS[Archetype.Agile].resource).toBe('energy');
      expect(ARCHETYPE_CONFIGS[Archetype.Mage].resource).toBe('mana');
    });
  });

  describe('setArchetype (debug class switch)', () => {
    it('recomputes attributes + derived stats to match a fresh player of the new class at the same level', () => {
      const switched = new Player({ archetype: Archetype.Martial, level: 10 });
      switched.setArchetype(Archetype.Mage);
      const freshMage = new Player({ archetype: Archetype.Mage, level: 10 });
      expect(switched.archetype).toBe(Archetype.Mage);
      expect(switched.str).toBe(freshMage.str);
      expect(switched.agi).toBe(freshMage.agi);
      expect(switched.int).toBe(freshMage.int);
      expect(switched.maxHp).toBe(freshMage.maxHp);
      expect(switched.attack).toBe(freshMage.attack);
      expect(switched.defense).toBe(freshMage.defense);
    });

    it('preserves level and tops HP up to the new maxHp', () => {
      const p = new Player({ archetype: Archetype.Martial, level: 8 });
      p.takeDamage(20);
      p.setArchetype(Archetype.Agile);
      expect(p.level).toBe(8);
      expect(p.hp).toBe(p.maxHp);
    });
  });

  describe('getExperienceForNextLevel', () => {
    it('returns 100 at level 1', () => {
      const player = new Player({ level: 1 });
      expect(player.getExperienceForNextLevel()).toBe(100);
    });

    it('returns correct exponential value at level 2', () => {
      const player = new Player({ level: 2 });
      expect(player.getExperienceForNextLevel()).toBe(Math.floor(100 * Math.pow(2, 1.5)));
    });

    it('grows larger at higher levels', () => {
      const level5 = new Player({ level: 5 });
      const level10 = new Player({ level: 10 });
      expect(level10.getExperienceForNextLevel()).toBeGreaterThan(
        level5.getExperienceForNextLevel(),
      );
    });
  });

  describe('addExperience / checkLevelUp', () => {
    it('accumulates experience without leveling up below threshold', () => {
      const player = new Player();
      player.addExperience(50);
      expect(player.level).toBe(1);
      expect(player.experience).toBe(50);
    });

    it('levels up and returns 1 when threshold is reached', () => {
      const player = new Player();
      const expNeeded = player.getExperienceForNextLevel();
      const levelsGained = player.addExperience(expNeeded);
      expect(levelsGained).toBe(1);
      expect(player.level).toBe(2);
      expect(player.experience).toBe(0);
    });

    it('levels up multiple times from a single large XP gain', () => {
      const player = new Player();
      const levelsGained = player.addExperience(9999);
      expect(levelsGained).toBeGreaterThan(1);
      expect(player.level).toBeGreaterThan(2);
    });

    it('increases attack, defense, and maxHp on level up', () => {
      const player = new Player();
      const attackBefore = player.attack;
      const defenseBefore = player.defense;
      const maxHpBefore = player.maxHp;
      player.addExperience(player.getExperienceForNextLevel());
      expect(player.attack).toBeGreaterThan(attackBefore);
      expect(player.defense).toBeGreaterThan(defenseBefore);
      expect(player.maxHp).toBeGreaterThan(maxHpBefore);
    });

    it('grows attributes by the archetype-specific amount per level', () => {
      const player = new Player({ archetype: Archetype.Martial });
      const strBefore = player.str;
      player.addExperience(player.getExperienceForNextLevel());
      // Martial grows 3 STR per level
      expect(player.str).toBe(strBefore + 3);
    });

    it('restores hp on level up by the maxHp delta', () => {
      const player = new Player({ hp: 50, maxHp: 100 });
      const maxHpBefore = player.maxHp;
      player.addExperience(player.getExperienceForNextLevel());
      const expectedHp = 50 + (player.maxHp - maxHpBefore);
      expect(player.hp).toBe(expectedHp);
    });

    it('does not restore hp past maxHp on level up', () => {
      const player = new Player();
      player.fullHeal();
      player.addExperience(player.getExperienceForNextLevel());
      expect(player.hp).toBe(player.maxHp);
    });
  });

  describe('calculateDamage', () => {
    // Ratio-based mitigation (see combat.ts mitigateDamage): attack² / (attack + defense).
    it('calculates base damage correctly', () => {
      const player = new Player({ attack: 20 });
      expect(player.calculateDamage(5)).toBe(16); // 20² / 25
    });

    it('applies damage multiplier and floors result', () => {
      const player = new Player({ attack: 20 });
      expect(player.calculateDamage(5, 1.5)).toBe(24); // floor(16 * 1.5)
    });

    it('enforces minimum of 1 damage', () => {
      const player = new Player({ attack: 5 });
      expect(player.calculateDamage(100)).toBe(1); // 25/105 → floor 0 → clamped to 1
    });
  });

  describe('takeDamage', () => {
    it('reduces hp by the damage amount', () => {
      const player = new Player({ hp: 100, maxHp: 100 });
      player.takeDamage(30);
      expect(player.hp).toBe(70);
    });

    it('clamps hp to 0, never negative', () => {
      const player = new Player({ hp: 10, maxHp: 100 });
      player.takeDamage(9999);
      expect(player.hp).toBe(0);
    });
  });

  describe('isDefeated', () => {
    it('returns false when hp is above 0', () => {
      const player = new Player({ hp: 1, maxHp: 100 });
      expect(player.isDefeated()).toBe(false);
    });

    it('returns true when hp reaches 0', () => {
      const player = new Player({ hp: 100, maxHp: 100 });
      player.takeDamage(100);
      expect(player.isDefeated()).toBe(true);
    });
  });

  describe('restoreHp / fullHeal', () => {
    it('restores hp by given amount', () => {
      const player = new Player({ hp: 50, maxHp: 100 });
      player.restoreHp(20);
      expect(player.hp).toBe(70);
    });

    it('caps restored hp at maxHp', () => {
      const player = new Player({ hp: 90, maxHp: 100 });
      player.restoreHp(50);
      expect(player.hp).toBe(100);
    });

    it('fullHeal sets hp to maxHp', () => {
      const player = new Player({ hp: 1, maxHp: 100 });
      player.fullHeal();
      expect(player.hp).toBe(100);
    });
  });

  describe('inventory management', () => {
    it('adds item to the first empty slot and returns its index', () => {
      const player = new Player();
      const weapon = makeWeapon();
      const index = player.addItemToInventory(weapon);
      expect(index).toBe(0);
      expect(player.inventory[0]).toBe(weapon);
    });

    it('returns -1 and does not add item when inventory is full', () => {
      const player = new Player();
      for (let i = 0; i < 50; i++) {
        player.inventory[i] = makeWeapon({ id: `item_${i}` });
      }
      expect(player.addItemToInventory(makeWeapon())).toBe(-1);
    });

    it('removes and returns the item at a given index', () => {
      const player = new Player();
      const weapon = makeWeapon();
      player.inventory[0] = weapon;
      const removed = player.removeItemFromInventory(0);
      expect(removed).toBe(weapon);
      expect(player.inventory[0]).toBeNull();
    });

    it('returns null when removing from an invalid index', () => {
      const player = new Player();
      expect(player.removeItemFromInventory(-1)).toBeNull();
      expect(player.removeItemFromInventory(50)).toBeNull();
    });

    it('reports correct empty and used slot counts', () => {
      const player = new Player();
      player.inventory[0] = makeWeapon();
      player.inventory[1] = makeWeapon({ id: 'item_2' });
      expect(player.getUsedInventorySlots()).toBe(2);
      expect(player.getEmptyInventorySlots()).toBe(48);
    });

    it('isInventoryFull returns true when all 50 slots occupied', () => {
      const player = new Player();
      for (let i = 0; i < 50; i++) {
        player.inventory[i] = makeWeapon({ id: `item_${i}` });
      }
      expect(player.isInventoryFull()).toBe(true);
    });

    it('clearInventory empties every slot, keeping slot count and equipped items', () => {
      const player = new Player();
      const equipped = makeWeapon({ id: 'equipped' });
      player.inventory[0] = equipped;
      player.equipItem(0); // moves it into equipment.weapon, slot 0 cleared
      player.inventory[0] = makeWeapon({ id: 'loot_a' });
      player.inventory[3] = makeWeapon({ id: 'loot_b' });
      expect(player.getUsedInventorySlots()).toBe(2);

      player.clearInventory();

      expect(player.getUsedInventorySlots()).toBe(0);
      expect(player.inventory.length).toBe(50);
      expect(player.equipment.weapon).toBe(equipped); // equipped item untouched
    });
  });

  describe('equipItem', () => {
    it('returns false for out-of-bounds inventory index', () => {
      const player = new Player();
      expect(player.equipItem(-1)).toBe(false);
      expect(player.equipItem(50)).toBe(false);
    });

    it('returns false when the inventory slot is empty', () => {
      const player = new Player();
      expect(player.equipItem(0)).toBe(false);
    });

    it('returns false when level requirement is not met', () => {
      const player = new Player({ level: 1 });
      player.inventory[0] = makeWeapon({ level: 5 });
      expect(player.equipItem(0)).toBe(false);
    });

    it('equips item, clears inventory slot, and returns true', () => {
      const player = new Player({ level: 1 });
      const weapon = makeWeapon({ level: 1 });
      player.inventory[0] = weapon;
      expect(player.equipItem(0)).toBe(true);
      expect(player.equipment.weapon).toBe(weapon);
      expect(player.inventory[0]).toBeNull();
    });

    it('applies stat bonus from equipped item via recalculateStats', () => {
      const player = new Player({ level: 1 });
      const baseAttack = player.attack;
      player.inventory[0] = makeWeapon({ level: 1, attack: 10 });
      player.equipItem(0);
      expect(player.attack).toBe(baseAttack + 10);
    });

    it('swaps the existing item back into inventory when equipping a new one', () => {
      const player = new Player({ level: 1 });
      const oldWeapon = makeWeapon({ id: 'old', level: 1 });
      const newWeapon = makeWeapon({ id: 'new', level: 1 });
      player.inventory[0] = oldWeapon;
      player.equipItem(0);
      player.inventory[1] = newWeapon;
      player.equipItem(1);
      expect(player.equipment.weapon).toBe(newWeapon);
      expect(player.inventory.some(i => i?.id === 'old')).toBe(true);
    });

    it('fills accessory1 first, then accessory2 for second accessory', () => {
      const player = new Player({ level: 1 });
      player.inventory[0] = makeAccessory({ id: 'acc1' });
      player.inventory[1] = makeAccessory({ id: 'acc2' });
      player.equipItem(0);
      player.equipItem(1);
      expect(player.equipment.accessory1?.id).toBe('acc1');
      expect(player.equipment.accessory2?.id).toBe('acc2');
    });
  });

  describe('getEquipTargetSlot', () => {
    it('returns the fixed slot for a non-accessory item', () => {
      const player = new Player({ level: 1 });
      expect(player.getEquipTargetSlot(makeWeapon())).toBe('weapon');
    });

    it('targets accessory1 when both accessory slots are empty', () => {
      const player = new Player({ level: 1 });
      expect(player.getEquipTargetSlot(makeAccessory())).toBe('accessory1');
    });

    it('targets accessory2 once accessory1 is filled', () => {
      const player = new Player({ level: 1 });
      player.inventory[0] = makeAccessory({ id: 'acc1' });
      player.equipItem(0);
      expect(player.getEquipTargetSlot(makeAccessory({ id: 'acc2' }))).toBe('accessory2');
    });

    it('targets accessory2 (the replaced slot) when both are filled', () => {
      const player = new Player({ level: 1 });
      player.inventory[0] = makeAccessory({ id: 'acc1' });
      player.inventory[1] = makeAccessory({ id: 'acc2' });
      player.equipItem(0);
      player.equipItem(1);
      expect(player.getEquipTargetSlot(makeAccessory({ id: 'acc3' }))).toBe('accessory2');
    });
  });

  describe('wouldUpgrade', () => {
    it('is true when the drop beats the gear in its target slot', () => {
      const player = new Player({ level: 10 });
      player.inventory[0] = makeWeapon({ id: 'w1', attack: 5 });
      player.equipItem(0);
      expect(player.wouldUpgrade(makeWeapon({ attack: 20 }))).toBe(true);
    });

    it('is false when the drop is worse than the equipped gear', () => {
      const player = new Player({ level: 10 });
      player.inventory[0] = makeWeapon({ id: 'w1', attack: 20 });
      player.equipItem(0);
      expect(player.wouldUpgrade(makeWeapon({ attack: 5 }))).toBe(false);
    });

    it('is false for an empty target slot (fresh equip is NEW, not an upgrade)', () => {
      const player = new Player({ level: 10 });
      expect(player.wouldUpgrade(makeWeapon({ attack: 20 }))).toBe(false);
    });

    it('compares an accessory against the slot it would actually replace (accessory2)', () => {
      const player = new Player({ level: 10 });
      player.inventory[0] = makeAccessory({ id: 'a1', attack: 50 }); // → accessory1
      player.inventory[1] = makeAccessory({ id: 'a2', attack: 5 }); // → accessory2
      player.equipItem(0);
      player.equipItem(1);
      // A new accessory replaces accessory2 (attack 5), so 10 > 5 is an upgrade — even
      // though it's worse than accessory1 (50). Matches real equip routing.
      expect(player.wouldUpgrade(makeAccessory({ attack: 10 }))).toBe(true);
    });

    it('counts maxHp once, not hp + maxHp (no double-weighting)', () => {
      const player = new Player({ level: 10 });
      player.inventory[0] = makeWeapon({ attack: 25 });
      player.equipItem(0);
      // Drop gives +20 maxHp (items mirror hp === maxHp); stat-total = 20 (maxHp once),
      // not > 25. Double-counting hp + maxHp (40) would wrongly read as an upgrade.
      expect(player.wouldUpgrade(makeWeapon({ attack: 0, hp: 20, maxHp: 20 }))).toBe(false);
    });
  });

  describe('toJSON / fromJSON', () => {
    it('round-trips player data without loss', () => {
      const player = new Player({ name: 'Hero', level: 5, experience: 42 });
      const restored = Player.fromJSON(player.toJSON());
      expect(restored.name).toBe('Hero');
      expect(restored.level).toBe(5);
      expect(restored.experience).toBe(42);
      expect(restored.attack).toBe(player.attack);
      expect(restored.archetype).toBe(player.archetype);
      expect(restored.str).toBe(player.str);
      expect(restored.inventory).toHaveLength(50);
    });

    it('produces independent inventory copies (no shared reference)', () => {
      const player = new Player();
      const json = player.toJSON();
      json.inventory![0] = makeWeapon();
      expect(player.inventory[0]).toBeNull();
    });

    it('defaults to Martial and recomputes attributes when archetype is absent (old save)', () => {
      const player = new Player({ level: 5, archetype: Archetype.Martial });
      const json = player.toJSON();
      // Simulate an old save by removing the new fields
      delete (json as any).archetype;
      delete (json as any).str;
      delete (json as any).agi;
      delete (json as any).int;

      const restored = Player.fromJSON(json);
      expect(restored.archetype).toBe(Archetype.Martial);
      const expected = computeAttributes(Archetype.Martial, 5);
      expect(restored.str).toBe(expected.str);
      expect(restored.agi).toBe(expected.agi);
      expect(restored.int).toBe(expected.int);
    });
  });

  describe('PLAYER_CONFIG constants still referenced by other systems', () => {
    it('MAX_INVENTORY_SIZE is 50', () => {
      expect(PLAYER_CONFIG.MAX_INVENTORY_SIZE).toBe(50);
    });
  });

  describe('setLevel (debug)', () => {
    it('jumps to the target level with the canonical attributes for it', () => {
      const player = new Player({ archetype: Archetype.Mage, level: 1 });
      player.setLevel(10);
      const expected = computeAttributes(Archetype.Mage, 10);
      expect(player.level).toBe(10);
      expect(player.str).toBe(expected.str);
      expect(player.agi).toBe(expected.agi);
      expect(player.int).toBe(expected.int);
    });

    it('resets XP into the new level and full-heals', () => {
      const player = new Player({ level: 1, experience: 40 });
      player.setLevel(5);
      expect(player.experience).toBe(0);
      expect(player.hp).toBe(player.maxHp);
    });

    it('recomputes combat stats from the new attributes', () => {
      const player = new Player({ level: 1 });
      const attackAtL1 = player.attack;
      player.setLevel(20);
      const expected = computeAttributes(player.archetype, 20);
      expect(player.attack).toBe(deriveAttack(expected.str, expected.agi));
      expect(player.attack).toBeGreaterThan(attackAtL1);
    });

    it('clamps below 1 to level 1 (setLevel(0) is a reset)', () => {
      const player = new Player({ level: 8 });
      player.setLevel(0);
      const expected = computeAttributes(player.archetype, 1);
      expect(player.level).toBe(1);
      expect(player.str).toBe(expected.str);
      expect(player.agi).toBe(expected.agi);
    });
  });
});
