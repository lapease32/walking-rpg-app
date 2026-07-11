import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MOTION_SPRING } from '../../constants/motion';

/**
 * A Pressable that springs DOWN on press and back on release — tactile feedback for primary buttons
 * (graphics roadmap Phase 1). The caller's `style` AND the scale live on the Pressable ITSELF (an
 * animated Pressable), so it stays the flex child of its parent (e.g. `flex: 1` buttons keep sharing
 * a row) and the whole button scales. Drop-in for a Pressable/TouchableOpacity with a static style;
 * the spring replaces any pressed-opacity styling.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  children: React.ReactNode;
}

export default function PressableScale({
  style,
  pressedScale = 0.96,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={e => {
        scale.value = withSpring(pressedScale, MOTION_SPRING.press);
        onPressIn?.(e);
      }}
      onPressOut={e => {
        scale.value = withSpring(1, MOTION_SPRING.press);
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}>
      {children}
    </AnimatedPressable>
  );
}
