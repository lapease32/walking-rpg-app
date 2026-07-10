import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';

/**
 * A cohesive "Luminous Flat" icon set for the ability roster, drawn with react-native-svg
 * primitives. Filled solids to match the item / stat / damage-type sets, with stroke reserved for
 * the inherently-linear glyphs (frost snowflake, evasive motion) — mirroring how DamageTypeIcon
 * keeps frost as a stroke. Every glyph inherits a single `color`.
 *
 * Keyed by ability id through {@link ABILITY_ICONS} and rendered via {@link AbilityIcon}. The
 * registry indirection is deliberate: swapping this set for the chosen art Direction's icons is a
 * drop-in change here, with no caller edits.
 */
export interface IconProps {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

const FillFrame = ({
  size = 24,
  color = '#fff',
  style,
  children,
}: IconProps & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <G fill={color}>{children}</G>
  </Svg>
);

// Stroke frame for the linear glyphs (round caps/joins, no fill).
const LineFrame = ({
  size = 24,
  color = '#fff',
  style,
  width = 1.8,
  children,
}: IconProps & { width?: number; children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <G stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {children}
    </G>
  </Svg>
);

// ── Martial ──────────────────────────────────────────────────────────────
const StrikeIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M12 2 L14 5 V13 H10 V5 Z" />
    <Path d="M7.5 13 H16.5 V15 H7.5 Z" />
    <Path d="M11 15 H13 V20 H11 Z" />
  </FillFrame>
);

// Two stacked solid chevrons — a powered-up strike.
const PowerStrikeIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M12 4 L20 12 H16 L12 8 L8 12 H4 Z" />
    <Path d="M12 11 L20 19 H16 L12 15 L8 19 H4 Z" />
  </FillFrame>
);

const BattleCryIcon = ({ color = '#fff', ...p }: IconProps) => (
  <FillFrame color={color} {...p}>
    <Path d="M4 10 H8 L14 6.5 V17.5 L8 14 H4 Z" />
    <Path
      d="M16.5 9 Q19 12 16.5 15"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
  </FillFrame>
);

const ExecuteIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path
      fillRule="evenodd"
      d="M6 10 A6 6 0 0 1 18 10 V14 Q18 16 16 16 V18 H8 V16 Q6 16 6 14 Z M9.8 10 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M14.2 10 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M12 12 L11.1 13.4 H12.9 Z"
    />
  </FillFrame>
);

// ── Agile ────────────────────────────────────────────────────────────────
// A curved blade streak — a swift slash.
const QuickSlashIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M5 18.5 Q9 6 19 8 Q11 9.2 6.6 17.8 Q6.1 18.9 5 18.5 Z" />
  </FillFrame>
);

// Two solid downward fangs.
const TwinFangsIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M5.5 6 H11 L8.25 15.5 Z" />
    <Path d="M13 6 H18.5 L15.75 15.5 Z" />
  </FillFrame>
);

const HemorrhageIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M12 3 C12 3 6 11 6 15 A6 6 0 0 0 18 15 C18 11 12 3 12 3 Z" />
  </FillFrame>
);

// Motion swirl — stays a stroke (like the flee glyph), slightly bolder.
const EvasiveLeapIcon = (p: IconProps) => (
  <LineFrame width={2} {...p}>
    <Path d="M17.5 8.5 A5.2 5.2 0 1 0 18 13.5" />
    <Path d="M18 13.5 L20 12 M18 13.5 L18.8 15.6" />
  </LineFrame>
);

// ── Mage ─────────────────────────────────────────────────────────────────
const ArcaneBoltIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M12 4 C12.5 9 13 10.5 20 12 C13 13.5 12.5 15 12 20 C11.5 15 11 13.5 4 12 C11 10.5 11.5 9 12 4 Z" />
  </FillFrame>
);

const FireballIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M12 3 C15 8 17 9 16 14 A4.5 4.5 0 1 1 8 14 C7.6 11 9 10 9.6 9 C10 11 11 11.4 11.4 11 C12.4 10 11 6 12 3 Z" />
  </FillFrame>
);

// Snowflake — stays a stroke (mirrors DamageTypeIcon frost).
const FrostBoltIcon = (p: IconProps) => (
  <LineFrame {...p}>
    <Path d="M12 3 V21" />
    <Path d="M4.5 7.5 L19.5 16.5" />
    <Path d="M19.5 7.5 L4.5 16.5" />
    <Path d="M12 6.5 L10 4.5 M12 6.5 L14 4.5 M12 17.5 L10 19.5 M12 17.5 L14 19.5" />
  </LineFrame>
);

// A fuller flame with a hollow core (evenodd) — reads hotter than fireball.
const ImmolateIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path
      fillRule="evenodd"
      d="M12 2 C16 8 18 10 16.5 15 A5 5 0 1 1 7.5 15 C7 12 8 10.5 9 9.5 C9.5 12 11 12 11 11 C12 9 10.5 5 12 2 Z M12 12.8 C13 14.2 13.3 15.5 12 17.2 C11 15.8 11.1 14.4 12 12.8 Z"
    />
  </FillFrame>
);

// An eight-point burst — bigger than the four-point arcane bolt.
const ArcaneSurgeIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M12 2 L13.4 8.6 L18 5.6 L15.4 10.6 L22 12 L15.4 13.4 L18 18.4 L13.4 15.4 L12 22 L10.6 15.4 L6 18.4 L8.6 13.4 L2 12 L8.6 10.6 L6 5.6 L10.6 8.6 Z" />
  </FillFrame>
);

/** Rendered when an ability id has no dedicated glyph — a neutral spark, so nothing breaks. */
const FallbackIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M12 4 C12.5 9 13 10.5 20 12 C13 13.5 12.5 15 12 20 C11.5 15 11 13.5 4 12 C11 10.5 11.5 9 12 4 Z" />
  </FillFrame>
);

/** Ability id → glyph. Kept exhaustive against ARCHETYPE_ABILITIES (see abilityIcon.test). */
export const ABILITY_ICONS: Record<string, React.FC<IconProps>> = {
  strike: StrikeIcon,
  power_strike: PowerStrikeIcon,
  battle_cry: BattleCryIcon,
  execute: ExecuteIcon,
  quick_slash: QuickSlashIcon,
  twin_fangs: TwinFangsIcon,
  hemorrhage: HemorrhageIcon,
  evasive_leap: EvasiveLeapIcon,
  arcane_bolt: ArcaneBoltIcon,
  fireball: FireballIcon,
  frost_bolt: FrostBoltIcon,
  immolate: ImmolateIcon,
  arcane_surge: ArcaneSurgeIcon,
};

/** Look up an ability's glyph by id and render it, falling back to a neutral spark. */
export default function AbilityIcon({
  id,
  size = 24,
  color = '#fff',
  style,
}: IconProps & { id: string }) {
  const Glyph = ABILITY_ICONS[id] ?? FallbackIcon;
  return <Glyph size={size} color={color} style={style} />;
}
