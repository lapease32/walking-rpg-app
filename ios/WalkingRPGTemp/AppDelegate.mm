#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>
#import <Firebase.h>
#import <FirebaseCrashlytics/FirebaseCrashlytics.h>

// ─── UIScene lifecycle (iOS 26 SDK requirement) ──────────────────────────────────────────────
// The iOS 26 SDK makes UIScene adoption mandatory — an app without it fails to launch with
// "UIScene life cycle is required for apps built with this SDK". React Native 0.85.3's
// RCTAppDelegate predates the framework's own fix (facebook/react-native#54763, which ships an
// RCTSceneDelegate in a later RN), so we port that fix here until RN is bumped past it:
//   • AppSceneDelegate builds the window + React root view from RCTAppDelegate's rootViewFactory
//     when the scene connects, and
//   • the app delegate opts OUT of RCTAppDelegate's own window creation
//     (automaticallyLoadReactNativeWindow = NO) and routes the scene session to AppSceneDelegate.
// Net: exactly one window and one React surface (no orphaned second window / double-mount).
API_AVAILABLE(ios(13.0))
@interface AppSceneDelegate : UIResponder <UIWindowSceneDelegate>
@property (nonatomic, strong) UIWindow *window;
@end

@implementation AppSceneDelegate

- (void)scene:(UIScene *)scene
    willConnectToSession:(UISceneSession *)session
                 options:(UISceneConnectionOptions *)connectionOptions
{
  if (![scene isKindOfClass:[UIWindowScene class]]) {
    return;
  }
  UIWindowScene *windowScene = (UIWindowScene *)scene;
  self.window = [[UIWindow alloc] initWithWindowScene:windowScene];

  RCTAppDelegate *appDelegate = (RCTAppDelegate *)[UIApplication sharedApplication].delegate;
  UIView *rootView = [appDelegate.rootViewFactory viewWithModuleName:appDelegate.moduleName
                                                   initialProperties:appDelegate.initialProps
                                                       launchOptions:nil];
  UIViewController *rootViewController = [UIViewController new];
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];
}

@end
// ─────────────────────────────────────────────────────────────────────────────────────────────

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  if (![FIRApp defaultApp]) {
    [FIRApp configure];
  }

  self.dependencyProvider = [RCTAppDependencyProvider new];
  self.moduleName = @"WalkingRPGTemp";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  // Under the UIScene lifecycle, AppSceneDelegate owns the window — so opt out of RCTAppDelegate
  // creating its own (otherwise a second, orphaned window + React surface would be built). The
  // reactNativeFactory / rootViewFactory is still initialized by super for the scene to use.
  self.automaticallyLoadReactNativeWindow = NO;

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (UISceneConfiguration *)application:(UIApplication *)application
    configurationForConnectingSceneSession:(UISceneSession *)connectingSceneSession
                                   options:(UISceneConnectionOptions *)options
    API_AVAILABLE(ios(13.0))
{
  UISceneConfiguration *configuration =
      [[UISceneConfiguration alloc] initWithName:@"Default Configuration"
                                     sessionRole:connectingSceneSession.role];
  configuration.delegateClass = [AppSceneDelegate class];
  return configuration;
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

@end
