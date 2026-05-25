import { useState, useRef, useCallback } from 'react';
import { Player } from '../models/Player';
import AnalyticsService from '../services/AnalyticsService';
import { savePlayerData, loadPlayerData } from '../utils/storage';

export function usePlayer() {
  const [player, setPlayer] = useState<Player | null>(null);
  const playerRef = useRef<Player | null>(null);

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
    try {
      const savedData = await loadPlayerData();
      if (savedData) {
        const p = Player.fromJSON(savedData);
        playerRef.current = p;
        setPlayer(p);
        AnalyticsService.playerSessionStart(p.level, p.totalDistance);
      } else {
        const newPlayer = new Player();
        playerRef.current = newPlayer;
        setPlayer(newPlayer);
        await savePlayerData(newPlayer);
        AnalyticsService.playerSessionStart(newPlayer.level, newPlayer.totalDistance);
      }
    } catch (error) {
      console.error('Error initializing player:', error);
      const fallback = new Player();
      playerRef.current = fallback;
      setPlayer(fallback);
    }
  }, []);

  return { player, playerRef, setPlayerAndSave, clearPlayer, initializePlayer };
}
