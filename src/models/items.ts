/**
 * Item Definitions
 * Predefined items for each equipment slot
 */

import {
  Item,
  WeaponItem,
  OffhandItem,
  HeadItem,
  ChestItem,
  LegsItem,
  BootsItem,
  GlovesItem,
  AccessoryItem,
} from './Item';

/**
 * Weapon Items (5 items - one for each rarity tier)
 */
export const WEAPON_ITEMS: WeaponItem[] = [
  {
    id: 'weapon_wooden_sword',
    name: 'Wooden Sword',
    description: 'A basic wooden training sword. Simple but reliable.',
    type: 'weapon',
    slot: 'weapon',
    rarity: 'common',
    level: 1,
    attack: 5,
    dropChance: 0.3,
  },
  {
    id: 'weapon_iron_blade',
    name: 'Iron Blade',
    description: 'A well-crafted iron sword with a sharp edge.',
    type: 'weapon',
    slot: 'weapon',
    rarity: 'uncommon',
    level: 5,
    attack: 12,
    dropChance: 0.15,
  },
  {
    id: 'weapon_steel_rapier',
    name: 'Steel Rapier',
    description: 'An elegant steel rapier favored by skilled duelists.',
    type: 'weapon',
    slot: 'weapon',
    rarity: 'rare',
    level: 8,
    attack: 18,
    dropChance: 0.08,
  },
  {
    id: 'weapon_flamebrand',
    name: 'Flamebrand',
    description: 'A magical sword wreathed in eternal flames. Burns enemies with each strike.',
    type: 'weapon',
    slot: 'weapon',
    rarity: 'epic',
    level: 12,
    attack: 28,
    dropChance: 0.05,
  },
  {
    id: 'weapon_dragon_fang',
    name: 'Dragon Fang',
    description: 'A legendary blade forged from a dragon\'s fang. Extremely rare and powerful.',
    type: 'weapon',
    slot: 'weapon',
    rarity: 'legendary',
    level: 15,
    attack: 35,
    dropChance: 0.02,
  },
];

/**
 * Offhand Items (5 items - one for each rarity tier)
 */
export const OFFHAND_ITEMS: OffhandItem[] = [
  {
    id: 'offhand_wooden_shield',
    name: 'Wooden Shield',
    description: 'A simple wooden shield that provides basic protection.',
    type: 'offhand',
    slot: 'offhand',
    rarity: 'common',
    level: 1,
    defense: 5,
    dropChance: 0.3,
  },
  {
    id: 'offhand_steel_buckler',
    name: 'Steel Buckler',
    description: 'A sturdy steel shield that offers excellent defense.',
    type: 'offhand',
    slot: 'offhand',
    rarity: 'uncommon',
    level: 5,
    defense: 12,
    dropChance: 0.15,
  },
  {
    id: 'offhand_tower_shield',
    name: 'Tower Shield',
    description: 'A massive tower shield that provides formidable defense.',
    type: 'offhand',
    slot: 'offhand',
    rarity: 'rare',
    level: 8,
    defense: 18,
    dropChance: 0.08,
  },
  {
    id: 'offhand_guardian_aegis',
    name: 'Guardian Aegis',
    description: 'An ancient shield blessed by the guardians. Provides exceptional protection.',
    type: 'offhand',
    slot: 'offhand',
    rarity: 'epic',
    level: 12,
    defense: 25,
    hp: 20,
    dropChance: 0.05,
  },
  {
    id: 'offhand_shield_of_eternity',
    name: 'Shield of Eternity',
    description: 'A legendary shield said to have protected the gods themselves. Grants immense power.',
    type: 'offhand',
    slot: 'offhand',
    rarity: 'legendary',
    level: 15,
    defense: 35,
    hp: 30,
    maxHp: 30,
    dropChance: 0.02,
  },
];

/**
 * Head Items (5 items - one for each rarity tier)
 */
export const HEAD_ITEMS: HeadItem[] = [
  {
    id: 'head_leather_cap',
    name: 'Leather Cap',
    description: 'A simple leather cap that offers minimal protection.',
    type: 'head',
    slot: 'head',
    rarity: 'common',
    level: 1,
    defense: 3,
    dropChance: 0.3,
  },
  {
    id: 'head_iron_helmet',
    name: 'Iron Helmet',
    description: 'A sturdy iron helmet that protects your head in battle.',
    type: 'head',
    slot: 'head',
    rarity: 'uncommon',
    level: 5,
    defense: 8,
    dropChance: 0.15,
  },
  {
    id: 'head_crown_of_wisdom',
    name: 'Crown of Wisdom',
    description: 'A mystical crown that enhances your combat abilities.',
    type: 'head',
    slot: 'head',
    rarity: 'rare',
    level: 10,
    defense: 15,
    attack: 5,
    dropChance: 0.08,
  },
  {
    id: 'head_helmet_of_valor',
    name: 'Helmet of Valor',
    description: 'An epic helmet worn by legendary warriors. Inspires courage and strength.',
    type: 'head',
    slot: 'head',
    rarity: 'epic',
    level: 12,
    defense: 20,
    attack: 8,
    hp: 15,
    dropChance: 0.05,
  },
  {
    id: 'head_crown_of_kings',
    name: 'Crown of Kings',
    description: 'The legendary crown of ancient rulers. Bestows incredible power upon its wearer.',
    type: 'head',
    slot: 'head',
    rarity: 'legendary',
    level: 15,
    defense: 25,
    attack: 12,
    maxHp: 25,
    dropChance: 0.02,
  },
];

/**
 * Chest Items (5 items - one for each rarity tier)
 */
export const CHEST_ITEMS: ChestItem[] = [
  {
    id: 'chest_cloth_robe',
    name: 'Cloth Robe',
    description: 'A basic cloth robe that provides minimal protection.',
    type: 'chest',
    slot: 'chest',
    rarity: 'common',
    level: 1,
    defense: 4,
    dropChance: 0.3,
  },
  {
    id: 'chest_chainmail',
    name: 'Chainmail',
    description: 'A flexible chainmail armor that offers good protection.',
    type: 'chest',
    slot: 'chest',
    rarity: 'uncommon',
    level: 5,
    defense: 10,
    dropChance: 0.15,
  },
  {
    id: 'chest_plate_armor',
    name: 'Plate Armor',
    description: 'Heavy plate armor that provides excellent defense at the cost of mobility.',
    type: 'chest',
    slot: 'chest',
    rarity: 'rare',
    level: 10,
    defense: 20,
    maxHp: 15,
    dropChance: 0.08,
  },
  {
    id: 'chest_dragon_scale_mail',
    name: 'Dragon Scale Mail',
    description: 'Armor crafted from the scales of a dragon. Provides exceptional protection.',
    type: 'chest',
    slot: 'chest',
    rarity: 'epic',
    level: 12,
    defense: 28,
    maxHp: 25,
    attack: 5,
    dropChance: 0.05,
  },
  {
    id: 'chest_armor_of_the_titans',
    name: 'Armor of the Titans',
    description: 'Legendary armor forged by the titans themselves. Grants godlike protection.',
    type: 'chest',
    slot: 'chest',
    rarity: 'legendary',
    level: 15,
    defense: 40,
    maxHp: 40,
    attack: 10,
    dropChance: 0.02,
  },
];

/**
 * Legs Items (5 items - one for each rarity tier)
 */
export const LEGS_ITEMS: LegsItem[] = [
  {
    id: 'legs_cloth_pants',
    name: 'Cloth Pants',
    description: 'Simple cloth pants that offer minimal protection.',
    type: 'legs',
    slot: 'legs',
    rarity: 'common',
    level: 1,
    defense: 3,
    dropChance: 0.3,
  },
  {
    id: 'legs_leather_leggings',
    name: 'Leather Leggings',
    description: 'Durable leather leggings that provide decent protection.',
    type: 'legs',
    slot: 'legs',
    rarity: 'uncommon',
    level: 5,
    defense: 8,
    dropChance: 0.15,
  },
  {
    id: 'legs_plated_greaves',
    name: 'Plated Greaves',
    description: 'Heavy plated leg armor that offers excellent protection.',
    type: 'legs',
    slot: 'legs',
    rarity: 'rare',
    level: 10,
    defense: 15,
    dropChance: 0.08,
  },
  {
    id: 'legs_dragonhide_leggings',
    name: 'Dragonhide Leggings',
    description: 'Leggings made from the hide of a dragon. Extremely durable and protective.',
    type: 'legs',
    slot: 'legs',
    rarity: 'epic',
    level: 12,
    defense: 22,
    maxHp: 20,
    dropChance: 0.05,
  },
  {
    id: 'legs_greaves_of_immortality',
    name: 'Greaves of Immortality',
    description: 'Legendary greaves that grant near-immortal protection to the wearer.',
    type: 'legs',
    slot: 'legs',
    rarity: 'legendary',
    level: 15,
    defense: 32,
    maxHp: 30,
    dropChance: 0.02,
  },
];

/**
 * Boots Items (5 items - one for each rarity tier)
 */
export const BOOTS_ITEMS: BootsItem[] = [
  {
    id: 'boots_leather_boots',
    name: 'Leather Boots',
    description: 'Basic leather boots that provide minimal protection.',
    type: 'boots',
    slot: 'boots',
    rarity: 'common',
    level: 1,
    defense: 2,
    dropChance: 0.3,
  },
  {
    id: 'boots_iron_greaves',
    name: 'Iron Greaves',
    description: 'Sturdy iron boots that offer good protection for your feet.',
    type: 'boots',
    slot: 'boots',
    rarity: 'uncommon',
    level: 5,
    defense: 7,
    dropChance: 0.15,
  },
  {
    id: 'boots_boots_of_swiftness',
    name: 'Boots of Swiftness',
    description: 'Enchanted boots that enhance your speed and agility.',
    type: 'boots',
    slot: 'boots',
    rarity: 'rare',
    level: 8,
    defense: 10,
    attack: 3,
    dropChance: 0.08,
  },
  {
    id: 'boots_windwalkers',
    name: 'Windwalkers',
    description: 'Epic boots that allow you to move like the wind itself.',
    type: 'boots',
    slot: 'boots',
    rarity: 'epic',
    level: 12,
    defense: 15,
    attack: 6,
    dropChance: 0.05,
  },
  {
    id: 'boots_boots_of_the_gods',
    name: 'Boots of the Gods',
    description: 'Legendary boots blessed by the gods. Grants incredible speed and power.',
    type: 'boots',
    slot: 'boots',
    rarity: 'legendary',
    level: 15,
    defense: 20,
    attack: 10,
    maxHp: 20,
    dropChance: 0.02,
  },
];

/**
 * Gloves Items (5 items - one for each rarity tier)
 */
export const GLOVES_ITEMS: GlovesItem[] = [
  {
    id: 'gloves_cloth_gloves',
    name: 'Cloth Gloves',
    description: 'Simple cloth gloves that offer minimal protection.',
    type: 'gloves',
    slot: 'gloves',
    rarity: 'common',
    level: 1,
    defense: 2,
    dropChance: 0.3,
  },
  {
    id: 'gloves_leather_gauntlets',
    name: 'Leather Gauntlets',
    description: 'Durable leather gauntlets that provide decent hand protection.',
    type: 'gloves',
    slot: 'gloves',
    rarity: 'uncommon',
    level: 5,
    defense: 6,
    attack: 2,
    dropChance: 0.15,
  },
  {
    id: 'gloves_iron_fists',
    name: 'Iron Fists',
    description: 'Heavy iron gauntlets that pack a powerful punch.',
    type: 'gloves',
    slot: 'gloves',
    rarity: 'rare',
    level: 8,
    defense: 8,
    attack: 5,
    dropChance: 0.08,
  },
  {
    id: 'gloves_power_gauntlets',
    name: 'Power Gauntlets',
    description: 'Magical gauntlets that enhance your striking power.',
    type: 'gloves',
    slot: 'gloves',
    rarity: 'epic',
    level: 12,
    defense: 10,
    attack: 8,
    dropChance: 0.05,
  },
  {
    id: 'gloves_gauntlets_of_destruction',
    name: 'Gauntlets of Destruction',
    description: 'Legendary gauntlets that can shatter mountains with a single strike.',
    type: 'gloves',
    slot: 'gloves',
    rarity: 'legendary',
    level: 15,
    defense: 15,
    attack: 15,
    hp: 15,
    dropChance: 0.02,
  },
];

/**
 * Accessory Items (5 items - one for each rarity tier)
 */
export const ACCESSORY_ITEMS: AccessoryItem[] = [
  {
    id: 'accessory_copper_ring',
    name: 'Copper Ring',
    description: 'A simple copper ring that provides a small stat boost.',
    type: 'accessory',
    slot: 'accessory1',
    rarity: 'common',
    level: 1,
    attack: 2,
    defense: 2,
    dropChance: 0.3,
  },
  {
    id: 'accessory_silver_amulet',
    name: 'Silver Amulet',
    description: 'A silver amulet that enhances your combat abilities.',
    type: 'accessory',
    slot: 'accessory1',
    rarity: 'uncommon',
    level: 5,
    attack: 5,
    defense: 5,
    hp: 10,
    dropChance: 0.15,
  },
  {
    id: 'accessory_golden_medallion',
    name: 'Golden Medallion',
    description: 'A rare golden medallion that provides substantial stat boosts.',
    type: 'accessory',
    slot: 'accessory1',
    rarity: 'rare',
    level: 8,
    attack: 8,
    defense: 8,
    maxHp: 15,
    dropChance: 0.08,
  },
  {
    id: 'accessory_amulet_of_the_ancients',
    name: 'Amulet of the Ancients',
    description: 'An epic amulet from an ancient civilization. Grants immense power.',
    type: 'accessory',
    slot: 'accessory1',
    rarity: 'epic',
    level: 12,
    attack: 12,
    defense: 12,
    hp: 25,
    maxHp: 25,
    dropChance: 0.05,
  },
  {
    id: 'accessory_ring_of_power',
    name: 'Ring of Power',
    description: 'A legendary ring that significantly boosts all your stats.',
    type: 'accessory',
    slot: 'accessory1',
    rarity: 'legendary',
    level: 15,
    attack: 15,
    defense: 15,
    maxHp: 30,
    dropChance: 0.02,
  },
];

/**
 * All items combined
 */
export const ALL_ITEMS: Item[] = [
  ...WEAPON_ITEMS,
  ...OFFHAND_ITEMS,
  ...HEAD_ITEMS,
  ...CHEST_ITEMS,
  ...LEGS_ITEMS,
  ...BOOTS_ITEMS,
  ...GLOVES_ITEMS,
  ...ACCESSORY_ITEMS,
];

/**
 * Get all items by type
 */
export function getItemsByType(type: Item['type']): Item[] {
  return ALL_ITEMS.filter((item) => item.type === type);
}

/**
 * Get item by ID
 */
export function getItemById(id: string): Item | undefined {
  return ALL_ITEMS.find((item) => item.id === id);
}

/**
 * Get items by rarity
 */
export function getItemsByRarity(rarity: Item['rarity']): Item[] {
  return ALL_ITEMS.filter((item) => item.rarity === rarity);
}

