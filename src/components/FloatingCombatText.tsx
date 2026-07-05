import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { MOTION_EASING } from '../constants/motion';

export interface CombatFloater {
  id: number;
  target: 'creature' | 'player';
  label: string;
  color: string;
  fontSize: number;
  /** Small horizontal offset so numbers stacked in the same turn don't perfectly overlap. */
  dx: number;
}

interface FloatingCombatTextProps {
  item: CombatFloater;
  onDone: (id: number) => void;
}

const RISE_PX = 46; // how far the number floats upward over its lifetime
const LIFETIME_MS = 750;

/**
 * A single floating combat number: pops in, drifts upward, and fades, then calls `onDone` so the
 * parent can drop it from its list (self-cleaning — no timers to leak). Purely presentational; the
 * label/color/size come pre-computed from combatTextStyle. pointerEvents="none" so it never eats a
 * tap meant for an ability button underneath.
 */
export default function FloatingCombatText({ item, onDone }: FloatingCombatTextProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: LIFETIME_MS, easing: MOTION_EASING.standard },
      finished => {
        if (finished) runOnJS(onDone)(item.id);
      },
    );
    // Run once on mount; the floater's identity is fixed for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: item.dx },
      { translateY: -RISE_PX * progress.value },
      // Quick pop to full size in the first ~quarter of the lifetime, then hold.
      { scale: 0.8 + 0.2 * Math.min(1, progress.value * 4) },
    ],
  }));

  return (
    <Animated.Text
      pointerEvents="none"
      style={[styles.text, { color: item.color, fontSize: item.fontSize }, animStyle]}>
      {item.label}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 6, // start near the combatant's bar, then rise up through the panel
    textAlign: 'center',
    fontWeight: 'bold',
    // Dark outline keeps light numbers legible over any panel color.
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
