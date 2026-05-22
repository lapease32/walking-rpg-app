/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath:
        'ios/build/Build/Products/Debug-iphonesimulator/WalkingRPGTemp.app',
      // DetoxE2E is read by index.ts via Settings.get('DetoxE2E') to suppress
      // the LogBox warning bar that otherwise blocks scroll interactions.
      launchArgs: { DetoxE2E: 'YES' },
      build: [
        'xcodebuild',
        '-workspace ios/WalkingRPGTemp.xcworkspace',
        '-scheme WalkingRPGTemp',
        '-configuration Debug',
        '-sdk iphonesimulator',
        '-derivedDataPath ios/build',
        'CODE_SIGNING_ALLOWED=NO',
        'COMPILER_INDEX_STORE_ENABLE=NO',
        // Force JS bundle embedding in Debug+Simulator builds.
        // react-native-xcode.sh skips bundling when FORCE_BUNDLING is unset
        // and the target is a simulator, which causes a Red Box on CI where
        // Metro is not running.
        'FORCE_BUNDLING=1',
      ].join(' '),
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 16',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
  },
};
