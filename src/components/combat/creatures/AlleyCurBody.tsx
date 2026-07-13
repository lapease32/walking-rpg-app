import React from 'react';
import Svg, { Path, Circle, Ellipse, Rect, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import type { CreatureBodyProps } from './types';
import { useCreatureBodyAnim, creatureBodyStyles } from './useCreatureBodyAnim';

/** Alley Cur — a scruffy half-wild dog: pricked ears, snarling brows, narrowed amber eyes and
 *  bared fangs. Grounded breathe, topples on death (collapse). */
export default function AlleyCurBody({ size, state }: CreatureBodyProps) {
  const animatedStyle = useCreatureBodyAnim(state, size, {
    idleStyle: 'ground',
    deathStyle: 'collapse',
  });
  return (
    <Animated.View style={[creatureBodyStyles.body, { width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="curGrad" cx="45%" cy="30%" r="75%">
            <Stop offset="0%" stopColor="#c89b72" />
            <Stop offset="55%" stopColor="#9c6b45" />
            <Stop offset="100%" stopColor="#5d4037" />
          </RadialGradient>
        </Defs>
        <Path d="M30,86 C26,70 30,60 40,58 L60,58 C70,60 74,70 70,86 Z" fill="url(#curGrad)" />
        <Rect x={38} y={78} width={7} height={10} rx={2} fill="#5d4037" />
        <Rect x={55} y={78} width={7} height={10} rx={2} fill="#5d4037" />
        <Path d="M34,44 L29,28 L46,40 Z" fill="#7a5236" />
        <Path d="M66,44 L71,28 L54,40 Z" fill="#7a5236" />
        <Circle cx={50} cy={50} r={18} fill="url(#curGrad)" />
        <Ellipse cx={50} cy={58} rx={9} ry={7} fill="#c89b72" />
        <Circle cx={50} cy={55} r={2.6} fill="#3e2723" />
        <Path
          d="M40,44 L47,47"
          fill="none"
          stroke="#2e1a10"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <Path
          d="M60,44 L53,47"
          fill="none"
          stroke="#2e1a10"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <Path d="M41,48 L47,49.6 L41.5,50.6 Z" fill="#2e1a10" />
        <Path d="M59,48 L53,49.6 L58.5,50.6 Z" fill="#2e1a10" />
        <Circle cx={44} cy={49.6} r={0.9} fill="#ffab40" />
        <Circle cx={56} cy={49.6} r={0.9} fill="#ffab40" />
        <Path
          d="M43,62 Q50,60 57,62"
          fill="none"
          stroke="#2e1a10"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <Path d="M46,62 L47,66 L48,62 Z" fill="#fff" />
        <Path d="M52,62 L53,66 L54,62 Z" fill="#fff" />
      </Svg>
    </Animated.View>
  );
}
