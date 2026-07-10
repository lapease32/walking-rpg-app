import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
  InteractionManager,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import LocationService, { DistanceData } from '../services/LocationService';
import { SettingsIcon, InventoryIcon, WarningIcon } from '../components/icons/UiIcon';
import NotificationService from '../services/NotificationService';
import AnalyticsService from '../services/AnalyticsService';
import { useAuth } from '../hooks/useAuth';
import { useAppLifecycle } from '../hooks/useAppLifecycle';
import { usePlayer } from '../hooks/usePlayer';
import { useEncounter } from '../hooks/useEncounter';
import { useLocation } from '../hooks/useLocation';
import { useDebugActions } from '../hooks/useDebugActions';
import { useAutoResolveSetting } from '../hooks/useAutoResolveSetting';
import notifee, { EventType } from '@notifee/react-native';
import { Player } from '../models/Player';
import { loadTrackingState } from '../utils/storage';
import DistanceDisplay from '../components/DistanceDisplay';
import PlayerStats from '../components/PlayerStats';
import EquipmentDisplay from '../components/Equipment';
import EncounterModal from '../components/EncounterModal';
import CombatModal from '../components/CombatModal';
import RewardRevealModal from '../components/RewardRevealModal';
import WalkSummaryModal from '../components/WalkSummaryModal';
import WorthyFoeCard from '../components/WorthyFoeCard';
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
    repaintToken,
  } = usePlayer();
  const [showInventoryModal, setShowInventoryModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
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

  const { autoResolveBelowRare, setAutoResolveBelowRare, autoResolveBelowRareRef } =
    useAutoResolveSetting();

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
    forcedRarity,
    setForcedRarity,
    debugPreviewReveal,
    playerCombatState,
    playerCombatStateRef,
    combatHits,
    isEnemyTurn,
    rewardReveal,
    dismissReward,
    walkSummary,
    checkWalkSummary,
    dismissWalkSummary,
    heldFoe,
    refreshHeldFoe,
    engageHeldFoe,
    handleFight,
    handleAbility,
    handleDebugDefeat,
    handleMinimize,
    handleCloseCombatModal,
    handleExpandMinimized,
    handleFlee,
    handleAutoResolve,
    forceEncounter,
    debugForceIdleEncounter,
    debugForceEliteEncounter,
    debugSimulateWalk,
    debugShowWalkSummary,
    onDistanceEncounterUpdate,
    clearEncounter,
  } = useEncounter({
    playerRef,
    setPlayerAndSave,
    appStateRef,
    currentLocationRef,
    autoResolveBelowRareRef,
  });

  const {
    authUser,
    authLoading,
    conflictState,
    resolveConflict,
    initialize: initializeAuth,
    handleGoogleSignIn,
    handleAppleSignIn,
    handleSignOut,
    handleDeleteAccount,
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
    // Surface a held "worthy foe" (inline card) and the walk summary from a prior backgrounded
    // session. Independent — the foe is a card, not a modal, so no sequencing is needed.
    refreshHeldFoe();
    checkWalkSummary();
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
        // Tapped a "worthy foe" notification — surface the inline card (non-modal; idempotent).
        refreshHeldFoe().catch(error => {
          console.error('Error handling worthy-foe notification:', error);
        });
      } else if (type === EventType.PRESS && detail.notification?.data?.type === 'walk_summary') {
        // Tapped the passive-victory notification — show the "while you walked" recap.
        checkWalkSummary().catch(error => {
          console.error('Error handling walk summary notification:', error);
        });
      }
    });

    // Cleanup function to unsubscribe from events when component unmounts
    return () => {
      unsubscribe();
    };
    // refreshHeldFoe / checkWalkSummary use refs internally — stable across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for pending encounters when app comes to foreground
  // Only check when transitioning TO 'active' from a different state (not on initial mount)
  // Skip if a notification tap is being processed (to avoid duplicate calls)
  useEffect(() => {
    // Only check if transitioning from non-active to active (not on initial mount)
    // Skip if notification tap is being processed (it will handle the check)
    if (appState === 'active' && prevAppStateRef.current !== 'active') {
      // On foreground: refresh the held "worthy foe" card and drain the walk summary. Independent —
      // the foe is a card (not a modal), so nothing to sequence.
      refreshHeldFoe();
      checkWalkSummary();
    }
    prevAppStateRef.current = appState;
    // prevAppStateRef is a stable ref from useAppLifecycle — not a reactive dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState]);

  // Cold-start: create the notification CHANNEL only — do NOT request permission here.
  // notifee.requestPermission() launches the system permission dialog, which steals
  // foreground and pauses MainActivity mid-cold-start; on Android New Arch that can
  // drop the first screen's Fabric commit and strand a new user on "Loading…" (the
  // long-standing E2E-Android flake, and a real Android 13+ first-launch risk). The
  // permission is requested after first paint instead (the player-gated effect below).
  // The channel must still exist now so startForegroundService can post to it on a
  // cold-start tracking resume.
  const initializeNotifications = async (): Promise<void> => {
    try {
      await NotificationService.initialize();
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  };

  // Request notification permission only AFTER the first real screen has painted.
  // Gated on player PRESENCE (not the player object): a new user is asked once they've
  // picked an archetype and landed on the home screen — never during cold-start.
  // Depending on `hasPlayer` rather than `player` is deliberate — `player` is replaced
  // on every distance save (setPlayerAndSave), and depending on it would cancel and
  // reschedule the InteractionManager task on every GPS update during a tracking resume,
  // starving the prompt. `hasPlayer` only flips false→true once. InteractionManager
  // defers until UI interactions settle; the ref makes it fire exactly once.
  const notifPermissionRequestedRef = useRef(false);
  const hasPlayer = player !== null;
  useEffect(() => {
    if (notifPermissionRequestedRef.current || !hasPlayer) {
      return;
    }
    const task = InteractionManager.runAfterInteractions(() => {
      // Set the guard inside the callback (not before scheduling): if the effect
      // re-runs before interactions settle, the cleanup cancels this task and the
      // re-run reschedules it — so the request is never silently lost.
      if (notifPermissionRequestedRef.current) {
        return;
      }
      notifPermissionRequestedRef.current = true;
      NotificationService.requestPermissions()
        .then(granted => {
          if (!granted) {
            console.warn('Notification permissions not granted');
          }
        })
        .catch(error => console.error('Error requesting notification permissions:', error));
    });
    return () => task.cancel();
  }, [hasPlayer]);

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

  // Debug-mode controller — owns the debug action logic + re-groups encounter-domain debug
  // config so DebugPanel stays presentational. Called before the early returns below to keep
  // hook order stable; the work it returns is only rendered when ENV_CONFIG.enableDebugMode.
  const debug = useDebugActions({
    playerRef,
    setPlayerAndSave,
    currentDistance,
    currentLocation,
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
    forcedRarity,
    setForcedRarity,
    forceEncounter,
    debugForceIdleEncounter,
    debugForceEliteEncounter,
    debugSimulateWalk,
    debugShowWalkSummary,
    debugPreviewReveal,
  });

  if (needsArchetypeSelection) {
    // Key on repaintToken so an 'active' transition remounts this screen, recovering
    // a Fabric mount dropped during a cold-start pause (see usePlayer belt-and-suspenders).
    return <ArchetypeSelectionScreen key={repaintToken} onSelect={handleArchetypeSelected} />;
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
  // Real app version + build number from the native bundle (CFBundleShortVersionString /
  // CFBundleVersion on iOS, versionName / versionCode on Android). The build number auto-increments
  // per release, so this actually changes — unlike the old hardcoded string.
  const appVersionLabel = `${DeviceInfo.getVersion()} (build ${DeviceInfo.getBuildNumber()})`;
  const betaIndicatorProps = {
    buildType: environmentBanner.buildType,
    version: appVersionLabel,
    variant: environmentBanner.variant,
  } as const;

  // The top banner is absolute + high zIndex. Offset the ScrollView FRAME (not just its content)
  // below it, so a pinned sticky header (the worthy-foe card) starts under the banner rather than
  // behind it. A bottom banner just pads the content.
  const bannerIsTop = bannerVisible && environmentBanner.position === 'top';
  const scrollViewFrameStyle = bannerIsTop
    ? [
        styles.scrollView,
        Platform.OS === 'ios' ? styles.scrollViewBetaTopOffsetIOS : styles.scrollViewBetaTopOffset,
      ]
    : styles.scrollView;
  const scrollViewContentStyle =
    bannerVisible && environmentBanner.position !== 'top'
      ? styles.scrollViewWithBetaBottom
      : undefined;

  // The worthy-foe card is a sticky scroll header — inline until scrolled past, then pinned to the
  // top of the list. stickyHeaderIndices targets a DIRECT ScrollView child, so the card is its own
  // top-level child at index 1 (after the title/stats block) ONLY when a foe is held; with no foe
  // it isn't rendered and there's no sticky index.
  const stickyFoeIndices = heldFoe ? [1] : undefined;

  return (
    <SafeAreaView style={styles.container} testID="home-screen">
      {bannerVisible && (
        <BetaIndicator {...betaIndicatorProps} position={environmentBanner.position} />
      )}
      <ScrollView
        style={scrollViewFrameStyle}
        contentContainerStyle={scrollViewContentStyle}
        stickyHeaderIndices={stickyFoeIndices}>
        <View style={styles.contentTop}>
          <View style={styles.titleContainer}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => {
                setShowSettingsModal(true);
              }}
              activeOpacity={0.7}>
              <SettingsIcon size={22} color="#444" />
            </TouchableOpacity>
            <Text style={styles.title}>StrideQuest</Text>
          </View>

          <PlayerStats player={player} />
        </View>

        {heldFoe && (
          <View style={styles.stickyFoeWrap}>
            <WorthyFoeCard foe={heldFoe} onFight={engageHeldFoe} />
          </View>
        )}

        <View style={styles.contentRest}>
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
            <View style={styles.inventoryButtonRow}>
              <InventoryIcon size={18} color="#fff" />
              <Text style={styles.inventoryButtonText}> View Inventory</Text>
            </View>
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
              <View style={styles.minimizedEncounterRow}>
                <WarningIcon size={15} color="#fff" />
                <Text style={styles.minimizedEncounterText}>
                  {' '}
                  Active Encounter: {currentEncounter.creature.name} (Tap to view)
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <DebugPanel
            debugMode={debugMode}
            onToggleDebug={setDebugMode}
            player={player}
            debug={debug}
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
        onAutoResolve={handleAutoResolve}
        onMinimize={handleMinimize}
        debugMode={ENV_CONFIG.enableDebugMode && debugMode}
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
        combatHits={combatHits}
        isEnemyTurn={isEnemyTurn}
      />
      <RewardRevealModal reveal={rewardReveal} onDismiss={dismissReward} />
      <WalkSummaryModal entries={walkSummary} onDismiss={dismissWalkSummary} />
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
        authUser={authUser}
        authLoading={authLoading}
        onGoogleSignIn={handleGoogleSignIn}
        onAppleSignIn={handleAppleSignIn}
        onSignOut={handleSignOut}
        onDeleteAccount={handleDeleteAccount}
        autoResolveBelowRare={autoResolveBelowRare}
        onToggleAutoResolveBelowRare={setAutoResolveBelowRare}
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
  // Offset the ScrollView FRAME below the absolute top banner so a pinned sticky header clears it.
  scrollViewBetaTopOffset: {
    marginTop: 60, // banner height (Android; banner sits at top: 0)
  },
  scrollViewBetaTopOffsetIOS: {
    marginTop: 120, // banner offset from Dynamic Island (59) + banner height (~60)
  },
  scrollViewWithBetaBottom: {
    paddingBottom: 60, // Add padding when beta indicator is at bottom
  },
  scrollView: {
    flex: 1,
  },
  contentTop: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // Opaque wrapper (matches the screen bg) so that when the worthy-foe card is pinned (sticky),
  // scrolled content never shows through around the card's own margins.
  stickyFoeWrap: {
    backgroundColor: '#f5f5f5',
  },
  contentRest: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  inventoryButtonRow: {
    flexDirection: 'row',
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
  minimizedEncounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  minimizedEncounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
