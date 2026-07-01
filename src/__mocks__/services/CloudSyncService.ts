export default {
  initialize: jest.fn().mockResolvedValue(undefined),
  savePlayerData: jest.fn().mockResolvedValue(undefined),
  loadPlayerData: jest.fn().mockResolvedValue(null),
  getSyncStatus: jest.fn(() => ({
    lastSuccessfulSyncAt: null,
    pendingWrites: 0,
    writesSuspended: false,
  })),
};
