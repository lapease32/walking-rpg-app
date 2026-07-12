import React from 'react';
import { View, StyleSheet } from 'react-native';
import ElementEmblem, { emblemColor } from '../icons/ElementEmblem';
import { getRarityColor } from '../../constants/rarity';
import type { Rarity } from '../../models/Creature';

interface Props {
  /** Creature `type` — drives the emblem + its element tint. */
  type: string;
  /** Creature rarity — drives the frame color + glow. */
  rarity: Rarity;
  /** Outer medallion diameter. */
  size?: number;
}

/**
 * A creature's visual identity: its element emblem inside a rarity-colored, softly-glowing medallion.
 * The "code-driven first" stand-in for figurative sprite art — gives a creature presence beyond text
 * (element by emblem + tint, rarity by the ring/glow). Swappable for a real sprite later.
 */
export default function CreaturePlate({ type, rarity, size = 76 }: Props) {
  const ring = getRarityColor(rarity);
  const element = emblemColor(type);
  return (
    <View
      style={[
        styles.medallion,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: ring,
          shadowColor: ring,
          backgroundColor: `${element}22`, // element tint at ~13% alpha
        },
      ]}
      testID="creature-plate">
      <ElementEmblem type={type} size={Math.round(size * 0.56)} color={element} />
    </View>
  );
}

const styles = StyleSheet.create({
  medallion: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    // Soft rarity glow (iOS shadow + Android elevation).
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
});
