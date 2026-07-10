import React from 'react';
import Svg, { Path, Rect, G } from 'react-native-svg';
import { IconProps } from './AbilityIcon';

/**
 * Filled "Luminous Flat" glyphs for one-off HUD controls (settings, inventory, close, etc.),
 * drawn with react-native-svg primitives. Each inherits a single `color`. Imported by name where
 * needed rather than through a registry — these are individual controls, not a keyed set.
 */
const Frame = ({
  size = 24,
  color = '#fff',
  style,
  children,
}: IconProps & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <G fill={color}>{children}</G>
  </Svg>
);

// Sliders — reads as "settings / adjust". Each bar carries a knob punched with a hole (evenodd).
export const SettingsIcon = ({ color = '#fff', ...p }: IconProps) => (
  <Frame color={color} {...p}>
    <Rect x={3} y={6.4} width={18} height={1.7} rx={0.85} />
    <Rect x={3} y={12.1} width={18} height={1.7} rx={0.85} />
    <Rect x={3} y={17.8} width={18} height={1.7} rx={0.85} />
    <Path
      fillRule="evenodd"
      d="M8 7.25 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M8 7.25 m-1 0 a1 1 0 1 1 2 0 a1 1 0 1 1 -2 0"
    />
    <Path
      fillRule="evenodd"
      d="M15 12.95 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M15 12.95 m-1 0 a1 1 0 1 1 2 0 a1 1 0 1 1 -2 0"
    />
    <Path
      fillRule="evenodd"
      d="M10 18.65 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M10 18.65 m-1 0 a1 1 0 1 1 2 0 a1 1 0 1 1 -2 0"
    />
  </Frame>
);

// Backpack — reads as "inventory".
export const InventoryIcon = (p: IconProps) => (
  <Frame {...p}>
    <Path d="M8 6 Q8 3 12 3 Q16 3 16 6 V7 H14.6 V6 Q14.6 4.4 12 4.4 Q9.4 4.4 9.4 6 V7 H8 Z" />
    <Path
      d="M5 8 H19 Q20 8 20 9.5 V19 Q20 21 18 21 H6 Q4 21 4 19 V9.5 Q4 8 5 8 Z M8.5 12 H15.5 V14.5 H8.5 Z"
      fillRule="evenodd"
    />
  </Frame>
);

// Two crossed strokes — a close / dismiss control.
export const CloseIcon = ({ size = 24, color = '#fff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <G stroke={color} strokeWidth={2.2} strokeLinecap="round" fill="none">
      <Path d="M6 6 L18 18 M18 6 L6 18" />
    </G>
  </Svg>
);

// Triangle with an exclamation punched out — a warning.
export const WarningIcon = ({ color = '#fff', ...p }: IconProps) => (
  <Frame color={color} {...p}>
    <Path
      fillRule="evenodd"
      d="M12 3 L22 20 H2 Z M11.1 9 H12.9 V14.5 H11.1 Z M12 16 A1.15 1.15 0 1 1 11.99 16 Z"
    />
  </Frame>
);

// Trophy — a victory reward marker.
export const TrophyIcon = (p: IconProps) => (
  <Frame {...p}>
    <Path d="M6 4 H18 V8 Q18 13 12 14 Q6 13 6 8 Z" />
    <Path d="M6 5 H3.5 V7.5 Q3.5 10 6 10.2 V8.2 Q4.8 8 4.8 7 V6.4 H6 Z" />
    <Path d="M18 5 H20.5 V7.5 Q20.5 10 18 10.2 V8.2 Q19.2 8 19.2 7 V6.4 H18 Z" />
    <Rect x={11} y={13.5} width={2} height={4} />
    <Path d="M8 18 H16 L17 21 H7 Z" />
  </Frame>
);

// Up chevron — a buff / stat increase.
export const BuffIcon = ({ size = 24, color = '#fff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <G stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M5 15 L12 8 L19 15" />
    </G>
  </Svg>
);

// Down chevron — a debuff / stat decrease.
export const DebuffIcon = ({ size = 24, color = '#fff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <G stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M5 9 L12 16 L19 9" />
    </G>
  </Svg>
);

// Droplet — a damage-over-time (bleed / burn) effect.
export const DotIcon = ({ color = '#fff', ...p }: IconProps) => (
  <Frame color={color} {...p}>
    <Path d="M12 3 C12 3 5.5 11 5.5 15.2 A6.5 6.5 0 0 0 18.5 15.2 C18.5 11 12 3 12 3 Z" />
  </Frame>
);

// Motion streaks — reads as "fled / got away".
export const FleeIcon = ({ size = 24, color = '#fff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <G stroke={color} strokeWidth={2} strokeLinecap="round" fill="none">
      <Path d="M4 8 H16" />
      <Path d="M3 12 H19" />
      <Path d="M6 16 H14" />
    </G>
  </Svg>
);
