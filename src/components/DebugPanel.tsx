import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MutableRefObject } from 'react';
import { Player } from '../models/Player';
import { LocationData, DistanceData } from '../services/LocationService';
import CrashlyticsService from '../services/CrashlyticsService';

interface Props {
  debugMode: boolean;
  onToggleDebug: (enabled: boolean) => void;
  player: Player;
  playerRef: MutableRefObject<Player | null>;
  setPlayerAndSave: (player: Player) => void;
  currentDistance: number;
  currentLocationRef: MutableRefObject<LocationData | null>;
  handleDistanceUpdate: (data: DistanceData) => Promise<void>;
  encounterChance: number;
  lastEncounterChance: number | null;
  isTimeBlocking: boolean;
  timeRemaining: number;
  bypassTimeConstraint: boolean;
  setBypassTimeConstraint: (value: boolean) => void;
  forceItemDrop: boolean;
  setForceItemDrop: (value: boolean) => void;
  forceEncounter: () => void;
}

export default function DebugPanel({
  debugMode,
  onToggleDebug,
  player,
  playerRef,
  setPlayerAndSave,
  currentDistance,
  currentLocationRef,
  handleDistanceUpdate,
  encounterChance,
  lastEncounterChance,
  isTimeBlocking,
  timeRemaining,
  bypassTimeConstraint,
  setBypassTimeConstraint,
  forceItemDrop,
  setForceItemDrop,
  forceEncounter,
}: Props) {
  const simulateMovement = (): void => {
    const fakeDistance = 100;
    const baseLat = currentLocationRef.current?.latitude || 37.7749;
    const baseLon = currentLocationRef.current?.longitude || -122.4194;
    const latOffset = fakeDistance / 111000;
    const newLocation: LocationData = {
      latitude: baseLat + latOffset,
      longitude: baseLon,
      accuracy: 10,
      altitude: 0,
      heading: 0,
      speed: 0,
      timestamp: Date.now(),
    };
    handleDistanceUpdate({
      incremental: fakeDistance,
      total: currentDistance + fakeDistance,
      location: newLocation,
    });
  };

  const simulateLocationUpdate = (): void => {
    const baseLat = currentLocationRef.current?.latitude || 37.7749;
    const baseLon = currentLocationRef.current?.longitude || -122.4194;
    const newLocation: LocationData = {
      latitude: baseLat + (Math.random() - 0.5) * 0.0001,
      longitude: baseLon + (Math.random() - 0.5) * 0.0001,
      accuracy: 10,
      altitude: 0,
      heading: Math.random() * 360,
      speed: 1.5,
      timestamp: Date.now(),
    };
    handleDistanceUpdate({
      incremental: 10,
      total: currentDistance + 10,
      location: newLocation,
    });
  };

  const forceLevelUp = (): void => {
    const currentPlayer = playerRef.current;
    if (!currentPlayer) return;
    const updatedPlayer = new Player(currentPlayer.toJSON());
    updatedPlayer.forceLevelUp();
    setPlayerAndSave(updatedPlayer);
    Alert.alert('Level Up!', `You are now level ${updatedPlayer.level}!`);
  };

  const addManualXP = (amount: number): void => {
    const currentPlayer = playerRef.current;
    if (!currentPlayer) return;
    const updatedPlayer = new Player(currentPlayer.toJSON());
    const levelsGained = updatedPlayer.addExperience(amount);
    setPlayerAndSave(updatedPlayer);
    if (levelsGained > 0) {
      Alert.alert(
        'XP Added & Level Up!',
        `Added ${amount} XP!\nGained ${levelsGained} level(s)!\nYou are now level ${updatedPlayer.level}!`,
      );
    } else {
      Alert.alert(
        'XP Added',
        `Added ${amount} XP!\nCurrent XP: ${updatedPlayer.experience}/${updatedPlayer.getExperienceForNextLevel()}`,
      );
    }
  };

  const resetLevel = (): void => {
    const currentPlayer = playerRef.current;
    if (!currentPlayer) return;
    Alert.alert(
      'Reset Level',
      'Are you sure you want to reset to level 1? This will reset your level, XP, and combat stats.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            const currentPlayerAtConfirm = playerRef.current;
            if (!currentPlayerAtConfirm) return;
            const updatedPlayer = new Player(currentPlayerAtConfirm.toJSON());
            updatedPlayer.resetLevel();
            setPlayerAndSave(updatedPlayer);
            Alert.alert('Level Reset', 'You have been reset to level 1.');
          },
        },
      ],
    );
  };

  const handleTestCrash = (): void => {
    Alert.alert(
      '⚠️ Test Crash',
      'This will crash the app immediately to test Crashlytics reporting. The crash report will appear in Firebase Console within a few minutes.\n\nAre you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Crash App',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!CrashlyticsService.isInitialized()) {
                await CrashlyticsService.initialize();
              }
              await CrashlyticsService.setCollectionEnabled(true);
              CrashlyticsService.setAttribute('test_crash', 'true');
              CrashlyticsService.setAttribute('player_level', player?.level || 0);
              CrashlyticsService.log('User initiated test crash from debug menu');
              await new Promise<void>(resolve => setTimeout(() => resolve(), 200));
              await CrashlyticsService.crash();
            } catch (error) {
              Alert.alert(
                'Error',
                `Failed to prepare crash test: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          },
        },
      ],
    );
  };

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
      </View>
      <View style={styles.encounterChanceContainer}>
        <Text style={styles.encounterChanceLabel}>Encounter Chance:</Text>
        <View style={styles.encounterChanceValueContainer}>
          <Text style={styles.encounterChanceValue}>{(encounterChance * 100).toFixed(2)}%</Text>
          {isTimeBlocking && (
            <Text style={styles.timeBlockingText}>(Blocked: {timeRemaining}s)</Text>
          )}
        </View>
      </View>
      {lastEncounterChance !== null && (
        <View style={styles.encounterChanceContainer}>
          <Text style={styles.encounterChanceLabel}>Last Encounter @:</Text>
          <Text style={styles.encounterChanceValue}>{(lastEncounterChance * 100).toFixed(2)}%</Text>
        </View>
      )}
      <View style={styles.encounterChanceContainer}>
        <Text style={styles.encounterChanceLabel}>Bypass Time Constraint:</Text>
        <TouchableOpacity
          style={[styles.toggleButton, bypassTimeConstraint && styles.toggleButtonActive]}
          onPress={() => setBypassTimeConstraint(!bypassTimeConstraint)}>
          <Text style={styles.toggleButtonText}>{bypassTimeConstraint ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.encounterChanceContainer}>
        <Text style={styles.encounterChanceLabel}>Force Item Drop:</Text>
        <TouchableOpacity
          style={[styles.toggleButton, forceItemDrop && styles.toggleButtonActive]}
          onPress={() => setForceItemDrop(!forceItemDrop)}>
          <Text style={styles.toggleButtonText}>{forceItemDrop ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.debugButton} onPress={simulateLocationUpdate}>
        <Text style={styles.debugButtonText}>Simulate Location Update</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.debugButton} onPress={simulateMovement}>
        <Text style={styles.debugButtonText}>Simulate 100m Movement</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.debugButton, styles.forceEncounterButton]}
        onPress={forceEncounter}
        testID="debug-force-encounter">
        <Text style={styles.debugButtonText}>Force Encounter</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.debugButton, styles.levelControlButton]}
        onPress={forceLevelUp}>
        <Text style={styles.debugButtonText}>Force Level Up</Text>
      </TouchableOpacity>
      <View style={styles.xpButtonContainer}>
        <Text style={styles.xpButtonLabel}>Add XP:</Text>
        <TouchableOpacity
          style={[styles.debugButton, styles.xpButton]}
          onPress={() => addManualXP(100)}>
          <Text style={styles.debugButtonText}>+100 XP</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.debugButton, styles.xpButton]}
          onPress={() => addManualXP(500)}>
          <Text style={styles.debugButtonText}>+500 XP</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.debugButton, styles.xpButton]}
          onPress={() => addManualXP(1000)}>
          <Text style={styles.debugButtonText}>+1000 XP</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.debugButton, styles.resetButton]} onPress={resetLevel}>
        <Text style={styles.debugButtonText}>Reset Level</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.debugButton, styles.crashButton]} onPress={handleTestCrash}>
        <Text style={styles.crashButtonText}>💥 Test Crashlytics Crash</Text>
      </TouchableOpacity>
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
  crashButton: {
    backgroundColor: '#D32F2F',
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#B71C1C',
  },
  crashButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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
