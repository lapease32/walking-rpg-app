#!/bin/bash

# Simple script to create React Native 0.72.6 project structure
# This avoids the version conflict issue

set -e

echo "Checking Node version..."
NODE_VERSION=$(node --version)
echo "Current Node version: $NODE_VERSION"

if [[ ! "$NODE_VERSION" =~ ^v18\. ]]; then
    echo "ERROR: This script requires Node 18. Current version: $NODE_VERSION"
    echo "Please run: nvm use 18"
    exit 1
fi

TEMP_DIR="$HOME/Desktop/WalkingRPGTemp"

echo ""
echo "Removing old temp project if it exists..."
rm -rf "$TEMP_DIR"

echo ""
echo "Creating React Native 0.72.6 project..."
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Use the template URL approach - this is more reliable
echo "Initializing project from template..."
npx --yes @react-native-community/cli@11.3.9 init WalkingRPGTemp \
  --directory . \
  --skip-install \
  --template react-native@0.72.6

# If that doesn't work, try this alternative:
# npx react-native@0.72.6 init WalkingRPGTemp --version 0.72.6 --template react-native-template-typescript@^0.72.6

echo ""
echo "Installing dependencies with correct versions..."
npm install react-native@0.72.6 react@18.2.0 --save-exact

echo ""
echo "Installing remaining dependencies..."
npm install

echo ""
echo "Installing iOS dependencies..."
cd ios
pod install
cd ..

echo ""
echo "✅ React Native 0.72.6 project created successfully!"
echo "Project location: $TEMP_DIR"

