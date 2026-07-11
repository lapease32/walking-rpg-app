import { formatCombatLogEntry, CombatLogEntry, CombatLogNames } from '../../models/CombatLog';

const N: CombatLogNames = { player: 'You', creature: 'Mossback Toad' };
const fmt = (e: Omit<CombatLogEntry, 'id'>) => formatCombatLogEntry({ id: 1, ...e }, N);

describe('formatCombatLogEntry', () => {
  it('narrates a player attack with type + ability source', () => {
    expect(
      fmt({
        kind: 'attack',
        actor: 'player',
        target: 'creature',
        amount: 24,
        damageType: 'fire',
        source: 'Fireball',
      }),
    ).toBe('You hit Mossback Toad for 24 fire damage with Fireball');
  });

  it('narrates the creature counter (no source, no type word for null)', () => {
    expect(
      fmt({
        kind: 'attack',
        actor: 'creature',
        target: 'player',
        amount: 12,
        damageType: 'physical',
      }),
    ).toBe('Mossback Toad hits you for 12 physical damage');
  });

  it('appends resisted / vulnerable tags', () => {
    expect(
      fmt({
        kind: 'attack',
        actor: 'player',
        target: 'creature',
        amount: 6,
        damageType: 'frost',
        tags: ['resisted'],
      }),
    ).toContain('(resisted)');
    expect(
      fmt({
        kind: 'attack',
        actor: 'player',
        target: 'creature',
        amount: 30,
        damageType: 'fire',
        tags: ['weak'],
      }),
    ).toContain('vulnerable!');
  });

  it('renders a future dodged tag as an avoidance, not "for 0 damage"', () => {
    const line = fmt({
      kind: 'attack',
      actor: 'player',
      target: 'creature',
      amount: 0,
      tags: ['dodged'],
    });
    expect(line).toBe("Mossback Toad dodges You's attack!");
    expect(line).not.toContain('for 0');
  });

  it('narrates a DoT tick with its source', () => {
    expect(
      fmt({
        kind: 'dot',
        actor: 'player',
        target: 'creature',
        amount: 8,
        damageType: 'fire',
        source: 'Immolate',
      }),
    ).toBe('Mossback Toad takes 8 fire damage from Immolate');
  });

  it('narrates heal / buff / debuff', () => {
    expect(
      fmt({ kind: 'heal', actor: 'player', target: 'player', amount: 20, source: 'Evasive Leap' }),
    ).toBe('You heal 20 HP with Evasive Leap');
    expect(fmt({ kind: 'buff', actor: 'player', label: 'ATK ↑ +10', source: 'Battle Cry' })).toBe(
      'You gain ATK ↑ +10 (Battle Cry)',
    );
    expect(
      fmt({
        kind: 'debuff',
        actor: 'player',
        target: 'creature',
        label: 'DEF ↓ -5',
        source: 'Curse',
      }),
    ).toBe('Mossback Toad suffers DEF ↓ -5 (Curse)');
  });

  it('narrates defeat for either side', () => {
    expect(fmt({ kind: 'defeat', actor: 'player', target: 'creature' })).toBe(
      'Mossback Toad is defeated!',
    );
    expect(fmt({ kind: 'defeat', actor: 'creature', target: 'player' })).toBe('You were defeated!');
  });
});
