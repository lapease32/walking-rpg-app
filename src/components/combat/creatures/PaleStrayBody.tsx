import React from 'react';
import Svg, { Path, Circle, Ellipse, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import type { CreatureBodyProps } from './types';
import { useCreatureBodyAnim, creatureBodyStyles } from './useCreatureBodyAnim';

/** Pale Stray — a gaunt hunched shade shuffling the night streets: elongated head, scowling brows,
 *  hollow cold-glowing eyes and a gaping maw. Grounded shuffle, dissipates on death (fade). */
export default function PaleStrayBody({ size, state }: CreatureBodyProps) {
  const animatedStyle = useCreatureBodyAnim(state, size, {
    idleStyle: 'ground',
    deathStyle: 'fade',
  });
  return (
    <Animated.View style={[creatureBodyStyles.body, { width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="strayGrad" cx="45%" cy="26%" r="85%">
            <Stop offset="0%" stopColor="#cfc3de" />
            <Stop offset="55%" stopColor="#9e8fb0" />
            <Stop offset="100%" stopColor="#5e4b73" />
          </RadialGradient>
        </Defs>
        <Path
          d="M40,30 C52,26 62,32 62,44 C62,52 58,58 60,68 C62,78 66,80 64,88 C60,86 56,90 52,86
             C48,90 44,86 40,88 C38,80 44,72 42,62 C40,52 32,46 34,38 C35,33 37,31 40,30 Z"
          fill="url(#strayGrad)"
          stroke="#5e4b73"
          strokeOpacity={0.3}
          strokeWidth={1.2}
        />
        <Ellipse cx={49} cy={36} rx={11} ry={13} fill="url(#strayGrad)" />
        <Path
          d="M42,31 L47,33.8"
          fill="none"
          stroke="#3a2e4a"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path
          d="M56,31 L51,33.8"
          fill="none"
          stroke="#3a2e4a"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path d="M43,34 L48,36 L43.5,37.6 Z" fill="#1e1830" />
        <Path d="M55,34 L50,36 L54.5,37.6 Z" fill="#1e1830" />
        <Circle cx={45.4} cy={36} r={0.9} fill="#b2ebf2" />
        <Circle cx={52.6} cy={36} r={0.9} fill="#b2ebf2" />
        <Ellipse cx={49} cy={43} rx={2.4} ry={3.4} fill="#241b33" />
      </Svg>
    </Animated.View>
  );
}
