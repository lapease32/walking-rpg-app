import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import LocationService, { LocationData, DistanceData } from '../services/LocationService';
import EncounterService from '../services/EncounterService';
import { Player } from '../models/Player';
import { Encounter } from '../models/Encounter';
import { Location } from '../models/Encounter';
import { savePlayerData, loadPlayerData } from '../utils/storage';
import DistanceDisplay from '../components/DistanceDisplay';
import PlayerStats from '../components/PlayerStats';
import EncounterModal from '../components/EncounterModal';

/**
 * Main home screen with location tracking and encounter handling
 */
export default function HomeScreen() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [currentDistance, setCurrentDistance] = useState<number>(0);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(null);
  const [showEncounterModal, setShowEncounterModal] = useState<boolean>(false);
  const [debugMode, setDebugMode] = useState<boolean>(__DEV__); // Enable by default in dev mode
  
  // Ref to prevent multiple victory processing for the same encounter
  const victoryProcessedRef = useRef<boolean>(false);

  // Load player data on mount
  useEffect(() => {
    initializePlayer();
  }, []);

  const initializePlayer = async (): Promise<void> => {
    try {
      const savedData = await loadPlayerData();
      if (savedData) {
        setPlayer(Player.fromJSON(savedData));
      } else {
        // Create new player
        const newPlayer = new Player();
        setPlayer(newPlayer);
        await savePlayerData(newPlayer);
      }
    } catch (error) {
      console.error('Error initializing player:', error);
      setPlayer(new Player());
    }
  };

  // Handle location updates
  const handleLocationUpdate = (location: LocationData): void => {
    setCurrentLocation(location);
  };

  // Handle distance updates
  const handleDistanceUpdate = (distanceData: DistanceData): void => {
    const { incremental, total } = distanceData;
    setCurrentDistance(total);

    // Update player distance
    if (player) {
      const updatedPlayer = new Player(player.toJSON());
      updatedPlayer.addDistance(incremental);
      setPlayer(updatedPlayer);
      savePlayerData(updatedPlayer); // Save periodically
    }

    // Check for encounters
    if (currentLocation) {
      const location: Location = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      };
      const encounter = EncounterService.processDistanceUpdate(
        distanceData,
        location,
        player?.level || 1
      );

      if (encounter) {
        setCurrentEncounter(encounter);
        setShowEncounterModal(true);
        victoryProcessedRef.current = false; // Reset victory flag for new encounter
      }
    }
  };

  // Start tracking
  const startTracking = (): void => {
    LocationService.startTracking(handleLocationUpdate, handleDistanceUpdate);
    setIsTracking(true);
  };

  // Stop tracking
  const stopTracking = (): void => {
    LocationService.stopTracking();
    setIsTracking(false);
  };

  // Handle encounter catch
  const handleCatch = (): void => {
    if (currentEncounter && player) {
      const updatedPlayer = new Player(player.toJSON());
      updatedPlayer.catchCreature();
      updatedPlayer.incrementEncounters();
      const expGain = currentEncounter.creature.getExperienceReward();
      const levelsGained = updatedPlayer.addExperience(expGain);

      setPlayer(updatedPlayer);
      savePlayerData(updatedPlayer);
      setShowEncounterModal(false);
      setCurrentEncounter(null);

      if (levelsGained > 0) {
        Alert.alert('Level Up!', `You reached level ${updatedPlayer.level}!`);
      } else {
        Alert.alert(
          'Caught!',
          `You caught ${currentEncounter.creature.name} and gained ${expGain} XP!`
        );
      }
    }
  };

  // Handle encounter fight
  const handleFight = (): void => {
    if (!currentEncounter || !player) {
      return;
    }

    // Prevent multiple victory processing for the same encounter
    if (victoryProcessedRef.current) {
      return;
    }

    const creature = currentEncounter.creature;
    
    // Check if creature is already defeated
    if (creature.isDefeated()) {
      handleVictory();
      return;
    }

    // Calculate damage: player attack - creature defense (minimum 1)
    const damage = player.calculateDamage(creature.defense);
    
    // Apply damage to creature
    creature.takeDamage(damage);

    // Update encounter with damaged creature
    const updatedEncounter = new Encounter({
      creature: creature,
      location: currentEncounter.location,
      timestamp: currentEncounter.timestamp,
      playerLevel: currentEncounter.playerLevel,
      status: currentEncounter.status,
    });
    
    setCurrentEncounter(updatedEncounter);

    // Check if creature is defeated
    if (creature.isDefeated()) {
      handleVictory();
    }
  };

  // Handle victory when creature is defeated
  const handleVictory = (): void => {
    if (!currentEncounter || !player) {
      return;
    }

    // Prevent multiple victory processing for the same encounter
    if (victoryProcessedRef.current) {
      return;
    }

    // Mark victory as being processed
    victoryProcessedRef.current = true;

    const updatedPlayer = new Player(player.toJSON());
    updatedPlayer.defeatCreature();
    updatedPlayer.incrementEncounters();
    
    const expGain = currentEncounter.creature.getExperienceReward();
    const levelsGained = updatedPlayer.addExperience(expGain);

    setPlayer(updatedPlayer);
    savePlayerData(updatedPlayer);
    setShowEncounterModal(false);
    setCurrentEncounter(null);

    if (levelsGained > 0) {
      Alert.alert(
        'Victory & Level Up!',
        `You defeated ${currentEncounter.creature.name}!\nGained ${expGain} XP\nReached level ${updatedPlayer.level}!`
      );
    } else {
      Alert.alert(
        'Victory!',
        `You defeated ${currentEncounter.creature.name} and gained ${expGain} XP!`
      );
    }
  };

  // Handle encounter flee
  const handleFlee = (): void => {
    if (currentEncounter && player) {
      const updatedPlayer = new Player(player.toJSON());
      updatedPlayer.incrementEncounters();
      setPlayer(updatedPlayer);
      savePlayerData(updatedPlayer);
    }
    setShowEncounterModal(false);
    setCurrentEncounter(null);
  };

  // Debug: Force an encounter
  const forceEncounter = (): void => {
    const location: Location = currentLocation
      ? {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        }
      : {
          latitude: 37.7749,
          longitude: -122.4194,
        };
    const encounter = EncounterService.forceEncounter(
      location,
      player?.level || 1
    );
    setCurrentEncounter(encounter);
    setShowEncounterModal(true);
    victoryProcessedRef.current = false; // Reset victory flag for new encounter
  };

  // Debug: Simulate movement (add fake distance)
  const simulateMovement = (): void => {
    const fakeDistance = 100; // meters
    const distanceData: DistanceData = {
      incremental: fakeDistance,
      total: currentDistance + fakeDistance,
    };

    // Update distance
    setCurrentDistance(distanceData.total);

    // Update player distance
    if (player) {
      const updatedPlayer = new Player(player.toJSON());
      updatedPlayer.addDistance(fakeDistance);
      setPlayer(updatedPlayer);
      savePlayerData(updatedPlayer);
    }

    // Check for encounters
    const location: Location = currentLocation
      ? {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        }
      : {
          latitude: 37.7749,
          longitude: -122.4194,
        };

    const encounter = EncounterService.processDistanceUpdate(
      distanceData,
      location,
      player?.level || 1
    );

    if (encounter) {
      setCurrentEncounter(encounter);
      setShowEncounterModal(true);
      victoryProcessedRef.current = false; // Reset victory flag for new encounter
    } else {
      Alert.alert(
        'Movement Simulated',
        `Added ${fakeDistance}m. Distance: ${distanceData.total.toFixed(0)}m`
      );
    }
  };

  // Debug: Simulate location update
  const simulateLocationUpdate = (): void => {
    const baseLat = currentLocation?.latitude || 37.7749;
    const baseLon = currentLocation?.longitude || -122.4194;

    // Move slightly (simulate walking ~10 meters)
    const newLocation: LocationData = {
      latitude: baseLat + (Math.random() - 0.5) * 0.0001, // ~10m variation
      longitude: baseLon + (Math.random() - 0.5) * 0.0001,
      accuracy: 10,
      altitude: 0,
      heading: Math.random() * 360,
      speed: 1.5, // ~5.4 km/h (walking speed in m/s)
      timestamp: Date.now(),
    };

    setCurrentLocation(newLocation);
    handleLocationUpdate(newLocation);

    // Also simulate a small distance update
    const distanceData: DistanceData = {
      incremental: 10,
      total: currentDistance + 10,
    };
    handleDistanceUpdate(distanceData);
  };

  // Debug: Force level up
  const forceLevelUp = (): void => {
    if (!player) {
      return;
    }

    const updatedPlayer = new Player(player.toJSON());
    updatedPlayer.forceLevelUp();
    setPlayer(updatedPlayer);
    savePlayerData(updatedPlayer);
    Alert.alert('Level Up!', `You are now level ${updatedPlayer.level}!`);
  };

  // Debug: Add XP manually (with preset amounts)
  const addManualXP = (amount: number): void => {
    if (!player) {
      return;
    }

    const updatedPlayer = new Player(player.toJSON());
    const levelsGained = updatedPlayer.addExperience(amount);
    setPlayer(updatedPlayer);
    savePlayerData(updatedPlayer);

    if (levelsGained > 0) {
      Alert.alert(
        'XP Added & Level Up!',
        `Added ${amount} XP!\nGained ${levelsGained} level(s)!\nYou are now level ${updatedPlayer.level}!`
      );
    } else {
      Alert.alert(
        'XP Added',
        `Added ${amount} XP!\nCurrent XP: ${updatedPlayer.experience}/${updatedPlayer.getExperienceForNextLevel()}`
      );
    }
  };

  // Debug: Reset level
  const resetLevel = (): void => {
    if (!player) {
      return;
    }

    Alert.alert(
      'Reset Level',
      'Are you sure you want to reset to level 1? This will reset your level, XP, and combat stats.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            const updatedPlayer = new Player(player.toJSON());
            updatedPlayer.resetLevel();
            setPlayer(updatedPlayer);
            savePlayerData(updatedPlayer);
            Alert.alert('Level Reset', 'You have been reset to level 1.');
          },
        },
      ]
    );
  };

  if (!player) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>Walking RPG</Text>

          <PlayerStats player={player} />

          <DistanceDisplay distance={currentDistance} />

          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: isTracking ? '#4CAF50' : '#9E9E9E' },
              ]}
            />
            <Text style={styles.statusText}>
              {isTracking ? 'Tracking Active' : 'Not Tracking'}
            </Text>
          </View>

          {currentLocation && (
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Current Location:</Text>
              <Text style={styles.locationText}>
                {currentLocation.latitude.toFixed(6)},{' '}
                {currentLocation.longitude.toFixed(6)}
              </Text>
              {currentLocation.speed > 0 && (
                <Text style={styles.speedText}>
                  Speed: {(currentLocation.speed * 3.6).toFixed(1)} km/h
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.trackButton,
              isTracking ? styles.stopButton : styles.startButton,
            ]}
            onPress={isTracking ? stopTracking : startTracking}
          >
            <Text style={styles.trackButtonText}>
              {isTracking ? 'Stop Tracking' : 'Start Walking'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.infoText}>
            Walk around to trigger random creature encounters!
          </Text>

          {/* Debug Mode Controls */}
          {debugMode && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugTitle}>🐛 Debug Mode</Text>
              <TouchableOpacity
                style={styles.debugButton}
                onPress={simulateLocationUpdate}
              >
                <Text style={styles.debugButtonText}>
                  Simulate Location Update
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.debugButton}
                onPress={simulateMovement}
              >
                <Text style={styles.debugButtonText}>
                  Simulate 100m Movement
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.debugButton, styles.forceEncounterButton]}
                onPress={forceEncounter}
              >
                <Text style={styles.debugButtonText}>Force Encounter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.debugButton, styles.levelControlButton]}
                onPress={forceLevelUp}
              >
                <Text style={styles.debugButtonText}>Force Level Up</Text>
              </TouchableOpacity>
              <View style={styles.xpButtonContainer}>
                <Text style={styles.xpButtonLabel}>Add XP:</Text>
                <TouchableOpacity
                  style={[styles.debugButton, styles.xpButton]}
                  onPress={() => addManualXP(100)}
                >
                  <Text style={styles.debugButtonText}>+100 XP</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.debugButton, styles.xpButton]}
                  onPress={() => addManualXP(500)}
                >
                  <Text style={styles.debugButtonText}>+500 XP</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.debugButton, styles.xpButton]}
                  onPress={() => addManualXP(1000)}
                >
                  <Text style={styles.debugButtonText}>+1000 XP</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.debugButton, styles.resetButton]}
                onPress={resetLevel}
              >
                <Text style={styles.debugButtonText}>Reset Level</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.debugToggle}
                onPress={() => setDebugMode(false)}
              >
                <Text style={styles.debugToggleText}>Hide Debug</Text>
              </TouchableOpacity>
            </View>
          )}

          {!debugMode && (
            <TouchableOpacity
              style={styles.debugToggle}
              onPress={() => setDebugMode(true)}
            >
              <Text style={styles.debugToggleText}>Show Debug Mode</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <EncounterModal
        encounter={currentEncounter}
        visible={showEncounterModal}
        playerAttack={player?.attack}
        onCatch={handleCatch}
        onFight={handleFight}
        onFlee={handleFlee}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginVertical: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  locationInfo: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginVertical: 8,
  },
  locationLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
  },
  speedText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  trackButton: {
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  trackButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
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

