import React from 'react';
import Svg, { Path, G } from 'react-native-svg';
import { IconProps } from './AbilityIcon';

/**
 * Filled "Luminous Flat" glyphs for the per-archetype resources (rage / energy / mana), drawn with
 * react-native-svg primitives. Keyed by resource name through {@link RESOURCE_ICONS}.
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

// Rage — a flame.
const RageIcon = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M12 2 C16 8 18 10 16.5 15 A5 5 0 1 1 7.5 15 C7 12 8 10.5 9 9.5 C9.5 12 11 12 11 11 C12 9 10.5 5 12 2 Z" />
  </Fill>
);

// Energy — a lightning bolt.
const EnergyIcon = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M13 2 L6 13 H10.5 L9.5 22 L18 10 H13 Z" />
  </Fill>
);

// Mana — a droplet.
const ManaIcon = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M12 3 C12 3 5.5 11 5.5 15.2 A6.5 6.5 0 0 0 18.5 15.2 C18.5 11 12 3 12 3 Z" />
  </Fill>
);

/** Resource name → glyph. Falls back to the mana droplet for unknown resources. */
export const RESOURCE_ICONS: Record<string, React.FC<IconProps>> = {
  rage: RageIcon,
  energy: EnergyIcon,
  mana: ManaIcon,
};

/** Render a resource's glyph. */
export default function ResourceIcon({
  resource,
  size = 24,
  color = '#fff',
  style,
}: IconProps & { resource: string }) {
  const Glyph = RESOURCE_ICONS[resource] ?? ManaIcon;
  return <Glyph size={size} color={color} style={style} />;
}
