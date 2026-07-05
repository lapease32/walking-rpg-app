import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Points, type SkPoint } from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import type { DamageType } from '../models/DamageType';
import type { ResistTier } from '../models/CombatHitEvent';

/**
 * Skia particle bursts for combat hits (graphics roadmap Phase 2b.2). One burst fires per damage
 * event off the 2b.1 hit-event feed; the color + motion read the damage TYPE and the particle
 * count/opacity read the resistance (mirroring the RESIST/WEAK number tell). Rendered with a single
 * animated `<Points>` per burst (one derived value → N dots), so there are no per-particle hooks.
 *
 * Runtime is GPU/native (Skia) + UI-thread (Reanimated) — not exercised by jest (mocked) or the
 * simulator E2E golden path (debug instant-defeat emits no hit events); confirm the visuals on a
 * device build.
 */

export interface CombatBurst {
  id: number;
  target: 'creature' | 'player';
  damageType: DamageType | null;
  resist: ResistTier;
}

interface BurstPreset {
  color: string;
  count: number;
  speed: number; // px the dots travel outward
  size: number; // dot diameter (stroke width)
  lifetimeMs: number;
  upwardBias: number; // 0..1 — fire drifts up rather than radiating evenly
  gravity: number; // px added to y over the life (negative = floats up)
}

// Colors match the 2b.1 damage-type number colors so the burst + number read as the same element.
const PARTICLE_PRESETS: Record<DamageType, BurstPreset> = {
  fire: {
    color: '#FF7043',
    count: 16,
    speed: 34,
    size: 5,
    lifetimeMs: 620,
    upwardBias: 0.7,
    gravity: -26,
  },
  frost: {
    color: '#4FC3F7',
    count: 12,
    speed: 40,
    size: 5,
    lifetimeMs: 560,
    upwardBias: 0,
    gravity: 8,
  },
  arcane: {
    color: '#BA68C8',
    count: 14,
    speed: 36,
    size: 5,
    lifetimeMs: 640,
    upwardBias: 0,
    gravity: 0,
  },
  physical: {
    color: '#ECEFF1',
    count: 10,
    speed: 46,
    size: 4,
    lifetimeMs: 440,
    upwardBias: 0,
    gravity: 12,
  },
};

// resist → burst emphasis, mirroring the RESIST/WEAK floating-number tell.
const RESIST_COUNT_SCALE: Record<ResistTier, number> = {
  resisted: 0.5,
  neutral: 1,
  vulnerable: 1.3,
};
const RESIST_OPACITY: Record<ResistTier, number> = { resisted: 0.55, neutral: 0.9, vulnerable: 1 };

interface ParticleSpec {
  angle: number;
  dist: number;
  gravity: number;
}

/** Generate a burst's particles once (JS thread, random) so the worklet just reads fixed geometry. */
function makeParticles(preset: BurstPreset, countScale: number): ParticleSpec[] {
  const count = Math.max(4, Math.round(preset.count * countScale));
  const out: ParticleSpec[] = [];
  for (let i = 0; i < count; i++) {
    const angle =
      preset.upwardBias > 0
        ? -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * (1 - preset.upwardBias)
        : (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
    const dist = preset.speed * (0.6 + Math.random() * 0.6);
    out.push({ angle, dist, gravity: preset.gravity });
  }
  return out;
}

function ParticleBurst({
  burst,
  cx,
  cy,
  onDone,
}: {
  burst: CombatBurst;
  cx: number;
  cy: number;
  onDone: (id: number) => void;
}) {
  const preset = PARTICLE_PRESETS[burst.damageType ?? 'physical'];
  const maxOpacity = RESIST_OPACITY[burst.resist];
  // Generated once — preset + resist are immutable for a given burst instance (keyed by id at the
  // call site), so this memo runs a single time and the random dots stay frozen for the burst's life
  // instead of jumping every frame.
  const particles = useMemo(
    () => makeParticles(preset, RESIST_COUNT_SCALE[burst.resist]),
    [preset, burst.resist],
  );
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: preset.lifetimeMs, easing: Easing.out(Easing.quad) },
      finished => {
        'worklet';
        if (finished) {
          runOnJS(onDone)(burst.id);
        }
      },
    );
    // Run once on mount; the burst is fixed for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const points = useDerivedValue<SkPoint[]>(() => {
    const t = progress.value;
    const reach = 1 - (1 - t) * (1 - t); // ease-out expansion
    return particles.map(p => ({
      x: cx + Math.cos(p.angle) * p.dist * reach,
      y: cy + Math.sin(p.angle) * p.dist * reach + p.gravity * t * t,
    }));
  });

  const opacity = useDerivedValue(() => (1 - progress.value) * maxOpacity);

  return (
    <Points
      points={points}
      mode="points"
      style="stroke"
      strokeWidth={preset.size}
      strokeCap="round"
      color={preset.color}
      opacity={opacity}
    />
  );
}

interface CombatFxCanvasProps {
  bursts: CombatBurst[];
  onBurstDone: (id: number) => void;
}

/**
 * Absolute-fill Skia overlay for one combatant panel. Bursts emanate from the panel center; the
 * layer never eats touches (pointerEvents none). Renders nothing until measured + while idle.
 */
export default function CombatFxCanvas({ bursts, onBurstDone }: CombatFxCanvasProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View pointerEvents="none" style={styles.layer} onLayout={onLayout}>
      {size.width > 0 && bursts.length > 0 && (
        <Canvas style={styles.canvas}>
          {bursts.map(b => (
            <ParticleBurst
              key={b.id}
              burst={b}
              cx={size.width / 2}
              cy={size.height / 2}
              onDone={onBurstDone}
            />
          ))}
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  canvas: { flex: 1 },
});
