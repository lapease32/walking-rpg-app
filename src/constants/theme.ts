/**
 * Theme tokens — the app's single source of colour truth.
 *
 * TWO palettes, one world (see the day/night design):
 *   - NIGHT: near-black grounds, bone text, ember accent.
 *   - DAY:   weathered bone / bleached ash / overcast parchment, dark ink text, rust-oxide accent.
 *
 * DAY IS NOT A "LIGHT MODE". It's grim-but-daylit — genuinely readable in direct sunlight (the only
 * real argument for a light theme in a walking app) while never breaking the dark-fantasy tone. A
 * hot ember accent would glow wrong in daylight, so day's accent is a rust oxide.
 *
 * The token set is a TYPED interface on purpose: a missing/misspelled token is a compile error, not
 * a silently-black label on a black panel (exactly the bug the web preview shipped with).
 *
 * NOT tokens — these are ART/game semantics and stay fixed across themes:
 *   - rarity colours (constants/rarity), element colours + creature/icon art (components/icons,
 *     components/combat/creatures), and the combat FX/floater colours — all of which render on the
 *     always-dark creature plate.
 */

export interface ThemeTokens {
  /** App background. */
  bg: string;
  /** Cards, modals — the primary raised surface. */
  surface: string;
  /** A nested/inset panel on top of `surface`. */
  surfaceAlt: string;
  /** A panel that should read as lifted above `surfaceAlt`. */
  surfaceRaised: string;
  border: string;
  divider: string;

  text: string;
  textSecondary: string;
  textMuted: string;

  /** Primary interactive/brand colour. */
  accent: string;
  /** Text/icon colour that sits ON `accent`. */
  onAccent: string;

  danger: string;
  success: string;
  warning: string;
  info: string;

  /** Modal scrim. */
  overlay: string;
  /** Track behind a progress/HP bar. */
  track: string;

  /** Damage-type colours for ABILITY BUTTONS (UI). The FX/floater colours are art and stay fixed. */
  physical: string;
  fire: string;
  frost: string;
  arcane: string;

  /** The creature plate stays dark-ish in both themes — it's a window into the creature's world. */
  plateBg: string;
  plateRing: string;

  /** StatusBar content style for this theme. */
  statusBar: 'light-content' | 'dark-content';
}

export type ThemeName = 'night' | 'day';

export const NIGHT: ThemeTokens = {
  bg: '#0A0A0E',
  surface: '#14141B',
  surfaceAlt: '#1B1B24',
  surfaceRaised: '#22222C',
  border: '#2A2833',
  divider: '#232029',

  text: '#ECE7EA',
  textSecondary: '#A09AA2',
  textMuted: '#66616C',

  accent: '#FF6A2A',
  onAccent: '#14141B',

  danger: '#C4453B',
  success: '#6FA05E',
  warning: '#D9A441',
  info: '#5A8AA0',

  overlay: 'rgba(0,0,0,0.78)',
  track: '#23222C',

  physical: '#8A8F98',
  fire: '#C25A2A',
  frost: '#5A8AA0',
  arcane: '#8A5FA0',

  plateBg: '#0B0B10',
  plateRing: '#3A3742',

  statusBar: 'light-content',
};

export const DAY: ThemeTokens = {
  bg: '#C9C3B5',
  surface: '#E0DACC',
  surfaceAlt: '#D2CBBB',
  surfaceRaised: '#EBE6DA',
  border: '#B2A895',
  divider: '#C3BBA9',

  text: '#2B2721',
  textSecondary: '#5A5346',
  textMuted: '#8B8474',

  accent: '#A5442A',
  onAccent: '#EBE6DA',

  danger: '#8E2F26',
  success: '#5E6E3C',
  warning: '#97762C',
  info: '#4E7286',

  overlay: 'rgba(45,40,32,0.55)',
  track: '#BEB6A5',

  physical: '#6E6A5E',
  fire: '#A5442A',
  frost: '#4E7286',
  arcane: '#6E4A80',

  plateBg: '#B8B0A0',
  plateRing: '#9A9080',

  statusBar: 'dark-content',
};

export const THEMES: Record<ThemeName, ThemeTokens> = { night: NIGHT, day: DAY };

/** HP-bar fill by remaining fraction — themed, so it stays legible on both grounds. */
export function hpColor(hp: number, maxHp: number, t: ThemeTokens): string {
  const ratio = maxHp > 0 ? hp / maxHp : 0;
  if (ratio > 0.5) return t.success;
  if (ratio > 0.25) return t.warning;
  return t.danger;
}
