import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import {
  Archetype,
  ARCHETYPE_CONFIGS,
  computeAttributes,
  deriveAttack,
  deriveDefense,
  deriveMaxHp,
} from '../models/Archetype';

interface Props {
  onSelect: (archetype: Archetype) => void;
}

const ARCHETYPES: Archetype[] = [Archetype.Martial, Archetype.Agile, Archetype.Mage];

const RESOURCE_ICONS: Record<string, string> = {
  rage: '🔥',
  energy: '⚡',
  mana: '💙',
};

export default function ArchetypeSelectionScreen({ onSelect }: Props) {
  return (
    <ScrollView
      testID="archetype-selection-screen"
      style={styles.container}
      contentContainerStyle={styles.content}>
      <Text style={styles.title}>Choose Your Archetype</Text>
      <Text style={styles.subtitle}>
        Your archetype determines your combat style, abilities, and resource pool.
      </Text>
      {ARCHETYPES.map(archetype => {
        const cfg = ARCHETYPE_CONFIGS[archetype];
        const attrs = computeAttributes(archetype, 1);
        const hp = deriveMaxHp(archetype, attrs.str, attrs.agi);
        const atk = deriveAttack(attrs.str, attrs.agi);
        const def = deriveDefense(attrs.str, attrs.agi);
        const resourceLabel = cfg.resource.charAt(0).toUpperCase() + cfg.resource.slice(1);

        return (
          <TouchableOpacity
            key={archetype}
            testID={`select-archetype-${archetype}`}
            style={styles.card}
            onPress={() => onSelect(archetype)}
            activeOpacity={0.8}>
            <Text style={styles.archetypeName}>{cfg.name}</Text>
            <Text style={styles.resource}>
              {RESOURCE_ICONS[cfg.resource]} {resourceLabel}
            </Text>
            <Text style={styles.description}>{cfg.description}</Text>
            <View style={styles.statsRow}>
              <Text style={styles.stat}>❤️ {hp} HP</Text>
              <Text style={styles.stat}>⚔️ {atk} ATK</Text>
              <Text style={styles.stat}>🛡️ {def} DEF</Text>
            </View>
            <View style={styles.selectButton}>
              <Text style={styles.selectButtonText}>Choose {cfg.name}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 8,
    color: '#1a1a2e',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 28,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  archetypeName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  resource: {
    fontSize: 13,
    color: '#888',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  stat: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  selectButton: {
    backgroundColor: '#4a90d9',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
