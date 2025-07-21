import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

// Base API configuration
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000/api' 
  : 'https://your-production-api.com/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      try {
        await SecureStore.deleteItemAsync('authToken');
        await SecureStore.deleteItemAsync('userData');
        
        Toast.show({
          type: 'error',
          text1: 'Session Expired',
          text2: 'Please log in again',
        });
        
        // Navigate to login screen
        // This would be handled by the auth context
      } catch (clearError) {
        console.error('Error clearing auth data:', clearError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API endpoints
export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  register: (userData) => apiClient.post('/auth/register', userData),
  logout: (token) => apiClient.post('/auth/logout', {}, {
    headers: { Authorization: `Bearer ${token}` }
  }),
  forgotPassword: (data) => apiClient.post('/auth/forgot-password', data),
  resetPassword: (data) => apiClient.post('/auth/reset-password', data),
  verifyCode: (data) => apiClient.post('/auth/verify', data),
  resendVerificationCode: (data) => apiClient.post('/auth/resend-verification', data),
  getProfile: (token) => apiClient.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  }),
  updateProfile: (data, token) => apiClient.put('/auth/me', data, {
    headers: { Authorization: `Bearer ${token}` }
  }),
  changePassword: (data, token) => apiClient.put('/auth/change-password', data, {
    headers: { Authorization: `Bearer ${token}` }
  }),
  getSessions: () => apiClient.get('/auth/sessions'),
  revokeSession: (sessionId) => apiClient.delete(`/auth/sessions/${sessionId}`),
  logoutAll: () => apiClient.post('/auth/logout-all'),
};

// Users API endpoints
export const usersAPI = {
  getUsers: (params) => apiClient.get('/users', { params }),
  getUser: (userId) => apiClient.get(`/users/${userId}`),
  createUser: (userData) => apiClient.post('/users', userData),
  updateUser: (userId, data) => apiClient.put(`/users/${userId}`, data),
  updateUserRole: (userId, role) => apiClient.put(`/users/${userId}/role`, { role }),
  updateUserStatus: (userId, isActive) => apiClient.put(`/users/${userId}/status`, { is_active: isActive }),
  deleteUser: (userId) => apiClient.delete(`/users/${userId}`),
  getUserOrders: (userId, params) => apiClient.get(`/users/${userId}/orders`, { params }),
  getUserJobs: (userId, params) => apiClient.get(`/users/${userId}/jobs`, { params }),
  getUserNotifications: (userId, params) => apiClient.get(`/users/${userId}/notifications`, { params }),
};

// Orders API endpoints
export const ordersAPI = {
  getOrders: (params) => apiClient.get('/orders', { params }),
  getOrder: (orderId) => apiClient.get(`/orders/${orderId}`),
  createOrder: (orderData) => apiClient.post('/orders', orderData),
  updateOrder: (orderId, data) => apiClient.put(`/orders/${orderId}`, data),
  updateOrderStatus: (orderId, status, notes) => apiClient.put(`/orders/${orderId}/status`, { status, notes }),
  deleteOrder: (orderId) => apiClient.delete(`/orders/${orderId}`),
  addOrderItem: (orderId, itemData) => apiClient.post(`/orders/${orderId}/items`, itemData),
  updateOrderItem: (orderId, itemId, data) => apiClient.put(`/orders/${orderId}/items/${itemId}`, data),
  deleteOrderItem: (orderId, itemId) => apiClient.delete(`/orders/${orderId}/items/${itemId}`),
  getOrderStats: (params) => apiClient.get('/orders/stats/overview', { params }),
};

// Jobs API endpoints
export const jobsAPI = {
  getJobs: (params) => apiClient.get('/jobs', { params }),
  getJob: (jobId) => apiClient.get(`/jobs/${jobId}`),
  createJob: (jobData) => apiClient.post('/jobs', jobData),
  updateJob: (jobId, data) => apiClient.put(`/jobs/${jobId}`, data),
  updateJobStatus: (jobId, status, notes, coordinates) => apiClient.put(`/jobs/${jobId}/status`, {
    status,
    notes,
    location_coordinates: coordinates
  }),
  deleteJob: (jobId) => apiClient.delete(`/jobs/${jobId}`),
  getWorkerJobs: (workerId, params) => apiClient.get(`/jobs/worker/${workerId}`, { params }),
  getJobStats: (params) => apiClient.get('/jobs/stats/overview', { params }),
};

// Contracts API endpoints
export const contractsAPI = {
  getContracts: (params) => apiClient.get('/contracts', { params }),
  getContract: (contractId) => apiClient.get(`/contracts/${contractId}`),
  createContract: (contractData) => apiClient.post('/contracts', contractData),
  downloadContract: (contractId) => apiClient.get(`/contracts/${contractId}/download`, {
    responseType: 'blob'
  }),
  sendContractEmail: (contractId, email) => apiClient.post(`/contracts/${contractId}/send-email`, { email }),
  signContract: (contractId) => apiClient.put(`/contracts/${contractId}/sign`),
  getOrderContracts: (orderId) => apiClient.get(`/contracts/order/${orderId}`),
  deleteContract: (contractId) => apiClient.delete(`/contracts/${contractId}`),
};

// Notifications API endpoints
export const notificationsAPI = {
  getNotifications: (params) => apiClient.get('/notifications', { params }),
  getNotification: (notificationId) => apiClient.get(`/notifications/${notificationId}`),
  markAsRead: (notificationId) => apiClient.put(`/notifications/${notificationId}/read`),
  markAllAsRead: () => apiClient.put('/notifications/mark-all-read'),
  createNotification: (notificationData) => apiClient.post('/notifications', notificationData),
  broadcastNotification: (broadcastData) => apiClient.post('/notifications/broadcast', broadcastData),
  deleteNotification: (notificationId) => apiClient.delete(`/notifications/${notificationId}`),
  deleteAllRead: () => apiClient.delete('/notifications/read/all'),
  getNotificationStats: (params) => apiClient.get('/notifications/stats/overview', { params }),
  getPreferences: () => apiClient.get('/notifications/preferences'),
  updatePreferences: (preferences) => apiClient.put('/notifications/preferences', preferences),
};

// Company API endpoints
export const companyAPI = {
  getCompanyInfo: () => apiClient.get('/company/info'),
  updateCompanyInfo: (data) => apiClient.put('/company/info', data),
  getVideos: () => apiClient.get('/company/videos'),
  addVideo: (videoData) => apiClient.post('/company/videos', videoData),
  updateVideo: (videoId, data) => apiClient.put(`/company/videos/${videoId}`, data),
  updateVideoOrder: (videos) => apiClient.put('/company/videos/reorder', { videos }),
  updateVideoStatus: (videoId, isActive) => apiClient.put(`/company/videos/${videoId}/status`, { is_active: isActive }),
  deleteVideo: (videoId) => apiClient.delete(`/company/videos/${videoId}`),
  getAboutPage: () => apiClient.get('/company/about'),
  getContactInfo: () => apiClient.get('/company/contact'),
  searchCompany: (query) => apiClient.get('/company/search', { params: { q: query } }),
};

// CRM API endpoints
export const crmAPI = {
  getCustomers: (params) => apiClient.get('/crm/customers', { params }),
  getCustomer: (customerId) => apiClient.get(`/crm/customers/${customerId}`),
  getOrders: (params) => apiClient.get('/crm/orders', { params }),
  syncData: () => apiClient.post('/crm/sync'),
  updateOrderStatus: (crmOrderId, status, notes) => apiClient.put(`/crm/orders/${crmOrderId}/status`, { status, notes }),
  importCustomer: (customerId) => apiClient.post(`/crm/customers/${customerId}/import`),
  getStatus: () => apiClient.get('/crm/status'),
  getSyncHistory: (params) => apiClient.get('/crm/sync/history', { params }),
  updateSettings: (settings) => apiClient.put('/crm/settings', settings),
};

// File upload helper
export const uploadFile = async (file, endpoint, onProgress) => {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    type: file.type,
    name: file.name || 'file',
  });

  try {
    const response = await apiClient.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });
    return response;
  } catch (error) {
    throw error;
  }
};

// Health check
export const healthCheck = () => apiClient.get('/health');

// Export default client for custom requests
export default apiClient;