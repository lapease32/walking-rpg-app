import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { Player } from '../models/Player';
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
  // Fast path: already active.
  const isActive = (): boolean => AppState.currentState === 'active';
  if (isActive()) {
    commit();
    return () => {};
  }

  let fired = false;
  const sub = AppState.addEventListener('change', state => {
    if (state === 'active' && !fired) {
      fired = true;
      sub.remove();
      commit();
    }
  });
  // Re-check after subscribing — closes a TOCTOU race where the activity can
  // transition to active between the initial read and addEventListener wiring
  // up, in which case the change event has already fired and we'd otherwise
  // wait forever. `isActive()` is a function call so TS doesn't keep the
  // negative narrowing from the first check.
  if (!fired && isActive()) {
    fired = true;
    sub.remove();
    commit();
  }
  return () => {
    if (!fired) sub.remove();
  };
}

export function usePlayer() {
  const [player, setPlayer] = useState<Player | null>(null);
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

  // Belt-and-suspenders retry on every active transition: if a previous
  // setPlayer commit was lost by Fabric (because AppState.currentState was
  // stale at the time of the synchronous check in commitWhenActive — the JS
  // bridge can be behind the native activity state), this re-fires the
  // setter once the activity is definitively active. React bails on
  // referential equality so it's a no-op in the happy path; it only forces
  // a render when React state and the ref have diverged.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && playerRef.current) {
        setPlayer(playerRef.current);
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
    console.warn('[INIT] usePlayer.initializePlayer start');
    try {
      const savedData = await loadPlayerData();
      // A newer initializePlayer (e.g. belated-sign-in reload) or a clearPlayer
      // superseded us while we awaited. Bail so our now-stale snapshot can't
      // clobber the newer call's result or resurrect cleared state.
      if (myGeneration !== initGenerationRef.current) {
        console.warn('[INIT] usePlayer.initializePlayer superseded — bailing');
        return;
      }
      console.warn(
        `[INIT] usePlayer.initializePlayer loadPlayerData done (hasData=${!!savedData})`,
      );
      const playerToSet = savedData ? Player.fromJSON(savedData) : new Player();
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

      if (!savedData) {
        await savePlayerData(playerToSet);
      }
      AnalyticsService.playerSessionStart(playerToSet.level, playerToSet.totalDistance);
      console.warn('[INIT] usePlayer.initializePlayer end');
    } catch (error) {
      console.error('Error initializing player:', error);
      // Same supersede guard as the success path — don't install a fallback
      // player over a newer call's result.
      if (myGeneration !== initGenerationRef.current) {
        return;
      }
      const fallback = new Player();
      playerRef.current = fallback;
      pendingCommitUnsubRef.current?.();
      pendingCommitUnsubRef.current = commitWhenActive(() => {
        pendingCommitUnsubRef.current = null;
        if (playerRef.current) {
          setPlayer(playerRef.current);
        }
      });
    }
  }, []);

  return { player, playerRef, setPlayerAndSave, clearPlayer, initializePlayer };
}
