import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Linking,
  Alert,
  Switch,
} from 'react-native';
import { AuthUser } from '../services/AuthService';

const PRIVACY_POLICY_URL = 'https://lapease32.github.io/walking-rpg-app/privacy-policy.html';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  authUser: AuthUser | null;
  authLoading: boolean;
  onGoogleSignIn: () => void;
  onAppleSignIn: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  autoResolveBelowRare: boolean;
  onToggleAutoResolveBelowRare: (enabled: boolean) => void;
}

export default function SettingsModal({
  visible,
  onClose,
  authUser,
  authLoading,
  onGoogleSignIn,
  onAppleSignIn,
  onSignOut,
  onDeleteAccount,
  autoResolveBelowRare,
  onToggleAutoResolveBelowRare,
}: SettingsModalProps) {
  const isSignedIn = authUser && !authUser.isAnonymous;
  const displayName = authUser?.displayName ?? authUser?.email ?? 'Signed in';

  const confirmDelete = () => {
    Alert.alert(
      'Delete account & data?',
      'This permanently deletes your account and all progress — on this device and in the cloud. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDeleteAccount },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>x</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Account section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>

              {authLoading ? (
                <ActivityIndicator style={styles.loader} color="#2196F3" />
              ) : isSignedIn ? (
                <View>
                  <Text style={styles.sectionDescription}>
                    Signed in as {displayName}. Your progress is backed up automatically.
                  </Text>
                  <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}>
                    <Text style={styles.signOutButtonText}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Text style={styles.sectionDescription}>
                    Sign in to back up your progress and recover it if you reinstall.
                  </Text>
                  <TouchableOpacity style={styles.googleButton} onPress={onGoogleSignIn}>
                    <Text style={styles.googleButtonText}>Sign in with Google</Text>
                  </TouchableOpacity>
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.appleButton} onPress={onAppleSignIn}>
                      <Text style={styles.appleButtonText}>Sign in with Apple</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {!authLoading && (
                <TouchableOpacity style={styles.deleteAccountButton} onPress={confirmDelete}>
                  <Text style={styles.deleteAccountButtonText}>Delete account & data</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Gameplay section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gameplay</Text>
              <View style={styles.settingRow}>
                <View style={styles.settingRowText}>
                  <Text style={styles.settingLabel}>Auto-resolve minor encounters</Text>
                  <Text style={styles.settingDescription}>
                    Skip common and uncommon fights automatically — you still earn the same rewards,
                    collected in your walk summary. Rare and tougher foes always appear for you to
                    fight.
                  </Text>
                </View>
                <Switch
                  testID="auto-resolve-toggle"
                  value={autoResolveBelowRare}
                  onValueChange={onToggleAutoResolveBelowRare}
                />
              </View>
            </View>

            {/* Legal section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Legal</Text>
              <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
                <Text style={styles.linkText}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  modalBody: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingRowText: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  loader: {
    marginVertical: 16,
  },
  googleButton: {
    backgroundColor: '#4285F4',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  appleButton: {
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    fontSize: 16,
    color: '#2196F3',
  },
  deleteAccountButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  deleteAccountButtonText: {
    color: '#C62828',
    fontSize: 15,
    fontWeight: '600',
  },
});
