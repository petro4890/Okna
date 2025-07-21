import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Setup push notifications
export const setupNotifications = async () => {
  try {
    // Check if device supports push notifications
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return null;
    }

    // Get existing permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Get push token
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    console.log('Push token:', token.data);

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1C77FF',
        sound: 'default',
      });

      // Create specific channels for different notification types
      await Notifications.setNotificationChannelAsync('job_assignment', {
        name: 'Job Assignments',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F39C12',
        sound: 'default',
        description: 'Notifications for new job assignments',
      });

      await Notifications.setNotificationChannelAsync('status_update', {
        name: 'Status Updates',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#27AE60',
        sound: 'default',
        description: 'Notifications for order and job status updates',
      });

      await Notifications.setNotificationChannelAsync('general', {
        name: 'General',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#1C77FF',
        sound: 'default',
        description: 'General notifications',
      });
    }

    return token.data;
  } catch (error) {
    console.error('Error setting up notifications:', error);
    return null;
  }
};

// Register push token with backend
export const registerPushToken = async (token, userId) => {
  try {
    // This would send the token to your backend
    // await api.post('/notifications/register-token', { token, userId });
    console.log('Push token registered for user:', userId);
  } catch (error) {
    console.error('Error registering push token:', error);
  }
};

// Send local notification
export const sendLocalNotification = async (title, body, data = {}) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.error('Error sending local notification:', error);
  }
};

// Schedule notification
export const scheduleNotification = async (title, body, trigger, data = {}) => {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger,
    });
    
    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    throw error;
  }
};

// Cancel scheduled notification
export const cancelScheduledNotification = async (notificationId) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
};

// Cancel all scheduled notifications
export const cancelAllScheduledNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling all notifications:', error);
  }
};

// Get all scheduled notifications
export const getScheduledNotifications = async () => {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
};

// Set notification badge count
export const setBadgeCount = async (count) => {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Error setting badge count:', error);
  }
};

// Clear notification badge
export const clearBadge = async () => {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.error('Error clearing badge:', error);
  }
};

// Dismiss all notifications
export const dismissAllNotifications = async () => {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error('Error dismissing notifications:', error);
  }
};

// Dismiss specific notification
export const dismissNotification = async (notificationId) => {
  try {
    await Notifications.dismissNotificationAsync(notificationId);
  } catch (error) {
    console.error('Error dismissing notification:', error);
  }
};

// Create notification trigger for specific time
export const createTimeTrigger = (date) => {
  return {
    type: 'date',
    date: date,
  };
};

// Create notification trigger for daily repeat
export const createDailyTrigger = (hour, minute) => {
  return {
    type: 'daily',
    hour,
    minute,
  };
};

// Create notification trigger for weekly repeat
export const createWeeklyTrigger = (weekday, hour, minute) => {
  return {
    type: 'weekly',
    weekday, // 1 = Sunday, 2 = Monday, etc.
    hour,
    minute,
  };
};

// Create notification trigger for interval
export const createIntervalTrigger = (seconds, repeats = false) => {
  return {
    type: 'timeInterval',
    seconds,
    repeats,
  };
};

// Notification categories for iOS
export const setupNotificationCategories = async () => {
  if (Platform.OS === 'ios') {
    try {
      await Notifications.setNotificationCategoryAsync('job_assignment', [
        {
          identifier: 'accept_job',
          buttonTitle: 'Accept',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'view_details',
          buttonTitle: 'View Details',
          options: {
            opensAppToForeground: true,
          },
        },
      ]);

      await Notifications.setNotificationCategoryAsync('status_update', [
        {
          identifier: 'view_order',
          buttonTitle: 'View Order',
          options: {
            opensAppToForeground: true,
          },
        },
      ]);
    } catch (error) {
      console.error('Error setting up notification categories:', error);
    }
  }
};

// Handle notification action response
export const handleNotificationAction = (response) => {
  const { actionIdentifier, notification } = response;
  const notificationData = notification.request.content.data;

  switch (actionIdentifier) {
    case 'accept_job':
      // Handle job acceptance
      console.log('Job accepted:', notificationData.jobId);
      break;
    
    case 'view_details':
    case 'view_order':
      // Handle navigation to details
      console.log('Navigate to details:', notificationData);
      break;
    
    default:
      // Default action (tap notification)
      console.log('Default notification action');
      break;
  }
};

// Check notification permissions
export const checkNotificationPermissions = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking notification permissions:', error);
    return false;
  }
};

// Request notification permissions
export const requestNotificationPermissions = async () => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

// Get notification settings
export const getNotificationSettings = async () => {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings;
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return null;
  }
};

// Utility function to format notification data
export const formatNotificationData = (type, data = {}) => {
  const baseData = {
    type,
    timestamp: new Date().toISOString(),
  };

  switch (type) {
    case 'job_assignment':
      return {
        ...baseData,
        jobId: data.jobId,
        jobType: data.jobType,
        location: data.location,
        scheduledDate: data.scheduledDate,
      };
    
    case 'status_update':
      return {
        ...baseData,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
      };
    
    case 'general':
      return {
        ...baseData,
        ...data,
      };
    
    default:
      return baseData;
  }
};

// Utility function to create notification content
export const createNotificationContent = (type, title, body, data = {}) => {
  const content = {
    title,
    body,
    data: formatNotificationData(type, data),
    sound: 'default',
  };

  // Add category for iOS
  if (Platform.OS === 'ios') {
    content.categoryIdentifier = type;
  }

  // Add channel for Android
  if (Platform.OS === 'android') {
    content.channelId = type;
  }

  return content;
};