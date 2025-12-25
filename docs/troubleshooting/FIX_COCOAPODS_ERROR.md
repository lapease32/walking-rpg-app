# Fix CocoaPods Boost Checksum Error

This error occurs when CocoaPods downloads are corrupted or cached incorrectly.

## Quick Fix

Run these commands in your terminal:

```bash
cd "/Users/lancepease/Java Projects/Walking App/ios"

# 1. Clean CocoaPods cache
pod cache clean --all

# 2. Remove Podfile.lock and Pods folder
rm -rf Podfile.lock Pods

# 3. Update CocoaPods repo (this can take a few minutes)
pod repo update

# 4. Try installing again
pod install
```

## If That Doesn't Work

Try these additional steps:

```bash
cd "/Users/lancepease/Java Projects/Walking App/ios"

# Update CocoaPods itself
sudo gem install cocoapods

# Or if you installed via Homebrew:
brew upgrade cocoapods

# Clean everything
pod cache clean --all
rm -rf ~/Library/Caches/CocoaPods
rm -rf Podfile.lock Pods

# Update repo
pod repo update

# Install
pod install
```

## Alternative: Skip Checksum Verification (Not Recommended)

If you're desperate and trust the source:

```bash
cd "/Users/lancepease/Java Projects/Walking App/ios"
pod install --repo-update --no-integrate
```

But the proper fix is cleaning the cache and updating the repo.

