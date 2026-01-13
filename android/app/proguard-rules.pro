# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ============================================================================
# React Native Core
# ============================================================================
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}
-keepclassmembers @com.facebook.proguard.annotations.KeepGettersAndSetters class * {
    void set*(***);
    *** get*();
}
-keepclassmembers class * {
    @com.facebook.common.internal.DoNotStrip *;
}
-keepclassmembers class * {
    @com.facebook.jni.annotations.DoNotStrip *;
}

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# React Native - Keep native methods
-keepclassmembers class * {
    native <methods>;
}

# React Native - Keep classes that are referenced from native code
-keep @com.facebook.react.bridge.ReactMethod class *
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
}

# React Native - Keep ReactPackage implementations
-keep class * implements com.facebook.react.ReactPackage { *; }

# React Native - Keep ViewManagers
-keep class * extends com.facebook.react.uimanager.ViewManager { *; }
-keep class * extends com.facebook.react.uimanager.SimpleViewManager { *; }

# React Native - Keep native modules
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keep class * extends com.facebook.react.bridge.BaseJavaModule { *; }
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }

# React Native - Keep TurboModules (if using new architecture)
-keep class * extends com.facebook.react.turbomodule.core.interfaces.TurboModule { *; }

# ============================================================================
# AsyncStorage (@react-native-async-storage/async-storage)
# ============================================================================
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keepclassmembers class com.reactnativecommunity.asyncstorage.** { *; }

# ============================================================================
# Geolocation (@react-native-community/geolocation)
# ============================================================================
-keep class com.reactnativecommunity.geolocation.** { *; }
-keepclassmembers class com.reactnativecommunity.geolocation.** { *; }

# ============================================================================
# React Native Permissions (react-native-permissions)
# ============================================================================
-keep class com.zoontek.rnpermissions.** { *; }
-keepclassmembers class com.zoontek.rnpermissions.** { *; }

# ============================================================================
# Hermes (JavaScript Engine)
# ============================================================================
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# ============================================================================
# SoLoader (Native Library Loader)
# ============================================================================
-keep class com.facebook.soloader.** { *; }

# ============================================================================
# Main Application Classes
# ============================================================================
-keep class com.walkingrpgtemp.MainApplication { *; }
-keep class com.walkingrpgtemp.MainActivity { *; }

# ============================================================================
# General Android/Java Rules
# ============================================================================

# Keep Parcelable implementations
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep Serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep R class
-keepclassmembers class **.R$* {
    public static <fields>;
}

# Keep annotations
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# ============================================================================
# Debugging (can be removed in production if needed)
# ============================================================================
# Keep source file names and line numbers for crash reports
-keepattributes SourceFile,LineNumberTable

# ============================================================================
# Warnings Suppression (if needed)
# ============================================================================
# Uncomment if you see warnings about missing classes
# -dontwarn com.facebook.react.**
# -dontwarn com.reactnativecommunity.**
