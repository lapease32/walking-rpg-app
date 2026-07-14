import {
  NIGHT,
  DAY,
  THEMES,
  hpColor,
  resolveThemeName,
  type ThemeTokens,
} from '../../constants/theme';

describe('theme palettes', () => {
  it('exposes both palettes through THEMES', () => {
    expect(THEMES.night).toBe(NIGHT);
    expect(THEMES.day).toBe(DAY);
  });

  // The interface already forces completeness at compile time; this guards the runtime shape so a
  // palette can never drift (an extra key, or one quietly dropped) — a missing token would render
  // as `undefined` and silently paint black-on-black, the exact bug the web preview shipped with.
  it('both palettes define exactly the same tokens', () => {
    expect(Object.keys(DAY).sort()).toEqual(Object.keys(NIGHT).sort());
  });

  it('no token is empty', () => {
    for (const [name, tokens] of Object.entries(THEMES)) {
      for (const [key, value] of Object.entries(tokens)) {
        expect(`${name}.${key}=${value}`).not.toContain('undefined');
        expect(String(value).length).toBeGreaterThan(0);
      }
    }
  });

  it('night is dark and day is light (they are genuinely different grounds)', () => {
    expect(NIGHT.bg).not.toEqual(DAY.bg);
    expect(NIGHT.statusBar).toBe('light-content'); // light text on a near-black ground
    expect(DAY.statusBar).toBe('dark-content'); // dark ink on weathered bone
  });
});

describe('hpColor', () => {
  const cases: [ThemeTokens, string][] = [
    [NIGHT, 'night'],
    [DAY, 'day'],
  ];

  it.each(cases)('is success above half HP (%#: %s)', t => {
    expect(hpColor(100, 100, t)).toBe(t.success);
    expect(hpColor(51, 100, t)).toBe(t.success);
  });

  it.each(cases)('is warning between a quarter and half (%#: %s)', t => {
    expect(hpColor(50, 100, t)).toBe(t.warning);
    expect(hpColor(26, 100, t)).toBe(t.warning);
  });

  it.each(cases)('is danger at a quarter or below (%#: %s)', t => {
    expect(hpColor(25, 100, t)).toBe(t.danger);
    expect(hpColor(0, 100, t)).toBe(t.danger);
  });

  it('treats a zero maxHp as empty rather than dividing by zero', () => {
    expect(hpColor(0, 0, NIGHT)).toBe(NIGHT.danger);
  });
});

describe('resolveThemeName', () => {
  const coords = { latitude: 51.5, longitude: -0.13 };
  const now = new Date('2026-06-21T12:00:00Z');
  const alwaysDay = () => true;
  const alwaysNight = () => false;

  it('an explicit choice always wins — the sun is never consulted', () => {
    const sun = jest.fn(() => true);
    expect(resolveThemeName('night', now, coords, sun)).toBe('night');
    expect(resolveThemeName('day', now, coords, sun)).toBe('day');
    expect(sun).not.toHaveBeenCalled();
  });

  it('auto follows the sun', () => {
    expect(resolveThemeName('auto', now, coords, alwaysDay)).toBe('day');
    expect(resolveThemeName('auto', now, coords, alwaysNight)).toBe('night');
  });

  it('auto falls back to night when there is no position yet', () => {
    // No GPS fix (permission not granted, cold start, indoors…) — never leave the player on a
    // half-resolved theme; default to the game's home key.
    expect(resolveThemeName('auto', now, null, alwaysDay)).toBe('night');
  });

  it('passes the caller-supplied clock and coordinates straight through to the sun', () => {
    const sun = jest.fn(() => true);
    resolveThemeName('auto', now, coords, sun);
    expect(sun).toHaveBeenCalledWith(now, coords.latitude, coords.longitude);
  });
});
