import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Item, canEquipInSlot } from '../models/Item';
import { Rarity } from '../models/Creature';
import { Player, EquipmentSlot } from '../models/Player';
import ItemDetailsModal from './ItemDetailsModal';

interface InventoryModalProps {
  inventory: (Item | null)[];
  player: Player | null;
  visible: boolean;
  onClose: () => void;
  onItemEquipped?: () => void;
  onItemDeleted?: () => void;
  equipmentSlot?: EquipmentSlot | null; // Optional filter for equipment slot
}

/**
 * Modal component for displaying player inventory
 */
export default function InventoryModal({
  inventory,
  player,
  visible,
  onClose,
  onItemEquipped,
  onItemDeleted,
  equipmentSlot,
}: InventoryModalProps) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(-1);
  const [showItemDetails, setShowItemDetails] = useState<boolean>(false);

  // Filter inventory based on equipment slot if provided
  // Returns array of { item, originalIndex } pairs for filtered items
  const filteredInventoryData = useMemo(() => {
    if (!equipmentSlot) {
      // Return all items with their indices
      return inventory.map((item, index) => ({ item, originalIndex: index }));
    }
    // Filter items that can be equipped in the specified slot
    return inventory
      .map((item, index) => ({ item, originalIndex: index }))
      .filter(({ item }) => item !== null && canEquipInSlot(item, equipmentSlot));
  }, [inventory, equipmentSlot]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setShowItemDetails(false);
      setSelectedItem(null);
      setSelectedItemIndex(-1);
    }
  }, [visible]);

  // Validate selectedItemIndex matches selectedItem when inventory changes
  useEffect(() => {
    if (selectedItemIndex !== -1 && selectedItem !== null) {
      const currentItem = inventory[selectedItemIndex];
      // If the item at the index doesn't match the selected item, reset state
      if (currentItem !== selectedItem) {
        setShowItemDetails(false);
        setSelectedItem(null);
        setSelectedItemIndex(-1);
      }
    }
  }, [inventory, selectedItemIndex, selectedItem]);
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

  const handleItemPress = (item: Item | null, originalIndex: number) => {
    if (item !== null) {
      setSelectedItem(item);
      setSelectedItemIndex(originalIndex);
      setShowItemDetails(true);
    }
  };

  const handleEquip = () => {
    if (selectedItemIndex !== -1 && player && selectedItem !== null) {
      // Validate that the item at the index still matches the selected item
      const currentItem = inventory[selectedItemIndex];
      if (currentItem !== selectedItem) {
        // Item has changed, reset state and abort
        setShowItemDetails(false);
        setSelectedItem(null);
        setSelectedItemIndex(-1);
        return;
      }

      const success = player.equipItem(selectedItemIndex);
      if (success) {
        setShowItemDetails(false);
        setSelectedItem(null);
        setSelectedItemIndex(-1);
        if (onItemEquipped) {
          onItemEquipped();
        }
      }
    }
  };

  const handleDelete = () => {
    if (selectedItemIndex !== -1 && player && selectedItem !== null) {
      // Validate that the item at the index still matches the selected item
      const currentItem = inventory[selectedItemIndex];
      if (currentItem !== selectedItem) {
        // Item has changed, reset state and abort
        setShowItemDetails(false);
        setSelectedItem(null);
        setSelectedItemIndex(-1);
        return;
      }

      player.removeItemFromInventory(selectedItemIndex);
      setShowItemDetails(false);
      setSelectedItem(null);
      setSelectedItemIndex(-1);
      if (onItemDeleted) {
        onItemDeleted();
      }
    }
  };

  const handleCloseItemDetails = () => {
    setShowItemDetails(false);
    setSelectedItem(null);
    setSelectedItemIndex(-1);
  };

  const renderInventorySlot = (item: Item | null, index: number) => {
    const isEmpty = item === null;
    const slotBorderColor = !isEmpty && item ? getRarityColor(item.rarity) : '#d0d0d0';
    const slotBorderStyle: 'solid' | 'dashed' = isEmpty ? 'dashed' : 'solid';

    return (
      <TouchableOpacity
        key={index}
        style={styles.slotContainer}
        onPress={() => handleItemPress(item, index)}
        disabled={isEmpty}
        activeOpacity={isEmpty ? 1 : 0.7}
      >
        <View
          style={[
            styles.slot,
            isEmpty && styles.emptySlot,
            { borderColor: slotBorderColor, borderStyle: slotBorderStyle },
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
                {(item.attack !== undefined || item.defense !== undefined || item.hp !== undefined || item.maxHp !== undefined) && (
                  <View style={styles.itemStats}>
                    {item.attack !== undefined && (
                      <Text style={styles.statText}>⚔️ {item.attack}</Text>
                    )}
                    {item.defense !== undefined && (
                      <Text style={styles.statText}>🛡️ {item.defense}</Text>
                    )}
                    {item.hp !== undefined && (
                      <Text style={styles.statText}>❤️ +{item.hp}</Text>
                    )}
                    {item.maxHp !== undefined && (
                      <Text style={styles.statText}>💚 +{item.maxHp}</Text>
                    )}
                  </View>
                )}
              </View>
            )
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const usedSlots = inventory.filter((item) => item !== null).length;
  const totalSlots = inventory.length;
  const filteredUsedSlots = filteredInventoryData.filter(({ item }) => item !== null).length;

  // Get slot label for display
  const getSlotLabel = (slot: EquipmentSlot): string => {
    const labels: Record<EquipmentSlot, string> = {
      weapon: 'Weapon',
      offhand: 'Offhand',
      head: 'Head',
      chest: 'Chest',
      legs: 'Legs',
      boots: 'Boots',
      gloves: 'Gloves',
      accessory1: 'Accessory',
      accessory2: 'Accessory',
    };
    return labels[slot];
  };

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
            <Text style={styles.title}>
              {equipmentSlot ? `${getSlotLabel(equipmentSlot)} Items` : 'Inventory'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsBar}>
            <Text style={styles.statsText}>
              {equipmentSlot
                ? `${filteredUsedSlots} ${getSlotLabel(equipmentSlot).toLowerCase()} item${filteredUsedSlots !== 1 ? 's' : ''} available`
                : `${usedSlots} / ${totalSlots} slots used`}
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.inventoryGrid}>
              {filteredInventoryData.map(({ item, originalIndex }) =>
                renderInventorySlot(item, originalIndex)
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      <ItemDetailsModal
        item={selectedItem}
        player={player}
        visible={showItemDetails}
        onClose={handleCloseItemDetails}
        onEquip={handleEquip}
        onDelete={handleDelete}
      />
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
    maxHeight: '90%',
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
    aspectRatio: 0.85, // Slightly taller to accommodate more content
    marginRight: '1.875%', // Space between items (will overflow slightly on last item of row, but acceptable)
    marginBottom: 8,
  },
  slot: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    padding: 6,
    justifyContent: 'flex-start',
    alignItems: 'center',
    overflow: 'hidden',
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
    justifyContent: 'flex-start',
    flex: 1,
  },
  itemIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  itemName: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 1,
    lineHeight: 11,
  },
  itemLevel: {
    fontSize: 7,
    color: '#666',
    marginBottom: 1,
  },
  itemRarity: {
    fontSize: 6,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemStats: {
    alignItems: 'center',
    marginTop: 1,
  },
  statText: {
    fontSize: 6,
    color: '#666',
    lineHeight: 8,
  },
});

