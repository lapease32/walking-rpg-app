/**
 * Player Model
 * Tracks player stats, progress, and inventory
 */
export class Player {
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
  } = {}) {
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
  getExperienceForNextLevel() {
    // Exponential growth: 100 * level^1.5
    return Math.floor(100 * Math.pow(this.level, 1.5));
  }

  /**
   * Add experience and handle level ups
   */
  addExperience(amount) {
    this.experience += amount;
    const levelsGained = this.checkLevelUp();
    return levelsGained;
  }

  /**
   * Check if player should level up and handle it
   */
  checkLevelUp() {
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
  addDistance(distance) {
    this.totalDistance += distance;
  }

  /**
   * Increment encounter counter
   */
  incrementEncounters() {
    this.totalEncounters += 1;
  }

  /**
   * Increment creatures caught
   */
  catchCreature() {
    this.creaturesCaught += 1;
  }

  /**
   * Increment creatures defeated
   */
  defeatCreature() {
    this.creaturesDefeated += 1;
  }

  /**
   * Get player stats as an object
   */
  getStats() {
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
  toJSON() {
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
  static fromJSON(data) {
    return new Player(data);
  }
}

