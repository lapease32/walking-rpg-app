import { resolveEncounterRoute } from '../../models/encounterRouting';

describe('resolveEncounterRoute', () => {
  it('presents a foreground encounter of any rarity', () => {
    expect(resolveEncounterRoute({ isBackground: false, isElite: false })).toBe('present');
    expect(resolveEncounterRoute({ isBackground: false, isElite: true })).toBe('present');
  });

  it('holds a backgrounded elite as a worthy foe', () => {
    expect(resolveEncounterRoute({ isBackground: true, isElite: true })).toBe('hold');
  });

  it('auto-resolves a backgrounded common (never held)', () => {
    expect(resolveEncounterRoute({ isBackground: true, isElite: false })).toBe('passive');
  });
});
