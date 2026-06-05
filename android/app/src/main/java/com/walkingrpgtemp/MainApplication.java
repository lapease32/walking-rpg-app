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

  // Configure the Firebase Auth + Firestore emulators, then pre-warm AUTH only
  // before the JS bundle loads.
  //
  // Auth prewarm (kept): signInAnonymously() from JS can race against Auth SDK
  // init or a slow emulator HTTP startup and hang with no timeout in the JS path.
  // Signing in here means JS sees currentUser != null and skips its own
  // signInAnonymously() entirely, eliminating that race. The Auth SDK opens no
  // persistent connection, so this is cheap and contention-free.
  //
  // Firestore prewarm (REMOVED): a prior `_prewarm` read here was meant to warm
  // gRPC + LevelDB before JS runs, but it left the native Firestore "started"
  // with its Firebase Background Thread holding the init lock. The first JS-side
  // Firestore access (the post-paint cloud reconcile) then contended on that lock
  // and stalled the JS thread >30s — dropping the new-user archetype screen's
  // Fabric mount before it flushed (the long-standing E2E-Android cold-start
  // flake; cf. "Long monitor contention with owner Firebase Background Thread" in
  // logcat). Local-first paint (usePlayer) already keeps the cloud read off the
  // critical first-paint path, so warming Firestore here is unnecessary AND
  // harmful. The emulator host is still configured below so the JS-side read
  // targets the emulator.
  private void configureFirebaseEmulators() {
    try {
      String host = Settings.Global.getString(getContentResolver(), "firebase_emulator_host");
      if (host != null && !host.isEmpty()) {
        FirebaseAuth auth = FirebaseAuth.getInstance();
        FirebaseFirestore db = FirebaseFirestore.getInstance();
        auth.useEmulator(host, 9099);
        db.useEmulator(host, 8080);
        Log.i("MainApplication", "Firebase emulators configured: " + host);

        CountDownLatch latch = new CountDownLatch(1);

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
