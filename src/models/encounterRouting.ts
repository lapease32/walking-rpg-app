/**
 * The hybrid idle/active encounter gate (pure decision function).
 *
 * A freshly-rolled encounter is routed one of three ways:
 * - `present` — open the active EncounterModal (Fight, or Auto-Resolve for below-rare). This is the
 *   FOREGROUND default: when the player is actively in the app, every encounter is a real, engageable
 *   fight rather than a silent idle resolution.
 * - `hold` — stash a BACKGROUND elite as a "worthy foe" (inline card + notification) to engage on the
 *   next foreground. Only elites are worth interrupting for later.
 * - `passive` — auto-resolve into the walk summary (idle-tier). Covers background commons, and the
 *   foreground case where an encounter is already being handled (don't overwrite/lose it).
 */
export type EncounterRoute = 'present' | 'hold' | 'passive';

export function resolveEncounterRoute(params: {
  /** App is not in the foreground (can't present an interactive fight). */
  isBackground: boolean;
  /** Creature is rare or above (isEliteCreature). */
  isElite: boolean;
  /** An encounter is already active/minimized — presenting a new one would clobber it. */
  busy: boolean;
}): EncounterRoute {
  const { isBackground, isElite, busy } = params;
  // Foreground and free → present it as an active encounter (the whole point of this gate).
  if (!isBackground && !busy) return 'present';
  // Backgrounded elite → hold it as a worthy foe for later.
  if (isBackground && isElite) return 'hold';
  // Everything else auto-resolves idle: background commons, or a foreground roll while already busy.
  return 'passive';
}
