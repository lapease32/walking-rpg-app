import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Player } from '../../models/Player';
import StatIcon from '../icons/StatIcon';
import { ARCHETYPE_CONFIGS } from '../../models/Archetype';
import { MOTION_BAR_TIMING, MOTION_SPRING } from '../../constants/motion';
import { useTheme } from '../../hooks/useTheme';
import { hpColor, type ThemeTokens } from '../../constants/theme';

interface PlayerStatsProps {
  player: Player | null;
}

/**
 * Component to display player statistics. HP/XP bar fills EASE to new values (instead of snapping)
 * and the level pops on level-up — graphics roadmap Phase 1 micro-polish.
 */
export default function PlayerStats({ player }: PlayerStatsProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const stats = player ? player.getStats() : null;
  const progressPercentage =
    stats && stats.experienceForNextLevel > 0
      ? (stats.experience / stats.experienceForNextLevel) * 100
      : 0;
  // HP percentage with guard against division by zero.
  const hpPercentage = stats && stats.maxHp > 0 ? stats.hp / stats.maxHp : 1;
  const currentLevel = stats ? stats.level : null;

  // Animated bar widths + level-flourish scale. Hooks must run unconditionally (before the early
  // return below). PlayerStats only mounts once a player exists (HomeScreen gates it), so the
  // shared values initialize straight to real values — no on-mount flicker.
  const hpWidth = useSharedValue(hpPercentage * 100);
  const expWidth = useSharedValue(progressPercentage);
  const levelScale = useSharedValue(1);
  const prevLevelRef = useRef<number | null>(currentLevel);

  // Ease the bars to their new values on change (HP drains/refills, XP fills). withTiming to the
  // same value on mount is a no-op, so no visible animation until something actually changes.
  useEffect(() => {
    hpWidth.value = withTiming(hpPercentage * 100, MOTION_BAR_TIMING);
    expWidth.value = withTiming(progressPercentage, MOTION_BAR_TIMING);
  }, [hpPercentage, progressPercentage, hpWidth, expWidth]);

  // Level-up flourish: pop the level text when it INCREASES (never on first mount).
  useEffect(() => {
    if (
      currentLevel !== null &&
      prevLevelRef.current !== null &&
      currentLevel > prevLevelRef.current
    ) {
      levelScale.value = withSequence(
        withSpring(1.35, MOTION_SPRING.pop),
        withSpring(1, MOTION_SPRING.pop),
      );
    }
    if (currentLevel !== null) {
      prevLevelRef.current = currentLevel;
    }
  }, [currentLevel, levelScale]);

  const hpAnimStyle = useAnimatedStyle(() => ({ width: `${hpWidth.value}%` }));
  const expAnimStyle = useAnimatedStyle(() => ({ width: `${expWidth.value}%` }));
  const levelAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: levelScale.value }] }));

  if (!player || !stats) {
    return null;
  }

  const hpBarColor = hpColor(stats.hp, stats.maxHp, theme);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.playerName}>{ARCHETYPE_CONFIGS[player.archetype].name}</Text>
        <Animated.Text style={[styles.level, levelAnimStyle]}>Level {stats.level}</Animated.Text>
      </View>

      <View style={styles.hpContainer}>
        <View style={styles.hpBar}>
          <Animated.View style={[styles.hpFill, { backgroundColor: hpBarColor }, hpAnimStyle]} />
        </View>
        <Text style={styles.hpText}>
          {stats.hp} / {stats.maxHp} HP
        </Text>
      </View>

      <View style={styles.expContainer}>
        <View style={styles.expBar}>
          <Animated.View style={[styles.expFill, expAnimStyle]} />
        </View>
        <Text style={styles.expText}>
          {stats.experience} / {stats.experienceForNextLevel} XP
        </Text>
      </View>

      <View style={styles.combatStats}>
        <View style={styles.combatStatItem}>
          <Text style={styles.combatStatValue}>{stats.attack}</Text>
          <View style={styles.combatStatLabelRow}>
            <StatIcon stat="attack" size={13} color={theme.textSecondary} />
            <Text style={styles.combatStatLabel}> Attack</Text>
          </View>
        </View>
        <View style={styles.combatStatItem}>
          <Text style={styles.combatStatValue}>{stats.defense}</Text>
          <View style={styles.combatStatLabelRow}>
            <StatIcon stat="defense" size={13} color={theme.textSecondary} />
            <Text style={styles.combatStatLabel}> Defense</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalDistance.toFixed(1)} m</Text>
          <Text style={styles.statLabel}>Total Distance</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalEncounters}</Text>
          <Text style={styles.statLabel}>Encounters</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.creaturesDefeated}</Text>
          <Text style={styles.statLabel}>Defeated</Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    container: {
      padding: 16,
      backgroundColor: t.surface,
      borderRadius: 8,
      marginVertical: 8,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    playerName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: t.text,
    },
    level: {
      fontSize: 18,
      color: t.textSecondary,
      fontWeight: '600',
    },
    hpContainer: {
      marginBottom: 12,
    },
    hpBar: {
      height: 20,
      backgroundColor: t.track,
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
      color: t.textSecondary,
      textAlign: 'center',
    },
    expContainer: {
      marginBottom: 16,
    },
    expBar: {
      height: 20,
      backgroundColor: t.track,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 4,
    },
    expFill: {
      height: '100%',
      backgroundColor: t.info, // Blue color to distinguish from HP bar (green/orange/red)
      borderRadius: 10,
    },
    expText: {
      fontSize: 12,
      color: t.textSecondary,
      textAlign: 'center',
    },
    combatStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 16,
      paddingVertical: 12,
      backgroundColor: t.surfaceAlt,
      borderRadius: 8,
    },
    combatStatItem: {
      alignItems: 'center',
    },
    combatStatValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: t.text,
      marginBottom: 4,
    },
    combatStatLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    combatStatLabel: {
      fontSize: 14,
      color: t.textSecondary,
      fontWeight: '600',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    statItem: {
      width: '48%',
      padding: 12,
      backgroundColor: t.surfaceAlt,
      borderRadius: 8,
      marginBottom: 8,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: t.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: t.textSecondary,
    },
  });
