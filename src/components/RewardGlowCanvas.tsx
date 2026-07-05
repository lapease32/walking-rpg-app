import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import type { Rarity } from '../models/Creature';
import { getRarityColor } from '../constants/rarity';

/**
 * Skia radial glow behind the reward-reveal card (graphics roadmap Phase 3). A soft rarity-colored
 * aura that fades in and — for epic/legendary — gently pulses, so the rarity reads before the item
 * card resolves. This is the one thing the hand-rolled RN Animated burst can't do (soft gradients /
 * blur); it's layered BEHIND the existing particles + card, which are left untouched.
 *
 * Mount once per reveal (the parent keys it on the reveal) so the intro replays each time. GPU/
 * native — not exercised by jest (Skia mocked); confirm the look on a device build.
 */

const RARITY_GLOW: Record<Rarity, { radius: number; opacity: number; pulse: boolean }> = {
  common: { radius: 90, opacity: 0.18, pulse: false },
  uncommon: { radius: 110, opacity: 0.24, pulse: false },
  rare: { radius: 140, opacity: 0.32, pulse: false },
  epic: { radius: 175, opacity: 0.42, pulse: true },
  legendary: { radius: 215, opacity: 0.55, pulse: true },
};

interface RewardGlowCanvasProps {
  rarity: Rarity;
}

export default function RewardGlowCanvas({ rarity }: RewardGlowCanvasProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const preset = RARITY_GLOW[rarity];
  const color = getRarityColor(rarity);
  const edge = `${color}00`; // fully-transparent same hue for the gradient's outer stop

  const intro = useSharedValue(0); // 0→1 fade + scale in
  const pulse = useSharedValue(0); // 0..1 loop, epic/legendary only

  useEffect(() => {
    intro.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    if (preset.pulse) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 750, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    }
  }, [intro, pulse, preset.pulse]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const cx = size.width / 2;
  const cy = size.height / 2;
  const center = vec(cx, cy);

  // Scale the fixed-radius circle+gradient via a Group so the gradient always fills the circle.
  const transform = useDerivedValue(() => [
    { scale: (0.7 + 0.3 * intro.value) * (1 + 0.08 * pulse.value) },
  ]);
  const opacity = useDerivedValue(() => preset.opacity * intro.value * (1 - 0.2 * pulse.value));

  return (
    <View pointerEvents="none" style={styles.layer} onLayout={onLayout}>
      {size.width > 0 && (
        <Canvas style={styles.canvas}>
          <Group transform={transform} origin={center} opacity={opacity}>
            <Circle c={center} r={preset.radius}>
              <RadialGradient c={center} r={preset.radius} colors={[color, edge]} />
            </Circle>
          </Group>
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  canvas: { flex: 1 },
});
