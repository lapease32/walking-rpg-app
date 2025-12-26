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
import CombatModal from '../components/CombatModal';
import { AttackType, ATTACK_TYPES, ENCOUNTER_CONFIG } from '../constants/config';

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
  const [showCombatModal, setShowCombatModal] = useState<boolean>(false);
  const [debugMode, setDebugMode] = useState<boolean>(__DEV__); // Enable by default in dev mode
  const [encounterChance, setEncounterChance] = useState<number>(0); // Current encounter probability (distance-based)
  const [lastEncounterChance, setLastEncounterChance] = useState<number | null>(null); // Probability used when last encounter occurred
  const [isTimeBlocking, setIsTimeBlocking] = useState<boolean>(false); // Whether time constraint is blocking encounters
  const [timeRemaining, setTimeRemaining] = useState<number>(0); // Seconds remaining until encounters can occur
  const [bypassTimeConstraint, setBypassTimeConstraint] = useState<boolean>(false); // Whether to bypass time constraint
  const [isEncounterModalMinimized, setIsEncounterModalMinimized] = useState<boolean>(false); // Whether encounter modal is minimized
  
  // Ref to prevent multiple victory processing for the same encounter
  const victoryProcessedRef = useRef<boolean>(false);
  
  // Ref to track current player state for async callbacks
  const playerRef = useRef<Player | null>(null);
  
  // Ref to track encounter state for async callbacks (to avoid stale closures)
  const encounterRef = useRef<Encounter | null>(null);
  const isMinimizedRef = useRef<boolean>(false);
  const currentLocationRef = useRef<LocationData | null>(null);
  const showCombatModalRef = useRef<boolean>(false);

  // Load player data on mount
  useEffect(() => {
    initializePlayer();
  }, []);

  // Keep refs in sync with state
  useEffect(() => {
    playerRef.current = player;
  }, [player]);
  
  useEffect(() => {
    encounterRef.current = currentEncounter;
  }, [currentEncounter]);
  
  useEffect(() => {
    isMinimizedRef.current = isEncounterModalMinimized;
  }, [isEncounterModalMinimized]);
  
  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);
  
  useEffect(() => {
    showCombatModalRef.current = showCombatModal;
  }, [showCombatModal]);

  // Initialize encounter chance display
  useEffect(() => {
    // Use distance-based probability for display (shows probability even when time constraint blocks it)
    const currentProbability = EncounterService.getDistanceBasedProbability();
    setEncounterChance(currentProbability);
    const blocking = EncounterService.isTimeConstraintBlocking();
    setIsTimeBlocking(blocking);
    setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
    // Initialize bypass state
    setBypassTimeConstraint(EncounterService.isTimeConstraintBypassed());
  }, []);

  // Update bypass state in EncounterService when toggle changes
  useEffect(() => {
    EncounterService.setBypassTimeConstraint(bypassTimeConstraint);
    // Update blocking state when bypass changes
    const blocking = EncounterService.isTimeConstraintBlocking();
    setIsTimeBlocking(blocking);
    setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
  }, [bypassTimeConstraint]);

  // Update time remaining countdown every second when time constraint is blocking
  useEffect(() => {
    if (!isTimeBlocking) {
      return; // No interval needed if not blocking
    }

    // Update function
    const updateTimeRemaining = () => {
      const blocking = EncounterService.isTimeConstraintBlocking();
      const remaining = EncounterService.getTimeRemainingUntilEncounter();
      setIsTimeBlocking(blocking);
      setTimeRemaining(remaining);
    };

    // Update immediately (don't wait for first interval tick)
    updateTimeRemaining();

    // Then update every second
    const interval = setInterval(updateTimeRemaining, 1000);

    // Cleanup interval on unmount or when blocking stops
    return () => clearInterval(interval);
  }, [isTimeBlocking]);

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
    currentLocationRef.current = location; // Update ref synchronously to avoid stale closures
    setCurrentLocation(location);
  };

  // Handle distance updates
  const handleDistanceUpdate = (distanceData: DistanceData): void => {
    const { incremental, total, location } = distanceData;
    setCurrentDistance(total);

    // Update location ref immediately to ensure it's current for any checks
    // LocationService calls this before handleLocationUpdate, so we need the location from distanceData
    currentLocationRef.current = location;
    setCurrentLocation(location);

    // Use ref to get current player state (avoids stale closure)
    const currentPlayer = playerRef.current;
    
    // Update player distance
    if (currentPlayer) {
      const updatedPlayer = new Player(currentPlayer.toJSON());
      updatedPlayer.addDistance(incremental);
      setPlayer(updatedPlayer);
      savePlayerData(updatedPlayer); // Save periodically
    }

    // Check if encounter is minimized and user has traveled too far
    // Use refs to avoid stale closure issues, and location from distanceData (current GPS position)
    const currentEncounterState = encounterRef.current;
    const isMinimized = isMinimizedRef.current;
    const isInCombat = showCombatModalRef.current; // Use ref to avoid stale closure
    
    if (currentEncounterState && isMinimized && location && !isInCombat) {
      const encounterLocation = currentEncounterState.location;
      const distanceFromEncounter = LocationService.calculateDistance(
        encounterLocation.latitude,
        encounterLocation.longitude,
        location.latitude,
        location.longitude
      );
      
      // Auto-flee if user travels more than the threshold distance
      if (distanceFromEncounter > ENCOUNTER_CONFIG.AUTO_FLEE_DISTANCE) {
        Alert.alert(
          'Encounter Ended',
          `You traveled too far from the encounter location. The ${currentEncounterState.creature.name} has fled.`,
          [{ text: 'OK' }]
        );
        handleFlee();
        return; // Don't process new encounters after auto-flee
      }
    }

    // Don't generate new encounters if there's already an active minimized encounter
    // (The refs are already loaded above, so we can use them here)
    if (currentEncounterState && isMinimized && !isInCombat) {
      // Active minimized encounter exists - skip new encounter generation
      return;
    }

    // Check for encounters (use location from distanceData, which is the current GPS position)
    const currentLocationData = location;
    if (currentLocationData) {
      const locationForEncounter: Location = {
        latitude: currentLocationData.latitude,
        longitude: currentLocationData.longitude,
      };
      
      // Get probability that will be used (after incremental distance is added in processDistanceUpdate)
      const probabilityThatWillBeUsed = EncounterService.getProbabilityAfterIncremental(
        distanceData.incremental
      );
      
      const encounter = EncounterService.processDistanceUpdate(
        distanceData,
        locationForEncounter,
        currentPlayer?.level || 1
      );

      if (encounter) {
        setCurrentEncounter(encounter);
        setShowEncounterModal(true);
        setIsEncounterModalMinimized(false); // Reset minimized state for new encounter
        victoryProcessedRef.current = false; // Reset victory flag for new encounter
        // Encounter generated - distance tracking was reset, so chance is now 0
        setEncounterChance(0);
        // Store the probability that was used when this encounter occurred
        setLastEncounterChance(probabilityThatWillBeUsed);
        // Update time blocking state (encounter just occurred, so time constraint is now active)
        const blocking = EncounterService.isTimeConstraintBlocking();
        setIsTimeBlocking(blocking);
        setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
      } else {
        // Update encounter chance display (use distance-based for debugging visibility)
        const currentProbability = EncounterService.getDistanceBasedProbability();
        setEncounterChance(currentProbability);
        const blocking = EncounterService.isTimeConstraintBlocking();
        setIsTimeBlocking(blocking);
        setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
      }
    } else {
      // Update encounter chance even without location (use distance-based for debugging visibility)
      const currentProbability = EncounterService.getDistanceBasedProbability();
      setEncounterChance(currentProbability);
      const blocking = EncounterService.isTimeConstraintBlocking();
      setIsTimeBlocking(blocking);
      setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
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
      setIsEncounterModalMinimized(false);
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

  // Handle encounter fight - opens combat modal
  const handleFight = (): void => {
    if (!currentEncounter || !player) {
      return;
    }

    // Check if player is already defeated
    if (player.isDefeated()) {
      return; // Can't fight if player is defeated
    }

    const creature = currentEncounter.creature;
    
    // Check if creature is already defeated
    if (creature.isDefeated()) {
      handleVictory();
      return;
    }

    // Open combat modal
    setShowCombatModal(true);
  };

  // Handle attack execution with specific attack type
  const handleAttack = (attackType: AttackType): void => {
    if (!currentEncounter || !player) {
      return;
    }

    // Prevent multiple victory processing for the same encounter
    if (victoryProcessedRef.current) {
      return;
    }

    const creature = currentEncounter.creature;
    
    // Defensive check: creature should not be defeated at this point
    // (handleFight already checked, but state could have changed)
    if (creature.isDefeated()) {
      handleVictory();
      setShowCombatModal(false);
      return;
    }

    // Create updated player instance for modifications
    const updatedPlayer = new Player(player.toJSON());

    // Get attack configuration
    const attackConfig = ATTACK_TYPES[attackType];

    // Player attacks creature with selected attack type
    // Calculate damage: (player attack - creature defense) * multiplier (minimum 1)
    const playerDamage = updatedPlayer.calculateDamage(
      creature.defense,
      attackConfig.damageMultiplier
    );
    
    // Apply damage to creature
    creature.takeDamage(playerDamage);

    // Creature attacks back (if not defeated by player's attack)
    if (!creature.isDefeated()) {
      // Calculate damage: creature attack - player defense (minimum 1)
      const creatureDamage = creature.calculateDamage(updatedPlayer.defense);
      
      // Apply damage to player
      updatedPlayer.takeDamage(creatureDamage);
    }

    // Update player state
    setPlayer(updatedPlayer);
    savePlayerData(updatedPlayer);

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
      setShowCombatModal(false);
      setShowEncounterModal(false);
      handleVictory(updatedPlayer);
    } else if (updatedPlayer.isDefeated()) {
      // Handle player defeat - heal immediately before showing alert
      // This ensures healing happens even if alert is dismissed on Android
      const healedPlayer = new Player(updatedPlayer.toJSON());
      healedPlayer.fullHeal();
      healedPlayer.incrementEncounters(); // Count the encounter like other outcomes
      setPlayer(healedPlayer);
      savePlayerData(healedPlayer);
      
      setShowCombatModal(false);
      setShowEncounterModal(false);
      
      // Show alert for user feedback (healing already done)
      Alert.alert(
        'Defeated!',
        'You have been defeated! Your HP has been restored to full.',
        [
          {
            text: 'OK',
            onPress: () => {
              setCurrentEncounter(null);
            },
          },
        ],
        { cancelable: false } // Prevent dismissal on Android to ensure modal closes properly
      );
    }
  };

  // Handle victory when creature is defeated
  const handleVictory = (playerToUse?: Player): void => {
    // Use provided player or fall back to ref player (avoids stale closure)
    const basePlayer = playerToUse || playerRef.current;
    const currentEncounterState = encounterRef.current;
    
    if (!currentEncounterState || !basePlayer) {
      return;
    }

    // Prevent multiple victory processing for the same encounter
    if (victoryProcessedRef.current) {
      return;
    }

    // Mark victory as being processed
    victoryProcessedRef.current = true;

    const updatedPlayer = new Player(basePlayer.toJSON());
    updatedPlayer.defeatCreature();
    updatedPlayer.incrementEncounters();
    
    const expGain = currentEncounterState.creature.getExperienceReward();
    const levelsGained = updatedPlayer.addExperience(expGain);

    setPlayer(updatedPlayer);
    savePlayerData(updatedPlayer);
    setIsEncounterModalMinimized(false);
    setShowCombatModal(false);
    setShowEncounterModal(false);
    setCurrentEncounter(null);

    if (levelsGained > 0) {
      Alert.alert(
        'Victory & Level Up!',
        `You defeated ${currentEncounterState.creature.name}!\nGained ${expGain} XP\nReached level ${updatedPlayer.level}!`
      );
    } else {
      Alert.alert(
        'Victory!',
        `You defeated ${currentEncounterState.creature.name} and gained ${expGain} XP!`
      );
    }
  };

  // Handle encounter minimize (close modal without fleeing)
  const handleMinimize = (): void => {
    setIsEncounterModalMinimized(true);
    setShowEncounterModal(false);
  };

  // Handle encounter flee
  const handleFlee = (): void => {
    // Use refs to get current state (avoids stale closure)
    const currentPlayer = playerRef.current;
    const currentEncounterState = encounterRef.current;
    if (currentEncounterState && currentPlayer) {
      const updatedPlayer = new Player(currentPlayer.toJSON());
      updatedPlayer.incrementEncounters();
      setPlayer(updatedPlayer);
      savePlayerData(updatedPlayer);
    }
    setIsEncounterModalMinimized(false);
    setShowCombatModal(false);
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
    setIsEncounterModalMinimized(false); // Reset minimized state for new encounter
    victoryProcessedRef.current = false; // Reset victory flag for new encounter
    // Encounter forced - distance tracking was reset, so chance is now 0
    setEncounterChance(0);
    // Update time blocking state (encounter just occurred, so time constraint is now active)
    const blocking = EncounterService.isTimeConstraintBlocking();
    setIsTimeBlocking(blocking);
    setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
  };

  // Debug: Simulate movement (add fake distance)
  const simulateMovement = (): void => {
    const fakeDistance = 100; // meters
    const baseLat = currentLocation?.latitude || 37.7749;
    const baseLon = currentLocation?.longitude || -122.4194;
    
    // Simulate location movement: move ~100m north (approximately 0.0009 degrees latitude)
    // 1 degree latitude ≈ 111,000 meters, so 100m ≈ 0.0009 degrees
    const latOffset = fakeDistance / 111000; // Move north
    const newLocation: LocationData = {
      latitude: baseLat + latOffset,
      longitude: baseLon,
      accuracy: 10,
      altitude: 0,
      heading: 0,
      speed: 0,
      timestamp: Date.now(),
    };
    
    // Check for auto-flee BEFORE updating location (use refs to get current state)
    const currentEncounterState = encounterRef.current;
    const isMinimized = isMinimizedRef.current;
    const isInCombat = showCombatModalRef.current; // Use ref to avoid stale closure
    
    if (currentEncounterState && isMinimized && !isInCombat) {
      const encounterLocation = currentEncounterState.location;
      const distanceFromEncounter = LocationService.calculateDistance(
        encounterLocation.latitude,
        encounterLocation.longitude,
        newLocation.latitude,
        newLocation.longitude
      );
      
      // Auto-flee if user travels more than the threshold distance
      if (distanceFromEncounter > ENCOUNTER_CONFIG.AUTO_FLEE_DISTANCE) {
        Alert.alert(
          'Encounter Ended',
          `You traveled too far from the encounter location. The ${currentEncounterState.creature.name} has fled.`,
          [{ text: 'OK' }]
        );
        handleFlee();
        return; // Don't process movement after auto-flee
      }
    }
    
    // Create distance data with location (location will be set in handleDistanceUpdate)
    const distanceData: DistanceData = {
      incremental: fakeDistance,
      total: currentDistance + fakeDistance,
      location: newLocation, // Include location so handleDistanceUpdate uses current position
    };

    // Call handleDistanceUpdate which will update player distance and check for encounters
    // handleDistanceUpdate will update the location ref and state
    handleDistanceUpdate(distanceData);
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

    // Also simulate a small distance update
    const distanceData: DistanceData = {
      incremental: 10,
      total: currentDistance + 10,
      location: newLocation, // Include location so handleDistanceUpdate uses current position
    };
    // handleDistanceUpdate will update the location ref and state
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
            // Use ref to get current player state at confirmation time, not when dialog was shown
            const currentPlayer = playerRef.current;
            if (!currentPlayer) {
              return;
            }
            const updatedPlayer = new Player(currentPlayer.toJSON());
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

          {/* Show minimized encounter indicator */}
          {currentEncounter && isEncounterModalMinimized && !showCombatModal && (
            <TouchableOpacity
              style={styles.minimizedEncounterButton}
              onPress={() => {
                setIsEncounterModalMinimized(false);
                setShowEncounterModal(true);
              }}
            >
              <Text style={styles.minimizedEncounterText}>
                ⚠️ Active Encounter: {currentEncounter.creature.name} (Tap to view)
              </Text>
            </TouchableOpacity>
          )}

          {/* Debug Mode Controls */}
          {debugMode && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugTitle}>🐛 Debug Mode</Text>
              <View style={styles.encounterChanceContainer}>
                <Text style={styles.encounterChanceLabel}>Encounter Chance:</Text>
                <View style={styles.encounterChanceValueContainer}>
                  <Text style={styles.encounterChanceValue}>
                    {(encounterChance * 100).toFixed(2)}%
                  </Text>
                  {isTimeBlocking && (
                    <Text style={styles.timeBlockingText}>
                      (Blocked: {timeRemaining}s)
                    </Text>
                  )}
                </View>
              </View>
              {lastEncounterChance !== null && (
                <View style={styles.encounterChanceContainer}>
                  <Text style={styles.encounterChanceLabel}>Last Encounter @:</Text>
                  <Text style={styles.encounterChanceValue}>
                    {(lastEncounterChance * 100).toFixed(2)}%
                  </Text>
                </View>
              )}
              <View style={styles.encounterChanceContainer}>
                <Text style={styles.encounterChanceLabel}>Bypass Time Constraint:</Text>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    bypassTimeConstraint && styles.toggleButtonActive,
                  ]}
                  onPress={() => setBypassTimeConstraint(!bypassTimeConstraint)}
                >
                  <Text style={styles.toggleButtonText}>
                    {bypassTimeConstraint ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>
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
        visible={showEncounterModal && !showCombatModal}
        playerAttack={player?.attack}
        playerDefense={player?.defense}
        playerHp={player?.hp}
        playerMaxHp={player?.maxHp}
        onCatch={handleCatch}
        onFight={handleFight}
        onFlee={handleFlee}
        onMinimize={handleMinimize}
      />
      <CombatModal
        encounter={currentEncounter}
        player={player}
        visible={showCombatModal}
        onAttack={handleAttack}
        onClose={() => setShowCombatModal(false)}
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
  minimizedEncounterButton: {
    padding: 12,
    backgroundColor: '#FF9800',
    borderRadius: 8,
    marginVertical: 8,
    alignItems: 'center',
  },
  minimizedEncounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

