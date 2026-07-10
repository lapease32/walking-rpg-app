import React from 'react';
import Svg, { Path, G } from 'react-native-svg';
import { IconProps } from './AbilityIcon';

/**
 * Filled "Luminous Flat" glyphs for the core stats, drawn with react-native-svg primitives.
 * hp is a solid heart; maxHp is a heart with a plus cut out, so the two read apart by SHAPE
 * (the old ❤️/💚 relied on color alone). Keyed by stat through {@link STAT_ICONS}.
 */
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

const HEART =
  'M12 21 C12 21 3 14.2 3 8.6 C3 5.6 5.3 4 7.6 4 C9.6 4 11 5.4 12 7 C13 5.4 14.4 4 16.4 4 C18.7 4 21 5.6 21 8.6 C21 14.2 12 21 12 21 Z';
// A plus punched into the heart centre (subpath + evenodd → hole).
const PLUS_HOLE = 'M11.1 7.4 H12.9 V9.9 H15.4 V11.7 H12.9 V14.2 H11.1 V11.7 H8.6 V9.9 H11.1 Z';

const AttackIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M12 2 L14 5 V13 H10 V5 Z" />
    <Path d="M7.5 13 H16.5 V15 H7.5 Z" />
    <Path d="M11 15 H13 V20 H11 Z" />
  </FillFrame>
);

const DefenseIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M12 2 L20 5 V11 C20 16 16.5 19.8 12 22 C7.5 19.8 4 16 4 11 V5 Z" />
  </FillFrame>
);

const HpIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d={HEART} />
  </FillFrame>
);

const MaxHpIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path fillRule="evenodd" d={`${HEART} ${PLUS_HOLE}`} />
  </FillFrame>
);

export type StatIconKey = 'attack' | 'defense' | 'hp' | 'maxHp';

/** Stat → glyph. */
export const STAT_ICONS: Record<StatIconKey, React.FC<IconProps>> = {
  attack: AttackIcon,
  defense: DefenseIcon,
  hp: HpIcon,
  maxHp: MaxHpIcon,
};

/** Render a stat's glyph. */
export default function StatIcon({
  stat,
  size = 24,
  color = '#fff',
  style,
}: IconProps & { stat: StatIconKey }) {
  const Glyph = STAT_ICONS[stat];
  return <Glyph size={size} color={color} style={style} />;
}
