import { combatTextStyle, hitFloaterStyle } from '../../utils/combatText';
import type { CombatHitEvent } from '../../models/CombatHitEvent';

const makeEvent = (overrides: Partial<CombatHitEvent> = {}): CombatHitEvent => ({
  id: 0,
  target: 'creature',
  amount: 15,
  damageType: 'fire',
  resist: 'neutral',
  kind: 'hit',
  targetMaxHp: 100,
  ...overrides,
});

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

describe('hitFloaterStyle', () => {
  it('colors a neutral hit by damage type and shows a plain number', () => {
    expect(hitFloaterStyle(makeEvent({ damageType: 'frost', resist: 'neutral' }))).toEqual({
      label: '15',
      color: '#4FC3F7',
      fontSize: 26, // 15/100 = solid tier
    });
  });

  it('tags a resisted hit with RESIST, mutes the color, and shrinks it', () => {
    const s = hitFloaterStyle(makeEvent({ amount: 15, resist: 'resisted' }));
    expect(s.label).toBe('15 RESIST');
    expect(s.color).toBe('#90A4AE');
    expect(s.fontSize).toBe(Math.round(26 * 0.85));
  });

  it('tags a vulnerable hit with WEAK, keeps the type color, and enlarges it', () => {
    const s = hitFloaterStyle(makeEvent({ amount: 15, damageType: 'fire', resist: 'vulnerable' }));
    expect(s.label).toBe('15 WEAK');
    expect(s.color).toBe('#FF7043');
    expect(s.fontSize).toBe(Math.round(26 * 1.15));
  });

  it('falls back to the physical color when damageType is null', () => {
    expect(hitFloaterStyle(makeEvent({ damageType: null })).color).toBe('#ECEFF1');
  });

  it('defers a heal to the heal styling (green +N), ignoring type/resist', () => {
    expect(hitFloaterStyle(makeEvent({ kind: 'heal', amount: 8, damageType: null }))).toEqual({
      label: '+8',
      color: '#43A047',
      fontSize: 22,
    });
  });

  it('shows a buff in warm gold with its stat label', () => {
    expect(
      hitFloaterStyle(makeEvent({ kind: 'buff', damageType: null, label: 'ATK ↑ +10' })),
    ).toEqual({ label: 'ATK ↑ +10', color: '#FFD54F', fontSize: 18 });
  });

  it('shows a debuff in cool violet with its stat label', () => {
    expect(
      hitFloaterStyle(makeEvent({ kind: 'debuff', damageType: null, label: 'DEF ↓ -5' })),
    ).toEqual({ label: 'DEF ↓ -5', color: '#B39DDB', fontSize: 18 });
  });

  it('falls back to an arrow glyph when a buff/debuff has no label', () => {
    expect(
      hitFloaterStyle(makeEvent({ kind: 'buff', damageType: null, label: undefined })).label,
    ).toBe('▲');
  });

  describe('evasion tells', () => {
    it('a dodged hit on the player reads "DODGE" (no number)', () => {
      const s = hitFloaterStyle(makeEvent({ target: 'player', amount: 0, evade: 'dodged' }));
      expect(s.label).toBe('DODGE');
    });

    it('a dodged hit on the creature reads "MISS" (the player whiffed)', () => {
      const s = hitFloaterStyle(makeEvent({ target: 'creature', amount: 0, evade: 'dodged' }));
      expect(s.label).toBe('MISS');
    });

    it('a glancing hit keeps its reduced number and is tagged GLANCING', () => {
      const s = hitFloaterStyle(makeEvent({ amount: 7, evade: 'glancing' }));
      expect(s.label).toBe('7 GLANCING');
    });

    it('the evasion tell wins over the resist tell', () => {
      const s = hitFloaterStyle(makeEvent({ amount: 7, evade: 'glancing', resist: 'resisted' }));
      expect(s.label).toBe('7 GLANCING');
    });
  });
});
