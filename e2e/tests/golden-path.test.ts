import { device, element, by, waitFor } from 'detox';

describe('Golden path: encounter → fight → victory', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('loads the main screen', async () => {
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('completes encounter → combat → victory flow', async () => {
    // Wait for main screen and debug controls to be ready
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(15000);
    await waitFor(element(by.id('debug-force-encounter')))
      .toBeVisible()
      .withTimeout(15000);

    // Trigger an encounter via the debug shortcut
    await element(by.id('debug-force-encounter')).tap();

    // Encounter modal should appear
    await waitFor(element(by.id('encounter-modal')))
      .toBeVisible()
      .withTimeout(5000);

    // Choose to fight (opens CombatModal)
    await element(by.id('encounter-fight-button')).tap();

    // Combat modal should appear
    await waitFor(element(by.id('combat-modal')))
      .toBeVisible()
      .withTimeout(5000);

    // Tap Basic Attack until the combat modal closes (creature defeated).
    // When the creature dies, HomeScreen calls setShowCombatModal(false) immediately
    // and shows a native Alert — the modal itself never renders an outcome view.
    // A level-1 player (20 ATK, 5 DEF) vs a level-1 creature typically takes
    // 5–10 BASIC hits. 20 attempts with 1.2 s gaps (just above the 1 s cooldown)
    // guarantees completion with headroom to spare.
    for (let i = 0; i < 20; i++) {
      try {
        await element(by.id('attack-button-BASIC')).tap();
      } catch {
        // Element gone → modal already closed → creature defeated
        break;
      }
      await new Promise(r => setTimeout(r, 1200));
    }

    // Combat modal disappears when creature is defeated; victory Alert follows
    await waitFor(element(by.id('combat-modal')))
      .not.toBeVisible()
      .withTimeout(10000);

    // Verify this is a victory alert ("Victory!" or "Victory & Level Up!"),
    // not a defeat alert — both outcomes close the modal and show a native Alert
    await expect(element(by.text('Defeated!'))).not.toExist();
    await device.dismissAlert();

    // Confirm we landed back on the home screen
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
