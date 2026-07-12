import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path, Ellipse, Circle, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import type { CreatureBodyProps } from './types';

/**
 * Sump Ooze — the pilot hand-authored vector creature body ("Luminous Flat" language). A gooey teal
 * blob: radial body gradient, rim light, specular, inner bubbles, two grime flecks (gutter-runoff
 * flavor) and eyes/mouth. Drawn with react-native-svg; motion is TRANSFORM-based (squash/stretch,
 * lunge, melt) via Reanimated — no path morphing — so it stays cheap and reads as flat-vector.
 *
 * States (from {@link deriveCreatureAnimState}): idle breathes on a loop, attack pulses a forward
 * lunge during the enemy turn, death flattens + sinks + fades once. Transforms compose in the single
 * worklet below so states can overlap cleanly (e.g. defeated mid-lunge → melt wins via fade).
 *
 * Native/UI-thread (Skia-free but Reanimated-driven) — not exercised by jest; confirm on a device.
 */
export default function SumpOozeBody({ size, color, state }: CreatureBodyProps) {
  const bob = useSharedValue(0); // idle breathe, oscillates 0↔1
  const attack = useSharedValue(0); // 0 rest .. 1 mid-lunge
  const death = useSharedValue(0); // 0 alive .. 1 fully melted

  // Idle breathe runs for the body's whole life; the state-driven values layer on top.
  useEffect(() => {
    bob.value = withRepeat(
      withTiming(1, { duration: 950, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [bob]);

  useEffect(() => {
    if (state === 'attack') {
      attack.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      attack.value = withTiming(0, { duration: 140 });
    }

    death.value = withTiming(state === 'death' ? 1 : 0, {
      duration: state === 'death' ? 620 : 200,
      easing: Easing.in(Easing.quad),
    });
  }, [state, attack, death]);

  const animatedStyle = useAnimatedStyle(() => {
    const b = bob.value;
    const a = attack.value;
    const d = death.value;
    // Idle: settle wide+short at rest, stretch tall+narrow at peak, rising slightly.
    let scaleX = 1 + 0.05 * (1 - b);
    let scaleY = 1 - 0.05 * (1 - b);
    let translateY = -0.05 * size * b;
    // Attack: a quick swell forward.
    scaleX += 0.1 * a;
    scaleY += 0.06 * a;
    translateY += -0.06 * size * a;
    // Death: flatten wide, sink, and fade to nothing.
    scaleX *= 1 + 0.5 * d;
    scaleY *= 1 - 0.8 * d;
    translateY += 0.12 * size * d;
    return {
      opacity: 1 - d,
      transform: [{ translateY }, { scaleX }, { scaleY }],
    };
  });

  return (
    <Animated.View style={[styles.body, { width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="oozeBody" cx="40%" cy="30%" r="85%">
            <Stop offset="0%" stopColor="#6fd3c8" />
            <Stop offset="55%" stopColor="#26a69a" />
            <Stop offset="100%" stopColor="#12655c" />
          </RadialGradient>
        </Defs>

        {/* Gooey, slightly drippy silhouette */}
        <Path
          d="M12,78 C10,54 26,36 50,36 C74,36 90,54 88,78 C88,84 84,88 76,89
             C74,92 70,92 68,89 C66,88 63,88 61,89 C56,91 50,91 45,89
             C43,88 40,88 38,89 C36,92 32,92 30,89 C24,88 12,86 12,78 Z"
          fill="url(#oozeBody)"
          stroke={color}
          strokeOpacity={0.35}
          strokeWidth={1.5}
        />

        {/* Rim light along the upper-left */}
        <Path
          d="M20,72 C18,52 30,40 50,40 C60,40 68,44 73,52 C64,46 56,47 49,52
             C36,60 28,68 26,78 C22,78 20,76 20,72 Z"
          fill="#8fe3d8"
          opacity={0.5}
        />

        {/* Inner bubbles (ooze texture) */}
        <G opacity={0.5} fill="#8fe3d8">
          <Circle cx={62} cy={54} r={4} />
          <Circle cx={70} cy={66} r={2.6} />
          <Circle cx={40} cy={70} r={3} />
        </G>

        {/* Gutter grime flecks */}
        <G fill="#0a3b36" opacity={0.55}>
          <Circle cx={55} cy={80} r={1.6} />
          <Circle cx={33} cy={76} r={1.2} />
        </G>

        {/* Big specular highlight */}
        <Ellipse
          cx={37}
          cy={48}
          rx={7}
          ry={9.5}
          fill="#cff5ef"
          opacity={0.85}
          transform="rotate(-20 37 48)"
        />

        {/* Face */}
        <Ellipse cx={42} cy={64} rx={4.6} ry={6} fill="#0a2320" />
        <Ellipse cx={60} cy={64} rx={4.6} ry={6} fill="#0a2320" />
        <Circle cx={43.6} cy={61.5} r={1.5} fill="#eafffb" />
        <Circle cx={61.6} cy={61.5} r={1.5} fill="#eafffb" />
        <Path
          d="M45,75 Q51,79 57,75"
          fill="none"
          stroke="#0a2320"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Squash/stretch + melt anchor at the base, so the ooze deforms from the ground it sits on.
  body: { transformOrigin: 'center bottom' },
});
