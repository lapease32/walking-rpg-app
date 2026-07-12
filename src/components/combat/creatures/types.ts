import type React from 'react';

/**
 * Animation state a creature body plays. Kept intentionally small — it's the ONLY signal a body
 * needs from combat, derived from live encounter state (see {@link deriveCreatureAnimState}):
 *   idle   — resting/breathing (default, and every out-of-combat surface)
 *   attack — the creature's counter-attack beat (the "enemy turn")
 *   death  — defeated; play the one-shot melt/fade
 */
export type CreatureAnimState = 'idle' | 'attack' | 'death';

export interface CreatureBodyProps {
  /** Rendered size in px (square). The plate sizes this to fit inside the medallion. */
  size: number;
  /** Element tint for the creature — bodies may key their palette off it (see {@link emblemColor}). */
  color: string;
  /** Current animation state, driven by live combat. */
  state: CreatureAnimState;
}

export type CreatureBody = React.FC<CreatureBodyProps>;
