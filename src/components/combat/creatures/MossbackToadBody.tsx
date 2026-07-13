import React from 'react';
import Svg, { Path, Circle, Ellipse, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import type { CreatureBodyProps } from './types';
import { useCreatureBodyAnim, creatureBodyStyles } from './useCreatureBodyAnim';

/** Mossback Toad — a bloated mossy toad: warty back, bulging slit eyes under heavy brows and a wide
 *  toothed frown. Grounded breathe, topples on death (collapse). */
export default function MossbackToadBody({ size, state }: CreatureBodyProps) {
  const animatedStyle = useCreatureBodyAnim(state, size, {
    idleStyle: 'ground',
    deathStyle: 'collapse',
  });
  return (
    <Animated.View style={[creatureBodyStyles.body, { width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="toadGrad" cx="45%" cy="35%" r="75%">
            <Stop offset="0%" stopColor="#aed581" />
            <Stop offset="55%" stopColor="#7cb342" />
            <Stop offset="100%" stopColor="#33691e" />
          </RadialGradient>
        </Defs>
        <Path
          d="M12,80 C12,60 30,52 50,52 C70,52 88,60 88,80 C88,86 80,88 50,88 C20,88 12,86 12,80 Z"
          fill="url(#toadGrad)"
        />
        <Ellipse cx={50} cy={80} rx={26} ry={7} fill="#c5e1a5" opacity={0.6} />
        <G fill="#558b2f" opacity={0.7}>
          <Circle cx={30} cy={64} r={2.2} />
          <Circle cx={44} cy={60} r={1.8} />
          <Circle cx={64} cy={62} r={2.4} />
          <Circle cx={74} cy={70} r={2} />
        </G>
        <Circle cx={36} cy={50} r={9} fill="#7cb342" />
        <Circle cx={64} cy={50} r={9} fill="#7cb342" />
        <Circle cx={36} cy={49} r={5.5} fill="#f9fbe7" />
        <Circle cx={64} cy={49} r={5.5} fill="#f9fbe7" />
        <Ellipse cx={36} cy={50} rx={1.8} ry={4.5} fill="#1b5e20" />
        <Ellipse cx={64} cy={50} rx={1.8} ry={4.5} fill="#1b5e20" />
        <Path
          d="M27,44 L45,47.5"
          fill="none"
          stroke="#33691e"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Path
          d="M73,44 L55,47.5"
          fill="none"
          stroke="#33691e"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Path
          d="M30,73 Q50,70 70,73"
          fill="none"
          stroke="#33691e"
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        <G fill="#f9fbe7">
          <Path d="M40,72.6 L41.5,76 L43,72.6 Z" />
          <Path d="M48,71.8 L49.5,75.2 L51,71.8 Z" />
          <Path d="M57,72.6 L58.5,76 L60,72.6 Z" />
        </G>
      </Svg>
    </Animated.View>
  );
}
