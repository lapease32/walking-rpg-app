/**
 * Item Model
 * Base type for all items with subtypes for each equipment slot
 */

import { EquipmentSlot } from './Player';
import { Rarity } from './Creature';

/**
 * Base item properties shared by all items
 */
export interface BaseItem {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  level: number; // Minimum level required to equip
  attack?: number; // Attack bonus (optional)
  defense?: number; // Defense bonus (optional)
  hp?: number; // HP bonus (optional)
  maxHp?: number; // Max HP bonus (optional)
  dropChance: number; // Chance to drop from defeated creatures (0.0 to 1.0)
}

/**
 * Item type discriminated union
 * Each equipment slot has its own item subtype
 */
export type Item =
  | WeaponItem
  | OffhandItem
  | HeadItem
  | ChestItem
  | LegsItem
  | BootsItem
  | GlovesItem
  | AccessoryItem;

/**
 * Weapon items - can only be equipped in weapon slot
 */
export interface WeaponItem extends BaseItem {
  type: 'weapon';
  slot: 'weapon';
}

/**
 * Offhand items - can only be equipped in offhand slot
 */
export interface OffhandItem extends BaseItem {
  type: 'offhand';
  slot: 'offhand';
}

/**
 * Head items - can only be equipped in head slot
 */
export interface HeadItem extends BaseItem {
  type: 'head';
  slot: 'head';
}

/**
 * Chest items - can only be equipped in chest slot
 */
export interface ChestItem extends BaseItem {
  type: 'chest';
  slot: 'chest';
}

/**
 * Legs items - can only be equipped in legs slot
 */
export interface LegsItem extends BaseItem {
  type: 'legs';
  slot: 'legs';
}

/**
 * Boots items - can only be equipped in boots slot
 */
export interface BootsItem extends BaseItem {
  type: 'boots';
  slot: 'boots';
}

/**
 * Gloves items - can only be equipped in gloves slot
 */
export interface GlovesItem extends BaseItem {
  type: 'gloves';
  slot: 'gloves';
}

/**
 * Accessory items - can be equipped in accessory1 or accessory2 slots
 */
export interface AccessoryItem extends BaseItem {
  type: 'accessory';
  // Note: Accessories don't have a fixed slot - they can go in either accessory1 or accessory2
}

/**
 * Helper function to get the equipment slot for an item
 * For accessories, returns 'accessory1' as default (they can go in either slot)
 */
export function getItemSlot(item: Item): EquipmentSlot {
  if (item.type === 'accessory') {
    return 'accessory1'; // Default slot for accessories (can be equipped in either)
  }
  return item.slot;
}

/**
 * Helper function to check if an item can be equipped in a slot
 */
export function canEquipInSlot(item: Item, slot: EquipmentSlot): boolean {
  if (item.type === 'accessory') {
    return slot === 'accessory1' || slot === 'accessory2';
  }
  return item.slot === slot;
}

