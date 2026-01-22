#!/bin/bash

# Firebase App Distribution Script
# Usage: ./scripts/distribute.sh [ios|android] [release-notes]

set -e

PLATFORM=$1
RELEASE_NOTES=${2:-"Beta build"}

# TODO: Replace these with your actual Firebase App IDs
# Find them in Firebase Console → Project Settings → Your Apps
FIREBASE_IOS_APP_ID="YOUR_IOS_APP_ID_HERE"
FIREBASE_ANDROID_APP_ID="YOUR_ANDROID_APP_ID_HERE"
TESTER_GROUP="testers"  # Change to your tester group name

if [ -z "$PLATFORM" ]; then
  echo "Usage: ./scripts/distribute.sh [ios|android] [release-notes]"
  echo ""
  echo "Example:"
  echo "  ./scripts/distribute.sh android \"Beta v1.0 - Fixed location tracking\""
  echo "  ./scripts/distribute.sh ios \"Beta v1.0 - Fixed location tracking\""
  exit 1
fi

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
  echo "❌ Firebase CLI not found. Install it with:"
  echo "   yarn global add firebase-tools"
  echo "   firebase login"
  exit 1
fi

# Check if logged in to Firebase
# firebase login:list exits 0 even when no accounts are logged in; we must check output.
LOGIN_LIST=$(firebase login:list 2>&1) || true
# Check for explicit "no accounts" message (case-insensitive)
if echo "$LOGIN_LIST" | grep -qiE "(no accounts|not logged in)"; then
  echo "❌ Not logged in to Firebase. Run:"
  echo "   firebase login"
  exit 1
fi
# Also check if output contains an email address (more reliable than just '@')
if ! echo "$LOGIN_LIST" | grep -qE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'; then
  echo "❌ Not logged in to Firebase. Run:"
  echo "   firebase login"
  exit 1
fi

if [ "$PLATFORM" == "ios" ]; then
  echo "🍎 Building iOS..."
  
  # Check if App IDs are set
  if [ "$FIREBASE_IOS_APP_ID" == "YOUR_IOS_APP_ID_HERE" ]; then
    echo "❌ Please set FIREBASE_IOS_APP_ID in this script"
    echo "   Find it in Firebase Console → Project Settings → Your iOS App"
    exit 1
  fi
  
  cd ios
  
  # Clean previous builds
  rm -rf build
  
  # Archive
  echo "📦 Creating archive..."
  xcodebuild -workspace WalkingRPGTemp.xcworkspace \
    -scheme WalkingRPGTemp \
    -configuration Release \
    -archivePath build/WalkingRPGTemp.xcarchive \
    archive
  
  # Export IPA
  echo "📤 Exporting IPA..."
  xcodebuild -exportArchive \
    -archivePath build/WalkingRPGTemp.xcarchive \
    -exportPath build \
    -exportOptionsPlist ExportOptions.plist
  
  IPA_PATH="build/WalkingRPGTemp.ipa"
  
  if [ ! -f "$IPA_PATH" ]; then
    echo "❌ Failed to create IPA file"
    exit 1
  fi
  
  echo "✅ IPA created at: $IPA_PATH"
  echo "🚀 Uploading to Firebase App Distribution..."
  
  firebase appdistribution:distribute "$IPA_PATH" \
    --app "$FIREBASE_IOS_APP_ID" \
    --groups "$TESTER_GROUP" \
    --release-notes "$RELEASE_NOTES"
  
  echo "✅ iOS build uploaded successfully!"
  
elif [ "$PLATFORM" == "android" ]; then
  echo "🤖 Building Android..."
  
  # Check if App IDs are set
  if [ "$FIREBASE_ANDROID_APP_ID" == "YOUR_ANDROID_APP_ID_HERE" ]; then
    echo "❌ Please set FIREBASE_ANDROID_APP_ID in this script"
    echo "   Find it in Firebase Console → Project Settings → Your Android App"
    exit 1
  fi
  
  cd android
  
  # Build release APK
  echo "📦 Building release APK..."
  ./gradlew assembleRelease
  
  APK_PATH="app/build/outputs/apk/release/app-release.apk"
  
  if [ ! -f "$APK_PATH" ]; then
    echo "❌ Failed to create APK file"
    exit 1
  fi
  
  echo "✅ APK created at: $APK_PATH"
  echo "🚀 Uploading to Firebase App Distribution..."
  
  firebase appdistribution:distribute "$APK_PATH" \
    --app "$FIREBASE_ANDROID_APP_ID" \
    --groups "$TESTER_GROUP" \
    --release-notes "$RELEASE_NOTES"
  
  echo "✅ Android build uploaded successfully!"
  
else
  echo "❌ Invalid platform: $PLATFORM"
  echo "Usage: ./scripts/distribute.sh [ios|android] [release-notes]"
  exit 1
fi
