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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

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

  // Configure Firebase Auth and Firestore emulators, then pre-warm both before
  // the JS bundle loads. Two sources of deadlock exist under New Architecture:
  //
  // 1. Firestore gRPC: loadReactNative() starts before the Firebase Background
  //    Thread finishes gRPC + LevelDB init. JS then calls getDoc() via JSI and
  //    hits the init lock — the JS thread blocks forever.
  //
  // 2. Firebase Auth: signInAnonymously() from JS can race against Auth SDK
  //    initialization or a slow emulator HTTP startup. The Auth SDK makes no
  //    persistent connection (unlike Firestore's gRPC), but if the emulator's
  //    HTTP server hasn't finished starting when signInAnonymously() fires, the
  //    request hangs indefinitely with no timeout in the JS path.
  //
  // Blocking here on a CountDownLatch(2) pre-warms both services concurrently
  // and ensures both are fully initialized before any JS code runs. If the
  // Auth prewarm succeeds, JS sees currentUser != null and skips signInAnonymously
  // entirely — eliminating the race. If it times out, Auth SDK init is still
  // complete so the subsequent JS call is safe.
  private void configureFirebaseEmulators() {
    try {
      String host = Settings.Global.getString(getContentResolver(), "firebase_emulator_host");
      if (host != null && !host.isEmpty()) {
        FirebaseAuth auth = FirebaseAuth.getInstance();
        FirebaseFirestore db = FirebaseFirestore.getInstance();
        auth.useEmulator(host, 9099);
        db.useEmulator(host, 8080);
        Log.i("MainApplication", "Firebase emulators configured: " + host);

        CountDownLatch latch = new CountDownLatch(2);

        // Auth prewarm: sign in anonymously so JS sees currentUser != null and
        // skips its own signInAnonymously() call, eliminating the timing race.
        // Pass an explicit background-thread executor so the callback is never
        // dispatched to the main thread (which is blocked by latch.await()).
        auth.signInAnonymously()
            .addOnCompleteListener(cmd -> new Thread(cmd).start(), task -> {
              try {
                Log.i("MainApplication", "Auth prewarm: " +
                    (task.isSuccessful() ? "ok" :
                        task.getException() != null ? task.getException().getMessage() : "done"));
              } finally {
                latch.countDown();
              }
            });

        // Firestore prewarm: force gRPC + LevelDB init to complete before JS runs.
        // The read fails with PERMISSION_DENIED (no auth yet on the Firestore rules
        // side — the Auth prewarm runs concurrently) but that is harmless.
        db.collection("_prewarm").document("_prewarm").get()
            .addOnCompleteListener(cmd -> new Thread(cmd).start(), task -> {
              Log.i("MainApplication", "Firestore prewarm: " +
                  (task.isSuccessful() ? "ok" :
                      task.getException() != null ? task.getException().getMessage() : "done"));
              latch.countDown();
            });

        try {
          boolean done = latch.await(10, TimeUnit.SECONDS);
          if (!done) {
            Log.w("MainApplication", "Firebase prewarm timed out after 10s");
          }
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          Log.w("MainApplication", "Firebase prewarm interrupted");
        }
      }
    } catch (Exception e) {
      Log.w("MainApplication", "Firebase emulator configuration failed: " + e.getMessage());
    }
  }
}
