/**
 * Environment detection and configuration
 *
 * Three environments:
 * - development: Local development (__DEV__ = true)
 * - testing: Staging/testing builds for testers (__DEV__ = false, but with debug features)
 * - production: Public release (__DEV__ = false, no debug features)
 */

export type AppEnvironment = 'development' | 'testing' | 'production';

// Build-time env var, inlined by babel at release-bundle time (see babel.config.js).
// Declared module-locally so we don't pull in all of @types/node for one variable;
// type-only, so the literal `process.env.APP_ENV` reference survives for the babel
// inline plugin to replace.
declare const process: { env: { APP_ENV?: string } };

/**
 * Determine the current app environment.
 *
 * - development: __DEV__ (Metro dev server).
 * - testing:     a release build that explicitly opted in via APP_ENV=testing
 *                — our E2E CI builds, and any internal/beta build that wants the
 *                debug panel, crash-test button, and env banner.
 * - production:  any other release build — the FAIL-SAFE default.
 *
 * `process.env.APP_ENV` is inlined at bundle time by babel
 * (transform-inline-environment-variables, scoped to the production babel env —
 * see babel.config.js). A public App Store / Play build leaves APP_ENV unset, so
 * it falls through to 'production' and ships with debug features OFF. This is
 * deliberately fail-safe: forgetting to set a flag yields a locked-down build,
 * not a leaky one (the previous behavior shipped debug mode in every release).
 */
export function getAppEnvironment(): AppEnvironment {
  if (__DEV__) {
    return 'development';
  }
  // Only an explicit opt-in turns on debug features in a release build.
  return process.env.APP_ENV === 'testing' ? 'testing' : 'production';
}

export const APP_ENV = getAppEnvironment();

/**
 * Environment-based feature flags
 */
export const ENV_CONFIG = {
  // Enable debug mode UI (debug menu, crash test button, etc.)
  enableDebugMode: APP_ENV === 'development' || APP_ENV === 'testing',

  // Show environment banner (shows build type: development or testing)
  // Excludes production to avoid showing banner to end users
  showEnvironmentBanner: APP_ENV === 'development' || APP_ENV === 'testing',

  // Enable Crashlytics crash testing
  enableCrashTest: APP_ENV === 'development' || APP_ENV === 'testing',

  // Enable verbose logging
  enableVerboseLogging: APP_ENV === 'development',

  // Environment name for display
  environmentName: APP_ENV,
} as const;
