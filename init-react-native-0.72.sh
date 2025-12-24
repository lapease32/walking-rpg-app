#!/bin/bash

# Script to properly initialize React Native 0.72.6 with Node 18

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
PROJECT_DIR="$HOME/Desktop/WalkingRPGTemp"

echo ""
echo "Removing old temp project if it exists..."
rm -rf "$TEMP_DIR"

echo ""
echo "Creating React Native 0.72.6 project..."

# Create project directory
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Initialize with npm (not yarn) to avoid version conflicts
npm init -y

# Install React Native 0.72.6 explicitly
echo ""
echo "Installing React Native 0.72.6..."
npm install react-native@0.72.6 --save-exact

# Install React 18.2.0 (required by RN 0.72.6)
echo ""
echo "Installing React 18.2.0..."
npm install react@18.2.0 --save-exact

# Run React Native init helper (this will set up the project structure)
echo ""
echo "Setting up React Native project structure..."
npx react-native@0.72.6 init WalkingRPGTemp --version 0.72.6 --skip-install || {
    echo ""
    echo "The CLI init had issues, but let's try a manual setup..."
    
    # If init fails, we can try to manually copy template
    echo "Attempting alternative initialization method..."
    
    # Use the React Native CLI template directly
    npx @react-native-community/cli@11.3.9 init WalkingRPGTemp --version 0.72.6 --skip-install
}

echo ""
echo "✅ React Native project initialization complete!"
echo "Project location: $TEMP_DIR"
echo ""
echo "Next steps:"
echo "1. cd $TEMP_DIR"
echo "2. npm install (if needed)"
echo "3. cd ios && pod install && cd .."

