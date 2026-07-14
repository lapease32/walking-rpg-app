import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import {
  THEMES,
  NIGHT,
  DEFAULT_THEME_NAME,
  resolveThemeName,
  type ThemeName,
  type ThemePreference,
  type ThemeTokens,
} from '../constants/theme';
import { isDaylight } from '../models/sun';
import LocationService from '../services/LocationService';
import { loadSettings, saveSettings } from '../utils/storage';
import logger from '../utils/logger';

/**
 * Theme context — hands every component its palette (see constants/theme).
 *
 * The player picks night, day, or AUTO. Auto follows the real sun at their coordinates: a walking
 * game is played outside, so the app is lit the way the world is. That makes the light/dark question
 * diegetic instead of a settings preference.
 *
 * Coordinates come from the position LocationService has already cached for the walking loop — no
 * extra permission, no extra fix, no network. If there's no position yet, auto falls back to night.
 */
interface ThemeContextValue {
  theme: ThemeTokens;
  /** The palette actually being rendered. */
  themeName: ThemeName;
  /** What the player chose (may be 'auto'). */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: NIGHT,
  themeName: DEFAULT_THEME_NAME,
  preference: 'auto',
  setPreference: () => {},
});

export const DEFAULT_PREFERENCE: ThemePreference = 'auto';

/** How often `auto` re-checks the sun. Pure maths on a cached position — negligible cost, and it
 *  means the app turns over within a minute of the actual sunrise/sunset while you're walking. */
const SUN_TICK_MS = 60_000;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(DEFAULT_PREFERENCE);
  const [themeName, setThemeName] = useState<ThemeName>(DEFAULT_THEME_NAME);
  // The restore below is async. If the player picks a theme BEFORE it resolves, the stale load
  // would stomp their fresh choice — so a live choice always wins over the restore.
  const userChoseRef = useRef(false);

  // Restore the persisted choice once on mount; a failure just leaves the default in place.
  useEffect(() => {
    let cancelled = false;
    loadSettings()
      .then(settings => {
        // `themeName` is the pre-sun-clock field: honour an explicit night/day choice made before
        // 'auto' existed rather than silently resetting the player to auto.
        const saved = settings?.themePreference ?? settings?.themeName;
        if (
          !cancelled &&
          !userChoseRef.current &&
          (saved === 'night' || saved === 'day' || saved === 'auto')
        ) {
          setPref(saved);
        }
      })
      .catch(error => logger.warn('Failed to load theme preference', error));
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve preference → palette. For 'auto' this re-checks the sun on a tick and whenever the app
  // returns to the foreground (a walk can easily straddle sunset with the screen off).
  useEffect(() => {
    const apply = () => {
      const cached = LocationService.getCurrentLocationCached();
      const coords = cached ? { latitude: cached.latitude, longitude: cached.longitude } : null;
      const next = resolveThemeName(preference, new Date(), coords, isDaylight);
      // Only set when it actually changes, so the tick doesn't re-render the tree every minute.
      setThemeName(current => (current === next ? current : next));
    };

    apply();
    if (preference !== 'auto') {
      return; // an explicit choice never changes on its own — no tick, no listener
    }

    const timer = setInterval(apply, SUN_TICK_MS);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        apply();
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    userChoseRef.current = true;
    setPref(next);
    // Persist alongside any other settings rather than clobbering them.
    loadSettings()
      .then(settings => saveSettings({ ...(settings ?? {}), themePreference: next }))
      .catch(error => logger.warn('Failed to persist theme preference', error));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: THEMES[themeName], themeName, preference, setPreference }),
    [themeName, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active palette. Components build their StyleSheet from this via a `makeStyles(theme)` factory. */
export function useTheme(): ThemeTokens {
  return useContext(ThemeContext).theme;
}

/** The player's preference + the resolved palette — for the Settings control. */
export function useThemeControls(): Omit<ThemeContextValue, 'theme'> {
  const { themeName, preference, setPreference } = useContext(ThemeContext);
  return { themeName, preference, setPreference };
}
