import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';

/**
 * A cohesive monochrome line-icon set for the ability roster, drawn with react-native-svg
 * primitives (no external asset / transformer needed). Every glyph inherits a single `color`,
 * so the icon tints to the button's element color or any palette.
 *
 * These are keyed by ability id through {@link ABILITY_ICONS} and rendered via {@link AbilityIcon}.
 * The registry indirection is deliberate: swapping this first functional set for game-icons.net
 * glyphs — or the chosen art Direction's icons — is a drop-in change here, with no caller edits.
 */
export interface IconProps {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

const STROKE = 1.8;

// Shared stroke frame: round line caps/joins, no fill, tinted by `color`.
const LineFrame = ({
  size = 24,
  color = '#fff',
  style,
  children,
}: IconProps & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style} fill="none">
    <G stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {children}
    </G>
  </Svg>
);

// ── Martial ──────────────────────────────────────────────────────────────
const StrikeIcon = ({ color = '#fff', ...p }: IconProps) => (
  <LineFrame color={color} {...p}>
    <Path d="M12 3 L12 13.5" />
    <Path d="M8.5 13.5 H15.5" />
    <Path d="M12 13.5 V18.5" />
    <Circle cx={12} cy={20} r={1.3} fill={color} stroke="none" />
  </LineFrame>
);

const PowerStrikeIcon = (p: IconProps) => (
  <LineFrame {...p}>
    <Path d="M6 12 L12 6.5 L18 12" />
    <Path d="M6 17.5 L12 12 L18 17.5" />
  </LineFrame>
);

const BattleCryIcon = (p: IconProps) => (
  <LineFrame {...p}>
    <Path d="M4 10 H8 L14 6.5 V17.5 L8 14 H4 Z" />
    <Path d="M17 9 A4 4 0 0 1 17 15" />
  </LineFrame>
);

const ExecuteIcon = ({ color = '#fff', ...p }: IconProps) => (
  <LineFrame color={color} {...p}>
    <Path d="M6 11 A6 6 0 0 1 18 11 V14 Q18 16 16 16 V18 H8 V16 Q6 16 6 14 Z" />
    <Circle cx={9.8} cy={11} r={1.4} fill={color} stroke="none" />
    <Circle cx={14.2} cy={11} r={1.4} fill={color} stroke="none" />
    <Path d="M12 13 L11 14.5 H13 Z" fill={color} stroke="none" />
  </LineFrame>
);

// ── Agile ────────────────────────────────────────────────────────────────
const QuickSlashIcon = (p: IconProps) => (
  <LineFrame {...p}>
    <Path d="M5 17 Q12 5 19 9" />
    <Path d="M17 6 L19 9 L16 10" />
  </LineFrame>
);

const TwinFangsIcon = (p: IconProps) => (
  <LineFrame {...p}>
    <Path d="M7 6 H17" />
    <Path d="M8.5 6 L10.5 15 L12.5 6" />
    <Path d="M13 6 L15 15 L17 6" />
  </LineFrame>
);

const HemorrhageIcon = (p: IconProps) => (
  <LineFrame {...p}>
    <Path d="M12 4 C12 4 6 11 6 15 A6 6 0 0 0 18 15 C18 11 12 4 12 4 Z" />
  </LineFrame>
);

const EvasiveLeapIcon = (p: IconProps) => (
  <LineFrame {...p}>
    <Path d="M17.5 8.5 A5.2 5.2 0 1 0 18 13.5" />
    <Path d="M18 13.5 L20 12 M18 13.5 L18.8 15.6" />
  </LineFrame>
);

// ── Mage ─────────────────────────────────────────────────────────────────
const ArcaneBoltIcon = ({ color = '#fff', ...p }: IconProps) => (
  <LineFrame color={color} {...p}>
    <Path
      d="M12 4 C12.5 9 13 10.5 20 12 C13 13.5 12.5 15 12 20 C11.5 15 11 13.5 4 12 C11 10.5 11.5 9 12 4 Z"
      fill={color}
      stroke="none"
    />
  </LineFrame>
);

const FireballIcon = (p: IconProps) => (
  <LineFrame {...p}>
    <Path d="M12 3 C15 8 17 9 16 14 A4.5 4.5 0 1 1 8 14 C7.6 11 9 10 9.6 9 C10 11 11 11.4 11.4 11 C12.4 10 11 6 12 3 Z" />
  </LineFrame>
);

const FrostBoltIcon = (p: IconProps) => (
  <LineFrame {...p}>
    <Path d="M12 3 V21" />
    <Path d="M4.5 7.5 L19.5 16.5" />
    <Path d="M19.5 7.5 L4.5 16.5" />
    <Path d="M12 6.5 L10 4.5 M12 6.5 L14 4.5 M12 17.5 L10 19.5 M12 17.5 L14 19.5" />
  </LineFrame>
);

const ImmolateIcon = ({ color = '#fff', ...p }: IconProps) => (
  <LineFrame color={color} {...p}>
    <Path d="M12 2 C16 8 18 10 16.5 15 A5 5 0 1 1 7.5 15 C7 12 8 10.5 9 9.5 C9.5 12 11 12 11 11 C12 9 10.5 5 12 2 Z" />
    <Path
      d="M12 12.5 C13 14 13.4 15.4 12 17.2 C10.8 15.6 11 14.2 12 12.5 Z"
      fill={color}
      stroke="none"
    />
  </LineFrame>
);

const ArcaneSurgeIcon = ({ color = '#fff', ...p }: IconProps) => (
  <LineFrame color={color} {...p}>
    <Path d="M12 3 V7 M12 17 V21 M3 12 H7 M17 12 H21 M6 6 L8.8 8.8 M15.2 15.2 L18 18 M18 6 L15.2 8.8 M8.8 15.2 L6 18" />
    <Circle cx={12} cy={12} r={2.2} fill={color} stroke="none" />
  </LineFrame>
);

/** Rendered when an ability id has no dedicated glyph — a neutral spark, so nothing breaks. */
const FallbackIcon = ({ color = '#fff', ...p }: IconProps) => (
  <LineFrame color={color} {...p}>
    <Circle cx={12} cy={12} r={6} />
    <Circle cx={12} cy={12} r={1.6} fill={color} stroke="none" />
  </LineFrame>
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
