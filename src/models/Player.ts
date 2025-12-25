/**
 * Player Model
 * Tracks player stats, progress, and inventory
 */

import { PLAYER_CONFIG } from '../constants/config';

export interface PlayerData {
  id: string;
  name: string;
  level: number;
  experience: number;
  attack: number;
  defense: number;
  totalDistance: number;
  totalEncounters: number;
  creaturesCaught: number;
  creaturesDefeated: number;
  inventory: Record<string, any>;
}

export interface PlayerStats {
  id: string;
  name: string;
  level: number;
  experience: number;
  experienceForNextLevel: number;
  attack: number;
  defense: number;
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
  totalDistance?: number;
  totalEncounters?: number;
  creaturesCaught?: number;
  creaturesDefeated?: number;
  inventory?: Record<string, any>;
}

export class Player {
  id: string;
  name: string;
  level: number;
  experience: number;
  attack: number;
  defense: number;
  totalDistance: number;
  totalEncounters: number;
  creaturesCaught: number;
  creaturesDefeated: number;
  inventory: Record<string, any>;

  constructor({
    id = 'player1',
    name = 'Adventurer',
    level = 1,
    experience = 0,
    attack,
    defense,
    totalDistance = 0,
    totalEncounters = 0,
    creaturesCaught = 0,
    creaturesDefeated = 0,
    inventory = {},
  }: PlayerConstructorParams = {}) {
    this.id = id;
    this.name = name;
    this.level = level;
    this.experience = experience;
    
    // Calculate attack and defense based on level if not provided
    // Base stats + stats per level
    this.attack = attack ?? (PLAYER_CONFIG.STARTING_ATTACK + (level - 1) * PLAYER_CONFIG.ATTACK_PER_LEVEL);
    this.defense = defense ?? (PLAYER_CONFIG.STARTING_DEFENSE + (level - 1) * PLAYER_CONFIG.DEFENSE_PER_LEVEL);
    
    this.totalDistance = totalDistance;
    this.totalEncounters = totalEncounters;
    this.creaturesCaught = creaturesCaught;
    this.creaturesDefeated = creaturesDefeated;
    this.inventory = inventory;
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
      
      expNeeded = this.getExperienceForNextLevel();
    }

    return levelsGained;
  }

  /**
   * Calculate damage dealt to a creature
   * Damage = player attack - creature defense (minimum 1)
   */
  calculateDamage(creatureDefense: number): number {
    const damage = this.attack - creatureDefense;
    return Math.max(1, damage); // Minimum 1 damage
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
      totalDistance: this.totalDistance,
      totalEncounters: this.totalEncounters,
      creaturesCaught: this.creaturesCaught,
      creaturesDefeated: this.creaturesDefeated,
    };
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
      totalDistance: this.totalDistance,
      totalEncounters: this.totalEncounters,
      creaturesCaught: this.creaturesCaught,
      creaturesDefeated: this.creaturesDefeated,
      inventory: this.inventory,
    };
  }

  /**
   * Create Player instance from JSON data
   */
  static fromJSON(data: PlayerData): Player {
    return new Player(data);
  }
}

