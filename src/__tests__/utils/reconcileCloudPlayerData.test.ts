jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
  },
}));
jest.mock('../../services/CloudSyncService', () => ({
  __esModule: true,
  default: { loadPlayerData: jest.fn() },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import CloudSyncService from '../../services/CloudSyncService';
import { reconcileCloudPlayerData } from '../../utils/storage';

const mockMultiGet = AsyncStorage.multiGet as jest.Mock;
const mockMultiSet = AsyncStorage.multiSet as jest.Mock;
const mockLoad = CloudSyncService.loadPlayerData as jest.Mock;

const validPlayer = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'Hero',
  level: 2,
  experience: 50,
  attack: 20,
  defense: 5,
  totalDistance: 0,
  totalEncounters: 0,
  creaturesDefeated: 0,
  equipment: {},
  ...overrides,
});

/** Make readLocalPlayerSnapshot (real, via AsyncStorage.multiGet) report this data + savedAt. */
const setLocal = (data: object | null, savedAt: number) => {
  mockMultiGet.mockResolvedValue([
    ['@walking_rpg:player_data', data ? JSON.stringify(data) : null],
    ['@walking_rpg:player_saved_at', String(savedAt)],
  ]);
};

beforeEach(() => {
  mockMultiGet.mockReset();
  mockMultiSet.mockReset().mockResolvedValue(undefined);
  mockLoad.mockReset();
});

describe('reconcileCloudPlayerData', () => {
  it('returns unavailable and NEVER writes local when the cloud read failed/timed out', async () => {
    mockLoad.mockResolvedValue({ status: 'unavailable' });
    setLocal(validPlayer(), 0);
    const res = await reconcileCloudPlayerData();
    // The core data-loss guard: an inconclusive read must not be treated as "no cloud save".
    expect(res).toEqual({ status: 'unavailable' });
    expect(mockMultiSet).not.toHaveBeenCalled();
  });

  it('returns noNewerCloud (does not write local) when the cloud is CONFIRMED empty', async () => {
    mockLoad.mockResolvedValue({ status: 'empty' });
    setLocal(validPlayer(), 100);
    const res = await reconcileCloudPlayerData();
    expect(res).toEqual({ status: 'noNewerCloud' });
    expect(mockMultiSet).not.toHaveBeenCalled();
  });

  it('adopts the cloud save (and writes it to local) when cloud is strictly newer', async () => {
    const cloud = validPlayer({ level: 5 });
    mockLoad.mockResolvedValue({
      status: 'found',
      record: { playerData: cloud, lastSavedAt: 200 },
    });
    setLocal(validPlayer({ level: 2 }), 100); // local older
    const res = await reconcileCloudPlayerData();
    expect(res).toEqual({ status: 'adopted', data: cloud });
    expect(mockMultiSet).toHaveBeenCalled();
  });

  it('keeps local (noNewerCloud) when a cloud save exists but is not newer', async () => {
    const cloud = validPlayer({ level: 1 });
    mockLoad.mockResolvedValue({
      status: 'found',
      record: { playerData: cloud, lastSavedAt: 50 },
    });
    setLocal(validPlayer({ level: 2 }), 100); // local newer
    const res = await reconcileCloudPlayerData();
    expect(res).toEqual({ status: 'noNewerCloud' });
    expect(mockMultiSet).not.toHaveBeenCalled();
  });

  it('a PROVISIONAL local (savedAt 0) yields to ANY real cloud save', async () => {
    // Provisional characters are saved with savedAt 0 specifically so any real cloud save
    // (lastSavedAt > 0) outranks them and is adopted — the heart of "never lose real progress".
    const cloud = validPlayer({ level: 7 });
    mockLoad.mockResolvedValue({
      status: 'found',
      record: { playerData: cloud, lastSavedAt: 1 },
    });
    setLocal(validPlayer({ level: 1 }), 0); // provisional
    const res = await reconcileCloudPlayerData();
    expect(res).toEqual({ status: 'adopted', data: cloud });
    expect(mockMultiSet).toHaveBeenCalled();
  });

  it('treats a malformed cloud doc as unavailable (never overwrites on a validator miss)', async () => {
    mockLoad.mockResolvedValue({
      status: 'found',
      record: { playerData: { junk: true }, lastSavedAt: 999 },
    });
    setLocal(validPlayer(), 0);
    const res = await reconcileCloudPlayerData();
    expect(res).toEqual({ status: 'unavailable' });
    expect(mockMultiSet).not.toHaveBeenCalled();
  });
});
