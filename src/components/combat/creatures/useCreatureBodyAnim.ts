import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import type { CreatureAnimState } from './types';

/**
 * Shared transform-based motion for every hand-authored creature body, so each body file is just its
 * SVG shapes — the idle/attack/death animation lives here once. Motion is pure transform + opacity
 * (no path morphing), driven by the live combat `state` (see {@link deriveCreatureAnimState}).
 *
 * Per-creature variety via two knobs:
 *  - idleStyle: 'ground' squash-stretch breathe (grounded bodies) · 'float' hover bob (ghosts/sprites)
 *  - deathStyle: 'melt' (oozes: flatten wide + sink) · 'collapse' (solids: topple + fade) ·
 *    'fade' (spirits: rise + dissipate)
 *
 * Reanimated/UI-thread — not exercised by jest (the registry test mocks this runtime); confirm on device.
 */
export type CreatureIdleStyle = 'ground' | 'float';
export type CreatureDeathStyle = 'melt' | 'collapse' | 'fade';

interface Options {
  idleStyle?: CreatureIdleStyle;
  deathStyle?: CreatureDeathStyle;
}

export function useCreatureBodyAnim(
  state: CreatureAnimState,
  size: number,
  { idleStyle = 'ground', deathStyle = 'collapse' }: Options = {},
) {
  const bob = useSharedValue(0); // idle breathe/hover, oscillates 0↔1
  const attack = useSharedValue(0); // 0 rest .. 1 mid-lunge
  const death = useSharedValue(0); // 0 alive .. 1 fully gone

  // Idle runs for the body's whole life; the state-driven values layer on top.
  useEffect(() => {
    bob.value = withRepeat(
      withTiming(1, {
        duration: idleStyle === 'float' ? 1400 : 950,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [bob, idleStyle]);

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

  return useAnimatedStyle(() => {
    const b = bob.value;
    const a = attack.value;
    const d = death.value;

    let scaleX = 1;
    let scaleY = 1;
    let translateY = 0;
    let rotate = 0;

    if (idleStyle === 'float') {
      // Hover: gentle rise/fall, almost no squash.
      translateY = -0.06 * size * b;
      scaleX = 1 + 0.02 * (1 - b);
      scaleY = 1 - 0.02 * (1 - b);
    } else {
      // Ground: settle wide+short at rest, stretch tall+narrow at peak.
      scaleX = 1 + 0.05 * (1 - b);
      scaleY = 1 - 0.05 * (1 - b);
      translateY = -0.05 * size * b;
    }

    // Attack: a quick swell forward.
    scaleX += 0.1 * a;
    scaleY += 0.06 * a;
    translateY += -0.06 * size * a;

    // Death.
    if (deathStyle === 'melt') {
      scaleX *= 1 + 0.5 * d;
      scaleY *= 1 - 0.8 * d;
      translateY += 0.12 * size * d;
    } else if (deathStyle === 'fade') {
      translateY += -0.14 * size * d; // rise as it dissipates
      scaleX *= 1 - 0.1 * d;
      scaleY *= 1 - 0.1 * d;
    } else {
      // collapse / topple
      rotate = -8 * d;
      scaleY *= 1 - 0.5 * d;
      translateY += 0.14 * size * d;
    }

    return {
      opacity: 1 - d,
      transform: [{ translateY }, { rotate: `${rotate}deg` }, { scaleX }, { scaleY }],
    };
  });
}

/** Shared base style — anchor squash/melt/topple at the body's base (the ground it sits on). */
export const creatureBodyStyles = StyleSheet.create({
  body: { transformOrigin: 'center bottom' },
});
