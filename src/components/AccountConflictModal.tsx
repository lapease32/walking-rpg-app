import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ConflictState } from '../hooks/useAuth';
import { PlayerData } from '../models/Player';

interface AccountConflictModalProps {
  conflictState: ConflictState;
  onResolve: (choice: 'local' | 'cloud') => Promise<void>;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatTimestamp(ts: number): string {
  if (!ts) return 'Unknown';
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface SaveCardProps {
  label: string;
  data: PlayerData;
  savedAt: number;
  highlight?: boolean;
}

function SaveCard({ label, data, savedAt, highlight }: SaveCardProps) {
  return (
    <View style={[styles.saveCard, highlight && styles.saveCardHighlight]}>
      <Text style={styles.saveLabel}>{label}</Text>
      <Text style={styles.saveStat}>Level {data.level}</Text>
      <Text style={styles.saveStat}>{data.experience.toLocaleString()} XP</Text>
      <Text style={styles.saveStat}>{formatDistance(data.totalDistance)} walked</Text>
      <Text style={styles.saveStat}>{data.creaturesDefeated} creatures defeated</Text>
      <Text style={styles.saveTime}>Last saved {formatTimestamp(savedAt)}</Text>
    </View>
  );
}

export function AccountConflictModal({ conflictState, onResolve }: AccountConflictModalProps) {
  const [resolving, setResolving] = React.useState(false);

  const handleResolve = async (choice: 'local' | 'cloud') => {
    setResolving(true);
    await onResolve(choice);
    // Modal will unmount when conflictState is cleared; no need to reset resolving
  };

  const { localData, localSavedAt, cloudData, cloudSavedAt } = conflictState;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Choose Your Save</Text>
          <Text style={styles.subtitle}>
            This account already has a cloud save. Which progress do you want to keep?
          </Text>

          <View style={styles.savesRow}>
            {localData && <SaveCard label="Guest Save" data={localData} savedAt={localSavedAt} />}
            {cloudData ? (
              <SaveCard label="Cloud Save" data={cloudData} savedAt={cloudSavedAt} />
            ) : (
              <View style={[styles.saveCard, styles.saveCardUnavailable]}>
                <Text style={styles.saveLabel}>Cloud Save</Text>
                <Text style={styles.saveUnavailableText}>
                  Could not be loaded (network issue). Keeping your guest save will overwrite any
                  existing cloud data.
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.warning}>The other save will be permanently lost.</Text>

          {resolving ? (
            <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
          ) : (
            <View style={styles.buttons}>
              {localData && (
                <TouchableOpacity
                  style={[styles.button, styles.buttonLocal]}
                  onPress={() => handleResolve('local')}>
                  <Text style={styles.buttonText}>Keep Guest Save</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.button, cloudData ? styles.buttonCloud : styles.buttonCloudUnknown]}
                onPress={() => handleResolve('cloud')}>
                <Text style={styles.buttonText}>
                  {cloudData ? 'Keep Cloud Save' : 'Use Cloud Account'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  savesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  saveCard: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  saveCardHighlight: {
    borderColor: '#4CAF50',
  },
  saveCardUnavailable: {
    backgroundColor: '#FAFAFA',
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  saveUnavailableText: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
    marginTop: 4,
  },
  saveLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  saveStat: {
    fontSize: 14,
    color: '#333',
    marginBottom: 3,
  },
  saveTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  warning: {
    fontSize: 13,
    color: '#E53935',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttons: {
    gap: 10,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonLocal: {
    backgroundColor: '#4CAF50',
  },
  buttonCloud: {
    backgroundColor: '#1976D2',
  },
  buttonCloudUnknown: {
    backgroundColor: '#78909C',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loader: {
    marginVertical: 16,
  },
});
