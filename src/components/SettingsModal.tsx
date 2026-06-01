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
}

export default function SettingsModal({
  visible,
  onClose,
  authUser,
  authLoading,
  onGoogleSignIn,
  onAppleSignIn,
  onSignOut,
}: SettingsModalProps) {
  const isSignedIn = authUser && !authUser.isAnonymous;
  const displayName = authUser?.displayName ?? authUser?.email ?? 'Signed in';

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
});
