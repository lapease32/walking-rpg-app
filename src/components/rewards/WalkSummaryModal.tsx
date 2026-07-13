import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getRarityColor } from '../../constants/rarity';
import ItemSlotIcon from '../icons/ItemSlotIcon';
import StatIcon from '../icons/StatIcon';
import { FleeIcon } from '../icons/UiIcon';
import { WalkSummaryEntry } from '../../utils/storage';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeTokens } from '../../constants/theme';

/**
 * The "while you walked" recap: a batched list of the encounters that auto-resolved passively
 * while the player was walking / the app was backgrounded. Shown on foreground (see
 * useEncounter.checkWalkSummary). Rewards were already applied when each entry was recorded — this
 * is purely the celebratory readout, so a plain legible list beats the single-item particle burst.
 */
interface Props {
  entries: WalkSummaryEntry[] | null;
  onDismiss: () => void;
}

export default function WalkSummaryModal({ entries, onDismiss }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  if (!entries || entries.length === 0) {
    return null;
  }

  const fought = entries.length;
  const won = entries.reduce((n, e) => n + (e.won ? 1 : 0), 0);
  const totalXp = entries.reduce((n, e) => n + e.xpGained, 0);
  const itemsFound = entries.reduce((n, e) => n + (e.item ? 1 : 0), 0);

  // Newest first — the most recent fights are the most interesting to scan.
  const rows = [...entries].reverse();

  return (
    <Modal transparent visible={true} animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.fill} onPress={onDismiss} testID="walk-summary">
        <View style={styles.backdrop} />
        <View style={styles.center}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>While you walked…</Text>

            <View style={styles.totalsRow}>
              <Total label="Fought" value={String(fought)} />
              <Total label="Won" value={String(won)} accent={theme.success} />
              <Total label="XP" value={`+${totalXp}`} accent={theme.warning} />
              <Total label="Items" value={String(itemsFound)} accent={theme.info} />
            </View>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {rows.map((e, i) => {
                const color = e.item ? getRarityColor(e.item.rarity) : theme.textSecondary;
                return (
                  <View key={`${e.timestamp}-${i}`} style={styles.row}>
                    <View style={styles.rowResult}>
                      {e.won ? (
                        <StatIcon stat="attack" size={16} color={theme.success} />
                      ) : (
                        <FleeIcon size={16} color={theme.textSecondary} />
                      )}
                    </View>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowCreature} numberOfLines={1}>
                        {e.won ? 'Defeated' : 'Fled from'} {e.creatureName}
                      </Text>
                      {e.item && (
                        <View style={styles.rowItemLine}>
                          <ItemSlotIcon slot={e.item.type} size={13} color={color} />
                          <Text style={[styles.rowItem, { color }]} numberOfLines={1}>
                            {' '}
                            {e.item.name}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.rowXp}>+{e.xpGained}</Text>
                  </View>
                );
              })}
            </ScrollView>

            <Text style={styles.prompt}>Tap outside to close</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

// A child of ThemeProvider, so it reads the palette itself rather than borrowing the parent's
// memoised styles.
function Total({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.total}>
      <Text style={[styles.totalValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    fill: { flex: 1 },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.78)',
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: {
      width: '86%',
      maxWidth: 420,
      maxHeight: '80%',
      backgroundColor: t.surfaceAlt,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: t.warning,
      paddingVertical: 22,
      paddingHorizontal: 22,
      shadowColor: t.warning,
      shadowOpacity: 0.7,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 0 },
      elevation: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: t.warning,
      textAlign: 'center',
      marginBottom: 16,
    },
    totalsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 14,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    total: { alignItems: 'center' },
    totalValue: { fontSize: 20, fontWeight: 'bold', color: t.text },
    totalLabel: { fontSize: 11, color: t.textMuted, marginTop: 2, letterSpacing: 1 },
    list: { flexGrow: 0 },
    listContent: { paddingBottom: 4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.divider,
    },
    rowResult: { width: 28, alignItems: 'center', justifyContent: 'center' },
    rowMain: { flex: 1, paddingHorizontal: 8 },
    rowCreature: { fontSize: 14, color: t.text, fontWeight: '600' },
    rowItemLine: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    // flexShrink lets the name shrink within the row so numberOfLines={1} can ellipsize
    // (in RN, truncation in a horizontal row needs a bounded width).
    rowItem: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
    rowXp: { fontSize: 14, color: t.warning, fontWeight: 'bold' },
    prompt: { marginTop: 16, color: t.textMuted, fontSize: 12, textAlign: 'center' },
  });
