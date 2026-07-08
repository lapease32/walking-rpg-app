import { resolveEncounterRoute } from '../../models/encounterRouting';

describe('resolveEncounterRoute', () => {
  describe('foreground', () => {
    it('presents any encounter when idle-mode is OFF', () => {
      expect(
        resolveEncounterRoute({ isBackground: false, isElite: false, autoResolveBelowRare: false }),
      ).toBe('present');
      expect(
        resolveEncounterRoute({ isBackground: false, isElite: true, autoResolveBelowRare: false }),
      ).toBe('present');
    });

    it('auto-resolves a below-rare encounter when idle-mode is ON', () => {
      expect(
        resolveEncounterRoute({ isBackground: false, isElite: false, autoResolveBelowRare: true }),
      ).toBe('autoResolve');
    });

    it('always presents an elite, even with idle-mode ON (never auto-resolvable)', () => {
      expect(
        resolveEncounterRoute({ isBackground: false, isElite: true, autoResolveBelowRare: true }),
      ).toBe('present');
    });
  });

  describe('background', () => {
    it('holds an elite as a worthy foe regardless of the toggle', () => {
      expect(
        resolveEncounterRoute({ isBackground: true, isElite: true, autoResolveBelowRare: false }),
      ).toBe('hold');
      expect(
        resolveEncounterRoute({ isBackground: true, isElite: true, autoResolveBelowRare: true }),
      ).toBe('hold');
    });

    it('idle-resolves a below-rare encounter regardless of the toggle', () => {
      expect(
        resolveEncounterRoute({ isBackground: true, isElite: false, autoResolveBelowRare: false }),
      ).toBe('passive');
      expect(
        resolveEncounterRoute({ isBackground: true, isElite: false, autoResolveBelowRare: true }),
      ).toBe('passive');
    });
  });
});
