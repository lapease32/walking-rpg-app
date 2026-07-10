import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Encounter } from '../models/Encounter';
import { getRarityColor } from '../constants/rarity';
import PressableScale from './PressableScale';
import StatIcon from './icons/StatIcon';

/**
 * Inline "worthy foe" card for a held ELITE encounter. Deliberately NOT a Modal — it sits in the
 * HomeScreen layout and coexists with the walk-summary / reward-reveal modals (no stacking
 * coordination). Tapping "Fight" engages the turn-based encounter (see useEncounter.engageHeldFoe).
 */
interface Props {
  foe: Encounter | null;
  onFight: () => void;
}

export default function WorthyFoeCard({ foe, onFight }: Props) {
  if (!foe) {
    return null;
  }
  const { creature } = foe;
  const color = getRarityColor(creature.rarity);

  return (
    // Phase-0 graphics proof: a spring fade+slide entrance via Reanimated when a worthy foe appears.
    <Animated.View
      entering={FadeInDown.springify().damping(14)}
      style={[styles.card, { borderColor: color, shadowColor: color }]}
      testID="worthy-foe-card">
      <View style={styles.labelRow}>
        <StatIcon stat="attack" size={12} color="#FFB74D" />
        <Text style={styles.label}> A WORTHY FOE STALKS YOU</Text>
      </View>
      <Text style={[styles.name, { color }]} numberOfLines={1}>
        {creature.name}
      </Text>
      <Text style={styles.meta}>
        {creature.rarity.toUpperCase()} · Lv {creature.level}
      </Text>
      <PressableScale
        style={[styles.button, { backgroundColor: color }]}
        onPress={onFight}
        testID="worthy-foe-fight">
        <Text style={styles.buttonText}>Fight →</Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#11202E',
    borderRadius: 14,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: '#FFB74D' },
  name: { fontSize: 20, fontWeight: 'bold', marginTop: 4, textAlign: 'center' },
  meta: { fontSize: 12, fontWeight: '600', color: '#9FB3C8', marginTop: 2, letterSpacing: 1 },
  button: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  buttonText: { color: '#0B1622', fontSize: 15, fontWeight: 'bold' },
});
