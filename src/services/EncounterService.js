import { Encounter } from '../models/Encounter';
import { CREATURE_TEMPLATES } from '../models/Creature';

/**
 * Encounter Service
 * Handles random encounter generation based on distance traveled
 */
class EncounterService {
  constructor() {
    this.distanceSinceLastEncounter = 0; // meters
    this.lastEncounterTime = null;
    this.minEncounterDistance = 50; // Minimum meters before next encounter possible
    this.encounterChancePerMeter = 0.001; // 0.1% chance per meter after min distance
    this.minTimeBetweenEncounters = 30000; // 30 seconds minimum between encounters
    this.onEncounterGenerated = null;
  }

  /**
   * Set callback for when an encounter is generated
   */
  setEncounterCallback(callback) {
    this.onEncounterGenerated = callback;
  }

  /**
   * Process distance update and potentially generate an encounter
   */
  processDistanceUpdate(distanceData, playerLocation, playerLevel = 1) {
    if (!distanceData || !playerLocation) {
      return null;
    }

    const { incremental, total } = distanceData;
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
      const extraDistance = this.distanceSinceLastEncounter - this.minEncounterDistance;
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
  generateEncounter(location, playerLevel = 1) {
    return Encounter.createRandomEncounter(location, playerLevel);
  }

  /**
   * Get encounter probability for current distance
   */
  getCurrentEncounterProbability() {
    if (this.distanceSinceLastEncounter < this.minEncounterDistance) {
      return 0;
    }
    const extraDistance = this.distanceSinceLastEncounter - this.minEncounterDistance;
    return Math.min(1, extraDistance * this.encounterChancePerMeter);
  }

  /**
   * Force generate an encounter (for testing)
   */
  forceEncounter(location, playerLevel = 1) {
    const encounter = this.generateEncounter(location, playerLevel);
    this.distanceSinceLastEncounter = 0;
    this.lastEncounterTime = Date.now();
    return encounter;
  }

  /**
   * Reset encounter tracking
   */
  reset() {
    this.distanceSinceLastEncounter = 0;
    this.lastEncounterTime = null;
  }

  /**
   * Configure encounter settings
   */
  configure({
    minEncounterDistance,
    encounterChancePerMeter,
    minTimeBetweenEncounters,
  }) {
    if (minEncounterDistance !== undefined) {
      this.minEncounterDistance = minEncounterDistance;
    }
    if (encounterChancePerMeter !== undefined) {
      this.encounterChancePerMeter = encounterChancePerMeter;
    }
    if (minTimeBetweenEncounters !== undefined) {
      this.minTimeBetweenEncounters = minTimeBetweenEncounters;
    }
  }

  /**
   * Get stats about encounter readiness
   */
  getEncounterStatus() {
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

