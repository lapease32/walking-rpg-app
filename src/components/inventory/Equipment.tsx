import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Equipment, EquipmentSlot } from '../../models/Player';
import ItemSlotIcon from '../icons/ItemSlotIcon';
import { getRarityColor } from '../../constants/rarity';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeTokens } from '../../constants/theme';

interface EquipmentProps {
  equipment: Equipment;
  onSlotPress?: (slot: EquipmentSlot) => void;
}

/**
 * Component to display player equipment slots
 */
export default function EquipmentDisplay({ equipment, onSlotPress }: EquipmentProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const slotLabels: Record<keyof Equipment, string> = {
    weapon: 'Weapon',
    offhand: 'Offhand',
    head: 'Head',
    chest: 'Chest',
    legs: 'Legs',
    boots: 'Boots',
    gloves: 'Gloves',
    accessory1: 'Accessory 1',
    accessory2: 'Accessory 2',
  };

  const renderSlot = (slotKey: keyof Equipment) => {
    const item = equipment[slotKey];
    const isEmpty = item === null;

    const slotContent = (
      <View style={[styles.slot, isEmpty && styles.emptySlot]}>
        <ItemSlotIcon
          slot={slotKey}
          size={30}
          color={isEmpty || !item ? theme.textMuted : getRarityColor(item.rarity)}
          style={styles.slotIcon}
        />
        <Text style={[styles.slotLabel, isEmpty && styles.emptySlotText]}>
          {slotLabels[slotKey]}
        </Text>
        {isEmpty && <Text style={styles.emptyText}>Empty</Text>}
        {!isEmpty && item && (
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.itemLevel}>Lv. {item.level}</Text>
          </View>
        )}
      </View>
    );

    if (onSlotPress) {
      return (
        <TouchableOpacity
          key={slotKey}
          style={styles.slotContainer}
          onPress={() => onSlotPress(slotKey as EquipmentSlot)}
          activeOpacity={0.7}>
          {slotContent}
        </TouchableOpacity>
      );
    }

    return (
      <View key={slotKey} style={styles.slotContainer}>
        {slotContent}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Equipment</Text>
      <View style={styles.slotsGrid}>
        {/* Weapon slots */}
        <View style={styles.weaponRow}>
          {renderSlot('weapon')}
          {renderSlot('offhand')}
        </View>
        {/* Equipment slots */}
        <View style={styles.equipmentRow}>{renderSlot('head')}</View>
        <View style={styles.equipmentRow}>{renderSlot('chest')}</View>
        <View style={styles.equipmentRow}>{renderSlot('legs')}</View>
        <View style={styles.equipmentRow}>
          {renderSlot('boots')}
          {renderSlot('gloves')}
        </View>
        {/* Accessories */}
        <View style={styles.accessoriesRow}>
          <Text style={styles.sectionLabel}>Accessories</Text>
          <View style={styles.accessoriesContainer}>
            {renderSlot('accessory1')}
            {renderSlot('accessory2')}
          </View>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    container: {
      padding: 16,
      backgroundColor: t.surface,
      borderRadius: 8,
      marginVertical: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: t.text,
      marginBottom: 16,
    },
    slotsGrid: {
      gap: 12,
    },
    weaponRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    },
    equipmentRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    },
    accessoriesRow: {
      marginTop: 8,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: t.textSecondary,
      marginBottom: 8,
    },
    accessoriesContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    },
    slotContainer: {
      flex: 1,
      maxWidth: '48%',
    },
    slot: {
      padding: 12,
      backgroundColor: t.surfaceAlt,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: t.divider,
      alignItems: 'center',
      minHeight: 100,
      justifyContent: 'center',
    },
    emptySlot: {
      backgroundColor: t.surfaceRaised,
      borderColor: t.border,
      borderStyle: 'dashed',
    },
    slotIcon: {
      marginBottom: 8,
    },
    slotLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: t.text,
      marginBottom: 4,
    },
    emptySlotText: {
      color: t.textMuted,
    },
    emptyText: {
      fontSize: 12,
      color: t.textMuted,
      fontStyle: 'italic',
    },
    itemInfo: {
      marginTop: 4,
      alignItems: 'center',
    },
    itemName: {
      fontSize: 11,
      fontWeight: '600',
      color: t.text,
      textAlign: 'center',
    },
    itemLevel: {
      fontSize: 10,
      color: t.textSecondary,
      marginTop: 2,
    },
  });
