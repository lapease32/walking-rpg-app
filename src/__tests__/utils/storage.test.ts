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
import {
  isValidPlayerData,
  isValidEncounterData,
  saveTrackingState,
  loadTrackingState,
  clearAllUserData,
  appendWalkSummaryEntry,
  loadWalkSummary,
  clearWalkSummary,
  WalkSummaryEntry,
} from '../../utils/storage';

const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockMultiRemove = AsyncStorage.multiRemove as jest.Mock;

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
  creature: {
    id: 'test',
    name: 'Test',
    type: 'Nature',
    maxHp: 50,
    attack: 15,
    defense: 5,
    speed: 20,
  },
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
    expect(mockSetItem).toHaveBeenCalledWith('@walking_rpg:tracking_state', 'true');
  });

  it('calls AsyncStorage.setItem with false', async () => {
    mockSetItem.mockResolvedValue(undefined);
    const result = await saveTrackingState(false);
    expect(result).toBe(true);
    expect(mockSetItem).toHaveBeenCalledWith('@walking_rpg:tracking_state', 'false');
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

describe('clearAllUserData', () => {
  beforeEach(() => {
    mockMultiRemove.mockReset();
  });

  it('removes every per-user key (player, encounter, tracking, conflict) in one call', async () => {
    mockMultiRemove.mockResolvedValue(undefined);
    await clearAllUserData();
    expect(mockMultiRemove).toHaveBeenCalledTimes(1);
    const keys = mockMultiRemove.mock.calls[0][0] as string[];
    expect(keys).toEqual(
      expect.arrayContaining([
        '@walking_rpg:player_data',
        '@walking_rpg:player_saved_at',
        '@walking_rpg:pending_encounter',
        '@walking_rpg:walk_summary',
        '@walking_rpg:tracking_state',
        '@walking_rpg:conflict_pending',
      ]),
    );
    // SETTINGS is device-level, not account data — it must NOT be wiped on account deletion.
    expect(keys).not.toContain('@walking_rpg:settings');
  });

  it('propagates storage errors rather than swallowing them', async () => {
    // Erasure contract: account deletion must be able to detect a failed wipe and retry.
    // If this regresses to swallowing errors, leftover data could resurrect post-deletion.
    mockMultiRemove.mockRejectedValue(new Error('storage error'));
    await expect(clearAllUserData()).rejects.toThrow('storage error');
  });
});

const makeSummaryEntry = (overrides: Partial<WalkSummaryEntry> = {}): WalkSummaryEntry => ({
  creatureName: 'Goblin',
  rarity: 'common',
  won: true,
  xpGained: 20,
  item: null,
  timestamp: 1000,
  ...overrides,
});

describe('loadWalkSummary', () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    (AsyncStorage.removeItem as jest.Mock).mockReset();
  });

  it('returns an empty array when nothing is stored', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await loadWalkSummary()).toEqual([]);
  });

  it('returns the parsed entries when valid', async () => {
    const entries = [makeSummaryEntry(), makeSummaryEntry({ won: false, xpGained: 5 })];
    mockGetItem.mockResolvedValue(JSON.stringify(entries));
    expect(await loadWalkSummary()).toEqual(entries);
  });

  it('clears and returns empty when the stored value is corrupted', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([{ nonsense: true }]));
    expect(await loadWalkSummary()).toEqual([]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@walking_rpg:walk_summary');
  });

  it('returns empty when the stored value is not an array', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ creatureName: 'x' }));
    expect(await loadWalkSummary()).toEqual([]);
  });

  it('returns empty when AsyncStorage throws', async () => {
    mockGetItem.mockRejectedValue(new Error('storage error'));
    expect(await loadWalkSummary()).toEqual([]);
  });
});

describe('appendWalkSummaryEntry', () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
  });

  it('appends to the existing log and persists', async () => {
    const existing = [makeSummaryEntry({ timestamp: 1 })];
    mockGetItem.mockResolvedValue(JSON.stringify(existing));
    mockSetItem.mockResolvedValue(undefined);

    const entry = makeSummaryEntry({ timestamp: 2 });
    const result = await appendWalkSummaryEntry(entry);

    expect(result).toBe(true);
    const [key, saved] = mockSetItem.mock.calls[0];
    expect(key).toBe('@walking_rpg:walk_summary');
    expect(JSON.parse(saved)).toEqual([...existing, entry]);
  });

  it('starts a new log when none exists', async () => {
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);

    const entry = makeSummaryEntry();
    await appendWalkSummaryEntry(entry);

    expect(JSON.parse(mockSetItem.mock.calls[0][1])).toEqual([entry]);
  });

  it('trims to the most recent 100 entries', async () => {
    const existing = Array.from({ length: 100 }, (_, i) => makeSummaryEntry({ timestamp: i }));
    mockGetItem.mockResolvedValue(JSON.stringify(existing));
    mockSetItem.mockResolvedValue(undefined);

    const entry = makeSummaryEntry({ timestamp: 999 });
    await appendWalkSummaryEntry(entry);

    const saved = JSON.parse(mockSetItem.mock.calls[0][1]) as WalkSummaryEntry[];
    expect(saved).toHaveLength(100);
    // Oldest (timestamp 0) dropped; newest kept.
    expect(saved[saved.length - 1]).toEqual(entry);
    expect(saved.find(e => e.timestamp === 0)).toBeUndefined();
  });

  it('returns false when AsyncStorage throws', async () => {
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockRejectedValue(new Error('storage error'));
    expect(await appendWalkSummaryEntry(makeSummaryEntry())).toBe(false);
  });

  it('does not drop entries when two appends overlap (serialized read-modify-write)', async () => {
    // Back the mock with a real store whose get/set YIELD, so two un-awaited appends interleave —
    // the exact overlap that could drop an entry without the module-level write chain.
    let store: string | null = null;
    mockGetItem.mockImplementation(async (key: string) => {
      if (key !== '@walking_rpg:walk_summary') return null;
      await Promise.resolve();
      return store;
    });
    mockSetItem.mockImplementation(async (key: string, val: string) => {
      if (key !== '@walking_rpg:walk_summary') return;
      await Promise.resolve();
      store = val;
    });

    const a = makeSummaryEntry({ creatureName: 'A', timestamp: 1 });
    const b = makeSummaryEntry({ creatureName: 'B', timestamp: 2 });
    // Fire both without awaiting the first — a lost update here would drop one entry.
    await Promise.all([appendWalkSummaryEntry(a), appendWalkSummaryEntry(b)]);

    const finalEntries = JSON.parse(store ?? '[]') as WalkSummaryEntry[];
    expect(finalEntries.map(e => e.creatureName).sort()).toEqual(['A', 'B']);
  });
});

describe('clearWalkSummary', () => {
  beforeEach(() => {
    (AsyncStorage.removeItem as jest.Mock).mockReset();
  });

  it('removes the walk-summary key', async () => {
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    const result = await clearWalkSummary();
    expect(result).toBe(true);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@walking_rpg:walk_summary');
  });

  it('returns false when AsyncStorage throws', async () => {
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('storage error'));
    expect(await clearWalkSummary()).toBe(false);
  });
});
