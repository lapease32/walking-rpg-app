import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Equipment, EquipmentSlot } from '../models/Player';

interface EquipmentProps {
  equipment: Equipment;
  onSlotPress?: (slot: EquipmentSlot) => void;
}

/**
 * Component to display player equipment slots
 */
export default function EquipmentDisplay({ equipment, onSlotPress }: EquipmentProps) {
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

  const slotIcons: Record<keyof Equipment, string> = {
    weapon: '⚔️',
    offhand: '🛡️',
    head: '👑',
    chest: '👕',
    legs: '👖',
    boots: '👢',
    gloves: '🧤',
    accessory1: '💍',
    accessory2: '💍',
  };

  const renderSlot = (slotKey: keyof Equipment) => {
    const item = equipment[slotKey];
    const isEmpty = item === null;

    const slotContent = (
      <View style={[styles.slot, isEmpty && styles.emptySlot]}>
        <Text style={styles.slotIcon}>{slotIcons[slotKey]}</Text>
        <Text style={[styles.slotLabel, isEmpty && styles.emptySlotText]}>
          {slotLabels[slotKey]}
        </Text>
        {isEmpty && (
          <Text style={styles.emptyText}>Empty</Text>
        )}
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
          activeOpacity={0.7}
        >
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
        <View style={styles.equipmentRow}>
          {renderSlot('head')}
        </View>
        <View style={styles.equipmentRow}>
          {renderSlot('chest')}
        </View>
        <View style={styles.equipmentRow}>
          {renderSlot('legs')}
        </View>
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

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginVertical: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
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
    color: '#666',
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
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
  },
  emptySlot: {
    backgroundColor: '#fafafa',
    borderColor: '#d0d0d0',
    borderStyle: 'dashed',
  },
  slotIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  slotLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  emptySlotText: {
    color: '#999',
  },
  emptyText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  itemInfo: {
    marginTop: 4,
    alignItems: 'center',
  },
  itemName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  itemLevel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
});

