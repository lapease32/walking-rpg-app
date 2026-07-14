import React, { useMemo, useState } from 'react';
import { View, Image, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import type { Rarity } from '../../models/Creature';
import { computeStageLayout } from '../../models/stageLayout';
import { resolvePaintedCreature } from './creatures/paintedRegistry';
import type { CreatureAnimState } from './creatures/types';
import CreaturePlate from './CreaturePlate';

interface Props {
  /** Creature template id — selects the painted sprite (else falls back to the plate). */
  creatureId?: string;
  /** Creature type — drives the fallback emblem. */
  type: string;
  /** Rarity — drives the fallback plate frame. */
  rarity: Rarity;
  /**
   * Is the sun up where this fight is? Drives WHICH art key shows and the stage ground colour —
   * the REAL sun, never the app theme (a night creature forced onto a bone stage is the exact
   * mismatch the cutouts fixed). `undefined` = no sun info → natural-light art, no gloom.
   */
  daylight?: boolean;
  /** Combat animation state (reserved for sprite FX; forwarded to the fallback plate today). */
  state?: CreatureAnimState;
  /** FX overlays owned by the combat screen (hit flash, floaters, Skia bursts). */
  children?: React.ReactNode;
}

/**
 * The combat STAGE — a lit diorama a painted creature stands in, replacing the 38px medallion that
 * turned painted art into a smudge. It is a WINDOW INTO THE CREATURE'S WORLD, lit by the real sun:
 * crushed black at night, bleached bone by day, independent of the app's theme.
 *
 * The sprite is placed and grounded from framing measured off its own alpha (see
 * {@link computeStageLayout}); the grounding pool spans the creature's actual foot contacts so it
 * plants a biped and a quadruped alike. A creature with no painted art falls back to its vector/
 * emblem {@link CreaturePlate}, so the whole roster renders here while art phases in creature by
 * creature.
 */
export default function CreatureStage({
  creatureId,
  type,
  rarity,
  daylight,
  state = 'idle',
  children,
}: Props) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const painted = resolvePaintedCreature(creatureId, daylight);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(prev =>
      prev && prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  const layout = useMemo(() => {
    if (!size || !painted) {
      return null;
    }
    return computeStageLayout(size.width, size.height, painted.key.framing, painted.scale);
  }, [size, painted]);

  const isDay = daylight === true;
  const ground = isDay ? STAGE_GROUND.day : STAGE_GROUND.night;

  return (
    <View
      style={[styles.stage, { backgroundColor: ground }]}
      onLayout={onLayout}
      testID="creature-stage">
      {size && painted && layout ? (
        <>
          {/* A night creature exposed by day: pool of its own darkness so its crushed shadows read
              as gloom, not holes. Behind the sprite. */}
          {painted.gloom && <GloomPool width={size.width} height={size.height} />}

          {/* Grounding pool — behind the sprite, spanning its real foot contacts. */}
          <GroundPool
            left={layout.pool.left}
            top={layout.pool.top}
            width={layout.pool.width}
            height={layout.pool.height}
            day={isDay}
          />

          <Image
            source={painted.key.source}
            resizeMode="contain"
            style={[
              styles.abs,
              {
                left: layout.sprite.left,
                top: layout.sprite.top,
                width: layout.sprite.width,
                height: layout.sprite.height,
              },
            ]}
            testID="creature-sprite"
          />
        </>
      ) : (
        // No painted art (or not measured yet): the creature's vector/emblem plate, centred.
        <View style={styles.plateWrap}>
          <CreaturePlate
            type={type}
            rarity={rarity}
            size={size ? Math.round(Math.min(size.width, size.height) * 0.62) : 120}
            creatureId={creatureId}
            state={state}
          />
        </View>
      )}

      {children}
    </View>
  );
}

/** Stage ground — art/stage semantics (fixed, NOT a theme token), keyed to the real sun. */
const STAGE_GROUND = { night: '#0A0A0D', day: '#A69E92' } as const;

/** A soft radial shadow the creature stands in, spanning its measured foot contacts. */
function GroundPool({
  left,
  top,
  width,
  height,
  day,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  day: boolean;
}) {
  // A plateau, not a peak: flat dark core out to ~40%, then a soft fade — so every foot inside the
  // pool is occluded equally rather than the near-centre one getting a darker shadow.
  const tint = day ? '48,41,31' : '0,0,0';
  const core = day ? 0.62 : 0.82;
  return (
    <Svg pointerEvents="none" width={width} height={height} style={[styles.abs, { left, top }]}>
      <Defs>
        <RadialGradient id="pool" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={`rgb(${tint})`} stopOpacity={core} />
          <Stop offset="38%" stopColor={`rgb(${tint})`} stopOpacity={core} />
          <Stop offset="62%" stopColor={`rgb(${tint})`} stopOpacity={core * 0.42} />
          <Stop offset="82%" stopColor={`rgb(${tint})`} stopOpacity={core * 0.16} />
          <Stop offset="100%" stopColor={`rgb(${tint})`} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill="url(#pool)" />
    </Svg>
  );
}

/** The gloom pool — a broad well of darkness behind an off-window night creature by day. */
function GloomPool({ width, height }: { width: number; height: number }) {
  return (
    <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="gloom" cx="50%" cy="54%" rx="52%" ry="48%">
          <Stop offset="0%" stopColor="#08080B" stopOpacity={0.95} />
          <Stop offset="42%" stopColor="#08080B" stopOpacity={0.72} />
          <Stop offset="78%" stopColor="#08080B" stopOpacity={0.1} />
          <Stop offset="100%" stopColor="#08080B" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse
        cx={width / 2}
        cy={height * 0.54}
        rx={width / 2}
        ry={height / 2}
        fill="url(#gloom)"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1, // square on roomy screens…
    flexShrink: 1, // …but yields to the ability list on short ones (e.g. iPhone SE)
    minHeight: 160, // never smaller than this — a painted creature must stay legible
    overflow: 'hidden',
  },
  abs: { position: 'absolute' },
  plateWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
