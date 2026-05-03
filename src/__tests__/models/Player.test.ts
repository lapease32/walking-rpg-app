import { Player } from '../../models/Player';
import { PLAYER_CONFIG } from '../../constants/config';
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
    it('creates a player with default level 1 stats', () => {
      const player = new Player();
      expect(player.level).toBe(1);
      expect(player.attack).toBe(PLAYER_CONFIG.STARTING_ATTACK);
      expect(player.defense).toBe(PLAYER_CONFIG.STARTING_DEFENSE);
      expect(player.maxHp).toBe(PLAYER_CONFIG.STARTING_HP);
      expect(player.hp).toBe(PLAYER_CONFIG.STARTING_HP);
    });

    it('scales stats based on level when stats not explicitly provided', () => {
      const player = new Player({ level: 3 });
      expect(player.attack).toBe(
        PLAYER_CONFIG.STARTING_ATTACK + 2 * PLAYER_CONFIG.ATTACK_PER_LEVEL,
      );
      expect(player.defense).toBe(
        PLAYER_CONFIG.STARTING_DEFENSE + 2 * PLAYER_CONFIG.DEFENSE_PER_LEVEL,
      );
      expect(player.maxHp).toBe(PLAYER_CONFIG.STARTING_HP + 2 * PLAYER_CONFIG.HP_PER_LEVEL);
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
      expect(player.attack).toBe(attackBefore + PLAYER_CONFIG.ATTACK_PER_LEVEL);
      expect(player.defense).toBe(defenseBefore + PLAYER_CONFIG.DEFENSE_PER_LEVEL);
      expect(player.maxHp).toBe(maxHpBefore + PLAYER_CONFIG.HP_PER_LEVEL);
    });

    it('restores hp by HP_PER_LEVEL on level up', () => {
      const player = new Player({ hp: 50, maxHp: 100 });
      player.addExperience(player.getExperienceForNextLevel());
      expect(player.hp).toBe(50 + PLAYER_CONFIG.HP_PER_LEVEL);
    });
  });

  describe('calculateDamage', () => {
    it('calculates base damage correctly', () => {
      const player = new Player({ attack: 20 });
      expect(player.calculateDamage(5)).toBe(15);
    });

    it('applies damage multiplier and floors result', () => {
      const player = new Player({ attack: 20 });
      // (20 - 5) * 1.5 = 22.5 → 22
      expect(player.calculateDamage(5, 1.5)).toBe(22);
    });

    it('enforces minimum of 1 damage', () => {
      const player = new Player({ attack: 5 });
      expect(player.calculateDamage(100)).toBe(1);
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

  describe('toJSON / fromJSON', () => {
    it('round-trips player data without loss', () => {
      const player = new Player({ name: 'Hero', level: 5, experience: 42 });
      const restored = Player.fromJSON(player.toJSON());
      expect(restored.name).toBe('Hero');
      expect(restored.level).toBe(5);
      expect(restored.experience).toBe(42);
      expect(restored.attack).toBe(player.attack);
      expect(restored.inventory).toHaveLength(50);
    });

    it('produces independent inventory copies (no shared reference)', () => {
      const player = new Player();
      const json = player.toJSON();
      json.inventory![0] = makeWeapon();
      expect(player.inventory[0]).toBeNull();
    });
  });
});
