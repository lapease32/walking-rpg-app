#!/bin/bash

# Script to set up native iOS/Android projects for React Native

echo "Setting up native React Native project structure..."

# Check if ios or android already exist
if [ -d "ios" ] || [ -d "android" ]; then
    echo "Warning: ios/ or android/ directories already exist."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create a temporary directory
TEMP_DIR=$(mktemp -d)
echo "Creating temporary project in: $TEMP_DIR"

# Initialize a fresh React Native project
cd "$TEMP_DIR"
npx react-native@0.72.6 init WalkingRPGTemp --version 0.72.6 --skip-install

# Copy native folders
echo "Copying native project folders..."
cp -r WalkingRPGTemp/ios "/Users/lancepease/Java Projects/Walking App/" 2>/dev/null
cp -r WalkingRPGTemp/android "/Users/lancepease/Java Projects/Walking App/" 2>/dev/null

# Copy .watchmanconfig if it exists
cp WalkingRPGTemp/.watchmanconfig "/Users/lancepease/Java Projects/Walking App/" 2>/dev/null || true

# Clean up
echo "Cleaning up temporary files..."
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Native project folders created!"
echo ""
echo "Next steps:"
echo "1. cd ios && pod install && cd .."
echo "2. npm install"
echo "3. npm run ios"
echo ""
echo "Note: You may need to rename the iOS project from 'WalkingRPGTemp' to your preferred name."

