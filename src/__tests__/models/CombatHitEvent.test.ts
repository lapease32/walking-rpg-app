import { classifyResist } from '../../models/CombatHitEvent';

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
