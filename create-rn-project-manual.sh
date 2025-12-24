#!/bin/bash

# Manual React Native 0.72.6 setup - bypasses CLI version issues

set -e

echo "Checking Node version..."
NODE_VERSION=$(node --version)
if [[ ! "$NODE_VERSION" =~ ^v18\. ]]; then
    echo "ERROR: Need Node 18. Current: $NODE_VERSION. Run: nvm use 18"
    exit 1
fi

TEMP_DIR="$HOME/Desktop/WalkingRPGTemp"
echo ""
echo "Removing old temp project..."
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

echo "Creating package.json..."
cat > package.json << 'EOF'
{
  "name": "WalkingRPGTemp",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "android": "react-native run-android",
    "ios": "react-native run-ios",
    "lint": "eslint .",
    "start": "react-native start",
    "test": "jest"
  },
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.72.6"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@babel/preset-env": "^7.20.0",
    "@babel/runtime": "^7.20.0",
    "@react-native/babel-preset": "^0.72.11",
    "@react-native/eslint-config": "^0.72.2",
    "@react-native/metro-config": "^0.72.11",
    "@react-native/typescript-config": "^0.72.1",
    "@types/react": "^18.0.24",
    "@types/react-test-renderer": "^18.0.0",
    "babel-jest": "^29.2.1",
    "eslint": "^8.19.0",
    "jest": "^29.2.1",
    "prettier": "^2.4.1",
    "react-test-renderer": "18.2.0",
    "typescript": "^4.8.4"
  },
  "engines": {
    "node": ">=16"
  }
}
EOF

echo "Installing dependencies..."
npm install

echo "Installing React Native CLI for project setup..."
npm install --save-dev @react-native-community/cli@11.3.9 @react-native-community/cli-platform-ios@11.3.9

echo "Running React Native setup..."
npx react-native init WalkingRPGTemp --directory . --skip-install --version 0.72.6 2>&1 | head -50 || {
    echo ""
    echo "CLI init had issues. Let's try using the template directly..."
    
    # Alternative: Download template from GitHub
    echo "Downloading React Native template..."
    curl -L https://github.com/facebook/react-native/archive/v0.72.6.tar.gz -o rn-template.tar.gz 2>/dev/null || {
        echo "Could not download template. Trying different approach..."
        
        # Use npx with explicit template
        echo "Trying with explicit template specification..."
        npx --yes react-native@0.72.6 init WalkingRPGTemp --template react-native@0.72.6 --directory . --skip-install
    }
}

echo ""
echo "If setup completed, installing iOS pods..."
if [ -d "ios" ]; then
    cd ios
    pod install
    cd ..
    echo "✅ Project setup complete at: $TEMP_DIR"
else
    echo "⚠️  iOS folder not created. Project setup may have failed."
    echo "You may need to manually initialize React Native structure."
fi

