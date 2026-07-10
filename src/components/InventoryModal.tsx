import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { Item, canEquipInSlot, getItemSlot } from '../models/Item';
import ItemSlotIcon from './icons/ItemSlotIcon';
import StatIcon from './icons/StatIcon';
import { CloseIcon } from './icons/UiIcon';
import { getRarityColor } from '../constants/rarity';
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

// Stats shown per item, in display order. Values are item totals (affixes baked in).
type StatKey = 'attack' | 'defense' | 'maxHp' | 'hp';
const STAT_DISPLAY: { key: StatKey; prefix: string }[] = [
  { key: 'attack', prefix: '' },
  { key: 'defense', prefix: '' },
  { key: 'maxHp', prefix: '+' },
  { key: 'hp', prefix: '+' },
];
const STAT_UP = '#2e7d32'; // green: beats the equipped item's stat
const STAT_DOWN = '#c62828'; // red: worse than equipped
const STAT_NEUTRAL = '#444'; // equal, or nothing equipped to compare against

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
      // Compare by id so player rebuilds (new object references) don't
      // incorrectly dismiss the detail view when the item hasn't changed
      if (currentItem?.id !== selectedItem.id) {
        setShowItemDetails(false);
        setSelectedItem(null);
        setSelectedItemIndex(-1);
      }
    }
  }, [inventory, selectedItemIndex, selectedItem]);

  // The item currently equipped in this item's slot, for stat comparison.
  // Accessories compare against accessory1 (their default slot) — a reasonable hint;
  // the detail modal shows the full picture.
  const getEquippedFor = (target: Item): Item | null => {
    if (!player) return null;
    return player.equipment[getItemSlot(target)] ?? null;
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
      if (currentItem?.id !== selectedItem.id) {
        // Item has changed, reset state and abort
        setShowItemDetails(false);
        setSelectedItem(null);
        setSelectedItemIndex(-1);
        return;
      }

      // Pass the slot the player actually tapped (equipmentSlot) so an accessory lands where they
      // chose — accessory1 OR accessory2 — instead of always auto-routing to accessory2 when
      // accessory1 is full. null (inventory opened normally) keeps the auto-routing behavior.
      const success = player.equipItem(selectedItemIndex, equipmentSlot);
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
      if (currentItem?.id !== selectedItem.id) {
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

  const renderItemRow = (item: Item, originalIndex: number) => {
    const rarityColor = getRarityColor(item.rarity);
    const equipped = getEquippedFor(item);
    const affixCount = item.affixes?.length ?? 0;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.row, { borderLeftColor: rarityColor }]}
        onPress={() => handleItemPress(item, originalIndex)}
        activeOpacity={0.7}>
        <ItemSlotIcon slot={item.type} size={26} color={rarityColor} style={styles.rowIcon} />
        <View style={styles.rowBody}>
          <Text style={[styles.rowName, { color: rarityColor }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.rowMeta}>
            Lv {item.level} · {item.rarity.toUpperCase()}
            {affixCount > 0 ? ` · ◆ ${affixCount}` : ''}
          </Text>
          <View style={styles.statRow}>
            {STAT_DISPLAY.map(({ key, prefix }) => {
              const value = item[key];
              if (value === undefined) {
                return null;
              }
              // Compare against the equipped item's same stat (treat missing as 0).
              // Only color/arrow when something is equipped to compare against.
              const equippedValue = equipped ? (equipped[key] ?? 0) : undefined;
              let color = STAT_NEUTRAL;
              let arrow = '';
              if (equippedValue !== undefined) {
                if (value > equippedValue) {
                  color = STAT_UP;
                  arrow = ' ▲';
                } else if (value < equippedValue) {
                  color = STAT_DOWN;
                  arrow = ' ▼';
                }
              }
              return (
                <View key={key} style={styles.statChip}>
                  <StatIcon stat={key} size={13} color={color} />
                  <Text style={[styles.statChipText, { color }]}>
                    {' '}
                    {prefix}
                    {value}
                    {arrow}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const usedSlots = inventory.filter(item => item !== null).length;
  const totalSlots = inventory.length;
  const filteredUsedSlots = filteredInventoryData.filter(({ item }) => item !== null).length;

  // Non-empty items to render as rows (keeps original index for equip/delete by index)
  const itemRows = filteredInventoryData.filter(
    (entry): entry is { item: Item; originalIndex: number } => entry.item !== null,
  );

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
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {equipmentSlot ? `${getSlotLabel(equipmentSlot)} Items` : 'Inventory'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <CloseIcon size={18} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.statsBar}>
            <Text style={styles.statsText}>
              {equipmentSlot
                ? `${filteredUsedSlots} ${getSlotLabel(equipmentSlot).toLowerCase()} item${
                    filteredUsedSlots !== 1 ? 's' : ''
                  } available`
                : `${usedSlots} / ${totalSlots} slots used`}
            </Text>
          </View>
          {player && (
            <Text style={styles.legend}>
              <Text style={{ color: STAT_UP }}>▲ better</Text> /{' '}
              <Text style={{ color: STAT_DOWN }}>▼ worse</Text> than equipped
            </Text>
          )}

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {itemRows.length === 0 ? (
              <Text style={styles.emptyText}>
                {equipmentSlot
                  ? 'No items for this slot yet.'
                  : 'No items yet — defeat creatures to find loot!'}
              </Text>
            ) : (
              itemRows.map(({ item, originalIndex }) => renderItemRow(item, originalIndex))
            )}
          </ScrollView>
        </View>
      </Pressable>

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
    marginBottom: 8,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  legend: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginBottom: 12,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#e0e0e0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  rowIcon: {
    marginRight: 12,
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  rowMeta: {
    fontSize: 11,
    color: '#888',
    marginBottom: 5,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
    marginBottom: 2,
  },
  statChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
