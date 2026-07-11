// Jest mock for CrashlyticsService — keeps the real @react-native-firebase/crashlytics (which fires
// a native event emitter on import) out of the test runtime. Mapped in jest.config moduleNameMapper.
// The logger forwards warn/error here, so anything importing the logger transitively gets this stub.
export default {
  log: jest.fn(),
  recordError: jest.fn(),
  setAttribute: jest.fn(),
  setAttributes: jest.fn(),
  crash: jest.fn(),
};
