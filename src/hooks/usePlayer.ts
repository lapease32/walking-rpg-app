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

  // Cancel any pending deferred commit if the component unmounts so the
  // listener doesn't fire after teardown.
  useEffect(() => {
    return () => {
      pendingCommitUnsubRef.current?.();
      pendingCommitUnsubRef.current = null;
    };
  }, []);

  const setPlayerAndSave = useCallback((updated: Player) => {
    playerRef.current = updated;
    setPlayer(updated);
    savePlayerData(updated);
  }, []);

  const clearPlayer = useCallback(() => {
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
    console.warn('[INIT] usePlayer.initializePlayer start');
    try {
      const savedData = await loadPlayerData();
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
