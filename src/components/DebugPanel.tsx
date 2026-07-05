import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Player } from '../models/Player';
import { Rarity } from '../models/Creature';
import { Archetype, ARCHETYPE_CONFIGS } from '../models/Archetype';
import { getRarityColor } from '../constants/rarity';
import { DebugController } from '../hooks/useDebugActions';
import { ENV_CONFIG } from '../constants/environment';

interface Props {
  debugMode: boolean;
  onToggleDebug: (enabled: boolean) => void;
  player: Player;
  /** Debug logic + grouped config from useDebugActions; this component only renders it. */
  debug: DebugController;
}

const RARITY_OPTIONS: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const RARITY_SHORT: Record<Rarity, string> = {
  common: 'C',
  uncommon: 'U',
  rare: 'R',
  epic: 'E',
  legendary: 'L',
};

export default function DebugPanel({ debugMode, onToggleDebug, player, debug }: Props) {
  // Hard gate: in a production build (enableDebugMode=false) the debug panel must
  // not render at all — including the "Show Debug Mode" toggle, which would
  // otherwise let a user re-enable force-encounter / instant-defeat in a shipped
  // build regardless of the initial debugMode state. The build-time flag is the
  // single source of truth; runtime toggling cannot reach debug controls in prod.
  if (!ENV_CONFIG.enableDebugMode) {
    return null;
  }

  const { readouts, settings, actions } = debug;

  if (!debugMode) {
    return (
      <TouchableOpacity style={styles.debugToggle} onPress={() => onToggleDebug(true)}>
        <Text style={styles.debugToggleText}>Show Debug Mode</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.debugContainer}>
      <Text style={styles.debugTitle}>🐛 Debug Mode</Text>
      <View style={styles.debugStatsBlock}>
        <Text style={styles.debugStatRow}>
          ❤️ HP: {player.hp} / {player.maxHp}
          {'  '}⚔️ ATK: {player.attack}
          {'  '}🛡️ DEF: {player.defense}
        </Text>
        <Text style={styles.debugStatRow}>
          ⭐ Lv {player.level}
          {'  '}XP: {player.experience} / {player.getExperienceForNextLevel()}
        </Text>
        {readouts.location && (
          <>
            <Text style={styles.debugStatRow}>
              📍 {readouts.location.latitude.toFixed(5)}, {readouts.location.longitude.toFixed(5)}
            </Text>
            <Text style={styles.debugStatRow}>
              🎯 ±{readouts.location.accuracy.toFixed(0)}m{'  '}🏃{' '}
              {readouts.location.speed.toFixed(1)} m/s{'  '}🧭{' '}
              {(readouts.location.heading ?? 0).toFixed(0)}°
            </Text>
          </>
        )}
        <Text style={styles.debugStatRow}>
          ☁️ Sync:{' '}
          {readouts.syncStatus.lastSuccessfulSyncAt
            ? `${Math.round((Date.now() - readouts.syncStatus.lastSuccessfulSyncAt) / 1000)}s ago`
            : 'never'}
          {'  '}⏳ {readouts.syncStatus.pendingWrites} pending
          {readouts.syncStatus.writesSuspended ? '  ⛔ suspended' : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.debugButton, styles.levelControlButton]}
        onPress={actions.restoreHp}>
        <Text style={styles.debugButtonText}>Restore Full HP</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.debugButton, styles.resetButton]}
        onPress={actions.clearInventory}>
        <Text style={styles.debugButtonText}>Clear Inventory</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.debugButton, styles.levelControlButton]}
        onPress={actions.fillInventory}>
        <Text style={styles.debugButtonText}>Fill Inventory</Text>
      </TouchableOpacity>
      <View style={styles.encounterChanceContainer}>
        <Text style={styles.encounterChanceLabel}>Encounter Chance:</Text>
        <View style={styles.encounterChanceValueContainer}>
          <Text style={styles.encounterChanceValue}>
            {(readouts.encounterChance * 100).toFixed(2)}%
          </Text>
          {readouts.isTimeBlocking && (
            <Text style={styles.timeBlockingText}>(Blocked: {readouts.timeRemaining}s)</Text>
          )}
        </View>
      </View>
      {readouts.lastEncounterChance !== null && (
        <View style={styles.encounterChanceContainer}>
          <Text style={styles.encounterChanceLabel}>Last Encounter @:</Text>
          <Text style={styles.encounterChanceValue}>
            {(readouts.lastEncounterChance * 100).toFixed(2)}%
          </Text>
        </View>
      )}
      <View style={styles.encounterChanceContainer}>
        <Text style={styles.encounterChanceLabel}>Bypass Time Constraint:</Text>
        <TouchableOpacity
          style={[styles.toggleButton, settings.bypassTimeConstraint && styles.toggleButtonActive]}
          onPress={() => settings.setBypassTimeConstraint(!settings.bypassTimeConstraint)}>
          <Text style={styles.toggleButtonText}>
            {settings.bypassTimeConstraint ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.encounterChanceContainer}>
        <Text style={styles.encounterChanceLabel}>Force Item Drop:</Text>
        <TouchableOpacity
          style={[styles.toggleButton, settings.forceItemDrop && styles.toggleButtonActive]}
          onPress={() => settings.setForceItemDrop(!settings.forceItemDrop)}>
          <Text style={styles.toggleButtonText}>{settings.forceItemDrop ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.raritySelectorBlock}>
        <Text style={styles.encounterChanceLabel}>
          Drop Rarity (turn Force Item Drop ON to guarantee):
        </Text>
        <View style={styles.rarityRow}>
          <TouchableOpacity
            style={[
              styles.rarityButton,
              settings.forcedRarity === null && styles.rarityButtonActive,
            ]}
            onPress={() => settings.setForcedRarity(null)}>
            <Text
              style={[
                styles.rarityButtonText,
                settings.forcedRarity === null && styles.rarityButtonTextActive,
              ]}>
              Auto
            </Text>
          </TouchableOpacity>
          {RARITY_OPTIONS.map(r => {
            const selected = settings.forcedRarity === r;
            const color = getRarityColor(r);
            return (
              <TouchableOpacity
                key={r}
                style={[
                  styles.rarityButton,
                  { borderColor: color },
                  selected && { backgroundColor: color },
                ]}
                onPress={() => settings.setForcedRarity(r)}>
                <Text style={[styles.rarityButtonText, selected && styles.rarityButtonTextActive]}>
                  {RARITY_SHORT[r]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          style={[styles.debugButton, styles.previewButton]}
          onPress={() => actions.previewReveal(settings.forcedRarity)}>
          <Text style={styles.debugButtonText}>
            Preview Reveal {settings.forcedRarity ? `(${settings.forcedRarity})` : '(random)'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.xpButtonContainer}>
        <Text style={styles.xpButtonLabel}>Simulate Movement:</Text>
        {[
          { label: '+10m', meters: 10 },
          { label: '+100m', meters: 100 },
          { label: '+1km', meters: 1000 },
        ].map(step => (
          <TouchableOpacity
            key={step.meters}
            style={[styles.debugButton, styles.xpButton]}
            onPress={() => actions.simulateMovement(step.meters)}>
            <Text style={styles.debugButtonText}>{step.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.debugButton, styles.forceEncounterButton]}
        onPress={actions.forceEncounter}
        testID="debug-force-encounter">
        <Text style={styles.debugButtonText}>Force Encounter</Text>
      </TouchableOpacity>
      <View style={styles.xpButtonContainer}>
        {/* Routes through the REAL rarity gate (common → passive/idle, elite → held worthy foe) —
            unlike "Force Encounter" above, which bypasses straight to turn-based. */}
        <Text style={styles.xpButtonLabel}>Encounter Routing (real gate):</Text>
        <TouchableOpacity
          style={[styles.debugButton, styles.forceEncounterButton]}
          onPress={() => actions.forceIdleEncounter('common')}
          testID="debug-force-idle">
          <Text style={styles.debugButtonText}>Idle Win (common)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.debugButton, styles.forceEncounterButton]}
          onPress={() => actions.forceEliteEncounter('rare')}
          testID="debug-force-elite-rare">
          <Text style={styles.debugButtonText}>Worthy Foe (rare)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.debugButton, styles.forceEncounterButton]}
          onPress={() => actions.forceEliteEncounter('epic')}
          testID="debug-force-elite-epic">
          <Text style={styles.debugButtonText}>Worthy Foe (epic)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.debugButton, styles.xpButton]}
          onPress={() => actions.simulateWalk(5)}
          testID="debug-simulate-walk">
          <Text style={styles.debugButtonText}>Simulate Walk ×5</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.debugButton, styles.xpButton]}
          onPress={actions.showWalkSummary}
          testID="debug-show-walk-summary">
          <Text style={styles.debugButtonText}>Show Walk Summary</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.xpButtonContainer}>
        <Text style={styles.xpButtonLabel}>Set Level:</Text>
        {[1, 5, 10, 20, 50].map(lvl => (
          <TouchableOpacity
            key={lvl}
            style={[styles.debugButton, styles.levelControlButton]}
            onPress={() => actions.setLevel(lvl)}>
            <Text style={styles.debugButtonText}>L{lvl}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.xpButtonContainer}>
        {/* Switch class in place to test each archetype's abilities/resource/FX (then Force Encounter). */}
        <Text style={styles.xpButtonLabel}>Class (test abilities):</Text>
        {[Archetype.Martial, Archetype.Agile, Archetype.Mage].map(a => (
          <TouchableOpacity
            key={a}
            style={[styles.debugButton, styles.levelControlButton]}
            onPress={() => actions.setArchetype(a)}
            testID={`debug-set-archetype-${a}`}>
            <Text style={styles.debugButtonText}>{ARCHETYPE_CONFIGS[a].name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.xpButtonContainer}>
        <Text style={styles.xpButtonLabel}>Add XP:</Text>
        <TouchableOpacity
          style={[styles.debugButton, styles.xpButton]}
          onPress={() => actions.addXP(100)}>
          <Text style={styles.debugButtonText}>+100 XP</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.debugButton, styles.xpButton]}
          onPress={() => actions.addXP(500)}>
          <Text style={styles.debugButtonText}>+500 XP</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.debugButton, styles.xpButton]}
          onPress={() => actions.addXP(1000)}>
          <Text style={styles.debugButtonText}>+1000 XP</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.debugToggle} onPress={() => onToggleDebug(false)}>
        <Text style={styles.debugToggleText}>Hide Debug</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  debugContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#856404',
  },
  debugStatsBlock: {
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffc107',
    padding: 8,
    marginBottom: 12,
    gap: 4,
  },
  debugStatRow: {
    fontSize: 13,
    fontWeight: '600',
    color: '#856404',
  },
  encounterChanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  encounterChanceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
  },
  encounterChanceValueContainer: {
    alignItems: 'flex-end',
  },
  encounterChanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
  },
  timeBlockingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F44336',
    marginTop: 2,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#9E9E9E',
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#4CAF50',
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  raritySelectorBlock: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
    gap: 8,
  },
  rarityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  rarityButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#9E9E9E',
    minWidth: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  rarityButtonActive: {
    backgroundColor: '#856404',
    borderColor: '#856404',
  },
  rarityButtonText: {
    color: '#856404',
    fontSize: 13,
    fontWeight: 'bold',
  },
  rarityButtonTextActive: {
    color: '#fff',
  },
  previewButton: {
    backgroundColor: '#7E57C2',
  },
  debugButton: {
    padding: 12,
    backgroundColor: '#ffc107',
    borderRadius: 6,
    marginVertical: 4,
    alignItems: 'center',
  },
  forceEncounterButton: {
    backgroundColor: '#ff9800',
    marginTop: 8,
  },
  levelControlButton: {
    backgroundColor: '#4CAF50',
    marginTop: 8,
  },
  resetButton: {
    backgroundColor: '#F44336',
    marginTop: 8,
  },
  xpButtonContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  xpButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  xpButton: {
    backgroundColor: '#2196F3',
    marginVertical: 2,
  },
  debugButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  debugToggle: {
    padding: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  debugToggleText: {
    color: '#999',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
