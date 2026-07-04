module.exports = function (api) {
  // Make APP_ENV part of babel's cache key so changing it between builds
  // invalidates cached transforms — otherwise Metro/Babel could reuse a transform
  // with a stale inlined APP_ENV and bake the wrong environment (debug on/off) into
  // the bundle until a manual --reset-cache. Keyed here so no reset is needed.
  api.cache.using(() => process.env.APP_ENV);
  return {
    presets: ['module:@react-native/babel-preset'],
    // Powers react-native-reanimated (v4 splits worklets into react-native-worklets). This plugin
    // MUST be listed last. It rewrites 'worklet'-directive functions + Reanimated hooks to run on
    // the UI thread; on non-animated code it's a no-op, so it's safe app-wide (incl. jest, where
    // reanimated is additionally mocked in jest.setup.js).
    plugins: ['react-native-worklets/plugin'],
    env: {
      // Release bundling runs with BABEL_ENV=production. Inline APP_ENV into the
      // bundle there so build-time environment selection is baked into the binary.
      // E2E release builds set APP_ENV=testing (keeps debug controls); a production
      // App Store/Play build leaves it unset → environment.ts falls back to
      // 'production' (debug OFF). Scoped to production only — under the jest 'test'
      // env the plugin does NOT run, so environment.test.ts can vary process.env.
      production: {
        plugins: [['transform-inline-environment-variables', { include: ['APP_ENV'] }]],
      },
    },
  };
};

