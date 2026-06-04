import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { Player, PlayerData } from '../models/Player';
import { Archetype } from '../models/Archetype';
import AnalyticsService from '../services/AnalyticsService';
import {
  savePlayerData,
  readLocalPlayerSnapshot,
  reconcileCloudPlayerData,
} from '../utils/storage';

// On Android New Architecture (Fabric), state commits that happen while the
// activity is paused — e.g. while a runtime permission dialog has focus —
// can be lost. The UI then stays on the previous tree (the "Loading…" branch
// in HomeScreen) even after the activity resumes. Cold-start init can finish
// inside that paused window when the work is fast (Java auth prewarm makes
// signInAnonymously a no-op), so the initial setPlayer call is the one that
// gets dropped. Defer the setter until AppState is 'active' to make the
// initial paint deterministic.
// Hard cap on how long commitWhenActive will wait for an 'active' AppState
// before committing anyway. A cold-start race can leave us waiting forever for
// an 'active' CHANGE event that already fired before our listener armed (and the
// setTimeout(0) currentState read below can come back stale), which stranded the
// new-user archetype screen on "Loading…" indefinitely — the long-standing
// E2E-Android flake. By this point the activity is effectively foregrounded and
// local-first paint means there is no pre-commit native work to block, so a
// commit is safe; if Fabric still drops it, the belt-and-suspenders 'active'
// effect re-commits once a real 'active' transition arrives.
const ACTIVE_COMMIT_FALLBACK_MS = 1500;

function commitWhenActive(commit: () => void): () => void {
  let fired = false;
  let yieldTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let fallbackTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let sub: ReturnType<typeof AppState.addEventListener> | null = null;

  const cleanup = () => {
    if (yieldTimeoutId !== null) {
      clearTimeout(yieldTimeoutId);
      yieldTimeoutId = null;
    }
    if (fallbackTimeoutId !== null) {
      clearTimeout(fallbackTimeoutId);
      fallbackTimeoutId = null;
    }
    sub?.remove();
    sub = null;
  };

  // Idempotent: whichever of (active event / active currentState / fallback)
  // wins fires the commit exactly once.
  const fire = () => {
    if (fired) return;
    fired = true;
    cleanup();
    commit();
  };

  // Arm the listener first — no synchronous AppState read before this, so there
  // is no TOCTOU window where an 'active' event could slip past.
  sub = AppState.addEventListener('change', state => {
    if (state === 'active') fire();
  });

  // Yield the event loop via setTimeout(0) before reading AppState.currentState.
  // Any pending native AppState change notifications are macrotasks queued BEFORE
  // this setTimeout, so they run first and update currentState to the true value.
  yieldTimeoutId = setTimeout(() => {
    yieldTimeoutId = null;
    if (AppState.currentState === 'active') fire();
  }, 0);

  // Hard fallback so a missed 'active' event can never hang the first paint.
  fallbackTimeoutId = setTimeout(fire, ACTIVE_COMMIT_FALLBACK_MS);

  return () => {
    if (fired) return;
    fired = true;
    cleanup();
  };
}

export function usePlayer() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [needsArchetypeSelection, setNeedsArchetypeSelection] = useState(false);
  // Incremented by the belt-and-suspenders on every 'active' transition so
  // that React always schedules a re-render, even when playerRef.current
  // and the current player state share the same object reference (which
  // would otherwise cause React to bail via Object.is equality). HomeScreen
  // re-renders, sees player !== null, and Fabric re-commits the native tree
  // — recovering from any commit dropped by Fabric during a pause window.
  const [, setRepaintToken] = useState(0);
  const playerRef = useRef<Player | null>(null);
  const pendingCommitUnsubRef = useRef<(() => void) | null>(null);
  // Monotonic token identifying the most-recently-started initializePlayer (or
  // clearPlayer) call. initializePlayer captures it before awaiting and bails
  // after the await if a newer call has superseded it. Without this, two
  // concurrent initializePlayer calls — e.g. the initialize() call with a
  // null user racing a belated-sign-in reload with cloud data — resolve in
  // completion order, so a slow null-user load can clobber the signed-in
  // load's result and silently drop cloud progress.
  const initGenerationRef = useRef(0);
  // The in-flight cloud reconcile promise. handleArchetypeSelected awaits it so a
  // freshly-chosen archetype can never overwrite an existing cloud character
  // (fresh install / reinstall). Resolves to cloud PlayerData when it wins, else null.
  const cloudCheckRef = useRef<Promise<PlayerData | null> | null>(null);
  // The init generation whose post-paint reconcile has already been started, so
  // the reconcile effect fires exactly once per initializePlayer.
  const reconciledGenerationRef = useRef(-1);

  // Cancel any pending deferred commit if the component unmounts so the
  // listener doesn't fire after teardown.
  useEffect(() => {
    return () => {
      pendingCommitUnsubRef.current?.();
      pendingCommitUnsubRef.current = null;
    };
  }, []);

  // Belt-and-suspenders retry on every active transition. Two things happen:
  // 1. setPlayer(playerRef.current) re-asserts the player value.
  // 2. setRepaintToken increments unconditionally, guaranteeing React schedules
  //    a re-render even when playerRef.current and the current state share the
  //    same object reference. Without (2), React bails via Object.is and the
  //    native tree (stuck on the loading screen) is never re-committed by Fabric.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        if (playerRef.current) {
          setPlayer(playerRef.current);
          // If a dropped Fabric commit left needsArchetypeSelection=true
          // but the player was already committed to playerRef, clear the flag.
          setNeedsArchetypeSelection(false);
        }
        setRepaintToken(t => t + 1);
      }
    });
    return () => sub.remove();
  }, []);

  // Cloud reconcile — runs AFTER the first screen paints (this effect fires
  // post-commit, once the player or archetype-selection screen is on screen).
  // The native Firestore read can synchronously block the JS thread on Android
  // New Architecture; keeping it off the pre-paint path means the screen is
  // already committed before any freeze, so the user is never stranded on
  // "Loading…" (the long-standing E2E-Android flake). If the cloud holds a
  // strictly-newer record (cross-device) or a character for a fresh install
  // (local was empty), adopt it.
  useEffect(() => {
    if (!player && !needsArchetypeSelection) return;
    const gen = initGenerationRef.current;
    if (reconciledGenerationRef.current === gen) return; // already reconciled this load
    reconciledGenerationRef.current = gen;

    const promise = reconcileCloudPlayerData();
    cloudCheckRef.current = promise;
    promise
      .then(cloudData => {
        if (gen !== initGenerationRef.current || !cloudData) return; // superseded or nothing newer
        const cloudPlayer = Player.fromJSON(cloudData);
        playerRef.current = cloudPlayer;
        setPlayer(cloudPlayer);
        setNeedsArchetypeSelection(false);
        AnalyticsService.playerSessionStart(cloudPlayer.level, cloudPlayer.totalDistance);
      })
      .catch(error => console.error('usePlayer: cloud reconcile failed:', error));
  }, [player, needsArchetypeSelection]);

  const setPlayerAndSave = useCallback((updated: Player) => {
    playerRef.current = updated;
    setPlayer(updated);
    savePlayerData(updated);
  }, []);

  const clearPlayer = useCallback(() => {
    // Bump the generation so any in-flight initializePlayer that's still
    // awaiting loadPlayerData bails instead of repopulating the player we're
    // about to clear (account-switch races).
    initGenerationRef.current++;
    // Cancel any deferred initial commit — without this, a setPlayer queued
    // by a still-awaiting initializePlayer could fire after clearPlayer
    // (e.g. account-switch races) and briefly restore the wrong session's
    // player on the UI.
    pendingCommitUnsubRef.current?.();
    pendingCommitUnsubRef.current = null;
    playerRef.current = null;
    // Drop the previous account's in-flight cloud check so the next account's
    // initializePlayer + reconcile effect start a fresh one.
    cloudCheckRef.current = null;
    setPlayer(null);
    setNeedsArchetypeSelection(false);
  }, []);

  const initializePlayer = useCallback(async (): Promise<void> => {
    const myGeneration = ++initGenerationRef.current;
    // Paint archetype selection (deferred for the Fabric pause window). Used by
    // both the no-local-data and error paths.
    const showArchetypeSelection = () => {
      pendingCommitUnsubRef.current?.();
      pendingCommitUnsubRef.current = commitWhenActive(() => {
        pendingCommitUnsubRef.current = null;
        // A newer init/clearPlayer superseded us between arming and firing — a
        // deferred commit from a stale init must not paint over the live one.
        if (myGeneration !== initGenerationRef.current) return;
        setNeedsArchetypeSelection(true);
      });
    };
    try {
      // LOCAL ONLY — never gate first paint on the cloud read; it can synchronously
      // block the JS thread on Android New Arch and strand the user on "Loading…".
      // The post-paint reconcile effect pulls cloud data once the screen is up.
      const { data: localData } = await readLocalPlayerSnapshot();
      // A newer initializePlayer (e.g. belated-sign-in reload) or a clearPlayer
      // superseded us while we awaited. Bail so our stale snapshot can't clobber.
      if (myGeneration !== initGenerationRef.current) {
        return;
      }

      if (!localData) {
        // No local save — genuinely new, or a fresh install whose cloud character
        // the post-paint reconcile will adopt. Show archetype selection now;
        // handleArchetypeSelected waits for the cloud check before creating a new
        // character so an existing cloud save is never clobbered.
        showArchetypeSelection();
        return;
      }

      // Returning player — paint from the local snapshot immediately; the
      // reconcile effect adopts cloud data afterward if it is strictly newer.
      const playerToSet = Player.fromJSON(localData);
      playerRef.current = playerToSet;
      pendingCommitUnsubRef.current?.();
      pendingCommitUnsubRef.current = commitWhenActive(() => {
        pendingCommitUnsubRef.current = null;
        if (myGeneration !== initGenerationRef.current) return; // superseded
        if (playerRef.current) {
          setPlayer(playerRef.current);
          setNeedsArchetypeSelection(false);
        }
      });

      AnalyticsService.playerSessionStart(playerToSet.level, playerToSet.totalDistance);
    } catch (error) {
      console.error('Error initializing player:', error);
      if (myGeneration !== initGenerationRef.current) {
        return;
      }
      // On error fall back to archetype selection rather than silently defaulting
      // to Martial — the player's choice should always be explicit.
      showArchetypeSelection();
    }
  }, []);

  const handleArchetypeSelected = useCallback(async (archetype: Archetype): Promise<void> => {
    const gen = initGenerationRef.current;

    // Reinstall guard: wait for the cloud check before creating a character, so a
    // fresh-install player who picks an archetype can't overwrite the cloud save
    // the post-paint reconcile is still fetching. The effect normally starts the
    // check; start it here too in case the user tapped before that effect ran
    // (set reconciledGenerationRef so the effect doesn't double-fetch).
    if (!cloudCheckRef.current) {
      reconciledGenerationRef.current = gen;
      cloudCheckRef.current = reconcileCloudPlayerData();
    }
    let cloudData: PlayerData | null = null;
    try {
      cloudData = await cloudCheckRef.current;
    } catch {
      cloudData = null;
    }
    if (gen !== initGenerationRef.current) {
      return; // account switched while we waited
    }

    if (cloudData || playerRef.current) {
      // A cloud character exists — adopt it instead of creating a new one. The
      // reconcile effect usually does this already; this covers the race where
      // the user confirmed before the effect's setState committed.
      if (cloudData && !playerRef.current) {
        const cloudPlayer = Player.fromJSON(cloudData);
        playerRef.current = cloudPlayer;
        setPlayer(cloudPlayer);
        setNeedsArchetypeSelection(false);
        AnalyticsService.playerSessionStart(cloudPlayer.level, cloudPlayer.totalDistance);
      }
      return;
    }

    // No cloud character — safe to create the chosen archetype.
    const newPlayer = new Player({ archetype });
    playerRef.current = newPlayer;
    // Do NOT clear needsArchetypeSelection here — defer it into the
    // commitWhenActive callback so it batches with setPlayer in one render.
    // Clearing it early causes a "Loading..." flash between archetype selection
    // and the home screen (needsArchetypeSelection=false, player=null).
    try {
      await savePlayerData(newPlayer);
    } catch (error) {
      console.error('Error saving new player after archetype selection:', error);
    }

    AnalyticsService.playerSessionStart(newPlayer.level, newPlayer.totalDistance);
    pendingCommitUnsubRef.current?.();
    pendingCommitUnsubRef.current = commitWhenActive(() => {
      pendingCommitUnsubRef.current = null;
      if (playerRef.current) {
        setPlayer(playerRef.current);
        setNeedsArchetypeSelection(false);
      }
    });
  }, []);

  return {
    player,
    playerRef,
    setPlayerAndSave,
    clearPlayer,
    initializePlayer,
    needsArchetypeSelection,
    handleArchetypeSelected,
  };
}
