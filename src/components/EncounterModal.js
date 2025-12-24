import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

/**
 * Modal component for displaying creature encounters
 */
export default function EncounterModal({ encounter, visible, onCatch, onFight, onFlee }) {
  if (!encounter || !encounter.creature) {
    return null;
  }

  const creature = encounter.creature;
  const rarityColors = {
    common: '#9E9E9E',
    uncommon: '#4CAF50',
    rare: '#2196F3',
    epic: '#9C27B0',
    legendary: '#FF9800',
  };

  const rarityColor = rarityColors[creature.rarity] || '#9E9E9E';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onFlee}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.title}>Wild Creature Encountered!</Text>

            <View style={[styles.creatureCard, { borderColor: rarityColor }]}>
              <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
                <Text style={styles.rarityText}>
                  {creature.rarity.toUpperCase()}
                </Text>
              </View>

              <Text style={styles.creatureName}>{creature.name}</Text>
              <Text style={styles.creatureType}>{creature.type}</Text>
              <Text style={styles.creatureLevel}>Level {creature.level}</Text>

              <Text style={styles.description}>{creature.description}</Text>

              <View style={styles.statsContainer}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>HP:</Text>
                  <Text style={styles.statValue}>
                    {creature.hp} / {creature.maxHp}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Attack:</Text>
                  <Text style={styles.statValue}>{creature.attack}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Defense:</Text>
                  <Text style={styles.statValue}>{creature.defense}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Speed:</Text>
                  <Text style={styles.statValue}>{creature.speed}</Text>
                </View>
              </View>

              <View style={styles.hpBar}>
                <View
                  style={[
                    styles.hpFill,
                    {
                      width: `${(creature.hp / creature.maxHp) * 100}%`,
                      backgroundColor: rarityColor,
                    },
                  ]}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.catchButton]}
              onPress={onCatch}
            >
              <Text style={styles.buttonText}>Catch</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.fightButton]}
              onPress={onFight}
            >
              <Text style={styles.buttonText}>Fight</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.fleeButton]}
              onPress={onFlee}
            >
              <Text style={styles.buttonText}>Flee</Text>
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
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  creatureCard: {
    borderWidth: 3,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
  },
  rarityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  rarityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  creatureName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  creatureType: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  creatureLevel: {
    fontSize: 18,
    color: '#888',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  statsContainer: {
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
  },
  hpBar: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  hpFill: {
    height: '100%',
    borderRadius: 6,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  catchButton: {
    backgroundColor: '#4CAF50',
  },
  fightButton: {
    backgroundColor: '#FF5722',
  },
  fleeButton: {
    backgroundColor: '#9E9E9E',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

