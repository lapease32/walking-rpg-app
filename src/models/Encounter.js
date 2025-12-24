import { createCreatureFromTemplate, CREATURE_TEMPLATES } from './Creature';

/**
 * Encounter Model
 * Represents an active encounter with a creature
 */
export class Encounter {
  constructor({ creature, location, timestamp, playerLevel } = {}) {
    this.creature = creature;
    this.location = location; // { latitude, longitude }
    this.timestamp = timestamp || Date.now();
    this.playerLevel = playerLevel || 1;
    this.status = 'active'; // active, caught, defeated, fled
  }

  /**
   * Create a random encounter
   */
  static createRandomEncounter(location, playerLevel = 1) {
    // Select a random creature template
    const template = CREATURE_TEMPLATES[
      Math.floor(Math.random() * CREATURE_TEMPLATES.length)
    ];
    
    const creature = createCreatureFromTemplate(template, playerLevel);
    
    return new Encounter({
      creature,
      location,
      playerLevel,
    });
  }

  /**
   * Mark encounter as caught
   */
  catch() {
    this.status = 'caught';
  }

  /**
   * Mark encounter as defeated
   */
  defeat() {
    this.status = 'defeated';
  }

  /**
   * Mark encounter as fled
   */
  flee() {
    this.status = 'fled';
  }

  /**
   * Check if encounter is still active
   */
  isActive() {
    return this.status === 'active';
  }
}

