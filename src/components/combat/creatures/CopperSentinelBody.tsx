import React from 'react';
import Svg, { Path, Circle, Rect, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import type { CreatureBodyProps } from './types';
import { useCreatureBodyAnim, creatureBodyStyles } from './useCreatureBodyAnim';

/** Copper Sentinel — a knee-high watch-construct: angular copper torso with verdigris patina, a
 *  hostile red sensor eye under an angled brow visor and a serrated grille. Grounded breathe,
 *  topples on death (collapse). */
export default function CopperSentinelBody({ size, state }: CreatureBodyProps) {
  const animatedStyle = useCreatureBodyAnim(state, size, {
    idleStyle: 'ground',
    deathStyle: 'collapse',
  });
  return (
    <Animated.View style={[creatureBodyStyles.body, { width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="sentinelGrad" cx="42%" cy="30%" r="80%">
            <Stop offset="0%" stopColor="#e0a060" />
            <Stop offset="55%" stopColor="#b87333" />
            <Stop offset="100%" stopColor="#7a4a1e" />
          </RadialGradient>
        </Defs>
        <Rect x={38} y={78} width={7} height={10} rx={2} fill="#7a4a1e" />
        <Rect x={55} y={78} width={7} height={10} rx={2} fill="#7a4a1e" />
        <Path
          d="M32,80 L30,50 L38,42 L62,42 L70,50 L68,80 Z"
          fill="url(#sentinelGrad)"
          stroke="#7a4a1e"
          strokeOpacity={0.4}
          strokeWidth={1.2}
        />
        <Path d="M38,52 L62,52 L60,66 L40,66 Z" fill="#4db6ac" opacity={0.35} />
        <Path
          d="M50,42 L50,32"
          fill="none"
          stroke="#7a4a1e"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Circle cx={50} cy={30} r={2.4} fill="#ff5722" />
        <Path d="M40,51 L50,54.5 L60,51 L60,53 L50,56 L40,53 Z" fill="#7a4a1e" />
        <Circle cx={50} cy={59} r={6.5} fill="#2b0f0a" />
        <Circle cx={50} cy={59} r={3.9} fill="#ff5722" />
        <Circle cx={50} cy={59} r={1.5} fill="#ffe0b2" />
        <Path
          d="M43,70 L45,73 L47,70 L49,73 L51,70 L53,73 L55,70"
          fill="none"
          stroke="#3a2410"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <G fill="#e0a060">
          <Circle cx={35} cy={50} r={1.4} />
          <Circle cx={65} cy={50} r={1.4} />
          <Circle cx={35} cy={76} r={1.4} />
          <Circle cx={65} cy={76} r={1.4} />
        </G>
        <Path d="M38,42 L50,42 L44,54 L36,52 Z" fill="#f0c080" opacity={0.4} />
      </Svg>
    </Animated.View>
  );
}
