import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import * as Notifications from 'expo-notifications';
import { notificationsAPI } from '../services/api';
import { useAuth } from './AuthContext';
import Toast from 'react-native-toast-message';

// Notification context
const NotificationContext = createContext();

// Notification reducer
const notificationReducer = (state, action) => {
  switch (action.type) {
    case 'SET_NOTIFICATIONS':
      return {
        ...state,
        notifications: action.payload,
      };
    
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      };
    
    case 'MARK_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === action.payload
            ? { ...notification, is_read: true }
            : notification
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    
    case 'MARK_ALL_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(notification => ({
          ...notification,
          is_read: true,
        })),
        unreadCount: 0,
      };
    
    case 'DELETE_NOTIFICATION':
      const deletedNotification = state.notifications.find(n => n.id === action.payload);
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
        unreadCount: deletedNotification && !deletedNotification.is_read 
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      };
    
    case 'SET_UNREAD_COUNT':
      return {
        ...state,
        unreadCount: action.payload,
      };
    
    case 'SET_PREFERENCES':
      return {
        ...state,
        preferences: action.payload,
      };
    
    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload },
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    
    default:
      return state;
  }
};

// Initial state
const initialState = {
  notifications: [],
  unreadCount: 0,
  preferences: {
    email_notifications: true,
    sms_notifications: true,
    push_notifications: true,
    notification_types: {
      job_assignment: true,
      status_update: true,
      general: true,
      system: true,
      reminder: true,
    },
    quiet_hours: {
      enabled: false,
      start_time: '22:00',
      end_time: '08:00',
    },
  },
  isLoading: false,
  error: null,
};

// Notification provider component
export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const { user, isAuthenticated, token } = useAuth();
  const queryClient = useQueryClient();

  // Fetch notifications when user is authenticated
  const { data: notificationsData, isLoading } = useQuery(
    ['notifications', user?.id],
    () => notificationsAPI.getNotifications({ limit: 50 }),
    {
      enabled: isAuthenticated && !!user,
      refetchInterval: 30000, // Refetch every 30 seconds
      onSuccess: (data) => {
        dispatch({
          type: 'SET_NOTIFICATIONS',
          payload: data.data.notifications,
        });
        dispatch({
          type: 'SET_UNREAD_COUNT',
          payload: data.data.unread_count,
        });
      },
      onError: (error) => {
        dispatch({
          type: 'SET_ERROR',
          payload: error.response?.data?.error || 'Failed to fetch notifications',
        });
      },
    }
  );

  // Fetch notification preferences
  const { data: preferencesData } = useQuery(
    ['notification-preferences', user?.id],
    () => notificationsAPI.getPreferences(),
    {
      enabled: isAuthenticated && !!user,
      onSuccess: (data) => {
        dispatch({
          type: 'SET_PREFERENCES',
          payload: data.data.preferences,
        });
      },
    }
  );

  // Set up push notification listeners
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let notificationListener;
    let responseListener;

    const setupNotificationListeners = async () => {
      // Listen for notifications received while app is foregrounded
      notificationListener = Notifications.addNotificationReceivedListener(notification => {
        const notificationData = notification.request.content.data;
        
        // Add notification to local state
        if (notificationData.notification_id) {
          // Refetch notifications to get the latest data
          queryClient.invalidateQueries(['notifications', user.id]);
        }

        // Show toast for important notifications
        if (notificationData.type === 'job_assignment' || notificationData.type === 'status_update') {
          Toast.show({
            type: 'info',
            text1: notification.request.content.title,
            text2: notification.request.content.body,
            visibilityTime: 4000,
          });
        }
      });

      // Listen for user tapping on notifications
      responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        const notificationData = response.notification.request.content.data;
        
        // Handle navigation based on notification type
        handleNotificationTap(notificationData);
      });
    };

    setupNotificationListeners();

    return () => {
      if (notificationListener) {
        Notifications.removeNotificationSubscription(notificationListener);
      }
      if (responseListener) {
        Notifications.removeNotificationSubscription(responseListener);
      }
    };
  }, [isAuthenticated, user, queryClient]);

  // Handle notification tap navigation
  const handleNotificationTap = (notificationData) => {
    // This would be implemented with navigation
    console.log('Notification tapped:', notificationData);
    
    // Example navigation logic:
    // if (notificationData.related_job_id) {
    //   navigation.navigate('JobDetails', { jobId: notificationData.related_job_id });
    // } else if (notificationData.related_order_id) {
    //   navigation.navigate('OrderDetails', { orderId: notificationData.related_order_id });
    // }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await notificationsAPI.markAsRead(notificationId);
      dispatch({ type: 'MARK_AS_READ', payload: notificationId });
      
      // Update cache
      queryClient.setQueryData(['notifications', user?.id], (oldData) => {
        if (!oldData) return oldData;
        
        return {
          ...oldData,
          data: {
            ...oldData.data,
            notifications: oldData.data.notifications.map(notification =>
              notification.id === notificationId
                ? { ...notification, is_read: true }
                : notification
            ),
            unread_count: Math.max(0, oldData.data.unread_count - 1),
          },
        };
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to mark notification as read',
      });
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      dispatch({ type: 'MARK_ALL_AS_READ' });
      
      // Update cache
      queryClient.setQueryData(['notifications', user?.id], (oldData) => {
        if (!oldData) return oldData;
        
        return {
          ...oldData,
          data: {
            ...oldData.data,
            notifications: oldData.data.notifications.map(notification => ({
              ...notification,
              is_read: true,
            })),
            unread_count: 0,
          },
        };
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'All notifications marked as read',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to mark all notifications as read',
      });
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      await notificationsAPI.deleteNotification(notificationId);
      dispatch({ type: 'DELETE_NOTIFICATION', payload: notificationId });
      
      // Update cache
      queryClient.setQueryData(['notifications', user?.id], (oldData) => {
        if (!oldData) return oldData;
        
        const deletedNotification = oldData.data.notifications.find(n => n.id === notificationId);
        
        return {
          ...oldData,
          data: {
            ...oldData.data,
            notifications: oldData.data.notifications.filter(n => n.id !== notificationId),
            unread_count: deletedNotification && !deletedNotification.is_read 
              ? Math.max(0, oldData.data.unread_count - 1)
              : oldData.data.unread_count,
          },
        };
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Notification deleted',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete notification',
      });
    }
  };

  // Delete all read notifications
  const deleteAllRead = async () => {
    try {
      const response = await notificationsAPI.deleteAllRead();
      
      // Update cache
      queryClient.setQueryData(['notifications', user?.id], (oldData) => {
        if (!oldData) return oldData;
        
        return {
          ...oldData,
          data: {
            ...oldData.data,
            notifications: oldData.data.notifications.filter(n => !n.is_read),
          },
        };
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `${response.data.deleted_count} notifications deleted`,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete read notifications',
      });
    }
  };

  // Update notification preferences
  const updatePreferences = async (newPreferences) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const response = await notificationsAPI.updatePreferences(newPreferences);
      
      dispatch({
        type: 'UPDATE_PREFERENCES',
        payload: newPreferences,
      });

      // Update cache
      queryClient.setQueryData(['notification-preferences', user?.id], {
        data: { preferences: { ...state.preferences, ...newPreferences } },
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Notification preferences updated',
      });

      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: true };
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error.response?.data?.error || 'Failed to update preferences',
      });

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update notification preferences',
      });

      return { success: false, error: error.response?.data?.error };
    }
  };

  // Refresh notifications
  const refreshNotifications = () => {
    queryClient.invalidateQueries(['notifications', user?.id]);
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Get notifications by type
  const getNotificationsByType = (type) => {
    return state.notifications.filter(notification => notification.type === type);
  };

  // Get unread notifications
  const getUnreadNotifications = () => {
    return state.notifications.filter(notification => !notification.is_read);
  };

  // Check if quiet hours are active
  const isQuietHoursActive = () => {
    if (!state.preferences.quiet_hours.enabled) return false;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMinute] = state.preferences.quiet_hours.start_time.split(':').map(Number);
    const [endHour, endMinute] = state.preferences.quiet_hours.end_time.split(':').map(Number);
    
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;
    
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  };

  const value = {
    ...state,
    isLoading: isLoading || state.isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    updatePreferences,
    refreshNotifications,
    clearError,
    getNotificationsByType,
    getUnreadNotifications,
    isQuietHoursActive,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook to use notification context
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};