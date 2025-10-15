import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ============ Vehicle APIs ============
export const vehicleAPI = {
  create: (data) => axios.post(`${API}/vehicles`, data),
  getAll: (status, search) => {
    const params = {};
    if (status) params.status = status;
    if (search) params.search = search;
    return axios.get(`${API}/vehicles`, { params });
  },
  getById: (id) => axios.get(`${API}/vehicles/${id}`),
  update: (id, data) => axios.put(`${API}/vehicles/${id}`, data),
  delete: (id) => axios.delete(`${API}/vehicles/${id}`),
  track: (trackingLink) => axios.get(`${API}/vehicles/track/${trackingLink}`)
};

// ============ Customer APIs ============
export const customerAPI = {
  create: (data) => axios.post(`${API}/customers`, data),
  getAll: (search) => {
    const params = {};
    if (search) params.search = search;
    return axios.get(`${API}/customers`, { params });
  },
  getById: (id) => axios.get(`${API}/customers/${id}`),
  getHistory: (id) => axios.get(`${API}/customers/${id}/history`),
  update: (id, data) => axios.put(`${API}/customers/${id}`, data),
  delete: (id) => axios.delete(`${API}/customers/${id}`)
};

// ============ Technician APIs ============
export const technicianAPI = {
  getAll: () => axios.get(`${API}/technicians`),
  getById: (id) => axios.get(`${API}/technicians/${id}`)
};

// ============ Service APIs ============
export const serviceAPI = {
  getAll: () => axios.get(`${API}/services`)
};

// ============ Parts APIs ============
export const partAPI = {
  create: (data) => axios.post(`${API}/parts`, data),
  getAll: (search, lowStock) => {
    const params = {};
    if (search) params.search = search;
    if (lowStock) params.low_stock = lowStock;
    return axios.get(`${API}/parts`, { params });
  },
  getById: (id) => axios.get(`${API}/parts/${id}`),
  update: (id, data) => axios.put(`${API}/parts/${id}`, data),
  delete: (id) => axios.delete(`${API}/parts/${id}`)
};

// ============ Invoice APIs ============
export const invoiceAPI = {
  create: (data) => axios.post(`${API}/invoices`, data),
  getAll: (vehicleId, customerId) => {
    const params = {};
    if (vehicleId) params.vehicle_id = vehicleId;
    if (customerId) params.customer_id = customerId;
    return axios.get(`${API}/invoices`, { params });
  },
  getById: (id) => axios.get(`${API}/invoices/${id}`)
};

// ============ Transaction APIs ============
export const transactionAPI = {
  create: (data) => axios.post(`${API}/transactions`, data),
  getAll: (type, startDate, endDate) => {
    const params = {};
    if (type) params.type = type;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return axios.get(`${API}/transactions`, { params });
  }
};

// ============ AI APIs ============
export const aiAPI = {
  chat: (message, sessionId) => axios.post(`${API}/ai-bots/workshop-assistant/chat`, null, {
    params: { message, session_id: sessionId }
  }),
  enhancedChat: (message, sessionId, vehicleInfo) => axios.post(`${API}/ai/enhanced-chat`, {
    message,
    session_id: sessionId,
    vehicle_info: vehicleInfo
  }),
  addSolution: (solutionData) => axios.post(`${API}/ai/add-solution`, solutionData),
  searchSolutions: (query, vehicleInfo, problemType) => axios.get(`${API}/ai/search-solutions`, {
    params: { query, vehicle_info: vehicleInfo, problem_type: problemType }
  }),
  getCommonProblems: () => axios.get(`${API}/ai/common-problems`),
  initializeKnowledgeBase: () => axios.post(`${API}/ai/initialize-knowledge-base`)
};

// ============ File Upload APIs ============
export const fileAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`${API}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getUrl: (filename) => `${API}/files/${filename}`
};

// ============ Dashboard Stats API ============
export const statsAPI = {
  get: () => axios.get(`${API}/stats`)
};

export default {
  vehicle: vehicleAPI,
  customer: customerAPI,
  technician: technicianAPI,
  service: serviceAPI,
  part: partAPI,
  invoice: invoiceAPI,
  transaction: transactionAPI,
  ai: aiAPI,
  file: fileAPI,
  stats: statsAPI
};