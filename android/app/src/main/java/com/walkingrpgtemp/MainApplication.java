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

  // Configure Firebase emulators and pre-warm the Firestore gRPC client before
  // the JS bundle loads. Without pre-warming, the Firestore gRPC client initializes
  // lazily when JS first calls getDoc() — several seconds into startup, after auth
  // completes. At that point the Firebase Background Thread may hold the
  // initialization lock indefinitely, freezing the JS thread via JSI. Calling
  // get() here forces gRPC initialization in a background thread; it completes
  // during bundle load (~2-3 s) so no lock is held when JS reaches Firestore.
  // The read fails with PERMISSION_DENIED (no auth yet) but that is harmless —
  // we only need the initialization side effect, not the document contents.
  private void configureFirebaseEmulators() {
    try {
      String host = Settings.Global.getString(getContentResolver(), "firebase_emulator_host");
      if (host != null && !host.isEmpty()) {
        FirebaseAuth.getInstance().useEmulator(host, 9099);
        FirebaseFirestore db = FirebaseFirestore.getInstance();
        db.useEmulator(host, 8080);
        Log.i("MainApplication", "Firebase emulators configured: " + host);
        db.collection("_prewarm").document("_prewarm").get()
            .addOnCompleteListener(task -> Log.i("MainApplication",
                "Firestore prewarm: " + (task.isSuccessful() ? "ok" :
                    task.getException() != null ? task.getException().getMessage() : "done")));
      }
    } catch (Exception e) {
      Log.w("MainApplication", "Firebase emulator configuration failed: " + e.getMessage());
    }
  }
}
