import React from 'react';
import Svg, { Path, Ellipse, Circle, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import type { CreatureBodyProps } from './types';
import { useCreatureBodyAnim, creatureBodyStyles } from './useCreatureBodyAnim';

/**
 * Sump Ooze — a gooey teal blob (radial fill, rim light, specular, inner bubbles, gutter-grime
 * flecks) with a hostile face: scowling brows, angled glowing eyes, and a fanged snarl. Grounded
 * idle breathe + a melt on death (see {@link useCreatureBodyAnim}).
 */
export default function SumpOozeBody({ size, color, state }: CreatureBodyProps) {
  const animatedStyle = useCreatureBodyAnim(state, size, {
    idleStyle: 'ground',
    deathStyle: 'melt',
  });

  return (
    <Animated.View style={[creatureBodyStyles.body, { width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="oozeBody" cx="40%" cy="30%" r="85%">
            <Stop offset="0%" stopColor="#6fd3c8" />
            <Stop offset="55%" stopColor="#26a69a" />
            <Stop offset="100%" stopColor="#12655c" />
          </RadialGradient>
        </Defs>

        <Path
          d="M12,78 C10,54 26,36 50,36 C74,36 90,54 88,78 C88,84 84,88 76,89
             C74,92 70,92 68,89 C66,88 63,88 61,89 C56,91 50,91 45,89
             C43,88 40,88 38,89 C36,92 32,92 30,89 C24,88 12,86 12,78 Z"
          fill="url(#oozeBody)"
          stroke={color}
          strokeOpacity={0.35}
          strokeWidth={1.5}
        />

        <Path
          d="M20,72 C18,52 30,40 50,40 C60,40 68,44 73,52 C64,46 56,47 49,52
             C36,60 28,68 26,78 C22,78 20,76 20,72 Z"
          fill="#8fe3d8"
          opacity={0.5}
        />

        <G opacity={0.5} fill="#8fe3d8">
          <Circle cx={62} cy={54} r={4} />
          <Circle cx={70} cy={66} r={2.6} />
          <Circle cx={40} cy={70} r={3} />
        </G>

        <G fill="#0a3b36" opacity={0.55}>
          <Circle cx={55} cy={80} r={1.6} />
          <Circle cx={33} cy={76} r={1.2} />
        </G>

        <Ellipse
          cx={37}
          cy={48}
          rx={7}
          ry={9.5}
          fill="#cff5ef"
          opacity={0.85}
          transform="rotate(-20 37 48)"
        />

        {/* Hostile face: scowling brows, angled glowing eyes, fanged snarl */}
        <Path
          d="M38,58 L46,61"
          fill="none"
          stroke="#0a2320"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <Path
          d="M62,58 L54,61"
          fill="none"
          stroke="#0a2320"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <Path d="M39,62 L47,64 L40,66.5 Z" fill="#0a2320" />
        <Path d="M61,62 L53,64 L60,66.5 Z" fill="#0a2320" />
        <Circle cx={43} cy={64.3} r={1.2} fill="#eafffb" />
        <Circle cx={57} cy={64.3} r={1.2} fill="#eafffb" />
        <Path
          d="M43,75 Q51,72 59,75"
          fill="none"
          stroke="#0a2320"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path d="M46,74.6 L47,78 L48,74.6 Z" fill="#cff5ef" />
        <Path d="M51,75 L52,78.4 L53,75 Z" fill="#cff5ef" />
        <Path d="M55,74.6 L56,78 L57,74.6 Z" fill="#cff5ef" />
      </Svg>
    </Animated.View>
  );
}
