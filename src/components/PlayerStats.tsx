import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Player } from '../models/Player';
import { ARCHETYPE_CONFIGS } from '../models/Archetype';
import { MOTION_BAR_TIMING, MOTION_SPRING } from '../constants/motion';

interface PlayerStatsProps {
  player: Player | null;
}

/**
 * Component to display player statistics. HP/XP bar fills EASE to new values (instead of snapping)
 * and the level pops on level-up — graphics roadmap Phase 1 micro-polish.
 */
export default function PlayerStats({ player }: PlayerStatsProps) {
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

  const hpBarColor = hpPercentage > 0.5 ? '#4CAF50' : hpPercentage > 0.25 ? '#FF9800' : '#F44336';

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
          <Text style={styles.combatStatLabel}>⚔️ Attack</Text>
        </View>
        <View style={styles.combatStatItem}>
          <Text style={styles.combatStatValue}>{stats.defense}</Text>
          <Text style={styles.combatStatLabel}>🛡️ Defense</Text>
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

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
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
    color: '#333',
  },
  level: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
  },
  hpContainer: {
    marginBottom: 12,
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
  expContainer: {
    marginBottom: 16,
  },
  expBar: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
  },
  expFill: {
    height: '100%',
    backgroundColor: '#2196F3', // Blue color to distinguish from HP bar (green/orange/red)
    borderRadius: 10,
  },
  expText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  combatStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  combatStatItem: {
    alignItems: 'center',
  },
  combatStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  combatStatLabel: {
    fontSize: 14,
    color: '#666',
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
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
});
