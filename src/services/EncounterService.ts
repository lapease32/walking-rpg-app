import { Encounter, Location } from '../models/Encounter';
import { DistanceData } from './LocationService';

/**
 * Encounter Service
 * Handles random encounter generation based on distance traveled
 */
type EncounterCallback = (encounter: Encounter) => void;

export interface EncounterConfig {
  minEncounterDistance?: number;
  encounterChancePerMeter?: number;
  minTimeBetweenEncounters?: number;
}

export interface EncounterStatus {
  distanceSinceLastEncounter: number;
  minEncounterDistance: number;
  probability: number;
  timeSinceLastEncounter: number | null;
}

class EncounterService {
  private distanceSinceLastEncounter: number = 0; // meters
  private lastEncounterTime: number | null = null;
  private minEncounterDistance: number = 50; // Minimum meters before next encounter possible
  private encounterChancePerMeter: number = 0.001; // 0.1% chance per meter after min distance
  private minTimeBetweenEncounters: number = 30000; // 30 seconds minimum between encounters
  private onEncounterGenerated: EncounterCallback | null = null;

  /**
   * Set callback for when an encounter is generated
   */
  setEncounterCallback(callback: EncounterCallback): void {
    this.onEncounterGenerated = callback;
  }

  /**
   * Process distance update and potentially generate an encounter
   */
  processDistanceUpdate(
    distanceData: DistanceData | null,
    playerLocation: Location | null,
    playerLevel: number = 1
  ): Encounter | null {
    if (!distanceData || !playerLocation) {
      return null;
    }

    const { incremental } = distanceData;
    this.distanceSinceLastEncounter += incremental;

    // Check if enough distance has been traveled and enough time has passed
    const timeSinceLastEncounter = this.lastEncounterTime
      ? Date.now() - this.lastEncounterTime
      : Infinity;

    if (
      this.distanceSinceLastEncounter >= this.minEncounterDistance &&
      timeSinceLastEncounter >= this.minTimeBetweenEncounters
    ) {
      // Calculate encounter probability
      const extraDistance =
        this.distanceSinceLastEncounter - this.minEncounterDistance;
      const encounterProbability = Math.min(
        1,
        extraDistance * this.encounterChancePerMeter
      );

      // Roll for encounter
      if (Math.random() < encounterProbability) {
        const encounter = this.generateEncounter(playerLocation, playerLevel);

        // Reset encounter tracking
        this.distanceSinceLastEncounter = 0;
        this.lastEncounterTime = Date.now();

        // Trigger callback if set
        if (this.onEncounterGenerated) {
          this.onEncounterGenerated(encounter);
        }

        return encounter;
      }
    }

    return null;
  }

  /**
   * Generate a random encounter
   */
  generateEncounter(location: Location, playerLevel: number = 1): Encounter {
    return Encounter.createRandomEncounter(location, playerLevel);
  }

  /**
   * Get encounter probability for current distance
   */
  getCurrentEncounterProbability(): number {
    if (this.distanceSinceLastEncounter < this.minEncounterDistance) {
      return 0;
    }
    const extraDistance =
      this.distanceSinceLastEncounter - this.minEncounterDistance;
    return Math.min(1, extraDistance * this.encounterChancePerMeter);
  }

  /**
   * Force generate an encounter (for testing)
   */
  forceEncounter(location: Location, playerLevel: number = 1): Encounter {
    const encounter = this.generateEncounter(location, playerLevel);
    this.distanceSinceLastEncounter = 0;
    this.lastEncounterTime = Date.now();
    return encounter;
  }

  /**
   * Reset encounter tracking
   */
  reset(): void {
    this.distanceSinceLastEncounter = 0;
    this.lastEncounterTime = null;
  }

  /**
   * Configure encounter settings
   */
  configure(config: EncounterConfig): void {
    if (config.minEncounterDistance !== undefined) {
      this.minEncounterDistance = config.minEncounterDistance;
    }
    if (config.encounterChancePerMeter !== undefined) {
      this.encounterChancePerMeter = config.encounterChancePerMeter;
    }
    if (config.minTimeBetweenEncounters !== undefined) {
      this.minTimeBetweenEncounters = config.minTimeBetweenEncounters;
    }
  }

  /**
   * Get stats about encounter readiness
   */
  getEncounterStatus(): EncounterStatus {
    return {
      distanceSinceLastEncounter: this.distanceSinceLastEncounter,
      minEncounterDistance: this.minEncounterDistance,
      probability: this.getCurrentEncounterProbability(),
      timeSinceLastEncounter: this.lastEncounterTime
        ? Date.now() - this.lastEncounterTime
        : null,
    };
  }
}

// Export singleton instance
export default new EncounterService();

