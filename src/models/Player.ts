/**
 * Player Model
 * Tracks player stats, progress, and inventory
 */

export interface PlayerData {
  id: string;
  name: string;
  level: number;
  experience: number;
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
      expNeeded = this.getExperienceForNextLevel();
    }

    return levelsGained;
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
   * Get player stats as an object
   */
  getStats(): PlayerStats {
    return {
      id: this.id,
      name: this.name,
      level: this.level,
      experience: this.experience,
      experienceForNextLevel: this.getExperienceForNextLevel(),
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

