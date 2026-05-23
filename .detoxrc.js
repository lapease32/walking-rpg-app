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
      build: [
        'xcodebuild',
        '-workspace ios/WalkingRPGTemp.xcworkspace',
        '-scheme WalkingRPGTemp',
        '-configuration Debug',
        '-sdk iphonesimulator',
        '-derivedDataPath ios/build',
        'CODE_SIGNING_ALLOWED=NO',
        'COMPILER_INDEX_STORE_ENABLE=NO',
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
      launchArgs: {
        DetoxE2E: 'YES',
        detoxURLBlacklistRegex: 'http://localhost:9099.*|http://localhost:8080.*',
      },
      permissions: {
        location: 'always',
        notifications: 'YES',
      },
    },
  },
};
