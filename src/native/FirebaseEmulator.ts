import { NativeModules } from 'react-native';

interface FirebaseEmulatorNativeModule {
  getEmulatorHost(): string | null;
}

const { FirebaseEmulator } = NativeModules as {
  FirebaseEmulator?: FirebaseEmulatorNativeModule;
};

/**
 * Synchronously reads the Firebase emulator host set via ADB in CI:
 *   adb shell settings put global firebase_emulator_host 10.0.2.2
 *
 * Returns null on iOS, real devices, and non-CI Android emulators.
 * Safe to call at module load time — the underlying Settings.Global lookup
 * is a fast in-memory operation.
 */
export function getEmulatorHost(): string | null {
  if (!FirebaseEmulator) return null;
  const host = FirebaseEmulator.getEmulatorHost();
  return host && host.length > 0 ? host : null;
}
