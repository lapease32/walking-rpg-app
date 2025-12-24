import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import LocationService from '../services/LocationService';
import EncounterService from '../services/EncounterService';
import { Player } from '../models/Player';
import { savePlayerData, loadPlayerData } from '../utils/storage';
import DistanceDisplay from '../components/DistanceDisplay';
import PlayerStats from '../components/PlayerStats';
import EncounterModal from '../components/EncounterModal';

/**
 * Main home screen with location tracking and encounter handling
 */
export default function HomeScreen() {
  const [player, setPlayer] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentEncounter, setCurrentEncounter] = useState(null);
  const [showEncounterModal, setShowEncounterModal] = useState(false);

  // Load player data on mount
  useEffect(() => {
    initializePlayer();
  }, []);

  const initializePlayer = async () => {
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
  const handleLocationUpdate = (location) => {
    setCurrentLocation(location);
  };

  // Handle distance updates
  const handleDistanceUpdate = (distanceData) => {
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
      const encounter = EncounterService.processDistanceUpdate(
        distanceData,
        currentLocation,
        player?.level || 1
      );

      if (encounter) {
        setCurrentEncounter(encounter);
        setShowEncounterModal(true);
      }
    }
  };

  // Start tracking
  const startTracking = () => {
    LocationService.startTracking(handleLocationUpdate, handleDistanceUpdate);
    setIsTracking(true);
  };

  // Stop tracking
  const stopTracking = () => {
    LocationService.stopTracking();
    setIsTracking(false);
  };

  // Handle encounter catch
  const handleCatch = () => {
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

  // Handle encounter fight (placeholder)
  const handleFight = () => {
    Alert.alert('Combat System', 'Combat system coming soon!');
    // TODO: Implement combat system
  };

  // Handle encounter flee
  const handleFlee = () => {
    if (currentEncounter && player) {
      const updatedPlayer = new Player(player.toJSON());
      updatedPlayer.incrementEncounters();
      setPlayer(updatedPlayer);
      savePlayerData(updatedPlayer);
    }
    setShowEncounterModal(false);
    setCurrentEncounter(null);
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
        </View>
      </ScrollView>

      <EncounterModal
        encounter={currentEncounter}
        visible={showEncounterModal}
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
});

