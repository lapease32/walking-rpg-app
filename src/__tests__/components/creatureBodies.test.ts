// The registry imports the Reanimated/SVG-backed body components at module load. This suite tests
// only the registry's pure logic, so stub the body module — that keeps the animation runtime
// (whose v4 jest mock is unused/broken) out of a pure unit test, without touching shared setup.
jest.mock('../../components/combat/creatures/SumpOozeBody', () => ({
  __esModule: true,
  default: () => null,
}));

import {
  resolveCreatureBody,
  deriveCreatureAnimState,
  CREATURE_BODIES,
} from '../../components/combat/creatures/registry';
import { CREATURE_TEMPLATES } from '../../models/Creature';

describe('resolveCreatureBody', () => {
  it('returns a body for a registered creature id', () => {
    expect(resolveCreatureBody('sump_ooze')).toBeDefined();
  });

  it('returns undefined for an unregistered id (falls back to the emblem)', () => {
    expect(resolveCreatureBody('forest_sprite')).toBeUndefined();
  });

  it('returns undefined when no id is provided', () => {
    expect(resolveCreatureBody(undefined)).toBeUndefined();
    expect(resolveCreatureBody('')).toBeUndefined();
  });

  it('only registers ids that exist in the creature roster', () => {
    const roster = new Set(CREATURE_TEMPLATES.map(t => t.id));
    for (const id of Object.keys(CREATURE_BODIES)) {
      expect(roster.has(id)).toBe(true);
    }
  });
});

describe('deriveCreatureAnimState', () => {
  it('idles by default', () => {
    expect(deriveCreatureAnimState({})).toBe('idle');
    expect(deriveCreatureAnimState({ isDefeated: false, isEnemyTurn: false })).toBe('idle');
  });

  it('attacks during the enemy turn', () => {
    expect(deriveCreatureAnimState({ isEnemyTurn: true })).toBe('attack');
  });

  it('dies when defeated', () => {
    expect(deriveCreatureAnimState({ isDefeated: true })).toBe('death');
  });

  it('death takes precedence over the enemy turn', () => {
    expect(deriveCreatureAnimState({ isDefeated: true, isEnemyTurn: true })).toBe('death');
  });
});
