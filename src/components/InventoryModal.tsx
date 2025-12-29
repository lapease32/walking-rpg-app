import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Item } from '../models/Item';
import { Rarity } from '../models/Creature';

interface InventoryModalProps {
  inventory: (Item | null)[];
  visible: boolean;
  onClose: () => void;
}

/**
 * Modal component for displaying player inventory
 */
export default function InventoryModal({
  inventory,
  visible,
  onClose,
}: InventoryModalProps) {
  const rarityColors: Record<Rarity, string> = {
    common: '#9E9E9E',
    uncommon: '#4CAF50',
    rare: '#2196F3',
    epic: '#9C27B0',
    legendary: '#FF9800',
  };

  const getRarityColor = (rarity: Rarity): string => {
    return rarityColors[rarity] || '#9E9E9E';
  };

  const getItemIcon = (item: Item): string => {
    const iconMap: Record<Item['type'], string> = {
      weapon: '⚔️',
      offhand: '🛡️',
      head: '👑',
      chest: '👕',
      legs: '👖',
      boots: '👢',
      gloves: '🧤',
      accessory: '💍',
    };
    return iconMap[item.type] || '📦';
  };

  const renderInventorySlot = (item: Item | null, index: number) => {
    const isEmpty = item === null;

    return (
      <View key={index} style={styles.slotContainer}>
        <View
          style={[
            styles.slot,
            isEmpty && styles.emptySlot,
            !isEmpty && item && {
              borderColor: getRarityColor(item.rarity),
              borderWidth: 2,
            },
          ]}
        >
          {isEmpty ? (
            <View style={styles.emptySlotContent}>
              <Text style={styles.emptySlotIcon}>📦</Text>
              <Text style={styles.emptySlotText}>Empty</Text>
            </View>
          ) : (
            item && (
              <View style={styles.itemContent}>
                <Text style={styles.itemIcon}>{getItemIcon(item)}</Text>
                <Text
                  style={[
                    styles.itemName,
                    { color: getRarityColor(item.rarity) },
                  ]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                <Text style={styles.itemLevel}>Lv. {item.level}</Text>
                <Text style={styles.itemRarity}>
                  {item.rarity.toUpperCase()}
                </Text>
                {(item.attack || item.defense || item.hp || item.maxHp) && (
                  <View style={styles.itemStats}>
                    {item.attack && (
                      <Text style={styles.statText}>⚔️ {item.attack}</Text>
                    )}
                    {item.defense && (
                      <Text style={styles.statText}>🛡️ {item.defense}</Text>
                    )}
                    {item.hp && (
                      <Text style={styles.statText}>❤️ +{item.hp}</Text>
                    )}
                    {item.maxHp && (
                      <Text style={styles.statText}>💚 +{item.maxHp}</Text>
                    )}
                  </View>
                )}
              </View>
            )
          )}
        </View>
      </View>
    );
  };

  const usedSlots = inventory.filter((item) => item !== null).length;
  const totalSlots = inventory.length;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Inventory</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsBar}>
            <Text style={styles.statsText}>
              {usedSlots} / {totalSlots} slots used
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.inventoryGrid}>
              {inventory.map((item, index) => renderInventorySlot(item, index))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '85%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#333',
    fontWeight: 'bold',
  },
  statsBar: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 16,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 10,
  },
  inventoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 2,
  },
  slotContainer: {
    width: '18.5%', // 5 columns with margins
    aspectRatio: 1,
    marginRight: '1.875%', // Space between items (will overflow slightly on last item of row, but acceptable)
    marginBottom: 8,
  },
  slot: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySlot: {
    backgroundColor: '#fafafa',
    borderStyle: 'dashed',
    borderColor: '#d0d0d0',
  },
  emptySlotContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  emptySlotText: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
  },
  itemContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  itemName: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  itemLevel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  itemRarity: {
    fontSize: 7,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemStats: {
    alignItems: 'center',
    marginTop: 2,
  },
  statText: {
    fontSize: 7,
    color: '#666',
  },
});

