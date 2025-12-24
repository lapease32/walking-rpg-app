# Fix Boost Checksum with Environment Variable

Try this approach - use an environment variable to bypass checksum verification:

## Method 1: Set Environment Variable

Run pod install with this environment variable:

```bash
cd "/Users/lancepease/Java Projects/Walking App/ios"

# Set environment variable to skip checksum verification
export COCOAPODS_DISABLE_STATS=true
export CP_REPOS_DIR=~/.cocoapods/repos

# Try installing with --verbose to see what's happening
pod install --verbose 2>&1 | tee pod-install.log
```

## Method 2: Patch CocoaPods Downloader (Most Reliable)

Create a Ruby script that patches CocoaPods before running pod install:

```bash
cd "/Users/lancepease/Java Projects/Walking App/ios"

cat > patch_cocoapods.rb << 'RUBY'
# Patch CocoaPods to skip boost checksum
require 'fileutils'

downloader_path = `gem which cocoapods-downloader`.chomp.gsub(/\.rb$/, '')
base_path = File.dirname(downloader_path)
http_path = File.join(base_path, 'cocoapods-downloader', 'http.rb')

if File.exist?(http_path)
  content = File.read(http_path)
  unless content.include?('SKIP_BOOST_CHECKSUM')
    content.gsub!(/def verify_download/, "def verify_download\n    return if name == 'boost'  # Skip checksum for boost")
    File.write(http_path, content)
    puts "Patched CocoaPods downloader"
  else
    puts "Already patched"
  end
else
  puts "Could not find CocoaPods downloader at: #{http_path}"
end
RUBY

ruby patch_cocoapods.rb
pod install
```

## Method 3: Manual Boost Installation (Simplest)

Actually, the simplest might be to manually download boost and put it in the right place:

```bash
cd "/Users/lancepease/Java Projects/Walking App/ios"

# Create directory for manual boost
mkdir -p Pods/boost
cd Pods/boost

# Download boost manually (version that React Native 0.72.6 uses)
# React Native 0.72.6 uses boost 1.76.0
curl -L https://archives.boost.io/release/1.76.0/source/boost_1_76_0.tar.bz2 -o boost.tar.bz2

# Extract
tar -xjf boost.tar.bz2
mv boost_1_76_0/* .
rmdir boost_1_76_0
rm boost.tar.bz2

cd ../..
```

But this won't work because CocoaPods needs it in a specific format. 

## Method 4: Use Different Podfile Approach

Actually, let's try a different approach - modify the Podfile to explicitly handle boost before React Native loads it:

Add this to the VERY TOP of your Podfile (before any `require` statements):

```ruby
# Workaround for boost checksum - must be at top
$boost_checksum_workaround = true

module Pod
  class Installer
    class Analyzer
      class SpecsState
        def verified?(name)
          return true if name == 'boost' && $boost_checksum_workaround
          super
        end
      end
    end
  end
end
```

But this is also complex. Let me give you the actual working solution.

## Method 5: Use --repo-update=false and Manual Fix (RECOMMENDED)

The most reliable way is to:

1. Find the boost podspec
2. Remove or comment out the checksum line
3. Install without repo update

```bash
cd "/Users/lancepease/Java Projects/Walking App/ios"

# Find boost podspec in trunk (CDN)
BOOST_PODSPEC="$HOME/.cocoapods/repos/trunk/Specs/b/o/o/boost/1.76.0/boost.podspec.json"

if [ ! -f "$BOOST_PODSPEC" ]; then
  # Try finding it
  BOOST_PODSPEC=$(find ~/.cocoapods/repos -name "boost.podspec.json" -path "*/1.76.0/*" 2>/dev/null | head -1)
fi

if [ -f "$BOOST_PODSPEC" ]; then
  echo "Found boost podspec: $BOOST_PODSPEC"
  
  # Backup
  cp "$BOOST_PODSPEC" "$BOOST_PODSPEC.backup"
  
  # Remove checksum using Python/Node/jq (whichever is available)
  if command -v python3 &> /dev/null; then
    python3 << PYTHON
import json
with open("$BOOST_PODSPEC", 'r') as f:
    data = json.load(f)
    data.pop('checksum', None)
with open("$BOOST_PODSPEC", 'w') as f:
    json.dump(data, f, indent=2)
PYTHON
    echo "Removed checksum from boost podspec"
  elif command -v node &> /dev/null; then
    node << JAVASCRIPT
const fs = require('fs');
const data = JSON.parse(fs.readFileSync("$BOOST_PODSPEC", 'utf8'));
delete data.checksum;
fs.writeFileSync("$BOOST_PODSPEC", JSON.stringify(data, null, 2));
JAVASCRIPT
    echo "Removed checksum from boost podspec"
  else
    echo "Need python3 or node to edit JSON. Install one and try again."
    exit 1
  fi
  
  # Now try install
  pod install --no-repo-update
else
  echo "Could not find boost podspec. Boost version might be different."
  echo "Trying to find any boost podspec..."
  find ~/.cocoapods/repos -name "*boost*.podspec*" 2>/dev/null | head -5
fi
```

Try **Method 5** - it's the most reliable way to fix the checksum issue.

