# Fix iOS Build Errors

## Issue 1: Simulator "Unable to Boot Device in Current State: Booted"

This means a simulator is already booted but in a bad state. Fix it:

```bash
# List all booted simulators
xcrun simctl list devices | grep Booted

# Shutdown all simulators
xcrun simctl shutdown all

# Then try again
npm run ios
```

## Issue 2: Build Failed - PhaseScriptExecution Error

This is often caused by:
1. **Spaces in project path** (your path has "Java Projects")
2. **Node path not found by Xcode**

### Fix Node Path for Xcode

The `.xcode.env` file has been updated to properly load nvm. If you still get errors, create `.xcode.env.local`:

```bash
cd ios
cat > .xcode.env.local << 'EOF'
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export NODE_BINARY=$(command -v node)
EOF
```

### Clean Build

Try a clean build:

```bash
cd "/Users/lancepease/Java Projects/Walking App/ios"

# Clean Xcode derived data
rm -rf ~/Library/Developer/Xcode/DerivedData

# Clean pods
rm -rf Pods Podfile.lock

# Reinstall
pod install

# Back to root and try again
cd ..
npm run ios
```

### Alternative: Use Absolute Node Path

If nvm still doesn't work, hardcode the node path in `.xcode.env.local`:

```bash
cd ios
echo 'export NODE_BINARY=/Users/lancepease/.nvm/versions/node/v18.20.8/bin/node' > .xcode.env.local
cd ..
npm run ios
```

## Issue 3: Spaces in Path

If errors persist, consider moving the project to a path without spaces:
- From: `/Users/lancepease/Java Projects/Walking App`
- To: `/Users/lancepease/WalkingApp` or `/Users/lancepease/walking-rpg-app`

This is a known React Native limitation.

## Quick Fix Sequence

```bash
# 1. Shutdown simulators
xcrun simctl shutdown all

# 2. Clean build
cd "/Users/lancepease/Java Projects/Walking App/ios"
rm -rf Pods Podfile.lock ~/Library/Developer/Xcode/DerivedData
pod install

# 3. Ensure .xcode.env.local exists with correct node path
cat > .xcode.env.local << 'EOF'
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export NODE_BINARY=$(command -v node)
EOF

# 4. Try building
cd ..
npm run ios
```

