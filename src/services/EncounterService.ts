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
   * Get encounter probability based on distance only (ignoring time constraint)
   * Useful for debugging to see what the probability would be
   */
  getDistanceBasedProbability(): number {
    if (this.distanceSinceLastEncounter < this.minEncounterDistance) {
      return 0; // Distance constraint not met
    }
    
    const extraDistance =
      this.distanceSinceLastEncounter - this.minEncounterDistance;
    return Math.min(1, extraDistance * this.encounterChancePerMeter);
  }

  /**
   * Get encounter probability for current distance (includes time constraint check)
   * This returns the probability that will actually be used in processDistanceUpdate
   */
  getCurrentEncounterProbability(): number {
    // Check time constraint first (same as processDistanceUpdate)
    const timeSinceLastEncounter = this.lastEncounterTime
      ? Date.now() - this.lastEncounterTime
      : Infinity;
    
    if (timeSinceLastEncounter < this.minTimeBetweenEncounters) {
      return 0; // Time constraint not met
    }
    
    // If time constraint is met, return distance-based probability
    return this.getDistanceBasedProbability();
  }

  /**
   * Get encounter probability that would result after adding incremental distance (ignoring time constraint)
   * Useful for debugging to see what the probability would be
   */
  getDistanceBasedProbabilityAfterIncremental(incrementalDistance: number): number {
    const distanceAfterIncremental = this.distanceSinceLastEncounter + incrementalDistance;
    if (distanceAfterIncremental < this.minEncounterDistance) {
      return 0; // Distance constraint not met
    }
    
    const extraDistance = distanceAfterIncremental - this.minEncounterDistance;
    return Math.min(1, extraDistance * this.encounterChancePerMeter);
  }

  /**
   * Get encounter probability that would result after adding incremental distance
   * This is used to calculate the probability that will actually be used in processDistanceUpdate
   */
  getProbabilityAfterIncremental(incrementalDistance: number): number {
    // Check time constraint first (same as processDistanceUpdate)
    const timeSinceLastEncounter = this.lastEncounterTime
      ? Date.now() - this.lastEncounterTime
      : Infinity;
    
    if (timeSinceLastEncounter < this.minTimeBetweenEncounters) {
      return 0; // Time constraint not met
    }
    
    // If time constraint is met, return distance-based probability after incremental
    return this.getDistanceBasedProbabilityAfterIncremental(incrementalDistance);
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
   * Check if time constraint is currently blocking encounters
   */
  isTimeConstraintBlocking(): boolean {
    if (!this.lastEncounterTime) {
      return false; // No previous encounter, time constraint not blocking
    }
    const timeSinceLastEncounter = Date.now() - this.lastEncounterTime;
    return timeSinceLastEncounter < this.minTimeBetweenEncounters;
  }

  /**
   * Get time remaining until encounters can occur again (in seconds)
   * Returns 0 if time constraint is not blocking
   */
  getTimeRemainingUntilEncounter(): number {
    if (!this.lastEncounterTime) {
      return 0; // No previous encounter
    }
    const timeSinceLastEncounter = Date.now() - this.lastEncounterTime;
    const remaining = this.minTimeBetweenEncounters - timeSinceLastEncounter;
    return Math.max(0, Math.ceil(remaining / 1000)); // Convert to seconds
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

