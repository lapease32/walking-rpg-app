module.exports = {
  presets: ['module:@react-native/babel-preset'],
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

