package com.walkingrpgtemp;

import android.app.Application;
import android.provider.Settings;
import android.util.Log;
import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactHost;
import com.facebook.react.ReactNativeApplicationEntryPoint;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.defaults.DefaultReactHost;
import com.facebook.react.defaults.DefaultReactNativeHost;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import java.util.List;

public class MainApplication extends Application implements ReactApplication {

  private final ReactNativeHost mReactNativeHost =
      new DefaultReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
          return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
          @SuppressWarnings("UnnecessaryLocalVariable")
          List<ReactPackage> packages = new PackageList(this).getPackages();
          packages.add(new FirebaseEmulatorPackage());
          return packages;
        }

        @Override
        protected String getJSMainModuleName() {
          return "index";
        }

        @Override
        protected boolean isNewArchEnabled() {
          return BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
        }

        @Override
        protected boolean isHermesEnabled() {
          return BuildConfig.IS_HERMES_ENABLED;
        }
      };

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

  @Override
  public ReactHost getReactHost() {
    return DefaultReactHost.getDefaultReactHost(this, mReactNativeHost, null);
  }

  @Override
  public void onCreate() {
    super.onCreate();
    configureFirebaseEmulators();
    ReactNativeApplicationEntryPoint.loadReactNative(this);
  }

  // Configure Firebase emulators before the JS bundle loads to avoid synchronous
  // JSI calls from JavaScript racing with native Firestore initialization.
  // Reads the 'firebase_emulator_host' system property set by the E2E CI workflow.
  private void configureFirebaseEmulators() {
    try {
      String host = Settings.Global.getString(getContentResolver(), "firebase_emulator_host");
      if (host != null && !host.isEmpty()) {
        FirebaseAuth.getInstance().useEmulator("http://" + host + ":9099");
        FirebaseFirestore.getInstance().useEmulator(host, 8080);
        Log.i("MainApplication", "Firebase emulators configured: " + host);
      }
    } catch (Exception e) {
      Log.w("MainApplication", "Firebase emulator configuration failed: " + e.getMessage());
    }
  }
}
