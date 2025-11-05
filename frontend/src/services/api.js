import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 Seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

const silentApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 Seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
  validateStatus: () => true,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

silentApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

silentApi.interceptors.response.use(
  (response) => {
    if (response.status >= 200 && response.status < 300) {
      return response;
    }
    const error = new Error('Service unavailable');
    error.response = response;
    error.status = response.status;
    return Promise.reject(error);
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

const silentRequest = async (requestFn) => {
  try {
    const response = await requestFn();
    if (response.status >= 400) {
      const error = new Error('Service unavailable');
      error.response = response;
      error.status = response.status;
      throw error;
    }
    return response;
  } catch (error) {
    throw error;
  }
};

// Helper to remove null/Undefined values from params before sending to server
const cleanParams = (params) => {
  if (!params) return {};
  const out = {};
  Object.keys(params).forEach((k) => {
    const v = params[k];
    if (v !== null && v !== undefined) out[k] = v;
  });
  return out;
};

export default api;

export const authAPI = {
  login: (email, password) => api.post('/auth/login-json', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
};

export const customerAPI = {
  getVehicles: () => api.get('/customer/vehicles'),
  getVehicle: (id) => api.get(`/customer/vehicles/${id}`),
  createVehicle: (data) => api.post('/customer/vehicles', data),
  updateVehicle: (id, data) => api.put(`/customer/vehicles/${id}`, data),
  deleteVehicle: (id) => api.delete(`/customer/vehicles/${id}`),
  getAppointments: () => api.get('/customer/appointments'),
  getAppointment: (id) => api.get(`/customer/appointments/${id}`),
  createAppointment: (data) => api.post('/customer/appointments', data),
  cancelAppointment: (id) => api.delete(`/customer/appointments/${id}`),
  getServiceTypes: () => api.get('/customer/service-types'),
  getServiceCenters: () => api.get('/customer/service-centers'),
  getParts: (params) => api.get('/customer/parts', { params }),
  getProfile: () => api.get('/customer/profile'),
  updateProfile: (data) => api.put('/customer/profile', data),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/customer/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getMaintenanceReminders: () => api.get('/customer/maintenance-reminders'),
  getServiceHistory: (vehicleId) => api.get('/customer/service-history', { params: { vehicle_id: vehicleId } }),
};

export const serviceCenterAPI = {
  getAllAppointments: (params) => api.get('/service-center/appointments', { params }),
  getAppointment: (id) => api.get('/service-center/appointments', { params: { id } }).then(r => r.data[0] || null),
  updateAppointmentStatus: (id, data) => api.put(`/service-center/appointments/${id}/status`, data),
  assignTechnician: (id, technicianId) => api.put(`/service-center/appointments/${id}/assign-technician`, { technician_id: technicianId }),
  createServiceRecord: (data) => api.post('/service-center/service-records', data),
  getServiceRecords: (vehicleId) => api.get('/service-center/service-records', { params: { vehicle_id: vehicleId } }),
  getParts: (params) => api.get('/service-center/parts', { params }),
  createPart: (data) => api.post('/service-center/parts', data),
  updatePart: (id, data) => api.put(`/service-center/parts/${id}`, data),
  adjustStock: (id, quantityChange, reason) => api.post(`/service-center/parts/${id}/adjust-stock`, { quantity_change: quantityChange, reason }),
  getTechnicians: (availableOnly) => api.get('/service-center/technicians', { params: { available_only: availableOnly } }),
  updateTechnicianAvailability: (id, isAvailable) => api.put(`/service-center/technicians/${id}/availability`, { is_available: isAvailable }),
  getSchedules: (params) => api.get('/service-center/schedules', { params }),
  createSchedule: (data) => api.post('/service-center/schedules', data),
  getCustomers: (search) => api.get('/service-center/customers', { params: { search } }),
  getAllVehicles: (params) => api.get('/service-center/vehicles', { params }),
  getDashboardStats: () => api.get('/service-center/dashboard/stats'),
};

export const invoiceAPI = {
  getInvoices: (customerId) => api.get('/payment/invoices', { params: { customer_id: customerId } }).then(r => r.data),
  getInvoice: (invoiceId) => api.get(`/payment/invoices/${invoiceId}`),
  getInvoiceDetail: (invoiceId) => api.get(`/payment/invoices/${invoiceId}`),
  createInvoice: (data) => {
    // Use manual creation endpoint for full control over invoice data
    return api.post('/payment/invoices/manual', data);
  },
  updateInvoiceStatus: (id, status) => api.put(`/payment/invoices/${id}/status`, { payment_status: status }),
  generateInvoiceForAppointment: (appointmentId) => api.post(`/payment/invoices/generate/${appointmentId}`),
};

export const paymentAPI = {
  getInvoices: () => api.get('/payment/invoices'),
  getComprehensiveInvoices: (params) => api.get('/payment/invoices/comprehensive', { params }),
  getInvoiceDetail: (invoiceId) => api.get(`/payment/invoices/${invoiceId}`),
  createVNPayPayment: (invoiceId) => api.post('/payment/payments/vnpay/create', { invoice_id: invoiceId }),
  recordCashPayment: (invoiceId) => api.post('/payment/payments/cash', { invoice_id: invoiceId }),
  vnpayCallback: (callbackData) => api.post('/payment/payments/vnpay/callback', callbackData),
};

export const notificationAPI = {
  getNotifications: (unreadOnly) => silentRequest(() => silentApi.get('/notification/notifications', { params: { unread_only: unreadOnly } })),
  markAsRead: (id) => silentRequest(() => silentApi.put(`/notification/notifications/${id}/read`)),
  markAllAsRead: () => silentRequest(() => silentApi.put('/notification/notifications/mark-all-read')),
  getUnreadCount: () => silentRequest(() => silentApi.get('/notification/notifications/unread-count')),
};

export const staffAPI = {
  getCustomers: (search) => api.get('/service-center/customers', { params: { search } }),
  getCustomerServiceHistory: (customerId) => api.get('/service-center/service-records', { params: { customer_id: customerId } }),
  getCustomerVehicles: (customerId) => api.get('/service-center/vehicles', { params: { customer_id: customerId } }),
  getAppointments: (params) => api.get('/service-center/appointments', { params }),
  updateAppointmentStatus: (id, data) => api.put(`/service-center/appointments/${id}/status`, data),
  assignTechnician: (appointmentId, data) => api.put(`/service-center/appointments/${appointmentId}/assign-technician`, data),
  deleteAppointment: (id) => api.delete(`/service-center/appointments/${id}`),
  getTechnicians: () => api.get('/service-center/technicians'),
  getServiceTypes: () => api.get('/service-center/service-types'),
  createServiceType: (data) => api.post('/service-center/service-types', data),
  updateServiceType: (id, data) => api.put(`/service-center/service-types/${id}`, data),
  deleteServiceType: (id) => api.delete(`/service-center/service-types/${id}`),
  getParts: (params) => api.get('/service-center/parts', { params }),
  createPart: (data) => api.post('/service-center/parts', data),
  updatePart: (id, data) => api.put(`/service-center/parts/${id}`, data),
  deletePart: (id) => api.delete(`/service-center/parts/${id}`),
  getDashboardStats: () => api.get('/service-center/dashboard/stats'),
  getAppointmentChecklist: (appointmentId) => api.get(`/service-center/appointments/${appointmentId}/checklist`),
  updateChecklistItem: (appointmentId, itemId, data) => api.put(`/service-center/appointments/${appointmentId}/checklist/${itemId}`, data),
  getReport: (reportType, format, dateFrom, dateTo) => {
    const params = { format };
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    return api.get(`/service-center/reports/${reportType}`, { params, responseType: 'blob' });
  },
};

export const technicianAPI = {
  getStats: () => api.get('/service-center/technician/stats').then(r => {
    if (r && r.data) {
      return r.data;
    }
    throw new Error('Invalid response format');
  }).catch(error => {
    console.error('technicianAPI.getStats error:', error);
    throw error;
  }),
  getTodayTasks: () => api.get('/service-center/technician/tasks/today').then(r => r.data),
  getMySchedule: () => api.get('/service-center/technician/schedule/current').then(r => r.data),
  getNotifications: () => api.get('/service-center/technician/notifications').then(r => r.data),
  getTasks: (params) => api.get('/service-center/technician/tasks', { params: cleanParams(params) }).then(r => r.data),
  getTask: (id) => api.get(`/service-center/technician/tasks/${id}`).then(r => r.data),
  getTaskDetails: (id) => api.get(`/service-center/technician/tasks/${id}`).then(r => r.data),
  startTask: (id) => api.post(`/service-center/technician/tasks/${id}/start`).then(r => r.data),
  updateTaskStatus: (id, payload) => api.put(`/service-center/technician/tasks/${id}/status`, payload).then(r => r.data),
  updateProgress: (id, progressData) => api.post(`/service-center/technician/tasks/${id}/progress`, progressData).then(r => r.data),
  completeTask: (id, completionData) => api.post(`/service-center/technician/tasks/${id}/complete`, completionData).then(r => r.data),
  getTaskChecklist: (id) => api.get(`/service-center/technician/tasks/${id}/checklist`).then(r => r.data),
  getProgressHistory: (id) => api.get(`/service-center/technician/tasks/${id}/progress-history`).then(r => r.data),
  updateChecklistItem: (taskId, itemId, completed) => api.put(`/service-center/technician/tasks/${taskId}/checklist/${itemId}`, { completed }).then(r => r.data),
  updateChecklistNotes: (taskId, itemId, notes) => api.put(`/service-center/technician/tasks/${taskId}/checklist/${itemId}/notes`, { notes }).then(r => r.data),
  requestPart: (partData) => api.post('/service-center/technician/parts-request', partData).then(r => r.data),
  getPartsRequests: () => api.get('/service-center/technician/parts-request').then(r => r.data),
  getAvailableParts: (search) => api.get('/service-center/technician/parts/available', { params: { search } }).then(r => r.data),
  uploadTaskImage: (taskId, formData) => api.post(`/service-center/technician/tasks/${taskId}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
  getSchedule: (weekOffset) => api.get('/service-center/technician/schedule', { params: { week_offset: weekOffset } }).then(r => r.data),
  getPerformance: (period) => api.get('/service-center/technician/performance', { params: { period } }).then(r => r.data),
  askAI: (question, context) => api.post('/service-center/technician/ai-assistant', { question, context }).then(r => r.data),
  getErrorCode: (code) => api.get(`/service-center/technician/error-codes/${code}`).then(r => r.data),
  getInvoices: (params) => api.get('/payment/invoices', { params: cleanParams(params) }).then(r => r.data),
};

export const chatAPI = {
  createSession: (sessionData) => silentRequest(() => silentApi.post('/chat/sessions', sessionData)),
  getMySessions: () => silentRequest(() => silentApi.get('/chat/sessions')),
  getAllActiveSessions: () => silentRequest(() => silentApi.get('/chat/sessions/all/active')),
  joinSessionAsStaff: (sessionId) => silentRequest(() => silentApi.post(`/chat/sessions/${sessionId}/join-as-staff`)),
  getSession: (sessionId) => silentRequest(() => silentApi.get(`/chat/sessions/${sessionId}`)),
  closeSession: (sessionId) => silentRequest(() => silentApi.delete(`/chat/sessions/${sessionId}`)),
  getMessages: (sessionId, limit = 100, offset = 0) => silentRequest(() => silentApi.get(`/chat/sessions/${sessionId}/messages`, { params: { limit, offset } })),
  sendMessage: (sessionId, messageData) => silentRequest(() => silentApi.post(`/chat/sessions/${sessionId}/messages`, messageData)),
  getParticipants: (sessionId) => silentRequest(() => silentApi.get(`/chat/sessions/${sessionId}/participants`)),
  addParticipant: (sessionId, userId, userType) => silentRequest(() => silentApi.post(`/chat/sessions/${sessionId}/participants`, { user_id: userId, user_type: userType })),
  askAI: (message, sessionId = null, context = {}) => silentRequest(() => silentApi.post('/chat/ai/ask', { message, session_id: sessionId, context })),
  connectWebSocket: (sessionId, token) => {
    const wsUrl = API_BASE_URL.replace('http', 'ws');
    const fullWsUrl = `${wsUrl}/chat/ws/chat/${sessionId}?token=${token}`;
    return new WebSocket(fullWsUrl);
  },
};
