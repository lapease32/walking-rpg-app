/**
 * Environment detection and configuration
 * 
 * Three environments:
 * - development: Local development (__DEV__ = true)
 * - testing: Staging/testing builds for testers (__DEV__ = false, but with debug features)
 * - production: Public release (__DEV__ = false, no debug features)
 */

export type AppEnvironment = 'development' | 'testing' | 'production';

/**
 * Determine the current app environment
 * 
 * For now, we use __DEV__ to distinguish development from release builds.
 * Later, you can add build-time environment variables or build flavors
 * to distinguish testing from production.
 */
export function getAppEnvironment(): AppEnvironment {
  // In development, always return 'development'
  if (__DEV__) {
    return 'development';
  }
  
  // For release builds, check if it's a testing build
  // You can later add a build-time constant or check app version
  // For now, we'll use a simple check - you can enhance this later
  // by adding a build-time environment variable or checking version string
  
  // TODO: Add build-time detection for testing vs production
  // For now, assume all non-dev builds are 'testing' until you set up proper build variants
  // Change this to 'production' when you're ready to release publicly
  return 'testing'; // Change to 'production' for public releases
}

export const APP_ENV = getAppEnvironment();

/**
 * Environment-based feature flags
 */
export const ENV_CONFIG = {
  // Enable debug mode UI (debug menu, crash test button, etc.)
  enableDebugMode: APP_ENV === 'development' || APP_ENV === 'testing',
  
  // Show beta indicator (legacy - for testing builds)
  showBetaIndicator: APP_ENV === 'testing',
  
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
