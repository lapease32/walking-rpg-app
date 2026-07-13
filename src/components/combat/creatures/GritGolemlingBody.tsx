import React from 'react';
import Svg, { Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import type { CreatureBodyProps } from './types';
import { useCreatureBodyAnim, creatureBodyStyles } from './useCreatureBodyAnim';

/** Grit Golemling — a knee-high clot of gravel: angular faceted torso, stubby rock arms, a heavy
 *  brow shelf over glowing amber eyes and a jagged mouth. Grounded breathe, crumbles on death. */
export default function GritGolemlingBody({ size, state }: CreatureBodyProps) {
  const animatedStyle = useCreatureBodyAnim(state, size, {
    idleStyle: 'ground',
    deathStyle: 'collapse',
  });
  return (
    <Animated.View style={[creatureBodyStyles.body, { width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="golemGrad" cx="42%" cy="30%" r="80%">
            <Stop offset="0%" stopColor="#bcaaa4" />
            <Stop offset="55%" stopColor="#8d7b6e" />
            <Stop offset="100%" stopColor="#4e3f34" />
          </RadialGradient>
        </Defs>
        <Path
          d="M28,84 L24,52 L40,40 L62,40 L78,54 L74,84 Z"
          fill="url(#golemGrad)"
          stroke="#4e3f34"
          strokeOpacity={0.4}
          strokeWidth={1.2}
        />
        <Path d="M24,56 L14,60 L16,74 L26,70 Z" fill="#7a695d" />
        <Path d="M78,56 L88,60 L86,74 L76,70 Z" fill="#7a695d" />
        <Path d="M40,40 L62,40 L54,52 L44,52 Z" fill="#cbbdb4" opacity={0.5} />
        <Path
          d="M40,40 L44,60 L38,84"
          fill="none"
          stroke="#4e3f34"
          strokeWidth={1.4}
          opacity={0.5}
        />
        <Path d="M62,44 L58,64" fill="none" stroke="#4e3f34" strokeWidth={1.2} opacity={0.5} />
        <Path d="M38,50 L48,52.2 L48,54 L38,52.4 Z" fill="#4e3f34" />
        <Path d="M62,50 L52,52.2 L52,54 L62,52.4 Z" fill="#4e3f34" />
        <Path d="M40,55 L46,53.6 L46,57.4 L40,58.4 Z" fill="#ff8f00" />
        <Path d="M60,55 L54,53.6 L54,57.4 L60,58.4 Z" fill="#ff8f00" />
        <Path
          d="M43,68 L46,71 L49,68 L52,71 L55,68"
          fill="none"
          stroke="#2a2019"
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}
