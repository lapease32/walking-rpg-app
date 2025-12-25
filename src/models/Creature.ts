/**
 * Creature Model
 * Represents a creature that can be encountered in the game
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface CreatureTemplate {
  id: string;
  name: string;
  type: string;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  rarity: Rarity;
  description?: string;
  encounterRate: number;
}

export interface CreatureConstructorParams {
  id: string;
  name: string;
  type: string;
  level?: number;
  hp?: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  rarity?: Rarity;
  description?: string;
  encounterRate?: number;
}

export class Creature {
  id: string;
  name: string;
  type: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  rarity: Rarity;
  description: string;
  encounterRate: number;

  constructor({
    id,
    name,
    type,
    level = 1,
    hp,
    maxHp,
    attack,
    defense,
    speed,
    rarity = 'common',
    description,
    encounterRate = 0.5,
  }: CreatureConstructorParams) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.level = level;
    this.hp = hp ?? maxHp;
    this.maxHp = maxHp;
    this.attack = attack;
    this.defense = defense;
    this.speed = speed;
    this.rarity = rarity;
    this.description = description || `A ${type} creature`;
    this.encounterRate = encounterRate;
  }

  /**
   * Get rarity multiplier for rewards
   */
  getRarityMultiplier(): number {
    const multipliers: Record<Rarity, number> = {
      common: 1.0,
      uncommon: 1.5,
      rare: 2.0,
      epic: 3.0,
      legendary: 5.0,
    };
    return multipliers[this.rarity] || 1.0;
  }

  /**
   * Calculate experience reward based on creature stats
   */
  getExperienceReward(): number {
    const baseExp = 10 * this.level;
    return Math.floor(baseExp * this.getRarityMultiplier());
  }

  /**
   * Check if creature is defeated
   */
  isDefeated(): boolean {
    return this.hp <= 0;
  }

  /**
   * Take damage
   * Note: amount should already account for defense (calculated by Player.calculateDamage)
   */
  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }
}

/**
 * Predefined creature templates
 * You can expand this with more creatures
 */
export const CREATURE_TEMPLATES: CreatureTemplate[] = [
  {
    id: 'forest_sprite',
    name: 'Forest Sprite',
    type: 'Nature',
    maxHp: 50,
    attack: 15,
    defense: 5,
    speed: 20,
    rarity: 'common',
    description: 'A small nature spirit found in wooded areas',
    encounterRate: 0.6,
  },
  {
    id: 'urban_phantom',
    name: 'Urban Phantom',
    type: 'Shadow',
    maxHp: 60,
    attack: 18,
    defense: 8,
    speed: 25,
    rarity: 'common',
    description: 'A mysterious entity that appears in city areas',
    encounterRate: 0.5,
  },
  {
    id: 'coastal_spirit',
    name: 'Coastal Spirit',
    type: 'Water',
    maxHp: 70,
    attack: 20,
    defense: 10,
    speed: 15,
    rarity: 'uncommon',
    description: 'A spirit drawn to bodies of water',
    encounterRate: 0.3,
  },
  {
    id: 'mountain_guardian',
    name: 'Mountain Guardian',
    type: 'Earth',
    maxHp: 100,
    attack: 25,
    defense: 20,
    speed: 10,
    rarity: 'rare',
    description: 'A powerful guardian of elevated terrain',
    encounterRate: 0.15,
  },
  {
    id: 'wind_dancer',
    name: 'Wind Dancer',
    type: 'Air',
    maxHp: 55,
    attack: 22,
    defense: 6,
    speed: 35,
    rarity: 'uncommon',
    description: 'An agile creature that moves with the wind',
    encounterRate: 0.35,
  },
];

/**
 * Create a creature instance from a template with random level variation
 */
export function createCreatureFromTemplate(
  template: CreatureTemplate,
  playerLevel: number = 1
): Creature {
  // Level variation: ±2 levels from player level, minimum 1
  const levelVariation = Math.floor(Math.random() * 5) - 2;
  const level = Math.max(1, playerLevel + levelVariation);

  // Scale stats based on level
  const levelMultiplier = 1 + (level - 1) * 0.1;

  return new Creature({
    ...template,
    level,
    maxHp: Math.floor(template.maxHp * levelMultiplier),
    attack: Math.floor(template.attack * levelMultiplier),
    defense: Math.floor(template.defense * levelMultiplier),
    speed: Math.floor(template.speed * levelMultiplier),
  });
}

