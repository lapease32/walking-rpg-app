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
import { Player } from '../models/Player';

interface ItemDetailsModalProps {
  item: Item | null;
  player: Player | null;
  visible: boolean;
  onClose: () => void;
  onEquip: () => void;
  onDelete: () => void;
}

/**
 * Modal component for displaying item details and actions
 */
export default function ItemDetailsModal({
  item,
  player,
  visible,
  onClose,
  onEquip,
  onDelete,
}: ItemDetailsModalProps) {
  if (!item) {
    return null;
  }

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

  const getSlotName = (item: Item): string => {
    const slotMap: Record<Item['type'], string> = {
      weapon: 'Weapon',
      offhand: 'Offhand',
      head: 'Head',
      chest: 'Chest',
      legs: 'Legs',
      boots: 'Boots',
      gloves: 'Gloves',
      accessory: 'Accessory',
    };
    return slotMap[item.type] || 'Unknown';
  };

  const canEquip = player !== null && item.level <= player.level;
  const levelRequirementMet = player !== null && item.level <= player.level;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Item Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Item Icon */}
            <View style={styles.iconContainer}>
              <Text style={styles.itemIcon}>{getItemIcon(item)}</Text>
            </View>

            {/* Item Name */}
            <Text
              style={[
                styles.itemName,
                { color: getRarityColor(item.rarity) },
              ]}
            >
              {item.name}
            </Text>

            {/* Item Type and Rarity */}
            <View style={styles.metaContainer}>
              <Text style={styles.metaText}>
                {getSlotName(item)} • {item.rarity.toUpperCase()}
              </Text>
              <Text style={styles.levelText}>Level {item.level}</Text>
            </View>

            {/* Description */}
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionText}>{item.description}</Text>
            </View>

            {/* Stats */}
            {(item.attack !== undefined ||
              item.defense !== undefined ||
              item.hp !== undefined ||
              item.maxHp !== undefined) && (
              <View style={styles.statsContainer}>
                <Text style={styles.statsTitle}>Stats</Text>
                <View style={styles.statsGrid}>
                  {item.attack !== undefined && (
                    <View style={styles.statItem}>
                      <Text style={styles.statIcon}>⚔️</Text>
                      <Text style={styles.statLabel}>Attack</Text>
                      <Text style={styles.statValue}>+{item.attack}</Text>
                    </View>
                  )}
                  {item.defense !== undefined && (
                    <View style={styles.statItem}>
                      <Text style={styles.statIcon}>🛡️</Text>
                      <Text style={styles.statLabel}>Defense</Text>
                      <Text style={styles.statValue}>+{item.defense}</Text>
                    </View>
                  )}
                  {item.hp !== undefined && (
                    <View style={styles.statItem}>
                      <Text style={styles.statIcon}>❤️</Text>
                      <Text style={styles.statLabel}>HP</Text>
                      <Text style={styles.statValue}>+{item.hp}</Text>
                    </View>
                  )}
                  {item.maxHp !== undefined && (
                    <View style={styles.statItem}>
                      <Text style={styles.statIcon}>💚</Text>
                      <Text style={styles.statLabel}>Max HP</Text>
                      <Text style={styles.statValue}>+{item.maxHp}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Level Requirement Warning */}
            {!levelRequirementMet && player && (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  ⚠️ Requires level {item.level} (You are level {player.level})
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.equipButton,
                !canEquip && styles.actionButtonDisabled,
              ]}
              onPress={onEquip}
              disabled={!canEquip}
            >
              <Text style={styles.actionButtonText}>Equip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={onDelete}
            >
              <Text style={styles.actionButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
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
    borderRadius: 20,
    width: '90%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
    color: '#666',
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  itemIcon: {
    fontSize: 64,
  },
  itemName: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  metaContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  metaText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  descriptionContainer: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  statsContainer: {
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  warningContainer: {
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    marginBottom: 20,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  equipButton: {
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  actionButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

