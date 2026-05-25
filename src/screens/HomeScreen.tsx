import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import LocationService, { LocationData, DistanceData } from '../services/LocationService';
import NotificationService from '../services/NotificationService';
import AnalyticsService from '../services/AnalyticsService';
import { useAuth } from '../hooks/useAuth';
import { useAppLifecycle } from '../hooks/useAppLifecycle';
import { usePlayer } from '../hooks/usePlayer';
import { useEncounter } from '../hooks/useEncounter';
import notifee, { EventType } from '@notifee/react-native';
import { Player } from '../models/Player';
import { saveTrackingState, loadTrackingState } from '../utils/storage';
import DistanceDisplay from '../components/DistanceDisplay';
import PlayerStats from '../components/PlayerStats';
import EquipmentDisplay from '../components/Equipment';
import EncounterModal from '../components/EncounterModal';
import CombatModal from '../components/CombatModal';
import InventoryModal from '../components/InventoryModal';
import SettingsModal from '../components/SettingsModal';
import BetaIndicator from '../components/BetaIndicator';
import { APP_CONFIG } from '../constants/config';
import { ENV_CONFIG } from '../constants/environment';
import { EquipmentSlot } from '../models/Player';
import CrashlyticsService from '../services/CrashlyticsService';

/**
 * Main home screen with location tracking and encounter handling
 */
export default function HomeScreen() {
  const { player, playerRef, setPlayerAndSave, clearPlayer, initializePlayer } = usePlayer();
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [currentDistance, setCurrentDistance] = useState<number>(0);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [showInventoryModal, setShowInventoryModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [accuracyLevel, setAccuracyLevel] = useState<'high' | 'balanced' | 'battery'>('balanced');
  const [selectedEquipmentSlot, setSelectedEquipmentSlot] = useState<EquipmentSlot | null>(null);
  const [debugMode, setDebugMode] = useState<boolean>(ENV_CONFIG.enableDebugMode);

  const currentLocationRef = useRef<LocationData | null>(null);

  const { appState, appStateRef, prevAppStateRef } = useAppLifecycle();

  const {
    currentEncounter,
    showEncounterModal,
    showCombatModal,
    isEncounterModalMinimized,
    encounterChance,
    lastEncounterChance,
    isTimeBlocking,
    timeRemaining,
    bypassTimeConstraint,
    setBypassTimeConstraint,
    forceItemDrop,
    setForceItemDrop,
    isProcessingNotificationTapRef,
    checkPendingEncounter,
    handleFight,
    handleAttack,
    handleDebugDefeat,
    handleMinimize,
    handleCloseCombatModal,
    handleExpandMinimized,
    handleFlee,
    forceEncounter,
    onDistanceEncounterUpdate,
    clearEncounter,
  } = useEncounter({ playerRef, setPlayerAndSave, appStateRef, currentLocationRef });

  const {
    authUser,
    authLoading,
    initialize: initializeAuth,
    handleGoogleSignIn,
    handleAppleSignIn,
    handleSignOut,
  } = useAuth({
    onAccountChange: initializePlayer,
    onAccountSwitch: () => {
      clearPlayer();
      clearEncounter();
    },
  });

  // Resume tracking if the OS killed the app while tracking was active
  const initializeTracking = async (): Promise<void> => {
    try {
      const wasTracking = await loadTrackingState();
      if (wasTracking) {
        startTracking();
      }
    } catch (error) {
      console.error('Error resuming tracking state:', error);
    }
  };

  // Load player data and initialize notifications on mount
  useEffect(() => {
    checkPendingEncounter();
    // Auth must be ready before loadPlayerData so cloud data is available on first load
    initializeAuth();
    // initializeTracking must await initializeNotifications so the tracking
    // channel exists before startForegroundService can be called on cold-start resume
    (async () => {
      await initializeNotifications();
      await initializeTracking();
    })();
    // initializeTracking and initializePlayer are defined inside the component but are
    // intentionally run only once on mount; adding them to deps would cause re-initialization
    // on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up foreground notification event handler with proper cleanup
  useEffect(() => {
    // Background handler is registered in index.ts (must be at app level)
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS && detail.notification?.data?.type === 'encounter') {
        // User tapped encounter notification - check for pending encounter
        // Set flag to prevent appState transition from also triggering check
        // This flag is checked synchronously in the appState effect before calling checkPendingEncounter
        isProcessingNotificationTapRef.current = true;
        // Fire and forget - errors are handled in checkPendingEncounter
        checkPendingEncounter()
          .catch(error => {
            console.error('Error in notification handler:', error);
          })
          .finally(() => {
            // Clear flag after processing completes
            // Use setTimeout to ensure appState transition check (if queued) sees the flag
            setTimeout(() => {
              isProcessingNotificationTapRef.current = false;
            }, 50);
          });
      }
    });

    // Cleanup function to unsubscribe from events when component unmounts
    return () => {
      unsubscribe();
    };
    // checkPendingEncounter and isProcessingNotificationTapRef use refs internally — stable across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for pending encounters when app comes to foreground
  // Only check when transitioning TO 'active' from a different state (not on initial mount)
  // Skip if a notification tap is being processed (to avoid duplicate calls)
  useEffect(() => {
    // Only check if transitioning from non-active to active (not on initial mount)
    // Skip if notification tap is being processed (it will handle the check)
    if (
      appState === 'active' &&
      prevAppStateRef.current !== 'active' &&
      !isProcessingNotificationTapRef.current
    ) {
      checkPendingEncounter();
    }
    prevAppStateRef.current = appState;
    // prevAppStateRef is a stable ref from useAppLifecycle — not a reactive dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState]);

  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  // Initialize notification service (channel creation and permissions)
  const initializeNotifications = async (): Promise<void> => {
    try {
      await NotificationService.initialize();
      const hasPermission = await NotificationService.requestPermissions();
      if (!hasPermission) {
        console.warn('Notification permissions not granted');
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  };

  // Handle location updates
  const handleLocationUpdate = (location: LocationData): void => {
    currentLocationRef.current = location; // Update ref synchronously to avoid stale closures
    setCurrentLocation(location);
  };

  // Handle distance updates — player distance/milestones here, encounter logic delegated to useEncounter
  const handleDistanceUpdate = async (distanceData: DistanceData): Promise<void> => {
    const { incremental, total, location } = distanceData;
    setCurrentDistance(total);

    currentLocationRef.current = location;
    setCurrentLocation(location);

    const currentPlayer = playerRef.current;

    if (currentPlayer) {
      const prevTotal = currentPlayer.totalDistance;
      const updatedPlayer = new Player(currentPlayer.toJSON());
      updatedPlayer.addDistance(incremental);
      const newTotal = updatedPlayer.totalDistance;
      setPlayerAndSave(updatedPlayer);

      const MILESTONES = [1000, 5000, 10000, 25000, 50000, 100000];
      for (const milestone of MILESTONES) {
        if (prevTotal < milestone && newTotal >= milestone) {
          AnalyticsService.distanceMilestone(milestone, newTotal);
        }
      }
    }

    await onDistanceEncounterUpdate(distanceData, currentPlayer);
  };

  // Start tracking
  const startTracking = async (): Promise<void> => {
    const granted = await LocationService.requestPermission();
    if (!granted) {
      console.warn('Location permission denied — tracking not started');
      return;
    }
    LocationService.startTracking(handleLocationUpdate, handleDistanceUpdate);
    setIsTracking(true);
    saveTrackingState(true);
    AnalyticsService.trackingStarted();
    NotificationService.startForegroundService().catch(console.error);
  };

  // Stop tracking
  const stopTracking = (): void => {
    LocationService.stopTracking();
    setIsTracking(false);
    saveTrackingState(false);
    AnalyticsService.trackingStopped();
    NotificationService.stopForegroundService().catch(console.error);
  };

  // Debug: Simulate movement (add fake distance)
  const simulateMovement = (): void => {
    const fakeDistance = 100; // meters
    const baseLat = currentLocationRef.current?.latitude || 37.7749;
    const baseLon = currentLocationRef.current?.longitude || -122.4194;

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
    const baseLat = currentLocationRef.current?.latitude || 37.7749;
    const baseLon = currentLocationRef.current?.longitude || -122.4194;

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
    // Use ref to get current player state (avoids stale closure)
    const currentPlayer = playerRef.current;
    if (!currentPlayer) {
      return;
    }

    const updatedPlayer = new Player(currentPlayer.toJSON());
    updatedPlayer.forceLevelUp();

    setPlayerAndSave(updatedPlayer);
    Alert.alert('Level Up!', `You are now level ${updatedPlayer.level}!`);
  };

  // Debug: Add XP manually (with preset amounts)
  const addManualXP = (amount: number): void => {
    // Use ref to get current player state (avoids stale closure)
    const currentPlayer = playerRef.current;
    if (!currentPlayer) {
      return;
    }

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
        `Added ${amount} XP!\nCurrent XP: ${
          updatedPlayer.experience
        }/${updatedPlayer.getExperienceForNextLevel()}`,
      );
    }
  };

  // Debug: Reset level
  const resetLevel = (): void => {
    // Use ref to get current player state (avoids stale closure)
    const currentPlayer = playerRef.current;
    if (!currentPlayer) {
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
            const currentPlayerAtConfirm = playerRef.current;
            if (!currentPlayerAtConfirm) {
              return;
            }
            const updatedPlayer = new Player(currentPlayerAtConfirm.toJSON());
            updatedPlayer.resetLevel();

            setPlayerAndSave(updatedPlayer);
            Alert.alert('Level Reset', 'You have been reset to level 1.');
          },
        },
      ],
    );
  };

  // Debug: Test Crashlytics crash
  const handleTestCrash = (): void => {
    Alert.alert(
      '⚠️ Test Crash',
      'This will crash the app immediately to test Crashlytics reporting. The crash report will appear in Firebase Console within a few minutes.\n\nAre you sure you want to proceed?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Crash App',
          style: 'destructive',
          onPress: async () => {
            try {
              // Ensure Crashlytics is initialized before crashing
              if (!CrashlyticsService.isInitialized()) {
                await CrashlyticsService.initialize();
              }

              // Ensure collection is enabled
              await CrashlyticsService.setCollectionEnabled(true);

              // Set some attributes before crashing to see them in reports
              CrashlyticsService.setAttribute('test_crash', 'true');
              CrashlyticsService.setAttribute('player_level', player?.level || 0);
              CrashlyticsService.log('User initiated test crash from debug menu');

              // Small delay to ensure everything is set
              await new Promise<void>(resolve => setTimeout(() => resolve(), 200));

              // Force the crash
              await CrashlyticsService.crash();
            } catch (error) {
              console.error('Error preparing crash test:', error);
              Alert.alert(
                'Error',
                `Failed to prepare crash test: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
            }
          },
        },
      ],
    );
  };

  if (!player) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  const environmentBanner = APP_CONFIG.ENVIRONMENT_BANNER;
  const bannerVisible = environmentBanner.visible;
  const betaIndicatorProps = {
    buildType: environmentBanner.buildType,
    version: APP_CONFIG.VERSION,
    variant: environmentBanner.variant,
  } as const;

  // Apply padding based on banner position so content doesn't overlap
  // On iOS, banner is positioned below Dynamic Island (59px offset), so needs more padding
  const scrollViewContentStyle = !bannerVisible
    ? undefined
    : environmentBanner.position === 'top'
      ? Platform.OS === 'ios'
        ? styles.scrollViewWithBetaTopIOS
        : styles.scrollViewWithBetaTop
      : environmentBanner.position === 'bottom'
        ? styles.scrollViewWithBetaBottom
        : undefined;

  return (
    <SafeAreaView style={styles.container} testID="home-screen">
      {bannerVisible && (
        <BetaIndicator {...betaIndicatorProps} position={environmentBanner.position} />
      )}
      <ScrollView style={styles.scrollView} contentContainerStyle={scrollViewContentStyle}>
        <View style={styles.content}>
          <View style={styles.titleContainer}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => {
                setShowSettingsModal(true);
              }}
              activeOpacity={0.7}>
              <Text style={styles.settingsButtonText}>⚙️</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Walking RPG</Text>
          </View>

          <PlayerStats player={player} />

          <EquipmentDisplay
            equipment={player.equipment}
            onSlotPress={slot => {
              setSelectedEquipmentSlot(slot);
              setShowInventoryModal(true);
            }}
          />

          <TouchableOpacity
            style={styles.inventoryButton}
            onPress={() => {
              setSelectedEquipmentSlot(null); // Clear filter when opening normally
              setShowInventoryModal(true);
            }}>
            <Text style={styles.inventoryButtonText}>📦 View Inventory</Text>
          </TouchableOpacity>

          <DistanceDisplay distance={currentDistance} />

          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusIndicator,
                {
                  backgroundColor:
                    isTracking || LocationService.getIsTracking() ? '#4CAF50' : '#9E9E9E',
                },
              ]}
            />
            <Text style={styles.statusText}>
              {isTracking || LocationService.getIsTracking() ? 'Tracking Active' : 'Not Tracking'}
            </Text>
          </View>

          {currentLocation && (
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Current Location:</Text>
              <Text style={styles.locationText}>
                {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
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
              isTracking || LocationService.getIsTracking()
                ? styles.stopButton
                : styles.startButton,
            ]}
            onPress={isTracking || LocationService.getIsTracking() ? stopTracking : startTracking}>
            <Text style={styles.trackButtonText}>
              {isTracking || LocationService.getIsTracking() ? 'Stop Tracking' : 'Start Walking'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.infoText}>Walk around to trigger random creature encounters!</Text>

          {/* Show minimized encounter indicator */}
          {currentEncounter && isEncounterModalMinimized && !showCombatModal && (
            <TouchableOpacity
              style={styles.minimizedEncounterButton}
              onPress={handleExpandMinimized}>
              <Text style={styles.minimizedEncounterText}>
                ⚠️ Active Encounter: {currentEncounter.creature.name} (Tap to view)
              </Text>
            </TouchableOpacity>
          )}

          {/* Debug Mode Controls */}
          {debugMode && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugTitle}>🐛 Debug Mode</Text>
              {player && (
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
              )}
              <View style={styles.encounterChanceContainer}>
                <Text style={styles.encounterChanceLabel}>Encounter Chance:</Text>
                <View style={styles.encounterChanceValueContainer}>
                  <Text style={styles.encounterChanceValue}>
                    {(encounterChance * 100).toFixed(2)}%
                  </Text>
                  {isTimeBlocking && (
                    <Text style={styles.timeBlockingText}>(Blocked: {timeRemaining}s)</Text>
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
              <TouchableOpacity
                style={[styles.debugButton, styles.resetButton]}
                onPress={resetLevel}>
                <Text style={styles.debugButtonText}>Reset Level</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.debugButton, styles.crashButton]}
                onPress={handleTestCrash}>
                <Text style={styles.crashButtonText}>💥 Test Crashlytics Crash</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.debugToggle} onPress={() => setDebugMode(false)}>
                <Text style={styles.debugToggleText}>Hide Debug</Text>
              </TouchableOpacity>
            </View>
          )}

          {!debugMode && (
            <TouchableOpacity style={styles.debugToggle} onPress={() => setDebugMode(true)}>
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
        onFight={handleFight}
        onFlee={handleFlee}
        onMinimize={handleMinimize}
        debugMode={debugMode}
        onDebugDefeat={handleDebugDefeat}
      />
      <CombatModal
        encounter={currentEncounter}
        player={player}
        visible={showCombatModal}
        onAttack={handleAttack}
        onClose={handleCloseCombatModal}
      />
      <InventoryModal
        inventory={player?.inventory || []}
        player={player}
        visible={showInventoryModal}
        onClose={() => {
          setShowInventoryModal(false);
          setSelectedEquipmentSlot(null); // Clear filter when closing
        }}
        equipmentSlot={selectedEquipmentSlot}
        onItemEquipped={() => {
          if (player && playerRef.current) {
            // player has the equip mutation (inventory/equipment/recalculated stats)
            // playerRef.current has the freshest distance/XP from GPS callbacks
            // Merge: fresh base stats + mutated inventory/equipment/combat stats
            const updatedPlayer = new Player({
              ...playerRef.current.toJSON(),
              inventory: player.inventory,
              equipment: player.equipment,
              attack: player.attack,
              defense: player.defense,
              hp: player.hp,
              maxHp: player.maxHp,
            });
            setPlayerAndSave(updatedPlayer);
          }
        }}
        onItemDeleted={() => {
          if (player && playerRef.current) {
            // player has the delete mutation (inventory slot cleared)
            // playerRef.current has the freshest distance/XP from GPS callbacks
            const updatedPlayer = new Player({
              ...playerRef.current.toJSON(),
              inventory: player.inventory,
            });
            setPlayerAndSave(updatedPlayer);
          }
        }}
      />
      <SettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        accuracyLevel={accuracyLevel}
        onAccuracyLevelChange={level => {
          setAccuracyLevel(level);
          // TODO: Implement functionality to change distance interval
        }}
        authUser={authUser}
        authLoading={authLoading}
        onGoogleSignIn={handleGoogleSignIn}
        onAppleSignIn={handleAppleSignIn}
        onSignOut={handleSignOut}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollViewWithBetaTop: {
    paddingTop: 60, // Add padding when beta indicator is at top (Android)
  },
  scrollViewWithBetaTopIOS: {
    // Banner is positioned 59px from top on iOS to avoid Dynamic Island
    // Add padding for banner offset (59px) + banner height (~60-80px) ≈ 120px
    paddingTop: 120,
  },
  scrollViewWithBetaBottom: {
    paddingBottom: 60, // Add padding when beta indicator is at bottom
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  settingsButton: {
    position: 'absolute',
    left: 0,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    zIndex: 10,
  },
  settingsButtonText: {
    fontSize: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
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
  inventoryButton: {
    padding: 12,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    marginVertical: 8,
    marginHorizontal: 16,
    alignItems: 'center',
  },
  inventoryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
