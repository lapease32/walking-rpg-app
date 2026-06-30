import { NativeModules, Platform } from 'react-native';
import { hasBatteryPromptBeenShown, setBatteryPromptShown } from '../utils/storage';

interface BatteryOptimizationNative {
  isIgnoringBatteryOptimizations(): Promise<boolean>;
  requestExemption(): Promise<boolean>;
}

const native: BatteryOptimizationNative | undefined = NativeModules.BatteryOptimization;

/**
 * Pure decision: should we show the battery-optimization exemption prompt?
 * Only on Android, only when the app isn't already exempt, and only once — we never re-nag a user
 * who already saw it (they can still enable it manually in system settings). Extracted as a pure
 * function so the gating logic is unit-tested without the native module.
 */
export function shouldPromptForExemption(params: {
  isAndroid: boolean;
  isIgnoring: boolean;
  alreadyAsked: boolean;
}): boolean {
  return params.isAndroid && !params.isIgnoring && !params.alreadyAsked;
}

/**
 * Wraps the native BatteryOptimization module. Android-only: on iOS (no Doze equivalent we manage
 * this way) and when the native module is unavailable, the methods are safe no-ops that report the
 * app as already exempt so nothing prompts.
 */
class BatteryOptimizationService {
  // Guards against overlapping calls (e.g. rapid startTracking) both passing the async
  // "already asked?" check and launching the dialog twice before the flag is written.
  private promptInFlight = false;

  async isIgnoring(): Promise<boolean> {
    if (Platform.OS !== 'android' || !native) {
      return true;
    }
    try {
      return await native.isIgnoringBatteryOptimizations();
    } catch (error) {
      // Fail safe: treat as exempt so a flaky check never spams the prompt.
      console.warn('BatteryOptimizationService: isIgnoring check failed', error);
      return true;
    }
  }

  /**
   * Show the system battery-optimization exemption dialog once — the first time tracking starts on
   * Android while the app isn't already exempt. No-op on iOS, on repeat calls (persisted flag), or
   * if already exempt. Fire-and-forget from the caller's perspective; never throws.
   */
  async maybeRequestExemption(): Promise<void> {
    if (Platform.OS !== 'android' || !native || this.promptInFlight) {
      return;
    }
    this.promptInFlight = true;
    try {
      const [alreadyAsked, isIgnoring] = await Promise.all([
        hasBatteryPromptBeenShown(),
        this.isIgnoring(),
      ]);
      if (!shouldPromptForExemption({ isAndroid: true, isIgnoring, alreadyAsked })) {
        return;
      }
      // requestExemption resolves true if the dialog actually launched, false if the OS reported
      // the app already exempt. Only record "shown" when a dialog truly appeared — so neither an
      // already-exempt no-op nor a launch failure burns the one-time ask.
      const launched = await native.requestExemption();
      if (launched) {
        await setBatteryPromptShown();
      }
    } catch (error) {
      console.warn('BatteryOptimizationService: exemption prompt failed', error);
    } finally {
      this.promptInFlight = false;
    }
  }
}

export default new BatteryOptimizationService();
