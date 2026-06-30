package com.walkingrpgtemp;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * Lets the JS layer ask Android to exempt the app from battery optimization (Doze / OEM
 * background killers like Samsung, Xiaomi), so GPS tracking isn't suspended while the user walks
 * with the screen off. minSdk is 24, so PowerManager.isIgnoringBatteryOptimizations is always
 * available — no API-level guard needed. Methods are async (Promise-returning) per the New
 * Architecture pattern. Registered via BatteryOptimizationPackage (works through the TurboModule
 * interop layer; a full codegen TurboModule is overkill for a 2-method app-internal utility).
 */
public class BatteryOptimizationModule extends ReactContextBaseJavaModule {
  public static final String NAME = "BatteryOptimization";

  BatteryOptimizationModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @NonNull
  @Override
  public String getName() {
    return NAME;
  }

  /** Resolves true if the app is already exempt from battery optimization. */
  @ReactMethod
  public void isIgnoringBatteryOptimizations(Promise promise) {
    try {
      Context context = getReactApplicationContext();
      PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
      if (pm == null) {
        // Without PowerManager we can't tell — report "exempt" so callers don't prompt blindly.
        promise.resolve(true);
        return;
      }
      promise.resolve(pm.isIgnoringBatteryOptimizations(context.getPackageName()));
    } catch (Exception e) {
      promise.reject("battery_opt_check_failed", e);
    }
  }

  /**
   * Shows the system "ignore battery optimizations?" dialog (ACTION_REQUEST_IGNORE_BATTERY_-
   * OPTIMIZATIONS, gated by the REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission declared in the
   * manifest). Resolves true if the dialog was launched, false if the app is already exempt.
   * The dialog's outcome is the user's choice and is not returned here — callers decide whether to
   * ask again (we ask once).
   */
  @ReactMethod
  public void requestExemption(Promise promise) {
    try {
      Context context = getReactApplicationContext();
      PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
      if (pm != null && pm.isIgnoringBatteryOptimizations(context.getPackageName())) {
        promise.resolve(false);
        return;
      }
      Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
      intent.setData(Uri.parse("package:" + context.getPackageName()));
      // Started from the application context (no guaranteed foreground Activity), so a new task is
      // required for the system dialog to appear.
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      context.startActivity(intent);
      promise.resolve(true);
    } catch (Exception e) {
      promise.reject("battery_opt_request_failed", e);
    }
  }
}
