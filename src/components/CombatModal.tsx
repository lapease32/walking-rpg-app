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
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
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
import { DamageType } from '../models/DamageType';
import { ARCHETYPE_ABILITIES } from '../constants/abilities';
import PressableScale from './PressableScale';
import FloatingCombatText from './FloatingCombatText';
import CombatFxCanvas from './CombatFxCanvas';
import { useCombatImpact } from '../hooks/useCombatImpact';
import type { CombatHitEvent } from '../models/CombatHitEvent';
import { MOTION_BAR_TIMING } from '../constants/motion';

interface CombatModalProps {
  encounter: Encounter | null;
  player: Player | null;
  visible: boolean;
  onAbility: (ability: Ability) => boolean;
  onClose: () => void;
  playerCombatState: CombatantState | null;
  playerCombatStateRef: MutableRefObject<CombatantState | null>;
  /** Transient hit-event feed (Phase 2b) → typed floating numbers + resistance tells. */
  combatHits: CombatHitEvent[];
}

const DAMAGE_TYPE_COLORS: Record<string, string> = {
  physical: '#2196F3',
  fire: '#FF5722',
  frost: '#03A9F4',
  arcane: '#9C27B0',
};

/** Clamp a raw percentage into [0, 100] for animated bar widths. */
const clampPct = (n: number): number => Math.max(0, Math.min(100, n));
const toPct = (value: number, max: number): number => (max > 0 ? clampPct((value / max) * 100) : 0);

/** Instant snap (no ease) — used the first render of each encounter so bars appear at their
 *  starting fill rather than sweeping up from the previous fight's values. */
const SNAP_TIMING = { duration: 0 } as const;

export default function CombatModal({
  encounter,
  player,
  visible,
  onAbility,
  onClose,
  playerCombatState,
  playerCombatStateRef,
  combatHits,
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

  // ─── Tier-1 combat motion: HP + resource bars ease between values instead of jumping. ───
  // Shared values hold each bar's current width % (0–100); useAnimatedStyle maps them to `width`.
  // Declared before the early return below so hook order stays stable when encounter/player are null.
  const creatureHpWidth = useSharedValue(100);
  const playerHpWidth = useSharedValue(100);
  const resourceWidth = useSharedValue(0);

  const creatureHpAnimStyle = useAnimatedStyle(() => ({ width: `${creatureHpWidth.value}%` }));
  const playerHpAnimStyle = useAnimatedStyle(() => ({ width: `${playerHpWidth.value}%` }));
  const resourceAnimStyle = useAnimatedStyle(() => ({ width: `${resourceWidth.value}%` }));

  // Targets computed null-safely from props (locals like `creature`/`resourceCfg` are derived after
  // the guard). resource mirrors the label math below: current resource over the archetype max.
  const creatureHpTargetPct = encounter?.creature
    ? toPct(encounter.creature.hp, encounter.creature.maxHp)
    : 100;
  const playerHpTargetPct = player ? toPct(player.hp, player.maxHp) : 100;
  const resourceTargetPct = player
    ? toPct(
        playerCombatState?.resource ?? RESOURCE_CONFIGS[player.archetype].startValue,
        RESOURCE_CONFIGS[player.archetype].max,
      )
    : 0;

  // Snap the bars on the first render of each encounter (new fight), then ease within the fight —
  // otherwise a fresh full-HP creature would sweep up from the previous foe's dead-empty bar.
  const barsEncounterRef = useRef<number | null>(null);
  useEffect(() => {
    const encId = encounter?.timestamp ?? null;
    const timing = barsEncounterRef.current === encId ? MOTION_BAR_TIMING : SNAP_TIMING;
    barsEncounterRef.current = encId;
    creatureHpWidth.value = withTiming(creatureHpTargetPct, timing);
    playerHpWidth.value = withTiming(playerHpTargetPct, timing);
    resourceWidth.value = withTiming(resourceTargetPct, timing);
  }, [
    encounter?.timestamp,
    creatureHpTargetPct,
    playerHpTargetPct,
    resourceTargetPct,
    creatureHpWidth,
    playerHpWidth,
    resourceWidth,
  ]);

  // Impact FX (Phase 2a/2b): typed floating numbers + panel hit-flash + modal shake + creature
  // hurt-punch, driven by the combatHits event feed from useEncounter (carries damage type + resist).
  const {
    floaters,
    removeFloater,
    bursts,
    removeBurst,
    creatureFlashStyle,
    playerFlashStyle,
    shakeStyle,
    creatureRecoilStyle,
    playerRecoilStyle,
  } = useCombatImpact({ encounterId: encounter?.timestamp ?? null, hits: combatHits });

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
        <Animated.View
          style={[styles.modalContent, shakeStyle]}
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
          <Animated.View style={[styles.combatantInfo, creatureRecoilStyle]}>
            <Text style={styles.combatantName}>{creature.name}</Text>
            <View style={styles.hpBar}>
              <Animated.View
                style={[
                  styles.hpFill,
                  { backgroundColor: hpColor(creature.hp, creature.maxHp) },
                  creatureHpAnimStyle,
                ]}
              />
            </View>
            <Text style={styles.hpText}>
              {creature.hp} / {creature.maxHp} HP
            </Text>
            <View style={styles.statsRow}>
              <Text style={styles.statChip}>ATK {creature.attack}</Text>
              <Text style={styles.statChip}>DEF {creature.defense}</Text>
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
                  return (
                    <Text
                      key={type}
                      style={[
                        styles.statChip,
                        value > 0 ? styles.resistChipPos : styles.resistChipNeg,
                      ]}>
                      {icon[type]} {pct > 0 ? '+' : ''}
                      {pct}%
                    </Text>
                  );
                })}
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.hitFlash, styles.hitFlashCreature, creatureFlashStyle]}
            />
            <CombatFxCanvas
              bursts={bursts.filter(b => b.target === 'creature')}
              onBurstDone={removeBurst}
            />
            <View pointerEvents="none" style={styles.floaterLayer}>
              {floaters
                .filter(f => f.target === 'creature')
                .map(f => (
                  <FloatingCombatText key={f.id} item={f} onDone={removeFloater} />
                ))}
            </View>
          </Animated.View>

          {/* Player info + resource bar */}
          <Animated.View style={[styles.combatantInfo, styles.playerInfoBg, playerRecoilStyle]}>
            <Text style={styles.combatantName}>You ({archetypeCfg.name})</Text>
            <View style={styles.hpBar}>
              <Animated.View
                style={[
                  styles.hpFill,
                  { backgroundColor: hpColor(player.hp, player.maxHp) },
                  playerHpAnimStyle,
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
                <Animated.View style={[styles.resourceBarFill, resourceAnimStyle]} />
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
            <Animated.View
              pointerEvents="none"
              style={[styles.hitFlash, styles.hitFlashPlayer, playerFlashStyle]}
            />
            <CombatFxCanvas
              bursts={bursts.filter(b => b.target === 'player')}
              onBurstDone={removeBurst}
            />
            <View pointerEvents="none" style={styles.floaterLayer}>
              {floaters
                .filter(f => f.target === 'player')
                .map(f => (
                  <FloatingCombatText key={f.id} item={f} onDone={removeFloater} />
                ))}
            </View>
          </Animated.View>

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
                <PressableScale
                  key={ability.id}
                  testID={`ability-button-${ability.id}`}
                  style={[
                    styles.abilityButton,
                    { backgroundColor: btnColor },
                    isDisabled && styles.abilityButtonDisabled,
                  ]}
                  onPress={() => handleAbilityPress(ability)}
                  disabled={isDisabled}>
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
                </PressableScale>
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
        </Animated.View>
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
  // Phase 2a impact FX: both overlays fill their combatant panel; opacity/children are animated.
  hitFlash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hitFlashCreature: { backgroundColor: '#ffffff' }, // a white flash reads as a landed hit
  hitFlashPlayer: { backgroundColor: '#ff3b30' }, // red when the player is the one struck
  floaterLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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
  resistChipPos: {
    color: '#2e7d32',
    backgroundColor: 'rgba(76,175,80,0.12)',
  },
  resistChipNeg: {
    color: '#c62828',
    backgroundColor: 'rgba(244,67,54,0.12)',
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
