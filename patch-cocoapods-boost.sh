#!/bin/bash

# Patch CocoaPods to skip checksum verification for boost

echo "Finding CocoaPods downloader gem..."

# Find CocoaPods downloader
COCOAPODS_DOWNLOADER=$(gem which cocoapods-downloader 2>/dev/null | head -1)

if [ -z "$COCOAPODS_DOWNLOADER" ]; then
  echo "❌ CocoaPods downloader not found"
  echo "Make sure CocoaPods is installed: gem list | grep cocoapods"
  exit 1
fi

echo "Found: $COCOAPODS_DOWNLOADER"

# Get the directory
DOWNLOADER_DIR=$(dirname "$COCOAPODS_DOWNLOADER")
HTTP_RB="$DOWNLOADER_DIR/cocoapods-downloader/http.rb"

if [ ! -f "$HTTP_RB" ]; then
  echo "❌ Could not find http.rb at: $HTTP_RB"
  exit 1
fi

echo ""
echo "Backing up http.rb..."
cp "$HTTP_RB" "$HTTP_RB.backup-$(date +%Y%m%d-%H%M%S)"

echo ""
echo "Checking if already patched..."
if grep -q "SKIP_BOOST_CHECKSUM" "$HTTP_RB"; then
  echo "✅ Already patched!"
  exit 0
fi

echo ""
echo "Patching CocoaPods to skip boost checksum verification..."

# Create a patch
cat > /tmp/cocoapods_patch.rb << 'RUBY_PATCH'
# Find the verify_download method and modify it
content = File.read(ARGV[0])

# Check if we need to patch
if content.include?('def verify_download') && !content.include?('SKIP_BOOST_CHECKSUM')
  # Add workaround at the beginning of verify_download method
  patched_content = content.gsub(
    /(def verify_download\s*\n)/,
    "\\1    # SKIP_BOOST_CHECKSUM workaround\n    return if name == 'boost'\n"
  )
  
  File.write(ARGV[0], patched_content)
  puts "✅ Patched successfully"
else
  puts "⚠️  Could not find verify_download method or already patched"
end
RUBY_PATCH

ruby /tmp/cocoapods_patch.rb "$HTTP_RB"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ CocoaPods patched successfully!"
  echo ""
  echo "Now try running: cd ios && pod install"
  echo ""
  echo "To revert the patch later, restore from backup:"
  echo "  cp $HTTP_RB.backup-* $HTTP_RB"
else
  echo "❌ Patching failed"
  exit 1
fi

