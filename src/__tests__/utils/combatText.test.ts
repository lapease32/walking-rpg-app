import { combatTextStyle } from '../../utils/combatText';

describe('combatTextStyle', () => {
  describe('heal', () => {
    it('labels with a + and uses the heal color regardless of magnitude', () => {
      expect(combatTextStyle(8, 100, 'heal')).toEqual({
        label: '+8',
        color: '#43A047',
        fontSize: 22,
      });
      // A large heal still reads as a heal (no damage tiering).
      expect(combatTextStyle(90, 100, 'heal').color).toBe('#43A047');
    });
  });

  describe('damage magnitude tiers (crit-emphasis stand-in)', () => {
    it('a glancing hit (<12% of max HP) is small and amber', () => {
      const s = combatTextStyle(5, 100, 'damage');
      expect(s).toEqual({ label: '5', color: '#FFB300', fontSize: 20 });
    });

    it('a solid hit (12–25% of max HP) is medium and orange', () => {
      const s = combatTextStyle(15, 100, 'damage');
      expect(s).toEqual({ label: '15', color: '#FF7043', fontSize: 26 });
    });

    it('a heavy hit (≥25% of max HP) is large and deep red', () => {
      const s = combatTextStyle(30, 100, 'damage');
      expect(s).toEqual({ label: '30', color: '#D32F2F', fontSize: 34 });
    });

    it('scales by FRACTION, not absolute amount (same 15 dmg is heavy on a small foe)', () => {
      expect(combatTextStyle(15, 40, 'damage').fontSize).toBe(34); // 15/40 = 37.5% → heavy
      expect(combatTextStyle(15, 100, 'damage').fontSize).toBe(26); // 15/100 = 15% → solid
    });
  });

  describe('edge cases', () => {
    it('rounds fractional amounts for the label', () => {
      expect(combatTextStyle(11.6, 100, 'damage').label).toBe('12');
    });

    it('treats a non-positive max HP as a glancing hit rather than dividing by zero', () => {
      expect(combatTextStyle(10, 0, 'damage')).toEqual({
        label: '10',
        color: '#FFB300',
        fontSize: 20,
      });
    });

    it('clamps negative amounts to 0', () => {
      expect(combatTextStyle(-5, 100, 'damage').label).toBe('0');
    });
  });
});
