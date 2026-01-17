#!/bin/bash

# Add iOS and Android native folders to existing React Native project
# This approach is simpler - we just need the native folders

set -e

PROJECT_DIR="/Users/lancepease/Java Projects/Walking App"
cd "$PROJECT_DIR"

echo "Checking Node version..."
NODE_VERSION=$(node --version)
if [[ ! "$NODE_VERSION" =~ ^v18\. ]]; then
    echo "ERROR: Need Node 18. Current: $NODE_VERSION"
    echo "Run: export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\" && nvm use 18"
    exit 1
fi

# Check if ios/android already exist
if [ -d "ios" ] || [ -d "android" ]; then
    echo "⚠️  ios/ or android/ folders already exist!"
    read -p "Continue anyway? This may overwrite existing folders. (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

TEMP_DIR="$HOME/Desktop/rn-template-temp-$$"
echo ""
echo "Step 1: Creating temporary React Native project to extract native folders..."

# Create temp directory
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Try to use the React Native template directly from GitHub
echo "Downloading React Native 0.72.6 template..."

# Method 1: Try using create-react-native-app or similar
# Actually, let's try a different approach - use the React Native CLI but with better error handling

cat > package.json << 'EOF'
{
  "name": "rn-template-temp",
  "version": "0.0.1",
  "private": true,
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.72.6"
  }
}
EOF

echo "Installing React Native 0.72.6..."
yarn add react-native@0.72.6 react@18.2.0 --exact 2>&1 | tail -20

# Now try to use React Native's template
echo ""
echo "Extracting native project structure..."

# Try using the React Native CLI init in the temp dir
npx --yes @react-native-community/cli@11.3.9 init TempProject \
  --directory . \
  --skip-install \
  --version 0.72.6 2>&1 | grep -v "warning" | tail -30 || {
    
    echo ""
    echo "CLI init failed. Trying alternative method..."
    echo "Attempting to use React Native's built-in template..."
    
    # Alternative: Copy from node_modules if available
    if [ -d "node_modules/react-native/template" ]; then
        echo "Found React Native template in node_modules..."
        cp -r node_modules/react-native/template/ios . 2>/dev/null || true
        cp -r node_modules/react-native/template/android . 2>/dev/null || true
    fi
}

# Check if we got the folders
if [ ! -d "ios" ] || [ ! -d "android" ]; then
    echo ""
    echo "❌ Could not create native folders automatically."
    echo ""
    echo "Alternative: Manual approach"
    echo "1. Visit: https://github.com/facebook/react-native/tree/v0.72.6/packages/react-native/template"
    echo "2. Download the ios/ and android/ folders"
    echo "3. Copy them to your project directory"
    echo ""
    echo "Or try:"
    echo "  npx react-native@0.72.6 init TempProject --version 0.72.6"
    echo "  Then copy ios/ and android/ from TempProject"
    exit 1
fi

echo ""
echo "Step 2: Copying native folders to your project..."
cp -r ios "$PROJECT_DIR/"
cp -r android "$PROJECT_DIR/"

# Update project names in iOS (from TempProject to WalkingRPG)
echo ""
echo "Step 3: Updating iOS project name..."
cd "$PROJECT_DIR/ios"

if [ -f "TempProject.xcodeproj/project.pbxproj" ]; then
    mv TempProject.xcodeproj WalkingRPG.xcodeproj
    find . -type f -name "*.pbxproj" -exec sed -i '' 's/TempProject/WalkingRPG/g' {} \;
    find . -type f -name "*.plist" -exec sed -i '' 's/TempProject/WalkingRPG/g' {} \;
    find . -type f -name "Podfile" -exec sed -i '' 's/TempProject/WalkingRPG/g' {} \;
fi

echo ""
echo "Step 4: Installing iOS dependencies..."
pod install

cd "$PROJECT_DIR"

echo ""
echo "✅ Native folders added successfully!"
echo ""
echo "Cleaning up temp directory..."
rm -rf "$TEMP_DIR"

echo ""
echo "Next steps:"
echo "1. Review ios/WalkingRPG/Info.plist and add location permissions"
echo "2. Review android/app/src/main/AndroidManifest.xml and add location permissions"
echo "3. Try running: yarn ios"

