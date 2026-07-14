import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { NIGHT, THEMES, type ThemeName, type ThemeTokens } from '../constants/theme';
import { loadSettings, saveSettings } from '../utils/storage';
import logger from '../utils/logger';

/**
 * Theme context — hands every component its palette (see constants/theme).
 *
 * The player's choice persists in AppSettings. Default is NIGHT (the game's home key); DAY is the
 * grim-but-daylit palette, not a light mode.
 *
 * A follow-up adds an 'auto' preference that follows the real sunrise/sunset — this provider is the
 * seam for it: only `resolveThemeName` changes, every consumer stays put.
 */
interface ThemeContextValue {
  theme: ThemeTokens;
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: NIGHT,
  themeName: 'night',
  setThemeName: () => {},
});

export const DEFAULT_THEME_NAME: ThemeName = 'night';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setName] = useState<ThemeName>(DEFAULT_THEME_NAME);
  // The restore below is async. If the player picks a theme BEFORE it resolves, the stale load
  // would stomp their fresh choice — so a live choice always wins over the restore.
  const userChoseRef = useRef(false);

  // Restore the persisted choice once on mount; a failure just leaves the default in place.
  useEffect(() => {
    let cancelled = false;
    loadSettings()
      .then(settings => {
        const saved = settings?.themeName;
        if (!cancelled && !userChoseRef.current && (saved === 'night' || saved === 'day')) {
          setName(saved);
        }
      })
      .catch(error => logger.warn('Failed to load theme preference', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const setThemeName = useCallback((name: ThemeName) => {
    userChoseRef.current = true;
    setName(name);
    // Persist alongside any other settings rather than clobbering them.
    loadSettings()
      .then(settings => saveSettings({ ...(settings ?? {}), themeName: name }))
      .catch(error => logger.warn('Failed to persist theme preference', error));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: THEMES[themeName], themeName, setThemeName }),
    [themeName, setThemeName],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active palette. Components build their StyleSheet from this via a `makeStyles(theme)` factory. */
export function useTheme(): ThemeTokens {
  return useContext(ThemeContext).theme;
}

/** The active theme name + setter — for the Settings toggle. */
export function useThemeControls(): Omit<ThemeContextValue, 'theme'> {
  const { themeName, setThemeName } = useContext(ThemeContext);
  return { themeName, setThemeName };
}
