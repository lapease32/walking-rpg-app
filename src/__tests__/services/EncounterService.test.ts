import { EncounterService } from '../../services/EncounterService';
import type { DistanceData } from '../../services/LocationService';

const makeLocation = () => ({ latitude: 37.7749, longitude: -122.4194 });
const makeDistanceData = (incremental: number): DistanceData => ({
  incremental,
  total: incremental,
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 10,
    altitude: null,
    heading: null,
    speed: 0,
    timestamp: Date.now(),
  },
});

describe('EncounterService', () => {
  let service: EncounterService;

  beforeEach(() => {
    service = new EncounterService();
    // Prevent encounters from firing during state-setup steps
    jest.spyOn(Math, 'random').mockReturnValue(1);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getDistanceBasedProbability', () => {
    it('returns 0 when no distance has been accumulated', () => {
      expect(service.getDistanceBasedProbability()).toBe(0);
    });

    it('returns 0 at exactly the minimum encounter distance (no extra distance)', () => {
      service.processDistanceUpdate(makeDistanceData(50), makeLocation());
      expect(service.getDistanceBasedProbability()).toBe(0);
    });

    it('returns correct probability above minimum distance', () => {
      // 100m total: extraDistance = 100 - 50 = 50, probability = 50 * 0.001 = 0.05
      service.processDistanceUpdate(makeDistanceData(100), makeLocation());
      expect(service.getDistanceBasedProbability()).toBeCloseTo(0.05);
    });

    it('caps probability at 1.0', () => {
      // >1050m: extraDistance >= 1000, probability capped at 1.0
      service.processDistanceUpdate(makeDistanceData(1100), makeLocation());
      expect(service.getDistanceBasedProbability()).toBe(1.0);
    });
  });

  describe('getDistanceBasedProbabilityAfterIncremental', () => {
    it('returns 0 when incremental would keep total below minimum', () => {
      expect(service.getDistanceBasedProbabilityAfterIncremental(30)).toBe(0);
    });

    it('returns correct probability when incremental pushes past minimum', () => {
      // 0 current + 100 incremental: extraDistance = 50, probability = 0.05
      expect(service.getDistanceBasedProbabilityAfterIncremental(100)).toBeCloseTo(0.05);
    });
  });

  describe('processDistanceUpdate', () => {
    it('returns null when distanceData is null', () => {
      expect(service.processDistanceUpdate(null, makeLocation())).toBeNull();
    });

    it('returns null when playerLocation is null', () => {
      expect(service.processDistanceUpdate(makeDistanceData(100), null)).toBeNull();
    });

    it('returns null when accumulated distance is below minimum', () => {
      const result = service.processDistanceUpdate(makeDistanceData(10), makeLocation());
      expect(result).toBeNull();
    });

    it('triggers encounter callback when an encounter fires', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0); // guarantee encounter fires
      const callback = jest.fn();
      service.setEncounterCallback(callback);
      service.processDistanceUpdate(makeDistanceData(500), makeLocation());
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('returns the encounter when one fires', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      const encounter = service.processDistanceUpdate(makeDistanceData(500), makeLocation());
      expect(encounter).not.toBeNull();
    });
  });

  describe('isTimeConstraintBlocking', () => {
    it('returns false when there has been no previous encounter', () => {
      expect(service.isTimeConstraintBlocking()).toBe(false);
    });

    it('returns true immediately after an encounter fires', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      service.processDistanceUpdate(makeDistanceData(500), makeLocation());
      expect(service.isTimeConstraintBlocking()).toBe(true);
    });

    it('returns false when bypass is enabled', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      service.processDistanceUpdate(makeDistanceData(500), makeLocation());
      service.setBypassTimeConstraint(true);
      expect(service.isTimeConstraintBlocking()).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears accumulated distance and last encounter time', () => {
      service.processDistanceUpdate(makeDistanceData(100), makeLocation());
      service.reset();
      expect(service.getDistanceBasedProbability()).toBe(0);
      expect(service.isTimeConstraintBlocking()).toBe(false);
    });
  });

  describe('configure', () => {
    it('updates minEncounterDistance', () => {
      service.configure({ minEncounterDistance: 200 });
      // At 150m accumulated, should still be 0 probability (below new min of 200)
      service.processDistanceUpdate(makeDistanceData(150), makeLocation());
      expect(service.getDistanceBasedProbability()).toBe(0);
    });

    it('updates encounterChancePerMeter', () => {
      service.configure({ minEncounterDistance: 0, encounterChancePerMeter: 0.01 });
      // At 10m extra, probability = 10 * 0.01 = 0.1
      service.processDistanceUpdate(makeDistanceData(10), makeLocation());
      expect(service.getDistanceBasedProbability()).toBeCloseTo(0.1);
    });
  });

  describe('getEncounterStatus', () => {
    it('returns a status object with expected fields', () => {
      const status = service.getEncounterStatus();
      expect(status).toHaveProperty('distanceSinceLastEncounter');
      expect(status).toHaveProperty('minEncounterDistance');
      expect(status).toHaveProperty('probability');
      expect(status).toHaveProperty('timeSinceLastEncounter');
    });

    it('returns null for timeSinceLastEncounter when no encounter has occurred', () => {
      expect(service.getEncounterStatus().timeSinceLastEncounter).toBeNull();
    });
  });
});
