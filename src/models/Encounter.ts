import {
  Creature,
  Rarity,
  createCreatureFromTemplate,
  pickEncounterTemplate,
  pickEncounterTemplateOfRarity,
} from './Creature';
import { isDaylight } from './sun';

export interface Location {
  latitude: number;
  longitude: number;
}

export const ENCOUNTER_STATUSES = ['active', 'defeated', 'fled'] as const;
export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

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
    playerLevel: number = 1,
    rarityOverride?: Rarity,
  ): Encounter {
    // Is the sun up where this encounter happened? Encounters are GPS-driven, so we always have a
    // real position — no guessing. This comes from the REAL sun, NEVER from the app's theme: the
    // theme is a cosmetic preference, and if spawning read it, the Settings toggle would become a
    // spawn-table switch (tap "Night", farm night creatures). See models/sun + the day/night design.
    const daylight = isDaylight(new Date(), location.latitude, location.longitude);

    // Pick a creature template weighted by player level (low levels skew to common, so new
    // players aren't thrown unwinnable above-common fights). See pickEncounterTemplate.
    // rarityOverride (debug encounter-forcing) forces a specific rarity instead of rolling.
    // `daylight` narrows WHICH creature — mundane by day, supernatural by night — and provably not
    // how rewarding it is (the rarity is rolled first and the filter applies within it).
    const template = rarityOverride
      ? pickEncounterTemplateOfRarity(rarityOverride, daylight)
      : pickEncounterTemplate(playerLevel, daylight);

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
