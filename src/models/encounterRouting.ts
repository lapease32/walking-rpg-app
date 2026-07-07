/**
 * The hybrid idle/active encounter gate (pure decision function).
 *
 * Called only for a freshly-rolled encounter when NO encounter is already active — the caller
 * (onDistanceEncounterUpdate) early-returns while one is open/minimized, so overlapping rolls are
 * simply skipped (pacing preserved) and never reach here. Routes one of three ways:
 * - `present` — open the active EncounterModal (Fight, or Auto-Resolve for below-rare). The
 *   FOREGROUND default: when the player is in the app, every encounter is a real, engageable fight
 *   rather than a silent idle resolution.
 * - `hold` — stash a BACKGROUND elite as a "worthy foe" (inline card + notification) to engage on
 *   the next foreground. Only elites are worth interrupting for later.
 * - `passive` — auto-resolve a BACKGROUND common into the walk summary (idle-tier).
 */
export type EncounterRoute = 'present' | 'hold' | 'passive';

export function resolveEncounterRoute(params: {
  /** App is not in the foreground (can't present an interactive fight). */
  isBackground: boolean;
  /** Creature is rare or above (isEliteCreature). */
  isElite: boolean;
}): EncounterRoute {
  const { isBackground, isElite } = params;
  // Foreground → present it as an active encounter (the whole point of this gate).
  if (!isBackground) return 'present';
  // Backgrounded elite → hold it as a worthy foe for later; backgrounded common → auto-resolve idle.
  return isElite ? 'hold' : 'passive';
}
