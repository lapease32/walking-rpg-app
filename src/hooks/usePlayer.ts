import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { Player } from '../models/Player';
import { Archetype } from '../models/Archetype';
import AnalyticsService from '../services/AnalyticsService';
import { savePlayerData, loadPlayerData } from '../utils/storage';

// On Android New Architecture (Fabric), state commits that happen while the
// activity is paused — e.g. while a runtime permission dialog has focus —
// can be lost. The UI then stays on the previous tree (the "Loading…" branch
// in HomeScreen) even after the activity resumes. Cold-start init can finish
// inside that paused window when the work is fast (Java auth prewarm makes
// signInAnonymously a no-op), so the initial setPlayer call is the one that
// gets dropped. Defer the setter until AppState is 'active' to make the
// initial paint deterministic.
function commitWhenActive(commit: () => void): () => void {
  let fired = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  // Arm the listener first — no synchronous AppState read before this, so
  // there is no TOCTOU window where an 'active' event could slip past.
  const sub = AppState.addEventListener('change', state => {
    if (state === 'active' && !fired) {
      fired = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      sub.remove();
      commit();
    }
  });

  // Yield the event loop via setTimeout(0) before reading AppState.currentState.
  // commitWhenActive is called from Promise continuations (microtasks); any
  // pending native AppState change notifications are macrotasks queued BEFORE
  // our setTimeout, so they run first and update AppState.currentState to the
  // true value. Without this yield the synchronous read can return 'active'
  // while the activity is already paused (the 'background' macrotask is still
  // pending), causing setPlayer to fire inside the Fabric drop window and the
  // home-screen render to be silently discarded.
  timeoutId = setTimeout(() => {
    timeoutId = null;
    if (!fired && AppState.currentState === 'active') {
      fired = true;
      sub.remove();
      commit();
    }
  }, 0);

  return () => {
    if (!fired) {
      fired = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      sub.remove();
    }
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
        }
        setRepaintToken(t => t + 1);
      }
    });
    return () => sub.remove();
  }, []);

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
    setPlayer(null);
  }, []);

  const initializePlayer = useCallback(async (): Promise<void> => {
    const myGeneration = ++initGenerationRef.current;
    try {
      const savedData = await loadPlayerData();
      // A newer initializePlayer (e.g. belated-sign-in reload) or a clearPlayer
      // superseded us while we awaited. Bail so our now-stale snapshot can't
      // clobber the newer call's result or resurrect cleared state.
      if (myGeneration !== initGenerationRef.current) {
        return;
      }
      if (!savedData) {
        // New player — show archetype selection before creating/saving.
        setNeedsArchetypeSelection(true);
        return;
      }

      // Returning player — clear any stale archetype selection flag and load.
      setNeedsArchetypeSelection(false);
      const playerToSet = Player.fromJSON(savedData);
      playerRef.current = playerToSet;

      // Replace any earlier pending commit (e.g. account-switch reload that
      // raced with another resume) so we never have two listeners armed.
      // Commit playerRef.current at fire time rather than the captured
      // playerToSet, so any updates that landed via setPlayerAndSave during
      // the pause (e.g. background tracking distance updates) aren't
      // clobbered by the stale snapshot.
      pendingCommitUnsubRef.current?.();
      pendingCommitUnsubRef.current = commitWhenActive(() => {
        pendingCommitUnsubRef.current = null;
        if (playerRef.current) {
          setPlayer(playerRef.current);
        }
      });

      AnalyticsService.playerSessionStart(playerToSet.level, playerToSet.totalDistance);
    } catch (error) {
      console.error('Error initializing player:', error);
      // Same supersede guard as the success path — don't install a fallback
      // player over a newer call's result.
      if (myGeneration !== initGenerationRef.current) {
        return;
      }
      // On error fall back to archetype selection rather than silently
      // defaulting to Martial — the player's choice should always be explicit.
      setNeedsArchetypeSelection(true);
    }
  }, []);

  const handleArchetypeSelected = useCallback(async (archetype: Archetype): Promise<void> => {
    const newPlayer = new Player({ archetype });
    playerRef.current = newPlayer;
    setNeedsArchetypeSelection(false);

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
