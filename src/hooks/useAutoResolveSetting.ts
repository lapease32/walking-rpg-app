import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAutoResolveBelowRare, saveAutoResolveBelowRare } from '../utils/storage';

/**
 * The "auto-resolve below-rare encounters" (idle-mode) preference.
 *
 * When ON, below-rare FOREGROUND encounters auto-resolve at active-tier reward into the walk
 * summary instead of opening the EncounterModal — the player skips trivial fights without losing
 * rewards. Elites are unaffected (they always require an active fight). Persisted device-level;
 * defaults OFF (active-by-default — every foreground encounter is a real fight until opted out).
 *
 * Exposes a ref alongside the state: the encounter gate reads the toggle inside an async GPS
 * distance callback, where a captured state value would go stale — the ref always holds the latest.
 */
export function useAutoResolveSetting() {
  const [autoResolveBelowRare, setAutoResolveBelowRareState] = useState(false);
  const autoResolveBelowRareRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadAutoResolveBelowRare()
      .then(value => {
        if (cancelled) {
          return;
        }
        autoResolveBelowRareRef.current = value;
        setAutoResolveBelowRareState(value);
      })
      .catch(error => console.error('Failed to load auto-resolve setting:', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const setAutoResolveBelowRare = useCallback((enabled: boolean) => {
    // Update the ref synchronously so the very next gate tick sees the new value, then persist.
    autoResolveBelowRareRef.current = enabled;
    setAutoResolveBelowRareState(enabled);
    saveAutoResolveBelowRare(enabled).catch(error =>
      console.error('Failed to persist auto-resolve setting:', error),
    );
  }, []);

  return { autoResolveBelowRare, setAutoResolveBelowRare, autoResolveBelowRareRef };
}
