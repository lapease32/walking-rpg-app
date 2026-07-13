import React from 'react';
import Svg, { Path, Ellipse, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import type { CreatureBodyProps } from './types';
import { useCreatureBodyAnim, creatureBodyStyles } from './useCreatureBodyAnim';

/** Urban Phantom — a hooded shade with a wavy tail, brow ridges, narrowed glowing eyes and a
 *  gaping wail. Hovers (float) and dissipates on death (fade). */
export default function UrbanPhantomBody({ size, state }: CreatureBodyProps) {
  const animatedStyle = useCreatureBodyAnim(state, size, {
    idleStyle: 'float',
    deathStyle: 'fade',
  });
  return (
    <Animated.View style={[creatureBodyStyles.body, { width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="phantomGrad" cx="42%" cy="28%" r="85%">
            <Stop offset="0%" stopColor="#d1c4e9" />
            <Stop offset="55%" stopColor="#7e57c2" />
            <Stop offset="100%" stopColor="#4527a0" />
          </RadialGradient>
        </Defs>
        <Path
          d="M24,66 C24,42 34,28 50,28 C66,28 76,42 76,66 C76,74 76,82 72,86 C69,82 66,86 62,86
             C59,82 55,86 50,86 C45,86 41,82 38,86 C34,86 31,82 28,86 C24,82 24,74 24,66 Z"
          fill="url(#phantomGrad)"
          stroke="#4527a0"
          strokeOpacity={0.3}
          strokeWidth={1.2}
        />
        <Path
          d="M31,60 C31,42 39,32 50,32 C56,32 61,35 65,41 C57,37 51,38 45,44 C37,52 33,58 33,64 C32,63 31,62 31,60 Z"
          fill="#d1c4e9"
          opacity={0.5}
        />
        <Path d="M36,50 L47,54 L46,50.5 Z" fill="#3a2170" />
        <Path d="M64,50 L53,54 L54,50.5 Z" fill="#3a2170" />
        <Path d="M39,53 L47,56 L45,58 L39,56 Z" fill="#ede7f6" />
        <Path d="M61,53 L53,56 L55,58 L61,56 Z" fill="#ede7f6" />
        <Ellipse cx={50} cy={67} rx={3.6} ry={4.8} fill="#2e1a5e" />
      </Svg>
    </Animated.View>
  );
}
