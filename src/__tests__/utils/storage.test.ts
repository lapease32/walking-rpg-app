jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    multiRemove: jest.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidPlayerData, isValidEncounterData, saveTrackingState, loadTrackingState } from '../../utils/storage';

const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockGetItem = AsyncStorage.getItem as jest.Mock;

const validPlayerData = () => ({
  id: 'player1',
  name: 'Adventurer',
  level: 1,
  experience: 0,
  attack: 20,
  defense: 5,
  totalDistance: 0,
  totalEncounters: 0,
  creaturesDefeated: 0,
  equipment: {},
});

const validEncounterData = () => ({
  creature: { id: 'test', name: 'Test', type: 'Nature', maxHp: 50, attack: 15, defense: 5, speed: 20 },
  location: { latitude: 37.7, longitude: -122.4 },
  timestamp: Date.now(),
  playerLevel: 1,
  status: 'active' as const,
});

describe('isValidPlayerData', () => {
  it('returns false for null', () => {
    expect(isValidPlayerData(null)).toBe(false);
  });

  it('returns false for non-object types', () => {
    expect(isValidPlayerData('string')).toBe(false);
    expect(isValidPlayerData(42)).toBe(false);
    expect(isValidPlayerData([])).toBe(false);
  });

  it('returns true for a valid player data object', () => {
    expect(isValidPlayerData(validPlayerData())).toBe(true);
  });

  it('returns false when id is missing', () => {
    const data = validPlayerData();
    delete (data as any).id;
    expect(isValidPlayerData(data)).toBe(false);
  });

  it('returns false when level is below 1', () => {
    expect(isValidPlayerData({ ...validPlayerData(), level: 0 })).toBe(false);
  });

  it('returns false when level is not a number', () => {
    expect(isValidPlayerData({ ...validPlayerData(), level: 'one' })).toBe(false);
  });

  it('returns false when equipment is missing', () => {
    const data = validPlayerData();
    delete (data as any).equipment;
    expect(isValidPlayerData(data)).toBe(false);
  });

  it('returns false when equipment is null', () => {
    expect(isValidPlayerData({ ...validPlayerData(), equipment: null })).toBe(false);
  });

  it('returns false when required numeric fields are missing', () => {
    expect(isValidPlayerData({ ...validPlayerData(), attack: undefined })).toBe(false);
    expect(isValidPlayerData({ ...validPlayerData(), totalDistance: undefined })).toBe(false);
    expect(isValidPlayerData({ ...validPlayerData(), creaturesDefeated: undefined })).toBe(false);
  });
});

describe('isValidEncounterData', () => {
  it('returns false for null', () => {
    expect(isValidEncounterData(null)).toBe(false);
  });

  it('returns false for non-object types', () => {
    expect(isValidEncounterData('string')).toBe(false);
    expect(isValidEncounterData(42)).toBe(false);
  });

  it('returns true for valid encounter data', () => {
    expect(isValidEncounterData(validEncounterData())).toBe(true);
  });

  it('returns true for all valid status values', () => {
    expect(isValidEncounterData({ ...validEncounterData(), status: 'active' })).toBe(true);
    expect(isValidEncounterData({ ...validEncounterData(), status: 'defeated' })).toBe(true);
    expect(isValidEncounterData({ ...validEncounterData(), status: 'fled' })).toBe(true);
  });

  it('returns false for an invalid status string', () => {
    expect(isValidEncounterData({ ...validEncounterData(), status: 'caught' })).toBe(false);
    expect(isValidEncounterData({ ...validEncounterData(), status: '' })).toBe(false);
    expect(isValidEncounterData({ ...validEncounterData(), status: 'unknown' })).toBe(false);
  });

  it('returns false when creature is missing', () => {
    const data = validEncounterData();
    delete (data as any).creature;
    expect(isValidEncounterData(data)).toBe(false);
  });

  it('returns false when location is null', () => {
    expect(isValidEncounterData({ ...validEncounterData(), location: null })).toBe(false);
  });

  it('returns false when timestamp is not a number', () => {
    expect(isValidEncounterData({ ...validEncounterData(), timestamp: '12345' })).toBe(false);
  });

  it('returns false when playerLevel is missing', () => {
    const data = validEncounterData();
    delete (data as any).playerLevel;
    expect(isValidEncounterData(data)).toBe(false);
  });
});

describe('saveTrackingState', () => {
  beforeEach(() => {
    mockSetItem.mockReset();
    mockGetItem.mockReset();
  });

  it('calls AsyncStorage.setItem with true', async () => {
    mockSetItem.mockResolvedValue(undefined);
    const result = await saveTrackingState(true);
    expect(result).toBe(true);
    expect(mockSetItem).toHaveBeenCalledWith(
      '@walking_rpg:tracking_state',
      'true',
    );
  });

  it('calls AsyncStorage.setItem with false', async () => {
    mockSetItem.mockResolvedValue(undefined);
    const result = await saveTrackingState(false);
    expect(result).toBe(true);
    expect(mockSetItem).toHaveBeenCalledWith(
      '@walking_rpg:tracking_state',
      'false',
    );
  });

  it('returns false when AsyncStorage throws', async () => {
    mockSetItem.mockRejectedValue(new Error('storage error'));
    const result = await saveTrackingState(true);
    expect(result).toBe(false);
  });
});

describe('loadTrackingState', () => {
  beforeEach(() => {
    mockSetItem.mockReset();
    mockGetItem.mockReset();
  });

  it('returns true when stored value is true', async () => {
    mockGetItem.mockResolvedValue('true');
    expect(await loadTrackingState()).toBe(true);
  });

  it('returns false when stored value is false', async () => {
    mockGetItem.mockResolvedValue('false');
    expect(await loadTrackingState()).toBe(false);
  });

  it('returns false when no value is stored', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await loadTrackingState()).toBe(false);
  });

  it('returns false when AsyncStorage throws', async () => {
    mockGetItem.mockRejectedValue(new Error('storage error'));
    expect(await loadTrackingState()).toBe(false);
  });
});
