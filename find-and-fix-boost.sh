#!/bin/bash

# Script to find and fix boost podspec checksum issue

echo "Searching for boost podspec files..."
echo ""

# Search in common CocoaPods repo locations
SEARCH_PATHS=(
  "$HOME/.cocoapods/repos/trunk/Specs"
  "$HOME/.cocoapods/repos/master/Specs"
  "$HOME/.cocoapods/repos"
)

BOOST_PODSPEC=""

for path in "${SEARCH_PATHS[@]}"; do
  if [ -d "$path" ]; then
    echo "Searching in: $path"
    found=$(find "$path" -name "*boost*.podspec*" -type f 2>/dev/null | head -1)
    if [ ! -z "$found" ]; then
      BOOST_PODSPEC="$found"
      echo "✅ Found: $found"
      break
    fi
  fi
done

if [ -z "$BOOST_PODSPEC" ]; then
  echo ""
  echo "❌ Boost podspec not found in standard locations."
  echo ""
  echo "Trying broader search..."
  BOOST_PODSPEC=$(find ~/.cocoapods -name "*boost*.podspec*" -o -name "*boost*.json" 2>/dev/null | grep -i boost | head -1)
  
  if [ -z "$BOOST_PODSPEC" ]; then
    echo ""
    echo "⚠️  Could not find boost podspec file."
    echo ""
    echo "This might mean:"
    echo "1. CocoaPods repos haven't been set up yet"
    echo "2. Boost spec hasn't been downloaded yet"
    echo ""
    echo "Let's check what CocoaPods repos exist:"
    ls -la ~/.cocoapods/repos/ 2>/dev/null || echo "No repos directory found"
    echo ""
    echo "Try running: pod repo update"
    exit 1
  fi
fi

echo ""
echo "Found boost podspec at: $BOOST_PODSPEC"
echo ""

# Check if it's JSON or Ruby format
if [[ "$BOOST_PODSPEC" == *.json ]]; then
  echo "Detected JSON format podspec"
  
  # Backup
  backup="${BOOST_PODSPEC}.backup-$(date +%Y%m%d-%H%M%S)"
  cp "$BOOST_PODSPEC" "$backup"
  echo "✅ Backup created: $backup"
  
  # Remove checksum using Node
  if command -v node &> /dev/null; then
    echo ""
    echo "Removing checksum from podspec..."
    node << EOF
const fs = require('fs');
const path = '$BOOST_PODSPEC';
try {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  const hadChecksum = 'checksum' in data;
  delete data.checksum;
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log(hadChecksum ? '✅ Checksum removed successfully' : '⚠️  No checksum field found');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
EOF
    
    if [ $? -eq 0 ]; then
      echo ""
      echo "✅ Boost podspec fixed!"
      echo ""
      echo "Now try running: cd ios && pod install"
    else
      echo "❌ Failed to fix podspec"
      exit 1
    fi
  else
    echo "❌ Node.js not found. Cannot edit JSON file."
    echo "Please install Node.js or edit the file manually."
    exit 1
  fi
  
elif [[ "$BOOST_PODSPEC" == *.podspec ]]; then
  echo "Detected Ruby format podspec"
  echo "Ruby podspecs are harder to fix automatically."
  echo "File location: $BOOST_PODSPEC"
  echo ""
  echo "You can manually edit it to remove or comment out checksum lines."
  echo "Look for lines like: s.checksum = '...'"
else
  echo "Unknown podspec format"
  echo "File: $BOOST_PODSPEC"
fi

echo ""
echo "Current podspec file location:"
echo "$BOOST_PODSPEC"

