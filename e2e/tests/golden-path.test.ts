import { device, element, by, waitFor } from 'detox';

describe('Golden path: encounter → fight → victory', () => {
  beforeAll(async () => {
    // Pre-grant location + notification permissions so iOS doesn't show native
    // permission dialogs on first launch that would cover the home screen.
    await device.launchApp({
      newInstance: true,
      permissions: { location: 'inuse', notifications: 'YES' },
    });
    // Firebase listeners and location updates keep the main queue perpetually
    // busy, so Detox's idle-based synchronization never resolves. Disable it
    // and rely on explicit waitFor timeouts throughout the test instead.
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.enableSynchronization();
    await device.terminateApp();
  });

  it('loads the main screen', async () => {
    // 60s: Firebase anonymous sign-in + Firestore read on cold CI can take up to ~15s
    // combined; this gives 4× that headroom before declaring the screen broken.
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(60000);
  });

  it('completes encounter → combat → victory flow', async () => {
    // If the first test passed, home-screen is already visible and this resolves
    // immediately. The 60s matches the first test in case the test suite is
    // configured to continue after failures.
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(60000);

    // The debug controls sit below the fold at ~y=2200 in the ScrollView.
    // Scroll down until the button enters the viewport.
    await waitFor(element(by.id('debug-force-encounter')))
      .toBeVisible()
      .whileElement(by.id('home-screen-scroll'))
      .scroll(200, 'down');

    // Trigger an encounter via the debug shortcut
    await element(by.id('debug-force-encounter')).tap();

    // Encounter modal should appear
    await waitFor(element(by.id('encounter-modal')))
      .toBeVisible()
      .withTimeout(5000);

    // Wait for the fight button explicitly before tapping — on slow CI the encounter
    // modal opening triggers many animations (43+ pending at once in observed runs) and
    // the tap can land before layout settles, silently missing the button.
    await waitFor(element(by.id('encounter-fight-button')))
      .toBeVisible()
      .withTimeout(5000);

    // Choose to fight — verifies the CombatModal opens correctly
    await element(by.id('encounter-fight-button')).tap();
    // 15s: slow CI simulator can take several seconds to re-render after a tap
    // during a layout-heavy animation phase.
    await waitFor(element(by.id('combat-modal')))
      .toBeVisible()
      .withTimeout(15000);

    // Verify the BASIC attack button is present and tappable
    await expect(element(by.id('attack-button-BASIC'))).toBeVisible();

    // Close CombatModal — encounter modal stays visible underneath.
    // We use the debug instant-defeat button for the final kill so the test is
    // deterministic regardless of creature (e.g. Mountain Guardian has 20 DEF
    // matching level-1 ATK, so each BASIC hit does only 1 damage against 100 HP —
    // a pure attack loop would need ~100 taps and take over 2 minutes).
    await element(by.id('combat-close-button')).tap();
    await waitFor(element(by.id('combat-modal')))
      .not.toBeVisible()
      .withTimeout(5000);

    // Encounter modal should be visible again
    await waitFor(element(by.id('encounter-modal')))
      .toBeVisible()
      .withTimeout(5000);

    // Instantly defeat the creature via debug shortcut
    await element(by.id('debug-instant-defeat')).tap();

    // In E2E mode the app renders an in-app victory overlay (testID="victory-alert")
    // instead of a native Alert.alert(). UIAlertController lives in a separate
    // UIWindow that waitFor cannot poll reliably when disableSynchronization() is
    // active — the React View is queryable synchronously in the same render.
    // The defeat tap can sit in the event queue up to ~40s while Firebase
    // monopolizes the main thread, so 60s covers the full processing window.
    await waitFor(element(by.id('victory-alert')))
      .toBeVisible()
      .withTimeout(60000);
    await expect(element(by.text('Defeated!'))).not.toExist();
    await element(by.id('victory-dismiss')).tap();

    // Confirm we landed back on the home screen
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
