/**
 * Player Model
 * Tracks player stats, progress, and equipment
 */

import { PLAYER_CONFIG } from '../constants/config';
import { WeaponItem, OffhandItem, HeadItem, ChestItem, LegsItem, BootsItem, GlovesItem, AccessoryItem, Item } from './Item';

/**
 * Equipment slot types
 */
export type EquipmentSlot = 'weapon' | 'offhand' | 'head' | 'chest' | 'legs' | 'boots' | 'gloves' | 'accessory1' | 'accessory2';

/**
 * Equipment structure with equipment slots
 */
export interface Equipment {
  weapon: null | WeaponItem;
  offhand: null | OffhandItem;
  head: null | HeadItem;
  chest: null | ChestItem;
  legs: null | LegsItem;
  boots: null | BootsItem;
  gloves: null | GlovesItem;
  accessory1: null | AccessoryItem;
  accessory2: null | AccessoryItem;
}

/**
 * Create an empty equipment with all slots set to null
 */
export function createEmptyEquipment(): Equipment {
  return {
    weapon: null,
    offhand: null,
    head: null,
    chest: null,
    legs: null,
    boots: null,
    gloves: null,
    accessory1: null,
    accessory2: null,
  };
}

/**
 * Create an empty inventory with 50 slots (all set to null)
 */
export function createEmptyInventory(): (Item | null)[] {
  return new Array(50).fill(null);
}

export interface PlayerData {
  id: string;
  name: string;
  level: number;
  experience: number;
  attack: number;
  defense: number;
  hp?: number;
  maxHp?: number;
  totalDistance: number;
  totalEncounters: number;
  creaturesCaught: number;
  creaturesDefeated: number;
  equipment: Equipment;
  inventory?: (Item | null)[]; // Optional for backwards compatibility with old saved data
}

export interface PlayerStats {
  id: string;
  name: string;
  level: number;
  experience: number;
  experienceForNextLevel: number;
  attack: number;
  defense: number;
  hp: number;
  maxHp: number;
  totalDistance: number;
  totalEncounters: number;
  creaturesCaught: number;
  creaturesDefeated: number;
}

export interface PlayerConstructorParams {
  id?: string;
  name?: string;
  level?: number;
  experience?: number;
  attack?: number;
  defense?: number;
  hp?: number;
  maxHp?: number;
  totalDistance?: number;
  totalEncounters?: number;
  creaturesCaught?: number;
  creaturesDefeated?: number;
  equipment?: Equipment;
  inventory?: (Item | null)[];
}

export class Player {
  id: string;
  name: string;
  level: number;
  experience: number;
  attack: number;
  defense: number;
  hp: number;
  maxHp: number;
  totalDistance: number;
  totalEncounters: number;
  creaturesCaught: number;
  creaturesDefeated: number;
  equipment: Equipment;
  inventory: (Item | null)[];

  constructor({
    id = 'player1',
    name = 'Adventurer',
    level = 1,
    experience = 0,
    attack,
    defense,
    hp,
    maxHp,
    totalDistance = 0,
    totalEncounters = 0,
    creaturesCaught = 0,
    creaturesDefeated = 0,
    equipment,
    inventory,
  }: PlayerConstructorParams = {}) {
    this.id = id;
    this.name = name;
    this.level = level;
    this.experience = experience;
    
    // Calculate attack and defense based on level if not provided
    // Base stats + stats per level
    this.attack = attack ?? (PLAYER_CONFIG.STARTING_ATTACK + (level - 1) * PLAYER_CONFIG.ATTACK_PER_LEVEL);
    this.defense = defense ?? (PLAYER_CONFIG.STARTING_DEFENSE + (level - 1) * PLAYER_CONFIG.DEFENSE_PER_LEVEL);
    
    // Calculate max HP based on level if not provided
    this.maxHp = maxHp ?? (PLAYER_CONFIG.STARTING_HP + (level - 1) * PLAYER_CONFIG.HP_PER_LEVEL);
    // Set current HP to maxHp if not provided, or use provided hp (but cap at maxHp)
    this.hp = hp ?? this.maxHp;
    if (this.hp > this.maxHp) {
      this.hp = this.maxHp;
    }
    
    this.totalDistance = totalDistance;
    this.totalEncounters = totalEncounters;
    this.creaturesCaught = creaturesCaught;
    this.creaturesDefeated = creaturesDefeated;
    // Initialize equipment with empty slots if not provided
    if (equipment) {
      this.equipment = equipment;
    } else {
      this.equipment = createEmptyEquipment();
    }
    // Initialize inventory with exactly 50 slots
    // Validate and normalize inventory to ensure it has exactly 50 slots
    // Always create a copy to avoid shared references between Player instances
    if (inventory && Array.isArray(inventory) && inventory.length === 50) {
      this.inventory = [...inventory];
    } else {
      // Create new 50-slot inventory, or pad/truncate existing one if provided
      if (inventory && Array.isArray(inventory)) {
        // Normalize to 50 slots: pad with null if shorter, truncate if longer
        const normalized = [...inventory];
        while (normalized.length < 50) {
          normalized.push(null);
        }
        this.inventory = normalized.slice(0, 50);
      } else {
        this.inventory = createEmptyInventory();
      }
    }
  }

  /**
   * Calculate experience needed for next level
   */
  getExperienceForNextLevel(): number {
    // Exponential growth: 100 * level^1.5
    return Math.floor(100 * Math.pow(this.level, 1.5));
  }

  /**
   * Add experience and handle level ups
   */
  addExperience(amount: number): number {
    this.experience += amount;
    const levelsGained = this.checkLevelUp();
    return levelsGained;
  }

  /**
   * Check if player should level up and handle it
   */
  checkLevelUp(): number {
    let levelsGained = 0;
    let expNeeded = this.getExperienceForNextLevel();

    while (this.experience >= expNeeded) {
      this.experience -= expNeeded;
      this.level += 1;
      levelsGained += 1;
      
      // Increase stats on level up
      this.attack += PLAYER_CONFIG.ATTACK_PER_LEVEL;
      this.defense += PLAYER_CONFIG.DEFENSE_PER_LEVEL;
      this.maxHp += PLAYER_CONFIG.HP_PER_LEVEL;
      // Restore HP by the amount gained (full heal on level up)
      this.hp += PLAYER_CONFIG.HP_PER_LEVEL;
      // Cap at maxHp in case hp was already full
      if (this.hp > this.maxHp) {
        this.hp = this.maxHp;
      }
      
      expNeeded = this.getExperienceForNextLevel();
    }

    return levelsGained;
  }

  /**
   * Calculate damage dealt to a creature
   * Damage = (player attack - creature defense) * multiplier (minimum 1)
   */
  calculateDamage(creatureDefense: number, damageMultiplier: number = 1.0): number {
    const baseDamage = this.attack - creatureDefense;
    const damage = baseDamage * damageMultiplier;
    return Math.max(1, Math.floor(damage)); // Minimum 1 damage, rounded down
  }

  /**
   * Take damage from a creature
   * Damage = creature attack - player defense (minimum 1)
   */
  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  /**
   * Check if player is defeated
   */
  isDefeated(): boolean {
    return this.hp <= 0;
  }

  /**
   * Restore HP (for healing, level up, etc.)
   */
  restoreHp(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
   * Fully heal player
   */
  fullHeal(): void {
    this.hp = this.maxHp;
  }

  /**
   * Add distance traveled
   */
  addDistance(distance: number): void {
    this.totalDistance += distance;
  }

  /**
   * Increment encounter counter
   */
  incrementEncounters(): void {
    this.totalEncounters += 1;
  }

  /**
   * Increment creatures caught
   */
  catchCreature(): void {
    this.creaturesCaught += 1;
  }

  /**
   * Increment creatures defeated
   */
  defeatCreature(): void {
    this.creaturesDefeated += 1;
  }

  /**
   * Force level up (debug function)
   * Directly increments level and adjusts stats without requiring XP
   */
  forceLevelUp(): void {
    this.level += 1;
    this.attack += PLAYER_CONFIG.ATTACK_PER_LEVEL;
    this.defense += PLAYER_CONFIG.DEFENSE_PER_LEVEL;
    this.maxHp += PLAYER_CONFIG.HP_PER_LEVEL;
    // Restore HP by the amount gained (full heal on level up)
    this.hp += PLAYER_CONFIG.HP_PER_LEVEL;
    // Cap at maxHp in case hp was already full
    if (this.hp > this.maxHp) {
      this.hp = this.maxHp;
    }
  }

  /**
   * Reset level to 1 (debug function)
   * Resets level, experience, and recalculates stats
   */
  resetLevel(): void {
    this.level = 1;
    this.experience = 0;
    this.attack = PLAYER_CONFIG.STARTING_ATTACK;
    this.defense = PLAYER_CONFIG.STARTING_DEFENSE;
    this.maxHp = PLAYER_CONFIG.STARTING_HP;
    this.hp = this.maxHp;
  }

  /**
   * Get player stats as an object
   */
  getStats(): PlayerStats {
    return {
      id: this.id,
      name: this.name,
      level: this.level,
      experience: this.experience,
      experienceForNextLevel: this.getExperienceForNextLevel(),
      attack: this.attack,
      defense: this.defense,
      hp: this.hp,
      maxHp: this.maxHp,
      totalDistance: this.totalDistance,
      totalEncounters: this.totalEncounters,
      creaturesCaught: this.creaturesCaught,
      creaturesDefeated: this.creaturesDefeated,
    };
  }

  /**
   * Add an item to the inventory
   * Returns the index where the item was added, or -1 if inventory is full
   */
  addItemToInventory(item: Item): number {
    const emptySlotIndex = this.inventory.findIndex(slot => slot === null);
    if (emptySlotIndex !== -1) {
      this.inventory[emptySlotIndex] = item;
      return emptySlotIndex;
    }
    return -1; // Inventory is full
  }

  /**
   * Remove an item from the inventory at a specific index
   * Returns the removed item, or null if the slot was empty or index is invalid
   */
  removeItemFromInventory(index: number): Item | null {
    if (index < 0 || index >= this.inventory.length) {
      return null; // Invalid index
    }
    const item = this.inventory[index];
    this.inventory[index] = null;
    return item;
  }

  /**
   * Get the number of empty slots in the inventory
   */
  getEmptyInventorySlots(): number {
    return this.inventory.filter(slot => slot === null).length;
  }

  /**
   * Get the number of used slots in the inventory
   */
  getUsedInventorySlots(): number {
    return this.inventory.filter(slot => slot !== null).length;
  }

  /**
   * Check if the inventory is full
   */
  isInventoryFull(): boolean {
    return this.getEmptyInventorySlots() === 0;
  }

  /**
   * Serialize player data for storage
   */
  toJSON(): PlayerData {
    return {
      id: this.id,
      name: this.name,
      level: this.level,
      experience: this.experience,
      attack: this.attack,
      defense: this.defense,
      hp: this.hp,
      maxHp: this.maxHp,
      totalDistance: this.totalDistance,
      totalEncounters: this.totalEncounters,
      creaturesCaught: this.creaturesCaught,
      creaturesDefeated: this.creaturesDefeated,
      equipment: this.equipment,
      inventory: [...this.inventory], // Return a copy to prevent shared references
    };
  }

  /**
   * Create Player instance from JSON data
   */
  static fromJSON(data: PlayerData): Player {
    return new Player(data);
  }
}

