// The registry imports 10 Reanimated/SVG-backed body components at module load. This suite tests
// only the registry's pure logic, so stub the animation runtime with a minimal inline mock — that
// keeps the (unused, v4-broken) real Reanimated jest mock out of a pure unit test without touching
// shared setup. react-native-svg imports cleanly under jest (see elementEmblem.test), so it's left real.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View, createAnimatedComponent: (c: unknown) => c },
  useSharedValue: (v: unknown) => ({ value: v }),
  useAnimatedStyle: () => ({}),
  withTiming: (v: unknown) => v,
  withRepeat: (v: unknown) => v,
  withSequence: (v: unknown) => v,
  Easing: { inOut: () => 0, in: () => 0, out: () => 0, quad: () => 0, sin: () => 0 },
}));

import {
  resolveCreatureBody,
  deriveCreatureAnimState,
  CREATURE_BODIES,
} from '../../components/combat/creatures/registry';
import { CREATURE_TEMPLATES } from '../../models/Creature';

// Every common-tier creature should have a hand-authored body (Sump Ooze pilot + the roster batch).
const COMMON_BODY_IDS = [
  'sump_ooze',
  'forest_sprite',
  'urban_phantom',
  'alley_cur',
  'gutter_swarm',
  'mossback_toad',
  'grit_golemling',
  'pale_stray',
  'ash_wretch',
  'copper_sentinel',
];

describe('resolveCreatureBody', () => {
  it.each(COMMON_BODY_IDS)('returns a body for the registered creature id "%s"', id => {
    expect(resolveCreatureBody(id)).toBeDefined();
  });

  it('returns undefined for an unregistered id (falls back to the emblem)', () => {
    expect(resolveCreatureBody('mountain_guardian')).toBeUndefined();
  });

  it('returns undefined when no id is provided', () => {
    expect(resolveCreatureBody(undefined)).toBeUndefined();
    expect(resolveCreatureBody('')).toBeUndefined();
  });

  it('covers every common-tier creature', () => {
    const registered = new Set(Object.keys(CREATURE_BODIES));
    const commonIds = CREATURE_TEMPLATES.filter(t => t.rarity === 'common').map(t => t.id);
    for (const id of commonIds) {
      expect(registered.has(id)).toBe(true);
    }
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
