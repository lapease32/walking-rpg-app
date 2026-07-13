import React from 'react';
import Svg, { Path, Circle, Ellipse, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import type { CreatureBodyProps } from './types';
import { useCreatureBodyAnim, creatureBodyStyles } from './useCreatureBodyAnim';

/** Forest Sprite — a spiteful nature mote: glowing core, leaf wings + sprout, scowling glowing eyes
 *  and tiny fangs. Hovers (float) and dissipates on death (fade). */
export default function ForestSpriteBody({ size, state }: CreatureBodyProps) {
  const animatedStyle = useCreatureBodyAnim(state, size, {
    idleStyle: 'float',
    deathStyle: 'fade',
  });
  return (
    <Animated.View style={[creatureBodyStyles.body, { width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="forestGrad" cx="42%" cy="32%" r="80%">
            <Stop offset="0%" stopColor="#c8e6c9" />
            <Stop offset="55%" stopColor="#66bb6a" />
            <Stop offset="100%" stopColor="#2e7d32" />
          </RadialGradient>
        </Defs>
        <Path d="M50,58 C34,48 18,50 12,60 C24,66 44,66 50,58 Z" fill="#4caf50" opacity={0.85} />
        <Path d="M50,58 C66,48 82,50 88,60 C76,66 56,66 50,58 Z" fill="#4caf50" opacity={0.85} />
        <Path d="M50,42 C49,32 53,28 58,25 C55,33 54,39 50,44 Z" fill="#66bb6a" />
        <Circle
          cx={50}
          cy={58}
          r={17}
          fill="url(#forestGrad)"
          stroke="#2e7d32"
          strokeOpacity={0.3}
          strokeWidth={1.2}
        />
        <Ellipse
          cx={43}
          cy={51}
          rx={4.5}
          ry={6}
          fill="#e8f5e9"
          opacity={0.85}
          transform="rotate(-20 43 51)"
        />
        <Path
          d="M41,53 L48,56.5"
          fill="none"
          stroke="#14301c"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <Path
          d="M59,53 L52,56.5"
          fill="none"
          stroke="#14301c"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <Path d="M42,57 L48,58.6 L42.5,60.6 Z" fill="#14301c" />
        <Path d="M58,57 L52,58.6 L57.5,60.6 Z" fill="#14301c" />
        <Circle cx={44.6} cy={58.9} r={1} fill="#d4e157" />
        <Circle cx={55.4} cy={58.9} r={1} fill="#d4e157" />
        <Path
          d="M45,66.5 Q50,64 55,66.5"
          fill="none"
          stroke="#14301c"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <Path d="M47,66 L48,68.6 L49,66 Z" fill="#e8f5e9" />
        <Path d="M51,66 L52,68.6 L53,66 Z" fill="#e8f5e9" />
      </Svg>
    </Animated.View>
  );
}
