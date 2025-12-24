# Fix Missing Dependencies Error

## The Problem

Error: `Cannot find module 'metro-cache-key'`

This happens when dependencies weren't fully installed or got corrupted.

## Solution: Clean Reinstall

Run these commands in your terminal:

```bash
cd "/Users/lancepease/Java Projects/Walking App"

# 1. Remove existing dependencies
rm -rf node_modules package-lock.json

# 2. Clear npm cache (optional but recommended)
npm cache clean --force

# 3. Reinstall dependencies
npm install

# 4. Verify installation worked
npm list metro-cache-key
```

If step 4 shows `metro-cache-key`, you're good to go!

## If That Doesn't Work

Try this more thorough approach:

```bash
cd "/Users/lancepease/Java Projects/Walking App"

# Remove everything
rm -rf node_modules package-lock.json

# Clear all caches
npm cache clean --force
watchman watch-del-all 2>/dev/null || true

# Reinstall
npm install

# If you have iOS native folders, reinstall pods too
cd ios && pod install && cd ..
```

## Still Having Issues?

If you're still getting the error after a clean reinstall, the issue might be:

1. **Node version**: Make sure you're using Node.js 16 or higher
   ```bash
   node --version
   ```

2. **npm version**: Update npm if it's very old
   ```bash
   npm install -g npm@latest
   ```

3. **Missing React Native CLI**: Make sure React Native CLI is available
   ```bash
   npx react-native --version
   ```

4. **Try using yarn instead of npm**:
   ```bash
   npm install -g yarn
   rm -rf node_modules package-lock.json
   yarn install
   ```

## Quick Test

After reinstalling, test if metro works:

```bash
npm start
```

If Metro starts without errors, then try:

```bash
npm run ios
```

