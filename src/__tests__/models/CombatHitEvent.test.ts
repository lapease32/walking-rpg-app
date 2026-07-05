import { classifyResist, formatStatModLabel } from '../../models/CombatHitEvent';

describe('classifyResist', () => {
  it('classifies any positive resistance as resisted', () => {
    expect(classifyResist(0.25)).toBe('resisted');
    expect(classifyResist(0.5)).toBe('resisted');
    expect(classifyResist(1)).toBe('resisted'); // immunity still reads as "resisted"
  });

  it('classifies any negative resistance as vulnerable', () => {
    expect(classifyResist(-0.25)).toBe('vulnerable');
    expect(classifyResist(-1)).toBe('vulnerable');
  });

  it('classifies exactly zero as neutral', () => {
    expect(classifyResist(0)).toBe('neutral');
  });
});

describe('formatStatModLabel', () => {
  it('formats a positive buff with an up arrow and + sign', () => {
    expect(formatStatModLabel({ attack: 10 })).toBe('ATK ↑ +10');
  });

  it('formats a negative debuff with a down arrow', () => {
    expect(formatStatModLabel({ defense: -5 })).toBe('DEF ↓ -5');
  });

  it('joins multiple stat changes', () => {
    expect(formatStatModLabel({ attack: 8, defense: -3 })).toBe('ATK ↑ +8  DEF ↓ -3');
  });

  it('omits stats that are not modified', () => {
    expect(formatStatModLabel({ defense: 4 })).toBe('DEF ↑ +4');
  });
});
