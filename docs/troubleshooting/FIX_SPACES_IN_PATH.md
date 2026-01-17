# Fix Spaces in Project Path Issue

## The Problem

Your project path has spaces: `/Users/lancepease/Java Projects/Walking App/`

React Native/Xcode build scripts fail when paths have spaces because they're not properly quoted. The error `/bin/sh: /Users/lancepease/Java: No such file or directory` confirms this.

## Solution: Move Project (Recommended)

Move your project to a path without spaces:

### Step 1: Stop any running processes
```bash
# Close Xcode if open
# Stop Metro bundler if running
```

### Step 2: Move the project
```bash
# Create new location
mkdir -p ~/WalkingRPGApp

# Move everything
mv "/Users/lancepease/Java Projects/Walking App"/* ~/WalkingRPGApp/
mv "/Users/lancepease/Java Projects/Walking App"/.* ~/WalkingRPGApp/ 2>/dev/null || true

# Remove old directory (if empty)
rmdir "/Users/lancepease/Java Projects/Walking App" 2>/dev/null || true
```

### Step 3: Update git remote (if needed)
```bash
cd ~/WalkingRPGApp
# Git will work fine - it tracks content, not absolute paths
```

### Step 4: Rebuild
```bash
cd ~/WalkingRPGApp
cd ios
pod install
cd ..
yarn ios
```

## Alternative: Symlink Workaround (Temporary)

If you can't move the project right now, create a symlink:

```bash
# Create symlink without spaces
ln -s "/Users/lancepease/Java Projects/Walking App" ~/WalkingRPGApp

# Work from the symlink
cd ~/WalkingRPGApp
yarn ios
```

But this may still have issues since the actual path still has spaces.

## Why This Happens

Xcode script phases use shell commands that split on spaces unless properly quoted. React Native's build scripts reference paths through environment variables that Xcode sets, and when those paths have spaces, they break.

**The only reliable fix is to move to a path without spaces.**

