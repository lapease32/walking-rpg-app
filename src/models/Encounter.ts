import { Creature, createCreatureFromTemplate, CREATURE_TEMPLATES } from './Creature';

export interface Location {
  latitude: number;
  longitude: number;
}

export type EncounterStatus = 'active' | 'caught' | 'defeated' | 'fled';

export interface EncounterConstructorParams {
  creature?: Creature;
  location?: Location;
  timestamp?: number;
  playerLevel?: number;
  status?: EncounterStatus;
}

/**
 * Encounter Model
 * Represents an active encounter with a creature
 */
export class Encounter {
  creature: Creature;
  location: Location;
  timestamp: number;
  playerLevel: number;
  status: EncounterStatus;

  constructor({
    creature,
    location,
    timestamp,
    playerLevel,
    status = 'active',
  }: EncounterConstructorParams = {}) {
    if (!creature) {
      throw new Error('Creature is required for Encounter');
    }
    if (!location) {
      throw new Error('Location is required for Encounter');
    }
    this.creature = creature;
    this.location = location;
    this.timestamp = timestamp || Date.now();
    this.playerLevel = playerLevel || 1;
    this.status = status;
  }

  /**
   * Create a random encounter
   */
  static createRandomEncounter(
    location: Location,
    playerLevel: number = 1
  ): Encounter {
    // Select a random creature template
    const template =
      CREATURE_TEMPLATES[
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
  catch(): void {
    this.status = 'caught';
  }

  /**
   * Mark encounter as defeated
   */
  defeat(): void {
    this.status = 'defeated';
  }

  /**
   * Mark encounter as fled
   */
  flee(): void {
    this.status = 'fled';
  }

  /**
   * Check if encounter is still active
   */
  isActive(): boolean {
    return this.status === 'active';
  }
}

