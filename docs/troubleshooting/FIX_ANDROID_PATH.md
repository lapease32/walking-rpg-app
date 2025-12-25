# Fix Android SDK Path (ADB not found)

## Issue
The `adb: command not found` error means Android SDK platform-tools are not in your PATH.

## Quick Fix

Add these lines to your `~/.zshrc` file:

```bash
# Android SDK
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

Then reload your shell:
```bash
source ~/.zshrc
```

## Verify

```bash
# Check ADB
adb version

# Check emulator
emulator -list-avds

# Check Android SDK
echo $ANDROID_HOME
```

## Note About the Build Error

The current error `No connected devices!` is **not a TypeScript conversion issue** - it just means:
1. Build succeeded ✅ (TypeScript conversion working!)
2. Need an emulator running OR device connected to install

Once you have an emulator running or device connected, the app will install and run.

