import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { IconProps } from './AbilityIcon';

/**
 * Filled "Luminous Flat" emblems for the creature `type` taxonomy (elemental/thematic, not
 * morphological). These give a creature visual identity by element until figurative sprite art is
 * produced (see the art-direction pipeline decision). Keyed by type through {@link ELEMENT_EMBLEMS};
 * {@link ELEMENT_COLORS} is the per-type tint. New creature types add an entry to both + a glyph.
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
const Line = ({
  size = 24,
  color = '#fff',
  style,
  w = 1.8,
  children,
}: IconProps & { w?: number; children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <G stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {children}
    </G>
  </Svg>
);

const Fire = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M12 2 C16 8 18 10 16.5 15 A5 5 0 1 1 7.5 15 C7 12 8 10.5 9 9.5 C9.5 12 11 12 11 11 C12 9 10.5 5 12 2 Z" />
  </Fill>
);
const Frost = (p: IconProps) => (
  <Line {...p}>
    <Path d="M12 3 V21" />
    <Path d="M4.5 7.5 L19.5 16.5" />
    <Path d="M19.5 7.5 L4.5 16.5" />
    <Path d="M12 6.5 L10 4.5 M12 6.5 L14 4.5 M12 17.5 L10 19.5 M12 17.5 L14 19.5" />
  </Line>
);
const Water = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M12 3 C12 3 5.5 11 5.5 15.2 A6.5 6.5 0 0 0 18.5 15.2 C18.5 11 12 3 12 3 Z" />
  </Fill>
);
const Air = (p: IconProps) => (
  <Line {...p} w={2}>
    <Path d="M3 8 H13 A2.6 2.6 0 1 0 10.4 5.4" />
    <Path d="M3 12 H18 A2.6 2.6 0 1 1 15.4 14.6" />
    <Path d="M3 16 H10" />
  </Line>
);
const Earth = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M8 3 H16 L20 10 L12 21 L4 10 Z" />
  </Fill>
);
const Nature = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M20 4 C9 4 4 11 4 20 C13 20 20 15 20 4 Z" />
  </Fill>
);
const Shadow = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M14.5 3.2 A9 9 0 1 0 14.5 20.8 A7 7 0 1 1 14.5 3.2 Z" />
  </Fill>
);
const Arcane = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M12 2 L13.4 8.6 L18 5.6 L15.4 10.6 L22 12 L15.4 13.4 L18 18.4 L13.4 15.4 L12 22 L10.6 15.4 L6 18.4 L8.6 13.4 L2 12 L8.6 10.6 L6 5.6 L10.6 8.6 Z" />
  </Fill>
);
const Spirit = (p: IconProps) => (
  <Fill {...p}>
    <Path
      fillRule="evenodd"
      d="M6 20.5 V11 A6 6 0 0 1 18 11 V20.5 L15.5 18.5 L13.5 20.5 L12 18.8 L10.5 20.5 L8.5 18.5 Z M10 10.5 m-1.1 0 a1.1 1.1 0 1 0 2.2 0 a1.1 1.1 0 1 0 -2.2 0 M14 10.5 m-1.1 0 a1.1 1.1 0 1 0 2.2 0 a1.1 1.1 0 1 0 -2.2 0"
    />
  </Fill>
);
const Undead = (p: IconProps) => (
  <Fill {...p}>
    <Path
      fillRule="evenodd"
      d="M6 10 A6 6 0 0 1 18 10 V14 Q18 16 16 16 V18 H8 V16 Q6 16 6 14 Z M9.8 10 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M14.2 10 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M12 12 L11.1 13.4 H12.9 Z"
    />
  </Fill>
);
const Beast = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M12 12 C15.5 12 18 14.5 18 17.5 C18 20 16 20.5 14 19.5 C13 19 11 19 10 19.5 C8 20.5 6 20 6 17.5 C6 14.5 8.5 12 12 12 Z" />
    <Circle cx={6.5} cy={8.5} r={2} />
    <Circle cx={17.5} cy={8.5} r={2} />
    <Circle cx={9.5} cy={5.5} r={1.9} />
    <Circle cx={14.5} cy={5.5} r={1.9} />
  </Fill>
);
const Vermin = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M12 4 C14.5 4 16 7 16 11 C16 16 14.5 20 12 20 C9.5 20 8 16 8 11 C8 7 9.5 4 12 4 Z" />
    <Path
      d="M10.5 4 L8 2 M13.5 4 L16 2"
      fill="none"
      stroke={p.color ?? '#fff'}
      strokeWidth={1.6}
      strokeLinecap="round"
    />
  </Fill>
);
const Ooze = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M5 14 C5 8.5 8.5 7 12 7 C15.5 7 19 8.5 19 14 C19 18 16.5 19.5 15.5 18.5 C15 20 13.5 20.5 13 19 C12.5 20.5 11 20.5 10.5 19 C9.5 20 6.5 19.5 5 14 Z" />
  </Fill>
);
const Fungus = (p: IconProps) => (
  <Fill {...p}>
    <Path d="M4 12 A8 6 0 0 1 20 12 Z" />
    <Path d="M9.5 12 H14.5 V19 Q14.5 20.5 12 20.5 Q9.5 20.5 9.5 19 Z" />
  </Fill>
);
const Construct = (p: IconProps) => (
  <Fill {...p}>
    <Path
      fillRule="evenodd"
      d="M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z M12 9 A3 3 0 1 0 12.01 9 Z"
    />
  </Fill>
);

/** Creature type → emblem. */
export const ELEMENT_EMBLEMS: Record<string, React.FC<IconProps>> = {
  Fire,
  Frost,
  Water,
  Air,
  Earth,
  Nature,
  Shadow,
  Arcane,
  Spirit,
  Undead,
  Beast,
  Vermin,
  Ooze,
  Fungus,
  Construct,
};

/** Per-type tint. */
export const ELEMENT_COLORS: Record<string, string> = {
  Fire: '#FF7043',
  Frost: '#4FC3F7',
  Water: '#29B6F6',
  Air: '#90CAF9',
  Earth: '#A1887F',
  Nature: '#66BB6A',
  Shadow: '#7E57C2',
  Arcane: '#BA68C8',
  Spirit: '#B39DDB',
  Undead: '#90A4AE',
  Beast: '#FF8A65',
  Vermin: '#9CCC65',
  Ooze: '#26A69A',
  Fungus: '#AB47BC',
  Construct: '#78909C',
};

/** Emblem color for a creature type (falls back to a neutral). */
export const emblemColor = (type: string): string => ELEMENT_COLORS[type] ?? '#B0BEC5';

/** Render a creature type's emblem, tinted by its element unless `color` overrides. */
export default function ElementEmblem({
  type,
  size = 24,
  color,
  style,
}: IconProps & { type: string }) {
  const Glyph = ELEMENT_EMBLEMS[type];
  const tint = color ?? emblemColor(type);
  if (!Glyph) return null;
  return <Glyph size={size} color={tint} style={style} />;
}
