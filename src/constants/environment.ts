export type AppEnvironment = 'development' | 'testing' | 'production';

export function getAppEnvironment(): AppEnvironment {
  if (__DEV__) {
    return 'development';
  }
  // TODO: distinguish 'testing' (E2E / staging) from 'production' once proper
  // build variants exist (react-native-config or native BuildConfig flag).
  // Until then, non-dev builds return 'testing' so the debug panel stays
  // available for E2E tests, which depend on debug-force-encounter.
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
