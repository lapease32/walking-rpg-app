import { getAnalytics, logEvent, logLogin } from '@react-native-firebase/analytics';

// All analytics calls are fire-and-forget and non-fatal.
// Errors are swallowed so analytics never affects game logic.

const log = (name: string, params?: Record<string, string | number | boolean>) =>
  logEvent(getAnalytics(), name, params).catch(e => console.warn('Analytics:', name, e));

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

  // Fires only when an item actually drops. Pairs with combat_victory (which logs
  // item_dropped:boolean) to give drop% AND the rarity/slot/level distribution —
  // i.e. "how often does a legendary actually drop" vs. the configured weights.
  itemDropped(rarity: string, slot: string, itemLevel: number, playerLevel: number) {
    log('item_dropped', {
      rarity,
      slot,
      item_level: itemLevel,
      player_level: playerLevel,
    });
  },

  combatDefeated(creatureName: string, playerLevel: number) {
    log('combat_defeat', { creature_name: creatureName, player_level: playerLevel });
  },

  combatFled(creatureName: string, playerLevel: number) {
    log('combat_fled', { creature_name: creatureName, player_level: playerLevel });
  },

  distanceMilestone(milestoneMeter: number, totalDistanceMeter: number) {
    log('distance_milestone', {
      milestone_m: milestoneMeter,
      total_distance_m: Math.round(totalDistanceMeter),
    });
  },

  playerSessionStart(playerLevel: number, totalDistanceMeter: number) {
    log('player_session_start', {
      player_level: playerLevel,
      total_distance_m: Math.round(totalDistanceMeter),
    });
  },

  levelUp(newLevel: number) {
    log('level_up', { new_level: newLevel });
  },

  trackingStarted() {
    log('tracking_started');
  },

  trackingStopped() {
    log('tracking_stopped');
  },

  signIn(method: 'google' | 'apple') {
    logLogin(getAnalytics(), { method }).catch(e => console.warn('Analytics: sign_in', e));
  },

  signOut() {
    log('sign_out');
  },
};

export default AnalyticsService;
