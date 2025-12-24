#!/bin/bash

# Setup React Native directly in the existing project directory
# This preserves your existing code

set -e

PROJECT_DIR="/Users/lancepease/Java Projects/Walking App"
BACKUP_DIR="$HOME/Desktop/walking-app-backup-$(date +%Y%m%d-%H%M%S)"

echo "Checking Node version..."
NODE_VERSION=$(node --version)
if [[ ! "$NODE_VERSION" =~ ^v18\. ]]; then
    echo "ERROR: Need Node 18. Current: $NODE_VERSION"
    echo "Run: export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\" && nvm use 18"
    exit 1
fi

cd "$PROJECT_DIR"

echo ""
echo "Step 1: Backing up your existing code..."
mkdir -p "$BACKUP_DIR"
cp -r src "$BACKUP_DIR/" 2>/dev/null || true
cp App.js "$BACKUP_DIR/" 2>/dev/null || true
cp index.js "$BACKUP_DIR/" 2>/dev/null || true
cp package.json "$BACKUP_DIR/" 2>/dev/null || true
cp babel.config.js "$BACKUP_DIR/" 2>/dev/null || true
cp metro.config.js "$BACKUP_DIR/" 2>/dev/null || true
cp app.json "$BACKUP_DIR/" 2>/dev/null || true
echo "✅ Backup created at: $BACKUP_DIR"

echo ""
echo "Step 2: Removing existing node_modules and lock files..."
rm -rf node_modules package-lock.json yarn.lock

echo ""
echo "Step 3: Creating a temporary package.json for React Native init..."
# Save your current package.json dependencies
if [ -f package.json ]; then
    YOUR_DEPS=$(node -e "const pkg = require('./package.json'); console.log(JSON.stringify({dependencies: pkg.dependencies || {}, devDependencies: pkg.devDependencies || {}}))" 2>/dev/null || echo '{"dependencies":{},"devDependencies":{}}')
else
    YOUR_DEPS='{"dependencies":{},"devDependencies":{}}'
fi

echo ""
echo "Step 4: Initializing React Native in current directory..."
echo "This may take a few minutes..."

# Temporarily rename existing files that might conflict
mv package.json package.json.backup 2>/dev/null || true
mv App.js App.js.backup 2>/dev/null || true
mv index.js index.js.backup 2>/dev/null || true

# Initialize React Native - it will create ios/android folders
npx --yes @react-native-community/cli@11.3.9 init WalkingRPG \
  --directory . \
  --skip-install \
  --version 0.72.6 2>&1 | head -100 || {
    echo ""
    echo "React Native init encountered an issue, but continuing..."
}

# If init created new files, we need to merge
if [ -f package.json ]; then
    echo "React Native created new package.json, merging with your dependencies..."
    
    # Extract your custom dependencies
    YOUR_RN_DEPS='{"@react-native-community/geolocation":"^3.3.2","react-native-permissions":"^3.10.1","@react-native-async-storage/async-storage":"^1.19.3"}'
    
    # Merge dependencies using node
    node << 'EOF'
const fs = require('fs');
const newPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const customDeps = {
  "@react-native-community/geolocation": "^3.3.2",
  "react-native-permissions": "^3.10.1",
  "@react-native-async-storage/async-storage": "^1.19.3"
};

// Merge custom dependencies
newPkg.dependencies = { ...newPkg.dependencies, ...customDeps };

// Ensure React Native and React versions are correct
newPkg.dependencies.react = "18.2.0";
newPkg.dependencies["react-native"] = "0.72.6";

fs.writeFileSync('package.json', JSON.stringify(newPkg, null, 2) + '\n');
EOF
fi

# Restore your App.js (but keep React Native's if yours doesn't exist)
if [ ! -f App.js ] && [ -f App.js.backup ]; then
    mv App.js.backup App.js
elif [ -f App.js.backup ]; then
    echo "Keeping React Native's App.js. Your backup is at App.js.backup"
fi

# Restore your index.js if you had one
if [ -f index.js.backup ]; then
    # Check if React Native created an index.js
    if [ -f index.js ]; then
        # Compare - if they're similar, keep React Native's
        echo "React Native created index.js. Your backup is at index.js.backup"
    else
        mv index.js.backup index.js
    fi
fi

# Restore your src folder
if [ -d "$BACKUP_DIR/src" ] && [ ! -d src ]; then
    echo "Restoring your src folder..."
    cp -r "$BACKUP_DIR/src" .
fi

# Restore your config files if they were backed up
if [ -f "$BACKUP_DIR/babel.config.js" ] && [ -f babel.config.js ]; then
    echo "React Native created babel.config.js. Your backup is at $BACKUP_DIR/babel.config.js"
fi

echo ""
echo "Step 5: Installing dependencies..."
npm install

echo ""
echo "Step 6: Installing iOS dependencies..."
if [ -d ios ]; then
    cd ios
    pod install
    cd ..
    echo "✅ iOS dependencies installed"
else
    echo "⚠️  ios folder not found. React Native init may have failed."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Your code is backed up at: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "1. Review App.js - you may need to merge your version with React Native's"
echo "2. Update App.js to import from './src/screens/HomeScreen' if needed"
echo "3. Try running: npm run ios"

