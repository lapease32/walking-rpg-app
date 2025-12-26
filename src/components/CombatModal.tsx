import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Encounter } from '../models/Encounter';
import { Player } from '../models/Player';
import { ATTACK_TYPES, AttackType } from '../constants/config';

interface CombatModalProps {
  encounter: Encounter | null;
  player: Player | null;
  visible: boolean;
  onAttack: (attackType: AttackType) => void;
  onClose: () => void;
}

/**
 * Modal component for combat actions during an encounter
 */
export default function CombatModal({
  encounter,
  player,
  visible,
  onAttack,
  onClose,
}: CombatModalProps) {
  const [cooldowns, setCooldowns] = useState<Record<AttackType, number>>({
    BASIC: 0,
    STRONG: 0,
    HEAVY: 0,
  });

  // Use ref for synchronous cooldown checks to prevent race conditions
  // State is async, so rapid taps can bypass cooldown if we only check state
  const cooldownsRef = useRef<Record<AttackType, number>>({
    BASIC: 0,
    STRONG: 0,
    HEAVY: 0,
  });

  // Track the current encounter to detect when it changes
  const encounterRef = useRef<number | null>(null);

  // Reset cooldowns when a new encounter starts
  useEffect(() => {
    if (encounter && visible) {
      const encounterId = encounter.timestamp;
      // If this is a different encounter, reset cooldowns
      if (encounterRef.current !== encounterId) {
        const resetCooldowns = {
          BASIC: 0,
          STRONG: 0,
          HEAVY: 0,
        };
        setCooldowns(resetCooldowns);
        cooldownsRef.current = resetCooldowns;
        encounterRef.current = encounterId;
      }
    }
    // Note: We don't reset encounterRef.current when modal closes
    // This prevents cooldown reset exploit when reopening the same encounter
  }, [encounter?.timestamp, visible]);

  // Update cooldowns every 100ms
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      // Read from ref (source of truth) to prevent race conditions
      // The ref may have been updated synchronously by handleAttack
      // before the state update has committed
      const currentRef = { ...cooldownsRef.current };
      let changed = false;

      (Object.keys(ATTACK_TYPES) as AttackType[]).forEach((type) => {
        if (currentRef[type] > 0) {
          currentRef[type] = Math.max(0, currentRef[type] - 100);
          changed = true;
        }
      });

      // Update both ref and state together to keep them in sync
      if (changed) {
        cooldownsRef.current = currentRef;
        setCooldowns(currentRef);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [visible]);

  if (!encounter || !encounter.creature || !player) {
    return null;
  }

  const creature = encounter.creature;
  const isDefeated = creature.isDefeated();
  const playerDefeated = player.isDefeated();

  const handleAttack = (attackType: AttackType) => {
    // Check ref synchronously to prevent race conditions from rapid taps
    // State updates are async, so multiple rapid taps could all read state as 0
    if (cooldownsRef.current[attackType] > 0 || isDefeated || playerDefeated) {
      return;
    }

    // Set cooldown in both ref (synchronous) and state (for UI updates)
    const cooldownMs = ATTACK_TYPES[attackType].cooldownMs;
    cooldownsRef.current[attackType] = cooldownMs;
    setCooldowns((prev) => ({
      ...prev,
      [attackType]: cooldownMs,
    }));

    onAttack(attackType);
  };

  const formatCooldown = (ms: number): string => {
    if (ms <= 0) return '';
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  const getCooldownPercentage = (attackType: AttackType): number => {
    const cooldown = cooldowns[attackType];
    const totalCooldown = ATTACK_TYPES[attackType].cooldownMs;
    return totalCooldown > 0 ? cooldown / totalCooldown : 0;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Combat</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Creature Info */}
            <View style={styles.creatureInfo}>
              <Text style={styles.creatureName}>{creature.name}</Text>
              <View style={styles.hpBar}>
                <View
                  style={[
                    styles.hpFill,
                    {
                      width: `${Math.max(0, (creature.hp / creature.maxHp) * 100)}%`,
                      backgroundColor: creature.hp / creature.maxHp > 0.5
                        ? '#4CAF50'
                        : creature.hp / creature.maxHp > 0.25
                          ? '#FF9800'
                          : '#F44336',
                    },
                  ]}
                />
              </View>
              <Text style={styles.hpText}>
                {creature.hp} / {creature.maxHp} HP
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Attack</Text>
                  <Text style={styles.statValue}>{creature.attack}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Defense</Text>
                  <Text style={styles.statValue}>{creature.defense}</Text>
                </View>
              </View>
            </View>

            {/* Player Info */}
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>You</Text>
              <View style={styles.hpBar}>
                <View
                  style={[
                    styles.hpFill,
                    {
                      width: `${Math.max(0, (player.hp / player.maxHp) * 100)}%`,
                      backgroundColor: player.hp / player.maxHp > 0.5
                        ? '#4CAF50'
                        : player.hp / player.maxHp > 0.25
                          ? '#FF9800'
                          : '#F44336',
                    },
                  ]}
                />
              </View>
              <Text style={styles.hpText}>
                {player.hp} / {player.maxHp} HP
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Attack</Text>
                  <Text style={styles.statValue}>{player.attack}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Defense</Text>
                  <Text style={styles.statValue}>{player.defense}</Text>
                </View>
              </View>
            </View>

            {/* Attack Buttons */}
            <View style={styles.attacksContainer}>
              <Text style={styles.attacksTitle}>Choose an Attack</Text>
              {(Object.keys(ATTACK_TYPES) as AttackType[]).map((attackType) => {
                const attack = ATTACK_TYPES[attackType];
                const cooldown = cooldowns[attackType];
                const isOnCooldown = cooldown > 0;
                const isDisabled = isOnCooldown || isDefeated || playerDefeated;
                const cooldownPercent = getCooldownPercentage(attackType);

                // Calculate expected damage (must match Player.calculateDamage logic)
                const baseDamage = player.attack - creature.defense;
                const expectedDamage = Math.max(1, Math.floor(
                  baseDamage * attack.damageMultiplier
                ));

                return (
                  <TouchableOpacity
                    key={attackType}
                    style={[
                      styles.attackButton,
                      isDisabled && styles.attackButtonDisabled,
                    ]}
                    onPress={() => handleAttack(attackType)}
                    disabled={isDisabled}
                  >
                    <View style={styles.attackButtonContent}>
                      <Text style={styles.attackIcon}>{attack.icon}</Text>
                      <View style={styles.attackInfo}>
                        <Text style={styles.attackName}>{attack.name}</Text>
                        <Text style={styles.attackDamage}>
                          ~{expectedDamage} damage
                        </Text>
                        {isOnCooldown && (
                          <Text style={styles.cooldownText}>
                            Cooldown: {formatCooldown(cooldown)}
                          </Text>
                        )}
                      </View>
                    </View>
                    {isOnCooldown && (
                      <View
                        style={[
                          styles.cooldownOverlay,
                          { width: `${cooldownPercent * 100}%` },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {(isDefeated || playerDefeated) && (
              <View style={styles.statusMessage}>
                <Text style={styles.statusText}>
                  {isDefeated
                    ? 'Creature Defeated!'
                    : 'You are Defeated!'}
                </Text>
              </View>
            )}
          </ScrollView>
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
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
  },
  creatureInfo: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  creatureName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  playerInfo: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
  },
  playerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  hpBar: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
  },
  hpFill: {
    height: '100%',
    borderRadius: 10,
  },
  hpText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  attacksContainer: {
    marginTop: 10,
  },
  attacksTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  attackButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  attackButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  attackButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attackIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  attackInfo: {
    flex: 1,
  },
  attackName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  attackDamage: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  cooldownText: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
    marginTop: 4,
  },
  cooldownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  statusMessage: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fff3cd',
    borderRadius: 12,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    textAlign: 'center',
  },
});

