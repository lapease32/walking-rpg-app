# Fix Missing Dependencies Error

## The Problem

Error: `Cannot find module 'metro-cache-key'`

This happens when dependencies weren't fully installed or got corrupted.

## Solution: Clean Reinstall

Run these commands in your terminal:

```bash
cd "/Users/lancepease/Java Projects/Walking App"

# 1. Remove existing dependencies
rm -rf node_modules yarn.lock

# 2. Clear yarn cache (optional but recommended)
yarn cache clean

# 3. Reinstall dependencies
yarn install

# 4. Verify installation worked
yarn list --pattern metro-cache-key
```

If step 4 shows `metro-cache-key`, you're good to go!

## If That Doesn't Work

Try this more thorough approach:

```bash
cd "/Users/lancepease/Java Projects/Walking App"

# Remove everything
rm -rf node_modules yarn.lock

# Clear all caches
yarn cache clean
watchman watch-del-all 2>/dev/null || true

# Reinstall
yarn install

# If you have iOS native folders, reinstall pods too
cd ios && pod install && cd ..
```

## Still Having Issues?

If you're still getting the error after a clean reinstall, the issue might be:

1. **Node version**: Make sure you're using Node.js 16 or higher
   ```bash
   node --version
   ```

2. **Yarn version**: Update yarn if it's very old
   ```bash
   npm install -g yarn@latest
   ```

3. **Missing React Native CLI**: Make sure React Native CLI is available
   ```bash
   npx react-native --version
   ```

4. **If yarn doesn't work, try npm as fallback**:
   ```bash
   npm install -g npm@latest
   rm -rf node_modules yarn.lock
   npm install
   ```

## Quick Test

After reinstalling, test if metro works:

```bash
yarn start
```

If Metro starts without errors, then try:

```bash
yarn ios
```

