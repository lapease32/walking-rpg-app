import { resolveEncounterRoute } from '../../models/encounterRouting';

describe('resolveEncounterRoute', () => {
  it('presents a foreground encounter (any rarity) when nothing else is active', () => {
    expect(resolveEncounterRoute({ isBackground: false, isElite: false, busy: false })).toBe(
      'present',
    );
    expect(resolveEncounterRoute({ isBackground: false, isElite: true, busy: false })).toBe(
      'present',
    );
  });

  it('holds a backgrounded elite as a worthy foe', () => {
    expect(resolveEncounterRoute({ isBackground: true, isElite: true, busy: false })).toBe('hold');
  });

  it('auto-resolves a backgrounded common (never held)', () => {
    expect(resolveEncounterRoute({ isBackground: true, isElite: false, busy: false })).toBe(
      'passive',
    );
  });

  it('auto-resolves a foreground roll while already busy, so the active encounter is not clobbered', () => {
    // busy overrides present for BOTH rarities — a second foreground elite mid-fight resolves idle.
    expect(resolveEncounterRoute({ isBackground: false, isElite: false, busy: true })).toBe(
      'passive',
    );
    expect(resolveEncounterRoute({ isBackground: false, isElite: true, busy: true })).toBe(
      'passive',
    );
  });
});
