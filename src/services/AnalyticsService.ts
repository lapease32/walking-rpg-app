import analytics from '@react-native-firebase/analytics';

// All analytics calls are fire-and-forget and non-fatal.
// Errors are swallowed so analytics never affects game logic.

const log = (name: string, params?: Record<string, string | number | boolean>) =>
  analytics()
    .logEvent(name, params)
    .catch(e => console.warn('Analytics:', name, e));

const AnalyticsService = {
  encounterTriggered(creatureName: string, creatureLevel: number, playerLevel: number) {
    log('encounter_triggered', {
      creature_name: creatureName,
      creature_level: creatureLevel,
      player_level: playerLevel,
    });
  },

  combatStarted(creatureName: string, playerLevel: number) {
    log('combat_started', { creature_name: creatureName, player_level: playerLevel });
  },

  combatVictory(
    creatureName: string,
    playerLevel: number,
    xpGained: number,
    itemDropped: boolean,
    leveledUp: boolean,
  ) {
    log('combat_victory', {
      creature_name: creatureName,
      player_level: playerLevel,
      xp_gained: xpGained,
      item_dropped: itemDropped,
      leveled_up: leveledUp,
    });
  },

  combatFled(creatureName: string, playerLevel: number) {
    log('combat_fled', { creature_name: creatureName, player_level: playerLevel });
  },

  levelUp(newLevel: number) {
    log('level_up', { new_level: newLevel });
  },

  itemEquipped(slot: string, itemName: string) {
    log('item_equipped', { slot, item_name: itemName });
  },

  trackingStarted() {
    log('tracking_started');
  },

  trackingStopped() {
    log('tracking_stopped');
  },

  signIn(method: 'google' | 'apple') {
    analytics()
      .logLogin({ method })
      .catch(e => console.warn('Analytics: sign_in', e));
  },

  signOut() {
    log('sign_out');
  },
};

export default AnalyticsService;
