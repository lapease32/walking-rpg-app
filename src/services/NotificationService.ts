import logger from '../utils/logger';
import notifee, { AndroidImportance, NotificationSettings } from '@notifee/react-native';
import { Platform } from 'react-native';
import { Encounter } from '../models/Encounter';

class NotificationService {
  private channelId: string = 'encounter_channel';
  private trackingChannelId: string = 'tracking_channel';

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
      await notifee.createChannel({
        id: this.trackingChannelId,
        name: 'Location Tracking',
        description: 'Persistent notification while location tracking is active',
        importance: AndroidImportance.LOW,
        sound: undefined,
        vibration: false,
      });
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const settings = await notifee.requestPermission();
      return settings.authorizationStatus >= 1;
    } catch (error) {
      logger.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  async startForegroundService(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }
    try {
      await notifee.displayNotification({
        id: 'location_tracking_service',
        title: 'StrideQuest',
        body: 'Tracking your location for encounters',
        android: {
          channelId: this.trackingChannelId,
          asForegroundService: true,
          ongoing: true,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
        },
      });
    } catch (error) {
      logger.error('Error starting foreground service:', error);
    }
  }

  async stopForegroundService(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }
    try {
      await notifee.stopForegroundService();
    } catch (error) {
      logger.error('Error stopping foreground service:', error);
    }
  }

  // Notify the player that a "worthy foe" (an ELITE encounter) is waiting to be fought turn-based —
  // fired when an elite is held while the app is backgrounded (see useEncounter.holdEliteEncounter).
  // Tapping opens the app, where checkPendingEncounter presents the turn-based fight.
  async showEncounterNotification(encounter: Encounter): Promise<string> {
    const creature = encounter.creature;
    const title = '⚔️ A Worthy Foe Awaits!';
    const body = `A ${creature.name} (${creature.rarity}) stalks you. Tap to fight it.`;

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
      logger.error('Error showing encounter notification:', error);
      throw error;
    }
  }

  /**
   * Notify the player that a notable item dropped from a passive (auto-resolved) fight while they
   * were walking. Intentionally rare-only (fired by the caller for rare+ drops) so it's a "nice
   * surprise," not spam. Tapping opens the app, where the full walk summary is shown on foreground.
   */
  async showPassiveVictoryNotification(creatureName: string, itemName: string): Promise<string> {
    const title = '⚔️ Victory while walking!';
    const body = `You defeated a ${creatureName} and found ${itemName}. Tap to see your haul.`;

    try {
      const notificationId = await notifee.displayNotification({
        title,
        body,
        data: {
          type: 'walk_summary',
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
      logger.error('Error showing passive victory notification:', error);
      throw error;
    }
  }

  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await notifee.cancelNotification(notificationId);
    } catch (error) {
      logger.error('Error canceling notification:', error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await notifee.cancelAllNotifications();
    } catch (error) {
      logger.error('Error canceling all notifications:', error);
    }
  }

  async getSettings(): Promise<NotificationSettings | null> {
    try {
      return await notifee.getNotificationSettings();
    } catch (error) {
      logger.error('Error getting notification settings:', error);
      return null;
    }
  }
}

export default new NotificationService();
