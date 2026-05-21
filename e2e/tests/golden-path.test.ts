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
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(30000);
  });

  it('completes encounter → combat → victory flow', async () => {
    // Wait for main screen and debug controls to be ready.
    // 30s timeout: CI cold-start (Firebase auth init) takes longer than local.
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(30000);
    await waitFor(element(by.id('debug-force-encounter')))
      .toBeVisible()
      .withTimeout(30000);

    // Trigger an encounter via the debug shortcut
    await element(by.id('debug-force-encounter')).tap();

    // Encounter modal should appear
    await waitFor(element(by.id('encounter-modal')))
      .toBeVisible()
      .withTimeout(5000);

    // Choose to fight — verifies the CombatModal opens correctly
    await element(by.id('encounter-fight-button')).tap();
    await waitFor(element(by.id('combat-modal')))
      .toBeVisible()
      .withTimeout(5000);

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

    // With sync disabled we must explicitly wait for the alert to render
    // before asserting on it. Victory title is 'Victory!' or
    // 'Victory & Level Up!' — wait for the dismiss button common to both.
    await waitFor(element(by.label('OK'))).toBeVisible().withTimeout(5000);
    await expect(element(by.text('Defeated!'))).not.toExist();
    await device.dismissAlert();

    // Confirm we landed back on the home screen
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
