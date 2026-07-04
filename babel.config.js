module.exports = function (api) {
  // Make APP_ENV part of babel's cache key so changing it between builds
  // invalidates cached transforms — otherwise Metro/Babel could reuse a transform
  // with a stale inlined APP_ENV and bake the wrong environment (debug on/off) into
  // the bundle until a manual --reset-cache. Keyed here so no reset is needed.
  api.cache.using(() => process.env.APP_ENV);

  const plugins = [];

  // Release bundling runs with BABEL_ENV=production: inline APP_ENV into the bundle so build-time
  // environment selection is baked into the binary. E2E release builds set APP_ENV=testing (keeps
  // debug controls); a production App Store/Play build leaves it unset → environment.ts falls back
  // to 'production' (debug OFF). Scoped to production only — under the jest 'test' env it does NOT
  // run, so environment.test.ts can vary process.env. Pushed BEFORE the worklets plugin below.
  if (api.env('production')) {
    plugins.push(['transform-inline-environment-variables', { include: ['APP_ENV'] }]);
  }

  // react-native-worklets/plugin powers react-native-reanimated (v4 split worklets into a peer
  // package) and MUST be the LAST plugin. It's built into a single root list here (not babel's
  // `env` block) so it stays last in EVERY env — babel appends `env.*` plugins AFTER root plugins,
  // which would otherwise run the inline-env transform after worklets on production / E2E-release
  // builds and break Reanimated worklets. On non-animated code the plugin is a no-op (safe app-wide,
  // incl. jest, where reanimated is additionally mocked in jest.setup.js).
  plugins.push('react-native-worklets/plugin');

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins,
  };
};

