import { ITEM_SLOT_ICONS, normalizeSlotKey } from '../../components/icons/ItemSlotIcon';
import { STAT_ICONS } from '../../components/icons/StatIcon';

// Mirrors the item `type` union in models/Item.ts + the EquipmentSlot union in models/Player.ts.
const ITEM_TYPES = ['weapon', 'offhand', 'head', 'chest', 'legs', 'boots', 'gloves', 'accessory'];
const EQUIPMENT_SLOTS = [...ITEM_TYPES.filter(t => t !== 'accessory'), 'accessory1', 'accessory2'];

describe('ITEM_SLOT_ICONS registry', () => {
  it('has a glyph for every item type', () => {
    for (const type of ITEM_TYPES) {
      expect(ITEM_SLOT_ICONS[type]).toBeDefined();
    }
  });

  it('resolves every equipment slot (incl. accessory1/accessory2) to a registered glyph', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      expect(ITEM_SLOT_ICONS[normalizeSlotKey(slot)]).toBeDefined();
    }
  });

  it('normalizes both accessory slots to the accessory key', () => {
    expect(normalizeSlotKey('accessory1')).toBe('accessory');
    expect(normalizeSlotKey('accessory2')).toBe('accessory');
    expect(normalizeSlotKey('weapon')).toBe('weapon');
  });
});

describe('STAT_ICONS registry', () => {
  it('has a glyph for each core stat', () => {
    for (const stat of ['attack', 'defense', 'hp', 'maxHp'] as const) {
      expect(STAT_ICONS[stat]).toBeDefined();
    }
  });
});
