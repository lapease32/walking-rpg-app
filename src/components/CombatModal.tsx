import React, { useState, useEffect, useRef, MutableRefObject } from 'react';
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
import { Player } from '../models/Player';
import {
  Ability,
  CombatantState,
  RESOURCE_CONFIGS,
  resolveAbility,
  computeEffectiveStats,
} from '../models/Ability';
import { ARCHETYPE_CONFIGS } from '../models/Archetype';
import { ARCHETYPE_ABILITIES } from '../constants/abilities';

interface CombatModalProps {
  encounter: Encounter | null;
  player: Player | null;
  visible: boolean;
  onAbility: (ability: Ability) => boolean;
  onClose: () => void;
  playerCombatState: CombatantState | null;
  playerCombatStateRef: MutableRefObject<CombatantState | null>;
}

const DAMAGE_TYPE_COLORS: Record<string, string> = {
  physical: '#2196F3',
  fire: '#FF5722',
  frost: '#03A9F4',
  arcane: '#9C27B0',
};

export default function CombatModal({
  encounter,
  player,
  visible,
  onAbility,
  onClose,
  playerCombatState,
  playerCombatStateRef,
}: CombatModalProps) {
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const cooldownsRef = useRef<Record<string, number>>({});
  const encounterRef = useRef<number | null>(null);

  // Reset cooldowns when a new encounter starts.
  useEffect(() => {
    if (encounter && visible) {
      const encounterId = encounter.timestamp;
      if (encounterRef.current !== encounterId) {
        setCooldowns({});
        cooldownsRef.current = {};
        encounterRef.current = encounterId;
      }
    }
  }, [encounter, encounter?.timestamp, visible]);

  // Tick cooldowns every 100ms.
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      const current = { ...cooldownsRef.current };
      let changed = false;
      for (const id of Object.keys(current)) {
        if (current[id] > 0) {
          current[id] = Math.max(0, current[id] - 100);
          changed = true;
        }
      }
      if (changed) {
        cooldownsRef.current = current;
        setCooldowns(current);
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
  const archetype = player.archetype;
  const abilities = ARCHETYPE_ABILITIES[archetype];
  const archetypeCfg = ARCHETYPE_CONFIGS[archetype];
  const resourceCfg = RESOURCE_CONFIGS[archetype];
  const resource = playerCombatState?.resource ?? resourceCfg.startValue;
  const resourceMax = resourceCfg.max;
  const resourcePct = resourceMax > 0 ? Math.min(1, resource / resourceMax) : 0;
  const resourceLabel =
    archetypeCfg.resource.charAt(0).toUpperCase() + archetypeCfg.resource.slice(1);

  // Set cooldown only after the hook confirms the ability actually ran.
  // Use ref for the resource check — always reflects post-last-ability state,
  // avoiding stale closures when the player taps faster than re-renders.
  const handleAbilityPress = (ability: Ability) => {
    const currentResource = playerCombatStateRef.current?.resource ?? resourceCfg.startValue;
    if (
      (cooldownsRef.current[ability.id] ?? 0) > 0 ||
      isDefeated ||
      playerDefeated ||
      ability.resourceCost > currentResource
    ) {
      return;
    }
    const ran = onAbility(ability);
    if (ran) {
      cooldownsRef.current[ability.id] = ability.cooldownMs;
      setCooldowns(prev => ({ ...prev, [ability.id]: ability.cooldownMs }));
    }
  };

  const formatCooldown = (ms: number): string => {
    if (ms <= 0) return '';
    return `${Math.ceil(ms / 1000)}s`;
  };

  const getDamagePreview = (ability: Ability): string => {
    if (ability.primitive === 'direct') {
      const effectiveAttack = computeEffectiveStats(
        player.attack,
        player.defense,
        playerCombatState?.statusEffects ?? [],
      ).attack;
      const dmg = resolveAbility(
        ability,
        effectiveAttack,
        creature.defense,
        creature.resistances,
        player.maxHp,
      ).damage;
      return `~${dmg} dmg`;
    }
    if (ability.primitive === 'dot') {
      return `${ability.damagePerTick}×${ability.tickCount} DoT`;
    }
    if (ability.primitive === 'buff_debuff') {
      const mods = ability.statModifiers;
      const parts: string[] = [];
      if (mods.attack !== undefined) parts.push(`${mods.attack > 0 ? '+' : ''}${mods.attack} ATK`);
      if (mods.defense !== undefined)
        parts.push(`${mods.defense > 0 ? '+' : ''}${mods.defense} DEF`);
      return `${parts.join(', ')} (${ability.tickDuration}t)`;
    }
    if (ability.primitive === 'defensive') {
      const result = resolveAbility(ability, 0, 0, creature.resistances, player.maxHp);
      if (result.heal > 0) return `+${result.heal} HP`;
      if (result.shield > 0) return `${result.shield} shield`;
    }
    return '';
  };

  const getButtonColor = (ability: Ability): string => {
    if (ability.primitive === 'direct' || ability.primitive === 'dot') {
      const dmgType = ability.damageType;
      return DAMAGE_TYPE_COLORS[dmgType] ?? '#2196F3';
    }
    if (ability.primitive === 'buff_debuff') return '#607D8B';
    if (ability.primitive === 'defensive') return '#4CAF50';
    return '#2196F3';
  };

  const hpPct = (hp: number, maxHp: number) => (maxHp > 0 ? Math.max(0, (hp / maxHp) * 100) : 0);

  const hpColor = (hp: number, maxHp: number): string => {
    const ratio = maxHp > 0 ? hp / maxHp : 0;
    return ratio > 0.5 ? '#4CAF50' : ratio > 0.25 ? '#FF9800' : '#F44336';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View
          style={styles.modalContent}
          onStartShouldSetResponder={() => true}
          testID="combat-modal">
          <View style={styles.header}>
            <Text style={styles.title}>Combat</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              testID="combat-close-button">
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Creature info */}
          <View style={styles.combatantInfo}>
            <Text style={styles.combatantName}>{creature.name}</Text>
            <View style={styles.hpBar}>
              <View
                style={[
                  styles.hpFill,
                  {
                    width: `${hpPct(creature.hp, creature.maxHp)}%`,
                    backgroundColor: hpColor(creature.hp, creature.maxHp),
                  },
                ]}
              />
            </View>
            <Text style={styles.hpText}>
              {creature.hp} / {creature.maxHp} HP
            </Text>
            <View style={styles.statsRow}>
              <Text style={styles.statChip}>ATK {creature.attack}</Text>
              <Text style={styles.statChip}>DEF {creature.defense}</Text>
            </View>
          </View>

          {/* Player info + resource bar */}
          <View style={[styles.combatantInfo, styles.playerInfoBg]}>
            <Text style={styles.combatantName}>You ({archetypeCfg.name})</Text>
            <View style={styles.hpBar}>
              <View
                style={[
                  styles.hpFill,
                  {
                    width: `${hpPct(player.hp, player.maxHp)}%`,
                    backgroundColor: hpColor(player.hp, player.maxHp),
                  },
                ]}
              />
            </View>
            <Text style={styles.hpText}>
              {player.hp} / {player.maxHp} HP
            </Text>

            {/* Resource bar */}
            <View style={styles.resourceRow}>
              <Text style={styles.resourceLabel}>{resourceLabel}</Text>
              <View style={styles.resourceBarBg}>
                <View style={[styles.resourceBarFill, { width: `${resourcePct * 100}%` }]} />
              </View>
              <Text style={styles.resourceText}>
                {Math.floor(resource)}/{resourceMax}
              </Text>
            </View>

            {/* Active status effect icons */}
            {playerCombatState && playerCombatState.statusEffects.length > 0 && (
              <View style={styles.statusEffects}>
                {playerCombatState.statusEffects.map((effect, i) => (
                  <View key={`${effect.id}-${i}`} style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>
                      {effect.type === 'buff' ? '⬆' : effect.type === 'debuff' ? '⬇' : '🩸'}{' '}
                      {effect.id.replace('_', ' ')} ({effect.remainingTicks}t)
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.statsRow}>
              <Text style={styles.statChip}>ATK {player.attack}</Text>
              <Text style={styles.statChip}>DEF {player.defense}</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sectionTitle}>Choose an Ability</Text>

            {abilities.map(ability => {
              const cooldown = cooldowns[ability.id] ?? 0;
              const isOnCooldown = cooldown > 0;
              const insufficientResource = ability.resourceCost > resource;
              const isDisabled =
                isOnCooldown || isDefeated || playerDefeated || insufficientResource;
              const cooldownPct = ability.cooldownMs > 0 ? cooldown / ability.cooldownMs : 0;
              const btnColor = getButtonColor(ability);
              const preview = getDamagePreview(ability);

              return (
                <TouchableOpacity
                  key={ability.id}
                  testID={`ability-button-${ability.id}`}
                  style={[
                    styles.abilityButton,
                    { backgroundColor: btnColor },
                    isDisabled && styles.abilityButtonDisabled,
                  ]}
                  onPress={() => handleAbilityPress(ability)}
                  disabled={isDisabled}
                  activeOpacity={0.8}>
                  <View style={styles.abilityContent}>
                    <Text style={styles.abilityIcon}>{ability.icon}</Text>
                    <View style={styles.abilityInfo}>
                      <Text style={styles.abilityName}>{ability.name}</Text>
                      <Text style={styles.abilityPreview}>{preview}</Text>
                      {ability.resourceCost > 0 && (
                        <Text
                          style={[
                            styles.abilityCost,
                            insufficientResource && styles.abilityCostInsufficient,
                          ]}>
                          {ability.resourceCost} {resourceLabel}
                        </Text>
                      )}
                      {isOnCooldown && (
                        <Text style={styles.cooldownText}>
                          Cooldown: {formatCooldown(cooldown)}
                        </Text>
                      )}
                    </View>
                  </View>
                  {isOnCooldown && (
                    <View style={[styles.cooldownOverlay, { width: `${cooldownPct * 100}%` }]} />
                  )}
                </TouchableOpacity>
              );
            })}

            {(isDefeated || playerDefeated) && (
              <View style={styles.statusMessage} testID="combat-outcome-message">
                <Text style={styles.statusText}>
                  {isDefeated ? 'Creature Defeated!' : 'You are Defeated!'}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '92%',
    maxHeight: '88%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: { fontSize: 16, color: '#666', fontWeight: 'bold' },
  combatantInfo: {
    padding: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  playerInfoBg: { backgroundColor: '#f0f7ff' },
  combatantName: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  hpBar: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 2,
  },
  hpFill: { height: '100%', borderRadius: 6 },
  hpText: { fontSize: 11, color: '#666', textAlign: 'center', marginBottom: 4 },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  resourceLabel: { fontSize: 11, color: '#555', fontWeight: '600', width: 42 },
  resourceBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#d0d0d0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  resourceBarFill: {
    height: '100%',
    backgroundColor: '#9C27B0',
    borderRadius: 5,
  },
  resourceText: { fontSize: 10, color: '#555', width: 36, textAlign: 'right' },
  statusEffects: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  statusBadge: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusBadgeText: { fontSize: 10, color: '#444' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  statChip: {
    fontSize: 11,
    color: '#555',
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scrollContent: { padding: 14 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  abilityButton: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  abilityButtonDisabled: { opacity: 0.45 },
  abilityContent: { flexDirection: 'row', alignItems: 'center' },
  abilityIcon: { fontSize: 26, marginRight: 10 },
  abilityInfo: { flex: 1 },
  abilityName: { fontSize: 15, fontWeight: 'bold', color: '#fff', marginBottom: 2 },
  abilityPreview: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  abilityCost: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  abilityCostInsufficient: { color: '#FFCDD2' },
  cooldownText: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  cooldownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  statusMessage: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#fff3cd',
    borderRadius: 10,
  },
  statusText: { fontSize: 15, fontWeight: 'bold', color: '#856404', textAlign: 'center' },
});
