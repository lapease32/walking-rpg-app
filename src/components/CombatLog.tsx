import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { CombatLogEntry, formatCombatLogEntry, CombatLogNames } from '../models/CombatLog';

interface Props {
  entries: CombatLogEntry[];
  /** Displayed for the player actor — "You". */
  playerName: string;
  creatureName: string;
}

// Color by what happened, so the feed is scannable: harm to the creature reads "good", harm to the
// player reads "bad", support is gold, defeat is emphasized. New kinds fall back to neutral ink.
function lineColor(e: CombatLogEntry): string {
  switch (e.kind) {
    case 'attack':
    case 'dot':
      return e.target === 'player' ? '#E57373' : '#66BB6A'; // hit on you (red) vs on the foe (green)
    case 'heal':
      return '#4CAF50';
    case 'buff':
      return '#FFB74D';
    case 'debuff':
      return '#BA68C8';
    case 'defeat':
      return e.target === 'player' ? '#E53935' : '#FFD54F';
    default:
      return '#B0BEC5';
  }
}

/**
 * Turn-by-turn combat narration. A self-contained, auto-scrolling feed (kept OUT of the modal's outer
 * ScrollView to avoid nested-scroll conflicts). Renders each {@link CombatLogEntry} via the pure
 * formatter, so any mechanic that pushes a log entry shows up here with no changes to this component.
 */
export default function CombatLog({ entries, playerName, creatureName }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const names: CombatLogNames = { player: playerName, creature: creatureName };

  // Keep the newest line in view as the fight progresses.
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [entries.length]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Combat Log</Text>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        nestedScrollEnabled
        showsVerticalScrollIndicator>
        {entries.length === 0 ? (
          <Text style={styles.empty}>The fight begins…</Text>
        ) : (
          entries.map(e => (
            <Text key={e.id} style={[styles.line, { color: lineColor(e) }]}>
              {formatCombatLogEntry(e, names)}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    backgroundColor: '#1b1b22',
    overflow: 'hidden',
  },
  title: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#8a8499',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  scroll: { maxHeight: 104 },
  content: { paddingHorizontal: 12, paddingBottom: 10 },
  line: {
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  empty: { fontSize: 12, color: '#6c6780', fontStyle: 'italic' },
});
