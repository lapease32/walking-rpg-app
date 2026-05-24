package com.walkingrpgtemp;

import android.provider.Settings;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class FirebaseEmulatorModule extends ReactContextBaseJavaModule {

  private final ReactApplicationContext reactContext;

  FirebaseEmulatorModule(ReactApplicationContext context) {
    super(context);
    this.reactContext = context;
  }

  @Override
  public String getName() {
    return "FirebaseEmulator";
  }

  /**
   * Synchronously reads firebase_emulator_host from Android Settings.Global.
   * Set via ADB in CI: adb shell settings put global firebase_emulator_host 10.0.2.2
   * Returns null on real devices and non-CI emulators (key never set).
   *
   * Synchronous so JS can call this at module-load time, before any React
   * component mounts or auth().onAuthStateChanged() is registered.
   */
  @ReactMethod(isBlockingSynchronousMethod = true)
  public String getEmulatorHost() {
    try {
      return Settings.Global.getString(
        reactContext.getContentResolver(),
        "firebase_emulator_host"
      );
    } catch (Exception e) {
      return null;
    }
  }
}
