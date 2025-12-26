import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Player } from '../models/Player';

interface PlayerStatsProps {
  player: Player | null;
}

/**
 * Component to display player statistics
 */
export default function PlayerStats({ player }: PlayerStatsProps) {
  if (!player) {
    return null;
  }

  const stats = player.getStats();
  const progressPercentage =
    (stats.experience / stats.experienceForNextLevel) * 100;

  // Calculate HP percentage with guard against division by zero
  const hpPercentage = stats.maxHp > 0
    ? stats.hp / stats.maxHp
    : 1;
  const hpBarColor = hpPercentage > 0.5
    ? '#4CAF50'
    : hpPercentage > 0.25
      ? '#FF9800'
      : '#F44336';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.playerName}>{stats.name}</Text>
        <Text style={styles.level}>Level {stats.level}</Text>
      </View>

      <View style={styles.hpContainer}>
        <View style={styles.hpBar}>
          <View
            style={[
              styles.hpFill,
              {
                width: `${hpPercentage * 100}%`,
                backgroundColor: hpBarColor,
              },
            ]}
          />
        </View>
        <Text style={styles.hpText}>
          {stats.hp} / {stats.maxHp} HP
        </Text>
      </View>

      <View style={styles.expContainer}>
        <View style={styles.expBar}>
          <View
            style={[styles.expFill, { width: `${progressPercentage}%` }]}
          />
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
          <Text style={styles.statValue}>{stats.creaturesCaught}</Text>
          <Text style={styles.statLabel}>Caught</Text>
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

