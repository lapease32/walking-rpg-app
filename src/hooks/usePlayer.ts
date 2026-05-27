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
  if (AppState.currentState === 'active') {
    commit();
    return () => {};
  }
  const sub = AppState.addEventListener('change', state => {
    if (state === 'active') {
      sub.remove();
      commit();
    }
  });
  return () => sub.remove();
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
      pendingCommitUnsubRef.current?.();
      pendingCommitUnsubRef.current = commitWhenActive(() => {
        pendingCommitUnsubRef.current = null;
        setPlayer(playerToSet);
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
        setPlayer(fallback);
      });
    }
  }, []);

  return { player, playerRef, setPlayerAndSave, clearPlayer, initializePlayer };
}
