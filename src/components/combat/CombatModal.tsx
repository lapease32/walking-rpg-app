import React, { useEffect, useMemo, useRef, MutableRefObject } from 'react';
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
import { Encounter } from '../../models/Encounter';
import { Player } from '../../models/Player';
import {
  Ability,
  CombatantState,
  RESOURCE_CONFIGS,
  resolveAbility,
  computeEffectiveStats,
} from '../../models/Ability';
import { ARCHETYPE_CONFIGS } from '../../models/Archetype';
import { DamageType } from '../../models/DamageType';
import { ARCHETYPE_ABILITIES } from '../../constants/abilities';
import PressableScale from '../common/PressableScale';
import AbilityIcon from '../icons/AbilityIcon';
import DamageTypeIcon from '../icons/DamageTypeIcon';
import { CloseIcon, BuffIcon, DebuffIcon, DotIcon } from '../icons/UiIcon';
import FloatingCombatText from './FloatingCombatText';
import CombatFxCanvas from './CombatFxCanvas';
import { useCombatImpact } from '../../hooks/useCombatImpact';
import type { CombatHitEvent } from '../../models/CombatHitEvent';
import type { CombatLogEntry } from '../../models/CombatLog';
import CombatLog from './CombatLog';
import CreatureStage from './CreatureStage';
import { deriveCreatureAnimState } from './creatures/registry';
import { MOTION_BAR_TIMING } from '../../constants/motion';
import { useTheme } from '../../hooks/useTheme';
import { hpColor, type ThemeTokens } from '../../constants/theme';

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
  /** Turn-by-turn narration feed for the combat log. */
  combatLog: CombatLogEntry[];
  /** True while the creature's counter-attack beat is resolving (the "enemy turn"). */
  isEnemyTurn: boolean;
}

/** Ability-button color by damage type — themed, so the buttons sit in the palette instead of
 *  fighting it (the FX/floater colors stay fixed; they render on the always-dark creature plate). */
const damageTypeColor = (type: DamageType, t: ThemeTokens): string => {
  switch (type) {
    case 'fire':
      return t.fire;
    case 'frost':
      return t.frost;
    case 'arcane':
      return t.arcane;
    default:
      return t.physical;
  }
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
  combatLog,
  isEnemyTurn,
}: CombatModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

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

  // Abilities are gated by resource cost alone (one action per turn) — no cooldowns.
  // Use the ref for the resource check so it always reflects post-last-ability state,
  // avoiding stale closures when the player taps faster than re-renders.
  const handleAbilityPress = (ability: Ability) => {
    const currentResource = playerCombatStateRef.current?.resource ?? resourceCfg.startValue;
    if (isDefeated || playerDefeated || ability.resourceCost > currentResource) {
      return;
    }
    onAbility(ability);
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
      return damageTypeColor(ability.damageType, theme);
    }
    if (ability.primitive === 'buff_debuff') return theme.textMuted;
    if (ability.primitive === 'defensive') return theme.success;
    return theme.physical;
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
          {/* Compact close bar — the stage announces the fight, so no "Combat" title is needed;
              this reclaims the vertical room the taller creature stage wants. */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              testID="combat-close-button">
              <CloseIcon size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Turn banner — whose turn it is. During the enemy turn the counter beat is resolving and
              the player's inputs are locked; this makes that unmistakable. */}
          <View
            style={[
              styles.turnBanner,
              isEnemyTurn ? styles.turnBannerEnemy : styles.turnBannerPlayer,
            ]}
            testID="combat-turn-banner">
            <Text style={styles.turnBannerText}>
              {isEnemyTurn ? `${creature.name}'s turn — bracing…` : 'Your turn'}
            </Text>
          </View>

          {/* Creature stage — the painted creature stands on a lit ground, with its HP + stats on a
              plinth below. The stage hosts the combat FX so hits land on the creature itself. */}
          <Animated.View
            style={[styles.creaturePanel, isEnemyTurn && styles.activePanel, creatureRecoilStyle]}>
            <CreatureStage
              creatureId={creature.id}
              type={creature.type}
              rarity={creature.rarity}
              daylight={encounter.daylight}
              state={deriveCreatureAnimState({ isDefeated, isEnemyTurn })}>
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
            </CreatureStage>

            <View style={styles.plinth}>
              <Text style={styles.combatantName}>{creature.name}</Text>
              <View style={styles.hpBar}>
                <Animated.View
                  style={[
                    styles.hpFill,
                    { backgroundColor: hpColor(creature.hp, creature.maxHp, theme) },
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
                <Text style={styles.statChip}>SPD {creature.speed}</Text>
                {(Object.entries(creature.resistances) as [DamageType, number][])
                  .filter(([, v]) => v !== 0)
                  .map(([type, value]) => {
                    const pct = Math.round(value * 100);
                    const c = value > 0 ? theme.success : theme.danger;
                    return (
                      // The sign is carried by the icon + text colour (success/danger), so the chip
                      // itself just needs the neutral track ground.
                      <View key={type} style={styles.resistChip}>
                        <DamageTypeIcon type={type} size={11} color={c} />
                        <Text style={[styles.resistChipText, { color: c }]}>
                          {' '}
                          {pct > 0 ? '+' : ''}
                          {pct}%
                        </Text>
                      </View>
                    );
                  })}
              </View>
            </View>
          </Animated.View>

          {/* Player info + resource bar */}
          <Animated.View
            style={[
              styles.combatantInfo,
              styles.playerInfoBg,
              !isEnemyTurn && styles.activePanel,
              playerRecoilStyle,
            ]}>
            <Text style={styles.combatantName}>You ({archetypeCfg.name})</Text>
            <View style={styles.hpBar}>
              <Animated.View
                style={[
                  styles.hpFill,
                  { backgroundColor: hpColor(player.hp, player.maxHp, theme) },
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
                    {effect.type === 'buff' ? (
                      <BuffIcon size={11} color={theme.textSecondary} />
                    ) : effect.type === 'debuff' ? (
                      <DebuffIcon size={11} color={theme.textSecondary} />
                    ) : (
                      <DotIcon size={11} color={theme.textSecondary} />
                    )}
                    <Text style={styles.statusBadgeText}>
                      {' '}
                      {effect.id.replace('_', ' ')} ({effect.remainingTicks}t)
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.statsRow}>
              <Text style={styles.statChip}>ATK {player.attack}</Text>
              <Text style={styles.statChip}>DEF {player.defense}</Text>
              <Text style={styles.statChip}>SPD {player.speed}</Text>
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

          <ScrollView style={styles.abilityScroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sectionTitle}>
              {isEnemyTurn ? 'Enemy turn — hold on…' : 'Choose an Ability'}
            </Text>

            {abilities.map(ability => {
              const insufficientResource = ability.resourceCost > resource;
              const isDisabled =
                isDefeated || playerDefeated || insufficientResource || isEnemyTurn;
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
                    <AbilityIcon
                      id={ability.id}
                      size={26}
                      color="#fff"
                      style={styles.abilityIcon}
                    />
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
                    </View>
                  </View>
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
          <View style={styles.logPane}>
            <CombatLog entries={combatLog} playerName="You" creatureName={creature.name} />
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: t.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: t.surface,
      borderRadius: 20,
      width: '92%',
      maxHeight: '88%',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 4,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: t.surfaceAlt,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonText: { fontSize: 16, color: t.textSecondary, fontWeight: 'bold' },
    combatantInfo: {
      padding: 10,
      paddingHorizontal: 16,
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
      // Transparent by default so toggling the active-turn accent never shifts panel layout.
      borderLeftWidth: 4,
      borderLeftColor: 'transparent',
    },
    playerInfoBg: { backgroundColor: t.surfaceRaised },
    // Creature stage + its plinth read as one card: the stage is full-bleed, the plinth sits below.
    creaturePanel: {
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
      borderLeftWidth: 4,
      borderLeftColor: 'transparent',
      overflow: 'hidden',
    },
    plinth: {
      padding: 10,
      paddingHorizontal: 16,
      backgroundColor: t.surfaceAlt,
    },
    // The combatant whose turn it is gets an accent edge (paired with the turn banner + ability dim).
    activePanel: { borderLeftColor: t.warning },
    turnBanner: { paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
    turnBannerPlayer: { backgroundColor: t.success },
    turnBannerEnemy: { backgroundColor: t.danger },
    turnBannerText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 },
    // Impact FX overlays fill their combatant panel; opacity is animated. The creature flash uses the
    // theme's INK so it contrasts on both grounds (a white flash would vanish on the day palette).
    hitFlash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    hitFlashCreature: { backgroundColor: t.text },
    hitFlashPlayer: { backgroundColor: t.danger },
    floaterLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    combatantName: { fontSize: 14, fontWeight: 'bold', color: t.text },
    hpBar: {
      height: 12,
      backgroundColor: t.track,
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 2,
    },
    hpFill: { height: '100%', borderRadius: 6 },
    hpText: { fontSize: 11, color: t.textSecondary, textAlign: 'center', marginBottom: 4 },
    resourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    resourceLabel: { fontSize: 11, color: t.textSecondary, fontWeight: '600', width: 42 },
    resourceBarBg: {
      flex: 1,
      height: 10,
      backgroundColor: t.track,
      borderRadius: 5,
      overflow: 'hidden',
    },
    resourceBarFill: {
      height: '100%',
      backgroundColor: t.accent,
      borderRadius: 5,
    },
    resourceText: { fontSize: 10, color: t.textSecondary, width: 36, textAlign: 'right' },
    statusEffects: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.track,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    statusBadgeText: { fontSize: 10, color: t.textSecondary },
    resistChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: t.track,
    },
    resistChipText: { fontSize: 11 },
    statsRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
    statChip: {
      fontSize: 11,
      color: t.textSecondary,
      backgroundColor: t.track,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    scrollContent: { padding: 14 },
    abilityScroll: { flexShrink: 1 },
    logPane: { paddingHorizontal: 14, paddingBottom: 14 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: t.text, marginBottom: 10 },
    abilityButton: {
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      overflow: 'hidden',
      position: 'relative',
    },
    abilityButtonDisabled: { opacity: 0.45 },
    abilityContent: { flexDirection: 'row', alignItems: 'center' },
    abilityIcon: { marginRight: 10 },
    abilityInfo: { flex: 1 },
    // Ability buttons carry a saturated damage-type ground in both themes, so their text stays white.
    abilityName: { fontSize: 15, fontWeight: 'bold', color: '#fff', marginBottom: 2 },
    abilityPreview: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
    abilityCost: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    abilityCostInsufficient: { color: '#FFCDD2' },
    statusMessage: {
      marginTop: 16,
      padding: 14,
      backgroundColor: t.surfaceAlt,
      borderRadius: 10,
    },
    statusText: { fontSize: 15, fontWeight: 'bold', color: t.warning, textAlign: 'center' },
  });
