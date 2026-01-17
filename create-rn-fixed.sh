#!/bin/bash

# Create React Native 0.72.6 project with version override workaround

set -e

echo "Checking Node version..."
NODE_VERSION=$(node --version)
if [[ ! "$NODE_VERSION" =~ ^v18\. ]]; then
    echo "ERROR: Need Node 18. Current: $NODE_VERSION"
    echo "Run: export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\" && nvm use 18"
    exit 1
fi

TEMP_DIR="$HOME/Desktop/WalkingRPGTemp"
echo ""
echo "Cleaning up..."
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

echo "Creating package.json with npm overrides to force RN 0.72.6..."
cat > package.json << 'EOF'
{
  "name": "WalkingRPGTemp",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "android": "react-native run-android",
    "ios": "react-native run-ios",
    "start": "react-native start",
    "test": "jest"
  },
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.72.6"
  },
  "overrides": {
    "react-native": "0.72.6",
    "metro": "0.76.8",
    "metro-runtime": "0.76.8"
  },
  "engines": {
    "node": ">=16 <=18"
  }
}
EOF

echo "Installing React Native 0.72.6..."
yarn add react-native@0.72.6 react@18.2.0 --exact

echo "Installing React Native CLI..."
yarn add --dev @react-native-community/cli@11.3.9

echo ""
echo "Now initializing React Native structure..."
npx react-native init WalkingRPGTemp --directory . --version 0.72.6 --skip-install 2>&1 || {
    echo ""
    echo "CLI init failed, but we can manually set up the structure..."
    echo "Creating basic structure..."
    
    # Create basic structure
    mkdir -p ios android
    
    echo "You may need to copy ios/android folders from a working React Native 0.72.6 project"
    echo "Or try: npx --yes @react-native-community/cli@11.3.9 init WalkingRPGTemp --version 0.72.6"
}

echo ""
if [ -d "ios" ] && [ -f "ios/Podfile" ]; then
    echo "Installing iOS pods..."
    cd ios
    pod install
    cd ..
    echo "✅ Setup complete!"
else
    echo "⚠️  iOS structure not fully created."
    echo "Try manually running: npx @react-native-community/cli@11.3.9 init . --version 0.72.6"
fi

echo ""
echo "Project location: $TEMP_DIR"

