export type AppEnvironment = 'development' | 'testing' | 'production';

export function getAppEnvironment(): AppEnvironment {
  if (__DEV__) {
    return 'development';
  }
  // Non-dev builds intentionally return 'testing' until build variants exist.
  // The E2E Maestro golden-path test taps debug-force-encounter (rendered only
  // when enableDebugMode=true). Returning 'production' here hides that element
  // and breaks the test. Proper fix: add react-native-config or a native
  // BuildConfig flag so the E2E workflow can set APP_ENV=testing while
  // production store builds get APP_ENV=production.
  return 'testing';
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
