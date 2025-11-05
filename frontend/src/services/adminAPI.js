import axios from 'axios';

// admin API should go through API Gateway at /admin/*
// API Gateway will proxy to admin_service at /api/admin/*
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const ADMIN_API_BASE_URL = `${API_BASE_URL}/admin`;

const adminAPI = axios.create({
  baseURL: ADMIN_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// request interceptor to add auth token
adminAPI.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// response interceptor for error handling
adminAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // redirect to login if unauthorized
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==================== USER APIs ====================

export const userAPI = {
  getAll: (params = {}) => adminAPI.get('/users', { params }),
  getById: (id) => adminAPI.get(`/users/${id}`),
  create: (data) => {
    return adminAPI.post('/users', data);
  },
  update: (id, data) => {
    return adminAPI.put(`/users/${id}`, data);
  },
  delete: (id) => adminAPI.delete(`/users/${id}`),
  resetPassword: (id, passwordData) => 
    adminAPI.post(`/users/${id}/reset-password`, passwordData),
};

// ==================== BRANCH APIs ====================

export const branchAPI = {
  getAll: (params = {}) => adminAPI.get('/branches', { params }),
  getById: (id) => adminAPI.get(`/branches/${id}`),
  create: (data) => adminAPI.post('/branches', data),
  update: (id, data) => adminAPI.put(`/branches/${id}`, data),
  delete: (id) => adminAPI.delete(`/branches/${id}`),
};

// ==================== INVENTORY APIs ====================

export const inventoryAPI = {
  getAll: (params = {}) => adminAPI.get('/inventory', { params }),
  getById: (id) => adminAPI.get(`/inventory/${id}`),
  create: (data) => adminAPI.post('/inventory', data),
  update: (id, data) => adminAPI.put(`/inventory/${id}`, data),
  delete: (id) => adminAPI.delete(`/inventory/${id}`),
  getLowStock: () => adminAPI.get('/inventory', { params: { low_stock: true } }),
  adjustStock: (partId, quantity_change, reason) =>
    adminAPI.post(`/inventory/${partId}/adjust-stock`, { quantity_change, reason }),
};

// ==================== SERVICE APIs ====================

export const serviceAPI = {
  getAll: (params = {}) => adminAPI.get('/services', { params }),
  getById: (id) => adminAPI.get(`/services/${id}`),
  create: (data) => adminAPI.post('/services', data),
  update: (id, data) => adminAPI.put(`/services/${id}`, data),
  delete: (id) => adminAPI.delete(`/services/${id}`),
};

// ==================== STATS APIs ====================

export const statsAPI = {
  getDashboard: () => adminAPI.get('/stats/dashboard'),
};

// ==================== ACTIVITY APIs ====================

export const activityAPI = {
  getAll: (params = {}) => adminAPI.get('/activities', { params }),
};

// ==================== FINANCE APIs ====================

export const financeAPI = {
  getStats: () => adminAPI.get('/finance/stats'),
  getTransactions: (params = {}) => adminAPI.get('/finance/transactions', { params }),
  getExpenses: () => adminAPI.get('/finance/expenses'),
  exportPDF: (params = {}) => adminAPI.get('/finance/export/pdf', { 
    params,
    responseType: 'blob'
  }),
  exportExcel: (params = {}) => adminAPI.get('/finance/export/excel', { 
    params,
    responseType: 'blob'
  }),
};

// ==================== SHIFT APIs ====================

export const shiftAPI = {
  getAll: (params = {}) => adminAPI.get('/work-schedules', { params }),
  getById: (id) => adminAPI.get(`/work-schedules/${id}`),
  create: (data) => adminAPI.post('/work-schedules', data),
  update: (id, data) => adminAPI.put(`/work-schedules/${id}`, data),
  delete: (id) => adminAPI.delete(`/work-schedules/${id}`),
  getCalendar: (serviceCenterId, month) => adminAPI.get(`/work-schedules/calendar/${serviceCenterId}`, { 
    params: month ? { month } : {} 
  }),
};

export default adminAPI;
