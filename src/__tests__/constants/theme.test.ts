import { NIGHT, DAY, THEMES, hpColor, type ThemeTokens } from '../../constants/theme';

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
