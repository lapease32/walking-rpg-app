import React from 'react';
import Svg, { Path, Circle, Ellipse, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import type { CreatureBodyProps } from './types';
import { useCreatureBodyAnim, creatureBodyStyles } from './useCreatureBodyAnim';

/** Gutter Swarm — a boiling knot of rats & roaches as one mass: humps, tails, red glaring eyes and
 *  little fangs. Grounded breathe, scatters/topples on death (collapse). */
export default function GutterSwarmBody({ size, state }: CreatureBodyProps) {
  const animatedStyle = useCreatureBodyAnim(state, size, {
    idleStyle: 'ground',
    deathStyle: 'collapse',
  });
  return (
    <Animated.View style={[creatureBodyStyles.body, { width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="swarmGrad" cx="50%" cy="40%" r="70%">
            <Stop offset="0%" stopColor="#6d5b4f" />
            <Stop offset="60%" stopColor="#4e3b2f" />
            <Stop offset="100%" stopColor="#2e211a" />
          </RadialGradient>
        </Defs>
        <Path
          d="M14,86 C14,74 22,66 30,66 C34,60 42,60 46,66 C50,60 60,60 64,66 C72,64 84,72 84,86 Z"
          fill="url(#swarmGrad)"
        />
        <Circle cx={30} cy={72} r={8} fill="#5a463a" />
        <Circle cx={50} cy={70} r={9} fill="#63503f" />
        <Circle cx={68} cy={74} r={8} fill="#5a463a" />
        <Path
          d="M20,84 Q10,82 12,74"
          fill="none"
          stroke="#3e2f26"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path
          d="M82,84 Q90,80 86,74"
          fill="none"
          stroke="#3e2f26"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Ellipse cx={40} cy={82} rx={5} ry={3} fill="#3a2a20" />
        <Ellipse cx={60} cy={82} rx={5} ry={3} fill="#3a2a20" />
        <Ellipse cx={44} cy={66} rx={6} ry={3} fill="#9ccc65" opacity={0.3} />
        <Path
          d="M43,64.5 L48,66.2"
          fill="none"
          stroke="#1a0f0a"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <Path
          d="M57,64.5 L52,66.2"
          fill="none"
          stroke="#1a0f0a"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <G fill="#ff5252">
          <Circle cx={27} cy={70} r={1.5} />
          <Circle cx={33} cy={70} r={1.5} />
          <Circle cx={46} cy={67.5} r={1.9} />
          <Circle cx={54} cy={67.5} r={1.9} />
          <Circle cx={65} cy={72} r={1.5} />
          <Circle cx={71} cy={72} r={1.5} />
        </G>
        <G fill="#e0e0e0">
          <Path d="M47,73 L48,76 L49,73 Z" />
          <Path d="M51,73 L52,76 L53,73 Z" />
        </G>
      </Svg>
    </Animated.View>
  );
}
