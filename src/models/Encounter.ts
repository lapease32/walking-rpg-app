import { Creature, createCreatureFromTemplate, CREATURE_TEMPLATES } from './Creature';

export interface Location {
  latitude: number;
  longitude: number;
}

export const ENCOUNTER_STATUSES = ['active', 'defeated', 'fled'] as const;
export type EncounterStatus = typeof ENCOUNTER_STATUSES[number];

export interface EncounterConstructorParams {
  creature: Creature;
  location: Location;
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
  }: EncounterConstructorParams) {
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

