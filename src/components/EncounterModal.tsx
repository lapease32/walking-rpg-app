import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { Encounter } from '../models/Encounter';
import { Rarity, isEliteCreature } from '../models/Creature';
import { DamageType } from '../models/DamageType';
import PressableScale from './PressableScale';

interface EncounterModalProps {
  encounter: Encounter | null;
  visible: boolean;
  playerAttack?: number;
  playerDefense?: number;
  playerHp?: number;
  playerMaxHp?: number;
  onFight: () => void;
  onFlee: () => void;
  /** Auto-Resolve (skip) — instant same-reward win. Only offered for below-rare creatures. */
  onAutoResolve?: () => void;
  onMinimize?: () => void;
  debugMode?: boolean;
  onDebugDefeat?: () => void;
}

/**
 * Modal component for displaying creature encounters
 */
export default function EncounterModal({
  encounter,
  visible,
  playerAttack,
  playerDefense,
  playerHp,
  playerMaxHp,
  onFight,
  onFlee,
  onAutoResolve,
  onMinimize,
  debugMode = false,
  onDebugDefeat,
}: EncounterModalProps) {
  if (!encounter || !encounter.creature) {
    return null;
  }

  const creature = encounter.creature;
  // Below-rare only: elites (rare+) must be fought, so they never offer the skip.
  const canAutoResolve = !!onAutoResolve && !isEliteCreature(creature);
  const rarityColors: Record<Rarity, string> = {
    common: '#9E9E9E',
    uncommon: '#4CAF50',
    rare: '#2196F3',
    epic: '#9C27B0',
    legendary: '#FF9800',
  };

  const rarityColor = rarityColors[creature.rarity] || '#9E9E9E';
  const isDefeated = creature.isDefeated();
  const playerDefeated = playerHp !== undefined && playerHp <= 0;

  // Calculate HP percentage for color coding
  const playerHpPercentage =
    playerHp !== undefined && playerMaxHp !== undefined && playerMaxHp > 0
      ? playerHp / playerMaxHp
      : 1;
  const playerHpBarColor =
    playerHpPercentage > 0.5 ? '#4CAF50' : playerHpPercentage > 0.25 ? '#FF9800' : '#F44336';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onMinimize || onFlee}>
      <View style={styles.modalOverlay}>
        {/* Background tap-to-close sits BEHIND the content (not wrapping it), so tapping outside
            dismisses while the content's ScrollView keeps its touch gestures. An onStartShouldSet-
            Responder wrapper here would claim the touch on start and block scrolling. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onMinimize ?? onFlee} />
        <View style={styles.modalContent} testID="encounter-modal">
          <View style={styles.header}>
            <Text style={styles.title}>Wild Creature Encountered!</Text>
            {onMinimize && (
              <TouchableOpacity onPress={onMinimize} style={styles.minimizeButton}>
                <Text style={styles.minimizeButtonText}>−</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
            {/* Player Stats Card */}
            {(playerHp !== undefined ||
              playerAttack !== undefined ||
              playerDefense !== undefined) && (
              <View style={styles.playerCard}>
                <Text style={styles.playerCardTitle}>Your Stats</Text>

                {playerHp !== undefined && playerMaxHp !== undefined && (
                  <>
                    <View style={styles.playerHpBar}>
                      <View
                        style={[
                          styles.playerHpFill,
                          {
                            width: `${playerHpPercentage * 100}%`,
                            backgroundColor: playerHpBarColor,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.playerHpText}>
                      {playerHp} / {playerMaxHp} HP
                    </Text>
                  </>
                )}

                <View style={styles.playerStatsContainer}>
                  {playerAttack !== undefined && (
                    <View style={styles.playerStatRow}>
                      <Text style={styles.playerStatLabel}>⚔️ Attack:</Text>
                      <Text style={styles.playerStatValue}>{playerAttack}</Text>
                    </View>
                  )}
                  {playerDefense !== undefined && (
                    <View style={styles.playerStatRow}>
                      <Text style={styles.playerStatLabel}>🛡️ Defense:</Text>
                      <Text style={styles.playerStatValue}>{playerDefense}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            <View style={[styles.creatureCard, { borderColor: rarityColor }]}>
              <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
                <Text style={styles.rarityText}>{creature.rarity.toUpperCase()}</Text>
              </View>

              <Text style={styles.creatureName}>{creature.name}</Text>
              <Text style={styles.creatureType}>{creature.type}</Text>
              <Text style={styles.creatureLevel}>Level {creature.level}</Text>

              <Text style={styles.description}>{creature.description}</Text>

              <View style={styles.statsContainer}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>HP:</Text>
                  <Text style={styles.statValue}>
                    {creature.hp} / {creature.maxHp}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Attack:</Text>
                  <Text style={styles.statValue}>{creature.attack}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Defense:</Text>
                  <Text style={styles.statValue}>{creature.defense}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Speed:</Text>
                  <Text style={styles.statValue}>{creature.speed}</Text>
                </View>
              </View>

              <View style={styles.hpBar}>
                <View
                  style={[
                    styles.hpFill,
                    {
                      width: `${creature.maxHp > 0 ? (creature.hp / creature.maxHp) * 100 : 0}%`,
                      backgroundColor: rarityColor,
                    },
                  ]}
                />
              </View>

              {/* Resistances — only show non-zero values */}
              {(Object.entries(creature.resistances) as [DamageType, number][]).some(
                ([, v]) => v !== 0,
              ) && (
                <View style={styles.resistancesContainer}>
                  <Text style={styles.resistancesLabel}>Resistances</Text>
                  <View style={styles.resistanceChips}>
                    {(Object.entries(creature.resistances) as [DamageType, number][])
                      .filter(([, v]) => v !== 0)
                      .map(([type, value]) => {
                        const icon: Record<DamageType, string> = {
                          physical: '⚔️',
                          fire: '🔥',
                          frost: '🧊',
                          arcane: '✨',
                        };
                        const pct = Math.round(value * 100);
                        const color = value > 0 ? '#4CAF50' : '#F44336';
                        return (
                          <View key={type} style={[styles.resistChip, { borderColor: color }]}>
                            <Text style={styles.resistChipText}>
                              {icon[type]} {pct > 0 ? '+' : ''}
                              {pct}%
                            </Text>
                          </View>
                        );
                      })}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {isDefeated && (
            <View style={styles.defeatedBanner}>
              <Text style={styles.defeatedText}>DEFEATED!</Text>
            </View>
          )}

          {/* Debug Defeat Button */}
          {debugMode && onDebugDefeat && (
            <TouchableOpacity
              style={[
                styles.debugDefeatButton,
                (isDefeated || playerDefeated) && styles.debugDefeatButtonDisabled,
              ]}
              onPress={onDebugDefeat}
              disabled={isDefeated || playerDefeated}
              testID="debug-instant-defeat">
              <Text style={styles.debugDefeatButtonText}>⚡ Instant Defeat (Debug)</Text>
            </TouchableOpacity>
          )}

          <View style={styles.buttonContainer}>
            <PressableScale
              style={[
                styles.button,
                styles.fightButton,
                (isDefeated || playerDefeated) && styles.buttonDisabled,
              ]}
              onPress={onFight}
              disabled={isDefeated || playerDefeated}
              testID="encounter-fight-button">
              <Text style={styles.buttonText}>
                {isDefeated ? 'Defeated' : playerDefeated ? 'You are Defeated' : 'Fight'}
              </Text>
            </PressableScale>
            {canAutoResolve && (
              <PressableScale
                style={[
                  styles.button,
                  styles.autoResolveButton,
                  (isDefeated || playerDefeated) && styles.buttonDisabled,
                ]}
                onPress={onAutoResolve}
                disabled={isDefeated || playerDefeated}
                testID="encounter-auto-resolve-button">
                <Text style={styles.buttonText}>Auto-Resolve</Text>
              </PressableScale>
            )}
            <PressableScale style={[styles.button, styles.fleeButton]} onPress={onFlee}>
              <Text style={styles.buttonText}>Flee</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  // flexShrink lets the scroll body shrink WITHIN modalContent's maxHeight instead of expanding to
  // its full content height. Without it the creature stats (below the description) overflowed the
  // capped modal and were clipped — invisible and unscrollable on Android, where the container's
  // borderRadius clips overflow. Now the body scrolls and the footer buttons stay pinned/visible.
  scrollBody: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
    color: '#333',
  },
  minimizeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  minimizeButtonText: {
    fontSize: 24,
    color: '#666',
    fontWeight: 'bold',
    lineHeight: 28,
  },
  creatureCard: {
    borderWidth: 3,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
  },
  rarityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  rarityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  creatureName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  creatureType: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  creatureLevel: {
    fontSize: 18,
    color: '#888',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  statsContainer: {
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
  },
  hpBar: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  hpFill: {
    height: '100%',
    borderRadius: 6,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  fightButton: {
    backgroundColor: '#FF5722',
  },
  autoResolveButton: {
    backgroundColor: '#5C6BC0', // indigo — distinct from Fight (orange) / Flee (grey)
  },
  fleeButton: {
    backgroundColor: '#9E9E9E',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  defeatedBanner: {
    backgroundColor: '#FF5722',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  defeatedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  playerCard: {
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#f0f7ff',
  },
  playerCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  playerHpBar: {
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  playerHpFill: {
    height: '100%',
    borderRadius: 8,
  },
  playerHpText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  playerStatsContainer: {
    marginTop: 4,
  },
  playerStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  playerStatLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  playerStatValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
  },
  debugDefeatButton: {
    backgroundColor: '#f44336',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d32f2f',
  },
  debugDefeatButtonDisabled: {
    backgroundColor: '#ccc',
    borderColor: '#999',
    opacity: 0.6,
  },
  debugDefeatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resistancesContainer: {
    marginTop: 10,
  },
  resistancesLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginBottom: 4,
  },
  resistanceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  resistChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  resistChipText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
});
