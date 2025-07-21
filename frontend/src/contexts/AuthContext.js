import React, { createContext, useContext, useReducer, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../services/api';
import Toast from 'react-native-toast-message';

// Auth context
const AuthContext = createContext();

// Auth reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false,
      };
    
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false,
      };
    
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload },
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
  isAuthenticated: false,
  user: null,
  token: null,
  isLoading: true,
  error: null,
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for stored token on app start
  useEffect(() => {
    checkStoredAuth();
  }, []);

  const checkStoredAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      const userData = await SecureStore.getItemAsync('userData');

      if (token && userData) {
        const user = JSON.parse(userData);
        
        // Verify token is still valid
        try {
          const response = await authAPI.getProfile(token);
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { user: response.data.user, token },
          });
        } catch (error) {
          // Token is invalid, clear stored data
          await clearStoredAuth();
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    } catch (error) {
      console.error('Error checking stored auth:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const clearStoredAuth = async () => {
    try {
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync('userData');
    } catch (error) {
      console.error('Error clearing stored auth:', error);
    }
  };

  const storeAuthData = async (token, user) => {
    try {
      await SecureStore.setItemAsync('authToken', token);
      await SecureStore.setItemAsync('userData', JSON.stringify(user));
    } catch (error) {
      console.error('Error storing auth data:', error);
    }
  };

  // Login function
  const login = async (credentials) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const response = await authAPI.login(credentials);
      const { token, user } = response.data;

      await storeAuthData(token, user);

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { user, token },
      });

      Toast.show({
        type: 'success',
        text1: 'Welcome back!',
        text2: `Hello ${user.first_name}`,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      
      dispatch({
        type: 'SET_ERROR',
        payload: errorMessage,
      });

      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const response = await authAPI.register(userData);

      Toast.show({
        type: 'success',
        text1: 'Registration Successful',
        text2: 'Please verify your email/phone to continue',
      });

      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: true, data: response.data };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Registration failed';
      
      dispatch({
        type: 'SET_ERROR',
        payload: errorMessage,
      });

      Toast.show({
        type: 'error',
        text1: 'Registration Failed',
        text2: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      if (state.token) {
        await authAPI.logout(state.token);
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      await clearStoredAuth();
      dispatch({ type: 'LOGOUT' });
      
      Toast.show({
        type: 'info',
        text1: 'Logged Out',
        text2: 'See you next time!',
      });
    }
  };

  // Forgot password function
  const forgotPassword = async (login) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      await authAPI.forgotPassword({ login });

      Toast.show({
        type: 'success',
        text1: 'Reset Code Sent',
        text2: 'Check your email/SMS for the reset code',
      });

      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to send reset code';
      
      dispatch({
        type: 'SET_ERROR',
        payload: errorMessage,
      });

      Toast.show({
        type: 'error',
        text1: 'Reset Failed',
        text2: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  };

  // Reset password function
  const resetPassword = async (token, password) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      await authAPI.resetPassword({ token, password });

      Toast.show({
        type: 'success',
        text1: 'Password Reset',
        text2: 'Your password has been updated successfully',
      });

      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Password reset failed';
      
      dispatch({
        type: 'SET_ERROR',
        payload: errorMessage,
      });

      Toast.show({
        type: 'error',
        text1: 'Reset Failed',
        text2: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  };

  // Verify email/phone function
  const verifyCode = async (code, type, userId) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      await authAPI.verifyCode({ code, type, user_id: userId });

      Toast.show({
        type: 'success',
        text1: 'Verification Successful',
        text2: `Your ${type} has been verified`,
      });

      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Verification failed';
      
      dispatch({
        type: 'SET_ERROR',
        payload: errorMessage,
      });

      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  };

  // Resend verification code function
  const resendVerificationCode = async (type, userId) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      await authAPI.resendVerificationCode({ type, user_id: userId });

      Toast.show({
        type: 'success',
        text1: 'Code Sent',
        text2: `Verification code sent to your ${type}`,
      });

      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to send code';
      
      dispatch({
        type: 'SET_ERROR',
        payload: errorMessage,
      });

      Toast.show({
        type: 'error',
        text1: 'Send Failed',
        text2: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  };

  // Update user profile function
  const updateProfile = async (updateData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const response = await authAPI.updateProfile(updateData, state.token);
      const updatedUser = response.data.user;

      await storeAuthData(state.token, updatedUser);

      dispatch({
        type: 'UPDATE_USER',
        payload: updatedUser,
      });

      Toast.show({
        type: 'success',
        text1: 'Profile Updated',
        text2: 'Your profile has been updated successfully',
      });

      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: true, user: updatedUser };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Profile update failed';
      
      dispatch({
        type: 'SET_ERROR',
        payload: errorMessage,
      });

      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  };

  // Change password function
  const changePassword = async (currentPassword, newPassword) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      await authAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      }, state.token);

      Toast.show({
        type: 'success',
        text1: 'Password Changed',
        text2: 'Your password has been updated successfully',
      });

      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Password change failed';
      
      dispatch({
        type: 'SET_ERROR',
        payload: errorMessage,
      });

      Toast.show({
        type: 'error',
        text1: 'Change Failed',
        text2: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  };

  // Clear error function
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Check if user has specific role
  const hasRole = (roles) => {
    if (!state.user) return false;
    const userRole = state.user.role;
    return Array.isArray(roles) ? roles.includes(userRole) : userRole === roles;
  };

  // Check if user can manage users
  const canManageUsers = () => {
    return hasRole(['director', 'manager']);
  };

  // Check if user can view all projects
  const canViewAllProjects = () => {
    return hasRole(['director', 'manager', 'supervisor']);
  };

  // Check if user is a worker
  const isWorker = () => {
    return hasRole(['measurer', 'delivery_person', 'installer']);
  };

  // Check if user is a client
  const isClient = () => {
    return hasRole('client');
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    verifyCode,
    resendVerificationCode,
    updateProfile,
    changePassword,
    clearError,
    hasRole,
    canManageUsers,
    canViewAllProjects,
    isWorker,
    isClient,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};