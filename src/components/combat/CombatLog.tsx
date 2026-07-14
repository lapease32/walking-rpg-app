import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { CombatLogEntry, formatCombatLogEntry, CombatLogNames } from '../../models/CombatLog';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeTokens } from '../../constants/theme';

interface Props {
  entries: CombatLogEntry[];
  /** Displayed for the player actor — "You". */
  playerName: string;
  creatureName: string;
}

// Color by what happened, so the feed is scannable: harm to the creature reads "good", harm to the
// player reads "bad", support is warm, defeat is emphasized. New kinds fall back to muted ink.
function lineColor(e: CombatLogEntry, t: ThemeTokens): string {
  switch (e.kind) {
    case 'attack':
    case 'dot':
      return e.target === 'player' ? t.danger : t.success; // hit on you vs on the foe
    case 'heal':
      return t.success;
    case 'buff':
      return t.warning;
    case 'debuff':
      return t.arcane;
    case 'defeat':
      return e.target === 'player' ? t.danger : t.accent;
    default:
      return t.textSecondary;
  }
}

/**
 * Turn-by-turn combat narration. A self-contained, auto-scrolling feed (kept OUT of the modal's outer
 * ScrollView to avoid nested-scroll conflicts). Renders each {@link CombatLogEntry} via the pure
 * formatter, so any mechanic that pushes a log entry shows up here with no changes to this component.
 */
export default function CombatLog({ entries, playerName, creatureName }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
            <Text key={e.id} style={[styles.line, { color: lineColor(e, theme) }]}>
              {formatCombatLogEntry(e, names)}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    wrap: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surfaceAlt,
      overflow: 'hidden',
    },
    title: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: t.textMuted,
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
    empty: { fontSize: 12, color: t.textMuted, fontStyle: 'italic' },
  });
