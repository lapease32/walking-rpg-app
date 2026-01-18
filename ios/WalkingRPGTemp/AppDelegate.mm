#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <Firebase.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Manually initialize Firebase from GoogleService-Info.plist
  if (![FIRApp defaultApp]) {
    NSString *filePath = [[NSBundle mainBundle] pathForResource:@"GoogleService-Info" ofType:@"plist"];
    if (filePath) {
      FIROptions *options = [[FIROptions alloc] initWithContentsOfFile:filePath];
      if (options) {
        [FIRApp configureWithOptions:options];
      } else {
        NSLog(@"⚠️ Error: Failed to initialize FIROptions from GoogleService-Info.plist. The file may be malformed or missing required Firebase keys (e.g., GOOGLE_APP_ID).");
      }
    } else {
      NSLog(@"⚠️ Warning: GoogleService-Info.plist not found in bundle");
    }
  }

  self.moduleName = @"WalkingRPGTemp";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
