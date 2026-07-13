import React from 'react';
import Svg, { Path, Circle, Ellipse, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import type { CreatureBodyProps } from './types';
import { useCreatureBodyAnim, creatureBodyStyles } from './useCreatureBodyAnim';

/** Ash Wretch — a soot-caked undead riven with ember cracks: charcoal body, glowing ember eyes under
 *  heavy brows and a snarl of gritted teeth. Grounded breathe, crumbles on death (collapse). */
export default function AshWretchBody({ size, state }: CreatureBodyProps) {
  const animatedStyle = useCreatureBodyAnim(state, size, {
    idleStyle: 'ground',
    deathStyle: 'collapse',
  });
  return (
    <Animated.View style={[creatureBodyStyles.body, { width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="ashGrad" cx="45%" cy="28%" r="82%">
            <Stop offset="0%" stopColor="#6e6e6e" />
            <Stop offset="55%" stopColor="#454545" />
            <Stop offset="100%" stopColor="#232323" />
          </RadialGradient>
        </Defs>
        <Path d="M32,86 C26,66 30,52 42,50 L58,50 C70,52 74,66 68,86 Z" fill="url(#ashGrad)" />
        <Ellipse cx={50} cy={42} rx={13} ry={14} fill="url(#ashGrad)" />
        <G stroke="#ff7043" strokeWidth={1.6} opacity={0.9} fill="none" strokeLinecap="round">
          <Path d="M40,60 L44,70 L40,80" />
          <Path d="M60,58 L56,68 L60,78" />
          <Path d="M50,66 L50,82" />
        </G>
        <Ellipse cx={44} cy={42} rx={3.2} ry={4.5} fill="#1a1a1a" />
        <Ellipse cx={56} cy={42} rx={3.2} ry={4.5} fill="#1a1a1a" />
        <Circle cx={44} cy={43} r={1.6} fill="#ff8a50" />
        <Circle cx={56} cy={43} r={1.6} fill="#ff8a50" />
        <Ellipse
          cx={44}
          cy={36}
          rx={4}
          ry={5}
          fill="#8a8a8a"
          opacity={0.5}
          transform="rotate(-20 44 36)"
        />
        <Path
          d="M39,37 L46,40.5"
          fill="none"
          stroke="#0d0d0d"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <Path
          d="M61,37 L54,40.5"
          fill="none"
          stroke="#0d0d0d"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <Path
          d="M44,51 Q50,48.5 56,51"
          fill="none"
          stroke="#ff7043"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <G fill="#1a1a1a">
          <Path d="M46,50.4 L47,52.8 L48,50.4 Z" />
          <Path d="M50,50 L51,52.4 L52,50 Z" />
        </G>
      </Svg>
    </Animated.View>
  );
}
