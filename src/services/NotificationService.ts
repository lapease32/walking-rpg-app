import notifee, { AndroidImportance, NotificationSettings } from '@notifee/react-native';
import { Platform } from 'react-native';
import { Encounter } from '../models/Encounter';

/**
 * Notification Service
 * Handles local notifications for background encounters
 */
class NotificationService {
  private channelId: string = 'encounter_channel';

  /**
   * Initialize notification service
   * Creates notification channel for Android
   */
  async initialize(): Promise<void> {
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: this.channelId,
        name: 'Encounter Notifications',
        description: 'Notifications for creature encounters while walking',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      });
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const settings = await notifee.requestPermission();
      return settings.authorizationStatus >= 1; // Authorized or Provisional
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Show notification for a new encounter
   */
  async showEncounterNotification(encounter: Encounter): Promise<string> {
    const creature = encounter.creature;
    const title = '🎮 Creature Encounter!';
    const body = `A ${creature.name} appeared! Tap to view.`;

    try {
      const notificationId = await notifee.displayNotification({
        title,
        body,
        data: {
          type: 'encounter',
          encounterId: encounter.timestamp.toString(),
        },
        android: {
          channelId: this.channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
          sound: 'default',
          vibrationPattern: [300, 500],
        },
        ios: {
          sound: 'default',
          foregroundPresentationOptions: {
            alert: true,
            badge: true,
            sound: true,
          },
        },
      });

      return notificationId;
    } catch (error) {
      console.error('Error showing encounter notification:', error);
      throw error;
    }
  }

  /**
   * Cancel a specific notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await notifee.cancelNotification(notificationId);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await notifee.cancelAllNotifications();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  /**
   * Get notification settings
   */
  async getSettings(): Promise<NotificationSettings | null> {
    try {
      return await notifee.getNotificationSettings();
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return null;
    }
  }
}

// Export singleton instance
export default new NotificationService();
