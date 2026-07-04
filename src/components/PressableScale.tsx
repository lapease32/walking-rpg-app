import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MOTION_SPRING } from '../constants/motion';

/**
 * A Pressable whose content springs DOWN on press and back on release — tactile feedback for
 * primary buttons (graphics roadmap Phase 1). The visual style lands on an inner Animated.View that
 * scales; the Pressable stays the touch target. Drop-in replacement for a Pressable with a static
 * style: move the button's visual style here and the spring replaces any pressed-opacity styling.
 */
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
    <Pressable
      {...rest}
      onPressIn={e => {
        scale.value = withSpring(pressedScale, MOTION_SPRING.press);
        onPressIn?.(e);
      }}
      onPressOut={e => {
        scale.value = withSpring(1, MOTION_SPRING.press);
        onPressOut?.(e);
      }}>
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
