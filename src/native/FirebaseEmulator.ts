import { NativeModules } from 'react-native';

interface FirebaseEmulatorNativeModule {
  getEmulatorHost(): Promise<string | null>;
}

const { FirebaseEmulator } = NativeModules as {
  FirebaseEmulator?: FirebaseEmulatorNativeModule;
};

/**
 * Returns the Firebase emulator host set via ADB in CI:
 *   adb shell settings put global firebase_emulator_host 10.0.2.2
 * Returns null on iOS, real devices, and non-CI Android emulators.
 */
export async function getEmulatorHost(): Promise<string | null> {
  if (!FirebaseEmulator) return null;
  const host = await FirebaseEmulator.getEmulatorHost();
  return host && host.length > 0 ? host : null;
}
