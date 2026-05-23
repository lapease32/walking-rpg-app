import { device, element, by, waitFor } from 'detox';

describe('Golden path: encounter → fight → victory', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { location: 'always', notifications: 'YES' },
    });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('loads the main screen', async () => {
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(30000);
  });

  it('completes encounter → combat → victory flow', async () => {
    // Wait for main screen and debug controls to be ready
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(30000);
    await waitFor(element(by.id('debug-force-encounter')))
      .toBeVisible()
      .withTimeout(15000);

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

    // Verify this is a victory alert, not a defeat alert, then dismiss
    await expect(element(by.text('Defeated!'))).not.toExist();
    await device.dismissAlert();

    // Confirm we landed back on the home screen
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
