import { device, element, by, waitFor } from 'detox';

describe('Golden path: encounter → fight → victory', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // Disable Detox synchronization: RN New Architecture (Fabric) keeps the
    // GCD main queue perpetually active with pending commit work items, so the
    // sync tracker never sees idle. All waitFor calls below use explicit
    // timeouts and poll for element visibility instead.
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('loads the main screen', async () => {
    // 60s: Firebase anonymous auth on a real network in CI can take 20-30s.
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(60000);
  });

  it('completes encounter → combat → victory flow', async () => {
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(60000);
    await waitFor(element(by.id('debug-force-encounter')))
      .toBeVisible()
      .withTimeout(15000);

    // Trigger an encounter via the debug shortcut
    await element(by.id('debug-force-encounter')).tap();

    // Encounter modal should appear
    await waitFor(element(by.id('encounter-modal')))
      .toBeVisible()
      .withTimeout(10000);

    // Choose to fight — verifies the CombatModal opens correctly
    await element(by.id('encounter-fight-button')).tap();
    await waitFor(element(by.id('combat-modal')))
      .toBeVisible()
      .withTimeout(10000);

    // Verify the BASIC attack button is present and tappable
    await waitFor(element(by.id('attack-button-BASIC')))
      .toBeVisible()
      .withTimeout(5000);

    // Close CombatModal — encounter modal stays visible underneath.
    // We use the debug instant-defeat button for the final kill so the test is
    // deterministic regardless of creature (e.g. Mountain Guardian has 20 DEF
    // matching level-1 ATK, so each BASIC hit does only 1 damage against 100 HP —
    // a pure attack loop would need ~100 taps and take over 2 minutes).
    await element(by.id('combat-close-button')).tap();
    await waitFor(element(by.id('combat-modal')))
      .not.toBeVisible()
      .withTimeout(10000);

    // Encounter modal should be visible again
    await waitFor(element(by.id('encounter-modal')))
      .toBeVisible()
      .withTimeout(10000);

    // Instantly defeat the creature via debug shortcut
    await element(by.id('debug-instant-defeat')).tap();

    // Wait for the victory alert to appear, verify it is NOT a defeat alert, then dismiss.
    // React Native Alert.alert() presents a UIAlertController in the app window;
    // element(by.text()) traverses the full window hierarchy including alert windows.
    await waitFor(element(by.text('OK')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.text('Defeated!'))).not.toExist();
    await element(by.text('OK')).tap();

    // Confirm we landed back on the home screen
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
