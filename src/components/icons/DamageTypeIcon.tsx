import React from 'react';
import Svg, { Path, G } from 'react-native-svg';
import { IconProps } from './AbilityIcon';
import { DamageType } from '../../models/DamageType';

/**
 * Filled "Luminous Flat" glyphs for the four damage types, drawn with react-native-svg primitives.
 * Keyed by damage type through {@link DAMAGE_TYPE_ICONS}. Callers typically tint by the element
 * color (see DAMAGE_TYPE_COLORS in the combat surfaces).
 */
const Fill = ({
  size = 24,
  color = '#fff',
  style,
  children,
}: IconProps & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <G fill={color}>{children}</G>
  </Svg>
);

const PhysicalIcon = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M12 2 L14 5 V13 H10 V5 Z" />
    <Path d="M7.5 13 H16.5 V15 H7.5 Z" />
    <Path d="M11 15 H13 V20 H11 Z" />
  </Fill>
);

const FireIcon = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M12 2 C16 8 18 10 16.5 15 A5 5 0 1 1 7.5 15 C7 12 8 10.5 9 9.5 C9.5 12 11 12 11 11 C12 9 10.5 5 12 2 Z" />
  </Fill>
);

// Frost — a six-spoke snowflake (stroke: ice reads best as line).
const FrostIcon = ({ size = 24, color = '#fff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <G stroke={color} strokeWidth={1.8} strokeLinecap="round" fill="none">
      <Path d="M12 3 V21" />
      <Path d="M4.5 7.5 L19.5 16.5" />
      <Path d="M19.5 7.5 L4.5 16.5" />
      <Path d="M12 6.5 L10 4.5 M12 6.5 L14 4.5 M12 17.5 L10 19.5 M12 17.5 L14 19.5" />
    </G>
  </Svg>
);

const ArcaneIcon = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M12 3 C12.6 9 13.2 10.4 20 12 C13.2 13.6 12.6 15 12 21 C11.4 15 10.8 13.6 4 12 C10.8 10.4 11.4 9 12 3 Z" />
  </Fill>
);

/** Damage type → glyph. */
export const DAMAGE_TYPE_ICONS: Record<DamageType, React.FC<IconProps>> = {
  physical: PhysicalIcon,
  fire: FireIcon,
  frost: FrostIcon,
  arcane: ArcaneIcon,
};

/** Render a damage type's glyph. */
export default function DamageTypeIcon({
  type,
  size = 24,
  color = '#fff',
  style,
}: IconProps & { type: DamageType }) {
  const Glyph = DAMAGE_TYPE_ICONS[type];
  return <Glyph size={size} color={color} style={style} />;
}
