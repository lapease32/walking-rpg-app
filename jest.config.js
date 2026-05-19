module.exports = {
  preset: '@react-native/jest-preset',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-firebase)/)',
  ],
  moduleNameMapper: {
    '../services/CloudSyncService': '<rootDir>/src/__mocks__/services/CloudSyncService.ts',
    '../../services/CloudSyncService': '<rootDir>/src/__mocks__/services/CloudSyncService.ts',
  },
};
