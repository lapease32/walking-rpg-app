import React from 'react';
import { View, StyleSheet } from 'react-native';
import ElementEmblem, { emblemColor } from '../icons/ElementEmblem';
import { getRarityColor } from '../../constants/rarity';
import type { Rarity } from '../../models/Creature';
import { resolveCreatureBody } from './creatures/registry';
import type { CreatureAnimState } from './creatures/types';

interface Props {
  /** Creature `type` — drives the emblem + its element tint. */
  type: string;
  /** Creature rarity — drives the frame color + glow. */
  rarity: Rarity;
  /** Outer medallion diameter. */
  size?: number;
  /** Creature template `id`. If a hand-authored vector body is registered for it, that body renders
   *  instead of the element emblem (see {@link resolveCreatureBody}). */
  creatureId?: string;
  /** Animation state for a figurative body (ignored by the emblem fallback). */
  state?: CreatureAnimState;
}

/**
 * A creature's visual identity inside a rarity-colored, softly-glowing medallion. Creatures with a
 * registered hand-authored vector body ({@link resolveCreatureBody}) render it — animated by combat
 * `state`; all others fall back to their element emblem (type + tint). This component is the single
 * swap point for figurative creature art: a body drops in behind it without touching any call site.
 */
export default function CreaturePlate({
  type,
  rarity,
  size = 76,
  creatureId,
  state = 'idle',
}: Props) {
  const ring = getRarityColor(rarity);
  const element = emblemColor(type);
  const Body = resolveCreatureBody(creatureId);
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
      {Body ? (
        // Sized to the medallion's inscribed circle (~0.71×) plus a touch, so the body reads big
        // without its bounding box poking past the round frame.
        <Body size={Math.round(size * 0.76)} color={element} state={state} />
      ) : (
        <ElementEmblem type={type} size={Math.round(size * 0.56)} color={element} />
      )}
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
