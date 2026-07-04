import { Easing } from 'react-native-reanimated';

/**
 * Shared motion tokens — one consistent "clean vector + juicy motion" language across the app
 * (graphics roadmap Phase 1). Centralizing durations/easings/springs here keeps every animation
 * feeling like the same product rather than a grab-bag. All values are feel PLACEHOLDERS — tune by
 * playtesting.
 */
export const MOTION_DURATION = {
  fast: 120, // quick fades / micro-feedback
  base: 220, // standard transitions
  bar: 260, // HP/XP bar fills
} as const;

export const MOTION_EASING = {
  standard: Easing.out(Easing.cubic), // decelerate-to-rest — natural for UI
} as const;

/** withSpring configs. */
export const MOTION_SPRING = {
  press: { damping: 15, stiffness: 320, mass: 0.6 }, // snappy button press-scale
  pop: { damping: 9, stiffness: 220, mass: 0.7 }, // bouncier flourish (level-up)
} as const;

/** withTiming config for stat-bar fills. */
export const MOTION_BAR_TIMING = {
  duration: MOTION_DURATION.bar,
  easing: MOTION_EASING.standard,
} as const;
