import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import LocationService, { DistanceData } from '../services/LocationService';
import NotificationService from '../services/NotificationService';
import AnalyticsService from '../services/AnalyticsService';
import { useAuth } from '../hooks/useAuth';
import { useAppLifecycle } from '../hooks/useAppLifecycle';
import { usePlayer } from '../hooks/usePlayer';
import { useEncounter } from '../hooks/useEncounter';
import { useLocation } from '../hooks/useLocation';
import notifee, { EventType } from '@notifee/react-native';
import { Player } from '../models/Player';
import { loadTrackingState } from '../utils/storage';
import DistanceDisplay from '../components/DistanceDisplay';
import PlayerStats from '../components/PlayerStats';
import EquipmentDisplay from '../components/Equipment';
import EncounterModal from '../components/EncounterModal';
import CombatModal from '../components/CombatModal';
import InventoryModal from '../components/InventoryModal';
import SettingsModal from '../components/SettingsModal';
import BetaIndicator from '../components/BetaIndicator';
import DebugPanel from '../components/DebugPanel';
import { AccountConflictModal } from '../components/AccountConflictModal';
import ArchetypeSelectionScreen from '../components/ArchetypeSelectionScreen';
import { APP_CONFIG } from '../constants/config';
import { ENV_CONFIG } from '../constants/environment';
import { EquipmentSlot } from '../models/Player';

/**
 * Main home screen with location tracking and encounter handling
 */
export default function HomeScreen() {
  const {
    player,
    playerRef,
    setPlayerAndSave,
    clearPlayer,
    initializePlayer,
    needsArchetypeSelection,
    handleArchetypeSelected,
  } = usePlayer();
  const [showInventoryModal, setShowInventoryModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [accuracyLevel, setAccuracyLevel] = useState<'high' | 'balanced' | 'battery'>('balanced');
  const [selectedEquipmentSlot, setSelectedEquipmentSlot] = useState<EquipmentSlot | null>(null);
  const [debugMode, setDebugMode] = useState<boolean>(ENV_CONFIG.enableDebugMode);

  const {
    isTracking,
    currentDistance,
    setCurrentDistance,
    currentLocation,
    setCurrentLocation,
    currentLocationRef,
    startTracking,
    stopTracking,
  } = useLocation();

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
    playerCombatState,
    playerCombatStateRef,
    isProcessingNotificationTapRef,
    checkPendingEncounter,
    handleFight,
    handleAbility,
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
    conflictState,
    resolveConflict,
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
        await startTracking(handleDistanceUpdate);
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

  if (needsArchetypeSelection) {
    return <ArchetypeSelectionScreen onSelect={handleArchetypeSelected} />;
  }

  if (!player) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
        {conflictState && (
          <AccountConflictModal conflictState={conflictState} onResolve={resolveConflict} />
        )}
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
            onPress={
              isTracking || LocationService.getIsTracking()
                ? stopTracking
                : () => startTracking(handleDistanceUpdate)
            }>
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

          <DebugPanel
            debugMode={debugMode}
            onToggleDebug={setDebugMode}
            player={player}
            playerRef={playerRef}
            setPlayerAndSave={setPlayerAndSave}
            currentDistance={currentDistance}
            currentLocationRef={currentLocationRef}
            handleDistanceUpdate={handleDistanceUpdate}
            encounterChance={encounterChance}
            lastEncounterChance={lastEncounterChance}
            isTimeBlocking={isTimeBlocking}
            timeRemaining={timeRemaining}
            bypassTimeConstraint={bypassTimeConstraint}
            setBypassTimeConstraint={setBypassTimeConstraint}
            forceItemDrop={forceItemDrop}
            setForceItemDrop={setForceItemDrop}
            forceEncounter={forceEncounter}
          />
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
        onAbility={handleAbility}
        onClose={handleCloseCombatModal}
        playerCombatState={playerCombatState}
        playerCombatStateRef={playerCombatStateRef}
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
      {conflictState && (
        <AccountConflictModal conflictState={conflictState} onResolve={resolveConflict} />
      )}
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
