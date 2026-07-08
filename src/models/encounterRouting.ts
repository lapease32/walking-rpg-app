/**
 * The hybrid idle/active encounter gate (pure decision function).
 *
 * Called only for a freshly-rolled encounter when NO encounter is already active — the caller
 * (onDistanceEncounterUpdate) early-returns while one is open/minimized, so overlapping rolls are
 * simply skipped (pacing preserved) and never reach here. Routes one of four ways:
 * - `present` — open the active EncounterModal (Fight, or Auto-Resolve for below-rare). The
 *   FOREGROUND default: when the player is in the app, every encounter is a real, engageable fight
 *   rather than a silent idle resolution.
 * - `autoResolve` — the player has idle-mode ON (the "auto-resolve below-rare" toggle): skip a
 *   below-rare FOREGROUND encounter without a modal, granting the SAME active-tier reward as
 *   fighting it (recorded to the walk summary). Trivial fights are skipped, not penalized.
 * - `hold` — stash a BACKGROUND elite as a "worthy foe" (inline card + notification) to engage on
 *   the next foreground. Only elites are worth interrupting for later.
 * - `passive` — auto-resolve a BACKGROUND below-rare encounter into the walk summary (idle-tier).
 *
 * `autoResolve` (foreground, active-tier) and `passive` (background, idle-tier) are both silent
 * auto-resolutions into the summary; they differ in reward tier and in what triggers them. Elites
 * are NEVER auto-resolved — the toggle only skips below-rare, so meaningful content always requires
 * an active fight.
 */
export type EncounterRoute = 'present' | 'autoResolve' | 'hold' | 'passive';

export function resolveEncounterRoute(params: {
  /** App is not in the foreground (can't present an interactive fight). */
  isBackground: boolean;
  /** Creature is rare or above (isEliteCreature). */
  isElite: boolean;
  /** Player's idle-mode toggle: auto-resolve below-rare encounters instead of presenting them. */
  autoResolveBelowRare: boolean;
}): EncounterRoute {
  const { isBackground, isElite, autoResolveBelowRare } = params;
  if (!isBackground) {
    // FOREGROUND. Elites are always an active fight (the toggle never applies to them). Below-rare:
    // auto-resolve at active-tier when idle-mode is on, otherwise present it as an engageable fight.
    if (!isElite && autoResolveBelowRare) return 'autoResolve';
    return 'present';
  }
  // BACKGROUND: hold an elite as a worthy foe for later; auto-resolve a below-rare idle-tier.
  return isElite ? 'hold' : 'passive';
}
