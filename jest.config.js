module.exports = {
  preset: '@react-native/jest-preset',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-firebase|react-native-reanimated|react-native-worklets|react-native-gesture-handler|react-native-is-edge-to-edge|@shopify/react-native-skia|react-native-svg)/)',
  ],
  moduleNameMapper: {
    '../services/CloudSyncService': '<rootDir>/src/__mocks__/services/CloudSyncService.ts',
    '../../services/CloudSyncService': '<rootDir>/src/__mocks__/services/CloudSyncService.ts',
    // CrashlyticsService pulls in @react-native-firebase/crashlytics (native) on import; the logger
    // forwards to it, so stub it everywhere (no test exercises the real service).
    '(\\.\\./)+services/CrashlyticsService$':
      '<rootDir>/src/__mocks__/services/CrashlyticsService.ts',
    '\\./CrashlyticsService$': '<rootDir>/src/__mocks__/services/CrashlyticsService.ts',
  },
};
