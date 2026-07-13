import type { CreatureBody, CreatureAnimState } from './types';
import SumpOozeBody from './SumpOozeBody';
import ForestSpriteBody from './ForestSpriteBody';
import UrbanPhantomBody from './UrbanPhantomBody';
import AlleyCurBody from './AlleyCurBody';
import GutterSwarmBody from './GutterSwarmBody';
import MossbackToadBody from './MossbackToadBody';
import GritGolemlingBody from './GritGolemlingBody';
import PaleStrayBody from './PaleStrayBody';
import AshWretchBody from './AshWretchBody';
import CopperSentinelBody from './CopperSentinelBody';

/**
 * Hand-authored vector creature bodies, keyed by the creature template `id` (see
 * `CREATURE_TEMPLATES` in models/Creature). This is the figurative-art layer that renders inside
 * {@link CreaturePlate}: a creature WITH a registered body shows it; every other creature falls
 * back to its element emblem. New creatures opt in simply by adding an entry here — the plate,
 * combat wiring, and every call site are already generic.
 *
 * Vector-first (react-native-svg + Reanimated); a hero unit can later be swapped for a richer
 * Rive/Skia body behind the same component without touching callers. Pilot: `sump_ooze`.
 */
export const CREATURE_BODIES: Record<string, CreatureBody> = {
  // Common tier
  sump_ooze: SumpOozeBody,
  forest_sprite: ForestSpriteBody,
  urban_phantom: UrbanPhantomBody,
  alley_cur: AlleyCurBody,
  gutter_swarm: GutterSwarmBody,
  mossback_toad: MossbackToadBody,
  grit_golemling: GritGolemlingBody,
  pale_stray: PaleStrayBody,
  ash_wretch: AshWretchBody,
  copper_sentinel: CopperSentinelBody,
};

/** The vector body for a creature id, or `undefined` when it should fall back to the emblem. */
export function resolveCreatureBody(creatureId?: string): CreatureBody | undefined {
  return creatureId ? CREATURE_BODIES[creatureId] : undefined;
}

/**
 * Map live encounter state to the body's animation state. Pure so it's unit-testable and the same
 * derivation is reusable at every call site. Death takes precedence over the enemy turn (a creature
 * defeated on its own counter should melt, not lunge).
 */
export function deriveCreatureAnimState(opts: {
  isDefeated?: boolean;
  isEnemyTurn?: boolean;
}): CreatureAnimState {
  if (opts.isDefeated) {
    return 'death';
  }
  if (opts.isEnemyTurn) {
    return 'attack';
  }
  return 'idle';
}
