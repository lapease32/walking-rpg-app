// NOTE: imported as '../CloudSyncService' (not '../../services/CloudSyncService') on purpose —
// jest.config's moduleNameMapper redirects any path containing 'services/CloudSyncService' to the
// project-wide mock. This path (and this file's location) dodges that so we exercise the REAL
// service, with only the Firebase modules mocked below.
const mockSetDoc = jest.fn();
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'u1' } })),
}));

import CloudSyncService from '../CloudSyncService';
import { PlayerData } from '../../models/Player';

const player = {} as PlayerData;

describe('CloudSyncService.getSyncStatus tracking', () => {
  beforeEach(() => {
    mockSetDoc.mockReset();
    mockSetDoc.mockResolvedValue(undefined); // default: writes succeed
  });

  it('records lastSuccessfulSyncAt and clears pending after a successful save', async () => {
    const before = Date.now();
    await CloudSyncService.savePlayerData(player, 1);

    const status = CloudSyncService.getSyncStatus();
    expect(status.pendingWrites).toBe(0);
    expect(status.lastSuccessfulSyncAt).not.toBeNull();
    expect(status.lastSuccessfulSyncAt as number).toBeGreaterThanOrEqual(before);
  });

  it('leaves lastSuccessfulSyncAt unchanged on a failed save, but still clears pending', async () => {
    const prev = CloudSyncService.getSyncStatus().lastSuccessfulSyncAt;
    mockSetDoc.mockRejectedValueOnce(new Error('offline'));

    await CloudSyncService.savePlayerData(player, 2);

    const status = CloudSyncService.getSyncStatus();
    expect(status.pendingWrites).toBe(0);
    expect(status.lastSuccessfulSyncAt).toBe(prev);
  });

  it('reports a pending write while the setDoc is in flight', async () => {
    let resolveSet: () => void = () => {};
    mockSetDoc.mockReturnValueOnce(
      new Promise<void>(resolve => {
        resolveSet = resolve;
      }),
    );

    const save = CloudSyncService.savePlayerData(player, 3);
    // savePlayerData increments the counter synchronously, before awaiting the write.
    expect(CloudSyncService.getSyncStatus().pendingWrites).toBe(1);

    resolveSet();
    await save;
    expect(CloudSyncService.getSyncStatus().pendingWrites).toBe(0);
  });
});
