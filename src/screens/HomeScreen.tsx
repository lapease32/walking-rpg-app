import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  AppState,
  AppStateStatus,
  Platform,
  Settings,
} from 'react-native';

// Detox E2E mode: disable animations that keep the Detox idle queue busy on slow CI simulators
const isE2E = Platform.OS === 'ios' && Settings.get('DetoxE2E') === 'YES';
import LocationService, { LocationData, DistanceData } from '../services/LocationService';
import EncounterService from '../services/EncounterService';
import NotificationService from '../services/NotificationService';
import AuthService, { AuthUser } from '../services/AuthService';
import AnalyticsService from '../services/AnalyticsService';
import notifee, { EventType } from '@notifee/react-native';
import { dropItem } from '../services/LootService';
import { Player } from '../models/Player';
import { Encounter } from '../models/Encounter';
import { Location } from '../models/Encounter';
import { Creature } from '../models/Creature';
import {
  savePlayerData,
  loadPlayerData,
  loadPendingEncounter,
  clearPendingEncounter,
  savePendingEncounter,
  saveTrackingState,
  loadTrackingState,
  clearLocalPlayerData,
  EncounterData,
} from '../utils/storage';
import DistanceDisplay from '../components/DistanceDisplay';
import PlayerStats from '../components/PlayerStats';
import EquipmentDisplay from '../components/Equipment';
import EncounterModal from '../components/EncounterModal';
import CombatModal from '../components/CombatModal';
import InventoryModal from '../components/InventoryModal';
import SettingsModal from '../components/SettingsModal';
import BetaIndicator from '../components/BetaIndicator';
import { AttackType, ATTACK_TYPES, ENCOUNTER_CONFIG, APP_CONFIG } from '../constants/config';
import { ENV_CONFIG } from '../constants/environment';
import { EquipmentSlot } from '../models/Player';
import CrashlyticsService from '../services/CrashlyticsService';

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
  const [showInventoryModal, setShowInventoryModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [accuracyLevel, setAccuracyLevel] = useState<'high' | 'balanced' | 'battery'>('balanced');
  const [selectedEquipmentSlot, setSelectedEquipmentSlot] = useState<EquipmentSlot | null>(null);
  const [debugMode, setDebugMode] = useState<boolean>(ENV_CONFIG.enableDebugMode); // Enable based on environment
  const [forceItemDrop, setForceItemDrop] = useState<boolean>(false); // Debug toggle to force item drops
  const [encounterChance, setEncounterChance] = useState<number>(0); // Current encounter probability (distance-based)
  const [lastEncounterChance, setLastEncounterChance] = useState<number | null>(null); // Probability used when last encounter occurred
  const [isTimeBlocking, setIsTimeBlocking] = useState<boolean>(false); // Whether time constraint is blocking encounters
  const [timeRemaining, setTimeRemaining] = useState<number>(0); // Seconds remaining until encounters can occur
  const [bypassTimeConstraint, setBypassTimeConstraint] = useState<boolean>(false); // Whether to bypass time constraint
  const [isEncounterModalMinimized, setIsEncounterModalMinimized] = useState<boolean>(false); // Whether encounter modal is minimized
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState); // Track app state (foreground/background)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Ref to prevent multiple victory processing for the same encounter
  const victoryProcessedRef = useRef<boolean>(false);

  // Ref to track app state for async callbacks (avoids stale closure)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Ref to prevent multiple flee processing for the same encounter
  const fleeProcessedRef = useRef<boolean>(false);

  // Ref to prevent concurrent checkPendingEncounter calls (race condition protection)
  const isCheckingPendingEncounterRef = useRef<boolean>(false);

  // Ref to track previous app state (to detect transitions, not initial mount)
  const prevAppStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Ref to track if a notification tap is being processed (to skip appState transition check)
  const isProcessingNotificationTapRef = useRef<boolean>(false);

  // Ref to track current player state for async callbacks
  const playerRef = useRef<Player | null>(null);

  // Ref to track encounter state for async callbacks (to avoid stale closures)
  const encounterRef = useRef<Encounter | null>(null);
  const isMinimizedRef = useRef<boolean>(false);
  const currentLocationRef = useRef<LocationData | null>(null);
  const showCombatModalRef = useRef<boolean>(false);
  const prevUidRef = useRef<string | null>(null);
  // True once any non-null UID has been observed in this session. Used to distinguish
  // the auth-init-timeout scenario (never had a UID) from sign-out → re-sign-in (had
  // a UID, then it went null, then a new one arrived).
  const hadUserRef = useRef<boolean>(false);
  // True while a late-auth or account-switch reload is in flight. Blocks the
  // player→playerRef useEffect so stale React state cannot repopulate the ref
  // before initializePlayer has written the freshly-loaded player.
  const isReloadingRef = useRef<boolean>(false);
  // Monotonic counter incremented every time a new reload is triggered. Each
  // initializePlayer call captures it at entry and only clears isReloadingRef
  // when the counter hasn't changed — preventing an earlier reload from
  // prematurely re-enabling saves if a newer reload started before it finished.
  const activeReloadIdRef = useRef<number>(0);
  // Distance (metres) accumulated via GPS while a late-auth reload is in flight.
  // Saves are blocked during reload to prevent stale writes; this ref preserves the
  // distance so it can be merged into the freshly-loaded player when reload completes.
  const pendingReloadDistanceRef = useRef<number>(0);
  // Tracks the last known non-anonymous UID to distinguish a same-account re-sign-in
  // (anonymous → same Google UID after sign-out) from a genuine account switch.
  const lastNonAnonUidRef = useRef<string | null>(null);
  // Ref so the auth state listener always calls the latest version of initializePlayer
  const initializePlayerRef = useRef<() => Promise<void>>(async () => {});

  // Handle app state changes (foreground/background)
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus): void => {
    appStateRef.current = nextAppState; // Update ref immediately to avoid stale closure
    setAppState(nextAppState);
  }, []);

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
    (async () => {
      await AuthService.initialize();
      setAuthUser(AuthService.getCurrentUser());
      await initializePlayer();
    })();
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

  // Keep authUser state in sync with Firebase auth changes (e.g. after sign-in/sign-out).
  // When the UID changes (i.e. the user switched to a different account rather than just
  // linking their anonymous session), clear local player data and reload from the new
  // account's cloud save so it is never overwritten by the previous session's data.
  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged(user => {
      setAuthUser(user);
      const prevUid = prevUidRef.current;
      const newUid = user?.uid ?? null;
      prevUidRef.current = newUid;
      // Reload player data when:
      // 1. Account switch: UID changed from one non-null value to another.
      // 2. Late auth: signInAnonymously() resolved after the auth-init timeout, so
      //    player was already loaded without a UID. Re-fetch to pick up any cloud save.
      //    Requires !hadUserRef to exclude sign-out → re-sign-in (which goes null → new UID
      //    but did have a user earlier in the session).
      const isAccountSwitch = prevUid !== null && newUid !== null && prevUid !== newUid;
      const isLateAuth =
        prevUid === null && newUid !== null && playerRef.current !== null && !hadUserRef.current;
      // Mark that this session has seen a user AFTER computing isLateAuth so the check
      // reflects the previous state (not the current call's UID arrival).
      if (newUid !== null) {
        hadUserRef.current = true;
      }
      if (isAccountSwitch || isLateAuth) {
        // Distinguish a same-account re-sign-in (anonymous → same Google UID after sign-out)
        // from a genuine switch to a different account. Check BEFORE updating lastNonAnonUidRef.
        // Late-auth arrivals are treated as re-sign-ins: local data is at least as fresh, so
        // skip the clear and let the timestamp comparison in loadPlayerData decide.
        const isReSignIn = isLateAuth || newUid === lastNonAnonUidRef.current;

        // Block the player→playerRef sync effect during reload.
        // For isLateAuth: keep playerRef non-null so handlers stay active (no silent
        // gameplay stoppage); each savePlayerData call-site guards on isReloadingRef
        // to prevent stale writes to AsyncStorage / Firestore.
        // For isAccountSwitch: null the ref too (see below).
        activeReloadIdRef.current += 1;
        isReloadingRef.current = true;

        if (isAccountSwitch) {
          // On a genuine account switch: null the ref so GPS callbacks bail during
          // reload, wipe React state so the UI shows the loading screen, and clear
          // encounter/combat state to prevent cross-account data leakage.
          playerRef.current = null;
          setPlayer(null);
          encounterRef.current = null;
          showCombatModalRef.current = false;
          setCurrentEncounter(null);
          setShowEncounterModal(false);
          setShowCombatModal(false);
          setIsEncounterModalMinimized(false);
        }
        // For isLateAuth: the user hasn't changed — keep the existing player
        // state visible so the UI doesn't flash to the loading screen mid-session.
        // initializePlayer will call setPlayer() when the cloud data is ready.

        // For a genuine account switch: clear local data so the new account's cloud save always
        // wins the timestamp comparison, preventing cross-account data leakage.
        // For a re-sign-in or late auth: skip the clear — the local save is more recent.
        const reload = isReSignIn
          ? initializePlayerRef.current()
          : clearLocalPlayerData().then(() => initializePlayerRef.current());
        reload.catch(error =>
          console.error('Failed to reload player after account switch:', error),
        );
      }
      // Update after the isReSignIn check so the check sees the previous value
      if (user && !user.isAnonymous) {
        lastNonAnonUidRef.current = user.uid;
      }
    });
    return unsubscribe;
  }, []);

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      await AuthService.signInWithGoogle();
      AnalyticsService.signIn('google');
    } catch (error: any) {
      Alert.alert('Sign-in failed', error?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAuthLoading(true);
    try {
      await AuthService.signInWithApple();
      AnalyticsService.signIn('apple');
    } catch (error: any) {
      Alert.alert('Sign-in failed', error?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
      await AuthService.signOut();
      AnalyticsService.signOut();
    } catch (error: any) {
      Alert.alert('Sign-out failed', error?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

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
  }, []); // Empty deps - only set up once on mount

  // Monitor app state changes (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

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
  }, [appState]);

  // Keep refs in sync with state
  useEffect(() => {
    if (!isReloadingRef.current) {
      playerRef.current = player;
    }
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

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

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
    // Capture reload ID at entry. If a newer reload starts before this one
    // finishes, we return early and touch no shared state — preventing a stale
    // load from draining pendingReloadDistanceRef, clearing isReloadingRef, or
    // overwriting playerRef/setPlayer with outdated data.
    const myReloadId = activeReloadIdRef.current;
    try {
      const savedData = await loadPlayerData();
      if (activeReloadIdRef.current !== myReloadId) {
        return; // superseded — the active reload will handle all shared state
      }
      // Drain distance accumulated while saves were blocked; merge into player.
      const pendingDist = pendingReloadDistanceRef.current;
      pendingReloadDistanceRef.current = 0;
      isReloadingRef.current = false;
      if (savedData) {
        const p = Player.fromJSON(savedData);
        if (pendingDist > 0) {
          p.addDistance(pendingDist);
        }
        playerRef.current = p;
        setPlayer(p);
        AnalyticsService.playerSessionStart(p.level, p.totalDistance);
      } else {
        // Create new player. Do NOT save here: saving a blank placeholder with
        // any timestamp races with a concurrent late-auth reload that may already
        // have written real cloud data to AsyncStorage. The first GPS event
        // (or other game action) will persist the player with a real timestamp.
        const newPlayer = new Player();
        if (pendingDist > 0) {
          newPlayer.addDistance(pendingDist);
        }
        playerRef.current = newPlayer;
        setPlayer(newPlayer);
        AnalyticsService.playerSessionStart(newPlayer.level, newPlayer.totalDistance);
      }
    } catch (error) {
      if (activeReloadIdRef.current !== myReloadId) return;
      console.error('Error initializing player:', error);
      const fallback = new Player();
      pendingReloadDistanceRef.current = 0;
      isReloadingRef.current = false;
      playerRef.current = fallback;
      setPlayer(fallback);
    }
  };
  // Keep the ref current so the auth state listener always calls the latest closure
  initializePlayerRef.current = initializePlayer;

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

  // Check for pending encounters from background
  const checkPendingEncounter = async (): Promise<void> => {
    // Prevent concurrent execution (race condition protection)
    if (isCheckingPendingEncounterRef.current) {
      return; // Already checking, skip this call
    }

    isCheckingPendingEncounterRef.current = true;

    try {
      // Check if there's already an active encounter (prevent overwriting combat progress)
      // Use ref (encounterRef.current) instead of state to avoid stale closure issues
      // when called from notification handler with empty deps (which captures initial state value)
      if (encounterRef.current) {
        // Active encounter exists - don't load pending encounter to avoid overwriting
        // Clear any stale pending encounter data silently
        await clearPendingEncounter();
        return;
      }

      const pendingEncounterData = await loadPendingEncounter();
      if (pendingEncounterData) {
        // Reconstruct encounter from saved data
        const creature = new Creature(pendingEncounterData.creature);
        const encounter = new Encounter({
          creature,
          location: pendingEncounterData.location,
          timestamp: pendingEncounterData.timestamp,
          playerLevel: pendingEncounterData.playerLevel,
          status: pendingEncounterData.status,
        });

        // Set encounterRef immediately to prevent race condition with GPS callbacks
        // This ensures handleDistanceUpdate will see the encounter and skip generation
        // even if a GPS callback interleaves before clearPendingEncounter completes
        encounterRef.current = encounter;
        isMinimizedRef.current = false;
        showCombatModalRef.current = false;
        victoryProcessedRef.current = false;
        fleeProcessedRef.current = false;

        // Clear pending encounter - check return value to prevent reload issue
        const clearSuccess = await clearPendingEncounter();
        if (!clearSuccess) {
          // Clear failed - don't show encounter to prevent reload on next appState change
          // This prevents the encounter from being reloaded with full HP, overwriting combat progress
          // Clear the refs we just set to avoid leaving stale state
          encounterRef.current = null;
          isMinimizedRef.current = false;
          showCombatModalRef.current = false;
          victoryProcessedRef.current = false;
          fleeProcessedRef.current = false;
          console.error(
            'Failed to clear pending encounter - skipping encounter display to prevent data loss',
          );
          return;
        }

        // Clear succeeded - safe to show encounter
        // Show encounter in UI (refs already set above to prevent race condition)
        setCurrentEncounter(encounter);
        setShowEncounterModal(true);
        setIsEncounterModalMinimized(false);
      }
    } catch (error) {
      console.error('Error checking pending encounter:', error);
    } finally {
      // Always reset the flag, even if an error occurred
      isCheckingPendingEncounterRef.current = false;
    }
  };

  // Handle location updates
  const handleLocationUpdate = (location: LocationData): void => {
    currentLocationRef.current = location; // Update ref synchronously to avoid stale closures
    setCurrentLocation(location);
  };

  // Handle distance updates
  const handleDistanceUpdate = async (distanceData: DistanceData): Promise<void> => {
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
      const prevTotal = currentPlayer.totalDistance;
      const updatedPlayer = new Player(currentPlayer.toJSON());
      updatedPlayer.addDistance(incremental);
      const newTotal = updatedPlayer.totalDistance;
      playerRef.current = updatedPlayer; // Update ref immediately to prevent data loss if handleFlee is called
      setPlayer(updatedPlayer);
      if (isReloadingRef.current) {
        // Saves are blocked during a late-auth reload. Accumulate distance so
        // initializePlayer can merge it into the freshly-loaded player.
        pendingReloadDistanceRef.current += incremental;
      } else {
        savePlayerData(updatedPlayer); // Save periodically
      }

      // Check if a distance milestone was just crossed
      const MILESTONES = [1000, 5000, 10000, 25000, 50000, 100000];
      for (const milestone of MILESTONES) {
        if (prevTotal < milestone && newTotal >= milestone) {
          AnalyticsService.distanceMilestone(milestone, newTotal);
        }
      }
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
        location.longitude,
      );

      // Auto-flee if user travels more than the threshold distance
      if (distanceFromEncounter > ENCOUNTER_CONFIG.AUTO_FLEE_DISTANCE) {
        Alert.alert(
          'Encounter Ended',
          `You traveled too far from the encounter location. The ${currentEncounterState.creature.name} has fled.`,
          [{ text: 'OK' }],
        );
        handleFlee();
        return; // Don't process new encounters after auto-flee
      }
    }

    // Don't generate new encounters if there's already an active encounter
    // (The refs are already loaded above, so we can use them here)
    // This prevents new encounters from replacing the current one while:
    // - The encounter modal is visible (not minimized)
    // - The encounter is minimized
    // - The user is in combat
    if (currentEncounterState) {
      // Active encounter exists - skip new encounter generation
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
        distanceData.incremental,
      );

      const encounter = EncounterService.processDistanceUpdate(
        distanceData,
        locationForEncounter,
        currentPlayer?.level || 1,
      );

      if (encounter) {
        AnalyticsService.encounterTriggered(
          encounter.creature.name,
          encounter.creature.level,
          encounter.playerLevel,
        );
        // Check if app is in background (use ref to avoid stale closure)
        const isInBackground = appStateRef.current !== 'active';

        if (isInBackground) {
          // App is in background - save encounter and show notification
          try {
            // Check if there's already a pending encounter (prevent overwrite)
            const existingPendingEncounter = await loadPendingEncounter();
            if (existingPendingEncounter) {
              console.warn(
                'Background encounter already pending, skipping new encounter to prevent overwrite',
              );
              // Don't update refs - let the existing pending encounter be loaded when app comes to foreground
              // The refs will be updated when checkPendingEncounter loads the pending encounter
              return; // Skip saving this encounter
            }

            // Save encounter to storage first (serialize encounter data)
            // We must save successfully before setting refs to avoid blocking the encounter system
            const encounterData: EncounterData = {
              creature: {
                id: encounter.creature.id,
                name: encounter.creature.name,
                type: encounter.creature.type,
                level: encounter.creature.level,
                hp: encounter.creature.hp,
                maxHp: encounter.creature.maxHp,
                attack: encounter.creature.attack,
                defense: encounter.creature.defense,
                speed: encounter.creature.speed,
                rarity: encounter.creature.rarity,
                description: encounter.creature.description,
                encounterRate: encounter.creature.encounterRate,
              },
              location: encounter.location,
              timestamp: encounter.timestamp,
              playerLevel: encounter.playerLevel,
              status: encounter.status,
            };
            const saveSuccess = await savePendingEncounter(encounterData);

            // Only set refs and show notification if save succeeded
            // If save fails, don't set refs (to avoid blocking encounter system) and don't show notification
            if (!saveSuccess) {
              console.error(
                'Failed to save pending encounter, skipping ref update and notification',
              );
              return; // Exit early - encounter not saved, so don't proceed
            }

            // Save succeeded - show notification
            // NOTE: Do NOT set encounterRef.current here - it will be set when checkPendingEncounter
            // loads the encounter from storage and displays it in the UI. Setting it here would cause
            // checkPendingEncounter to return early without loading the encounter from storage.
            await NotificationService.showEncounterNotification(encounter);
          } catch (error) {
            console.error('Error handling background encounter:', error);
          }
        } else {
          // App is in foreground - show encounter modal
          // Update refs immediately to prevent race condition with GPS callbacks
          // This prevents handleDistanceUpdate from seeing stale ref values before useEffect sync
          encounterRef.current = encounter; // Set to new encounter immediately
          isMinimizedRef.current = false; // Reset minimized state immediately
          showCombatModalRef.current = false; // Ensure combat modal is closed
          victoryProcessedRef.current = false; // Reset victory flag for new encounter
          fleeProcessedRef.current = false; // Reset flee flag for new encounter

          setCurrentEncounter(encounter);
          setShowEncounterModal(true);
          setIsEncounterModalMinimized(false); // Reset minimized state for new encounter
        }

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

  // Handle encounter fight - opens combat modal
  const handleFight = (): void => {
    // Use refs to get current state (avoids stale closure)
    const currentPlayer = playerRef.current;
    const currentEncounterState = encounterRef.current;

    if (!currentEncounterState || !currentPlayer) {
      return;
    }

    // Check if player is already defeated
    if (currentPlayer.isDefeated()) {
      return; // Can't fight if player is defeated
    }

    const creature = currentEncounterState.creature;

    // Check if creature is already defeated
    if (creature.isDefeated()) {
      handleVictory();
      return;
    }

    // Update ref immediately to prevent race condition with GPS callbacks
    // This prevents handleDistanceUpdate from seeing stale ref value before useEffect sync
    showCombatModalRef.current = true;

    // Open combat modal
    setShowCombatModal(true);
    AnalyticsService.combatStarted(creature.name, currentPlayer.level);
  };

  // Handle attack execution with specific attack type
  const handleAttack = (attackType: AttackType): void => {
    // Use refs to get current state (avoids stale closure)
    const currentPlayer = playerRef.current;
    const currentEncounterState = encounterRef.current;

    if (!currentEncounterState || !currentPlayer) {
      return;
    }

    // Prevent multiple victory processing for the same encounter
    if (victoryProcessedRef.current) {
      return;
    }

    const creature = currentEncounterState.creature;

    // Defensive check: creature should not be defeated at this point
    // (handleFight already checked, but state could have changed)
    if (creature.isDefeated()) {
      handleVictory();
      // Update ref immediately to prevent race condition with GPS callbacks
      showCombatModalRef.current = false;
      setShowCombatModal(false);
      return;
    }

    // Create updated player instance for modifications
    const updatedPlayer = new Player(currentPlayer.toJSON());

    // Get attack configuration
    const attackConfig = ATTACK_TYPES[attackType];

    // Player attacks creature with selected attack type
    // Calculate damage: (player attack - creature defense) * multiplier (minimum 1)
    const playerDamage = updatedPlayer.calculateDamage(
      creature.defense,
      attackConfig.damageMultiplier,
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

    // Update ref immediately to prevent race condition with GPS callbacks
    // This prevents handleDistanceUpdate from seeing stale ref value before useEffect sync
    playerRef.current = updatedPlayer; // Update ref immediately to prevent data loss

    // Update player state
    setPlayer(updatedPlayer);
    if (!isReloadingRef.current) {
      savePlayerData(updatedPlayer);
    }

    // Update encounter with damaged creature
    const updatedEncounter = new Encounter({
      creature: creature,
      location: currentEncounterState.location,
      timestamp: currentEncounterState.timestamp,
      playerLevel: currentEncounterState.playerLevel,
      status: currentEncounterState.status,
    });

    // Update ref immediately to prevent race condition with GPS callbacks
    encounterRef.current = updatedEncounter;
    setCurrentEncounter(updatedEncounter);

    // Check if creature is defeated
    if (creature.isDefeated()) {
      // handleVictory will update refs, but update combat modal ref immediately
      showCombatModalRef.current = false;
      setShowCombatModal(false);
      setShowEncounterModal(false);
      handleVictory(updatedPlayer);
    } else if (updatedPlayer.isDefeated()) {
      // Handle player defeat - heal immediately before showing alert
      // This ensures healing happens even if alert is dismissed on Android
      const healedPlayer = new Player(updatedPlayer.toJSON());
      healedPlayer.fullHeal();
      healedPlayer.incrementEncounters(); // Count the encounter like other outcomes

      // Update refs immediately to prevent race condition with GPS callbacks
      playerRef.current = healedPlayer; // Update ref immediately to prevent data loss
      encounterRef.current = null;
      isMinimizedRef.current = false;
      showCombatModalRef.current = false;

      setPlayer(healedPlayer);
      if (!isReloadingRef.current) {
        savePlayerData(healedPlayer);
      }
      setIsEncounterModalMinimized(false);
      setShowCombatModal(false);
      setShowEncounterModal(false);
      setCurrentEncounter(null);
      AnalyticsService.combatDefeated(creature.name, updatedPlayer.level);

      // Show alert for user feedback (healing already done)
      Alert.alert(
        'Defeated!',
        'You have been defeated! Your HP has been restored to full.',
        [{ text: 'OK' }],
        { cancelable: false }, // Prevent dismissal on Android to ensure modal closes properly
      );
    }
  };

  // Handle debug defeat - instantly defeat creature without taking damage
  const handleDebugDefeat = (): void => {
    // Use refs to get current state (avoids stale closure)
    const currentEncounterState = encounterRef.current;
    const currentPlayer = playerRef.current;

    if (!currentEncounterState || !currentPlayer) {
      return;
    }

    // Prevent multiple victory processing for the same encounter
    if (victoryProcessedRef.current) {
      return;
    }

    const creature = currentEncounterState.creature;

    // Check if creature is already defeated
    if (creature.isDefeated()) {
      return;
    }

    // Instantly defeat creature without taking damage
    // Deal exactly enough damage to defeat (current HP)
    creature.takeDamage(creature.hp);

    // Update encounter with defeated creature
    const updatedEncounter = new Encounter({
      creature: creature,
      location: currentEncounterState.location,
      timestamp: currentEncounterState.timestamp,
      playerLevel: currentEncounterState.playerLevel,
      status: currentEncounterState.status,
    });

    // Update ref immediately to prevent race condition with GPS callbacks
    encounterRef.current = updatedEncounter;
    setCurrentEncounter(updatedEncounter);

    // Close combat modal and trigger victory
    // handleVictory will update refs, but update combat modal ref immediately
    showCombatModalRef.current = false;
    setShowCombatModal(false);
    setShowEncounterModal(false);
    handleVictory(currentPlayer);
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

    // Attempt to drop loot
    const droppedItem = dropItem(forceItemDrop);
    let lootMessage = '';
    if (droppedItem) {
      const inventoryIndex = updatedPlayer.addItemToInventory(droppedItem);
      if (inventoryIndex === -1) {
        // Inventory is full
        lootMessage = `\n\n⚠️ Received ${droppedItem.name} but inventory is full!`;
      } else {
        // Item successfully added
        lootMessage = `\n\n✨ Received ${droppedItem.name}!`;
      }
    }

    // Reset HP to 100% after encounter (casual-friendly feature)
    updatedPlayer.fullHeal();

    // Update refs immediately to prevent race condition with GPS callbacks
    // This prevents handleDistanceUpdate from seeing stale ref values before useEffect sync
    playerRef.current = updatedPlayer; // Update ref immediately to prevent data loss
    encounterRef.current = null;
    isMinimizedRef.current = false;
    showCombatModalRef.current = false;
    fleeProcessedRef.current = false; // Reset flee flag when encounter is resolved

    setPlayer(updatedPlayer);
    if (!isReloadingRef.current) {
      savePlayerData(updatedPlayer);
    }
    setIsEncounterModalMinimized(false);
    setShowCombatModal(false);
    setShowEncounterModal(false);
    setCurrentEncounter(null);

    AnalyticsService.combatVictory(
      currentEncounterState.creature.name,
      basePlayer.level,
      expGain,
      !!droppedItem,
      levelsGained > 0,
    );
    if (levelsGained > 0) {
      AnalyticsService.levelUp(updatedPlayer.level);
      Alert.alert(
        'Victory & Level Up!',
        `You defeated ${currentEncounterState.creature.name}!\nGained ${expGain} XP\nReached level ${updatedPlayer.level}!${lootMessage}`,
      );
    } else {
      Alert.alert(
        'Victory!',
        `You defeated ${currentEncounterState.creature.name} and gained ${expGain} XP!${lootMessage}`,
      );
    }
  };

  // Handle encounter minimize (close modal without fleeing)
  const handleMinimize = (): void => {
    // Update ref immediately to prevent race condition with GPS callbacks
    // This prevents handleDistanceUpdate from seeing stale ref value before useEffect sync
    isMinimizedRef.current = true;
    setIsEncounterModalMinimized(true);
    setShowEncounterModal(false);
  };

  // Handle combat modal close
  const handleCloseCombatModal = (): void => {
    // Update ref immediately to prevent race condition with GPS callbacks
    // This prevents handleDistanceUpdate from seeing stale ref value before useEffect sync
    showCombatModalRef.current = false;
    setShowCombatModal(false);
  };

  // Handle encounter flee
  const handleFlee = (): void => {
    // Prevent multiple flee processing for the same encounter
    if (fleeProcessedRef.current) {
      return;
    }

    // Mark flee as being processed
    fleeProcessedRef.current = true;

    // Use refs to get current state (avoids stale closure)
    const currentPlayer = playerRef.current;
    const currentEncounterState = encounterRef.current;

    // Update refs immediately to prevent stale values if rapid GPS updates occur
    // This prevents duplicate calls when handleDistanceUpdate is called again before React processes state updates
    encounterRef.current = null;
    isMinimizedRef.current = false;
    showCombatModalRef.current = false;

    if (currentEncounterState && currentPlayer) {
      AnalyticsService.combatFled(currentEncounterState.creature.name, currentPlayer.level);
      const updatedPlayer = new Player(currentPlayer.toJSON());
      updatedPlayer.incrementEncounters();
      // Reset HP to 100% after encounter (casual-friendly feature)
      updatedPlayer.fullHeal();
      playerRef.current = updatedPlayer; // Update ref immediately to prevent data loss
      setPlayer(updatedPlayer);
      if (!isReloadingRef.current) {
        savePlayerData(updatedPlayer);
      }
    }
    setIsEncounterModalMinimized(false);
    setShowCombatModal(false);
    setShowEncounterModal(false);
    setCurrentEncounter(null);
  };

  // Debug: Force an encounter
  const forceEncounter = (): void => {
    // Use refs to get current state (avoids stale closure)
    const currentLocationData = currentLocationRef.current;
    const currentPlayer = playerRef.current;

    const location: Location = currentLocationData
      ? {
          latitude: currentLocationData.latitude,
          longitude: currentLocationData.longitude,
        }
      : {
          latitude: 37.7749,
          longitude: -122.4194,
        };
    const encounter = EncounterService.forceEncounter(location, currentPlayer?.level || 1);

    // Update refs immediately to prevent race condition with GPS callbacks
    // This prevents handleDistanceUpdate from seeing stale ref values before useEffect sync
    encounterRef.current = encounter; // Set to new encounter immediately
    isMinimizedRef.current = false; // Reset minimized state immediately
    showCombatModalRef.current = false; // Ensure combat modal is closed
    victoryProcessedRef.current = false; // Reset victory flag for new encounter
    fleeProcessedRef.current = false; // Reset flee flag for new encounter

    setCurrentEncounter(encounter);
    setShowEncounterModal(true);
    setIsEncounterModalMinimized(false); // Reset minimized state for new encounter
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

    // Update ref immediately to prevent race condition with GPS callbacks
    playerRef.current = updatedPlayer;

    setPlayer(updatedPlayer);
    if (!isReloadingRef.current) {
      savePlayerData(updatedPlayer);
    }
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

    // Update ref immediately to prevent race condition with GPS callbacks
    playerRef.current = updatedPlayer;

    setPlayer(updatedPlayer);
    if (!isReloadingRef.current) {
      savePlayerData(updatedPlayer);
    }

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

            // Update ref immediately to prevent race condition with GPS callbacks
            playerRef.current = updatedPlayer;

            setPlayer(updatedPlayer);
            if (!isReloadingRef.current) {
              savePlayerData(updatedPlayer);
            }
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={scrollViewContentStyle}
        testID="home-screen-scroll">
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
              onPress={() => {
                // Update ref immediately to prevent race condition with GPS callbacks
                // This prevents handleDistanceUpdate from seeing stale ref value before useEffect sync
                isMinimizedRef.current = false;
                setIsEncounterModalMinimized(false);
                setShowEncounterModal(true);
              }}>
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
        animationType={isE2E ? 'none' : 'slide'}
      />
      <CombatModal
        encounter={currentEncounter}
        player={player}
        visible={showCombatModal}
        onAttack={handleAttack}
        onClose={handleCloseCombatModal}
        animationType={isE2E ? 'none' : 'fade'}
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
            playerRef.current = updatedPlayer;
            setPlayer(updatedPlayer);
            if (!isReloadingRef.current) {
              savePlayerData(updatedPlayer);
            }
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
            playerRef.current = updatedPlayer;
            setPlayer(updatedPlayer);
            if (!isReloadingRef.current) {
              savePlayerData(updatedPlayer);
            }
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
