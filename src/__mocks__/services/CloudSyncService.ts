export default {
  initialize: jest.fn().mockResolvedValue(undefined),
  savePlayerData: jest.fn().mockResolvedValue(undefined),
  loadPlayerData: jest.fn().mockResolvedValue(null),
  isAuthenticated: jest.fn().mockReturnValue(false),
  uid: null,
};
